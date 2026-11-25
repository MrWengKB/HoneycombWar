// Rules tests: node tests/game.test.js
const assert = require('assert');
require('../js/game.js');
require('../js/cpu.js');
const G = globalThis.HexGame;
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const blank = (opts = {}) => { const s = G.createGame(Object.assign({ level: 1, items: 0, mines: 0, seed: 1 }, opts)); return s; };
const at = (s, q, r) => G.indexOf(s, q, r);
const own = (s, list, p) => list.forEach(([q, r]) => { s.cells[at(s, q, r)].owner = p; });

test('board sizes by level', () => {
  assert.equal(G.sideForLevel(1), 5); assert.equal(G.sideForLevel(4), 5);
  assert.equal(G.sideForLevel(5), 6); assert.equal(G.sideForLevel(44), 15); assert.equal(G.sideForLevel(99), 15);
  assert.ok(G.itemsForLevel(60) > G.itemsForLevel(45));
  assert.equal(blank().cells.length, 61);
});
test('bases on second rows, not on the edge, point-symmetric', () => {
  for (let side = 5; side <= 15; side++) {
    const s = blank({ side });
    const [a, b] = s.bases.map(i => s.cells[i]);
    assert.equal(a.r, side - 2); assert.equal(b.r, -(side - 2));
    assert.equal(a.q, -b.q);
    s.bases.forEach(i => assert.equal(G.nbrs(s, i).length, 6));
  }
});
test('starting stats equal level', () => {
  const s = blank({ level: 7 });
  assert.equal(s.players[0].atk, 7); assert.equal(s.players[1].def, 7);
});
test('claim must touch own cells', () => {
  const s = blank();
  const far = at(s, 0, 0);
  assert.equal(G.play(s, far).ok, false);
  const nb = G.nbrs(s, s.bases[0])[0];
  assert.ok(G.play(s, nb).ok);
  assert.equal(s.cells[nb].owner, 0); assert.equal(s.turn, 1);
});
test('attack: capture only when damage > 0, and the turn is used either way', () => {
  const s = blank();
  const b = s.bases[0];
  const target = G.nbrs(s, b)[0];
  s.cells[target].owner = 1;
  let ev = G.play(s, target);
  assert.equal(ev.result, 'fail'); assert.equal(s.cells[target].owner, 1); assert.equal(s.turn, 1);
  s.turn = 0; s.players[0].atk = 3;
  ev = G.play(s, target);
  assert.equal(ev.result, 'capture'); assert.equal(s.cells[target].owner, 0);
});
test('walls absorb damage layer by layer', () => {
  const s = blank();
  const target = G.nbrs(s, s.bases[0])[0];
  Object.assign(s.cells[target], { owner: 1, walls: 2 });
  s.players[0].atk = 9; // big damage still removes only 1 layer
  G.play(s, target); assert.equal(s.cells[target].walls, 1); assert.equal(s.cells[target].owner, 1);
  s.turn = 0; G.play(s, target); assert.equal(s.cells[target].walls, 0); assert.equal(s.cells[target].owner, 1);
  s.turn = 0; G.play(s, target); assert.equal(s.cells[target].owner, 0);
});
test('bases cannot be attacked', () => {
  const s = blank();
  own(s, [[s.cells[s.bases[1]].q, s.cells[s.bases[1]].r + 1]], 0);
  assert.equal(G.moveKind(s, s.bases[1], 0), null);
});
test('items change stats; walls go on the cell', () => {
  const s = blank();
  const [c1, c2] = G.nbrs(s, s.bases[0]);
  s.cells[c1].item = { type: 'atk+', value: 3 };
  s.cells[c2].item = { type: 'wall', value: 2 };
  G.play(s, c1); assert.equal(s.players[0].atk, 4);
  s.turn = 0; G.play(s, c2); assert.equal(s.cells[c2].walls, 2);
  const s2 = blank(); const d = G.nbrs(s2, s2.bases[0])[0];
  s2.cells[d].item = { type: 'def-', value: 4 }; G.play(s2, d); assert.equal(s2.players[0].def, 0);
});
test('ring takes empty neighbours; enemy cells only if attack >= their defense and unwalled', () => {
  const s = blank();
  const c = G.nbrs(s, s.bases[0]).find(i => s.cells[i].r === s.cells[s.bases[0]].r - 1);
  s.cells[c].item = { type: 'ring', value: 1 };
  const around = G.nbrs(s, c).filter(i => s.cells[i].owner === -1);
  const enemy = around[0], walled = around[1];
  s.cells[enemy].owner = 1; Object.assign(s.cells[walled], { owner: 1, walls: 1 });
  s.players[1].def = 2; // weaker attack: enemy cells stay
  const s2 = G.clone(s);
  G.play(s, c);
  assert.equal(s.cells[enemy].owner, 1); assert.equal(s.cells[walled].owner, 1);
  around.slice(2).forEach(i => assert.equal(s.cells[i].owner, 0));
  s2.players[1].def = 1; // attack 1 >= defense 1: unwalled enemy cell flips
  G.play(s2, c);
  assert.equal(s2.cells[enemy].owner, 0); assert.equal(s2.cells[walled].owner, 1);
});
test('enclosed areas become yours, including weak unwalled enemy cells', () => {
  const s = blank();
  // ring of player-0 cells around (0,0)
  const center = at(s, 1, 0);
  const ring = G.nbrs(s, center);
  ring.slice(1).forEach(i => { s.cells[i].owner = 0; });
  s.cells[center].owner = 1;
  s.players[0].atk = 1; s.players[1].def = 1;
  const ev = G.play(s, ring[0]);
  assert.equal(s.cells[center].owner, 0); assert.ok(ev.enclosed >= 1);
  // strong defense: enemy cell survives
  const t = blank(); const ctr = at(t, 1, 0); const rg = G.nbrs(t, ctr);
  rg.slice(1).forEach(i => { t.cells[i].owner = 0; }); t.cells[ctr].owner = 1; t.players[1].def = 5;
  G.play(t, rg[0]); assert.equal(t.cells[ctr].owner, 1);
});
test('surrounding the base wins', () => {
  const s = blank();
  const ring = G.nbrs(s, s.bases[1]);
  ring.slice(1).forEach(i => { s.cells[i].owner = 0; });
  own(s, [], 0);
  const ev = G.play(s, ring[0]);
  assert.equal(s.status, 'won'); assert.equal(s.winner, 0); assert.equal(ev.end.reason, 'surround');
});
test('full board with no capture for 4 moves: more cells wins, equal is a draw', () => {
  const mk = extra => {
    const s = blank();
    s.hives = []; // no centre bonus in this test
    s.cells.forEach((c, i) => { if (c.owner === -1) c.owner = c.r > 0 || (c.r === 0 && c.q < extra) ? 0 : 1; });
    return s;
  };
  const s = mk(1);
  const atk = () => G.legalMoves(s, s.turn)[0].idx;
  for (let k = 0; k < 4; k++) G.play(s, atk());
  const n = G.score(s);
  assert.equal(s.reason, 'stalemate');
  assert.equal(s.winner, n[0] > n[1] ? 0 : n[1] > n[0] ? 1 : -1);
  const t = mk(-99);
  t.cells.forEach(c => { if (c.r === 0) c.owner = c.q < 0 ? 0 : c.q > 0 ? 1 : c.owner; });
  t.cells[at(t, 0, 0)].owner = 0; t.cells[at(t, 4, 0)].owner = 1;
  const nt = G.score(t);
  if (nt[0] === nt[1]) { for (let k = 0; k < 4; k++) G.play(t, G.legalMoves(t, t.turn)[0].idx); assert.equal(t.status, 'draw'); }
});
test('retire gives the win to the other player', () => {
  const s = blank(); G.retire(s, 0); assert.equal(s.winner, 1);
});
test('CPU never reads hidden items and full CPU games finish', () => {
  for (let k = 0; k < 5; k++) {
    const s = G.createGame({ level: 3, seed: k + 10, players: [{ cpu: true }, { cpu: true }] });
    while (s.status === 'playing') assert.ok(G.play(s, HexCPU.chooseMove(s)).ok);
  }
  const s = G.createGame({ level: 1, seed: 5 });
  const v = G.clone(s, true);
  assert.ok(v.cells.every(c => !c.item));
});
test('positive / negative item sets', () => {
  const p = G.createGame({ mode: 'friend', side: 7, items: 40, itemSet: 'positive', seed: 3 });
  assert.ok(p.cells.filter(c => c.item).every(c => !['atk-', 'def-'].includes(c.item.type)));
  const q = G.createGame({ mode: 'friend', side: 7, items: 40, itemSet: 'negative', seed: 3 });
  assert.ok(q.cells.filter(c => c.item).every(c => ['atk-', 'def-'].includes(c.item.type)));
  assert.equal(q.cells.filter(c => c.item).length, 40);
});
test('a cell just captured cannot be recaptured on the next turn', () => {
  const s = blank();
  const t = G.nbrs(s, s.bases[0])[0];
  s.cells[t].owner = 1;
  s.players[0].atk = 3; s.players[1].atk = 3;
  G.play(s, t); assert.equal(s.cells[t].owner, 0);
  assert.equal(G.moveKind(s, t, 1), null); // top may not take it back right away
  const other = G.legalMoves(s, 1).find(m => m.kind === 'claim').idx;
  G.play(s, other);
  G.play(s, G.legalMoves(s, 0).find(m => m.kind === 'claim').idx);
  assert.ok(G.moveKind(s, t, 1) === 'attack' || !G.nbrs(s, t).some(j => s.cells[j].owner === 1));
});
test('losing a cell loses its boost, but deductions stay', () => {
  const s = blank();
  const [a, b] = G.nbrs(s, s.bases[1]);
  s.cells[a].item = { type: 'atk+', value: 3 };
  s.cells[b].item = { type: 'def-', value: 1 };
  s.turn = 1; G.play(s, a); assert.equal(s.players[1].atk, 4);
  s.turn = 1; G.play(s, b); assert.equal(s.players[1].def, 0);
  // bottom captures both cells
  [a, b].forEach(x => { const f = G.nbrs(s, x).find(j => s.cells[j].owner === -1); s.cells[f].owner = 0; });
  s.turn = 0; s.players[0].atk = 5; s.cells[a].walls = 0;
  G.play(s, a); assert.equal(s.cells[a].owner, 0); assert.equal(s.players[1].atk, 1);
  s.turn = 0; G.play(s, b); assert.equal(s.players[1].def, 0); // the −1 defense stays
  assert.equal(s.players[0].atk, 5); // the capturer gains nothing
});
test('round limit is 3x the cell count, then most cells wins', () => {
  const s = blank();
  assert.equal(G.maxRounds(s), 183);
  s.moves = 2 * 183 - 1;
  G.play(s, G.legalMoves(s, s.turn)[0].idx);
  assert.equal(s.reason, 'limit'); assert.notEqual(s.status, 'playing');
});
test('hopeless: no grey cells, no damage, and the opponent can capture', () => {
  const s = blank(); s.hives = [];
  s.cells.forEach(c => { if (c.owner === -1) c.owner = c.r > 0 ? 0 : 1; });
  assert.equal(G.hopeless(s, 0), false); // equal stats: nobody can capture
  s.players[1].atk = 3;
  assert.equal(G.hopeless(s, 0), true);
  assert.equal(G.hopeless(s, 1), false);
  s.players[0].atk = 3; s.players[1].def = 2;
  assert.equal(G.hopeless(s, 0), false); // we can hit back
});
test('pass: twice in a row while the opponent plays loses', () => {
  const s = blank();
  G.pass(s); assert.equal(s.turn, 1);
  G.play(s, G.legalMoves(s, 1)[0].idx);
  assert.equal(G.passOutcome(s), 'lose');
  const ev = G.pass(s);
  assert.equal(s.winner, 1); assert.equal(ev.end.reason, 'forfeit');
});
test('pass: a pass after a move resets the count', () => {
  const s = blank();
  G.pass(s); G.play(s, G.legalMoves(s, 1)[0].idx);
  G.play(s, G.legalMoves(s, 0)[0].idx); G.play(s, G.legalMoves(s, 1)[0].idx);
  assert.equal(G.passOutcome(s), 'ok');
  G.pass(s); assert.equal(s.status, 'playing');
});
test('pass: both players passing ends on cell count', () => {
  const s = blank();
  G.play(s, G.legalMoves(s, 0)[0].idx);
  G.pass(s);
  assert.equal(G.passOutcome(s), 'count');
  const ev = G.pass(s);
  assert.equal(ev.end.reason, 'passes'); assert.equal(s.winner, 0); // 2 cells vs 1
});
test('centre base: claimable from round 3, gives +1/+1, taken only by surrounding', () => {
  const s = blank();
  const h = s.hives[0];
  assert.equal(s.cells[h].q, 0); assert.equal(s.cells[h].r, 0); assert.ok(!s.cells[h].item);
  const nb = G.nbrs(s, h);
  s.cells[nb[0]].owner = 0;
  assert.equal(G.moveKind(s, h, 0), null); // round 1: locked
  s.moves = 4; // round 3
  assert.equal(G.moveKind(s, h, 0), 'claim');
  G.play(s, h);
  assert.equal(G.atk(s, 0), 1); assert.equal(G.def(s, 0), 2); assert.equal(s.players[0].def, 1);
  // top can't attack it, even when stronger
  nb.slice(1).forEach(j => { s.cells[j].owner = 1; });
  s.players[1].atk = 9;
  assert.equal(G.moveKind(s, h, 1), null);
  // top surrounds it by capturing the last neighbour
  s.turn = 1;
  G.play(s, nb[0]);
  assert.equal(s.cells[h].owner, 1);
  assert.equal(G.def(s, 1), 2); assert.equal(G.def(s, 0), 1);
  const lv = G.createGame({ level: 9, seed: 2 }); lv.cells[lv.hives[0]].owner = 0;
  assert.equal(G.def(lv, 0), 15); // level 9: +6 defense
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 40].map(G.hiveBonusFor), [1, 2, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 8]);
});
test('an area holding the opponent centre base is not enclosed', () => {
  const s = blank();
  s.moves = 4;
  const h = s.hives[0];
  s.cells[h].owner = 1;
  const ring = G.nbrs(s, h);
  ring.slice(1).forEach(j => { s.cells[j].owner = 0; });
  s.cells[ring[0]].owner = 1;
  s.players[0].atk = 5;
  G.play(s, ring[0]); // capture the last neighbour: surround, not enclosure
  assert.equal(s.cells[h].owner, 0);
});
// Put a mine on a cell next to the bottom base's own cells but away from bases and the centre
const mineSpot = s => {
  const near = new Set(); s.bases.concat(s.hives).forEach(b => { near.add(b); G.nbrs(s, b).forEach(j => near.add(j)); });
  return s.cells.findIndex((c, i) => !near.has(i) && G.nbrs(s, i).length === 6 && !G.nbrs(s, i).some(j => near.has(j)) && c.r > 0);
};
test('mines: a third of the side, never near a base or the centre', () => {
  for (const [level, want] of [[1, 1], [5, 2], [16, 2], [17, 3], [29, 4], [44, 5]]) {
    for (let seed = 1; seed <= 20; seed++) {
      const s = G.createGame({ level, seed });
      const mines = s.cells.map((c, i) => c.mine ? i : -1).filter(i => i >= 0);
      assert.equal(mines.length, want);
      const near = new Set(); s.bases.concat(s.hives).forEach(b => { near.add(b); G.nbrs(s, b).forEach(j => near.add(j)); });
      mines.forEach(m => { assert.ok(!near.has(m)); G.nbrs(s, m).forEach(j => assert.ok(!near.has(j))); assert.ok(!s.cells[m].item); });
      if (mines.length === 2) assert.ok(G.dist(s, mines[0], mines[1]) >= 3);
    }
  }
  assert.equal(G.createGame({ mode: 'friend', side: 5, itemSet: 'positive', seed: 3 }).cells.filter(c => c.mine).length, 0);
  assert.equal(G.createGame({ mode: 'friend', side: 8, seed: 3 }).cells.filter(c => c.mine).length, 2);
  for (let side = 5; side <= 15; side++) for (let seed = 1; seed <= 30; seed++) {
    const s = G.createGame({ mode: 'friend', side, items: G.maxItems(side), seed });
    assert.equal(s.cells.filter(c => c.mine).length, Math.floor(side / 3), 'side ' + side);
  }
});
test('mines: taking the cell directly blows it and the cells around it up', () => {
  const s = blank({ side: 7 });
  const m = mineSpot(s);
  s.cells[m].mine = true;
  const ring = G.nbrs(s, m);
  s.cells[ring[0]].owner = 0; // bottom's cell next to the mine
  s.cells[ring[1]].owner = 1; // top's cell next to the mine
  s.cells[ring[1]].item = { type: 'def+', value: 3, by: 1 }; s.cells[ring[1]].seen = true; s.players[1].def += 3;
  const ev = G.play(s, m);
  assert.ok(ev.blast); assert.equal(ev.blast.length, 7);
  [m].concat(ring).forEach(k => assert.equal(s.cells[k].owner, -2));
  assert.deepEqual(ev.destroyed, [1, 1]);
  assert.equal(s.players[1].def, 1); // the +3 defense found there is lost
  // nobody can take a black cell
  s.cells[G.nbrs(s, ring[2]).find(j => s.cells[j].owner === -1)].owner = 1;
  assert.equal(G.moveKind(s, m, 0), null); assert.equal(G.moveKind(s, ring[2], 1), null);
  assert.equal(G.score(s)[0] + G.score(s)[1] + G.emptyCount(s) + 7, s.cells.length);
});
test('mines: a ring or an enclosure leaves it hidden; capturing it then sets it off', () => {
  const s = blank({ side: 7 });
  const m = mineSpot(s);
  s.cells[m].mine = true;
  const ring = G.nbrs(s, m);
  const r0 = ring[0];
  s.cells[r0].item = { type: 'ring', value: 1 };
  s.cells[G.nbrs(s, r0).find(j => j !== m && !ring.includes(j))].owner = 0;
  const firstNb = G.nbrs(s, r0).find(j => s.cells[j].owner === 0);
  assert.ok(firstNb >= 0);
  G.play(s, r0); // bottom takes the ring cell: the ring takes the mine cell without a blast
  assert.equal(s.cells[m].owner, 0); assert.ok(s.cells[m].mine);
  // top captures the mine cell: boom
  s.turn = 1; s.players[1].atk = 9;
  s.cells[G.nbrs(s, m).find(j => s.cells[j].owner !== 0 || true)].owner = 1;
  const touching = G.nbrs(s, m).find(j => s.cells[j].owner === 1);
  assert.ok(touching >= 0);
  const ev = G.play(s, m);
  assert.equal(ev.result, 'capture'); assert.ok(ev.blast);
  assert.equal(s.cells[m].owner, -2); assert.equal(s.cells[touching].owner, -2);
  assert.equal(s.guard, null); // nothing left to guard
});
test('mines: black cells close an enclosure like the board edge', () => {
  const s = blank({ side: 7 });
  const a = mineSpot(s);
  // black cell a, with an empty cell e next to it; p0 owns every other neighbour of e
  s.cells[a].owner = -2;
  const e = G.nbrs(s, a).find(j => s.cells[j].owner === -1 && s.cells[j].base === undefined && !s.cells[j].hive);
  G.nbrs(s, e).forEach(j => { if (j !== a && s.cells[j].base === undefined && !s.cells[j].hive && s.cells[j].owner === -1) s.cells[j].owner = 0; });
  const areas = G.enclosedAreas(s, 0);
  assert.ok(areas.some(ar => ar.length === 1 && ar[0] === e));
});
test('the CPU never sees mines', () => {
  const s = G.createGame({ level: 3, seed: 5 });
  assert.equal(G.clone(s, true).cells.filter(c => c.mine).length, 0);
});
test('cells are counted when the counts stay the same for 3 rounds', () => {
  const s = blank();
  // fill the board: bottom half to player 0, top half to player 1
  s.cells.forEach(c => { if (c.owner === -1) c.owner = c.r > 0 || (c.r === 0 && c.q < 0) ? 0 : 1; });
  s.players[0].atk = 1; s.players[1].def = 5; // bottom can't do damage
  s.players[1].atk = 1; s.players[0].def = 5; // top can't either
  const front = p => s.cells.findIndex((c, i) => c.owner === 1 - p && c.base === undefined && !c.hive && G.moveKind(s, i, p) === 'attack');
  let moves = 0;
  while (s.status === 'playing' && moves < 20) { G.play(s, front(s.turn)); moves++; }
  assert.equal(s.status, 'won'); assert.equal(s.reason, 'stalemate'); // the full-board rule comes first here
  // trading cells back and forth also ends it
  const t = blank();
  t.cells.forEach(c => { if (c.owner === -1) c.owner = c.r > 0 || (c.r === 0 && c.q < 0) ? 0 : 1; });
  t.players[0].atk = 9; t.players[1].atk = 9;
  let k = 0;
  while (t.status === 'playing' && k < 40) {
    const p = t.turn;
    const i = t.cells.findIndex((c, j) => G.moveKind(t, j, p) === 'attack');
    G.play(t, i); k++;
  }
  assert.equal(t.status !== 'playing', true);
  assert.ok(['standstill', 'surround'].includes(t.reason), t.reason);
});
test('2nd bases: 1, then 2 at level 50, 3 at 100, 4 at 200, point-symmetric and away from the edge and bases', () => {
  assert.deepEqual([1, 49, 50, 99, 100, 199, 200, 349, 350, 900].map(G.hivesForLevel), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  for (const level of [1, 50, 100, 200, 350]) {
    const s = G.createGame({ level, seed: 3 });
    assert.equal(s.hives.length, G.hivesForLevel(level));
    const pts = s.hives.map(h => s.cells[h].q + ',' + s.cells[h].r);
    s.hives.forEach(h => {
      const c = s.cells[h];
      assert.ok(pts.includes(-c.q + ',' + -c.r), 'symmetric ' + level);
      assert.equal(G.nbrs(s, h).length, 6);
      s.bases.forEach(b => assert.ok(G.dist(s, h, b) >= 3));
      assert.ok(!c.item && !c.mine);
    });
    if (level === 50 || level === 100) s.hives.forEach(h => assert.equal(s.cells[h].r, 0));
  }
  assert.equal(G.createGame({ mode: 'friend', level: 1, strength: 300, seed: 1 }).hives.length, 1);
});
test('several 2nd bases: each adds its defense, and each is taken by surrounding it', () => {
  const s = blank({ level: 100, side: 15, hives: 3 });
  const [a, b] = s.hives;
  const d0 = G.def(s, 0);
  s.cells[a].owner = 0; s.cells[b].owner = 0;
  assert.equal(G.def(s, 0), d0 + 2 * G.hiveBonus(s));
  assert.equal(G.hivesHeld(s, 0), 2);
  // player 1 surrounds b: it changes hands, a stays
  const ring = G.nbrs(s, b);
  ring.slice(1).forEach(j => { s.cells[j].owner = 1; });
  s.cells[G.nbrs(s, ring[0]).find(j => s.cells[j].owner === -1 && !ring.includes(j) && j !== b)].owner = 1;
  s.moves = 10; s.turn = 1;
  const ev = G.play(s, ring[0]);
  assert.ok(ev.ok && ev.hiveTaken && ev.hive);
  assert.equal(s.cells[b].owner, 1); assert.equal(s.cells[a].owner, 0);
  assert.equal(G.hivesHeld(s, 1), 1);
});
test('old saves with a single centre base still work', () => {
  const s = blank();
  const h = s.hives[0];
  delete s.hives; s.hive = h;
  assert.deepEqual(G.hives(s), [h]);
  s.cells[h].owner = 1;
  assert.equal(G.hiveOwner(s), 1); assert.equal(G.def(s, 1), s.players[1].def + G.hiveBonus(s));
  assert.ok(HexCPU.chooseMove(s) >= 0);
});
test('CPU picks a plan with several 2nd bases, and a new one once its 2nd base is taken', () => {
  const plans = new Set();
  for (let k = 0; k < 40; k++) {
    const s = G.createGame({ level: 200, seed: k, first: 1, players: [{}, { cpu: true }] });
    HexCPU.chooseMove(s);
    const aim = s.cpuAim[1];
    assert.ok(aim === 'base' || s.hives.includes(aim));
    plans.add(aim);
    if (aim !== 'base') { s.cells[aim].owner = 1; HexCPU.chooseMove(s); assert.notEqual(s.cpuAim[1], aim); }
  }
  assert.ok(plans.size >= 4, [...plans].join());
  const one = G.createGame({ level: 9, seed: 1, first: 1, players: [{}, { cpu: true }] });
  HexCPU.chooseMove(one); assert.equal(one.cpuAim, undefined);
});
console.log(`\n${n} tests passed`);
