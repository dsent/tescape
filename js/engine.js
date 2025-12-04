window.TE = window.TE || {};

window.TE.GameEngine = class GameEngine {
  constructor(config = {}) {
    this.width = config.width || 350;
    this.height = config.height || 700;
    this.onGameOver = config.onGameOver || (() => {});
    this.onGameWin = config.onGameWin || (() => {});
    this.onLineCleared = config.onLineCleared || (() => {});

    // Calculate derived constants
    this.constants = { ...window.TE.DEFAULT_CONSTANTS };
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
    this.ai = new window.TE.AIController(this);

    this.sabotageQueued = false;

    // Game Settings - Preserve existing settings if available, otherwise default
    if (!this.settings) {
      this.settings = {
        difficulty: "normal",
        speed: 1.0,
        diffConfig: window.TE.DIFFICULTY_SETTINGS.normal,
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
    const type = window.TE.getRandomTetrominoType();
    const tetro = window.TE.TETROMINOES[type];
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

    this.ai.reset();

    if (!this.canPlacePiece(this.currentPiece, 0, 0)) {
      this.gameOver("The playing field filled up!");
      return;
    }

    this.ai.calculateTarget(null, this.isPlayerInDangerZone());

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
      this.ai.update();
    }

    this.timers.pieceFall += scaledDt * 1000;
    if (this.timers.pieceFall >= this.settings.diffConfig.baseFallTick) {
      // If player is in danger zone, try to move away
      if (this.isPlayerInDangerZone()) {
        const maxRetargets = this.settings.diffConfig.maxRetargets;
        if (maxRetargets === -1 || this.ai.retargetCount < maxRetargets) {
          this.ai.calculateTarget(null, true);
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
    this.ai.calculateTarget(window.TE.DIFFICULTY_SETTINGS.easy);

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
      const newRot = (piece.rotation + 1) % window.TE.TETROMINOES[piece.type].shapes.length;
      const newShape = window.TE.getShape(piece.type, newRot);
      if (this.canPlacePiece(piece, 0, 0, newShape)) {
        piece.rotation = newRot;
        piece.shape = newShape;
      }
    }
  }

  gameOver(reason) {
    if (this.status !== "playing") return;

    if (this.godMode) {
      if (reason === "The playing field filled up!") {
        this.status = "gameover";
        this.onGameOver(reason);
      } else {
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
    this.settings.diffConfig = window.TE.DIFFICULTY_SETTINGS[diff];
    if (this.currentPiece && this.status === "playing") this.ai.calculateTarget();
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
};
