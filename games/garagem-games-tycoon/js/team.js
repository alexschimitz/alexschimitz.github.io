// Equipe e vida do estúdio (v0.6.1): traços, humor, cultura, 1:1/feedback, conflitos, promoções e cargos.
// Lógica pura (sem DOM). Estado em s.team (JSON) e campos extras nos funcionários (traits, mood, rank).
import { clamp, chance, rnd } from './util.js';
import * as SO from './social.js';

export const TRAITS = {
  perfeccionista: { nome: 'Perfeccionista', ico: '🔍', prod: 0.97, bug: 0.85, conf: 1, desc: 'Entrega com menos bugs, mas é um pouco mais lento.' },
  criativo: { nome: 'Criativo(a)', ico: '💡', prod: 1.0, design: 1.08, conf: 1.3, desc: '+8% de Design; ideias demais geram atrito.' },
  workaholic: { nome: 'Workaholic', ico: '🔥', prod: 1.06, drain: 1.25, conf: 1, desc: '+6% de produção, mas se cansa mais rápido.' },
  timido: { nome: 'Tímido(a)', ico: '🤫', prod: 1.0, conf: 0.5, o11: 1.5, desc: 'Evita conflitos; o 1:1 rende 50% mais.' },
  mentor: { nome: 'Mentor(a) nato(a)', ico: '🎓', prod: 0.98, mentor: 1, conf: 0.8, desc: 'Ajuda o time: +1% de produção de cada colega (máx. +5%).' },
  briguento: { nome: 'Pavio curto', ico: '💢', prod: 1.02, conf: 2.6, desc: 'Entrega bem, mas arruma briga com facilidade.' },
  autodidata: { nome: 'Autodidata', ico: '📚', prod: 1.0, xp: 1, conf: 1, desc: 'Evolui sozinho(a): chance extra de subir de nível.' },
  sensivel: { nome: 'Sensível', ico: '🌧️', prod: 1.0, mood: 1.5, conf: 1, desc: 'O humor oscila mais com o ambiente.' },
};
export const TRAIT_IDS = Object.keys(TRAITS);

export const CULTURES = {
  equilibrio: { nome: 'Equilibrada', ico: '⚖️', desc: 'Sem extremos. Nenhum bônus, nenhum custo.', prod: 1, bug: 1, mood: 0, drain: 1, design: 1 },
  qualidade: { nome: 'Qualidade primeiro', ico: '💎', desc: '-12% de bugs e +3% de Design; -3% de velocidade.', prod: 0.97, bug: 0.88, mood: 0, drain: 1, design: 1.03 },
  velocidade: { nome: 'Entrega rápida', ico: '🚀', desc: '+6% de produção, +10% de bugs e humor caindo devagar.', prod: 1.06, bug: 1.1, mood: -6, drain: 1.1, design: 1 },
  bemestar: { nome: 'Bem-estar', ico: '🌿', desc: 'Humor +6, menos cansaço (-12%); -2% de produção.', prod: 0.98, bug: 1, mood: 6, drain: 0.88, design: 1 },
  inovacao: { nome: 'Inovação', ico: '🧪', desc: '+6% de Design e +3% de Tecnologia; um pouco mais de bugs.', prod: 1, bug: 1.05, mood: 0, drain: 1, design: 1.06 },
};
export const CULTURE_COST = 1500; // por mudança (corrigido pela inflação)

export const RANKS = [
  { n: 0, min: 1, nome: 'Júnior', mult: 1 },
  { n: 1, min: 3, nome: 'Pleno', mult: 1.15 },
  { n: 2, min: 5, nome: 'Sênior', mult: 1.32 },
  { n: 3, min: 8, nome: 'Líder', mult: 1.5 },
];
const ROLE_TITLE = { programador: 'Programador(a)', designer: 'Designer', artista: 'Artista', sonoplasta: 'Sonoplasta', compositor: 'Compositor(a)', testador: 'QA', fundador: 'Fundador(a)' };

