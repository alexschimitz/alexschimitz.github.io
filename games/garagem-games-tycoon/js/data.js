// Dados do jogo: temas, gêneros, compatibilidade, plataformas, categorias, pesquisa, etc.
// Tudo original e em pt-BR.

export const GENRES = [
  { id: 'acao', nome: 'Ação' },
  { id: 'aventura', nome: 'Aventura' },
  { id: 'rpg', nome: 'RPG' },
  { id: 'simulacao', nome: 'Simulação' },
  { id: 'estrategia', nome: 'Estratégia' },
  { id: 'casual', nome: 'Casual' },
  // v0.2: novos gêneros (herdam a compatibilidade de um gênero-base, com pequenas variações)
  { id: 'plataforma', nome: 'Plataforma', base: 'acao' },
  { id: 'puzzle', nome: 'Quebra-cabeça', base: 'casual' },
  { id: 'tiro', nome: 'Tiro', base: 'acao' },
  { id: 'luta', nome: 'Luta', base: 'acao' },
  { id: 'roguelike', nome: 'Roguelike', base: 'rpg' },
  { id: 'narrativo', nome: 'Narrativo', base: 'aventura' },
  // v0.7: +4 gêneros
  { id: 'musical', nome: 'Musical', base: 'casual' },
  { id: 'terror', nome: 'Terror', base: 'aventura' },
  { id: 'esporte', nome: 'Esporte', base: 'acao' },
  { id: 'sandbox', nome: 'Sandbox', base: 'simulacao' },
];
export const BASE_GENRES = ['acao', 'aventura', 'rpg', 'simulacao', 'estrategia', 'casual'];
export const GENRE_IDX = Object.fromEntries(GENRES.map((g, i) => [g.id, i]));

export const AUDIENCES = [
  { id: 'J', nome: 'Jovem', cor: '#3fae5a' },
  { id: 'T', nome: 'Todos', cor: '#f2c230' },
  { id: 'A', nome: 'Adulto', cor: '#d9453d' },
];

// Escala de nota: A=+++ (3) B=++ (2) C=+ (1) D=- (-1) E=-- (-2) F=--- (-3)
export const RATING_VAL = { A: 3, B: 2, C: 1, D: -1, E: -2, F: -3 };
export const RATING_TXT = { A: '+++', B: '++', C: '+', D: '-', E: '--', F: '---' };
export const RATING_COLOR = { A: '#1f7a3a', B: '#4aa24a', C: '#9bc34a', D: '#e0a030', E: '#d0592f', F: '#9c1f1f' };

