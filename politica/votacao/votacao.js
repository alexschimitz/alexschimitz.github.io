/* Página de uma votação nominal (?id=c-123 ou ?id=s-456) e lista de votações (sem id). */
(function () {
  'use strict';
  var V = window.PolVotos;
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var nf = new Intl.NumberFormat('pt-BR');
  var fmt = function (s) { var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };
  var CAMARA_API = 'https://dadosabertos.camara.leg.br/api/v2', SENADO_API = 'https://legis.senado.leg.br/dadosabertos';
  var status = $('#vt-status'), body = $('#vt-body');
  function getJSON(url) {
    var ctrl = new AbortController(); var t = setTimeout(function () { ctrl.abort(); }, 20000);
    return fetch(url, { signal: ctrl.signal }).then(function (r) { clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  function erro(msg) { status.textContent = ''; body.innerHTML = '<p class="err">' + esc(msg) + ' <a href="/politica/votacao/">Ver a lista de votações</a></p>'; }
  var tag = function (cat) { return '<span class="vote-tag vc-' + cat + '">' + esc(V.rotulo(cat)) + '</span>'; };
  var casaNome = function (c) { return c === 'c' ? 'Câmara dos Deputados' : 'Senado Federal'; };
  var resultado = function (r) { return r === 'A' ? '<span class="badge ok">Aprovada</span>' : r === 'R' ? '<span class="badge no">Rejeitada</span>' : ''; };

  var id = new URL(location.href).searchParams.get('id') || '';
  var m = /^([cs])-([\w-]+)$/.exec(id);
  getJSON('/politica/data/votos/idx.json').then(function (I) {
    if (id && !m) return erro('Identificador de votação inválido.');
    if (!m) return lista(I);
    var v = I.v.find(function (x) { return x.k === m[1] + ':' + m[2]; });
    if (!v) return erro('Esta votação não está entre as votações nominais coletadas.');
    return getJSON('/politica/data/votos/v/' + m[1] + '-' + m[2] + '.json').then(function (rows) { detalhe(I, v, m[1], rows); });
  }).catch(function () { erro('Não foi possível carregar os dados da votação agora. Tente novamente em instantes.'); });

  function detalhe(I, v, c, rows) {
    var titulo = (v.p ? v.p.s + ' — ' : '') + 'votação de ' + fmt(v.dt);
    document.title = titulo + ' — Política em dados abertos';
    $('#vt-crumb').textContent = v.p ? v.p.s : 'Votação de ' + fmt(v.dt);
    $('#vt-h1').innerHTML = esc(v.p ? v.p.s : 'Votação nominal') + ' <span>' + esc(fmt(v.dt)) + '</span>';
    $('#vt-lead').textContent = casaNome(c) + ' · Plenário · votação nominal';
    var cats = rows.map(function (r) { return V.classificar(c, r[4]); });
    var cont = {}; cats.forEach(function (k) { cont[k] = (cont[k] || 0) + 1; });
    var usadas = V.ORDEM.filter(function (k) { return cont[k]; });
    var placar = usadas.map(function (k) { return '<li><b>' + nf.format(cont[k]) + '</b>' + tag(k) + '</li>'; }).join('');
    var tabela = function (idx, rot) {
      var g = V.agrupar(c, rows, idx);
      return '<div class="vt-tabela-wrap" tabindex="0" role="region" aria-label="Votos por ' + rot + '"><table class="vt-tabela"><caption>Votos por ' + rot + '</caption><thead><tr><th scope="col">' + (idx === 2 ? 'Partido' : 'UF') + '</th><th scope="col">Total</th>' +
        usadas.map(function (k) { return '<th scope="col">' + esc(V.rotulo(k)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        g.map(function (x) { return '<tr><th scope="row">' + esc(x.k) + '</th><td>' + x.n + '</td>' + usadas.map(function (k) { return '<td>' + (x.c[k] || '–') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    };
    var oficial = c === 'c' ? CAMARA_API + '/votacoes/' + m[2] + '/votos' : SENADO_API + '/votacao?dataInicio=' + String(v.dt).slice(0, 10) + '&dataFim=' + String(v.dt).slice(0, 10);
    var ficha = v.p ? (c === 'c' ? 'https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=' + v.p.id : 'https://www25.senado.leg.br/web/atividade/materias/-/materia/' + v.p.id) : '';
    var partidos = [''].concat(Array.from(new Set(rows.map(function (r) { return r[2]; }))).sort());
    var ufs = [''].concat(Array.from(new Set(rows.map(function (r) { return r[3]; }))).sort());
    body.innerHTML =
      '<p><b>Resultado:</b> ' + (resultado(v.r) || 'não informado nos dados') + '</p>' +
      (v.p && v.p.e ? '<p><b>Assunto (ementa oficial):</b> ' + esc(v.p.e) + '</p>' : '') +
      '<p><b>O que foi votado:</b> ' + esc(v.d) + '</p>' +
      (v.t && v.t.length ? '<p class="note-sm"><b>Tema:</b> ' + esc(v.t.join(' · ')) + '</p>' : '') +
      (v.sec ? '<p class="note-sm"><span data-termo="votacao-secreta">Votação secreta</span>: os dados mostram quem votou, não como votou.</p>' : '') +
      '<h3 class="h-sm">Placar</h3><ul class="vt-placar">' + placar + '</ul>' +
      '<p class="note-sm">' + (c === 'c' ? 'A Câmara lista apenas quem registrou voto (inclusive obstrução e “Art. 17”, quem presidia). Quem não aparece não teve voto registrado, e os dados não dizem o motivo.' : 'O Senado informa também quem não votou e o motivo (licença, missão, atividade parlamentar, não comparecimento).') +
      ' <span data-termo="abstencao">Abstenção</span>, <span data-termo="obstrucao">obstrução</span> e <span data-termo="ausencia-votacao">ausência</span> são registros diferentes.</p>' +
      '<p class="vt-links"><a class="ext" href="' + esc(oficial) + '" target="_blank" rel="noreferrer">Dados oficiais da votação ↗</a>' + (ficha ? '<a class="ext" href="' + esc(ficha) + '" target="_blank" rel="noreferrer">' + (c === 'c' ? 'Ficha da proposta na Câmara' : 'Matéria no Senado') + ' ↗</a>' : '') + '</p>' +
      '<h3 class="h-sm">Por partido</h3>' + tabela(2, 'partido') +
      '<h3 class="h-sm">Por estado</h3>' + tabela(3, 'estado') +
      '<h3 class="h-sm">Voto de cada parlamentar</h3>' +
      '<form class="vt-busca" role="search" aria-label="Filtrar parlamentares"><label>Nome <input type="search" name="q" autocomplete="off"></label>' +
      '<label>Partido <select name="p">' + partidos.map(function (x) { return '<option value="' + esc(x) + '">' + (x ? esc(x) : 'Todos') + '</option>'; }).join('') + '</select></label>' +
      '<label>UF <select name="uf">' + ufs.map(function (x) { return '<option value="' + esc(x) + '">' + (x ? esc(x) : 'Todas') + '</option>'; }).join('') + '</select></label></form>' +
      '<p class="vt-count" id="vt-n" role="status" aria-live="polite"></p><ul class="vt-nomes" id="vt-nomes"></ul>' +
      '<p class="note-sm">Atualizado em ' + esc(new Date(I.atualizadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })) + ' (horário de Brasília). <a href="/politica/fontes/#votos">Fontes e metodologia</a></p>';
    var form = body.querySelector('.vt-busca');
    var ordenadas = rows.map(function (r, i) { return [r, cats[i]]; }).sort(function (a, b) { return String(a[0][1]).localeCompare(String(b[0][1]), 'pt-BR'); });
    var render = function () {
      var q = V.norm(form.q.value), p = form.p.value, uf = form.uf.value;
      var l = ordenadas.filter(function (x) { return (!q || V.norm(x[0][1]).indexOf(q) >= 0) && (!p || x[0][2] === p) && (!uf || x[0][3] === uf); });
      $('#vt-n').textContent = nf.format(l.length) + ' de ' + nf.format(rows.length) + ' parlamentares';
      $('#vt-nomes').innerHTML = l.length ? l.map(function (x) { var r = x[0]; return '<li><a href="/politica/#perfil/' + c + '/' + r[0] + '/votos">' + esc(r[1]) + '</a> <small>' + esc(r[2] + '-' + r[3]) + '</small> ' + tag(x[1]) + '</li>'; }).join('') : '<li class="empty-state">Ninguém com esses filtros.</li>';
    };
    form.addEventListener('input', render); form.addEventListener('submit', function (e) { e.preventDefault(); });
    render();
    status.textContent = nf.format(rows.length) + ' registros de voto carregados.';
  }

  function lista(I) {
    var u = new URL(location.href);
    var cob = I.cobertura;
    body.innerHTML = '<p class="note-sm">Cobertura: Câmara, ' + nf.format(cob.c.nominais) + ' votações nominais de ' + fmt(cob.c.primeira) + ' a ' + fmt(cob.c.ultima) + '; Senado, ' + nf.format(cob.s.nominais) + ' de ' + fmt(cob.s.primeira) + ' a ' + fmt(cob.s.ultima) + '. Votações simbólicas não têm registro individual e não aparecem. <a href="/politica/fontes/#votos">Metodologia</a></p>' +
      '<form class="vt-busca" role="search" aria-label="Filtrar votações"><label>Buscar <input type="search" name="q" autocomplete="off" placeholder="Ex.: PL 1087, imposto de renda"></label><label>Casa <select name="casa"><option value="">Câmara e Senado</option><option value="c">Câmara</option><option value="s">Senado</option></select></label></form>' +
      '<p class="vt-count" id="vt-n" role="status" aria-live="polite"></p><ul class="items" id="vt-lista"></ul><div class="more-wrap"><button type="button" class="button button-ghost" id="vt-mais">Mostrar mais</button></div>';
    var form = body.querySelector('form'); form.q.value = u.searchParams.get('q') || ''; form.casa.value = /^[cs]$/.test(u.searchParams.get('casa')) ? u.searchParams.get('casa') : '';
    var n = 30, l = [];
    var item = function (v) {
      return '<li class="item"><div class="item-top"><time>' + fmt(v.dt) + '</time><span class="chip">' + (v.k[0] === 'c' ? 'Câmara' : 'Senado') + '</span>' + (v.p ? '<span class="sig">' + esc(v.p.s) + '</span>' : '') + resultado(v.r) + '</div>' +
        '<p><a href="?id=' + esc(v.k.replace(':', '-')) + '">' + esc(v.d) + '</a></p>' + (v.p && v.p.e ? '<p class="note-sm">' + esc(v.p.e) + '</p>' : '') + '</li>';
    };
    var draw = function () { $('#vt-lista').innerHTML = l.length ? l.slice(0, n).map(item).join('') : '<li class="empty-state">Nenhuma votação encontrada.</li>'; $('#vt-mais').hidden = l.length <= n; $('#vt-n').textContent = nf.format(l.length) + ' votações'; };
    var render = function () {
      var q = V.norm(form.q.value), c = form.casa.value;
      var nu = new URL(location.href); nu.searchParams.delete('q'); nu.searchParams.delete('casa'); if (q) nu.searchParams.set('q', form.q.value); if (c) nu.searchParams.set('casa', c); history.replaceState(null, '', nu.pathname + nu.search);
      l = I.v.filter(function (v) { return (!c || v.k[0] === c) && (!q || V.norm([v.d, v.p && v.p.s, v.p && v.p.e, (v.t || []).join(' ')].join(' ')).indexOf(q) >= 0); });
      n = 30; draw();
    };
    form.addEventListener('input', render); form.addEventListener('submit', function (e) { e.preventDefault(); });
    $('#vt-mais').addEventListener('click', function () { n += 30; draw(); });
    render(); status.textContent = '';
  }
})();
