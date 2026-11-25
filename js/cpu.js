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
    // The castles, with who holds each and how many of the cells around it each side has
    const hives = G.hives(state).map(h => {
      const ring = new Set(G.nbrs(state, h));
      const held = q => [...ring].filter(j => state.cells[j].owner === q).length;
      // how close each side has got to it
      const near = q => Math.min(...state.cells.map((c, i) => c.owner === q ? G.dist(state, i, h) : 99));
      return { h, owner: state.cells[h].owner, ring, mine: held(p), theirs: held(o), dMe: near(p), dThem: near(o) };
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
      // castles: race for them, take them, hold them, and surround the ones the other side has
      s += (G.hivesHeld(sim, p) - heldBefore) * 60;
      for (const v of hives) {
        if (v.owner !== p) {
          // head for the one we're aiming at (with one castle it's always worth heading for), and
          // don't leave a free one to the other side when they're as close to it as we are
          const race = v.owner === -1 && v.dThem <= v.dMe + 1;
          const w = hives.length === 1 || aim === v.h || race ? 3 : v.owner === -1 ? 1.2 : 0.8;
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

  // With several castles, each CPU picks a plan at random: go straight for the other base, or race
  // for one free castle. It picks again once that castle is taken by anyone, and drops the
  // straight-for-the-base plan while the other side holds more castles than it does.
  function pickAim(state, p, hives) {
    if (hives.length < 2) return null;
    state.cpuAim = state.cpuAim || [null, null];
    const cur = state.cpuAim[p];
    const free = hives.filter(v => v.owner === -1);
    const behind = hives.filter(v => v.owner === 1 - p).length > hives.filter(v => v.owner === p).length;
    const curOk = cur === 'base' ? !behind : free.some(v => v.h === cur) || (!free.length && hives.some(v => v.h === cur && v.owner === 1 - p));
    if (curOk) return cur;
    let choices = free.map(v => v.h);
    if (!behind) choices.push('base');
    if (!choices.length) {
      // nothing free and we're behind: go and surround the nearest of theirs
      const theirs = hives.filter(v => v.owner === 1 - p).sort((a, b) => a.dMe - b.dMe);
      choices = theirs.length ? [theirs[0].h] : ['base'];
    }
    const pick = choices[Math.floor(Math.random() * choices.length)];
    state.cpuAim[p] = pick;
    return pick;
  }

  root.HexCPU = { chooseMove };
})(typeof window !== 'undefined' ? window : globalThis);
