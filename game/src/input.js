// Keyboard and pointer input. Held keys give a steering direction; one-shot
// presses (confirm, restart, pause) are queued as bit flags and taken once by
// the loop, so a press between two frames is never lost and never counted
// twice. Mouse is for menus and buttons: a click anywhere confirms.
import { STEP } from './world.js';

export const ACTION_CONFIRM = 1;
export const ACTION_RESTART = 2;
export const ACTION_PAUSE = 4;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SNEAK = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const RESTART = new Set(['KeyR']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(target) {
  const held = { up: false, down: false, left: false, right: false, sneak: false };
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (SNEAK.has(event.code)) held.sneak = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (SNEAK.has(event.code)) held.sneak = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.up = false;
    held.down = false;
    held.left = false;
    held.right = false;
    held.sneak = false;
  });
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });

  return {
    // Steering as {x, y, sneak}: x/y in -1..1, sneak while Shift is held.
    steering() {
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
        sneak: held.sneak,
      };
    },
    // The one-shot presses since the last call, as ACTION_* flags.
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}

// Re-exported so main.js can share the fixed step with the world.
export { STEP };
