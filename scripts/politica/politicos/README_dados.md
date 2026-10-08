# Dados de /politica/politicos/

Diretório de quem teve mandato eletivo no Brasil desde 1988 (presidente, vice, governador, vice, senador,
deputado federal, estadual e distrital, prefeito, vice-prefeito e vereador), com todas as candidaturas
encontradas nos dados abertos do TSE (1989–2026).

Gerado por `scripts/politica/politicos/` (`tse_stage.py` → `fetch_congresso.py` → `build.py`) e atualizado
todo mês pelo workflow `.github/workflows/politica-politicos.yml`. Números atuais, fontes com URL e data de
download e a lista de lacunas ficam em `meta.json`.

## Fontes (todas abertas, sem chave)

| Fonte | Uso |
|---|---|
| TSE – `cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_{ano}.zip` (1994–2026) | candidaturas, partido, resultado |
| TSE – `.../votacao_candidato_munzona/votacao_candidato_munzona_{ano}.zip` (1994–2026) | votos (somados de todas as zonas) e resultado |
| TSE – `.../votacao_candidato_uf/votacao_candidato_uf_{1989,1990}.zip` | 1989 (presidente) e 1990 (só nome, sem documento) |
| TSE – `.../municipio_tse_ibge/municipio_tse_ibge.zip` | código TSE ↔ código IBGE dos municípios |
| Câmara – `dadosabertos.camara.leg.br/api/v2` (legislaturas 48–57, 1987–2027) | deputados federais que exerceram mandato, suplentes que assumiram, trocas de partido, mandatos declarados |
| Senado – `legis.senado.leg.br/dadosabertos` (legislaturas 48–58) | senadores titulares e suplentes que assumiram, períodos de exercício |
| `scripts/politica/politicos/ajustes.json` | ajustes documentados com fonte oficial (Sarney, Collor, Itamar, Marco Maciel, Dilma, Temer) |

Os arquivos brutos do TSE não ficam no repositório (são baixados e apagados a cada execução).

## Identificador (`id`) e privacidade

* O TSE publica CPF e título de eleitor em alguns anos. **Esses números são usados só durante o processamento,
  para ligar registros da mesma pessoa, e nunca são gravados nesta pasta.** Também não publicamos data de nascimento.
* Cada pessoa recebe um `id` opaco de 10 caracteres (`[a-z2-7]`): os 10 primeiros caracteres do SHA-1, em base32
  minúscula, de uma "âncora" pública e estável:
  * `t:{ano}:{o|s}:{UE}:{cargo}:{SQ_CANDIDATO}` – a candidatura mais antiga da pessoa no TSE (`o` = eleição ordinária,
    `s` = suplementar; UE = UF, `BR` ou código TSE do município);
  * `c:{id Câmara}` ou `s:{código Senado}` – quem só aparece na Câmara/Senado;
  * `o:{ano}:{UF}:{cargo}:{número}:{nome normalizado}` – quem só aparece em 1989/1990.
* Se uma atualização juntar ou separar registros e um `id` publicado deixar de existir, `aliases.json` aponta o id
  antigo para o novo. `ids.txt` lista todos os ids publicados.
* Perfil: `https://alexschimitz.github.io/politica/politicos/#p/{id}`.

### Como os registros são ligados

1. Candidaturas do TSE: mesma pessoa quando há o mesmo CPF válido, o mesmo título de eleitor ou o mesmo
   nome + data de nascimento. Quando CPF/título coincidem mas nome e nascimento não batem (erro de digitação na
   fonte), os registros **não** são juntados.
2. Câmara: pelo CPF/nome civil + nascimento informados pela Câmara; sem isso, pela "cadeira" (mesmo cargo, UF e
   eleição, nome muito parecido e único).
3. Senado: nome + nascimento; senão, a cadeira (mesma UF e eleição).
4. 1989/1990 (o TSE só tem o nome): ligamos pelo mandato registrado na Câmara/Senado a partir de 1991; sem isso,
   o registro fica separado.
