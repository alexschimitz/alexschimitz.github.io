#!/usr/bin/env python3
"""Liga deputados/senadores da cota ao diretório de políticos (politica/data/politicos/p/*.json).

Lê os campos "cam" (id na Câmara) e "sen" (código no Senado) de cada perfil e grava
politica/data/gastos/parl/politicos_ids.json = {"c-<id>": "<id do diretório>", "s-<id>": ...}
só para quem aparece na cota. Se o diretório não existir, não faz nada.
"""
import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import ROOT, read_json, write_json  # noqa: E402

PDIR = os.path.join(ROOT, 'politica', 'data', 'politicos', 'p')


def main():
    files = glob.glob(os.path.join(PDIR, '*.json'))
    if not files:
        print('diretório de políticos ausente; nada a ligar')
        return
    idx = read_json('parl/indice.json', {}) or {}
    want = {f'{p[0]}-{p[1]}' for p in idx.get('pessoas', [])}
    out = {}
    for f in files:
        with open(f, encoding='utf-8') as fh:
            d = json.load(fh)
        for pid, p in d.items():
            for k, c in (('cam', 'c'), ('sen', 's')):
                v = p.get(k)
                if v is None:
                    continue
                key = f'{c}-{v}'
                if key in want:
                    out[key] = pid
    write_json('parl/politicos_ids.json', dict(sorted(out.items())))
    print(f'ok ligações com o diretório: {len(out)} de {len(want)}')


if __name__ == '__main__':
    main()
