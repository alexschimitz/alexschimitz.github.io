// Telas do modo Indie (v0.4): Vida, Aprender, Publicar e Carreira.
import * as D from '../data.js';
import * as M from '../sim.js';
import * as IND from '../indie.js';
import * as SO from '../social.js';
import * as W from '../world.js';
import * as C from '../catalog.js';
import { money, numShort, dateStr } from '../util.js';
import { sfx } from '../audio.js';
import { h, modal, toast, sparkline } from './dom.js';
import { G } from './ctrl.js';

const s = () => G.s;
const say = (err, ok) => { if (err) { toast(err[0].toUpperCase() + err.slice(1), 'ruim'); sfx.bad(); return false; } if (ok) toast(ok, 'bom'); sfx.coin(); G.refresh(); return true; };
const bar = (pct, cls = '') => h('div', { class: 'bar ' + cls }, h('i', { style: { width: Math.max(0, Math.min(100, pct)) + '%' } }));
const kv = (k, v, cls) => h('div', { class: 'kv' }, h('span', {}, k), h('b', { class: cls || '' }, v));
const li = (title, desc, btn, dim) => h('div', { class: 'li' + (dim ? ' dim' : '') }, h('div', { class: 'grow' }, h('div', { class: 'nm' }, title), desc ? h('div', { class: 'small muted' }, desc) : null), btn || null);
const act = (label, fn, dis, cls = 'ok') => h('button', { class: 'btn sm ' + cls, disabled: !!dis, onclick: fn }, label);
const tabsRow = (list, cur, set) => h('div', { class: 'tabs' }, list.map(([id, l]) => h('button', { class: cur === id ? 'on' : '', onclick: () => { sfx.click(); set(id); } }, l)));

function statusHead(st) {
  const I = st.ind; const soc = SO.ensureSoc(st); const e = st.employees[0]; const lc = IND.livingCost(st);
  const net = lc.total - IND.jobPay(st, I.job);
  const runway = net > 0 ? Math.floor(st.money / net) : null;
  return h('div', { class: 'hrs' },
    h('div', { class: 'row small' }, h('b', {}, `Horas da semana: ${soc.hours.toFixed(0)}/${IND.WEEK_HOURS}`), h('span', { class: 'sp' }), h('span', {}, `Energia ${Math.round(e.energy)}%`)),
    bar(soc.hours / IND.WEEK_HOURS * 100, soc.hours > 30 ? 'r' : soc.hours > 20 ? 'o' : 'b'),
    h('div', { class: 'row small' }, h('b', {}, `Saúde mental ${Math.round(I.mental)}%`), h('span', { class: 'sp' }), h('span', {}, runway == null ? 'Caixa sustentável 👍' : `Fôlego: ${runway} semanas`)),
    bar(I.mental, I.mental < 30 ? 'r' : I.mental < 55 ? 'o' : 'g'),
    I.burn > 0 ? h('div', { class: 'warn' }, `😵 Burnout: ${I.burn} semana(s) de recuperação. Você mal consegue trabalhar.`) : null);
}

