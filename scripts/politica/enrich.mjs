#!/usr/bin/env node
// Enriquecimento das proposições exibidas no site (votações, projetos recentes, projetos de cada
// parlamentar e, se existir, governo.json): autoria estruturada, temas oficiais, link do inteiro
// teor e resumo em linguagem simples ("Pra que serve" / "Como funciona").
//  - Resumos escritos à mão: politica/data/resumos-simples.json (chave c:{idCâmara} | s:{códigoMatériaSenado}).
//    A atualização diária NUNCA apaga nem reescreve esses resumos.
//  - Itens sem resumo escrito à mão recebem uma simplificação automática por regras fixas (simplifica.mjs).
//  - Dados já buscados ficam em politica/data/cache/proposicoes.json; cada execução só busca o que é novo
//    (com limite de tempo), então o job diário continua rápido.
// Uso: node scripts/politica/enrich.mjs   (ENRICH_BUDGET_MS, ENRICH_OFFLINE=1)
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { OUT, CAMARA, SENADO, get, pool, readJSON, writeJSON, log, errors, arr, httpsify } from './lib.mjs';
import { simplificar, temaTags } from './simplifica.mjs';

const CACHE_FILE = join(OUT, 'cache', 'proposicoes.json');
const BUDGET = Number(process.env.ENRICH_BUDGET_MS || 7 * 60 * 1000);
const OFFLINE = process.env.ENRICH_OFFLINE === '1';
const today = new Date().toISOString().slice(0, 10);
const deadline = Date.now() + BUDGET;
const NAO_PROPOSICAO = new Set(['REQ', 'RIC', 'EMP', 'EMC', 'SBT', 'PRL', 'PAR', 'DTQ', 'EMS', 'RQS', 'RQN', 'EMA', 'ESB', 'SBE']);

// ---------- busca ----------
async function infoCamara(id, old) {
  const [det, aut, tem] = await Promise.all([
    get(`${CAMARA}/proposicoes/${id}`, { tries: 3 }).then((j) => j.dados),
    old?.a ? Promise.resolve(null) : get(`${CAMARA}/proposicoes/${id}/autores`, { tries: 3 }).then((j) => j.dados),
    old?.tm?.length ? Promise.resolve(null) : get(`${CAMARA}/proposicoes/${id}/temas`, { tries: 3 }).then((j) => j.dados).catch(() => []),
  ]);
  const o = { ...(old || {}), c: 'c', t: today };
  if (det) {
    o.s = `${det.siglaTipo} ${det.numero}/${det.ano}`; o.e = det.ementa || null; o.dt = det.dataApresentacao || null;
    o.ed = det.ementaDetalhada || null; o.kw = det.keywords || null; o.u = httpsify(det.urlInteiroTeor) || null;
    const st = det.statusProposicao || {};
    o.st = st.descricaoSituacao || null; o.tr = st.descricaoTramitacao || null; o.sd = st.dataHora || null;
    if (det.uriPropPrincipal) o.pp = Number(String(det.uriPropPrincipal).split('/').pop()) || null;
  }
  if (aut) {
    const l = [...aut].sort((a, b) => (a.ordemAssinatura || 99) - (b.ordemAssinatura || 99));
    o.na = l.length;
    o.a = l.slice(0, 4).map((x) => {
      const dep = /\/deputados\/(\d+)/.exec(x.uri || '');
      const t = dep ? 'D' : /executivo/i.test(`${x.tipo} ${x.nome}`) ? 'E' : /senad/i.test(`${x.tipo} ${x.nome}`) ? 'S' : 'O';
      return [x.nome, dep ? Number(dep[1]) : 0, t];
    });
  }
  if (tem) o.tm = [...tem].sort((a, b) => (a.relevancia ?? 9) - (b.relevancia ?? 9)).map((x) => x.tema).filter(Boolean);
  return o;
}

