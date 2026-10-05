// Imprensa fictícia: press kit, previews, cópias de review com embargo, entrevistas, matérias sobre o estúdio, assessoria.
import * as D from './data.js';
import * as C from './catalog.js';
import { rnd, rint, pick, chance, clamp, gauss, dateOf } from './util.js';
import { headline, attribFans } from './world.js';
import { ensureSoc, totalFollowers, WEEK_HOURS, startCrisis, genDM } from './social.js';

let api = { earn() {}, spend() {}, log() {}, infl: () => 1 };
export function bind(a) { api = a; }

export function newPress() {
  return { kit: { level: 0, w: -99 }, rel: {}, pitches: [], articles: [], agency: null, copies: {}, nid: 1, lastStudio: -99, agencyPaid: 0 };
}
export function ensurePress(s) { s.press ??= newPress(); return s.press; }

export const OUTLET_BY_ID = Object.fromEntries(C.OUTLETS.map((o) => [o.id, o]));
export const KIT_LEVELS = [
  { nome: 'Sem press kit', custo: 0, h: 0, mult: 0.35, desc: 'Jornalistas ignoram e-mails sem material.' },
  { nome: 'Press kit básico', custo: 0, h: 6, mult: 0.8, desc: 'Logo, 5 capturas, descrição curta e contato.' },
  { nome: 'Press kit completo', custo: 300, h: 12, mult: 1.1, desc: 'Trailer, GIFs, fotos do dev, fact sheet e build jogável.' },
  { nome: 'Press kit profissional', custo: 1500, h: 6, mult: 1.4, desc: 'Feito por freelancer de design e comunicação.' },
];
export const AGENCIES = [
  { id: 'freela', nome: 'Freela de imprensa', semanal: 600, minSem: 4, mult: 1.25, fans: 50, desc: 'Um profissional manda seus e-mails e organiza contatos.' },
  { id: 'pixelpr', nome: 'Assessoria Pixel PR', semanal: 1800, minSem: 8, mult: 1.6, fans: 400, desc: 'Agência pequena especializada em indies; ajuda em crises.' },
  { id: 'bigpress', nome: 'Agência BigPress', semanal: 6000, minSem: 12, mult: 2.0, fans: 2500, desc: 'Abre portas nos grandes veículos. Caríssima.' },
];

// ---------------------------------------------------------------- press kit
export function kitBlock(s, level) {
  const p = ensurePress(s); const soc = ensureSoc(s);
  if (level <= p.kit.level) return 'você já tem esse nível';
  if (level > p.kit.level + 1) return 'faça o nível anterior primeiro';
  const k = KIT_LEVELS[level];
  if (level >= 2 && !(s.project || s.games.length)) return 'precisa de um jogo para montar o kit';
  if (soc.hours + k.h > WEEK_HOURS) return 'sem horas na semana';
  if (s.money < Math.round(k.custo * api.infl(s))) return 'sem dinheiro';
  return null;
}
export function makeKit(s, level) {
  const err = kitBlock(s, level); if (err) return err;
  const p = ensurePress(s); const soc = ensureSoc(s); const k = KIT_LEVELS[level];
  if (k.custo) api.spend(s, 'marketing', Math.round(k.custo * api.infl(s)));
  soc.hours += k.h; s.employees[0].energy = clamp(s.employees[0].energy - k.h * 0.6, 5, 100);
  p.kit = { level, w: s.week };
  return null;
}

