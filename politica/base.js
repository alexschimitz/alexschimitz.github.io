/* politica/base.js — comportamento comum das páginas de /politica/
   - marca no menu a página atual (aria-current="page")
   - <nav id="main-nav"> recebe sempre o mesmo menu (categorias + "Mais"), em todas as páginas
   - trilha "Você está em" e o dicionário de termos (glossario.js) entram automaticamente
   - links para subpáginas que ainda não existem ganham o selo "em breve"
   - atalhos .pol-subnav acompanham a seção visível
   Incluir depois de ../scripts/home.js (ou ../../scripts/home.js). */
(function () {
  "use strict";
  var ROOT = "/politica/";
  // Menu único de todas as páginas de /politica/ (categorias pensadas para quem não conhece política).
  // Cada item aponta para uma página que existe; "page" liga o item ao paginas.json.
  var PAGES = [
    { href: ROOT, label: "Início" },
    { href: ROOT + "politicos/", label: "Políticos", page: "politicos" },
    { href: ROOT + "gastos/", label: "Gastos", page: "gastos" },
    { href: ROOT + "leis/", label: "Votações e leis", page: "leis" },
    { href: ROOT + "propostas/", label: "Propostas", page: "propostas" },
    { href: ROOT + "planos/", label: "Promessas", page: "planos" },
    { href: ROOT + "eleicoes/", label: "Partidos e eleições", page: "eleicoes" },
    { href: ROOT + "escandalos/", label: "Investigações", page: "escandalos" }
  ];
  var MAIS = [
    { href: ROOT + "fontes/#salarios", label: "Salários e benefícios", path: ROOT + "fontes/", note: "em construção" },
    { href: ROOT + "governo/", label: "Governo", page: "governo" },
    { href: ROOT + "economia/", label: "Economia", page: "economia" },
    { href: ROOT + "mapa/", label: "Mapa", page: "mapa" },
    { href: ROOT + "sigilos/", label: "Sigilos", page: "sigilos" },
    { href: ROOT + "glossario/", label: "Dicionário de termos" },
    { href: ROOT + "fontes/", label: "Fontes e metodologia" }
  ];
  var LABEL_DE = {}; PAGES.concat(MAIS).forEach(function (p) { if (!/#/.test(p.href)) LABEL_DE[p.href] = p.label; });
  LABEL_DE[ROOT + "escandalos/"] = "Escândalos e crises";
  var body = document.body;
  body.classList.add("pol-nav-on");
  var nav = document.getElementById("main-nav");
  function fechaMenu() { var t = document.querySelector(".menu-toggle"); if (t && t.getAttribute("aria-expanded") === "true") t.click(); }
  function link(p) { return '<a href="' + p.href + '"' + (p.page ? ' data-page="' + p.page + '"' : "") + ">" + p.label + (p.note ? ' <span class="nav-note">(' + p.note + ")</span>" : "") + "</a>"; }

  if (nav) {
    var html = PAGES.map(link).join("");
    html += '<div class="nav-mais"><button type="button" class="nav-mais-btn" aria-expanded="false" aria-controls="nav-mais-lista">Mais <span aria-hidden="true">▾</span></button>' +
      '<div class="nav-mais-lista" id="nav-mais-lista">' + MAIS.map(link).join("") + "</div></div>";
    html += '<span class="nav-sep" aria-hidden="true"></span>';
    html += '<button class="theme-toggle" type="button" aria-label="Alternar tema claro ou escuro" title="Tema">◐</button>';
    html += '<a class="nav-cta" href="/">← Site</a>';
    nav.innerHTML = html;
    nav.setAttribute("aria-label", "Seções do portal de política");
    // o home.js já rodou: religa tema e fechamento do menu nos links novos
    var tb = nav.querySelector(".theme-toggle");
    if (tb) tb.addEventListener("click", function () {
      var d = document.documentElement;
      var next = d.getAttribute("data-theme") === "light" ? "dark" : "light";
      d.setAttribute("data-theme", next);
      try { localStorage.setItem("as-theme", next); } catch (e) {}
    });
    nav.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", fechaMenu); });
    var mb = nav.querySelector(".nav-mais-btn"), ml = nav.querySelector(".nav-mais-lista");
    function setMais(open) { mb.setAttribute("aria-expanded", open ? "true" : "false"); ml.classList.toggle("aberta", !!open); }
    mb.addEventListener("click", function () { setMais(mb.getAttribute("aria-expanded") !== "true"); });
    document.addEventListener("click", function (e) { if (!e.target.closest(".nav-mais")) setMais(false); });
    nav.addEventListener("keydown", function (e) { if (e.key === "Escape" && mb.getAttribute("aria-expanded") === "true") { setMais(false); mb.focus(); } });
    nav.addEventListener("focusout", function (e) { if (e.relatedTarget && !e.relatedTarget.closest(".nav-mais")) setMais(false); });

    // Menu "prioridade+": no desktop, itens que não cabem inteiros vão para o "Mais"
    // (vale para qualquer fonte, zoom ou barra de rolagem; nada fica cortado ou sobreposto).
    var wrap = nav.parentNode, brand = wrap.querySelector(".brand");
    var principais = Array.prototype.slice.call(nav.querySelectorAll(":scope > a[href]:not(.nav-cta)"));
    var maisBox = nav.querySelector(".nav-mais");
    function cabe() {
      var w = wrap.getBoundingClientRect(), b = brand ? brand.getBoundingClientRect().right : w.left;
      var vis = Array.prototype.filter.call(nav.children, function (e) { return e.offsetParent !== null; });
      if (!vis.length) return true;
      return vis[0].getBoundingClientRect().left >= b + 16 && vis[vis.length - 1].getBoundingClientRect().right <= w.right + 0.5;
    }
    function ajustaMenu() {
      principais.forEach(function (a) { a.classList.remove("nav-extra"); nav.insertBefore(a, maisBox); });
      if (window.matchMedia("(max-width: 760px)").matches) return;
      for (var i = principais.length - 1; i > 0 && !cabe(); i--) {
        var a = principais[i]; a.classList.add("nav-extra"); ml.insertBefore(a, ml.firstChild);
      }
      if (typeof markCurrent === "function") markCurrent();
    }
    var tAj; function agenda() { clearTimeout(tAj); tAj = setTimeout(ajustaMenu, 60); }
    window.addEventListener("resize", agenda);
    if (window.ResizeObserver) { var roW = 0; new ResizeObserver(function () { var w = nav.scrollWidth + (brand ? brand.offsetWidth : 0); if (w !== roW) { roW = w; agenda(); } }).observe(nav); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustaMenu);
    window.addEventListener("load", ajustaMenu);
    setTimeout(ajustaMenu, 0);
  }

  // Trilha "Você está em" nas subpáginas que ainda não têm
  (function () {
    var path = location.pathname.replace(/index\.html$/, "");
    if (path === ROOT || document.querySelector(".pol-crumbs")) return;
    var h1 = document.querySelector("main h1"); if (!h1) return;
    var lab = LABEL_DE[path]; if (!lab) return;
    var c = document.createElement("nav");
    c.className = "pol-crumbs"; c.setAttribute("aria-label", "Você está em");
    c.innerHTML = '<a href="' + ROOT + '">Política</a> <span aria-hidden="true">›</span> <span aria-current="page">' + lab + "</span>";
    h1.parentNode.insertBefore(c, h1.previousElementSibling && h1.previousElementSibling.classList.contains("eyebrow") ? h1.previousElementSibling : h1);
  })();

  // Dicionário de termos em todas as páginas (glossario.js + glossario.css)
  if (!window.PolGlossario && !document.querySelector('script[src*="glossario.js"]')) {
    var gl = document.createElement("link"); gl.rel = "stylesheet"; gl.href = ROOT + "glossario.css"; document.head.appendChild(gl);
    var gs = document.createElement("script"); gs.src = ROOT + "glossario.js"; gs.async = false; document.body.appendChild(gs);
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
    var mb = nav.querySelector(".nav-mais-btn");
    if (mb) mb.classList.toggle("tem-atual", !!nav.querySelector('.nav-mais-lista a[aria-current="page"]'));
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
    fetch(ROOT + "paginas.json")
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

  // Tabelas com rolagem horizontal precisam ser alcançáveis pelo teclado
  function tableWraps() {
    document.querySelectorAll(".table-wrap:not([tabindex])").forEach(function (w) {
      w.setAttribute("tabindex", "0");
      if (!w.hasAttribute("role")) w.setAttribute("role", "region");
      if (!w.hasAttribute("aria-label") && !w.hasAttribute("aria-labelledby")) {
        var cap = w.querySelector("caption"), h = w.closest("section, .pol-card");
        var t = (cap && cap.textContent) || (h && h.querySelector("h2, h3") && h.querySelector("h2, h3").textContent) || "Tabela";
        w.setAttribute("aria-label", t.trim().slice(0, 80));
      }
    });
  }
  // .tabela-cards (ver base.css): rótulo de cada célula a partir do cabeçalho e papéis ARIA de tabela
  // (display:block em telas estreitas faz alguns navegadores esquecerem que aquilo é uma tabela)
  function tabelaCards() {
    document.querySelectorAll("table.tabela-cards").forEach(function (t) {
      if (!t.hasAttribute("role")) t.setAttribute("role", "table");
      var heads = [].map.call(t.querySelectorAll("thead th"), function (th) { return th.textContent.replace(/\s+/g, " ").trim(); });
      t.querySelectorAll("thead, tbody, tfoot").forEach(function (g) { g.setAttribute("role", "rowgroup"); });
      t.querySelectorAll("tr:not([role])").forEach(function (tr) {
        tr.setAttribute("role", "row");
        var col = 0;
        [].forEach.call(tr.children, function (c) {
          if (c.tagName === "TH") c.setAttribute("role", c.getAttribute("scope") === "row" || c.parentNode.parentNode.tagName === "TBODY" ? "rowheader" : "columnheader");
          else {
            c.setAttribute("role", "cell");
            if (heads[col] && !c.hasAttribute("data-label") && !c.hasAttribute("colspan")) c.setAttribute("data-label", heads[col]);
            if (c.textContent.trim() && c.textContent.trim().length <= 26 && !c.querySelector("br, p, ul")) {
              // rótulo e valor lado a lado: o conteúdo vai num único <span> (a 2ª coluna do grid)
              var v = document.createElement("span"); v.className = "tc-v";
              while (c.firstChild) v.appendChild(c.firstChild);
              c.appendChild(v); c.classList.add("tc-curto");
            }
          }
          col += +(c.getAttribute("colspan") || 1);
        });
      });
    });
  }
  tableWraps(); tabelaCards();
  if ("MutationObserver" in window) {
    var tq = null;
    new MutationObserver(function () { if (!tq) tq = setTimeout(function () { tq = null; tableWraps(); tabelaCards(); }, 150); })
      .observe(document.body, { childList: true, subtree: true });
  }
})();

/* Fotos de políticos (fontes oficiais) com iniciais quando a imagem não abre.
   PolFoto.html(src, nome, crédito, classe) devolve <img> preguiçosa ou <span> com as iniciais. */
(function () {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function initials(n) {
    var p = String(n || "?").replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(function (w) { return w.length > 2 || /^[A-ZÁ-Ú]/.test(w); });
    return ((p[0] || "?").charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : "")).toUpperCase();
  }
  function html(src, nome, credito, cls) {
    cls = cls || "pol-foto";
    var ini = '<span class="' + esc(cls) + ' pol-foto-ini" aria-hidden="true">' + esc(initials(nome)) + "</span>";
    if (!src) return ini;
    var alt = "Foto de " + (nome || "") + (credito ? " (" + credito + ")" : "");
    return '<img class="' + esc(cls) + '" src="' + esc(src) + '" alt="' + esc(alt) + '" title="' + esc(credito ? "Foto: " + credito : "") + '" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-ini="' + esc(initials(nome)) + '">';
  }
  document.addEventListener("error", function (e) {
    var img = e.target;
    if (!img || img.tagName !== "IMG" || !img.hasAttribute("data-ini")) return;
    var s = document.createElement("span");
    s.className = img.className + " pol-foto-ini";
    s.setAttribute("aria-hidden", "true");
    s.textContent = img.getAttribute("data-ini");
    img.replaceWith(s);
  }, true);
  window.PolFoto = { html: html, initials: initials };
})();
