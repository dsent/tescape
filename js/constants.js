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
  DEBUG_AI: true, // Show AI target and score
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
    // Speed and timing
    baseFallTick: 800,
    aiMoveInterval: 300,
    // Fast drop settings
    spawnDropDelay: 2,
    minFastDropHeight: 6,
    minMovesBeforeFastDrop: 3,
    // Line clearing
    lineReward: 1, // Don't reward line clears much
    // Holes
    holeReward: -10, // Mild penalty
    coveredHoleReward: -15, // Higher penalty for covered holes
    // Height
    heightReward: 0, // Don't penalize height much
    maxHeightReward: 0, // No penalty for max height
    // Bumpiness: don't punish uneven terrain too much
    bumpinessReward: -2,
    // Wells: very high penalty to keep terrain climbable
    wellReward: -50,
    // Cliffs: very high penalty
    cliffReward: -50,
    // Avoiding player
    dangerZoneMargin: 1.0,
    dangerZoneReward: -1000,
    dangerZoneDecay: 1.0, // Never decays - always avoids player
    // Can the player complete lines?
    playerCompletesLine: false,
    lineClearDelay: 800,
    // Sabotage settings
    sabotageDuration: 1.5,
    sabotageCooldown: 3.0,
  },
  normal: {
    // Speed and timing
    baseFallTick: 600,
    aiMoveInterval: 115,
    // Fast drop settings
    spawnDropDelay: 2,
    minFastDropHeight: 4,
    minMovesBeforeFastDrop: 3,
    // Line clearing: slight preference to clear, but not aggressive
    lineReward: 20,
    // Holes: moderate penalty
    holeReward: -40,
    coveredHoleReward: -15,
    // Height: slight penalty
    heightReward: -1,
    maxHeightReward: -2,
    // Bumpiness: moderate penalty
    bumpinessReward: -4,
    // Wells: high penalty for climbability
    wellReward: -35,
    // Cliffs: high penalty
    cliffReward: -30,
    // Avoiding player
    dangerZoneMargin: 0.8,
    dangerZoneReward: -500,
    dangerZoneDecay: 0.7, // Moderate decay - stops caring after ~3-4 retargets
    // Can the player complete lines?
    playerCompletesLine: false,
    lineClearDelay: 800,
    // Sabotage settings
    sabotageDuration: 1.5,
    sabotageCooldown: 5.0,
  },
  hard: {
    // Speed and timing
    baseFallTick: 450,
    aiMoveInterval: 50,
    // Fast drop settings
    spawnDropDelay: 0,
    minFastDropHeight: 3,
    minMovesBeforeFastDrop: 2,
    // Line clearing: aggressive clearing
    lineReward: 200,
    multiLineBonus: true,
    // Holes: severe penalty
    holeReward: -100,
    coveredHoleReward: -15,
    // Height: penalize to keep stack low
    heightReward: -4,
    maxHeightReward: -5,
    // Bumpiness: high penalty for flat surface (easier to clear)
    bumpinessReward: -10,
    // Wells: moderate penalty (some wells help with Tetrominos)
    wellReward: -15,
    // Cliffs: moderate penalty
    cliffReward: -20,
    // Avoiding player
    dangerZoneMargin: 0.4,
    dangerZoneReward: -75,
    dangerZoneDecay: 0.4, // Aggressive decay - stops caring after ~2 retargets
    // Can the player complete lines?
    playerCompletesLine: true,
    lineClearDelay: 800,
    // Sabotage settings
    sabotageDuration: 2.0,
    sabotageCooldown: 8.0,
  },
};