// ---------------------------------------------------------------- envio
export const PITCH_KINDS = {
  preview: { nome: 'Enviar build para preview', h: 1, need: 'proj', desc: 'Prévia jogável antes do lançamento. Gera hype.' },
  review: { nome: 'Enviar cópia de review', h: 0.5, need: 'proj', desc: 'Chave para review no lançamento. Com embargo, todas saem juntas.' },
  entrevista: { nome: 'Propor entrevista', h: 1, need: 'fans', desc: 'Conte sua história de dev. Escolha o tom.' },
  estudio: { nome: 'Propor matéria sobre o estúdio', h: 1, need: 'fans', desc: 'Pauta: a vida do estúdio indie.' },
};
function hasProj(s) { const p = s.project; return !!(p && (p.phase >= 2 || p.stage === 'result' || p.weeks >= 3)); }
export function pitchBlock(s, outletId, kind) {
  const p = ensurePress(s); const soc = ensureSoc(s); const k = PITCH_KINDS[kind]; const o = OUTLET_BY_ID[outletId];
  if (!k || !o) return 'inválido';
  if (p.kit.level < 1 && (kind === 'preview' || kind === 'review')) return 'monte um press kit primeiro';
  if (k.need === 'proj' && !hasProj(s)) return 'precisa de um projeto jogável (fase 2+)';
  if (k.need === 'fans' && s.fans < 40 && s.games.length === 0) return 'ainda é cedo: precisa de ~40 fãs ou um jogo lançado';
  if (p.pitches.some((x) => x.outlet === outletId && x.status === 'pendente')) return 'já há um e-mail pendente para este veículo';
  if (kind === 'review' && p.copies[outletId]) return 'cópia já enviada';
  if (soc.hours + k.h > WEEK_HOURS) return 'sem horas na semana';
  return null;
}
export function pitchChance(s, o, kind) {
  const p = ensurePress(s);
  const rel = (p.rel[o.id] || 0) / 100;
  const size = 1 / (1 + Math.pow(o.alcance, 1.6) / (1.2 + s.fans / 400 + totalFollowers(s) / 1500 + rel * 3 + (s.games.length ? 0.8 : 0)));
  const q = s.project ? clamp((s.project.d + s.project.t) / s.project.total, 0.1, 1) : s.games.length ? clamp(s.games[s.games.length - 1].score / 10, 0.2, 1) : 0.3;
  const genre = s.project ? o.gosta.includes(s.project.genre) : s.games.length ? o.gosta.includes(s.games[s.games.length - 1].genre) : false;
  const kit = KIT_LEVELS[p.kit.level].mult;
  const ag = p.agency ? AGENCIES.find((a) => a.id === p.agency.id).mult : 1;
  const base = { preview: 0.9, review: 1.0, entrevista: 0.7, estudio: 0.6 }[kind] || 0.6;
  return clamp(base * size * 1.6 * (0.55 + q * 0.6) * (genre ? 1.3 : 1) * kit * ag, 0.02, 0.92);
}
export function sendPitch(s, outletId, kind, opts = {}) {
  const err = pitchBlock(s, outletId, kind); if (err) return err;
  const p = ensurePress(s); const soc = ensureSoc(s); const o = OUTLET_BY_ID[outletId]; const k = PITCH_KINDS[kind];
  soc.hours += k.h;
  const game = s.project?.name || s.games[s.games.length - 1]?.name || s.studio.nome;
  p.pitches.push({ id: p.nid++, outlet: outletId, kind, w: s.week, due: s.week + rint(s, 1, 3), game, embargo: !!opts.embargo, tone: opts.tone || 'humilde', status: 'pendente', pc: pitchChance(s, o, kind) });
  return null;
}

// ---------------------------------------------------------------- manchetes dinâmicas
const HL = {
  preview: {
    positivo: ['Jogamos {jogo}: o {genero} indie que queremos ver pronto', '{jogo} impressiona nas primeiras horas', 'Preview: {jogo} tem personalidade de sobra'],
    misto: ['{jogo}: boas ideias, execução ainda irregular', 'Preview de {jogo}: promissor, mas precisa de polimento'],
    negativo: ['{jogo} ainda está longe do ponto: preview preocupa', 'Jogamos {jogo} e saímos com mais perguntas que respostas'],
  },
  review: {
    positivo: ['{jogo}: um achado indie que merece sua atenção', 'Review: {jogo} é diversão pura', '{jogo} prova que {estudio} sabe o que faz', 'O melhor {genero} que você vai jogar este mês'],
    misto: ['{jogo}: bom, mas não tão bom quanto poderia', 'Review: {jogo} acerta em partes', '{jogo} divide opiniões'],
    negativo: ['{jogo} decepciona e tropeça nos próprios bugs', 'Review: {jogo} não consegue ficar de pé', 'Dá para pular {jogo}'],
  },
  entrevista: {
    humilde: ['“Só queria terminar um jogo”: papo com o dev de {estudio}', 'Conversamos com o criador de {jogo}'],
    ambicioso: ['“Vamos ser gigantes”: o plano ambicioso de {estudio}', '{estudio} quer disputar com os grandes'],
    polêmico: ['Dev de {estudio} critica a indústria: “está tudo errado”', '“Os grandes estúdios têm medo de arriscar”, diz criador de {jogo}'],
  },
  estudio: ['Como {estudio} nasceu num quarto e quer chegar longe', 'Perfil: {estudio}, o estúdio que você precisa conhecer', 'De dev solo a promessa: a história de {estudio}'],
  noticia: ['{jogo} chama atenção na comunidade', '{estudio} anuncia novidades para {jogo}'],
};
function fill(t, v) { return t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? ''); }
export function makeHeadline(s, kind, tone, v) {
  const set = HL[kind]; const list = Array.isArray(set) ? set : set[tone] || Object.values(set)[0];
  return fill(pick(s, list), { estudio: s.studio.nome, ...v });
}
const toneOf = (nota) => (nota >= 7 ? 'positivo' : nota >= 5 ? 'misto' : 'negativo');
const gname = (id) => (D.GENRES.find((g) => g.id === id)?.nome || 'jogo').toLowerCase();

