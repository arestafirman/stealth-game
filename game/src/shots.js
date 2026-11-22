// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world, steered by a patient autopilot that
// follows the level's safe route tile by tile and waits in cover whenever
// the next step would walk into a guard's cone — so the frame is what a
// careful game really looks like, and the same seed always gives the same
// frame. start shows the title over the patrolling gallery, play freezes
// mid-route with a cone nearby, end reaches the exit unseen: GHOST.
import { COLS, ROWS, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY, TILE } from './config.js';
import { LEVELS, tileCenter, walkableAt } from './levels.js';
import { guardSeesPlayer } from './guards.js';
import { findPath } from './pathfind.js';
import { EVENT_CAUGHT, EVENT_VICTORY, STEP } from './world.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 60;
const END_LIMIT_SECONDS = 600;

// The autopilot walks the level's safe route, one tile at a time, waiting
// out any cone that covers its next step. It replans with breadth-first
// search whenever the route target changes.
function makeAutopilot(world) {
  let routeIndex = 0;
  let path = null;
  let pathIndex = 0;
  let levelIndex = world.state.levelIndex;

  function currentTarget() {
    const route = LEVELS[world.state.levelIndex].route;
    if (routeIndex >= route.length) return null;
    return route[routeIndex];
  }

  function replan() {
    const target = currentTarget();
    if (!target) {
      path = null;
      return;
    }
    const from = [Math.floor(world.state.player.x / TILE), Math.floor(world.state.player.y / TILE)];
    path = findPath((c, r) => walkableAt(world.state.grid, c, r), COLS, ROWS, from, target);
    pathIndex = 0;
  }

  function nextStepDanger(px, py) {
    for (const guard of world.state.guards) {
      if (guardSeesPlayer(guard, { x: px, y: py }, world.state.grid)) return true;
    }
    return false;
  }

  // One step of steering: {x, y, sneak}, or null when the route is done.
  function steer() {
    const state = world.state;
    // A new level loaded (the exit was reached): start its route from the top.
    if (state.levelIndex !== levelIndex) {
      levelIndex = state.levelIndex;
      routeIndex = 0;
      path = null;
      pathIndex = 0;
    }
    const target = currentTarget();
    if (!target) return null;
    const targetPx = tileCenter(target[0], target[1]);
    if (Math.hypot(state.player.x - targetPx.x, state.player.y - targetPx.y) < 20) {
      routeIndex += 1;
      path = null;
      return steer();
    }
    if (path === null) replan();
    if (!path || pathIndex >= path.length) {
      replan();
      if (!path || path.length === 0) {
        // Already standing on the target tile but off its centre: walk
        // straight to the centre instead of waiting for a path that is empty.
        const cdx = targetPx.x - state.player.x;
        const cdy = targetPx.y - state.player.y;
        const clen = Math.hypot(cdx, cdy) || 1;
        return { x: cdx / clen, y: cdy / clen, sneak: false };
      }
    }
    const stepTile = path[pathIndex];
    const stepPx = tileCenter(stepTile[0], stepTile[1]);
    if (Math.hypot(state.player.x - stepPx.x, state.player.y - stepPx.y) < 12) {
      pathIndex += 1;
      return steer();
    }
    const dx = stepPx.x - state.player.x;
    const dy = stepPx.y - state.player.y;
    const len = Math.hypot(dx, dy);
    const aheadX = state.player.x + (dx / len) * 26;
    const aheadY = state.player.y + (dy / len) * 26;
    // Seen right now: keep moving, standing still only feeds the meter.
    // About to step into a cone: wait in cover until the patrol turns away.
    let seenNow = false;
    for (const guard of state.guards) {
      if (guardSeesPlayer(guard, state.player, state.grid)) seenNow = true;
    }
    if (!seenNow && (nextStepDanger(aheadX, aheadY) || state.meter > 35)) {
      return { x: 0, y: 0, sneak: true };
    }
    const nearest = world.nearestGuardDistance();
    return { x: dx / len, y: dy / len, sneak: nearest < 170 };
  }

  return { steer, routeIndex: () => routeIndex, routeLength: () => LEVELS[world.state.levelIndex].route.length };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset(1);
  if (name !== 'play' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { x: 0, y: 0, sneak: false });
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const pilot = makeAutopilot(world);
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const playTarget = 7; // freeze near the middle of the route, by a patrol
  for (let i = 0; i < limit / STEP; i += 1) {
    const input = pilot.steer();
    if (input === null) break;
    const events = world.step(STEP, input);
    if (events & EVENT_VICTORY) return { screen: SCREEN_VICTORY, best: world.state.score };
    if (events & EVENT_CAUGHT) break;
    if (name === 'play' && pilot.routeIndex() >= playTarget) break;
  }
  const over = world.state.caught;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
