/**
 * Tetromino Escape - Game Logic
 * Refactored for modularity, robustness, and performance.
 */

// ==========================================
// 1. CONFIGURATION & CONSTANTS
// ==========================================

// Default constants that don't depend on canvas size
const DEFAULT_CONSTANTS = {
  COLS: 10,
  ROWS: 20,
  GRAVITY: 0.6,
  JUMP_FORCE: -13.5,
  MOVE_SPEED: 4,
  TERMINAL_VELOCITY: 15,
  SPAWN_DELAY: 0.3, // seconds
  LINE_HISTORY_WINDOW: 10,
};

const TETROMINOES = {
  I: { shapes: [[[1, 1, 1, 1]], [[1], [1], [1], [1]]], color: "#00f0f0" },
  O: {
    shapes: [
      [
        [1, 1],
        [1, 1],
      ],
    ],
    color: "#f0f000",
  },
  T: {
    shapes: [
      [
        [0, 1, 0],
        [1, 1, 1],
      ],
      [
        [1, 0],
        [1, 1],
        [1, 0],
      ],
      [
        [1, 1, 1],
        [0, 1, 0],
      ],
      [
        [0, 1],
        [1, 1],
        [0, 1],
      ],
    ],
    color: "#a000f0",
  },
  S: {
    shapes: [
      [
        [0, 1, 1],
        [1, 1, 0],
      ],
      [
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    ],
    color: "#00f000",
  },
  Z: {
    shapes: [
      [
        [1, 1, 0],
        [0, 1, 1],
      ],
      [
        [0, 1],
        [1, 1],
        [1, 0],
      ],
    ],
    color: "#f00000",
  },
  J: {
    shapes: [
      [
        [1, 0, 0],
        [1, 1, 1],
      ],
      [
        [1, 1],
        [1, 0],
        [1, 0],
      ],
      [
        [1, 1, 1],
        [0, 0, 1],
      ],
      [
        [0, 1],
        [0, 1],
        [1, 1],
      ],
    ],
    color: "#0000f0",
  },
  L: {
    shapes: [
      [
        [0, 0, 1],
        [1, 1, 1],
      ],
      [
        [1, 0],
        [1, 0],
        [1, 1],
      ],
      [
        [1, 1, 1],
        [1, 0, 0],
      ],
      [
        [1, 1],
        [0, 1],
        [0, 1],
      ],
    ],
    color: "#f0a000",
  },
};

const DIFFICULTY_SETTINGS = {
  easy: {
    // Line clearing: actively avoid
    lineReward: -100,
    // Holes: tolerate some holes to build terrain
    holePenalty: 10,
    coveredHolePenalty: 15,
    // Height: actually REWARD height to build up debris
    heightPenalty: -1, // Negative = reward
    maxHeightPenalty: -1,
    // Bumpiness: low penalty allows uneven terrain
    bumpinessPenalty: 2,
    // Wells: very high penalty to keep terrain climbable
    wellPenalty: 50,
    // Cliffs: very high penalty
    cliffPenalty: 50,
    minFastDropHeight: 6,
    dangerZoneMargin: 1.5,
    dangerZonePenalty: 10000,
    aiMoveInterval: 300,
    spawnDropDelay: 3,
    maxRetargets: -1,
    playerCompletesLine: false,
    minMovesBeforeFastDrop: 4,
    sabotageDuration: 1.5,
    sabotageCooldown: 3.0,
    baseFallTick: 800,
    lineClearDelay: 800,
  },
  normal: {
    // Line clearing: slight preference to clear, but not aggressive
    lineReward: 20,
    // Holes: moderate penalty
    holePenalty: 40,
    coveredHolePenalty: 15,
    // Height: slight penalty
    heightPenalty: 1,
    maxHeightPenalty: 2,
    // Bumpiness: moderate penalty
    bumpinessPenalty: 4,
    // Wells: high penalty for climbability
    wellPenalty: 35,
    // Cliffs: high penalty
    cliffPenalty: 30,
    minFastDropHeight: 4,
    dangerZoneMargin: 1.0,
    dangerZonePenalty: 8000,
    aiMoveInterval: 115,
    spawnDropDelay: 2,
    maxRetargets: 3,
    playerCompletesLine: false,
    minMovesBeforeFastDrop: 3,
    sabotageDuration: 1.5,
    sabotageCooldown: 5.0,
    baseFallTick: 600,
    lineClearDelay: 600,
  },
  hard: {
    // Line clearing: aggressive clearing
    lineReward: 200,
    multiLineBonus: true,
    // Holes: severe penalty
    holePenalty: 100,
    coveredHolePenalty: 15,
    // Height: penalize to keep stack low
    heightPenalty: 4,
    maxHeightPenalty: 5,
    // Bumpiness: high penalty for flat surface (easier to clear)
    bumpinessPenalty: 10,
    // Wells: moderate penalty (some wells help with Tetrominos)
    wellPenalty: 15,
    // Cliffs: moderate penalty
    cliffPenalty: 20,
    minFastDropHeight: 3,
    dangerZoneMargin: 0.5,
    dangerZonePenalty: 50,
    aiMoveInterval: 50,
    spawnDropDelay: 0,
    maxRetargets: 1,
    playerCompletesLine: true,
    minMovesBeforeFastDrop: 2,
    sabotageDuration: 2.0,
    sabotageCooldown: 8.0,
    baseFallTick: 450,
    lineClearDelay: 400,
  },
};

// ==========================================
// 2. HELPER FUNCTIONS
// ==========================================

function getShape(type, rotation) {
  const shapes = TETROMINOES[type].shapes;
  return shapes[rotation % shapes.length];
}

function getRandomTetrominoType() {
  const types = Object.keys(TETROMINOES);
  return types[Math.floor(Math.random() * types.length)];
}

// ==========================================
// 3. GAME ENGINE
// ==========================================

class GameEngine {
  constructor(config = {}) {
    this.width = config.width || 350;
    this.height = config.height || 700;
    this.onGameOver = config.onGameOver || (() => {});
    this.onGameWin = config.onGameWin || (() => {});
    this.onLineCleared = config.onLineCleared || (() => {});

    // Calculate derived constants
    this.constants = { ...DEFAULT_CONSTANTS };
    this.constants.CELL_SIZE = this.height / this.constants.ROWS;
    this.constants.PLAYER_WIDTH = this.constants.CELL_SIZE * 0.7;
    this.constants.PLAYER_HEIGHT = this.constants.CELL_SIZE * 1.5;

    // Simulation flags
    this.godMode = config.godMode || false;

    this.reset();
  }

  reset() {
    // Current game status: 'start', 'playing', 'paused', 'gameover', 'win'
    this.status = "start";

    // The 20x10 grid storing locked blocks (colors) or null
    this.grid = Array(this.constants.ROWS)
      .fill()
      .map(() => Array(this.constants.COLS).fill(null));

    this.player = null;
    this.currentPiece = null;

    // Flag to prevent multiple spawns during delay
    this.waitingForPiece = false;

    // Timers for various game events (in milliseconds or seconds as noted)
    this.timers = {
      pieceFall: 0, // Accumulator for gravity interval
      aiMove: 0, // Accumulator for AI movement
      spawn: 0, // Countdown for spawning next piece
      sabotage: 0, // Duration remaining for sabotage effect
      sabotageCooldown: 0, // Cooldown remaining before next sabotage
      playerLineClear: 0, // Timer for player completing a line
    };

    // Statistics for the current session
    this.stats = {
      time: 0,
      linesCleared: 0,
      pieceCount: 0,
      recentLines: [], // Track recent clears for difficulty adjustment if needed
    };

    // AI State
    this.ai = {
      moveCount: 0, // Number of moves made for current piece
      target: null, // Calculated target position {x, rotation}
      path: [], // Path of moves to reach target
      state: "targeting", // 'targeting' or 'erratic'
      erraticDir: 1, // Direction for erratic movement
    };

    this.sabotageQueued = false;

    // Game Settings - Preserve existing settings if available, otherwise default
    if (!this.settings) {
      this.settings = {
        difficulty: "normal",
        speed: 1.0,
        diffConfig: DIFFICULTY_SETTINGS.normal,
      };
    }

    // Visual effects (managed by engine but rendered by UI)
    this.particles = [];

    // Input state
    this.input = { keys: {} };
  }

  initPlayer() {
    this.player = {
      x: this.width / 2 - this.constants.PLAYER_WIDTH / 2,
      y: this.height - this.constants.PLAYER_HEIGHT - 5,
      vx: 0,
      vy: 0,
      onGround: true,
      facingRight: true,
      dead: false,
    };
  }

  start() {
    this.reset();
    this.initPlayer();
    this.status = "playing";
    this.waitingForPiece = true;
    this.timers.spawn = 0.5;
  }

  update(dt, inputState) {
    if (this.status !== "playing") return;

    this.input = inputState || { keys: {} };
    this.stats.time += dt;

    // Update timers
    if (this.timers.sabotageCooldown > 0) {
      this.timers.sabotageCooldown -= dt * 1000;
    }
    if (this.timers.sabotage > 0) {
      this.timers.sabotage -= dt * 1000 * this.settings.speed;
      if (this.timers.sabotage <= 0) {
        this.ai.state = "targeting";
      }
    }

    this.updatePlayer(dt);
    this.updatePlayerLineClear(dt);
    this.updatePiece(dt);
    this.updateParticles(dt);
  }

  updatePlayerLineClear(dt) {
    if (!this.settings.diffConfig.playerCompletesLine || !this.player || this.player.dead) return;

    if (this.checkPlayerCompletesLine()) {
      if (this.timers.playerLineClear <= 0) this.timers.playerLineClear = this.settings.diffConfig.lineClearDelay;

      this.timers.playerLineClear -= dt * 1000;
      if (this.timers.playerLineClear <= 0) {
        this.executePlayerLineClear();
      }
    } else {
      this.timers.playerLineClear = 0;
    }
  }

  getPlayerCompletingCells() {
    if (!this.player) return [];
    const pLeft = Math.floor(this.player.x / this.constants.CELL_SIZE);
    const pRight = Math.floor((this.player.x + this.constants.PLAYER_WIDTH - 1) / this.constants.CELL_SIZE);
    const pTop = Math.floor(this.player.y / this.constants.CELL_SIZE);
    const pBottom = Math.floor((this.player.y + this.constants.PLAYER_HEIGHT - 1) / this.constants.CELL_SIZE);

    let completingCells = [];

    for (let y = pTop; y <= pBottom; y++) {
      if (y < 0 || y >= this.constants.ROWS) continue;

      let emptyCount = 0;
      let emptyX = -1;
      for (let x = 0; x < this.constants.COLS; x++) {
        if (this.grid[y][x] === null) {
          emptyCount++;
          emptyX = x;
        }
      }

      if (emptyCount === 1) {
        if (emptyX >= pLeft && emptyX <= pRight) {
          completingCells.push({ x: emptyX, y: y });
        }
      }
    }
    return completingCells;
  }

  updatePlayer(dt) {
    const player = this.player;
    if (!player || player.dead) return;

    // Horizontal Movement
    let moveX = 0;
    if (this.input.keys["ArrowLeft"] || this.input.keys["KeyA"]) {
      moveX = -this.constants.MOVE_SPEED;
      player.facingRight = false;
    } else if (this.input.keys["ArrowRight"] || this.input.keys["KeyD"]) {
      moveX = this.constants.MOVE_SPEED;
      player.facingRight = true;
    }

    if (moveX !== 0) {
      let newX = player.x + moveX;
      newX = Math.max(0, Math.min(this.width - this.constants.PLAYER_WIDTH, newX));

      const currentlyStuckInPiece =
        this.checkPieceCollisionOnly(player.x, player.y, this.constants.PLAYER_WIDTH, this.constants.PLAYER_HEIGHT) &&
        !this.checkGridCollisionOnly(player.x, player.y, this.constants.PLAYER_WIDTH, this.constants.PLAYER_HEIGHT);

      if (currentlyStuckInPiece) {
        if (!this.checkGridCollisionOnly(newX, player.y, this.constants.PLAYER_WIDTH, this.constants.PLAYER_HEIGHT)) {
          player.x = newX;
        }
      } else {
        if (!this.checkCollision(newX, player.y, this.constants.PLAYER_WIDTH, this.constants.PLAYER_HEIGHT)) {
          player.x = newX;
        }
      }
    }

    // Vertical Movement
    player.onGround = this.isOnGround();
    if ((this.input.keys["ArrowUp"] || this.input.keys["KeyW"] || this.input.keys["Space"]) && player.onGround) {
      player.vy = this.constants.JUMP_FORCE;
      player.onGround = false;
    }

    player.vy += this.constants.GRAVITY;
    player.vy = Math.min(player.vy, this.constants.TERMINAL_VELOCITY);

    let newY = player.y + player.vy;

    // Floor check
    if (newY + this.constants.PLAYER_HEIGHT > this.height) {
      newY = this.height - this.constants.PLAYER_HEIGHT;
      player.vy = 0;
    }

    // Collision check
    if (player.vy > 0) {
      // Falling
      if (this.checkCollision(player.x, newY, this.constants.PLAYER_WIDTH, this.constants.PLAYER_HEIGHT)) {
        // Land on top
        while (
          player.y < newY &&
          !this.checkCollision(player.x, player.y + 1, this.constants.PLAYER_WIDTH, this.constants.PLAYER_HEIGHT)
        ) {
          player.y++;
        }
        player.vy = 0;
        newY = player.y;
      }
    } else if (player.vy < 0) {
      // Rising
      if (this.checkCollision(player.x, newY, this.constants.PLAYER_WIDTH, this.constants.PLAYER_HEIGHT)) {
        player.vy = 0;
        newY = player.y;
      }
    }

    player.y = newY;

    // Win check: if player is fully above the escape line (bottom of row 1)
    if (player.y + this.constants.PLAYER_HEIGHT <= this.constants.CELL_SIZE * 2) {
      this.gameWin();
    }
  }

  isOnGround() {
    const player = this.player;
    if (!player) return false;
    if (player.y + this.constants.PLAYER_HEIGHT >= this.height - 1) return true;
    return this.checkCollision(
      player.x + 2,
      player.y + this.constants.PLAYER_HEIGHT + 1,
      this.constants.PLAYER_WIDTH - 4,
      1
    );
  }

  spawnPiece() {
    const type = getRandomTetrominoType();
    const tetro = TETROMINOES[type];
    const rotation = 0;
    const shape = tetro.shapes[rotation];
    const startX = Math.floor((this.constants.COLS - shape[0].length) / 2);

    this.currentPiece = {
      type: type,
      rotation: rotation,
      shape: shape,
      color: tetro.color,
      x: startX,
      y: 0,
      fallStepCount: 0,
    };

    this.ai.moveCount = 0;
    this.ai.retargetCount = 0;

    if (!this.canPlacePiece(this.currentPiece, 0, 0)) {
      this.gameOver("The playing field filled up!");
      return;
    }

    this.calculateAITarget(null, this.isPlayerInDangerZone());

    if (this.sabotageQueued) {
      this.sabotageQueued = false;
      this.applySabotageToCurrent();
    }
  }

  updatePiece(dt) {
    if (this.status !== "playing") return;

    if (this.waitingForPiece) {
      this.timers.spawn -= dt;
      if (this.timers.spawn <= 0) {
        this.waitingForPiece = false;
        if (!this.currentPiece) this.spawnPiece();
      }
      return;
    }

    if (!this.currentPiece) return;

    const scaledDt = dt * this.settings.speed;

    this.timers.aiMove += scaledDt * 1000;
    if (this.timers.aiMove >= this.settings.diffConfig.aiMoveInterval) {
      this.timers.aiMove = 0;
      this.aiMove();
    }

    this.timers.pieceFall += scaledDt * 1000;
    if (this.timers.pieceFall >= this.settings.diffConfig.baseFallTick) {
      // If player is in danger zone, try to move away
      if (this.isPlayerInDangerZone()) {
        const maxRetargets = this.settings.diffConfig.maxRetargets;
        if (maxRetargets === -1 || this.ai.retargetCount < maxRetargets) {
          this.calculateAITarget(null, true);
          this.ai.retargetCount++;
        }
      }

      this.timers.pieceFall = 0;
      if (this.canPlacePiece(this.currentPiece, 0, 1)) {
        this.currentPiece.y++;
        this.currentPiece.fallStepCount++;
        if (this.checkPieceSquishesPlayer()) {
          this.gameOver("You got squished by a falling block!");
        }
      } else {
        this.lockPiece();
      }
    }
  }

  lockPiece() {
    if (!this.currentPiece) return;

    if (this.checkPieceSquishesPlayer()) {
      this.gameOver("You got squished by a falling block!");
      return;
    }

    const piece = this.currentPiece;
    for (let py = 0; py < piece.shape.length; py++) {
      for (let px = 0; px < piece.shape[py].length; px++) {
        if (piece.shape[py][px]) {
          const gridY = piece.y + py;
          const gridX = piece.x + px;
          if (gridY >= 0 && gridY < this.constants.ROWS && gridX >= 0 && gridX < this.constants.COLS) {
            this.grid[gridY][gridX] = piece.color;
          }
        }
      }
    }

    this.stats.pieceCount++;
    this.currentPiece = null;
    this.timers.sabotage = 0;

    this.checkLines();

    this.waitingForPiece = true;
    this.timers.spawn = this.constants.SPAWN_DELAY;
  }

  canPlacePiece(piece, offsetX, offsetY, testShape = null) {
    const shape = testShape || piece.shape;
    for (let py = 0; py < shape.length; py++) {
      for (let px = 0; px < shape[py].length; px++) {
        if (shape[py][px]) {
          const newX = piece.x + px + offsetX;
          const newY = piece.y + py + offsetY;
          if (newX < 0 || newX >= this.constants.COLS) return false;
          if (newY >= this.constants.ROWS) return false;
          if (newY >= 0 && this.grid[newY] && this.grid[newY][newX]) return false;
        }
      }
    }
    return true;
  }

  checkPlayerCompletesLine() {
    if (!this.player) return false;

    const pLeft = Math.floor(this.player.x / this.constants.CELL_SIZE);
    const pRight = Math.floor((this.player.x + this.constants.PLAYER_WIDTH - 1) / this.constants.CELL_SIZE);
    const pTop = Math.floor(this.player.y / this.constants.CELL_SIZE);
    const pBottom = Math.floor((this.player.y + this.constants.PLAYER_HEIGHT - 1) / this.constants.CELL_SIZE);

    for (let y = pTop; y <= pBottom; y++) {
      if (y < 0 || y >= this.constants.ROWS) continue;

      let emptyCount = 0;
      let emptyX = -1;

      for (let x = 0; x < this.constants.COLS; x++) {
        if (this.grid[y][x] === null) {
          emptyCount++;
          emptyX = x;
        }
      }

      if (emptyCount === 1) {
        if (emptyX >= pLeft && emptyX <= pRight) {
          return true;
        }
      }
    }
    return false;
  }

  executePlayerLineClear() {
    if (!this.player) return;

    const pLeft = Math.floor(this.player.x / this.constants.CELL_SIZE);
    const pRight = Math.floor((this.player.x + this.constants.PLAYER_WIDTH - 1) / this.constants.CELL_SIZE);
    const pTop = Math.floor(this.player.y / this.constants.CELL_SIZE);
    const pBottom = Math.floor((this.player.y + this.constants.PLAYER_HEIGHT - 1) / this.constants.CELL_SIZE);

    let linesToClear = [];
    for (let y = 0; y < this.constants.ROWS; y++) {
      let emptyCount = 0;
      let emptyX = -1;

      for (let x = 0; x < this.constants.COLS; x++) {
        if (this.grid[y][x] === null) {
          emptyCount++;
          emptyX = x;
        }
      }

      if (emptyCount === 1) {
        // Check if player covers this gap
        if (y >= pTop && y <= pBottom && emptyX >= pLeft && emptyX <= pRight) {
          linesToClear.push(y);
        }
      }
    }

    if (linesToClear.length === 0) return;

    // Create particles for the lines
    for (let lineY of linesToClear) {
      for (let x = 0; x < this.constants.COLS; x++) {
        const color = this.grid[lineY][x] || "#4ecca3"; // Use player color for player cells
        this.createParticles(
          x * this.constants.CELL_SIZE + this.constants.CELL_SIZE / 2,
          lineY * this.constants.CELL_SIZE + this.constants.CELL_SIZE / 2,
          color
        );
      }
    }

    // Create extra particles for player death
    this.createParticles(
      this.player.x + this.constants.PLAYER_WIDTH / 2,
      this.player.y + this.constants.PLAYER_HEIGHT / 2,
      "#4ecca3"
    );
    this.createParticles(
      this.player.x + this.constants.PLAYER_WIDTH / 2,
      this.player.y + this.constants.PLAYER_HEIGHT / 2,
      "#ffd93d"
    );

    // Remove lines
    linesToClear.sort((a, b) => a - b);
    let newGrid = this.grid.filter((_, index) => !linesToClear.includes(index));
    while (newGrid.length < this.constants.ROWS) {
      newGrid.unshift(Array(this.constants.COLS).fill(null));
    }
    this.grid = newGrid;

    this.player.dead = true;
    this.player.killedByLine = true;

    // Delay game over slightly to show particles
    setTimeout(() => {
      this.gameOver("You got cleared with the line!");
    }, 500);
  }
  checkLines() {
    let linesToClear = [];

    // Standard line check (player not involved here, handled by updatePlayerLineClear)
    for (let y = 0; y < this.constants.ROWS; y++) {
      if (this.grid[y].every((cell) => cell !== null)) {
        linesToClear.push(y);
      }
    }

    if (linesToClear.length === 0) return;

    // Particles (just data generation)
    for (let lineY of linesToClear) {
      for (let x = 0; x < this.constants.COLS; x++) {
        this.createParticles(
          x * this.constants.CELL_SIZE + this.constants.CELL_SIZE / 2,
          lineY * this.constants.CELL_SIZE + this.constants.CELL_SIZE / 2,
          this.grid[lineY][x]
        );
      }
    }

    linesToClear.sort((a, b) => a - b);
    let newGrid = this.grid.filter((_, index) => !linesToClear.includes(index));
    while (newGrid.length < this.constants.ROWS) {
      newGrid.unshift(Array(this.constants.COLS).fill(null));
    }
    this.grid = newGrid;

    const count = linesToClear.length;
    this.stats.linesCleared += count;
    this.onLineCleared(count);

    if (count > 0) {
      this.stats.recentLines.push({ piece: this.stats.pieceCount, count });
      const cutoff = this.stats.pieceCount - this.constants.LINE_HISTORY_WINDOW;
      this.stats.recentLines = this.stats.recentLines.filter((e) => e.piece > cutoff);
    }
  }

  createParticles(x, y, color) {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 1,
        color: color,
      });
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= dt * 2;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  isPlayerInDangerZone(piece = this.currentPiece) {
    if (!piece || !this.player) return false;

    const pieceLeft = piece.x * this.constants.CELL_SIZE;
    const pieceRight = (piece.x + piece.shape[0].length) * this.constants.CELL_SIZE;

    const margin = this.settings.diffConfig.dangerZoneMargin * this.constants.CELL_SIZE;
    const playerLeft = this.player.x - margin;
    const playerRight = this.player.x + this.constants.PLAYER_WIDTH + margin;

    // Check horizontal overlap
    return pieceLeft < playerRight && pieceRight > playerLeft;
  }

  checkCollision(px, py, pw, ph) {
    if (this.checkGridCollisionOnly(px, py, pw, ph)) return true;
    if (this.checkPieceCollisionOnly(px, py, pw, ph)) return true;
    return false;
  }

  checkPieceCollisionOnly(px, py, pw, ph) {
    if (this.currentPiece) {
      const piece = this.currentPiece;
      for (let y = 0; y < piece.shape.length; y++) {
        for (let x = 0; x < piece.shape[y].length; x++) {
          if (piece.shape[y][x]) {
            const bx = (piece.x + x) * this.constants.CELL_SIZE;
            const by = (piece.y + y) * this.constants.CELL_SIZE;
            if (
              px < bx + this.constants.CELL_SIZE &&
              px + pw > bx &&
              py < by + this.constants.CELL_SIZE &&
              py + ph > by
            ) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  checkPieceSquishesPlayer() {
    if (!this.currentPiece || !this.player) return false;

    const piece = this.currentPiece;
    let overlap = false;
    let lowestBlockBottom = 0;

    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const bx = (piece.x + x) * this.constants.CELL_SIZE;
          const by = (piece.y + y) * this.constants.CELL_SIZE;
          const bw = this.constants.CELL_SIZE;
          const bh = this.constants.CELL_SIZE;

          const p = this.player;
          if (
            p.x < bx + bw &&
            p.x + this.constants.PLAYER_WIDTH > bx &&
            p.y < by + bh &&
            p.y + this.constants.PLAYER_HEIGHT > by
          ) {
            overlap = true;
            lowestBlockBottom = Math.max(lowestBlockBottom, by + bh);
          }
        }
      }
    }

    if (!overlap) return false;

    const pushY = lowestBlockBottom;
    if (pushY + this.constants.PLAYER_HEIGHT <= this.height) {
      const gridCollision = this.checkGridCollisionOnly(
        this.player.x,
        pushY,
        this.constants.PLAYER_WIDTH,
        this.constants.PLAYER_HEIGHT
      );

      if (!gridCollision) {
        this.player.y = pushY;
        this.player.vy = Math.max(this.player.vy, 2);
        return false;
      }
    }

    return true;
  }

  checkGridCollisionOnly(px, py, pw, ph) {
    const left = Math.floor(px / this.constants.CELL_SIZE);
    const right = Math.floor((px + pw - 1) / this.constants.CELL_SIZE);
    const top = Math.floor(py / this.constants.CELL_SIZE);
    const bottom = Math.floor((py + ph - 1) / this.constants.CELL_SIZE);

    for (let y = Math.max(0, top); y <= Math.min(this.constants.ROWS - 1, bottom); y++) {
      for (let x = Math.max(0, left); x <= Math.min(this.constants.COLS - 1, right); x++) {
        if (this.grid[y] && this.grid[y][x]) return true;
      }
    }
    return false;
  }

  getDropDistance() {
    if (!this.currentPiece) return 0;
    let dist = 0;
    let test = { ...this.currentPiece };
    while (this.canPlacePiece(test, 0, 1)) {
      test.y++;
      dist++;
    }
    return dist;
  }

  applySabotageToCurrent() {
    this.timers.sabotage = this.settings.diffConfig.sabotageDuration * 1000;
    this.calculateAITarget(DIFFICULTY_SETTINGS.easy);

    let dropDist = this.getDropDistance();
    if (dropDist > 8) {
      this.ai.state = "erratic";
      this.ai.erraticDir = Math.random() > 0.5 ? 1 : -1;
    } else {
      this.ai.state = "targeting";
    }
  }

  performErraticMove() {
    const piece = this.currentPiece;
    if (Math.random() < 0.1) this.ai.erraticDir *= -1;

    if (this.canPlacePiece(piece, this.ai.erraticDir, 0)) {
      piece.x += this.ai.erraticDir;
    } else {
      this.ai.erraticDir *= -1;
    }

    if (Math.random() < 0.05) {
      const newRot = (piece.rotation + 1) % TETROMINOES[piece.type].shapes.length;
      const newShape = getShape(piece.type, newRot);
      if (this.canPlacePiece(piece, 0, 0, newShape)) {
        piece.rotation = newRot;
        piece.shape = newShape;
      }
    }
  }

  calculateAITarget(overrideConfig = null, avoidPlayer = false) {
    if (!this.currentPiece) {
      this.ai.target = null;
      this.ai.path = [];
      return;
    }

    let bestScore = -Infinity;
    let bestState = null;
    const diffConfig = overrideConfig || this.settings.diffConfig;
    const shapes = TETROMINOES[this.currentPiece.type].shapes;

    // Calculate board urgency (Panic Mode)
    let currentMaxHeight = 0;
    for (let y = 0; y < this.constants.ROWS; y++) {
      if (this.grid[y].some((c) => c !== null)) {
        currentMaxHeight = this.constants.ROWS - y;
        break;
      }
    }

    // Avoidance parameters
    let playerGridLeft = -1;
    let playerGridRight = -1;
    let avoidancePenalty = diffConfig.dangerZonePenalty !== undefined ? diffConfig.dangerZonePenalty : 10000;

    if (avoidPlayer && this.player) {
      const margin = diffConfig.dangerZoneMargin;
      playerGridLeft = Math.floor(this.player.x / this.constants.CELL_SIZE - margin);
      playerGridRight = Math.ceil((this.player.x + this.constants.PLAYER_WIDTH) / this.constants.CELL_SIZE + margin);

      // Linearly reduce avoidance penalty as board fills up ("Panic Mode")
      avoidancePenalty = Math.max(0, avoidancePenalty - currentMaxHeight * (avoidancePenalty / 20));
    }

    // BFS State: { x, y, rotation }
    const startState = {
      x: this.currentPiece.x,
      y: this.currentPiece.y,
      rotation: this.currentPiece.rotation,
    };
    const startKey = `${startState.x},${startState.y},${startState.rotation}`;

    const queue = [startState];
    const visited = new Set([startKey]);
    const parents = new Map(); // key -> { parentKey, action }

    let iterations = 0;
    const MAX_ITERATIONS = 4000; // Safety limit

    while (queue.length > 0 && iterations < MAX_ITERATIONS) {
      iterations++;
      const current = queue.shift();
      const currentKey = `${current.x},${current.y},${current.rotation}`;
      const shape = shapes[current.rotation];

      // Check if resting spot (cannot move down)
      const tempPiece = {
        x: current.x,
        y: current.y,
        shape: shape,
        type: this.currentPiece.type,
      };

      const canMoveDown = this.canPlacePiece(tempPiece, 0, 1);

      if (!canMoveDown) {
        // Evaluate resting spot
        let penalty = 0;
        if (avoidPlayer) {
          const width = shape[0].length;
          const pieceRight = current.x + width;
          if (current.x < playerGridRight && pieceRight > playerGridLeft) {
            penalty = avoidancePenalty;
          }
        }

        const score = this.evaluatePosition(tempPiece, shape, diffConfig) - penalty;
        if (score > bestScore) {
          bestScore = score;
          bestState = current;
        }
      }

      // Generate neighbors
      // Prioritize horizontal/rotation moves to encourage early alignment
      const neighbors = [
        { action: "left", dx: -1, dy: 0, drot: 0 },
        { action: "right", dx: 1, dy: 0, drot: 0 },
        { action: "rotate", dx: 0, dy: 0, drot: 1 },
        { action: "down", dx: 0, dy: 1, drot: 0 },
      ];

      for (const n of neighbors) {
        const nextRot = (current.rotation + n.drot) % shapes.length;
        const nextX = current.x + n.dx;
        const nextY = current.y + n.dy;

        const nextKey = `${nextX},${nextY},${nextRot}`;
        if (visited.has(nextKey)) continue;

        const nextShape = shapes[nextRot];

        // Check Danger Zone Traversal
        // If we are moving horizontally or rotating near the player, forbid it if avoidPlayer is on.
        // We allow vertical movement (falling) through the zone (if it's not a direct hit, which evaluatePosition handles),
        // but we want to prevent "sliding" into/through the player at the bottom.
        if (avoidPlayer && (n.action === "left" || n.action === "right" || n.action === "rotate")) {
          // Calculate piece bounds
          const width = nextShape[0].length;
          const pieceLeft = nextX;
          const pieceRight = nextX + width;

          // If the piece is low enough to be a threat
          // Player height is ~1.5 cells. Let's say bottom 4 rows are "danger zone" for sliding.
          // Or better: relative to player Y.
          const playerYGrid = Math.floor(this.player.y / this.constants.CELL_SIZE);
          const pieceBottomGrid = nextY + nextShape.length;

          // If piece is near player vertical level (e.g. within 3 rows above player)
          if (pieceBottomGrid >= playerYGrid - 2) {
            // Check horizontal overlap with expanded danger zone
            const nextInDanger = pieceLeft < playerGridRight && pieceRight > playerGridLeft;

            if (nextInDanger) {
              // Check if we are ALREADY in the danger zone.
              // If we are, we must allow movement so we can escape!
              // If we are NOT, we forbid entering it.
              const curWidth = shape[0].length;
              const curLeft = current.x;
              const curRight = current.x + curWidth;
              const curInDanger = curLeft < playerGridRight && curRight > playerGridLeft;

              if (!curInDanger) {
                // We are trying to move/rotate INTO the danger zone from outside.
                // Treat this as blocked.
                continue;
              }
            }
          }
        }

        let valid = false;
        if (n.action === "rotate") {
          if (
            this.canPlacePiece(
              { x: current.x, y: current.y, shape: shape, type: this.currentPiece.type },
              0,
              0,
              nextShape
            )
          ) {
            valid = true;
          }
        } else {
          // Move
          if (
            this.canPlacePiece({ x: current.x, y: current.y, shape: shape, type: this.currentPiece.type }, n.dx, n.dy)
          ) {
            valid = true;
          }
        }

        if (valid) {
          visited.add(nextKey);
          parents.set(nextKey, { parentKey: currentKey, action: n.action });
          queue.push({ x: nextX, y: nextY, rotation: nextRot });
        }
      }
    }

    this.ai.target = bestState;

    // Reconstruct path of states
    this.ai.path = [];
    if (bestState) {
      let currKey = `${bestState.x},${bestState.y},${bestState.rotation}`;
      // Add the final state
      this.ai.path.unshift({ x: bestState.x, y: bestState.y, rotation: bestState.rotation });

      while (currKey !== startKey) {
        const info = parents.get(currKey);
        if (!info) break;

        // Parse parent key to get state
        const [px, py, prot] = info.parentKey.split(",").map(Number);
        this.ai.path.unshift({ x: px, y: py, rotation: prot });

        currKey = info.parentKey;
      }
      // Remove the start state from path, as we are already there
      if (this.ai.path.length > 0) {
        this.ai.path.shift();
      }
    }
  }

  evaluatePosition(piece, shape, diffConfig) {
    let tempGrid = this.grid.map((row) => [...row]);

    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          const gy = piece.y + y;
          const gx = piece.x + x;
          if (gy >= 0 && gy < this.constants.ROWS) tempGrid[gy][gx] = true;
        }
      }
    }

    let score = 0;
    const diff = diffConfig;

    let completedLines = 0;
    for (let y = 0; y < this.constants.ROWS; y++) {
      if (tempGrid[y].every((c) => c)) completedLines++;
    }
    score += completedLines * diff.lineReward;
    if (completedLines > 0 && diff.multiLineBonus) {
      if (completedLines >= 4) score += 150;
      else if (completedLines >= 2) score += 50;
    }

    let gridAfter = tempGrid.filter((row) => !row.every((c) => c));
    while (gridAfter.length < this.constants.ROWS) gridAfter.unshift(Array(this.constants.COLS).fill(null));

    const heights = [];
    for (let x = 0; x < this.constants.COLS; x++) {
      let h = 0;
      for (let y = 0; y < this.constants.ROWS; y++) {
        if (gridAfter[y][x]) {
          h = this.constants.ROWS - y;
          break;
        }
      }
      heights.push(h);
    }

    let holes = 0,
      coveredHoles = 0;
    for (let x = 0; x < this.constants.COLS; x++) {
      let blockFound = false;
      let blocksAbove = 0;
      for (let y = 0; y < this.constants.ROWS; y++) {
        if (gridAfter[y][x]) {
          blockFound = true;
          blocksAbove++;
        } else if (blockFound) {
          holes++;
          coveredHoles += blocksAbove;
        }
      }
    }

    let bumpiness = 0;
    for (let x = 0; x < this.constants.COLS - 1; x++) bumpiness += Math.abs(heights[x] - heights[x + 1]);

    let wells = 0;
    for (let x = 0; x < this.constants.COLS; x++) {
      const lh = x > 0 ? heights[x - 1] : 99;
      const rh = x < this.constants.COLS - 1 ? heights[x + 1] : 99;
      const depth = Math.min(lh, rh) - heights[x];
      if (depth > 2) {
        // Quadratic penalty for deep wells to prevent player traps
        wells += (depth - 2) * (depth - 2);

        // CATASTROPHIC penalty for inescapable wells (depth >= 4)
        // Must be significantly higher than max avoidance penalty (10000)
        // 500 * 20 (min wellPenalty) = 10,000.
        // 500 * 35 (normal) = 17,500.
        if (depth >= 4) {
          wells += 500 + (depth - 4) * 100;
        }
      }
    }

    let cliffs = 0;
    for (let x = 0; x < this.constants.COLS - 1; x++) {
      const d = Math.abs(heights[x] - heights[x + 1]);
      if (d > 2) {
        cliffs += d - 2;
        // Catastrophic penalty for cliffs >= 4 (unjumpable walls)
        if (d >= 4) {
          cliffs += 500 + (d - 4) * 100;
        }
      }
    }

    score -= holes * diff.holePenalty;
    score -= coveredHoles * diff.coveredHolePenalty;
    score -= heights.reduce((a, b) => a + b, 0) * diff.heightPenalty;
    score -= Math.max(...heights) * diff.maxHeightPenalty;

    // Catastrophic penalty for reaching the top (Game Over risk)
    const maxBoardHeight = Math.max(...heights);
    if (maxBoardHeight >= this.constants.ROWS - 2) {
      score -= 100000;
    } else if (maxBoardHeight >= this.constants.ROWS - 4) {
      score -= 20000;
    }

    score -= bumpiness * diff.bumpinessPenalty;
    score -= wells * diff.wellPenalty;
    score -= cliffs * diff.cliffPenalty;

    const minEdge = Math.min(heights[0], heights[this.constants.COLS - 1]);
    score += (10 - minEdge) * 3;

    const pieceBottom = piece.y + piece.shape.length;
    if (pieceBottom < 4) score -= (4 - pieceBottom) * 30;

    return score;
  }

  aiMove() {
    if (!this.currentPiece) return;
    this.ai.moveCount++;

    if (this.timers.sabotage > 0 && this.ai.state === "erratic") {
      this.performErraticMove();
      if (this.getDropDistance() < 6) {
        this.ai.state = "targeting";
      }
      return;
    }

    // Use path if available
    if (this.ai.path && this.ai.path.length > 0) {
      const piece = this.currentPiece;

      // Check for Fast Drop opportunity
      // If all remaining steps are just vertical drops (same X, same Rotation)
      // And we meet the difficulty criteria for fast drop
      let canFastDrop = true;
      for (const step of this.ai.path) {
        if (step.x !== piece.x || step.rotation !== piece.rotation) {
          canFastDrop = false;
          break;
        }
      }

      if (canFastDrop && this.ai.moveCount >= this.settings.diffConfig.minMovesBeforeFastDrop) {
        if (piece.fallStepCount >= this.settings.diffConfig.spawnDropDelay) {
          // Execute fast drop to the last valid position in path
          // We can just jump to the last state in path
          const lastState = this.ai.path[this.ai.path.length - 1];

          // Verify we can actually place it there (just in case gravity/collision changed things)
          // But since it's a vertical drop, we can just use the standard drop logic
          let dropDist = 0;
          let testY = piece.y;
          const testPiece = { ...piece };
          while (this.canPlacePiece(testPiece, 0, 1)) {
            testPiece.y++;
            dropDist++;
          }

          // Only drop if it matches our target Y (or is deeper/valid)
          // Actually, if we are just dropping, we should drop as far as possible
          if (dropDist >= this.settings.diffConfig.minFastDropHeight && !this.isPlayerInDangerZone()) {
            piece.y = testPiece.y;
            this.ai.path = []; // Path completed
            return;
          }
        }
      }

      // Normal Path Following
      const nextState = this.ai.path[0];

      // 1. Check if we missed the path (fell too far)
      if (piece.y > nextState.y) {
        // We fell past the target Y. Recalculate.
        // CRITICAL: Must respect danger zone when recalculating!
        this.calculateAITarget(null, this.isPlayerInDangerZone());
        return;
      }

      // 2. Check if we need to wait for gravity
      if (piece.y < nextState.y) {
        // Next step is down. Wait for gravity.
        return;
      }

      // 3. We are at the correct Y (piece.y == nextState.y)
      // Execute the move (Rotation or Horizontal)
      let success = false;

      if (piece.rotation !== nextState.rotation) {
        // Rotate
        // Determine direction (BFS explores +1 rotation)
        // But we might have wrapped around.
        // Since BFS uses (rot + 1) % 4, we just try that.
        const newRot = nextState.rotation;
        const newShape = getShape(piece.type, newRot);
        if (this.canPlacePiece(piece, 0, 0, newShape)) {
          piece.rotation = newRot;
          piece.shape = newShape;
          success = true;
        }
      } else if (piece.x !== nextState.x) {
        // Move Horizontal
        const dx = nextState.x - piece.x;
        // BFS moves 1 step at a time. dx should be -1 or 1.
        if (Math.abs(dx) === 1) {
          if (this.canPlacePiece(piece, dx, 0)) {
            piece.x += dx;
            success = true;
          }
        } else {
          // Should not happen if path is continuous
          // But if it does, try to move 1 step towards target
          const stepX = Math.sign(dx);
          if (this.canPlacePiece(piece, stepX, 0)) {
            piece.x += stepX;
            success = true;
            // Don't remove node yet if we haven't reached it?
            // Actually, if path is continuous, dx is 1.
            // If dx > 1, we missed some steps or path is sparse.
            // BFS path is dense. So this block is just safety.
          }
        }
      } else {
        // piece.x == nextState.x && piece.rotation == nextState.rotation && piece.y == nextState.y
        // We are already at the state.
        success = true;
      }

      if (success) {
        this.ai.path.shift();
      } else {
        // Move failed (blocked?). Recalculate.
        this.calculateAITarget(null, this.isPlayerInDangerZone());
      }
    }
  }
  gameOver(reason) {
    if (this.status !== "playing") return;

    if (this.godMode) {
      // In God Mode, we just reset the player or ignore the death
      // For debris testing, we probably want to ignore squishing
      // But if the field fills up, we must end.
      if (reason === "The playing field filled up!") {
        this.status = "gameover";
        this.onGameOver(reason);
      } else {
        // Player death (squished or cleared) - ignore in god mode
        // Maybe respawn player at top?
        if (this.player) {
          this.player.y = 0; // Teleport to safety
          this.player.vy = 0;
        }
      }
      return;
    }

    this.status = "gameover";
    if (this.player) this.player.dead = true;
    this.onGameOver(reason);
  }

  gameWin() {
    if (this.status !== "playing") return;
    this.status = "win";
    this.onGameWin();
  }

  selectDifficulty(diff) {
    this.settings.difficulty = diff;
    this.settings.diffConfig = DIFFICULTY_SETTINGS[diff];
    if (this.currentPiece && this.status === "playing") this.calculateAITarget();
  }

  selectSpeed(speed) {
    this.settings.speed = speed;
  }

  triggerSabotage() {
    if (this.timers.sabotageCooldown > 0 || !this.currentPiece || this.status !== "playing") return;
    this.timers.sabotageCooldown = this.settings.diffConfig.sabotageCooldown * 1000;
    const dropDist = this.getDropDistance();
    if (dropDist < 6) {
      this.sabotageQueued = true;
    } else {
      this.applySabotageToCurrent();
    }
  }
}

