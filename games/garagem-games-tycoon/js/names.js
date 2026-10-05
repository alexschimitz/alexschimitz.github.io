// Gerador de títulos de jogos (PT-BR) por tema e gênero. Determinístico (usa o RNG do estado).
import { rnd, pick } from './util.js';

// ---- gênero gramatical (heurística + exceções) ----
const MASC_A = new Set(['Mapa', 'Planeta', 'Dia', 'Cometa', 'Sistema', 'Problema', 'Tema', 'Clima', 'Drama', 'Samba', 'Poeta', 'Diploma', 'Dilema', 'Programa', 'Telefonema', 'Pijama', 'Idioma', 'Lema', 'Fantasma', 'Guerrilheira']);
const FEM_NO_A = new Set(['Mão', 'Flor', 'Luz', 'Paz', 'Noz', 'Voz', 'Cruz', 'Cor', 'Dor', 'Sé', 'Fé', 'Maré', 'Tribo', 'Moto', 'Foto', 'Rede', 'Ponte', 'Noite', 'Chave', 'Fome', 'Gente', 'Ilha', 'Torre', 'Lua', 'Carne', 'Neve', 'Chuva', 'Sombra', 'Pele', 'Fonte', 'Arte', 'Corte', 'Morte', 'Sorte', 'Fortaleza', 'Selva']);
export function genero(w) {
  const first = w.split(' ')[0];
  if (MASC_A.has(first)) return 'm';
  if (FEM_NO_A.has(first)) return 'f';
  if (/(a|ã|ção|são|dade|gem|ude|ie|ice|ez|ura)$/i.test(first)) return 'f';
  return 'm';
}
const art = (w) => (genero(w) === 'f' ? 'A' : 'O') + ' ' + w;
const de = (w) => (genero(w) === 'f' ? 'da ' : 'do ') + w;
const em = (w) => (genero(w) === 'f' ? 'na ' : 'no ') + w;