async function infoSenado(cm, old, sid) {
  let id = sid || old?.id;
  let lista = null;
  if (!id) {
    lista = arr(await get(`${SENADO}/processo?codigoMateria=${cm}`, { timeout: 90000 }));
    id = lista[0]?.id;
  }
  const o = { ...(old || {}), c: 's', t: today };
  if (!id) { o.none = 1; return o; }
  const d = await get(`${SENADO}/processo/${id}`, { timeout: 90000 });
  o.id = id; o.s = d.identificacao; o.e = d.conteudo?.ementa || o.e || null; o.dt = d.documento?.dataApresentacao || null;
  o.u = httpsify(d.documento?.url) || null;
  o.st = d.situacaoAtual || null; o.sd = d.dataSituacaoAtual || null; o.tram = d.tramitando === 'Sim';
  if (lista?.[0]?.normaGerada) o.ng = lista[0].normaGerada;
  else if (d.normaGerada) o.ng = typeof d.normaGerada === 'string' ? d.normaGerada : null;
  const ai = arr(d.autoriaIniciativa).length ? arr(d.autoriaIniciativa) : arr(d.documento?.autoria);
  o.na = ai.length;
  o.a = ai.slice(0, 4).map((x) => {
    const t = /SENADOR/.test(x.siglaTipo) ? 'S' : /DEPUTADO/.test(x.siglaTipo) ? 'D' : /PRESIDENTE|EXECUTIVO/.test(`${x.siglaTipo} ${x.descricaoTipo}`) ? 'E' : 'O';
    return [x.autor, x.codigoParlamentar || 0, t, x.siglaPartido || null, x.uf || null];
  });
  o.ra = d.documento?.resumoAutoria || null;
  o.cp = d.identificacaoProcessoInicial && d.siglaCasaIniciadora === 'CD' ? d.identificacaoProcessoInicial : null;
  o.tm = arr(d.classificacoes).map((x) => x.descricaoHierarquia || x.descricao).filter(Boolean);
  return o;
}

