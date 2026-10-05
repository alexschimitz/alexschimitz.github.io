// Núcleo da simulação (sem DOM). Todo o estado é JSON puro => salva/carrega fácil.
import * as D from './data.js';
import { rnd, rint, pick, chance, clamp, gauss, shuffle, dateOf, yearOf, weatherOf, WEEKS_PER_YEAR } from './util.js';
import * as S from './score.js';
import * as W from './world.js';
import * as SO from './social.js';
import * as PR from './press.js';
import * as IND from './indie.js';
import * as MP from './map.js';
import * as CT from './city.js';
import * as TM from './team.js';
import * as LE from './lifeevents.js';
import * as MKT from './market.js';
import * as MED from './media.js';
import * as ACH from './achieve.js';
import * as LG from './legacy.js';
import * as MD from './modes.js';

export const START_MONEY = 70000;
export const FOUNDER_PAY = 500;
export const TAX = 0.08;
export const IR = 0.15; // imposto de renda anual sobre o lucro do ano
export const DEBT_GRACE = 6; // semanas no vermelho até a falência

export const VERSION = 7;
export const SPECS = {
  equilibrado: { nome: 'Equilibrado', desc: 'Faz um pouco de tudo.', s: { d: 6, t: 6, g: 1, s: 1, q: 1, r: 1 } },
  programador: { nome: 'Programador(a)', desc: 'Mão boa em código. Tecnologia em alta.', s: { d: 4, t: 8, g: 1, s: 1, q: 1, r: 1 } },
  designer: { nome: 'Game Designer', desc: 'Cabeça cheia de ideias. Design em alta.', s: { d: 8, t: 4, g: 1, s: 1, q: 1, r: 1 } },
};

export function newState(opts = {}) {
  const seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const spec = SPECS[opts.spec] || SPECS.equilibrado;
  const s = {
    v: VERSION, mode: opts.mode || 'classic', rs: seed, seed, week: 0, over: null,
    studio: { nome: opts.studio || 'Garagem Games', criadoEm: Date.now(), brand: { ...MD.defaultBrand(opts.studio || 'Garagem Games'), ...(opts.brand || {}) } },
    diff: MD.DIFFICULTIES[opts.diff] ? opts.diff : 'normal', scn: null, mkt: MKT.newMarket(), media: MED.newMedia(), series: [], hall: [], slife: LE.newStaffLife(),
    money: START_MONEY, fans: 20, office: 0, debtWeeks: 0,
    employees: [{
      id: 'f', name: opts.founder || 'Fundador(a)', role: 'fundador', founder: true, look: opts.look || { hair: D.HAIRS[0], skin: D.SKINS[0], shirt: D.SHIRTS[0], style: 0 },
      skills: { ...spec.s }, salary: FOUNDER_PAY, level: 1, projects: 0, energy: 100, training: null,
    }],
    candidates: [], nextId: 1, team: TM.newTeam(),
    project: null, games: [], nextGame: 1,
    research: { done: {}, active: [], rp: 15, pd: 0 },
    catXp: Object.fromEntries(D.CATEGORIES.map((c) => [c.id, 0])),
    genreUse: {}, bestD: 0, bestT: 0,
    rivals: D.RIVALS.map((r) => ({ id: r.id, nome: r.nome, cor: r.cor, forca: r.forca, prestige: 20 + Math.round(r.forca * 20), games: [], fans: 500 })),
    prestige: 0, prestigeYear: 0,
    awards: [], achievements: {}, log: [],
    ledger: newLedger(0), history: [],
    stats: { revenue: 0, units: 0, spent: 0, games: 0 },
    flags: { tutorial: false },
    world: W.newWorld(), fan: W.newFan(), soc: SO.newSocial(), press: PR.newPress(),
  };
  s.map = MP.defaultMap(0, s.mode, D.OFFICES[0].vagas); s.city = CT.newCity();
  if (s.mode === 'indie') {
    s.ind = IND.newIndie(); s.money = IND.START_MONEY; s.fans = 5;
    const f = s.employees[0]; f.salary = 0; f.energy = 90; f.skills.m = 2; f.skills.n = 1;
    f.skills = { d: 5, t: 6, g: 2, s: 1, q: 1, r: 1, m: 2, n: 1 };
    if (opts.spec === 'programador') f.skills.t = 8; else if (opts.spec === 'designer') f.skills.d = 7;
  }
  s.money = MD.startMoney(s, s.money);
  if (opts.scenario) MD.applyScenario(s, opts.scenario);
  refreshCandidates(s);
  return s;
}
function newLedger(month) { return { month, income: 0, exp: {} }; }
const monthIndex = (week) => Math.floor(week / 4);

