/* Painel /politica/: "Governo agora" — presidente, vice e ministérios.
   Lê o conjunto conferido data/governo/atual.json (Planalto + checagem cruzada,
   mantido pela página /politica/governo/) e as datas oficiais da eleição.
   O mapa do Brasil fica em /politica/mapa/. */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);

  function esc(s) {
    // Monta as entidades em tempo de execução para o arquivo não quebrar
    // se um upload web decodificar & e aspas.
    const map = { "&": "amp", "<": "lt", ">": "gt", '"': "quot", "'": "#39" };
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return "&" + map[c] + ";";
    });
  }
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
      const rows = mins.filter(m => !n || (m.nome + " " + m.orgao + " " + (m.partido || "")).toLowerCase().includes(n));
      const cut = n || showAll ? rows : rows.slice(0, LIMIT);
      count.textContent = rows.length + " pasta" + (rows.length === 1 ? "" : "s");
      grid.innerHTML = cut.map(m =>
        "<li><small>" + esc(m.orgao) + "</small><strong>" + esc(m.nome) + "</strong>" + (m.partido ? "<span>" + esc(m.partido) + "</span>" : "") + (m.desde ? "<span>No cargo desde " + esc(m.desde) + "</span>" : "") + "</li>"
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

  // Gabinete: lê o conjunto conferido (data/governo/atual.json, Planalto + checagem
  // cruzada) e as datas oficiais da eleição (data/governo/eleicoes2026.json).
  // O arquivo antigo data/governo.json só entra se o conferido não abrir.
  const getJSON = u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
  function fromVerified(a, e, old) {
    const dia = iso => { if (!iso) return ""; const [y, m, d] = iso.split("-"); const ms = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"]; return (+d === 1 ? "1º" : +d) + " de " + ms[+m - 1] + " de " + y; };
    const pessoa = p => ({ nome: p.nome, partido: p.partido, cargo: p.cargo, desde: p.desdeTexto || dia(p.desde), url: p.url });
    const datas = (e && e.datas) || {};
    const ele = (old && old.eleicao2026) || {};
    return {
      presidente: pessoa(a.presidente),
      vice: pessoa(a.vice),
      ministros: (a.ministerios || []).map(m => ({ orgao: m.orgao, nome: m.nome, partido: m.partido && m.partido !== "Sem partido" ? m.partido : "", desde: m.desdeTexto || "" })),
      eleicao2026: {
        resumo: (ele.resumo ? ele.resumo + " " : "") + (datas.posse ? "A posse do próximo mandato é em " + dia(datas.posse) + "." : ""),
        links: [{ rotulo: "Eleição explicada", url: "/politica/governo/#eleicoes" }].concat(ele.links || [])
      },
      nota: a.nota + (a.verificadoEm ? " Conferido em " + a.verificadoEm.split("-").reverse().join("/") + "." : ""),
      fontes: a.fontes || []
    };
  }
  Promise.all([getJSON("data/governo/atual.json"), getJSON("data/governo/eleicoes2026.json").catch(() => null), getJSON("data/governo.json").catch(() => null)])
    .then(([a, e, old]) => renderGoverno(fromVerified(a, e, old)))
    .catch(() => getJSON("data/governo.json").then(renderGoverno))
    .catch(() => {
    const box = $("#exec-body");
    if (box) box.innerHTML = '<p class="err">Não foi possível abrir o gabinete. Veja a <a href="https://www.gov.br/planalto/pt-br/conheca-a-presidencia/ministros-e-ministras" target="_blank" rel="noreferrer">lista oficial do Planalto</a>.</p>';
  });
})();
