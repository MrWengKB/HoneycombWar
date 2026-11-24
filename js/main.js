/* Honeycomb War · screens and game flow */
(function () {
  'use strict';
  const G = window.HexGame, UI = window.UI, cfg = window.HW_CONFIG;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const COLORS = ['#2f7de1', '#e0533d', '#21a366', '#8e5bd6', '#f08c00', '#d63a8a', '#0e9aa7', '#5c6b7a', '#c49a00', '#6b4226'];
  const COLOR_NAMES = { '#2f7de1': 'Blue', '#e0533d': 'Red', '#21a366': 'Green', '#8e5bd6': 'Purple', '#f08c00': 'Orange', '#d63a8a': 'Pink', '#0e9aa7': 'Teal', '#5c6b7a': 'Slate', '#c49a00': 'Gold', '#6b4226': 'Brown' };

  let game = null;
  let board = null;
  let selected = -1;
  let busy = false;
  const choice = {};

  /* ---------- screens ---------- */
  function show(id) {
    $$('.screen').forEach(s => { s.hidden = s.id !== id; });
    document.body.classList.toggle('ingame', id === 'game');
    if (id === 'game' && board) requestAnimationFrame(() => board.fit());
  }
  const profile = () => window.Store.profile;
  const prefs = () => profile().prefs || (profile().prefs = {});

  /* ---------- welcome / sign-in ---------- */
  async function signInFlow() {
    const msg = $('#welcomeMsg');
    msg.hidden = true;
    try {
      await window.Auth.signIn();
      window.Store.setMode('google');
      await enterMenu();
    } catch (e) {
      msg.hidden = false;
      msg.textContent = {
        gsi: 'Could not load Google sign-in. Check your internet connection.',
        scope: 'Please allow access to Google Drive, so your game can be saved.',
        denied: 'Sign-in was cancelled.'
      }[e.code] || 'Sign-in did not finish. Please try again.';
    }
  }
  async function guestFlow() {
    const ok = await UI.dialog({
      icon: '⚠️',
      title: 'Play without signing in?',
      body: 'Your level and games will be saved only in this browser on this device. If you clear the browser data or switch devices, your progress is lost. You can sign in later to keep it in Google Drive.',
      buttons: [{ label: 'Back', value: false, kind: 'ghost' }, { label: 'Play without signing in', value: true, kind: 'primary' }]
    });
    if (!ok) return;
    window.Store.setMode('guest');
    await enterMenu();
  }

  async function enterMenu() {
    const { warnings } = await window.Store.load();
    renderMenu();
    show('menu');
    if (warnings.includes('localTampered') || warnings.includes('cloudTampered')) {
      UI.dialog({ icon: '🛑', title: 'Save file could not be opened', body: 'The saved game data was changed outside the game, or belongs to another account, so it was not used.' });
    }
  }

  /* ---------- menu ---------- */
  function renderMenu() {
    const p = profile();
    const info = G.levelInfo(p.level);
    const user = window.Store.mode() === 'google' ? window.Auth.current() : null;
    $('#who').textContent = user ? 'Signed in as ' + (user.name || user.email) : 'Playing without signing in';
    $('#mLevel').textContent = p.level;
    $('#mLevelInfo').innerHTML = '';
    [['Board', `${info.side} cells per side`], ['Hidden items', info.items], ['Start attack / defense', `${info.attack} / ${info.defense}`]]
      .forEach(([k, v]) => { const d = document.createElement('div'); d.innerHTML = '<span></span><b></b>'; d.firstChild.textContent = k; d.lastChild.textContent = v; $('#mLevelInfo').appendChild(d); });
    $('#mRecord').textContent = `Wins ${p.wins} · Draws ${p.draws} · Losses ${p.losses}` + (p.best > p.level ? ` · Best level ${p.best}` : '');
    $('#btnAccount').textContent = user ? 'Sign out' : 'Sign in with Google';
    $('#btnContinue').hidden = !(p.current && p.current.status === 'playing');
    if (p.current) $('#btnContinue').textContent = p.current.mode === 'cpu' ? 'Continue game vs CPU' : 'Continue friend game';
    $('#optConfirm').checked = prefs().confirm != null ? prefs().confirm : matchMedia('(pointer: coarse)').matches;
    $('#ver').textContent = 'v' + cfg.version;
    renderSync();
  }
  function renderSync() {
    const bar = $('#syncBar');
    if (!bar || !profile()) return;
    const s = window.Store.sync;
    bar.className = 'sync ' + s;
    bar.innerHTML = '';
    const text = {
      local: 'Saved on this device only',
      saving: 'Saving to Google Drive…',
      saved: 'Saved in your Google Drive',
      expired: 'Google sign-in expired. Your progress is kept on this device until you reconnect.',
      error: 'Could not reach Google Drive. Your progress is kept on this device.'
    }[s];
    const span = document.createElement('span');
    span.textContent = text;
    bar.appendChild(span);
    if (s === 'expired' || s === 'error') {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'link'; b.textContent = 'Reconnect';
      b.addEventListener('click', async () => {
        try { await window.Store.reconnect(); renderMenu(); } catch (e) { UI.toast('Sign-in did not finish.'); }
      });
      bar.appendChild(b);
    }
  }

  /* ---------- setup ---------- */
  function swatches(container, key, fallback, otherKey) {
    container.innerHTML = '';
    COLORS.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sw'; b.style.background = c;
      b.title = COLOR_NAMES[c]; b.setAttribute('aria-label', COLOR_NAMES[c]);
      b.addEventListener('click', () => {
        if (choice[otherKey] === c) choice[otherKey] = choice[key];
        choice[key] = c;
        refreshSwatches();
      });
      b.dataset.c = c;
      container.appendChild(b);
    });
    if (!choice[key]) choice[key] = fallback;
  }
  function refreshSwatches() {
    $$('.swatches').forEach(box => {
      const key = box.dataset.for;
      box.querySelectorAll('.sw').forEach(b => {
        b.classList.toggle('on', b.dataset.c === choice[key]);
        b.setAttribute('aria-pressed', b.dataset.c === choice[key]);
      });
    });
  }
  function seg(key, value) {
    const box = document.querySelector(`.seg[data-for="${key}"]`);
    if (value !== undefined) choice[key] = value;
    box.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === String(choice[key])));
  }
  function initSegs() {
    $$('.seg').forEach(box => box.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      seg(box.dataset.for, b.dataset.v);
      if (box.dataset.for === 'fSet') setHelp();
    }));
  }
  function setHelp() {
    $('#fSetHelp').textContent = { all: 'All six kinds of items.', positive: '+attack, +defense, walls and rings.', negative: '−attack and −defense only.' }[choice.fSet];
  }

  async function openCpuSetup() {
    const p = profile();
    if (p.current && p.current.status === 'playing' && p.current.mode === 'cpu') {
      const v = await UI.dialog({
        title: 'You have a game in progress',
        body: 'Starting a new game counts as retiring the current one, which is a loss.',
        buttons: [{ label: 'Continue that game', value: 'continue', kind: 'primary' }, { label: 'Retire and start new', value: 'new', kind: 'danger' }]
      });
      if (v === 'continue') return resume();
      if (v !== 'new') return;
      G.restore(p.current);
      G.retire(p.current, 0);
      recordResult(p.current);
      p.current = null;
      await window.Store.save();
      renderMenu();
    }
    const info = G.levelInfo(p.level);
    $('#cpuInfo').textContent = `Level ${info.level}: a board with ${info.side} cells per side, ${info.items} hidden items, and attack ${info.attack} / defense ${info.defense} for both sides.`;
    const pr = prefs();
    choice.cpuMe = pr.cpuMe || COLORS[0];
    choice.cpuThem = pr.cpuThem || COLORS[1];
    swatches($('.swatches[data-for="cpuMe"]'), 'cpuMe', COLORS[0], 'cpuThem');
    swatches($('.swatches[data-for="cpuThem"]'), 'cpuThem', COLORS[1], 'cpuMe');
    refreshSwatches();
    seg('cpuFirst', pr.cpuFirst || '0');
    show('setupCpu');
  }

  async function openFriendSetup() {
    const p = profile();
    if (p.current && p.current.status === 'playing' && p.current.mode === 'friend') {
      const v = await UI.dialog({
        title: 'A friend game is in progress',
        body: 'Start a new one and drop the old game?',
        buttons: [{ label: 'Continue that game', value: 'continue', kind: 'primary' }, { label: 'Start new', value: 'new', kind: 'danger' }]
      });
      if (v === 'continue') return resume();
      if (v !== 'new') return;
    }
    const pr = prefs().friend || {};
    choice.f0 = pr.c0 || COLORS[0];
    choice.f1 = pr.c1 || COLORS[1];
    swatches($('.swatches[data-for="f0"]'), 'f0', COLORS[0], 'f1');
    swatches($('.swatches[data-for="f1"]'), 'f1', COLORS[1], 'f0');
    refreshSwatches();
    $('#fName0').value = pr.n0 || 'Player 1';
    $('#fName1').value = pr.n1 || 'Player 2';
    seg('fFirst', pr.first || '0');
    seg('fLayout', pr.layout || 'pass');
    seg('fSet', pr.set || 'all');
    setHelp();
    const sel = $('#fSide');
    sel.innerHTML = '';
    for (let s = G.MIN_SIDE; s <= G.MAX_SIDE; s++) {
      const o = document.createElement('option'); o.value = s; o.textContent = `${s} (${G.cellCount(s)} cells)`; sel.appendChild(o);
    }
    sel.value = pr.side || 5;
    const syncItems = keep => {
      const s = Number(sel.value), max = G.maxItems(s);
      $('#fItems').max = max;
      $('#fItemsMax').textContent = `0 to ${max}`;
      if (!keep) $('#fItems').value = Math.floor(G.cellCount(s) * 0.12);
    };
    sel.onchange = () => syncItems(false);
    syncItems(false);
    if (pr.items != null && Number(pr.side) === Number(sel.value)) $('#fItems').value = pr.items;
    $('#fStrength').value = pr.strength || 1;
    show('setupFriend');
  }

  function firstFrom(v) { return v === 'r' ? (Math.random() < 0.5 ? 0 : 1) : Number(v); }

  async function startCpu() {
    const p = profile();
    Object.assign(prefs(), { cpuMe: choice.cpuMe, cpuThem: choice.cpuThem, cpuFirst: choice.cpuFirst });
    game = G.createGame({
      mode: 'cpu', level: p.level, first: firstFrom(choice.cpuFirst),
      players: [{ name: 'You', color: choice.cpuMe }, { name: 'CPU', color: choice.cpuThem, cpu: true }]
    });
    p.current = game;
    await window.Store.save();
    openGame();
  }
  async function startFriend() {
    const side = Number($('#fSide').value);
    const items = Math.max(0, Math.min(G.maxItems(side), Math.floor(Number($('#fItems').value) || 0)));
    const strength = Math.max(1, Math.min(50, Math.floor(Number($('#fStrength').value) || 1)));
    const n0 = $('#fName0').value.trim() || 'Player 1', n1 = $('#fName1').value.trim() || 'Player 2';
    prefs().friend = { c0: choice.f0, c1: choice.f1, n0, n1, first: choice.fFirst, layout: choice.fLayout, set: choice.fSet, side, items, strength };
    game = G.createGame({
      mode: 'friend', level: 1, side, items, itemSet: choice.fSet, strength, layout: choice.fLayout, first: firstFrom(choice.fFirst),
      players: [{ name: n0, color: choice.f0 }, { name: n1, color: choice.f1 }]
    });
    profile().current = game;
    await window.Store.save();
    openGame();
  }
  function resume() {
    game = G.restore(profile().current);
    openGame();
  }

  /* ---------- playing ---------- */
  function openGame() {
    selected = -1;
    busy = false;
    document.body.classList.toggle('face', game.mode === 'friend' && game.layout === 'face');
    show('game');
    if (!board) {
      board = new UI.Board($('#board'), $('#boardWrap'));
      board.onCell = onCell;
      board.onHover = i => setStatus(i);
    }
    board.zoom = 1;
    board.build(game);
    refresh();
    maybeCpu();
  }
  const humanTurn = () => game && game.status === 'playing' && !game.players[game.turn].cpu && !busy;
  const confirmMoves = () => !!$('#optConfirm').checked;

  function hint() {
    if (!humanTurn()) return null;
    const moves = new Map(G.legalMoves(game, game.turn).map(m => [m.idx, m.kind]));
    return { p: game.turn, moves };
  }
  function refresh() {
    board.update(hint(), selected);
    renderPanels();
    setStatus(selected);
  }
  function renderPanels() {
    const n = G.score(game);
    [0, 1].forEach(p => {
      const pl = game.players[p];
      const box = $('#panel' + p);
      box.style.setProperty('--pc', pl.color);
      box.classList.toggle('active', game.status === 'playing' && game.turn === p);
      box.innerHTML = `<span class="dot"></span><span class="pname"></span>
        <span class="stat" title="Attack"><i>⚔</i><b>${pl.atk}</b></span>
        <span class="stat" title="Defense"><i>🛡</i><b>${pl.def}</b></span>
        <span class="stat" title="Cells"><i>⬢</i><b>${n[p]}</b></span>`;
      box.querySelector('.pname').textContent = pl.name + (game.status === 'playing' && game.turn === p ? (pl.cpu ? ' · thinking…' : ' · your turn') : '');
    });
  }
  function setStatus(i) {
    const st = $('#status');
    if (!game) return;
    if (game.status !== 'playing') { st.textContent = 'Game over'; return; }
    const pl = game.players[game.turn];
    if (pl.cpu) { st.textContent = 'CPU is thinking…'; return; }
    const kind = i >= 0 ? G.moveKind(game, i, game.turn) : null;
    if (kind === 'attack') {
      const pre = G.previewAttack(game, i, game.turn);
      const def = game.players[1 - game.turn].def;
      const tail = pre.result === 'capture' ? 'captures this cell' : pre.result === 'wall' ? 'breaks 1 wall layer' : 'does nothing';
      st.textContent = `Attack ${pl.atk} − defense ${def} = ${pre.dmg}: ${tail}` + (confirmMoves() && selected === i ? '. Tap again to attack.' : '.');
    } else if (kind === 'claim') {
      st.textContent = confirmMoves() && selected === i ? 'Tap again to take this cell.' : 'Take this cell.';
    } else {
      const who = game.mode === 'friend' ? pl.name + ': ' : '';
      st.textContent = who + 'take a grey cell next to yours, or attack an enemy cell next to yours.';
    }
  }

  function onCell(i) {
    if (!humanTurn()) return;
    const kind = G.moveKind(game, i, game.turn);
    if (!kind) { selected = -1; refresh(); return; }
    if (confirmMoves() && selected !== i) { selected = i; refresh(); return; }
    selected = -1;
    doMove(i);
  }

  async function doMove(i) {
    const p = game.turn;
    const ev = G.play(game, i);
    if (!ev.ok) return;
    report(ev);
    board.update(null, -1);
    board.flash(ev.changed);
    renderPanels();
    await persist();
    if (ev.end) return finish();
    if (ev.pass) UI.toast(`${game.players[1 - p].name} has no move and passes.`);
    refresh();
    maybeCpu();
  }
  function maybeCpu() {
    if (!game || game.status !== 'playing' || !game.players[game.turn].cpu) return;
    busy = true;
    refresh();
    setTimeout(() => {
      if (!game || game.status !== 'playing') return;
      const idx = window.HexCPU.chooseMove(game);
      busy = false;
      if (idx >= 0) doMove(idx);
    }, 650);
  }

  function report(ev) {
    const pl = game.players[ev.p];
    const name = pl.name === 'You' ? 'You' : pl.name;
    const found = name === 'You' ? 'found' : 'found';
    ev.items.forEach(it => UI.toast(`${name} ${found} ${UI.itemText(it)}${it.type.startsWith('atk') ? ` (attack ${pl.atk})` : it.type.startsWith('def') ? ` (defense ${pl.def})` : ''}.`, pl.color));
    if (ev.kind === 'attack') {
      if (ev.result === 'capture') UI.toast(`${name} captured a cell (damage ${ev.dmg}).`, pl.color);
      else if (ev.result === 'wall') UI.toast(`${name} broke 1 wall layer; ${ev.wallsLeft} left.`, pl.color);
      else UI.toast(`${name} attacked, but damage was ${ev.dmg}. Nothing happened.`, pl.color);
    }
    if (ev.enclosed) UI.toast(`${name} enclosed an area and took ${ev.enclosed} cell${ev.enclosed > 1 ? 's' : ''}!`, pl.color);
  }

  async function persist() {
    profile().current = game;
    await window.Store.save();
  }

  function recordResult(g) {
    if (g.mode !== 'cpu') return null;
    const p = profile();
    const before = p.level;
    if (g.winner === 0) p.wins++;
    else if (g.winner === 1) p.losses++;
    else p.draws++;
    if (g.winner !== 1) p.level++;
    p.best = Math.max(p.best || 1, p.level);
    return { before, after: p.level };
  }

  async function finish() {
    const g = game;
    const lv = recordResult(g);
    profile().current = null;
    await window.Store.save();
    refresh();
    const n = G.score(g);
    const why = {
      surround: 'The base was surrounded.',
      retire: 'Retired.',
      stalemate: `The board is full and nobody captured anything for 2 rounds. Cells: ${g.players[0].name} ${n[0]}, ${g.players[1].name} ${n[1]}.`,
      limit: `The game went on too long. Cells: ${g.players[0].name} ${n[0]}, ${g.players[1].name} ${n[1]}.`,
      stuck: `Nobody can move. Cells: ${g.players[0].name} ${n[0]}, ${g.players[1].name} ${n[1]}.`
    }[g.reason] || '';
    let title, icon;
    if (g.status === 'draw') { title = 'Draw'; icon = '🤝'; }
    else if (g.mode === 'cpu') { title = g.winner === 0 ? 'You win!' : 'The CPU wins'; icon = g.winner === 0 ? '🏆' : '🐝'; }
    else { title = g.players[g.winner].name + ' wins!'; icon = '🏆'; }
    let body = why;
    if (lv && lv.after > lv.before) {
      const info = G.levelInfo(lv.after);
      body += ` Level up: you are now level ${lv.after}. Next board: ${info.side} cells per side with ${info.items} hidden items.`;
    }
    const v = await UI.dialog({
      icon, title, body, dismiss: false,
      buttons: [{ label: 'Menu', value: 'menu', kind: 'ghost' }, { label: g.mode === 'cpu' ? (g.winner === 1 ? 'Try again' : 'Next level') : 'Play again', value: 'again', kind: 'primary' }]
    });
    renderMenu();
    if (v === 'again') { if (g.mode === 'cpu') openCpuSetup(); else openFriendSetup(); }
    else { game = null; show('menu'); }
  }

  async function retireGame() {
    if (!game || game.status !== 'playing') return;
    let p = 0;
    if (game.mode === 'friend') {
      const v = await UI.dialog({
        title: 'Who retires?', body: 'The other player wins.',
        buttons: [{ label: 'Cancel', value: null, kind: 'ghost' }, { label: game.players[1].name, value: 1, kind: 'danger' }, { label: game.players[0].name, value: 0, kind: 'danger' }]
      });
      if (v === null || v === undefined) return;
      p = v;
    } else {
      const ok = await UI.dialog({ title: 'Retire?', body: 'The CPU wins this game and your level stays the same.', buttons: [{ label: 'Keep playing', value: false, kind: 'ghost' }, { label: 'Retire', value: true, kind: 'danger' }] });
      if (!ok) return;
    }
    G.retire(game, p);
    finish();
  }

  function howTo() {
    UI.dialog({ title: 'How to play', html: document.importNode($('#howTpl').content, true) });
  }

  /* ---------- start ---------- */
  function wire() {
    $('#btnGoogle').addEventListener('click', signInFlow);
    $('#btnGuest').addEventListener('click', guestFlow);
    $('#btnCpu').addEventListener('click', openCpuSetup);
    $('#btnFriend').addEventListener('click', openFriendSetup);
    $('#btnContinue').addEventListener('click', resume);
    $('#btnHow').addEventListener('click', howTo);
    $('#gHelp').addEventListener('click', howTo);
    $('#startCpu').addEventListener('click', startCpu);
    $('#startFriend').addEventListener('click', startFriend);
    $$('[data-back]').forEach(b => b.addEventListener('click', () => { renderMenu(); show('menu'); }));
    $('#gMenu').addEventListener('click', () => { game = null; renderMenu(); show('menu'); });
    $('#gRetire').addEventListener('click', retireGame);
    $('#gZoomIn').addEventListener('click', () => board && board.setZoom(board.zoom * 1.4));
    $('#gZoomOut').addEventListener('click', () => board && board.setZoom(board.zoom / 1.4));
    $('#optConfirm').addEventListener('change', e => { prefs().confirm = e.target.checked; window.Store.save(); });
    $('#btnAccount').addEventListener('click', async () => {
      if (window.Store.mode() === 'google' && window.Auth.current()) {
        const ok = await UI.dialog({ title: 'Sign out?', body: 'Your progress stays in your Google Drive. Signing out on this device shows the welcome screen.', buttons: [{ label: 'Cancel', value: false, kind: 'ghost' }, { label: 'Sign out', value: true, kind: 'primary' }] });
        if (!ok) return;
        window.Auth.signOut();
        window.Store.setMode(null);
        show('welcome');
      } else {
        try { await window.Auth.signIn(); window.Store.setMode('google'); await enterMenu(); }
        catch (e) { UI.toast('Sign-in did not finish.'); }
      }
    });
    window.Store.onSync(renderSync);
    initSegs();
  }

  async function boot() {
    wire();
    const mode = window.Store.mode();
    if (mode === 'guest' || (mode === 'google' && window.Auth.current())) await enterMenu();
    else show('welcome');
  }
  boot();
})();
