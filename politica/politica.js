/* Política em dados abertos — Câmara dos Deputados e Senado Federal */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const S = window.PolSimples;
  const SENADO_API = 'https://legis.senado.leg.br/dadosabertos';
  const CAMARA_API = 'https://dadosabertos.camara.leg.br/api/v2';
  const TZ = 'America/Sao_Paulo';
  const PAGE = 48;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const nf = new Intl.NumberFormat('pt-BR');
  const pct = (x) => `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: x < 10 ? 1 : 0 }).format(x)}%`;
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  // Datas: carimbos com fuso (ISO "Z" / RSS) são convertidos para Brasília.
  // Datas "locais" das APIs (sem fuso) já estão no horário de Brasília e são apenas formatadas.
  const fmtZoned = (iso, withTime = true) => {
    const d = new Date(iso); if (isNaN(d)) return '';
    return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(d);
  };
  const fmtLocal = (s, withTime = true) => {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
    if (!m) return '';
    return `${m[3]}/${m[2]}/${m[1]}${withTime && m[4] && m[4] + m[5] !== '0000' ? ` ${m[4]}h${m[5]}` : ''}`;
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

  const state = { all: [], byKey: new Map(), filtered: [], shown: 0, meta: null, votacoes: null, props: null, gastos: null, resumos: {} };
  const lazy = {};
  const once = (k, fn) => (lazy[k] ||= fn().catch((e) => { delete lazy[k]; throw e; }));
  const loadResumos = () => once('resumos', () => data('resumos-simples').catch(() => ({})));
  const loadGastos = () => once('gastos', () => data('gastos'));

  // ---------- Pequenos componentes ----------
  const money = (v, cls = '') => `<button type="button" class="money ${cls}" data-tip="Valor exato: ${esc(S.moneyExact(v))}" aria-label="${esc(S.moneySimple(v))} — valor exato ${esc(S.moneyExact(v))}">${esc(S.moneySimple(v))}</button>`;
  const term = (k, label) => { const g = S.GLOSS[k]; if (!g) return ''; return `<button type="button" class="term" data-term="${k}" aria-haspopup="dialog">${esc(label || `O que é ${g.s}?`)}</button>`; };
  const terms = (ks) => [...new Set(ks)].filter((k) => S.GLOSS[k]).map((k) => term(k)).join('');

  // ---------- Dica flutuante (valores exatos e glossário) ----------
  const tip = document.createElement('div');
  tip.className = 'pol-tip'; tip.id = 'pol-tip'; tip.hidden = true;
  let tipFor = null; let tipPinned = false;
  function showTip(btn, pinned) {
    let html;
    if (btn.dataset.term) {
      const g = S.GLOSS[btn.dataset.term];
      html = `<strong>${esc(g.s)}${g.n ? ` — ${esc(g.n)}` : ''}</strong><p>${esc(g.d)}</p><a href="#gl-${g.k}" class="tip-link">Ver no glossário</a>`;
      tip.setAttribute('role', 'dialog'); tip.setAttribute('aria-label', `O que é ${g.s}`);
    } else {
      html = esc(btn.dataset.tip); tip.setAttribute('role', 'tooltip'); tip.removeAttribute('aria-label');
    }
    const host = btn.closest('dialog') || document.body;
    if (tip.parentElement !== host) host.append(tip);
    tip.innerHTML = html; tip.hidden = false; tip.classList.toggle('rich', !!btn.dataset.term);
    if (tipFor && tipFor !== btn) tipFor.setAttribute('aria-expanded', 'false');
    tipFor = btn; tipPinned = pinned; btn.setAttribute('aria-expanded', 'true');
    if (!btn.dataset.term) btn.setAttribute('aria-describedby', 'pol-tip');
    const r = btn.getBoundingClientRect(); const vw = document.documentElement.clientWidth; const vh = window.innerHeight;
    tip.style.left = '0px'; tip.style.top = '0px';
    const w = tip.offsetWidth; const h = tip.offsetHeight;
    let left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), vw - w - 8);
    let top = r.bottom + 8; if (top + h > vh - 8 && r.top - h - 8 > 8) top = r.top - h - 8;
    tip.style.left = `${left}px`; tip.style.top = `${top}px`;
  }
  function hideTip() {
    if (!tipFor) return;
    tipFor.setAttribute('aria-expanded', 'false'); tipFor.removeAttribute('aria-describedby');
    tip.hidden = true; tipFor = null; tipPinned = false;
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.money, .term');
    if (b) { e.preventDefault(); e.stopPropagation(); if (tipFor === b && tipPinned) hideTip(); else showTip(b, true); return; }
    if (e.target.closest('.tip-link')) { const k = e.target.closest('.tip-link').getAttribute('href'); hideTip(); if (dlg.open) dlg.close(); setTimeout(() => { const el = $(k); if (el) { location.hash = k; el.focus?.({ preventScroll: true }); } }, 0); e.preventDefault(); return; }
    if (tipFor && !e.target.closest('.pol-tip')) hideTip();
  }, true);
  document.addEventListener('mouseover', (e) => { const b = e.target.closest('.money'); if (b && !tipPinned) showTip(b, false); });
  document.addEventListener('mouseout', (e) => { const b = e.target.closest('.money'); if (b && b === tipFor && !tipPinned && !b.contains(e.relatedTarget)) hideTip(); });
  document.addEventListener('focusin', (e) => { const b = e.target.closest?.('.money'); if (b && !tipPinned) showTip(b, false); });
  document.addEventListener('focusout', (e) => { if (tipFor && !tipPinned && e.target === tipFor) hideTip(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && tipFor) { const b = tipFor; hideTip(); b.focus(); e.stopPropagation(); e.preventDefault(); } }, true);
  window.addEventListener('scroll', () => { if (tipFor) hideTip(); }, { passive: true, capture: true });
  window.addEventListener('resize', () => { if (tipFor) hideTip(); });

  // ---------- Avatares ----------
  const initials = (n) => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const avatar = (p, eager = false, size = '') =>
    `<span class="avatar ${size}" aria-hidden="true" data-i="${esc(initials(p.n))}">${p.f ? `<img src="${esc(p.f)}" alt="" width="56" height="72" ${eager ? '' : 'loading="lazy"'} decoding="async" referrerpolicy="no-referrer">` : esc(initials(p.n))}</span>`;
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName === 'IMG' && img.parentElement?.classList.contains('avatar')) { const box = img.parentElement; box.textContent = box.dataset.i || '?'; }
  }, true);

  const casaNome = (c) => (c === 'c' ? 'Câmara' : 'Senado');
  const partyName = (sig) => state.meta?.partidos?.[sig] || '';
  const cargo = (c) => (c === 'c' ? 'deputado(a)' : 'senador(a)');

  // ---------- Lista de parlamentares ----------
  const els = { q: $('#f-q'), casa: $('#f-casa'), part: $('#f-part'), uf: $('#f-uf'), grid: $('#grid'), count: $('#count'), more: $('#more') };
  function fillSelect(sel, values, labeler) {
    const cur = sel.value; sel.length = 1;
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
    for (const [k, el] of [['q', els.q], ['casa', els.casa], ['partido', els.part], ['uf', els.uf]]) { const v = el.value.trim(); v ? u.searchParams.set(k, v) : u.searchParams.delete(k); }
    history.replaceState(history.state, '', u);
  }
  let qTimer;
  els.q.addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(applyFilters, 120); });
  [els.casa, els.part, els.uf].forEach((el) => el.addEventListener('change', () => applyFilters()));
  $('#filters').addEventListener('reset', () => setTimeout(() => applyFilters(), 0));
  els.more.addEventListener('click', renderMore);
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]'); if (!b) return;
    const [c, id, tab] = b.dataset.open.split('/');
    openProfile(c, Number(id), b, tab);
  });
  els.grid.addEventListener('click', (e) => { const b = e.target.closest('.parl-card'); if (b) openProfile(b.dataset.c, Number(b.dataset.id), b); });

  // ---------- Bancadas ----------
  function renderBars(list, casa, ul, totalEl) {
    const counts = {}; list.forEach((p) => { counts[p.p] = (counts[p.p] || 0) + 1; });
    const rows = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const max = rows[0]?.[1] || 1;
    totalEl.textContent = `${nf.format(list.length)} cadeiras ocupadas · ${rows.length} legendas`;
    ul.innerHTML = rows.map(([sig, n]) => {
      const pc = ((n / list.length) * 100).toFixed(1).replace('.', ','); const nome = partyName(sig);
      return `<li><button type="button" class="bar-row" data-casa="${casa}" data-p="${esc(sig)}" aria-label="${esc(sig)}${nome ? ` (${esc(nome)})` : ''}: ${n} parlamentares, ${pc}% — filtrar lista" title="${esc(nome || sig)} — ${pc}%">
        <span class="lbl">${esc(sig)}</span><span class="bar-track"><span class="bar-fill" style="width:${((n / max) * 100).toFixed(2)}%"></span></span><span class="val">${n}</span></button></li>`;
    }).join('');
  }
  const smooth = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.bar-row'); if (!b) return;
    els.q.value = ''; els.uf.value = ''; els.casa.value = b.dataset.casa; els.part.value = b.dataset.p;
    applyFilters(); $('#parlamentares').scrollIntoView({ behavior: smooth() }); $('#parlamentares').focus({ preventScroll: true });
  });

  // ---------- Tabs genéricas ----------
  function tabs(listSel, onChange, root = document) {
    const tl = $(listSel, root); const btns = [...tl.querySelectorAll('[role="tab"]')];
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
    return { select: (k) => { const b = btns.find((x) => x.dataset.k === k); if (b) select(b); } };
  }

  // Lista com "mostrar mais"
  const LIST_STEP = 8;
  function listHTML(items, render, extra = '', step = LIST_STEP) {
    const first = items.slice(0, step).map(render).join('');
    const rest = items.slice(step).map((x) => render(x).replace(/^\s*<li class="item/, '<li hidden class="item')).join('');
    return `<ul class="items">${first}${rest}</ul>${items.length > step ? `<div class="more-wrap"><button type="button" class="button button-ghost list-more" data-step="${step}" aria-expanded="false">Mostrar mais (${items.length - step})</button></div>` : ''}${extra}`;
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.list-more'); if (!b) return;
    const step = Number(b.dataset.step) || LIST_STEP;
    const ul = b.parentElement.previousElementSibling;
    const hidden = [...ul.querySelectorAll(':scope > li[hidden]')];
    const next = hidden.slice(0, step);
    next.forEach((li) => { li.hidden = false; });
    const h = next[0]?.querySelector('h3, h4, .rk-name');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    const left = hidden.length - next.length;
    if (left > 0) b.textContent = `Mostrar mais (${left})`; else b.parentElement.remove();
  });

  // ---------- Bloco "Em palavras simples" ----------
  const resumoKey = (casa, id) => (id ? `${casa}:${id}` : '');
  const sentenca = (s) => { const t = String(s || '').trim(); return t && !/[.!?…]$/.test(t) ? `${t}.` : t; };
  function simplesBox({ linhas = [], card = '', resumo = null, oficial = null, oficialRotulo = 'Texto oficial (ementa)', termos: ts = [] }) {
    const ls = linhas.filter(Boolean);
    return `<div class="simples">
      <p class="simples-h">Em palavras simples</p>
      ${ls.map((l) => `<p>${l}</p>`).join('')}
      ${card}
      ${resumo ? `<p class="resumo"><span class="tag">Resumo simplificado</span> ${esc(resumo)}</p>` : ''}
      ${oficial ? `<p class="oficial"><span class="tag">${esc(oficialRotulo)}</span> ${esc(oficial)}</p>` : ''}
      ${ts.length ? `<div class="terms">${terms(ts)}</div>` : ''}
    </div>`;
  }
  const tipoFrase = (sig) => { const t = S.tipoInfo(sig); return t ? `É ${t[1]}.` : ''; };
  const statusTexto = (st, tr) => {
    if (!st) return /apresenta/i.test(tr || '') ? 'acabou de ser apresentada e ainda não tem uma situação registrada.' : '';
    const s = S.statusSimples(st); return s ? `${s.charAt(0).toLowerCase()}${s.slice(1)}` : '';
  };
  const statusFrase = (st, tr) => { const s = statusTexto(st, tr); return s ? `Situação: ${s}` : ''; };

  // Resumo (escrito à mão ou automático) embutido pelo enrich (x.rs) ou, na falta, do arquivo resumos-simples.json
  function resumoDe(casa, id, x) {
    if (x?.rs) return x.rs;
    const h = state.resumos[resumoKey(casa, id)];
    if (h && typeof h === 'object' && h.ps) return { ps: h.ps, cf: h.cf || null, h: 1 };
    if (typeof h === 'string' && h) return { ps: h, cf: null, h: 1 };
    return null;
  }
  // Autoria: Câmara não separa autor principal de coautores (o 1º é quem assinou primeiro)
  function pessoaHTML(r) {
    const [nome, id, t, part, uf] = r;
    if (t === 'E') return '<b>Poder Executivo</b> (Presidência da República)';
    const p = (t === 'D' && id) ? state.byKey.get(`c/${id}`) : (t === 'S' && id) ? state.byKey.get(`s/${id}`) : null;
    if (p) return `<button type="button" class="linkish autor" data-open="${p.c}/${p.id}/projetos" aria-label="Ver perfil de ${esc(p.n)}">${esc(p.n)}</button> (${esc(p.p)}-${esc(p.uf)})`;
    const pre = t === 'D' && id ? 'Dep. ' : t === 'S' && id ? 'Sen. ' : '';
    return `<b>${esc(pre + nome)}</b>${part ? ` (${esc(part)}${uf ? `-${esc(uf)}` : ''})` : ''}`;
  }
  function autoriaHTML(casa, x, au) {
    const a = x?.a || [];
    if (a.length) {
      const n = Math.max(x.na || a.length, a.length);
      const resto = n - 1;
      let s = `apresentado por ${pessoaHTML(a[0])}`;
      if (resto === 1 && a[1]) s += ` e ${pessoaHTML(a[1])}`;
      else if (resto > 0) s += ` e mais ${nf.format(resto)}`;
      if (casa === 's' && x.cp) s += `. Chegou ao Senado vindo da Câmara dos Deputados (${esc(x.cp)})`;
      return s;
    }
    if (x?.ra) return `apresentado por <b>${esc(x.ra)}</b>`;
    if (au) { const t = au.length > 160 ? `${au.slice(0, 157).replace(/,[^,]*$/, '')} e outros` : au; return `apresentado por <b>${esc(t)}</b>`; }
    return '';
  }
  const temaChips = (x) => (x?.tg?.length ? `<span class="tema-chips">${x.tg.map((t) => `<span class="chip tema" title="${esc(`Tema oficial: ${(x.to || []).join('; ')}`)}">${esc(t)}</span>`).join('')}</span>` : '');
  // Cartão: [Tipo nº/ano], apresentado por … → Pra que serve → Como funciona → Situação → Ver texto oficial
  function propCard({ casa, id, sig, x, ementa, au, st, tr, votado = false, flat = false }) {
    const rs = resumoDe(casa, id, x);
    const autoria = autoriaHTML(casa, x, au);
    let cf;
    if (rs?.h) cf = rs.cf || 'O texto oficial disponível não deixa claro como a proposta funcionaria na prática. Veja o texto oficial abaixo.';
    else {
      const lc = (rs?.lc || []).filter((l) => !rs.ps.includes(l));
      cf = [tipoFrase(sig), lc.length ? `Pelo resumo oficial, mexe em ${lc.join(' e ')}.` : '', 'Este resumo automático usa só a ementa oficial; para conhecer os detalhes de como funcionaria, veja o texto oficial.'].filter(Boolean).join(' ');
    }
    const sit = statusTexto(st, tr);
    const ng = x?.ng ? `Gerou a ${x.ng}.` : '';
    const ps = rs?.ps || ementa || '';
    return `<div class="pc${flat ? ' pc-flat' : ''}">
      <p class="pc-head"><b class="pc-sig">${esc(sig || 'Proposta')}</b>${autoria ? `, ${autoria}` : ''}.</p>
      ${ps ? `<p><b>Pra que serve:</b> ${esc(sentenca(ps))}</p>` : ''}
      <p><b>Como funciona:</b> ${esc(cf)}</p>
      ${sit || ng ? `<p><b>Situação:</b> ${esc([sit, ng].filter(Boolean).join(' '))}</p>` : ''}
      <div class="pc-tags">${temaChips(x)}<span class="tag ${rs?.h ? '' : 'auto'}">${rs?.h ? 'Resumo simplificado' : 'Resumo automático'}</span></div>
      ${votado && rs?.h ? '<p class="note-sm">O resumo descreve a proposta; mudanças feitas durante a votação (emendas, substitutivos) podem ter alterado o texto final.</p>' : ''}
      ${ementa || x?.u ? `<details class="pc-oficial"><summary>Ver texto oficial</summary>${ementa ? `<p><span class="tag">Ementa oficial</span> ${esc(ementa)}</p>` : ''}${x?.u ? `<a class="ext" href="${esc(x.u)}" target="_blank" rel="noreferrer">Texto completo (inteiro teor) ↗</a>` : ''}</details>` : ''}
    </div>`;
  }

  // Filtro por tema (votações, proposições e projetos do perfil)
  const temaSel = {};
  const temaRender = {};
  const comTema = (scope, list, getX) => (temaSel[scope] ? list.filter((it) => getX(it)?.tg?.includes(temaSel[scope])) : list);
  function temaFilterHTML(scope, list, getX) {
    const cnt = {};
    list.forEach((it) => (getX(it)?.tg || []).forEach((t) => { cnt[t] = (cnt[t] || 0) + 1; }));
    const ts = Object.keys(cnt).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (!ts.length) return '';
    if (temaSel[scope] && !cnt[temaSel[scope]]) temaSel[scope] = '';
    const id = `tema-${scope}`;
    return `<div class="tema-filter"><label for="${id}">Filtrar por tema</label><select id="${id}" data-scope="${scope}"><option value="">Todos os temas (${nf.format(list.length)})</option>${ts.map((t) => `<option value="${esc(t)}"${temaSel[scope] === t ? ' selected' : ''}>${esc(t)} (${cnt[t]})</option>`).join('')}</select></div>`;
  }
  document.addEventListener('change', (e) => {
    const s = e.target.closest('.tema-filter select'); if (!s) return;
    const scope = s.dataset.scope; temaSel[scope] = s.value;
    temaRender[scope]?.();
    const again = document.getElementById(`tema-${scope}`); if (again) again.focus();
  });

  // ---------- Votações ----------
  const VOTO_LABEL = { S: 'Sim', N: 'Não', A: 'Abstenção', O: 'Obstrução', P: 'Presidindo (Art. 17)', V: 'Votou (voto secreto)' };
  const resultBadge = (ap, d) => /^mantid[oa] o texto/i.test(d || '') ? '<span class="badge ok">Texto mantido</span>' : ap === 1 ? '<span class="badge ok">Aprovada</span>' : ap === 0 ? '<span class="badge no">Rejeitada</span>' : '<span class="badge neutral">Sem resultado registrado</span>';
  function placarHTML(pl, map) {
    if (!pl) return '';
    const parts = map.filter(([k]) => pl[k]).map(([k, label, cls]) => ({ k, label, cls, n: pl[k] }));
    const total = parts.reduce((s, x) => s + x.n, 0); if (!total) return '';
    return `<div class="placar"><div class="placar-bar" role="img" aria-label="${esc(parts.map((x) => `${x.label}: ${x.n}`).join(', '))}">${parts.map((x) => `<span class="${x.cls}" style="width:${(x.n / total) * 100}%"></span>`).join('')}</div>
      <div class="placar-legend" aria-hidden="true">${parts.map((x) => `<span><i class="${x.cls}"></i>${esc(x.label)}: <b>${x.n}</b></span>`).join('')}</div></div>`;
  }
  const CAMARA_PLACAR = [['S', 'Sim', 'v-S'], ['N', 'Não', 'v-N'], ['A', 'Abstenção', 'v-A'], ['O', 'Obstrução', 'v-O']];
  const SENADO_PLACAR = [['Sim', 'Sim', 'v-S'], ['Não', 'Não', 'v-N'], ['Abstenção', 'Abstenção', 'v-A']];
  const propLinkCamara = (id) => `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${encodeURIComponent(id)}`;
  const materiaLinkSenado = (cm) => `https://www25.senado.leg.br/web/atividade/materias/-/materia/${encodeURIComponent(cm)}`;
  const descLimpa = (d) => String(d || '').replace(/\s*Sim: \d+.*$/, '').replace(/\s+\.\s*$/, '.').trim();

  function votoSimplesCamara(v) {
    const x = S.sentidoVotoCamara(v);
    const sobre = v.pr ? ` do ${esc(v.pr.s)}` : '';
    const linhas = [
      `Os deputados votaram ${esc(x.tema)}${x.tema === 'o projeto' || x.tema.startsWith('a mudança') || x.tema === 'a medida provisória' ? '' : sobre}${x.tema === 'o projeto' ? sobre : ''}.`,
      x.sim ? `<b>Sim</b> = ${esc(x.sim)}. <b>Não</b> = ${esc(x.nao)}.` : '',
      x.res ? esc(x.res) : '',
    ];
    return { linhas, termos: x.termos };
  }
  function votoSimplesSenado(v) {
    const x = S.sentidoVotoSenado(v);
    return { linhas: [`Os senadores votaram ${esc(x.tema)}${v.s && x.tema === 'o projeto' ? ` (${esc(v.s)})` : ''}.`, x.sim ? `<b>Sim</b> = ${esc(x.sim)}. <b>Não</b> = ${esc(x.nao)}.` : '', esc(x.res)], termos: x.termos };
  }

  function votacaoCamaraHTML(v) {
    const secreta = v.pl && v.pl.V;
    const vs = votoSimplesCamara(v);
    const card = v.pr ? `<p class="pc-k">Sobre a proposta votada</p>${propCard({ casa: 'c', id: v.pr.id, sig: v.pr.s, x: v.pr.x, ementa: v.pr.e, st: v.pr.st, tr: v.pr.tr, votado: true })}` : '';
    const tipoVot = v.nom ? (secreta ? 'secreta' : 'nominal') : 'simbolica';
    return `<li class="item"><div class="item-top"><time>${esc(fmtLocal(v.dt))}</time>${v.pr ? `<span class="sig">${esc(v.pr.s)}</span>` : ''}${resultBadge(v.ap, v.d)}<span class="chip">${tipoVot === 'simbolica' ? 'simbólica' : tipoVot}</span></div>
      <h3>${esc(descLimpa(v.d))}</h3>
      ${simplesBox({ linhas: vs.linhas, card, termos: [...vs.termos, tipoVot] })}
      ${v.ctx ? `<p class="note-sm"><b>Descrição oficial da votação:</b> ${esc(v.ctx)}</p>` : ''}
      ${secreta ? `<p class="note">Votação secreta: ${nf.format(v.pl.V)} deputados registraram voto, sem divulgação individual.</p>` : placarHTML(v.pl, CAMARA_PLACAR)}
      ${v.pr ? `<a class="ext" href="${propLinkCamara(v.pr.id)}" target="_blank" rel="noreferrer">Tramitação na Câmara ↗</a>` : ''}</li>`;
  }
  function votacaoSenadoHTML(v) {
    const res = v.r === 'A' ? '<span class="badge ok">Aprovada</span>' : v.r === 'R' ? '<span class="badge no">Rejeitada</span>' : '<span class="badge neutral">Sem resultado registrado</span>';
    const vs = votoSimplesSenado(v);
    const card = v.cm || v.e ? `<p class="pc-k">Sobre a proposta votada</p>${propCard({ casa: 's', id: v.cm, sig: v.s, x: v.x, ementa: v.e, st: v.st, votado: true })}` : '';
    return `<li class="item"><div class="item-top"><time>${esc(fmtLocal(v.dt))}</time><span class="sig">${esc(v.s || '')}</span>${res}<span class="chip">${v.sec ? 'secreta' : 'nominal'}</span></div>
      <h3>${esc(v.d)}</h3>
      ${simplesBox({ linhas: vs.linhas, card, termos: [...vs.termos, v.sec ? 'secreta' : 'nominal'] })}
      ${v.sec ? `<p class="note">Votação secreta: ${nf.format(v.pl?.Votou || 0)} senadores registraram voto, sem divulgação individual.</p>` : placarHTML(v.pl, SENADO_PLACAR)}
      ${v.cm ? `<a class="ext" href="${materiaLinkSenado(v.cm)}" target="_blank" rel="noreferrer">Matéria no Senado ↗</a>` : ''}</li>`;
  }
  const xVotCamara = (v) => v.pr?.x; const xVotSenado = (v) => v.x;
  function renderVotacoes(k) {
    const pv = $('#pv'); const V = state.votacoes;
    temaRender.vot = () => renderVotacoes(k);
    if (!V) { pv.innerHTML = '<p class="err">Não foi possível carregar as votações agora. Tente recarregar a página.</p>'; return; }
    let html = '';
    const bloco = (all, fn, getX, nota) => {
      const l = comTema('vot', all, getX);
      return `${temaFilterHTML('vot', all, getX)}${l.length ? listHTML(l, fn, nota) : '<p class="err">Nenhuma votação com esse tema na lista.</p>'}`;
    };
    if (k === 'cn') {
      const l = V.camara?.nominais || [];
      html = l.length ? bloco(l, votacaoCamaraHTML, xVotCamara, `<p class="note">Últimas ${l.length} votações nominais do Plenário da Câmara (placar calculado a partir dos votos individuais publicados pela API).</p>`) : '<p class="err">Nenhuma votação nominal no período consultado.</p>';
    } else if (k === 'ca') {
      const l = V.camara?.lista || [];
      html = l.length ? bloco(l, votacaoCamaraHTML, xVotCamara, `<p class="note">${l.length} deliberações mais recentes do Plenário, incluindo votações simbólicas (${nf.format(V.camara.totalPeriodo || l.length)} no período consultado).</p>`) : '<p class="err">Sem votações no período consultado.</p>';
    } else {
      const l = V.senado?.lista || [];
      html = l.length ? bloco(l, votacaoSenadoHTML, xVotSenado, `<p class="note">Votações nominais do Plenário do Senado nos últimos 180 dias (${nf.format(V.senado.totalPeriodo || l.length)} no total; exibindo até 40).</p>`) : '<p class="err">Sem votações nominais do Senado no período consultado.</p>';
    }
    pv.innerHTML = html + NOTA_RESUMO;
  }
  const NOTA_RESUMO = '<p class="note">Como ler os resumos: “Resumo simplificado” foi escrito à mão a partir do texto oficial (ementa e, quando disponível, o texto completo). “Resumo automático” é gerado por regras fixas a partir da ementa, sem interpretar. O texto oficial está sempre em “Ver texto oficial”. Na Câmara, o primeiro nome da autoria é o de quem assinou primeiro; a API não separa autor principal de coautores. Temas: classificação oficial da Câmara (temas) e do Senado (assuntos), agrupada em categorias simples.</p>';

  // ---------- Proposições ----------
  function propHTML(p, casa, { autoria = true } = {}) {
    const sig = S.sigla(p.s); const tp = S.tipoInfo(sig);
    const st = p.st || null;
    const quando = p.sd ? fmtLocal(p.sd, false) : '';
    const link = casa === 'c' ? propLinkCamara(p.id) : (p.cm ? materiaLinkSenado(p.cm) : p.url);
    const ts = [tp?.[0], 'tramitacao'];
    if (/relator/i.test(st || '')) ts.push('relator');
    if (/arquiv/i.test(st || '')) ts.push('arquivada');
    if (/parecer/i.test(st || '')) ts.push('parecer');
    if (/plen/i.test(st || '')) ts.push('plenario');
    const card = propCard({ casa, id: casa === 'c' ? p.id : p.cm, sig: p.s, x: p.x, ementa: p.e, au: autoria ? p.au : '', st, tr: p.tr, flat: true });
    return `<li class="item"><div class="item-top"><time title="Data de apresentação">${esc(fmtLocal(p.dt, false))}</time><span class="sig">${esc(p.s)}</span>${p.pa ? '<span class="chip">1º autor(a)</span>' : ''}${p.tram === false ? '<span class="chip">não tramita mais</span>' : ''}</div>
      ${simplesBox({ card, termos: ts })}
      ${!st && p.tr ? `<p class="note-sm"><b>Último andamento oficial:</b> ${esc(p.tr)}${p.org ? ` · ${esc(p.org)}` : ''}${quando ? ` · ${esc(quando)}` : ''}</p>` : ''}
      ${st ? `<p class="note-sm"><b>Situação oficial:</b> ${esc(st.charAt(0) + (st === st.toUpperCase() ? st.slice(1).toLowerCase() : st.slice(1)))}${p.org ? ` · ${esc(p.org)}` : ''}${quando ? ` · desde ${esc(quando)}` : ''}${p.tr && p.tr !== st ? `<br><b>Último andamento:</b> ${esc(p.tr)}` : ''}</p>` : ''}
      ${link ? `<a class="ext" href="${esc(link)}" target="_blank" rel="noreferrer">${casa === 'c' ? 'Ficha na Câmara' : 'Matéria no Senado'} ↗</a>` : ''}</li>`;
  }
  function renderProps(k) {
    const pp = $('#pp'); const P = state.props;
    temaRender.prop = () => renderProps(k);
    if (!P) { pp.innerHTML = '<p class="err">Não foi possível carregar as proposições agora.</p>'; return; }
    const all = (k === 'c' ? P.camara : P.senado) || [];
    if (!all.length) { pp.innerHTML = '<p class="err">Nenhuma proposição desses tipos nos últimos 30 dias.</p>'; return; }
    const l = comTema('prop', all, (p) => p.x);
    pp.innerHTML = `${temaFilterHTML('prop', all, (p) => p.x)}${l.length ? listHTML(l, (p) => propHTML(p, k)) : '<p class="err">Nenhuma proposição com esse tema na lista.</p>'}${NOTA_RESUMO}`;
  }

  // ---------- Gastos (visão geral e ranking) ----------
  function monthChart(m, ano, label) {
    const entries = Object.entries(m || {}).map(([k, v]) => [+k, v]).filter(([k]) => k >= 1 && k <= 12);
    if (!entries.length) return '';
    const last = Math.max(...entries.map(([k]) => k));
    const vals = Array.from({ length: last }, (_, i) => (m[i + 1] ?? m[String(i + 1)] ?? 0));
    const max = Math.max(...vals, 1);
    const aria = vals.map((v, i) => `${MESES[i]}: ${S.moneySimple(v)}`).join('; ');
    return `<figure class="mchart-wrap"><figcaption>${esc(label)} — por mês (${ano})</figcaption>
      <div class="mchart" role="img" aria-label="${esc(`${label} por mês em ${ano}: ${aria}`)}">${vals.map((v, i) => `<div class="mcol" title="${esc(`${MESES_LONGOS[i]}: ${S.moneyExact(v)}`)}"><span class="mbar" style="height:${Math.max(v > 0 ? 2 : 0, (v / max) * 100).toFixed(1)}%"></span><span class="mlbl">${MESES[i]}</span></div>`).join('')}</div>
      <details class="mtable"><summary>Ver valores de cada mês</summary><table><thead><tr><th scope="col">Mês</th><th scope="col">Valor</th></tr></thead><tbody>${vals.map((v, i) => `<tr><td>${MESES_LONGOS[i]}</td><td>${money(v)}</td></tr>`).join('')}</tbody></table></details>
    </figure>`;
  }
  function catBars(tp, total, max = 8) {
    const rows = Object.entries(tp).sort((a, b) => b[1] - a[1]);
    const top = rows[0]?.[1] || 1;
    const shown = rows.slice(0, max); const rest = rows.slice(max);
    const row = ([t, v]) => `<li><div class="cb-top"><span class="cb-name">${esc(S.categoria(t))}</span><span class="cb-val">${money(v)} <small>${total > 0 ? pct((v / total) * 100) : ''}</small></span></div>
      <span class="track"><span style="width:${Math.max(0, (v / top) * 100).toFixed(1)}%"></span></span><small class="cb-off">Nome oficial: ${esc(t)}</small></li>`;
    return `<ul class="catbars">${shown.map(row).join('')}</ul>${rest.length ? `<details class="more-cats"><summary>Ver outras ${rest.length} categorias</summary><ul class="catbars">${rest.map(row).join('')}</ul></details>` : ''}`;
  }
  // Estatísticas por casa a partir de gastos.json
  function casaStats(casa) {
    const G = state.gastos; if (!G || !G[casa]) return null;
    const list = Object.entries(G[casa]).map(([id, [t, n, ci]]) => ({ id: Number(id), t, n, ci }));
    list.sort((a, b) => b.t - a.t);
    const rank = new Map(list.map((x, i) => [x.id, i + 1]));
    const total = list.reduce((s, x) => s + x.t, 0);
    const sorted = [...list].map((x) => x.t).sort((a, b) => a - b);
    const med = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : 0;
    return { list, rank, total, avg: list.length ? total / list.length : 0, med, n: list.length, ano: G.ano?.[casa], cats: G.cat?.[casa] || [], tot: G.tot?.[casa] };
  }
  const statsCache = {};
  const stats = (casa) => (statsCache[casa] ||= casaStats(casa));

  function renderGastosGeral(casa) {
    const box = $('#gg'); const st = stats(casa);
    if (!st || !st.tot) { box.innerHTML = '<p class="err">Resumo de gastos indisponível no momento.</p>'; return; }
    const tp = {}; for (const [k, v] of Object.entries(st.tot.tp || {})) tp[st.cats[k] || 'Não informado'] = v;
    const quem = casa === 'c' ? 'deputados' : 'senadores';
    const lastM = Math.max(...Object.keys(st.tot.m || {}).map(Number).filter((x) => x <= 12), 0);
    box.innerHTML = `<p class="lead-simples">Em ${st.ano}, os ${nf.format(st.n)} ${quem} em exercício com gastos registrados usaram ${money(st.total)} da cota parlamentar ${term(casa === 'c' ? 'ceap' : 'ceaps', casa === 'c' ? '(CEAP)' : '(CEAPS)')}. Em média, ${money(st.avg)} por ${casa === 'c' ? 'deputado(a)' : 'senador(a)'}.</p>
      <div class="kpis">
        <div class="kpi"><b>${money(st.total)}</b><span>total em ${st.ano}${lastM ? ` (jan–${MESES[lastM - 1]})` : ''}</span></div>
        <div class="kpi"><b>${money(st.avg)}</b><span>média por ${casa === 'c' ? 'deputado(a)' : 'senador(a)'}</span></div>
        <div class="kpi"><b>${money(st.med)}</b><span>valor do meio (mediana)</span></div>
        <div class="kpi"><b>${nf.format(st.tot.n)}</b><span>notas e recibos</span></div>
      </div>
      <div class="g2">
        ${monthChart(st.tot.m, st.ano, `Gastos de todos os ${quem}`)}
        <div><h3 class="h-sm">Com o que gastaram</h3>${catBars(tp, st.total, 7)}</div>
      </div>
      <p class="note">Os meses mais recentes podem estar incompletos: notas e recibos podem ser apresentados e lançados depois. Valores ${casa === 'c' ? 'líquidos (descontadas glosas) da API da Câmara' : 'reembolsados, dos dados administrativos do Senado'}.</p>`;
  }

  const rk = { casa: $('#r-casa'), part: $('#r-part'), uf: $('#r-uf'), ord: $('#r-ord'), list: $('#rank'), count: $('#r-count') };
  function fillRankFilters() {
    const casa = rk.casa.value; const pool = state.all.filter((p) => p.c === casa);
    fillSelect(rk.part, [...new Set(pool.map((p) => p.p))].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    fillSelect(rk.uf, [...new Set(pool.map((p) => p.uf))].sort());
  }
  function renderRanking() {
    const casa = rk.casa.value; const st = stats(casa);
    if (!st) { rk.list.innerHTML = '<p class="err">Ranking indisponível no momento.</p>'; return; }
    const rows = st.list.map((x) => ({ ...x, p: state.byKey.get(`${casa}/${x.id}`) })).filter((x) => x.p && (!rk.part.value || x.p.p === rk.part.value) && (!rk.uf.value || x.p.uf === rk.uf.value));
    if (rk.ord.value === 'asc') rows.reverse();
    const max = st.list[0]?.t || 1;
    const filtro = [rk.part.value, rk.uf.value].filter(Boolean).join(' · ');
    rk.count.textContent = rows.length ? `${nf.format(rows.length)} ${casa === 'c' ? 'deputados' : 'senadores'}${filtro ? ` (${filtro})` : ''} · média da ${casaNome(casa)}: ${S.moneySimple(st.avg)} · ano ${st.ano}` : 'Ninguém com gastos registrados com esses filtros.';
    const sub = rows.length ? rows.reduce((s, x) => s + x.t, 0) / rows.length : 0;
    const li = (x) => {
      const r = st.rank.get(x.id); const cat = st.cats[x.ci];
      const comp = x.t >= st.avg ? `${pct(((x.t / st.avg) - 1) * 100)} acima da média` : `${pct((1 - x.t / st.avg) * 100)} abaixo da média`;
      return `<li class="item rk-row"><span class="rk-pos" aria-label="Posição ${r} de ${st.n}">${r}º</span>${avatar(x.p)}
        <div class="rk-main"><button type="button" class="rk-name" data-open="${casa}/${x.id}/gastos">${esc(x.p.n)}</button>
          <span class="parl-meta"><span class="chip">${esc(x.p.p)}</span><span class="chip">${esc(x.p.uf)}</span>${cat ? `<span class="rk-cat">Maior gasto: ${esc(S.categoria(cat))}</span>` : ''}</span>
          <span class="track"><span style="width:${((x.t / max) * 100).toFixed(1)}%"></span></span></div>
        <div class="rk-val">${money(x.t)}<small>${esc(comp)}</small></div></li>`;
    };
    rk.list.innerHTML = rows.length ? listHTML(rows, li, filtro && rows.length > 1 ? `<p class="note">Média do grupo filtrado: ${money(sub)}.</p>` : '', 20) : '';
    const u = new URL(location.href);
    for (const [k, el, def] of [['rcasa', rk.casa, 'c'], ['rpartido', rk.part, ''], ['ruf', rk.uf, ''], ['rordem', rk.ord, 'desc']]) { el.value && el.value !== def ? u.searchParams.set(k, el.value) : u.searchParams.delete(k); }
    history.replaceState(history.state, '', u);
  }
  rk.casa.addEventListener('change', () => { fillRankFilters(); renderRanking(); });
  [rk.part, rk.uf, rk.ord].forEach((el) => el.addEventListener('change', renderRanking));

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

  // ---------- Glossário ----------
  function renderGlossario() {
    $('#gloss').innerHTML = S.GLOSSARIO.map(([k, s, n, d]) => `<div class="gl-item" id="gl-${k}" tabindex="-1"><dt>${esc(s)}${n ? ` <span>${esc(n)}</span>` : ''}</dt><dd>${esc(d)}</dd></div>`).join('');
  }

  // ---------- Perfil ----------
  const dlg = $('#profile'); const pfBody = $('#pf-body');
  let lastFocus = null; let currentKey = ''; let pfTabs = null;
  $('#pf-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => {
    hideTip(); currentKey = '';
    if (location.hash.startsWith('#perfil/')) history.replaceState(history.state, '', location.pathname + location.search);
    lastFocus?.focus?.();
  });
  const skel = (n = 3) => Array.from({ length: n }, (_, i) => `<div class="skeleton" style="width:${90 - i * 15}%"></div>`).join('');
  const dl = (rows) => `<dl class="pf-dl">${rows.filter(([, v]) => v).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  const age = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return ''; const now = new Date(); let a = now.getFullYear() - +m[1]; if (now.getMonth() + 1 < +m[2] || (now.getMonth() + 1 === +m[2] && now.getDate() < +m[3])) a--; return `${fmtLocal(iso)} (${a} anos)`; };
  const failBox = (msg, link) => `<p class="err">${esc(msg)}${link ? ` <a href="${esc(link)}" target="_blank" rel="noreferrer">Ver na página oficial ↗</a>` : ''}</p>`;
  const loadParl = (c, id) => once(`parl-${c}-${id}`, () => data(`parl/${c}/${id}`));
  const PF_TABS = [['resumo', 'Resumo'], ['gastos', 'Gastos'], ['projetos', 'Projetos'], ['votos', 'Votos']];

  function openProfile(c, id, opener, tab = 'resumo') {
    const p = state.byKey.get(`${c}/${id}`); if (!p) return;
    if (!PF_TABS.some(([k]) => k === tab)) tab = 'resumo';
    lastFocus = opener || document.activeElement;
    const key = `${c}/${id}`;
    if (currentKey === key && dlg.open) { pfTabs?.select(tab); return; }
    currentKey = key;
    const official = c === 'c' ? `https://www.camara.leg.br/deputados/${id}` : (p.url || `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${id}`);
    pfBody.innerHTML = `<div class="pf-head">${avatar(p, true)}<div>
        <h2 id="pf-name">${esc(p.n)}</h2>
        <p class="sub">${c === 'c' ? 'Deputado(a) federal' : 'Senador(a)'} · ${esc(p.p)}${partyName(p.p) ? ` (${esc(partyName(p.p))})` : ''} · ${esc(p.uf)}</p>
        <div class="pf-links"><a href="${esc(official)}" target="_blank" rel="noreferrer">Página oficial ↗</a>${p.e ? `<a href="mailto:${esc(p.e)}">${esc(p.e)}</a>` : ''}</div>
      </div></div>
      <div class="tabs pf-tabs" role="tablist" aria-label="Seções do perfil">${PF_TABS.map(([k, l], i) => `<button type="button" role="tab" id="pft-${k}" aria-controls="pfp" aria-selected="${i === 0}" data-k="${k}" ${i ? 'tabindex="-1"' : ''}>${l}</button>`).join('')}</div>
      <div id="pfp" role="tabpanel" class="pf-panel" aria-labelledby="pft-resumo" tabindex="0">${skel()}</div>`;
    if (!dlg.open) dlg.showModal();
    $('.profile-inner').scrollTop = 0;
    const alive = () => key === currentKey && dlg.open;
    pfTabs = tabs('.pf-tabs', (k) => {
      if (!alive()) return;
      const h = `#perfil/${key}${k === 'resumo' ? '' : `/${k}`}`;
      if (location.hash !== h) history.replaceState(history.state, '', h);
      renderPfTab(p, k, alive);
    }, pfBody);
    pfTabs.select(tab);
  }

  async function renderPfTab(p, k, alive) {
    const box = $('#pfp'); box.innerHTML = skel();
    const tabNow = () => alive() && $('#pfp')?.getAttribute('aria-labelledby') === `pft-${k}`;
    try {
      if (k === 'resumo') await pfResumo(p, box, tabNow);
      else if (k === 'gastos') await pfGastos(p, box, tabNow);
      else if (k === 'projetos') await pfProjetos(p, box, tabNow);
      else await pfVotos(p, box, tabNow);
    } catch (e) {
      if (tabNow()) box.innerHTML = failBox('Não foi possível carregar esta seção agora. Tente novamente em instantes.', p.c === 'c' ? `https://www.camara.leg.br/deputados/${p.id}` : p.url);
    }
  }

  // Resumo
  function infoDeputadoHTML(x) {
    return dl([
      ['Nome civil', esc(x.nc)], ['Nascimento', esc(age(x.nasc))],
      ['Naturalidade', x.mun ? esc(`${x.mun}${x.ufn ? ` (${x.ufn})` : ''}`) : ''], ['Escolaridade', esc(x.esc)],
      ['Situação', esc([x.sit, x.cond].filter(Boolean).join(' · '))],
      ['Gabinete', x.gab?.sala ? esc(`Sala ${x.gab.sala}, prédio ${x.gab.predio}${x.gab.tel ? ` · tel. (61) ${x.gab.tel}` : ''}`) : ''],
      ['Redes e site', x.redes?.length ? x.redes.map((u) => `<a href="${esc(u)}" target="_blank" rel="noreferrer">${esc(u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>`).join('<br>') : ''],
    ]);
  }
  async function infoHTML(p) {
    if (p.c === 'c') {
      try { const all = await once('detalhes', () => data('deputados-detalhes')); if (all[p.id]) return infoDeputadoHTML(all[p.id]); } catch (_) { /* segue */ }
      try {
        const d = (await getJSON(`${CAMARA_API}/deputados/${p.id}`, { timeout: 8000 })).dados; const s = d.ultimoStatus || {}; const g = s.gabinete || {};
        return infoDeputadoHTML({ nc: d.nomeCivil, nasc: d.dataNascimento, mun: d.municipioNascimento, ufn: d.ufNascimento, esc: d.escolaridade, sit: s.situacao, cond: s.condicaoEleitoral, gab: g.sala ? { sala: g.sala, predio: g.predio, tel: g.telefone } : null, redes: [...(d.redeSocial || []), d.urlWebsite].filter((u) => /^https?:\/\//.test(u || '')) });
      } catch (_) { return failBox('Dados cadastrais indisponíveis agora.', `https://www.camara.leg.br/deputados/${p.id}`); }
    }
    const base = [['Nome completo', esc(p.nc)], ['Participação', esc(p.part)], ['Mandato até', p.fim ? esc(fmtLocal(p.fim)) : ''], ['Bloco parlamentar', esc(p.bl)], ['Funções', esc([p.mesa ? 'Membro da Mesa' : '', p.lid ? 'Membro de liderança' : ''].filter(Boolean).join(' · '))]];
    try {
      const j = await getJSON(`${SENADO_API}/senador/${p.id}.json`, { timeout: 8000 });
      const b = j?.DetalheParlamentar?.Parlamentar?.DadosBasicosParlamentar || {};
      return dl([...base.slice(0, 1), ['Nascimento', esc(age(b.DataNascimento))], ['Naturalidade', b.Naturalidade ? esc(`${b.Naturalidade}${b.UfNaturalidade ? ` (${b.UfNaturalidade})` : ''}`) : ''], ...base.slice(1), ['Gabinete', esc((b.EnderecoParlamentar || '').replace(/\s+/g, ' ').trim())]]);
    } catch (_) { return dl(base); }
  }
  function participacao(p, V, VT) {
    if (p.c === 'c') {
      const list = V.camara?.nominais || []; const mine = VT.camara?.[p.id] || [];
      const c = { S: 0, N: 0, A: 0, O: 0, P: 0, V: 0, x: 0 };
      list.forEach((_, i) => { const v = mine[i]; if (v && c[v] !== undefined) c[v]++; else c.x++; });
      const votou = c.S + c.N + c.A + c.O + c.V;
      return { total: list.length, votou, c, list, mine };
    }
    const list = V.senado?.lista || []; const mine = VT.senado?.[p.id] || [];
    const g = { v: 0, p: 0, a: 0, l: 0, x: 0, sem: 0 }; const det = {};
    list.forEach((_, i) => { const v = mine[i]; if (!v) { g.sem++; return; } const m = S.VOTO_SENADO[v]; const grp = m ? m[0] : 'x'; g[grp]++; det[v] = (det[v] || 0) + 1; });
    return { total: list.length, votou: g.v, g, det, list, mine };
  }
  async function pfResumo(p, box, ok) {
    const [info, G, P, V, VT] = await Promise.all([
      infoHTML(p), loadGastos().catch(() => null), loadParl(p.c, p.id).catch(() => null),
      once('votacoes', () => data('votacoes')).catch(() => null), once('votos', () => data('votos')).catch(() => null),
    ]);
    if (!ok()) return;
    state.gastos ||= G;
    const st = G ? stats(p.c) : null; const mine = st?.list.find((x) => x.id === p.id);
    const nome = esc(p.n.split(' ')[0]);
    const hl = [];
    if (mine) hl.push(`<li><b>Gastos:</b> usou ${money(mine.t)} da cota parlamentar em ${st.ano}. A média da ${casaNome(p.c)} é ${money(st.avg)}. <button type="button" class="linkish" data-goto="gastos">Ver gastos</button></li>`);
    else if (st) hl.push(`<li><b>Gastos:</b> sem despesas da cota registradas em ${st.ano} nos dados oficiais.</li>`);
    if (P?.pj) hl.push(`<li><b>Projetos:</b> aparece como autor(a) ou coautor(a) de ${nf.format(P.pj.n)} propostas (${Object.keys(P.pj.tp).join(', ') || 'PL, PLP, PEC, PDL'}) desde ${P.pj.desde}. <button type="button" class="linkish" data-goto="projetos">Ver projetos</button></li>`);
    if (V && VT) { const pa = participacao(p, V, VT); if (pa.total) hl.push(`<li><b>Votos:</b> registrou voto em ${pa.votou} das ${pa.total} votações nominais recentes do Plenário. <button type="button" class="linkish" data-goto="votos">Ver votos</button></li>`); }
    box.innerHTML = `${hl.length ? `<h3 class="h-sm">Em resumo</h3><ul class="pf-hl">${hl.join('')}</ul>` : ''}<h3 class="h-sm">Informações de ${nome}</h3>${info}`;
  }
  pfBody.addEventListener('click', (e) => { const b = e.target.closest('[data-goto]'); if (b) { pfTabs?.select(b.dataset.goto); $(`#pft-${b.dataset.goto}`)?.focus(); } });

  // Gastos individuais
  const docFmt = (d) => { const x = String(d || '').replace(/\D/g, ''); return x.length === 14 ? `CNPJ ${x.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}` : ''; };
  async function pfGastos(p, box, ok) {
    const [G, P] = await Promise.all([loadGastos(), loadParl(p.c, p.id)]);
    if (!ok()) return;
    state.gastos ||= G;
    const st = stats(p.c); const g = P?.g; const cota = p.c === 'c' ? 'ceap' : 'ceaps';
    if (!g) { box.innerHTML = `${failBox(`Sem despesas da cota parlamentar registradas para este(a) ${cargo(p.c)} em ${st?.ano || 'neste ano'}.`, p.c === 'c' ? `https://www.camara.leg.br/deputados/${p.id}` : p.url)}<div class="terms">${term(cota)}</div>`; return; }
    const rank = st?.rank.get(p.id); const avg = st?.avg || 0;
    const comp = avg ? (g.t >= avg ? `${pct(((g.t / avg) - 1) * 100)} acima da média` : `${pct((1 - g.t / avg) * 100)} abaixo da média`) : '';
    const partyPeers = st ? st.list.filter((x) => state.byKey.get(`${p.c}/${x.id}`)?.p === p.p) : [];
    const partyAvg = partyPeers.length > 1 ? partyPeers.reduce((s, x) => s + x.t, 0) / partyPeers.length : null;
    const forn = (g.f || []).map(([n, doc, v, q]) => `<li><span class="sp-name">${esc(n)}${docFmt(doc) ? `<small>${esc(docFmt(doc))}</small>` : ''}</span><span class="sp-val">${money(v)}<small>${nf.format(q)} ${q > 1 ? 'documentos' : 'documento'}</small></span></li>`).join('');
    const docs = (g.d || []).map((d) => `<li class="doc"><div class="doc-top"><span>${esc(fmtLocal(d.dt, false))}</span>${money(d.v)}</div>
      <p><b>${esc(S.categoria(d.tp))}</b>${d.f ? ` — ${esc(d.f)}` : ''}</p>${d.det ? `<p class="muted">Descrição informada: ${esc(d.det)}</p>` : ''}
      ${d.url ? `<a class="ext" href="${esc(d.url)}" target="_blank" rel="noreferrer">Ver documento oficial ↗</a>` : `<p class="note-sm">${p.c === 'c' ? 'A API não traz link para este documento.' : 'O Senado não publica link para o documento nos dados abertos.'}</p>`}</li>`).join('');
    box.innerHTML = `<p class="lead-simples">Em ${g.a}, ${esc(p.n)} usou ${money(g.t)} da cota parlamentar ${term(cota, p.c === 'c' ? '(CEAP)' : '(CEAPS)')}, em ${nf.format(g.n)} notas e recibos.
        ${avg ? `A média da ${casaNome(p.c)} é ${money(avg)} por ${cargo(p.c)} (${comp}).` : ''}
        ${rank ? `É o ${rank}º maior valor entre ${nf.format(st.n)} ${p.c === 'c' ? 'deputados' : 'senadores'} com gastos registrados (1º = quem mais gastou).` : ''}
        ${partyAvg ? `A média do ${esc(p.p)} na ${casaNome(p.c)} é ${money(partyAvg)}.` : ''}</p>
      <div class="kpis">
        <div class="kpi"><b>${money(g.t)}</b><span>total em ${g.a}</span></div>
        <div class="kpi"><b>${rank ? `${rank}º` : '—'}</b><span>posição na ${casaNome(p.c)} (de ${nf.format(st?.n || 0)})</span></div>
        <div class="kpi"><b>${nf.format(g.n)}</b><span>notas e recibos</span></div>
      </div>
      ${monthChart(g.m, g.a, 'Gastos')}
      <h3 class="h-sm">Com o que gastou</h3>${catBars(g.tp, g.t, 6)}
      ${forn ? `<h3 class="h-sm">Quem mais recebeu (fornecedores)</h3><ul class="suppliers">${forn}</ul>` : ''}
      ${docs ? `<h3 class="h-sm">Maiores notas e recibos</h3><ul class="docs">${docs}</ul>` : ''}
      <p class="note">${p.c === 'c' ? 'Fonte: API de Dados Abertos da Câmara (despesas da cota parlamentar, valores líquidos).' : 'Fonte: dados administrativos do Senado (CEAPS, valores reembolsados).'} Atualização de ${esc(fmtZoned(state.meta?.atualizadoEm))}. Os meses mais recentes podem estar incompletos. A cota tem limite mensal diferente para cada estado, então comparações entre parlamentares de estados diferentes devem ser feitas com cuidado. CPFs de pessoas físicas não são exibidos.</p>`;
  }

  // Projetos
  async function pfProjetos(p, box, ok) {
    const [P] = await Promise.all([loadParl(p.c, p.id), loadResumos().then((r) => { state.resumos = r; })]);
    if (!ok()) return;
    const pj = P?.pj; const casa = p.c;
    const oficial = casa === 'c' ? `https://www.camara.leg.br/deputados/${p.id}` : (p.url || '');
    if (!pj) { box.innerHTML = failBox('Lista de projetos indisponível na última atualização.', oficial); return; }
    const tipos = Object.entries(pj.tp).sort((a, b) => b[1] - a[1]);
    const tiposTxt = tipos.map(([t, n]) => `${nf.format(n)} ${t}`).join(', ');
    const head = `<p class="lead-simples">Desde ${pj.desde}, ${esc(p.n)} aparece como autor(a) ou coautor(a) de <b>${nf.format(pj.n)}</b> ${pj.n === 1 ? 'proposta' : 'propostas'} dos tipos ${casa === 'c' ? 'PL, PLP, PEC e PDL' : 'PL, PLP, PEC, PDL e PRS'}${tiposTxt ? ` (${tiposTxt})` : ''}.</p>
      <div class="terms">${terms(tipos.map(([t]) => S.tipoInfo(t)?.[0]).filter(Boolean))}</div>`;
    if (!pj.it?.length) { box.innerHTML = `${head}<p class="err">Nenhuma proposta desses tipos encontrada no período.</p>`; return; }
    const lista = () => { const l = comTema('pj', pj.it, (x) => x.x); return l.length ? listHTML(l, (x) => propHTML(x, casa), '', 5) : '<p class="err">Nenhuma proposta com esse tema entre as mais recentes.</p>'; };
    temaRender.pj = () => { const el = box.querySelector('.pj-list'); if (el) el.innerHTML = lista(); };
    temaSel.pj = '';
    box.innerHTML = `${head}<h3 class="h-sm">As ${pj.it.length} mais recentes</h3>${temaFilterHTML('pj', pj.it, (x) => x.x)}<div class="pj-list">${lista()}</div>
      <p class="note">${casa === 'c' ? 'A API da Câmara lista propostas em que o(a) deputado(a) é autor(a) ou coautor(a), sem indicar quem é o autor principal; na autoria, o primeiro nome é o de quem assinou primeiro.' : '“1º autor(a)” indica que o nome aparece primeiro na autoria registrada pelo Senado.'} Requerimentos, indicações e outros tipos não entram na contagem. ${oficial ? `<a href="${esc(oficial)}" target="_blank" rel="noreferrer">Lista completa na página oficial ↗</a>` : ''}</p>`;
  }

  // Votos
  async function pfVotos(p, box, ok) {
    const [V, VT] = await Promise.all([once('votacoes', () => data('votacoes')), once('votos', () => data('votos')), loadResumos().then((r) => { state.resumos = r; })]);
    if (!ok()) return;
    const pa = participacao(p, V, VT);
    const legSen = V.senado?.legenda || {};
    const labelSen = (k) => S.VOTO_SENADO[k]?.[0] === 'v' ? S.VOTO_SENADO[k][1] : (legSen[k] || S.VOTO_SENADO[k]?.[1] || k);
    if (!pa.total) { box.innerHTML = failBox('Sem votações nominais no período.'); return; }
    const datas = pa.list.map((v) => String(v.dt).slice(0, 10)).sort();
    const periodo = `de ${fmtLocal(datas[0], false)} a ${fmtLocal(datas[datas.length - 1], false)}`;
    let resumo; let rows;
    if (p.c === 'c') {
      const c = pa.c;
      const partes = [['S', 'Sim'], ['N', 'Não'], ['A', 'Abstenção'], ['O', 'Obstrução'], ['V', 'voto secreto'], ['P', 'presidindo a sessão']].filter(([k]) => c[k]).map(([k, l]) => `${c[k]} ${l}`);
      resumo = `<p class="lead-simples">Nas ${pa.total} votações nominais mais recentes do Plenário da Câmara (${periodo}), ${esc(p.n)} registrou voto em <b>${pa.votou}</b>${pa.total ? ` (${pct((pa.votou / pa.total) * 100)})` : ''}.${partes.length ? ` Foram ${partes.join(', ')}.` : ''} Em ${c.x} não há voto registrado.</p>
        <p class="note-sm">Isto não é a lista oficial de presença: “sem voto registrado” pode ser ausência, licença, missão oficial ou simplesmente não ter votado naquela rodada — a API de votos não informa o motivo.</p>`;
      rows = pa.list.map((v, i) => ({ v, voto: pa.mine[i] }));
    } else {
      const g = pa.g; const det = Object.entries(pa.det).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${labelSen(k)}`).join(', ');
      resumo = `<p class="lead-simples">Nas ${pa.total} votações nominais mais recentes do Plenário do Senado (${periodo}), ${esc(p.n)} registrou voto em <b>${g.v}</b> (${pct((g.v / pa.total) * 100)}).${det ? ` Registros: ${esc(det)}.` : ''}${g.sem ? ` Em ${g.sem} não há registro (por exemplo, quando ainda não estava no exercício do mandato).` : ''}</p>
        <p class="note-sm">O Senado informa o motivo de quem não votou (licença, missão, atividade parlamentar etc.). Isto não substitui o registro oficial de presença nas sessões.</p>`;
      rows = pa.list.map((v, i) => ({ v, voto: pa.mine[i] }));
    }
    const voteTag = (voto) => {
      if (p.c === 'c') { const l = voto ? (VOTO_LABEL[voto] || voto) : 'Sem voto registrado'; return `<span class="vote-tag ${voto || 'X'}">${esc(l)}</span>`; }
      const cls = voto === 'Sim' ? 'S' : voto === 'Não' ? 'N' : voto === 'Abstenção' ? 'A' : 'X';
      return `<span class="vote-tag ${cls}">${esc(voto ? labelSen(voto) : 'Sem registro')}</span>`;
    };
    const li = ({ v, voto }) => {
      const vs = p.c === 'c' ? votoSimplesCamara(v) : votoSimplesSenado(v);
      const sig = p.c === 'c' ? v.pr?.s : v.s; const ementa = p.c === 'c' ? v.pr?.e : v.e;
      const res = p.c === 'c' ? resultBadge(v.ap, v.d) : (v.r === 'A' ? '<span class="badge ok">Aprovada</span>' : v.r === 'R' ? '<span class="badge no">Rejeitada</span>' : '');
      const card = p.c === 'c' ? (v.pr ? `<p class="pc-k">Sobre a proposta votada</p>${propCard({ casa: 'c', id: v.pr.id, sig, x: v.pr.x, ementa, st: v.pr.st, tr: v.pr.tr, votado: true })}` : '')
        : (v.cm || ementa ? `<p class="pc-k">Sobre a proposta votada</p>${propCard({ casa: 's', id: v.cm, sig, x: v.x, ementa, st: v.st, votado: true })}` : '');
      return `<li class="item vote-item"><div class="item-top"><time>${esc(fmtLocal(v.dt, false))}</time>${sig ? `<span class="sig">${esc(sig)}</span>` : ''}${res}</div>
        <div class="vote-mine"><span>Voto de ${esc(p.n)}:</span>${voteTag(voto)}</div>
        ${simplesBox({ linhas: vs.linhas, card, termos: vs.termos })}
        <p class="note-sm"><b>Descrição oficial da votação:</b> ${esc(p.c === 'c' ? descLimpa(v.d) : v.d)}</p></li>`;
    };
    box.innerHTML = `${resumo}<div class="terms">${terms(['nominal', 'abstencao', 'obstrucao', 'secreta'])}</div>${listHTML(rows, li, '', 6)}`;
  }

  function routeHash() {
    const m = location.hash.match(/^#perfil\/([cs])\/(\d+)(?:\/(\w+))?$/);
    if (m && state.all.length) openProfile(m[1], Number(m[2]), null, m[3] || 'resumo');
    else if (!m && dlg.open) dlg.close();
  }
  window.addEventListener('hashchange', routeHash);

  // ---------- Inicialização ----------
  async function init() {
    renderGlossario();
    const [meta, dep, sen] = await Promise.allSettled([data('meta'), data('deputados'), data('senadores')]);
    state.meta = meta.status === 'fulfilled' ? meta.value : null;
    const D = dep.status === 'fulfilled' ? dep.value : [];
    const Sn = sen.status === 'fulfilled' ? sen.value : [];
    state.all = [...D.map((p) => ({ ...p, c: 'c' })), ...Sn.map((p) => ({ ...p, c: 's' }))]
      .map((p) => ({ ...p, k: norm(`${p.n} ${p.nc || ''}`) })).sort((a, b) => a.n.localeCompare(b.n, 'pt-BR'));
    state.byKey = new Map(state.all.map((p) => [`${p.c}/${p.id}`, p]));

    if (state.meta?.atualizadoEm) {
      const t = fmtZoned(state.meta.atualizadoEm);
      $('#st-upd').innerHTML = `<time datetime="${esc(state.meta.atualizadoEm)}">${esc(t)}</time>`;
      $('#ft-upd').textContent = t;
    }
    if (!state.all.length) {
      els.count.innerHTML = '<span class="err">Não foi possível carregar a lista de parlamentares. Verifique sua conexão e recarregue a página.</span>';
    } else {
      $('#st-dep').textContent = D.length ? nf.format(D.length) : '—';
      $('#st-sen').textContent = Sn.length ? nf.format(Sn.length) : '—';
      $('#st-part').textContent = nf.format(new Set(state.all.map((p) => p.p).filter((x) => x && !/^s\/?partido$/i.test(x))).size);
      fillSelect(els.part, [...new Set(state.all.map((p) => p.p))].sort((a, b) => a.localeCompare(b, 'pt-BR')), (s) => (partyName(s) ? `${s} — ${partyName(s)}` : s));
      fillSelect(els.uf, [...new Set(state.all.map((p) => p.uf))].sort());
      const u = new URL(location.href);
      els.q.value = u.searchParams.get('q') || '';
      for (const [k, el] of [['casa', els.casa], ['partido', els.part], ['uf', els.uf]]) { const v = u.searchParams.get(k); if (v && [...el.options].some((o) => o.value === v)) el.value = v; }
      applyFilters();
      renderBars(D, 'c', $('#bars-c'), $('#bc-total'));
      renderBars(Sn, 's', $('#bars-s'), $('#bs-total'));
      routeHash();
    }

    tabs('#votacoes .tabs', renderVotacoes);
    tabs('#proposicoes .tabs', renderProps);
    const ggTabs = tabs('#gastos .tabs', renderGastosGeral);
    const [vot, props, news, G, R] = await Promise.allSettled([once('votacoes', () => data('votacoes')), data('proposicoes'), data('noticias'), loadGastos(), loadResumos()]);
    state.votacoes = vot.status === 'fulfilled' ? vot.value : null;
    state.props = props.status === 'fulfilled' ? props.value : null;
    state.gastos = G.status === 'fulfilled' ? G.value : null;
    state.resumos = R.status === 'fulfilled' ? R.value : {};
    renderVotacoes($('#votacoes [aria-selected="true"]').dataset.k);
    renderProps($('#proposicoes [aria-selected="true"]').dataset.k);
    renderGastosGeral($('#gastos .tabs [aria-selected="true"]').dataset.k);
    if (state.all.length) {
      const u = new URL(location.href);
      if (u.searchParams.get('rcasa') === 's') rk.casa.value = 's';
      fillRankFilters();
      for (const [k, el] of [['rpartido', rk.part], ['ruf', rk.uf], ['rordem', rk.ord]]) { const v = u.searchParams.get(k); if (v && [...el.options].some((o) => o.value === v)) el.value = v; }
      renderRanking();
    }
    void ggTabs;
    renderNews(news.status === 'fulfilled' ? news.value : null);
  }
  init();
})();
