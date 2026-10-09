/* politica/sigilos/sigilos.js — casos de sigilos derrubados, revistos ou mantidos */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var norm = function (s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); };
  var Y = document.getElementById("year"); if (Y) Y.textContent = new Date().getFullYear();
  var ST = { derrubado: ["Derrubado", "ok"], revisto: ["Revisto", "warn"], mantido: ["Ainda em sigilo", "no"] };
  var CASOS = [];
  // Frases curtas e diretas (mesmo conteúdo dos casos, sem juridiquês).
  var BRUTO = {
    "cgu-revisao-2023": {
      secreto: "Milhares de pedidos de informação negados entre 2019 e 2022.",
      quem: "Vários órgãos do governo Bolsonaro (a CGU confirmava as negativas).",
      caiu: "Em jan/2023 o novo governo mandou revisar; em fev/2023 a CGU publicou novas regras.",
      revelou: "Entrada no Planalto e gastos públicos, em regra, têm de ser abertos; 234 casos foram reexaminados."
    },
    "pazuello-exercito": {
      secreto: "O processo disciplinar do general Pazuello — escondido com “sigilo de 100 anos”.",
      quem: "Exército, em 2021.",
      caiu: "Em fev/2023 a CGU mandou entregar o extrato do processo.",
      revelou: "O Exército tinha arquivado o caso sem punir o general."
    },
    "cartao-presidencia": {
      secreto: "Onde a Presidência gastava com o cartão (loja, data e valor de cada compra).",
      quem: "Presidência da República, por “segurança do presidente”, até o fim do mandato.",
      caiu: "Em jan/2023 liberaram a planilha de 2003 a 2022.",
      revelou: "R$ 129 milhões em 20 anos — quase metade em hotéis. Os números estão em Gastos."
    },
    "visitas-planalto": {
      secreto: "Quem entra e sai do Palácio do Planalto e das residências oficiais.",
      quem: "Órgãos da Presidência.",
      caiu: "Em 2023 a CGU disse: esses registros são públicos.",
      revelou: "A regra mudou — agora dá pra pedir a lista de visitantes."
    },
    "orcamento-secreto": {
      secreto: "Qual deputado ou senador pedia cada emenda do “orçamento secreto”.",
      quem: "Regras do Congresso + execução no governo Bolsonaro.",
      caiu: "O STF derrubou em dez/2022.",
      revelou: "Quem pediu e quem recebeu o dinheiro tem de aparecer."
    },
    "bndes-jbs": {
      secreto: "Detalhes dos empréstimos do BNDES pra JBS (risco, saldo, hedge).",
      quem: "BNDES, alegando sigilo bancário.",
      caiu: "STF em 2015: dinheiro público não fica escondido do TCU.",
      revelou: "Os dados foram pro TCU fiscalizar."
    },
    "salarios-servidores": {
      secreto: "O salário de cada servidor público, com nome.",
      quem: "Era a prática até 2012.",
      caiu: "Decreto em 2012 + STF em 2015: salário de servidor é público.",
      revelou: "Hoje qualquer um vê no Portal da Transparência."
    },
    "fim-sigilo-eterno": {
      secreto: "Documentos ultrassecretos podiam ficar fechados pra sempre.",
      quem: "Decreto de 2002 (FHC) e lei de 2005 (Lula).",
      caiu: "A Lei de Acesso à Informação (2011, Dilma) acabou com o sigilo eterno.",
      revelou: "Prazo máximo hoje: 50 anos (25 + 25)."
    },
    "comissao-da-verdade": {
      secreto: "Documentos sobre mortes, desaparecimentos e torturas da ditadura.",
      quem: "Órgãos do Estado na ditadura e depois.",
      caiu: "A Comissão da Verdade (2011–2014) pôde requisitar até o que era secreto.",
      revelou: "434 mortos/desaparecidos e 377 agentes apontados."
    },
    "cgu-diretrizes-2024": {
      secreto: "Uso do “sigilo de 100 anos” pra negar pedidos de informação.",
      quem: "Órgãos federais, em vários governos.",
      caiu: "Em 2024 a CGU apertou as regras desse tipo de negativa.",
      revelou: "Não abriu um documento específico — mudou a regra pra daqui pra frente."
    },
    "negativas-hoje": {
      secreto: "Pedidos que ainda são negados todo ano, em todo governo.",
      quem: "Cada órgão que nega o pedido.",
      caiu: "Ainda não — alguns sigilos continuam legais.",
      revelou: "Dá pra ver quantos foram negados no Painel da LAI."
    }
  };
  function renderBruto() {
    var box = $("#bruto-lista"); if (!box) return;
    var stLabel = { derrubado: "Derrubado", revisto: "A regra mudou", mantido: "Ainda em sigilo" };
    box.innerHTML = CASOS.map(function (c) {
      var b = BRUTO[c.id] || {};
      var st = ST[c.status] || ["", "neutral"];
      return '<li class="bruto-card" id="bruto-' + esc(c.id) + '">' +
        '<div class="bruto-card-top"><span class="badge ' + st[1] + '">' + (stLabel[c.status] || st[0]) + '</span>' +
        '<span class="bruto-ano">' + esc(c.ano) + '</span></div>' +
        '<h3><a href="#' + esc(c.id) + '">' + esc(c.titulo) + '</a></h3>' +
        '<dl class="bruto-dl">' +
        '<div><dt>O que era secreto</dt><dd>' + esc(b.secreto || c.segredo) + '</dd></div>' +
        '<div><dt>Quem decretou</dt><dd>' + esc(b.quem || c.quem) + '</dd></div>' +
        '<div><dt>' + (c.status === "mantido" ? "Situação" : "O que caiu") + '</dt><dd>' + esc(b.caiu || c.quando) + '</dd></div>' +
        '<div><dt>' + (c.status === "mantido" ? "O que dá pra ver" : "O que revelaram") + '</dt><dd>' + esc(b.revelou || c.revelado) + '</dd></div>' +
        '</dl></li>';
    }).join("") || '<li class="bruto-card">Nenhum caso carregado.</li>';
  }

  fetch("../data/sigilos/sigilos.json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) {
    CASOS = j.casos || [];
    CASOS.forEach(function (c) { c._q = norm([c.titulo, c.tema, c.segredo, c.quem, c.quando, c.revelado, (c.governos || []).join(" ")].join(" ")); });
    CASOS.sort(function (a, b) { return (a.status === "mantido") - (b.status === "mantido") || b.ano - a.ano; });
    renderBruto();
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
  }).catch(function () { $("#lista").innerHTML = '<li class="err">Não foi possível carregar os casos agora. Tente recarregar a página.</li>'; var b = $("#bruto-lista"); if (b) b.innerHTML = '<li class="bruto-card err">Não foi possível carregar.</li>'; });
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
