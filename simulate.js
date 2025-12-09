/**
 * Tetromino Escape - Headless Simulation and Debug Tool
 *
 * Usage:
 *   node simulate.js [difficulty] [games]     - Run simulation
 *   node simulate.js --state <file.json>      - Load state and analyze AI decision
 *   node simulate.js --state <file.json> --step [n]  - Step through n AI moves
 *
 * Examples:
 *   node simulate.js easy 100
 *   node simulate.js --state dump.json
 *   node simulate.js --state dump.json --step 5
 */

// Minimal DOM shim for Node.js
global.window = global;
global.document = { addEventListener: () => {} };

// Load game modules
require("./js/constants.js");
require("./js/utils.js");
require("./js/ai.js");
require("./js/engine.js");

const fs = require("fs");

// Parse command line arguments
const args = process.argv.slice(2);
let mode = "simulate";
let stateFile = null;
let stepCount = 1;
let difficulty = "easy";
let numGames = 100;

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
  } else if (!args[i].startsWith("--")) {
    if (isNaN(parseInt(args[i]))) {
      difficulty = args[i];
    } else {
      numGames = parseInt(args[i]);
    }
  }
}

// Patch AIController to add BFS logging
const OriginalAIController = window.TE.AIController;
window.TE.AIController = class DebugAIController extends OriginalAIController {
  // Detailed score breakdown for analysis
  evaluatePositionDetailed(piece, shape, diffConfig) {
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

    const breakdown = {
      lines: 0,
      holes: 0,
      coveredHoles: 0,
      height: 0,
      maxHeight: 0,
      bumpiness: 0,
      terrain: 0,
      edge: 0,
      floating: 0,
      danger: 0,
    };
    const diff = diffConfig;
    const COLS = this.engine.constants.COLS;
    const MID = Math.floor(COLS / 2);

    let completedLines = 0;
    for (let y = 0; y < this.engine.constants.ROWS; y++) {
      if (tempGrid[y].every((c) => c)) completedLines++;
    }
    breakdown.lines = completedLines * diff.lineReward;

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
      let blockFound = false,
        blocksAbove = 0;
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
    breakdown.holes = holes * diff.holeReward;
    breakdown.coveredHoles = coveredHoles * diff.coveredHoleReward;

    breakdown.height = heights.reduce((a, b) => a + b, 0) * diff.heightReward;
    breakdown.maxHeight = Math.max(...heights) * diff.maxHeightReward;

    const maxBoardHeight = Math.max(...heights);
    if (maxBoardHeight >= this.engine.constants.ROWS - 2) breakdown.danger = -100000;
    else if (maxBoardHeight >= this.engine.constants.ROWS - 4) breakdown.danger = -20000;

    let bumpiness = 0;
    for (let x = 0; x < COLS - 1; x++) bumpiness += Math.abs(heights[x] - heights[x + 1]);
    breakdown.bumpiness = bumpiness * diff.bumpinessReward;

    // Funnel-based terrain check
    let leftFunnelValidUntil = 0;
    for (let x = 1; x < COLS; x++) {
      if (heights[x] <= heights[x - 1]) leftFunnelValidUntil = x;
      else break;
    }
    let rightFunnelValidUntil = COLS - 1;
    for (let x = COLS - 2; x >= 0; x--) {
      if (heights[x] <= heights[x + 1]) rightFunnelValidUntil = x;
      else break;
    }

    breakdown.funnelInfo = { leftValid: leftFunnelValidUntil, rightValid: rightFunnelValidUntil, cliffs: [] };
    let terrainPenalty = 0;

    for (let x = 0; x < COLS - 1; x++) {
      const heightDiff = Math.abs(heights[x] - heights[x + 1]);
      if (heightDiff < 4) continue;

      const higherCol = heights[x] > heights[x + 1] ? x : x + 1;
      const lowerCol = heights[x] > heights[x + 1] ? x + 1 : x;
      let isValidFunnel = false;

      if (higherCol <= MID) {
        if (higherCol < lowerCol && leftFunnelValidUntil >= lowerCol) isValidFunnel = true;
      } else {
        if (higherCol > lowerCol && rightFunnelValidUntil <= lowerCol) isValidFunnel = true;
      }

      const distFromEdge = Math.min(higherCol, COLS - 1 - higherCol);
      let penalty;
      if (isValidFunnel) {
        penalty = diff.funnelPenaltyBase * Math.pow(2, distFromEdge);
      } else {
        penalty = diff.splitPenalty;
      }
      terrainPenalty += penalty;
      breakdown.funnelInfo.cliffs.push({ x, heightDiff, higherCol, isValidFunnel, distFromEdge, penalty });
    }
    breakdown.terrain = terrainPenalty;

    const minEdge = Math.min(heights[0], heights[COLS - 1]);
    breakdown.edge = (10 - minEdge) * 3;

    const pieceBottom = piece.y + shape.length;
    if (pieceBottom < 4) breakdown.floating = -(4 - pieceBottom) * 30;

    breakdown.total = Object.values(breakdown)
      .filter((v) => typeof v === "number")
      .reduce((a, b) => a + b, 0);
    breakdown.heights = heights;
    breakdown.rawHoles = holes;
    breakdown.rawCoveredHoles = coveredHoles;
    breakdown.rawBumpiness = bumpiness;

    return breakdown;
  }

  calculateTarget(overrideConfig = null, avoidPlayer = false, playerTriggered = false) {
    if (global.TE_DEBUG_AI) {
      this.lastBFSCandidates = [];
      const originalEvaluate = this.evaluatePosition.bind(this);

      this.evaluatePosition = (piece, shape, diffConfig) => {
        const score = originalEvaluate(piece, shape, diffConfig);
        const breakdown = this.evaluatePositionDetailed(piece, shape, diffConfig);
        this.lastBFSCandidates.push({
          x: piece.x,
          y: piece.y,
          rotation: piece.rotation,
          baseScore: score,
          breakdown: breakdown,
        });
        return score;
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
          const shape = window.TE.getShape(pieceType, cand.rotation);
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
};

function createEngine() {
  return new window.TE.GameEngine({
    width: 350,
    height: 700,
    godMode: true,
    onGameOver: () => {},
    onGameWin: () => {},
    onLineCleared: () => {},
  });
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
        const shape = window.TE.getShape(piece.type, target.rotation);
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
  runSimulation();
} else if (mode === "analyze") {
  analyzeState();
}
