/* politica/propostas/propostas.js — catálogo de propostas (dados em ../data/propostas/) */
(function () {
  "use strict";
  var D = "../data/propostas/";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var norm = function (s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); };
  var nf = function (n) { return Number(n || 0).toLocaleString("pt-BR"); };
  var dBR = function (iso) { if (!iso) return ""; var p = String(iso).slice(0, 10).split("-"); return p.length < 3 ? iso : p[2] + "/" + p[1] + "/" + p[0]; };
  var sentenca = function (s) { var t = String(s || "").trim(); return t && !/[.!?…]$/.test(t) ? t + "." : t; };
  var ext = function (url, txt) { return '<a class="ext" href="' + esc(url) + '" target="_blank" rel="noreferrer">' + esc(txt) + " ↗</a>"; };
  function getJSON(u) { return fetch(u, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(u + " → HTTP " + r.status); return r.json(); }); }
  var PS = window.PolSimples || {}, SIMP = window.PolSimplifica || null;

  var TIPOS = {
    PL: ["Projeto de lei", "um projeto de lei: proposta para criar ou mudar uma lei", "m"],
    PLS: ["Projeto de lei do Senado", "um projeto de lei apresentado no Senado (sigla usada até 2018): proposta para criar ou mudar uma lei", "m"],
    PLP: ["Projeto de lei complementar", "um projeto de lei complementar: lei especial que detalha regras da Constituição e precisa de mais votos (maioria absoluta)", "m"],
    PEC: ["Proposta de emenda à Constituição", "uma proposta para mudar a Constituição; precisa de 3/5 dos votos, em dois turnos, na Câmara e no Senado", "f"],
    MPV: ["Medida provisória", "uma medida provisória: regra do presidente da República que já vale assim que é publicada e precisa ser aprovada pelo Congresso em até 120 dias", "f"],
    PLV: ["Projeto de lei de conversão", "um projeto de lei de conversão: o texto de uma medida provisória depois de modificado pelo Congresso", "m"],
    PDC: ["Projeto de decreto legislativo (Câmara)", "um projeto de decreto legislativo: decisão que cabe só ao Congresso, sem sanção do presidente (por exemplo, aprovar tratados ou suspender atos do governo)", "m"],
    PDL: ["Projeto de decreto legislativo", "um projeto de decreto legislativo: decisão que cabe só ao Congresso, sem sanção do presidente (por exemplo, aprovar tratados ou suspender atos do governo)", "m"],
    PDS: ["Projeto de decreto legislativo (Senado)", "um projeto de decreto legislativo apresentado no Senado: decisão que cabe só ao Congresso, sem sanção do presidente", "m"],
    PRS: ["Projeto de resolução do Senado", "um projeto de resolução do Senado: trata de assuntos internos ou exclusivos do Senado, como autorizar empréstimos de estados e municípios", "m"],
    PLN: ["Projeto de lei do Congresso Nacional", "um projeto de lei do Congresso Nacional, em geral sobre o Orçamento da União, votado pelos deputados e senadores juntos", "m"]
  };
  var SIT_CLS = { L: "ok", T: "neutral", A: "neutral", R: "no", X: "neutral", E: "no", V: "no", N: "neutral", F: "neutral", "?": "neutral" };
  var SIT_CURTA = { L: "Virou lei", T: "Em andamento", A: "Arquivada", R: "Rejeitada ou prejudicada", X: "Retirada ou devolvida", E: "Perdeu a validade", V: "Vetada por inteiro", N: "Virou outra proposta", F: "Tramitação encerrada", "?": "Sem situação informada" };

  var S = { origemNorma: {}, idx: null, autores: [], extras: null, resumos: {}, nRes: 0, normas: {}, deps: {}, sens: {}, shards: {}, loading: {}, res: [], shown: 0, run: 0, only: null };
  var PAGE = 30;

  /* ---------- autoria ---------- */
  var titulo = function (s) {
    if (s !== s.toUpperCase()) return s;
    return s.toLowerCase().replace(/(^|[\s'-])(\S)/g, function (m, a, b) { return a + b.toUpperCase(); }).replace(/\b(Da|De|Do|Das|Dos|E)\b/g, function (m) { return m.toLowerCase(); });
  };
  function pessoa(i) {
    var a = S.autores[i]; if (!a) return "";
    var nome = titulo(a[0]), t = a[1], id = a[2], pu = a[3] ? " (" + esc(a[3]) + (a[4] ? "-" + esc(a[4]) : "") + ")" : "";
    if (t === "E") return "<b>Poder Executivo</b> (Presidência da República)";
    if (t === "D" && id) {
      if (S.deps[id]) return '<a class="autor" href="/politica/#perfil/c/' + esc(id) + '/projetos">Dep. ' + esc(S.deps[id]) + "</a>" + pu;
      return '<a class="autor" href="https://www.camara.leg.br/deputados/' + esc(id) + '" target="_blank" rel="noreferrer">' + esc(nome) + "</a>" + pu;
    }
    if (t === "S" && id && S.sens[id]) return '<a class="autor" href="/politica/#perfil/s/' + esc(id) + '/projetos">Sen. ' + esc(S.sens[id]) + "</a>" + pu;
    return "<b>" + esc((t === "S" ? "Sen. " : "") + nome) + "</b>" + pu;
  }
  function autoria(it) {
    var a = it[4] || [], n = Math.max(it[5] || 0, a.length), x = it[10] || {};
    if (x.o && n <= a.length) n = a.length + 1;
    var g = (TIPOS[it[1]] || [])[2] === "f" ? "criada" : "criado";
    if (it[1] === "MPV") return "editada pelo <b>Poder Executivo</b> (Presidência da República)";
    if (!a.length) return "";
    var s = g + " por " + pessoa(a[0]);
    if (n === 2 && a[1] != null) s += " e " + pessoa(a[1]);
    else if (n > 1) s += " e mais " + nf(n - 1) + (n - 1 === 1 ? " autor" : " autores");
    return s;
  }

  /* ---------- cartão ---------- */
  function resumoDe(it) { var h = S.resumos[it[0]]; return h && h.ps ? h : null; }
  function cartao(it, ano) {
    var x = it[10] || {}, sig = it[1] + " " + it[2] + "/" + ano, rs = resumoDe(it), ps, cf, auto = !rs;
    var tp = TIPOS[it[1]];
    if (rs) { ps = rs.ps; cf = rs.cf || "O texto oficial disponível não deixa claro como a proposta funcionaria na prática. Veja o texto oficial abaixo."; }
    else {
      var a = SIMP ? SIMP.simplificar(it[9], it[1]) : null;
      ps = (a && a.ps) || it[9];
      var lc = SIMP ? SIMP.leisCitadas(it[9]).filter(function (l) { return l.nome && ps.indexOf(l.nome) < 0; }).map(function (l) { return l.nome; }) : [];
      cf = [tp ? "É " + tp[1] + "." : "", lc.length ? "Pelo resumo oficial, mexe em " + lc.join(" e ") + "." : "", "Este resumo automático usa só a ementa oficial; para conhecer os detalhes de como funcionaria, veja o texto oficial."].filter(Boolean).join(" ");
    }
    var stTxt = S.idx.situacoes[it[8]] || "";
    var simples = (PS.statusSimples && stTxt) ? PS.statusSimples(stTxt) : "";
    var codTxt = S.idx.codigos[it[7]] || "";
    var sit;
    if (it[7] === "T" || it[7] === "?") sit = simples || sentenca(codTxt) || "Sem situação informada.";
    else if (it[7] === "L") sit = /^Virou lei/.test(simples) ? simples : it[1] === "PEC" ? "Virou emenda à Constituição." : "Virou lei.";
    else sit = sentenca(codTxt);
    var ng = x.n ? " Gerou a " + esc(x.n) + "." : "";
    var temas = (it[6] || []).map(function (t) { return '<span class="chip tema">' + esc(S.idx.temas[t]) + "</span>"; }).join("");
    var casa = it[0].charAt(0), id = it[0].slice(2);
    var links = casa === "c"
      ? ext("https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=" + id, "Ficha de tramitação na Câmara") + (x.t ? " " + ext("https://www.camara.leg.br/proposicoesWeb/prop_mostrarintegra?codteor=" + x.t, "Texto completo (inteiro teor)") : "")
      : ext("https://www25.senado.leg.br/web/atividade/materias/-/materia/" + id, "Página da matéria no Senado (com o texto)");
    var nk = S.origemNorma[it[0]];
    if (nk) { var np = nk.slice(2).split("-"), nr = S.normas[nk]; links += " " + ext("https://normas.leg.br/?urn=urn:lex:br:federal:" + ({ LEI: "lei", LCP: "lei.complementar", EMC: "emenda.constitucional" })[np[0]] + ":" + nr.data + ";" + np[1], "Texto da lei que ela gerou"); }
    var autHTML = autoria(it);
    return '<li class="item prop-item" data-k="' + esc(it[0]) + '"><div class="pc pc-flat">' +
      '<div class="item-top"><span class="badge ' + (SIT_CLS[it[7]] || "neutral") + '">' + esc(SIT_CURTA[it[7]] || "") + '</span><span class="muted prop-casa">' + (casa === "c" ? "Câmara" : "Senado") + (it[3] ? " · " + dBR(it[3]) : "") + "</span></div>" +
      '<p class="pc-head"><b class="pc-sig">' + esc(sig) + "</b>" + (autHTML ? ", " + autHTML : "") + ".</p>" +
      "<p><b>Pra que serve:</b> " + esc(sentenca(ps)) + "</p>" +
      "<p><b>Como funciona:</b> " + esc(cf) + "</p>" +
      "<p><b>Situação:</b> " + esc(sit) + ng + (stTxt && simples === "" && stTxt !== codTxt ? ' <small class="muted">(' + esc(stTxt) + ")</small>" : "") + "</p>" +
      '<div class="pc-tags">' + temas + '<span class="tag' + (auto ? " auto" : "") + '">' + (auto ? "Resumo automático" : rs.lei ? "Resumo simplificado da lei gerada" : "Resumo simplificado") + "</span></div>" +
      (rs && rs.lei ? '<p class="note-sm">O resumo descreve a lei aprovada (' + esc(rs.lei) + '); o texto original da proposta pode ter sido diferente.</p>' : "") +
      '<details class="pc-oficial"><summary>Ver texto oficial</summary><p><span class="tag">Ementa oficial</span> ' + esc(it[9]) + "</p>" + (stTxt ? '<p class="note-sm">Situação registrada: ' + esc(stTxt) + "</p>" : "") + '<p class="prop-links">' + links + "</p></details>" +
      "</div></li>";
  }

  /* ---------- carregamento das fatias ---------- */
  function shard(ano) {
    if (S.shards[ano]) return Promise.resolve(S.shards[ano]);
    if (S.loading[ano]) return S.loading[ano];
    S.loading[ano] = getJSON(D + "anos/" + ano + ".json").then(function (d) {
      var it = d.itens || [];
      var hay = new Array(it.length);
      for (var i = 0; i < it.length; i++) { var r = it[i]; hay[i] = norm(r[1] + " " + r[2] + "/" + ano + " " + r[1] + r[2] + " " + r[9] + " " + ((r[10] && r[10].n) || "")); }
      S.shards[ano] = { ano: ano, itens: it, hay: hay };
      delete S.loading[ano];
      return S.shards[ano];
    });
    return S.loading[ano];
  }

  /* ---------- filtros ---------- */
  function filtros() {
    var aq = norm($("#f-autor").value), autSet = null;
    if (aq.length >= 3) {
      autSet = {};
      S.autores.forEach(function (a, i) { if (norm(a[0]).indexOf(aq) >= 0) autSet[i] = 1; });
    }
    return { q: norm($("#f-q").value), ano: $("#f-ano").value, tipo: $("#f-tipo").value, sit: $("#f-sit").value, tema: $("#f-tema").value, casa: $("#f-casa").value, aut: autSet, part: $("#f-part").value, uf: $("#f-uf").value, res: $("#f-res").checked, ord: $("#f-ord").value };
  }
  function passa(f, it, hay) {
    if (S.only) return it[0] === S.only;
    if (f.tipo && it[1] !== f.tipo) return false;
    if (f.sit && it[7] !== f.sit) return false;
    if (f.casa && it[0].charAt(0) !== f.casa) return false;
    if (f.tema !== "" && (it[6] || []).indexOf(+f.tema) < 0) return false;
    if (f.res && !S.resumos[it[0]]) return false;
    var a = it[4] || [];
    if (f.aut && !a.some(function (i) { return f.aut[i]; })) return false;
    if (f.part && !a.some(function (i) { return S.autores[i] && S.autores[i][3] === f.part; })) return false;
    if (f.uf && !a.some(function (i) { return S.autores[i] && S.autores[i][4] === f.uf; })) return false;
    if (f.q) { var ws = f.q.split(" "); for (var k = 0; k < ws.length; k++) if (hay.indexOf(ws[k]) < 0) return false; }
    return true;
  }
  function anosAlvo(f) {
    var todos = Object.keys(S.idx.anos).map(Number).sort(function (a, b) { return b - a; });
    if (f.ano !== "todos") return [+f.ano];
    var set = null;
    var lim = function (anos) { var o = {}; anos.forEach(function (y) { o[y] = 1; }); set = set ? Object.keys(set).reduce(function (m, y) { if (o[y]) m[y] = 1; return m; }, {}) : o; };
    if (f.aut && S.extras) { var ys = {}; Object.keys(f.aut).forEach(function (i) { (S.extras.autoresAnos[i] || "").split(" ").forEach(function (y) { if (y) ys[y] = 1; }); }); lim(Object.keys(ys).map(Number)); }
    if (f.res && S.extras) { var ry = {}; Object.keys(S.extras.resumoAnos).forEach(function (k) { ry[S.extras.resumoAnos[k]] = 1; }); lim(Object.keys(ry).map(Number)); }
    var out = set ? todos.filter(function (y) { return set[y]; }) : todos;
    return f.ord === "a" ? out.reverse() : out;
  }
  function busca() {
    var run = ++S.run, f = filtros(), anos = anosAlvo(f), total = anos.length, feitos = 0;
    S.res = []; S.shown = 0;
    $("#lista").innerHTML = ""; $("#mais").hidden = true;
    var prog = $("#prog"), bar = prog.querySelector("span");
    prog.hidden = total < 2; bar.style.width = "0%";
    if (!total) { fim(f, true); return; }
    $("#count").textContent = "Carregando…";
    var proximo = function (i) {
      if (run !== S.run) return;
      if (i >= anos.length) { prog.hidden = true; fim(f, true); return; }
      shard(anos[i]).then(function (sh) {
        if (run !== S.run) return;
        var it = sh.itens, hay = sh.hay, add = [];
        for (var k = 0; k < it.length; k++) if (passa(f, it[k], hay[k])) add.push([it[k], sh.ano]);
        if (f.ord === "a") add.reverse();
        S.res = S.res.concat(add);
        feitos++; bar.style.width = (feitos / total * 100).toFixed(1) + "%";
        if (total > 1) $("#count").textContent = nf(S.res.length) + " encontradas até agora · lendo " + sh.ano + " (" + feitos + " de " + total + " anos)";
        if (S.shown < PAGE && f.ord !== "r") mais();
        proximo(i + 1);
      }).catch(function (e) { console.warn(e); if (run === S.run) { $("#count").innerHTML = '<span class="err">Não foi possível carregar ' + esc(anos[i]) + ". " + '<a href="">Tentar de novo</a></span>'; prog.hidden = true; } });
    };
    proximo(0);
  }
  function fim(f, done) {
    if (f.ord === "r") { S.res.sort(function (a, b) { return (S.resumos[b[0][0]] ? 1 : 0) - (S.resumos[a[0][0]] ? 1 : 0); }); S.shown = 0; $("#lista").innerHTML = ""; mais(); }
    else if (S.shown === 0) mais();
    var n = S.res.length;
    var anoTxt = f.ano === "todos" ? "desde 1988" : "em " + f.ano;
    $("#count").innerHTML = S.only ? "Mostrando a proposta do link. <button type=\"button\" class=\"linkish\" id=\"ver-todas\">Ver todas as propostas</button>" : nf(n) + (n === 1 ? " proposta encontrada " : " propostas encontradas ") + anoTxt + ".";
    if (!n) $("#lista").innerHTML = '<li class="note">Nenhuma proposta encontrada com esses filtros. Tente outro ano, “Todos os anos” ou menos filtros.</li>';
    var b = $("#ver-todas"); if (b) b.addEventListener("click", function () { S.only = null; history.replaceState(null, "", location.pathname); busca(); });
  }
  function mais() {
    var part = S.res.slice(S.shown, S.shown + PAGE);
    if (part.length) $("#lista").insertAdjacentHTML("beforeend", part.map(function (r) { return cartao(r[0], r[1]); }).join(""));
    S.shown += part.length;
    var b = $("#mais"); b.hidden = S.shown >= S.res.length;
    b.textContent = "Mostrar mais (" + nf(S.res.length - S.shown) + " restantes)";
  }

  /* ---------- montagem dos filtros ---------- */
  function montar() {
    var I = S.idx, anos = Object.keys(I.anos).map(Number).sort(function (a, b) { return b - a; });
    var tot = 0, lei = 0, tipos = {};
    anos.forEach(function (y) { var a = I.anos[y]; tot += a.n; lei += (a.sit && a.sit.L) || 0; Object.keys(a.tipos || {}).forEach(function (t) { tipos[t] = (tipos[t] || 0) + a.tipos[t]; }); });
    $("#st-total").textContent = nf(tot); $("#st-lei").textContent = nf(lei);
    $("#st-upd").textContent = (I.atualizado || "").replace(/^(\d{4})-(\d\d)-(\d\d)/, "$3/$2/$1");
    $("#f-ano").innerHTML = anos.map(function (y) { return '<option value="' + y + '">' + y + " (" + nf(I.anos[y].n) + ")</option>"; }).join("") + '<option value="todos">Todos os anos (' + anos[anos.length - 1] + "–" + anos[0] + ", carrega aos poucos)</option>";
    $("#f-tipo").innerHTML = '<option value="">Todos os tipos</option>' + Object.keys(tipos).sort(function (a, b) { return tipos[b] - tipos[a]; }).map(function (t) { return '<option value="' + t + '">' + t + (TIPOS[t] ? " — " + TIPOS[t][0] : "") + " (" + nf(tipos[t]) + ")</option>"; }).join("");
    $("#f-sit").innerHTML = '<option value="">Todas</option>' + Object.keys(I.codigos).map(function (k) { return '<option value="' + esc(k) + '">' + esc(I.codigos[k]) + "</option>"; }).join("");
    $("#f-tema").innerHTML = '<option value="">Todos os temas</option>' + I.temas.map(function (t, i) { return '<option value="' + i + '">' + esc(t) + "</option>"; }).join("");
    if (S.extras) {
      var P = S.extras.partidos, U = S.extras.ufs;
      $("#f-part").innerHTML = '<option value="">Todos</option>' + Object.keys(P).filter(function (p) { return P[p] >= 20; }).sort().map(function (p) { return '<option value="' + esc(p) + '">' + esc(p) + "</option>"; }).join("");
      $("#f-uf").innerHTML = '<option value="">Todos</option>' + Object.keys(U).filter(function (u) { return /^[A-Z]{2}$/.test(u); }).sort().map(function (u) { return '<option value="' + u + '">' + u + "</option>"; }).join("");
    }
    // datalist com parlamentares atuais + Poder Executivo (digitar qualquer nome também funciona)
    var dl = Object.keys(S.deps).map(function (k) { return S.deps[k]; }).concat(Object.keys(S.sens).map(function (k) { return S.sens[k]; })).sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });
    $("#f-autores").innerHTML = ['Poder Executivo'].concat(dl).map(function (n) { return '<option value="' + esc(n) + '"></option>'; }).join("");
    if (window.matchMedia && matchMedia("(min-width: 901px)").matches) $("#f-more").open = true;
    var tm;
    var re = function () { S.only = null; clearTimeout(tm); tm = setTimeout(busca, 250); };
    ["#f-q", "#f-autor"].forEach(function (s) { $(s).addEventListener("input", re); });
    ["#f-ano", "#f-tipo", "#f-sit", "#f-tema", "#f-casa", "#f-part", "#f-uf", "#f-ord", "#f-res"].forEach(function (s) { $(s).addEventListener("change", re); });
    $("#f-limpa").addEventListener("click", function () { $("#f").reset(); $("#f-ano").value = String(anos[0]); re(); });
    $("#mais").addEventListener("click", mais);
    // link direto: #id=c:123&ano=2019
    var h = new URLSearchParams(location.hash.slice(1));
    if (h.get("id") && h.get("ano") && I.anos[h.get("ano")]) { S.only = h.get("id"); $("#f-ano").value = h.get("ano"); }
    else if (h.get("ano") && I.anos[h.get("ano")]) $("#f-ano").value = h.get("ano");
    else $("#f-ano").value = String(anos[0]);
    busca();
    if (S.only) setTimeout(function () { $("#buscar").scrollIntoView(); }, 50);
    tabela(anos);
    fontes(tot);
  }
  function tabela(anos) {
    var I = S.idx, oth = function (s) { var t = 0; Object.keys(s || {}).forEach(function (k) { if ("LTA".indexOf(k) < 0) t += s[k]; }); return t; };
    $("#anos").insertAdjacentHTML("beforeend", "<thead><tr><th>Ano</th><th>Total</th><th>Câmara</th><th>Senado</th><th>Viraram lei</th><th>Em andamento</th><th>Arquivadas</th><th>Outras situações</th></tr></thead><tbody>" +
      anos.map(function (y) { var a = I.anos[y], s = a.sit || {}; return '<tr><th scope="row"><button type="button" class="linkish" data-ano="' + y + '">' + y + "</button></th><td>" + nf(a.n) + "</td><td>" + nf(a.c) + "</td><td>" + nf(a.s) + "</td><td>" + nf(s.L) + "</td><td>" + nf(s.T) + "</td><td>" + nf(s.A) + "</td><td>" + nf(oth(s)) + "</td></tr>"; }).join("") + "</tbody>");
    $("#anos").addEventListener("click", function (e) { var b = e.target.closest("[data-ano]"); if (!b) return; S.only = null; $("#f-ano").value = b.getAttribute("data-ano"); busca(); $("#buscar").scrollIntoView({ behavior: "smooth" }); });
  }
  function fontes(tot) {
    var I = S.idx, om = 0; Object.keys(I.omitidos || {}).forEach(function (y) { om += I.omitidos[y]; });
    var card = function (t, itens) { return '<div class="pol-card"><h3>' + esc(t) + "</h3><ul>" + itens.map(function (x) { return "<li>" + (x[1] ? ext(x[1], x[0]) : esc(x[0])) + "</li>"; }).join("") + "</ul></div>"; };
    $("#fontes-list").innerHTML =
      card("Dados", (I.fontes || []).map(function (f) { return [f.nome, f.url]; }).concat([["Atualizado em " + (I.atualizado || "—") + " (Brasília). " + nf(tot) + " propostas de 1988 a hoje.", ""]])) +
      card("O que entra", (I.notas || []).map(function (n) { return [n, ""]; }).concat([[nf(om) + " decretos legislativos de rádio e TV ficaram de fora.", ""]])) +
      card("Resumos", [["Resumos simplificados: escritos à mão a partir do texto oficial (ementa, resumo detalhado e, quando preciso, o texto completo). " + nf(S.nRes) + " propostas e " + nf(Object.keys(S.normas).filter(function (k) { return k.indexOf("n:") === 0; }).length) + " leis têm resumo à mão.", ""], ["Resumos automáticos: a ementa oficial reorganizada por regras fixas; não interpretam nem acrescentam nada.", ""], ["A situação é a registrada pela Câmara ou pelo Senado; para MPs, a decisão final do Congresso (dados do Senado).", ""]]) +
      card("Limites", [["Propostas muito antigas podem não ter autoria, tema ou situação nos dados abertos.", ""], ["Projetos que passaram pelas duas Casas aparecem uma vez em cada (com o número de cada Casa).", ""], ["A data mostrada é a data de apresentação registrada pela Casa; no Senado, para projetos que voltaram da Câmara, pode ser a data de chegada.", ""]]);
  }

  /* ---------- destaques (leis com resumo à mão) ---------- */
  function destaques() {
    var ks = Object.keys(S.normas).filter(function (k) { return k.indexOf("n:") === 0; });
    var TN = { LEI: "Lei", LCP: "Lei Complementar", EMC: "Emenda Constitucional" }, URN = { LEI: "lei", LCP: "lei.complementar", EMC: "emenda.constitucional" };
    ks.sort(function (a, b) { return (S.normas[b].data || "").localeCompare(S.normas[a].data || ""); });
    var html = ks.map(function (k) {
      var r = S.normas[k], p = k.slice(2).split("-"), n = +p[1];
      var sig = TN[p[0]] + " nº " + (n >= 1000 ? n.toLocaleString("pt-BR") : n) + "/" + p[2];
      var org = r.origem ? (function () { var m = /\/(\d{4})/.exec(r.origem[1]); return m ? ' · veio de <a href="#id=' + esc(r.origem[0]) + "&ano=" + m[1] + '" data-dl="1">' + esc(r.origem[1]) + "</a>" : " · veio de " + esc(r.origem[1]); })() : "";
      return '<li class="pc prop-dest-item" data-h="' + esc(norm(r.nome + " " + sig + " " + r.ps + " " + r.cf)) + '"><p class="pc-head"><b class="pc-sig">' + esc(r.nome) + '</b> <span class="muted">· ' + esc(sig) + "</span></p>" +
        "<p><b>Pra que serve:</b> " + esc(r.ps) + "</p><p><b>Como funciona:</b> " + esc(r.cf) + "</p>" +
        '<p class="note-sm"><span class="tag">Resumo simplificado</span> ' + (r.data ? (p[0] === "EMC" ? "Promulgada em " : "Assinada em ") + dBR(r.data) : "") + org + " · " + ext("https://normas.leg.br/?urn=urn:lex:br:federal:" + URN[p[0]] + ":" + r.data + ";" + n, "Ver texto oficial") + "</p></li>";
    }).join("");
    $("#dest").innerHTML = html;
    $("#d-q").addEventListener("input", function () { var q = norm(this.value); document.querySelectorAll("#dest > li").forEach(function (li) { li.hidden = q && li.getAttribute("data-h").indexOf(q) < 0; }); });
    $("#dest").addEventListener("click", function (e) {
      var a = e.target.closest("a[data-dl]"); if (!a) return;
      e.preventDefault(); var h = new URLSearchParams(a.getAttribute("href").slice(1));
      history.replaceState(null, "", a.getAttribute("href"));
      S.only = h.get("id"); $("#f-ano").value = h.get("ano"); busca(); $("#buscar").scrollIntoView({ behavior: "smooth" });
    });
  }
  window.addEventListener("hashchange", function () {
    var h = new URLSearchParams(location.hash.slice(1));
    if (h.get("id") && h.get("ano") && S.idx && S.idx.anos[h.get("ano")]) { S.only = h.get("id"); $("#f-ano").value = h.get("ano"); busca(); $("#buscar").scrollIntoView(); }
  });

  /* ---------- início ---------- */
  var opt = function (p) { return p.catch(function (e) { console.warn(e); return null; }); };
  Promise.all([getJSON(D + "indice.json"), getJSON(D + "autores.json"), opt(getJSON(D + "extras.json")), opt(getJSON("../data/resumos-simples.json")),
    opt(getJSON(D + "resumos/indice.json")), opt(getJSON("../data/deputados.json")), opt(getJSON("../data/senadores.json"))])
    .then(function (r) {
      S.idx = r[0]; S.autores = r[1].lista || []; S.extras = r[2];
      var hub = r[3] || {};
      Object.keys(hub).forEach(function (k) { var v = hub[k]; if (/^[cs]:/.test(k) && v) S.resumos[k] = typeof v === "string" ? { ps: v } : v; });
      (r[5] || []).forEach(function (d) { S.deps[String(d.id)] = d.n; });
      (r[6] || []).forEach(function (s) { S.sens[String(s.id)] = s.n; });
      var arqs = (r[4] && r[4].arquivos) || [];
      return Promise.all(arqs.map(function (a) { return opt(getJSON(D + "resumos/" + a)); })).then(function (fs) {
        fs.forEach(function (d) { if (!d) return; Object.keys(d).forEach(function (k) { if (k.charAt(0) === "_") return; if (/^n:/.test(k)) S.normas[k] = d[k]; else if (d[k] && d[k].ps) S.resumos[k] = d[k]; }); });
        // propostas que geraram leis explicadas à mão herdam o resumo da lei
        Object.keys(S.normas).forEach(function (k) { var r = S.normas[k]; if (r && r.origem && r.data) { S.origemNorma[r.origem[0]] = k; if (!S.resumos[r.origem[0]]) S.resumos[r.origem[0]] = { ps: r.ps, cf: r.cf, lei: r.nome }; } });
        S.nRes = Object.keys(S.resumos).length;
        $("#st-res").textContent = nf(S.nRes + Object.keys(S.normas).length);
        montar(); destaques();
      });
    })
    .catch(function (e) { console.warn(e); $("#count").innerHTML = '<span class="err">Não foi possível carregar o catálogo. <a href="">Tentar de novo</a></span>'; });
})();
