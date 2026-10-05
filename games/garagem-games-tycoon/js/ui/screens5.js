// Telas da v0.7: Mídia (colunistas, memes, subreddits, economia), Estatísticas e hall da fama, cerimônia de premiação,
// vida da equipe, editor do estúdio (logo/cores/avatar), dificuldade e cenários.
import * as D from '../data.js';
import * as M from '../sim.js';
import * as MED from '../media.js';
import * as MKT from '../market.js';
import * as MD from '../modes.js';
import * as LG from '../legacy.js';
import * as LE from '../lifeevents.js';
import * as V from '../save.js';
import * as C from '../catalog.js';
import { money, moneyShort, numShort, dateStr, yearOf } from '../util.js';
import { sfx } from '../audio.js';
import { h, modal, toast, avatarSVG } from './dom.js';
import { G } from './ctrl.js';

const s = () => G.s;
const say = (r, okTxt) => { if (r?.err) { toast(r.err[0].toUpperCase() + r.err.slice(1), 'ruim'); sfx.bad(); return false; } toast(r?.msg || okTxt || 'Pronto', r?.bad ? 'ruim' : 'bom'); sfx[r?.bad ? 'bad' : 'coin'](); G.refresh(); return true; };
const tabsBar = (list, cur, set) => h('div', { class: 'tabs', role: 'tablist' }, list.map(([id, l]) => h('button', { role: 'tab', 'aria-selected': cur === id ? 'true' : 'false', class: cur === id ? 'on' : '', onclick: () => set(id) }, l)));
const bar = (pct, cls = '') => h('div', { class: 'bar ' + cls }, h('i', { style: { width: Math.max(0, Math.min(100, pct)) + '%' } }));

