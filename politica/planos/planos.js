/* politica/planos/planos.js — planos de governo (TSE) e acompanhamento de promessas.
   Dados: ../data/planos/ (ver README.md lá). Sem dependências. */
(function () {
  "use strict";
  var D = "../data/planos/";
  var ST = ["cumprida", "parcialmente", "em_andamento", "nao_cumprida", "sem_como_verificar"];
  var ST_TXT = { cumprida: "Cumprida", parcialmente: "Parcialmente", em_andamento: "Em andamento", nao_cumprida: "Não cumprida", sem_como_verificar: "Sem como verificar" };
  var ST_DESC = {
    cumprida: "O que foi prometido aconteceu, e há documento oficial que mostra isso.",
    parcialmente: "Uma parte aconteceu, outra não (ou aconteceu de forma diferente da prometida).",
    em_andamento: "Começou, mas ainda não terminou (vale para mandatos em curso ou metas de longo prazo).",
    nao_cumprida: "Não aconteceu durante o mandato. Se aconteceu depois, a explicação diz quando.",
    sem_como_verificar: "A promessa é genérica demais ou não há dado oficial para conferir."
  };
  var CARGO = { 1: "Presidente", 3: "Governador", 11: "Prefeito", presidente: "Presidente", governador: "Governador", prefeito: "Prefeito" };
  var RES = { E: "Eleito", S: "2º turno, não eleito", T: "Vai ao 2º turno", N: "Não eleito", X: "Candidatura sem efeito", U: "Sem resultado" };
  var RES_TIT = { X: "Candidatura indeferida, cancelada ou com renúncia", T: "2º turno em 25/10/2026", U: "O TSE ainda não publicou o resultado" };
  var UFS = "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(" ");
  var GERAIS = [2026, 2022, 2018, 2014, 2010], MUNIC = [2024, 2020, 2016, 2012];
  var PERFIL = "/politica/politicos/#p/";
  var DIVULGA = "https://divulgacandcontas.tse.jus.br/divulga/#/candidato/";
  var ZIP = "https://cdn.tse.jus.br/estatistica/sead/odsele/proposta_governo/proposta_governo_";
  var ANTES = [
    [2006, "Lula", "PT", "dmrffhxtzv"], [2002, "Lula", "PT", "dmrffhxtzv"],
    [1998, "Fernando Henrique Cardoso", "PSDB", "sdtgfbjdym"], [1994, "Fernando Henrique Cardoso", "PSDB", "sdtgfbjdym"],
    [1989, "Fernando Collor", "PRN", "vc64qekiw2"]
  ];

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function norm(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function dataBR(iso) { if (!iso) return "—"; var p = iso.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  function num(n) { return (n || 0).toLocaleString("pt-BR"); }
  function mb(b) { return b ? (b / 1048576).toLocaleString("pt-BR", { maximumFractionDigits: b > 1e8 ? 0 : 1 }) + " MB" : ""; }
  function ext(href, txt, cls) { return '<a' + (cls ? ' class="' + cls + '"' : "") + ' href="' + esc(href) + '" target="_blank" rel="noreferrer">' + txt + ' <span aria-hidden="true">↗</span></a>'; }
  function getJSON(u) { return fetch(u, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status + " " + u); return r.json(); }); }
  function erro(el, msg) { if (el) el.innerHTML = '<p class="err">' + esc(msg) + "</p>"; }
  function chip(st) { return '<span class="pl-st st-' + st + '">' + ST_TXT[st] + "</span>"; }

  var PROM = null, PLANOS = [], META = null, GER = null, DIV = {}, ZIPS = {};
  var temPromessa = {};

  /* ------------------------------------------------------------ promessas */
  function planoKey(p) { return p.ano + "-" + p.uf + "-" + p.sq; }
  function planoNome(p) {
    var onde = p.cargo === "presidente" ? "Presidente" : CARGO[p.cargo] + " (" + p.uf + ")";
    return p.pessoa.nome + " · " + onde + " " + p.ano;
  }
  function mandatoTxt(p) {
    var m = p.mandato, a = m.inicio.slice(0, 4), b = m.fim.slice(0, 4);
    var s = m.situacao === "em curso" ? "mandato em curso" : m.situacao === "interrompido" ? "mandato interrompido" : "mandato encerrado";
    return "Mandato " + a + "–" + b + " · " + s;
  }
  function barra(c, total) {
    return '<div class="pl-bar" aria-hidden="true">' + ST.map(function (s) {
      return c[s] ? '<span class="st-bg-' + s + '" style="width:' + (100 * c[s] / total).toFixed(2) + '%"></span>' : "";
    }).join("") + "</div>";
  }
  function contagemTxt(c) {
    return ST.filter(function (s) { return c[s]; }).map(function (s) { return '<span class="pl-ct"><i class="st-bg-' + s + '" aria-hidden="true"></i>' + ST_TXT[s] + ": <b>" + c[s] + "</b></span>"; }).join("");
  }

  function renderPlacar() {
    $("legenda").innerHTML = ST.map(function (s) { return '<span class="pl-ct"><i class="st-bg-' + s + '" aria-hidden="true"></i>' + ST_TXT[s] + "</span>"; }).join("");
    $("placar").innerHTML = PLANOS.map(function (p) {
      var c = p.contagem, tot = p.promessas.length;
      return '<li><div class="pl-placar-top"><button type="button" class="linkish pl-ver" data-k="' + esc(planoKey(p)) + '">' + esc(planoNome(p)) + "</button>" +
        '<span class="muted pl-placar-sub">' + esc(p.pessoa.partido) + " · " + esc(mandatoTxt(p)) + " · " + tot + " promessas</span></div>" +
        barra(c, tot) + '<div class="pl-cts">' + contagemTxt(c) + "</div></li>";
    }).join("");
  }

  var pPag = 30, pLim = pPag;
  function filtrarPromessas() {
    var q = norm($("f-busca").value.trim()), k = $("f-plano").value, st = $("f-status").value, tema = $("f-tema").value;
    var out = [];
    PLANOS.forEach(function (p) {
      if (k && planoKey(p) !== k) return;
      p.promessas.forEach(function (x) {
        if (st && x.status !== st) return;
        if (tema && x.tema !== tema) return;
        if (q && norm([x.promessa, x.trecho, x.explicacao, x.tema, p.pessoa.nome, p.pessoa.partido].join(" ")).indexOf(q) < 0) return;
        out.push([p, x]);
      });
    });
    return out;
  }
  function renderPromessas() {
    var r = filtrarPromessas();
    $("prom-conta").textContent = r.length ? r.length + (r.length === 1 ? " promessa" : " promessas") + " com esses filtros." : "";
    if (!r.length) { $("prom-lista").innerHTML = '<li class="pl-vazio">Nenhuma promessa com esses filtros. <button type="button" class="linkish" data-limpar>Limpar filtros</button></li>'; $("prom-mais").hidden = true; return; }
    $("prom-lista").innerHTML = r.slice(0, pLim).map(function (a) {
      var p = a[0], x = a[1];
      return '<li class="pl-item" id="pr-' + esc(x.id) + '">' +
        '<div class="pl-item-top">' + chip(x.status) + '<span class="chip">' + esc(x.tema) + '</span></div>' +
        "<h3>" + esc(x.promessa) + "</h3>" +
        '<p class="pl-quem">' + (p.pessoa.id_politico ? '<a href="' + PERFIL + esc(p.pessoa.id_politico) + '">' + esc(p.pessoa.nome) + "</a>" : esc(p.pessoa.nome)) +
        " · " + esc(p.pessoa.partido) + " · " + esc(CARGO[p.cargo]) + (p.cargo !== "presidente" ? " (" + esc(p.uf) + ")" : "") + " · plano de " + p.ano + "</p>" +
        '<blockquote class="pl-trecho"><p>“' + esc(x.trecho) + '”</p><footer>Plano de governo, ' + ext(p.plano.divulga, "página " + x.pagina + " do PDF entregue ao TSE") + "</footer></blockquote>" +
        '<p class="pl-expl"><b>O que aconteceu:</b> ' + esc(x.explicacao) + "</p>" +
        '<ul class="pl-ev">' + x.evidencias.map(function (e) { return "<li>" + ext(e.url, esc(e.titulo)) + "</li>"; }).join("") + "</ul>" +
        '<p class="pl-rev">Revisado em ' + dataBR(x.revisado) + "</p></li>";
    }).join("");
    $("prom-mais").hidden = r.length <= pLim;
    $("prom-mais").textContent = "Mostrar mais (" + (r.length - pLim) + " restantes)";
  }

  function renderAvaliados() {
    $("planos-av").innerHTML = PLANOS.map(function (p) {
      var c = p.contagem, tot = p.promessas.length, pl = p.plano;
      var zipTam = ZIPS[p.ano + "_" + p.uf];
      return '<article class="pol-card pl-plano"><div class="pl-plano-top"><div><h3>' + esc(p.pessoa.nome) + '</h3><p class="muted">' +
        esc(CARGO[p.cargo]) + (p.cargo !== "presidente" ? " · " + esc(p.uf) : "") + " · eleito em " + p.ano + " · " + esc(p.pessoa.partido) + "</p></div>" +
        '<span class="chip">' + esc(mandatoTxt(p).replace("Mandato ", "")) + "</span></div>" +
        '<p class="pl-titulo">' + esc(pl.titulo) + (pl.paginas ? " · " + pl.paginas + " páginas" : "") + "</p>" +
        '<h4 class="h-sm">O que o plano prometia, em poucas palavras</h4><ul class="pl-resumo">' +
        p.resumo.map(function (r) { return "<li>" + esc(r.t) + ' <span class="pl-pg">p. ' + r.p + "</span></li>"; }).join("") + "</ul>" +
        (p.aviso_texto ? '<p class="note-sm">' + esc(p.aviso_texto) + "</p>" : "") +
        (p.mandato.nota ? '<p class="note-sm">' + esc(p.mandato.nota) + "</p>" : "") +
        barra(c, tot) + '<div class="pl-cts">' + contagemTxt(c) + "</div>" +
        '<div class="pl-acoes"><button type="button" class="btn btn-primary pl-ver" data-k="' + esc(planoKey(p)) + '">Ver as ' + tot + " promessas</button>" +
        ext(pl.divulga, "Plano no site do TSE", "btn btn-ghost") +
        (p.pessoa.id_politico ? '<a class="btn btn-ghost" href="' + PERFIL + esc(p.pessoa.id_politico) + '">Perfil</a>' : "") + "</div>" +
        '<p class="note-sm">Arquivo original: <span class="mono">' + esc(pl.arquivo) + "</span>, dentro do " + ext(pl.zip, "pacote de dados abertos do TSE" + (zipTam ? " (" + mb(zipTam) + ")" : "")) + ".</p></article>";
    }).join("");
  }

  function verPlano(k) {
    $("f-plano").value = k; $("f-status").value = ""; $("f-tema").value = ""; $("f-busca").value = "";
    pLim = pPag; renderPromessas();
    var s = $("promessas"); s.scrollIntoView({ behavior: "smooth", block: "start" }); s.focus({ preventScroll: true });
  }

  function initPromessas(d) {
    PROM = d; PLANOS = d.planos;
    PLANOS.forEach(function (p) { temPromessa[planoKey(p)] = true; });
    var tot = 0, cump = 0;
    PLANOS.forEach(function (p) { tot += p.promessas.length; cump += p.contagem.cumprida + p.contagem.parcialmente; });
    $("st-prom").textContent = num(tot);
    $("st-cump").textContent = num(cump) + " de " + num(tot);
    $("st-rev").textContent = dataBR(d.revisado);
    $("f-plano").insertAdjacentHTML("beforeend", PLANOS.map(function (p) { return '<option value="' + esc(planoKey(p)) + '">' + esc(planoNome(p)) + "</option>"; }).join(""));
    $("f-status").insertAdjacentHTML("beforeend", ST.map(function (s) { return '<option value="' + s + '">' + ST_TXT[s] + "</option>"; }).join(""));
    var temas = {};
    PLANOS.forEach(function (p) { p.promessas.forEach(function (x) { temas[x.tema] = 1; }); });
    $("f-tema").insertAdjacentHTML("beforeend", Object.keys(temas).sort(function (a, b) { return a.localeCompare(b, "pt"); }).map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + "</option>"; }).join(""));
    $("regras").innerHTML = ST.map(function (s) { return "<div><dt>" + chip(s) + "</dt><dd>" + ST_DESC[s] + "</dd></div>"; }).join("");
    renderPlacar(); renderAvaliados(); renderPromessas();
    var t = null;
    $("f-busca").addEventListener("input", function () { clearTimeout(t); t = setTimeout(function () { pLim = pPag; renderPromessas(); }, 160); });
    ["f-plano", "f-status", "f-tema"].forEach(function (id) { $(id).addEventListener("change", function () { pLim = pPag; renderPromessas(); }); });
    function limpar() { $("f-busca").value = ""; $("f-plano").value = ""; $("f-status").value = ""; $("f-tema").value = ""; pLim = pPag; renderPromessas(); }
    $("f-limpar").addEventListener("click", limpar);
    $("prom-lista").addEventListener("click", function (e) { if (e.target.closest("[data-limpar]")) limpar(); });
    $("prom-mais").addEventListener("click", function () { pLim += pPag; renderPromessas(); });
    document.addEventListener("click", function (e) { var b = e.target.closest(".pl-ver"); if (b) verPlano(b.getAttribute("data-k")); });
  }

  /* ------------------------------------------------------------ índice */
  var iRows = [], iPag = 50, iLim = iPag, prefCache = {};
  function linhaGeral(r) { // [ano,cargo,uf,nome_urna,nome,partido,numero,resultado,sq,arquivos,kb,id_politico]
    return { ano: r[0], cargo: r[1], uf: r[2], ue: r[2], local: r[1] === 1 ? "Brasil" : r[2], urna: r[3], nome: r[4], partido: r[5], numero: r[6], res: r[7], sq: r[8], arq: r[9], kb: r[10], id: r[11] };
  }
  function linhaPref(r, ano, uf) { // [ue_tse,ibge,municipio,nome_urna,partido,numero,resultado,sq,arquivos,kb,id_politico]
    return { ano: ano, cargo: 11, uf: uf, ue: r[0], local: r[2] + " (" + uf + ")", urna: r[3], nome: "", partido: r[4], numero: r[5], res: r[6], sq: r[7], arq: r[8], kb: r[9], id: r[10] };
  }
  function linhaCap(r) { // [ano,uf,ue_tse,ibge,municipio,nome_urna,partido,numero,resultado,sq,arquivos,kb,id_politico]
    return { ano: r[0], cargo: 11, uf: r[1], ue: r[2], local: r[4] + " (" + r[1] + ")", urna: r[5], nome: "", partido: r[6], numero: r[7], res: r[8], sq: r[9], arq: r[10], kb: r[11], id: r[12] };
  }

  function setAnos() {
    var c = $("i-cargo").value, sel = $("i-ano"), uf = $("i-uf").value, cur = sel.value;
    var anos = c === "11" ? MUNIC : GERAIS;
    var todas = c !== "11" || uf === "CAP";
    sel.innerHTML = (todas ? '<option value="">Todas</option>' : "") + anos.map(function (a) { return '<option value="' + a + '">' + a + "</option>"; }).join("");
    if (cur && anos.indexOf(+cur) >= 0) sel.value = cur; else sel.value = c === "11" && !todas ? String(anos[0]) : (c === "11" ? String(anos[0]) : "");
  }
  function setUFs() {
    var c = $("i-cargo").value, sel = $("i-uf"), cur = sel.value;
    if (c === "1") { sel.innerHTML = '<option value="BR">Brasil</option>'; sel.disabled = true; return; }
    sel.disabled = false;
    sel.innerHTML = (c === "11" ? '<option value="CAP">Só as capitais</option>' : '<option value="">Todos</option>') + UFS.map(function (u) { return '<option value="' + u + '">' + u + "</option>"; }).join("");
    if (cur && sel.querySelector('option[value="' + cur + '"]')) sel.value = cur;
  }

  function carregarIndice() {
    var c = $("i-cargo").value, ano = $("i-ano").value, uf = $("i-uf").value;
    if (c !== "11") {
      iRows = GER.rows.filter(function (r) { return String(r[1]) === c; }).map(linhaGeral);
      return Promise.resolve();
    }
    var key = uf === "CAP" ? "cap" : ano + "/" + uf;
    if (prefCache[key]) { iRows = prefCache[key]; return Promise.resolve(); }
    $("idx-body").innerHTML = '<tr><td colspan="5"><div class="skeleton" style="height:120px"></div></td></tr>';
    var url = uf === "CAP" ? D + "pref/capitais.json" : D + "pref/" + ano + "/" + uf + ".json";
    return getJSON(url).then(function (d) {
      prefCache[key] = uf === "CAP" ? d.rows.map(linhaCap) : d.rows.map(function (r) { return linhaPref(r, +ano, uf); });
      if (d.zip) ZIPS[ano + "_" + uf] = d.zip;
      iRows = prefCache[key];
    });
  }

  function setPartidos(rows) {
    var sel = $("i-partido"), cur = sel.value, ps = {};
    rows.forEach(function (r) { ps[r.partido] = 1; });
    var l = Object.keys(ps).sort();
    sel.innerHTML = '<option value="">Todos</option>' + l.map(function (p) { return '<option value="' + esc(p) + '">' + esc(p) + "</option>"; }).join("");
    if (ps[cur]) sel.value = cur;
  }

  function renderIndice() {
    var c = $("i-cargo").value, ano = $("i-ano").value, uf = $("i-uf").value, par = $("i-partido").value, res = $("i-res").value, q = norm($("i-nome").value.trim());
    var base = iRows.filter(function (r) {
      if (ano && String(r.ano) !== ano) return false;
      if (c === "3" && uf && r.uf !== uf) return false;
      return true;
    });
    setPartidos(base);
    par = $("i-partido").value;
    var rows = base.filter(function (r) {
      if (par && r.partido !== par) return false;
      if (res && res.indexOf(r.res) < 0) return false;
      if (q && norm(r.urna + " " + r.nome + " " + r.local).indexOf(q) < 0) return false;
      return true;
    });
    var comPlano = rows.filter(function (r) { return r.arq && r.arq.length; }).length;
    $("idx-conta").textContent = num(rows.length) + (rows.length === 1 ? " candidatura" : " candidaturas") + " · " + num(comPlano) + " com plano no arquivo do TSE.";
    if (!rows.length) { $("idx-body").innerHTML = '<tr><td colspan="5">Nenhuma candidatura com esses filtros.</td></tr>'; $("idx-mais").hidden = true; return; }
    $("idx-body").innerHTML = rows.slice(0, iLim).map(function (r) {
      var eid = DIV[r.ano], ue = r.cargo === 1 ? "BR" : r.cargo === 3 ? r.uf : r.ue;
      var dv = eid ? DIVULGA + r.ano + "/" + eid + "/" + ue + "/" + r.sq : "";
      var nm = esc(r.urna) + (r.nome && norm(r.nome) !== norm(r.urna) ? '<span class="pl-civil">' + esc(r.nome) + "</span>" : "");
      var plano;
      if (r.arq && r.arq.length) {
        plano = (dv ? ext(dv, "Abrir no TSE") : "") + '<span class="pl-arq">' + r.arq.map(esc).join(", ") + (r.kb ? " · " + num(r.kb) + " KB" : "") + "</span>";
      } else {
        plano = '<span class="muted">Não está no arquivo do TSE.</span>' + (dv ? " " + ext(dv, "Conferir no TSE") : "");
      }
      var k = r.ano + "-" + (r.cargo === 1 ? "BR" : r.uf) + "-" + r.sq;
      if (temPromessa[k]) plano += ' <button type="button" class="linkish pl-ver" data-k="' + esc(k) + '">Ver promessas acompanhadas</button>';
      return "<tr><td>" + r.ano + (r.cargo === 1 ? "" : " · " + esc(r.local)) + "</td>" +
        '<td class="pl-cand">' + (r.id ? '<a href="' + PERFIL + esc(r.id) + '">' + nm + "</a>" : nm) + "</td>" +
        "<td>" + esc(r.partido) + " " + esc(r.numero) + "</td>" +
        '<td><span class="pl-res res-' + esc(r.res) + '"' + (RES_TIT[r.res] ? ' title="' + esc(RES_TIT[r.res]) + '"' : "") + ">" + esc(RES[r.res] || r.res) + "</span></td>" +
        '<td class="pl-plano-cel">' + plano + "</td></tr>";
    }).join("");
    $("idx-mais").hidden = rows.length <= iLim;
    $("idx-mais").textContent = "Mostrar mais (" + num(rows.length - iLim) + " restantes)";
    var nota = "O PDF de cada plano fica na página da candidatura no TSE. Também dá para baixar o pacote do ano inteiro nos dados abertos do TSE";
    var zk = c === "1" ? (ano || "2022") + "_BR" : c === "3" && uf ? (ano || "2022") + "_" + uf : c === "11" && uf !== "CAP" ? ano + "_" + uf : null;
    if (zk && ZIPS[zk]) nota += ": " + ext(ZIP + zk + ".zip", "pacote " + zk.replace("_", " ") + " (" + mb(ZIPS[zk]) + ")") + ".";
    else nota += " (um pacote por ano e estado).";
    if (c === "11" && uf === "CAP") nota += " Mostrando só as capitais; escolha um estado para ver todas as cidades.";
    if (ano === "2026" || (!ano && c !== "11")) nota += " Eleição de 2026: o 2º turno é em 25/10/2026; o resultado final ainda não saiu.";
    $("idx-nota").innerHTML = nota;
  }

  function atualizarIndice(reset) {
    if (reset) iLim = iPag;
    return carregarIndice().then(renderIndice).catch(function () { erro($("idx-body").parentNode.parentNode, "Não foi possível carregar o índice agora. Tente recarregar a página."); });
  }

  function initIndice() {
    DIV = GER.divulga || {}; ZIPS = GER.zip || {};
    var g = META.gerais, n = 0;
    Object.keys(g).forEach(function (k) { n += g[k][1]; });
    $("st-planos").textContent = num(n);
    setUFs(); setAnos();
    $("i-cargo").addEventListener("change", function () { setUFs(); setAnos(); atualizarIndice(true); });
    $("i-uf").addEventListener("change", function () { setAnos(); atualizarIndice(true); });
    $("i-ano").addEventListener("change", function () { atualizarIndice(true); });
    ["i-partido", "i-res"].forEach(function (id) { $(id).addEventListener("change", function () { iLim = iPag; renderIndice(); }); });
    var t = null;
    $("i-nome").addEventListener("input", function () { clearTimeout(t); t = setTimeout(function () { iLim = iPag; renderIndice(); }, 160); });
    $("idx-mais").addEventListener("click", function () { iLim += iPag; renderIndice(); });
    atualizarIndice(true);
  }

  function renderAntes() {
    $("antes-body").innerHTML = ANTES.map(function (a) {
      return "<tr><td>" + a[0] + "</td><td>" + (a[3] ? '<a href="' + PERFIL + a[3] + '">' + esc(a[1]) + "</a>" : esc(a[1])) + " (" + esc(a[2]) + ')</td><td><span class="muted">Não há plano oficial arquivado no TSE</span></td></tr>';
    }).join("");
  }

  function renderFontes() {
    var f = (META.fontes || []).concat([
      ["Planalto — Legislação federal (leis, decretos e emendas citados nas avaliações)", "https://www.planalto.gov.br/ccivil_03/"],
      ["Câmara dos Deputados — tramitação de propostas", "https://www.camara.leg.br/busca-portal/proposicoes/pesquisa-simplificada"],
      ["Senado Federal — tramitação de propostas", "https://www25.senado.leg.br/web/atividade/materias"]
    ]);
    $("fontes-list").innerHTML = f.map(function (x) { return "<li>" + ext(x[1], esc(x[0])) + "</li>"; }).join("");
    var semPlano = 0, tot = 0;
    Object.keys(META.prefeitos || {}).forEach(function (k) { tot += META.prefeitos[k][0]; semPlano += META.prefeitos[k][0] - META.prefeitos[k][1]; });
    $("fontes-gaps").innerHTML = "Limites: o índice de prefeitos tem " + num(tot) + " candidaturas (2012 a 2024); " + num(semPlano) +
      " não têm PDF no pacote do TSE (por exemplo, o pacote de 2012 do Rio Grande do Norte veio quase vazio). Quando o plano não está no pacote, a página oficial da candidatura no TSE ainda pode ter o documento. Índice gerado em " + dataBR(META.geradoEm) + ".";
  }

  function init() {
    var y = $("year"); if (y && !y.textContent) y.textContent = new Date().getFullYear();
    renderAntes();
    getJSON(D + "promessas/index.json").then(initPromessas).catch(function () {
      erro($("placar"), "Não foi possível carregar as promessas agora. Tente recarregar a página.");
      erro($("prom-lista"), ""); erro($("planos-av"), "");
    });
    Promise.all([getJSON(D + "meta.json"), getJSON(D + "gerais.json")]).then(function (a) {
      META = a[0]; GER = a[1]; initIndice(); renderFontes();
    }).catch(function () { erro($("idx-body").parentNode.parentNode, "Não foi possível carregar o índice agora. Tente recarregar a página."); });
  }
  init();
})();