// [nome, 6 notas de gênero (Ação, Aventura, RPG, Simulação, Estratégia, Casual), 3 notas de público (J, T, A)]
const T = [
  ['Aviação', 'ADEAAA', 'CAC'], ['Aliens', 'ACBDCC', 'BAC'], ['Assassino', 'ACAEDF', 'EEA'],
  ['Negócios', 'EDDAAC', 'DBC'], ['Cidade', 'DCDAAB', 'CBC'], ['Comédia', 'CBCDDA', 'BAB'],
  ['Culinária', 'EDDACA', 'BAC'], ['Crime', 'BBCDBE', 'FDA'], ['Cyberpunk', 'BBADCF', 'DCA'],
  ['Dança', 'DEFCFA', 'BAC'], ['Detetive', 'EABECC', 'CAB'], ['Desastres', 'BCEBBC', 'CBC'],
  ['Masmorra', 'BBAFBD', 'CBB'], ['Fantasia', 'BAADBC', 'AAB'], ['Fazenda', 'FDCABA', 'BAC'],
  ['Moda', 'FDEBEA', 'BAC'], ['Hacking', 'BCCBBF', 'CCA'], ['História', 'DBCCAD', 'CAB'],
  ['Terror', 'AACFDE', 'EDA'], ['Hospital', 'FDDACB', 'CAB'], ['Caça', 'BCDADC', 'DBA'],
  ['Direito', 'FBDCBD', 'EDA'], ['Ciência Maluca', 'CCBBBA', 'BAC'], ['Artes Marciais', 'ACBFDD', 'BAB'],
  ['Medieval', 'BCABAD', 'CAB'], ['Militar', 'ADECAF', 'FDA'], ['Música', 'DDDBFA', 'AAB'],
  ['Mistério', 'EABEDB', 'CAB'], ['Mitologia', 'BBABBC', 'BAB'], ['Ninja', 'ABBFDC', 'BAC'],
  ['Pirata', 'BABCBC', 'AAB'], ['Pós-Apocalipse', 'BCACBF', 'FDA'], ['Prisão', 'CBDABE', 'EDA'],
  ['Corrida', 'AFFADA', 'AAB'], ['Ritmo', 'DFFCFA', 'AAC'], ['Romance', 'FBBCFA', 'BAC'],
  ['Escola', 'FBBACA', 'AAD'], ['Ficção Científica', 'BBACBC', 'BAB'], ['Espaço', 'ABBBAC', 'AAB'],
  ['Esportes', 'AFFABB', 'AAB'], ['Espião', 'BACDBF', 'DCA'], ['Super-heróis', 'ABAECC', 'AAC'],
  ['Cirurgia', 'FDEADB', 'DBA'], ['Tecnologia', 'DEDABC', 'CAB'], ['Ladrão', 'BABDBD', 'DCA'],
  ['Viagem no Tempo', 'CABCBC', 'BAB'], ['Transporte', 'FFFAAB', 'BAB'], ['OVNI', 'BBCDDB', 'BBC'],
  ['Vampiro', 'ABAEDD', 'EDA'], ['Pet Virtual', 'FDDAEA', 'AAD'], ['Vocabulário', 'FDEDCA', 'BAB'],
  ['Lobisomem', 'ACAEDD', 'EDB'], ['Velho Oeste', 'ABBCBD', 'CAB'], ['Zumbis', 'ABCDEA', 'EDA'],
  ['Dinossauros', 'ABCCDA', 'AAC'], ['Robôs', 'ACBBBC', 'BAC'], ['Circo', 'CBDBEA', 'AAD'],
  ['Parque de Diversões', 'DDDAAB', 'BAC'], ['Magia', 'BAAEBB', 'AAB'], ['Samurai', 'ABBFBD', 'CAB'],
  ['Distopia', 'BCABAF', 'FDA'], ['Safari', 'CBDABC', 'BAC'], ['Oceano', 'CABBDB', 'BAC'],
  ['Carnaval', 'DDDBEA', 'DAB'], ['Folclore Brasileiro', 'BAADCB', 'BAC'], ['Construção', 'FDDAAB', 'BAC'],
];
// v0.2: +30 temas (ids t66..t95)
const T2 = [
  ['Barista', 'FEDACA', 'BAC'], ['Camping', 'DAEBFB', 'BAB'], ['Pescaria', 'FCDABA', 'BAB'], ['Gatos', 'DBCBFA', 'AAB'], ['Cachorros', 'DABBEA', 'AAB'],
  ['Bruxaria', 'CAAEBB', 'BAB'], ['Cidade Submarina', 'CBBBBC', 'BAB'], ['Oficina Mecânica', 'EFFAAC', 'BAB'], ['Jardinagem', 'FEEABA', 'BAC'], ['Skate', 'ADFEFB', 'AAC'],
  ['Surf', 'BDFDFB', 'AAC'], ['Futebol de Várzea', 'AFFBBA', 'AAB'], ['Quadrinhos', 'BBBEDB', 'AAB'], ['Boteco', 'EDDACB', 'DBA'], ['Entregas', 'DCEAAA', 'BAB'],
  ['Streamers', 'EDEBDA', 'AAC'], ['Cartas Colecionáveis', 'FEBDAA', 'AAB'], ['Xadrez', 'FFFEAB', 'BAB'], ['Mitologia Nórdica', 'BBAEBC', 'BAB'], ['Contos de Fadas', 'CAADCB', 'AAD'],
  ['Retrô Anos 80', 'BCCDCA', 'BAB'], ['Lixo Espacial', 'ABCBCC', 'BAB'], ['Floresta Amazônica', 'CAABCB', 'BAB'], ['Cangaço', 'ABBEBD', 'CBA'], ['Capoeira', 'ACCFFB', 'BAB'],
  ['Festa Junina', 'DCEBDA', 'BAC'], ['Pesadelo', 'BAADEF', 'EDA'], ['Vilarejo Aconchegante', 'FCCAEA', 'BAB'], ['Robôs Domésticos', 'DCDABA', 'BAC'], ['Faroeste Espacial', 'ABBDBC', 'CAB'],
];
const BASE_IDX = { acao: 0, aventura: 1, rpg: 2, simulacao: 3, estrategia: 4, casual: 5 };
const LET = 'ABCDEF';
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// Gêneros novos herdam a nota do gênero-base e variam -1/0/+1 de forma determinística
const EXTRA_TWEAK = { plataforma: { Aventura: 0 }, tiro: {}, luta: {}, puzzle: {}, roguelike: {}, narrativo: {}, musical: {}, terror: {}, esporte: {}, sandbox: {} };
function extendGen(nome, g6) {
  const out = g6.split('');
  for (const ge of GENRES.slice(6)) {
    const base = LET.indexOf(g6[BASE_IDX[ge.base]]);
    const d = (hash(nome + ge.id) % 3) - 1; // -1,0,1
    out.push(LET[Math.max(0, Math.min(5, base + d))]);
  }
  return out;
}
// v0.7: +30 temas (ids t96..t125)
const T3 = [
  ['Hotel', 'DCDAAB', 'BAC'], ['Aeroporto', 'DCDAAB', 'BAB'], ['Orquestra', 'EEFDEA', 'AAB'], ['Padaria', 'FEDACA', 'AAC'], ['Circo Espacial', 'BBCCDB', 'AAC'],
  ['Cidade Flutuante', 'CAABBC', 'BAB'], ['Detetive Gato', 'DACDDB', 'AAB'], ['Torneio de Culinária', 'EEEBDA', 'BAC'], ['Reality Show', 'FDECDA', 'DBB'], ['Tribunal', 'FCDCBE', 'DCA'],
  ['Bombeiros', 'BBDBCD', 'BAB'], ['Resgate na Montanha', 'BAECDD', 'BAB'], ['Zoológico', 'FDDAAB', 'AAC'], ['Aquário', 'FEEAAA', 'AAC'], ['Museu', 'FBDBCC', 'CAB'],
  ['Biblioteca Mágica', 'EAAEDB', 'AAB'], ['Cemitério Divertido', 'CAAEDC', 'CBB'], ['Samba', 'DEFDFA', 'BAB'], ['Futevôlei', 'AFFDDA', 'AAB'], ['Feira Livre', 'FDDAAB', 'BAC'],
  ['Trem Fantasma', 'BBADEC', 'DBB'], ['Metrô Lotado', 'CDEBBA', 'CBB'], ['Home Office', 'FEDAAB', 'DBB'], ['Startup', 'EDDAAB', 'DAB'], ['Intercâmbio', 'FACBDB', 'BAB'],
  ['Cartório', 'FFFBAC', 'CBA'], ['Pedágio', 'DEFBDB', 'CBB'], ['Churrasco', 'FDEAAA', 'DAB'], ['Quermesse', 'DCEBEA', 'AAC'], ['Laboratório de Slime', 'DDEBEA', 'AAB'],
];
export const THEMES = [...T, ...T2, ...T3].map(([nome, g, a], i) => ({
  id: 't' + i, nome, gen: extendGen(nome, g), aud: a.split(''),
}));
export const THEME_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t]));

/** Valor numérico (-3..3) da compatibilidade tema x gênero. */
export function themeGenreVal(themeId, genreId) {
  return RATING_VAL[THEME_BY_ID[themeId].gen[GENRE_IDX[genreId]]];
}
export function themeGenreRating(themeId, genreId) { return THEME_BY_ID[themeId].gen[GENRE_IDX[genreId]]; }
export function themeAudRating(themeId, audId) { return THEME_BY_ID[themeId].aud['JTA'.indexOf(audId)]; }
export function themeAudVal(themeId, audId) { return RATING_VAL[themeAudRating(themeId, audId)]; }

// Temas liberados no início e pacotes de pesquisa
const INITIAL_THEMES = ['Comédia', 'Corrida', 'Esportes', 'Espaço', 'Fantasia', 'Escola', 'Aviação', 'Cidade', 'Pirata', 'Medieval', 'Ficção Científica', 'Dinossauros'];
export const INITIAL_THEME_IDS = THEMES.filter((t) => INITIAL_THEMES.includes(t.nome)).map((t) => t.id);
// No modo Indie, além dos 12 iniciais, já há 6 temas "baratos" de fazer (aconchego, bichinhos, retrô).
const INDIE_EXTRA = ['Gatos', 'Cachorros', 'Barista', 'Vilarejo Aconchegante', 'Retrô Anos 80', 'Jardinagem'];
export const INDIE_THEME_IDS = [...INITIAL_THEME_IDS, ...THEMES.filter((t) => INDIE_EXTRA.includes(t.nome)).map((t) => t.id)];
const REST = THEMES.slice(0, 66).filter((t) => !INITIAL_THEMES.includes(t.nome));
const REST2 = THEMES.slice(66);
export const THEME_PACKS = [
  ...[0, 1, 2, 3, 4, 5].map((i) => ({ id: 'pack' + (i + 1), themes: REST.slice(i * 9, i * 9 + 9).map((t) => t.id) })),
  ...[0, 1, 2, 3].map((i) => ({ id: 'pack' + (i + 7), themes: REST2.slice(i * 15, i * 15 + 15).map((t) => t.id) })),
];

