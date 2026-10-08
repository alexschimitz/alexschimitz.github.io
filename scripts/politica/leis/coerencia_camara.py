#!/usr/bin/env python3
"""Casos objetivos de "disse uma coisa, votou outra" em TODAS as votações nominais do plenário da Câmara
(arquivos em lote de dadosabertos.camara.leg.br, 2001 em diante).

  (a) o deputado é autor ou coautor da proposição (proposicoesAutores) e votou NÃO numa votação nominal
      de aprovação do texto dessa mesma proposição (mesmo id). Votações de substitutivos (texto já
      reescrito por um relator) não contam, porque o autor pode estar defendendo o texto original;
  (c) o deputado votou SIM no 1º turno e NÃO no 2º turno de uma PEC (ou o contrário).

Não entram: votações de requerimentos, destaques, emendas do Senado, pressupostos/admissibilidade.
Entrada: diretório com votacoes-{ano}.csv, votacoesVotos-{ano}.csv, votacoesProposicoes-{ano}.csv,
proposicoesAutores-{ano}.csv (baixe com download_camara.sh).
Saída: politica/data/leis/coerencia-camara.json
"""
import csv, glob, json, os, re, sys, time
from collections import defaultdict, Counter
csv.field_size_limit(10**8)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
RAW = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'pol-leis-raw')
OUT = os.path.join(ROOT, 'politica', 'data', 'leis', 'coerencia-camara.json')

RE_MAIN = re.compile(r'^(aprovad|rejeitad)[ao]s?\b.{0,60}?\b(proposta de emenda|projeto|substitutivo|subemenda substitutiva|medida provis|emenda substitutiva|emenda aglutinativa substitutiva|reda[cç][aã]o final|texto)', re.I)
RE_SKIP = re.compile(r'requerimento|destaque|pressupostos|admissibilidade|adequa[cç][aã]o financeira|prefer[eê]ncia|recurso|urg[eê]ncia|quebra de interst|emendas? do senado|substitutivo do senado', re.I)

def rd(path):
    with open(path, encoding='utf-8-sig', errors='replace', newline='') as f:
        yield from csv.DictReader(f, delimiter=';')

def turno(d):
    d = d.lower()
    return 1 if 'primeiro turno' in d else 2 if 'segundo turno' in d else 0

def main():
    t0 = time.time()
    cam2pid = {}
    for f in glob.glob(os.path.join(ROOT, 'politica', 'data', 'politicos', 'p', '*.json')):
        for pid, p in json.load(open(f)).items():
            if 'cam' in p: cam2pid[int(p['cam'])] = pid
    sel = {}
    for f in sorted(glob.glob(os.path.join(RAW, 'votacoes-*.csv'))):
        for r in rd(f):
            if r.get('siglaOrgao') != 'PLEN': continue
            d = (r.get('descricao') or '').strip()
            if RE_SKIP.search(d[:120]) or not RE_MAIN.search(d): continue
            sel[r['id']] = {'dt': r['data'][:10], 'd': d[:300], 'prop': r['id'].split('-')[0], 'tu': turno(d),
                            'sub': 1 if re.search(r'substitutivo|subemenda|emenda substitutiva|aglutinativa', d, re.I) else 0}
    print('votações principais candidatas', len(sel), file=sys.stderr)
    props = {}
    for f in sorted(glob.glob(os.path.join(RAW, 'votacoesProposicoes-*.csv'))):
        for r in rd(f):
            pid = r.get('proposicao_id')
            if pid and pid not in props:
                props[pid] = [r.get('proposicao_siglaTipo') + ' ' + r.get('proposicao_numero') + '/' + r.get('proposicao_ano'), (r.get('proposicao_ementa') or '')[:220]]
    votes = defaultdict(dict)
    for f in sorted(glob.glob(os.path.join(RAW, 'votacoesVotos-*.csv'))):
        for r in rd(f):
            v = r['idVotacao']
            if v not in sel: continue
            try: did = int(r['deputado_id'])
            except: continue
            votes[v][did] = (r['voto'], r['deputado_nome'], r['deputado_siglaPartido'], r['deputado_siglaUf'])
    sel = {k: v for k, v in sel.items() if len(votes.get(k, {})) >= 40}
    print('nominais com votos', len(sel), file=sys.stderr)
    need = {v['prop'] for v in sel.values()}
    autores = defaultdict(dict)
    for f in sorted(glob.glob(os.path.join(RAW, 'proposicoesAutores-*.csv'))):
        for r in rd(f):
            p = r.get('idProposicao')
            if p not in need or r.get('codTipoAutor') != '10000': continue
            try: did = int(r['idDeputadoAutor'])
            except: continue
            o = int(r.get('ordemAssinatura') or 1)
            autores[p][did] = min(o, autores[p].get(did, 99))
    casos = []
    for vid, m in sel.items():
        au = autores.get(m['prop'])
        if not au: continue
        for did, ordem in au.items():
            x = votes[vid].get(did)
            if x and x[0] == 'Não' and not m['sub']:  # substitutivo = texto já modificado: não conta
                casos.append(['a', cam2pid.get(did), did, x[1], x[2], x[3], m['prop'], vid, m['dt'], 'N', {'co': 1 if ordem > 1 else 0, 'sub': m['sub']}])
    byprop = defaultdict(lambda: {1: [], 2: []})
    for vid, m in sel.items():
        if m['tu']: byprop[m['prop']][m['tu']].append(vid)
    for p, t in byprop.items():
        if not t[1] or not t[2]: continue
        v1 = sorted(t[1], key=lambda v: (sel[v]['dt'], v))[0]
        v2 = sorted(t[2], key=lambda v: (sel[v]['dt'], v))[-1]
        for did, x2 in votes[v2].items():
            x1 = votes[v1].get(did)
            if x1 and x1[0] in ('Sim', 'Não') and x2[0] in ('Sim', 'Não') and x1[0] != x2[0]:
                casos.append(['c', cam2pid.get(did), did, x2[1], x2[2], x2[3], p, v2, sel[v2]['dt'], x2[0][0].replace('S', 'S'), {'v1': x1[0][0], 'k1': v1, 'dt1': sel[v1]['dt']}])
    casos.sort(key=lambda c: c[8], reverse=True)
    used = {c[6] for c in casos}
    vused = {c[7] for c in casos} | {c[10].get('k1') for c in casos if c[10].get('k1')}
    out = {'gerado': time.strftime('%Y-%m-%d %H:%M'),
           'sobre': 'Casos objetivos na Câmara (votações nominais de plenário desde 2001). Colunas: tipo, id do perfil, id Câmara, nome, partido, UF, id da proposição, id da votação, data, voto, extra.',
           'n': {'votacoesAnalisadas': len(sel), 'proposicoesComAutorDeputado': sum(1 for p in need if autores.get(p))},
           'props': {p: props.get(p, ['', '']) for p in used},
           'votacoes': {v: [sel[v]['dt'], sel[v]['d']] for v in vused if v in sel},
           'casos': casos}
    json.dump(out, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
    print('casos', Counter(c[0] for c in casos), 'arquivo', os.path.getsize(OUT), 'bytes', round(time.time() - t0), 's', file=sys.stderr)

if __name__ == '__main__':
    main()
