// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens: title,
// level intro, play, victory and caught. R restarts from any end screen.
//
// ?seed=N fixes the run. ?shot=start|play|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { SCREEN_INTRO, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './config.js';
import { makeRandom } from './random.js';
import { createWorld, EVENT_CAUGHT, EVENT_EXIT, EVENT_LOOT, EVENT_SPOTTED, EVENT_VICTORY, STEP } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer } from './render.js';
import { createSound } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;
const BEST_KEY = 'mothlight.best';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(makeRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const sound = createSound();
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset(Math.floor(Math.random() * 4294967296));
    accumulator = 0;
    screen = SCREEN_INTRO;
    announce(`MOTHLIGHT. ${world.state.levelName}. ${world.state.levelSubtitle}`);
  }

  function endRun(victory) {
    screen = victory ? SCREEN_VICTORY : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(victory ? `Ghost or seen, you are out. Score ${world.state.score}.` : `Caught. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_RESTART && (screen === SCREEN_OVER || screen === SCREEN_VICTORY)) {
      sound.unlock();
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM) {
      sound.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_VICTORY) startGame();
      else if (screen === SCREEN_INTRO) {
        screen = SCREEN_PLAY;
        announce('Playing. Stay out of the yellow cones.');
      }
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_INTRO;
      announce('Paused.');
    }
  }

  function step() {
    if (screen !== SCREEN_PLAY) return;
    const steering = input.steering();
    const events = world.step(STEP, steering);
    sound.update(STEP, world.state.player.moving, world.state.player.sneaking, world.nearestGuardDistance(), world.state.status === 'CHASED');
    if (events & EVENT_LOOT) sound.loot();
    if (events & EVENT_SPOTTED) sound.spotted();
    if (events & EVENT_EXIT) sound.exit();
    if (events & EVENT_CAUGHT) {
      sound.caught();
      endRun(false);
    } else if (events & EVENT_VICTORY) {
      sound.exit();
      endRun(true);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting guards hunt unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_INTRO;
      announce('Paused.');
    }
  });

  announce('MOTHLIGHT, a lamplight stealth game. Press Enter or click to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
