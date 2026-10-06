/* Política em dados abertos — Câmara dos Deputados e Senado Federal */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const CAMARA_API = 'https://dadosabertos.camara.leg.br/api/v2';
  const SENADO_API = 'https://legis.senado.leg.br/dadosabertos';
  const TZ = 'America/Sao_Paulo';
  const PAGE = 48;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const nf = new Intl.NumberFormat('pt-BR');
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  // Datas: carimbos com fuso (ISO "Z" / RSS) são convertidos para Brasília.
  // Datas "locais" das APIs (sem fuso) já estão no horário de Brasília e são apenas formatadas.
  const fmtZoned = (iso, withTime = true) => {
    const d = new Date(iso); if (isNaN(d)) return '';
    return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(d);
  };
  const fmtLocal = (s) => {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
    if (!m) return '';
    return `${m[3]}/${m[2]}/${m[1]}${m[4] ? ` ${m[4]}h${m[5]}` : ''}`;
  };

  const getJSON = async (url, { timeout = 15000 } = {}) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } finally { clearTimeout(t); }
  };
  const data = (name) => getJSON(`data/${name}.json`, { timeout: 20000 });

  const state = { all: [], filtered: [], shown: 0, meta: null, votacoes: null, votos: null, ceaps: null, props: null };
  const lazy = {}; // dados carregados sob demanda
  const once = (k, fn) => (lazy[k] ||= fn().catch((e) => { delete lazy[k]; throw e; }));

  // ---------- Avatares ----------
  const initials = (n) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const avatar = (p, eager = false) =>
    `<span class="avatar" aria-hidden="true" data-i="${esc(initials(p.n))}">${p.f ? `<img src="${esc(p.f)}" alt="" width="56" height="72" ${eager ? '' : 'loading="lazy"'} decoding="async" referrerpolicy="no-referrer">` : esc(initials(p.n))}</span>`;
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName === 'IMG' && img.parentElement?.classList.contains('avatar')) {
      const box = img.parentElement; box.textContent = box.dataset.i || '?';
    }
  }, true);

  const casaNome = (c) => (c === 'c' ? 'Câmara' : 'Senado');
  const partyName = (sig) => state.meta?.partidos?.[sig] || '';

  // ---------- Lista de parlamentares ----------
  const els = { q: $('#f-q'), casa: $('#f-casa'), part: $('#f-part'), uf: $('#f-uf'), grid: $('#grid'), count: $('#count'), more: $('#more') };

  function fillSelect(sel, values, labeler) {
    const cur = sel.value;
    sel.length = 1;
    for (const v of values) { const o = document.createElement('option'); o.value = v; o.textContent = labeler ? labeler(v) : v; sel.append(o); }
    sel.value = values.includes(cur) ? cur : '';
  }

  function applyFilters(resetPage = true) {
    const q = norm(els.q.value.trim()); const casa = els.casa.value; const part = els.part.value; const uf = els.uf.value;
    state.filtered = state.all.filter((p) => (!casa || p.c === casa) && (!part || p.p === part) && (!uf || p.uf === uf) && (!q || p.k.includes(q)));
    if (resetPage) { state.shown = 0; els.grid.innerHTML = ''; }
    renderMore();
    const nDep = state.filtered.filter((p) => p.c === 'c').length; const nSen = state.filtered.length - nDep;
    els.count.textContent = state.filtered.length
      ? `${nf.format(state.filtered.length)} parlamentar${state.filtered.length > 1 ? 'es' : ''} — ${nf.format(nDep)} deputado(s), ${nf.format(nSen)} senador(es)`
      : 'Nenhum parlamentar encontrado com esses filtros.';
    syncQuery();
  }

  function renderMore() {
    const next = state.filtered.slice(state.shown, state.shown + PAGE);
    const frag = document.createDocumentFragment();
    next.forEach((p, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<button type="button" class="parl-card" data-c="${p.c}" data-id="${p.id}" aria-label="Ver perfil de ${esc(p.n)}, ${esc(p.p)}-${esc(p.uf)}, ${casaNome(p.c)}">
        ${avatar(p, state.shown === 0 && i < 8)}
        <span><strong>${esc(p.n)}</strong>
          <span class="parl-meta"><span class="chip casa">${p.c === 'c' ? 'Dep.' : 'Sen.'}</span><span class="chip">${esc(p.p)}</span><span class="chip">${esc(p.uf)}</span></span>
        </span></button>`;
      frag.append(li);
    });
    els.grid.append(frag);
    state.shown += next.length;
    els.more.hidden = state.shown >= state.filtered.length;
    els.more.textContent = `Mostrar mais (${nf.format(state.filtered.length - state.shown)} restantes)`;
  }

  function syncQuery() {
    const u = new URL(location.href);
    for (const [k, el] of [['q', els.q], ['casa', els.casa], ['partido', els.part], ['uf', els.uf]]) {
      const v = el.value.trim(); v ? u.searchParams.set(k, v) : u.searchParams.delete(k);
    }
    history.replaceState(history.state, '', u);
  }

  let qTimer;
  els.q.addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(applyFilters, 120); });
  [els.casa, els.part, els.uf].forEach((el) => el.addEventListener('change', () => applyFilters()));
  $('#filters').addEventListener('reset', () => setTimeout(() => applyFilters(), 0));
  els.more.addEventListener('click', renderMore);
  els.grid.addEventListener('click', (e) => {
    const b = e.target.closest('.parl-card'); if (!b) return;
    openProfile(b.dataset.c, Number(b.dataset.id), b);
  });

  // ---------- Bancadas ----------
  function renderBars(list, casa, ul, totalEl) {
    const counts = {};
    list.forEach((p) => { counts[p.p] = (counts[p.p] || 0) + 1; });
    const rows = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const max = rows[0]?.[1] || 1;
    totalEl.textContent = `${nf.format(list.length)} cadeiras ocupadas · ${rows.length} legendas`;
    ul.innerHTML = rows.map(([sig, n]) => {
      const pct = ((n / list.length) * 100).toFixed(1).replace('.', ',');
      const nome = partyName(sig);
      return `<li><button type="button" class="bar-row" data-casa="${casa}" data-p="${esc(sig)}" aria-label="${esc(sig)}${nome ? ` (${esc(nome)})` : ''}: ${n} parlamentares, ${pct}% — filtrar lista" title="${esc(nome || sig)} — ${pct}%">
        <span class="lbl">${esc(sig)}</span><span class="bar-track"><span class="bar-fill" style="width:${((n / max) * 100).toFixed(2)}%"></span></span><span class="val">${n}</span></button></li>`;
    }).join('');
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.bar-row'); if (!b) return;
    els.q.value = ''; els.uf.value = ''; els.casa.value = b.dataset.casa; els.part.value = b.dataset.p;
    applyFilters();
    $('#parlamentares').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    $('#parlamentares').focus({ preventScroll: true });
  });

  // ---------- Tabs genéricas ----------
  function tabs(listSel, onChange) {
    const tl = $(listSel); const btns = [...tl.querySelectorAll('[role="tab"]')];
    const select = (b, focus) => {
      btns.forEach((x) => { const on = x === b; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; });
      $(`#${b.getAttribute('aria-controls')}`).setAttribute('aria-labelledby', b.id);
      if (focus) b.focus();
      onChange(b.dataset.k);
    };
    tl.addEventListener('click', (e) => { const b = e.target.closest('[role="tab"]'); if (b) select(b); });
    tl.addEventListener('keydown', (e) => {
      const i = btns.indexOf(document.activeElement); if (i < 0) return;
      let j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % btns.length; else if (e.key === 'ArrowLeft') j = (i - 1 + btns.length) % btns.length;
      else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = btns.length - 1;
      if (j !== null) { e.preventDefault(); select(btns[j], true); }
    });
  }


  // Lista com "mostrar mais" para não alongar demais a página
  const LIST_STEP = 8;
  function listHTML(items, render, extra = '') {
    const first = items.slice(0, LIST_STEP).map(render).join('');
    const rest = items.slice(LIST_STEP).map((x) => render(x).replace('<li class="item"', '<li class="item" hidden')).join('');
    return `<ul class="items">${first}${rest}</ul>${items.length > LIST_STEP ? `<div class="more-wrap"><button type="button" class="button button-ghost list-more" aria-expanded="false">Mostrar mais (${items.length - LIST_STEP})</button></div>` : ''}${extra}`;
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.list-more'); if (!b) return;
    const ul = b.closest('.tab-panel').querySelector('.items');
    const hidden = [...ul.querySelectorAll('li[hidden]')];
    const next = hidden.slice(0, LIST_STEP);
    next.forEach((li) => { li.hidden = false; });
    next[0]?.querySelector('h3')?.setAttribute('tabindex', '-1');
    next[0]?.querySelector('h3')?.focus({ preventScroll: true });
    const left = hidden.length - next.length;
    if (left > 0) b.textContent = `Mostrar mais (${left})`; else b.parentElement.remove();
  });

  // ---------- Votações ----------
  const VOTO_LABEL = { S: 'Sim', N: 'Não', A: 'Abstenção', O: 'Obstrução', P: 'Art. 17 (presidência)', V: 'Votou (voto secreto)' };
  const resultBadge = (ap) => ap === 1 ? '<span class="badge ok">Aprovada</span>' : ap === 0 ? '<span class="badge no">Rejeitada</span>' : '<span class="badge neutral">Sem resultado registrado</span>';

  function placarHTML(pl, map) {
    if (!pl) return '';
    const parts = map.filter(([k]) => pl[k]).map(([k, label, cls]) => ({ k, label, cls, n: pl[k] }));
    const total = parts.reduce((s, x) => s + x.n, 0);
    if (!total) return '';
    return `<div class="placar"><div class="placar-bar" role="img" aria-label="${esc(parts.map((x) => `${x.label}: ${x.n}`).join(', '))}">${parts.map((x) => `<span class="${x.cls}" style="width:${(x.n / total) * 100}%"></span>`).join('')}</div>
      <div class="placar-legend" aria-hidden="true">${parts.map((x) => `<span><i class="${x.cls}"></i>${esc(x.label)}: <b>${x.n}</b></span>`).join('')}</div></div>`;
  }
  const CAMARA_PLACAR = [['S', 'Sim', 'v-S'], ['N', 'Não', 'v-N'], ['A', 'Abstenção', 'v-A'], ['O', 'Obstrução', 'v-O']];
  const SENADO_PLACAR = [['Sim', 'Sim', 'v-S'], ['Não', 'Não', 'v-N'], ['Abstenção', 'Abstenção', 'v-A']];
  const propLinkCamara = (id) => `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${encodeURIComponent(id)}`;
  const materiaLinkSenado = (cm) => `https://www25.senado.leg.br/web/atividade/materias/-/materia/${encodeURIComponent(cm)}`;

  function votacaoCamaraHTML(v) {
    const secreta = v.pl && v.pl.V;
    return `<li class="item"><div class="item-top"><time>${esc(fmtLocal(v.dt))}</time>${v.pr ? `<span class="sig">${esc(v.pr.s)}</span>` : ''}${resultBadge(v.ap)}${v.nom ? `<span class="chip">${secreta ? 'secreta' : 'nominal'}</span>` : '<span class="chip">simbólica</span>'}</div>
      <h3>${esc(v.d)}</h3>
      ${v.ctx ? `<p>${esc(v.ctx)}</p>` : ''}
      ${v.pr?.e ? `<p><b>Proposição:</b> ${esc(v.pr.e)}</p>` : ''}
      ${secreta ? `<p class="note">Votação secreta: ${nf.format(v.pl.V)} deputados registraram voto, sem divulgação individual.</p>` : placarHTML(v.pl, CAMARA_PLACAR)}
      ${v.pr ? `<a class="ext" href="${propLinkCamara(v.pr.id)}" target="_blank" rel="noreferrer">Tramitação na Câmara ↗</a>` : ''}</li>`;
  }
  function votacaoSenadoHTML(v) {
    const res = v.r === 'A' ? '<span class="badge ok">Aprovada</span>' : v.r === 'R' ? '<span class="badge no">Rejeitada</span>' : '<span class="badge neutral">Sem resultado registrado</span>';
    return `<li class="item"><div class="item-top"><time>${esc(fmtLocal(v.dt))}</time><span class="sig">${esc(v.s || '')}</span>${res}<span class="chip">${v.sec ? 'secreta' : 'nominal'}</span></div>
      <h3>${esc(v.d)}</h3>
      ${v.e ? `<p>${esc(v.e)}</p>` : ''}
      ${v.sec ? `<p class="note">Votação secreta: ${nf.format(v.pl?.Votou || 0)} senadores registraram voto, sem divulgação individual.</p>` : placarHTML(v.pl, SENADO_PLACAR)}
      ${v.cm ? `<a class="ext" href="${materiaLinkSenado(v.cm)}" target="_blank" rel="noreferrer">Matéria no Senado ↗</a>` : ''}</li>`;
  }

  function renderVotacoes(k) {
    const pv = $('#pv'); const V = state.votacoes;
    if (!V) { pv.innerHTML = '<p class="err">Não foi possível carregar as votações agora. Tente recarregar a página.</p>'; return; }
    let html = '';
    if (k === 'cn') {
      const l = V.camara?.nominais || [];
      html = l.length ? listHTML(l, votacaoCamaraHTML, `<p class="note">Últimas ${l.length} votações nominais do Plenário da Câmara (placar calculado a partir dos votos individuais publicados pela API).</p>`) : '<p class="err">Nenhuma votação nominal no período consultado.</p>';
    } else if (k === 'ca') {
      const l = V.camara?.lista || [];
      html = l.length ? listHTML(l, votacaoCamaraHTML, `<p class="note">${l.length} deliberações mais recentes do Plenário, incluindo votações simbólicas (${nf.format(V.camara.totalPeriodo || l.length)} no período consultado).</p>`) : '<p class="err">Sem votações no período consultado.</p>';
    } else {
      const l = V.senado?.lista || [];
      html = l.length ? listHTML(l, votacaoSenadoHTML, `<p class="note">Votações nominais do Plenário do Senado nos últimos 180 dias (${nf.format(V.senado.totalPeriodo || l.length)} no total; exibindo até 40).</p>`) : '<p class="err">Sem votações nominais do Senado no período consultado.</p>';
    }
    pv.innerHTML = html;
  }

  // ---------- Proposições ----------
  function renderProps(k) {
    const pp = $('#pp'); const P = state.props;
    if (!P) { pp.innerHTML = '<p class="err">Não foi possível carregar as proposições agora.</p>'; return; }
    const l = (k === 'c' ? P.camara : P.senado) || [];
    if (!l.length) { pp.innerHTML = '<p class="err">Nenhuma proposição desses tipos nos últimos 30 dias.</p>'; return; }
    pp.innerHTML = listHTML(l, (p) => `<li class="item"><div class="item-top"><time>${esc(fmtLocal(p.dt))}</time><span class="sig">${esc(p.s)}</span>${p.st ? `<span class="chip">${esc(p.st.toLowerCase())}</span>` : ''}</div>
      <h3>${esc(p.e)}</h3>${p.au ? `<p><b>Autoria:</b> ${esc(p.au)}</p>` : ''}
      <a class="ext" href="${k === 'c' ? propLinkCamara(p.id) : materiaLinkSenado(p.cm)}" target="_blank" rel="noreferrer">${k === 'c' ? 'Ficha na Câmara' : 'Matéria no Senado'} ↗</a></li>`);
  }

  // ---------- Notícias ----------
  function renderNews(N) {
    const box = $('#news');
    if (!N) { box.innerHTML = '<p class="err">Não foi possível carregar as notícias agora.</p>'; return; }
    const site = { camara: 'https://www.camara.leg.br/noticias/', senado: 'https://www12.senado.leg.br/noticias' };
    box.innerHTML = ['camara', 'senado'].map((k) => {
      const f = N[k]; const its = f?.itens || [];
      return `<section class="news-col" aria-label="${esc(f?.fonte || k)}"><h3>${esc(f?.fonte || k)} <a href="${site[k]}" target="_blank" rel="noreferrer">Site ↗</a></h3>
        ${its.length ? `<ul class="news-list">${its.slice(0, 10).map((n) => `<li><a href="${esc(n.l)}" target="_blank" rel="noreferrer">${esc(n.t)}</a>${n.dt ? `<time datetime="${esc(n.dt)}">${esc(fmtZoned(n.dt))}</time>` : ''}${n.d ? `<p>${esc(n.d)}</p>` : ''}</li>`).join('')}</ul>` : '<p class="err">Feed indisponível na última atualização.</p>'}</section>`;
    }).join('');
  }

  // ---------- Perfil ----------
  const dlg = $('#profile'); const pfBody = $('#pf-body');
  let lastFocus = null; let currentKey = '';
  $('#pf-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => {
    currentKey = '';
    if (location.hash.startsWith('#perfil/')) history.replaceState(history.state, '', location.pathname + location.search);
    lastFocus?.focus?.();
  });

  const skel = (n = 3) => Array.from({ length: n }, (_, i) => `<div class="skeleton" style="width:${90 - i * 15}%"></div>`).join('');
  const dl = (rows) => `<dl class="pf-dl">${rows.filter(([, v]) => v).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  const age = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return ''; const now = new Date(); let a = now.getFullYear() - +m[1]; if (now.getMonth() + 1 < +m[2] || (now.getMonth() + 1 === +m[2] && now.getDate() < +m[3])) a--; return `${fmtLocal(iso)} (${a} anos)`; };

  function openProfile(c, id, opener) {
    const p = state.all.find((x) => x.c === c && x.id === id);
    if (!p) return;
    lastFocus = opener || document.activeElement;
    currentKey = `${c}/${id}`;
    const official = c === 'c' ? `https://www.camara.leg.br/deputados/${id}` : (p.url || `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${id}`);
    pfBody.innerHTML = `<div class="pf-head">${avatar(p, true)}<div>
        <h2 id="pf-name">${esc(p.n)}</h2>
        <p class="sub">${c === 'c' ? 'Deputado(a) federal' : 'Senador(a)'} · ${esc(p.p)}${partyName(p.p) ? ` (${esc(partyName(p.p))})` : ''} · ${esc(p.uf)}</p>
        <div class="pf-links"><a href="${esc(official)}" target="_blank" rel="noreferrer">Página oficial ↗</a>${p.e ? `<a href="mailto:${esc(p.e)}">${esc(p.e)}</a>` : ''}</div>
      </div></div>
      <section class="pf-sec" aria-labelledby="pf-info-h"><h3 id="pf-info-h">Informações</h3><div id="pf-info">${skel()}</div></section>
      <section class="pf-sec" aria-labelledby="pf-desp-h"><h3 id="pf-desp-h">${c === 'c' ? 'Despesas com a cota parlamentar (CEAP)' : 'Despesas com a cota parlamentar (CEAPS)'}</h3><div id="pf-desp">${skel()}</div></section>
      <section class="pf-sec" aria-labelledby="pf-vot-h"><h3 id="pf-vot-h">Votos recentes em plenário</h3><div id="pf-vot">${skel()}</div></section>`;
    if (!dlg.open) dlg.showModal();
    $('.profile-inner').scrollTop = 0;
    if (location.hash !== `#perfil/${currentKey}`) history.replaceState(history.state, '', `#perfil/${currentKey}`);
    const key = currentKey;
    const alive = () => key === currentKey && dlg.open;
    if (c === 'c') { infoDeputado(p, alive); despesasDeputado(p, alive); } else { infoSenador(p, alive); despesasSenador(p, alive); }
    votosRecentes(p, alive);
  }

  const failBox = (msg, link) => `<p class="err">${esc(msg)}${link ? ` <a href="${esc(link)}" target="_blank" rel="noreferrer">Ver na página oficial ↗</a>` : ''}</p>`;

  function infoDeputadoHTML(x, fonte) {
    return dl([
      ['Nome civil', esc(x.nc)],
      ['Nascimento', esc(age(x.nasc))],
      ['Naturalidade', x.mun ? esc(`${x.mun}${x.ufn ? ` (${x.ufn})` : ''}`) : ''],
      ['Escolaridade', esc(x.esc)],
      ['Situação', esc([x.sit, x.cond].filter(Boolean).join(' · '))],
      ['Gabinete', x.gab?.sala ? esc(`Sala ${x.gab.sala}, prédio ${x.gab.predio}${x.gab.tel ? ` · tel. (61) ${x.gab.tel}` : ''}`) : ''],
      ['Redes e site', x.redes?.length ? x.redes.map((u) => `<a href="${esc(u)}" target="_blank" rel="noreferrer">${esc(u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>`).join('<br>') : ''],
    ]) + (fonte ? `<p class="note">${esc(fonte)}</p>` : '');
  }

  async function infoDeputado(p, alive) {
    const box = () => $('#pf-info');
    try {
      const d = (await getJSON(`${CAMARA_API}/deputados/${p.id}`, { timeout: 10000 })).dados;
      if (!alive()) return;
      const s = d.ultimoStatus || {}; const g = s.gabinete || {};
      box().innerHTML = infoDeputadoHTML({
        nc: d.nomeCivil, nasc: d.dataNascimento, mun: d.municipioNascimento, ufn: d.ufNascimento, esc: d.escolaridade,
        sit: s.situacao, cond: s.condicaoEleitoral, gab: g.sala ? { sala: g.sala, predio: g.predio, tel: g.telefone } : null,
        redes: [...(d.redeSocial || []), d.urlWebsite].filter((u) => /^https?:\/\//.test(u || '')),
      });
    } catch (e) {
      // API ao vivo indisponível (rede ou CORS): usa o retrato gerado na atualização diária.
      try {
        const all = await once('detalhes', () => data('deputados-detalhes'));
        if (!alive()) return;
        const x = all[p.id];
        if (!x) throw new Error('sem dados');
        box().innerHTML = infoDeputadoHTML(x, `Consulta ao vivo indisponível; dados da última atualização (${fmtZoned(state.meta?.atualizadoEm)}).`);
      } catch (_) {
        if (alive()) box().innerHTML = failBox('Não foi possível consultar a API da Câmara agora.', `https://www.camara.leg.br/deputados/${p.id}`);
      }
    }
  }

  async function infoSenador(p, alive) {
    const box = () => $('#pf-info');
    const base = [
      ['Nome completo', esc(p.nc)],
      ['Participação', esc(p.part)],
      ['Mandato até', p.fim ? esc(fmtLocal(p.fim)) : ''],
      ['Bloco parlamentar', esc(p.bl)],
      ['Funções', esc([p.mesa ? 'Membro da Mesa' : '', p.lid ? 'Membro de liderança' : ''].filter(Boolean).join(' · '))],
    ];
    try {
      const j = await getJSON(`${SENADO_API}/senador/${p.id}.json`);
      if (!alive()) return;
      const P = j?.DetalheParlamentar?.Parlamentar || {}; const b = P.DadosBasicosParlamentar || {};
      box().innerHTML = dl([
        ...base.slice(0, 1),
        ['Nascimento', esc(age(b.DataNascimento))],
        ['Naturalidade', b.Naturalidade ? esc(`${b.Naturalidade}${b.UfNaturalidade ? ` (${b.UfNaturalidade})` : ''}`) : ''],
        ...base.slice(1),
        ['Gabinete', esc((b.EnderecoParlamentar || '').replace(/\s+/g, ' ').trim())],
      ]);
    } catch (e) {
      if (alive()) box().innerHTML = dl(base) + failBox('Detalhes adicionais indisponíveis (API do Senado não respondeu).', p.url);
    }
  }

  function despesasHTML({ total, n, tipos, meses, ano, parcial, fonteNota }) {
    const top = Object.entries(tipos).sort((a, b) => b[1] - a[1]);
    const max = top[0]?.[1] || 1;
    const mesesOrd = Object.entries(meses).map(([m, v]) => [+m, v]).sort((a, b) => b[0] - a[0]);
    const ult = mesesOrd[0];
    return `<div class="kpis">
        <div class="kpi"><b>${brl.format(total)}</b><span>total em ${ano}${parcial ? ' (parcial)' : ''}</span></div>
        <div class="kpi"><b>${nf.format(n)}</b><span>documentos</span></div>
        ${ult ? `<div class="kpi"><b>${brl.format(ult[1])}</b><span>último mês com registros (${MESES[ult[0] - 1]}/${ano})</span></div>` : ''}
      </div>
      <div class="hbar">${top.slice(0, 6).map(([t, v]) => `<span class="t" title="${esc(t)}">${esc(t.charAt(0) + t.slice(1).toLowerCase())}</span><span class="v">${brl.format(v)}</span><span class="track"><span style="width:${((v / max) * 100).toFixed(1)}%"></span></span>`).join('')}</div>
      <p class="note">${esc(fonteNota)}</p>`;
  }

  async function despesasDeputado(p, alive) {
    const box = () => $('#pf-desp');
    const ano = Number(new Intl.DateTimeFormat('en', { timeZone: TZ, year: 'numeric' }).format(new Date()));
    const leg = p.lg || 57;
    const fetchYear = async (y) => {
      const out = []; let parcial = false;
      for (let pg = 1; pg <= 6; pg++) {
        const j = await getJSON(`${CAMARA_API}/deputados/${p.id}/despesas?idLegislatura=${leg}&ano=${y}&itens=100&pagina=${pg}&ordem=DESC&ordenarPor=dataDocumento`, { timeout: 20000 });
        out.push(...(j.dados || []));
        const hasNext = (j.links || []).some((l) => l.rel === 'next');
        if (!hasNext) break;
        if (pg === 6) parcial = true;
      }
      return { out, parcial };
    };
    try {
      let y = ano; let r = await fetchYear(y);
      if (!r.out.length) { y = ano - 1; r = await fetchYear(y); }
      if (!alive()) return;
      if (!r.out.length) { box().innerHTML = failBox('Nenhuma despesa registrada na API para este mandato recentemente.', `https://www.camara.leg.br/deputados/${p.id}`); return; }
      const tipos = {}; const meses = {}; let total = 0;
      for (const d of r.out) { const v = Number(d.valorLiquido) || 0; total += v; tipos[d.tipoDespesa || 'Não informado'] = (tipos[d.tipoDespesa || 'Não informado'] || 0) + v; meses[d.mes] = (meses[d.mes] || 0) + v; }
      box().innerHTML = despesasHTML({ total, n: r.out.length, tipos, meses, ano: y, parcial: r.parcial, fonteNota: `Valores líquidos declarados na Cota para o Exercício da Atividade Parlamentar, consultados ao vivo na API da Câmara.${r.parcial ? ' Exibindo os 600 documentos mais recentes.' : ''}` });
    } catch (e) {
      try {
        const DD = await once('despDep', () => data('despesas-deputados'));
        if (!alive()) return;
        const o = DD.por?.[p.id];
        if (!o) throw new Error('sem dados');
        const tipos = {}; for (const [k, v] of Object.entries(o.tp)) tipos[DD.tipos[k] || 'Não informado'] = v;
        box().innerHTML = despesasHTML({ total: o.t, n: o.n, tipos, meses: o.m, ano: o.a, parcial: false, fonteNota: `Consulta ao vivo indisponível; valores líquidos da CEAP consolidados na última atualização (${fmtZoned(state.meta?.atualizadoEm)}).` });
      } catch (_) {
        if (alive()) box().innerHTML = failBox('Não foi possível consultar as despesas na API da Câmara agora.', `https://www.camara.leg.br/deputados/${p.id}`);
      }
    }
  }

  async function despesasSenador(p, alive) {
    const box = () => $('#pf-desp');
    try {
      const C = await once('ceaps', () => data('despesas-senado'));
      if (!alive()) return;
      const o = C.por?.[p.id];
      if (!o) { box().innerHTML = failBox(`Sem registros de CEAPS para este(a) senador(a) em ${C.ano}.`, p.url); return; }
      box().innerHTML = despesasHTML({ total: o.t, n: o.n, tipos: o.tp, meses: o.m, ano: C.ano, parcial: false, fonteNota: 'Valores reembolsados pela Cota para o Exercício da Atividade Parlamentar dos Senadores (CEAPS), dados administrativos do Senado, consolidados na atualização diária.' });
    } catch (e) {
      if (alive()) box().innerHTML = failBox('Dados de despesas indisponíveis no momento.', p.url);
    }
  }

  async function votosRecentes(p, alive) {
    const box = () => $('#pf-vot');
    try {
      const [V, VT] = await Promise.all([once('votacoes', () => data('votacoes')), once('votos', () => data('votos'))]);
      if (!alive()) return;
      if (p.c === 'c') {
        const list = V.camara?.nominais || []; const mine = VT.camara?.[p.id] || [];
        if (!list.length) { box().innerHTML = failBox('Sem votações nominais no período.'); return; }
        const rows = list.map((v, i) => ({ v, voto: mine[i] })).slice(0, 15);
        box().innerHTML = `<ul class="votes">${rows.map(({ v, voto }) => `<li><span>${esc(v.pr ? `${v.pr.s} — ` : '')}${esc(v.d.replace(/\s*Sim: \d+.*$/, ''))}<small>${esc(fmtLocal(v.dt))}</small></span><span class="vote-tag ${voto || ''}">${esc(voto ? (VOTO_LABEL[voto] || voto) : 'Sem registro')}</span></li>`).join('')}</ul>
          <p class="note">Últimas ${rows.length} votações nominais do Plenário. “Sem registro” significa que não há voto deste(a) deputado(a) na lista publicada pela Câmara (ausência, licença ou outro motivo não informado pela API).</p>`;
      } else {
        const list = V.senado?.lista || []; const mine = VT.senado?.[p.id] || []; const leg = V.senado?.legenda || {};
        if (!list.length) { box().innerHTML = failBox('Sem votações nominais no período.', p.url); return; }
        const rows = list.map((v, i) => ({ v, voto: mine[i] })).slice(0, 15);
        const cls = (s) => (s === 'Sim' ? 'S' : s === 'Não' ? 'N' : s === 'Abstenção' ? 'A' : '');
        box().innerHTML = `<ul class="votes">${rows.map(({ v, voto }) => `<li><span>${esc(v.s ? `${v.s} — ` : '')}${esc(v.d)}<small>${esc(fmtLocal(v.dt))}</small></span><span class="vote-tag ${cls(voto)}" ${voto && leg[voto] ? `title="${esc(leg[voto])}"` : ''}>${esc(voto ? (leg[voto] ? `${voto} · ${leg[voto]}` : voto) : 'Sem registro')}</span></li>`).join('')}</ul>
          <p class="note">Últimas ${rows.length} votações nominais do Plenário do Senado. Siglas conforme o Senado; “Votou” indica votação secreta.</p>`;
      }
    } catch (e) {
      if (alive()) box().innerHTML = failBox('Votos indisponíveis no momento.');
    }
  }

  function routeHash() {
    const m = location.hash.match(/^#perfil\/([cs])\/(\d+)$/);
    if (m && state.all.length) openProfile(m[1], Number(m[2]));
    else if (!m && dlg.open) dlg.close();
  }
  window.addEventListener('hashchange', routeHash);

  // ---------- Inicialização ----------
  async function init() {
    const [meta, dep, sen] = await Promise.allSettled([data('meta'), data('deputados'), data('senadores')]);
    state.meta = meta.status === 'fulfilled' ? meta.value : null;
    const D = dep.status === 'fulfilled' ? dep.value : [];
    const S = sen.status === 'fulfilled' ? sen.value : [];
    state.all = [
      ...D.map((p) => ({ ...p, c: 'c' })),
      ...S.map((p) => ({ ...p, c: 's' })),
    ].map((p) => ({ ...p, k: norm(`${p.n} ${p.nc || ''}`) })).sort((a, b) => a.n.localeCompare(b.n, 'pt-BR'));

    if (state.meta?.atualizadoEm) {
      const t = fmtZoned(state.meta.atualizadoEm);
      $('#st-upd').innerHTML = `<time datetime="${esc(state.meta.atualizadoEm)}">${esc(t)}</time>`;
      $('#ft-upd').textContent = t;
    }
    if (!state.all.length) {
      els.count.innerHTML = '<span class="err">Não foi possível carregar a lista de parlamentares. Verifique sua conexão e recarregue a página.</span>';
    } else {
      $('#st-dep').textContent = D.length ? nf.format(D.length) : '—';
      $('#st-sen').textContent = S.length ? nf.format(S.length) : '—';
      $('#st-part').textContent = nf.format(new Set(state.all.map((p) => p.p).filter((x) => x && !/^s\/?partido$/i.test(x))).size);
      fillSelect(els.part, [...new Set(state.all.map((p) => p.p))].sort((a, b) => a.localeCompare(b, 'pt-BR')), (s) => (partyName(s) ? `${s} — ${partyName(s)}` : s));
      fillSelect(els.uf, [...new Set(state.all.map((p) => p.uf))].sort());
      const u = new URL(location.href);
      els.q.value = u.searchParams.get('q') || '';
      for (const [k, el] of [['casa', els.casa], ['partido', els.part], ['uf', els.uf]]) { const v = u.searchParams.get(k); if (v && [...el.options].some((o) => o.value === v)) el.value = v; }
      applyFilters();
      renderBars(D, 'c', $('#bars-c'), $('#bc-total'));
      renderBars(S, 's', $('#bars-s'), $('#bs-total'));
      routeHash();
    }

    tabs('#votacoes .tabs', renderVotacoes);
    tabs('#proposicoes .tabs', renderProps);
    const [vot, props, news] = await Promise.allSettled([once('votacoes', () => data('votacoes')), data('proposicoes'), data('noticias')]);
    state.votacoes = vot.status === 'fulfilled' ? vot.value : null;
    state.props = props.status === 'fulfilled' ? props.value : null;
    renderVotacoes($('#votacoes [aria-selected="true"]').dataset.k);
    renderProps($('#proposicoes [aria-selected="true"]').dataset.k);
    renderNews(news.status === 'fulfilled' ? news.value : null);
  }
  init();
})();
