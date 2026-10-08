/* politica/governo/governo.js — página "Governo federal" (dados em ../data/governo/) */
(function () {
  "use strict";
  var D = "../data/governo/";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var norm = function (s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); };
  var MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var dBR = function (iso) { if (!iso) return ""; var p = String(iso).slice(0, 10).split("-"); return p.length < 3 ? iso : p[2] + "/" + p[1] + "/" + p[0]; };
  var dExt = function (iso) { if (!iso) return ""; var p = iso.split("-"); return (+p[2] === 1 ? "1º" : +p[2]) + " de " + MES[+p[1] - 1] + " de " + p[0]; };
  var nf = function (n) { return Number(n || 0).toLocaleString("pt-BR"); };
  var numBR = function (n) { return Number(n).toLocaleString("pt-BR"); };
  function getJSON(u) { return fetch(u, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(u + " → HTTP " + r.status); return r.json(); }); }
  function erro(el, msg) { if (el) el.innerHTML = '<p class="err">' + esc(msg) + ' <a href="">Tentar de novo</a></p>'; }
  var ext = function (url, txt, cls) { return '<a class="ext' + (cls ? " " + cls : "") + '" href="' + esc(url) + '" target="_blank" rel="noreferrer">' + esc(txt) + " ↗</a>"; };

  var S = { atual: null, pres: null, porPres: null, resumos: {}, idx: null, presById: {} };

  /* ---------- Governo agora ---------- */
  function foto(f, alt, cls) {
    if (!f) return "";
    return '<figure class="gov-foto ' + (cls || "") + '"><img src="' + esc(f.arquivo) + '" alt="' + esc(alt) + '" width="160" height="200" loading="lazy" decoding="async">' +
      '<figcaption>Foto: ' + esc(f.autor) + ' · <a href="' + esc(f.licencaUrl || f.pagina) + '" target="_blank" rel="noreferrer">' + esc(f.licenca) + '</a> · <a href="' + esc(f.pagina) + '" target="_blank" rel="noreferrer">Wikimedia Commons</a></figcaption></figure>';
  }
  function renderTopo() {
    var a = S.atual, p = S.pres && S.pres.presidentes, atualP = p && p[p.length - 1];
    var fP = atualP && atualP.foto, fV = atualP && atualP.viceFoto;
    var card = function (x, f, papel, extra) {
      return '<article class="gov-exec">' + foto(f, "Foto de " + x.nome) +
        '<div class="gov-exec-txt"><span class="role">' + esc(papel) + '</span><h3>' + esc(x.nome) + '</h3>' +
        '<p class="gov-exec-meta"><span class="chip">' + esc(x.partido) + '</span> no cargo desde ' + esc(x.desdeTexto || dExt(x.desde)) + '</p>' + (extra || "") + '</div></article>';
    };
    var vm = a.ministerios.filter(function (m) { return m.nome === a.vice.nome; })[0];
    var vMin = vm ? " Também é ministro: " + esc(vm.orgao) + " (veja abaixo)." : "";
    $("#gov-topo").innerHTML =
      card(a.presidente, fP, "Presidente da República", '<p>' + esc(a.presidente.mandatoAte) + '.</p><p class="note-sm">Chefia o governo e o Estado: escolhe os ministros, sanciona ou veta leis, edita medidas provisórias e decretos e comanda as Forças Armadas.</p>') +
      card(a.vice, fV, "Vice-presidente", '<p class="note-sm">Substitui o presidente em viagens, doença ou se o cargo ficar vago.' + vMin + '</p>');
    $("#st-pres").textContent = a.presidente.nome.split(" ").slice(0, 2).join(" ").replace("Luiz Inácio", "Lula");
    $("#st-min").textContent = a.ministerios.length;
    $("#st-ate").textContent = "05/01/2027";
    $("#st-upd").textContent = dBR(a.verificadoEm);
  }
  function desdeTxt(m) {
    if (m.desde) return "desde " + (m.desdeTexto || dExt(m.desde));
    var v = Object.keys(m.desdeFontes || {}).map(function (k) { return m.desdeFontes[k]; }).filter(Boolean);
    if (!v.length) return "data de posse não confirmada";
    var u = v.filter(function (x, i) { return v.indexOf(x) === i; }).sort();
    var p = u[0].split("-");
    return "desde " + MES[+p[1] - 1] + " de " + p[0] + ' <span class="gov-warn" title="As fontes trazem datas diferentes">(fontes divergem: ' + u.map(dBR).join(" ou ") + ")</span>";
  }
  function renderMin() {
    var a = S.atual, q = norm($("#min-q").value), pf = $("#min-p").value, n = 0;
    var html = a.ministerios.map(function (m) {
      var hay = norm([m.orgao, m.nome, m.nomeCompleto, m.oQueFaz, m.partido, m.cargo].join(" "));
      var part = m.partido || "Não informado";
      var show = (!q || hay.indexOf(q) >= 0) && (!pf || part === pf);
      if (show) n++;
      var pFonte = m.partido && m.partido !== "Sem partido" && m.partidoFontes && m.partidoFontes.length ? ' <small class="muted">(partido segundo ' + esc(m.partidoFontes.join(" e ")) + ")</small>" : "";
      return '<li class="gov-min-item"' + (show ? "" : " hidden") + '><small>' + esc(m.orgao) + '</small><strong>' + esc(m.nome) + '</strong>' +
        '<span class="gov-min-meta">' + (m.partido ? '<span class="chip">' + esc(m.partido) + "</span>" : '<span class="chip muted">partido não informado</span>') + " " + desdeTxt(m) + pFonte + '</span>' +
        '<p>' + esc(m.oQueFaz) + '</p>' +
        '<span class="gov-min-links">' + (m.site ? ext(m.site, "site oficial") : "") + (m.nomeCompleto && m.nomeCompleto !== m.nome ? ' <small class="muted">' + esc(m.cargo) + ": " + esc(m.nomeCompleto) + "</small>" : ' <small class="muted">' + esc(m.cargo) + "</small>") + "</span></li>";
    }).join("");
    $("#min-list").innerHTML = html;
    $("#min-count").textContent = n === a.ministerios.length ? n + " órgãos com status de ministério" : n + " de " + a.ministerios.length + " ministérios";
  }
  function initMin() {
    var a = S.atual;
    $("#min-nota").textContent = "Ministérios são as “áreas” do governo federal: cada um cuida de um assunto e tem um ministro escolhido pelo presidente. " + a.nota;
    var parts = {};
    a.ministerios.forEach(function (m) { var p = m.partido || "Não informado"; parts[p] = (parts[p] || 0) + 1; });
    $("#min-p").innerHTML = '<option value="">Todos</option>' + Object.keys(parts).sort(function (x, y) { return parts[y] - parts[x] || x.localeCompare(y); }).map(function (p) { return '<option value="' + esc(p) + '">' + esc(p) + " (" + parts[p] + ")</option>"; }).join("");
    $("#min-q").addEventListener("input", renderMin);
    $("#min-p").addEventListener("change", renderMin);
    renderMin();
    var lab = { arquivo: "arquivo enviado em 06/10", wikipedia: "Wikipédia", wikidata: "Wikidata", planalto: "Planalto", constituicao: "Constituição" };
    $("#min-div div").innerHTML = '<p class="note-sm">Conferimos ' + esc(a.ministerios.length) + " nomes com a página oficial do Planalto e as datas e partidos com Wikidata e Wikipédia. Onde as fontes não batem, mostramos as duas versões em vez de escolher uma:</p><ul>" +
      a.divergencias.map(function (d) {
        return "<li><b>" + esc(d.orgao) + "</b> (" + esc(d.campo) + "): " + Object.keys(d.valores).map(function (k) { return esc(lab[k] || k) + " — " + esc(/^\d{4}-\d\d-\d\d$/.test(d.valores[k]) ? dBR(d.valores[k]) : d.valores[k]); }).join("; ") + ". <span class=\"muted\">" + esc(d.nota) + "</span></li>";
      }).join("") + "</ul>";
  }

  /* ---------- Eleições ---------- */
  function barras(cands, total, pctOf) {
    var max = Math.max.apply(null, cands.map(function (c) { return c.v; }).concat([1]));
    return '<ol class="gov-bars">' + cands.map(function (c) {
      var pct = pctOf ? pctOf(c) : (c.v / total * 100);
      var pctTxt = typeof pct === "string" ? pct : pct.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return '<li class="' + (c.dest ? "is-top" : "") + '"><span class="gb-nome"><b>' + esc(c.nome) + '</b> <span class="chip">' + esc(c.partido) + "</span>" + (c.tag ? ' <span class="badge ' + (c.tagCls || "neutral") + '">' + esc(c.tag) + "</span>" : "") + (c.sub ? '<small class="muted">' + esc(c.sub) + "</small>" : "") + '</span>' +
        '<span class="gb-track" aria-hidden="true"><span style="width:' + (c.v / max * 100).toFixed(2) + '%"></span></span>' +
        '<span class="gb-val"><b>' + pctTxt + '%</b><small>' + nf(c.v) + " votos</small></span></li>";
    }).join("") + "</ol>";
  }
  var titulo = function (s) { return String(s || "").toLowerCase().replace(/(^|\s)(\S)/g, function (m, a, b) { return a + b.toUpperCase(); }).replace(/\b(Da|De|Do|Das|Dos|E)\b/g, function (m) { return m.toLowerCase(); }); };
  function renderEle(e) {
    var el = $("#ele-2026"), t1 = e.t1, t2 = e.t2, h = "";
    var turnoHTML = function (t, nome) {
      var cs = t.candidatos.map(function (c) {
        var st = c.situacao || "";
        return { nome: titulo(c.nome), partido: c.partido, v: c.votos, sub: c.vice ? "Vice: " + titulo(c.vice) + (c.viceP ? " (" + c.viceP + ")" : "") : "", tag: /2º turno/i.test(st) ? "vai ao 2º turno" : /^eleito/i.test(st) ? "eleito" : "", tagCls: /eleito|2º/i.test(st) ? "ok" : "neutral", dest: /eleito|2º/i.test(st), pctS: c.pct };
      });
      return '<div class="gov-ele-turno"><h3 class="h-md">' + esc(nome) + ' <small class="muted">' + (t.oficial ? "resultado oficial" : "parcial") + ", " + esc(t.secoes.pct) + "% das seções apuradas · TSE, " + esc(t.totalizadoEm) + " (Brasília)</small></h3>" +
        barras(cs, 0, function (c) { return c.pctS; }) +
        '<dl class="kpis gov-ele-kpis"><div class="kpi"><b>' + nf(t.eleitorado) + '</b><span>eleitores</span></div><div class="kpi"><b>' + esc(t.comparecimentoPct) + '%</b><span>foram votar (' + nf(t.comparecimento) + ')</span></div><div class="kpi"><b>' + esc(t.abstencaoPct) + '%</b><span>não foram (abstenção)</span></div><div class="kpi"><b>' + esc(t.votos.brancosPct) + "% / " + esc(t.votos.nulosPct) + '%</b><span>brancos / nulos</span></div></dl>' +
        '<p class="note-sm">Fonte: ' + ext(t.url, "arquivo oficial de resultados do TSE") + ".</p></div>";
    };
    if (t2) h += turnoHTML(t2, "2º turno — " + dBR(e.datas.turno2));
    else h += '<div class="note gov-ele-prox"><b>2º turno em ' + dExt(e.datas.turno2) + ".</b> " +
      (t1 ? esc(t1.candidatos.filter(function (c) { return /2º turno/i.test(c.situacao); }).map(function (c) { return titulo(c.nome) + " (" + c.partido + ")"; }).join(" e ")) + " disputam o segundo turno, porque nenhum candidato teve mais da metade dos votos válidos no 1º turno. " : "") +
      "Quem vencer toma posse em " + dExt(e.datas.posse) + ". Esta página mostra o resultado oficial do TSE assim que ele for divulgado.</div>";
    if (t1) h += turnoHTML(t1, "1º turno — " + dBR(e.datas.turno1));
    h += '<p class="note-sm">' + esc(e.notaDatas) + "</p>";
    el.innerHTML = h;
  }
  function renderHist(H, ano) {
    var y = H.anos[ano], h = "";
    if (!y) { $("#ele-hist").innerHTML = '<p class="note">' + esc(H.nota1989.texto) + " " + ext(H.nota1989.url, "Biblioteca da Presidência") + "</p>"; return; }
    Object.keys(y).sort().reverse().forEach(function (t) {
      var cs = y[t].candidatos, tot = cs.reduce(function (s, c) { return s + c[2]; }, 0);
      h += '<h4 class="gov-h4">' + t + "º turno · " + dBR(y[t].data) + '</h4>' + barras(cs.map(function (c) { return { nome: titulo(c[0]), partido: c[1], v: c[2], tag: c[3] === "E" ? "eleito" : c[3] === "2" ? "foi ao 2º turno" : "", tagCls: "ok", dest: !!c[3] }; }), tot);
    });
    h += '<p class="note-sm">Votos nominais somados dos arquivos de dados abertos do TSE; % sobre os votos válidos. ' + ext(H.fonte.url, "TSE — dados abertos") + "</p>";
    $("#ele-hist").innerHTML = h;
  }
  function initHist(H) {
    var anos = Object.keys(H.anos).sort().reverse().concat(["1989"]);
    var tl = $("#ele-anos");
    tl.innerHTML = anos.map(function (a, i) { return '<button type="button" role="tab" aria-selected="' + (i === 0) + '" data-ano="' + a + '">' + a + "</button>"; }).join("");
    tl.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-ano]"); if (!b) return;
      tl.querySelectorAll("[role=tab]").forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); });
      renderHist(H, b.getAttribute("data-ano"));
    });
    renderHist(H, anos[0]);
  }

  /* ---------- Presidentes ---------- */
  var TIPO = {
    lei: { s: "Lei", n: "Leis ordinárias", urn: "lei", exp: "Leis “comuns”, aprovadas pelo Congresso e sancionadas pelo presidente." },
    lcp: { s: "Lei Complementar", n: "Leis complementares", urn: "lei.complementar", exp: "Leis sobre temas que a Constituição manda tratar assim, como impostos e finanças públicas. Precisam de maioria absoluta." },
    emc: { s: "Emenda Constitucional", n: "Emendas à Constituição", urn: "emenda.constitucional", exp: "Mudanças na Constituição. São promulgadas pelo Congresso: o presidente não assina nem veta. Aqui aparecem pela data de promulgação." },
    mpv: { s: "Medida Provisória", n: "Medidas provisórias", urn: "medida.provisoria", exp: "Atos do presidente com força de lei, para casos urgentes. Valem na hora; o Congresso decide depois se viram lei. Lista com a situação de cada MP no Congresso (dados do Senado)." },
    dec: { s: "Decreto", n: "Decretos", urn: "decreto", exp: "Atos do presidente para organizar o governo e regulamentar leis. Inclui decretos numerados (os não numerados, como nomeações, ficam de fora)." },
    vet: { s: "Veto", n: "Vetos", exp: "Quando o presidente recusa um projeto aprovado, todo ou em parte, o Congresso analisa o veto e pode mantê-lo ou derrubá-lo. Dados do Senado a partir de 2000." }
  };
  function propHref(chave, sigOuAno) { var m = /(\d{4})\s*$/.exec(String(sigOuAno)); return "../propostas/#id=" + encodeURIComponent(chave) + (m ? "&ano=" + m[1] : ""); }
  function chaveNorma(k) { var p = k.slice(2).split("-"); return { t: p[0].toLowerCase(), n: +p[1], a: p[2] }; }
  function rotNorma(t, n, a) { return TIPO[t].s + " nº " + (n >= 1000 ? numBR(n) : n) + "/" + a; }
  function urlNorma(t, n, iso) { return "https://normas.leg.br/?urn=urn:lex:br:federal:" + TIPO[t].urn + ":" + iso + ";" + n; }
  function periodo(p) {
    var ini = dBR(p.inicio), fim = p.fim ? dBR(p.fim) : "hoje";
    return ini + " a " + fim;
  }
  function renderPres() {
    var P = S.pres.presidentes.slice().reverse(), C = (S.porPres && S.porPres.presidentes) || {};
    $("#pres-list").innerHTML = P.map(function (p, i) {
      var c = C[p.id] || {};
      var mpTxt = c.mpvEdicoes && c.mpvEdicoes > c.mpv ? nf(c.mpvEdicoes) + ' <small>edições, contando reedições</small>' : nf(c.mpv);
      var kp = [
        ["lei", nf(c.lei), "leis ordinárias"], ["lcp", nf(c.lcp), "leis complementares"], ["emc", nf(c.emc), "emendas constitucionais promulgadas"],
        ["mpv", mpTxt, "medidas provisórias"], ["dec", nf(c.dec), "decretos numerados"], ["vet", p.inicio < "2000" && p.id !== "fhc" ? "—" : nf(c.vet), "vetos analisados" + (p.id === "fhc" ? " (desde 2000)" : "")]
      ];
      var mpDet = c.mpv ? '<li>Das MPs com processo no Congresso, <b>' + nf(c.mpvLei) + "</b> viraram lei, <b>" + nf(c.mpvCaducou) + "</b> perderam a validade sem votação e <b>" + nf(c.mpvRejeitada) + "</b> " + (c.mpvRejeitada === 1 ? "foi rejeitada" : "foram rejeitadas") + (c.mpvReed ? "; <b>" + nf(c.mpvReed) + "</b> foram reeditadas (republicadas com outro número, permitido até 2001)" : "") + (c.mpvReedSufixo ? ". Entre as edições, <b>" + nf(c.mpvReedSufixo) + "</b> são reedições numeradas com sufixo (ex.: MP 2.166-67)" : "") + ".</li>" : "";
      var vetDet = c.vet ? "<li>Dos <b>" + nf(c.vet) + "</b> vetos (" + nf(c.vetTotal) + " totais e " + nf(c.vetParcial) + " parciais), o Congresso manteve " + nf(c.vetMantido) + ", derrubou " + nf(c.vetDerrubado) + " e derrubou em parte " + nf(c.vetDerrubadoParte) + "; os demais estavam sem decisão, prejudicados ou sem informação.</li>" : "";
      var chave = (p.chave || []).map(function (k) {
        var r = S.resumos[k], x = chaveNorma(k); if (!r) return "";
        return '<li><details><summary><b>' + esc(r.nome) + '</b> <span class="muted">· ' + esc(rotNorma(x.t, x.n, x.a)) + "</span></summary>" +
          '<div class="pc"><p><span class="pc-k">Pra que serve:</span> ' + esc(r.ps) + '</p><p><span class="pc-k">Como funciona:</span> ' + esc(r.cf) + '</p>' +
          '<p class="note-sm"><span class="tag">Resumo simplificado</span> ' + (r.data ? (x.t === "emc" ? "Promulgada em " : "Assinada em ") + dBR(r.data) + " · " : "") + ext(urlNorma(x.t, x.n, r.data), "Ver texto oficial") + (r.origem ? ' · veio de <a href="' + esc(propHref(r.origem[0], r.origem[1])) + '">' + esc(r.origem[1]) + "</a>" : "") + "</p></div></details></li>";
      }).filter(Boolean);
      return '<li class="gov-pres-item' + (i === 0 ? " is-atual" : "") + '" id="p-' + esc(p.id) + '">' +
        '<div class="gp-head">' + foto(p.foto, "Foto de " + p.nome, "gp-foto") +
        '<div><span class="role">' + (i === 0 ? "Presidente atual" : "Ex-presidente") + "</span><h3>" + esc(p.nome) + '</h3>' +
        '<p class="gp-meta"><span class="chip">' + esc(p.partido) + '</span> <span class="mono">' + esc(periodo(p)) + "</span></p>" +
        (p.partidoNota ? '<p class="note-sm">' + esc(p.partidoNota) + "</p>" : "") +
        '<p><b>Vice:</b> ' + esc(p.vice || p.viceNota || "—") + "</p>" +
        '<p><b>Como chegou:</b> ' + esc(p.eleicao) + "</p></div></div>" +
        '<p class="gp-fim"><b>Como terminou:</b> ' + esc(p.como) + "</p>" +
        (p.contexto ? '<p class="note-sm">' + esc(p.contexto) + "</p>" : "") +
        '<dl class="gp-kpis">' + kp.map(function (k) { return '<div><dt>' + k[2] + "</dt><dd>" + k[1] + "</dd></div>"; }).join("") + "</dl>" +
        '<ul class="gp-det note-sm">' + mpDet + vetDet + "</ul>" +
        (chave.length ? '<h4 class="gov-h4">Leis e emendas marcantes do período</h4><ul class="gp-chave">' + chave.slice(0, 4).join("") +
          (chave.length > 4 ? '<li><details class="gp-mais"><summary>Mais ' + (chave.length - 4) + ' leis marcantes</summary><ul class="gp-chave">' + chave.slice(4).join("") + "</ul></details></li>" : "") + "</ul>" : "") +
        '<p class="gp-acoes"><button class="button" type="button" data-ver-atos="' + esc(p.id) + '">Ver tudo o que foi assinado →</button> ' +
        (p.fontes || []).map(function (f) { return ext(f[1], f[0], "gp-fonte"); }).join(" ") + "</p></li>";
    }).join("");
    $("#pres-list").addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-ver-atos]"); if (!b) return;
      var p = S.presById[b.getAttribute("data-ver-atos")];
      $("#atos-pres").value = p.id;
      onPres();
      $("#atos").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  /* ---------- Atos ---------- */
  var A = { tipo: "lei", ano: null, data: null, cache: {}, shown: 0, lista: [] };
  var PAGE = 40;
  function quem(iso) {
    var P = S.pres.presidentes;
    for (var i = 0; i < P.length; i++) for (var j = 0; j < P[i].exercicio.length; j++) { var e = P[i].exercicio[j]; if (iso >= e[0] && iso <= e[1]) return P[i]; }
    return null;
  }
  function anosDisponiveis() {
    var pid = $("#atos-pres").value, all = Object.keys(S.idx.anos).map(Number).sort(function (a, b) { return b - a; });
    if (!pid) return all;
    var p = S.presById[pid];
    return all.filter(function (y) { return p.exercicio.some(function (e) { return +e[0].slice(0, 4) <= y && +e[1].slice(0, 4) >= y; }); });
  }
  function fillAnos(keep) {
    var anos = anosDisponiveis(), sel = $("#atos-ano"), cur = keep && anos.indexOf(+sel.value) >= 0 ? +sel.value : anos[0];
    sel.innerHTML = anos.map(function (y) { var c = S.idx.anos[y] || {}; var n = A.tipo === "mpv" && c.mpvEd > c.mpv ? c.mpv : c[A.tipo]; return '<option value="' + y + '">' + y + " (" + nf(n || 0) + ")</option>"; }).join("");
    sel.value = cur;
  }
  function onPres() { fillAnos(false); loadAno(); }
  function loadAno() {
    var y = $("#atos-ano").value; if (!y) return;
    var el = $("#atos-list");
    if (A.cache[y]) { A.data = A.cache[y]; return filtra(); }
    el.innerHTML = '<li class="skeleton" style="height:120px"></li>';
    getJSON(D + "atos/" + y + ".json").then(function (d) { A.cache[y] = d; if ($("#atos-ano").value === y) { A.data = d; filtra(); } })
      .catch(function (e) { erro(el, "Não foi possível carregar os atos de " + y + "."); console.warn(e); });
  }
  var MPV_CLS = { C: "ok", I: "ok", E: "no", J: "no", R: "neutral", T: "neutral", A: "ok", V: "neutral", P: "neutral", D: "no" };
  var VET_CLS = { M: "neutral", D: "no", P: "no", T: "neutral", X: "neutral" };
  function itemHTML(r) {
    var t = A.tipo, y = A.data.ano, cod = S.idx.codigos, h, pr, iso;
    if (t === "mpv") {
      iso = r[1]; pr = quem(iso);
      var sit = cod.mpv[r[5]] || "", rs = S.resumos[r[7]];
      h = '<div class="item-top"><span class="sig mono">MP nº ' + esc(numBR(r[0])) + "/" + y + '</span><span class="badge ' + (MPV_CLS[r[5]] || "neutral") + '">' + esc(sit.split(":")[0]) + "</span></div>" +
        (r[3] ? "<h3>" + esc(r[3]) + "</h3>" : "") + '<p class="gov-ementa"><span class="pc-k">Ementa oficial:</span> ' + esc(r[2]) + "</p>" +
        (rs ? '<div class="pc"><p><span class="pc-k">Pra que serve:</span> ' + esc(rs.ps) + '</p>' + (rs.cf ? '<p><span class="pc-k">Como funciona:</span> ' + esc(rs.cf) + "</p>" : "") + '<p class="note-sm"><span class="tag">Resumo simplificado</span></p></div>' : "") +
        '<p class="note-sm">' + (sit.indexOf(":") > 0 ? esc(sit.split(":").slice(1).join(":").trim()) + ". " : "") + (r[6] ? "Resultado: <b>" + esc(r[6]) + "</b>. " : "") + "Editada em " + dBR(iso) + (pr ? " · " + esc(pr.nome) : "") + "</p>" +
        '<p class="gov-links">' + ext("https://www25.senado.leg.br/web/atividade/materias/-/materia/" + r[4], "Ver tramitação e texto oficial") + (r[7] ? ' <a href="' + esc(propHref(r[7], y)) + '">Ver na lista de propostas</a>' : "") + "</p>";
    } else if (t === "vet") {
      iso = r[1]; pr = quem(iso);
      h = '<div class="item-top"><span class="sig mono">Veto ' + (r[4] === "T" ? "total" : "parcial") + " nº " + r[0] + "/" + y + '</span><span class="badge ' + (VET_CLS[r[5]] || "neutral") + '">' + esc((cod.vet[r[5]] || "").split(":")[0]) + "</span></div>" +
        '<p class="gov-ementa">' + esc(r[2]) + "</p>" +
        '<p class="note-sm">' + esc((cod.vet[r[5]] || "").split(":").slice(1).join(":").trim()) + (r[6] ? ". Lei: <b>" + esc(r[6]) + "</b>" : "") + " · " + dBR(iso) + (pr ? " · " + esc(pr.nome) : "") + "</p>" +
        '<p class="gov-links">' + ext("https://www25.senado.leg.br/web/atividade/materias/-/materia/" + r[3], "Ver o veto no Congresso") + "</p>";
    } else {
      iso = r[1]; pr = quem(iso);
      var k = "n:" + t.toUpperCase() + "-" + r[0] + "-" + y, rs2 = S.resumos[k];
      h = '<div class="item-top"><span class="sig mono">' + esc(rotNorma(t, r[0], y)) + "</span>" + (rs2 ? '<span class="badge ok">resumo simples</span>' : "") + "</div>" +
        ((rs2 && rs2.nome) || r[3] ? "<h3>" + esc((rs2 && rs2.nome) || r[3]) + "</h3>" : "") +
        '<p class="gov-ementa"><span class="pc-k">Ementa oficial:</span> ' + esc(r[2]) + "</p>" +
        (rs2 ? '<div class="pc"><p><span class="pc-k">Pra que serve:</span> ' + esc(rs2.ps) + '</p><p><span class="pc-k">Como funciona:</span> ' + esc(rs2.cf) + '</p><p class="note-sm"><span class="tag">Resumo simplificado</span> escrito à mão a partir do texto oficial; leis posteriores podem ter mudado partes dela.</p></div>' : auto(r[2], t)) +
        '<p class="note-sm">' + (t === "emc" ? "Promulgada pelo Congresso em " : "Assinada em ") + dBR(iso) + (pr ? " · governo " + esc(pr.nome) : "") +
        (r[5] ? ' · veio de <a href="' + esc(propHref(r[5][0], r[5][1])) + '">' + esc(r[5][1]) + "</a>" : "") + "</p>" +
        '<p class="gov-links">' + ext(urlNorma(t, r[0], iso), "Ver texto oficial") + " " + ext("https://legis.senado.leg.br/norma/" + r[4], "Ficha no Senado") + "</p>";
    }
    return '<li class="item">' + h + "</li>";
  }
  function auto(ementa, t) {
    var P = window.PolSimplifica; if (!P) return "";
    var x = P.simplificar(ementa, t === "emc" ? "PEC" : "PL"); if (!x || !x.ps) return "";
    return '<div class="pc pc-flat"><p><span class="pc-k">Pra que serve:</span> ' + esc(x.ps) + '</p><p class="note-sm"><span class="tag auto">Resumo automático</span> reorganiza a ementa oficial com regras fixas, sem interpretar.</p></div>';
  }
  function filtra() {
    var d = A.data, t = A.tipo; if (!d) return;
    var q = norm($("#atos-q").value), pid = $("#atos-pres").value, sit = $("#atos-sit").value;
    var rows = d[t] || [];
    A.lista = rows.filter(function (r) {
      if (pid) { var p = quem(r[1]); if (!p || p.id !== pid) return false; }
      if (sit && (t === "mpv" ? r[5] : r[5]) !== sit) return false;
      if (q) { var hay = norm(r.slice(0, 4).join(" ") + " " + numBR(r[0]) + " " + (r[6] || "")); if (hay.indexOf(q) < 0) return false; }
      return true;
    }).slice().reverse();
    A.shown = 0; $("#atos-list").innerHTML = ""; mais();
    var tot = A.lista.length;
    $("#atos-count").textContent = nf(tot) + " " + TIPO[t].n.toLowerCase() + " em " + d.ano + (pid ? " (" + S.presById[pid].nome + ")" : "") + (q ? " com “" + $("#atos-q").value + "”" : "");
    if (!tot) $("#atos-list").innerHTML = '<li class="note">Nada encontrado com esses filtros' + (t === "vet" && d.ano < 2000 ? " (os dados de vetos começam em 2000)" : "") + ".</li>";
  }
  function mais() {
    var part = A.lista.slice(A.shown, A.shown + PAGE);
    $("#atos-list").insertAdjacentHTML("beforeend", part.map(itemHTML).join(""));
    A.shown += part.length;
    var b = $("#atos-more"); b.hidden = A.shown >= A.lista.length;
    b.textContent = "Mostrar mais (" + nf(A.lista.length - A.shown) + " restantes)";
  }
  function setTipo(t) {
    A.tipo = t;
    $("#atos-tipos").querySelectorAll("[role=tab]").forEach(function (x) { x.setAttribute("aria-selected", String(x.getAttribute("data-t") === t)); });
    $("#atos-explica").textContent = TIPO[t].exp;
    var sw = $("#atos-sit-wrap");
    if (t === "mpv" || t === "vet") {
      var c = S.idx.codigos[t];
      $("#atos-sit").innerHTML = '<option value="">Todas</option>' + Object.keys(c).map(function (k) { return '<option value="' + esc(k) + '">' + esc(c[k].split(":")[0]) + "</option>"; }).join("");
      sw.hidden = false;
    } else { sw.hidden = true; $("#atos-sit").value = ""; }
    fillAnos(true);
    loadAno();
  }
  function initAtos() {
    $("#atos-tipos").innerHTML = Object.keys(TIPO).map(function (t) { return '<button type="button" role="tab" data-t="' + t + '" aria-selected="false">' + TIPO[t].n + "</button>"; }).join("");
    $("#atos-tipos").addEventListener("click", function (ev) { var b = ev.target.closest("[data-t]"); if (b) setTipo(b.getAttribute("data-t")); });
    $("#atos-pres").innerHTML = '<option value="">Todos</option>' + S.pres.presidentes.slice().reverse().map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.nome) + " (" + p.inicio.slice(0, 4) + "–" + (p.fim ? p.fim.slice(0, 4) : "hoje") + ")</option>"; }).join("");
    $("#atos-pres").addEventListener("change", onPres);
    $("#atos-ano").addEventListener("change", loadAno);
    var tm; $("#atos-q").addEventListener("input", function () { clearTimeout(tm); tm = setTimeout(filtra, 180); });
    $("#atos-sit").addEventListener("change", filtra);
    $("#atos-more").addEventListener("click", mais);
    setTipo("lei");
  }

  /* ---------- Fontes ---------- */
  function renderFontes() {
    var f = [];
    var add = function (titulo, itens) { f.push('<div class="pol-card"><h3>' + esc(titulo) + "</h3><ul>" + itens.map(function (x) { return "<li>" + (x[1] ? ext(x[1], x[0]) : esc(x[0])) + "</li>"; }).join("") + "</ul></div>"); };
    add("Governo agora", (S.atual.fontes || []).map(function (x) { return [x.nome, x.url]; }).concat([["Conferido em " + dBR(S.atual.verificadoEm) + ". Nomes e cargos como no Planalto; o que cada ministério faz foi escrito em linguagem simples a partir das atribuições oficiais.", ""]]));
    add("Presidentes", (S.pres.fontes || []).map(function (x) { return [x[0], x[1]]; }).concat([[S.pres.nota, ""]]));
    add("Leis, MPs, decretos e vetos", (S.idx.fontes || []).map(function (x) { return [x.nome, x.url]; }).concat([["Atualizado em " + (S.idx.atualizado || "—") + " (Brasília).", ""], ["Atribuição a cada presidente pela data de assinatura e pelos períodos de exercício (inclui interinidades de Itamar em 1992 e de Temer em 2016).", ""], ["Limites: vetos só a partir de 2000; decretos não numerados não entram; antes de 2001 as reedições de MPs não podem ser separadas com total segurança das MPs novas.", ""]]));
    add("Eleições", [["TSE — resultados oficiais de 2026 (arquivos de divulgação, sem chave)", "https://resultados.tse.jus.br/"], ["TSE — dados abertos (1994–2022)", "https://dadosabertos.tse.jus.br/"], ["1989: votação não disponível nos dados abertos; números do vencedor pela Biblioteca da Presidência.", ""]]);
    $("#fontes-list").innerHTML = f.join("");
  }

  /* ---------- Início ---------- */
  Promise.all([getJSON(D + "atual.json"), getJSON(D + "presidentes.json"), getJSON("../data/propostas/resumos/normas.json").catch(function () { return {}; }),
    getJSON(D + "atos/por-presidente.json").catch(function () { return null; }), getJSON(D + "atos/indice.json")])
    .then(function (r) {
      S.atual = r[0]; S.pres = r[1]; S.resumos = r[2] || {}; S.porPres = r[3]; S.idx = r[4];
      S.pres.presidentes.forEach(function (p) { S.presById[p.id] = p; });
      renderTopo(); initMin(); renderPres(); initAtos(); renderFontes();
      if (/^#p-/.test(location.hash)) { var t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
      // resumos de MPs/propostas (opcional): mesmos ids c:/s: do painel
      getJSON("../data/resumos-simples.json").then(function (h) { Object.keys(h).forEach(function (k) { if (!S.resumos[k] && h[k] && h[k].ps) S.resumos[k] = h[k]; }); }).catch(function () {});
      getJSON("../data/propostas/resumos/indice.json").then(function (ix) {
        return Promise.all((ix.arquivos || []).filter(function (a) { return a !== "normas.json"; }).map(function (a) { return getJSON("../data/propostas/resumos/" + a).then(function (d) { Object.keys(d).forEach(function (k) { if (k[0] !== "_" && d[k] && d[k].ps) S.resumos[k] = d[k]; }); }); }));
      }).catch(function () {});
    })
    .catch(function (e) { console.warn(e); erro($("#gov-topo"), "Não foi possível carregar os dados do governo."); });
  getJSON(D + "eleicoes2026.json").then(renderEle).catch(function (e) { console.warn(e); erro($("#ele-2026"), "Não foi possível carregar o resultado da eleição."); });
  getJSON(D + "eleicoes-historico.json").then(initHist).catch(function (e) { console.warn(e); });
})();
