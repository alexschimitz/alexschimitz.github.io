// Mapa em grade (tiles) do estúdio: móveis, custos, manutenção, efeitos na simulação e pathfinding (A*).
// Sem DOM. O jogo continua 2D isométrico (canvas), não 3D.
import { OFFICES } from './data.js';

export const BASE_N = [6, 8, 10, 14];
export const MAX_EXPAND = 4;
export const ENTRY = [[0, 0], [0, 1]]; // tiles livres junto à porta
export const FLOOR_STYLES = {
  concreto: { nome: 'Concreto', a: '#a2a6ab', b: '#979ba1', custo: 0 },
  taco: { nome: 'Taco de madeira', a: '#c9a26b', b: '#bf9760', custo: 600 },
  porcelanato: { nome: 'Porcelanato', a: '#dcdfe3', b: '#d0d4d9', custo: 900 },
  carpete: { nome: 'Carpete azul', a: '#7d9bc4', b: '#7392bc', custo: 700 },
  verde: { nome: 'Piso verde-água', a: '#8fc9c0', b: '#84bfb5', custo: 500 },
  xadrez: { nome: 'Xadrez', a: '#e8e2d0', b: '#4a5568', custo: 800 },
};
export const WALL_STYLES = {
  verde: { nome: 'Verde-sálvia', R: '#b9d8b0', L: '#a6c79e', trim: '#7f9d78', custo: 0 },
  creme: { nome: 'Creme', R: '#e9dcc0', L: '#d8cbb0', trim: '#b9a888', custo: 300 },
  azul: { nome: 'Azul-céu', R: '#cfe0ea', L: '#bcd0dc', trim: '#8fa9b8', custo: 300 },
  rosa: { nome: 'Rosa antigo', R: '#e6d3d8', L: '#d5c0c6', trim: '#a88c95', custo: 300 },
  grafite: { nome: 'Grafite', R: '#6b7685', L: '#596473', trim: '#3d4652', custo: 450 },
  laranja: { nome: 'Terracota', R: '#e5b08a', L: '#d19c76', trim: '#a8714a', custo: 450 },
};

