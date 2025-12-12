/**
 * Tetromino Escape - Headless Simulation and Debug Tool
 *
 * Usage:
 *   node simulate.js [difficulty] [games]     - Run AI-only simulation
 *   node simulate.js --player [difficulty] [games] - Run with simulated player
 *   node simulate.js --state <file.json>      - Load state and analyze AI decision
 *   node simulate.js --state <file.json> --step [n]  - Step through n AI moves
 *
 * Examples:
 *   node simulate.js easy 100
 *   node simulate.js --player hard 50
 *   node simulate.js --state dump.json
 *   node simulate.js --state dump.json --step 5
 */

import fs from 'fs';
import { DEFAULT_CONSTANTS, TETROMINOES, DIFFICULTY_SETTINGS } from './js/constants.js';
import { getShape, getRandomTetrominoType } from './js/utils.js';
import { AIController } from './js/ai.js';
import { GameEngine } from './js/engine.js';

// Parse command line arguments
const args = process.argv.slice(2);
let mode = "simulate";
let stateFile = null;
let stepCount = 1;
let difficulty = "easy";
let numGames = 100;
let useSimulatedPlayer = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--state" && args[i + 1]) {
    mode = "analyze";
    stateFile = args[i + 1];
    i++;
  } else if (args[i] === "--step" && args[i + 1]) {
    stepCount = parseInt(args[i + 1]) || 1;
    i++;
  } else if (args[i] === "--verbose" || args[i] === "-v") {
    global.TE_DEBUG_AI = true;
  } else if (args[i] === "--player" || args[i] === "-p") {
    useSimulatedPlayer = true;
  } else if (!args[i].startsWith("--")) {
    if (isNaN(parseInt(args[i]))) {
      difficulty = args[i];
    } else {
      numGames = parseInt(args[i]);
    }
  }
}

// Create a debug wrapper for AIController
class DebugAIController extends AIController {
  calculateTarget(overrideConfig = null, avoidPlayer = false, playerTriggered = false) {
    if (global.TE_DEBUG_AI) {
      this.lastBFSCandidates = [];
      const originalEvaluate = this.evaluatePosition.bind(this);

      this.evaluatePosition = (piece, shape, diffConfig, detailed = false) => {
        // Always get detailed breakdown for debug logging
        const breakdown = originalEvaluate(piece, shape, diffConfig, true);
        this.lastBFSCandidates.push({
          x: piece.x,
          y: piece.y,
          rotation: piece.rotation,
          baseScore: breakdown.total,
          breakdown: breakdown,
        });
        // Return what was requested
        return detailed ? breakdown : breakdown.total;
      };

      super.calculateTarget(overrideConfig, avoidPlayer, playerTriggered);
      this.evaluatePosition = originalEvaluate;

      if (avoidPlayer && this.engine.player && this.engine.currentPiece) {
        const pieceType = this.engine.currentPiece.type;
        const diffConfig = overrideConfig || this.engine.settings.diffConfig;
        const margin = diffConfig.dangerZoneMargin;
        const playerGridLeft = Math.floor(this.engine.player.x / this.engine.constants.CELL_SIZE - margin);
        const playerGridRight = Math.ceil(
          (this.engine.player.x + this.engine.constants.PLAYER_WIDTH) / this.engine.constants.CELL_SIZE + margin
        );

        for (const cand of this.lastBFSCandidates) {
          const shape = getShape(pieceType, cand.rotation);
          if (!shape) {
            console.error(`No shape for type=${pieceType} rot=${cand.rotation}`);
            cand.inDangerZone = false;
            cand.finalScore = cand.baseScore;
            continue;
          }
          const width = shape[0].length;
          const pieceRight = cand.x + width;
          cand.inDangerZone = cand.x < playerGridRight && pieceRight > playerGridLeft;
          cand.finalScore = cand.baseScore + (cand.inDangerZone ? diffConfig.dangerZoneReward : 0);
        }
      } else {
        for (const cand of this.lastBFSCandidates) {
          cand.inDangerZone = false;
          cand.finalScore = cand.baseScore;
        }
      }
    } else {
      super.calculateTarget(overrideConfig, avoidPlayer, playerTriggered);
    }
  }
}

// Override GameEngine to use DebugAIController
class DebugGameEngine extends GameEngine {
  reset() {
    super.reset();
    // Replace AI controller with debug version
    this.ai = new DebugAIController(this);
  }
}

function createEngine(godMode = true) {
  return new DebugGameEngine({
    width: 350,
    height: 700,
    godMode: godMode,
    onGameOver: () => {},
    onGameWin: () => {},
    onLineCleared: () => {},
  });
}

/**
 * SimulatedPlayer - AI-controlled player that tries to escape
 *
 * Design principles:
 * - NO difficulty-specific tuning (no isHardMode checks)
 * - Only branch on qualitative features (e.g., playerCompletesLine)
 * - Priority: Survival > Avoid line-clear death > Climb > Idle
 * - React early, move decisively
 */
class SimulatedPlayer {
  constructor(engine) {
    this.engine = engine;
    this.stats = {
      disruptions: 0,
      escapeAttempts: 0,
      nearDeaths: 0,
    };
    this.lastAITarget = null;
  }

  // Get column heights from current grid
  getHeights() {
    const heights = [];
    for (let x = 0; x < this.engine.constants.COLS; x++) {
      let h = 0;
      for (let y = 0; y < this.engine.constants.ROWS; y++) {
        if (this.engine.grid[y][x] !== null) {
          h = this.engine.constants.ROWS - y;
          break;
        }
      }
      heights.push(h);
    }
    return heights;
  }

