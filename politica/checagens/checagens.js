/* /politica/checagens/ — lista, filtros (na URL) e detalhe com âncora */
(function () {
  "use strict";
  var L = window.PolChecagens, V = L.VEREDITOS;
  var $ = function (id) { return document.getElementById(id); };
  var lista = $("ck-lista"), status = $("ck-status"), estado = $("ck-estado");
  var F = { q: $("ck-q"), veredito: $("ck-veredito"), autor: $("ck-autor"), tema: $("ck-tema") };
  var DADOS = [];
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function data(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? m[3] + "/" + m[2] + "/" + m[1] : esc(s); }
  function classe(v) { return v === "verdadeira" ? "ok" : (v === "falsa" ? "no" : (v === "parcialmente_verdadeira" || v === "enganosa" ? "warn" : "neutral")); }
  function selo(v) { return '<span class="badge ck-v ' + classe(v) + '">' + esc((V[v] || [v])[0]) + "</span>"; }
  function bloco(t, txt, semGl) { return txt ? '<div class="ck-bloco"' + (semGl ? " data-sem-glossario" : "") + '><h4>' + t + "</h4><p>" + esc(txt) + "</p></div>" : ""; }
  function card(c) {
    var fontes = c.fontes.map(function (f) { return '<li><a href="' + esc(f.url) + '" target="_blank" rel="noreferrer">' + esc(f.titulo || f.url) + "</a>" + (f.tipo ? ' <span class="chip">' + esc(f.tipo) + "</span>" : "") + "</li>"; }).join("");
    var temas = (c.temas || []).map(function (t) { return '<a class="chip tema" href="?tema=' + encodeURIComponent(t) + '">' + esc(L.rotuloTema(t)) + "</a>"; }).join(" ");
    return '<li class="item ck-item" id="' + esc(c.id) + '"><article aria-labelledby="t-' + esc(c.id) + '">' +
      '<div class="ck-topo" data-sem-glossario>' + selo(c.veredito) + ' <span class="ck-meta">' + esc(c.autor) + " · " + data(c.data_afirmacao) + "</span></div>" +
      '<h3 id="t-' + esc(c.id) + '">' + esc(c.titulo) + "</h3>" +
      '<blockquote class="ck-frase" data-sem-glossario><p>“' + esc(c.afirmacao) + '”</p><footer>— ' + esc(c.autor) + "</footer></blockquote>" +
      '<details class="ck-det"><summary>Ver a checagem completa</summary>' +
      bloco("Contexto", c.contexto, true) + bloco("O que as fontes mostram", c.o_que_as_fontes_mostram) +
      bloco("Evidências a favor da afirmação", c.evidencias_favoraveis) + bloco("Evidências contra a afirmação", c.evidencias_contrarias) +
      '<div class="ck-bloco"><h4>Resultado</h4><p>' + selo(c.veredito) + " " + esc((V[c.veredito] || ["", ""])[1]) + "</p></div>" +
      bloco("Limitações desta checagem", c.limitacoes) +
      '<div class="ck-bloco"><h4>Fontes para conferir</h4><ul class="ck-fontes">' + fontes + "</ul>" +
      (c.link_original ? '<p><a href="' + esc(c.link_original) + '" target="_blank" rel="noreferrer">Onde a frase foi registrada</a></p>' : "") + "</div>" +
      '<p class="ck-rodape">Verificada em ' + data(c.data_verificacao) + ' por assistente automatizado, sem revisão humana. <a href="#' + esc(c.id) + '">Link desta checagem</a></p>' +
      "</details>" + (temas ? '<p class="ck-temas">' + temas + "</p>" : "") + "</article></li>";
  }
  function opcoes(sel, valores, rot) { sel.innerHTML = '<option value="">Todos</option>' + valores.map(function (v) { return '<option value="' + esc(v) + '">' + esc(rot ? rot(v) : v) + "</option>"; }).join(""); }
  function atual() { return { q: F.q.value.trim(), veredito: F.veredito.value, autor: F.autor.value, tema: F.tema.value }; }
  function render(push) {
    var f = atual(), r = L.filtrar(DADOS, f);
    var url = location.pathname + L.escreverFiltros(f) + location.hash;
    if (push !== false) history.replaceState(null, "", url);
    lista.innerHTML = r.map(card).join("");
    status.textContent = r.length ? r.length + (r.length === 1 ? " checagem encontrada" : " checagens encontradas") + " de " + DADOS.length + "." : "Nenhuma checagem com esses filtros. Tente limpar a busca ou escolher “Todos”.";
    abrirAncora();
  }
  function abrirAncora() {
    var id = decodeURIComponent(location.hash.slice(1)); if (!id) return;
    var el = document.getElementById(id);
    if (el && el.classList.contains("ck-item")) { var d = el.querySelector("details"); if (d) d.open = true; el.scrollIntoView({ block: "start" }); el.querySelector("h3").setAttribute("tabindex", "-1"); el.querySelector("h3").focus({ preventScroll: true }); }
  }
  function erro(msg) { estado.hidden = false; estado.className = "ck-estado erro"; estado.innerHTML = msg; status.textContent = ""; lista.innerHTML = ""; }
  // legenda dos vereditos
  $("ck-legenda").innerHTML = Object.keys(V).map(function (k) { return "<div><dt>" + selo(k) + "</dt><dd>" + esc(V[k][1]) + "</dd></div>"; }).join("");
  fetch("/politica/data/checagens.json").then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(function (j) {
    var todos = (j && j.checagens) || [], ruins = 0;
    DADOS = todos.filter(function (c) { var e = L.valida(c); if (e.length) { ruins++; console.warn("Checagem ignorada:", c && c.id, e.join(", ")); } return !e.length; });
    estado.hidden = true;
    if (!DADOS.length) return erro("Ainda não há checagens publicadas.");
    $("ck-atualizado").textContent = j.atualizado ? "Atualizado em " + data(j.atualizado) + "." : "";
    if (ruins) $("ck-atualizado").textContent += " " + ruins + " item(ns) com dados incompletos não foram exibidos.";
    var autores = [], temas = [];
    DADOS.forEach(function (c) { if (autores.indexOf(c.autor) < 0) autores.push(c.autor); (c.temas || []).forEach(function (t) { if (temas.indexOf(t) < 0) temas.push(t); }); });
    opcoes(F.veredito, Object.keys(V).filter(function (k) { return DADOS.some(function (c) { return c.veredito === k; }); }), function (k) { return V[k][0]; });
    opcoes(F.autor, autores.sort(function (a, b) { return a.localeCompare(b, "pt-BR"); }));
    opcoes(F.tema, temas.sort(), L.rotuloTema);
    var f = L.lerFiltros(location.search);
    Object.keys(F).forEach(function (k) { F[k].value = f[k]; if (F[k].value !== f[k]) F[k].value = ""; });
    $("ck-form").hidden = false;
    render(false);
  }).catch(function (e) { console.warn("checagens:", e.message); erro('Não foi possível carregar as checagens agora. Verifique sua conexão e <a href="">tente de novo</a>. Os dados ficam em <a href="/politica/data/checagens.json">checagens.json</a>.'); });
  var t; F.q.addEventListener("input", function () { clearTimeout(t); t = setTimeout(render, 200); });
  ["veredito", "autor", "tema"].forEach(function (k) { F[k].addEventListener("change", render); });
  $("ck-form").addEventListener("submit", function (e) { e.preventDefault(); render(); });
  $("ck-limpar").addEventListener("click", function () { Object.keys(F).forEach(function (k) { F[k].value = ""; }); history.replaceState(null, "", location.pathname); render(); F.q.focus(); });
  window.addEventListener("hashchange", abrirAncora);
})();