// ---------- helpers de consulta ----------
export const date = (s) => dateOf(s.week);
export const year = (s) => yearOf(s.week);
export const infl = (s) => S.inflation(year(s)) * MKT.costMult(s) * MD.costMult(s);
export const officeOf = (s) => D.OFFICES[s.office];
export const hasRes = (s, id) => !!s.research.done[id];
export function unlockedThemes(s) {
  const ids = new Set(D.INITIAL_THEME_IDS);
  for (const id of Object.keys(s.research.done)) { const e = D.RES_BY_ID[id]?.efeito; if (e?.themes) e.themes.forEach((t) => ids.add(t)); }
  return D.THEMES.filter((t) => ids.has(t.id)).map((t) => t.id);
}
export function unlockedGenres(s) {
  const g = new Set(['acao', 'aventura', 'casual']);
  for (const id of Object.keys(s.research.done)) { const e = D.RES_BY_ID[id]?.efeito; if (e?.genre) g.add(e.genre); }
  return D.GENRES.filter((x) => g.has(x.id)).map((x) => x.id);
}
export const subgenreUnlocked = (s) => hasRes(s, 'subgenero');
export function sizeUnlocked(s, id) { const z = D.SIZES[id]; if (z.indie && s.mode !== 'indie') return false; const r = z.req; return !r || hasRes(s, r); }
function lvlOf(s, key, start = 1) {
  let m = start;
  for (const id of Object.keys(s.research.done)) { const v = D.RES_BY_ID[id]?.efeito?.[key]; if (v && v > m) m = v; }
  return m;
}
export const engineLevel = (s) => (s.mode === 'indie' ? Math.max(IND.engineLvl(s), lvlOf(s, 'engine')) : lvlOf(s, 'engine'));
export const gfxLevel = (s) => (s.mode === 'indie' ? Math.max(IND.gfxLvl(s), lvlOf(s, 'gfx')) : lvlOf(s, 'gfx'));
export const sndLevel = (s) => (s.mode === 'indie' ? Math.max(IND.sndLvl(s), lvlOf(s, 'snd')) : lvlOf(s, 'snd'));
export function engineName(lvl, s) {
  if (s && s.mode === 'indie') return IND.toolName(s, 'engine', lvl);
  if (lvl <= 1) return 'Motor Garagem 1.0';
  return D.RESEARCH.find((r) => r.efeito.engine === lvl)?.nome || 'Motor ' + lvl;
}
export function platformAvailable(s, p) {
  const y = year(s);
  if (!!p.indie !== (s.mode === 'indie')) return false;
  if (MD.mobileOnly(s)) return p.id === 'mobilis';
  return D.platformActive(p, y) && (!p.req || hasRes(s, p.req));
}
export const availablePlatforms = (s) => D.PLATFORMS.filter((p) => platformAvailable(s, p));
export function licenseCost(s, platId, size) {
  return Math.round(D.PLAT_BY_ID[platId].licenca * Math.sqrt(D.SIZES[size].custo) * infl(s) * MKT.licMult(s) / 100) * 100;
}
export const founder = (s) => s.employees[0];
export const maxResearchSlots = (s) => 1 + (s.office >= 2 ? 1 : 0) + (s.office >= 3 ? 1 : 0);
export function canResearch(s, id) {
  const r = D.RES_BY_ID[id];
  if (!r || hasRes(s, id) || s.research.active.some((a) => a.id === id)) return 'indisponível';
  if (!r.req.every((x) => hasRes(s, x))) return 'requisitos pendentes';
  if (s.research.active.length >= maxResearchSlots(s)) return 'laboratório ocupado';
  if (s.research.rp < r.rp) return 'faltam pontos de pesquisa';
  if (s.money < researchCost(s, r)) return 'sem dinheiro';
  return null;
}
export const researchCost = (s, r) => Math.round(r.din * (0.6 + 0.4 * infl(s)) / 100) * 100;
export function sizeFactor(s, size) { return D.SIZES[size].custo * infl(s); }
export function extraCost(s, ex, size) { return Math.round(ex.custo * sizeFactor(s, size) / 50) * 50; }
export function marketingCost(s, m, size) { return Math.round(m.custo * Math.pow(D.SIZES[size].custo, 0.7) * infl(s) / 50) * 50; }
export function weeklyCosts(s) {
  const sal = s.employees.reduce((a, e) => a + e.salary, 0);
  const manut = MP.effects(s).upkeep; const rm = CT.rentMult(s);
  if (s.mode === 'indie') { const l = IND.livingCost(s); const hs = (IND.HOUSING[s.ind.housing]?.sem || 0) * (rm - 1); return { aluguel: Math.round(((s.office === 0 ? 0 : officeOf(s).aluguel) * rm + l.total + hs) * 100) / 100, salarios: sal, vida: l, manut }; }
  // clássico: encargos de escala (RH, benefícios, burocracia) crescem com a equipe — empresa grande não é lucro infinito
  const enc = Math.round(sal * clamp(0.02 * (s.employees.length - 6), 0, 0.35));
  return { aluguel: Math.round(officeOf(s).aluguel * rm * 100) / 100, salarios: sal, manut, encargos: enc };
}
/** Mercado maduro (clássico): a partir do ano 6 cada lançamento vende menos (concorrência, fadiga do público). */
export const matureMarket = (y) => 1 / (1 + 0.08 * Math.max(0, y - 5));
/** Imposto de renda progressivo sobre o lucro do ano (valores corrigidos pela inflação). */
export function incomeTax(s, profit) {
  const k = infl(s); const b1 = 1.5e6 * k, b2 = 12e6 * k; let ir = 0;
  const a = Math.min(profit, b1); ir += a * IR;
  if (profit > b1) ir += (Math.min(profit, b2) - b1) * 0.27;
  if (profit > b2) ir += (profit - b2) * 0.38;
  return Math.max(0, ir);
}
export function prestigeOf(score, size) { return Math.pow(Math.max(0, score - 4), 2) * { micro: 0.35, pequeno: 1, medio: 1.6, grande: 2.4, aaa: 3.5 }[size]; }
export function ranking(s) {
  const all = s.rivals.map((r) => ({ id: r.id, nome: r.nome, cor: r.cor, prestige: r.prestige, player: false }));
  all.push({ id: 'player', nome: s.studio.nome, cor: '#e8523c', prestige: s.prestige, player: true });
  return all.sort((a, b) => b.prestige - a.prestige);
}