  // Get player's current grid column (center of player)
  getPlayerGridX() {
    const centerX = this.engine.player.x + this.engine.constants.PLAYER_WIDTH / 2;
    return Math.floor(centerX / this.engine.constants.CELL_SIZE);
  }

  // Get player's height from floor in rows
  getPlayerHeightRows() {
    const bottomY = this.engine.player.y + this.engine.constants.PLAYER_HEIGHT;
    return (this.engine.height - bottomY) / this.engine.constants.CELL_SIZE;
  }

  // Get the falling piece's current column range
  getPieceColumns() {
    const piece = this.engine.currentPiece;
    if (!piece) return null;
    return { left: piece.x, right: piece.x + piece.shape[0].length - 1 };
  }

  // Get the piece's TARGET landing column range
  getTargetColumns() {
    const target = this.engine.ai.target;
    const piece = this.engine.currentPiece;
    if (!target || !piece) return null;

    const shape = getShape(piece.type, target.rotation);
    if (!shape) return null;

    return { left: target.x, right: target.x + shape[0].length - 1 };
  }

  // Check if gridX is within a column range (inclusive)
  isInRange(gridX, range) {
    return range && gridX >= range.left && gridX <= range.right;
  }

  // Check if player is currently in a line-completion danger situation
  // Only relevant when playerCompletesLine feature is enabled
  checkLineCompletionDanger() {
    if (!this.engine.settings.diffConfig.playerCompletesLine) return null;

    const player = this.engine.player;
    if (!player) return null;

    const CELL_SIZE = this.engine.constants.CELL_SIZE;
    const COLS = this.engine.constants.COLS;
    const ROWS = this.engine.constants.ROWS;

    // Get player grid bounds
    const pLeft = Math.floor(player.x / CELL_SIZE);
    const pRight = Math.floor((player.x + this.engine.constants.PLAYER_WIDTH - 1) / CELL_SIZE);
    const pTop = Math.floor(player.y / CELL_SIZE);
    const pBottom = Math.floor((player.y + this.engine.constants.PLAYER_HEIGHT - 1) / CELL_SIZE);

    // Check each row the player occupies
    for (let y = pTop; y <= pBottom; y++) {
      if (y < 0 || y >= ROWS) continue;

      let emptyCount = 0;
      let emptyCols = [];

      for (let x = 0; x < COLS; x++) {
        if (this.engine.grid[y][x] === null) {
          emptyCount++;
          emptyCols.push(x);
        }
      }

      // CRITICAL: Row has only 1 empty cell and player is in it = instant death
      if (emptyCount === 1 && emptyCols[0] >= pLeft && emptyCols[0] <= pRight) {
        return { row: y, level: "critical", emptyCount };
      }

      // WARNING: Row has 2 empty cells and player is in one = one block away from death
      if (emptyCount === 2) {
        const playerInEmpty = emptyCols.some((col) => col >= pLeft && col <= pRight);
        if (playerInEmpty) {
          return { row: y, level: "warning", emptyCount, emptyCols };
        }
      }
    }

    return null;
  }

  // Get rows that are nearly complete (dangerous for playerCompletesLine)
  getNearlyCompleteRows() {
    if (!this.engine.settings.diffConfig.playerCompletesLine) return new Map();

    const COLS = this.engine.constants.COLS;
    const ROWS = this.engine.constants.ROWS;
    const dangerous = new Map();

    for (let y = 0; y < ROWS; y++) {
      let emptyCount = 0;
      let emptyCols = [];

      for (let x = 0; x < COLS; x++) {
        if (this.engine.grid[y][x] === null) {
          emptyCount++;
          emptyCols.push(x);
        }
      }

      // Rows with 1-2 empty cells are dangerous (player could complete them)
      if (emptyCount >= 1 && emptyCount <= 2) {
        dangerous.set(y, { emptyCount, emptyCols });
      }
    }

    return dangerous;
  }

  // Check if a position would put player in a nearly complete row
  wouldEnterDangerousRow(gridX, dangerousRows) {
    if (dangerousRows.size === 0) return false;

    const player = this.engine.player;
    const CELL_SIZE = this.engine.constants.CELL_SIZE;

    // Get player's current row range
    const pTop = Math.floor(player.y / CELL_SIZE);
    const pBottom = Math.floor((player.y + this.engine.constants.PLAYER_HEIGHT - 1) / CELL_SIZE);

    for (const [row, info] of dangerousRows) {
      if (row >= pTop && row <= pBottom) {
        // Would player occupy an empty cell in this dangerous row?
        if (info.emptyCols.includes(gridX)) {
          return true;
        }
      }
    }
    return false;
  }

  // Find best escape direction away from a threat
  getEscapeDirection(heights, playerGridX, threatCenterX) {
    const COLS = this.engine.constants.COLS;

    // Prefer moving away from threat
    const awayDir = playerGridX < threatCenterX ? -1 : 1;

    // Check if we can move away (not blocked by high terrain)
    const awayX = playerGridX + awayDir;
    if (awayX >= 0 && awayX < COLS) {
      const currentH = heights[playerGridX] || 0;
      const awayH = heights[awayX] || 0;
      // Can climb up to 3 rows
      if (awayH - currentH <= 3) {
        return awayDir;
      }
    }

    // Try opposite direction
    const otherDir = -awayDir;
    const otherX = playerGridX + otherDir;
    if (otherX >= 0 && otherX < COLS) {
      const currentH = heights[playerGridX] || 0;
      const otherH = heights[otherX] || 0;
      if (otherH - currentH <= 3) {
        return otherDir;
      }
    }

    // Stuck - try away direction anyway (might jump over)
    return awayDir;
  }

