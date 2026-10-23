// Validação do dicionário de termos: node --test tests/politica
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const G = require("../../politica/glossario.js");
const d = JSON.parse(fs.readFileSync(path.join(__dirname, "../../politica/data/glossario.json"), "utf8"));

test("tem pelo menos 100 termos", () => assert.ok(d.termos.length >= 100, String(d.termos.length)));
test("ids e nomes únicos", () => {
  const ids = new Set(), nomes = new Set();
  for (const t of d.termos) {
    assert.ok(!ids.has(t.id), "id repetido " + t.id); ids.add(t.id);
    const n = G.norm(t.nome); assert.ok(!nomes.has(n), "nome repetido " + t.nome); nomes.add(n);
  }
});
test("campos obrigatórios, categoria válida e fonte https oficial", () => {
  for (const t of d.termos) {
    assert.match(t.id, /^[a-z0-9-]+$/, t.id);
    for (const k of ["nome", "categoria", "explicacao"]) assert.ok(t[k] && String(t[k]).trim(), t.id + " sem " + k);
    assert.ok(d.categorias.includes(t.categoria), t.id + " categoria " + t.categoria);
    assert.ok(t.fonte && t.fonte.nome, t.id + " sem nome de fonte");
    assert.match(t.fonte.url, /^https:\/\/[^/]*\.(gov|leg|jus|mp|def)\.br\//, t.id + " " + t.fonte.url);
  }
});
test("todas as categorias têm termos", () => {
  for (const c of d.categorias) assert.ok(d.termos.some((t) => t.categoria === c), c);
});
test("norm do glossário ignora acentos", () => assert.equal(G.norm("Quórum"), G.norm("quorum")));
