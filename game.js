const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');

const W = canvas.width;
const H = canvas.height;

// Physics
const GRAVITY = 0.4;
const JUMP_VELOCITY = -11;
const MOVE_SPEED = 6;

// Player
const PLAYER_W = 36;
const PLAYER_H = 36;

// Platforms
const PLAT_W = 75;
const PLAT_H = 14;
const PLAT_COUNT = 8;

// ── Zone thresholds (by score/maxHeight) ──
const ZONE_GROUND = 0;
const ZONE_SKY = 800;
const ZONE_HIGH_SKY = 2500;
const ZONE_ATMOSPHERE = 5000;
const ZONE_SPACE = 8000;
const ZONE_DEEP_SPACE = 12000;
const ZONE_MOON = 18000;

// ── Stars (generated once, scroll with parallax) ──
const stars = [];
for (let i = 0; i < 200; i++) {
  stars.push({
    x: Math.random() * W,
    y: Math.random() * 4000 - 2000,
    r: Math.random() * 1.8 + 0.3,
    twinkleSpeed: Math.random() * 0.03 + 0.01,
    twinkleOffset: Math.random() * Math.PI * 2,
  });
}

// ── Clouds ──
const clouds = [];
for (let i = 0; i < 12; i++) {
  clouds.push({
    x: Math.random() * W,
    baseY: Math.random() * 3000,
    w: 60 + Math.random() * 80,
    h: 20 + Math.random() * 20,
    speed: 0.2 + Math.random() * 0.4,
  });
}

// Game state
let player, platforms, score, highScore, maxHeight, animationId, gameRunning;
let keys = {};
let frameCount = 0;

highScore = parseInt(localStorage.getItem('jumperHighScore') || '0', 10);

document.addEventListener('keydown', (e) => {
  keys[e.key] = true;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' '].includes(e.key)) e.preventDefault();
});
document.addEventListener('keyup', (e) => { keys[e.key] = false; });

// ── Zone helpers ──
function getZoneProgress(from, to) {
  return Math.min(1, Math.max(0, (score - from) / (to - from)));
}

