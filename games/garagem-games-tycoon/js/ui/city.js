// Tela do Mapa da Cidade (São Pixelo): mapa isométrico clicável, viagens, ações nos lugares e mudança de endereço.
import * as M from '../sim.js';
import * as CT from '../city.js';
import { CityMap } from '../citymap.js';
import { money } from '../util.js';
import { sfx } from '../audio.js';
import { h, modal, toast } from './dom.js';
import { G } from './ctrl.js';

const s = () => G.s;
const fail = (e) => { toast(e[0].toUpperCase() + e.slice(1), 'ruim'); sfx.bad(); };

export function openCity(select) {
  const body = h('div', { class: 'city-wrap' });
  const top = h('div', { class: 'city-top' });
  const stage = h('div', { class: 'city-stage' });
  const cv = h('canvas', { class: 'city-cv', 'aria-label': 'Mapa da cidade de São Pixelo' });
  const ctl = h('div', { class: 'city-ctl' },
    h('button', { 'aria-label': 'Aproximar', onclick: () => map.zoomAt(1.3) }, '+'), h('button', { 'aria-label': 'Afastar', onclick: () => map.zoomAt(1 / 1.3) }, '−'), h('button', { 'aria-label': 'Enquadrar', onclick: () => map.fit() }, '⌂'));
  stage.append(cv, ctl);
  const detail = h('div', { class: 'city-detail' });
  body.append(top, stage, detail);
  let raf = 0, sel = null, empId = null;
  const m = modal({ title: '🗺️ São Pixelo', color: '#3b82c4', size: 'wide city', body, actions: [{ label: 'Fechar', fn: () => m.close() }], onClose: () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onRes); } });
  const map = new CityMap(cv); G.cityMap = map; const onRes = () => map.resize(); window.addEventListener('resize', onRes);
  map.onSelect = (info) => { sfx.click(); if (!info) { sel = null; map.select(null); renderDetail(); return; } if (info.place) { sel = { place: info.place }; map.select(info.place); } else { sel = { district: info.district }; map.select(null); } renderDetail(); };

  const hh = (x) => { const hr = Math.floor(x), mi = Math.floor((x - hr) * 60 / 10) * 10; return `${String(hr).padStart(2, '0')}:${String(mi).padStart(2, '0')}`; };
  const clock = h('span', { class: 'ct-chip', 'data-clock': '' }); const wxc = h('span', { class: 'ct-chip', 'data-wx': '' });
  const evBar = h('div', { class: 'city-events' }); stage.before(evBar);
  const tickClock = () => { const hr = map.hr ?? map.hour(); const dl = map.daylight(hr); clock.textContent = `${dl <= 0 ? '🌙' : dl < 1 ? '🌇' : '🕑'} ${hh(hr)}`; const w = CT.WEATHER[map.wx || CT.weatherOf(s().week)]; wxc.textContent = `${w.ico} ${w.nome}`; };
  const renderEvents = () => {
    const st = s(); const evs = CT.eventsNow(st).filter((e) => !CT.ensureCity(st).evSeen[e.id]);
    evBar.replaceChildren(...(evs.length ? [h('span', { class: 'small muted' }, 'Eventos desta semana:'), ...evs.map((e) => { const K = CT.EVENT_KINDS[e.kind], pl = CT.PLACE_BY_ID[e.place]; return h('button', { class: 'ct-ev', onclick: () => { sel = { place: e.place }; map.select(e.place); renderDetail(); } }, `${K.ico} ${K.nome} · ${pl.ico} ${pl.nome}`); })] : [h('span', { class: 'small muted' }, 'Sem eventos abertos esta semana — volte na próxima.')]),
      h('button', { class: 'ct-ev', onclick: () => openContacts() }, `👥 Contatos (${CT.ensureCity(st).people.length}/${CT.NPCS.length})`));
  };
  const openContacts = () => {
    const st = s(); const c = CT.ensureCity(st); const bx = h('div', { class: 'ct-people' });
    if (!c.people.length) bx.append(h('div', { class: 'small muted' }, 'Você ainda não conhece ninguém. Vá a meetups, palestras, jams, cafés e à feira: pessoas da cidade viram contatos, mentores, sócios e investidores.'));
    for (const q of c.people) {
      const n = CT.NPC_BY_ID[q.id], R = CT.ROLES_NPC[n.papel];
      bx.append(h('div', { class: 'ct-person' }, h('span', { class: 'ct-ico' }, R.ico), h('div', {}, h('b', {}, n.nome), h('span', { class: 'small muted' }, ` · ${R.nome} · ${'♥'.repeat(q.rel)}${'♡'.repeat(5 - q.rel)}`), h('div', { class: 'small' }, n.desc), h('div', { class: 'small muted' }, R.perk), h('div', { class: 'small' }, '📍 Costuma estar em: ' + n.where.map((w) => CT.PLACE_BY_ID[w].nome).join(', ')))));
    }
    const cm = modal({ title: '👥 Contatos', color: '#8a5cc2', size: 'wide', body: bx, actions: [{ label: 'Fechar', fn: () => cm.close() }] });
  };
  const renderTop = () => {
    const st = s(), c = CT.ensureCity(st), d = CT.district(st); const hrs = Math.max(0, CT.WEEK_HOURS - (st.soc?.hours || 0)); const f = st.employees[0];
    top.replaceChildren(
      h('span', { class: 'ct-chip' }, `📍 ${d.ico} ${d.nome}`), h('span', { class: 'ct-chip' }, `Aluguel ×${d.rent.toFixed(2).replace(/0$/, '')}`),
      h('span', { class: 'ct-chip' + (hrs < 6 ? ' bad' : '') }, `⏱ ${Math.round(hrs)}h livres`), h('span', { class: 'ct-chip' + (f.energy < 25 ? ' bad' : '') }, `⚡ ${Math.round(f.energy)}%`),
      h('span', { class: 'ct-chip' }, `💰 ${money(st.money)}`), c.loan > 0 ? h('span', { class: 'ct-chip bad' }, `🏦 dívida ${money(c.loan)}`) : null, clock, wxc);
    tickClock(); renderEvents();
  };
  const actBtn = (pid, a) => {
    const tr = CT.travelInfo(s(), pid); const cost = a.cost + tr.cost, hrs = a.hours + tr.hours;
    return h('button', { class: 'ct-act' + (a.block ? ' lock' : ''), disabled: a.block ? true : null, onclick: () => run(pid, a) },
      h('b', {}, a.label), h('span', { class: 'small' }, a.desc), h('span', { class: 'ct-cost' }, `${cost ? money(cost) : 'grátis'} · ${hrs}h`, a.block ? h('em', {}, ' · ' + a.block) : null));
  };
  const run = (pid, a) => {
    const r = CT.act(s(), pid, a.id, { emp: empId }); if (r.err) { fail(r.err); return; }
    sfx.coin(); toast(r.msg, 'bom'); G.refresh(); map.setState(s()); renderTop(); renderDetail();
  };
  const renderDetail = () => {
    const st = s(); map.setState(st);
    if (!sel) { detail.replaceChildren(h('div', { class: 'small muted', style: { padding: '6px' } }, 'Toque num lugar do mapa para ver o que dá para fazer. Toque num bairro vazio para ver o aluguel e mudar a sede. Arraste para mover, pinça ou botões para o zoom.')); return; }
    if (sel.place) {
      const pl = CT.PLACE_BY_ID[sel.place], tr = CT.travelInfo(st, pl.id); const acts = CT.actions(st, pl.id);
      const head = h('div', { class: 'ct-head' }, h('span', { class: 'ct-ico' }, pl.ico), h('div', {}, h('b', {}, pl.nome), h('div', { class: 'small muted' }, pl.desc), pl.id !== 'home' ? h('div', { class: 'small' }, `🚌 ${tr.dist} quarteirões · ida e volta: ${tr.hours}h e ${money(tr.cost)}`) : null));
      const extra = [];
      if (pl.id === 'uni' && st.mode !== 'indie') {
        const free = st.employees.filter((e) => !e.training); if (!free.find((e) => e.id === empId)) empId = free[0]?.id;
        extra.push(h('label', { class: 'small' }, 'Quem vai: ', h('select', { onchange: (e) => { empId = e.target.value; renderDetail(); } }, free.map((e) => h('option', { value: e.id, selected: e.id === empId ? true : null }, `${e.name} (${e.role})`)))));
      }
      if (pl.id === 'home') { const d = CT.district(st); extra.push(h('div', { class: 'small' }, `Sede em ${d.nome}. ${d.perk}`), h('button', { class: 'btn sm', onclick: () => { m.close(); G.openBuild?.(); } }, '🔨 Construir / decorar o escritório')); }
      if (pl.id === 'publisher') extra.push(h('div', { class: 'small' }, `Relacionamento com publishers: ${CT.pubRel(st).toFixed(1).replace('.0', '')}/5`));
      detail.replaceChildren(head, ...extra, h('div', { class: 'ct-acts' }, acts.map((a) => actBtn(pl.id, a))));
    } else {
      const d = CT.DISTRICTS[sel.district]; const here = CT.ensureCity(st).home === d.id; const cost = CT.moveCost(st, d.id); const blk = CT.moveBlock(st, d.id);
      const rent = Math.round(require_rent(st) * d.rent);
      detail.replaceChildren(h('div', { class: 'ct-head' }, h('span', { class: 'ct-ico' }, d.ico), h('div', {}, h('b', {}, d.nome, here ? ' (sua sede)' : ''), h('div', { class: 'small muted' }, d.perk), h('div', { class: 'small' }, `Aluguel do imóvel atual neste bairro: ${money(rent)}/sem (×${d.rent})`))),
        here ? null : h('button', { class: 'ct-act' + (blk ? ' lock' : ''), disabled: blk ? true : null, onclick: () => { if (!confirm(`Mudar a sede para ${d.nome} por ${money(cost)}?`)) return; const e = CT.moveTo(s(), d.id); if (e) fail(e); else { sfx.level(); toast(`Sede em ${d.nome}!`, 'bom'); G.refresh(); renderTop(); renderDetail(); } } },
          h('b', {}, `🚚 Mudar a sede para ${d.nome}`), h('span', { class: 'small' }, 'A mudança leva 16h e muda o aluguel semanal e as vantagens do bairro.'), h('span', { class: 'ct-cost' }, `${money(cost)} · 16h`, blk ? h('em', {}, ' · ' + blk) : null)));
    }
  };
  const require_rent = (st) => M.officeOf ? M.officeOf(st).aluguel : 0;
  renderTop(); map.setState(s()); if (select) { sel = { place: select }; map.select(select); } renderDetail();
  let lastClk = 0; const loop = (now) => { map.draw(now); if (now - lastClk > 900) { lastClk = now; tickClock(); } raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop);
  setTimeout(() => map.resize(), 30);
  return m;
}
