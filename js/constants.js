window.TE = window.TE || {};

window.TE.DEFAULT_CONSTANTS = {
  COLS: 10,
  ROWS: 20,
  GRAVITY: 0.6,
  JUMP_FORCE: -13.5,
  MOVE_SPEED: 4,
  TERMINAL_VELOCITY: 15,
  SPAWN_DELAY: 0.3, // seconds
  LINE_HISTORY_WINDOW: 10,
};

window.TE.TETROMINOES = {
  I: { shapes: [[[1, 1, 1, 1]], [[1], [1], [1], [1]]], color: "#00f0f0" },
  O: {
    shapes: [
      [
        [1, 1],
        [1, 1],
      ],
    ],
    color: "#f0f000",
  },
  T: {
    shapes: [
      [
        [0, 1, 0],
        [1, 1, 1],
      ],
      [
        [1, 0],
        [1, 1],
        [1, 0],
      ],
      [
        [1, 1, 1],
        [0, 1, 0],
      ],
      [
        [0, 1],
        [1, 1],
        [0, 1],
      ],
    ],
    color: "#a000f0",
  },
  S: {
    shapes: [
      [
        [0, 1, 1],
        [1, 1, 0],
      ],
      [
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    ],
    color: "#00f000",
  },
  Z: {
    shapes: [
      [
        [1, 1, 0],
        [0, 1, 1],
      ],
      [
        [0, 1],
        [1, 1],
        [1, 0],
      ],
    ],
    color: "#f00000",
  },
  J: {
    shapes: [
      [
        [1, 0, 0],
        [1, 1, 1],
      ],
      [
        [1, 1],
        [1, 0],
        [1, 0],
      ],
      [
        [1, 1, 1],
        [0, 0, 1],
      ],
      [
        [0, 1],
        [0, 1],
        [1, 1],
      ],
    ],
    color: "#0000f0",
  },
  L: {
    shapes: [
      [
        [0, 0, 1],
        [1, 1, 1],
      ],
      [
        [1, 0],
        [1, 0],
        [1, 1],
      ],
      [
        [1, 1, 1],
        [1, 0, 0],
      ],
      [
        [1, 1],
        [0, 1],
        [0, 1],
      ],
    ],
    color: "#f0a000",
  },
};

window.TE.DIFFICULTY_SETTINGS = {
  easy: {
    // Line clearing: actively avoid
    lineReward: -100,
    // Holes: tolerate some holes to build terrain
    holePenalty: 10,
    coveredHolePenalty: 15,
    // Height: actually REWARD height to build up debris
    heightPenalty: -1, // Negative = reward
    maxHeightPenalty: -1,
    // Bumpiness: low penalty allows uneven terrain
    bumpinessPenalty: 2,
    // Wells: very high penalty to keep terrain climbable
    wellPenalty: 50,
    // Cliffs: very high penalty
    cliffPenalty: 50,
    minFastDropHeight: 6,
    dangerZoneMargin: 1.5,
    dangerZonePenalty: 10000,
    aiMoveInterval: 300,
    spawnDropDelay: 3,
    maxRetargets: -1,
    playerCompletesLine: false,
    minMovesBeforeFastDrop: 4,
    sabotageDuration: 1.5,
    sabotageCooldown: 3.0,
    baseFallTick: 800,
    lineClearDelay: 800,
  },
  normal: {
    // Line clearing: slight preference to clear, but not aggressive
    lineReward: 20,
    // Holes: moderate penalty
    holePenalty: 40,
    coveredHolePenalty: 15,
    // Height: slight penalty
    heightPenalty: 1,
    maxHeightPenalty: 2,
    // Bumpiness: moderate penalty
    bumpinessPenalty: 4,
    // Wells: high penalty for climbability
    wellPenalty: 35,
    // Cliffs: high penalty
    cliffPenalty: 30,
    minFastDropHeight: 4,
    dangerZoneMargin: 1.0,
    dangerZonePenalty: 8000,
    aiMoveInterval: 115,
    spawnDropDelay: 2,
    maxRetargets: 3,
    playerCompletesLine: false,
    minMovesBeforeFastDrop: 3,
    sabotageDuration: 1.5,
    sabotageCooldown: 5.0,
    baseFallTick: 600,
    lineClearDelay: 600,
  },
  hard: {
    // Line clearing: aggressive clearing
    lineReward: 200,
    multiLineBonus: true,
    // Holes: severe penalty
    holePenalty: 100,
    coveredHolePenalty: 15,
    // Height: penalize to keep stack low
    heightPenalty: 4,
    maxHeightPenalty: 5,
    // Bumpiness: high penalty for flat surface (easier to clear)
    bumpinessPenalty: 10,
    // Wells: moderate penalty (some wells help with Tetrominos)
    wellPenalty: 15,
    // Cliffs: moderate penalty
    cliffPenalty: 20,
    minFastDropHeight: 3,
    dangerZoneMargin: 0.5,
    dangerZonePenalty: 50,
    aiMoveInterval: 50,
    spawnDropDelay: 0,
    maxRetargets: 1,
    playerCompletesLine: true,
    minMovesBeforeFastDrop: 2,
    sabotageDuration: 2.0,
    sabotageCooldown: 8.0,
    baseFallTick: 450,
    lineClearDelay: 400,
  },
};
