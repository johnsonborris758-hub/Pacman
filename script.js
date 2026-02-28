const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const livesEl = document.getElementById("lives");
const bestEl = document.getElementById("bestScore");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMessage = document.getElementById("overlayMessage");
const overlayAction = document.getElementById("overlayAction");

const TILE = 28;
const ROWS = 22;
const COLS = 20;

const BASE_MAP = [
  "####################",
  "#........##........#",
  "#.####.#.##.#.####.#",
  "#o####.#.##.#.####o#",
  "#..................#",
  "#.####.######.####.#",
  "#......##..##......#",
  "######.##..##.######",
  "######.#GG##.######.",
  "######.#..##.######.",
  "......P....G........",
  "######.######.######",
  "######.######.######",
  "#........##........#",
  "#.####.#.##.#.####.#",
  "#o..##.#....#.##..o#",
  "###.##.######.##.###",
  "#......##..##......#",
  "#.########..########",
  "#..................#",
  "##################.#",
  "####################",
];

const DIRS = {
  left: { x: -1, y: 0, angle: Math.PI },
  right: { x: 1, y: 0, angle: 0 },
  up: { x: 0, y: -1, angle: -Math.PI / 2 },
  down: { x: 0, y: 1, angle: Math.PI / 2 },
};

const KEY_TO_DIR = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
};

const game = {
  map: [],
  pacman: null,
  ghosts: [],
  score: 0,
  level: 1,
  lives: 3,
  pelletsLeft: 0,
  started: false,
  paused: false,
  gameOver: false,
  powerTimer: 0,
  best: Number(localStorage.getItem("neonPacmanBest") || 0),
};

function cloneMap() {
  return BASE_MAP.map((row) => row.split(""));
}

function initWorld(keepScore = true) {
  game.map = cloneMap();
  game.pelletsLeft = 0;
  game.ghosts = [];

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = game.map[y][x];
      if (cell === "." || cell === "o") {
        game.pelletsLeft += 1;
      } else if (cell === "P") {
        game.pacman = {
          x,
          y,
          px: x * TILE + TILE / 2,
          py: y * TILE + TILE / 2,
          dir: "left",
          wantedDir: "left",
          speed: 4,
          mouthPhase: 0,
        };
        game.map[y][x] = " ";
      } else if (cell === "G") {
        game.ghosts.push({
          x,
          y,
          px: x * TILE + TILE / 2,
          py: y * TILE + TILE / 2,
          dir: "left",
          speed: 2.2,
          color: ["#ff4d6d", "#4df4ff", "#ff9f40", "#c77dff"][game.ghosts.length % 4],
          frightened: false,
          homeX: x,
          homeY: y,
        });
        game.map[y][x] = " ";
      }
    }
  }

  if (!keepScore) {
    game.score = 0;
    game.level = 1;
    game.lives = 3;
  }

  game.powerTimer = 0;
  game.started = false;
  game.paused = false;
  game.gameOver = false;
  updateStats();
}

function updateStats() {
  scoreEl.textContent = game.score;
  levelEl.textContent = game.level;
  livesEl.textContent = game.lives;
  bestEl.textContent = game.best;
}

function isWall(x, y) {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
  return game.map[y][x] === "#";
}

function centerToTile(px, py) {
  return {
    tx: Math.round((px - TILE / 2) / TILE),
    ty: Math.round((py - TILE / 2) / TILE),
  };
}

function canTurn(entity, dir) {
  const { tx, ty } = centerToTile(entity.px, entity.py);
  const d = DIRS[dir];
  return !isWall(tx + d.x, ty + d.y);
}

function alignedToTile(entity) {
  const offsetX = Math.abs(((entity.px - TILE / 2) % TILE + TILE) % TILE);
  const offsetY = Math.abs(((entity.py - TILE / 2) % TILE + TILE) % TILE);
  return offsetX < 3 || offsetX > TILE - 3
    ? offsetY < 3 || offsetY > TILE - 3
    : false;
}

function snapEntity(entity) {
  const tx = Math.round((entity.px - TILE / 2) / TILE);
  const ty = Math.round((entity.py - TILE / 2) / TILE);
  entity.px = tx * TILE + TILE / 2;
  entity.py = ty * TILE + TILE / 2;
  entity.x = tx;
  entity.y = ty;
}

