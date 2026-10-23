# Fonte editável do glossário. Gera politica/data/glossario.json
import json, sys
P="https://www.planalto.gov.br/ccivil_03/"
CF=("Constituição Federal de 1988", P+"constituicao/constituicao.htm")
L=lambda nome,path:(nome,P+path)
LRF=L("Lei de Responsabilidade Fiscal (LC 101/2000)","leis/lcp/lcp101.htm")
L4320=L("Lei 4.320/1964 (normas de orçamento)","leis/l4320.htm")
L14133=L("Lei de Licitações (Lei 14.133/2021)","_ato2019-2022/2021/lei/l14133.htm")
LAI=L("Lei de Acesso à Informação (Lei 12.527/2011)","_ato2011-2014/2011/lei/l12527.htm")
L9096=L("Lei dos Partidos Políticos (Lei 9.096/1995)","leis/l9096.htm")
L9504=L("Lei das Eleições (Lei 9.504/1997)","leis/l9504.htm")
CE=L("Código Eleitoral (Lei 4.737/1965)","leis/l4737compilado.htm")
LC64=L("Lei das Inelegibilidades (LC 64/1990)","leis/lcp/lcp64.htm")
LC135=L("Lei da Ficha Limpa (LC 135/2010)","leis/lcp/lcp135.htm")
L8429=L("Lei de Improbidade Administrativa (Lei 8.429/1992)","leis/l8429.htm")
CPP=L("Código de Processo Penal","decreto-lei/del3689.htm")
CP=L("Código Penal","decreto-lei/del2848compilado.htm")
L1079=L("Lei 1.079/1950 (crimes de responsabilidade)","leis/l1079.htm")
L12850=L("Lei 12.850/2013 (organizações criminosas)","_ato2011-2014/2013/lei/l12850.htm")
L12846=L("Lei Anticorrupção (Lei 12.846/2013)","_ato2011-2014/2013/lei/l12846.htm")
L8112=L("Regime dos servidores federais (Lei 8.112/1990)","leis/l8112cons.htm")
L8443=L("Lei Orgânica do TCU (Lei 8.443/1992)","leis/l8443.htm")
L9709=L("Lei 9.709/1998 (plebiscito e referendo)","leis/l9709.htm")
LC200=L("Regime fiscal sustentável (LC 200/2023)","leis/lcp/lcp200.htm")
EC132=L("Emenda Constitucional 132/2023 (reforma tributária)","constituicao/emendas/emc/emc132.htm")
LC214=L("Lei Complementar 214/2025 (IBS, CBS e Imposto Seletivo)","leis/lcp/lcp214.htm")
L4717=L("Lei da Ação Popular (Lei 4.717/1965)","leis/l4717.htm")
L7347=L("Lei da Ação Civil Pública (Lei 7.347/1985)","leis/l7347orig.htm")
L13303=L("Lei das Estatais (Lei 13.303/2016)","_ato2015-2018/2016/lei/l13303.htm")
L12813=L("Lei de Conflito de Interesses (Lei 12.813/2013)","_ato2011-2014/2013/lei/l12813.htm")
L9868=L("Lei 9.868/1999 (ADI e ADC)","leis/l9868.htm")
L13460=L("Lei 13.460/2017 (direitos do usuário de serviço público)","_ato2015-2018/2017/lei/l13460.htm")
RICD=("Regimento Interno da Câmara dos Deputados","https://www2.camara.leg.br/atividade-legislativa/legislacao/regimento-interno-da-camara-dos-deputados")
CEAP=("Câmara dos Deputados — Cota parlamentar","https://www.camara.leg.br/cota-parlamentar/")
CAMDA=("Dados Abertos da Câmara dos Deputados","https://dadosabertos.camara.leg.br/")
SENDA=("Dados Abertos do Senado Federal","https://www12.senado.leg.br/dados-abertos")
TSE=("Tribunal Superior Eleitoral","https://www.tse.jus.br/")
STF=("Supremo Tribunal Federal","https://portal.stf.jus.br/")
TCU=("Tribunal de Contas da União","https://portal.tcu.gov.br/")
CGU=("Controladoria-Geral da União","https://www.gov.br/cgu/pt-br")
PT=("Portal da Transparência (CGU)","https://portaldatransparencia.gov.br/")
TT=("Tesouro Transparente","https://www.tesourotransparente.gov.br/")
SICONFI=("Siconfi — Tesouro Nacional","https://siconfi.tesouro.gov.br/")
IBGE_IPCA=("IBGE Explica — Inflação","https://www.ibge.gov.br/explica/inflacao.php")
IBGE_PIB=("IBGE Explica — PIB","https://www.ibge.gov.br/explica/pib.php")
IBGE_DES=("IBGE Explica — Desemprego","https://www.ibge.gov.br/explica/desemprego.php")
BCB_SELIC=("Banco Central — Taxa Selic","https://www.bcb.gov.br/controleinflacao/taxaselic")
CNJ=("Conselho Nacional de Justiça","https://www.cnj.jus.br/")
MPF=("Ministério Público Federal","https://www.mpf.mp.br/")
PF=("Polícia Federal","https://www.gov.br/pf/pt-br")

INST,ORC,SAL,ELE,LEG,JUS,ECO,ADM,LIC,TRA="Instituições","Orçamento e finanças públicas","Salários e benefícios","Eleições e partidos","Processo legislativo","Justiça e investigações","Economia e tributação","Administração pública","Licitações e contratos","Transparência e controle"

T=[]
def t(id,nome,cat,exp,fonte,ex="",dif="",res="",sin=()):
    T.append(dict(id=id,nome=nome,categoria=cat,explicacao=exp,exemplo=ex,diferencas=dif,ressalvas=res,fonte={"nome":fonte[0],"url":fonte[1]},sinonimos=list(sin)))