// ---- palavras por tema (nome do tema -> palavras) ----
export const THEME_WORDS = {
  'Hotel': ['Recepção', 'Hóspede', 'Suíte', 'Concierge', 'Lobby', 'Camareira', 'Diária', 'Cobertura'],
  'Aeroporto': ['Terminal', 'Embarque', 'Bagagem', 'Portão', 'Escala', 'Torre', 'Pista', 'Alfândega'],
  'Orquestra': ['Maestro', 'Partitura', 'Violino', 'Concerto', 'Sinfonia', 'Batuta', 'Ensaio', 'Camarote'],
  'Padaria': ['Pãozinho', 'Fornada', 'Massa', 'Balcão', 'Cafezinho', 'Broa', 'Confeitaria', 'Madrugada'],
  'Circo Espacial': ['Trapézio', 'Palhaço', 'Órbita', 'Picadeiro', 'Cosmos', 'Malabarista', 'Lona', 'Estrelado'],
  'Cidade Flutuante': ['Nuvem', 'Balão', 'Ilha-Céu', 'Ancoragem', 'Aeróstato', 'Altitude', 'Dirigível', 'Plataforma'],
  'Detetive Gato': ['Miau', 'Pistas', 'Bigode', 'Caso', 'Lupa', 'Almofada', 'Gatuno', 'Mistério'],
  'Torneio de Culinária': ['Tempero', 'Panela', 'Chef', 'Prato', 'Cozinha', 'Jurado', 'Sobremesa', 'Avental'],
  'Reality Show': ['Confinamento', 'Paredão', 'Eliminação', 'Câmeras', 'Casa', 'Votação', 'Líder', 'Audiência'],
  'Tribunal': ['Júri', 'Sentença', 'Réu', 'Objeção', 'Veredito', 'Toga', 'Advogado', 'Provas'],
  'Bombeiros': ['Sirene', 'Mangueira', 'Resgate', 'Incêndio', 'Quartel', 'Hidrante', 'Plantão', 'Escada'],
  'Resgate na Montanha': ['Pico', 'Avalanche', 'Cordas', 'Trilha', 'Neve', 'Helicóptero', 'Cume', 'Refúgio'],
  'Zoológico': ['Jaula', 'Tratador', 'Girafa', 'Safári', 'Recinto', 'Visita', 'Filhote', 'Bilheteria'],
  'Aquário': ['Cardume', 'Coral', 'Tanque', 'Peixe-Palhaço', 'Maré', 'Bolhas', 'Água-Viva', 'Vidro'],
  'Museu': ['Relíquia', 'Galeria', 'Curadoria', 'Exposição', 'Acervo', 'Vitrine', 'Guia', 'Múmia'],
  'Biblioteca Mágica': ['Grimório', 'Estante', 'Pergaminho', 'Bibliotecário', 'Índice', 'Tomo', 'Silêncio', 'Volume'],
  'Cemitério Divertido': ['Lápide', 'Esqueleto', 'Coveiro', 'Caveira', 'Mausoléu', 'Fantasminha', 'Epitáfio', 'Velório'],
  'Samba': ['Batucada', 'Passista', 'Enredo', 'Cavaquinho', 'Roda', 'Avenida', 'Pandeiro', 'Bateria'],
  'Futevôlei': ['Areia', 'Rede', 'Bola', 'Orla', 'Saque', 'Dupla', 'Placar', 'Quadra'],
  'Feira Livre': ['Barraca', 'Pastel', 'Fruta', 'Freguês', 'Xepa', 'Balança', 'Toldo', 'Barraqueiro'],
  'Trem Fantasma': ['Vagão', 'Túnel', 'Susto', 'Trilho', 'Estação', 'Lanterna', 'Apito', 'Assombrado'],
  'Metrô Lotado': ['Catraca', 'Plataforma', 'Vagão', 'Hora do Rush', 'Empurra-Empurra', 'Baldeação', 'Linha', 'Bilhete'],
  'Home Office': ['Reunião', 'Videochamada', 'Pijama', 'Notebook', 'Fone', 'Prazo', 'Cafeteira', 'Wi-Fi'],
  'Startup': ['Pitch', 'Rodada', 'Unicórnio', 'Pivô', 'Investidor', 'Garagem', 'Escala', 'Aceleradora'],
  'Intercâmbio': ['Mala', 'Passaporte', 'Família Anfitriã', 'Sotaque', 'Visto', 'Saudade', 'Aeroporto', 'Campus'],
  'Cartório': ['Firma', 'Carimbo', 'Protocolo', 'Senha', 'Guichê', 'Certidão', 'Papelada', 'Fila'],
  'Pedágio': ['Cancela', 'Tarifa', 'Pista', 'Rodovia', 'Cabine', 'Fila', 'Troco', 'Estrada'],
  'Churrasco': ['Picanha', 'Brasa', 'Espeto', 'Farofa', 'Laje', 'Cerveja', 'Churrasqueiro', 'Domingo'],
  'Quermesse': ['Barraquinha', 'Pescaria', 'Bingo', 'Pipoca', 'Prenda', 'Roda-Gigante', 'Quentão', 'Bandeirinha'],
  'Laboratório de Slime': ['Gosma', 'Glitter', 'Pote', 'Borax', 'Esticar', 'Bolha', 'Textura', 'Receita'],
  'Aviação': ['Asas', 'Hangar', 'Piloto', 'Decolagem', 'Turbina', 'Aeroporto', 'Voo', 'Cabine', 'Hélice', 'Pouso'],
  'Aliens': ['Invasão', 'Alienígena', 'Nave-Mãe', 'Abdução', 'Extraterrestre', 'Zorg', 'Marciano', 'Colônia', 'Sinal'],
  'Assassino': ['Lâmina', 'Sombra', 'Contrato', 'Alvo', 'Silêncio', 'Adaga', 'Veneno', 'Capuz', 'Execução'],
  'Negócios': ['Império', 'Ações', 'Lucro', 'Mercado', 'Franquia', 'Fusão', 'Bolsa', 'Magnata', 'Startup'],
  'Cidade': ['Metrópole', 'Prefeito', 'Avenida', 'Bairro', 'Arranha-Céu', 'Trânsito', 'Centro', 'Praça', 'Esquina'],
  'Comédia': ['Trapalhada', 'Gargalhada', 'Piada', 'Besteirol', 'Palhaçada', 'Confusão', 'Mico', 'Zoeira', 'Pegadinha'],
  'Culinária': ['Cozinha', 'Tempero', 'Feijoada', 'Chef', 'Receita', 'Panela', 'Restaurante', 'Sobremesa', 'Forno'],
  'Crime': ['Quadrilha', 'Assalto', 'Máfia', 'Chefão', 'Fuga', 'Delegacia', 'Contrabando', 'Golpe', 'Becos'],
  'Cyberpunk': ['Neon', 'Chip', 'Rede', 'Androide', 'Corporação', 'Hacker', 'Cidade Neon', 'Implante', 'Sistema'],
  'Dança': ['Passo', 'Pista', 'Baile', 'Coreografia', 'Salão', 'Forró', 'Ritmo', 'Bailarina', 'Festa'],
  'Detetive': ['Caso', 'Pista', 'Lupa', 'Inquérito', 'Indício', 'Álibi', 'Cena do Crime', 'Suspeito', 'Mistério'],
  'Desastres': ['Terremoto', 'Enchente', 'Tsunami', 'Furacão', 'Resgate', 'Avalanche', 'Erupção', 'Colapso', 'Tempestade'],
  'Masmorra': ['Calabouço', 'Tesouro', 'Labirinto', 'Cripta', 'Câmara', 'Armadilha', 'Subsolo', 'Catacumba', 'Chave'],
  'Fantasia': ['Reino', 'Dragão', 'Feitiço', 'Cavaleiro', 'Elfo', 'Poção', 'Castelo', 'Varinha', 'Profecia'],
  'Fazenda': ['Colheita', 'Celeiro', 'Horta', 'Porteira', 'Safra', 'Galinheiro', 'Pasto', 'Sítio', 'Trator'],
  'Moda': ['Passarela', 'Costura', 'Estilo', 'Vitrine', 'Grife', 'Desfile', 'Tendência', 'Look', 'Ateliê'],
  'Hacking': ['Firewall', 'Código', 'Terminal', 'Invasão', 'Senha', 'Backdoor', 'Servidor', 'Exploit', 'Pacote'],
  'História': ['Século', 'Império', 'Batalha', 'Crônica', 'Dinastia', 'Revolução', 'Legado', 'Relíquia', 'Era'],
  'Terror': ['Pesadelo', 'Mansão', 'Maldição', 'Porão', 'Assombração', 'Grito', 'Cemitério', 'Escuridão', 'Sussurro'],
  'Hospital': ['Plantão', 'Enfermaria', 'Doutor', 'Cirurgia', 'Emergência', 'Maca', 'Diagnóstico', 'Residência', 'Ala'],
  'Caça': ['Rastro', 'Presa', 'Floresta', 'Armadilha', 'Troféu', 'Mira', 'Alcateia', 'Safra de Caça', 'Trilha'],
  'Direito': ['Tribunal', 'Júri', 'Objeção', 'Sentença', 'Advogado', 'Processo', 'Álibi', 'Veredito', 'Testemunha'],
  'Ciência Maluca': ['Experimento', 'Laboratório', 'Cobaia', 'Fórmula', 'Invenção', 'Mutação', 'Reator', 'Protótipo', 'Poção'],
  'Artes Marciais': ['Dojo', 'Mestre', 'Punho', 'Torneio', 'Kata', 'Cinturão', 'Discípulo', 'Golpe', 'Chute'],
  'Medieval': ['Feudo', 'Cavaleiro', 'Torneio', 'Fortaleza', 'Cruzada', 'Brasão', 'Trono', 'Cerco', 'Vassalo'],
  'Militar': ['Pelotão', 'Missão', 'Trincheira', 'Operação', 'Comando', 'Fronteira', 'Esquadrão', 'Blindado', 'Tática'],
  'Música': ['Melodia', 'Palco', 'Banda', 'Refrão', 'Show', 'Turnê', 'Estúdio', 'Solo', 'Harmonia'],
  'Mistério': ['Enigma', 'Segredo', 'Charada', 'Neblina', 'Desaparecimento', 'Pista', 'Véu', 'Sombra', 'Eco'],
  'Mitologia': ['Olimpo', 'Titã', 'Oráculo', 'Relâmpago', 'Panteão', 'Herói', 'Labirinto', 'Ambrosia', 'Lira'],
  'Ninja': ['Shuriken', 'Sombra', 'Clã', 'Pergaminho', 'Telhado', 'Fumaça', 'Katana', 'Silêncio', 'Lua'],
  'Pirata': ['Tesouro', 'Caveira', 'Galeão', 'Bússola', 'Maré', 'Ilha', 'Prancha', 'Corsário', 'Mapa'],
  'Pós-Apocalipse': ['Cinzas', 'Ruínas', 'Abrigo', 'Deserto', 'Sobrevivente', 'Radiação', 'Escombros', 'Último', 'Comboio'],
  'Prisão': ['Cela', 'Fuga', 'Pátio', 'Carcereiro', 'Túnel', 'Rebelião', 'Colher', 'Grade', 'Solitária'],
  'Corrida': ['Pista', 'Acelerada', 'Turbo', 'Pit Stop', 'Largada', 'Curva', 'Derrapagem', 'Rally', 'Ponta'],
  'Ritmo': ['Batida', 'Compasso', 'Groove', 'Refrão', 'Nota', 'Pulso', 'Beat', 'Combo', 'Palma'],
  'Romance': ['Coração', 'Paixão', 'Encontro', 'Carta', 'Flerte', 'Segredo', 'Verão', 'Casal', 'Pétala'],
  'Escola': ['Recreio', 'Turma', 'Prova', 'Diretor', 'Intervalo', 'Boletim', 'Formatura', 'Sala', 'Colégio'],
  'Ficção Científica': ['Galáxia', 'Androide', 'Portal', 'Protocolo', 'Colônia', 'Singularidade', 'Estação', 'Quantum', 'Horizonte'],
  'Espaço': ['Órbita', 'Nebulosa', 'Cometa', 'Foguete', 'Astronauta', 'Estrela', 'Cosmos', 'Lua', 'Satélite'],
  'Esportes': ['Campeonato', 'Estádio', 'Título', 'Artilheiro', 'Pódio', 'Final', 'Vestiário', 'Torcida', 'Medalha'],
  'Espião': ['Agente', 'Código', 'Dossiê', 'Disfarce', 'Infiltrado', 'Missão', 'Mensagem', 'Informante', 'Cifra'],
  'Super-heróis': ['Capa', 'Vigilante', 'Poder', 'Máscara', 'Herói', 'Vilão', 'Esquadrão', 'Justiceiro', 'Identidade'],
  'Cirurgia': ['Bisturi', 'Sala de Cirurgia', 'Paciente', 'Ponto', 'Transplante', 'Anestesia', 'Equipe', 'Pulso', 'Prontuário'],
  'Tecnologia': ['Gadget', 'Circuito', 'Bit', 'Nuvem', 'Algoritmo', 'App', 'Lançamento', 'Protótipo', 'Pixel'],
  'Ladrão': ['Roubo', 'Cofre', 'Gatuno', 'Plano', 'Fuga', 'Invasão', 'Joia', 'Telhado', 'Alarme'],
  'Viagem no Tempo': ['Paradoxo', 'Relógio', 'Ontem', 'Amanhã', 'Máquina do Tempo', 'Loop', 'Futuro', 'Passado', 'Linha do Tempo'],
  'Transporte': ['Rota', 'Cargas', 'Estação', 'Caminhão', 'Linha', 'Frete', 'Porto', 'Trem', 'Terminal'],
  'OVNI': ['Disco Voador', 'Área 52', 'Avistamento', 'Luzes', 'Abdução', 'Contato', 'Sinal', 'Fazenda 51', 'Mistério'],
  'Vampiro': ['Presa', 'Castelo', 'Sangue', 'Noite', 'Cripta', 'Morcego', 'Conde', 'Caixão', 'Eternidade'],
  'Pet Virtual': ['Bichinho', 'Ovo', 'Ração', 'Cuidado', 'Mascote', 'Brincadeira', 'Patinha', 'Ninho', 'Carinho'],
  'Vocabulário': ['Palavra', 'Letra', 'Dicionário', 'Cruzadinha', 'Soletrando', 'Frase', 'Sílaba', 'Rima', 'Verbete'],
  'Lobisomem': ['Uivo', 'Lua Cheia', 'Alcateia', 'Maldição', 'Garras', 'Floresta', 'Matilha', 'Presas', 'Noite'],
  'Velho Oeste': ['Duelo', 'Xerife', 'Saloon', 'Bandido', 'Pistoleiro', 'Diligência', 'Deserto', 'Rancho', 'Recompensa'],
  'Zumbis': ['Horda', 'Apocalipse', 'Cérebro', 'Mordida', 'Infectado', 'Sobrevivência', 'Muro', 'Barricada', 'Contágio'],
  'Dinossauros': ['Jurássico', 'Fóssil', 'Ovo', 'Cretáceo', 'Rex', 'Pântano', 'Meteoro', 'Pré-história', 'Manada'],
  'Robôs': ['Autômato', 'Engrenagem', 'Circuito', 'Fábrica', 'Sucata', 'Mecha', 'Bateria', 'Protótipo', 'Parafuso'],
  'Circo': ['Picadeiro', 'Trapézio', 'Palhaço', 'Lona', 'Malabarista', 'Espetáculo', 'Domador', 'Trupe', 'Mágico'],
  'Parque de Diversões': ['Montanha-Russa', 'Roda-Gigante', 'Algodão-Doce', 'Carrossel', 'Bilheteria', 'Fantasma', 'Parque', 'Trem-Fantasma', 'Fila'],
  'Magia': ['Feitiço', 'Grimório', 'Varinha', 'Poção', 'Encanto', 'Mago', 'Runa', 'Academia', 'Aprendiz'],
  'Samurai': ['Katana', 'Honra', 'Ronin', 'Bushido', 'Castelo', 'Clã', 'Tatame', 'Armadura', 'Lâmina'],
  'Distopia': ['Regime', 'Vigilância', 'Muralha', 'Controle', 'Rebelde', 'Cinzas', 'Sistema', 'Resistência', 'Censura'],
  'Safari': ['Savana', 'Expedição', 'Manada', 'Acampamento', 'Leão', 'Rastro', 'Girafa', 'Oásis', 'Binóculo'],
  'Oceano': ['Abismo', 'Recife', 'Corrente', 'Maré', 'Tubarão', 'Náutilo', 'Profundezas', 'Coral', 'Naufrágio'],
  'Carnaval': ['Bloco', 'Samba', 'Fantasia', 'Confete', 'Avenida', 'Bateria', 'Alegoria', 'Folia', 'Enredo'],
  'Folclore Brasileiro': ['Curupira', 'Saci', 'Iara', 'Boitatá', 'Mapinguari', 'Cuca', 'Mula sem Cabeça', 'Lenda', 'Mata'],
  'Construção': ['Obra', 'Canteiro', 'Guindaste', 'Alicerce', 'Andaime', 'Tijolo', 'Empreiteira', 'Cimento', 'Projeto'],
  // novos temas
  'Barista': ['Café', 'Expresso', 'Grão', 'Cafeteria', 'Barista', 'Latte', 'Balcão', 'Xícara'],
  'Camping': ['Acampamento', 'Barraca', 'Fogueira', 'Trilha', 'Lanterna', 'Mochila', 'Lago', 'Saco de Dormir'],
  'Pescaria': ['Anzol', 'Isca', 'Lago', 'Pescador', 'Cardume', 'Vara', 'Píer', 'Rede'],
  'Gatos': ['Gatinho', 'Miau', 'Bigode', 'Novelo', 'Soneca', 'Felino', 'Almofada', 'Garra'],
  'Cachorros': ['Cãozinho', 'Latido', 'Osso', 'Coleira', 'Passeio', 'Focinho', 'Matilha', 'Biscoito'],
  'Bruxaria': ['Caldeirão', 'Bruxa', 'Vassoura', 'Coven', 'Poção', 'Feitiço', 'Floresta', 'Sabá'],
  'Cidade Submarina': ['Abismo', 'Cúpula', 'Submarino', 'Pérola', 'Atlântida', 'Coral', 'Bolha', 'Câmara Estanque'],
  'Oficina Mecânica': ['Oficina', 'Motor', 'Chave Inglesa', 'Macaco', 'Garagem', 'Pneu', 'Graxa', 'Peça'],
  'Jardinagem': ['Jardim', 'Semente', 'Estufa', 'Regador', 'Canteiro', 'Orquídea', 'Folha', 'Broto'],
  'Skate': ['Skate', 'Manobra', 'Rampa', 'Pista', 'Ollie', 'Corrimão', 'Rolimã', 'Quarter'],
  'Surf': ['Onda', 'Prancha', 'Maré', 'Tubo', 'Praia', 'Crista', 'Swell', 'Rabeta'],
  'Futebol de Várzea': ['Várzea', 'Pelada', 'Gol', 'Campinho', 'Jogada', 'Craque', 'Bola', 'Churrasco'],
  'Quadrinhos': ['Gibi', 'Balão', 'Painel', 'Vilão', 'Edição', 'Capa', 'Tira', 'Super'],
  'Boteco': ['Boteco', 'Petisco', 'Balcão', 'Cerveja', 'Mesa', 'Sinuca', 'Samba', 'Dono'],
  'Entregas': ['Entrega', 'Pacote', 'Motoboy', 'Rota', 'Caixa', 'Pedido', 'Bicicleta', 'Endereço'],
  'Streamers': ['Live', 'Chat', 'Inscritos', 'Maratona', 'Câmera', 'Donate', 'Stream', 'Pixel'],
  'Cartas Colecionáveis': ['Baralho', 'Carta', 'Deck', 'Coleção', 'Booster', 'Raridade', 'Mesa', 'Duelo'],
  'Xadrez': ['Xeque', 'Rei', 'Peão', 'Bispo', 'Tabuleiro', 'Gambito', 'Rainha', 'Torre'],
  'Mitologia Nórdica': ['Valhalla', 'Odin', 'Ragnarök', 'Runas', 'Fenrir', 'Martelo', 'Vikings', 'Fiorde'],
  'Contos de Fadas': ['Fada', 'Sapo', 'Castelo', 'Bosque', 'Princesa', 'Maçã', 'Era uma vez', 'Gigante'],
  'Retrô Anos 80': ['Fita', 'Fliperama', 'Neon', 'Sintetizador', 'Locadora', 'Walkman', 'Disquete', 'Pixel'],
  'Lixo Espacial': ['Sucata', 'Órbita', 'Detrito', 'Limpeza', 'Satélite', 'Rebocador', 'Vácuo', 'Fragmento'],
  'Floresta Amazônica': ['Igapó', 'Selva', 'Cipó', 'Boto', 'Mata', 'Rio Negro', 'Seringal', 'Copa'],
  'Cangaço': ['Sertão', 'Cangaceiro', 'Mandacaru', 'Jagunço', 'Cordel', 'Chapéu de Couro', 'Poeira', 'Lampião'],
  'Capoeira': ['Roda', 'Berimbau', 'Mestre', 'Ginga', 'Aú', 'Cordão', 'Axé', 'Meia-Lua'],
  'Festa Junina': ['Quadrilha', 'Fogueira', 'Arraial', 'Milho', 'Sanfona', 'Bandeirola', 'Pescaria', 'Quentão'],
  'Pesadelo': ['Pesadelo', 'Insônia', 'Lençol', 'Sonho', 'Quarto', 'Sono', 'Corredor', 'Boneca'],
  'Vilarejo Aconchegante': ['Vilarejo', 'Chá', 'Lareira', 'Vizinho', 'Padaria', 'Cobertor', 'Estação', 'Cabana'],
  'Robôs Domésticos': ['Robozinho', 'Faxina', 'Aspirador', 'Lar', 'Cozinha', 'Tarefa', 'Bateria', 'Janela'],
  'Faroeste Espacial': ['Xerife Estelar', 'Cosmos', 'Fronteira', 'Foguete', 'Duelo', 'Saloon Orbital', 'Poeira Lunar', 'Colônia'],
};

