#!/usr/bin/env python3
"""Grava politica/data/gastos/meta.json (carimbo de geração e tamanho dos dados)."""
import os, sys, json
sys.path.insert(0, os.path.dirname(__file__))
from common import OUT, write_json, now_brt

def main():
    total = 0; n = 0; maior = ('', 0)
    for root, _, files in os.walk(OUT):
        for f in files:
            if not f.endswith('.json') or f == 'meta.json':
                continue
            s = os.path.getsize(os.path.join(root, f)); total += s; n += 1
            if s > maior[1]:
                maior = (os.path.relpath(os.path.join(root, f), OUT), s)
    write_json('meta.json', {'gerado_em': now_brt(), 'arquivos': n, 'bytes': total, 'maior_arquivo': {'nome': maior[0], 'bytes': maior[1]}})
    print(f'meta: {n} arquivos, {total/1e6:.1f} MB; maior: {maior[0]} ({maior[1]/1e6:.2f} MB)')
    if maior[1] > 20e6:
        raise SystemExit('ERRO: arquivo acima de 20 MB')

if __name__ == '__main__':
    main()
