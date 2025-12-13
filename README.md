# Tetromino Escape

**Tetromino Escape** is a browser-based game that combines classic block-stacking mechanics with platformer survival. You play as a tiny character trapped inside a Tetromino well. An AI controls the falling blocks, and your goal is to dodge them, climb the debris, and survive as long as possible.

## 🎮 How to Play

Due to ES module CORS restrictions, you need to serve the game via HTTP. You can:

**Option 1: Use Python's built-in server**
```bash
python3 -m http.server 8080
# Then open http://localhost:8080/tetromino-escape.html in your browser
```

**Option 2: Use Node.js http-server**
```bash
npx http-server -p 8080
# Then open http://localhost:8080/tetromino-escape.html in your browser
```

**Option 3: Use any other local web server** (VS Code Live Server, etc.)

### Controls

- **Arrow Left / A**: Move Left
- **Arrow Right / D**: Move Right
- **Arrow Up / W / Space**: Jump
- **S**: Trigger Sabotage (if available)
- **P / Esc**: Pause Game

### Objective

Avoid getting squished by falling blocks or cleared along with a line. Climb the blocks to stay alive!

## ⚙️ Game Mechanics

- **AI Opponent**: The game features an AI that plays Tetromino against you.
  - **Easy Mode**: The AI plays poorly, leaving holes and building high stacks (good for climbing).
  - **Normal Mode**: Balanced gameplay.
  - **Hard Mode**: The AI plays efficiently, clearing lines aggressively and keeping the stack low (harder to survive).
- **Sabotage**: A mechanic that allows you to temporarily disrupt the AI's decision-making.

## 🛠️ Development & Simulation

The project includes a headless simulation script to test the AI's behavior and balance difficulty levels without rendering the graphics.

### Running Simulations

You can run simulations using Node.js:

```bash
node simulate.js [difficulty] [number_of_games]
```

**Examples:**

```bash
# Simulate 100 games on Easy difficulty
node simulate.js easy 100

# Simulate 50 games on Hard difficulty
node simulate.js hard 50
```

The simulation outputs statistics such as:

- Average lines cleared
- Average max height reached
- Average game duration

## 📂 Project Structure

The project uses **ES modules** for better code organization and static analysis:

- `tetromino-escape.html`: Main entry point for the game.
- `package.json`: Node.js configuration with ES module support.
- `js/constants.js`: Exports game constants, difficulty settings, and Tetromino definitions.
- `js/utils.js`: Exports utility functions for shape handling.
- `js/input.js`: Exports InputHandler class for keyboard input.
- `js/renderer.js`: Exports GameRenderer class for Canvas 2D rendering.
- `js/ai.js`: Exports AIController class with BFS pathfinding and evaluation logic.
- `js/engine.js`: Exports GameEngine class with core game logic, physics, and collision detection.
- `js/main.js`: Browser entry point that imports and wires up the game.
- `css/style.css`: Styling for the game interface.
- `simulate.js`: Node.js ES module script for running headless simulations and AI analysis.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