// cat: trabalho | conforto | copa | salas | tech | decor | parede
// eff (apenas itens comprados/não-base contam): mood, tech, art, snd, design, bug, drain, rp, idle, deskQ
export const FURN = {
  desk: { nome: 'Mesa com PC básico', cat: 'trabalho', w: 2, d: 1, custo: 900, manut: 0, seat: true, eff: { deskQ: 0 }, desc: 'Uma pessoa trabalha aqui. Sem mesa, a produtividade cai 10%.' },
  desk_pro: { nome: 'Estação gamer (PC bom)', cat: 'trabalho', w: 2, d: 1, custo: 3200, manut: 10, seat: true, eff: { deskQ: 0.10 }, desc: 'Monitor duplo e cadeira ergonômica: +10% de produção de quem senta aqui.' },
  desk_ultra: { nome: 'Estação dupla (workstation)', cat: 'trabalho', w: 2, d: 1, custo: 7500, manut: 24, seat: true, eff: { deskQ: 0.18 }, min: 1, desc: '+18% de produção. Contas de luz salgadas.' },
  bed: { nome: 'Cama (home office)', cat: 'conforto', w: 2, d: 1, custo: 450, manut: 0, eff: { mood: 2, idle: 5 }, indie: true, desc: 'Dormir bem: +5 de energia por semana parado.' },
  shelf: { nome: 'Estante de livros', cat: 'trabalho', w: 2, d: 1, custo: 650, manut: 0, eff: { rp: 0.25, mood: 1, design: 0.01 }, max: 4, desc: 'Inspiração: +0,25 ponto de pesquisa por semana e um tico de design.' },
  qa: { nome: 'Bancada de testes', cat: 'tech', w: 2, d: 1, custo: 1800, manut: 8, eff: { bug: 0.06 }, max: 3, desc: '−6% de bugs gerados por bancada.' },
  server: { nome: 'Rack de servidor', cat: 'tech', w: 1, d: 1, custo: 4500, manut: 25, eff: { tech: 0.05, bug: 0.03 }, max: 3, min: 1, desc: 'Builds mais rápidas: +5% de Tecnologia por rack.' },
  audio: { nome: 'Cabine de gravação de áudio', cat: 'tech', w: 2, d: 2, custo: 6000, manut: 20, eff: { snd: 0.15 }, max: 1, min: 1, desc: '+15% de pontos de som e trilha.' },
  mocap: { nome: 'Estúdio de captura', cat: 'tech', w: 3, d: 2, custo: 12000, manut: 40, eff: { art: 0.18 }, max: 1, min: 2, desc: '+18% de pontos de arte e animação.' },
  meeting: { nome: 'Mesa de reunião', cat: 'salas', w: 3, d: 2, custo: 2200, manut: 2, eff: { design: 0.03, mood: 1 }, max: 2, min: 1, desc: '+3% de Design (com 3+ pessoas) por sala.' },
  whiteboard: { nome: 'Quadro branco', cat: 'parede', w: 1, d: 1, wall: true, custo: 250, manut: 0, eff: { design: 0.015 }, max: 2, desc: '+1,5% de Design por quadro.' },
  coffee: { nome: 'Copa com cafeteira', cat: 'copa', w: 2, d: 1, custo: 700, manut: 3, eff: { drain: 0.12, mood: 1.5 }, coffee: true, desc: 'Menos cansaço: atende até 6 pessoas.' },
  cooler: { nome: 'Bebedouro', cat: 'copa', w: 1, d: 1, custo: 150, manut: 0, eff: { mood: 0.8 }, coffee: true, desc: 'Barato e útil.' },
  vending: { nome: 'Máquina de salgadinhos', cat: 'copa', w: 1, d: 1, custo: 1200, manut: 4, eff: { mood: 3 }, min: 1, desc: 'A equipe adora.' },
  toilet: { nome: 'Banheiro', cat: 'conforto', w: 2, d: 2, custo: 2500, manut: 6, toilet: true, eff: { mood: 0 }, min: 1, desc: 'Necessário: 1 para cada 8 pessoas (a partir da sala comercial).' },
  sofa: { nome: 'Sofá', cat: 'conforto', w: 2, d: 1, custo: 900, manut: 0, eff: { mood: 4, idle: 2 }, max: 3, desc: 'Descanso entre uma build e outra.' },
  puff: { nome: 'Puff', cat: 'conforto', w: 1, d: 1, custo: 200, manut: 0, eff: { mood: 1.5 }, max: 6, desc: 'Fofo e barato.' },
  tv: { nome: 'TV com videogame', cat: 'conforto', w: 2, d: 1, custo: 1800, manut: 4, eff: { mood: 5 }, max: 2, desc: 'Humor da equipe lá em cima.' },
  plant: { nome: 'Planta', cat: 'decor', w: 1, d: 1, custo: 80, manut: 0, eff: { mood: 2.5 }, max: 6, desc: 'Ar mais leve e menos estresse.' },
  rug: { nome: 'Tapete', cat: 'decor', w: 3, d: 2, custo: 150, manut: 0, walk: true, eff: { mood: 1 }, max: 4, desc: 'Dá para andar por cima.' },
  bin: { nome: 'Lixeira', cat: 'decor', w: 1, d: 1, custo: 40, manut: 0, eff: { mood: 0.4 }, desc: 'Organização.' },
  painting: { nome: 'Quadro decorativo', cat: 'parede', w: 1, d: 1, wall: true, custo: 120, manut: 0, eff: { mood: 1.5 }, max: 4, desc: 'Personalize as paredes.' },
  window: { nome: 'Janela', cat: 'parede', w: 1, d: 1, wall: true, custo: 220, manut: 0, eff: { mood: 2 }, max: 4, desc: 'Luz natural.' },
  poster: { nome: 'Pôster', cat: 'parede', w: 1, d: 1, wall: true, custo: 60, manut: 0, eff: { mood: 0.6 }, desc: 'Barato e cheio de personalidade.' },
  painting_l: { nome: 'Quadro grande', cat: 'parede', w: 2, d: 1, ww: 2, wall: true, custo: 300, manut: 0, eff: { mood: 2.5 }, max: 3, desc: 'Ocupa 2 tiles de parede.' },
  frame_s: { nome: 'Moldura pequena', cat: 'parede', w: 1, d: 1, ww: 0.5, wall: true, custo: 40, manut: 0, eff: { mood: 0.3 }, max: 8, desc: 'Meio tile: cabe em qualquer vão.' },
  clock: { nome: 'Relógio de parede', cat: 'parede', w: 1, d: 1, ww: 0.5, wall: true, custo: 60, manut: 0, eff: { mood: 0.3 }, max: 2, desc: 'Prazos à vista.' },
  stairs: { nome: 'Escada', cat: 'andares', w: 2, d: 1, portal: true, custo: 3500, manut: 5, eff: {}, desc: 'Liga dois andares. Instale e ela aparece nos dois.' },
  elevator: { nome: 'Elevador', cat: 'andares', w: 1, d: 1, portal: true, custo: 9000, manut: 30, eff: {}, min: 2, desc: 'Ocupa 1 tile nos dois andares; a equipe sobe mais rápido.' },
  car: { nome: 'Carro sob a lona', cat: 'decor', w: 4, d: 2, custo: 0, manut: 0, eff: {}, nosell: true, desc: 'Herança da garagem. Ninguém sabe o que tem aí embaixo.' },
};
export const CATS = [['trabalho', 'Trabalho'], ['tech', 'Tecnologia'], ['salas', 'Salas'], ['copa', 'Copa'], ['conforto', 'Conforto'], ['decor', 'Decoração'], ['parede', 'Paredes'], ['andares', 'Andares']];
export const FLOOR_NAMES = { '-1': 'Subsolo', 0: 'Térreo', 1: '2º andar', 2: '3º andar' };
export const FLOOR_ORDER = [-1, 0, 1, 2];
const flOf = (it) => it.fl | 0;
/** Itens do andar ativo (ou do andar f). */
export const floorItems = (m, f = m.fl | 0) => m.items.filter((i) => flOf(i) === f);
const ww = (k) => FURN[k].ww || 1;
export const furnCost = (k, infl = 1) => Math.round(FURN[k].custo * (0.7 + 0.3 * infl) / 10) * 10;

