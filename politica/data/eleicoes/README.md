# Dados de /politica/eleicoes/

Montados por `scripts/politica/eleicoes/build.py` a partir dos arquivos abertos do TSE
(https://dadosabertos.tse.jus.br/). Nada é estimado, exceto `pesquisas.json`, que é
pesquisa eleitoral e sempre aparece na página como estimativa.

| Arquivo | O que tem |
|---|---|
| `indice.json` | eleições para presidente disponíveis (com os 3 primeiros), anos de partidos, regiões, próximo resultado |
| `pres/<ano>-<turno>.json` | presidente: candidatos, votos por região, estado e país do exterior, aptos, comparecimento, brancos e nulos |
| `pres/<ano>-<turno>-mun.json` | presidente por cidade (código IBGE): votos dos 2 ou 4 primeiros, válidos, aptos, comparecimento, brancos, nulos |
| `partidos/<ano>.json` | por cargo e estado: votos nominais, de legenda e eleitos de cada partido |
| `partidos/resumo.json` | o mesmo somado por Brasil e região, para ranking e linha do tempo |
| `partidos-historia.json` | fusões e mudanças de nome (escrito à mão, com fontes do TSE) |
| `especiais.json` | votos para presidente nas seções de presos provisórios e adolescentes internados (desde 2010) |
| `perfil.json` | perfil do eleitorado (cadastro): sexo, idade, escolaridade, cor por estado |
| `pesquisas.json` | pesquisas Datafolha por grupo (tirado dos PDFs originais; não é resultado oficial) |

Regras:
- Votos de presidente = votos válidos (nominais); 1989 só por estado, sem brancos/nulos.
- Cargos de maioria (presidente, governador, prefeito) contam só o 1º turno na soma por partido.
- Eleitos = situação final no arquivo do TSE ("ELEITO", "ELEITO POR QP", "ELEITO POR MÉDIA", "MÉDIA").
- Só eleições ordinárias (as suplementares ficam fora).
- Exterior: a cidade da seção é ligada ao país por `scripts/politica/eleicoes/exterior.py`.
- Atualização: `.github/workflows/politica-eleicoes.yml` (semana do 2º turno de 2026 duas vezes por dia; depois, mensal).
