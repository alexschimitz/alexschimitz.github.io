// Telas da expansão "Indie de verdade": Mundo (hub), Mercado, Fãs (v0.2) e, adiante, Redes, Imprensa, Vida.
import * as D from '../data.js';
import * as M from '../sim.js';
import * as W from '../world.js';
import * as C from '../catalog.js';
import { suggestTitles } from '../names.js';
import { money, moneyShort, num, numShort, dateStr, dateOf } from '../util.js';
import { sfx } from '../audio.js';
import { h, modal, toast } from './dom.js';
import { G } from './ctrl.js';
import { openSocial, openPress, openCrisis, openLifeEvent } from './screens3.js';
import { openCity } from './city.js';
import { openLife, openLearn, openPublish, openPublishWizard, openCareer } from './screens4.js';
import { openMedia, openStats } from './screens5.js';
export { openSocial, openPress, openCrisis, openLifeEvent, openLife, openLearn, openPublish, openPublishWizard, openCareer };

const s = () => G.s;
const say = (err, ok) => { if (err) { toast(err[0].toUpperCase() + err.slice(1), 'ruim'); sfx.bad(); return false; } if (ok) toast(ok, 'bom'); sfx.coin(); G.refresh(); return true; };
const genreName = (id) => D.GENRES.find((g) => g.id === id)?.nome || id;
const bar = (pct, cls = '') => h('div', { class: 'bar ' + cls }, h('i', { style: { width: Math.max(0, Math.min(100, pct)) + '%' } }));
const kv = (k, v, cls) => h('div', { class: 'kv' }, h('span', {}, k), h('b', { class: cls || '' }, v));
export const rngTmp = () => ({ rs: (Math.random() * 2 ** 32) >>> 0 });

/** Sugestões de nomes para o conceito. */
export function nameChips(c, onPick) {
  const wrap = h('div', { class: 'chips' });
  const gen = () => {
    const st = s(); const tmp = rngTmp();
    const th = c.theme ? D.THEME_BY_ID[c.theme] : D.THEMES[Math.floor(Math.random() * D.THEMES.length)];
    const ge = c.genre || D.GENRES[Math.floor(Math.random() * 6)].id;
    const avoid = st.games.map((g) => g.name);
    wrap.replaceChildren(...suggestTitles(tmp, th.nome, ge, 5, avoid).map((n) => h('button', { class: 'chipb', onclick: () => { sfx.click(); onPick(n); } }, n)));
  };
  gen();
  return h('div', {}, h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { sfx.click(); gen(); } }, '🎲 Sugerir nomes'),
    h('span', { class: 'small muted' }, c.theme && c.genre ? 'com base no tema e gênero' : 'escolha tema e gênero para sugestões melhores')), wrap);
}

// ---------------------------------------------------------------- hub "Mundo"
export function openHub() {
  const body = h('div', { class: 'col' });
  const m = modal({ title: 'Mundo dos Games', color: '#3b82c4', body, actions: [{ label: 'Fechar', fn: () => m.close() }] });
  const tile = (ico, nome, desc, fn, badge) => h('button', { class: 'tile', onclick: () => { sfx.click(); m.close(); fn(); } },
    h('span', { class: 'ti' }, ico), h('span', { class: 'tt' }, nome, badge ? h('i', { class: 'dot' }) : null), h('span', { class: 'td' }, desc));
  const st = s();
  const reqs = st.fan.requests.filter((r) => r.status === 'aberto').length;
  body.append(h('div', { class: 'grid2' },
    tile('📅', 'Mercado', 'Calendário, feiras, jams, tendências e manchetes.', () => openMarket()),
    tile('❤️', 'Fãs', 'Comunidade, fã-clube, pedidos e beta testers.', () => openFans(), reqs > 0),
    tile('💬', 'Redes sociais', 'Posts, seguidores, Discorde, influenciadores e anúncios.', () => openSocial(), st.soc.inbox.some((x) => x.status === 'novo') || !!st.soc.crisis),
    tile('📰', 'Imprensa', 'Press kit, previews, reviews, entrevistas e assessoria.', () => openPress()),
    tile('🗞️', 'Mídia', 'Colunistas rivais, memes, subreddits e a economia do mercado.', () => openMedia(), (st.mkt?.active?.length || 0) > 0 && false),
    tile('📊', 'Estatísticas', 'Gráficos, hall da fama e legado do estúdio.', () => openStats()),
    tile('🗺️', 'Cidade', 'Mapa de São Pixelo: cursos, peças, banco, feiras, networking e mudança de bairro.', () => openCity()),
    tile('🔨', 'Construir', 'Monte e decore o escritório: móveis, salas, cores e terreno.', () => G.openBuild?.()),
    ...(st.mode === 'indie' ? [
      tile('🏠', 'Vida', 'Contas, moradia, trabalho, PC, ferramentas e freelas.', () => openLife(), st.ind.burn > 0 || st.ind.mental < 30),
      tile('📚', 'Aprender', 'Cursos, livros, tutoriais e mentoria.', () => openLearn()),
      tile('🚀', 'Publicar', 'Página Stean, demo, crowdfunding, lojas, patches e DLC.', () => openPublish()),
      tile('🧭', 'Carreira', 'Solo, dupla, estúdio: escolha seu caminho.', () => openCareer())] : [])));
}