// ---------- finanças ----------
function spend(s, cat, v) {
  s.money -= v; s.yearNet = (s.yearNet || 0) - v; s.ledger.exp[cat] = (s.ledger.exp[cat] || 0) + v; s.stats.spent += v;
}
function earn(s, v) { s.money += v; s.yearNet = (s.yearNet || 0) + v; s.ledger.income += v; }
export const canAfford = (s, v) => s.money - v >= 0;
function log(s, txt, tipo = 'info') { s.log.unshift({ w: s.week, txt, tipo }); if (s.log.length > 60) s.log.pop(); }
const money0 = (v) => 'R$ ' + Math.round(v).toLocaleString('pt-BR');
const API = { earn: (s, v) => earn(s, v), spend: (s, c, v) => spend(s, c, v), log: (s, t, k) => log(s, t, k), infl: (s) => infl(s), candidate: (s, r) => makeCandidate(s, r) };
MED.bind({ spend: (s, c, v) => spend(s, c, v), infl: (s) => infl(s) });
MKT.bind({ headline: (s, x, k) => W.headline(s, x, k), infl: (s) => infl(s), spend: (s, c, v) => spend(s, c, v) });
TM.bind({ log: (s, t, k) => log(s, t, k), spend: (s, c, v) => spend(s, c, v), infl: (s) => infl(s), raise: (s, e) => raiseSalary(s, e) });
LE.bind(API);
W.bind(API); SO.bind(API); PR.bind(API); IND.bind(API); MP.bind(API); CT.bind(API);

// ---------- funcionários ----------
const SKILL_KEYS = ['d', 't', 'g', 's', 'q', 'r'];
export function makeCandidate(s, role) {
  const y = year(s);
  const prim = D.ROLES[role].foco;
  const bonus = Math.floor((y - 1) / 4);
  const sk = { d: rint(s, 0, 2), t: rint(s, 0, 2), g: rint(s, 0, 1), s: rint(s, 0, 1), q: rint(s, 0, 1), r: rint(s, 0, 1) };
  sk[prim] = rint(s, 5, 8) + bonus + (chance(s, 0.15) ? 2 : 0);
  if (role === 'programador') sk.d = Math.max(sk.d, 1);
  if (role === 'designer') sk.t = Math.max(sk.t, 1);
  const sum = SKILL_KEYS.reduce((a, k) => a + sk[k], 0);
  const salary = Math.round((120 + 42 * sum) * S.inflation(y) / 10) * 10;
  return {
    id: 'c' + s.nextId++, name: pick(s, D.FIRST_NAMES) + ' ' + pick(s, D.LAST_NAMES), role, skills: sk, salary,
    fee: salary * 2, level: 1, projects: 0, energy: 100, training: null,
    look: { hair: pick(s, D.HAIRS), skin: pick(s, D.SKINS), shirt: pick(s, D.SHIRTS), style: rint(s, 0, 2) },
  };
}
export function refreshCandidates(s) {
  const roles = ['programador', 'designer', 'artista', 'sonoplasta', 'testador'];
  if (hasRes(s, 'pd')) roles.push('pesquisador');
  const picks = shuffle(s, roles).slice(0, 4);
  s.candidates = picks.map((r) => makeCandidate(s, r));
}
export function hire(s, cid) {
  const i = s.candidates.findIndex((c) => c.id === cid);
  if (i < 0) return 'candidato inexistente';
  if (s.employees.length >= officeOf(s).vagas) return 'sem vagas no escritório';
  const bh = MD.blockHire(s); if (bh) return bh;
  const c = s.candidates[i];
  if (!canAfford(s, c.fee)) return 'sem dinheiro';
  spend(s, 'contratacao', c.fee);
  s.candidates.splice(i, 1);
  TM.ensureEmp(c); c.id = 'e' + s.nextId++;
  s.employees.push(c);
  log(s, `${c.name} entrou para o time (${D.ROLES[c.role].nome}).`, 'bom');
  return null;
}
export function fire(s, id) {
  const i = s.employees.findIndex((e) => e.id === id);
  if (i <= 0) return 'não dá pra demitir o fundador';
  const e = s.employees[i];
  spend(s, 'rescisao', e.salary * 3);
  s.employees.splice(i, 1);
  if (s.project) s.project.team = s.project.team.filter((x) => x !== id);
  log(s, `${e.name} saiu do estúdio.`, 'ruim');
  return null;
}
export function trainCost(s, e, skill) { return Math.round((1200 + 350 * e.skills[skill]) * infl(s) / 50) * 50; }
export function train(s, id, skill) {
  if (!hasRes(s, 'treino')) return 'pesquise Cursos e Treinamento';
  const e = s.employees.find((x) => x.id === id);
  if (!e || e.training) return 'indisponível';
  if (e.skills[skill] >= 20) return 'habilidade máxima';
  const c = trainCost(s, e, skill);
  if (!canAfford(s, c)) return 'sem dinheiro';
  spend(s, 'treinamento', c);
  e.training = { left: 2, skill };
  if (s.project) s.project.team = s.project.team.filter((x) => x !== id);
  return null;
}
function raiseSalary(s, e) {
  if (e.founder || e.partner) return;
  const sum = SKILL_KEYS.reduce((a, k) => a + e.skills[k], 0);
  e.salary = Math.round((120 + 42 * sum) * infl(s) * TM.rankOf(e).mult / 10) * 10;
}
function levelUp(s, e) {
  e.projects++;
  if (e.projects % 2 === 0 && e.level < 10) {
    e.level++;
    const ks = SKILL_KEYS.slice().sort((a, b) => e.skills[b] - e.skills[a]);
    e.skills[ks[0]] = Math.min(20, e.skills[ks[0]] + 1);
    if (e.level % 2 === 0) e.skills[ks[1]] = Math.min(20, e.skills[ks[1]] + 1);
    raiseSalary(s, e);
    return true;
  }
  return false;
}

// ---------- escritório ----------
export function nextOffice(s) { return D.OFFICES[s.office + 1] || null; }
export function upgradeOffice(s) {
  const n = nextOffice(s);
  if (!n) return 'já é o máximo';
  const c = Math.round(n.mudanca * infl(s) / 1000) * 1000;
  if (!canAfford(s, c)) return 'sem dinheiro';
  spend(s, 'mudanca', c);
  s.office = n.id;
  MP.rebuildForLevel(s);
  log(s, `Mudança para: ${n.nome}!`, 'bom');
  return null;
}
export const upgradeCost = (s) => { const n = nextOffice(s); return n ? Math.round(n.mudanca * infl(s) / 1000) * 1000 : 0; };

