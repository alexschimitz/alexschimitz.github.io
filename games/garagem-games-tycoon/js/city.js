// Mapa da cidade fictícia de "São Pixelo": bairros (aluguel e vantagens), lugares, viagens (tempo + dinheiro), efeitos e mudança de endereço.
// Lógica pura, sem DOM. O jogo é 2D isométrico (não 3D).
import { OFFICES } from './data.js';
import { clamp, chance, rnd, WEATHER, weatherOf } from './util.js';
import * as SO from './social.js';
import * as W from './world.js';
import * as IND from './indie.js';
import * as C from './catalog.js';

export const WEEK_HOURS = 40;
export const CITY_W = 14, CITY_H = 14;
export const BLOCK = 4; // quarteirões 4x4 separados por ruas de 1 tile (x/y = 4, 9)

export const DISTRICTS = {
  vila: { id: 'vila', nome: 'Vila Pixel', ico: '🏘️', rent: 1.0, bx: 0, by: 1, lot: [1, 6], cor: '#8fc98a', perk: 'Bairro padrão: aluguel justo e rua tranquila.', short: 'padrão' },
  centro: { id: 'centro', nome: 'Centro', ico: '🏙️', rent: 1.6, bx: 1, by: 1, lot: [5, 7], cor: '#c9b28f', perk: 'Aluguel caro, mas imprensa e publishers rendem +50% nas visitas.', short: 'caro · imprensa' },
  tech: { id: 'tech', nome: 'Polo Bit', ico: '💻', rent: 1.3, bx: 2, by: 0, lot: [11, 2], cor: '#8fb3c9', perk: 'Distrito tech: networking (café, cowork, convenções) rende +50%.', short: 'networking' },
  campus: { id: 'campus', nome: 'Campus', ico: '🎓', rent: 1.1, bx: 2, by: 1, lot: [11, 5], cor: '#c9a0c0', perk: 'Cursos presenciais 20% mais baratos.', short: 'cursos −20%' },
  porto: { id: 'porto', nome: 'Porto Velho', ico: '⚓', rent: 0.65, bx: 0, by: 0, lot: [2, 2], cor: '#b8b0a0', perk: 'Aluguel baratíssimo e peças de PC 15% mais baratas, mas longe de quase tudo.', short: 'barato · peças' },
};
/** Bloco (4x4 tiles) -> bairro. */
export const BLOCK_DISTRICT = [['porto', 'centro', 'tech'], ['vila', 'centro', 'campus'], ['vila', 'tech', 'campus']];

export const PLACES = [
  { id: 'home', nome: 'Sua sede', ico: '🏠', x: 0, y: 0, w: 2, d: 2, h: 40, color: '#e8523c', desc: 'O seu estúdio. Descanse ou mude de endereço.' },
  { id: 'cowork', nome: 'Cowork Bit&Byte', ico: '🪑', x: 6, y: 10, w: 2, d: 2, h: 56, color: '#4aa3a0', desc: 'Mesa compartilhada, café à vontade e gente interessante.' },
  { id: 'uni', nome: 'Escola Técnica do Campus', ico: '🎓', x: 10, y: 7, w: 3, d: 2, h: 66, color: '#b0704c', desc: 'Cursos presenciais de programação, arte, som e design.' },
  { id: 'shop', nome: 'InfoMax Informática', ico: '🖥️', x: 0, y: 0, w: 2, d: 2, h: 44, color: '#3b82c4', desc: 'Peças e upgrades para os PCs do estúdio.' },
  { id: 'bank', nome: 'Banco Pixel', ico: '🏦', x: 5, y: 1, w: 2, d: 2, h: 70, color: '#6b7a8f', desc: 'Empréstimos para atravessar a seca (com juros).' },
  { id: 'convention', nome: 'Centro de Convenções', ico: '🎪', x: 5, y: 5, w: 3, d: 2, h: 52, color: '#8a5cc2', desc: 'Feiras e eventos de games. Fãs, hype e contatos.' },
  { id: 'publisher', nome: 'Escritório da Publisher', ico: '📑', x: 10, y: 0, w: 2, d: 2, h: 96, color: '#2f3b52', desc: 'Reunião com publishers: melhora as ofertas de contrato.' },
  { id: 'cafe', nome: 'Café Bit', ico: '☕', x: 2, y: 5, w: 1, d: 1, h: 30, color: '#a8774a', desc: 'Networking de mesa de bar: conhecidos, indicações e fãs.' },
  { id: 'gamestore', nome: 'Loja Game Over', ico: '🎮', x: 8, y: 5, w: 1, d: 2, h: 34, color: '#d94a8c', desc: 'Pesquisa de mercado: veja o que o público está comprando.' },
  { id: 'press', nome: 'Agência de Imprensa Tinta&Pixel', ico: '📰', x: 7, y: 1, w: 1, d: 2, h: 60, color: '#d9a21e', desc: 'Conheça jornalistas: buzz e manchetes.' },
  { id: 'park', nome: 'Praça das Tartarugas', ico: '🌳', x: 2, y: 10, w: 2, d: 2, h: 8, color: '#44bb66', desc: 'Respirar, caminhar e voltar com a cabeça fresca.' },
];
export const PLACE_BY_ID = Object.fromEntries(PLACES.map((p) => [p.id, p]));
export const SKILLS = { d: 'Game design', t: 'Programação', g: 'Arte', s: 'Som', q: 'Testes', r: 'Pesquisa' };

