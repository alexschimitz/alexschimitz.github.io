// Telas e modais do jogo (tudo em pt-BR).
import * as D from '../data.js';
import * as M from '../sim.js';
import * as S from '../score.js';
import * as V from '../save.js';
import * as TM from '../team.js';
import { money, moneyShort, num, numShort, dateStr, dateOf, WEEKS_PER_YEAR, GAME_VERSION } from '../util.js';
import { sfx, setSound, applyAudioSettings } from '../audio.js';
import { h, modal, toast, avatar, avatarSVG, ringAvatar, ratingChip, notaColor, barChart, pairChart, sparkline, closeAllModals, $ } from './dom.js';
import { G } from './ctrl.js';
import { nameChips, openHub, openCity } from './screens2.js';
export { openCity } from './screens2.js';
export { openHub, openMarket, openFans, openSocial, openPress, openCrisis, openLifeEvent, openLife, openLearn, openPublish, openPublishWizard, openCareer } from './screens2.js';
import { openPublishWizard } from './screens2.js';
import { newStudioExtras, openStudioEditor, openScenario, openStats, openMedia } from './screens5.js';
export { openMedia, openStats, openCeremony, openStaffLife, openStudioEditor, openScenario, legacyEntry } from './screens5.js';

const s = () => G.s;
const SK3 = { d: 'Des', t: 'Tec', g: 'Art', s: 'Som', q: 'Tes', r: 'Pes' };
const act = (err, okMsg) => { if (err) { toast(err[0].toUpperCase() + err.slice(1), 'ruim'); sfx.bad(); return false; } if (okMsg) toast(okMsg, 'bom'); sfx.coin(); G.refresh(); return true; };
const themeName = (id) => D.THEME_BY_ID[id].nome;
const genreName = (id) => D.GENRES.find((g) => g.id === id).nome;
const platName = (id) => D.PLAT_BY_ID[id].nome;
const audName = (id) => D.AUDIENCES.find((a) => a.id === id).nome;

// =====================================================================
// CONCEITO DO JOGO
// =====================================================================
export function openConcept() {
  const st = s();
  if (st.project) return openPending();
  const c = { name: `Jogo #${st.nextGame}`, size: 'pequeno', audience: 'T', theme: null, genre: null, sub: null, platform: null, engineLvl: M.engineLevel(st) };
  const avail = M.availablePlatforms(st);
  if (avail.length) c.platform = avail[0].id;
  const body = h('div', { class: 'col' });
  const m = modal({ title: 'Conceito do Jogo', color: '#2f3b52', body, size: '', actions: [] });
  G.tut(1);
  const render = () => {
    const cost = c.platform ? M.licenseCost(st, c.platform, c.size) : 0;
    const sz = D.SIZES[c.size];
    const ratingRow = c.theme && c.genre ? h('div', { class: 'row wrap small' },
      h('span', {}, 'Tema × Gênero:'), ratingChip(D.themeGenreRating(c.theme, c.genre)),
      c.sub ? h('span', {}, '+ sub:') : null, c.sub ? ratingChip(D.themeGenreRating(c.theme, c.sub)) : null,
      h('span', {}, 'Tema × Público:'), ratingChip(D.themeAudRating(c.theme, c.audience))) : h('div', { class: 'muted small' }, 'Escolha tema e gênero para ver a compatibilidade (+++ é o melhor).');
    const pickBtn = (label, val, fn, set) => h('button', { class: 'pick' + (set ? ' set' : ''), onclick: () => { sfx.click(); fn(); } }, h('span', {}, label), h('span', { class: 'v' }, val + '  ▸'));
    body.replaceChildren(
      h('div', {}, h('div', { class: 'small b' }, 'Nome do jogo'), h('input', { id: 'inp-name', type: 'text', value: c.name, maxlength: 28, oninput: (e) => { c.name = e.target.value; } }),
        nameChips(c, (n) => { c.name = n; const el = document.getElementById('inp-name'); if (el) el.value = n; })),
      (st.world?.protos || []).some((p) => !p.used) ? h('div', {}, h('div', { class: 'small b' }, 'Protótipos de game jams (adiantam o projeto)'),
        h('div', { class: 'chips' }, st.world.protos.map((p, i) => p.used ? null : h('button', { class: 'chipb' + (c.protoId === i ? ' on' : ''), onclick: () => { sfx.click(); c.protoId = c.protoId === i ? null : i; if (c.protoId === i) { c.theme = p.theme; if (M.unlockedGenres(st).includes(p.genre)) c.genre = p.genre; c.name = p.nome; } render(); } }, p.nome)))) : null,
      h('div', {}, h('div', { class: 'small b' }, 'Tamanho'),
        h('div', { class: 'seg' }, Object.values(D.SIZES).map((z) => {
          const ok = M.sizeUnlocked(st, z.id);
          return h('button', { class: (c.size === z.id ? 'on ' : '') + (ok ? '' : 'lock'), onclick: () => { if (!ok) { toast(`Pesquise "${D.RES_BY_ID[z.req].nome}" no laboratório`, 'ruim'); return; } c.size = z.id; render(); } }, z.nome + (ok ? '' : ' (bloq.)'));
        })),
        h('div', { class: 'muted small' }, `Escopo: ${sz.total} pts · equipe mínima ${sz.minEquipe} · preço base ${money(sz.preco)}`)),
      h('div', {}, h('div', { class: 'small b' }, 'Público-alvo'),
        h('div', { class: 'seg aud' }, D.AUDIENCES.map((a) => h('button', { 'data-a': a.id, class: c.audience === a.id ? 'on' : '', onclick: () => { c.audience = a.id; render(); } }, a.id + ' · ' + a.nome)))),
      pickBtn('Tema', c.theme ? themeName(c.theme) : 'escolher', () => pickTheme(c, render), !!c.theme),
      pickBtn('Gênero', c.genre ? genreName(c.genre) : 'escolher', () => pickGenre(c, render, false), !!c.genre),
      M.subgenreUnlocked(st) ? pickBtn('Subgênero (opcional)', c.sub ? genreName(c.sub) : 'nenhum', () => pickGenre(c, render, true), !!c.sub) : null,
      pickBtn('Plataforma', c.platform ? platName(c.platform) : 'escolher', () => pickPlatform(c, render), !!c.platform),
      pickBtn('Motor', M.engineName(c.engineLvl, st), () => pickEngine(c, render), true),
      ratingRow,
      h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => openCompatGuide(c) }, 'Guia de compatibilidade'),
        h('span', { class: 'sp' }), h('div', { class: 'small' }, 'Licença: ', h('b', {}, money(cost)), ' · Caixa: ', h('b', {}, money(st.money))))
    );
    m.setActions([
      { label: 'Cancelar', fn: () => m.close() },
      { label: 'Próximo ▸', cls: 'ok', fn: () => {
        if (!c.theme || !c.genre || !c.platform) { toast('Escolha tema, gênero e plataforma', 'ruim'); return; }
        const err = M.startProject(st, { ...c, name: c.name.trim() || `Jogo #${st.nextGame}` });
        if (err) { toast(err[0].toUpperCase() + err.slice(1), 'ruim'); sfx.bad(); return; }
        sfx.coin(); m.close(); G.refresh(); openPhase();
      } },
    ]);
  };
  render();
}