function lerpColor(a, b, t) {
  const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bv = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bv})`;
}

function getZoneName() {
  if (score < ZONE_SKY) return 'Earth';
  if (score < ZONE_HIGH_SKY) return 'Sky';
  if (score < ZONE_ATMOSPHERE) return 'High Altitude';
  if (score < ZONE_SPACE) return 'Atmosphere';
  if (score < ZONE_DEEP_SPACE) return 'Space';
  if (score < ZONE_MOON) return 'Deep Space';
  return 'The Moon';
}

// ── Background drawing ──
function drawBackground() {
  // Sky color transitions
  let bgTop, bgBot;

  if (score < ZONE_SKY) {
    // Earth: green-brown ground feel fading to blue sky
    const t = getZoneProgress(ZONE_GROUND, ZONE_SKY);
    bgTop = lerpColor('#87CEEB', '#5BA3D9', t);
    bgBot = lerpColor('#4A8C5C', '#87CEEB', t);
  } else if (score < ZONE_HIGH_SKY) {
    const t = getZoneProgress(ZONE_SKY, ZONE_HIGH_SKY);
    bgTop = lerpColor('#5BA3D9', '#2A5CAA', t);
    bgBot = lerpColor('#87CEEB', '#5BA3D9', t);
  } else if (score < ZONE_ATMOSPHERE) {
    const t = getZoneProgress(ZONE_HIGH_SKY, ZONE_ATMOSPHERE);
    bgTop = lerpColor('#2A5CAA', '#0B1533', t);
    bgBot = lerpColor('#5BA3D9', '#1A3A6A', t);
  } else if (score < ZONE_SPACE) {
    const t = getZoneProgress(ZONE_ATMOSPHERE, ZONE_SPACE);
    bgTop = lerpColor('#0B1533', '#050510', t);
    bgBot = lerpColor('#1A3A6A', '#0B1533', t);
  } else {
    bgTop = '#050510';
    bgBot = '#0A0A1A';
  }

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, bgTop);
  grad.addColorStop(1, bgBot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // ── Earth ground (only at start) ──
  if (score < ZONE_SKY) {
    const groundAlpha = 1 - getZoneProgress(ZONE_GROUND, ZONE_SKY);
    if (groundAlpha > 0) {
      ctx.globalAlpha = groundAlpha;
      drawGround();
      ctx.globalAlpha = 1;
    }
  }

  // ── Clouds (visible in sky zones) ──
  if (score < ZONE_ATMOSPHERE + 1000) {
    let cloudAlpha = 1;
    if (score > ZONE_HIGH_SKY) {
      cloudAlpha = 1 - getZoneProgress(ZONE_HIGH_SKY, ZONE_ATMOSPHERE + 1000);
    }
    if (cloudAlpha > 0) {
      ctx.globalAlpha = cloudAlpha * 0.7;
      drawClouds();
      ctx.globalAlpha = 1;
    }
  }

  // ── Stars (fade in at atmosphere, full in space) ──
  if (score > ZONE_HIGH_SKY) {
    let starAlpha = getZoneProgress(ZONE_HIGH_SKY, ZONE_SPACE);
    ctx.globalAlpha = starAlpha;
    drawStars();
    ctx.globalAlpha = 1;
  }

  // ── Moon (visible in deep space+) ──
  if (score > ZONE_DEEP_SPACE) {
    const moonProgress = getZoneProgress(ZONE_DEEP_SPACE, ZONE_MOON);
    drawMoon(moonProgress);
  }
}

function drawGround() {
  // Grass/earth at the bottom
  const groundY = H - 40 + (score * 0.05);
  if (groundY < H + 60) {
    // Dirt
    ctx.fillStyle = '#5C3D2E';
    ctx.fillRect(0, groundY, W, H - groundY + 60);

    // Grass
    ctx.fillStyle = '#4A8C5C';
    ctx.fillRect(0, groundY, W, 12);
    ctx.fillStyle = '#5CA06A';
    ctx.fillRect(0, groundY, W, 6);

    // Grass blades
    ctx.fillStyle = '#3D7A4A';
    for (let gx = 0; gx < W; gx += 8) {
      const bladeH = 6 + Math.sin(gx * 0.5 + frameCount * 0.05) * 3;
      ctx.fillRect(gx, groundY - bladeH, 3, bladeH);
    }

    // Small hills
    ctx.fillStyle = '#4A8C5C';
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    for (let hx = 0; hx <= W; hx += 5) {
      const hy = groundY - 15 * Math.sin(hx * 0.015) - 8 * Math.sin(hx * 0.04 + 1);
      ctx.lineTo(hx, hy);
    }
    ctx.lineTo(W, groundY);
    ctx.closePath();
    ctx.fill();

    // Trees
    drawTree(60, groundY);
    drawTree(200, groundY);
    drawTree(380, groundY);
  }
}

function drawTree(tx, groundY) {
  // Trunk
  ctx.fillStyle = '#6B4226';
  ctx.fillRect(tx - 4, groundY - 40, 8, 40);
  // Canopy
  ctx.fillStyle = '#2E7D32';
  ctx.beginPath();
  ctx.arc(tx, groundY - 50, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#388E3C';
  ctx.beginPath();
  ctx.arc(tx - 8, groundY - 42, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(tx + 10, groundY - 44, 15, 0, Math.PI * 2);
  ctx.fill();
}

function drawClouds() {
  ctx.fillStyle = '#ffffff';
  for (const c of clouds) {
    // Parallax: clouds move slower than camera
    const drawY = c.baseY - maxHeight * 0.3 + H * 0.3;
    if (drawY < -100 || drawY > H + 100) continue;

    c.x += c.speed;
    if (c.x > W + c.w) c.x = -c.w;

    // Fluffy cloud shape
    ctx.beginPath();
    ctx.arc(c.x, drawY, c.h * 0.7, 0, Math.PI * 2);
    ctx.arc(c.x + c.w * 0.25, drawY - c.h * 0.3, c.h * 0.8, 0, Math.PI * 2);
    ctx.arc(c.x + c.w * 0.55, drawY - c.h * 0.1, c.h * 0.65, 0, Math.PI * 2);
    ctx.arc(c.x + c.w * 0.75, drawY, c.h * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStars() {
  for (const s of stars) {
    // Parallax scrolling
    let drawY = ((s.y - maxHeight * 0.1) % (H + 200));
    if (drawY < 0) drawY += H + 200;
    drawY -= 100;

    // Twinkle
    const twinkle = 0.5 + 0.5 * Math.sin(frameCount * s.twinkleSpeed + s.twinkleOffset);
    ctx.globalAlpha = ctx.globalAlpha * (0.4 + 0.6 * twinkle);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(s.x, drawY, s.r, 0, Math.PI * 2);
    ctx.fill();

    // Restore alpha to parent
    ctx.globalAlpha = score > ZONE_SPACE ? 1 : getZoneProgress(ZONE_HIGH_SKY, ZONE_SPACE);
  }
}

function drawMoon(progress) {
  // Moon grows and gets closer as you approach ZONE_MOON
  const moonSize = 30 + progress * 100;
  const moonX = W * 0.65;
  const moonY = 80 + (1 - progress) * 200;

  ctx.save();

  // Glow
  const glowGrad = ctx.createRadialGradient(moonX, moonY, moonSize * 0.5, moonX, moonY, moonSize * 2.5);
  glowGrad.addColorStop(0, `rgba(255, 255, 220, ${0.15 * progress})`);
  glowGrad.addColorStop(1, 'rgba(255, 255, 220, 0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, W, H);

  // Moon body
  ctx.fillStyle = '#E8E0D0';
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonSize, 0, Math.PI * 2);
  ctx.fill();

  // Moon surface detail (craters)
  ctx.fillStyle = '#CDC5B5';
  drawCrater(moonX - moonSize * 0.3, moonY - moonSize * 0.2, moonSize * 0.2);
  drawCrater(moonX + moonSize * 0.2, moonY + moonSize * 0.15, moonSize * 0.28);
  drawCrater(moonX - moonSize * 0.1, moonY + moonSize * 0.4, moonSize * 0.15);
  drawCrater(moonX + moonSize * 0.4, moonY - moonSize * 0.3, moonSize * 0.12);

  // Light edge
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonSize, -Math.PI * 0.4, Math.PI * 0.4);
  ctx.stroke();

  ctx.restore();
}

function drawCrater(cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#B8B0A0';
  ctx.beginPath();
  ctx.arc(cx + r * 0.15, cy + r * 0.15, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#CDC5B5';
}

// ── Platform colors by zone ──
function getPlatformColor(type) {
  if (score < ZONE_SKY) {
    // Earth: natural colors
    if (type === 'normal') return '#6B8E4E';
    if (type === 'moving') return '#A0784C';
    return '#8B6B4C';
  } else if (score < ZONE_ATMOSPHERE) {
    // Sky: cloud-like
    if (type === 'normal') return '#6BA3C7';
    if (type === 'moving') return '#4ECDC4';
    return '#957FBF';
  } else if (score < ZONE_SPACE) {
    // Atmosphere transition
    if (type === 'normal') return '#4A6FA5';
    if (type === 'moving') return '#2CB67D';
    return '#7F5AF0';
  } else {
    // Space: glowing neon
    if (type === 'normal') return '#E53170';
    if (type === 'moving') return '#2CB67D';
    return '#7F5AF0';
  }
}

// ── Init ──
function initGame() {
  score = 0;
  maxHeight = 0;
  frameCount = 0;

  player = {
    x: W / 2 - PLAYER_W / 2,
    y: H - 100,
    w: PLAYER_W,
    h: PLAYER_H,
    vy: JUMP_VELOCITY,
    vx: 0,
    facing: 1,
  };

  platforms = [];
  platforms.push(makePlatform(W / 2 - PLAT_W / 2, H - 50, 'normal'));
  for (let i = 1; i < PLAT_COUNT; i++) {
    const y = H - 50 - i * (H / PLAT_COUNT);
    platforms.push(makePlatform(Math.random() * (W - PLAT_W), y, randomType()));
  }
}

function makePlatform(x, y, type) {
  return {
    x, y, w: PLAT_W, h: PLAT_H,
    type,
    dx: type === 'moving' ? (Math.random() > 0.5 ? 2 : -2) : 0,
    broken: false,
    breakTimer: 0,
  };
}

function randomType() {
  const r = Math.random();
  if (score > 2000 && r < 0.2) return 'breaking';
  if (score > 500 && r < 0.35) return 'moving';
  return 'normal';
}

// ── Update ──
function update() {
  frameCount++;

  player.vx = 0;
  if (keys['ArrowLeft'] || keys['a']) { player.vx = -MOVE_SPEED; player.facing = -1; }
  if (keys['ArrowRight'] || keys['d']) { player.vx = MOVE_SPEED; player.facing = 1; }

  player.x += player.vx;
  player.vy += GRAVITY;
  player.y += player.vy;

  // Wrap horizontally
  if (player.x + player.w < 0) player.x = W;
  if (player.x > W) player.x = -player.w;

  for (const p of platforms) {
    if (p.type === 'moving' && !p.broken) {
      p.x += p.dx;
      if (p.x <= 0 || p.x + p.w >= W) p.dx = -p.dx;
    }
    if (p.broken) {
      p.breakTimer++;
      p.y += 3;
      continue;
    }
    if (player.vy > 0) {
      if (
        player.x + player.w > p.x + 5 &&
        player.x < p.x + p.w - 5 &&
        player.y + player.h >= p.y &&
        player.y + player.h <= p.y + p.h + player.vy
      ) {
        if (p.type === 'breaking') p.broken = true;
        player.vy = JUMP_VELOCITY;
        player.y = p.y - player.h;
      }
    }
  }

  // Camera scroll
  if (player.y < H / 2) {
    const shift = H / 2 - player.y;
    player.y = H / 2;
    maxHeight += shift;
    score = Math.floor(maxHeight);

    for (const p of platforms) p.y += shift;

    for (let i = platforms.length - 1; i >= 0; i--) {
      if (platforms[i].y > H + 50) platforms.splice(i, 1);
    }

    while (platforms.length < PLAT_COUNT) {
      let minY = H;
      for (const p of platforms) { if (p.y < minY) minY = p.y; }
      const newY = minY - (60 + Math.random() * 80);
      platforms.push(makePlatform(Math.random() * (W - PLAT_W), newY, randomType()));
    }
  }

  if (player.y > H + 50) endGame();
}

// ── Draw ──
function draw() {
  // Background with environment
  drawBackground();

  // Platforms
  for (const p of platforms) {
    if (p.broken && p.breakTimer > 15) continue;
    ctx.globalAlpha = p.broken ? Math.max(0, 1 - p.breakTimer / 15) : 1;

    ctx.fillStyle = getPlatformColor(p.type);

    // In space, add glow
    if (score > ZONE_SPACE) {
      ctx.shadowColor = getPlatformColor(p.type);
      ctx.shadowBlur = 8;
    }

    roundRect(p.x, p.y, p.w, p.h, 6);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(p.x + 4, p.y + 2, p.w - 8, 4);

    ctx.globalAlpha = 1;
  }

  // Player
  drawPlayer();

  // HUD
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, W, 40);
  ctx.fillStyle = '#fffffe';
  ctx.font = 'bold 15px "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Score: ${score}`, 12, 26);
  ctx.textAlign = 'center';
  ctx.font = '13px "Segoe UI", sans-serif';
  ctx.fillStyle = '#a0a0b8';
  ctx.fillText(getZoneName(), W / 2, 26);
  ctx.textAlign = 'right';
  ctx.font = 'bold 15px "Segoe UI", sans-serif';
  ctx.fillStyle = '#fffffe';
  ctx.fillText(`Best: ${Math.max(score, highScore)}`, W - 12, 26);
}

