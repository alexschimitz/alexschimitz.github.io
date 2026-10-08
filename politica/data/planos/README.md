# politica/data/planos — planos de governo e promessas

Usado por `/politica/planos/`. Duas partes bem separadas:

1. **Índice (automático)**: quem entregou plano de governo ao TSE, desde 2010.
2. **Promessas (curadoria manual)**: para alguns eleitos, uma lista de promessas do plano com o que aconteceu depois, sempre com o trecho, a página e uma fonte oficial.

Nenhum PDF é copiado para este repositório. O link aponta para a página oficial da candidatura no TSE (DivulgaCandContas), onde está o PDF, e o nome do arquivo dentro do pacote de dados abertos do TSE.

## 1. Índice — `scripts/politica/planos/build_index.py`

Fontes (TSE, Portal de Dados Abertos):

- candidaturas: `https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_{ano}.zip`
- planos: `https://cdn.tse.jus.br/estatistica/sead/odsele/proposta_governo/proposta_governo_{ano}_{UF}.zip`

O script lê **só o índice (diretório central) de cada ZIP** por HTTP Range: descobre quais candidaturas têm PDF e o tamanho, sem baixar os PDFs. Os nomes dos arquivos trazem o `SQ_CANDIDATO` (ex.: `2022BR280001607829.pdf`), que é cruzado com `consulta_cand`.

Filtros: eleições ordinárias (`CD_TIPO_ELEICAO = 2`), cargos 1 (presidente), 3 (governador) e 11 (prefeito). Resultado considera o último turno.

Arquivos gerados:

| arquivo | conteúdo |
|---|---|
| `gerais.json` | presidente e governador, 2010–2026. Colunas em `colunas`: ano, cargo, uf, nome_urna, nome, partido, numero, resultado, sq, arquivos, kb, id_politico. Também `divulga` (id da eleição no DivulgaCandContas) e `zip` (tamanho de cada pacote). |
| `pref/{ano}/{UF}.json` | prefeitos 2012–2024, um arquivo por ano e estado: ue_tse, ibge, municipio, nome_urna, partido, numero, resultado, sq, arquivos, kb, id_politico. |
| `pref/capitais.json` | só as capitais, todos os anos (carregado por padrão na página). |
| `meta.json` | contagens (candidaturas, com plano) por ano/cargo/UF, fontes e data. |
| `por_politico/{xx}.json` | índice por político (usado no perfil em `/politica/politicos/`); `xx` = 2 primeiros caracteres do `id_politico`. `{"d": ids de eleição do DivulgaCand, "p": {id: [[ano, cargo, ue, local, sq, tem_arquivo, resultado, chave_promessas ou ""]]}}`. |

`resultado`: `E` eleito · `S` foi ao 2º turno e perdeu · `T` vai disputar o 2º turno (pendente) · `N` não eleito · `X` candidatura sem efeito (indeferida, renúncia, cancelada) · `U` sem resultado na fonte.

`id_politico` liga ao perfil em `/politica/politicos/#p/{id}` (ids de `politica/data/politicos/`, mesmo cruzamento ano + cargo + local + nome).

Link da candidatura no TSE: `https://divulgacandcontas.tse.jus.br/divulga/#/candidato/{ano}/{divulga[ano]}/{UE}/{sq}` — UE é `BR` (presidente), a sigla do estado (governador) ou o código TSE do município (prefeito).

Atualização: `.github/workflows/politica-planos.yml`, todo dia 3 (e manual). Cache local dos índices em `$PLANOS_CACHE` (padrão `/tmp/planos-cache`). `--sem-prefeitos` gera só `gerais.json`.

Limites conhecidos:

- Antes de 2010 não existe plano no TSE: a entrega virou obrigatória com a Lei 12.034/2009.
- Alguns planos não estão no pacote do TSE (ex.: governador eleito de MT em 2022). A página diz isso e aponta para a página da candidatura.
- O pacote de 2012 do RN tem só 11 PDFs, que não batem com candidaturas a prefeito.

Cobertura das promessas (out/2026): presidentes eleitos em 2010, 2014, 2018 e 2022; governadores eleitos em 2022 em BA, CE, MG, PE, PR, RJ, RS e SP. Os demais governadores e os prefeitos ainda não foram avaliados.

## 2. Promessas — `promessas/{ano}-{UF}-{sq}.json` (curadoria manual)

Um arquivo por plano avaliado, **editado à mão**. `scripts/politica/planos/build_promessas.py` só valida e junta tudo em `promessas/index.json` (que a página carrega). Se faltar algum campo ou fonte, o script falha.

```json
{
 "ano": 2022, "cargo": "presidente", "uf": "BR", "sq": "280001607829",
 "pessoa": {"nome": "...", "nome_completo": "...", "partido": "...", "id_politico": "..."},
 "mandato": {"inicio": "2023-01-01", "fim": "2026-12-31", "situacao": "em curso|encerrado|interrompido", "nota": "..."},
 "plano": {"titulo": "...", "paginas": 21, "arquivo": "2022BR280001607829.pdf", "divulga": "https://...", "zip": "https://..."},
 "revisado": "2026-10-08",
 "resumo": [{"t": "frase curta", "p": 4}],
 "promessas": [{
   "id": "l22-01", "tema": "Renda e trabalho", "promessa": "título curto",
   "trecho": "frase exata copiada do PDF", "pagina": 4,
   "status": "cumprida|parcialmente|em_andamento|nao_cumprida|sem_como_verificar",
   "explicacao": "uma ou duas frases, sem adjetivos",
   "evidencias": [{"titulo": "Lei 14.663/2023", "url": "https://www.planalto.gov.br/..."}],
   "revisado": "2026-10-08"
 }]
}
```

### Regras de curadoria (iguais para todos os partidos)

- **Promessas concretas**: uma lei, um programa, uma meta com número ou prazo. Frases genéricas ficam de fora ou entram como `sem_como_verificar`.
- **Trecho exato e página do PDF** entregue ao TSE (página 1 = primeira página do arquivo). Em PDF digitalizado só se corrigem erros evidentes de leitura, e o arquivo diz isso em `aviso_texto`.
- **Fonte oficial obrigatória**: Planalto (leis, decretos, emendas), Câmara/Senado (tramitação), órgãos públicos (IBGE, INPE, Tesouro, ministérios, assembleias, diários oficiais), Agência Brasil/EBC ou comunicado oficial de estatal.
- **Dentro do mandato**: conta o que aconteceu no mandato daquela eleição. O que aconteceu depois aparece na explicação, mas a promessa fica `nao_cumprida` naquele mandato.
- **Cautela**: na dúvida entre dois status, usar o mais conservador (ex.: `parcialmente` em vez de `cumprida`; `em_andamento` para meta ainda sem resultado).
- **Mandato em curso**: status vale até a data `revisado` e deve ser revisto.
- Textos simples, neutros, sem dizer se a proposta é boa ou ruim.

Para conferir trechos: extrair o texto do PDF com `pdftotext -layout` página a página e buscar a frase. Para conferir links: abrir cada URL de evidência (o script não acessa a internet).