function sheet(title, body, onClose) {
  return modal({ title, color: '#3b82c4', body, onClose, actions: [{ label: 'Voltar', fn: (a) => a.close() }] });
}
function pickTheme(c, done) {
  const st = s(); const unlocked = M.unlockedThemes(st);
  const body = h('div', { class: 'col' });
  const m = sheet('Escolher Tema', body, done);
  body.append(h('div', { class: 'small muted' }, c.genre ? `Compatibilidade com ${genreName(c.genre)} e público ${c.audience}:` : 'Escolha o gênero primeiro para ver a compatibilidade nos temas.'));
  const grid = h('div', { class: 'grid3' });
  for (const id of unlocked) {
    const t = D.THEME_BY_ID[id];
    grid.append(h('button', { class: 'gbtn' + (c.theme === id ? ' on' : ''), onclick: () => { c.theme = id; sfx.click(); m.close(); } }, t.nome,
      c.genre ? h('span', { class: 'row', style: { gap: '3px' } }, ratingChip(D.themeGenreRating(id, c.genre)), ratingChip(D.themeAudRating(id, c.audience))) : null));
  }
  body.append(grid, h('div', { class: 'muted small' }, `${unlocked.length} de ${D.THEMES.length} temas liberados. Pesquise pacotes de temas no laboratório.`));
}
function pickGenre(c, done, isSub) {
  const st = s(); const un = M.unlockedGenres(st);
  const body = h('div', { class: 'grid2' });
  const m = sheet(isSub ? 'Escolher Subgênero' : 'Escolher Gênero', body, done);
  if (isSub) body.append(h('button', { class: 'gbtn', onclick: () => { c.sub = null; m.close(); } }, 'Nenhum'));
  for (const g of D.GENRES) {
    const ok = un.includes(g.id) && (isSub ? g.id !== c.genre : g.id !== c.sub);
    const known = st.genreUse[g.id] || 0;
    body.append(h('button', { class: 'gbtn' + (ok ? '' : ' lock'), onclick: () => {
      if (!un.includes(g.id)) { toast('Gênero bloqueado: pesquise no laboratório', 'ruim'); return; }
      if (!ok) return;
      if (isSub) c.sub = g.id; else { c.genre = g.id; if (c.sub === g.id) c.sub = null; }
      sfx.click(); m.close();
    } }, g.nome, c.theme ? ratingChip(D.themeGenreRating(c.theme, g.id)) : null,
      h('span', { class: 'small muted' }, known ? `${known} jogo(s) feitos` : 'inédito')));
  }
}
function pickPlatform(c, done) {
  const st = s(); const y = M.year(st);
  const body = h('div', {});
  const m = sheet('Escolher Plataforma', body, done);
  body.append(h('div', { class: 'small muted', style: { marginBottom: '8px' } }, `Ano ${y}. Mercado = potencial de vendas. Taxa = parte da receita que fica com a plataforma.`));
  const list = D.PLATFORMS.filter((p) => !!p.indie === (st.mode === 'indie')).map((p) => ({ p, ok: M.platformAvailable(st, p), mk: D.platformMarket(p, y) })).sort((a, b) => (b.ok - a.ok) || (a.p.de - b.p.de));
  const mx = Math.max(...list.map((l) => l.mk));
  for (const { p, ok, mk } of list) {
    let why = '';
    if (y < p.de) why = `chega no ano ${p.de}`; else if (y > p.ate) why = 'saiu do mercado'; else if (p.req && !M.hasRes(st, p.req)) why = `exige: ${D.RES_BY_ID[p.req].nome}`;
    const lic = M.licenseCost(st, p.id, c.size);
    body.append(h('button', { class: 'li' + (ok ? '' : ' dim'), style: { width: '100%', textAlign: 'left', borderColor: c.platform === p.id ? '#2f3b52' : '' }, onclick: () => {
      if (!ok) { toast(`Indisponível: ${why}`, 'ruim'); return; } c.platform = p.id; sfx.click(); m.close(); } },
      h('div', { class: 'grow' }, h('div', { class: 'nm' }, p.nome, h('span', { class: 'muted small' }, ' · ' + p.tipo)),
        h('div', { class: 'bar b' }, h('i', { style: { width: (mk / mx * 100) + '%' } })),
        h('div', { class: 'small muted' }, ok ? `Licença ${money(lic)} · taxa ${Math.round(p.taxa * 100)}% · até o ano ${p.ate > 90 ? '∞' : p.ate}` : why))));
  }
}
function pickEngine(c, done) {
  const st = s(); const body = h('div', {}); const m = sheet('Escolher Motor', body, done);
  for (let l = M.engineLevel(st); l >= 1; l--) {
    body.append(h('button', { class: 'li', style: { width: '100%', textAlign: 'left', borderColor: c.engineLvl === l ? '#2f3b52' : '' }, onclick: () => { c.engineLvl = l; sfx.click(); m.close(); } },
      h('div', { class: 'grow' }, h('div', { class: 'nm' }, M.engineName(l, st)), h('div', { class: 'small muted' }, `Nível ${l}: +${7 * (l - 1)}% de Tecnologia, menos bugs, teto gráfico maior.`))));
  }
}

// ---------- reabrir pendência (fase/evento/resultado) ----------
export function openPending() {
  const p = s().project; if (!p) return openConcept();
  if (p.stage === 'config') return openPhase();
  if (p.stage === 'event') return openEvent();
  if (p.stage === 'result') return openResult();
  openProjectInfo();
}
export function openProjectInfo() {
  const st = s(), p = st.project; if (!p) return;
  const body = h('div', { class: 'col' },
    h('div', { class: 'kv' }, h('span', {}, 'Tema / Gênero'), h('b', {}, `${themeName(p.theme)} / ${genreName(p.genre)}${p.sub ? ' + ' + genreName(p.sub) : ''}`)),
    h('div', { class: 'kv' }, h('span', {}, 'Plataforma'), h('b', {}, platName(p.platform))),
    h('div', { class: 'kv' }, h('span', {}, 'Fase'), h('b', {}, `${p.phase}/3 · ${Math.round(M.projectProgress(p) * 100)}%`)),
    h('div', { class: 'kv' }, h('span', {}, 'Design / Tecnologia'), h('b', {}, `${Math.round(p.d)} / ${Math.round(p.t)}`)),
    h('div', { class: 'kv' }, h('span', {}, 'Bugs'), h('b', {}, String(Math.round(p.bugs)))),
    h('div', { class: 'kv' }, h('span', {}, 'Hype'), h('b', {}, `${Math.round(p.hype)}/100`)),
    h('div', { class: 'kv' }, h('span', {}, 'Semanas de desenvolvimento'), h('b', {}, String(p.weeks))),
    h('button', { class: 'btn yellow', onclick: () => { m.close(); openMarketing(); } }, 'Campanha de Marketing'));
  const m = modal({ title: p.name, color: '#2f3b52', body, actions: [{ label: 'Fechar', fn: () => m.close() }] });
}

// =====================================================================
// FASE DE DESENVOLVIMENTO 1/2/3
// =====================================================================
export function openPhase() {
  const st = s(), p = st.project; if (!p || p.stage !== 'config') return;
  const phase = p.phase; const cats = D.catsOfPhase(phase);
  const focus = Object.fromEntries(cats.map((c) => [c.id, p.focus[c.id] ?? 5]));
  const team = new Set(st.employees.filter((e) => !e.training).map((e) => e.id));
  const extras = new Set();
  const known = st.genreUse[p.genre] || 0;
  const ideal = S.idealShares(p.genre, p.sub, phase);
  const body = h('div', { class: 'phase3' });
  const m = modal({ title: `Fase de Desenvolvimento ${phase}/3 — ${p.name}`, color: '#2f3b52', size: 'wide', body, closable: false });
  if (phase === 1) G.tut(2);
  const render = () => {
    // equipe
    const emps = st.employees;
    const colTeam = h('div', { class: 'pcol' }, h('h4', {}, 'Equipe'));
    let od = 0, ot = 0;
    for (const e of emps) {
      const on = team.has(e.id) && !e.training;
      const mult = (0.6 + 0.4 * e.energy / 100) * (1 + 0.04 * (e.level - 1));
      if (on) { od += e.skills.d * mult; ot += e.skills.t * mult; }
      colTeam.append(h('button', { class: 'li' + (on ? '' : ' dim'), style: { width: '100%', textAlign: 'left', marginBottom: '6px' }, onclick: () => {
        if (e.training) { toast(`${e.name} está em treinamento`, 'ruim'); return; }
        if (on && team.size <= 1) { toast('A equipe precisa de pelo menos 1 pessoa', 'ruim'); return; }
        on ? team.delete(e.id) : team.add(e.id); sfx.click(); render(); } },
        ringAvatar(e, 46),
        h('div', { class: 'grow' }, h('div', { class: 'nm' }, e.name.split(' ')[0], h('span', { class: 'muted small' }, ' · ' + (e.founder ? 'Fundador(a)' : D.ROLES[e.role].nome))),
          h('div', { class: 'skills' }, ['d', 't', 'g', 's', 'q'].map((k) => h('span', { class: 'sk' + (e.skills[k] >= 7 ? ' hi' : '') }, SK3[k] + ' ' + e.skills[k]))),
          h('div', { class: 'small muted' }, e.training ? 'Em treinamento' : `Energia ${Math.round(e.energy)}%`)),
        h('div', { class: 'chip', style: { background: on ? '#3da35d' : '#aaa' } }, on ? 'No jogo' : 'Fora')));
    }
    colTeam.append(h('div', { class: 'small muted' }, `Produção estimada/sem: `, h('b', {}, `Design ${Math.round(od)} · Tec ${Math.round(ot)}`)),
      h('div', { class: 'small muted' }, `Duração estimada da fase: ~${Math.max(1, Math.round((p.total / 3) / Math.max(1, od + ot)))} sem.`));
    // foco
    const sh = S.actualShares(focus, phase);
    const colFoc = h('div', { class: 'pcol' }, h('h4', {}, 'Foco de Desenvolvimento'));
    const tip = Object.entries(ideal).sort((a, b) => b[1] - a[1]);
    colFoc.append(h('div', { class: 'small', style: { marginBottom: '6px', textAlign: 'center' } },
      known === 0 ? `Dica do consultor: ${genreName(p.genre)} dá valor a ${D.CAT_BY_ID[tip[0][0]].nome}.` : known === 1 ? `Dica: ${genreName(p.genre)} gosta de ${D.CAT_BY_ID[tip[0][0]].nome} e ${D.CAT_BY_ID[tip[1][0]].nome}.` : 'Você já domina este gênero: veja as marcas do ideal.'));
    for (const c of cats) {
      colFoc.append(h('div', { class: 'fc' },
        h('div', { class: 'top' }, h('span', {}, c.nome), h('span', {}, Math.round(sh[c.id] * 100) + '%')),
        h('div', { class: 'small muted' }, c.dica + ` · nível ${M.catLevel(st, c.id)}`),
        h('input', { type: 'range', min: 0, max: 10, step: 1, value: focus[c.id], oninput: (e) => { focus[c.id] = +e.target.value; updatePrev(); } })));
    }
    const cols = ['#e8523c', '#3b82c4', '#3da35d'];
    const prev = h('div', { class: 'fc' }, h('div', { class: 'small b' }, 'Prévia de alocação de tempo'), h('div', { class: 'stack', id: 'stk' }),
      known >= 2 ? h('div', { class: 'stack thin', id: 'stk2', title: 'ideal do gênero' }) : null,
      h('div', { class: 'small muted', id: 'fitl' }));
    colFoc.append(prev);
    const updatePrev = () => {
      const a = S.actualShares(focus, phase);
      $('#stk', prev).replaceChildren(...cats.map((c, i) => h('i', { style: { width: (a[c.id] * 100) + '%', background: cols[i] } })));
      colFoc.querySelectorAll('.fc .top span:last-child').forEach((sp, i) => { if (cats[i]) sp.textContent = Math.round(a[cats[i].id] * 100) + '%'; });
      if (known >= 2) $('#stk2', prev).replaceChildren(...cats.map((c, i) => h('i', { style: { width: (ideal[c.id] * 100) + '%', background: cols[i], opacity: .55 } })));
      if (known >= 3) $('#fitl', prev).textContent = `Adequação ao gênero: ${Math.round(S.phaseFit(p.genre, p.sub, phase, focus) * 100)}%`;
      else $('#fitl', prev).textContent = known >= 2 ? 'Barra fina = proporção ideal do gênero.' : cats.map((c, i) => `${['vermelho', 'azul', 'verde'][i]}: ${c.nome}`).join(' · ');
    };
    // extras
    const colEx = h('div', { class: 'pcol' }, h('h4', {}, 'Recursos Adicionais'));
    let exCost = 0;
    const exs = M.extrasForPhase(st, phase);
    for (const ex of exs) {
      const cst = M.extraCost(st, ex, p.size); const on = extras.has(ex.id);
      if (on) exCost += cst;
      colEx.append(h('button', { class: 'li', style: { width: '100%', textAlign: 'left', background: on ? '#fde3bd' : '#fff', borderColor: on ? '#f0a030' : '' }, onclick: () => { on ? extras.delete(ex.id) : extras.add(ex.id); sfx.click(); render(); } },
        h('div', { class: 'grow' }, h('div', { class: 'nm' }, ex.nome), h('div', { class: 'small muted' }, `+qualidade ${Math.round(ex.q * 100)}%`)), h('b', {}, money(cst))));
    }
    const locked = D.EXTRAS.filter((e) => e.fase === phase && e.req && !M.hasRes(st, e.req));
    if (locked.length) colEx.append(h('div', { class: 'small muted' }, `${locked.length} recurso(s) bloqueado(s): pesquise no laboratório.`));
    colEx.append(h('div', { class: 'kv' }, h('span', {}, 'Total'), h('b', { class: exCost > st.money ? 'neg' : '' }, money(exCost))), h('div', { class: 'kv' }, h('span', {}, 'Caixa'), h('b', {}, money(st.money))));
    body.replaceChildren(colTeam, colFoc, colEx);
    updatePrev();
    m.setActions([
      { label: 'Marketing', fn: () => openMarketing() },
      { label: 'OK ▸ Começar fase', cls: 'yellow', disabled: exCost > st.money, fn: () => {
        const err = M.configPhase(st, { focus, extras: [...extras], team: [...team] });
        if (err) { toast(err, 'ruim'); return; }
        sfx.good(); m.close(); if (G.speed === 0) G.setSpeed(1); G.refresh(); G.tut(3);
      } },
    ]);
  };
  render();
}