function addArticle(s, a) {
  const p = ensurePress(s);
  a.id = p.nid++; a.w = s.week; p.articles.unshift(a); if (p.articles.length > 40) p.articles.pop();
  headline(s, `${OUTLET_BY_ID[a.outlet]?.nome || 'Imprensa'}: ${a.titulo}`, 'imprensa');
  return a;
}
function articleEffect(s, o, tone, kind, mult = 1) {
  const soc = ensureSoc(s); const p = ensurePress(s);
  const aud = [0, 1200, 4500, 14000, 40000, 90000][o.alcance] * mult;
  const m = tone === 'positivo' ? 1 : tone === 'misto' ? 0.45 : 0.12;
  const reach = Math.round(aud * m * (0.7 + rnd(s) * 0.6));
  soc.wl += reach * 0.0035; soc.totals.organic += reach;
  const fans = reach * 0.002; s.fans += fans; attribFans(s, s.project?.genre || s.games[s.games.length - 1]?.genre, fans);
  if (s.project) s.project.hype = clamp(s.project.hype + (reach / 4000) * (tone === 'negativo' ? -0.4 : 1), 0, 100);
  for (const n of ['tuiter', 'instagrao']) soc.nets[n].fol += reach * 0.0015 / 2;
  p.rel[o.id] = clamp((p.rel[o.id] || 0) + (tone === 'negativo' ? 2 : 8), 0, 100);
  return reach;
}

// ---------------------------------------------------------------- semana
export function tickPress(s, evs) {
  const p = ensurePress(s);
  // assessoria
  if (p.agency) { const ag = AGENCIES.find((a) => a.id === p.agency.id); const c = Math.round(ag.semanal * api.infl(s)); if (s.money >= c) { api.spend(s, 'assessoria', c); p.agencyPaid += c; } else { p.agency = null; evs.push({ type: 'news', txt: 'A assessoria encerrou o contrato por falta de pagamento.' }); } }
  for (const x of p.pitches) {
    if (x.status !== 'pendente' || s.week < x.due) continue;
    const o = OUTLET_BY_ID[x.outlet];
    if (!chance(s, x.pc)) { x.status = 'recusado'; p.rel[o.id] = clamp((p.rel[o.id] || 0) - 1, 0, 100); evs.push({ type: 'news', txt: `${o.nome} não respondeu ao seu e-mail (${PITCH_KINDS[x.kind].nome.toLowerCase()}).` }); continue; }
    x.status = 'aceito';
    if (x.kind === 'review') { p.copies[x.outlet] = { embargo: x.embargo, w: s.week, game: x.game }; evs.push({ type: 'news', txt: `${o.nome} aceitou receber a cópia de review.` }); continue; }
    const g = s.project || s.games[s.games.length - 1];
    const q = s.project ? clamp(((s.project.d + s.project.t) / s.project.total) * 8.5 - s.project.bugs * 0.07 + 1, 1, 10) : (g?.score ?? 5);
    const nota = clamp(Math.round((q + o.vies + gauss(s) * 0.5) * 2) / 2, 1, 10);
    const jogo = x.game;
    if (x.kind === 'preview') {
      const tone = toneOf(nota);
      const reach = articleEffect(s, o, tone, 'preview');
      addArticle(s, { outlet: o.id, kind: 'preview', tom: tone, titulo: makeHeadline(s, 'preview', tone, { jogo, genero: gname(g?.genre) }), jogo, reach });
      evs.push({ type: 'press', outlet: o.nome, kind: 'preview', tone, reach });
    } else if (x.kind === 'entrevista') {
      const tone = x.tone;
      const reach = articleEffect(s, o, tone === 'polêmico' ? 'positivo' : 'positivo', 'entrevista', tone === 'polêmico' ? 1.6 : tone === 'ambicioso' ? 1.2 : 1);
      if (tone === 'ambicioso' && s.project) s.project.hype = clamp(s.project.hype + 3, 0, 100);
      addArticle(s, { outlet: o.id, kind: 'entrevista', tom: tone, titulo: makeHeadline(s, 'entrevista', tone, { jogo }), jogo, reach });
      if (tone === 'polêmico' && chance(s, 0.28)) startCrisis(s, 'polemica');
      evs.push({ type: 'press', outlet: o.nome, kind: 'entrevista', tone, reach });
    } else if (x.kind === 'estudio') {
      const reach = articleEffect(s, o, 'positivo', 'estudio', 0.8);
      addArticle(s, { outlet: o.id, kind: 'estudio', tom: 'positivo', titulo: makeHeadline(s, 'estudio', 'positivo', { jogo }), jogo, reach });
      p.lastStudio = s.week;
      evs.push({ type: 'press', outlet: o.nome, kind: 'estudio', tone: 'positivo', reach });
    }
  }
  p.pitches = p.pitches.filter((x) => x.status === 'pendente' || s.week - x.due < 10);
  if ((s.fans > 150 || s.games.length) && chance(s, 0.02)) { const o = pick(s, C.OUTLETS.filter((x) => x.alcance <= 3)); genDM(s, 'jornalista', { net: 'tuiter', from: o.nome, txt: `Olá! Sou repórter do(a) ${o.nome}. Adoramos o seu estúdio — que tal conversarmos? (veja a aba Imprensa)` }); }
  // matéria espontânea sobre o estúdio: marcos
  if (s.week - p.lastStudio > 40 && (s.fans > 600 || s.games.length >= 3) && chance(s, 0.03)) {
    const o = pick(s, C.OUTLETS.filter((x) => x.alcance <= 3));
    const reach = articleEffect(s, o, 'positivo', 'estudio', 0.8);
    addArticle(s, { outlet: o.id, kind: 'estudio', tom: 'positivo', titulo: makeHeadline(s, 'estudio', 'positivo', { jogo: s.games[s.games.length - 1]?.name || '' }), jogo: '', reach });
    p.lastStudio = s.week; evs.push({ type: 'press', outlet: o.nome, kind: 'estudio', tone: 'positivo', reach, spontaneous: true });
  }
}

