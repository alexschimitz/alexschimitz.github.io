// Mundo dos games: calendário (feiras, jams, promoções), tendências, lançamentos gigantes, manchetes e fãs.
// Sem DOM. Recebe do sim.js as operações de dinheiro via bind().
import * as D from './data.js';
import * as C from './catalog.js';
import { rnd, rint, pick, chance, clamp, gauss, dateOf, WEEKS_PER_YEAR } from './util.js';
import { makeTitle } from './names.js';
import * as MKT from './market.js';
import * as MD from './modes.js';

let api = { earn() {}, spend() {}, log() {}, infl: () => 1 };
export function bind(a) { api = a; }

export function newWorld() {
  return {
    trend: null, blockbuster: null, headlines: [], fairs: {}, jam: null, jams: [], protos: [], nextTrend: 8, seenSale: null, buzz: 0,
  };
}
export function newFan() {
  return { byGenre: {}, loyalShare: 0.2, toxicShare: 0.03, mood: 60, club: null, requests: [], nextReq: 10, betaMax: 0, done: 0, ignored: 0, id: 1 };
}
export function ensure(s) {
  s.world ??= newWorld();
  s.fan ??= newFan();
  return s;
}

// ---------------------------------------------------------------- manchetes
export function headline(s, txt, tipo = 'mundo') {
  ensure(s);
  s.world.headlines.unshift({ w: s.week, txt, tipo });
  if (s.world.headlines.length > 40) s.world.headlines.pop();
}

// ---------------------------------------------------------------- calendário
const monthOf = (week) => dateOf(week).m;
const weekOfMonth = (week) => dateOf(week).w;
export function currentSale(s) {
  const m = monthOf(s.week), w = weekOfMonth(s.week);
  for (const x of C.STEAN_SALES) {
    if (x.dur < 2) { if (m === x.mes) return x; continue; }
    if (m === x.mes && w >= 3) return x;
    if (m === (x.mes % 12) + 1 && w <= 1) return x;
  }
  return null;
}
export function currentFestival(s) {
  const m = monthOf(s.week), w = weekOfMonth(s.week);
  return C.FESTIVALS.find((f) => f.mes === m && w >= 2) || null;
}
/** Eventos dos próximos `n` meses (inclui o atual): [{tipo, id, nome, mes, emSemanas}] */
export function upcoming(s, n = 4) {
  const out = []; const d = dateOf(s.week);
  for (let k = 0; k < n; k++) {
    const m = ((d.m - 1 + k) % 12) + 1;
    const wk = k === 0 ? 0 : k * 4 - (d.w - 1);
    for (const f of C.FAIRS) if (f.mes === m) out.push({ tipo: 'feira', id: f.id, nome: f.nome, mes: m, em: Math.max(0, wk), desc: f.desc, custo: f.custo });
    for (const j of C.JAMS) if (j.mes === m) out.push({ tipo: 'jam', id: j.id, nome: j.nome, mes: m, em: Math.max(0, wk), desc: `Jam de 48h — tema: ${j.tema}.` });
    for (const x of C.STEAN_SALES) if (x.mes === m) out.push({ tipo: 'promo', id: x.id, nome: x.nome, mes: m, em: Math.max(0, wk), desc: `Descontos de ~${Math.round(x.desc * 100)}% e muito movimento.` });
    for (const f of C.FESTIVALS) if (f.mes === m) out.push({ tipo: 'festival', id: f.id, nome: f.nome, mes: m, em: Math.max(0, wk), desc: 'Festival de demos: quem tem demo ganha wishlists.' });
  }
  return out.sort((a, b) => a.em - b.em);
}
const fairKey = (s, id) => id + ':' + dateOf(s.week).y;
export function fairOpen(s, id) {
  const f = C.FAIRS.find((x) => x.id === id);
  return !!f && f.mes === monthOf(s.week) && f.tipo !== 'premio' && !s.world.fairs[fairKey(s, id)];
}
export function fairCost(s, f) { return Math.round(f.custo * (0.7 + 0.3 * api.infl(s)) / 50) * 50; }
export function attendFair(s, id) {
  ensure(s);
  const f = C.FAIRS.find((x) => x.id === id);
  if (!f || !fairOpen(s, id)) return 'indisponível';
  const c = fairCost(s, f);
  if (s.money < c) return 'sem dinheiro';
  if (c) api.spend(s, 'eventos', c);
  s.world.fairs[fairKey(s, id)] = s.week;
  const tier = { conf: 0.6, feira: 1, show: 0.8 }[f.tipo] || 0.7;
  const p = s.project;
  const quality = p ? clamp((p.d + p.t) / p.total, 0, 1) : (s.games.length ? 0.6 : 0.2);
  const reach = Math.round((30 + s.fans * 0.03) * tier * (0.6 + quality));
  s.fans += reach; attribFans(s, p?.genre || lastGenre(s), reach);
  if (p) p.hype = clamp(p.hype + Math.round(5 * tier * (0.5 + quality)), 0, 100);
  s.world.buzz = clamp(s.world.buzz + 4 * tier, 0, 30);
  const rr = rnd(s);
  let extra = '';
  if (rr < 0.12 * tier && s.games.length) { api.earn(s, 1500 * api.infl(s)); extra = ' Um contato de publisher deixou um cheque de patrocínio.'; }
  else if (rr < 0.30) extra = ' Você trocou cartões com vários devs e jornalistas.';
  api.log(s, `${f.nome}: +${reach} fãs.${extra}`, 'bom');
  headline(s, `${s.studio.nome} chamou atenção na ${f.nome}.`, 'estudio');
  return { msg: `+${reach} fãs na ${f.nome}.${extra}`, reach };
}
const lastGenre = (s) => s.games.length ? s.games[s.games.length - 1].genre : 'acao';