// ---- palavras por gênero ----
export const GENRE_WORDS = {
  acao: ['Fúria', 'Impacto', 'Ataque', 'Assalto', 'Explosão', 'Rugido', 'Ofensiva', 'Combate', 'Fogo Cruzado'],
  aventura: ['Jornada', 'Odisseia', 'Expedição', 'Busca', 'Segredo', 'Viagem', 'Rastro', 'Aventura'],
  rpg: ['Lenda', 'Crônicas', 'Saga', 'Destino', 'Legado', 'Profecia', 'Herdeiro', 'Guilda'],
  simulacao: ['Simulador', 'Tycoon', 'Manager', 'Empresa', 'Rotina', 'Gestão', 'Construtor', 'Diário'],
  estrategia: ['Conquista', 'Domínio', 'Império', 'Tática', 'Cerco', 'Comando', 'Campanha', 'Guerra'],
  casual: ['Festa', 'Divertido', 'Turma', 'Diversão', 'Brincadeira', 'Parque', 'Mania', 'Clube'],
  plataforma: ['Pulo', 'Salto', 'Corrida', 'Aventura', 'Mundo', 'Fase', 'Moeda', 'Pixel'],
  puzzle: ['Enigma', 'Quebra-Cabeça', 'Lógica', 'Peça', 'Mente', 'Labirinto', 'Bloco', 'Charada'],
  tiro: ['Alvo', 'Gatilho', 'Munição', 'Linha de Frente', 'Bala', 'Arena', 'Mira', 'Zona'],
  luta: ['Arena', 'Punho', 'Torneio', 'Golpe', 'Campeão', 'Ringue', 'Combo', 'Desafiante'],
  roguelike: ['Ciclo', 'Descida', 'Recomeço', 'Abismo', 'Morte', 'Loop', 'Masmorra', 'Corrida'],
  musical: ['Melodia', 'Refrão', 'Batida', 'Palco', 'Solo', 'Turnê', 'Ritmo', 'Coro'],
  terror: ['Pesadelo', 'Sussurro', 'Noite', 'Porão', 'Maldição', 'Sombra', 'Eco', 'Vigília'],
  esporte: ['Campeonato', 'Rodada', 'Final', 'Torneio', 'Liga', 'Arena', 'Placar', 'Pódio'],
  sandbox: ['Oficina', 'Mundo', 'Ateliê', 'Laboratório', 'Terreno', 'Bloco', 'Playground', 'Construtor'],
  narrativo: ['Carta', 'Memória', 'Verão', 'Diário', 'Escolha', 'Capítulo', 'Despedida', 'Silêncio'],
};

