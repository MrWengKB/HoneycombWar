/* Honeycomb War · the save file in the player's own Google Drive
 * One file, "honeycombwar.save", in a folder "Honeycomb War", marked appProperties app=honeycombwar.
 * Its contents are the encrypted text from crypto.js.
 */
(function () {
  'use strict';
  const cfg = window.HW_CONFIG || {};
  const API = 'https://www.googleapis.com/drive/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
  const FOLDER_MIME = 'application/vnd.google-apps.folder';
  const APP = 'honeycombwar';

  class DriveError extends Error { constructor(code, msg) { super(msg || code); this.code = code; } }

  async function request(method, url, opts) {
    const tk = window.Auth.token();
    if (!tk) throw new DriveError('auth');
    let res;
    try {
      res = await fetch(url, { method, headers: Object.assign({ Authorization: 'Bearer ' + tk }, opts && opts.headers), body: opts && opts.body });
    } catch (e) { throw new DriveError('network'); }
    if (res.status === 401) throw new DriveError('auth');
    if (!res.ok) throw new DriveError('server', await res.text().catch(() => ''));
    return opts && opts.text ? res.text() : res.json();
  }
  const q = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  const fileKey = () => 'honeycombwar:driveFile:' + ((window.Auth.current() || {}).email || '');

  async function findFile() {
    try { const id = localStorage.getItem(fileKey()); if (id) return id; } catch (e) { /* ignore */ }
    const r = await request('GET', `${API}/files?q=${encodeURIComponent(`appProperties has { key='app' and value='${APP}' } and trashed=false and mimeType!=${q(FOLDER_MIME)}`)}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc&spaces=drive`);
    const id = r.files && r.files[0] && r.files[0].id;
    if (id) try { localStorage.setItem(fileKey(), id); } catch (e) { /* ignore */ }
    return id || null;
  }
  async function folder() {
    const found = await request('GET', `${API}/files?q=${encodeURIComponent(`mimeType=${q(FOLDER_MIME)} and name=${q(cfg.driveFolder)} and trashed=false`)}&fields=files(id)&spaces=drive`);
    if (found.files && found.files.length) return found.files[0].id;
    const made = await request('POST', `${API}/files?fields=id`, {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: cfg.driveFolder, mimeType: FOLDER_MIME })
    });
    return made.id;
  }
  function multipart(meta, text) {
    const b = 'hw' + Math.random().toString(36).slice(2);
    const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: text/plain\r\n\r\n${text}\r\n--${b}--`;
    return { headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body };
  }

  // Every save file the game can see: ones marked as its own, and ones named like its save file
  // (a file restored or re-uploaded by hand in Drive may lose the mark). Newest first.
  async function listFiles() {
    const mark = `appProperties has { key='app' and value='${APP}' }`;
    const named = `name=${q(cfg.saveFile)}`;
    const r = await request('GET', `${API}/files?q=${encodeURIComponent(`(${mark} or ${named}) and trashed=false and mimeType!=${q(FOLDER_MIME)}`)}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc&spaces=drive`);
    return (r.files || []).map(f => f.id);
  }
  // All save files as [{ id, text }], so the caller can keep the best one.
  async function loadAll() {
    const ids = await listFiles();
    const out = [];
    for (const id of ids) {
      try { out.push({ id, text: await request('GET', `${API}/files/${id}?alt=media`, { text: true }) }); }
      catch (e) { if (e.code !== 'server') throw e; }
    }
    return out;
  }
  // From now on, save into this file
  function use(id) { try { localStorage.setItem(fileKey(), id); } catch (e) { /* ignore */ } }

  // The encrypted save text, or null when there is none yet.
  async function load() {
    let id = await findFile();
    if (!id) return null;
    try { return await request('GET', `${API}/files/${id}?alt=media`, { text: true }); }
    catch (e) {
      if (e.code !== 'server') throw e;
      try { localStorage.removeItem(fileKey()); } catch (x) { /* ignore */ }
      id = await findFile();
      return id ? request('GET', `${API}/files/${id}?alt=media`, { text: true }) : null;
    }
  }
  async function save(text) {
    const id = await findFile();
    if (id) {
      try {
        await request('PATCH', `${UPLOAD}/files/${id}?uploadType=multipart&fields=id`, multipart({}, text));
        return;
      } catch (e) {
        if (e.code !== 'server') throw e;
        try { localStorage.removeItem(fileKey()); } catch (x) { /* ignore */ }
      }
    }
    const parent = await folder();
    const made = await request('POST', `${UPLOAD}/files?uploadType=multipart&fields=id`,
      multipart({ name: cfg.saveFile, parents: [parent], mimeType: 'text/plain', appProperties: { app: APP } }, text));
    try { localStorage.setItem(fileKey(), made.id); } catch (e) { /* ignore */ }
  }

  window.Drive = { load, loadAll, use, save, DriveError };
})();