# ---- Instituições
t("congresso-nacional","Congresso Nacional",INST,"Órgão que faz as leis federais e fiscaliza o governo. É formado por duas Casas: a Câmara dos Deputados e o Senado Federal.",CF,dif="Congresso é o conjunto das duas Casas; Câmara e Senado são cada uma das Casas.",sin=["Poder Legislativo federal"])
t("camara-dos-deputados","Câmara dos Deputados",INST,"Casa do Congresso formada por 513 deputados federais, eleitos para representar a população de cada estado e do Distrito Federal. O número de deputados de cada estado depende da população, com mínimo de 8 e máximo de 70.",CF,dif="Deputados representam o povo; senadores representam os estados.",sin=["Câmara"])
t("senado-federal","Senado Federal",INST,"Casa do Congresso formada por 81 senadores: três por estado e três pelo Distrito Federal, com mandato de oito anos.",CF,ex="O Senado aprova ou rejeita indicações do presidente para ministro do STF.",sin=["Senado"])
t("poder-executivo","Poder Executivo",INST,"Poder que administra o país, os estados e os municípios e executa as leis. É chefiado pelo presidente (no país), pelos governadores (estados) e pelos prefeitos (municípios).",CF,sin=["Executivo"])
t("poder-judiciario","Poder Judiciário",INST,"Poder formado pelos juízes e tribunais, que julgam conflitos e aplicam as leis em casos concretos.",CF,sin=["Judiciário"])
t("stf","Supremo Tribunal Federal (STF)",INST,"Tribunal mais alto do país, com 11 ministros. Sua função principal é guardar a Constituição: decide se leis e atos estão de acordo com ela e julga algumas autoridades, como o presidente e os parlamentares federais em crimes comuns.",STF,dif="O STJ uniformiza a interpretação das leis federais; o STF cuida da Constituição.",sin=["STF","Supremo"])
t("stj","Superior Tribunal de Justiça (STJ)",INST,"Tribunal que dá a palavra final sobre a interpretação das leis federais (fora as questões constitucionais). Também julga governadores em crimes comuns.",CF,sin=["STJ"])
t("tse","Tribunal Superior Eleitoral (TSE)",INST,"Órgão máximo da Justiça Eleitoral. Organiza as eleições nacionais, registra partidos, julga recursos sobre eleições e divulga resultados e dados de candidatos.",TSE,dif="Os Tribunais Regionais Eleitorais (TREs) cuidam das eleições em cada estado.",sin=["TSE","Justiça Eleitoral"])
t("tcu","Tribunal de Contas da União (TCU)",INST,"Órgão que ajuda o Congresso a fiscalizar como o dinheiro federal é usado. Analisa contas, faz auditorias e pode aplicar multas. Apesar do nome, não faz parte do Poder Judiciário.",L8443,dif="Tribunais de contas dos estados e municípios fiscalizam o dinheiro estadual e municipal.",sin=["TCU"])
t("cgu","Controladoria-Geral da União (CGU)",INST,"Órgão do governo federal que faz auditoria interna, combate a corrupção, recebe denúncias e mantém o Portal da Transparência.",CGU,dif="A CGU faz controle interno (dentro do Executivo); o TCU faz controle externo (ligado ao Congresso).",sin=["CGU"])
t("ministerio-publico","Ministério Público",INST,"Instituição independente que defende a lei e os interesses da sociedade. Pode investigar, propor ações na Justiça e acusar pessoas em processos criminais.",CF,dif="O Ministério Público acusa; quem julga é o juiz.",sin=["MP","MPF","Ministério Público Federal"])
t("pgr","Procurador-Geral da República (PGR)",INST,"Chefe do Ministério Público da União. É quem pode acusar no STF autoridades com foro nesse tribunal, como deputados federais e senadores. É indicado pelo presidente e aprovado pelo Senado.",CF,sin=["PGR","Procuradoria-Geral da República"])
t("policia-federal","Polícia Federal",INST,"Polícia ligada ao governo federal que investiga crimes contra a União, como desvio de dinheiro federal, além de outras atribuições previstas na Constituição.",PF,dif="A polícia investiga; o Ministério Público decide se acusa; o juiz decide se condena.",sin=["PF"])
t("ministerio","Ministério",INST,"Órgão do governo federal que cuida de uma área, como saúde ou educação. É chefiado por um ministro escolhido pelo presidente.",CF,dif="Ministro de um ministério (Executivo) é diferente de ministro do STF ou do TCU.")
t("mesa-diretora","Mesa Diretora",INST,"Grupo de parlamentares que dirige os trabalhos da Câmara ou do Senado: presidente, vice-presidentes e secretários. Decide, entre outras coisas, a administração da Casa.",RICD,sin=["Mesa"])
t("lideranca","Líder partidário",INST,"Parlamentar escolhido pela bancada de um partido ou bloco para falar em nome dela e orientar como votar.",RICD,sin=["líder","liderança"])
t("bancada","Bancada",INST,"Grupo de parlamentares de um mesmo partido, estado ou que defendem um mesmo tema.",RICD,ex="Bancada do PT; bancada de São Paulo; bancada ruralista.")
t("legislatura","Legislatura",INST,"Período de quatro anos de trabalho do Congresso. A 57ª legislatura vai de 2023 a 2027.",CF)
t("pacto-federativo","Federação (pacto federativo)",INST,"Forma de organização do Brasil, em que União, estados, Distrito Federal e municípios têm autonomia e competências próprias definidas pela Constituição.",CF,sin=["pacto federativo","federação"])

