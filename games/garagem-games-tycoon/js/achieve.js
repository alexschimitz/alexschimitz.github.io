// Conquistas da v0.7 (testes puros sobre o estado). As definições de nome/descrição ficam aqui e são anexadas a D.ACHIEVEMENTS.
import * as D from './data.js';

const n = (s) => s.games.length;
const best = (s) => s.games.reduce((a, g) => Math.max(a, g.score), 0);
const cnt = (s, f) => s.games.filter(f).length;
const done = (s) => Object.keys(s.research?.done || {}).length;
const avgMood = (s) => { const c = s.employees.filter((e) => !e.founder); return c.length ? c.reduce((a, e) => a + (e.mood ?? 60), 0) / c.length : 0; };
const streak8 = (s) => { let r = 0, cur = 0; for (const g of s.games) { cur = g.score >= 8 ? cur + 1 : 0; r = Math.max(r, cur); } return r; };
const years = (s) => Math.floor(s.week / 48);
const storesOf = (s) => new Set(s.games.flatMap((g) => Object.keys(g.ind?.stores || {})));

export const EXTRA = [
  ['nota10', 'Perfeição', 'Tire nota 10 em um jogo.', '🏅', (s) => best(s) >= 10],
  ['tres_7', 'Consistência', 'Tenha 3 jogos com nota 7+.', '📈', (s) => cnt(s, (g) => g.score >= 7) >= 3],
  ['streak8', 'Sequência de ouro', '3 lançamentos seguidos com nota 8+.', '🔥', (s) => streak8(s) >= 3],
  ['vinte_jogos', 'Linha de produção', 'Lance 20 jogos.', '🏭', (s) => n(s) >= 20],
  ['copias100k', 'Cem mil cópias', 'Venda 100 mil unidades no total.', '💿', (s) => s.stats.units >= 1e5],
  ['copias1m', 'Fenômeno de vendas', 'Venda 1 milhão de unidades no total.', '🌎', (s) => s.stats.units >= 1e6],
  ['fas10k', 'Torcida organizada', 'Alcance 10.000 fãs.', '📣', (s) => s.fans >= 1e4],
  ['fas200k', 'Estádio lotado', 'Alcance 200.000 fãs.', '🏟️', (s) => s.fans >= 2e5],
  ['fas1m', 'Ídolo nacional', 'Alcance 1.000.000 de fãs.', '🌟', (s) => s.fans >= 1e6],
  ['dez_mi', 'Dez milhões', 'Tenha R$ 10.000.000 em caixa.', '💎', (s) => s.money >= 1e7],
  ['fatura1m', 'Primeiro milhão faturado', 'Fature R$ 1.000.000 no total.', '💵', (s) => s.stats.revenue >= 1e6],
  ['fatura50m', 'Gigante do setor', 'Fature R$ 50.000.000 no total.', '🏦', (s) => s.stats.revenue >= 5e7],
  ['time5', 'Mesa cheia', 'Tenha 5 pessoas no estúdio.', '👥', (s) => s.employees.length >= 5],
  ['time10', 'Equipe de verdade', 'Tenha 10 pessoas no estúdio.', '🧑‍🤝‍🧑', (s) => s.employees.length >= 10],
  ['time20', 'Quase uma firma', 'Tenha 20 pessoas no estúdio.', '🏢', (s) => s.employees.length >= 20],
  ['escritorio3', 'Andar inteiro', 'Chegue ao escritório nível 3.', '🏬', (s) => s.office >= 2],
  ['arranha', 'Torre dos games', 'Chegue ao último escritório.', '🗼', (s) => s.office >= 3],
  ['pesq10', 'Laboratório ativo', 'Conclua 10 pesquisas.', '🧪', (s) => done(s) >= 10],
  ['pesq30', 'Mente brilhante', 'Conclua 30 pesquisas.', '🔬', (s) => done(s) >= 30],
  ['premios3', 'Estante de troféus', 'Ganhe 3 prêmios anuais.', '🏆', (s) => s.awards.length >= 3],
  ['premios10', 'Hall da fama', 'Ganhe 10 prêmios anuais.', '👑', (s) => s.awards.length >= 10],
  ['anos10', 'Uma década', 'Complete 10 anos de estúdio.', '🎂', (s) => years(s) >= 10],
  ['anos20', 'Lenda viva', 'Complete 20 anos de estúdio.', '🗿', (s) => years(s) >= 20],
  ['subsolo', 'Sala dos servidores', 'Abra o subsolo no mapa de construção.', '🖥️', (s) => !!s.map?.floors?.includes(-1)],
  ['andar2', 'Escada para o sucesso', 'Abra um 2º andar no escritório.', '🪜', (s) => !!s.map?.floors?.includes(1)],
  ['decorador', 'Decorador', 'Tenha 30 itens no mapa do escritório.', '🖼️', (s) => (s.map?.items?.length || 0) >= 30],
  ['rede5', 'Rede de contatos', 'Conheça 5 pessoas na cidade.', '🤝', (s) => (s.city?.people?.length || 0) >= 5],
  ['feira1', 'Fui à feira', 'Participe de uma feira de games.', '🎪', (s) => Object.keys(s.world?.fairs || {}).length >= 1],
  ['feira3', 'Habitué das feiras', 'Participe de 3 feiras.', '🎟️', (s) => Object.keys(s.world?.fairs || {}).length >= 3],
  ['colunista', 'Colunista amigo', 'Fique amigo de um colunista.', '🗞️', (s) => Object.values(s.media?.rel || {}).some((v) => v >= 3)],
  ['treta', 'Treta na imprensa', 'Cause uma briga entre dois colunistas.', '🥊', (s) => (s.media?.feuds || 0) >= 1],
  ['meme', 'Virei meme', 'Tenha um jogo que vire meme.', '😂', (s) => (s.media?.memes?.length || 0) >= 1],
  ['ama', 'Pergunte-me qualquer coisa', 'Faça um AMA em um subreddit.', '💬', (s) => Object.values(s.media?.subs || {}).some((x) => x.last > -99)],
  ['crise', 'Crise? Que crise?', 'Atravesse uma crise econômica e continue com mais de R$ 50 mil.', '🛟', (s) => (s.mkt?.log || []).some((l) => l.id === 'crise' || l.id === 'inflacao') && s.money > 50000 && s.week > 60],
  ['cenario', 'Missão cumprida', 'Cumpra a meta de um cenário.', '🎯', (s) => s.scn?.done != null],
  ['brutal', 'Sobrevivente brutal', 'Sobreviva 3 anos na dificuldade Brutal.', '💀', (s) => s.diff === 'brutal' && s.week >= 144 && !s.over],
  ['humor', 'Chefe querido', 'Tenha 4+ funcionários com humor médio acima de 70.', '😊', (s) => s.employees.length >= 5 && avgMood(s) >= 70],
  ['promo', 'Promoção interna', 'Promova alguém a Sênior.', '⬆️', (s) => s.employees.some((e) => (e.rank || 0) >= 2)],
  ['logo', 'Marca própria', 'Personalize a identidade do estúdio.', '🎨', (s) => !!s.flags?.brand],
  ['cerimonia', 'Tapete vermelho', 'Participe da cerimônia de premiação.', '🎭', (s) => !!s.flags?.ceremony],
  ['lojas3', 'Em todas as lojas', 'Publique jogos em 3 lojas diferentes (indie).', '🛍️', (s) => storesOf(s).size >= 3],
  ['traduzido', 'Poliglota', 'Traduza um jogo para 3 idiomas (indie).', '🌐', (s) => s.games.some((g) => Object.keys(g.ind?.loc || {}).length >= 3)],
  ['indie50k', 'Indie de sucesso', 'Chegue a R$ 50.000 em caixa no modo indie.', '🌱', (s) => s.mode === 'indie' && s.money >= 5e4],
  ['staffvida', 'Família do estúdio', 'Resolva 3 eventos de vida da equipe.', '🧸', (s) => (s.slife?.n || 0) >= 3],
  ['clima', 'Debaixo de chuva', 'Lance um jogo em uma semana de chuva.', '🌧️', (s) => !!s.flags?.rainRelease],
];
export const TESTS = Object.fromEntries(EXTRA.map(([id, , , , f]) => [id, f]));
for (const [id, nome, desc, ico] of EXTRA) if (!D.ACHIEVEMENTS.some((a) => a.id === id)) D.ACHIEVEMENTS.push({ id, nome, desc, ico });