function drawPlayer() {
  const cx = player.x + player.w / 2;
  const cy = player.y + player.h / 2;

  // In space, add glow to player
  if (score > ZONE_SPACE) {
    ctx.shadowColor = '#ff8906';
    ctx.shadowBlur = 12;
  }

  // Body
  ctx.fillStyle = '#ff8906';
  ctx.beginPath();
  ctx.arc(cx, cy, player.w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Space helmet visor (in atmosphere+)
  if (score > ZONE_ATMOSPHERE) {
    const helmetAlpha = getZoneProgress(ZONE_ATMOSPHERE, ZONE_SPACE);
    ctx.globalAlpha = helmetAlpha;
    ctx.strokeStyle = 'rgba(180, 220, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, player.w / 2 + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Eyes
  const eyeOffX = 6 * player.facing;
  ctx.fillStyle = '#0f0e17';
  ctx.beginPath();
  ctx.arc(cx + eyeOffX - 5, cy - 4, 3.5, 0, Math.PI * 2);
  ctx.arc(cx + eyeOffX + 5, cy - 4, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Mouth
  ctx.strokeStyle = '#0f0e17';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (player.vy < 0) {
    ctx.arc(cx + eyeOffX, cy + 6, 5, 0, Math.PI);
  } else {
    ctx.arc(cx + eyeOffX, cy + 10, 4, Math.PI, 0);
  }
  ctx.stroke();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function gameLoop() {
  update();
  draw();
  animationId = requestAnimationFrame(gameLoop);
}

function startGame() {
  overlay.classList.add('hidden');
  initGame();
  gameRunning = true;
  gameLoop();
}

function endGame() {
  gameRunning = false;
  cancelAnimationFrame(animationId);
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('jumperHighScore', String(highScore));
  }
  showOverlay();
}

function showOverlay() {
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <h1>Game Over</h1>
    <div class="final-score">Score: ${score}</div>
    <div class="high-score">Best: ${highScore}</div>
    <p style="margin-top:0.3rem">You reached: ${getZoneName()}</p>
    <button id="startBtn">Play Again</button>
  `;
  overlay.querySelector('#startBtn').addEventListener('click', startGame);
}

startBtn.addEventListener('click', startGame);