// Categorias de foco, agrupadas por fase de desenvolvimento
export const CATEGORIES = [
  { id: 'motor', nome: 'Motor', fase: 1, dica: 'a base técnica' },
  { id: 'jogabilidade', nome: 'Jogabilidade', fase: 1, dica: 'diversão nos controles' },
  { id: 'enredo', nome: 'Enredo/Missões', fase: 1, dica: 'a história e as missões' },
  { id: 'dialogos', nome: 'Diálogos', fase: 2, dica: 'falas e personagens' },
  { id: 'fases', nome: 'Level Design', fase: 2, dica: 'o desenho das fases' },
  { id: 'ia', nome: 'IA', fase: 2, dica: 'inimigos e aliados espertos' },
  { id: 'mundo', nome: 'Mundo', fase: 3, dica: 'o tamanho e a vida do mundo' },
  { id: 'graficos', nome: 'Gráficos', fase: 3, dica: 'o visual' },
  { id: 'som', nome: 'Som', fase: 3, dica: 'trilha e efeitos' },
];
export const CAT_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
export const catsOfPhase = (p) => CATEGORIES.filter((c) => c.fase === p);

// Pesos ideais por gênero (ordem de CATEGORIES) e viés de Design (0..1) do gênero
export const GENRE_WEIGHTS = {
  acao: [3, 5, 1, 1, 4, 3, 2, 4, 3],
  aventura: [1, 3, 5, 4, 4, 1, 4, 3, 3],
  rpg: [2, 3, 5, 4, 3, 3, 5, 2, 3],
  simulacao: [4, 3, 1, 1, 2, 5, 5, 3, 1],
  estrategia: [3, 4, 2, 2, 3, 5, 4, 2, 1],
  casual: [1, 5, 1, 1, 4, 1, 2, 4, 4],
  plataforma: [2, 5, 1, 1, 5, 1, 2, 4, 4],
  puzzle: [1, 5, 1, 1, 5, 2, 1, 3, 2],
  tiro: [4, 5, 1, 1, 3, 4, 2, 4, 4],
  luta: [2, 5, 1, 2, 3, 3, 1, 5, 4],
  roguelike: [3, 5, 1, 1, 4, 3, 3, 2, 3],
  narrativo: [1, 2, 5, 5, 2, 1, 3, 3, 4],
  musical: [1, 4, 1, 3, 5, 2, 1, 5, 3],
  terror: [2, 3, 4, 4, 4, 2, 3, 3, 3],
  esporte: [4, 4, 1, 1, 2, 5, 3, 4, 3],
  sandbox: [3, 3, 1, 1, 2, 5, 5, 3, 1],
};
export const GENRE_DESIGN_BIAS = { acao: 0.42, aventura: 0.58, rpg: 0.6, simulacao: 0.4, estrategia: 0.45, casual: 0.5, plataforma: 0.45, puzzle: 0.55, tiro: 0.38, luta: 0.4, roguelike: 0.5, narrativo: 0.7, musical: 0.35, terror: 0.5, esporte: 0.4, sandbox: 0.55 };

export const SIZES = {
  micro: { id: 'micro', nome: 'Micro (jam)', total: 40, preco: 8, custo: 0.35, mercado: 0.25, minEquipe: 1, req: null, indie: true },
  pequeno: { id: 'pequeno', nome: 'Pequeno', total: 120, preco: 18, custo: 1, mercado: 0.6, minEquipe: 1, req: null },
  medio: { id: 'medio', nome: 'Médio', total: 420, preco: 30, custo: 2.6, mercado: 1.0, minEquipe: 2, req: 'tam_medio' },
  grande: { id: 'grande', nome: 'Grande', total: 1200, preco: 45, custo: 6.5, mercado: 1.25, minEquipe: 4, req: 'tam_grande' },
  aaa: { id: 'aaa', nome: 'AAA', total: 3600, preco: 65, custo: 16, mercado: 1.6, minEquipe: 8, req: 'tam_aaa' },
};

// Plataformas fictícias. Entram e saem por ano. mercado = unidades de um jogo "médio" nota 10 (sem hype)
export const PLATFORMS = [
  { id: 'pcmod', nome: 'PC (Janelas / Linucs)', tipo: 'PC', de: 1, ate: 99, licenca: 0, taxa: 0.0, mercado: 8000, tier: 3, req: null, indie: true, afin: {} },
  { id: 'micro64', nome: 'Micro Turbo 64', tipo: 'PC', de: 1, ate: 9, licenca: 3000, taxa: 0.0, mercado: 12000, tier: 1.2, req: null, afin: { estrategia: 1.15, aventura: 1.1 } },
  { id: 'caixote', nome: 'Caixote Games 8', tipo: 'Console', de: 2, ate: 10, licenca: 6000, taxa: 0.18, mercado: 16000, tier: 1.8, req: null, afin: { acao: 1.15, casual: 1.1 } },
  { id: 'bolinha', nome: 'Bolinha Portátil', tipo: 'Portátil', de: 4, ate: 14, licenca: 5000, taxa: 0.15, mercado: 13000, tier: 1.8, req: 'plat_portatil', afin: { casual: 1.25, acao: 1.05 } },
  { id: 'tupa16', nome: 'Super Tupã 16', tipo: 'Console', de: 7, ate: 17, licenca: 12000, taxa: 0.2, mercado: 17000, tier: 3.0, req: null, afin: { acao: 1.15, rpg: 1.15 } },
  { id: 'compu386', nome: 'Compuforte 386', tipo: 'PC', de: 8, ate: 18, licenca: 6000, taxa: 0.0, mercado: 15000, tier: 3.2, req: null, afin: { estrategia: 1.2, simulacao: 1.2, rpg: 1.1 } },
  { id: 'cubo32', nome: 'Estação Cubo 32', tipo: 'Console', de: 12, ate: 22, licenca: 30000, taxa: 0.22, mercado: 16000, tier: 4.4, req: 'gfx4', afin: { acao: 1.1, aventura: 1.1 } },
  { id: 'fenix', nome: 'Fênix Dreamer', tipo: 'Console', de: 15, ate: 25, licenca: 40000, taxa: 0.22, mercado: 20000, tier: 4.8, req: 'gfx4', afin: { acao: 1.15, rpg: 1.1 } },
  { id: 'pcpro', nome: 'PC Gamer Pro', tipo: 'PC', de: 16, ate: 99, licenca: 20000, taxa: 0.05, mercado: 24000, tier: 6.0, req: null, afin: { estrategia: 1.2, simulacao: 1.2, rpg: 1.15 } },
  { id: 'mobilis', nome: 'Mobilis Phone', tipo: 'Celular', de: 18, ate: 99, licenca: 8000, taxa: 0.3, mercado: 36000, tier: 4.5, req: 'plat_mobile', afin: { casual: 1.35, estrategia: 1.05 } },
  { id: 'arenax', nome: 'Arena X Ultra', tipo: 'Console', de: 22, ate: 99, licenca: 90000, taxa: 0.25, mercado: 48000, tier: 7.0, req: 'gfx6', afin: { acao: 1.15, aventura: 1.1, rpg: 1.1 } },
  { id: 'neocubo', nome: 'Neo Cubo Quantum', tipo: 'Console', de: 27, ate: 99, licenca: 140000, taxa: 0.25, mercado: 64000, tier: 8.0, req: 'gfx7', afin: { acao: 1.1, aventura: 1.15 } },
];
export const PLAT_BY_ID = Object.fromEntries(PLATFORMS.map((p) => [p.id, p]));

