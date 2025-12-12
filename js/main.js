import { GameEngine } from './engine.js';
import { GameRenderer } from './renderer.js';
import { InputHandler } from './input.js';

document.addEventListener("DOMContentLoaded", () => {
  const CANVAS = document.getElementById("gameCanvas");
  if (!CANVAS) {
    console.error("Canvas element not found. Please ensure the HTML contains an element with id 'gameCanvas'.");
    return;
  }

  const renderer = new GameRenderer(CANVAS);
  const inputHandler = new InputHandler();

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

  // Connect Input Handler
  inputHandler.onPause = togglePause;
  inputHandler.onSabotage = () => game.triggerSabotage();
  inputHandler.onDumpState = () => {
    if (game.status === "playing" || game.status === "paused") {
      const state = game.dumpState();
      console.log("=== GAME STATE DUMP ===");
      console.log(JSON.stringify(state, null, 2));
      console.log("=== Copy the JSON above to use with simulate.js ===");
      // Also copy to clipboard if available
      if (navigator.clipboard) {
        navigator.clipboard
          .writeText(JSON.stringify(state, null, 2))
          .then(() => console.log("State copied to clipboard!"))
          .catch(() => console.log("Could not copy to clipboard"));
      }
    }
  };

  // --- UI FUNCTIONS ---

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
      // Reset lastTime to prevent huge dt jump
      lastTime = performance.now();
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

  // --- EVENT LISTENERS ---

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

  // --- MAIN LOOP ---

  let lastTime = 0;
  function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    game.update(dt, inputHandler);
    updateUI();
    renderer.draw(game);

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
});
