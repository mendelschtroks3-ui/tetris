const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const PREVIEW_BLOCK_SIZE = 24;

const COLORS = {
  I: "#22d3ee",
  O: "#facc15",
  T: "#a78bfa",
  S: "#4ade80",
  Z: "#f87171",
  J: "#60a5fa",
  L: "#fb923c"
};

const PIECES = {
  I: [[1, 1, 1, 1]],
  O: [
    [1, 1],
    [1, 1]
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1]
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0]
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1]
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1]
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1]
  ]
};

const boardCanvas = document.getElementById("board");
const boardCtx = boardCanvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");

const startButton = document.getElementById("startButton");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const statusEl = document.getElementById("status");

let board = createBoard();
let activePiece = null;
let nextPiece = null;
let gameOver = false;
let paused = false;
let score = 0;
let lines = 0;
let level = 1;
let dropAccumulator = 0;
let lastTime = 0;
let animationId = null;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece() {
  const types = Object.keys(PIECES);
  const type = types[Math.floor(Math.random() * types.length)];
  const shape = PIECES[type].map((row) => [...row]);

  return {
    type,
    color: COLORS[type],
    shape,
    x: Math.floor(COLS / 2) - Math.ceil(shape[0].length / 2),
    y: 0
  };
}

function rotate(shape) {
  return shape[0].map((_, col) => shape.map((row) => row[col]).reverse());
}

function collides(piece, offsetX = 0, offsetY = 0, testShape = piece.shape) {
  for (let y = 0; y < testShape.length; y++) {
    for (let x = 0; x < testShape[y].length; x++) {
      if (!testShape[y][x]) {
        continue;
      }

      const newX = piece.x + x + offsetX;
      const newY = piece.y + y + offsetY;

      if (newX < 0 || newX >= COLS || newY >= ROWS) {
        return true;
      }

      if (newY >= 0 && board[newY][newX]) {
        return true;
      }
    }
  }

  return false;
}

function mergePiece(piece) {
  piece.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        const boardY = piece.y + y;
        if (boardY >= 0) {
          board[boardY][piece.x + x] = piece.color;
        }
      }
    });
  });
}

function clearLines() {
  let cleared = 0;

  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every(Boolean)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(null));
      cleared++;
      y++;
    }
  }

  if (cleared > 0) {
    const points = [0, 100, 300, 500, 800];
    score += points[cleared] * level;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    updateStats();
  }
}

function spawnPiece() {
  activePiece = nextPiece ?? randomPiece();
  nextPiece = randomPiece();
  drawNextPiece();

  if (collides(activePiece, 0, 0)) {
    gameOver = true;
    statusEl.textContent = "Game over! Press Start / Restart to play again.";
    cancelAnimationFrame(animationId);
  }
}

function hardDrop() {
  while (!collides(activePiece, 0, 1)) {
    activePiece.y++;
    score += 2;
  }
  settlePiece();
  updateStats();
}

function settlePiece() {
  mergePiece(activePiece);
  clearLines();
  spawnPiece();
}

function move(dx) {
  if (!collides(activePiece, dx, 0)) {
    activePiece.x += dx;
  }
}

function softDrop() {
  if (!collides(activePiece, 0, 1)) {
    activePiece.y++;
    score += 1;
    updateStats();
    return;
  }
  settlePiece();
}

function rotatePiece() {
  const rotated = rotate(activePiece.shape);
  if (!collides(activePiece, 0, 0, rotated)) {
    activePiece.shape = rotated;
    return;
  }

  if (!collides(activePiece, -1, 0, rotated)) {
    activePiece.x -= 1;
    activePiece.shape = rotated;
  } else if (!collides(activePiece, 1, 0, rotated)) {
    activePiece.x += 1;
    activePiece.shape = rotated;
  }
}

function drawCell(ctx, x, y, color, size = BLOCK_SIZE) {
  ctx.fillStyle = color;
  ctx.fillRect(x * size, y * size, size, size);
  ctx.strokeStyle = "rgba(15, 23, 42, 0.85)";
  ctx.strokeRect(x * size + 0.5, y * size + 0.5, size - 1, size - 1);
}

function drawBoard() {
  boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);

  board.forEach((row, y) => {
    row.forEach((color, x) => {
      if (color) {
        drawCell(boardCtx, x, y, color);
      }
    });
  });

  if (activePiece) {
    activePiece.shape.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
          drawCell(boardCtx, activePiece.x + x, activePiece.y + y, activePiece.color);
        }
      });
    });
  }
}

function drawNextPiece() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);

  if (!nextPiece) {
    return;
  }

  const shape = nextPiece.shape;
  const offsetX = Math.floor((nextCanvas.width / PREVIEW_BLOCK_SIZE - shape[0].length) / 2);
  const offsetY = Math.floor((nextCanvas.height / PREVIEW_BLOCK_SIZE - shape.length) / 2);

  shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        drawCell(nextCtx, x + offsetX, y + offsetY, nextPiece.color, PREVIEW_BLOCK_SIZE);
      }
    });
  });
}

function dropIntervalMs() {
  return Math.max(100, 850 - (level - 1) * 70);
}

function updateStats() {
  scoreEl.textContent = String(score);
  linesEl.textContent = String(lines);
  levelEl.textContent = String(level);
}

function resetGame() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  dropAccumulator = 0;
  gameOver = false;
  paused = false;
  lastTime = 0;
  updateStats();
  statusEl.textContent = "Game running";

  nextPiece = randomPiece();
  spawnPiece();
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  animationId = requestAnimationFrame(loop);
}

function loop(time = 0) {
  if (gameOver) {
    drawBoard();
    return;
  }

  if (paused) {
    drawBoard();
    animationId = requestAnimationFrame(loop);
    return;
  }

  const delta = time - lastTime;
  lastTime = time;
  dropAccumulator += delta;

  if (dropAccumulator >= dropIntervalMs()) {
    dropAccumulator = 0;
    softDrop();
  }

  drawBoard();
  animationId = requestAnimationFrame(loop);
}

document.addEventListener("keydown", (event) => {
  if (!activePiece || gameOver) {
    return;
  }

  if (event.key === "p" || event.key === "P") {
    paused = !paused;
    statusEl.textContent = paused ? "Paused" : "Game running";
    return;
  }

  if (paused) {
    return;
  }

  switch (event.key) {
    case "ArrowLeft":
      event.preventDefault();
      move(-1);
      break;
    case "ArrowRight":
      event.preventDefault();
      move(1);
      break;
    case "ArrowDown":
      event.preventDefault();
      softDrop();
      break;
    case "ArrowUp":
      event.preventDefault();
      rotatePiece();
      break;
    case " ":
      event.preventDefault();
      hardDrop();
      break;
    default:
      break;
  }

  drawBoard();
});

startButton.addEventListener("click", resetGame);

drawBoard();