// ---------------------------------------------------------------- modelo
/** Rotação real em 4 direções (r = 0..3); r ímpar troca largura e profundidade. */
export function size(it) { const f = FURN[it.k]; return (it.r & 1) ? { w: f.d, d: f.w } : { w: f.w, d: f.d }; }
/** Tile da cadeira (macio: andável) de uma mesa: N-direita, O-baixo, S-esquerda, L-cima conforme r. */
export function chairTile(it) { const r = it.r & 3; return r === 0 ? [it.x + 1, it.y - 1] : r === 1 ? [it.x - 1, it.y + 1] : r === 2 ? [it.x, it.y + 1] : [it.x + 1, it.y]; }
/** Ponto onde a pessoa senta (coordenadas do piso). */
export function seatPoint(it) { const r = it.r & 3; return r === 0 ? [it.x + 1, it.y - 0.2] : r === 1 ? [it.x - 0.2, it.y + 1] : r === 2 ? [it.x + 1, it.y + 1.2] : [it.x + 1.2, it.y + 1]; }
/** A pessoa fica de costas para a câmera quando a cadeira está do lado de baixo (r = 2 ou 3). */
export const seatBack = (it) => (it.r & 3) >= 2;
function tilesOf(it) {
  const { w, d } = size(it); const out = [];
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) out.push([it.x + i, it.y + j]);
  return out;
}
export function newMap(level, mode) {
  return { v: 2, level, N: BASE_N[level], items: [], storage: [], nid: 1, wall: 'verde', floor: 'concreto', expand: 0, mode: mode || 'classic', floors: [0], fl: 0 };
}
function add(m, k, x, y, r = 0, base = true) { const it = { id: m.nid++, k, x, y, r, base }; m.items.push(it); return it; }
export function defaultMap(level, mode, vagas) {
  const m = newMap(level, mode);
  const indie = mode === 'indie';
  const N = m.N;
  const rows = (nRows, perRow, y0) => { let c = 0; for (let r = 0; r < nRows; r++) for (let i = 0; i < perRow; i++) { if (c >= vagas) return; add(m, 'desk', 1 + i * 2, y0 + r * 2); c++; } };
  m.wall = indie && level === 0 ? 'creme' : ['verde', 'creme', 'azul', 'rosa'][level];
  m.floor = indie && level === 0 ? 'taco' : ['concreto', 'verde', 'verde', 'verde'][level];
  if (level === 0) {
    if (indie) {
      add(m, 'desk', 1, 2); add(m, 'desk', 3, 2); add(m, 'bed', 3, 4); add(m, 'shelf', 3, 0); add(m, 'plant', 5, 0); add(m, 'rug', 1, 4); add(m, 'bin', 5, 3);
      add(m, 'poster', 4, 0); add(m, 'window', 1, 0);
    } else {
      add(m, 'desk', 1, 2); add(m, 'desk', 3, 2); add(m, 'car', 1, 4); add(m, 'bin', 5, 1); add(m, 'rug', 3, 0); add(m, 'poster', 3, 0); 
    }
  } else if (level === 1) {
    rows(2, 3, 2); add(m, 'plant', 7, 0); add(m, 'plant', 7, 7); add(m, 'cooler', 5, 0); add(m, 'bin', 6, 4); add(m, 'toilet', 5, 5); add(m, 'coffee', 3, 0);
    add(m, 'window', 3, 0); add(m, 'poster', 5, 0, 0); add(m, 'rug', 1, 6);
  } else if (level === 2) {
    rows(3, 4, 2); add(m, 'toilet', 1, 8); add(m, 'toilet', 3, 8); add(m, 'coffee', 5, 8); add(m, 'cooler', 7, 8); add(m, 'sofa', 8, 8); add(m, 'plant', 9, 0); add(m, 'plant', 9, 3);
    add(m, 'vending', 9, 4); add(m, 'puff', 9, 6); add(m, 'puff', 9, 7); add(m, 'bin', 0, 9); add(m, 'window', 2, 0); add(m, 'window', 4, 0);
  } else {
    rows(5, 5, 2); add(m, 'toilet', 1, 12); add(m, 'toilet', 3, 12); add(m, 'toilet', 5, 12); add(m, 'coffee', 7, 12); add(m, 'coffee', 9, 12); add(m, 'cooler', 12, 7); add(m, 'cooler', 13, 10); add(m, 'sofa', 11, 12);
    add(m, 'meeting', 11, 2); add(m, 'meeting', 11, 5); add(m, 'tv', 11, 8); add(m, 'vending', 13, 9); add(m, 'puff', 12, 10); add(m, 'plant', 13, 0); add(m, 'plant', 13, 12); add(m, 'plant', 0, 13);
    add(m, 'window', 2, 0); add(m, 'window', 4, 0); add(m, 'window', 6, 0);
  }
  // itens de parede ficam na linha/coluna 0
  for (const it of m.items) if (FURN[it.k].wall) { it.wl = 'R'; it.y = 0; }
  // sanidade: remove o que não couber / colidir
  const ok = [];
  const occ = new Set();
  for (const it of m.items) {
    if (FURN[it.k].wall) { ok.push(it); continue; }
    const ts = tilesOf(it); const chair = FURN[it.k].seat ? [chairTile(it)] : [];
    if (ts.some(([x, y]) => x < 0 || y < 0 || x >= N || y >= N || occ.has(x + ',' + y)) || chair.some(([x, y]) => x < 0 || y < 0 || occ.has(x + ',' + y))) continue;
    if (!FURN[it.k].walk) for (const [x, y] of ts) occ.add(x + ',' + y);
    ok.push(it);
  }
  m.items = ok;
  return m;
}
export function ensureMap(s) {
  const lvl = s.office;
  if (!s.map) { s.map = defaultMap(lvl, s.mode, OFFICES[lvl].vagas); }
  const m = s.map; if (!m.floors) { m.floors = [0]; m.fl = 0; m.v = 2; } if (m.fl == null || !m.floors.includes(m.fl)) m.fl = 0;
  return m;
}

