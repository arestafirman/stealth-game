// Drawing only: the world's state and the current screen in, pixels out.
// The playfield is a fixed 1280x800 canvas, scaled by CSS to fit the window.
// Vision cones are raycast polygons — a guard's cone stops at walls and
// crates, so what you see is exactly what the guard sees. The HUD sits on
// top: level, loot, timer, the detection meter and the HIDDEN/SPOTTED status.
import {
  COLORS,
  COLS,
  CONE_HALF_ANGLE,
  CONE_RANGE,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  GUARD_CHASE,
  GUARD_SEARCH,
  GUARD_SUSPICIOUS,
  ROWS,
  SCREEN_INTRO,
  SCREEN_OVER,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_VICTORY,
  TILE,
} from './config.js';
import { isBushTile, isDarkTile, isSolidTile, tileAt } from './levels.js';
import { lineOfSight } from './guards.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const CONE_RAYS = 26;

function coneDistance(grid, x, y, angle) {
  for (let d = 8; d <= CONE_RANGE; d += 8) {
    const px = x + Math.cos(angle) * d;
    const py = y + Math.sin(angle) * d;
    const col = Math.floor(px / TILE);
    const row = Math.floor(py / TILE);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return d;
    if (isSolidTile(tileAt(grid, col, row))) return d;
  }
  return CONE_RANGE;
}

