// Atos do governo federal por ano: leis ordinárias, leis complementares, emendas constitucionais,
// decretos numerados (Senado — /dadosabertos/legislacao/lista), medidas provisórias e vetos
// (Senado/Congresso — /dadosabertos/processo). Uso: node normas.mjs [--anos=1985-2026] [--offline]
import { join } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { GOV, PROP, RAW, ANO_ATUAL, log, readJSON, writeIfChanged, get, sleep, arr, dmy2iso, hojeBR } from './comum.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const OFFLINE = !!args.offline;
let anos;
if (args.anos) { const [a, b] = String(args.anos).split('-').map(Number); anos = []; for (let y = a; y <= (b || a); y++) anos.push(y); }
else { const n = new Date().getUTCDay() === 0 ? 4 : 2; anos = []; for (let y = ANO_ATUAL - n + 1; y <= ANO_ATUAL; y++) anos.push(y); }
const SEN = 'https://legis.senado.leg.br/dadosabertos';

async function cached(file, url) {
  let d = null;
  if (!OFFLINE) {
    try { d = await get(url, { timeout: 180000 }); await mkdir(join(file, '..'), { recursive: true }); await writeFile(file, JSON.stringify(d)); }
    catch (e) { log('falhou', url, e.message); }
    await sleep(250);
  }
  if (!d && existsSync(file)) d = JSON.parse(await readFile(file, 'utf8'));
  return d;
}
const apelido = (a, codigo) => { const s = String(a || ''); const i = s.indexOf(','); if (s.trim() === codigo || i < 0) return ''; return s.slice(i + 1).trim(); };
const origem = (await readJSON(join(PROP, 'normas-origem.json'), { normas: {} })).normas;

// MPs da Câmara (para achar o id c: e reaproveitar resumos do painel)
async function mpvCamara(y) {
  const f = await readJSON(join(PROP, 'anos', `${y}.json`), null);
  const m = new Map();
  for (const it of f?.itens || []) if (it[1] === 'MPV') m.set(Number(it[2]), it[0]);
  return m;
}
const MPV_SIT = (x) => {
  const d = String(x.siglaTipoDeliberacao || ''); const s = String(x.situacaoAtual || '');
  if (d === 'REEDITADA') return 'R';
  if (d === 'APROVADO_PLV') return 'C';
  if (d === 'APROVADO_NA_INTEGRA') return 'I';
  if (/PERDA_EFICACIA|SEM_EFICACIA/.test(d)) return 'E';
  if (d === 'REVOGADO') return 'V';
  if (/REJEITADO|INADIMITIDA/.test(d)) return 'J';
  if (d === 'PREJUDICADO') return 'P';
  if (d === 'IMPUGNADO_PRESIDENCIA') return 'D';
  if (/ANTES DA EC 32/.test(s)) return 'A';
  if (/TRANSFORMADA EM NORMA/.test(s)) return 'I';
  if (x.tramitando === 'Sim') return 'T';
  if (/SEM EFIC/.test(s)) return 'E';
  return '?';
};
const VET_SIT = (x) => {
  const d = String(x.siglaTipoDeliberacao || '');
  if (/MANTIDA|^MANTIDO$/.test(d)) return 'M';
  if (d === 'MANTIDO_PARCIALMENTE') return 'P';
  if (/REJEITADO/.test(d)) return 'D';
  if (d === 'PREJUDICADO') return 'X';
  if (x.tramitando === 'Sim') return 'T';
  return '?';
};

