// Índices auxiliares do catálogo de propostas (para a página não precisar baixar todos os anos):
//  - autores: em quais anos cada autor (índice de autores.json) tem propostas
//  - resumos: em que ano está cada proposta com resumo escrito à mão (painel + este fluxo)
// Saída: politica/data/propostas/extras.json
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import { ROOT, PROP, log, readJSON, writeIfChanged } from './comum.mjs';

const dir = join(PROP, 'anos');
const anos = readdirSync(dir).filter((f) => /^\d{4}\.json$/.test(f)).map((f) => Number(f.slice(0, 4))).sort();
const resumos = new Set();
const add = (o) => Object.keys(o || {}).forEach((k) => { if (/^[cs]:/.test(k)) resumos.add(k); });
add(await readJSON(join(ROOT, 'politica', 'data', 'resumos-simples.json'), {}));
const ix = await readJSON(join(PROP, 'resumos', 'indice.json'), { arquivos: [] });
for (const a of ix.arquivos || []) {
  const d = await readJSON(join(PROP, 'resumos', a), {});
  add(d);
  for (const v of Object.values(d)) if (v && v.origem && /^[cs]:/.test(v.origem[0])) resumos.add(v.origem[0]); // leis explicadas -> proposta de origem
}
const autAnos = [];
const resAnos = {};
const partidos = {}; const ufs = {};
const autores = (await readJSON(join(PROP, 'autores.json'), { lista: [] })).lista;
for (const y of anos) {
  const d = await readJSON(join(dir, `${y}.json`), { itens: [] });
  for (const it of d.itens) {
    for (const a of it[4] || []) { (autAnos[a] ||= new Set()).add(y); const p = autores[a]?.[3]; if (p) partidos[p] = (partidos[p] || 0) + 1; const u = autores[a]?.[4]; if (u) ufs[u] = (ufs[u] || 0) + 1; }
    if (resumos.has(it[0])) resAnos[it[0]] = y;
  }
}
const out = {
  _sobre: 'Índices auxiliares do catálogo. autoresAnos[i] = anos (separados por espaço) em que o autor i de autores.json tem propostas. resumoAnos = ano da fatia de cada proposta com resumo escrito à mão. partidos/ufs = número de autorias por partido e UF (como registrados na autoria).',
  autoresAnos: autAnos.map((s) => (s ? [...s].sort().join(' ') : '')),
  resumoAnos: resAnos, partidos, ufs,
};
await writeIfChanged(join(PROP, 'extras.json'), out);
log('extras', 'autores', autAnos.length, 'resumos localizados', Object.keys(resAnos).length, 'de', resumos.size);
