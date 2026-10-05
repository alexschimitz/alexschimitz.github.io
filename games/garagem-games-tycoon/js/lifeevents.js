// Eventos de vida do modo indie (v0.6.1): família, saúde, mudança de cidade, ofertas de emprego e oportunidades.
// Cada evento tem escolhas com custo/benefício; sem resposta em 3 semanas vale a escolha padrão (a mais passiva).
import { clamp, chance, rnd } from './util.js';
import * as SO from './social.js';
import * as CT from './city.js';
import * as IND from './indie.js';

let api = { spend() {}, earn() {}, log() {}, infl: () => 1 };
export function bind(a) { api = { ...api, ...a }; }
const lf = (s) => IND.lifeInfl(s);
const hoursLeft = (s) => 40 - SO.ensureSoc(s).hours;
const addH = (s, h) => { SO.ensureSoc(s).hours += h; };
const mental = (s, d) => { s.ind.mental = clamp(s.ind.mental + d, 0, 100); };
const energy = (s, d) => { const e = s.employees[0]; e.energy = clamp(e.energy + d, 5, 100); };
const money = (s, v, cat) => { if (v > 0) api.spend(s, cat, v); else if (v < 0) api.earn(s, -v); };
const otherDistrict = (s) => { const ids = Object.keys(CT.DISTRICTS).filter((d) => d !== CT.ensureCity(s).home); return ids[Math.floor(rnd(s) * ids.length)]; };

