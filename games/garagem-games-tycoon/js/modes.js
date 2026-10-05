// Dificuldade selecionável, cenários/desafios e identidade do estúdio (logo/cores) — v0.7. Lógica pura, sem DOM.
import * as D from './data.js';
import { clamp } from './util.js';

/** Normal = balanceamento original (todos os multiplicadores 1). */
export const DIFFICULTIES = {
  facil: { nome: 'Tranquilo', ico: '🌱', desc: 'Mais caixa inicial, vendas um pouco melhores e custos menores. Para relaxar.', money: 1.35, sales: 1.1, cost: 0.94, score: 0.6 },
  normal: { nome: 'Normal', ico: '⚖️', desc: 'O equilíbrio pensado para o jogo.', money: 1, sales: 1, cost: 1, score: 1 },
  dificil: { nome: 'Difícil', ico: '🔥', desc: 'Menos caixa, vendas mais magras e custos maiores.', money: 0.85, sales: 0.93, cost: 1.06, score: 1.3 },
  brutal: { nome: 'Brutal', ico: '💀', desc: 'Sobreviver já é uma conquista. Pontuação final ×1,7.', money: 0.7, sales: 0.86, cost: 1.12, score: 1.7 },
};
export const diffOf = (s) => DIFFICULTIES[s?.diff] || DIFFICULTIES.normal;
export const salesMult = (s) => diffOf(s).sales * scnSales(s);
export const costMult = (s) => diffOf(s).cost;
export const startMoney = (s, base) => Math.round(base * diffOf(s).money / 50) * 50;
export const scoreMult = (s) => diffOf(s).score;

// ---------------------------------------------------------------- cenários
const MONEY = (c, i) => ({ kind: 'cash', v: c, txt: (m) => `Chegar a R$ ${(m ? i : c).toLocaleString('pt-BR')} em caixa` });
export const SCENARIOS = {
  livre: { nome: 'Jogo livre', ico: '🎮', desc: 'Sem metas: construa o estúdio do seu jeito.', modes: ['classic', 'indie'] },
  zero: { nome: 'Do Zero', ico: '🪙', desc: 'Você começa quase sem dinheiro. Meta: ter R$ 25 mil (indie) ou R$ 160 mil (clássico) em caixa em 3 anos.', modes: ['classic', 'indie'],
    years: 3, goal: { cash: [160000, 25000] }, setup: (s) => { s.money = s.mode === "indie" ? 700 : 9000; } },
  onehit: { nome: 'One-Hit Wonder', ico: '💥', desc: 'Você só pode lançar UM jogo. Meta: nota 8+ e faturar R$ 45 mil (indie) / R$ 600 mil (clássico) com ele, em 5 anos.', modes: ['classic', 'indie'],
    years: 5, goal: { oneHit: [600000, 45000], score: 8 }, maxGames: 1 },
  mobile: { nome: 'Só Mobile', ico: '📱', desc: 'Só o celular (Mobilis Phone) está disponível, mas o mercado é menor (vendas ×0,8). Meta: R$ 350 mil em caixa em 5 anos.', modes: ['classic'],
    years: 5, goal: { cash: [350000, 350000] }, mobileOnly: true, sales: 0.8 },
  solo: { nome: 'Lobo Solitário', ico: '🐺', desc: 'Sem contratações. Meta: 3 jogos com nota 7,5+ em 4 anos.', modes: ['classic', 'indie'],
    years: 4, goal: { games: [3, 7.5] }, noHire: true },
  maratona: { nome: 'Maratona', ico: '⏱️', desc: 'Dois anos para chegar a R$ 220 mil (clássico) ou R$ 14 mil (indie) em caixa.', modes: ['classic', 'indie'],
    years: 2, goal: { cash: [220000, 14000] } },
};
export const SCN_LIST = Object.keys(SCENARIOS);
export const scnOf = (s) => (s?.scn ? SCENARIOS[s.scn.id] : null);
const scnSales = (s) => scnOf(s)?.sales ?? 1;
export function applyScenario(s, id) {
  const sc = SCENARIOS[id]; if (!sc || id === 'livre' || !sc.modes.includes(s.mode)) { s.scn = null; return s; }
  s.scn = { id, start: 0, deadline: sc.years ? sc.years * 48 : null, done: null, failed: null };
  sc.setup?.(s);
  return s;
}
export function goalText(s) {
  const sc = scnOf(s); if (!sc) return null; const g = sc.goal; if (!g) return null;
  const i = s.mode === 'indie' ? 1 : 0;
  if (g.cash) return `Chegar a R$ ${g.cash[i].toLocaleString('pt-BR')} em caixa`;
  if (g.oneHit) return `1 jogo com nota ${g.score}+ e R$ ${g.oneHit[i].toLocaleString('pt-BR')} de faturamento`;
  if (g.games) return `${g.games[0]} jogos com nota ${g.games[1]}+`;
  return null;
}
export function goalProgress(s) {
  const sc = scnOf(s); if (!sc?.goal) return null; const g = sc.goal; const i = s.mode === 'indie' ? 1 : 0;
  if (g.cash) return clamp(s.money / g.cash[i], 0, 1);
  if (g.oneHit) { const x = s.games[0]; return x ? clamp(Math.min(x.gross / g.oneHit[i], x.score / g.score), 0, 1) : 0; }
  if (g.games) return clamp(s.games.filter((q) => q.score >= g.games[1]).length / g.games[0], 0, 1);
  return 0;
}
/** Semanal: marca vitória/derrota (a partida continua depois). */
export function tickScenario(s, evs) {
  const sc = scnOf(s); if (!sc?.goal || !s.scn || s.scn.done != null || s.scn.failed != null) return;
  if (goalProgress(s) >= 1) { s.scn.done = s.week; evs.push({ type: 'scenario', win: true, nome: sc.nome }); return; }
  if (s.scn.deadline != null && s.week >= s.scn.deadline) { s.scn.failed = s.week; evs.push({ type: 'scenario', win: false, nome: sc.nome }); }
}
/** Bloqueios de cenário (retorna texto do motivo ou null). */
export function blockConcept(s, c) {
  const sc = scnOf(s); if (!sc) return null;
  if (sc.maxGames && s.games.length >= sc.maxGames) return 'cenário One-Hit Wonder: você só pode lançar um jogo';
  if (sc.mobileOnly && D.PLAT_BY_ID[c.platform]?.tipo !== 'Celular') return 'cenário Só Mobile: só o celular está disponível';
  return null;
}
export const blockHire = (s) => (scnOf(s)?.noHire ? 'cenário Lobo Solitário: sem contratações' : null);
export const mobileOnly = (s) => !!scnOf(s)?.mobileOnly;

