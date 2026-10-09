/* Linguagem simples: glossário, categorias de gasto, situação de proposições e sentido dos votos.
   Regras determinísticas (sem opinião) aplicadas a qualquer item novo da atualização diária. */
(() => {
  'use strict';
  const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

  // ---------- Glossário ----------
  const GLOSSARIO = [
    ['pl', 'PL', 'Projeto de Lei', 'Proposta para criar, mudar ou acabar com uma lei comum. Precisa ser aprovada pela Câmara e pelo Senado e depois sancionada (aprovada) pelo presidente da República.'],
    ['plp', 'PLP', 'Projeto de Lei Complementar', 'Lei que detalha assuntos que a Constituição manda regulamentar de forma especial. Precisa de mais votos que um PL comum: a maioria de todos os membros (257 deputados e 41 senadores).'],
    ['pec', 'PEC', 'Proposta de Emenda à Constituição', 'Proposta para mudar a Constituição. É a mais difícil de aprovar: precisa de 3/5 dos votos, em dois turnos, em cada Casa (308 deputados e 49 senadores). Não passa pela sanção do presidente da República.'],
    ['mpv', 'MPV (MP)', 'Medida Provisória', 'Regra criada pelo presidente da República que já vale assim que é publicada, por até 60 dias (prorrogáveis por mais 60). Para continuar valendo de vez, o Congresso precisa aprová-la; se não, perde a validade.'],
    ['pdl', 'PDL', 'Projeto de Decreto Legislativo', 'Trata de assuntos que só o Congresso decide, sem sanção do presidente da República: por exemplo, aprovar tratados internacionais, suspender atos do governo ou aprovar escolhas como a de ministros do TCU.'],
    ['prs', 'PRS', 'Projeto de Resolução do Senado', 'Trata de regras internas do Senado ou de assuntos que só o Senado decide.'],
    ['requerimento', 'Requerimento', '', 'Pedido formal feito por um parlamentar ou partido: por exemplo, adiar uma votação, retirar um tema da pauta, pedir informações a um ministério ou acelerar um projeto (urgência).'],
    ['urgencia', 'Urgência', 'Regime de urgência', 'Acelera o caminho de um projeto: ele pode ir direto para votação no plenário, sem esperar a análise completa das comissões. Aprovar a urgência NÃO aprova o projeto; só muda a velocidade.'],
    ['substitutivo', 'Substitutivo', '', 'Uma nova versão completa do texto, normalmente escrita pelo relator, que substitui o texto original do projeto.'],
    ['destaque', 'Destaque', '', 'Pedido para votar em separado um trecho do texto ou uma emenda, depois da votação principal. Serve para tentar retirar ou incluir uma parte específica.'],
    ['emenda', 'Emenda', '', 'Proposta de mudança em um trecho de um projeto (acrescentar, tirar ou trocar palavras ou artigos).'],
    ['obstrucao', 'Obstrução', '', 'Tentativa de atrasar ou impedir uma votação: o parlamentar marca “obstrução” e não conta para o número mínimo de presentes.'],
    ['abstencao', 'Abstenção', '', 'O parlamentar participa da votação, mas não vota nem a favor (Sim) nem contra (Não).'],
    ['nominal', 'Votação nominal', '', 'Votação em que o voto de cada parlamentar fica registrado com o nome dele, no painel eletrônico. É a que permite saber como cada um votou.'],
    ['simbolica', 'Votação simbólica', '', 'Votação rápida sem registro individual: o presidente da sessão pede que quem concorda permaneça como está e anuncia o resultado. Não dá para saber como cada um votou.'],
    ['secreta', 'Votação secreta', '', 'O voto de cada parlamentar não é divulgado, só o total. É usada em casos previstos nas regras, como a escolha de algumas autoridades.'],
    ['ceap', 'CEAP', 'Cota do mandato (Câmara)', 'Dinheiro público que cada deputado pode usar nos gastos do mandato — passagens, escritório no estado, divulgação, combustível. O limite mensal muda conforme o estado. Não inclui salário nem assessores do gabinete.'],
    ['ceaps', 'CEAPS', 'Cota do mandato (Senado)', 'O mesmo tipo de cota no Senado: o senador gasta e pede reembolso. Também não inclui salário nem assessores.'],
    ['comissao', 'Comissão', '', 'Grupo menor de parlamentares que analisa projetos de um tema (saúde, educação, finanças…). Muitos projetos passam por comissões antes do plenário; alguns são decididos só nelas.'],
    ['plenario', 'Plenário', '', 'A reunião com todos os deputados (ou todos os senadores). É onde acontecem as votações principais.'],
    ['tramitacao', 'Tramitação', '', 'O caminho que um projeto percorre: apresentação, análise nas comissões, votação no plenário, envio à outra Casa e sanção ou veto.'],
    ['arquivada', 'Arquivada', '', 'O projeto parou de andar e foi guardado: por exemplo, porque foi rejeitado, retirado pelo autor ou porque a legislatura acabou. Em alguns casos pode ser desarquivado.'],
    ['relator', 'Relator(a)', '', 'Parlamentar escolhido para estudar um projeto e dar um parecer recomendando aprovar, mudar ou rejeitar.'],
    ['parecer', 'Parecer', '', 'A opinião formal do relator ou de uma comissão sobre um projeto.'],
    ['turno', 'Turno', '', 'Uma rodada de votação. PECs precisam ser aprovadas em dois turnos em cada Casa.'],
    ['quorum', 'Quórum', '', 'Quantidade mínima de parlamentares presentes (ou votando) para a votação valer.'],
    ['redacaofinal', 'Redação final', '', 'A versão final do texto aprovado, com ajustes de escrita, votada no fim do processo.'],
    ['sancao', 'Sanção e veto', '', 'Depois que o Congresso aprova um projeto, o presidente pode sancionar (aceitar — e vira lei) ou vetar (recusar tudo ou parte). O Congresso pode derrubar o veto.'],
    ['preferencia', 'Preferência', '', 'Pedido para que um texto ou emenda seja votado antes de outro.'],
    ['msf', 'MSF', 'Mensagem (Senado)', 'Documento enviado pelo presidente da República ao Senado — por exemplo, para indicar embaixadores ou ministros de tribunais, que precisam ser aprovados pelos senadores.'],
    ['ofs', 'OFS', 'Ofício (Senado)', 'Comunicação oficial ao Senado. Nas votações, costuma tratar de indicações para conselhos como o CNJ e o CNMP, que dependem de aprovação dos senadores.'],
    ['legislatura', 'Legislatura', '', 'Período de 4 anos de trabalho do Congresso. A atual (57ª) vai de 2023 a 2027.'],
    ['art17', 'Art. 17', 'Artigo 17 do Regimento da Câmara', 'Indica que o deputado estava presidindo a sessão. Pelas regras, quem preside normalmente não vota.'],
  ];
  const GLOSS = Object.fromEntries(GLOSSARIO.map(([k, s, n, d]) => [k, { k, s, n, d }]));

  // ---------- Tipos de proposição ----------
  const TIPOS = {
    PL: ['pl', 'um projeto de lei: proposta para criar ou mudar uma lei'],
    PLP: ['plp', 'um projeto de lei complementar: lei especial que detalha regras da Constituição e precisa de mais votos'],
    PEC: ['pec', 'uma proposta para mudar a Constituição'],
    MPV: ['mpv', 'uma medida provisória: regra do presidente da República que já está valendo e precisa do aval do Congresso'],
    PDL: ['pdl', 'um projeto de decreto legislativo: decisão que cabe só ao Congresso, sem sanção presidencial'],
    PRS: ['prs', 'um projeto de resolução do Senado: assunto interno ou exclusivo do Senado'],
    MSF: ['msf', 'uma mensagem do presidente da República ao Senado, em geral indicando uma autoridade'],
    OFS: ['ofs', 'um ofício enviado ao Senado, em geral com uma indicação para conselho ou cargo'],
    PLV: ['mpv', 'um projeto de lei de conversão: o texto de uma medida provisória depois de modificado pelo Congresso'],
  };
  const sigla = (s) => String(s || '').trim().split(/[\s/]/)[0].toUpperCase();
  const tipoInfo = (s) => TIPOS[sigla(s)] || null;

  // ---------- Situação (status) ----------
  const STATUS = [
    [/transformad[ao] em norma juridica com veto parcial/, 'Virou lei, com partes vetadas pelo presidente da República.'],
    [/transformad[ao] (em )?(norma juridica|lei)|norma juridica gerada/, 'Virou lei.'],
    [/aguardando promulgacao/, 'Aprovada; esperando ser publicada oficialmente.'],
    [/^promulgad|norma promulgada/, 'Aprovada e publicada oficialmente.'],
    [/vetad[oa] total/, 'Vetada por inteiro pelo presidente da República.'],
    [/^vetad[oa]$/, 'Vetada pelo presidente da República.'],
    [/aguardando sancao|remetid[oa] a sancao|enviad[oa] a sancao/, 'Aprovada pelo Congresso; esperando o presidente da República sancionar (aprovar) ou vetar.'],
    [/arquivad[oa] ao final da legislatura/, 'Arquivada porque a legislatura acabou sem que fosse votada.'],
    [/aguardando remessa ao arquivo/, 'Prestes a ser arquivada (parar de andar).'],
    [/arquivad/, 'Arquivada: parou de andar.'],
    [/retirad[oa] pel[oa]/, 'Retirada pelo próprio autor.'],
    [/devolvid[oa]/, 'Devolvida ao autor, sem seguir adiante.'],
    [/perdeu a eficacia|eficacia encerrada|prazo de vigencia encerrado/, 'Perdeu a validade porque o prazo acabou.'],
    [/prejudicad/, 'Ficou sem efeito — por exemplo, porque o assunto já não faz sentido ou outra proposta igual já foi decidida.'],
    [/rejeitad/, 'Rejeitada.'],
    [/devolucao de relator/, 'Esperando a escolha de um novo relator (o anterior deixou a comissão).'],
    [/aguardando designacao d[eo] relator|aguardando designacao de relatoria/, 'Esperando alguém ser escolhido para analisar (relator).'],
    [/aguardando parecer|com a relatoria|materia com a relatoria|em analise pelo relator/, 'Com o relator, que ainda vai dar sua opinião formal (parecer).'],
    [/aguardando despacho|autorizacao do despacho/, 'Esperando o presidente da Casa decidir o caminho do projeto (por quais comissões vai passar).'],
    [/aguardando distribuicao|aguardando encaminhamento a comiss/, 'Esperando ser enviada às comissões.'],
    [/materia despachada/, 'Já foi encaminhada às comissões que vão analisá-la.'],
    [/analise de (in)?constitucionalidade/, 'Em análise para ver se respeita a Constituição.'],
    [/aguardando apensacao/, 'Esperando ser juntada a outra proposta parecida, para as duas andarem juntas.'],
    [/aguardando redacao final/, 'Aprovada; esperando a versão final do texto (redação final).'],
    [/aguardando envio ao senado/, 'Aprovada na Câmara; esperando ser enviada ao Senado.'],
    [/audiencia publica realizada/, 'Já teve uma audiência pública (debate aberto com convidados).'],
    [/aguardando audiencia publica/, 'Esperando a realização de uma audiência pública (debate aberto com convidados).'],
    [/aguardando inclusao (em |na )?ordem do dia de requerimento/, 'Um pedido (requerimento) sobre ela está esperando entrar na agenda de votação.'],
    [/incluid[oa] na pauta da reuniao/, 'Está na pauta (agenda) de uma reunião para ser analisada.'],
    [/aguardando constituicao de comissao temporaria|aguardando criacao de comissao|aguardando instalacao/, 'Esperando a criação de uma comissão especial para analisá-la.'],
    [/tramitando em conjunto|apensad|tramita em conjunto/, 'Está sendo analisada junto com outra proposta parecida.'],
    [/pront[oa] para (a )?pauta (no|na) plen|pront[oa] para (a )?deliberacao do plenario|aguardando inclusao (em |na )?ordem do dia/, 'Pronta para ser votada no plenário; esperando entrar na agenda (pauta).'],
    [/pront[oa] para (a )?pauta na comiss|pront[oa] para deliberacao na comiss/, 'Pronta para ser votada na comissão; esperando entrar na agenda (pauta).'],
    [/pront[oa] para (a )?pauta|pront[oa] para (a )?deliberacao/, 'Pronta para ser votada; esperando entrar na agenda (pauta).'],
    [/incluid[oa] em ordem do dia|em pauta/, 'Está na agenda de votação.'],
    [/aguardando deliberacao|aguardando votacao/, 'Esperando ser votada.'],
    [/aguardando apreciacao pelo senado|remetid[oa] ao senado|enviad[oa] ao senado/, 'Aprovada na Câmara; agora está no Senado.'],
    [/remetid[oa] a camara|enviad[oa] a camara|aguardando apreciacao pela camara/, 'Aprovada no Senado; agora está na Câmara.'],
    [/aguardando (recebimento de )?emendas|prazo para (apresentacao de )?emendas|abertura de prazo/, 'Com prazo aberto para sugestões de mudança (emendas).'],
    [/aguardando leitura/, 'Esperando ser lida oficialmente (etapa formal).'],
    [/aguardando vista|vista concedida|pedido de vista/, 'Um parlamentar pediu mais tempo para analisá-la (vista).'],
    [/aguardando recebimento|aguardando encaminhamento|aguardando providencias|aguardando retorno|aguardando autuacao/, 'Em etapa administrativa interna (encaminhamento entre setores).'],
    [/aprovad/, 'Aprovada.'],
    [/em tramitacao|tramitando/, 'Em andamento.'],
  ];
  function statusSimples(st) {
    const n = norm(st); if (!n) return '';
    for (const [re, txt] of STATUS) if (re.test(n)) return txt;
    return '';
  }

  // ---------- Categorias de gasto ----------
  const CATS = [
    [/^manutencao de escritorio/, 'Escritório no estado (aluguel, contas, material)'],
    [/^aluguel de imoveis para escritorio/, 'Escritório no estado (aluguel e contas)'],
    [/^combustiveis/, 'Combustível'],
    [/^divulgacao da atividade parlamentar/, 'Propaganda do mandato (anúncios, posts, panfletos)'],
    [/fretamento de aeronaves/, 'Aluguel de aviões e helicópteros'],
    [/fretamento de veiculos/, 'Aluguel de carros'],
    [/fretamento de embarcacoes/, 'Aluguel de barcos'],
    [/^passagem aerea - sigepa/, 'Passagens de avião (emitidas pelo sistema da Câmara)'],
    [/^passagem aerea - reembolso/, 'Passagens de avião (reembolso)'],
    [/^passagem aerea - rpa/, 'Passagens de avião (modalidade RPA)'],
    [/^passagem aerea/, 'Passagens de avião'],
    [/^passagens terrestres/, 'Passagens de ônibus, barco ou balsa'],
    [/^passagens aereas, aquaticas e terrestres/, 'Passagens (avião, barco, ônibus)'],
    [/^telefonia/, 'Telefone e internet'],
    [/^servicos postais/, 'Correios'],
    [/^fornecimento de alimentacao/, 'Refeições do parlamentar'],
    [/^hospedagem/, 'Hotel (fora de Brasília)'],
    [/^locomocao, hospedagem, alimentacao/, 'Transporte, hotel, refeições e combustível'],
    [/^servico de taxi/, 'Táxi, pedágio e estacionamento'],
    [/^assinatura de publicacoes/, 'Assinaturas de jornais e revistas'],
    [/seguranca/, 'Segurança particular'],
    [/tokens e certificados/, 'Certificado digital (assinatura eletrônica)'],
    [/^consultorias|^contratacao de consultorias/, 'Consultorias, assessorias e pesquisas'],
    [/^participacao em curso/, 'Cursos, palestras e eventos'],
    [/^aquisicao de material de consumo/, 'Material de escritório, programas e correios'],
    [/^nao informado/, 'Categoria não informada'],
  ];
  function categoria(t) {
    const n = norm(t);
    for (const [re, txt] of CATS) if (re.test(n)) return txt;
    const s = String(t || '').trim().toLowerCase().replace(/\.$/, '');
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Categoria não informada';
  }

  // ---------- Votos ----------
  // Retorna { tema, sim, nao, termos[] } com o que estava em jogo, a partir da descrição oficial.
  function sentidoVotoCamara(v) {
    const d = norm(v.d); const ctx = norm(v.ctx);
    const termos = [];
    let tema = 'o item em votação'; let sim = ''; let nao = '';
    if (/^mantid[oa] o texto|^suprimid|destaque para votacao em separado/.test(d) || /destaque para votacao em separado/.test(ctx)) {
      tema = 'um trecho do texto que um partido pediu para votar em separado (destaque)';
      sim = 'manter o trecho no texto'; nao = 'retirar o trecho'; termos.push('destaque');
    } else if (/requerimento de urgencia/.test(d)) {
      tema = 'um pedido de urgência para o projeto'; sim = 'acelerar a análise do projeto (não é a aprovação do projeto em si)'; nao = 'manter o ritmo normal'; termos.push('urgencia', 'requerimento');
    } else if (/requerimento/.test(d)) {
      tema = 'um pedido feito em plenário (requerimento), como adiar ou retirar o tema da pauta — os dados não detalham qual'; sim = 'aprovar o pedido'; nao = 'rejeitar o pedido'; termos.push('requerimento');
    } else if (/preferencia/.test(d)) {
      tema = 'qual texto seria votado primeiro (preferência)'; sim = 'dar prioridade ao texto indicado'; nao = 'não dar essa prioridade'; termos.push('preferencia');
    } else if (/redacao final/.test(d)) {
      tema = 'a versão final do texto (redação final)'; sim = 'aprovar a versão final'; nao = 'rejeitá-la'; termos.push('redacaofinal');
    } else if (/proposta de emenda a constituicao/.test(d)) {
      const t = /segundo turno/.test(d) ? ' em segundo turno' : /primeiro turno/.test(d) ? ' em primeiro turno' : '';
      tema = `a mudança na Constituição (PEC)${t}`; sim = 'aprovar a mudança'; nao = 'rejeitá-la'; termos.push('pec', 'turno');
    } else if (/substitutiv/.test(d)) {
      tema = 'a nova versão do texto preparada pelo relator (substitutivo)'; sim = 'aprovar essa versão'; nao = 'rejeitá-la'; termos.push('substitutivo');
    } else if (/emenda/.test(d)) {
      tema = /emendas/.test(d) ? 'sugestões de mudança no texto (emendas)' : 'uma sugestão de mudança no texto (emenda)';
      sim = 'incluir a mudança'; nao = 'deixar o texto sem essa mudança'; termos.push('emenda');
      if (/destaque/.test(ctx)) termos.push('destaque');
    } else if (/medida provisoria/.test(d)) {
      tema = 'a medida provisória'; sim = 'aprovar a medida'; nao = 'rejeitá-la'; termos.push('mpv');
    } else if (/projeto|parecer/.test(d)) {
      tema = 'o projeto'; sim = 'aprovar o projeto'; nao = 'rejeitá-lo';
    } else {
      sim = 'aprovar o item'; nao = 'rejeitá-lo';
    }
    const tp = v.pr ? tipoInfo(v.pr.s) : null; if (tp) termos.push(tp[0]);
    let res = '';
    if (/^mantid[oa] o texto/.test(d)) res = 'O trecho foi mantido.';
    else if (/^suprimid/.test(d)) res = 'O trecho foi retirado.';
    else if (v.ap === 1) res = 'Resultado: aprovado.'; else if (v.ap === 0) res = 'Resultado: rejeitado.';
    return { tema, sim, nao, res, termos: [...new Set(termos)] };
  }
  function sentidoVotoSenado(v) {
    const d = norm(v.d); const termos = []; let tema = 'o item em votação'; let sim = 'aprovar'; let nao = 'rejeitar';
    const s = sigla(v.s);
    if (/emenda n/.test(d) && /destacad/.test(d)) { tema = 'uma sugestão de mudança no texto (emenda), votada em separado'; sim = 'incluir a mudança'; nao = 'deixar o texto sem ela'; termos.push('emenda', 'destaque'); }
    else if (/destacad/.test(d) && /art\./.test(d)) { tema = 'um trecho do projeto votado em separado (destaque)'; sim = 'manter o trecho'; nao = 'retirá-lo'; termos.push('destaque'); }
    else if (/requerimento/.test(d)) { tema = 'um pedido (requerimento)'; sim = 'aprovar o pedido'; nao = 'rejeitá-lo'; termos.push('requerimento'); }
    else if (s === 'MSF' || s === 'OFS') {
      const nome = String(v.d || '').split(/\s[-–]\s/).slice(1).join(' - ').trim();
      tema = `a indicação de uma autoridade${nome ? ` (${nome})` : ''}`; sim = 'aprovar a indicação'; nao = 'rejeitá-la'; termos.push(s.toLowerCase());
    } else if (s === 'PEC') {
      const t = /2º turno|segundo turno/.test(String(v.d)) ? ' em segundo turno' : /1º turno|primeiro turno/.test(String(v.d)) ? ' em primeiro turno' : '';
      tema = `a mudança na Constituição (PEC)${t}`; sim = 'aprovar a mudança'; nao = 'rejeitá-la'; termos.push('pec', 'turno');
    } else if (/substitutivo/.test(d)) { tema = 'uma versão completa alternativa do texto (substitutivo)'; sim = 'aprovar essa versão'; nao = 'rejeitá-la'; termos.push('substitutivo'); }
    else if (tipoInfo(s)) { tema = 'o projeto'; sim = 'aprovar o projeto'; nao = 'rejeitá-lo'; }
    const tp = tipoInfo(s); if (tp && !termos.includes(tp[0])) termos.push(tp[0]);
    const res = v.r === 'A' ? 'Resultado: aprovado.' : v.r === 'R' ? 'Resultado: rejeitado.' : '';
    return { tema, sim, nao, res, termos };
  }

  // Votos individuais do Senado (siglas oficiais) -> grupo para resumo de participação
  const VOTO_SENADO = {
    Sim: ['v', 'Sim'], 'Não': ['v', 'Não'], 'Abstenção': ['v', 'Abstenção'], Votou: ['v', 'Votou (voto secreto)'], Obstrução: ['v', 'Obstrução'],
    'P-NRV': ['p', 'Presente, mas não registrou voto'], 'Presidente (art. 51 RISF)': ['p', 'Presidindo a sessão (não vota)'], PRES: ['p', 'Presidindo a sessão'],
    NCom: ['a', 'Não compareceu'], AP: ['l', 'Em atividade parlamentar fora da sessão'], MIS: ['l', 'Em missão oficial'], LS: ['l', 'Licença de saúde'],
    LP: ['l', 'Licença particular'], LAP: ['l', 'Licença paternidade ou adoção'], LG: ['l', 'Licença gestante'], NA: ['x', 'Dispositivo não citado'],
  };

  // ---------- Dinheiro em linguagem simples ----------
  const brl2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dec1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
  const int0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  function moneySimple(v) {
    const n = Number(v) || 0; const a = Math.abs(n); const sg = n < 0 ? '−' : '';
    if (a < 1000) return `${sg}R$ ${int0.format(a)}`;
    if (a < 1e6) return `${sg}R$ ${(a < 1e4 ? dec1 : int0).format(a / 1e3)} mil`;
    if (a < 1e9) { const x = a / 1e6; return `${sg}R$ ${dec1.format(x)} ${x < 2 ? 'milhão' : 'milhões'}`; }
    const x = a / 1e9; return `${sg}R$ ${dec1.format(x)} ${x < 2 ? 'bilhão' : 'bilhões'}`;
  }
  const moneyExact = (v) => brl2.format(Number(v) || 0);

  window.PolSimples = { GLOSSARIO, GLOSS, tipoInfo, sigla, statusSimples, categoria, sentidoVotoCamara, sentidoVotoSenado, VOTO_SENADO, moneySimple, moneyExact, norm };
})();
