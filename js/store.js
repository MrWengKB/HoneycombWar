/* Honeycomb War · the player's profile (level, record, game in progress)
 * Always kept, encrypted, in this browser. When signed in with Google it is also saved,
 * encrypted, in the player's Google Drive, and the newer copy wins when loading.
 */
(function () {
  'use strict';
  const MODE_KEY = 'honeycombwar:mode'; // 'guest' | 'google'
  const SAVE_KEY = 'honeycombwar:save:';
  const listeners = [];
  let profile = null;
  let syncState = 'local'; // local | saving | saved | expired | error
  let timer = null;

  const account = () => (mode() === 'google' && window.Auth.current() ? window.Auth.current().email.toLowerCase() : 'local');
  function mode() { try { return localStorage.getItem(MODE_KEY); } catch (e) { return null; } }
  function setMode(m) { try { m ? localStorage.setItem(MODE_KEY, m) : localStorage.removeItem(MODE_KEY); } catch (e) { /* ignore */ } }

  function blank() {
    return { level: 1, wins: 0, losses: 0, draws: 0, best: 1, prefs: {}, current: null, updatedAt: 0 };
  }
  function setSync(s) { syncState = s; listeners.forEach(f => f(s)); }

  async function readLocal(acc) {
    let text = null;
    try { text = localStorage.getItem(SAVE_KEY + acc); } catch (e) { /* ignore */ }
    if (!text) return { data: null };
    try { return { data: await window.HWCrypto.open(text, acc) }; } catch (e) { return { data: null, tampered: true }; }
  }
  async function writeLocal(acc, data) {
    const text = await window.HWCrypto.seal(data, acc);
    try { localStorage.setItem(SAVE_KEY + acc, text); } catch (e) { /* storage full or blocked */ }
    return text;
  }

  // Load the profile for the current mode. Returns { profile, warnings: [] }.
  async function load() {
    const warnings = [];
    const acc = account();
    const local = await readLocal(acc);
    if (local.tampered) warnings.push('localTampered');
    let best = local.data;
    if (acc !== 'local') {
      if (window.Auth.token()) {
        try {
          const text = await window.Drive.load();
          if (text) {
            try {
              const cloud = await window.HWCrypto.open(text, acc);
              if (!best || (cloud.updatedAt || 0) > (best.updatedAt || 0)) best = cloud;
            } catch (e) { warnings.push('cloudTampered'); }
          } else if (!best) {
            // First sign-in with this account: keep the progress made without signing in.
            const guest = await readLocal('local');
            if (guest.data) best = guest.data;
          }
          setSync('saved');
        } catch (e) {
          setSync(e.code === 'auth' ? 'expired' : 'error');
          warnings.push(e.code === 'auth' ? 'expired' : 'cloudError');
        }
      } else {
        setSync('expired');
      }
    } else setSync('local');
    profile = Object.assign(blank(), best || {});
    if (!best || local.tampered) await save(true);
    return { profile, warnings };
  }

  // Save now (locally) and soon (to Drive).
  async function save(immediateCloud) {
    if (!profile) return;
    profile.updatedAt = Date.now();
    const acc = account();
    const text = await writeLocal(acc, profile);
    if (acc === 'local') { setSync('local'); return; }
    clearTimeout(timer);
    const push = async () => {
      if (!window.Auth.token()) { setSync('expired'); return; }
      setSync('saving');
      try { await window.Drive.save(text); setSync('saved'); }
      catch (e) { setSync(e.code === 'auth' ? 'expired' : 'error'); }
    };
    if (immediateCloud) await push(); else timer = setTimeout(push, 1200);
  }
  // Called from a click when the Google token expired.
  async function reconnect() {
    await window.Auth.signIn();
    const mine = profile;
    const res = await load();
    if (mine && (mine.updatedAt || 0) > (res.profile.updatedAt || 0)) { profile = mine; await save(true); }
    else await save(true);
    return profile;
  }

  window.Store = {
    load, save, reconnect, mode, setMode,
    get profile() { return profile; },
    get sync() { return syncState; },
    onSync(f) { listeners.push(f); }
  };
})();
