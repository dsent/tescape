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

## Code Style

- Use ES6+ syntax (let/const, arrow functions, classes, template literals)
- Consistent indentation (2 spaces)

## Known Issues

- No build system; manual script ordering required in HTML file

## Testing and Validation

- No formal test framework; manual testing required
- Browser Testing: Open `tetromino-escape.html` in a browser and verify gameplay
- Headless Simulation: Use `node simulate.js [difficulty] [games]` to test AI behavior and game mechanics
- Check console for errors in both browser and Node.js environments
- Validate all three difficulty levels (easy, normal, hard) after gameplay changes
- Test player controls: arrow keys, WASD, space, S (sabotage), P/Esc (pause)

## Development Workflow

- Make minimal, focused changes to address specific issues
- Test browser gameplay after UI or game logic changes
- Run simulations after AI or engine changes to verify behavior
- Check that all scripts load in correct order (see script tags in HTML)
- Verify no JavaScript errors in browser console

## Dependencies and Build

- Vanilla JavaScript project with no build step required
- No package.json or npm dependencies for browser game
- Node.js required only for `simulate.js` (uses CommonJS require)
- No transpilation or bundling - edit files directly

## Security Considerations

- No external API calls or network requests in game code
- No user data storage (localStorage/sessionStorage not used)
- All game state is ephemeral and client-side only
- Canvas rendering is safe from XSS (no DOM manipulation of user input)

## User Chat Interactions

- Be concise in explanations
- Be sceptical and question your tasks:
  - Verify against project goals and best practices
  - Ask clarifying questions if requirements are ambiguous  
  - Suggest improvements or alternatives when appropriate
  - Speak up if something seems off
