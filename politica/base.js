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
    { href: ROOT + "economia/", label: "Economia", page: "economia" },
    { href: ROOT + "planos/", label: "Planos", page: "planos" },
    { href: ROOT + "#mapa", label: "Mapa", page: "mapa" },
    { href: ROOT + "eleicoes/", label: "Eleições", page: "eleicoes" },
    { href: ROOT + "#parlamentares", label: "Políticos", page: "politicos" },
    { href: ROOT + "#executivo", label: "Governo", page: "governo" },
    { href: ROOT + "#proposicoes", label: "Propostas", page: "propostas" },
    { href: ROOT + "leis/", label: "Leis", page: "leis" },
    { href: ROOT + "sigilos/", label: "Sigilos", page: "sigilos" },
    { href: ROOT + "escandalos/", label: "Escândalos", page: "escandalos" },
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

  // Menus escritos à mão: acrescenta só o que faltar (Leis / Sigilos / Escândalos), sem duplicar
  if (nav) {
    var prop = nav.querySelector('a[data-page="propostas"]');
    if (prop) {
      [["leis", "Leis"], ["sigilos", "Sigilos"], ["escandalos", "Escândalos"]].forEach(function (p) {
        if (nav.querySelector('a[data-page="' + p[0] + '"]')) return;
        var a = document.createElement("a");
        a.href = ROOT + p[0] + "/"; a.setAttribute("data-page", p[0]); a.textContent = p[1];
        a.addEventListener("click", function () { var t = document.querySelector(".menu-toggle"); if (t && t.getAttribute("aria-expanded") === "true") t.click(); });
        var after = nav.querySelector('a[data-page="escandalos"]') ||
                    nav.querySelector('a[data-page="sigilos"]') ||
                    nav.querySelector('a[data-page="leis"]') ||
                    prop;
        after.insertAdjacentElement("afterend", a);
      });
    }
  }

  // Menus escritos à mão sem "Eleições": acrescenta depois de "Mapa"
  if (nav && !nav.querySelector('a[data-page="eleicoes"]')) {
    var mp = nav.querySelector('a[data-page="mapa"]');
    if (mp) {
      var ae = document.createElement("a");
      ae.href = ROOT + "eleicoes/"; ae.setAttribute("data-page", "eleicoes"); ae.textContent = "Eleições";
      ae.addEventListener("click", function () { var t = document.querySelector(".menu-toggle"); if (t && t.getAttribute("aria-expanded") === "true") t.click(); });
      mp.insertAdjacentElement("afterend", ae);
    }
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