// ---------- pesquisa ----------
export function startResearch(s, id) {
  const err = canResearch(s, id);
  if (err) return err;
  const r = D.RES_BY_ID[id];
  s.research.rp -= r.rp;
  spend(s, 'pesquisa', researchCost(s, r));
  s.research.active.push({ id, left: r.sem });
  return null;
}
export function setPD(s, v) { if (hasRes(s, 'pd')) s.research.pd = v; }

// ---------- projeto ----------
export function validateConcept(s, c) {
  if (s.project) return 'já existe um projeto em andamento';
  const bs = MD.blockConcept(s, c); if (bs) return bs;
  if (!unlockedThemes(s).includes(c.theme)) return 'tema bloqueado';
  const gs = unlockedGenres(s);
  if (!gs.includes(c.genre)) return 'gênero bloqueado';
  if (c.sub && (!subgenreUnlocked(s) || !gs.includes(c.sub) || c.sub === c.genre)) return 'subgênero inválido';
  const p = D.PLAT_BY_ID[c.platform];
  if (!p || !platformAvailable(s, p)) return 'plataforma indisponível';
  if (!D.SIZES[c.size] || !sizeUnlocked(s, c.size)) return 'tamanho bloqueado';
  if (!['J', 'T', 'A'].includes(c.audience)) return 'público inválido';
  if (s.employees.filter((e) => !e.training).length < D.SIZES[c.size].minEquipe) return `esse tamanho exige ${D.SIZES[c.size].minEquipe}+ pessoas`;
  if (!canAfford(s, licenseCost(s, c.platform, c.size))) return 'sem dinheiro para a licença';
  return null;
}
export function startProject(s, c) {
  const err = validateConcept(s, c);
  if (err) return err;
  const size = D.SIZES[c.size];
  const lic = licenseCost(s, c.platform, c.size);
  spend(s, 'licenca', lic);
  const bias = c.sub ? D.GENRE_DESIGN_BIAS[c.genre] * 0.65 + D.GENRE_DESIGN_BIAS[c.sub] * 0.35 : D.GENRE_DESIGN_BIAS[c.genre];
  const el = clamp(c.engineLvl || engineLevel(s), 1, engineLevel(s));
  const fanHype = clamp(Math.log10(s.fans + 1) * 5, 0, 22);
  s.project = {
    id: s.nextGame++, name: c.name || `Jogo #${s.nextGame}`, theme: c.theme, genre: c.genre, sub: c.sub || null,
    platform: c.platform, audience: c.audience, size: c.size, engineLvl: el,
    phase: 1, stage: 'config', total: size.total, dTarget: size.total * bias, tTarget: size.total * (1 - bias),
    d: 0, t: 0, art: 0, snd: 0, qa: 0, bugs: 0, focus: {}, effort: {}, extras: [], phaseFit: [],
    hype: Math.round(fanHype), marketing: [], team: s.employees.filter((e) => !e.training).map((e) => e.id).slice(0, officeOf(s).vagas),
    costs: { licenca: lic, extras: 0, marketing: 0, salarios: 0, outros: 0 }, weeks: 0, start: s.week, event: null, eventCount: 0, rpGained: 0,
    bugfixed: false, cashStart: s.money + lic,
  };
  if (s.mode === 'indie') IND.projInd(s.project);
  if (c.protoId != null && s.world.protos[c.protoId] && !s.world.protos[c.protoId].used) { s.world.protos[c.protoId].used = true; s.project.d += size.total * 0.05; s.project.t += size.total * 0.04; s.project.proto = s.world.protos[c.protoId].nome; }
  log(s, `Novo projeto: ${s.project.name}.`);
  return null;
}
export const projectProgress = (p) => clamp((p.d + p.t) / p.total, 0, 1);
export function extrasForPhase(s, phase) { return D.EXTRAS.filter((e) => e.fase === phase && (!e.req || hasRes(s, e.req))); }
export function configPhase(s, { focus, extras = [], team }) {
  const p = s.project;
  if (!p || p.stage !== 'config') return 'sem fase pendente';
  const cats = D.catsOfPhase(p.phase);
  for (const c of cats) p.focus[c.id] = clamp(Math.round(focus?.[c.id] ?? 5), 0, 10);
  let cost = 0;
  for (const id of extras) {
    const ex = D.EXTRAS.find((e) => e.id === id);
    if (!ex || ex.fase !== p.phase || (ex.req && !hasRes(s, ex.req)) || p.extras.includes(id)) return 'extra inválido';
    cost += extraCost(s, ex, p.size);
  }
  if (!canAfford(s, cost)) return 'sem dinheiro para os recursos';
  if (team) {
    const valid = team.filter((id) => s.employees.some((e) => e.id === id && !e.training));
    if (!valid.length) return 'a equipe não pode ficar vazia';
    p.team = valid.slice(0, officeOf(s).vagas);
  }
  p.team = p.team.filter((id) => s.employees.some((e) => e.id === id && !e.training));
  if (!p.team.length) p.team = [s.employees.find((e) => !e.training)?.id || 'f'];
  if (cost) { spend(s, 'recursos', cost); p.costs.extras += cost; }
  for (const id of extras) p.extras.push(id);
  for (const c of cats) p.effort[c.id] = p.effort[c.id] || 0;
  p.stage = 'dev';
  return null;
}
export function buyMarketing(s, id) {
  const p = s.project; const m = D.MARKETING.find((x) => x.id === id);
  if (!p || !m || p.stage === 'event') return 'indisponível';
  if (m.req && !hasRes(s, m.req)) return 'bloqueado';
  if (p.marketing.includes(id)) return 'já contratada';
  const c = marketingCost(s, m, p.size);
  if (!canAfford(s, c)) return 'sem dinheiro';
  spend(s, 'marketing', c); p.costs.marketing += c; p.hype = clamp(p.hype + m.hype, 0, 100); p.marketing.push(id);
  return null;
}
export const bugfixCost = (s) => Math.round(s.project.bugs * 180 * infl(s) / 50) * 50;
export function fixBugs(s) {
  const p = s.project;
  if (!p || p.stage !== 'result' || p.bugfixed || p.bugs < 1) return 'indisponível';
  const c = bugfixCost(s);
  if (!canAfford(s, c)) return 'sem dinheiro';
  spend(s, 'testes', c); p.costs.outros += c; p.bugs = p.bugs * 0.3; p.bugfixed = true;
  return null;
}
export function discardProject(s) {
  if (!s.project || s.project.stage !== 'result') return 'indisponível';
  log(s, `${s.project.name} foi para a gaveta.`, 'ruim');
  s.project = null;
  return null;
}
export function resolveEvent(s, idx) {
  const p = s.project;
  if (!p || p.stage !== 'event' || !p.event) return 'sem evento';
  const ev = D.EVENTS.find((e) => e.id === p.event);
  const op = ev.opcoes[idx];
  if (!op) return 'opção inválida';
  const c = op.custo ? Math.round(op.custo * infl(s) / 50) * 50 : 0;
  if (c && !canAfford(s, c)) return 'sem dinheiro';
  if (c) { spend(s, 'eventos', c); p.costs.outros += c; }
  const e = op.ef || {};
  if (e.d) p.d = Math.max(0, p.d + e.d * p.total);
  if (e.t) p.t = Math.max(0, p.t + e.t * p.total);
  if (e.bugs) p.bugs = Math.max(0, p.bugs + e.bugs * Math.max(1, p.total / 120));
  if (e.money) earn(s, e.money * infl(s));
  if (e.hype) p.hype = clamp(p.hype + e.hype, 0, 100);
  if (e.fans) s.fans += e.fans;
  if (e.energy) for (const em of s.employees) em.energy = clamp(em.energy + e.energy, 5, 100);
  p.event = null; p.stage = 'dev';
  return null;
}

