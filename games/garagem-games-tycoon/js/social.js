// Redes sociais fictícias dentro do jogo: posts, algoritmo simples, comentários/DMs, Discord, influenciadores, anúncios, crises.
// Sem DOM. Usa o RNG do estado (determinístico) e as operações de dinheiro injetadas por bind().
import * as D from './data.js';
import * as C from './catalog.js';
import { rnd, rint, pick, chance, clamp, gauss, shuffle, dateOf } from './util.js';
import { headline, attribFans } from './world.js';

let api = { earn() {}, spend() {}, log() {}, infl: () => 1 };
export function bind(a) { api = a; }

// ---------------------------------------------------------------- definições
/** disc: alcance "frio" por post; fconv: seguidores por alcance; wconv: wishlists por alcance; cpm: R$ por mil de alcance (anúncio). */
export const NET = {
  tuiter: { disc: 150, fconv: 0.020, wconv: 0.0035, eng: 0.035, cpm: 18, viral: 1.0, tail: 0 },
  instagrao: { disc: 120, fconv: 0.026, wconv: 0.0040, eng: 0.050, cpm: 25, viral: 0.8, tail: 0 },
  youtobe: { disc: 60, fconv: 0.040, wconv: 0.0080, eng: 0.060, cpm: 40, viral: 0.6, tail: 4 },
  tiktak: { disc: 500, fconv: 0.008, wconv: 0.0025, eng: 0.080, cpm: 12, viral: 2.0, tail: 0 },
  discorde: { disc: 0, fconv: 0.0, wconv: 0.0, eng: 0.20, cpm: 0, viral: 0, tail: 0 },
  redit: { disc: 260, fconv: 0.012, wconv: 0.0050, eng: 0.030, cpm: 8, viral: 1.2, tail: 1 },
  twitsh: { disc: 80, fconv: 0.030, wconv: 0.0060, eng: 0.070, cpm: 30, viral: 0.9, tail: 0 },
};
/** Tipos de post. h = horas da semana, en = energia, custo = R$, q = qualidade-base (0..1), skill = habilidade que ajuda, need = requisito. */
export const POSTS = [
  { id: 'devlog', net: 'tuiter', nome: 'Devlog em texto', h: 2, en: 3, custo: 0, q: 0.45, skill: 'd', viral: 0.6, need: 'algo', desc: 'Conte o que fez esta semana.' },
  { id: 'gif', net: 'tuiter', nome: 'GIF da mecânica', h: 3, en: 4, custo: 0, q: 0.55, skill: 't', viral: 1.3, need: 'proj', desc: 'Um loop curto mostrando algo satisfatório.' },
  { id: 'teaser', net: 'tuiter', nome: 'Teaser misterioso', h: 2, en: 3, custo: 0, q: 0.5, skill: 'g', viral: 1.0, need: 'proj', desc: 'Um pedaço de arte e um mistério.' },
  { id: 'meme', net: 'tuiter', nome: 'Meme sobre gamedev', h: 1, en: 1, custo: 0, q: 0.35, skill: 'r', viral: 1.6, need: null, desc: 'Barato, rápido e cheio de “eu também!”.' },
  { id: 'thread', net: 'tuiter', nome: 'Thread: como fiz', h: 4, en: 5, custo: 0, q: 0.6, skill: 'd', viral: 1.1, need: 'algo', desc: 'Conteúdo útil que os devs salvam e compartilham.' },
  { id: 'provocar', net: 'tuiter', nome: 'Opinião polêmica', h: 1, en: 1, custo: 0, q: 0.4, skill: 'r', viral: 2.4, need: null, risco: 0.14, desc: 'Gera cliques, mas pode virar crise.' },
  { id: 'arte', net: 'instagrao', nome: 'Arte do jogo', h: 3, en: 3, custo: 0, q: 0.5, skill: 'g', viral: 0.9, need: 'proj', desc: 'Concept art ou captura caprichada.' },
  { id: 'bastidores', net: 'instagrao', nome: 'Bastidores (home office)', h: 2, en: 2, custo: 0, q: 0.4, skill: null, viral: 0.8, need: null, desc: 'Sua mesa, café e gato.' },
  { id: 'reel', net: 'instagrao', nome: 'Reel de 15s', h: 4, en: 5, custo: 0, q: 0.55, skill: 'g', viral: 1.3, need: 'proj', desc: 'Vídeo curto com música.' },
  { id: 'devlog_video', net: 'youtobe', nome: 'Devlog em vídeo', h: 10, en: 10, custo: 0, q: 0.55, skill: 'd', viral: 0.6, need: 'algo', desc: 'Demorado, mas cria comunidade fiel.' },
  { id: 'trailer', net: 'youtobe', nome: 'Trailer oficial', h: 14, en: 12, custo: 250, q: 0.65, skill: 'g', viral: 1.0, need: 'proj', desc: 'O ativo mais importante da página de loja.' },
  { id: 'gameplay', net: 'youtobe', nome: 'Gameplay comentado', h: 8, en: 8, custo: 0, q: 0.5, skill: 't', viral: 0.7, need: 'proj', desc: 'Mostra o jogo de verdade.' },
  { id: 'clipe', net: 'tiktak', nome: 'Clipe vertical', h: 3, en: 3, custo: 0, q: 0.5, skill: 'g', viral: 1.8, need: 'proj', desc: 'O formato que mais viraliza hoje.' },
  { id: 'trend', net: 'tiktak', nome: 'Entrar na trend', h: 2, en: 2, custo: 0, q: 0.35, skill: null, viral: 2.4, need: null, desc: 'Dancinha do dev? Funciona (às vezes).' },
  { id: 'tutorial', net: 'tiktak', nome: 'Dica rápida de gamedev', h: 4, en: 4, custo: 0, q: 0.5, skill: 'd', viral: 1.2, need: 'algo', desc: 'Ensina algo em 30 segundos.' },
  { id: 'aviso', net: 'discorde', nome: 'Aviso no servidor', h: 0.5, en: 0, custo: 0, q: 0.5, skill: null, viral: 0, need: 'discord', desc: 'Novidades para os membros.' },
  { id: 'evento', net: 'discorde', nome: 'Evento (playtest ao vivo)', h: 3, en: 3, custo: 0, q: 0.6, skill: null, viral: 0, need: 'discord', desc: 'Membros testam e dão feedback.' },
  { id: 'enquete', net: 'discorde', nome: 'Enquete da comunidade', h: 1, en: 1, custo: 0, q: 0.5, skill: null, viral: 0, need: 'discord', desc: 'A comunidade escolhe algo do jogo.' },
  { id: 'topico', net: 'redit', nome: 'Tópico no subreddit de nicho', h: 2, en: 2, custo: 0, q: 0.45, skill: 'd', viral: 1.2, need: 'proj', risco: 0.05, desc: 'Honestidade vale mais que propaganda.' },
  { id: 'feedback', net: 'redit', nome: 'Pedir feedback', h: 3, en: 3, custo: 0, q: 0.55, skill: 'd', viral: 0.9, need: 'proj', desc: 'Críticas francas (e úteis).' },
  { id: 'showcase', net: 'redit', nome: 'Showcase de sábado', h: 4, en: 4, custo: 0, q: 0.5, skill: 'g', viral: 1.3, need: 'proj', desc: 'Dia semanal de mostrar projetos.' },
  { id: 'enq_mascote', net: 'tuiter', nome: 'Enquete: nome do mascote', h: 1, en: 1, custo: 0, q: 0.4, skill: 'r', viral: 1.0, need: null, desc: 'A internet vai sugerir algo impublicável. Divirta-se.' },
  { id: 'carrossel', net: 'instagrao', nome: 'Carrossel de curiosidades', h: 3, en: 3, custo: 0, q: 0.5, skill: 'g', viral: 1.0, need: 'proj', desc: '“10 coisas que você não sabia sobre o jogo”.' },
  { id: 'speedrun', net: 'youtobe', nome: 'Speedrun do protótipo', h: 6, en: 6, custo: 0, q: 0.5, skill: 't', viral: 0.9, need: 'proj', desc: 'Dev contra o próprio build, cronômetro na tela.' },
  { id: 'asmr', net: 'tiktak', nome: 'ASMR do teclado', h: 2, en: 2, custo: 0, q: 0.35, skill: null, viral: 1.7, need: null, desc: 'Teclas mecânicas e uma xícara de café. Funciona sem explicação.' },
  { id: 'duetar', net: 'tiktak', nome: 'Duetar um fã', h: 2, en: 2, custo: 0, q: 0.4, skill: 'g', viral: 1.5, need: 'proj', desc: 'Reage ao fã que jogou seu protótipo.' },
  { id: 'postmortem', net: 'redit', nome: 'Post-mortem honesto', h: 5, en: 5, custo: 0, q: 0.6, skill: 'd', viral: 1.1, need: 'algo', desc: 'O que deu errado e o que você faria diferente.' },
  { id: 'sorteio', net: 'discorde', nome: 'Sorteio de chaves', h: 1, en: 1, custo: 0, q: 0.5, skill: null, viral: 0, need: 'discord', desc: 'Dez chaves e uma comunidade ansiosa.' },
  { id: 'qa_live', net: 'twitsh', nome: 'Live de perguntas e respostas', h: 4, en: 5, custo: 0, q: 0.5, skill: null, viral: 0.9, need: 'algo', desc: 'Responde tudo, até a pergunta sobre o seu gato.' },
  { id: 'live', net: 'twitsh', nome: 'Live de desenvolvimento', h: 6, en: 7, custo: 0, q: 0.5, skill: null, viral: 0.8, need: 'algo', desc: 'Programar ao vivo conversando com o chat.' },
];
export const POST_BY_ID = Object.fromEntries(POSTS.map((p) => [p.id, p]));
export const NET_BY_ID = Object.fromEntries(C.NETWORKS.map((n) => [n.id, n]));
export const WEEK_HOURS = 40; // horas "dedicáveis" por semana (fundador)

