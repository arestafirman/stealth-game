// The game's rules and state, with no drawing and no browser in it: the
// player, the guards, the detection meter, loot, the exit, levels, score and
// the ghost rating. step() advances one fixed step and returns what happened
// as bit flags, so the caller can react without the world knowing about
// screens or sound. Everything here is deterministic for a given seed.
import {
  CHASE_LOSE_TIME,
  DETECT_DARK_MULTIPLIER,
  DETECT_DECAY_RATE,
  DETECT_SNEAK_RATE,
  DETECT_WALK_RATE,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  GHOST_BONUS,
  GUARD_CHASE,
  LOOT_SCORE,
  PLAYER_RADIUS,
  PLAYER_SNEAK_SPEED,
  PLAYER_WALK_SPEED,
  SPOTTED_AT,
  TILE,
  TIME_BONUS_PER_SECOND,
} from './config.js';
import { LEVELS, isDarkTile, parseLevel, tileAtPixel } from './levels.js';
import { createGuard, guardSeesPlayer, stepGuard } from './guards.js';

export const EVENT_LOOT = 1;
export const EVENT_SPOTTED = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_EXIT = 8;
export const EVENT_VICTORY = 16;
export const EVENT_LEVEL = 32;

export const STEP = 1 / 60;

function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function createWorld(rng) {
  const state = {
    levelIndex: 0,
    levelName: '',
    levelSubtitle: '',
    grid: [],
    player: { x: 0, y: 0, facing: 0, moving: false, sneaking: false },
    guards: [],
    loot: [],
    lootTotal: 0,
    lootTotalAll: LEVELS.reduce((sum, def) => sum + def.map.join('').split('L').length - 1, 0),
    lootGot: 0,
    exit: { x: 0, y: 0 },
    meter: 0,
    status: 'HIDDEN',
    score: 0,
    elapsed: 0,
    levelElapsed: 0,
    everSpotted: false,
    timesSpotted: 0,
    finished: false,
    caught: false,
    rating: '',
    seed: 0,
  };

  function loadLevel(index) {
    const def = LEVELS[index];
    const parsed = parseLevel(def);
    state.levelIndex = index;
    state.levelName = def.name;
    state.levelSubtitle = def.subtitle;
    state.grid = parsed.grid;
    state.player.x = parsed.playerStart.x;
    state.player.y = parsed.playerStart.y;
    state.player.facing = 0;
    state.loot = parsed.loot.map((item) => ({ ...item }));
    state.lootTotal = state.loot.length;
    state.exit = { ...parsed.exit };
    state.guards = def.guards.map((guardDef) => {
      const start = guardDef.waypoints[0];
      return createGuard(guardDef, (start[0] + 0.5) * TILE, (start[1] + 0.5) * TILE, rng);
    });
    state.meter = 0;
    state.levelElapsed = 0;
    updateStatus();
  }

  function reset(seed) {
    state.seed = seed;
    state.score = 0;
    state.elapsed = 0;
    state.everSpotted = false;
    state.timesSpotted = 0;
    state.lootGot = 0;
    state.finished = false;
    state.caught = false;
    state.rating = '';
    loadLevel(0);
  }

  function updateStatus() {
    if (state.guards.some((g) => g.state === GUARD_CHASE)) state.status = 'CHASED';
    else if (state.meter >= 55) state.status = 'SPOTTED';
    else if (state.meter > 8) state.status = 'SUSPICIOUS';
    else state.status = 'HIDDEN';
  }

  // Axis-separated movement so the player slides along walls and crates.
  function movePlayer(dx, dy) {
    const p = state.player;
    const r = PLAYER_RADIUS;
    const solid = (x, y) => {
      const ch = tileAtPixel(state.grid, x, y);
      return ch === '#' || ch === 'C';
    };
    const hits = (x, y) =>
      solid(x - r, y - r) || solid(x + r, y - r) || solid(x - r, y + r) || solid(x + r, y + r);
    if (!hits(p.x + dx, p.y)) p.x += dx;
    if (!hits(p.x, p.y + dy)) p.y += dy;
    p.x = Math.min(FIELD_WIDTH - r, Math.max(r, p.x));
    p.y = Math.min(FIELD_HEIGHT - r, Math.max(r, p.y));
  }

  /**
   * One fixed step. `input` is {x, y, sneak} with x/y in -1..1. Returns the
   * events of this step as bit flags. When the player reaches the exit the
   * next level loads (EVENT_LEVEL) or the game ends in victory (EVENT_VICTORY).
   */
  function step(dt, input) {
    if (state.finished || state.caught) return 0;
    let events = 0;
    state.elapsed += dt;
    state.levelElapsed += dt;

    const p = state.player;
    const speed = input.sneak ? PLAYER_SNEAK_SPEED : PLAYER_WALK_SPEED;
    const moving = input.x !== 0 || input.y !== 0;
    p.moving = moving;
    p.sneaking = input.sneak;
    if (moving) {
      const len = Math.hypot(input.x, input.y);
      const nx = input.x / len;
      const ny = input.y / len;
      p.facing = Math.atan2(ny, nx);
      movePlayer(nx * speed * dt, ny * speed * dt);
    }

    // Detection: any guard that sees the player pushes the shared meter up;
    // unseen, the meter drains and the player can recover.
    const onDark = isDarkTile(tileAtPixel(state.grid, p.x, p.y));
    let seen = false;
    for (const guard of state.guards) {
      if (guardSeesPlayer(guard, p, state.grid)) seen = true;
    }
    if (seen) {
      let rate = input.sneak ? DETECT_SNEAK_RATE : DETECT_WALK_RATE;
      if (onDark) rate *= DETECT_DARK_MULTIPLIER;
      state.meter = Math.min(SPOTTED_AT, state.meter + rate * dt);
    } else {
      state.meter = Math.max(0, state.meter - DETECT_DECAY_RATE * dt);
    }

    const wasSpotted = state.everSpotted;
    for (const guard of state.guards) {
      const guardSees = guardSeesPlayer(guard, p, state.grid);
      const result = stepGuard(guard, state.grid, p, guardSees, state.meter, dt);
      if (result === 'spotted' && !wasSpotted) {
        state.everSpotted = true;
        state.timesSpotted += 1;
        events |= EVENT_SPOTTED;
      }
      if (result === 'caught') {
        state.caught = true;
        events |= EVENT_CAUGHT;
        updateStatus();
        return events;
      }
    }
    updateStatus();

    // Loot: walk over a golden moth to pocket it.
    for (const item of state.loot) {
      if (!item.taken && distance(p.x, p.y, item.x, item.y) < 28) {
        item.taken = true;
        state.lootGot += 1;
        state.score += LOOT_SCORE;
        events |= EVENT_LOOT;
      }
    }

    // Exit: step onto the green door. The next level loads, or the game ends.
    if (distance(p.x, p.y, state.exit.x, state.exit.y) < 30) {
      const timeBonus = Math.max(0, Math.round((180 - state.levelElapsed) * TIME_BONUS_PER_SECOND));
      state.score += timeBonus;
      if (state.levelIndex + 1 >= LEVELS.length) {
        if (!state.everSpotted) state.score += GHOST_BONUS;
        state.rating = state.everSpotted ? 'SEEN' : 'GHOST — UNSEEN';
        state.finished = true;
        events |= EVENT_VICTORY;
      } else {
        events |= EVENT_EXIT;
        loadLevel(state.levelIndex + 1);
        events |= EVENT_LEVEL;
      }
    }
    return events;
  }

  // How far the nearest guard is, for the footstep/proximity sound.
  function nearestGuardDistance() {
    let best = Infinity;
    for (const guard of state.guards) {
      best = Math.min(best, distance(state.player.x, state.player.y, guard.x, guard.y));
    }
    return best;
  }

  reset(1);
  return { state, reset, step, loadLevel, nearestGuardDistance, levelCount: LEVELS.length };
}

// Re-exported so the screenshot autopilot can ask the same question.
export { CHASE_LOSE_TIME };
