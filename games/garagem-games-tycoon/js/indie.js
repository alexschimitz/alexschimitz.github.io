// Modo "Indie de verdade" (v0.4): dev solo, vida, ferramentas, cursos, lojas, wishlists, publisher, crowdfunding.
// Números baseados em docs/pesquisa-indie.md. Sem DOM; tudo em s.ind (JSON puro).
import * as D from './data.js';
import * as S from './score.js';
import * as C from './catalog.js';
import * as W from './world.js';
import * as SO from './social.js';
import { rnd, rint, pick, chance, clamp, gauss } from './util.js';

let api;
export function bind(a) { api = a; }

export const START_MONEY = 9000;
export const STEAN_FEE = 550;          // "Steam Direct" ≈ US$100
export const STEAN_REFUND_AT = 5500;   // recuperável a partir de ≈ US$1.000
export const WEEK_HOURS = 40;

// ---------------------------------------------------------------- dados
export const HOUSING = {
  pais: { nome: 'Casa dos pais', sem: 190, mental: 0.6, desc: 'Comida, internet e transporte. Pouca privacidade, muito fôlego.' },
  republica: { nome: 'República', sem: 340, mental: 0.2, desc: 'Divide o aluguel; barulho às vezes atrapalha.' },
  kitnet: { nome: 'Kitnet própria', sem: 520, mental: 0.0, desc: 'Aluguel, luz, internet e mercado. Liberdade com boleto.' },
};
export const JOBS = {
  none: { nome: 'Só gamedev', sem: 0, mult: 1, mental: 0, desc: 'Todo o tempo no jogo. O caixa só desce.' },
  meio: { nome: 'Emprego meio período', sem: 215, mult: 0.62, mental: -0.8, desc: 'Cobre parte da vida; sobra ~60% do tempo.' },
  clt: { nome: 'Emprego CLT integral', sem: 540, mult: 0.28, mental: -1.8, desc: 'Renda segura; jogo só à noite e no fim de semana.' },
};
export const GEAR = [
  { id: 'ram', nome: 'Mais memória RAM', custo: 380, pc: 0.04, desc: 'Menos travadas na engine.' },
  { id: 'ssd', nome: 'SSD NVMe', custo: 320, pc: 0.04, desc: 'Compila e abre projetos muito mais rápido.' },
  { id: 'gpu', nome: 'Placa de vídeo dedicada', custo: 1900, pc: 0.07, gpu: 1, contas: 6, desc: 'Necessária para 3D pesado. Aumenta a conta de luz.' },
  { id: 'monitor', nome: 'Monitor grande / segundo monitor', custo: 850, pc: 0.03, art: 0.03, desc: 'Mais espaço para trabalhar.' },
  { id: 'tablet', nome: 'Mesa digitalizadora', custo: 650, art: 0.06, desc: 'Arte e animação ficam bem melhores.' },
  { id: 'cadeira', nome: 'Cadeira ergonômica', custo: 900, mental: 0.5, desc: 'Costas agradecem: saúde mental melhor.' },
  { id: 'notebook', nome: 'Notebook novo (troca o PC velho)', custo: 4800, pc: 0.22, desc: 'Máquina decente e portátil. Substitui o PC bege.' },
];
export const TOOLS = [
  { id: 'godotto', cat: 'engine', nome: 'Godotto Engine', lvl: 2, custo: 0, sem: 0, free: true, desc: 'Motor livre e leve (paródia de Godot). Ótimo para 2D.' },
  { id: 'unitay', cat: 'engine', nome: 'Unitay Pessoal', lvl: 3, custo: 0, sem: 0, free: true, desc: 'Motor popular (paródia de Unity): grátis para quem fatura pouco.' },
  { id: 'unitaypro', cat: 'engine', nome: 'Unitay Pro', lvl: 5, custo: 0, sem: 38, sub: true, desc: 'Assinatura semanal. Mais recursos e menos limites.' },
  { id: 'unrealis', cat: 'engine', nome: 'Unrealis Engine', lvl: 7, custo: 0, sem: 0, royalty: 0.05, gpu: true, desc: 'Visual de ponta. Grátis, mas 5% de royalties sobre a receita. Exige placa de vídeo.' },
  { id: 'pixelita', cat: 'arte', nome: 'Pixelita (pixel art)', lvl: 1, custo: 0, sem: 0, free: true, desc: 'Editor de pixel art gratuito.' },
  { id: 'pixelmestre', cat: 'arte', nome: 'PixelMestre Pro', lvl: 2, custo: 90, sem: 0, desc: 'Editor pago de pixel art e animação (paródia de Aseprite).' },
  { id: 'blendr', cat: 'arte', nome: 'Blendr 3D', lvl: 3, custo: 0, sem: 0, free: true, gpu: true, desc: 'Modelagem 3D livre (paródia de Blender). Fica lento sem placa de vídeo.' },
  { id: 'mayo3d', cat: 'arte', nome: 'Mayo 3D Studio', lvl: 5, custo: 0, sem: 30, sub: true, gpu: true, desc: 'Suíte 3D profissional por assinatura (paródia de Maya).' },
  { id: 'audaciti', cat: 'som', nome: 'Audaciti (áudio)', lvl: 1, custo: 0, sem: 0, free: true, desc: 'Editor de áudio gratuito.' },
  { id: 'reapera', cat: 'som', nome: 'Reapera (DAW)', lvl: 2, custo: 250, sem: 0, desc: 'DAW barata e poderosa (paródia de Reaper).' },
  { id: 'fruitloop', cat: 'som', nome: 'Fruit Loopz Studio', lvl: 3, custo: 800, sem: 0, desc: 'DAW para compor trilhas de verdade (paródia de FL Studio).' },
];
export const TOOL_BY_ID = Object.fromEntries(TOOLS.map((t) => [t.id, t]));
export const SKILL_NAMES = { t: 'Programação', d: 'Game design', g: 'Arte (2D/3D)', s: 'Som e música', m: 'Marketing', n: 'Negócios' };
const LINES = [
  { id: 't', skill: 't', nome: 'programação de jogos' },
  { id: 'd', skill: 'd', nome: 'game design' },
  { id: 'g2', skill: 'g', nome: 'pixel art e 2D', tool: 'pixelita' },
  { id: 'g3', skill: 'g', nome: 'modelagem 3D', tool: 'blendr' },
  { id: 's', skill: 's', nome: 'áudio e música', tool: 'audaciti' },
  { id: 'm', skill: 'm', nome: 'marketing e comunidade' },
  { id: 'n', skill: 'n', nome: 'negócios e finanças indie' },
];
const KINDS = {
  tutorial: { nome: 'Tutorial grátis no YouTobe', h: 6, custo: 0, xp: 3, en: 4, cd: 1 },
  livro: { nome: 'Livro', h: 10, custo: 70, xp: 8, en: 4, once: true },
  curso: { nome: 'Curso online pago', h: 16, custo: 350, xp: 16, en: 8, cd: 10 },
  mentoria: { nome: 'Mentoria com dev sênior', h: 4, custo: 450, xp: 12, en: 3, cd: 4 },
};
export const COURSES = LINES.flatMap((l) => Object.entries(KINDS).map(([k, v]) => ({ id: `${k}_${l.id}`, line: l.id, skill: l.skill, tool: l.tool, tipo: k, nome: `${v.nome}: ${l.nome}`, ...v })));
export const COURSE_BY_ID = Object.fromEntries(COURSES.map((c) => [c.id, c]));
export const xpNeed = (lv) => Math.round(10 + 2.5 * lv);

