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
      // the centre base: worth taking and worth surrounding
      if (G.hiveOwner(sim) === p && G.hiveOwner(state) !== p) s += 30;
      // head for the other base
      s += (maxD - G.dist(state, m.idx, theirBase)) * 1.5;
      if (theirRing.has(m.idx)) s += 12;
      // protect our own base, more urgently the more of it is taken
      if (myRing.has(m.idx)) s += 6 + threat * threat * 8;
      // keep the front connected: prefer cells touching several of ours
      s += G.nbrs(state, m.idx).filter(j => state.cells[j].owner === p).length * 0.8;
      s += Math.random() * 4;
      if (s > best) { best = s; bestIdx = m.idx; }
    }
    return bestIdx;
  }

  root.HexCPU = { chooseMove };
})(typeof window !== 'undefined' ? window : globalThis);
