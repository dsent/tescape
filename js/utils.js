window.TE = window.TE || {};

/**
 * Helper Functions
 */

window.TE.getShape = function (type, rotation) {
  const shapes = window.TE.TETROMINOES[type].shapes;
  return shapes[rotation % shapes.length];
};

window.TE.getRandomTetrominoType = function () {
  const types = Object.keys(window.TE.TETROMINOES);
  return types[Math.floor(Math.random() * types.length)];
};