export const PUBS = [
  { id: 'devolvedor', nome: 'Devolvedor Digital', gosta: ['acao', 'tiro', 'roguelike'], adv: 1.0, mkt: 1.5, share: 0.42, desc: 'Publisher irreverente, aposta em jogos esquisitos e divertidos.' },
  { id: 'furiacrua', nome: 'Fúria Crua', gosta: ['aventura', 'narrativo', 'plataforma', 'puzzle'], adv: 0.85, mkt: 1.35, share: 0.40, desc: 'Publisher de autor. Cuida bem de jogos pequenos e bonitos.' },
  { id: 'anapuna', nome: 'Anapuna Interativo', gosta: ['narrativo', 'aventura', 'casual', 'simulacao'], adv: 1.25, mkt: 1.7, share: 0.50, desc: 'Publisher prestigiado e exigente; adianta mais, leva mais.' },
];
const SIZEPRICE = { micro: 8, pequeno: 18, medio: 30, grande: 45, aaa: 65 };
const SIZEMULT = { micro: 0.45, pequeno: 1, medio: 2.3, grande: 5.5, aaa: 12 };

// ---------------------------------------------------------------- estado
export function newIndie() {
  return {
    mental: 80, burn: 0, housing: 'pais', job: 'none', sleep: 'normal',
    gear: {}, owned: { godotto: true, pixelita: true, audaciti: true }, subs: {},
    xp: { t: 0, d: 0, g: 0, s: 0, m: 0, n: 0 }, once: {}, cd: {},
    offers: [], freelaTotal: 0, jobTotal: 0, owed: 0, rep: 0, nid: 1,
    stats: { courses: 0, freela: 0, burnouts: 0, spentLearn: 0 },
  };
}
export const isIndie = (s) => s.mode === 'indie';
export function ensureInd(s) { s.ind ??= newIndie(); return s.ind; }
const fnd = (s) => s.employees[0];

// ---------------------------------------------------------------- vida e custos semanais
export function pcBase(s) { return 0.78 + GEAR.reduce((a, g) => a + (s.ind.gear[g.id] ? (g.pc || 0) : 0), 0); }
export function hasGpu(s) { return !!s.ind.gear.gpu; }
/** Inflação da vida: aluguel/mercado sobem ~5% ao ano; o salário do emprego sobe só ~2,5% (o custo de vida corrói a poupança). */
export const lifeInfl = (s) => 1 + 0.05 * (Math.floor((s.week || 0) / 48));
export const jobPay = (s, id = s.ind.job) => Math.round(JOBS[id].sem * (1 + 0.025 * Math.floor((s.week || 0) / 48)));
export function livingCost(s) {
  const I = s.ind; const k = lifeInfl(s); const contas = Math.round(22 * k) + GEAR.reduce((a, g) => a + (I.gear[g.id] ? (g.contas || 0) : 0), 0);
  const subs = TOOLS.reduce((a, t) => a + (t.sub && I.owned[t.id] ? t.sem : 0), 0);
  const mor = Math.round(HOUSING[I.housing].sem * k * (1 + 0.06 * (I.rentBump || 0))); return { moradia: mor, contas, ferramentas: subs, total: mor + contas + subs };
}
export function founderMult(s) {
  const I = s.ind; if (I.burn > 0) return 0.08;
  const ment = 0.6 + 0.4 * (I.mental / 100);
  return pcBase(s) * JOBS[I.job].mult * ment * (I.sleep === 'madruga' ? 1.15 : 1);
}
const addHours = (s, h) => { SO.ensureSoc(s).hours += h; };
const hoursLeft = (s) => WEEK_HOURS - SO.ensureSoc(s).hours;
function timeBlock(s, h, en = 0) {
  if (s.ind.burn > 0) return 'você está em burnout: descanse algumas semanas';
  if (hoursLeft(s) < h) return `faltam horas na semana (${hoursLeft(s).toFixed(0)}h livres)`;
  if (fnd(s).energy < en + 5) return 'você está sem energia';
  return null;
}
export function setHousing(s, id) {
  if (!HOUSING[id]) return 'inválido';
  if (id === 'kitnet' && s.money < 1500) return 'precisa de ao menos R$ 1.500 de reserva para alugar';
  s.ind.housing = id; return null;
}
export function setJob(s, id) {
  if (!JOBS[id]) return 'inválido';
  s.ind.job = id; return null;
}
export function setSleep(s, id) { s.ind.sleep = id; return null; }
export const REST = {
  fimdesemana: { nome: 'Fim de semana off', h: 14, custo: 0, en: 22, mental: 8 },
  amigos: { nome: 'Sair com os amigos', h: 6, custo: 40, en: 6, mental: 5 },
  exercicio: { nome: 'Exercício / caminhada', h: 4, custo: 0, en: 6, mental: 3 },
  terapia: { nome: 'Terapia', h: 2, custo: 160, en: 0, mental: 11 },
};
export function rest(s, id) {
  const r = REST[id]; if (!r) return 'inválido';
  const I = s.ind;
  if (hoursLeft(s) < r.h) return 'faltam horas na semana';
  if (s.money < r.custo) return 'sem dinheiro';
  if (r.custo) api.spend(s, 'vida', r.custo);
  addHours(s, r.h); const e = fnd(s); e.energy = clamp(e.energy + r.en, 5, 100);
  I.mental = clamp(I.mental + r.mental, 0, 100);
  return null;
}
export function buyGear(s, id) {
  const g = GEAR.find((x) => x.id === id); if (!g) return 'inválido';
  if (s.ind.gear[id]) return 'você já tem isso';
  if (s.money < g.custo) return 'sem dinheiro';
  api.spend(s, 'equipamento', g.custo); s.ind.gear[id] = true; return null;
}
export function buyTool(s, id) {
  const t = TOOL_BY_ID[id]; if (!t) return 'inválido';
  const I = s.ind; if (I.owned[id]) return 'você já tem';
  if (t.gpu && !hasGpu(s) && id === 'unrealis') return 'precisa de placa de vídeo dedicada';
  if (s.money < t.custo) return 'sem dinheiro';
  if (t.custo) api.spend(s, 'software', t.custo);
  I.owned[id] = true; return null;
}
export function dropTool(s, id) { const t = TOOL_BY_ID[id]; if (!t?.sub) return 'só assinaturas podem ser canceladas'; delete s.ind.owned[id]; return null; }
export function toolLevel(s, cat) {
  const I = s.ind; let best = 0;
  for (const t of TOOLS) if (t.cat === cat && I.owned[t.id]) {
    let l = t.lvl; if (t.gpu && !hasGpu(s)) l = Math.max(1, l - 1);
    best = Math.max(best, l);
  }
  return Math.max(1, best);
}
/** Nível de engine é limitado pela habilidade de programação. */
export function engineLvl(s) { return Math.max(1, Math.min(toolLevel(s, 'engine'), 1 + Math.floor((fnd(s).skills.t || 0) / 2.5))); }
export const artBonus = (s) => 1 + GEAR.reduce((a, g) => a + (s.ind.gear[g.id] ? (g.art || 0) : 0), 0);
export const gfxLvl = (s) => toolLevel(s, 'arte');
export const sndLvl = (s) => toolLevel(s, 'som');
export const royalty = (s) => (s.ind.owned.unrealis ? 0.05 : 0);
export function toolName(s, cat, lvl) {
  const cand = TOOLS.filter((t) => t.cat === cat && s.ind.owned[t.id]).sort((a, b) => b.lvl - a.lvl);
  return (cand.find((t) => t.lvl <= lvl) || cand[cand.length - 1] || TOOLS.find((t) => t.cat === cat)).nome;
}

