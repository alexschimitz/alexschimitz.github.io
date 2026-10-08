# Dados de /politica/leis/

Leis e emendas que mudaram o país desde 1988, com autores, votações nominais e casos objetivos de
"disse uma coisa, votou outra". Nenhum texto classifica uma lei como boa ou ruim.

## Arquivos

| Arquivo | O que é | Como é feito |
|---|---|---|
| `leis.json` | catálogo: curadoria + autores, data, governo, link do Planalto, tramitação, vetos e resumo de cada votação (placar, partidos, orientação de bancada) | `scripts/politica/leis/build_leis.py` |
| `votos/{id}.json` | voto de cada parlamentar em cada votação principal da lei: `[id do perfil, nome, partido, UF, voto, c{id Câmara} ou s{código Senado}]` | idem |
| `pessoas.json` | índice “como votou fulano”: `votos` = lista de votações `[lei, chave, casa, data, turno]`; `p` = `[chave, nome, partido, UF, id do perfil, uma letra por votação]` | idem |
| `coerencia-leis.json` | casos (a), (b) e (c) nas leis curadas, Câmara e Senado | idem |
| `coerencia-camara.json` | casos (a) e (c) em todas as votações nominais de plenário da Câmara desde 2001 | `scripts/politica/leis/coerencia_camara.py` |
| `problemas.txt` | o que o script não conseguiu confirmar (ex.: link do Planalto, lei sem votação) | `build_leis.py` |

Letras de voto: `S` sim, `N` não, `A` abstenção, `O` obstrução, `P` presidente da sessão ou presente sem voto,
`X` em exercício mas sem voto registrado (ausente, licença, missão), `V` votou em votação secreta, `.` não era parlamentar.

## Curadoria (feita à mão)

`scripts/politica/leis/curadoria/leis-*.json`: uma entrada por lei com `norma` (`LEI|LCP|EMC-número-ano`, ou `null` para
propostas que não viraram lei, com `camara`/`senado` e `situacao`), `muda`, `ganha`, `custo`, `favor` e `contra`
(`[quem, argumento]`), `efeitos` e `polemica` (`[texto, link oficial]`).

Regras da curadoria:
* linguagem simples e neutra; os dois lados com atribuição; nunca “boa” ou “ruim”;
* polêmicas só com link oficial (STF, TSE, Planalto, TCU) ou fato registrado nos próprios dados (veto, votação);
* a escolha cobre todos os governos desde 1988 e todos os temas.

O script confere cada `norma` no Senado (`/processo?tipoNorma&numeroNorma&anoNorma`, campo `normaGerada`), acha o
projeto correspondente na Câmara (`outrosNumeros`, `normas-origem.json` de /propostas e a busca por sigla/número/ano)
e confere se a página do Planalto existe e cita o número da norma.

## Votações

* Câmara: `/proposicoes/{id}/votacoes` (só plenário e só votações que trazem o placar, ou seja, nominais), filtradas
  para a aprovação do texto (projeto, substitutivo, PEC em 1º e 2º turno, MP/PLV, emendas do Senado). Ficam fora
  requerimentos, destaques e pressupostos. Votos em `/votacoes/{id}/votos`, orientação em `/orientacoes`, e quem estava
  em exercício no dia em `/deputados?dataInicio=dataFim=` (para contar ausentes).
* Senado: `/votacao?codigoMateria=` (votos de todos os senadores, com ausências e licenças).
* Cobertura: voto nominal com nomes nos dados abertos da Câmara a partir de 2003 (2001 e 2002 têm poucas votações);
  no Senado, a partir do fim dos anos 1990. Antes disso o voto existe só nos Diários e não é reconstruído aqui.

## Coerência (método igual para todos)

* (a) **Assinou e votou contra**: autor ou coautor (lista oficial de autores) votou NÃO na aprovação do texto da mesma
  proposição. Não contam destaques, requerimentos e substitutivos (texto reescrito pelo relator).
* (b) **Contra a orientação do partido**: votou SIM ou NÃO ao contrário da orientação oficial registrada pela liderança
  do próprio partido naquela votação (Câmara). “Liberado” e “obstrução” não contam. A declaração de voto individual não está
  nos dados abertos de forma estruturada, por isso não é usada.
* (c) **Mudou de turno**: SIM em um turno e NÃO no outro, na mesma PEC.
* (d) Promessa de plano de governo × voto: não incluído (exige ligar o texto do plano ao mesmo assunto da votação).
* Redes sociais, entrevistas e notícias não são usadas.

## Atualizar

```
python3 scripts/politica/leis/build_leis.py            # usa cache em ../pol-leis-raw/cache
scripts/politica/leis/download_camara.sh ../pol-leis-raw
python3 scripts/politica/leis/coerencia_camara.py ../pol-leis-raw
```
