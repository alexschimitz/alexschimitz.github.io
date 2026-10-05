// Histórico do estúdio (v0.7): séries para gráficos, linha do tempo/hall da fama por ano e legado entre partidas. Sem DOM.
import { yearOf } from './util.js';

export function ensureLegacy(s) { s.series ??= []; s.hall ??= []; return s; }
/** A cada 4 semanas guarda um ponto para os gráficos (máx. 160 pontos; ao estourar, descarta metade dos antigos). */
export function recordSeries(s) {
  ensureLegacy(s); if (s.week % 4 !== 0) return;
  const last = s.series[s.series.length - 1]; if (last && last.w === s.week) return;
  s.series.push({ w: s.week, m: Math.round(s.money), f: Math.round(s.fans), r: Math.round(s.stats.revenue), e: s.employees.length, g: s.games.length });
  if (s.series.length > 160) s.series = s.series.filter((_, i) => i % 2 === 0 || i > s.series.length - 40);
}
export function recordYear(s, y, wins, rank) {
  ensureLegacy(s);
  const gs = s.games.filter((g) => yearOf(g.releaseWeek) === y);
  const best = gs.slice().sort((a, b) => b.score - a.score)[0] || null;
  const revYear = gs.reduce((a, g) => a + (g.gross || 0), 0);
  const mine = (wins || []).filter((w) => w.player).map((w) => w.nome);
  const e = { y, rank, games: gs.length, best: best ? { nome: best.name, score: best.score } : null, revenue: Math.round(revYear), awards: mine, fans: Math.round(s.fans), money: Math.round(s.money), team: s.employees.length };
  s.hall = s.hall.filter((x) => x.y !== y); s.hall.push(e); if (s.hall.length > 40) s.hall.shift();
  return e;
}
/** Resumo para a tela de estatísticas. */
export function summary(s) {
  const byGenre = {}; for (const g of s.games) { const o = (byGenre[g.genre] ||= { n: 0, gross: 0, sc: 0 }); o.n++; o.gross += g.gross || 0; o.sc += g.score; }
  const genres = Object.entries(byGenre).map(([id, o]) => ({ id, n: o.n, gross: o.gross, avg: o.sc / o.n })).sort((a, b) => b.gross - a.gross);
  const top = s.games.slice().sort((a, b) => (b.gross || 0) - (a.gross || 0)).slice(0, 5);
  return { genres, top, scores: s.games.map((g) => ({ nome: g.name, score: g.score, y: yearOf(g.releaseWeek) })), units: s.stats.units, revenue: s.stats.revenue, avgScore: s.games.length ? s.games.reduce((a, g) => a + g.score, 0) / s.games.length : 0 };
}
/** Pontos de uma série como polilinha dentro de (w,h). */
export function polyline(series, key, w, h, pad = 4) {
  if (!series.length) return '';
  const xs = series.map((p) => p.w), ys = series.map((p) => p[key]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs, x0 + 1), y0 = Math.min(0, ...ys), y1 = Math.max(...ys, y0 + 1);
  return series.map((p) => `${(pad + (p.w - x0) / (x1 - x0) * (w - 2 * pad)).toFixed(1)},${(h - pad - (p[key] - y0) / (y1 - y0) * (h - 2 * pad)).toFixed(1)}`).join(' ');
}