// ---------------------------------------------------------------- estado
export function newSocial() {
  return {
    nets: Object.fromEntries(C.NETWORKS.map((n) => [n.id, { fol: 0, last: -99, posts: 0, eng: NET[n.id].eng, lastType: null, reach: 0, paid: 0, hist: [] }])),
    feed: [], inbox: [], nid: 1, hours: 0,
    discord: { open: false, members: 0, mods: 0, tox: 10, rules: false, bans: 0, lastEvent: -99, poll: null },
    infl: { sent: [], covered: [], week: 0 },
    crisis: null, crisisHist: [], rep: 55, memes: 0, wl: 0, wlHist: [], ads: [], totals: { organic: 0, paid: 0, viral: 0 },
  };
}
export function ensureSoc(s) { s.soc ??= newSocial(); return s.soc; }

export const totalFollowers = (s) => Object.entries(ensureSoc(s).nets).reduce((a, [id, n]) => a + (id === 'discorde' ? 0 : n.fol), 0);
const mkt = (s) => (s.employees[0].skills.m ?? 1);
const hasContent = (s, need) => {
  if (!need) return true;
  if (need === 'discord') return s.soc.discord.open;
  const p = s.project; const g = s.games.length > 0 || (s.world?.protos?.length > 0);
  if (need === 'algo') return !!p || g;
  if (need === 'proj') return !!(p && (p.phase >= 2 || p.stage === 'result' || p.weeks >= 3)) || s.games.some((x) => s.week - x.releaseWeek < 30) || (s.world?.protos?.length > 0);
  return true;
};
export function postBlock(s, def) {
  const soc = ensureSoc(s);
  if (def.net === 'discorde' && !soc.discord.open) return 'abra o servidor do Discorde primeiro';
  if (!hasContent(s, def.need)) return def.need === 'proj' ? 'precisa de um jogo/protótipo para mostrar (fase 2 ou mais)' : 'faça ou lance algo primeiro';
  if (soc.hours + def.h > WEEK_HOURS) return 'sem horas na semana (limite 40h)';
  if (s.employees[0].energy < def.en + 5) return 'você está sem energia';
  if (s.money < def.custo * api.infl(s)) return 'sem dinheiro';
  return null;
}

