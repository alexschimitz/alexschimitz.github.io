// Catálogo FICTÍCIO: paródias sutis (troca de letras/palavras) do universo dos games.
// Nada aqui é marca real: são trocadilhos para ambientar o mundo do jogo.

/** Franquias (nome, gênero base, ano-base de "lançamento" para sequências). */
const FR1 = [
  ['Super Marlo Bros.', 'plataforma'], ['Marlo Kart', 'acao'], ['A Lenda de Zelta', 'aventura'], ['Pokimon', 'rpg'], ['Metroyd Prime', 'aventura'],
  ['Grand Thieft Auto', 'acao'], ['Call of Duly', 'tiro'], ['Counter-Strikes', 'tiro'], ['Mineracraft', 'simulacao'], ['Fortnight', 'tiro'],
  ['Amongst Us', 'casual'], ['The Whitcher', 'rpg'], ['Dark Soles', 'rpg'], ['Elder Ring', 'rpg'], ['Skyrym', 'rpg'],
  ['Stardew Valey', 'simulacao'], ['Hollow Night', 'aventura'], ['Undertail', 'rpg'], ['Hadez', 'roguelike'], ['Cupheed', 'plataforma'],
  ['Terrária', 'aventura'], ['Portel', 'puzzle'], ['Half-Lite', 'tiro'], ['Resident Evel', 'aventura'], ['Silent Hil', 'aventura'],
  ['Final Fantasia', 'rpg'], ['Street Fighters', 'luta'], ['Sonik', 'plataforma'], ['Overcookied', 'casual'], ['Need for Speedy', 'acao'],
  ['FIFE Soccer', 'acao'], ['Pro Revolution Soccer', 'acao'], ['The Simz', 'simulacao'], ['Age of Empyres', 'estrategia'], ['Sivilization', 'estrategia'],
  ['Diabolo', 'rpg'], ['World of Warkraft', 'rpg'], ['League of Legens', 'estrategia'], ['Dotta 2', 'estrategia'], ['Valorent', 'tiro'],
  ['Apex Legendz', 'tiro'], ['Overwacth', 'tiro'], ['Rocket Leage', 'acao'], ['Genshin Impacto', 'rpg'], ['Animal Crossings', 'simulacao'],
  ['Smash Brows', 'luta'], ['Tetriz', 'puzzle'], ['Pac-Mann', 'acao'], ['Donkey Kang', 'plataforma'], ['Mega Mann', 'plataforma'],
  ['Castlevânia', 'aventura'], ['Bayonnetta', 'acao'], ['Devil May Cri', 'acao'], ['Red Dead Redenção', 'aventura'], ['Assassin’s Creeds', 'acao'],
  ['Far Cri', 'tiro'], ['Borderlandz', 'tiro'], ['Cyberpunk 2078', 'rpg'], ['Mass Effects', 'rpg'], ['Dragon Age: Inquisição', 'rpg'],
  ['Hades Redux', 'roguelike'], ['Celestia', 'plataforma'], ['Slay the Spyre', 'roguelike'], ['Vampire Survivors', 'roguelike'], ['Balatrô', 'roguelike'],
  ['Papéis, Por Favor', 'puzzle'], ['Disco Elisium', 'narrativo'], ['Life is Strange', 'narrativo'], ['Phoenix Wrong', 'narrativo'], ['Doki Doki Literatura Clube', 'narrativo'],
];

const ST1 = [
  'Nintendu', 'Soni Entertainment', 'Microsoftt Games', 'Ubisoff', 'Eletronic Arts', 'Activizion', 'Blizzart', 'Valv Corporation', 'Rockstarr Games',
  'CD Projeto Red', 'FromSoftwear', 'Capcon', 'Konamy', 'Squared Enix', 'Bandai Namko', 'Seiga', 'Naughty Dag', 'Bethesta Softworks', 'Epik Games',
  'Riott Games', 'Mojong Studios', 'Team Cherri', 'Supergiants Games', 'Devolvér Digital', 'Paradoxo Interactive', 'Tencant Games', 'Take-Three Interactive',
  'Atlas Soft', 'Gearbocks Software', 'Larian Estúdios', 'Obsidiana Entertainment', 'Remedy Entretenimento', 'Insomniac Games BR', 'Treyarch Pixel', 'Naughty Gato',
  'Ghost Cat Studio', 'Mega Crit Games', 'Chucklefish Brasil', 'Re-Logik', 'Hello Gamers', 'Zeroo Games', 'Studio Ghiblé Interactive', 'Pixar de Bolso',
];


