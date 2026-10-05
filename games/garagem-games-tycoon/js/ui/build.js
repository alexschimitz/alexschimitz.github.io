// Modo Construir/Decorar: painel sobre o mapa em grade (colocar, mover, girar, vender, melhorar, pintar, expandir).
import * as D from '../data.js';
import * as M from '../sim.js';
import * as MP from '../map.js';
import { money } from '../util.js';
import { sfx } from '../audio.js';
import { h, toast, $ } from './dom.js';
import { G } from './ctrl.js';

let bar = null, prevSpeed = 0;
const st = { tab: 'trabalho', sel: null, moving: null };
const s = () => G.s;
const ico = { whiteboard: '📋', painting: '🖼️', window: '🪟', poster: '📌', painting_l: '🖼️', frame_s: '🖼', clock: '🕐' };
export const isBuilding = () => !!bar;

export function effText(k) {
  const f = MP.FURN[k], e = f.eff || {}, out = [];
  if (e.deskQ) out.push(`+${Math.round(e.deskQ * 100)}% produção`);
  if (e.tech) out.push(`+${Math.round(e.tech * 100)}% Tecnologia`);
  if (e.art) out.push(`+${Math.round(e.art * 100)}% Arte`);
  if (e.snd) out.push(`+${Math.round(e.snd * 100)}% Som`);
  if (e.design) out.push(`+${(e.design * 100).toFixed(1).replace('.0', '')}% Design`);
  if (e.bug) out.push(`−${Math.round(e.bug * 100)}% bugs`);
  if (e.drain) out.push(`−${Math.round(e.drain * 100)}% cansaço`);
  if (e.rp) out.push(`+${e.rp} pesquisa/sem`);
  if (e.idle) out.push(`+${e.idle} energia parado`);
  if (e.mood) out.push(`humor +${e.mood}`);
  return out.join(' · ');
}
export function summary(state) {
  const fx = MP.effects(state); const bits = [`😊 Humor ${Math.round(fx.mood)}`];
  if (fx.upkeep) bits.push(`manutenção ${money(fx.upkeep)}/sem`);
  const warn = [];
  if (fx.missT) warn.push(`faltam ${fx.missT} banheiro(s)`); if (fx.missC) warn.push(`faltam ${fx.missC} copa/bebedouro(s)`);
  const n = state.employees.length; if (n > fx.desks) warn.push(`${n - fx.desks} sem mesa`);
  return { bits, warn };
}

function ghostFor(k, id, it, dir) {
  const o = G.office, f = MP.FURN[k];
  const g = { k, r: it ? it.r : 0, id: id || undefined, x: 0, y: 0, wl: it?.wl || 'R' };
  if (f.portal) g.to = MP.portalTarget(o.map, o.map.fl | 0, dir);
  if (it) { g.x = it.x; g.y = it.y; }
  else if (f.wall) { for (let q = 0; q < o.map.N; q += 0.5) if (!MP.canPlace(o.map, k, q, 0, 0, undefined, 'R')) { g.x = q; g.y = 0; break; } }
  else { const sp = MP.findSpot(o.map, k); if (sp) { g.x = sp[0]; g.y = sp[1]; } else { g.x = Math.floor(o.map.N / 2); g.y = Math.floor(o.map.N / 2); } }
  g.err = MP.checkGhost(o.map, g);
  return g;
}

