/* Honeycomb War · background music (optional, off until the player ticks the box)
 * "New Sunrise", from OpenGameArt.org, CC0 1.0 (public domain): https://opengameart.org/content/new-sunrise
 * The same track is used in ELAdventure.
 */
(function () {
  'use strict';
  const KEY = 'honeycombwar:music';
  let el = null;
  let on = false;
  try { on = localStorage.getItem(KEY) === 'on'; } catch (e) { /* ignore */ }

  function audio() {
    if (!el) {
      el = new Audio('music/bgm.mp3');
      el.loop = true;
      el.volume = 0.3;
      el.preload = 'none';
    }
    return el;
  }
  function start() {
    if (!on || document.hidden) return;
    const p = audio().play();
    if (p && p.catch) p.catch(() => { /* blocked until the first tap; tried again then */ });
  }
  function stop() { if (el) el.pause(); }
  function setOn(v) {
    on = !!v;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* ignore */ }
    on ? start() : stop();
  }
  // Browsers only allow sound after a tap or key press.
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => { if (on && (!el || el.paused)) start(); }, { capture: true }));
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  window.Music = { setOn, start, pause: stop, get on() { return on; } };
  start();
})();