export function newCity() { return { home: 'vila', visits: 0, parts: 0, loan: 0, pubRel: 0, contacts: 0, cd: {}, buffs: [], moves: 0, lastMove: -99, log: [], people: [], events: [], evSeen: {}, stand: 0 }; }

// ---------------------------------------------------------------- pessoas (NPCs nomeados) e eventos presenciais
export const ROLES_NPC = {
  mentor: { nome: 'Mentor(a)', ico: '🧠', perk: 'Com relação 3+: +3% de Design e Tecnologia (+5% com 5). Conversar rende experiência.' },
  socio: { nome: 'Possível sócio(a)', ico: '🤝', perk: 'Com relação 3+ dá para convidar como sócio(a) (modo indie).' },
  publisher: { nome: 'Contato de publisher', ico: '📑', perk: 'Cada conversa melhora o relacionamento com publishers.' },
  investidor: { nome: 'Investidor(a)', ico: '💼', perk: 'Com relação 3+: limite de crédito +30% e juros menores.' },
  talento: { nome: 'Caça-talentos', ico: '🔎', perk: 'Indica candidatos a contratação.' },
  imprensa: { nome: 'Jornalista', ico: '📰', perk: 'Cada conversa rende buzz de imprensa.' },
};
export const NPCS = [
  { id: 'marta', nome: 'Profa. Marta Bits', papel: 'mentor', where: ['uni', 'cafe'], skill: 't', desc: 'Professora aposentada de computação que já viu três gerações de devs.' },
  { id: 'orlando', nome: 'Seu Orlando Fliperama', papel: 'mentor', where: ['cowork', 'gamestore'], skill: 'd', desc: 'Dono de fliperama dos anos 80: sabe o que faz um jogo ser divertido.' },
  { id: 'helena', nome: 'Dra. Helena Shader', papel: 'mentor', where: ['uni', 'convention'], skill: 'g', desc: 'Pesquisadora de computação gráfica. Fala rápido e acerta sempre.' },
  { id: 'caio', nome: 'Caio Pipeline', papel: 'mentor', where: ['cowork', 'cafe'], skill: 't', desc: 'Engenheiro sênior que adora revisar o código dos outros.' },
  { id: 'bia', nome: 'Bia Sprites', papel: 'socio', where: ['cafe', 'cowork', 'convention'], role: 'artista', desc: 'Artista pixel-art apaixonada por jogos pequenos e bem-acabados.' },
  { id: 'leo', nome: 'Léo Compilador', papel: 'socio', where: ['cowork', 'uni'], role: 'programador', desc: 'Programador de motor que já sobreviveu a dois estúdios.' },
  { id: 'nina', nome: 'Nina Foley', papel: 'socio', where: ['convention', 'cafe'], role: 'sonoplasta', desc: 'Compositora e sound designer que grava efeitos na cozinha.' },
  { id: 'rogerio', nome: 'Rogério Varejão', papel: 'publisher', where: ['publisher', 'convention'], desc: 'Produtor da Pixelaria Publishing: gosta de números e de café forte.' },
  { id: 'carol', nome: 'Carol Marketeira', papel: 'publisher', where: ['publisher', 'cafe'], desc: 'Cuida do marketing de lançamentos na Fase 8 Games.' },
  { id: 'tadeu', nome: 'Tadeu Capital', papel: 'investidor', where: ['bank', 'convention'], desc: 'Investidor-anjo que só aposta em quem entrega.' },
  { id: 'vera', nome: 'Vera Venture', papel: 'investidor', where: ['bank', 'cowork'], desc: 'Investe em estúdios pequenos com muita personalidade.' },
  { id: 'jorge', nome: 'Jorge Recrutador', papel: 'talento', where: ['cafe', 'uni'], desc: 'Conhece todo mundo que sabe programar na cidade.' },
  { id: 'duda', nome: 'Duda Manchete', papel: 'imprensa', where: ['press', 'convention'], desc: 'Repórter de games do Tinta&Pixel: sempre atrás de uma boa história.' },
  { id: 'lia', nome: 'Lia Stream', papel: 'imprensa', where: ['cafe', 'gamestore'], desc: 'Streamer local com uma comunidade pequena e muito leal.' },
];
export const NPC_BY_ID = Object.fromEntries(NPCS.map((n) => [n.id, n]));
export const EVENT_KINDS = {
  meetup: { nome: 'Meetup de Devs', ico: '👥', place: ['cafe', 'cowork'], every: 3, off: 1, dur: 1, cost: 25, hours: 3, desc: 'Noite de lightning talks e cerveja sem álcool. Bom para conhecer gente.' },
  palestra: { nome: 'Palestra aberta', ico: '🎤', place: ['uni'], every: 4, off: 2, dur: 1, cost: 20, hours: 3, desc: 'Um profissional do mercado fala de produção, arte ou código.' },
  jam: { nome: 'Game jam presencial', ico: '⚡', place: ['cowork'], every: 8, off: 5, dur: 2, cost: 60, hours: 12, desc: 'Fim de semana criando um protótipo com desconhecidos.' },
  mixer: { nome: 'Happy hour de devs', ico: '🍻', place: ['cafe'], every: 5, off: 0, dur: 1, cost: 50, hours: 4, desc: 'Mesa grande, conversa solta e contatos de verdade.' },
};
export function eventsNow(s) { const c = ensureCity(s); return c.events.filter((e) => e.until >= s.week); }
export function eventsAt(s, pid) { const c = ensureCity(s); return eventsNow(s).filter((e) => e.place === pid && !c.evSeen[e.id]); }
function spawnEvents(s) {
  const c = ensureCity(s); c.events = c.events.filter((e) => e.until >= s.week);
  const live = new Set(c.events.map((e) => e.id)); for (const k of Object.keys(c.evSeen)) if (!live.has(k)) delete c.evSeen[k];
  for (const [kind, K] of Object.entries(EVENT_KINDS)) {
    if ((s.week + 2) % K.every !== K.off % K.every) continue; if (c.events.some((e) => e.kind === kind)) continue;
    const place = K.place[Math.floor(s.week / K.every) % K.place.length];
    c.events.push({ id: kind + ':' + s.week, kind, place, until: s.week + K.dur - 1 });
  }
}
/** Conhece alguém novo (NPC nomeado) em um lugar. Retorna o NPC ou null. */
export function meetNpc(s, place, p = 0.5) {
  const c = ensureCity(s); const known = new Set(c.people.map((q) => q.id));
  const pool = NPCS.filter((n) => !known.has(n.id) && n.where.includes(place) && !(n.papel === 'socio' && s.mode !== 'indie' && false));
  if (!pool.length || !chance(s, Math.min(0.95, p * net(s)))) return null;
  const n = pool[Math.floor(rnd(s) * pool.length)]; c.people.push({ id: n.id, rel: 1, met: s.week, last: -99 });
  api.log(s, `Você conheceu ${n.nome} (${ROLES_NPC[n.papel].nome}).`, 'bom'); return n;
}
export function personInfo(s, id) { const c = ensureCity(s); return c.people.find((q) => q.id === id); }
const relOf = (s, papel) => (ensureCity(s).people.filter((q) => NPC_BY_ID[q.id]?.papel === papel));