// ---------- marketing ----------
export function openMarketing() {
  const st = s(), p = st.project; if (!p) { toast('Marketing é por projeto: inicie um jogo.', 'ruim'); return; }
  const body = h('div', {});
  const m = modal({ title: 'Campanha de Marketing', color: '#e0891a', body, actions: [{ label: 'Fechar', fn: () => m.close() }] });
  const render = () => {
    body.replaceChildren(h('div', { class: 'row' }, h('div', { class: 'b' }, 'Hype do jogo'), h('div', { class: 'sp' }), h('b', {}, `${Math.round(p.hype)}/100`)),
      h('div', { class: 'bar o', style: { margin: '4px 0 12px' } }, h('i', { style: { width: p.hype + '%' } })),
      ...D.MARKETING.map((mk) => {
        const ok = !mk.req || M.hasRes(st, mk.req); const done = p.marketing.includes(mk.id); const c = M.marketingCost(st, mk, p.size);
        return h('div', { class: 'li' + (ok ? '' : ' dim') }, h('div', { class: 'grow' }, h('div', { class: 'nm' }, mk.nome), h('div', { class: 'small muted' }, ok ? `+${mk.hype} de hype · ${money(c)}` : `Pesquise: ${D.RES_BY_ID[mk.req].nome}`)),
          h('button', { class: 'btn sm yellow', disabled: !ok || done || st.money < c, onclick: () => { if (act(M.buyMarketing(st, mk.id), 'Campanha contratada!')) render(); } }, done ? 'Feito ✓' : 'Contratar'));
      }),
      h('div', { class: 'small muted' }, 'Mais hype = mais vendas na estreia. Cada campanha vale uma vez por jogo.'));
  };
  render();
}

// =====================================================================
// EVENTO
// =====================================================================
export function openEvent() {
  const st = s(), p = st.project; if (!p || p.stage !== 'event') return;
  const ev = D.EVENTS.find((e) => e.id === p.event);
  sfx.event();
  const body = h('div', { class: 'col' }, h('p', { style: { margin: 0, fontSize: '16px' } }, ev.texto));
  const m = modal({ title: ev.titulo, color: '#8a5cc2', body, closable: false });
  m.setActions([]);
  const foot = h('div', { class: 'col' });
  ev.opcoes.forEach((op, i) => {
    const c = op.custo ? Math.round(op.custo * M.infl(st) / 50) * 50 : 0;
    foot.append(h('button', { class: 'btn ' + (i ? '' : 'pri'), style: { textAlign: 'left' }, disabled: c > st.money, onclick: () => {
      const err = M.resolveEvent(st, i); if (err) { toast(err, 'ruim'); return; } m.close(); G.refresh(); } }, op.txt.replace(/R\$ [\d.]+/, c ? money(c) : '$&')));
  });
  body.append(foot);
}

// =====================================================================
// RESULTADO (jogo completo)
// =====================================================================
export function openResult() {
  const st = s(), p = st.project; if (!p || p.stage !== 'result') return;
  sfx.good(); G.tut(4);
  const body = h('div', {});
  const m = modal({ title: `${p.name} Completo!`, color: '#e0891a', body, closable: false });
  const render = () => {
    const dens = S.bugDensity(p);
    body.replaceChildren(
      h('div', { class: 'circles' },
        h('div', { class: 'circ', style: { background: '#f08a24' } }, h('big', {}, num(p.d)), h('span', {}, 'Design'), p.record.d ? h('em', {}, 'Novo Recorde!') : null),
        h('div', { class: 'circ', style: { background: '#2b6fd6' } }, h('big', {}, num(p.t)), h('span', {}, 'Tecnologia'), p.record.t ? h('em', {}, 'Novo Recorde!') : null)),
      h('h3', {}, 'Experiência ganha ', p.xpMult > 1 ? h('span', { class: 'chip', style: { background: '#3da35d' } }, 'x1.3 Boa Gestão') : null),
      ...D.CATEGORIES.filter((c) => (p.xp[c.id] || 0) > 0.05).map((c) => {
        const cur = st.catXp[c.id], lvl = M.catLevel(st, c.id), nxt = (lvl + 1) ** 2 * 6, base = lvl ** 2 * 6;
        return h('div', { class: 'xi' }, h('div', { class: 'n' }, c.nome), h('div', { class: 'lv' }, lvl), h('div', { class: 'bar b', style: { flex: 1 } }, h('i', { style: { width: Math.min(100, (cur - base) / (nxt - base) * 100) + '%' } })), h('b', { class: 'small' }, '+' + p.xp[c.id].toFixed(1)));
      }),
      h('div', { class: 'kv' }, h('span', {}, 'Bugs encontrados'), h('b', { class: dens > 0.8 ? 'neg' : '' }, String(Math.round(p.bugs)))),
      dens > 0.5 && !p.bugfixed ? h('button', { class: 'btn sm yellow', disabled: M.bugfixCost(st) > st.money, onclick: () => { if (act(M.fixBugs(st), 'Mutirão de testes concluído!')) render(); } }, `Mutirão de testes (${money(M.bugfixCost(st))}) — remove ~70% dos bugs`) : h('div', { class: 'small muted' }, p.bugfixed ? 'Bugs revisados ✓' : 'Poucos bugs. Tá limpinho!'),
      h('div', { class: 'kv' }, h('span', {}, 'Hype'), h('b', {}, `${Math.round(p.hype)}/100`)),
      h('button', { class: 'btn sm', onclick: () => openMarketing() }, 'Campanha de marketing antes do lançamento'),
      h('div', { class: 'small muted', style: { marginTop: '8px' } }, `Pesquisa recebida nas fases: +${Math.round(p.rpGained)} pts · Custo do projeto até aqui: ${money(p.costs.licenca + p.costs.extras + p.costs.marketing + p.costs.outros + p.costs.salarios)}`));
    m.setActions([
      { label: 'Descartar', cls: 'red', fn: () => { if (confirm('Descartar este jogo? Todo o trabalho será perdido.')) { M.discardProject(st); m.close(); G.refresh(); } } },
      { label: st.mode === 'indie' ? 'Publicar…' : 'Lançar!', cls: 'pri', fn: () => {
        if (st.mode === 'indie') { openPublishWizard((g) => { m.close(); G.refresh(); G.save(); openCritics(g); }); return; }
        sfx.launch(); M.releaseGame(st); const g = st.games[st.games.length - 1]; m.close(); G.refresh(); G.save(); openCritics(g); } },
    ]);
  };
  render();
}