// ---------------------------------------------------------------- Mercado
export function openMarket(tab = 'cal') {
  const body = h('div', {});
  const m = modal({ title: 'Mercado e Calendário', color: '#3b82c4', size: 'mid', body, actions: [{ label: 'Fechar', fn: () => m.close() }] });
  const render = () => {
    const st = s(); W.ensure(st); const w = st.world;
    const tabs = h('div', { class: 'tabs' }, [['cal', 'Calendário'], ['tend', 'Tendências'], ['news', 'Manchetes'], ['jam', 'Jams']].map(([id, l]) => h('button', { class: tab === id ? 'on' : '', onclick: () => { tab = id; render(); } }, l)));
    const c = h('div', {});
    if (tab === 'cal') {
      const sale = W.currentSale(st), fest = W.currentFestival(st);
      if (sale) c.append(h('div', { class: 'li', style: { background: '#e9f7ec' } }, h('div', { class: 'grow' }, h('div', { class: 'nm' }, '🏷️ ' + sale.nome), h('div', { class: 'small muted' }, 'Promoção acontecendo agora: mais gente comprando, mas com desconto.'))));
      if (fest) c.append(h('div', { class: 'li', style: { background: '#e8f1fb' } }, h('div', { class: 'grow' }, h('div', { class: 'nm' }, '🎮 ' + fest.nome), h('div', { class: 'small muted' }, 'Festival de demos em andamento.'))));
      for (const e of W.upcoming(st, 4)) {
        const f = e.tipo === 'feira' ? C.FAIRS.find((x) => x.id === e.id) : null;
        const open = f ? W.fairOpen(st, e.id) : e.tipo === 'jam' ? W.jamOpen(st, e.id) : false;
        const ico = { feira: '🏟️', jam: '⏱️', promo: '🏷️', festival: '🎮' }[e.tipo];
        const btn = f && f.tipo !== 'premio' ? h('button', { class: 'btn sm ok', disabled: !open || st.money < W.fairCost(st, f), onclick: () => { const r = W.attendFair(st, e.id); if (typeof r === 'string') say(r); else { say(null, r.msg); render(); } } }, open ? `Ir · ${money(W.fairCost(st, f))}` : e.em ? `em ${e.em} sem.` : 'já foi')
          : e.tipo === 'jam' ? h('button', { class: 'btn sm ok', disabled: !open, onclick: () => { if (say(W.joinJam(st, e.id), 'Valendo! Uma semana de jam (48h).')) render(); } }, open ? 'Participar' : e.em ? `em ${e.em} sem.` : '—') : null;
        c.append(h('div', { class: 'li' }, h('div', { class: 'ico' }, ico), h('div', { class: 'grow' }, h('div', { class: 'nm' }, e.nome), h('div', { class: 'small muted' }, `Mês ${e.mes} · ${e.desc}`)), btn));
      }
    } else if (tab === 'tend') {
      const t = w.trend;
      c.append(h('h3', {}, 'Tendência do mercado'),
        t ? h('div', { class: 'li' }, h('div', { class: 'grow' }, h('div', { class: 'nm' }, W.trendLabel(t)), h('div', { class: 'small muted' }, `Vendas ${t.mult >= 1 ? '+' : ''}${Math.round((t.mult - 1) * 100)}% para jogos desse ${t.kind === 'genre' ? 'gênero' : 'tema'} · mais ${t.left} semanas.`)))
          : h('div', { class: 'muted small' }, 'Sem tendência clara no momento.'));
      c.append(h('h3', {}, 'Lançamento gigante'),
        w.blockbuster ? h('div', { class: 'li' }, h('div', { class: 'grow' }, h('div', { class: 'nm' }, w.blockbuster.nome), h('div', { class: 'small muted' }, `Vendas de ${genreName(w.blockbuster.genre)} caem ~22% (outros ~8%) por mais ${w.blockbuster.left} semanas.`)))
          : h('div', { class: 'muted small' }, 'Nenhum blockbuster no momento. Boa janela para lançar!'));
      c.append(h('h3', {}, 'Concorrência recente'), ...st.rivals.flatMap((r) => r.games.slice(-1).map((g) => kv(`${r.nome}: ${g.name}`, g.score.toFixed(1).replace('.', ',')))));
    } else if (tab === 'news') {
      if (!w.headlines.length) c.append(h('div', { class: 'muted' }, 'Sem manchetes ainda. Jogue mais um pouco!'));
      for (const hd of w.headlines.slice(0, 25)) c.append(h('div', { class: 'li' }, h('div', { class: 'ico' }, { rival: '🏢', mercado: '📈', estudio: '⭐', mundo: '🌐', imprensa: '📰', social: '💬' }[hd.tipo] || '🌐'), h('div', { class: 'grow' }, h('div', { class: 'nm small' }, hd.txt), h('div', { class: 'small muted' }, dateStr(hd.w)))));
    } else {
      c.append(h('div', { class: 'small muted' }, 'Game jams são 48h para criar um protótipo. Custam uma semana de trabalho e energia, rendem prática, fãs e uma ideia que adianta seu próximo projeto.'));
      if (w.jam) c.append(h('div', { class: 'warn' }, 'Você está numa jam! Seu projeto fica parado esta semana.'));
      c.append(h('h3', {}, 'Protótipos de jams'), w.protos.length ? w.protos.map((p) => h('div', { class: 'li' + (p.used ? ' dim' : '') }, h('div', { class: 'grow' }, h('div', { class: 'nm' }, p.nome), h('div', { class: 'small muted' }, `${D.THEME_BY_ID[p.theme].nome} · ${genreName(p.genre)} · nota ${p.nota}${p.used ? ' · já usado' : ' · usável no próximo Conceito'}`)))) : h('div', { class: 'muted small' }, 'Nenhuma jam concluída ainda.'));
      c.append(h('h3', {}, 'Resultados'), w.jams.length ? [...w.jams].reverse().map((r) => kv(`${r.jam} (ano ${r.y})`, `${r.rank}º de ${r.entries}`)) : h('div', { class: 'muted small' }, '—'));
    }
    body.replaceChildren(tabs, c);
  };
  render();
}