// v0.7: mais franquias e estúdios paródia
const FR2 = [
  ['Gran Turismo Tropical', 'acao'], ['Forza Horizonte', 'acao'], ['Tekken Tag Turbo', 'luta'], ['Mortal Kombate', 'luta'], ['Guilty Gear Strife', 'luta'],
  ['Persona 7', 'rpg'], ['Dragon Quest Eleven e Meio', 'rpg'], ['Xenoblade Crônicas', 'rpg'], ['Baldur’s Portão', 'rpg'], ['Divinity Original Pecado', 'rpg'],
  ['Pillars of Eternidade', 'rpg'], ['Path of Exílio', 'rpg'], ['Monster Hunter Mundo Afora', 'acao'], ['Bloodborn', 'rpg'], ['Sekiro: Sombras Morrem Duas Vezes', 'acao'],
  ['God of Guerra', 'acao'], ['Uncharted: Tesouro Perdido', 'aventura'], ['The Last of Us Todos', 'aventura'], ['Horizon Zero Amanhecer', 'aventura'], ['Ghost of Tsushima Brasil', 'aventura'],
  ['Spider-Homem Aranha', 'acao'], ['Batmano: Arkham Quartel', 'acao'], ['Hitmann', 'acao'], ['Metal Gear Sólido', 'acao'], ['Splinter Célula', 'acao'],
  ['Rainbow Six Cerco', 'tiro'], ['Battlefild', 'tiro'], ['Halo Infinito e Além', 'tiro'], ['Doom Eternal Eterno', 'tiro'], ['Destiny Dois Mil', 'tiro'],
  ['Civilization de Bolso', 'estrategia'], ['XCOM: Inimigo Interno', 'estrategia'], ['Total War: Três Reinos do Sertão', 'estrategia'], ['StarCraft Brasil', 'estrategia'], ['Command & Conquistar', 'estrategia'],
  ['Cities: Skylinhas', 'simulacao'], ['RollerCoaster Magnata', 'simulacao'], ['Planet Zoológico', 'simulacao'], ['Euro Truck Simulador Rodoviário', 'simulacao'], ['Farming Simulador 99', 'simulacao'],
  ['Kerbal Space Programa', 'sandbox'], ['Garry’s Mod Gari', 'sandbox'], ['Roblux', 'sandbox'], ['Dreams Sonhos', 'sandbox'], ['Teardown Total', 'sandbox'],
  ['Guitar Hero Herói', 'musical'], ['Just Dancê', 'musical'], ['Beat Sabre', 'musical'], ['Crypt of the NecroDancer Funk', 'musical'], ['Rhythm Heaven Paraíso', 'musical'],
  ['Alan Wake Acorda', 'terror'], ['Amnesia: A Descida Sombria', 'terror'], ['Outlast Resista', 'terror'], ['Five Nights at Freddi’s', 'terror'], ['Dead Space Morto', 'terror'],
  ['NBA 2K Cesta', 'esporte'], ['Madden Futebol Americano', 'esporte'], ['Tony Hawk Skate Pro', 'esporte'], ['Wii Sports Resort Praia', 'esporte'], ['Mario Tennis Aces Dois', 'esporte'],
  ['Ori e a Floresta Cega', 'plataforma'], ['Shovel Knight Pá', 'plataforma'], ['Super Meat Boy Carne', 'plataforma'], ['Rayman Origens Fim', 'plataforma'], ['Crash Bandicoot Bandido', 'plataforma'],
  ['Spyro Dragão Roxo', 'plataforma'], ['Katamari Rola Aí', 'puzzle'], ['The Witness Testemunha', 'puzzle'], ['Baba Is You Sou Eu', 'puzzle'], ['Candy Crush Doçura', 'puzzle'],
  ['Return of the Obra Dinn', 'narrativo'], ['Firewatch Vigia', 'narrativo'], ['What Remains of Edith Fink', 'narrativo'], ['Oxenfree Livre', 'narrativo'], ['Telltale Walking Dead BR', 'narrativo'],
  ['Dead Cells Mortas', 'roguelike'], ['Risk of Rain Chuva', 'roguelike'], ['Enter the Gungeon Masmorra', 'roguelike'], ['Binding of Isaac Isac', 'roguelike'], ['Noita Magia', 'roguelike'],
];
const ST2 = [
  'Insomnia Interativo', 'Pixel Mate Studio', 'Rockfish Software', 'Maré Alta Games', 'Bonsai Byte', 'Jabuticaba Soft', 'Cangaço Digital', 'Tupinambá Interactive',
  'Sertão Studios', 'Oitenta e Quatro Bits', 'Arara Azul Games', 'Boto Cor-de-Rosa Entretenimento', 'Saci Labs', 'Mandacaru Games', 'Caipora Interativa', 'Lampião Digital',
  'Vitória-Régia Studio', 'Garoa Games', 'Pão de Queijo Soft', 'Coxinha Entertainment', 'Moqueca Interactive', 'Tamanduá Bits', 'Cuíca Sound & Games', 'Jacaré do Brejo',
  'Ubisoftware', 'Konami Dois', 'Nintenda', 'Sega Mega', 'Rare Raro', 'Bungee Games', 'Id Software Ido', 'Naughty Bear', 'Ninja Teoria', 'Respawn Renasce',
  'Kojima Prodúções', 'Platinum Platina Games', 'Arkane Arcano', 'Frictional Fricção', 'Thatgamecompany Aquela', 'Annapurna Interativa BR',
];
export const FRANCHISES = [...FR1, ...FR2];
export const STUDIOS = [...ST1, ...ST2];

