#!/usr/bin/env python3
"""Etapa 2: baixa (com cache) os dados de mandatos da Câmara e do Senado.

Câmara (https://dadosabertos.camara.leg.br/api/v2): /legislaturas, /deputados?idLegislatura=N,
  /deputados/{id}, /deputados/{id}/historico, /deputados/{id}/mandatosExternos, /deputados (em exercício)
Senado (https://legis.senado.leg.br/dadosabertos): /senador/lista/legislatura/48/58, /senador/{cod},
  /senador/{cod}/mandatos, /senador/{cod}/filiacoes, /senador/lista/atual
Saída: RAW/api/*.json (cache) e RAW/stage/congresso.json (consolidado)
Variável POL_REFRESH=1 força recarregar listas "atuais" e históricos de quem tem mandato em curso.
"""
import json, os, sys, time, hashlib, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

RAW = os.environ.get('POL_RAW', '/workspace/pol-politicos-raw')
C = f'{RAW}/api'
os.makedirs(C, exist_ok=True)
os.makedirs(f'{RAW}/stage', exist_ok=True)
CAM = 'https://dadosabertos.camara.leg.br/api/v2'
SEN = 'https://legis.senado.leg.br/dadosabertos'
LEG_MIN = 48  # 1987–1991: legislatura em exercício quando a Constituição de 1988 foi promulgada


def get(url, fresh=False, tries=5):
    key = hashlib.sha1(url.encode()).hexdigest()[:20]
    path = f'{C}/{key}.json'
    if not fresh and os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'Accept': 'application/json', 'User-Agent': 'alexschimitz.github.io politica (dados abertos)'})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.loads(r.read().decode('utf-8'))
            with open(path + '.tmp', 'w') as f:
                json.dump(data, f, ensure_ascii=False)
            os.replace(path + '.tmp', path)
            return data
        except urllib.error.HTTPError as e:
            last = e
            if e.code == 404:
                return None
            time.sleep(2 * (i + 1))
        except Exception as e:  # rede instável
            last = e
            time.sleep(2 * (i + 1))
    print('FALHA', url, last, file=sys.stderr)
    return None


def as_list(x):
    if x is None:
        return []
    return x if isinstance(x, list) else [x]


def camara(refresh):
    legs = get(f'{CAM}/legislaturas?itens=100&ordem=ASC&ordenarPor=id')['dados']
    legs = [l for l in legs if l['id'] >= LEG_MIN]
    por_leg = {}
    for l in legs:
        atual = l['dataFim'] >= time.strftime('%Y-%m-%d')
        ids, pag = {}, 1
        while True:
            d = get(f"{CAM}/deputados?idLegislatura={l['id']}&itens=1000&pagina={pag}", fresh=refresh and atual)
            for x in d['dados']:
                ids[x['id']] = {'id': x['id'], 'uf': x.get('siglaUf'), 'partido': x.get('siglaPartido'), 'nome': x.get('nome')}
            if not any(k['rel'] == 'next' for k in d.get('links', [])):
                break
            pag += 1
        por_leg[l['id']] = [ids[k] for k in sorted(ids)]
        print('camara leg', l['id'], len(por_leg[l['id']]), flush=True)
    em_exercicio = sorted({x['id'] for x in get(f'{CAM}/deputados?itens=1000', fresh=refresh)['dados']})
    leg_atual = max(por_leg)
    todos = sorted({e['id'] for v in por_leg.values() for e in v})
    ids_atual = {e['id'] for e in por_leg[leg_atual]}

    def one(i):
        fresh = refresh and i in ids_atual
        det = get(f'{CAM}/deputados/{i}', fresh=fresh)
        hist = get(f'{CAM}/deputados/{i}/historico', fresh=fresh)
        ext = get(f'{CAM}/deputados/{i}/mandatosExternos', fresh=fresh)
        return i, {'det': det and det.get('dados'), 'hist': hist and hist.get('dados'), 'ext': ext and ext.get('dados')}

    with ThreadPoolExecutor(int(os.environ.get("POL_THREADS", "16"))) as ex:
        dep = dict(ex.map(one, todos))
    return {'legislaturas': legs, 'por_leg': por_leg, 'em_exercicio': em_exercicio, 'dep': dep}


def senado(refresh):
    lst = get(f'{SEN}/senador/lista/legislatura/{LEG_MIN}/58.json', fresh=refresh)
    pars = as_list(lst['ListaParlamentarLegislatura']['Parlamentares']['Parlamentar'])
    cods = sorted({p['IdentificacaoParlamentar']['CodigoParlamentar'] for p in pars}, key=int)
    atual = get(f'{SEN}/senador/lista/atual.json', fresh=refresh)
    em_ex = sorted({p['IdentificacaoParlamentar']['CodigoParlamentar'] for p in
                    as_list(atual['ListaParlamentarEmExercicio']['Parlamentares']['Parlamentar'])}, key=int)
    print('senado', len(cods), 'em exercício', len(em_ex), flush=True)

    def one(c):
        fresh = refresh and c in em_ex
        det = get(f'{SEN}/senador/{c}.json', fresh=fresh)
        man = get(f'{SEN}/senador/{c}/mandatos.json', fresh=fresh)
        fil = get(f'{SEN}/senador/{c}/filiacoes.json', fresh=fresh)
        p = (det or {}).get('DetalheParlamentar', {}).get('Parlamentar', {})
        m = (man or {}).get('MandatoParlamentar', {}).get('Parlamentar', {}).get('Mandatos', {}).get('Mandato')
        f = (fil or {}).get('FiliacaoParlamentar', {}).get('Parlamentar', {}).get('Filiacoes', {}).get('Filiacao')
        return c, {'ident': p.get('IdentificacaoParlamentar'), 'basicos': p.get('DadosBasicosParlamentar'),
                   'mandatos': as_list(m), 'filiacoes': as_list(f)}

    with ThreadPoolExecutor(6) as ex:
        sen = dict(ex.map(one, cods))
    return {'em_exercicio': em_ex, 'sen': sen}


if __name__ == '__main__':
    refresh = os.environ.get('POL_REFRESH') == '1'
    out = {'gerado_em': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'camara': camara(refresh), 'senado': senado(refresh)}
    with open(f'{RAW}/stage/congresso.json', 'w') as f:
        json.dump(out, f, ensure_ascii=False)
    print('ok', len(out['camara']['dep']), 'deputados,', len(out['senado']['sen']), 'senadores')