// ---------------------------------------------------------------- Fãs
export function openFans() {
  const body = h('div', {});
  const m = modal({ title: 'Fãs e Comunidade', color: '#d6577e', size: 'mid', body, actions: [{ label: 'Fechar', fn: () => m.close() }] });
  const render = () => {
    const st = s(); W.ensure(st); const f = st.fan; const b = W.fanBreakdown(st);
    const seg = (n, cor, nome) => h('div', { class: 'seg3', style: { flex: String(Math.max(0.02, n)), background: cor }, title: nome });
    const tot = Math.max(1, b.total);
    const c = h('div', { class: 'col' },
      h('div', { class: 'row' }, h('div', { class: 'big' }, numShort(b.total)), h('div', { class: 'small muted' }, 'fãs no total · humor da comunidade: ', h('b', {}, Math.round(f.mood) + '/100'))),
      bar(f.mood, f.mood < 40 ? 'r' : f.mood < 65 ? 'o' : ''),
      h('div', { class: 'stack' }, seg(b.loyal / tot, '#3da35d', 'leais'), seg(b.casual / tot, '#3b82c4', 'casuais'), seg(b.toxic / tot, '#d9453d', 'tóxicos')),
      h('div', { class: 'row wrap small' }, h('span', { class: 'dotc', style: { background: '#3da35d' } }), `Leais ${numShort(b.loyal)}`, h('span', { class: 'dotc', style: { background: '#3b82c4' } }), `Casuais ${numShort(b.casual)}`, h('span', { class: 'dotc', style: { background: '#d9453d' } }), `Tóxicos ${numShort(b.toxic)}`),
      h('div', { class: 'small muted' }, 'Leais compram no primeiro dia e defendem você. Tóxicos reclamam de tudo e derrubam o humor; bugs e lançamentos ruins os atraem.'),
      h('h3', {}, 'Fãs por gênero'));
    const gs = Object.entries(f.byGenre).filter(([, v]) => v > 0).sort((a, b2) => b2[1] - a[1]).slice(0, 6);
    const mx = Math.max(1, ...gs.map((x) => x[1]));
    if (!gs.length) c.append(h('div', { class: 'muted small' }, 'Lance jogos para formar uma base de fãs por gênero.'));
    gs.forEach(([g, v]) => c.append(h('div', { class: 'row' }, h('div', { style: { width: '92px' }, class: 'small b' }, genreName(g)), h('div', { class: 'grow', style: { flex: 1 } }, bar(v / mx * 100, 'b')), h('div', { class: 'small', style: { width: '48px', textAlign: 'right' } }, numShort(v)))));
    // fã-clube
    c.append(h('h3', {}, 'Fã-clube'));
    if (f.club) c.append(kv('Membros', num(f.club.members)), kv('Mensalidades (semana)', money(f.club.dues), 'pos'), h('div', { class: 'small muted' }, 'Membros apoiam com uma mensalidade simbólica e seguram o humor da comunidade.'));
    else c.append(h('div', { class: 'li' }, h('div', { class: 'grow' }, h('div', { class: 'nm' }, 'Abrir fã-clube oficial'), h('div', { class: 'small muted' }, `Precisa de ${W.CLUB_MIN_FANS}+ fãs. Aumenta o número de fãs leais e gera apoio semanal.`)),
      h('button', { class: 'btn sm ok', disabled: st.fans < W.CLUB_MIN_FANS || st.money < W.clubCost(st), onclick: () => { if (say(W.openClub(st), 'Fã-clube aberto!')) render(); } }, money(W.clubCost(st)))));
    // betas
    c.append(h('h3', {}, 'Beta testers'));
    const p = st.project;
    c.append(h('div', { class: 'small muted' }, 'Fãs testam seu jogo durante o desenvolvimento: menos bugs e um pouco de hype. Risco pequeno de vazamentos.'));
    if (!p) c.append(h('div', { class: 'muted small' }, 'Comece um projeto para recrutar beta testers.'));
    else if (p.beta) c.append(kv(`Grupo de beta de ${p.name}`, `${p.beta} testers`, 'pos'));
    else {
      const max = Math.min(40, Math.floor(st.fans * 0.2));
      const opts = [5, 15, 30].filter((n) => n <= Math.max(5, max));
      c.append(h('div', { class: 'row wrap' }, opts.map((n) => h('button', { class: 'btn sm', disabled: max < 3 || st.money < W.betaCost(st, n), onclick: () => { if (say(W.recruitBeta(st, n), `${n} fãs viraram beta testers.`)) render(); } }, `${n} testers · ${money(W.betaCost(st, n))}`)), max < 3 ? h('span', { class: 'small muted' }, 'Precisa de 15+ fãs') : null));
    }
    // pedidos
    c.append(h('h3', {}, 'Pedidos dos fãs'));
    const open = f.requests.filter((r) => r.status === 'aberto');
    if (!open.length) c.append(h('div', { class: 'muted small' }, 'Nenhum pedido aberto agora. Eles aparecem conforme a comunidade cresce.'));
    for (const r of open) c.append(h('div', { class: 'li' }, h('div', { class: 'grow' }, h('div', { class: 'nm small' }, r.txt), h('div', { class: 'small muted' }, `Recompensa: +${r.reward.fans} fãs · expira em ${Math.max(0, r.expires - st.week)} sem.`)),
      h('div', { class: 'col', style: { gap: '4px' } }, h('button', { class: 'btn sm', onclick: () => { say(W.resolveRequest(st, r.id, 'responder'), 'Respondido!'); render(); } }, 'Responder'), h('button', { class: 'btn sm', onclick: () => { W.resolveRequest(st, r.id, 'ignorar'); render(); } }, 'Ignorar'))));
    const done = f.requests.filter((r) => r.status !== 'aberto').slice(-4).reverse();
    if (done.length) c.append(h('div', { class: 'small muted' }, 'Recentes: ' + done.map((r) => `${r.status}`).join(', ')));
    c.append(kv('Pedidos cumpridos', String(f.done)), kv('Ignorados', String(f.ignored)));
    body.replaceChildren(c);
  };
  render();
}

export { openCity };