export const CONSOLES = [
  { id: 'ps', nome: 'PlayStasion 5', empresa: 'Soni Entertainment', tipo: 'Console' },
  { id: 'xb', nome: 'Xbux Series Y', empresa: 'Microsoftt Games', tipo: 'Console' },
  { id: 'ns', nome: 'Nintendu Switch', empresa: 'Nintendu', tipo: 'Portátil' },
  { id: 'sd', nome: 'Vapor Dock', empresa: 'Valv Corporation', tipo: 'Portátil' },
  { id: 'gb', nome: 'Game Boi Advanced', empresa: 'Nintendu', tipo: 'Portátil' },
  { id: 'md', nome: 'Mega Drave', empresa: 'Seiga', tipo: 'Console' },
  { id: 'sn', nome: 'Super Nintendu', empresa: 'Nintendu', tipo: 'Console' },
  { id: 'at', nome: 'Ataro 2600', empresa: 'Ataro', tipo: 'Console' },
  { id: 'qs', nome: 'Meta Quast 3', empresa: 'Meta-Quest Labs', tipo: 'VR' },
  { id: 'ps1', nome: 'PlayStasion', empresa: 'Soni Entertainment', tipo: 'Console' },
  { id: 'dc', nome: 'Dreamcastle', empresa: 'Seiga', tipo: 'Console' },
  { id: 'gc', nome: 'GameCubo', empresa: 'Nintendu', tipo: 'Console' },
  { id: 'ps2', nome: 'PlayStasion 2', empresa: 'Soni Entertainment', tipo: 'Console' },
  { id: 'psp', nome: 'PSP-ish Portable', empresa: 'Soni Entertainment', tipo: 'Portátil' },
  { id: 'xb360', nome: 'Xbux 360º', empresa: 'Microsoftt Games', tipo: 'Console' },
  { id: 'wii', nome: 'Wiii', empresa: 'Nintendu', tipo: 'Console' },
];