/** Clima visual da semana (só estética): sol, nuvens, chuva ou neblina — determinístico por semana. */
export { WEATHER, weatherOf };
export function ensureCity(s) { s.city ??= newCity(); for (const k of Object.keys(newCity())) s.city[k] ??= newCity()[k]; return s.city; }

let api = { spend: () => {}, earn: () => {}, log: () => {}, infl: () => 1 };
export function bind(a) { api = a; }

export const district = (s) => DISTRICTS[ensureCity(s).home] || DISTRICTS.vila;
export const rentMult = (s) => (s.city ? (DISTRICTS[s.city.home] || DISTRICTS.vila).rent : 1);
export function mult(s) {
  const c = s.city; if (!c) return { prod: 1, tech: 1, design: 1 };
  let prod = 1; for (const b of c.buffs) if (b.k === 'prod') prod *= b.mult;
  let ds = 0; for (const q of c.people || []) if (NPC_BY_ID[q.id]?.papel === 'mentor' && q.rel >= 3) ds += q.rel >= 5 ? 0.05 : 0.03;
  ds = Math.min(0.1, ds);
  return { prod, tech: (1 + 0.025 * Math.min(5, c.parts || 0)) * (1 + ds), design: 1 + ds };
}
const hoursLeft = (s) => WEEK_HOURS - SO.ensureSoc(s).hours;
const fnd = (s) => s.employees.find((e) => e.founder) || s.employees[0];

/** Posição da sede (tile central do lote do bairro). */
export function homePos(s) { const d = district(s); return d.lot; }
export function placeCenter(s, id) { if (id === 'home') { const [x, y] = homePos(s); return [x + 1, y + 1]; } const p = PLACE_BY_ID[id]; return [p.x + p.w / 2, p.y + p.d / 2]; }
export function dist(s, id) { const [hx, hy] = homePos(s); const [x, y] = placeCenter(s, id); return id === 'home' ? 0 : Math.abs(x - (hx + 1)) + Math.abs(y - (hy + 1)); }
export function travelInfo(s, id) {
  const d = dist(s, id); const i = api.infl(s);
  return { dist: d, hours: id === 'home' ? 0 : Math.max(1, Math.round((0.5 + d * 0.35) * 2) / 2), cost: id === 'home' ? 0 : Math.round(d * 3.5 * Math.sqrt(i) / 5) * 5 };
}
const net = (s) => (district(s).id === 'tech' ? 1.5 : 1);
const press = (s) => (district(s).id === 'centro' ? 1.5 : 1);

