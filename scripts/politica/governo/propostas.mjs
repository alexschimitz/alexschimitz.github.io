// Catálogo de propostas (Câmara + Senado) desde 1988, em fatias por ano.
// Fontes: arquivos anuais de proposições da Câmara (dadosabertos.camara.leg.br/arquivos/proposicoes,
// proposicoesAutores, proposicoesTemas) e /dadosabertos/processo do Senado (matérias iniciadas no Senado).
// Uso: node propostas.mjs [--anos=1988-2026] [--offline]
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { PROP, GOV, RAW, ANO_ATUAL, log, readJSON, writeIfChanged, download, get, sleep, norm, hojeBR, ROOT } from './comum.mjs';
import { temaTags, TEMA_TAGS } from '../simplifica.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const OFFLINE = !!args.offline;
let anos;
if (args.anos) { const [a, b] = String(args.anos).split('-').map(Number); anos = []; for (let y = a; y <= (b || a); y++) anos.push(y); }
else {
  const domingo = new Date().getUTCDay() === 0;
  const n = domingo ? 8 : 2; anos = []; for (let y = ANO_ATUAL - n + 1; y <= ANO_ATUAL; y++) anos.push(y);
}
const TIPOS_C = new Set(['PL', 'PLP', 'PEC', 'MPV', 'PDC', 'PDL', 'PLV', 'PLN']);
const RADIO_TV = (e) => /^aprova o ato que (outorga|renova|autoriza|transfere|reconhece|declara)/i.test(e) && /(radiodifus|r[áa]dio|televis|sons e imagens|comunit[áa]ri)/i.test(e);

// ---- dicionários estáveis (só acrescentam) ----
const autores = await readJSON(join(PROP, 'autores.json'), { _sobre: '', lista: [] });
autores._sobre = 'Autores das propostas: [nome, tipo (D=deputado, S=senador, E=Poder Executivo, O=outro órgão), id na Câmara (deputados) ou no Senado (senadores em exercício), partido, UF]. Partido e UF como informados pela Câmara/Senado no registro da autoria. Índices estáveis: novos autores entram no fim.';
const aIdx = new Map(autores.lista.map((a, i) => [a.join('|'), i]));
const addAutor = (a) => { const k = a.join('|'); let i = aIdx.get(k); if (i == null) { i = autores.lista.length; autores.lista.push(a); aIdx.set(k, i); } return i; };
const indice = await readJSON(join(PROP, 'indice.json'), {});
const situacoes = indice.situacoes || [];
const sIdx = new Map(situacoes.map((s, i) => [s, i]));
const addSit = (s) => { s = String(s || '').trim(); let i = sIdx.get(s); if (i == null) { i = situacoes.length; situacoes.push(s); sIdx.set(s, i); } return i; };
const origem = await readJSON(join(PROP, 'normas-origem.json'), { _sobre: '', normas: {} });
origem._sobre = 'Norma jurídica gerada -> proposta de origem. Chave: TIPO-numero-ano (LEI, LCP, EMC). Valor: [chave da proposta (c:id da Câmara ou s:código do Senado), sigla nº/ano]. Fonte: situação/tramitação da Câmara ("Transformado na Lei Ordinária n/ano") e campo normaGerada do Senado.';

// Senadores em exercício (para link ao perfil no painel)
const sen = await readJSON(join(ROOT, 'politica', 'data', 'senadores.json'), []);
const senLista = Array.isArray(sen) ? sen : (sen.senadores || sen.lista || sen.itens || []);
const senPorNome = new Map();
for (const s of senLista) { const nome = s.n || s.nome || s.NomeParlamentar; const id = s.id || s.codigo; if (nome && id) senPorNome.set(norm(nome), String(id)); }

