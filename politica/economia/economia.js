/* politica/economia — crescimento do Brasil x outros países (dados em ../data/economia/) */
(function () {
  "use strict";
  var D = "../data/economia/";
  var LS = "eco-paises";
  var DEFAULT = ["WLD", "LCN", "MEX", "CHN"];
  var MAX_SEL = 6;
  var GRUPOS = [["grupo", "Médias"], ["vizinho", "América Latina"], ["emergente", "Outros emergentes"], ["rico", "Países ricos"]];
  var CURTO = { sarney: "José Sarney", collor: "Fernando Collor", itamar: "Itamar Franco", fhc: "Fernando Henrique (FHC)", lula12: "Lula", lula3: "Lula", dilma: "Dilma Rousseff", temer: "Michel Temer", bolsonaro: "Jair Bolsonaro" };
  var EVENTOS = {
    1981: "Crise da dívida externa na América Latina.",
    1983: "Crise da dívida externa na América Latina.",
    1986: "Plano Cruzado: congelamento de preços.",
    1990: "Plano Collor: bloqueio da poupança e das contas bancárias.",
    1994: "Plano Real: fim da hiperinflação.",
    1999: "Desvalorização do real depois de uma crise cambial.",
    2001: "Racionamento de energia (o “apagão”).",
    2009: "Crise financeira mundial, que começou nos Estados Unidos em 2008.",
    2015: "Recessão de 2015–2016.",
    2016: "Recessão de 2015–2016.",
    2020: "Pandemia de covid-19.",
    2021: "Retomada depois do pior momento da pandemia."
  };

  var P, B, R, F, NAMES = {}, GRP = {}, LAST, PROJ_TO, IBGE_FIM;
  var st = { sel: loadSel(), ano: null, pp: "nivel", ac: "total", ou: "infl" };

  // ---------- utilidades
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function nf(v, d) { if (d == null) d = 1; return v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/^-/, "−"); }
  function pct(v, d, sign) { if (v == null || isNaN(v)) return "—"; return (sign && v > 0 ? "+" : "") + nf(v, d == null ? 1 : d) + "%"; }
  function abs1(v) { return nf(Math.abs(v), 1) + "%"; }
  function usd(v) { return "US$ " + Math.round(v).toLocaleString("pt-BR"); }
  function mil(v) { return Math.abs(v) >= 1000 ? nf(v / 1000, v % 1000 === 0 ? 0 : 0) + " mil" : nf(v, 0); }
  function dataBR(iso) { if (!iso) return "—"; var p = iso.slice(0, 10).split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  function unpack(s) { var o = {}; if (!s) return o; s.v.forEach(function (v, i) { if (v != null) o[s.i + i] = v; }); return o; }
  function ser(id, k) { return unpack(P.series[id] && P.series[id][k]); }
  function maxKey(o) { var k = Object.keys(o).map(Number); return k.length ? Math.max.apply(null, k) : null; }
  function minKey(o) { var k = Object.keys(o).map(Number); return k.length ? Math.min.apply(null, k) : null; }
  function chain(vals, a, b) { // crescimento acumulado (%) de a (base) até b
    var f = 1;
    for (var y = a + 1; y <= b; y++) { if (vals[y] == null) return null; f *= 1 + vals[y] / 100; }
    return (f - 1) * 100;
  }
  function geo(vals, ys) { var f = 1, n = 0; ys.forEach(function (y) { if (vals[y] != null) { f *= 1 + vals[y] / 100; n++; } }); return n ? { media: (Math.pow(f, 1 / n) - 1) * 100, total: (f - 1) * 100, n: n } : null; }
  function range(a, b) { var r = []; for (var y = a; y <= b; y++) r.push(y); return r; }
  function color(id) { if (id === "BRA") return "var(--accent)"; var i = st.sel.indexOf(id); return "var(--c" + ((i < 0 ? 0 : i) + 1) + ")"; }
  function loadSel() {
    try { var s = JSON.parse(localStorage.getItem(LS)); if (Array.isArray(s) && s.length <= MAX_SEL) return s.filter(function (x) { return typeof x === "string" && x !== "BRA"; }); } catch (e) {}
    return DEFAULT.slice();
  }
  function saveSel() { try { localStorage.setItem(LS, JSON.stringify(st.sel)); } catch (e) {} }
  function selValid() { return st.sel.filter(function (id) { return NAMES[id]; }); }

  // crescimento: Brasil = série oficial (IBGE/BCB); outros = Banco Mundial; projeção = FMI
  function growth(id) {
    var vals = id === "BRA" ? unpack(B.pib) : ser(id, "cres");
    var last = maxKey(vals), proj = {}, fmi = ser(id, "cresFmi");
    if (last != null) for (var y = last + 1; y <= PROJ_TO; y++) if (fmi[y] != null) proj[y] = fmi[y];
    return { vals: vals, proj: proj };
  }

  // ---------- gráfico SVG
  function niceTicks(lo, hi, n) {
    var span = hi - lo || 1, raw = span / n, step = Math.pow(10, Math.floor(Math.log10(raw))), e = raw / step;
    if (e >= 7.5) step *= 10; else if (e >= 3.5) step *= 5; else if (e >= 1.5) step *= 2;
    var a = Math.floor(lo / step + 1e-9) * step, b = Math.ceil(hi / step - 1e-9) * step, arr = [];
    for (var v = a; v <= b + step / 2; v += step) arr.push(Math.round(v / step) * step);
    return { a: a, b: b, step: step, arr: arr };
  }
  function chart(el, cfg) {
    el._cfg = cfg;
    draw(el);
    if (!el._ro && "ResizeObserver" in window) {
      el._w = el.clientWidth;
      el._ro = new ResizeObserver(function () { if (Math.abs(el.clientWidth - el._w) > 4) { el._w = el.clientWidth; draw(el); } });
      el._ro.observe(el);
    }
    if (!el._bound) bind(el);
  }
  function valAt(s, y) { if (s.vals[y] != null) return { v: s.vals[y], p: false }; if (s.proj && s.proj[y] != null) return { v: s.proj[y], p: true }; return null; }
  function draw(el) {
    var c = el._cfg, W = Math.max(260, Math.round(el.clientWidth || 600));
    var small = el.classList.contains("eco-chart-sm");
    var H = small ? (W < 480 ? 200 : 230) : (W < 480 ? 250 : W < 820 ? 290 : 340);
    var years = range(c.y0, c.y1);
    var all = [];
    c.series.forEach(function (s) { years.forEach(function (y) { var q = valAt(s, y); if (q) all.push(c.cap != null ? Math.min(q.v, c.cap) : q.v); }); });
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "group");
    el.setAttribute("aria-label", c.label + ". Use as setas do teclado para ver cada ano.");
    if (!all.length) { el.innerHTML = '<div class="eco-empty">Sem dados para esta escolha de países e período.</div>'; el._geo = null; return; }
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    if (c.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    if (c.yMin != null) lo = Math.min(lo, c.yMin);
    if (c.yMax != null) hi = Math.max(hi, c.yMax);
    var pad = (hi - lo) * 0.06 || 1, padHi = c.yMax != null && hi <= c.yMax ? 0 : pad;
    var t = niceTicks(lo - (c.zero && lo === 0 ? 0 : pad), hi + padHi, H < 260 ? 4 : 5);
    if (c.zero && lo >= 0) t = niceTicks(0, hi + padHi, H < 260 ? 4 : 5);
    var tf = c.tick || function (v) { return nf(v, t.step < 1 ? 1 : 0); };
    var maxLbl = Math.max.apply(null, t.arr.map(function (v) { return tf(v).length; }));
    var m = { l: Math.max(30, maxLbl * 6.6 + 12), r: 10, t: 14, b: 26 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b, band = iw / years.length;
    function X(y) { return m.l + (y - c.y0 + 0.5) * band; }
    function Y(v) { return m.t + ih - (v - t.a) / (t.b - t.a) * ih; }
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" aria-hidden="true" focusable="false">';
    s += '<g class="ax">';
    t.arr.forEach(function (v) { s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"' + (v === 0 ? ' class="zero"' : "") + "/>" + '<text x="' + (m.l - 6) + '" y="' + (Y(v) + 3.5).toFixed(1) + '" text-anchor="end">' + esc(tf(v)) + "</text>"; });
    var need = Math.ceil(years.length / Math.max(1, Math.floor(iw / 40)));
    var step = [1, 2, 5, 10, 20, 25, 50].filter(function (k) { return k >= need; })[0] || 50;
    years.forEach(function (y) {
      if (y % step !== 0) return;
      var x = X(y), an = x + 16 > W ? "end" : x - 16 < m.l - 8 ? "start" : "middle";
      s += '<text x="' + Math.min(x, W - 1).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="' + an + '">' + y + "</text>";
    });
    s += "</g>";
    if (c.projFrom != null && c.projFrom <= c.y1) {
      var px = X(c.projFrom) - band / 2;
      s += '<rect class="proj-zone" x="' + px.toFixed(1) + '" y="' + m.t + '" width="' + (W - m.r - px).toFixed(1) + '" height="' + ih + '"/>';
      s += '<text class="proj-lbl" x="' + (W - m.r - 3) + '" y="' + (m.t + 10) + '" text-anchor="end">projeção</text>';
    }
    var bars = c.series.filter(function (x) { return x.type === "bar"; });
    var bw = Math.max(1.2, band * (band > 8 ? 0.72 : 0.8));
    bars.forEach(function (b) {
      years.forEach(function (y) {
        var q = valAt(b, y); if (!q) return;
        var v = c.cap != null ? Math.min(q.v, c.cap) : q.v;
        var y0 = Y(0), y1 = Y(v), top = Math.min(y0, y1), h = Math.max(1, Math.abs(y1 - y0));
        s += '<rect class="' + (q.v < 0 ? "bar-neg" : "bar-pos") + (q.p ? " bar-proj" : "") + (c.sel === y ? " bar-sel" : "") + '" x="' + (X(y) - bw / 2).toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="' + (bw > 6 ? 2 : 0) + '"/>';
      });
    });
    c.series.filter(function (x) { return x.type !== "bar"; }).slice().reverse().forEach(function (L) {
      var segs = [], cur = null, proj = [], lastPt = null, dots = [];
      years.forEach(function (y) {
        var q = valAt(L, y);
        if (!q) { if (cur) segs.push(cur); cur = null; return; }
        var v = c.cap != null ? Math.min(q.v, c.cap) : q.v, pt = [X(y), Y(v)];
        if (c.cap != null && q.v > c.cap) dots.push(["cap", pt]);
        if (q.p) { if (!proj.length && lastPt) proj.push(lastPt); proj.push(pt); if (cur) { segs.push(cur); cur = null; } }
        else { (cur = cur || []).push(pt); lastPt = pt; }
      });
      if (cur) segs.push(cur);
      var cls = "ln" + (L.id === "BRA" ? " ln-br" : "");
      segs.forEach(function (sg) {
        if (sg.length === 1) { s += '<circle cx="' + sg[0][0].toFixed(1) + '" cy="' + sg[0][1].toFixed(1) + '" r="' + (L.id === "BRA" ? 3.6 : 3) + '" fill="' + L.color + '"/>'; return; }
        s += '<path class="' + cls + '" stroke="' + L.color + '" d="M' + sg.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join("L") + '"/>';
      });
      if (proj.length > 1) s += '<path class="ln ln-proj" stroke="' + L.color + '" d="M' + proj.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join("L") + '"/>';
      dots.forEach(function (d) { var p = d[1]; s += '<path class="cap-mk" fill="' + L.color + '" d="M' + (p[0] - 5).toFixed(1) + "," + (p[1] + 1).toFixed(1) + "L" + p[0].toFixed(1) + "," + (p[1] - 7).toFixed(1) + "L" + (p[0] + 5).toFixed(1) + "," + (p[1] + 1).toFixed(1) + 'Z"/>'; });
    });
    s += '<line class="guide" x1="0" x2="0" y1="' + m.t + '" y2="' + (m.t + ih) + '" visibility="hidden"/>';
    s += "</svg>";
    el.innerHTML = s + '<div class="eco-tip" hidden></div>';
    el._geo = { W: W, m: m, band: band, X: X, years: years };
    if (el._cur != null && years.indexOf(el._cur) >= 0 && el._tipOn) showTip(el, el._cur);
  }
  function yearFromX(el, clientX) {
    var g = el._geo; if (!g) return null;
    var r = el.getBoundingClientRect(), x = (clientX - r.left) * (g.W / r.width);
    var i = Math.floor((x - g.m.l) / g.band);
    i = Math.max(0, Math.min(g.years.length - 1, i));
    return g.years[i];
  }
  function showTip(el, y) {
    var g = el._geo, c = el._cfg; if (!g) return;
    var tip = $(".eco-tip", el), guide = $(".guide", el);
    var rows = [], anyProj = false, capped = false;
    c.series.forEach(function (s) {
      var q = valAt(s, y); if (!q) return;
      if (q.p) anyProj = true;
      if (c.cap != null && q.v > c.cap) capped = true;
      rows.push({ s: s, v: q.v, p: q.p });
    });
    rows.sort(function (a, b) { return b.v - a.v; });
    var h = "<b>" + y + (anyProj ? " · projeção" : "") + "</b>";
    if (!rows.length) h += '<small>Sem dado neste ano.</small>';
    rows.forEach(function (r) { h += '<div><span><i style="background:' + r.s.color + '"></i>' + esc(r.s.label) + "</span><em>" + esc((c.fmtTip || c.fmt)(r.v, r.s, y)) + "</em></div>"; });
    if (c.tipExtra) { var ex = c.tipExtra(y); if (ex) h += "<small>" + esc(ex) + "</small>"; }
    if (capped) h += "<small>▲ valor acima da escala do gráfico.</small>";
    if (anyProj) h += "<small>Projeção do FMI: é previsão e pode mudar.</small>";
    tip.innerHTML = h; tip.hidden = false;
    var r = el.getBoundingClientRect(), sc = r.width / g.W, x = g.X(y) * sc;
    var tw = tip.offsetWidth, left = x + 12;
    if (left + tw > r.width - 6) left = x - tw - 12;
    tip.style.left = Math.max(6, left) + "px";
    guide.setAttribute("x1", g.X(y)); guide.setAttribute("x2", g.X(y)); guide.setAttribute("visibility", "visible");
    el._cur = y; el._tipOn = true;
  }
  function hideTip(el) { var tip = $(".eco-tip", el), g = $(".guide", el); if (tip) tip.hidden = true; if (g) g.setAttribute("visibility", "hidden"); el._tipOn = false; }
  function bind(el) {
    el._bound = true;
    el.addEventListener("pointermove", function (e) { if (e.pointerType !== "mouse") return; var y = yearFromX(el, e.clientX); if (y != null) showTip(el, y); });
    el.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") hideTip(el); });
    el.addEventListener("click", function (e) { var y = yearFromX(el, e.clientX); if (y == null) return; showTip(el, y); if (el._cfg.onYear) el._cfg.onYear(y); });
    el.addEventListener("keydown", function (e) {
      var g = el._geo; if (!g) return;
      var i = g.years.indexOf(el._cur), n = g.years.length;
      if (i < 0) i = n - 1;
      if (e.key === "ArrowLeft") i = Math.max(0, i - 1); else if (e.key === "ArrowRight") i = Math.min(n - 1, i + 1);
      else if (e.key === "Home") i = 0; else if (e.key === "End") i = n - 1; else if (e.key === "Escape") { hideTip(el); return; } else return;
      e.preventDefault(); showTip(el, g.years[i]); if (el._cfg.onYear) el._cfg.onYear(g.years[i]);
    });
    el.addEventListener("blur", function () { hideTip(el); });
    document.addEventListener("pointerdown", function (e) { if (!el.contains(e.target)) hideTip(el); });
  }
  function legend(el, series, extra) {
    el.innerHTML = series.map(function (s) { return '<span><i class="' + (s.type === "bar" ? "sq" : "") + '" style="background:' + s.color + '"></i>' + esc(s.label) + "</span>"; }).join("") + (extra || "");
  }
  var projLegend = '<span><i class="dash"></i>projeção do FMI</span>';

  // ---------- seletor de países
  function renderPicker() {
    var h = '<div class="eco-pk-grp"><button class="eco-chip is-br" type="button" aria-pressed="true" disabled><i></i>Brasil (sempre)</button></div>';
    GRUPOS.forEach(function (g) {
      var ps = P.paises.filter(function (p) { return p.grupo === g[0]; });
      h += '<div class="eco-pk-grp" role="group" aria-label="' + esc(g[1]) + '"><span>' + esc(g[1]) + "</span>";
      ps.forEach(function (p) { h += '<button class="eco-chip" type="button" data-id="' + p.id + '" aria-pressed="false"><i></i>' + esc(p.nome) + "</button>"; });
      h += "</div>";
    });
    $("#pk-groups").innerHTML = h;
    $$("#pk-groups .eco-chip[data-id]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-id"), i = st.sel.indexOf(id);
        if (i >= 0) st.sel.splice(i, 1); else if (st.sel.length < MAX_SEL) st.sel.push(id);
        saveSel(); syncPicker(); renderSel();
      });
    });
    $("#pk-reset").addEventListener("click", function () { st.sel = DEFAULT.slice(); saveSel(); syncPicker(); renderSel(); });
    syncPicker();
  }
  function syncPicker() {
    var full = st.sel.length >= MAX_SEL;
    $$("#pk-groups .eco-chip[data-id]").forEach(function (b) {
      var id = b.getAttribute("data-id"), on = st.sel.indexOf(id) >= 0;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.style.setProperty("--sw", on ? color(id) : "");
      b.disabled = !on && full;
      b.title = !on && full ? "Máximo de " + MAX_SEL + " comparações: desmarque um país primeiro" : "";
    });
    $("#pk-count").textContent = "(" + st.sel.length + " de " + MAX_SEL + ")";
    var txt = st.sel.length ? st.sel.map(function (id) { return "<b>" + esc(NAMES[id]) + "</b>"; }).join(", ") : "nenhum país (só o Brasil)";
    $$(".eco-comp-list").forEach(function (e) { e.innerHTML = txt; });
  }
  function renderSel() { renderCres(); renderPP(); renderAc(); renderOu(); }

  // ---------- veredito de um ano
  function verbo(v) { return v >= 0 ? "cresceu " + abs1(v) : "encolheu " + abs1(v); }
  function veredito(b, w) {
    var d = b - w;
    if (Math.abs(d) < 0.5) return { k: "igual", t: b < 0 && w < 0 ? "caiu parecido com o resto do mundo" : "praticamente igual à média do mundo" };
    if (b >= 0 && w >= 0) return d > 0 ? { k: "mais", t: "cresceu mais que a média do mundo" } : { k: "menos", t: "cresceu menos que a média do mundo" };
    if (b < 0 && w >= 0) return { k: "menos", t: "encolheu enquanto o mundo cresceu" };
    if (b >= 0 && w < 0) return { k: "mais", t: "cresceu enquanto o mundo encolheu" };
    return d > 0 ? { k: "mais", t: "caiu menos que o mundo" } : { k: "menos", t: "caiu mais que o mundo" };
  }
  function frase(y) {
    var br = growth("BRA"), wd = growth("WLD");
    var b = br.vals[y], w = wd.vals[y];
    if (b == null && br.proj[y] != null) {
      var t = "Para " + y + ", a projeção do FMI é de o Brasil " + (br.proj[y] >= 0 ? "crescer " : "encolher ") + abs1(br.proj[y]);
      if (wd.proj[y] != null) t += " e o mundo " + (wd.proj[y] >= 0 ? "crescer " : "encolher ") + abs1(wd.proj[y]);
      return t + ". É uma previsão e pode mudar.";
    }
    if (b == null) return "Sem dado oficial do Brasil para " + y + ".";
    var s = "Em " + y + " o Brasil " + verbo(b);
    if (w != null) s += " e o mundo " + (w >= 0 ? "cresceu " : "encolheu ") + abs1(w) + ": " + veredito(b, w).t + ".";
    else s += ".";
    if (EVENTOS[y]) s += " " + EVENTOS[y];
    var outros = selValid().filter(function (id) { return id !== "WLD"; }).map(function (id) { return [id, growth(id).vals[y]]; }).filter(function (x) { return x[1] != null; });
    if (outros.length >= 2) {
      outros.sort(function (a, c) { return c[1] - a[1]; });
      s += "|Entre os escolhidos, quem mais cresceu foi " + NAMES[outros[0][0]] + " (" + pct(outros[0][1], 1, true) + ") e quem menos cresceu foi " + NAMES[outros[outros.length - 1][0]] + " (" + pct(outros[outros.length - 1][1], 1, true) + ").";
    }
    return s;
  }
  function showYear(y, fromChart) {
    st.ano = y;
    var f = frase(y).split("|");
    $("#ano-detalhe").innerHTML = esc(f[0]) + (f[1] ? "<small>" + esc(f[1]) + "</small>" : "");
    $$("#faixa button").forEach(function (b) { b.setAttribute("aria-pressed", +b.getAttribute("data-y") === y ? "true" : "false"); });
    var el = $("#ch-cres");
    if (el._cfg) { el._cfg.sel = y; var on = el._tipOn; draw(el); if (fromChart || on) showTip(el, y); }
  }

  // ---------- Ano a ano
  function renderCres() {
    var from = +$("#ano-de").value, projOn = $("#ano-proj").checked;
    var y1 = projOn ? PROJ_TO : LAST;
    var br = growth("BRA");
    var series = [{ id: "BRA", label: "Brasil", color: "var(--accent)", type: "bar", vals: br.vals, proj: projOn ? br.proj : {} }];
    selValid().forEach(function (id) { var g = growth(id); series.push({ id: id, label: NAMES[id], color: color(id), type: "line", vals: g.vals, proj: projOn ? g.proj : {} }); });
    var el = $("#ch-cres");
    chart(el, {
      y0: from, y1: y1, series: series, zero: true, projFrom: projOn ? LAST + 1 : null, sel: st.ano,
      label: "Crescimento anual do PIB, em %, de " + from + " a " + y1 + ": Brasil e países escolhidos",
      fmt: function (v) { return pct(v, 1, true); }, tick: function (v) { return nf(v, 0) + "%"; },
      onYear: function (y) { showYear(y, true); }
    });
    legend($("#lg-cres"), series, projOn ? projLegend : "");
    if (st.ano == null || st.ano < from || st.ano > y1) st.ano = LAST;
    // faixa
    var wd = growth("WLD").vals, cont = { mais: 0, menos: 0, igual: 0 }, fh = "";
    range(Math.max(from, minKey(br.vals)), LAST).forEach(function (y) {
      var b = br.vals[y], w = wd[y]; if (b == null || w == null) return;
      var v = veredito(b, w); cont[v.k]++;
      fh += '<button type="button" class="' + v.k + '" data-y="' + y + '" aria-pressed="false" aria-label="' + y + ": Brasil " + esc(pct(b, 1, true)) + ", mundo " + esc(pct(w, 1, true)) + " — " + esc(v.t) + '">' + "'" + String(y).slice(2) + "<small>" + esc(pct(b - w, 1, true).replace("%", "")) + "</small></button>";
    });
    $("#faixa").innerHTML = fh;
    $$("#faixa button").forEach(function (b) { b.addEventListener("click", function () { showYear(+b.getAttribute("data-y")); }); });
    var tot = cont.mais + cont.menos + cont.igual;
    $("#faixa-conta").textContent = tot ? "De " + Math.max(from, minKey(br.vals)) + " a " + LAST + " (" + tot + " anos): o Brasil cresceu mais que o mundo em " + cont.mais + ", praticamente igual em " + cont.igual + " e menos em " + cont.menos + ". O número pequeno embaixo de cada ano é a diferença em pontos percentuais." : "";
    showYear(st.ano);
    renderPlacar(from);
    renderTabCres(from, y1, series, projOn);
  }
  function renderPlacar(from) {
    var ids = ["BRA"].concat(selValid());
    var h = '<thead><tr><th scope="col">País ou grupo</th><th scope="col" class="num">Crescimento médio por ano</th><th scope="col" class="num">Por pessoa, por ano</th><th scope="col" class="num">Total no período</th><th scope="col" class="num">Anos de queda</th><th scope="col">Melhor e pior ano</th></tr></thead><tbody>';
    ids.forEach(function (id) {
      var g = growth(id).vals, pc = id === "BRA" ? ser("BRA", "cresPc") : ser(id, "cresPc");
      var ys = range(from, LAST).filter(function (y) { return g[y] != null; });
      if (!ys.length) { h += '<tr><th scope="row">' + esc(NAMES[id]) + '</th><td colspan="5">Sem dados neste período.</td></tr>'; return; }
      var a = geo(g, ys), p = geo(pc, ys.filter(function (y) { return pc[y] != null; }));
      var quedas = ys.filter(function (y) { return g[y] < 0; }).length;
      var best = ys.reduce(function (m, y) { return g[y] > g[m] ? y : m; }, ys[0]), worst = ys.reduce(function (m, y) { return g[y] < g[m] ? y : m; }, ys[0]);
      var parcial = ys[0] > from ? ' <span class="muted">(dados desde ' + ys[0] + ")</span>" : "";
      h += '<tr><th scope="row"><span style="color:' + color(id) + '">●</span> ' + esc(NAMES[id]) + parcial + "</th>" +
        '<td class="num"><b>' + pct(a.media, 1) + "</b></td>" +
        '<td class="num">' + (p ? pct(p.media, 1) : "—") + "</td>" +
        '<td class="num">' + pct(a.total, 0, true) + "</td>" +
        '<td class="num">' + quedas + " de " + ys.length + "</td>" +
        '<td class="tc-fim">Melhor: ' + best + " (" + pct(g[best], 1, true) + "). Pior: " + worst + " (" + pct(g[worst], 1, true) + ").</td></tr>";
    });
    $("#placar").innerHTML = '<caption class="sr-only">Crescimento médio por ano de ' + from + " a " + LAST + "</caption>" + h + "</tbody>";
  }
  function renderTabCres(from, y1, series, projOn) {
    var wd = growth("WLD").vals;
    var h = '<caption>Crescimento real do PIB, % ao ano. Em itálico: projeção do FMI.</caption><thead><tr><th scope="col">Ano</th>' + series.map(function (s) { return '<th scope="col" class="num">' + esc(s.label) + "</th>"; }).join("") + '<th scope="col">Brasil x mundo</th></tr></thead><tbody>';
    range(from, y1).reverse().forEach(function (y) {
      var tds = series.map(function (s) { var q = valAt(s, y); return '<td class="num' + (q && q.p ? " proj" : "") + (q && q.v < 0 ? " neg" : "") + '">' + (q ? pct(q.v, 1, true) : "—") + "</td>"; }).join("");
      var b = series[0].vals[y], w = wd[y], v = b != null && w != null ? veredito(b, w) : null;
      h += '<tr><th scope="row">' + y + "</th>" + tds + "<td>" + (v ? '<span class="eco-tag ' + v.k + '">' + esc(v.t) + "</span>" : (y > LAST ? '<span class="proj">projeção</span>' : "—")) + "</td></tr>";
    });
    $("#tb-cres").innerHTML = h + "</tbody>";
  }

  // ---------- Por pessoa
  function renderPP() {
    var ids = ["BRA"].concat(selValid()), el = $("#ch-pp"), ex = $("#pp-explica");
    if (st.pp === "nivel") {
      var series = ids.map(function (id) { return { id: id, label: NAMES[id], color: color(id), type: "line", vals: ser(id, "pcPpc"), proj: {} }; });
      var y0 = 1990;
      chart(el, {
        y0: y0, y1: LAST, series: series, zero: true,
        label: "PIB por pessoa já ajustado pelos preços (PPC), dólares de 2021, de 1990 a " + LAST,
        fmt: function (v) { return usd(v); }, tick: function (v) { return v >= 1000 ? nf(v / 1000, 0) + " mil" : nf(v, 0); }
      });
      legend($("#lg-pp"), series, '<span class="muted">Valores por pessoa, já ajustados pelos preços de cada país (PPC), em dólares de 2021.</span>');
      var b = series[0].vals, w = ser("WLD", "pcPpc"), yl = maxKey(b);
      var t = "Em <b>" + yl + "</b>, cada brasileiro produziu em média o equivalente a <b>" + usd(b[yl]) + "</b> no ano (já ajustado pelos preços de cada país). ";
      if (b[y0] != null) t += "Em " + y0 + " eram " + usd(b[y0]) + ": alta de <b>" + pct((b[yl] / b[y0] - 1) * 100, 0) + "</b> descontada a inflação. ";
      if (w[yl] != null && w[y0] != null) t += "Na média do mundo, a alta foi de <b>" + pct((w[yl] / w[y0] - 1) * 100, 0) + "</b> (de " + usd(w[y0]) + " para " + usd(w[yl]) + "). ";
      if (w[yl] != null) t += "Hoje o brasileiro médio produz " + (b[yl] >= w[yl] ? "<b>" + pct((b[yl] / w[yl] - 1) * 100, 0) + " a mais</b> que" : "<b>" + pct((1 - b[yl] / w[yl]) * 100, 0) + " a menos</b> que") + " a média mundial.";
      ex.innerHTML = t + ' <span class="muted">É uma média: não mostra como a renda é dividida (veja Desigualdade, mais abaixo).</span>';
    } else {
      var from = +$("#ano-de").value;
      var s2 = ids.map(function (id, i) { return { id: id, label: NAMES[id], color: color(id), type: i === 0 ? "bar" : "line", vals: ser(id, "cresPc"), proj: {} }; });
      chart(el, {
        y0: from, y1: LAST, series: s2, zero: true,
        label: "Crescimento do PIB por pessoa, % ao ano, de " + from + " a " + LAST,
        fmt: function (v) { return pct(v, 1, true); }, tick: function (v) { return nf(v, 0) + "%"; }
      });
      legend($("#lg-pp"), s2);
      var bp = s2[0].vals, ys = range(from, LAST).filter(function (y) { return bp[y] != null; });
      var neg = ys.filter(function (y) { return bp[y] < 0; }), g = geo(bp, ys), gw = geo(ser("WLD", "cresPc"), ys);
      ex.innerHTML = "De " + from + " a " + LAST + ", o PIB por pessoa do Brasil cresceu em média <b>" + pct(g.media, 1) + " por ano</b>" + (gw ? " (mundo: " + pct(gw.media, 1) + ")" : "") + ". Em <b>" + neg.length + " de " + ys.length + " anos</b> ele caiu, ou seja, a economia cresceu menos que a população ou encolheu" + (neg.length ? " (" + neg.join(", ") + ")" : "") + ".";
    }
  }

  // ---------- Acumulado
  function renderAc() {
    var base = +$("#ac-base").value, key = st.ac === "pc" ? "pcKd" : "pibKd";
    var ids = ["BRA"].concat(selValid()), sem = [];
    var series = ids.map(function (id) {
      var v = ser(id, key), o = {};
      if (v[base] == null) sem.push(NAMES[id]);
      else Object.keys(v).forEach(function (y) { y = +y; if (y >= base) o[y] = v[y] / v[base] * 100; });
      return { id: id, label: NAMES[id], color: color(id), type: "line", vals: o, proj: {} };
    });
    chart($("#ch-ac"), {
      y0: base, y1: LAST, series: series, zero: false, yMin: 100,
      label: (st.ac === "pc" ? "PIB por pessoa" : "PIB") + " acumulado, " + base + " = 100, até " + LAST,
      fmt: function (v) { return nf(v, 0) + " (" + pct(v - 100, 0, true) + ")"; }, tick: function (v) { return nf(v, 0); }
    });
    legend($("#lg-ac"), series, '<span class="muted">' + base + " = 100</span>");
    var b = series[0].vals[LAST], w = (series.filter(function (s) { return s.id === "WLD"; })[0] || {}).vals;
    var wv = w ? w[LAST] : null;
    if (wv == null) { var wk = ser("WLD", key); if (wk[base] && wk[LAST]) wv = wk[LAST] / wk[base] * 100; }
    var what = st.ac === "pc" ? "o PIB por pessoa do Brasil" : "a economia do Brasil";
    var t = "De " + base + " a " + LAST + ", " + what + " cresceu <b>" + pct(b - 100, 0) + "</b>" + (b >= 200 ? " (ficou " + nf(b / 100, 1) + " vezes maior)" : "") + ". ";
    if (wv != null) t += "A média do mundo cresceu <b>" + pct(wv - 100, 0) + "</b>. ";
    var others = series.slice(1).filter(function (s) { return s.vals[LAST] != null && s.id !== "WLD"; }).sort(function (a, c) { return c.vals[LAST] - a.vals[LAST]; });
    if (others.length) {
      var acima = others.filter(function (s) { return s.vals[LAST] > b; }).map(function (s) { return s.label; });
      t += acima.length ? "Dos escolhidos, cresceram mais que o Brasil: " + acima.join(", ") + "." : "Nenhum dos escolhidos cresceu mais que o Brasil nesse período.";
    }
    if (sem.length) t += ' <span class="muted">Sem dado em ' + base + ": " + sem.join(", ") + ".</span>";
    t += ' <span class="muted">Fonte: Banco Mundial (PIB a preços constantes).</span>';
    $("#ac-explica").innerHTML = t;
  }

  // ---------- Lugar no mundo
  function renderMundo() {
    var fatia = ser("BRA", "fatia"), act = {}, proj = {};
    Object.keys(fatia).forEach(function (y) { y = +y; if (y <= LAST) act[y] = fatia[y]; else if (y <= PROJ_TO) proj[y] = fatia[y]; });
    var y0 = minKey(act);
    if (y0 != null) {
      chart($("#ch-fatia"), {
        y0: y0, y1: maxKey(proj) || LAST, series: [{ id: "BRA", label: "Brasil", color: "var(--accent)", type: "line", vals: act, proj: proj }],
        zero: true, projFrom: maxKey(proj) ? LAST + 1 : null,
        label: "Fatia do Brasil em tudo o que o mundo produz (ajustado por preços), %, de " + y0 + " a " + LAST,
        fmt: function (v) { return pct(v, 2); }, tick: function (v) { return nf(v, t1(v)) + "%"; }
      });
      var cn = ser("CHN", "fatia"), us = ser("USA", "fatia");
      var t = "Em <b>" + y0 + "</b> o Brasil era <b>" + pct(act[y0], 1) + "</b> da economia mundial; em 1988, " + pct(act[1988], 1) + "; em <b>" + LAST + "</b>, <b>" + pct(act[LAST], 1) + "</b>. ";
      t += act[LAST] < act[1988] ? "A fatia diminuiu porque outros países cresceram mais rápido — não quer dizer que a economia brasileira encolheu. " : "A fatia aumentou: o Brasil cresceu mais rápido que a média. ";
      if (cn[y0] != null && cn[LAST] != null) t += "No mesmo período, a fatia da China foi de " + pct(cn[y0], 1) + " para " + pct(cn[LAST], 1) + (us[LAST] != null ? " e a dos EUA, de " + pct(us[y0], 1) + " para " + pct(us[LAST], 1) : "") + ".";
      $("#fatia-explica").innerHTML = t;
    }
    var rk = R.pcPpc || [], o = {}, info = {};
    rk.forEach(function (r) { o[r[0]] = r[3]; info[r[0]] = r; });
    if (rk.length) {
      chart($("#ch-rank"), {
        y0: rk[0][0], y1: rk[rk.length - 1][0], series: [{ id: "BRA", label: "Brasil", color: "var(--accent)", type: "line", vals: o, proj: {} }],
        zero: true, yMax: 100,
        label: "Percentual de países com PIB por pessoa menor que o do Brasil",
        fmt: function (v) { return pct(v, 0) + " dos países atrás"; }, tick: function (v) { return nf(v, 0) + "%"; },
        tipExtra: function (y) { var r = info[y]; return r ? r[1] + "º lugar entre " + r[2] + " países com dado" : ""; }
      });
      var a = rk[0], z = rk[rk.length - 1];
      $("#rank-explica").innerHTML = "Em <b>" + a[0] + "</b> o Brasil era o <b>" + a[1] + "º</b> em PIB por pessoa (já ajustado) entre " + a[2] + " países, à frente de " + pct(a[3], 0) + " deles. Em <b>" + z[0] + "</b>, o <b>" + z[1] + "º</b> entre " + z[2] + ", à frente de " + pct(z[3], 0) + ". O número de países com dado muda de ano para ano, por isso vale olhar o percentual.";
    }
    var cr = {}; (R.cres || []).forEach(function (r) { cr[r[0]] = r; });
    var h = '<caption>Posição do Brasil entre os países com dado no Banco Mundial (1º = maior valor).</caption><thead><tr><th scope="col">Ano</th><th scope="col" class="num">PIB por pessoa (ajustado)</th><th scope="col" class="num">À frente de</th><th scope="col" class="num">Crescimento do PIB</th><th scope="col" class="num">À frente de</th></tr></thead><tbody>';
    var ys = Object.keys(info).concat(Object.keys(cr)).map(Number).filter(function (v, i, a) { return a.indexOf(v) === i && v >= 1988; }).sort(function (a, b) { return b - a; });
    ys.forEach(function (y) {
      var p = info[y], c = cr[y];
      h += '<tr><th scope="row">' + y + '</th><td class="num">' + (p ? p[1] + "º de " + p[2] : "—") + '</td><td class="num">' + (p ? pct(p[3], 0) + " dos países" : "—") + '</td><td class="num">' + (c ? c[1] + "º de " + c[2] : "—") + '</td><td class="num">' + (c ? pct(c[3], 0) + " dos países" : "—") + "</td></tr>";
    });
    $("#tb-rank").innerHTML = h + "</tbody>";
  }
  function t1(v) { return Math.abs(v - Math.round(v)) > 0.01 ? 1 : 0; }

  // ---------- Por presidente
  function nomeMandato(m) {
    var n = CURTO[m.pres] || m.nome;
    var ord = m.pres === "lula3" ? "3º mandato" : m.mandato ? m.mandato + "º mandato" : "";
    if (m.pres === "dilma" && m.mandato === 2) ord = "2º mandato, até maio de 2016";
    if (m.emAndamento) ord = (ord ? ord + ", " : "") + "em andamento";
    return { n: n, ord: ord };
  }
  function renderPres() {
    var ms = B.mandatos || [];
    var maxAbs = 0;
    ms.forEach(function (m) { [m.media, m.mundo].forEach(function (v) { if (v != null) maxAbs = Math.max(maxAbs, Math.abs(v)); }); });
    var lo = Math.min(0, Math.min.apply(null, ms.map(function (m) { return Math.min(m.media, m.mundo == null ? 0 : m.mundo); })));
    var hi = Math.max.apply(null, ms.map(function (m) { return Math.max(m.media, m.mundo == null ? 0 : m.mundo); }));
    var span = hi - lo || 1, z = (-lo / span) * 100;
    function bar(v, col) {
      if (v == null) return '<div class="eco-pm-bar"></div>';
      var w = Math.abs(v) / span * 100, left = v >= 0 ? z : z - w;
      var lab = v >= 0 ? "left:calc(" + (left + w) + "% + 4px)" : "right:calc(" + (100 - left) + "% + 4px)";
      return '<div class="eco-pm-bar"><span style="left:' + left.toFixed(2) + "%;width:" + Math.max(w, 0.4).toFixed(2) + "%;background:" + col + '"></span><em style="' + lab + '">' + pct(v, 1, true) + "</em></div>";
    }
    var bh = '<div class="eco-pm-key"><span><i style="background:var(--accent)"></i>Brasil, média por ano</span><span><i style="background:var(--c1)"></i>Mundo nos mesmos anos</span></div>';
    ms.forEach(function (m) {
      var nm = nomeMandato(m), ys = m.anosComDado;
      bh += '<div class="eco-pm-row"><b>' + esc(nm.n) + "<small>" + ys[0] + (ys.length > 1 ? "–" + ys[ys.length - 1] : "") + (nm.ord ? " · " + esc(nm.ord) : "") + '</small></b><div class="eco-pm-bars"><span class="eco-pm-zero" style="left:' + z.toFixed(2) + '%"></span>' + bar(m.media, "var(--accent)") + bar(m.mundo, "var(--c1)") + "</div></div>";
    });
    $("#pm-barras").innerHTML = bh;
    var h = '<thead><tr><th scope="col">Presidente</th><th scope="col">Anos contados</th><th scope="col" class="num">Brasil: média por ano</th><th scope="col" class="num">Por pessoa, por ano</th><th scope="col" class="num">Total no mandato</th><th scope="col" class="num">Mundo: média por ano</th><th scope="col" class="num">América Latina</th><th scope="col">Comparado ao mundo</th><th scope="col">Melhor e pior ano</th></tr></thead><tbody>';
    ms.forEach(function (m) {
      var nm = nomeMandato(m), ys = m.anosComDado, v = m.mundo != null ? veredito(m.media, m.mundo) : null;
      var vt = v ? (v.k === "igual" ? "parecido com o mundo" : v.k === "mais" ? "acima do mundo" : "abaixo do mundo") : "—";
      h += '<tr><th scope="row">' + esc(nm.n) + (nm.ord ? ' <span class="muted">(' + esc(nm.ord) + ")</span>" : "") + "</th>" +
        "<td>" + ys[0] + (ys.length > 1 ? "–" + ys[ys.length - 1] : "") + " (" + ys.length + (ys.length > 1 ? " anos" : " ano") + ")</td>" +
        '<td class="num' + (m.media < 0 ? " neg" : "") + '"><b>' + pct(m.media, 1, true) + "</b></td>" +
        '<td class="num">' + pct(m.mediaPc, 1, true) + "</td>" +
        '<td class="num">' + pct(m.acum, 1, true) + "</td>" +
        '<td class="num">' + pct(m.mundo, 1, true) + "</td>" +
        '<td class="num">' + pct(m.amlat, 1, true) + "</td>" +
        "<td>" + (v ? '<span class="eco-tag ' + v.k + '">' + vt + "</span>" : "—") + "</td>" +
        '<td class="tc-fim">Melhor: ' + m.anoMelhor + " (" + pct(B_pib()[m.anoMelhor], 1, true) + "). Pior: " + m.anoPior + " (" + pct(B_pib()[m.anoPior], 1, true) + ")." + (EVENTOS[m.anoPior] ? " " + esc(EVENTOS[m.anoPior]) : "") + (m.emAndamento ? " Mandato em andamento: só entram os anos que já têm número oficial." : "") + "</td></tr>";
    });
    $("#tb-pres").innerHTML = '<caption class="sr-only">Crescimento médio por mandato presidencial</caption>' + h + "</tbody>";
    var div = (B.anosDivididos || []).map(function (d) { return d.ano + " (" + d.dias.map(function (x) { return x[0] + ": " + x[1] + " dias"; }).join("; ") + ")"; });
    $("#pr-nota").innerHTML = "Como contamos: " + esc(B.regra || "") + (div.length ? " Anos divididos: " + esc(div.join(" · ")) + "." : "") + " “Média por ano” é a taxa composta: crescendo esse tanto todo ano, chega-se ao mesmo total do mandato. Crescimento do Brasil: IBGE (via Banco Central); mundo, América Latina e PIB por pessoa: Banco Mundial. Datas de cada presidente: <a class=\"linkish\" href=\"/politica/governo/#presidentes\">página Governo</a>.";
  }
  var _bp; function B_pib() { return _bp || (_bp = unpack(B.pib)); }

  // ---------- Outros sinais
  var OU = {
    infl: { key: "infl", nome: "Inflação", cap: 50, unit: "% ao ano",
      def: "<b>Inflação</b> é quanto os preços subiram, em média, no ano. Aqui usamos a média do Banco Mundial (no Brasil, a partir do IPCA do IBGE). Pode diferir um pouco do IPCA “de dezembro a dezembro”, o número que mais aparece no jornal. Valores acima de 50% ficam no topo com um ▲ (passe o dedo ou o mouse para ver o número)." },
    desemp: { key: "desemp", nome: "Desemprego", unit: "% da força de trabalho",
      def: "<b>Desemprego</b> é a parte das pessoas que procuram trabalho e não encontram. Os números usam o mesmo método em todos os países (OIT / Banco Mundial; no Brasil, partem das pesquisas do IBGE). Por isso podem diferir um pouco da taxa que o IBGE divulga no dia a dia." },
    divida: { key: "divida", nome: "Dívida bruta do governo", unit: "% do PIB", proj: true,
      def: "<b>Dívida bruta do governo</b> é tudo o que o governo (federal, estados e municípios) deve, comparado ao tamanho da economia. Fonte: FMI. No Brasil o FMI conta um pouco a mais que o Banco Central, por isso o número aqui pode ser maior que o do noticiário. Os anos depois de " + "{LAST}" + " são previsão." },
    gini: { key: "gini", nome: "Desigualdade (índice de Gini)", unit: "de 0 a 100",
      def: "<b>Índice de Gini</b> mede a desigualdade de renda de 0 a 100: quanto mais alto, mais desigual. Fonte: Banco Mundial, a partir de pesquisas domiciliares de cada país (no Brasil, do IBGE). Nem todo país faz a pesquisa todo ano, por isso há lacunas e pontos soltos." }
  };
  function renderOu() {
    var d = OU[st.ou], from = +$("#ou-de").value, ids = ["BRA"].concat(selValid());
    var series = ids.map(function (id) {
      var v = ser(id, d.key), act = {}, proj = {};
      Object.keys(v).forEach(function (y) { y = +y; if (!d.proj || y <= LAST) act[y] = v[y]; else if (y <= PROJ_TO) proj[y] = v[y]; });
      return { id: id, label: NAMES[id], color: color(id), type: "line", vals: act, proj: proj };
    });
    var y1 = d.proj ? PROJ_TO : LAST;
    $("#ou-def").innerHTML = d.def.replace("{LAST}", LAST);
    chart($("#ch-ou"), {
      y0: from, y1: y1, series: series, zero: true, cap: d.cap, projFrom: d.proj ? LAST + 1 : null,
      label: d.nome + ", " + d.unit + ", de " + from + " a " + y1,
      fmt: function (v) { return st.ou === "gini" ? nf(v, 1) : pct(v, 1); }, tick: function (v) { return st.ou === "gini" ? nf(v, 0) : nf(v, 0) + "%"; }
    });
    legend($("#lg-ou"), series, d.proj ? projLegend : "");
    var b = series[0].vals, yl = null;
    for (var y = LAST; y >= from; y--) if (b[y] != null) { yl = y; break; }
    var t = "";
    if (yl == null) t = "Sem dado do Brasil neste período.";
    else {
      var f = st.ou === "gini" ? function (v) { return nf(v, 1); } : function (v) { return pct(v, 1); };
      var ys = range(from, yl).filter(function (y) { return b[y] != null; });
      var hiY = ys.reduce(function (m, y) { return b[y] > b[m] ? y : m; }, ys[0]), loY = ys.reduce(function (m, y) { return b[y] < b[m] ? y : m; }, ys[0]);
      t = d.nome + " no Brasil em <b>" + yl + "</b>: <b>" + f(b[yl]) + "</b>. No período escolhido, o maior valor foi em " + hiY + " (" + f(b[hiY]) + ") e o menor em " + loY + " (" + f(b[loY]) + "). ";
      var cmp = series.slice(1).filter(function (s) { return s.vals[yl] != null; }).sort(function (a, c) { return a.vals[yl] - c.vals[yl]; });
      if (cmp.length) t += "No mesmo ano: " + cmp.map(function (s) { return s.label + " " + f(s.vals[yl]); }).join(" · ") + ".";
      var semDado = series.slice(1).filter(function (s) { return !Object.keys(s.vals).length; }).map(function (s) { return s.label; });
      if (semDado.length) t += ' <span class="muted">Sem dado para: ' + semDado.join(", ") + ".</span>";
    }
    $("#ou-explica").innerHTML = t;
  }

  // ---------- Resposta curta e números do topo
  function renderResumo() {
    var br = unpack(B.pib), wd = ser("WLD", "cres"), bpc = ser("BRA", "cresPc"), wpc = ser("WLD", "cresPc");
    var a = 1988, tb = chain(br, a, LAST), tw = chain(wd, a, LAST), pb = chain(bpc, a, LAST), pw = chain(wpc, a, LAST);
    var cont = { mais: 0, menos: 0, igual: 0 };
    range(a, LAST).forEach(function (y) { if (br[y] != null && wd[y] != null) cont[veredito(br[y], wd[y]).k]++; });
    var n = cont.mais + cont.menos + cont.igual;
    var fat = ser("BRA", "fatia"), rk = R.pcPpc || [];
    var items = [];
    items.push('<li><span class="k">A economia, desde 1988</span><span class="big">' + pct(tb, 0, true) + '</span><p>De 1988 a ' + LAST + ' a economia brasileira ficou <b>' + pct(tb, 0) + ' maior</b>, já descontada a inflação. A média do mundo cresceu <b>' + pct(tw, 0) + "</b> no mesmo período.</p></li>");
    items.push('<li><span class="k">Por pessoa, desde 1988</span><span class="big">' + pct(pb, 0, true) + '</span><p>Dividindo pela população, cada brasileiro produz em média <b>' + pct(pb, 0) + " a mais</b> que em 1988. Na média do mundo, a alta por pessoa foi de <b>" + pct(pw, 0) + "</b>.</p></li>");
    items.push('<li><span class="k">Ano a ano, contra o mundo</span><span class="big">' + cont.mais + " de " + n + ' anos</span><p>Em <b>' + cont.mais + "</b> dos " + n + " anos desde 1988 o Brasil cresceu mais que a média do mundo; em <b>" + cont.menos + "</b>, menos; em <b>" + cont.igual + "</b>, praticamente igual.</p></li>");
    if (fat[1988] != null && fat[LAST] != null) items.push('<li><span class="k">Pedaço da economia mundial</span><span class="big">' + pct(fat[1988], 1) + " → " + pct(fat[LAST], 1) + '</span><p>Em 1988 o Brasil era ' + pct(fat[1988], 1) + " de tudo o que o mundo produzia (já ajustado pelos preços); em " + LAST + ", " + pct(fat[LAST], 1) + ".</p></li>");
    if (rk.length) { var r0 = rk[0], r1 = rk[rk.length - 1]; items.push('<li><span class="k">Posição em PIB por pessoa</span><span class="big">' + r0[1] + "º → " + r1[1] + 'º</span><p>Entre os países do mundo, o Brasil era o ' + r0[1] + "º em " + r0[0] + " (de " + r0[2] + ") e é o " + r1[1] + "º em " + r1[0] + " (de " + r1[2] + "). Na lista, 1º é o país com maior PIB por pessoa.</p></li>"); }
    var concl = "Resposta curta: <b>sim, o Brasil cresceu</b> — a economia ficou " + pct(tb, 0) + " maior desde 1988 e a riqueza média por pessoa subiu " + pct(pb, 0) + ". ";
    concl += tb < tw ? "Mas <b>cresceu menos que a média do mundo</b> (" + pct(tw, 0) + "), por isso o pedaço do Brasil na economia mundial diminuiu." : "E <b>cresceu mais que a média do mundo</b> (" + pct(tw, 0) + ").";
    items.push('<li class="eco-conclusao"><p>' + concl + "</p></li>");
    $("#resumo-list").innerHTML = items.join("");
    // topo
    $("#st-ult-t").textContent = "Crescimento em " + LAST;
    $("#st-ult").textContent = pct(br[LAST], 1, true);
    var ys = range(a + 1, LAST), gb = geo(br, ys), gw = geo(wd, ys);
    $("#st-media").innerHTML = pct(gb.media, 1) + ' <small class="muted" style="font-size:.5em;font-weight:600;letter-spacing:0">mundo: ' + pct(gw.media, 1) + "</small>";
    var pc = ser("BRA", "pcPpc"), yp = maxKey(pc);
    $("#st-pc-t").textContent = "PIB por pessoa em " + yp + " (ajustado)";
    $("#st-pc").textContent = "US$ " + nf(pc[yp] / 1000, 1) + " mil";
    $("#st-upd").textContent = dataBR(P.geradoEm);
  }

  // ---------- Fontes
  function renderFontes() {
    var f = (F && F.fontes) || {}, h = "";
    var anosBr = minKey(unpack(B.pib)) + "–" + LAST;
    function card(x, extra) {
      if (!x) return "";
      return '<div class="pol-card"><h3><a href="' + esc(x.url) + '" target="_blank" rel="noreferrer">' + esc(x.nome) + "</a></h3><ul>" + extra.map(function (e) { return "<li>" + e + "</li>"; }).join("") + "<li>Consultado em " + dataBR(x.consultadoEm) + (x.atualizadoNaFonte ? " · atualizado na fonte em " + dataBR(x.atualizadoNaFonte) : "") + "</li></ul></div>";
    }
    var prelim = IBGE_FIM && LAST > IBGE_FIM ? " Os anos de " + (IBGE_FIM + 1) + (LAST > IBGE_FIM + 1 ? " a " + LAST : "") + " vêm das Contas Trimestrais do IBGE e ainda podem ser revisados quando saírem as contas anuais definitivas." : "";
    h += card(f.bcb, ["Crescimento do PIB do Brasil, " + anosBr + " (número oficial do IBGE, compilado pelo Banco Central)." + prelim, '<a href="' + esc(f.bcb ? f.bcb.api : "#") + '" target="_blank" rel="noreferrer">Dados em formato aberto</a>']);
    var cf = B.conferencia || {};
    h += card(f.ibge, ["Conferência: comparamos a série do Banco Central com a tabela 6784 do IBGE em " + (cf.anosComparados || 0) + " anos (" + (f.ibge && f.ibge.anos ? f.ibge.anos.join("–") : "") + "): " + ((cf.diferencas || []).length ? (cf.diferencas.length + " anos com diferença acima de 0,1 ponto.") : "nenhuma diferença acima de 0,1 ponto.")]);
    if (f.bm) h += card(f.bm, ["Crescimento do PIB e do PIB por pessoa de todos os países e grupos (1961–" + LAST + "), PIB por pessoa em PPC (1990–" + LAST + "), crescimento acumulado (PIB em dólares constantes de 2015), inflação, desemprego (estimativa da OIT, 1991–" + LAST + ") e Gini.", "Posição do Brasil: calculada aqui entre todos os países do Banco Mundial com dado no ano (sem contar grupos e regiões).", "Indicadores: " + Object.keys(f.bm.indicadores || {}).map(function (k) { return '<span class="mono">' + esc(f.bm.indicadores[k]) + "</span>"; }).join(", ")]);
    if (f.fmi) h += card(f.fmi, ["Projeções de crescimento (linha tracejada, até " + PROJ_TO + "), dívida bruta do governo (% do PIB) e fatia de cada país no PIB mundial em PPC. Projeções são previsões e mudam a cada edição do relatório.", "Para dívida e fatia do PIB mundial, tratamos como projeção os anos depois de " + LAST + "; o último ano antes disso pode ainda ser estimativa do FMI."]);
    h += card(f.presidentes, ["Datas de exercício de cada presidente, usadas para a média por mandato."]);
    h += '<div class="pol-card"><h3>Limites</h3><ul><li>Os números de anos recentes são revisados com frequência pelos órgãos oficiais; a página é atualizada automaticamente toda semana.</li><li>Rússia: o Banco Mundial só tem dados a partir de 1989–1990. Argentina: o Banco Mundial não publica a inflação de vários anos (dados oficiais contestados), e esses anos aparecem como lacuna.</li><li>Médias de grupos (mundo, América Latina, países ricos e em desenvolvimento) são calculadas pelo Banco Mundial, ponderadas pelo tamanho de cada economia.</li><li>Os textos automáticos só descrevem os números; os fatos citados em cada ano (planos econômicos, crises) são contexto, não explicação completa.</li></ul></div>';
    $("#fontes-list").innerHTML = h;
  }

  // ---------- abas e controles
  function tabs(sel, key, fn) {
    $$(sel + ' [role="tab"]').forEach(function (b) {
      b.addEventListener("click", function () {
        $$(sel + ' [role="tab"]').forEach(function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); });
        st[key] = b.getAttribute("data-k"); fn();
      });
    });
  }

  function fail(e) {
    console.warn(e);
    $("#resumo-list").innerHTML = '<li class="err">Não foi possível carregar os dados agora. Tente recarregar a página.</li>';
  }

  function get(n) { return fetch(D + n, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(n + " " + r.status); return r.json(); }); }
  Promise.all([get("paises.json"), get("brasil.json"), get("ranking.json"), get("fontes.json").catch(function () { return {}; })]).then(function (res) {
    P = res[0]; B = res[1]; R = res[2]; F = res[3];
    P.paises.forEach(function (p) { NAMES[p.id] = p.nome; GRP[p.id] = p.grupo; });
    NAMES.BRA = "Brasil";
    LAST = maxKey(unpack(B.pib));
    PROJ_TO = LAST + 2;
    IBGE_FIM = F && F.fontes && F.fontes.ibge && F.fontes.ibge.anos ? F.fontes.ibge.anos[1] : null;
    st.sel = selValid();
    renderPicker();
    renderResumo();
    renderSel();
    renderMundo();
    renderPres();
    renderFontes();
    $("#ano-de").addEventListener("change", function () { renderCres(); if (st.pp === "cresc") renderPP(); });
    $("#ano-proj").addEventListener("change", renderCres);
    $("#ac-base").addEventListener("change", renderAc);
    $("#ou-de").addEventListener("change", renderOu);
    tabs("#pp-tabs", "pp", renderPP);
    tabs("#ac-tabs", "ac", renderAc);
    tabs("#ou-tabs", "ou", renderOu);
  }).catch(fail);
})();
