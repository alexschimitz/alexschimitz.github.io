// Mapa isométrico da cidade fictícia "São Pixelo" (canvas 2D): terreno, ruas, quarteirões por bairro, prédios clicáveis, carros animados.
// Duas camadas em cache (chão/ruas e prédios) + carros por cima; câmera com arrastar, pinça, roda e botões.
import * as CT from './city.js';
import { Painter, shade } from './sprites.js';

const MARGIN = 2;
const isRoad = (v) => v === 4 || v === 9;
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return (h ^ (h >>> 16)) / 4294967295; };
const blockOf = (x, y) => [Math.min(2, Math.floor(x / 5)), Math.min(2, Math.floor(y / 5))];
export const districtAt = (x, y) => { const [bx, by] = blockOf(x, y); return CT.BLOCK_DISTRICT[by][bx]; };

export class CityMap {
  constructor(canvas, opts = {}) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.opts = opts; this.pt = new Painter(this.ctx);
    { const pm = document.documentElement.dataset.perf || 'auto'; this.perf = pm; this.lowFx = pm === 'baixo'; this.maxDpr = this.lowFx ? 1.25 : pm === 'alto' ? 3 : 2.5; }
    this.cam = { x: 0, y: 0, z: 1 }; this.W = 300; this.H = 300; this.dpr = 1; this.bucket = 1; this.layers = null; this.sel = null; this.state = null;
    this.t = 0; this.dirty = true; this.ptrs = new Map(); this.onSelect = null; this.userMoved = false; this.cars = this.makeCars(); this.buses = this.makeBuses(); this.peds = this.makePeds(); this.forceHour = null; this.forceWeather = null; this.lastDraw = 0; this.pulse = 0;
    this.bindInput(); this.resize();
  }
  bounds() { const n = CT.CITY_W + MARGIN; return { x0: -(CT.CITY_H + MARGIN) * 32 - 20, x1: n * 32 + 20, y0: -MARGIN * 16 - 150, y1: (CT.CITY_W + CT.CITY_H + MARGIN * 2) * 16 + 24 }; }
  fitZoom() { const b = this.bounds(); return Math.min((this.W - 8) / (b.x1 - b.x0), (this.H - 8) / (b.y1 - b.y0)); }
  fit() { const b = this.bounds(); this.cam.z = this.fitZoom(); this.cam.x = (b.x0 + b.x1) / 2; this.cam.y = (b.y0 + b.y1) / 2 + 10; this.userMoved = false; this.dirty = true; }
  clamp() { const b = this.bounds(); this.cam.x = Math.max(b.x0, Math.min(b.x1, this.cam.x)); this.cam.y = Math.max(b.y0, Math.min(b.y1, this.cam.y)); }
  /** Desempenho (v0.7.1): baixo limita o DPR e reduz o número de carros/pedestres desenhados. */
  setPerf(mode) {
    this.perf = mode; this.lowFx = mode === 'baixo'; this.maxDpr = this.lowFx ? 1.25 : mode === 'alto' ? 3 : 2.5;
    if (this.cv) { this.layers = null; this.resize(); }
  }
  resize() {
    const r = this.cv.getBoundingClientRect(); this.dpr = Math.min(this.maxDpr || 3, window.devicePixelRatio || 1); this.W = Math.max(50, r.width); this.H = Math.max(50, r.height);
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr); if (!this.userMoved) this.fit(); this.dirty = true;
  }
  zoomAt(f, sx = this.W / 2, sy = this.H / 2) {
    const c = this.cam; const wx = (sx - this.W / 2) / c.z + c.x, wy = (sy - this.H / 2) / c.z + c.y; const fz = this.fitZoom();
    c.z = Math.max(fz * 0.8, Math.min(fz * 4.2, c.z * f)); c.x = wx - (sx - this.W / 2) / c.z; c.y = wy - (sy - this.H / 2) / c.z; this.clamp(); this.userMoved = true; this.dirty = true; this.zoomT = performance.now();
  }
  toWorld(sx, sy) { return [(sx - this.W / 2) / this.cam.z + this.cam.x, (sy - this.H / 2) / this.cam.z + this.cam.y]; }
  toScreen(wx, wy) { return [(wx - this.cam.x) * this.cam.z + this.W / 2, (wy - this.cam.y) * this.cam.z + this.H / 2]; }
  floorAt(sx, sy, z = 0) { const [wx, wy0] = this.toWorld(sx, sy); const wy = wy0 + z; return [wy / 32 + wx / 64, wy / 32 - wx / 64]; }

  bindInput() {
    const cv = this.cv; cv.style.touchAction = 'none';
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture?.(e.pointerId); const [x, y] = pos(e); this.ptrs.set(e.pointerId, { x, y, sx: x, sy: y, t: performance.now(), moved: false }); if (this.ptrs.size === 2) { const [a, b] = [...this.ptrs.values()]; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; } });
    cv.addEventListener('pointermove', (e) => {
      const p = this.ptrs.get(e.pointerId); if (!p) return; const [x, y] = pos(e); const dx = x - p.x, dy = y - p.y; p.x = x; p.y = y;
      if (Math.hypot(x - p.sx, y - p.sy) > 7) p.moved = true;
      if (this.ptrs.size >= 2 && this.pinch) { const [a, b] = [...this.ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; this.cam.x -= (mx - this.pinch.mx) / this.cam.z; this.cam.y -= (my - this.pinch.my) / this.cam.z; if (this.pinch.d > 0) this.zoomAt(d / this.pinch.d, mx, my); this.pinch.d = d; this.pinch.mx = mx; this.pinch.my = my; this.clamp(); this.userMoved = true; this.dirty = true; }
      else if (p.moved) { this.cam.x -= dx / this.cam.z; this.cam.y -= dy / this.cam.z; this.clamp(); this.userMoved = true; this.dirty = true; }
    });
    const up = (e) => { const p = this.ptrs.get(e.pointerId); if (!p) return; this.ptrs.delete(e.pointerId); if (this.ptrs.size < 2) this.pinch = null; const tap = !p.moved && performance.now() - p.t < 600 && this.ptrs.size === 0 && !this.multi; if (this.ptrs.size === 0) this.multi = false; else this.multi = true; if (e.type === 'pointerup' && tap) this.tap(p.x, p.y); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = pos(e); this.zoomAt(Math.exp(-e.deltaY * 0.0016), x, y); }, { passive: false });
  }
  tap(sx, sy) {
    let best = null, bs = -1;
    for (const p of this.placeList()) {
      const h = p.h * 0.8; for (const z of [0, h * 0.5, h]) { const [fx, fy] = this.floorAt(sx, sy, z); if (fx >= p.x && fx < p.x + p.w && fy >= p.y && fy < p.y + p.d) { const sc = p.x + p.y + p.w + p.d; if (sc > bs) { best = p; bs = sc; } break; } }
    }
    if (!best) { // tocou num bairro?
      const [fx, fy] = this.floorAt(sx, sy); if (fx >= 0 && fy >= 0 && fx < CT.CITY_W && fy < CT.CITY_H) { this.onSelect?.({ district: districtAt(Math.floor(fx), Math.floor(fy)) }); return; }
      this.onSelect?.(null); return;
    }
    this.onSelect?.({ place: best.id });
  }
  placeList() {
    const out = CT.PLACES.filter((p) => p.id !== 'home').map((p) => ({ ...p }));
    const hd = this.state ? CT.district(this.state) : CT.DISTRICTS.vila; const [hx, hy] = hd.lot; const home = CT.PLACE_BY_ID.home;
    out.push({ ...home, x: hx, y: hy }); return out;
  }
  setState(s) { this.state = s; const sig = s.city?.home + '|' + s.city?.visits; if (sig !== this.sig) { this.sig = sig; this.layers = null; this.dirty = true; } }
  select(id) { this.sel = id; this.dirty = true; }

  // ---------------------------------------------------------------- camadas
  makeCars() {
    const cars = [];
    for (const r of [4, 9]) for (let i = 0; i < 4; i++) {
      cars.push({ axis: 'x', lane: r, p: hash(r, i) * CT.CITY_W, v: (i % 2 ? 1 : -1) * (0.9 + hash(i, r) * 0.7), c: ['#e8523c', '#3b82c4', '#f5c242', '#3da35d', '#8a5cc2'][(i + r) % 5] });
      cars.push({ axis: 'y', lane: r, p: hash(i, r + 3) * CT.CITY_H, v: (i % 2 ? -1 : 1) * (0.8 + hash(r, i + 5) * 0.7), c: ['#f0a030', '#d94a8c', '#2fc4e6', '#e8e2cf', '#3b4350'][(i + r + 1) % 5] });
    }
    return cars;
  }
  makeBuses() {
    return [{ axis: 'x', lane: 4, p: 2, v: 1.0, stop: 0, c: '#f5c242' }, { axis: 'y', lane: 9, p: 8, v: 0.9, stop: 0, c: '#3b82c4' }, { axis: 'x', lane: 9, p: 11, v: 1.05, stop: 0, c: '#3da35d' }];
  }
  makePeds() {
    const out = []; const cols = ['#e8523c', '#3b82c4', '#f5c242', '#3da35d', '#8a5cc2', '#e07aa8', '#2fc4e6', '#f0f0f0']; let k = 0;
    for (const ax of ['x', 'y']) for (const r of [4, 9]) for (const side of [0.08, 0.92]) for (let i = 0; i < 3; i++, k++) {
      out.push({ axis: ax, line: r + side, p: hash(k, 17) * CT.CITY_W, v: (hash(k, 3) > 0.5 ? 1 : -1) * (0.22 + hash(k, 9) * 0.25), c: cols[k % cols.length], ph: hash(k, 5) * 6 });
    }
    return out;
  }
  /** Hora do dia (0..24) com ciclo em tempo real (~3 min); `forceHour` fixa a hora (usado em capturas/testes). */
  hour() { if (this.forceHour != null) return this.forceHour; return ((this.t0 ?? 9) + this.t / 180 * 24) % 24; }
  daylight(hr = this.hour()) { // 0 = noite, 1 = dia
    if (hr >= 7.5 && hr <= 17.5) return 1; if (hr > 17.5 && hr < 20) return 1 - (hr - 17.5) / 2.5; if (hr >= 5 && hr < 7.5) return (hr - 5) / 2.5; return 0;
  }
  buildLayers() {
    const n = CT.CITY_W; const b = this.bounds(); const bw = b.x1 - b.x0, bh = b.y1 - b.y0; const sc = Math.min(this.bucket, Math.sqrt(4.5e6 / (bw * bh)));
    const mk = () => { const cv = document.createElement('canvas'); cv.width = Math.ceil(bw * sc); cv.height = Math.ceil(bh * sc); const c = cv.getContext('2d'); c.setTransform(sc, 0, 0, sc, -b.x0 * sc, -b.y0 * sc); return { cv, c }; };
    const A = mk(), B = mk(); const pa = new Painter(A.c), pb = new Painter(B.c); const s = this.state;
    // água ao redor + chão
    const M = MARGIN;
    for (let x = -M; x < CT.CITY_W + M; x++) for (let y = -M; y < CT.CITY_H + M; y++) {
      const inside = x >= 0 && y >= 0 && x < CT.CITY_W && y < CT.CITY_H;
      if (!inside) { const far = Math.max(-x, -y, x - CT.CITY_W + 1, y - CT.CITY_H + 1); pa.floorTile(x, y, (x + y) % 2 ? '#7fc1e0' : '#74b6d6', 'rgba(255,255,255,.08)'); if (far === 1) pa.face([[x, y, 0], [x + 1, y, 0], [x + 1, y + 1, 0], [x, y + 1, 0]], 'rgba(255,255,255,.12)'); }
    }
    // base de terra/areia sob a cidade
    pa.box(-0.15, -0.15, -10, CT.CITY_W + 0.3, CT.CITY_H + 0.3, 10, '#a8865a', 'rgba(0,0,0,.2)');
    for (let x = 0; x < CT.CITY_W; x++) for (let y = 0; y < CT.CITY_H; y++) {
      const road = isRoad(x) || isRoad(y);
      if (road) { pa.floorTile(x, y, '#5a6068', 'rgba(0,0,0,.08)'); continue; }
      const d = CT.DISTRICTS[districtAt(x, y)]; const k = hash(x, y);
      pa.floorTile(x, y, shade(d.cor, (x + y) % 2 ? 0.1 : 0.02 + k * 0.04), 'rgba(0,0,0,.05)');
    }
    // calçadas: borda clara ao lado das ruas
    const c = A.c; c.save(); c.fillStyle = 'rgba(255,255,255,.35)';
    for (let x = 0; x < CT.CITY_W; x++) for (let y = 0; y < CT.CITY_H; y++) {
      if (isRoad(x) || isRoad(y)) continue; const adj = isRoad(x - 1) || isRoad(x + 1) || isRoad(y - 1) || isRoad(y + 1) || x === 0 || y === 0 || x === CT.CITY_W - 1 || y === CT.CITY_H - 1;
      if (adj) pa.face([[x + 0.06, y + 0.06, 0.2], [x + 0.94, y + 0.06, 0.2], [x + 0.94, y + 0.94, 0.2], [x + 0.06, y + 0.94, 0.2]], 'rgba(235,230,218,.55)');
    }
    c.restore();
    // faixas das ruas
    c.save(); c.strokeStyle = 'rgba(255,240,170,.85)'; c.lineWidth = 1.6; c.setLineDash([6, 6]);
    for (const r of [4, 9]) { c.beginPath(); c.moveTo(...pa.P(r + 0.5, 0, 0.3)); c.lineTo(...pa.P(r + 0.5, CT.CITY_H, 0.3)); c.moveTo(...pa.P(0, r + 0.5, 0.3)); c.lineTo(...pa.P(CT.CITY_W, r + 0.5, 0.3)); c.stroke(); }
    c.setLineDash([]); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2;
    for (const rx of [4, 9]) for (const ry of [4, 9]) for (let i = 0; i < 5; i++) { // faixas de pedestres
      const o = 0.15 + i * 0.18; c.beginPath(); c.moveTo(...pa.P(rx - 0.02, ry - 0.0 + o - 0.0, 0.3)); c.moveTo(...pa.P(rx + o, ry - 0.06, 0.3)); c.lineTo(...pa.P(rx + o, ry - 0.0, 0.3)); c.stroke();
    }
    c.restore();
    // objetos (prédios + decoração) por profundidade
    const objs = [];
    const free = new Set();
    for (const p of this.placeList()) { for (let i = 0; i < p.w; i++) for (let j = 0; j < p.d; j++) free.add((p.x + i) + ',' + (p.y + j)); objs.push({ k: 'place', p, d: p.x + p.w + p.y + p.d }); }
    for (let x = 0; x < CT.CITY_W; x++) for (let y = 0; y < CT.CITY_H; y++) {
      if (isRoad(x) || isRoad(y) || free.has(x + ',' + y)) continue; const r = hash(x + 11, y + 7); const dn = districtAt(x, y);
      if (r < 0.34) objs.push({ k: 'tree', x, y, d: x + y + 1, v: r });
      else if (r < 0.58 && dn !== 'porto') objs.push({ k: 'house', x, y, d: x + y + 1, v: r, dn });
      else if (r < 0.7 && dn === 'porto') objs.push({ k: 'crate', x, y, d: x + y + 1, v: r });
      else if (r > 0.93) objs.push({ k: 'lamp', x, y, d: x + y + 1 });
    }
    objs.sort((p, q) => p.d - q.d);
    for (const o of objs) { B.c.save(); this.drawObj(pb, B.c, o); B.c.restore(); }
    this.layers = { A, B, sc, b };
  }
  drawObj(p, c, o) {
    if (o.k === 'tree') { const [sx, sy] = p.P(o.x + 0.5, o.y + 0.5, 0); c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(sx, sy + 2, 12, 5, 0, 0, 7); c.fill(); c.fillStyle = '#7a5230'; c.fillRect(sx - 2, sy - 12, 4, 12); c.fillStyle = o.v < 0.15 ? '#2f9a4d' : '#3aa856'; c.beginPath(); c.arc(sx, sy - 18, 11, 0, 7); c.arc(sx - 6, sy - 13, 8, 0, 7); c.arc(sx + 6, sy - 13, 8, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.15)'; c.beginPath(); c.arc(sx - 3, sy - 21, 5, 0, 7); c.fill(); }
    else if (o.k === 'lamp') { const [sx, sy] = p.P(o.x + 0.5, o.y + 0.5, 0); c.fillStyle = '#3b4350'; c.fillRect(sx - 1.5, sy - 30, 3, 30); c.fillStyle = '#ffe9a0'; c.beginPath(); c.arc(sx, sy - 32, 4, 0, 7); c.fill(); }
    else if (o.k === 'crate') { p.box(o.x + 0.15, o.y + 0.15, 0, 0.7, 0.7, 14, '#a07a4a'); p.box(o.x + 0.25, o.y + 0.25, 14, 0.5, 0.5, 10, '#b88a54'); }
    else if (o.k === 'house') { const cols = ['#f2e4c9', '#e9c9c9', '#cfe2f0', '#e6efc9']; const col = cols[Math.floor(o.v * 100) % 4]; this.house(p, o.x + 0.1, o.y + 0.1, 0.8, 0.8, 24 + (o.v * 100 % 3) * 5, col, ['#c0503c', '#6b7a8f', '#8a5a3c'][Math.floor(o.v * 50) % 3]); }
    else if (o.k === 'place') this.place(p, c, o.p);
  }
  house(p, x, y, w, d, h, col, roof) {
    p.box(x, y, 0, w, d, h, col);
    const r = 14, mx = x + w / 2;
    p.face([[x, y, h], [x, y + d, h], [mx, y + d, h + r], [mx, y, h + r]], shade(roof, -0.15));
    p.face([[mx, y, h + r], [mx, y + d, h + r], [x + w, y + d, h], [x + w, y, h]], roof);
    p.face([[x, y + d, h], [x + w, y + d, h], [mx, y + d, h + r]], shade(col, -0.05));
    p.face([[x + w * 0.35, y + d, 0], [x + w * 0.65, y + d, 0], [x + w * 0.65, y + d, h * 0.55], [x + w * 0.35, y + d, h * 0.55]], '#7a5230');
    p.face([[x + w, y + d * 0.25, h * 0.4], [x + w, y + d * 0.55, h * 0.4], [x + w, y + d * 0.55, h * 0.75], [x + w, y + d * 0.25, h * 0.75]], '#bfe4f6');
  }
  windows(p, x, y, w, d, h, rows, glass = '#cfe9f5', z0 = 10) {
    const cols = Math.max(1, Math.round(w * 2.2)), cols2 = Math.max(1, Math.round(d * 2.2));
    for (let r = 0; r < rows; r++) {
      const z = z0 + r * ((h - z0 - 8) / rows) + 2, zh = Math.min(10, (h - z0 - 8) / rows - 3);
      for (let i = 0; i < cols; i++) { const u = x + (i + 0.2) * (w / cols); p.face([[u, y + d, z], [u + w / cols * 0.6, y + d, z], [u + w / cols * 0.6, y + d, z + zh], [u, y + d, z + zh]], glass); }
      for (let i = 0; i < cols2; i++) { const v = y + (i + 0.2) * (d / cols2); p.face([[x + w, v, z], [x + w, v + d / cols2 * 0.6, z], [x + w, v + d / cols2 * 0.6, z + zh], [x + w, v, z + zh]], shade(glass, -0.12)); }
    }
  }
  place(p, c, pl) {
    const { x, y, w, d, h, color, id } = pl;
    const base = '#e9e2d0';
    if (id === 'park') {
      p.box(x, y, 0, w, d, 2, '#5fc36f'); p.face([[x + 0.5, y + 0.3, 2.2], [x + w - 0.3, y + 0.5, 2.2], [x + w - 0.5, y + d - 0.3, 2.2], [x + 0.3, y + d - 0.5, 2.2]], '#7fd0ea');
      for (const [tx, ty] of [[x + 0.2, y + 0.2], [x + w - 0.3, y + d - 0.3], [x + w - 0.3, y + 0.2]]) this.drawObj(p, c, { k: 'tree', x: tx - 0.5, y: ty - 0.5, v: 0.5 }); return;
    }
    if (id === 'home') { p.box(x, y, 0, w, d, 2, '#d8cfae'); this.house(p, x + 0.1, y + 0.1, w - 0.2, d - 0.2, h * 0.6, '#f2e4c9', '#e8523c'); this.windows(p, x + 0.1, y + 0.1, w - 0.2, d - 0.2, h * 0.6, 1, '#cfe9f5', 8); this.flag(p, c, x + w - 0.2, y + 0.2, h * 0.6 + 14, '#e8523c'); return; }
    if (id === 'publisher') { p.box(x, y, 0, w, d, h * 0.7, color); p.box(x + 0.15, y + 0.15, h * 0.7, w - 0.3, d - 0.3, h * 0.3, shade(color, 0.08)); this.windows(p, x, y, w, d, h * 0.7, 6, '#9fd3ee', 6); this.windows(p, x + 0.15, y + 0.15, w - 0.3, d - 0.3, h, 2, '#9fd3ee', h * 0.7); p.box(x + 0.7, y + 0.7, h, 0.12, 0.12, 14, '#c0392b'); return; }
    if (id === 'bank' || id === 'uni') {
      p.box(x, y, 0, w, d, 4, '#cfc6b0'); p.box(x + 0.1, y + 0.1, 4, w - 0.2, d - 0.2, h - 12, id === 'bank' ? '#d8dde3' : color);
      for (let i = 0; i < Math.round(w * 2); i++) { const u = x + 0.2 + i * ((w - 0.5) / (Math.round(w * 2) - 1 || 1)); p.box(u, y + d - 0.2, 4, 0.12, 0.12, h - 14, '#f4f1e8'); }
      p.face([[x, y + d, h - 8], [x + w, y + d, h - 8], [x + w / 2, y + d, h + 6]], '#b9b09a'); p.box(x, y, h - 12, w, d, 5, shade(color, -0.1)); this.windows(p, x + 0.1, y + 0.1, w - 0.2, d - 0.2, h - 12, 2, '#cfe9f5', 14); return;
    }
    if (id === 'convention') {
      p.box(x, y, 0, w, d, 24, '#cfd6e6'); p.box(x + 0.15, y + 0.15, 24, w - 0.3, d - 0.3, 14, color); this.windows(p, x, y, w, d, 24, 1, '#bfe4f6', 4);
      for (let i = 0; i < 4; i++) this.flag(p, c, x + 0.3 + i * (w - 0.6) / 3, y + d - 0.1, 46, ['#e8523c', '#f5c242', '#3da35d', '#2fc4e6'][i]); return;
    }
    if (id === 'cafe') { p.box(x + 0.05, y + 0.05, 0, w - 0.1, d - 0.1, h, color); this.awning(p, x + 0.05, y + d - 0.05, w - 0.1, '#e8523c', h - 6); p.box(x + 0.25, y + 0.05, h, 0.1, 0.1, 10, '#555'); return; }
    if (id === 'gamestore') { p.box(x + 0.05, y + 0.05, 0, w - 0.1, d - 0.1, h, '#3b4350'); p.face([[x + 0.1, y + d - 0.05, h - 10], [x + w - 0.1, y + d - 0.05, h - 10], [x + w - 0.1, y + d - 0.05, h - 2], [x + 0.1, y + d - 0.05, h - 2]], color); this.windows(p, x + 0.05, y + 0.05, w - 0.1, d - 0.1, h - 12, 1, '#ffd1e8', 4); return; }
    if (id === 'shop') { p.box(x, y, 0, w, d, h, '#d6dbe0'); p.face([[x, y + d, h - 14], [x + w, y + d, h - 14], [x + w, y + d, h], [x, y + d, h]], color); this.windows(p, x, y, w, d, h - 14, 1, '#bfe4f6', 6); p.box(x + 0.2, y + 0.2, h, 0.7, 0.5, 8, '#9aa3ab'); return; }
    if (id === 'press') { p.box(x, y, 0, w, d, h, '#e5dcc3'); this.windows(p, x, y, w, d, h, 3, '#cfe9f5', 6); p.face([[x, y + d, h - 7], [x + w, y + d, h - 7], [x + w, y + d, h], [x, y + d, h]], color); p.box(x + 0.1, y + 0.1, h, w - 0.2, d - 0.2, 8, shade(color, -0.1)); return; }
    if (id === 'cowork') { p.box(x, y, 0, w, d, h, '#d9efe9'); p.box(x + 0.1, y + 0.1, h, w - 0.2, d - 0.2, 5, color); this.windows(p, x, y, w, d, h, 2, '#bfe4f6', 5); this.drawObj(p, c, { k: 'tree', x: x + w - 0.6, y: y + 0.0, v: 0.5 }); return; }
    p.box(x, y, 0, w, d, h, color); this.windows(p, x, y, w, d, h, 2);
  }
  awning(p, x, y, w, col, z) { const n = 6; for (let i = 0; i < n; i++) { const u = x + i * (w / n); p.face([[u, y, z], [u + w / n, y, z], [u + w / n, y + 0.35, z - 8], [u, y + 0.35, z - 8]], i % 2 ? '#fff' : col); } }
  flag(p, c, x, y, z, col) { const [sx, sy] = p.P(x, y, 0); c.strokeStyle = '#555'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(sx, sy - z + 14); c.lineTo(sx, sy - z - 4); c.stroke(); c.fillStyle = col; c.beginPath(); c.moveTo(sx, sy - z - 4); c.lineTo(sx + 11, sy - z); c.lineTo(sx, sy - z + 4); c.fill(); }

  // ---------------------------------------------------------------- quadro
  draw(now = performance.now()) {
    if (!this.state) return; this.t = now / 1000;
    const want = Math.max(1, Math.min(3, Math.ceil(this.cam.z * this.dpr * 2) / 2));
    if (want !== this.bucket && now - (this.zoomT || 0) > 220 && !this.ptrs.size) { this.bucket = want; this.layers = null; this.dirty = true; }
    if (!this.dirty && now - this.lastDraw < 50) return; this.lastDraw = now; this.dirty = false;
    if (!this.layers) this.buildLayers();
    const dt = Math.min(0.1, (now - (this._lt || now)) / 1000); this._lt = now;
    const c = this.ctx, L = this.layers; c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.clearRect(0, 0, this.W, this.H);
    const hr = this.hour(), dl = this.daylight(hr); const wx = this.forceWeather || CT.weatherOf(this.state.week || 0); this.wx = wx; this.hr = hr;
    const mixc = (a, b, k) => { const pa = [1, 3, 5].map((i) => parseInt(a.substr(i, 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.substr(i, 2), 16)); return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
    const dusk = dl > 0 && dl < 1; const g = c.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, mixc(dusk ? '#f08a5d' : '#1c2748', wx === 'chuva' ? '#8fa3b3' : '#bfe4f6', dusk ? dl : dl)); g.addColorStop(1, mixc(dusk ? '#f7c98b' : '#35467a', wx === 'chuva' ? '#c3cfd8' : '#e8f4fa', dl)); c.fillStyle = g; c.fillRect(0, 0, this.W, this.H);
    if (dl < 0.5) { c.fillStyle = `rgba(255,255,255,${(0.5 - dl) * 1.6})`; for (let i = 0; i < 40; i++) { const sx = hash(i, 1) * this.W, sy = hash(i, 2) * this.H * 0.5; c.fillRect(sx, sy, 1.5, 1.5); } }
    c.save(); c.translate(this.W / 2, this.H / 2); c.scale(this.cam.z, this.cam.z); c.translate(-this.cam.x, -this.cam.y);
    const b = L.b; c.drawImage(L.A.cv, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    const pt = this.pt; pt.ctx = c;
    const night = 1 - dl; const rainy = wx === 'chuva';
    for (const car of this.lowFx ? this.cars.filter((_, i) => i % 2 === 0) : this.cars) { // carros nas ruas
      const len = car.axis === 'x' ? CT.CITY_W : CT.CITY_H; car.p = ((car.p + car.v * (rainy ? 0.8 : 1) * dt + len) % len);
      const lane = car.lane + (car.v > 0 ? 0.68 : 0.22); const x = car.axis === 'x' ? car.p : lane, y = car.axis === 'x' ? lane : car.p;
      const w = car.axis === 'x' ? 0.55 : 0.3, d = car.axis === 'x' ? 0.3 : 0.55;
      pt.box(x - w / 2, y - d / 2, 0.3, w, d, 6, car.c); pt.box(x - w / 4, y - d / 4, 6.3, w / 2, d / 2, 4, shade(car.c, 0.35));
      car.hx = x; car.hy = y;
    }
    for (const bus of this.buses) { // ônibus com paradas
      const len = bus.axis === 'x' ? CT.CITY_W : CT.CITY_H;
      if (bus.stop > 0) bus.stop -= dt; else { const np = bus.p + bus.v * dt; for (const st of [1.5, 6.5, 11.5]) if (bus.p < st && np >= st) { bus.stop = 2.2; bus.p = st; break; } if (bus.stop <= 0) bus.p = (np + len) % len; }
      const lane = bus.lane + 0.68; const x = bus.axis === 'x' ? bus.p : lane, y = bus.axis === 'x' ? lane : bus.p; const w = bus.axis === 'x' ? 1.15 : 0.34, d = bus.axis === 'x' ? 0.34 : 1.15;
      pt.box(x - w / 2, y - d / 2, 0.4, w, d, 10, bus.c); pt.box(x - w / 2 + 0.02, y - d / 2 + 0.02, 6, w - 0.04, d - 0.04, 3.5, '#bfe4f6'); pt.box(x - w / 2, y - d / 2, 10.4, w, d, 1.2, shade(bus.c, -0.2));
      bus.hx = x; bus.hy = y;
    }
    for (const pd of this.peds) { // pedestres nas calçadas
      const len = pd.axis === 'x' ? CT.CITY_W : CT.CITY_H; pd.p = (pd.p + pd.v * dt * (rainy ? 1.4 : 1) + len) % len; pd.ph += dt * 7;
      const x = pd.axis === 'x' ? pd.p : pd.line, y = pd.axis === 'x' ? pd.line : pd.p; const bob = Math.abs(Math.sin(pd.ph)) * 0.8;
      pt.box(x - 0.05, y - 0.05, bob, 0.1, 0.1, 5, pd.c); pt.box(x - 0.04, y - 0.04, 5 + bob, 0.08, 0.08, 3.2, '#f1c9a5');
      if (rainy) pt.box(x - 0.09, y - 0.09, 8.3 + bob, 0.18, 0.18, 1.1, '#445');
    }
    c.drawImage(L.B.cv, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    // luz do dia, noite, nuvens (espaço do mundo)
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    if (wx === 'nuvens' || wx === 'chuva') { c.fillStyle = wx === 'chuva' ? 'rgba(40,55,80,.16)' : 'rgba(40,55,80,.07)'; for (let k = 0; k < 6; k++) { const cx = b.x0 + ((hash(k, 4) * bw + this.t * (6 + k)) % (bw + 200)) - 100, cy = b.y0 + bh * (0.2 + 0.6 * hash(k, 8)); c.beginPath(); c.ellipse(cx, cy, 90 + 40 * hash(k, 2), 38, 0, 0, 7); c.fill(); } }
    if (dl < 1) {
      const tint = dl <= 0 ? '#5a6aa8' : mixc('#5a6aa8', dl > 0.5 ? '#ffffff' : '#f0b080', dl > 0.5 ? (dl - 0.5) * 2 : dl * 2);
      c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = mixc('#5a6aa8', '#ffffff', dl); if (dl > 0 && dl < 0.7) c.fillStyle = mixc('#5a6aa8', '#f4c8a0', dl / 0.7); c.fillRect(b.x0, b.y0, bw, bh); c.restore(); void tint;
      c.save(); c.globalCompositeOperation = 'lighter'; const gl = (x, y, z, r, col, a) => { const [sx, sy] = pt.P(x, y, z); const gr = c.createRadialGradient(sx, sy, 0, sx, sy, r); gr.addColorStop(0, `rgba(${col},${a * night})`); gr.addColorStop(1, `rgba(${col},0)`); c.fillStyle = gr; c.fillRect(sx - r, sy - r, r * 2, r * 2); };
      for (const r of [4, 9]) for (let k = 0; k <= CT.CITY_W; k += 2) { gl(r + 0.5, k, 22, 26, '255,214,120', 0.55); gl(k, r + 0.5, 22, 26, '255,214,120', 0.55); }
      for (const pl of CT.PLACES) if (pl.id !== 'home') for (const f of [0.3, 0.7]) gl(pl.x + pl.w * f, pl.y + pl.d, Math.max(10, pl.h * 0.5), 24, '255,225,150', 0.5);
      const hm = places0(this); gl(hm.x + 1, hm.y + 2, 14, 24, '255,225,150', 0.6);
      for (const car of [...this.cars, ...this.buses]) if (car.hx != null) gl(car.hx, car.hy, 4, 15, '255,240,190', 0.55);
      c.restore();
    }
    if (wx === 'neblina') { c.fillStyle = 'rgba(225,232,238,.38)'; c.fillRect(b.x0, b.y0, bw, bh); }
    // seleção + rota
    const places = this.placeList(); const home = places.find((p) => p.id === 'home');
    if (this.sel && this.sel !== 'home') {
      const p = places.find((q) => q.id === this.sel);
      if (p) {
        const [hx, hy] = [home.x + 1, home.y + 1], [px, py] = [p.x + p.w / 2, p.y + p.d / 2];
        c.save(); c.setLineDash([8, 6]); c.lineDashOffset = -this.t * 20; c.strokeStyle = '#ff7a2f'; c.lineWidth = 3 / this.cam.z * 1.2; c.beginPath(); c.moveTo(...pt.P(hx, hy, 1)); c.lineTo(...pt.P(px, hy, 1)); c.lineTo(...pt.P(px, py, 1)); c.stroke(); c.restore();
      }
    }
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 4);
    for (const p of places) { // pinos
      const sel = p.id === this.sel; const top = p.id === 'park' ? 30 : p.h + 16; const [sx, sy0] = pt.P(p.x + p.w / 2, p.y + p.d / 2, top); const sy = sy0 - (sel ? 6 + pulse * 5 : Math.sin(this.t * 2 + p.x) * 1.5);
      if (sel) { c.beginPath(); c.moveTo(...pt.P(p.x - 0.05, p.y - 0.05, 1)); c.lineTo(...pt.P(p.x + p.w + 0.05, p.y - 0.05, 1)); c.lineTo(...pt.P(p.x + p.w + 0.05, p.y + p.d + 0.05, 1)); c.lineTo(...pt.P(p.x - 0.05, p.y + p.d + 0.05, 1)); c.closePath(); c.fillStyle = 'rgba(255,214,90,.35)'; c.fill(); c.strokeStyle = '#ffb000'; c.lineWidth = 3 / this.cam.z; c.stroke(); }
      c.fillStyle = sel ? '#ffd65a' : '#fff'; c.strokeStyle = sel ? '#c47a00' : '#223'; c.lineWidth = 2 / this.cam.z * 1.1; c.beginPath(); c.arc(sx, sy, 15, 0, 7); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(sx - 5, sy + 13); c.lineTo(sx + 5, sy + 13); c.lineTo(sx, sy + 21); c.closePath(); c.fill(); c.stroke();
      c.font = '17px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#222'; c.fillText(p.ico, sx, sy + 1); c.textBaseline = 'alphabetic';
      const evs = CT.eventsAt(this.state, p.id).length;
      if (evs) { const bp = 1 + 0.12 * Math.sin(this.t * 5); c.fillStyle = '#ff5a1f'; c.strokeStyle = '#fff'; c.lineWidth = 2 / this.cam.z * 1.1; c.beginPath(); c.arc(sx + 12, sy - 12, 8 * bp, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.font = '800 11px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(evs > 1 ? String(evs) : '!', sx + 12, sy - 11.5); c.textBaseline = 'alphabetic'; }
    }
    // nomes dos bairros
    const hid = CT.district(this.state).id;
    for (const dd of Object.values(CT.DISTRICTS)) {
      const bxs = CT.BLOCK_DISTRICT.flatMap((row, by) => row.map((id, bx) => id === dd.id ? [bx, by] : null)).filter(Boolean);
      const [bx, by] = bxs[0]; const cx = bx * 5 + 2, cy = by * 5 + 2; const [sx, sy] = pt.P(cx, cy, 0); const ty = sy + 24;
      const txt = `${dd.nome}${dd.id === hid ? ' ★' : ''}`; c.font = '700 11px system-ui, sans-serif'; const tw = c.measureText(txt).width + 12;
      c.globalAlpha = 0.9; c.fillStyle = dd.id === hid ? '#e8523c' : 'rgba(255,255,255,.92)'; c.beginPath(); c.roundRect(sx - tw / 2, ty - 10, tw, 17, 8); c.fill(); c.globalAlpha = 1;
      c.fillStyle = dd.id === hid ? '#fff' : '#26323f'; c.textAlign = 'center'; c.fillText(txt, sx, ty + 2);
    }
    c.restore();
    if (wx === 'chuva') { // chuva em espaço de tela
      c.strokeStyle = 'rgba(200,220,245,.55)'; c.lineWidth = 1.2; c.beginPath();
      for (let k = 0; k < 90; k++) { const x = (hash(k, 6) * (this.W + 60) + this.t * 90) % (this.W + 60) - 30, y = ((hash(k, 7) * this.H + this.t * 520 + k * 13) % (this.H + 40)) - 20; c.moveTo(x, y); c.lineTo(x - 5, y + 13); }
      c.stroke();
    }
  }
}
const places0 = (m) => { const hd = m.state ? CT.district(m.state) : CT.DISTRICTS.vila; return { x: hd.lot[0], y: hd.lot[1] }; };
