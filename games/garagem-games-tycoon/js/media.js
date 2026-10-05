// Mídia (v0.7): colunistas nomeados com rivalidades, memes, subreddits fictícios e AMAs. Lógica pura, sem DOM.
import * as C from './catalog.js';
import { rnd, rint, pick, chance, clamp, gauss } from './util.js';
import { headline, attribFans } from './world.js';
import { ensureSoc, WEEK_HOURS } from './social.js';

let api = { spend() {}, log() {}, infl: () => 1 };
export function bind(a) { api = { ...api, ...a }; }

/** Colunistas: sempre em pares rivais (feud). vies: >0 generoso, <0 ranzinza. */
export const COLUMNISTS = [
  { id: 'rick', nome: 'Rick Ranzinza', outlet: 'igm', vies: -0.9, estilo: 'ranzinza', rival: 'dani', ico: '😤' },
  { id: 'dani', nome: 'Dani Dengo', outlet: 'kotako', vies: 0.8, estilo: 'otimista', rival: 'rick', ico: '🥰' },
  { id: 'pixelaldo', nome: 'Professor Pixelaldo', outlet: 'pcgamer', vies: -0.6, estilo: 'técnico', rival: 'carlinha', ico: '🧐' },
  { id: 'carlinha', nome: 'Carlinha Casual', outlet: 'gamerbr', vies: 0.6, estilo: 'popular', rival: 'pixelaldo', ico: '🍿' },
  { id: 'zeretro', nome: 'Zé Retrô', outlet: 'famitzu', vies: -0.3, estilo: 'nostálgico', rival: 'nina', ico: '👾' },
  { id: 'nina', nome: 'Nina Next-Gen', outlet: 'polygan', vies: 0.2, estilo: 'tecnófila', rival: 'zeretro', ico: '🚀' },
  { id: 'tiaju', nome: 'Tia Ju das Indies', outlet: 'indiezao', vies: 0.9, estilo: 'apoiadora', rival: 'metacritico', ico: '🌻' },
  { id: 'metacritico', nome: 'Mestre Metacrítico', outlet: 'gameinformar', vies: -0.7, estilo: 'cético', rival: 'tiaju', ico: '📊' },
  { id: 'sergio', nome: 'Sérgio Sandbox', outlet: 'sandboxer', vies: 0.1, estilo: 'criativo', rival: 'bia', ico: '🧱' },
  { id: 'bia', nome: 'Bia Bit', outlet: 'pixeldesk', vies: 0.5, estilo: 'afetuosa', rival: 'sergio', ico: '🎀' },
  { id: 'susto', nome: 'Madame Susto', outlet: 'terrorpedia', vies: -0.2, estilo: 'sombria', rival: 'leo', ico: '🕯️' },
  { id: 'leo', nome: 'Léo Ritmo', outlet: 'ritmoeplay', vies: 0.4, estilo: 'animado', rival: 'susto', ico: '🎧' },
];
export const COL_BY_ID = Object.fromEntries(COLUMNISTS.map((c) => [c.id, c]));
const OUT = Object.fromEntries(C.OUTLETS.map((o) => [o.id, o]));

const TONE_TXT = {
  amor: ['“{jogo}” é o tipo de jogo que faz a gente lembrar por que ama este hobby.', 'Fui jogar “{jogo}” por 10 minutos e a noite acabou. Obrigado, {estudio}.', '“{jogo}” merece estar na sua lista do ano.'],
  ok: ['“{jogo}” cumpre o que promete, sem fazer barulho.', 'Divertido na medida certa: “{jogo}” não muda a indústria, mas aquece o coração.', '“{jogo}” tem boas ideias e outras nem tanto. Vale a promoção.'],
  odio: ['“{jogo}” tropeça nas próprias ambições. A {estudio} precisa voltar à prancheta.', 'Passei duas horas com “{jogo}” e senti que perdi três.', 'Não é que “{jogo}” seja ruim; é que parece não saber o que quer ser.'],
};
export function newMedia() {
  return { rel: {}, cols: [], memes: [], subs: Object.fromEntries(SUBS.map((x) => [x.id, { mood: 50, members: x.membros, last: -99 }])), cd: {}, feuds: 0 };
}
export function ensureMedia(s) { s.media ??= newMedia(); for (const k of Object.keys(newMedia())) s.media[k] ??= newMedia()[k]; for (const x of SUBS) s.media.subs[x.id] ??= { mood: 50, members: x.membros, last: -99 }; return s.media; }
export const relOf = (s, id) => ensureMedia(s).rel[id] || 0;

