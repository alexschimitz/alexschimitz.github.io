#!/usr/bin/env node
// Coleta votações nominais de Plenário (Câmara e Senado) e grava, em JSON compacto:
//   politica/data/votos/idx.json          índice de votações + cobertura
//   politica/data/votos/v/{c|s}-{id}.json  votos individuais de uma votação
//   politica/data/votos/{c|s}/{id}.json    votos de um parlamentar [[chave, código], ...]
// Uso: node scripts/politica/votos/build.mjs [--desde=AAAA-MM-DD] [--ate=AAAA-MM-DD] [--full]
// Incremental: reaproveita o que já foi coletado e reconsulta a partir da última data − 10 dias.
import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { OUT, CAMARA, SENADO, errors, log, ymd, get, pool, readJSON, writeJSON, sleep } from '../lib.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const DIR = join(OUT, 'votos');
const CACHE = join(OUT, 'cache');
const DESDE = args.desde || '2025-02-01'; // início da 3ª sessão legislativa da 57ª legislatura
const ATE = args.ate || ymd(new Date());
const CONC = 4; // requisições paralelas (respeita os limites das APIs)

const VOTO_CAMARA = { 'Sim': 'S', 'Não': 'N', 'Abstenção': 'A', 'Obstrução': 'O', 'Artigo 17': 'P' };
const codC = (t) => (t == null ? 'V' : VOTO_CAMARA[t] || String(t));
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

function janelas(desde, ate, dias) {
  const out = []; let a = new Date(desde + 'T00:00:00Z'); const fim = new Date(ate + 'T00:00:00Z');
  while (a <= fim) {
    let b = new Date(a.getTime() + (dias - 1) * 864e5);
    const fimAno = new Date(Date.UTC(a.getUTCFullYear(), 11, 31));
    if (b > fimAno) b = fimAno; if (b > fim) b = fim;
    out.push([ymd(a), ymd(b)]); a = new Date(b.getTime() + 864e5);
  }
  return out;
}

const idx = args.full ? null : await readJSON(join(DIR, 'idx.json'));
const scan = await readJSON(join(CACHE, 'votos-scan.json'), {}); // id Câmara -> 0 (sem votos nominais) | 1
const temasCache = await readJSON(join(CACHE, 'votos-temas.json'), {}); // "c:propId" | "s:processo" -> [temas]
const votacoes = new Map((idx?.v || []).map((v) => [v.k, v]));
const novos = new Map(); // k -> rows
const inicio = (casa) => {
  const prev = idx?.cobertura?.[casa];
  if (!prev || prev.desde !== DESDE) return DESDE;
  const d = new Date(prev.ate + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 10);
  return ymd(d) < DESDE ? DESDE : ymd(d);
};

// ---------------- Câmara ----------------
async function camara() {
  const lista = [];
  for (const [a, b] of janelas(inicio('c'), ATE, 85)) {
    for (let p = 1; p <= 30; p++) {
      const j = await get(`${CAMARA}/votacoes?idOrgao=180&dataInicio=${a}&dataFim=${b}&itens=200&pagina=${p}&ordem=ASC&ordenarPor=dataHoraRegistro`);
      lista.push(...j.dados);
      if (!j.links?.some((l) => l.rel === 'next')) break;
      await sleep(150);
    }
  }
  const pend = lista.filter((v) => scan[v.id] !== 0 && !(scan[v.id] === 1 && votacoes.has('c:' + v.id)));
  log(`câmara: ${lista.length} votações de plenário na janela; ${pend.length} a verificar`);
  await pool(pend, CONC, async (v) => {
    let votos;
    try { votos = (await get(`${CAMARA}/votacoes/${v.id}/votos`, { tries: 3 })).dados; }
    catch (e) { if (/HTTP 404/.test(e.message)) votos = []; else throw e; }
    if (!votos.length) { scan[v.id] = 0; return; }
    const d = (await get(`${CAMARA}/votacoes/${v.id}`, { tries: 3 })).dados || {};
    const pr = d.proposicoesAfetadas?.[0] || null;
    const rows = votos.map((x) => [x.deputado_?.id, x.deputado_?.nome, x.deputado_?.siglaPartido, x.deputado_?.siglaUf, codC(x.tipoVoto)]).filter((r) => r[0]);
    const pl = {}; rows.forEach((r) => { pl[r[4]] = (pl[r[4]] || 0) + 1; });
    let t = [];
    if (pr) {
      const tk = 'c:' + pr.id;
      if (!temasCache[tk]) { try { temasCache[tk] = (await get(`${CAMARA}/proposicoes/${pr.id}/temas`)).dados.map((x) => x.tema); } catch { temasCache[tk] = []; } }
      t = temasCache[tk];
    }
    const k = 'c:' + v.id;
    votacoes.set(k, {
      k, dt: v.dataHoraRegistro || v.data, d: clip(v.descricao, 400),
      ctx: clip(d.descUltimaAberturaVotacao, 300) || undefined,
      r: v.aprovacao === 1 ? 'A' : v.aprovacao === 0 ? 'R' : undefined,
      p: pr ? { id: pr.id, s: `${pr.siglaTipo} ${pr.numero}/${pr.ano}`, e: clip(pr.ementa, 300) } : undefined,
      pl, n: rows.length, t,
    });
    novos.set(k, rows); scan[v.id] = 1;
  });
  const ds = lista.map((v) => String(v.dataHoraRegistro || v.data).slice(0, 10)).sort();
  return { plenario: lista.length };
}

