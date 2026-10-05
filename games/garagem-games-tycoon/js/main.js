// Ponto de entrada: HUD, laço de tempo, tutorial, tela inicial e eventos do jogo.
import * as D from './data.js';
import * as M from './sim.js';
import * as V from './save.js';
import { money, moneyShort, dateStr, numShort, dateOf, weatherOf, GAME_VERSION } from './util.js';
import { Office } from './office.js';
import * as MP from './map.js';
import * as BUILD from './ui/build.js';
import * as MD from './modes.js';
import * as MKT from './market.js';
import { sfx, setSound, applyAudioSettings, playMusic, rain } from './audio.js';
import { $, h, toast, modal, anyModal, modalState, ICONS, sparkline } from './ui/dom.js';
import { G } from './ui/ctrl.js';
import * as UI from './ui/screens.js';
G.UI = UI;

const WEEK_S = 2.4; // segundos por semana em 1x
G.settings = V.loadSettings();
setSound(G.settings.som); applyAudioSettings(G.settings);
G.speed = 0;
/** Tema (claro/escuro/auto), tamanho de fonte, alto contraste, movimento e desempenho (v0.7). */
G.applyVisual = () => {
  const c = G.settings, r = document.documentElement;
  const dark = c.tema === 'escuro' || (c.tema === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  r.dataset.theme = dark ? 'escuro' : 'claro'; r.dataset.contrast = c.contraste ? 'alto' : 'normal'; r.dataset.motion = c.movimento === false ? 'off' : 'auto';
  r.style.setProperty('--fs', String(c.fonte || 1));
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#14181f' : '#f3eedf');
  const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 2;
  G.perf = c.perf === 'auto' ? (lowEnd ? 'baixo' : 'alto') : c.perf; r.dataset.perf = G.perf;
  G.office?.setPerf?.(G.perf); G.cityMap?.setPerf?.(G.perf);
};
G.applyVisual();
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => G.applyVisual());

const TUT_INDIE = [
  'Você é um(a) dev solo em casa, com R$ 9 mil de poupança e um PC de 8 anos. Quase ninguém vive de jogos no começo: comece com um jogo MICRO (como numa game jam) e aprenda fazendo. Toque em “Novo Jogo”.',
  'Escolha tema e gênero que combinem. Em casa não há licença nem aluguel de escritório — mas a vida custa por semana (Mundo → Vida). Se o caixa apertar, pegue um freela ou um emprego de meio período.',
  'Divida o esforço com os sliders. Posts, cursos e freelas gastam horas da semana (máx. 40h) — tempo fora do código. Cuide da saúde mental para evitar o burnout.',
  'Deixe o tempo correr. Em Mundo → Publicar você faz playtests, corta escopo, monta a página da Stean e a demo — wishlists antes do lançamento são o que mais pesa nas vendas.',
  'Jogo pronto! Escolha as lojas (inch.io grátis; Stean cobra R$ 550 e 30%), o preço e se aceita um publisher. A maioria dos jogos indie vende pouco no começo — é normal.',
  'Cada jogo ensina e traz fãs. Estude (Mundo → Aprender), melhore o PC, convide um sócio e cresça aos poucos: solo → dupla → estúdio.',
];
const TUT = [
  'Bem-vindo(a) à garagem! Você tem R$ 70 mil, um PC bege e muita coragem. Toque em “Novo Jogo” para começar. Os botões II / 1x / 2x / 4x controlam o tempo.',
  'Escolha um tema e um gênero que combinem: os sinais + e − mostram a compatibilidade. A plataforma cobra uma licença por jogo.',
  'Divida o esforço com os sliders. Cada gênero gosta de uma mistura diferente — a dica do consultor ajuda. Toque num funcionário para tirá-lo do projeto.',
  'Agora é só deixar o tempo correr. Design (amarelo) e Tecnologia (ciano) sobem toda semana; eventos podem aparecer. Fique de olho nos bugs!',
  'Jogo pronto! Se houver muitos bugs, faça um mutirão de testes. Uma campanha de marketing aumenta o hype. Depois, lance!',
  'Vendas e críticas viram dinheiro e fãs. Use o caixa para pesquisar, contratar e crescer — mas cuidado: aluguel e salários saem toda semana!',
];
G.tut = (n) => {
  const s = G.s; if (!s || !G.settings.dicas || s.flags.tutorial) return;
  if ((s.flags.tutStep ?? -1) >= n) return;
  s.flags.tutStep = n;
  const el = $('#tutorial');
  el.hidden = false;
  clearTimeout(G._tutT); G._tutT = setTimeout(() => { if (s.flags.tutStep === n && n < TUT.length - 1) el.hidden = true; }, 16000);
  const TT = s.mode === 'indie' ? TUT_INDIE : TUT;
  el.replaceChildren(h('div', {}, h('b', {}, `Dica ${n + 1}/${TT.length}: `), TT[n]), h('div', { class: 'tb' },
    h('button', { class: 'btn sm', onclick: () => { el.hidden = true; G.settings.dicas = false; V.saveSettings(G.settings); } }, 'Pular tudo'),
    h('button', { class: 'btn sm pri', onclick: () => { el.hidden = true; if (n === TUT.length - 1) { s.flags.tutorial = true; } } }, 'Entendi')));
};

