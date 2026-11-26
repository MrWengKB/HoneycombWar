/* Honeycomb War · drawing the board, dialogs and messages */
(function () {
  'use strict';
  const G = window.HexGame;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const S = 20;            // hex radius in board units
  const W = Math.sqrt(3) * S;
  const EMPTY = '#e3e4e8';
  const DEAD = '#1c1c22'; // cells blown up by a mine

  const $ = sel => document.querySelector(sel);
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  function hexPoints(cx, cy, r) {
    const pts = [];
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 180 * (60 * k - 30);
      pts.push((cx + r * Math.cos(a)).toFixed(2) + ',' + (cy + r * Math.sin(a)).toFixed(2));
    }
    return pts.join(' ');
  }
  function mix(hex, other, t) {
    const a = parseInt(hex.slice(1), 16), b = parseInt(other.slice(1), 16);
    const ch = s => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
    return '#' + ((1 << 24) + (ch(16) << 16) + (ch(8) << 8) + ch(0)).toString(16).slice(1);
  }
  function itemLabel(it) {
    return { 'atk+': 'A+' + it.value, 'atk-': 'A−' + it.value, 'def+': 'D+' + it.value, 'def-': 'D−' + it.value, wall: 'W' + it.value, ring: '◎' }[it.type];
  }
  // A wall shows the layers it has left; once they are all broken it is an ordinary cell with no badge.
  function cellLabel(c) {
    if (c.item.type === 'wall') return c.walls > 0 ? 'W' + c.walls : '';
    return itemLabel(c.item);
  }
  function itemText(it) {
    if (window.I18N && window.I18N.zh) {
      return window.I18N.cv({
        'atk+': ` +${it.value} 攻击`, 'atk-': ` −${it.value} 攻击`, 'def+': ` +${it.value} 防御`, 'def-': ` −${it.value} 防御`,
        wall: ` ${it.value} 层墙`, ring: '光环'
      }[it.type]);
    }
    return {
      'atk+': `+${it.value} attack`, 'atk-': `−${it.value} attack`, 'def+': `+${it.value} defense`, 'def-': `−${it.value} defense`,
      wall: `a wall of ${it.value} layer${it.value > 1 ? 's' : ''}`, ring: 'a ring'
    }[it.type];
  }

  /* ---------- board ---------- */
  class Board {
    constructor(svg, wrap) {
      this.svg = svg;
      this.wrap = wrap;
      this.zoom = 1;
      this.onCell = null;
      this.onHover = null;
      svg.addEventListener('click', e => {
        const g = e.target.closest('[data-i]');
        if (g && this.onCell) this.onCell(Number(g.dataset.i));
      });
      svg.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        const g = e.target.closest('[data-i]');
        const i = g ? Number(g.dataset.i) : -1;
        if (i !== this.hoverIdx) { this.hoverIdx = i; if (this.onHover) this.onHover(i); }
      });
      svg.addEventListener('pointerleave', () => { this.hoverIdx = -1; if (this.onHover) this.onHover(-1); });
      window.addEventListener('resize', () => this.fit());
    }
    build(state) {
      this.state = state;
      const svg = this.svg;
      svg.innerHTML = '';
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      this.nodes = state.cells.map((c, i) => {
        const x = W * (c.q + c.r / 2), y = 1.5 * S * c.r;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        const g = el('g', { 'data-i': i, class: 'cell' }, svg);
        const hex = el('polygon', { points: hexPoints(x, y, S - 0.8), class: 'hex', fill: EMPTY }, g);
        const w1 = el('polygon', { points: hexPoints(x, y, S * 0.74), class: 'wall' }, g);
        const w2 = el('polygon', { points: hexPoints(x, y, S * 0.52), class: 'wall' }, g);
        const label = el('text', { x, y: y + 0.5, class: 'lbl', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g);
        return { g, hex, w1, w2, label, x, y };
      });
      const pad = S + 4;
      this.vb = { x: minX - pad, y: minY - pad, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad };
      svg.setAttribute('viewBox', `${this.vb.x} ${this.vb.y} ${this.vb.w} ${this.vb.h}`);
      // base markers
      state.bases.forEach(b => {
        const n = this.nodes[b];
        const star = [];
        for (let k = 0; k < 10; k++) {
          const r = k % 2 ? S * 0.26 : S * 0.6, a = Math.PI / 5 * k - Math.PI / 2;
          star.push((n.x + r * Math.cos(a)).toFixed(2) + ',' + (n.y + r * Math.sin(a)).toFixed(2));
        }
        el('polygon', { points: star.join(' '), class: 'star' }, n.g);
      });
      // castle markers
      G.hives(state).forEach(h => {
        const n = this.nodes[h];
        el('polygon', { points: hexPoints(n.x, n.y, S * 0.55), class: 'hivemark' }, n.g);
        el('polygon', { points: hexPoints(n.x, n.y, S * 0.25), class: 'hivecore' }, n.g);
      });
      this.fit();
      this.update();
    }
    fit() {
      if (!this.vb) return;
      const ww = this.wrap.clientWidth, wh = this.wrap.clientHeight;
      if (!ww || !wh) return;
      const base = Math.min(ww / this.vb.w, wh / this.vb.h);
      this.svg.style.width = Math.floor(this.vb.w * base * this.zoom) + 'px';
      this.svg.style.height = Math.floor(this.vb.h * base * this.zoom) + 'px';
      this.wrap.classList.toggle('zoomed', this.zoom > 1);
    }
    setZoom(z) {
      const wrap = this.wrap;
      const cx = (wrap.scrollLeft + wrap.clientWidth / 2) / (wrap.scrollWidth || 1);
      const cy = (wrap.scrollTop + wrap.clientHeight / 2) / (wrap.scrollHeight || 1);
      this.zoom = Math.max(1, Math.min(4, z));
      this.fit();
      wrap.scrollLeft = cx * wrap.scrollWidth - wrap.clientWidth / 2;
      wrap.scrollTop = cy * wrap.scrollHeight - wrap.clientHeight / 2;
    }
    // hint: { p, moves: Map idx->kind } for the player who may move now; selected: idx
    update(hint, selected) {
      const st = this.state;
      const changed = new Set(st.last ? st.last.changed : []);
      st.cells.forEach((c, i) => {
        const n = this.nodes[i];
        const col = c.owner >= 0 ? st.players[c.owner].color : c.owner === -2 ? DEAD : EMPTY;
        let fill = c.base !== undefined || (c.hive && c.owner >= 0) ? mix(col, '#000000', 0.18) : col;
        let cls = 'cell';
        const kind = hint && hint.moves.get(i);
        if (kind === 'claim') { fill = mix(st.players[hint.p].color, EMPTY, 0.72); cls += ' can'; }
        if (kind === 'attack') cls += ' canhit';
        if (changed.has(i)) cls += ' fresh';
        if (st.last && st.last.idx === i) cls += ' lastmove';
        if (selected === i) cls += ' sel';
        n.g.setAttribute('class', cls);
        n.hex.setAttribute('fill', fill);
        if (kind === 'attack') n.hex.style.setProperty('--hit', st.players[hint.p].color);
        n.w1.style.display = c.walls >= 1 ? '' : 'none';
        n.w2.style.display = c.walls >= 2 ? '' : 'none';
        n.label.textContent = c.blew ? '✹' : c.owner !== -2 && c.seen && c.item && c.base === undefined && !c.hive ? cellLabel(c) : '';
        n.label.setAttribute('font-size', c.blew ? 16 : c.seen && c.item && c.item.type === 'ring' ? 18 : 11);
      });
    }
    flash(indices) {
      for (const i of indices) {
        const g = this.nodes[i] && this.nodes[i].g;
        if (!g) continue;
        g.classList.remove('pop'); void g.getBBox(); g.classList.add('pop');
      }
    }
  }

  /* ---------- toasts and dialogs ---------- */
  // During a game, messages go in the strip under the board (it never covers the board).
  function toast(text, color) {
    const feed = $('#feed');
    if (feed && document.body.classList.contains('ingame')) {
      const line = document.createElement('div');
      line.className = 'fline';
      if (color) line.style.setProperty('--fc', color);
      line.textContent = text;
      feed.prepend(line);
      while (feed.children.length > 2) feed.lastChild.remove();
      return;
    }
    const box = $('#toasts');
    const t = document.createElement('div');
    t.className = 'toast';
    if (color) t.style.borderLeftColor = color;
    t.textContent = text;
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 3200);
  }

  // buttons: [{ label, value, kind: 'primary'|'danger'|'ghost' }]. Resolves with the value of the button pressed.
  function dialog({ title, body, html, buttons, icon, dismiss }) {
    return new Promise(resolve => {
      const wrap = document.createElement('div');
      wrap.className = 'modal';
      const box = document.createElement('div');
      box.className = 'mbox';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      if (icon) { const i = document.createElement('div'); i.className = 'micon'; i.textContent = icon; box.appendChild(i); }
      if (title) { const h = document.createElement('h3'); h.textContent = title; box.appendChild(h); }
      if (body) { const p = document.createElement('p'); p.textContent = body; box.appendChild(p); }
      if (html) box.appendChild(html);
      const row = document.createElement('div');
      row.className = 'mbtns';
      const close = v => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      (buttons || [{ label: window.I18N && window.I18N.zh ? '好' : 'OK', value: true, kind: 'primary' }]).forEach(b => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn ' + (b.kind || '');
        btn.textContent = b.label;
        btn.addEventListener('click', () => close(b.value));
        row.appendChild(btn);
      });
      box.appendChild(row);
      wrap.appendChild(box);
      const onKey = e => { if (e.key === 'Escape' && dismiss !== false) close(null); };
      document.addEventListener('keydown', onKey);
      wrap.addEventListener('click', e => { if (e.target === wrap && dismiss !== false) close(null); });
      document.body.appendChild(wrap);
      const primary = row.querySelector('.primary') || row.querySelector('button');
      if (primary) primary.focus();
    });
  }

  function clearFeed() { const f = $('#feed'); if (f) f.innerHTML = ''; }

  window.UI = { clearFeed, Board, toast, dialog, itemText, itemLabel, mix, EMPTY };
})();