/** Mercado atual da plataforma (curva em sino entre 'de' e 'ate'). */
export function platformMarket(p, year) {
  const end = Math.min(p.ate, p.de + 14);
  if (year < p.de || year > p.ate) return 0;
  const span = Math.max(1, end - p.de);
  const peak = p.de + span * 0.45;
  const x = year <= peak ? 0.35 + 0.65 * (year - p.de) / Math.max(0.01, peak - p.de) : 1 - 0.6 * (year - peak) / Math.max(1, p.ate - peak);
  return p.mercado * Math.max(0.25, Math.min(1, x));
}
export const platformActive = (p, year) => year >= p.de && year <= p.ate;

// Níveis de escritório
export const OFFICES = [
  { id: 0, nome: 'Garagem', vagas: 2, aluguel: 120, mudanca: 0, grade: 6, desc: 'Cheiro de graxa e sonhos. Só cabem duas pessoas e um carro coberto.' },
  { id: 1, nome: 'Escritório Pequeno', vagas: 5, aluguel: 800, mudanca: 25000, grade: 8, desc: 'Uma sala comercial de verdade, com ar-condicionado que quase funciona.' },
  { id: 2, nome: 'Escritório Médio', vagas: 12, aluguel: 3200, mudanca: 120000, grade: 10, desc: 'Sala de reunião, copa com puffs e uma máquina de salgadinhos.' },
  { id: 3, nome: 'Prédio do Estúdio', vagas: 24, aluguel: 11000, mudanca: 600000, grade: 12, desc: 'Prédio inteiro, andar de lazer e uma placa luminosa gigante.' },
];

export const ROLES = {
  programador: { nome: 'Programador(a)', foco: 't', cor: '#37a6c9' },
  designer: { nome: 'Game Designer', foco: 'd', cor: '#f0b429' },
  artista: { nome: 'Artista', foco: 'g', cor: '#e66d8b' },
  sonoplasta: { nome: 'Sonoplasta', foco: 's', cor: '#8a6bd1' },
  testador: { nome: 'Testador(a)', foco: 'q', cor: '#e38b2c' },
  pesquisador: { nome: 'Pesquisador(a)', foco: 'r', cor: '#2b5fa8' },
};
export const SKILLS = { d: 'Design', t: 'Tecnologia', g: 'Arte', s: 'Som', q: 'Testes', r: 'Pesquisa' };

export const FIRST_NAMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabi', 'Heitor', 'Iara', 'João', 'Kátia', 'Lucas', 'Mari', 'Nando', 'Olívia', 'Pedro', 'Quésia', 'Rafa', 'Sofia', 'Tiago', 'Valéria', 'Wesley', 'Yasmin', 'Zeca', 'Beto', 'Duda', 'Cacá', 'Nina'];
export const LAST_NAMES = ['Silva', 'Souza', 'Pereira', 'Lima', 'Ferraz', 'Gomes', 'Barbosa', 'Rocha', 'Dias', 'Nunes', 'Cardoso', 'Teixeira', 'Moura', 'Campos', 'Braga', 'Pinto', 'Farias', 'Macedo'];
export const HAIRS = ['#c8461f', '#2b2118', '#e0b84c', '#7a4a2a', '#8a8a8a', '#3b6fb6', '#d868a6'];
export const SKINS = ['#f3c9a0', '#e0a67a', '#c08258', '#8d5a3b', '#5e3b26'];
export const SHIRTS = ['#e8523c', '#3b82c4', '#3da35d', '#8a5cc2', '#f0a030', '#2f3b52', '#d6577e'];

export const MARKETING = [
  { id: 'cartaz', nome: 'Cartazes no poste', custo: 800, hype: 8, req: null },
  { id: 'radio', nome: 'Spot de rádio local', custo: 2500, hype: 14, req: 'mkt_radio' },
  { id: 'tv', nome: 'Comercial na TV aberta', custo: 12000, hype: 24, req: 'mkt_tv' },
  { id: 'viral', nome: 'Campanha viral com influencers', custo: 40000, hype: 36, req: 'mkt_viral' },
];

// Recursos adicionais (custo = base * fator de tamanho). q = bônus de qualidade (0..), efeito extra opcional
export const EXTRAS = [
  { id: 'savegame', nome: 'Sistema de savegame', fase: 1, custo: 800, q: 0.02, req: null },
  { id: 'tutorial', nome: 'Tutoriais', fase: 1, custo: 1400, q: 0.03, req: null },
  { id: 'historia', nome: 'História linear', fase: 1, custo: 1400, q: 0.035, req: 'ex_historia' },
  { id: 'conquistas', nome: 'Sistema de conquistas', fase: 2, custo: 1800, q: 0.03, req: 'ex_conq' },
  { id: 'multi', nome: 'Multiplayer local', fase: 2, custo: 3000, q: 0.045, req: 'ex_multi' },
  { id: 'editor', nome: 'Editor de fases', fase: 2, custo: 4200, q: 0.05, req: 'ex_editor' },
  { id: 'iaadapt', nome: 'IA adaptativa', fase: 2, custo: 5200, q: 0.05, req: 'ex_iaadapt' },
  { id: 'trilha', nome: 'Trilha sonora autoral', fase: 3, custo: 2200, q: 0.035, req: null },
  { id: 'online', nome: 'Modo online', fase: 3, custo: 8000, q: 0.07, req: 'ex_online' },
  { id: 'dublagem', nome: 'Dublagem completa', fase: 3, custo: 9500, q: 0.06, req: 'ex_dublagem' },
  // v0.7: ferramentas e middleware
  { id: 'procgen', nome: 'Gerador procedural de mapas', fase: 1, custo: 2600, q: 0.04, req: 'fe_procgen' },
  { id: 'dialogos', nome: 'Editor de diálogos ramificados', fase: 1, custo: 2200, q: 0.035, req: 'fe_dialogos' },
  { id: 'fisica', nome: 'Middleware de física (Bonk2D)', fase: 2, custo: 3600, q: 0.045, req: 'fe_fisica' },
  { id: 'mocap', nome: 'Captura de movimento caseira', fase: 2, custo: 6800, q: 0.055, req: 'fe_mocap' },
  { id: 'telemetria', nome: 'Telemetria e analytics', fase: 2, custo: 2400, q: 0.03, req: 'fe_telemetria' },
  { id: 'audiomw', nome: 'Middleware de áudio adaptativo', fase: 3, custo: 3800, q: 0.045, req: 'fe_audio' },
  { id: 'ci', nome: 'Pipeline de testes automáticos', fase: 3, custo: 3000, q: 0.04, req: 'fe_ci' },
  { id: 'shader', nome: 'Biblioteca de shaders', fase: 3, custo: 5200, q: 0.05, req: 'fe_shader' },
];