// =====================================================================
// CRÍTICAS
// =====================================================================
export function openCritics(g) {
  const body = h('div', {});
  body.append(h('div', { class: 'row', style: { justifyContent: 'center', marginBottom: '10px' } }, h('div', { class: 'nota', style: { background: notaColor(g.score), width: '70px', height: '70px', fontSize: '26px' } }, g.score.toFixed(1).replace('.', ',')), h('div', {}, h('div', { class: 'b' }, 'Média dos críticos'), h('div', { class: 'small muted' }, g.score >= 8 ? 'Sucesso de crítica!' : g.score >= 6 ? 'Recepção positiva.' : g.score >= 4 ? 'Recepção morna.' : 'A crítica não perdoou.'))));
  g.reviews.forEach((r, i) => body.append(h('div', { class: 'review', style: { animationDelay: i * 0.25 + 's' } }, h('div', { class: 'nota', style: { background: notaColor(r.nota) } }, String(r.nota).replace('.5', ',5')), h('div', {}, h('div', { class: 'b' }, `“${r.frase}”`), h('div', { class: 'small muted' }, r.nome)))));
  if (g.parts.bugPen > 1) body.append(h('div', { class: 'warn' }, 'Vários críticos reclamaram dos bugs.'));
  if (g.levelUps?.length) body.append(h('div', { class: 'good', style: { marginTop: '6px' } }, `Subiram de nível: ${g.levelUps.join(', ')}!`));
  const m = modal({ title: `Críticas para ${g.name}`, color: '#2f3b52', body, actions: [{ label: 'Ver relatório', fn: () => { m.close(); openReport(g); } }, { label: 'Fechar', cls: 'ok', fn: () => { m.close(); G.tut(5); } }] });
  if (g.score >= 7) sfx.good(); else if (g.score < 4) sfx.bad();
}

// =====================================================================
// RELATÓRIO DO JOGO
// =====================================================================
export function openReport(g) {
  const st = s();
  const net = g.net - g.costTotal;
  const body = h('div', { class: 'col' },
    h('div', { class: 'row' }, h('div', { class: 'nota', style: { background: notaColor(g.score) } }, g.score.toFixed(1).replace('.', ',')),
      h('div', {}, h('div', { class: 'b' }, `${themeName(g.theme)} / ${genreName(g.genre)}${g.sub ? ' + ' + genreName(g.sub) : ''}`), h('div', { class: 'small muted' }, `${platName(g.platform)} · ${D.SIZES[g.size].nome} · público ${audName(g.audience)} · lançado em ${dateStr(g.releaseWeek)}`))),
    h('div', {}, h('div', { class: 'small b' }, 'Vendas por semana' + (g.active ? ' (em andamento)' : '')), h('div', { html: barChart(g.hist.length ? g.hist : [0], { w: 320, hgt: 110, color: '#2fc4e6' }) })),
    h('div', {},
      h('div', { class: 'kv' }, h('span', {}, 'Unidades vendidas'), h('b', {}, num(g.sold))),
      h('div', { class: 'kv' }, h('span', {}, 'Preço'), h('b', {}, money(g.price))),
      h('div', { class: 'kv' }, h('span', {}, 'Receita bruta'), h('b', {}, money(g.gross))),
      h('div', { class: 'kv' }, h('span', {}, 'Líquido (após taxas e impostos)'), h('b', {}, money(g.net))),
      h('div', { class: 'kv' }, h('span', {}, 'Custo de desenvolvimento'), h('b', { class: 'neg' }, money(g.costTotal))),
      h('div', { class: 'kv' }, h('span', {}, 'Resultado'), h('b', { class: net >= 0 ? 'pos' : 'neg' }, money(net))),
      h('div', { class: 'kv' }, h('span', {}, 'Fãs conquistados'), h('b', {}, num(g.fansGained))),
      h('div', { class: 'kv' }, h('span', {}, 'Design / Tec / Bugs / Hype'), h('b', {}, `${g.d} / ${g.t} / ${g.bugs} / ${Math.round(g.hype)}`))),
    h('div', {}, h('div', { class: 'small b' }, 'Diagnóstico'), ...diagnose(g).map((t) => h('div', { class: 'small' }, '• ' + t))));
  const m = modal({ title: `Relatório: ${g.name}`, color: '#2f3b52', body, actions: [{ label: 'Críticas', fn: () => { m.close(); openCritics(g); } }, { label: 'Fechar', cls: 'ok', fn: () => m.close() }] });
}
function diagnose(g) {
  const p = g.parts, out = [];
  out.push(p.fit < 0.6 ? `Foco mal distribuído (adequação ${Math.round(p.fit * 100)}%). Releia as dicas do gênero.` : p.fit > 0.85 ? 'Foco muito bem distribuído.' : `Foco razoável (${Math.round(p.fit * 100)}%).`);
  out.push(p.comp < 0.5 ? 'Combinação tema/gênero/público fraca — olhe o guia de compatibilidade.' : p.comp > 0.8 ? 'Combinação tema/gênero excelente!' : 'Compatibilidade mediana.');
  if (p.techFactor < 0.4) out.push('A tecnologia está defasada para a época: pesquise motor e gráficos.');
  if (p.dr < 0.8) out.push('Faltou Design: contrate mais designers.'); if (p.tr < 0.8) out.push('Faltou Tecnologia: contrate programadores.');
  if (p.artFactor < 0.6) out.push('Arte fraca: um artista no time ajuda.');
  if (p.bugPen > 0.8) out.push('Bugs demais: contrate testadores ou faça mutirão.');
  if (p.repeatPen > 0) out.push('Jogo repetitivo (mesmo tema/gênero do anterior). Varie!');
  return out;
}