# ---- Processo legislativo
for x in [
("projeto-de-lei","Projeto de Lei (PL)","Proposta para criar, mudar ou revogar uma lei comum (ordinária). Para virar lei precisa ser aprovada pela Câmara e pelo Senado e sancionada pelo presidente.","","Uma lei ordinária é aprovada pela maioria dos presentes, desde que esteja presente a maioria dos membros.","",["PL","projeto de lei"]),
("plp","Projeto de Lei Complementar (PLP)","Proposta de lei sobre assuntos que a Constituição manda regular por lei complementar. Precisa do voto da maioria absoluta de cada Casa (257 deputados e 41 senadores).","","Lei complementar exige maioria absoluta; lei ordinária, maioria simples.","",["PLP","lei complementar"]),
("pec","Proposta de Emenda à Constituição (PEC)","Proposta para mudar a Constituição. Precisa de 3/5 dos votos (308 deputados e 49 senadores), em dois turnos de votação em cada Casa. Não passa por sanção do presidente.","","","Algumas regras não podem ser abolidas nem por emenda, as chamadas cláusulas pétreas (art. 60, §4º).",["PEC","emenda constitucional"]),
("medida-provisoria","Medida Provisória (MP)","Norma com força de lei editada pelo presidente em casos de relevância e urgência. Vale desde a publicação por 60 dias, prorrogáveis por mais 60. Se o Congresso não aprovar nesse prazo, perde a validade.","","A MP já vale antes de ser votada; um projeto de lei só vale depois de aprovado e sancionado.","",["MP","MPV"]),
("pdl","Projeto de Decreto Legislativo (PDL)","Proposta sobre assuntos de competência exclusiva do Congresso, que não passam por sanção do presidente, como aprovar tratados internacionais ou sustar atos do Executivo que passem dos limites legais.","","","",["PDL","decreto legislativo"]),
("emenda","Emenda (a um projeto)","Proposta de mudança em um trecho de um projeto em discussão: acrescentar, retirar ou alterar partes do texto.","","Emenda a um projeto é diferente de emenda constitucional e de emenda parlamentar ao orçamento.","",[]),
("substitutivo","Substitutivo","Nova versão completa do texto de um projeto, normalmente apresentada pelo relator, que substitui o texto original.","","","",[]),
("relator","Relator","Parlamentar escolhido para estudar um projeto e apresentar um parecer recomendando aprovar, alterar ou rejeitar.","","","",["relatoria","relatora"]),
("parecer","Parecer","Documento com a análise e a recomendação do relator ou da comissão sobre um projeto.","","","",[]),
("comissao","Comissão","Grupo menor de parlamentares que analisa projetos de um tema específico (por exemplo, saúde ou finanças) antes do plenário. Algumas comissões podem aprovar projetos sem passar pelo plenário.","","Comissões permanentes existem sempre; comissões temporárias são criadas para um assunto.","",["comissões"]),
("cpi","Comissão Parlamentar de Inquérito (CPI)","Comissão temporária criada para investigar um fato determinado, por prazo certo. Tem poderes de investigação próprios das autoridades judiciais, como convocar testemunhas e pedir quebra de sigilo, mas não condena ninguém: envia as conclusões ao Ministério Público.",
 "","CPI investiga; não julga nem aplica pena.","Precisa da assinatura de pelo menos 1/3 dos membros da Casa.",["CPI","CPMI"]),
("plenario","Plenário","Reunião de todos os deputados ou de todos os senadores, onde ocorrem as principais votações.","","","",[]),
("tramitacao","Tramitação","Caminho que uma proposta percorre desde a apresentação: comissões, plenário, envio à outra Casa e sanção ou veto.","","","",[]),
("quorum","Quórum","Número mínimo de parlamentares presentes ou de votos exigido para abrir uma sessão ou aprovar uma proposta.","Para aprovar uma PEC na Câmara são necessários 308 votos favoráveis.","Maioria simples: mais da metade dos presentes. Maioria absoluta: mais da metade de todos os membros.","",["quorum"]),
("maioria-absoluta","Maioria absoluta","Mais da metade de todos os membros de uma Casa, estejam presentes ou não: 257 deputados ou 41 senadores.","","Maioria simples considera apenas os presentes na votação.","",[]),
("urgencia","Regime de urgência","Procedimento que acelera um projeto, dispensando prazos e etapas, para que seja votado mais rápido no plenário.","","Aprovar a urgência não é aprovar o projeto.","",["urgência"]),
("votacao-nominal","Votação nominal","Votação em que o voto de cada parlamentar fica registrado com seu nome. É o tipo que permite saber como cada um votou.","","Na votação simbólica não há registro individual.","",[]),
("votacao-simbolica","Votação simbólica","Votação sem registro individual: quem preside pede que os favoráveis permaneçam como estão e proclama o resultado.","","","Como não há registro, não é possível dizer como cada parlamentar votou.",[]),
("obstrucao","Obstrução","Estratégia para atrasar ou impedir uma votação, por exemplo, deixando de registrar presença para dificultar o quórum.","","","Na Câmara, o registro “obstrução” é uma opção do painel e não conta como presença para quórum.",[]),
("abstencao","Abstenção","Quando o parlamentar participa da votação mas não vota nem a favor nem contra.","","","",[]),
("destaque","Destaque","Pedido para votar separadamente um trecho do texto ou uma emenda, depois da votação principal.","","","",[]),
("sancao","Sanção","Ato em que o presidente da República (ou governador ou prefeito) concorda com um projeto aprovado, que então vira lei.","","","Se o presidente não se manifestar em 15 dias úteis, ocorre sanção tácita.",[]),
("veto","Veto","Recusa do presidente a um projeto aprovado, no todo ou em parte. O Congresso pode derrubar o veto pela maioria absoluta de deputados e senadores, em sessão conjunta.","","Veto parcial atinge só alguns trechos.","",["vetar","vetado"]),
("promulgacao","Promulgação","Ato que declara que uma lei ou emenda existe e deve ser cumprida; em seguida vem a publicação no Diário Oficial.","","","",[]),
("arquivamento","Arquivamento","Quando uma proposta para de tramitar e é guardada, por exemplo por rejeição, retirada pelo autor ou fim da legislatura.","","","Em alguns casos a proposta pode ser desarquivada.",["arquivada","arquivado"]),
("turno","Turno de votação","Cada rodada de votação de uma proposta. PECs exigem dois turnos em cada Casa.","","","",["turnos"]),
("requerimento","Requerimento","Pedido formal de um parlamentar ou partido, por exemplo para adiar uma votação ou pedir informações a um ministro.","","","",[]),
("sessao-conjunta","Sessão conjunta","Reunião de deputados e senadores juntos, usada para casos como analisar vetos e votar o orçamento.","","","",[]),
]:
    t(x[0],x[1],LEG,x[2],CF if x[0] in("pec","medida-provisoria","veto","sancao","plp","cpi","maioria-absoluta","sessao-conjunta","promulgacao") else RICD,ex=x[3],dif=x[4],res=x[5],sin=x[6])