// ---------------------------------------------------------------- identidade (logo/cores)
export const LOGO_NAMES = ['Estrela', 'Raio', 'Coração', 'Gema', 'Coroa', 'Foguete', 'Gato', 'Fantasma', 'Controle', 'Sol', 'Cogumelo', 'Caveira'];
export const BRAND_COLORS = ['#e8523c', '#f0a030', '#e0c23a', '#3da35d', '#2aa6a0', '#3b82c4', '#8a5cc2', '#d6577e', '#2f3b52', '#f4efe2'];
export const BADGES = ['circulo', 'quadrado', 'escudo', 'hex'];
const GLYPH = [
  (f) => `<polygon points="32,10 38,26 55,26 41,36 46,53 32,43 18,53 23,36 9,26 26,26" fill="${f}"/>`,
  (f) => `<polygon points="36,8 17,36 29,36 25,56 47,26 34,26" fill="${f}"/>`,
  (f) => `<path d="M32 54C10 38 10 20 22 16c6-2 10 2 10 6 0-4 4-8 10-6 12 4 12 22-10 38z" fill="${f}"/>`,
  (f) => `<polygon points="20,16 44,16 54,28 32,54 10,28" fill="${f}"/>`,
  (f) => `<polygon points="10,46 12,20 24,32 32,14 40,32 52,20 54,46" fill="${f}"/>`,
  (f) => `<path d="M32 8c10 8 12 20 10 34H22C20 28 22 16 32 8z" fill="${f}"/><polygon points="22,34 12,46 22,44" fill="${f}"/><polygon points="42,34 52,46 42,44" fill="${f}"/>`,
  (f) => `<polygon points="14,12 26,22 38,22 50,12 52,34 44,50 20,50 12,34" fill="${f}"/>`,
  (f) => `<path d="M16 54V28a16 16 0 0132 0v26l-6-5-5 5-5-5-5 5-5-5z" fill="${f}"/>`,
  (f) => `<rect x="10" y="26" width="44" height="22" rx="11" fill="${f}"/><rect x="18" y="14" width="4" height="16" fill="${f}"/>`,
  (f) => `<circle cx="32" cy="32" r="11" fill="${f}"/>` + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<rect x="30" y="8" width="4" height="9" fill="${f}" transform="rotate(${a} 32 32)"/>`).join(''),
  (f) => `<path d="M10 34a22 20 0 0144 0z" fill="${f}"/><rect x="26" y="34" width="12" height="18" rx="3" fill="${f}"/>`,
  (f) => `<path d="M14 30a18 16 0 0136 0c0 6-2 9-6 11v8H20v-8c-4-2-6-5-6-11z" fill="${f}"/>`,
];
const GLYPH_EYES = (bg) => ({ 6: `<circle cx="25" cy="32" r="3" fill="${bg}"/><circle cx="39" cy="32" r="3" fill="${bg}"/>`, 7: `<circle cx="26" cy="30" r="3" fill="${bg}"/><circle cx="38" cy="30" r="3" fill="${bg}"/>`, 11: `<circle cx="25" cy="30" r="4" fill="${bg}"/><circle cx="39" cy="30" r="4" fill="${bg}"/>`, 8: `<circle cx="22" cy="37" r="3" fill="${bg}"/><circle cx="42" cy="37" r="3" fill="${bg}"/>` });
export function defaultBrand(name = '') {
  let h = 7; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { logo: h % GLYPH.length, badge: BADGES[(h >> 3) % 4], c1: BRAND_COLORS[(h >> 5) % 9], c2: '#f4efe2', slogan: '' };
}
export function ensureBrand(s) { s.studio.brand = { ...defaultBrand(s.studio.nome), ...(s.studio.brand || {}) }; return s.studio.brand; }
export function logoSVG(b, size = 48) {
  b = { ...defaultBrand(''), ...(b || {}) };
  const bg = { circulo: `<circle cx="32" cy="32" r="31" fill="${b.c1}"/>`, quadrado: `<rect x="2" y="2" width="60" height="60" rx="10" fill="${b.c1}"/>`, escudo: `<path d="M6 6h52v28c0 14-12 22-26 26C18 56 6 48 6 34z" fill="${b.c1}"/>`, hex: `<polygon points="32,2 58,17 58,47 32,62 6,47 6,17" fill="${b.c1}"/>` }[b.badge] || '';
  const g = (GLYPH[b.logo % GLYPH.length] || GLYPH[0])(b.c2) + (GLYPH_EYES(b.c1)[b.logo % GLYPH.length] || '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="logo do estúdio">${bg}<g transform="translate(6 6) scale(.81)">${g}</g></svg>`;
}