// ---------------------------------------------------------------- qualidade e alcance
function postQuality(s, def) {
  const e = s.employees[0];
  const sk = def.skill ? (e.skills[def.skill] ?? 0) / 20 : 0.2;
  const m = clamp(mkt(s) / 20, 0, 1);
  const prog = s.project ? clamp((s.project.d + s.project.t) / s.project.total, 0, 1) : (s.games.length ? clamp(s.games[s.games.length - 1].score / 10, 0, 1) : 0.3);
  const fresh = def.id === s.soc.nets[def.net].lastType ? -0.12 : 0;
  const q = def.q * 0.6 + sk * 0.18 + m * 0.12 + prog * 0.15 + fresh + gauss(s) * 0.07;
  return clamp(q, 0.05, 1);
}
function consistency(s, net) {
  const gap = s.week - s.soc.nets[net].last;
  return clamp(1.1 - gap / 8, 0.25, 1);
}
function trendBonus(s, def) {
  const t = s.world?.trend; const p = s.project;
  if (!t || !p) return 1;
  return (t.kind === 'genre' && (p.genre === t.id || p.sub === t.id)) && t.mult > 1 ? 1.35 : 1;
}
/** Converte alcance em hype/fãs/wishlist do jogo. */
function applyReach(s, net, reach, q, paid) {
  const soc = ensureSoc(s); const n = NET[net]; const st = soc.nets[net];
  const mult = paid ? 0.6 : 1;
  const fol = Math.round(reach * n.fconv * (0.3 + q) * mult * 10) / 10;
  st.fol += fol;
  const wl = reach * n.wconv * (0.4 + q) * mult * (net === 'discorde' ? 0 : 1);
  soc.wl += wl;
  const p = s.project;
  if (p) p.hype = clamp(p.hype + (reach / 1500) * (1 - p.hype / 110) * mult, 0, 100);
  const f = fol * 0.4; s.fans += f; attribFans(s, p?.genre || s.games[s.games.length - 1]?.genre, f);
  if (paid) { st.paid += reach; soc.totals.paid += reach; } else { st.reach += reach; soc.totals.organic += reach; }
  return { fol, wl };
}

// ---------------------------------------------------------------- postar
export function doPost(s, postId, opts = {}) {
  const soc = ensureSoc(s);
  const def = POST_BY_ID[postId]; if (!def) return 'post inválido';
  const err = postBlock(s, def); if (err) return err;
  const st = soc.nets[def.net]; const n = NET[def.net]; const e = s.employees[0];
  const cost = Math.round(def.custo * api.infl(s));
  if (cost) api.spend(s, 'marketing', cost);
  soc.hours += def.h; e.energy = clamp(e.energy - def.en, 5, 100);
  const q = postQuality(s, def);
  let reach = 0, viral = false, fol = 0;
  if (def.net === 'discorde') {
    const d = soc.discord;
    reach = Math.round(d.members * clamp(0.3 + q * 0.5, 0, 0.95));
    if (def.id === 'evento') { d.lastEvent = s.week; s.fan.mood = clamp(s.fan.mood + 4, 0, 100); if (s.project) s.project.bugs = Math.max(0, s.project.bugs - Math.min(3, d.members / 40)); d.tox = clamp(d.tox - 3, 0, 100); }
    if (def.id === 'enquete') { s.fan.mood = clamp(s.fan.mood + 2, 0, 100); if (s.project) s.project.hype = clamp(s.project.hype + 1, 0, 100); }
    if (def.id === 'aviso') s.fans += d.members * 0.01;
    const r = applyDiscord(s, reach, q);
    fol = r;
  } else {
    const cons = consistency(s, def.net);
    const trend = trendBonus(s, def);
    let r = (st.fol * 0.28 * cons + n.disc * Math.pow(q, 1.4) * trend) * (0.7 + rnd(s) * 0.6);
    const pViral = clamp(0.012 + Math.pow(q, 3) * 0.05 * def.viral * n.viral * trend, 0, 0.35);
    if (rnd(s) < pViral) { viral = true; r *= rint(s, 8, 35); soc.totals.viral++; }
    reach = Math.round(r);
    const res = applyReach(s, def.net, reach, q, false); fol = res.fol;
  }
  st.last = s.week; st.posts++; st.lastType = def.id;
  const likes = Math.round(reach * st.eng * (0.6 + q) * (viral ? 1.4 : 1));
  const shares = Math.round(likes * 0.07 * (viral ? 2 : 1));
  const comments = Math.round(likes * 0.06 + (viral ? likes * 0.03 : 0));
  const text = opts.text || captionFor(s, def);
  const post = { id: soc.nid++, w: s.week, net: def.net, type: def.id, nome: def.nome, txt: text, q: Math.round(q * 100) / 100, reach, likes, shares, comments, viral, fol: Math.round(fol * 10) / 10 };
  soc.feed.unshift(post); if (soc.feed.length > 40) soc.feed.pop();
  genComments(s, post, Math.min(6, Math.max(1, Math.round(comments / 4))));
  // reputação e risco
  soc.rep = clamp(soc.rep + (q - 0.5) * 2, 0, 100);
  if (def.risco && chance(s, def.risco * (soc.rep > 70 ? 0.7 : 1))) startCrisis(s, def.id === 'provocar' ? 'polemica' : 'selfpromo');
  if (viral) headline(s, `Post de ${s.studio.nome} viraliza no ${NET_BY_ID[def.net].nome}!`, 'social');
  if (viral && chance(s, 0.35)) soc.memes++;
  return { post };
}
function applyDiscord(s, reach, q) {
  const d = s.soc.discord;
  d.members = Math.round(d.members + (q > 0.55 ? Math.sqrt(reach) * 0.15 : 0));
  return 0;
}
function captionFor(s, def) {
  const p = s.project; const g = s.games[s.games.length - 1];
  const nm = p?.name || g?.name || 'meu jogo';
  const L = {
    devlog: [`Devlog: esta semana avancei no sistema de ${pick(s, ['pulo', 'inventário', 'diálogos', 'câmera', 'IA dos inimigos', 'save'])} de ${nm}.`, `Mais um dia, mais um bug. ${nm} segue em frente.`],
    gif: [`Olha como ficou o novo ${pick(s, ['pulo', 'dash', 'efeito de partículas', 'menu', 'sistema de combate'])}! ✨`, `Satisfatório demais ver isso funcionando. #gamedev`],
    teaser: [`Uma pista do que vem por aí em ${nm}… 👀`, `Algo se aproxima. Qual é o seu palpite?`],
    meme: [`Eu: “vou só ajustar uma cor”. Também eu, 4h depois: refatorando o motor inteiro.`, `Programador quando o bug some sozinho: “não mexe!”.`],
    thread: [`Thread 🧵 como eu fiz o ${pick(s, ['sistema de partículas', 'save game', 'mapa procedural', 'menu de pausa'])} em uma tarde.`],
    provocar: [`Opinião impopular: ${pick(s, ['pixel art não é tendência, é limitação feliz', 'jogos curtos são melhores que jogos de 100 horas', 'trailer demais, jogo de menos', 'todo indie deveria ter demo'])}.`],
    arte: [`Arte nova de ${nm}! Feedbacks são bem-vindos 🎨`], bastidores: [`Café, gato e código. Home office de dev solo.`, `Mesa organizada? Nunca. Mas o jogo avança.`],
    reel: [`15 segundos de ${nm}. Me diga o que achou!`], devlog_video: [`Devlog #${s.soc.nets.youtobe.posts + 1}: tudo sobre o desenvolvimento de ${nm}.`],
    trailer: [`Trailer oficial de ${nm}! Adicione à sua lista de desejos.`], gameplay: [`Gameplay comentado de ${nm} — primeira fase.`],
    clipe: [`POV: você jogando ${nm} 🔥`], trend: [`Entrei na trend do momento (me perdoem).`], tutorial: [`Dica rápida: como evitar que seu jogo trave logo na primeira fase.`],
    aviso: [`Atualização do jogo disponível! Confira as novidades.`], evento: [`Playtest ao vivo hoje à noite! Venham quebrar o jogo.`], enquete: [`Qual cor deve ter o herói? Votem!`],
    topico: [`[Showcase] Estou fazendo ${nm}, um ${pick(s, D.GENRES).nome.toLowerCase()} solo. Feedback?`], feedback: [`Peço feedback honesto sobre a demo de ${nm}.`], showcase: [`Sábado de showcase: ${nm}, semana ${s.project?.weeks || 1}.`],
    live: [`Live de desenvolvimento rolando agora. Vem bater papo!`],
  };
  return pick(s, L[def.id] || [`Novidades de ${nm}!`]);
}