// ---------------------------------------------------------------- subreddits fictícios
export const SUBS = [
  { id: 'gamerbr', nome: 'r/GamerBR', membros: 1_200_000, gosta: ['acao', 'tiro', 'rpg', 'esporte'], tom: 'geral' },
  { id: 'devsbr', nome: 'r/DevsDeJogosBR', membros: 180_000, gosta: ['plataforma', 'puzzle', 'roguelike', 'sandbox'], tom: 'devs' },
  { id: 'indiebr', nome: 'r/IndieBrasil', membros: 95_000, gosta: ['narrativo', 'roguelike', 'plataforma', 'puzzle'], tom: 'indie' },
  { id: 'retrobr', nome: 'r/JogosAntigosBR', membros: 240_000, gosta: ['plataforma', 'luta', 'aventura'], tom: 'retrô' },
  { id: 'rpgmesa', nome: 'r/RPGdeMesaeTela', membros: 130_000, gosta: ['rpg', 'estrategia', 'narrativo'], tom: 'rpg' },
  { id: 'terror', nome: 'r/TerrorNaMadrugada', membros: 160_000, gosta: ['terror', 'aventura', 'narrativo'], tom: 'terror' },
  { id: 'sims', nome: 'r/SimuladoresBR', membros: 110_000, gosta: ['simulacao', 'sandbox', 'estrategia'], tom: 'sims' },
  { id: 'casual', nome: 'r/JogosCasuaisBR', membros: 300_000, gosta: ['casual', 'musical', 'puzzle'], tom: 'casual' },
];
export const SUB_BY_ID = Object.fromEntries(SUBS.map((x) => [x.id, x]));

// ---------------------------------------------------------------- memes
export const MEMES = {
  bom: ['“A fase do queijo”', '“Calma, que o chefe é fácil”', '“Já fiz 100% e mesmo assim voltei”', '“O NPC do pastel”', '“Só mais um turno”', '“Tá bonito, tá bonito”'],
  bug: ['“O cavalo que voa”', '“Atravessei a parede e achei o paraíso”', '“A porta que não abre nunca”', '“Meu herói virou ioiô”', '“Cadê o chão?”', '“Colisão de bolo”'],
  flop: ['“Nota 4 e orgulho”', '“Baixei só pra rir”', '“Quem aprovou isso?”', '“Foi só um teste”', '“Esse tutorial dura uma eternidade”'],
};
function maybeMeme(s, g) {
  const M = ensureMedia(s); let kind = null;
  if (g.score >= 8.5 && chance(s, 0.55)) kind = 'bom'; else if (g.bugs >= 6 && chance(s, 0.6)) kind = 'bug'; else if (g.score < 4.5 && chance(s, 0.35)) kind = 'flop';
  if (!kind) return null;
  const txt = pick(s, MEMES[kind]); const vir = Math.round((0.4 + rnd(s)) * 100) / 100;
  const m = { id: M.memes.reduce((a, x) => Math.max(a, x.id), 0) + 1, w: s.week, kind, txt, game: g.name, vir, used: false };
  M.memes.unshift(m); if (M.memes.length > 20) M.memes.pop();
  const gain = Math.round((20 + 120 * vir) * (kind === 'flop' ? 0.4 : 1)); s.fans += gain; attribFans(s, g.genre, gain);
  s.world.buzz = clamp((s.world.buzz || 0) + 3 + 4 * vir, 0, 30);
  headline(s, kind === 'bom' ? `O meme ${txt} de “${g.name}” domina as redes.` : kind === 'bug' ? `Bug de “${g.name}” vira meme: ${txt}.` : `“${g.name}” vira piada na internet: ${txt}.`, 'estudio');
  m.gain = gain; return m;
}
/** Assumir o meme com bom humor: dobra o alcance (1x por meme); 35% de chance de azedar se for meme de flop. */
export function embrace(s, id) {
  const M = ensureMedia(s); const m = M.memes.find((x) => x.id === id); if (!m) return { err: 'meme inexistente' }; if (m.used) return { err: 'você já respondeu a esse meme' };
  if (s.mode === 'indie') { const soc = ensureSoc(s); if (WEEK_HOURS - soc.hours < 2) return { err: 'sem horas livres esta semana (2h)' }; soc.hours += 2; }
  m.used = true;
  if (m.kind === 'flop' && chance(s, 0.35)) { const l = Math.round(15 + 40 * m.vir); s.fans = Math.max(0, s.fans - l); return { msg: `Foi mal interpretado e rendeu críticas: −${l} fãs.`, bad: true }; }
  const g = Math.round((30 + 140 * m.vir) * (m.kind === 'bug' ? 0.8 : 1)); s.fans += g; s.world.buzz = clamp((s.world.buzz || 0) + 3, 0, 30);
  return { msg: `Você entrou na brincadeira! +${g} fãs.` };
}