// =====================================================================
// VIDA
// =====================================================================
export function openLife(tab = 'vida') {
  const body = h('div', {});
  const m = modal({ title: 'Vida do Dev', color: '#7a5bd6', size: 'mid', body, actions: [{ label: 'Fechar', fn: () => m.close() }] });
  const render = () => {
    const st = s(); const I = st.ind; if (!I) { body.replaceChildren(h('div', { class: 'muted' }, 'Este save é do modo clássico (sem vida pessoal).')); return; }
    const lc = IND.livingCost(st);
    const c = h('div', { class: 'col' });
    if (tab === 'vida') {
      c.append(
        kv('Custo de vida por semana', money(lc.total)), h('div', { class: 'small muted' }, `Moradia/comida ${money(lc.moradia)} · luz e internet ${money(lc.contas)}${lc.ferramentas ? ' · assinaturas ' + money(lc.ferramentas) : ''}. Salário do fundador: R$ 0 — o caixa é a sua poupança.`),
        h('h3', {}, 'Moradia'), h('div', { class: 'col' }, Object.entries(IND.HOUSING).map(([id, x]) => h('button', { class: 'pick' + (I.housing === id ? ' set' : ''), style: I.housing === id ? { borderColor: '#7a5bd6' } : null, onclick: () => { if (say(IND.setHousing(st, id))) render(); } }, h('span', {}, x.nome), h('span', { class: 'v' }, money(x.sem) + '/sem')))),
        h('div', { class: 'small muted' }, IND.HOUSING[I.housing].desc),
        h('h3', {}, 'Trabalho'), h('div', { class: 'col' }, Object.entries(IND.JOBS).map(([id, x]) => h('button', { class: 'pick' + (I.job === id ? ' set' : ''), style: I.job === id ? { borderColor: '#7a5bd6' } : null, onclick: () => { if (say(IND.setJob(st, id))) render(); } }, h('span', {}, x.nome), h('span', { class: 'v' }, x.sem ? '+' + money(IND.jobPay(st, id)) + '/sem' : 'sem renda')))),
        h('div', { class: 'small muted' }, `${IND.JOBS[I.job].desc} Ritmo de desenvolvimento: ${Math.round(IND.founderMult(st) * 100)}% do normal (PC, emprego, humor).`),
        h('h3', {}, 'Rotina de sono'), h('div', { class: 'seg' }, [['normal', 'Dormir bem'], ['madruga', 'Virar a madrugada']].map(([id, l]) => h('button', { class: I.sleep === id ? 'on' : '', onclick: () => { IND.setSleep(st, id); render(); } }, l))),
        h('div', { class: 'small muted' }, I.sleep === 'madruga' ? '+15% de produção, mas energia e saúde mental despencam toda semana.' : 'Energia e humor estáveis.'),
        h('h3', {}, 'Cuidar de si'), ...Object.entries(IND.REST).map(([id, r]) => li(r.nome, `${r.h}h · ${r.custo ? money(r.custo) + ' · ' : ''}energia +${r.en} · humor +${r.mental}`, act('Fazer', () => { if (say(IND.rest(st, id))) render(); }))),
        h('h3', {}, 'Dicas'), ...IND.careerAdvice(st).map((t) => h('div', { class: 'small' }, t)));
    } else if (tab === 'pc') {
      c.append(h('div', { class: 'small muted' }, `Seu PC rende ${Math.round(IND.pcBase(st) * 100)}% (um PC bege de 8 anos começa em 78%).`),
        ...IND.GEAR.map((g) => { const has = !!I.gear[g.id]; return li(g.nome, `${g.desc} ${g.pc ? '· +' + Math.round(g.pc * 100) + '% de ritmo' : ''}${g.art ? ' · arte +' + Math.round(g.art * 100) + '%' : ''}`, has ? h('span', { class: 'chip' }, 'tem') : act(money(g.custo), () => { if (say(IND.buyGear(st, g.id), 'Comprado!')) render(); }, st.money < g.custo), has); }));
    } else if (tab === 'tools') {
      for (const [cat, nome] of [['engine', 'Motores'], ['arte', 'Arte 2D / 3D'], ['som', 'Áudio / DAW']]) {
        c.append(h('h3', {}, nome));
        for (const t of IND.TOOLS.filter((x) => x.cat === cat)) {
          const has = !!I.owned[t.id];
          const lbl = has ? (t.sub ? act('Cancelar', () => { say(IND.dropTool(st, t.id)); render(); }, false, 'red') : h('span', { class: 'chip' }, 'instalado')) : act(t.custo ? money(t.custo) : t.free ? 'Baixar grátis' : 'Assinar', () => { if (say(IND.buyTool(st, t.id), 'Instalado!')) render(); }, st.money < t.custo);
          c.append(li(`${t.nome} · nível ${t.lvl}`, `${t.desc}${t.sem ? ' · ' + money(t.sem) + '/sem' : ''}${t.royalty ? ' · ' + Math.round(t.royalty * 100) + '% de royalties' : ''}`, lbl, has && !t.sub));
        }
      }
      c.append(h('div', { class: 'small muted' }, `Nível atual → motor ${IND.engineLvl(st)} (limitado pela sua habilidade de programação) · arte ${IND.gfxLvl(st)} · som ${IND.sndLvl(st)}. Ferramentas 3D sem placa de vídeo perdem 1 nível.`));
    } else if (tab === 'freela') {
      c.append(h('div', { class: 'small muted' }, 'Bicos pagam as contas, mas custam horas (e horas são o seu bem mais caro). Ofertas mudam toda semana e dependem das suas habilidades.'),
        ...(I.offers.length ? I.offers.map((o) => li(o.nome, `${IND.SKILL_NAMES[o.skill]} · ${o.h}h · energia −8`, act(money(o.pay), () => { if (say(IND.takeFreela(st, o.id), 'Trabalho entregue!')) render(); }))) : [h('div', { class: 'muted' }, 'Sem ofertas esta semana. Melhore suas habilidades para receber mais.')]),
        kv('Já ganho em freelas', money(I.freelaTotal)), kv('Ganho em emprego', money(I.jobTotal)));
    }
    body.replaceChildren(statusHead(st), tabsRow([['vida', 'Vida'], ['pc', 'PC'], ['tools', 'Ferramentas'], ['freela', `Freela${I.offers.length ? ' (' + I.offers.length + ')' : ''}`]], tab, (t) => { tab = t; render(); }), c);
  };
  render();
}

