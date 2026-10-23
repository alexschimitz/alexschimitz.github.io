/* Página /politica/glossario/: lista completa com busca (sem acentos) e filtro por assunto; filtros na URL. */
(function () {
  "use strict";
  var G = window.PolGlossario, q = document.getElementById("gl-q"), cat = document.getElementById("gl-cat");
  var lista = document.getElementById("gl-lista"), st = document.getElementById("gl-status"), DATA = null;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function render() {
    var k = G.norm(q.value), c = cat.value, n = 0, html = "";
    DATA.categorias.forEach(function (cn) {
      if (c && c !== cn) return;
      var ts = DATA.termos.filter(function (t) {
        return t.categoria === cn && (!k || G.norm([t.nome, t.explicacao, (t.sinonimos || []).join(" ")].join(" ")).indexOf(k) >= 0);
      });
      if (!ts.length) return; n += ts.length;
      html += '<section class="gl-grupo" aria-label="' + esc(cn) + '"><h3 class="gl-cat-t">' + esc(cn) + " <small>(" + ts.length + ")</small></h3>" +
        ts.map(function (t) { return '<article class="gl-item" id="' + esc(t.id) + '">' + G.bloco(t, "h4").replace(' id="gl-d-t"', "") + "</article>"; }).join("") + "</section>";
    });
    lista.innerHTML = html;
    st.textContent = n ? n + (n === 1 ? " termo" : " termos") + (k || c ? " encontrados" : " no dicionário") : "Nenhum termo encontrado. Tente outra palavra ou escolha “Todos os assuntos”.";
  }
  function url() {
    var p = new URLSearchParams(); if (q.value.trim()) p.set("q", q.value.trim()); if (cat.value) p.set("cat", cat.value);
    var s = p.toString(); history.replaceState(null, "", location.pathname + (s ? "?" + s : "") + location.hash);
  }
  if (!G) { st.textContent = "Não foi possível carregar o dicionário."; return; }
  document.getElementById("gl-form").addEventListener("submit", function (e) { e.preventDefault(); });
  G.ready.then(function (j) {
    DATA = j;
    cat.insertAdjacentHTML("beforeend", j.categorias.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join(""));
    var p = new URLSearchParams(location.search); q.value = p.get("q") || ""; cat.value = p.get("cat") || "";
    render();
    q.addEventListener("input", function () { url(); render(); });
    cat.addEventListener("change", function () { url(); render(); });
    if (location.hash.length > 1) { var el = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (el) { el.scrollIntoView(); el.setAttribute("tabindex", "-1"); el.focus({ preventScroll: true }); } }
  }).catch(function () { st.textContent = "Não foi possível carregar o dicionário agora. Tente recarregar a página."; });
})();
