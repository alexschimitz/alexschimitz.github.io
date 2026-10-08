/* politica/base.js — comportamento comum das páginas de /politica/
   - marca no menu a página atual (aria-current="page")
   - <nav id="main-nav" data-pol-nav> vazio recebe o menu padrão
   - links para subpáginas que ainda não existem ganham o selo "em breve"
   - atalhos .pol-subnav acompanham a seção visível
   Incluir depois de ../scripts/home.js (ou ../../scripts/home.js). */
(function () {
  "use strict";
  var ROOT = "/politica/";
  var PAGES = [
    { href: ROOT, label: "Painel" },
    { href: ROOT + "#gastos", label: "Gastos", page: "gastos" },
    { href: ROOT + "#mapa", label: "Mapa", page: "mapa" },
    { href: ROOT + "#parlamentares", label: "Políticos", page: "politicos" },
    { href: ROOT + "#executivo", label: "Governo", page: "governo" },
    { href: ROOT + "#proposicoes", label: "Propostas", page: "propostas" },
    { href: ROOT + "#parlamentares", label: "Congresso" }
  ];
  var body = document.body;
  body.classList.add("pol-nav-on");
  var nav = document.getElementById("main-nav");

  if (nav && nav.hasAttribute("data-pol-nav") && !nav.querySelector("a")) {
    var html = PAGES.map(function (p) { return '<a href="' + p.href + '"' + (p.page ? ' data-page="' + p.page + '"' : "") + ">" + p.label + "</a>"; }).join("");
    html += '<button class="theme-toggle" type="button" aria-label="Alternar tema claro ou escuro" title="Tema">◐</button>';
    html += '<a class="nav-cta" href="/">← Site</a>';
    nav.innerHTML = html;
    // o home.js já rodou: religa tema e fechamento do menu nos links novos
    var tb = nav.querySelector(".theme-toggle");
    if (tb) tb.addEventListener("click", function () {
      var d = document.documentElement;
      var next = d.getAttribute("data-theme") === "light" ? "dark" : "light";
      d.setAttribute("data-theme", next);
      try { localStorage.setItem("as-theme", next); } catch (e) {}
    });
    nav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        var t = document.querySelector(".menu-toggle");
        if (t && t.getAttribute("aria-expanded") === "true") t.click();
      });
    });
  }

  // Página atual
  var here = location.pathname.replace(/index\.html$/, "");
  function markCurrent() {
    nav.querySelectorAll("a[href]").forEach(function (a) {
      a.removeAttribute("aria-current");
      var u;
      try { u = new URL(a.getAttribute("href"), location.href); } catch (e) { return; }
      if (u.origin !== location.origin || u.hash) return;
      var p = u.pathname.replace(/index\.html$/, "");
      if (p === here) a.setAttribute("aria-current", "page");
    });
  }
  if (nav) markCurrent();

  // Subpáginas: /politica/paginas.json diz quais já estão no ar.
  // Links com data-page="x" apontam para a seção do painel (funciona sem JS) e
  // passam para /politica/x/ quando a página existe; senão ganham "em breve".
  // Elementos com data-page-reveal="x" ficam escondidos até /politica/x/ existir.
  // (Não usamos HEAD na própria página: um 404 vira erro no console.)
  function applyPages(pages) {
    document.querySelectorAll("a[data-page]").forEach(function (a) {
      var k = a.getAttribute("data-page");
      if (pages[k] === true || here.indexOf(ROOT + k + "/") === 0) {
        a.setAttribute("href", ROOT + k + "/");
        a.classList.remove("is-soon");
        var old = a.querySelector(".nav-soon"); if (old) old.remove();
      } else if (!a.querySelector(".nav-soon")) {
        a.classList.add("is-soon");
        var s = document.createElement("span");
        s.className = "nav-soon";
        s.textContent = "em breve";
        (a.querySelector("[data-soon]") || a).appendChild(s);
      }
    });
    document.querySelectorAll("[data-page-reveal]").forEach(function (el) {
      var k = el.getAttribute("data-page-reveal");
      el.hidden = !(pages[k] === true || here.indexOf(ROOT + k + "/") === 0);
    });
    if (nav) markCurrent();
  }
  if (document.querySelector("[data-page], [data-page-reveal]")) {
    fetch(ROOT + "paginas.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (j) { applyPages((j && j.paginas) || {}); });
  }

  // Atalhos da página acompanham a rolagem
  var sub = document.querySelector(".pol-subnav");
  if (sub && "IntersectionObserver" in window) {
    var links = Array.prototype.slice.call(sub.querySelectorAll('a[href^="#"]'));
    var map = {};
    links.forEach(function (a) {
      var el = document.getElementById(a.getAttribute("href").slice(1));
      if (el) map[el.id] = a;
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (l) { l.removeAttribute("aria-current"); });
        var a = map[e.target.id];
        if (!a) return;
        a.setAttribute("aria-current", "true");
        var r = a.getBoundingClientRect(), sr = sub.getBoundingClientRect();
        if (r.left < sr.left || r.right > sr.right) sub.scrollTo({ left: a.offsetLeft - 14, behavior: "smooth" });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(map).forEach(function (id) { io.observe(document.getElementById(id)); });
  }
})();