function finishPhase(s, evs) {
  const p = s.project;
  p.phaseFit[p.phase - 1] = S.phaseFit(p.genre, p.sub, p.phase, p.focus);
  const rp = Math.max(1, Math.round(p.total / 14 * (hasRes(s, 'pd') ? 1.2 : 1)));
  s.research.rp += rp; p.rpGained += rp;
  if (p.phase < 3) {
    p.phase++; p.stage = 'config';
    evs.push({ type: 'phase', phase: p.phase });
  } else {
    p.stage = 'result';
    const effTot = Object.values(p.effort).reduce((a, b) => a + b, 0) || 1;
    const good = S.bugDensity(p) < 0.9 && (p.phaseFit.reduce((a, b) => a + b, 0) / 3) > 0.8;
    p.xpMult = good ? 1.3 : 1;
    p.xp = Object.fromEntries(D.CATEGORIES.map((c) => [c.id, Math.round(((p.effort[c.id] || 0) / effTot) * p.total * 0.12 * p.xpMult * 10) / 10]));
    p.record = { d: p.d > s.bestD, t: p.t > s.bestT };
    evs.push({ type: 'result' });
  }
}

export function catLevel(s, id) { return Math.floor(Math.sqrt(s.catXp[id] / 6)); }
export function catLevels(s) { return Object.fromEntries(D.CATEGORIES.map((c) => [c.id, catLevel(s, c.id)])); }

/** Previsão da nota (sem ruído) para mostrar no resultado. */
export function previewScore(s, p) {
  const last = s.games[s.games.length - 1];
  return S.evaluate(p, { year: s.mode === 'indie' ? 1 : year(s), engineLvl: p.engineLvl, gfxLvl: gfxLevel(s), sndLvl: sndLevel(s), catLevels: catLevels(s), last });
}

export function releaseGame(s, pub) {
  const p = s.project;
  if (!p || p.stage !== 'result') return 'indisponível';
  const indie = s.mode === 'indie';
  if (indie) { pub = pub || IND.defaultPub(p); const er = IND.launchBlock(s, p, pub); if (er) return er; }
  const ev = previewScore(s, p);
  const reviews = S.critics(ev.score, { ...p, parts: ev.parts }, s);
  const avg = Math.round(reviews.reduce((a, r) => a + r.nota, 0) / reviews.length * 10) / 10;
  const plat = D.PLAT_BY_ID[p.platform];
  const y = year(s);
  const last = s.games[s.games.length - 1];
  const crowd = s.games.filter((x) => s.week - x.releaseWeek < 8).length;
  let U = 0, wls = { wl: 0 };
  if (!indie) U = S.potentialUnits({ score: avg, plat: MD.mobileOnly(s) ? { ...plat, de: 1 } : plat, year: y, size: p.size, hype: p.hype, fans: s.fans, genre: p.genre, sub: p.sub, releaseCrowd: crowd, tier: ev.parts.tier });
  if (!indie) U *= W.fanSalesMult(s, p.genre) * matureMarket(y);
  const prs = PR.reviewsAtRelease(s, { name: p.name, genre: p.genre, bugs: p.bugs }, avg);
  if (!indie) { U *= prs.mult; wls = SO.consumeWishlists(s, 0.12); U += wls.units; }
  const g = {
    id: p.id, name: p.name, theme: p.theme, genre: p.genre, sub: p.sub, platform: p.platform, audience: p.audience, size: p.size,
    score: avg, reviews, parts: ev.parts, d: Math.round(p.d), t: Math.round(p.t), bugs: Math.round(p.bugs), hype: p.hype,
    releaseWeek: s.week, devWeeks: p.weeks, price: S.gamePrice(p, y), U, r: S.decayRate(avg), weeks: 0, active: true,
    sold: 0, gross: 0, net: 0, hist: [], costs: p.costs, fansGained: 0, rank: null, wishlists: wls.wl, press: prs.articles.map((a) => ({ outlet: a.outlet, nota: a.nota, titulo: a.titulo })),
  };
  g.costTotal = p.costs.licenca + p.costs.extras + p.costs.marketing + p.costs.outros + p.costs.salarios;
  if (indie) { g.price = S.gamePrice(p, y); IND.launch(s, g, p, pub, prs.mult); }
  s.games.push(g);
  if (weatherOf(s.week) === 'chuva') s.flags.rainRelease = true;
  s.stats.games++;
  s.bestD = Math.max(s.bestD, p.d); s.bestT = Math.max(s.bestT, p.t);
  for (const c of D.CATEGORIES) s.catXp[c.id] += p.xp[c.id] || 0;
  s.genreUse[p.genre] = (s.genreUse[p.genre] || 0) + 1;
  const pg = prestigeOf(avg, p.size);
  s.prestige += pg; s.prestigeYear += pg;
  const lv = [];
  for (const id of p.team) { const e = s.employees.find((x) => x.id === id); if (e && levelUp(s, e)) lv.push(e.name); }
  g.levelUps = lv;
  W.fulfillRequests(s, g, p, []);
  W.onRelease(s, g); { const me = []; MED.onRelease(s, g, me); for (const e of me) log(s, e.txt, 'info'); }
  s.project = null;
  log(s, `${g.name} lançado! Média ${avg.toFixed(1)}.`, avg >= 7 ? 'bom' : 'info');
  return null;
}