# ---- Orçamento
t("orcamento-publico","Orçamento público",ORC,"Plano que prevê quanto o governo espera arrecadar e autoriza quanto pode gastar em cada área durante o ano. É aprovado por lei.",L4320,ex="A LOA de cada ano define quanto vai para saúde, educação, previdência etc.")
t("ppa","Plano Plurianual (PPA)",ORC,"Lei que define objetivos e metas do governo para quatro anos.",CF,dif="PPA: 4 anos; LDO: regras para o próximo orçamento; LOA: orçamento do ano.",sin=["PPA"])
t("ldo","Lei de Diretrizes Orçamentárias (LDO)",ORC,"Lei anual que define metas e prioridades e dá as regras para elaborar o orçamento do ano seguinte.",CF,sin=["LDO"])
t("loa","Lei Orçamentária Anual (LOA)",ORC,"Lei que estima as receitas e fixa as despesas do governo para um ano.",CF,sin=["LOA"])
t("emenda-parlamentar","Emenda parlamentar (ao orçamento)",ORC,"Parte do orçamento cujo destino é indicado por deputados e senadores, por exemplo para obras ou serviços em municípios.",CF,ex="Um deputado indica recursos para equipar um hospital da sua cidade.",dif="Emendas individuais são de cada parlamentar; de bancada, dos parlamentares de um estado; de comissão, de uma comissão.",res="Parte das emendas tem execução obrigatória pela Constituição. As regras mudaram várias vezes nos últimos anos.",sin=["emendas parlamentares","emenda individual","emenda de bancada"])
t("emenda-pix","Transferência especial (“emenda Pix”)",ORC,"Tipo de emenda individual em que o dinheiro é repassado diretamente ao estado ou município, sem convênio nem finalidade definida previamente. O apelido “emenda Pix” não é um nome oficial.",CF,res="As regras de transparência dessas transferências foram objeto de decisões recentes do STF.",sin=["emenda pix","transferência especial"])
t("empenho","Empenho",ORC,"Primeira etapa da despesa pública: o governo reserva o dinheiro para um gasto específico.",L4320,dif="Empenhado: dinheiro reservado. Liquidado: serviço ou entrega conferidos. Pago: dinheiro efetivamente transferido.",sin=["empenhado"])
t("liquidacao","Liquidação",ORC,"Etapa em que o governo confere se o bem foi entregue ou o serviço foi prestado e reconhece que deve pagar.",L4320,sin=["liquidado"])
t("pagamento","Pagamento (despesa paga)",ORC,"Última etapa da despesa: o dinheiro sai efetivamente dos cofres públicos para o fornecedor ou beneficiário.",L4320,res="Um valor empenhado num ano pode ser pago só no ano seguinte (restos a pagar).",sin=["pago"])
t("restos-a-pagar","Restos a pagar",ORC,"Despesas empenhadas num ano que não foram pagas até 31 de dezembro e ficam para os anos seguintes.",L4320)
t("receita-publica","Receita pública",ORC,"Todo dinheiro que entra nos cofres públicos, como impostos, contribuições e transferências.",L4320,sin=["receita"])
t("despesa-obrigatoria","Despesa obrigatória",ORC,"Gasto que o governo é obrigado a fazer por lei ou pela Constituição, como aposentadorias e salários de servidores.",TT,dif="Despesa discricionária é aquela em que o governo tem escolha sobre quanto e onde gastar.",sin=["despesas obrigatórias"])
t("despesa-discricionaria","Despesa discricionária",ORC,"Gasto que o governo pode decidir fazer ou não, e em que valor, como muitos investimentos e custeio de programas.",TT,sin=["despesas discricionárias"])
t("contingenciamento","Contingenciamento",ORC,"Bloqueio temporário de despesas previstas no orçamento quando a arrecadação fica abaixo do esperado, para cumprir a meta fiscal.",LRF,dif="Corte definitivo é diferente: o contingenciamento pode ser revertido.",sin=["bloqueio de verbas"])
t("resultado-primario","Resultado primário",ORC,"Diferença entre receitas e despesas do governo sem contar os juros da dívida. Positivo é superávit; negativo, déficit.",TT,sin=["superávit primário","déficit primário"])
t("deficit","Déficit e superávit",ORC,"Déficit: o governo gastou mais do que arrecadou no período. Superávit: arrecadou mais do que gastou.",TT,sin=["déficit","superávit"])
t("divida-publica","Dívida pública",ORC,"Total que o governo deve a quem emprestou dinheiro a ele, principalmente por meio de títulos públicos.",TT,sin=["dívida"])
t("arcabouco-fiscal","Arcabouço fiscal (regime fiscal sustentável)",ORC,"Conjunto de regras criado em 2023 que limita o crescimento das despesas federais e define metas para as contas públicas. Substituiu o antigo teto de gastos.",LC200,sin=["arcabouço fiscal","novo arcabouço"])
t("teto-de-gastos","Teto de gastos",ORC,"Regra criada em 2016 (Emenda Constitucional 95) que limitava o crescimento das despesas federais à inflação. Foi substituída pelo arcabouço fiscal em 2023.",L("Emenda Constitucional 95/2016","constituicao/emendas/emc/emc95.htm"))
t("lrf","Lei de Responsabilidade Fiscal (LRF)",ORC,"Lei que define regras para a gestão das contas públicas em todo o país, como limites de gasto com pessoal e de endividamento.",LRF,sin=["LRF"])
t("transferencias-constitucionais","Transferências constitucionais",ORC,"Parte dos impostos arrecadados pela União que a Constituição manda repassar a estados e municípios, como os fundos de participação (FPE e FPM).",TT,sin=["FPM","FPE","fundo de participação"])
t("convenio","Convênio",ORC,"Acordo pelo qual um órgão repassa dinheiro a outro órgão público ou entidade para realizar um projeto de interesse comum.",PT)

# ---- Salários e benefícios
t("subsidio","Subsídio (salário de agente político)",SAL,"Nome oficial da remuneração mensal de parlamentares, ministros, presidente e outras autoridades. É pago em parcela única.",CF,dif="Subsídio é o salário. Cota parlamentar, verba de gabinete e auxílios são valores separados, com regras próprias.",res="O valor de deputados e senadores é fixado pelo próprio Congresso por decreto legislativo.",sin=["subsídio","salário do parlamentar"])
t("teto-remuneratorio","Teto do funcionalismo",SAL,"Limite máximo de remuneração no serviço público, igual ao subsídio dos ministros do STF.",CF,res="Verbas de natureza indenizatória não entram no cálculo do teto, o que permite valores totais maiores.",sin=["teto constitucional","abate-teto"])
t("ceap","Cota para o Exercício da Atividade Parlamentar (CEAP)",SAL,"Valor mensal que cada deputado federal pode usar para pagar despesas do mandato, como passagens, combustível, escritório e divulgação, mediante reembolso com nota fiscal. O limite varia por estado.",CEAP,dif="Não é salário e não paga assessores.",res="Gastos são publicados nos Dados Abertos da Câmara; a ausência de gastos em um mês não significa, por si só, recusa do benefício.",sin=["cota parlamentar","CEAP","cotão"])
t("ceaps","Cota do Senado (CEAPS)",SAL,"Equivalente da cota parlamentar no Senado: valor para despesas do mandato do senador, reembolsadas mediante comprovação.",("Senado Federal — Transparência","https://www12.senado.leg.br/transparencia"),sin=["CEAPS"])
t("verba-indenizatoria","Verba indenizatória",SAL,"Dinheiro pago para ressarcir gastos feitos por causa do trabalho, e não como salário. Exemplo: reembolso de despesas do mandato.",CF,dif="Verba indenizatória ressarce gastos; salário (subsídio) remunera o trabalho.",res="Por ser indenizatória, não entra no teto do funcionalismo nem sofre desconto de imposto de renda como salário.",sin=["verbas indenizatórias","indenização"])
t("verba-de-gabinete","Verba de gabinete",SAL,"Valor mensal que cada parlamentar tem para contratar assessores (secretários parlamentares). O dinheiro é pago diretamente aos funcionários, não ao parlamentar.",CEAP,sin=["verba de gabinete","secretário parlamentar"])
t("auxilio-moradia","Auxílio-moradia",SAL,"Valor pago a parlamentares que não ocupam imóvel funcional em Brasília, para ajudar com moradia.",CEAP,dif="Imóvel funcional é um apartamento do próprio Congresso cedido ao parlamentar; quem usa o imóvel não recebe o auxílio.",res="Parlamentares podem abrir mão do auxílio; a recusa só pode ser afirmada quando houver registro oficial.",sin=["auxílio moradia","imóvel funcional"])
t("diaria","Diária",SAL,"Valor pago a servidores e autoridades para cobrir hospedagem, alimentação e locomoção durante viagens a trabalho.",L8112,sin=["diárias"])
t("passagens","Passagens oficiais",SAL,"Bilhetes de viagem pagos com dinheiro público para deslocamentos a serviço.",PT)
t("cartao-corporativo","Cartão de pagamento do governo (“cartão corporativo”)",SAL,"Cartão usado por órgãos federais para pagar despesas de pequeno valor ou urgentes. Os gastos são publicados no Portal da Transparência, exceto os protegidos por sigilo legal.",PT,sin=["cartão corporativo","CPGF"])
t("aposentadoria-parlamentar","Aposentadoria de parlamentares",SAL,"Parlamentares podem aderir a um plano de previdência próprio do Congresso ou ao regime geral (INSS). As regras mudaram ao longo do tempo, incluindo a reforma da Previdência de 2019.",L("Emenda Constitucional 103/2019","constituicao/emendas/emc/emc103.htm"),res="Cada caso depende da data de entrada no mandato e do plano escolhido.")
t("cargo-em-comissao","Cargo em comissão",SAL,"Cargo de livre nomeação e exoneração, sem concurso, para funções de direção, chefia e assessoramento.",CF,dif="Servidor efetivo entra por concurso público.",sin=["cargo comissionado","comissionado"])