  // Check if moving to nextX is safe from the falling piece
  isSafeFromPiece(nextX, dropDist) {
    const piece = this.engine.currentPiece;
    if (!piece) return true;

    // If piece is far away, movement is safe
    if (dropDist > 15) return true;

    const pieceRange = this.getPieceColumns();
    const targetRange = this.getTargetColumns();

    // Avoid being under the piece or its target (with 1 column margin)
    if (pieceRange && nextX >= pieceRange.left - 1 && nextX <= pieceRange.right + 1) return false;
    if (targetRange && nextX >= targetRange.left - 1 && nextX <= targetRange.right + 1) return false;

    return true;
  }

  // Main decision function - simplified and unified across difficulties
  decide() {
    const keys = { left: false, right: false, jump: false };
    const player = this.engine.player;
    if (!player || player.dead) return keys;

    const heights = this.getHeights();
    const maxHeight = Math.max(...heights);
    const playerGridX = this.getPlayerGridX();
    const playerHeightRows = this.getPlayerHeightRows();
    const piece = this.engine.currentPiece;
    const dropDist = piece ? this.engine.getDropDistance() : 999;
    const COLS = this.engine.constants.COLS;

    const pieceRange = this.getPieceColumns();
    const targetRange = this.getTargetColumns();

    // Track AI retargets (for stats)
    const target = this.engine.ai.target;
    if (target && this.lastAITarget) {
      const targetKey = `${target.x},${target.y},${target.rotation}`;
      const lastKey = `${this.lastAITarget.x},${this.lastAITarget.y},${this.lastAITarget.rotation}`;
      if (targetKey !== lastKey) {
        this.stats.disruptions++;
      }
    }
    this.lastAITarget = target ? { ...target } : null;

    // Get dangerous rows early - needed for multiple phases
    const dangerousRows = this.getNearlyCompleteRows();

    // === PHASE 1: LINE COMPLETION AVOIDANCE (highest priority) ===
    // Only active when playerCompletesLine feature is enabled
    // Check this FIRST because line clear death is instant

    const lineCompletionDanger = this.checkLineCompletionDanger();
    if (lineCompletionDanger) {
      this.stats.nearDeaths++;

      // Move sideways to get out of the dangerous row
      // Choose direction that's safer from pieces AND lower terrain
      let bestDir = 0;
      let bestScore = -999;

      for (const dir of [-1, 1]) {
        const nextX = playerGridX + dir;
        if (nextX < 0 || nextX >= COLS) continue;

        let score = 0;
        const nextH = heights[nextX] || 0;

        // Prefer lower terrain (easier to exit)
        score -= nextH * 2;

        // Strongly prefer direction away from piece
        if (pieceRange) {
          const pieceCenter = (pieceRange.left + pieceRange.right) / 2;
          if ((dir < 0 && nextX < pieceCenter) || (dir > 0 && nextX > pieceCenter)) {
            score += 10;
          }
        }

        // Avoid moving into piece danger
        if (this.isInRange(nextX, pieceRange) || this.isInRange(nextX, targetRange)) {
          score -= 50;
        }

        if (score > bestScore) {
          bestScore = score;
          bestDir = dir;
        }
      }

      if (bestDir !== 0) {
        if (bestDir < 0) keys.left = true;
        else keys.right = true;
      }

      // Always jump to try to get above the dangerous row
      if (player.onGround) keys.jump = true;

      return keys;
    }

    // === PHASE 2: IMMEDIATE SURVIVAL ===
    // React early and decisively when in piece danger

    const inPieceDanger = this.isInRange(playerGridX, pieceRange);
    const inTargetDanger = this.isInRange(playerGridX, targetRange);

    // Universal danger threshold - react when piece is within 15 rows
    // This gives enough time to escape on any difficulty
    const DANGER_THRESHOLD = 15;

    if (piece && dropDist <= DANGER_THRESHOLD && (inPieceDanger || inTargetDanger)) {
      this.stats.nearDeaths++;

      // Find escape direction, avoiding dangerous rows if playerCompletesLine is active
      let bestDir = 0;
      let bestScore = -999;

      for (const dir of [-1, 1]) {
        const nextX = playerGridX + dir;
        if (nextX < 0 || nextX >= COLS) continue;

        let score = 0;
        const nextH = heights[nextX] || 0;

        // Can we physically move there? (terrain not too high)
        if (nextH - playerHeightRows > 3) continue;

        // Away from threat center is good
        let threatCenter;
        if (inPieceDanger && pieceRange) {
          threatCenter = (pieceRange.left + pieceRange.right + 1) / 2;
        } else if (targetRange) {
          threatCenter = (targetRange.left + targetRange.right + 1) / 2;
        }
        if (threatCenter !== undefined) {
          if ((dir < 0 && nextX < threatCenter) || (dir > 0 && nextX > threatCenter)) {
            score += 20;
          }
        }

        // Still in piece range is bad
        if (this.isInRange(nextX, pieceRange)) score -= 30;
        if (this.isInRange(nextX, targetRange)) score -= 30;

        // Would enter dangerous row is bad (line clear death)
        if (this.wouldEnterDangerousRow(nextX, dangerousRows)) {
          score -= 40;
        }

        // Lower terrain is easier to escape from
        score -= nextH;

        if (score > bestScore) {
          bestScore = score;
          bestDir = dir;
        }
      }

      if (bestDir !== 0) {
        if (bestDir < 0) keys.left = true;
        else keys.right = true;
      }

      // Jump to speed up escape and potentially climb over obstacles
      if (player.onGround) keys.jump = true;

      return keys;
    }

    // === PHASE 2.5: EARLY WARNING ===
    // If piece is heading toward us but we have time, start moving away
    // This is gentler than the immediate survival phase

    const EARLY_WARNING_THRESHOLD = 18;
    if (piece && dropDist <= EARLY_WARNING_THRESHOLD && dropDist > DANGER_THRESHOLD) {
      // Only react if we're in the target zone (where it will land)
      const inTargetZone = this.isInRange(playerGridX, targetRange);

      if (inTargetZone && targetRange) {
        const targetCenter = (targetRange.left + targetRange.right) / 2;
        const awayDir = playerGridX < targetCenter ? -1 : 1;
        const nextX = playerGridX + awayDir;

        if (nextX >= 0 && nextX < COLS) {
          const nextH = heights[nextX] || 0;
          // Move if terrain allows and destination is safe
          const canMove = nextH - playerHeightRows <= 3;
          const destSafe = !this.wouldEnterDangerousRow(nextX, dangerousRows);
          const notIntoNewDanger = !this.isInRange(nextX, pieceRange);

          if (canMove && destSafe && notIntoNewDanger) {
            if (awayDir < 0) keys.left = true;
            else keys.right = true;
            if (nextH > playerHeightRows && player.onGround) keys.jump = true;
            return keys;
          }
        }
      }
    }

    // === PHASE 3: CLIMB TO ESCAPE ===
    // Move toward higher ground when it's safe
    // (dangerousRows already computed above)

    if (maxHeight >= 2) {
      // Find the best reachable high point
      let bestCol = playerGridX;
      let bestHeight = playerHeightRows;

      for (let x = 0; x < COLS; x++) {
        const h = heights[x] || 0;
        if (h <= bestHeight) continue;

        // Check if reachable (within reasonable distance, path not blocked)
        const dist = Math.abs(x - playerGridX);
        if (dist > 6) continue;

        // Simple path check: no column along the way is too high to climb
        let blocked = false;
        const dir = x > playerGridX ? 1 : -1;
        for (let checkX = playerGridX + dir; checkX !== x + dir; checkX += dir) {
          if (checkX < 0 || checkX >= COLS) break;
          const checkH = heights[checkX] || 0;
          // Can climb 3 rows max
          if (checkH > playerHeightRows + 4) {
            blocked = true;
            break;
          }
        }

        if (!blocked) {
          bestHeight = h;
          bestCol = x;
        }
      }

      // Move toward best climb target
      if (bestCol !== playerGridX) {
        const moveDir = bestCol < playerGridX ? -1 : 1;
        const nextX = playerGridX + moveDir;

        if (nextX >= 0 && nextX < COLS) {
          const nextH = heights[nextX] || 0;

          // Safety checks
          let safe = this.isSafeFromPiece(nextX, dropDist);

          // Check for line completion danger at destination
          if (safe && this.wouldEnterDangerousRow(nextX, dangerousRows)) {
            safe = false;
          }

          if (safe) {
            if (moveDir < 0) keys.left = true;
            else keys.right = true;

            // Jump if we need to climb
            if (nextH > playerHeightRows && player.onGround) {
              keys.jump = true;
            }

            this.stats.escapeAttempts++;
            return keys;
          }
        }
      }

      // Already at a good spot or can't move toward best - check adjacent columns
      for (const dir of [-1, 1]) {
        const adjX = playerGridX + dir;
        if (adjX < 0 || adjX >= COLS) continue;

        const adjH = heights[adjX] || 0;
        const currentH = heights[playerGridX] || 0;

        // Look for climbable adjacent terrain
        if (adjH > currentH && adjH - playerHeightRows <= 3) {
          let safe = this.isSafeFromPiece(adjX, dropDist);

          if (safe && this.wouldEnterDangerousRow(adjX, dangerousRows)) {
            safe = false;
          }

          if (safe) {
            if (dir < 0) keys.left = true;
            else keys.right = true;
            if (player.onGround) keys.jump = true;
            this.stats.escapeAttempts++;
            return keys;
          }
        }
      }
    }

    // === PHASE 4: IDLE ===
    // Stay near center when nothing else to do

    const centerX = COLS / 2;
    if (playerGridX < centerX - 2) {
      // Check it's safe to move right
      if (this.isSafeFromPiece(playerGridX + 1, dropDist)) {
        keys.right = true;
      }
    } else if (playerGridX > centerX + 2) {
      // Check it's safe to move left
      if (this.isSafeFromPiece(playerGridX - 1, dropDist)) {
        keys.left = true;
      }
    }

    return keys;
  }
}

