window.TE = window.TE || {};

window.TE.DEFAULT_CONSTANTS = {
  COLS: 10,
  ROWS: 20,
  GRAVITY: 0.6,
  JUMP_FORCE: -12.5, // Max jump ~3.6 cells (can't climb 4-cell cliffs)
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
    coveredHoleReward: 0, // Extra penalty for blocks above holes
    // Height
    heightReward: 0, // Don't penalize height much
    maxHeightReward: 0, // No penalty for max height
    // Bumpiness: don't punish uneven terrain too much
    bumpinessReward: -1,
    // Terrain traversability (funnel-based)
    // Penalty for >=4 height cliffs in valid funnel pattern (scaled by distance from edge)
    funnelPenaltyBase: -30,
    // Prohibitive penalty for cliffs that split the field (break funnel pattern)
    splitPenalty: -1000,
    // Avoiding player
    dangerZoneMargin: 0.75,
    dangerZoneReward: -500,
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
    coveredHoleReward: 0,
    // Height: slight penalty
    heightReward: -1,
    maxHeightReward: -2,
    // Bumpiness: moderate penalty
    bumpinessReward: -5,
    // Terrain traversability (funnel-based)
    funnelPenaltyBase: -20,
    splitPenalty: -500,
    // Avoiding player
    dangerZoneMargin: 0.5,
    dangerZoneReward: -250,
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
    coveredHoleReward: 0,
    // Height: penalize to keep stack low
    heightReward: -4,
    maxHeightReward: -5,
    // Bumpiness: high penalty for flat surface (easier to clear)
    bumpinessReward: -20,
    // Terrain traversability (funnel-based) - less important on hard
    funnelPenaltyBase: -10,
    splitPenalty: -250,
    // Avoiding player
    dangerZoneMargin: 0.25,
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