/** Lojas e plataformas de distribuição (usadas pelo modo Indie). */
export const STORES = {
  hub: { id: 'hub', nome: 'inch.io', desc: 'Loja aberta para qualquer um (paródia de itch.io): grátis, pago ou "pague quanto quiser".' },
  vapor: { id: 'vapor', nome: 'Stean', desc: 'A maior loja de PC (paródia de Steam): taxa por jogo, wishlists, festivais de demos.' },
  epik: { id: 'epik', nome: 'Epik Store', desc: 'Loja de PC mais seletiva, corte menor.' },
  gojo: { id: 'gojo', nome: 'GOJ', desc: 'Loja sem DRM, curadoria forte.' },
  mobile: { id: 'mobile', nome: 'Ap Store / Googol Play', desc: 'Lojas de celular. Muito volume, preço baixo, anúncios.' },
  switch: { id: 'switch', nome: 'Nintendu eShop', desc: 'Loja do portátil híbrido. Exige portabilidade e certificação.' },
  console: { id: 'console', nome: 'PlayStasion / Xbux Store', desc: 'Lojas de console. Kit de desenvolvimento e certificação.' },
};
export const CROWDFUNDING = [
  { id: 'kickstarta', nome: 'Kickstarta', taxa: 0.05 + 0.04 },
  { id: 'catarsi', nome: 'Catarsi', taxa: 0.13 },
  { id: 'patreen', nome: 'Patreen', taxa: 0.1 },
];

/** Redes sociais fictícias (usadas na v0.3). */
export const NETWORKS = [
  { id: 'tuiter', nome: 'Tuiter', ico: '🐦', cor: '#1d9bf0', tipo: 'texto', unid: 'piu', desc: 'Microblog rápido. Bom para devlogs curtos e GIFs.' },
  { id: 'instagrao', nome: 'Instagrão', ico: '📸', cor: '#d6249f', tipo: 'imagem', unid: 'foto', desc: 'Imagens e reels. Arte e bastidores.' },
  { id: 'youtobe', nome: 'YouTobe', ico: '▶️', cor: '#e62117', tipo: 'video', unid: 'vídeo', desc: 'Trailers e devlogs longos. Cresce devagar, dura muito.' },
  { id: 'tiktak', nome: 'TikTak', ico: '🎵', cor: '#111111', tipo: 'curto', unid: 'clipe', desc: 'Vídeos verticais curtos. Pode viralizar.' },
  { id: 'discorde', nome: 'Discorde', ico: '💬', cor: '#5865f2', tipo: 'comunidade', unid: 'aviso', desc: 'O servidor da sua comunidade. Exige moderação.' },
  { id: 'redit', nome: 'Redit', ico: '👽', cor: '#ff4500', tipo: 'forum', unid: 'tópico', desc: 'Fóruns de nicho. Honestidade vale mais que propaganda.' },
  { id: 'twitsh', nome: 'Twitsh', ico: '🎮', cor: '#9146ff', tipo: 'stream', unid: 'live', desc: 'Lives. Streamers jogam sua demo.' },
];