// ---------------------------------------------------------------- aprendizado
export function courseBlock(s, id) {
  const c = COURSE_BY_ID[id]; if (!c) return 'inválido';
  const I = s.ind; const sk = fnd(s).skills[c.skill] ?? 1;
  if (sk >= 20) return 'habilidade já no máximo';
  if (c.tool && !I.owned[c.tool]) return `instale a ferramenta: ${TOOL_BY_ID[c.tool].nome}`;
  if (c.once && I.once[id]) return 'você já leu esse livro';
  if ((I.cd[id] || 0) > s.week) return `disponível em ${I.cd[id] - s.week} semana(s)`;
  if (s.money < c.custo) return 'sem dinheiro';
  return timeBlock(s, c.h, c.en);
}
export function takeCourse(s, id) {
  const err = courseBlock(s, id); if (err) return err;
  const c = COURSE_BY_ID[id]; const I = s.ind; const e = fnd(s);
  if (c.custo) api.spend(s, 'cursos', c.custo);
  I.stats.spentLearn += c.custo; I.stats.courses++;
  addHours(s, c.h); e.energy = clamp(e.energy - c.en, 5, 100);
  if (c.once) I.once[id] = true;
  if (c.cd) I.cd[id] = s.week + c.cd;
  return { up: addXp(s, c.skill, c.xp * (1 - (e.skills[c.skill] ?? 1) / 26)) };
}
export function addXp(s, skill, xp) {
  const I = s.ind; const e = fnd(s); let up = 0;
  I.xp[skill] = (I.xp[skill] || 0) + xp;
  while ((e.skills[skill] ?? 1) < 20 && I.xp[skill] >= xpNeed(e.skills[skill] ?? 1)) {
    I.xp[skill] -= xpNeed(e.skills[skill] ?? 1); e.skills[skill] = (e.skills[skill] ?? 1) + 1; up++;
  }
  return up;
}

// ---------------------------------------------------------------- freela
const FREELA_KINDS = [
  { id: 'site', nome: 'Site para loja de bairro', skill: 't', base: 330 },
  { id: 'logo', nome: 'Logo e arte para um cliente', skill: 'g', base: 280 },
  { id: 'trilha', nome: 'Trilha para vídeo institucional', skill: 's', base: 260 },
  { id: 'bico', nome: 'Bico de gamedev (protótipo de cliente)', skill: 'd', base: 380 },
  { id: 'social', nome: 'Gestão de redes de um restaurante', skill: 'm', base: 300 },
];
function genOffers(s) {
  const I = s.ind; const e = fnd(s);
  const n = chance(s, 0.75) ? rint(s, 1, 3) : 0; I.offers = [];
  for (let i = 0; i < n; i++) {
    const k = pick(s, FREELA_KINDS); const sk = e.skills[k.skill] ?? 1;
    if (sk < 3) continue;
    const pay = Math.round(k.base * (0.55 + sk / 12) * (1 + 0.03 * (e.skills.n || 1)) * (0.85 + rnd(s) * 0.3) / 10) * 10;
    I.offers.push({ id: I.nid++, nome: k.nome, skill: k.skill, pay, h: rint(s, 10, 18) });
  }
}
export function takeFreela(s, id) {
  const I = s.ind; const o = I.offers.find((x) => x.id === id); if (!o) return 'oferta indisponível';
  const err = timeBlock(s, o.h, 8); if (err) return err;
  I.offers = I.offers.filter((x) => x.id !== id);
  addHours(s, o.h); fnd(s).energy = clamp(fnd(s).energy - 8, 5, 100); I.mental = clamp(I.mental - 1.5, 0, 100);
  api.earn(s, o.pay); I.freelaTotal += o.pay; I.stats.freela++;
  addXp(s, o.skill, 1.2);
  return null;
}

