// Testes da busca do portal de política: node --test tests/politica
const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("../../politica/busca.js");

test("norm remove acentos, caixa e pontuação", () => {
  assert.equal(B.norm("  Câmara dos DEPUTADOS! "), "camara dos deputados");
  assert.equal(B.norm("Orçamento-União"), "orcamento uniao");
  assert.equal(B.norm("São Paulo"), B.norm("sao paulo"));
});

const itens = [
  B.itemPolitico({ id: 1, n: "João da Silva", p: "PT", uf: "SP" }, "c"),
  B.itemPolitico({ id: 2, n: "Maria Souza", p: "PL", uf: "RJ" }, "s"),
  { tipo: "pagina", titulo: "Gastos do governo", texto: "orçamento cartão", url: "/politica/gastos/" },
];

test("busca sem acento encontra nome com acento", () => {
  const r = B.buscar(itens, { q: "joao" });
  assert.equal(r[0].url, "/politica/#perfil/c/1");
});
test("busca por prefixo e por texto", () => {
  assert.ok(B.buscar(itens, { q: "orcam" }).some((i) => i.url === "/politica/gastos/"));
});
test("filtros de UF e partido sem texto listam políticos", () => {
  const r = B.buscar(itens, { uf: "RJ" });
  assert.deepEqual(r.map((i) => i.url), ["/politica/#perfil/s/2"]);
  assert.equal(B.buscar(itens, { partido: "PT" }).length, 1);
});
test("busca vazia sem filtros não retorna nada", () => {
  assert.equal(B.buscar(itens, {}).length, 0);
});
test("páginas fixas apontam para /politica/", () => {
  assert.ok(B.PAGINAS.length >= 10);
  for (const p of B.PAGINAS) assert.match(p.url, /^\/politica\//);
});
