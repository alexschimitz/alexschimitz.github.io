const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const V = require('../../politica/votos-lib.js');
const B = require('../../politica/busca.js');

test('classifica códigos da Câmara sem confundir categorias', () => {
  assert.strictEqual(V.classificar('c', 'S'), 'sim');
  assert.strictEqual(V.classificar('c', 'N'), 'nao');
  assert.strictEqual(V.classificar('c', 'A'), 'abstencao');
  assert.strictEqual(V.classificar('c', 'O'), 'obstrucao');
  assert.strictEqual(V.classificar('c', 'P'), 'presidindo');
  assert.strictEqual(V.classificar('c', 'V'), 'secreto');
  assert.strictEqual(V.classificar('c', null), 'sem_registro');
  assert.notStrictEqual(V.classificar('c', null), 'ausente', 'Câmara sem voto não é "ausente"');
});

test('classifica códigos do Senado, incluindo ausências e licenças', () => {
  assert.strictEqual(V.classificar('s', 'Sim'), 'sim');
  assert.strictEqual(V.classificar('s', 'Votou'), 'secreto');
  assert.strictEqual(V.classificar('s', 'P-NRV'), 'presente');
  assert.strictEqual(V.classificar('s', 'Presidente (art. 51 RISF)'), 'presidindo');
  assert.strictEqual(V.classificar('s', 'NCom'), 'ausente');
  for (const c of ['AP', 'MIS', 'LS', 'LP', 'LAP', 'LG']) assert.strictEqual(V.classificar('s', c), 'ausente_just', c);
  assert.strictEqual(V.classificar('s', 'XYZ'), 'outro');
});

test('participação: abstenção e obstrução participam; ausência e presidência não', () => {
  assert.ok(V.participou('abstencao') && V.participou('obstrucao') && V.participou('secreto'));
  for (const k of ['ausente', 'ausente_just', 'presidindo', 'presente', 'sem_registro']) assert.ok(!V.participou(k), k);
  assert.notStrictEqual(V.rotulo('abstencao'), V.rotulo('ausente'));
  assert.notStrictEqual(V.rotulo('obstrucao'), V.rotulo('abstencao'));
});

const L = [
  { v: { dt: '2026-10-10T18:00:00', t: ['Saúde'] }, cat: 'sim' },
  { v: { dt: '2026-08-01', t: ['Educação', 'Saúde'] }, cat: 'nao' },
  { v: { dt: '2025-03-05', t: ['Economia'] }, cat: 'ausente_just' },
  { v: { dt: '2025-12-20', t: [] }, cat: 'obstrucao' },
];
test('filtro de período (dias e ano)', () => {
  assert.strictEqual(V.filtrar(L, { periodo: '30d' }, '2026-10-23').length, 1);
  assert.strictEqual(V.filtrar(L, { periodo: '90d' }, '2026-10-23').length, 2);
  assert.strictEqual(V.filtrar(L, { periodo: '2025' }, '2026-10-23').length, 2);
  assert.strictEqual(V.filtrar(L, { periodo: '' }, '2026-10-23').length, 4);
});
test('filtro de tipo e tema (sem acento/maiúsculas) combinados', () => {
  assert.strictEqual(V.filtrar(L, { tipo: 'participou' }).length, 3);
  assert.strictEqual(V.filtrar(L, { tipo: 'nao-participou' }).length, 1);
  assert.strictEqual(V.filtrar(L, { tipo: 'obstrucao' }).length, 1);
  assert.strictEqual(V.filtrar(L, { tema: 'saude' }).length, 2);
  assert.strictEqual(V.filtrar(L, { tema: 'educação', tipo: 'nao', periodo: '2026' }, '2026-10-23').length, 1);
  assert.strictEqual(V.filtrar(L, { tema: 'saude', tipo: 'obstrucao' }).length, 0);
});
test('contar e agrupar por partido', () => {
  assert.deepStrictEqual(V.contar(L), { sim: 1, nao: 1, ausente_just: 1, obstrucao: 1 });
  const g = V.agrupar('c', [[1, 'A', 'PT', 'SP', 'S'], [2, 'B', 'PT', 'RJ', 'N'], [3, 'C', 'PL', 'SP', 'O']], 2);
  assert.strictEqual(g[0].k, 'PT'); assert.deepStrictEqual(g[0].c, { sim: 1, nao: 1 });
  assert.deepStrictEqual(g[1].c, { obstrucao: 1 });
});
test('busca encontra votações pelo número da proposta', () => {
  const it = B.itemVotacao({ k: 'c:123-4', dt: '2026-05-02T10:00', d: 'Votação do texto', r: 'A', p: { id: 1, s: 'PL 1087/2025', e: 'Altera o imposto de renda' }, t: ['Tributos'] });
  assert.strictEqual(it.url, '/politica/votacao/?id=c-123-4');
  const r = B.buscar([it], { q: 'pl 1087' }); assert.strictEqual(r.length, 1);
  assert.strictEqual(B.buscar([it], { q: 'imposto renda' }).length, 1);
});
test('dados reais coletados existem e têm formato válido', () => {
  const dir = path.join(__dirname, '../../politica/data/votos');
  const idx = JSON.parse(fs.readFileSync(path.join(dir, 'idx.json'), 'utf8'));
  assert.ok(idx.v.length > 100);
  assert.ok(idx.cobertura.c.nominais > 0 && idx.cobertura.s.nominais > 0);
  const v = idx.v.find((x) => x.k[0] === 's');
  const rows = JSON.parse(fs.readFileSync(path.join(dir, 'v', v.k.replace(':', '-') + '.json'), 'utf8'));
  assert.strictEqual(rows.length, v.n);
  const p = JSON.parse(fs.readFileSync(path.join(dir, 's', rows[0][0] + '.json'), 'utf8'));
  assert.ok(p.some(([id]) => 's:' + id === v.k));
});
