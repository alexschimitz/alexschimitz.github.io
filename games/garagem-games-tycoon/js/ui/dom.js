// Utilitários de DOM: criação de elementos, modais empilháveis, toasts, avatares SVG e gráficos.
import { sfx } from '../audio.js';
import { RATING_COLOR, RATING_TXT } from '../data.js';

export const $ = (s, r = document) => r.querySelector(s);
// replaceChildren/append/prepend ignoram null/false (evita o texto "null" na tela)
for (const m of ['replaceChildren', 'append', 'prepend']) {
  const orig = Element.prototype[m];
  Element.prototype[m] = function (...k) { return orig.apply(this, k.flat(Infinity).filter((x) => x != null && x !== false)); };
}
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  const add = (c) => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else el.append(c.nodeType ? c : document.createTextNode(String(c))); };
  kids.forEach(add);
  return el;
}

// ---------- modais ----------
export const modalState = { stack: [], onEmpty: null };
export function modal({ title, color, body, actions = [], closable = true, size = '', onClose, icon }) {
  const root = $('#modals');
  const back = h('div', { class: 'mb' });
  const head = h('div', { class: 'mh', style: color ? { background: color } : null }, icon || null, h('span', {}, title || ''),
    closable ? h('button', { class: 'x', 'aria-label': 'Fechar', onclick: () => api.close() }, '✕') : null);
  const bodyEl = h('div', { class: 'mbody' }, body);
  const foot = h('div', { class: 'mf' });
  const md = h('div', { class: 'md ' + size, role: 'dialog' }, head, bodyEl, foot);
  back.append(md);
  const api = {
    el: md, body: bodyEl, back,
    setBody(n) { bodyEl.replaceChildren(...(Array.isArray(n) ? n : [n])); },
    setActions(acts) {
      foot.hidden = !acts.length;
      foot.replaceChildren(...acts.map((a) => h('button', { class: 'btn ' + (a.cls || ''), disabled: a.disabled, onclick: () => { sfx.click(); a.fn && a.fn(api); } }, a.label)));
    },
    close(force) {
      const i = modalState.stack.indexOf(api); if (i < 0) return;
      modalState.stack.splice(i, 1);
      if (!force && document.documentElement.dataset.motion !== 'off') { back.classList.add('out'); setTimeout(() => back.remove(), 160); } else back.remove();
      sfx.close?.();
      if (onClose) onClose();
      if (!modalState.stack.length && modalState.onEmpty) modalState.onEmpty();
    },
  };
  api.setActions(actions);
  back.addEventListener('mousedown', (e) => { if (e.target === back && closable) api.close(); });
  root.append(back);
  modalState.stack.push(api);
  sfx.open?.();
  return api;
}
export const anyModal = () => modalState.stack.length > 0;
export function closeAllModals() { [...modalState.stack].forEach((m) => m.close()); }

export function toast(txt, cls = '') {
  const t = h('div', { class: 'toast ' + cls }, txt);
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 3700);
  const all = $('#toasts').children; if (all.length > 3) all[0].remove();
}

// ---------- avatar (SVG) ----------
/** Acessórios do avatar (v0.7): 1 óculos, 2 boné, 3 fone de ouvido, 4 barba. */
export function accessorySVG(acc, hair = '#333') {
  if (acc === 1) return '<g fill="none" stroke="#222" stroke-width="1.6"><circle cx="26.5" cy="29" r="4.6"/><circle cx="37.5" cy="29" r="4.6"/><path d="M31 29h2"/></g>';
  if (acc === 2) return '<path d="M16 22c1-8 7-12 16-12s15 4 16 12z" fill="#2f3b52"/><path d="M30 22h24c0 3-8 4-24 3z" fill="#1f2a3d"/>';
  if (acc === 3) return '<path d="M16 30c-1-12 6-18 16-18s17 6 16 18" fill="none" stroke="#222" stroke-width="2.4"/><rect x="12" y="27" width="6" height="11" rx="3" fill="#e8523c"/><rect x="46" y="27" width="6" height="11" rx="3" fill="#e8523c"/>';
  if (acc === 4) return `<path d="M19 33c2 12 8 16 13 16s11-4 13-16c-3 4-6 4-13 4s-10 0-13-4z" fill="${hair}"/>`;
  return '';
}
export function avatarSVG(look = {}, size = 44) {
  const hair = look.hair || '#c8461f', skin = look.skin || '#f3c9a0', shirt = look.shirt || '#e8523c', st = look.style || 0;
  const hairBack = st === 1 ? `<rect x="12" y="14" width="40" height="30" rx="10" fill="${hair}"/>` : '';
  const bun = st === 2 ? `<circle cx="32" cy="9" r="6" fill="${hair}"/>` : '';
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="64" fill="#e3eef6"/>
  ${hairBack}${bun}
  <path d="M8 66c0-14 10-20 24-20s24 6 24 20z" fill="${shirt}"/>
  <rect x="27" y="38" width="10" height="10" fill="${skin}"/>
  <circle cx="32" cy="28" r="14" fill="${skin}"/>
  <path d="M17.5 27c0-10 6-15 14.500-15s14.500 5 14.500 15c-3-5-8-7-14.500-7s-11.500 2-14.500 7z" fill="${hair}"/>
  ${st === 0 ? `<rect x="17" y="25" width="4" height="9" fill="${hair}"/><rect x="43" y="25" width="4" height="9" fill="${hair}"/>` : ''}
  <circle cx="26.500" cy="29" r="1.800" fill="#222"/><circle cx="37.500" cy="29" r="1.800" fill="#222"/>
  <path d="M28 35q4 3 8 0" stroke="#a5452f" stroke-width="1.600" fill="none" stroke-linecap="round"/>
  ${accessorySVG(look.acc | 0, hair)}
  </svg>`;
}
export const avatar = (look, size = 44) => h('div', { class: 'av', style: { width: size + 'px', height: size + 'px' }, html: avatarSVG(look, size) });
/** Avatar com anel de energia. */
export function ringAvatar(e, size = 48) {
  const pct = Math.max(0, Math.min(100, e.energy)) / 100; const r = 22, C = 2 * Math.PI * r;
  const col = pct > 0.6 ? '#3da35d' : pct > 0.3 ? '#f0a030' : '#e8523c';
  const w = h('div', { class: 'ring', style: { width: size + 'px', height: size + 'px' } });
  w.innerHTML = `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="${r}" fill="none" stroke="#e1dac6" stroke-width="4"/><circle cx="24" cy="24" r="${r}" fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${C * pct} ${C}" transform="rotate(-90 24 24)"/></svg>`;
  w.append(avatar(e.look, size - 10));
  return w;
}