// ---------------------------------------------------------------- game jams
export function jamOpen(s, id) {
  const j = C.JAMS.find((x) => x.id === id);
  return !!j && j.mes === monthOf(s.week) && !s.world.jam && !s.world.jams.some((r) => r.id === id && r.y === dateOf(s.week).y);
}
export function joinJam(s, id) {
  ensure(s);
  if (!jamOpen(s, id)) return 'indisponível';
  const e = s.employees[0];
  if (e.energy < 30) return 'você está exausto(a): descanse antes';
  const j = C.JAMS.find((x) => x.id === id);
  s.world.jam = { id, left: 1, y: dateOf(s.week).y };
  e.energy = clamp(e.energy - 35, 5, 100);
  api.log(s, `Você entrou na ${j.nome} (48 horas!).`, 'info');
  return null;
}
function finishJam(s, evs) {
  const jam = s.world.jam; const j = C.JAMS.find((x) => x.id === jam.id);
  const e = s.employees[0];
  const skill = (e.skills.d + e.skills.t + e.skills.g * 0.6 + e.skills.s * 0.4) / 10;
  const base = clamp(3 + skill * 1.3 + gauss(s) * 1.0 + (s.games.length ? 0.4 : 0), 1, 9.5);
  const entries = rint(s, 180, 1400);
  const rank = Math.max(1, Math.round(entries * clamp(1 - (base - 1) / 9, 0.02, 1) * (0.7 + rnd(s) * 0.6)));
  const theme = pick(s, D.THEMES), genre = pick(s, D.GENRES.slice(0, 6));
  const nome = makeTitle(s, theme.nome, genre.id);
  const fans = Math.round(6 + base * 5 + (rank <= entries * 0.1 ? 40 : 0));
  s.fans += fans; attribFans(s, genre.id, fans);
  // XP em categorias e habilidades
  for (const c of D.CATEGORIES) s.catXp[c.id] += 0.6;
  if (chance(s, 0.5)) e.skills.d = Math.min(20, e.skills.d + (e.skills.d < 12 ? 0.25 : 0.05));
  else e.skills.t = Math.min(20, e.skills.t + (e.skills.t < 12 ? 0.25 : 0.05));
  const res = { id: jam.id, y: jam.y, nome, jam: j.nome, theme: theme.id, genre: genre.id, nota: Math.round(base * 10) / 10, rank, entries, fans, w: s.week };
  s.world.jams.push(res); if (s.world.jams.length > 12) s.world.jams.shift();
  s.world.protos.push({ nome, theme: theme.id, genre: genre.id, nota: res.nota, w: s.week, used: false });
  if (s.world.protos.length > 6) s.world.protos.shift();
  if (e.skills.d % 1 === 0.5 || true) e.skills = { ...e.skills };
  s.world.jam = null;
  api.log(s, `Jam: “${nome}” ficou em ${rank}º de ${entries}.`, rank <= entries * 0.1 ? 'bom' : 'info');
  evs.push({ type: 'jam', ...res });
}