5. Quando a ligação é incerta, os registros ficam **separados** e cada um traz `pm` ("possivelmente a mesma
   pessoa") com o motivo: `doc` (mesmo documento, nome/nascimento diferentes) ou `nome` (mesmo nome, sem documento).

## Arquivos

Todos são JSON compacto (UTF-8). Códigos de cargo (os do TSE): 1 presidente, 2 vice-presidente, 3 governador,
4 vice-governador, 5 senador, 6 dep. federal, 7 dep. estadual, 8 dep. distrital, 9/10 1º/2º suplente de senador,
11 prefeito, 12 vice-prefeito, 13 vereador. Municípios usam o código TSE (5 dígitos) — veja `municipios.json`.

| Arquivo | Conteúdo |
|---|---|
| `meta.json` | data de geração, contagens, mandatos por cargo com anos, fontes, lacunas |
| `idx/manifest.json` | `{escopo: [partes]}`; escopos `BR` (todos com cargo federal/estadual) e cada UF (todos com mandato na UF) |
| `idx/{parte}.json` | `{cols, rows}` – uma linha por pessoa: `[id, nome, cargos(bitmask 1<<cargo), outros nomes "a|b", municípios "cod|cod", ano inicial, ano final, nº de mandatos, último partido, partidos "A,B", flags (1 em curso, 2 possível duplicata, 4 eleito p/ mandato futuro), anos com mandato]` |
| `p/{2 primeiros caracteres do id}.json` | `{id: pessoa}` (formato abaixo) |
| `ranking.json` | `geral`: `[id, nome, nº mandatos, anos, {cargo: n}]`; por cargo: `[id, nome, n no cargo, nº mandatos, anos]` |
| `municipios.json` | `{códigoTSE: [nome, UF, códigoIBGE]}` |
| `lookup/{UF ou BR}.json` | `{"ano|cargo|local": [ids]}` para quem foi eleito (sem vereadores). `local` = código IBGE do município (ou `t`+código TSE se não houver IBGE), a UF, ou `BR`. Usado pelo mapa para ligar prefeitos e governadores. |
| `cargos/prefeitos/{UF}.json` | `{códigoIBGE: [[ano início, ano fim, id, nome, partido, tampão(0/1)]]}` |
| `cargos/governadores.json` | `[[UF, cargo, ano início, ano fim, id, nome, partido]]` |
| `partidos.json` | famílias de partidos (nomes antigos, fusões) com explicação e `nomes` das siglas |
| `aliases.json`, `ids.txt` | ver acima |

### Pessoa (`p/xx.json`)

```
{
  "n": "nome mais usado", "nc": "nome completo (se diferente)", "g": "F" (se feminino),
  "nm": nº de mandatos iniciados (sem suplência de senador não exercida), "ym": anos com mandato até hoje,
  "e": [[ano, cargo, local, partido, resultado, votos 1º turno, votos 2º turno, mês (só eleição suplementar), nome de urna (só quando muda)]],
  "m": [[cargo, local, mês início, mês fim, partido, ano da eleição, como, votos, fontes, flags, extra]],
  "pe": [[data, sigla]],      // trocas de partido registradas pela Câmara/Senado
  "cam": id na Câmara, "sen": código no Senado,
  "pm": [[id, "doc"|"nome"]]  // possivelmente a mesma pessoa
}
```

* `resultado` em `e`: `E` eleito, `Q` eleito por quociente, `M` eleito por média, `V` eleito na chapa (vice/suplente),
  `S` suplente, `N` não eleito, `T` foi ao 2º turno (sem resultado final ainda), `X` candidatura sem efeito
  (indeferida, cancelada, renúncia…), `U` sem resultado na fonte. Campos vazios no fim são omitidos.
* **Mandatos**: cada candidatura com resultado `E/Q/M/V` é um mandato com o período oficial do cargo (meses
  absolutos = ano×12 + mês−1): municipal jan/ano+1 a dez/ano+4; deputados fev/ano+1 a jan/ano+5; senador 8 anos;
  presidente/governador jan/ano+1 a dez/ano+4 (1989: mar/1990 a dez/1994); eleição suplementar = mandato-tampão até o
  fim do período. `m` só traz mandatos que **não** são puramente do TSE (exercício pela Câmara/Senado, suplentes que
  assumiram, mandatos declarados, ajustes documentados); um mandato do TSE é substituído por um item de `m` com o
  mesmo cargo e ano de eleição.
* `como` em `m`: `E/Q/M/V` como acima, `S` suplente que assumiu, `C` exercício registrado pela Câmara,
  `T` titular registrado pelo Senado, `A` assumiu por sucessão. `fontes`: letras `t` TSE, `c` Câmara, `s` Senado,
  `x` declarado à Câmara (mandatos externos), `a` ajuste documentado. `flags`: 1 em curso, 2 futuro, 8 em exercício
  agora (Senado), 16 exercício curto declarado (não conta como mandato). `extra` (opcional): `nota`, `fonte` (URL), `exd` (exercícios do Senado), `tit` (titular), `mn` (nome do município).

## Lacunas conhecidas

* Eleições municipais de 1988 e 1992 e a eleição geral de 1986 não estão nos dados abertos do TSE: prefeitos e
  vereadores de 1989–1996 não aparecem; deputados e senadores eleitos em 1986 só aparecem pela Câmara/Senado.
* 1989/1990: só nome, sem documento; 1994/1996: sem CPF/título (1996 com nascimento parcial).
* Cassações, renúncias e licenças de cargos executivos e municipais não são refletidas (só os ajustes documentados).
* 1994 e 1998: o número do vice não identifica a chapa, então vices eleitos nesses anos ficam "sem resultado" (exceto ajustes documentados).
* Suplentes que assumiram só são conhecidos para deputado federal e senador.
* A eleição de 2026 entra com o resultado do 1º turno; o 2º turno é em 25/10/2026 e os mandatos começam em 2027.