function runPlayerSimulation() {
  console.log(`Simulating ${numGames} games with player on '${difficulty}' difficulty...`);

  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < numGames; i++) {
    // Disable godMode for player simulation - we want real death/win conditions
    const engine = createEngine(false);
    engine.start();
    engine.selectDifficulty(difficulty);

    const simPlayer = new SimulatedPlayer(engine);

    const dt = 0.016; // ~60fps for realistic physics
    let totalTime = 0;
    const MAX_TIME = 300;

    let deathCause = null;
    let maxHeightReached = 0;

    while (engine.status === "playing" && totalTime < MAX_TIME) {
      // Get simulated player input and convert to engine key format
      const simKeys = simPlayer.decide();
      const keys = {
        ArrowLeft: simKeys.left,
        ArrowRight: simKeys.right,
        ArrowUp: simKeys.jump,
      };
      engine.update(dt, { keys });
      totalTime += dt;

      // Track max height player reached
      if (engine.player) {
        const playerY = engine.player.y;
        const heightInRows = (engine.height - playerY) / engine.constants.CELL_SIZE;
        maxHeightReached = Math.max(maxHeightReached, heightInRows);
      }

      // Check for death
      if (engine.player && engine.player.dead) {
        if (engine.player.killedByLine) {
          deathCause = "line-clear";
        } else {
          deathCause = "crushed";
        }
        break;
      }
    }

    // Determine outcome
    // Note: player.dead might be set before engine.status changes (e.g., setTimeout in line clear death)
    let outcome = "timeout";
    if (engine.status === "win") {
      outcome = "escaped";
    } else if (engine.status === "gameover" || (engine.player && engine.player.dead)) {
      outcome = deathCause || "crushed";
    } else if (totalTime >= MAX_TIME) {
      outcome = "timeout";
    }

    // Get final board height
    let finalHeight = 0;
    for (let y = 0; y < engine.constants.ROWS; y++) {
      if (engine.grid[y].some((c) => c !== null)) {
        finalHeight = engine.constants.ROWS - y;
        break;
      }
    }

    results.push({
      outcome,
      time: engine.stats.time,
      simTime: totalTime,
      lines: engine.stats.linesCleared,
      pieces: engine.stats.pieceCount,
      finalHeight,
      maxHeightReached: Math.floor(maxHeightReached),
      disruptions: simPlayer.stats.disruptions,
      nearDeaths: simPlayer.stats.nearDeaths,
      escapeAttempts: simPlayer.stats.escapeAttempts,
    });

    if ((i + 1) % 10 === 0) process.stdout.write(".");
  }

  console.log("\n");
  const totalTime = (Date.now() - startTime) / 1000;

  // Calculate statistics
  const escaped = results.filter((r) => r.outcome === "escaped");
  const crushed = results.filter((r) => r.outcome === "crushed");
  const lineClearDeaths = results.filter((r) => r.outcome === "line-clear");
  const gameovers = results.filter((r) => r.outcome === "gameover");
  const timeouts = results.filter((r) => r.outcome === "timeout");

  const escapeRate = (escaped.length / numGames) * 100;
  const avgEscapeTime = escaped.length > 0 ? escaped.reduce((s, r) => s + r.time, 0) / escaped.length : 0;
  const avgLines = results.reduce((s, r) => s + r.lines, 0) / numGames;
  const avgFinalHeight = results.reduce((s, r) => s + r.finalHeight, 0) / numGames;
  const avgMaxHeight = results.reduce((s, r) => s + r.maxHeightReached, 0) / numGames;
  const avgDisruptions = results.reduce((s, r) => s + r.disruptions, 0) / numGames;
  const avgNearDeaths = results.reduce((s, r) => s + r.nearDeaths, 0) / numGames;

  console.log("=== Player Simulation Results ===");
  console.log(`Difficulty: ${difficulty}`);
  console.log(`Games Played: ${numGames}`);
  console.log(`Total Real Time: ${totalTime.toFixed(2)}s`);
  console.log("");
  console.log("--- Outcomes ---");
  console.log(`Escaped: ${escaped.length} (${escapeRate.toFixed(1)}%)`);
  console.log(`Crushed: ${crushed.length} (${((crushed.length / numGames) * 100).toFixed(1)}%)`);
  console.log(
    `Line-Clear Death: ${lineClearDeaths.length} (${((lineClearDeaths.length / numGames) * 100).toFixed(1)}%)`
  );
  console.log(`Game Over: ${gameovers.length} (${((gameovers.length / numGames) * 100).toFixed(1)}%)`);
  console.log(`Timeout: ${timeouts.length} (${((timeouts.length / numGames) * 100).toFixed(1)}%)`);
  console.log("");
  console.log("--- Overall Performance ---");
  console.log(`Average Lines Cleared: ${avgLines.toFixed(2)}`);
  console.log(`Average Final Board Height: ${avgFinalHeight.toFixed(2)} rows`);
  console.log(`Average Max Height Reached: ${avgMaxHeight.toFixed(2)} rows`);
  console.log(`Average Disruptions (AI retargets): ${avgDisruptions.toFixed(2)}`);
  console.log(`Average Near-Death Escapes: ${avgNearDeaths.toFixed(2)}`);

  // Show stats broken down by outcome
  if (escaped.length > 0) {
    const avgEscapeLines = escaped.reduce((s, r) => s + r.lines, 0) / escaped.length;
    const avgEscapeHeight = escaped.reduce((s, r) => s + r.finalHeight, 0) / escaped.length;
    const avgEscapeDisruptions = escaped.reduce((s, r) => s + r.disruptions, 0) / escaped.length;
    const fastestEscape = Math.min(...escaped.map((r) => r.time));
    const slowestEscape = Math.max(...escaped.map((r) => r.time));
    console.log("");
    console.log("--- Escaped Games ---");
    console.log(
      `  Avg Time: ${avgEscapeTime.toFixed(2)}s (${fastestEscape.toFixed(2)}s - ${slowestEscape.toFixed(2)}s)`
    );
    console.log(`  Avg Lines Cleared: ${avgEscapeLines.toFixed(2)}`);
    console.log(`  Avg Final Height: ${avgEscapeHeight.toFixed(2)} rows`);
    console.log(`  Avg Disruptions: ${avgEscapeDisruptions.toFixed(2)}`);
  }

  if (crushed.length > 0) {
    const avgCrushedTime = crushed.reduce((s, r) => s + r.time, 0) / crushed.length;
    const avgCrushedLines = crushed.reduce((s, r) => s + r.lines, 0) / crushed.length;
    const avgCrushedHeight = crushed.reduce((s, r) => s + r.finalHeight, 0) / crushed.length;
    const avgCrushedMaxHeight = crushed.reduce((s, r) => s + r.maxHeightReached, 0) / crushed.length;
    const avgCrushedDisruptions = crushed.reduce((s, r) => s + r.disruptions, 0) / crushed.length;
    console.log("");
    console.log("--- Crushed Games ---");
    console.log(`  Avg Time: ${avgCrushedTime.toFixed(2)}s`);
    console.log(`  Avg Lines Cleared: ${avgCrushedLines.toFixed(2)}`);
    console.log(`  Avg Final Height: ${avgCrushedHeight.toFixed(2)} rows`);
    console.log(`  Avg Max Height Reached: ${avgCrushedMaxHeight.toFixed(2)} rows`);
    console.log(`  Avg Disruptions: ${avgCrushedDisruptions.toFixed(2)}`);
  }

  if (lineClearDeaths.length > 0) {
    const avgLineClearTime = lineClearDeaths.reduce((s, r) => s + r.time, 0) / lineClearDeaths.length;
    const avgLineClearLines = lineClearDeaths.reduce((s, r) => s + r.lines, 0) / lineClearDeaths.length;
    const avgLineClearHeight = lineClearDeaths.reduce((s, r) => s + r.finalHeight, 0) / lineClearDeaths.length;
    const avgLineClearMaxHeight = lineClearDeaths.reduce((s, r) => s + r.maxHeightReached, 0) / lineClearDeaths.length;
    const avgLineClearDisruptions = lineClearDeaths.reduce((s, r) => s + r.disruptions, 0) / lineClearDeaths.length;
    console.log("");
    console.log("--- Line-Clear Death Games ---");
    console.log(`  Avg Time: ${avgLineClearTime.toFixed(2)}s`);
    console.log(`  Avg Lines Cleared: ${avgLineClearLines.toFixed(2)}`);
    console.log(`  Avg Final Height: ${avgLineClearHeight.toFixed(2)} rows`);
    console.log(`  Avg Max Height Reached: ${avgLineClearMaxHeight.toFixed(2)} rows`);
    console.log(`  Avg Disruptions: ${avgLineClearDisruptions.toFixed(2)}`);
  }

  if (timeouts.length > 0) {
    const avgTimeoutLines = timeouts.reduce((s, r) => s + r.lines, 0) / timeouts.length;
    const avgTimeoutHeight = timeouts.reduce((s, r) => s + r.finalHeight, 0) / timeouts.length;
    const avgTimeoutMaxHeight = timeouts.reduce((s, r) => s + r.maxHeightReached, 0) / timeouts.length;
    const avgTimeoutDisruptions = timeouts.reduce((s, r) => s + r.disruptions, 0) / timeouts.length;
    const avgTimeoutPieces = timeouts.reduce((s, r) => s + r.pieces, 0) / timeouts.length;
    const avgTimeoutEngineTime = timeouts.reduce((s, r) => s + r.time, 0) / timeouts.length;
    const avgTimeoutSimTime = timeouts.reduce((s, r) => s + r.simTime, 0) / timeouts.length;
    console.log("");
    console.log("--- Timeout Games ---");
    console.log(`  Avg Sim Time: ${avgTimeoutSimTime.toFixed(2)}s`);
    console.log(`  Avg Engine Time: ${avgTimeoutEngineTime.toFixed(2)}s`);
    console.log(`  Avg Pieces Placed: ${avgTimeoutPieces.toFixed(2)}`);
    console.log(`  Avg Lines Cleared: ${avgTimeoutLines.toFixed(2)}`);
    console.log(`  Avg Final Height: ${avgTimeoutHeight.toFixed(2)} rows`);
    console.log(`  Avg Max Height Reached: ${avgTimeoutMaxHeight.toFixed(2)} rows`);
    console.log(`  Avg Disruptions: ${avgTimeoutDisruptions.toFixed(2)}`);
  }
}