// ---------------------------------------------------------------- MÍDIA
export function openMedia(tab = 'col') {
  const body = h('div', {});
  const m = modal({ title: '🗞️ Mídia e Comunidade', color: '#d6577e', size: 'mid', body, actions: [{ label: 'Fechar', fn: () => m.close() }] });
  const render = () => {
    const st = s(); const M_ = MED.ensureMedia(st); MKT.ensureMarket(st);
    const c = h('div', {});
    if (tab === 'col') {
      c.append(h('div', { class: 'small muted', style: { marginBottom: '6px' } }, 'Colunistas rivais comentam seus lançamentos. Dar entrevista ao colunista de um lado deixa o rival ressentido.'));
      const pairs = MED.COLUMNISTS.filter((x, i) => i % 2 === 0);
      for (const a of pairs) {
        const b = MED.COL_BY_ID[a.rival];
        c.append(h('div', { class: 'duel' }, [a, b].map((x) => h('div', { class: 'li' },
          h('div', { class: 'chip', style: { background: '#2f3b52' } }, x.ico),
          h('div', { class: 'grow' }, h('div', { class: 'nm' }, x.nome), h('div', { class: 'small muted' }, `${C.OUTLETS.find((o) => o.id === x.outlet)?.nome || x.outlet} · ${x.estilo} · relação ${MED.relOf(st, x.id) >= 0 ? '+' : ''}${MED.relOf(st, x.id)}`)),
          h('button', { class: 'btn sm', disabled: MED.interviewBlock(st, x.id) ? true : null, title: MED.interviewBlock(st, x.id) || '', onclick: () => { if (say(MED.interview(st, x.id))) render(); } }, st.mode === 'indie' ? 'Entrevista (4h)' : 'Entrevista ' + moneyShort(MED.interviewCost(st)))))));
      }
      c.append(h('h3', {}, 'Colunas recentes'), ...(M_.cols.length ? M_.cols.slice(0, 8).map((x) => { const col = MED.COL_BY_ID[x.col]; return h('div', { class: 'li' }, h('div', { class: 'chip', style: { background: x.tone === 'amor' ? '#3da35d' : x.tone === 'odio' ? '#d0592f' : '#8a8a8a' } }, col.ico), h('div', { class: 'grow' }, h('div', { class: 'small b' }, col.nome), h('div', { class: 'small' }, x.txt), h('div', { class: 'small muted' }, dateStr(x.w) + (x.fans ? ` · ${x.fans > 0 ? '+' : ''}${x.fans} fãs` : '')))); }) : [h('div', { class: 'muted small' }, 'Nenhuma coluna ainda. Lance um jogo!')]),
        M_.feuds ? h('div', { class: 'small muted' }, `Tretas causadas: ${M_.feuds}`) : null);
    } else if (tab === 'meme') {
      c.append(h('div', { class: 'small muted', style: { marginBottom: '6px' } }, 'Jogos muito bons, muito bugados ou muito ruins podem virar meme. Assumir a brincadeira dobra o alcance — mas meme de flop pode azedar.'));
      if (!M_.memes.length) c.append(h('div', { class: 'muted' }, 'Nenhum meme ainda.'));
      for (const x of M_.memes.slice(0, 10)) c.append(h('div', { class: 'li' }, h('div', { class: 'chip', style: { background: x.kind === 'bom' ? '#3da35d' : x.kind === 'bug' ? '#e0a030' : '#9c1f1f' } }, x.kind === 'bom' ? '😎' : x.kind === 'bug' ? '🐞' : '💀'),
        h('div', { class: 'grow' }, h('div', { class: 'nm' }, x.txt), h('div', { class: 'small muted' }, `${x.game} · viralidade ${Math.round(x.vir * 100)}% · ${dateStr(x.w)} · +${x.gain || 0} fãs`)),
        h('button', { class: 'btn sm', disabled: x.used ? true : null, onclick: () => { if (say(MED.embrace(st, x.id))) render(); } }, x.used ? 'Feito' : 'Assumir')));
    } else if (tab === 'sub') {
      c.append(h('div', { class: 'small muted', style: { marginBottom: '6px' } }, 'Comunidades fictícias. O humor muda com a qualidade dos seus jogos do gênero que elas gostam. Um AMA com humor alto rende fãs; com humor baixo, vira bomba.'));
      for (const x of MED.SUBS) {
        const stt = M_.subs[x.id]; const blk = MED.amaBlock(st, x.id);
        c.append(h('div', { class: 'li' }, h('div', { class: 'grow' }, h('div', { class: 'nm' }, x.nome), h('div', { class: 'small muted' }, `${numShort(stt.members)} membros · gosta de ${x.gosta.slice(0, 3).map((g) => D.GENRES.find((q) => q.id === g)?.nome).join(', ')}`), bar(stt.mood, stt.mood > 60 ? '' : stt.mood < 35 ? 'r' : 'o')),
          h('button', { class: 'btn sm', disabled: blk ? true : null, title: blk || '', onclick: () => { if (say(MED.ama(st, x.id))) render(); } }, 'AMA')));
      }
    } else {
      const act = MKT.active(st);
      c.append(h('div', { class: 'small muted', style: { marginBottom: '6px' } }, 'Condições do mercado em vigor: crises, greves, tendências, novas plataformas e escândalos mexem em vendas, custos e produção.'));
      if (!act.length) c.append(h('div', { class: 'li' }, h('div', { class: 'grow' }, 'Mercado em calma. Nada de especial por enquanto.')));
      for (const a of act) {
        const d = a.def; const eff = []; const fx = a.fx;
        if (fx.sales) eff.push(`vendas ${fx.sales > 1 ? '+' : ''}${Math.round((fx.sales - 1) * 100)}%`); if (fx.cost) eff.push(`custos ${fx.cost > 1 ? '+' : ''}${Math.round((fx.cost - 1) * 100)}%`); if (fx.prod) eff.push(`produção ${Math.round((fx.prod - 1) * 100)}%`); if (fx.lic) eff.push(`licenças +${Math.round((fx.lic - 1) * 100)}%`);
        if (fx.genre) for (const [g, v] of Object.entries(fx.genre)) eff.push(`${D.GENRES.find((q) => q.id === g)?.nome} ${v > 1 ? '+' : ''}${Math.round((v - 1) * 100)}%`); if (fx.tipo) for (const [g, v] of Object.entries(fx.tipo)) eff.push(`${g} ${v > 1 ? '+' : ''}${Math.round((v - 1) * 100)}%`);
        c.append(h('div', { class: 'li' }, h('div', { class: 'chip', style: { background: d.kind === 'boom' || d.kind === 'plataforma' || d.kind === 'tendencia' ? '#3da35d' : '#d0592f' } }, d.ico),
          h('div', { class: 'grow' }, h('div', { class: 'nm' }, d.nome + (a.extra || '')), h('div', { class: 'small' }, d.txt), h('div', { class: 'small muted' }, `${eff.join(' · ')} · ${a.left} sem. restantes`)),
          d.resp ? h('button', { class: 'btn sm', disabled: a.paid ? true : null, onclick: () => { if (say(MKT.respond(st, a.id))) render(); } }, a.paid ? 'Feito' : `${d.resp.label.split(' (')[0]} · ${moneyShort(MKT.respCost(st, a.id))}`) : null));
      }
      if (st.mkt.log.length) c.append(h('h3', {}, 'Histórico'), ...st.mkt.log.slice(0, 6).map((x) => h('div', { class: 'small' }, `${dateStr(x.w)} — ${x.txt}`)));
    }
    body.replaceChildren(tabsBar([['col', 'Colunistas'], ['meme', 'Memes'], ['sub', 'Subreddits'], ['eco', 'Economia']], tab, (t) => { tab = t; sfx.click(); render(); }), c);
  };
  render();
}