// ---------------------------------------------------------------- projeto: escopo, vertical slice, playtest, freelancers, página, demo
export function projInd(p) { p.ind ??= { pt: {}, cut: false, slice: false, page: null, demo: false, fest: false, crowd: null, freelas: {}, trailer: false }; return p.ind; }
export function cutScope(s) {
  const p = s.project; if (!p) return 'sem projeto'; const pi = projInd(p);
  if (pi.cut) return 'você já cortou o escopo'; if (p.stage !== 'dev' && p.stage !== 'config') return 'indisponível agora';
  p.total = Math.round(p.total * 0.85); p.dTarget *= 0.85; p.tTarget *= 0.85; pi.cut = true;
  fnd(s).energy = clamp(fnd(s).energy + 4, 5, 100); s.ind.mental = clamp(s.ind.mental + 3, 0, 100);
  return null;
}
export function playtest(s, kind) {
  const p = s.project; if (!p) return 'sem projeto'; const pi = projInd(p);
  const k = { amigos: { nome: 'amigos e família', h: 3, custo: 0, bug: 0.8 }, online: { nome: 'playtest online', h: 2, custo: 150, bug: 0.62 } }[kind];
  if (!k) return 'inválido';
  if (p.phase < 2 && projectProg(p) < 0.25) return 'precisa de algo jogável (fase 2+)';
  const key = `${kind}${p.phase}`; if (pi.pt[key]) return 'já fez esse playtest nesta fase';
  const err = timeBlock(s, k.h, 2); if (err) return err; if (s.money < k.custo) return 'sem dinheiro';
  if (k.custo) api.spend(s, 'playtest', Math.round(k.custo * api.infl(s)));
  addHours(s, k.h); pi.pt[key] = true; p.bugs = Math.max(0, p.bugs * k.bug);
  p.hype = clamp(p.hype + 1.5, 0, 100);
  const dr = p.dTarget ? p.d / p.dTarget : 0, tr = p.tTarget ? p.t / p.tTarget : 0;
  addXp(s, 'd', 1.5);
  return { msg: `Playtest com ${k.nome}: ${dr < tr - 0.15 ? 'falta conteúdo/design' : tr < dr - 0.15 ? 'tem muita coisa quebrada' : 'o jogo está equilibrado'}; bugs caíram.` };
}
export const projectProg = (p) => clamp((p.d + p.t) / p.total, 0, 1);
export function verticalSlice(s) {
  const p = s.project; if (!p) return 'sem projeto'; const pi = projInd(p);
  if (pi.slice) return 'já tem vertical slice';
  const pr = projectProg(p); if (pr < 0.3) return 'precisa de ≥30% do projeto'; if (pr > 0.8) return 'tarde demais: só faz sentido antes de 80%';
  const err = timeBlock(s, 10, 8); if (err) return err;
  addHours(s, 10); fnd(s).energy = clamp(fnd(s).energy - 8, 5, 100); pi.slice = true;
  p.hype = clamp(p.hype + 4, 0, 100); SO.ensureSoc(s).wl += 12 + s.fans * 0.15;
  addXp(s, 'd', 3);
  return null;
}
export const FREELAS = {
  arte: { nome: 'Artista freelancer', custo: 1200, art: 0.09, desc: 'Sprites/modelos de um profissional contratado só para este jogo.' },
  trilha: { nome: 'Compositor(a) freelancer', custo: 800, snd: 0.07, desc: 'Trilha e efeitos sonoros sob encomenda.' },
  qa: { nome: 'Testador(a) freelancer', custo: 500, bug: 0.6, desc: 'Procura bugs por uma semana.' },
};
export function hireFreela(s, id) {
  const p = s.project; if (!p) return 'sem projeto'; const f = FREELAS[id]; const pi = projInd(p);
  if (!f) return 'inválido'; if (pi.freelas[id]) return 'já contratado para este jogo';
  const c = Math.round(f.custo * api.infl(s) / 10) * 10; if (s.money < c) return 'sem dinheiro';
  api.spend(s, 'freelancers', c); pi.freelas[id] = true;
  if (f.art) p.art += p.total * f.art; if (f.snd) p.snd += p.total * f.snd; if (f.bug) p.bugs *= f.bug;
  p.costs.outros += c; return null;
}
export function pageBlock(s) {
  const p = s.project; if (!p) return 'sem projeto'; const pi = projInd(p);
  if (pi.page) return 'a página já existe';
  if (p.phase < 2 && projectProg(p) < 0.3) return 'monte a página quando tiver algo para mostrar (≥30%)';
  const err = timeBlock(s, 8, 4); if (err) return err;
  if (s.money < STEAN_FEE) return `a taxa de publicação é ${STEAN_FEE} reais`;
  return null;
}
export function makePage(s) {
  const err = pageBlock(s); if (err) return err;
  const p = s.project; const pi = projInd(p); const soc = SO.ensureSoc(s);
  api.spend(s, 'taxa Stean', STEAN_FEE); addHours(s, 8); fnd(s).energy = clamp(fnd(s).energy - 4, 5, 100);
  const hasTrailer = soc.feed.some((x) => x.type === 'trailer');
  pi.page = { w: s.week, q: clamp(0.35 + (fnd(s).skills.m || 1) / 30 + (hasTrailer ? 0.2 : 0) + (pi.slice ? 0.1 : 0) + rnd(s) * 0.1, 0.2, 0.95), paid: STEAN_FEE };
  W.headline(s, `${s.studio.nome} publica a página de “${p.name}” na Stean.`, 'estudio');
  return null;
}
export function demoBlock(s) {
  const p = s.project; if (!p) return 'sem projeto'; const pi = projInd(p);
  if (pi.demo) return 'a demo já existe'; if (!pi.page) return 'precisa da página da Stean';
  if (projectProg(p) < 0.4) return 'precisa de ≥40% do projeto para uma demo decente';
  return timeBlock(s, 14, 10);
}
export function makeDemo(s) {
  const err = demoBlock(s); if (err) return err;
  const p = s.project; const pi = projInd(p);
  addHours(s, 14); fnd(s).energy = clamp(fnd(s).energy - 10, 5, 100); pi.demo = true; p.bugs += 1.5;
  SO.ensureSoc(s).wl += 15 + s.fans * 0.2; p.hype = clamp(p.hype + 3, 0, 100);
  return null;
}
export function festBlock(s) {
  const p = s.project; if (!p) return 'sem projeto'; const pi = projInd(p);
  if (!W.currentFestival(s)) return 'nenhum festival de demos agora (veja o calendário)';
  if (!pi.page || !pi.demo) return 'precisa de página e demo';
  if (pi.fest === s.week || (pi.festW && s.week - pi.festW < 6)) return 'você já participou deste festival';
  return timeBlock(s, 6, 4);
}
export function joinFest(s) {
  const err = festBlock(s); if (err) return err;
  const p = s.project; const pi = projInd(p); const soc = SO.ensureSoc(s);
  addHours(s, 6); pi.festW = s.week;
  const q = clamp(0.5 + projectProg(p) * 0.6, 0.5, 1.1);
  const wl = (80 + 22 * Math.sqrt(s.fans + SO.totalFollowers(s) + 1)) * q * pi.page.q * 2 * Math.exp(0.5 * gauss(s));
  soc.wl += wl; p.hype = clamp(p.hype + 5, 0, 100);
  return { wl: Math.round(wl) };
}
export function startCrowd(s, platId, goal) {
  const p = s.project; if (!p) return 'sem projeto'; const pi = projInd(p);
  if (pi.crowd) return 'já fez uma campanha neste projeto';
  if (!C.CROWDFUNDING.find((x) => x.id === platId)) return 'inválido';
  if (p.phase < 2 && projectProg(p) < 0.25) return 'mostre algo antes de pedir dinheiro (≥25%)';
  const err = timeBlock(s, 12, 8); if (err) return err;
  addHours(s, 12); fnd(s).energy = clamp(fnd(s).energy - 8, 5, 100);
  pi.crowd = { plat: platId, goal, due: s.week + 4, state: 'ativa' };
  return null;
}
function resolveCrowd(s, p, evs) {
  const c = p.ind.crowd; if (!c || c.state !== 'ativa' || s.week < c.due) return;
  const soc = SO.ensureSoc(s); const plat = C.CROWDFUNDING.find((x) => x.id === c.plat);
  const aud = SO.totalFollowers(s) * 0.035 + soc.wl * 0.05 + s.fans * 0.1 + (soc.discord.members || 0) * 0.15;
  const pledged = Math.round((350 + aud * 46 * (0.6 + (fnd(s).skills.n || 1) / 25 + (p.ind.slice ? 0.2 : 0))) * Math.exp(0.7 * gauss(s)));
  c.pledged = pledged;
  if (pledged >= c.goal) {
    const net = Math.round(pledged * (1 - plat.taxa)); api.earn(s, net); s.ind.owed += Math.round(pledged * 0.12);
    c.state = 'financiada'; c.net = net; s.fans += pledged / 90; p.hype = clamp(p.hype + 6, 0, 100);
    evs.push({ type: 'news', txt: `Campanha financiada! ${money0(pledged)} arrecadados (líquido ${money0(net)}).` });
    W.headline(s, `${s.studio.nome} financia “${p.name}” com ${money0(pledged)}.`, 'estudio');
  } else {
    c.state = 'falhou'; s.ind.mental = clamp(s.ind.mental - 6, 0, 100); soc.rep = clamp(soc.rep - 2, 0, 100);
    evs.push({ type: 'news', txt: `A campanha não bateu a meta (${money0(pledged)} de ${money0(c.goal)}). Nada é cobrado.` });
  }
}
const money0 = (v) => 'R$ ' + Math.round(v).toLocaleString('pt-BR');