// ---------------------------------------------------------------- lançamento
/** Gera as reviews da imprensa. Devolve o multiplicador de vendas e as notas. */
export function reviewsAtRelease(s, g, score) {
  const p = ensurePress(s); const out = []; let boost = 0; let embargoCount = 0;
  const outlets = new Set(Object.keys(p.copies));
  // veículos pequenos cobrem por conta própria se a nota é boa e há fãs
  for (const o of C.OUTLETS) if (!outlets.has(o.id) && o.alcance <= 2 && (score >= 7 || chance(s, 0.15)) && chance(s, 0.35 + s.fans / 6000)) outlets.add(o.id);
  for (const id of outlets) {
    const o = OUTLET_BY_ID[id]; const copy = p.copies[id];
    let nota = score + o.vies + gauss(s) * o.rigor * 0.5 + (o.gosta.includes(g.genre) ? 0.35 : 0) - (g.bugs > 8 ? 0.6 : 0);
    nota = clamp(Math.round(nota * 2) / 2, 1, 10);
    const tone = toneOf(nota);
    const embargo = !!copy?.embargo;
    if (embargo) embargoCount++;
    const aud = [0, 1200, 4500, 14000, 40000, 90000][o.alcance] * (copy ? 1 : 0.5);
    const reach = Math.round(aud * (nota >= 7 ? 1 : nota >= 5 ? 0.5 : 0.25) * (0.8 + rnd(s) * 0.4) * (embargo ? 1.15 : 1));
    boost += o.alcance * (nota - 5.5) * 0.012 * (12 / C.OUTLETS.length);
    const a = addArticle(s, { outlet: id, kind: 'review', tom: tone, nota, titulo: makeHeadline(s, 'review', tone, { jogo: g.name, genero: gname(g.genre) }), jogo: g.name, reach, embargo });
    out.push(a);
    p.rel[id] = clamp((p.rel[id] || 0) + (nota >= 6 ? 10 : -4), 0, 100);
  }
  p.copies = {};
  boost = clamp(boost + embargoCount * 0.01, -0.25, 0.9);
  return { mult: 1 + boost, articles: out };
}

// ---------------------------------------------------------------- assessoria
export function agencyBlock(s, id) {
  const p = ensurePress(s); const a = AGENCIES.find((x) => x.id === id);
  if (!a) return 'inválido';
  if (p.agency) return 'você já tem uma assessoria';
  if (s.fans < a.fans) return `precisa de ${a.fans}+ fãs`;
  if (s.money < a.semanal * api.infl(s) * 4) return 'precisa de caixa para pelo menos 4 semanas';
  return null;
}
export function hireAgency(s, id) {
  const err = agencyBlock(s, id); if (err) return err;
  ensurePress(s).agency = { id, since: s.week };
  headline(s, `${s.studio.nome} contrata ${AGENCIES.find((a) => a.id === id).nome}.`, 'imprensa');
  return null;
}
export function cancelAgency(s) {
  const p = ensurePress(s); if (!p.agency) return 'sem assessoria';
  const a = AGENCIES.find((x) => x.id === p.agency.id);
  if (s.week - p.agency.since < a.minSem) return `contrato mínimo de ${a.minSem} semanas (faltam ${a.minSem - (s.week - p.agency.since)})`;
  p.agency = null; return null;
}
