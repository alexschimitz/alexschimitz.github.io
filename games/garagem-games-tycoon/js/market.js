// Eventos de mercado (v0.7): crises econômicas, greves, tendências virais, novas plataformas e escândalos da indústria.
// Cada evento fica ativo por algumas semanas e aplica multiplicadores leves e globais (vendas, custos, produção, licenças).
import { rnd, rint, pick, chance, clamp, yearOf, weatherOf } from './util.js';
import * as D from './data.js';

let api = { headline() {}, log() {}, infl: () => 1, spend() {} };
export function bind(a) { api = { ...api, ...a }; }

/** fx: sales (vendas), cost (custos fixos/inflação), prod (produção da equipe), lic (licenças), genre{}, tipo{} (por tipo de plataforma), indie (só modo indie), hype */
export const MARKET_EVENTS = [
  { id: 'crise', ico: '📉', kind: 'crise', nome: 'Crise econômica', dur: [14, 26], w: 1, minYear: 2, fx: { sales: 0.88, cost: 1.07 },
    txt: 'O país entrou em recessão: o consumo cai e os custos sobem.', resp: { label: 'Cortar custos e renegociar', cost: 1500, cut: 0.35 } },
  { id: 'inflacao', ico: '💸', kind: 'crise', nome: 'Inflação em alta', dur: [10, 20], w: 1, minYear: 3, fx: { cost: 1.1 },
    txt: 'Tudo ficou mais caro: aluguel, salários e licenças.', resp: null },
  { id: 'cambio', ico: '💱', kind: 'crise', nome: 'Dólar dispara', dur: [8, 16], w: 1, minYear: 2, fx: { lic: 1.3, cost: 1.02 },
    txt: 'As licenças de plataforma, cotadas em dólar, ficam bem mais caras.', resp: null },
  { id: 'boom', ico: '📈', kind: 'boom', nome: 'Boom econômico', dur: [10, 18], w: 0.5, minYear: 2, fx: { sales: 1.06, cost: 1.05 },
    txt: 'A economia aquecida deixa o público gastando mais com jogos.', resp: null },
  { id: 'incentivo', ico: '🏛️', kind: 'boom', nome: 'Incentivo fiscal para games', dur: [16, 30], w: 0.6, minYear: 3, fx: { cost: 0.97 },
    txt: 'O governo aprovou um incentivo fiscal para estúdios de games.', resp: null },
  { id: 'greve_transporte', ico: '🚌', kind: 'greve', nome: 'Greve de transporte', dur: [3, 6], w: 1.1, minYear: 1, fx: { prod: 0.92 },
    txt: 'Ônibus e metrô parados: a equipe chega cansada e atrasada.', resp: { label: 'Pagar táxi para a equipe', cost: 800, cut: 0.6 } },
  { id: 'greve_devs', ico: '✊', kind: 'greve', nome: 'Greve da indústria', dur: [4, 8], w: 0.6, minYear: 5, fx: { prod: 0.88, sales: 0.97 },
    txt: 'Profissionais de games entram em greve por jornadas menores. A cena inteira desacelera.', resp: { label: 'Apoiar o sindicato (doação)', cost: 2000, cut: 0.5 } },
  { id: 'greve_logistica', ico: '📦', kind: 'greve', nome: 'Greve de logística', dur: [3, 6], w: 0.7, minYear: 4, fx: { sales: 0.95, tipo: { Console: 0.9, 'Portátil': 0.9 } },
    txt: 'Consoles e portáteis atrasam nas lojas por causa da greve de caminhoneiros.', resp: null },
  { id: 'viral_genero', ico: '🔥', kind: 'tendencia', nome: 'Gênero viraliza', dur: [8, 16], w: 1.3, minYear: 1, fx: { genre: {} },
    txt: 'Um clipe viral colocou um gênero inteiro na boca do povo.', resp: null, pickGenre: 1.2 },
  { id: 'desafio_viral', ico: '🎬', kind: 'tendencia', nome: 'Desafio viral nas redes', dur: [4, 8], w: 0.9, minYear: 2, fx: { sales: 1.03, hype: 1.05 },
    txt: 'Um desafio nas redes sociais leva todo mundo a baixar jogos casuais.', resp: null, boostGenre: ['casual', 'musical'] },
  { id: 'copa', ico: '⚽', kind: 'tendencia', nome: 'Copa do Mundo', dur: [5, 8], w: 0.5, minYear: 2, fx: { genre: { esporte: 1.3, acao: 0.95, rpg: 0.93, estrategia: 0.93, casual: 0.95, aventura: 0.95 } },
    txt: 'Todo mundo está de olho na Copa: jogos de esporte bombam e o resto fica para depois.', resp: null },
  { id: 'lockdown', ico: '🏠', kind: 'tendencia', nome: 'Todos em casa', dur: [10, 18], w: 0.2, minYear: 4, fx: { sales: 1.08, prod: 0.95, genre: { casual: 1.12, simulacao: 1.08, sandbox: 1.1 } },
    txt: 'Com todos em casa, o consumo de jogos dispara — mas a produção sofre.', resp: null },
  { id: 'nova_plat_portatil', ico: '🕹️', kind: 'plataforma', nome: 'Novo portátil chega às lojas', dur: [14, 26], w: 0.7, minYear: 3, fx: { tipo: { 'Portátil': 1.1 } },
    txt: 'Um novo portátil hype lotou as filas. Jogos para portáteis vendem mais.', resp: null },
  { id: 'nova_plat_celular', ico: '📱', kind: 'plataforma', nome: 'Celulares ganham chip gamer', dur: [14, 28], w: 0.7, minYear: 4, fx: { tipo: { Celular: 1.1 } },
    txt: 'Os celulares ficaram muito mais poderosos. O mercado mobile aquece.', resp: null },
  { id: 'nova_plat_console', ico: '🎮', kind: 'plataforma', nome: 'Lançamento de console', dur: [16, 30], w: 0.7, minYear: 3, fx: { tipo: { Console: 1.1 } },
    txt: 'Um novo console esgotou nas pré-vendas e a base de jogadores cresce.', resp: null },
  { id: 'nova_plat_pc', ico: '🖥️', kind: 'plataforma', nome: 'Promoção de placas de vídeo', dur: [10, 18], w: 0.5, minYear: 4, fx: { tipo: { PC: 1.07 } },
    txt: 'Placas de vídeo ficaram baratas e muita gente montou um PC novo.', resp: null },
  { id: 'escandalo_assedio', ico: '🕵️', kind: 'escandalo', nome: 'Escândalo no mercado AAA', dur: [8, 14], w: 0.6, minYear: 4, fx: { sales: 0.97, indie: 1.06 },
    txt: 'Um escândalo atinge grandes publishers: o público procura alternativas independentes.', resp: null },
  { id: 'escandalo_lootbox', ico: '🎁', kind: 'escandalo', nome: 'Polêmica das loot boxes', dur: [8, 16], w: 0.6, minYear: 5, fx: { sales: 0.98, indie: 1.05, monet: 0.8 },
    txt: 'Reguladores atacam as caixas de recompensa: jogos com microtransações perdem o prestígio.', resp: null },
  { id: 'escandalo_vazamento', ico: '🔓', kind: 'escandalo', nome: 'Vazamento de jogo da Nintendu', dur: [3, 6], w: 0.5, minYear: 3, fx: { sales: 0.96 },
    txt: 'Um vazamento gigante domina as notícias; seus lançamentos recebem menos atenção.', resp: null },
  { id: 'pirataria', ico: '🏴‍☠️', kind: 'crise', nome: 'Onda de pirataria', dur: [8, 16], w: 0.6, minYear: 2, fx: { sales: 0.92 },
    txt: 'Cópias piratas circulam livremente e as vendas sentem.', resp: { label: 'Reforçar proteção (R$)', cost: 2500, cut: 0.5 } },
];
export const MK_BY_ID = Object.fromEntries(MARKET_EVENTS.map((e) => [e.id, e]));

