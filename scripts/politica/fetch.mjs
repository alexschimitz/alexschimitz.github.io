#!/usr/bin/env node
// Coleta dados abertos da Câmara dos Deputados e do Senado Federal e grava JSON compacto
// em politica/data/. Sem dependências externas (Node >= 18, fetch nativo).
// Uso: node scripts/politica/fetch.mjs
import { mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'politica', 'data');
const CAMARA = 'https://dadosabertos.camara.leg.br/api/v2';
const SENADO = 'https://legis.senado.leg.br/dadosabertos';
const UA = 'alexschimitz.github.io politica-tracker (+https://alexschimitz.github.io/politica/)';

const errors = [];
const log = (...a) => console.log('[politica]', ...a);

async function get(url, { type = 'json', tries = 3, timeout = 60000 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeout);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': UA, Accept: type === 'json' ? 'application/json' : 'application/rss+xml, application/xml, text/xml' },
      });
      clearTimeout(t);
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`);
        if (res.status === 429) { // limite de requisições: espera mais antes de tentar de novo
          const ra = Number(res.headers.get('retry-after'));
          err.wait = (Number.isFinite(ra) && ra > 0 ? ra * 1000 : 4000) * (i + 1);
        }
        if (res.status >= 400 && res.status < 500 && res.status !== 429) { err.fatal = true; }
        throw err;
      }
      return type === 'json' ? await res.json() : await res.text();
    } catch (e) {
      last = e;
      if (e.fatal) break;
      await new Promise((r) => setTimeout(r, e.wait || 1200 * (i + 1)));
    }
  }
  throw new Error(`${url} -> ${last?.message || last}`);
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      try { out[k] = await fn(items[k], k); } catch (e) { out[k] = undefined; errors.push(String(e.message || e)); }
    }
  }));
  return out;
}

const ymd = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000);
const arr = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]);
const httpsify = (u) => (u ? String(u).replace(/^http:\/\//, 'https://') : u);

async function save(name, data) {
  const file = join(OUT, name);
  const body = JSON.stringify(data);
  await writeFile(file, body + '\n');
  log(`wrote ${name} (${(body.length / 1024).toFixed(1)} KB)`);
}

async function step(label, fn) {
  try { return await fn(); } catch (e) { errors.push(`${label}: ${e.message || e}`); log('ERRO', label, e.message || e); return null; }
}

// ---------- Câmara ----------
async function deputados() {
  const j = await get(`${CAMARA}/deputados?itens=600&ordem=ASC&ordenarPor=nome`);
  return j.dados.map((d) => ({ id: d.id, n: d.nome, p: d.siglaPartido, uf: d.siglaUf, f: d.urlFoto, e: d.email || null, lg: d.idLegislatura }));
}

async function partidosCamara() {
  const j = await get(`${CAMARA}/partidos?itens=100&ordem=ASC&ordenarPor=sigla`);
  const m = {};
  for (const p of j.dados) m[p.sigla] = p.nome;
  return m;
}

// Detalhes de cada deputado (fallback quando a API não responde ao navegador / CORS)
async function deputadosDetalhes(dep) {
  const res = await pool(dep, 6, async (d) => (await get(`${CAMARA}/deputados/${d.id}`, { tries: 4 })).dados);
  const out = {};
  dep.forEach((d, k) => {
    const x = res[k]; if (!x) return;
    const s = x.ultimoStatus || {}; const g = s.gabinete || {};
    out[d.id] = {
      nc: x.nomeCivil || null, nasc: x.dataNascimento || null, mun: x.municipioNascimento || null, ufn: x.ufNascimento || null,
      esc: x.escolaridade || null, sit: s.situacao || null, cond: s.condicaoEleitoral || null,
      gab: g.sala ? { sala: g.sala, predio: g.predio, tel: g.telefone || null } : null,
      redes: [...(x.redeSocial || []), x.urlWebsite].filter((u) => /^https?:\/\//.test(u || '')),
    };
  });
  return out;
}

const r2 = (n) => Math.round(n * 100) / 100;
const ANO = Number(new Intl.DateTimeFormat('en', { timeZone: 'America/Sao_Paulo', year: 'numeric' }).format(new Date()));
const legInicio = (lg) => 2023 + (Number(lg || 57) - 57) * 4; // 57ª legislatura começou em 2023
const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// Resume uma lista de despesas normalizadas {v, tp, mes, dt, f, doc, url, td, det}
// em: total, por mês, por categoria, maiores fornecedores e maiores documentos.
function resumoGastos(rows, ano) {
  const o = { a: ano, t: 0, n: rows.length, m: {}, tp: {}, f: [], d: [] };
  const forn = new Map();
  for (const x of rows) {
    o.t += x.v;
    o.m[x.mes] = (o.m[x.mes] || 0) + x.v;
    o.tp[x.tp] = (o.tp[x.tp] || 0) + x.v;
    const key = (x.doc || '').replace(/\D/g, '') || cleanName(x.f).toUpperCase() || '?';
    const g = forn.get(key) || { n: cleanName(x.f) || 'Não informado', doc: x.doc || null, v: 0, q: 0 };
    g.v += x.v; g.q += 1; forn.set(key, g);
  }
  o.t = r2(o.t);
  for (const k in o.m) o.m[k] = r2(o.m[k]);
  for (const k in o.tp) o.tp[k] = r2(o.tp[k]);
  o.f = [...forn.values()].sort((a, b) => b.v - a.v).slice(0, 8).map((g) => [g.n, g.doc, r2(g.v), g.q]);
  o.d = [...rows].sort((a, b) => b.v - a.v).slice(0, 6).map((x) => {
    const d = { dt: x.dt || null, v: r2(x.v), f: cleanName(x.f) || null, tp: x.tp };
    if (x.td) d.td = x.td;
    if (x.url) d.url = x.url;
    if (x.det) d.det = cleanName(x.det).slice(0, 160);
    return d;
  });
  return o;
}

// Despesas (CEAP) completas de cada deputado no ano corrente: resumo geral + detalhe por deputado.
async function despesasDeputados(dep) {
  const fetchYear = async (d, y) => {
    const out = [];
    for (let pg = 1; pg <= 30; pg++) {
      const j = await get(`${CAMARA}/deputados/${d.id}/despesas?idLegislatura=${d.lg}&ano=${y}&itens=100&pagina=${pg}`, { tries: 3 });
      out.push(...(j.dados || []));
      if (!j.links?.some((l) => l.rel === 'next')) break;
    }
    return out.map((x) => ({
      v: Number(x.valorLiquido) || 0, tp: cleanName(x.tipoDespesa) || 'Não informado', mes: x.mes,
      dt: x.dataDocumento ? String(x.dataDocumento).slice(0, 10) : null, f: x.nomeFornecedor, doc: x.cnpjCpfFornecedor || null,
      url: x.urlDocumento ? httpsify(x.urlDocumento) : null, td: x.tipoDocumento || null,
    }));
  };
  const run = (y) => pool(dep, 8, async (d) => resumoGastos(await fetchYear(d, y), y));
  let ano = ANO; let res = await run(ano);
  if (!res.some((r) => r?.n)) { ano = ANO - 1; res = await run(ano); } // início de ano sem lançamentos
  const por = {};
  dep.forEach((d, k) => { if (res[k]) por[d.id] = res[k]; });
  return { ano, por };
}

// Proposições de autoria (ou coautoria) de cada deputado na legislatura atual: contagem por tipo
// e as mais recentes com situação atual (detalhe /proposicoes/{id}).
const TIPOS_AUTORIA = ['PL', 'PLP', 'PEC', 'PDL'];
const MAX_PROJ = 10;
async function projetosDeputados(dep) {
  const res = await pool(dep, 4, async (d) => {
    const ini = legInicio(d.lg); const anos = []; for (let y = ini; y <= ANO; y++) anos.push(y);
    const lista = [];
    for (let pg = 1; pg <= 15; pg++) {
      const j = await get(`${CAMARA}/proposicoes?idDeputadoAutor=${d.id}&siglaTipo=${TIPOS_AUTORIA.join(',')}&ano=${anos.join(',')}&ordem=DESC&ordenarPor=id&itens=100&pagina=${pg}`, { tries: 3 });
      lista.push(...(j.dados || []));
      if (!j.links?.some((l) => l.rel === 'next')) break;
    }
    const tp = {}; for (const p of lista) tp[p.siglaTipo] = (tp[p.siglaTipo] || 0) + 1;
    const top = lista.slice(0, MAX_PROJ);
    const det = await pool(top, 3, async (p) => (await get(`${CAMARA}/proposicoes/${p.id}`, { tries: 3 })).dados);
    return {
      desde: ini, n: lista.length, tp,
      it: top.map((p, k) => {
        const s = det[k]?.statusProposicao || {};
        return {
          id: p.id, s: `${p.siglaTipo} ${p.numero}/${p.ano}`, e: p.ementa, dt: p.dataApresentacao || det[k]?.dataApresentacao || null,
          st: s.descricaoSituacao || null, tr: s.descricaoTramitacao || null, sd: s.dataHora || null, org: s.siglaOrgao || null,
        };
      }),
    };
  });
  const por = {};
  dep.forEach((d, k) => { if (res[k]) por[d.id] = res[k]; });
  return por;
}

const VOTO_CAMARA = { 'Sim': 'S', 'Não': 'N', 'Abstenção': 'A', 'Obstrução': 'O', 'Artigo 17': 'P' };
// tipoVoto nulo ocorre em votações secretas: o registro de participação existe, o voto não é divulgado ('V').
const codVotoCamara = (t) => (t == null || t === '' ? 'V' : VOTO_CAMARA[t] || t);

async function votacoesCamara() {
  // Plenário (idOrgao 180). A API limita o intervalo a ~3 meses no mesmo ano: janelas de 85 dias.
  const all = [];
  const seen = new Set();
  for (const [a, b] of [[0, 85], [86, 170]]) {
    let start = daysAgo(b), end = daysAgo(a);
    if (start.getUTCFullYear() !== end.getUTCFullYear()) start = new Date(Date.UTC(end.getUTCFullYear(), 0, 1));
    if (start > end) continue;
    for (let page = 1; page <= 6; page++) {
      const j = await get(`${CAMARA}/votacoes?idOrgao=180&dataInicio=${ymd(start)}&dataFim=${ymd(end)}&itens=100&pagina=${page}&ordem=DESC&ordenarPor=dataHoraRegistro`);
      for (const v of j.dados) if (!seen.has(v.id)) { seen.add(v.id); all.push(v); }
      if (!j.links?.some((l) => l.rel === 'next')) break;
    }
    if (all.length >= 250) break;
  }
  all.sort((x, y) => String(y.dataHoraRegistro).localeCompare(String(x.dataHoraRegistro)));
  log(`câmara: ${all.length} votações de plenário no período`);

  // Votos nominais: verifica cada votação (votações simbólicas retornam lista vazia).
  const MAX_NOMINAIS = 30;
  const nominais = [];
  const scan = all.slice(0, 520);
  for (let i = 0; i < scan.length && nominais.length < MAX_NOMINAIS; i += 16) {
    const chunk = scan.slice(i, i + 16);
    const res = await pool(chunk, 6, async (v) => {
      try { return (await get(`${CAMARA}/votacoes/${v.id}/votos`, { tries: 2 })).dados; }
      catch (e) { if (/HTTP 404/.test(e.message)) return []; throw e; } // 404 = sem votos nominais
    });
    chunk.forEach((v, k) => { if (res[k]?.length) nominais.push({ v, votos: res[k] }); });
  }
  const nominalSet = new Set(nominais.slice(0, MAX_NOMINAIS).map((x) => x.v.id));
  const recentes = all.slice(0, 40);
  const detalheIds = [...new Set([...recentes.map((v) => v.id), ...nominalSet])];
  const det = await pool(detalheIds, 6, async (id) => (await get(`${CAMARA}/votacoes/${id}`)).dados);
  const detMap = Object.fromEntries(detalheIds.map((id, k) => [id, det[k]]));

  const mk = (v, votos) => {
    const d = detMap[v.id] || {};
    const prop = (d.proposicoesAfetadas && d.proposicoesAfetadas[0]) || null;
    const placar = votos ? votos.reduce((acc, x) => { const k = codVotoCamara(x.tipoVoto); acc[k] = (acc[k] || 0) + 1; return acc; }, {}) : null;
    return {
      id: v.id,
      dt: v.dataHoraRegistro || v.data,
      d: v.descricao,
      ap: v.aprovacao,
      ctx: d.descUltimaAberturaVotacao ? d.descUltimaAberturaVotacao.replace(/\s+/g, ' ').trim() : null,
      pr: prop ? { id: prop.id, s: `${prop.siglaTipo} ${prop.numero}/${prop.ano}`, e: prop.ementa } : null,
      nom: !!votos,
      pl: placar,
    };
  };

  const nomList = nominais.slice(0, MAX_NOMINAIS);
  const lista = recentes.map((v) => mk(v, nomList.find((x) => x.v.id === v.id)?.votos));
  const nomOut = nomList.map(({ v, votos }) => mk(v, votos));
  // Votos por deputado, alinhados ao vetor nomOut
  const porDep = {};
  nomList.forEach(({ votos }, idx) => {
    for (const x of votos) {
      const id = x.deputado_?.id; if (!id) continue;
      (porDep[id] ||= Array(nomList.length).fill(null))[idx] = codVotoCamara(x.tipoVoto);
    }
  });
  return { lista, nominais: nomOut, porDep, totalPeriodo: all.length };
}

async function proposicoesCamara() {
  const ini = ymd(daysAgo(30));
  const j = await get(`${CAMARA}/proposicoes?siglaTipo=PL,PLP,PEC,MPV,PDL&dataApresentacaoInicio=${ini}&ordem=DESC&ordenarPor=id&itens=40`);
  const props = j.dados.slice(0, 30);
  const autores = await pool(props, 6, async (p) => (await get(`${CAMARA}/proposicoes/${p.id}/autores`)).dados);
  const det = await pool(props, 6, async (p) => (await get(`${CAMARA}/proposicoes/${p.id}`)).dados);
  return props.map((p, k) => {
    const a = (autores[k] || []).map((x) => x.nome).filter(Boolean);
    const st = det[k]?.statusProposicao || {};
    return {
      id: p.id, s: `${p.siglaTipo} ${p.numero}/${p.ano}`, e: p.ementa, dt: p.dataApresentacao,
      au: a.length ? (a.length > 2 ? `${a[0]} e outros (${a.length})` : a.join(', ')) : null,
      st: st.descricaoSituacao || null, tr: st.descricaoTramitacao || null, sd: st.dataHora || null, org: st.siglaOrgao || null,
    };
  });
}

// ---------- Senado ----------
async function senadores() {
  const j = await get(`${SENADO}/senador/lista/atual.json`);
  const ps = arr(j?.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar);
  return ps.map((p) => {
    const i = p.IdentificacaoParlamentar || {}; const m = p.Mandato || {};
    const fim = m.SegundaLegislaturaDoMandato?.DataFim || m.PrimeiraLegislaturaDoMandato?.DataFim || null;
    return {
      id: Number(i.CodigoParlamentar), n: i.NomeParlamentar, nc: i.NomeCompletoParlamentar,
      p: i.SiglaPartidoParlamentar, uf: i.UfParlamentar, f: httpsify(i.UrlFotoParlamentar),
      url: httpsify(i.UrlPaginaParlamentar), e: i.EmailParlamentar || null,
      bl: i.Bloco?.NomeBloco || null, part: m.DescricaoParticipacao || null, fim,
      mesa: i.MembroMesa === 'Sim', lid: i.MembroLideranca === 'Sim',
    };
  });
}

async function votacoesSenado() {
  const j = await get(`${SENADO}/votacao?dataInicio=${ymd(daysAgo(180))}&dataFim=${ymd(new Date())}`, { timeout: 120000 });
  const lista = arr(j).sort((a, b) => String(b.dataSessao).localeCompare(String(a.dataSessao)) || (b.sequencialVotacao || 0) - (a.sequencialVotacao || 0));
  const sel = lista.slice(0, 40);
  const legenda = {};
  const porSen = {};
  const out = sel.map((v, idx) => {
    const placar = {};
    for (const x of arr(v.votos)) {
      const s = x.siglaVotoParlamentar;
      if (x.descricaoVotoParlamentar) legenda[s] = x.descricaoVotoParlamentar;
      placar[s] = (placar[s] || 0) + 1;
      (porSen[x.codigoParlamentar] ||= Array(sel.length).fill(null))[idx] = s;
    }
    return {
      id: v.codigoSessaoVotacao, dt: v.dataSessao, s: v.identificacao, d: v.descricaoVotacao, e: v.ementa,
      r: v.resultadoVotacao, sec: v.votacaoSecreta === 'S', cm: v.codigoMateria || null, pl: placar,
    };
  });
  return { lista: out, porSen, legenda, totalPeriodo: lista.length };
}

async function processosSenado() {
  const j = await get(`${SENADO}/processo?dataInicioApresentacao=${ymd(daysAgo(30))}&dataFimApresentacao=${ymd(new Date())}`, { timeout: 120000 });
  const TIPOS = new Set(['PL', 'PLP', 'PEC', 'MPV', 'PDL', 'PRS']);
  return arr(j)
    .filter((p) => TIPOS.has(String(p.identificacao || '').split(' ')[0]))
    .sort((a, b) => String(b.dataApresentacao).localeCompare(String(a.dataApresentacao)) || (b.id || 0) - (a.id || 0))
    .slice(0, 30)
    .map((p) => ({ id: p.id, cm: p.codigoMateria, s: p.identificacao, e: p.ementa, dt: p.dataApresentacao, au: p.autoria || null, st: p.situacaoAtual || null }));
}

async function despesasSenado() {
  // CEAPS – Cota para o Exercício da Atividade Parlamentar dos Senadores (dados administrativos do Senado)
  const url = (y) => `https://adm.senado.gov.br/adm-dadosabertos/api/v1/senadores/despesas_ceaps/${y}`;
  let j; let ano = ANO;
  try { j = await get(url(ano), { timeout: 180000 }); } catch (e) { j = null; errors.push(`ceaps ${ano}: ${e.message}`); }
  if (!Array.isArray(j) || !j.length) { ano = ANO - 1; j = await get(url(ano), { timeout: 180000 }); }
  const rows = {};
  for (const x of j) {
    const cod = x.codSenador; if (!cod) continue;
    (rows[cod] ||= []).push({
      v: Number(x.valorReembolsado) || 0, tp: cleanName(x.tipoDespesa) || 'Não informado', mes: x.mes,
      dt: x.data || null, f: x.fornecedor, doc: x.cpfCnpj || null, td: x.tipoDocumento || null, det: x.detalhamento || null,
    });
  }
  const por = {};
  for (const [cod, r] of Object.entries(rows)) por[cod] = resumoGastos(r, ano);
  return { ano, por };
}