// =====================================================================
// APRENDER
// =====================================================================
export function openLearn(line = 't') {
  const body = h('div', {});
  const m = modal({ title: 'Aprender', color: '#2f9e8f', size: 'mid', body, actions: [{ label: 'Fechar', fn: () => m.close() }] });
  const render = () => {
    const st = s(); const I = st.ind; const e = st.employees[0];
    if (!I) { body.replaceChildren(h('div', { class: 'muted' }, 'Só no modo Indie.')); return; }
    const skills = h('div', { class: 'col' }, Object.entries(IND.SKILL_NAMES).map(([k, n]) => { const lv = e.skills[k] ?? 1; return h('div', {}, h('div', { class: 'row small' }, h('b', {}, `${n} ${lv}`), h('span', { class: 'sp' }), h('span', { class: 'muted' }, lv >= 20 ? 'máx.' : `${Math.round(I.xp[k] || 0)}/${IND.xpNeed(lv)} XP`)), bar(lv >= 20 ? 100 : (I.xp[k] || 0) / IND.xpNeed(lv) * 100, 'g')); }));
    const chips = h('div', { class: 'chips' }, [['t', 'Programação'], ['d', 'Design'], ['g2', 'Pixel art'], ['g3', 'Modelagem 3D'], ['s', 'Áudio'], ['m', 'Marketing'], ['n', 'Negócios']].map(([id, l]) => h('button', { class: 'chipb' + (line === id ? ' on' : ''), onclick: () => { sfx.click(); line = id; render(); } }, l)));
    const list = IND.COURSES.filter((x) => x.line === line).map((cs) => {
      const blk = IND.courseBlock(st, cs.id);
      return li(cs.nome, `${cs.h}h · energia −${cs.en} · ${cs.custo ? money(cs.custo) : 'grátis'} · ≈ ${Math.max(0.5, cs.xp * (1 - (e.skills[cs.skill] ?? 1) / 26)).toFixed(1)} XP${blk ? ' — ' + blk : ''}`, act('Estudar', () => { const r = IND.takeCourse(st, cs.id); if (typeof r === 'string') say(r); else { say(null, r.up ? `Subiu de nível! ${IND.SKILL_NAMES[cs.skill]} +${r.up}` : 'Estudou! +XP'); render(); } }, !!blk), !!blk);
    });
    body.replaceChildren(statusHead(st), h('h3', {}, 'Suas habilidades'), skills, h('div', { class: 'small muted' }, 'Fazer jogos também ensina. Jams (Mundo → Mercado) rendem protótipos e XP. Tutoriais são grátis; cursos e mentorias são rápidos, mas custam dinheiro.'), h('h3', {}, 'Estudar'), chips, ...list);
  };
  render();
}

