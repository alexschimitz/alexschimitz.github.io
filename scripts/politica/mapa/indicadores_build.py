#!/usr/bin/env python3
"""Indicadores extras do mapa (politica/data/mapa/ind/ e el/).

Partes (todas de fontes oficiais abertas, sem chave):
  --pib       IBGE/SIDRA tabela 5938 (PIB dos Municípios, variável 37, mil R$ correntes), 2002 até o último ano publicado
  --idhm      Atlas do Desenvolvimento Humano no Brasil (PNUD/IPEA/FJP), censos 1991, 2000 e 2010
  --emendas   Portal da Transparência (CGU), emendas parlamentares (download em massa), somadas por cidade de aplicação
  --eleicoes  TSE, votação por município e zona (presidente): 2022 (2º turno) e 2026 (1º turno; 2º turno quando sair)

Grava:
  ind/{UF}.json   {"uf", "pib_uf": [..], "m": {ibge: [pib por ano]}, "idhm": {ibge: {ano: [idhm, educ, long, renda]}},
                   "em": {ibge: {ano: [empenhado, pago]}}}
  ind/_meta.json  anos e fontes;  ind/_idhm_uf.json  IDHM dos estados e do Brasil
  el/{UF}.json    {"2022": {ibge: [votos cand.1, votos cand.2, válidos]}, "2026": {...}, "2026-2": {...}}
  el/_meta.json   candidatos, turnos e fontes
Sem argumentos roda tudo. Cada parte que falha mantém o que já estava no arquivo.
"""
import argparse
import collections
import csv
import datetime
import io
import json
import os
import sys
import time
import urllib.request
import zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OUT = os.path.join(ROOT, 'politica', 'data', 'mapa')
RAW = os.environ.get('MAPA_RAW', '/workspace/mapa2-raw')
UA = 'Mozilla/5.0 (compatible; alexschimitz.github.io politica/mapa; dados abertos)'
TODAY = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3))).strftime('%Y-%m-%d')

SIDRA = 'https://apisidra.ibge.gov.br/values/t/5938/p/{y}/n{n}/all/v/37/f/c/h/n?formato=json'
ATLAS = 'https://www.atlasbrasil.org.br/cockpit/storage/uploads/dados/censo_total_1991_2010.xlsx'
EMENDAS = 'https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares/UNICO'
TSE = 'https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_{y}.zip'


def get(url, timeout=300, tries=4):
    last = None
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=timeout) as r:
                return r.read()
        except Exception as e:  # noqa
            last = e
            time.sleep(4 * (i + 1))
    raise last