function sitCamara(s) {
  const n = norm(s);
  if (!n) return '?';
  if (/transformad[oa] em nova proposicao/.test(n)) return 'N';
  if (/transformad[oa] em (norma|lei|emenda)/.test(n)) return 'L';
  if (/vetad[oa] totalmente/.test(n)) return 'V';
  if (/perdeu a eficacia/.test(n)) return 'E';
  if (/arquivad/.test(n)) return 'A';
  if (/retirad|devolvid/.test(n)) return 'X';
  if (/rejeitad|prejudicad/.test(n)) return 'R';
  if (/tramitacao (finalizada|encerrada)/.test(n)) return 'F';
  return 'T';
}
function sitSenado(x) {
  const s = norm(x.situacaoAtual); const d = String(x.siglaTipoDeliberacao || '');
  if (x.normaGerada || /transformada em norma/.test(s)) return 'L';
  if (/vetad/.test(s)) return 'V';
  if (/perda_eficacia|sem_eficacia/i.test(d) || /perdeu a eficacia|sem eficacia/.test(s)) return 'E';
  if (/retirad/.test(s) || /RETIRADO/.test(d)) return 'X';
  if (/rejeitad|prejudicad/.test(s) || /REJEITADO|PREJUDICADO/.test(d)) return 'R';
  if (/arquivad/.test(s) || /ARQUIVADO/.test(d)) return 'A';
  if (/tramitacao encerrada/.test(s)) return 'F';
  if (/transformada em/.test(s)) return 'N';
  return 'T';
}
const reNorma = /Transformad[oa] n[ao] (Lei Ordin[áa]ria|Lei Complementar|Emenda Constitucional|Lei)\s*(?:n[º°.]*\s*)?([\d.]+)\s*\/\s*(\d{4})/i;
const normaKey = (tipo, num, ano) => `${/complementar/i.test(tipo) ? 'LCP' : /emenda/i.test(tipo) ? 'EMC' : 'LEI'}-${String(num).replace(/\./g, '')}-${ano}`;
const normaNome = (k) => { const [t, n, a] = k.split('-'); return `${t === 'LCP' ? 'Lei Complementar' : t === 'EMC' ? 'Emenda Constitucional' : 'Lei'} ${Number(n).toLocaleString('pt-BR')}/${a}`; };

async function camaraAno(y) {
  const base = 'https://dadosabertos.camara.leg.br/arquivos';
  const f = {};
  for (const k of ['proposicoes', 'proposicoesAutores', 'proposicoesTemas']) {
    const file = join(RAW, 'camara', `${k}-${y}.json`);
    if (!OFFLINE) await download(`${base}/${k}/json/${k}-${y}.json`, file, { maxAgeH: 20 });
    f[k] = existsSync(file) ? JSON.parse(await readFile(file, 'utf8')).dados : [];
  }
  const aut = new Map();
  for (const a of f.proposicoesAutores) {
    if (String(a.proponente) !== '1') continue;
    const l = aut.get(a.idProposicao) || []; l.push(a); aut.set(a.idProposicao, l);
  }
  const tem = new Map();
  for (const t of f.proposicoesTemas) {
    const id = Number(String(t.uriProposicao).split('/').pop());
    const l = tem.get(id) || []; l.push(t.tema); tem.set(id, l);
  }
  const out = []; let omit = 0; const semNorma = [];
  for (const p of f.proposicoes) {
    if (!TIPOS_C.has(p.siglaTipo)) continue;
    const ementa = String(p.ementa || '').replace(/\s+/g, ' ').trim();
    if ((p.siglaTipo === 'PDC' || p.siglaTipo === 'PDL') && RADIO_TV(ementa)) { omit++; continue; }
    const st = p.ultimoStatus || {};
    const sc = sitCamara(st.descricaoSituacao);
    const al = (aut.get(p.id) || []).sort((a, b) => Number(a.ordemAssinatura) - Number(b.ordemAssinatura));
    const ai = al.slice(0, 3).map((a) => {
      const uri = String(a.uriAutor || '');
      let tipo = 'O', id = '', nome = String(a.nomeAutor || '').trim();
      if (/\/deputados\/(\d+)/.test(uri)) { tipo = 'D'; id = uri.match(/\/deputados\/(\d+)/)[1]; }
      else if (/poder executivo/i.test(a.tipoAutor) || /^poder executivo|presid[êe]ncia da rep/i.test(nome)) { tipo = 'E'; nome = 'Poder Executivo'; }
      else if (/^senado federal\s*-\s*/i.test(nome)) { tipo = 'S'; nome = nome.replace(/^senado federal\s*-\s*/i, ''); if (/^senador/i.test(nome) || !/comiss|mesa|cpi/i.test(nome)) { const sid = senPorNome.get(norm(nome.replace(/^senador[a]?\s+/i, ''))); if (sid) id = sid; } else tipo = 'O'; }
      return addAutor([nome, tipo, id, tipo === 'E' ? '' : (a.siglaPartidoAutor || ''), tipo === 'E' ? '' : (a.siglaUFAutor || '')]);
    });
    const tg = temaTags(tem.get(p.id) || []).map((t) => TEMA_TAGS.indexOf(t)).filter((i) => i >= 0);
    const ex = {};
    const mN = String(st.despacho || '').match(reNorma);
    if (sc === 'L' && mN) { const k = normaKey(mN[1], mN[2], mN[3]); ex.n = normaNome(k); origem.normas[k] = [`c:${p.id}`, `${p.siglaTipo} ${p.numero}/${p.ano}`]; }
    else if (sc === 'L') semNorma.push(p);
    const ct = String(p.urlInteiroTeor || '').match(/codteor=(\d+)/); if (ct) ex.t = Number(ct[1]);
    out.push([`c:${p.id}`, p.siglaTipo, p.numero, String(p.dataApresentacao || '').slice(0, 10), ai, al.length, tg, sc, addSit(st.descricaoSituacao), ementa, Object.keys(ex).length ? ex : 0]);
  }
  return { out, omit, semNorma };
}