export function openBuild(tab) {
  if (bar) { if (tab) { st.tab = tab; render(); } return; }
  if (!G.s) return;
  const o = G.office; prevSpeed = G.speed; G.speed = 0; G.refresh();
  o.mode = 'build'; o.ghost = null; o.selId = null; o.dirty = true; st.sel = null; st.moving = null; if (tab) st.tab = tab; st.insetDone = false;
  bar = h('div', { id: 'build-bar', class: 'card' }); $('#stage').append(bar); document.body.classList.add('building');
  o.onTap = onTap; o.onGhost = () => { renderAct(); };
  render();
}
export function closeBuild() {
  if (!bar) return; const o = G.office;
  bar.remove(); bar = null; o.mode = 'view'; o.ghost = null; o.selId = null; o.hideId = null; o.onTap = viewTap; o.onGhost = null; o.setInset(0, true); o.invalidate();
  document.body.classList.remove('building'); G.speed = prevSpeed; G.refresh(); G.save?.();
}
export function viewTap(info) {
  if (info.emp) { const e = info.emp; toast(`${e.name} · ${e.role === 'fundador' ? 'fundador(a)' : e.role} · energia ${Math.round(e.energy)}%`); return; }
  if (info.item) { const f = MP.FURN[info.item.k]; toast(`${f.nome}${effText(info.item.k) ? ' · ' + effText(info.item.k) : ''}`); }
}
function onTap(info) {
  const o = G.office;
  if (info.ghost) { confirmGhost(); return; }
  if (info.item) { st.sel = info.item.id; o.selId = info.item.id; sfx.click(); o.dirty = true; render(); return; }
  if (st.sel != null) { st.sel = null; o.selId = null; o.dirty = true; render(); }
}
function setGhost(g) {
  const o = G.office; o.ghost = g; o.hideId = g?.id ?? null; o.selId = g?.id ?? null; o.dirty = true;
  if (g) o.centerOnIfOff?.(g); render();
}
function confirmGhost() {
  const o = G.office, g = o.ghost; if (!g) return;
  const err = g.id != null ? MP.moveItem(s(), g.id, g.x, g.y, g.r, g.wl) : MP.buy(s(), g.k, g.x, g.y, g.r, g.wl, g.to);
  if (err) { toast(err[0].toUpperCase() + err.slice(1), 'ruim'); sfx.bad(); return; }
  sfx.coin(); const wasMove = g.id != null; st.sel = null; o.selId = null;
  o.ghost = null; o.hideId = null; o.invalidate(); G.refresh(); toast(wasMove ? 'Móvel movido.' : `${MP.FURN[g.k].nome} instalado(a)!`, 'bom'); render();
}

