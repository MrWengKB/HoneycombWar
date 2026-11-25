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
  // Which copy to keep: the one with more games played, then the newer one.
  // So a fresh profile on a new device can never replace real progress.
  const played = d => (d.wins || 0) + (d.losses || 0) + (d.draws || 0);
  function better(a, b) {
    if (!a) return b; if (!b) return a;
    if (played(a) !== played(b)) return played(a) > played(b) ? a : b;
    return (a.updatedAt || 0) >= (b.updatedAt || 0) ? a : b;
  }
  let cloudBlocked = false; // Drive couldn't be read: don't write to it until it can
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
    let cloudRead = acc === 'local'; // true once Drive was read successfully (or there is no Drive)
    if (acc !== 'local') {
      if (window.Auth.token()) {
        try {
          // There can be more than one save file (for example one restored by hand): keep the best
          const files = await window.Drive.loadAll();
          let bestCloud = null, bestId = null, opened = 0;
          for (const f of files) {
            try {
              const cloud = await window.HWCrypto.open(f.text, acc);
              opened++;
              if (better(bestCloud, cloud) === cloud) { bestCloud = cloud; bestId = f.id; }
            } catch (e) { /* not ours, or changed outside the game */ }
          }
          if (files.length && !opened) warnings.push('cloudTampered');
          if (bestId) window.Drive.use(bestId);
          best = better(best, bestCloud);
          // First sign-in with this account on this device: progress made here without signing in counts too.
          if (!local.data) {
            const guest = await readLocal('local');
            if (guest.data) best = better(best, guest.data);
          }
          // A Drive file the game can't open is left alone rather than overwritten
          cloudRead = !warnings.includes('cloudTampered');
          setSync(cloudRead ? 'saved' : 'error');
        } catch (e) {
          setSync(e.code === 'auth' ? 'expired' : 'error');
          warnings.push(e.code === 'auth' ? 'expired' : 'cloudError');
        }
      } else {
        setSync('expired');
      }
    } else setSync('local');
    cloudBlocked = !cloudRead;
    profile = Object.assign(blank(), best || {});
    // Never push a fresh profile to Drive when Drive couldn't be read: it could replace real progress there
    if (!best || local.tampered) await save(true, !cloudRead);
    return { profile, warnings };
  }

  // Save now (locally) and soon (to Drive).
  async function save(immediateCloud, localOnly) {
    if (!profile) return;
    profile.updatedAt = localOnly ? 0 : Date.now();
    const acc = account();
    const text = await writeLocal(acc, profile);
    if (acc === 'local') { setSync('local'); return; }
    if (localOnly || cloudBlocked) return;
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
    if (cloudBlocked) return profile;
    if (mine && better(mine, res.profile) === mine && mine !== res.profile) profile = mine;
    await save(true);
    return profile;
  }

  window.Store = {
    load, save, reconnect, mode, setMode,
    get profile() { return profile; },
    get sync() { return syncState; },
    onSync(f) { listeners.push(f); }
  };
})();
