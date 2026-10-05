// Pintura em canvas 2D isométrico: primitivas, móveis (sprites), itens de parede e pessoas.
// Tudo em coordenadas locais do piso: P(x,y,z) = [(x - y) * 32, (x + y) * 16 - z]. O jogo é 2D isométrico, não 3D.
export const WH = 104; // altura das paredes (px)
export const COLORS = { design: '#f5c242', tech: '#2fc4e6', bug: '#ff8a3d', pesq: '#3558b0' };

const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export function shade(h, f) { const [r, g, b] = hex(h); return f >= 0 ? toHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f) : toHex(r * (1 + f), g * (1 + f), b * (1 + f)); }
export const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export const RUG_COLORS = ['#2d7f86', '#c9743a', '#7a5aa8', '#b34a5a'];
export const PUFF_COLORS = ['#e8523c', '#3da35d', '#f0a030', '#3b82c4'];

/** Altura máxima (px) de cada móvel, para dimensionar o sprite em cache. */
export const FH = { stairs: 52, elevator: 92, desk: 70, desk_pro: 80, desk_ultra: 84, bed: 40, shelf: 92, qa: 70, server: 76, audio: 90, mocap: 100, meeting: 60, coffee: 70, cooler: 56, vending: 70, toilet: 76, sofa: 40, puff: 28, tv: 70, plant: 70, rug: 4, bin: 30, car: 70 };

export class Painter {
  constructor(ctx) { this.ctx = ctx; this.t = 0; this.working = false; this.level = 0; this.state = null; }
  // ---------- primitivas ----------
  P(x, y, z) { return [(x - y) * 32, (x + y) * 16 - z]; }
  poly(pts, fill, stroke) {
    const c = this.ctx; c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
  }
  face(a, fill, stroke) { this.poly(a.map((p) => this.P(...p)), fill, stroke); }
  box(x, y, z, w, d, h, col, stroke = 'rgba(0,0,0,.18)') {
    this.face([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], shade(col, 0.14), stroke);
    this.face([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], col, stroke);
    this.face([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], shade(col, -0.18), stroke);
  }
  // quad numa parede: w='R' (y=0) com a,b ao longo de x; w='L' (x=0) ao longo de y
  wq(w, a, b, z0, z1, fill, stroke) {
    const pts = w === 'R' ? [[a, 0, z0], [b, 0, z0], [b, 0, z1], [a, 0, z1]] : [[0, a, z0], [0, b, z0], [0, b, z1], [0, a, z1]];
    this.face(pts, fill, stroke);
  }
  wp(w, a, z) { return w === 'R' ? this.P(a, 0, z) : this.P(0, a, z); }
  text(t, x, y, size, col, align = 'center', bold = true) {
    const c = this.ctx; c.font = `${bold ? '700 ' : ''}${size}px system-ui, sans-serif`; c.textAlign = align; c.fillStyle = col; c.fillText(t, x, y);
  }