const TABS = [...MP.CATS.map(([id, l]) => [id, l]), ['pintura', '🎨 Pintura'], ['terreno', '🏗️ Terreno']];
function render() {
  if (!bar) return; const state = s(); const o = G.office;
  const sm = summary(state);
  const head = h('div', { class: 'bb-top' },
    h('b', {}, '🔨 Construir'),
    h('span', { class: 'bb-fx' }, sm.bits.join(' · '), sm.warn.length ? h('span', { class: 'bb-warn' }, ' ⚠ ' + sm.warn.join(', ')) : null),
    h('span', { class: 'bb-money' }, money(state.money)),
    h('button', { class: 'btn sm ok', onclick: () => { sfx.click(); closeBuild(); } }, 'Concluir'));
  const tabs = h('div', { class: 'bb-tabs' }, TABS.map(([id, l]) => h('button', { class: st.tab === id && !o.ghost && st.sel == null ? 'on' : '', onclick: () => { st.tab = id; st.sel = null; o.selId = null; setGhost(null); sfx.click(); } }, l)));
  const body = h('div', { class: 'bb-body' });
  bar.replaceChildren(head, tabs, body); bar.classList.toggle('act', !!o.ghost);
  if (o.ghost) renderAct(body);
  else if (st.sel != null) renderSel(body);
  else if (st.tab === 'pintura') renderPaint(body);
  else if (st.tab === 'terreno') renderLand(body);
  else renderCatalog(body);
  requestAnimationFrame(() => { if (bar) { o.setInset(bar.offsetHeight + 4, !st.insetDone); st.insetDone = true; } });
}
function renderFloors(body) {
  const state = s(), m = MP.ensureMap(state);
  const row = MP.FLOOR_ORDER.map((f) => {
    const has = m.floors.includes(f); const blk = has ? null : MP.floorBlock(state, f); const c = MP.floorCost(state, f);
    if (f === 0) return h('button', { class: 'bb-card on', disabled: true }, h('span', { class: 'bb-ico' }, '🏠'), h('b', {}, MP.FLOOR_NAMES[0]), h('span', { class: 'bb-eff' }, 'andar principal'));
    return h('button', { class: 'bb-card' + (has ? ' on' : blk ? ' lock' : ''), disabled: !has && blk ? true : null, onclick: () => { sfx.click(); if (has) { G.office.setFloor(f); render(); return; } if (!confirm(`Construir ${MP.FLOOR_NAMES[f]} por ${money(c)}? (inclui uma escada; aluguel extra por semana)`)) return; const e = MP.unlockFloor(state, f); if (e) { toast(e[0].toUpperCase() + e.slice(1), 'ruim'); sfx.bad(); } else { sfx.coin(); toast(`${MP.FLOOR_NAMES[f]} pronto!`, 'bom'); G.office.invalidate(); G.refresh(); G.office.setFloor(f); render(); } } },
      h('span', { class: 'bb-ico' }, f < 0 ? '🗄️' : '🏢'), h('b', {}, MP.FLOOR_NAMES[f]), h('span', { class: 'bb-cost' }, has ? 'ir para lá' : money(c)), h('span', { class: 'bb-eff' }, f < 0 ? 'Subsolo: racks de servidor rendem +50% e não fazem barulho.' : 'Mais espaço e mesas.'), !has && blk ? h('em', {}, blk) : null);
  });
  body.append(h('div', { class: 'bb-row' }, row));
}
function renderCatalog(body) {
  const state = s(), o = G.office; const infl = M.infl(state);
  if (st.tab === 'andares') renderFloors(body);
  const list = Object.keys(MP.FURN).filter((k) => MP.FURN[k].cat === st.tab && !MP.FURN[k].nosell);
  body.append(h('div', { class: 'bb-row' }, list.flatMap((k) => (MP.FURN[k].portal ? [['up', '▲ p/ cima'], ['down', '▼ p/ baixo']].filter(([d]) => MP.portalTarget(o.map, o.map.fl | 0, d) != null).map(([d, l]) => [k, d, l]) : [[k]])).map(([k, dir, dl]) => {
    const f = MP.FURN[k]; const c = MP.furnCost(k, infl);
    const lock = f.indie && state.mode !== 'indie' ? 'só no indie' : (f.min || 0) > state.office ? `exige ${D.OFFICES[f.min].nome}` : f.max && MP.boughtCount(o.map, k) >= f.max ? `limite ${f.max}` : state.money < c ? 'sem dinheiro' : '';
    const th = ico[k] ? h('span', { class: 'bb-ico' }, ico[k]) : o.thumb(k, 52);
    return h('button', { class: 'bb-card' + (lock ? ' lock' : ''), disabled: lock && lock !== 'sem dinheiro' ? true : null, onclick: () => { sfx.click(); setGhost(ghostFor(k, undefined, undefined, dir)); } },
      th, h('b', {}, f.nome, dl ? ' ' + dl : ''), h('span', { class: 'bb-cost' }, money(c), f.manut ? ` · ${money(f.manut)}/sem` : ''), h('span', { class: 'bb-eff' }, effText(k) || f.desc), lock ? h('em', {}, lock) : null);
  })));
  if (!list.length) body.append(h('div', { class: 'small muted' }, 'Nada nesta aba.'));
}
function renderAct(bodyIn) {
  const o = G.office, g = o.ghost; if (!g || !bar) return; const f = MP.FURN[g.k];
  const body = bodyIn || bar.querySelector('.bb-body'); if (!body) return;
  const c = g.id != null ? 0 : MP.furnCost(g.k, M.infl(s()));
  body.replaceChildren(h('div', { class: 'bb-act' },
    h('div', { class: 'bb-name' }, h('b', {}, g.id != null ? `Mover: ${f.nome}` : f.nome), h('span', { class: g.err ? 'bb-err' : 'bb-ok' }, g.err ? '✖ ' + g.err : '✔ Posição válida'), h('span', { class: 'small muted' }, 'Toque no mapa (ou arraste o móvel) para posicionar. Toque no móvel para confirmar.')),
    h('div', { class: 'bb-btns' },
      h('button', { class: 'btn ok', disabled: g.err ? true : null, onclick: confirmGhost }, g.id != null ? '✔ Mover aqui' : `✔ Colocar ${money(c)}`),
      f.wall ? h('button', { class: 'btn', onclick: () => { g.wl = g.wl === 'L' ? 'R' : 'L'; g.x = g.wl === 'R' ? Math.min(g.x || g.y, o.map.N - 1) : 0; g.y = g.wl === 'R' ? 0 : Math.max(2, Math.min(g.y || g.x, o.map.N - 1)); g.err = MP.checkGhost(o.map, g); o.dirty = true; renderAct(); } }, '⇄ Parede')
        : f.portal ? null : h('button', { class: 'btn', onclick: () => { g.r = ((g.r | 0) + 1) & 3; const { w, d } = MP.size(g); g.x = Math.min(g.x, o.map.N - w); g.y = Math.min(g.y, o.map.N - d); g.err = MP.checkGhost(o.map, g); o.dirty = true; sfx.click(); renderAct(); } }, '↻ Girar'),
      h('button', { class: 'btn', onclick: () => { setGhost(null); } }, 'Cancelar'))));
  bar.classList.add('act');
}
function renderSel(body) {
  const state = s(), o = G.office; const it = MP.floorItems(o.map).find((i) => i.id === st.sel);
  if (!it) { st.sel = null; o.selId = null; renderCatalog(body); return; }
  const f = MP.FURN[it.k]; const refund = it.base ? 0 : Math.round(MP.furnCost(it.k, M.infl(state)) * 0.5);
  const btns = f.portal ? [] : [h('button', { class: 'btn', onclick: () => setGhost(ghostFor(it.k, it.id, it)) }, f.wall ? '↔ Mover' : '✥ Mover')];
  if (!f.wall && !f.portal) btns.push(h('button', { class: 'btn', onclick: () => { const e = MP.rotateItem(state, it.id); if (e) { toast(e[0].toUpperCase() + e.slice(1), 'ruim'); sfx.bad(); } else { sfx.click(); o.invalidate(); render(); } } }, '↻ Girar'));
  if (f.seat) for (const to of ['desk_pro', 'desk_ultra']) if (to !== it.k && (!(MP.FURN[to].min) || MP.FURN[to].min <= state.office)) { const better = MP.FURN[to].eff.deskQ > MP.FURN[it.k].eff.deskQ; if (better) { const diff = MP.furnCost(to, M.infl(state)) - (it.base ? 0 : MP.furnCost(it.k, M.infl(state)) * 0.5); btns.push(h('button', { class: 'btn ok', onclick: () => { const e = MP.upgradeDesk(state, it.id, to); if (e) { toast(e[0].toUpperCase() + e.slice(1), 'ruim'); sfx.bad(); } else { sfx.coin(); toast('Estação melhorada!', 'bom'); o.invalidate(); G.refresh(); render(); } } }, `⬆ ${MP.FURN[to].nome.split(' (')[0]} ${money(Math.round(diff))}`)); } }
  if (!f.nosell) btns.push(h('button', { class: 'btn bad', onclick: () => { const e = MP.sellItem(state, it.id); if (e) { toast(e[0].toUpperCase() + e.slice(1), 'ruim'); sfx.bad(); } else { sfx.coin(); st.sel = null; o.selId = null; o.invalidate(); G.refresh(); render(); } } }, it.base ? '🗑 Remover' : `💰 Vender ${money(refund)}`));
  btns.push(h('button', { class: 'btn', onclick: () => { st.sel = null; o.selId = null; o.dirty = true; render(); } }, 'Fechar'));
  body.append(h('div', { class: 'bb-act' }, h('div', { class: 'bb-name' }, h('b', {}, f.nome, it.base ? ' (do imóvel)' : ''), h('span', { class: 'small' }, effText(it.k) || f.desc), f.manut ? h('span', { class: 'small muted' }, `Manutenção ${money(f.manut)}/sem`) : null), h('div', { class: 'bb-btns' }, btns)));
}
function renderPaint(body) {
  const state = s(), m = MP.ensureMap(state);
  const sw = (kind, set, cur, fnColor) => h('div', {}, h('div', { class: 'small muted' }, kind === 'wall' ? 'Paredes' : 'Piso'), h('div', { class: 'bb-row' }, Object.entries(set).map(([id, v]) => h('button', { class: 'bb-sw' + (cur === id ? ' on' : ''), onclick: () => { const e = MP.paint(state, kind, id); if (e) { toast(e[0].toUpperCase() + e.slice(1), 'ruim'); sfx.bad(); } else { sfx.coin(); G.office.invalidate(); G.refresh(); render(); } } },
    h('i', { style: { background: fnColor(v) } }), h('span', {}, v.nome), h('em', {}, v.custo ? money(v.custo) : 'grátis')))));
  body.append(sw('wall', MP.WALL_STYLES, m.wall, (v) => `linear-gradient(135deg,${v.R} 50%,${v.L} 50%)`), sw('floor', MP.FLOOR_STYLES, m.floor, (v) => `linear-gradient(135deg,${v.a} 50%,${v.b} 50%)`),
    h('div', { class: 'small muted' }, 'Quadros, janelas e pôsteres ficam na aba “Paredes”.'));
}
function renderLand(body) {
  const state = s(), m = MP.ensureMap(state); const c = MP.expandCost(state); const nx = D.OFFICES[state.office + 1];
  body.append(h('div', { class: 'bb-act' },
    h('div', { class: 'bb-name' }, h('b', {}, `Terreno ${m.N}×${m.N}`), h('span', { class: 'small' }, `${m.expand}/${MP.MAX_EXPAND} expansões · mais espaço para móveis e salas.`), m.storage.length ? h('span', { class: 'small' }, `Depósito: ${m.storage.length} móvel(is) sem lugar.`) : null),
    h('div', { class: 'bb-btns' }, h('button', { class: 'btn ok', disabled: m.expand >= MP.MAX_EXPAND ? true : null, onclick: () => { const e = MP.expandLand(state); if (e) { toast(e[0].toUpperCase() + e.slice(1), 'ruim'); sfx.bad(); } else { sfx.coin(); toast('Terreno ampliado!', 'bom'); G.office.invalidate(); G.office.fit(); G.refresh(); render(); } } }, m.expand >= MP.MAX_EXPAND ? 'No limite' : `Ampliar +1 ${money(c)}`),
      nx ? h('button', { class: 'btn', onclick: () => { closeBuild(); G.openUpgrade?.(); } }, `Mudar para ${nx.nome}`) : null)));
  if (m.storage.length) body.append(h('div', { class: 'bb-row' }, m.storage.map((it, i) => h('button', { class: 'bb-card', onclick: () => { const sp = MP.findSpot(m, it.k); const e = sp ? MP.placeFromStorage(state, i, sp[0], sp[1], 0) : 'sem espaço'; if (e) { toast(e[0].toUpperCase() + e.slice(1), 'ruim'); } else { G.office.invalidate(); render(); } } }, G.office.thumb(it.k, 44), h('b', {}, MP.FURN[it.k].nome), h('em', {}, 'Tirar do depósito')))));
}