// ---------------------------------------------------------------- colunas
function writeColumn(s, col, g) {
  const M = ensureMedia(s); const o = OUT[col.outlet];
  const fit = o?.gosta?.includes(g.genre) ? 0.3 : 0;
  const v = g.score + col.vies * 1.2 + relOf(s, col.id) * 0.25 + fit + gauss(s) * 0.5;
  const tone = v >= 7.4 ? 'amor' : v >= 5.6 ? 'ok' : 'odio';
  const txt = pick(s, TONE_TXT[tone]).replace('{jogo}', g.name).replace('{estudio}', s.studio.nome);
  const reach = (o?.alcance || 2);
  const fans = Math.round((tone === 'amor' ? 1 : tone === 'odio' ? -0.6 : 0.25) * reach * 9 * (1 + 0.1 * Math.max(0, relOf(s, col.id))));
  s.fans = Math.max(0, s.fans + fans); if (fans > 0) attribFans(s, g.genre, fans);
  const entry = { w: s.week, col: col.id, tone, txt, game: g.name, fans, v: Math.round(v * 10) / 10 };
  M.cols.unshift(entry); if (M.cols.length > 24) M.cols.pop();
  return entry;
}
/** No lançamento: um colunista de cada lado de uma rivalidade comenta o jogo; opiniões opostas viram "treta" e geram buzz. */
export function onRelease(s, g, evs) {
  const M = ensureMedia(s);
  const fav = COLUMNISTS.filter((c) => OUT[c.outlet]?.gosta?.includes(g.genre));
  const a = chance(s, 0.7) && fav.length ? pick(s, fav) : pick(s, COLUMNISTS); const b = COL_BY_ID[a.rival];
  const ea = writeColumn(s, a, g), eb = chance(s, 0.85) ? writeColumn(s, b, g) : null;
  if (eb && (Math.abs(ea.v - eb.v) >= 2 || (ea.tone === 'amor' && eb.tone === 'odio') || (ea.tone === 'odio' && eb.tone === 'amor'))) {
    M.feuds++; s.world.buzz = clamp((s.world.buzz || 0) + 6, 0, 30);
    headline(s, `${a.nome} e ${b.nome} brigam por causa de “${g.name}”.`, 'mundo');
    evs.push({ type: 'news', txt: `🗞️ Treta na imprensa: ${a.nome} × ${b.nome} sobre “${g.name}”.` });
  } else evs.push({ type: 'news', txt: `🗞️ ${a.nome} escreveu sobre “${g.name}”: ${ea.tone === 'amor' ? 'elogios' : ea.tone === 'odio' ? 'críticas duras' : 'opinião morna'}.` });
  maybeMeme(s, g);
  for (const x of SUBS) {
    const st = M.subs[x.id]; const likes = x.gosta.includes(g.genre);
    st.mood = clamp(st.mood + (g.score - 6.3) * (likes ? 5 : 2.2), 0, 100);
    st.members = Math.round(st.members * (1 + (likes ? 0.004 : 0.001) * (g.score - 5)));
  }
}
export function interviewBlock(s, id) {
  const M = ensureMedia(s); const c = COL_BY_ID[id]; if (!c) return 'colunista inexistente';
  if (s.week - (M.cd['i' + id] ?? -99) < 8) return 'aguarde: essa entrevista foi há pouco tempo';
  if (s.mode === 'indie') { if (WEEK_HOURS - ensureSoc(s).hours < 4) return 'sem horas livres esta semana (4h)'; } else if (s.money < interviewCost(s)) return 'sem dinheiro';
  return null;
}
export const interviewCost = (s) => Math.round(400 * api.infl(s) / 50) * 50;
export function interview(s, id) {
  const b = interviewBlock(s, id); if (b) return { err: b };
  const M = ensureMedia(s); const c = COL_BY_ID[id];
  if (s.mode === 'indie') ensureSoc(s).hours += 4; else api.spend(s, 'imprensa', interviewCost(s));
  M.cd['i' + id] = s.week; M.rel[id] = clamp((M.rel[id] || 0) + 1, -3, 5); M.rel[c.rival] = clamp((M.rel[c.rival] || 0) - 1, -3, 5);
  const o = OUT[c.outlet]; const f = Math.round(12 * (o?.alcance || 2)); s.fans += f; s.world.buzz = clamp((s.world.buzz || 0) + 2, 0, 30);
  headline(s, `${c.nome} publica entrevista exclusiva com ${s.studio.nome}.`, 'estudio');
  return { msg: `${c.nome} gostou da conversa: relação ${M.rel[id]}, +${f} fãs. ${COL_BY_ID[c.rival].nome} torceu o nariz.` };
}
export function amaBlock(s, id) {
  const M = ensureMedia(s); if (!SUB_BY_ID[id]) return 'subreddit inexistente';
  if (s.week - M.subs[id].last < 12) return 'você fez um AMA aqui há pouco tempo';
  if (!s.games.length) return 'lance um jogo antes de pedir a palavra';
  if (s.mode === 'indie') { if (WEEK_HOURS - ensureSoc(s).hours < 3) return 'sem horas livres esta semana (3h)'; } else if (s.money < 300) return 'sem dinheiro';
  return null;
}
/** AMA (“pergunte-me qualquer coisa”): bom humor da comunidade => fãs; humor ruim vira bomba. */
export function ama(s, id) {
  const b = amaBlock(s, id); if (b) return { err: b };
  const M = ensureMedia(s); const x = SUB_BY_ID[id], st = M.subs[id];
  if (s.mode === 'indie') ensureSoc(s).hours += 3; else api.spend(s, 'imprensa', 300);
  st.last = s.week;
  const best = s.games.slice(-3).reduce((a, g) => Math.max(a, g.score), 0);
  const quality = clamp((st.mood - 30) / 40 + (best - 6) * 0.12, -0.6, 1.4);
  const base = Math.round(st.members / 10000 * 4 * Math.abs(quality) * (0.8 + rnd(s) * 0.4));
  if (quality < 0) { const l = Math.min(s.fans, base); s.fans -= l; st.mood = clamp(st.mood - 4, 0, 100); return { msg: `O AMA em ${x.nome} azedou: −${l} fãs.`, bad: true }; }
  s.fans += base; attribFans(s, s.games[s.games.length - 1].genre, base); st.mood = clamp(st.mood + 6, 0, 100); st.members = Math.round(st.members * 1.01);
  return { msg: `AMA em ${x.nome}: +${base} fãs e o clima melhorou.` };
}
export function tickMedia(s) {
  const M = ensureMedia(s);
  for (const x of SUBS) M.subs[x.id].mood += (50 - M.subs[x.id].mood) * 0.03;
}