/** Revistas, sites e canais de imprensa (fictícios) — usados em críticas, notícias e na imprensa (v0.3). */
export const OUTLETS = [
  { id: 'igm', nome: 'IGM Brasil', tipo: 'site', alcance: 5, rigor: 0.65, vies: -0.1, gosta: ['acao', 'tiro', 'rpg'] },
  { id: 'gamespott', nome: 'GameSpott', tipo: 'site', alcance: 4, rigor: 0.6, vies: 0, gosta: ['aventura', 'estrategia'] },
  { id: 'kotako', nome: 'Kotako Pixel', tipo: 'site', alcance: 4, rigor: 0.5, vies: 0.3, gosta: ['narrativo', 'casual', 'puzzle'] },
  { id: 'polygan', nome: 'Polygan', tipo: 'site', alcance: 4, rigor: 0.55, vies: 0.15, gosta: ['narrativo', 'aventura'] },
  { id: 'pcgamer', nome: 'PC Gamér', tipo: 'revista', alcance: 3, rigor: 0.75, vies: -0.3, gosta: ['estrategia', 'simulacao', 'rpg'] },
  { id: 'famitzu', nome: 'Famitzu', tipo: 'revista', alcance: 3, rigor: 0.7, vies: 0, gosta: ['plataforma', 'rpg', 'luta'] },
  { id: 'eurogamers', nome: 'Eurogamers', tipo: 'site', alcance: 3, rigor: 0.6, vies: 0.1, gosta: ['simulacao', 'roguelike', 'puzzle'] },
  { id: 'superpover', nome: 'SuperGamePover', tipo: 'revista', alcance: 3, rigor: 0.45, vies: 0.35, gosta: ['acao', 'plataforma', 'casual'] },
  { id: 'gameinformar', nome: 'Game Informar', tipo: 'revista', alcance: 3, rigor: 0.7, vies: -0.1, gosta: ['acao', 'rpg'] },
  { id: 'gamerbr', nome: 'Gamer Brasill', tipo: 'site', alcance: 2, rigor: 0.5, vies: 0.2, gosta: ['casual', 'simulacao'] },
  { id: 'indiezao', nome: 'Indiezão', tipo: 'site', alcance: 2, rigor: 0.4, vies: 0.5, gosta: ['roguelike', 'narrativo', 'puzzle', 'plataforma'] },
  { id: 'pixeldesk', nome: 'Pixel de Mesa', tipo: 'blog', alcance: 1, rigor: 0.35, vies: 0.6, gosta: ['plataforma', 'puzzle', 'aventura'] },
  { id: 'jogatina', nome: 'Jogatina Semanal', tipo: 'revista', alcance: 2, rigor: 0.55, vies: 0.1, gosta: ['esporte', 'acao', 'tiro'] },
  { id: 'terrorpedia', nome: 'Terrorpédia', tipo: 'blog', alcance: 1, rigor: 0.5, vies: 0.4, gosta: ['terror', 'narrativo'] },
  { id: 'ritmoeplay', nome: 'Ritmo & Play', tipo: 'blog', alcance: 1, rigor: 0.45, vies: 0.5, gosta: ['musical', 'casual', 'puzzle'] },
  { id: 'sandboxer', nome: 'Sandboxer BR', tipo: 'site', alcance: 2, rigor: 0.5, vies: 0.25, gosta: ['sandbox', 'simulacao', 'estrategia'] },
];
export const YOUTUBERS = [
  { id: 'kaua', nome: 'Kauã Plays', seg: 1_200_000, estilo: 'zoeira', gosta: ['acao', 'tiro', 'casual'] },
  { id: 'lorena', nome: 'Lorena Joga Tudo', seg: 540_000, estilo: 'fofa', gosta: ['simulacao', 'casual', 'narrativo'] },
  { id: 'indiebr', nome: 'Indie BR Canal', seg: 210_000, estilo: 'crítico', gosta: ['roguelike', 'plataforma', 'puzzle'] },
  { id: 'zeca', nome: 'Zeca do Terror', seg: 880_000, estilo: 'susto', gosta: ['aventura', 'tiro'] },
  { id: 'rpgmaster', nome: 'RPG Master TV', seg: 320_000, estilo: 'analítico', gosta: ['rpg', 'estrategia'] },
  { id: 'speedy', nome: 'Speedy Run', seg: 95_000, estilo: 'speedrun', gosta: ['plataforma', 'acao', 'luta'] },
  { id: 'cozy', nome: 'Cozy Corner', seg: 48_000, estilo: 'relax', gosta: ['simulacao', 'narrativo', 'casual'] },
  { id: 'nanogamer', nome: 'Nano Gamer', seg: 12_000, estilo: 'iniciante', gosta: ['casual', 'puzzle', 'plataforma'] },
  { id: 'tiozao', nome: 'Tiozão dos Games', seg: 2_300_000, estilo: 'nostálgico', gosta: ['plataforma', 'luta', 'esporte'] },
  { id: 'madruga', nome: 'Madruga Horror', seg: 410_000, estilo: 'susto', gosta: ['terror', 'narrativo', 'aventura'] },
  { id: 'bpmbr', nome: 'BPM Brasil', seg: 76_000, estilo: 'musical', gosta: ['musical', 'casual', 'puzzle'] },
  { id: 'mineirinha', nome: 'Mineirinha Constrói', seg: 150_000, estilo: 'relax', gosta: ['sandbox', 'simulacao'] },
];
export const STREAMERS = [
  { id: 'jujuba', nome: 'Jujuba Live', seg: 650_000, estilo: 'zoeira', gosta: ['casual', 'acao', 'tiro'] },
  { id: 'tchola', nome: 'Tchola', seg: 280_000, estilo: 'competitivo', gosta: ['tiro', 'luta', 'estrategia'] },
  { id: 'mariaclara', nome: 'MariaClara_TV', seg: 150_000, estilo: 'fofa', gosta: ['simulacao', 'narrativo', 'casual'] },
  { id: 'dudu', nome: 'DuduNoCafé', seg: 42_000, estilo: 'relax', gosta: ['roguelike', 'puzzle', 'plataforma'] },
  { id: 'pixelito', nome: 'Pixelito', seg: 8_500, estilo: 'indie', gosta: ['plataforma', 'roguelike', 'aventura'] },
  { id: 'gabs', nome: 'Gabs Speedrun', seg: 21_000, estilo: 'speedrun', gosta: ['plataforma', 'acao'] },
  { id: 'carolfps', nome: 'CarolFPS', seg: 390_000, estilo: 'competitivo', gosta: ['tiro', 'esporte', 'luta'] },
  { id: 'noitesblu', nome: 'Noites Blu', seg: 33_000, estilo: 'relax', gosta: ['musical', 'narrativo', 'terror'] },
];