// ---------------------------------------------------------------- comentários e DMs
const CM = {
  fan: ['Que lindo esse visual!', 'Já quero jogar!!', 'Adicionei na wishlist 🙌', 'A trilha ficou demais', 'Isso é a minha cara, parabéns!', 'Mais um dia esperando esse jogo 😍', 'Esse estúdio merece crescer!', 'Compartilhei com meus amigos', 'Cadê a demo?? Eu quero!', 'Apoio total, dev solo é guerreiro(a)'],
  duvida: ['Vai ter versão pra celular?', 'Qual a data de lançamento?', 'Vai ter demo?', 'Roda em PC fraco?', 'Quem fez a arte?', 'Qual motor você usa?', 'Vai ter tradução?', 'Quanto vai custar?'],
  sugestao: ['Seria legal ter modo cooperativo', 'Podia ter mais opções de dificuldade', 'Coloca um gato no jogo pf 🐱', 'Que tal um modo sem violência?', 'Dá pra adicionar suporte a controle?'],
  bug: ['Achei um bug na fase 2: o personagem atravessa a parede', 'Travou aqui na demo, print no privado', 'Texto cortado no celular', 'A física ficou estranha quando pula duas vezes'],
  troll: ['Parece jogo de celular de 2012', 'Mais um jogo indie genérico', 'Clone de {fr}', 'Ninguém pediu isso', 'Arte de IA, né?', 'Primeiro e último post que eu vejo', 'Devia desistir e ir fazer um app de delivery', '“dev solo” só desculpa para jogo mal feito'],
  spam: ['Compre seguidores baratos!', 'Ganhe dinheiro rápido com este link', 'Faço sua arte por R$ 10 (sem contrato)', 'Promovo seu jogo pra 1 milhão (pix primeiro)'],
};
const NAMES = ['pedrinho_gamer', 'ana.pixel', 'lucas_rpg', 'mari.plays', 'zecadocafe', 'gabi_dev', 'rafa.retro', 'tiagoplays', 'camila_cozy', 'dudu_speedrun', 'bia.indie', 'joaoPC', 'xX_sniper_Xx', 'nathy.games', 'marcos_old', 'luna.live'];
function genComments(s, post, n) {
  const soc = s.soc; const tox = s.fan.toxicShare;
  for (let i = 0; i < n; i++) {
    const r = rnd(s);
    let kind = 'fan';
    if (r < 0.12 + tox * 1.5 + (post.viral ? 0.12 : 0)) kind = 'troll';
    else if (r < 0.28) kind = 'duvida';
    else if (r < 0.38) kind = 'sugestao';
    else if (r < 0.46 && (s.project?.bugs > 4 || s.games.some((g) => g.bugs > 6))) kind = 'bug';
    else if (r < 0.50) kind = 'spam';
    let txt = pick(s, CM[kind]).replace('{fr}', pick(s, C.FRANCHISES)[0]);
    soc.inbox.unshift({ id: soc.nid++, w: s.week, net: post.net, from: pick(s, NAMES), kind, txt, post: post.id, status: 'novo' });
  }
  while (soc.inbox.length > 40) soc.inbox.pop();
}
export function genDM(s, kind, extra = {}) {
  const soc = ensureSoc(s);
  const from = extra.from || pick(s, NAMES);
  soc.inbox.unshift({ id: soc.nid++, w: s.week, net: extra.net || 'tuiter', from, kind, txt: extra.txt, post: null, status: 'novo', data: extra.data || null });
  while (soc.inbox.length > 40) soc.inbox.pop();
}
export const TONES = [['simpatico', '😊 Simpático'], ['profissional', '💼 Profissional'], ['zoeira', '😜 Zoeira'], ['ignorar', '🙈 Ignorar'], ['banir', '🚫 Banir/Silenciar']];
/** Responde um comentário/DM. Devolve {msg}. */
export function replyTo(s, id, tone) {
  const soc = ensureSoc(s);
  const it = soc.inbox.find((x) => x.id === id); if (!it || it.status !== 'novo') return 'indisponível';
  const e = s.employees[0];
  if (tone !== 'ignorar' && tone !== 'banir') { if (soc.hours + 0.3 > WEEK_HOURS) return 'sem horas na semana'; soc.hours += 0.3; }
  it.status = 'resolvido';
  let msg = '';
  const fan = ['fan', 'duvida', 'sugestao', 'bug'].includes(it.kind);
  if (it.kind === 'spam') { msg = tone === 'banir' ? 'Spam banido.' : 'Você respondeu um spam… 🤦'; if (tone !== 'banir') soc.rep = clamp(soc.rep - 1, 0, 100); }
  else if (it.kind === 'troll') {
    if (tone === 'ignorar' || tone === 'banir') { msg = tone === 'banir' ? 'Troll silenciado.' : 'Você ignorou. O troll perdeu a graça.'; if (tone === 'banir') soc.discord.bans += it.net === 'discorde' ? 1 : 0; }
    else if (tone === 'zoeira') {
      if (chance(s, 0.38)) { msg = 'Sua resposta zoeira viralizou! 😂 (+seguidores)'; const fol = rint(s, 8, 40); soc.nets[it.net].fol += fol; soc.memes++; s.fans += fol * 0.4; soc.rep = clamp(soc.rep + 3, 0, 100); headline(s, `Dev responde troll com classe e vira meme.`, 'social'); }
      else if (chance(s, 0.3)) { msg = 'A zoeira saiu pela culatra…'; startCrisis(s, 'polemica'); }
      else { msg = 'Ninguém ligou. O troll respondeu com um emoji.'; }
    } else if (tone === 'simpatico') { msg = chance(s, 0.4) ? 'O troll se desarmou e virou fã! 🥹' : 'Gentileza desarmou a discussão.'; if (msg.includes('fã')) s.fans += 2; soc.rep = clamp(soc.rep + 1.5, 0, 100); }
    else { msg = 'Resposta profissional. O assunto morreu.'; soc.rep = clamp(soc.rep + 0.5, 0, 100); }
  } else if (fan) {
    if (tone === 'ignorar') { msg = 'Sem resposta.'; s.fan.mood = clamp(s.fan.mood - 0.4, 0, 100); }
    else if (tone === 'banir') { msg = 'Você bloqueou um fã. Ops.'; s.fan.mood = clamp(s.fan.mood - 3, 0, 100); soc.rep = clamp(soc.rep - 2, 0, 100); }
    else {
      const bonus = tone === 'simpatico' ? 1 : tone === 'profissional' ? 0.7 : 0.8;
      msg = tone === 'zoeira' ? 'A galera riu junto. 😄' : 'Obrigado pelo carinho!';
      s.fan.mood = clamp(s.fan.mood + 0.8 * bonus, 0, 100); s.fans += 0.8 * bonus; s.fan.loyalShare = clamp(s.fan.loyalShare + 0.0008 * bonus, 0, 0.7);
      if (it.kind === 'bug' && s.project) { s.project.bugs = Math.max(0, s.project.bugs - 0.8); msg = 'Obrigado pelo relato! Bug anotado e corrigido. 🐛'; }
      if (it.kind === 'sugestao' && s.project && chance(s, 0.25)) { s.project.d += s.project.total * 0.006; msg = 'Boa ideia! Adicionei ao jogo.'; }
    }
  } else if (it.kind === 'streamer' || it.kind === 'jornalista') { return 'use a aba Influenciadores / Imprensa'; }
  e.energy = clamp(e.energy - (tone === 'ignorar' || tone === 'banir' ? 0 : 0.5), 5, 100);
  return { msg };
}