// =====================================================================
// PUBLICAR: projeto atual e jogos lançados
// =====================================================================
export function openPublish(tab) {
  const st0 = s(); tab ??= st0.project ? 'proj' : 'jogos';
  const body = h('div', {});
  const m = modal({ title: 'Publicar e Crescer', color: '#e0891a', size: 'mid', body, actions: [{ label: 'Fechar', fn: () => m.close() }] });
  const render = () => {
    const st = s(); const I = st.ind; const soc = SO.ensureSoc(st);
    const c = h('div', { class: 'col' });
    if (!I) { body.replaceChildren(h('div', { class: 'muted' }, 'Só no modo Indie.')); return; }
    if (tab === 'proj') {
      const p = st.project;
      if (!p) c.append(h('div', { class: 'muted' }, 'Sem projeto em andamento. Comece um jogo (botão Novo jogo) e volte aqui para preparar a página, a demo e a campanha.'));
      else {
        const pi = IND.projInd(p); const pr = IND.projectProg(p);
        c.append(h('div', { class: 'li' }, h('div', { class: 'grow' }, h('div', { class: 'nm' }, p.name), h('div', { class: 'small muted' }, `${Math.round(pr * 100)}% pronto · hype ${Math.round(p.hype)} · bugs ${Math.round(p.bugs)} · wishlists ${Math.round(soc.wl)}`))));
        const step = (ico, nome, desc, done, label, fn, dis) => c.append(li(`${ico} ${nome}`, desc, done ? h('span', { class: 'chip' }, 'feito') : act(label, fn, dis), done));
        c.append(h('h3', {}, 'Qualidade e escopo'));
        step('🧪', 'Playtest com amigos', 'Grátis · 3h · tira ~20% dos bugs e mostra o que falta.', !!pi.pt[`amigos${p.phase}`], 'Fazer', () => { const r = IND.playtest(st, 'amigos'); if (typeof r === 'string') say(r); else { say(null, r.msg); render(); } });
        step('🌐', 'Playtest online', `${money(150)} · 2h · tira ~38% dos bugs.`, !!pi.pt[`online${p.phase}`], 'Fazer', () => { const r = IND.playtest(st, 'online'); if (typeof r === 'string') say(r); else { say(null, r.msg); render(); } });
        step('✂️', 'Cortar escopo', 'Reduz o jogo em 15% (menos coisa, mais chance de terminar).', pi.cut, 'Cortar', () => { if (say(IND.cutScope(st), 'Escopo reduzido.')) render(); });
        step('🎞️', 'Vertical slice', 'Uma fase pronta e polida (30–80% do projeto). Atrai publishers e fãs.', pi.slice, 'Montar', () => { if (say(IND.verticalSlice(st), 'Vertical slice pronto!')) render(); });
        c.append(h('h3', {}, 'Página e demo na Stean'));
        step('🛒', 'Página da loja', `Taxa de publicação ${money(IND.STEAN_FEE)} (devolvida após ${money(IND.STEAN_REFUND_AT)} de vendas). Gera wishlists toda semana.`, !!pi.page, 'Criar', () => { if (say(IND.makePage(st), 'Página no ar!')) render(); });
        step('🎮', 'Demo jogável', 'Rende wishlists e é necessária para o festival de demos.', pi.demo, 'Lançar demo', () => { if (say(IND.makeDemo(st), 'Demo no ar!')) render(); });
        const fest = W.currentFestival(st);
        step('🎪', fest ? fest.nome : 'Festival de demos', fest ? 'Acontecendo agora! Muita visibilidade.' : 'Nenhum festival agora (veja Mundo → Mercado).', false, 'Participar', () => { const r = IND.joinFest(st); if (typeof r === 'string') say(r); else { say(null, `+${r.wl} wishlists!`); render(); } });
        c.append(h('h3', {}, 'Dinheiro e ajuda'));
        const cf = pi.crowd;
        if (cf) c.append(li(`💸 Crowdfunding (${C.CROWDFUNDING.find((x) => x.id === cf.plat).nome})`, cf.state === 'ativa' ? `Meta ${money(cf.goal)} · termina em ${dateStr(cf.due)}` : cf.state === 'financiada' ? `Financiada: ${money(cf.pledged)}!` : `Não bateu a meta (${money(cf.pledged)}).`, null));
        else c.append(h('div', { class: 'small b' }, '💸 Crowdfunding — escolha plataforma e meta'), ...C.CROWDFUNDING.map((pl) => h('div', { class: 'row wrap' }, h('span', { class: 'small', style: { minWidth: '80px' } }, `${pl.nome} (${Math.round(pl.taxa * 100)}%)`), [3000, 8000, 20000, 50000].map((g) => act(money(g), () => { if (say(IND.startCrowd(st, pl.id, g), 'Campanha no ar por 4 semanas.')) render(); }, false, '')))));
        for (const [id, f] of Object.entries(IND.FREELAS)) step('🧑‍🎨', f.nome, `${f.desc} (${money(f.custo)})`, !!pi.freelas[id], 'Contratar', () => { if (say(IND.hireFreela(st, id), 'Contratado!')) render(); });
        c.append(h('div', { class: 'row wrap' }, act('Redes sociais', () => { m.close(); G.UI.openSocial(); }, false, ''), act('Imprensa', () => { m.close(); G.UI.openPress(); }, false, '')));
      }
    } else {
      const games = st.games.filter((g) => g.ind).slice().reverse();
      if (!games.length) c.append(h('div', { class: 'muted' }, 'Você ainda não lançou nenhum jogo indie.'));
      for (const g of games) {
        const ind = g.ind; const stores = Object.entries(ind.stores);
        const last = stores.reduce((a, [, x]) => a + (x.last || 0), 0);
        c.append(h('div', { class: 'card' },
          h('div', { class: 'row' }, h('b', {}, g.name), h('span', { class: 'sp' }), h('span', { class: 'chip' }, `nota ${g.score.toFixed(1)}`), ind.ea ? h('span', { class: 'chip' }, 'Acesso Antecipado') : null),
          h('div', { class: 'small muted' }, `Lançado em ${dateStr(g.releaseWeek)} · ${g.weeks} sem. · ${g.sold} vendas · bruto ${money(g.gross)} · líquido ${money(g.net)}${ind.breakout ? ' · 🔥 estouro de vendas (' + ind.breakout + '×)' : ''}`),
          h('div', { class: 'small' }, `Reviews dos usuários: ${IND.posLabel(ind.pos)} (${Math.round(ind.pos * 100)}%) · bugs conhecidos ${Math.round(ind.bugs)} · última semana: ${last} vendas`),
          h('div', { class: 'small muted' }, stores.map(([id, x]) => `${id === 'hub' ? 'inch.io' : id === 'vapor' ? 'Stean' : id === 'mobile' ? 'Celular' : 'Console'} (${money(x.price)}, ${x.sold || 0} un.)`).join(' · ') + (ind.pub ? ` · publisher ${ind.pub.nome} (${ind.pub.recouped >= ind.pub.adv ? 'adiantamento pago' : 'recuperando ' + money(ind.pub.adv - ind.pub.recouped)})` : '')),
          h('div', { class: 'row wrap' },
            act('🏬 Lojas, idiomas e vendas', () => openGameStores(g, render), false, 'ok'),
            ind.ea ? act('Patch semanal (EA)', () => { if (say(IND.eaPatch(st, g.id), 'Patch semanal publicado!')) render(); }, false, '') : null,
            act('Patch', () => { if (say(IND.patch(st, g.id), 'Patch lançado!')) render(); }, false, ''),
            act('DLC', () => { if (say(IND.makeDlc(st, g.id), 'DLC lançada!')) render(); }, false, ''),
            ind.stores.vapor ? act('Desconto 25%', () => { if (say(IND.discount(st, g.id, 0.25), 'Desconto por 2 semanas.')) render(); }, false, '') : null,
            ind.stores.vapor && W.currentSale(st) ? act('Entrar na promoção', () => { if (say(IND.joinSale(st, g.id), 'Inscrito na promoção.')) render(); }, false, '') : null,
            ind.ea ? act('Lançar 1.0', () => { if (say(IND.relaunch10(st, g.id), 'Versão 1.0!')) render(); }, false, '') : null,
            )));
      }
    }
    body.replaceChildren(statusHead(st), tabsRow([['proj', 'Projeto atual'], ['jogos', 'Meus jogos']], tab, (t) => { tab = t; render(); }), c);
  };
  render();
}