// ---------------------------------------------------------------- fãs
export function attribFans(s, genre, n) {
  ensure(s);
  if (!genre || !n) return;
  s.fan.byGenre[genre] = Math.max(0, (s.fan.byGenre[genre] || 0) + n);
}
export function fanBreakdown(s) {
  ensure(s);
  const total = Math.max(0, Math.round(s.fans));
  const toxic = Math.round(total * s.fan.toxicShare);
  const loyal = Math.round((total - toxic) * s.fan.loyalShare);
  return { total, toxic, loyal, casual: Math.max(0, total - toxic - loyal) };
}
export function genreFanShare(s, genre) {
  const tot = Object.values(s.fan.byGenre).reduce((a, b) => a + Math.max(0, b), 0) || 1;
  return clamp((s.fan.byGenre[genre] || 0) / tot, 0, 1);
}
export const CLUB_MIN_FANS = 150;
export function clubCost(s) { return Math.round(1500 * api.infl(s) / 50) * 50; }
export function openClub(s) {
  ensure(s);
  if (s.fan.club) return 'já existe';
  if (s.fans < CLUB_MIN_FANS) return `precisa de ${CLUB_MIN_FANS}+ fãs`;
  const c = clubCost(s);
  if (s.money < c) return 'sem dinheiro';
  api.spend(s, 'fãs', c);
  s.fan.club = { since: s.week, members: Math.round(fanBreakdown(s).loyal * 0.3), dues: 0 };
  s.fan.loyalShare = clamp(s.fan.loyalShare + 0.1, 0, 0.7);
  headline(s, `${s.studio.nome} cria fã-clube oficial.`, 'estudio');
  return null;
}
export function clubWeekly(s) {
  const c = s.fan.club; if (!c) return 0;
  const b = fanBreakdown(s);
  c.members = Math.round(c.members * 0.97 + b.loyal * 0.3 * 0.03);
  const dues = c.members * 0.8 * (s.fan.mood / 70);
  c.dues = dues;
  return dues;
}
export const betaCost = (s, n) => Math.round(n * 25 * api.infl(s));
export function recruitBeta(s, n) {
  ensure(s);
  const p = s.project;
  if (!p) return 'sem projeto ativo';
  const max = Math.floor(s.fans * 0.2);
  n = Math.min(n, max, 40);
  if (n < 3) return 'poucos fãs para formar um grupo de beta (precisa de 15+ fãs)';
  const c = betaCost(s, n);
  if (s.money < c) return 'sem dinheiro';
  api.spend(s, 'beta', c);
  p.beta = n;
  return null;
}
export function betaTick(s, p, evs) {
  if (!p.beta) return;
  const cut = Math.min(p.bugs * 0.07, p.beta * 0.04);
  p.bugs = Math.max(0, p.bugs - cut);
  if (chance(s, 0.05 * p.beta / 20)) { p.hype = clamp(p.hype - 4, 0, 100); evs.push({ type: 'news', txt: `Um beta tester vazou imagens do ${p.name}!` }); }
  else if (chance(s, 0.1)) { s.fans += 2; attribFans(s, p.genre, 2); }
}
export const REQ_KINDS = ['genero', 'sequel', 'correcao', 'preco', 'demo', 'tema', 'dlc', 'plataforma'];
function newRequest(s) {
  const last = s.games[s.games.length - 1];
  const kinds = ['genero', 'tema', 'demo', 'preco'];
  if (last) kinds.push('sequel', 'sequel', 'dlc');
  if (last && last.bugs > 6) kinds.push('correcao', 'correcao', 'correcao');
  const kind = pick(s, kinds);
  const r = { id: s.fan.id++, kind, born: s.week, expires: s.week + 24, status: 'aberto' };
  if (kind === 'genero') { r.param = pick(s, D.GENRES).id; r.txt = `Pessoal pede um jogo de ${D.GENRES.find((g) => g.id === r.param).nome}!`; }
  else if (kind === 'tema') { r.param = pick(s, D.THEMES).id; r.txt = `Fãs sonham com um jogo de ${D.THEME_BY_ID[r.param].nome}.`; }
  else if (kind === 'sequel') { r.param = last.id; r.txt = `“Quando sai a continuação de ${last.name}?”`; }
  else if (kind === 'correcao') { r.param = last.id; r.txt = `Os fãs querem um patch para os bugs de ${last.name}.`; }
  else if (kind === 'preco') { r.param = 'baixo'; r.txt = 'Fãs pedem um próximo jogo com preço mais camarada.'; }
  else if (kind === 'dlc') { r.param = last.id; r.txt = `Fãs pedem conteúdo extra (DLC) para ${last.name}.`; }
  else if (kind === 'demo') { r.param = 'demo'; r.txt = 'A comunidade quer uma demo jogável antes do próximo lançamento.'; }
  else { r.param = 'pc'; r.txt = 'Fãs pedem o jogo em mais plataformas.'; }
  r.reward = { fans: Math.round(20 + s.fans * 0.06), loyal: 0.02, hype: 6 };
  return r;
}
/** Chamado ao lançar um jogo: cumpre pedidos relacionados. */
export function fulfillRequests(s, g, p, evs) {
  ensure(s);
  let any = 0;
  for (const r of s.fan.requests) {
    if (r.status !== 'aberto') continue;
    let ok = false;
    if (r.kind === 'genero') ok = g.genre === r.param || g.sub === r.param;
    else if (r.kind === 'tema') ok = g.theme === r.param;
    else if (r.kind === 'sequel') { const base = s.games.find((x) => x.id === r.param); ok = !!base && (g.theme === base.theme || g.genre === base.genre) && g.id !== base.id; }
    else if (r.kind === 'preco') ok = g.price < 18 * api.infl(s);
    else if (r.kind === 'demo') ok = !!(p && (p.demo || p.marketing?.includes?.('demo')));
    if (ok) { r.status = 'cumprido'; any++; s.fans += r.reward.fans; attribFans(s, g.genre, r.reward.fans); s.fan.loyalShare = clamp(s.fan.loyalShare + r.reward.loyal, 0, 0.7); s.fan.mood = clamp(s.fan.mood + 8, 0, 100); s.fan.done++; g.fansGained += r.reward.fans; }
  }
  if (any) evs.push({ type: 'news', txt: `Você atendeu ${any} pedido(s) dos fãs!` });
}
export function resolveRequest(s, id, how) {
  const r = s.fan.requests.find((x) => x.id === id);
  if (!r || r.status !== 'aberto') return 'indisponível';
  if (how === 'responder') { r.status = 'respondido'; s.fan.mood = clamp(s.fan.mood + 3, 0, 100); s.fans += 3; return null; }
  if (how === 'ignorar') { r.status = 'ignorado'; s.fan.mood = clamp(s.fan.mood - 2, 0, 100); s.fan.ignored++; return null; }
  return 'inválido';
}
/** Atualiza humor/fãs após o lançamento: nota alta e poucos bugs => fãs felizes. */
export function onRelease(s, g) {
  ensure(s);
  const d = (g.score - 6) * 4 - Math.max(0, g.bugs - 6) * 0.6;
  s.fan.mood = clamp(s.fan.mood + d, 0, 100);
  s.fan.toxicShare = clamp(s.fan.toxicShare + (g.score < 5 ? 0.03 : g.score > 7.5 ? -0.01 : 0), 0.01, 0.4);
  if (g.score >= 7) s.fan.loyalShare = clamp(s.fan.loyalShare + 0.02, 0, 0.7);
  headline(s, `${s.studio.nome} lança “${g.name}”: ${g.score >= 8 ? 'crítica elogia' : g.score >= 6 ? 'recepção mista' : 'recepção fria'} (${g.score.toFixed(1)}).`, 'estudio');
}
export function fanSalesMult(s, genre) {
  ensure(s);
  return (1 + 0.25 * genreFanShare(s, genre)) * (1 - 0.15 * s.fan.toxicShare) * (0.9 + s.fan.mood / 500);
}