function runSimulation() {
  console.log(`Simulating ${numGames} games on '${difficulty}' difficulty...`);

  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < numGames; i++) {
    const engine = createEngine();
    engine.start();
    engine.selectDifficulty(difficulty);

    const dt = 0.05;
    let totalTime = 0;
    const MAX_TIME = 300;

    while (engine.status === "playing" && totalTime < MAX_TIME) {
      engine.update(dt, { keys: {} });
      totalTime += dt;
    }

    let maxHeight = 0;
    for (let y = 0; y < engine.constants.ROWS; y++) {
      if (engine.grid[y].some((c) => c !== null)) {
        maxHeight = engine.constants.ROWS - y;
        break;
      }
    }

    results.push({
      lines: engine.stats.linesCleared,
      time: engine.stats.time,
      pieces: engine.stats.pieceCount,
      maxHeight: maxHeight,
      result: engine.status,
    });

    if ((i + 1) % 10 === 0) process.stdout.write(".");
  }

  console.log("\n");
  const totalTime = (Date.now() - startTime) / 1000;

  const avgLines = results.reduce((sum, r) => sum + r.lines, 0) / numGames;
  const avgHeight = results.reduce((sum, r) => sum + r.maxHeight, 0) / numGames;
  const avgDuration = results.reduce((sum, r) => sum + r.time, 0) / numGames;
  const maxLines = Math.max(...results.map((r) => r.lines));
  const maxHeight = Math.max(...results.map((r) => r.maxHeight));
  const minHeight = Math.min(...results.map((r) => r.maxHeight));

  console.log("--- Simulation Results ---");
  console.log(`Difficulty: ${difficulty}`);
  console.log(`Games Played: ${numGames}`);
  console.log(`Total Real Time: ${totalTime.toFixed(2)}s`);
  console.log(`Average Lines Cleared: ${avgLines.toFixed(2)}`);
  console.log(`Average Max Height: ${avgHeight.toFixed(2)} (Rows)`);
  console.log(`Average Game Duration: ${avgDuration.toFixed(2)}s`);
  console.log(`Max Lines in a Game: ${maxLines}`);
  console.log(`Max Height in a Game: ${maxHeight}`);
  console.log(`Min Height in a Game: ${minHeight}`);
}

