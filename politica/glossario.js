/* politica/glossario.js — dicionário de termos reutilizável em todas as páginas de /politica/.
   Dados: /politica/data/glossario.json (fonte editável: tools-politica/glossario_src.py).
   Uso:
   - <span data-termo="cpi">CPI</span> vira um botão com explicação (passar o mouse, focar com Tab ou tocar).
   - Texto estático dentro de <main> recebe marcação automática na 1ª ocorrência de cada termo
     (desligue num trecho com data-sem-glossario; ligue em conteúdo dinâmico com data-glossario-auto).
   - Tooltip curto em hover/foco; clique/Enter abre painel completo (<dialog>); Esc fecha.
   - window.PolGlossario: { ready, norm, get(id), abrir(id), marcar(raiz) }. */
(function (root) {
  "use strict";
  var URL_DADOS = "/politica/data/glossario.json";
  function norm(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }
  // Nomes curtos/ambíguos que não são marcados automaticamente (só com data-termo)
  var NAO_AUTO = { "emenda": 1, "veto": 1, "turno": 1, "pagamento": 1, "imposto": 1, "ministerio": 1, "bancada": 1, "decreto": 1,
    "tributo": 1, "comissao": 1, "plenario": 1, "parecer": 1, "relator": 1, "requerimento": 1, "convenio": 1, "diaria": 1,
    "passagens": 1, "condenacao": 1, "absolvicao": 1, "liminar": 1, "inflacao": 1, "sigilo": 1, "denuncia": 1, "reu": 1,
    "partido-politico": 1, "destaque": 1, "sancao": 1, "abstencao": 1, "tramitacao": 1, "lideranca": 1, "arquivamento": 1, "contrato-administrativo": 1 };
  function aliases(t) {
    var base = t.nome.replace(/\s*\(.*?\)\s*/g, " ").replace(/[“”]/g, "").trim();
    var out = [base].concat(t.sinonimos || []);
    var sig = /\(([A-ZÀ-Ú]{2,6})\)/.exec(t.nome); if (sig) out.push(sig[1]);
    return out.filter(function (a, i, arr) { return a && arr.indexOf(a) === i; });
  }

  if (typeof module === "object" && module.exports) { module.exports = { norm: norm, aliases: aliases, NAO_AUTO: NAO_AUTO }; return; }

  var doc = root.document, DATA = null, BY = {};
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  var ready = fetch(URL_DADOS).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (j) { DATA = j; (j.termos || []).forEach(function (t) { BY[t.id] = t; }); return j; });

  // ---------- Tooltip (um só por página) ----------
  var tip = doc.createElement("div");
  tip.id = "gl-tip"; tip.className = "gl-tip"; tip.setAttribute("role", "tooltip"); tip.hidden = true;
  var tipFor = null, hideT = null;
  function place(el) {
    var r = el.getBoundingClientRect(), vw = doc.documentElement.clientWidth, vh = doc.documentElement.clientHeight;
    tip.style.left = "0px"; tip.style.top = "0px"; tip.hidden = false;
    var w = tip.offsetWidth, h = tip.offsetHeight, m = 8;
    var left = Math.min(Math.max(m, r.left + r.width / 2 - w / 2), vw - w - m);
    var top = r.bottom + m; if (top + h > vh - m && r.top - h - m > m) top = r.top - h - m;
    tip.style.left = Math.round(left + root.scrollX) + "px"; tip.style.top = Math.round(top + root.scrollY) + "px";
  }
  function showTip(el) {
    var t = BY[el.getAttribute("data-gl")]; if (!t) return;
    clearTimeout(hideT); tipFor = el;
    tip.innerHTML = "<strong>" + esc(t.nome) + "</strong><span>" + esc(t.explicacao) + "</span><em>Clique ou toque para mais detalhes</em>";
    if (!tip.parentNode) doc.body.appendChild(tip);
    place(el);
  }
  function hideTip(now) { clearTimeout(hideT); hideT = setTimeout(function () { tip.hidden = true; tipFor = null; }, now ? 0 : 120); }

  // ---------- Painel completo ----------
  var dlg = null, voltar = null;
  function painel() {
    if (dlg) return dlg;
    dlg = doc.createElement("dialog"); dlg.className = "gl-dialog"; dlg.setAttribute("aria-labelledby", "gl-d-t");
    dlg.innerHTML = '<div class="gl-d-in"><button type="button" class="gl-d-x" aria-label="Fechar explicação">✕</button><div id="gl-d-c"></div></div>';
    doc.body.appendChild(dlg);
    dlg.querySelector(".gl-d-x").addEventListener("click", function () { dlg.close(); });
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) dlg.close();
      var b = e.target.closest && e.target.closest("[data-gl-ir]"); if (b) { e.preventDefault(); abrir(b.getAttribute("data-gl-ir")); }
    });
    dlg.addEventListener("close", function () { if (voltar && voltar.focus) voltar.focus(); });
    return dlg;
  }
  function blocoTermo(t, h) {
    var f = t.fonte || {};
    return "<" + h + ' id="gl-d-t">' + esc(t.nome) + "</" + h + ">" +
      '<p class="gl-cat">' + esc(t.categoria) + "</p>" +
      "<p>" + esc(t.explicacao) + "</p>" +
      (t.exemplo ? '<p><b>Exemplo:</b> ' + esc(t.exemplo) + "</p>" : "") +
      (t.diferencas ? '<p><b>Não confundir:</b> ' + esc(t.diferencas) + "</p>" : "") +
      (t.ressalvas ? '<p class="gl-ress"><b>Atenção:</b> ' + esc(t.ressalvas) + "</p>" : "") +
      (f.url ? '<p class="gl-fonte"><b>Fonte oficial:</b> <a href="' + esc(f.url) + '" target="_blank" rel="noreferrer">' + esc(f.nome || f.url) + ' <span class="sr-only">(abre em nova aba)</span></a></p>' : "");
  }
  function abrir(id, origem) {
    var t = BY[id]; if (!t) return;
    hideTip(true); painel();
    if (origem) voltar = origem;
    dlg.querySelector("#gl-d-c").innerHTML = blocoTermo(t, "h2") +
      '<p class="gl-mais"><a href="/politica/glossario/#' + esc(t.id) + '">Ver no dicionário completo →</a></p>';
    if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", ""); }
    dlg.querySelector(".gl-d-x").focus();
  }

  function botao(el, id, texto) {
    var b = doc.createElement("button");
    b.type = "button"; b.className = "gl-termo"; b.setAttribute("data-gl", id);
    b.setAttribute("aria-describedby", "gl-tip"); b.setAttribute("aria-haspopup", "dialog");
    b.textContent = texto;
    var sr = doc.createElement("span"); sr.className = "sr-only"; sr.textContent = " (o que é?)"; b.appendChild(sr);
    return b;
  }

  // ---------- Marcação ----------
  var marcados = {}, MAX_AUTO = 40, nAuto = 0, RX = null, MAP = {};
  function prepRegex() {
    var list = [];
    DATA.termos.forEach(function (t) {
      if (NAO_AUTO[t.id]) return;
      aliases(t).forEach(function (a) {
        var acr = /^[A-ZÀ-Ú]{2,6}$/.test(a);
        if (!acr && a.length < 6) return;
        MAP[acr ? "A:" + a : norm(a)] = t.id; list.push({ a: a, acr: acr });
      });
    });
    list.sort(function (x, y) { return y.a.length - x.a.length; });
    var parts = list.map(function (x) { return x.a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); });
    RX = new RegExp("(^|[^\\p{L}\\p{N}])(" + parts.join("|") + ")(?=$|[^\\p{L}\\p{N}])", "giu");
  }
  var PULAR = "a,button,input,select,textarea,label,script,style,code,h1,dialog,[data-sem-glossario],.gl-termo,.term,.pol-subnav,.pol-crumbs,svg,summary,[role=tab],nav,.gl-page";
  function marcarTexto(rootEl) {
    if (!RX) return;
    var w = doc.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
      if (!n.nodeValue || n.nodeValue.length < 3) return NodeFilter.FILTER_REJECT;
      var p = n.parentElement; if (!p || p.closest(PULAR)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT; } });
    var nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach(function (n) {
      if (nAuto >= MAX_AUTO) return;
      RX.lastIndex = 0;
      var s = n.nodeValue, m, frag = null, last = 0;
      while ((m = RX.exec(s)) && nAuto < MAX_AUTO) {
        var word = m[2], acr = /^[A-ZÀ-Ú]{2,6}$/.test(word);
        var id = acr ? MAP["A:" + word] : MAP[norm(word)];
        if (!id && !acr) continue;
        if (!id || marcados[id]) continue;
        if (acr && word !== word.toUpperCase()) continue;
        var start = m.index + m[1].length;
        frag = frag || doc.createDocumentFragment();
        frag.appendChild(doc.createTextNode(s.slice(last, start)));
        frag.appendChild(botao(n.parentNode, id, word));
        last = start + word.length; marcados[id] = 1; nAuto++;
      }
      if (frag) { frag.appendChild(doc.createTextNode(s.slice(last))); n.parentNode.replaceChild(frag, n); }
    });
  }
  function marcar(rootEl) {
    rootEl = rootEl || doc;
    rootEl.querySelectorAll("[data-termo]:not([data-gl])").forEach(function (el) {
      var id = el.getAttribute("data-termo"); if (!BY[id]) return;
      var b = botao(el, id, el.textContent.trim()); el.replaceWith(b);
    });
  }

  // ---------- Eventos (delegados: funcionam também para conteúdo inserido depois) ----------
  doc.addEventListener("mouseover", function (e) { var b = e.target.closest && e.target.closest(".gl-termo"); if (b) showTip(b); else if (tipFor && !(e.target.closest && e.target.closest(".gl-tip"))) hideTip(); });
  doc.addEventListener("focusin", function (e) { var b = e.target.closest && e.target.closest(".gl-termo"); if (b) showTip(b); else if (tipFor) hideTip(true); });
  doc.addEventListener("focusout", function (e) { if (e.target.closest && e.target.closest(".gl-termo")) hideTip(); });
  doc.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest(".gl-termo"); if (b) { e.preventDefault(); abrir(b.getAttribute("data-gl"), b); } });
  doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && !tip.hidden) { hideTip(true); } });
  root.addEventListener("scroll", function () { if (tipFor) place(tipFor); }, { passive: true });

  ready.then(function () {
    prepRegex(); marcar(doc);
    var main = doc.querySelector("main");
    if (main && !doc.body.hasAttribute("data-sem-glossario")) {
      main.querySelectorAll("p, li, dd").forEach(function (el) { if (!el.closest("[data-carregando], [aria-live]")) marcarTexto(el); });
    }
    doc.querySelectorAll("[data-glossario-auto]").forEach(function (el) {
      new MutationObserver(function () { marcar(el); marcarTexto(el); }).observe(el, { childList: true, subtree: true });
    });
  }).catch(function (e) { if (root.console) console.warn("Glossário indisponível:", e.message); });

  root.PolGlossario = { ready: ready, norm: norm, aliases: aliases, get: function (id) { return BY[id]; }, abrir: abrir, marcar: marcar, bloco: blocoTermo };
})(typeof window !== "undefined" ? window : globalThis);