// ---------------------------------------------------------------- Discord (comunidade)
export function openDiscord(s) {
  const soc = ensureSoc(s); const d = soc.discord;
  if (d.open) return 'já está aberto';
  d.open = true; d.members = Math.round(3 + s.fans * 0.04); d.tox = 8;
  headline(s, `${s.studio.nome} abre servidor no Discorde.`, 'social');
  return null;
}
export const MOD_RULES = 'rules';
export function discordAction(s, what) {
  const d = ensureSoc(s).discord; if (!d.open) return 'abra o servidor primeiro';
  if (what === 'regras') { if (d.rules) return 'já definido'; d.rules = true; d.tox = Math.max(0, d.tox - 12); return null; }
  if (what === 'mod') {
    if (d.mods >= 4) return 'máximo de 4 moderadores';
    const loyal = Math.round(d.members * 0.1); if (loyal < 3 * (d.mods + 1)) return 'poucos membros para recrutar moderadores';
    d.mods++; d.tox = Math.max(0, d.tox - 8); return null;
  }
  if (what === 'bot') { const c = Math.round(120 * api.infl(s)); if (s.money < c) return 'sem dinheiro'; api.spend(s, 'marketing', c); d.bot = true; d.tox = Math.max(0, d.tox - 6); return null; }
  if (what === 'limpar') { if (d.tox < 20) return 'o servidor já está calmo'; if (ensureSoc(s).hours + 2 > WEEK_HOURS) return 'sem horas na semana'; s.soc.hours += 2; d.tox = Math.max(0, d.tox - 15); d.bans += rint(s, 1, 4); d.members = Math.max(0, d.members - rint(s, 0, 3)); return null; }
  return 'inválido';
}
function tickDiscord(s, evs) {
  const d = s.soc.discord; if (!d.open) return;
  const base = totalFollowers(s) * 0.0012 + s.fans * 0.0015;
  d.members = Math.max(0, Math.round(d.members * 0.995 + base * (1 - d.tox / 140)));
  const grow = d.members * 0.0015 * (1 + s.fan.toxicShare * 6) - d.mods * 0.15 - (d.rules ? 0.08 : 0) - (d.bot ? 0.06 : 0);
  d.tox = clamp(d.tox + grow + (s.project?.bugs > 12 ? 0.3 : 0) + (s.fan.mood < 35 ? 0.4 : -0.1), 0, 100);
  d.poll = null;
  if (d.tox > 70 && chance(s, 0.05 + (d.tox - 70) / 500)) startCrisis(s, 'discord');
  if (d.tox > 85) { d.members = Math.round(d.members * 0.97); s.fan.mood = clamp(s.fan.mood - 0.5, 0, 100); }
  s.fan.loyalShare = clamp(s.fan.loyalShare + (d.mods ? 0.0002 : 0), 0, 0.7);
}