/** Ações disponíveis num lugar (com custo, horas, bloqueio). */
export function actions(s, pid) {
  const c = ensureCity(s); const i = api.infl(s); const out = []; const wk = s.week;
  const add = (id, label, desc, cost, hours, cd = 0, block = null) => {
    const cdLeft = (c.cd[pid + ':' + id] || 0) - wk; out.push({ id, label, desc, cost: Math.round(cost), hours, cd, block: block || (cdLeft > 0 ? `volte em ${cdLeft} semana(s)` : null) });
  };
  const kn = (k) => c.people.filter((q) => NPC_BY_ID[q.id]?.papel === k);
  for (const e of eventsAt(s, pid)) { const K = EVENT_KINDS[e.kind]; add('ev:' + e.kind, `${K.ico} ${K.nome}`, K.desc, K.cost * i, K.hours, 0); }
  for (const q of c.people) {
    const n = NPC_BY_ID[q.id]; if (!n || !(n.where.includes(pid) || (['cafe', 'cowork'].includes(pid) && q.rel >= 2))) continue;
    const left = (q.last ?? -99) >= wk ? 1 : 0;
    add('chat:' + n.id, `${ROLES_NPC[n.papel].ico} Conversar com ${n.nome}`, `${n.desc} Relação ${'♥'.repeat(q.rel)}${'♡'.repeat(5 - q.rel)}.`, 30 * i, 2, 0, q.rel >= 5 && n.papel !== 'socio' ? 'relação no máximo' : left > 0 ? 'já conversaram nesta semana' : null);
    if (n.papel === 'socio' && s.mode === 'indie' && q.rel >= 3) add('partner:' + n.id, `🤝 Convidar ${n.nome} para sócio(a)`, 'Vira sócio(a): 20% do lucro dos jogos, sem salário.', 0, 4, 0, IND.partnerBlock(s));
  }
  if (pid === 'home') {
    add('rest', 'Descansar em casa', 'Todo mundo recupera energia (+15). Sem custo de viagem.', 0, 6, 1);
  } else if (pid === 'cowork') {
    add('daypass', 'Semana de cowork', 'Ambiente novo: +6% de produção por 2 semanas, 2 contatos e um respiro.', 140 * i, 12, 2);
    add('plan', 'Plano mensal de mesa fixa', 'Trabalhar no cowork: +8% de produção por 4 semanas e contatos toda semana.', 420 * i, 8, 4, c.buffs.some((b) => b.nome === 'Mesa fixa') ? 'plano em andamento' : null);
  } else if (pid === 'uni') {
    const campus = district(s).id === 'campus' ? 0.8 : 1;
    const emps = s.employees.filter((e) => !e.training);
    for (const k of Object.keys(SKILLS)) {
      if (s.mode === 'indie' && !['d', 't', 'g', 's'].includes(k)) continue;
      const lv = Math.min(...emps.map((e) => e.skills[k] ?? 20), 20);
      add('course:' + k, `Curso: ${SKILLS[k]}`, s.mode === 'indie' ? 'Aula presencial intensiva: muita experiência de uma vez.' : 'Um funcionário volta 1 semana depois com +1 nesta habilidade.', (900 + 250 * (s.mode === 'indie' ? (fnd(s).skills[k] || 1) : lv)) * i * campus, 14, 1, lv >= 20 && s.mode !== 'indie' ? 'todos já estão no máximo' : null);
    }
  } else if (pid === 'shop') {
    const porto = district(s).id === 'porto' ? 0.85 : 1;
    add('parts', 'Peças e upgrades de PC', `+2,5% de Tecnologia (permanente). Você tem ${c.parts}/5.`, 1800 * (1 + 0.35 * c.parts) * i * porto, 3, 0, c.parts >= 5 ? 'PCs já estão no talo' : null);
  } else if (pid === 'bank') {
    const lim = loanLimit(s);
    add('loan', `Empréstimo de R$ ${Math.round(lim / 2000)} mil`, 'Metade do limite de crédito. Juros de 0,45% por semana.', 0, 2, 4, c.loan > 0 ? 'quite o atual antes' : null);
    add('loanmax', `Empréstimo máximo (R$ ${Math.round(lim / 1000)} mil)`, 'Todo o limite de crédito. Juros de 0,45% por semana.', 0, 2, 4, c.loan > 0 ? 'quite o atual antes' : null);
    add('repay', `Quitar dívida (${c.loan ? Math.round(c.loan).toLocaleString('pt-BR') : '0'})`, 'Paga tudo de uma vez.', c.loan, 1, 0, c.loan <= 0 ? 'você não deve nada' : (s.money < c.loan ? 'sem dinheiro' : null));
  } else if (pid === 'convention') {
    const open = C.FAIRS.filter((f) => W.fairOpen(s, f.id));
    for (const f of open) {
      add('fair:' + f.id, f.nome, f.desc, W.fairCost(s, f), 14, 0);
      const has = s.project || s.games.length; const blk = has ? null : 'precisa de um jogo (em produção ou lançado)';
      add('fairstand:' + f.id, `${f.nome}: estande com demo`, 'Monte um estande jogável: mais hype, wishlists e fãs que o visitante comum.', W.fairCost(s, f) * 1.8, 22, 0, blk);
      add('fairpitch:' + f.id, `${f.nome}: pitch para publishers`, 'Visita + reuniões rápidas: sobe o relacionamento com publishers (chance maior com um jogo bom).', W.fairCost(s, f) * 1.2, 18, 0, blk);
    }
    if (!open.length) add('browse', 'Passear pelos estandes', 'Sem feira este mês, mas ainda dá para trocar cartões.', 40 * i, 4, 3);
  } else if (pid === 'publisher') {
    add('meet', 'Reunião com a publisher', c.pubRel ? `Relacionamento ${c.pubRel}/5. Ofertas melhores a cada reunião.` : 'Mostre seu portfólio e melhore as ofertas de contrato.', 0, 6, 4, s.games.length || s.project ? null : 'faça ou lance um jogo antes');
  } else if (pid === 'cafe') {
    add('workday', 'Trabalhar no café', 'Um dia de notebook e café: +4% de produção por 1 semana, humor melhor.', 18 * i, 6, 1);
    add('network', 'Bater papo e networking', 'Conhecidos, indicações e uma chance de achar um talento novo.', 45 * i, 3, 1);
  } else if (pid === 'gamestore') {
    add('research', 'Pesquisa de mercado', '+8 de pesquisa e um panorama de tendências e vendas.', 30 * i, 3, 2);
  } else if (pid === 'press') {
    add('visit', 'Visitar a agência', 'Buzz de imprensa e fãs, com jornalistas amigos.', 120 * i, 4, 3);
  } else if (pid === 'park') {
    add('relax', 'Caminhar na praça', 'Cabeça fria: energia +25 para você e mais fôlego.', 0, 5, 1);
  }
  return out;
}