// ---------------------------------------------------------------- ESTATÍSTICAS / HALL DA FAMA
function chart(series, key, color, w = 300, hh = 90, fmt = moneyShort) {
  const pts = LG.polyline(series, key, w, hh);
  const vals = series.map((p) => p[key]); const mx = Math.max(0, ...vals), mn = Math.min(0, ...vals);
  return h('div', { class: 'chart' }, h('div', { class: 'small muted' }, `${fmt(mx)} máx.${mn < 0 ? ' · ' + fmt(mn) + ' mín.' : ''}`),
    h('div', { html: series.length > 1 ? `<svg viewBox="0 0 ${w} ${hh}" width="100%" role="img" aria-label="gráfico" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/><polyline points="${pts} ${w - 4},${hh - 4} 4,${hh - 4}" fill="${color}" opacity=".14"/></svg>` : '<div class="muted small">Sem dados ainda (o gráfico começa a ser montado a cada mês).</div>' }));
}
export function openStats(tab = 'graf') {
  const body = h('div', {});
  const m = modal({ title: '📊 Estatísticas e Hall da Fama', color: '#2aa6a0', size: 'mid', body, actions: [{ label: 'Fechar', fn: () => m.close() }] });
  const render = () => {
    const st = s(); LG.ensureLegacy(st); const sm = LG.summary(st); const c = h('div', {});
    if (tab === 'graf') {
      c.append(h('h3', {}, 'Caixa ao longo do tempo'), chart(st.series, 'm', '#3da35d'), h('h3', {}, 'Fãs'), chart(st.series, 'f', '#d6577e', 300, 80, numShort), h('h3', {}, 'Faturamento acumulado'), chart(st.series, 'r', '#3b82c4'), h('h3', {}, 'Tamanho da equipe'), chart(st.series, 'e', '#8a5cc2', 300, 60, (v) => String(v)));
    } else if (tab === 'jogos') {
      c.append(h('div', { class: 'kv' }, h('span', {}, 'Jogos lançados'), h('b', {}, st.games.length)), h('div', { class: 'kv' }, h('span', {}, 'Nota média'), h('b', {}, sm.avgScore ? sm.avgScore.toFixed(1) : '—')), h('div', { class: 'kv' }, h('span', {}, 'Unidades vendidas'), h('b', {}, numShort(sm.units))), h('div', { class: 'kv' }, h('span', {}, 'Faturamento total'), h('b', {}, money(sm.revenue))));
      c.append(h('h3', {}, 'Notas por jogo'));
      if (sm.scores.length) c.append(h('div', { class: 'bars', html: `<svg viewBox="0 0 ${Math.max(300, sm.scores.length * 22)} 90" width="100%" height="90" role="img" aria-label="notas por jogo">${sm.scores.map((q, i) => `<rect x="${6 + i * 22}" y="${88 - q.score * 8}" width="16" height="${q.score * 8}" rx="2" fill="${q.score >= 8 ? '#3da35d' : q.score >= 6 ? '#e0a030' : '#d0592f'}"><title>${q.nome}: ${q.score}</title></rect>`).join('')}</svg>` }));
      else c.append(h('div', { class: 'muted small' }, 'Ainda sem jogos.'));
      c.append(h('h3', {}, 'Faturamento por gênero'), ...sm.genres.slice(0, 8).map((q) => { const mx = sm.genres[0].gross || 1; return h('div', { class: 'row' }, h('div', { style: { width: '92px' }, class: 'small b' }, D.GENRES.find((g) => g.id === q.id)?.nome), h('div', { style: { flex: 1 } }, bar(q.gross / mx * 100)), h('div', { class: 'small', style: { width: '64px', textAlign: 'right' } }, moneyShort(q.gross))); }));
      if (sm.top.length) c.append(h('h3', {}, 'Maiores sucessos'), ...sm.top.map((g, i) => h('div', { class: 'kv' }, h('span', {}, `${i + 1}. ${g.name}`), h('b', {}, money(g.gross || 0)))));
    } else if (tab === 'hall') {
      c.append(h('div', { class: 'small muted', style: { marginBottom: '6px' } }, 'A linha do tempo do estúdio: melhor jogo, prêmios e posição no ranking de cada ano.'));
      if (!st.hall.length) c.append(h('div', { class: 'muted' }, 'O primeiro ano ainda não fechou.'));
      for (const e of st.hall.slice().reverse()) c.append(h('div', { class: 'li' }, h('div', { class: 'chip', style: { background: e.awards.length ? '#f0a030' : '#2f3b52' } }, e.awards.length ? '🏆' : 'A' + e.y),
        h('div', { class: 'grow' }, h('div', { class: 'nm' }, `Ano ${e.y} · ${e.rank}º no ranking`), h('div', { class: 'small' }, e.best ? `Melhor jogo: “${e.best.nome}” (${e.best.score})` : 'Nenhum lançamento'), h('div', { class: 'small muted' }, `${e.games} jogo(s) · faturou ${moneyShort(e.revenue)} · ${numShort(e.fans)} fãs · ${e.team} pessoa(s)${e.awards.length ? ' · 🏆 ' + e.awards.join(', ') : ''}`))));
    } else {
      const lg = V.loadLegacy();
      c.append(h('div', { class: 'small muted', style: { marginBottom: '6px' } }, 'Os melhores estúdios que você já encerrou (falência ou aposentadoria). Fica guardado neste aparelho.'));
      if (!lg.length) c.append(h('div', { class: 'muted' }, 'Ainda não há estúdios no legado. Eles entram ao falir ou ao aposentar o atual.'));
      lg.forEach((e, i) => c.append(h('div', { class: 'li' }, h('div', { class: 'chip', style: { background: 'transparent' }, html: MD.logoSVG(e.brand, 34) }), h('div', { class: 'grow' }, h('div', { class: 'nm' }, `${i + 1}. ${e.nome}`), h('div', { class: 'small muted' }, `${e.anos} ano(s) · ${e.jogos} jogos · ${e.motivo} · ${e.diff || 'Normal'}${e.cenario ? ' · ' + e.cenario : ''}`)), h('b', {}, numShort(e.score)))));
      c.append(h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn sm', disabled: st.over ? true : null, onclick: () => { if (confirm('Aposentar o estúdio agora e registrar no legado? O jogo continua, mas a pontuação atual fica guardada.')) { V.pushLegacy(legacyEntry(st, 'Aposentadoria')); toast('Estúdio registrado no legado', 'bom'); render(); } } }, '🏖️ Registrar estúdio no legado')));
    }
    body.replaceChildren(tabsBar([['graf', 'Gráficos'], ['jogos', 'Jogos'], ['hall', 'Hall da fama'], ['leg', 'Legado']], tab, (t) => { tab = t; sfx.click(); render(); }), c);
  };
  render();
}
export function legacyEntry(st, motivo) {
  return { nome: st.studio.nome, score: M.finalScore(st), anos: Math.floor(st.week / 48), jogos: st.games.length, motivo, brand: st.studio.brand, diff: MD.diffOf(st).nome, cenario: MD.scnOf(st)?.nome || '', ts: Date.now() };
}

// ---------------------------------------------------------------- CERIMÔNIA DE PREMIAÇÃO
export function openCeremony(ev, onDone) {
  const st = s(); const wins = ev.wins.filter((w) => w.noms?.length);
  if (!wins.length) { onDone?.(); return; }
  let i = 0, revealed = false;
  const body = h('div', { class: 'cer' });
  const m = modal({ title: `🎭 ${D.AWARD_NAME}s — Ano ${ev.y}`, color: '#8a5cc2', body, closable: false, actions: [] });
  st.flags.ceremony = true;
  const finish = () => { m.close(); onDone?.(); };
  const render = () => {
    const w = wins[i]; const last = i === wins.length - 1;
    body.replaceChildren(
      h('div', { class: 'cer-stage' }, h('div', { class: 'cer-title' }, w.nome), h('div', { class: 'small muted' }, `Categoria ${i + 1} de ${wins.length}`),
        h('div', { class: 'cer-noms' }, w.noms.map((n, k) => h('div', { class: 'cer-nom' + (revealed && n.quem === w.vencedor ? ' win' : '') + (n.me ? ' me' : ''), style: { animationDelay: k * 0.12 + 's' } }, h('span', {}, n.me ? '⭐' : '🎬'), h('div', { class: 'grow' }, h('div', { class: 'nm' }, n.jogo || n.quem), n.jogo ? h('div', { class: 'small muted' }, n.quem) : null)))),
        revealed ? h('div', { class: 'cer-win' + (w.player ? ' me' : '') }, h('div', { class: 'small' }, 'E o vencedor é…'), h('div', { class: 'cer-name' }, w.vencedor), w.jogo ? h('div', { class: 'small' }, `“${w.jogo}”`) : null, w.player ? h('div', { class: 'pos b' }, '🏆 É o seu estúdio! Prêmio em dinheiro e fãs novos.') : null)
          : h('div', { class: 'cer-env' }, '✉️')),
      h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '10px' } },
        !revealed ? h('button', { class: 'btn pri', onclick: () => { revealed = true; sfx.drum?.(); setTimeout(() => (w.player ? (sfx.award || sfx.launch)() : sfx.good()), 200); render(); } }, '✉️ Abrir o envelope') : h('button', { class: 'btn ok', onclick: () => { if (last) finish(); else { i++; revealed = false; sfx.click(); render(); } } }, last ? 'Encerrar a cerimônia' : 'Próxima categoria'),
        h('button', { class: 'btn', onclick: finish }, 'Pular')));
  };
  render(); sfx.level();
}