function movePacman() {
  const p = game.pacman;
  if (!p) return;

  if (alignedToTile(p)) {
    snapEntity(p);
    if (canTurn(p, p.wantedDir)) {
      p.dir = p.wantedDir;
    }

    if (!canTurn(p, p.dir)) {
      return;
    }
  }

  const d = DIRS[p.dir];
  p.px += d.x * p.speed;
  p.py += d.y * p.speed;

  if (p.px < -TILE / 2) p.px = COLS * TILE - TILE / 2;
  if (p.px > COLS * TILE - TILE / 2) p.px = -TILE / 2;

  p.mouthPhase = (p.mouthPhase + 0.24) % (Math.PI * 2);

  const { tx, ty } = centerToTile(p.px, p.py);
  p.x = tx;
  p.y = ty;

  if (tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS) {
    const cell = game.map[ty][tx];
    if (cell === ".") {
      game.map[ty][tx] = " ";
      game.score += 10;
      game.pelletsLeft -= 1;
    } else if (cell === "o") {
      game.map[ty][tx] = " ";
      game.score += 50;
      game.pelletsLeft -= 1;
      game.powerTimer = 480;
    }
  }

  if (game.pelletsLeft <= 0) {
    game.level += 1;
    showOverlay("Level Up!", `Welcome to level ${game.level}. Click continue.`);
    initWorld(true);
    return;
  }

  if (game.score > game.best) {
    game.best = game.score;
    localStorage.setItem("neonPacmanBest", String(game.best));
  }
}

function pickGhostDirection(ghost) {
  const options = Object.entries(DIRS)
    .filter(([name, d]) => {
      const reverse =
        (ghost.dir === "left" && name === "right") ||
        (ghost.dir === "right" && name === "left") ||
        (ghost.dir === "up" && name === "down") ||
        (ghost.dir === "down" && name === "up");
      if (reverse) return false;
      return !isWall(ghost.x + d.x, ghost.y + d.y);
    })
    .map(([name]) => name);

  if (!options.length) {
    const back = { left: "right", right: "left", up: "down", down: "up" };
    return back[ghost.dir] || "left";
  }

  const targetX = game.powerTimer > 0 ? ghost.homeX : game.pacman.x;
  const targetY = game.powerTimer > 0 ? ghost.homeY : game.pacman.y;

  options.sort((a, b) => {
    const da = Math.hypot(ghost.x + DIRS[a].x - targetX, ghost.y + DIRS[a].y - targetY);
    const db = Math.hypot(ghost.x + DIRS[b].x - targetX, ghost.y + DIRS[b].y - targetY);
    return da - db;
  });

  if (Math.random() < 0.35) {
    return options[Math.floor(Math.random() * options.length)];
  }

  return options[0];
}

function moveGhosts() {
  for (const ghost of game.ghosts) {
    ghost.frightened = game.powerTimer > 0;
    if (alignedToTile(ghost)) {
      snapEntity(ghost);
      ghost.dir = pickGhostDirection(ghost);
      ghost.speed = ghost.frightened ? 1.7 : 2.2 + game.level * 0.08;
    }

    const d = DIRS[ghost.dir];
    ghost.px += d.x * ghost.speed;
    ghost.py += d.y * ghost.speed;

    if (ghost.px < -TILE / 2) ghost.px = COLS * TILE - TILE / 2;
    if (ghost.px > COLS * TILE - TILE / 2) ghost.px = -TILE / 2;

    const { tx, ty } = centerToTile(ghost.px, ghost.py);
    ghost.x = tx;
    ghost.y = ty;

    const dist = Math.hypot(ghost.px - game.pacman.px, ghost.py - game.pacman.py);
    if (dist < TILE * 0.58) {
      if (ghost.frightened) {
        game.score += 200;
        ghost.px = ghost.homeX * TILE + TILE / 2;
        ghost.py = ghost.homeY * TILE + TILE / 2;
        ghost.x = ghost.homeX;
        ghost.y = ghost.homeY;
        ghost.dir = "left";
      } else {
        game.lives -= 1;
        if (game.lives <= 0) {
          game.gameOver = true;
          showOverlay("Game Over", `Final score: ${game.score}. Hit restart to play again.`);
        } else {
          const level = game.level;
          const score = game.score;
          const lives = game.lives;
          initWorld(true);
          game.level = level;
          game.score = score;
          game.lives = lives;
          showOverlay("Ouch!", `You have ${game.lives} lives left. Click continue.`);
        }
        updateStats();
        return;
      }
    }
  }

  if (game.powerTimer > 0) game.powerTimer -= 1;
}

