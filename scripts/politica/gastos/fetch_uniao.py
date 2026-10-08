#!/usr/bin/env python3
"""Gastos da União (Poder Executivo federal e demais órgãos dos Orçamentos Fiscal e da Seguridade).

Fontes (todas sem chave):
  * Tesouro Nacional — "Despesas da União - Séries Históricas" (Despesa_Funcao.xlsm e Despesa_Grupo.xls),
    despesa liquidada por função e por grupo, desde 1980.
  * SIOP / SOF — Endpoint SPARQL do Orçamento Federal (2000 em diante): dotação inicial, autorizada,
    empenhado, liquidado e pago por órgão, função, grupo de despesa (GND) e ação.
  * BCB SGS série 433 (IPCA mensal, IBGE) para correção pela inflação.
  * IBGE SIDRA: tabelas 6579 (estimativas), 200 (Censos 1980-2010) e 9514 (Censo 2022) para valores por habitante.

Saída: politica/data/gastos/indices.json, uniao/serie.json, uniao/ano/AAAA.json, uniao/resumo.json
"""
import json, os, re, sys, time, datetime, urllib.parse, math
sys.path.insert(0, os.path.dirname(__file__))
from common import http, download, write_json, read_json, update_sources, RAW, today, now_brt, r0

RAWU = os.path.join(RAW, 'uniao')
os.makedirs(RAWU, exist_ok=True)
THIS_YEAR = datetime.date.today().year

# ---------------------------------------------------------------- índices
def build_indices():
    b, _, _ = http('https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json', timeout=120)
    ipca = json.loads(b)
    idx = 1.0
    monthly = []  # (ano, mes, indice no fim do mes)
    for r in ipca:
        d, m, y = r['data'].split('/')
        idx *= 1 + float(r['valor']) / 100
        monthly.append((int(y), int(m), idx))
    last_y, last_m, last_idx = monthly[-1]
    by_year = {}
    for y, m, v in monthly:
        by_year.setdefault(y, []).append(v)
    # fator para trazer média anual de preços do ano Y até o último mês disponível
    fator = {}
    for y, vals in by_year.items():
        media = sum(vals) / len(vals)
        fator[y] = round(last_idx / media, 6)
    var_ano = {}
    for y in by_year:
        if y - 1 in by_year and len(by_year[y]) == 12:
            var_ano[y] = round((by_year[y][-1] / by_year[y - 1][-1] - 1) * 100, 2)

    # população
    pop, fonte_pop = {}, {}
    def sidra(path):
        b, _, _ = http('https://apisidra.ibge.gov.br/values/' + path, timeout=120)
        return json.loads(b)[1:]
    for r in sidra('t/200/n1/all/v/93/p/all/c2/0/c1/0/c58/0'):
        pop[int(r['D3N'])] = int(r['V']); fonte_pop[int(r['D3N'])] = 'censo'
    for r in sidra('t/9514/n1/all/v/93/p/all/c2/6794/c287/100362/c286/113635'):
        pop[int(r['D3N'])] = int(r['V']); fonte_pop[int(r['D3N'])] = 'censo'
    for r in sidra('t/6579/n1/all/v/all/p/all'):
        y = int(r['D3N'])
        if y not in pop:
            pop[y] = int(r['V']); fonte_pop[y] = 'estimativa'
    # interpola (geométrico) anos que faltam entre 1980 e o último disponível
    ys = sorted(pop)
    for y in range(1980, max(ys) + 1):
        if y in pop:
            continue
        a = max(k for k in ys if k < y); c = min(k for k in ys if k > y)
        g = (pop[c] / pop[a]) ** (1 / (c - a))
        pop[y] = int(round(pop[a] * g ** (y - a))); fonte_pop[y] = 'interpolado'
    if THIS_YEAR not in pop:
        pop[THIS_YEAR] = pop[max(pop)]; fonte_pop[THIS_YEAR] = 'repetido do ano anterior'
    out = {
        'ipca': {
            'serie': 'BCB SGS 433 (IPCA, IBGE) — variação mensal',
            'ultimo_mes': f'{last_y}-{last_m:02d}',
            'fator_para_hoje': {str(k): v for k, v in sorted(fator.items())},
            'variacao_ano': {str(k): v for k, v in sorted(var_ano.items())},
        },
        'populacao': {str(k): pop[k] for k in sorted(pop) if k >= 1980},
        'populacao_fonte': {str(k): fonte_pop[k] for k in sorted(pop) if k >= 1980},
    }
    write_json('indices.json', out)
    update_sources('ipca', {'nome': 'IPCA mensal (IBGE) via Banco Central — SGS 433',
                            'url': 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json',
                            'cobertura': f'1980-01 a {last_y}-{last_m:02d}', 'coletado_em': today()})
    update_sources('populacao', {'nome': 'População — IBGE SIDRA (tabelas 6579, 200 e 9514)',
                                 'url': 'https://sidra.ibge.gov.br/tabela/6579',
                                 'cobertura': 'Censos 1980, 1991, 2000, 2010, 2022; estimativas 2001–%d; demais anos interpolados' % max(k for k, v in fonte_pop.items() if v == 'estimativa'),
                                 'coletado_em': today()})
    return out

