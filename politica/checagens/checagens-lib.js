/* Regras puras da página de checagens (testadas em tests/politica/checagens.test.js) */
(function (root, f) { if (typeof module === "object" && module.exports) module.exports = f(); else root.PolChecagens = f(); })(this, function () {
  "use strict";
  var VEREDITOS = {
    verdadeira: ["Verdadeira", "A afirmação é sustentada pelas fontes consultadas, no período e no indicador citados."],
    falsa: ["Falsa", "As fontes consultadas contradizem a afirmação."],
    parcialmente_verdadeira: ["Parcialmente verdadeira", "Parte da afirmação está correta, mas há exagero, imprecisão ou omissão relevante."],
    enganosa: ["Enganosa ou fora de contexto", "O dado pode existir, mas foi usado de forma que leva a uma conclusão errada (período, contexto ou comparação omitidos)."],
    desatualizada: ["Desatualizada", "Já foi verdade, mas dados mais recentes mostram outra situação."],
    nao_comprovada: ["Não comprovada", "Não foram encontradas evidências que sustentem a afirmação. Isso não prova que ela seja falsa."],
    inconclusiva: ["Inconclusiva", "As fontes confiáveis divergem ou não permitem uma conclusão."],
    opiniao: ["Opinião ou interpretação", "É um juízo de valor, não um fato que possa ser verificado como verdadeiro ou falso."],
    previsao: ["Previsão ainda não verificável", "Fala sobre o futuro; só poderá ser conferida depois."]
  };
  var OBRIG = ["id", "titulo", "afirmacao", "autor", "data_afirmacao", "veredito"];
  function norm(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
  function valida(c) {
    var e = [];
    if (!c || typeof c !== "object") return ["item inválido"];
    OBRIG.forEach(function (k) { if (!c[k] || typeof c[k] !== "string") e.push("sem " + k); });
    if (c.veredito && !VEREDITOS[c.veredito]) e.push("veredito desconhecido: " + c.veredito);
    if (!Array.isArray(c.fontes) || !c.fontes.length || c.fontes.some(function (f) { return !f || !/^https?:\/\//.test(f.url || ""); })) e.push("sem fontes válidas");
    return e;
  }
  function texto(c) { return norm([c.titulo, c.afirmacao, c.autor, c.contexto, c.o_que_as_fontes_mostram, (c.temas || []).join(" ")].join(" ")); }
  function filtrar(lista, f) {
    f = f || {};
    var qs = norm(f.q).split(" ").filter(Boolean);
    return lista.filter(function (c) {
      if (f.veredito && c.veredito !== f.veredito) return false;
      if (f.autor && c.autor !== f.autor) return false;
      if (f.tema && (c.temas || []).indexOf(f.tema) < 0) return false;
      if (qs.length) { var t = texto(c); if (!qs.every(function (q) { return t.indexOf(q) >= 0; })) return false; }
      return true;
    }).sort(function (a, b) { return a.data_afirmacao < b.data_afirmacao ? 1 : a.data_afirmacao > b.data_afirmacao ? -1 : 0; });
  }
  function lerFiltros(search) { var p = new URLSearchParams(search || ""); return { q: p.get("q") || "", veredito: p.get("veredito") || "", autor: p.get("autor") || "", tema: p.get("tema") || "" }; }
  function escreverFiltros(f) { var p = new URLSearchParams(); ["q", "veredito", "autor", "tema"].forEach(function (k) { if (f[k]) p.set(k, f[k]); }); var s = p.toString(); return s ? "?" + s : ""; }
  function rotuloTema(t) { var s = String(t).replace(/-/g, " "); return s.charAt(0).toUpperCase() + s.slice(1); }
  return { VEREDITOS: VEREDITOS, norm: norm, valida: valida, filtrar: filtrar, lerFiltros: lerFiltros, escreverFiltros: escreverFiltros, rotuloTema: rotuloTema };
});