/** Eventos do mundo gamer: feiras, jams, festivais e premiações (fictícios). */
export const FAIRS = [
  { id: 'gdk', nome: 'GDK — Conferência de Devs', mes: 3, tipo: 'conf', custo: 900, desc: 'Palestras, networking e contatos de publishers.' },
  { id: 'e3', nome: 'E-Três Expo', mes: 6, tipo: 'feira', custo: 4000, desc: 'A velha feira de anúncios de verão. Boa para hype de jogos grandes.' },
  { id: 'summer', nome: 'Summer Game Fast', mes: 6, tipo: 'show', custo: 1500, desc: 'Transmissão de anúncios. Trailer entra na grade, se tiver sorte.' },
  { id: 'gamescon', nome: 'Gamescon', mes: 8, tipo: 'feira', custo: 5200, desc: 'A maior feira da Europa. Imprensa e público lotando.' },
  { id: 'tokio', nome: 'Tokio Game Show', mes: 9, tipo: 'feira', custo: 4500, desc: 'Feira japonesa. Bom para jogos de nicho e portáteis.' },
  { id: 'bgz', nome: 'Brasil Game Shoe', mes: 10, tipo: 'feira', custo: 1800, desc: 'A feira nacional. Público fã e imprensa local.' },
  { id: 'pac', nome: 'PAC Expo', mes: 4, tipo: 'feira', custo: 1400, desc: 'Convenção de jogos de mesa e digitais. Ótimo para indies.' },
  { id: 'awardz', nome: 'The Game Awardz', mes: 12, tipo: 'premio', custo: 0, desc: 'Cerimônia anual de premiação.' },
];
export const JAMS = [
  { id: 'ggj', nome: 'Global Gamejam', mes: 1, dur: 1, tema: 'surpresa' },
  { id: 'ludum', nome: 'Ludum Dari', mes: 4, dur: 1, tema: 'surpresa' },
  { id: 'gmtq', nome: 'GMTQ Jam', mes: 7, dur: 1, tema: 'mecânica' },
  { id: 'brakeys', nome: 'Brakeys Jam', mes: 9, dur: 1, tema: 'surpresa' },
  { id: 'ludum2', nome: 'Ludum Dari (Outono)', mes: 12, dur: 1, tema: 'surpresa' },
  { id: 'bairro', nome: 'Jam do Bairro', mes: 2, dur: 1, tema: 'local' },
  { id: 'cozyjam', nome: 'Cozy Jam', mes: 5, dur: 1, tema: 'aconchego' },
  { id: 'jamdojogo', nome: 'Jam Nacional de Jogos', mes: 11, dur: 1, tema: 'surpresa' },
];
export const FESTIVALS = [
  { id: 'nextfest1', nome: 'Stean Next Fest (Fev)', mes: 2, dur: 1 },
  { id: 'nextfest2', nome: 'Stean Next Fest (Jun)', mes: 6, dur: 1 },
  { id: 'nextfest3', nome: 'Stean Next Fest (Out)', mes: 10, dur: 1 },
];
export const STEAN_SALES = [
  { id: 'inverno', nome: 'Promoção de Inverno', mes: 12, dur: 2, desc: 0.5, boost: 1.9 },
  { id: 'primavera', nome: 'Promoção de Primavera', mes: 3, dur: 1, desc: 0.3, boost: 1.4 },
  { id: 'verao', nome: 'Promoção de Verão', mes: 6, dur: 2, desc: 0.4, boost: 1.7 },
  { id: 'outono', nome: 'Promoção de Outono', mes: 11, dur: 1, desc: 0.35, boost: 1.45 },
];