# ---- Eleições e partidos
t("partido-politico","Partido político",ELE,"Associação de pessoas com ideias e objetivos políticos comuns, registrada no TSE. No Brasil, só é possível se candidatar filiado a um partido.",L9096,sin=["partido","legenda","sigla"])
t("federacao-partidaria","Federação partidária",ELE,"União de dois ou mais partidos que atuam como se fossem um só, nas eleições e no Congresso, por pelo menos quatro anos.",L9096,dif="Coligação vale só para a eleição; federação dura no mínimo quatro anos.",sin=["federação"])
t("coligacao","Coligação",ELE,"Aliança entre partidos para disputar uma eleição. Desde 2020 só é permitida em eleições majoritárias (presidente, governador, senador e prefeito).",CF)
t("fundo-partidario","Fundo Partidário",ELE,"Dinheiro público (e algumas multas e doações) distribuído todos os anos aos partidos para manter suas atividades.",L9096,dif="Fundo Eleitoral é usado só nas campanhas, em ano de eleição.")
t("fundo-eleitoral","Fundo Eleitoral (FEFC)",ELE,"Fundo Especial de Financiamento de Campanha: dinheiro público distribuído aos partidos em anos de eleição para pagar campanhas.",L9504,sin=["FEFC","fundão"])
t("clausula-de-barreira","Cláusula de desempenho (cláusula de barreira)",ELE,"Regra que exige um mínimo de votos ou de deputados eleitos para o partido ter acesso ao Fundo Partidário e ao tempo gratuito de rádio e TV.",CF,sin=["cláusula de barreira"])
t("sistema-proporcional","Sistema proporcional",ELE,"Forma de eleger deputados e vereadores: as vagas são divididas entre partidos conforme os votos que receberam, e depois preenchidas pelos candidatos mais votados de cada partido.",CE,dif="No sistema majoritário vence quem tem mais votos.",sin=["eleição proporcional"])
t("quociente-eleitoral","Quociente eleitoral",ELE,"Número de votos válidos dividido pelo número de vagas. Serve para calcular quantas cadeiras cada partido conquista na eleição proporcional.",CE)
t("sistema-majoritario","Sistema majoritário",ELE,"Forma de eleger presidente, governadores, senadores e prefeitos: vence quem tiver mais votos. Em alguns casos exige maioria absoluta dos votos válidos, com segundo turno.",CF,sin=["eleição majoritária"])
t("segundo-turno","Segundo turno",ELE,"Nova votação entre os dois mais votados quando nenhum candidato a presidente, governador ou prefeito (em cidades com mais de 200 mil eleitores) obtém mais da metade dos votos válidos.",CF)
t("votos-validos","Votos válidos",ELE,"Votos dados a candidatos ou partidos. Votos em branco e nulos não contam como válidos.",L9504,sin=["voto válido","voto branco","voto nulo"])
t("suplente","Suplente",ELE,"Pessoa que assume a vaga quando o titular se afasta ou perde o mandato. Senadores são eleitos com dois suplentes; deputados têm como suplentes os mais votados não eleitos do partido ou federação.",CF,sin=["suplência"])
t("inelegibilidade","Inelegibilidade",ELE,"Situação em que a pessoa fica proibida de se candidatar, por um período ou de forma permanente, nos casos previstos na Constituição e em lei complementar.",LC64,dif="Inelegível não pode se candidatar; perder o mandato é outra coisa.",res="Os prazos e casos foram alterados por leis posteriores, como a Lei da Ficha Limpa. Consulte a redação vigente.",sin=["inelegível"])
t("ficha-limpa","Lei da Ficha Limpa",ELE,"Lei de 2010 que ampliou os casos de inelegibilidade, incluindo condenações por órgão colegiado (mais de um juiz) por certos crimes, mesmo antes do fim de todos os recursos.",LC135,res="Prazos e regras de contagem podem ter sido alterados posteriormente; consulte a redação vigente na LC 64/1990.")
t("filiacao","Filiação partidária",ELE,"Vínculo formal de uma pessoa com um partido. É exigida para se candidatar.",L9096)
t("fidelidade-partidaria","Fidelidade partidária",ELE,"Regra segundo a qual o eleito pelo sistema proporcional que deixa o partido sem justa causa pode perder o mandato.",L9096,res="Há exceções, como a janela partidária.",sin=["infidelidade partidária"])
t("janela-partidaria","Janela partidária",ELE,"Período de 30 dias antes do prazo de filiação para a eleição em que deputados e vereadores podem trocar de partido sem perder o mandato, no fim do mandato vigente.",L9096)
t("registro-de-candidatura","Registro de candidatura",ELE,"Pedido feito à Justiça Eleitoral para que uma pessoa possa disputar a eleição. A Justiça verifica se ela cumpre as exigências e não é inelegível.",L9504)
t("prestacao-de-contas-eleitoral","Prestação de contas de campanha",ELE,"Relatório obrigatório que partidos e candidatos entregam à Justiça Eleitoral mostrando quanto arrecadaram e gastaram na campanha. Os dados são publicados pelo TSE.",L9504)
t("plano-de-governo","Proposta de governo (plano de governo)",ELE,"Documento que candidatos a presidente, governador e prefeito devem entregar ao TSE no registro de candidatura, com as propostas que pretendem cumprir.",L9504,res="O documento não tem força legal de contrato; avaliar o cumprimento exige critérios verificáveis.",sin=["plano de governo","promessa de campanha"])
t("plebiscito-referendo","Plebiscito e referendo",ELE,"Consultas à população convocadas pelo Congresso. No plebiscito, a consulta ocorre antes da decisão; no referendo, depois, para confirmar ou rejeitar uma lei já aprovada.",L9709,ex="Em 2005 houve referendo sobre a proibição do comércio de armas.",sin=["plebiscito","referendo"])
t("impeachment","Impeachment",ELE,"Processo para afastar e retirar do cargo o presidente da República e outras autoridades por crime de responsabilidade. No caso do presidente, a Câmara autoriza (2/3 dos deputados) e o Senado julga (condenação por 2/3 dos senadores).",L1079,dif="Crime de responsabilidade é uma infração político-administrativa, diferente de crime comum.",sin=["impedimento"])
t("cassacao","Cassação de mandato",ELE,"Perda do mandato decidida pela Casa legislativa (por exemplo, por quebra de decoro) ou pela Justiça Eleitoral (por exemplo, por abuso de poder na eleição).",CF,sin=["cassação","perda de mandato","cassado"])
t("decoro-parlamentar","Decoro parlamentar",ELE,"Conjunto de regras de comportamento exigidas dos parlamentares. Quebrar o decoro pode levar à perda do mandato, decidida pela própria Casa.",CF,sin=["quebra de decoro","Conselho de Ética"])