const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export function newTeam() { return { culture: 'equilibrio', cultureWeek: -99, conflict: null, log: [], v: 1 }; }
export function ensureTeam(s) { s.team ??= newTeam(); for (const k of Object.keys(newTeam())) s.team[k] ??= newTeam()[k]; return s.team; }
/** Completa traços/humor/cargo de um funcionário (determinístico pelo id+nome: não consome o RNG da simulação). */
export function ensureEmp(e) {
  if (!e.traits && e.founder) e.traits = [];
  if (!e.traits) {
    const h = hash(e.name + '|' + e.role); const a = TRAIT_IDS[h % TRAIT_IDS.length]; const b = TRAIT_IDS[(h >>> 8) % TRAIT_IDS.length];
    e.traits = ((h >>> 16) % 3 === 0 || a === b) ? [a] : [a, b];
  }
  e.mood ??= 68; e.rank ??= 0; e.o11 ??= -99; e.lowW ??= 0; e.promoAsk ??= 0;
  return e;
}
export const traitsOf = (e) => ensureEmp(e).traits.map((t) => TRAITS[t]);
export const hasTrait = (e, t) => ensureEmp(e).traits.includes(t);
export const rankOf = (e) => RANKS[Math.min(3, ensureEmp(e).rank)];
export function titleOf(e) { ensureEmp(e); if (e.founder) return 'Fundador(a)'; return `${ROLE_TITLE[e.role] || e.role} ${RANKS[Math.min(3, e.rank)].nome}`; }
export const eligibleRank = (e) => { ensureEmp(e); let r = 0; for (const k of RANKS) if (e.level >= k.min) r = k.n; return r; };

export const cultureOf = (s) => CULTURES[ensureTeam(s).culture] || CULTURES.equilibrio;
/** Multiplicadores de equipe (humor, traços, cultura, PC no indie). Para o fundador só vale a cultura. */
export function empFx(s, e) {
  ensureEmp(e); const cu = cultureOf(s); let prod = 1, bug = 1, design = 1, drain = 1;
  for (const tid of e.traits) { const t = TRAITS[tid]; prod *= t.prod; bug *= t.bug || 1; design *= t.design || 1; drain *= t.drain || 1; }
  const mentors = s.employees.filter((x) => x !== e && hasTrait(x, 'mentor')).length; prod *= 1 + Math.min(0.05, 0.01 * mentors);
  prod *= cu.prod; bug *= cu.bug; design *= cu.design; drain *= cu.drain;
  if (e.buff) prod *= e.buff.mult;
  if (!e.founder) prod *= 1 + clamp((e.mood - 65) * 0.0016, -0.07, 0.056);
  return { prod, bug, design, drain };
}
/** PC do estúdio (indie): equipamento melhor também acelera quem foi contratado. */
export const staffPc = (s, pcBase) => (s.mode === 'indie' ? clamp(0.88 + 0.3 * (pcBase - 0.78), 0.88, 1.14) : 1);

function pushLog(s, t) { const T = ensureTeam(s); T.log.unshift({ w: s.week, t }); if (T.log.length > 14) T.log.length = 14; }
let api = { log() {}, spend() {}, infl: () => 1, raise() {} };
export function bind(a) { api = { ...api, ...a }; }