const ADJ = [['Perdido', 'Perdida'], ['Sombrio', 'Sombria'], ['Dourado', 'Dourada'], ['Eterno', 'Eterna'], ['Secreto', 'Secreta'], ['Maluco', 'Maluca'], ['Esquecido', 'Esquecida'],
  ['Final', 'Final'], ['Infinito', 'Infinita'], ['Radical', 'Radical'], ['Misterioso', 'Misteriosa'], ['Cósmico', 'Cósmica'], ['Fantástico', 'Fantástica'], ['Selvagem', 'Selvagem'],
  ['Tropical', 'Tropical'], ['Supremo', 'Suprema'], ['Proibido', 'Proibida'], ['Encantado', 'Encantada'], ['Congelado', 'Congelada'], ['Quebrado', 'Quebrada'],
  ['Rebelde', 'Rebelde'], ['Digital', 'Digital'], ['Ancestral', 'Ancestral'], ['Silencioso', 'Silenciosa'], ['Último', 'Última'], ['Pequeno', 'Pequena'],
  ['Atômico', 'Atômica'], ['Neon', 'Neon'], ['Colorido', 'Colorida'], ['Azedo', 'Azeda'], ['Bagunçado', 'Bagunçada'], ['Aconchegante', 'Aconchegante'],
  ['Fugitivo', 'Fugitiva'], ['Invisível', 'Invisível'], ['Antigo', 'Antiga'], ['Lunar', 'Lunar'], ['Sagrado', 'Sagrada'], ['Distante', 'Distante'], ['Sem Nome', 'Sem Nome'], ['Furioso', 'Furiosa']];
