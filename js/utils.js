import { TETROMINOES } from './constants.js';

/**
 * Helper Functions
 */

export function getShape(type, rotation) {
  const shapes = TETROMINOES[type].shapes;
  return shapes[rotation % shapes.length];
}

export function getRandomTetrominoType() {
  const types = Object.keys(TETROMINOES);
  return types[Math.floor(Math.random() * types.length)];
}