function drawMap() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#08122f");
  grad.addColorStop(1, "#03060f");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = game.map[y][x];
      const px = x * TILE;
      const py = y * TILE;

      if (cell === "#") {
        ctx.fillStyle = "#0f2f9f";
        ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        ctx.strokeStyle = "rgba(77, 244, 255, 0.4)";
        ctx.strokeRect(px + 4, py + 4, TILE - 8, TILE - 8);
      } else if (cell === ".") {
        ctx.fillStyle = "#e8ecff";
        ctx.beginPath();
        ctx.arc(px + TILE / 2, py + TILE / 2, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (cell === "o") {
        ctx.fillStyle = "#ff7cd6";
        ctx.beginPath();
        ctx.arc(px + TILE / 2, py + TILE / 2, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawPacman() {
  const p = game.pacman;
  const mouth = 0.2 + Math.abs(Math.sin(p.mouthPhase)) * 0.35;

  ctx.fillStyle = "#ffd643";
  ctx.beginPath();
  ctx.moveTo(p.px, p.py);
  ctx.arc(p.px, p.py, TILE * 0.45, DIRS[p.dir].angle + mouth, DIRS[p.dir].angle - mouth + Math.PI * 2);
  ctx.closePath();
  ctx.fill();
}

function drawGhost(ghost) {
  const r = TILE * 0.42;
  const x = ghost.px;
  const y = ghost.py;

  ctx.fillStyle = ghost.frightened ? "#4c6dff" : ghost.color;
  ctx.beginPath();
  ctx.arc(x, y - 1, r, Math.PI, 0);
  ctx.lineTo(x + r, y + r);
  ctx.lineTo(x + r * 0.45, y + r * 0.62);
  ctx.lineTo(x + r * 0.1, y + r);
  ctx.lineTo(x - r * 0.2, y + r * 0.62);
  ctx.lineTo(x - r * 0.55, y + r);
  ctx.lineTo(x - r, y + r * 0.62);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x - 6, y - 2, 4.2, 0, Math.PI * 2);
  ctx.arc(x + 6, y - 2, 4.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = ghost.frightened ? "#d9eeff" : "#111";
  ctx.beginPath();
  ctx.arc(x - 5.2, y - 2, 1.8, 0, Math.PI * 2);
  ctx.arc(x + 5.2, y - 2, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

function render() {
  drawMap();
  drawPacman();
  game.ghosts.forEach(drawGhost);

  if (game.powerTimer > 0) {
    const pct = game.powerTimer / 480;
    ctx.fillStyle = "rgba(77, 244, 255, 0.22)";
    ctx.fillRect(0, canvas.height - 8, canvas.width * pct, 8);
  }
}

function showOverlay(title, message, buttonText = "Continue") {
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  overlayAction.textContent = buttonText;
  overlay.classList.remove("hidden");
  game.paused = true;
}

function hideOverlay() {
  overlay.classList.add("hidden");
  if (!game.gameOver) {
    game.paused = false;
    game.started = true;
  }
}

function tick() {
  if (game.started && !game.paused && !game.gameOver) {
    movePacman();
    moveGhosts();
    updateStats();
  }
  render();
  requestAnimationFrame(tick);
}

function restartGame() {
  initWorld(false);
  showOverlay("Ready?", "Collect every pellet. Power pellets let you eat ghosts.", "Start Game");
}

document.addEventListener("keydown", (e) => {
  if (KEY_TO_DIR[e.code]) {
    game.pacman.wantedDir = KEY_TO_DIR[e.code];
    if (overlay && !overlay.classList.contains("hidden")) {
      hideOverlay();
    }
    e.preventDefault();
  }

  if (e.code === "KeyP") {
    game.paused = !game.paused;
    if (game.paused) {
      showOverlay("Paused", "Take a break. Click continue whenever you're ready.");
    } else {
      hideOverlay();
    }
  }

  if (e.code === "KeyR") {
    restartGame();
  }
});

pauseBtn.addEventListener("click", () => {
  if (!game.paused) {
    showOverlay("Paused", "Take a break. Click continue whenever you're ready.");
  } else {
    hideOverlay();
  }
});

restartBtn.addEventListener("click", restartGame);
overlayAction.addEventListener("click", hideOverlay);

initWorld(false);
showOverlay("Ready?", "Collect every pellet. Power pellets let you eat ghosts.", "Start Game");
requestAnimationFrame(tick);
