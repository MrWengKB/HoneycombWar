/* Honeycomb War · CPU player
 * The CPU never sees hidden items: it judges moves on a copy of the board with unrevealed items removed.
 * There is one CPU; the challenge grows with the level (bigger board, more items, stronger stats).
 */
(function (root) {
  'use strict';
  const G = root.HexGame;

  function chooseMove(state) {
    const p = state.turn;
    const o = 1 - p;
    const moves = G.legalMoves(state, p);
    if (!moves.length) return -1;
    const view = G.clone(state, true);
    const myBase = state.bases[p];
    const theirBase = state.bases[o];
    const theirRing = new Set(G.nbrs(state, theirBase));
    const myRing = new Set(G.nbrs(state, myBase));
    const threat = [...myRing].filter(j => state.cells[j].owner === o).length;
    const before = G.score(state)[p];
    const maxD = state.side * 2;
    const hive = state.hive;
    const hiveOwner = G.hiveOwner(state);
    const hiveRing = hive >= 0 ? new Set(G.nbrs(state, hive)) : new Set();
    // How many of the centre's neighbours each side holds
    const ringHeld = q => [...hiveRing].filter(j => state.cells[j].owner === q).length;

    let best = -Infinity, bestIdx = moves[0].idx;
    for (const m of moves) {
      const sim = G.clone(view, false);
      const ev = G.play(sim, m.idx);
      let s = 0;
      if (ev.end && ev.end.winner === p) s += 1e6;
      const gained = G.score(sim)[p] - before;
      s += gained * 6;
      if (m.kind === 'attack') {
        if (ev.result === 'capture') s += 20;
        else if (ev.result === 'wall') s += 4;
        else s -= 40; // would not do anything
      }
      // the centre base: race for it, take it, hold it, and surround it when the other side has it
      if (G.hiveOwner(sim) === p && hiveOwner !== p) s += 60;
      if (hive >= 0 && hiveOwner !== p) {
        s += (maxD - G.dist(state, m.idx, hive)) * 3;               // head for the centre until it's ours
        if (hiveRing.has(m.idx)) s += hiveOwner === o ? 10 + ringHeld(p) * 6 : 8; // close in on it
      }
      if (hive >= 0 && hiveOwner === p && hiveRing.has(m.idx)) s += 6 + ringHeld(o) * 8; // don't let it be surrounded
      // head for the other base
      s += (maxD - G.dist(state, m.idx, theirBase)) * 1.5;
      if (theirRing.has(m.idx)) s += 12;
      // protect our own base, more urgently the more of it is taken
      if (myRing.has(m.idx)) s += (threat ? 6 : 0) + threat * threat * 8;
      // keep the front connected: prefer cells touching several of ours
      s += G.nbrs(state, m.idx).filter(j => state.cells[j].owner === p).length * 0.8;
      s += Math.random() * 4;
      if (s > best) { best = s; bestIdx = m.idx; }
    }
    return bestIdx;
  }

  root.HexCPU = { chooseMove };
})(typeof window !== 'undefined' ? window : globalThis);