// ---------------------------------------------------------------- tendências e lançamentos gigantes
export function trendLabel(t) {
  if (!t) return null;
  const nome = t.kind === 'genre' ? D.GENRES.find((g) => g.id === t.id).nome : D.THEME_BY_ID[t.id].nome;
  return `${t.mult >= 1 ? '📈' : '📉'} ${t.kind === 'genre' ? 'Gênero' : 'Tema'} ${t.mult >= 1 ? 'em alta' : 'em baixa'}: ${nome}`;
}
export function trendMult(s, g) {
  const t = s.world?.trend; let m = 1;
  if (t) {
    if (t.kind === 'genre' && (g.genre === t.id || g.sub === t.id)) m *= t.mult;
    if (t.kind === 'theme' && g.theme === t.id) m *= 1 + (t.mult - 1) * 0.8;
  }
  const b = s.world?.blockbuster;
  if (b) m *= b.genre === g.genre ? 0.78 : 0.92;
  return m * MKT.salesMult(s, g) * MKT.weatherSales(s) * MD.salesMult(s);
}
function maybeTrend(s, evs) {
  const w = s.world;
  if (w.trend && --w.trend.left <= 0) { headline(s, `A moda acabou: ${trendLabel(w.trend).replace(/^\S+\s/, '')} esfriou.`, 'mercado'); w.trend = null; w.nextTrend = s.week + rint(s, 6, 14); }
  if (!w.trend && s.week >= w.nextTrend) {
    const up = chance(s, 0.8);
    const kind = chance(s, 0.7) ? 'genre' : 'theme';
    const id = kind === 'genre' ? pick(s, D.GENRES).id : pick(s, D.THEMES).id;
    w.trend = { kind, id, left: rint(s, 14, 28), mult: up ? 1.25 + rnd(s) * 0.3 : 0.75 };
    const nm = kind === 'genre' ? D.GENRES.find((g) => g.id === id).nome : D.THEME_BY_ID[id].nome;
    headline(s, up ? `“${nm}” vira febre entre os jogadores.` : `Jogadores enjoam de “${nm}”.`, 'mercado');
    evs.push({ type: 'news', txt: trendLabel(w.trend) });
  }
}
function maybeBlockbuster(s, evs) {
  const w = s.world;
  if (w.blockbuster && --w.blockbuster.left <= 0) w.blockbuster = null;
  if (!w.blockbuster && weekOfMonth(s.week) === 1 && chance(s, 1 / 14)) {
    const nome = pick(s, C.BLOCKBUSTERS); const genre = pick(s, D.GENRES.slice(0, 6)).id;
    w.blockbuster = { nome, genre, left: rint(s, 3, 6) };
    headline(s, `“${nome}” chega às lojas e domina as atenções.`, 'mercado');
    evs.push({ type: 'news', txt: `Lançamento gigante: ${nome}. O mercado de ${D.GENRES.find((g) => g.id === genre).nome} vai sentir.` });
  }
}
/** Nome de jogo para rivais: sequência de franquia (parodiada) ou título novo. */
export function rivalGame(s) {
  if (chance(s, 0.45)) { const f = C.rivalFranchise(s, rnd); return { name: f.nome, genre: f.genero in Object.fromEntries(D.GENRES.map((g) => [g.id, 1])) ? f.genero : 'acao' }; }
  const t = pick(s, D.THEMES); const g = pick(s, D.GENRES);
  return { name: makeTitle(s, t.nome, g.id), genre: g.id };
}
export function studioName(s) { return pick(s, C.STUDIOS); }