// Árvore de pesquisa. ramos: motor, gráficos, som, gêneros, temas, plataformas, negócios, extras
const R = (id, nome, ramo, rp, din, sem, req, desc, efeito) => ({ id, nome, ramo, rp, din, sem, req: req || [], desc, efeito: efeito || {} });
export const RESEARCH = [
  R('motor2', 'Motor 2D Turbo', 'Motor', 25, 8000, 3, [], 'Mais rápido e estável. Motor nível 2.', { engine: 2 }),
  R('motor3', 'Motor 3D Básico', 'Motor', 90, 35000, 4, ['motor2', 'gfx3'], 'Polígonos! Motor nível 3.', { engine: 3 }),
  R('motor4', 'Motor 3D Avançado', 'Motor', 220, 100000, 5, ['motor3'], 'Iluminação e física decentes. Nível 4.', { engine: 4 }),
  R('motor5', 'Motor de Física', 'Motor', 480, 260000, 6, ['motor4'], 'Tudo quica e desmorona. Nível 5.', { engine: 5 }),
  R('motor6', 'Motor Fotorrealista', 'Motor', 950, 650000, 7, ['motor5', 'gfx5'], 'Dá pra ver o poro do herói. Nível 6.', { engine: 6 }),
  R('motor7', 'Motor Quântico Tropical', 'Motor', 1900, 1600000, 8, ['motor6'], 'Ninguém sabe como funciona. Nível 7.', { engine: 7 }),
  R('gfx2', 'Pixels de 16 cores', 'Gráficos', 15, 3000, 2, [], 'Gráficos nível 2.', { gfx: 2 }),
  R('gfx3', '2D Colorido e Parallax', 'Gráficos', 45, 12000, 3, ['gfx2'], 'Gráficos nível 3.', { gfx: 3 }),
  R('gfx4', '3D Poligonal', 'Gráficos', 130, 50000, 4, ['gfx3'], 'Gráficos nível 4.', { gfx: 4 }),
  R('gfx5', 'Texturas em Alta', 'Gráficos', 320, 140000, 5, ['gfx4'], 'Gráficos nível 5.', { gfx: 5 }),
  R('gfx6', 'Sombras Dinâmicas', 'Gráficos', 680, 380000, 6, ['gfx5'], 'Gráficos nível 6.', { gfx: 6 }),
  R('gfx7', 'Realismo Total', 'Gráficos', 1350, 950000, 7, ['gfx6'], 'Gráficos nível 7.', { gfx: 7 }),
  R('som2', 'Sintetizador FM', 'Som', 20, 5000, 2, [], 'Som nível 2.', { snd: 2 }),
  R('som3', 'Samples Digitais', 'Som', 90, 30000, 3, ['som2'], 'Som nível 3.', { snd: 3 }),
  R('som4', 'Trilha Orquestrada', 'Som', 300, 150000, 5, ['som3'], 'Som nível 4.', { snd: 4 }),
  R('som5', 'Áudio Espacial 3D', 'Som', 800, 500000, 6, ['som4'], 'Som nível 5.', { snd: 5 }),
  R('gen_rpg', 'Gênero: RPG', 'Gêneros', 30, 8000, 2, [], 'Libera jogos de RPG.', { genre: 'rpg' }),
  R('gen_sim', 'Gênero: Simulação', 'Gêneros', 30, 8000, 2, [], 'Libera jogos de Simulação.', { genre: 'simulacao' }),
  R('gen_est', 'Gênero: Estratégia', 'Gêneros', 60, 15000, 3, [], 'Libera jogos de Estratégia.', { genre: 'estrategia' }),
  R('gen_plat', 'Gênero: Plataforma', 'Gêneros', 20, 4000, 2, [], 'Libera jogos de Plataforma.', { genre: 'plataforma' }),
  R('gen_puz', 'Gênero: Quebra-cabeça', 'Gêneros', 20, 4000, 2, [], 'Libera jogos de Quebra-cabeça.', { genre: 'puzzle' }),
  R('gen_narr', 'Gênero: Narrativo', 'Gêneros', 35, 7000, 2, [], 'Libera jogos Narrativos.', { genre: 'narrativo' }),
  R('gen_tiro', 'Gênero: Tiro', 'Gêneros', 55, 14000, 3, ['gen_est'], 'Libera jogos de Tiro.', { genre: 'tiro' }),
  R('gen_luta', 'Gênero: Luta', 'Gêneros', 55, 14000, 3, ['gen_plat'], 'Libera jogos de Luta.', { genre: 'luta' }),
  R('gen_rogue', 'Gênero: Roguelike', 'Gêneros', 70, 16000, 3, ['gen_rpg'], 'Libera jogos Roguelike.', { genre: 'roguelike' }),
  R('gen_music', 'Gênero: Musical', 'Gêneros', 40, 9000, 2, ['gen_puz'], 'Libera jogos Musicais.', { genre: 'musical' }),
  R('gen_terror', 'Gênero: Terror', 'Gêneros', 60, 15000, 3, ['gen_narr'], 'Libera jogos de Terror.', { genre: 'terror' }),
  R('gen_esp', 'Gênero: Esporte', 'Gêneros', 45, 11000, 3, ['gen_plat'], 'Libera jogos de Esporte.', { genre: 'esporte' }),
  R('gen_sand', 'Gênero: Sandbox', 'Gêneros', 90, 24000, 3, ['gen_sim'], 'Libera jogos Sandbox.', { genre: 'sandbox' }),
  R('subgenero', 'Subgêneros', 'Gêneros', 80, 20000, 3, ['gen_rpg'], 'Permite combinar dois gêneros num só jogo.', { subgenre: true }),
  ...THEME_PACKS.map((p, i) => R('tema_' + p.id, `Pacote de Temas ${i + 1}`, 'Temas', [10, 25, 50, 90, 150, 250, 120, 180, 220, 300][i], [2000, 6000, 15000, 40000, 100000, 250000, 60000, 90000, 140000, 210000][i], 2 + (i >> 1), i ? ['tema_pack' + i] : [], `Libera ${p.themes.length} novos temas: ` + p.themes.map((t) => THEME_BY_ID[t].nome).slice(0, 4).join(', ') + '…', { themes: p.themes })),
  R('plat_portatil', 'Licença: Portáteis', 'Plataformas', 20, 5000, 2, [], 'Permite desenvolver para portáteis.', {}),
  R('plat_mobile', 'Licença: Celulares', 'Plataformas', 400, 120000, 4, ['gfx4'], 'Permite desenvolver para celulares.', {}),
  R('tam_medio', 'Jogos Médios', 'Negócios', 25, 5000, 2, [], 'Libera o tamanho Médio.', { size: 'medio' }),
  R('tam_grande', 'Jogos Grandes', 'Negócios', 120, 40000, 4, ['tam_medio'], 'Libera o tamanho Grande.', { size: 'grande' }),
  R('tam_aaa', 'Jogos AAA', 'Negócios', 420, 200000, 6, ['tam_grande'], 'Libera o tamanho AAA.', { size: 'aaa' }),
  R('mkt_radio', 'Marketing: Rádio', 'Negócios', 20, 3000, 2, [], 'Libera o spot de rádio.'),
  R('mkt_tv', 'Marketing: TV', 'Negócios', 100, 25000, 3, ['mkt_radio'], 'Libera o comercial na TV.'),
  R('mkt_viral', 'Marketing: Viral', 'Negócios', 350, 120000, 4, ['mkt_tv'], 'Libera campanha com influencers.'),
  R('treino', 'Cursos e Treinamento', 'Negócios', 15, 2000, 2, [], 'Libera treinamento de funcionários.', { treino: true }),
  R('pd', 'Laboratório de P&D', 'Negócios', 40, 10000, 3, [], 'Libera orçamento mensal de P&D (converte R$ em pontos de pesquisa) e contratação de Pesquisadores.', { lab: true }),
  R('ex_historia', 'Recurso: História linear', 'Extras', 15, 3000, 2),
  R('ex_conq', 'Recurso: Conquistas', 'Extras', 40, 8000, 2),
  R('ex_multi', 'Recurso: Multiplayer local', 'Extras', 60, 15000, 3),
  R('ex_editor', 'Recurso: Editor de fases', 'Extras', 100, 30000, 3, ['ex_conq']),
  R('ex_iaadapt', 'Recurso: IA adaptativa', 'Extras', 150, 50000, 4, ['motor3']),
  R('ex_online', 'Recurso: Modo online', 'Extras', 250, 100000, 5, ['ex_multi', 'motor3']),
  R('fe_procgen', 'Ferramenta: Geração procedural', 'Extras', 70, 18000, 3, ['motor2']),
  R('fe_dialogos', 'Ferramenta: Editor de diálogos', 'Extras', 30, 6000, 2, ['ex_historia']),
  R('fe_fisica', 'Ferramenta: Middleware de física', 'Extras', 110, 32000, 4, ['motor3']),
  R('fe_mocap', 'Ferramenta: Captura de movimento', 'Extras', 260, 90000, 5, ['motor4']),
  R('fe_telemetria', 'Ferramenta: Telemetria', 'Extras', 60, 14000, 3, ['ex_conq']),
  R('fe_audio', 'Ferramenta: Áudio adaptativo', 'Extras', 140, 45000, 4, ['som3']),
  R('fe_ci', 'Ferramenta: Testes automáticos', 'Extras', 90, 25000, 3, ['pd']),
  R('fe_shader', 'Ferramenta: Shaders', 'Extras', 200, 70000, 5, ['gfx4']),
  R('ex_dublagem', 'Recurso: Dublagem', 'Extras', 200, 80000, 4, ['som3']),
];
export const RES_BY_ID = Object.fromEntries(RESEARCH.map((r) => [r.id, r]));
export const START_RESEARCH = []; // motor1/gfx1/som1 são implícitos

