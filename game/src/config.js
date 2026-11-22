// Shared constants for MOTHLIGHT — a lamplight stealth game.
// One place for every number the other files agree on: the field size, the
// tile grid, movement speeds, the vision cone and the detection rates.
export const TILE = 40;
export const COLS = 32;
export const ROWS = 20;
export const FIELD_WIDTH = COLS * TILE; // 1280
export const FIELD_HEIGHT = ROWS * TILE; // 800

export const PLAYER_RADIUS = 13;
export const PLAYER_WALK_SPEED = 175; // px per second
export const PLAYER_SNEAK_SPEED = 95;
export const GUARD_RADIUS = 15;
export const GUARD_PATROL_SPEED = 68;
export const GUARD_CHASE_SPEED = 188;
export const GUARD_SEARCH_SPEED = 112;

export const CONE_RANGE = 235;
export const CONE_HALF_ANGLE = 0.62; // radians, about 35 degrees each side
export const BUSH_HIDE_RANGE = 70; // a guard this close still spots you in a bush

// Detection meter runs 0..100. Rates are per second while the player is
// visible inside a guard's cone; darkness and sneaking slow the rise.
export const DETECT_WALK_RATE = 62;
export const DETECT_SNEAK_RATE = 26;
export const DETECT_DARK_MULTIPLIER = 0.45;
export const DETECT_DECAY_RATE = 30;
export const SUSPICIOUS_AT = 55; // meter value where a guard stops and stares
export const SPOTTED_AT = 100;
export const CHASE_LOSE_TIME = 2.5; // seconds out of sight before a chase ends
export const SEARCH_TIME = 2.4; // seconds a guard hunts the last seen spot

export const LOOT_SCORE = 100;
export const GHOST_BONUS = 500;
export const TIME_BONUS_PER_SECOND = 4;

export const SCREEN_TITLE = 'title';
export const SCREEN_INTRO = 'intro';
export const SCREEN_PLAY = 'play';
export const SCREEN_VICTORY = 'victory';
export const SCREEN_OVER = 'over';

export const GUARD_CALM = 'calm';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_CHASE = 'chase';
export const GUARD_SEARCH = 'search';

// Palette: lamplight on a dark floor. Guards are warm red so they read
// against the blue-grey floor at a glance; cones are lamp-yellow.
export const COLORS = {
  floorA: '#161c28',
  floorB: '#121722',
  darkTile: '#0a0e16',
  wall: '#2b3346',
  wallTop: '#4a5878',
  crate: '#6b4a2b',
  crateEdge: '#8a6238',
  bush: '#1e4d2e',
  bushLeaf: '#2f7a44',
  loot: '#ffd166',
  exit: '#2ee6a8',
  exitDark: '#0d5c40',
  guard: '#d64541',
  guardDark: '#7e1f1c',
  cone: 'rgba(255, 214, 90, 0.28)',
  coneEdge: 'rgba(255, 214, 90, 0.55)',
  player: '#f5f1e6',
  playerWing: '#c9b8ff',
  hud: '#e8e6df',
  dim: '#9aa3b2',
  danger: '#ff5d5d',
  gold: '#ffd166',
};
