/* /politica/eleicoes/ — resultados oficiais do TSE (presidente por lugar, partidos, exterior, presídios),
   perfil do eleitorado e pesquisas (só estimativa, sempre identificada). Nada aqui é inventado: tudo vem de
   ../data/eleicoes/*.json, montados por scripts/politica/eleicoes/build.py a partir dos arquivos abertos do TSE. */
(function () {
  "use strict";
  var D = "../data/eleicoes/";
  var REG = { N: "Norte", NE: "Nordeste", CO: "Centro-Oeste", SE: "Sudeste", S: "Sul", ZZ: "Exterior" };
  var REG_ORD = ["N", "NE", "CO", "SE", "S", "ZZ"];
  var NO_REG = { N: "No Norte", NE: "No Nordeste", CO: "No Centro-Oeste", SE: "No Sudeste", S: "No Sul", ZZ: "No exterior" };
  var UFN = { AC: "Acre", AL: "Alagoas", AM: "Amazonas", AP: "Amapá", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo",
    GO: "Goiás", MA: "Maranhão", MG: "Minas Gerais", MS: "Mato Grosso do Sul", MT: "Mato Grosso", PA: "Pará", PB: "Paraíba", PE: "Pernambuco",
    PI: "Piauí", PR: "Paraná", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RO: "Rondônia", RR: "Roraima", RS: "Rio Grande do Sul",
    SC: "Santa Catarina", SE: "Sergipe", SP: "São Paulo", TO: "Tocantins", ZZ: "Exterior" };
  var EM_UF = { AC: "no Acre", AL: "em Alagoas", AM: "no Amazonas", AP: "no Amapá", BA: "na Bahia", CE: "no Ceará", DF: "no Distrito Federal",
    ES: "no Espírito Santo", GO: "em Goiás", MA: "no Maranhão", MG: "em Minas Gerais", MS: "em Mato Grosso do Sul", MT: "em Mato Grosso",
    PA: "no Pará", PB: "na Paraíba", PE: "em Pernambuco", PI: "no Piauí", PR: "no Paraná", RJ: "no Rio de Janeiro", RN: "no Rio Grande do Norte",
    RO: "em Rondônia", RR: "em Roraima", RS: "no Rio Grande do Sul", SC: "em Santa Catarina", SE: "em Sergipe", SP: "em São Paulo",
    TO: "no Tocantins", ZZ: "no exterior" };
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  var UF_REG = {};
  Object.entries({ N: "AC AM AP PA RO RR TO", NE: "AL BA CE MA PB PE PI RN SE", CO: "DF GO MS MT", SE: "ES MG RJ SP", S: "PR RS SC" })
    .forEach(function (e) { e[1].split(" ").forEach(function (u) { UF_REG[u] = e[0]; }); });

  // ---------- utilidades
  var $ = function (id) { return document.getElementById(id); };
  var nf = new Intl.NumberFormat("pt-BR");
  var n = function (x) { return nf.format(Math.round(x || 0)); };
  function pc(x, d) { if (!isFinite(x)) return "—"; return (x * 100).toLocaleString("pt-BR", { minimumFractionDigits: d == null ? 1 : d, maximumFractionDigits: d == null ? 1 : d }) + "%"; }
  function pcR(x) { return Math.round(x * 100) + "%"; }
  function mi(x) {
    if (x >= 1e6) return (x / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: x >= 1e7 ? 1 : 2 }) + " mi";
    if (x >= 1e4) return Math.round(x / 1e3).toLocaleString("pt-BR") + " mil";
    return n(x);
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var cache = {};
  function get(path) {
    if (!cache[path]) cache[path] = fetch(D + path).then(function (r) { if (!r.ok) throw new Error(path + " " + r.status); return r.json(); });
    return cache[path];
  }
  function getAbs(url) {
    if (!cache[url]) cache[url] = fetch(url).then(function (r) { if (!r.ok) throw new Error(url + " " + r.status); return r.json(); });
    return cache[url];
  }
  function cor(i) { return i < 6 ? "var(--c" + (i + 1) + ")" : "var(--c0)"; }
  function turnoTxt(t) { return t === 2 ? "2º turno" : "1º turno"; }
  function err(el, msg) { el.innerHTML = '<p class="err">' + esc(msg || "Não foi possível carregar os dados agora. Tente recarregar a página.") + "</p>"; }
  function norm(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
  function opt(v, t, sel) { return '<option value="' + esc(v) + '"' + (sel ? " selected" : "") + ">" + esc(t) + "</option>"; }
  function qs(k) { try { return new URLSearchParams(location.search).get(k); } catch (e) { return null; } }

  var IDX = null, PRES = null, PRES_KEY = null;

  // ---------- barras de candidatos
  function candBars(cands, votes, val, max) {
    max = max || 6;
    var rows = cands.map(function (c, i) { return { c: c, i: i, v: votes[i] || 0 }; }).sort(function (a, b) { return b.v - a.v; });
    var shown = rows.slice(0, max), rest = rows.slice(max);
    var html = shown.map(function (r) {
      var p = val ? r.v / val : 0;
      var tag = r.c.eleito ? '<span class="ele-tag">eleito</span>' : (r.c["2t"] ? '<span class="ele-tag t2">foi ao 2º turno</span>' : "");
      return '<div class="ele-cand"><b>' + esc(r.c.nome) + "<small>" + esc(r.c.partido || "") + "</small>" + tag + '</b><span class="num">' + pc(p) + "<small>" + n(r.v) + ' votos</small></span><div class="bar"><span style="width:' + (p * 100).toFixed(2) + "%;background:" + cor(r.i) + '"></span></div></div>';
    }).join("");
    if (rest.length) {
      var rv = rest.reduce(function (s, r) { return s + r.v; }, 0);
      html += '<div class="ele-cand"><b>Outros ' + rest.length + " candidatos</b><span class=\"num\">" + pc(val ? rv / val : 0) + "<small>" + n(rv) + ' votos</small></span><div class="bar"><span style="width:' + (val ? rv / val * 100 : 0).toFixed(2) + '%;background:var(--muted-2)"></span></div></div>';
    }
    return '<div class="ele-cands">' + html + "</div>";
  }
  function stackBar(cands, votes, val, k) {
    k = k || 2;
    var rows = cands.map(function (c, i) { return { c: c, i: i, v: votes[i] || 0 }; }).sort(function (a, b) { return b.v - a.v; });
    var top = rows.slice(0, k), rest = rows.slice(k).reduce(function (s, r) { return s + r.v; }, 0);
    var h = top.map(function (r) {
      var p = val ? r.v / val : 0;
      return '<span style="width:' + (p * 100).toFixed(2) + "%;background:" + cor(r.i) + '" title="' + esc(r.c.nome) + " " + pc(p) + '">' + (p >= 0.09 ? pcR(p) : "") + "</span>";
    }).join("");
    if (rest > 0) h += '<span class="o" style="width:' + (rest / val * 100).toFixed(2) + '%" title="Outros ' + pc(rest / val) + '">' + (rest / val >= 0.09 ? pcR(rest / val) : "") + "</span>";
    return '<div class="ele-sbar" role="img" aria-label="' + esc(top.map(function (r) { return r.c.nome + " " + pc(val ? r.v / val : 0); }).join(", ")) + '">' + h + "</div>";
  }
  function legend(cands, k) {
    return cands.slice(0, k).map(function (c, i) { return '<span><i style="background:' + cor(i) + '"></i>' + esc(c.nome) + " (" + esc(c.partido) + ")</span>"; }).join("") + (cands.length > k ? '<span><i style="background:var(--c0)"></i>Outros</span>' : "");
  }
  function lider(d) {
    var best = -1, bi = 0, second = -1, si = 0;
    d.v.forEach(function (v, i) { if (v > best) { second = best; si = bi; best = v; bi = i; } else if (v > second) { second = v; si = i; } });
    return { i: bi, v: best, p: d.val ? best / d.val : 0, i2: si, v2: second, p2: d.val ? second / d.val : 0 };
  }

  // ---------- Presidente
  function presLabel(e) { return e.ano + " · " + turnoTxt(e.turno) + " (" + e.data + ")"; }
  function fillPresSelects() {
    var list = IDX.presidente.slice().reverse();
    var want = qs("e");
    var def = list[0];
    if (want) list.forEach(function (e) { if (e.ano + "-" + e.turno === want) def = e; });
    $("pr-sel").innerHTML = list.map(function (e) { return opt(e.ano + "-" + e.turno, presLabel(e), e === def); }).join("");
    $("cid-sel").innerHTML = list.filter(function (e) { return e.mun; }).map(function (e) { return opt(e.ano + "-" + e.turno, presLabel(e), e === def); }).join("");
    $("pr-sel").addEventListener("change", function () {
      var v = $("pr-sel").value;
      if ($("cid-sel").querySelector('option[value="' + v + '"]')) $("cid-sel").value = v;
      loadPres(v);
      try { var u = new URL(location.href); u.searchParams.set("e", v); history.replaceState(null, "", u); } catch (e) {}
    });
    $("cid-sel").addEventListener("change", function () { if (CID) showCidade(CID); });
    return def.ano + "-" + def.turno;
  }

  function loadPres(key) {
    PRES_KEY = key;
    $("pr-geral").innerHTML = '<div class="skeleton" style="height:160px"></div>';
    return get("pres/" + key + ".json").then(function (d) {
      if (PRES_KEY !== key) return;
      PRES = d;
      renderPres(d);
      renderExterior(d);
      if (CID) showCidade(CID);
      if (POLL) renderPollCmp(POLL);
    }).catch(function () { err($("pr-geral")); });
  }

  function renderPres(d) {
    var b = d.br, k = d.cands.length;
    var kp = "";
    if (b.apt) {
      kp = '<dl class="ele-kpis">' +
        "<div><dt>Podiam votar</dt><dd>" + mi(b.apt) + "<small>" + n(b.apt) + " eleitores</small></dd></div>" +
        "<div><dt>Foram votar</dt><dd>" + pc(b.comp / b.apt) + "<small>" + n(b.comp) + " pessoas</small></dd></div>" +
        "<div><dt>Não foram</dt><dd>" + pc(1 - b.comp / b.apt) + "<small>" + n(b.apt - b.comp) + " pessoas</small></dd></div>" +
        "<div><dt>Brancos e nulos</dt><dd>" + pc((b.br + b.nu) / b.comp) + "<small>" + n(b.br) + " brancos · " + n(b.nu) + " nulos</small></dd></div>" +
        "</dl>";
    } else {
      kp = '<p class="note-sm">Para 1989 o arquivo do TSE traz só os votos de cada candidato por estado (sem brancos, nulos e comparecimento, e sem cidades).</p>';
    }
    $("pr-geral").innerHTML = '<div class="ele-res-grid"><div class="pol-card"><h3 class="h-sm" style="margin-top:0">Brasil inteiro · ' + esc(d.ano) + " · " + turnoTxt(d.turno) + "</h3>" + candBars(d.cands, b.v, b.val, d.turno === 2 ? 2 : 6) + '<p class="note-sm">Porcentagem dos votos válidos. Total de votos válidos: ' + n(b.val) + ".</p></div>" + kp + "</div>";

    // frases
    var fr = [];
    var L = lider(b), c0 = d.cands[L.i];
    var quando = (d.turno === 2 ? "no 2º turno de " : "no 1º turno de ") + d.ano;
    if (c0.eleito && d.turno === 2) fr.push(c0.nome + " (" + c0.partido + ") venceu " + quando + " com " + pc(L.p) + " dos votos válidos, contra " + pc(L.p2) + " de " + d.cands[L.i2].nome + ".");
    else if (c0.eleito) fr.push(c0.nome + " (" + c0.partido + ") venceu já no 1º turno de " + d.ano + ", com " + pc(L.p) + " dos votos válidos (mais da metade).");
    else fr.push(c0.nome + " (" + c0.partido + ") ficou em primeiro " + quando + ", com " + pc(L.p) + " dos votos válidos; " + d.cands[L.i2].nome + " teve " + pc(L.p2) + ".");
    REG_ORD.forEach(function (r) {
      var x = d.reg[r]; if (!x || !x.val) return;
      var l = lider(x);
      var s = NO_REG[r] + ", " + d.cands[l.i].nome + " teve " + pcR(l.p) + (d.turno === 2 ? "" : " e ficou em primeiro") + "; " + d.cands[l.i2].nome + " teve " + pcR(l.p2) + ".";
      fr.push(s);
    });
    var wins = {};
    Object.keys(d.uf).forEach(function (u) { if (u === "ZZ") return; var l = lider(d.uf[u]); wins[l.i] = (wins[l.i] || 0) + 1; });
    var wl = Object.keys(wins).sort(function (a, b) { return wins[b] - wins[a]; });
    fr.push("Nos estados: " + wl.map(function (i) { return d.cands[i].nome + " ficou em primeiro em " + wins[i] + (wins[i] === 1 ? " estado" : " estados"); }).join("; ") + " (o Distrito Federal conta como estado).");
    if (b.apt) fr.push(pc(1 - b.comp / b.apt) + " dos eleitores não foram votar, e " + pc((b.br + b.nu) / b.comp) + " de quem foi votou em branco ou anulou.");
    $("pr-frases").innerHTML = fr.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("");

    // regiões
    $("pr-reg").innerHTML = REG_ORD.filter(function (r) { return d.reg[r] && d.reg[r].val; }).map(function (r) {
      var x = d.reg[r];
      return '<div class="ele-srow"><b>' + REG[r] + "<small>" + mi(x.val) + " votos válidos</small></b>" + stackBar(d.cands, x.v, x.val, 2) + "</div>";
    }).join("") + '<div class="eco-legend">' + legend(d.cands, 2) + "</div>";

    // tabela por estado
    var ufs = Object.keys(d.uf).filter(function (u) { return u !== "ZZ"; }).sort(function (a, b) { return UFN[a].localeCompare(UFN[b], "pt-BR"); });
    if (d.uf.ZZ) ufs.push("ZZ");
    $("pr-tab").querySelector("tbody").innerHTML = ufs.map(function (u) {
      var x = d.uf[u], l = lider(x);
      return '<tr><th scope="row">' + esc(UFN[u] || u) + "</th><td>" + esc(d.cands[l.i].nome) + " · <b>" + pc(l.p) + "</b></td><td>" + esc(d.cands[l.i2].nome) + " · " + pc(l.p2) + "</td><td>" + (x.apt ? pc(x.comp / x.apt) : "—") + "</td><td>" + (x.comp ? pc((x.br + x.nu) / x.comp) : "—") + "</td></tr>";
    }).join("");

    drawMap(d);
  }

  var GEO = null, SEL_UF = null;
  function drawMap(d) {
    var box = $("pr-mapa");
    (GEO || (GEO = getAbs("../data/mapa/geo/br.json"))).then(function (g) {
      if (PRES !== d) return;
      var vb = g.viewBox;
      var paths = "", labels = "";
      Object.keys(g.ufs).forEach(function (u) {
        var x = d.uf[u]; var fill = "var(--c0)", op = 1, lab = UFN[u];
        if (x && x.val) {
          var l = lider(x);
          fill = cor(l.i);
          op = Math.max(0.35, Math.min(1, 0.35 + (l.p - l.p2) / 0.5 * 0.65));
          lab = UFN[u] + ": " + d.cands[l.i].nome + " " + pc(l.p);
        }
        paths += '<path d="' + g.ufs[u].d + '" data-uf="' + u + '" tabindex="0" role="button" aria-label="' + esc(lab) + '" style="fill:' + fill + ";fill-opacity:" + op.toFixed(2) + '"' + (u === SEL_UF ? ' class="is-sel"' : "") + "><title>" + esc(lab) + "</title></path>";
        var c = g.ufs[u].c;
        if (c) labels += '<text x="' + c[0] + '" y="' + c[1] + '" text-anchor="middle" dominant-baseline="middle">' + u + "</text>";
      });
      box.innerHTML = '<svg viewBox="' + vb + '" role="group" aria-label="Mapa do Brasil por estado">' + paths + labels + "</svg>";
      box.querySelectorAll("path").forEach(function (p) {
        var go = function () { showUF(p.getAttribute("data-uf")); };
        p.addEventListener("click", go);
        p.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
      });
      var lg = '<span>Cor = quem ficou em primeiro:</span>' + d.cands.slice(0, 6).map(function (c, i) {
        var tem = Object.keys(d.uf).some(function (u) { return u !== "ZZ" && lider(d.uf[u]).i === i; });
        return tem ? '<span><i style="background:' + cor(i) + '"></i>' + esc(c.nome) + "</span>" : "";
      }).join("");
      $("pr-leg").innerHTML = lg;
      if (SEL_UF) showUF(SEL_UF);
    }).catch(function () { err(box, "Não foi possível carregar o mapa."); });
  }
  function showUF(u) {
    SEL_UF = u;
    var d = PRES; if (!d || !d.uf[u]) return;
    $("pr-mapa").querySelectorAll("path").forEach(function (p) { p.classList.toggle("is-sel", p.getAttribute("data-uf") === u); });
    var x = d.uf[u], l = lider(x);
    var s = cap(EM_UF[u]) + ", " + d.cands[l.i].nome + " teve " + pc(l.p) + " dos votos válidos " + (d.turno === 2 ? "no 2º turno" : "no 1º turno") + " de " + d.ano + ".";
    $("pr-uf").innerHTML = "<h4>" + esc(UFN[u]) + " <small class=\"muted\">· " + REG[UF_REG[u]] + "</small></h4><p>" + esc(s) + "</p>" + candBars(d.cands, x.v, x.val, d.turno === 2 ? 2 : 4) +
      (x.apt ? '<p class="note-sm">Foram votar ' + pc(x.comp / x.apt) + " dos " + n(x.apt) + " eleitores. Brancos e nulos: " + pc((x.br + x.nu) / x.comp) + ".</p>" : "") +
      '<a class="ele-link" href="/politica/mapa/?uf=' + u + '">Ver ' + esc(UFN[u]) + " no mapa (cidades, gastos, políticos) →</a>";
  }

  // ---------- Cidade
  var MUNS = null, CID = null;
  function initCidade() {
    var q = $("cid-q"), lista = $("cid-lista");
    var load = function () { return MUNS || (MUNS = getAbs("../data/mapa/municipios.json").then(function (j) { return j.municipios.map(function (m) { return { ib: m[0], nome: m[1], uf: m[2], pop: m[3], k: norm(m[1]) }; }); })); };
    q.addEventListener("focus", load, { once: true });
    var t = null;
    q.addEventListener("input", function () {
      clearTimeout(t);
      t = setTimeout(function () {
        var s = norm(q.value);
        if (s.length < 2) { lista.innerHTML = ""; return; }
        load().then(function (ms) {
          var a = ms.filter(function (m) { return m.k.indexOf(s) === 0; }), b = ms.filter(function (m) { return m.k.indexOf(s) > 0; });
          var r = a.concat(b).sort(function (x, y) { return (x.k.indexOf(s) === 0 ? 0 : 1) - (y.k.indexOf(s) === 0 ? 0 : 1) || y.pop - x.pop; }).slice(0, 8);
          lista.innerHTML = r.length ? r.map(function (m) { return '<li><button type="button" data-ib="' + m.ib + '">' + esc(m.nome) + "<small>" + m.uf + " · " + n(m.pop) + " hab.</small></button></li>"; }).join("") : '<li class="muted note-sm">Nenhuma cidade com esse nome.</li>';
          lista.querySelectorAll("button").forEach(function (bt) {
            bt.addEventListener("click", function () {
              var ib = +bt.getAttribute("data-ib");
              var m = ms.filter(function (x) { return x.ib === ib; })[0];
              q.value = m.nome + " (" + m.uf + ")"; lista.innerHTML = "";
              showCidade(m);
            });
          });
        });
      }, 120);
    });
    var m0 = qs("m");
    if (m0) load().then(function (ms) { var m = ms.filter(function (x) { return String(x.ib) === m0; })[0]; if (m) { q.value = m.nome + " (" + m.uf + ")"; showCidade(m); } });
  }
  function showCidade(m) {
    CID = m;
    var key = $("cid-sel").value, box = $("cid-res");
    box.innerHTML = '<div class="skeleton" style="height:120px"></div>';
    Promise.all([get("pres/" + key + ".json"), get("pres/" + key + "-mun.json")]).then(function (r) {
      if (CID !== m || $("cid-sel").value !== key) return;
      var d = r[0], mm = r[1], row = mm.m[String(m.ib)];
      if (!row) { box.innerHTML = '<p class="ele-vazio">Não há resultado de ' + esc(m.nome) + " nesta eleição (a cidade pode ter sido criada depois).</p>"; return; }
      var k = mm.k, val = row[k], votes = row.slice(0, k);
      var outros = val - votes.reduce(function (s, v) { return s + v; }, 0);
      var cands = d.cands.slice(0, k);
      var l = lider({ v: votes, val: val });
      var apt = row[k + 1], comp = row[k + 2], br = row[k + 3], nu = row[k + 4];
      var s = "Em " + m.nome + " (" + m.uf + "), " + cands[l.i].nome + " teve " + pc(l.p) + " dos votos válidos " + (d.turno === 2 ? "no 2º turno" : "no 1º turno") + " de " + d.ano + ".";
      var regx = d.reg[UF_REG[m.uf]], ufx = d.uf[m.uf];
      var cmp = "";
      if (ufx && regx) {
        var pi = l.i;
        cmp = cap(EM_UF[m.uf]) + ", " + cands[pi].nome + " teve " + pc(ufx.v[pi] / ufx.val) + "; na região " + REG[UF_REG[m.uf]] + ", " + pc(regx.v[pi] / regx.val) + "; no Brasil, " + pc(d.br.v[pi] / d.br.val) + ".";
      }
      var bars = candBars(cands, votes, val, k);
      if (outros > 0) bars = bars.replace('</div>', '</div>') + '<p class="note-sm">Outros candidatos somados: ' + pc(outros / val) + " (" + n(outros) + " votos).</p>";
      box.innerHTML = '<div class="ele-res-grid"><div class="pol-card"><h3 class="h-sm" style="margin-top:0">' + esc(m.nome) + " (" + m.uf + ") · " + d.ano + " · " + turnoTxt(d.turno) + "</h3>" + bars +
        '<a class="ele-link" href="/politica/mapa/?m=' + m.ib + '">Ver ' + esc(m.nome) + " no mapa →</a></div>" +
        (apt ? '<dl class="ele-kpis"><div><dt>Podiam votar</dt><dd>' + n(apt) + "</dd></div><div><dt>Foram votar</dt><dd>" + pc(comp / apt) + "<small>" + n(comp) + " pessoas</small></dd></div><div><dt>Votos válidos</dt><dd>" + n(val) + "</dd></div><div><dt>Brancos e nulos</dt><dd>" + pc((br + nu) / comp) + "<small>" + n(br) + " brancos · " + n(nu) + " nulos</small></dd></div></dl>" : "") +
        '</div><ul class="ele-frases"><li>' + esc(s) + "</li>" + (cmp ? "<li>" + esc(cmp) + "</li>" : "") + "</ul>";
    }).catch(function () { err(box); });
  }

  // ---------- Exterior
  function renderExterior(d) {
    var box = $("ex-res"), e = d.ext || {}, ps = e.paises || [];
    var x = d.uf.ZZ;
    if (!x || !ps.length) {
      box.innerHTML = '<p class="ele-vazio">' + (d.ano === 1989 ? "Para 1989 o TSE publica só o total do exterior, sem separar por país." : "Sem dados do exterior para esta eleição.") + (x ? " Total de votos válidos no exterior: " + n(x.val) + "." : "") + "</p>";
      return;
    }
    var k = Math.min(d.cands.length, d.turno === 2 ? 2 : 4);
    var l = lider(x);
    var fr = ["No exterior, " + d.cands[l.i].nome + " teve " + pc(l.p) + " dos votos válidos " + (d.turno === 2 ? "no 2º turno" : "no 1º turno") + " de " + d.ano + " (" + n(x.val) + " votos válidos, em " + ps.length + " países)."];
    var top = ps.slice(0, 3).map(function (p) { var s = 0; for (var i = 1; i < p.length; i++) s += p[i]; return { nome: p[0], s: s, v: p.slice(1) }; });
    fr.push("Os países com mais votos foram " + top.map(function (t) { var li = lider({ v: t.v, val: t.s }); return t.nome + " (" + n(t.s) + " votos; " + d.cands[li.i].nome + " " + pcR(li.p) + ")"; }).join(", ") + ".");
    var NX = window.innerWidth < 720 ? 6 : 12;
    var card = function (p) {
      var v = p.slice(1), s = v.reduce(function (a, b) { return a + b; }, 0);
      return '<div class="ele-mini"><h4>' + esc(p[0]) + " <small>· " + n(s) + " votos</small></h4>" + stackBar(d.cands, v, s, Math.min(k, 2)) + "</div>";
    };
    box.innerHTML = '<div class="ele-res-grid"><div class="pol-card"><h3 class="h-sm" style="margin-top:0">Exterior inteiro</h3>' + candBars(d.cands, x.v, x.val, k) +
      (x.apt ? '<p class="note-sm">Podiam votar ' + n(x.apt) + "; foram " + n(x.comp) + " (" + pc(x.comp / x.apt) + ").</p>" : "") + "</div>" +
      '<ul class="ele-frases" style="margin:0">' + fr.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul></div>" +
      '<h3 class="h-sm">Países com mais votos</h3><div class="ele-cards" id="ex-paises">' + ps.slice(0, NX).map(card).join("") + "</div>" +
      (ps.length > NX ? '<button class="ele-btn ele-mais" type="button" id="ex-mais">Ver todos os ' + ps.length + " países</button>" : "") +
      '<div class="eco-legend">' + legend(d.cands, 2) + "</div>" +
      '<p class="note-sm">País do posto de votação (embaixada ou consulado). Algumas cidades recebem eleitores de países vizinhos.</p>';
    var bm = $("ex-mais");
    if (bm) bm.addEventListener("click", function () { $("ex-paises").innerHTML = ps.map(card).join(""); bm.remove(); });
  }

  // ---------- Partidos
  var RES = null, HIST = null;
  var CARGO_ORD = ["6", "5", "3", "7", "1", "11", "13"];
  function initPartidos() {
    Promise.all([get("partidos/resumo.json"), get("partidos-historia.json")]).then(function (r) {
      RES = r[0]; HIST = r[1];
      var anos = Object.keys(RES.anos).sort().reverse();
      $("pa-ano").innerHTML = anos.map(function (a) { return opt(a, a + (RES.anos[a].tipo === "municipal" ? " · cidades" : " · geral"), a === anos[0]); }).join("");
      $("pa-ano").addEventListener("change", function () { fillCargo(); renderRank(); });
      $("pa-cargo").addEventListener("change", function () { renderRank(); });
      $("pa-lugar").addEventListener("change", renderRank);
      $("pa-lugar").innerHTML = opt("BR", "Brasil inteiro", true) + REG_ORD.filter(function (r) { return r !== "ZZ"; }).map(function (r) { return opt(r, REG[r]); }).join("") +
        '<optgroup label="Estados">' + Object.keys(UFN).filter(function (u) { return u !== "ZZ"; }).sort(function (a, b) { return UFN[a].localeCompare(UFN[b], "pt-BR"); }).map(function (u) { return opt("uf:" + u, UFN[u]); }).join("") + "</optgroup>";
      fillCargo(); renderRank();
      // linha do tempo
      var cs = ["6", "7", "5", "3", "11", "13"];
      $("tl-cargo").innerHTML = cs.map(function (c) { return opt(c, RES.cargos[c], c === "6"); }).join("");
      $("tl-cargo").addEventListener("change", drawTL);
      $("tl-junta").addEventListener("change", drawTL);
      drawTL();
      if ("ResizeObserver" in window) { var w0 = 0; new ResizeObserver(function () { var w = $("tl-chart").clientWidth; if (Math.abs(w - w0) > 8) { w0 = w; drawTL(); } }).observe($("tl-chart")); }
      $("hist-nota").textContent = HIST.nota;
      $("hist").innerHTML = HIST.eventos.map(function (e) { return "<li><b>" + esc(e[0]) + "</b><span>" + esc(e[1]) + "</span></li>"; }).join("");
    }).catch(function () { err($("pa-rank")); });
  }
  function fillCargo() {
    var a = RES.anos[$("pa-ano").value], cur = $("pa-cargo").value;
    var cs = CARGO_ORD.filter(function (c) { return a.cargos[c]; });
    if (cs.indexOf(cur) < 0) cur = a.tipo === "municipal" ? "13" : "6";
    $("pa-cargo").innerHTML = cs.map(function (c) { return opt(c, RES.cargos[c], c === cur); }).join("");
  }
  function renderRank() {
    var ano = $("pa-ano").value, c = $("pa-cargo").value, lugar = $("pa-lugar").value;
    var box = $("pa-rank");
    var p;
    if (lugar.indexOf("uf:") === 0) {
      var u = lugar.slice(3);
      box.innerHTML = '<div class="skeleton" style="height:200px"></div>';
      p = get("partidos/" + ano + ".json").then(function (d) {
        var ps = (d.cargos[c] && d.cargos[c].uf[u]) || {}, o = {};
        Object.keys(ps).forEach(function (sg) { o[sg] = [ps[sg][0] + ps[sg][1], ps[sg][2]]; });
        return { dados: o, onde: UFN[u], em: EM_UF[u], pend: d.pendente_2t && d.pendente_2t[c] && d.pendente_2t[c][u] };
      });
    } else {
      var x = RES.anos[ano].cargos[c] || {};
      p = Promise.resolve({ dados: x[lugar] || {}, onde: lugar === "BR" ? "Brasil" : REG[lugar], em: lugar === "BR" ? "no Brasil" : NO_REG[lugar].replace(/^No /, "no "), pend: null });
    }
    p.then(function (r) {
      if ($("pa-ano").value !== ano || $("pa-cargo").value !== c || $("pa-lugar").value !== lugar) return;
      var rows = Object.keys(r.dados).map(function (sg) { return { sg: sg, v: r.dados[sg][0], e: r.dados[sg][1] }; }).filter(function (x) { return x.v > 0 || x.e > 0; }).sort(function (a, b) { return b.v - a.v || b.e - a.e; });
      if (!rows.length) { box.innerHTML = '<p class="ele-vazio">Sem votos para este cargo neste lugar.</p>'; $("pa-frases").innerHTML = ""; return; }
      var tot = rows.reduce(function (s, x) { return s + x.v; }, 0), etot = rows.reduce(function (s, x) { return s + x.e; }, 0);
      var max = rows[0].v;
      var semVagas = c === "1";
      var nome = function (sg) { return (RES.nomes[sg] || "").replace(/'/g, "’"); };
      var row = function (x, i) {
        return '<div class="ele-prow"><i>' + (i + 1) + '</i><b title="' + esc(nome(x.sg)) + '">' + esc(x.sg) + '</b><div class="bar"><span style="width:' + (x.v / max * 100).toFixed(2) + '%"></span></div><span class="num">' + pc(x.v / tot) + "<small>" + mi(x.v) + (semVagas ? "" : " · " + x.e + (x.e === 1 ? " eleito" : " eleitos")) + "</small></span></div>";
      };
      var N0 = 15;
      box.innerHTML = rows.slice(0, N0).map(row).join("") + (rows.length > N0 ? '<button class="ele-btn ele-mais" type="button" id="pa-mais">Ver todos os ' + rows.length + " partidos</button>" : "");
      var bm = $("pa-mais"); if (bm) bm.addEventListener("click", function () { box.innerHTML = rows.map(row).join(""); });
      var cargo = RES.cargos[c].toLowerCase();
      var fr = [];
      fr.push("Em " + ano + ", para " + cargo + ", o partido com mais votos " + r.em + " foi o " + rows[0].sg + (nome(rows[0].sg) ? " (" + nome(rows[0].sg) + ")" : "") + ", com " + pc(rows[0].v / tot) + " dos votos" + (rows[1] ? "; depois vieram " + rows[1].sg + " (" + pc(rows[1].v / tot) + ")" + (rows[2] ? " e " + rows[2].sg + " (" + pc(rows[2].v / tot) + ")" : "") : "") + ".");
      if (!semVagas && etot) {
        var em = rows.slice().sort(function (a, b) { return b.e - a.e || b.v - a.v; });
        fr.push("O que mais elegeu foi o " + em[0].sg + ": " + em[0].e + " de " + etot + (etot === 1 ? " vaga" : " vagas") + " " + r.em + (em[0].sg !== rows[0].sg ? " (não é o mesmo partido mais votado: as vagas dependem da soma de votos de cada partido ou federação e das regras de divisão)." : "."));
      }
      $("pa-frases").innerHTML = fr.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("");
      var notas = [];
      if (c === "1") notas.push("Presidente: votos do 1º turno. Quem ganhou está na seção Presidente.");
      if (c === "3" || c === "11") notas.push("Governador e prefeito: votos do 1º turno (no 2º turno as mesmas pessoas votam de novo). Os eleitos contam os dois turnos.");
      if (c === "5") notas.push("Senado: em alguns anos cada eleitor vota em dois candidatos, por isso o total de votos pode passar do número de eleitores.");
      if (c === "6" || c === "7" || c === "13") notas.push("Votos = voto no candidato + voto só no número do partido (legenda).");
      if (RES.anos[ano].pend && (c === "3")) notas.push("Em " + ano + " o 2º turno para governador ainda não aconteceu em alguns estados: os eleitos desses estados entram quando o TSE publicar o resultado.");
      notas.push("Partidos com nome antigo aparecem com a sigla da época. Fonte: TSE.");
      $("pa-nota").textContent = notas.join(" ");
    }).catch(function () { err(box); });
  }

  function drawTL() {
    if (!RES) return;
    var c = $("tl-cargo").value, junta = $("tl-junta").checked;
    var mapa = {};
    if (junta) Object.keys(HIST.linhagem).forEach(function (k) { HIST.linhagem[k].forEach(function (o) { mapa[o] = k; }); });
    var keyOf = function (sg) { var k = sg, g = 0; while (mapa[k] && g++ < 5) k = mapa[k]; return k; };
    var anos = Object.keys(RES.anos).filter(function (a) { return RES.anos[a].cargos[c] && RES.anos[a].cargos[c].BR; }).sort();
    var serie = {}, tot = {};
    anos.forEach(function (a) {
      var ps = RES.anos[a].cargos[c].BR, t = 0;
      Object.keys(ps).forEach(function (sg) { var k = keyOf(sg); serie[k] = serie[k] || {}; serie[k][a] = (serie[k][a] || 0) + ps[sg][0]; t += ps[sg][0]; });
      tot[a] = t;
    });
    // 6 partidos com maior soma de participação
    var score = Object.keys(serie).map(function (k) { var s = 0; anos.forEach(function (a) { s += (serie[k][a] || 0) / tot[a]; }); return { k: k, s: s }; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 6);
    var box = $("tl-chart");
    var W = Math.max(280, box.clientWidth || 600), H = W < 520 ? 260 : 320;
    var m = { l: 40, r: 12, t: 14, b: 28 };
    var maxP = 0;
    score.forEach(function (s) { anos.forEach(function (a) { maxP = Math.max(maxP, (serie[s.k][a] || 0) / tot[a]); }); });
    maxP = Math.ceil(maxP * 20) / 20 || 0.1;
    var x = function (i) { return m.l + (anos.length < 2 ? 0 : i * (W - m.l - m.r) / (anos.length - 1)); };
    var y = function (p) { return H - m.b - p / maxP * (H - m.t - m.b); };
    var ax = "";
    for (var g = 0; g <= maxP + 1e-9; g += maxP > 0.3 ? 0.1 : 0.05) ax += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(g) + '" y2="' + y(g) + '"/><text x="' + (m.l - 6) + '" y="' + (y(g) + 4) + '" text-anchor="end">' + Math.round(g * 100) + "%</text>";
    var step = W < 520 ? Math.ceil(anos.length / 5) : 1;
    anos.forEach(function (a, i) { if (i % step === 0 || i === anos.length - 1) ax += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + (W < 520 ? "’" + a.slice(2) : a) + "</text>"; });
    var lines = score.map(function (s, j) {
      var pts = [], segs = [], cur = [];
      anos.forEach(function (a, i) { var v = serie[s.k][a]; if (v) cur.push(x(i).toFixed(1) + "," + y(v / tot[a]).toFixed(1)); else if (cur.length) { segs.push(cur); cur = []; } });
      if (cur.length) segs.push(cur);
      return segs.map(function (sg) { return sg.length > 1 ? '<polyline class="ln" points="' + sg.join(" ") + '" style="stroke:' + cor(j) + '"/>' : '<circle cx="' + sg[0].split(",")[0] + '" cy="' + sg[0].split(",")[1] + '" r="3.5" style="fill:' + cor(j) + '"/>'; }).join("");
    }).join("");
    box.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '"><g class="ax">' + ax + "</g>" + lines + '<line class="guide" id="tl-g" y1="' + m.t + '" y2="' + (H - m.b) + '" style="display:none"/></svg><div class="eco-tip" id="tl-tip" hidden></div>';
    $("tl-leg").innerHTML = score.map(function (s, j) { return '<span><i style="background:' + cor(j) + '"></i>' + esc(s.k) + "</span>"; }).join("");
    var svg = box.querySelector("svg"), tip = $("tl-tip"), gl = $("tl-g");
    var show = function (cx) {
      var r = svg.getBoundingClientRect(), px = (cx - r.left) * W / r.width;
      var i = Math.round((px - m.l) / ((W - m.l - m.r) / Math.max(1, anos.length - 1)));
      i = Math.max(0, Math.min(anos.length - 1, i));
      var a = anos[i];
      gl.setAttribute("x1", x(i)); gl.setAttribute("x2", x(i)); gl.style.display = "";
      tip.hidden = false;
      tip.innerHTML = "<b>" + a + "</b>" + score.map(function (s, j) { var v = serie[s.k][a]; return "<div><span><i style=\"background:" + cor(j) + '"></i>' + esc(s.k) + "</span><em>" + (v ? pc(v / tot[a]) : "—") + "</em></div>"; }).join("");
      var left = x(i) / W * box.clientWidth;
      tip.style.left = Math.max(8, Math.min(box.clientWidth - tip.offsetWidth - 8, left + 12)) + "px";
    };
    svg.addEventListener("pointermove", function (e) { show(e.clientX); });
    svg.addEventListener("pointerdown", function (e) { show(e.clientX); });
    svg.addEventListener("pointerleave", function () { tip.hidden = true; gl.style.display = "none"; });
    // tabela
    var th = "<thead><tr><th scope=\"col\">Partido</th>" + anos.map(function (a) { return '<th scope="col">' + a + "</th>"; }).join("") + "</tr></thead>";
    var tb = score.map(function (s) { return '<tr><th scope="row">' + esc(s.k) + "</th>" + anos.map(function (a) { var v = serie[s.k][a]; return '<td class="num">' + (v ? pc(v / tot[a]) : "—") + "</td>"; }).join("") + "</tr>"; }).join("");
    $("tl-tab").innerHTML = th + "<tbody>" + tb + "</tbody>";
  }

  // ---------- Presídios
  function initPresidios() {
    get("especiais.json").then(function (d) {
      var ops = [];
      Object.keys(d.presos).sort().reverse().forEach(function (a) { d.presos[a].slice().reverse().forEach(function (t) { ops.push([a + "-" + t.turno, a + " · " + turnoTxt(t.turno)]); }); });
      $("pp-sel").innerHTML = ops.map(function (o, i) { return opt(o[0], o[1], i === 0); }).join("");
      var draw = function () {
        var v = $("pp-sel").value.split("-"), x = d.presos[v[0]].filter(function (t) { return String(t.turno) === v[1]; })[0];
        var val = x.total.v.reduce(function (s, a) { return s + a; }, 0);
        var cands = x.cands.map(function (c) { return { nome: c.nome.split(" ").length > 3 ? c.nome.split(" ").slice(0, 2).join(" ") : c.nome, partido: "nº " + c.nr }; });
        if (PRES_ALL[v[0] + "-" + v[1]]) cands = x.cands.map(function (c) { var p = PRES_ALL[v[0] + "-" + v[1]].filter(function (q) { return q.nr === c.nr; })[0]; return { nome: p ? p.nome : c.nome, partido: p ? p.partido : "" }; });
        var l = lider({ v: x.total.v, val: val });
        var comp = val + x.total.br + x.total.nu;
        var fr = [
          "Em " + v[0] + " (" + turnoTxt(+v[1]) + "), " + n(comp) + " votos foram dados em " + x.secoes + " seções de " + x.locais + " presídios e unidades de internação, em " + x.ufs + " estados.",
          "Nessas seções, " + cands[l.i].nome + " teve " + pc(l.p) + " dos votos válidos; " + cands[l.i2].nome + " teve " + pc(l.p2) + "."
        ];
        var pa = x.presidio, ad = x.adolescentes;
        var sv = function (g) { return g.v.reduce(function (s, a) { return s + a; }, 0); };
        if (PRES && String(PRES.ano) === v[0] && String(PRES.turno) === v[1]) {
          var ib = PRES.cands.map(function (c) { return c.nr; }).indexOf(x.cands[l.i].nr);
          if (ib >= 0) fr.push("Para comparar: no Brasil inteiro, " + PRES.cands[ib].nome + " teve " + pc(PRES.br.v[ib] / PRES.br.val) + ".");
        }
        var card = function (t, g) { var s = sv(g); return '<div class="ele-mini"><h4>' + t + " <small>· " + g.locais + " locais · " + n(s) + " votos válidos</small></h4>" + (s ? stackBar(cands, g.v, s, 2) : '<p class="note-sm">Sem votos.</p>') + "</div>"; };
        var ufRows = Object.keys(x.uf).sort(function (a, b) { return sv(x.uf[b]) - sv(x.uf[a]); }).map(function (u) {
          var g = x.uf[u], s = sv(g), li = lider({ v: g.v, val: s });
          return '<tr><th scope="row">' + esc(UFN[u]) + '</th><td class="num">' + n(s) + "</td><td>" + (s ? esc(cands[li.i].nome) + " · " + pc(li.p) : "—") + '</td><td class="num">' + n(g.br + g.nu) + "</td></tr>";
        }).join("");
        $("pp-res").innerHTML = '<ul class="ele-frases" style="margin-top:0">' + fr.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul>" +
          '<div class="ele-res-grid" style="margin-top:14px"><div class="pol-card"><h3 class="h-sm" style="margin-top:0">Todas as seções especiais</h3>' + candBars(cands, x.total.v, val, +v[1] === 2 ? 2 : 4) + '<p class="note-sm">Brancos: ' + n(x.total.br) + " · nulos: " + n(x.total.nu) + ".</p></div>" +
          '<div class="ele-cards" style="grid-template-columns:1fr">' + card("Presídios e cadeias (adultos)", pa) + card("Unidades de internação de adolescentes", ad) + "</div></div>" +
          '<details class="eco-tabela"><summary>Ver por estado</summary><div class="table-wrap"><table class="data-table tabela-cards"><thead><tr><th scope="col">Estado</th><th scope="col">Votos válidos</th><th scope="col">1º lugar</th><th scope="col">Brancos e nulos</th></tr></thead><tbody>' + ufRows + "</tbody></table></div></details>" +
          '<p class="ele-explica">São poucos votos perto do total do país: só vota quem tem título de eleitor em dia e está num local onde a Justiça Eleitoral instalou seção. ' +
          "Cadastradas no TSE como “Preso provisório” neste turno: " + n(x.cadastradas || x.secoes) + " seções; aqui entram as " + n(x.secoes) + " que tiveram votação própria (as outras foram juntadas a outra seção ou não receberam eleitores). " +
          "A separação entre presídios e unidades de adolescentes é feita pelo nome do local (ex.: “Fundação Casa”, “Centro Socioeducativo”).</p>";
      };
      $("pp-sel").addEventListener("change", draw);
      PRES_ALL_P.then(draw, draw);
    }).catch(function () { err($("pp-res")); });
  }
  // nomes curtos dos candidatos de cada eleição (para presídios)
  var PRES_ALL = {};
  var PRES_ALL_P = Promise.resolve();
  function loadPresNames(keys) {
    PRES_ALL_P = Promise.all(keys.map(function (k) { return get("pres/" + k + ".json").then(function (d) { PRES_ALL[k] = d.cands; }).catch(function () {}); }));
    return PRES_ALL_P;
  }

  // ---------- Pesquisas
  var POLLS = null, POLL = null;
  function initPesquisas() {
    get("pesquisas.json").then(function (d) {
      POLLS = d.pesquisas;
      if (d.aviso) $("gr-aviso").textContent = d.aviso;
      $("gr-sel").innerHTML = POLLS.map(function (p, i) { return opt(p.id, p.ano + " · " + turnoTxt(p.turno) + " · " + p.instituto + " (" + p.campo + ")", i === 0); }).join("");
      $("gr-sel").addEventListener("change", function () { renderPoll(POLLS.filter(function (p) { return p.id === $("gr-sel").value; })[0]); });
      renderPoll(POLLS[0]);
      $("fontes-pesq").innerHTML = POLLS.map(function (p) { return "<li>" + esc(p.instituto) + ", " + esc(p.campo) + " (registro " + esc(p.registro) + "): <a href=\"" + esc(p.pdf) + '" rel="noopener">tabelas (PDF)</a>' + (p.pagina ? ' · <a href="' + esc(p.pagina) + '" rel="noopener">reportagem</a>' : "") + "</li>"; }).join("") + "<li>" + esc(d.como_ler || "") + "</li>";
    }).catch(function () { err($("gr-res")); });
  }
  function renderPoll(p) {
    POLL = p;
    var cands = p.cands.map(function (c) { return { nome: c[0], partido: c[1] }; });
    $("gr-ficha").innerHTML = "<b>" + esc(p.instituto) + "</b> · entrevistas de " + esc(p.campo) + " · " + n(p.entrevistas) + " pessoas em " + n(p.municipios) + " cidades · margem de erro de " + p.margem + " pontos para mais ou para menos (total) · registro no TSE " + esc(p.registro) + " · contratada por " + esc(p.contratantes) + ". Base: " + esc(p.base) + ". " +
      '<a href="' + esc(p.pdf) + '" rel="noopener">Ver as tabelas originais</a>' + (p.nota ? '<br><span class="note-sm">' + esc(p.nota) + "</span>" : "");
    var row = function (lab, a) {
      var v = a.slice(0, cands.length), s = v.reduce(function (x, y) { return x + y; }, 0);
      var out = Math.max(0, 100 - s);
      var bars = v.map(function (x, i) { return '<span style="width:' + x + "%;background:" + cor(i) + '">' + (x >= 9 ? x + "%" : "") + "</span>"; }).join("") + (out > 0.5 ? '<span class="o" style="width:' + out + '%">' + (out >= 9 ? Math.round(out) + "%" : "") + "</span>" : "");
      return '<div class="ele-grow"><div>' + esc(lab) + "<span>" + v.map(function (x, i) { return cands[i].nome.split(" ")[0] + " " + x + "%"; }).join(" · ") + '</span></div><div class="ele-sbar" role="img" aria-label="' + esc(lab + ": " + v.map(function (x, i) { return cands[i].nome + " " + x + "%"; }).join(", ")) + '">' + bars + "</div></div>";
    };
    var html = '<div class="pol-card"><h3 class="h-sm" style="margin-top:0">Total da pesquisa</h3>' + row("Todos os entrevistados", p.total) + "</div>";
    html += p.grupos.map(function (g) { return '<div class="pol-card"><h3 class="h-sm" style="margin-top:0">' + esc(g.tema) + "</h3>" + g.itens.map(function (it) { return row(it[0], it.slice(1, 1 + cands.length)); }).join("") + "</div>"; }).join("");
    html += '<div class="eco-legend" style="grid-column:1/-1">' + cands.map(function (c, i) { return '<span><i style="background:' + cor(i) + '"></i>' + esc(c.nome) + " (" + esc(c.partido) + ")</span>"; }).join("") + (p.turno === 1 ? '<span><i style="background:var(--c0)"></i>Outros candidatos</span>' : "") + "</div>";
    $("gr-res").innerHTML = html;
    renderPollCmp(p);
  }
  function renderPollCmp(p) {
    var box = $("gr-cmp");
    var g = p.grupos.filter(function (x) { return x.regiao; })[0];
    if (!g) { box.innerHTML = '<p class="ele-vazio">Esta pesquisa não separa por região.</p>'; return; }
    get("pres/" + p.ano + "-" + p.turno + ".json").then(function (d) {
      var idx = p.cands.map(function (c) {
        var nm = norm(c[0]);
        for (var i = 0; i < d.cands.length; i++) if (d.cands[i].partido === c[1] && (norm(d.cands[i].nome).indexOf(nm.split(" ")[0]) >= 0 || norm(d.cands[i].completo).indexOf(nm.split(" ")[0]) >= 0)) return i;
        for (var j = 0; j < d.cands.length; j++) if (d.cands[j].partido === c[1]) return j;
        return -1;
      });
      var cands = p.cands.map(function (c) { return { nome: c[0], partido: c[1] }; });
      var urna = function (code) {
        var rs = code.split("+"), v = idx.map(function () { return 0; }), val = 0;
        rs.forEach(function (r) { var x = d.reg[r]; if (!x) return; val += x.val; idx.forEach(function (i, j) { if (i >= 0) v[j] += x.v[i]; }); });
        return { v: v.map(function (x) { return Math.round(x / val * 1000) / 10; }), val: val };
      };
      var bar = function (v) {
        var s = v.reduce(function (a, b) { return a + b; }, 0), out = Math.max(0, 100 - s);
        return '<div class="ele-sbar">' + v.map(function (x, i) { return '<span style="width:' + x + "%;background:" + cor(i) + '">' + (x >= 9 ? Math.round(x) + "%" : "") + "</span>"; }).join("") + (out > 0.5 ? '<span class="o" style="width:' + out + '%"></span>' : "") + "</div>";
      };
      var rows = g.itens.map(function (it) {
        var pv = it.slice(1, 1 + cands.length), u = urna(it[it.length - 1]);
        return '<div class="ele-cmp-row"><b>' + esc(it[0]) + '</b><div><small>Pesquisa: ' + pv.map(function (x, i) { return cands[i].nome.split(" ")[0] + " " + x + "%"; }).join(" · ") + "</small>" + bar(pv) +
          "<small>Urna (oficial): " + u.v.map(function (x, i) { return cands[i].nome.split(" ")[0] + " " + x.toLocaleString("pt-BR") + "%"; }).join(" · ") + "</small>" + bar(u.v) + "</div></div>";
      });
      var tot = urna("N+NE+CO+SE+S+ZZ");
      rows.unshift('<div class="ele-cmp-row"><b>Brasil</b><div><small>Pesquisa: ' + p.total.map(function (x, i) { return cands[i].nome.split(" ")[0] + " " + x + "%"; }).join(" · ") + "</small>" + bar(p.total) + "<small>Urna (oficial): " + tot.v.map(function (x, i) { return cands[i].nome.split(" ")[0] + " " + x.toLocaleString("pt-BR") + "%"; }).join(" · ") + "</small>" + bar(tot.v) + "</div></div>");
      box.innerHTML = '<div class="ele-cmp">' + rows.join("") + '</div><p class="note-sm">Urna: votos válidos do ' + turnoTxt(p.turno) + " de " + p.ano + " somados dos arquivos do TSE. Quando a pesquisa junta regiões (ex.: Centro-Oeste e Norte), somamos as mesmas regiões na urna.</p>";
    }).catch(function () { box.innerHTML = '<p class="ele-vazio">O resultado oficial desta eleição ainda não está disponível para comparar.</p>'; });
  }

  // ---------- Perfil do eleitorado
  function initPerfil() {
    get("perfil.json").then(function (d) {
      var anos = Object.keys(d.anos).sort().reverse();
      $("el-ano").innerHTML = anos.map(function (a, i) { return opt(a, a, i === 0); }).join("");
      $("el-lugar").innerHTML = opt("BR", "Brasil inteiro", true) + REG_ORD.filter(function (r) { return r !== "ZZ"; }).map(function (r) { return opt(r, REG[r]); }).join("") +
        '<optgroup label="Estados">' + Object.keys(UFN).filter(function (u) { return u !== "ZZ"; }).sort(function (a, b) { return UFN[a].localeCompare(UFN[b], "pt-BR"); }).map(function (u) { return opt("uf:" + u, UFN[u]); }).join("") + "</optgroup>";
      var ORD = {
        sexo: ["Mulheres", "Homens"], idade: ["16–17", "18–24", "25–34", "35–44", "45–59", "60–69", "70+"],
        esc: ["Não sabe ler", "Lê e escreve", "Fundamental", "Médio", "Superior"], raca: ["Branca", "Parda", "Preta", "Amarela", "Indígena"]
      };
      var TIT = { sexo: "Sexo", idade: "Idade", esc: "Escolaridade (declarada no cadastro)", raca: "Cor ou raça (só de quem informou)" };
      var draw = function () {
        var A = d.anos[$("el-ano").value], L = $("el-lugar").value;
        var ufs = Object.keys(A).filter(function (u) { return L === "BR" ? u !== "ZZ" : (L.indexOf("uf:") === 0 ? u === L.slice(3) : UF_REG[u] === L); });
        var sum = { tot: 0 };
        ufs.forEach(function (u) { var x = A[u]; sum.tot += x.tot; Object.keys(ORD).forEach(function (k) { sum[k] = sum[k] || {}; Object.keys(x[k] || {}).forEach(function (c) { sum[k][c] = (sum[k][c] || 0) + x[k][c]; }); }); });
        var cards = Object.keys(ORD).map(function (k) {
          var g = sum[k] || {}, base = ORD[k].reduce(function (s, c) { return s + (g[c] || 0); }, 0);
          if (!base) return "";
          var info = k === "raca" ? '<p class="note-sm">Só ' + pc(base / sum.tot) + " dos eleitores informaram a cor no cadastro; a porcentagem é sobre eles.</p>" : "";
          return '<div class="pol-card"><h3 class="h-sm" style="margin-top:0">' + TIT[k] + "</h3>" + ORD[k].map(function (c) { var v = (g[c] || 0) / base; return '<div class="ele-hbar"><span>' + esc(c) + '</span><div class="bar"><span style="width:' + (v * 100).toFixed(1) + '%"></span></div><em>' + pc(v) + "</em></div>"; }).join("") + info + "</div>";
        }).join("");
        var onde = L === "BR" ? "No Brasil" : (L.indexOf("uf:") === 0 ? cap(EM_UF[L.slice(3)]) : NO_REG[L]);
        var mul = (sum.sexo && sum.sexo.Mulheres) / ((sum.sexo.Mulheres || 0) + (sum.sexo.Homens || 0));
        $("el-res").innerHTML = '<div class="pol-card"><h3 class="h-sm" style="margin-top:0">Eleitores</h3><p style="font:700 1.6rem \'DM Mono\',monospace;color:var(--text)">' + n(sum.tot) + '</p><p>' + esc(onde + ", " + n(sum.tot) + " pessoas podiam votar pelo cadastro de " + $("el-ano").value + "; " + pc(mul) + " são mulheres.") + "</p></div>" + cards;
      };
      $("el-ano").addEventListener("change", draw); $("el-lugar").addEventListener("change", draw);
      draw();
    }).catch(function () { err($("el-res")); });
  }

  // tabela por estado: aberta em telas largas, recolhida no celular
  var dt = $("pr-tab-box"); if (dt && window.innerWidth >= 720) dt.open = true;

  // ---------- início
  get("indice.json").then(function (idx) {
    IDX = idx;
    var ps = idx.presidente;
    $("st-pres").textContent = ps.length + " (" + ps[0].ano + "–" + ps[ps.length - 1].ano + ")";
    $("st-part").textContent = idx.partidos.length + " (" + idx.partidos[0] + "–" + idx.partidos[idx.partidos.length - 1] + ")";
    var u = ps[ps.length - 1];
    $("st-ult").textContent = u.ano + " · " + turnoTxt(u.turno);
    $("st-prox").textContent = idx.proximo ? turnoTxt(idx.proximo.turno) + " · " + idx.proximo.data : "—";
    var key = fillPresSelects();
    loadPres(key);
    initCidade();
    loadPresNames(Object.keys(PRES_ALL).length ? [] : ps.filter(function (e) { return e.ano >= 2010; }).map(function (e) { return e.ano + "-" + e.turno; }));
  }).catch(function () { err($("pr-geral")); });
  initPartidos();
  initPresidios();
  initPesquisas();
  initPerfil();
})();