# ---------------------------------------------------------------- Tesouro: séries históricas
SERIES_URL = 'https://www.tesourotransparente.gov.br/publicacoes/despesas-da-uniao-series-historicas'

def tesouro_series():
    b, final, _ = http(SERIES_URL, timeout=120)
    html = b.decode('utf-8', 'ignore')
    links = dict((t, u) for u, t in re.findall(r'href="(https://thot-arquivos\.tesouro\.gov\.br/publicacao-anexo/\d+)" title="([^"]+)"', html))
    pub = re.search(r'Publicado em (\d\d/\d\d/\d{4})', html)
    titulo = re.search(r'<h1[^>]*>([^<]+)</h1>', html)
    fpath = os.path.join(RAWU, 'Despesa_Funcao.xlsm'); gpath = os.path.join(RAWU, 'Despesa_Grupo.xls')
    download(links['Despesa_Funcao.xlsm'], fpath, min_bytes=100000)
    download(links['Despesa_Grupo.xls'], gpath, min_bytes=100000)
    import openpyxl, xlrd
    def parse_rows(rows, year):
        head = ' '.join(str(c) for r in rows[:12] for c in r if c)
        moeda = 'R$'
        for code, pat in (('Cz$', r'Cz\$'), ('NCz$', r'NCz\$'), ('Cr$', r'Cr\$'), ('CR$', r'CR\$')):
            pass
        notas = [str(r[0]) for r in rows if r and isinstance(r[0], str) and (r[0].startswith('Nota') or r[0].startswith('¹') or r[0].startswith('1 ') or r[0].strip().startswith('Excet') or 'Cz$' in r[0] or 'Cr$' in r[0] or 'CR$' in r[0])]
        period = ''
        for r in rows[:8]:
            for c in r:
                if isinstance(c, str) and re.search(r'(EXERC[ÍI]CIO|DEZEMBRO|JANEIRO|AGOSTO|SETEMBRO|JULHO|JUNHO|MAIO|ABRIL|MARÇO|FEVEREIRO|OUTUBRO|NOVEMBRO) ', c):
                    period = c.strip()
        unit = ' '.join(str(c) for r in rows[:9] for c in r if isinstance(c, str) and ('$' in c))
        items = []
        started = False
        for r in rows:
            if not r or r[0] in (None, ''):
                continue
            name = str(r[0]).strip()
            if name.upper() in ('FUNÇÃO', 'GRUPO DE DESPESA'):
                started = True; continue
            if not started:
                continue
            if name.startswith('Fonte'):
                break
            vals = [c for c in r[1:3]]
            v1 = vals[0] if isinstance(vals[0], (int, float)) else None
            v2 = vals[1] if len(vals) > 1 and isinstance(vals[1], (int, float)) else None
            if v1 is None:
                continue
            items.append([re.sub(r'\d$', '', name).strip(), r0(v1), r0(v2) if v2 is not None else None])
        return {'periodo': period, 'unidade': unit.strip(), 'notas': notas, 'itens': items}
    out = {'funcao': {}, 'grupo': {}}
    wb = openpyxl.load_workbook(fpath, data_only=True, read_only=True)
    for ws in wb.worksheets:
        if re.fullmatch(r'\d{4}', ws.title):
            out['funcao'][ws.title] = parse_rows([list(r) for r in ws.iter_rows(values_only=True)], int(ws.title))
    bk = xlrd.open_workbook(gpath)
    for s in bk.sheets():
        if re.fullmatch(r'\d{4}', s.name):
            rows = [[(c if c != '' else None) for c in s.row_values(i)] for i in range(s.nrows)]
            out['grupo'][s.name] = parse_rows(rows, int(s.name))
    out['publicacao'] = {'titulo': titulo.group(1).strip() if titulo else '', 'publicado_em': pub.group(1) if pub else '', 'url': final}
    update_sources('tesouro_series', {
        'nome': 'Tesouro Nacional — Despesas da União: Séries Históricas (por função e por grupo de despesa)',
        'url': final, 'arquivos': [links['Despesa_Funcao.xlsm'], links['Despesa_Grupo.xls']],
        'cobertura': f"{min(out['funcao'])}–{max(out['funcao'])} (último ano parcial: {out['funcao'][max(out['funcao'])]['periodo']})",
        'publicado_em': out['publicacao']['publicado_em'], 'coletado_em': today()})
    write_json('uniao/serie.json', out)
    return out

