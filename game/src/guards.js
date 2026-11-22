// Guards: patrol, vision, and the four-state mind — calm, suspicious,
// chase, search. A guard walks its waypoints along a breadth-first path,
// pauses at each one, and looks where it walks. Its vision is a cone with
// line of sight: walls and crates block the view, bushes hide a player who
// stands inside one, and darkness slows how fast the guard becomes sure.
// This file knows nothing about drawing or sound; it reports what it sees
// and the world decides what that means.
import {
  BUSH_HIDE_RANGE,
  CHASE_LOSE_TIME,
  COLS,
  CONE_HALF_ANGLE,
  CONE_RANGE,
  GUARD_CALM,
  GUARD_CHASE,
  GUARD_PATROL_SPEED,
  GUARD_CHASE_SPEED,
  GUARD_SEARCH_SPEED,
  GUARD_SEARCH,
  GUARD_SUSPICIOUS,
  ROWS,
  SEARCH_TIME,
  SPOTTED_AT,
  SUSPICIOUS_AT,
  TILE,
} from './config.js';
import { isBushTile, isSolidTile, tileAtPixel, walkableAt } from './levels.js';
import { findPath } from './pathfind.js';

const TWO_PI = Math.PI * 2;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TWO_PI;
  while (d < -Math.PI) d += TWO_PI;
  return d;
}

function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

// Walk a ray from (x, y) toward `angle` in small steps; true while the ray
// stays in open air. Walls and crates stop it.
export function lineOfSight(grid, x, y, tx, ty) {
  const dist = distance(x, y, tx, ty);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i += 1) {
    const px = x + ((tx - x) * i) / steps;
    const py = y + ((ty - y) * i) / steps;
    if (isSolidTile(tileAtPixel(grid, px, py))) return false;
  }
  return true;
}

// Does this guard see the player right now? Inside the cone, in range, with
// a clear line — unless the player is tucked in a bush and the guard is far.
export function guardSeesPlayer(guard, player, grid) {
  const dist = distance(guard.x, guard.y, player.x, player.y);
  if (dist > CONE_RANGE) return false;
  const toPlayer = Math.atan2(player.y - guard.y, player.x - guard.x);
  if (Math.abs(angleDiff(toPlayer, guard.facing)) > CONE_HALF_ANGLE) return false;
  if (!lineOfSight(grid, guard.x, guard.y, player.x, player.y)) return false;
  if (isBushTile(tileAtPixel(grid, player.x, player.y)) && dist > BUSH_HIDE_RANGE) return false;
  return true;
}

export function createGuard(def, startX, startY, rng) {
  const first = def.waypoints[0];
  return {
    x: startX,
    y: startY,
    facing: 0,
    state: GUARD_CALM,
    waypointIndex: 1 % def.waypoints.length,
    path: null,
    pathIndex: 0,
    pauseLeft: 0,
    pauseBase: def.pause ?? 0.8,
    lastSeen: null,
    loseTimer: 0,
    searchTimer: 0,
    scanAngle: 0,
    waypoints: def.waypoints,
    rng,
  };
}

// Recompute the tile path from the guard's tile to its current waypoint.
function repath(guard, grid) {
  const from = [Math.floor(guard.x / TILE), Math.floor(guard.y / TILE)];
  const to = guard.waypoints[guard.waypointIndex];
  guard.path = findPath((c, r) => walkableAt(grid, c, r), COLS, ROWS, from, to);
  guard.pathIndex = 0;
}

// Walk toward a point at `speed`, sliding along solid tiles. Returns true
// when the point is reached.
function moveToward(guard, grid, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;
  const step = Math.min(dist, speed * dt);
  const nx = guard.x + (dx / dist) * step;
  const ny = guard.y + (dy / dist) * step;
  guard.facing = Math.atan2(dy, dx);
  moveWithCollision(guard, grid, nx, ny);
  return step >= dist;
}

