#!/usr/bin/env python3
"""Cota parlamentar: CEAP (Câmara, desde 2008/2009) e CEAPS (Senado, desde 2008).

Fontes (sem chave):
  * Câmara: https://www.camara.leg.br/cotas/Ano-AAAA.csv.zip (arquivo anual, um registro por nota)
  * Senado: https://adm.senado.gov.br/adm-dadosabertos/api/v1/senadores/despesas_ceaps/AAAA
  * Senado (partido/UF): https://legis.senado.leg.br/dadosabertos/senador/lista/legislatura/53/57

Saída (politica/data/gastos/parl/):
  camara/ano/AAAA.json, senado/ano/AAAA.json  — por pessoa: total, categorias, meses, maiores fornecedores
  camara/p/ID.json, senado/p/ID.json          — histórico de cada pessoa (todos os anos)
  indice.json                                 — lista de todas as pessoas (inclusive ex-parlamentares)
  resumo.json                                 — totais por ano, partido, UF e categoria
"""
import csv, io, json, os, re, sys, zipfile, unicodedata, datetime, glob
sys.path.insert(0, os.path.dirname(__file__))
from common import http, download, write_json, read_json, update_sources, RAW, today, OUT

THIS_YEAR = datetime.date.today().year
csv.field_size_limit(10**9)

