// Utilitários puros (sem DOM): RNG determinístico, tempo do calendário, formatação.
export const GAME_VERSION = '0.7.1';
export const WEEKS_PER_MONTH = 4;
export const MONTHS_PER_YEAR = 12;
export const WEEKS_PER_YEAR = 48;

/** Sorteia um número [0,1) usando o estado da simulação (mulberry32), mantendo reprodutibilidade. */
export function rnd(s) {
  s.rs = (s.rs + 0x6D2B79F5) >>> 0;
  let t = s.rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const rint = (s, a, b) => a + Math.floor(rnd(s) * (b - a + 1));
export const pick = (s, arr) => arr[Math.floor(rnd(s) * arr.length)];
export const chance = (s, p) => rnd(s) < p;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function gauss(s) { // ~N(0,1) aproximada
  return (rnd(s) + rnd(s) + rnd(s) + rnd(s) - 2) * 1.7320508;
}
export function shuffle(s, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Semana absoluta (0..) -> {y,m,w} com y>=1, m 1..12, w 1..4 */
export function dateOf(week) {
  const y = Math.floor(week / WEEKS_PER_YEAR) + 1;
  const r = week % WEEKS_PER_YEAR;
  return { y, m: Math.floor(r / WEEKS_PER_MONTH) + 1, w: (r % WEEKS_PER_MONTH) + 1 };
}
export const yearOf = (week) => dateOf(week).y;
export const dateStr = (week) => { const d = dateOf(week); return `A${d.y} M${d.m} S${d.w}`; };

const brl = new Intl.NumberFormat('pt-BR');
export function money(v) {
  const neg = v < 0; v = Math.abs(Math.round(v));
  return (neg ? '-' : '') + 'R$ ' + brl.format(v);
}
/** Forma curta: 40K, 1,2M */
export function moneyShort(v) {
  const neg = v < 0 ? '-' : ''; const a = Math.abs(v);
  if (a >= 1e9) return neg + (a / 1e9).toFixed(1).replace('.', ',') + 'B';
  if (a >= 1e6) return neg + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',') + 'M';
  if (a >= 1e4) return neg + Math.round(a / 1e3) + 'K';
  if (a >= 1e3) return neg + (a / 1e3).toFixed(1).replace('.', ',') + 'K';
  return neg + Math.round(a);
}
export const num = (v) => brl.format(Math.round(v));
export function numShort(v) {
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace('.', ',') + 'M';
  if (v >= 1e4) return Math.round(v / 1e3) + 'K';
  if (v >= 1e3) return (v / 1e3).toFixed(1).replace('.', ',') + 'K';
  return String(Math.round(v));
}
export const deep = (o) => JSON.parse(JSON.stringify(o));

/** Clima da semana: determinístico. Visual na cidade e com efeito leve na produção/vendas (v0.7). */
export const WEATHER = { sol: { nome: 'Ensolarado', ico: '☀️' }, nuvens: { nome: 'Nublado', ico: '⛅' }, chuva: { nome: 'Chuva', ico: '🌧️' }, neblina: { nome: 'Neblina', ico: '🌫️' } };
export function weatherOf(week) {
  let h = (Math.floor(week) * 2654435761 + 12345) >>> 0; h = ((h ^ (h >>> 15)) * 2246822519) >>> 0; h = (h ^ (h >>> 13)) >>> 0; const r = (h % 1000) / 1000;
  return r < 0.52 ? 'sol' : r < 0.74 ? 'nuvens' : r < 0.93 ? 'chuva' : 'neblina';
}