// ---------------------------------------------------------------- ocupação e validação
export function blockedSet(m, ignoreId, fl = m.fl | 0) {
  const b = new Set(); const chairs = new Set();
  for (const it of m.items) {
    if (flOf(it) !== fl) continue;
    if (ignoreId != null && it.id === ignoreId) continue; const f = FURN[it.k];
    if (f.wall) continue;
    if (!f.walk) for (const [x, y] of tilesOf(it)) b.add(x + ',' + y);
    if (f.seat) { const [cx, cy] = chairTile(it); chairs.add(cx + ',' + cy); }
  }
  return { b, chairs };
}
export const wallSlot = (it) => (it.wl === 'L' ? 'L' + it.y : 'R' + it.x);
const wpos = (it) => (it.wl === 'L' ? it.y : it.x);
const snap = (v) => Math.round(v * 2) / 2;
export function canPlace(m, k, x, y, r, ignoreId, wl) {
  const f = FURN[k]; if (!f) return 'item inválido';
  if (f.wall) {
    const side = wl === 'L' ? 'L' : 'R', slot = snap(side === 'L' ? y : x), wd = ww(k);
    if (!(m.floors || [0]).includes(m.fl | 0)) return 'andar inexistente';
    if (slot < 0 || slot + wd > m.N + 1e-9) return 'fora da parede';
    if (side === 'L' && (m.fl | 0) === 0 && slot < 2 && slot + wd > 0.7) return 'a porta está aqui';
    if (m.items.some((q) => q.id !== ignoreId && flOf(q) === (m.fl | 0) && FURN[q.k].wall && (q.wl === 'L' ? 'L' : 'R') === side && wpos(q) < slot + wd - 1e-9 && wpos(q) + ww(q.k) > slot + 1e-9)) return 'já há algo nesse trecho da parede';
    return null;
  }
  if (!(m.floors || [0]).includes(m.fl | 0)) return 'andar inexistente';
  const it = { k, x, y, r, fl: m.fl | 0 };
  const { b, chairs } = blockedSet(m, ignoreId);
  for (const [tx, ty] of tilesOf(it)) {
    if (tx < 0 || ty < 0 || tx >= m.N || ty >= m.N) return 'fora do terreno';
    if (!f.walk && (b.has(tx + ',' + ty) || chairs.has(tx + ',' + ty))) return 'espaço ocupado';
    if (!f.walk && (m.fl | 0) === 0 && ENTRY.some(([ex, ey]) => ex === tx && ey === ty)) return 'bloqueia a porta';
  }
  if (f.seat) {
    const [cx, cy] = chairTile(it);
    if (cx < 0 || cy < 0 || cx >= m.N || cy >= m.N) return 'a cadeira ficaria fora da sala';
    if (b.has(cx + ',' + cy) || chairs.has(cx + ',' + cy)) return 'sem espaço para a cadeira';
  }
  if (!f.walk) { // não pode isolar nada: precisa continuar alcançável a partir da porta
    const trial = { ...m, items: m.items.filter((q) => q.id !== ignoreId).concat([it]) };
    const bad = unreachable(trial);
    if (bad) return 'bloquearia o caminho até ' + bad;
  }
  return null;
}
export function entryTiles(m, b, f = m.fl | 0) {
  if (f === 0) return [[0, 1]];
  const out = [];
  for (const it of m.items) if (flOf(it) === f && FURN[it.k].portal) for (const [x, y] of tilesOf(it)) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < m.N && ny < m.N && !b.has(nx + ',' + ny)) out.push([nx, ny]); }
  return out;
}
export function reachSet(m, b, f = m.fl | 0) {
  const seen = new Set(); const q = entryTiles(m, b, f); for (const [x, y] of q) seen.add(x + ',' + y);
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, key = nx + ',' + ny;
      if (nx < 0 || ny < 0 || nx >= m.N || ny >= m.N || seen.has(key) || b.has(key)) continue;
      seen.add(key); q.push([nx, ny]);
    }
  }
  return seen;
}
function unreachable(m) {
  const fl = m.fl | 0; const { b } = blockedSet(m, undefined, fl);
  const seen = reachSet(m, b, fl);
  for (const it of m.items) {
    if (flOf(it) !== fl) continue;
    const f = FURN[it.k]; if (f.wall || f.walk) continue;
    if (f.seat) { const [cx, cy] = chairTile(it); if (!seen.has(cx + ',' + cy)) return 'uma mesa'; }
    else if (!approach(m, it, seen)) return FURN[it.k].nome.toLowerCase();
  }
  return null;
}
function approach(m, it, seen) {
  for (const [x, y] of tilesOf(it)) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (seen.has((x + dx) + ',' + (y + dy))) return true;
  return false;
}
export function countOf(m, k) { return m.items.filter((i) => i.k === k).length; }
export function boughtCount(m, k) { return m.items.filter((i) => i.k === k && !i.base).length; }
const on = (m, f, fn) => { const o = m.fl; m.fl = f; try { return fn(); } finally { m.fl = o; } };

