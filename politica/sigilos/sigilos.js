/* politica/sigilos/sigilos.js — casos de sigilos derrubados, revistos ou mantidos */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var norm = function (s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); };
  var Y = document.getElementById("year"); if (Y) Y.textContent = new Date().getFullYear();
  var ST = { derrubado: ["Derrubado", "ok"], revisto: ["Revisto", "warn"], mantido: ["Ainda em sigilo", "no"] };
  var CASOS = [];
  fetch("../data/sigilos/sigilos.json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) {
    CASOS = j.casos || [];
    CASOS.forEach(function (c) { c._q = norm([c.titulo, c.tema, c.segredo, c.quem, c.quando, c.revelado, (c.governos || []).join(" ")].join(" ")); });
    CASOS.sort(function (a, b) { return (a.status === "mantido") - (b.status === "mantido") || b.ano - a.ano; });
    $("#st-n").textContent = CASOS.length;
    $("#st-d").textContent = CASOS.filter(function (c) { return c.status === "derrubado"; }).length;
    $("#st-r").textContent = CASOS.filter(function (c) { return c.status === "revisto"; }).length;
    $("#st-a").textContent = (j.atualizado || "").split("-").reverse().join("/");
    var g = {}; CASOS.forEach(function (c) { (c.governos || []).forEach(function (x) { if (x !== "Todos") g[x] = 1; }); });
    $("#f-gov").insertAdjacentHTML("beforeend", Object.keys(g).sort().map(function (x) { return "<option>" + esc(x) + "</option>"; }).join(""));
    $("#niveis tbody").innerHTML = (j.niveis || []).map(function (n) { return '<tr><th scope="row">' + esc(n.nivel) + "</th><td>" + esc(n.prazo) + "</td><td>" + esc(n.base) + '</td><td class="tc-fim">' + esc(n.ex) + "</td></tr>"; }).join("");
    var fontes = {}; CASOS.forEach(function (c) { (c.fontes || []).forEach(function (f) { fontes[f[1]] = f[0]; }); });
    $("#fontes-list").innerHTML = Object.keys(fontes).map(function (u) { return '<li class="item"><a class="ext" style="margin-top:0" href="' + esc(u) + '" target="_blank" rel="noreferrer">' + esc(fontes[u]) + " ↗</a></li>"; }).join("");
    ["q", "f-status", "f-gov"].forEach(function (id) { var el = document.getElementById(id); el.addEventListener(el.tagName === "INPUT" ? "input" : "change", render); });
    render();
    if (location.hash.length > 1) { var t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
  }).catch(function () { $("#lista").innerHTML = '<li class="err">Não foi possível carregar os casos agora. Tente recarregar a página.</li>'; });
  function render() {
    var q = norm($("#q").value.trim()), s = $("#f-status").value, g = $("#f-gov").value;
    var r = CASOS.filter(function (c) { return (!q || c._q.indexOf(q) >= 0) && (!s || c.status === s) && (!g || (c.governos || []).some(function (x) { return x === g || x === "Todos"; })); });
    $("#count").textContent = r.length === CASOS.length ? CASOS.length + " casos" : r.length + " de " + CASOS.length + " casos";
    $("#lista").innerHTML = r.map(function (c) {
      var st = ST[c.status] || ["", "neutral"];
      return '<li class="item" id="' + esc(c.id) + '"><div class="item-top"><span class="badge ' + st[1] + '">' + st[0] + '</span><span class="sig">' + esc(c.tema) + "</span><span>" + esc(c.ano) + "</span><span>" + esc((c.governos || []).join(", ")) + "</span>" + (c.poder ? "<span>" + esc(c.poder) + "</span>" : "") + "</div>" +
        "<h3>" + esc(c.titulo) + '</h3><div class="sig-grid"><div><h4>O que era segredo</h4><p>' + esc(c.segredo) + "</p></div><div><h4>Quem decretou</h4><p>" + esc(c.quem) + "</p></div>" +
        "<div><h4>" + (c.status === "mantido" ? "Situação" : "Quando e por que caiu") + "</h4><p>" + esc(c.quando) + '</p></div><div class="rev"><h4>' + (c.status === "mantido" ? "O que dá para ver" : "O que foi revelado") + "</h4><p>" + esc(c.revelado) + "</p></div></div>" +
        (c.aqui ? '<p><a class="ext" href="' + esc(c.aqui[1]) + '">' + esc(c.aqui[0]) + " →</a></p>" : "") +
        '<ul class="sig-fontes">' + (c.fontes || []).map(function (f) { return '<li><a href="' + esc(f[1]) + '" target="_blank" rel="noreferrer">' + esc(f[0]) + " ↗</a></li>"; }).join("") + "</ul></li>";
    }).join("") || '<li class="state-empty">Nenhum caso com esses filtros.</li>';
  }
})();