# ---- Justiça
t("foro-privilegiado","Foro por prerrogativa de função (“foro privilegiado”)",JUS,"Regra que determina que certas autoridades sejam julgadas, em alguns casos, diretamente por tribunais superiores. Deputados federais e senadores, por exemplo, são julgados pelo STF em crimes comuns.",CF,res="O alcance do foro foi redefinido pelo STF em mais de uma ocasião; verifique o entendimento vigente para cada caso.",sin=["foro privilegiado","foro especial"])
t("inquerito","Inquérito",JUS,"Investigação feita, em regra, pela polícia para apurar se um crime ocorreu e quem pode ser o autor. Ser investigado não significa ser culpado.",CPP,dif="Inquérito é investigação; ação penal é o processo em que há acusação formal.",sin=["inquérito policial","investigado","investigação"])
t("denuncia","Denúncia",JUS,"Acusação formal feita pelo Ministério Público à Justiça contra uma pessoa por um crime. Se o juiz ou tribunal aceita a denúncia, a pessoa passa a ser ré.",CPP,dif="Na linguagem comum, “denúncia” também é qualquer relato de irregularidade; aqui é o termo jurídico.",sin=["denunciado"])
t("reu","Réu",JUS,"Pessoa que responde a um processo depois que a Justiça aceitou a acusação contra ela. Ser réu não é ser condenado.",CPP,sin=["ré","réu","tornou-se réu"])
t("acao-penal","Ação penal",JUS,"Processo criminal na Justiça, aberto quando a acusação é recebida. Termina com absolvição ou condenação.",CPP,sin=["processo criminal"])
t("presuncao-de-inocencia","Presunção de inocência",JUS,"Princípio constitucional segundo o qual ninguém é considerado culpado até o trânsito em julgado de sentença penal condenatória.",CF,sin=["presunção de inocência"])
t("transito-em-julgado","Trânsito em julgado",JUS,"Momento em que não cabe mais recurso contra uma decisão judicial e ela se torna definitiva.",CPP,sin=["transitado em julgado","condenação definitiva"])
t("condenacao","Condenação",JUS,"Decisão judicial que reconhece a culpa e aplica uma pena. Pode ainda ser contestada por recursos até o trânsito em julgado.",CPP,dif="Condenação em primeira instância ou por órgão colegiado é diferente de condenação definitiva.",sin=["condenado"])
t("absolvicao","Absolvição",JUS,"Decisão judicial que conclui que a pessoa não deve ser punida, por exemplo por falta de provas ou porque o fato não é crime.",CPP,sin=["absolvido"])
t("arquivamento-inquerito","Arquivamento de investigação",JUS,"Encerramento de uma investigação sem acusação, por exemplo por falta de provas. Em certos casos pode ser reaberta se surgirem provas novas.",CPP)
t("prescricao","Prescrição",JUS,"Perda do direito do Estado de punir por ter passado o prazo previsto em lei. A prescrição não significa que a pessoa foi declarada inocente.",CP,sin=["prescrito"])
t("colaboracao-premiada","Colaboração premiada (delação)",JUS,"Acordo em que um investigado ou acusado fornece informações e provas em troca de benefícios, como redução de pena. O que o colaborador diz, sozinho, não basta para condenar alguém.",L12850,sin=["delação premiada","delação","delator"])
t("improbidade","Improbidade administrativa",JUS,"Ato desonesto ou ilegal contra a administração pública, como enriquecimento ilícito ou dano aos cofres públicos. É punido na esfera civil (multa, ressarcimento, perda da função, suspensão de direitos políticos), não na criminal.",L8429,dif="Ação de improbidade não é processo criminal.",res="A lei foi profundamente alterada em 2021 (Lei 14.230/2021).",sin=["ato de improbidade"])
t("corrupcao","Corrupção (passiva e ativa)",JUS,"Corrupção passiva: o agente público pede ou recebe vantagem indevida por causa da função. Corrupção ativa: alguém oferece ou promete essa vantagem ao agente público.",CP,sin=["corrupção passiva","corrupção ativa","propina"])
t("lavagem-de-dinheiro","Lavagem de dinheiro",JUS,"Crime de esconder ou disfarçar a origem ilegal de dinheiro ou bens para que pareçam legítimos.",L("Lei 9.613/1998 (lavagem de dinheiro)","leis/l9613.htm"))
t("peculato","Peculato",JUS,"Crime em que o funcionário público desvia ou se apropria de dinheiro ou bem público a que tem acesso por causa do cargo.",CP)
t("busca-e-apreensao","Busca e apreensão",JUS,"Medida autorizada por juiz para entrar em um local e recolher documentos ou objetos que possam servir de prova. Não significa culpa.",CPP)
t("prisao-preventiva","Prisão preventiva",JUS,"Prisão decretada antes do julgamento, quando a lei permite, por exemplo para evitar fuga ou destruição de provas. Não é pena nem condenação.",CPP,dif="Prisão temporária tem prazo curto e serve à investigação.")
t("adi","Ação Direta de Inconstitucionalidade (ADI)",JUS,"Ação no STF para pedir que uma lei ou ato normativo seja declarado contrário à Constituição.",L9868,sin=["ADI","inconstitucional"])
t("liminar","Liminar",JUS,"Decisão judicial provisória e urgente, tomada antes da decisão final do processo. Pode ser revista depois.",STF,sin=["decisão liminar","cautelar"])
t("acao-popular","Ação popular",JUS,"Ação que qualquer cidadão pode propor na Justiça para anular atos que prejudiquem o patrimônio público, a moralidade administrativa ou o meio ambiente.",L4717)
t("acao-civil-publica","Ação civil pública",JUS,"Ação usada principalmente pelo Ministério Público para proteger interesses coletivos, como o patrimônio público e o meio ambiente.",L7347)