// Axis-separated movement so a guard slides along a wall instead of sticking.
function moveWithCollision(guard, grid, nx, ny) {
  const r = 14;
  if (!hitsSolid(grid, nx, guard.y, r)) guard.x = nx;
  if (!hitsSolid(grid, guard.x, ny, r)) guard.y = ny;
}

function hitsSolid(grid, x, y, r) {
  return (
    isSolidTile(tileAtPixel(grid, x - r, y - r)) ||
    isSolidTile(tileAtPixel(grid, x + r, y - r)) ||
    isSolidTile(tileAtPixel(grid, x - r, y + r)) ||
    isSolidTile(tileAtPixel(grid, x + r, y + r))
  );
}

// One guard, one step. `seen` says whether this guard sees the player now,
// `meter` is the shared detection meter. Returns 'spotted' the moment the
// meter crosses the line, so the world can sound the alarm once.
export function stepGuard(guard, grid, player, seen, meter, dt) {
  let event = null;
  if (guard.state === GUARD_CHASE) {
    if (seen) {
      guard.lastSeen = { x: player.x, y: player.y };
      guard.loseTimer = 0;
    } else {
      guard.loseTimer += dt;
      if (guard.loseTimer >= CHASE_LOSE_TIME) {
        guard.state = GUARD_SEARCH;
        guard.searchTimer = 0;
        guard.path = null;
      }
    }
    const target = guard.lastSeen ?? { x: player.x, y: player.y };
    moveToward(guard, grid, target.x, target.y, GUARD_CHASE_SPEED, dt);
    if (distance(guard.x, guard.y, player.x, player.y) < 24) event = 'caught';
    return event;
  }

  if (guard.state === GUARD_SEARCH) {
    guard.searchTimer += dt;
    if (guard.lastSeen) {
      const arrived = moveToward(guard, grid, guard.lastSeen.x, guard.lastSeen.y, GUARD_SEARCH_SPEED, dt);
      if (arrived) {
        // Look around: sweep the facing back and forth while hunting.
        guard.scanAngle += dt * 2.2;
        guard.facing += Math.sin(guard.scanAngle) * dt * 1.6;
      }
    }
    if (guard.searchTimer >= SEARCH_TIME) {
      guard.state = GUARD_CALM;
      guard.lastSeen = null;
      guard.path = null;
    }
    return event;
  }

  if (guard.state === GUARD_SUSPICIOUS) {
    if (seen) {
      // Still watching you: face the player and let the meter keep climbing.
      guard.facing = Math.atan2(player.y - guard.y, player.x - guard.x);
      guard.lastSeen = { x: player.x, y: player.y };
    } else if (meter < 20) {
      guard.state = GUARD_CALM;
      guard.path = null;
    }
    if (meter >= SPOTTED_AT) {
      guard.state = GUARD_CHASE;
      guard.loseTimer = 0;
      event = 'spotted';
    }
    return event;
  }

  // Calm: patrol. Pause at each waypoint, then walk the path to the next.
  if (guard.pauseLeft > 0) {
    guard.pauseLeft -= dt;
    if (guard.pauseLeft <= 0) repath(guard, grid);
    return event;
  }
  if (guard.path === null) repath(guard, grid);
  if (guard.path === null || guard.pathIndex >= guard.path.length) {
    guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
    guard.pauseLeft = guard.pauseBase * (0.8 + guard.rng() * 0.4);
    guard.path = null;
    return event;
  }
  const stepTile = guard.path[guard.pathIndex];
  const cx = (stepTile[0] + 0.5) * TILE;
  const cy = (stepTile[1] + 0.5) * TILE;
  if (moveToward(guard, grid, cx, cy, GUARD_PATROL_SPEED, dt)) guard.pathIndex += 1;

  if (seen && meter >= SUSPICIOUS_AT) {
    guard.state = GUARD_SUSPICIOUS;
    guard.lastSeen = { x: player.x, y: player.y };
    guard.path = null;
  }
  if (meter >= SPOTTED_AT) {
    guard.state = GUARD_CHASE;
    guard.loseTimer = 0;
    event = 'spotted';
  }
  return event;
}
