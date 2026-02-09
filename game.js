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

// Colors
const COL = {
  bg: '#0f0e17',
  player: '#ff8906',
  playerFace: '#0f0e17',
  platNormal: '#e53170',
  platMoving: '#2cb67d',
  platBreaking: '#7f5af0',
  text: '#fffffe',
  scoreBg: 'rgba(15,14,23,0.6)',
};

// Game state
let player, platforms, score, highScore, maxHeight, animationId, gameRunning;
let keys = {};

// High score persistence
highScore = parseInt(localStorage.getItem('jumperHighScore') || '0', 10);

document.addEventListener('keydown', (e) => {
  keys[e.key] = true;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' '].includes(e.key)) e.preventDefault();
});
document.addEventListener('keyup', (e) => { keys[e.key] = false; });

function initGame() {
  score = 0;
  maxHeight = 0;

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
  // Ground platform
  platforms.push(makePlatform(W / 2 - PLAT_W / 2, H - 50, 'normal'));

  // Generate initial platforms
  for (let i = 1; i < PLAT_COUNT; i++) {
    const y = H - 50 - i * (H / PLAT_COUNT);
    platforms.push(makePlatform(Math.random() * (W - PLAT_W), y, randomType()));
  }
}

function makePlatform(x, y, type) {
  return {
    x,
    y,
    w: PLAT_W,
    h: PLAT_H,
    type, // 'normal', 'moving', 'breaking'
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

function update() {
  // Player horizontal movement
  player.vx = 0;
  if (keys['ArrowLeft'] || keys['a']) { player.vx = -MOVE_SPEED; player.facing = -1; }
  if (keys['ArrowRight'] || keys['d']) { player.vx = MOVE_SPEED; player.facing = 1; }

  player.x += player.vx;
  player.vy += GRAVITY;
  player.y += player.vy;

  // Wrap horizontally
  if (player.x + player.w < 0) player.x = W;
  if (player.x > W) player.x = -player.w;

  // Move platforms & check collisions
  for (const p of platforms) {
    // Moving platforms
    if (p.type === 'moving' && !p.broken) {
      p.x += p.dx;
      if (p.x <= 0 || p.x + p.w >= W) p.dx = -p.dx;
    }

    // Breaking platform animation
    if (p.broken) {
      p.breakTimer++;
      p.y += 3;
      continue;
    }

    // Collision: only when falling
    if (player.vy > 0) {
      if (
        player.x + player.w > p.x + 5 &&
        player.x < p.x + p.w - 5 &&
        player.y + player.h >= p.y &&
        player.y + player.h <= p.y + p.h + player.vy
      ) {
        if (p.type === 'breaking') {
          p.broken = true;
        }
        player.vy = JUMP_VELOCITY;
        player.y = p.y - player.h;
      }
    }
  }

  // Scroll camera when player goes above midpoint
  if (player.y < H / 2) {
    const shift = H / 2 - player.y;
    player.y = H / 2;
    maxHeight += shift;
    score = Math.floor(maxHeight);

    for (const p of platforms) {
      p.y += shift;
    }

    // Remove off-screen platforms and add new ones
    for (let i = platforms.length - 1; i >= 0; i--) {
      if (platforms[i].y > H + 50) {
        platforms.splice(i, 1);
      }
    }

    while (platforms.length < PLAT_COUNT) {
      // Find the highest platform
      let minY = H;
      for (const p of platforms) {
        if (p.y < minY) minY = p.y;
      }
      const newY = minY - (60 + Math.random() * 80);
      platforms.push(makePlatform(Math.random() * (W - PLAT_W), newY, randomType()));
    }
  }

  // Game over: fell off screen
  if (player.y > H + 50) {
    endGame();
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  // Draw platforms
  for (const p of platforms) {
    if (p.broken && p.breakTimer > 15) continue;
    ctx.globalAlpha = p.broken ? Math.max(0, 1 - p.breakTimer / 15) : 1;

    if (p.type === 'normal') ctx.fillStyle = COL.platNormal;
    else if (p.type === 'moving') ctx.fillStyle = COL.platMoving;
    else ctx.fillStyle = COL.platBreaking;

    // Draw rounded platform
    roundRect(p.x, p.y, p.w, p.h, 6);
    ctx.fill();

    // Top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(p.x + 4, p.y + 2, p.w - 8, 4);

    ctx.globalAlpha = 1;
  }

  // Draw player (simple character)
  drawPlayer();

  // Score HUD
  ctx.fillStyle = COL.scoreBg;
  ctx.fillRect(0, 0, W, 36);
  ctx.fillStyle = COL.text;
  ctx.font = 'bold 16px "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Score: ${score}`, 12, 24);
  ctx.textAlign = 'right';
  ctx.fillText(`Best: ${Math.max(score, highScore)}`, W - 12, 24);
}

function drawPlayer() {
  const cx = player.x + player.w / 2;
  const cy = player.y + player.h / 2;

  // Body
  ctx.fillStyle = COL.player;
  ctx.beginPath();
  ctx.arc(cx, cy, player.w / 2, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  const eyeOffX = 6 * player.facing;
  ctx.fillStyle = COL.playerFace;
  ctx.beginPath();
  ctx.arc(cx + eyeOffX - 5, cy - 4, 3.5, 0, Math.PI * 2);
  ctx.arc(cx + eyeOffX + 5, cy - 4, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Mouth
  ctx.beginPath();
  if (player.vy < 0) {
    // Happy when going up
    ctx.arc(cx + eyeOffX, cy + 6, 5, 0, Math.PI);
  } else {
    // Worried when falling
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
    <button id="startBtn">Play Again</button>
  `;
  overlay.querySelector('#startBtn').addEventListener('click', startGame);
}

startBtn.addEventListener('click', startGame);
