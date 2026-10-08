/* politica/leis/leis.js — leis curadas, votos nominais, "como votou fulano" e coerência */
(function () {
  "use strict";
  var D = "../data/leis/";
  var TEMAS = { direitos: "Direitos e família", consumidor: "Consumidor", saude: "Saúde", cultura: "Cultura", transparencia: "Transparência e corrupção",
    contas: "Contas públicas", assistencia: "Assistência social", economia: "Economia e impostos", seguranca: "Segurança e Justiça", educacao: "Educação",
    politica: "Eleições e política", infra: "Empresas, energia e cidades", ambiente: "Meio ambiente e terra", trabalho: "Trabalho e previdência", internet: "Internet e dados" };
  var VOTO = { S: "Sim", N: "Não", A: "Abstenção", O: "Obstrução", P: "Presidindo ou presente sem votar", X: "Não votou (ausente ou de licença)", V: "Votou (voto secreto)" };
  var VOTO_CURTO = { S: "Sim", N: "Não", A: "Abst.", O: "Obstr.", P: "Sem voto", X: "Ausente", V: "Secreto" };
  var CASA = { c: "Câmara", s: "Senado" };
  var UFS = "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(" ");
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var norm = function (s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); };
  var fmtD = function (d) { if (!d) return ""; var p = d.slice(0, 10).split("-"); return p[2] + "/" + p[1] + "/" + p[0]; };
  var num = function (n) { return (n || 0).toLocaleString("pt-BR"); };
  var perfil = function (id, nome) { return id ? '<a href="/politica/politicos/#p/' + esc(id) + '">' + esc(nome) + "</a>" : esc(nome); };
  var Y = document.getElementById("year"); if (Y) Y.textContent = new Date().getFullYear();

  var LEIS = [], BY = {}, PESSOAS = null, COER = null, COERC = null;
  function getJSON(u) { return fetch(u, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }

  function anoDe(L) { return L.data ? +L.data.slice(0, 4) : (L.votacoes && L.votacoes[0] ? +L.votacoes[0].dt.slice(0, 4) : null); }
  function temVoto(L, casa) { return (L.votacoes || []).some(function (v) { return v.casa === casa && !v.secreta; }); }

  getJSON(D + "leis.json").then(function (j) {
    LEIS = j.leis || [];
    LEIS.forEach(function (L) { BY[L.id] = L; L._ano = anoDe(L); L._q = norm([L.nome, L.normaTxt, L.muda, L.ementa, (L.tram || []).map(function (t) { return t.s; }).join(" "), (L.autores || []).map(function (a) { return a.n; }).join(" ")].join(" ")); });
    LEIS.sort(function (a, b) { return (b._ano || 0) - (a._ano || 0) || (b.data || "").localeCompare(a.data || ""); });
    $("#st-n").textContent = num(LEIS.length);
    $("#st-v").textContent = num(LEIS.filter(function (L) { return (L.votacoes || []).length; }).length);
    $("#st-d").textContent = (j.meta && j.meta.gerado || "").slice(0, 10).split("-").reverse().join("/");
    var temas = {}, govs = {}, anos = {};
    LEIS.forEach(function (L) { temas[L.tema] = 1; if (L.governo) govs[L.governo] = 1; if (L._ano) anos[L._ano] = 1; });
    $("#f-tema").insertAdjacentHTML("beforeend", Object.keys(temas).sort(function (a, b) { return (TEMAS[a] || a).localeCompare(TEMAS[b] || b); }).map(function (t) { return '<option value="' + t + '">' + esc(TEMAS[t] || t) + "</option>"; }).join(""));
    var gorder = ["Sarney", "Collor", "Itamar", "FHC (1º mandato)", "FHC (2º mandato)", "Lula (1º mandato)", "Lula (2º mandato)", "Dilma (1º mandato)", "Dilma (2º mandato)", "Temer", "Bolsonaro", "Lula (3º mandato)"];
    $("#f-gov").insertAdjacentHTML("beforeend", gorder.filter(function (g) { return govs[g]; }).map(function (g) { return '<option>' + esc(g) + "</option>"; }).join("") + '<option value="-">Não virou lei</option>');
    $("#f-ano").insertAdjacentHTML("beforeend", Object.keys(anos).sort().reverse().map(function (a) { return "<option>" + a + "</option>"; }).join(""));
    $("#f-ufpessoa").insertAdjacentHTML("beforeend", UFS.map(function (u) { return "<option>" + u + "</option>"; }).join(""));
    ["q", "f-tema", "f-gov", "f-ano", "f-casa"].forEach(function (id) { var el = document.getElementById(id); el.addEventListener(el.tagName === "INPUT" ? "input" : "change", renderList); });
    renderList();
    route();
    loadCoer();
  }).catch(function (e) {
    $("#leis-list").innerHTML = '<li class="err">Não foi possível carregar a lista de leis agora. Tente recarregar a página.</li>';
  });

  function renderList() {
    var q = norm($("#q").value.trim()), t = $("#f-tema").value, g = $("#f-gov").value, a = $("#f-ano").value, c = $("#f-casa").value;
    var out = LEIS.filter(function (L) {
      if (q && L._q.indexOf(q) < 0) return false;
      if (t && L.tema !== t) return false;
      if (g === "-" && L.norma) return false;
      if (g && g !== "-" && L.governo !== g) return false;
      if (a && String(L._ano) !== a) return false;
      if (c === "c" && !temVoto(L, "c")) return false;
      if (c === "s" && !temVoto(L, "s")) return false;
      if (c === "0" && (L.votacoes || []).length) return false;
      return true;
    });
    $("#leis-count").textContent = out.length === LEIS.length ? LEIS.length + " leis e propostas" : out.length + " de " + LEIS.length;
    $("#leis-list").innerHTML = out.map(function (L) {
      var nv = (L.votacoes || []).length;
      var chips = '<span class="chip tema">' + esc(TEMAS[L.tema] || L.tema) + "</span>" +
        (nv ? '<span class="chip casa">' + nv + (nv > 1 ? " votações nominais" : " votação nominal") + "</span>" : '<span class="chip">sem voto nominal publicado</span>');
      return '<li class="item lei-card"><div class="item-top"><span class="sig">' + esc(L.normaTxt || L.situacao || "") + "</span>" +
        (L.data ? "<span>" + fmtD(L.data) + "</span>" : "") + (L.governo ? "<span>Governo " + esc(L.governo) + "</span>" : (!L.norma ? '<span class="badge warn">Não virou lei</span>' : "")) + "</div>" +
        '<h3><a href="#lei/' + esc(L.id) + '">' + esc(L.nome) + "</a></h3><p>" + esc(L.muda) + '</p><div class="pc-tags">' + chips + "</div></li>";
    }).join("") || '<li class="state-empty">Nenhuma lei com esses filtros.</li>';
  }

  // ---------- detalhe ----------
  window.addEventListener("hashchange", route);
  function route() {
    var m = location.hash.match(/^#lei\/([\w-]+)/);
    var box = $("#detalhe");
    if (!m || !BY[m[1]]) { if (box && !box.hidden && !/^#lei\//.test(location.hash)) box.hidden = true; return; }
    showLei(BY[m[1]]);
  }
  function placar(t) {
    var tot = 0; "SNAOPXV".split("").forEach(function (k) { tot += t[k] || 0; });
    if (!tot) return "";
    var bar = "SNAOX".split("").map(function (k) { var v = (t[k] || 0) + (k === "X" ? (t.P || 0) : 0); return v ? '<span class="v-' + k + '" style="width:' + (100 * v / tot).toFixed(2) + '%"></span>' : ""; }).join("");
    var leg = "SNAOPXV".split("").filter(function (k) { return t[k]; }).map(function (k) { return '<span><i class="v-' + (k === "P" ? "X" : k === "V" ? "S" : k) + '"></i>' + esc(VOTO_CURTO[k]) + " " + t[k] + "</span>"; }).join("");
    return '<div class="placar"><div class="placar-bar" role="img" aria-label="Placar">' + bar + '</div><div class="placar-legend">' + leg + "</div></div>";
  }
  function partidos(pt) {
    var rows = Object.keys(pt || {}).map(function (p) { var a = pt[p]; return [p, a, a[0] + a[1] + a[2] + a[3]]; }).filter(function (r) { return r[2] > 0; }).sort(function (a, b) { return b[2] - a[2]; });
    if (!rows.length) return "";
    return '<details class="pc-oficial"><summary>Como votou cada partido</summary><ul class="partidos">' + rows.map(function (r) {
      var a = r[1], tot = a[0] + a[1] + a[2] + a[3] + a[5];
      return "<li><b>" + esc(r[0] || "s/ partido") + '</b><div><div class="stack">' + [0, 1, 2, 3, 5].map(function (i) { return a[i] ? '<i class="v-' + "SNAO_X"[i] + '" style="width:' + (100 * a[i] / tot).toFixed(1) + '%"></i>' : ""; }).join("") +
        '</div><small class="muted">Sim ' + a[0] + " · Não " + a[1] + (a[2] ? " · Abst. " + a[2] : "") + (a[3] ? " · Obstr. " + a[3] : "") + (a[5] ? " · Ausentes " + a[5] : "") + "</small></div></li>";
    }).join("") + "</ul></details>";
  }
  function orient(or) {
    var k = Object.keys(or || {});
    if (!k.length) return "";
    var g = { "Sim": [], "Não": [], "Liberado": [], "Obstrução": [] };
    k.forEach(function (p) { (g[or[p]] = g[or[p]] || []).push(p); });
    return '<p class="note-sm"><b>Orientação oficial dos partidos:</b> ' + Object.keys(g).filter(function (x) { return g[x].length; }).map(function (x) { return esc(x) + ": " + esc(g[x].join(", ")); }).join(" · ") + "</p>";
  }
  function votLabel(v) {
    var s = v.casa === "c" ? "Câmara" : "Senado";
    if (v.turno) s += " · " + v.turno + "º turno";
    if (v.emsen) s += " · emendas do Senado";
    return s;
  }
  function showLei(L) {
    var box = $("#detalhe"), c = $("#detalhe-box");
    var autores = (L.autores || []).filter(function (a) { return !a.co; });
    var co = (L.autores || []).filter(function (a) { return a.co; });
    var h = '<p class="lei-back"><a class="linkish" href="#lista">← Voltar para a lista</a></p>';
    h += '<div class="section-kicker">' + esc(L.normaTxt || L.situacao || "") + (L.data ? " · " + fmtD(L.data) : "") + (L.governo ? " · governo " + esc(L.governo) : "") + "</div>";
    h += '<h2 id="detalhe-title">' + esc(L.nome) + "</h2>";
    if (!L.norma && L.situacao) h += '<p class="note-sm"><span class="badge warn">Não virou lei</span> ' + esc(L.situacao) + "</p>";
    h += '<div class="pf-links">' + (L.planalto ? '<a href="' + esc(L.planalto) + '" target="_blank" rel="noreferrer">Texto oficial (Planalto) ↗</a>' : "") +
      (L.tram || []).map(function (t) { return '<a href="' + esc(t.url) + '" target="_blank" rel="noreferrer">' + esc(t.s) + " no " + (t.c === "c" ? "site da Câmara" : "site do Senado") + " ↗</a>"; }).join("") + "</div>";
    h += '<div class="simples"><p class="simples-h">O que muda, em palavras simples</p><p>' + esc(L.muda) + "</p>" + (L.ementa ? '<p class="oficial">Texto oficial (ementa): ' + esc(L.ementa) + "</p>" : "") + "</div>";
    h += '<div class="lei-side"><div class="lei-box"><h3>Quem ganha</h3><p>' + esc(L.ganha) + '</p></div><div class="lei-box"><h3>Quem paga o custo</h3><p>' + esc(L.custo) + "</p></div></div>";
    var args = function (arr) { return "<ul>" + (arr || []).map(function (a) { return '<li><span class="quem">' + esc(a[0]) + "</span>" + esc(a[1]) + "</li>"; }).join("") + "</ul>"; };
    h += '<div class="lei-side"><div class="lei-box arg-pro"><h3>Argumentos de quem defendeu</h3>' + args(L.favor) + '</div><div class="lei-box arg-con"><h3>Argumentos de quem criticou</h3>' + args(L.contra) + "</div></div>";
    var links = function (arr) { return (arr || []).map(function (e) { return "<li>" + esc(e[0]) + (e[1] ? ' <a class="linkish" href="' + esc(e[1]) + '"' + (/^https?:/.test(e[1]) ? ' target="_blank" rel="noreferrer"' : "") + ">fonte</a>" : "") + "</li>"; }).join(""); };
    if ((L.efeitos || []).length || (L.polemica || []).length || (L.vetos || []).length) {
      h += '<div class="lei-box" style="margin-top:12px"><h3>Efeitos, polêmicas e vetos</h3><ul>' + links(L.efeitos) + links(L.polemica) +
        (L.vetos || []).map(function (v) { return "<li>Veto do presidente (" + esc(v.id) + ")" + (v.sit ? ": " + esc(v.sit.toLowerCase()) : "") + ' <a class="linkish" href="' + esc(v.url) + '" target="_blank" rel="noreferrer">fonte</a></li>'; }).join("") + "</ul></div>";
    }
    h += '<div class="lei-box" style="margin-top:12px"><h3>Quem apresentou</h3><p>' + (autores.length ? autores.map(function (a) { return perfil(a.id, a.n) + (a.p ? " (" + esc(a.p) + (a.uf ? "-" + esc(a.uf) : "") + ")" : "") + (a.pr ? ' <small class="muted">· ' + esc(a.pr) + "</small>" : ""); }).join("; ") : "Autoria não informada nos dados abertos.") + "</p>" +
      (co.length ? '<details class="pc-oficial"><summary>' + co.length + " coautores</summary><p>" + co.map(function (a) { return perfil(a.id, a.n); }).join(", ") + "</p></details>" : "") + "</div>";
    // votações
    var vs = L.votacoes || [];
    h += '<h3 class="h-md">Como votaram</h3>';
    if (!vs.length) {
      h += '<p class="err">Não há voto nominal (com o nome de cada parlamentar) desta lei nos dados abertos da Câmara e do Senado. Isso é comum antes de 2001 ou quando a votação foi simbólica (sem registro de nomes). Veja a tramitação no link oficial acima.</p>';
    } else {
      h += '<div class="voto-tools"><div class="field"><label for="uf-lei">Seu deputado ou senador votou? Escolha o estado</label><select id="uf-lei"><option value="">Escolha</option>' + UFS.map(function (u) { return "<option>" + u + "</option>"; }).join("") + '</select></div></div><div id="uf-res"></div>';
      h += '<ul class="items">' + vs.map(function (v, i) {
        return '<li class="item"><div class="item-top"><span class="sig">' + esc(votLabel(v)) + "</span><span>" + fmtD(v.dt) + "</span><span>" + esc(v.pr || "") + "</span>" +
          (v.ap ? '<span class="badge ok">Aprovado</span>' : '<span class="badge no">Rejeitado</span>') + (v.secreta ? '<span class="badge neutral">voto secreto</span>' : "") + "</div>" +
          "<p>" + esc((v.inf || v.d || "").replace(/\s+/g, " ").slice(0, 300)) + "</p>" + placar(v.t || {}) + partidos(v.pt) + orient(v.or) +
          (v.semAusentes ? '<p class="note-sm">A lista de quem estava em exercício nesse dia não veio da Câmara, então ausentes não aparecem.</p>' : "") +
          (v.secreta ? "" : '<p><button class="linkish" type="button" data-nomes="' + i + '">Ver os nomes</button></p><div class="nomes" id="nomes-' + i + '"></div>') +
          '<a class="ext" href="' + esc(v.src) + '" target="_blank" rel="noreferrer">Dado oficial desta votação ↗</a></li>';
      }).join("") + "</ul>";
      h += '<p class="note-sm">Ausente = estava no mandato naquele dia mas não registrou voto (pode estar de licença, em missão oficial ou presidindo a sessão, que não vota).</p>';
    }
    c.innerHTML = h;
    box.hidden = false;
    box.focus({ preventScroll: true });
    box.scrollIntoView({ behavior: "smooth", block: "start" });
    document.title = L.nome + " — Leis que mudaram o país";
    c.querySelectorAll("[data-nomes]").forEach(function (b) { b.addEventListener("click", function () { nomes(L, +b.getAttribute("data-nomes"), b); }); });
    var uf = $("#uf-lei", c); if (uf) uf.addEventListener("change", function () { porUF(L, uf.value); });
  }
  var VCACHE = {};
  function votosDe(L) { return VCACHE[L.id] || (VCACHE[L.id] = getJSON(D + "votos/" + L.id + ".json")); }
  function nomes(L, i, btn) {
    var v = L.votacoes[i], el = document.getElementById("nomes-" + i);
    if (el.innerHTML) { el.innerHTML = ""; btn.textContent = "Ver os nomes"; return; }
    btn.textContent = "Esconder os nomes";
    el.innerHTML = '<div class="skeleton"></div>';
    votosDe(L).then(function (j) {
      var rows = (j.v[v.k] || []).slice().sort(function (a, b) { return a[1].localeCompare(b[1]); });
      el.innerHTML = '<div class="voto-tools"><div class="field"><label>Voto</label><select class="fv"><option value="">Todos</option>' + "SNAOX".split("").map(function (k) { return '<option value="' + k + '">' + VOTO_CURTO[k] + "</option>"; }).join("") +
        '</select></div><div class="field"><label>Estado</label><select class="fu"><option value="">Todos</option>' + UFS.map(function (u) { return "<option>" + u + "</option>"; }).join("") + '</select></div><div class="field"><label>Nome</label><input class="fn" type="search" autocomplete="off"></div></div><ul class="voto-list"></ul>';
      var draw = function () {
        var fv = $(".fv", el).value, fu = $(".fu", el).value, fn = norm($(".fn", el).value);
        var r = rows.filter(function (x) { return (!fv || x[4] === fv || (fv === "X" && x[4] === "P")) && (!fu || x[3] === fu) && (!fn || norm(x[1]).indexOf(fn) >= 0); });
        $(".voto-list", el).innerHTML = r.map(function (x) { return "<li><span>" + perfil(x[0], x[1]) + " <small>" + esc(x[2]) + '</small></span><small class="uf">' + esc(x[3] || "") + '</small><span class="vote-tag ' + x[4] + '">' + esc(VOTO_CURTO[x[4]] || x[4]) + "</span></li>"; }).join("") || '<li class="state-empty">Ninguém com esses filtros.</li>';
      };
      ["fv", "fu"].forEach(function (k) { $("." + k, el).addEventListener("change", draw); });
      $(".fn", el).addEventListener("input", draw);
      draw();
    }).catch(function () { el.innerHTML = '<p class="err">Não foi possível carregar os nomes.</p>'; });
  }
  function porUF(L, uf) {
    var el = $("#uf-res");
    if (!uf) { el.innerHTML = ""; return; }
    el.innerHTML = '<div class="skeleton"></div>';
    votosDe(L).then(function (j) {
      var h = "";
      L.votacoes.forEach(function (v) {
        if (v.secreta) return;
        var r = (j.v[v.k] || []).filter(function (x) { return x[3] === uf; }).sort(function (a, b) { return a[1].localeCompare(b[1]); });
        if (!r.length) return;
        h += '<div class="lei-box" style="margin-top:10px"><h3>' + esc(votLabel(v)) + " · " + fmtD(v.dt) + '</h3><ul class="voto-list" style="margin-top:8px">' +
          r.map(function (x) { return "<li><span>" + perfil(x[0], x[1]) + " <small>" + esc(x[2]) + '</small></span><small class="uf">' + esc(uf) + '</small><span class="vote-tag ' + x[4] + '">' + esc(VOTO_CURTO[x[4]] || x[4]) + "</span></li>"; }).join("") + "</ul></div>";
      });
      el.innerHTML = h || '<p class="err">Nenhum parlamentar de ' + esc(uf) + " nas votações nominais desta lei.</p>";
    });
  }

  // ---------- como votou fulano ----------
  var qp = $("#q-pessoa"), fu = $("#f-ufpessoa"), pbox = $("#pessoa-box"), tq;
  function loadPessoas() { return PESSOAS ? Promise.resolve(PESSOAS) : getJSON(D + "pessoas.json").then(function (j) { PESSOAS = j; j.p.forEach(function (p) { p.q = norm(p[1]); }); return j; }); }
  function buscaPessoa() {
    var q = norm(qp.value.trim()), uf = fu.value;
    if (q.length < 3 && !uf) { pbox.innerHTML = '<p class="note-sm">Digite pelo menos 3 letras do nome ou escolha um estado.</p>'; return; }
    pbox.innerHTML = '<div class="skeleton"></div>';
    loadPessoas().then(function (j) {
      var r = j.p.filter(function (p) { return (!q || p.q.indexOf(q) >= 0) && (!uf || p[3] === uf); }).slice(0, 40);
      if (!r.length) { pbox.innerHTML = '<p class="err">Ninguém com esse nome votou nas leis desta página. Lembre que antes de 2001 não há voto nominal nos dados abertos.</p>'; return; }
      if (r.length === 1) return mostraPessoa(r[0]);
      pbox.innerHTML = '<ul class="sug">' + r.map(function (p, i) { var n = p[5].replace(/\./g, "").length; return '<li><button type="button" data-i="' + i + '">' + esc(p[1]) + " <small>" + esc(p[2] || "") + (p[3] ? "-" + esc(p[3]) : "") + " · " + (p[0][0] === "c" ? "deputado(a)" : "senador(a)") + " · " + n + (n > 1 ? " votos" : " voto") + "</small></button></li>"; }).join("") + "</ul>";
      pbox.querySelectorAll("[data-i]").forEach(function (b) { b.addEventListener("click", function () { mostraPessoa(r[+b.getAttribute("data-i")]); }); });
    });
  }
  function mostraPessoa(p) {
    var j = PESSOAS, rows = [];
    for (var i = 0; i < p[5].length; i++) if (p[5][i] !== ".") rows.push([j.votos[i], p[5][i]]);
    var cnt = {}; rows.forEach(function (r) { cnt[r[1]] = (cnt[r[1]] || 0) + 1; });
    var h = '<div class="lei-box"><h3>' + (p[0][0] === "c" ? "Deputado(a)" : "Senador(a)") + "</h3><p><b>" + perfil(p[4], p[1]) + "</b> " + esc(p[2] || "") + (p[3] ? "-" + esc(p[3]) : "") +
      '</p><div class="kpis" style="margin-top:8px">' + "SNAOXP".split("").filter(function (k) { return cnt[k]; }).map(function (k) { return '<div class="kpi"><b>' + cnt[k] + "</b><span>" + esc(VOTO_CURTO[k]) + "</span></div>"; }).join("") + "</div>" +
      (p[4] ? '<p class="note-sm"><a class="linkish" href="/politica/politicos/#p/' + esc(p[4]) + '">Ver o perfil completo e os mandatos</a></p>' : "") + "</div>";
    h += '<div class="table-wrap"><table class="data-table tabela-cards"><caption class="sr-only">Votos de ' + esc(p[1]) + '</caption><thead><tr><th scope="col">Lei</th><th scope="col">Votação</th><th scope="col">Data</th><th scope="col">Voto</th></tr></thead><tbody>' +
      rows.map(function (r) { var L = BY[r[0][0]] || {}; return '<tr><th scope="row"><a href="#lei/' + esc(r[0][0]) + '">' + esc(L.nome || r[0][0]) + "</a></th><td>" + esc(CASA[r[0][2]] + (r[0][4] ? " · " + r[0][4] + "º turno" : "")) + "</td><td>" + fmtD(r[0][3]) + '</td><td><span class="vote-tag ' + r[1] + '">' + esc(VOTO[r[1]] || r[1]) + "</span></td></tr>"; }).join("") +
      "</tbody></table></div>";
    pbox.innerHTML = h;
  }
  qp.addEventListener("input", function () { clearTimeout(tq); tq = setTimeout(buscaPessoa, 220); });
  fu.addEventListener("change", buscaPessoa);

  // ---------- coerência ----------
  var TIPO = { a: "Assinou e votou contra", b: "Contra a orientação do partido", c: "Mudou do 1º para o 2º turno" };
  var shown = 30;
  function loadCoer() {
    Promise.all([getJSON(D + "coerencia-leis.json").catch(function () { return { casos: [] }; }), getJSON(D + "coerencia-camara.json").catch(function () { return { casos: [] }; })]).then(function (r) {
      COER = r[0].casos || []; COERC = r[1];
      var nA = COER.filter(function (c) { return c.t === "a"; }).length, nB = COER.filter(function (c) { return c.t === "b"; }).length, nC = COER.filter(function (c) { return c.t === "c"; }).length;
      var gA = (COERC.casos || []).filter(function (c) { return c[0] === "a"; }).length, gC = (COERC.casos || []).filter(function (c) { return c[0] === "c"; }).length;
      $("#st-c").textContent = num(nA + nC + gA + gC);
      $("#coer-kpis").innerHTML = '<div class="kpi"><b>' + num(nA) + " + " + num(gA) + "</b><span>Assinou e votou contra (nestas leis + no resto da Câmara)</span></div>" +
        '<div class="kpi"><b>' + num(nC) + " + " + num(gC) + "</b><span>Mudou entre o 1º e o 2º turno</span></div>" +
        '<div class="kpi"><b>' + num(nB) + "</b><span>Votos contra a orientação do próprio partido nestas leis</span></div>";
      ["q-coer", "f-tipo", "f-onde"].forEach(function (id) { var el = document.getElementById(id); el.addEventListener(el.tagName === "INPUT" ? "input" : "change", function () { shown = 30; renderCoer(); }); });
      $("#coer-more").addEventListener("click", function () { shown += 30; renderCoer(); });
      renderCoer();
    });
  }
  function caseRows() {
    var onde = $("#f-onde").value;
    if (onde === "tudo") {
      var P = COERC.props || {}, V = COERC.votacoes || {};
      return (COERC.casos || []).map(function (c) {
        var pr = P[c[6]] || ["", ""], x = c[10] || {};
        return { t: c[0], id: c[1], n: c[3], p: c[4], uf: c[5], dt: c[8], v: c[9], pr: pr[0], em: pr[1], co: x.co, v1: x.v1, dt1: x.dt1, url: "https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=" + c[6], src: "https://dadosabertos.camara.leg.br/api/v2/votacoes/" + c[7] + "/votos", casa: "c" };
      });
    }
    return COER.filter(function (c) { return !(c.t === "a" && c.sub); }).map(function (c) { var L = BY[c.lei] || {}; var v = (L.votacoes || []).filter(function (x) { return x.k === c.k; })[0] || {}; return Object.assign({}, c, { lei: L, url: v.url, src: v.src, casa: v.casa }); });
  }
  function renderCoer() {
    if (!COER) return;
    var q = norm($("#q-coer").value.trim()), t = $("#f-tipo").value;
    var rows = caseRows().filter(function (c) { return (!t || c.t === t) && (!q || norm(c.n).indexOf(q) >= 0); });
    rows.sort(function (a, b) { return (b.dt || "").localeCompare(a.dt || ""); });
    $("#coer-count").textContent = rows.length + (rows.length === 1 ? " caso" : " casos") + ($("#f-onde").value === "tudo" ? " em votações nominais do plenário da Câmara desde 2001" : " nas leis desta página");
    var vv = function (k) { return '<span class="vote-tag ' + k + '">' + esc(VOTO_CURTO[k] || k) + "</span>"; };
    $("#coer-list").innerHTML = rows.slice(0, shown).map(function (c) {
      var what = c.lei && c.lei.nome ? '<a href="#lei/' + esc(c.lei.id) + '">' + esc(c.lei.nome) + "</a> (" + esc(c.pr || "") + ")" : esc(c.pr || "") + (c.em ? ": " + esc(c.em) : "");
      var txt;
      if (c.t === "a") txt = (c.co ? "Coassinou" : "É autor(a) de") + " " + what + " e votou " + vv("N") + " na aprovação do texto em " + fmtD(c.dt) + ".";
      else if (c.t === "b") txt = "Em " + what + ", a orientação oficial do " + esc(c.p) + " foi <b>" + esc(c.or) + "</b> e votou " + vv(c.v) + " (" + fmtD(c.dt) + ").";
      else txt = "Em " + what + ", votou " + vv(c.v1) + " no 1º turno (" + fmtD(c.dt1) + ") e " + vv(c.v) + " no 2º turno (" + fmtD(c.dt) + ").";
      return '<li class="item"><div class="item-top"><span class="sig">' + esc(TIPO[c.t]) + "</span><span>" + esc(c.casa === "s" ? "Senado" : "Câmara") + "</span><span>" + fmtD(c.dt) + "</span></div><h3>" + perfil(c.id, c.n) + ' <small class="muted">' + esc(c.p || "") + (c.uf ? "-" + esc(c.uf) : "") + "</small></h3><p>" + txt + "</p>" +
        '<div class="pf-links">' + (c.src ? '<a href="' + esc(c.src) + '" target="_blank" rel="noreferrer">Voto registrado ↗</a>' : "") + (c.url ? '<a href="' + esc(c.url) + '" target="_blank" rel="noreferrer">Proposta e autores ↗</a>' : "") + "</div></li>";
    }).join("") || '<li class="state-empty">Nenhum caso com esses filtros.</li>';
    $("#coer-more").hidden = rows.length <= shown;
  }
})();
