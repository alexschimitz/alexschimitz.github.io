/* Gastos públicos federais — politica/gastos
   Lê os arquivos resumidos em ../data/gastos/ (gerados por scripts/politica/gastos/*.py).
   Sem bibliotecas: gráficos em SVG puro. */
(() => {
  'use strict';
  const D = '../data/gastos/';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const cache = new Map();
  const getJSON = (p) => {
    if (!cache.has(p)) cache.set(p, fetch(D + p, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(p + ': HTTP ' + r.status); return r.json(); }).catch((e) => { cache.delete(p); throw e; }));
    return cache.get(p);
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  // ---------------------------------------------------------------- formatação
  const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  function brl(v, opts = {}) {
    if (v == null || !isFinite(v)) return '—';
    const a = Math.abs(v); const s = v < 0 ? '−' : '';
    if (a >= 1e12) return `${s}R$ ${nf2.format(a / 1e12)} tri`;
    if (a >= 1e9) return `${s}R$ ${nf1.format(a / 1e9)} bi`;
    if (a >= 1e6) return `${s}R$ ${nf1.format(a / 1e6)} mi`;
    if (a >= 1e4 && !opts.full) return `${s}R$ ${nf1.format(a / 1e3)} mil`;
    if (a >= 100) return `${s}R$ ${nf0.format(a)}`;
    return `${s}R$ ${nf2.format(a)}`;
  }
  const pct = (v, d = 1) => (isFinite(v) ? (d ? nf1 : nf0).format(v * 100) + '%' : '—');
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const axisFmt = (v, o) => (o && o.axis ? brl(v).replace('R$ ', '') : brl(v));

  // ---------------------------------------------------------------- dicionários em linguagem simples
  const FUNCOES = {
    '01': ['Legislativa', 'Congresso Nacional (Câmara e Senado) e Tribunal de Contas da União'],
    '02': ['Judiciária', 'Tribunais superiores, Justiça Federal, do Trabalho, Eleitoral e Militar'],
    '03': ['Essencial à Justiça', 'Ministério Público da União, Defensoria Pública e Advocacia-Geral da União'],
    '04': ['Administração', 'Gestão do próprio governo: prédios, sistemas, planejamento, arrecadação de impostos'],
    '05': ['Defesa Nacional', 'Forças Armadas: Exército, Marinha e Aeronáutica'],
    '06': ['Segurança Pública', 'Polícia Federal, Polícia Rodoviária Federal, Força Nacional'],
    '07': ['Relações Exteriores', 'Embaixadas, consulados e diplomacia'],
    '08': ['Assistência Social', 'Ajuda a quem mais precisa: Bolsa Família, BPC (idosos e pessoas com deficiência de baixa renda)'],
    '09': ['Previdência Social', 'Aposentadorias e pensões do INSS e dos servidores federais'],
    '10': ['Saúde', 'SUS: hospitais, remédios, vacinas e repasses a estados e municípios'],
    '11': ['Trabalho', 'Seguro-desemprego, abono salarial e qualificação profissional'],
    '12': ['Educação', 'Universidades e institutos federais, Fundeb, merenda, livros didáticos, Fies'],
    '13': ['Cultura', 'Patrimônio histórico, museus, incentivo à cultura'],
    '14': ['Direitos da Cidadania', 'Direitos humanos, povos indígenas, defesa do consumidor, sistema prisional'],
    '15': ['Urbanismo', 'Obras nas cidades: mobilidade, infraestrutura urbana'],
    '16': ['Habitação', 'Moradia popular'],
    '17': ['Saneamento', 'Água tratada e esgoto'],
    '18': ['Gestão Ambiental', 'Meio ambiente, florestas, recursos hídricos, clima'],
    '19': ['Ciência e Tecnologia', 'Pesquisa científica, bolsas, institutos de pesquisa'],
    '20': ['Agricultura', 'Agropecuária, crédito rural, defesa sanitária animal e vegetal'],
    '21': ['Organização Agrária', 'Reforma agrária e agricultura familiar'],
    '22': ['Indústria', 'Apoio à indústria, mineração, propriedade industrial'],
    '23': ['Comércio e Serviços', 'Comércio exterior, turismo, micro e pequenas empresas'],
    '24': ['Comunicações', 'Correios, telecomunicações, radiodifusão'],
    '25': ['Energia', 'Energia elétrica, petróleo e combustíveis'],
    '26': ['Transporte', 'Rodovias, ferrovias, portos, aeroportos e hidrovias'],
    '27': ['Desporto e Lazer', 'Esporte e lazer'],
    '28': ['Encargos Especiais', 'Dívida pública (juros e amortização), repasses obrigatórios a estados e municípios (como FPE e FPM) e outros gastos que não pertencem a uma área só'],
    '99': ['Reserva de Contingência', 'Dinheiro reservado para imprevistos'],
  };
  const FUN_BY_NAME = {};
  Object.entries(FUNCOES).forEach(([k, v]) => { FUN_BY_NAME[norm(v[0])] = k; });
  const FUN_OLD = {
    'legislativa': 'Congresso Nacional e Tribunal de Contas da União',
    'judiciaria': 'Tribunais e Justiça Federal',
    'administracao e planejamento': 'Gestão do governo e encargos gerais (inclui a dívida pública e repasses a estados e municípios)',
    'agricultura': 'Agropecuária, abastecimento, reforma agrária',
    'comunicacoes': 'Correios e telecomunicações',
    'defesa nacional e seguranca publica': 'Forças Armadas e polícias federais',
    'desenvolvimento regional': 'Programas regionais (Nordeste, Amazônia) e repasses',
    'educacao e cultura': 'Educação e cultura (juntas até 1999)',
    'energia e recursos minerais': 'Energia e mineração',
    'habitacao e urbanismo': 'Moradia e obras urbanas',
    'industria comercio e servicos': 'Indústria, comércio e turismo',
    'relacoes exteriores': 'Embaixadas e diplomacia',
    'saude e saneamento': 'Saúde e saneamento (juntos até 1999)',
    'trabalho': 'Seguro-desemprego e emprego',
    'assistencia e previdencia': 'Aposentadorias, pensões e assistência social (juntas até 1999)',
    'transporte': 'Rodovias, ferrovias, portos e aeroportos',
  };
  const GND = {
    '1': ['Pessoal', 'Salários, aposentadorias e pensões de servidores públicos federais'],
    '2': ['Juros da dívida', 'Juros e encargos da dívida pública'],
    '3': ['Custeio e benefícios', 'Benefícios do INSS, Bolsa Família, repasses a estados e municípios, contas, serviços e manutenção'],
    '4': ['Investimentos', 'Obras e compra de equipamentos'],
    '5': ['Inversões financeiras', 'Empréstimos e participação em empresas (ex.: Fies, crédito rural, capital de estatais)'],
    '6': ['Amortização da dívida', 'Pagamento do valor principal da dívida pública'],
    '9': ['Reserva de contingência', 'Reserva para imprevistos'],
    '0': ['Não classificado', 'Reserva ou valor sem grupo definido'],
  };
  const GRUPOS = [
    ['pessoal e encargos sociais', 'Pessoal', 'Salários, aposentadorias e pensões de servidores federais', '--g-c2'],
    ['juros e encargos da divida', 'Juros da dívida', 'Juros e encargos da dívida pública', '--g-c4'],
    ['beneficios previdenciarios', 'Aposentadorias do INSS', 'Benefícios do INSS (Regime Geral)', '--g-c1'],
    ['transferencias a estados, df e municipios', 'Repasses a estados e municípios', 'Dinheiro transferido a estados, DF e municípios (FPE, FPM, SUS, Fundeb…)', '--g-c6'],
    ['demais despesas correntes', 'Outros custeios', 'Bolsa Família, BPC, seguro-desemprego, manutenção de serviços, contas', '--g-c3'],
    ['investimentos', 'Investimentos', 'Obras e equipamentos', '--g-c7'],
    ['inversoes financeiras', 'Inversões financeiras', 'Empréstimos e participação em empresas (Fies, crédito, estatais)', '--g-c5'],
    ['amortizacao da divida', 'Amortização da dívida', 'Pagamento do principal da dívida (sem a rolagem, a partir de 1994)', '--g-c9'],
    ['outras despesas de capital', 'Outras de capital', 'Outras despesas de capital (até 1994)', '--g-c8'],
  ];
  const GRUPO_BY = {}; GRUPOS.forEach((g) => { GRUPO_BY[g[0]] = g; });
  const keyName = (n) => norm(n).replace(/[0-9¹²³⁴]+$/, '').replace(/\s+/g, ' ').trim();

  // ---------------------------------------------------------------- estado
  const S = {};
  const fator = (y) => (S.idx && S.idx.ipca.fator_para_hoje[String(y)]) || null;
  const pop = (y) => (S.idx && S.idx.populacao[String(y)]) || null;
  const ultimoMes = () => { const [y, m] = ((S.idx && S.idx.ipca.ultimo_mes) || '').split('-'); return y ? `${MESES[+m - 1]}/${y}` : ''; };
  const REAL_FROM = 1995; // antes disso, moedas e hiperinflação

  // ---------------------------------------------------------------- tooltip
  const tip = document.createElement('div'); tip.className = 'g-tip'; tip.hidden = true; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip);
  const showTip = (html, x, y) => {
    tip.innerHTML = html; tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let left = x + 14; let top = y + 14;
    if (left + r.width > window.innerWidth - 8) left = Math.max(8, x - r.width - 14);
    if (top + r.height > window.innerHeight - 8) top = Math.max(8, y - r.height - 14);
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
  };
  const hideTip = () => { tip.hidden = true; };
  document.addEventListener('pointermove', (e) => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t) showTip(t.getAttribute('data-tip'), e.clientX, e.clientY); else if (!tip.hidden) hideTip();
  }, { passive: true });
  document.addEventListener('pointerdown', (e) => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t && e.pointerType !== 'mouse') showTip(t.getAttribute('data-tip'), e.clientX, e.clientY);
  }, { passive: true });
  document.addEventListener('scroll', hideTip, { passive: true });

  // ---------------------------------------------------------------- gráficos SVG
  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }
  function barChart(el, data, opts = {}) {
    if (!el) return;
    if (!data.length) { el.innerHTML = '<p class="g-loading">Sem dados para este filtro.</p>'; return; }
    const W = Math.max(280, el.clientWidth || 600); const H = opts.height || Math.round(Math.min(320, Math.max(200, W * 0.36)));
    const pad = { l: 58, r: 8, t: 10, b: 26 };
    const max = niceMax(Math.max(...data.map((d) => d.v || 0)) || 1);
    const iw = W - pad.l - pad.r; const ih = H - pad.t - pad.b;
    const bw = iw / data.length; const gap = Math.min(6, bw * 0.22);
    const fmt = opts.fmt || axisFmt;
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">`;
    for (let i = 0; i <= 4; i++) {
      const v = (max * i) / 4; const y = pad.t + ih - (ih * i) / 4;
      s += `<g class="grid"><line x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}"/></g><text x="${pad.l - 6}" y="${y + 4}" text-anchor="end">${esc(fmt(v, { axis: true }))}</text>`;
    }
    const every = Math.ceil(data.length / Math.max(3, Math.floor(iw / 44)));
    data.forEach((d, i) => {
      const x = pad.l + i * bw + gap / 2; const w = Math.max(1, bw - gap);
      const tipTxt = d.tip || `<b>${esc(d.x)}</b>${esc(fmt(d.v))}`;
      s += `<g data-tip="${esc(tipTxt)}">`;
      if (d.parts) {
        let acc = 0;
        d.parts.forEach((p) => { const h = (ih * (p.v || 0)) / max; s += `<rect class="bar ${p.cls || ''}" x="${x}" y="${pad.t + ih - acc - h}" width="${w}" height="${Math.max(0, h)}" rx="2"${p.color ? ` style="fill:var(${p.color})"` : ''}/>`; acc += h; });
      } else {
        const h = (ih * (d.v || 0)) / max;
        s += `<rect class="bar ${d.cls || ''}" x="${x}" y="${pad.t + ih - h}" width="${w}" height="${Math.max(0, h)}" rx="2"/>`;
      }
      s += `<rect class="hit" x="${pad.l + i * bw}" y="${pad.t}" width="${bw}" height="${ih}"/></g>`;
      if (i % every === 0 || i === data.length - 1) s += `<text x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${esc(d.x)}</text>`;
    });
    el.innerHTML = s + '</svg>';
  }
  function stackChart(el, years, rows, keys) {
    if (!el) return;
    const W = Math.max(280, el.clientWidth || 600); const H = Math.round(Math.min(300, Math.max(190, W * 0.3)));
    const pad = { l: 36, r: 6, t: 8, b: 24 }; const iw = W - pad.l - pad.r; const ih = H - pad.t - pad.b;
    const bw = iw / years.length; const gap = Math.min(3, bw * 0.15);
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">`;
    [0, 0.25, 0.5, 0.75, 1].forEach((p) => { const y = pad.t + ih - ih * p; s += `<g class="grid"><line x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}"/></g><text x="${pad.l - 4}" y="${y + 4}" text-anchor="end">${p * 100}%</text>`; });
    const every = Math.ceil(years.length / Math.max(3, Math.floor(iw / 40)));
    years.forEach((y, i) => {
      const r = rows[i]; const tot = keys.reduce((a, k) => a + (r[k[0]] || 0), 0) || 1;
      const x = pad.l + i * bw + gap / 2; const w = Math.max(1, bw - gap);
      let acc = 0;
      const tipLines = keys.filter((k) => r[k[0]]).map((k) => `${esc(k[1])}: ${pct(r[k[0]] / tot)}`).join('<br>');
      s += `<g data-tip="${esc(`<b>${y}${r.__partial ? ' (parcial)' : ''}</b>${tipLines}`)}">`;
      keys.forEach((k) => {
        const h = (ih * (r[k[0]] || 0)) / tot; if (h <= 0) return;
        s += `<rect x="${x}" y="${pad.t + ih - acc - h}" width="${w}" height="${h}" style="fill:var(${k[3]})"/>`; acc += h;
      });
      s += `<rect class="hit" x="${pad.l + i * bw}" y="${pad.t}" width="${bw}" height="${ih}"/></g>`;
      if (i % every === 0 || i === years.length - 1) s += `<text x="${x + w / 2}" y="${H - 7}" text-anchor="middle">${y}</text>`;
    });
    el.innerHTML = s + '</svg>';
  }
  function hbars(el, items, opts = {}) {
    if (!el) return;
    if (!items.length) { el.innerHTML = '<li class="g-loading">Sem dados para este filtro.</li>'; return; }
    const max = Math.max(...items.map((i) => i.v || 0)) || 1;
    el.innerHTML = items.map((i) => {
      const inner = `<span class="lbl">${esc(i.label)}${i.sub ? `<small>${esc(i.sub)}</small>` : ''}</span><span class="val">${esc(i.txt)}</span><span class="track"><span class="fill" style="width:${Math.max(0.3, (100 * (i.v || 0)) / max).toFixed(2)}%${i.color ? `;background:var(${i.color})` : ''}"></span></span>`;
      return opts.click ? `<li><button type="button" data-key="${esc(i.key)}" aria-pressed="${opts.selected === i.key}">${inner}</button></li>` : `<li><div class="row">${inner}</div></li>`;
    }).join('');
  }
  function segValue(name) { const b = $(`[data-seg="${name}"] [aria-checked="true"]`); return b ? b.dataset.v : ''; }
  function bindSeg(name, cb) {
    const g = $(`[data-seg="${name}"]`); if (!g) return;
    g.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      $$('button', g).forEach((x) => x.setAttribute('aria-checked', String(x === b))); cb(b.dataset.v);
    });
    g.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const bs = $$('button', g); const i = bs.findIndex((x) => x.getAttribute('aria-checked') === 'true');
      const n = bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length]; n.click(); n.focus(); e.preventDefault();
    });
  }
  function fillYears(sel, years, value) {
    sel.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join('');
    sel.value = String(value);
  }
  function sortableTable(table, state, render) {
    $$('th[data-k]', table).forEach((th) => {
      th.tabIndex = 0;
      const go = () => {
        const k = th.dataset.k;
        if (state.sort === k) state.dir = -state.dir; else { state.sort = k; state.dir = (th.classList.contains('txt') ? 1 : -1); }
        $$('th[data-k]', table).forEach((x) => x.removeAttribute('aria-sort'));
        th.setAttribute('aria-sort', state.dir > 0 ? 'ascending' : 'descending');
        render();
      };
      th.addEventListener('click', go);
      th.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  }
  const cmp = (k, dir) => (a, b) => {
    const x = a[k]; const y = b[k];
    if (typeof x === 'string' || typeof y === 'string') return dir * String(x || '').localeCompare(String(y || ''), 'pt-BR');
    return dir * ((x || 0) - (y || 0));
  };
  const rowKeys = (tbody, cb) => {
    tbody.addEventListener('click', (e) => { const tr = e.target.closest('tr[data-key]'); if (tr) cb(tr.dataset.key, tr); });
    tbody.addEventListener('keydown', (e) => { if (e.key !== 'Enter' && e.key !== ' ') return; const tr = e.target.closest('tr[data-key]'); if (tr) { e.preventDefault(); cb(tr.dataset.key, tr); } });
  };
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  const resizers = [];
  function onResize(fn) { resizers.push(fn); }
  let lastW = window.innerWidth;
  window.addEventListener('resize', debounce(() => { if (Math.abs(window.innerWidth - lastW) < 20) return; lastW = window.innerWidth; resizers.forEach((f) => { try { f(); } catch (e) { console.warn(e); } }); }, 200), { passive: true });

  // ---------------------------------------------------------------- série do Tesouro
  function serieYear(y) {
    const f = S.serie.funcao[String(y)]; const g = S.serie.grupo[String(y)];
    if (!f) return null;
    const it = f.itens; const names = it.map((r) => keyName(r[0]));
    const iSub = names.indexOf('subtotal'); const iTot = names.findIndex((n) => n.startsWith('total'));
    const end = iSub >= 0 ? iSub : iTot;
    const funcs = it.slice(0, end).map((r) => ({ name: r[0].replace(/[0-9¹²³⁴]+$/, '').trim(), v: r[1] }));
    const sem = iSub >= 0 ? it[iSub][1] : it[iTot][1];
    const tot = iTot >= 0 ? it[iTot][1] : sem;
    const grupos = {};
    if (g) g.itens.forEach((r) => { const k = keyName(r[0]); if (GRUPO_BY[k] && !(k in grupos)) grupos[k] = r[1]; });
    const partial = !/DEZEMBRO|EXERC/i.test(f.periodo || '');
    return { y, funcs, sem, tot, refin: tot - sem, grupos, partial, periodo: f.periodo, old: y < 2000, notas: f.notas || [] };
  }
  const serieYears = () => Object.keys(S.serie.funcao).map(Number).sort((a, b) => a - b);
  function lastFullYear() { const ys = serieYears(); for (let i = ys.length - 1; i >= 0; i--) { if (!serieYear(ys[i]).partial) return ys[i]; } return ys[ys.length - 1]; }
  const periodoCurto = (p) => { const m = /([A-ZÇ]+) DE (\d{4})/.exec(p || ''); return m ? `jan–${m[1].slice(0, 3).toLowerCase()}/${m[2]}` : p; };

  // ================================================================ VISÃO GERAL
  function initVisao() {
    const ys = serieYears().filter((y) => y >= REAL_FROM);
    const from = $('#tot-from'); const to = $('#tot-to');
    fillYears(from, ys, ys[0]); fillYears(to, ys, ys[ys.length - 1]);
    const draw = () => {
      const mode = segValue('tot-mode'); const refin = $('#tot-refin').checked;
      let a = +from.value; let b = +to.value; if (a > b) [a, b] = [b, a];
      const data = [];
      for (let y = a; y <= b; y++) {
        const s = serieYear(y); if (!s) continue;
        const base = refin ? s.tot : s.sem; let v = base;
        if (mode === 'real') v = base * fator(y);
        if (mode === 'pc') v = (base * fator(y)) / pop(y);
        const t = `<b>${y}${s.partial ? ` (parcial: ${esc(periodoCurto(s.periodo))})` : ''}</b>${mode === 'pc' ? `${brl(v)} por brasileiro (corrigido)` : brl(v)}${mode !== 'nominal' ? `<br><small>valor da época: ${brl(base)}</small>` : ''}${refin ? `<br><small>rolagem da dívida: ${brl(s.refin * (mode === 'nominal' ? 1 : fator(y)))}</small>` : ''}`;
        data.push({ x: s.partial ? `${y}*` : String(y), v, cls: s.partial ? 'partial' : '', tip: t });
      }
      barChart($('#chart-total'), data);
      const last = serieYear(serieYears().slice(-1)[0]);
      $('#total-note').textContent = `${mode === 'nominal' ? 'Valores da época, sem correção.' : `Valores corrigidos pelo IPCA até ${ultimoMes()}.`} ${last.partial ? `* ${last.y} é parcial (${periodoCurto(last.periodo)}).` : ''} ${refin ? 'Inclui a rolagem (refinanciamento) da dívida.' : 'Sem a rolagem da dívida (troca de títulos velhos por novos).'} Antes de 1995 os totais não são comparáveis em reais (veja "Como ler"). Fonte: Tesouro Nacional, Despesas da União - Séries Históricas.`;
    };
    bindSeg('tot-mode', draw); $('#tot-refin').addEventListener('change', draw); from.addEventListener('change', draw); to.addEventListener('change', draw);
    draw(); onResize(draw);

    const yf = lastFullYear(); const s = serieYear(yf); const s10 = serieYear(yf - 10);
    const real = s.sem * fator(yf); const pc = s.sem / pop(yf);
    const kp = $$('#hero-kpis > div dd');
    kp[0].innerHTML = `${brl(s.sem)}<small>em ${yf}, sem a rolagem da dívida</small>`;
    kp[1].innerHTML = `${brl(pc)}<small>no ano (${brl(pc / 12)} por mês)</small>`;
    kp[2].innerHTML = `${brl(s.sem / 365)}<small>em média, todo dia de ${yf}</small>`;
    kp[3].innerHTML = `${esc(periodoCurto(serieYear(serieYears().slice(-1)[0]).periodo).split('–')[1] || '')}<small>Tesouro; inflação até ${esc(ultimoMes())}</small>`;
    const prev = s10 ? s10.sem * fator(yf - 10) : null;
    const big = s.funcs.slice().sort((a, b) => b.v - a.v).slice(0, 3);
    $('#total-simple').innerHTML = `<p>Em ${yf}, a União gastou <b>${brl(s.sem)}</b> (sem contar a rolagem da dívida). Dividido pela população, dá <b>${brl(pc)} por brasileiro</b> no ano, ou cerca de <b>${brl(pc / 12)} por mês</b>.</p>` +
      (prev ? `<p>Descontada a inflação, isso é <b>${pct(Math.abs(real / prev - 1))}</b> ${real >= prev ? 'a mais' : 'a menos'} do que em ${yf - 10} (${brl(prev)} em reais de hoje).</p>` : '') +
      `<p>As três maiores áreas foram ${big.map((f) => `<b>${esc(f.name)}</b> (${pct(f.v / s.sem)})`).join(', ')}. A rolagem da dívida, que fica fora desse total, somou mais ${brl(s.refin)}.</p>`;
    $('#hero-note').textContent = 'Valores da época, sem correção. Gasto = despesa liquidada dos Orçamentos Fiscal e da Seguridade Social (três Poderes), sem a rolagem da dívida. População: IBGE.';

    const all = Object.keys(S.serie.grupo).map(Number).sort((a, b) => a - b);
    const rows = all.map((y) => { const sy = serieYear(y); const r = { ...(sy ? sy.grupos : {}) }; r.__partial = sy && sy.partial; return r; });
    const keys = GRUPOS.filter((g) => rows.some((r) => r[g[0]]));
    $('#legend-grupo').innerHTML = keys.map((k) => `<span data-tip="${esc(`<b>${k[1]}</b>${k[2]}`)}"><i style="background:var(${k[3]})"></i>${esc(k[1])}</span>`).join('');
    const drawStack = () => stackChart($('#chart-grupo'), all, rows, keys);
    drawStack(); onResize(drawStack);
  }

  // ================================================================ ÁREAS
  const AREA = { sel: null };
  function initAreas() {
    const ys = serieYears();
    const sel = $('#area-year'); fillYears(sel, ys.slice().reverse(), lastFullYear());
    const draw = () => {
      const y = +sel.value; const dim = segValue('area-dim'); let mode = segValue('area-mode');
      const s = serieYear(y);
      const note = [];
      if (y < REAL_FROM && mode !== 'pct') { mode = 'pct'; note.push(`Para ${y} mostramos só a porcentagem: a moeda e a inflação da época não permitem converter para reais de hoje.`); }
      if (s.partial) note.push(`${y} é parcial (${periodoCurto(s.periodo)}).`);
      if (dim === 'funcao' && s.old) note.push('Até 1999 a lista de áreas era outra (por exemplo, Saúde e Saneamento juntos).');
      if (dim === 'grupo' && y < 1994) note.push('Até 1993 a "amortização da dívida" inclui a rolagem, porque a planilha oficial não separa.');
      if (y < 1995) { const n = s.notas.filter((x) => /\$/.test(x)).join(' ').trim(); if (n) note.push('Nota da fonte: ' + n); }
      $('#area-note').textContent = note.join(' ');
      $('#area-note').classList.toggle('warn', note.length > 0);
      const base = s.sem;
      const val = (v) => (mode === 'real' ? v * fator(y) : mode === 'pc' ? (v * fator(y)) / pop(y) : v / base);
      const txt = (v) => (mode === 'pct' ? pct(val(v)) : brl(val(v)));
      let items;
      if (dim === 'funcao') {
        items = s.funcs.map((f) => {
          const code = FUN_BY_NAME[keyName(f.name)];
          const sub = code && !s.old ? FUNCOES[code][1] : (FUN_OLD[keyName(f.name)] || (code ? FUNCOES[code][1] : ''));
          return { key: 'f:' + keyName(f.name), label: f.name, sub, v: f.v, txt: txt(f.v) };
        });
      } else {
        items = GRUPOS.filter((g) => s.grupos[g[0]]).map((g) => ({ key: 'g:' + g[0], label: g[1], sub: g[2], v: s.grupos[g[0]], txt: txt(s.grupos[g[0]]), color: g[3] }));
      }
      items.sort((a, b) => b.v - a.v);
      if (!AREA.sel || !items.some((i) => i.key === AREA.sel)) AREA.sel = items[0] && items[0].key;
      hbars($('#area-bars'), items, { click: true, selected: AREA.sel });
      drawDetail();
    };
    const drawDetail = () => {
      const k = AREA.sel; if (!k) return;
      const y = +sel.value; const s = serieYear(y);
      const isF = k.startsWith('f:'); const kn = k.slice(2);
      const pick = (sy) => {
        if (!sy) return null;
        if (isF) { const f = sy.funcs.find((x) => keyName(x.name) === kn); return f ? f.v : null; }
        return sy.grupos[kn] == null ? null : sy.grupos[kn];
      };
      let label; let desc;
      if (isF) {
        const f = s.funcs.find((x) => keyName(x.name) === kn); label = f ? f.name : kn;
        const code = FUN_BY_NAME[kn]; desc = s.old ? (FUN_OLD[kn] || '') : (code ? FUNCOES[code][1] : '');
      } else { const g = GRUPO_BY[kn]; label = g[1]; desc = g[2]; }
      $('#area-detail-title').textContent = label;
      $('#area-detail-desc').textContent = desc;
      const ys = serieYears().filter((yy) => yy >= REAL_FROM && (isF ? (s.old ? yy < 2000 : yy >= 2000) : true));
      const data = ys.map((yy) => { const sy = serieYear(yy); const v = pick(sy); return v == null ? null : { x: sy.partial ? yy + '*' : String(yy), v: v * fator(yy), cls: sy.partial ? 'partial' : '', tip: `<b>${yy}${sy.partial ? ' (parcial)' : ''}</b>${brl(v * fator(yy))} corrigidos<br><small>${brl(v)} na época · ${pct(v / sy.sem)} do total</small>` }; }).filter(Boolean);
      barChart($('#chart-area'), data, { height: 220 });
      const v = pick(s);
      let html = '';
      if (v != null) {
        html += `<p>Em ${y}${s.partial ? ' (até ' + esc(periodoCurto(s.periodo).split('–')[1]) + ')' : ''}, a União gastou <b>${brl(v)}</b> com “${esc(label)}”: <b>${pct(v / s.sem)}</b> de tudo o que gastou${y < REAL_FROM ? ' (valor na moeda da época)' : ''}.</p>`;
        if (y >= REAL_FROM && pop(y)) html += `<p>Isso equivale a <b>${brl(v / pop(y))} por brasileiro</b> no ano${s.partial ? ' (até agora)' : `, ou ${brl(v / pop(y) / 12)} por mês`}.</p>`;
        const y0 = isF && !s.old ? 2000 : REAL_FROM; const yb = Math.max(y0, y - 10);
        const vb = pick(serieYear(yb));
        if (y >= REAL_FROM && vb && yb < y && !s.partial) { const ch = (v * fator(y)) / (vb * fator(yb)) - 1; html += `<p>Descontada a inflação, o gasto ${ch >= 0 ? 'subiu' : 'caiu'} <b>${pct(Math.abs(ch))}</b> em relação a ${yb}.</p>`; }
      }
      $('#area-simple').innerHTML = html;
    };
    $('#area-bars').addEventListener('click', (e) => { const b = e.target.closest('button[data-key]'); if (!b) return; AREA.sel = b.dataset.key; $$('#area-bars button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); drawDetail(); if (window.innerWidth < 980) $('#area-detail-title').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    sel.addEventListener('change', draw); bindSeg('area-dim', () => { AREA.sel = null; draw(); }); bindSeg('area-mode', draw);
    draw(); onResize(drawDetail);
  }

  // ================================================================ ÓRGÃOS (SIOP)
  const ORG = { sort: 'liq', dir: -1, sel: null, rows: [], year: null, data: null, all: false };
  const resYears = () => Object.keys(S.res.anos).map(Number).sort((a, b) => a - b);
  function initOrgaos() {
    const ys = resYears();
    const ysel = $('#org-year');
    const lf = S.serie ? lastFullYear() : ys[ys.length - 2];
    fillYears(ysel, ys.slice().reverse(), ys.includes(lf) ? lf : ys[ys.length - 1]);
    $('#org-fun').innerHTML += Object.entries(FUNCOES).map(([k, v]) => `<option value="${k}">${esc(v[0])}</option>`).join('');
    $('#org-gnd').innerHTML += Object.entries(GND).filter(([k]) => k !== '0').map(([k, v]) => `<option value="${k}">${esc(v[0])}</option>`).join('');
    const tbody = $('#org-table tbody');
    sortableTable($('#org-table'), ORG, () => renderOrg());
    const load = async () => {
      const y = +ysel.value; tbody.innerHTML = '<tr class="empty"><td colspan="7">Carregando…</td></tr>';
      try { ORG.data = await getJSON(`uniao/ano/${y}.json`); ORG.year = y; renderOrg(); if (ORG.sel) showOrgDetail(ORG.sel); } catch (e) { tbody.innerHTML = `<tr class="empty"><td colspan="7">Não foi possível carregar ${y}.</td></tr>`; console.warn(e); }
      searchAcoes();
    };
    ['#org-fun', '#org-gnd', '#org-refin'].forEach((s) => $(s).addEventListener('change', () => { renderOrg(); if (ORG.sel) showOrgDetail(ORG.sel); }));
    $('#org-q').addEventListener('input', debounce(renderOrg, 150));
    ysel.addEventListener('change', load);
    rowKeys(tbody, (k) => { ORG.sel = k; $$('#org-table tbody tr').forEach((tr) => tr.classList.toggle('sel', tr.dataset.key === k)); showOrgDetail(k, true); });
    $('#org-more').addEventListener('click', () => { ORG.all = true; renderOrg(); });
    $('#acao-q').addEventListener('input', debounce(searchAcoes, 250));
    sortableTable($('#acao-table'), ACAO, () => renderAcoes());
    load();
  }
  function renderOrg() {
    if (!ORG.data) return;
    const y = ORG.year; const q = norm($('#org-q').value);
    const fun = $('#org-fun').value; const gnd = $('#org-gnd').value; const refin = $('#org-refin').checked;
    const m = {};
    ORG.data.cubo.forEach((r) => {
      const [esf, org, f, g, rf] = r;
      if (esf !== '10' && esf !== '20') return;
      if (!refin && rf) return;
      if (fun && f !== fun) return;
      if (gnd && g !== gnd) return;
      const a = m[org] || (m[org] = { org, ini: 0, atu: 0, emp: 0, liq: 0, pag: 0 });
      a.ini += r[5]; a.atu += r[6]; a.emp += r[7]; a.liq += r[8]; a.pag += r[9];
    });
    let rows = Object.values(m).map((a) => ({ ...a, nome: (ORG.data.orgaos[a.org] || a.org).trim(), exec: a.atu ? a.liq / a.atu : 0, pc: a.liq / pop(y) }));
    const tot = rows.reduce((t, r) => ({ ini: t.ini + r.ini, atu: t.atu + r.atu, liq: t.liq + r.liq, pag: t.pag + r.pag }), { ini: 0, atu: 0, liq: 0, pag: 0 });
    if (q) rows = rows.filter((r) => norm(r.nome).includes(q) || r.org.startsWith(q));
    rows = rows.filter((r) => r.ini || r.atu || r.liq);
    rows.sort(cmp(ORG.sort, ORG.dir));
    ORG.rows = rows;
    const partial = y === resYears().slice(-1)[0];
    $('#org-kpis').innerHTML = `<div><dt>Previsto na lei (${y})</dt><dd>${brl(tot.ini)}</dd></div><div><dt>Autorizado</dt><dd>${brl(tot.atu)}</dd></div><div><dt>Gasto (liquidado)${partial ? ' até agora' : ''}</dt><dd>${brl(tot.liq)}<small>${pct(tot.atu ? tot.liq / tot.atu : 0)} do autorizado</small></dd></div><div><dt>Pago no ano</dt><dd>${brl(tot.pag)}<small>gasto: ${brl(tot.liq / pop(y))} por brasileiro</small></dd></div>`;
    const tbody = $('#org-table tbody');
    if (!rows.length) { tbody.innerHTML = '<tr class="empty"><td colspan="7">Nenhum órgão com esse filtro.</td></tr>'; return; }
    const lim = (ORG.all || q) ? rows.length : 15;
    const more = $('#org-more'); more.hidden = rows.length <= lim; more.textContent = `Mostrar todos os ${rows.length} órgãos`;
    tbody.innerHTML = rows.slice(0, lim).map((r) => `<tr tabindex="0" data-key="${esc(r.org)}" class="${ORG.sel === r.org ? 'sel' : ''}"><td class="txt">${esc(r.nome)}<small>código ${esc(r.org)}</small></td><td>${brl(r.ini)}</td><td>${brl(r.atu)}</td><td><b>${brl(r.liq)}</b></td><td>${brl(r.pag)}</td><td>${pct(r.exec, 0)}</td><td>${brl(r.pc)}</td></tr>`).join('');
  }
  async function showOrgDetail(code, scroll) {
    const box = $('#org-detail'); box.hidden = false;
    const y = ORG.year; const nome = (ORG.data.orgaos[code] || S.res.orgaos_nomes[code] || code).trim();
    box.innerHTML = `<h3 class="g-h3">${esc(nome)}</h3><p class="g-loading">Carregando detalhes…</p>`;
    if (scroll) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const refin = $('#org-refin').checked; const fun = $('#org-fun').value;
    const ys = resYears();
    const serie = ys.map((yy) => { const o = S.res.anos[yy].orgao[code]; return o ? { x: String(yy), v: o[1] * fator(yy), tip: `<b>${yy}</b>${brl(o[1] * fator(yy))} corrigidos<br><small>${brl(o[1])} na época · previsto ${brl(o[0])}</small>` } : null; }).filter(Boolean);
    const byF = {}; const byG = {};
    ORG.data.cubo.forEach((r) => { if (r[1] !== code || (r[0] !== '10' && r[0] !== '20') || (!refin && r[4])) return; if (fun && r[2] !== fun) return; byF[r[2]] = (byF[r[2]] || 0) + r[8]; byG[r[3]] = (byG[r[3]] || 0) + r[8]; });
    let acoesHtml = '';
    try {
      const A = await getJSON(`uniao/acoes/${y}.json`);
      const agg = {};
      A.acoes.forEach((a) => {
        if (a[0] !== code || (!refin && a[5]) || (fun && a[4] !== fun)) return;
        const k = a[2] + '|' + a[3]; const o = agg[k] || (agg[k] = { cod: a[2], nome: A.nomes[a[3]], ini: 0, liq: 0, pag: 0, uos: new Set() });
        o.ini += a[6]; o.liq += a[9]; o.pag += a[10]; o.uos.add(A.uos[a[1]] || a[1]);
      });
      const top = Object.values(agg).sort((a, b) => b.liq - a.liq).slice(0, 15);
      acoesHtml = top.length ? `<div class="g-table-wrap"><table class="g-table"><thead><tr><th class="txt">Ação (no que o dinheiro foi usado)</th><th>Previsto</th><th>Gasto</th><th class="g-hide-sm">Pago</th></tr></thead><tbody>${top.map((a) => `<tr><td class="txt">${esc(a.nome)}<small>ação ${esc(a.cod)} · ${esc([...a.uos].slice(0, 2).join('; '))}${a.uos.size > 2 ? '…' : ''}</small></td><td>${brl(a.ini)}</td><td><b>${brl(a.liq)}</b></td><td class="g-hide-sm">${brl(a.pag)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="g-sub">Sem ações com esse filtro.</p>';
    } catch (e) { acoesHtml = '<p class="g-sub">Não foi possível carregar as ações.</p>'; }
    if (ORG.sel !== code) return;
    const tF = Object.values(byF).reduce((a, b) => a + b, 0) || 1;
    const fItems = Object.entries(byF).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ label: FUNCOES[k] ? FUNCOES[k][0] : k, v, txt: `${brl(v)} · ${pct(v / tF, 0)}` }));
    const gItems = Object.entries(byG).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: GND[k] ? GND[k][0] : k, sub: GND[k] ? GND[k][1] : '', v, txt: `${brl(v)} · ${pct(v / tF, 0)}` }));
    box.innerHTML = `<button class="button button-ghost g-close" type="button">Fechar</button>
      <h3 class="g-h3">${esc(nome)}</h3><p class="g-sub">Código ${esc(code)} · ${y}${fun ? ' · área: ' + esc(FUNCOES[fun][0]) : ''}${refin ? '' : ' · sem a rolagem da dívida'}</p>
      <h4>Maiores ações em ${y}</h4>${acoesHtml}
      <div class="g-grid-2 g-detail-lists"><div><h4>Por área</h4><ol class="g-bars g-bars-sm" id="od-f"></ol></div><div><h4>Por tipo de gasto</h4><ol class="g-bars g-bars-sm" id="od-g"></ol></div></div>
      <h4>Gasto (liquidado) por ano, corrigido pela inflação</h4><div class="g-chart" id="od-chart"></div>
      <p class="g-chart-note">Série pelo código do órgão, sem a rolagem da dívida e sem os filtros acima. Quando um ministério é criado, fundido ou extinto, ele muda de código, e a série pode ter lacunas.</p>`;
    hbars($('#od-f'), fItems); hbars($('#od-g'), gItems);
    barChart($('#od-chart'), serie, { height: 200 });
    $('.g-close', box).addEventListener('click', () => { box.hidden = true; ORG.sel = null; $$('#org-table tbody tr').forEach((tr) => tr.classList.remove('sel')); });
  }
  const ACAO = { sort: 'liq', dir: -1, rows: [] };
  async function searchAcoes() {
    const q = norm($('#acao-q').value); const wrap = $('#acao-wrap');
    if (q.length < 3) { wrap.hidden = true; return; }
    wrap.hidden = false; const tbody = $('#acao-table tbody');
    tbody.innerHTML = '<tr class="empty"><td colspan="5">Carregando…</td></tr>';
    const y = +$('#org-year').value;
    try {
      const A = await getJSON(`uniao/acoes/${y}.json`);
      const agg = {}; const terms = q.split(/\s+/);
      const names = (ORG.data && ORG.year === y) ? ORG.data.orgaos : S.res.orgaos_nomes;
      A.acoes.forEach((a) => {
        const nome = A.nomes[a[3]]; const n = norm(nome);
        if (!terms.every((t) => n.includes(t))) return;
        const k = a[0] + '|' + a[2] + '|' + a[3];
        const o = agg[k] || (agg[k] = { nome, cod: a[2], org: (names[a[0]] || a[0]).trim(), ini: 0, liq: 0, pag: 0 });
        o.ini += a[6]; o.liq += a[9]; o.pag += a[10];
      });
      ACAO.rows = Object.values(agg); ACAO.year = y; renderAcoes();
    } catch (e) { tbody.innerHTML = '<tr class="empty"><td colspan="5">Não foi possível carregar as ações deste ano.</td></tr>'; }
  }
  function renderAcoes() {
    const tbody = $('#acao-table tbody'); const rows = ACAO.rows.slice().sort(cmp(ACAO.sort, ACAO.dir));
    if (!rows.length) { tbody.innerHTML = '<tr class="empty"><td colspan="5">Nenhuma ação encontrada com esse nome.</td></tr>'; return; }
    const tot = rows.reduce((a, r) => a + r.liq, 0);
    tbody.innerHTML = rows.slice(0, 80).map((r) => `<tr><td class="txt">${esc(r.nome)}<small>ação ${esc(r.cod)}</small></td><td class="txt">${esc(r.org)}</td><td>${brl(r.ini)}</td><td><b>${brl(r.liq)}</b></td><td>${brl(r.pag)}</td></tr>`).join('') +
      `<tr class="empty"><td colspan="5">${rows.length} resultado(s)${rows.length > 80 ? ' (mostrando 80)' : ''} em ${ACAO.year} · gasto somado: <b>${brl(tot)}</b>${pop(ACAO.year) ? ` · ${brl(tot / pop(ACAO.year))} por brasileiro` : ''}</td></tr>`;
  }

  // ================================================================ PRESIDÊNCIA
  function initPresidencia() {
    const draw = () => {
      const mode = segValue('pres-mode');
      const ys = resYears();
      const data = ys.map((y) => { const o = S.res.anos[y].orgao['20000']; if (!o) return null; const v = mode === 'real' ? o[1] * fator(y) : o[1]; const last = y === ys[ys.length - 1]; return { x: last ? y + '*' : String(y), v, cls: last ? 'partial' : '', tip: `<b>${y}${last ? ' (parcial)' : ''}</b>${brl(v)}${mode === 'real' ? ' corrigidos' : ''}<br><small>previsto: ${brl(o[0])} · pago no ano: ${brl(o[2])} (época)</small>` }; }).filter(Boolean);
      barChart($('#chart-pres'), data, { height: 220 });
      const yf = S.serie ? lastFullYear() : ys[ys.length - 2]; const o = S.res.anos[yf] && S.res.anos[yf].orgao['20000'];
      $('#pres-note').textContent = o ? `Em ${yf}, a Presidência gastou ${brl(o[1])} (liquidado), cerca de ${brl(o[1] / pop(yf))} por brasileiro. * Ano em curso, parcial. Fonte: SIOP, órgão 20000 (sem a rolagem da dívida).` : 'Fonte: SIOP, órgão 20000.';
    };
    bindSeg('pres-mode', draw); draw(); onResize(draw);
    const py = $('#pres-year'); const pys = resYears().filter((y) => S.res.anos[y].orgao['20000']);
    fillYears(py, pys.slice().reverse(), pys.includes(lastFullYear()) ? lastFullYear() : pys[pys.length - 1]);
    const drawUO = async () => {
      const y = +py.value; const el = $('#pres-uos'); el.innerHTML = '<li class="g-loading">Carregando…</li>';
      try {
        const A = await getJSON(`uniao/acoes/${y}.json`); const m = {};
        A.acoes.forEach((a) => { if (a[0] !== '20000' || a[5]) return; m[a[1]] = (m[a[1]] || 0) + a[9]; });
        const t = Object.values(m).reduce((x, v) => x + v, 0) || 1;
        hbars(el, Object.entries(m).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => ({ label: (A.uos[k] || k).trim(), sub: `unidade ${k}`, v, txt: `${brl(v)} · ${pct(v / t, 0)}` })));
      } catch (e) { el.innerHTML = '<li class="g-loading">Não foi possível carregar.</li>'; }
    };
    py.addEventListener('change', drawUO); drawUO();
    const anos = S.cart ? Object.keys(S.cart.anos).sort() : [];
    const drawC = () => {
      const data = anos.map((y) => { const a = S.cart.anos[y]; const det = Math.max(0, a.presidencia - a.presidencia_sig); const inc = a.meses < 12; return { x: inc ? y + '*' : y, v: a.presidencia, parts: [{ v: a.presidencia_sig, cls: 'muted' }, { v: det, cls: '' }], tip: `<b>${y}${inc ? ` (${a.meses} de 12 meses)` : ''}</b>Total: ${brl(a.presidencia)}<br>Sigiloso: ${brl(a.presidencia_sig)} (${pct(a.presidencia ? a.presidencia_sig / a.presidencia : 0, 0)})<br>Com detalhe: ${brl(det)}${a.vice ? `<br><small>Vice-Presidência: ${brl(a.vice)}</small>` : ''}` }; });
      barChart($('#chart-pres-cartao'), data, { height: 220 });
      const inc = anos.filter((y) => S.cart.anos[y].meses < 12);
      $('#pres-cartao-note').textContent = `Cinza = sigiloso; verde = com detalhe. Valores da época (Portal da Transparência, órgão superior 20000).${inc.length ? ` * Anos incompletos nos nossos dados: ${inc.map((y) => `${y} (${S.cart.anos[y].meses} meses)`).join(', ')}.` : ''}`;
    };
    if (anos.length) { drawC(); onResize(drawC); } else $('#chart-pres-cartao').innerHTML = '<p class="g-loading">Dados do cartão ainda não disponíveis.</p>';
    const P = S.presHist; const tb = $('#mand-table tbody');
    if (P) {
      tb.innerHTML = P.mandatos.map((m) => {
        const corr = Object.entries(m.anos || {}).reduce((a, [y, v]) => a + v * (fator(+y) || 1), 0);
        const meses = Math.max(1, (new Date(m.fim) - new Date(m.ini)) / (86400000 * 30.44));
        const cats = Object.entries(m.cats).slice(0, 3).map(([c, v]) => `${esc(c)} (${pct(v / m.v, 0)})`).join('; ');
        return `<tr><td class="txt"><b>${esc(m.nome)}</b></td><td>${esc(m.ini.split('-').reverse().join('/'))} a ${esc(m.fim.split('-').reverse().join('/'))}</td><td>${brl(m.v)}</td><td><b>${brl(corr)}</b></td><td>${brl(corr / meses)}</td><td class="txt">${cats}<small>Maiores fornecedores: ${esc(m.fornecedores.slice(0, 3).map((f) => f[0]).join('; '))}</small></td></tr>`;
      }).join('');
      $('#mand-notes').innerHTML = `<ul>${P.notas.map((n) => `<li>${esc(n)}</li>`).join('')}<li>Total da planilha: ${brl(P.total)} em ${nf0.format(P.lancamentos)} lançamentos (${esc(P.periodo)}). <a href="${esc(P.url)}" target="_blank" rel="noreferrer">Planilha oficial</a>.</li><li>Os mandatos têm durações diferentes: para comparar, use a média por mês.</li></ul>`;
    } else tb.innerHTML = '<tr class="empty"><td colspan="6">Planilha indisponível.</td></tr>';
  }

  // ================================================================ CARTÃO (todos os órgãos)
  const CART = { sort: 'v', dir: -1, data: null, sel: null };
  function initCartao() {
    const anos = Object.keys(S.cart.anos).sort();
    if (!anos.length) { $('#cartao-note').textContent = 'Dados do cartão ainda não disponíveis.'; return; }
    const sel = $('#cartao-year');
    const full = anos.filter((y) => S.cart.anos[y].meses === 12);
    fillYears(sel, anos.slice().reverse(), full.length ? full[full.length - 1] : anos[anos.length - 1]);
    const tbody = $('#cartao-table tbody');
    sortableTable($('#cartao-table'), CART, () => renderCart());
    const load = async () => {
      tbody.innerHTML = '<tr class="empty"><td colspan="4">Carregando…</td></tr>';
      try { CART.data = await getJSON(`cartao/ano/${sel.value}.json`); renderCart(); showCartDetail(CART.sel || Object.keys(CART.data.orgaos_superiores)[0]); } catch (e) { tbody.innerHTML = '<tr class="empty"><td colspan="4">Não foi possível carregar.</td></tr>'; }
    };
    sel.addEventListener('change', load); $('#cartao-q').addEventListener('input', debounce(renderCart, 150));
    rowKeys(tbody, (k) => { CART.sel = k; $$('#cartao-table tbody tr').forEach((tr) => tr.classList.toggle('sel', tr.dataset.key === k)); showCartDetail(k); if (window.innerWidth < 980) $('#cartao-detail').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    load();
    const drawC = () => {
      const data = anos.map((y) => { const a = S.cart.anos[y]; const inc = a.meses < 12; return { x: inc ? y + '*' : y, v: a.total, cls: inc ? 'partial' : '', tip: `<b>${y}${inc ? ` (${a.meses} de 12 meses)` : ''}</b>${brl(a.total)}<br><small>compras ${brl(a.tipos.compra || 0)} · saques ${brl(a.tipos.saque || 0)} · sigiloso ${brl(a.tipos.sigiloso || 0)}</small>` }; });
      barChart($('#chart-cartao'), data, { height: 220 });
    };
    drawC(); onResize(drawC);
  }
  function renderCart() {
    const d = CART.data; if (!d) return; const q = norm($('#cartao-q').value);
    let rows = Object.entries(d.orgaos_superiores).map(([k, v]) => ({ k, ...v }));
    if (q) rows = rows.filter((r) => norm(r.n).includes(q));
    rows.sort(cmp(CART.sort, CART.dir));
    const t = d.tipos; const y = d.ano;
    $('#cartao-kpis').innerHTML = `<div><dt>Total em ${y}</dt><dd>${brl(d.total)}<small>${d.meses_disponiveis.length} de 12 meses</small></dd></div><div><dt>Compras</dt><dd>${brl(t.compra || 0)}</dd></div><div><dt>Saques em dinheiro</dt><dd>${brl(t.saque || 0)}</dd></div><div><dt>Sigiloso</dt><dd>${brl(t.sigiloso || 0)}<small>${pct((t.sigiloso || 0) / (d.total || 1), 0)} do total</small></dd></div>`;
    const miss = 12 - d.meses_disponiveis.length;
    $('#cartao-note').textContent = miss > 0 ? `Atenção: ${y} tem ${d.meses_disponiveis.length} de 12 meses nos nossos dados${y === new Date().getFullYear() ? ' (ano em curso)' : ''}. O Portal da Transparência bloqueia downloads automáticos rápidos, então a rotina completa os meses aos poucos.` : '';
    $('#cartao-note').classList.toggle('warn', miss > 0);
    const tbody = $('#cartao-table tbody');
    tbody.innerHTML = rows.length ? rows.map((r) => `<tr tabindex="0" data-key="${esc(r.k)}" class="${CART.sel === r.k ? 'sel' : ''}"><td class="txt">${esc(r.n)}<small>${nf0.format(r.q)} transações</small></td><td><b>${brl(r.v)}</b></td><td>${brl(r.saque)}</td><td>${r.sig ? brl(r.sig) : '—'}</td></tr>`).join('') : '<tr class="empty"><td colspan="4">Nenhum órgão encontrado.</td></tr>';
  }
  const fmtCNPJ = (c) => (c ? 'CNPJ ' + c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '');
  function showCartDetail(k) {
    const d = CART.data; const box = $('#cartao-detail'); const o = d && d.orgaos_superiores[k];
    if (!o) { box.innerHTML = `<h3 class="g-h3">Sem dados deste órgão em ${d ? d.ano : ''}</h3>`; return; }
    CART.sel = k; $$('#cartao-table tbody tr').forEach((tr) => tr.classList.toggle('sel', tr.dataset.key === k));
    const top = (d.favorecidos_top[k] || []).slice(0, 12);
    const subs = Object.values(d.orgaos).filter((x) => x.s === k).sort((a, b) => b.v - a.v).slice(0, 8);
    const meses = MESES.map((m, i) => ({ x: m, v: o.m[String(i + 1).padStart(2, '0')] || 0 }));
    box.innerHTML = `<h3 class="g-h3">${esc(o.n)}</h3><p class="g-sub">${d.ano}: ${brl(o.v)} em ${nf0.format(o.q)} transações${o.sig ? `, das quais ${brl(o.sig)} sigilosas` : ''}${o.saque ? `; ${brl(o.saque)} em saques` : ''}.</p>
      <h4>Por mês</h4><div class="g-chart" id="cd-chart"></div>
      ${subs.length > 1 ? '<h4>Por unidade</h4><ol class="g-bars g-bars-sm" id="cd-subs"></ol>' : ''}
      <h4>Onde o cartão mais foi usado (compras)</h4>${top.length ? `<ol class="g-bars g-bars-sm" id="cd-top"></ol><p class="g-chart-note">${esc(d.aviso_favorecidos)}</p>` : '<p class="g-sub">Sem compras detalhadas (só saques ou gastos sigilosos).</p>'}`;
    barChart($('#cd-chart'), meses, { height: 150 });
    if (subs.length > 1) hbars($('#cd-subs'), subs.map((s) => ({ label: s.n, v: s.v, txt: brl(s.v) })));
    if (top.length) hbars($('#cd-top'), top.map((f) => ({ label: f[0], sub: fmtCNPJ(f[1]), v: f[2], txt: brl(f[2]) })));
  }

  // ================================================================ CONGRESSO
  const CONG = { sort: 'total', dir: -1, shown: 20, rows: [] };
  const casaNome = (c) => (c === 'c' ? 'Câmara' : 'Senado');
  const casaDir = (c) => (c === 'c' ? 'camara' : 'senado');
  function initCongresso() {
    const P = S.parlIdx.pessoas;
    const years = [...new Set([...Object.keys(S.parlRes.camara), ...Object.keys(S.parlRes.senado)])].map(Number).sort((a, b) => a - b);
    CONG.maxY = years[years.length - 1];
    fillYears($('#cong-from'), years, years[0]); fillYears($('#cong-to'), years, CONG.maxY);
    const parts = [...new Set(P.map((p) => p[3]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    $('#cong-part').innerHTML += parts.map((p) => `<option>${esc(p)}</option>`).join('');
    const ufs = [...new Set(P.map((p) => p[4]).filter(Boolean))].sort();
    $('#cong-uf').innerHTML += ufs.map((p) => `<option>${esc(p)}</option>`).join('');
    const cats = new Set(); Object.values(S.parlRes).forEach((c) => Object.values(c).forEach((y) => Object.keys(y.categorias).forEach((k) => cats.add(k))));
    $('#cong-cat').innerHTML += [...cats].sort((a, b) => a.localeCompare(b, 'pt-BR')).map((c) => `<option>${esc(c)}</option>`).join('');
    const re = () => { CONG.shown = 20; renderCong(); };
    bindSeg('cong-casa', re);
    ['#cong-from', '#cong-to', '#cong-part', '#cong-uf', '#cong-cat', '#cong-atual'].forEach((s) => $(s).addEventListener('change', re));
    $('#cong-q').addEventListener('input', debounce(re, 200));
    $('#cong-more').addEventListener('click', () => { CONG.shown += 100; drawCongTable(); });
    sortableTable($('#cong-table'), CONG, () => drawCongTable());
    rowKeys($('#cong-table tbody'), (k) => openPerson(k));
    renderCong();
  }
  async function catTotals(casa, a, b, cat) {
    const out = {}; const jobs = [];
    (casa ? [casa] : ['c', 's']).forEach((c) => { for (let y = a; y <= b; y++) { if (S.parlRes[casaDir(c)][y]) jobs.push([c, y]); } });
    $('#cong-note').textContent = `Carregando os gastos por categoria (${jobs.length} arquivo(s) anual(is))…`;
    await Promise.all(jobs.map(async ([c, y]) => {
      const d = await getJSON(`parl/${casaDir(c)}/ano/${y}.json`);
      const ids = d.categorias.map((x, i) => (x.simples === cat ? String(i) : null)).filter((x) => x != null);
      d.pessoas.forEach((p) => { let v = 0; ids.forEach((i) => { v += p.cats[i] || 0; }); if (v) { const k = c + '-' + p.id; out[k] = (out[k] || 0) + v; } });
    }));
    return out;
  }
  let congToken = 0;
  async function renderCong() {
    const tok = ++congToken;
    const casa = segValue('cong-casa'); let a = +$('#cong-from').value; let b = +$('#cong-to').value; if (a > b) [a, b] = [b, a];
    const part = $('#cong-part').value; const uf = $('#cong-uf').value; const cat = $('#cong-cat').value; const q = norm($('#cong-q').value); const atual = $('#cong-atual').checked;
    let catMap = null;
    if (cat) { try { catMap = await catTotals(casa, a, b, cat); } catch (e) { $('#cong-note').textContent = 'Não foi possível carregar os dados por categoria.'; return; } if (tok !== congToken) return; }
    const rows = []; const perYear = {};
    S.parlIdx.pessoas.forEach((p) => {
      const [c, id, nome, partido, puf, , fim, , por] = p;
      if (casa && c !== casa) return;
      if (part && partido !== part) return;
      if (uf && puf !== uf) return;
      if (atual && fim !== CONG.maxY) return;
      if (q && !norm(nome).includes(q)) return;
      let tot = 0; let n = 0;
      Object.entries(por).forEach(([y, v]) => { y = +y; if (y >= a && y <= b) { tot += v; n++; if (!catMap) perYear[y] = (perYear[y] || 0) + v; } });
      if (catMap) tot = catMap[c + '-' + id] || 0;
      if (!tot) return;
      rows.push({ key: c + '-' + id, casa: casaNome(c), nome, partido, uf: puf, anos: n, total: tot, media: tot / Math.max(1, n) });
    });
    CONG.rows = rows;
    const total = rows.reduce((s, r) => s + r.total, 0); const pa = rows.reduce((s, r) => s + r.anos, 0);
    $('#cong-kpis').innerHTML = `<div><dt>Total no período${cat ? ' (só a categoria)' : ''}</dt><dd>${brl(total)}<small>${a}–${b}, valores da época</small></dd></div><div><dt>Parlamentares</dt><dd>${nf0.format(rows.length)}</dd></div><div><dt>Média por parlamentar por ano</dt><dd>${brl(pa ? total / pa : 0)}<small>contando só anos com gasto</small></dd></div><div><dt>Maior total</dt><dd>${rows.length ? brl(Math.max(...rows.map((r) => r.total))) : '—'}</dd></div>`;
    const notes = [];
    if (a <= 2008 && casa !== 's') notes.push('A Câmara tem poucos registros em 2008: a cota unificada (CEAP) começou em 2009.');
    if (b === CONG.maxY) notes.push(`${CONG.maxY} ainda está em andamento.`);
    notes.push('Valores reembolsados como publicados pelas casas (na Câmara, valor líquido depois das glosas).');
    $('#cong-note').textContent = notes.join(' ');
    drawCongTable();
    const byP = {}; const byU = {}; const cnt = {};
    rows.forEach((r) => { const k = r.partido || '—'; byP[k] = (byP[k] || 0) + r.total; cnt[k] = (cnt[k] || 0) + 1; byU[r.uf || '—'] = (byU[r.uf || '—'] || 0) + r.total; });
    hbars($('#cong-by-part'), Object.entries(byP).sort((x, y) => y[1] - x[1]).slice(0, 20).map(([k, v]) => ({ label: k, sub: `${cnt[k]} parlamentar(es) · média ${brl(v / cnt[k])}`, v, txt: brl(v) })));
    $('#cong-part-sub').textContent = 'Pelo partido mais recente de cada parlamentar (há trocas de partido). Os 20 maiores, com os filtros acima.';
    hbars($('#cong-by-uf'), Object.entries(byU).sort((x, y) => y[1] - x[1]).map(([k, v]) => ({ label: k, v, txt: brl(v) })));
    const cats = {};
    (casa ? [casaDir(casa)] : ['camara', 'senado']).forEach((cd) => { for (let y = a; y <= b; y++) { const r = S.parlRes[cd][y]; if (r) Object.entries(r.categorias).forEach(([k, v]) => { cats[k] = (cats[k] || 0) + v; }); } });
    const ct = Object.values(cats).reduce((s, v) => s + v, 0) || 1;
    hbars($('#cong-by-cat'), Object.entries(cats).sort((x, y) => y[1] - x[1]).slice(0, 14).map(([k, v]) => ({ label: k, v, txt: `${brl(v)} · ${pct(v / ct, 0)}` })));
    const ys = []; for (let y = a; y <= b; y++) ys.push(y);
    let data;
    if (catMap) {
      data = ys.map((y) => { let v = 0; (casa ? [casaDir(casa)] : ['camara', 'senado']).forEach((cd) => { const r = S.parlRes[cd][y]; if (r) v += r.categorias[cat] || 0; }); return { x: String(y), v, tip: `<b>${y}</b>${brl(v)} em “${esc(cat)}”` }; });
      $('#cong-year-note').textContent = 'Por ano: total da categoria na(s) casa(s) escolhida(s), sem os filtros de partido, UF ou nome.';
    } else {
      data = ys.map((y) => ({ x: y === CONG.maxY ? y + '*' : String(y), v: perYear[y] || 0, cls: y === CONG.maxY ? 'partial' : '', tip: `<b>${y}</b>${brl(perYear[y] || 0)} (valor da época)<br><small>corrigido: ${brl((perYear[y] || 0) * (fator(y) || 1))}</small>` }));
      $('#cong-year-note').textContent = 'Com os filtros escolhidos; valores da época (passe o mouse ou toque para ver o valor corrigido). * ano em andamento.';
    }
    barChart($('#chart-cong'), data, { height: 200 });
  }
  function drawCongTable() {
    const rows = CONG.rows.slice().sort(cmp(CONG.sort, CONG.dir));
    const tb = $('#cong-table tbody');
    tb.innerHTML = rows.length ? rows.slice(0, CONG.shown).map((r, i) => `<tr tabindex="0" data-key="${esc(r.key)}"><td class="num-col">${i + 1}</td><td class="txt"><b>${esc(r.nome)}</b><small class="g-show-sm">${r.casa} · ${esc(r.partido || '—')}/${esc(r.uf || '—')} · ${r.anos} ano(s)</small></td><td class="txt">${r.casa}</td><td class="txt">${esc(r.partido || '—')}</td><td class="txt">${esc(r.uf || '—')}</td><td>${r.anos}</td><td><b>${brl(r.total)}</b></td><td>${brl(r.media)}</td></tr>`).join('') : '<tr class="empty"><td colspan="8">Ninguém encontrado com esses filtros.</td></tr>';
    $('#cong-more').hidden = rows.length <= CONG.shown;
  }

  // ---------------------------------------------------------------- modal da pessoa
  const modal = $('#person-modal'); let lastFocus = null;
  function closeModal() {
    modal.hidden = true; document.documentElement.classList.remove('g-modal-open');
    if (/^#p=/.test(location.hash)) history.replaceState(null, '', '#congresso');
    if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (_) { /* */ }
  }
  modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (modal.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
    if (e.key === 'Tab') {
      const f = $$('button, a[href], select, input', modal).filter((x) => x.offsetParent !== null);
      if (!f.length) return; const first = f[0]; const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  function profileLinks(key) {
    const [c, id] = [key.slice(0, 1), key.slice(2)];
    let h = `<a class="g-chip" href="/politica/#perfil/${c}/${encodeURIComponent(id)}">Perfil, votos e projetos →</a>`;
    const pid = S.polIds && S.polIds[key];
    if (pid && S.pages && S.pages.politicos === true) h += ` <a class="g-chip" href="/politica/politicos/?id=${encodeURIComponent(pid)}">Todos os mandatos →</a>`;
    return h;
  }
  async function openPerson(key) {
    const i = key.indexOf('-'); const c = key.slice(0, i); const id = key.slice(i + 1);
    if (!c || !id) return;
    lastFocus = document.activeElement;
    modal.hidden = false; document.documentElement.classList.add('g-modal-open');
    const body = $('#pm-body'); body.innerHTML = '<p class="g-loading" id="pm-title">Carregando…</p>';
    $('.g-modal-panel', modal).focus();
    history.replaceState(null, '', '#p=' + key);
    let P;
    try { P = await getJSON(`parl/${casaDir(c)}/p/${id}.json`); } catch (e) { body.innerHTML = '<p id="pm-title">Não foi possível carregar os dados desta pessoa.</p>'; return; }
    const ys = Object.keys(P.anos).sort();
    const tot = ys.reduce((s, y) => s + P.anos[y].total, 0);
    const totR = ys.reduce((s, y) => s + P.anos[y].total * (fator(+y) || 1), 0);
    const notas = ys.reduce((s, y) => s + P.anos[y].n, 0);
    const res = S.parlRes[casaDir(c)];
    const avgPeers = ys.reduce((s, y) => s + (res[y] ? res[y].total / Math.max(1, res[y].pessoas) : 0), 0) / ys.length;
    const media = tot / ys.length;
    const link = c === 'c' ? `https://www.camara.leg.br/deputados/${encodeURIComponent(id)}` : `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${encodeURIComponent(id)}`;
    const cargo = c === 'c' ? 'Deputado(a) federal' : 'Senador(a)';
    body.innerHTML = `<h3 id="pm-title">${esc(P.nome)}</h3>
      <p class="g-sub">${cargo} · ${esc(P.partidos.join(' → ') || '—')} · ${esc(P.ufs.join(', ') || '—')} · cota usada em ${ys.length} ano(s): ${esc(ys[0])}${ys.length > 1 ? '–' + esc(ys[ys.length - 1]) : ''} · <a href="${link}" target="_blank" rel="noreferrer">página oficial ↗</a></p>
      <p class="g-links">${profileLinks(key)}</p>
      <dl class="g-kpis g-kpis-sm"><div><dt>Total (valor da época)</dt><dd>${brl(tot)}</dd></div><div><dt>Total corrigido</dt><dd>${brl(totR)}<small>IPCA até ${esc(ultimoMes())}</small></dd></div><div><dt>Média por ano</dt><dd>${brl(media)}<small>média da casa: ${brl(avgPeers)}</small></dd></div><div><dt>Notas e recibos</dt><dd>${nf0.format(notas)}</dd></div></dl>
      <div class="g-simple"><p>Em média, ${esc(P.nome)} gastou <b>${brl(media)} por ano</b> da cota, ${media > avgPeers ? `<b>${pct(media / avgPeers - 1, 0)} acima</b>` : `<b>${pct(1 - media / avgPeers, 0)} abaixo</b>`} da média dos colegas da mesma casa nos mesmos anos (${brl(avgPeers)}). A média da casa inclui quem ficou só parte do ano, então serve como referência, não como regra. O limite mensal da cota também varia por estado.</p></div>
      <h4>Por ano</h4><div class="g-chart" id="pm-years"></div>
      <div class="g-controls" style="margin-top:12px"><label class="g-field">Detalhar o ano <select id="pm-y">${ys.slice().reverse().map((y) => `<option>${y}</option>`).join('')}</select></label></div>
      <div class="g-grid-2"><div><h4>No que gastou</h4><ol class="g-bars g-bars-sm" id="pm-cats"></ol></div><div><h4>Por mês</h4><div class="g-chart" id="pm-months"></div><h4>Maiores fornecedores</h4><ol class="g-bars g-bars-sm" id="pm-forn"></ol></div></div>
      <p class="g-chart-note">Fonte: ${c === 'c' ? 'Câmara dos Deputados, CEAP (arquivos anuais)' : 'Senado Federal, CEAPS (dados abertos administrativos)'}. Partido e UF ${c === 's' ? 'pela filiação mais recente na lista oficial do Senado' : 'como registrados em cada nota'}.</p>`;
    barChart($('#pm-years'), ys.map((y) => ({ x: y, v: P.anos[y].total, tip: `<b>${y}</b>${brl(P.anos[y].total)} (época)<br><small>corrigido: ${brl(P.anos[y].total * (fator(+y) || 1))} · ${esc(P.anos[y].partido || '')}${P.anos[y].uf ? '/' + esc(P.anos[y].uf) : ''}</small>` })), { height: 180 });
    const drawY = () => {
      const a = P.anos[$('#pm-y').value]; const ct = a.total || 1;
      hbars($('#pm-cats'), Object.entries(a.cats).sort((x, y) => y[1] - x[1]).map(([k, v]) => ({ label: k, v, txt: `${brl(v)} · ${pct(v / ct, 0)}` })));
      barChart($('#pm-months'), a.meses.map((v, j) => ({ x: MESES[j], v })), { height: 140 });
      hbars($('#pm-forn'), a.forn.slice(0, 8).map((f) => ({ label: f[0] || '—', sub: fmtCNPJ(f[1]), v: f[2], txt: brl(f[2]) })));
    };
    $('#pm-y').addEventListener('change', drawY); drawY();
    const em = S.emAut && S.emAut.autores.find((r) => r[9] === key);
    if (em) {
      const box = document.createElement('div'); box.className = 'g-simple';
      box.innerHTML = `<p><b>Emendas parlamentares:</b> ${esc(P.nome)} indicou ${brl(em[3])} do orçamento federal de ${em[6]} a ${em[7]}, dos quais ${brl(em[4])} já foram pagos. <a href="#emendas" data-em="${esc(em[0])}">Ver para onde foi o dinheiro</a>.</p>`;
      body.insertBefore(box, $('#pm-years', body).previousElementSibling);
      $('[data-em]', box).addEventListener('click', (e) => { e.preventDefault(); closeModal(); $('#em-q').value = ''; showEmAutor(em[0], true); });
    }
  }


  // ================================================================ VIAGENS e PORTAL (Presidência)
  function initViagens() {
    const V = S.viagRes; const card = $('#viag-card');
    if (!V || !V.anos) { card.hidden = true; return; }
    const ys = Object.keys(V.anos).sort().filter((y) => V.anos[y].orgaos.some((o) => o[0] === '20000'));
    if (!ys.length) { card.hidden = true; return; }
    const get = (y) => V.anos[y].orgaos.find((o) => o[0] === '20000');
    const cy = String(new Date().getFullYear());
    const draw = () => {
      const mode = segValue('viag-mode');
      barChart($('#chart-viag'), ys.map((y) => { const o = get(y); const inc = y === cy; const v = mode === 'n' ? o[2] : o[3]; return { x: inc ? y + '*' : y, v, cls: inc ? 'partial' : '', tip: `<b>${y}${inc ? ' (parcial)' : ''}</b>${nf0.format(o[2])} viagens · ${brl(o[3])}<br><small>marcadas como sigilosas: ${nf0.format(o[4])} (${brl(o[5])})</small>` }; }), { height: 200, fmt: mode === 'n' ? (x) => nf0.format(x) : undefined });
    };
    bindSeg('viag-mode', draw); draw(); onResize(draw);
    const yf = ys.filter((y) => y !== cy).pop(); const o = yf && get(yf);
    $('#viag-note').textContent = `${o ? `Em ${yf}: ${nf0.format(o[2])} viagens, ${brl(o[3])}, média de ${brl(o[3] / Math.max(1, o[2]))} por viagem. ` : ''}Diárias + passagens + outros gastos, menos devoluções; valores da época, pelo mês de início. * Ano em curso. Fonte: Portal da Transparência (CGU), viagens a serviço, órgão superior 20000.`;
  }
  // ================================================================ VIAGENS (todo o governo)
  const VG = { sort: 'v', dir: -1, data: null, sel: null };
  function initViagGov() {
    const V = S.viagRes; const ys = Object.keys(V.anos).sort(); const sel = $('#vg-year');
    const cy = String(new Date().getFullYear()); const lf = ys.filter((y) => y !== cy).pop() || ys[ys.length - 1];
    fillYears(sel, ys.slice().reverse(), lf);
    const drawChart = () => barChart($('#chart-vg'), ys.map((y) => { const a = V.anos[y]; const inc = y === cy; return { x: inc ? y + '*' : y, v: a.total, cls: inc ? 'partial' : '', tip: `<b>${y}${inc ? ' (parcial)' : ''}</b>${nf0.format(a.n)} viagens · ${brl(a.total)}<br><small>diárias ${brl(a.diarias)} · passagens ${brl(a.passagens)} · devoluções ${brl(a.devolucao)}</small>` }; }), { height: 220 });
    drawChart(); onResize(drawChart);
    const load = async () => {
      const y = sel.value; const a = V.anos[y];
      $('#vg-kpis').innerHTML = `<div><dt>Viagens em ${esc(y)}</dt><dd>${nf0.format(a.n)}</dd></div><div><dt>Custo total</dt><dd>${brl(a.total)}</dd><small>diárias ${brl(a.diarias)} · passagens ${brl(a.passagens)}</small></div><div><dt>Média por viagem</dt><dd>${brl(a.total / Math.max(1, a.n))}</dd></div><div><dt>Por dia</dt><dd>${nf0.format(a.n / 365)} viagens</dd><small>${brl(a.total / 365)} por dia</small></div>`;
      try { VG.data = await getJSON(`viagens/ano/${y}.json`); } catch (e) { VG.data = null; }
      drawVg(); const first = VG.sel || (VG.data && Object.keys(VG.data.orgaos)[0]); if (first) showVg(first);
    };
    sel.addEventListener('change', load);
    $('#vg-q').addEventListener('input', debounce(drawVg, 200));
    sortableTable($('#vg-table'), VG, () => drawVg());
    rowKeys($('#vg-table tbody'), (k) => showVg(k, true));
    load();
  }
  function drawVg() {
    const tb = $('#vg-table tbody'); if (!VG.data) { tb.innerHTML = '<tr class="empty"><td colspan="4">Não foi possível carregar.</td></tr>'; return; }
    const q = norm($('#vg-q').value);
    const rows = Object.entries(VG.data.orgaos).map(([k, o]) => ({ k, n: o.nome, q: o.n, v: o.v, m: o.v / Math.max(1, o.n) })).filter((r) => !q || norm(r.n).includes(q)).sort(cmp(VG.sort, VG.dir));
    tb.innerHTML = rows.length ? rows.map((r) => `<tr tabindex="0" data-key="${esc(r.k)}" class="${VG.sel === r.k ? 'sel' : ''}"><td class="txt">${esc(r.n)}</td><td>${nf0.format(r.q)}</td><td><b>${brl(r.v)}</b></td><td>${brl(r.m)}</td></tr>`).join('') : '<tr class="empty"><td colspan="4">Nenhum órgão encontrado.</td></tr>';
  }
  function showVg(k, scroll) {
    VG.sel = k; $$('#vg-table tbody tr').forEach((tr) => tr.classList.toggle('sel', tr.dataset.key === k));
    const o = VG.data && VG.data.orgaos[k]; const box = $('#vg-detail'); if (!o) return;
    box.innerHTML = `<h3 class="g-h3">${esc(o.nome)}</h3><p class="g-sub">${esc(VG.data.ano)}: ${nf0.format(o.n)} viagens, ${brl(o.v)} (diárias ${brl(o.diarias)}, passagens ${brl(o.passagens)}). ${o.sig_n ? `${nf0.format(o.sig_n)} marcadas como sigilosas (${brl(o.sig_v)}). ` : ''}${o.urgentes ? `${nf0.format(o.urgentes)} pedidas com urgência.` : ''}</p>
      <h4>Por mês</h4><div class="g-chart" id="vgd-m"></div>
      <h4>Quem pediu (unidade)</h4><ol class="g-bars g-bars-sm" id="vgd-sol"></ol>
      <h4>Cargos que mais viajaram</h4><ol class="g-bars g-bars-sm" id="vgd-car"></ol>
      <h4>Destinos mais comuns</h4><ol class="g-bars g-bars-sm" id="vgd-dest"></ol>`;
    barChart($('#vgd-m'), o.mes.map((v, j) => ({ x: MESES[j], v })), { height: 130 });
    const li = (arr) => arr.map((x) => ({ label: x[0], sub: `${nf0.format(x[2])} viagens`, v: x[1], txt: brl(x[1]) }));
    hbars($('#vgd-sol'), li(o.solicitantes.slice(0, 8))); hbars($('#vgd-car'), li(o.cargos.slice(0, 8))); hbars($('#vgd-dest'), li(o.destinos.slice(0, 10)));
    if (scroll && window.innerWidth < 900) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function initPport() {
    const P = S.pport; const card = $('#pport-card');
    if (!P || !P.anos || !Object.keys(P.anos).length) { card.hidden = true; return; }
    const ys = Object.keys(P.anos).sort(); const sel = $('#pport-year');
    const lf = String(S.serie ? lastFullYear() : ys[ys.length - 2]);
    fillYears(sel, ys.slice().reverse(), ys.includes(lf) ? lf : ys[ys.length - 1]);
    const draw = () => {
      const rows = (P.anos[sel.value] || []).slice().sort((a, b) => b[3] - a[3]);
      const t = rows.reduce((a, r) => [a[0] + r[2], a[1] + r[3], a[2] + r[4]], [0, 0, 0]);
      $('#pport-table tbody').innerHTML = rows.map((r) => `<tr><td class="txt">${esc(r[1])}<small>código ${esc(r[0])}</small></td><td><b>${brl(r[3])}</b></td><td>${brl(r[4])}</td></tr>`).join('') + `<tr class="g-total"><td class="txt"><b>Total</b></td><td><b>${brl(t[1])}</b></td><td>${brl(t[2])}</td></tr>`;
    };
    sel.addEventListener('change', draw); draw();
  }

  // ================================================================ EMENDAS
  const EM = { sort: 'pago', dir: -1, shown: 25, rows: [], sel: null };
  const EM_TIPOS = [['Individual (com destino definido)', '--g-c1'], ['Individual ("emenda Pix")', '--g-c2'], ['Bancada estadual', '--g-c3'], ['Comissão', '--g-c4'], ['Relator-geral', '--g-c5']];
  const emTipoKey = (t) => (/^Individual/.test(t) ? 'p' : /^Bancada/.test(t) ? 'b' : /^Comiss/.test(t) ? 'c' : /^Relator/.test(t) ? 'r' : '');
  function initEmendas() {
    const R = S.emRes; const ys = Object.keys(R.anos).sort();
    const f = $('#em-from'); const t = $('#em-to');
    fillYears(f, ys, ys[0]); fillYears(t, ys, ys[ys.length - 1]);
    $('#em-legend').innerHTML = EM_TIPOS.map(([k, c]) => `<span><i style="background:var(${c})"></i>${esc(k)}</span>`).join('');
    const drawChart = () => barChart($('#chart-em'), ys.map((y) => { const a = R.anos[y]; const last = y === ys[ys.length - 1]; const tot = a.pag + a.rp_pago; return { x: last ? y + '*' : y, v: tot, parts: EM_TIPOS.map(([k, c]) => ({ v: a.tipos[k] || 0, color: c })), tip: `<b>${y}${last ? ' (parcial)' : ''}</b>Pago: ${brl(tot)}<br><small>${EM_TIPOS.filter(([k]) => a.tipos[k]).map(([k]) => `${esc(k)}: ${brl(a.tipos[k])}`).join('<br>')}<br>reservado (empenhado): ${brl(a.emp)}</small>` }; }), { height: 230 });
    drawChart(); onResize(drawChart);
    const re = () => { EM.shown = 25; renderEm(); };
    [f, t, $('#em-tipo')].forEach((x) => x.addEventListener('change', re));
    $('#em-q').addEventListener('input', debounce(re, 200));
    $('#em-more').addEventListener('click', () => { EM.shown += 50; drawEmTable(); });
    sortableTable($('#em-table'), EM, () => drawEmTable());
    rowKeys($('#em-table tbody'), (k) => showEmAutor(k, true));
    renderEm();
  }
  function renderEm() {
    const R = S.emRes; const A = S.emAut;
    let a = +$('#em-from').value; let b = +$('#em-to').value; if (a > b) [a, b] = [b, a];
    const tipo = $('#em-tipo').value; const q = norm($('#em-q').value.trim());
    const rows = [];
    A.autores.forEach((r) => {
      if (tipo && emTipoKey(r[2]) !== tipo) return;
      if (q && !norm(r[1]).includes(q)) return;
      let emp = 0; let pago = 0;
      Object.entries(r[8]).forEach(([y, v]) => { if (+y >= a && +y <= b) { emp += v[0]; pago += v[1]; } });
      if (!emp && !pago) return;
      rows.push({ key: r[0], nome: r[1], tipo: r[2], emp, pago, parl: r[9] });
    });
    EM.rows = rows; drawEmTable();
    let tp = 0; let te = 0; const fun = {}; const uf = {};
    for (let y = a; y <= b; y++) { const x = R.anos[y]; if (!x) continue; tp += x.pag + x.rp_pago; te += x.emp; Object.entries(x.funcao).forEach(([k, v]) => { fun[k] = (fun[k] || 0) + v; }); Object.entries(x.uf).forEach(([k, v]) => { uf[k] = (uf[k] || 0) + v; }); }
    const ind = rows.filter((r) => emTipoKey(r.tipo) === 'p');
    const yN = b - a + 1; const pp = pop(Math.min(b, new Date().getFullYear()));
    $('#em-kpis').innerHTML = `<div><dt>Pago (${a}–${b})</dt><dd>${brl(tp)}</dd><small>valor da época</small></div><div><dt>Reservado (empenhado)</dt><dd>${brl(te)}</dd></div><div><dt>Autores nesta lista</dt><dd>${nf0.format(rows.length)}</dd><small>${nf0.format(ind.length)} com emendas individuais</small></div><div><dt>Por brasileiro</dt><dd>${pp ? brl(tp / pp) : '—'}</dd><small>no período todo</small></div>`;
    const topF = Object.entries(fun).sort((x, y) => y[1] - x[1]);
    const tf = topF.reduce((s, x) => s + x[1], 0) || 1;
    hbars($('#em-fun'), topF.slice(0, 12).map(([k, v]) => ({ label: k, v, txt: `${brl(v)} · ${pct(v / tf, 0)}` })));
    const tu = Object.values(uf).reduce((s, v) => s + v, 0) || 1;
    hbars($('#em-uf'), Object.entries(uf).sort((x, y) => y[1] - x[1]).slice(0, 28).map(([k, v]) => ({ label: k, v, txt: `${brl(v)} · ${pct(v / tu, 0)}` })));
    const yl = R.anos[b] || R.anos[ys0()]; const rel = Object.entries((R.anos[2021] || {}).tipos || {}).find(([k]) => /^Relator/.test(k));
    $('#em-simple').innerHTML = `<p>De ${a} a ${b}, o governo federal pagou <b>${brl(tp)}</b> em emendas parlamentares, cerca de <b>${brl(tp / yN)} por ano</b>. A maior parte foi para <b>${esc(topF[0] ? topF[0][0] : '—')}</b>${topF[1] ? ` e <b>${esc(topF[1][0])}</b>` : ''}. As emendas individuais de cada parlamentar têm valor garantido por lei; de 2020 a 2022 as "emendas de relator" (o chamado orçamento secreto) não mostravam quem pediu o dinheiro${rel ? ` (em 2021, ${brl(rel[1])} pagos)` : ''}.</p>`;
    void yl;
  }
  const ys0 = () => Object.keys(S.emRes.anos).sort()[0];
  function drawEmTable() {
    const rows = EM.rows.slice().sort(cmp(EM.sort, EM.dir));
    $('#em-table tbody').innerHTML = rows.length ? rows.slice(0, EM.shown).map((r, i) => `<tr tabindex="0" data-key="${esc(r.key)}" class="${EM.sel === r.key ? 'sel' : ''}"><td class="num-col">${i + 1}</td><td class="txt"><b>${esc(r.nome)}</b>${r.parl ? '<small>também na cota parlamentar</small>' : ''}</td><td class="txt">${esc(r.tipo)}</td><td>${brl(r.emp)}</td><td><b>${brl(r.pago)}</b></td></tr>`).join('') : '<tr class="empty"><td colspan="5">Nenhum autor encontrado com esses filtros.</td></tr>';
    $('#em-more').hidden = rows.length <= EM.shown;
  }
  async function showEmAutor(id, scroll) {
    EM.sel = id; $$('#em-table tbody tr').forEach((tr) => tr.classList.toggle('sel', tr.dataset.key === id));
    const box = $('#em-detail'); box.hidden = false; box.innerHTML = '<p class="g-loading">Carregando…</p>';
    if (scroll) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    let D; try { D = await getJSON(`emendas/a/${id}.json`); } catch (e) { box.innerHTML = '<p>Não foi possível carregar este autor.</p>'; return; }
    const ys = Object.keys(D.anos).sort(); const tp = ys.reduce((s, y) => s + D.anos[y].pago, 0); const te = ys.reduce((s, y) => s + D.anos[y].emp, 0);
    const tl = D.local.reduce((s, x) => s + x[1], 0) || 1; const tf = Object.values(D.funcao).reduce((s, v) => s + v, 0) || 1;
    box.innerHTML = `<div class="g-detail-head"><div><h3>${esc(D.nome)}</h3><p class="g-sub">Emendas de ${esc(ys[0])}${ys.length > 1 ? ' a ' + esc(ys[ys.length - 1]) : ''} · reservado ${brl(te)} · pago ${brl(tp)}${D.parlamentar ? ` · <a href="#p=${esc(D.parlamentar)}" data-person="${esc(D.parlamentar)}">ver a cota parlamentar</a>` : ''}</p>${D.parlamentar ? `<p class="g-links">${profileLinks(D.parlamentar)}</p>` : ''}</div><button class="button button-ghost g-close" type="button" aria-label="Fechar detalhe">Fechar</button></div>
      <h4>Pago por ano</h4><div class="g-chart" id="emd-years"></div>
      <div class="g-grid-2 g-detail-lists"><div><h4>Para onde foi (cidade ou estado)</h4><ol class="g-bars g-bars-sm" id="emd-loc"></ol></div><div><h4>Em que área</h4><ol class="g-bars g-bars-sm" id="emd-fun"></ol></div></div>
      <p class="g-chart-note">"Pago" inclui restos a pagar pagos depois. Fonte: Portal da Transparência (CGU), emendas parlamentares.</p>`;
    barChart($('#emd-years'), ys.map((y) => ({ x: y, v: D.anos[y].pago, tip: `<b>${y}</b>pago ${brl(D.anos[y].pago)}<br><small>reservado ${brl(D.anos[y].emp)} · ${D.anos[y].n} registro(s)</small>` })), { height: 170 });
    hbars($('#emd-loc'), D.local.slice(0, 12).map(([k, v]) => ({ label: k, v, txt: `${brl(v)} · ${pct(v / tl, 0)}` })));
    hbars($('#emd-fun'), Object.entries(D.funcao).slice(0, 10).map(([k, v]) => ({ label: k, v, txt: `${brl(v)} · ${pct(v / tf, 0)}` })));
    $('.g-close', box).addEventListener('click', () => { box.hidden = true; EM.sel = null; $$('#em-table tbody tr').forEach((tr) => tr.classList.remove('sel')); });
    const pl = $('[data-person]', box); if (pl) pl.addEventListener('click', (e) => { e.preventDefault(); openPerson(pl.dataset.person); });
  }

  // ---------------------------------------------------------------- fontes e lacunas
  function renderSources() {
    const F = S.fontes || {};
    const order = ['tesouro_series', 'siop', 'ipca', 'populacao', 'cpgf', 'presidencia_cartao_2003_2022', 'camara_ceap', 'senado_ceaps', 'senado_lista', 'emendas', 'viagens', 'portal_api'];
    const keys = [...order.filter((k) => F[k]), ...Object.keys(F).filter((k) => !order.includes(k))];
    $('#sources').innerHTML = keys.length ? keys.map((k) => { const f = F[k]; return `<li><a href="${esc(f.url)}" target="_blank" rel="noreferrer">${esc(f.nome)}</a>${f.cobertura ? ` — cobertura: ${esc(f.cobertura)}` : ''}${f.publicado_em ? ` — publicado em ${esc(f.publicado_em)}` : ''} — coletado em ${esc((f.coletado_em || '').split('-').reverse().join('/'))}${f.doc ? ` (<a href="${esc(f.doc)}" target="_blank" rel="noreferrer">documentação</a>)` : ''}.</li>`; }).join('') : '<li>Lista de fontes indisponível no momento.</li>';
    $('#ft-upd').textContent = (S.meta && S.meta.gerado_em) || '—';
    const gaps = [
      'Antes de 1980 não há série oficial aberta de gastos da União; a série do Tesouro por função e por tipo começa em 1980. Valores em reais de hoje só a partir de 1995 (antes: cinco moedas e hiperinflação).',
      'A lista de áreas (funções) mudou em 2000; a evolução de cada área começa nesse ano.',
      `O detalhamento por ministério, órgão e ação (SIOP) começa em ${S.res ? resYears()[0] : 2000}. Antes disso não há base aberta e estruturada com esse nível de detalhe.`,
      'O ano em curso é parcial em todas as bases. No SIOP, "pago" é só o que foi pago do orçamento do próprio ano; pagamentos de anos anteriores (restos a pagar) ficam de fora.',
      'População: as estimativas do IBGE de 2001 a 2021 foram feitas antes do Censo 2022, que contou cerca de 10 milhões de pessoas a menos; por isso o valor "por brasileiro" dá um salto entre 2021 e 2022. Anos sem número oficial (1981–1990, 1992–1999, 2007, 2023) são interpolados entre dados oficiais.',
      'Cota parlamentar: a Câmara começa em 2008 com poucos registros (a CEAP unificada começou em 2009); o Senado, em 2008. Antes disso não há dado aberto nesse formato. Gastos das lideranças partidárias na Câmara não entram no ranking por pessoa.',
      'Senado: o arquivo de despesas não traz partido nem UF; usamos a lista oficial de senadores (legislaturas 53 a 57), com a filiação mais recente.',
    ];
    const cm = (F.cpgf && F.cpgf.meses) || [];
    if (cm.length) {
      const have = new Set(cm); const missing = []; const now = new Date();
      for (let y = 2013; y <= now.getFullYear(); y++) for (let m = 1; m <= 12; m++) { if (y === now.getFullYear() && m > now.getMonth() + 1) break; const k = `${y}${String(m).padStart(2, '0')}`; if (!have.has(k)) missing.push(k); }
      gaps.push(`Cartão corporativo (todos os órgãos): o Portal da Transparência começa em jan/2013. ${missing.length ? `Meses que ainda não temos: ${missing.length} (${missing.slice(0, 6).map((k) => k.slice(4) + '/' + k.slice(0, 4)).join(', ')}${missing.length > 6 ? '…' : ''}).` : 'Todos os meses publicados já foram baixados.'} A atualização semanal baixa os meses que faltam aos poucos; os meses mais recentes podem ainda não ter sido publicados pelo Portal.`);
    }
    gaps.push('Cartão da Presidência por mandato: a planilha oficial cobre 02/01/2003 a 19/12/2022. De 2013 em diante também há os dados mensais do Portal, que medem de outro jeito (sem descontar devoluções e pelo mês da fatura).');
    gaps.push('Emendas parlamentares: o Portal da Transparência traz dados a partir de 2014 (2014 e 2015 com menos registros). Emendas de relator (2020–2022) e de comissão não mostram qual parlamentar pediu o dinheiro.');
    if (S.viagRes) { const vy = Object.keys(S.viagRes.anos).sort(); gaps.push(`Viagens a serviço: dados do Portal da Transparência de ${vy[0]} a ${vy[vy.length - 1]} (o ano atual é parcial). Contamos pela data de início da viagem; viagens canceladas ficam de fora. Nomes e cargos de parte das viagens da Presidência são sigilosos.`); }
    gaps.push('Ainda não incluídos nesta página: salários de servidores e gastos de estados e municípios.');
    $('#gaps').innerHTML = gaps.map((g) => `<li>${esc(g)}</li>`).join('');
  }

  // ---------------------------------------------------------------- início
  async function start() {
    const safe = (p) => getJSON(p).catch((e) => { console.warn(e); return null; });
    const [idx, serie, res, fontes, meta, parlIdx, parlRes, cart, presHist, emRes, emAut, viagRes, pport] = await Promise.all([
      safe('indices.json'), safe('uniao/serie.json'), safe('uniao/resumo.json'), safe('fontes.json'), safe('meta.json'),
      safe('parl/indice.json'), safe('parl/resumo.json'), safe('cartao/resumo.json'), safe('cartao/presidencia-2003-2022.json'),
      safe('emendas/resumo.json'), safe('emendas/autores.json'), safe('viagens/resumo.json'), safe('api/presidencia-por-orgao.json'),
    ]);
    safe('parl/politicos_ids.json').then((j) => { S.polIds = j; });
    fetch('/politica/paginas.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).then((j) => { S.pages = (j && j.paginas) || {}; }).catch(() => { S.pages = {}; });
    Object.assign(S, { idx, serie, res, fontes, meta, parlIdx, parlRes, cart, presHist, emRes, emAut, viagRes, pport });
    const run = (name, fn) => { try { fn(); } catch (e) { console.warn(name, e); const sec = document.getElementById(name); if (sec) { const p = document.createElement('p'); p.className = 'g-note warn'; p.textContent = 'Não foi possível montar esta seção agora. Tente recarregar a página.'; $('.container', sec).appendChild(p); } } };
    if (idx && serie) { run('visao', initVisao); run('areas', initAreas); }
    if (idx && res) run('orgaos', initOrgaos);
    if (idx && res) run('presidencia', initPresidencia);
    run('presidencia', initViagens); if (idx) run('presidencia', initPport);
    if (cart) run('cartao', initCartao);
    if (viagRes) run('viagens', initViagGov); else { const v = $('#viagens'); if (v) v.hidden = true; }
    if (emRes && emAut && idx) run('emendas', initEmendas);
    if (parlIdx && parlRes && idx) run('congresso', initCongresso);
    run('como-ler', renderSources);
    const m = /^#p=([cs]-[\w-]+)/.exec(location.hash);
    if (m && parlIdx && parlRes) openPerson(m[1]);
  }
  start();
})();