// ---------------------------------------------------------------- HUD
function projPhaseLabel(p) {
  if (p.stage === 'result') return 'Pronto para lançar!';
  if (p.stage === 'config') return `Fase ${p.phase}: planejamento`;
  const cats = D.catsOfPhase(p.phase);
  const best = cats.slice().sort((a, b) => (p.focus[b.id] ?? 0) - (p.focus[a.id] ?? 0))[0];
  return `Fase ${p.phase}: ${best.nome}`;
}
function hudChips(s) {
  const out = [];
  const sc = MD.scnOf(s);
  if (sc?.goal) { const pr = Math.round(MD.goalProgress(s) * 100); out.push(h('button', { class: 'mini-chip', title: 'Cenário: ' + sc.nome + ' — ' + MD.goalText(s), 'aria-label': 'Cenário ' + sc.nome, onclick: () => UI.openScenario() }, s.scn.done != null ? '✅' : sc.ico, ' ', pr + '%')); }
  const act = MKT.active(s);
  if (act.length) out.push(h('button', { class: 'mini-chip mk', title: act.map((a) => a.def.nome).join(' + '), 'aria-label': 'Mercado: ' + act.map((a) => a.def.nome).join(', '), onclick: () => UI.openMedia('eco') }, act.map((a) => a.def.ico).join('')));
  return out.length ? h('div', { class: 'chips' }, out) : null;
}
/** Escolhe a trilha pela situação: título, escritório, noite/chuva ou tensão (caixa negativo). */
function updateMusic() {
  if (!G.s || $('.title')) { playMusic('title'); rain(false); return; }
  const wx = weatherOf(G.s.week);
  playMusic(G.s.money < 0 || G.s.debtWeeks > 0 ? 'tense' : wx === 'chuva' ? 'night' : 'office');
  rain(wx === 'chuva' && G.settings.som);
}
G.updateMusic = updateMusic;
document.addEventListener('pointerdown', () => updateMusic(), { once: true });
function renderHUD() {
  const s = G.s; if (!s) return;
  const p = s.project; const d = dateOf(s.week);
  const pc = $('#proj-card');
  if (p) {
    const pr = Math.round(M.projectProgress(p) * 100);
    pc.replaceChildren(h('div', { class: 'pn' }, p.name), h('div', { class: 'pg' }, `${D.THEME_BY_ID[p.theme].nome} / ${D.GENRES.find((g) => g.id === p.genre).nome}${p.sub ? ' + ' + D.GENRES.find((g) => g.id === p.sub).nome : ''}`),
      h('div', { class: 'pbar' }, h('i', { style: { width: pr + '%' } }), h('b', {}, `${projPhaseLabel(p)} · ${pr}%`)));
  } else {
    pc.replaceChildren(h('div', { class: 'pn' }, h('span', { class: 'hud-logo', html: MD.logoSVG(s.studio.brand, 16) }), s.studio.nome), h('div', { class: 'pg' }, `${M.officeOf(s).nome} · ${s.games.length} jogo${s.games.length === 1 ? '' : 's'}`),
      h('div', { class: 'pbar' }, h('i', { style: { width: '0%' } }), h('b', {}, s.over ? 'Estúdio falido' : 'Sem projeto ativo')));
  }
  $('#stat-box').replaceChildren(
    h('div', { class: 'r' }, h('span', { class: 'k' }, 'Fãs'), h('b', {}, numShort(s.fans))),
    h('div', { class: 'r' }, h('span', { class: 'k' }, 'Tempo'), h('b', {}, dateStr(s.week))),
    h('div', { class: 'cash' + (s.money < 0 ? ' neg' : '') }, moneyShort(s.money)),
    hudChips(s));
  const bd = p ? Math.round(p.d) : 0, bt = p ? Math.round(p.t) : 0;
  $('#bubbles').replaceChildren(
    h('div', { class: 'bub bug' }, h('div', { class: 'c' }, p ? Math.round(p.bugs) : 0), h('small', {}, 'Bugs')),
    h('div', { class: 'bub design' }, h('div', { class: 'c' }, numShort(bd)), h('div', { class: 'mini' }, h('i', { style: { width: (p ? Math.min(100, p.d / p.dTarget * 100) : 0) + '%' } })), h('small', {}, 'Design')),
    h('div', { class: 'bub tech' }, h('div', { class: 'c' }, numShort(bt)), h('div', { class: 'mini' }, h('i', { style: { width: (p ? Math.min(100, p.t / p.tTarget * 100) : 0) + '%' } })), h('small', {}, 'Tecnologia')),
    h('div', { class: 'bub pesq tap', onclick: () => UI.openResearch() }, h('div', { class: 'c' }, numShort(s.research.rp)), h('small', {}, 'Pesquisa')));
  // vendas
  const sc = $('#sales-card');
  const g = s.games[s.games.length - 1];
  if (g && (g.active || s.week - g.releaseWeek < 14)) {
    sc.hidden = false;
    sc.onclick = () => UI.openReport(g);
    sc.replaceChildren(h('div', { class: 't' }, g.name), h('div', { html: sparkline(g.hist) }), h('div', { class: 'm' }, `${numShort(g.sold)} un. · ${moneyShort(g.gross)}`), h('div', { class: 'm' }, g.active ? `Nota ${g.score.toFixed(1).replace('.', ',')} · à venda` : 'Fora de catálogo'));
  } else sc.hidden = true;
  renderDock(); updateMusic();
}
function renderDock() {
  const s = G.s; const p = s.project;
  const sp = $('#speed');
  sp.replaceChildren(...[[0, 'II'], [1, '1x'], [2, '2x'], [4, '4x']].map(([v, l]) => h('button', { class: G.speed === v ? 'on' : '', 'aria-label': 'velocidade ' + l, onclick: () => G.setSpeed(v) }, l)));
  let label = 'Novo Jogo', fn = UI.openConcept, alert = false;
  if (s.over) { label = 'Novo estúdio'; fn = () => G.newGame(); }
  else if (p) {
    if (p.stage === 'config') { label = `Configurar Fase ${p.phase}`; fn = UI.openPhase; alert = true; }
    else if (p.stage === 'event') { label = 'Evento! Decidir'; fn = UI.openEvent; alert = true; }
    else if (p.stage === 'result') { label = 'Lançar ' + p.name; fn = UI.openResult; alert = true; }
    else { label = 'Marketing / Info'; fn = UI.openProjectInfo; }
  }
  const canHire = s.candidates.some((c) => s.money >= c.fee) && s.employees.length < M.officeOf(s).vagas && s.employees.length < 3;
  const canRes = D.RESEARCH.some((r) => !M.canResearch(s, r.id));
  const nb = (ico, text, fn2, dot) => h('button', { class: 'nb', onclick: () => { sfx.click(); fn2(); } }, h('span', { html: ico }), h('span', {}, text), dot ? h('i', { class: 'dot' }) : null);
  $('#nav').replaceChildren(
    h('button', { class: 'nb big' + (alert ? ' alert' : ''), onclick: () => { sfx.click(); fn(); } }, label),
    nb(ICONS.team, 'Equipe', () => UI.openTeam(), canHire), nb(ICONS.flask, 'Pesquisa', () => UI.openResearch(), canRes && !s.research.active.length),
    nb(ICONS.build, 'Estúdio', () => UI.openStudio()), nb(ICONS.world, 'Mundo', () => UI.openHub(), s.fan.requests.some((r) => r.status === 'aberto') || s.soc.inbox.some((x) => x.status === 'novo') || !!(s.soc.crisis && s.soc.crisis.pending) || !!(s.ind && (s.ind.burn > 0 || s.ind.mental < 30))), nb(ICONS.more, 'Menu', () => UI.openMenu()));
}
G.checkAch = () => { if (!G.s) return; const e = []; M.checkAchievements(G.s, e); handle(e); };
G.refresh = () => { if (!G.s) return; renderHUD(); G.office.setState(G.s); G.updateFloorCtl?.(); };
G.save = () => { if (G.s && !G.s.over) { try { V.saveSlot(V.AUTOSAVE_SLOT, G.s); } catch (e) { console.warn('autosave falhou', e); } } };
G.setSpeed = (v) => { G.speed = v; renderDock(); sfx.click(); };