// ---------- tick semanal ----------
export function canTick(s) { return !s.over && !(s.project && s.project.stage !== 'dev'); }

export function tickWeek(s) {
  const evs = [];
  if (!canTick(s)) return evs;
  const y0 = year(s);
  // custos fixos
  const c = weeklyCosts(s);
  spend(s, 'aluguel', c.aluguel); spend(s, 'salarios', c.salarios);
  if (c.manut) spend(s, 'manutenção', c.manut);
  if (c.encargos) spend(s, 'encargos', c.encargos);
  const fx = MP.effects(s); const cm = CT.mult(s); cm.prod *= MKT.prodMult(s) * MKT.weatherProd(s);
  const p = s.project;
  if (p) p.costs.salarios += c.salarios + c.aluguel + (c.manut || 0) + (c.encargos || 0);
  const lounge = s.office >= 2;
  const gain = { d: 0, t: 0, perEmp: [] };
  // treinamento
  for (const e of s.employees) {
    if (e.training && --e.training.left <= 0) {
      e.skills[e.training.skill] = Math.min(20, e.skills[e.training.skill] + 1);
      raiseSalary(s, e);
      evs.push({ type: 'trained', name: e.name, skill: e.training.skill });
      e.training = null;
    }
  }
  // desenvolvimento
  if (p && p.stage === 'dev') {
    p.weeks++;
    const engMult = 1 + 0.07 * (p.engineLvl - 1);
    let dd = 0, tt = 0, aa = 0, ss = 0, qq = 0, bugW = 0, bugN = 0;
    for (const id of p.team) {
      const e = s.employees.find((x) => x.id === id);
      if (!e || e.training || e.away) continue;
      if (e.founder && s.world.jam) continue;
      const tf = TM.empFx(s, e); const pcF = e.founder ? 1 : TM.staffPc(s, s.mode === 'indie' ? IND.pcBase(s) : 1); bugW += tf.bug; bugN++;
      const mult = tf.prod * LE.remoteMult(e) * pcF * MP.empMult(fx, s.employees.indexOf(e)) * (0.6 + 0.4 * e.energy / 100) * (1 + 0.04 * (e.level - 1)) * (e.founder ? SO.founderTimeMult(s) * (s.mode === 'indie' ? IND.founderMult(s) : 1) : 1);
      const d1 = e.skills.d * mult * fx.design * cm.prod * (cm.design || 1) * tf.design, t1 = e.skills.t * mult * engMult * fx.tech * cm.prod * cm.tech;
      dd += d1; tt += t1; aa += e.skills.g * mult * fx.art * (e.founder && s.mode === 'indie' ? IND.artBonus(s) : 1); ss += e.skills.s * mult * fx.snd; qq += e.skills.q * mult;
      gain.perEmp.push({ id: e.id, d: d1, t: t1 });
      e.energy = clamp(e.energy - (lounge ? 2.5 : 4) * fx.drain * tf.drain, 5, 100);
    }
    // foco da fase: bônus de arte/som conforme sliders
    const cats = D.catsOfPhase(p.phase);
    const sh = S.actualShares(p.focus, p.phase);
    const mulG = p.phase === 3 ? 0.6 + 1.2 * sh.graficos : 1;
    const mulS = p.phase === 3 ? 0.6 + 1.2 * sh.som : 1;
    p.d += dd; p.t += tt; p.art += aa * mulG; p.snd += ss * mulS; p.qa += qq;
    const bugAdd = tt * 0.07 * (1 - Math.min(0.85, qq / (0.8 * (tt + 1)))) * (1 - 0.04 * (p.engineLvl - 1)) * fx.bug * (bugN ? bugW / bugN : 1);
    p.bugs += bugAdd;
    W.betaTick(s, p, evs);
    for (const c2 of cats) p.effort[c2.id] = (p.effort[c2.id] || 0) + (dd + tt) * sh[c2.id];
    gain.d = dd; gain.t = tt;
    // hype cresce um pouco com o tempo se há fãs
    evs.push({ type: 'gain', d: dd, t: tt, perEmp: gain.perEmp, bugs: bugAdd });
    // próximo estágio
    const prog = projectProgress(p);
    if (prog >= 1 - 1e-9) finishPhase(s, evs);
    else if (prog >= p.phase / 3) finishPhase(s, evs);
    else if (chance(s, 0.11) && p.eventCount < 5) {
      const pool = D.EVENTS.filter((e) => !e.raro || chance(s, 0.25));
      const ev = pick(s, pool);
      p.event = ev.id; p.stage = 'event'; p.eventCount++;
      evs.push({ type: 'event', id: ev.id });
    }
  } else {
    // ociosos recuperam energia
    for (const e of s.employees) e.energy = clamp(e.energy + 12 + fx.idle, 5, 100);
  }
  // pesquisadores e P&D
  let rpw = 0;
  for (const e of s.employees) if (!e.training) rpw += e.skills.r * (e.role === 'pesquisador' ? 0.7 : 0.15);
  s.research.rp += rpw + fx.rp;
  if (monthIndex(s.week) !== monthIndex(s.week - 1) || s.week === 0) { /* início de mês */ }
  if (s.week % 4 === 0 && s.research.pd > 0 && hasRes(s, 'pd')) {
    const v = s.research.pd * infl(s);
    if (canAfford(s, v)) { spend(s, 'pesquisa', v); s.research.rp += v / (110 * infl(s)) * 1; }
  }
  // pesquisas ativas
  for (const a of s.research.active.slice()) {
    if (--a.left <= 0) {
      s.research.active.splice(s.research.active.indexOf(a), 1);
      s.research.done[a.id] = true;
      evs.push({ type: 'research', id: a.id });
      log(s, `Pesquisa concluída: ${D.RES_BY_ID[a.id].nome}.`, 'bom');
    }
  }
  // vendas
  for (const g of s.games) {
    if (!g.active) continue;
    let sold, gross, fee, tax, extra = 0;
    if (g.ind) {
      const r = IND.weekly(s, g); g.weeks++;
      sold = r.sold; gross = r.gross; fee = r.fee; tax = (gross - fee) * 0.06;
      earn(s, gross);
      spend(s, 'taxas', fee); spend(s, 'impostos', tax);
      if (r.royalty) spend(s, 'royalties', r.royalty);
      if (r.pubTake) spend(s, 'publisher', r.pubTake);
      if (r.partner) spend(s, 'sócio', r.partner);
      if (r.refund) { earn(s, r.refund); log(s, `A Stean devolveu a taxa de ${money0(r.refund)} de “${g.name}”.`, 'bom'); }
      extra = r.royalty + r.pubTake + r.partner;
    } else {
      sold = Math.round(S.weeklySales(g) * W.trendMult(s, g) * (s.soc.crisis ? 1 - 0.08 * s.soc.crisis.sev : 1));
      g.weeks++;
      gross = sold * g.price;
      const plat = D.PLAT_BY_ID[g.platform];
      fee = gross * plat.taxa; tax = gross * TAX;
      earn(s, gross);
      spend(s, 'taxas', fee); spend(s, 'impostos', tax);
    }
    g.sold += sold; g.gross += gross; g.net += gross - fee - tax - extra; g.hist.push(sold);
    s.stats.revenue += gross; s.stats.units += sold;
    const fg = sold * (g.score >= 5.5 ? (g.score - 5.5) * 0.012 : -(5.5 - g.score) * 0.003);
    s.fans = Math.max(0, s.fans + fg); g.fansGained += fg; W.attribFans(s, g.genre, fg);
    if (g.ind ? (sold < 1 && g.weeks >= 14 && !(g.ind.relaunch && s.week - g.ind.relaunch.w < 6)) || g.weeks >= 400 : (sold < 1 || g.weeks >= 60)) { g.active = false; evs.push({ type: 'saleend', id: g.id }); }
  }
  W.tickWorld(s, evs); MKT.tickMarket(s, evs); MED.tickMedia(s); CT.tick(s, evs); TM.tickTeam(s, evs); LE.tickStaffLife(s, evs);
  if (s.mode === 'indie') { IND.tickIndie(s, evs); LE.tickLife(s, evs); }
  SO.tickSocial(s, evs);
  PR.tickPress(s, evs);
  // rivais
  for (const r of s.rivals) {
    if (chance(s, 1 / 14)) {
      const y = year(s);
      const forca = clamp(r.forca + (y - 1) * 0.004, 0.3, 0.9);
      const score = clamp(Math.round((forca * 10.4 + gauss(s) * 1.1) * 2) / 2, 2, 10);
      const sizeId = pick(s, ['pequeno', 'pequeno', 'medio', 'medio', 'grande', 'aaa'].slice(0, y < 4 ? 2 : y < 8 ? 4 : 6));
      const rg = W.rivalGame(s);
      const g = { name: rg.name, score, y, size: sizeId, genre: rg.genre, art: clamp(score + gauss(s), 1, 10) };
      r.games.push(g); if (r.games.length > 8) r.games.shift();
      r.prestige += prestigeOf(score, sizeId); r.yearPres = (r.yearPres || 0) + prestigeOf(score, sizeId);
      r.fans += Math.round(score * score * 20);
      if (score >= 8.5) { evs.push({ type: 'news', txt: `${r.nome} lançou "${g.name}" e a crítica adorou (${score}).` }); W.headline(s, `${r.nome} lança “${g.name}” e a crítica adora (${score}).`, 'rival'); }
      else if (chance(s, 0.3)) W.headline(s, `${r.nome} lança “${g.name}” (${score}).`, 'rival');
    }
  }
  // calendário
  s.week++;
  if (monthIndex(s.week) !== s.ledger.month) {
    s.history.push(s.ledger); if (s.history.length > 36) s.history.shift();
    s.ledger = newLedger(monthIndex(s.week));
    refreshCandidates(s);
    evs.push({ type: 'month' });
  }
  if (s.week % WEEKS_PER_YEAR === 0) yearEnd(s, evs, y0);
  // falência
  if (s.money < 0) {
    s.debtWeeks++;
    if (s.debtWeeks === 1) evs.push({ type: 'debt' });
    if (s.debtWeeks >= DEBT_GRACE) gameOver(s, evs);
  } else s.debtWeeks = 0;
  MD.tickScenario(s, evs); LG.recordSeries(s);
  checkAchievements(s, evs);
  return evs;
}

