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
    // The 2nd bases, with who holds each and how many of the cells around it each side has
    const hives = G.hives(state).map(h => {
      const ring = new Set(G.nbrs(state, h));
      const held = q => [...ring].filter(j => state.cells[j].owner === q).length;
      return { h, owner: state.cells[h].owner, ring, mine: held(p), theirs: held(o) };
    });
    const heldBefore = G.hivesHeld(state, p);
    const aim = pickAim(state, p, hives);
    // How hard to head for the other base: harder when that's the plan
    const baseW = aim === 'base' ? 3 : 1.5;

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
      // 2nd bases: race for them, take them, hold them, and surround the ones the other side has
      s += (G.hivesHeld(sim, p) - heldBefore) * 60;
      for (const v of hives) {
        if (v.owner !== p) {
          // head for the one we're aiming at; with one 2nd base it's always worth heading for
          const w = hives.length === 1 || aim === v.h ? 3 : aim === 'base' ? 0.3 : 0.8;
          s += (maxD - G.dist(state, m.idx, v.h)) * w;
          if (v.ring.has(m.idx)) s += v.owner === o ? 10 + v.mine * 6 : 8; // close in on it
        } else if (v.ring.has(m.idx)) s += 6 + v.theirs * 8;            // don't let ours be surrounded
      }
      // head for the other base
      s += (maxD - G.dist(state, m.idx, theirBase)) * baseW;
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

  // With several 2nd bases, each CPU picks a plan at random and sticks to it: go straight for the
  // other base, or race for one 2nd base. Once that 2nd base is ours it picks a new plan.
  function pickAim(state, p, hives) {
    if (hives.length < 2) return null;
    state.cpuAim = state.cpuAim || [null, null];
    const cur = state.cpuAim[p];
    const open = hives.filter(v => v.owner !== p).map(v => v.h);
    if (cur === 'base' || open.indexOf(cur) !== -1) return cur;
    const choices = ['base'].concat(open);
    const pick = choices[Math.floor(Math.random() * choices.length)];
    state.cpuAim[p] = pick;
    return pick;
  }

  root.HexCPU = { chooseMove };
})(typeof window !== 'undefined' ? window : globalThis);