// Matérias de autoria (ou coautoria) de cada senador desde o início da legislatura atual.
const TIPOS_SENADO = new Set(['PL', 'PLP', 'PEC', 'PDL', 'PRS']);
async function projetosSenadores(sen) {
  const ini = 2023 + Math.floor((ANO - 2023) / 4) * 4; // início da legislatura atual
  const res = await pool(sen, 4, async (p) => {
    const j = await get(`${SENADO}/processo?codigoParlamentarAutor=${p.id}&dataInicioApresentacao=${ini}-02-01`, { timeout: 120000 });
    const lista = arr(j).filter((x) => TIPOS_SENADO.has(String(x.identificacao || '').split(' ')[0]))
      .sort((a, b) => String(b.dataApresentacao).localeCompare(String(a.dataApresentacao)) || (b.id || 0) - (a.id || 0));
    const tp = {}; for (const x of lista) { const t = String(x.identificacao).split(' ')[0]; tp[t] = (tp[t] || 0) + 1; }
    const nome = norm(p.n);
    return {
      desde: ini, n: lista.length, tp,
      it: lista.slice(0, 12).map((x) => {
        const first = norm(String(x.autoria || '').split(',')[0]);
        return {
          id: x.id, cm: x.codigoMateria || null, s: x.identificacao, e: x.ementa, dt: x.dataApresentacao || null,
          st: x.situacaoAtual || null, sd: x.dataSituacaoAtual || null, tram: x.tramitando === 'Sim',
          pa: !!nome && first.includes(nome), url: httpsify(x.urlDocumento) || null,
        };
      }),
    };
  });
  const por = {};
  sen.forEach((p, k) => { if (res[k]) por[p.id] = res[k]; });
  return por;
}
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// ---------- RSS ----------
function parseRss(xml, max = 15) {
  const items = [];
  const dec = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');
  const strip = (s) => dec(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const tag = (blk, t) => { const m = blk.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, 'i')); return m ? strip(m[1]) : null; };
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const b = m[0];
    const t = tag(b, 'title'); const l = tag(b, 'link');
    if (!t || !l || !/^https:\/\//.test(l)) continue;
    const pd = tag(b, 'pubDate') || tag(b, 'dc:date');
    const dt = pd && !isNaN(Date.parse(pd)) ? new Date(pd).toISOString() : null;
    let desc = tag(b, 'description');
    if (desc && desc.length > 220) desc = desc.slice(0, 217).replace(/\s+\S*$/, '') + '…';
    items.push({ t, l, dt, d: desc || null });
    if (items.length >= max) break;
  }
  return items;
}