// ---------------------------------------------------------------- compra / mover / vender
const placeWall = (it, x, y, wl) => { it.wl = wl === 'L' ? 'L' : 'R'; if (it.wl === 'R') { it.x = snap(x); it.y = 0; } else { it.x = 0; it.y = snap(y); } };
/** Andar vizinho (acima, se existir; senão abaixo) para ligar escadas. */
export function portalTarget(m, f = m.fl | 0, dir) {
  const up = FLOOR_ORDER.filter((q) => q > f && m.floors.includes(q)).sort((a, b) => a - b)[0];
  const down = FLOOR_ORDER.filter((q) => q < f && m.floors.includes(q)).sort((a, b) => b - a)[0];
  if (dir === 'up') return up ?? null; if (dir === 'down') return down ?? null;
  return up ?? down ?? null;
}
/** Valida um portal nos dois andares (retorna erro ou null). */
export function canPlacePortal(m, k, x, y, r, to, ignoreLk) {
  if (to == null || !m.floors.includes(to)) return 'não há outro andar para ligar';
  const f0 = m.fl | 0;
  const e1 = canPlace(m, k, x, y, r, undefined); if (e1) return e1;
  const e2 = on(m, to, () => canPlace(m, k, x, y, r, undefined)); if (e2) return 'no outro andar: ' + e2;
  return null;
}
/** Validação de um fantasma de construção (móvel comum, de parede ou portal). */
export function checkGhost(m, g) {
  const f = FURN[g.k]; if (!f) return 'item inválido';
  if (f.portal && g.id == null) return canPlacePortal(m, g.k, g.x, g.y, g.r, g.to ?? portalTarget(m));
  return canPlace(m, g.k, g.x, g.y, g.r, g.id, g.wl);
}
export function buy(s, k, x, y, r = 0, wl, to) {
  const m = ensureMap(s); const f = FURN[k];
  if (!f) return 'item inválido';
  if (f.indie && s.mode !== 'indie') return 'só no modo indie';
  if ((f.min || 0) > s.office) return `exige ${OFFICES[f.min].nome}`;
  if (f.max && boughtCount(m, k) >= f.max) return `limite de ${f.max} (efeito)`;
  const fl = m.fl | 0;
  if (f.portal) {
    const tgt = to ?? portalTarget(m, fl); const err = canPlacePortal(m, k, x, y, r, tgt); if (err) return err;
    const c = furnCost(k, api.infl(s)); if (s.money < c) return 'sem dinheiro';
    api.spend(s, 'decoração', c);
    const lk = m.nid++;
    m.items.push({ id: m.nid++, k, x, y, r, base: false, fl, lk }, { id: m.nid++, k, x, y, r, base: false, fl: tgt, lk });
    return null;
  }
  const err = canPlace(m, k, x, y, r, undefined, wl); if (err) return err;
  const c = furnCost(k, api.infl(s));
  if (s.money < c) return 'sem dinheiro';
  api.spend(s, 'decoração', c);
  const it = { id: m.nid++, k, x, y, r, base: false, fl };
  if (f.wall) placeWall(it, x, y, wl);
  m.items.push(it); return null;
}
export function moveItem(s, id, x, y, r, wl) {
  const m = ensureMap(s); const it = m.items.find((i) => i.id === id); if (!it) return 'item inexistente';
  const f = FURN[it.k]; if (f.portal) return 'escadas e elevadores não se movem: venda e instale de novo';
  return on(m, flOf(it), () => {
    if (f.wall) { const e = canPlace(m, it.k, x, y, 0, id, wl); if (e) return e; placeWall(it, x, y, wl); return null; }
    const rot = r == null ? it.r : r;
    const err = canPlace(m, it.k, x, y, rot, id); if (err) return err;
    it.x = x; it.y = y; it.r = rot; return null;
  });
}
export function rotateItem(s, id) {
  const m = ensureMap(s); const it = m.items.find((i) => i.id === id); if (!it) return 'item inexistente';
  if (FURN[it.k].wall) return 'itens de parede não giram';
  if (FURN[it.k].portal) return 'escadas e elevadores não giram';
  return on(m, flOf(it), () => {
    let first = null;
    for (let i = 1; i < 4; i++) { const r = ((it.r | 0) + i) & 3; const err = canPlace(m, it.k, it.x, it.y, r, id); if (!err) { it.r = r; return null; } first = first || err; }
    return 'não há espaço para girar: ' + first;
  });
}
/** Andares ligados ao térreo por escadas/elevadores. */
export function connectedFloors(m) {
  const seen = new Set([0]); let ch = true;
  while (ch) { ch = false; const by = {}; for (const it of m.items) if (FURN[it.k].portal) (by[it.lk] = by[it.lk] || []).push(flOf(it));
    for (const fs of Object.values(by)) if (fs.some((q) => seen.has(q))) for (const q of fs) if (!seen.has(q)) { seen.add(q); ch = true; } }
  return seen;
}
export function sellItem(s, id) {
  const m = ensureMap(s); const i = m.items.findIndex((q) => q.id === id); if (i < 0) return 'item inexistente';
  const it = m.items[i]; const f = FURN[it.k];
  if (f.nosell) return 'este item não pode ser vendido';
  const ids = f.portal ? m.items.filter((q) => q.lk === it.lk).map((q) => q.id) : [id];
  const rest = m.items.filter((q) => !ids.includes(q.id));
  if (f.portal) { const probe = { ...m, items: rest }; const con = connectedFloors(probe); for (const q of rest) if (!con.has(flOf(q)) && !FURN[q.k].wall) return 'ainda há móveis num andar que ficaria isolado'; }
  else if (!f.wall) { const probe = { ...m, items: rest }; if (on(probe, flOf(it), () => unreachable(probe))) return 'remover isso isolaria outro móvel'; }
  const refund = it.base ? 0 : Math.round(furnCost(it.k, api.infl(s)) * 0.5);
  if (refund) api.earn(s, refund);
  m.items = rest; return null;
}
// ---------------------------------------------------------------- andares
export const FLOOR_COST = { '-1': 18000, 1: 25000, 2: 60000 };
export const floorMin = (f) => (f === 2 ? 2 : 1);
export function floorRent(m, office = 0) { return (m.floors.length - 1) * (100 + 150 * office); }
export function floorCost(s, f) { return Math.round((FLOOR_COST[f] || 0) * (0.7 + 0.3 * api.infl(s)) / 100) * 100; }
export function floorBlock(s, f) {
  const m = ensureMap(s);
  if (!FLOOR_COST[f]) return 'andar inválido'; if (m.floors.includes(f)) return 'já existe';
  if (s.office < floorMin(f)) return `exige ${OFFICES[floorMin(f)].nome}`;
  if (f === 2 && !m.floors.includes(1)) return 'construa o 2º andar antes';
  return null;
}
export function unlockFloor(s, f) {
  const m = ensureMap(s); const blk = floorBlock(s, f); if (blk) return blk;
  const c = floorCost(s, f); if (s.money < c) return 'sem dinheiro';
  const from = f < 0 ? 0 : f - 1 || 0; const base = f === 2 ? 1 : 0;
  // posição da escada no andar de origem: primeiro lugar livre nos dois andares
  m.floors.push(f); m.floors.sort((a, b) => a - b);
  const o = m.fl; m.fl = base; let spot = null;
  for (let y = 0; y < m.N && !spot; y++) for (let x = 0; x < m.N && !spot; x++) if (!canPlacePortal(m, 'stairs', x, y, 0, f)) spot = [x, y];
  if (!spot) { m.floors = m.floors.filter((q) => q !== f); m.fl = o; return 'sem espaço para a escada no andar de origem'; }
  api.spend(s, 'obra', c);
  const lk = m.nid++;
  m.items.push({ id: m.nid++, k: 'stairs', x: spot[0], y: spot[1], r: 0, base: true, fl: base, lk }, { id: m.nid++, k: 'stairs', x: spot[0], y: spot[1], r: 0, base: true, fl: f, lk });
  m.fl = o; void from; return null;
}
export function setFloor(s, f) { const m = ensureMap(s); if (!m.floors.includes(f)) return false; m.fl = f; return true; }
/** Rota entre andares: lista de saltos [{from, to, a:[x,y] (tile de uso no andar from), b:[x,y] (no andar to)}] ou null. */
export function floorRoute(m, f0, f1) {
  if (f0 === f1) return [];
  const links = {}; for (const it of m.items) if (FURN[it.k].portal) (links[it.lk] = links[it.lk] || []).push(it);
  const prev = new Map([[f0, null]]); const q = [f0];
  while (q.length) { const f = q.shift(); if (f === f1) break;
    for (const pair of Object.values(links)) { const a = pair.find((i) => flOf(i) === f); const b = pair.find((i) => flOf(i) !== f); if (a && b && !prev.has(flOf(b))) { prev.set(flOf(b), { f, a, b }); q.push(flOf(b)); } } }
  if (!prev.has(f1)) return null;
  const hops = []; let cur = f1; while (prev.get(cur)) { const { f, a, b } = prev.get(cur); hops.unshift({ from: f, to: cur, a, b }); cur = f; }
  const out = hops.map((h) => ({ from: h.from, to: h.to, a: useTile(m, blockedSet(m, undefined, h.from).b, h.a), b: useTile(m, blockedSet(m, undefined, h.to).b, h.b), lk: h.a.lk }));
  return out.every((h) => h.a && h.b) ? out : null;
}
export const portalDir = (m, it) => { const o = m.items.find((q) => q.lk === it.lk && q.id !== it.id); return o ? Math.sign(flOf(o) - flOf(it)) : 0; };
export function upgradeDesk(s, id, to) {
  const m = ensureMap(s); const it = m.items.find((q) => q.id === id); if (!it || !FURN[it.to ?? it.k]?.seat) return 'só mesas podem ser melhoradas';
  const f = FURN[to]; if (!f?.seat) return 'inválido'; if (to === it.k) return 'já é esse modelo';
  if ((f.min || 0) > s.office) return `exige ${OFFICES[f.min].nome}`;
  const diff = furnCost(to, api.infl(s)) - (it.base ? 0 : furnCost(it.k, api.infl(s)) * 0.5);
  if (s.money < diff) return 'sem dinheiro';
  api.spend(s, 'decoração', Math.round(diff)); it.k = to; it.base = false; return null;
}
export function paint(s, kind, id) {
  const m = ensureMap(s);
  const set = kind === 'wall' ? WALL_STYLES : FLOOR_STYLES;
  if (!set[id]) return 'estilo inválido'; if ((kind === 'wall' ? m.wall : m.floor) === id) return 'já é esse';
  if (s.money < set[id].custo) return 'sem dinheiro';
  if (set[id].custo) api.spend(s, 'decoração', set[id].custo);
  if (kind === 'wall') m.wall = id; else m.floor = id; return null;
}
export function expandCost(s) { const m = ensureMap(s); return Math.round(900 * m.N * (1 + m.expand * 0.4) * (0.7 + 0.3 * (api.infl(s))) / 100) * 100; }
export function expandLand(s) {
  const m = ensureMap(s);
  if (m.expand >= MAX_EXPAND) return 'terreno no limite: mude para um imóvel maior';
  const c = expandCost(s); if (s.money < c) return 'sem dinheiro';
  api.spend(s, 'obra', c); m.N++; m.expand++; return null;
}
/** Mudança de nível: novo layout base; os móveis comprados são reposicionados (os que não couberem vão para o depósito). */
export function rebuildForLevel(s) {
  const old = s.map; const keep = old ? old.items.filter((i) => !i.base && !FURN[i.k].nosell && !FURN[i.k].portal).concat(old.storage || []) : [];
  const m = defaultMap(s.office, s.mode, OFFICES[s.office].vagas);
  if (old) { m.wall = old.wall; m.floor = old.floor; }
  s.map = m;
  for (const it of keep) {
    const f = FURN[it.k];
    if (f.indie && s.mode !== 'indie') continue;
    let placed = false;
    if (f.wall) { let sl = -1; for (let q = 0; q < m.N && sl < 0; q += 0.5) if (!canPlace(m, it.k, q, 0, 0, undefined, 'R')) sl = q; if (sl >= 0) m.items.push({ id: m.nid++, k: it.k, x: sl, y: 0, r: 0, base: false, wl: 'R', fl: 0 }); else m.storage.push({ k: it.k }); continue; }
    const sp = findSpot(m, it.k);
    if (sp) { m.items.push({ id: m.nid++, k: it.k, x: sp[0], y: sp[1], r: 0, base: false, fl: 0 }); placed = true; }
    if (!placed) m.storage.push({ k: it.k });
  }
  return m;
}
/** Primeiro lugar livre para o item (ou null). */
export function findSpot(m, k) {
  for (let y = 0; y < m.N; y++) for (let x = 0; x < m.N; x++) if (!canPlace(m, k, x, y, 0)) return [x, y];
  return null;
}
export function placeFromStorage(s, idx, x, y, r = 0, wl) {
  const m = ensureMap(s); const st = m.storage[idx]; if (!st) return 'vazio';
  const err = canPlace(m, st.k, x, y, r, undefined, wl); if (err) return err;
  if (FURN[st.k].portal) return 'escadas não vão para o depósito';
  const it = { id: m.nid++, k: st.k, x, y, r, base: false, fl: m.fl | 0 };
  if (FURN[st.k].wall) placeWall(it, x, y, wl);
  m.items.push(it); m.storage.splice(idx, 1); return null;
}