// ---------------------------------------------------------------- publicação
export function publisherOffers(s, p, score) {
  const pi = projInd(p); const soc = SO.ensureSoc(s);
  const wl = soc.wl; const out = [];
  if (!pi.slice && !pi.page) return out;
  if (score < 6.2) return out;
  for (const pub of PUBS) {
    const fit = pub.gosta.includes(p.genre) || pub.gosta.includes(p.sub) ? 1 : 0.6;
    const rel = Math.min(5, s.city?.pubRel || 0);
    if (score < 6.2 + (pub.adv - 1) * 2 - rel * 0.15) continue;
    if (wl < 150 * pub.adv * (1 - 0.1 * rel) && s.fans < 120) continue;
    const exp = (wl * 0.12 * 4.5 + 30) * (SIZEPRICE[p.size] || 18) * 0.65;
    const share = clamp(pub.share - (fnd(s).skills.n || 1) * 0.004 - rel * 0.008, 0.28, 0.55);
    const adv = Math.round(clamp(exp * 0.45 * pub.adv * fit * (1 + 0.06 * rel), 1500, 70000) / 100) * 100;
    out.push({ id: pub.id, nome: pub.nome, share, adv, mkt: pub.mkt, desc: pub.desc, fit });
  }
  return out;
}
export const STORE_CUT = { hub: 0.13, vapor: 0.30, mobile: 0.30, switch: 0.30, console: 0.30, epik: 0.12, gojo: 0.10 };
export const HUB_MODELS = { pago: 'Pago', pwyw: 'Pague quanto quiser', gratis: 'Grátis' };
const luck = (s, sigma) => clamp(Math.exp(sigma * gauss(s)), 0.12, 14);
export const MONET = {
  premium: { nome: 'Compra única (premium)', ico: '🛒', u: 1, r: 1, desc: 'Cobra o jogo uma vez. Sem risco de reputação.' },
  iap: { nome: 'Microtransações', ico: '💎', u: 1, r: 1.4, desc: '+40% de receita por venda, mas arrisca a reputação (pior com nota baixa) e as avaliações dos usuários.' },
  ads: { nome: 'Gratuito com anúncios', ico: '📺', u: 2.4, r: 0.32, desc: 'Muito mais jogadores e fãs, mas só ~32% da receita por jogador e um pouco de reputação a menos.' },
};
export const LANGS = {
  en: { nome: 'Inglês', ico: '🇺🇸', gain: 0.30, custo: 1100 },
  es: { nome: 'Espanhol', ico: '🇪🇸', gain: 0.12, custo: 900 },
  zh: { nome: 'Chinês simplificado', ico: '🇨🇳', gain: 0.18, custo: 1700 },
  de: { nome: 'Alemão', ico: '🇩🇪', gain: 0.10, custo: 1000 },
  jp: { nome: 'Japonês', ico: '🇯🇵', gain: 0.12, custo: 1500 },
};
export const LOC_Q = { ia: { nome: 'Tradução automática', k: 0.35, eff: 0.6, pos: -0.02, desc: 'Barata e rápida, com 60% do efeito e algumas gafes.' }, pro: { nome: 'Tradutor profissional', k: 1, eff: 1, pos: 0.01, desc: 'Custo cheio, efeito completo e avaliações melhores.' } };
export function defaultPub(p) {
  return { stores: { hub: true, vapor: false }, price: SIZEPRICE[p.size] || 18, hubModel: 'pago', ea: false, publisher: null, monet: 'premium' };
}
export function launchBlock(s, p, pub) {
  if (!pub.stores.hub && !pub.stores.vapor) return 'escolha ao menos uma loja';
  const pi = projInd(p);
  if (pub.stores.vapor && !pi.page && s.money < STEAN_FEE) return `a taxa da Stean é ${STEAN_FEE} reais`;
  if (pub.ea && !pub.stores.vapor) return 'Acesso Antecipado só na Stean';
  if (pub.monet && pub.monet !== 'premium' && pub.stores.vapor) return 'Anúncios e microtransações não combinam com a Stean (loja premium): use só a inch.io';
  if (pub.monet && pub.monet !== 'premium' && pub.hubModel !== 'pago' && pub.monet === 'ads') return 'escolha o modelo "pago" da inch.io; os anúncios já cuidam do preço';
  return null;
}
/** Chamado pelo releaseGame no modo indie: monta g.ind e devolve unidades da semana 1. */
export function launch(s, g, p, pub, prsMult) {
  const I = s.ind; const pi = projInd(p); const soc = SO.ensureSoc(s);
  const qs = S.qualityShare(g.score); const qm = 0.25 + 0.75 * qs; const sizeM = SIZEMULT[p.size] || 1;
  const fanM = W.fanSalesMult(s, p.genre); const ref = SIZEPRICE[p.size] || 18;
  const priceF = Math.pow(ref / Math.max(2, pub.price), 0.7);
  const pubObj = pub.publisher ? pub.publisher : null;
  // saturação do catálogo: lançar de novo logo depois canibaliza o público (retornos decrescentes de volume)
  const recent = s.games.filter((x) => x !== g && x.ind && s.week - x.releaseWeek < 24).length; const sat = 1 / (1 + 0.16 * recent);
  const mktM = (pubObj ? pubObj.mkt : 1) * prsMult * fanM * sat;
  g.ind = { stores: {}, pub: pubObj ? { ...pubObj, recouped: 0 } : null, ea: !!pub.ea, patches: 0, dlcs: 0, discount: null, lastDisc: -99, bugs: p.bugs, carry: 0, hubModel: pub.hubModel, refunded: false, pagePaid: !!pi.page, owedPaid: false };
  if (pubObj) { g.ind.bugs *= 0.65; api.earn(s, pubObj.adv); }
  let wl = soc.wl;
  if (pub.stores.vapor) {
    if (!pi.page) { api.spend(s, 'taxa Stean', STEAN_FEE); g.ind.pagePaid = true; wl *= 0.3; }
    const conv = 0.07 + 0.10 * qs;
    const wlPart = wl * conv * (pi.demo ? 1.25 : 1) * luck(s, 0.35);
    const org = 30 * sizeM * qm * luck(s, 1.2) * (pi.demo ? 1.2 : 1) + SO.totalFollowers(s) * 0.01;
    // "estouro": streamer descobre, vídeo viral, boca a boca — raro, mas é o que faz a cauda gorda
    let brk = 1; const pB = (g.score >= 6 ? 0.02 + 0.10 * Math.pow(qs, 1.5) + (wl > 300 ? 0.03 : 0) : 0.01) * (pub.ea ? 0.7 : 1);
    if (rnd(s) < pB) { brk = Math.exp(Math.log(4) + rnd(s) * Math.log(16)); g.ind.breakout = Math.round(brk); }
    const B = (wlPart + org) * brk * mktM * priceF * (pub.ea ? 0.75 : 1);
    g.ind.stores.vapor = { B, price: pub.ea ? Math.round(pub.price * 0.8) : pub.price, cut: STORE_CUT.vapor, kind: 'steam', born: s.week, wl: Math.round(wl) };
  }
  if (pub.stores.hub) {
    const f = pub.hubModel === 'gratis' ? 3.2 : pub.hubModel === 'pwyw' ? 1.8 : 1;
    const B = (7 + SO.totalFollowers(s) * 0.015 + s.fans * 0.04 + wl * 0.05 * (pub.stores.vapor ? 0.2 : 1)) * qm * luck(s, 0.9) * sizeM * mktM * f * (pub.hubModel === 'pago' ? priceF : 1);
    const price = pub.hubModel === 'gratis' ? 0 : pub.hubModel === 'pwyw' ? Math.max(2, Math.round(ref * 0.22)) : pub.price;
    g.ind.stores.hub = { B, price, cut: STORE_CUT.hub, kind: 'itch', born: s.week, model: pub.hubModel };
  }
  const mo = MONET[pub.monet] || MONET.premium; g.ind.monet = pub.monet && MONET[pub.monet] ? pub.monet : 'premium'; g.ind.loc = {}; g.ind.eaStreak = 0; g.ind.eaLast = s.week;
  if (mo.u !== 1) for (const x of Object.values(g.ind.stores)) { x.B *= mo.u; if (g.ind.monet === 'ads') x.price = Math.max(1, Math.round(x.price * 0.45)); }
  if (g.ind.monet === 'iap') { soc.rep = clamp(soc.rep - (g.score < 7 ? 7 : 3), 0, 100); s.fan.mood = clamp(s.fan.mood - (g.score < 7 ? 6 : 2), 0, 100); }
  if (g.ind.monet === 'ads') soc.rep = clamp(soc.rep - 2, 0, 100);
  g.price = Math.max(...Object.values(g.ind.stores).map((x) => x.price));
  g.U = Math.round(Object.values(g.ind.stores).reduce((a, x) => a + x.B * 4.5, 0));
  g.r = 0.9; g.wishlists = Math.round(wl);
  soc.wl = soc.wl * 0.1; // lista zera: quem ia comprar, comprou ou desistiu
  // reviews dos usuários
  g.ind.pos = userPos(g, g.ind); if (g.ind.monet === 'iap') g.ind.pos = clamp(g.ind.pos - (g.score < 7 ? 0.12 : 0.06), 0.08, 0.98);
  // recompensas do crowdfunding
  if (I.owed > 0) { api.spend(s, 'recompensas', I.owed); I.owed = 0; }
  // aprendizado fazendo
  for (const k of ['t', 'd']) addXp(s, k, p.total / 40);
  addXp(s, 'g', p.total / 70); addXp(s, 's', p.total / 90);
  return g;
}
export function userPos(g, ind) {
  const store = Object.values(ind.stores)[0];
  const ref = SIZEPRICE[g.size] || 18; const price = store ? store.price || ref : ref;
  const fair = clamp(Math.pow(ref / Math.max(3, price), 0.25), 0.8, 1.15);
  return clamp((0.30 + 0.075 * (g.score - 3) - 0.018 * ind.bugs) * fair, 0.08, 0.98);
}
export const posLabel = (v) => (v >= 0.95 ? 'Extremamente positivas' : v >= 0.85 ? 'Muito positivas' : v >= 0.7 ? 'Positivas' : v >= 0.55 ? 'Mistas' : v >= 0.35 ? 'Negativas' : 'Muito negativas');
const CURVE = (w) => (w === 0 ? 1 : w === 1 ? 0.22 : w === 2 ? 0.15 : w === 3 ? 0.10 : 0.09 * Math.pow(0.985, w - 4));
const HUBCURVE = (w) => (w === 0 ? 1 : 0.45 * Math.pow(0.62, w - 1) + 0.012);
const MOBCURVE = (w) => 0.5 * Math.pow(0.92, w) + 0.03;
const GOJCURVE = (w) => (w === 0 ? 0.55 : 0.22 * Math.pow(0.86, w - 1) + 0.02);
const EPIKCURVE = (w) => (w === 0 ? 1 : w === 1 ? 0.26 : w === 2 ? 0.17 : 0.11 * Math.pow(0.97, w - 3) + 0.01);
/** Multiplicador de idiomas já traduzidos (retornos decrescentes: cada idioma extra vale 80% do anterior). */
export function locMult(s, ind) { const L = Object.entries(ind.loc || {}).filter(([, v]) => v.ready <= s.week).map(([k, v]) => LANGS[k].gain * v.eff).sort((a, b) => b - a); let m = 1, f = 1; for (const x of L) { m += x * f; f *= 0.8; } return m; }
function rndRound(s, x) { const f = Math.floor(x); return f + (rnd(s) < x - f ? 1 : 0); }
const eaMult = (s, g, ind) => (ind.ea ? 1 + 0.03 * Math.min(10, ind.eaStreak || 0) : 1);
/** Vendas da semana de um jogo indie. Retorna {sold, gross, fee, tax, royalty, pubTake, partner, refund}. */
export function weekly(s, g) {
  const ind = g.ind; const sale = W.currentSale(s); let sold = 0, gross = 0, fee = 0;
  const trend = W.trendMult(s, g);
  const crisis = s.soc.crisis ? 1 - 0.08 * s.soc.crisis.sev : 1;
  for (const [id, st] of Object.entries(ind.stores)) {
    const w = s.week - st.born; if (w < 0) continue;
    const curve = st.kind === 'steam' || st.kind === 'console' ? CURVE(w) : st.kind === 'itch' ? HUBCURVE(w) : st.kind === 'epik' ? EPIKCURVE(w) : st.kind === 'gojo' ? GOJCURVE(w) : MOBCURVE(w);
    const revM = w >= 2 ? 0.72 + 0.56 * ind.pos : 1;
    let price = st.price; let boost = 1;
    if (st.kind === 'steam' && w >= 3) {
      const dsc = ind.discount && ind.discount.left > 0 ? ind.discount : null;
      if (dsc) { boost *= 1 + dsc.pct * 3.1; price = Math.round(price * (1 - dsc.pct) * 100) / 100; }
      else if (sale && ind.saleOn === sale.id) { boost *= sale.boost; price = Math.round(price * (1 - sale.desc) * 100) / 100; }
    }
    let u = st.B * curve * revM * boost * trend * crisis * (1 + (ind.dlcBoost || 0) * (w < 20 ? 1 : 0)) * locMult(s, ind) * eaMult(s, g, ind);
    if (ind.relaunch && s.week - ind.relaunch.w < 4) u += ind.relaunch.B * CURVE(s.week - ind.relaunch.w) * (st.kind === 'steam' ? 1 : 0);
    const n = rndRound(s, Math.max(0, u));
    st.last = n; st.sold = (st.sold || 0) + n;
    sold += n; const gr = n * price * (MONET[ind.monet]?.r || 1); gross += gr; fee += gr * st.cut;
    (st.hist ||= []).push(n); if (st.hist.length > 16) st.hist.shift();
  }
  if (ind.monet === 'ads') s.fans += sold * 0.02;
  if (ind.monet === 'iap' && s.week - g.releaseWeek < 12 && chance(s, g.score < 7 ? 0.05 : 0.025)) { // polêmica das microtransações
    const soc = SO.ensureSoc(s); soc.rep = clamp(soc.rep - 3, 0, 100); s.fan.mood = clamp(s.fan.mood - 5, 0, 100); ind.pos = clamp(ind.pos - 0.04, 0.08, 0.98);
    W.headline(s, `Jogadores reclamam das microtransações de ${g.name}.`, 'estudio'); api.log(s, `Polêmica: jogadores reclamam das microtransações de ${g.name}. Reputação -3.`, 'ruim');
  }
  if (ind.ea) { // comunidade do Acesso Antecipado cobra atualizações: sem patch há 3+ semanas, as avaliações caem
    if (s.week - (ind.eaLast ?? s.week) >= 3) { ind.pos = clamp(ind.pos - 0.012, 0.08, 0.98); ind.eaStreak = 0; }
  }
  if (ind.discount) { ind.discount.left--; if (ind.discount.left <= 0) ind.discount = null; }
  let royaltyV = royalty(s) * gross;
  let pubTake = 0;
  const net0 = gross - fee - royaltyV;
  if (ind.pub) {
    pubTake = ind.pub.recouped < ind.pub.adv ? Math.min(net0, ind.pub.adv - ind.pub.recouped) : 0;
    ind.pub.recouped += pubTake;
    pubTake += Math.max(0, net0 - pubTake) * ind.pub.share * (ind.pub.recouped >= ind.pub.adv ? 1 : 0);
  }
  let refund = 0;
  const vapor = ind.stores.vapor;
  if (vapor && ind.pagePaid && !ind.refunded && g.gross + gross >= STEAN_REFUND_AT) { refund = STEAN_FEE; ind.refunded = true; }
  const partner = s.employees.some((e) => e.partner) ? Math.max(0, net0 - pubTake) * 0.2 : 0;
  return { sold, gross, fee, royalty: royaltyV, pubTake, partner, refund };
}
// ---------------------------------------------------------------- pós-lançamento
const gameOf = (s, id) => s.games.find((x) => x.id === id);
export function patch(s, id) {
  const g = gameOf(s, id); if (!g?.ind) return 'indisponível';
  if (g.ind.bugs < 0.5 && g.ind.patches > 0) return 'já está bem polido';
  if (s.week - (g.ind.lastPatch ?? -99) < 3) return 'espere algumas semanas entre patches';
  const err = timeBlock(s, 8, 6); if (err) return err;
  addHours(s, 8); fnd(s).energy = clamp(fnd(s).energy - 6, 5, 100);
  g.ind.bugs *= 0.45; g.ind.patches++; g.ind.lastPatch = s.week; g.ind.pos = clamp(userPos(g, g.ind) + 0.03 * g.ind.patches, 0.08, 0.98);
  s.fan.mood = clamp(s.fan.mood + 2, 0, 100);
  return null;
}
/** Acesso Antecipado: patch semanal (5h). Sequência de semanas seguidas aumenta as vendas (até +30%) e a confiança da comunidade. */
export function eaPatch(s, id) {
  const g = gameOf(s, id); if (!g?.ind?.ea) return 'só em Acesso Antecipado'; const I = g.ind;
  if (I.eaWeek === s.week) return 'o patch desta semana já saiu'; const err = timeBlock(s, 5, 4); if (err) return err;
  addHours(s, 5); fnd(s).energy = clamp(fnd(s).energy - 4, 5, 100);
  I.eaStreak = (s.week - (I.eaLast ?? -99) <= 2) ? (I.eaStreak || 0) + 1 : 1; I.eaLast = s.week; I.eaWeek = s.week; I.eaPatches = (I.eaPatches || 0) + 1;
  I.bugs *= 0.82; I.pos = clamp(I.pos + 0.012 + 0.002 * Math.min(8, I.eaStreak), 0.08, 0.98); s.fan.mood = clamp(s.fan.mood + 1, 0, 100);
  return null;
}
export function locCost(s, g, lang, q = 'pro') { return Math.round(LANGS[lang].custo * Math.sqrt(SIZEMULT[g.size] || 1) * LOC_Q[q].k * api.infl(s) / 10) * 10; }
export function localize(s, id, lang, q = 'pro') {
  const g = gameOf(s, id); if (!g?.ind || !LANGS[lang] || !LOC_Q[q]) return 'indisponível'; g.ind.loc ||= {};
  if (g.ind.loc[lang]) return 'idioma já traduzido (ou em andamento)'; if (g.ind.bugs > 8) return 'corrija os bugs antes de traduzir';
  const c = locCost(s, g, lang, q); if (s.money < c) return 'sem dinheiro'; const err = timeBlock(s, 6, 4); if (err) return err;
  api.spend(s, 'localização', c); addHours(s, 6); g.ind.loc[lang] = { ready: s.week + 3, eff: LOC_Q[q].eff, q };
  g.ind.pos = clamp(g.ind.pos + LOC_Q[q].pos, 0.08, 0.98); return null;
}
export function makeDlc(s, id) {
  const g = gameOf(s, id); if (!g?.ind) return 'indisponível';
  if (g.weeks < 6) return 'espere o jogo assentar (6 semanas)'; if (g.ind.dlcs >= 3) return 'já são 3 DLCs';
  if (g.score < 5.5) return 'DLC de jogo mal avaliado não vende';
  const err = timeBlock(s, 30, 15); if (err) return err;
  addHours(s, 30); fnd(s).energy = clamp(fnd(s).energy - 15, 5, 100); g.ind.dlcs++;
  const v = g.ind.stores.vapor || Object.values(g.ind.stores)[0];
  const B = v.B * 0.35 * (1 + SO.totalFollowers(s) / 4000);
  g.ind.relaunch = { w: s.week, B }; g.ind.dlcBoost = (g.ind.dlcBoost || 0) + 0.1;
  W.headline(s, `${g.name} ganha DLC: “${pick(s, ['Capítulo Extra', 'Pacote do Mestre', 'Modo Desafio', 'A Origem'])}”.`, 'estudio');
  return null;
}
export function discount(s, id, pct) {
  const g = gameOf(s, id); if (!g?.ind?.stores.vapor) return 'só para jogos na Stean';
  if (g.weeks < 4) return 'espere 4 semanas do lançamento'; if (s.week - g.ind.lastDisc < 8) return 'descontos só a cada 8 semanas';
  g.ind.discount = { pct, left: 2 }; g.ind.lastDisc = s.week; return null;
}
export function joinSale(s, id) {
  const g = gameOf(s, id); const sale = W.currentSale(s);
  if (!sale) return 'não há promoção sazonal agora'; if (!g?.ind?.stores.vapor) return 'só para jogos na Stean';
  if (g.weeks < 4) return 'espere 4 semanas do lançamento'; if (g.ind.saleOn === sale.id) return 'já inscrito';
  g.ind.saleOn = sale.id; return null;
}
export const PORTS = {
  epik: { nome: 'Epik Store', custo: 1500, h: 12, minScore: 6.5, f: 0.8, kind: 'epik', cut: 0.12, fans: 250, delay: 3, desc: 'Corte de só 12%, público seletivo. Pede nota 6,5+ e uma base de fãs (250+).' },
  gojo: { nome: 'GOJ (sem DRM)', custo: 400, h: 8, minScore: 6.0, f: 0.35, kind: 'gojo', cut: 0.10, delay: 2, desc: 'Sem DRM e com curadoria forte: vende mais devagar, mas por mais tempo. Corte de 10%.' },
  console: { nome: 'Console (PlayStasion / Xbux)', custo: 48000, h: 60, minScore: 7.5, f: 0.9, kind: 'console', cut: 0.30, steam: 800, delay: 8, bugs: 4, desc: 'Kit de desenvolvimento e certificação (~R$ 48 mil). Exige nota 7,5+, 800 vendas na Stean e poucos bugs.' },
  mobile: { nome: 'Celular (Ap Store / Googol Play)', custo: 2600, h: 24, minScore: 5.5, f: 1.4, kind: 'mobile', cut: 0.30, desc: 'Muito volume, preço baixo. Reescreve os controles para toque.' },
  switch: { nome: 'Nintendu eShop (portátil híbrido)', custo: 32000, h: 40, minScore: 7.0, f: 0.55, kind: 'steam', cut: 0.30, steam: 400, desc: 'Porte e certificação custam caro (~R$ 25–45 mil). Só vale com um bom jogo.' },
};
export function port(s, id, pid) {
  const g = gameOf(s, id); const P = PORTS[pid]; if (!g?.ind || !P) return 'indisponível';
  if (g.ind.stores[pid]) return 'já foi portado'; if (g.score < P.minScore) return `nota mínima ${P.minScore}`;
  if (P.steam && (g.ind.stores.vapor?.sold || 0) < P.steam) return `precisa de ${P.steam}+ vendas na Stean`;
  if (P.fans && s.fans < P.fans) return `precisa de ${P.fans}+ fãs`;
  if (P.bugs && g.ind.bugs > P.bugs) return `a certificação reprovaria: bugs altos (${Math.round(g.ind.bugs)}); lance um patch antes`;
  const pubCovers = !!g.ind.pub; const cost = pubCovers ? 0 : Math.round(P.custo * api.infl(s) / 100) * 100;
  if (s.money < cost) return 'sem dinheiro'; const err = timeBlock(s, P.h > 40 ? 40 : P.h, 10); if (err) return err;
  if (cost) api.spend(s, 'porte', cost);
  addHours(s, Math.min(P.h, 40)); fnd(s).energy = clamp(fnd(s).energy - 10, 5, 100);
  const v = g.ind.stores.vapor || Object.values(g.ind.stores)[0];
  g.ind.stores[pid] = { B: v.B * P.f, price: pid === 'mobile' ? 4 : Math.round(v.price * 1.1), cut: P.cut, kind: P.kind, born: s.week + (P.delay ?? (pid === 'mobile' ? 2 : 6)), id: pid, hist: [] };
  return null;
}
export function relaunch10(s, id) {
  const g = gameOf(s, id); if (!g?.ind?.ea) return 'não está em Acesso Antecipado';
  if (g.weeks < 10) return 'espere ao menos 10 semanas de acesso antecipado'; const err = timeBlock(s, 20, 10); if (err) return err;
  addHours(s, 20); g.ind.ea = false; const v = g.ind.stores.vapor; v.price = Math.round(v.price / 0.8);
  g.ind.bugs *= 0.5; g.ind.pos = clamp(userPos(g, g.ind) + 0.06, 0.08, 0.98); g.score = Math.min(10, g.score + 0.4);
  g.ind.relaunch = { w: s.week, B: v.B * 0.8 };
  W.headline(s, `${g.name} sai do Acesso Antecipado e chega à versão 1.0.`, 'estudio');
  return null;
}