// Críticos fictícios
export const CRITICS = [
  { id: 'joystick', nome: 'Revista Joystick Raiz', vies: 0, rigor: 0.6, gosta: ['acao', 'estrategia'] },
  { id: 'pipoca', nome: 'Pixel & Pipoca', vies: 0.45, rigor: 0.5, gosta: ['casual', 'aventura'] },
  { id: 'cinza', nome: 'Crítica Cinza', vies: -0.5, rigor: 0.8, gosta: ['rpg', 'aventura'] },
  { id: 'gameplay', nome: 'Gameplay Hoje', vies: -0.1, rigor: 0.7, gosta: ['simulacao', 'estrategia', 'rpg'] },
];
export const REVIEW_PHRASES = [
  [3, ['Um desastre digno de museu.', 'Perdi meu tempo e minha paciência.', 'Só jogo de novo se me pagarem.']],
  [5, ['Tem boas ideias, mal executadas.', 'Dá pra jogar, mas dá pra esquecer também.', 'Mediano. Sem brilho.']],
  [7, ['Divertido e competente!', 'Uma boa surpresa de estúdio pequeno.', 'Vale cada centavo, com ressalvas.']],
  [9, ['Muito bom! Recomendadíssimo.', 'Viciante de ponta a ponta.', 'O estúdio acertou a mão.']],
  [11, ['Obra-prima! Já quero o próximo.', 'Entra pra história do jogo nacional.', 'Perfeito. Sem exageros… ok, com exageros.']],
];

export const RIVALS = [
  { id: 'bytebras', nome: 'Bytebrás Entretenimento', cor: '#3b82c4', forca: 0.55 },
  { id: 'caipira', nome: 'Estúdio Caipira Digital', cor: '#3da35d', forca: 0.5 },
  { id: 'pixelandia', nome: 'Pixelândia Games', cor: '#e8523c', forca: 0.62 },
  { id: 'megatupi', nome: 'MegaTupi Interactive', cor: '#8a5cc2', forca: 0.7 },
  { id: 'dragao', nome: 'Dragão Verde Software', cor: '#f0a030', forca: 0.58 },
];
export const RIVAL_NAME_A = ['Super', 'Mega', 'Turbo', 'Mestre', 'Rei', 'Lenda', 'Caça', 'Reino', 'Operação', 'Fúria'];
export const RIVAL_NAME_B = ['do Sertão', 'das Sombras', 'Tropical', 'Cósmico', 'Infinito', 'da Vovó', 'Radical', 'do Futuro', 'Supremo', 'Final'];