export function newMarket() { return { active: [], next: 18, cd: {}, log: [], n: 0 }; }
export function ensureMarket(s) { s.mkt ??= newMarket(); return s.mkt; }

const platTipo = (g) => D.PLAT_BY_ID[g?.platform]?.tipo || null;
function fold(s, f) { const m = ensureMarket(s); let v = 1; for (const a of m.active) v *= f(a.fx, a) ?? 1; return v; }
/** Vendas semanais/lançamento de um jogo g ({genre, sub, platform}). */
export function salesMult(s, g) {
  return fold(s, (fx) => {
    let v = fx.sales ?? 1;
    if (fx.genre) { const a = fx.genre[g.genre], b = g.sub ? fx.genre[g.sub] : null; if (a) v *= a; if (b) v *= 1 + (b - 1) * 0.5; }
    if (fx.tipo) { const t = platTipo(g); if (t && fx.tipo[t]) v *= fx.tipo[t]; }
    if (fx.indie && s.mode === 'indie') v *= fx.indie;
    return v;
  });
}
export const costMult = (s) => fold(s, (fx) => fx.cost);
export const prodMult = (s) => fold(s, (fx) => fx.prod);
export const licMult = (s) => fold(s, (fx) => fx.lic);
export const monetMult = (s) => fold(s, (fx) => fx.monet);
export const hypeMult = (s) => fold(s, (fx) => fx.hype);
export const active = (s) => ensureMarket(s).active.map((a) => ({ ...a, def: MK_BY_ID[a.id] }));