// ---------------- Senado ----------------
async function senado() {
  let total = 0;
  for (const [a, b] of janelas(inicio('s'), ATE, 60)) {
    const arr = await get(`${SENADO}/votacao?dataInicio=${a}&dataFim=${b}`, { tries: 3 });
    const lista = Array.isArray(arr) ? arr : [];
    total += lista.length;
    for (const v of lista) {
      const k = 's:' + v.codigoSessaoVotacao;
      const rows = (v.votos || []).map((x) => [x.codigoParlamentar, x.nomeParlamentar, x.siglaPartidoParlamentar, x.siglaUFParlamentar, x.siglaVotoParlamentar]).filter((r) => r[0]);
      if (!rows.length) continue;
      const pl = {}; rows.forEach((r) => { pl[r[4]] = (pl[r[4]] || 0) + 1; });
      let t = [];
      if (v.idProcesso) {
        const tk = 's:' + v.idProcesso;
        if (!temasCache[tk]) {
          try {
            const pr = await get(`${SENADO}/processo/${v.idProcesso}`, { tries: 2 });
            temasCache[tk] = [...new Set((pr.classificacoes || []).map((c) => (c.descricaoHierarquia || c.descricao || '').split(' / ')[1] || c.descricao).filter(Boolean))].slice(0, 4);
          } catch { temasCache[tk] = []; }
          await sleep(100);
        }
        t = temasCache[tk];
      }
      votacoes.set(k, {
        k, dt: v.dataSessao, d: clip(v.descricaoVotacao, 400), r: v.resultadoVotacao || undefined,
        sec: v.votacaoSecreta === 'S' || v.votacaoSecreta === true ? 1 : undefined,
        p: v.identificacao ? { id: v.codigoMateria, s: v.identificacao, e: clip(v.ementa, 300) } : undefined,
        pl, n: rows.length, t,
      });
      novos.set(k, rows);
    }
    await sleep(300);
  }
  log(`senado: ${total} votações nominais na janela`);
  return { plenario: total };
}

await mkdir(join(DIR, 'v'), { recursive: true });
await mkdir(join(DIR, 'c'), { recursive: true });
await mkdir(join(DIR, 's'), { recursive: true });
const rc = await camara().catch((e) => { errors.push('câmara: ' + e.message); return null; });
const rs = await senado().catch((e) => { errors.push('senado: ' + e.message); return null; });

for (const [k, rows] of novos) await writeJSON(join(DIR, 'v', k.replace(':', '-') + '.json'), rows, { quiet: true });

// Reconstrói os arquivos por parlamentar a partir de todos os arquivos de votação.
const lista = [...votacoes.values()].filter((v) => String(v.dt).slice(0, 10) >= DESDE).sort((a, b) => String(b.dt).localeCompare(String(a.dt)));
const porParl = { c: {}, s: {} };
for (const v of lista) {
  const casa = v.k[0];
  const rows = novos.get(v.k) || await readJSON(join(DIR, 'v', v.k.replace(':', '-') + '.json'), []);
  for (const r of rows) (porParl[casa][r[0]] ||= []).push([v.k.slice(2), r[4]]);
}
for (const casa of ['c', 's']) {
  const existentes = new Set((await readdir(join(DIR, casa))).map((f) => f.replace('.json', '')));
  for (const [id, arr] of Object.entries(porParl[casa])) { await writeJSON(join(DIR, casa, id + '.json'), arr, { quiet: true }); existentes.delete(String(id)); }
  for (const f of existentes) await rm(join(DIR, casa, f + '.json'));
}
const cob = (casa, r) => {
  const ds = lista.filter((v) => v.k[0] === casa).map((v) => String(v.dt).slice(0, 10)).sort();
  const prev = idx?.cobertura?.[casa];
  return { desde: DESDE, ate: r ? ATE : prev?.ate || null, nominais: ds.length, primeira: ds[0] || null, ultima: ds.at(-1) || null, ok: !!r || !!prev?.ok };
};
await writeJSON(join(DIR, 'idx.json'), {
  atualizadoEm: new Date().toISOString(),
  cobertura: { c: cob('c', rc), s: cob('s', rs) },
  parlamentares: { c: Object.keys(porParl.c).length, s: Object.keys(porParl.s).length },
  v: lista,
});
await writeJSON(join(CACHE, 'votos-scan.json'), scan, { quiet: true });
await writeJSON(join(CACHE, 'votos-temas.json'), temasCache, { quiet: true });
log(`total: ${lista.length} votações nominais; erros: ${errors.length}`);
if (errors.length) { console.error(errors.slice(0, 20).join('\n')); if (!rc && !rs) process.exit(1); }