function analyzeState() {
  console.log(`Loading state from: ${stateFile}`);

  let stateData;
  try {
    const content = fs.readFileSync(stateFile, "utf-8");
    stateData = JSON.parse(content);
  } catch (e) {
    console.error(`Failed to load state file: ${e.message}`);
    process.exit(1);
  }

  global.TE_DEBUG_AI = true;

  const engine = createEngine();
  engine.start();

  if (!engine.loadState(stateData)) {
    console.error("Failed to load state into engine");
    process.exit(1);
  }

  console.log("\n=== STATE LOADED ===");
  console.log(`Difficulty: ${engine.settings.difficulty}`);
  console.log(`Player position: (${engine.player?.x.toFixed(1)}, ${engine.player?.y.toFixed(1)})`);

  if (engine.currentPiece) {
    console.log(
      `Current piece: ${engine.currentPiece.type} at (${engine.currentPiece.x}, ${engine.currentPiece.y}) rotation ${engine.currentPiece.rotation}`
    );
  }

  const diffConfig = engine.settings.diffConfig;
  const margin = diffConfig.dangerZoneMargin;
  const playerGridX = Math.floor(engine.player.x / engine.constants.CELL_SIZE);
  const playerGridLeft = Math.floor(engine.player.x / engine.constants.CELL_SIZE - margin);
  const playerGridRight = Math.ceil(
    (engine.player.x + engine.constants.PLAYER_WIDTH) / engine.constants.CELL_SIZE + margin
  );

  console.log(`Player grid X: ${playerGridX}`);
  console.log(`Danger zone: columns ${playerGridLeft} to ${playerGridRight - 1} (margin: ${margin})`);

  console.log("\n=== AI TARGET CALCULATION ===");
  engine.ai.calculateTarget(null, true);

  if (engine.ai.lastBFSCandidates) {
    const sorted = [...engine.ai.lastBFSCandidates].sort((a, b) => b.finalScore - a.finalScore);

    console.log(`\nTotal positions evaluated: ${sorted.length}`);
    console.log("\nTop 10 candidates:");
    console.log("─".repeat(80));
    console.log("Rank │ Position      │ Rot │ Base Score │ DZ Penalty │ Final Score │ In DZ");
    console.log("─".repeat(80));

    for (let i = 0; i < Math.min(10, sorted.length); i++) {
      const c = sorted[i];
      const dzPenalty = c.inDangerZone ? diffConfig.dangerZoneReward : 0;
      console.log(
        `${String(i + 1).padStart(4)} │ (${String(c.x).padStart(2)}, ${String(c.y).padStart(2)})       │  ${
          c.rotation
        }  │ ${String(c.baseScore.toFixed(0)).padStart(10)} │ ${String(dzPenalty.toFixed(0)).padStart(10)} │ ${String(
          c.finalScore.toFixed(0)
        ).padStart(11)} │ ${c.inDangerZone ? "YES" : "no"}`
      );
    }
    console.log("─".repeat(80));

    const safeCandidates = sorted.filter((c) => !c.inDangerZone);
    console.log(`\nPositions outside danger zone: ${safeCandidates.length}`);

    if (safeCandidates.length > 0) {
      console.log("\nTop 5 safe positions:");
      for (let i = 0; i < Math.min(5, safeCandidates.length); i++) {
        const c = safeCandidates[i];
        console.log(`  (${c.x}, ${c.y}) rot=${c.rotation} score=${c.finalScore.toFixed(0)}`);
      }
    }

    const byRotation = {};
    for (const c of sorted) {
      if (!byRotation[c.rotation]) byRotation[c.rotation] = [];
      byRotation[c.rotation].push(c);
    }

    console.log("\nCandidates by rotation:");
    for (const [rot, candidates] of Object.entries(byRotation)) {
      const safe = candidates.filter((c) => !c.inDangerZone).length;
      const best = candidates[0];
      console.log(
        `  Rotation ${rot}: ${candidates.length} positions (${safe} safe), best: (${best.x}, ${
          best.y
        }) score=${best.finalScore.toFixed(0)}`
      );
    }

    // Detailed breakdown for top candidates
    console.log("\n=== SCORE BREAKDOWN (Top 3 + Best Safe) ===");
    const toAnalyze = sorted.slice(0, 3);
    const bestSafe = safeCandidates[0];
    if (bestSafe && !toAnalyze.includes(bestSafe)) toAnalyze.push(bestSafe);

    for (const c of toAnalyze) {
      if (!c.breakdown) continue;
      const b = c.breakdown;
      const tag = c === bestSafe ? " [BEST SAFE]" : c === sorted[0] ? " [SELECTED]" : "";
      console.log(`\n(${c.x}, ${c.y}) rot=${c.rotation}${tag}:`);
      console.log(`  Heights: [${b.heights.join(", ")}]`);
      console.log(`  Funnel: leftValidUntil=${b.funnelInfo?.leftValid}, rightValidUntil=${b.funnelInfo?.rightValid}`);
      console.log(`  Raw metrics: holes=${b.rawHoles}, coveredHoles=${b.rawCoveredHoles}, bumpiness=${b.rawBumpiness}`);
      console.log(`  Score components:`);
      console.log(`    lines:       ${String(b.lines).padStart(8)}`);
      console.log(`    holes:       ${String(b.holes).padStart(8)} (${b.rawHoles} holes × reward)`);
      console.log(`    coveredHoles:${String(b.coveredHoles).padStart(8)} (${b.rawCoveredHoles} covered × reward)`);
      console.log(`    height:      ${String(b.height).padStart(8)}`);
      console.log(`    maxHeight:   ${String(b.maxHeight).padStart(8)}`);
      console.log(`    danger:      ${String(b.danger).padStart(8)} (near-top penalty)`);
      console.log(`    bumpiness:   ${String(b.bumpiness).padStart(8)} (${b.rawBumpiness} raw × reward)`);
      console.log(`    terrain:     ${String(b.terrain).padStart(8)}`);
      if (b.funnelInfo?.cliffs?.length > 0) {
        for (const cliff of b.funnelInfo.cliffs) {
          console.log(
            `      └─ cliff@${cliff.x}-${cliff.x + 1}: diff=${cliff.heightDiff}, ${
              cliff.isValidFunnel ? "funnel" : "SPLIT"
            }, penalty=${cliff.penalty}`
          );
        }
      }
      console.log(`    edge:        ${String(b.edge).padStart(8)}`);
      console.log(`    floating:    ${String(b.floating).padStart(8)}`);
      console.log(`    ─────────────────────`);
      console.log(`    TOTAL:       ${String(b.total).padStart(8)}`);
    }
  }

  console.log(`\n=== SELECTED TARGET ===`);
  if (engine.ai.target) {
    console.log(`Target: (${engine.ai.target.x}, ${engine.ai.target.y}) rotation ${engine.ai.target.rotation}`);
    console.log(`Target score: ${engine.ai.targetScore?.toFixed(0) ?? "N/A"}`);
  } else {
    console.log("No target selected!");
  }

  if (stepCount > 0) {
    console.log(`\n=== STEPPING ${stepCount} AI MOVES ===`);
    for (let i = 0; i < stepCount; i++) {
      const beforeX = engine.currentPiece?.x;
      const beforeY = engine.currentPiece?.y;
      const beforeRot = engine.currentPiece?.rotation;

      engine.ai.update();

      const afterX = engine.currentPiece?.x;
      const afterY = engine.currentPiece?.y;
      const afterRot = engine.currentPiece?.rotation;

      if (beforeX !== afterX || beforeY !== afterY || beforeRot !== afterRot) {
        console.log(`Step ${i + 1}: (${beforeX}, ${beforeY}) r${beforeRot} → (${afterX}, ${afterY}) r${afterRot}`);
      } else {
        console.log(`Step ${i + 1}: no change (waiting for gravity or path complete)`);
      }
    }
  }

  console.log("\n=== GRID STATE ===");
  printGrid(engine);
}