// ---------------------------------------------------------------- VIDA DA EQUIPE
export function openStaffLife() {
  const st = s(); const cur = LE.staffCurrent(st); if (!cur) return;
  const body = h('div', { class: 'col' });
  const m = modal({ title: `${cur.ev.ico} ${cur.ev.nome}`, color: '#2aa6a0', body, actions: [{ label: 'Decidir depois', fn: () => m.close() }] });
  body.replaceChildren(h('div', { class: 'row' }, h('div', { html: avatarSVG(cur.emp.look, 56), style: { width: '56px', height: '56px', borderRadius: '50%', overflow: 'hidden', flex: 'none' } }), h('p', { style: { margin: 0 } }, cur.txt)),
    h('div', { class: 'small muted' }, 'Sem resposta em 3 semanas vale a escolha mais passiva.'),
    h('div', { class: 'col' }, cur.ev.opts.map((o) => { const blk = o.ok && !o.ok(st); return h('button', { class: 'pick' + (blk ? ' lock' : ''), disabled: blk ? true : null, onclick: () => { const r = LE.staffChoose(st, o.id); if (r.err) { say(r); return; } m.close(); toast(r.msg, 'bom'); sfx.good(); G.refresh(); } }, h('span', {}, o.label), h('span', { class: 'v small' }, o.desc)); })));
}