// =====================================================================
// EQUIPE
// =====================================================================
function openFeedback(e, done) {
  const st = s(); const body = h('div', {}, h('div', { class: 'small muted' }, `Como dar feedback para ${e.name}? Uma conversa por semana.`),
    ...Object.entries(TM.FEEDBACK).map(([k, f]) => h('button', { class: 'pick', onclick: () => { const r = TM.feedback(st, e.id, k); if (r.err) act(r.err); else { toast(r.msg, 'bom'); G.refresh(); } fm.close(); done(); } }, h('span', {}, f.nome), h('span', { class: 'v small' }, `${f.h}h · ${f.desc}`))));
  const fm = modal({ title: 'Feedback', color: '#3da35d', size: 'mid', body, actions: [{ label: 'Cancelar', fn: () => fm.close() }] });
}
function openCulture(done) {
  const st = s(); const T = TM.ensureTeam(st); const body = h('div', {}, h('div', { class: 'small muted' }, `Mudar a cultura custa ${money(Math.round(TM.CULTURE_COST * M.infl(st)))} e 3h de workshop; só pode ser trocada a cada 24 semanas.`),
    ...Object.entries(TM.CULTURES).map(([k, c]) => h('button', { class: 'pick' + (T.culture === k ? ' set' : ''), onclick: () => { const e = TM.setCulture(st, k); if (e) act(e); else { toast(`Cultura: ${c.nome}`, 'bom'); G.refresh(); cm.close(); done(); } } }, h('span', {}, `${c.ico} ${c.nome}`), h('span', { class: 'v small' }, c.desc))));
  const cm = modal({ title: 'Cultura do estúdio', color: '#3da35d', size: 'mid', body, actions: [{ label: 'Fechar', fn: () => cm.close() }] });
}
export function openTeam(tab = 'time') {
  const st = s(); const body = h('div', {});
  const m = modal({ title: 'Equipe', color: '#3da35d', size: 'mid', body, actions: [{ label: 'Fechar', fn: () => m.close() }] });
  const render = () => {
    const off = M.officeOf(st);
    const tabs = h('div', { class: 'tabs' }, [['time', `Meu time (${st.employees.length}/${off.vagas})`], ['contratar', 'Contratar']].map(([id, l]) => h('button', { class: tab === id ? 'on' : '', onclick: () => { tab = id; render(); } }, l)));
    const list = h('div', {});
    if (tab === 'time') {
      const sm = TM.summary(st); const T = TM.ensureTeam(st);
      list.append(h('div', { class: 'tm-head' },
        h('div', {}, h('b', {}, `${sm.culture.ico} Cultura: ${sm.culture.nome}`), h('div', { class: 'small muted' }, sm.culture.desc)),
        h('div', { class: 'tm-mood' }, sm.avgMood == null ? h('span', { class: 'small muted' }, 'Sem equipe contratada ainda') : h('span', { class: 'small' }, `Humor médio da equipe: `, h('b', { class: sm.avgMood < 40 ? 'neg' : sm.avgMood > 65 ? 'pos' : '' }, Math.round(sm.avgMood) + '%'))),
        h('button', { class: 'btn sm', onclick: () => openCulture(render) }, '🏛️ Mudar cultura')));
      if (T.conflict) {
        const a = st.employees.find((x) => x.id === T.conflict.a), b = st.employees.find((x) => x.id === T.conflict.b);
        const go = (how, side, kind) => { const r = TM.resolveConflict(st, how, side); if (r.err) act(r.err); else { toast(r.msg, kind); G.refresh(); render(); } };
        if (a && b) list.append(h('div', { class: 'tm-conflict' }, h('b', {}, `⚠️ Conflito: ${a.name} × ${b.name}`), h('div', { class: 'small' }, `Motivo: ${T.conflict.motivo}. Tensão ${T.conflict.heat.toFixed(1)}/8 — há ${st.week - T.conflict.since} semana(s). Em 10 semanas alguém sai.`),
          h('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap', marginTop: '6px' } },
            h('button', { class: 'btn sm ok', onclick: () => go('mediar', null, 'bom') }, 'Mediar (4h)'),
            h('button', { class: 'btn sm', onclick: () => go('apoiar', a.id, 'info') }, `Apoiar ${a.name.split(' ')[0]}`),
            h('button', { class: 'btn sm', onclick: () => go('apoiar', b.id, 'info') }, `Apoiar ${b.name.split(' ')[0]}`),
            h('button', { class: 'btn sm', onclick: () => go('separar', null, 'info') }, 'Separar mesas'))));
      }
      for (const e of st.employees) {
        TM.ensureEmp(e);
        list.append(h('div', { class: 'li' }, ringAvatar(e, 52),
          h('div', { class: 'grow' }, h('div', { class: 'nm' }, e.name, h('span', { class: 'muted small' }, ' · ' + (e.founder ? 'Fundador(a)' : D.ROLES[e.role].nome) + ` · nív. ${e.level}`)),
            h('div', { class: 'skills' }, Object.keys(D.SKILLS).map((k) => h('span', { class: 'sk' + (e.skills[k] >= 7 ? ' hi' : '') }, D.SKILLS[k].slice(0, 3) + ' ' + e.skills[k]))),
            h('div', { class: 'small muted' }, `Salário ${money(e.salary)}/sem · energia ${Math.round(e.energy)}%${e.training ? ' · treinando' : ''}`),
            e.founder ? null : h('div', { class: 'tm-row' }, h('span', { class: 'tm-title' }, TM.titleOf(e)), h('span', { class: 'tm-bar', title: `Humor ${Math.round(e.mood)}%` }, h('i', { style: { width: Math.round(e.mood) + '%', background: e.mood < 35 ? '#e8523c' : e.mood > 65 ? '#3da35d' : '#f5c242' } })), h('span', { class: 'small muted' }, Math.round(e.mood) + '%'),
              ...TM.traitsOf(e).map((t) => h('span', { class: 'tm-trait', title: t.desc }, `${t.ico} ${t.nome}`)))),
          h('div', { class: 'col', style: { gap: '4px' } },
            e.founder ? null : h('button', { class: 'btn sm', title: '2h do fundador: sobe o humor', disabled: !!TM.o11Block(st, e), onclick: () => { const r = TM.oneOnOne(st, e.id); if (r.err) act(r.err); else { toast(r.msg, 'bom'); sfx.coin(); G.refresh(); render(); } } }, '1:1'),
            e.founder ? null : h('button', { class: 'btn sm', onclick: () => openFeedback(e, render) }, 'Feedback'),
            e.founder || TM.promoBlock(st, e) ? null : h('button', { class: 'btn sm ok', onclick: () => { if (!confirm(`Promover ${e.name} para ${TM.RANKS[e.rank + 1].nome}? Bônus ${money(TM.promoCost(st, e))} e salário maior.`)) return; const r = TM.promote(st, e.id); if (r.err) act(r.err); else { toast(r.msg, 'bom'); sfx.level(); G.refresh(); render(); } } }, 'Promover'),
            h('button', { class: 'btn sm', disabled: !M.hasRes(st, 'treino') || !!e.training, onclick: () => openTrain(e, render) }, 'Treinar'),
            e.founder ? null : h('button', { class: 'btn sm red', onclick: () => { if (confirm(`Demitir ${e.name}? Rescisão: ${money(e.salary * 3)}`)) { if (act(M.fire(st, e.id))) render(); } } }, 'Demitir'))));
      }
      if (!M.hasRes(st, 'treino')) list.append(h('div', { class: 'small muted' }, 'Pesquise "Cursos e Treinamento" para treinar a equipe.'));
      const c = M.weeklyCosts(st);
      list.append(h('div', { class: 'kv' }, h('span', {}, 'Folha salarial semanal'), h('b', {}, money(c.salarios))));
    } else {
      list.append(h('div', { class: 'small muted', style: { marginBottom: '8px' } }, `Candidatos do mês (renovam todo mês). Vagas livres: ${off.vagas - st.employees.length}. Taxa de contratação = 2 semanas de salário.`));
      for (const c of st.candidates) {
        list.append(h('div', { class: 'li' }, avatar(c.look, 52),
          h('div', { class: 'grow' }, h('div', { class: 'nm' }, c.name, h('span', { class: 'small', style: { color: D.ROLES[c.role].cor } }, ' · ' + D.ROLES[c.role].nome)),
            h('div', { class: 'skills' }, Object.keys(D.SKILLS).map((k) => h('span', { class: 'sk' + (c.skills[k] >= 7 ? ' hi' : '') }, D.SKILLS[k].slice(0, 3) + ' ' + c.skills[k]))),
            h('div', { class: 'small muted' }, `Salário ${money(c.salary)}/sem · taxa ${money(c.fee)}`),
            h('div', { class: 'tm-row' }, ...TM.traitsOf(c).map((tr) => h('span', { class: 'tm-trait', title: tr.desc }, `${tr.ico} ${tr.nome}`)))),
          h('button', { class: 'btn sm ok', disabled: st.employees.length >= off.vagas || st.money < c.fee, onclick: () => { if (act(M.hire(st, c.id), 'Contratado!')) render(); } }, 'Contratar')));
      }
      if (st.employees.length >= off.vagas) list.append(h('div', { class: 'warn' }, 'Escritório lotado! Mude para um espaço maior em Estúdio ▸ Escritório.'));
    }
    body.replaceChildren(tabs, list);
  };
  render();
}
function openTrain(e, done) {
  const st = s(); const body = h('div', {}); const m = sheet(`Treinar ${e.name.split(' ')[0]}`, body, done);
  body.append(h('div', { class: 'small muted', style: { marginBottom: '8px' } }, 'O curso dura 2 semanas (a pessoa sai do projeto) e dá +1 na habilidade.'));
  for (const k of Object.keys(D.SKILLS)) {
    const c = M.trainCost(st, e, k);
    body.append(h('div', { class: 'li' }, h('div', { class: 'grow' }, h('div', { class: 'nm' }, `${D.SKILLS[k]} (${e.skills[k]})`), h('div', { class: 'small muted' }, money(c))),
      h('button', { class: 'btn sm ok', disabled: st.money < c || e.skills[k] >= 20, onclick: () => { if (act(M.train(st, e.id, k), 'Treinamento iniciado')) m.close(); } }, 'Treinar')));
  }
}

// =====================================================================
// PESQUISA
// =====================================================================
export function openResearch() {
  const st = s(); const body = h('div', {});
  const m = modal({ title: 'Laboratório de Pesquisa', color: '#3558b0', size: 'mid', body, actions: [{ label: 'Fechar', fn: () => m.close() }] });
  const render = () => {
    const rs = st.research; const slots = M.maxResearchSlots(st);
    const head = h('div', { class: 'col' },
      h('div', { class: 'row' }, h('div', { class: 'bub pesq' }, h('div', { class: 'c' }, numShort(rs.rp))), h('div', {}, h('div', { class: 'b' }, 'Pontos de pesquisa'), h('div', { class: 'small muted' }, `Laboratórios em uso: ${rs.active.length}/${slots}. Pontos vêm de fases de desenvolvimento, pesquisadores e do orçamento de P&D.`))),
      M.hasRes(st, 'pd') ? h('div', { class: 'li' }, h('div', { class: 'grow' }, h('div', { class: 'nm' }, 'Orçamento mensal de P&D'), h('div', { class: 'small muted' }, 'Converte dinheiro em pontos de pesquisa todo mês.')),
        h('select', { style: { width: '140px' }, onchange: (e) => { M.setPD(st, +e.target.value); render(); } }, [0, 1000, 3000, 6000, 12000, 25000].map((v) => h('option', { value: v, selected: rs.pd === v }, v ? money(v) + '/mês' : 'Desligado')))) : null);
    const active = rs.active.map((a) => { const r = D.RES_BY_ID[a.id]; return h('div', { class: 'li' }, h('div', { class: 'grow' }, h('div', { class: 'nm' }, r.nome + ' (em pesquisa)'), h('div', { class: 'bar b' }, h('i', { style: { width: ((r.sem - a.left) / r.sem * 100) + '%' } })), h('div', { class: 'small muted' }, `${a.left} semana(s) restantes`))); });
    const groups = {};
    for (const r of D.RESEARCH) (groups[r.ramo] ||= []).push(r);
    const sections = Object.entries(groups).map(([ramo, rs2]) => h('div', {}, h('h3', {}, ramo), ...rs2.map((r) => {
      const done = M.hasRes(st, r.id), act2 = rs.active.some((a) => a.id === r.id);
      const reqOk = r.req.every((x) => M.hasRes(st, x));
      const cost = M.researchCost(st, r); const err = M.canResearch(st, r.id);
      return h('div', { class: 'li' + (done ? '' : reqOk ? '' : ' dim') }, h('div', { class: 'grow' }, h('div', { class: 'nm' }, r.nome, done ? ' ✓' : ''), h('div', { class: 'small muted' }, r.desc),
        done ? null : h('div', { class: 'small' }, `${r.rp} pts · ${money(cost)} · ${r.sem} sem` + (reqOk ? '' : ` · requer: ${r.req.filter((x) => !M.hasRes(st, x)).map((x) => D.RES_BY_ID[x].nome).join(', ')}`))),
        done || act2 ? h('span', { class: 'chip', style: { background: done ? '#3da35d' : '#3558b0' } }, done ? 'Feito' : '...') : h('button', { class: 'btn sm', style: { background: err ? '' : '#3558b0', color: err ? '' : '#fff' }, disabled: !!err, onclick: () => { if (act(M.startResearch(st, r.id), 'Pesquisa iniciada!')) render(); } }, 'Pesquisar'));
    })));
    body.replaceChildren(head, ...active, ...sections);
  };
  render();
}

