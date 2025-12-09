window.TE = window.TE || {};

window.TE.AIController = class AIController {
  constructor(engine) {
    this.engine = engine;
    this.reset();
  }

  reset() {
    this.moveCount = 0;
    this.retargetCount = 0;
    this.target = null;
    this.targetScore = null;
    this.path = [];
    this.state = "targeting";
    this.erraticDir = 1;
    // Track for meaningful retarget detection
    this.lastTargetKey = null;
    this.lastPlayerGridX = null;
  }

  checkRotationOcclusion(currentX, currentY, currentShape, nextShape) {
    const width = Math.max(currentShape[0].length, nextShape[0].length);
    const height = Math.max(currentShape.length, nextShape.length);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const gridY = currentY + y;
        const gridX = currentX + x;

        if (gridY >= 0 && gridY < this.engine.constants.ROWS && gridX >= 0 && gridX < this.engine.constants.COLS) {
          if (this.engine.grid[gridY][gridX] !== null) {
            return false;
          }
        }
      }
    }
    return true;
  }

  performErraticMove() {
    const piece = this.engine.currentPiece;
    if (Math.random() < 0.1) this.erraticDir *= -1;

    if (this.engine.canPlacePieceWithPlayer(piece, this.erraticDir, 0)) {
      piece.x += this.erraticDir;
    } else {
      this.erraticDir *= -1;
    }

    if (Math.random() < 0.05) {
      const newRot = (piece.rotation + 1) % window.TE.TETROMINOES[piece.type].shapes.length;
      const newShape = window.TE.getShape(piece.type, newRot);
      if (
        this.engine.canPlacePieceWithPlayer(piece, 0, 0, newShape) &&
        this.checkRotationOcclusion(piece.x, piece.y, piece.shape, newShape)
      ) {
        piece.rotation = newRot;
        piece.shape = newShape;
      }
    }
  }

  calculateTarget(overrideConfig = null, avoidPlayer = false, playerTriggered = false) {
    if (!this.engine.currentPiece) {
      this.target = null;
      this.path = [];
      return;
    }

    let bestScore = -Infinity;
    let bestState = null;
    const diffConfig = overrideConfig || this.engine.settings.diffConfig;
    const shapes = window.TE.TETROMINOES[this.engine.currentPiece.type].shapes;

    // Calculate board urgency (Panic Mode)
    let currentMaxHeight = 0;
    for (let y = 0; y < this.engine.constants.ROWS; y++) {
      if (this.engine.grid[y].some((c) => c !== null)) {
        currentMaxHeight = this.engine.constants.ROWS - y;
        break;
      }
    }

    // Avoidance parameters
    let playerGridLeft = -1;
    let playerGridRight = -1;
    let dangerZoneReward = diffConfig.dangerZoneReward; // The reward is usually negative

    if (avoidPlayer && this.engine.player) {
      const margin = diffConfig.dangerZoneMargin;
      playerGridLeft = Math.floor(this.engine.player.x / this.engine.constants.CELL_SIZE - margin);
      playerGridRight = Math.ceil(
        (this.engine.player.x + this.engine.constants.PLAYER_WIDTH) / this.engine.constants.CELL_SIZE + margin
      );

      // Apply decay based on retarget count
      // Easy (1.0): never decays, Normal (0.7): moderate, Hard (0.4): aggressive
      const decay = diffConfig.dangerZoneDecay ?? 1.0;
      dangerZoneReward = diffConfig.dangerZoneReward * Math.pow(decay, this.retargetCount);

      // Linearly reduce targeting player's danger zone reward as board fills up ("Panic Mode")
      // For negative rewards, this makes them less negative; positive rewards become less positive.
      // In any case, this will make AI stop caring about the player and just focus on survival.
      dangerZoneReward = Math.min(0, dangerZoneReward - currentMaxHeight * (dangerZoneReward / 20));
    }

    // BFS State: { x, y, rotation }
    const startState = {
      x: this.engine.currentPiece.x,
      y: this.engine.currentPiece.y,
      rotation: this.engine.currentPiece.rotation,
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
        rotation: current.rotation,
        shape: shape,
        type: this.engine.currentPiece.type,
      };

      const canMoveDown = this.engine.canPlacePiece(tempPiece, 0, 1);

      if (!canMoveDown) {
        // Evaluate resting spot
        let dzReward = 0;
        if (avoidPlayer) {
          const width = shape[0].length;
          const pieceRight = current.x + width;
          // The piece actually targets the player's grid space
          if (current.x < playerGridRight && pieceRight > playerGridLeft) {
            dzReward = dangerZoneReward;
          }
        }

        const score = this.evaluatePosition(tempPiece, shape, diffConfig) + dzReward;
        if (score > bestScore) {
          bestScore = score;
          bestState = current;
        }
      }

      // Generate neighbors
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

        if (avoidPlayer && (n.action === "left" || n.action === "right" || n.action === "rotate")) {
          const width = nextShape[0].length;
          const pieceLeft = nextX;
          const pieceRight = nextX + width;

          const playerYGrid = Math.floor(this.engine.player.y / this.engine.constants.CELL_SIZE);
          const pieceBottomGrid = nextY + nextShape.length;

          if (pieceBottomGrid >= playerYGrid - 2) {
            const nextInDanger = pieceLeft < playerGridRight && pieceRight > playerGridLeft;

            if (nextInDanger) {
              const curWidth = shape[0].length;
              const curLeft = current.x;
              const curRight = current.x + curWidth;
              const curInDanger = curLeft < playerGridRight && curRight > playerGridLeft;

              if (!curInDanger) {
                continue;
              }
            }
          }
        }

        let valid = false;
        if (n.action === "rotate") {
          if (
            this.engine.canPlacePiece(
              { x: current.x, y: current.y, shape: shape, type: this.engine.currentPiece.type },
              0,
              0,
              nextShape
            ) &&
            this.checkRotationOcclusion(current.x, current.y, shape, nextShape)
          ) {
            valid = true;
          }
        } else {
          if (
            this.engine.canPlacePiece(
              { x: current.x, y: current.y, shape: shape, type: this.engine.currentPiece.type },
              n.dx,
              n.dy
            )
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

    this.target = bestState;
    this.targetScore = bestScore;

    // Track target changes for meaningful retarget counting
    const newTargetKey = bestState ? `${bestState.x},${bestState.y},${bestState.rotation}` : null;
    if (playerTriggered && this.lastTargetKey !== null && newTargetKey !== this.lastTargetKey) {
      // Target actually changed due to player movement - count it
      this.retargetCount++;
    }
    this.lastTargetKey = newTargetKey;

    // Track player position for change detection
    if (this.engine.player) {
      this.lastPlayerGridX = Math.floor(this.engine.player.x / this.engine.constants.CELL_SIZE);
    }

    this.path = [];
    if (bestState) {
      let currKey = `${bestState.x},${bestState.y},${bestState.rotation}`;
      this.path.unshift({ x: bestState.x, y: bestState.y, rotation: bestState.rotation });

      while (currKey !== startKey) {
        const info = parents.get(currKey);
        if (!info) break;
        const [px, py, prot] = info.parentKey.split(",").map(Number);
        this.path.unshift({ x: px, y: py, rotation: prot });
        currKey = info.parentKey;
      }
      if (this.path.length > 0) {
        this.path.shift();
      }
    }
  }

  evaluatePosition(piece, shape, diffConfig) {
    let tempGrid = this.engine.grid.map((row) => [...row]);

    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          const gy = piece.y + y;
          const gx = piece.x + x;
          if (gy >= 0 && gy < this.engine.constants.ROWS) tempGrid[gy][gx] = true;
        }
      }
    }

    let score = 0;
    const diff = diffConfig;

    let completedLines = 0;
    for (let y = 0; y < this.engine.constants.ROWS; y++) {
      if (tempGrid[y].every((c) => c)) completedLines++;
    }
    score += completedLines * diff.lineReward;
    if (completedLines > 0 && diff.multiLineBonus) {
      if (completedLines >= 4) score += 150;
      else if (completedLines >= 2) score += 50;
    }

    let gridAfter = tempGrid.filter((row) => !row.every((c) => c));
    while (gridAfter.length < this.engine.constants.ROWS)
      gridAfter.unshift(Array(this.engine.constants.COLS).fill(null));

    const heights = [];
    for (let x = 0; x < this.engine.constants.COLS; x++) {
      let h = 0;
      for (let y = 0; y < this.engine.constants.ROWS; y++) {
        if (gridAfter[y][x]) {
          h = this.engine.constants.ROWS - y;
          break;
        }
      }
      heights.push(h);
    }

    let holes = 0,
      coveredHoles = 0;
    for (let x = 0; x < this.engine.constants.COLS; x++) {
      let blockFound = false;
      let blocksAbove = 0;
      for (let y = 0; y < this.engine.constants.ROWS; y++) {
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
    for (let x = 0; x < this.engine.constants.COLS - 1; x++) bumpiness += Math.abs(heights[x] - heights[x + 1]);

    // Funnel-based terrain traversability check
    // A valid funnel has heights monotonically decreasing from edges toward center
    const COLS = this.engine.constants.COLS;
    const MID = Math.floor(COLS / 2); // 5 for 10-column grid

    // Check funnel validity from each edge
    // leftFunnelValidUntil: rightmost column index where left funnel is still valid
    // rightFunnelValidUntil: leftmost column index where right funnel is still valid
    let leftFunnelValidUntil = 0;
    for (let x = 1; x < COLS; x++) {
      if (heights[x] <= heights[x - 1]) {
        leftFunnelValidUntil = x;
      } else {
        break; // Funnel broken
      }
    }

    let rightFunnelValidUntil = COLS - 1;
    for (let x = COLS - 2; x >= 0; x--) {
      if (heights[x] <= heights[x + 1]) {
        rightFunnelValidUntil = x;
      } else {
        break; // Funnel broken
      }
    }

    let terrainPenalty = 0;

    // Check each adjacent pair for unclimbable cliffs (>=4 height difference)
    for (let x = 0; x < COLS - 1; x++) {
      const heightDiff = Math.abs(heights[x] - heights[x + 1]);
      if (heightDiff < 4) continue; // Climbable, no penalty

      // Determine which column is higher
      const higherCol = heights[x] > heights[x + 1] ? x : x + 1;
      const lowerCol = heights[x] > heights[x + 1] ? x + 1 : x;

      // Check if this cliff is in a valid funnel pattern:
      // The higher column should be on the "outer" side (toward edge)
      // and the funnel should be intact up to that point
      let isValidFunnel = false;

      if (higherCol <= MID) {
        // Left side of board: higher column should be more toward left (outer)
        // and left funnel should be valid up to the lower column
        if (higherCol < lowerCol && leftFunnelValidUntil >= lowerCol) {
          isValidFunnel = true;
        }
      } else {
        // Right side of board: higher column should be more toward right (outer)
        // and right funnel should be valid up to the lower column
        if (higherCol > lowerCol && rightFunnelValidUntil <= lowerCol) {
          isValidFunnel = true;
        }
      }

      if (isValidFunnel) {
        // Valid funnel cliff: scaled penalty based on distance from edge
        // Edges (cols 0,9) = no penalty, inner columns = increasing penalty
        const distFromEdge = Math.min(higherCol, COLS - 1 - higherCol);
        // distFromEdge: 0 for edges, 1 for cols 1/8, 2 for cols 2/7, etc.
        // Use exponential scaling: 2^distFromEdge
        const scaledPenalty = diff.funnelPenaltyBase * Math.pow(2, distFromEdge);
        terrainPenalty += scaledPenalty;
      } else {
        // Broken funnel: this cliff splits the playing field
        terrainPenalty += diff.splitPenalty;
      }
    }

    score += holes * diff.holeReward;
    score += coveredHoles * diff.coveredHoleReward;
    score += heights.reduce((a, b) => a + b, 0) * diff.heightReward;
    score += Math.max(...heights) * diff.maxHeightReward;

    const maxBoardHeight = Math.max(...heights);
    if (maxBoardHeight >= this.engine.constants.ROWS - 2) {
      score -= 100000;
    } else if (maxBoardHeight >= this.engine.constants.ROWS - 4) {
      score -= 20000;
    }

    score += bumpiness * diff.bumpinessReward;
    score += terrainPenalty;

    const minEdge = Math.min(heights[0], heights[this.engine.constants.COLS - 1]);
    score += (10 - minEdge) * 3;

    const pieceBottom = piece.y + piece.shape.length;
    if (pieceBottom < 4) score -= (4 - pieceBottom) * 30;

    return score;
  }

  update() {
    if (!this.engine.currentPiece) return;
    this.moveCount++;

    if (this.engine.timers.sabotage > 0 && this.state === "erratic") {
      this.performErraticMove();
      if (this.engine.getDropDistance() < 6) {
        this.state = "targeting";
      }
      return;
    }

    if (this.path && this.path.length > 0) {
      const piece = this.engine.currentPiece;

      let canFastDrop = true;
      for (const step of this.path) {
        if (step.x !== piece.x || step.rotation !== piece.rotation) {
          canFastDrop = false;
          break;
        }
      }

      if (canFastDrop && this.moveCount >= this.engine.settings.diffConfig.minMovesBeforeFastDrop) {
        if (piece.fallStepCount >= this.engine.settings.diffConfig.spawnDropDelay) {
          const lastState = this.path[this.path.length - 1];
          let dropDist = 0;
          let testY = piece.y;
          const testPiece = { ...piece };
          while (this.engine.canPlacePiece(testPiece, 0, 1)) {
            testPiece.y++;
            dropDist++;
          }

          if (dropDist >= this.engine.settings.diffConfig.minFastDropHeight && !this.engine.isPlayerInDangerZone()) {
            piece.y = testPiece.y;
            this.path = [];
            return;
          }
        }
      }

      // Clean up path steps we've already passed
      while (this.path.length > 0 && this.path[0].y < piece.y) {
        this.path.shift();
      }

      if (this.path.length === 0) {
        return; // Path complete
      }

      // Find target state: the last step at current Y, or if none, the first step at Y+1
      // This tells us where we need to be before the next gravity tick
      let targetState = null;

      for (const step of this.path) {
        if (step.y === piece.y) {
          // There's a step at current Y - we should match it
          targetState = step;
        } else if (step.y === piece.y + 1) {
          // First step at next Y - we need to reach this x/rotation before falling
          if (!targetState) {
            targetState = step;
          }
          break; // Don't look further
        } else if (step.y > piece.y + 1) {
          // Too far ahead, stop looking
          break;
        }
      }

      if (!targetState) {
        return; // No immediate moves needed
      }

      // If we're already at target state, nothing to do
      if (piece.x === targetState.x && piece.rotation === targetState.rotation) {
        // Clean up this step if it's at current Y
        if (
          this.path.length > 0 &&
          this.path[0].y === piece.y &&
          this.path[0].x === piece.x &&
          this.path[0].rotation === piece.rotation
        ) {
          this.path.shift();
        }
        return;
      }

      // Execute move toward target
      let success = false;

      if (piece.rotation !== targetState.rotation) {
        const newRot = targetState.rotation;
        const newShape = window.TE.getShape(piece.type, newRot);
        if (this.engine.canPlacePieceWithPlayer(piece, 0, 0, newShape)) {
          piece.rotation = newRot;
          piece.shape = newShape;
          success = true;
        }
      } else if (piece.x !== targetState.x) {
        const dx = Math.sign(targetState.x - piece.x);
        if (this.engine.canPlacePieceWithPlayer(piece, dx, 0)) {
          piece.x += dx;
          success = true;
        }
      }

      if (!success) {
        // Move failed - check if we should recalculate or just give up
        const dropDistance = this.engine.getDropDistance();

        if (dropDistance <= 3) {
          // Too close to landing - don't recalculate, just accept current position
          // This prevents erratic last-second movements
          this.path = [];
          this.target = { x: piece.x, y: piece.y + dropDistance, rotation: piece.rotation };
        } else {
          // Still have room - recalculate path
          this.calculateTarget(null, this.engine.isPlayerInDangerZone());
        }
      }
    }
  }
};