/** Executa uma ação (viagem + efeito). Retorna { err } ou { msg }. */
export function act(s, pid, aid, arg = {}) {
  const c = ensureCity(s); const pl = PLACE_BY_ID[pid]; if (!pl) return { err: 'lugar inexistente' };
  const ac = actions(s, pid).find((a) => a.id === aid); if (!ac) return { err: 'ação indisponível' };
  if (ac.block) return { err: ac.block };
  const tr = travelInfo(s, pid); const hrs = tr.hours + ac.hours; const cost = tr.cost + ac.cost;
  if (aid !== 'repay' && aid !== 'loan' && aid !== 'loanmax' && s.money < cost) return { err: 'sem dinheiro' };
  if (hoursLeft(s) < hrs) return { err: `faltam horas na semana (precisa de ${hrs}h, restam ${Math.max(0, hoursLeft(s)).toFixed(0)}h)` };
  const f = fnd(s); if (f.energy < 8 + hrs * 0.4) return { err: 'você está exausto: descanse antes de sair' };
  if (aid.startsWith('course:') && !arg.emp && s.mode !== 'indie') return { err: 'escolha quem vai' };
  const e = RUN[aid.split(':')[0]]; if (!e) return { err: 'ação inválida' };
  const r = e(s, aid.split(':')[1], arg, ac); if (r.err) return r;
  if (tr.cost) api.spend(s, 'viagens', tr.cost);
  SO.ensureSoc(s).hours += hrs; f.energy = clamp(f.energy - hrs * 0.4 + (r.energy || 0), 5, 100);
  c.visits++; if (ac.cd) c.cd[pid + ':' + aid] = s.week + ac.cd;
  const msg = (tr.cost || tr.hours ? `(${tr.hours}h e R$ ${tr.cost} de viagem) ` : '') + r.msg;
  c.log.unshift({ w: s.week, t: `${pl.nome}: ${r.msg}` }); c.log.length = Math.min(c.log.length, 12);
  api.log(s, `${pl.ico} ${pl.nome}: ${r.msg}`, 'bom');
  return { msg, ...r };
}

