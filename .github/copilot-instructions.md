# General Instructions — Tetromino Escape

Browser-based survival game: dodge AI-controlled falling Tetromino blocks, climb debris, escape the well.

## Project Brief

- Purpose: Arcade survival game combining block-stacking mechanics with platformer gameplay
- Audience: Browser gamers, casual players
- Tech Stack: Vanilla JavaScript (ES6+), HTML5 Canvas, CSS3; Node.js for headless simulations
- Workflow: Single `main` branch, direct commits

## Repo Structure

- `/js/` - Game modules (all use `window.TE` namespace)
  - `constants.js` - Config, tetromino shapes, difficulty settings
  - `engine.js` - Core game loop, physics, collision, line clearing
  - `ai.js` - AIController with BFS pathfinding and difficulty-based targeting
  - `renderer.js` - Canvas 2D drawing
  - `input.js` - Keyboard input handling
  - `utils.js` - Helper functions
  - `main.js` - Browser entry point, UI wiring
- `/css/style.css` - Game styling and overlays
- `tetromino-escape.html` - Main entry point (loads scripts in order)
- `simulate.js` - Node.js headless simulation script

## Tools and Commands

- Run Game: Open `tetromino-escape.html` in browser
- Simulate: `node simulate.js [difficulty] [games]` (e.g., `node simulate.js hard 100`)

## Rules

- All JS modules attach to `window.TE` namespace; maintain this pattern
- Script load order matters: `constants.js` → `utils.js` → `ai.js` → `engine.js` → `renderer.js` → `input.js` → `main.js`
- Grid is 10 cols × 20 rows; `CELL_SIZE` derived from canvas height
- Difficulty settings in `constants.js` control AI behavior, not just speed
- Player physics: gravity, jump force, terminal velocity in `DEFAULT_CONSTANTS`
- AI uses BFS pathfinding with weighted scoring (holes, height, wells, cliffs, player avoidance)

## Known Issues

- `simulate.js` imports from `./js/game.js` which doesn't exist; simulation may need updating
- No build system; manual script ordering required

## User Interactions

- Be concise
- Preserve existing code style (2-space indent, semicolons)
