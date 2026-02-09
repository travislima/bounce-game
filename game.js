const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

// Colors
const COLORS = {
  ball: '#e94560',
  paddle: '#e94560',
  brickColors: ['#e94560', '#0f3460', '#533483', '#16213e', '#e94560'],
  text: '#eee',
  scoreBar: 'rgba(22, 33, 62, 0.7)',
};

// Game state
let ball, paddle, bricks, score, lives, animationId, gameRunning, level;

// Paddle
const PADDLE_WIDTH = 120;
const PADDLE_HEIGHT = 14;
const PADDLE_SPEED = 8;

// Ball
const BALL_RADIUS = 8;
const BALL_BASE_SPEED = 5;

// Bricks
const BRICK_ROWS = 5;
const BRICK_COLS = 10;
const BRICK_WIDTH = 70;
const BRICK_HEIGHT = 22;
const BRICK_PADDING = 6;
const BRICK_OFFSET_TOP = 60;
const BRICK_OFFSET_LEFT = (WIDTH - (BRICK_COLS * (BRICK_WIDTH + BRICK_PADDING) - BRICK_PADDING)) / 2;

// Input
let keys = {};
let mouseX = null;

document.addEventListener('keydown', (e) => {
  keys[e.key] = true;
  if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
});
document.addEventListener('keyup', (e) => { keys[e.key] = false; });
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
});
canvas.addEventListener('mouseleave', () => { mouseX = null; });

function initGame() {
  score = 0;
  lives = 3;
  level = 1;
  resetBall();
  resetPaddle();
  createBricks();
}

function resetBall() {
  ball = {
    x: WIDTH / 2,
    y: HEIGHT - 50,
    dx: BALL_BASE_SPEED * (Math.random() > 0.5 ? 1 : -1),
    dy: -BALL_BASE_SPEED,
    radius: BALL_RADIUS,
  };
}

function resetPaddle() {
  paddle = {
    x: (WIDTH - PADDLE_WIDTH) / 2,
    y: HEIGHT - 30,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
  };
}

function createBricks() {
  bricks = [];
  for (let row = 0; row < BRICK_ROWS; row++) {
    for (let col = 0; col < BRICK_COLS; col++) {
      bricks.push({
        x: BRICK_OFFSET_LEFT + col * (BRICK_WIDTH + BRICK_PADDING),
        y: BRICK_OFFSET_TOP + row * (BRICK_HEIGHT + BRICK_PADDING),
        width: BRICK_WIDTH,
        height: BRICK_HEIGHT,
        alive: true,
        color: COLORS.brickColors[row % COLORS.brickColors.length],
        points: (BRICK_ROWS - row) * 10,
      });
    }
  }
}

function movePaddle() {
  if (mouseX !== null) {
    paddle.x = mouseX - paddle.width / 2;
  } else {
    if (keys['ArrowLeft'] || keys['a']) paddle.x -= PADDLE_SPEED;
    if (keys['ArrowRight'] || keys['d']) paddle.x += PADDLE_SPEED;
  }
  paddle.x = Math.max(0, Math.min(WIDTH - paddle.width, paddle.x));
}

function moveBall() {
  ball.x += ball.dx;
  ball.y += ball.dy;

  // Wall collisions
  if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= WIDTH) {
    ball.dx = -ball.dx;
    ball.x = Math.max(ball.radius, Math.min(WIDTH - ball.radius, ball.x));
  }
  if (ball.y - ball.radius <= 0) {
    ball.dy = -ball.dy;
    ball.y = ball.radius;
  }

  // Paddle collision
  if (
    ball.dy > 0 &&
    ball.y + ball.radius >= paddle.y &&
    ball.y + ball.radius <= paddle.y + paddle.height + ball.dy &&
    ball.x >= paddle.x &&
    ball.x <= paddle.x + paddle.width
  ) {
    ball.dy = -Math.abs(ball.dy);
    // Adjust angle based on where ball hits paddle
    const hitPos = (ball.x - paddle.x) / paddle.width; // 0 to 1
    const angle = (hitPos - 0.5) * Math.PI * 0.7; // -63 to +63 degrees
    const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
    ball.dx = speed * Math.sin(angle);
    ball.dy = -speed * Math.cos(angle);
  }

  // Ball falls below
  if (ball.y - ball.radius > HEIGHT) {
    lives--;
    if (lives <= 0) {
      endGame(false);
      return;
    }
    resetBall();
    resetPaddle();
  }
}