// ==========================================
// 4. BROWSER INTEGRATION
// ==========================================

// Only run browser-specific code if window is defined
if (typeof window !== "undefined") {
  const CANVAS = document.getElementById("gameCanvas");
  const CTX = CANVAS.getContext("2d");

  // Instantiate the engine
  const game = new GameEngine({
    width: CANVAS.width,
    height: CANVAS.height,
    onGameOver: (reason) => {
      document.getElementById("deathReason").textContent = reason;
      document.getElementById("finalHeight").textContent = Math.floor((1 - game.player.y / CANVAS.height) * 100);
      document.getElementById("finalTime").textContent = Math.floor(game.stats.time);
      document.getElementById("gameOverOverlay").classList.remove("hidden");
      CANVAS.classList.add("death-animation");
      setTimeout(() => CANVAS.classList.remove("death-animation"), 500);
    },
    onGameWin: () => {
      document.getElementById("winTime").textContent = Math.floor(game.stats.time);
      document.getElementById("winOverlay").classList.remove("hidden");
    },
    onLineCleared: (count) => {
      // Optional: Add visual effects for line clear here if not handled by particles
    },
  });

  // --- RENDERING SYSTEM ---

  function drawGrid() {
    CTX.strokeStyle = "rgba(255, 255, 255, 0.05)";
    CTX.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x <= game.constants.COLS; x++) {
      CTX.beginPath();
      CTX.moveTo(x * game.constants.CELL_SIZE, 0);
      CTX.lineTo(x * game.constants.CELL_SIZE, CANVAS.height);
      CTX.stroke();
    }
    // Horizontal lines
    for (let y = 0; y <= game.constants.ROWS; y++) {
      CTX.beginPath();
      CTX.moveTo(0, y * game.constants.CELL_SIZE);
      CTX.lineTo(CANVAS.width, y * game.constants.CELL_SIZE);
      CTX.stroke();
    }

    // Blocks
    for (let y = 0; y < game.constants.ROWS; y++) {
      for (let x = 0; x < game.constants.COLS; x++) {
        if (game.grid[y][x]) {
          drawBlock(x * game.constants.CELL_SIZE, y * game.constants.CELL_SIZE, game.grid[y][x]);
        }
      }
    }
  }

  function drawBlock(x, y, color) {
    const s = game.constants.CELL_SIZE;
    CTX.fillStyle = color;
    CTX.fillRect(x + 2, y + 2, s - 4, s - 4);

    CTX.fillStyle = "rgba(255, 255, 255, 0.3)";
    CTX.fillRect(x + 2, y + 2, s - 4, 6);
    CTX.fillRect(x + 2, y + 2, 6, s - 4);

    CTX.fillStyle = "rgba(0, 0, 0, 0.3)";
    CTX.fillRect(x + s - 8, y + 8, 6, s - 10);
    CTX.fillRect(x + 8, y + s - 8, s - 10, 6);
  }

  function drawCurrentPiece() {
    if (!game.currentPiece) return;
    const p = game.currentPiece;
    for (let y = 0; y < p.shape.length; y++) {
      for (let x = 0; x < p.shape[y].length; x++) {
        if (p.shape[y][x]) {
          drawBlock((p.x + x) * game.constants.CELL_SIZE, (p.y + y) * game.constants.CELL_SIZE, p.color);
        }
      }
    }
  }

  function drawPlayer() {
    const p = game.player;
    if (!p) return;

    if (p.dead) {
      CTX.font = `${game.constants.CELL_SIZE}px serif`;
      CTX.textAlign = "center";
      CTX.textBaseline = "middle";
      CTX.fillText("😵", p.x + game.constants.PLAYER_WIDTH / 2, p.y + game.constants.PLAYER_HEIGHT / 2);
      return;
    }

    const w = game.constants.PLAYER_WIDTH;
    const h = game.constants.PLAYER_HEIGHT;

    // Body
    CTX.fillStyle = "#4ecca3";
    CTX.fillRect(p.x + w * 0.15, p.y + h * 0.28, w * 0.7, h * 0.45);

    // Head
    CTX.fillStyle = "#ffd93d";
    CTX.beginPath();
    CTX.arc(p.x + w / 2, p.y + h * 0.18, w * 0.38, 0, Math.PI * 2);
    CTX.fill();

    // Eyes
    CTX.fillStyle = "#1a1a2e";
    const eyeOff = p.facingRight ? 3 : -3;
    CTX.beginPath();
    CTX.arc(p.x + w / 2 + eyeOff - 5, p.y + h * 0.16, 3, 0, Math.PI * 2);
    CTX.arc(p.x + w / 2 + eyeOff + 5, p.y + h * 0.16, 3, 0, Math.PI * 2);
    CTX.fill();

    // Legs
    CTX.fillStyle = "#e94560";
    const legOff = Math.sin(Date.now() / 100) * 3 * (Math.abs(p.vx) > 0.1 ? 1 : 0);
    CTX.fillRect(p.x + w * 0.2, p.y + h * 0.7 + legOff, w * 0.25, h * 0.3);
    CTX.fillRect(p.x + w * 0.55, p.y + h * 0.7 - legOff, w * 0.25, h * 0.3);

    // Arms
    CTX.fillStyle = "#ffd93d";
    const armWave = p.onGround ? 0 : Math.sin(Date.now() / 80) * 15;
    CTX.save();
    CTX.translate(p.x + w * 0.1, p.y + h * 0.32);
    CTX.rotate(((-20 + armWave) * Math.PI) / 180);
    CTX.fillRect(-3, 0, 6, h * 0.28);
    CTX.restore();

    CTX.save();
    CTX.translate(p.x + w * 0.9, p.y + h * 0.32);
    CTX.rotate(((20 - armWave) * Math.PI) / 180);
    CTX.fillRect(-3, 0, 6, h * 0.28);
    CTX.restore();

    CTX.globalAlpha = 1;
  }

  function drawParticles() {
    game.particles.forEach((p) => {
      CTX.globalAlpha = p.life;
      CTX.fillStyle = p.color;
      CTX.fillRect(p.x - 4, p.y - 4, 8, 8);
    });
    CTX.globalAlpha = 1;
  }

  function drawEscapeZone() {
    // Semi-transparent green background
    CTX.fillStyle = "rgba(78, 204, 163, 0.15)";
    CTX.fillRect(0, 0, CANVAS.width, game.constants.CELL_SIZE * 2);

    // Green dashed line at bottom of zone
    CTX.strokeStyle = "#4ecca3";
    CTX.lineWidth = 2;
    CTX.setLineDash([10, 5]);
    CTX.beginPath();
    CTX.moveTo(0, game.constants.CELL_SIZE * 2);
    CTX.lineTo(CANVAS.width, game.constants.CELL_SIZE * 2);
    CTX.stroke();
    CTX.setLineDash([]);

    // "ESCAPE ZONE" text with better positioning
    CTX.fillStyle = "#4ecca3";
    CTX.font = "bold 16px sans-serif";
    CTX.textAlign = "center";
    CTX.textBaseline = "middle";
    CTX.fillText("▲ ESCAPE ZONE ▲", CANVAS.width / 2, game.constants.CELL_SIZE - 2);
    CTX.textBaseline = "alphabetic"; // Reset to default
  }

  function drawDangerIndicators() {
    if (game.timers.playerLineClear > 0) {
      const cells = game.getPlayerCompletingCells();
      const pulse = Math.sin(Date.now() / 100) * 0.5 + 0.5; // 0 to 1

      CTX.save();
      CTX.shadowBlur = 10 + pulse * 10;
      CTX.shadowColor = "red";
      CTX.fillStyle = `rgba(255, 0, 0, ${0.3 + pulse * 0.3})`;

      cells.forEach((c) => {
        CTX.fillRect(
          c.x * game.constants.CELL_SIZE,
          c.y * game.constants.CELL_SIZE,
          game.constants.CELL_SIZE,
          game.constants.CELL_SIZE
        );
      });
      CTX.restore();
    }
  }

  function updateUI() {
    if (!game.player) return;
    const hPct = Math.max(0, Math.floor((1 - game.player.y / CANVAS.height) * 100));
    document.getElementById("height").textContent = hPct;
    document.getElementById("time").textContent = Math.floor(game.stats.time);
    document.getElementById("lines").textContent = game.stats.linesCleared;

    const sabEl = document.getElementById("sabotage");
    if (sabEl) {
      if (game.timers.sabotageCooldown > 0) {
        sabEl.textContent = Math.ceil(game.timers.sabotageCooldown / 1000) + "s";
        sabEl.style.color = "#888";
      } else {
        sabEl.textContent = "READY";
        sabEl.style.color = "#4ecca3";
      }
    }
  }

  // --- CONTROL FUNCTIONS ---

  function startGame() {
    game.start();
    ["startOverlay", "pauseOverlay", "gameOverOverlay", "winOverlay"].forEach((id) =>
      document.getElementById(id).classList.add("hidden")
    );
  }

  function pauseGame() {
    if (game.status === "playing") {
      game.status = "paused";
      document.getElementById("pauseOverlay").classList.remove("hidden");
    }
  }

  function resumeGame() {
    if (game.status === "paused") {
      game.status = "playing";
      document.getElementById("pauseOverlay").classList.add("hidden");
      game.lastTime = performance.now();
    }
  }

  function restartGame() {
    document.getElementById("pauseOverlay").classList.add("hidden");
    startGame();
  }

  function togglePause() {
    if (game.status === "playing") pauseGame();
    else if (game.status === "paused") resumeGame();
  }

  // --- INPUT & UI HANDLERS ---

  function setupEventListeners() {
    // Keyboard Inputs
    document.addEventListener("keydown", (e) => {
      game.input.keys[e.code] = true;
      // Prevent scrolling for game keys
      if (["ArrowUp", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();

      // Toggle Pause
      if (e.code === "KeyP" || e.code === "Escape") {
        e.preventDefault();
        togglePause();
      }

      // Trigger Sabotage
      if (e.code === "KeyS") {
        e.preventDefault();
        game.triggerSabotage();
      }
    });

    document.addEventListener("keyup", (e) => {
      game.input.keys[e.code] = false;
    });

    // Clear inputs when window loses focus to prevent "stuck" keys
    window.addEventListener("blur", () => {
      game.input.keys = {};
    });

    // UI Buttons - Difficulty Selection
    document.querySelectorAll(".diff-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const diff = e.target.dataset.difficulty;
        if (diff) {
          game.selectDifficulty(diff);
          // Update UI buttons
          document.querySelectorAll(".diff-btn").forEach((b) => {
            b.classList.toggle("selected", b.dataset.difficulty === diff);
          });
        }
      });
    });

    // UI Buttons - Speed Selection
    document.querySelectorAll(".speed-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const speed = parseFloat(e.target.dataset.speed);
        if (!isNaN(speed)) {
          game.selectSpeed(speed);
          // Update UI buttons
          document.querySelectorAll(".speed-btn").forEach((b) => {
            b.classList.toggle("selected", parseFloat(b.dataset.speed) === speed);
          });
        }
      });
    });

    // UI Buttons - Game Control
    const startBtn = document.getElementById("start-btn");
    if (startBtn) startBtn.addEventListener("click", startGame);

    const resumeBtn = document.getElementById("resume-btn");
    if (resumeBtn) resumeBtn.addEventListener("click", resumeGame);

    const restartBtn = document.getElementById("restart-btn");
    if (restartBtn) restartBtn.addEventListener("click", restartGame);

    const tryAgainBtn = document.getElementById("try-again-btn");
    if (tryAgainBtn) tryAgainBtn.addEventListener("click", startGame);

    const playAgainBtn = document.getElementById("play-again-btn");
    if (playAgainBtn) playAgainBtn.addEventListener("click", startGame);
  }

  // --- MAIN LOOP ---

  let lastTime = 0;
  function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    game.update(dt, game.input);
    updateUI();

    // Render
    CTX.fillStyle = "#0a0a15";
    CTX.fillRect(0, 0, CANVAS.width, CANVAS.height);

    if (["playing", "paused", "gameover", "win"].includes(game.status)) {
      // Save context and set up clipping to prevent elements from bleeding outside canvas
      CTX.save();
      CTX.beginPath();
      CTX.rect(0, 0, CANVAS.width, CANVAS.height);
      CTX.clip();

      drawEscapeZone();
      drawDangerIndicators();
      drawGrid();
      drawCurrentPiece();
      drawPlayer();
      drawParticles();

      CTX.restore();
    }

    requestAnimationFrame(gameLoop);
  }

  // Initialize game when DOM is ready
  document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    requestAnimationFrame(gameLoop);
  });
}

// Export for Node.js
if (typeof module !== "undefined") {
  module.exports = { GameEngine, DEFAULT_CONSTANTS };
}