export const EVENTS = [
  { id: 'fam_conta', ico: '👨‍👩‍👧', nome: 'Família: conta apertada', w: 1.2, cond: () => true,
    txt: (s) => `Sua mãe ligou: a conta de luz veio alta e ela pediu uma ajuda de R$ ${Math.round(450 * lf(s))}.`,
    opts: [
      { id: 'ajudar', label: 'Ajudar', desc: 'Custa dinheiro, mas o humor sobe.', ok: (s) => s.money >= 450 * lf(s), run: (s) => { money(s, Math.round(450 * lf(s)), 'família'); mental(s, 5); return 'Você ajudou a família. Sentiu-se bem com isso.'; } },
      { id: 'explicar', label: 'Explicar que está apertado', desc: 'Sem custo; humor cai um pouco.', auto: true, run: (s) => { mental(s, -4); return 'Ela entendeu, mas ficou aquele clima.'; } },
    ] },
  { id: 'fam_festa', ico: '🎂', nome: 'Aniversário na família', w: 1, cond: () => true,
    txt: () => 'É o aniversário de um parente querido. Almoço de domingo, o dia inteiro.',
    opts: [
      { id: 'ir', label: 'Ir à festa (10h)', desc: 'Perde o dia de trabalho; humor +8 e energia +10.', ok: (s) => hoursLeft(s) >= 10, run: (s) => { addH(s, 10); mental(s, 8); energy(s, 10); money(s, Math.round(60 * lf(s)), 'presente'); return 'Foi um dia ótimo. Voltou renovado(a).'; } },
      { id: 'ficar', label: 'Ficar trabalhando', desc: 'Humor -5.', auto: true, run: (s) => { mental(s, -5); return 'Você mandou um áudio de parabéns e voltou ao código.'; } },
    ] },
  { id: 'doenca_gripe', ico: '🤒', nome: 'Doença: gripe forte', w: 1.3, cond: () => true,
    txt: () => 'Você acordou com febre, corpo doendo e garganta ruim. Dá para trabalhar assim?',
    opts: [
      { id: 'descansar', label: 'Descansar uma semana', desc: 'Perde ~24h da semana e R$ 120 de remédios; energia volta.', ok: (s) => hoursLeft(s) >= 4, run: (s) => { addH(s, Math.min(24, hoursLeft(s))); money(s, Math.round(120 * lf(s)), 'saúde'); energy(s, 25); mental(s, 3); return 'Dormiu, tomou sopa e melhorou.'; } },
      { id: 'insistir', label: 'Trabalhar assim mesmo', desc: 'Energia -35; 35% de chance de burnout curto.', auto: true, run: (s) => { energy(s, -35); mental(s, -6); if (chance(s, 0.35)) { s.ind.burn = Math.max(s.ind.burn, 2); return 'Piorou e você caiu de cama por 2 semanas (burnout).'; } return 'Aguentou, mas saiu no limite.'; } },
    ] },
  { id: 'doenca_exame', ico: '🩺', nome: 'Saúde: exame de rotina', w: 0.8, cond: (s) => s.week > 16,
    txt: (s) => `Há meses você adia o check-up. Hoje a dor nas costas apertou: consulta e exames saem por R$ ${Math.round(900 * lf(s))}.`,
    opts: [
      { id: 'pagar', label: 'Fazer os exames', desc: 'Custa caro, mas tira a dúvida e melhora o humor.', ok: (s) => s.money >= 900 * lf(s), run: (s) => { money(s, Math.round(900 * lf(s)), 'saúde'); mental(s, 4); energy(s, 8); return 'Nada grave. Postura e alongamento resolveram.'; } },
      { id: 'adiar', label: 'Adiar mais uma vez', desc: '40% de chance de piorar e custar o dobro; humor -6.', auto: true, run: (s) => { mental(s, -6); if (chance(s, 0.4)) { money(s, Math.round(1800 * lf(s)), 'saúde'); return 'A dor virou problema: urgência e fisioterapia custaram o dobro.'; } return 'A dor passou sozinha, por enquanto.'; } },
    ] },
  { id: 'mudanca', ico: '🚚', nome: 'Mudança de cidade', w: 0.7, cond: (s) => s.week > 24,
    txt: () => 'Seu contrato de aluguel vai acabar e um amigo ofereceu um quarto em outro bairro da cidade. Mudar leva um dia inteiro.',
    opts: [
      { id: 'mudar', label: 'Mudar de bairro (16h)', desc: 'R$ 800; muda a sede e o aluguel; contatos antigos esfriam.', ok: (s) => s.money >= 800 * lf(s) && hoursLeft(s) >= 16, run: (s) => { const d = otherDistrict(s); money(s, Math.round(800 * lf(s)), 'mudança'); addH(s, 16); const c = CT.ensureCity(s); c.home = d; c.lastMove = s.week; c.moves++; for (const q of c.people) q.rel = Math.max(1, q.rel - 1); mental(s, 2); return `Nova sede em ${CT.DISTRICTS[d].nome}. Tudo em caixas por uns dias.`; } },
      { id: 'ficar', label: 'Renovar o contrato', desc: 'Aluguel sobe 6% e o humor cai um pouco.', auto: true, run: (s) => { s.ind.rentBump = (s.ind.rentBump || 0) + 1; mental(s, -2); return 'Você renovou. O senhorio agradeceu e subiu o aluguel.'; } },
    ] },
  { id: 'emprego', ico: '💼', nome: 'Oportunidade de emprego', w: 1.1, cond: (s) => s.week > 10,
    txt: () => 'Uma empresa de jogos viu seu portfólio e chamou para uma entrevista. É uma carreira estável... mas o estúdio ficaria em segundo plano.',
    opts: [
      { id: 'clt', label: 'Aceitar o CLT', desc: 'Bônus de R$ 1.500; vira CLT (renda segura, pouco tempo para o estúdio).', run: (s) => { money(s, -Math.round(1500 * lf(s)), 'bônus'); s.ind.job = 'clt'; mental(s, 3); return 'Você virou CLT. O estúdio agora é projeto de noites e fins de semana.'; } },
      { id: 'meio', label: 'Negociar meio período remoto', desc: 'Bônus de R$ 400 e vira meio período.', run: (s) => { money(s, -Math.round(400 * lf(s)), 'bônus'); s.ind.job = 'meio'; return 'Eles toparam um meio período remoto.'; } },
      { id: 'recusar', label: 'Recusar e seguir no estúdio', desc: 'Humor +2 (foco!), nada muda.', auto: true, run: (s) => { mental(s, 2); return 'Você agradeceu e recusou. O jogo vem primeiro.'; } },
    ] },
  { id: 'freela_grande', ico: '💸', nome: 'Oportunidade: freela grande', w: 1, cond: (s) => s.week > 8,
    txt: (s) => `Um conhecido precisa de um protótipo em 3 dias e paga R$ ${Math.round(1400 * lf(s))}.`,
    opts: [
      { id: 'topar', label: 'Topar (20h)', desc: 'Dinheiro na hora; gasta energia e horas.', ok: (s) => hoursLeft(s) >= 20, run: (s) => { addH(s, 20); money(s, -Math.round(1400 * lf(s)), 'freela'); energy(s, -15); IND.addXp(s, 't', 4); return 'Entregou no prazo e ainda aprendeu algo.'; } },
      { id: 'recusar', label: 'Recusar', desc: 'Sem efeito.', auto: true, run: () => 'Você agradeceu e disse que está focado(a) no seu jogo.' },
    ] },
  { id: 'pc_problema', ico: '💻', nome: 'Problema no computador', w: 0.9, cond: (s) => s.week > 12,
    txt: (s) => `O notebook começou a travar e reiniciar sozinho. A assistência pede R$ ${Math.round(450 * lf(s))}.`,
    opts: [
      { id: 'consertar', label: 'Consertar', desc: 'Custa dinheiro; tudo volta ao normal.', ok: (s) => s.money >= 450 * lf(s), run: (s) => { money(s, Math.round(450 * lf(s)), 'conserto'); return 'Limpeza, pasta térmica nova e fonte trocada: voltou a voar.'; } },
      { id: 'tocar', label: 'Tocar assim mesmo', desc: 'Perde 15h de trabalho esta semana e humor -4.', auto: true, run: (s) => { addH(s, Math.min(15, hoursLeft(s))); mental(s, -4); return 'Vários travamentos depois, você aprendeu a salvar a cada minuto.'; } },
    ] },
  { id: 'casamento', ico: '💒', nome: 'Convite de casamento', w: 0.7, cond: (s) => s.week > 20,
    txt: () => 'Seu melhor amigo vai casar. Convite, viagem curta e um fim de semana fora.',
    opts: [
      { id: 'ir', label: 'Ir ao casamento (14h)', desc: 'R$ 300; humor +9 e conhece gente.', ok: (s) => s.money >= 300 * lf(s) && hoursLeft(s) >= 14, run: (s) => { money(s, Math.round(300 * lf(s)), 'casamento'); addH(s, 14); mental(s, 9); const c = CT.ensureCity(s); c.contacts += 2; return 'Dançou até tarde e fez dois novos contatos.'; } },
      { id: 'faltar', label: 'Mandar um presente e ficar', desc: 'R$ 100; humor -3.', auto: true, run: (s) => { money(s, Math.round(100 * lf(s)), 'presente'); mental(s, -3); return 'Seu amigo entendeu, mas sentiu sua falta.'; } },
    ] },
];
export const BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
export function newLife() { return { pending: null, cd: {}, last: -99, log: [], n: 0 }; }
export function ensureLife(s) { s.ind.life ??= newLife(); return s.ind.life; }
export function current(s) { if (s.mode !== 'indie' || !s.ind) return null; const L = ensureLife(s); if (!L.pending) return null; const e = BY_ID[L.pending.id]; return e ? { ev: e, week: L.pending.week, txt: e.txt(s) } : null; }
export function optBlock(s, o) { return o.ok && !o.ok(s) ? 'sem dinheiro ou horas suficientes' : null; }
export function choose(s, optId) {
  const L = ensureLife(s); if (!L.pending) return { err: 'nenhum evento pendente' }; const e = BY_ID[L.pending.id]; const o = e.opts.find((x) => x.id === optId); if (!o) return { err: 'opção inválida' };
  const b = optBlock(s, o); if (b) return { err: b };
  const msg = o.run(s); L.pending = null; L.n++; L.log.unshift({ w: s.week, id: e.id, nome: e.nome, opt: o.label, msg }); if (L.log.length > 12) L.log.length = 12;
  api.log(s, `${e.ico} ${e.nome}: ${msg}`, 'info'); return { msg };
}
/** Por semana: chance de surgir um evento (6%, intervalo mínimo de 5 semanas); pendente há 3 semanas vale a escolha padrão. */
export function tickLife(s, evs) {
  if (s.mode !== 'indie' || !s.ind) return; const L = ensureLife(s);
  if (L.pending) { if (s.week - L.pending.week >= 3) { const e = BY_ID[L.pending.id]; const o = e.opts.find((x) => x.auto) || e.opts[e.opts.length - 1]; const w = s.week; const r = choose(s, o.id); if (r.msg) evs.push({ type: 'news', txt: `${e.ico} ${e.nome}: ${o.label.toLowerCase()} (sem resposta).` }); void w; } return; }
  if (s.week < 8 || s.week - L.last < 5 || !chance(s, 0.06)) return;
  const pool = EVENTS.filter((e) => e.cond(s) && (s.week - (L.cd[e.id] ?? -99)) > 40); if (!pool.length) return;
  let tot = pool.reduce((a, e) => a + e.w, 0), r = rnd(s) * tot, pk = pool[0]; for (const e of pool) { r -= e.w; if (r <= 0) { pk = e; break; } }
  L.pending = { id: pk.id, week: s.week }; L.last = s.week; L.cd[pk.id] = s.week; evs.push({ type: 'lifeevent', id: pk.id });
}