def norm(s):
    s = unicodedata.normalize('NFD', str(s or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'\s+', ' ', s).strip(' .')

CATS = [
    (r'^manutencao de escritorio', 'Escritório no estado (aluguel, contas, material)'),
    (r'^aluguel de imoveis para escritorio', 'Escritório no estado (aluguel e contas)'),
    (r'^combustiveis', 'Combustível'),
    (r'^divulgacao da atividade parlamentar', 'Propaganda do mandato (anúncios, posts, panfletos)'),
    (r'fretamento de aeronaves', 'Aluguel de aviões e helicópteros'),
    (r'fretamento de veiculos', 'Aluguel de carros'),
    (r'fretamento de embarcacoes', 'Aluguel de barcos'),
    (r'^passagem aerea - sigepa', 'Passagens de avião (emitidas pelo sistema da Câmara)'),
    (r'^passagem aerea - reembolso', 'Passagens de avião (reembolso)'),
    (r'^passagem aerea - rpa', 'Passagens de avião (agência contratada)'),
    (r'^passagens? aerea', 'Passagens de avião'),
    (r'^emissao bilhete aereo', 'Passagens de avião'),
    (r'^passagens terrestres', 'Passagens de ônibus, barco ou balsa'),
    (r'^passagens aereas, aquaticas e terrestres', 'Passagens (avião, barco, ônibus)'),
    (r'^telefonia', 'Telefone e internet'),
    (r'^servicos postais', 'Correios'),
    (r'^fornecimento de alimentacao', 'Refeições do parlamentar'),
    (r'^hospedagem', 'Hotel (fora de Brasília)'),
    (r'^locomocao, (hospedagem|alimentacao)', 'Transporte, hotel, refeições e combustível'),
    (r'^servico de taxi', 'Táxi, pedágio e estacionamento'),
    (r'^assinatura de publicacoes', 'Assinaturas de jornais e revistas'),
    (r'seguranca', 'Segurança particular'),
    (r'tokens e certificados', 'Certificado digital (assinatura eletrônica)'),
    (r'^consultorias|^contratacao de consultorias', 'Consultorias, assessorias e pesquisas'),
    (r'^participacao em curso', 'Cursos, palestras e eventos'),
    (r'^aquisicao de material de (consumo|escritorio)', 'Material de escritório'),
    (r'^aquisicao ou loc\. de software', 'Programas de computador, correios e assinaturas'),
    (r'^locacao de veiculos', 'Aluguel de carros'),
]

def simples(cat):
    n = norm(cat)
    for pat, txt in CATS:
        if re.search(pat, n):
            return txt
    s = str(cat or '').strip().rstrip('.').capitalize()
    return s or 'Categoria não informada'

class Cat:
    def __init__(self):
        self.ids = {}
        self.list = []
    def get(self, oficial):
        o = re.sub(r'\s+', ' ', str(oficial or 'NÃO INFORMADO')).strip()
        k = simples(o)
        if k not in self.ids:
            self.ids[k] = len(self.list); self.list.append({'simples': k, 'oficial': []})
        e = self.list[self.ids[k]]
        if o not in e['oficial']:
            e['oficial'].append(o)
        return self.ids[k]

def r2(x):
    return round(x, 2)

def fmt_doc(d):
    d = re.sub(r'\D', '', str(d or ''))
    return d if len(d) == 14 else ''

def finalize_person(p, ntop=10):
    forn = sorted(p['forn'].items(), key=lambda kv: -kv[1])[:ntop]
    return {
        'id': p['id'], 'nome': p['nome'], 'partido': p['partido'], 'uf': p['uf'],
        'total': r2(p['total']), 'n': p['n'],
        'cats': {str(k): r2(v) for k, v in sorted(p['cats'].items(), key=lambda kv: -kv[1])},
        'meses': [r2(x) for x in p['meses']],
        'forn': [[k[0], k[1], r2(v)] for k, v in forn],
    }

def year_file(casa, y, pessoas, cats, extra=None):
    plist = [finalize_person(p) for p in sorted(pessoas.values(), key=lambda p: -p['total'])]
    partidos, ufs, cat_tot = {}, {}, {}
    for p in pessoas.values():
        for k, d in ((p['partido'] or '—', partidos), (p['uf'] or '—', ufs)):
            a = d.setdefault(k, [0.0, 0]); a[0] += p['total']; a[1] += 1
        for c, v in p['cats'].items():
            cat_tot[str(c)] = cat_tot.get(str(c), 0) + v
    out = {
        'casa': casa, 'ano': y, 'total': r2(sum(p['total'] for p in pessoas.values())),
        'categorias': cats.list,
        'cat_total': {k: r2(v) for k, v in sorted(cat_tot.items(), key=lambda kv: -kv[1])},
        'partidos': {k: [r2(v[0]), v[1]] for k, v in sorted(partidos.items(), key=lambda kv: -kv[1][0])},
        'ufs': {k: [r2(v[0]), v[1]] for k, v in sorted(ufs.items(), key=lambda kv: -kv[1][0])},
        'pessoas': plist,
    }
    if extra:
        out.update(extra)
    return write_json(f'parl/{casa}/ano/{y}.json', out)

# ------------------------------------------------------------------ Câmara
def camara_year(y):
    path = os.path.join(RAW, 'camara', f'Ano-{y}.csv.zip')
    if not os.path.exists(path) or y >= THIS_YEAR - 1:
        download(f'https://www.camara.leg.br/cotas/Ano-{y}.csv.zip', path, min_bytes=1000)
    zf = zipfile.ZipFile(path)
    name = [n for n in zf.namelist() if n.lower().endswith('.csv')][0]
    raw = zf.read(name)
    try:
        text = raw.decode('utf-8-sig')
    except UnicodeDecodeError:
        text = raw.decode('latin-1')
    cats = Cat(); pessoas = {}; liderancas = {}
    for r in csv.DictReader(io.StringIO(text), delimiter=';'):
        try:
            v = float((r.get('vlrLiquido') or '0').replace(',', '.'))
        except ValueError:
            continue
        ide = (r.get('ideCadastro') or '').strip()
        nome = (r.get('txNomeParlamentar') or '').strip()
        try:
            mes = int(r.get('numMes') or 0)
        except ValueError:
            mes = 0
        c = cats.get(r.get('txtDescricao'))
        if not ide:
            key = 'L' + norm(nome).replace(' ', '-'); bucket = liderancas
        else:
            key = ide; bucket = pessoas
        p = bucket.get(key)
        if not p:
            p = bucket[key] = {'id': key, 'nome': nome.title() if nome.isupper() else nome, 'partido': '', 'uf': '', 'total': 0.0, 'n': 0,
                               'cats': {}, 'meses': [0.0] * 12, 'forn': {}}
        part = (r.get('sgPartido') or '').strip(); uf = (r.get('sgUF') or '').strip()
        if part: p['partido'] = part
        if uf and uf != 'NA': p['uf'] = uf
        p['total'] += v; p['n'] += 1
        p['cats'][c] = p['cats'].get(c, 0) + v
        if 1 <= mes <= 12: p['meses'][mes - 1] += v
        fk = ((r.get('txtFornecedor') or '').strip()[:80], fmt_doc(r.get('txtCNPJCPF')))
        p['forn'][fk] = p['forn'].get(fk, 0) + v
    lid = [{'nome': p['nome'], 'total': r2(p['total']), 'cats': {str(k): r2(v) for k, v in p['cats'].items()}} for p in sorted(liderancas.values(), key=lambda p: -p['total'])]
    s = year_file('camara', y, pessoas, cats, {'liderancas': lid, 'liderancas_total': r2(sum(p['total'] for p in liderancas.values()))})
    print(f'  Câmara {y}: {len(pessoas)} deputados, {s/1024:.0f} KB', flush=True)

# ------------------------------------------------------------------ Senado
def senado_partidos():
    info = {}
    try:
        b, _, _ = http('https://legis.senado.leg.br/dadosabertos/senador/lista/legislatura/53/57', headers={'Accept': 'application/json'}, timeout=120)
        d = json.loads(b)
        lst = d['ListaParlamentarLegislatura']['Parlamentares']['Parlamentar']
        for p in lst:
            ip = p['IdentificacaoParlamentar']
            info[str(ip['CodigoParlamentar'])] = {'nome': ip.get('NomeParlamentar', ''), 'partido': ip.get('SiglaPartidoParlamentar', '') or '', 'uf': ip.get('UfParlamentar', '') or ''}
    except Exception as e:
        print('  AVISO: lista de senadores por legislatura falhou:', e, flush=True)
    try:
        b, _, _ = http('https://legis.senado.leg.br/dadosabertos/senador/lista/atual', headers={'Accept': 'application/json'}, timeout=120)
        d = json.loads(b)
        for p in d['ListaParlamentarEmExercicio']['Parlamentares']['Parlamentar']:
            ip = p['IdentificacaoParlamentar']
            info[str(ip['CodigoParlamentar'])] = {'nome': ip.get('NomeParlamentar', ''), 'partido': ip.get('SiglaPartidoParlamentar', '') or '', 'uf': ip.get('UfParlamentar', '') or ''}
    except Exception as e:
        print('  AVISO: lista de senadores atuais falhou:', e, flush=True)
    return info

def senado_year(y, info):
    path = os.path.join(RAW, 'senado', f'{y}.json')
    if not os.path.exists(path) or y >= THIS_YEAR - 1:
        download(f'https://adm.senado.gov.br/adm-dadosabertos/api/v1/senadores/despesas_ceaps/{y}', path, min_bytes=2)
    with open(path, encoding='utf-8') as f:
        rows = json.load(f)
    cats = Cat(); pessoas = {}
    for r in rows:
        v = float(r.get('valorReembolsado') or 0)
        key = str(r.get('codSenador') or '')
        nome = (r.get('nomeSenador') or '').strip()
        if not key:
            continue
        p = pessoas.get(key)
        if not p:
            i = info.get(key, {})
            p = pessoas[key] = {'id': key, 'nome': i.get('nome') or nome.title(), 'partido': i.get('partido', ''), 'uf': i.get('uf', ''),
                                'total': 0.0, 'n': 0, 'cats': {}, 'meses': [0.0] * 12, 'forn': {}}
        c = cats.get(r.get('tipoDespesa'))
        p['total'] += v; p['n'] += 1
        p['cats'][c] = p['cats'].get(c, 0) + v
        m = int(r.get('mes') or 0)
        if 1 <= m <= 12: p['meses'][m - 1] += v
        fk = ((r.get('fornecedor') or 'Não detalhado na fonte').strip()[:80], fmt_doc(r.get('cpfCnpj')))
        p['forn'][fk] = p['forn'].get(fk, 0) + v
    s = year_file('senado', y, pessoas, cats, {'aviso_partido': 'Partido e UF vêm da lista de senadores do Senado (legislaturas 53 a 57) e refletem a filiação mais recente registrada, não necessariamente a do ano do gasto.'})
    print(f'  Senado {y}: {len(pessoas)} senadores, {s/1024:.0f} KB', flush=True)

# ------------------------------------------------------------------ pessoas e índice
def build_people():
    index = []
    resumo = {'camara': {}, 'senado': {}}
    for casa in ('camara', 'senado'):
        files = sorted(glob.glob(os.path.join(OUT, 'parl', casa, 'ano', '*.json')))
        people = {}
        for fp in files:
            with open(fp, encoding='utf-8') as f:
                d = json.load(f)
            y = d['ano']
            catnames = [c['simples'] for c in d['categorias']]
            cat_tot_named = {}
            for k, v in d['cat_total'].items():
                cat_tot_named[catnames[int(k)]] = cat_tot_named.get(catnames[int(k)], 0) + v
            resumo[casa][str(y)] = {'total': d['total'], 'pessoas': len(d['pessoas']), 'partidos': d['partidos'], 'ufs': d['ufs'],
                                    'categorias': {k: r2(v) for k, v in sorted(cat_tot_named.items(), key=lambda kv: -kv[1])}}
            if casa == 'camara':
                resumo[casa][str(y)]['liderancas_total'] = d.get('liderancas_total', 0)
            for p in d['pessoas']:
                e = people.setdefault(p['id'], {'id': p['id'], 'nome': p['nome'], 'casa': casa, 'partidos': [], 'ufs': [], 'anos': {}})
                e['nome'] = p['nome']
                if p['partido'] and p['partido'] not in e['partidos']: e['partidos'].append(p['partido'])
                if p['uf'] and p['uf'] not in e['ufs']: e['ufs'].append(p['uf'])
                e['anos'][str(y)] = {'total': p['total'], 'n': p['n'], 'partido': p['partido'], 'uf': p['uf'],
                                     'cats': {catnames[int(k)]: v for k, v in p['cats'].items()}, 'meses': p['meses'], 'forn': p['forn']}
        os.makedirs(os.path.join(OUT, 'parl', casa, 'p'), exist_ok=True)
        keep = set()
        for pid, e in people.items():
            ys = sorted(e['anos'])
            tot = r2(sum(a['total'] for a in e['anos'].values()))
            e['total'] = tot
            last = e['anos'][ys[-1]]
            write_json(f'parl/{casa}/p/{pid}.json', e)
            keep.add(f'{pid}.json')
            index.append([casa[0], pid, e['nome'], last['partido'] or (e['partidos'][-1] if e['partidos'] else ''), last['uf'] or (e['ufs'][-1] if e['ufs'] else ''), int(ys[0]), int(ys[-1]), tot,
                          {y: int(round(a['total'])) for y, a in sorted(e['anos'].items())}])
        for fp in glob.glob(os.path.join(OUT, 'parl', casa, 'p', '*.json')):
            if os.path.basename(fp) not in keep:
                os.remove(fp)
    index.sort(key=lambda r: -r[7])
    write_json('parl/indice.json', {'colunas': ['casa', 'id', 'nome', 'partido', 'uf', 'ano_ini', 'ano_fim', 'total', 'por_ano'], 'pessoas': index})
    write_json('parl/resumo.json', resumo)
    print(f'  índice: {len(index)} pessoas', flush=True)

def main():
    anos_env = os.environ.get('GASTOS_PARL_ANOS')
    years = list(range(2008, THIS_YEAR + 1))
    print('Câmara (CEAP)…', flush=True)
    for y in years:
        have = os.path.exists(os.path.join(OUT, 'parl', 'camara', 'ano', f'{y}.json'))
        if have and y < THIS_YEAR - 1 and not (anos_env and str(y) in anos_env.split(',')):
            continue
        try:
            camara_year(y)
        except Exception as e:
            print(f'  AVISO: Câmara {y} falhou: {e}', flush=True)
    print('Senado (CEAPS)…', flush=True)
    info = senado_partidos()
    for y in years:
        have = os.path.exists(os.path.join(OUT, 'parl', 'senado', 'ano', f'{y}.json'))
        if have and y < THIS_YEAR - 1 and not (anos_env and str(y) in anos_env.split(',')):
            continue
        try:
            senado_year(y, info)
        except Exception as e:
            print(f'  AVISO: Senado {y} falhou: {e}', flush=True)
    build_people()
    update_sources('camara_ceap', {'nome': 'Câmara dos Deputados — Cota para o Exercício da Atividade Parlamentar (CEAP), arquivos anuais',
                                   'url': 'https://www.camara.leg.br/cotas/Ano-AAAA.csv.zip',
                                   'doc': 'https://dadosabertos.camara.leg.br/swagger/api.html#staticfile',
                                   'cobertura': f'2008–{THIS_YEAR} (2008 tem só poucos registros; a CEAP unificada começou em 2009)', 'coletado_em': today()})
    update_sources('senado_ceaps', {'nome': 'Senado Federal — Cota para o Exercício da Atividade Parlamentar dos Senadores (CEAPS)',
                                    'url': 'https://adm.senado.gov.br/adm-dadosabertos/api/v1/senadores/despesas_ceaps/AAAA',
                                    'doc': 'https://adm.senado.gov.br/adm-dadosabertos/swagger-ui/index.html',
                                    'cobertura': f'2008–{THIS_YEAR}', 'coletado_em': today()})
    update_sources('senado_lista', {'nome': 'Senado Federal — lista de senadores por legislatura (partido e UF)',
                                    'url': 'https://legis.senado.leg.br/dadosabertos/senador/lista/legislatura/53/57', 'coletado_em': today()})
    print('ok Parlamento', flush=True)

if __name__ == '__main__':
    main()