function start(s, def, evs) {
  const m = ensureMarket(s);
  const fx = JSON.parse(JSON.stringify(def.fx));
  let extra = '';
  if (def.pickGenre) { const g = pick(s, D.GENRES); fx.genre = { [g.id]: def.pickGenre }; extra = ` (${g.nome})`; }
  if (def.boostGenre) { fx.genre = Object.fromEntries(def.boostGenre.map((g) => [g, 1.15])); }
  const left = rint(s, def.dur[0], def.dur[1]);
  m.active.push({ id: def.id, left, total: left, since: s.week, fx, extra, paid: false });
  m.cd[def.id] = s.week; m.n++;
  const txt = `${def.ico} ${def.nome}${extra}: ${def.txt}`;
  m.log.unshift({ w: s.week, id: def.id, txt }); if (m.log.length > 30) m.log.pop();
  api.headline(s, `${def.nome}${extra}.`, 'mercado');
  evs.push({ type: 'market', id: def.id, txt: `${def.ico} ${def.nome}${extra}` });
}
/** Semanal: expira os ativos e, com chance, abre um novo (no máx. 2 ao mesmo tempo, com intervalo mínimo). */
export function tickMarket(s, evs) {
  const m = ensureMarket(s);
  for (const a of m.active) a.left--;
  const done = m.active.filter((a) => a.left <= 0);
  m.active = m.active.filter((a) => a.left > 0);
  for (const a of done) { const d = MK_BY_ID[a.id]; if (d) { api.headline(s, `${d.nome} chegou ao fim.`, 'mercado'); evs.push({ type: 'news', txt: `${d.ico} ${d.nome} acabou.` }); } }
  if (s.week < m.next || m.active.length >= 2 || !chance(s, 0.18)) return;
  const y = yearOf(s.week);
  const pool = MARKET_EVENTS.filter((e) => y >= e.minYear && !m.active.some((a) => a.id === e.id) && s.week - (m.cd[e.id] ?? -99) > 52);
  if (!pool.length) return;
  let tot = pool.reduce((a, e) => a + e.w, 0), r = rnd(s) * tot, pk = pool[0];
  for (const e of pool) { r -= e.w; if (r <= 0) { pk = e; break; } }
  start(s, pk, evs);
  m.next = s.week + rint(s, 6, 14);
}
export function respCost(s, id) { const d = MK_BY_ID[id]; return d?.resp ? Math.round(d.resp.cost * api.infl(s) / 50) * 50 : 0; }
export function respond(s, id) {
  const m = ensureMarket(s); const a = m.active.find((x) => x.id === id); const d = MK_BY_ID[id];
  if (!a || !d?.resp) return { err: 'sem resposta disponível' };
  if (a.paid) return { err: 'você já respondeu' };
  const c = respCost(s, id); if (s.money < c) return { err: 'sem dinheiro' };
  api.spend(s, 'mercado', c); a.paid = true; a.left = Math.max(1, Math.round(a.left * (1 - d.resp.cut)));
  return { msg: `${d.resp.label}: o efeito deve durar menos.` };
}

/** Clima com efeito real, porém leve (v0.7): chuva atrapalha o trajeto (a menos que haja escritório), sol anima; chuva segura o povo em casa jogando. */
export function weatherProd(s) { const w = weatherOf(s.week); return w === 'sol' ? 1.01 : w === 'chuva' ? (s.office >= 1 ? 1 : 0.985) : w === 'neblina' ? 0.99 : 1; }
export function weatherSales(s) { const w = weatherOf(s.week); return w === 'chuva' ? 1.02 : w === 'sol' ? 0.99 : 1; }