const hoursLeft = (s) => 40 - SO.ensureSoc(s).hours;
export function o11Block(s, e) {
  ensureEmp(e); if (e.founder) return 'é você mesmo(a)'; if (s.week - e.o11 < 4) return `já conversaram há ${s.week - e.o11} semana(s)`; if (hoursLeft(s) < 2) return 'faltam horas na semana (2h)';
  return null;
}
/** 1:1 — 2h do fundador: sobe o humor e evita problemas. */
export function oneOnOne(s, id) {
  const e = s.employees.find((x) => x.id === id); if (!e) return { err: 'funcionário inexistente' }; const b = o11Block(s, e); if (b) return { err: b };
  SO.ensureSoc(s).hours += 2; e.o11 = s.week; const k = hasTrait(e, 'timido') ? 1.5 : 1;
  const gain = Math.round((9 + (e.mood < 50 ? 6 : 0)) * k); e.mood = clamp(e.mood + gain, 0, 100); e.lowW = 0;
  const T = ensureTeam(s); if (T.conflict && (T.conflict.a === id || T.conflict.b === id)) T.conflict.heat = Math.max(0, (T.conflict.heat || 0) - 2);
  const wants = e.mood < 55 ? 'Ele(a) precisa de reconhecimento.' : eligibleRank(e) > e.rank ? 'Ele(a) já merece uma promoção.' : 'Tudo bem por aqui.';
  return { msg: `1:1 com ${e.name}: humor +${gain}. ${wants}`, gain };
}
export const FEEDBACK = {
  elogio: { nome: 'Elogio público', h: 0.5, desc: 'Humor +7 e +4% de produção por 1 semana.' },
  construtivo: { nome: 'Feedback construtivo', h: 1, desc: 'Humor -2 hoje, mas +40% de progresso para o próximo nível.' },
  duro: { nome: 'Cobrança dura', h: 0.5, desc: 'Humor -10; +5% de produção por 2 semanas, risco de conflito.' },
};
export function feedback(s, id, kind) {
  const e = s.employees.find((x) => x.id === id), f = FEEDBACK[kind]; if (!e || !f) return { err: 'inválido' }; ensureEmp(e);
  if (e.founder) return { err: 'é você mesmo(a)' }; if (hoursLeft(s) < f.h) return { err: 'faltam horas na semana' }; if (e.fbWeek === s.week) return { err: 'já recebeu feedback nesta semana' };
  SO.ensureSoc(s).hours += f.h; e.fbWeek = s.week; let msg;
  if (kind === 'elogio') { e.mood = clamp(e.mood + 7, 0, 100); e.buff = { mult: 1.04, left: 1 }; msg = `${e.name} adorou o elogio.`; }
  else if (kind === 'construtivo') { e.mood = clamp(e.mood - 2, 0, 100); e.projects = (e.projects || 0) + 0.4; msg = `${e.name} anotou tudo e quer melhorar.`; }
  else { e.mood = clamp(e.mood - 10, 0, 100); e.buff = { mult: 1.05, left: 2 }; if (chance(s, 0.25)) startConflict(s, e, null, 'cobrança'); msg = `${e.name} entendeu o recado, mas ficou chateado(a).`; }
  return { msg };
}
export function promoBlock(s, e) {
  ensureEmp(e); if (e.founder) return 'fundador(a) não é promovido(a)'; if (e.rank >= 3) return 'já é o cargo máximo'; if (eligibleRank(e) <= e.rank) return `precisa de nível ${RANKS[e.rank + 1].min} (hoje ${e.level})`;
  return null;
}
export const promoCost = (s, e) => Math.round(e.salary * 6 / 10) * 10;
export function promote(s, id) {
  const e = s.employees.find((x) => x.id === id); if (!e) return { err: 'funcionário inexistente' }; const b = promoBlock(s, e); if (b) return { err: b };
  const c = promoCost(s, e); if (s.money < c) return { err: 'sem dinheiro para o bônus de promoção' };
  api.spend(s, 'promoções', c); e.rank++; e.mood = clamp(e.mood + 14, 0, 100); e.promoAsk = 0; api.raise(s, e);
  pushLog(s, `${e.name} foi promovido(a) a ${titleOf(e)}.`); api.log(s, `${e.name} agora é ${titleOf(e)}!`, 'bom');
  return { msg: `${e.name} agora é ${titleOf(e)} (salário ${Math.round(e.salary)}/sem).` };
}
export function setCulture(s, id) {
  const T = ensureTeam(s); if (!CULTURES[id]) return 'inválida'; if (id === T.culture) return 'já é a cultura atual';
  if (s.week - T.cultureWeek < 24) return `espere ${24 - (s.week - T.cultureWeek)} semana(s) para mudar de novo`;
  const c = Math.round(CULTURE_COST * api.infl(s)); if (s.money < c) return 'sem dinheiro para o workshop de cultura';
  if (hoursLeft(s) < 3) return 'faltam horas na semana (3h)';
  api.spend(s, 'cultura', c); SO.ensureSoc(s).hours += 3; T.culture = id; T.cultureWeek = s.week;
  for (const e of s.employees) if (!e.founder) { ensureEmp(e); e.mood = clamp(e.mood + (CULTURES[id].mood >= 0 ? 4 : -2), 0, 100); }
  pushLog(s, `Nova cultura: ${CULTURES[id].nome}.`); return null;
}