const STORE_NAME = { hub: 'inch.io', vapor: 'Stean', mobile: 'Celular', switch: 'Nintendu eShop', console: 'Console', epik: 'Epik Store', gojo: 'GOJ' };
const STORE_COL = { hub: '#fa5c5c', vapor: '#1b2838', mobile: '#3da35d', switch: '#e60012', console: '#003791', epik: '#2a2a2a', gojo: '#7a3fd0' };
/** Tela de lojas do jogo: vendas por loja, listar em novas lojas, idiomas e patches do Acesso Antecipado. */
export function openGameStores(g, onClose) {
  const st = s(); const body = h('div', { class: 'col' });
  const m = modal({ title: `🏬 ${g.name}`, color: '#1b2838', size: 'mid', body, actions: [{ label: 'Fechar', fn: () => { m.close(); onClose?.(); } }] });
  const render = () => {
    const ind = g.ind; const mo = IND.MONET[ind.monet || 'premium'];
    const cards = Object.entries(ind.stores).map(([id, x]) => {
      const sp = h('div', { class: 'spark' }); sp.innerHTML = sparkline(x.hist && x.hist.length > 1 ? x.hist : [0, 0], STORE_COL[id] === '#1b2838' ? '#2fc4e6' : STORE_COL[id]);
      return h('div', { class: 'store-card' }, h('div', { class: 'store-head', style: { background: STORE_COL[id] || '#444' } }, h('b', {}, STORE_NAME[id] || id), h('span', {}, money(x.price))),
        h('div', { class: 'store-body' }, h('div', { class: 'small' }, `${numShort(x.sold || 0)} vendas · última semana ${x.last || 0} · corte ${Math.round(x.cut * 100)}%`), sp,
          h('div', { class: 'small muted' }, `Líquido estimado: ${money((x.sold || 0) * x.price * (mo.r || 1) * (1 - x.cut))}${x.born > st.week ? ` · estreia em ${x.born - st.week} sem.` : ''}`)));
    });
    const avail = Object.entries(IND.PORTS).filter(([pid]) => !ind.stores[pid]).map(([pid, P]) => {
      return li(`${P.nome}`, `${P.desc} Custo ${money(P.custo)} · ${P.h}h.`, act('Listar', () => { if (say(IND.port(st, g.id, pid), 'Jogo listado!')) render(); }, false, ''), false); });
    const langs = Object.entries(IND.LANGS).map(([id, L]) => { const cur = ind.loc?.[id]; const pending = cur && cur.ready > st.week;
      return li(`${L.ico} ${L.nome}`, cur ? (pending ? `Em tradução (pronta em ${cur.ready - st.week} sem.)` : `Pronta (${IND.LOC_Q[cur.q].nome.toLowerCase()}) · +${Math.round(L.gain * cur.eff * 100)}% de vendas base`) : `+${Math.round(L.gain * 100)}% de vendas base · profissional ${money(IND.locCost(st, g, id, 'pro'))} ou automática ${money(IND.locCost(st, g, id, 'ia'))}`,
        cur ? h('span', { class: 'chip' }, pending ? '...' : 'ok') : h('div', { class: 'row' }, act('Pro', () => { if (say(IND.localize(st, g.id, id, 'pro'), 'Tradução encomendada.')) render(); }, false, 'ok'), act('Auto', () => { if (say(IND.localize(st, g.id, id, 'ia'), 'Tradução automática encomendada.')) render(); }, false, '')), false); });
    body.replaceChildren(
      h('div', { class: 'small' }, `${mo.ico} ${mo.nome} · nota ${g.score.toFixed(1)} · usuários ${IND.posLabel(ind.pos)} (${Math.round(ind.pos * 100)}%) · vendas totais ×${IND.locMult(st, ind).toFixed(2)} por idiomas`),
      ind.ea ? h('div', { class: 'card' }, h('b', {}, 'Acesso Antecipado'), h('div', { class: 'small' }, `Sequência de patches semanais: ${ind.eaStreak || 0} (cada semana seguida +3% de vendas, até +30%). Sem patch por 3 semanas a comunidade perde a paciência.`), h('div', { class: 'row wrap' }, act('Patch semanal (5h)', () => { if (say(IND.eaPatch(st, g.id), 'Patch semanal publicado!')) render(); }, false, 'ok'), act('Lançar 1.0', () => { if (say(IND.relaunch10(st, g.id), 'Versão 1.0!')) render(); }, false, ''))) : null,
      h('h3', {}, 'Páginas nas lojas'), ...cards,
      avail.length ? h('h3', {}, 'Listar em mais lojas') : null, ...avail,
      h('h3', {}, 'Localização (idiomas)'), h('div', { class: 'small muted' }, 'Cada idioma leva 3 semanas; os próximos valem 80% do anterior. A automática custa 35% e rende 60%, com algumas gafes.'), ...langs);
  };
  render();
}

