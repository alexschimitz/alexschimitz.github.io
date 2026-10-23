/* politica/busca.js — busca local da página inicial de /politica/ ("O que você quer saber sobre a política?").
   Procura, sem acentos e sem diferenciar maiúsculas, em:
   - deputados e senadores em exercício (data/deputados.json, data/senadores.json)
   - páginas e assuntos do portal (lista PAGINAS abaixo)
   - termos do dicionário (data/glossario.json)
   Filtros ficam na URL (?q=&tipo=&uf=&partido=) para poder compartilhar o link.
   O núcleo (norm, tokens, pontuar, buscar) também roda em Node para os testes (tests/politica). */
(function (root) {
  "use strict";
  function norm(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
  function tokens(s) { return norm(s).split(" ").filter(Boolean); }
  // Pontuação: todas as palavras da busca precisam aparecer (início de palavra); nome/título vale mais
  function pontuar(item, toks) {
    if (!toks.length) return 0;
    var t = " " + (item._t || (item._t = norm(item.titulo))) + " ";
    var x = " " + (item._x || (item._x = norm([item.titulo, item.sub, item.texto, item.partido, item.uf, item.cargo].join(" ")))) + " ";
    var s = 0;
    for (var i = 0; i < toks.length; i++) {
      var k = toks[i];
      if (t.indexOf(" " + k + " ") >= 0) s += 6;
      else if (t.indexOf(" " + k) >= 0) s += 4;
      else if (x.indexOf(" " + k + " ") >= 0) s += 2;
      else if (x.indexOf(" " + k) >= 0) s += 1;
      else return 0;
    }
    if (t.trim() === toks.join(" ")) s += 10;
    if (item.tipo === "pagina") s += 1;
    return s;
  }
  function buscar(itens, f) {
    f = f || {};
    var toks = tokens(f.q || "");
    var out = [];
    for (var i = 0; i < itens.length; i++) {
      var it = itens[i];
      if (f.tipo && it.tipo !== f.tipo) continue;
      if (f.uf && it.uf !== f.uf) continue;
      if (f.partido && norm(it.partido) !== norm(f.partido)) continue;
      var s = toks.length ? pontuar(it, toks) : ((f.uf || f.partido) && it.tipo === "politico" ? 1 : 0);
      if (s > 0) out.push({ s: s, it: it });
    }
    out.sort(function (a, b) { return b.s - a.s || a.it.titulo.localeCompare(b.it.titulo, "pt-BR"); });
    return out.map(function (o) { return o.it; });
  }
  function itemPolitico(p, casa) {
    var cargo = casa === "c" ? "Deputado(a) federal" : "Senador(a)";
    return { tipo: "politico", titulo: p.n, sub: cargo + " · " + (p.p || "sem partido") + " · " + (p.uf || ""), partido: p.p || "", uf: p.uf || "", cargo: cargo,
      texto: (p.nc || "") + (casa === "c" ? " deputado deputada camara" : " senador senadora senado"),
      url: "/politica/#perfil/" + casa + "/" + p.id, foto: p.f || "" };
  }
  // Páginas e assuntos: só aponta para páginas que existem
  var PAGINAS = [
    ["Políticos e mandatos", "/politica/politicos/", "Histórico de mandatos de qualquer político desde os anos 1980: cargos, partidos, anos.", "politico historico mandato vereador prefeito governador deputado estadual candidato"],
    ["Gastos públicos", "/politica/gastos/", "Para onde vai o dinheiro federal: áreas, órgãos, Presidência, cartão corporativo, viagens.", "dinheiro despesa gasto orcamento uniao governo federal"],
    ["Cota parlamentar (gastos de deputados e senadores)", "/politica/gastos/#congresso", "Quanto cada deputado e senador gastou da cota do mandato, com notas fiscais.", "ceap ceaps cota parlamentar reembolso verba indenizatoria beneficio auxilio"],
    ["Emendas parlamentares", "/politica/gastos/#emendas", "Dinheiro do orçamento indicado por deputados e senadores.", "emenda pix transferencia especial orcamento"],
    ["Cartão corporativo", "/politica/gastos/#cartao", "Gastos com cartão de pagamento do governo federal.", "cartao corporativo cpgf"],
    ["Viagens a serviço", "/politica/gastos/#viagens", "Diárias e passagens pagas pelo governo federal.", "viagem diaria passagem"],
    ["Salários e benefícios", "/politica/fontes/#salarios", "O que já existe no portal sobre salários, auxílios e cotas, e o que ainda está em construção.", "salario subsidio remuneracao auxilio moradia beneficio recusou"],
    ["Votações e leis", "/politica/leis/", "Leis que mudaram o país, quem criou e quem votou.", "lei votacao votou voto aprovado rejeitado"],
    ["Votações recentes do Congresso", "/politica/#votacoes", "Como cada parlamentar votou nas votações nominais recentes.", "votacao voto nominal plenario"],
    ["Propostas do Congresso", "/politica/propostas/", "Projetos de lei, PECs e outras propostas explicadas em linguagem simples.", "projeto pl pec plp proposta medida provisoria"],
    ["Promessas e planos de governo", "/politica/planos/", "Planos entregues ao TSE e o que foi cumprido, com fonte.", "promessa plano governo campanha cumprida"],
    ["Eleições", "/politica/eleicoes/", "Resultados por região, estado e cidade, e votos por partido.", "eleicao resultado voto urna turno tse"],
    ["Partidos no Congresso", "/politica/#partidos", "Bancadas de cada partido na Câmara e no Senado.", "partido bancada legenda"],
    ["Governo federal", "/politica/governo/", "Presidente, vice, ministros e medidas provisórias.", "presidente ministro ministerio vice"],
    ["Economia", "/politica/economia/", "PIB, inflação e desemprego desde 1988.", "pib inflacao desemprego economia ipca"],
    ["Mapa: seu estado e sua cidade", "/politica/mapa/", "Quem governa cada estado e município e como estão as contas.", "mapa estado cidade municipio prefeito governador contas"],
    ["Escândalos e crises", "/politica/escandalos/", "Casos documentados em cada mandato, com fontes.", "escandalo investigacao processo corrupcao crise"],
    ["Sigilos derrubados", "/politica/sigilos/", "Informações que estavam em sigilo e foram reveladas.", "sigilo 100 anos lai acesso informacao"],
    ["Checagem de fatos", "/politica/checagens/", "Frases de políticos conferidas com fontes: verdadeiro, falso, enganoso e outros resultados.", "checagem fato fake news verdade mentira falso debate declaracao"],
    ["Dicionário de termos", "/politica/glossario/", "Mais de 100 palavras da política explicadas em linguagem simples.", "glossario dicionario termo significado o que e"],
    ["Fontes e metodologia", "/politica/fontes/", "De onde vêm os dados, quando são atualizados e como conferir.", "fonte metodologia dados oficiais api atualizacao"]
  ].map(function (p) { return { tipo: "pagina", titulo: p[0], url: p[1], sub: p[2], texto: p[3], partido: "", uf: "" }; });
  function itemTermo(t) { return { tipo: "termo", titulo: t.nome, sub: t.explicacao, texto: (t.sinonimos || []).join(" ") + " " + t.categoria, url: "/politica/glossario/#" + t.id, id: t.id, partido: "", uf: "" }; }

  var API = { norm: norm, tokens: tokens, pontuar: pontuar, buscar: buscar, itemPolitico: itemPolitico, itemTermo: itemTermo, PAGINAS: PAGINAS };
  if (typeof module === "object" && module.exports) { module.exports = API; return; }
  root.PolBusca = API;

  // ---------- Interface ----------
  var doc = root.document, form = doc.getElementById("busca-form");
  if (!form) return;
  var F = { q: doc.getElementById("busca-q"), tipo: doc.getElementById("busca-tipo"), uf: doc.getElementById("busca-uf"), partido: doc.getElementById("busca-partido") };
  var out = doc.getElementById("busca-res"), st = doc.getElementById("busca-status");
  var ITENS = PAGINAS.slice(), falhas = [];
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function get(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + " HTTP " + r.status); return r.json(); }); }
  var ROT = { politico: "Político", pagina: "Página", termo: "Termo" };

  function lerURL() {
    var p = new URLSearchParams(location.search);
    F.q.value = p.get("q") || ""; F.tipo.value = p.get("tipo") || "";
    F.uf.dataset.v = p.get("uf") || ""; F.partido.dataset.v = p.get("partido") || "";
  }
  function gravarURL() {
    var p = new URLSearchParams(location.search);
    [["q", F.q.value.trim()], ["tipo", F.tipo.value], ["uf", F.uf.value], ["partido", F.partido.value]].forEach(function (kv) { if (kv[1]) p.set(kv[0], kv[1]); else p.delete(kv[0]); });
    var s = p.toString();
    history.replaceState(history.state, "", location.pathname + (s ? "?" + s : "") + location.hash);
  }
  function render() {
    var f = { q: F.q.value, tipo: F.tipo.value, uf: F.uf.value, partido: F.partido.value };
    var vazio = !f.q.trim() && !f.uf && !f.partido;
    if (vazio) { out.innerHTML = ""; st.textContent = "Digite um nome, partido, estado, cargo ou assunto."; return; }
    var r = buscar(ITENS, f), N = 30;
    var hist = f.q.trim() ? '<li class="busca-item busca-hist"><a href="/politica/politicos/?q=' + encodeURIComponent(f.q.trim()) + (f.uf ? "&uf=" + encodeURIComponent(f.uf) : "") +
      '"><span class="busca-tag">Histórico</span><strong>Procurar “' + esc(f.q.trim()) + '” em todos os políticos eleitos desde os anos 1980</strong><span>Vereadores, prefeitos, deputados estaduais, governadores e mais (dados do TSE).</span></a></li>' : "";
    out.innerHTML = r.slice(0, N).map(function (it) {
      var ico = it.tipo === "politico" && root.PolFoto ? root.PolFoto.html(it.foto, it.titulo, "", "busca-foto") : "";
      return '<li class="busca-item busca-' + it.tipo + '"><a href="' + esc(it.url) + '">' + ico + '<span class="busca-tag">' + ROT[it.tipo] + "</span><strong>" + esc(it.titulo) + "</strong><span>" + esc(it.sub) + "</span></a></li>";
    }).join("") + hist;
    st.textContent = (r.length ? r.length + (r.length === 1 ? " resultado" : " resultados") + (r.length > N ? " (mostrando os " + N + " primeiros)" : "") : "Nenhum resultado entre parlamentares em exercício, páginas e termos.") +
      (falhas.length ? " Atenção: parte dos dados não carregou (" + falhas.join(", ") + "); os resultados podem estar incompletos." : "");
  }
  var tmr = null;
  function agendar() { clearTimeout(tmr); tmr = setTimeout(function () { gravarURL(); render(); }, 150); }
  lerURL();
  form.addEventListener("submit", function (e) { e.preventDefault(); gravarURL(); render(); out.querySelector("a") && st.focus(); });
  F.q.addEventListener("input", agendar);
  [F.tipo, F.uf, F.partido].forEach(function (s) { s.addEventListener("change", agendar); });
  doc.querySelectorAll("[data-busca]").forEach(function (a) {
    a.addEventListener("click", function (e) { e.preventDefault(); F.q.value = a.getAttribute("data-busca"); F.tipo.value = ""; F.uf.value = ""; F.partido.value = ""; gravarURL(); render(); F.q.focus(); });
  });
  st.textContent = "Carregando dados…"; form.setAttribute("aria-busy", "true");

  var pDep = get("/politica/data/deputados.json").then(function (a) { return a.map(function (p) { return itemPolitico(p, "c"); }); }).catch(function () { falhas.push("deputados"); return []; });
  var pSen = get("/politica/data/senadores.json").then(function (a) { return a.map(function (p) { return itemPolitico(p, "s"); }); }).catch(function () { falhas.push("senadores"); return []; });
  var pGl = (root.PolGlossario ? root.PolGlossario.ready : get("/politica/data/glossario.json")).then(function (j) { return (j.termos || []).map(itemTermo); }).catch(function () { falhas.push("dicionário"); return []; });
  Promise.all([pDep, pSen, pGl]).then(function (rs) {
    ITENS = PAGINAS.concat(rs[0], rs[1], rs[2]);
    var ufs = {}, parts = {};
    rs[0].concat(rs[1]).forEach(function (p) { if (p.uf) ufs[p.uf] = 1; if (p.partido) parts[p.partido] = 1; });
    F.uf.insertAdjacentHTML("beforeend", Object.keys(ufs).sort().map(function (u) { return "<option>" + esc(u) + "</option>"; }).join(""));
    F.partido.insertAdjacentHTML("beforeend", Object.keys(parts).sort(function (a, b) { return a.localeCompare(b, "pt-BR"); }).map(function (u) { return "<option>" + esc(u) + "</option>"; }).join(""));
    F.uf.value = F.uf.dataset.v; F.partido.value = F.partido.dataset.v;
    form.removeAttribute("aria-busy");
    render();
  });
})(typeof window !== "undefined" ? window : globalThis);