// ---------------------------------------------------------------- carreira
export function stageOf(s) {
  const n = s.employees.length;
  return n <= 1 ? 'solo' : n === 2 ? 'dupla' : n <= 8 ? 'pequeno' : n <= 25 ? 'medio' : 'grande';
}
export const STAGES = {
  solo: { nome: 'Dev solo', desc: 'Só você, um PC e muita vontade.', next: 'Sócio(a) ou freelancers por jogo' },
  dupla: { nome: 'Dupla indie', desc: 'Você e um(a) parceiro(a). Dividem tudo (inclusive o lucro).', next: 'Contratar mais gente e mudar de escritório' },
  pequeno: { nome: 'Estúdio pequeno', desc: '3 a 8 pessoas. Aluguel e salários pesam.', next: 'Chegar a 9 pessoas e a um escritório médio' },
  medio: { nome: 'Estúdio médio', desc: '9 a 25 pessoas. Jogos maiores, risco maior.', next: '26+ pessoas' },
  grande: { nome: 'Estúdio grande', desc: 'Mais de 25 pessoas: vida de grande empresa.', next: '—' },
};
export function partnerBlock(s) {
  if (s.employees.some((e) => e.partner)) return 'você já tem um(a) sócio(a)';
  if (s.employees.length >= D.OFFICES[s.office].vagas) return 'sem vagas';
  if (s.games.length < 1 && s.fans < 100) return 'lance um jogo (ou junte ~100 fãs) para atrair um sócio';
  return null;
}
export function sociosDisponiveis(s) { return s.candidates.filter((c) => ['programador', 'designer', 'artista', 'sonoplasta'].includes(c.role)).slice(0, 3); }
export function hirePartner(s, cid) {
  const err = partnerBlock(s); if (err) return err;
  const i = s.candidates.findIndex((c) => c.id === cid); if (i < 0) return 'candidato inexistente';
  const c = s.candidates.splice(i, 1)[0]; c.id = 'e' + s.nextId++; c.salary = 0; c.partner = true;
  s.employees.push(c); api.log(s, `${c.name} virou sócio(a) do estúdio (20% do lucro dos jogos).`, 'bom');
  W.headline(s, `${s.studio.nome} vira dupla: ${c.name} entra como sócio(a).`, 'estudio');
  return null;
}