# ---------------------------------------------------------------- SIOP
SPARQL = 'https://www1.siop.planejamento.gov.br/sparql/'
Q = '''PREFIX loa: <http://vocab.e.gov.br/2013/09/loa#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?esf ?org ?dorg ?uo ?duo ?aca ?daca ?fun ?gnd ?fon ?dfon (sum(?v2) as ?ini) (sum(?v3) as ?atu) (sum(?v4) as ?emp) (sum(?v5) as ?liq) (sum(?v6) as ?pag) WHERE { GRAPH <http://orcamento.dados.gov.br/%d/> {
 ?i loa:temEsfera ?e . ?e loa:codigo ?esf .
 ?i loa:temUnidadeOrcamentaria ?u . ?u loa:codigo ?uo . ?u rdfs:label ?duo . ?u loa:temOrgao ?o . ?o loa:codigo ?org . ?o rdfs:label ?dorg .
 ?i loa:temAcao ?a . ?a loa:codigo ?aca . ?a rdfs:label ?daca .
 ?i loa:temFuncao ?f . ?f loa:codigo ?fun .
 ?i loa:temGND ?g . ?g loa:codigo ?gnd .
 ?i loa:temFonteRecursos ?fo . ?fo loa:codigo ?fon . ?fo rdfs:label ?dfon .
 ?i loa:valorDotacaoInicial ?v2 . ?i loa:valorLeiMaisCredito ?v3 . ?i loa:valorEmpenhado ?v4 . ?i loa:valorLiquidado ?v5 . ?i loa:valorPago ?v6 .
}} GROUP BY ?esf ?org ?dorg ?uo ?duo ?aca ?daca ?fun ?gnd ?fon ?dfon'''
QDATA = '''PREFIX loa: <http://vocab.e.gov.br/2013/09/loa#>
SELECT DISTINCT ?data WHERE { GRAPH <http://orcamento.dados.gov.br/%d/> { ?x loa:dataUltimaAtualizacao ?data } } LIMIT 5'''

def sparql(q, timeout=900):
    data = urllib.parse.urlencode({'query': q}).encode()
    b, _, _ = http(SPARQL, data=data, headers={'Accept': 'application/sparql-results+json'}, timeout=timeout, tries=3)
    return json.loads(b)['results']['bindings']

REFIN_FONTE = re.compile(r'^(t[ií]tulos.*)?refinanciamento da d[ií]vida', re.I)
REFIN = re.compile(r'refinanciamento da d[ií]vida|refinanciamento pela uni[aã]o|corre[cç][aã]o monet[aá]ria e cambial da d[ií]vida', re.I)

def siop_year(y):
    raw = os.path.join(RAWU, f'siop2-{y}.json')
    if not (os.path.exists(raw) and y < THIS_YEAR - 1 and os.path.getsize(raw) > 1000):
        t = time.time()
        rows = sparql(Q % y)
        with open(raw, 'w') as f:
            json.dump(rows, f)
        print(f'  SIOP {y}: {len(rows)} linhas em {time.time()-t:.0f}s', flush=True)
    with open(raw) as f:
        rows = json.load(f)
    try:
        upd = [r['data']['value'] for r in sparql(QDATA % y, timeout=120)]
    except Exception:
        upd = []
    orgaos, uos, acoes_nome = {}, {}, {}
    cube = {}
    acoes = {}
    for r in rows:
        g = lambda k: r[k]['value'] if k in r else ''
        esf, org, uo, aca, fun, gnd = g('esf'), g('org'), g('uo'), g('aca'), g('fun'), g('gnd')
        orgaos[org] = g('dorg').strip(); uos[uo] = g('duo').strip()
        nome = g('daca').strip()
        # Rolagem = despesa paga com a fonte "Refinanciamento da Dívida Pública" (143/343/1443/3443…),
        # mesmo critério do Tesouro para separar o refinanciamento.
        refin = 1 if (g('fon').endswith('43') and REFIN_FONTE.search(g('dfon'))) else 0
        vals = [float(g(k) or 0) for k in ('ini', 'atu', 'emp', 'liq', 'pag')]
        key = (esf, org, fun, gnd, refin)
        c = cube.setdefault(key, [0.0] * 5)
        for i in range(5): c[i] += vals[i]
        ak = (org, uo, aca, fun, refin)
        acoes_nome[aca + '|' + nome] = nome
        a = acoes.setdefault(ak, {'n': nome, 'v': [0.0] * 5})
        for i in range(5): a['v'][i] += vals[i]
    cubo = [[k[0], k[1], k[2], k[3], k[4]] + [r0(x) for x in v] for k, v in sorted(cube.items()) if any(abs(x) >= 0.5 for x in v)]
    # ações: dicionário de nomes para economizar espaço
    names = []; nidx = {}
    acl = []
    for k, a in sorted(acoes.items(), key=lambda kv: -kv[1]['v'][3]):
        if not any(abs(x) >= 0.5 for x in a['v']):
            continue
        if a['n'] not in nidx:
            nidx[a['n']] = len(names); names.append(a['n'])
        acl.append([k[0], k[1], k[2], nidx[a['n']], k[3], k[4]] + [r0(x) for x in a['v']])
    out = {
        'ano': y,
        'atualizado_fonte': sorted(set(upd))[-1] if upd else '',
        'colunas_cubo': ['esfera', 'orgao', 'funcao', 'gnd', 'refin', 'dotacao_inicial', 'autorizado', 'empenhado', 'liquidado', 'pago'],
        'colunas_acoes': ['orgao', 'uo', 'acao', 'nome_idx', 'funcao', 'refin', 'dotacao_inicial', 'autorizado', 'empenhado', 'liquidado', 'pago'],
        'orgaos': dict(sorted(orgaos.items())),
        'cubo': cubo,
    }
    cols_ac = out.pop('colunas_acoes')
    size = write_json(f'uniao/ano/{y}.json', out)
    size += write_json(f'uniao/acoes/{y}.json', {
        'ano': y,
        'colunas': cols_ac,
        'uos': dict(sorted(uos.items())),
        'nomes': names,
        'acoes': acl,
    })
    return out, size


