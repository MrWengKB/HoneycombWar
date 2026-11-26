/* Honeycomb War · screens and game flow */
(function () {
  'use strict';
  const G = window.HexGame, UI = window.UI, cfg = window.HW_CONFIG;
  const tr = window.I18N.tr, cv = window.I18N.cv, ZH = window.I18N.zh;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const COLORS = ['#2f7de1', '#e0533d', '#21a366', '#8e5bd6', '#f08c00', '#d63a8a', '#0e9aa7', '#5c6b7a', '#c49a00', '#6b4226'];
  const COLOR_NAMES = ZH
    ? Object.fromEntries(Object.entries({ '#2f7de1': '蓝色', '#e0533d': '红色', '#21a366': '绿色', '#8e5bd6': '紫色', '#f08c00': '橙色', '#d63a8a': '粉色', '#0e9aa7': '青色', '#5c6b7a': '石板灰', '#c49a00': '金色', '#6b4226': '棕色' }).map(([k, v]) => [k, cv(v)]))
    : { '#2f7de1': 'Blue', '#e0533d': 'Red', '#21a366': 'Green', '#8e5bd6': 'Purple', '#f08c00': 'Orange', '#d63a8a': 'Pink', '#0e9aa7': 'Teal', '#5c6b7a': 'Slate', '#c49a00': 'Gold', '#6b4226': 'Brown' };
  // Player names as shown: the CPU game's built-in "You" and "CPU" are translated, friends' names are their own
  const nm = pl => pl.cpu ? tr('CPU', '电脑') : pl.name === 'You' ? tr('You', '你') : pl.name;
  const P1 = tr('Player 1', '玩家 1'), P2 = tr('Player 2', '玩家 2');

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
      msg.textContent = ({
        gsi: tr('Could not load Google sign-in. Check your internet connection.', '无法加载 Google 登录，请检查网络连接。'),
        scope: tr('Please allow access to Google Drive, so your game can be saved.', '请允许访问 Google 云端硬盘，这样才能保存你的游戏。'),
        denied: tr('Sign-in was cancelled.', '登录已取消。')
      }[e.code] || tr('Sign-in did not finish. Please try again.', '登录没有完成，请再试一次。')) + (e.detail ? ` (${e.detail})` : '');
    }
  }
  async function guestFlow() {
    const ok = await UI.dialog({
      icon: '⚠️',
      title: tr('Play without signing in?', '不登录直接玩？'),
      body: (window.HWApp
        ? tr('Your level and games will be saved only in this app on this phone. If you uninstall the app or switch phones, your progress is lost.', '你的等级和对局只会保存在这部手机的这个应用里。如果卸载应用或换手机，进度就会丢失。')
        : tr('Your level and games will be saved only in this browser on this device. If you clear the browser data or switch devices, your progress is lost.', '你的等级和对局只会保存在这台设备的这个浏览器里。如果清除浏览器数据或换设备，进度就会丢失。'))
        + tr(' You can sign in later to keep it in Google Drive.', '你可以之后再登录，把进度保存到 Google 云端硬盘。'),
      buttons: [{ label: tr('Back', '返回'), value: false, kind: 'ghost' }, { label: tr('Play without signing in', '不登录直接玩'), value: true, kind: 'primary' }]
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
      UI.dialog({ icon: '🛑', title: tr('Save file could not be opened', '无法打开存档'), body: tr('The saved game data was changed outside the game, or belongs to another account, so it was not used.', '存档数据在游戏外被改动过，或者属于另一个账号，所以没有使用。') });
    }
  }

  /* ---------- menu ---------- */
  function renderMenu() {
    const p = profile();
    const info = G.levelInfo(p.level);
    const user = window.Store.mode() === 'google' ? window.Auth.current() : null;
    $('#who').textContent = user ? tr('Signed in as ', '已登录：') + (user.name || user.email) : window.HWApp ? tr('Progress is saved on this phone', '进度保存在这部手机上') : tr('Playing without signing in', '未登录游戏');
    $('#mLevel').textContent = p.level;
    $('#mLevelInfo').innerHTML = '';
    [[tr('Board', '棋盘'), tr(`${info.side} cells per side`, `每边 ${info.side} 格`)], [tr('Hidden items', '隐藏道具'), info.items], [tr('Mines', '地雷'), info.mines]].concat(info.hives > 1 ? [[tr('Castles', '城堡'), info.hives]] : []).concat([[tr('Start attack / defense', '初始攻击 / 防御'), `${info.attack} / ${info.defense}`]])
      .forEach(([k, v]) => { const d = document.createElement('div'); d.innerHTML = '<span></span><b></b>'; d.firstChild.textContent = k; d.lastChild.textContent = v; $('#mLevelInfo').appendChild(d); });
    $('#mRecord').textContent = tr(`Wins ${p.wins} · Draws ${p.draws} · Losses ${p.losses}`, `胜 ${p.wins} · 平 ${p.draws} · 负 ${p.losses}`) + (p.best > p.level ? tr(` · Best level ${p.best}`, ` · 最高等级 ${p.best}`) : '');
    $('#btnAccount').textContent = user ? tr('Sign out', '退出登录') : tr('Sign in with Google', '使用 Google 登录');
    $('#btnContinue').hidden = !(p.current && p.current.status === 'playing');
    if (p.current) $('#btnContinue').textContent = p.current.mode === 'cpu' ? tr('Continue game vs CPU', '继续对战电脑') : tr('Continue friend game', '继续和朋友的对局');
    $('#optConfirm').checked = prefs().confirm != null ? prefs().confirm : matchMedia('(pointer: coarse)').matches;
    $('#ver').textContent = 'v' + cfg.version + (window.HWApp ? tr(' · Android app', ' · 安卓应用') : '');
    renderSync();
  }
  function renderSync() {
    const bar = $('#syncBar');
    if (!bar || !profile()) return;
    const s = window.Store.sync;
    bar.className = 'sync ' + s;
    bar.innerHTML = '';
    const text = {
      local: tr('Saved on this device only', '只保存在这台设备上'),
      saving: tr('Saving to Google Drive…', '正在保存到 Google 云端硬盘…'),
      saved: tr('Saved in your Google Drive', '已保存到你的 Google 云端硬盘'),
      expired: tr('Google sign-in expired. Your progress is kept on this device until you reconnect.', 'Google 登录已过期。重新连接之前，进度会保存在这台设备上。'),
      error: tr('Could not reach Google Drive. Your progress is kept on this device.', '无法连接 Google 云端硬盘。进度会保存在这台设备上。')
    }[s];
    const span = document.createElement('span');
    span.textContent = text;
    bar.appendChild(span);
    if (s === 'expired' || s === 'error') {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'link'; b.textContent = tr('Reconnect', '重新连接');
      b.addEventListener('click', async () => {
        try { await window.Store.reconnect(); renderMenu(); } catch (e) { UI.toast(tr('Sign-in did not finish.', '登录没有完成。') + (e.detail ? ` (${e.detail})` : '')); }
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
    const mines = G.minesForSide(Number($('#fSide').value) || 5);
    $('#fSetHelp').textContent = cv((ZH
      ? { all: '全部六种道具，外加隐藏的地雷。', positive: '+攻击、+防御、墙和光环。没有地雷。', negative: '只有 −攻击 和 −防御，外加隐藏的地雷。' }
      : { all: 'All six kinds of items, plus hidden mines.', positive: '+attack, +defense, walls and rings. No mines.', negative: '−attack and −defense only, plus hidden mines.' })[choice.fSet]
      + (choice.fSet === 'positive' ? '' : tr(` Mines: ${mines} (a third of the cells per side).`, ` 地雷：${mines} 颗（每边格数的三分之一）。`)));
  }

  async function openCpuSetup() {
    const p = profile();
    if (p.current && p.current.status === 'playing' && p.current.mode === 'cpu') {
      const v = await UI.dialog({
        title: tr('You have a game in progress', '你有一局还没下完'),
        body: tr('Starting a new game counts as retiring the current one, which is a loss.', '开始新游戏会算作认输当前这局，记为一负。'),
        buttons: [{ label: tr('Continue that game', '继续那一局'), value: 'continue', kind: 'primary' }, { label: tr('Retire and start new', '认输并开新局'), value: 'new', kind: 'danger' }]
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
    $('#cpuInfo').textContent = tr(`Level ${info.level}: a board with ${info.side} cells per side, ${info.items} hidden items, ${info.mines} mine${info.mines > 1 ? 's' : ''}, ${info.hives > 1 ? info.hives + ' castles' : 'a castle in the centre'}, and attack ${info.attack} / defense ${info.defense} for both sides.`,
      `第 ${info.level} 级：棋盘每边 ${info.side} 格，${info.items} 个隐藏道具，${info.mines} 颗地雷，${info.hives > 1 ? info.hives + ' 座城堡' : '中心有一座城堡'}，双方攻击 ${info.attack} / 防御 ${info.defense}。`);
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
        title: tr('A friend game is in progress', '和朋友的对局还没下完'),
        body: tr('Start a new one and drop the old game?', '要开新局并放弃旧的那局吗？'),
        buttons: [{ label: tr('Continue that game', '继续那一局'), value: 'continue', kind: 'primary' }, { label: tr('Start new', '开新局'), value: 'new', kind: 'danger' }]
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
    $('#fName0').value = pr.n0 || P1;
    $('#fName1').value = pr.n1 || P2;
    seg('fFirst', pr.first || '0');
    seg('fLayout', pr.layout || 'pass');
    seg('fSet', pr.set || 'all');
    const sel = $('#fSide');
    sel.innerHTML = '';
    for (let s = G.MIN_SIDE; s <= G.MAX_SIDE; s++) {
      const o = document.createElement('option'); o.value = s; o.textContent = tr(`${s} (${G.cellCount(s)} cells)`, `${s}（${G.cellCount(s)} 格）`); sel.appendChild(o);
    }
    sel.value = pr.side || 5;
    const syncItems = keep => {
      const s = Number(sel.value), max = G.maxItems(s);
      $('#fItems').max = max;
      $('#fItemsMax').textContent = tr(`0 to ${max}`, `0 到 ${max}`);
      if (!keep) $('#fItems').value = Math.floor(G.cellCount(s) * 0.12);
    };
    sel.onchange = () => { syncItems(false); setHelp(); };
    syncItems(false);
    setHelp();
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
    const n0 = $('#fName0').value.trim() || P1, n1 = $('#fName1').value.trim() || P2;
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
    UI.clearFeed();
    board.build(game);
    refresh();
    maybeCpu();
    checkHopeless();
  }
  const humanTurn = () => game && game.status === 'playing' && !game.players[game.turn].cpu && !busy;
  const confirmMoves = () => !!$('#optConfirm').checked;

  function hint() {
    if (!humanTurn()) return null;
    const moves = new Map(G.legalMoves(game, game.turn).map(m => [m.idx, m.kind]));
    return { p: game.turn, moves };
  }
  function refresh() {
    $('#gPass').disabled = !humanTurn();
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
        ${G.hivesHeld(game, p) ? `<span class="hivetag" title="${tr(`Holds ${G.hivesHeld(game, p) > 1 ? G.hivesHeld(game, p) + ' castles' : 'a castle'}: +${G.hivesHeld(game, p) * G.hiveBonus(game)} defense`, `拥有 ${G.hivesHeld(game, p)} 座城堡：防御 +${G.hivesHeld(game, p) * G.hiveBonus(game)}`)}">${'⬡'.repeat(G.hivesHeld(game, p))} +${G.hivesHeld(game, p) * G.hiveBonus(game)}🛡</span>` : ''}
        <span class="stat" title="${tr('Attack', '攻击')}"><i>⚔</i><b>${G.atk(game, p)}</b></span>
        <span class="stat" title="${tr('Defense', '防御')}"><i>🛡</i><b>${G.def(game, p)}</b></span>
        <span class="stat" title="${tr('Cells', '格子')}"><i>⬢</i><b>${n[p]}</b></span>`;
      box.querySelector('.pname').textContent = nm(pl) + (game.status === 'playing' && game.turn === p ? (pl.cpu ? tr(' · thinking…', ' · 思考中…') : tr(' · your turn', ' · 轮到你')) : '');
    });
  }
  function setStatus(i) {
    const st = $('#status');
    if (!game) return;
    if (game.status !== 'playing') { st.textContent = tr('Game over', '游戏结束'); return; }
    const pl = game.players[game.turn];
    const rnd = tr(`Round ${G.round(game)} of ${G.maxRounds(game)} · `, `第 ${G.round(game)} / ${G.maxRounds(game)} 回合 · `);
    if (pl.cpu) { st.textContent = rnd + tr('CPU is thinking…', '电脑正在思考…'); return; }
    const kind = i >= 0 ? G.moveKind(game, i, game.turn) : null;
    if (kind === 'attack') {
      const pre = G.previewAttack(game, i, game.turn);
      const def = G.def(game, 1 - game.turn);
      const tail = pre.result === 'capture' ? tr('captures this cell', '夺取这个格子') : pre.result === 'wall' ? tr('breaks 1 wall layer', '打掉 1 层墙') : tr('does nothing', '没有效果');
      st.textContent = rnd + tr(`Attack ${G.atk(game, game.turn)} − defense ${def} = ${pre.dmg}: ${tail}`, `攻击 ${G.atk(game, game.turn)} − 防御 ${def} = ${pre.dmg}：${tail}`) + (confirmMoves() && selected === i ? tr('. Tap again to attack.', '。再点一次进行攻击。') : tr('.', '。'));
    } else if (kind === 'claim') {
      st.textContent = rnd + (confirmMoves() && selected === i ? tr('Tap again to take this cell.', '再点一次占领这个格子。') : tr('Take this cell.', '占领这个格子。'));
    } else if (i >= 0 && game.cells[i].hive && game.cells[i].owner === -1 && !G.hiveOpen(game)) {
      st.textContent = rnd + tr(`A castle can be claimed from round ${G.HIVE_ROUND}.`, `从第 ${G.HIVE_ROUND} 回合起才能占领城堡。`);
    } else if (i >= 0 && game.cells[i].hive && game.cells[i].owner === 1 - game.turn) {
      st.textContent = rnd + tr('A castle can only be taken by surrounding it.', '城堡只能通过包围来夺取。');
    } else {
      const who = game.mode === 'friend' ? pl.name + tr(': ', '：') : '';
      st.textContent = rnd + who + tr('take a grey cell next to yours, or attack an enemy cell next to yours.', '占领一个与你相邻的灰色格子，或攻击一个与你相邻的敌方格子。');
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
    afterMove(ev, p);
  }
  async function afterMove(ev, p) {
    report(ev);
    board.update(null, -1);
    board.flash(ev.changed);
    renderPanels();
    await persist();
    if (ev.end) return finish();
    if (ev.pass) UI.toast(tr(`${nm(game.players[1 - p])} has no move and passes.`, `${nm(game.players[1 - p])}无路可走，跳过。`));
    refresh();
    maybeCpu();
    checkHopeless();
  }
  // Once per game and player: suggest retiring when there is no way back.
  async function checkHopeless() {
    if (!humanTurn()) return;
    const p = game.turn;
    game.retireAsked = game.retireAsked || [false, false];
    if (game.retireAsked[p] || !G.hopeless(game, p)) return;
    game.retireAsked[p] = true;
    persist();
    const pl = game.players[p], op = game.players[1 - p];
    const who = game.mode === 'friend' ? pl.name + ', there' : 'There';
    const v = await UI.dialog({
      icon: '🏳️',
      title: tr('No way back', '无力回天'),
      body: ZH
        ? cv(`${game.mode === 'friend' ? pl.name + '，' : ''}已经没有你能占领的灰色格子了，而且你的攻击（${G.atk(game, p)}）打不过${nm(op)}的防御（${G.def(game, 1 - p)}），所以你无法夺取任何格子。你的格子只会被一个个夺走。现在认输吗？`)
        : `${who} are no grey cells left for you to take, and your attack (${G.atk(game, p)}) can't beat ${op.cpu || op.name === 'CPU' ? "the CPU's" : op.name + "'s"} defense (${G.def(game, 1 - p)}), so you can't capture anything. Your cells can only be captured one by one. Retire now?`,
      buttons: [{ label: tr('Keep playing', '继续下'), value: false, kind: 'ghost' }, { label: tr('Retire', '认输'), value: true, kind: 'danger' }]
    });
    if (v && game && game.status === 'playing' && game.turn === p) { G.retire(game, p); finish(); }
  }
  async function passTurn() {
    if (!humanTurn()) return;
    const p = game.turn;
    const out = G.passOutcome(game);
    const opPl = game.players[1 - p], op = opPl.name;
    const opp = ZH ? nm(opPl) : opPl.cpu || op === 'CPU' ? 'the CPU' : op;
    const dlg = ZH ? {
      lose: { icon: '⚠️', title: '再次跳过？', body: `你上一回合已经跳过了。在${opp}继续行动时连续跳过两次会输掉游戏。`, label: '跳过并认负' },
      count: { icon: '⚖️', title: '结束游戏？', body: `${opp}刚刚跳过了。如果你也跳过，游戏结束，格子多的一方获胜。`, label: '跳过并清点格子' },
      ok: confirmMoves() ? { title: '跳过这一回合？', body: '在对方继续行动时连续跳过两次会输掉游戏。', label: '跳过' } : null
    }[out] : {
      lose: { icon: '⚠️', title: 'Pass again?', body: `You passed last turn. Passing twice in a row while ${opp} keeps playing loses the game.`, label: 'Pass and lose' },
      count: { icon: '⚖️', title: 'End the game?', body: `${opp[0].toUpperCase() + opp.slice(1)} just passed. If you pass too, the game ends and the player with more cells wins.`, label: 'Pass and count cells' },
      ok: confirmMoves() ? { title: 'Pass this turn?', body: 'Passing twice in a row while the other player keeps playing loses the game.', label: 'Pass' } : null
    }[out];
    if (dlg) {
      const v = await UI.dialog({ icon: dlg.icon, title: cv(dlg.title), body: cv(dlg.body), buttons: [{ label: tr('Cancel', '取消'), value: false, kind: 'ghost' }, { label: cv(dlg.label), value: true, kind: out === 'ok' ? 'primary' : 'danger' }] });
      if (!v || !humanTurn() || game.turn !== p) return;
    }
    selected = -1;
    const ev = G.pass(game);
    if (ev.ok) afterMove(ev, p);
  }
  // Only one CPU move can be waiting, and it only plays if it is still the CPU's turn in the same game
  // (leaving for the menu and coming back used to leave a second one waiting, which then moved for you).
  let cpuTimer = null;
  function maybeCpu() {
    clearTimeout(cpuTimer);
    cpuTimer = null;
    if (!game || game.status !== 'playing' || !game.players[game.turn].cpu) { busy = false; return; }
    busy = true;
    refresh();
    const g = game, who = game.turn, at = game.moves;
    cpuTimer = setTimeout(() => {
      cpuTimer = null;
      busy = false;
      if (game !== g || g.status !== 'playing' || g.turn !== who || g.moves !== at || !g.players[who].cpu) return;
      const idx = window.HexCPU.chooseMove(g);
      if (idx >= 0) doMove(idx);
    }, 650);
  }

  function report(ev) {
    const pl = game.players[ev.p];
    const name = nm(pl);
    sounds(ev);
    if (ev.kind === 'pass') { UI.toast(tr(`${name} passed.`, `${name}跳过了。`), pl.color); return; }
    ev.items.forEach(it => {
      const stat = it.type.startsWith('atk') ? tr(` (attack ${G.atk(game, ev.p)})`, `（攻击 ${G.atk(game, ev.p)}）`) : it.type.startsWith('def') ? tr(` (defense ${G.def(game, ev.p)})`, `（防御 ${G.def(game, ev.p)}）`) : '';
      UI.toast(tr(`${name} found ${UI.itemText(it)}${stat}.`, `${name}发现了${UI.itemText(it)}${stat}。`), pl.color);
    });
    if (ev.kind === 'attack') {
      if (ev.result === 'capture') UI.toast(tr(`${name} captured a cell (damage ${ev.dmg}).`, `${name}夺取了一个格子（伤害 ${ev.dmg}）。`), pl.color);
      else if (ev.result === 'wall') UI.toast(tr(`${name} broke 1 wall layer; ${ev.wallsLeft} left.`, `${name}打掉了 1 层墙，还剩 ${ev.wallsLeft} 层。`), pl.color);
      else UI.toast(tr(`${name} attacked, but damage was ${ev.dmg}. Nothing happened.`, `${name}发动了攻击，但伤害是 ${ev.dmg}，没有效果。`), pl.color);
    }
    (ev.lost || []).forEach(l => {
      const who = nm(game.players[l.p]);
      UI.toast(tr(`${who} lost a captured cell's +${l.value} ${l.type === 'atk+' ? 'attack' : 'defense'}.`, `${who}的格子被夺走，失去了 +${l.value} ${l.type === 'atk+' ? '攻击' : '防御'}。`), game.players[l.p].color);
    });
    if (ev.hive) {
      const held = G.hivesHeld(game, ev.p), all = G.hives(game).length;
      const tally = all > 1 ? tr(` Now holding ${held} of ${all}.`, `现在拥有 ${all} 座中的 ${held} 座。`) : '';
      UI.toast((ev.hiveTaken ? tr(`${name} surrounded and took a castle!`, `${name}包围并夺取了一座城堡！`) : tr(`${name} claimed a castle!`, `${name}占领了一座城堡！`)) + tr(` (+${G.hiveBonus(game)} defense each)`, `（每座防御 +${G.hiveBonus(game)}）`) + tally, pl.color);
    }
    if (ev.blast) {
      const d = ev.destroyed || [0, 0];
      const lostTxt = [0, 1].filter(q => d[q]).map(q => tr(`${nm(game.players[q])} lost ${d[q]} cell${d[q] > 1 ? 's' : ''}`, `${nm(game.players[q])}失去 ${d[q]} 格`)).join(tr(', ', '，'));
      UI.toast(tr(`💥 ${name} hit a mine! ${ev.blast.length} cells turned black for good${lostTxt ? ` (${lostTxt})` : ''}.`, `💥 ${name}踩到了地雷！${ev.blast.length} 个格子永久变黑${lostTxt ? `（${lostTxt}）` : ''}。`), pl.color);
    }
    if (ev.enclosed) UI.toast(tr(`${name} enclosed an area and took ${ev.enclosed} cell${ev.enclosed > 1 ? 's' : ''}!`, `${name}包围了一片区域，拿下 ${ev.enclosed} 个格子！`), pl.color);
  }

  // The sounds for one move, played one after another
  function sounds(ev) {
    const list = [];
    if (ev.kind === 'pass') list.push('pass');
    else if (ev.kind === 'claim') list.push(ev.blast ? 'boom' : 'ding');
    else if (ev.result === 'capture') list.push('clash');
    else if (ev.result === 'wall') list.push('wall');
    else list.push('bonk');
    if (ev.blast && ev.kind === 'attack') list.push('boom');
    ev.items.forEach(it => list.push(it.type === 'atk-' || it.type === 'def-' ? 'uhoh' : it.type === 'ring' ? 'ring' : 'happy'));
    if (ev.enclosed) list.push('enclose');
    if (ev.taken && ev.kind !== 'attack') list.push('clash'); // enemy cells taken by a ring or an enclosure
    if (ev.hive) list.push('happy');
    if ((ev.lost || []).length) list.push('uhoh');
    window.Sound.play(list.slice(0, 5));
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
    const n0 = nm(g.players[0]), n1 = nm(g.players[1]);
    const cells = tr(` Cells: ${n0} ${n[0]}, ${n1} ${n[1]}.`, `格子：${n0} ${n[0]}，${n1} ${n[1]}。`);
    const loserPl = g.players[1 - g.winner];
    const loser = loserPl ? nm(loserPl) : '';
    // Whose base: "Your base" / "CPU's base" against the CPU, the entered names in friend games
    const baseOf = !loserPl ? tr('The base', '基地')
      : loserPl.cpu ? tr("CPU's base", '电脑的基地')
      : g.mode === 'cpu' ? tr('Your base', '你的基地')
      : tr(`${loserPl.name}'s base`, `${loserPl.name}的基地`);
    const why = cv((ZH ? {
      surround: `${baseOf}被包围了。`,
      retire: `${loser}认输了。`,
      forfeit: `${loser}连续跳过了两次。`,
      passes: '双方都跳过了。' + cells,
      stalemate: '棋盘已满，且 2 个回合内没有人夺取格子。' + cells,
      standstill: '3 个回合内双方的格子数都没有变化。' + cells,
      limit: `已达到回合上限（${G.maxRounds(g)} 回合）。` + cells,
      stuck: '谁都无法行动。' + cells
    } : {
      surround: `${baseOf} was surrounded.`,
      retire: `${loser} retired.`,
      forfeit: `${loser} passed twice in a row.`,
      passes: 'Both players passed.' + cells,
      stalemate: 'The board is full and nobody captured anything for 2 rounds.' + cells,
      standstill: "Neither side's number of cells changed for 3 rounds." + cells,
      limit: `The round limit (${G.maxRounds(g)} rounds) was reached.` + cells,
      stuck: 'Nobody can move.' + cells
    })[g.reason] || '');
    const delay = 0.6;
    setTimeout(() => window.Sound.play(g.status === 'draw' ? 'draw' : g.mode === 'cpu' && g.winner === 1 ? 'lose' : 'win'), delay * 1000);
    let title, icon;
    if (g.status === 'draw') { title = tr('Draw', '平局'); icon = '🤝'; }
    else if (g.mode === 'cpu') { title = g.winner === 0 ? tr('You win!', '你赢了！') : tr('The CPU wins', '电脑赢了'); icon = g.winner === 0 ? '🏆' : '🐝'; }
    else { title = g.players[g.winner].name + tr(' wins!', '获胜！'); icon = '🏆'; }
    let body = why;
    if (lv && lv.after > lv.before) {
      const info = G.levelInfo(lv.after);
      body += tr(` Level up: you are now level ${lv.after}. Next board: ${info.side} cells per side with ${info.items} hidden items.`, `升级了：你现在是第 ${lv.after} 级。下一个棋盘：每边 ${info.side} 格，${info.items} 个隐藏道具。`);
    }
    const v = await UI.dialog({
      icon, title, body, dismiss: false,
      buttons: [{ label: tr('Menu', '菜单'), value: 'menu', kind: 'ghost' }, { label: g.mode === 'cpu' ? (g.winner === 1 ? tr('Try again', '再试一次') : tr('Next level', '下一级')) : tr('Play again', '再来一局'), value: 'again', kind: 'primary' }]
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
        title: tr('Who retires?', '谁认输？'), body: tr('The other player wins.', '另一方获胜。'),
        buttons: [{ label: tr('Cancel', '取消'), value: null, kind: 'ghost' }, { label: game.players[1].name, value: 1, kind: 'danger' }, { label: game.players[0].name, value: 0, kind: 'danger' }]
      });
      if (v === null || v === undefined) return;
      p = v;
    } else {
      const ok = await UI.dialog({ title: tr('Retire?', '认输？'), body: tr('The CPU wins this game and your level stays the same.', '这局算电脑赢，你的等级保持不变。'), buttons: [{ label: tr('Keep playing', '继续下'), value: false, kind: 'ghost' }, { label: tr('Retire', '认输'), value: true, kind: 'danger' }] });
      if (!ok) return;
    }
    G.retire(game, p);
    finish();
  }

  function howTo() {
    UI.dialog({ title: tr('How to play', '游戏规则'), html: document.importNode($(ZH ? '#howTplZh' : '#howTpl').content, true) });
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
    $('#gMenu').addEventListener('click', () => { clearTimeout(cpuTimer); cpuTimer = null; busy = false; game = null; renderMenu(); show('menu'); });
    $('#gRetire').addEventListener('click', retireGame);
    $('#gPass').addEventListener('click', passTurn);
    const snd = $('#gSound');
    const showSnd = () => { snd.textContent = window.Sound.on ? '🔊' : '🔇'; snd.setAttribute('aria-label', window.Sound.on ? tr('Sound on', '声音开') : tr('Sound off', '声音关')); snd.title = snd.getAttribute('aria-label'); };
    snd.addEventListener('click', () => { window.Sound.setOn(!window.Sound.on); showSnd(); });
    showSnd();
    $('#gZoomIn').addEventListener('click', () => board && board.setZoom(board.zoom * 1.4));
    $('#gZoomOut').addEventListener('click', () => board && board.setZoom(board.zoom / 1.4));
    $('#optMusic').checked = window.Music.on;
    $('#optMusic').addEventListener('change', e => window.Music.setOn(e.target.checked));
    $('#btnCredits').addEventListener('click', () => {
      const box = document.createElement('div');
      box.className = 'credits';
      box.innerHTML = ZH ? cv(`<p>背景音乐：<b>“New Sunrise”</b>，来自
        <a href="https://opengameart.org/content/new-sunrise" target="_blank" rel="noopener">OpenGameArt.org</a>。</p>
        <p>许可协议：<a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener">CC0 1.0 通用（公共领域贡献）</a>。
        无需署名，但仍要感谢它的创作者。</p>
        <p><a href="https://github.com/MrWengKB/ELAdventure" target="_blank" rel="noopener">ELAdventure</a> 里也用了同一首曲子。</p>
        <p>音效由游戏本身在浏览器里生成。</p>`) : `<p>Background music: <b>“New Sunrise”</b>, from
        <a href="https://opengameart.org/content/new-sunrise" target="_blank" rel="noopener">OpenGameArt.org</a>.</p>
        <p>License: <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener">CC0 1.0 Universal (Public Domain Dedication)</a>.
        No attribution is required, but thank you to its creator.</p>
        <p>The same track plays in <a href="https://github.com/MrWengKB/ELAdventure" target="_blank" rel="noopener">ELAdventure</a>.</p>
        <p>Sound effects are generated in the browser by the game itself.</p>`;
      UI.dialog({ title: tr('Music credits', '音乐来源'), html: box });
    });
    $('#optConfirm').addEventListener('change', e => { prefs().confirm = e.target.checked; window.Store.save(); });
    $('#btnAccount').addEventListener('click', async () => {
      if (window.Store.mode() === 'google' && window.Auth.current()) {
        const ok = await UI.dialog({ title: tr('Sign out?', '退出登录？'), body: tr('Your progress stays in your Google Drive. Signing out on this device shows the welcome screen.', '你的进度会留在你的 Google 云端硬盘里。在这台设备上退出后会回到欢迎页面。'), buttons: [{ label: tr('Cancel', '取消'), value: false, kind: 'ghost' }, { label: tr('Sign out', '退出登录'), value: true, kind: 'primary' }] });
        if (!ok) return;
        window.Auth.signOut();
        window.Store.setMode(null);
        show('welcome');
      } else {
        try { await window.Auth.signIn(); window.Store.setMode('google'); await enterMenu(); }
        catch (e) { UI.toast(tr('Sign-in did not finish.', '登录没有完成。') + (e.detail ? ` (${e.detail})` : '')); }
      }
    });
    window.Store.onSync(renderSync);
    initSegs();
  }

  // Android app (window.HWApp from the app): play on this device, no Google sign-in
  const inApp = !!window.HWApp;
  function wireApp() {
    if (!inApp) return;
    document.body.classList.add('in-app');
    $('#btnSupport').addEventListener('click', () => window.HWApp.support());
    $('#btnUpdates').addEventListener('click', () => window.HWApp.checkUpdates());
    // The Google Play version gets updates from Play, so it has no "Check for updates"
    if (window.HWApp.canCheckUpdates && !window.HWApp.canCheckUpdates()) {
      const btn = $('#btnUpdates');
      if (btn.nextElementSibling) btn.nextElementSibling.remove(); // the "·" after it
      btn.remove();
    }
    // Back button: close a dialog, or go back to the menu; false lets the app close
    window.hwBack = () => {
      const modals = document.querySelectorAll('.modal');
      if (modals.length) {
        const m = modals[modals.length - 1];
        const b = m.querySelector('.btn.ghost') || m.querySelector('.btn');
        if (b) b.click(); else m.remove();
        return true;
      }
      if (!$('#game').hidden) { $('#gMenu').click(); return true; }
      if (!$('#setupCpu').hidden || !$('#setupFriend').hidden) { renderMenu(); show('menu'); return true; }
      return false;
    };
  }

  async function boot() {
    wire();
    wireApp();
    const mode = window.Store.mode();
    if (mode === 'guest' || (mode === 'google' && window.Auth.current())) await enterMenu();
    else show('welcome');
  }
  boot();
})();
