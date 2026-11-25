/* Honeycomb War · sound effects, made with the Web Audio API (no audio files) */
(function () {
  'use strict';
  const KEY = 'honeycombwar:sound';
  let ctx = null;
  let master = null;
  let on = true;
  try { on = localStorage.getItem(KEY) !== 'off'; } catch (e) { /* ignore */ }

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // Browsers only allow sound after the first tap or key press.
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => { if (on) audio(); }, { once: true, capture: true }));

  // one note: frequency (Hz), start (s from now), length (s), wave type, volume
  function tone(f, t, len, type, vol, slideTo) {
    const a = ctx, now = a.currentTime + t;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, now);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, now + len);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + len);
    o.connect(g); g.connect(master);
    o.start(now); o.stop(now + len + 0.05);
  }
  function noise(t, len, vol, freq, q) {
    const a = ctx, now = a.currentTime + t;
    const buf = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * len)), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(); src.buffer = buf;
    const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq || 3000; bp.Q.value = q || 1;
    const g = a.createGain();
    g.gain.setValueAtTime(vol || 0.3, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + len);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(now); src.stop(now + len + 0.02);
  }
  const notes = (list, t0, step, len, type, vol) => list.forEach((f, i) => tone(f, t0 + i * step, len, type, vol));

  const SOUNDS = {
    // take an empty cell
    ding: t => { tone(1318.5, t, 0.35, 'sine', 0.25); tone(2637, t, 0.2, 'sine', 0.06); },
    // capture an enemy cell: two blades meeting
    clash: t => {
      noise(t, 0.18, 0.45, 4200, 2);
      [2350, 3170, 4410].forEach(f => tone(f, t, 0.45, 'square', 0.035));
      noise(t + 0.09, 0.14, 0.3, 5200, 3);
      [2780, 3720].forEach(f => tone(f, t + 0.09, 0.35, 'square', 0.03));
    },
    // hit a wall: a dull knock
    wall: t => { tone(160, t, 0.18, 'triangle', 0.5, 70); noise(t, 0.08, 0.25, 700, 1); },
    // attack that did nothing
    bonk: t => { tone(220, t, 0.16, 'triangle', 0.3, 150); },
    // bad item, or losing a boost
    uhoh: t => { tone(523.3, t, 0.18, 'triangle', 0.3); tone(392, t + 0.2, 0.32, 'triangle', 0.3, 370); },
    // good item, or the centre base
    happy: t => notes([523.3, 659.3, 784, 1046.5], t, 0.085, 0.22, 'triangle', 0.22),
    // ring: a little sparkle on top of the happy tune
    ring: t => { notes([523.3, 659.3, 784, 1046.5], t, 0.085, 0.22, 'triangle', 0.22); notes([1568, 2093, 2637], t + 0.34, 0.05, 0.15, 'sine', 0.08); },
    // enclosure: a rising sweep
    enclose: t => { tone(330, t, 0.4, 'sine', 0.2, 990); tone(495, t + 0.05, 0.4, 'sine', 0.12, 1485); },
    // mine: a low explosion with a rumble
    boom: t => {
      noise(t, 0.9, 0.9, 180, 0.6);
      noise(t, 0.25, 0.5, 900, 0.8);
      tone(110, t, 0.7, 'sine', 0.6, 32);
      tone(70, t + 0.05, 0.9, 'triangle', 0.35, 28);
    },
    // pass: a soft whoosh
    pass: t => noise(t, 0.3, 0.12, 900, 0.7),
    // victory: trumpet fanfare
    win: t => {
      const seq = [[392, 0, 0.14], [392, 0.15, 0.14], [392, 0.3, 0.14], [523.3, 0.45, 0.5], [392, 0.98, 0.16], [523.3, 1.16, 0.7]];
      seq.forEach(([f, d, l]) => { tone(f, t + d, l, 'sawtooth', 0.12); tone(f * 2, t + d, l, 'square', 0.03); });
    },
    // defeat: sad descending tune
    lose: t => {
      [[392, 0, 0.35], [370, 0.38, 0.35], [349.2, 0.76, 0.35], [329.6, 1.14, 0.9]].forEach(([f, d, l]) => tone(f, t + d, l, 'triangle', 0.25, d > 1 ? 300 : 0));
    },
    // draw: two even chimes
    draw: t => { tone(659.3, t, 0.4, 'sine', 0.2); tone(659.3, t + 0.3, 0.6, 'sine', 0.2); }
  };

  // play('ding') or play(['clash', 'happy']) to play several, one after another
  function play(names, gap) {
    if (!on) return;
    if (!audio()) return;
    [].concat(names).filter(Boolean).forEach((n, i) => { if (SOUNDS[n]) SOUNDS[n](i * (gap || 0.32)); });
  }
  function setOn(v) {
    on = !!v;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* ignore */ }
    if (on) play('ding');
  }
  window.Sound = { play, setOn, get on() { return on; } };
})();