def jdump(path, obj, pretty=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        if pretty:
            json.dump(obj, f, ensure_ascii=False, indent=1, sort_keys=True)
        else:
            json.dump(obj, f, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    os.replace(tmp, path)


def jload(path, default=None):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except Exception:  # noqa
        return default


BASE = jload(os.path.join(OUT, 'municipios.json'))
UF_OF = {row[0]: row[2] for row in BASE['municipios']}
UF_BY_IBGE = {int(u['ibge']): u['uf'] for u in BASE['ufs']}
UFS = sorted(u['uf'] for u in BASE['ufs'])


def ind_docs():
    docs = {}
    for uf in UFS:
        docs[uf] = jload(os.path.join(OUT, 'ind', uf + '.json'), {}) or {}
        docs[uf]['uf'] = uf
    return docs


def save_ind(docs):
    for uf, d in docs.items():
        jdump(os.path.join(OUT, 'ind', uf + '.json'), d)


def build_pib(docs, meta):
    y0, years = 2002, []
    y = y0
    data = {}
    while True:
        try:
            arr = json.loads(get(SIDRA.format(y=y, n=6)))
        except Exception as e:  # noqa
            print(f'PIB {y}: fim ({str(e)[:60]})')
            break
        vals = {}
        for r in arr:
            if r.get('D3C') != '37' or r.get('V') in (None, '-', '..', '...', ''):
                continue
            vals[int(r['D2C'])] = int(round(float(r['V'])))
        if len(vals) < 5000:
            print(f'PIB {y}: só {len(vals)} cidades — ano ainda não publicado')
            break
        data[y] = vals
        years.append(y)
        y += 1
        if y > datetime.date.today().year:
            break
    if not years:
        print('PIB: nada baixado; mantendo arquivos')
        return
    ufv = collections.defaultdict(lambda: [None] * len(years))
    for i, yy in enumerate(years):
        arr = json.loads(get(SIDRA.format(y=yy, n=3)))
        for r in arr:
            if r.get('D3C') == '37' and r.get('V') not in ('-', '..', '...', ''):
                uf = UF_BY_IBGE.get(int(r['D2C']))
                if uf:
                    ufv[uf][i] = int(round(float(r['V'])))
    for uf in UFS:
        docs[uf]['m'] = {}
        docs[uf]['pib_uf'] = ufv[uf]
    for ib, uf in UF_OF.items():
        s = [data[yy].get(ib) for yy in years]
        if any(v is not None for v in s):
            docs[uf]['m'][str(ib)] = s
    meta['pib'] = {
        'anos': years, 'unidade': 'mil reais correntes', 'baixado_em': TODAY,
        'fonte': 'IBGE, PIB dos Municípios — SIDRA tabela 5938 (referência 2010), variável 37: PIB a preços correntes',
        'url': 'https://sidra.ibge.gov.br/tabela/5938',
        'nota': 'PIB por pessoa calculado aqui: PIB ÷ população do IBGE do mesmo ano (pop/). O IBGE publica o PIB municipal com cerca de 2 anos de atraso.'}
    print('PIB anos', years[0], '-', years[-1])


def build_idhm(docs, meta):
    path = os.path.join(RAW, 'censo_total.xlsx')
    if not os.path.exists(path):
        try:
            b = get(ATLAS, timeout=600)
            os.makedirs(RAW, exist_ok=True)
            open(path, 'wb').write(b)
        except Exception as e:  # noqa
            print('IDHM: download falhou; mantendo', e)
            return
    import openpyxl  # noqa
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)

    def rows(sheet):
        ws = wb[sheet]
        it = ws.iter_rows(values_only=True)
        hdr = list(next(it))
        ix = {h: i for i, h in enumerate(hdr)}
        for row in it:
            if row[ix['ANO']] in (1991, 2000, 2010):
                yield ix, row

    def vals(ix, row):
        return [None if row[ix[k]] in (None, '') else round(float(row[ix[k]]), 3) for k in ('IDHM', 'IDHM_E', 'IDHM_L', 'IDHM_R')]

    for uf in UFS:
        docs[uf]['idhm'] = {}
    n = 0
    for ix, row in rows('MUN 91-00-10'):
        ib = int(row[ix['Codmun7']] or 0)
        uf = UF_OF.get(ib)
        if uf:
            docs[uf]['idhm'].setdefault(str(ib), {})[str(row[ix['ANO']])] = vals(ix, row)
            n += 1
    ufd, br = {}, {}
    for ix, row in rows('UF 91-00-10'):
        uf = UF_BY_IBGE.get(row[ix['UF']])
        if uf:
            ufd.setdefault(uf, {})[str(row[ix['ANO']])] = vals(ix, row)
    for ix, row in rows('BR 91-00-10'):
        br[str(row[ix['ANO']])] = vals(ix, row)
    jdump(os.path.join(OUT, 'ind', '_idhm_uf.json'), {
        'fonte': 'Atlas do Desenvolvimento Humano no Brasil (PNUD, IPEA e Fundação João Pinheiro), base dos Censos 1991, 2000 e 2010',
        'url': 'https://www.atlasbrasil.org.br/acervo/biblioteca', 'arquivo': 'censo_total_1991_2010.xlsx',
        'anos': [1991, 2000, 2010], 'campos': ['idhm', 'educacao', 'longevidade', 'renda'], 'uf': ufd, 'br': br})
    meta['idhm'] = {'anos': [1991, 2000, 2010], 'baixado_em': TODAY,
                    'fonte': 'Atlas do Desenvolvimento Humano no Brasil (PNUD, IPEA e FJP) — base dos Censos 1991, 2000 e 2010',
                    'url': 'https://www.atlasbrasil.org.br/acervo/biblioteca',
                    'nota': 'Não existe IDHM municipal oficial depois de 2010 (depende do Censo). Cidades criadas depois de 2010 não têm valor.'}
    print('IDHM linhas', n)


def build_emendas(docs, meta):
    path = os.path.join(RAW, 'emendas.zip')
    alt = '/workspace/pol-gastos-raw/emendas/emendas.zip'
    if os.path.exists(alt) and time.time() - os.path.getmtime(alt) < 7 * 86400:
        path = alt
    elif not os.path.exists(path) or time.time() - os.path.getmtime(path) > 3 * 86400:
        try:
            b = get(EMENDAS, timeout=900)
            os.makedirs(RAW, exist_ok=True)
            open(path, 'wb').write(b)
        except Exception as e:  # noqa
            print('Emendas: download falhou; mantendo', e)
            return

    def num(s):
        s = (s or '').strip()
        return float(s.replace('.', '').replace(',', '.')) if s else 0.0
    agg = collections.defaultdict(lambda: collections.defaultdict(lambda: [0.0, 0.0]))
    ys = set()
    with zipfile.ZipFile(path) as z:
        name = next(n for n in z.namelist() if n.lower() == 'emendasparlamentares.csv')
        with z.open(name) as f:
            for r in csv.DictReader(io.TextIOWrapper(f, encoding='latin-1', newline=''), delimiter=';'):
                cod = (r.get('Código Município IBGE') or '').strip()
                if not cod.isdigit():
                    continue
                ib = int(cod)
                if ib not in UF_OF:
                    continue
                y = int(r['Ano da Emenda'])
                ys.add(y)
                a = agg[ib][y]
                a[0] += num(r['Valor Empenhado'])
                a[1] += num(r['Valor Pago']) + num(r['Valor Restos A Pagar Pagos'])
    for uf in UFS:
        docs[uf]['em'] = {}
    for ib, by in agg.items():
        docs[UF_OF[ib]]['em'][str(ib)] = {str(y): [round(v[0]), round(v[1])] for y, v in sorted(by.items()) if v[0] or v[1]}
    meta['emendas'] = {'anos': sorted(ys), 'baixado_em': TODAY,
                       'fonte': 'Portal da Transparência (CGU) — emendas parlamentares, download em massa',
                       'url': 'https://portaldatransparencia.gov.br/emendas',
                       'nota': 'Só emendas com cidade de aplicação informada (as destinadas a "múltiplos" municípios, ao estado ou ao país ficam de fora). Pago = pago no ano + restos a pagar pagos depois. Valores da época.'}
    print('Emendas cidades', len(agg), 'anos', min(ys), max(ys))


def build_eleicoes():
    from remotezip import RemoteZip  # pip install remotezip
    pm = jload(os.path.join(ROOT, 'politica', 'data', 'politicos', 'municipios.json'), {})
    tse2ib = {int(k): v[2] for k, v in pm.items() if v[2]}
    old_meta = jload(os.path.join(OUT, 'el', '_meta.json'), {}) or {}
    docs = {uf: (jload(os.path.join(OUT, 'el', uf + '.json'), {}) or {}) for uf in UFS}
    meta = dict(old_meta)
    for y, turnos in ((2022, (2,)), (2026, (1, 2))):
        name = f'votacao_candidato_munzona_{y}_BR.csv'
        local = os.path.join(RAW, name)
        try:
            with RemoteZip(TSE.format(y=y)) as z:
                z.extract(name, RAW)
        except Exception as e:  # noqa
            print('TSE', y, 'falhou; mantendo', e)
            continue
        per = {t: collections.defaultdict(collections.Counter) for t in turnos}
        names, gerado = {}, ''
        with open(local, encoding='latin-1', newline='') as f:
            for r in csv.DictReader(f, delimiter=';'):
                if r['CD_CARGO'] != '1':
                    continue
                t = int(r['NR_TURNO'])
                if t not in per or r.get('NM_TIPO_DESTINACAO_VOTOS') not in ('Válido', 'Valido'):
                    continue
                ib = tse2ib.get(int(r['CD_MUNICIPIO']))
                if not ib:
                    continue
                per[t][ib][r['NR_CANDIDATO']] += int(r['QT_VOTOS_NOMINAIS'] or 0)
                names[r['NR_CANDIDATO']] = (r['NM_URNA_CANDIDATO'], r['SG_PARTIDO'])
                gerado = r['DT_GERACAO']
        os.remove(local)
        for t, agg in per.items():
            if len(agg) < 5000:
                continue
            tot = collections.Counter()
            for c in agg.values():
                tot.update(c)
            order = [k for k, _ in tot.most_common(2)]
            key = str(y) if (y, t) != (2026, 2) else '2026-2'
            for uf in UFS:
                docs[uf][key] = {}
            for ib, c in agg.items():
                uf = UF_OF.get(ib)
                if uf:
                    docs[uf][key][str(ib)] = [c.get(order[0], 0), c.get(order[1], 0), sum(c.values())]
            meta[key] = {'ano': y, 'turno': t, 'cargo': 'Presidente', 'arquivo_gerado_em': gerado, 'baixado_em': TODAY,
                         'votos_validos_brasil': sum(tot.values()),
                         'candidatos': [{'nr': int(k), 'urna': names[k][0].title(), 'partido': names[k][1], 'votos_brasil': tot[k]} for k in order],
                         'outros_brasil': sum(tot.values()) - sum(tot[k] for k in order),
                         'fonte': f'TSE — votação por município e zona, {y}' + (f' ({t}º turno)'),
                         'url': 'https://dadosabertos.tse.jus.br/dataset/resultados-' + str(y)}
            print('TSE', key, len(agg), 'cidades', [names[k] for k in order])
    for uf in UFS:
        jdump(os.path.join(OUT, 'el', uf + '.json'), docs[uf])
    jdump(os.path.join(OUT, 'el', '_meta.json'), meta, pretty=True)


def build_uf_summary():
    """ind/_uf.json: números por estado para o mapa do Brasil (um arquivo pequeno em vez de 27)."""
    out = {'pib': {}, 'pop': {}, 'em': {}, 'el': {}}
    meta = jload(os.path.join(OUT, 'ind', '_meta.json'), {}) or {}
    for uf in UFS:
        d = jload(os.path.join(OUT, 'ind', uf + '.json'), {}) or {}
        if d.get('pib_uf'):
            out['pib'][uf] = d['pib_uf']
        pop = jload(os.path.join(OUT, 'pop', uf + '.json'), {}) or {}
        if pop.get('m'):
            a0 = pop['ano0']
            n = len(next(iter(pop['m'].values())))
            tot = []
            for i in range(n):
                vals = [v[i] for v in pop['m'].values() if i < len(v)]
                tot.append(sum(x for x in vals if x) if all(vals) else None)
            out['pop'][uf] = {'ano0': a0, 'v': tot}
        em = collections.defaultdict(lambda: [0, 0])
        for ys in (d.get('em') or {}).values():
            for y, v in ys.items():
                em[y][0] += v[0]
                em[y][1] += v[1]
        if em:
            out['em'][uf] = dict(sorted(em.items()))
        el = jload(os.path.join(OUT, 'el', uf + '.json'), {}) or {}
        for key, cities in el.items():
            if not cities:
                continue
            t = [0, 0, 0]
            for v in cities.values():
                for i in range(3):
                    t[i] += v[i]
            out['el'].setdefault(key, {})[uf] = t
    out['anos_pib'] = (meta.get('pib') or {}).get('anos')
    jdump(os.path.join(OUT, 'ind', '_uf.json'), out)
    print('resumo por UF ok')


def main():
    ap = argparse.ArgumentParser()
    for k in ('pib', 'idhm', 'emendas', 'eleicoes'):
        ap.add_argument('--' + k, action='store_true')
    a = ap.parse_args()
    allp = not (a.pib or a.idhm or a.emendas or a.eleicoes)
    os.makedirs(RAW, exist_ok=True)
    if allp or a.pib or a.idhm or a.emendas:
        docs = ind_docs()
        meta = jload(os.path.join(OUT, 'ind', '_meta.json'), {}) or {}
        for k, fn in (('pib', build_pib), ('idhm', build_idhm), ('emendas', build_emendas)):
            if allp or getattr(a, k):
                try:
                    fn(docs, meta)
                except Exception as e:  # noqa
                    print(k, 'ERRO', e, file=sys.stderr)
        save_ind(docs)
        jdump(os.path.join(OUT, 'ind', '_meta.json'), meta, pretty=True)
    if allp or a.eleicoes:
        try:
            build_eleicoes()
        except Exception as e:  # noqa
            print('eleicoes ERRO', e, file=sys.stderr)
    build_uf_summary()


if __name__ == '__main__':
    main()