// ---------------------------------------------------------------- influenciadores e streamers
export const INFLUENCERS = [...C.YOUTUBERS.map((x) => ({ ...x, kind: 'youtuber' })), ...C.STREAMERS.map((x) => ({ ...x, kind: 'streamer' }))];
export const INFL_BY_ID = Object.fromEntries(INFLUENCERS.map((x) => [x.id, x]));
export function sponsorCost(s, inf) { return Math.round(inf.seg * 0.06 * api.infl(s) / 10) * 10; }
function gameForInfluencer(s) {
  if (s.project && (s.project.phase >= 2 || s.project.stage === 'result' || s.project.weeks >= 4)) return { name: s.project.name, genre: s.project.genre, sub: s.project.sub, q: clamp((s.project.d + s.project.t) / s.project.total, 0.1, 1) * 8 - s.project.bugs * 0.08, proj: true };
  const g = s.games[s.games.length - 1];
  if (g && s.week - g.releaseWeek < 40) return { name: g.name, genre: g.genre, sub: g.sub, q: g.score - g.bugs * 0.08, proj: false };
  return null;
}
export function influencerChance(s, inf) {
  const g = gameForInfluencer(s); if (!g) return 0;
  const soc = ensureSoc(s);
  const match = inf.gosta.includes(g.genre) || inf.gosta.includes(g.sub) ? 1.5 : 0.7;
  const size = 1 / (1 + Math.pow(inf.seg / (3000 + totalFollowers(s) * 8 + s.fans * 5), 0.7));
  const quality = clamp(g.q / 8, 0.1, 1.2);
  const agency = s.press?.agency ? 1.4 : 1;
  return clamp(0.5 * size * match * quality * (0.6 + soc.rep / 150) * agency * 2.2, 0.01, 0.9);
}
export function sendKey(s, id, sponsor = false) {
  const soc = ensureSoc(s); const inf = INFL_BY_ID[id];
  if (!inf) return 'inválido';
  const g = gameForInfluencer(s); if (!g) return 'você precisa de um jogo/projeto jogável (fase 2+) para enviar';
  if (soc.infl.sent.some((x) => x.id === id && s.week - x.w < 12)) return 'já enviado recentemente';
  if (soc.hours + 0.5 > WEEK_HOURS) return 'sem horas na semana';
  const cost = sponsor ? sponsorCost(s, inf) : 0;
  if (sponsor && s.money < cost) return 'sem dinheiro';
  if (sponsor) api.spend(s, 'marketing', cost);
  soc.hours += 0.5;
  soc.infl.sent.push({ id, w: s.week, due: s.week + rint(s, 1, 3), sponsor, game: g.name, resolved: false, p: sponsor ? 1 : influencerChance(s, inf) });
  return null;
}
function tickInfluencers(s, evs) {
  const soc = s.soc;
  for (const x of soc.infl.sent) {
    if (x.resolved || s.week < x.due) continue;
    x.resolved = true;
    const inf = INFL_BY_ID[x.id]; const g = gameForInfluencer(s);
    if (!chance(s, x.p)) { x.result = 'ignorou'; if (chance(s, 0.35)) evs.push({ type: 'news', txt: `${inf.nome} não respondeu à sua chave.` }); continue; }
    const q = g ? g.q : 5;
    const tone = q >= 6.5 ? 'positivo' : q >= 4.5 ? 'misto' : 'negativo';
    const views = Math.round(inf.seg * (inf.kind === 'streamer' ? 0.03 : 0.09) * (0.6 + rnd(s) * 0.8) * (x.sponsor ? 0.9 : 1.1));
    const mult = tone === 'positivo' ? 1 : tone === 'misto' ? 0.5 : 0.15;
    const reach = Math.round(views * mult);
    const wl = reach * 0.0045 * (inf.gosta.includes(g?.genre) ? 1.3 : 0.9);
    soc.wl += wl; const fol = reach * 0.004;
    for (const n of ['youtobe', 'tuiter']) soc.nets[n].fol += fol / 2;
    s.fans += reach * 0.003; attribFans(s, g?.genre, reach * 0.003);
    if (s.project) s.project.hype = clamp(s.project.hype + (reach / 3000) * (tone === 'positivo' ? 1 : 0.4), 0, 100);
    x.result = tone; x.reach = reach; x.wl = Math.round(wl);
    soc.infl.covered.unshift({ ...x, nome: inf.nome }); soc.infl.covered = soc.infl.covered.slice(0, 12);
    soc.totals.organic += reach;
    headline(s, `${inf.nome} ${tone === 'positivo' ? 'elogia' : tone === 'misto' ? 'testa' : 'critica'} “${x.game}” (${numShort0(reach)} views).`, 'social');
    evs.push({ type: 'news', txt: `${inf.nome} cobriu seu jogo (${tone}) — ${numShort0(reach)} views.` });
    if (tone === 'negativo' && chance(s, 0.25)) startCrisis(s, 'bug_viral');
    if (x.sponsor && tone !== 'positivo' && chance(s, 0.2)) startCrisis(s, 'propaganda');
  }
  soc.infl.sent = soc.infl.sent.filter((x) => !x.resolved || s.week - x.due < 8);
  // DMs de streamers (quando sua fama permite)
  if (totalFollowers(s) > 120 && chance(s, 0.03)) genDM(s, 'streamer', { net: 'twitsh', from: pick(s, C.STREAMERS).nome, txt: 'Oi! Vi seu jogo por aí e curti. Pode me mandar uma chave pra eu jogar na live? (use a aba Influenciadores)' });
}
const numShort0 = (v) => (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : String(Math.round(v)));

