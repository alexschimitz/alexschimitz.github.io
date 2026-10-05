// Fórmulas puras de qualidade/nota/vendas. Sem estado global, fáceis de testar.
import { CATEGORIES, catsOfPhase, GENRE_WEIGHTS, GENRE_DESIGN_BIAS, RATING_VAL, themeGenreVal, themeAudVal, SIZES, PLAT_BY_ID, platformMarket, EXTRAS, CRITICS, REVIEW_PHRASES, THEME_BY_ID, GENRES } from './data.js';
import { clamp, gauss, rnd, pick } from './util.js';

export const inflation = (year) => 1 + 0.06 * (year - 1);

/** Pesos ideais (9 categorias) do gênero, misturando o subgênero (65/35). */
export function idealWeights(genre, sub) {
  const g = GENRE_WEIGHTS[genre];
  if (!sub) return g.slice();
  const s = GENRE_WEIGHTS[sub];
  return g.map((v, i) => v * 0.65 + s[i] * 0.35);
}
/** Ideal normalizado dentro da fase: {catId: share} somando 1. */
export function idealShares(genre, sub, phase) {
  const w = idealWeights(genre, sub);
  const cats = catsOfPhase(phase);
  const ws = cats.map((c) => w[CATEGORIES.findIndex((x) => x.id === c.id)]);
  const sum = ws.reduce((a, b) => a + b, 0);
  return Object.fromEntries(cats.map((c, i) => [c.id, ws[i] / sum]));
}
export function actualShares(focus, phase) {
  const cats = catsOfPhase(phase);
  const vals = cats.map((c) => Math.max(0, focus[c.id] ?? 0));
  const sum = vals.reduce((a, b) => a + b, 0);
  return Object.fromEntries(cats.map((c, i) => [c.id, sum > 0 ? vals[i] / sum : 1 / cats.length]));
}
/** Adequação (0..1) do foco escolhido ao ideal do gênero numa fase. */
export function phaseFit(genre, sub, phase, focus) {
  const ideal = idealShares(genre, sub, phase);
  const act = actualShares(focus, phase);
  let diff = 0;
  for (const k of Object.keys(ideal)) diff += Math.abs(ideal[k] - act[k]);
  return clamp(1 - diff, 0, 1);
}

/** Compatibilidade combinada 0..1 (tema x gênero(s) e tema x público). */
export function compatibility(themeId, genre, sub, aud) {
  let gv = themeGenreVal(themeId, genre);
  if (sub) gv = gv * 0.65 + themeGenreVal(themeId, sub) * 0.35;
  const av = themeAudVal(themeId, aud);
  const cg = (gv + 3) / 6, ca = (av + 3) / 6;
  return clamp(0.7 * cg + 0.3 * ca, 0, 1);
}

export const expectedTier = (year) => 1 + (year - 1) / 3.2;
export function techTier(engineLvl, gfxLvl, platform) {
  const base = (engineLvl + gfxLvl) / 2;
  return Math.min(base, platform.tier + 0.5);
}

export function bugDensity(p) { return p.bugs / (p.total * 0.04); }

/**
 * Avalia o projeto. ctx: {year, engineLvl, gfxLvl, sndLvl, catLevels, last}
 * Retorna {score (1..10 float), raw, parts}
 */
