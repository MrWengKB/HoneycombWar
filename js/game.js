/* Honeycomb War · game rules (no DOM, so it also runs in Node for tests)
 *
 * Board: a big hexagon of pointy-top hex cells in axial coordinates (q, r), radius R = side - 1.
 * Rows are r = -R (top) ... R (bottom). Player 0 plays from the bottom, player 1 from the top.
 */
(function (root) {
  'use strict';

  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  const ITEM_TYPES = ['atk+', 'atk-', 'def+', 'def-', 'wall', 'ring'];
  const ITEM_SETS = {
    all: ITEM_TYPES,
    positive: ['atk+', 'def+', 'wall', 'ring'],
    negative: ['atk-', 'def-']
  };
  const MIN_SIDE = 5;
  const MAX_SIDE = 15;
  const BASE_ATTACK = 1;   // starting attack = BASE_ATTACK × level
  const BASE_DEFENSE = 1;  // starting defense = BASE_DEFENSE × level
  const DRAW_MOVES = 4;
  const HIVE_ROUND = 3;     // the centre cell can be claimed from this round on
  // While you hold the centre: +defense by level (friend games: by the starting strength).
  // Levels 1-4: the level; 5-6: level-1; 7-8: level-2; 9-10: level-3; 11-12: level-4; then 8.
  function hiveBonusFor(level) {
    const L = Math.max(1, level);
    if (L <= 4) return L;
    if (L <= 12) return L - Math.ceil((L - 4) / 2);
    return 8;
  }
  // How many castles: 1, then 2 from level 50, 3 from level 100, 4 from level 200 and 5 (the most) from level 350.
  function hivesForLevel(level) { return level >= 350 ? 5 : level >= 200 ? 4 : level >= 100 ? 3 : level >= 50 ? 2 : 1; }    // 2 rounds with a full board and no capture

  /* ---------- seeded random numbers, so a saved game continues the same way ---------- */
  function rng(state) {
    // mulberry32; state.seed is updated in place
    let t = (state.seed = (state.seed + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const randInt = (st, lo, hi) => lo + Math.floor(rng(st) * (hi - lo + 1));

  /* ---------- level rules ---------- */
  function sideForLevel(level) {
    return Math.min(MAX_SIDE, MIN_SIDE + Math.floor((Math.max(1, level) - 1) / 4));
  }
  function cellCount(side) { return 3 * side * (side - 1) + 1; }
  function maxItems(side) { return Math.floor(cellCount(side) * 0.6); }
  function itemsForLevel(level) {
    const side = sideForLevel(level);
    return Math.min(maxItems(side), Math.floor(cellCount(side) * 0.1) + level);
  }
  // Mines: a third of the cells per side, rounded down (5 → 1, 6 → 2, 9 → 3, 15 → 5).
  // Friend games use the same rule, with none when only positive items are chosen.
  function minesForSide(side) { return Math.floor(side / 3); }
  function minesForLevel(level) { return minesForSide(sideForLevel(level)); }
  function levelInfo(level) {
    return { level, side: sideForLevel(level), items: itemsForLevel(level), mines: minesForLevel(level), hives: hivesForLevel(level), attack: BASE_ATTACK * level, defense: BASE_DEFENSE * level };
  }

  /* ---------- board ---------- */
  const key = (q, r) => q + ',' + r;

  function buildIndex(state) {
    const map = new Map();
    state.cells.forEach((c, i) => map.set(key(c.q, c.r), i));
    const nb = state.cells.map(c => {
      const out = [];
      for (const [dq, dr] of DIRS) {
        const j = map.get(key(c.q + dq, c.r + dr));
        if (j !== undefined) out.push(j);
      }
      return out;
    });
    Object.defineProperty(state, '_nb', { value: nb, enumerable: false, configurable: true, writable: true });
    Object.defineProperty(state, '_map', { value: map, enumerable: false, configurable: true, writable: true });
    return state;
  }
  function nbrs(state, i) {
    if (!state._nb) buildIndex(state);
    return state._nb[i];
  }
  function indexOf(state, q, r) {
    if (!state._map) buildIndex(state);
    const i = state._map.get(key(q, r));
    return i === undefined ? -1 : i;
  }

  /*
   * opts: { mode: 'cpu'|'friend', level, side, items, itemSet, strength, first: 0|1,
   *         players: [{name, color, cpu}, {name, color, cpu}], seed, layout }
   */
  function createGame(opts) {
    const level = Math.max(1, opts.level || 1);
    const side = Math.max(MIN_SIDE, Math.min(MAX_SIDE, opts.side || sideForLevel(level)));
    const R = side - 1;
    const strength = opts.strength || level;
    const state = {
      v: 1,
      mode: opts.mode || 'cpu',
      level,
      side,
      layout: opts.layout || 'pass',
      itemSet: opts.itemSet || 'all',
      seed: (opts.seed >>> 0) || ((Math.random() * 4294967296) >>> 0),
      cells: [],
      bases: [-1, -1],
      players: [0, 1].map(p => ({
        name: (opts.players && opts.players[p] && opts.players[p].name) || (p ? 'Player 2' : 'Player 1'),
        color: (opts.players && opts.players[p] && opts.players[p].color) || (p ? '#e0533d' : '#2f7de1'),
        cpu: !!(opts.players && opts.players[p] && opts.players[p].cpu),
        atk: BASE_ATTACK * strength,
        def: BASE_DEFENSE * strength
      })),
      first: opts.first === 1 ? 1 : 0,
      turn: opts.first === 1 ? 1 : 0,
      moves: 0,
      quiet: 0,          // moves in a row with a full board and no capture
      status: 'playing', // playing | won | draw
      winner: -1,
      reason: '',
      last: null,        // { p, idx, kind, changed: [indices] }
      guard: null,       // { by, cells }: cells just captured by `by`, safe from recapture for one turn
      startedAt: Date.now()
    };
    for (let r = -R; r <= R; r++) {
      for (let q = Math.max(-R, -r - R); q <= Math.min(R, -r + R); q++) {
        state.cells.push({ q, r, owner: -1, walls: 0, item: null, seen: false });
      }
    }
    buildIndex(state);

    // Bases: the middle of the second row from each player's edge, point-symmetric.
    const q0 = -Math.floor((R - 1) / 2);
    state.bases[0] = indexOf(state, q0, R - 1);
    state.bases[1] = indexOf(state, -q0, -(R - 1));
    state.bases.forEach((b, p) => { state.cells[b].owner = p; state.cells[b].base = p; });
    // The "hives": castles for whoever takes them. They can't be attacked, only surrounded.
    state.hives = hiveSpots(state, opts.hives != null ? opts.hives : state.mode === 'friend' ? 1 : hivesForLevel(level));
    state.hives.forEach(h => { state.cells[h].hive = true; });
    state.hiveBonus = hiveBonusFor(strength);

    // Hidden items
    const types = ITEM_SETS[state.itemSet] || ITEM_TYPES;
    const free = state.cells.map((c, i) => i).filter(i => state.cells[i].base === undefined && !state.cells[i].hive);
    const want = Math.max(0, Math.min(free.length, opts.items != null ? opts.items : itemsForLevel(level)));
    for (let k = 0; k < want; k++) {
      const pick = randInt(state, k, free.length - 1);
      [free[k], free[pick]] = [free[pick], free[k]];
      const type = types[randInt(state, 0, types.length - 1)];
      const value = type === 'wall' ? randInt(state, 1, 2) : type === 'ring' ? 1 : randInt(state, 1, 4);
      state.cells[free[k]].item = { type, value };
    }
    state.itemCount = want;

    // Hidden mines. A blast never reaches a base, the centre base or the cells around them,
    // so a base can always still be surrounded. Two mines are at least 3 cells apart.
    const mines = opts.mines != null ? opts.mines
      : state.mode === 'friend' ? (state.itemSet === 'positive' ? 0 : minesForSide(side)) : minesForLevel(level);
    const keep = new Set();
    state.bases.concat(state.hives).forEach(b => { keep.add(b); nbrs(state, b).forEach(j => keep.add(j)); });
    const spots = state.cells.map((c, i) => i).filter(i => !state.cells[i].item && !keep.has(i) && !nbrs(state, i).some(j => keep.has(j)));
    const placed = [];
    for (let k = 0; k < mines && spots.length; k++) {
      const ok = spots.filter(i => placed.every(m => dist(state, i, m) >= 3));
      if (!ok.length) break;
      const i = ok[randInt(state, 0, ok.length - 1)];
      state.cells[i].mine = true;
      placed.push(i);
    }
    state.mineCount = placed.length;
    state.maxRounds = 3 * state.cells.length;
    return state;
  }

  // Where the castles go, always point-symmetric so neither side is favoured.
  // 1: the centre. 2: the centre row at the thirds. 3: the centre row at the quarters.
  // 4: halfway between the centre and the middle of each of the 4 sides without a base. 5: those 4 plus the centre.
  function hiveSpots(state, n) {
    const R = state.side - 1;
    let pts;
    if (n >= 4) {
      const a = Math.round(R / 2), b = Math.round(R / 4), c = Math.floor(R / 4);
      pts = [[a, -b], [-a, b], [b, c], [-b, -c]];
      if (n >= 5) pts.push([0, 0]);
    } else if (n === 3) {
      const a = Math.round(R / 2);
      pts = [[-a, 0], [0, 0], [a, 0]];
    } else if (n === 2) {
      const a = Math.round(R / 3);
      pts = [[-a, 0], [a, 0]];
    } else pts = [[0, 0]];
    return pts.map(([q, r]) => indexOf(state, q, r)).filter(i => i >= 0);
  }

  /* ---------- moves ---------- */
  function touches(state, i, p) {
    return nbrs(state, i).some(j => state.cells[j].owner === p);
  }
  function moveKind(state, i, p) {
    const c = state.cells[i];
    if (!c || state.status !== 'playing') return null;
    if (c.owner === -1) return touches(state, i, p) && (!c.hive || hiveOpen(state)) ? 'claim' : null; // owner -2: blown up
    if (c.owner === 1 - p && c.base === undefined && !c.hive && !guarded(state, i, p)) return touches(state, i, p) ? 'attack' : null;
    return null;
  }
  // A cell captured on the opponent's last move can't be taken back straight away.
  function guarded(state, i, p) {
    const g = state.guard;
    return !!(g && g.by === 1 - p && g.cells.indexOf(i) !== -1);
  }
  function hiveOpen(state) { return round(state) >= HIVE_ROUND; }
  // Saves from before v1.9.8 have a single state.hive
  function hives(state) { return state.hives || (state.hive >= 0 ? [state.hive] : []); }
  // Owner of a castle (the first one if none is given)
  function hiveOwner(state, h) {
    const i = h === undefined ? hives(state)[0] : h;
    return i >= 0 && i !== undefined ? state.cells[i].owner : -1;
  }
  function hivesHeld(state, p) { return hives(state).filter(h => state.cells[h].owner === p).length; }
  // Attack and defense including the centre bonus
  function hiveBonus(state) { return state.hiveBonus || hiveBonusFor(state.level || 1); }
  function atk(state, p) { return state.players[p].atk; }
  function def(state, p) { return state.players[p].def + hivesHeld(state, p) * hiveBonus(state); }
  function maxRounds(state) { return state.maxRounds || 3 * state.cells.length; }
  function round(state) { return Math.floor(state.moves / 2) + 1; }
  // A cell changes hands to p. If it held a boost (+attack/+defense) found by the old owner,
  // the old owner loses that boost for good. Deductions stay with whoever found them.
  function takeOver(state, k, p, ev) {
    const c = state.cells[k];
    const old = c.owner;
    c.owner = p;
    ev.changed.push(k);
    if (old !== 1 - p) return;
    ev.taken = (ev.taken || 0) + 1;
    ev.takenCells = ev.takenCells || [];
    ev.takenCells.push(k);
    const it = c.item;
    if (it && c.seen && !it.lost && it.by === old && (it.type === 'atk+' || it.type === 'def+')) {
      it.lost = true;
      const pl = state.players[old];
      if (it.type === 'atk+') pl.atk = Math.max(0, pl.atk - it.value);
      else pl.def = Math.max(0, pl.def - it.value);
      ev.lost = ev.lost || [];
      ev.lost.push({ idx: k, type: it.type, value: it.value, p: old });
    }
  }
  // No way back for p: no grey cell to take, no attack that can do damage (so no capture,
  // wall hit or enclosure is possible), while the opponent can still capture p's cells.
  function hopeless(state, p) {
    if (state.status !== 'playing') return false;
    if (damage(state, 1 - p) <= 0) return false;
    if (damage(state, p) > 0) return false;
    return !legalMoves(state, p).some(m => m.kind === 'claim');
  }
  function legalMoves(state, p) {
    const out = [];
    for (let i = 0; i < state.cells.length; i++) {
      const k = moveKind(state, i, p);
      if (k) out.push({ idx: i, kind: k });
    }
    return out;
  }
  function damage(state, p) {
    return atk(state, p) - def(state, 1 - p);
  }
  // What an attack on cell i would do now: { dmg, walls, result: 'capture'|'wall'|'fail' }
  function previewAttack(state, i, p) {
    const c = state.cells[i];
    const dmg = damage(state, p);
    if (dmg <= 0) return { dmg, walls: c.walls, result: 'fail' };
    if (c.walls > 0) return { dmg, walls: c.walls, result: 'wall' };
    return { dmg, walls: 0, result: 'capture' };
  }

  // Enclosures and rings can also take opponent cells, unless the opponent's defense is greater than p's attack.
  // Walled cells and bases are never taken this way.
  function canSweep(state, p) { return atk(state, p) >= def(state, 1 - p); }
  function sweepable(state, k, p, strong) {
    const c = state.cells[k];
    if (c.owner === -1) return !c.hive || hiveOpen(state);
    return strong && c.owner === 1 - p && c.base === undefined && !c.hive && c.walls === 0 && !guarded(state, k, p);
  }

  // Occupy a cell for p and use its hidden item. Rings found by a ring also go off.
  function occupy(state, i, p, ev) {
    const queue = [i];
    while (queue.length) {
      const k = queue.shift();
      const c = state.cells[k];
      if (c.owner !== p) takeOver(state, k, p, ev);
      if (c.item && !c.seen) {
        c.seen = true;
        const it = c.item;
        it.by = p;
        const pl = state.players[p];
        if (it.type === 'atk+') pl.atk += it.value;
        else if (it.type === 'atk-') pl.atk = Math.max(0, pl.atk - it.value);
        else if (it.type === 'def+') pl.def += it.value;
        else if (it.type === 'def-') pl.def = Math.max(0, pl.def - it.value);
        else if (it.type === 'wall') c.walls += it.value;
        else if (it.type === 'ring') {
          const strong = canSweep(state, p);
          for (const j of nbrs(state, k)) {
            if (state.cells[j].owner !== p && sweepable(state, j, p, strong)) queue.push(j);
          }
        }
        ev.items.push({ idx: k, type: it.type, value: it.value, p });
      }
    }
  }

  // A mine goes off: the cell and the cells around it turn black for good. Whoever owned them loses
  // them (and any +attack/+defense found there); walls and unfound items there are gone.
  function explode(state, i, p, ev) {
    const blast = [i].concat(nbrs(state, i));
    ev.blast = [];
    for (const k of blast) {
      const c = state.cells[k];
      if (c.owner === -2) continue;
      const old = c.owner;
      const it = c.item;
      if (old >= 0 && it && c.seen && !it.lost && it.by === old && (it.type === 'atk+' || it.type === 'def+')) {
        it.lost = true;
        const pl = state.players[old];
        if (it.type === 'atk+') pl.atk = Math.max(0, pl.atk - it.value);
        else pl.def = Math.max(0, pl.def - it.value);
        ev.lost = ev.lost || [];
        ev.lost.push({ idx: k, type: it.type, value: it.value, p: old });
      }
      if (old === 0 || old === 1) { ev.destroyed = ev.destroyed || [0, 0]; ev.destroyed[old]++; }
      c.owner = -2;
      c.walls = 0;
      c.mine = false;
      if (it && !c.seen) c.item = null;
      ev.blast.push(k);
      if (ev.changed.indexOf(k) === -1) ev.changed.push(k);
    }
    state.cells[i].blew = true;
    if (ev.takenCells) ev.takenCells = ev.takenCells.filter(k => state.cells[k].owner !== -2);
    if (ev.takenCells && !ev.takenCells.length) delete ev.takenCells;
  }

  // Areas of cells that are not p's, closed in by p's cells (the board edge also closes an area).
  // An area holding the opponent's base is their home ground, never enclosed.
  function enclosedAreas(state, p) {
    const seen = new Uint8Array(state.cells.length);
    const areas = [];
    const theirBase = state.bases[1 - p];
    const theirHives = new Set(hives(state).filter(h => state.cells[h].owner === 1 - p));
    for (let i = 0; i < state.cells.length; i++) {
      if (seen[i] || state.cells[i].owner === p || state.cells[i].owner === -2) continue;
      const area = [];
      let ok = true;
      const stack = [i];
      seen[i] = 1;
      while (stack.length) {
        const k = stack.pop();
        if (k === theirBase || theirHives.has(k)) ok = false;
        area.push(k);
        for (const j of nbrs(state, k)) {
          if (!seen[j] && state.cells[j].owner !== p && state.cells[j].owner !== -2) { seen[j] = 1; stack.push(j); }
        }
      }
      if (ok) areas.push(area);
    }
    return areas;
  }

  function emptyCount(state) {
    let n = 0;
    for (const c of state.cells) if (c.owner === -1) n++;
    return n;
  }
  function surrounded(state, p) {
    // Is p's base fully surrounded by the other player?
    return nbrs(state, state.bases[p]).every(j => state.cells[j].owner === 1 - p);
  }

  /*
   * Play cell i for the player whose turn it is. Returns an event:
   * { ok, p, idx, kind, result, dmg, changed:[], items:[], enclosed: n, pass: bool, end: {status, winner, reason} }
   */
  function play(state, i) {
    const p = state.turn;
    const kind = moveKind(state, i, p);
    if (!kind) return { ok: false };
    const ev = { ok: true, p, idx: i, kind, result: kind, dmg: 0, changed: [], items: [], enclosed: 0, captured: false };
    const fullBefore = emptyCount(state) === 0;

    if (kind === 'claim') {
      if (state.cells[i].mine) explode(state, i, p, ev); // taking a mine cell directly sets it off
      else occupy(state, i, p, ev);
    } else {
      const pre = previewAttack(state, i, p);
      ev.dmg = pre.dmg;
      ev.result = pre.result;
      const c = state.cells[i];
      if (pre.result === 'wall') {
        const removed = 1; // any hit (damage >= 1) removes exactly one layer per turn
        c.walls -= removed;
        ev.wallsRemoved = removed;
        ev.wallsLeft = c.walls;
      } else if (pre.result === 'capture') {
        takeOver(state, i, p, ev);
        if (c.mine) explode(state, i, p, ev); // a mine left by a ring or an enclosure goes off when captured
      }
    }

    // Enclosed areas become p's
    for (const area of enclosedAreas(state, p)) {
      const strong = canSweep(state, p);
      for (const k of area) {
        if (state.cells[k].owner !== p && sweepable(state, k, p, strong)) { occupy(state, k, p, ev); ev.enclosed++; }
      }
    }
    // Surrounding one of the opponent's castles takes it
    for (const h of hives(state)) {
      if (state.cells[h].owner === 1 - p && !guarded(state, h, p) &&
          nbrs(state, h).every(j => state.cells[j].owner === p)) {
        takeOver(state, h, p, ev);
        ev.hiveTaken = true;
      }
      if (ev.changed.indexOf(h) !== -1) ev.hive = true;
    }
    if (ev.taken || ev.blast) ev.captured = true;
    state.guard = ev.takenCells ? { by: p, cells: ev.takenCells.slice() } : null;

    state.moves++;
    state.last = { p, idx: i, kind, result: ev.result, changed: ev.changed.slice() };
    state.passes = state.passes || [0, 0];
    state.passes[p] = 0;
    state.lastPass = -1;

    // End of game?
    if (surrounded(state, 1 - p)) {
      endGame(state, p, 'surround');
    } else if (surrounded(state, p)) {
      endGame(state, 1 - p, 'surround');
    } else {
      const full = emptyCount(state) === 0;
      if (full && fullBefore) state.quiet = ev.captured ? 0 : state.quiet + 1;
      else state.quiet = 0;
      if (state.quiet >= DRAW_MOVES) endByCount(state, 'stalemate');
      else if (standstill(state)) endByCount(state, 'standstill');
      else if (state.moves >= 2 * maxRounds(state)) endByCount(state, 'limit');
    }

    if (state.status === 'playing') {
      state.turn = 1 - p;
      if (!legalMoves(state, state.turn).length) {
        if (!legalMoves(state, p).length) endByCount(state, 'stuck');
        else { ev.pass = true; pass(state); } // no legal move counts as a pass
      }
    }
    if (state.status !== 'playing') ev.end = { status: state.status, winner: state.winner, reason: state.reason };
    return ev;
  }

  /*
   * The player to move passes. Passing twice in a row while the opponent keeps playing loses;
   * when both players pass one after the other, the game ends on cell count.
   */
  function pass(state) {
    if (state.status !== 'playing') return { ok: false };
    const p = state.turn;
    const ev = { ok: true, p, idx: -1, kind: 'pass', result: 'pass', changed: [], items: [], enclosed: 0, captured: false };
    state.passes = state.passes || [0, 0];
    const bothPassed = state.lastPass === 1 - p;
    state.passes[p]++;
    state.lastPass = p;
    state.moves++;
    state.guard = null;
    state.last = { p, idx: -1, kind: 'pass', result: 'pass', changed: [] };
    if (bothPassed) endByCount(state, 'passes');
    else if (state.passes[p] >= 2) endGame(state, 1 - p, 'forfeit');
    else {
      if (emptyCount(state) === 0) state.quiet++;
      if (state.quiet >= DRAW_MOVES) endByCount(state, 'stalemate');
      else if (standstill(state)) endByCount(state, 'standstill');
      else if (state.moves >= 2 * maxRounds(state)) endByCount(state, 'limit');
      else state.turn = 1 - p;
    }
    if (state.status !== 'playing') ev.end = { status: state.status, winner: state.winner, reason: state.reason };
    return ev;
  }
  // What passing now would do: 'ok' | 'lose' (second pass in a row) | 'count' (opponent just passed)
  function passOutcome(state) {
    const p = state.turn;
    if (state.lastPass === 1 - p) return 'count';
    if (state.passes && state.passes[p] >= 1) return 'lose';
    return 'ok';
  }

  // Both players' cell counts are the same as they were 1, 2 and 3 rounds ago (6 moves):
  // nothing is changing, even if cells are being traded back and forth, so count the cells.
  const STILL_ROUNDS = 3;
  function standstill(state) {
    const n = score(state);
    const h = state.counts || (state.counts = []);
    h.push(n[0] + ',' + n[1]);
    if (h.length > 2 * STILL_ROUNDS + 1) h.shift();
    if (h.length < 2 * STILL_ROUNDS + 1) return false;
    const now = h[h.length - 1];
    for (let k = 1; k <= STILL_ROUNDS; k++) if (h[h.length - 1 - 2 * k] !== now) return false;
    return true;
  }

  function endGame(state, winner, reason) {
    state.status = winner === -1 ? 'draw' : 'won';
    state.winner = winner;
    state.reason = reason;
    state.endedAt = Date.now();
  }
  // No more progress: whoever holds more cells wins; equal cells is a draw.
  function endByCount(state, reason) {
    const n = score(state);
    endGame(state, n[0] === n[1] ? -1 : n[0] > n[1] ? 0 : 1, reason);
  }
  function retire(state, p) {
    if (state.status !== 'playing') return;
    endGame(state, 1 - p, 'retire');
  }

  function score(state) {
    const n = [0, 0];
    for (const c of state.cells) if (c.owner >= 0) n[c.owner]++;
    return n;
  }

  /* ---------- copies ---------- */
  function clone(state, hideItems) {
    const s = JSON.parse(JSON.stringify(state));
    if (hideItems) for (const c of s.cells) { if (!c.seen) c.item = null; c.mine = false; }
    if (state._nb) {
      Object.defineProperty(s, '_nb', { value: state._nb, enumerable: false, configurable: true, writable: true });
      Object.defineProperty(s, '_map', { value: state._map, enumerable: false, configurable: true, writable: true });
    } else buildIndex(s);
    return s;
  }
  function restore(obj) { return buildIndex(obj); }

  // Hex distance between two cells
  function dist(state, a, b) {
    const A = state.cells[a], B = state.cells[b];
    return (Math.abs(A.q - B.q) + Math.abs(A.r - B.r) + Math.abs(A.q + A.r - B.q - B.r)) / 2;
  }

  root.HexGame = {
    HIVE_ROUND, hiveBonus, hiveBonusFor, hiveOpen, hiveOwner, hives, hivesHeld, hivesForLevel, hiveSpots, atk, def,
    DIRS, ITEM_TYPES, ITEM_SETS, MIN_SIDE, MAX_SIDE, DRAW_MOVES,
    sideForLevel, cellCount, maxItems, itemsForLevel, levelInfo, minesForLevel, minesForSide,
    createGame, restore, clone, nbrs, indexOf, legalMoves, moveKind, previewAttack, damage,
    play, pass, passOutcome, retire, score, guarded, hopeless, maxRounds, round, emptyCount, surrounded, enclosedAreas, dist
  };
})(typeof window !== 'undefined' ? window : globalThis);