// ---------------------------------------------------------------- eventos da simulação
const pending = [];
function queueModal(fn) { if (anyModal()) pending.push(fn); else fn(); }
modalState.onEmpty = () => { const fn = pending.shift(); if (fn) setTimeout(() => { if (!anyModal()) fn(); }, 120); };

function handle(evs) {
  const s = G.s;
  for (const ev of evs) {
    switch (ev.type) {
      case 'gain': {
        const emps = ev.perEmp.slice().sort(() => Math.random() - 0.5).slice(0, 3);
        emps.forEach((e, i) => setTimeout(() => {
          if (e.d >= 1) G.office.pop('design', '+' + Math.round(e.d), e.id);
          if (e.t >= 1) setTimeout(() => G.office.pop('tech', '+' + Math.round(e.t), e.id), 250);
        }, i * 180));
        if (ev.bugs >= 0.8) setTimeout(() => G.office.pop('bug', '+' + Math.round(ev.bugs), emps[0]?.id), 500);
        sfx.type();
        break;
      }
      case 'phase': sfx.event(); toast(`Fase ${ev.phase} do desenvolvimento!`); queueModal(UI.openPhase); break;
      case 'event': queueModal(UI.openEvent); break;
      case 'result': queueModal(UI.openResult); break;
      case 'research': sfx.level(); toast('Pesquisa concluída: ' + D.RES_BY_ID[ev.id].nome, 'bom'); break;
      case 'trained': toast(`${ev.name.split(' ')[0]} terminou o curso (+1 ${D.SKILLS[ev.skill]})`, 'bom'); break;
      case 'achievement': sfx.level(); toast('Conquista: ' + D.ACHIEVEMENTS.find((a) => a.id === ev.id).nome, 'conq'); break;
      case 'year': queueModal(() => UI.openCeremony(ev, () => queueModal(() => UI.openYear(ev)))); break;
      case 'market': sfx.event(); toast(ev.txt + ' — veja Mídia → Economia.'); break;
      case 'scenario': G.speed = 0; sfx[ev.win ? 'launch' : 'bad'](); toast(ev.win ? `🎯 Cenário “${ev.nome}” concluído!` : `⌛ O prazo do cenário “${ev.nome}” acabou. Você pode seguir jogando.`, ev.win ? 'conq' : 'ruim'); break;
      case 'stafflife': sfx.event(); G.speed = 0; queueModal(UI.openStaffLife); break;
      case 'news': toast(ev.txt); sfx.paper?.(); break;
      case 'fairs': toast(`📅 ${ev.nome} este mês — veja o Mercado.`); break;
      case 'jams': toast(`⏱️ ${ev.nome} este mês — dá pra participar!`); break;
      case 'press': toast(`📰 ${ev.outlet}: ${ev.kind === 'preview' ? 'preview publicado' : ev.kind === 'entrevista' ? 'entrevista no ar' : 'matéria sobre o estúdio'} (${numShort(ev.reach)} leitores)`, 'bom'); break;
      case 'lifeevent': sfx.event(); G.speed = 0; queueModal(UI.openLifeEvent); break;
      case 'crisis': sfx.bad(); G.speed = 0; queueModal(UI.openCrisis); break;
      case 'jam': sfx.level(); toast(`Jam: “${ev.nome}” ficou em ${ev.rank}º de ${ev.entries} (+${ev.fans} fãs)`, 'bom'); break;
      case 'debt': (sfx.alarm || sfx.bad)(); toast('Atenção: caixa negativo! Faça dinheiro rápido.', 'ruim'); break;
      case 'saleend': { const g = s.games.find((x) => x.id === ev.id); if (g) toast(`${g.name} saiu de catálogo (${numShort(g.sold)} vendas).`); break; }
      case 'gameover': G.speed = 0; try { V.pushLegacy(UI.legacyEntry(s, 'Falência')); } catch {} queueModal(() => UI.openGameOver(ev)); break;
      case 'month': if (G.settings.autosave) G.save(); break;
    }
  }
}
function doTick() {
  const evs = M.tickWeek(G.s);
  G.office.setState(G.s);
  handle(evs);
  renderHUD();
}