// Para projetos que viraram norma sem número no último despacho: procura na tramitação (com limite por execução).
async function normaPorTramitacao(items, limite) {
  const conhecidas = new Map(Object.entries(origem.normas).map(([k, v]) => [v[0], k]));
  let n = 0;
  for (const it of items) {
    const key = `c:${it.id}`;
    if (conhecidas.has(key)) continue;
    if (n++ >= limite) break;
    try {
      const j = await get(`https://dadosabertos.camara.leg.br/api/v2/proposicoes/${it.id}/tramitacoes`, { tries: 2, timeout: 30000 });
      const tr = (j.dados || []).slice().reverse();
      for (const t of tr) { const m = String(t.despacho || '').match(reNorma); if (m) { const k = normaKey(m[1], m[2], m[3]); origem.normas[k] = [key, `${it.siglaTipo} ${it.numero}/${it.ano}`]; break; } }
    } catch (e) { /* segue */ }
    await sleep(60);
  }
}

function parseAutoria(s) {
  const txt = String(s || '').replace(/\s+e outros\.?$/i, '').trim();
  const outros = /e outros\.?$/i.test(String(s || ''));
  const partes = txt.split(/,\s+(?=Senador|Senadora|Deputad|Comiss|C[âa]mara|Presid|Mesa|CPI)/).map((x) => x.trim()).filter(Boolean);
  return { partes, outros };
}
async function senadoAno(y) {
  const siglas = y <= 2018 ? ['PLS', 'PEC', 'PDS', 'PRS'] : ['PL', 'PLP', 'PEC', 'PDL', 'PRS'];
  const out = []; let omit = 0;
  for (const sg of siglas) {
    const file = join(RAW, 'sen-proc', `${sg}-${y}.json`);
    let d = null;
    if (!OFFLINE) { try { d = await get(`https://legis.senado.leg.br/dadosabertos/processo?sigla=${sg}&ano=${y}`, { timeout: 180000 }); const { writeFile, mkdir } = await import('node:fs/promises'); await mkdir(join(RAW, 'sen-proc'), { recursive: true }); await writeFile(file, JSON.stringify(d)); } catch (e) { log('senado falhou', sg, y, e.message); } }
    if (!d && existsSync(file)) d = JSON.parse(await readFile(file, 'utf8'));
    for (const x of d || []) {
      if (x.objetivo === 'Revisora') continue;
      const ementa = String(x.ementa || '').replace(/\s+/g, ' ').trim();
      if ((sg === 'PDS' || sg === 'PDL') && RADIO_TV(ementa)) { omit++; continue; }
      const m = String(x.identificacao || '').match(/^(\S+)\s+(\d+)\/(\d{4})(.*)$/);
      if (!m) continue;
      const { partes, outros } = parseAutoria(x.autoria);
      const ai = partes.slice(0, 3).map((p) => {
        let tipo = 'O', id = '', nome = p, part = '', uf = '';
        const mm = p.match(/^(Senador[a]?|Deputad[oa])\s+(.+?)\s*\(([^/()]+)\/([A-Z]{2})\)$/);
        if (mm) { tipo = /^Senador/.test(mm[1]) ? 'S' : 'D'; nome = mm[2]; part = mm[3]; uf = mm[4]; if (tipo === 'S') id = senPorNome.get(norm(nome)) || ''; }
        else if (/^Presid[êe]ncia da Rep/i.test(p)) { tipo = 'E'; nome = 'Poder Executivo'; }
        return addAutor([nome, tipo, id, part, uf]);
      });
      const sc = sitSenado(x);
      const ex = {};
      if (x.normaGerada) {
        ex.n = String(x.normaGerada).replace(/ de \d{2}\/\d{2}\/\d{4}$/, '').replace(/nº /, '');
        const mn = String(x.normaGerada).match(/^(Lei Complementar|Emenda Constitucional|Lei)\s+nº\s+([\d.]+)\s+de\s+\d{2}\/\d{2}\/(\d{4})/);
        if (mn) { const k = normaKey(mn[1], mn[2], mn[3]); if (!origem.normas[k]) origem.normas[k] = [`s:${x.codigoMateria}`, `${m[1]} ${Number(m[2])}/${m[3]}`]; }
      }
      if (m[4] && m[4].trim()) ex.f = m[4].trim().replace(/[()]/g, '');
      if (outros) ex.o = 1;
      out.push([`s:${x.codigoMateria}`, m[1], Number(m[2]), String(x.dataApresentacao || '').slice(0, 10), ai, outros ? Math.max(ai.length + 1, 2) : partes.length, [], sc, addSit(x.situacaoAtual), ementa, Object.keys(ex).length ? ex : 0]);
    }
    await sleep(300);
  }
  return { out, omit };
}