// ---------- coleta dos itens exibidos ----------
async function main() {
  await mkdir(join(OUT, 'cache'), { recursive: true });
  const cache = (await readJSON(CACHE_FILE)) || {};
  const resumos = (await readJSON(join(OUT, 'resumos-simples.json'))) || {};
  const vot = await readJSON(join(OUT, 'votacoes.json'));
  const props = await readJSON(join(OUT, 'proposicoes.json'));
  const gov = await readJSON(join(OUT, 'governo.json'));
  const parl = { c: {}, s: {} };
  for (const casa of ['c', 's']) {
    let files = []; try { files = await readdir(join(OUT, 'parl', casa)); } catch { /* sem perfis */ }
    for (const f of files) if (f.endsWith('.json')) parl[casa][f] = await readJSON(join(OUT, 'parl', casa, f));
  }

  // alvos: chave -> {casa, id, sid, prio, fresh}
  const alvos = new Map();
  const add = (casa, id, prio, extra = {}) => {
    if (!id) return; const k = `${casa}:${id}`;
    const cur = alvos.get(k);
    if (cur) { cur.prio = Math.min(cur.prio, prio); Object.assign(cur, extra); } else alvos.set(k, { k, casa, id, prio, ...extra });
  };
  for (const v of [...(vot?.camara?.lista || []), ...(vot?.camara?.nominais || [])]) if (v.pr) add('c', v.pr.id, 0, { fresh: true });
  for (const v of vot?.senado?.lista || []) add('s', v.cm, 0, { fresh: true });
  for (const p of props?.camara || []) add('c', p.id, 1);
  for (const p of props?.senado || []) add('s', p.cm, 1, { sid: p.id });
  for (const sec of ['mpv', 'exec', 'leis']) for (const p of gov?.[sec] || []) { if (p.c === 'c') add('c', p.id, 1); else if (p.cm) add('s', p.cm, 1); }
  for (const casa of ['c', 's']) for (const d of Object.values(parl[casa])) (d?.pj?.it || []).forEach((p, i) => add(casa, casa === 'c' ? p.id : p.cm, 2 + i, casa === 's' ? { sid: p.id } : {}));

  // o que buscar: novos; itens de votação (situação muda); temas ainda vazios de itens recentes (1x/dia)
  const precisa = [...alvos.values()].filter((a) => {
    const c = cache[a.k];
    if (!c) return true;
    if (a.fresh && c.t !== today) return true;
    if (a.casa === 'c' && !(c.tm?.length) && c.t !== today && c.dt && Date.now() - Date.parse(c.dt) < 60 * 86400000) return true;
    return false;
  }).sort((x, y) => x.prio - y.prio);
  log(`enrich: ${alvos.size} proposições exibidas; ${precisa.length} para buscar${OFFLINE ? ' (offline: nada será buscado)' : ''}`);
  if (!OFFLINE && precisa.length) {
    let ok = 0;
    const camara = precisa.filter((a) => a.casa === 'c');
    const senado = precisa.filter((a) => a.casa === 's');
    let saveAt = Date.now() + 60000;
    const persist = async () => { if (Date.now() > saveAt) { saveAt = Date.now() + 60000; await writeJSON(CACHE_FILE, cache, { quiet: true }); log(`enrich: ${ok} buscadas…`); } };
    await Promise.all([
      pool(camara, 4, async (a) => { const old = cache[a.k]; cache[a.k] = await infoCamara(a.id, old); ok++; await persist(); }, { deadline }),
      pool(senado, 3, async (a) => { cache[a.k] = await infoSenado(a.id, cache[a.k], a.sid); ok++; await persist(); }, { deadline }),
    ]);
    log(`enrich: ${ok}/${precisa.length} buscadas${Date.now() >= deadline ? ' (limite de tempo atingido; o resto fica para a próxima execução)' : ''}`);
  }
  await writeJSON(CACHE_FILE, cache);

  // ---------- aplica nos arquivos exibidos ----------
  const px = (casa, id, sig, ementa) => {
    if (!id) return null;
    const k = `${casa}:${id}`; const c = cache[k] || {}; const o = {};
    if (c.a?.length) { o.a = c.a; if (c.na > c.a.length) o.na = c.na; }
    if (c.ra && casa === 's') o.ra = c.ra;
    const tg = temaTags(c.tm); if (tg.length) { o.tg = tg; o.to = c.tm.slice(0, 4); }
    if (c.u) o.u = c.u;
    if (c.ng) o.ng = c.ng;
    if (c.cp) o.cp = c.cp;
    const h = resumos[k];
    if (h && typeof h === 'object' && h.ps) o.rs = { ps: h.ps, cf: h.cf || null, h: 1 };
    else if (typeof h === 'string' && h) o.rs = { ps: h, cf: null, h: 1 };
    else { const a = simplificar(ementa || c.e, sig || c.s); if (a) o.rs = { ps: a.ps, cf: null, h: 0, ...(a.leis?.length ? { lc: a.leis } : {}) }; }
    return Object.keys(o).length ? o : null;
  };
  const stats = { h: 0, a: 0 };
  const count = (o) => { if (o?.rs) stats[o.rs.h ? 'h' : 'a']++; return o; };

  if (vot) {
    for (const v of [...(vot.camara?.lista || []), ...(vot.camara?.nominais || [])]) {
      if (!v.pr) continue;
      v.pr.x = count(px('c', v.pr.id, v.pr.s, v.pr.e)) || undefined;
      const c = cache[`c:${v.pr.id}`];
      if (c) { v.pr.st = c.st || null; v.pr.tr = c.tr || null; }
    }
    for (const v of vot.senado?.lista || []) {
      v.x = count(px('s', v.cm, v.s, v.e)) || undefined;
      const c = cache[`s:${v.cm}`]; if (c) v.st = c.st || null;
    }
    await writeJSON(join(OUT, 'votacoes.json'), vot);
  }
  if (props) {
    for (const p of props.camara || []) p.x = count(px('c', p.id, p.s, p.e)) || undefined;
    for (const p of props.senado || []) p.x = count(px('s', p.cm, p.s, p.e)) || undefined;
    await writeJSON(join(OUT, 'proposicoes.json'), props);
  }
  if (gov) {
    for (const sec of ['mpv', 'exec', 'leis']) for (const p of gov[sec] || []) p.x = count(p.c === 'c' ? px('c', p.id, p.s, p.e) : px('s', p.cm, p.s, p.e)) || undefined;
    await writeJSON(join(OUT, 'governo.json'), gov);
  }
  let nf = 0;
  for (const casa of ['c', 's']) for (const [f, d] of Object.entries(parl[casa])) {
    if (!d?.pj?.it) continue;
    const before = JSON.stringify(d);
    for (const p of d.pj.it) p.x = count(px(casa, casa === 'c' ? p.id : p.cm, p.s, p.e)) || undefined;
    const after = JSON.stringify(d);
    if (after !== before) { await writeJSON(join(OUT, 'parl', casa, f), d, { quiet: true }); nf++; }
  }
  log(`enrich: ${nf} perfis atualizados; resumos exibidos: ${stats.h} escritos à mão, ${stats.a} automáticos`);
  if (errors.length) log(`${errors.length} erro(s) no enrich:`, errors.slice(0, 8));
}

main().catch((e) => { console.error(e); process.exit(1); });