// ---------------------------------------------------------------- tick semanal
export function tickIndie(s, evs) {
  const I = ensureInd(s); const e = fnd(s); const soc = SO.ensureSoc(s);
  const job = JOBS[I.job];
  if (job.sem) { const pay = jobPay(s); api.earn(s, pay); I.jobTotal += pay; }
  // saúde mental
  const hrs = soc.hours + (1 - JOBS[I.job].mult) * 20;
  let dm = HOUSING[I.housing].mental + job.mental + (I.gear.cadeira ? GEAR.find((g) => g.id === 'cadeira').mental : 0);
  if (hrs > 44) dm -= (hrs - 44) * 0.3; else if (hrs <= 32) dm += 1.2;
  if (e.energy < 35) dm -= 2;
  if (s.money < 400) dm -= 2.5;
  if (I.sleep === 'madruga') { dm -= 2; e.energy = clamp(e.energy - 3, 5, 100); }
  if (I.burn > 0) { I.burn--; dm += 5; e.energy = clamp(e.energy + 15, 5, 100); if (I.burn === 0) evs.push({ type: 'news', txt: 'Você voltou do burnout. Vá com calma.' }); }
  I.mental = clamp(I.mental + dm, 0, 100);
  if (I.mental < 22 && I.burn <= 0 && chance(s, 0.28)) {
    I.burn = 3; I.mental = 45; I.stats.burnouts++;
    evs.push({ type: 'news', txt: '😵 Burnout! Você precisa de 3 semanas longe do computador.' });
    W.headline(s, `${s.studio.nome} anuncia pausa: “o dev precisa de descanso”.`, 'estudio');
  }
  // página da Stean rende wishlists orgânicas
  const p = s.project;
  if (p?.ind?.page && p.stage !== 'result') {
    const pg = p.ind.page; const wk = s.week - pg.w;
    const base = (2.5 + 0.35 * Math.sqrt(SO.totalFollowers(s) + s.fans)) * (0.4 + pg.q) * (p.ind.demo ? 1.5 : 1) * (W.trendMult(s, p) > 1.1 ? 1.25 : 1);
    soc.wl += base * Math.exp(0.5 * gauss(s)) * Math.min(1, 0.6 + wk / 20);
  }
  if (p?.ind) resolveCrowd(s, p, evs);
  // escopo cresce sozinho
  if (p && p.stage === 'dev' && !p.ind?.cut && p.weeks > 0 && p.weeks % 4 === 0 && chance(s, 0.12)) {
    p.total = Math.round(p.total * 1.06); p.dTarget *= 1.06; p.tTarget *= 1.06;
    evs.push({ type: 'news', txt: 'Escopo crescendo: “só mais uma feature” aumentou o projeto em 6%.' });
  }
  // sistema de ofertas de freela
  genOffers(s);
  // fim de jogo da fase solo: sem dinheiro
}

export function careerAdvice(s) {
  const I = s.ind; const tips = [];
  const lc = livingCost(s).total;
  const runway = s.money / Math.max(1, lc - jobPay(s));
  if (runway < 8) tips.push('⚠️ Caixa curto: considere freelas ou um emprego de meio período.');
  if (I.mental < 40) tips.push('🧠 Saúde mental baixa: descanse antes do burnout.');
  if (!s.project && s.games.length === 0) tips.push('🎯 Comece com um jogo MICRO (jam): termina rápido e ensina muito.');
  if (s.games.length && !SO.ensureSoc(s).discord.open) tips.push('💬 Abra um Discorde: comunidade é o motor do marketing indie.');
  if (!tips.length) tips.push('✅ Tudo sob controle. Continue lançando e aprendendo.');
  return tips;
}