// ---------------------------------------------------------------- conflitos
export function startConflict(s, a, b, motivo) {
  const T = ensureTeam(s); if (T.conflict) return false;
  if (!b) { const others = s.employees.filter((x) => x !== a && !x.founder); if (!others.length) return false; b = others[Math.floor(rnd(s) * others.length)]; }
  T.conflict = { a: a.id, b: b.id, since: s.week, heat: 3, motivo: motivo || 'estilos de trabalho diferentes' };
  api.log(s, `Conflito: ${a.name} e ${b.name} (${T.conflict.motivo}).`, 'ruim'); pushLog(s, `Conflito entre ${a.name} e ${b.name}.`); return true;
}
export const CONFLICT_OPTS = {
  mediar: { nome: 'Mediar uma conversa', h: 4, desc: 'Reúne os dois (4h). Boa chance de resolver; mediadores e tímidos ajudam.' },
  apoiar: { nome: 'Apoiar um lado', h: 1, desc: 'Resolve rápido, mas o outro lado perde 15 de humor.' },
  separar: { nome: 'Separar as mesas', h: 1, desc: 'Reduz a tensão pela metade, sem resolver. R$ 400.' },
};
export function resolveConflict(s, how, side) {
  const T = ensureTeam(s), c = T.conflict; if (!c) return { err: 'sem conflito' };
  const a = s.employees.find((x) => x.id === c.a), b = s.employees.find((x) => x.id === c.b); const o = CONFLICT_OPTS[how]; if (!o) return { err: 'inválido' };
  if (!a || !b) { T.conflict = null; return { msg: 'O conflito se desfez.' }; }
  if (hoursLeft(s) < o.h) return { err: `faltam horas na semana (${o.h}h)` };
  if (how === 'separar' && s.money < 400 * api.infl(s)) return { err: 'sem dinheiro' };
  SO.ensureSoc(s).hours += o.h;
  if (how === 'mediar') {
    const help = [a, b, ...s.employees].some((x) => hasTrait(x, 'mentor')) ? 0.12 : 0; const ok = chance(s, 0.62 + help + ((hasTrait(a, 'timido') || hasTrait(b, 'timido')) ? 0.08 : 0) - ((hasTrait(a, 'briguento') && hasTrait(b, 'briguento')) ? 0.25 : 0));
    if (ok) { T.conflict = null; a.mood = clamp(a.mood + 6, 0, 100); b.mood = clamp(b.mood + 6, 0, 100); pushLog(s, `Conflito entre ${a.name} e ${b.name} resolvido.`); return { msg: 'A conversa funcionou: o clima voltou ao normal.' }; }
    c.heat = Math.max(1, c.heat - 1); return { msg: 'A conversa foi tensa e não resolveu. Tente de novo ou escolha outra saída.' };
  }
  if (how === 'apoiar') { const w = side === c.b ? b : a, l = w === a ? b : a; l.mood = clamp(l.mood - 15, 0, 100); w.mood = clamp(w.mood + 6, 0, 100); T.conflict = null; pushLog(s, `Conflito encerrado a favor de ${w.name}.`); return { msg: `Você apoiou ${w.name}; ${l.name} ficou ressentido(a).` }; }
  api.spend(s, 'reorganização', 400 * api.infl(s)); c.heat = Math.max(1, Math.floor(c.heat / 2)); return { msg: 'As mesas foram separadas: a tensão caiu pela metade.' };
}

