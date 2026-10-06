// Simplificação automática (regras fixas, sem opinião) de ementas de proposições
// e agrupamento dos temas oficiais em etiquetas curtas. Usado quando ainda não existe
// um resumo escrito à mão em politica/data/resumos-simples.json.
import { norm } from './lib.mjs';

// Leis mais citadas -> nome popular. Chave: "L:numero/ano" (lei ordinária), "LC:numero/ano", "DL:numero/ano".
export const LEIS = {
  'L:8069/1990': 'o Estatuto da Criança e do Adolescente (ECA)',
  'L:9394/1996': 'a Lei de Diretrizes e Bases da Educação (LDB)',
  'L:8078/1990': 'o Código de Defesa do Consumidor',
  'L:10406/2002': 'o Código Civil',
  'DL:2848/1940': 'o Código Penal',
  'DL:3689/1941': 'o Código de Processo Penal',
  'L:13105/2015': 'o Código de Processo Civil',
  'DL:5452/1943': 'a CLT (Consolidação das Leis do Trabalho)',
  'L:9503/1997': 'o Código de Trânsito Brasileiro',
  'L:8080/1990': 'a Lei Orgânica da Saúde (lei do SUS)',
  'L:8213/1991': 'a lei dos benefícios da Previdência Social',
  'L:8212/1991': 'a lei de custeio (contribuições) da Previdência Social',
  'L:8742/1993': 'a Lei Orgânica da Assistência Social (LOAS)',
  'L:11340/2006': 'a Lei Maria da Penha',
  'L:10741/2003': 'o Estatuto da Pessoa Idosa',
  'L:13146/2015': 'o Estatuto da Pessoa com Deficiência (Lei Brasileira de Inclusão)',
  'L:8112/1990': 'o Estatuto dos Servidores Públicos Federais',
  'L:14133/2021': 'a Lei de Licitações e Contratos',
  'L:8666/1993': 'a antiga Lei de Licitações (Lei 8.666)',
  'LC:101/2000': 'a Lei de Responsabilidade Fiscal (LRF)',
  'LC:123/2006': 'o Estatuto da Micro e Pequena Empresa (Simples Nacional)',
  'LC:64/1990': 'a Lei de Inelegibilidade (que inclui as regras da Ficha Limpa)',
  'LC:87/1996': 'a Lei Kandir (regras do ICMS)',
  'LC:116/2003': 'a lei do ISS (imposto municipal sobre serviços)',
  'LC:214/2025': 'a lei que regulamenta a Reforma Tributária (IBS, CBS e Imposto Seletivo)',
  'LC:75/1993': 'a Lei Orgânica do Ministério Público da União',
  'LC:80/1994': 'a Lei Orgânica da Defensoria Pública',
  'LC:35/1979': 'a Lei Orgânica da Magistratura (Loman)',
  'L:9504/1997': 'a Lei das Eleições',
  'L:4737/1965': 'o Código Eleitoral',
  'L:9096/1995': 'a Lei dos Partidos Políticos',
  'L:12965/2014': 'o Marco Civil da Internet',
  'L:13709/2018': 'a Lei Geral de Proteção de Dados (LGPD)',
  'L:11343/2006': 'a Lei de Drogas',
  'L:10826/2003': 'o Estatuto do Desarmamento',
  'L:7210/1984': 'a Lei de Execução Penal',
  'L:8072/1990': 'a Lei dos Crimes Hediondos',
  'L:9605/1998': 'a Lei de Crimes Ambientais',
  'L:12651/2012': 'o Código Florestal',
  'L:6938/1981': 'a Política Nacional do Meio Ambiente',
  'L:9433/1997': 'a Política Nacional de Recursos Hídricos (lei das águas)',
  'L:12305/2010': 'a Política Nacional de Resíduos Sólidos (lei do lixo)',
  'L:11445/2007': 'a lei das diretrizes nacionais de saneamento básico',
  'L:14026/2020': 'o Novo Marco do Saneamento',
  'L:5172/1966': 'o Código Tributário Nacional',
  'L:9250/1995': 'a lei do Imposto de Renda das pessoas físicas',
  'L:7713/1988': 'a lei do Imposto de Renda das pessoas físicas (Lei 7.713)',
  'L:12587/2012': 'a Política Nacional de Mobilidade Urbana',
  'L:10257/2001': 'o Estatuto da Cidade',
  'L:12608/2012': 'a Política Nacional de Proteção e Defesa Civil',
  'L:11107/2005': 'a Lei dos Consórcios Públicos',
  'L:13303/2016': 'a Lei das Estatais',
  'L:9279/1996': 'a Lei de Propriedade Industrial (marcas e patentes)',
  'L:9610/1998': 'a Lei de Direitos Autorais',
  'L:12288/2010': 'o Estatuto da Igualdade Racial',
  'L:12852/2013': 'o Estatuto da Juventude',
  'L:13445/2017': 'a Lei de Migração',
  'L:9099/1995': 'a Lei dos Juizados Especiais',
  'L:8429/1992': 'a Lei de Improbidade Administrativa',
  'L:12846/2013': 'a Lei Anticorrupção',
  'L:12527/2011': 'a Lei de Acesso à Informação (LAI)',
  'L:14597/2023': 'a Lei Geral do Esporte',
  'L:9615/1998': 'a Lei Pelé (esporte)',
  'L:6015/1973': 'a Lei de Registros Públicos (cartórios)',
  'L:6404/1976': 'a Lei das Sociedades Anônimas',
  'L:11101/2005': 'a Lei de Falências e Recuperação Judicial',
  'L:4320/1964': 'a lei geral de orçamento público (Lei 4.320)',
  'L:13257/2016': 'o Marco Legal da Primeira Infância',
  'L:10098/2000': 'a Lei de Acessibilidade',
  'L:14300/2022': 'o Marco Legal da Geração Distribuída (energia gerada pelo próprio consumidor, como a solar)',
  'L:9472/1997': 'a Lei Geral de Telecomunicações',
  'L:8987/1995': 'a Lei de Concessões de serviços públicos',
  'L:13460/2017': 'o Código de Defesa do Usuário de Serviços Públicos',
  'L:9656/1998': 'a Lei dos Planos de Saúde',
  'L:14620/2023': 'a lei do programa Minha Casa, Minha Vida',
  'L:14601/2023': 'a lei do Bolsa Família',
  'L:8137/1990': 'a lei dos crimes contra a ordem tributária e econômica',
  'L:9613/1998': 'a Lei de Lavagem de Dinheiro',
  'L:12850/2013': 'a Lei das Organizações Criminosas',
  'L:13869/2019': 'a Lei de Abuso de Autoridade',
  'L:7716/1989': 'a lei que define os crimes de racismo',
  'L:11788/2008': 'a Lei do Estágio',
  'L:5764/1971': 'a Lei das Cooperativas',
  'L:8629/1993': 'a lei da reforma agrária',
  'L:4504/1964': 'o Estatuto da Terra',
  'L:11326/2006': 'a Lei da Agricultura Familiar',
  'L:14785/2023': 'a lei dos agrotóxicos (Lei 14.785)',
  'L:9985/2000': 'a lei do Sistema Nacional de Unidades de Conservação (parques e reservas)',
  'L:6001/1973': 'o Estatuto do Índio',
  'L:7565/1986': 'o Código Brasileiro de Aeronáutica',
  'L:13675/2018': 'a lei do Sistema Único de Segurança Pública (SUSP)',
  'L:13022/2014': 'o Estatuto Geral das Guardas Municipais',
  'L:6880/1980': 'o Estatuto dos Militares',
  'L:12711/2012': 'a Lei de Cotas nas universidades e institutos federais',
  'L:11096/2005': 'a lei do ProUni',
  'L:10260/2001': 'a lei do Fies',
  'L:14113/2020': 'a lei do Fundeb',
  'L:13005/2014': 'o Plano Nacional de Educação (PNE) de 2014',
  'L:11947/2009': 'a lei da alimentação escolar',
  'L:8313/1991': 'a Lei Rouanet (incentivo à cultura)',
  'L:14790/2023': 'a lei das apostas de quota fixa ("bets")',
  'L:13431/2017': 'a lei da escuta protegida de crianças e adolescentes vítimas ou testemunhas de violência',
  'L:8906/1994': 'o Estatuto da Advocacia (OAB)',
  'L:9307/1996': 'a Lei de Arbitragem',
  'L:8245/1991': 'a Lei do Inquilinato (aluguel)',
  'L:10048/2000': 'a lei do atendimento prioritário',
  'L:9478/1997': 'a Lei do Petróleo',
  'L:13140/2015': 'a Lei de Mediação',
  'L:13467/2017': 'a Reforma Trabalhista de 2017',
  'L:6385/1976': 'a lei do mercado de capitais (CVM)',
  'L:4595/1964': 'a lei do Sistema Financeiro Nacional',
  'L:12764/2012': 'a Política Nacional dos Direitos da Pessoa com Transtorno do Espectro Autista (Lei Berenice Piana)',
  'L:10216/2001': 'a Lei da Reforma Psiquiátrica (saúde mental)',
  'L:11105/2005': 'a Lei de Biossegurança',
  'L:9434/1997': 'a Lei de Transplantes',
  'L:10671/2003': 'o Estatuto do Torcedor',
  'L:7347/1985': 'a Lei da Ação Civil Pública',
  'L:10520/2002': 'a lei do pregão (compras públicas)',
};

