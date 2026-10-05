// Renderizador isométrico (canvas 2D) do estúdio a partir do mapa em grade (s.map).
// Câmera com pan/zoom, minimapa, camadas em cache (offscreen), z-order por ordenação topológica, pessoas com A*.
// O jogo é 2D isométrico (não 3D). Projeção: sx = (x - y) * 32, sy = (x + y) * 16 - z.
import * as MP from './map.js';
import { Painter, shade, WH, COLORS, RUG_COLORS, FH } from './sprites.js';
export { COLORS, shade };

const SPEED = 1.7; // tiles por segundo
const bucketFor = (v) => Math.max(1, Math.min(3, Math.ceil(v * 2) / 2));
const rectsOf = (it) => { const { w, d } = MP.size(it); return { x0: it.x, y0: it.y, x1: it.x + w, y1: it.y + d }; };
const before = (A, B) => (A.x1 <= B.x0 || A.y1 <= B.y0) && !(B.x1 <= A.x0 || B.y1 <= A.y0);

const LIVE_KINDS = new Set(['server', 'coffee', 'cooler', 'vending', 'audio', 'mocap', 'qa']);
export class Office {
  constructor(canvas, opts = {}) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.mini = opts.minimap || null;
    this.pt = new Painter(this.ctx);
    this.level = -1; this.parts = []; this.t = 0; this.emps = new Map(); this.working = false; this.state = null; this.map = null; this.sig = ''; this.fcam = {}; this.fd = {}; this.onFloor = null;
    this.cam = { x: 0, y: 0, z: 1 }; this.userMoved = false; this.insetBottom = 0;
    this.dpr = 1; this.W = 300; this.H = 300; this.bucket = 1; this.sprites = new Map(); this.bg = null; this.dirty = true; this.lastDraw = 0;
    this.mode = 'view'; this.ghost = null; this.selId = null; this.hideId = null; this.ptrs = new Map(); this.onTap = null; this.onGhost = null; this.interacting = 0;
    this.stats = { frames: 0, bgBuilds: 0, spriteBuilds: 0 };
    this.perf = 'alto'; this.maxDpr = 3; this.fpsAnim = 30; this.fpsIdle = 10; this.cost = 0; this.talkT = 0; this.liveT = 0; this.hasLive = false;
    this.setPerf(document.documentElement.dataset.perf || 'auto', true);
    this.bindInput();
    this.resize();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { const r = this.cv.getBoundingClientRect(); if (Math.abs(r.width - this.W) > 1 || Math.abs(r.height - this.H) > 1) this.resize(); }).observe(this.cv);
  }

  // ------------------------------------------------------------ câmera
  get vy() { return (this.H - this.insetBottom) / 2; }
  bounds() { const N = this.map ? this.map.N : 6; return { x0: -N * 32 - 24, x1: N * 32 + 24, y0: -WH - 24, y1: N * 32 + 30 }; }
  fitZoom() { const b = this.bounds(); return Math.min((this.W - 16) / (b.x1 - b.x0), (this.H - this.insetBottom - 16) / (b.y1 - b.y0)); }
  fit() {
    if (!this.map) return; const b = this.bounds();
    this.cam.z = this.fitZoom(); this.cam.x = (b.x0 + b.x1) / 2; this.cam.y = (b.y0 + b.y1) / 2; this.userMoved = false; this.dirty = true;
  }
  clampCam() {
    const b = this.bounds(); const hw = this.W / 2 / this.cam.z, hh = this.vy / this.cam.z;
    const mx = Math.max(0, (b.x1 - b.x0) / 2 - hw * 0.5), my = Math.max(0, (b.y1 - b.y0) / 2 - hh * 0.5);
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    this.cam.x = Math.max(cx - mx - hw * 0.5, Math.min(cx + mx + hw * 0.5, this.cam.x));
    this.cam.y = Math.max(cy - my - hh * 0.5, Math.min(cy + my + hh * 0.5, this.cam.y));
  }
  zoomAt(f, sx = this.W / 2, sy = this.vy) {
    const c = this.cam; const wx = (sx - this.W / 2) / c.z + c.x, wy = (sy - this.vy) / c.z + c.y;
    const fz = this.fitZoom();
    c.z = Math.max(fz * 0.55, Math.min(Math.max(3.4, fz * 4.5), c.z * f));
    c.x = wx - (sx - this.W / 2) / c.z; c.y = wy - (sy - this.vy) / c.z;
    this.clampCam(); this.userMoved = true; this.dirty = true; this.zoomT = performance.now();
  }
  panBy(dx, dy) { this.cam.x -= dx / this.cam.z; this.cam.y -= dy / this.cam.z; this.clampCam(); this.userMoved = true; this.dirty = true; }
  centerOnTile(x, y) { this.cam.x = (x - y) * 32; this.cam.y = (x + y) * 16; this.clampCam(); this.userMoved = true; this.dirty = true; }
  setInset(px, refit = false) {
    if (Math.abs(px - this.insetBottom) < 2) return; const old = this.vy; this.insetBottom = px;
    if (refit && !this.userMoved) this.fit(); else { this.cam.y += (this.vy - old) / this.cam.z; this.clampCam(); }
    this.dirty = true;
  }
  toScreen(wx, wy) { return [(wx - this.cam.x) * this.cam.z + this.W / 2, (wy - this.cam.y) * this.cam.z + this.vy]; }
  toWorld(sx, sy) { return [(sx - this.W / 2) / this.cam.z + this.cam.x, (sy - this.vy) / this.cam.z + this.cam.y]; }
  /** Pixel da tela -> coordenadas do piso (float). */
  screenToFloor(sx, sy, z = 0) { const [wx, wy0] = this.toWorld(sx, sy); const wy = wy0 + z; return [wy / 32 + wx / 64, wy / 32 - wx / 64]; }
  screenToTile(sx, sy) { const [fx, fy] = this.screenToFloor(sx, sy); return [Math.floor(fx), Math.floor(fy)]; }

  resize() {
    const r = this.cv.getBoundingClientRect(); const dpr = Math.min(this.maxDpr || 3, window.devicePixelRatio || 1);
    this.W = Math.max(50, r.width); this.H = Math.max(50, r.height);
    this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr); this.dpr = dpr;
    if (!this.userMoved) this.fit(); else this.clampCam();
    this.dirty = true;
  }

  // ------------------------------------------------------------ entrada (arrastar, pinça, roda)
  bindInput() {
    const cv = this.cv; cv.style.touchAction = 'none';
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture?.(e.pointerId); const [x, y] = pos(e);
      this.ptrs.set(e.pointerId, { x, y, sx: x, sy: y, t: performance.now(), moved: false });
      this.interacting = performance.now();
      if (this.ptrs.size === 1 && this.mode === 'build' && this.ghost && this.ghostHit(x, y)) this.dragGhost = true;
      if (this.ptrs.size === 2) { this.dragGhost = false; const [a, b] = [...this.ptrs.values()]; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }
    });
    cv.addEventListener('pointermove', (e) => {
      const [x, y] = pos(e); const p = this.ptrs.get(e.pointerId);
      if (!p) { if (this.mode === 'build' && this.ghost && !this.ghost.locked && e.pointerType === 'mouse') this.moveGhostTo(x, y); return; }
      const dx = x - p.x, dy = y - p.y; p.x = x; p.y = y;
      if (Math.hypot(x - p.sx, y - p.sy) > 7) p.moved = true;
      this.interacting = performance.now();
      if (this.ptrs.size >= 2 && this.pinch) {
        const [a, b] = [...this.ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        this.panBy(mx - this.pinch.mx, my - this.pinch.my); if (this.pinch.d > 0) this.zoomAt(d / this.pinch.d, mx, my);
        this.pinch.d = d; this.pinch.mx = mx; this.pinch.my = my;
      } else if (this.dragGhost) { if (p.moved) this.moveGhostTo(x, y); }
      else if (p.moved) this.panBy(dx, dy);
    });
    const up = (e) => {
      const p = this.ptrs.get(e.pointerId); if (!p) return; this.ptrs.delete(e.pointerId);
      if (this.ptrs.size < 2) this.pinch = null;
      const wasTap = !p.moved && performance.now() - p.t < 600 && this.ptrs.size === 0 && !this.hadMulti;
      if (this.ptrs.size === 0) { this.dragGhost = false; this.hadMulti = false; } else this.hadMulti = true;
      if (e.type === 'pointerup' && wasTap) this.tap(p.x, p.y);
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = pos(e); this.zoomAt(Math.exp(-e.deltaY * 0.0016), x, y); this.interacting = performance.now(); }, { passive: false });
    if (this.mini) {
      const mp = (e) => { const r = this.mini.getBoundingClientRect(); const ms = this.miniScale(); const b = this.bounds(); this.cam.x = (e.clientX - r.left - ms.ox) / ms.s + b.x0; this.cam.y = (e.clientY - r.top - ms.oy) / ms.s + b.y0; this.clampCam(); this.userMoved = true; this.dirty = true; };
      this.mini.style.touchAction = 'none';
      this.mini.addEventListener('pointerdown', (e) => { this.mini.setPointerCapture?.(e.pointerId); this.miniDrag = true; mp(e); e.stopPropagation(); });
      this.mini.addEventListener('pointermove', (e) => { if (this.miniDrag) mp(e); });
      this.mini.addEventListener('pointerup', () => { this.miniDrag = false; });
    }
  }
  ghostHit(sx, sy) {
    const g = this.ghost; if (!g) return false; const [fx, fy] = this.screenToFloor(sx, sy);
    const { w, d } = MP.FURN[g.k].wall ? { w: 1, d: 1 } : MP.size(g);
    return !MP.FURN[g.k].wall && fx >= g.x && fx < g.x + w && fy >= g.y && fy < g.y + d;
  }
  moveGhostTo(sx, sy) {
    const g = this.ghost; if (!g) return; const f = MP.FURN[g.k]; const [fx, fy] = this.screenToFloor(sx, sy);
    const N = this.map.N;
    if (f.wall) { // parede mais próxima do ponto tocado (posições em meio tile)
      const wd = f.ww || 1; const sn = (v) => Math.max(0, Math.min(N - wd, Math.round((v - wd / 2) * 2) / 2));
      if (fy < fx) { g.wl = 'R'; g.x = sn(fx); g.y = 0; } else { g.wl = 'L'; g.x = 0; g.y = sn(fy); }
    } else {
      const { w, d } = MP.size(g);
      g.x = Math.max(0, Math.min(N - w, Math.round(fx - w / 2))); g.y = Math.max(0, Math.min(N - d, Math.round(fy - d / 2)));
    }
    g.err = MP.checkGhost(this.map, g); this.dirty = true; this.onGhost?.(g);
  }
  tap(sx, sy) {
    const [fx, fy] = this.screenToFloor(sx, sy);
    if (this.mode === 'build') {
      if (this.ghost && this.ghostHit(sx, sy)) { this.onTap?.({ ghost: true }); return; }
      if (this.ghost && !this.ghost.locked) { this.moveGhostTo(sx, sy); return; }
      const it = this.itemAt(sx, sy); this.onTap?.({ item: it || null, tx: Math.floor(fx), ty: Math.floor(fy) }); return;
    }
    // pessoa mais perto do toque
    let best = null, bd = 28;
    for (const a of this.emps.values()) { const [wx, wy] = this.pt.P(a.x, a.y, 20); const [px, py] = this.toScreen(wx, wy); const d = Math.hypot(px - sx, py - sy); if (d < bd * Math.max(1, 1 / this.cam.z * 0.7)) { bd = d; best = a; } }
    if (best) { this.onTap?.({ emp: best.e }); return; }
    const it = this.itemAt(sx, sy); this.onTap?.({ item: it || null, tx: Math.floor(fx), ty: Math.floor(fy) });
  }
  /** Móvel sob o ponteiro (considera a altura aproximada). */
  itemAt(sx, sy) {
    if (!this.map) return null; let best = null, bs = -1;
    for (const it of MP.floorItems(this.map)) {
      const f = MP.FURN[it.k];
      if (f.wall) { const slot = it.wl === 'L' ? it.y : it.x; const mid = slot + (f.ww || 1) / 2; const [wx, wy] = it.wl === 'L' ? this.pt.P(0, mid, 56) : this.pt.P(mid, 0, 56); const [px, py] = this.toScreen(wx, wy); if (Math.hypot(px - sx, py - sy) < 22 * Math.max(1, 0.9 / this.cam.z) && 9999 > bs) { best = it; bs = 9999; } continue; }
      const { x0, y0, x1, y1 } = rectsOf(it); const h = Math.min(60, (FH[it.k] || 40) * 0.7);
      for (const z of [0, h * 0.5, h]) { const [fx, fy] = this.screenToFloor(sx, sy, z); if (fx >= x0 && fx < x1 && fy >= y0 && fy < y1) { const sc = x1 + y1 + (f.walk ? -10 : 0); if (sc > bs) { best = it; bs = sc; } break; } }
    }
    return best;
  }

  // ------------------------------------------------------------ estado / mapa
  setState(s) {
    this.state = s; this.pt.state = s;
    const m = MP.ensureMap(s);
    const sig = `${m.level}|${m.N}|${m.wall}|${m.floor}|${m.fl | 0}|${m.floors.join(',')}|${s.studio.nome}|` + m.items.map((i) => `${i.id}${i.k}${i.x},${i.y},${i.r},${i.wl || ''},${i.fl | 0}`).join(';');
    if (sig !== this.sig || m !== this.map) { this.map = m; this.sig = sig; this.curFl = m.fl | 0; this.onMapChange(s.office !== this.level); this.level = s.office; }
    this.working = !!(s.project && s.project.stage === 'dev'); this.pt.working = this.working; this.pt.level = s.office;
    this.syncAgents(); this.dirty = true;
  }
  invalidate() { if (this.state) this.setState(this.state); }
  onMapChange(levelChanged) {
    const m = this.map; this.fd = {};
    for (const f of m.floors) {
      const blocked = MP.walkGrid(m, f); const reach = MP.reachSet(m, blocked, f);
      const grp = { toilet: [], drink: [], rest: [], meet: [], read: [], game: [] };
      for (const it of m.items) {
        if ((it.fl | 0) !== f) continue;
        const fu = MP.FURN[it.k]; if (fu.wall || fu.walk || fu.seat || fu.portal) continue;
        const u = MP.useTile(m, blocked, it); if (!u) continue; const rec = { it, u, fl: f };
        if (fu.toilet) grp.toilet.push(rec); else if (fu.coffee || it.k === 'vending') grp.drink.push(rec);
        else if (it.k === 'sofa' || it.k === 'puff' || it.k === 'bed') grp.rest.push(rec); else if (it.k === 'meeting') grp.meet.push(rec);
        else if (it.k === 'shelf') grp.read.push(rec); else if (it.k === 'tv') grp.game.push(rec);
      }
      this.fd[f] = { blocked, reach, amen: grp };
    }
    const cur = this.fd[m.fl | 0] || this.fd[0]; this.blocked = cur.blocked; this.reach = cur.reach; this.amen = cur.amen;
    const fkey = (i) => ((i.fl | 0) < 0 ? 9 : (i.fl | 0)) * 1e6 + i.id;
    this.seatItems = m.items.filter((i) => MP.FURN[i.k].seat).sort((a, b) => fkey(a) - fkey(b));
    this.buildOrder(); this.bg = null;
    if (levelChanged) { this.emps.clear(); this.fcam = {}; this.fit(); }
    else if (!this.userMoved) this.fit(); else this.clampCam();
    if (!this._fs) for (const a of this.emps.values()) { a.path = null; a.errand = null; if (a.st === 'go' || a.st === 'use') { a.st = 'idle'; a.icon = ''; } }
    this.dirty = true;
  }
  /** Troca o andar visível (câmera própria por andar). */
  setFloor(f) {
    const s = this.state; const cur = this.curFl ?? (this.map?.fl | 0); if (!s || !this.map || cur === f || !this.map.floors.includes(f)) return false;
    this.fcam[cur] = { x: this.cam.x, y: this.cam.y, z: this.cam.z, um: this.userMoved };
    MP.setFloor(s, f); this.selId = null; this.hideId = null; if (this.mode === 'build') this.ghost = null;
    this._fs = true; this.invalidate(); this._fs = false;
    const sv = this.fcam[f]; if (sv && sv.um) { this.cam.x = sv.x; this.cam.y = sv.y; this.cam.z = sv.z; this.userMoved = true; this.clampCam(); } else this.fit();
    this.curFl = f; this.onFloor?.(f); this.dirty = true; return true;
  }
  buildOrder() {
    const m = this.map; const L = [];
    for (const it of MP.floorItems(m)) {
      const f = MP.FURN[it.k]; if (f.wall || f.walk) continue;
      L.push({ kind: 'item', it, ...rectsOf(it) });
      if (f.seat) { const [cx, cy] = MP.chairTile(it); L.push({ kind: 'chair', it, x0: cx, y0: cy, x1: cx + 1, y1: cy + 1 }); }
    }
    const n = L.length; const indeg = new Array(n).fill(0); const adj = L.map(() => []);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && before(L[i], L[j])) { adj[i].push(j); indeg[j]++; }
    const q = []; for (let i = 0; i < n; i++) if (!indeg[i]) q.push(i);
    q.sort((a, b) => (L[b].x1 + L[b].y1) - (L[a].x1 + L[a].y1));
    const out = []; const done = new Set();
    while (q.length) { // escolhe o mais "ao fundo" (menor x+y) entre os livres
      let bi = 0; for (let i = 1; i < q.length; i++) if (L[q[i]].x1 + L[q[i]].y1 < L[q[bi]].x1 + L[q[bi]].y1) bi = i;
      const k = q.splice(bi, 1)[0]; out.push(L[k]); done.add(k);
      for (const j of adj[k]) if (--indeg[j] === 0) q.push(j);
    }
    if (out.length < n) { const rest = []; for (let i = 0; i < n; i++) if (!done.has(i)) rest.push(L[i]); rest.sort((a, b) => a.x1 + a.y1 - (b.x1 + b.y1)); out.push(...rest); }
    this.order = out;
  }
  syncAgents() {
    const s = this.state; if (!s || !this.map) return; const seen = new Set();
    s.employees.forEach((e, i) => {
      seen.add(e.id); let a = this.emps.get(e.id); const seat = this.seatItems[i] || null; const sf = seat ? seat.fl | 0 : 0;
      if (!a) {
        let x, y;
        if (seat) { [x, y] = MP.seatPoint(seat); } else { const t = this.randomFreeTile(0); x = t[0] + 0.5; y = t[1] + 0.5; }
        a = { id: e.id, x, y, fl: sf, st: seat ? 'sit' : 'idle', path: null, errand: null, timer: 2 + Math.random() * 5, needs: { wc: Math.random() * 0.6, drink: Math.random() * 0.6, rest: Math.random() * 0.5 }, icon: '', need: 'work', idx: i, moving: false, seated: !!seat };
        this.emps.set(e.id, a);
      }
      if (a.seat !== seat) { a.seat = seat; if (seat && a.st !== 'sit') { a.errand = null; a.path = null; a.st = 'idle'; } }
      a.idx = i; a.e = e; a.seat = seat;
      if (seat && a.st === 'sit') { const [x, y] = MP.seatPoint(seat); a.x = x; a.y = y; a.fl = sf; }
      const fd = this.fd[a.fl | 0];
      const tx = Math.floor(a.x), ty = Math.floor(a.y); // empurrado por obra? vai para um tile livre
      if (!fd || fd.blocked.has(tx + ',' + ty)) { const t = seat ? MP.chairTile(seat) : this.randomFreeTile(0); a.fl = seat ? sf : 0; a.x = t[0] + 0.5; a.y = t[1] + 0.5; a.path = null; a.st = 'idle'; }
    });
    for (const id of [...this.emps.keys()]) if (!seen.has(id)) this.emps.delete(id);
  }
  randomFreeTile(f = this.map.fl | 0) {
    const arr = [...(this.fd[f]?.reach || this.reach)]; if (!arr.length) return [0, 1];
    const k = arr[Math.floor(Math.random() * arr.length)].split(','); return [+k[0], +k[1]];
  }
  /** Desempenho (v0.7.1): 'alto' | 'baixo' | 'auto'. Baixo limita o DPR, o fps e desliga brilhos/vapor/partículas extras. */
  setPerf(mode, init) {
    const low = mode === 'baixo';
    this.perf = mode; this.lowFx = low; this.pt.lowFx = low;
    this.maxDpr = low ? 1.25 : (mode === 'alto' ? 3 : 2.5);
    this.fpsAnim = low ? 20 : 30; this.fpsIdle = low ? 5 : 10;
    if (!init) { this.sprites?.clear(); this.bg = null; this.resize(); }
  }
  /** Média móvel do custo de desenho; no modo automático, desliga os efeitos se o aparelho não acompanha. */
  govern(ms) {
    this.cost = this.cost * 0.92 + ms * 0.08;
    if (this.perf === 'auto' && !this.lowFx && this.stats.frames > 90 && this.cost > 20) { this.lowFx = true; this.pt.lowFx = true; this.fpsAnim = 24; this.maxDpr = 1.5; this.resize(); }
  }
  burst(a, kind, n) {
    const col = COLORS[kind] || '#fff'; if (!this.map) return;
    const cnt = this.lowFx ? Math.min(3, n) : n;
    for (let i = 0; i < cnt; i++) { const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, sp = 26 + Math.random() * 38; this.parts.push({ x: a.x, y: a.y, fl: a.fl | 0, age: 0, kind: 'dot', col, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 1.6 + Math.random() * 1.8 }); }
    if (this.parts.length > 140) this.parts.splice(0, this.parts.length - 140);
  }
  pop(kind, text, empId) {
    const a = this.emps.get(empId) || [...this.emps.values()][0];
    if (!a || !this.map) return;
    this.parts.push({ x: a.x, y: a.y, fl: a.fl | 0, age: 0, kind, text, dx: (Math.random() - 0.5) * 18 });
    if (COLORS[kind]) this.burst(a, kind, Math.min(10, 3 + Math.round(parseFloat(text.replace(/[^0-9.]/g, '')) || 1)));
    if (this.parts.length > 60) this.parts.shift();
  }

  // ------------------------------------------------------------ pessoas: necessidades + A*
  /** Caminho (A*) possivelmente entre andares: nós [x, y, andar]. */
  route(a, tile, tfl) {
    const m = this.map; const f0 = a.fl | 0; const clampT = (v) => Math.max(0, Math.min(m.N - 1, Math.floor(v)));
    let cur = [clampT(a.x), clampT(a.y)]; const out = [];
    const seg = (f, from, to) => { const fd = this.fd[f]; if (!fd) return false; const p = MP.findPath(m, fd.blocked, from, to); if (!p) return false; for (const [x, y] of p) { const l = out[out.length - 1]; if (!l || l[0] !== x || l[1] !== y || l[2] !== f) out.push([x, y, f]); } return true; };
    if (f0 === tfl) return seg(f0, cur, tile) ? out : null;
    const hops = MP.floorRoute(m, f0, tfl); if (!hops) return null;
    let f = f0;
    for (const h of hops) { if (!seg(f, cur, h.a)) return null; cur = h.b; f = h.to; out.push([h.b[0], h.b[1], f, 'tp']); }
    return seg(f, cur, tile) ? out : null;
  }
  go(a, tile, errand, tfl = a.fl | 0) {
    const path = this.route(a, tile, tfl);
    if (!path) return false;
    a.path = path; a.pi = 0; a.errand = errand; a.st = 'go'; return true;
  }
  goHome(a) {
    if (!a.seat) { const t = this.randomFreeTile(a.fl | 0); return this.go(a, t, { kind: 'wander' }); }
    return this.go(a, MP.chairTile(a.seat), { kind: 'home' }, a.seat.fl | 0);
  }
  pickErrand(a) {
    const n = a.needs; const thr = this.working && a.seat ? 1.5 : 1;
    const own = this.fd[a.fl | 0]?.amen; const all = { toilet: [], drink: [], rest: [], meet: [], read: [], game: [] };
    for (const k of Object.keys(all)) { const mine = own ? own[k] : []; all[k] = mine.length ? mine : Object.values(this.fd).flatMap((d) => d.amen[k]); }
    const g = all;
    const opts = [];
    if (n.wc > thr && g.toilet.length) opts.push(['wc', g.toilet, '🚽', 1]);
    if (n.drink > thr && g.drink.length) opts.push(['drink', g.drink, '☕', 1]);
    if (!this.working || !a.seat) {
      if (n.rest > 0.9 && g.rest.length) opts.push(['rest', g.rest, '🛋️', 1]);
      if (Math.random() < 0.3) { for (const [id, list, ic] of [['meet', g.meet, '💬'], ['read', g.read, '📚'], ['game', g.game, '🎮']]) if (list.length) opts.push([id, list, ic, 0.5]); }
    }
    if (!opts.length) return null;
    const [kind, list, icon] = opts[Math.floor(Math.random() * opts.length)];
    const rec = list[Math.floor(Math.random() * list.length)];
    return { kind, rec, icon };
  }
  think(a, dt) {
    const n = a.needs; const mult = this.working && a.seat ? 0.6 : 1;
    n.wc += dt / 140 * mult; n.drink += dt / 100 * mult; n.rest += dt / (this.working ? 400 : 160);
    if (a.st === 'sit') {
      a.need = 'work'; a.icon = ''; a.timer -= dt;
      if (a.timer <= 0) {
        a.timer = 2 + Math.random() * 4; const er = this.pickErrand(a);
        if (er && this.go(a, er.rec.u, er, er.rec.fl)) a.icon = er.icon;
        else if (er) { n[er.kind === 'wc' ? 'wc' : er.kind === 'drink' ? 'drink' : 'rest'] = 0.4; }
      }
    } else if (a.st === 'idle') {
      a.timer -= dt;
      if (a.timer <= 0) {
        a.timer = 3 + Math.random() * 5;
        if (a.seat && Math.random() < 0.7) { this.goHome(a); return; }
        const er = this.pickErrand(a);
        if (er && this.go(a, er.rec.u, er, er.rec.fl)) a.icon = er.icon;
        else if (!a.seat) { const t = this.randomFreeTile(a.fl | 0); this.go(a, t, { kind: 'wander' }); }
      }
    } else if (a.st === 'use') {
      a.timer -= dt;
      if (a.timer <= 0) { const k = a.errand.kind; if (k === 'wc') n.wc = 0; else if (k === 'drink') n.drink = 0; else if (k === 'rest') n.rest = 0; else n.rest = Math.max(0, n.rest - 0.4); a.icon = ''; a.errand = null; if (!this.goHome(a)) { a.st = 'idle'; a.timer = 1; } }
    }
  }
  update(dt) {
    this.t += dt; this.pt.t = this.t; let anim = this.working || this.parts.length > 0;
    if (this.map) for (const a of this.emps.values()) {
      if (a.st === 'go') {
        const wp = a.path[Math.min(a.pi + 1, a.path.length - 1)];
        if (wp[2] !== undefined && wp[2] !== (a.fl | 0)) { // escada/elevador: aparece no outro andar
          this.parts.push({ x: a.x, y: a.y, fl: a.fl | 0, age: 1.2, kind: 'stairs', text: wp[2] > (a.fl | 0) ? '▲' : '▼', dx: 0 });
          a.fl = wp[2]; a.x = wp[0] + 0.5; a.y = wp[1] + 0.5; a.pi++;
          if (a.pi >= a.path.length - 1) { a.path = null; a.moving = false; a.st = 'idle'; a.errand = null; a.timer = 0.5; }
          continue;
        }
        let tx = wp[0] + 0.5, ty = wp[1] + 0.5;
        const last = a.pi + 1 >= a.path.length - 1;
        if (last && a.errand?.kind === 'home' && a.seat) { [tx, ty] = MP.seatPoint(a.seat); }
        const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy); a.moving = true;
        if (Math.abs(dx - dy) > 0.02) a.fsx = dx - dy > 0 ? 1 : -1; if (Math.abs(dx + dy) > 0.02) a.fsy = dx + dy > 0 ? 1 : -1;
        const step = dt * SPEED;
        if (d <= step) {
          a.x = tx; a.y = ty; a.pi++;
          if (a.pi >= a.path.length - 1 || a.path.length === 1) {
            a.moving = false; a.path = null; const er = a.errand;
            if (er?.kind === 'home') { a.st = 'sit'; a.seated = true; a.timer = 3 + Math.random() * 8; a.errand = null; a.icon = ''; }
            else if (er && er.kind !== 'wander') { a.st = 'use'; a.timer = er.kind === 'wc' ? 4 : er.kind === 'drink' ? 3 : 5 + Math.random() * 3; }
            else { a.st = 'idle'; a.timer = 2 + Math.random() * 3; a.errand = null; a.icon = ''; }
          }
        } else { a.x += dx / d * step; a.y += dy / d * step; }
        anim = true;
      } else { a.moving = false; this.think(a, dt); }
      a.seated = a.st === 'sit'; a.need = a.st === 'sit' ? 'work' : (a.icon ? 'errand' : 'idle');
    }
    // conversa: pessoas paradas e próximas conversam entre si (balão + gesto)
    this.talkT -= dt;
    if (this.talkT <= 0 && this.map) {
      this.talkT = 0.6; const list = [...this.emps.values()].filter((q) => !q.moving && !q.seated && q.st !== 'sit');
      for (const q of list) { q.talk = false; }
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const p = list[i], q = list[j]; if ((p.fl | 0) === (q.fl | 0) && Math.hypot(p.x - q.x, p.y - q.y) < 1.7) { p.talk = q.talk = true; const dx = q.x - p.x, dy = q.y - p.y; p.fsx = dx - dy >= 0 ? 1 : -1; p.fsy = dx + dy >= 0 ? 1 : -1; q.fsx = -p.fsx; q.fsy = -p.fsy; } }
    }
    this.liveT -= dt;
    if (this.liveT <= 0 && this.map) { this.liveT = 1.5; this.hasLive = MP.floorItems(this.map).some((i) => LIVE_KINDS.has(i.k)); }
    for (const p of this.parts) { p.age += dt; if (p.kind === 'dot') { p.vy += 70 * dt; } }
    this.parts = this.parts.filter((p) => p.age < (p.kind === 'dot' ? 0.9 : 1.8));
    this.animating = anim || (this.mode === 'build' && !!this.ghost);
  }

  // ------------------------------------------------------------ caches
  wantBucket() { return bucketFor(this.cam.z * this.dpr); }
  getSprite(kind, w, d, v) {
    const b = this.bucket; const key = `${kind}|${w}|${d}|${v}|${b}`; let sp = this.sprites.get(key); if (sp) return sp;
    const x0 = -32 * d - 8, x1 = 32 * w + 8, yt = -((FH[kind] || 80) + 16), yb = 16 * (w + d) + 8;
    const cv = document.createElement('canvas'); cv.width = Math.ceil((x1 - x0) * b); cv.height = Math.ceil((yb - yt) * b);
    const c = cv.getContext('2d'); c.setTransform(b, 0, 0, b, -x0 * b, -yt * b);
    const p = new Painter(c); p.t = this.t; p.state = this.state; p.drawFurn(kind, w, d, { v, mug: v % 2 === 0 });
    sp = { cv, ox: -x0, oy: -yt, w: cv.width / b, h: cv.height / b }; this.sprites.set(key, sp); this.stats.spriteBuilds++; return sp;
  }
  blit(kind, w, d, v, x, y, mirror, alpha = 1) {
    const sp = this.getSprite(kind, w, d, v); const c = this.ctx; const [px, py] = this.pt.P(x, y, 0);
    c.save(); c.translate(px, py); if (mirror) c.scale(-1, 1); if (alpha < 1) c.globalAlpha = alpha; c.drawImage(sp.cv, -sp.ox, -sp.oy, sp.w, sp.h); c.restore();
  }
  /** Miniatura (canvas) de um móvel para o catálogo. */
  thumb(k, px = 52) {
    const f = MP.FURN[k]; const sp = this.getSprite(k, f.w, f.d, 1); const cv = document.createElement('canvas'); const r = 2;
    cv.width = px * r; cv.height = px * r; cv.style.width = px + 'px'; cv.style.height = px + 'px'; cv.className = 'bb-th';
    const c = cv.getContext('2d'); const sc = Math.min(cv.width / sp.w, cv.height / sp.h) * 0.96;
    c.drawImage(sp.cv, (cv.width - sp.w * sc) / 2, (cv.height - sp.h * sc) / 2, sp.w * sc, sp.h * sc); return cv;
  }
  renderBg() {
    const m = this.map, N = m.N; const b = this.bounds(); const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    const sc = Math.min(this.bucket, Math.sqrt(4.5e6 / (bw * bh)));
    const cv = this.bg?.cv || document.createElement('canvas'); cv.width = Math.ceil(bw * sc); cv.height = Math.ceil(bh * sc);
    const c = cv.getContext('2d'); c.setTransform(sc, 0, 0, sc, -b.x0 * sc, -b.y0 * sc); c.clearRect(b.x0, b.y0, bw, bh);
    const p = new Painter(c); p.state = this.state;
    const W = MP.WALL_STYLES[m.wall] || MP.WALL_STYLES.verde, F = MP.FLOOR_STYLES[m.floor] || MP.FLOOR_STYLES.concreto;
    p.poly([p.P(-0.25, -0.25, -6), p.P(N + 0.25, -0.25, -6), p.P(N + 0.25, N + 0.25, -6), p.P(-0.25, N + 0.25, -6)], 'rgba(60,50,40,.20)');
    p.face([[0, 0, 0], [N, 0, 0], [N, 0, WH], [0, 0, WH]], W.R); p.face([[0, 0, 0], [0, N, 0], [0, N, WH], [0, 0, WH]], W.L);
    for (let i = 1; i < N; i += 2) { p.wq('R', i, i + 1, 0, WH, 'rgba(255,255,255,.07)'); p.wq('L', i, i + 1, 0, WH, 'rgba(0,0,0,.04)'); }
    p.wq('R', 0, N, 0, 8, shade(W.trim, -0.05)); p.wq('L', 0, N, 0, 8, shade(W.trim, -0.15));
    p.wq('R', 0, N, WH - 4, WH, shade(W.R, 0.35)); p.wq('L', 0, N, WH - 4, WH, shade(W.L, 0.2));
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) p.floorTile(x, y, (x + y) % 2 ? F.a : F.b);
    if (m.floor === 'concreto') { c.globalAlpha = 0.16; for (let i = 0; i < N * 1.2; i++) { const x = (i * 2.3 + 1.1) % N, y = (i * 3.7 + 0.6) % N, r = 0.3 + (i % 3) * 0.15; p.face([[x - r, y - r * 0.6, 0], [x + r, y - r * 0.6, 0], [x + r, y + r * 0.6, 0], [x - r, y + r * 0.6, 0]], '#4a4f55'); } c.globalAlpha = 1; }
    // expansão do terreno: contorno mais forte
    const vf = m.fl | 0;
    if (vf === 0) p.drawDecor({ k: 'door', w: 'L', a: 0.7, b: 2.0 });
    c.save(); const [sx, sy] = p.wp('L', 1.35, 94); c.translate(sx, sy); c.transform(1, -0.5, 0, 1, 0, 0);
    p.text(vf === 0 ? (this.state?.studio?.nome || 'ESTÚDIO').slice(0, 16).toUpperCase() : (MP.FLOOR_NAMES[vf] || '').toUpperCase(), 0, 0, 8, shade(W.trim, -0.4)); c.restore();
    if (vf < 0) { c.fillStyle = 'rgba(20,25,40,.28)'; c.beginPath(); c.rect(b.x0, b.y0, bw, bh); c.globalCompositeOperation = 'source-atop'; c.fill(); c.globalCompositeOperation = 'source-over'; }
    for (const it of MP.floorItems(m)) {
      const f = MP.FURN[it.k]; if (f.wall) {
        const slot = it.wl === 'L' ? it.y : it.x; const kk = it.k === 'whiteboard' ? 'white' : it.k === 'painting_l' || it.k === 'frame_s' ? 'painting' : it.k; const wd = f.ww || 1;
        p.drawDecor({ k: kk, w: it.wl === 'L' ? 'L' : 'R', a: slot + Math.min(0.1, wd * 0.2), b: slot + wd - Math.min(0.1, wd * 0.2), v: it.id, c: ['#e8523c', '#3b82c4', '#8a5cc2', '#3da35d'][it.id % 4] });
      }
    }
    for (const it of MP.floorItems(m)) if (MP.FURN[it.k].walk) { c.save(); const [px, py] = p.P(it.x, it.y, 0); c.translate(px, py); if (it.r & 1) c.scale(-1, 1); p.drawFurn(it.k, MP.FURN[it.k].w, MP.FURN[it.k].d, { v: it.id }); c.restore(); }
    this.bg = { cv, sc, x0: b.x0, y0: b.y0, bw, bh, b: this.bucket }; this.stats.bgBuilds++;
  }

  // ------------------------------------------------------------ desenho
  isVisible(x0, y0, x1, y1, h = 80) {
    const P = this.pt.P; const pts = [P(x0, y0, 0), P(x1, y0, 0), P(x1, y1, 0), P(x0, y1, 0)];
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9; for (const [x, y] of pts) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
    const [sx0, sy0] = this.toScreen(minx - 10, miny - h), [sx1, sy1] = this.toScreen(maxx + 10, maxy + 10);
    return sx1 >= -10 && sx0 <= this.W + 10 && sy1 >= -10 && sy0 <= this.H + 10;
  }
  draw(now = performance.now()) {
    if (!this.map) return;
    const interacting = now - this.interacting < 160;
    const want = this.wantBucket();
    if (want !== this.bucket && now - (this.zoomT || 0) > 220 && !this.ptrs.size) { this.bucket = want; this.sprites.clear(); this.bg = null; this.dirty = true; }
    const interval = this.dirty || interacting ? 0 : this.animating ? 1000 / this.fpsAnim : this.hasLive ? 1000 / this.fpsIdle : 1000 / 6;
    if (now - this.lastDraw < interval) return;
    this.lastDraw = now; this.dirty = false; this.stats.frames++; const _t0 = performance.now();
    if (!this.bg) this.renderBg();
    const c = this.ctx; c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, this.W, this.H);
    c.save(); c.translate(this.W / 2, this.vy); c.scale(this.cam.z, this.cam.z); c.translate(-this.cam.x, -this.cam.y);
    const bg = this.bg; c.drawImage(bg.cv, bg.x0, bg.y0, bg.bw, bg.bh);
    const pt = this.pt; pt.ctx = c;
    if (this.mode === 'build') this.drawGrid(c);
    // desenháveis dinâmicos (pessoas em pé) inseridos na ordem estática
    const order = this.order; const stand = [];
    const vf = this.map.fl | 0;
    for (const a of this.emps.values()) { if ((a.fl | 0) !== vf || (a.seated && a.seat)) continue; stand.push(a); }
    const slots = new Map();
    for (const a of stand) {
      const A = { x0: a.x - 0.3, y0: a.y - 0.3, x1: a.x + 0.3, y1: a.y + 0.3 }; let lb = -1, fa = order.length;
      for (let i = 0; i < order.length; i++) { const o = order[i]; if (before(o, A)) lb = i; if (before(A, o) && fa === order.length) fa = i; }
      const pos = Math.min(lb + 1, fa); if (!slots.has(pos)) slots.set(pos, []); slots.get(pos).push(a);
    }
    const flush = (i) => { const l = slots.get(i); if (!l) return; l.sort((p, q) => p.x + p.y - (q.x + q.y)); for (const a of l) pt.drawPerson(a, false); };
    for (let i = 0; i <= order.length; i++) {
      flush(i); if (i === order.length) break; const o = order[i];
      if (o.it.id === this.hideId) continue;
      if (!this.isVisible(o.x0, o.y0, o.x1, o.y1)) continue;
      if (o.kind === 'chair') { const occ = [...this.emps.values()].find((a) => a.seat === o.it && a.seated && (a.fl | 0) === vf); const [sx, sy] = MP.seatPoint(o.it); if (occ) { occ.back = MP.seatBack(o.it); pt.drawPerson(occ, true); } else { const [fx, fy] = pt.P(sx, sy, 0); pt.emptyChair(fx, fy); } continue; }
      this.drawItem(o.it);
    }
    if (this.mode === 'build') this.drawBuildOverlay(c);
    for (const p of this.parts) {
      if ((p.fl | 0) !== vf) continue;
      if (p.kind === 'dot') { const [sx, sy] = pt.P(p.x, p.y, 70); const k = p.age / 0.9; c.globalAlpha = Math.max(0, 1 - k); c.fillStyle = p.col; c.beginPath(); c.arc(sx + p.vx * p.age, sy + p.vy * p.age, p.r * (1 - k * 0.4), 0, 7); c.fill(); c.globalAlpha = 1; continue; }
      const k = p.age / 1.8; const [sx, sy] = pt.P(p.x, p.y, 60 + k * 46);
      c.globalAlpha = Math.max(0, 1 - k * k); const col = COLORS[p.kind] || (p.kind === 'stairs' ? '#3b82c4' : '#fff');
      c.beginPath(); c.arc(sx + p.dx, sy, 11, 0, 7); c.fillStyle = col; c.fill(); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.9)'; c.stroke();
      pt.text(p.text, sx + p.dx, sy + 4, 11, p.kind === 'design' ? '#5b4300' : '#fff'); c.globalAlpha = 1;
    }
    c.restore();
    this.govern(performance.now() - _t0);
    if (this.mini && (now - (this.miniT || 0) > 250 || this.dirty || interacting)) { this.miniT = now; this.drawMini(); }
  }
  drawItem(it) {
    const f = MP.FURN[it.k]; if (f.walk || f.wall) return; const c = this.ctx, pt = this.pt;
    const v = it.id % 4;
    if (it.k === 'plant') { c.save(); const [px, py] = pt.P(it.x, it.y, 0); c.translate(px, py); pt.drawFurn('plant', 1, 1, {}); c.restore(); return; }
    this.blit(it.k, f.w, f.d, v, it.x, it.y, !!(it.r & 1));
    if (f.portal) { const dir = MP.portalDir(this.map, it); const { w, d } = MP.size(it); const [ax, ay] = pt.P(it.x + w / 2, it.y + d / 2, 46); c.save(); c.globalAlpha = 0.9; pt.text(dir > 0 ? '▲' : dir < 0 ? '▼' : '•', ax, ay, 13, dir > 0 ? '#1d7fd6' : '#d6571d'); c.restore(); }
    // camadas vivas: luzes de servidor, vapor do café, bolhas, marcadores
    if (LIVE_KINDS.has(it.k) && !f.seat) { const [px, py] = pt.P(it.x, it.y, 0); c.save(); c.translate(px, py); if (it.r & 1) c.scale(-1, 1); pt.liveFurn(it.k, it.id, this.working); c.restore(); }
    // camadas vivas (telas, TV)
    if (f.seat || it.k === 'tv') {
      const [px, py] = pt.P(it.x, it.y, 0); c.save(); c.translate(px, py); if (it.r & 1) c.scale(-1, 1);
      if (it.k === 'tv') pt.tvLive();
      else {
        const tier = it.k === 'desk' ? 0 : it.k === 'desk_pro' ? 1 : 2; const a = [...this.emps.values()].find((q) => q.seat === it);
        pt.deskLive(tier, this.working && !!a && a.seated, it.id);
        if (a && this.state.office > 0 && this.cam.z * this.dpr >= 0.9) { c.save(); c.globalAlpha = 0.55; const [fx, fy] = pt.P(1, 1.55, 0); pt.text(a.e.name.split(' ')[0], fx, fy, 9, '#26323f'); c.restore(); }
      }
      c.restore();
    }
  }
  drawGrid(c) {
    const N = this.map.N, pt = this.pt; c.save(); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1 / this.cam.z; c.beginPath();
    for (let i = 0; i <= N; i++) { c.moveTo(...pt.P(i, 0, 0.5)); c.lineTo(...pt.P(i, N, 0.5)); c.moveTo(...pt.P(0, i, 0.5)); c.lineTo(...pt.P(N, i, 0.5)); }
    c.stroke();
    const base = MP.BASE_N[this.map.level]; if (N > base) { c.strokeStyle = 'rgba(255,214,90,.8)'; c.lineWidth = 2 / this.cam.z; c.beginPath(); c.moveTo(...pt.P(base, 0, 0.5)); c.lineTo(...pt.P(base, N, 0.5)); c.moveTo(...pt.P(0, base, 0.5)); c.lineTo(...pt.P(N, base, 0.5)); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.55)'; for (const [x, y] of MP.ENTRY) { c.beginPath(); c.moveTo(...pt.P(x, y, 0.6)); c.lineTo(...pt.P(x + 1, y, 0.6)); c.lineTo(...pt.P(x + 1, y + 1, 0.6)); c.lineTo(...pt.P(x, y + 1, 0.6)); c.closePath(); c.fillStyle = 'rgba(255,230,120,.35)'; c.fill(); }
    c.restore();
  }
  drawBuildOverlay(c) {
    const pt = this.pt;
    const tilePoly = (x0, y0, x1, y1, fill, stroke, z = 1) => { c.beginPath(); c.moveTo(...pt.P(x0, y0, z)); c.lineTo(...pt.P(x1, y0, z)); c.lineTo(...pt.P(x1, y1, z)); c.lineTo(...pt.P(x0, y1, z)); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2 / this.cam.z; c.stroke(); } };
    if (this.selId != null) { const it = MP.floorItems(this.map).find((i) => i.id === this.selId); if (it && !MP.FURN[it.k].wall) { const r = rectsOf(it); tilePoly(r.x0, r.y0, r.x1, r.y1, 'rgba(255,214,90,.25)', '#ffd65a'); const [sx, sy] = pt.P((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, 40 + Math.sin(this.t * 4) * 3); c.fillStyle = '#ffd65a'; c.beginPath(); c.moveTo(sx, sy + 8); c.lineTo(sx - 7, sy - 4); c.lineTo(sx + 7, sy - 4); c.fill(); } else if (it) { const slot = it.wl === 'L' ? it.y : it.x; const [sx, sy] = it.wl === 'L' ? pt.P(0, slot + 0.5, 56) : pt.P(slot + 0.5, 0, 56); c.strokeStyle = '#ffd65a'; c.lineWidth = 3 / this.cam.z; c.beginPath(); c.arc(sx, sy, 18, 0, 7); c.stroke(); } }
    const g = this.ghost; if (!g) return; const f = MP.FURN[g.k]; const ok = !g.err;
    if (f.wall) {
      const slot = g.wl === 'L' ? g.y : g.x; const wd = f.ww || 1; const [sx, sy] = g.wl === 'L' ? pt.P(0, slot + wd / 2, 56) : pt.P(slot + wd / 2, 0, 56);
      c.save(); c.globalAlpha = 0.85; c.strokeStyle = ok ? '#3ddc84' : '#ff5a4d'; c.lineWidth = 4 / this.cam.z; c.beginPath(); c.arc(sx, sy, 22, 0, 7); c.stroke(); c.fillStyle = ok ? 'rgba(61,220,132,.3)' : 'rgba(255,90,77,.3)'; c.fill(); c.restore();
      const kk = g.k === 'whiteboard' ? 'white' : g.k === 'painting_l' || g.k === 'frame_s' ? 'painting' : g.k; const wl = g.wl === 'L' ? 'L' : 'R'; c.save(); c.globalAlpha = 0.8; pt.drawDecor({ k: kk, w: wl, a: slot + Math.min(0.1, wd * 0.2), b: slot + wd - Math.min(0.1, wd * 0.2), v: 1, c: '#e8523c' }); c.restore(); return;
    }
    const { w, d } = MP.size(g);
    tilePoly(g.x, g.y, g.x + w, g.y + d, ok ? 'rgba(61,220,132,.35)' : 'rgba(255,90,77,.4)', ok ? '#3ddc84' : '#ff5a4d');
    if (f.seat) { const [cx, cy] = MP.chairTile(g); tilePoly(cx, cy, cx + 1, cy + 1, 'rgba(120,180,255,.3)', '#78b4ff'); }
    this.blit(g.k, f.w, f.d, 1, g.x, g.y, !!(g.r & 1), f.walk ? 0.8 : 0.78);
  }
  miniScale() { const b = this.bounds(); const mw = this.mini.clientWidth || 110, mh = this.mini.clientHeight || 70; const s = Math.min((mw - 6) / (b.x1 - b.x0), (mh - 6) / (b.y1 - b.y0)); return { s, ox: (mw - (b.x1 - b.x0) * s) / 2, oy: (mh - (b.y1 - b.y0) * s) / 2 }; }
  drawMini() {
    const cv = this.mini; const dpr = Math.min(2, this.dpr); const w = cv.clientWidth || 110, h = cv.clientHeight || 70;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    const { s, ox, oy } = this.miniScale(); const b = this.bounds(); const m = this.map; const pt = this.pt;
    const T = (x, y, z = 0) => { const [wx, wy] = pt.P(x, y, z); return [(wx - b.x0) * s + ox, (wy - b.y0) * s + oy]; };
    const poly = (x0, y0, x1, y1, fill) => { c.beginPath(); c.moveTo(...T(x0, y0)); c.lineTo(...T(x1, y0)); c.lineTo(...T(x1, y1)); c.lineTo(...T(x0, y1)); c.closePath(); c.fillStyle = fill; c.fill(); };
    const F = MP.FLOOR_STYLES[m.floor] || MP.FLOOR_STYLES.concreto; poly(0, 0, m.N, m.N, F.a);
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; c.stroke();
    const col = { trabalho: '#d9b27c', tech: '#5b6677', salas: '#c58f5a', copa: '#e9eef2', conforto: '#5f9fe0', decor: '#44bb66', parede: '#f5c242' };
    for (const it of MP.floorItems(m)) { const f = MP.FURN[it.k]; if (f.wall) continue; const r = rectsOf(it); poly(r.x0, r.y0, r.x1, r.y1, f.walk ? 'rgba(200,100,60,.45)' : (it.k === 'toilet' ? '#9fd3ee' : col[f.cat] || '#999')); }
    c.fillStyle = '#fff'; c.strokeStyle = '#223'; for (const a of this.emps.values()) { if ((a.fl | 0) !== (m.fl | 0)) continue; const [x, y] = T(a.x, a.y); c.beginPath(); c.arc(x, y, 2.2, 0, 7); c.fill(); c.lineWidth = 0.8; c.stroke(); }
    const hw = this.W / 2 / this.cam.z, hh = this.vy / this.cam.z; const x0 = (this.cam.x - hw - b.x0) * s + ox, y0 = (this.cam.y - hh - b.y0) * s + oy, x1 = (this.cam.x + hw - b.x0) * s + ox, y1 = (this.cam.y + hh - b.y0) * s + oy;
    c.strokeStyle = '#ffd65a'; c.lineWidth = 1.5; c.strokeRect(Math.max(0, x0), Math.max(0, y0), Math.max(4, Math.min(w, x1) - Math.max(0, x0)), Math.max(4, Math.min(h, y1) - Math.max(0, y0)));
  }
}