const spendM = (s, cat, v) => { if (v > 0) api.spend(s, cat, v); };
const PLACE_OF_EVENT = (s, kind) => EVENT_KINDS[kind]?.place.find((pl) => eventsAt(s, pl).some((e) => e.kind === kind)) || EVENT_KINDS[kind]?.place[0];
const RUN = {
  ev(s, kind) {
    const c = ensureCity(s); const e = eventsAt(s, PLACE_OF_EVENT(s, kind)).find((x) => x.kind === kind) || eventsNow(s).find((x) => x.kind === kind); if (!e) return { err: 'o evento já acabou' };
    c.evSeen[e.id] = true; const K = EVENT_KINDS[kind]; const f = fnd(s); let msg = '';
    if (kind === 'meetup') { const n = Math.round(2 * net(s)); c.contacts += n; const fan = 6 + Math.round(s.fans * 0.004); s.fans += fan; const npc = meetNpc(s, e.place, 0.6); msg = `${n} contato(s), +${fan} fãs.${npc ? ` Conheceu ${npc.nome}!` : ''}`; }
    else if (kind === 'palestra') {
      if (s.mode === 'indie') { const sk = ['d', 't', 'g', 's'][Math.floor(rnd(s) * 4)]; const up = IND.addXp(s, sk, 7); msg = `aprendeu sobre ${SKILLS[sk]}${up ? ' e subiu de nível!' : '.'}`; } else { s.research.rp += 6; msg = '+6 de pesquisa com as ideias da palestra.'; }
      const npc = meetNpc(s, e.place, 0.35); if (npc) msg += ` Conheceu ${npc.nome}!`;
    } else if (kind === 'jam') {
      c.buffs.push({ k: 'prod', mult: 1.05, left: 2, nome: 'Jam' }); c.contacts += Math.round(3 * net(s)); const fan = 12 + Math.round(s.fans * 0.006); s.fans += fan;
      if (s.mode === 'indie') { IND.addXp(s, 'd', 5); IND.addXp(s, 't', 5); } else s.research.rp += 8;
      const npc = meetNpc(s, e.place, 0.65); msg = `protótipo feito em dupla com estranhos: +5% de produção por 2 semanas, +${fan} fãs.${npc ? ` Conheceu ${npc.nome}!` : ''}`;
    } else if (kind === 'mixer') { c.contacts += Math.round(3 * net(s)); const npc = meetNpc(s, e.place, 0.8); const npc2 = meetNpc(s, e.place, 0.3); for (const x of s.employees) x.energy = clamp(x.energy + 4, 5, 100); msg = `muita conversa boa.${npc ? ` Conheceu ${npc.nome}!` : ''}${npc2 ? ` E ${npc2.nome}!` : ''}`; }
    void f; return { msg, energy: 2 };
  },
  chat(s, id, _, ac) {
    const c = ensureCity(s); const n = NPC_BY_ID[id]; const q = personInfo(s, id); if (!n || !q) return { err: 'contato inexistente' };
    spendM(s, 'networking', ac.cost); q.last = s.week; const was = q.rel; q.rel = Math.min(5, q.rel + 1); let extra = '';
    if (n.papel === 'mentor') { if (s.mode === 'indie') { const up = IND.addXp(s, n.skill, 6 + q.rel); extra = ` Aprendeu de ${SKILLS[n.skill]}${up ? ': subiu de nível!' : '.'}`; } else { s.research.rp += 4; extra = ' +4 de pesquisa.'; } }
    else if (n.papel === 'publisher') { c.pubRel = Math.min(5, c.pubRel + 0.5); extra = ' O relacionamento com publishers melhorou.'; }
    else if (n.papel === 'talento') { refer(s); extra = ' Ele indicou um candidato (veja Equipe).'; }
    else if (n.papel === 'imprensa') { W.ensure(s); s.world.buzz = clamp(s.world.buzz + 2, 0, 30); extra = ' +2 de buzz.'; }
    else if (n.papel === 'investidor') extra = q.rel >= 3 ? ' Crédito mais fácil no banco.' : '';
    return { msg: `conversa com ${n.nome}: relação ${q.rel}/5${q.rel > was ? ' (subiu!)' : ''}.${extra}`, energy: 1 };
  },
  partner(s, id) {
    const n = NPC_BY_ID[id]; const q = personInfo(s, id); if (!n || !q || q.rel < 3) return { err: 'relação insuficiente' };
    const cand = api.candidate?.(s, n.role); if (!cand) return { err: 'indisponível' };
    cand.name = n.nome; cand.id = 'c' + s.nextId++; s.candidates.push(cand); const e = IND.hirePartner(s, cand.id);
    if (e) { s.candidates = s.candidates.filter((x) => x.id !== cand.id); return { err: e }; }
    ensureCity(s).people = ensureCity(s).people.filter((x) => x.id !== id); return { msg: `${n.nome} agora é sócio(a) do estúdio!`, energy: 0 };
  },
  workday(s, _, __, ac) { spendM(s, 'cafés', ac.cost); const c = ensureCity(s); c.buffs.push({ k: 'prod', mult: 1.04, left: 1, nome: 'Café' }); const npc = meetNpc(s, 'cafe', 0.2); for (const e of s.employees) e.energy = clamp(e.energy + 2, 5, 100); return { msg: `+4% de produção por 1 semana.${npc ? ` Puxou papo com ${npc.nome}.` : ''}`, energy: 2 }; },
  plan(s, _, __, ac) { spendM(s, 'cowork', ac.cost); const c = ensureCity(s); c.buffs.push({ k: 'prod', mult: 1.08, left: 4, nome: 'Mesa fixa' }); c.contacts += 1; const npc = meetNpc(s, 'cowork', 0.5); return { msg: `+8% de produção por 4 semanas.${npc ? ` Conheceu ${npc.nome}!` : ''}`, energy: 3 }; },
  fairstand(s, id, _, ac) {
    const r = W.attendFair(s, id); if (typeof r === 'string') return { err: r }; const c = ensureCity(s); c.stand++; c.contacts += Math.round(3 * net(s));
    const soc = SO.ensureSoc(s); const wl = Math.round(40 + s.fans * 0.25); soc.wl += wl; if (s.project) s.project.hype = clamp((s.project.hype || 0) + 8, 0, 100); const f = 20 + Math.round(s.fans * 0.01); s.fans += f;
    spendM(s, 'eventos', Math.round(ac.cost - W.fairCost(s, C.FAIRS.find((x) => x.id === id)))); const npc = meetNpc(s, 'convention', 0.7);
    return { msg: `estande lotado: ${r.msg} +${wl} wishlists, +8 de hype, +${f} fãs.${npc ? ` Conheceu ${npc.nome}!` : ''}`, energy: -5 };
  },
  fairpitch(s, id, _, ac) {
    const r = W.attendFair(s, id); if (typeof r === 'string') return { err: r }; const c = ensureCity(s);
    spendM(s, 'eventos', Math.round(ac.cost - W.fairCost(s, C.FAIRS.find((x) => x.id === id))));
    const q = clamp(s.project ? (s.project.d + s.project.t) / Math.max(1, s.project.total) : 0.5, 0, 1); const ok = chance(s, 0.35 + 0.35 * q + 0.05 * c.pubRel);
    if (ok) { c.pubRel = Math.min(5, c.pubRel + 1.5); const npc = meetNpc(s, 'publisher', 0.8); return { msg: `o pitch convenceu: relacionamento com publishers ${c.pubRel.toFixed(1).replace('.0', '')}/5.${npc ? ` Conheceu ${npc.nome}!` : ''}`, energy: -4 }; }
    c.pubRel = Math.min(5, c.pubRel + 0.5); return { msg: 'o pitch foi educado, mas sem fechar nada. Ainda assim, +0,5 de relacionamento.', energy: -4 };
  },
  rest(s) { for (const e of s.employees) e.energy = clamp(e.energy + 15, 5, 100); if (s.ind) s.ind.mental = clamp((s.ind.mental ?? 50) + 2, 0, 100); return { msg: 'a equipe recarregou as baterias (+15 de energia).' }; },
  daypass(s, _, __, ac) {
    spendM(s, 'cowork', ac.cost); const c = ensureCity(s); c.buffs.push({ k: 'prod', mult: 1.06, left: 2, nome: 'Cowork' });
    const n = Math.round(2 * net(s)); c.contacts += n; return { msg: `+6% de produção por 2 semanas e ${n} novos contatos.`, energy: 4 };
  },
  course(s, skill, arg, ac) {
    if (s.mode === 'indie') { spendM(s, 'cursos', ac.cost); const up = IND.addXp(s, skill, 9 + (fnd(s).skills[skill] || 1) * 0.4); return { msg: `aula intensiva de ${SKILLS[skill]}${up ? ': subiu de nível!' : ': muito aprendizado.'}`, energy: -2 }; }
    const e = s.employees.find((x) => x.id === arg.emp); if (!e || e.training) return { err: 'funcionário indisponível' };
    if ((e.skills[skill] ?? 20) >= 20) return { err: 'habilidade máxima' };
    spendM(s, 'treinamento', ac.cost); e.training = { left: 1, skill };
    if (s.project) s.project.team = s.project.team.filter((x) => x !== e.id);
    return { msg: `${e.name} fez o curso de ${SKILLS[skill]} (volta em 1 semana).` };
  },
  parts(s, _, __, ac) { spendM(s, 'equipamento', ac.cost); const c = ensureCity(s); c.parts++; return { msg: `PCs mais rápidos: +2,5% de Tecnologia (${c.parts}/5).` }; },
  loan(s, _, __, ac) { const lim = loanLimit(s); return doLoan(s, Math.round(lim / 2 / 1000) * 1000); },
  loanmax(s) { const lim = loanLimit(s); return doLoan(s, lim); },
  repay(s, _, __, ac) { const c = ensureCity(s); const v = c.loan; spendM(s, 'dívida', v); c.loan = 0; return { msg: `dívida de R$ ${Math.round(v).toLocaleString('pt-BR')} quitada.` }; },
  fair(s, id) { const r = W.attendFair(s, id); if (typeof r === 'string') return { err: r }; ensureCity(s).contacts += Math.round(2 * net(s)); return { msg: r.msg + ' (você esteve lá de verdade!)', energy: -3 }; },
  browse(s, _, __, ac) { spendM(s, 'eventos', ac.cost); const n = Math.round(1 * net(s)); ensureCity(s).contacts += n; const f = 6 + Math.round(s.fans * 0.01); s.fans += f; return { msg: `${n} cartão(ões) trocado(s) e +${f} fãs.` }; },
  meet(s) {
    const c = ensureCity(s); c.pubRel = Math.min(5, c.pubRel + (press(s) > 1 ? 1.5 : 1)); let extra = '';
    if (s.project) { s.project.hype = clamp((s.project.hype || 0) + Math.round(4 * press(s)), 0, 100); extra = ' O projeto ganhou hype.'; }
    if (s.mode !== 'indie' && s.games.length) { const v = Math.round(600 * api.infl(s) * press(s)); api.earn(s, v); extra += ` A publisher pagou R$ ${v} de adiantamento por um merchan.`; }
    return { msg: `relacionamento ${c.pubRel.toFixed(1).replace('.0', '')}/5 com as publishers.${extra}` };
  },
  network(s, _, __, ac) {
    spendM(s, 'networking', ac.cost); const c = ensureCity(s); const n = Math.round(1 * net(s)); c.contacts += n; const f = 3 + Math.round(s.fans * 0.004); s.fans += f;
    let extra = ''; if (chance(s, 0.3 * net(s)) && s.candidates.length < 7) { extra = ' Alguém indicou um talento (veja Equipe).'; refer(s); }
    for (const e of s.employees) e.energy = clamp(e.energy + 3, 5, 100);
    return { msg: `+${n} contato(s), +${f} fãs.${extra}`, energy: 2 };
  },
  research(s, _, __, ac) {
    spendM(s, 'pesquisa de mercado', ac.cost); s.research.rp += 8; W.ensure(s);
    const t = W.trendLabel(s.world.trend); return { msg: `+8 de pesquisa. ${t || 'Sem tendência forte no momento.'}` };
  },
  visit(s, _, __, ac) {
    spendM(s, 'imprensa', ac.cost); W.ensure(s); const b = Math.round(3 * press(s)); s.world.buzz = clamp(s.world.buzz + b, 0, 30); const f = 8 + Math.round(s.fans * 0.015 * press(s)); s.fans += f;
    W.headline(s, `${s.studio.nome} bateu papo com a imprensa de São Pixelo.`, 'estudio'); return { msg: `+${b} de buzz e +${f} fãs.` };
  },
  relax(s) { const f = fnd(s); f.energy = clamp(f.energy + 25, 5, 100); if (s.ind) s.ind.mental = clamp((s.ind.mental ?? 50) + 4, 0, 100); return { msg: 'passeio tranquilo: energia e cabeça renovadas.', energy: 0 }; },
};
function doLoan(s, v) {
  const c = ensureCity(s); c.loan += v; s.money += v; s.stats.loans = (s.stats.loans || 0) + 1;
  return { msg: `crédito de R$ ${v.toLocaleString('pt-BR')} liberado. Juros de 0,45% por semana.` };
}
function refer(s) {
  const roles = ['programador', 'designer', 'artista', 'sonoplasta', 'testador'];
  const before = s.candidates.length;
  // usa o gerador do sim via callback ligado em bind()
  if (api.candidate) { const c = api.candidate(s, roles[(s.week + s.candidates.length) % roles.length]); if (c) { c.fee = Math.round(c.fee * 0.8); c.ref = true; s.candidates.push(c); } }
  return s.candidates.length > before;
}