// ---------------------------------------------------------------- tick semanal do mundo
export function tickWorld(s, evs) {
  ensure(s);
  const w = s.world; const d = dateOf(s.week);
  maybeTrend(s, evs);
  maybeBlockbuster(s, evs);
  if (w.jam && --w.jam.left <= 0) finishJam(s, evs);
  // anúncios do calendário (1ª semana do mês)
  if (d.w === 1) {
    for (const f of C.FAIRS) if (f.mes === d.m && f.tipo !== 'premio') evs.push({ type: 'fairs', id: f.id, nome: f.nome });
    for (const j of C.JAMS) if (j.mes === d.m) evs.push({ type: 'jams', id: j.id, nome: j.nome });
  }
  const sale = currentSale(s);
  if ((sale?.id || null) !== w.seenSale) {
    w.seenSale = sale?.id || null;
    if (sale) { headline(s, `${sale.nome} começou nas lojas.`, 'mercado'); evs.push({ type: 'news', txt: `${sale.nome} na Stean: o movimento aumenta.` }); }
  }
  w.buzz = clamp(w.buzz * 0.94, 0, 30);
  // fã-clube
  const dues = clubWeekly(s); if (dues > 0) api.earn(s, dues);
  // humor tende a 55; tóxicos caem quando humor sobe
  s.fan.mood += (55 - s.fan.mood) * 0.02;
  s.fan.toxicShare = clamp(s.fan.toxicShare + (s.fan.mood < 35 ? 0.0015 : -0.0008), 0.01, 0.4);
  // pedidos
  for (const r of s.fan.requests) if (r.status === 'aberto' && s.week >= r.expires) { r.status = 'expirado'; s.fan.mood = clamp(s.fan.mood - 3, 0, 100); }
  s.fan.requests = s.fan.requests.filter((r) => r.status === 'aberto' || s.week - r.born < 60).slice(-12);
  if (s.fans >= 30 && s.week >= s.fan.nextReq && s.fan.requests.filter((r) => r.status === 'aberto').length < 3) {
    s.fan.requests.push(newRequest(s)); s.fan.nextReq = s.week + rint(s, 8, 16);
    evs.push({ type: 'news', txt: 'Os fãs deixaram um novo pedido na comunidade.' });
  }
}