// ---------------------------------------------------------------- efeitos na simulação
export function effects(s) {
  const m = ensureMap(s); const n = s.employees.length;
  const sum = (key, cap) => { let v = 0; const cnt = {}; for (const it of m.items) { if (it.base) continue; const f = FURN[it.k]; if (f.eff?.[key] == null) continue; cnt[it.k] = (cnt[it.k] || 0) + 1; if (f.max && cnt[it.k] > f.max) continue; v += f.eff[key] * (it.k === 'server' && flOf(it) < 0 ? 1.5 : 1); } return cap ? Math.min(cap, v) : v; };
  const desks = m.items.filter((i) => FURN[i.k].seat);
  const q = desks.map((d) => (d.base ? 0 : FURN[d.k].eff.deskQ)).sort((a, b) => b - a);
  const toiletsNeeded = s.office >= 1 ? Math.ceil(n / 8) : 0;
  const coffeeNeeded = s.office >= 1 ? Math.ceil(n / 6) : 0;
  const toilets = m.items.filter((i) => FURN[i.k].toilet).length;
  const coffees = m.items.filter((i) => FURN[i.k].coffee).length;
  const missT = Math.max(0, toiletsNeeded - toilets), missC = Math.max(0, coffeeNeeded - coffees);
  const meetOk = n >= 3 ? 1 : 0;
  const noisy = m.items.filter((i) => !i.base && i.k === 'server' && flOf(i) >= 0).length;
  let mood = 50 + sum('mood', 40) - 10 * missT - 6 * missC - 0.8 * noisy;
  mood = Math.max(0, Math.min(100, mood));
  const coffeeExtra = m.items.filter((i) => !i.base && FURN[i.k].coffee && FURN[i.k].eff.drain).length;
  const cover = n ? Math.min(1, (6 * coffeeExtra) / n) : 0;
  const design = sum('design', 0.2) - (meetOk ? 0 : m.items.filter((i) => !i.base && i.k === 'meeting').length * 0.03);
  return {
    mood, moodF: 1 + 0.0016 * (mood - 50),
    tech: 1 + sum('tech', 0.3), art: 1 + sum('art', 0.3), snd: 1 + sum('snd', 0.3), design: 1 + Math.max(0, design),
    bug: Math.max(0.5, 1 - sum('bug', 0.5)), drain: 1 - 0.12 * cover, rp: sum('rp'), idle: sum('idle'),
    deskQ: q, desks: desks.length, missT, missC, toilets, coffees, toiletsNeeded, coffeeNeeded,
    upkeep: m.items.reduce((a, i) => a + (i.base ? 0 : FURN[i.k].manut || 0), 0) + floorRent(m, s.office), floors: m.floors.length,
  };
}
/** Multiplicador individual (mesa + humor) do i-ésimo funcionário. */
export function empMult(fx, idx) {
  const hasDesk = idx < fx.desks;
  return (hasDesk ? 1 + (fx.deskQ[idx] || 0) : 0.9) * fx.moodF;
}