// ---------------------------------------------------------------- mudança de endereço
export function moveCost(s, did) {
  const d = DISTRICTS[did]; const rent = OFFICES[s.office].aluguel * d.rent;
  return Math.round((900 + 5 * rent) * api.infl(s) / 100) * 100;
}
export function moveBlock(s, did) {
  const c = ensureCity(s); if (!DISTRICTS[did]) return 'bairro inexistente'; if (c.home === did) return 'a sede já fica aqui';
  if (s.week - c.lastMove < 8) return `mudou há pouco: espere ${8 - (s.week - c.lastMove)} semana(s)`;
  if (s.money < moveCost(s, did)) return 'sem dinheiro para a mudança';
  if (hoursLeft(s) < 16) return 'faltam horas na semana (a mudança leva 16h)';
  return null;
}
export function moveTo(s, did) {
  const e = moveBlock(s, did); if (e) return e; const c = ensureCity(s); const cost = moveCost(s, did);
  api.spend(s, 'mudança de bairro', cost); SO.ensureSoc(s).hours += 16; c.home = did; c.moves++; c.lastMove = s.week;
  api.log(s, `Mudança de endereço: agora em ${DISTRICTS[did].nome}.`, 'bom'); return null;
}

// ---------------------------------------------------------------- semanal
export function tick(s, evs) {
  const c = s.city; if (!c) return;
  for (const b of c.buffs) b.left--; c.buffs = c.buffs.filter((b) => b.left > 0);
  spawnEvents(s);
  if (c.loan > 0) { const j = c.loan * (investorOk(s) ? 0.0035 : 0.0045); api.spend(s, 'juros', j); }
  if (s.week % 26 === 0 && c.pubRel > 0) c.pubRel = Math.max(0, c.pubRel - 1);
}
/** Ajuste do relacionamento com publishers para ofertas (usado por indie.publisherOffers). */
export const pubRel = (s) => Math.min(5, s.city?.pubRel || 0);
export function loanLimit(s) { return Math.round((30000 + 25000 * s.office) * api.infl(s) * (investorOk(s) ? 1.3 : 1) / 1000) * 1000; }
export const investorOk = (s) => (s.city?.people || []).some((q) => NPC_BY_ID[q.id]?.papel === 'investidor' && q.rel >= 3);