/** Jogos grandes que "sombreiam" o mercado quando lançam (paródias). */
export const BLOCKBUSTERS = [
  'Mortal Kombate 13', 'Gran Turismo Tropical 9', 'Baldur’s Portão 4', 'Persona 7: Memórias', 'Hitmann: Contrato Final', 'God of Guerra: Ragnarök do Sertão', 'The Last of Us Todos 3',
  'Grand Thieft Auto VII', 'Call of Duly: Guerra Moderna 9', 'Elder Ring: Sombra da Árvore', 'Resident Evel 10', 'Final Fantasia XVIII', 'Marlo Kart 10',
  'The Whitcher 5', 'Mineracraft 2', 'Fortnight Capítulo 12', 'Skyrym VI', 'Cyberpunk 2088', 'Red Dead Redenção 3', 'Hades III', 'A Lenda de Zelta: Reino das Lágrimas Secas',
];

export const HEADLINE_TEMPLATES = {
  rival: ['{studio} lança “{jogo}” e crítica se divide.', '“{jogo}” da {studio} estreia no topo das paradas.', '{studio} anuncia sequência de “{jogo}”.'],
  mercado: ['Mercado indie bate recorde de lançamentos: {n} jogos por dia.', 'Estúdios independentes crescem {p}% no país.', 'Jogadores cansados de remakes pedem originalidade.'],
  tendencia: ['“{genero}” volta a ser a febre entre os jogadores.', 'Tema “{tema}” domina as buscas na loja.'],
  industria: ['Demissões em massa abalam um gigante dos games.', 'Sindicato dos devs de games exige jornada de 40 horas.', 'Fusão bilionária redesenha o mapa da indústria.', 'Lojas digitais mudam regras de reembolso.', 'Estúdio famoso adia o jogo mais esperado do ano pela terceira vez.'],
};

/** Gera nome de jogo de rival: sequência de franquia ou título novo. */
export function rivalFranchise(s, rnd) {
  const f = FRANCHISES[Math.floor(rnd(s) * FRANCHISES.length)];
  const n = 2 + Math.floor(rnd(s) * 12);
  return { nome: `${f[0]} ${romano(n)}`, genero: f[1] };
}
export function romano(n) {
  const r = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let o = '';
  for (const [v, t] of r) while (n >= v) { o += t; n -= v; }
  return o;
}
