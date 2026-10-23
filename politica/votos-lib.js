/* Classificação de votos e filtros do "Como votou" (navegador e Node).
   Cada código oficial vira UMA categoria; categorias diferentes nunca são somadas como se fossem a mesma coisa. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; else root.PolVotos = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  // categoria: [rótulo, termo do glossário, participou da votação?]
  var CAT = {
    sim: ["Sim", "voto-sim-nao", true],
    nao: ["Não", "voto-sim-nao", true],
    abstencao: ["Abstenção", "abstencao", true],
    obstrucao: ["Obstrução", "obstrucao", true],
    secreto: ["Votou (voto secreto)", "votacao-secreta", true],
    presidindo: ["Presidindo a sessão (não vota)", "presente-sem-voto", false],
    presente: ["Presente, sem voto registrado", "presente-sem-voto", false],
    ausente_just: ["Ausência justificada (licença, missão ou atividade parlamentar)", "ausencia-votacao", false],
    ausente: ["Não compareceu", "ausencia-votacao", false],
    sem_registro: ["Sem voto registrado", "ausencia-votacao", false],
    outro: ["Outro registro", "", false],
  };
  var ORDEM = ["sim", "nao", "abstencao", "obstrucao", "secreto", "presidindo", "presente", "ausente_just", "ausente", "sem_registro", "outro"];
  // Câmara: códigos gravados pelo coletor (S, N, A, O, P = Art. 17, V = secreto).
  var CAMARA = { S: "sim", N: "nao", A: "abstencao", O: "obstrucao", P: "presidindo", V: "secreto" };
  // Senado: siglaVotoParlamentar da API /votacao.
  var SENADO = {
    "Sim": "sim", "Não": "nao", "Abstenção": "abstencao", "Obstrução": "obstrucao", "Votou": "secreto",
    "P-NRV": "presente", "Presidente (art. 51 RISF)": "presidindo", "PRES": "presidindo",
    "NCom": "ausente", "AP": "ausente_just", "MIS": "ausente_just", "LS": "ausente_just", "LP": "ausente_just",
    "LAP": "ausente_just", "LG": "ausente_just", "LA": "ausente_just", "LC": "ausente_just", "LAA": "ausente_just",
  };
  function classificar(casa, cod) {
    if (cod == null || cod === "") return "sem_registro";
    var m = casa === "c" ? CAMARA : SENADO;
    if (m[cod]) return m[cod];
    if (casa === "s" && /^L/.test(cod)) return "ausente_just"; // outras licenças
    return "outro";
  }
  function rotulo(cat) { return (CAT[cat] || CAT.outro)[0]; }
  function termo(cat) { return (CAT[cat] || CAT.outro)[1]; }
  function participou(cat) { return !!(CAT[cat] || CAT.outro)[2]; }
  function norm(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }

  // Períodos: "30d", "90d", "365d", "aaaa" (ano) ou "" (tudo). hoje = "aaaa-mm-dd".
  function noPeriodo(dt, periodo, hoje) {
    if (!periodo) return true;
    var d = String(dt || "").slice(0, 10);
    if (/^\d{4}$/.test(periodo)) return d.slice(0, 4) === periodo;
    var m = /^(\d+)d$/.exec(periodo); if (!m) return true;
    var lim = new Date(Date.parse((hoje || new Date().toISOString().slice(0, 10)) + "T00:00:00Z") - (+m[1]) * 86400000).toISOString().slice(0, 10);
    return d >= lim;
  }
  /* linhas: [{v: votação do índice, cat}]; f: {periodo, tipo, tema}; tipo = categoria ou "participou"/"nao-participou" */
  function filtrar(linhas, f, hoje) {
    f = f || {};
    var tema = norm(f.tema);
    return linhas.filter(function (l) {
      if (!noPeriodo(l.v.dt, f.periodo, hoje)) return false;
      if (f.tipo) {
        if (f.tipo === "participou") { if (!participou(l.cat)) return false; }
        else if (f.tipo === "nao-participou") { if (participou(l.cat)) return false; }
        else if (l.cat !== f.tipo) return false;
      }
      if (tema && !(l.v.t || []).some(function (t) { return norm(t) === tema; })) return false;
      return true;
    });
  }
  function contar(linhas) {
    var c = {}; linhas.forEach(function (l) { c[l.cat] = (c[l.cat] || 0) + 1; }); return c;
  }
  /* Agrupa votos de uma votação por partido ou UF: rows [[id, nome, partido, uf, código]] */
  function agrupar(casa, rows, idx) {
    var g = {};
    rows.forEach(function (r) {
      var k = r[idx] || "—", cat = classificar(casa, r[4]);
      (g[k] = g[k] || { k: k, n: 0, c: {} }); g[k].n++; g[k].c[cat] = (g[k].c[cat] || 0) + 1;
    });
    return Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.n - a.n || a.k.localeCompare(b.k); });
  }
  return { CAT: CAT, ORDEM: ORDEM, classificar: classificar, rotulo: rotulo, termo: termo, participou: participou, noPeriodo: noPeriodo, filtrar: filtrar, contar: contar, agrupar: agrupar, norm: norm };
});