// ---------------------------------------------------------------- pathfinding (A*)
export function walkGrid(m, f = m.fl | 0) {
  const { b } = blockedSet(m, undefined, f); return b;
}
export function findPath(m, blocked, from, to, maxIter = 4000) {
  const key = (x, y) => x + ',' + y;
  const [sx, sy] = from, [tx, ty] = to; if (sx === tx && sy === ty) return [[tx, ty]];
  const open = [[sx, sy]]; const g = new Map([[key(sx, sy), 0]]); const came = new Map(); const f = new Map([[key(sx, sy), Math.abs(sx - tx) + Math.abs(sy - ty)]]);
  const closed = new Set(); let it = 0;
  while (open.length && it++ < maxIter) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (f.get(key(...open[i])) < f.get(key(...open[bi]))) bi = i;
    const [x, y] = open.splice(bi, 1)[0];
    if (x === tx && y === ty) { const path = [[x, y]]; let k = key(x, y); while (came.has(k)) { const p = came.get(k); path.unshift(p); k = key(...p); } return path; }
    closed.add(key(x, y));
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy; const nk = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= m.N || ny >= m.N || closed.has(nk)) continue;
      if (blocked.has(nk) && !(nx === tx && ny === ty)) continue;
      if (dx && dy && (blocked.has(key(x + dx, y)) || blocked.has(key(x, y + dy)))) continue; // sem cortar quina
      const ng = g.get(key(x, y)) + (dx && dy ? 1.42 : 1);
      if (ng < (g.get(nk) ?? Infinity)) { g.set(nk, ng); came.set(nk, [x, y]); f.set(nk, ng + Math.hypot(nx - tx, ny - ty)); if (!open.some((o) => o[0] === nx && o[1] === ny)) open.push([nx, ny]); }
    }
  }
  return null;
}
/** Tile andável adjacente ao móvel (ponto de uso). */
export function useTile(m, blocked, it) {
  const ts = tilesOf(it); let best = null, bd = 1e9; const reach = reachSet(m, blocked, flOf(it));
  for (const [x, y] of ts) for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= m.N || ny >= m.N || !reach.has(nx + ',' + ny)) continue;
    const d = nx + ny; if (d < bd) { bd = d; best = [nx, ny]; }
  }
  return best;
}
export { tilesOf };

let api = { spend: () => {}, earn: () => {} };
export function bind(a) { api = a; }
