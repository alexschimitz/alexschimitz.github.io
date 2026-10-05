// Salvar/carregar: localStorage com múltiplos slots, exportar/importar texto, configurações.
import { dateStr } from './util.js';
import { newWorld, newFan } from './world.js';
import { newSocial } from './social.js';
import { newPress } from './press.js';
import { newIndie } from './indie.js';
import { defaultMap, ensureMap } from './map.js';
import { newCity } from './city.js';
import { ensureTeam, ensureEmp } from './team.js';
import { defaultBrand } from './modes.js';
import { newMarket } from './market.js';
import { ensureMedia } from './media.js';
import { ensureLegacy } from './legacy.js';
import { OFFICES } from './data.js';

export const SLOTS = 3;
const PREFIX = 'ggt:v1:';
export const DEFAULT_SETTINGS = { som: true, velocidade: 1, autosave: true, dicas: true, musica: true, volSfx: 0.8, volMus: 0.5, tema: 'auto', fonte: 1, contraste: false, movimento: true, perf: 'auto' };

function store(st) { return st || globalThis.localStorage; }
const key = (slot) => `${PREFIX}slot${slot}`;

export function metaOf(state) {
  return { nome: state.studio.nome, data: dateStr(state.week), dinheiro: Math.round(state.money), jogos: state.games.length, ts: Date.now(), over: !!state.over };
}
export function saveSlot(slot, state, st) {
  const payload = JSON.stringify({ meta: metaOf(state), state });
  store(st).setItem(key(slot), payload);
  return true;
}
export function loadSlot(slot, st) {
  const raw = store(st).getItem(key(slot));
  if (!raw) return null;
  try { const o = JSON.parse(raw); return migrate(o.state); } catch { return null; }
}
export function listSlots(st) {
  const out = [];
  for (let i = 1; i <= SLOTS; i++) {
    const raw = store(st).getItem(key(i));
    let meta = null;
    if (raw) { try { meta = JSON.parse(raw).meta; } catch { meta = null; } }
    out.push({ slot: i, meta });
  }
  return out;
}
export function deleteSlot(slot, st) { store(st).removeItem(key(slot)); }

/** Futuras migrações de versão entram aqui. */
export function migrate(state) {
  if (!state || typeof state !== 'object' || !state.studio || !Array.isArray(state.employees)) throw new Error('Save inválido');
  state.yearNet ??= 0;
  state.flags ??= { tutorial: false };
  // v1 -> v2: modo, mundo (feiras/tendências/manchetes) e fãs detalhados
  state.mode ??= 'classic';
  state.world ??= newWorld();
  state.fan ??= newFan();
  for (const k of Object.keys(newWorld())) state.world[k] ??= newWorld()[k];
  for (const k of Object.keys(newFan())) state.fan[k] ??= newFan()[k];
  state.fan.byGenre ??= {};
  if (!Object.keys(state.fan.byGenre).length) for (const g of state.games) state.fan.byGenre[g.genre] = (state.fan.byGenre[g.genre] || 0) + Math.max(5, g.fansGained || 0);
  // v2 -> v3: redes sociais e imprensa
  state.soc ??= newSocial();
  for (const k of Object.keys(newSocial())) state.soc[k] ??= newSocial()[k];
  for (const id of Object.keys(newSocial().nets)) state.soc.nets[id] ??= newSocial().nets[id];
  state.press ??= newPress();
  for (const k of Object.keys(newPress())) state.press[k] ??= newPress()[k];
  // v3 -> v4: modo indie (s.ind). Saves clássicos continuam clássicos.
  if (state.mode === 'indie') { state.ind ??= newIndie(); for (const k of Object.keys(newIndie())) state.ind[k] ??= newIndie()[k]; }
  // v4 -> v5: mapa em grade do estúdio
  if (!state.map) state.map = defaultMap(state.office || 0, state.mode, OFFICES[state.office || 0].vagas);
  state.city ??= newCity(); for (const k of Object.keys(newCity())) state.city[k] ??= newCity()[k];
  // v5 -> v6: andares (itens ganham fl; mapa ganha floors/fl), cidade viva (people/events/evSeen), rotação 0..3
  ensureMap(state);
  state.city.people ??= []; state.city.events ??= []; state.city.evSeen ??= {};
  // v6.1: equipe (traços, humor, cultura)
  ensureTeam(state); for (const e of state.employees) ensureEmp(e);
  // v6 -> v7: dificuldade, cenário, identidade do estúdio, mercado, mídia, legado e vida da equipe
  state.diff ??= 'normal'; state.scn ??= null;
  state.studio.brand = { ...defaultBrand(state.studio.nome), ...(state.studio.brand || {}) };
  state.mkt ??= newMarket(); for (const k of Object.keys(newMarket())) state.mkt[k] ??= newMarket()[k];
  ensureMedia(state); ensureLegacy(state); state.slife ??= { pending: null, cd: {}, last: -99, log: [], n: 0 };
  state.v = 7;
  return state;
}

// Exportar/importar: JSON -> base64 (UTF-8 seguro), com assinatura do jogo.
function toB64(str) {
  if (typeof Buffer !== 'undefined') return Buffer.from(str, 'utf8').toString('base64');
  return btoa(unescape(encodeURIComponent(str)));
}
function fromB64(b) {
  if (typeof Buffer !== 'undefined') return Buffer.from(b, 'base64').toString('utf8');
  return decodeURIComponent(escape(atob(b)));
}
export function exportString(state) {
  return 'GGT1:' + toB64(JSON.stringify({ game: 'garagem-games-tycoon', v: 1, state }));
}
export function importString(text) {
  const t = String(text || '').trim();
  if (!t.startsWith('GGT1:')) throw new Error('Código inválido (deve começar com GGT1:)');
  const o = JSON.parse(fromB64(t.slice(5)));
  if (o.game !== 'garagem-games-tycoon') throw new Error('Esse arquivo não é deste jogo');
  return migrate(o.state);
}

export function loadSettings(st) {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(store(st).getItem(PREFIX + 'settings') || '{}') }; } catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(cfg, st) { store(st).setItem(PREFIX + 'settings', JSON.stringify(cfg)); }
export const AUTOSAVE_SLOT = 1;

// Legado entre partidas: melhores estúdios que terminaram (falência ou aposentadoria), guardado à parte dos slots.
export function loadLegacy(st) { try { const a = JSON.parse(store(st).getItem(PREFIX + 'legacy') || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } }
export function pushLegacy(entry, st) {
  const a = loadLegacy(st); a.push(entry); a.sort((x, y) => y.score - x.score); const out = a.slice(0, 10);
  try { store(st).setItem(PREFIX + 'legacy', JSON.stringify(out)); } catch { /* sem espaço */ }
  return out;
}