export function evaluate(p, ctx) {
  const plat = PLAT_BY_ID[p.platform];
  const fits = p.phaseFit.length ? p.phaseFit : [0.5];
  const fit = fits.reduce((a, b) => a + b, 0) / fits.length;
  const comp = compatibility(p.theme, p.genre, p.sub, p.audience);
  const dr = clamp(p.d / p.dTarget, 0, 1);
  const tr = clamp(p.t / p.tTarget, 0, 1);
  const tier = techTier(p.engineLvl, ctx.gfxLvl, plat);
  const techFactor = clamp(0.6 + 0.2 * (tier - expectedTier(ctx.year)), 0, 1);
  const w = idealWeights(p.genre, p.sub);
  const avg = w.reduce((a, b) => a + b, 0) / w.length;
  const wg = w[7] / avg, ws = w[8] / avg;
  const artFactor = clamp(p.art / (p.total * 0.14 * wg), 0, 1);
  const sndRaw = clamp(p.snd / (p.total * 0.10 * ws), 0, 1);
  const sndFactor = clamp(0.7 * sndRaw + 0.3 * clamp((ctx.sndLvl - 0.4 * expectedTier(ctx.year)) / 2 + 0.5, 0, 1), 0, 1);
  const artSound = (artFactor * wg + sndFactor * ws) / (wg + ws);
  const extrasQ = clamp(p.extras.reduce((a, id) => a + EXTRAS.find((e) => e.id === id).q, 0) / 0.14, 0, 1);
  const effTotal = Object.values(p.effort).reduce((a, b) => a + b, 0) || 1;
  let catBonus = 0;
  for (const c of CATEGORIES) catBonus += ((p.effort[c.id] || 0) / effTotal) * (ctx.catLevels[c.id] || 0);
  catBonus = clamp(catBonus * 0.004, 0, 0.04);
  const raw0 = 0.30 * fit + 0.17 * comp + 0.15 * dr + 0.13 * tr + 0.12 * techFactor + 0.08 * artSound + 0.05 * extrasQ + catBonus;
  const raw = Math.pow(clamp(raw0, 0, 1), 1.35);
  let bugPen = clamp(bugDensity(p) * 0.9, 0, 2.5);
  let repeatPen = 0;
  if (ctx.last) {
    if (ctx.last.theme === p.theme && ctx.last.genre === p.genre) repeatPen = 1.2;
    else if (ctx.last.theme === p.theme || ctx.last.genre === p.genre && ctx.last.sub === p.sub) repeatPen = 0.35;
  }
  const score = clamp(1 + 9 * raw - bugPen - repeatPen, 1, 10);
  return { score, raw, parts: { fit, comp, dr, tr, techFactor, artFactor, sndFactor, extrasQ, catBonus, bugPen, repeatPen, tier } };
}

export function phraseFor(score, s) {
  for (const [lim, arr] of REVIEW_PHRASES) if (score < lim) return pick(s, arr);
  return pick(s, REVIEW_PHRASES[REVIEW_PHRASES.length - 1][1]);
}
/** Notas dos 4 críticos (1..10, meios-pontos). */
export function critics(score, p, s) {
  return CRITICS.map((c) => {
    let v = score + c.vies + gauss(s) * 0.45;
    if (c.gosta.includes(p.genre)) v += 0.3;
    if (c.id === 'cinza' && p.parts.fit < 0.6) v -= 0.4;
    if (c.id === 'gameplay') v += (p.parts.techFactor - 0.55) * 0.9;
    if (c.id === 'pipoca' && p.parts.bugPen > 1) v -= 0.3;
    v = clamp(Math.round(v * 2) / 2, 1, 10);
    return { id: c.id, nome: c.nome, nota: v, frase: phraseFor(v, s) };
  });
}

export const qualityShare = (score) => Math.pow(clamp((score - 1) / 9, 0, 1), 2.4);

const PRICE_PLAT = { PC: 1.0, Console: 1.2, 'Portátil': 0.8, Celular: 0.35 };
export function gamePrice(p, year) {
  const plat = PLAT_BY_ID[p.platform];
  return SIZES[p.size].preco * inflation(year) * PRICE_PLAT[plat.tipo];
}
/** Total de unidades potenciais de um jogo lançado. */
export function potentialUnits({ score, plat, year, size, hype, fans, genre, sub, releaseCrowd, tier }) {
  const M = platformMarket(plat, year);
  let afin = plat.afin[genre] || 1;
  if (sub) afin = afin * 0.7 + (plat.afin[sub] || 1) * 0.3;
  const q = qualityShare(score);
  const fanMult = 1 + Math.min(0.8, fans / (0.2 * M + 1));
  const crowd = Math.pow(0.8, releaseCrowd || 0);
  const sz = size === 'pequeno' ? Math.max(0.15, 1 - 0.07 * (year - 1)) : size === 'medio' ? Math.max(0.4, 1 - 0.035 * (year - 1)) : 1;
  const era = clamp(1 - 0.14 * (expectedTier(year) - (tier ?? 1)), 0.15, 1.1);
  const U = M * SIZES[size].mercado * sz * era * (0.04 + 0.96 * q) * (1 + hype / 60) * fanMult * afin * crowd;
  return U;
}
export const decayRate = (score) => 0.52 + 0.04 * score;
export function weeklySales(g) { return Math.round(g.U * (1 - g.r) * Math.pow(g.r, g.weeks)); }