const FEEDS = {
  camara: { nome: 'Agência Câmara de Notícias', url: 'https://www.camara.leg.br/noticias/rss/ultimas-noticias' },
  senado: { nome: 'Agência Senado', url: 'https://www12.senado.leg.br/noticias/rss' },
};

// ---------- main ----------
async function main() {
  await mkdir(OUT, { recursive: true });
  const prev = async (name) => { try { return JSON.parse(await readFile(join(OUT, name), 'utf8')); } catch { return null; } };

  const [dep, sen, partidos] = await Promise.all([
    step('deputados', deputados), step('senadores', senadores), step('partidos', partidosCamara),
  ]);
  if (dep?.length) await save('deputados.json', dep);
  if (sen?.length) await save('senadores.json', sen);

  const [vc, vs, pc, ps, ds] = await Promise.all([
    step('votacoes-camara', votacoesCamara), step('votacoes-senado', votacoesSenado),
    step('proposicoes-camara', proposicoesCamara), step('processos-senado', processosSenado),
    step('despesas-senado', despesasSenado),
  ]);
  const oldVot = await prev('votacoes.json');
  await save('votacoes.json', {
    camara: vc ? { lista: vc.lista, nominais: vc.nominais, totalPeriodo: vc.totalPeriodo } : oldVot?.camara || null,
    senado: vs ? { lista: vs.lista, legenda: vs.legenda, totalPeriodo: vs.totalPeriodo } : oldVot?.senado || null,
  });
  const oldVotos = await prev('votos.json');
  await save('votos.json', { camara: vc ? vc.porDep : oldVotos?.camara || {}, senado: vs ? vs.porSen : oldVotos?.senado || {} });
  const oldProp = await prev('proposicoes.json');
  await save('proposicoes.json', { camara: pc || oldProp?.camara || [], senado: ps || oldProp?.senado || [] });

  let det = null; let dd = null; let pjc = null; let pjs = null;
  if (dep?.length) {
    const t0 = Date.now();
    [det, dd, pjc] = await Promise.all([
      step('deputados-detalhes', () => deputadosDetalhes(dep)),
      step('despesas-deputados', () => despesasDeputados(dep)),
      step('projetos-deputados', () => projetosDeputados(dep)),
    ]);
    if (det && Object.keys(det).length) {
      // Quem falhou nesta rodada mantém os dados cadastrais da atualização anterior.
      const oldDet = (await prev('deputados-detalhes.json')) || {};
      for (const d of dep) if (!det[d.id] && oldDet[d.id]) det[d.id] = oldDet[d.id];
      await save('deputados-detalhes.json', det);
    }
    log(`detalhes/despesas/projetos de deputados em ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  if (sen?.length) pjs = await step('projetos-senadores', () => projetosSenadores(sen));

  // Resumo de gastos (ranking) + um arquivo por parlamentar (carregado sob demanda no perfil)
  const oldG = await prev('gastos.json');
  const gastos = { ano: { c: dd?.ano ?? oldG?.ano?.c ?? null, s: ds?.ano ?? oldG?.ano?.s ?? null }, cat: { c: [], s: [] }, c: {}, s: {}, tot: {} };
  const parlFiles = { c: {}, s: {} };
  const addCasa = (casa, list, gPor, pPor) => {
    if (!gPor) { gastos[casa] = oldG?.[casa] || {}; gastos.cat[casa] = oldG?.cat?.[casa] || []; gastos.tot[casa] = oldG?.tot?.[casa] || null; return; }
    const cats = []; const ci = new Map(); const idx = (t) => { if (!ci.has(t)) { ci.set(t, cats.length); cats.push(t); } return ci.get(t); };
    const tot = { t: 0, n: 0, p: 0, m: {}, tp: {} };
    for (const p of list) {
      const g = gPor[p.id];
      if (g && g.n) {
        const topCat = Object.entries(g.tp).sort((a, b) => b[1] - a[1])[0];
        gastos[casa][p.id] = [g.t, g.n, topCat ? idx(topCat[0]) : null];
        tot.t += g.t; tot.n += g.n; tot.p += 1;
        for (const [m, v] of Object.entries(g.m)) tot.m[m] = (tot.m[m] || 0) + v;
        for (const [t, v] of Object.entries(g.tp)) { const k = idx(t); tot.tp[k] = (tot.tp[k] || 0) + v; }
      }
      parlFiles[casa][p.id] = { g: g && g.n ? g : null, pj: pPor?.[p.id] || null };
    }
    tot.t = r2(tot.t); for (const k in tot.m) tot.m[k] = r2(tot.m[k]); for (const k in tot.tp) tot.tp[k] = r2(tot.tp[k]);
    gastos.cat[casa] = cats; gastos.tot[casa] = tot;
  };
  addCasa('c', dep || [], dd?.por, pjc);
  addCasa('s', sen || [], ds?.por, pjs);
  await save('gastos.json', gastos);

  // Arquivos individuais: só regrava quando há dados novos; remove arquivos de quem saiu do exercício.
  for (const casa of ['c', 's']) {
    const dir = join(OUT, 'parl', casa);
    await mkdir(dir, { recursive: true });
    const ids = Object.keys(parlFiles[casa]);
    const fresh = casa === 'c' ? (dd && pjc) : (ds && pjs);
    if (!ids.length || !fresh) {
      // Mantém arquivos anteriores; completa só a parte que veio nova.
      for (const id of ids) {
        const f = join(dir, `${id}.json`);
        let old = null; try { old = JSON.parse(await readFile(f, 'utf8')); } catch { /* novo */ }
        const cur = parlFiles[casa][id];
        await writeFile(f, JSON.stringify({ g: cur.g || old?.g || null, pj: cur.pj || old?.pj || null }) + '\n');
      }
      continue;
    }
    let bytes = 0;
    for (const id of ids) { const body = JSON.stringify(parlFiles[casa][id]); bytes += body.length; await writeFile(join(dir, `${id}.json`), body + '\n'); }
    const keep = new Set(ids.map((id) => `${id}.json`));
    for (const f of await readdir(dir)) if (!keep.has(f)) await rm(join(dir, f));
    log(`wrote parl/${casa}/*.json (${ids.length} arquivos, ${(bytes / 1024).toFixed(0)} KB)`);
  }

  const news = {};
  for (const [k, f] of Object.entries(FEEDS)) {
    const xml = await step(`rss-${k}`, () => get(f.url, { type: 'text' }));
    const items = xml ? parseRss(xml) : null;
    news[k] = { fonte: f.nome, url: f.url, itens: items?.length ? items : ((await prev('noticias.json'))?.[k]?.itens || []) };
  }
  await save('noticias.json', news);

  const meta = {
    atualizadoEm: new Date().toISOString(),
    partidos: partidos || (await prev('meta.json'))?.partidos || {},
    contagem: { deputados: dep?.length ?? null, senadores: sen?.length ?? null },
    fontes: {
      camara: 'https://dadosabertos.camara.leg.br/',
      senado: 'https://legis.senado.leg.br/dadosabertos/',
      ceaps: 'https://adm.senado.gov.br/adm-dadosabertos/',
      rssCamara: FEEDS.camara.url, rssSenado: FEEDS.senado.url,
    },
    anoGastos: gastos.ano,
    erros: errors.slice(0, 20),
  };
  await save('meta.json', meta);
  if (errors.length) log(`${errors.length} erro(s):`, errors.slice(0, 10));
  if (!dep?.length || !sen?.length) { console.error('Falha crítica: listas de parlamentares indisponíveis.'); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(1); });