const anosIdx = indice.anos || {};
const omitidos = indice.omitidos || {};
for (const y of anos) {
  if (y < 1988) continue;
  const c = await camaraAno(y);
  if (!OFFLINE && c.semNorma.length) await normaPorTramitacao(c.semNorma, Number(args.tram ?? 150));
  // aplica normas encontradas por tramitação
  const porProp = new Map(Object.entries(origem.normas).map(([k, v]) => [v[0], k]));
  for (const it of c.out) if (it[7] === 'L' && !(it[10] && it[10].n) && porProp.has(it[0])) it[10] = { ...(it[10] || {}), n: normaNome(porProp.get(it[0])) };
  // MPs: a situação final vem do Congresso Nacional (atos/{ano}.json, gerado por normas.mjs a partir do Senado)
  const atos = await readJSON(join(GOV, 'atos', `${y}.json`), null);
  if (atos?.mpv?.length) {
    const MAP = { C: ['L', 'Aprovada com mudanças e transformada em lei (Congresso Nacional)'], I: ['L', 'Aprovada e transformada em lei (Congresso Nacional)'], E: ['E', 'Perdeu a eficácia (Congresso Nacional)'], J: ['R', 'Rejeitada (Congresso Nacional)'], P: ['R', 'Prejudicada (Congresso Nacional)'], D: ['X', 'Devolvida pela Presidência do Congresso'], V: ['X', 'Revogada pelo Poder Executivo'], R: ['N', 'Reeditada (Congresso Nacional)'] };
    const mp = new Map(atos.mpv.map((r) => [r[0], r]));
    for (const it of c.out) {
      if (it[1] !== 'MPV' || !['T', '?', 'F'].includes(it[7])) continue;
      const r = mp.get(Number(it[2])); const m = r && MAP[r[5]]; if (!m) continue;
      it[7] = m[0]; it[8] = addSit(m[1]);
      if (m[0] === 'L' && r[6]) it[10] = { ...(it[10] || {}), n: r[6].replace(/nº /, '') };
    }
  }
  const s = await senadoAno(y);
  const itens = [...c.out, ...s.out].sort((a, b) => (b[3] || '').localeCompare(a[3] || '') || String(a[0]).localeCompare(String(b[0])));
  const cont = {}; for (const it of itens) cont[it[7]] = (cont[it[7]] || 0) + 1;
  const tipos = {}; for (const it of itens) tipos[it[1]] = (tipos[it[1]] || 0) + 1;
  anosIdx[y] = { n: itens.length, c: c.out.length, s: s.out.length, sit: cont, tipos };
  omitidos[y] = c.omit + s.omit;
  await writeIfChanged(join(PROP, 'anos', `${y}.json`), { ano: y, campos: ['chave', 'sigla', 'numero', 'apresentacao', 'autores', 'nAutores', 'temas', 'situacao', 'situacaoTexto', 'ementa', 'extra'], itens });
  log(y, 'câmara', c.out.length, 'senado', s.out.length, 'omitidos rádio/TV', c.omit + s.omit);
}
const out = {
  _sobre: 'Índice do catálogo de propostas. anos: contagem por ano (n total, c Câmara, s Senado, sit por situação, tipos). situacoes: textos oficiais de situação (o índice é usado nas fatias). temas: etiquetas simples de tema (classificação oficial da Câmara agrupada).',
  atualizado: indice.atualizado, situacoes, temas: TEMA_TAGS, anos: anosIdx, omitidos,
  codigos: { L: 'Virou lei (ou emenda à Constituição)', T: 'Em tramitação', A: 'Arquivada', R: 'Rejeitada ou prejudicada', X: 'Retirada ou devolvida ao autor', E: 'Perdeu a validade (prazo)', V: 'Vetada por inteiro', N: 'Virou outra proposta', F: 'Tramitação encerrada (sem resultado informado)', '?': 'Sem situação informada' },
  fontes: [
    { nome: 'Câmara dos Deputados — arquivos anuais de proposições, autores e temas', url: 'https://dadosabertos.camara.leg.br/swagger/api.html#staticfile' },
    { nome: 'Senado Federal — Dados Abertos /processo (matérias iniciadas no Senado)', url: 'https://legis.senado.leg.br/dadosabertos/docs/' },
  ],
  notas: [
    'Tipos incluídos: PL, PLP, PEC, MPV, PDC/PDL, PLV e PLN (Câmara); PLS, PL, PLP, PEC, PDS/PDL e PRS iniciados no Senado. Projetos do Senado que foram para a Câmara aparecem também na lista da Câmara com o número de lá.',
    'Projetos de decreto legislativo que só aprovam concessões e renovações de rádio e TV foram deixados de fora para manter os dados leves (contagem em "omitidos").',
    'Proposições antigas podem não ter situação ou autoria registradas nos dados abertos.',
  ],
};
let mudou = false;
for (const y of anos) if (anosIdx[y]) mudou = true;
out.atualizado = hojeBR();
const changedIdx = JSON.stringify({ ...out, atualizado: indice.atualizado }) !== JSON.stringify({ ...indice, atualizado: indice.atualizado });
if (changedIdx || !indice.atualizado) await writeIfChanged(join(PROP, 'indice.json'), out);
await writeIfChanged(join(PROP, 'autores.json'), autores);
await writeIfChanged(join(PROP, 'normas-origem.json'), origem);