export function finalScore(s) {
  const yrs = Math.floor(s.week / WEEKS_PER_YEAR);
  const best = s.games.reduce((a, g) => Math.max(a, g.score), 0);
  return Math.round(MD.scoreMult(s) * (s.games.length * 120 + s.stats.revenue / 800 + s.fans / 8 + yrs * 600 + s.awards.length * 1500 + best * 100 + Math.max(0, s.money) / 1000));
}
function gameOver(s, evs) {
  s.over = { week: s.week, score: finalScore(s), motivo: 'Falência' };
  log(s, 'O estúdio faliu.', 'ruim');
  evs.push({ type: 'gameover', ...s.over });
}

function yearEnd(s, evs, y) {
  const ir = incomeTax(s, Math.max(0, s.yearNet || 0));
  if (ir > 0) { s.money -= ir; s.ledger.exp['imposto de renda'] = (s.ledger.exp['imposto de renda'] || 0) + ir; s.stats.spent += ir; }
  s.yearNet = 0;
  s.irPago = ir;
  const wins = [];
  const cand = [];
  for (const g of s.games) if (yearOf(g.releaseWeek) === y) cand.push({ who: 'player', nome: g.name, score: g.score, art: g.parts.artFactor * 10 });
  for (const r of s.rivals) for (const g of r.games) if (g.y === y) cand.push({ who: r.nome, nome: g.name, score: g.score, art: g.art });
  const award = (aw, list, key) => {
    if (!list.length) return null;
    const ranked = list.map((x) => ({ ...x, v: x[key] + rnd(s) * 0.4 })).sort((a, b) => b.v - a.v); const best = ranked[0];
    const r = { id: aw.id, nome: aw.nome, vencedor: best.who === 'player' ? s.studio.nome : best.who, jogo: best.nome, player: best.who === 'player', noms: ranked.slice(0, 4).map((x) => ({ jogo: x.nome, quem: x.who === 'player' ? s.studio.nome : x.who, me: x.who === 'player' })) };
    const pk = s.mode === 'indie' ? 0.3 : 1; // indie: prêmio simbólico (antes pagava R$ 8 mil por ano a qualquer jogo nota 5+)
    if (r.player && best.score >= (s.mode === 'indie' ? 7.5 : 6.5)) {
      earn(s, aw.premio * infl(s) * pk); s.fans += aw.fas; s.awards.push({ y, id: aw.id, nome: aw.nome, jogo: best.nome });
      log(s, `${D.AWARD_NAME}: ${aw.nome}!`, 'bom');
    } else r.player = false;
    return r;
  };
  const a1 = award(D.AWARDS[0], cand, 'score'); if (a1) wins.push(a1);
  const a3 = award(D.AWARDS[2], cand, 'art'); if (a3) wins.push(a3);
  // revelação: maior ganho de prestígio no ano
  const entries = s.rivals.map((r) => ({ who: r.nome, v: r.yearPres || 0 })).concat([{ who: 'player', v: s.prestigeYear }]).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  if (entries.length) {
    const w = entries[0], aw = D.AWARDS[1];
    const r = { id: aw.id, nome: aw.nome, vencedor: w.who === 'player' ? s.studio.nome : w.who, jogo: '', player: w.who === 'player', noms: entries.slice(0, 4).map((x) => ({ jogo: '', quem: x.who === 'player' ? s.studio.nome : x.who, me: x.who === 'player' })) };
    const good = s.games.some((g) => yearOf(g.releaseWeek) === y && g.score >= 7);
    if (r.player && !good) r.player = false;
    if (r.player) { earn(s, aw.premio * infl(s) * (s.mode === 'indie' ? 0.3 : 1)); s.fans += aw.fas; s.awards.push({ y, id: aw.id, nome: aw.nome, jogo: '' }); }
    wins.push(r);
  }
  s.prestige *= 0.85; s.prestigeYear = 0;
  for (const r of s.rivals) { r.prestige *= 0.85; r.yearPres = 0; }
  const rank = ranking(s).findIndex((x) => x.player) + 1;
  LG.recordYear(s, y, wins, rank);
  evs.push({ type: 'year', y, wins, rank, ir });
}

