// Rules tests: node tests/game.test.js
const assert = require('assert');
require('../js/game.js');
require('../js/cpu.js');
const G = globalThis.HexGame;
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const blank = (opts = {}) => { const s = G.createGame(Object.assign({ level: 1, items: 0, seed: 1 }, opts)); return s; };
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
  assert.equal(ev.result, 'pass'); assert.ok(ev.futile); assert.equal(s.cells[target].owner, 1); assert.equal(s.turn, 1);
  assert.equal(s.passes[0], 1); // a pointless attack counts as a pass
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
  const center = at(s, 0, 0);
  const ring = G.nbrs(s, center);
  ring.slice(1).forEach(i => { s.cells[i].owner = 0; });
  s.cells[center].owner = 1;
  s.players[0].atk = 1; s.players[1].def = 1;
  const ev = G.play(s, ring[0]);
  assert.equal(s.cells[center].owner, 0); assert.ok(ev.enclosed >= 1);
  // strong defense: enemy cell survives
  const t = blank(); const ctr = at(t, 0, 0); const rg = G.nbrs(t, ctr);
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
    s.cells.forEach((c, i) => { if (c.owner === -1) c.owner = c.r > 0 || (c.r === 0 && c.q < extra) ? 0 : 1; });
    return s;
  };
  const s = mk(1);
  s.cells.forEach(c => { c.walls = 9; }); s.players[0].atk = 2; s.players[1].atk = 2; // hits only break walls
  const atk = () => G.legalMoves(s, s.turn)[0].idx;
  for (let k = 0; k < 4; k++) G.play(s, atk());
  const n = G.score(s);
  assert.equal(s.reason, 'stalemate');
  assert.equal(s.winner, n[0] > n[1] ? 0 : n[1] > n[0] ? 1 : -1);
  const t = mk(-99);
  t.cells.forEach(c => { if (c.r === 0) c.owner = c.q < 0 ? 0 : c.q > 0 ? 1 : c.owner; });
  t.cells[at(t, 0, 0)].owner = 0; t.cells[at(t, 4, 0)].owner = 1;
  const nt = G.score(t);
  if (nt[0] === nt[1]) { for (let k = 0; k < 2; k++) G.play(t, G.legalMoves(t, t.turn)[0].idx); assert.equal(t.status, 'draw'); assert.equal(t.reason, 'passes'); }
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
  const s = blank();
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
console.log(`\n${n} tests passed`);
