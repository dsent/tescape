# General Instructions — Tetromino Escape

Browser-based survival game: dodge AI-controlled falling Tetromino blocks, climb debris, escape the well.

## Project Brief

- Purpose: Arcade survival game combining block-stacking mechanics with platformer gameplay
- Audience: Browser gamers, casual players
- Tech Stack: Vanilla JavaScript (ES6+), HTML5 Canvas, CSS3; Node.js for headless simulations
- Workflow: Single `main` branch, direct commits

## Repo Structure

- `/js/` - Game modules (ES modules with named exports)
  - `constants.js` - Exports DEFAULT_CONSTANTS, TETROMINOES, and DIFFICULTY_SETTINGS
  - `utils.js` - Exports getShape and getRandomTetrominoType utility functions
  - `input.js` - Exports InputHandler class
  - `renderer.js` - Exports GameRenderer class
  - `ai.js` - Exports AIController class with BFS pathfinding and difficulty-based targeting
  - `engine.js` - Exports GameEngine class with core game loop, physics, collision, line clearing
  - `main.js` - Browser entry point, imports and wires up the game
- `/css/style.css` - Game styling and overlays
- `tetromino-escape.html` - Main entry point (loads main.js as ES module)
- `simulate.js` - Node.js headless simulation script (ES module)
- `package.json` - Node.js package configuration with type:"module"

## Tools and Commands

- Run Game: Serve via HTTP (e.g., `python3 -m http.server 8080`) then open `http://localhost:8080/tetromino-escape.html`
  - ES modules require HTTP/HTTPS protocol (won't work with `file://`)
- Simulate: `node simulate.js [difficulty] [games]` (e.g., `node simulate.js hard 100`)

## Rules

- All JS modules use ES module syntax (import/export)
- Module dependencies are resolved through explicit imports
- Grid is 10 cols × 20 rows; `CELL_SIZE` derived from canvas height
- Difficulty settings in `constants.js` control AI behavior, not just speed
- Player physics: gravity, jump force, terminal velocity in `DEFAULT_CONSTANTS`
- AI uses BFS pathfinding with weighted scoring (holes, height, wells, cliffs, player avoidance)

## Code Style

- Use ES6+ syntax (let/const, arrow functions, classes, template literals)
- Consistent indentation (2 spaces)
- Meaningful variable/function names; document functions with JSDoc
- Modular functions, single responsibility principle
- Comment complex logic; avoid commenting self-explanatory code

## Module System

- Project uses ES modules (import/export) for better static analysis and IDE support
- Browser: All modules loaded via single `<script type="module">` tag in HTML
- Node.js: package.json has `"type": "module"` to enable ES modules
- No build step required; browsers and Node.js natively support ES modules

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
- package.json defines `"type": "module"` for Node.js ES module support
- No npm dependencies - all code is vanilla JavaScript
- Node.js required only for `simulate.js` (uses ES module imports)
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