// ---------------------------------------------------------------- EDITOR DO ESTÚDIO / EXTRAS DO NOVO ESTÚDIO
const ACCESSORIES = ['Nenhum', 'Óculos', 'Boné', 'Fone de ouvido', 'Barba'];
export function brandEditor(brand, look, rerender, opts = {}) {
  const sw = (list, get, set) => h('div', { class: 'sw' }, list.map((c) => h('button', { class: get() === c ? 'on' : '', style: { background: c }, 'aria-label': 'cor ' + c, onclick: () => { set(c); rerender(); } })));
  return h('div', { class: 'col' },
    h('div', { class: 'row' }, h('div', { html: MD.logoSVG(brand, 72), style: { width: '72px', height: '72px', flex: 'none' } }), h('div', { class: 'col', style: { flex: 1 } }, h('div', { class: 'small b' }, 'Logo do estúdio'),
      h('div', { class: 'logos' }, MD.LOGO_NAMES.map((n, i) => h('button', { class: 'lg' + (brand.logo === i ? ' on' : ''), title: n, 'aria-label': 'logo ' + n, html: MD.logoSVG({ ...brand, logo: i }, 30), onclick: () => { brand.logo = i; rerender(); } }))))),
    h('div', {}, h('div', { class: 'small b' }, 'Formato'), h('div', { class: 'seg' }, MD.BADGES.map((b) => h('button', { class: brand.badge === b ? 'on' : '', onclick: () => { brand.badge = b; rerender(); } }, { circulo: 'Círculo', quadrado: 'Quadrado', escudo: 'Escudo', hex: 'Hexágono' }[b])))),
    h('div', {}, h('div', { class: 'small b' }, 'Cor principal'), sw(MD.BRAND_COLORS, () => brand.c1, (c) => { brand.c1 = c; })),
    h('div', {}, h('div', { class: 'small b' }, 'Cor do símbolo'), sw(MD.BRAND_COLORS, () => brand.c2, (c) => { brand.c2 = c; })),
    look ? h('div', {}, h('div', { class: 'small b' }, 'Acessório do avatar'), h('div', { class: 'seg' }, ACCESSORIES.map((n, i) => h('button', { class: (look.acc | 0) === i ? 'on' : '', onclick: () => { look.acc = i; rerender(); } }, n)))) : null);
}
/** Seções extras do assistente de novo estúdio: dificuldade, cenário e identidade. */
export function newStudioExtras(f, look, render) {
  f.diff ??= 'normal'; f.scenario ??= 'livre'; f.brand ??= MD.defaultBrand(f.studio);
  const scs = MD.SCN_LIST.filter((id) => MD.SCENARIOS[id].modes.includes(f.mode));
  if (!scs.includes(f.scenario)) f.scenario = 'livre';
  return [
    h('div', {}, h('div', { class: 'small b' }, 'Dificuldade'), h('div', { class: 'seg wrap' }, Object.entries(MD.DIFFICULTIES).map(([id, d]) => h('button', { class: f.diff === id ? 'on' : '', onclick: () => { f.diff = id; render(); } }, d.ico + ' ' + d.nome))), h('div', { class: 'small muted' }, MD.DIFFICULTIES[f.diff].desc)),
    h('div', {}, h('div', { class: 'small b' }, 'Cenário / desafio'), h('div', { class: 'col' }, scs.map((id) => { const sc = MD.SCENARIOS[id]; return h('button', { class: 'pick' + (f.scenario === id ? ' set' : ''), style: f.scenario === id ? { borderColor: '#2f3b52' } : null, onclick: () => { f.scenario = id; render(); } }, h('span', {}, sc.ico + ' ' + sc.nome), h('span', { class: 'small muted' }, sc.desc)); }))),
    h('div', {}, h('div', { class: 'small b' }, 'Identidade do estúdio'), brandEditor(f.brand, look, render)),
  ];
}
export function openStudioEditor() {
  const st = s(); const f = { studio: st.studio.nome, founder: st.employees[0].name }; const brand = { ...MD.ensureBrand(st) }; const look = { ...st.employees[0].look };
  const body = h('div', { class: 'col' });
  const m = modal({ title: '🎨 Editar estúdio', color: '#d6577e', body, actions: [{ label: 'Salvar', cls: 'ok', fn: () => {
    st.studio.nome = f.studio.trim() || st.studio.nome; st.employees[0].name = f.founder.trim() || st.employees[0].name; st.studio.brand = { ...brand }; st.employees[0].look = { ...look }; st.flags.brand = true;
    sfx.good(); m.close(); toast('Identidade atualizada', 'bom'); G.refresh(); G.checkAch?.();
  } }, { label: 'Cancelar', fn: () => m.close() }] });
  const sw = (list, key) => h('div', { class: 'sw' }, list.map((c) => h('button', { class: look[key] === c ? 'on' : '', style: { background: c }, 'aria-label': 'cor', onclick: () => { look[key] = c; render(); } })));
  const render = () => body.replaceChildren(
    h('div', { class: 'row' }, h('div', { html: avatarSVG(look, 80), style: { borderRadius: '50%', overflow: 'hidden', width: '80px', height: '80px', flex: 'none' } }),
      h('div', { class: 'col', style: { flex: 1 } }, h('div', {}, h('div', { class: 'small b' }, 'Nome do estúdio'), h('input', { type: 'text', value: f.studio, maxlength: 24, oninput: (e) => { f.studio = e.target.value; } })), h('div', {}, h('div', { class: 'small b' }, 'Nome do fundador(a)'), h('input', { type: 'text', value: f.founder, maxlength: 18, oninput: (e) => { f.founder = e.target.value; } })))),
    h('div', {}, h('div', { class: 'small b' }, 'Cabelo'), sw(D.HAIRS, 'hair')), h('div', {}, h('div', { class: 'small b' }, 'Pele'), sw(D.SKINS, 'skin')), h('div', {}, h('div', { class: 'small b' }, 'Camiseta'), sw(D.SHIRTS, 'shirt')),
    h('div', {}, h('div', { class: 'small b' }, 'Penteado'), h('div', { class: 'seg' }, ['Curto', 'Longo', 'Coque'].map((n, i) => h('button', { class: look.style === i ? 'on' : '', onclick: () => { look.style = i; render(); } }, n)))),
    brandEditor(brand, look, render));
  render();
}

