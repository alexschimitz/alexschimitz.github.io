# Dados do mapa (`/politica/mapa/`)

Arquivos JSON compactos usados pela página [/politica/mapa/](https://alexschimitz.github.io/politica/mapa/).
Tudo vem de fontes oficiais abertas. Nada é inventado: quando uma fonte não tem um dado, o arquivo não
tem o campo (ou tem `0` = "consultado, sem entrega") e a página mostra "sem dados".

Gerado pelos scripts em `scripts/politica/mapa/` e atualizado pelo workflow
`.github/workflows/politica-mapa.yml` (diário; só faz commit quando algum dado muda).
Primeira coleta: **08/10/2026**.

## Identificadores

| Coisa | Identificador | Exemplo |
|---|---|---|
| Estado | sigla (`uf`) e código IBGE de 2 dígitos | `RS`, `43` |
| Cidade | código IBGE de 7 dígitos | `4314902` (Porto Alegre) |
| Pessoa (político) | `slug(nome completo no TSE)` + `-` + `uf` minúscula | `eduardo-figueiredo-cavalheiro-leite-rs` |
| Candidatura | `SQ_CANDIDATO` do TSE (texto) | `250001615967` |

O id de pessoa **não usa CPF nem título de eleitor** (o TSE publica esses campos, mas eles não são copiados
para cá; também não são copiados e-mail, data de nascimento ou outros dados pessoais). Dois homônimos
completos no mesmo estado ficariam com o mesmo id — é raro, mas possível. A página de políticos pode usar
`/politica/politicos/?id=<id>`; o mapa só cria esse link quando `../paginas.json` tem `"politicos": true`.

## Arquivos

| Caminho | Conteúdo |
|---|---|
| `municipios.json` | 27 UFs (`ufs`) e 5.571 municípios (`municipios`: `[ibge, nome, uf, pop_2025, capital(0/1), pop_censo_2022]`). |
| `geo/br.json` | Contorno dos estados já projetado em SVG (`viewBox`, `ufs.{UF}.d` = path, `.c` = centro). |
| `geo/{UF}.json` | Contorno das cidades do estado (`m.{ibge}.d`, `.c`). Carregado só quando o estado é aberto. |
| `fin/uf/{UF}.json` | Contas do governo estadual por ano (SICONFI/DCA, 2013+): `anos.{ano}` = indicadores ou `0`. |
| `fin/m/{UF}/{ibge}.json` | Contas da prefeitura: `hist.{ano}` (FINBRA 1989–2012) e `anos.{ano}` (SICONFI 2013+). |
| `idx/{ano}.json` | Uma linha por cidade com contas no ano: `colunas` = despesa, receita, pessoal, investimentos, saude, educacao, seguranca, populacao, transf_uniao, tributos_proprios. Usado por mapa colorido, ranking e comparação. |
| `uf/{UF}.json` | `governo_estadual.anos` (cópia de `fin/uf`) e `municipios_agregado.{ano}` (somas e medianas das prefeituras do estado; `n` = quantas tinham contas). |
| `brasil.json` | IPCA (`ipca.fator.{ano}` multiplica valores para reais do ano-base; só de 1995 em diante), agregados nacionais, cobertura por ano. |
| `pop/{UF}.json` | População anual por cidade (`m.{ibge}` = lista de `ano0` a `ano1`). |
| `fed/{UF}.json` | Benefícios federais pagos direto aos moradores, por cidade e mês: `m.{ibge}.rf.{ano}` (Bolsa Família até 10/2021, Auxílio Brasil 11/2021–02/2023, Novo Bolsa Família desde 03/2023) e `m.{ibge}.bpc.{ano}` (BPC), cada um com `v` = 12 valores pagos (R$) e `q` = 12 quantidades de beneficiados; `null` = mês ainda não copiado, `0` = sem pagamento. `c` marca a última reconferência de um mês recente. |
| `pol/uf/{UF}.json` | Governadores eleitos (`governadores`), `segundo_turno` pendente de 2026, `prefeitos_atuais` (resumo por cidade). |
| `pol/m/{UF}/{ibge}.json` | Prefeitos eleitos com vice (`prefeitos`), vereadores eleitos por eleição (`camara`), eleições sem eleito registrado. |
| `pol/pessoas/{UF}.json` | Para cada id de pessoa, todas as candidaturas eleitas a governador/vice/prefeito/vice: `[ano, cargo, local, partido, sq, tipo]`. |

### Indicadores de contas (`fin/**`)

Valores em moeda da época (R$; antes de 1994 veja abaixo). Despesas são **empenhadas**.

| Chave | Significado | Origem SICONFI (DCA) |
|---|---|---|
| `r` | Receita total (bruta − deduções; correntes + capital) | Anexo I-C |
| `trib` | Impostos, taxas e contribuições de melhoria próprios | I-C 1.1 |
| `tu` / `te` | Transferências da União / do estado | I-C 1.7.1 e 1.7.2 (2018+); 1.7.2.1 e 1.7.2.2 (2013–2017) |
| `oc` | Operações de crédito (empréstimos recebidos) | I-C 2.1 |
| `d` | Despesa total exceto intraorçamentária | I-E |
| `dpg` | Despesa paga | I-E |
| `f.{NN}` | Despesa por função (Portaria 42/1999: 10 saúde, 12 educação, 06 segurança, 28 encargos…) | I-E |
| `pe`, `ju`, `inv`, `am`, `dc`, `dk` | Pessoal, juros, investimentos, amortização da dívida, despesas correntes, de capital | I-D |
| `div` | Saldo de empréstimos e financiamentos (curto + longo prazo) | I-AB |
| `cx` | Caixa e equivalentes | I-AB |
| `pop` | População informada na declaração | — |
| `fa.{grupo}` | (FINBRA até 2001) funções da classificação antiga | — |

FINBRA 1989–1993: moeda da época — 1989 em NCz$, 1990–1992 em Cr$ mil, 1993 em CR$ mil. A página não corrige esses
anos pela inflação (a correção anual com hiperinflação não é confiável); a correção IPCA vale de 1995 em diante.

## Fontes (consultadas em 08/10/2026)

| Dado | Fonte | Período disponível |
|---|---|---|
| Contornos | IBGE, API de malhas v3 — https://servicodados.ibge.gov.br/api/docs/malhas?versao=3 | malha atual |
| Municípios | IBGE, API de localidades — https://servicodados.ibge.gov.br/api/v1/localidades/municipios | atual (5.571) |
| População | IBGE/SIDRA 4709 (Censo 2022), 6579 (estimativas), 202 (censos 2000/2010), 793 (contagem 2007) — https://sidra.ibge.gov.br | 2000–2025 (anos sem número oficial interpolados) |
| Eleitos | TSE, dados abertos de candidatos — https://dadosabertos.tse.jus.br/dataset/?q=candidatos (`consulta_cand_<ano>.zip`) e correspondência TSE×IBGE (`municipio_tse_ibge.zip`) | governadores 1994–2026; prefeitos e vereadores 1996–2024 (inclui suplementares) |
| Contas municipais antigas | Tesouro Nacional, FINBRA — https://www.tesourotransparente.gov.br/publicacoes/finbra-dados-contabeis-dos-municipios-1989-a-2012 | 1989–2012 |
| Contas 2013+ | Tesouro Nacional, SICONFI, API DCA — https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca (docs: https://apidatalake.tesouro.gov.br/docs/siconfi/) | 2013 até o último exercício entregue |
| Inflação | Banco Central, SGS 433 (IPCA) — https://www3.bcb.gov.br/sgspub/ | 1995+ usado |
| Bolsa Família e BPC por município | Portal da Transparência (CGU), API de dados (`*-por-municipio`) — https://api.portaldatransparencia.gov.br/swagger-ui/index.html (chave de API usada só no script/Actions, nunca no navegador) | 2004 até o último mês publicado; copiado aos poucos, do mais recente para trás |
| Governador em exercício (2026) | `politica/data/ufs.json` (levantamento do G1, set/2026) | retrato atual |

## Limites conhecidos

- **1988**: não há base aberta padronizada de contas municipais ou estaduais para 1988; a série municipal começa em 1989 (FINBRA) e a estadual em 2013 (SICONFI).
- FINBRA 1989–1996 traz as cidades por nome; a ligação ao código IBGE cobre ~4.200–4.700 cidades por ano (algumas capitais faltam em 1989–1992 no próprio arquivo ou não foram reconhecidas). 1994–1996 trazem só parte das funções.
- TSE: só eleitos (titulares e vices). Quem assumiu por morte, renúncia, cassação ou licença do titular não aparece como titular. Dados de candidatos começam em 1994 (estados) e 1996 (municípios).
- SICONFI aceita ~1 consulta por segundo. A cópia das contas 2013+ de todas as prefeituras é feita aos poucos (estados e capitais primeiro, depois as maiores cidades). Enquanto não termina, a página busca os anos que faltam direto na API do Tesouro no navegador (CORS liberado para `alexschimitz.github.io`).
- Valores são os declarados pelos próprios governos e podem ter erros de preenchimento; percentuais de saúde/educação aqui **não** são os mínimos constitucionais (que usam outra base de cálculo).
- Portal da Transparência: ~60 consultas/min de dia e 300/min de madrugada; uma consulta por cidade, mês e programa. Os 12 meses mais recentes de todas as cidades ficam prontos primeiro; o histórico desde 2004 vai sendo completado a cada execução do workflow. A soma por estado só aparece para meses em que todas as cidades do estado já foram copiadas.

## Indicadores extras (`ind/` e `el/`, a partir de 08/10/2026)

Gerados por `scripts/politica/mapa/indicadores_build.py` no mesmo workflow do mapa.

| Caminho | Conteúdo |
|---|---|
| `ind/{UF}.json` | `m.{ibge}` = PIB em mil R$ correntes, um número por ano de `ind/_meta.json` → `pib.anos` (IBGE/SIDRA 5938, 2002–2023). `pib_uf` = o mesmo para o estado. `idhm.{ibge}.{ano}` = `[IDHM, educação, longevidade, renda]` nos Censos 1991, 2000 e 2010 (Atlas Brasil / PNUD, IPEA, FJP). `em.{ibge}.{ano}` = `[empenhado, pago]` em emendas com aquela cidade (Portal da Transparência, 2014–). |
| `ind/_uf.json` | Os mesmos números somados por estado, para pintar o mapa do Brasil sem baixar 27 arquivos. |
| `ind/_idhm_uf.json` | IDHM dos estados e do Brasil. |
| `el/{UF}.json` | Votos para presidente por cidade: `2022` (2º turno) e `2026` (1º turno) = `[votos do 1º da lista nacional, votos do 2º, votos válidos]`. Os nomes estão em `el/_meta.json`. |

Fotos de deputados e senadores: `politica/data/politicos/fotos/idx.json` (ver `_meta.json`).