// ---------- conquistas ----------
export function checkAchievements(s, evs) {
  const ok = {
    primeiro: s.games.length >= 1,
    nota7: s.games.some((g) => g.score >= 7),
    nota9: s.games.some((g) => g.score >= 9),
    contratou: s.employees.length > 1,
    escritorio: s.office >= 1,
    cem_mil: s.money >= 100000,
    milhao: s.money >= 1e6,
    fas1k: s.fans >= 1000,
    fas50k: s.fans >= 50000,
    dez_jogos: s.games.length >= 10,
    pesquisa: Object.keys(s.research.done).length >= 1,
    tucano: s.awards.length >= 1,
    cinco_anos: s.week >= 5 * WEEKS_PER_YEAR,
    bugado: s.games.some((g) => g.parts?.bugPen >= 1.5),
    lider: s.games.length >= 3 && ranking(s)[0].player,
    tutorial: !!s.flags.tutorial,
  };
  Object.assign(ok, ACH.TESTS);
  for (const a of D.ACHIEVEMENTS) {
    let pass = false; try { const q = ok[a.id]; pass = typeof q === 'function' ? !!q(s) : !!q; } catch { pass = false; }
    if (pass && !s.achievements[a.id]) {
      s.achievements[a.id] = s.week;
      evs.push({ type: 'achievement', id: a.id });
    }
  }
}