// ---------------------------------------------------------------- anúncios e campanhas
export const AD_OPTIONS = [100, 500, 2000];
export function adCost(s, v) { return Math.round(v * api.infl(s)); }
export function buyAds(s, net, v) {
  const soc = ensureSoc(s); const n = NET[net];
  if (!n || !n.cpm) return 'sem anúncios nesta rede';
  if (!hasContent(s, 'proj')) return 'faça ou lance um jogo antes de anunciar';
  const c = adCost(s, v); if (s.money < c) return 'sem dinheiro';
  if (soc.ads.filter((a) => a.net === net && a.left > 0).length) return 'já há anúncio rodando nesta rede';
  api.spend(s, 'marketing', c);
  soc.ads.push({ net, budget: c, left: 2, per: c / 2 });
  return null;
}
function tickAds(s) {
  const soc = s.soc;
  for (const a of soc.ads) {
    if (a.left <= 0) continue; a.left--;
    const n = NET[a.net];
    const q = clamp(0.45 + mkt(s) / 40, 0.3, 0.8);
    const reach = Math.round((a.per / api.infl(s)) / n.cpm * 1000 * (0.75 + rnd(s) * 0.5) * (a.net === 'redit' ? 1 : 1));
    applyReach(s, a.net, reach, q, true);
  }
  soc.ads = soc.ads.filter((a) => a.left > 0 || s.week % 4 !== 0);
}
export const CAMPAIGNS = [
  { id: 'sorteio', nome: 'Sorteio de chaves', custo: 150, h: 3, desc: 'Compartilhe e ganhe uma chave. Muitos seguidores novos (e alguns oportunistas).' },
  { id: 'teaser_week', nome: 'Semana de teaser', custo: 0, h: 8, desc: '3 posts de teaser em sequência com contagem regressiva.' },
  { id: 'devlog_maratona', nome: 'Maratona de devlogs', custo: 0, h: 12, desc: 'Um devlog por rede em 3 dias. Cansa, mas cria presença.' },
];
export function runCampaign(s, id) {
  const soc = ensureSoc(s); const c = CAMPAIGNS.find((x) => x.id === id);
  if (!c) return 'inválido';
  if (!hasContent(s, 'proj')) return 'precisa de um jogo para mostrar';
  if (soc.hours + c.h > WEEK_HOURS) return 'sem horas na semana';
  const cost = Math.round(c.custo * api.infl(s)); if (s.money < cost) return 'sem dinheiro';
  if (s.employees[0].energy < 25) return 'você está exausto(a)';
  if (cost) api.spend(s, 'marketing', cost);
  soc.hours += c.h; s.employees[0].energy = clamp(s.employees[0].energy - 12, 5, 100);
  const base = 40 + totalFollowers(s) * 0.5;
  const q = clamp(0.5 + mkt(s) / 30 + gauss(s) * 0.08, 0.3, 0.9);
  const reach = Math.round(base * (id === 'sorteio' ? 3 : 2) * (0.7 + rnd(s) * 0.6));
  const r = applyReach(s, id === 'sorteio' ? 'tuiter' : 'instagrao', reach, q, false);
  if (id === 'sorteio') { soc.nets.tuiter.fol += reach * 0.02; soc.wl += reach * 0.01; }
  return { msg: `Campanha “${c.nome}”: alcance ${numShort0(reach)}, +${Math.round(r.fol)} seguidores.` };
}