// ---------------------------------------------------------------- laço principal
let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (G.office) {
    G.office.update(dt);
    if (G.s && !document.hidden) {
      if (G.speed > 0 && M.canTick(G.s) && !anyModal() && !$('.title') && G.office.mode !== 'build') {
        acc += dt * G.speed;
        if (acc >= WEEK_S) { acc = 0; doTick(); }
      }
    }
    G.office.draw();
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- início / título
function startGame(opts) {
  const s = M.newState({ studio: opts.studio, founder: opts.founder, spec: opts.spec, look: opts.look, mode: opts.mode || 'classic', diff: opts.diff, scenario: opts.scenario, brand: opts.brand });
  if (opts.brand) s.flags.brand = true;
  s.employees[0].look = opts.look;
  G.s = s; G.speed = 0; acc = 0;
  boot();
  G.tut(0);
}
function boot() {
  $('#hud').hidden = false; $('#dock').hidden = false;
  $('#tutorial').hidden = true; $('#cam-ctl').hidden = false; $('#minimap').hidden = false;
  BUILD.closeBuild();
  G.office.setState(G.s);
  G.office.resize();
  renderHUD();
  window.__G = G;
}
G.loadState = (st) => { G.s = st; G.speed = 0; acc = 0; $('.title')?.remove(); boot(); };
G.newGame = () => { closeAll(); showTitle(true); };
function closeAll() { [...modalState.stack].forEach((m) => m.close()); pending.length = 0; }

function showTitle(startNew = false) {
  $('.title')?.remove();
  const slots = V.listSlots(); const has = slots.some((x) => x.meta);
  const garage = `<svg class="garage" viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg"><rect width="320" height="200" fill="none"/>
  <polygon points="160,20 300,90 160,160 20,90" fill="#a2a6ab"/><polygon points="20,90 160,20 160,-30 20,40" fill="#a6c79e"/><polygon points="160,20 300,90 300,40 160,-30" fill="#b9d8b0"/>
  <polygon points="60,70 120,100 120,126 60,96" fill="#3b6fb6"/><polygon points="120,100 150,86 150,112 120,126" fill="#2f5a99"/><polygon points="60,70 90,56 150,86 120,100" fill="#4a82cc"/>
  <rect x="190" y="70" width="34" height="20" fill="#e1d8bc" transform="skewY(26)"/><rect x="196" y="74" width="22" height="12" fill="#12303a" transform="skewY(26)"/>
  <circle cx="226" cy="76" r="9" fill="#f3c9a0"/><path d="M217 74a9 9 0 0118 0z" fill="#c8461f"/></svg>`;
  const el = h('div', { class: 'title' },
    h('div', { html: garage }),
    h('div', { class: 'logo' }, 'Garagem', h('br'), h('span', {}, 'Games'), ' Tycoon'),
    h('div', { class: 'sub' }, 'Monte seu estúdio de jogos na garagem, lance sucessos (e bugs) e vire lenda da indústria nacional.'),
    h('div', { class: 'btns' },
      has ? h('button', { class: 'btn ok', onclick: () => { const first = slots.filter((x) => x.meta).sort((a, b) => b.meta.ts - a.meta.ts)[0]; const ls = V.loadSlot(first.slot); if (ls) { sfx.click(); G.loadState(ls); } else toast('Falha ao carregar', 'ruim'); } }, 'Continuar') : null,
      h('button', { class: 'btn pri', onclick: () => { sfx.click(); UI.openNewStudio((o) => { el.remove(); startGame(o); }); } }, 'Novo estúdio'),
      has ? h('button', { class: 'btn', onclick: () => { UI.openSaves(); } }, 'Carregar jogo') : null,
      h('button', { class: 'btn', onclick: () => UI.openHowTo() }, 'Como jogar')),
    h('div', { class: 'small muted' }, `v${GAME_VERSION} · livre para todos os públicos`));
  document.body.append(el);
  if (startNew) UI.openNewStudio((o) => { el.remove(); startGame(o); });
}

// ---------------------------------------------------------------- teclado e bootstrap
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input,textarea,select') || anyModal() || $('.title') || !G.s) return;
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); G.setSpeed(G.speed === 0 ? 1 : 0); }
  else if (k === '1') G.setSpeed(1); else if (k === '2') G.setSpeed(2); else if (k === '3' || k === '4') G.setSpeed(4);
  else if (k === 'n') UI.openConcept(); else if (k === 'e') UI.openTeam(); else if (k === 'p') UI.openResearch(); else if (k === 'm') UI.openMenu(); else if (k === 'b') BUILD.isBuilding() ? BUILD.closeBuild() : BUILD.openBuild();
});
window.addEventListener('resize', () => G.office?.resize());
window.addEventListener('orientationchange', () => setTimeout(() => G.office?.resize(), 200));
$('#btn-menu').addEventListener('click', () => { sfx.click(); UI.openMenu(); });
$('#btn-info').addEventListener('click', () => { sfx.click(); UI.openHowTo(); });
window.addEventListener('error', (e) => console.error('[erro]', e.message));