// =====================================================================
// ESTÚDIO (finanças, escritório, ranking, jogos, conquistas)
// =====================================================================
export function openStudio(tab = 'fin') {
  const st = s(); const body = h('div', {});
  const m = modal({ title: st.studio.nome, color: '#e8523c', size: 'mid', body, actions: [{ label: 'Fechar', fn: () => m.close() }] });
  const render = () => {
    const tabs = h('div', { class: 'tabs' }, [['fin', 'Finanças'], ['off', 'Escritório'], ['rank', 'Ranking'], ['jogos', 'Jogos'], ['conq', 'Conquistas']].map(([id, l]) => h('button', { class: tab === id ? 'on' : '', onclick: () => { tab = id; render(); } }, l)));
    const c = h('div', {});
    if (tab === 'fin') {
      const wc = M.weeklyCosts(st); const hist = st.history.slice(-12);
      const inc = hist.map((x) => x.income), exp = hist.map((x) => Object.values(x.exp).reduce((a, b) => a + b, 0));
      const cur = st.ledger;
      c.append(h('div', { class: 'kv' }, h('span', {}, 'Caixa'), h('b', { class: st.money < 0 ? 'neg' : 'pos' }, money(st.money))),
        h('div', { class: 'kv' }, h('span', {}, st.mode === 'indie' ? 'Custo fixo semanal (vida + escritório + equipe)' : 'Custo fixo semanal (aluguel + salários + manutenção)'), h('b', {}, money(wc.aluguel + wc.salarios + (wc.manut || 0) + (wc.encargos || 0)))),
        wc.manut ? h('div', { class: 'kv' }, h('span', {}, '↳ inclui manutenção de móveis'), h('b', {}, money(wc.manut))) : null,
        h('div', { class: 'kv' }, h('span', {}, 'Fôlego sem vendas'), h('b', {}, `${Math.max(0, Math.floor(st.money / Math.max(1, wc.aluguel + wc.salarios + (wc.manut || 0))))} semanas`)),
        st.debtWeeks > 0 ? h('div', { class: 'warn' }, `Conta no vermelho há ${st.debtWeeks} semana(s). Em ${M.DEBT_GRACE - st.debtWeeks} semana(s) o banco executa a dívida!`) : null,
        h('h3', {}, 'Últimos meses: receita (verde) × despesas (vermelho)'), h('div', { html: hist.length ? pairChart(inc, exp) : '<div class="muted small">Ainda sem histórico mensal.</div>' }),
        h('h3', {}, `Mês atual (${dateOf(st.week).m}/${dateOf(st.week).y})`),
        h('div', { class: 'kv' }, h('span', {}, 'Receita bruta'), h('b', { class: 'pos' }, money(cur.income))),
        ...Object.entries(cur.exp).sort((a, b) => b[1] - a[1]).map(([k, v]) => h('div', { class: 'kv' }, h('span', {}, k[0].toUpperCase() + k.slice(1)), h('b', { class: 'neg' }, '-' + money(v)))),
        h('div', { class: 'small muted', style: { marginTop: '8px' } }, `Vendas pagam taxa da plataforma, ${Math.round(M.TAX * 100)}% de impostos sobre a receita e ${Math.round(M.IR * 100)}% de imposto de renda sobre o lucro do ano (cobrado no fim do ano).`));
    } else if (tab === 'off') {
      c.append(h('div', { class: 'row' }, h('button', { class: 'btn ok', onclick: () => { m.close(); window.__G?.openBuild?.(); } }, '🔨 Construir / decorar'), h('button', { class: 'btn', onclick: () => { m.close(); openCity(); } }, '🗺️ Mapa da cidade')));
      D.OFFICES.forEach((o) => {
        const cur = o.id === st.office, next = o.id === st.office + 1;
        c.append(h('div', { class: 'li' + (o.id > st.office + 1 ? ' dim' : '') }, h('div', { class: 'grow' }, h('div', { class: 'nm' }, o.nome, cur ? ' (atual)' : ''), h('div', { class: 'small muted' }, o.desc), h('div', { class: 'small' }, `${o.vagas} vagas · aluguel ${money(o.aluguel)}/sem · mudança ${o.mudanca ? money(Math.round(o.mudanca * M.infl(st) / 1000) * 1000) : '—'}`)),
          next ? h('button', { class: 'btn sm ok', disabled: st.money < M.upgradeCost(st), onclick: () => { if (confirm(`Mudar para ${o.nome} por ${money(M.upgradeCost(st))}?`)) { if (act(M.upgradeOffice(st), 'Nova sede!')) { sfx.level(); render(); } } } }, 'Mudar') : null));
      });
    } else if (tab === 'rank') {
      const rk = M.ranking(st); const mx = Math.max(1, ...rk.map((r) => r.prestige));
      rk.forEach((r, i) => c.append(h('div', { class: 'li', style: r.player ? { background: '#fff3d1', borderColor: '#f0a030' } : null }, h('div', { class: 'chip', style: { background: r.cor } }, (i + 1) + 'º'), h('div', { class: 'grow' }, h('div', { class: 'nm' }, r.nome), h('div', { class: 'bar o' }, h('i', { style: { width: (r.prestige / mx * 100) + '%', background: r.cor } }))), h('b', {}, Math.round(r.prestige)))));
      c.append(h('h3', {}, `${D.AWARD_NAME}s do seu estúdio`), st.awards.length ? st.awards.map((a) => h('div', { class: 'kv' }, h('span', {}, `Ano ${a.y} · ${a.nome}`), h('b', {}, a.jogo || ''))) : h('div', { class: 'muted small' }, 'Nenhum ainda. A premiação acontece no fim de cada ano.'));
      c.append(h('h3', {}, 'Últimos lançamentos dos rivais'), ...st.rivals.flatMap((r) => r.games.slice(-1).map((g) => h('div', { class: 'kv small' }, h('span', {}, `${r.nome}: ${g.name}`), h('b', {}, g.score.toFixed(1).replace('.', ','))))));
    } else if (tab === 'jogos') {
      if (!st.games.length) c.append(h('div', { class: 'muted' }, 'Nenhum jogo lançado ainda.'));
      [...st.games].reverse().forEach((g) => c.append(h('button', { class: 'li', style: { width: '100%', textAlign: 'left' }, onclick: () => openReport(g) }, h('div', { class: 'nota', style: { background: notaColor(g.score), width: '44px', height: '44px', fontSize: '17px' } }, g.score.toFixed(1).replace('.', ',')),
        h('div', { class: 'grow' }, h('div', { class: 'nm' }, g.name), h('div', { class: 'small muted' }, `${themeName(g.theme)}/${genreName(g.genre)} · ${platName(g.platform)} · ${dateStr(g.releaseWeek)}`)), h('div', { class: 'small', style: { textAlign: 'right' } }, h('b', {}, numShort(g.sold)), h('div', { class: 'muted' }, g.active ? 'à venda' : 'encerrado')))));
    } else {
      const g = h('div', { class: 'grid2' });
      D.ACHIEVEMENTS.forEach((a) => { const got = st.achievements[a.id] != null; g.append(h('div', { class: 'li' + (got ? '' : ' dim'), style: { marginBottom: 0 } }, h('div', { class: 'chip', style: { background: got ? '#8a5cc2' : '#aaa' } }, got ? '★' : '?'), h('div', { class: 'grow' }, h('div', { class: 'nm small' }, a.nome), h('div', { class: 'small muted' }, a.desc)))); });
      c.append(h('div', { class: 'small muted', style: { marginBottom: '6px' } }, `${Object.keys(st.achievements).length}/${D.ACHIEVEMENTS.length} conquistas`), g);
    }
    body.replaceChildren(tabs, c);
  };
  render();
}