# ---- Economia e tributação
t("pib","PIB (Produto Interno Bruto)",ECO,"Soma de todos os bens e serviços finais produzidos no país em um período. É a principal medida do tamanho da economia.",IBGE_PIB,sin=["PIB"])
t("inflacao","Inflação",ECO,"Aumento geral dos preços ao longo do tempo, que reduz o poder de compra do dinheiro.",IBGE_IPCA)
t("ipca","IPCA",ECO,"Índice Nacional de Preços ao Consumidor Amplo, calculado pelo IBGE. É o índice oficial de inflação do Brasil.",IBGE_IPCA,sin=["IPCA"])
t("selic","Taxa Selic",ECO,"Taxa básica de juros da economia, definida pelo Comitê de Política Monetária (Copom) do Banco Central. Influencia todos os outros juros.",BCB_SELIC,sin=["Selic","Copom"])
t("desemprego","Taxa de desocupação (desemprego)",ECO,"Percentual de pessoas que procuram trabalho e não encontram, em relação à força de trabalho. Medida pelo IBGE na PNAD Contínua.",IBGE_DES,sin=["desemprego","desocupação"])
t("imposto","Imposto",ECO,"Tributo pago ao governo que não está ligado a um serviço específico; o dinheiro financia as despesas gerais do Estado.",CF,dif="Taxa está ligada a um serviço específico; contribuição tem destinação definida (como a previdência).",sin=["impostos"])
t("tributo","Tributo",ECO,"Nome geral para valores obrigatórios cobrados pelo Estado: impostos, taxas e contribuições.",L("Código Tributário Nacional","leis/l5172compilado.htm"),sin=["tributos"])
t("carga-tributaria","Carga tributária",ECO,"Total de tributos arrecadados no país em relação ao PIB.",TT)
t("reforma-tributaria","Reforma tributária do consumo",ECO,"Mudança aprovada em 2023 que substitui gradualmente PIS, Cofins, IPI, ICMS e ISS por dois tributos sobre consumo (CBS e IBS) e cria o Imposto Seletivo.",EC132,res="A transição ocorre ao longo de vários anos, conforme a Emenda 132/2023 e a Lei Complementar 214/2025.")
t("ibs-cbs","IBS e CBS",ECO,"Tributos criados pela reforma tributária. A CBS é federal e o IBS é de estados e municípios; ambos incidem sobre o consumo de bens e serviços.",LC214,sin=["IBS","CBS","IVA dual"])
t("icms","ICMS",ECO,"Imposto estadual sobre circulação de mercadorias e alguns serviços. Será substituído gradualmente pelo IBS.",CF,sin=["ICMS"])
t("isencao-fiscal","Incentivo ou benefício fiscal",ECO,"Redução ou dispensa de tributo concedida por lei a um setor, região ou grupo. Representa receita que o governo deixa de arrecadar.",LRF,sin=["isenção","renúncia fiscal","gasto tributário"])

# ---- Administração pública
t("administracao-direta","Administração direta e indireta",ADM,"Administração direta: os próprios órgãos do governo, como ministérios e secretarias. Indireta: entidades criadas pelo governo com personalidade própria, como autarquias, fundações, empresas públicas e sociedades de economia mista.",CF,sin=["administração indireta","autarquia"])
t("estatal","Empresa estatal",ADM,"Empresa controlada pelo governo. Pode ser empresa pública (capital totalmente público) ou sociedade de economia mista (com sócios privados, mas controle público).",L13303,sin=["estatais","empresa pública","sociedade de economia mista"])
t("servidor-publico","Servidor público",ADM,"Pessoa que trabalha para o poder público em cargo efetivo (concurso) ou em comissão.",L8112,dif="Agente político (como parlamentar ou ministro) exerce mandato ou cargo de governo; não é servidor de carreira.",sin=["servidores"])
t("concurso-publico","Concurso público",ADM,"Seleção por provas, ou provas e títulos, exigida para ocupar cargos e empregos públicos efetivos.",CF)
t("nepotismo","Nepotismo",ADM,"Nomeação de parentes de autoridades para cargos de confiança no serviço público. É proibida pela Súmula Vinculante 13 do STF.",("STF — Súmula Vinculante 13","https://portal.stf.jus.br/jurisprudencia/sumariosumulas.asp?base=26&sumula=1227"))
t("conflito-de-interesses","Conflito de interesses",ADM,"Situação em que um interesse particular de um agente público pode influenciar indevidamente suas decisões no cargo.",L12813)
t("decreto","Decreto",ADM,"Ato do chefe do Executivo (presidente, governador ou prefeito), normalmente para regulamentar como uma lei será aplicada.",CF,dif="Decreto não pode criar obrigações que a lei não prevê.")
t("diario-oficial","Diário Oficial",ADM,"Publicação oficial onde leis, decretos, nomeações e contratos são divulgados. Muitos atos só passam a valer após a publicação.",("Diário Oficial da União — Imprensa Nacional","https://www.in.gov.br/"),sin=["DOU","Diário Oficial da União"])
t("ouvidoria","Ouvidoria",ADM,"Canal para o cidadão enviar reclamações, denúncias, sugestões e elogios sobre serviços públicos. No governo federal, a plataforma é o Fala.BR.",L13460,sin=["Fala.BR"])

