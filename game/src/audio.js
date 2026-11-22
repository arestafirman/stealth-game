// Sound, synthesized live with WebAudio — no audio files, no network.
// Footsteps tell you where a guard is: your own steps are soft ticks, and
// the nearest guard hums a low pulse that quickens as it closes in. A
// spotted guard stings, loot chimes, the exit plays a small dawn arpeggio.
// Everything is guarded: with no user gesture yet (or no AudioContext at
// all, as in a screenshot) every call is a silent no-op.
export function createSound() {
  let ctx = null;
  let master = null;
  let stepTimer = 0;
  let pulseTimer = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.16;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  // Resume on the first gesture: browsers keep the context suspended until one.
  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone(freq, seconds, type, volume, slideTo) {
    if (!ensure() || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + seconds);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + seconds + 0.02);
  }

  // A short filtered noise tick for a footstep.
  function footstep(quiet) {
    if (!ensure() || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const length = Math.floor(ctx.sampleRate * 0.05);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = quiet ? 500 : 900;
    const gain = ctx.createGain();
    gain.gain.value = quiet ? 0.12 : 0.35;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
  }

  return {
    unlock,
    // Called every frame while playing: ticks the player's steps and hums
    // the nearest guard's pulse, closer guards pulsing faster and louder.
    update(dt, moving, sneaking, nearestGuard, chased) {
      if (!ctx || ctx.state !== 'running') return;
      if (moving) {
        stepTimer -= dt;
        if (stepTimer <= 0) {
          footstep(sneaking);
          stepTimer = sneaking ? 0.55 : 0.34;
        }
      }
      if (nearestGuard < 420) {
        pulseTimer -= dt;
        const closeness = 1 - nearestGuard / 420;
        if (pulseTimer <= 0) {
          tone(chased ? 196 : 110, 0.16, 'sine', 0.1 + closeness * 0.22, chased ? 147 : 98);
          pulseTimer = 0.9 - closeness * 0.6;
        }
      }
    },
    spotted() {
      tone(660, 0.22, 'sawtooth', 0.3, 330);
      tone(440, 0.3, 'sawtooth', 0.22, 220);
    },
    loot() {
      tone(880, 0.12, 'sine', 0.25);
      setTimeout(() => tone(1318, 0.16, 'sine', 0.22), 70);
    },
    exit() {
      [523, 659, 784, 1046].forEach((freq, i) => setTimeout(() => tone(freq, 0.28, 'triangle', 0.25), i * 90));
    },
    caught() {
      tone(220, 0.5, 'sawtooth', 0.3, 55);
    },
  };
}
