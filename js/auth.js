/* Honeycomb War · optional Google sign-in (Google Identity Services, token model)
 * Scope drive.file: the game only sees the files it created in the player's Drive.
 * The access token lasts about an hour and is kept in this browser.
 */
(function () {
  'use strict';
  const KEY = 'honeycombwar:google';
  const GSI_SRC = 'https://accounts.google.com/gsi/client';
  const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const SCOPES = 'openid email profile ' + DRIVE_SCOPE;
  const cfg = window.HW_CONFIG || {};

  function read() { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && s.email ? s : null; } catch (e) { return null; } }
  function write(s) { try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

  function token() { const s = read(); return s && s.token && s.exp > Date.now() + 60000 ? s.token : null; }
  function current() { const s = read(); return s ? { email: s.email, name: s.name || s.email } : null; }
  function signOut() {
    const s = read();
    write(null);
    if (s && s.token && window.google && google.accounts && google.accounts.oauth2) google.accounts.oauth2.revoke(s.token, () => {});
  }

  let gsiPromise = null;
  function loadGsi() {
    if (!gsiPromise) {
      gsiPromise = new Promise((resolve, reject) => {
        if (window.google && google.accounts && google.accounts.oauth2) return resolve();
        const s = document.createElement('script');
        s.src = GSI_SRC; s.async = true;
        s.onload = () => resolve();
        s.onerror = () => { gsiPromise = null; reject(Object.assign(new Error('gsi'), { code: 'gsi' })); };
        document.head.appendChild(s);
      });
    }
    return gsiPromise;
  }

  // Must be called from a click: opens Google's sign-in popup.
  async function signIn() {
    await loadGsi();
    const prev = current();
    const resp = await new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: cfg.googleClientId,
        scope: SCOPES,
        hint: prev ? prev.email : undefined,
        callback: r => (r.error ? reject(Object.assign(new Error(r.error), { code: 'denied' })) : resolve(r)),
        error_callback: e => reject(Object.assign(new Error((e && e.type) || 'popup'), { code: 'popup' }))
      });
      client.requestAccessToken({ prompt: '' });
    });
    if (!google.accounts.oauth2.hasGrantedAllScopes(resp, DRIVE_SCOPE)) throw Object.assign(new Error('scope'), { code: 'scope' });
    const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + resp.access_token } })
      .then(r => r.json()).catch(() => ({}));
    if (!info.email) throw Object.assign(new Error('userinfo'), { code: 'popup' });
    write({ token: resp.access_token, exp: Date.now() + (Number(resp.expires_in) || 3600) * 1000, email: info.email, name: info.name || '' });
    return resp.access_token;
  }

  window.Auth = { token, current, signIn, signOut, loadGsi };
})();