// =====================================================================
// GUIA DE COMPATIBILIDADE
// =====================================================================
export function openCompatGuide(c) {
  const st = s(); const un = new Set(M.unlockedThemes(st));
  const wrap = h('div', { class: 'cwrap' }); const tbl = h('table', { class: 'compat' });
  const q = h('input', { type: 'text', placeholder: 'Buscar tema…', oninput: () => fill() });
  const fill = () => {
    const f = q.value.trim().toLowerCase();
    tbl.replaceChildren(h('thead', {}, h('tr', {}, h('th', {}, 'Tema'), D.GENRES.map((g) => h('th', {}, g.nome.slice(0, 4))), ['J', 'T', 'A'].map((a) => h('th', { style: { background: D.AUDIENCES.find((x) => x.id === a).cor } }, a)))),
      h('tbody', {}, D.THEMES.filter((t) => !f || t.nome.toLowerCase().includes(f)).map((t) => h('tr', { class: un.has(t.id) ? '' : 'lk' }, h('td', {}, t.nome + (un.has(t.id) ? '' : ' (bloq.)')), [...t.gen, ...t.aud].map((r) => h('td', { class: 'r', style: { background: D.RATING_COLOR[r] } }, D.RATING_TXT[r]))))));
  };
  fill(); wrap.append(tbl);
  const m = modal({ title: 'Guia de Compatibilidade', color: '#2f3b52', size: 'wide', body: h('div', { class: 'col' }, h('div', { class: 'small muted' }, '+++ ótimo · ++ bom · + ok · − fraco · −− ruim · −−− péssimo. Colunas: gêneros e público (J = Jovem, T = Todos, A = Adulto).'), q, wrap), actions: [{ label: 'Fechar', fn: () => m.close() }] });
}

// =====================================================================
// PREMIAÇÃO / FIM DE ANO
// =====================================================================
export function openYear(ev) {
  const body = h('div', {});
  body.append(h('div', { class: 'small muted', style: { marginBottom: '8px' } }, `${D.AWARD_NAME}s do Ano ${ev.y}`));
  for (const w of ev.wins) body.append(h('div', { class: 'li', style: w.player ? { background: '#fff3d1', borderColor: '#f0a030' } : null }, h('div', { class: 'chip', style: { background: w.player ? '#f0a030' : '#2f3b52' } }, '★'), h('div', { class: 'grow' }, h('div', { class: 'nm' }, w.nome), h('div', { class: 'small' }, `${w.vencedor}${w.jogo ? ' — “' + w.jogo + '”' : ''}`), w.player ? h('div', { class: 'small b', style: { color: '#b7710f' } }, 'É o seu estúdio! Prêmio em dinheiro e novos fãs.') : null)));
  body.append(h('div', { class: 'kv' }, h('span', {}, 'Sua posição no ranking'), h('b', {}, ev.rank + 'º')), ev.ir > 0 ? h('div', { class: 'kv' }, h('span', {}, 'Imposto de renda pago'), h('b', { class: 'neg' }, '-' + money(ev.ir))) : null);
  const m = modal({ title: `Fim do Ano ${ev.y}`, color: '#8a5cc2', body, actions: [{ label: 'Seguir em frente', cls: 'ok', fn: () => m.close() }] });
  if (ev.wins.some((w) => w.player)) sfx.level();
}

// =====================================================================
// FALÊNCIA
// =====================================================================
export function openGameOver(over) {
  const st = s();
  const body = h('div', { class: 'col', style: { textAlign: 'center' } },
    h('p', { style: { fontSize: '16px', margin: 0 } }, `O ${st.studio.nome} fechou as portas em ${dateStr(over.week)}. O banco levou até a cadeira giratória.`),
    h('div', { class: 'circ', style: { background: '#2f3b52', margin: '0 auto' } }, h('big', {}, num(over.score)), h('span', {}, 'Pontuação')),
    h('div', {}, h('div', { class: 'kv' }, h('span', {}, 'Jogos lançados'), h('b', {}, st.games.length)), h('div', { class: 'kv' }, h('span', {}, 'Receita total'), h('b', {}, money(st.stats.revenue))), h('div', { class: 'kv' }, h('span', {}, 'Fãs'), h('b', {}, num(st.fans))), h('div', { class: 'kv' }, h('span', {}, 'Prêmios'), h('b', {}, st.awards.length))),
    h('div', { class: 'small muted' }, 'Dica: lance jogos com frequência, cuide da folha salarial e pesquise para não ficar para trás.'));
  const m = modal({ title: 'Falência', color: '#9c1f1f', body, closable: false, actions: [{ label: 'Novo estúdio', cls: 'ok', fn: () => { m.close(); G.newGame(); } }, { label: 'Ver estúdio', fn: () => { m.close(); } }] });
  sfx.bad();
}

