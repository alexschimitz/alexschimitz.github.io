/* politica/politicos — busca de políticos e mandatos desde 1988.
   Dados: ../data/politicos/ (ver README.md lá). Perfil: #p/{id}. Filtros: ?q=&uf=&mun=&cargo=&partido=&min=&de=&ate=&ord=&cur=1&all=1 */
(() => {
  'use strict';
  const D = '../data/politicos/';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fold = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const nf = new Intl.NumberFormat('pt-BR');
  const UFS = { AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso', PA: 'Pará', PB: 'Paraíba', PE: 'Pernambuco', PI: 'Piauí', PR: 'Paraná', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RO: 'Rondônia', RR: 'Roraima', RS: 'Rio Grande do Sul', SC: 'Santa Catarina', SE: 'Sergipe', SP: 'São Paulo', TO: 'Tocantins' };
  const CARGO = { 1: ['Presidente', 'Presidente'], 2: ['Vice-presidente', 'Vice-presidente'], 3: ['Governador', 'Governadora'], 4: ['Vice-governador', 'Vice-governadora'], 5: ['Senador', 'Senadora'], 6: ['Deputado federal', 'Deputada federal'], 7: ['Deputado estadual', 'Deputada estadual'], 8: ['Deputado distrital', 'Deputada distrital'], 9: ['1º suplente de senador', '1ª suplente de senador'], 10: ['2º suplente de senador', '2ª suplente de senador'], 11: ['Prefeito', 'Prefeita'], 12: ['Vice-prefeito', 'Vice-prefeita'], 13: ['Vereador', 'Vereadora'] };
  const CARGO_PL = { 1: 'Presidentes', 2: 'Vice-presidentes', 3: 'Governadores', 4: 'Vice-governadores', 5: 'Senadores', 6: 'Deputados federais', 7: 'Deputados estaduais', 8: 'Deputados distritais', 11: 'Prefeitos', 12: 'Vice-prefeitos', 13: 'Vereadores' };
  const cargoN = (c, g) => (CARGO[c] || ['?', '?'])[g === 'F' ? 1 : 0];
  const MUNI = new Set([11, 12, 13]);
  const PROP = new Set([6, 7, 8, 13]);
  const SRC = { t: ['TSE', 'https://dadosabertos.tse.jus.br/'], c: ['Câmara', 'https://dadosabertos.camara.leg.br/'], s: ['Senado', 'https://legis.senado.leg.br/dadosabertos/'], x: ['declarado à Câmara', 'https://dadosabertos.camara.leg.br/swagger/api.html'], a: ['ajuste documentado', null] };
  const RES = { E: 'Eleito', Q: 'Eleito', M: 'Eleito', V: 'Eleito na chapa', S: 'Suplente', N: 'Não eleito', T: '2º turno', X: 'Candidatura sem efeito', U: 'Sem resultado' };
  const COLS = { id: 0, nome: 1, mask: 2, alt: 3, muns: 4, a0: 5, a1: 6, nm: 7, lp: 8, parts: 9, fl: 10, ym: 11 };
  const PAGE = 60;
  const THIS_YEAR = new Date().getFullYear();

  const S = { meta: null, part: null, mun: null, idx: {}, rows: [], shown: PAGE, fam: {}, famOf: {}, pages: {}, filtered: [] };
  const cache = {};
  // uma nova tentativa em falha passageira do GitHub Pages (503 etc.)
  const fetchJSON = (u, n = 1) => fetch(D + u).then((r) => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); })
    .catch((e) => (n > 0 ? new Promise((ok) => setTimeout(ok, 900)).then(() => fetchJSON(u, n - 1)) : Promise.reject(e)));
  const getJSON = (u) => (cache[u] ||= fetchJSON(u));

  // ---------- helpers de texto ----------
  const munName = (code) => { const m = S.mun && S.mun[code]; return m ? `${m[0]} (${m[1]})` : (code ? `município ${code}` : ''); };
  const locName = (c, l, mn) => {
    if (c === 1 || c === 2 || l === 'BR') return 'Brasil';
    if (MUNI.has(c)) return /^\d+$/.test(String(l)) ? munName(String(l)) : [mn, l].filter(Boolean).join(' – ') || (l || '');
    return UFS[l] ? `${UFS[l]} (${l})` : (l || '');
  };
  const periodo = (m) => {
    if (m.d) {
      const [a, b] = m.d;
      const y0 = Math.floor(a / 12), y1 = Math.floor((b - 1) / 12);
      return y0 === y1 ? String(y0) : `${y0}–${y1}`;
    }
    return m.a === m.b ? String(m.a) : `${m.a}–${m.b}`;
  };
  const famOf = (sig, year) => {
    if (!sig) return null;
    for (const r of (S.part?.regras || [])) if (r.sigla === sig && year && year <= r.ate_ano) return r.familia;
    return S.famOf[sig] || null;
  };
  const partyLabel = (sig) => sig ? `<abbr title="${esc((S.part?.nomes || {})[sig] || sig)}">${esc(sig)}</abbr>` : '<span class="muted">sem partido informado</span>';

  // ---------- filtros ----------
  const form = $('#pp-form');
  const F = { q: $('#f-q'), uf: $('#f-uf'), mun: $('#f-mun'), cargo: $('#f-cargo'), part: $('#f-part'), min: $('#f-min'), de: $('#f-de'), ate: $('#f-ate'), ord: $('#f-ord'), cur: $('#f-cur'), all: $('#f-all') };

  function fillSelects() {
    F.uf.insertAdjacentHTML('beforeend', Object.entries(UFS).map(([k, v]) => `<option value="${k}">${esc(v)} (${k}) — todos os cargos</option>`).join(''));
    F.cargo.insertAdjacentHTML('beforeend', [1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13].map((c) => `<option value="${c}">${esc(CARGO_PL[c])}</option>`).join(''));
    const fams = (S.part?.familias || []).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    F.part.insertAdjacentHTML('beforeend', fams.map((f) => `<option value="f:${esc(f.id)}">${esc(f.nome)}${f.siglas.length > 1 ? ' (inclui ' + esc(f.siglas.filter((s) => s !== f.nome).join(', ')) + ')' : ''}</option>`).join(''));
    const known = new Set(fams.flatMap((f) => f.siglas));
    const others = Object.keys(S.part?.nomes || {}).filter((s) => !known.has(s)).sort();
    if (others.length) F.part.insertAdjacentHTML('beforeend', `<optgroup label="Outras siglas">${others.map((s) => `<option value="s:${esc(s)}">${esc(s)} — ${esc(S.part.nomes[s])}</option>`).join('')}</optgroup>`);
    const ys = []; for (let y = 1985; y <= THIS_YEAR + 4; y++) ys.push(y);
    F.de.insertAdjacentHTML('beforeend', ys.map((y) => `<option>${y}</option>`).join(''));
    F.ate.insertAdjacentHTML('beforeend', ys.map((y) => `<option>${y}</option>`).join(''));
  }

  function readURL() {
    const p = new URLSearchParams(location.search);
    F.q.value = p.get('q') || '';
    F.uf.value = UFS[p.get('uf')] ? p.get('uf') : '';
    F.cargo.value = p.get('cargo') || '';
    F.part.value = p.get('partido') || '';
    F.min.value = p.get('min') || '';
    F.de.value = p.get('de') || '';
    F.ate.value = p.get('ate') || '';
    F.ord.value = p.get('ord') || 'nome';
    F.cur.checked = p.get('cur') === '1';
    F.all.checked = p.get('all') === '1';
    S.munPending = p.get('mun') || '';
  }
  function writeURL() {
    const p = new URLSearchParams();
    if (F.q.value.trim()) p.set('q', F.q.value.trim());
    if (F.uf.value) p.set('uf', F.uf.value);
    const mc = munCode();
    if (mc) p.set('mun', mc);
    if (F.cargo.value) p.set('cargo', F.cargo.value);
    if (F.part.value) p.set('partido', F.part.value);
    if (F.min.value) p.set('min', F.min.value);
    if (F.de.value) p.set('de', F.de.value);
    if (F.ate.value) p.set('ate', F.ate.value);
    if (F.ord.value !== 'nome') p.set('ord', F.ord.value);
    if (F.cur.checked) p.set('cur', '1');
    if (F.all.checked) p.set('all', '1');
    const s = p.toString();
    history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '') + location.hash);
  }

  let munList = [];
  function fillMunicipios() {
    const uf = F.uf.value;
    F.mun.disabled = !uf;
    F.mun.placeholder = uf ? 'Todas as cidades (digite para escolher)' : 'Escolha um estado primeiro';
    if (!uf) { F.mun.value = ''; $('#l-mun').innerHTML = ''; munList = []; return; }
    munList = Object.entries(S.mun || {}).filter(([, m]) => m[1] === uf).map(([k, m]) => [k, m[0]]).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
    $('#l-mun').innerHTML = munList.map(([, n]) => `<option value="${esc(n)}"></option>`).join('');
    if (S.munPending) { const hit = munList.find(([k]) => k === S.munPending); F.mun.value = hit ? hit[1] : ''; S.munPending = ''; }
  }
  const munCode = () => { const v = fold(F.mun.value.trim()); if (!v) return ''; const hit = munList.find(([, n]) => fold(n) === v); return hit ? hit[0] : ''; };

  async function ensureIndex() {
    const need = [];
    if (F.uf.value) need.push(F.uf.value);
    else if (F.all.checked) need.push(...Object.keys(UFS), 'BR');
    else need.push('BR');
    const missing = need.filter((k) => !S.idx[k]);
    if (missing.length) {
      $('#pp-count').textContent = missing.length > 1 ? `Carregando ${missing.length} arquivos de índice…` : 'Carregando…';
      const man = await getJSON('idx/manifest.json').catch(() => ({}));
      await Promise.all(missing.map((k) => Promise.all((man[k] || [k]).map((f) => getJSON(`idx/${f}.json`).then((j) => j.rows)))
        .then((parts) => { S.idx[k] = parts.flat(); }).catch(() => { S.idx[k] = []; })));
    }
    const seen = new Set(); const rows = [];
    for (const k of need) for (const r of S.idx[k]) { if (!seen.has(r[0])) { seen.add(r[0]); rows.push(r); } }
    return rows;
  }

  let token = 0;
  async function apply() {
    const my = ++token;
    writeURL();
    const rows = await ensureIndex();
    if (my !== token) return;
    const q = fold(F.q.value.trim()).split(/\s+/).filter(Boolean);
    const cargo = +F.cargo.value || 0;
    const pv = F.part.value;
    const min = +F.min.value || 0;
    const de = +F.de.value || 0, ate = +F.ate.value || 0;
    const mc = munCode();
    const cur = F.cur.checked;
    let fams = null, sig = null;
    if (pv.startsWith('f:')) fams = pv.slice(2); else if (pv.startsWith('s:')) sig = pv.slice(2);
    const out = [];
    for (const r of rows) {
      if (cargo && !(r[COLS.mask] & (1 << cargo))) continue;
      if (min && r[COLS.nm] < min) continue;
      if (cur && !(r[COLS.fl] & 1)) continue;
      if (de && r[COLS.a1] < de) continue;
      if (ate && r[COLS.a0] > ate) continue;
      if (mc && !String(r[COLS.muns]).split('|').includes(mc)) continue;
      if (sig || fams) {
        const ps = String(r[COLS.parts]).split(',');
        if (sig && !ps.includes(sig)) continue;
        if (fams && !ps.some((p) => famOf(p, p === 'PSD' ? r[COLS.a0] : 0) === fams)) continue;
      }
      if (q.length) {
        const hay = r._h || (r._h = fold(r[COLS.nome] + ' ' + r[COLS.alt]));
        if (!q.every((t) => hay.includes(t))) continue;
      }
      out.push(r);
    }
    const ord = F.ord.value;
    if (ord === 'mandatos') out.sort((a, b) => b[COLS.nm] - a[COLS.nm] || b[COLS.ym] - a[COLS.ym]);
    else if (ord === 'anos') out.sort((a, b) => b[COLS.ym] - a[COLS.ym] || b[COLS.nm] - a[COLS.nm]);
    else if (ord === 'recente') out.sort((a, b) => b[COLS.a1] - a[COLS.a1] || b[COLS.nm] - a[COLS.nm]);
    S.filtered = out; S.shown = PAGE;
    render();
    renderCity(mc);
  }

  function cargosOf(mask) { const r = []; for (const c of [1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13]) if (mask & (1 << c)) r.push(c); return r; }

  function card(r) {
    const cs = cargosOf(r[COLS.mask]);
    const muns = String(r[COLS.muns] || '').split('|').filter(Boolean);
    const where = muns.length ? munName(muns[muns.length - 1]) + (muns.length > 1 ? ` e mais ${muns.length - 1}` : '') : '';
    const fl = r[COLS.fl];
    return `<li><button type="button" class="pp-card" data-id="${esc(r[0])}">
      <h3>${esc(r[COLS.nome])}</h3>
      <div class="pp-meta">${cs.map((c) => `<span class="chip">${esc(cargoN(c))}</span>`).join('')}${fl & 1 ? '<span class="chip cur">com mandato agora</span>' : ''}${fl & 4 ? '<span class="chip fut">eleito p/ 2027</span>' : ''}${fl & 2 ? '<span class="chip warn">possível duplicata</span>' : ''}</div>
      <div class="pp-sub">${r[COLS.lp] ? esc(r[COLS.lp]) + ' · ' : ''}${r[COLS.a0] ? `${r[COLS.a0]}–${Math.min(r[COLS.a1], 9999)}` : ''}${where ? ' · ' + esc(where) : ''}</div>
      <div class="pp-num"><span><b>${r[COLS.nm]}</b> ${r[COLS.nm] === 1 ? 'mandato' : 'mandatos'}</span><span><b>${r[COLS.ym]}</b> ${r[COLS.ym] === 1 ? 'ano' : 'anos'} com mandato</span></div>
    </button></li>`;
  }

  function render() {
    const n = S.filtered.length;
    const scope = F.uf.value ? UFS[F.uf.value] : (F.all.checked ? 'todo o Brasil, todos os cargos' : 'Brasil — cargos federais e estaduais');
    $('#pp-count').textContent = n ? `${nf.format(n)} ${n === 1 ? 'pessoa encontrada' : 'pessoas encontradas'} (${scope}).` : `Ninguém encontrado com esses filtros (${scope}).${!F.uf.value && !F.all.checked ? ' Prefeitos e vereadores aparecem quando você escolhe um estado.' : ''}`;
    $('#pp-list').innerHTML = S.filtered.slice(0, S.shown).map(card).join('');
    $('#pp-more').hidden = n <= S.shown;
    $('#pp-more').textContent = `Mostrar mais (${nf.format(Math.min(PAGE, n - S.shown))} de ${nf.format(n - S.shown)} restantes)`;
  }
  $('#pp-more').addEventListener('click', () => {
    const start = S.shown; S.shown += PAGE;
    $('#pp-list').insertAdjacentHTML('beforeend', S.filtered.slice(start, S.shown).map(card).join(''));
    $('#pp-more').hidden = S.filtered.length <= S.shown;
    $('#pp-more').textContent = `Mostrar mais (${nf.format(Math.min(PAGE, S.filtered.length - S.shown))} de ${nf.format(S.filtered.length - S.shown)} restantes)`;
    const b = $('#pp-list').children[start]?.querySelector('button'); if (b) b.focus({ preventScroll: true });
  });

  async function renderCity(mc) {
    const box = $('#pp-city');
    if (!mc) { box.hidden = true; box.innerHTML = ''; return; }
    const m = S.mun[mc];
    let list = [];
    try {
      const pref = await getJSON(`cargos/prefeitos/${m[1]}.json`);
      list = pref[String(m[2] || 't' + mc)] || [];
    } catch (_) { list = []; }
    if (munCode() !== mc) return;
    box.hidden = false;
    box.innerHTML = `<h3>Prefeitos de ${esc(m[0])} (${esc(m[1])}) desde 1997</h3>
      ${list.length ? `<ol>${list.map(([a, b, id, n, p, sup]) => `<li><span class="yr">${a}–${b}</span><span><button type="button" class="linkish" data-id="${esc(id)}">${esc(n)}</button> ${p ? `<span class="muted">(${esc(p)})</span>` : ''}${sup ? ' <span class="chip">mandato-tampão</span>' : ''}</span></li>`).join('')}</ol>` : '<p class="muted">Sem registro de prefeito eleito nos dados abertos do TSE para esta cidade.</p>'}
      <p class="note-sm">Mandatos de 1989–1996 (eleições de 1988 e 1992) não estão nos dados abertos do TSE. A lista abaixo mostra quem teve mandato na cidade (prefeito, vice ou vereador).</p>`;
  }

  // ---------- perfil ----------
  const modal = $('#pp-modal');
  let lastFocus = null;
  async function openPerson(id, push = true) {
    if (!/^[a-z2-7]{10}$/.test(id)) return;
    lastFocus = document.activeElement;
    $('#pm-body').innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
    if (!modal.open) { try { modal.showModal(); } catch (_) { modal.setAttribute('open', ''); } }
    if (push && location.hash !== '#p/' + id) history.pushState({ p: id }, '', location.pathname + location.search + '#p/' + id);
    try {
      let shard = await getJSON(`p/${id.slice(0, 2)}.json`);
      let p = shard[id];
      S.curId = id;
      if (!p) {
        const al = await getJSON('aliases.json').catch(() => ({ aliases: {} }));
        const to = al.aliases && al.aliases[id];
        if (to) { shard = await getJSON(`p/${to.slice(0, 2)}.json`); p = shard[to]; S.curId = to; }
      }
      if (!S.mun) S.mun = await getJSON('municipios.json');
      if (p && (p.cam || p.sen) && !S.gastosKeys) {
        const gi = await getJSON('../gastos/parl/indice.json').catch(() => null);
        S.gastosKeys = new Set(((gi && gi.pessoas) || []).map((r) => r[0] + '-' + r[1]));
      }
      $('#pm-body').innerHTML = p ? profile(p) : '<p class="err">Pessoa não encontrada. O código pode ter mudado numa atualização; use a busca.</p>';
      $('#pm-title')?.focus({ preventScroll: true });
    } catch (e) {
      $('#pm-body').innerHTML = `<p class="err">Não foi possível carregar os dados agora (${esc(e.message)}). Tente de novo em instantes.</p>`;
    }
  }
  function closePerson(fromPop) {
    if (modal.open) modal.close();
    if (!fromPop && location.hash.startsWith('#p/')) history.pushState(null, '', location.pathname + location.search);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  $('#pm-close').addEventListener('click', () => closePerson());
  modal.addEventListener('cancel', (e) => { e.preventDefault(); closePerson(); });
  modal.addEventListener('click', (e) => { if (e.target === modal) closePerson(); });
  window.addEventListener('popstate', () => { route(false); });
  function route(push) {
    const m = location.hash.match(/^#p\/([a-z2-7]{10})$/);
    if (m) openPerson(m[1], push); else if (modal.open) closePerson(true);
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (b && (b.classList.contains('pp-card') || b.classList.contains('linkish'))) { e.preventDefault(); openPerson(b.dataset.id); }
  });

  function how(m, g) {
    const c = m.c, r = m.r;
    if (r === 'A') return 'Assumiu por sucessão';
    if (r === 'V') return c === 9 || c === 10 ? 'Eleito na chapa como suplente' : 'Eleito na chapa, como vice';
    if (r === 'S') return c === 5 ? `Suplente que assumiu a vaga${m.tit ? ' de ' + esc(m.tit) : ''}` : 'Suplente que assumiu a vaga';
    if (r === 'T') return 'Titular (registro do Senado)';
    if (r === 'C') return m.src.includes('x') ? 'Mandato declarado pela própria pessoa à Câmara' : 'Exerceu o mandato (registro da Câmara)';
    if (r === 'Q') return 'Eleito com votos suficientes pelo próprio partido/coligação (quociente)';
    if (r === 'M') return 'Eleito na divisão das sobras de vagas (“média”)';
    return 'Eleito';
  }

  function timeline(ms, g) {
    const real = ms.filter((m) => m.c !== 9 && m.c !== 10);
    if (!real.length) return '';
    const y0 = Math.min(1985, ...real.map((m) => Math.floor(m.d[0] / 12)));
    const y1 = Math.max(THIS_YEAR + 1, ...real.map((m) => Math.ceil(m.d[1] / 12)));
    const span = (y1 - y0) * 12;
    const pos = (mo) => ((mo - y0 * 12) / span * 100).toFixed(2);
    const rows = {};
    for (const m of real) (rows[m.c] ||= []).push(m);
    const ticks = []; for (let y = Math.ceil(y0 / 10) * 10; y <= y1; y += 10) ticks.push(y);
    const now = new Date(); const nowMo = now.getFullYear() * 12 + now.getMonth();
    return `<div class="tl" aria-hidden="true">
      <div class="tl-axis">${ticks.map((y) => `<span style="left:${pos(y * 12)}%">${y}</span>`).join('')}</div>
      ${Object.keys(rows).sort((a, b) => a - b).map((c) => `<div class="tl-row"><span class="lab">${esc(cargoN(+c, g))}</span><div class="tl-track">${rows[c].map((m) => `<span class="tl-seg${m.fut ? ' fut' : ''}${m.r === 'S' ? ' sup' : ''}" style="left:${pos(m.d[0])}%;width:${(Math.max(m.d[1] - m.d[0], 1) / span * 100).toFixed(2)}%" title="${esc(periodo(m))}"></span>`).join('')}<span class="tl-now" style="left:${pos(nowMo)}%"></span></div></div>`).join('')}
    </div>`;
  }

  function profile(p) {
    const g = p.g;
    p.i = p.i || S.curId;
    const ms = mandates(p);
    const segs = partySegs(p);
    const els = elections(p);
    const ccm = {}; for (const m of ms) if (!m.fut && !m.tmp && m.c !== 9 && m.c !== 10) ccm[m.c] = (ccm[m.c] || 0) + 1;
    const started = ms.filter((m) => !m.fut && m.c !== 9 && m.c !== 10);
    const fut = ms.filter((m) => m.fut);
    const cur = ms.filter((m) => (m.cur || m.ex) && !m.fut);
    const cc = Object.entries(ccm).sort((a, b) => b[1] - a[1]);
    const links = [];
    const curIn = (c) => ms.some((m) => m.c === c && (m.cur || m.ex) && !m.fut);
    const gk = S.gastosKeys || new Set();
    if (p.cam) {
      links.push(`<a href="https://www.camara.leg.br/deputados/${p.cam}" target="_blank" rel="noreferrer">Perfil na Câmara ↗</a>`);
      if (curIn(6)) links.push(`<a href="/politica/#perfil/c/${p.cam}">Votos e projetos neste site</a>`);
      if (gk.has('c-' + p.cam)) links.push(`<a href="${S.pages.gastos ? `/politica/gastos/#p=c-${p.cam}` : `/politica/#perfil/c/${p.cam}/gastos`}">Gastos da cota parlamentar</a>`);
    }
    if (p.sen) {
      links.push(`<a href="https://www25.senado.leg.br/web/senadores/senador/-/perfil/${p.sen}" target="_blank" rel="noreferrer">Perfil no Senado ↗</a>`);
      if (curIn(5)) links.push(`<a href="/politica/#perfil/s/${p.sen}">Votos e projetos neste site</a>`);
      if (gk.has('s-' + p.sen)) links.push(`<a href="${S.pages.gastos ? `/politica/gastos/#p=s-${p.sen}` : `/politica/#perfil/s/${p.sen}/gastos`}">Gastos da cota parlamentar</a>`);
    }
    const pm = (p.pm || []).map(([id, w]) => `<button type="button" class="linkish" data-id="${esc(id)}">ver registro ${esc(id)}</button>${w === 'doc' ? ' (mesmo documento na fonte, mas nome ou data diferentes)' : ' (mesmo nome, sem documento para confirmar)'}`);
    const pp = segs.map(([s, a, b]) => `<span class="chip">${esc(s)} <span class="muted">&nbsp;${a === b ? a : a + '–' + b}</span></span>`).join('<span class="arr" aria-hidden="true">→</span>');
    const changes = Math.max(0, segs.length - 1);
    const mandList = ms.slice().reverse().map((m) => {
      const src = (m.src || []).map((s) => SRC[s] ? (SRC[s][1] ? `<a href="${SRC[s][1]}" target="_blank" rel="noreferrer">${SRC[s][0]}</a>` : SRC[s][0]) : s).join(', ');
      const votes = m.v ? `${nf.format(m.v)} votos` : '';
      const exd = (m.exd || []).length ? `Exercício registrado pelo Senado: ${m.exd.map(([a, b]) => `${fmtD(a)} a ${b ? fmtD(b) : 'hoje'}`).join('; ')}.` : '';
      const status = m.fut ? '<span class="chip fut">começa em 2027</span>' : (m.cur || m.ex) ? '<span class="chip cur">em curso</span>' : '';
      return `<li>
        <div class="t"><b>${esc(cargoN(m.c, g))}</b><span>${esc(locName(m.c, m.l, m.mn))}</span><span class="per">${esc(periodo(m))}</span>${status}${m.sup ? '<span class="chip">mandato-tampão (eleição suplementar)</span>' : ''}</div>
        <p>${how(m, g)}${m.el ? ` na eleição de ${m.el}` : ''}${m.p ? ' · partido: ' + partyLabel(m.p) : ''}${votes ? ' · ' + votes : ''}</p>
        ${m.nota ? `<p>${esc(m.nota)}${m.fonte ? ` <a href="${esc(m.fonte)}" target="_blank" rel="noreferrer">Fonte ↗</a>` : ''}</p>` : ''}
        ${exd ? `<p>${esc(exd)}</p>` : ''}
        <p class="note-sm">Fonte: ${src || '—'}</p>
      </li>`;
    }).join('');
    const elei = els.slice().reverse().map((e) => {
      const { ano, c, l: loc, p: part, v1, v2, r: res, sup } = e;
      const ok = 'EQMV'.includes(res);
      return `<tr><td>${ano}${sup ? '<br><span class="muted">suplementar</span>' : ''}</td><td>${esc(cargoN(c, g))}</td><td>${esc(locName(c, loc))}</td><td>${esc(part || '—')}</td><td class="num">${v1 != null ? nf.format(v1) : '—'}${v2 != null ? `<br><span class="muted">2º t.: ${nf.format(v2)}</span>` : ''}</td><td class="${ok ? 'res-ok' : res === 'S' ? 'res-sup' : ''}">${esc(RES[res] || res)}</td></tr>`;
    }).join('');
    return `<div class="pm-head">
        <h2 id="pm-title" tabindex="-1">${esc(p.n)}</h2>
        ${p.nc && fold(p.nc) !== fold(p.n) ? `<p class="muted">Nome completo: ${esc(p.nc)}</p>` : ''}
        <div class="pp-meta">${cur.length ? '<span class="chip cur">com mandato agora</span>' : ''}${fut.length ? '<span class="chip fut">eleito para mandato que começa em 2027</span>' : ''}<span class="chip">código ${esc(p.i)}</span></div>
        ${links.length ? `<div class="pm-links">${links.join('')}</div>` : ''}
      </div>
      ${pm.length ? `<div class="pm-warn"><b>Possivelmente a mesma pessoa:</b> ${pm.join('; ')}. Os registros ficam separados porque a fonte não permite confirmar.</div>` : ''}
      <div class="pm-sec"><h3>Resumo</h3>
        <div class="kpis">
          <div class="kpi"><b>${p.nm}</b><span>${p.nm === 1 ? 'mandato iniciado' : 'mandatos iniciados'} desde 1985</span></div>
          <div class="kpi"><b>${String(p.ym).replace('.', ',')}</b><span>anos com mandato (até hoje)</span></div>
          <div class="kpi"><b>${new Set(segs.map((x) => x[0])).size}</b><span>${new Set(segs.map((x) => x[0])).size === 1 ? 'partido' : 'partidos diferentes'}${changes ? ` (${changes} ${changes > 1 ? 'mudanças' : 'mudança'} de sigla)` : ''}</span></div>
          ${fut.length ? `<div class="kpi"><b>${fut.length}</b><span>a começar em 2027</span></div>` : ''}
        </div>
        ${cc.length ? `<p class="note-sm">Por cargo: ${cc.map(([c, n]) => `${esc(cargoN(+c, g))}: ${n}`).join(' · ')}.</p>` : ''}
      </div>
      <div class="pm-sec"><h3>Linha do tempo</h3>${timeline(ms, g)}<p class="note-sm">Cada barra é um mandato, pelo período oficial do cargo. Tracejado: ainda vai começar. Amarelo: assumiu como suplente.</p></div>
      <div class="pm-sec"><h3>Mandatos (${ms.filter((m) => m.c !== 9 && m.c !== 10).length})</h3><ul class="pm-mand">${mandList || '<li>Sem mandatos registrados.</li>'}</ul></div>
      ${pp ? `<div class="pm-sec"><h3>Partidos ao longo do tempo</h3><div class="pm-parties">${pp}</div><p class="note-sm">Partido na época de cada eleição (TSE) e trocas registradas pela Câmara e pelo Senado. Nomes antigos e fusões estão explicados em <a href="#partidos">Partidos que mudaram</a>.</p></div>` : ''}
      <div class="pm-sec"><h3>Todas as candidaturas (${els.length})</h3>
        <div class="table-wrap"><table class="data-table tabela-cards pm-table"><thead><tr><th scope="col">Ano</th><th scope="col">Cargo</th><th scope="col">Onde</th><th scope="col">Partido</th><th scope="col" class="num">Votos</th><th scope="col">Resultado</th></tr></thead><tbody>${elei || '<tr><td colspan="6">Sem candidaturas nos dados do TSE (1989–2026).</td></tr>'}</tbody></table></div>
        <p class="note-sm">Votos nominais somados de todas as zonas eleitorais (TSE). Em 1989 e 1990 a soma é por estado. “2º turno” sem resultado final: eleição de 2026 ainda em andamento.</p>
      </div>`;
  }
  const fmtD = (s) => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '';

  // ---------- modelo da pessoa (ver README dos dados) ----------
  const NOW_MO = new Date().getFullYear() * 12 + new Date().getMonth();
  // período oficial (meses absolutos ano*12+mês-1) de um mandato ganho na eleição do TSE
  function perTSE(ano, c, supM) {
    if (MUNI.has(c)) {
      if (supM) { const fim = ano + (4 - ano % 4) % 4; return [ano * 12 + supM, (fim + 1) * 12]; }
      return [(ano + 1) * 12, (ano + 5) * 12];
    }
    if (c >= 1 && c <= 4) {
      if (supM) { const fim = ano + (4 - (ano - 2) % 4) % 4; return [ano * 12 + supM, (fim + 1) * 12]; }
      if (ano === 1989) return [1990 * 12 + 2, 1995 * 12];
      return [(ano + 1) * 12, (ano + 5) * 12];
    }
    if (c === 5 || c === 9 || c === 10) return [(ano + 1) * 12 + 1, (ano + 9) * 12 + 1];
    return [(ano + 1) * 12 + 1, (ano + 5) * 12 + 1];
  }
  // candidaturas: [ano, cargo, local, partido, resultado, votos 1º t., votos 2º t., mês se suplementar, nome de urna (só quando muda)]
  function elections(p) {
    let urna = null;
    return (p.e || []).map((e) => {
      if (e[8]) urna = e[8];
      return { ano: e[0], c: e[1], l: e[2], p: e[3] || '', r: e[4], v1: e[5] ?? null, v2: e[6] ?? null, sup: e[7] || 0, urna };
    });
  }
  function mandates(p) {
    const out = (p.m || []).map((m) => {
      const x = m[10] || {};
      return { c: m[0], l: m[1], d: [m[2], m[3]], p: m[4], el: m[5] || null, r: m[6], v: m[7] || 0, src: String(m[8]).split(''),
        cur: !!(m[9] & 1), fut: !!(m[9] & 2), ex: !!(m[9] & 8), tmp: !!(m[9] & 16), nota: x.nota, fonte: x.fonte, exd: x.exd, tit: x.tit, mn: x.mn };
    });
    for (const e of elections(p)) {
      if (!'EQMV'.includes(e.r)) continue;
      if (out.some((m) => m.c === e.c && m.el === e.ano)) continue;
      const d = perTSE(e.ano, e.c, e.sup);
      out.push({ c: e.c, l: e.l, d, p: e.p, el: e.ano, r: e.r, v: e.v2 || e.v1 || 0, src: ['t'], sup: e.sup,
        fut: d[0] > NOW_MO, cur: d[0] <= NOW_MO && NOW_MO < d[1] });
    }
    return out.sort((a, b) => a.d[0] - b.d[0] || a.c - b.c);
  }
  function partySegs(p) {
    const ev = [];
    for (const e of elections(p)) if (e.p) ev.push([`${e.ano}-10-01`, e.p]);
    for (const m of (p.m || [])) if (m[4] && String(m[8]).includes('x')) ev.push([`${Math.floor(m[2] / 12)}-01-01`, m[4]]);
    for (const [d, s] of (p.pe || [])) ev.push([d, s]);
    ev.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    const segs = [];
    for (const [d, s] of ev) { const y = +d.slice(0, 4); const l = segs[segs.length - 1]; if (l && l[0] === s) l[2] = Math.max(l[2], y); else segs.push([s, y, y]); }
    return segs;
  }

  // Mesmo nome completo no mesmo estado (o id do mapa junta homônimos): lista para escolher
  async function chooseAmong(ids) {
    lastFocus = document.activeElement;
    if (!modal.open) { try { modal.showModal(); } catch (_) { modal.setAttribute('open', ''); } }
    const ps = await Promise.all(ids.map((i) => getJSON(`p/${i.slice(0, 2)}.json`).then((sh) => [i, sh[i]]).catch(() => [i, null])));
    if (!S.mun) S.mun = await getJSON('municipios.json').catch(() => ({}));
    const desc = (p) => {
      const ms = mandates(p).filter((m) => m.c !== 9 && m.c !== 10);
      return ms.map((m) => `${cargoN(m.c, p.g)} · ${locName(m.c, m.l, m.mn)} · ${periodo(m)}`).slice(0, 4).join('; ');
    };
    $('#pm-body').innerHTML = `<div class="pm-head"><h2 id="pm-title" tabindex="-1">Qual destas pessoas?</h2>
      <p class="muted">O link veio do mapa, que identifica políticos pelo nome completo e estado. Há ${ids.length} registros com esse mesmo nome neste estado: podem ser homônimos ou a mesma pessoa em eleições que a fonte não permite ligar com certeza. Escolha um:</p></div>
      <ul class="pm-mand">${ps.map(([i, p]) => p ? `<li><div class="t"><button type="button" class="linkish" data-id="${esc(i)}"><b>${esc(p.n)}</b></button><span class="muted">código ${esc(i)}</span></div><p>${esc(desc(p) || 'sem mandatos')}</p></li>` : '').join('')}</ul>`;
    $('#pm-title')?.focus({ preventScroll: true });
  }

  // ---------- ranking ----------
  let rank = null;
  async function initRanking() {
    try { rank = await getJSON('ranking.json'); } catch (_) { $('#rank-list').innerHTML = '<li class="err">Ranking indisponível agora.</li>'; return; }
    const tabs = [['geral', 'Geral'], ...[13, 11, 7, 6, 5, 3, 12].filter((c) => rank[c]).map((c) => [String(c), CARGO_PL[c]])];
    $('#rank-tabs').innerHTML = tabs.map(([k, l], i) => `<button type="button" role="tab" aria-selected="${i === 0}" ${i ? 'tabindex="-1"' : ''} data-k="${k}">${esc(l)}</button>`).join('');
    const show = (k) => {
      $('#rank-tabs').querySelectorAll('[role=tab]').forEach((b) => { const on = b.dataset.k === k; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
      const list = (rank[k] || []).slice(0, 30);
      $('#rank-list').innerHTML = list.map((r) => {
        if (k === 'geral') {
          const [id, n, nm, ym, cc] = r;
          const top = Object.entries(cc).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, v]) => `${CARGO[c][0]} ${v}×`).join(', ');
          return `<li><span><button type="button" class="linkish" data-id="${esc(id)}">${esc(n)}</button><span class="s">${esc(top)}</span></span><span class="v">${nm} mand.<br><span class="muted">${String(ym).replace('.', ',')} anos</span></span></li>`;
        }
        const [id, n, nc, nm, ym] = r;
        return `<li><span><button type="button" class="linkish" data-id="${esc(id)}">${esc(n)}</button><span class="s">${nm} mandatos no total · ${String(ym).replace('.', ',')} anos</span></span><span class="v">${nc}× ${esc(CARGO[k][0].toLowerCase())}</span></li>`;
      }).join('');
    };
    $('#rank-tabs').addEventListener('click', (e) => { const b = e.target.closest('[role=tab]'); if (b) show(b.dataset.k); });
    $('#rank-tabs').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const bs = [...$('#rank-tabs').querySelectorAll('[role=tab]')]; const i = bs.indexOf(document.activeElement);
      const n = bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length]; n.focus(); show(n.dataset.k);
    });
    show('geral');
  }

  // ---------- partidos / fontes ----------
  function renderParties() {
    const P = S.part; if (!P) return;
    $('#part-note').innerHTML = esc(P.nota) + ` Fonte: <a href="${esc(P.fonte.url)}" target="_blank" rel="noreferrer">${esc(P.fonte.nome)}</a>.`;
    $('#part-list').innerHTML = P.familias.filter((f) => f.siglas.length > 1 || f.id === 'psd').map((f) => `<div class="pol-card"><h3>${esc(f.nome)}</h3><p>${esc(f.texto)}</p><div class="sig">${f.siglas.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</div></div>`).join('');
  }
  function renderMeta() {
    const M = S.meta; if (!M) return;
    const tot = Object.values(M.mandatos_por_cargo).reduce((a, b) => a + b.mandatos, 0);
    $('#st-pessoas').textContent = nf.format(M.pessoas);
    $('#st-mandatos').textContent = nf.format(tot);
    $('#st-anos').textContent = '1989–2026';
    const d = M.gerado_em.split('-').reverse().join('/');
    $('#st-upd').textContent = d; $('#ft-upd').textContent = d;
    $('#cov-table tbody').innerHTML = Object.entries(M.mandatos_por_cargo).map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td class="num">${nf.format(v.mandatos)}</td><td>${v.primeiro_ano}</td><td>${v.ultimo_ano}</td></tr>`).join('');
    $('#src-list').innerHTML = M.fontes.map((f) => `<li><a href="${esc(f.url)}" target="_blank" rel="noreferrer">${esc(f.nome)}</a>${f.arquivos ? `<br><span class="mono note-sm">${esc(f.arquivos)}</span>` : ''}</li>`).join('') + `<li>Câmara e Senado baixados em ${esc((M.congresso_baixado_em || '').slice(0, 10).split('-').reverse().join('/'))}; TSE processado em ${esc(d)}.</li>`;
    $('#gap-list').innerHTML = M.lacunas.map((g) => `<li>${esc(g)}</li>`).join('');
    const sz = M.tamanho_indices_mb; if (sz) $('#all-size').textContent = `(baixa ~${String(sz).replace('.', ',')} MB)`;
  }

  // ---------- início ----------
  let deb = 0;
  form.addEventListener('input', (e) => {
    if (e.target === F.uf) return;
    clearTimeout(deb); deb = setTimeout(apply, e.target === F.q ? 160 : 0);
  });
  F.uf.addEventListener('change', () => { fillMunicipios(); F.mun.value = ''; apply(); });
  form.addEventListener('submit', (e) => { e.preventDefault(); apply(); });
  form.addEventListener('reset', () => setTimeout(() => { F.ord.value = 'nome'; fillMunicipios(); apply(); }, 0));

  async function start() {
    const qid = new URLSearchParams(location.search).get('id');
    readURL();
    try {
      [S.meta, S.part, S.mun] = await Promise.all([getJSON('meta.json'), getJSON('partidos.json'), getJSON('municipios.json')]);
    } catch (e) {
      $('#pp-count').innerHTML = `<span class="err">Não foi possível carregar os dados (${esc(e.message)}).</span>`;
      return;
    }
    for (const f of S.part.familias) for (const s of f.siglas) S.famOf[s] = f.id;
    fillSelects();
    readURL();
    fillMunicipios();
    renderMeta(); renderParties();
    fetch('/politica/paginas.json', { cache: 'no-cache' }).then((r) => r.ok ? r.json() : {}).then((j) => { S.pages = (j && j.paginas) || {}; }).catch(() => {});
    await apply();
    initRanking();
    // links vindos do mapa: ?id=<id daqui> ou ?id=<slug-uf do mapa> (ver politica/data/mapa/README.md)
    if (qid && !location.hash) {
      let to = /^[a-z2-7]{10}$/.test(qid) ? qid : null;
      const mu = /-([a-z]{2})$/.exec(qid || '');
      if (!to && mu) {
        const m = await getJSON(`mapa_ids/${mu[1].toUpperCase()}.json`).catch(() => ({}));
        const v = m[qid];
        if (Array.isArray(v) && v.length > 1) { history.replaceState(null, '', location.pathname + location.search); await chooseAmong(v); return; }
        to = Array.isArray(v) ? v[0] : v || null;
      }
      history.replaceState(null, '', location.pathname + location.search + (to ? '#p/' + to : ''));
      if (!to) $('#pp-count').insertAdjacentHTML('beforeend', ' <span class="err">O político do link não foi encontrado; use a busca.</span>');
    }
    route(false);
  }
  start();
})();