export const AWARDS = [
  { id: 'goty', nome: 'Jogo do Ano', premio: 20000, fas: 400 },
  { id: 'revelacao', nome: 'Estúdio Revelação', premio: 8000, fas: 150 },
  { id: 'gfx', nome: 'Melhor Direção de Arte', premio: 8000, fas: 150 },
];
export const AWARD_NAME = 'Troféu Tucano de Ouro';

// Eventos aleatórios durante o desenvolvimento. Efeitos: d,t (fração do total), bugs, money (x fator infl.), hype, energy, fans
export const EVENTS = [
  { id: 'ideia', titulo: 'Ideia genial no banho!', texto: 'Alguém teve uma sacada brilhante sobre o design às 3 da manhã.', opcoes: [{ txt: 'Anotar no guardanapo', ef: { d: 0.05 } }, { txt: 'Contratar um consultor (R$ 1.500)', custo: 1500, ef: { d: 0.1, hype: 3 } }] },
  { id: 'bugfera', titulo: 'Um bug lendário!', texto: 'O herói atravessa as paredes e some do mapa. Que feio.', opcoes: [{ txt: 'Caçar o bug agora (-2% de progresso)', ef: { t: -0.02, bugs: 1 } }, { txt: 'Chamar de "recurso" (+6 bugs)', ef: { bugs: 6 } }] },
  { id: 'cafe', titulo: 'Café no teclado', texto: 'Uma caneca voou. O teclado nunca mais será o mesmo.', opcoes: [{ txt: 'Comprar teclado novo (R$ 600)', custo: 600, ef: {} }, { txt: 'Tocar o barco no teclado melecado', ef: { t: -0.025, energy: -5 } }] },
  { id: 'blog', titulo: 'Blogueiro vira fã', texto: 'Um blogueiro postou um vídeo falando do seu jogo. 3 mil visualizações!', opcoes: [{ txt: 'Compartilhar em tudo!', ef: { hype: 14, fans: 40 } }] },
  { id: 'bolo', titulo: 'A tia trouxe bolo', texto: 'Bolo de fubá com café coado. A equipe se recupera.', opcoes: [{ txt: 'Comer em paz', ef: { energy: 20 } }] },
  { id: 'luz', titulo: 'Caiu a luz', texto: 'O bairro inteiro ficou sem energia por horas.', opcoes: [{ txt: 'Esperar voltar', ef: { t: -0.02, d: -0.01 } }, { txt: 'Alugar um gerador (R$ 1.000)', custo: 1000, ef: {} }] },
  { id: 'fa', titulo: 'Sugestão de um fã', texto: 'Um fã mandou um e-mail de 12 páginas com ideias. 2 são boas!', opcoes: [{ txt: 'Aproveitar as boas', ef: { d: 0.04, fans: 15 } }] },
  { id: 'anjo', titulo: 'Investidor anjo apareceu', texto: 'Um tio rico do cunhado gostou do seu protótipo.', opcoes: [{ txt: 'Aceitar o apoio (+R$ 6.000)', ef: { money: 6000, fans: 20 } }], raro: true },
  { id: 'clone', titulo: 'Concorrente lançou algo parecido', texto: 'Um estúdio rival anunciou um jogo bem parecido com o seu.', opcoes: [{ txt: 'Pivotar o marketing (R$ 2.000)', custo: 2000, ef: {} }, { txt: 'Ignorar', ef: { hype: -8 } }] },
  { id: 'fiscal', titulo: 'Fiscalização surpresa', texto: 'Um fiscal visitou o estúdio e achou "algumas pendências".', opcoes: [{ txt: 'Pagar a multa (R$ 1.800)', custo: 1800, ef: {} }, { txt: 'Contestar (-energia)', ef: { energy: -12 } }] },
  { id: 'estagio', titulo: 'Estagiário reorganiza as pastas', texto: 'Ele renomeou tudo para "final_FINAL_v3". Ninguém acha nada.', opcoes: [{ txt: 'Respirar fundo', ef: { t: -0.015, bugs: 2 } }] },
  { id: 'meme', titulo: 'Seu protótipo virou meme', texto: 'Um bug engraçado viralizou. As pessoas querem jogar!', opcoes: [{ txt: 'Assumir o meme', ef: { hype: 18, bugs: 2, fans: 60 } }] },
  // v0.7: mais eventos de desenvolvimento
  { id: 'crunch', titulo: 'Pressão de prazo', texto: 'O prazo apertou. Alguém sugeriu "só um fim de semana" de crunch.', opcoes: [{ txt: 'Fazer crunch (progresso, mas energia cai)', ef: { d: 0.03, t: 0.03, energy: -14, bugs: 3 } }, { txt: 'Manter o ritmo saudável', ef: { energy: 4 } }] },
  { id: 'playtest', titulo: 'Playtest surpresa', texto: 'Os primos de um colega jogaram o protótipo e quebraram tudo em 4 minutos.', opcoes: [{ txt: 'Anotar tudo e corrigir', ef: { bugs: -3, t: -0.01 } }, { txt: 'Dizer que eles jogaram errado', ef: { hype: -4 } }] },
  { id: 'engine_update', titulo: 'Atualização forçada da engine', texto: 'A ferramenta atualizou sozinha na véspera. Metade dos scripts parou de compilar.', opcoes: [{ txt: 'Migrar tudo agora (-4% de progresso)', ef: { t: -0.04 } }, { txt: 'Contratar um freelancer (R$ 1.800)', custo: 1800, ef: {} }] },
  { id: 'trilha_graca', titulo: 'Compositor oferece trilha', texto: 'Um músico de banda de garagem se ofereceu para compor de graça "pela exposição".', opcoes: [{ txt: 'Aceitar com crédito (+qualidade)', ef: { d: 0.015, fans: 25 } }, { txt: 'Pagar um cachê justo (R$ 1.200)', custo: 1200, ef: { d: 0.05, hype: 5 } }] },
  { id: 'bugfix_noite', titulo: 'Bug resolvido de madrugada', texto: 'Alguém acordou às 4h com a solução do bug que travava a equipe há dias.', opcoes: [{ txt: 'Comemorar!', ef: { bugs: -2, energy: 4 } }] },
  { id: 'streamer_rando', titulo: 'Streamer achou a demo', texto: 'Uma streamer média jogou o protótipo ao vivo e o chat adorou.', opcoes: [{ txt: 'Agradecer no chat', ef: { hype: 6, fans: 25 } }] },
  { id: 'hd_morreu', titulo: 'O HD morreu', texto: 'Barulhinho de clique... e o backup estava "para sexta".', opcoes: [{ txt: 'Recuperar com especialista (R$ 2.500)', custo: 2500, ef: {} }, { txt: 'Refazer o que perdeu', ef: { t: -0.05, d: -0.02, energy: -8 } }] },
  { id: 'gamejam_amigo', titulo: 'Amigo de game jam ajuda', texto: 'Um amigo de jam passou o fim de semana ajudando por pura amizade.', opcoes: [{ txt: 'Pagar uma pizza e agradecer', ef: { d: 0.012, t: 0.012, fans: 10 } }] },
  { id: 'resenha_ruim', titulo: 'Resenha cruel do protótipo', texto: 'Um blogueiro destruiu o trailer. "Parece um jogo de 2003 feito por um gato".', opcoes: [{ txt: 'Responder com humor', ef: { hype: 4, fans: 20 } }, { txt: 'Ignorar e trabalhar', ef: { hype: -5, energy: -3 } }] },
  { id: 'bolsa', titulo: 'Edital de fomento', texto: 'Saiu um edital cultural para jogos nacionais. A papelada é enorme.', opcoes: [{ txt: 'Inscrever o projeto (+R$ 1.800 se aprovado)', ef: { money: 1800, t: -0.03 } }, { txt: 'Deixar passar', ef: {} }], raro: true },
  { id: 'greve_onibus', titulo: 'Greve de ônibus', texto: 'Metade da equipe chegou com duas horas de atraso e sem paciência.', opcoes: [{ txt: 'Liberar home office', ef: { energy: 3, t: -0.01 } }, { txt: 'Cobrar horário', ef: { energy: -10 } }] },
  { id: 'copa_jogo', titulo: 'Jogo do Brasil', texto: 'Hoje é dia de jogo da seleção. A produtividade foi para o beleléu.', opcoes: [{ txt: 'Assistir todo mundo junto', ef: { energy: 12, t: -0.012 } }, { txt: 'Trabalhar mesmo assim', ef: { energy: -6, d: 0.01 } }] },
  { id: 'plagio', titulo: 'Acusação de plágio', texto: 'Dizem que seu protótipo copiou o visual de um jogo famoso. A polêmica cresce.', opcoes: [{ txt: 'Mudar o visual (R$ 2.200)', custo: 2200, ef: { hype: 4 } }, { txt: 'Bater o pé', ef: { hype: -10, fans: -15 } }] },
  { id: 'meme_interno', titulo: 'Piada interna vira feature', texto: 'A equipe criou um easter egg absurdo. Dá vontade de deixar no jogo.', opcoes: [{ txt: 'Manter o easter egg', ef: { hype: 5, bugs: 3, fans: 15 } }, { txt: 'Remover', ef: {} }] },
  { id: 'cliente_servico', titulo: 'Cliente de serviço', texto: 'Uma empresa quer um mini-game promocional. Paga bem, mas tira o foco.', opcoes: [{ txt: 'Aceitar (+R$ 1.500, -4% de progresso)', ef: { money: 1500, t: -0.04 } }, { txt: 'Recusar educadamente', ef: {} }] },
  { id: 'cafe_novo', titulo: 'Máquina de café nova', texto: 'Chegou uma máquina de cápsulas. A fila para usá-la é a nova reunião diária.', opcoes: [{ txt: 'Aproveitar a pausa', ef: { energy: 6 } }] },
  { id: 'doacao_asset', titulo: 'Pacote de assets gratuito', texto: 'Um artista liberou um pacote enorme de assets sob licença aberta.', opcoes: [{ txt: 'Usar (cuidando da licença)', ef: { d: 0.015, bugs: 2 } }] },
  { id: 'queda_energia_nuvem', titulo: 'Nuvem fora do ar', texto: 'O serviço de build caiu. Ninguém consegue entregar nada até o meio-dia.', opcoes: [{ txt: 'Aproveitar para alinhar o design', ef: { d: 0.02, t: -0.01 } }, { txt: 'Esperar voltar', ef: { t: -0.025 } }] },
];

