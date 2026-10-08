/* /politica/mapa/ — mapa do Brasil, governantes (TSE) e contas públicas (Tesouro).
   Dados pré-processados em ../data/mapa/ (veja ../data/mapa/README.md).
   Anos do SICONFI que ainda não estão no cache do site são buscados direto na
   API do Tesouro (CORS liberado), respeitando 1 requisição por segundo. */
(function () {
  "use strict";
  var DATA = "../data/mapa/";
  var SICONFI = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var NS = "http://www.w3.org/2000/svg";

  // ---------- utilidades ----------
  function esc(s) {
    var m = { "&": "amp", "<": "lt", ">": "gt", '"': "quot", "'": "#39" };
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return "&" + m[c] + ";"; });
  }
  function norm(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
  function slug(s) { return norm(s).replace(/ /g, "-"); }
  var nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  var nf2 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  function money(v, unit) {
    if (v == null || isNaN(v)) return "—";
    var u = unit == null ? "R$" : unit, a = Math.abs(v), s;
    if (a >= 1e12) s = nf2.format(v / 1e12) + " tri";
    else if (a >= 1e9) s = nf2.format(v / 1e9) + " bi";
    else if (a >= 1e6) s = nf1.format(v / 1e6) + " mi";
    else if (a >= 1e4) s = nf1.format(v / 1e3) + " mil";
    else s = nf0.format(v);
    return (u ? u + " " : "") + s;
  }
  function pct(v) { return v == null || isNaN(v) ? "—" : nf1.format(v) + "%"; }
  function int(v) { return v == null ? "—" : nf0.format(v); }
  function brDate(iso) {
    if (!iso) return "";
    var p = String(iso).split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : iso;
  }
  function isoFromBr(s) { var p = String(s || "").split("/"); return p.length === 3 ? p[2] + "-" + p[1] + "-" + p[0] : s; }
  var cache = {};
  function getJSON(path) {
    if (!cache[path]) {
      cache[path] = fetch(DATA + path).then(function (r) {
        if (!r.ok) throw new Error(r.status + " " + path);
        return r.json();
      });
      cache[path].catch(function () { delete cache[path]; });
    }
    return cache[path];
  }
  function tryJSON(path) { return getJSON(path).catch(function () { return null; }); }

  // ---------- rótulos em linguagem simples ----------
  var FUNC = {
    "01": ["Câmara / Assembleia (Poder Legislativo)", "Legislativa"],
    "02": ["Tribunais (Poder Judiciário)", "Judiciária"],
    "03": ["Procuradoria e Defensoria Pública", "Essencial à Justiça"],
    "04": ["Administração: máquina pública, prédios, sistemas", "Administração"],
    "05": ["Defesa nacional", "Defesa Nacional"],
    "06": ["Segurança: polícia e guarda municipal", "Segurança Pública"],
    "07": ["Relações com outros países", "Relações Exteriores"],
    "08": ["Assistência social: CRAS, abrigos, apoio a famílias", "Assistência Social"],
    "09": ["Aposentadorias e pensões de servidores", "Previdência Social"],
    "10": ["Saúde: postos, hospitais, remédios, vacinas", "Saúde"],
    "11": ["Emprego e trabalho", "Trabalho"],
    "12": ["Educação: escolas, creches, merenda, transporte escolar", "Educação"],
    "13": ["Cultura", "Cultura"],
    "14": ["Direitos da cidadania", "Direitos da Cidadania"],
    "15": ["Cidade: ruas, praças, iluminação, obras urbanas", "Urbanismo"],
    "16": ["Moradia", "Habitação"],
    "17": ["Água, esgoto e lixo", "Saneamento"],
    "18": ["Meio ambiente", "Gestão Ambiental"],
    "19": ["Ciência e tecnologia", "Ciência e Tecnologia"],
    "20": ["Agricultura", "Agricultura"],
    "21": ["Reforma agrária", "Organização Agrária"],
    "22": ["Indústria", "Indústria"],
    "23": ["Comércio, serviços e turismo", "Comércio e Serviços"],
    "24": ["Comunicações", "Comunicações"],
    "25": ["Energia", "Energia"],
    "26": ["Transporte: estradas, ônibus, trânsito", "Transporte"],
    "27": ["Esporte e lazer", "Desporto e Lazer"],
    "28": ["Dívidas, precatórios e outros encargos", "Encargos Especiais"]
  };
  var FUNC_OLD = {
    leg: ["Câmara de Vereadores", "Legislativa"], jud: ["Justiça", "Judiciária"],
    adm: ["Administração e planejamento", "Administração e Planejamento"], agr: ["Agricultura", "Agricultura"],
    edu: ["Educação e cultura (juntas)", "Educação e Cultura"], hab: ["Moradia e cidade (juntas)", "Habitação e Urbanismo"],
    ind: ["Indústria e comércio", "Indústria, Comércio e Serviços"], sau: ["Saúde e saneamento (juntos)", "Saúde e Saneamento"],
    ass: ["Assistência social e previdência (juntas)", "Assistência e Previdência"], tra: ["Transporte", "Transporte"],
    seg: ["Segurança", "Segurança Pública"], des: ["Desenvolvimento regional", "Desenvolvimento Regional"],
    ene: ["Energia e recursos minerais", "Energia e Recursos Minerais"], com: ["Comunicações", "Comunicações"],
    trb: ["Trabalho", "Trabalho"], rex: ["Relações exteriores", "Relações Exteriores"], out: ["Outras", "Outras"]
  };
  var MOEDA = { 1989: "NCz$", 1990: "Cr$ mil", 1991: "Cr$ mil", 1992: "Cr$ mil", 1993: "CR$ mil" };
  var PALETTE = ["#62f58b", "#8aa0ff", "#f5b94a", "#ff7a7a", "#4dd0e1", "#ce93d8", "#ffd54f", "#a1887f", "#81c784", "#f48fb1", "#90a4ae", "#b39ddb"];

  // ---------- estado ----------
  var S = { base: null, mun: {}, ufs: {}, meta: null, uf: null, m: null, colorBy: "", colorYear: null,
            vb: null, full: null, view: "br", pages: {}, live: {}, ufsAlex: null };

  // ---------- carga inicial ----------
  Promise.all([getJSON("municipios.json"), getJSON("geo/br.json"), tryJSON("brasil.json"),
               fetch("../paginas.json").then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }),
               fetch("../data/ufs.json").then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })])
    .then(function (res) {
      S.base = res[0]; S.meta = res[2] || {}; S.pages = (res[3] && res[3].paginas) || {}; S.ufsAlex = res[4];
      S.base.ufs.forEach(function (u) { S.ufs[u.uf] = u; });
      S.base.municipios.forEach(function (m) {
        S.mun[m[0]] = { id: m[0], nome: m[1], uf: m[2], pop: m[3], cap: m[4] === 1, n: norm(m[1]) };
      });
      S.geoBR = res[1];
      initControls();
      drawBR();
      renderSources();
      var q = new URLSearchParams(location.search);
      var mid = +q.get("m"), uf = (q.get("uf") || "").toUpperCase();
      if (mid && S.mun[mid]) openCity(mid);
      else if (uf && S.ufs[uf]) openUF(uf);
      else renderBrasil();
      renderRanking();
    })
    .catch(function (e) {
      $("#mp-sheet").innerHTML = '<p class="err">Não foi possível carregar os dados do mapa agora. Tente recarregar a página.</p>';
      if (window.console) console.warn(e);
    });

  // ---------- controles ----------
  function yearsAvail() {
    var ys = (S.meta && S.meta.anos_idx) || [];
    return ys.slice().sort(function (a, b) { return b - a; });
  }
  function fillYears(sel, ys, val) {
    sel.innerHTML = ys.map(function (y) { return '<option value="' + y + '"' + (y === val ? " selected" : "") + ">" + y + "</option>"; }).join("");
  }
  function lastFullYear() {
    var ys = yearsAvail(), cov = (S.meta && S.meta.cobertura_municipios) || {};
    for (var i = 0; i < ys.length; i++) {
      var c = cov[ys[i]] || {};
      if ((c.siconfi || 0) + (c.finbra || 0) > 3000) return ys[i];
    }
    return ys[0] || 2012;
  }
  function initControls() {
    var ys = yearsAvail();
    S.colorYear = lastFullYear();
    fillYears($("#mp-color-year"), ys, S.colorYear);
    fillYears($("#rk-ano"), ys.filter(function (y) { return y >= 2000; }), S.colorYear);
    fillYears($("#cmp-ano"), ys.filter(function (y) { return y >= 2000; }), S.colorYear);
    var ufSel = $("#mp-uf"), rkUf = $("#rk-uf");
    S.base.ufs.forEach(function (u) {
      ufSel.insertAdjacentHTML("beforeend", '<option value="' + u.uf + '">' + esc(u.nome) + "</option>");
      rkUf.insertAdjacentHTML("beforeend", '<option value="' + u.uf + '">' + esc(u.nome) + "</option>");
    });
    ufSel.addEventListener("change", function () { if (ufSel.value) openUF(ufSel.value); else goBR(); });
    $("#mp-city").addEventListener("change", function (e) { if (e.target.value) openCity(+e.target.value); else if (S.uf) openUF(S.uf); });
    $("#mp-color").addEventListener("change", function (e) { S.colorBy = e.target.value; paint(); });
    $("#mp-color-year").addEventListener("change", function (e) { S.colorYear = +e.target.value; paint(); });
    $$(".mp-zoom button").forEach(function (b) {
      b.addEventListener("click", function () {
        var z = b.getAttribute("data-zoom");
        if (z === "reset") setVB(S.full); else zoomBy(z === "in" ? 0.6 : 1 / 0.6);
      });
    });
    setupPan();
    setupSearch($("#mp-q"), $("#mp-sugg"), function (it) {
      if (it.type === "uf") openUF(it.uf); else openCity(it.id);
      $("#mp-q").value = ""; scrollToEl($("#explorar"));
    });
    $$("#cmp-form .mp-ac").forEach(function (box) {
      var inp = $("input", box);
      setupSearch(inp, $(".mp-sugg", box), function (it) {
        inp.value = it.label + (it.type === "m" ? " (" + S.mun[it.id].uf + ")" : "");
        inp.dataset.key = it.type === "uf" ? "uf:" + it.uf : "m:" + it.id; inp.dataset.auto = "0"; renderCompare();
      });
    });
    $("#cmp-ano").addEventListener("change", renderCompare);
    ["#rk-uf", "#rk-ind", "#rk-ano", "#rk-pop"].forEach(function (s) { $(s).addEventListener("change", renderRanking); });
    ["#f-de", "#f-ate", "#f-ano", "#f-func", "#f-modo", "#f-pc"].forEach(function (s) { $(s).addEventListener("change", function () { renderMoney(); }); });
  }
  function scrollToEl(el) {
    if (!el) return;
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  // ---------- busca ----------
  function searchItems(q) {
    var n = norm(q);
    if (n.length < 2) return [];
    var out = [];
    S.base.ufs.forEach(function (u) {
      var un = norm(u.nome);
      if (un.indexOf(n) === 0 || u.uf.toLowerCase() === n) out.push({ type: "uf", uf: u.uf, label: u.nome, sub: "Estado", score: -1 });
    });
    var parts = n.split(" "), ufHint = null;
    if (parts.length > 1 && S.ufs[parts[parts.length - 1].toUpperCase()]) { ufHint = parts.pop().toUpperCase(); n = parts.join(" "); }
    Object.keys(S.mun).forEach(function (k) {
      var m = S.mun[k];
      if (ufHint && m.uf !== ufHint) return;
      var i = m.n.indexOf(n);
      if (i < 0) return;
      out.push({ type: "m", id: m.id, label: m.nome, sub: m.uf + (m.cap ? " · capital" : ""), score: (i === 0 ? 1 : 3) - Math.log10(m.pop || 1) / 10 });
    });
    out.sort(function (a, b) { return a.score - b.score || a.label.localeCompare(b.label, "pt"); });
    return out.slice(0, 12);
  }
  function setupSearch(inp, list, onPick) {
    var items = [], sel = -1;
    function close() { list.hidden = true; inp.setAttribute("aria-expanded", "false"); sel = -1; }
    function draw() {
      if (inp.value.trim().length < 2) { close(); return; }
      if (!items.length) { list.innerHTML = '<li><button type="button" disabled>Nada encontrado</button></li>'; list.hidden = false; return; }
      list.innerHTML = items.map(function (it, i) {
        return '<li><button type="button" role="option" data-i="' + i + '" aria-selected="' + (i === sel) + '"><span>' + esc(it.label) + "</span><small>" + esc(it.sub) + "</small></button></li>";
      }).join("");
      list.hidden = false; inp.setAttribute("aria-expanded", "true");
    }
    inp.addEventListener("input", function () { items = searchItems(inp.value); sel = -1; draw(); });
    inp.addEventListener("keydown", function (e) {
      if (list.hidden) return;
      if (e.key === "ArrowDown") { sel = Math.min(items.length - 1, sel + 1); draw(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
      else if (e.key === "Enter") { var it = items[sel < 0 ? 0 : sel]; if (it) { close(); onPick(it); } e.preventDefault(); }
      else if (e.key === "Escape") close();
    });
    list.addEventListener("mousedown", function (e) { e.preventDefault(); });
    list.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-i]"); if (!b) return;
      var it = items[+b.getAttribute("data-i")]; close(); if (it) onPick(it);
    });
    inp.addEventListener("blur", function () { setTimeout(close, 150); });
  }

  // ---------- mapa (SVG) ----------
  function setVB(vb) {
    if (!vb) return;
    S.vb = { x: vb.x, y: vb.y, w: vb.w, h: vb.h };
    $("#mp-svg").setAttribute("viewBox", [vb.x, vb.y, vb.w, vb.h].map(function (v) { return Math.round(v * 10) / 10; }).join(" "));
    $("#mp-frame").classList.toggle("is-zoomed", !!(S.full && vb.w < S.full.w * 0.98));
  }
  function zoomBy(f, cx, cy) {
    var v = S.vb; if (!v) return;
    var nw = Math.max(S.full.w / 40, Math.min(S.full.w, v.w * f)), nh = nw * v.h / v.w;
    cx = cx == null ? v.x + v.w / 2 : cx; cy = cy == null ? v.y + v.h / 2 : cy;
    setVB({ x: cx - (cx - v.x) * nw / v.w, y: cy - (cy - v.y) * nh / v.h, w: nw, h: nh });
  }
  function clientToSvg(x, y) {
    var svg = $("#mp-svg"), r = svg.getBoundingClientRect(), v = S.vb;
    var s = Math.max(v.w / r.width, v.h / r.height);
    var ox = (r.width * s - v.w) / 2, oy = (r.height * s - v.h) / 2;
    return { x: v.x - ox + (x - r.left) * s, y: v.y - oy + (y - r.top) * s };
  }
  function setupPan() {
    var svg = $("#mp-svg"), frame = $("#mp-frame"), pts = {}, start = null, moved = false, pinch = null;
    svg.addEventListener("pointerdown", function (e) {
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pts);
      if (ids.length === 1) { start = { x: e.clientX, y: e.clientY, vb: Object.assign({}, S.vb) }; moved = false; }
      if (ids.length === 2) {
        var a = pts[ids[0]], b = pts[ids[1]];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), vb: Object.assign({}, S.vb), c: clientToSvg((a.x + b.x) / 2, (a.y + b.y) / 2) };
      }
    });
    svg.addEventListener("pointermove", function (e) {
      if (!pts[e.pointerId]) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pts);
      if (ids.length === 2 && pinch) {
        var a = pts[ids[0]], b = pts[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 0) { S.vb = Object.assign({}, pinch.vb); zoomBy(pinch.d / d, pinch.c.x, pinch.c.y); moved = true; }
        return;
      }
      if (!start || !frame.classList.contains("is-zoomed")) return;
      var dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      if (!moved) { try { svg.setPointerCapture(e.pointerId); } catch (er) { /* sem captura */ } }
      moved = true; frame.classList.add("is-dragging");
      var r = svg.getBoundingClientRect(), s = Math.max(start.vb.w / r.width, start.vb.h / r.height);
      setVB({ x: start.vb.x - dx * s, y: start.vb.y - dy * s, w: start.vb.w, h: start.vb.h });
    });
    function end(e) {
      delete pts[e.pointerId];
      if (Object.keys(pts).length < 2) pinch = null;
      if (!Object.keys(pts).length) { start = null; frame.classList.remove("is-dragging"); setTimeout(function () { moved = false; }, 0); }
    }
    svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end);
    svg.addEventListener("click", function (e) {
      if (moved) { e.stopPropagation(); e.preventDefault(); return; }
      var p = e.target.closest(".mp-shape"); if (!p) return;
      if (p.dataset.uf) openUF(p.dataset.uf); else if (p.dataset.m) openCity(+p.dataset.m);
    }, true);
    svg.addEventListener("wheel", function (e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      var c = clientToSvg(e.clientX, e.clientY);
      zoomBy(e.deltaY > 0 ? 1.15 : 1 / 1.15, c.x, c.y);
    }, { passive: false });
    svg.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("mp-shape")) {
        e.preventDefault(); e.target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
    });
    var tip = $("#mp-tip");
    svg.addEventListener("pointerover", function (e) {
      var p = e.target.closest(".mp-shape"); if (!p || e.pointerType === "touch") return;
      tip.innerHTML = p.getAttribute("data-tip") || ""; tip.hidden = !tip.innerHTML;
    });
    svg.addEventListener("pointerout", function (e) { if (e.target.closest(".mp-shape")) tip.hidden = true; });
  }
  function drawShapes(geo, items, key) {
    var g = $("#mp-g"); g.innerHTML = "";
    var w = geo.w, h = geo.h, pad = Math.max(w, h) * 0.02;
    S.full = { x: -pad, y: -pad, w: w + 2 * pad, h: h + 2 * pad };
    setVB(S.full);
    var frag = document.createDocumentFragment();
    Object.keys(items).forEach(function (k) {
      var it = items[k];
      var p = document.createElementNS(NS, "path");
      p.setAttribute("d", it.d); p.setAttribute("class", "mp-shape");
      p.dataset[key] = it.key;
      if (key === "uf") { p.setAttribute("tabindex", "0"); p.setAttribute("role", "button"); p.setAttribute("aria-label", it.label); }
      p.setAttribute("data-tip", "<b>" + esc(it.label) + "</b>");
      frag.appendChild(p);
    });
    g.appendChild(frag);
    if (key === "uf") {
      Object.keys(items).forEach(function (k) {
        var it = items[k], t = document.createElementNS(NS, "text");
        var adj = { DF: [0, 2], RN: [8, -4], PB: [16, 0], PE: [24, 2], AL: [16, 4], SE: [10, 6], ES: [10, 2], RJ: [10, 8], SC: [4, 0] }[it.key] || [0, 0];
        t.setAttribute("x", it.c[0] + adj[0]); t.setAttribute("y", it.c[1] + adj[1]);
        t.setAttribute("text-anchor", "middle"); t.setAttribute("dominant-baseline", "middle");
        t.setAttribute("class", "mp-label"); t.setAttribute("aria-hidden", "true");
        if (adj[0] || adj[1]) t.style.fontSize = "10px";
        t.textContent = it.key; g.appendChild(t);
      });
    }
  }
  function drawBR() {
    var items = {};
    Object.keys(S.geoBR.ufs).forEach(function (uf) {
      var u = S.geoBR.ufs[uf];
      items[uf] = { d: u.d, c: u.c, key: uf, label: (S.ufs[uf] || {}).nome || uf };
    });
    S.view = "br";
    drawShapes(S.geoBR, items, "uf");
    $("#mp-svg-title").textContent = "Mapa do Brasil por estado. Toque num estado para ver as cidades.";
    crumbs();
    return paint();
  }
  function drawUF(uf) {
    var load = $("#mp-loading"); load.hidden = false;
    return getJSON("geo/" + uf + ".json").then(function (geo) {
      var items = {};
      Object.keys(geo.m).forEach(function (id) {
        var m = S.mun[+id]; if (!m) return;
        items[id] = { d: geo.m[id].d, c: geo.m[id].c, key: id, label: m.nome };
      });
      S.view = uf;
      drawShapes(geo, items, "m");
      $("#mp-svg-title").textContent = "Mapa de " + S.ufs[uf].nome + " com as cidades. Toque numa cidade.";
      load.hidden = true;
      crumbs();
      return paint();
    }).catch(function () { load.hidden = true; });
  }
  function crumbs() {
    var c = $("#mp-crumbs"), h = [];
    if (!S.uf) h.push('<span aria-current="location">Brasil</span>');
    else h.push('<button type="button" data-go="br">Brasil</button>');
    if (S.uf) {
      h.push('<span class="sep">›</span>');
      if (S.m) h.push('<button type="button" data-go="uf">' + esc(S.ufs[S.uf].nome) + "</button>");
      else h.push('<span aria-current="location">' + esc(S.ufs[S.uf].nome) + "</span>");
    }
    if (S.m) h.push('<span class="sep">›</span><span aria-current="location">' + esc(S.mun[S.m].nome) + "</span>");
    c.innerHTML = h.join("");
    $$("button[data-go]", c).forEach(function (b) {
      b.addEventListener("click", function () { if (b.dataset.go === "br") goBR(); else openUF(S.uf); });
    });
  }
  function highlight() {
    $$("#mp-g .mp-shape").forEach(function (p) {
      var on = (p.dataset.uf && p.dataset.uf === S.uf) || (p.dataset.m && +p.dataset.m === S.m);
      p.classList.toggle("is-on", !!on);
    });
  }
  function zoomToShape(id) {
    var p = $('#mp-g .mp-shape[data-m="' + id + '"]'); if (!p || !S.full) return;
    var b = p.getBBox(), f = S.full;
    var size = Math.min(f.w, Math.max(Math.max(b.width, b.height) * 4, f.w / 6));
    var cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    setVB({ x: cx - size / 2, y: cy - size * f.h / f.w / 2, w: size, h: size * f.h / f.w });
    p.parentNode.appendChild(p);
  }

  // ---------- pintura (mapa colorido) ----------
  function partyColors(list) {
    var cnt = {}; list.forEach(function (p) { if (p) cnt[p] = (cnt[p] || 0) + 1; });
    var order = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a] || a.localeCompare(b); });
    var col = {}; order.forEach(function (p, i) { col[p] = i < PALETTE.length - 1 ? PALETTE[i] : PALETTE[PALETTE.length - 1]; });
    return { col: col, order: order, cnt: cnt };
  }
  function scaleColor(t) { return "color-mix(in srgb, var(--accent) " + Math.round(12 + t * 88) + "%, var(--bg-soft))"; }
  function metricFrom(row, kind) {
    if (!row) return null;
    var d = row[0], pop = row[7];
    if (kind === "pc") return d && pop ? d / pop : null;
    if (!d) return null;
    if (kind === "saude") return row[4] != null ? 100 * row[4] / d : null;
    if (kind === "educacao") return row[5] != null ? 100 * row[5] / d : null;
    if (kind === "pessoal") return row[2] != null ? 100 * row[2] / d : null;
    if (kind === "invest") return row[3] != null ? 100 * row[3] / d : null;
    return null;
  }
  function stateRow(c) {
    if (!c) return null;
    var f = c.f || {};
    return [c.d, c.r, c.pe, c.inv, f["10"], f["12"], f["06"], c.pop, c.tu, c.trib];
  }
  function tipBase(p) { return (p.getAttribute("data-tip") || "").split("</b>")[0] + "</b>"; }
  function paint() {
    var kind = S.colorBy, y = S.colorYear, shapes = $$("#mp-g .mp-shape"), leg = $("#mp-legend");
    $("#mp-color-year").hidden = !kind || kind === "partido";
    shapes.forEach(function (p) { p.style.fill = ""; p.setAttribute("data-tip", tipBase(p)); });
    if (!kind) { leg.innerHTML = ""; highlight(); return Promise.resolve(); }
    var isBR = S.view === "br", view = S.view, job;
    if (kind === "partido") {
      job = isBR
        ? Promise.all(S.base.ufs.map(function (u) { return tryJSON("pol/uf/" + u.uf + ".json"); })).then(function (docs) {
            var vals = {};
            docs.forEach(function (d) {
              if (!d) return;
              var g = (d.governadores || []).filter(function (m) { return m.ano <= 2022; }).pop();
              if (g) vals[d.uf] = { p: g.partido, tip: "Eleito(a) em " + g.ano + ": " + g.nome + " (" + g.partido + ")" };
            });
            return vals;
          })
        : tryJSON("pol/uf/" + view + ".json").then(function (d) {
            var vals = {}, pa = (d && d.prefeitos_atuais) || {};
            Object.keys(pa).forEach(function (id) { vals[id] = { p: pa[id][1], tip: "Prefeito(a) eleito(a) em " + pa[id][2] + ": " + pa[id][0] + " (" + pa[id][1] + ")" }; });
            return vals;
          });
      return job.then(function (vals) {
        if (S.view !== view || S.colorBy !== kind) return;
        var pc = partyColors(Object.keys(vals).map(function (k) { return vals[k].p; }));
        shapes.forEach(function (p) {
          var v = vals[p.dataset.uf || p.dataset.m];
          if (v) { p.style.fill = pc.col[v.p]; p.setAttribute("data-tip", tipBase(p) + "<span>" + esc(v.tip) + "</span>"); }
          else p.setAttribute("data-tip", tipBase(p) + "<span>Sem eleito registrado no TSE</span>");
        });
        leg.innerHTML = pc.order.slice(0, PALETTE.length - 1).map(function (p) { return '<span><i style="background:' + pc.col[p] + '"></i>' + esc(p) + " (" + pc.cnt[p] + ")</span>"; }).join("") +
          (pc.order.length >= PALETTE.length ? '<span><i style="background:' + PALETTE[PALETTE.length - 1] + '"></i>outros</span>' : "") +
          '<span class="muted">' + (isBR ? "Partido do(a) governador(a) eleito(a) em 2022 (TSE). Hoje pode haver outra pessoa no cargo." : "Partido do(a) prefeito(a) eleito(a) na última eleição (TSE).") + " As cores só separam partidos; não dizem nada sobre eles.</span>";
        highlight();
      });
    }
    job = isBR
      ? Promise.all(S.base.ufs.map(function (u) { return tryJSON("uf/" + u.uf + ".json"); })).then(function (docs) {
          var vals = {};
          docs.forEach(function (d) { if (d) vals[d.uf] = metricFrom(stateRow((d.governo_estadual.anos || {})[y]), kind); });
          return vals;
        })
      : tryJSON("idx/" + y + ".json").then(function (d) {
          var vals = {}; if (!d) return vals;
          Object.keys(d.m).forEach(function (id) { if (S.mun[+id] && S.mun[+id].uf === view) vals[id] = metricFrom(d.m[id], kind); });
          return vals;
        });
    return job.then(function (vals) {
      if (S.view !== view || S.colorBy !== kind || S.colorYear !== y) return;
      var arr = Object.keys(vals).map(function (k) { return vals[k]; }).filter(function (v) { return v != null && isFinite(v); }).sort(function (a, b) { return a - b; });
      if (!arr.length) {
        leg.innerHTML = '<span class="muted">Sem dados de ' + y + " para pintar " + (isBR ? "os estados (contas estaduais só a partir de 2013)" : "as cidades deste estado") + ". Escolha outro ano.</span>";
        highlight(); return;
      }
      var lo = arr[Math.floor(arr.length * 0.05)], hi = arr[Math.min(arr.length - 1, Math.floor(arr.length * 0.95))];
      var fmt = kind === "pc" ? function (v) { return money(v, MOEDA[y] || "R$"); } : pct;
      shapes.forEach(function (p) {
        var v = vals[p.dataset.uf || p.dataset.m];
        if (v != null && isFinite(v)) {
          var t = hi > lo ? Math.max(0, Math.min(1, (v - lo) / (hi - lo))) : 0.5;
          p.style.fill = scaleColor(t);
          p.setAttribute("data-tip", tipBase(p) + "<span>" + esc(fmt(v)) + " em " + y + "</span>");
        } else {
          p.style.fill = "var(--bg-soft)";
          p.setAttribute("data-tip", tipBase(p) + "<span>Sem contas de " + y + "</span>");
        }
      });
      var names = { pc: "Gasto por habitante (valores da época)", saude: "% do gasto em saúde", educacao: "% do gasto em educação", pessoal: "% do gasto com pessoal", invest: "% do gasto em obras e equipamentos" };
      leg.innerHTML = '<span class="grad">' + esc(fmt(lo)) + '<b style="background:linear-gradient(90deg,' + scaleColor(0) + "," + scaleColor(1) + ')"></b>' + esc(fmt(hi)) + "</span>" +
        "<span>" + esc(names[kind]) + ", " + y + (isBR ? " — governos estaduais" : " — prefeituras") + "</span>" +
        '<span><i style="background:var(--bg-soft)"></i>sem dados</span>';
      highlight();
    });
  }

  // ---------- navegação ----------
  function setURL() {
    var q = new URLSearchParams(location.search);
    q.delete("uf"); q.delete("m");
    if (S.m) q.set("m", S.m); else if (S.uf) q.set("uf", S.uf);
    var s = q.toString();
    history.replaceState(null, "", location.pathname + (s ? "?" + s : "") + location.hash);
  }
  function goBR() {
    S.uf = null; S.m = null; $("#mp-uf").value = ""; fillCities(null);
    drawBR(); setURL(); renderBrasil();
  }
  function fillCities(uf) {
    var sel = $("#mp-city");
    if (!uf) { sel.innerHTML = '<option value="">Escolha um estado antes</option>'; sel.disabled = true; return; }
    if (sel.dataset.uf === uf) return;
    var list = Object.keys(S.mun).map(function (k) { return S.mun[k]; }).filter(function (m) { return m.uf === uf; })
      .sort(function (a, b) { return a.nome.localeCompare(b.nome, "pt"); });
    sel.innerHTML = '<option value="">Todas as ' + list.length + " cidades</option>" + list.map(function (m) { return '<option value="' + m.id + '">' + esc(m.nome) + "</option>"; }).join("");
    sel.disabled = false; sel.dataset.uf = uf;
  }
  function openUF(uf) {
    var changed = S.view !== uf;
    S.uf = uf; S.m = null;
    $("#mp-uf").value = uf; fillCities(uf); $("#mp-city").value = "";
    var p = changed ? drawUF(uf) : Promise.resolve();
    p.then(function () { setVB(S.full); highlight(); });
    crumbs(); setURL();
    renderPlace();
  }
  function openCity(id) {
    var m = S.mun[id]; if (!m) return;
    var p = S.view !== m.uf ? drawUF(m.uf) : Promise.resolve();
    S.uf = m.uf; S.m = id;
    $("#mp-uf").value = m.uf; fillCities(m.uf); $("#mp-city").value = String(id);
    p.then(function () { highlight(); zoomToShape(id); });
    crumbs(); setURL();
    renderPlace();
  }

  // ---------- dados de um lugar ----------
  function placeKey() { return S.m ? "m:" + S.m : (S.uf ? "uf:" + S.uf : "br"); }
  function loadPlace(key) {
    var t = key.split(":");
    if (t[0] === "uf") {
      var uf = t[1];
      return Promise.all([tryJSON("uf/" + uf + ".json"), tryJSON("pol/uf/" + uf + ".json"), tryJSON("fed/" + uf + ".json")]).then(function (r) {
        var anos = {}, src = {};
        var ga = (r[0] && r[0].governo_estadual && r[0].governo_estadual.anos) || {};
        Object.keys(ga).forEach(function (y) { anos[y] = ga[y]; src[y] = ga[y] ? "siconfi" : "sem"; });
        return { kind: "uf", uf: uf, nome: S.ufs[uf].nome, info: r[0], pol: r[1], fedDoc: r[2], anos: anos, src: src, pop: S.ufs[uf].pop, ente: S.ufs[uf].ibge };
      });
    }
    var id = +t[1], m = S.mun[id];
    var noFin = id === 5300108;
    return Promise.all([noFin ? null : tryJSON("fin/m/" + m.uf + "/" + id + ".json"), noFin ? null : tryJSON("pol/m/" + m.uf + "/" + id + ".json"),
                        tryJSON("uf/" + m.uf + ".json"), tryJSON("pol/uf/" + m.uf + ".json"), tryJSON("fed/" + m.uf + ".json")]).then(function (r) {
      var anos = {}, src = {}, f = r[0] || {};
      Object.keys(f.hist || {}).forEach(function (y) { if (f.hist[y]) { anos[y] = f.hist[y]; src[y] = "finbra"; } });
      Object.keys(f.anos || {}).forEach(function (y) { anos[y] = f.anos[y] || anos[y] || 0; src[y] = f.anos[y] ? "siconfi" : (src[y] || "sem"); });
      var live = S.live[id] || {};
      Object.keys(live).forEach(function (y) { anos[y] = live[y] || 0; src[y] = live[y] ? "ao vivo" : "sem"; });
      return { kind: "m", id: id, uf: m.uf, nome: m.nome, m: m, fin: f, pol: r[1], ufInfo: r[2], ufPol: r[3], fedDoc: r[4], anos: anos, src: src, pop: m.pop, ente: id };
    });
  }

  // ---------- SICONFI ao vivo (mesma regra de scripts/politica/mapa/siconfi_sync.py) ----------
  var NUMRE = /^(\d)\.(\d)\.(\d)\.(\d)/;
  function coreDCA(items) {
    if (!items || !items.length) return null;
    var rb = {}, rd = {}, f = {}, o = {}, totE = null, totP = null, pop = null;
    items.forEach(function (i) {
      var an = i.anexo || "", col = i.coluna || "", cod = i.cod_conta || "", conta = (i.conta || "").trim(), v = i.valor || 0;
      if (pop == null && i.populacao) pop = i.populacao;
      if (/I-C$/.test(an)) {
        if (cod.indexOf("RO") !== 0 || !NUMRE.test(cod.slice(2))) return;
        var k = cod.slice(2);
        if (col.indexOf("Dedu") < 0 && (col.indexOf("Bruta") >= 0 || col.indexOf("Realizad") >= 0)) rb[k] = (rb[k] || 0) + v;
        else if (col.indexOf("Dedu") >= 0) rd[k] = (rd[k] || 0) + v;
      } else if (/I-E$/.test(an)) {
        if (col.indexOf("Empenhad") < 0 && col.indexOf("Pagas") < 0) return;
        var low = conta.toLowerCase();
        if (low.indexOf("despesas exceto") === 0 || low.indexOf("despesas (exceto") === 0 || low.indexOf("total geral da despesa") === 0) {
          if (col.indexOf("Empenhad") >= 0 && (totE == null || low.indexOf("despesas") === 0)) totE = v;
          if (col.indexOf("Pagas") >= 0 && (totP == null || low.indexOf("despesas") === 0)) totP = v;
          return;
        }
        var mm = /^(\d\d) - /.exec(conta);
        if (mm && col.indexOf("Empenhad") >= 0) f[mm[1]] = (f[mm[1]] || 0) + v;
      } else if (/I-D$/.test(an)) {
        if (col.indexOf("Empenhad") < 0 || cod.indexOf("DO") !== 0) return;
        var kk = cod.slice(2);
        [["3.1.00.00.00", "pe"], ["3.2.00.00.00", "ju"], ["4.4.00.00.00", "inv"], ["4.6.00.00.00", "am"], ["3.0.00.00.00", "dc"], ["4.0.00.00.00", "dk"]].forEach(function (pr) {
          if (kk.indexOf(pr[0]) === 0 && /^\d\.\d\.00\.00\.00(\.00)?$/.test(kk)) o[pr[1]] = (o[pr[1]] || 0) + v;
        });
      } else if (/I-AB$/.test(an)) {
        if (/empr[ée]stimos e financiamentos a (curto|longo) prazo/i.test(conta) && /^P2\.[12]\.2\.0\.0\.00\.00$/.test(cod)) o.div = (o.div || 0) + v;
        else if (/^P1\.1\.1\.0\.0\.00\.00$/.test(cod)) o.cx = v;
      }
    });
    function net(re) { var s = 0, found = false; Object.keys(rb).forEach(function (k) { if (re.test(k)) { s += rb[k] - (rd[k] || 0); found = true; } }); return found ? s : null; }
    var r1 = net(/^1\.0\.0\.0\.00/), r2 = net(/^2\.0\.0\.0\.00/);
    if (r1 != null || r2 != null) o.r = (r1 || 0) + (r2 || 0);
    var t = net(/^1\.1\.0\.0\.00/); if (t != null) o.trib = t;
    var isNew = Object.keys(rb).some(function (k) { return /^1\.7\.1\.0\.00/.test(k); });
    var u = isNew ? (net(/^1\.7\.1\.0\.00/) || 0) + (net(/^2\.4\.1\.0\.00/) || 0) : (net(/^1\.7\.2\.1\.00/) || 0) + (net(/^2\.4\.2\.1\.00/) || 0);
    var e = isNew ? (net(/^1\.7\.2\.0\.00/) || 0) + (net(/^2\.4\.2\.0\.00/) || 0) : (net(/^1\.7\.2\.2\.00/) || 0) + (net(/^2\.4\.2\.2\.00/) || 0);
    if (u) o.tu = u;
    if (e) o.te = e;
    var oc = net(/^2\.1\.0\.0\.00/); if (oc) o.oc = oc;
    if (totE != null) o.d = totE;
    if (totP != null) o.dpg = totP;
    if (Object.keys(f).length) o.f = f;
    if (pop) o.pop = pop;
    return (o.r == null && o.d == null) ? null : o;
  }
  var liveQueue = Promise.resolve(), lastCall = 0;
  function fetchLive(ente, year) {
    liveQueue = liveQueue.then(function () {
      var wait = Math.max(0, 1100 - (Date.now() - lastCall));
      return new Promise(function (res) { setTimeout(res, wait); }).then(function () {
        lastCall = Date.now();
        return fetch(SICONFI + "?an_exercicio=" + year + "&id_ente=" + ente).then(function (r) { return r.ok ? r.json() : null; })
          .then(function (j) { return j ? coreDCA(j.items || []) : undefined; }).catch(function () { return undefined; });
      });
    });
    return liveQueue;
  }
  function lastDCAYear() { var d = new Date(); return d.getMonth() >= 4 ? d.getFullYear() - 1 : d.getFullYear() - 2; }
  function fillLive(P) {
    if (P.kind !== "m" || P.id === 5300108) return;
    var id = P.id, missing = [];
    for (var y = lastDCAYear(); y >= 2013; y--) if (!(String(y) in P.anos)) missing.push(y);
    if (!missing.length) { S.liveMsg = ""; return; }
    var done = 0, token = {};
    S.live[id] = S.live[id] || {};
    S.liveToken = token;
    var say = function (txt) { S.liveMsg = txt; var b = $("#din-live"); if (b) b.innerHTML = txt ? '<div class="mp-progress">' + txt + "</div>" : ""; };
    say("Buscando " + missing.length + " ano(s) direto no Tesouro Nacional (SICONFI)… leva cerca de " + Math.ceil(missing.length * 1.5) + " segundos.");
    missing.forEach(function (y) {
      fetchLive(id, y).then(function (c) {
        done++;
        if (c !== undefined) S.live[id][y] = c || 0;
        if (S.liveToken !== token || S.m !== id) return;
        if (done === missing.length) {
          say("");
          var L = S.live[id];
          Object.keys(L).forEach(function (yy) { P.anos[yy] = L[yy] || 0; P.src[yy] = L[yy] ? "ao vivo" : "sem"; });
          if (S.P === P) { renderSheet(P); setupMoneyFilters(P); renderMoney(); }
        }
        else say("Buscando no Tesouro Nacional: " + done + " de " + missing.length + " anos…");
      });
    });
  }

  // ---------- valores, inflação e população ----------
  function fator(y) { var f = S.meta && S.meta.ipca && S.meta.ipca.fator; return f ? f[String(y)] : null; }
  function realMode() { return $("#f-modo").value === "real"; }
  function pcMode() { return $("#f-pc").value === "pc"; }
  function unitOf(y) { return realMode() ? "R$" : (MOEDA[y] || "R$"); }
  function adj(v, y) {
    if (v == null) return null;
    if (!realMode()) return v;
    var f = fator(y); if (f == null && y > (S.meta.ipca || {}).base) f = 1;
    return f == null ? null : v * f;
  }
  function popOf(P, y) {
    var c = P.anos[y];
    if (c && c.pop) return c.pop;
    if (P.kind === "m" && P.popAnual) { var a = P.popAnual, i = y - a.ano0; if (i >= 0 && i < a.v.length && a.v[i]) return a.v[i]; }
    return null;
  }
  function funcVal(c, fn) { if (!c) return null; if (!fn) return c.d; return c.f ? (c.f[fn] || 0) : null; }
  function showVal(v, y, P) {
    var a = adj(v, y); if (a == null) return null;
    if (pcMode()) { var p = popOf(P, y); return p ? a / p : null; }
    return a;
  }
  function ymd() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function personLink(id, text) {
    if (S.pages.politicos && id) return '<a href="../politicos/?id=' + encodeURIComponent(id) + '">' + esc(text) + "</a>";
    return esc(text);
  }
  function mandText(m) { return m.inicio && m.fim ? m.inicio + " a " + m.fim : String(m.ano); }

  // ---------- painel lateral + seções ----------
  function renderBrasil() {
    var nm = S.meta.nacional_municipios || {}, ne = S.meta.nacional_estados || {};
    var y = lastFullYear(), a = nm[y] || {};
    var ye = Object.keys(ne).filter(function (k) { return ne[k] && ne[k].n >= 27; }).sort().pop(), e = ne[ye] || {};
    var popBR = S.base.ufs.reduce(function (s, u) { return s + (u.pop || 0); }, 0);
    $("#mp-sheet").innerHTML = '<div class="role">Brasil</div><h3>27 estados e ' + int(S.base.municipios.length) + " cidades</h3>" +
      '<p class="meta">' + int(popBR) + " habitantes (estimativa IBGE)</p>" +
      '<dl class="mp-facts">' +
      "<div><dt>Prefeituras gastaram em " + y + "</dt><dd>" + money(a.despesa) + "<small>" + int(a.n) + " prefeituras com contas entregues</small></dd></div>" +
      "<div><dt>Governos estaduais em " + (ye || "—") + "</dt><dd>" + money(e.d) + "<small>" + int(e.n) + " estados + DF</small></dd></div>" +
      "<div><dt>Cidade típica gasta por morador</dt><dd>" + money(a.despesa_pc_mediana) + "<small>mediana, " + y + "</small></dd></div>" +
      "<div><dt>Parte da cidade típica em saúde</dt><dd>" + pct(a.saude_pct_mediana) + "<small>educação: " + pct(a.educacao_pct_mediana) + "</small></dd></div></dl>" +
      '<p class="note-sm" style="margin-top:12px">Toque num estado no mapa, ou busque uma cidade no campo acima.</p>';
    $("#gov-body").innerHTML = '<p class="state-empty">Escolha um estado ou uma cidade no mapa para ver governador(a), prefeito(a), vices e todos os eleitos desde 1994/1996.</p>';
    $("#din-body").innerHTML = '<p class="state-empty">Escolha um estado ou uma cidade no mapa para ver receitas e gastos ano a ano.</p>';
    if (!$("#cmp-a").dataset.key) renderCompare();
  }
  function renderPlace() {
    var key = placeKey(), sheet = $("#mp-sheet");
    sheet.innerHTML = '<p class="skeleton" style="height:120px"></p>';
    if (S.m === 5300108) {
      sheet.innerHTML = '<div class="role">Distrito Federal</div><h3>Brasília</h3><p class="meta">O Distrito Federal não tem prefeitura nem vereadores: quem governa é o governo do DF (governador e Câmara Legislativa). As contas e os governantes aparecem no Distrito Federal.</p><div class="mp-actions"><button type="button" class="primary" data-open-uf="DF">Ver o Distrito Federal</button></div>';
      $("[data-open-uf]", sheet).addEventListener("click", function () { openUF("DF"); });
      $("#gov-body").innerHTML = '<p class="state-empty">Brasília é governada pelo Governo do Distrito Federal.</p>';
      $("#din-body").innerHTML = '<p class="state-empty">Veja as contas no Distrito Federal.</p>';
      return;
    }
    loadPlace(key).then(function (P) {
      if (key !== placeKey()) return;
      S.P = P;
      var extra = P.kind === "m" ? tryJSON("pop/" + P.uf + ".json").then(function (d) {
        if (d && d.m[P.id]) P.popAnual = { ano0: d.ano0, v: d.m[P.id] };
      }) : Promise.resolve();
      extra.then(function () {
        if (key !== placeKey()) return;
        renderSheet(P); renderGov(P); setupMoneyFilters(P); renderMoney(); fillLive(P);
        var a = $("#cmp-a");
        if (!a.dataset.key || a.dataset.auto === "1") {
          a.value = P.nome + (P.kind === "m" ? " (" + P.uf + ")" : ""); a.dataset.key = key; a.dataset.auto = "1";
          var b = $("#cmp-b");
          if (!b.dataset.key || b.dataset.auto === "1") {
            if (P.kind === "m") { var capId = capitalOf(P.uf); if (capId && capId !== P.id) { b.value = S.mun[capId].nome + " (" + P.uf + ")"; b.dataset.key = "m:" + capId; b.dataset.auto = "1"; } }
            else { var o = P.uf === "SP" ? "MG" : "SP"; b.value = S.ufs[o].nome; b.dataset.key = "uf:" + o; b.dataset.auto = "1"; }
          }
          renderCompare();
        }
      });
    });
  }
  function capitalOf(uf) { for (var k in S.mun) if (S.mun[k].uf === uf && S.mun[k].cap) return S.mun[k].id; return null; }
  function latestYear(P) {
    var ys = Object.keys(P.anos).filter(function (y) { return P.anos[y] && P.anos[y].d; }).map(Number).sort(function (a, b) { return b - a; });
    return ys[0] || null;
  }
  function currentExec(P) {
    if (P.kind === "uf") {
      var g = ((P.pol && P.pol.governadores) || []).filter(function (m) { return m.ano <= 2022; }).pop();
      return g;
    }
    var ps = (P.pol && P.pol.prefeitos) || [], today = ymd();
    var cur = ps.filter(function (m) { return isoFromBr(m.inicio) <= today; }).pop();
    return cur || ps[ps.length - 1];
  }
  function renderSheet(P) {
    var y = latestYear(P), c = y ? P.anos[y] : null, cur = currentExec(P);
    var role = P.kind === "uf" ? "Estado · " + (S.ufs[P.uf].regiao || "") : (P.m.cap ? "Capital de " + S.ufs[P.uf].nome : "Cidade · " + S.ufs[P.uf].nome);
    var who = "";
    if (cur) {
      var lab = P.kind === "uf" ? "Governador(a) eleito(a) em " + cur.ano : "Prefeito(a)";
      who = "<div><dt>" + lab + "</dt><dd>" + personLink(cur.id, cur.nome) + "<small>" + esc(cur.partido) + " · " + esc(mandText(cur)) + "</small></dd></div>";
    }
    if (P.kind === "uf" && S.ufsAlex) {
      var alex = (S.ufsAlex.ufs || []).filter(function (u) { return u.uf === P.uf; })[0];
      if (alex && alex.governador && cur && norm(alex.governador).split(" ")[0] !== norm(cur.nome).split(" ")[0] && norm(cur.nome_completo).indexOf(norm(alex.governador).split(" ").pop()) < 0)
        who += "<div><dt>No cargo hoje</dt><dd>" + esc(alex.governador) + "<small>assumiu durante o mandato (G1, set/2026)</small></dd></div>";
    }
    var pc = c && c.d ? (c.pop || popOf(P, y)) : null;
    var u = MOEDA[y] || "R$";
    var f = (c && c.f) || {};
    var sheet = $("#mp-sheet");
    sheet.innerHTML = '<div class="role">' + esc(role) + "</div><h3>" + esc(P.nome) + "</h3>" +
      '<p class="meta">' + (P.pop ? int(P.pop) + " habitantes (IBGE 2025)" : "") + "</p>" +
      '<dl class="mp-facts">' + who +
      (c ? "<div><dt>" + (P.kind === "uf" ? "Governo estadual gastou" : "Prefeitura gastou") + " em " + y + "</dt><dd>" + money(c.d, u) + "<small>arrecadou " + money(c.r, u) + "</small></dd></div>" +
           "<div><dt>Por morador em " + y + "</dt><dd>" + (pc ? money(c.d / pc, u) : "—") + "<small>valores da época</small></dd></div>" +
           (c.f ? "<div><dt>Saúde e educação</dt><dd>" + pct(100 * ((f["10"] || 0) + (f["12"] || 0)) / c.d) + "<small>do total gasto em " + y + "</small></dd></div>" : "")
         : "<div><dt>Contas</dt><dd>Sem dados ainda<small>veja a seção Dinheiro</small></dd></div>") +
      (function () { var fd = fedData(P), L = fd && fd.last.rf; return L ? "<div><dt>" + esc(rfName(L.y)) + " em " + MES[L.m] + "/" + L.y + "</dt><dd>" + money(L.v) + "<small>" + int(L.q) + " famílias (pago pelo governo federal)</small></dd></div>" : ""; })() +
      "</dl>" +
      '<div class="mp-actions"><a class="primary" href="#governo">Quem governa</a><a href="#dinheiro">Gastos</a>' +
      (P.kind === "m" ? '<a href="https://cidades.ibge.gov.br/brasil/' + P.uf.toLowerCase() + "/" + slug(P.nome) + '/panorama" target="_blank" rel="noopener">IBGE Cidades ↗</a>' : "") + "</div>";
  }

  // ---------- quem governa ----------
  function personCard(role, m, note, warn) {
    var v = m.vice;
    return '<article class="mp-person' + (warn ? " is-warn" : "") + '"><div class="role">' + esc(role) + "</div>" +
      "<h3>" + personLink(m.id, m.nome) + "</h3>" +
      "<p>" + esc(m.nome_completo || "") + " · <b>" + esc(m.partido) + "</b></p>" +
      "<p>Mandato: " + esc(mandText(m)) + (m.tipo && m.tipo !== "ordinária" ? " (eleição " + esc(m.tipo) + ")" : "") + "</p>" +
      (m.n_mandato ? "<p>" + m.n_mandato + "º mandato neste cargo aqui · " + m.n_exec_total + " mandato(s) no Executivo desde 1994/96 (titular ou vice)</p>" : "") +
      (v ? "<p>Vice: " + personLink(v.id, v.nome) + " (" + esc(v.partido) + ")</p>" : "") +
      (note ? '<p class="note-sm">' + note + "</p>" : "") + "</article>";
  }
  function timeline(list, cargo) {
    if (!list.length) return "";
    var rows = list.slice().reverse().map(function (m) {
      return "<tr><td>" + m.ano + (m.tipo && m.tipo !== "ordinária" ? " <span class=\"badge warn\">" + esc(m.tipo) + "</span>" : "") + "</td><td>" + personLink(m.id, m.nome) +
        '<br><small class="muted">' + esc(m.nome_completo || "") + "</small></td><td>" + esc(m.partido) + "</td><td>" +
        (m.vice ? personLink(m.vice.id, m.vice.nome) + " (" + esc(m.vice.partido) + ")" : "—") + "</td><td>" + esc(mandText(m)) + "</td><td class=\"num\">" + (m.n_mandato || "") + "º</td></tr>";
    }).join("");
    return '<h3 class="mp-h3">Todos os ' + cargo + " eleitos (TSE)</h3>" +
      '<div class="table-wrap"><table class="data-table mp-timeline"><thead><tr><th>Eleição</th><th>Eleito(a)</th><th>Partido</th><th>Vice</th><th>Mandato</th><th>Vez no cargo</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
  }
  function renderGov(P) {
    var box = $("#gov-body"), h = [], today = ymd();
    var src = (P.pol && P.pol.fonte) || (P.ufPol && P.ufPol.fonte);
    if (P.kind === "uf") {
      var gs = (P.pol && P.pol.governadores) || [];
      var cur = gs.filter(function (m) { return m.ano <= 2022; }).pop();
      var next = gs.filter(function (m) { return m.ano >= 2026; });
      h.push('<div class="mp-people">');
      if (cur) h.push(personCard("Governador(a) eleito(a) em " + cur.ano, cur, "Mandato até a posse dos eleitos de 2026, em 6 de janeiro de 2027."));
      var alex = S.ufsAlex && (S.ufsAlex.ufs || []).filter(function (u) { return u.uf === P.uf; })[0];
      if (alex && alex.governador && cur && norm(cur.nome_completo + " " + cur.nome).indexOf(norm(alex.governador).split(" ").pop()) < 0) {
        h.push('<article class="mp-person is-warn"><div class="role">Em exercício hoje</div><h3>' + esc(alex.governador) + "</h3><p>Assumiu o governo durante o mandato (por exemplo, o vice que assume quando o titular sai para concorrer ou renuncia).</p>" +
          '<p class="note-sm">Fonte: <a href="' + esc(S.ufsAlex.fonteGovernadores) + '" target="_blank" rel="noopener">levantamento do G1</a>, atualizado em ' + esc(brDate(S.ufsAlex.atualizado)) + ".</p></article>");
      }
      next.forEach(function (m) { h.push(personCard("Eleito(a) em " + brDate(m.data), m, "Assume em " + esc(m.inicio) + ".")); });
      ((P.pol && P.pol.segundo_turno) || []).forEach(function (st) {
        h.push('<article class="mp-person"><div class="role">2º turno em 2026</div><h3>' + st.candidatos.map(function (c) { return personLink(c.id, c.nome) + " <small>(" + esc(c.partido) + ")</small>"; }).join(" × ") +
          "</h3><p>Ninguém teve mais da metade dos votos válidos no 1º turno (" + esc(brDate(st.data_1t)) + "). O 2º turno decide quem assume em janeiro de 2027.</p></article>");
      });
      h.push("</div>");
      h.push(timeline(gs.filter(function (m) { return m.ano <= 2022; }), "governadores"));
      h.push('<p class="note-sm">O TSE só publica dados de candidatos a partir de 1994. Quem assumiu sem ser eleito titular (vice que virou governador, interino) não aparece na lista como titular.</p>');
    } else {
      var ps = (P.pol && P.pol.prefeitos) || [];
      var c = currentExec(P);
      h.push('<div class="mp-people">');
      if (c) {
        var ended = c.fim && isoFromBr(c.fim) < today;
        h.push(personCard(ended ? "Último(a) prefeito(a) eleito(a)" : "Prefeito(a)", c, ended ? "O mandato registrado terminou; pode haver eleição suplementar ou interino. Confira na prefeitura." : "", ended));
      } else h.push('<p class="state-empty">Não encontramos prefeito eleito para esta cidade nos dados do TSE.</p>');
      ((P.pol && P.pol.eleicoes_sem_eleito) || []).forEach(function (e) {
        h.push('<article class="mp-person is-warn"><div class="role">Eleição ' + esc(e.tipo) + " de " + e.ano + "</div><h3>Sem eleito registrado</h3><p>Em " + esc(brDate(e.data)) + " houve " + e.candidatos +
          " candidatura(s), mas o TSE não registra ninguém eleito (por exemplo, candidatura indeferida ou votos anulados). Pode ter havido nova eleição depois.</p></article>");
      });
      h.push("</div>");
      h.push(timeline(ps, "prefeitos"));
      var cam = (P.pol && P.pol.camara) || {}, cy = Object.keys(cam).sort();
      if (cy.length) {
        var last = cy[cy.length - 1], vs = cam[last];
        var pc = partyColors(vs.map(function (v) { return v[1]; }));
        h.push('<h3 class="mp-h3">Câmara de Vereadores — eleitos em ' + last.replace("s", " (suplementar)") + " (" + vs.length + " vagas)</h3>");
        h.push('<div class="mp-party" role="img" aria-label="Divisão das vagas por partido">' + pc.order.map(function (p) { return '<span title="' + esc(p) + '" style="width:' + (100 * pc.cnt[p] / vs.length) + "%;background:" + pc.col[p] + '"></span>'; }).join("") + "</div>");
        h.push('<div class="mp-party-legend">' + pc.order.map(function (p) { return '<span><i style="background:' + pc.col[p] + '"></i>' + esc(p) + " " + pc.cnt[p] + "</span>"; }).join("") + "</div>");
        h.push('<ul class="mp-names">' + vs.slice().sort(function (a, b) { return a[0].localeCompare(b[0], "pt"); }).map(function (v) {
          return "<li>" + personLink(v[3], v[0]) + " <small>" + esc(v[1]) + (v[4] > 1 ? " · " + v[4] + "º mandato" : "") + "</small></li>";
        }).join("") + "</ul>");
        if (cy.length > 1) {
          h.push('<details class="mp-more"><summary>Câmaras anteriores (' + cy.slice(0, -1).map(function (y) { return y.replace("s", "*"); }).join(", ") + ")</summary>" +
            cy.slice(0, -1).reverse().map(function (y) {
              var l = cam[y], p2 = partyColors(l.map(function (v) { return v[1]; }));
              return "<p><b>" + y.replace("s", " (suplementar)") + "</b> — " + l.length + " vereadores: " + p2.order.map(function (p) { return esc(p) + " " + p2.cnt[p]; }).join(", ") + "</p>";
            }).join("") + "</details>");
        }
      }
      h.push('<p class="note-sm">Dados do TSE desde 1996 (primeira eleição municipal com dados abertos). Quem assumiu por morte, renúncia ou cassação do titular não aparece como prefeito eleito.</p>');
    }
    if (src) h.push('<p class="note-sm">Fonte: <a href="' + esc(src.url) + '" target="_blank" rel="noopener">' + esc(src.nome) + "</a>, baixado em " + esc(brDate(src.baixado_em)) + ".</p>");
    box.innerHTML = h.join("");
  }

  // ---------- dinheiro ----------
  var funcFilled = false;
  function setupMoneyFilters(P) {
    if (!funcFilled) {
      $("#f-func").insertAdjacentHTML("beforeend", Object.keys(FUNC).map(function (k) { return '<option value="' + k + '">' + esc(FUNC[k][1]) + "</option>"; }).join(""));
      funcFilled = true;
    }
    var ys = Object.keys(P.anos).map(Number);
    if (P.kind === "m" && P.id !== 5300108) for (var y = 2013; y <= lastDCAYear(); y++) ys.push(y);
    if (!ys.length) ys = [lastDCAYear()];
    var lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys), all = [];
    for (var k = hi; k >= lo; k--) all.push(k);
    var de = $("#f-de"), ate = $("#f-ate"), ano = $("#f-ano");
    var keepDe = +de.value, keepAte = +ate.value;
    fillYears(de, all, keepDe >= lo && keepDe <= hi && de.dataset.user ? keepDe : lo);
    fillYears(ate, all, keepAte >= lo && keepAte <= hi && ate.dataset.user ? keepAte : hi);
    fillYears(ano, all, latestYear(P) || hi);
    if (!de.dataset.bound) {
      de.dataset.bound = "1";
      de.addEventListener("change", function () { de.dataset.user = "1"; });
      ate.addEventListener("change", function () { ate.dataset.user = "1"; });
    }
  }
  function aggPC(a, fn) {
    if (!a || !a.populacao) return null;
    var k = !fn ? "despesa" : { "10": "saude", "12": "educacao", "06": "seguranca" }[fn];
    return k && a[k] != null ? a[k] / a.populacao : null;
  }
  function chartSVG(P, ys, fn, Y) {
    var W = 820, H = 270, L = 64, R = 10, T = 12, B = 30;
    var pc = pcMode(), series = [], cmpUF = [], cmpBR = [];
    var ufAgg = P.kind === "m" && P.ufInfo ? P.ufInfo.municipios_agregado || {} : {};
    var nMun = P.kind === "m" ? Object.keys(S.mun).filter(function (k) { return S.mun[k].uf === P.uf; }).length : 0;
    ys.forEach(function (y) {
      var c = P.anos[y] || null;
      var d = showVal(funcVal(c, fn), y, P), r = fn ? null : showVal(c ? c.r : null, y, P);
      series.push({ y: y, d: d, r: r });
      if (pc) {
        if (P.kind === "m") {
          var a = ufAgg[y], n = S.meta.nacional_municipios && S.meta.nacional_municipios[y];
          cmpUF.push(a && a.n >= nMun * 0.6 ? adj(aggPC(a, fn), y) : null);
          cmpBR.push(n && n.n >= 3000 ? adj(aggPC(n, fn), y) : null);
        } else {
          var e = S.meta.nacional_estados && S.meta.nacional_estados[y];
          cmpBR.push(!fn && e && e.n >= 20 && e.pop ? adj(e.d / e.pop, y) : null);
        }
      }
    });
    var vals = [];
    series.forEach(function (s) { if (s.d != null) vals.push(s.d); if (s.r != null) vals.push(s.r); });
    cmpUF.concat(cmpBR).forEach(function (v) { if (v != null) vals.push(v); });
    if (!vals.length) return null;
    var max = Math.max.apply(null, vals) || 1, raw = max / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = mag;
    [1, 2, 2.5, 5, 10].some(function (k) { step = k * mag; return step * 4 >= max; });
    var top = step * 4, n = ys.length, bw = (W - L - R) / n;
    var X = function (i) { return L + i * bw; }, Yp = function (v) { return T + (H - T - B) * (1 - v / top); };
    var u = unitOf(Y), out = ['<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Gráfico por ano">'];
    for (var t = 0; t <= 4; t++) {
      var gv = step * t, gy = Yp(gv);
      out.push('<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + gy + '" y2="' + gy + '"/><text class="ax" x="' + (L - 6) + '" y="' + (gy + 4) + '" text-anchor="end">' + esc(money(gv, "")) + "</text>");
    }
    var every = Math.ceil(n / (W < 500 ? 6 : 12));
    series.forEach(function (s, i) {
      var x = X(i), sel = s.y === Y ? " is-sel" : "";
      if (fn) {
        if (s.d != null) out.push('<rect class="b-d' + sel + '" x="' + (x + bw * 0.15) + '" y="' + Yp(s.d) + '" width="' + bw * 0.7 + '" height="' + Math.max(0, Yp(0) - Yp(s.d)) + '" rx="2"/>');
      } else {
        if (s.r != null) out.push('<rect class="b-r' + sel + '" x="' + (x + bw * 0.1) + '" y="' + Yp(s.r) + '" width="' + bw * 0.38 + '" height="' + Math.max(0, Yp(0) - Yp(s.r)) + '" rx="2"/>');
        if (s.d != null) out.push('<rect class="b-d' + sel + '" x="' + (x + bw * 0.5) + '" y="' + Yp(s.d) + '" width="' + bw * 0.38 + '" height="' + Math.max(0, Yp(0) - Yp(s.d)) + '" rx="2"/>');
      }
      if (s.d == null && s.r == null) out.push('<rect class="b-x" x="' + (x + bw * 0.3) + '" y="' + (Yp(0) - 3) + '" width="' + bw * 0.4 + '" height="3"/>');
      if (i % every === 0 || s.y === Y) out.push('<text class="ax" x="' + (x + bw / 2) + '" y="' + (H - 10) + '" text-anchor="middle">' + (n > 16 ? "'" + String(s.y).slice(2) : s.y) + "</text>");
      var tip = s.y + ": " + (fn ? "gasto " + money(s.d, unitOf(s.y)) : "entrou " + money(s.r, unitOf(s.y)) + " · gastou " + money(s.d, unitOf(s.y)));
      if (s.d == null && s.r == null) tip = s.y + ": " + (realMode() && s.y < 1995 && P.anos[s.y] ? "antes de 1995 só sem correção (troque para “Da época”)" : "sem dados");
      out.push('<rect class="hit" data-y="' + s.y + '" x="' + x + '" y="' + T + '" width="' + bw + '" height="' + (H - T - B) + '"><title>' + esc(tip) + "</title></rect>");
    });
    function line(arr, cls) {
      var pts = [], segs = [];
      arr.forEach(function (v, i) { if (v != null) pts.push(X(i) + bw / 2 + "," + Yp(v)); else if (pts.length) { segs.push(pts); pts = []; } });
      if (pts.length) segs.push(pts);
      segs.forEach(function (p) { out.push('<polyline class="' + cls + '" points="' + p.join(" ") + '"/>'); });
    }
    line(cmpUF, "ln2"); line(cmpBR, "ln3");
    out.push("</svg>");
    var leg = fn ? '<span><i style="background:var(--accent)"></i>' + esc(FUNC[fn][1]) + "</span>"
      : '<span><i style="background:color-mix(in srgb, var(--accent) 45%, transparent)"></i>Entrou (receita)</span><span><i style="background:var(--accent)"></i>Gastou (despesa)</span>';
    if (cmpUF.some(function (v) { return v != null; })) leg += '<span><i style="background:#8aa0ff"></i>Média das cidades de ' + esc(P.uf) + "</span>";
    if (cmpBR.some(function (v) { return v != null; })) leg += '<span><i style="background:var(--warn)"></i>' + (P.kind === "m" ? "Média das cidades do Brasil" : "Média dos estados") + "</span>";
    if (pc && P.kind === "m" && !cmpUF.some(function (v) { return v != null; }) && fn && ["10", "12", "06"].indexOf(fn) < 0) leg += "<span>(comparação por área só para saúde, educação e segurança)</span>";
    return { svg: out.join(""), leg: leg };
  }
  // ---------- benefícios federais pagos direto aos moradores (Portal da Transparência) ----------
  var MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  function rfName(y) {
    y = +y;
    return y <= 2020 ? "Bolsa Família" : y === 2021 ? "Bolsa Família / Auxílio Brasil" : y === 2022 ? "Auxílio Brasil" : y === 2023 ? "Auxílio Brasil / Bolsa Família" : "Bolsa Família";
  }
  function fedData(P) {
    var F = P.fedDoc; if (!F || !F.m) return null;
    var ids = P.kind === "m" ? [String(P.id)] : Object.keys(S.mun).filter(function (k) { return S.mun[k].uf === P.uf; });
    var out = { rf: {}, bpc: {}, last: {} };
    ["rf", "bpc"].forEach(function (prog) {
      var years = {};
      ids.forEach(function (id) { var e = F.m[id] && F.m[id][prog]; if (e) Object.keys(e).forEach(function (y) { years[y] = 1; }); });
      Object.keys(years).forEach(function (y) {
        var v = 0, qs = [], months = [];
        for (var mi = 0; mi < 12; mi++) {
          var ok = true, mv = 0, mq = 0;
          for (var i = 0; i < ids.length; i++) {
            var e = F.m[ids[i]] && F.m[ids[i]][prog] && F.m[ids[i]][prog][y];
            if (!e || e.v[mi] == null) { ok = false; break; }
            mv += e.v[mi]; mq += e.q[mi] || 0;
          }
          if (ok) { v += mv; qs.push(mq); months.push(mi); if (mv > 0) { var L = out.last[prog]; if (!L || +y * 12 + mi > L.y * 12 + L.m) out.last[prog] = { y: +y, m: mi, v: mv, q: mq }; } }
        }
        if (months.length && v > 0) out[prog][y] = { v: v, q: Math.round(qs.reduce(function (a, b) { return a + b; }, 0) / qs.length), n: months.length, months: months };
      });
    });
    return Object.keys(out.rf).length || Object.keys(out.bpc).length ? out : null;
  }
  function fedHTML(P) {
    var fd = fedData(P); if (!fd) return "";
    var ys = Object.keys(fd.rf).concat(Object.keys(fd.bpc)).filter(function (y, i, a) { return a.indexOf(y) === i; }).sort().reverse();
    var cell = function (e, y) {
      if (!e) return '<td class="num">—</td><td class="num">—</td>';
      var p = P.kind === "m" ? popOf(P, +y) : null, val = adj(e.v, +y);
      var part = e.n < 12 ? ' <small class="muted">(' + (e.n === 1 ? MES[e.months[0]] : e.n === e.months[e.months.length - 1] - e.months[0] + 1 ? MES[e.months[0]] + "–" + MES[e.months[e.months.length - 1]] : e.n + " meses") + ")</small>" : "";
      return '<td class="num">' + money(val, "R$") + part + (p && val != null ? '<br><small class="muted">' + money(val / p, "R$") + " por morador</small>" : "") + '</td><td class="num">' + int(e.q) + "</td>";
    };
    var rows = ys.map(function (y) { return "<tr><td>" + y + '<br><small class="muted">' + esc(rfName(y)) + "</small></td>" + cell(fd.rf[y], y) + cell(fd.bpc[y], y) + "</tr>"; }).join("");
    var L = fd.last.rf, who = P.kind === "m" ? "moradores de " + P.nome : "moradores de " + P.nome + " (soma das cidades)";
    return '<h3 class="mp-h3">Dinheiro federal pago direto às famílias</h3>' +
      '<p class="lead-simples">Além das contas do governo local, o governo federal paga benefícios direto aos ' + esc(who) + "." +
      (L ? " Em " + MES[L.m] + "/" + L.y + ", o " + esc(rfName(L.y)) + " pagou <b>" + money(L.v) + "</b> para <b>" + int(L.q) + "</b> famílias." : "") + "</p>" +
      '<div class="table-wrap"><table class="data-table mp-fed"><thead><tr><th>Ano</th><th class="num">Bolsa Família e sucessores</th><th class="num">Famílias por mês (média)</th><th class="num">BPC (idosos e pessoas com deficiência)</th><th class="num">Pessoas por mês (média)</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      '<p class="note-sm">' + (realMode() ? "Valores corrigidos pela inflação (IPCA). " : "Valores da época. ") + "Esse dinheiro não passa pelo caixa " + (P.kind === "m" ? "da prefeitura" : "do governo estadual") + ", por isso não aparece nas contas acima. " +
      "Fonte: <a href=\"https://portaldatransparencia.gov.br/beneficios\" target=\"_blank\" rel=\"noopener\">Portal da Transparência (CGU)</a>. Os meses estão sendo copiados aos poucos, do mais recente para o mais antigo (desde 2004)" +
      (P.kind === "uf" ? "; a soma do estado só aparece para meses em que todas as cidades já foram copiadas" : "") + ".</p>";
  }
  function kpi(label, val, small) { return '<div class="mp-kpi"><span>' + esc(label) + "</span><b>" + val + "</b>" + (small ? "<small>" + small + "</small>" : "") + "</div>"; }
  function renderMoney() {
    var P = S.P, box = $("#din-body"); if (!P || !box) return;
    var de = +$("#f-de").value, ate = +$("#f-ate").value, Y = +$("#f-ano").value, fn = $("#f-func").value;
    if (de > ate) { var t = de; de = ate; ate = t; }
    var ys = []; for (var y = de; y <= ate; y++) ys.push(y);
    var c = P.anos[Y] || null, real = realMode() && Y >= 1995, u = real ? "R$" : (MOEDA[Y] || "R$");
    var A = function (v) { return real ? adj(v, Y) : v; };
    var h = ['<div id="din-live">' + (S.liveMsg && S.liveToken && P.kind === "m" ? '<div class="mp-progress">' + S.liveMsg + "</div>" : "") + "</div>"];
    var who = P.kind === "uf" ? "o governo de " + P.nome : "a prefeitura de " + P.nome;
    h.push('<p class="lead-simples">Em <b>' + Y + "</b>, " + esc(who) + (c && c.d ? " gastou <b>" + money(A(c.d), u) + "</b>" + (c.r ? " e arrecadou <b>" + money(A(c.r), u) + "</b>" : "") + "." : ": ainda sem contas disponíveis.") +
      (realMode() && Y < 1995 && c ? " Antes de 1995 os valores ficam na moeda da época (" + esc(MOEDA[Y] || "R$") + "), sem correção." : (real && Y < (S.meta.ipca || {}).base ? " Valores corrigidos pela inflação para reais de " + S.meta.ipca.base + "." : "")) + "</p>");
    if (c && c.d) {
      var p = popOf(P, Y), f = c.f || {};
      h.push('<div class="mp-kpis">' +
        kpi("Por morador", p ? money(A(c.d) / p, u) : "—", p ? "gasto ÷ " + int(p) + " habitantes" : "sem população do ano") +
        kpi("Salários e encargos de pessoal", pct(c.pe != null ? 100 * c.pe / c.d : null), money(A(c.pe), u) + " — servidores ativos e aposentados") +
        kpi("Obras e equipamentos", pct(c.inv != null ? 100 * c.inv / c.d : null), "investimentos: " + money(A(c.inv), u)) +
        (c.f ? kpi("Saúde", pct(100 * (f["10"] || 0) / c.d), money(A(f["10"]), u)) + kpi("Educação", pct(100 * (f["12"] || 0) / c.d), money(A(f["12"]), u)) : "") +
        kpi("Veio do governo federal", pct(c.tu != null && c.r ? 100 * c.tu / c.r : null), "transferências da União: " + money(A(c.tu), u)) +
        (P.kind === "m" ? kpi("Veio do governo estadual", pct(c.te != null && c.r ? 100 * c.te / c.r : null), "transferências do estado: " + money(A(c.te), u)) : "") +
        kpi("Impostos e taxas próprios", pct(c.trib != null && c.r ? 100 * c.trib / c.r : null), money(A(c.trib), u) + (P.kind === "m" ? " (IPTU, ISS, ITBI, taxas)" : " (ICMS, IPVA, ITCMD, taxas)")) +
        kpi("Pagou de dívidas", money(A((c.ju || 0) + (c.am || 0)) || null, u), "juros " + money(A(c.ju), u) + " + parcelas " + money(A(c.am), u)) +
        (c.div != null ? kpi("Empréstimos a pagar (saldo)", money(A(c.div), u), "no fim de " + Y) : "") +
        "</div>");
    }
    var ch = chartSVG(P, ys, fn, Y);
    var tl = (fn ? esc(FUNC[fn][0]) : "Quanto entrou e quanto saiu") + (pcMode() ? " — por habitante" : "") + ", " + de + "–" + ate;
    if (ch) h.push('<figure class="mp-chart"><figcaption>' + tl + '</figcaption><p class="sub">' + (realMode() ? "Corrigido pela inflação (IPCA) para reais de " + S.meta.ipca.base + "; anos antes de 1995 ficam em branco." : "Valores da época, sem correção. Até 1993 a moeda era outra (cruzado novo, cruzeiro, cruzeiro real); não compare com anos depois.") +
      " Toque numa barra para ver o ano.</p>" + ch.svg + '<div class="mp-chart-legend">' + ch.leg + "</div></figure>");
    else h.push('<p class="state-empty">Sem valores para este filtro e período.</p>');
    // áreas
    if (c && c.f && c.d) {
      var nMunUF = P.kind === "m" ? Object.keys(S.mun).filter(function (k) { return S.mun[k].uf === P.uf; }).length : 0;
      var ufA = P.kind === "m" && P.ufInfo ? (P.ufInfo.municipios_agregado || {})[Y] : null, brA = P.kind === "m" ? (S.meta.nacional_municipios || {})[Y] : null;
      if (ufA && !(ufA.n >= nMunUF * 0.6)) ufA = null;
      if (brA && !(brA.n >= 3000)) brA = null;
      var ks = Object.keys(c.f).filter(function (k) { return c.f[k] > 0; }).sort(function (a, b) { return c.f[b] - c.f[a]; });
      var med = { "10": "saude_pct_mediana", "12": "educacao_pct_mediana" };
      var item = function (k) {
        var sh = 100 * c.f[k] / c.d, extra = "";
        if (med[k] && ufA && ufA[med[k]] != null) extra += '<div class="bar uf"><span>cidade típica ' + esc(P.uf) + '</span><div class="t"><span style="width:' + Math.min(100, ufA[med[k]]) + '%"></span></div><em>' + pct(ufA[med[k]]) + "</em></div>";
        if (med[k] && brA && brA[med[k]] != null) extra += '<div class="bar br"><span>cidade típica BR</span><div class="t"><span style="width:' + Math.min(100, brA[med[k]]) + '%"></span></div><em>' + pct(brA[med[k]]) + "</em></div>";
        return '<li><div class="top"><b>' + esc((FUNC[k] || [k])[0]) + "</b><span>" + money(A(c.f[k]), u) + "</span></div>" +
          '<small class="off">nome oficial: ' + esc((FUNC[k] || [k, k])[1]) + '</small><div class="bars"><div class="bar"><span>' + (P.kind === "m" ? "esta cidade" : "este estado") + '</span><div class="t"><span style="width:' + Math.min(100, sh) + '%"></span></div><em>' + pct(sh) + "</em></div>" + extra + "</div></li>";
      };
      h.push('<div class="mp-two"><div><h3 class="mp-h3">Pra onde foi o dinheiro em ' + Y + '</h3><ul class="mp-funcs">' + ks.slice(0, 8).map(item).join("") + "</ul>" +
        (ks.length > 8 ? '<details class="mp-more"><summary>Ver as outras ' + (ks.length - 8) + " áreas</summary><ul class=\"mp-funcs\">" + ks.slice(8).map(item).join("") + "</ul></details>" : "") + "</div>");
      h.push('<div class="mp-explain"><b>Como ler.</b> “Gastou” é a despesa <b>empenhada</b> (o dinheiro que o governo se comprometeu a pagar no ano). As áreas seguem as “funções” oficiais da Portaria 42/1999. ' +
        "<b>Encargos especiais</b> são principalmente dívidas e precatórios. Pela Constituição, prefeituras devem aplicar pelo menos 15% da receita de impostos em saúde e 25% em educação — a conta oficial usa outra base, então os percentuais acima não servem para checar esse mínimo." +
        (P.kind === "m" ? " A “cidade típica” é a mediana: metade das cidades fica acima e metade abaixo; ela só aparece quando a maioria das cidades já tem contas do ano no site." : "") + "</div></div>");
    } else if (c && c.fa && c.d) {
      var ka = Object.keys(c.fa).sort(function (a, b) { return c.fa[b] - c.fa[a]; });
      h.push('<h3 class="mp-h3">Pra onde foi o dinheiro em ' + Y + ' (classificação antiga)</h3><ul class="mp-funcs">' + ka.map(function (k) {
        var sh = 100 * c.fa[k] / c.d;
        return '<li><div class="top"><b>' + esc((FUNC_OLD[k] || [k])[0]) + "</b><span>" + money(A(c.fa[k]), u) + '</span></div><div class="bars"><div class="bar"><span>parte</span><div class="t"><span style="width:' + Math.min(100, sh) + '%"></span></div><em>' + pct(sh) + "</em></div></div></li>";
      }).join("") + '</ul><p class="note-sm">Até 2001 as áreas eram agrupadas de outro jeito (por exemplo, saúde junto com saneamento). Em alguns anos o arquivo do Tesouro traz só parte das áreas, então a soma pode não fechar.</p>');
    }
    // lacunas e fontes
    var gaps = [], live = [];
    ys.forEach(function (y) { var s = P.src[y]; if (!P.anos[y] || !P.anos[y].d) gaps.push(y); if (s === "ao vivo") live.push(y); });
    var first = Object.keys(P.anos).filter(function (y) { return P.anos[y]; }).map(Number).sort()[0];
    h.push('<p class="mp-gaps">' + (gaps.length ? "Sem dados em: " + gaps.join(", ") + ". Isso acontece quando " + (P.kind === "m" ? "a prefeitura não entregou as contas ao Tesouro ou o arquivo histórico não traz a cidade" : "o Tesouro não tem a declaração") + ". " : "") +
      (first ? "Primeiro ano com contas: " + first + ". " : "") +
      (P.kind === "uf" ? "Contas dos governos estaduais com dados abertos padronizados existem a partir de 2013 (SICONFI). " : "Contas municipais: 1989–2012 do FINBRA e 2013 em diante do SICONFI (não existe base aberta padronizada para 1988). ") +
      (live.length ? "Os anos " + live.join(", ") + " foram buscados agora direto no Tesouro." : "") + "</p>");
    h.push(fedHTML(P));
    box.innerHTML = h.join("");
    $$(".mp-chart .hit", box).forEach(function (r) {
      r.addEventListener("click", function () { $("#f-ano").value = r.getAttribute("data-y"); renderMoney(); });
    });
  }

  // ---------- comparar ----------
  var IND = [
    ["Gasto por habitante", function (r) { return r[0] && r[7] ? r[0] / r[7] : null; }, "m"],
    ["Saúde por habitante", function (r) { return r[4] != null && r[7] ? r[4] / r[7] : null; }, "m"],
    ["Educação por habitante", function (r) { return r[5] != null && r[7] ? r[5] / r[7] : null; }, "m"],
    ["Segurança por habitante", function (r) { return r[6] != null && r[7] ? r[6] / r[7] : null; }, "m"],
    ["Impostos próprios por habitante", function (r) { return r[9] != null && r[7] ? r[9] / r[7] : null; }, "m"],
    ["% do gasto com pessoal", function (r) { return r[2] != null && r[0] ? 100 * r[2] / r[0] : null; }, "p"],
    ["% do gasto em obras e equipamentos", function (r) { return r[3] != null && r[0] ? 100 * r[3] / r[0] : null; }, "p"],
    ["% do gasto em saúde", function (r) { return r[4] != null && r[0] ? 100 * r[4] / r[0] : null; }, "p"],
    ["% do gasto em educação", function (r) { return r[5] != null && r[0] ? 100 * r[5] / r[0] : null; }, "p"],
    ["% da receita vinda da União", function (r) { return r[8] != null && r[1] ? 100 * r[8] / r[1] : null; }, "p"],
    ["População usada no cálculo", function (r) { return r[7] || null; }, "n"]
  ];
  function rowFor(key, y) {
    var t = key.split(":");
    if (t[0] === "uf") return Promise.all([tryJSON("uf/" + t[1] + ".json"), tryJSON("pol/uf/" + t[1] + ".json")]).then(function (r) {
      var g = ((r[1] && r[1].governadores) || []).filter(function (m) { return m.ano <= 2022; }).pop();
      return { nome: S.ufs[t[1]].nome, row: stateRow(r[0] && (r[0].governo_estadual.anos || {})[y]), who: g ? "Governador(a): " + g.nome + " (" + g.partido + ")" : "", kind: "uf" };
    });
    var id = +t[1], m = S.mun[id];
    return Promise.all([tryJSON("idx/" + y + ".json"), tryJSON("pol/uf/" + m.uf + ".json")]).then(function (r) {
      var pa = r[1] && r[1].prefeitos_atuais && r[1].prefeitos_atuais[id];
      return { nome: m.nome + " (" + m.uf + ")", row: r[0] && r[0].m[id] ? r[0].m[id] : null, who: pa ? "Prefeito(a): " + pa[0] + " (" + pa[1] + ")" : "", kind: "m" };
    });
  }
  function renderCompare() {
    var a = $("#cmp-a").dataset.key, b = $("#cmp-b").dataset.key, y = +$("#cmp-ano").value, box = $("#cmp-body");
    if (!a || !b) { box.innerHTML = '<p class="state-empty">Digite e escolha dois lugares (cidades ou estados).</p>'; return; }
    var tok = a + b + y; S.cmpTok = tok;
    Promise.all([rowFor(a, y), rowFor(b, y)]).then(function (r) {
      if (S.cmpTok !== tok) return;
      var A = r[0], B = r[1], u = MOEDA[y] || "R$";
      var fmt = function (k, v) { return v == null ? "—" : k === "m" ? money(v, u) : k === "p" ? pct(v) : int(v); };
      var rows = IND.map(function (ind) {
        var va = A.row ? ind[1](A.row) : null, vb = B.row ? ind[1](B.row) : null;
        return "<tr><td>" + esc(ind[0]) + '</td><td class="num"><b>' + fmt(ind[2], va) + '</b></td><td class="num"><b>' + fmt(ind[2], vb) + "</b></td></tr>";
      }).join("");
      var miss = [A, B].filter(function (x) { return !x.row; }).map(function (x) { return x.nome; });
      box.innerHTML = '<div class="table-wrap mp-cmp"><table class="data-table"><thead><tr><th>Em ' + y + ' (valores da época)</th><th class="num">' + esc(A.nome) + '</th><th class="num">' + esc(B.nome) + "</th></tr></thead><tbody>" + rows +
        '<tr><td>Quem governa (eleito)</td><td class="num">' + esc(A.who || "—") + '</td><td class="num">' + esc(B.who || "—") + "</td></tr></tbody></table></div>" +
        (miss.length ? '<p class="note-sm">Sem contas de ' + y + " para " + esc(miss.join(" e ")) + (y >= 2013 ? " no cache do site (as prefeituras estão sendo carregadas aos poucos; abra a cidade no mapa para buscar direto no Tesouro)" : "") + ".</p>" : "") +
        (A.kind !== B.kind ? '<p class="note-sm">Atenção: estados e prefeituras têm tarefas diferentes (por exemplo, a polícia é do estado), então a comparação entre um e outro é só ilustrativa.</p>' : "") +
        '<p class="note-sm">Mesmo ano, mesma moeda: por isso aqui não há correção pela inflação.</p>';
    });
  }

  // ---------- ranking ----------
  var RK = {
    pc: [0, "Gasto por habitante", "m"], saude_pc: [1, "Saúde por habitante", "m"], educacao_pc: [2, "Educação por habitante", "m"], seguranca_pc: [3, "Segurança por habitante", "m"],
    trib: [4, "Impostos próprios por habitante", "m"], pessoal: [5, "% com pessoal", "p"], invest: [6, "% em obras", "p"], saude: [7, "% em saúde", "p"], educacao: [8, "% em educação", "p"], dep: [9, "% vinda da União", "p"]
  };
  function renderRanking() {
    var uf = $("#rk-uf").value, ind = RK[$("#rk-ind").value], y = +$("#rk-ano").value, pr = $("#rk-pop").value.split("-").map(Number), box = $("#rk-body");
    if (!y) return;
    var tok = [uf, ind[0], y, pr].join("|"); S.rkTok = tok;
    tryJSON("idx/" + y + ".json").then(function (d) {
      if (S.rkTok !== tok) return;
      if (!d) { box.innerHTML = '<p class="state-empty">Sem dados para ' + y + ".</p>"; return; }
      var list = [];
      Object.keys(d.m).forEach(function (id) {
        var m = S.mun[+id], r = d.m[id]; if (!m) return;
        if (uf && m.uf !== uf) return;
        if (pr.length === 2 && !(r[7] >= pr[0] && r[7] < pr[1])) return;
        var v = IND[ind[0]][1](r);
        if (v == null || !isFinite(v) || v <= 0) return;
        list.push({ m: m, v: v });
      });
      if (list.length < 5) {
        box.innerHTML = '<p class="state-empty">Poucas cidades com contas de ' + y + " neste filtro (" + list.length + "). " + (y >= 2013 ? "As contas de 2013 em diante estão sendo carregadas aos poucos; tente 2012 ou anterior, ou outro ano." : "Tente outro ano.") + "</p>";
        return;
      }
      list.sort(function (a, b) { return b.v - a.v; });
      var u = MOEDA[y] || "R$", fmt = function (v) { return ind[2] === "m" ? money(v, u) : pct(v); };
      var med = list[Math.floor(list.length / 2)].v, out = 0;
      if (ind[0] === 0) {
        // gasto total por habitante muito abaixo do normal costuma ser declaração incompleta
        var before = list.length;
        list = list.filter(function (it) { return it.v >= med * 0.3; });
        out = before - list.length;
      }
      var li = function (it, pos) { return '<li><button type="button" data-m="' + it.m.id + '"><span class="pos">' + pos + 'º</span><span class="nm">' + esc(it.m.nome) + " <small>" + it.m.uf + " · " + int(it.m.pop) + ' hab.</small></span><span class="vl">' + fmt(it.v) + "</span></button></li>"; };
      var n = Math.min(10, Math.floor(list.length / 2));
      box.innerHTML = '<p class="lead-simples">' + int(list.length) + " cidades com dados em " + y + ". Cidade típica (mediana): <b>" + fmt(med) + "</b>.</p>" +
        '<div class="mp-rank"><div><h3>Maiores valores</h3><ol>' + list.slice(0, n).map(function (it, i) { return li(it, i + 1); }).join("") + "</ol></div>" +
        "<div><h3>Menores valores</h3><ol>" + list.slice(-n).reverse().map(function (it, i) { return li(it, list.length - i); }).join("") + "</ol></div></div>" +
        (out ? '<p class="note-sm">' + out + " cidade(s) com gasto por habitante abaixo de 30% da cidade típica ficaram de fora: quase sempre é declaração incompleta.</p>" : "") +
        '<p class="note-sm">Cidades muito pequenas costumam aparecer com gasto por habitante alto, porque têm custos fixos (prefeitura, câmara) divididos por pouca gente. Os números são os declarados pelas prefeituras ao Tesouro e podem ter erros de preenchimento.</p>';
      $$("button[data-m]", box).forEach(function (b) { b.addEventListener("click", function () { openCity(+b.dataset.m); scrollToEl($("#explorar")); }); });
    });
  }

  // ---------- fontes ----------
  function renderSources() {
    var dt = brDate((S.meta && S.meta.gerado) || "2026-10-08");
    var src = [
      ["Fronteiras dos estados e cidades", "IBGE — API de malhas v3", "https://servicodados.ibge.gov.br/api/docs/malhas?versao=3", "Malha atual"],
      ["Lista de cidades", "IBGE — API de localidades", "https://servicodados.ibge.gov.br/api/docs/localidades", int(S.base.municipios.length) + " municípios"],
      ["População", "IBGE/SIDRA — Censo 2022 (4709), estimativas (6579), censos 2000/2010 (202) e contagem 2007 (793)", "https://sidra.ibge.gov.br/tabela/6579", "2000–2025"],
      ["Governadores, prefeitos, vices e vereadores eleitos", "TSE — Portal de Dados Abertos, candidatos (consulta_cand)", "https://dadosabertos.tse.jus.br/dataset/?q=candidatos", "Governadores 1994–2026; prefeitos e vereadores 1996–2024"],
      ["Governador em exercício hoje", "Levantamento do G1 (setembro de 2026), arquivo ../data/ufs.json", (S.ufsAlex && S.ufsAlex.fonteGovernadores) || "https://g1.globo.com/", "Retrato de 2026"],
      ["Contas das prefeituras 1989–2012", "Tesouro Nacional — FINBRA (Finanças do Brasil)", "https://www.tesourotransparente.gov.br/publicacoes/finbra-dados-contabeis-dos-municipios-1989-a-2012", "1989–2012"],
      ["Contas de prefeituras e estados 2013 em diante", "Tesouro Nacional — SICONFI, Declaração de Contas Anuais (DCA), API aberta", "https://apidatalake.tesouro.gov.br/docs/siconfi/", "2013–" + lastDCAYear()],
      ["Correção pela inflação", "Banco Central — SGS série 433 (IPCA mensal)", "https://www3.bcb.gov.br/sgspub/", "1995 em diante"]
    ];
    var cov = (S.meta && S.meta.cobertura_municipios) || {};
    var covRows = Object.keys(cov).sort().reverse().map(function (y) {
      var c = cov[y]; return "<tr><td>" + y + '</td><td class="num">' + int(c.finbra + c.siconfi) + '</td><td class="num">' + int(c.sem_entrega) + "</td><td>" + (c.siconfi ? "SICONFI" : "FINBRA") + "</td></tr>";
    }).join("");
    $("#ft-body").innerHTML = '<div class="table-wrap"><table class="data-table"><thead><tr><th>O quê</th><th>Fonte oficial</th><th>Período</th></tr></thead><tbody>' +
      src.map(function (s) { return "<tr><td>" + esc(s[0]) + '</td><td><a href="' + esc(s[2]) + '" target="_blank" rel="noopener">' + esc(s[1]) + "</a></td><td>" + esc(s[3]) + "</td></tr>"; }).join("") +
      "</tbody></table></div>" +
      '<p class="note-sm">Dados baixados e processados em ' + dt + ' e atualizados automaticamente toda semana. Formatos e identificadores: <a href="../data/mapa/README.md">README dos dados</a>.</p>' +
      '<h3 class="mp-h3">Limites que você precisa saber</h3><ul class="note">' +
      "<li>Não existe base aberta e padronizada com as contas das prefeituras de 1988; a série começa em 1989 (FINBRA). As contas dos governos estaduais com dados abertos padronizados começam em 2013.</li>" +
      "<li>O TSE só publica candidatos a partir de 1994 (estados) e 1996 (cidades). Quem assumiu sem ter sido eleito titular (vice, interino) não aparece como titular.</li>" +
      "<li>Os valores são os que os próprios governos declararam ao Tesouro. Algumas prefeituras deixam de entregar contas em certos anos; esses anos aparecem como “sem dados”.</li>" +
      "<li>De 1989 a 1993 a moeda era outra e a inflação passava de 1.000% ao ano; esses anos só aparecem em valores da época. Entre 1989 e 1993 algumas cidades não foram encontradas nos arquivos históricos.</li>" +
      "<li>As contas de 2013 em diante das cidades do interior estão sendo copiadas do Tesouro aos poucos (limite de 1 consulta por segundo). Enquanto isso, ao abrir uma cidade, o site busca os anos que faltam direto na API do Tesouro.</li>" +
      "<li>Cores de partido no mapa só servem para separar partidos e não representam nenhuma opinião.</li></ul>" +
      '<details class="mp-more"><summary>Quantas prefeituras têm contas em cada ano</summary><div class="table-wrap"><table class="data-table"><thead><tr><th>Ano</th><th class="num">Com contas</th><th class="num">Sem entrega</th><th>Base</th></tr></thead><tbody>' + covRows + "</tbody></table></div></details>";
  }
})();