function printGrid(engine) {
  const grid = engine.grid;
  const piece = engine.currentPiece;
  const target = engine.ai.target;
  const player = engine.player;

  const playerGridX = player ? Math.floor(player.x / engine.constants.CELL_SIZE) : -1;
  const playerGridY = player ? Math.floor(player.y / engine.constants.CELL_SIZE) : -1;

  console.log("   0123456789");
  console.log("  ┌──────────┐");

  for (let y = 0; y < engine.constants.ROWS; y++) {
    let row = `${String(y).padStart(2)}│`;
    for (let x = 0; x < engine.constants.COLS; x++) {
      let char = "·";

      if (grid[y][x]) char = "█";

      if (piece) {
        const px = x - piece.x;
        const py = y - piece.y;
        if (px >= 0 && py >= 0 && py < piece.shape.length && px < piece.shape[py].length && piece.shape[py][px]) {
          char = "▓";
        }
      }

      if (target && piece) {
        const shape = getShape(piece.type, target.rotation);
        const tx = x - target.x;
        const ty = y - target.y;
        if (shape && tx >= 0 && ty >= 0 && ty < shape.length && tx < shape[ty].length && shape[ty][tx]) {
          char = char === "·" ? "○" : char;
        }
      }

      if (x === playerGridX && (y === playerGridY || y === playerGridY + 1)) {
        char = "P";
      }

      row += char;
    }
    row += "│";
    console.log(row);
  }
  console.log("  └──────────┘");
  console.log("\nLegend: █=locked, ▓=piece, ○=target, P=player, ·=empty");
}

// Main
if (mode === "simulate") {
  if (useSimulatedPlayer) {
    runPlayerSimulation();
  } else {
    runSimulation();
  }
} else if (mode === "analyze") {
  analyzeState();
}