G.office = new Office($('#office'), { minimap: $('#minimap') }); G.office.onFloor = () => G.updateFloorCtl?.();
G.office.onTap = BUILD.viewTap;
$('#cam-in').addEventListener('click', () => G.office.zoomAt(1.3));
$('#cam-out').addEventListener('click', () => G.office.zoomAt(1 / 1.3));
$('#cam-fit').addEventListener('click', () => G.office.fit());
$('#btn-build').addEventListener('click', () => { sfx.click(); BUILD.openBuild(); });
G.updateFloorCtl = () => {
  const m = G.s?.map, o = G.office; const el = $('#floor-ctl'); if (!el || !m || !o) return;
  const fl = m.fl | 0, fs = m.floors || [0]; el.hidden = fs.length < 2 || !$('#cam-ctl') || $('#cam-ctl').hidden;
  $('#fl-name').textContent = (MP.FLOOR_NAMES[fl] || 'Andar'); const i = MP.FLOOR_ORDER.filter((q) => fs.includes(q));
  $('#fl-up').disabled = !i.some((q) => q > fl); $('#fl-down').disabled = !i.some((q) => q < fl);
};
const stepFloor = (dir) => { const m = G.s.map, fl = m.fl | 0; const c = MP.FLOOR_ORDER.filter((q) => m.floors.includes(q) && (dir > 0 ? q > fl : q < fl)); const to = dir > 0 ? c[0] : c[c.length - 1]; if (to != null) { sfx.click(); G.office.setFloor(to); G.updateFloorCtl(); } };
$('#fl-up').addEventListener('click', () => stepFloor(1)); $('#fl-down').addEventListener('click', () => stepFloor(-1));
G.openUpgrade = () => UI.openStudio('off');
G.openBuild = (tab) => BUILD.openBuild(tab);
requestAnimationFrame(frame);
showTitle();
// PWA: registra o SW e avisa/atualiza quando sai versão nova (skipWaiting + clients.claim no sw.js).
function showUpdateBar() {
  if ($('.title')) { location.reload(); return; }
  if ($('#update-bar')) return;
  const bar = h('div', { id: 'update-bar' }, h('span', {}, '✨ Nova versão instalada!'),
    h('button', { class: 'btn sm ok', onclick: () => { try { G.save(); } catch {} location.reload(); } }, 'Atualizar agora'),
    h('button', { class: 'btn sm', onclick: () => bar.remove() }, 'Depois'));
  document.body.append(bar);
}
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !location.search.includes('nosw')) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const chk = () => reg.update().catch(() => {});
    setInterval(chk, 10 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) chk(); });
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) showUpdateBar(); });
}
window.__G = G;