def resumo_from_years(years_data):
    """Resumo leve (todos os anos) para gráficos de linha: totais por ano, por órgão, função e GND (liquidado e dotação)."""
    res = {'anos': {}, 'orgaos_nomes': {}}
    for y, d in sorted(years_data.items()):
        tot = [0] * 5; tot_sem_refin = [0] * 5
        org, fun, gnd = {}, {}, {}
        for row in d['cubo']:
            esf, o, f, g, refin = row[:5]; v = row[5:]
            if esf not in ('10', '20'):
                continue  # só orçamentos Fiscal (10) e Seguridade (20)
            for i in range(5):
                tot[i] += v[i]
                if not refin: tot_sem_refin[i] += v[i]
            if refin:
                continue
            for dct, k in ((org, o), (fun, f), (gnd, g)):
                a = dct.setdefault(k, [0, 0, 0])
                a[0] += v[0]; a[1] += v[3]; a[2] += v[4]
        res['anos'][str(y)] = {'total': tot, 'sem_refin': tot_sem_refin, 'orgao': org, 'funcao': fun, 'gnd': gnd,
                               'atualizado_fonte': d.get('atualizado_fonte', '')}
        for k, n in d['orgaos'].items():
            res['orgaos_nomes'][k] = n  # nome mais recente prevalece
    write_json('uniao/resumo.json', res)
    return res


def main():
    only = os.environ.get('GASTOS_UNIAO_ANOS')  # ex.: "2024,2025,2026"
    print('Índices (IPCA, população)…', flush=True)
    build_indices()
    print('Tesouro: séries históricas…', flush=True)
    try:
        tesouro_series()
    except Exception as e:
        print('  AVISO: falha nas séries do Tesouro:', e, flush=True)
    print('SIOP: orçamento por ano…', flush=True)
    years = list(range(2000, THIS_YEAR + 1))
    if only:
        refresh = set(int(x) for x in only.split(','))
    else:
        refresh = set()  # anos antigos já gravados não mudam; o ano atual e o anterior sempre são refeitos
    data = {}
    total = 0
    for y in years:
        existing = read_json(f'uniao/ano/{y}.json')
        if y in refresh or existing is None or y >= THIS_YEAR - 1:
            try:
                d, s = siop_year(y)
                data[y] = d; total += s
                continue
            except Exception as e:
                print(f'  AVISO: SIOP {y} falhou: {e}', flush=True)
        if existing:
            data[y] = existing
    resumo_from_years(data)
    update_sources('siop', {'nome': 'SIOP / Secretaria de Orçamento Federal — Endpoint SPARQL do Orçamento Federal',
                            'url': 'https://www1.siop.planejamento.gov.br/sparql/',
                            'doc': 'https://www1.siop.planejamento.gov.br/siopdoc/doku.php/acesso_publico:dados_abertos',
                            'cobertura': f'{min(data)}–{max(data)}', 'coletado_em': today()})
    print('ok União', flush=True)


if __name__ == '__main__':
    main()