  drawDecor(d) {
    const { w, a, b } = d; const c = this.ctx;
    const mid = (a + (b ?? a)) / 2;
    if (d.k === 'window') {
      this.wq(w, a - 0.08, b + 0.08, 30, 86, '#f2f0e6'); this.wq(w, a, b, 34, 82, '#9fd3ee');
      this.wq(w, a, (a + b) / 2, 58, 82, '#bfe4f6'); this.wq(w, (a + b) / 2 - 0.03, (a + b) / 2 + 0.03, 34, 82, '#f2f0e6'); this.wq(w, a, b, 56, 59, '#f2f0e6');
    } else if (d.k === 'door') {
      this.wq(w, a - 0.06, b + 0.06, 0, 82, '#e9e6de'); this.wq(w, a, b, 0, 78, '#f7f5ef', 'rgba(0,0,0,.2)');
      this.wq(w, a + 0.15, b - 0.15, 40, 70, '#eceae3', 'rgba(0,0,0,.12)'); this.wq(w, a + 0.15, b - 0.15, 8, 34, '#eceae3', 'rgba(0,0,0,.12)');
      const [kx, ky] = this.wp(w, b - 0.12, 36); c.beginPath(); c.arc(kx, ky, 2.5, 0, 7); c.fillStyle = '#c8a24a'; c.fill();
    } else if (d.k === 'cork') {
      this.wq(w, a - 0.05, b + 0.05, 34, 76, '#9a6a3a'); this.wq(w, a, b, 37, 73, '#cfa066');
      const cols = ['#fff', '#ffe27a', '#9be0c0', '#f6a6b5'];
      for (let i = 0; i < 4; i++) { const u = a + 0.12 + i * ((b - a - 0.3) / 4); this.wq(w, u, u + 0.22, 44 + (i % 2) * 14, 60 + (i % 2) * 10, cols[i], 'rgba(0,0,0,.15)'); }
    } else if (d.k === 'chalk') {
      this.wq(w, a - 0.05, b + 0.05, 36, 82, '#8b6a45'); this.wq(w, a, b, 40, 78, '#2f4a3f');
      // diagrama tipo "pinguepongue" original: duas raquetes e uma bolinha
      const p1 = this.wp(w, a + 0.2, 60), p2 = this.wp(w, a + 0.2, 52), p3 = this.wp(w, b - 0.2, 66), p4 = this.wp(w, b - 0.2, 58), pb = this.wp(w, (a + b) / 2, 59);
      c.strokeStyle = '#eaf4ee'; c.lineWidth = 2; c.beginPath(); c.moveTo(...p1); c.lineTo(...p2); c.moveTo(...p3); c.lineTo(...p4); c.stroke();
      c.fillStyle = '#eaf4ee'; c.fillRect(pb[0] - 2, pb[1] - 2, 4, 4);
      c.setLineDash([3, 3]); c.beginPath(); c.moveTo(...this.wp(w, mid, 76)); c.lineTo(...this.wp(w, mid, 42)); c.stroke(); c.setLineDash([]);
    } else if (d.k === 'white') {
      this.wq(w, a - 0.05, b + 0.05, 38, 90, '#cfd3d6'); this.wq(w, a, b, 41, 87, '#fbfcfd');
      const cols = ['#e8523c', '#3b82c4', '#3da35d', '#f0a030'];
      for (let i = 0; i < 4; i++) { const u = a + 0.15 + i * ((b - a - 0.4) / 4); this.wq(w, u, u + 0.2, 52 + (i % 2) * 14, 64 + (i % 2) * 14, cols[i]); }
      c.strokeStyle = '#6b7a88'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(...this.wp(w, a + 0.3, 58)); c.lineTo(...this.wp(w, b - 0.3, 72)); c.stroke();
    } else if (d.k === 'poster') {
      this.wq(w, a, b, 40, 84, d.c || '#e8523c', 'rgba(0,0,0,.2)'); this.wq(w, a + 0.12, b - 0.12, 48, 60, 'rgba(255,255,255,.8)'); this.wq(w, a + 0.12, b - 0.35, 66, 70, 'rgba(255,255,255,.6)');
    } else if (d.k === 'clock') {
      const [x, y] = this.wp(w, a, 76); c.beginPath(); c.arc(x, y, 11, 0, 7); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = '#555'; c.lineWidth = 2; c.stroke();
      c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 7); c.moveTo(x, y); c.lineTo(x + 5, y + 2); c.stroke();
    } else if (d.k === 'shelf') {
      this.wq(w, a, b, 0, 82, '#a8774a'); this.wq(w, a + 0.06, b - 0.06, 6, 78, '#7b5232');
      for (let r = 0; r < 4; r++) {
        const z = 8 + r * 18; this.wq(w, a + 0.06, b - 0.06, z, z + 3, '#a8774a');
        const n = 5; for (let i = 0; i < n; i++) { const u = a + 0.12 + i * ((b - a - 0.24) / n); const cols = ['#c0392b', '#2e86c1', '#27ae60', '#f39c12', '#8e44ad']; this.wq(w, u, u + (b - a - 0.24) / n * 0.8, z + 3, z + 12 + (i % 2) * 3, cols[(i + r) % 5]); }
      }
    } else if (d.k === 'cabinet') {
      this.wq(w, a, b, d.z, d.z + 22, '#a8774a', 'rgba(0,0,0,.2)'); this.wq(w, a + 0.08, b - 0.08, d.z + 3, d.z + 19, '#8a6038');
    } else if (d.k === 'tvwall') {
      this.wq(w, a, b, 36, 74, '#20252c', 'rgba(0,0,0,.4)'); this.wq(w, a + 0.08, b - 0.08, 39, 71, `hsl(${(this.t * 30) % 360},60%,45%)`);
      this.wq(w, a + 0.2, a + 0.6, 50, 60, 'rgba(255,255,255,.35)');
    } else if (d.k === 'painting') {
      const cols = [['#f2c46d', '#3b82c4', '#3da35d'], ['#e8523c', '#f5c242', '#2f3b52'], ['#9be0c0', '#6a4fb3', '#f6a6b5'], ['#2f3b52', '#ff8a3d', '#fff3b0']][(d.v || 0) % 4];
      this.wq(w, a, b, 36, 82, '#6b4a2e', 'rgba(0,0,0,.25)'); this.wq(w, a + 0.06, b - 0.06, 40, 78, cols[0]);
      this.wq(w, a + 0.06, b - 0.06, 40, 56, cols[1]); this.wq(w, a + 0.18, b - 0.4, 56, 70, cols[2]);
    } else if (d.k === 'logo') {
      this.wq(w, a, b, 52, 80, '#2f3b52', 'rgba(0,0,0,.3)');
      const [x, y] = this.wp(w, (a + b) / 2, 62); c.save(); c.translate(x, y); c.transform(1, 0.5, 0, 1, 0, 0); this.text((this.state?.studio?.nome || 'ESTÚDIO').slice(0, 14).toUpperCase(), 0, 0, 9, '#ffd25a'); c.restore();
    }
  }

  /** Pessoa isométrica v0.7.1: 4 direções (frente/costas × esquerda/direita), andar, digitar, pensar, café, leitura, jogo, reunião, cansaço e sono. */
  drawPerson(a, seated) {
    const c = this.ctx, e = a.e; const look = e.look || {}; const t = this.t;
    const [fx, fy] = this.P(a.x, a.y, 0);
    const skin = look.skin || '#f3c9a0', hair = look.hair || '#c8461f', shirt = look.shirt || '#e8523c';
    const ol = 'rgba(30,24,40,.85)';
    const hsh = hashStr(String(e.id));
    const acc = look.acc != null ? look.acc | 0 : (hsh % 9 < 2 ? 1 + (hsh >> 3) % 4 : 0);
    // direção na tela: sx (-1 esquerda / +1 direita), sy (+1 de frente / -1 de costas)
    let sx = a.fsx || (hsh & 1 ? 1 : -1), sy = a.fsy || 1;
    if (seated && a.seat) { const r = a.seat.r & 3; sx = r === 1 || r === 2 ? 1 : -1; sy = r < 2 ? 1 : -1; }
    const back = sy < 0;
    const kind = a.st === 'use' ? a.errand?.kind : null;
    const energy = e.energy ?? 100; const tired = energy < 35, exhausted = energy < 15;
    const working = seated && this.working;
    const ph = t * 9 + (a.idx || 0);
    const rr = (x, y, w, h, r, fill, stroke = true) => { c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = ol; c.lineWidth = 1.2; c.stroke(); } };
    const limb = (x0, y0, x1, y1, col, w = 5.6) => { c.lineCap = 'round'; c.strokeStyle = ol; c.lineWidth = w + 1.8; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
    const hand = (x, y) => { c.fillStyle = skin; c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill(); c.strokeStyle = ol; c.lineWidth = 0.8; c.stroke(); };
    // sombra (maior e mais suave)
    c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(fx, fy + 1, 14, 6.2, 0, 0, 7); c.fill();
    c.fillStyle = 'rgba(0,0,0,.1)'; c.beginPath(); c.ellipse(fx, fy + 1, 18, 8, 0, 0, 7); c.fill();
    const moving = !!a.moving && !seated;
    let bob = moving ? Math.abs(Math.sin(ph)) * 2.2 : Math.sin(t * 2 + (a.idx || 0)) * 0.5;
    if (kind === 'game') bob += Math.abs(Math.sin(t * 7)) * 1.5;
    if (tired && !moving) bob -= 1.2; // ombros caídos
    let base;
    // ----- pernas / cadeira -----
    if (seated) {
      c.fillStyle = '#1f2227'; c.fillRect(fx - 1.5, fy - 14, 3, 12);
      for (const dx of [-11, 0, 11]) { c.beginPath(); c.arc(fx + dx, fy - 1, 2.2, 0, 7); c.fill(); }
      c.fillRect(fx - 12, fy - 3.5, 24, 2.5);
      const sw = working ? Math.sin(t * 1.3 + hsh) * 0.8 : 0;
      c.save(); c.translate(fx + sw, fy); c.rotate(sw * 0.02);
      rr(-12, -24, 24, 10, 4, '#2d3238');
      rr(-10, -46, 20, 24, 7, '#2d3238');
      c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(-8, -44, 3, 18);
      c.restore();
      base = fy - 22;
      if (!back) { rr(fx - 9 + sx * 3, fy - 14, 7, 10, 3, '#3d4f66'); rr(fx + 2 + sx * 3, fy - 14, 7, 10, 3, '#3d4f66'); }
    } else {
      const sw = moving ? Math.sin(ph) * 5 : 0, lift = moving ? Math.max(0, Math.sin(ph)) * 2.5 : 0, lift2 = moving ? Math.max(0, -Math.sin(ph)) * 2.5 : 0;
      const lean = kind === 'rest' ? 1 : 0;
      rr(fx - 7, fy - 17 - bob - lift, 6, 16 + sw * 0.35 + lift, 2, '#3d4f66'); rr(fx + 1, fy - 17 - bob - lift2, 6, 16 - sw * 0.35 + lift2, 2, '#3d4f66');
      rr(fx - 8 + sw * 0.35 + sx * 1.5, fy - 3 - lift, 8, 4, 2, '#222');
      rr(fx + 0 - sw * 0.35 + sx * 1.5, fy - 3 - lift2, 8, 4, 2, '#222');
      base = fy - 16 - bob + lean;
    }
    // ----- tronco -----
    const tx = fx + sx * 0.8;
    rr(tx - 10, base - 26, 20, 27, 6, shirt);
    c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(tx - 9, base - 8, 18, 8);
    c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(sx > 0 ? tx - 9 : tx + 1, base - 24, 8, 22); // lado na sombra
    c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(tx - 8, base - 25, 16, 3);
    if (!back) { c.fillStyle = skin; c.beginPath(); c.moveTo(tx - 4, base - 26); c.lineTo(tx + 4, base - 26); c.lineTo(tx, base - 21); c.fill(); }
    else { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(tx - 5, base - 26, 10, 3); }
    // ----- braços -----
    const shL = [tx - 11, base - 22], shR = [tx + 11, base - 22];
    let handL = [tx - 13, base - 8], handR = [tx + 13, base - 8];
    if (moving) { const s = Math.sin(ph) * 5; handL = [tx - 13, base - 9 + s * 0.8]; handR = [tx + 13, base - 9 - s * 0.8]; }
    if (seated) {
      if (working) {
        const k1 = Math.sin(t * 14 + (a.idx || 0) * 2) * 2, k2 = Math.cos(t * 12 + (a.idx || 0)) * 2;
        handL = [tx - 8, base - 8 + k1]; handR = [tx + 8, base - 8 + k2];
        // pausa para pensar (mão no queixo) por ~1,3 s a cada ~8 s
        const th = ((t + hsh % 8) % 8) < 1.3 && !back;
        if (th) { handR = [tx + 5 * sx + 2, base - 33]; }
      } else { handL = [tx - 9, base - 7]; handR = [tx + 9, base - 7]; }
    }
    if (kind === 'drink') { const k = 0.5 + 0.5 * Math.sin(t * 2.2); handR = [tx + 7 * sx, base - 12 - k * 15]; if (sx < 0) handL = handR, handR = [tx + 13, base - 8]; }
    if (kind === 'read') { handL = [tx - 5, base - 13]; handR = [tx + 5, base - 13]; }
    if (kind === 'game') { handL = [tx - 6, base - 12 + Math.sin(t * 13) * 1.5]; handR = [tx + 6, base - 12 + Math.cos(t * 11) * 1.5]; }
    const talking = !!a.talk || kind === 'meet';
    if (talking) { handR = [tx + 14, base - 22 - Math.abs(Math.sin(t * 4 + hsh)) * 9]; handL = [tx - 12, base - 10]; }
    if (exhausted && working) { handL = [tx - 8, base - 6]; handR = [tx + 8, base - 6]; }
    const armsFront = () => {
      if (back && seated) { limb(shL[0], shL[1], tx - 14, base - 10, shirt, 5); limb(shR[0], shR[1], tx + 14, base - 10, shirt, 5); return; }
      limb(shL[0], shL[1], handL[0], handL[1], shirt); limb(shR[0], shR[1], handR[0], handR[1], shirt);
      hand(handL[0], handL[1]); hand(handR[0], handR[1]);
    };
    armsFront();
    // objetos nas mãos
    if (kind === 'drink') { const [mx, my] = sx < 0 ? handL : handR; rr(mx - 3, my - 7, 6, 8, 2, '#f4f1e8'); c.strokeStyle = '#f4f1e8'; c.lineWidth = 1.4; c.beginPath(); c.arc(mx + 4, my - 3, 2, -1.5, 1.5); c.stroke(); c.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 2; i++) { const k = (t * 0.9 + i * 0.5) % 1; c.globalAlpha = 1 - k; c.beginPath(); c.arc(mx + Math.sin(k * 6 + i) * 2, my - 9 - k * 9, 1.6 + k, 0, 7); c.fill(); c.globalAlpha = 1; } }
    if (kind === 'read') { rr(tx - 8, base - 17, 16, 10, 1.5, '#3f7fc4'); c.fillStyle = '#f4f1e8'; c.fillRect(tx - 7, base - 16, 14, 8); c.fillStyle = '#c9c3ad'; c.fillRect(tx - 0.5, base - 16, 1, 8); hand(handL[0], handL[1]); hand(handR[0], handR[1]); }
    if (kind === 'game') { rr(tx - 6, base - 14, 12, 6, 3, '#2b3038'); c.fillStyle = '#e8523c'; c.fillRect(tx + 2, base - 12, 2, 2); c.fillStyle = '#3ddc84'; c.fillRect(tx - 4, base - 12, 2, 2); }
    // ----- cabeça -----
    let hy = base - 38; const st = look.style || 0;
    const hx = sx * (back ? 2 : 3);
    if (tired) hy += 2; if (exhausted) hy += 1 + (working ? Math.max(0, Math.sin(t * 1.3 + hsh)) * 3 : 0);
    if (working && !tired) hy += Math.sin(t * 5 + hsh) * 0.5;
    const hcx = fx + hx;
    if (st === 1) rr(hcx - 13, hy - 6, 26, 28, 10, hair);                  // cabelo longo atrás
    if (!back) {
      // orelha do lado de trás da rotação (a da frente fica escondida)
      c.fillStyle = skin; c.beginPath(); c.arc(hcx - sx * 11, hy + 2, 3, 0, 7); c.fill();
    }
    c.fillStyle = skin; c.beginPath(); c.arc(hcx, hy, 11.5, 0, 7); c.fill(); c.strokeStyle = ol; c.lineWidth = 1.2; c.stroke();
    if (back) {
      c.fillStyle = hair; c.beginPath(); c.arc(hcx, hy - 0.5, 12, 0, 7); c.fill(); c.strokeStyle = ol; c.lineWidth = 1.2; c.stroke();
      c.fillStyle = 'rgba(0,0,0,.14)'; c.beginPath(); c.arc(hcx - sx * 3, hy + 3, 7, 0, 7); c.fill();
      if (st === 1) { c.fillStyle = hair; c.fillRect(hcx - 12, hy, 24, 17); c.strokeStyle = ol; c.strokeRect(hcx - 12, hy, 24, 17); }
      if (st === 2) { c.fillStyle = hair; c.beginPath(); c.arc(hcx, hy - 14, 5.5, 0, 7); c.fill(); c.strokeStyle = ol; c.stroke(); }
    } else {
      c.fillStyle = hair; c.beginPath(); c.arc(hcx, hy - 1, 12, Math.PI * 1.02, Math.PI * 1.98); c.lineTo(hcx + 11.5, hy - 2); c.quadraticCurveTo(hcx + 4 + sx * 2, hy - 7, hcx - 3, hy - 5); c.quadraticCurveTo(hcx - 9, hy - 3, hcx - 11.5, hy - 2); c.closePath(); c.fill();
      c.strokeStyle = ol; c.lineWidth = 1.2; c.beginPath(); c.arc(hcx, hy - 1, 12, Math.PI * 1.02, Math.PI * 1.98); c.stroke();
      if (st === 0) { c.fillStyle = hair; c.fillRect(hcx - 12, hy - 3, 3, 8); c.fillRect(hcx + 9, hy - 3, 3, 8); }
      else if (st === 1) { c.fillStyle = hair; c.fillRect(hcx - 13, hy - 3, 4, 20); c.fillRect(hcx + 9, hy - 3, 4, 20); }
      else { c.beginPath(); c.arc(hcx, hy - 14, 5.5, 0, 7); c.fill(); c.strokeStyle = ol; c.stroke(); }
      // rosto em 3/4: olhos deslocados para o lado que a pessoa olha; o olho distante é mais estreito
      const sleeping = kind === 'rest' || (exhausted && seated && ((t + hsh) % 6) < 3);
      const ex = hcx + sx * 1.5; const near = 2.8, far = 2.1;
      const lw = sx > 0 ? far : near, rw = sx > 0 ? near : far;
      if (sleeping) { c.strokeStyle = '#2a2230'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(ex - 7, hy + 3); c.quadraticCurveTo(ex - 4.5, hy + 5, ex - 2, hy + 3); c.moveTo(ex + 2, hy + 3); c.quadraticCurveTo(ex + 4.5, hy + 5, ex + 7, hy + 3); c.stroke(); }
      else {
        const blink = ((t * 0.7 + hsh) % 4) < 0.12;
        const look2 = working ? 1 : 0; const gx = sx * 0.8;
        c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex - 4.5, hy + 2, lw, blink ? 0.6 : 3.2, 0, 0, 7); c.ellipse(ex + 4.5, hy + 2, rw, blink ? 0.6 : 3.2, 0, 0, 7); c.fill();
        if (!blink) { c.fillStyle = '#1d1d28'; c.beginPath(); c.arc(ex - 4.5 + gx, hy + 2.6 + look2 * 0.4, Math.min(1.7, lw - 0.6), 0, 7); c.arc(ex + 4.5 + gx, hy + 2.6 + look2 * 0.4, Math.min(1.7, rw - 0.6), 0, 7); c.fill(); }
        if (tired) { c.fillStyle = 'rgba(80,50,110,.4)'; c.beginPath(); c.ellipse(ex - 4.5, hy + 6, 3, 1.3, 0, 0, 7); c.ellipse(ex + 4.5, hy + 6, 3, 1.3, 0, 0, 7); c.fill(); }
      }
      // nariz e bochechas
      c.fillStyle = 'rgba(160,90,60,.5)'; c.beginPath(); c.moveTo(ex + sx * 4 - 1, hy + 5); c.lineTo(ex + sx * 6, hy + 7); c.lineTo(ex + sx * 3, hy + 7.5); c.fill();
      c.fillStyle = 'rgba(224,110,110,.4)'; c.beginPath(); c.arc(ex - 8, hy + 6, 2, 0, 7); c.arc(ex + 8, hy + 6, 2, 0, 7); c.fill();
      // boca
      const mx = ex + sx * 1.2; c.strokeStyle = '#8a3b2b'; c.lineWidth = 1.2; c.fillStyle = '#6b2a22';
      const yawn = tired && ((t * 0.5 + hsh) % 5) < 1.2;
      if (yawn) { c.beginPath(); c.ellipse(mx, hy + 8.5, 2.6, 3.2, 0, 0, 7); c.fill(); }
      else if (talking) { const o = Math.abs(Math.sin(t * 8 + hsh)); c.beginPath(); c.ellipse(mx, hy + 8, 2.4, 0.8 + o * 2.2, 0, 0, 7); c.fill(); }
      else { c.beginPath(); c.moveTo(mx - 2.5, hy + 7.5); c.quadraticCurveTo(mx, hy + (tired ? 7 : 9.5), mx + 2.5, hy + 7.5); c.stroke(); }
      // barba
      if (acc === 4) { c.fillStyle = hair; c.beginPath(); c.moveTo(ex - 9, hy + 5); c.quadraticCurveTo(ex, hy + 18, ex + 9, hy + 5); c.quadraticCurveTo(ex, hy + 9, ex - 9, hy + 5); c.fill(); }
      if (acc === 1) { c.strokeStyle = '#222'; c.lineWidth = 1.4; c.beginPath(); c.arc(ex - 4.5, hy + 2, 4.4, 0, 7); c.arc(ex + 4.5, hy + 2, 4.4, 0, 7); c.moveTo(ex - 0.1, hy + 2); c.lineTo(ex + 0.1, hy + 2); c.stroke(); }
    }
    if (acc === 2) { c.fillStyle = '#2f3b52'; c.beginPath(); c.arc(hcx, hy - 2, 12.5, Math.PI * 1.03, Math.PI * 1.97); c.closePath(); c.fill(); c.strokeStyle = ol; c.lineWidth = 1.2; c.stroke(); if (!back) { c.fillStyle = '#1f2a3d'; c.beginPath(); c.ellipse(hcx + sx * 9, hy - 3, 8, 2.6, 0, 0, 7); c.fill(); } }
    if (acc === 3) { c.strokeStyle = '#222'; c.lineWidth = 2.4; c.beginPath(); c.arc(hcx, hy - 1, 12.8, Math.PI * 1.02, Math.PI * 1.98); c.stroke(); c.fillStyle = '#e8523c'; c.beginPath(); c.roundRect(hcx - 14, hy - 3, 5, 10, 2.5); c.roundRect(hcx + 9, hy - 3, 5, 10, 2.5); c.fill(); }
    // ----- balões e indicadores -----
    if (e.training) this.text('Curso…', fx, hy - 20, 9, '#26323f');
    if (a.need && a.need !== 'work' && a.icon && !kind) { c.font = '14px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(a.icon, fx, hy - 28); }
    if (talking) { // balão de fala animado
      const bx = fx + sx * 16, by = hy - 22; c.fillStyle = 'rgba(255,255,255,.95)'; c.strokeStyle = ol; c.lineWidth = 1; c.beginPath(); c.roundRect(bx - 9, by - 6, 18, 11, 5); c.fill(); c.stroke();
      c.fillStyle = '#26323f'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(bx - 4.5 + i * 4.5, by - 0.5 - (Math.floor(t * 3) % 3 === i ? 1.5 : 0), 1.2, 0, 7); c.fill(); }
    }
    if (kind === 'rest' || (exhausted && seated && ((t + hsh) % 6) < 3)) {
      c.fillStyle = '#3558b0'; c.font = 'bold 11px system-ui, sans-serif'; c.textAlign = 'center';
      for (let i = 0; i < 2; i++) { const k = (t * 0.5 + i * 0.5) % 1; c.globalAlpha = 1 - k; c.fillText('z', fx + 14 + k * 8, hy - 12 - k * 14 - i * 4); } c.globalAlpha = 1;
    } else if (tired && !moving && Math.floor(t * 0.4 + hsh) % 3 === 0) { c.fillStyle = 'rgba(120,190,240,.9)'; c.beginPath(); c.moveTo(hcx + 11, hy - 6); c.quadraticCurveTo(hcx + 14, hy, hcx + 11, hy + 2); c.quadraticCurveTo(hcx + 8, hy, hcx + 11, hy - 6); c.fill(); }
    if (energy < 55) { c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(fx - 11, hy - 22, 22, 4); c.fillStyle = energy < 30 ? '#e8523c' : '#f0b429'; c.fillRect(fx - 11, hy - 22, 22 * energy / 100, 4); }
  }

  // ---------- móveis (coordenadas locais; origem = canto do tile; w x d = área ocupada) ----------
  drawFurn(k, w, d, o = {}) {
    const f = this['f_' + k]; if (f) f.call(this, w, d, o);
  }
  f_desk(w, d, o) { this.deskBody(0, o); }
  f_desk_pro(w, d, o) { this.deskBody(1, o); }
  f_desk_ultra(w, d, o) { this.deskBody(2, o); }
  deskBody(tier, o) {
    const topC = ['#d9b27c', '#3b4350', '#2a2f3a'][tier], legC = ['#9c6f43', '#232830', '#171a21'][tier];
    this.box(0, 0, 0, 0.12, 0.9, 16, legC); this.box(1.88, 0, 0, 0.12, 0.9, 16, legC);
    this.box(-0.05, -0.05, 16, 2.1, 1.0, 4, topC);
    if (tier === 0) {
      this.box(0.55, 0.5, 20, 0.6, 0.25, 1.5, '#e8e2cf');
      this.box(0.8, 0.2, 20, 0.4, 0.3, 3, '#d7ceb2'); this.box(0.6, 0.05, 23, 0.8, 0.5, 22, '#e1d8bc');
      this.face([[0.69, 0.55, 27], [1.31, 0.55, 27], [1.31, 0.55, 41], [0.69, 0.55, 41]], '#0e1a24');
      if (o.mug) this.box(1.55, 0.4, 20, 0.14, 0.14, 6, '#f4f1e8');
    } else {
      this.box(0.5, 0.55, 20, 0.8, 0.28, 1.5, '#1a1d22'); this.box(1.4, 0.55, 20, 0.14, 0.2, 1.5, '#2fc4e6');
      this.box(1.62, 0.1, 20, 0.3, 0.55, 28, tier === 2 ? '#3a2f6b' : '#20252c'); // torre
      const sx = tier === 2 ? [0.02, 0.62, 1.22] : [0.12, 0.82];
      const sw = tier === 2 ? 0.55 : 0.7;
      for (const x of sx) { this.box(x + sw / 2 - 0.05, 0.3, 20, 0.1, 0.1, 6, '#2a2f3a'); this.box(x, 0.2, 26, sw, 0.07, 22, '#14171c'); }
      if (tier === 2) this.face([[0, 0.9, 16.2], [2, 0.9, 16.2], [2, 0.9, 19.5], [0, 0.9, 19.5]], '#8b5cf6');
    }
  }
  /** Telas animadas por cima do sprite em cache. */
  deskLive(tier, working, i) {
    const c = this.ctx;
    if (tier === 0) { this.screen(0.69, 1.31, 0.55, 27, 41, working, i); return; }
    const sx = tier === 2 ? [0.02, 0.62, 1.22] : [0.12, 0.82]; const sw = tier === 2 ? 0.55 : 0.7;
    sx.forEach((x, j) => this.screen(x + 0.03, x + sw - 0.03, 0.27, 28, 46, working, i + j));
  }
  screen(x0, x1, yy, z0, z1, working, i) {
    const t = this.t;
    this.face([[x0, yy, z0], [x1, yy, z0], [x1, yy, z1], [x0, yy, z1]], working ? '#12303a' : '#0e1a24');
    const span = x1 - x0, hh = z1 - z0;
    if (working) {
      for (let k = 0; k < 5; k++) {
        const wl = (0.15 + ((Math.floor(t * 2) + k * 3 + i) % 4) * 0.2) * span;
        const zz = z0 + 2 + k * (hh - 4) / 5;
        this.face([[x0 + span * 0.08, yy, zz], [x0 + span * 0.08 + wl, yy, zz], [x0 + span * 0.08 + wl, yy, zz + 1.8], [x0 + span * 0.08, yy, zz + 1.8]], k % 2 ? '#7be0a8' : '#5fd0f0');
      }
    } else {
      const k = (t * 0.4 + i * 0.37) % 1;
      this.face([[x0 + span * (0.1 + k * 0.6), yy, z0 + hh * 0.4], [x0 + span * (0.2 + k * 0.6), yy, z0 + hh * 0.4], [x0 + span * (0.2 + k * 0.6), yy, z0 + hh * 0.6], [x0 + span * (0.1 + k * 0.6), yy, z0 + hh * 0.6]], '#5fd0f0');
    }
  }
  f_bed() {
    this.box(0, 0, 0, 2, 1, 8, '#7b5232'); this.box(0.05, 0.05, 8, 1.9, 0.9, 8, '#e9eef2');
    this.box(0.1, 0.15, 16, 0.45, 0.7, 4, '#fff'); this.box(0.65, 0.05, 16, 1.3, 0.9, 2.5, '#3f7fc4'); this.box(0.65, 0.05, 18.5, 1.3, 0.12, 0.8, '#6aa2de');
  }
  f_shelf(w, d, o) {
    this.box(0, 0, 0, 2, 0.5, 86, '#a8774a');
    this.face([[0.06, 0.5, 6], [1.94, 0.5, 6], [1.94, 0.5, 82], [0.06, 0.5, 82], ], '#7b5232');
    const cols = ['#c0392b', '#2e86c1', '#27ae60', '#f39c12', '#8e44ad'];
    for (let r = 0; r < 4; r++) {
      const z = 8 + r * 19; this.face([[0.04, 0.5, z], [1.96, 0.5, z], [1.96, 0.5, z + 3], [0.04, 0.5, z + 3]], '#a8774a');
      for (let i = 0; i < 8; i++) { const u = 0.1 + i * 0.22; this.face([[u, 0.5, z + 3], [u + 0.17, 0.5, z + 3], [u + 0.17, 0.5, z + 13 + ((i + r) % 3) * 2], [u, 0.5, z + 13 + ((i + r) % 3) * 2]], cols[(i + r) % 5]); }
    }
  }
  f_qa() {
    this.box(0, 0, 0, 0.1, 0.8, 18, '#4b5560'); this.box(1.9, 0, 0, 0.1, 0.8, 18, '#4b5560'); this.box(-0.04, -0.04, 18, 2.08, 0.9, 4, '#6c7a89');
    this.box(0.15, 0.25, 22, 0.55, 0.35, 3, '#20252c'); this.box(0.2, 0.3, 25, 0.45, 0.25, 12, '#2f3640');
    this.face([[0.24, 0.55, 27], [0.6, 0.55, 27], [0.6, 0.55, 35], [0.24, 0.55, 35]], '#7be0a8');
    for (let i = 0; i < 3; i++) this.box(0.95 + i * 0.3, 0.3, 22, 0.2, 0.34, 3, ['#e8523c', '#3b82c4', '#f5c242'][i]);
    this.box(1.6, 0.15, 22, 0.28, 0.5, 8, '#1a1d22');
  }
  f_server() {
    this.box(0.12, 0.1, 0, 0.78, 0.8, 68, '#2b3038');
    for (let r = 0; r < 6; r++) {
      const z = 6 + r * 10;
      this.face([[0.17, 0.9, z], [0.85, 0.9, z], [0.85, 0.9, z + 7], [0.17, 0.9, z + 7]], '#3d4551');
      this.face([[0.7, 0.9, z + 2], [0.78, 0.9, z + 2], [0.78, 0.9, z + 5], [0.7, 0.9, z + 5]], r % 3 === 1 ? '#ff8a3d' : '#3ddc84');
    }
  }
  f_audio() {
    this.box(0.05, 0.05, 0, 1.9, 1.9, 74, '#3b4350');
    this.face([[0.15, 1.95, 0], [1.85, 1.95, 0], [1.85, 1.95, 66], [0.15, 1.95, 66]], '#2a313b');
    this.face([[0.35, 1.95, 22], [1.65, 1.95, 22], [1.65, 1.95, 58], [0.35, 1.95, 58]], '#9fd3ee');
    this.face([[0.35, 1.95, 44], [1.0, 1.95, 44], [1.0, 1.95, 58], [0.35, 1.95, 58]], 'rgba(255,255,255,.35)');
    this.box(0.9, 1.3, 0, 0.12, 0.12, 40, '#1a1d22'); this.box(0.8, 1.2, 40, 0.32, 0.32, 14, '#20252c'); // microfone no pedestal
    for (let i = 0; i < 5; i++) this.face([[1.95, 0.2 + i * 0.36, 8], [1.95, 0.5 + i * 0.36, 8], [1.95, 0.5 + i * 0.36, 60], [1.95, 0.2 + i * 0.36, 60]], i % 2 ? '#262c35' : '#2f3742');
    this.box(1.2, 0.05, 74, 0.5, 0.3, 6, '#e8523c'); // luz "gravando"
  }
  f_mocap() {
    this.box(0, 0, 0, 3, 2, 4, '#2b3038');
    for (const [x, y] of [[0.08, 0.08], [2.8, 0.08], [0.08, 1.8], [2.8, 1.8]]) this.box(x, y, 4, 0.12, 0.12, 78, '#4b5560');
    this.box(0.08, 0.08, 78, 2.84, 0.12, 4, '#4b5560'); this.box(0.08, 0.08, 78, 0.12, 1.84, 4, '#4b5560');
    this.box(0.08, 1.8, 78, 2.84, 0.12, 4, '#4b5560'); this.box(2.8, 0.08, 78, 0.12, 1.84, 4, '#4b5560');
    for (const [x, y] of [[0.0, 0.0], [2.78, 0.0], [0.0, 1.78], [2.78, 1.78]]) this.box(x, y, 70, 0.22, 0.22, 10, '#c0392b');
    // manequim com marcadores
    const [px, py] = this.P(1.5, 1.0, 4); const c = this.ctx;
    c.fillStyle = '#dfe6ee'; c.beginPath(); c.roundRect(px - 7, py - 38, 14, 24, 5); c.fill(); c.beginPath(); c.arc(px, py - 46, 7, 0, 7); c.fill();
    c.fillRect(px - 6, py - 14, 5, 14); c.fillRect(px + 1, py - 14, 5, 14);
    c.fillStyle = '#f5c242'; for (const [dx, dy] of [[-6, -36], [6, -36], [0, -26], [-5, -10], [5, -10], [0, -46]]) { c.beginPath(); c.arc(px + dx, py + dy, 2.2, 0, 7); c.fill(); }
  }
  f_meeting() {
    for (const [x, y] of [[0.3, 0.0], [1.5, 0.0], [2.2, 0.0], [0.3, 1.55], [1.5, 1.55], [2.2, 1.55]]) { this.box(x, y, 0, 0.4, 0.4, 14, '#2f3640'); this.box(x, y + (y < 1 ? 0 : 0.28), 14, 0.4, 0.12, 16, '#3a424d'); }
    this.box(0.25, 0.4, 0, 0.1, 0.1, 22, '#6b4a2e'); this.box(2.6, 0.4, 0, 0.1, 0.1, 22, '#6b4a2e'); this.box(0.25, 1.45, 0, 0.1, 0.1, 22, '#6b4a2e'); this.box(2.6, 1.45, 0, 0.1, 0.1, 22, '#6b4a2e');
    this.box(0.1, 0.35, 22, 2.8, 1.25, 4, '#c58f5a');
    this.box(0.6, 0.7, 26, 0.5, 0.35, 2, '#cfd3d6'); this.box(1.5, 0.9, 26, 0.45, 0.3, 1.5, '#f4f1e8'); this.box(2.1, 0.7, 26, 0.3, 0.3, 5, '#1a1d22');
  }
  f_coffee() {
    this.box(0, 0, 0, 2, 0.8, 28, '#8a6a4a'); this.box(-0.03, -0.03, 28, 2.06, 0.86, 3, '#e9eef2');
    this.box(0.2, 0.15, 31, 0.5, 0.5, 24, '#2b3038'); this.face([[0.28, 0.65, 38], [0.62, 0.65, 38], [0.62, 0.65, 44], [0.28, 0.65, 44]], '#ff6a4d');
    this.box(0.35, 0.65, 31, 0.14, 0.14, 4, '#f4f1e8');
    this.box(1.1, 0.15, 31, 0.2, 0.2, 6, '#fff'); this.box(1.4, 0.3, 31, 0.2, 0.2, 6, '#f5c242');
    this.box(1.55, 0.1, 0, 0.4, 0.4, 36, '#e9eef2');
  }
  f_cooler() { this.box(0.2, 0.2, 0, 0.55, 0.55, 30, '#e9eef2'); this.box(0.25, 0.25, 30, 0.45, 0.45, 18, '#7fc4f0'); this.box(0.35, 0.75, 14, 0.12, 0.01, 4, '#3b82c4'); }
  f_vending() {
    this.box(0.1, 0.1, 0, 0.8, 0.8, 58, '#c0392b');
    this.face([[0.1, 0.9, 10], [0.9, 0.9, 10], [0.9, 0.9, 52], [0.1, 0.9, 52]], '#2c3e50');
    for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) this.face([[0.2 + q * 0.22, 0.91, 16 + r * 12], [0.36 + q * 0.22, 0.91, 16 + r * 12], [0.36 + q * 0.22, 0.91, 24 + r * 12], [0.2 + q * 0.22, 0.91, 24 + r * 12]], ['#f1c40f', '#e67e22', '#1abc9c'][(r + q) % 3]);
  }
  f_toilet() {
    this.face([[0, 0, 0.5], [2, 0, 0.5], [2, 2, 0.5], [0, 2, 0.5]], '#cfdbe3');
    this.box(0, 0, 0, 0.1, 2, 62, '#d9dde3'); this.box(0, 0, 0, 2, 0.1, 62, '#cfd3d9');
    this.box(0, 1.9, 0, 0.1, 0.1, 62, '#b9bfc7');
    this.box(0.7, 0.2, 0, 0.6, 0.75, 16, '#f4f6f8'); this.box(0.7, 0.12, 16, 0.6, 0.25, 14, '#eef1f4'); this.box(0.75, 0.4, 16, 0.5, 0.5, 2, '#dde3ea');
    this.box(1.5, 0.15, 0, 0.35, 0.7, 26, '#e9eef2'); this.box(1.55, 0.2, 26, 0.25, 0.4, 4, '#9fd3ee');
    this.box(0.15, 1.2, 0, 0.12, 0.6, 20, '#cfd3d9');
  }
  f_stairs() { // 2x1: degraus subindo ao longo de x, com corrimão
    for (let i = 0; i < 6; i++) this.box(i * 0.3, 0.05, 0, 0.3, 0.9, 6 + i * 7, i % 2 ? '#c9a26b' : '#bf9760');
    this.box(0, 0, 0, 1.9, 0.06, 40, '#6b7685'); this.box(0, 0.94, 0, 1.9, 0.06, 40, '#6b7685');
  }
  f_elevator() { // 1x1: cabine metálica com porta
    this.box(0.06, 0.06, 0, 0.88, 0.88, 84, '#aab4bf');
    this.face([[0.18, 0.94, 0], [0.82, 0.94, 0], [0.82, 0.94, 70], [0.18, 0.94, 70]], '#6b7a88');
    this.face([[0.5, 0.94, 0], [0.5, 0.94, 70]], null, '#2f3b52');
    this.face([[0.3, 0.94, 74], [0.7, 0.94, 74], [0.7, 0.94, 82], [0.3, 0.94, 82]], '#2f3b52');
  }
  f_sofa() {
    this.box(0, 0, 0, 2, 0.45, 24, '#3f7fc4'); this.box(0.2, 0.45, 0, 1.6, 0.55, 14, '#4f8fd6');
    this.box(0, 0.0, 0, 0.2, 1.0, 20, '#356db0'); this.box(1.8, 0.0, 0, 0.2, 1.0, 20, '#356db0'); this.box(0.95, 0.5, 14, 0.04, 0.4, 1, '#3a6fb0');
  }
  f_puff(w, d, o) { const c = PUFF_COLORS[(o.v || 0) % 4]; this.box(0.15, 0.15, 0, 0.7, 0.7, 12, c); this.box(0.2, 0.2, 12, 0.6, 0.6, 3, shade(c, 0.2)); }
  f_tv() {
    this.box(0.05, 0.1, 0, 1.9, 0.6, 14, '#5b4636'); this.box(0.45, 0.2, 14, 1.1, 0.3, 40, '#1d2026');
    this.box(0.1, 0.25, 14, 0.2, 0.2, 3, '#3ddc84'); this.box(1.7, 0.25, 14, 0.2, 0.2, 3, '#e8523c');
  }
  tvLive() {
    this.face([[0.5, 0.5, 18], [1.5, 0.5, 18], [1.5, 0.5, 48], [0.5, 0.5, 48]], `hsl(${(this.t * 60) % 360},70%,50%)`);
  }
  f_plant() { this.plantAt(0.5, 0.5); }
  plantAt(px, py) {
    const c = this.ctx; this.box(px - 0.25, py - 0.25, 0, 0.5, 0.5, 14, '#b8683a');
    const [x, y] = this.P(px, py, 14); const t = Math.sin(this.t * 1.5 + px * 3 + py) * 1.2;
    c.fillStyle = '#2f9a4d'; for (const [dx, dy, r] of [[-8, -14, 9], [8, -16, 9], [0, -26, 10], [-3, -8, 8], [6, -6, 7]]) { c.beginPath(); c.arc(x + dx + t, y + dy, r, 0, 7); c.fill(); }
    c.fillStyle = '#44bb66'; c.beginPath(); c.arc(x + t, y - 22, 6, 0, 7); c.fill();
  }
  f_bin(w, d, o) { this.box(0.25, 0.25, 0, 0.5, 0.5, 20, '#3f7fc4'); this.box(0.28, 0.28, 20, 0.44, 0.44, 2, shade('#3f7fc4', -0.3)); }
  f_rug(w, d, o) {
    const col = RUG_COLORS[(o.v || 0) % 4];
    this.face([[0.1, 0.1, 0.3], [w - 0.1, 0.1, 0.3], [w - 0.1, d - 0.1, 0.3], [0.1, d - 0.1, 0.3]], col, 'rgba(0,0,0,.2)');
    this.face([[0.35, 0.35, 0.4], [w - 0.35, 0.35, 0.4], [w - 0.35, d - 0.35, 0.4], [0.35, d - 0.35, 0.4]], shade(col, 0.18));
  }
  f_car(L, d) {
    const x = 0, y = 0; const c2 = this.ctx; const tc = '#3a73c0';
    for (const wx of [x + 0.35, x + L - 1.15]) this.box(wx, y + d - 0.14, 0, 0.8, 0.18, 15, '#1b1e22');
    for (const wx of [x + 0.35, x + L - 1.15]) this.box(wx + 0.25, y + d + 0.02, 4, 0.3, 0.02, 7, '#8b929a');
    this.box(x + L - 0.16, y + 0.05, 4, 0.16, d - 0.1, 9, '#d3d9de');
    for (const fy of [y + 0.12, y + d - 0.55]) this.box(x + L - 0.16, fy, 14, 0.14, 0.43, 7, '#fff3b0');
    this.box(x, y, 12, L - 0.14, d - 0.06, 12, tc);
    this.box(x + 0.5, y + 0.14, 24, L - 1.5, d - 0.34, 13, shade(tc, 0.07));
    c2.save(); c2.lineWidth = 1.5; c2.strokeStyle = 'rgba(15,40,100,.5)';
    for (let i = 1; i < 6; i++) { const u = x + ((L - 0.14) * i) / 6; c2.beginPath(); c2.moveTo(...this.P(u, y + d - 0.06, 12)); c2.lineTo(...this.P(u + 0.06, y + d - 0.06, 22)); c2.stroke(); }
    c2.restore();
    const [px, py] = this.P(x + 0.9, y + d * 0.5, 40);
    c2.fillStyle = '#1f2227'; c2.beginPath(); c2.ellipse(px, py, 15, 7.5, 0, 0, 7); c2.fill();
    c2.fillStyle = '#454a51'; c2.beginPath(); c2.ellipse(px, py - 1.5, 9, 4.3, 0, 0, 7); c2.fill();
    c2.fillStyle = '#7a8088'; c2.beginPath(); c2.ellipse(px, py - 1.5, 3.2, 1.6, 0, 0, 7); c2.fill();
  }
  /** Cadeira de escritório vazia no ponto (fx, fy) da tela. */
  emptyChair(fx, fy) {
    const c = this.ctx; c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(fx, fy + 1, 12, 5.5, 0, 0, 7); c.fill();
    c.fillStyle = '#1f2227'; c.fillRect(fx - 1.5, fy - 12, 3, 10);
    for (const dx of [-11, 0, 11]) { c.beginPath(); c.arc(fx + dx, fy - 1, 2.2, 0, 7); c.fill(); }
    c.fillRect(fx - 12, fy - 3.5, 24, 2.5);
    c.beginPath(); c.roundRect(fx - 12, fy - 18, 24, 8, 4); c.fillStyle = '#2d3238'; c.fill();
    c.beginPath(); c.roundRect(fx - 10, fy - 38, 20, 20, 7); c.fill();
  }
  // ---------- camadas vivas dos móveis (v0.7.1): luzes, vapor, bolhas, marcadores ----------
  /** Desenha a camada animada de um móvel nas coordenadas locais (mesma transformação do sprite em cache). */
  liveFurn(k, id, working) {
    const f = this['live_' + k]; if (f) f.call(this, id, working);
  }
  led(x, y, z, col, on = true, r = 1.3) {
    const c = this.ctx; const [px, py] = this.P(x, y, z); if (!on) return;
    c.fillStyle = col; c.beginPath(); c.arc(px, py, r, 0, 7); c.fill();
    if (!this.lowFx) { c.globalAlpha = 0.28; c.beginPath(); c.arc(px, py, r * 2.6, 0, 7); c.fill(); c.globalAlpha = 1; }
  }
  live_server(id, working) {
    const t = this.t;
    for (let r = 0; r < 6; r++) {
      const z = 6 + r * 10, ph = Math.sin(t * (working ? 9 : 3) + r * 2.1 + id);
      this.face([[0.7, 0.9, z + 2], [0.78, 0.9, z + 2], [0.78, 0.9, z + 5], [0.7, 0.9, z + 5]], r % 3 === 1 ? (ph > -0.2 ? '#ff8a3d' : '#7a4520') : (ph > -0.6 ? '#3ddc84' : '#1c5a38'));
      this.led(0.25, 0.9, z + 3.5, ph > 0.3 ? '#5fd0f0' : '#2a5a6a', true, 0.9);
      if (working) { const w = (0.2 + ((Math.floor(t * 4) + r * 3) % 5) * 0.06); this.face([[0.3, 0.9, z + 1.2], [0.3 + w, 0.9, z + 1.2], [0.3 + w, 0.9, z + 2.2], [0.3, 0.9, z + 2.2]], '#5fd0f0'); }
    }
  }
  live_coffee(id, working) {
    const c = this.ctx, t = this.t; const [x, y] = this.P(0.45, 0.65, 46);
    this.face([[0.28, 0.65, 38], [0.62, 0.65, 38], [0.62, 0.65, 44], [0.28, 0.65, 44]], Math.sin(t * 2 + id) > 0 ? '#ff6a4d' : '#c04a35');
    if (this.lowFx) return;
    c.fillStyle = 'rgba(255,255,255,.7)';
    for (let i = 0; i < 3; i++) { const k = (t * 0.6 + i / 3) % 1; c.globalAlpha = (1 - k) * 0.7; c.beginPath(); c.arc(x + Math.sin(k * 7 + i * 2) * 3, y - k * 16, 1.6 + k * 2.2, 0, 7); c.fill(); }
    c.globalAlpha = 1;
  }
  live_cooler(id) {
    const c = this.ctx, t = this.t; if (this.lowFx) return; c.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 2; i++) { const k = (t * 0.5 + i * 0.5 + id * 0.1) % 1; const [x, y] = this.P(0.5 + Math.sin(k * 9) * 0.05, 0.5, 32 + k * 14); c.globalAlpha = 1 - k * k; c.beginPath(); c.arc(x, y, 1.4, 0, 7); c.fill(); } c.globalAlpha = 1;
  }
  live_vending(id) {
    const t = this.t; const n = Math.floor(t * 1.5 + id) % 9;
    for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) if (r * 3 + q === n) this.face([[0.2 + q * 0.22, 0.91, 16 + r * 12], [0.36 + q * 0.22, 0.91, 16 + r * 12], [0.36 + q * 0.22, 0.91, 24 + r * 12], [0.2 + q * 0.22, 0.91, 24 + r * 12]], 'rgba(255,255,255,.35)');
    this.led(0.82, 0.92, 54, Math.sin(t * 3) > 0 ? '#3ddc84' : '#e8523c', true, 1.2);
  }
  live_audio(id, working) {
    const t = this.t;
    this.led(1.45, 0.2, 80.5, '#ff3b30', Math.sin(t * 3) > -0.2 || !working, 2);
    for (let i = 0; i < 5; i++) { const lvl = working ? 0.25 + 0.75 * Math.abs(Math.sin(t * (4 + i) + i)) : 0.12 + 0.1 * Math.sin(t + i); this.face([[1.95, 0.2 + i * 0.36 + 0.06, 8], [1.95, 0.5 + i * 0.36 - 0.06, 8], [1.95, 0.5 + i * 0.36 - 0.06, 8 + 52 * lvl], [1.95, 0.2 + i * 0.36 + 0.06, 8 + 52 * lvl]], lvl > 0.75 ? '#e8523c' : lvl > 0.5 ? '#f0b429' : '#3ddc84'); }
  }
  live_mocap(id, working) {
    const t = this.t; const [px, py] = this.P(1.5, 1.0, 4); const c = this.ctx;
    for (const [dx, dy] of [[-6, -36], [6, -36], [0, -26], [-5, -10], [5, -10], [0, -46]]) { const p = 0.5 + 0.5 * Math.sin(t * 5 + dx + dy); c.fillStyle = `rgba(255,120,60,${0.35 + 0.65 * (working ? p : 0.3)})`; c.beginPath(); c.arc(px + dx, py + dy, 1.6 + (working ? p : 0), 0, 7); c.fill(); }
    for (const [x, y] of [[0.11, 0.11], [2.89, 0.11], [0.11, 1.89], [2.89, 1.89]]) this.led(x, y, 80, Math.sin(t * 4 + x) > 0 ? '#ff3b30' : '#6a1a14', true, 1.5);
  }
  live_qa(id, working) {
    const t = this.t; for (let r = 0; r < 4; r++) { const w = 0.08 + ((Math.floor(t * 3 + r * 2 + id) % 4) * 0.07); this.face([[0.24, 0.55, 27 + r * 2], [0.24 + w, 0.55, 27 + r * 2], [0.24 + w, 0.55, 28.4 + r * 2], [0.24, 0.55, 28.4 + r * 2]], '#0f5132'); }
  }
  live_shelf(id) {
    const t = this.t; if (this.lowFx) return; const z = 8 + 3 * 19 + 14; this.led(1.8, 0.5, z, Math.sin(t * 1.2 + id) > 0.7 ? '#ffd25a' : null, Math.sin(t * 1.2 + id) > 0.7, 1.2);
  }
  live_sofa() {}
  // ---------- piso e parede ----------
  floorTile(x, y, fill, stroke = 'rgba(0,0,0,.05)') { this.face([[x, y, 0], [x + 1, y, 0], [x + 1, y + 1, 0], [x, y + 1, 0]], fill, stroke); }
}