// ---------------------------------------------------------------- tick semanal
export function tickTeam(s, evs, pcBase = 1) {
  const T = ensureTeam(s); const cu = cultureOf(s); void pcBase;
  const crew = s.employees.filter((e) => !e.founder);
  for (const e of s.employees) {
    ensureEmp(e);
    if (e.buff && --e.buff.left <= 0) e.buff = null;
    if (e.founder) continue;
    // humor: tende a um alvo que depende de energia, cultura, promoção atrasada, conflito e trabalho excessivo
    let target = 66 + cu.mood + (e.energy < 30 ? -22 : e.energy < 50 ? -9 : e.energy >= 80 ? 5 : 0);
    if (eligibleRank(e) > e.rank) { e.promoAsk++; if (e.promoAsk > 8) target -= Math.min(14, e.promoAsk - 8); } else e.promoAsk = 0;
    if (T.conflict && (T.conflict.a === e.id || T.conflict.b === e.id)) target -= 6 + Math.min(10, T.conflict.heat * 2);
    if (s.office >= 2) target += 3; if (s.money < 0) target -= 12;
    const sens = hasTrait(e, 'sensivel') ? 1.5 : 1; e.mood = clamp(e.mood + (target - e.mood) * 0.12 * sens, 0, 100);
    if (hasTrait(e, 'autodidata') && chance(s, 0.03)) e.projects = (e.projects || 0) + 0.5;
    e.lowW = e.mood < 14 ? e.lowW + 1 : 0;
    if (e.lowW >= 5 && !s.project?.team?.includes(e.id)) { // pede demissão (nunca no meio de um projeto em que está escalado)
      s.employees.splice(s.employees.indexOf(e), 1); api.log(s, `${e.name} pediu demissão: o clima ficou insuportável.`, 'ruim'); pushLog(s, `${e.name} pediu demissão.`); evs.push({ type: 'news', txt: `${e.name} pediu demissão.` });
    }
  }
  // conflitos: surgem entre pessoas de traços incompatíveis
  const c = T.conflict;
  if (c) {
    c.heat = Math.min(8, c.heat + 0.35);
    if (s.week - c.since >= 10) { const a = s.employees.find((x) => x.id === c.a), b = s.employees.find((x) => x.id === c.b); const lose = a && b ? (a.mood <= b.mood ? a : b) : (a || b); T.conflict = null; if (lose && !lose.founder && !s.project?.team?.includes(lose.id)) { s.employees.splice(s.employees.indexOf(lose), 1); api.log(s, `${lose.name} saiu após um conflito mal resolvido.`, 'ruim'); pushLog(s, `${lose.name} saiu após conflito.`); } else T.conflict = null; }
  } else if (crew.length >= 2) {
    const risk = crew.reduce((a, e) => a + (TRAITS[e.traits[0]].conf || 1) * 0.004, 0) * (cu.mood < 0 ? 1.4 : 1) * (crew.some((e) => e.mood < 35) ? 1.6 : 1);
    if (chance(s, risk)) { const pool = crew.slice().sort((x, y) => (TRAITS[y.traits[0]].conf || 1) - (TRAITS[x.traits[0]].conf || 1)); const a = pool[0]; if (a) startConflict(s, a, null, ['prazos', 'estilos de trabalho diferentes', 'crédito pelo trabalho', 'barulho na mesa'][Math.floor(rnd(s) * 4)]); }
  }
  return evs;
}
export function summary(s) {
  const crew = s.employees.filter((e) => !e.founder); crew.forEach(ensureEmp);
  const avg = crew.length ? crew.reduce((a, e) => a + e.mood, 0) / crew.length : null;
  return { avgMood: avg, conflict: ensureTeam(s).conflict, culture: cultureOf(s), crew: crew.length, pending: crew.filter((e) => eligibleRank(e) > e.rank).length };
}
