// Eleições 2026 (Presidente) a partir dos arquivos oficiais de divulgação do TSE (sem chave):
// https://resultados.tse.jus.br/oficial/ele2026/<eleição>/dados/br/br-c0001-e<eleição>-u.json
// 1º turno = eleição 6257; 2º turno = 6258 (código "cdt2" no arquivo de configuração ele-c.json).
import { join } from 'node:path';
import { GOV, log, readJSON, writeIfChanged, get, hojeBR } from './comum.mjs';

const BASE = 'https://resultados.tse.jus.br/oficial';
const num = (s) => Number(String(s || '0').replace(/\./g, '').replace(',', '.')) || 0;
async function turno(cd) {
  const id = String(cd).padStart(6, '0');
  const url = `${BASE}/ele2026/${cd}/dados/br/br-c0001-e${id}-u.json`;
  let d;
  try { d = await get(url, { tries: 2, timeout: 60000 }); } catch (e) { log('TSE indisponível', cd, e.message); return null; }
  const cands = [];
  for (const c of d.carg || []) for (const ag of c.agr || []) for (const p of ag.par || []) for (const k of p.cand || []) {
    cands.push({ n: k.n, nome: k.nmu, nomeCompleto: k.nm, partido: p.sg, coligacao: ag.tp === 'c' ? ag.nm : '', composicao: ag.com, vice: (k.vs || [])[0]?.nmu || '', viceP: (k.vs || [])[0]?.sgp || '', votos: num(k.vap), pct: k.pvap, situacao: k.st, validade: k.dvt });
  }
  cands.sort((a, b) => b.votos - a.votos);
  return {
    eleicao: d.ele, turno: d.t, oficial: d.f === 'o', totalizacaoFinal: d.tf === 's', geradoEm: `${d.dg} ${d.hg}`, totalizadoEm: `${d.dt} ${d.ht}`,
    secoes: { total: num(d.s?.ts), totalizadas: num(d.s?.st), pct: d.s?.pst },
    eleitorado: num(d.e?.te), comparecimento: num(d.e?.c), comparecimentoPct: d.e?.pc, abstencao: num(d.e?.a), abstencaoPct: d.e?.pa,
    votos: { validos: num(d.v?.vv), brancos: num(d.v?.vb), brancosPct: d.v?.pvb, nulos: num(d.v?.tvn), nulosPct: d.v?.ptvn },
    candidatos: cands, url,
  };
}
const old = await readJSON(join(GOV, 'eleicoes2026.json'), {});
const t1 = await turno(6257) || old.t1 || null;
const t2 = await turno(6258) || old.t2 || null;
const out = {
  _sobre: 'Eleição presidencial de 2026 — números oficiais de divulgação do TSE, sem alteração. Percentuais = votos válidos (como o TSE publica).',
  fonte: { nome: 'TSE — Resultados (divulgação oficial)', url: 'https://resultados.tse.jus.br/' },
  datas: { turno1: '2026-10-04', turno2: '2026-10-25', posse: '2027-01-05' },
  notaDatas: '2º turno no último domingo de outubro (art. 77 da Constituição). Posse do presidente em 5 de janeiro (art. 82, com a redação da EC 111/2021).',
  t1, t2,
};
const same = JSON.stringify({ ...out, verificado: 0 }) === JSON.stringify({ ...old, verificado: 0 });
out.verificado = same ? old.verificado : hojeBR();
await writeIfChanged(join(GOV, 'eleicoes2026.json'), out);
log('eleições 2026', t1 ? `1º turno: ${t1.candidatos.length} candidatos, seções ${t1.secoes.pct}%` : 'sem dados', t2 ? '2º turno disponível' : 'sem 2º turno ainda');