const indice = await readJSON(join(GOV, 'atos', 'indice.json'), {});
const porAno = indice.anos || {};
for (const y of anos) {
  const out = { ano: y };
  for (const [t, k] of [['LEI', 'lei'], ['LCP', 'lcp'], ['EMC', 'emc'], ['DEC', 'dec']]) {
    if (t === 'EMC' && y < 1988) { out[k] = []; continue; }
    const d = await cached(join(RAW, 'sen-leg', `${t}-${y}.json`), `${SEN}/legislacao/lista?tipo=${t}&ano=${y}`);
    const docs = arr(d?.ListaDocumento?.documentos?.documento);
    out[k] = docs.filter((x) => x.numero).map((x) => {
      const num = Number(String(x.numero).replace(/\D/g, '')) || x.numero;
      const row = [num, dmy2iso(x.dataassinatura), String(x.ementa || '').replace(/\s+/g, ' ').trim(), apelido(x.apelido, x.norma), Number(x.id)];
      const o = origem[`${t}-${num}-${y}`]; if (o && t !== 'DEC') row.push(o);
      return row;
    }).sort((a, b) => (a[1] || '').localeCompare(b[1] || '') || a[0] - b[0]);
  }
  // Edições de MP (legislação do Senado): inclui reedições, que até a EC 32/2001 eram publicadas
  // com número próprio ou com sufixo (ex.: MP 2.166-67 = 67ª reedição da MP 2.166)
  const ml = await cached(join(RAW, 'sen-leg', `MPV-${y}.json`), `${SEN}/legislacao/lista?tipo=MPV&ano=${y}`);
  out.mpvEd = arr(ml?.ListaDocumento?.documentos?.documento).filter((x) => x.numero)
    .map((x) => [Number(String(x.numero).replace(/\D/g, '')), Number(x.reedicao || 0), dmy2iso(x.dataassinatura), Number(x.id)])
    .sort((a, b) => (a[2] || '').localeCompare(b[2] || '') || a[0] - b[0] || a[1] - b[1]);
  const mc = await mpvCamara(y);
  const mp = await cached(join(RAW, 'sen-proc', `MPV-${y}.json`), `${SEN}/processo?sigla=MPV&ano=${y}`);
  out.mpv = (mp || []).map((x) => {
    const m = String(x.identificacao).match(/MPV\s+(\d+)\/(\d{4})/); if (!m) return null;
    const n = Number(m[1]);
    return [n, String(x.dataApresentacao || '').slice(0, 10), String(x.ementa || '').replace(/\s+/g, ' ').trim(), x.apelido || '', x.codigoMateria, MPV_SIT(x), String(x.normaGerada || '').replace(/ de \d{2}\/\d{2}\/\d{4}$/, ''), mc.get(n) || ''];
  }).filter(Boolean).sort((a, b) => a[0] - b[0]);
  const vt = await cached(join(RAW, 'sen-proc', `VET-${y}.json`), `${SEN}/processo?sigla=VET&ano=${y}`);
  out.vet = (vt || []).map((x) => {
    const m = String(x.identificacao).match(/VET\s+(\d+)\/(\d{4})/); if (!m) return null;
    const e = String(x.ementa || '').replace(/\s+/g, ' ').trim();
    return [Number(m[1]), String(x.dataApresentacao || '').slice(0, 10), e, x.codigoMateria, /^veto total/i.test(e) ? 'T' : 'P', VET_SIT(x), String(x.normaGerada || '').replace(/ de \d{2}\/\d{2}\/\d{4}$/, '')];
  }).filter(Boolean).sort((a, b) => a[0] - b[0]);
  out.campos = {
    lei: ['numero', 'assinatura', 'ementa', 'apelido', 'idSenado', 'origem[chave, sigla]'],
    mpv: ['numero', 'edicao', 'ementa', 'apelido', 'codigoMateria', 'situacao', 'normaGerada', 'idCamara'],
    mpvEd: ['numero', 'reedicao (0 = primeira edição ou sem sufixo)', 'assinatura', 'idSenado'],
    vet: ['numero', 'data', 'ementa', 'codigoMateria', 'tipo T/P', 'resultado', 'normaGerada'],
  };
  porAno[y] = { lei: out.lei.length, lcp: out.lcp.length, emc: out.emc.length, dec: out.dec.length, mpv: out.mpv.length, mpvEd: out.mpvEd.length, vet: out.vet.length };
  await writeIfChanged(join(GOV, 'atos', `${y}.json`), out);
  log(y, porAno[y]);
}
const idx = {
  _sobre: 'Contagem de atos por ano. lei = leis ordinárias, lcp = leis complementares, emc = emendas constitucionais, dec = decretos numerados, mpv = medidas provisórias com processo no Congresso (antes de 1997, cada reedição tinha número e processo próprios), mpvEd = todas as edições publicadas, incluindo reedições com sufixo (ex.: MP 2.166-67), vet = vetos presidenciais analisados pelo Congresso (dados do Senado a partir de 2000).',
  atualizado: indice.atualizado, anos: porAno,
  codigos: {
    mpv: { R: 'Reeditada: republicada com novo número antes de perder a validade (permitido até a EC 32/2001)', C: 'Aprovada com mudanças: virou lei (projeto de lei de conversão)', I: 'Aprovada sem mudanças: virou lei', E: 'Perdeu a validade: o Congresso não votou a tempo', V: 'Revogada pelo próprio governo', J: 'Rejeitada pelo Congresso', P: 'Ficou prejudicada (perdeu o objeto)', D: 'Devolvida pelo presidente do Congresso', A: 'Continua valendo: editada antes da EC 32/2001, vale até o Congresso decidir ou outra norma revogá-la', T: 'Em análise no Congresso (já está valendo)', '?': 'Situação não informada' },
    vet: { M: 'Veto mantido: o Congresso concordou e o trecho continua fora da lei', D: 'Veto derrubado: o Congresso discordou e o trecho voltou para a lei', P: 'Veto derrubado em parte', X: 'Prejudicado (perdeu o objeto)', T: 'Esperando votação no Congresso', '?': 'Situação não informada' },
  },
  fontes: [
    { nome: 'Senado Federal — Dados Abertos: Legislação (/legislacao/lista)', url: 'https://legis.senado.leg.br/dadosabertos/docs/' },
    { nome: 'Senado Federal — Dados Abertos: Processo (MPV e VET)', url: 'https://legis.senado.leg.br/dadosabertos/docs/' },
    { nome: 'Normas.leg.br (LexML) — texto oficial', url: 'https://normas.leg.br/' },
    { nome: 'Planalto — Portal da Legislação', url: 'https://www4.planalto.gov.br/legislacao/' },
  ],
};
const old = JSON.stringify({ ...indice, atualizado: 0 }); idx.atualizado = 0;
if (JSON.stringify(idx) !== old) { idx.atualizado = hojeBR(); await writeIfChanged(join(GOV, 'atos', 'indice.json'), idx); }