// ---------------------------------------------------------------- vida da equipe (v0.7)
// Eventos pessoais de funcionários (clássico e indie): licença, doença, proposta de outro estúdio, mudança de cidade etc.
export function newStaffLife() { return { pending: null, cd: {}, last: -99, log: [], n: 0 }; }
export function ensureStaffLife(s) { s.slife ??= newStaffLife(); return s.slife; }
const crew = (s) => s.employees.filter((e) => !e.founder && !e.partner);
const mood = (e, d) => { e.mood = clamp((e.mood ?? 60) + d, 0, 100); };
const away = (e, w) => { e.away = { left: w }; };
const cashC = (s, v) => Math.round(v * api.infl(s) / 50) * 50;
const spendIf = (s, v, cat) => { if (s.money < v) return false; api.spend(s, cat, v); return true; };
export const STAFF_EVENTS = [
  { id: 'filho', ico: '👶', nome: 'Bebê a caminho', w: 1,
    txt: (s, e) => `${e.name} vai ser pai/mãe! A licença chega em breve e a equipe está emocionada.`,
    opts: [
      { id: 'apoiar', label: 'Dar licença e um presente', desc: 'Fora 3 semanas; humor +15 e lealdade.', ok: (s) => s.money >= cashC(s, 300), run: (s, e) => { spendIf(s, cashC(s, 300), 'equipe'); away(e, 3); mood(e, 15); return `${e.name} saiu de licença feliz da vida.`; } },
      { id: 'basico', label: 'Só a licença legal', desc: 'Fora 3 semanas, sem extras.', auto: true, run: (s, e) => { away(e, 3); mood(e, 3); return `${e.name} saiu de licença.`; } },
    ] },
  { id: 'doenca', ico: '🤒', nome: 'Funcionário doente', w: 1.4,
    txt: (s, e) => `${e.name} está com uma gripe forte e tossindo sem parar.`,
    opts: [
      { id: 'casa', label: 'Mandar para casa', desc: '2 semanas fora; humor +4.', auto: true, run: (s, e) => { away(e, 2); mood(e, 4); e.energy = clamp(e.energy + 30, 5, 100); return `${e.name} descansou e voltou melhor.`; } },
      { id: 'insistir', label: 'Pedir para tentar trabalhar', desc: 'Ninguém sai, mas humor −12 e energia despenca.', run: (s, e) => { mood(e, -12); e.energy = clamp(e.energy - 25, 5, 100); return `${e.name} trabalhou doente e a equipe notou.`; } },
    ] },
  { id: 'proposta', ico: '💼', nome: 'Proposta de outro estúdio', w: 1.2, cond: (s) => s.employees.length >= 3,
    txt: (s, e) => `Um recrutador do estúdio rival tentou levar ${e.name}. Foi o que se ouviu pelos corredores.`,
    opts: [
      { id: 'contra', label: 'Fazer contraproposta (+10% de salário)', desc: 'Fica na empresa e o humor sobe.', ok: (s) => s.money >= 500, run: (s, e) => { e.salary = Math.round(e.salary * 1.1 / 10) * 10; mood(e, 12); return `${e.name} aceitou ficar com o aumento.`; } },
      { id: 'deixar', label: 'Desejar boa sorte', desc: 'A pessoa sai do estúdio.', auto: true, run: (s, e) => { s.employees = s.employees.filter((x) => x.id !== e.id); for (const o of crew(s)) mood(o, -3); return `${e.name} foi trabalhar no rival.`; } },
    ] },
  { id: 'mudanca', ico: '🚚', nome: 'Mudança de cidade', w: 0.7, cond: (s) => s.employees.length >= 3,
    txt: (s, e) => `${e.name} vai se mudar para outra cidade por causa da família do cônjuge.`,
    opts: [
      { id: 'remoto', label: 'Oferecer trabalho remoto', desc: 'Fica no time (produz 8% menos), humor +8.', run: (s, e) => { e.remote = true; mood(e, 8); return `${e.name} segue no time, agora em home office.`; } },
      { id: 'sair', label: 'Aceitar a saída', desc: 'A pessoa sai.', auto: true, run: (s, e) => { s.employees = s.employees.filter((x) => x.id !== e.id); return `${e.name} se mudou. O time sentiu falta.`; } },
    ] },
  { id: 'casamento', ico: '💍', nome: 'Casamento', w: 0.8,
    txt: (s, e) => `${e.name} vai se casar e convidou o estúdio inteiro.`,
    opts: [
      { id: 'festa', label: 'Dar o dia de folga e ir à festa', desc: 'Todos felizes (+6 de humor), 1 semana de folga para a pessoa.', run: (s, e) => { away(e, 1); for (const o of crew(s)) mood(o, 6); return 'A festa foi inesquecível e o time voltou mais unido.'; } },
      { id: 'presente', label: 'Mandar um presente', desc: 'Barato e simpático.', ok: (s) => s.money >= cashC(s, 150), auto: true, run: (s, e) => { spendIf(s, cashC(s, 150), 'equipe'); mood(e, 4); return `${e.name} agradeceu o presente.`; } },
    ] },
  { id: 'luto', ico: '🕯️', nome: 'Luto na família', w: 0.6,
    txt: (s, e) => `${e.name} perdeu alguém querido e está abatido(a).`,
    opts: [
      { id: 'folga', label: 'Dar uma semana de folga', desc: 'Respeito e acolhimento: humor +10.', run: (s, e) => { away(e, 1); mood(e, 10); return `${e.name} agradeceu o acolhimento.`; } },
      { id: 'normal', label: 'Manter a rotina', desc: 'Humor −10; a pessoa pensa em sair.', auto: true, run: (s, e) => { mood(e, -10); return `${e.name} ficou ressentido(a).`; } },
    ] },
  { id: 'curso', ico: '🎓', nome: 'Quer fazer um curso', w: 1.2,
    txt: (s, e) => `${e.name} pediu para fazer um curso de especialização nas horas livres.`,
    opts: [
      { id: 'pagar', label: 'Pagar o curso', desc: 'Custa dinheiro; habilidade principal +1 e humor +6.', ok: (s) => s.money >= cashC(s, 800), run: (s, e) => { spendIf(s, cashC(s, 800), 'treino'); const k = Object.entries(e.skills).sort((a, b) => b[1] - a[1])[0][0]; e.skills[k] = Math.min(20, e.skills[k] + 1); mood(e, 6); return `${e.name} voltou do curso mais afiado(a).`; } },
      { id: 'recusar', label: 'Recusar', desc: 'Humor −4.', auto: true, run: (s, e) => { mood(e, -4); return `${e.name} aceitou, mas ficou desanimado(a).`; } },
    ] },
  { id: 'burnout', ico: '🔥', nome: 'Sinais de esgotamento', w: 1.1, cond: (s) => crew(s).some((e) => e.energy < 40),
    pick: (s) => crew(s).filter((e) => e.energy < 40)[0],
    txt: (s, e) => `${e.name} está exausto(a): olheiras, café demais e respostas curtas.`,
    opts: [
      { id: 'descanso', label: 'Dar 2 semanas de descanso', desc: 'Energia e humor recuperam.', run: (s, e) => { away(e, 2); e.energy = 90; mood(e, 14); return `${e.name} voltou renovado(a).`; } },
      { id: 'seguir', label: 'Pedir só mais uma entrega', desc: 'Humor −10.', auto: true, run: (s, e) => { mood(e, -10); return `${e.name} entregou, mas não está bem.`; } },
    ] },
];
export const STAFF_BY_ID = Object.fromEntries(STAFF_EVENTS.map((e) => [e.id, e]));
export function staffCurrent(s) {
  const L = ensureStaffLife(s); if (!L.pending) return null; const ev = STAFF_BY_ID[L.pending.id]; const emp = s.employees.find((x) => x.id === L.pending.emp);
  if (!ev || !emp) { L.pending = null; return null; }
  return { ev, emp, week: L.pending.week, txt: ev.txt(s, emp) };
}
export function staffChoose(s, optId) {
  const c = staffCurrent(s); if (!c) return { err: 'nenhum evento pendente' }; const L = ensureStaffLife(s); const o = c.ev.opts.find((x) => x.id === optId); if (!o) return { err: 'opção inválida' };
  if (o.ok && !o.ok(s)) return { err: 'sem dinheiro suficiente' };
  const msg = o.run(s, c.emp); L.pending = null; L.n++; L.log.unshift({ w: s.week, id: c.ev.id, nome: c.ev.nome, emp: c.emp.name, opt: o.label, msg }); if (L.log.length > 12) L.log.length = 12;
  api.log(s, `${c.ev.ico} ${c.ev.nome}: ${msg}`, 'info'); return { msg };
}
/** Semanal: licenças/afastamentos correm; 5% de chance por semana (intervalo de 6 semanas) de surgir um evento; sem resposta em 3 semanas vale o padrão. */
export function tickStaffLife(s, evs) {
  const L = ensureStaffLife(s);
  for (const e of s.employees) if (e.away && --e.away.left <= 0) delete e.away;
  if (L.pending) {
    if (s.week - L.pending.week >= 3) { const c = staffCurrent(s); if (c) { const o = c.ev.opts.find((x) => x.auto) || c.ev.opts[c.ev.opts.length - 1]; const r = staffChoose(s, o.id); if (r.msg) evs.push({ type: 'news', txt: `${c.ev.ico} ${r.msg}` }); } }
    return;
  }
  const staff = crew(s); if (staff.length < 1 || s.week < 12 || s.week - L.last < 6 || !chance(s, 0.05)) return;
  const pool = STAFF_EVENTS.filter((e) => (!e.cond || e.cond(s)) && (s.week - (L.cd[e.id] ?? -99)) > 30); if (!pool.length) return;
  let tot = pool.reduce((a, e) => a + e.w, 0), r = rnd(s) * tot, pk = pool[0]; for (const e of pool) { r -= e.w; if (r <= 0) { pk = e; break; } }
  const emp = pk.pick ? pk.pick(s) : staff[Math.floor(rnd(s) * staff.length)]; if (!emp) return;
  L.pending = { id: pk.id, emp: emp.id, week: s.week }; L.last = s.week; L.cd[pk.id] = s.week; evs.push({ type: 'stafflife', id: pk.id, emp: emp.id });
}
/** Quem está afastado não produz; remoto produz 8% menos. */
export const isAway = (e) => !!e.away;
export const remoteMult = (e) => (e.remote ? 0.92 : 1);
