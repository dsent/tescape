const { GameEngine } = require("./js/game.js");

const args = process.argv.slice(2);
const DIFFICULTY = args[0] || "easy";
const NUM_GAMES = parseInt(args[1]) || 100;

console.log(`Simulating ${NUM_GAMES} games on '${DIFFICULTY}' difficulty...`);

function runGame(difficulty) {
  const engine = new GameEngine({
    width: 350,
    height: 700,
    godMode: true, // Player ignores death
    onGameOver: () => {},
    onGameWin: () => {},
    onLineCleared: () => {},
  });

  engine.start();
  engine.selectDifficulty(difficulty);

  // We simulate with a fixed time step
  // To make it faster, we can just process logic.
  // The engine uses dt to advance timers.
  const dt = 0.05; // 50ms simulation step
  let totalTime = 0;
  const MAX_TIME = 300; // 5 minutes max game time to prevent infinite loops

  while (engine.status === "playing" && totalTime < MAX_TIME) {
    // No user input, just AI
    engine.update(dt, { keys: {} });
    totalTime += dt;
  }

  // Calculate max height (debris height)
  // Grid is 20 rows.
  // Find highest block.
  let maxHeight = 0;
  for (let y = 0; y < engine.constants.ROWS; y++) {
    if (engine.grid[y].some((c) => c !== null)) {
      maxHeight = engine.constants.ROWS - y;
      break;
    }
  }

  return {
    lines: engine.stats.linesCleared,
    time: engine.stats.time,
    pieces: engine.stats.pieceCount,
    maxHeight: maxHeight,
    result: engine.status,
  };
}

const results = [];
const startTime = Date.now();

for (let i = 0; i < NUM_GAMES; i++) {
  results.push(runGame(DIFFICULTY));
  if ((i + 1) % 10 === 0) {
    process.stdout.write(".");
  }
}
console.log("\n");

const totalTime = (Date.now() - startTime) / 1000;

// Analysis
const avgLines = results.reduce((sum, r) => sum + r.lines, 0) / NUM_GAMES;
const avgHeight = results.reduce((sum, r) => sum + r.maxHeight, 0) / NUM_GAMES;
const avgDuration = results.reduce((sum, r) => sum + r.time, 0) / NUM_GAMES;
const maxLines = Math.max(...results.map((r) => r.lines));
const maxHeight = Math.max(...results.map((r) => r.maxHeight));
const minHeight = Math.min(...results.map((r) => r.maxHeight));

console.log("--- Simulation Results ---");
console.log(`Difficulty: ${DIFFICULTY}`);
console.log(`Games Played: ${NUM_GAMES}`);
console.log(`Total Real Time: ${totalTime.toFixed(2)}s`);
console.log(`Average Lines Cleared: ${avgLines.toFixed(2)}`);
console.log(`Average Max Height: ${avgHeight.toFixed(2)} (Rows)`);
console.log(`Average Game Duration: ${avgDuration.toFixed(2)}s`);
console.log(`Max Lines in a Game: ${maxLines}`);
console.log(`Max Height in a Game: ${maxHeight}`);
console.log(`Min Height in a Game: ${minHeight}`);