const PLACE = ['Vale', 'Ilha', 'Reino', 'Cidade', 'Planeta', 'Floresta', 'Montanha', 'Deserto', 'Vila', 'Porto', 'Torre', 'Subúrbio', 'Fronteira', 'Colônia', 'Mundo'];
const SUBTITLE = ['O Despertar', 'A Vingança', 'Edição Definitiva', 'Contra o Relógio', 'Segredos Perdidos', 'Além do Horizonte', 'O Começo', 'Capítulo Zero', 'Remix', 'Reborn', 'Redux',
  'Última Chance', 'A Origem', 'Sangue Novo', 'Em Busca do Tesouro', 'Noite Eterna', 'O Retorno', 'Tempestade', 'Sem Volta', 'Primeiro Ato', 'Fogo e Gelo', 'Um Novo Dia', 'Memórias',
  'A Grande Fuga', 'Zero Hora', 'Dois Mundos', 'Pixel Edition', 'Turbo', 'Deluxe', 'Ultimate', 'Hora H', 'Volume 1', 'Bônus'];
const PREFIX = ['Super', 'Mega', 'Hiper', 'Mini', 'Ultra', 'Turbo', 'Neo', 'Pocket', 'Retro', 'Dr.', 'Capitão', 'Mestre', 'Rei', 'Pequeno', 'Grande'];
const OP = ['Operação', 'Missão', 'Projeto', 'Código', 'Protocolo', 'Plano', 'Caso'];
const SEQ = ['II', 'III', '2', 'Zero', 'Infinito', 'Prime', 'X'];