const num = (s) => String(s).replace(/\./g, '');
// Encontra referências a leis na ementa: devolve [{key, nome, raw}]
export function leisCitadas(ementa) {
  const e = String(ementa || '');
  const out = [];
  const re = /(Decreto-Lei|Lei Complementar|Lei)\s+n[ºo°.]*\s*([\d.]+)\s*,?\s*de\s+(\d{1,2}º?\s+de\s+\w+\s+de\s+(\d{4})|\d{4})/gi;
  let m;
  while ((m = re.exec(e))) {
    const tipo = /decreto/i.test(m[1]) ? 'DL' : /complementar/i.test(m[1]) ? 'LC' : 'L';
    const ano = m[4] || m[3];
    const key = `${tipo}:${num(m[2])}/${ano}`;
    out.push({ key, nome: LEIS[key] || null, raw: m[0], numero: m[2], ano, tipo });
  }
  // "Lei nº 9.394/1996" (forma curta)
  for (const s of e.matchAll(/(Decreto-Lei|Lei Complementar|Lei)\s+n[ºo°.]*\s*([\d.]+)\/(\d{4})/gi)) {
    const tipo = /decreto/i.test(s[1]) ? 'DL' : /complementar/i.test(s[1]) ? 'LC' : 'L';
    const key = `${tipo}:${num(s[2])}/${s[3]}`;
    if (!out.some((x) => x.key === key)) out.push({ key, nome: LEIS[key] || null, raw: s[0], numero: s[2], ano: s[3], tipo });
  }
  // Leis citadas pelo nome popular
  if (/consolidacao das leis do trabalho|\bclt\b/.test(norm(e)) && !out.some((x) => x.key === 'DL:5452/1943')) out.push({ key: 'DL:5452/1943', nome: LEIS['DL:5452/1943'], raw: 'CLT' });
  return out;
}

