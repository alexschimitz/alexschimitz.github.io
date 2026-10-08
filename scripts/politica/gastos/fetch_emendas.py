#!/usr/bin/env python3
"""Emendas parlamentares (Portal da Transparência, download em massa, sem chave).

Fonte: https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares/UNICO
Grava em politica/data/gastos/emendas/:
  resumo.json        totais por ano, tipo de emenda, área (função) e UF de destino
  autores.json       um registro por autor (parlamentar, bancada, comissão, relator)
  a/{codigo}.json    detalhe de cada autor: por ano, área e cidade/estado de destino
"""
import csv
import glob
import io
import os
import re
import sys
import unicodedata
import zipfile
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from common import OUT, RAW, download, r0, read_json, today, update_sources, write_json  # noqa: E402

URL = 'https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares/UNICO'
TIPOS = {
    'Emenda Individual - Transferências com Finalidade Definida': 'Individual (com destino definido)',
    'Emenda Individual - Transferências Especiais': 'Individual ("emenda Pix")',
    'Emenda de Bancada': 'Bancada estadual',
    'Emenda de Comissão': 'Comissão',
    'Emenda de Relator': 'Relator-geral',
}


def num(s):
    s = (s or '').strip()
    if not s:
        return 0.0
    return float(s.replace('.', '').replace(',', '.'))


