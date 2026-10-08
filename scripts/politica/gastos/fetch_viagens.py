#!/usr/bin/env python3
"""Viagens a serviço de todo o governo federal (Portal da Transparência, download anual, sem chave).

Fonte: https://portaldatransparencia.gov.br/download-de-dados/viagens/AAAA (zip com AAAA_Viagem.csv)
Grava em politica/data/gastos/viagens/:
  resumo.json      por ano: totais, por mês e por órgão superior
  ano/{AAAA}.json  por órgão superior: órgãos solicitantes, cargos e destinos mais comuns
Só o ano atual e o anterior são baixados de novo; anos antigos já gravados ficam como estão.
"""
import csv
import datetime
import io
import os
import sys
import zipfile
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from common import RAW, download, r0, read_json, today, update_sources, write_json  # noqa: E402

URL = 'https://portaldatransparencia.gov.br/download-de-dados/viagens/{y}'
THIS_YEAR = datetime.date.today().year
FIRST = int(os.environ.get('GASTOS_VIAGENS_DESDE', '2014'))  # 2011–2013: arquivos oficiais quase vazios
SIG = 'sigilo'


def num(s):
    s = (s or '').strip()
    return float(s.replace('.', '').replace(',', '.')) if s else 0.0


def top(d, n):
    return [[k, r0(v[0]), v[1]] for k, v in sorted(d.items(), key=lambda x: -x[1][0])[:n]]


def year(y):
    raw = os.path.join(RAW, 'viagens', f'{y}.zip')
    os.makedirs(os.path.dirname(raw), exist_ok=True)
    if y >= THIS_YEAR - 1 or not os.path.exists(raw):
        if os.path.exists(raw):
            os.remove(raw)
        download(URL.format(y=y), raw, min_bytes=100_000)
    with zipfile.ZipFile(raw) as z:
        name = next(n for n in z.namelist() if n.endswith('_Viagem.csv'))
        fh = io.TextIOWrapper(z.open(name), encoding='latin-1', newline='')
        rd = csv.DictReader(fh, delimiter=';')
        mes = [[0, 0.0] for _ in range(12)]
        org = {}
        tot = defaultdict(float)
        n = 0
        for r in rd:
            if (r.get('Situação') or '').lower().startswith('n'):  # "Não realizada"
                continue
            try:
                d = datetime.datetime.strptime(r['Período - Data de início'], '%d/%m/%Y')
            except ValueError:
                continue
            if d.year != y:
                continue
            di, pa, de, ou = (num(r['Valor diárias']), num(r['Valor passagens']),
                              num(r['Valor devolução']), num(r['Valor outros gastos']))
            v = di + pa + ou - de
            n += 1
            tot['diarias'] += di; tot['passagens'] += pa; tot['outros'] += ou; tot['devolucao'] += de; tot['total'] += v
            mes[d.month - 1][0] += 1; mes[d.month - 1][1] += v
            cod = r['Código do órgão superior'].strip()
            o = org.get(cod)
            if not o:
                o = org[cod] = {'nome': r['Nome do órgão superior'].strip(), 'n': 0, 'v': 0.0, 'di': 0.0, 'pa': 0.0,
                                'sig_n': 0, 'sig_v': 0.0, 'urg': 0, 'mes': [0.0] * 12,
                                'sol': defaultdict(lambda: [0.0, 0]), 'cargo': defaultdict(lambda: [0.0, 0]),
                                'dest': defaultdict(lambda: [0.0, 0])}
            o['n'] += 1; o['v'] += v; o['di'] += di; o['pa'] += pa; o['mes'][d.month - 1] += v
            if (r.get('Viagem Urgente') or '').upper().startswith('SIM'):
                o['urg'] += 1
            if SIG in (r.get('Nome') or '').lower() or SIG in (r.get('Cargo') or '').lower():
                o['sig_n'] += 1; o['sig_v'] += v
            for k, val in (('sol', r['Nome órgão solicitante']), ('cargo', r['Cargo']), ('dest', r['Destinos'])):
                val = (val or 'Sem informação').strip()
                if k == 'dest':  # "Brasília/DF, Brasília/DF, São Paulo/SP" -> cada lugar uma vez
                    val = ', '.join(dict.fromkeys(x.strip() for x in val.split(',') if x.strip())) or 'Sem informação'
                val = val[:90]
                x = o[k][val]; x[0] += v; x[1] += 1
    orgs = sorted(org.items(), key=lambda x: -x[1]['v'])
    write_json(f'viagens/ano/{y}.json', {
        'ano': y,
        'orgaos': {c: {'nome': o['nome'], 'n': o['n'], 'v': r0(o['v']), 'diarias': r0(o['di']), 'passagens': r0(o['pa']),
                       'sig_n': o['sig_n'], 'sig_v': r0(o['sig_v']), 'urgentes': o['urg'], 'mes': [r0(x) for x in o['mes']],
                       'solicitantes': top(o['sol'], 12), 'cargos': top(o['cargo'], 12), 'destinos': top(o['dest'], 15)}
                   for c, o in orgs},
    })
    return {'n': n, **{k: r0(v) for k, v in tot.items()}, 'meses': [[m[0], r0(m[1])] for m in mes],
            'orgaos': [[c, o['nome'], o['n'], r0(o['v']), o['sig_n'], r0(o['sig_v'])] for c, o in orgs]}


def main():
    cur = read_json('viagens/resumo.json', {}) or {}
    anos = cur.get('anos', {})
    only = os.environ.get('GASTOS_VIAGENS_ANOS')
    for y in range(FIRST, THIS_YEAR + 1):
        want = (only and str(y) in only.split(',')) or y >= THIS_YEAR - 1 or str(y) not in anos
        if not want:
            continue
        try:
            anos[str(y)] = year(y)
            print(f'  viagens {y}: {anos[str(y)]["n"]} viagens, R$ {anos[str(y)]["total"]:,.0f}', flush=True)
        except Exception as e:
            print(f'  AVISO: viagens {y}: {e}', flush=True)
    if not anos:
        return
    write_json('viagens/resumo.json', {'colunas_orgaos': ['codigo', 'nome', 'viagens', 'valor', 'sigilosas', 'valor_sigiloso'],
                                       'anos': dict(sorted(anos.items()))})
    ys = sorted(anos)
    update_sources('viagens', {'nome': 'Portal da Transparência (CGU) — Viagens a serviço, download de dados anual',
                               'url': 'https://portaldatransparencia.gov.br/download-de-dados/viagens',
                               'cobertura': f'{ys[0]}–{ys[-1]}', 'coletado_em': today()})
    print('ok Viagens', flush=True)


if __name__ == '__main__':
    main()
