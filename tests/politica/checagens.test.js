// node --test tests/politica
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../../politica/checagens/checagens-lib.js");
const D = require("../../politica/data/checagens.json").checagens;
const base = { id: "a", titulo: "T", afirmacao: "Frase", autor: "Fulano (X)", data_afirmacao: "2022-01-01", veredito: "falsa", fontes: [{ url: "https://x.org" }] };

test("todas as checagens publicadas passam na validação", () => {
  for (const c of D) assert.deepEqual(L.valida(c), [], c.id);
  assert.equal(new Set(D.map((c) => c.id)).size, D.length);
});
test("validação rejeita veredito fora da lista, campo ausente e fontes vazias", () => {
  assert.ok(L.valida({ ...base, veredito: "mentira" }).length);
  assert.ok(L.valida({ ...base, autor: "" }).length);
  assert.ok(L.valida({ ...base, fontes: [] }).length);
  assert.deepEqual(L.valida(base), []);
});
test("busca ignora acentos e caixa", () => {
  const a = L.filtrar(D, { q: "auxilio" }), b = L.filtrar(D, { q: "AUXÍLIO" });
  assert.ok(a.length > 0); assert.deepEqual(a, b);
});
test("filtros combinados", () => {
  const r = L.filtrar(D, { veredito: "falsa", autor: "Jair Bolsonaro (PL)" });
  assert.ok(r.every((c) => c.veredito === "falsa" && c.autor === "Jair Bolsonaro (PL)"));
  assert.equal(L.filtrar(D, { q: "zzzinexistente" }).length, 0);
  assert.equal(L.filtrar(D, {}).length, D.length);
});
test("filtros vão e voltam da URL", () => {
  const f = { q: "pib", veredito: "verdadeira", autor: "", tema: "economia" };
  assert.deepEqual(L.lerFiltros(L.escreverFiltros(f)), f);
  assert.equal(L.escreverFiltros({}), "");
});
test("nove categorias de veredito com explicação", () => {
  assert.equal(Object.keys(L.VEREDITOS).length, 9);
});