// =====================================================================
// MENU, SAVES, CONFIG
// =====================================================================
export function openMenu() {
  const body = h('div', { class: 'col' });
  const m = modal({ title: 'Menu', color: '#2f3b52', body, actions: [{ label: 'Fechar', fn: () => m.close() }] });
  const b = (label, fn, cls = '') => h('button', { class: 'btn ' + cls, onclick: () => { sfx.click(); fn(); } }, label);
  body.append(
    b('Salvar / Carregar', () => { m.close(); openSaves(); }),
    b('Exportar / Importar', () => { m.close(); openTransfer(); }),
    b('Configurações', () => { m.close(); openSettings(); }),
    b('Mundo: mercado, fãs…', () => { m.close(); openHub(); }),
    b('Guia de compatibilidade', () => { m.close(); openCompatGuide(); }),
    b('Como jogar', () => { m.close(); openHowTo(); }),
    b('Conquistas e ranking', () => { m.close(); openStudio('conq'); }),
    b('📊 Estatísticas e hall da fama', () => { m.close(); openStats(); }),
    b('🎨 Editar estúdio (logo, avatar)', () => { m.close(); openStudioEditor(); }),
    b('🎯 Dificuldade e cenário', () => { m.close(); openScenario(); }),
    b('Novo estúdio', () => { if (confirm('Começar um novo estúdio? Salve antes se quiser manter o atual.')) { m.close(); G.newGame(); } }, 'red'),
    b('Sobre', () => { m.close(); openAbout(); }));
}
export function openSaves() {
  const st = s(); const body = h('div', {});
  const m = modal({ title: 'Salvar / Carregar', color: '#2f3b52', body, actions: [{ label: 'Fechar', fn: () => m.close() }] });
  const render = () => {
    body.replaceChildren(h('div', { class: 'small muted', style: { marginBottom: '8px' } }, 'O jogo salva automaticamente no Slot 1 a cada mês (se ligado nas configurações).'), ...V.listSlots().map(({ slot, meta }) => h('div', { class: 'li' },
      h('div', { class: 'grow' }, h('div', { class: 'nm' }, `Slot ${slot}`), h('div', { class: 'small muted' }, meta ? `${meta.nome} · ${meta.data} · ${moneyShort(meta.dinheiro)} · ${meta.jogos} jogo(s)${meta.over ? ' · falido' : ''}` : 'vazio')),
      h('div', { class: 'col', style: { gap: '4px' } },
        h('button', { class: 'btn sm ok', disabled: !!st.over, onclick: () => { V.saveSlot(slot, st); toast('Salvo no slot ' + slot, 'bom'); render(); } }, 'Salvar'),
        h('button', { class: 'btn sm', disabled: !meta, onclick: () => { const ls = V.loadSlot(slot); if (ls) { m.close(); G.loadState(ls); toast('Jogo carregado', 'bom'); } else toast('Falha ao carregar', 'ruim'); } }, 'Carregar'),
        meta ? h('button', { class: 'btn sm red', onclick: () => { if (confirm('Apagar este slot?')) { V.deleteSlot(slot); render(); } } }, 'Apagar') : null))));
  };
  render();
}
export function openTransfer() {
  const st = s(); const ta = h('textarea', { placeholder: 'Cole aqui o código GGT1:… para importar', spellcheck: 'false' });
  const body = h('div', { class: 'col' }, h('div', { class: 'small muted' }, 'Exportar gera um código de texto com o seu jogo. Guarde onde quiser e cole aqui para importar em outro aparelho.'), ta,
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn sm', onclick: () => { ta.value = V.exportString(st); ta.select(); try { navigator.clipboard?.writeText(ta.value); toast('Código copiado!', 'bom'); } catch { toast('Código gerado: copie manualmente'); } } }, 'Exportar (copiar)'),
      h('button', { class: 'btn sm', onclick: () => { const blob = new Blob([V.exportString(st)], { type: 'text/plain' }); const a = h('a', { href: URL.createObjectURL(blob), download: `garagem-games-${st.studio.nome.replace(/\W+/g, '-')}.txt` }); document.body.append(a); a.click(); a.remove(); } }, 'Baixar arquivo'),
      h('label', { class: 'btn sm' }, 'Abrir arquivo…', h('input', { type: 'file', accept: '.txt,text/plain', style: { display: 'none' }, onchange: async (e) => { const f = e.target.files[0]; if (f) ta.value = await f.text(); } })),
      h('button', { class: 'btn sm ok', onclick: () => { try { const ns = V.importString(ta.value); m.close(); G.loadState(ns); toast('Importado com sucesso!', 'bom'); } catch (err) { toast(err.message, 'ruim'); sfx.bad(); } } }, 'Importar')));
  const m = modal({ title: 'Exportar / Importar', color: '#2f3b52', body, actions: [{ label: 'Fechar', fn: () => m.close() }] });
}
export function openSettings() {
  const cfg = G.settings; const body = h('div', { class: 'col' });
  const m = modal({ title: 'Configurações', color: '#2f3b52', body, actions: [{ label: 'Fechar', fn: () => m.close() }] });
  const save = () => { V.saveSettings(cfg); applyAudioSettings(cfg); G.applyVisual?.(); };
  const render = () => {
    const row = (label, key, fn) => h('div', { class: 'li' }, h('div', { class: 'grow nm' }, label), h('button', { class: 'btn sm ' + (cfg[key] ? 'ok' : ''), 'aria-pressed': cfg[key] ? 'true' : 'false', onclick: () => { cfg[key] = !cfg[key]; save(); fn && fn(); render(); } }, cfg[key] ? 'Ligado' : 'Desligado'));
    const slider = (label, key) => h('div', { class: 'li' }, h('div', { class: 'grow nm' }, label), h('input', { type: 'range', min: 0, max: 100, value: Math.round(cfg[key] * 100), 'aria-label': label, oninput: (e) => { cfg[key] = e.target.value / 100; save(); } }));
    const seg = (label, key, opts) => h('div', { class: 'li' }, h('div', { class: 'grow nm' }, label), h('div', { class: 'seg' }, opts.map(([v, l]) => h('button', { class: cfg[key] === v ? 'on' : '', 'aria-pressed': cfg[key] === v ? 'true' : 'false', onclick: () => { cfg[key] = v; save(); render(); } }, l))));
    body.replaceChildren(h('h3', {}, 'Som'), row('Efeitos sonoros (WebAudio)', 'som', () => setSound(cfg.som)), row('Música procedural', 'musica'), slider('Volume dos efeitos', 'volSfx'), slider('Volume da música', 'volMus'),
      h('h3', {}, 'Aparência e acessibilidade'),
      seg('Tema', 'tema', [['auto', 'Auto'], ['claro', 'Claro'], ['escuro', 'Escuro']]),
      seg('Tamanho da fonte', 'fonte', [[0.9, 'A−'], [1, 'A'], [1.15, 'A+'], [1.3, 'A++']]),
      row('Alto contraste', 'contraste'), row('Animações e movimento', 'movimento'),
      seg('Desempenho gráfico', 'perf', [['auto', 'Auto'], ['alto', 'Alto'], ['baixo', 'Econômico']]),
      h('h3', {}, 'Jogo'), row('Salvamento automático (Slot 1)', 'autosave'), row('Dicas do tutorial', 'dicas'),
      h('button', { class: 'btn', onclick: () => { s().flags.tutStep = 0; s().flags.tutorial = false; cfg.dicas = true; V.saveSettings(cfg); m.close(); G.tut(0); } }, 'Rever o tutorial'));
  };
  render();
}
export function openHowTo() {
  const body = h('div', { class: 'col' },
    h('p', {}, h('b', {}, 'Objetivo: '), 'tirar o estúdio da garagem, lançar bons jogos, ganhar fãs, crescer — e não falir!'),
    h('p', {}, h('b', {}, '1. Novo Jogo: '), 'escolha tema + gênero que combinem (veja o guia), plataforma da época, tamanho e público.'),
    h('p', {}, h('b', {}, '2. Três fases: '), 'em cada fase, distribua o foco nos sliders. Cada gênero gosta de uma mistura. Recursos adicionais custam dinheiro e dão qualidade.'),
    h('p', {}, h('b', {}, '3. Pontos e bugs: '), 'sua equipe gera Design (amarelo) e Tecnologia (ciano) por semana. Bugs (laranja) derrubam a nota; testadores ajudam.'),
    h('p', {}, h('b', {}, '4. Lançar: '), 'quatro críticos dão notas de 1 a 10. Boas notas, hype e fãs viram vendas ao longo de semanas.'),
    h('p', {}, h('b', {}, '5. Crescer: '), 'pesquise (motores, gráficos, gêneros, temas), contrate, treine e mude de escritório. Cada semana custa aluguel + salários.'),
    h('p', {}, h('b', {}, 'Modo Indie: '), 'dev solo em casa, R$ 9 mil, sem salário. Mundo → Vida (moradia, emprego, PC, ferramentas, freelas, descanso), Aprender (cursos), Publicar (playtest, vertical slice, página Stean, demo, crowdfunding, lojas, patches, DLC) e Carreira (solo → dupla → estúdio). Postar, estudar e fazer freela gastam as 40 horas da semana.'),
    h('p', {}, h('b', {}, 'Controles: '), 'botões ⏸ 1x 2x 4x controlam o tempo; atalhos no teclado: espaço (pausa), 1/2/3 (velocidade), N (novo jogo), E (equipe), P (pesquisa), M (menu).'),
    h('p', {}, h('b', {}, 'Falência: '), 'caixa negativo por 6 semanas = fim de jogo, com pontuação final.'));
  const m = modal({ title: 'Como jogar', color: '#2f3b52', body, actions: [{ label: 'Entendi', cls: 'ok', fn: () => m.close() }] });
}
export function openAbout() {
  const body = h('div', { class: 'col' }, h('p', {}, h('b', {}, 'Garagem Games Tycoon'), ` v${GAME_VERSION} — um jogo de gestão de estúdio feito com HTML, CSS e JavaScript puros.`),
    h('p', {}, 'Tudo aqui é original: nomes, plataformas, empresas e textos são fictícios. Qualquer semelhança com a vida real é pura coincidência (e saudade de garagem).'),
    h('p', { class: 'muted small' }, 'Arte desenhada em canvas/SVG. Sons gerados por WebAudio. Livre para todos os públicos.'));
  const m = modal({ title: 'Sobre', color: '#2f3b52', body, actions: [{ label: 'Fechar', fn: () => m.close() }] });
}

// =====================================================================
// CRIAR ESTÚDIO
// =====================================================================
export function openNewStudio(onStart) {
  const look = { hair: D.HAIRS[0], skin: D.SKINS[0], shirt: D.SHIRTS[1], style: 0 };
  const f = { studio: 'Garagem Games', founder: 'Alex', spec: 'equilibrado', mode: 'indie' };
  const body = h('div', { class: 'col' });
  const m = modal({ title: 'Crie seu estúdio', color: '#3da35d', body, closable: false });
  const sw = (list, key) => h('div', { class: 'sw' }, list.map((c) => h('button', { class: look[key] === c ? 'on' : '', style: { background: c }, 'aria-label': 'cor', onclick: () => { look[key] = c; render(); } })));
  const render = () => {
    body.replaceChildren(
      h('div', { class: 'row' }, h('div', { html: avatarSVG(look, 96), style: { borderRadius: '50%', overflow: 'hidden', width: '96px', height: '96px', flex: 'none' } }),
        h('div', { class: 'col', style: { flex: 1 } }, h('div', {}, h('div', { class: 'small b' }, 'Nome do estúdio'), h('input', { type: 'text', value: f.studio, maxlength: 24, oninput: (e) => { f.studio = e.target.value; } })),
          h('div', {}, h('div', { class: 'small b' }, 'Seu nome (fundador/a)'), h('input', { type: 'text', value: f.founder, maxlength: 18, oninput: (e) => { f.founder = e.target.value; } })))),
      h('div', {}, h('div', { class: 'small b' }, 'Cabelo'), sw(D.HAIRS, 'hair')), h('div', {}, h('div', { class: 'small b' }, 'Pele'), sw(D.SKINS, 'skin')), h('div', {}, h('div', { class: 'small b' }, 'Camiseta'), sw(D.SHIRTS, 'shirt')),
      h('div', {}, h('div', { class: 'small b' }, 'Penteado'), h('div', { class: 'seg' }, ['Curto', 'Longo', 'Coque'].map((n, i) => h('button', { class: look.style === i ? 'on' : '', onclick: () => { look.style = i; render(); } }, n)))),
      h('div', {}, h('div', { class: 'small b' }, 'Especialidade'), h('div', { class: 'col' }, Object.entries(M.SPECS).map(([id, sp]) => h('button', { class: 'pick' + (f.spec === id ? ' set' : ''), style: f.spec === id ? { borderColor: '#2f3b52' } : null, onclick: () => { f.spec = id; render(); } }, h('span', {}, sp.nome), h('span', { class: 'v small' }, sp.desc))))),
      h('div', {}, h('div', { class: 'small b' }, 'Modo de jogo'), h('div', { class: 'col' }, [['indie', 'Indie de verdade (recomendado)', 'Dev solo em casa, R$ 9.000 de poupança, PC velho, sem salário. Cursos, redes, Stean, burnout.'], ['classic', 'Tycoon clássico', 'Garagem com R$ 70.000, salário do fundador e foco em equipe.']].map(([id, n, d]) => h('button', { class: 'pick' + (f.mode === id ? ' set' : ''), style: f.mode === id ? { borderColor: '#2f3b52' } : null, onclick: () => { f.mode = id; render(); } }, h('span', {}, n), h('span', { class: 'small muted' }, d))))),
      ...newStudioExtras(f, look, render),
      h('div', { class: 'small muted' }, f.mode === 'indie' ? 'Você começa em casa, sozinho(a), com R$ 9.000 na poupança e um PC de 8 anos. Quase ninguém vive de gamedev no começo: boa sorte!' : 'Você começa na garagem, com R$ 70.000 e um PC bege. Boa sorte!'));
    m.setActions([{ label: 'Começar!', cls: 'ok', fn: () => { sfx.good(); m.close(); onStart({ studio: f.studio.trim() || 'Garagem Games', founder: f.founder.trim() || 'Fundador(a)', spec: f.spec, mode: f.mode, look: { ...look }, diff: f.diff, scenario: f.scenario, brand: { ...f.brand } }); } }]);
  };
  render();
}