/** Assistente de publicação (substitui o botão "Lançar!" no modo indie). */
export function openPublishWizard(onDone) {
  const st = s(); const p = st.project; if (!p) return;
  const pi = IND.projInd(p); const soc = SO.ensureSoc(st);
  const pub = IND.defaultPub(p);
  const sc = M.previewScore(st, p).score;
  const offers = IND.publisherOffers(st, p, sc);
  const body = h('div', { class: 'col' });
  const m = modal({ title: `Publicar ${p.name}`, color: '#e0891a', size: 'mid', body, closable: true });
  const render = () => {
    const fee = pub.stores.vapor && !pi.page ? IND.STEAN_FEE : 0;
    body.replaceChildren(
      h('div', { class: 'small muted' }, `Wishlists acumuladas: ${Math.round(soc.wl)} · seguidores ${numShort(SO.totalFollowers(st))} · fãs ${Math.round(st.fans)} · página Stean: ${pi.page ? 'sim' : 'não'} · demo: ${pi.demo ? 'sim' : 'não'}`),
      pub.stores.vapor && !pi.page && soc.wl > 40 ? h('div', { class: 'warn' }, 'Sem página da Stean antes do lançamento, só ~30% das suas wishlists contam. Planeje isso no próximo jogo!') : null,
      h('h3', {}, 'Lojas'),
      li('inch.io (paródia de itch.io)', 'Aberta a todos, sem taxa de entrada. Fica com ~13% (10% + pagamento). Público pequeno e simpático.', h('button', { class: 'btn sm ' + (pub.stores.hub ? 'ok' : ''), onclick: () => { pub.stores.hub = !pub.stores.hub; render(); } }, pub.stores.hub ? 'Ativada' : 'Desativada')),
      pub.stores.hub ? h('div', { class: 'seg' }, Object.entries(IND.HUB_MODELS).map(([id, l]) => h('button', { class: pub.hubModel === id ? 'on' : '', onclick: () => { pub.hubModel = id; render(); } }, l))) : null,
      li('Stean (paródia de Steam)', `Maior loja de PC. Taxa de publicação ${money(IND.STEAN_FEE)} por jogo e ${Math.round(IND.STORE_CUT.vapor * 100)}% de corte. Wishlists viram vendas.`, h('button', { class: 'btn sm ' + (pub.stores.vapor ? 'ok' : ''), onclick: () => { pub.stores.vapor = !pub.stores.vapor; if (!pub.stores.vapor) pub.ea = false; render(); } }, pub.stores.vapor ? 'Ativada' : 'Desativada')),
      pub.stores.vapor ? li('Acesso Antecipado', 'Vende já com preço ~20% menor e vendas iniciais menores. Depois você pode lançar a versão 1.0 e ganhar um novo pico.', h('button', { class: 'btn sm ' + (pub.ea ? 'ok' : ''), onclick: () => { pub.ea = !pub.ea; render(); } }, pub.ea ? 'Sim' : 'Não')) : null,
      h('h3', {}, `Preço: ${money(pub.price)}`),
      h('input', { type: 'range', min: 4, max: 80, step: 1, value: pub.price, oninput: (e) => { pub.price = +e.target.value; document.getElementById('pubprice').textContent = money(pub.price); } }),
      h('div', { class: 'small muted', id: 'pubprice' }, money(pub.price)),
      h('div', { class: 'small muted' }, `Preço de referência para este tamanho: ${money({ micro: 8, pequeno: 18, medio: 30, grande: 45, aaa: 65 }[p.size])}. Mais caro vende menos; mais barato vende mais — mas ganha menos por venda.`),
      h('h3', {}, 'Como o jogo ganha dinheiro'),
      h('div', { class: 'col' }, Object.entries(IND.MONET).map(([id, mo]) => { const bad = id !== 'premium' && pub.stores.vapor; return h('button', { class: 'pick' + ((pub.monet || 'premium') === id ? ' set' : ''), disabled: bad ? true : null, style: (pub.monet || 'premium') === id ? { borderColor: '#e0891a' } : null, onclick: () => { pub.monet = id; render(); } }, h('span', {}, `${mo.ico} ${mo.nome}`), h('span', { class: 'v small' }, mo.desc + (bad ? ' (indisponível com a Stean)' : ''))); })),
      pub.monet === 'iap' ? h('div', { class: 'warn' }, `Microtransações: ${sc < 7 ? 'com nota abaixo de 7 o risco de polêmica dobra e as avaliações caem muito.' : 'risco moderado de polêmica nas primeiras semanas.'}`) : null,
      h('h3', {}, 'Publisher'),
      offers.length ? h('div', { class: 'col' }, offers.map((o) => h('button', { class: 'pick' + (pub.publisher?.id === o.id ? ' set' : ''), style: pub.publisher?.id === o.id ? { borderColor: '#e0891a' } : null, onclick: () => { pub.publisher = pub.publisher?.id === o.id ? null : o; render(); } }, h('span', {}, `${o.nome} — adiantamento ${money(o.adv)}`), h('span', { class: 'v' }, `${Math.round((1 - o.share) * 100)}% para você`)))) : h('div', { class: 'small muted' }, 'Nenhum publisher interessado ainda. Eles procuram vertical slice/página, boa nota (≥ 6,2) e wishlists ou fãs.'),
      pub.publisher ? h('div', { class: 'small muted' }, `${pub.publisher.desc} Eles recuperam o adiantamento com 100% da sua receita líquida; depois ficam com ${Math.round(pub.publisher.share * 100)}%. Em troca: marketing ×${pub.publisher.mkt}, menos bugs e portes pagos.`) : h('div', { class: 'small muted' }, 'Sem publisher você fica com 100% (menos as lojas), mas banca tudo sozinho.'),
      fee ? kv('Taxa da Stean agora', money(fee), 'neg') : null);
    m.setActions([{ label: 'Voltar', fn: () => m.close() }, { label: 'Publicar!', cls: 'pri', fn: () => { sfx.launch(); const r = M.releaseGame(st, pub); if (typeof r === 'string') { say(r); return; } m.close(); onDone(st.games[st.games.length - 1]); } }]);
  };
  render();
}