const nomeLei = (x) => x.nome || `${x.tipo === 'LC' ? 'a Lei Complementar' : x.tipo === 'DL' ? 'o Decreto-Lei' : 'a Lei'} nº ${x.numero}/${x.ano}`;
const lista = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`);

// Verbos técnicos -> palavras do dia a dia (troca só a palavra, sem mudar o sentido)
const VERBOS = [
  [/^dispor sobre\b/i, 'tratar de'], [/^dispõe sobre\b/i, 'Trata de'],
  [/^instituir\b/i, 'criar'], [/^institui\b/i, 'Cria'],
  [/^estabelecer\b/i, 'definir'], [/^estabelece\b/i, 'Define'],
  [/^vedar\b/i, 'proibir'], [/^veda\b/i, 'Proíbe'],
  [/^tipificar\b/i, 'tornar crime'], [/^tipifica\b/i, 'Torna crime'],
  [/^majorar\b/i, 'aumentar'], [/^majora\b/i, 'Aumenta'],
  [/^acrescentar\b/i, 'incluir'], [/^acrescenta\b/i, 'Inclui'],
  [/^revogar\b/i, 'acabar com'], [/^revoga\b/i, 'Revoga (anula)'],
  [/^denomina\b/i, 'Dá o nome de'], [/^denominar\b/i, 'dar o nome de'],
  [/^inscreve\b/i, 'Inclui'], [/^confere\b/i, 'Dá'], [/^conferir\b/i, 'dar'],
  [/^autoriza\b/i, 'Autoriza'], [/^altera\b/i, 'Muda'], [/^alterar\b/i, 'mudar'],
  [/^aprova\b/i, 'Aprova'], [/^susta\b/i, 'Suspende (susta)'], [/^sustar\b/i, 'suspender'],
  [/^regulamenta\b/i, 'Define as regras de'], [/^regulamentar\b/i, 'definir as regras de'],
  [/^disciplinar\b/i, 'definir regras para'], [/^disciplina\b/i, 'Define regras para'],
  [/^assegurar\b/i, 'garantir'], [/^assegura\b/i, 'Garante'],
  [/^prever\b/i, 'prever'], [/^ampliar\b/i, 'ampliar'], [/^obrigar\b/i, 'obrigar'],
];
const contrai = (s) => s.replace(/^(tratar|Trata|dar o nome|Dá o nome|acabar com|definir as regras|Define as regras) de (o|a|os|as)\b/, (m, v, x) => `${v} d${x}`);
const simplVerbo = (s) => { for (const [re, t] of VERBOS) if (re.test(s)) return contrai(s.replace(re, t)); return s; };
const limpa = (s) => String(s || '').replace(/\s+/g, ' ').replace(/\s*,?\s*e dá outras providências\.?/i, '').replace(/[.;\s]+$/, '').trim();
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Gera {ps} automático a partir da ementa. Nunca inventa: só reorganiza o texto oficial.
export function simplificar(ementa, sigla) {
  const e = limpa(ementa);
  if (!e) return null;
  const tp = String(sigla || '').split(/[\s/]/)[0].toUpperCase();
  const leis = leisCitadas(e);
  const constituicao = /constitui[cç][aã]o federal|art\.?\s*\d+.*constitui|da constitui[cç][aã]o/i.test(e) || tp === 'PEC';
  // "Altera a Lei X ..., para <objetivo>"
  const mAlt = e.match(/^(altera|acrescenta|modifica|revoga|inclui)\b([\s\S]*?)(?:,\s*|\s+)(para|a fim de|com o objetivo de|com a finalidade de)\s+([\s\S]+)$/i);
  let ps;
  if (mAlt && (leis.length || constituicao)) {
    const alvo = leis.length ? lista(leis.slice(0, 3).map(nomeLei)) + (leis.length > 3 ? ` e mais ${leis.length - 3} lei(s)` : '') : 'a Constituição';
    ps = `Muda ${alvo} para ${simplVerbo(limpa(mAlt[4]))}.`;
  } else if (/^altera\b/i.test(e) && (leis.length || constituicao)) {
    const alvo = leis.length ? lista(leis.slice(0, 3).map(nomeLei)) : 'a Constituição';
    const resto = e.replace(/^altera\b[\s\S]*?(?:,\s*que\s+[^,]+,)?/i, '').trim();
    ps = `Muda ${alvo}.${resto && !/^\d|^de\s/.test(resto) && resto.length > 20 ? '' : ''}`;
  } else {
    ps = `${cap(simplVerbo(e))}.`;
  }
  ps = ps.replace(/\s+,/g, ',').replace(/\.\./g, '.');
  return { ps, leis: leis.filter((x) => x.nome).map((x) => x.nome) };
}

// Temas oficiais (Câmara /temas e Senado "classificações") -> etiquetas curtas
const TEMAS = [
  ['Saúde', /saude|sanitar|medicament|doenca|hospital/],
  ['Educação', /educa|ensino|escola|universid/],
  ['Segurança', /seguranca publica|defesa e seguranca|forcas armadas|policia|defesa nacional/],
  ['Justiça e leis penais', /direito penal|processual penal|crime|sistema prisional/],
  ['Direito e Justiça', /direito civil|processual civil|direito e justica|juridico|poder judiciario|organizacao judiciaria|direito constitucional/],
  ['Impostos e orçamento', /financas publicas|orcamento|tribut|imposto|fiscal|desoneracao/],
  ['Economia', /economia|financeiro|credito|bancar|moeda|desenvolvimento economico|mercado/],
  ['Indústria e comércio', /industria|comercio e servicos|comercio|empresa/],
  ['Trabalho', /trabalho|emprego|trabalhist/],
  ['Previdência e assistência', /previdencia|assistencia social|seguridade/],
  ['Direitos humanos', /direitos humanos|minorias|mulher|crianca|adolescente|idoso|pessoa com deficiencia|igualdade|familia/],
  ['Consumidor', /consumidor/],
  ['Meio ambiente', /meio ambiente|ambiental|sustentav|clima|florest|recursos hidricos e/],
  ['Agro', /agricultura|pecuaria|pesca|agrar|rural|fundiar/],
  ['Energia e mineração', /energia|minera|minerais|petroleo|combustive/],
  ['Transporte', /transporte|viacao|transito|mobilidade|rodovi|aviacao|portos/],
  ['Cidades', /cidades|urban|habitacao|saneamento|moradia/],
  ['Tecnologia e comunicação', /ciencia|tecnologia|inovacao|comunicac|internet|telecom|informatica/],
  ['Cultura e esporte', /cultura|arte|religi|esporte|lazer|turismo/],
  ['Política e eleições', /politica, partidos|eleic|eleitoral|partido|processo legislativo|atuacao parlamentar|^politica/],
  ['Administração pública', /administracao publica|servidor|transparencia|governanca|licitac|organizacao do estado/],
  ['Relações exteriores', /relacoes internacionais|comercio exterior|relacoes exteriores|tratado/],
  ['Homenagens e datas', /homenage|datas comemorativas|honorifico|denominacao/],
];
export const TEMA_TAGS = TEMAS.map(([t]) => t);
export function temaTags(oficiais) {
  const out = [];
  for (const o of oficiais || []) {
    const n = norm(o);
    for (const [t, re] of TEMAS) if (re.test(n)) { if (!out.includes(t)) out.push(t); break; }
  }
  return out.slice(0, 3);
}