/** Palavras de um tema (usa o nome do tema como fallback). */
export function wordsOfTheme(themeName) { return THEME_WORDS[themeName] || [themeName]; }

/** Gera um título. Cada chamada consome o RNG do estado. */
export function makeTitle(s, themeName, genreId) {
  const T = wordsOfTheme(themeName), G = GENRE_WORDS[genreId] || GENRE_WORDS.acao;
  const t = pick(s, T), t2 = pick(s, T), g = pick(s, G);
  const a = (w) => { const p = pick(s, ADJ); return genero(w) === 'f' ? p[1] : p[0]; };
  const k = Math.floor(rnd(s) * 20);
  switch (k) {
    case 0: return `${t} ${a(t)}`;
    case 1: return `${art(t)} ${a(t)}`;
    case 2: return `${t}: ${pick(s, SUBTITLE)}`;
    case 3: return `${pick(s, PREFIX)} ${t}`;
    case 4: return `${g} ${de(t)}`.replace(/^(\S+) (d[oa]) /, (m, x, y) => `${x} ${y} `);
    case 5: return `${t} & ${t2}`;
    case 6: return `${pick(s, OP)} ${t}`;
    case 7: return `${t} ${pick(s, SEQ)}`;
    case 8: return `A Lenda ${de(t)}`;
    case 9: return `Noite ${de(t)}`;
    case 10: return `${t} ${pick(s, ['Deluxe', 'Online', 'Party', 'Story', 'Saga', 'Rush', 'Quest', 'Tales'])}`;
    case 11: return `${g}: ${t}`;
    case 12: return `Mistério ${de(t)}`;
    case 13: return `${art(t)} e ${art(t2).replace(/^[AO] /, (m) => m.toLowerCase())}`;
    case 14: return `${pick(s, PLACE)} ${de(t)}`;
    case 15: return genreId === 'simulacao' ? `${t} Tycoon` : `${t} Clash`;
    case 16: { const pl = pick(s, PLACE); return `${t} ${em(pl)} ${a(pl)}`; }
    case 17: return `Dias ${de(t)}`;
    case 18: return `${t} ${a(t)}: ${pick(s, SUBTITLE)}`;
    default: return `${g} ${a(g)}`;
  }
}
/** N títulos únicos (e diferentes dos já existentes). */
export function suggestTitles(s, themeName, genreId, n = 6, avoid = []) {
  const out = []; const seen = new Set(avoid.map((x) => x.toLowerCase()));
  for (let i = 0; i < n * 6 && out.length < n; i++) {
    const t = makeTitle(s, themeName, genreId).replace(/\s+/g, ' ').trim();
    if (t.length > 34 || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase()); out.push(t);
  }
  return out;
}
/** Quantidade aproximada de combinações distintas por tema/gênero (para documentação/testes). */
export function comboCount(themeName, genreId) {
  const T = wordsOfTheme(themeName).length, G = (GENRE_WORDS[genreId] || GENRE_WORDS.acao).length;
  return T * ADJ.length + T * SUBTITLE.length + T * PREFIX.length + G * T + T * T + OP.length * T + SEQ.length * T + T + T + T * PLACE.length + G * T + T + T * T + PLACE.length * T + T + T * PLACE.length * ADJ.length + T + T * ADJ.length * SUBTITLE.length + G * ADJ.length;
}