// =====================================================================
// CARREIRA
// =====================================================================
export function openCareer() {
  const body = h('div', { class: 'col' });
  const m = modal({ title: 'Carreira', color: '#3b82c4', size: 'mid', body, actions: [{ label: 'Fechar', fn: () => m.close() }] });
  const render = () => {
    const st = s(); const stage = IND.stageOf(st); const info = IND.STAGES[stage];
    const order = ['solo', 'dupla', 'pequeno', 'medio', 'grande'];
    const partner = st.employees.find((e) => e.partner);
    body.replaceChildren(
      h('div', { class: 'row wrap' }, order.map((id) => h('span', { class: 'chip', style: { background: id === stage ? '#3da35d' : '#9aa3b2' } }, IND.STAGES[id].nome))),
      h('div', { class: 'li' }, h('div', { class: 'grow' }, h('div', { class: 'nm' }, info.nome), h('div', { class: 'small muted' }, info.desc), h('div', { class: 'small' }, `Próximo passo: ${info.next}`))),
      kv('Equipe', `${st.employees.length} pessoa(s)`), kv('Jogos lançados', String(st.games.length)), kv('Receita total', money(st.stats.revenue)), kv('Fãs', numShort(st.fans)),
      h('h3', {}, 'Sócio(a)'),
      partner ? li(partner.name, `Sócio(a) — sem salário, fica com 20% do lucro líquido dos jogos. Habilidades: Des ${partner.skills.d} · Tec ${partner.skills.t} · Art ${partner.skills.g} · Som ${partner.skills.s}.`, null)
        : IND.partnerBlock(st) ? h('div', { class: 'small muted' }, IND.partnerBlock(st))
        : h('div', { class: 'col' }, IND.sociosDisponiveis(st).map((c) => li(`${c.name} — ${D.ROLES[c.role].nome}`, `Des ${c.skills.d} · Tec ${c.skills.t} · Art ${c.skills.g} · Som ${c.skills.s}. Sem salário: 20% do lucro.`, act('Convidar', () => { if (say(IND.hirePartner(st, c.id), 'Novo sócio!')) render(); })))),
      h('h3', {}, 'Escolhas de crescimento'),
      h('div', { class: 'small muted' }, '• Solo: controle total, ritmo lento, risco de burnout.\n• Sócio: divide lucro, dobra a produção.\n• Freelancers por jogo: pague só quando precisar (aba Publicar).\n• Contratar equipe e mudar de escritório (Estúdio): jogos médios e grandes, mas salários e aluguel pesam toda semana.\n• Publisher: adiantamento e marketing em troca de parte da receita.'),
      h('div', { class: 'row wrap' }, act('Equipe', () => { m.close(); G.UI.openTeam(); }, false, ''), act('Estúdio', () => { m.close(); G.UI.openStudio(); }, false, '')));
  };
  render();
}