def norm(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode()
    return re.sub(r'\s+', ' ', s).strip().upper()


def main():
    raw = os.path.join(RAW, 'emendas', 'emendas.zip')
    os.makedirs(os.path.dirname(raw), exist_ok=True)
    if not os.path.exists(raw) or os.path.getmtime(raw) < __import__('time').time() - 3 * 86400:
        download(URL, raw, min_bytes=1_000_000)
    with zipfile.ZipFile(raw) as z:
        name = next(n for n in z.namelist() if n.lower() == 'emendasparlamentares.csv')
        data = z.read(name).decode('latin-1')
    rows = csv.DictReader(io.StringIO(data, newline=''), delimiter=';')

    # nomes do índice da cota (para ligar autor -> parlamentar quando o nome bate exatamente)
    idx = read_json('parl/indice.json', {}) or {}
    by_name = defaultdict(set)
    for p in idx.get('pessoas', []):
        by_name[norm(p[2])].add(f'{p[0]}-{p[1]}')

    anos = defaultdict(lambda: {'emp': 0.0, 'liq': 0.0, 'pag': 0.0, 'rpp': 0.0, 'n': 0,
                                'tipos': defaultdict(float), 'funcao': defaultdict(float), 'uf': defaultdict(float)})
    aut = {}
    for r in rows:
        y = int(r['Ano da Emenda'])
        emp, liq, pag, rpp = (num(r['Valor Empenhado']), num(r['Valor Liquidado']),
                              num(r['Valor Pago']), num(r['Valor Restos A Pagar Pagos']))
        tipo = TIPOS.get(r['Tipo de Emenda'], r['Tipo de Emenda'])
        fun = r['Nome Função'] or 'Sem informação'
        uf = r['UF'] or 'Sem informação'
        A = anos[y]
        A['emp'] += emp; A['liq'] += liq; A['pag'] += pag; A['rpp'] += rpp; A['n'] += 1
        A['tipos'][tipo] += pag + rpp; A['funcao'][fun] += pag + rpp; A['uf'][uf] += pag + rpp
        cod = r['Código do Autor da Emenda'].strip()
        nome = r['Nome do Autor da Emenda'].strip()
        if cod in ('S/I', '') or nome in ('Sem informação', ''):
            cod, nome = 'si', 'Sem autor informado'
        if nome.upper() == 'RELATOR GERAL':
            cod = 'relator'
        a = aut.get(cod)
        if not a:
            a = aut[cod] = {'nome': nome, 'tipos': defaultdict(float), 'anos': defaultdict(lambda: [0.0, 0.0, 0]),
                            'funcao': defaultdict(float), 'local': defaultdict(float), 'emendas': set()}
        a['tipos'][tipo] += emp
        ay = a['anos'][y]; ay[0] += emp; ay[1] += pag + rpp; ay[2] += 1
        a['funcao'][fun] += pag + rpp
        a['local'][r['Localidade de aplicação do recurso'] or uf] += pag + rpp
        a['emendas'].add(r['Código da Emenda'])

    resumo = {'anos': {}, 'tipos_legenda': list(TIPOS.values()),
              'notas': ['"Pago" soma o que foi pago no próprio ano e os restos a pagar pagos depois.',
                        'Emendas de relator (2020–2022) e várias de comissão não identificam o parlamentar que pediu o dinheiro.',
                        'O nome do autor é o registrado pelo Portal; a ligação com a cota parlamentar só é feita quando o nome bate exatamente.']}
    for y, A in sorted(anos.items()):
        resumo['anos'][str(y)] = {'emp': r0(A['emp']), 'liq': r0(A['liq']), 'pag': r0(A['pag']), 'rp_pago': r0(A['rpp']), 'n': A['n'],
                                  'tipos': {k: r0(v) for k, v in sorted(A['tipos'].items(), key=lambda x: -x[1])},
                                  'funcao': {k: r0(v) for k, v in sorted(A['funcao'].items(), key=lambda x: -x[1])},
                                  'uf': {k: r0(v) for k, v in sorted(A['uf'].items(), key=lambda x: -x[1])}}
    write_json('emendas/resumo.json', resumo)

    lista = []
    keep = set()
    for cod, a in aut.items():
        safe = re.sub(r'[^0-9A-Za-z_-]', '_', cod)
        keep.add(safe)
        link = by_name.get(norm(a['nome']))
        link = next(iter(link)) if link and len(link) == 1 else None
        tipo = max(a['tipos'].items(), key=lambda x: x[1])[0] if a['tipos'] else ''
        emp = sum(v[0] for v in a['anos'].values()); pag = sum(v[1] for v in a['anos'].values())
        lista.append([safe, a['nome'], tipo, r0(emp), r0(pag), len(a['emendas']), min(a['anos']), max(a['anos']),
                      {str(y): [r0(v[0]), r0(v[1])] for y, v in sorted(a['anos'].items())}, link])
        write_json(f'emendas/a/{safe}.json', {
            'codigo': cod, 'nome': a['nome'], 'parlamentar': link,
            'anos': {str(y): {'emp': r0(v[0]), 'pago': r0(v[1]), 'n': v[2]} for y, v in sorted(a['anos'].items())},
            'tipos': {k: r0(v) for k, v in sorted(a['tipos'].items(), key=lambda x: -x[1])},
            'funcao': {k: r0(v) for k, v in sorted(a['funcao'].items(), key=lambda x: -x[1])},
            'local': [[k, r0(v)] for k, v in sorted(a['local'].items(), key=lambda x: -x[1])[:40]],
        })
    for f in glob.glob(os.path.join(OUT, 'emendas', 'a', '*.json')):
        if os.path.basename(f)[:-5] not in keep:
            os.remove(f)
    lista.sort(key=lambda x: -x[3])
    write_json('emendas/autores.json', {'colunas': ['id', 'nome', 'tipo_principal', 'empenhado', 'pago', 'emendas',
                                                    'ano_ini', 'ano_fim', 'por_ano', 'parlamentar'], 'autores': lista})
    ys = sorted(anos)
    update_sources('emendas', {'nome': 'Portal da Transparência (CGU) — Emendas parlamentares, download de dados',
                               'url': URL, 'cobertura': f'{ys[0]}–{ys[-1]}', 'coletado_em': today()})
    print(f'ok Emendas: {len(lista)} autores, {ys[0]}–{ys[-1]}, ligados à cota: {sum(1 for x in lista if x[9])}', flush=True)


if __name__ == '__main__':
    main()