// ---------------------------------------------------------------- CENÁRIO (cartão de meta)
export function openScenario() {
  const st = s(); const sc = MD.scnOf(st); const df = MD.diffOf(st);
  const body = h('div', { class: 'col' });
  const m = modal({ title: sc ? `${sc.ico} ${sc.nome}` : '⚙️ Partida', color: '#2f3b52', body, actions: [{ label: 'Fechar', fn: () => m.close() }] });
  body.append(h('div', { class: 'kv' }, h('span', {}, 'Dificuldade'), h('b', {}, `${df.ico} ${df.nome}`)), sc ? h('p', {}, sc.desc) : h('p', { class: 'muted' }, 'Jogo livre: sem metas.'));
  if (sc?.goal) {
    const p = MD.goalProgress(st);
    body.append(h('div', { class: 'small b' }, 'Meta: ' + MD.goalText(st)), bar(p * 100, st.scn.done != null ? '' : 'b'), h('div', { class: 'small muted' }, st.scn.done != null ? `✅ Cumprida na semana ${st.scn.done}!` : st.scn.failed != null ? `⌛ O prazo (${sc.years} anos) acabou — você pode continuar jogando.` : `Prazo: ${sc.years} ano(s) (${Math.max(0, st.scn.deadline - st.week)} semanas restantes)`));
  }
  const mk = MKT.active(st); if (mk.length) body.append(h('div', { class: 'small muted' }, 'Mercado agora: ' + mk.map((a) => a.def.ico + ' ' + a.def.nome).join(' · ')));
}