/** Banco de títulos prontos de estúdios pequenos (para nomes de rivais, listas de lançamentos, etc.). */
export const TITLE_BANK = [
  'Gatos & Pixels', 'Café com Dragão', 'O Último Trem', 'Torre dos Espelhos', 'Maré Baixa', 'Quebra-Cabeça do Vovô', 'Caçadores de Estrelas', 'Sertão 2099', 'Cabana no Fim do Mundo',
  'Pulo do Sapo', 'Reino dos Fungos', 'Bolhas de Sabão', 'Entregador de Sonhos', 'Fábrica de Nuvens', 'A Casa do Lago', 'Operação Pamonha', 'Samba no Espaço', 'Feijão Mágico',
  'Corrida de Carrinho de Rolimã', 'Cidade do Trovão', 'Labirinto de Gelatina', 'Pirata Sem Mapa', 'O Segredo do Cartório', 'Mestre dos Bolinhos', 'Rei do Pastel', 'Zumbis na Laje',
  'Baile da Lua Cheia', 'Dona Baratinha Contra-Ataca', 'Planeta dos Gatos', 'Vale dos Sinos', 'Ninja de Chinelo', 'Detetive Cachorro-Quente', 'Caminhão de Sorvete 3000', 'O Mágico de Oz Pixelado',
  'Jardim Secreto da Dona Lúcia', 'Super Mochila', 'Fuga do Elevador', 'Velho Oeste Mineiro', 'Dragões do Bairro', 'Cavaleiros da Padaria', 'Aventuras de um Cubo', 'Tesouro do Capitão Pimenta',
  'Rua do Gato Preto', 'Noite no Museu de Cera', 'Guerra dos Biscoitos', 'Torre de Lego', 'Cartão Vermelho', 'Última Fita Cassete', 'Fliperama do Zé', 'A Mansão Sem Porta',
  'Lanterna Verde Musgo', 'Bruxinha do Sítio', 'Pescaria Radical', 'Robô de Cozinha', 'Skate no Asfalto Quente', 'Rádio Fantasma', 'Dança das Cadeiras Mortais', 'Planeta Zero', 'Cidade das Pontes',
  'Cangaço Cibernético', 'Saci Ninja', 'Iara Remix', 'Curupira Racing', 'Boitatá Blaster', 'Caipora Quest', 'Mapinguari Hunter', 'Cuca Cozinheira', 'Festa de São João Zumbi',
  'Alienígena na Feira', 'Ônibus Espacial 171', 'Metrô Fantasma', 'Escola de Magia do Interior', 'Churrasco Final', 'Vizinhos do Apocalipse', 'Pet Shop Galáctico', 'Banco Imobiliário Infernal',
];

export function randomTitleBank(s) { return pick(s, TITLE_BANK); }