function checkBrickCollisions() {
  for (const brick of bricks) {
    if (!brick.alive) continue;

    if (
      ball.x + ball.radius > brick.x &&
      ball.x - ball.radius < brick.x + brick.width &&
      ball.y + ball.radius > brick.y &&
      ball.y - ball.radius < brick.y + brick.height
    ) {
      brick.alive = false;
      score += brick.points;

      // Determine bounce direction
      const overlapLeft = ball.x + ball.radius - brick.x;
      const overlapRight = brick.x + brick.width - (ball.x - ball.radius);
      const overlapTop = ball.y + ball.radius - brick.y;
      const overlapBottom = brick.y + brick.height - (ball.y - ball.radius);

      const minOverlapX = Math.min(overlapLeft, overlapRight);
      const minOverlapY = Math.min(overlapTop, overlapBottom);

      if (minOverlapX < minOverlapY) {
        ball.dx = -ball.dx;
      } else {
        ball.dy = -ball.dy;
      }
      break; // one brick per frame
    }
  }

  // Check if all bricks are gone
  if (bricks.every((b) => !b.alive)) {
    level++;
    createBricks();
    resetBall();
    resetPaddle();
    // Speed up slightly each level
    ball.dx *= 1.1;
    ball.dy *= 1.1;
  }
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  // Score bar
  ctx.fillStyle = COLORS.scoreBar;
  ctx.fillRect(0, 0, WIDTH, 40);
  ctx.fillStyle = COLORS.text;
  ctx.font = '16px "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Score: ${score}`, 15, 26);
  ctx.textAlign = 'center';
  ctx.fillText(`Level: ${level}`, WIDTH / 2, 26);
  ctx.textAlign = 'right';
  ctx.fillText(`Lives: ${'♥'.repeat(lives)}`, WIDTH - 15, 26);

  // Bricks
  for (const brick of bricks) {
    if (!brick.alive) continue;
    ctx.fillStyle = brick.color;
    roundRect(ctx, brick.x, brick.y, brick.width, brick.height, 3);
    ctx.fill();
    // highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(brick.x + 2, brick.y + 2, brick.width - 4, brick.height / 2 - 2);
  }

  // Paddle
  ctx.fillStyle = COLORS.paddle;
  roundRect(ctx, paddle.x, paddle.y, paddle.width, paddle.height, 6);
  ctx.fill();
  // paddle shine
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(paddle.x + 4, paddle.y + 2, paddle.width - 8, paddle.height / 2 - 1);

  // Ball
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.ball;
  ctx.fill();
  // ball shine
  ctx.beginPath();
  ctx.arc(ball.x - 2, ball.y - 2, ball.radius * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
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
  movePaddle();
  moveBall();
  checkBrickCollisions();
  draw();
  animationId = requestAnimationFrame(gameLoop);
}

function startGame() {
  overlay.classList.add('hidden');
  initGame();
  gameRunning = true;
  gameLoop();
}

function endGame(won) {
  gameRunning = false;
  cancelAnimationFrame(animationId);
  showOverlay(won);
}

function showOverlay(won) {
  overlay.classList.remove('hidden');
  const h1 = overlay.querySelector('h1');
  const p = overlay.querySelector('p');

  if (won === undefined) {
    // Initial state
    h1.textContent = 'Bounce Game';
    p.textContent = 'Break all the bricks! Use arrow keys or mouse to move the paddle.';
    startBtn.textContent = 'Start Game';
  } else if (won) {
    h1.textContent = 'You Win!';
    p.textContent = `Final Score: ${score}`;
    startBtn.textContent = 'Play Again';
  } else {
    h1.textContent = 'Game Over';
    p.textContent = `Final Score: ${score}`;
    startBtn.textContent = 'Try Again';
  }
}

startBtn.addEventListener('click', startGame);