function drawCone(ctx, grid, guard) {
  const start = guard.facing - CONE_HALF_ANGLE;
  const end = guard.facing + CONE_HALF_ANGLE;
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  for (let i = 0; i <= CONE_RAYS; i += 1) {
    const angle = start + ((end - start) * i) / CONE_RAYS;
    const d = coneDistance(grid, guard.x, guard.y, angle);
    ctx.lineTo(guard.x + Math.cos(angle) * d, guard.y + Math.sin(angle) * d);
  }
  ctx.closePath();
  ctx.fillStyle = guard.state === GUARD_CHASE ? 'rgba(255, 90, 70, 0.30)' : COLORS.cone;
  ctx.fill();
  ctx.strokeStyle = guard.state === GUARD_CHASE ? 'rgba(255, 90, 70, 0.6)' : COLORS.coneEdge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawGuard(ctx, guard) {
  // Body: warm red against the blue-grey floor, with a dark rim.
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, 15, 0, Math.PI * 2);
  ctx.fillStyle = guard.state === GUARD_CHASE ? '#ff3b30' : COLORS.guard;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = COLORS.guardDark;
  ctx.stroke();
  // Facing tick: a short nose showing where the guard looks.
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  ctx.lineTo(guard.x + Math.cos(guard.facing) * 22, guard.y + Math.sin(guard.facing) * 22);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffd9d7';
  ctx.stroke();
  // Lantern dot on the chest.
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#ffe9a8';
  ctx.fill();
  // State mark: ? while suspicious, ! while chasing or searching.
  if (guard.state === GUARD_SUSPICIOUS || guard.state === GUARD_SEARCH || guard.state === GUARD_CHASE) {
    ctx.font = `bold 22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = guard.state === GUARD_CHASE ? '#ff6b5e' : '#ffd166';
    ctx.fillText(guard.state === GUARD_SUSPICIOUS ? '?' : '!', guard.x, guard.y - 28);
  }
}

function drawPlayer(ctx, player, time) {
  const flap = Math.sin(time * (player.moving ? 14 : 6)) * 0.35;
  const angle = player.facing;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(angle);
  // Wings: two pale lavender ellipses that flap as the moth moves.
  ctx.fillStyle = COLORS.playerWing;
  ctx.beginPath();
  ctx.ellipse(-2, -11, 11, 6 + flap * 4, -0.5, 0, Math.PI * 2);
  ctx.ellipse(-2, 11, 11, 6 + flap * 4, 0.5, 0, Math.PI * 2);
  ctx.fill();
  // Body: a small pale moth, bright against the dark floor.
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.player;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#8a7fd6';
  ctx.stroke();
  // Antennae pointing the way.
  ctx.beginPath();
  ctx.moveTo(8, -3);
  ctx.lineTo(15, -6);
  ctx.moveTo(8, 3);
  ctx.lineTo(15, 6);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COLORS.player;
  ctx.stroke();
  ctx.restore();
}

function drawLoot(ctx, item, time) {
  const bob = Math.sin(time * 3 + item.x) * 2;
  const glow = 10 + Math.sin(time * 4 + item.y) * 3;
  ctx.save();
  ctx.shadowColor = COLORS.loot;
  ctx.shadowBlur = glow;
  ctx.translate(item.x, item.y + bob);
  ctx.fillStyle = COLORS.loot;
  ctx.beginPath();
  ctx.ellipse(-6, -4, 8, 4, -0.6, 0, Math.PI * 2);
  ctx.ellipse(-6, 4, 8, 4, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(2, 0, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#fff3c4';
  ctx.fill();
  ctx.restore();
}

function drawExit(ctx, exit, time) {
  const pulse = 0.75 + Math.sin(time * 3) * 0.25;
  ctx.save();
  ctx.shadowColor = COLORS.exit;
  ctx.shadowBlur = 18 * pulse;
  ctx.fillStyle = COLORS.exitDark;
  ctx.strokeStyle = COLORS.exit;
  ctx.lineWidth = 3;
  const w = 44;
  const h = 56;
  ctx.beginPath();
  ctx.roundRect(exit.x - w / 2, exit.y - h / 2, w, h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.font = `bold 13px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.exit;
  ctx.fillText('EXIT', exit.x, exit.y - 1);
  ctx.font = `bold 11px ${FONT}`;
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('reach it unseen', exit.x, exit.y + h / 2 + 14);
}

function drawTiles(ctx, grid) {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const ch = grid[row][col];
      const x = col * TILE;
      const y = row * TILE;
      if (ch === '#') {
        ctx.fillStyle = COLORS.wall;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = COLORS.wallTop;
        ctx.fillRect(x, y, TILE, 5);
        continue;
      }
      ctx.fillStyle = (col + row) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
      ctx.fillRect(x, y, TILE, TILE);
      if (ch === 'd') {
        ctx.fillStyle = COLORS.darkTile;
        ctx.fillRect(x, y, TILE, TILE);
      } else if (ch === 'C') {
        ctx.fillStyle = COLORS.crate;
        ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.strokeStyle = COLORS.crateEdge;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.beginPath();
        ctx.moveTo(x + 3, y + 3);
        ctx.lineTo(x + TILE - 3, y + TILE - 3);
        ctx.moveTo(x + TILE - 3, y + 3);
        ctx.lineTo(x + 3, y + TILE - 3);
        ctx.stroke();
      } else if (ch === 'B') {
        ctx.fillStyle = COLORS.bush;
        ctx.beginPath();
        ctx.arc(x + 12, y + 14, 11, 0, Math.PI * 2);
        ctx.arc(x + 27, y + 12, 12, 0, Math.PI * 2);
        ctx.arc(x + 20, y + 27, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.bushLeaf;
        ctx.beginPath();
        ctx.arc(x + 12, y + 14, 5, 0, Math.PI * 2);
        ctx.arc(x + 27, y + 12, 6, 0, Math.PI * 2);
        ctx.arc(x + 20, y + 27, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawHud(ctx, state) {
  ctx.fillStyle = 'rgba(8, 11, 18, 0.82)';
  ctx.fillRect(0, 0, FIELD_WIDTH, 46);
  ctx.font = `bold 16px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.hud;
  ctx.fillText(state.levelName, 16, 24);
  ctx.font = `15px ${FONT}`;
  ctx.fillStyle = COLORS.dim;
  ctx.fillText(`Moths ${state.lootGot}/${state.lootTotal}`, 330, 24);
  const minutes = Math.floor(state.elapsed / 60);
  const seconds = Math.floor(state.elapsed % 60);
  ctx.fillText(`Time ${minutes}:${String(seconds).padStart(2, '0')}`, 470, 24);
  ctx.fillText(`Score ${state.score}`, 590, 24);

  // Detection meter: a bar that fills amber, then red, as guards grow sure.
  const meterX = 760;
  const meterW = 220;
  ctx.fillStyle = '#2a3140';
  ctx.fillRect(meterX, 14, meterW, 18);
  const fill = state.meter / 100;
  ctx.fillStyle = state.meter >= 55 ? COLORS.danger : COLORS.gold;
  ctx.fillRect(meterX, 14, meterW * fill, 18);
  ctx.strokeStyle = '#4a5878';
  ctx.lineWidth = 1;
  ctx.strokeRect(meterX, 14, meterW, 18);
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillStyle = COLORS.dim;
  ctx.textAlign = 'right';
  ctx.fillText('DETECTION', meterX - 10, 24);
  ctx.textAlign = 'left';
  const statusColor = state.status === 'HIDDEN' ? COLORS.exit : state.status === 'CHASED' ? COLORS.danger : COLORS.gold;
  ctx.fillStyle = statusColor;
  ctx.font = `bold 18px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(state.status, FIELD_WIDTH - 16, 24);
  ctx.textAlign = 'left';
}

function panel(ctx, title, lines, prompt, accent) {
  const width = 640;
  const height = 120 + lines.length * 30 + 56;
  const x = (FIELD_WIDTH - width) / 2;
  const y = (FIELD_HEIGHT - height) / 2;
  ctx.fillStyle = 'rgba(6, 9, 14, 0.72)';
  ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
  ctx.fillStyle = '#141a26';
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 12);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = accent;
  ctx.font = `bold 40px ${FONT}`;
  ctx.fillText(title, FIELD_WIDTH / 2, y + 56);
  ctx.font = `17px ${FONT}`;
  ctx.fillStyle = COLORS.hud;
  lines.forEach((line, i) => {
    ctx.fillText(line, FIELD_WIDTH / 2, y + 112 + i * 30);
  });
  ctx.font = `bold 16px ${FONT}`;
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(prompt, FIELD_WIDTH / 2, y + height - 30);
  ctx.textAlign = 'left';
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let time = 0;

  function draw(state, screen, best) {
    time += 1 / 60;
    ctx.clearRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
    drawTiles(ctx, state.grid);
    drawExit(ctx, state.exit, time);
    for (const item of state.loot) if (!item.taken) drawLoot(ctx, item, time);
    for (const guard of state.guards) drawCone(ctx, state.grid, guard);
    for (const guard of state.guards) drawGuard(ctx, guard);
    drawPlayer(ctx, state.player, time);
    if (screen === SCREEN_PLAY || screen === SCREEN_INTRO) drawHud(ctx, state);

    if (screen === SCREEN_TITLE) {
      panel(
        ctx,
        'MOTHLIGHT',
        [
          'a lamplight stealth',
          '',
          'Slip through three lamplit rooms. Pocket the golden moths.',
          'Reach the green door unseen — GHOST if no guard ever spots you.',
          '',
          'WASD / arrows — move      Shift — sneak, slow and quiet',
          'Dark floor and bushes hide you. Yellow cones are watching.',
          `Best score: ${best}`,
        ],
        'Press Enter or click to begin',
        COLORS.gold,
      );
    } else if (screen === SCREEN_INTRO) {
      panel(ctx, state.levelName, [state.levelSubtitle, '', `Moths here: ${state.lootTotal}      Guards: ${state.guards.length}`], 'Press Enter to slip in', COLORS.exit);
    } else if (screen === SCREEN_VICTORY) {
      panel(
        ctx,
        state.rating,
        [
          `The moth slipped through all three rooms.`,
          '',
          `Score ${state.score}      Moths ${state.lootGot}/${state.lootTotalAll}      Time ${Math.floor(state.elapsed / 60)}:${String(Math.floor(state.elapsed % 60)).padStart(2, '0')}`,
          `Spotted ${state.timesSpotted} time${state.timesSpotted === 1 ? '' : 's'}`,
        ],
        'Press R to fly again',
        state.rating.startsWith('GHOST') ? COLORS.exit : COLORS.gold,
      );
    } else if (screen === SCREEN_OVER) {
      panel(
        ctx,
        'CAUGHT',
        [
          'A guard closed in and the lamp found you.',
          '',
          `You reached ${state.levelName} — score ${state.score}, moths ${state.lootGot}/${state.lootTotal}.`,
          'Watch the patrols. Wait for the cone to turn. Sneak through the dark.',
        ],
        'Press R to try again',
        COLORS.danger,
      );
    }
  }

  return { draw };
}

// Re-exported so shots.js can ask whether a point is visible to a guard.
export { lineOfSight };
