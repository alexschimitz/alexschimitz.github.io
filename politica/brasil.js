/* Executivo federal, mapa de UFs e municípios (IBGE). */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  function esc(s) {
    // Monta as entidades em tempo de execução para o arquivo não quebrar
    // se um upload web decodificar & e aspas.
    const map = { "&": "amp", "<": "lt", ">": "gt", '"': "quot", "'": "#39" };
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return "&" + map[c] + ";";
    });
  }
  function slug(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }
  function ibgeUrl(uf, nome) {
    return "https://cidades.ibge.gov.br/brasil/" + uf.toLowerCase() + "/" + slug(nome) + "/panorama";
  }

  let ufs = [];
  let munis = null;
  let munisPromise = null;
  let ufAtual = "RS";

  function renderGoverno(data) {
    const box = $("#exec-body");
    if (!box || !data) return;
    const p = data.presidente || {};
    const v = data.vice || {};
    const el = data.eleicao2026 || {};
    box.innerHTML =
      '<div class="exec-grid">' +
        card(p) + card(v) +
      "</div>" +
      '<div class="turno">' +
        "<strong>Última eleição e o que ainda falta votar</strong>" +
        "<p>" + esc(el.resumo) + "</p>" +
        '<div class="turno-links">' +
          (el.links || []).map(l => '<a href="' + esc(l.url) + '" target="_blank" rel="noreferrer">' + esc(l.rotulo) + " ↗</a>").join("") +
        "</div></div>" +
      '<form class="pol-filters" id="min-filters" onsubmit="return false" style="margin-top:18px">' +
        '<div class="field field-search"><label for="min-q">Buscar ministro ou pasta</label>' +
        '<input id="min-q" type="search" placeholder="Ex.: Saúde, Fazenda, Boulos" autocomplete="off"></div>' +
      "</form>" +
      '<p class="pol-count" id="min-count"></p>' +
      '<ul class="min-grid" id="min-grid"></ul>' +
      '<p class="note">' + esc(data.nota) + " Lista oficial: " +
        (data.fontes || []).map(f => '<a href="' + esc(f.url) + '" target="_blank" rel="noreferrer">' + esc(f.nome) + "</a>").join(" · ") +
      ".</p>";
    const mins = data.ministros || [];
    const grid = $("#min-grid");
    const count = $("#min-count");
    const LIMIT = 8;
    let showAll = false;
    const moreBtn = document.createElement("button");
    moreBtn.type = "button";
    moreBtn.className = "button button-ghost min-more";
    moreBtn.setAttribute("aria-controls", "min-grid");
    grid.insertAdjacentElement("afterend", moreBtn);
    function paint(q) {
      const n = (q || "").trim().toLowerCase();
      const rows = mins.filter(m => !n || (m.nome + " " + m.orgao).toLowerCase().includes(n));
      const cut = n || showAll ? rows : rows.slice(0, LIMIT);
      count.textContent = rows.length + " pasta" + (rows.length === 1 ? "" : "s");
      grid.innerHTML = cut.map(m =>
        "<li><small>" + esc(m.orgao) + "</small><strong>" + esc(m.nome) + "</strong><span>No cargo desde " + esc(m.desde) + "</span></li>"
      ).join("") || '<li><strong>Nenhuma pasta com esse texto.</strong></li>';
      moreBtn.hidden = !!n || rows.length <= LIMIT;
      moreBtn.textContent = showAll ? "Mostrar menos" : "Mostrar todas as " + rows.length + " pastas";
      moreBtn.setAttribute("aria-expanded", showAll ? "true" : "false");
    }
    moreBtn.addEventListener("click", () => { showAll = !showAll; paint($("#min-q").value); });
    paint("");
    $("#min-q").addEventListener("input", e => paint(e.target.value));
  }

  function card(p) {
    return '<article class="exec-card"><div class="role">' + esc(p.cargo) + "</div><h3>" + esc(p.nome) +
      "</h3><p>" + esc(p.partido || "") + (p.desde ? " · em exercício desde " + esc(p.desde) : "") + "</p>" +
      (p.url ? '<p><a href="' + esc(p.url) + '" target="_blank" rel="noreferrer">Página oficial ↗</a></p>' : "") +
      "</article>";
  }

  function renderUfs(data) {
    ufs = (data && data.ufs) || [];
    const chips = $("#uf-chips");
    if (chips) {
      chips.innerHTML = ufs.map(u =>
        '<button type="button" data-uf="' + u.uf + '" aria-pressed="' + (u.uf === ufAtual ? "true" : "false") + '">' + u.uf + "</button>"
      ).join("");
      chips.addEventListener("click", e => {
        const b = e.target.closest("button[data-uf]");
        if (b) selectUf(b.getAttribute("data-uf"));
      });
    }
    const caps = $("#cap-chips");
    if (caps) {
      caps.innerHTML = ufs.map(u =>
        '<button type="button" class="cap-btn" data-cap="' + esc(u.capital) + '" data-uf="' + u.uf + '">' + esc(u.capital) + "</button>"
      ).join("");
      caps.addEventListener("click", e => {
        const b = e.target.closest("button[data-cap]");
        if (!b) return;
        selectUf(b.getAttribute("data-uf"));
        openMunByName(b.getAttribute("data-cap"), b.getAttribute("data-uf"));
      });
    }
    const note = $("#uf-note");
    if (note && data) note.textContent = data.nota || "";
    labelStates();
    selectUf(ufAtual, true);
  }

  function labelStates() {
    $$("#br-map .state").forEach(el => {
      const u = ufs.find(x => x.uf === el.id);
      if (u) el.setAttribute("aria-label", u.nome + " (" + u.uf + ")");
    });
  }

  function selectUf(uf, silent) {
    ufAtual = uf;
    $$("#uf-chips button").forEach(b => b.setAttribute("aria-pressed", b.getAttribute("data-uf") === uf ? "true" : "false"));
    $$("#br-map .state").forEach(el => el.classList.toggle("is-on", el.id === uf));
    const u = ufs.find(x => x.uf === uf);
    const sheet = $("#uf-sheet");
    if (!u || !sheet) return;
    sheet.innerHTML =
      '<p class="role" style="color:var(--accent);font-family:DM Mono,monospace;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase">' + esc(u.uf) + " · estado</p>" +
      "<h3>" + esc(u.nome) + "</h3>" +
      '<p class="meta">Capital: <strong>' + esc(u.capital) + "</strong></p>" +
      '<p class="meta">Governador em exercício: <strong>' + esc(u.governador) + "</strong></p>" +
      '<p class="meta">' + esc(u.nota) + "</p>" +
      '<div class="sheet-actions">' +
        '<a class="button button-primary" href="/politica/mapa/?uf=' + esc(u.uf) + '">Contas do estado e das prefeituras →</a>' +
        '<button class="button button-ghost" type="button" id="load-mun">Ver municípios</button>' +
        '<a class="ext" href="' + ibgeUrl(u.uf, u.capital) + '" target="_blank" rel="noreferrer">IBGE da capital ↗</a>' +
        '<a class="ext" href="https://resultados.tse.jus.br/" target="_blank" rel="noreferrer">Votos no TSE ↗</a>' +
        '<a class="ext" href="#parlamentares" id="filter-uf">Parlamentares deste estado</a>' +
      "</div>" +
      '<ul class="mun-list" id="mun-list" hidden></ul>';
    $("#load-mun").addEventListener("click", () => loadMunis(u.uf));
    $("#filter-uf").addEventListener("click", () => {
      const sel = $("#f-uf");
      if (sel) { sel.value = u.uf; sel.dispatchEvent(new Event("change", { bubbles: true })); }
    });
    if (!silent) {
      const q = $("#mun-q");
      if (q && !q.value) q.placeholder = "Buscar em " + u.nome + " ou no Brasil";
    }
  }

  function loadMunis(uf) {
    const list = $("#mun-list");
    if (!list) return;
    list.hidden = false;
    list.innerHTML = "<li><button type=\"button\" disabled>Carregando municípios do IBGE…</button></li>";
    ensureMunis().then(all => {
      const rows = all.filter(m => m.uf === uf).sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
      paintMunis(rows, list);
    }).catch(() => {
      list.innerHTML = '<li><button type="button" disabled>Não foi possível falar com o IBGE agora. Tente de novo.</button></li>';
    });
  }

  function paintMunis(rows, list) {
    const cut = rows.slice(0, 80);
    list.innerHTML = cut.map(m =>
      '<li><button type="button" data-id="' + m.id + '"><strong>' + esc(m.nome) + "</strong><small>" +
      esc(m.uf) + " · IBGE " + m.id + (m.micro ? " · " + esc(m.micro) : "") + "</small></button></li>"
    ).join("") || "<li><button type=\"button\" disabled>Nenhum município.</button></li>";
    if (rows.length > cut.length) {
      list.insertAdjacentHTML("beforeend", "<li><button type=\"button\" disabled>Mostrando 80 de " + rows.length + ". Afine a busca.</button></li>");
    }
    list.onclick = e => {
      const b = e.target.closest("button[data-id]");
      if (!b) return;
      const m = (munis || []).find(x => String(x.id) === b.getAttribute("data-id"));
      if (m) openMun(m);
    };
  }

  function openMun(m) {
    const sheet = $("#uf-sheet");
    if (!sheet) return;
    const tse = "https://www.tse.jus.br/eleicoes/eleicoes-2024";
    sheet.innerHTML =
      '<p class="role" style="color:var(--accent);font-family:DM Mono,monospace;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase">Município · ' + esc(m.uf) + "</p>" +
      "<h3>" + esc(m.nome) + "</h3>" +
      '<p class="meta">Código IBGE ' + m.id + (m.micro ? " · " + esc(m.micro) : "") + "</p>" +
      '<p class="meta">Prefeito e vereadores foram eleitos em 2024 (mandato até 2028). O placar da urna não é copiado para cá — o TSE é a fonte do voto.</p>' +
      '<div class="sheet-actions">' +
        '<a class="button button-primary" href="/politica/mapa/?m=' + m.id + '">Contas da prefeitura e quem governa →</a>' +
        '<a class="ext" href="' + ibgeUrl(m.uf, m.nome) + '" target="_blank" rel="noreferrer">Panorama IBGE ↗</a>' +
        '<a class="ext" href="' + tse + '" target="_blank" rel="noreferrer">Eleição municipal 2024 ↗</a>' +
        '<a class="ext" href="https://resultados.tse.jus.br/" target="_blank" rel="noreferrer">Eleições 2026 ↗</a>' +
        '<button class="button button-ghost" type="button" id="back-uf">Voltar ao estado</button>' +
      "</div>";
    $("#back-uf").addEventListener("click", () => selectUf(m.uf));
    sheet.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function openMunByName(nome, uf) {
    ensureMunis().then(all => {
      const m = all.find(x => x.uf === uf && slug(x.nome) === slug(nome));
      if (m) openMun(m);
      else selectUf(uf);
    }).catch(() => selectUf(uf));
  }

  function ensureMunis() {
    if (munis) return Promise.resolve(munis);
    if (munisPromise) return munisPromise;
    munisPromise = fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios")
      .then(r => { if (!r.ok) throw new Error("ibge"); return r.json(); })
      .then(arr => {
        munis = arr.map(m => ({
          id: m.id,
          nome: m.nome,
          uf: m.microrregiao && m.microrregiao.mesorregiao && m.microrregiao.mesorregiao.UF
            ? m.microrregiao.mesorregiao.UF.sigla
            : (m["regiao-imediata"] && m["regiao-imediata"]["regiao-intermediaria"] && m["regiao-imediata"]["regiao-intermediaria"].UF
              ? m["regiao-imediata"]["regiao-intermediaria"].UF.sigla : ""),
          micro: m.microrregiao ? m.microrregiao.nome : ""
        })).filter(m => m.uf);
        return munis;
      });
    return munisPromise;
  }

  function bindSearch() {
    const q = $("#mun-q");
    if (!q) return;
    let t;
    q.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const n = q.value.trim().toLowerCase();
        const list = $("#mun-list");
        if (!list) return;
        if (n.length < 2) { list.hidden = true; return; }
        list.hidden = false;
        list.innerHTML = "<li><button type=\"button\" disabled>Consultando o IBGE…</button></li>";
        ensureMunis().then(all => {
          const rows = all.filter(m => m.nome.toLowerCase().includes(n) || (m.uf + " " + m.nome).toLowerCase().includes(n));
          paintMunis(rows, list);
        }).catch(() => {
          list.innerHTML = '<li><button type="button" disabled>IBGE indisponível neste momento.</button></li>';
        });
      }, 220);
    });
  }

  function bindMap() {
    const host = $("#br-map");
    if (!host) return;
    fetch("mapa.svg").then(r => r.text()).then(svg => {
      host.innerHTML = svg;
      const root = host.querySelector("svg");
      if (root) {
        // role="img" esconderia os estados (botões) de leitores de tela
        root.setAttribute("role", "group");
        root.setAttribute("aria-label", "Mapa do Brasil: escolha um estado");
        root.removeAttribute("aria-labelledby");
      }
      host.querySelectorAll(".state").forEach(el => {
        el.setAttribute("tabindex", "0");
        el.setAttribute("role", "button");
        el.setAttribute("aria-label", el.id);
        const go = () => selectUf(el.id);
        el.addEventListener("click", go);
        el.addEventListener("keydown", e => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
        });
      });
      labelStates();
      selectUf(ufAtual, true);
    }).catch(() => {
      host.innerHTML = '<p class="err">Mapa não carregou. Use a lista de estados abaixo.</p>';
    });
  }

  fetch("data/governo.json").then(r => r.json()).then(renderGoverno).catch(() => {
    const box = $("#exec-body");
    if (box) box.innerHTML = '<p class="err">Não foi possível abrir o gabinete. Veja a <a href="https://www.gov.br/planalto/pt-br/conheca-a-presidencia/ministros-e-ministras" target="_blank" rel="noreferrer">lista oficial do Planalto</a>.</p>';
  });
  fetch("data/ufs.json").then(r => r.json()).then(renderUfs).catch(() => {});
  bindMap();
  bindSearch();
})();