# ---- Licitações
t("licitacao","Licitação",LIC,"Procedimento obrigatório para o poder público escolher quem vai fornecer bens, prestar serviços ou fazer obras, buscando a proposta mais vantajosa com igualdade entre os concorrentes.",L14133,sin=["licitações"])
t("pregao","Pregão",LIC,"Modalidade de licitação para comprar bens e serviços comuns, em que vence o menor preço ou maior desconto, normalmente em disputa eletrônica.",L14133,sin=["pregão eletrônico"])
t("dispensa-de-licitacao","Dispensa de licitação",LIC,"Situações previstas em lei em que a licitação seria possível, mas a lei permite contratar diretamente, como compras de pequeno valor ou emergências.",L14133,dif="Na inexigibilidade, a competição é inviável (por exemplo, fornecedor exclusivo).",sin=["dispensa","contratação direta"])
t("inexigibilidade","Inexigibilidade de licitação",LIC,"Contratação direta quando a competição é inviável, como no caso de fornecedor exclusivo ou artista consagrado.",L14133)
t("contrato-administrativo","Contrato administrativo",LIC,"Acordo entre o poder público e um fornecedor, com regras especiais que dão à administração certas prerrogativas, como fiscalizar e alterar o contrato nos limites da lei.",L14133,sin=["contrato"])
t("aditivo","Termo aditivo",LIC,"Documento que altera um contrato já assinado, por exemplo para mudar prazo, quantidade ou valor, dentro dos limites da lei.",L14133,sin=["aditivo contratual"])
t("sobrepreco","Sobrepreço e superfaturamento",LIC,"Sobrepreço: preço contratado acima do valor de mercado. Superfaturamento: dano efetivo aos cofres públicos, por exemplo por pagamento acima do devido ou por serviço não entregue.",L14133,sin=["sobrepreço","superfaturamento"])
t("ata-de-registro-de-precos","Ata de registro de preços",LIC,"Documento que registra preços de fornecedores para compras futuras, sem obrigar a administração a comprar.",L14133)
t("pncp","Portal Nacional de Contratações Públicas (PNCP)",LIC,"Site oficial que reúne editais, contratos e atas de licitações de todo o país, criado pela nova Lei de Licitações.",("Portal Nacional de Contratações Públicas","https://www.gov.br/pncp/pt-br"),sin=["PNCP"])

# ---- Transparência
t("lai","Lei de Acesso à Informação (LAI)",TRA,"Lei que garante a qualquer pessoa o direito de pedir informações a órgãos públicos, sem precisar justificar. A regra é a publicidade; o sigilo é exceção.",LAI,sin=["LAI","pedido de informação"])
t("sigilo","Sigilo (informação classificada)",TRA,"Restrição de acesso a uma informação pública prevista em lei. Pela LAI, informações podem ser classificadas como reservadas (5 anos), secretas (15 anos) ou ultrassecretas (25 anos).",LAI,res="Há também sigilos previstos em outras leis, como o fiscal, o bancário e o de dados pessoais.",sin=["sigilo de 100 anos","informação sigilosa"])
t("transparencia-ativa","Transparência ativa e passiva",TRA,"Ativa: o órgão publica informações por iniciativa própria, sem precisar de pedido. Passiva: o órgão responde a pedidos feitos pelos cidadãos.",LAI,sin=["transparência passiva"])
t("dados-abertos","Dados abertos",TRA,"Dados públicos disponibilizados na internet em formato que pode ser lido por computador e reutilizado livremente.",CAMDA)
t("portal-da-transparencia","Portal da Transparência",TRA,"Site da CGU que publica gastos, transferências, servidores, viagens e cartões do governo federal.",PT)
t("siconfi","Siconfi",TRA,"Sistema do Tesouro Nacional que recebe as informações contábeis e fiscais de União, estados e municípios.",SICONFI)
t("controle-externo","Controle externo e interno",TRA,"Controle externo: fiscalização feita pelo Legislativo com ajuda dos tribunais de contas. Controle interno: fiscalização feita dentro de cada Poder, como a CGU no Executivo federal.",CF,sin=["controle interno"])
t("acordo-de-leniencia","Acordo de leniência",TRA,"Acordo entre o poder público e uma empresa que admite participação em atos ilícitos e colabora com as investigações em troca de redução de penalidades.",L12846,sin=["leniência"])

# ---- Como votou (fase 4)
t("voto-sim-nao","Voto “sim” e voto “não”",LEG,"“Sim” é voto a favor do que está sendo votado naquele momento; “não” é voto contra. Atenção: o que se vota pode ser um requerimento, uma emenda ou um destaque, e não o projeto inteiro.",RICD,dif="Votar “sim” a um requerimento de retirada de pauta, por exemplo, é ser a favor de adiar, não a favor do projeto.",sin=["voto sim","voto não"])
t("ausencia-votacao","Ausência em votação",LEG,"Quando o parlamentar não participa de uma votação nominal. No Senado, os dados indicam o motivo (licença, missão oficial, atividade parlamentar ou não comparecimento). Na Câmara, a lista de votos só traz quem votou, sem dizer o motivo de quem não aparece.",SENDA,dif="Ausência não é abstenção nem obstrução: quem se abstém ou obstrui está participando da votação.",res="Ausência numa votação não significa falta na sessão do dia: o parlamentar pode ter saído antes ou chegado depois.",sin=["ausente","não compareceu"])
t("presente-sem-voto","Presente sem voto",LEG,"Situações em que o parlamentar estava na sessão mas não votou: por exemplo, quem preside a sessão (que pela regra não vota, salvo em empate ou votação secreta) ou quem registrou presença e não votou.",RICD,dif="Diferente de ausência (não estava) e de abstenção (votou, mas sem tomar lado).",sin=["não votou","presidindo a sessão","art. 17"])
t("votacao-secreta","Votação secreta",LEG,"Votação em que se registra quem votou, mas não como votou. A Constituição prevê voto secreto em poucos casos, como na escolha de algumas autoridades pelo Senado.",CF,res="Nos dados, aparece “votou” sem indicar se foi sim ou não.",sin=["voto secreto","escrutínio secreto"])

ids=[x["id"] for x in T]; assert len(ids)==len(set(ids)), [i for i in ids if ids.count(i)>1]
out={"versao":1,"atualizadoEm":"2026-10-23","nota":"Glossário do portal de política. Fonte editável: tools-politica/glossario_src.py. Explicações em linguagem simples; a definição legal está na fonte indicada.","categorias":[INST,ORC,SAL,ELE,LEG,JUS,ECO,ADM,LIC,TRA],"termos":sorted(T,key=lambda x:x["nome"].lower())}
json.dump(out,open(sys.argv[1],"w"),ensure_ascii=False,indent=1)
print(len(T))
