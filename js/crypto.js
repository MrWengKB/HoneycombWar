/* Honeycomb War · encrypted, tamper-proof save data
 * AES-GCM (256-bit) with a key derived from the app secret and the player's account.
 * GCM's authentication tag makes any edit to the file fail to open, and a file copied
 * from another account cannot be opened either. It runs in the browser, so this stops
 * casual edits, not a determined hacker.
 */
(function () {
  'use strict';
  const APP_SECRET = 'HoneycombWar::7f3c1e9a-b2d4-4c6e-9a8f-honey-comb-war-v1';
  const SALT = new TextEncoder().encode('honeycombwar-salt-v1');
  const keys = new Map();

  function keyFor(account) {
    const id = (account || 'local').toLowerCase();
    if (!keys.has(id)) {
      keys.set(id, (async () => {
        const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(APP_SECRET + '|' + id), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: SALT, iterations: 120000, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      })());
    }
    return keys.get(id);
  }
  const b64 = buf => { let s = ''; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  async function seal(obj, account) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(JSON.stringify(obj));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFor(account), data);
    return 'HWSAVE1.' + b64(iv) + '.' + b64(ct);
  }
  // Returns the object, or throws { code: 'tampered' } when the file was changed or belongs to someone else.
  async function open(text, account) {
    try {
      const [tag, iv, ct] = String(text).trim().split('.');
      if (tag !== 'HWSAVE1') throw new Error('format');
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await keyFor(account), unb64(ct));
      return JSON.parse(new TextDecoder().decode(plain));
    } catch (e) {
      throw Object.assign(new Error('tampered'), { code: 'tampered' });
    }
  }
  window.HWCrypto = { seal, open };
})();