export const NEWS_TEMPLATES = [
  'Um estúdio rival anuncia jogo secreto.',
  'Revista elogia a cena nacional de jogos.',
  'Plataformas disputam o mercado com preços agressivos.',
  'Gamers reclamam de bugs em lançamentos recentes.',
  'Evento de jogos nacionais bate recorde de público.',
  'Estúdio brasileiro é elogiado pela imprensa gringa.',
  'Polêmica na comunidade: loot boxes voltam ao debate.',
  'Meme de jogo indie toma conta das redes.',
];

export const ACHIEVEMENTS = [
  { id: 'primeiro', nome: 'Hello, mundo!', desc: 'Lance seu primeiro jogo.' },
  { id: 'nota7', nome: 'Aprovado pela crítica', desc: 'Tire média 7 ou mais.' },
  { id: 'nota9', nome: 'Obra-prima', desc: 'Tire média 9 ou mais.' },
  { id: 'contratou', nome: 'Não estou mais sozinho', desc: 'Contrate o primeiro funcionário.' },
  { id: 'escritorio', nome: 'Saí da garagem!', desc: 'Mude para um escritório.' },
  { id: 'cem_mil', nome: 'Cem mil na conta', desc: 'Tenha R$ 100.000 em caixa.' },
  { id: 'milhao', nome: 'Milionário!', desc: 'Chegue a R$ 1.000.000 em caixa.' },
  { id: 'fas1k', nome: 'Clube de fãs', desc: 'Alcance 1.000 fãs.' },
  { id: 'fas50k', nome: 'Fenômeno nacional', desc: 'Alcance 50.000 fãs.' },
  { id: 'dez_jogos', nome: 'Fábrica de jogos', desc: 'Lance 10 jogos.' },
  { id: 'pesquisa', nome: 'Cientista maluco', desc: 'Conclua sua primeira pesquisa.' },
  { id: 'tucano', nome: 'Tucano de Ouro', desc: 'Ganhe um prêmio anual.' },
  { id: 'cinco_anos', nome: 'Sobrevivente', desc: 'Complete 5 anos de estúdio.' },
  { id: 'bugado', nome: 'Isso é um recurso', desc: 'Lance um jogo com muitos bugs.' },
  { id: 'lider', nome: 'Número 1', desc: 'Seja o estúdio nº 1 do ranking.' },
  { id: 'tutorial', nome: 'Aluno aplicado', desc: 'Conclua o tutorial.' },
];
