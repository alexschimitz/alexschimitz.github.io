/* politica/escandalos/escandalos.js — linha do tempo factual por presidente */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var norm = function (s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); };
  var Y = $("year"); if (Y) Y.textContent = new Date().getFullYear();
  var PERFIL = "/politica/politicos/#p/";
  var ST_TXT = { condenado: "Condenado", arquivado: "Arquivado", em_curso: "Em curso", sem_conclusao: "Sem conclusão" };
  var TIPO_TXT = { escandalo: "Escândalo", impeachment: "Impeachment", crise: "Crise", desastre: "Desastre" };
  var DATA = null, FLAT = [];

  function dataBR(iso) {
    if (!iso) return "—";
    var p = iso.split("-");
    if (p.length < 3) return iso;
    return p[2] + "/" + p[1] + "/" + p[0];
  }
  function chipSt(st) { return '<span class="esc-st st-' + st + '">' + esc(ST_TXT[st] || st) + "</span>"; }
  function chipTipo(t) { return '<span class="esc-tipo">' + esc(TIPO_TXT[t] || t) + "</span>"; }

  function flatten() {
    FLAT = [];
    DATA.presidentes.forEach(function (pr) {
      (pr.casos || []).forEach(function (c) {
        FLAT.push({ pr: pr, c: c });
      });
    });
    FLAT.sort(function (a, b) {
      var ay = a.c.ano, by = b.c.ano;
      if (ay !== by) return ay - by;
      return String(a.c.titulo).localeCompare(String(b.c.titulo), "pt");
    });
  }

  function filtrar() {
    var q = norm($("q").value.trim());
    var pid = $("f-pres").value;
    var st = $("f-status").value;
    var tipo = $("f-tipo").value;
    return FLAT.filter(function (x) {
      if (pid && x.pr.id !== pid) return false;
      if (st && x.c.status !== st) return false;
      if (tipo && x.c.tipo !== tipo) return false;
      if (!q) return true;
      var blob = [x.c.titulo, x.c.o_que, x.c.envolvidos, x.pr.nome, x.c.status_nota || ""].join(" ");
      return norm(blob).indexOf(q) >= 0;
    });
  }

  function renderLista() {
    var r = filtrar();
    $("count").textContent = r.length
      ? r.length + (r.length === 1 ? " caso" : " casos") + " com esses filtros."
      : "Nenhum caso com esses filtros.";
    if (!r.length) {
      $("lista").innerHTML = '<li class="esc-vazio">Nada aqui. <button type="button" class="linkish" id="limpar2">Limpar filtros</button></li>';
      var b = $("limpar2"); if (b) b.addEventListener("click", limpar);
      return;
    }
    $("lista").innerHTML = r.map(function (x) {
      var c = x.c, pr = x.pr;
      var ano = c.ano + (c.ano_fim && c.ano_fim !== c.ano ? '<small>até ' + c.ano_fim + "</small>" : "");
      var quem = pr.id_politico
        ? '<a href="' + PERFIL + esc(pr.id_politico) + '">' + esc(pr.nome) + "</a>"
        : esc(pr.nome);
      var fontes = (c.fontes || []).map(function (f) {
        return '<li><a href="' + esc(f.url) + '" target="_blank" rel="noreferrer">' + esc(f.titulo) + ' <span aria-hidden="true">↗</span></a></li>';
      }).join("");
      return '<li class="esc-item" id="c-' + esc(c.id) + '" data-pres="' + esc(pr.id) + '">' +
        '<div class="esc-ano">' + ano + "</div>" +
        '<div><div class="esc-item-top">' + chipSt(c.status) + chipTipo(c.tipo || "escandalo") + "</div>" +
        "<h3>" + esc(c.titulo) + "</h3>" +
        '<p class="esc-quem">' + quem + " · " + esc(pr.partido) + "</p>" +
        '<p class="esc-oqu">' + esc(c.o_que) + "</p>" +
        '<p class="esc-quem"><b>Quem:</b> ' + esc(c.envolvidos) + "</p>" +
        (c.status_nota ? '<p class="esc-nota"><b>Status:</b> ' + esc(c.status_nota) + "</p>" : "") +
        '<ul class="esc-fontes">' + fontes + "</ul></div></li>";
    }).join("");
  }

  function renderPres() {
    $("pres-lista").innerHTML = DATA.presidentes.map(function (pr) {
      var n = (pr.casos || []).length;
      var cts = { condenado: 0, arquivado: 0, em_curso: 0, sem_conclusao: 0 };
      (pr.casos || []).forEach(function (c) { if (cts[c.status] != null) cts[c.status]++; });
      var fim = pr.fim ? pr.fim.slice(0, 4) : "hoje";
      var linkNome = pr.id_politico
        ? '<a href="' + PERFIL + esc(pr.id_politico) + '">' + esc(pr.nome) + "</a>"
        : esc(pr.nome);
      return '<li id="p-' + esc(pr.id) + '"><h3><a href="#linha" data-pres="' + esc(pr.id) + '">' + esc(pr.nome) + "</a></h3>" +
        '<p class="muted">' + linkNome + " · " + esc(pr.partido) + "<br>" +
        pr.inicio.slice(0, 4) + "–" + fim + " · " + n + (n === 1 ? " caso" : " casos") + "</p>" +
        (pr.nota ? '<p class="esc-nota">' + esc(pr.nota) + "</p>" : "") +
        '<div class="esc-cts">' +
        (cts.condenado ? "<span>Condenado: <b>" + cts.condenado + "</b></span>" : "") +
        (cts.arquivado ? "<span>Arquivado: <b>" + cts.arquivado + "</b></span>" : "") +
        (cts.em_curso ? "<span>Em curso: <b>" + cts.em_curso + "</b></span>" : "") +
        (cts.sem_conclusao ? "<span>Sem conclusão: <b>" + cts.sem_conclusao + "</b></span>" : "") +
        "</div></li>";
    }).join("");
    $("pres-lista").addEventListener("click", function (e) {
      var a = e.target.closest("a[data-pres]");
      if (!a) return;
      e.preventDefault();
      $("f-pres").value = a.getAttribute("data-pres");
      renderLista();
      $("linha").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function limpar() {
    $("q").value = ""; $("f-pres").value = ""; $("f-status").value = ""; $("f-tipo").value = "";
    renderLista();
  }

  function abrirHash() {
    var h = (location.hash || "").replace(/^#/, "");
    if (!h) return;
    if (h.indexOf("p-") === 0) {
      var id = h.slice(2);
      if ($("f-pres").querySelector('option[value="' + id + '"]')) {
        $("f-pres").value = id; renderLista();
        var el = document.getElementById("p-" + id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } else if (h.indexOf("c-") === 0 || document.getElementById(h) || document.getElementById("c-" + h)) {
      var target = document.getElementById(h) || document.getElementById("c-" + h);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function stats() {
    var n = FLAT.length, cond = FLAT.filter(function (x) { return x.c.status === "condenado"; }).length;
    $("st-n").textContent = String(n);
    $("st-p").textContent = String(DATA.presidentes.length);
    $("st-c").textContent = String(cond);
    $("st-a").textContent = dataBR(DATA.revisado);
    if ($("aviso-txt")) $("aviso-txt").textContent = DATA.aviso || "";
  }

  fetch("../data/escandalos.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      DATA = d;
      flatten();
      stats();
      $("f-pres").innerHTML = '<option value="">Todos</option>' + DATA.presidentes.map(function (pr) {
        return '<option value="' + esc(pr.id) + '">' + esc(pr.nome) + "</option>";
      }).join("");
      $("f-status").innerHTML = '<option value="">Todos</option>' + Object.keys(ST_TXT).map(function (s) {
        return '<option value="' + s + '">' + ST_TXT[s] + "</option>";
      }).join("");
      renderPres();
      renderLista();
      var t = null;
      $("q").addEventListener("input", function () { clearTimeout(t); t = setTimeout(renderLista, 140); });
      ["f-pres", "f-status", "f-tipo"].forEach(function (id) { $(id).addEventListener("change", renderLista); });
      $("f-limpar").addEventListener("click", limpar);
      setTimeout(abrirHash, 0);
      window.addEventListener("hashchange", abrirHash);
    })
    .catch(function (e) {
      $("lista").innerHTML = '<li class="esc-vazio">Não deu para carregar os dados. (' + esc(e.message) + ")</li>";
    });
})();