export function ratingChip(letter) {
  return h('span', { class: 'chip', style: { background: RATING_COLOR[letter] } }, RATING_TXT[letter]);
}
export const notaColor = (n) => (n >= 9 ? '#2e8a4a' : n >= 7 ? '#5aa83c' : n >= 5 ? '#e0a030' : n >= 3 ? '#e07a30' : '#d04030');

/** Gráfico de barras simples em SVG. */
export function barChart(values, { w = 300, hgt = 100, color = '#2fc4e6', labels = false } = {}) {
  const max = Math.max(1, ...values);
  const bw = w / Math.max(1, values.length);
  const bars = values.map((v, i) => { const bh = (v / max) * (hgt - 14); return `<rect x="${i * bw + 1}" y="${hgt - bh - 2}" width="${Math.max(1, bw - 2)}" height="${bh}" rx="1.500" fill="${color}"/>`; }).join('');
  return `<svg class="chart" viewBox="0 0 ${w} ${hgt}" preserveAspectRatio="none"><line x1="0" y1="${hgt - 1}" x2="${w}" y2="${hgt - 1}" stroke="#d6cfb8"/>${bars}</svg>`;
}
export function pairChart(a, b, { w = 320, hgt = 120 } = {}) {
  const max = Math.max(1, ...a, ...b);
  const n = a.length; const gw = w / Math.max(1, n); let out = '';
  for (let i = 0; i < n; i++) {
    const ha = (a[i] / max) * (hgt - 14), hb = (b[i] / max) * (hgt - 14);
    out += `<rect x="${i * gw + 1}" y="${hgt - ha - 2}" width="${gw / 2 - 1}" height="${ha}" fill="#3da35d"/><rect x="${i * gw + gw / 2}" y="${hgt - hb - 2}" width="${gw / 2 - 1}" height="${hb}" fill="#e8523c"/>`;
  }
  return `<svg class="chart" viewBox="0 0 ${w} ${hgt}" preserveAspectRatio="none"><line x1="0" y1="${hgt - 1}" x2="${w}" y2="${hgt - 1}" stroke="#d6cfb8"/>${out}</svg>`;
}
export function sparkline(values, color = '#2fc4e6') {
  const v = values.slice(-20); if (v.length < 2) return '<svg viewBox="0 0 100 34"></svg>';
  const max = Math.max(1, ...v); const pts = v.map((x, i) => `${(i / (v.length - 1)) * 100},${32 - (x / max) * 30}`).join(' ');
  return `<svg viewBox="0 0 100 34" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.500" stroke-linejoin="round"/></svg>`;
}
export const ICONS = {
  team: '<svg viewBox="0 0 24 24" fill="#2f3b52"><circle cx="8" cy="8" r="3.500"/><circle cx="17" cy="9" r="2.800"/><path d="M1.500 20c0-4 3-6.500 6.500-6.500S14.500 16 14.500 20zM14 20c0-2.500 1-4.500 3-5.300 3 0 5.500 2 5.500 5.300z"/></svg>',
  flask: '<svg viewBox="0 0 24 24" fill="#2f3b52"><path d="M9 2h6v2h-1v5.500l5.500 9.200c.8 1.400-.2 3.300-1.900 3.300H6.400c-1.700 0-2.700-1.900-1.900-3.300L10 9.500V4H9z"/><path d="M8 15h8l2 3.500H6z" fill="#2fc4e6"/></svg>',
  build: '<svg viewBox="0 0 24 24" fill="#2f3b52"><path d="M3 21V9l6-4v16zm7 0V3l11 5v13z"/><path d="M13 11h2v2h-2zm4 0h2v2h-2zm-4 4h2v2h-2zm4 0h2v2h-2z" fill="#f5c242"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="#2f3b52"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2" fill="#e8523c"/></svg>',
  world: '<svg viewBox="0 0 24 24" fill="none" stroke="#2f3b52" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M7 4l13 8-13 8z"/></svg>',
};