// ---------------------------------------------------------------- crises
export const CRISES = {
  polemica: { nome: 'Polêmica nas redes', txt: 'Um post seu foi tirado de contexto e está bombando pelos motivos errados.', sev: 1 },
  bug_viral: { nome: 'Bug vira piada', txt: 'Um vídeo mostrando um bug do seu jogo está viralizando. Todo mundo está rindo (e não é com você).', sev: 1 },
  discord: { nome: 'Drama no Discorde', txt: 'Brigas e ofensas tomaram o servidor. Capturas de tela vazaram.', sev: 2 },
  cancelamento: { nome: 'Cancelamento', txt: 'Um grupo acusa seu estúdio de práticas questionáveis. A hashtag subiu nos trending topics.', sev: 3 },
  selfpromo: { nome: 'Acusação de spam', txt: 'Moderadores acusam você de autopromoção em excesso.', sev: 1 },
  propaganda: { nome: 'Propaganda não declarada', txt: 'Descobriram que uma “análise” foi patrocinada por você.', sev: 2 },
  plagio: { nome: 'Acusação de plágio', txt: 'Dizem que seu jogo é parecido demais com uma franquia famosa.', sev: 2 },
  crunch: { nome: 'Denúncia de crunch', txt: 'Um ex-colega diz que o estúdio explora a equipe com horas extras.', sev: 3 },
};
export const CRISIS_OPTIONS = [
  { id: 'desculpas', nome: 'Pedir desculpas publicamente', desc: 'Reduz o estrago, mas pode parecer fraqueza.' },
  { id: 'explicar', nome: 'Explicar com calma (thread)', desc: 'Funciona se a reputação for boa.' },
  { id: 'ignorar', nome: 'Ignorar e esperar passar', desc: 'Grátis. Crises leves passam; graves, não.' },
  { id: 'atacar', nome: 'Contra-atacar', desc: 'Arriscado. Pode virar meme… ou piorar muito.' },
  { id: 'pr', nome: 'Acionar a assessoria de imprensa', desc: 'Custa dinheiro; exige assessoria contratada.' },
];
export function startCrisis(s, kind) {
  const soc = ensureSoc(s);
  if (soc.crisis) return;
  const def = CRISES[kind]; if (!def) return;
  soc.crisis = { kind, w: s.week, left: 4 + def.sev * 2, sev: def.sev, txt: def.txt, nome: def.nome, resolved: false, pending: true };
  headline(s, `${s.studio.nome} no centro de polêmica: ${def.nome.toLowerCase()}.`, 'social');
}
export function respondCrisis(s, opt) {
  const soc = ensureSoc(s); const c = soc.crisis;
  if (!c || !c.pending) return 'sem crise';
  const rep = soc.rep / 100;
  let good = 0, msg = '';
  const roll = rnd(s);
  if (opt === 'desculpas') { good = 0.55 + rep * 0.2 - c.sev * 0.05; msg = roll < good ? 'As desculpas foram bem recebidas.' : 'Desculpas ignoradas pela internet.'; }
  else if (opt === 'explicar') { good = 0.3 + rep * 0.55 - c.sev * 0.05; msg = roll < good ? 'Sua explicação convenceu muita gente.' : 'Ninguém leu a thread inteira.'; }
  else if (opt === 'ignorar') { good = c.sev === 1 ? 0.6 : c.sev === 2 ? 0.3 : 0.1; msg = roll < good ? 'Passou. A internet esqueceu.' : 'O silêncio foi lido como culpa.'; }
  else if (opt === 'atacar') { good = 0.25 + (soc.memes > 3 ? 0.1 : 0); msg = roll < good ? 'Contra-ataque genial: virou meme a seu favor!' : 'Contra-ataque desastroso. Piorou tudo.'; }
  else if (opt === 'pr') {
    if (!s.press?.agency) return 'você não tem assessoria contratada';
    const c2 = Math.round(900 * api.infl(s)); if (s.money < c2) return 'sem dinheiro';
    api.spend(s, 'marketing', c2); good = 0.75 - c.sev * 0.05; msg = roll < good ? 'A assessoria conduziu a crise com maestria.' : 'Nem a assessoria conseguiu evitar o estrago.';
  } else return 'inválido';
  c.pending = false; c.res = roll < good ? 'bem' : 'mal';
  if (roll < good) { c.left = Math.max(1, Math.round(c.left / 2)); soc.rep = clamp(soc.rep + (opt === 'atacar' ? 8 : 2), 0, 100); if (opt === 'atacar') soc.memes++; }
  else { c.left += 2; c.sev = Math.min(3, c.sev + (opt === 'atacar' ? 1 : 0)); }
  return { msg, ok: roll < good };
}
function tickCrisis(s, evs) {
  const soc = s.soc; const c = soc.crisis;
  if (!c) {
    // gatilhos aleatórios
    const bugs = Math.max(s.project?.bugs || 0, ...s.games.filter((g) => s.week - g.releaseWeek < 12).map((g) => g.bugs));
    const p = 0.004 + bugs * 0.0008 + (soc.discord.open ? soc.discord.tox / 6000 : 0) + (s.fan.mood < 30 ? 0.01 : 0) + (totalFollowers(s) > 2000 ? 0.004 : 0);
    if (chance(s, p)) { const kind = pick(s, bugs > 8 ? ['bug_viral', 'bug_viral', 'polemica'] : s.employees.length > 4 ? ['polemica', 'crunch', 'cancelamento', 'plagio'] : ['polemica', 'plagio']); startCrisis(s, kind); }
    if (soc.crisis) evs.push({ type: 'crisis' });
    return;
  }
  if (c.pending) { if (s.week - c.w >= 2) { c.pending = false; c.res = 'omitido'; c.left += 2; soc.rep = clamp(soc.rep - 3, 0, 100); } else { return; } }
  // efeitos semanais
  const k = c.sev;
  const lose = Math.round(totalFollowers(s) * 0.012 * k);
  for (const id of Object.keys(soc.nets)) soc.nets[id].fol = Math.max(0, soc.nets[id].fol - lose / 4);
  s.fan.mood = clamp(s.fan.mood - 1.2 * k, 0, 100); s.fan.toxicShare = clamp(s.fan.toxicShare + 0.002 * k, 0.01, 0.4);
  soc.rep = clamp(soc.rep - 0.8 * k, 0, 100); soc.wl = Math.max(0, soc.wl * (1 - 0.01 * k));
  if (--c.left <= 0) { soc.crisisHist.unshift({ nome: c.nome, w: c.w, res: c.res || 'passou' }); soc.crisisHist = soc.crisisHist.slice(0, 8); soc.crisis = null; evs.push({ type: 'news', txt: 'A poeira baixou: a crise nas redes passou.' }); }
}

// ---------------------------------------------------------------- tick semanal
export function tickSocial(s, evs) {
  const soc = ensureSoc(s);
  soc.hours = 0;
  for (const id of Object.keys(soc.nets)) {
    const n = soc.nets[id];
    // cauda longa (YouTobe/Redit) e decaimento de seguidores inativos
    if (NET[id].tail && n.reach > 0) { const t = n.reach * 0.15; n.reach -= t; applyReach(s, id, t, 0.5, false); }
    if (id !== 'discorde' && s.week - n.last > 10) n.fol = Math.max(0, n.fol * 0.995);
    n.eng += (NET[id].eng * (0.8 + soc.rep / 250) - n.eng) * 0.05;
    n.hist.push(Math.round(n.fol)); if (n.hist.length > 40) n.hist.shift();
  }
  soc.wlHist.push(Math.round(soc.wl)); if (soc.wlHist.length > 40) soc.wlHist.shift();
  tickAds(s);
  tickDiscord(s, evs);
  tickInfluencers(s, evs);
  tickCrisis(s, evs);
  // inbox: itens antigos somem
  soc.inbox = soc.inbox.filter((x) => x.status === 'novo' ? s.week - x.w < 10 : s.week - x.w < 3);
  // reputação tende a 55
  soc.rep += (55 - soc.rep) * 0.01;
  // fama passiva: jogo lançado recentemente gera menções
  const rec = s.games.filter((g) => s.week - g.releaseWeek < 6);
  for (const g of rec) if (chance(s, 0.25)) genComments(s, { id: 0, net: pick(s, ['tuiter', 'redit', 'tiktak']), viral: false }, 1);
  soc.wl = Math.max(0, soc.wl * 0.998);
}
/** Multiplicador de produtividade do fundador por conta do tempo gasto em redes. */
export function founderTimeMult(s) {
  const h = s.soc?.hours || 0;
  return clamp(1 - (h / WEEK_HOURS) * 0.8, 0.2, 1);
}
/** Consome as wishlists acumuladas no lançamento (ou parte delas): devolve unidades extras. */
export function consumeWishlists(s, conv = 0.12) {
  const soc = ensureSoc(s); const wl = Math.round(soc.wl);
  soc.wl = soc.wl * 0.25; // 75% saem da lista (compraram ou perderam o interesse)
  return { wl, units: Math.round(wl * conv) };
}
