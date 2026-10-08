#!/usr/bin/env python3
"""Cartão de Pagamento do Governo Federal (CPGF, o "cartão corporativo").

Fontes (sem chave):
  * Portal da Transparência — download de dados, arquivo mensal (desde 2013-01):
      https://portaldatransparencia.gov.br/download-de-dados/cpgf/AAAAMM
    O servidor tem proteção anti-robô (AWS WAF): baixamos devagar, um arquivo por vez, e paramos se vier captcha (HTTP 405).
  * Presidência da República — planilha "Despesas com cartão de pagamento do Governo Federal - mandatos anteriores"
    (Suprim, 02/01/2003 a 19/12/2022), divulgada em 2023 após desclassificação:
      https://www.gov.br/casacivil/pt-br/acesso-a-informacao/informacoes-classificadas/informacoes-classificadas-e-desclassificadas-publicadas-ate-23-01-2029-na-sg/despesas-com-cartao-de-pagamento-do-governo-federal-mandatos-anteriores
Opcional: se PORTAL_TRANSPARENCIA_KEY estiver definida, fetch_portal_api.py complementa via API.

Saída (politica/data/gastos/cartao/): mes/AAAAMM.json (agregado mensal), ano/AAAA.json, resumo.json, presidencia-2003-2022.json
"""
import csv, io, json, os, re, sys, time, zipfile, datetime, glob, unicodedata
sys.path.insert(0, os.path.dirname(__file__))
from common import http, write_json, read_json, update_sources, RAW, today, OUT

RAWC = os.path.join(RAW, 'cpgf')
os.makedirs(RAWC, exist_ok=True)
NOW = datetime.date.today()
DELAY = float(os.environ.get('CPGF_DELAY', '12'))
MAX_DL = int(os.environ.get('CPGF_MAX_DOWNLOADS', '400'))
BUDGET_S = float(os.environ.get('CPGF_BUDGET_S', '0') or 0)  # 0 = sem limite de tempo

class Blocked(Exception):
    pass

def r2(x): return round(x, 2)

def num(s):
    s = str(s or '').strip().replace('R$', '').strip()
    if not s: return 0.0
    s = s.replace('.', '').replace(',', '.')
    try: return float(s)
    except ValueError: return 0.0

def months():
    y, m = 2013, 1
    while (y, m) <= (NOW.year, NOW.month):
        yield f'{y}{m:02d}'
        m += 1
        if m > 12: y, m = y + 1, 1

def fetch_month(ym):
    path = os.path.join(RAWC, f'{ym}_CPGF.zip')
    if os.path.exists(path) and os.path.getsize(path) > 100:
        return path
    url = f'https://portaldatransparencia.gov.br/download-de-dados/cpgf/{ym}'
    try:
        b, final, hdr = http(url, timeout=300, tries=2)
    except Exception as e:
        code = getattr(e, 'code', None)
        if code == 405:
            raise Blocked(str(e))
        if code in (404, 403):
            return None
        raise
    if not b.startswith(b'PK'):
        if b'captcha' in b[:5000].lower() or b'awswaf' in b[:5000].lower():
            raise Blocked('captcha')
        return None
    with open(path, 'wb') as f:
        f.write(b)
    time.sleep(DELAY)
    return path

def norm(s):
    return unicodedata.normalize('NFD', str(s or '')).encode('ascii', 'ignore').decode().lower()

def aggregate_month(ym, path):
    zf = zipfile.ZipFile(path)
    name = [n for n in zf.namelist() if n.lower().endswith('.csv')][0]
    text = zf.read(name).decode('latin-1')
    rd = csv.reader(io.StringIO(text), delimiter=';')
    head = next(rd)
    H = {h.strip().upper(): i for i, h in enumerate(head)}
    def col(*names):
        for n in names:
            if n in H: return H[n]
        raise KeyError(names)
    i_os, i_nos = col('CÓDIGO ÓRGÃO SUPERIOR'), col('NOME ÓRGÃO SUPERIOR')
    i_o, i_no = col('CÓDIGO ÓRGÃO'), col('NOME ÓRGÃO')
    i_ug, i_nug = col('CÓDIGO UNIDADE GESTORA'), col('NOME UNIDADE GESTORA')
    i_fav, i_nfav = col('CNPJ OU CPF FAVORECIDO'), col('NOME FAVORECIDO')
    i_tr, i_val = col('TRANSAÇÃO'), col('VALOR TRANSAÇÃO')
    i_port = col('NOME PORTADOR')
    sup, org, presid = {}, {}, {}
    tipos = {}
    favs = {}
    total = 0.0; n = 0
    for r in rd:
        if len(r) <= i_val: continue
        v = num(r[i_val]); total += v; n += 1
        tr = r[i_tr].strip().upper()
        sig = 'SIGILOS' in tr or 'SIGILOS' in r[i_port].upper() or 'SIGILOS' in r[i_nfav].upper()
        saque = 'SAQUE' in tr
        t = 'sigiloso' if sig else ('saque' if saque else 'compra')
        tipos[t] = tipos.get(t, 0) + v
        s = sup.setdefault(r[i_os], {'n': r[i_nos].strip(), 'v': 0.0, 'q': 0, 'saque': 0.0, 'sig': 0.0})
        s['v'] += v; s['q'] += 1
        if saque: s['saque'] += v
        if sig: s['sig'] += v
        o = org.setdefault(r[i_o], {'n': r[i_no].strip(), 's': r[i_os], 'v': 0.0})
        o['v'] += v
        if r[i_os] in ('20000', '60000'):
            u = presid.setdefault(r[i_ug], {'n': r[i_nug].strip(), 's': r[i_os], 'v': 0.0, 'sig': 0.0})
            u['v'] += v
            if sig: u['sig'] += v
        if not sig and not saque:
            doc = re.sub(r'\D', '', r[i_fav])
            k = (r[i_os], r[i_nfav].strip()[:70], doc if len(doc) == 14 else '')
            favs[k] = favs.get(k, 0) + v
    top = {}
    for (s, nm, doc), v in favs.items():
        top.setdefault(s, []).append([nm, doc, r2(v)])
    for s in top:
        top[s] = sorted(top[s], key=lambda x: -x[2])[:25]
    out = {'mes': ym, 'total': r2(total), 'transacoes': n, 'tipos': {k: r2(v) for k, v in tipos.items()},
           'orgaos_superiores': {k: {'n': v['n'], 'v': r2(v['v']), 'q': v['q'], 'saque': r2(v['saque']), 'sig': r2(v['sig'])} for k, v in sup.items()},
           'orgaos': {k: {'n': v['n'], 's': v['s'], 'v': r2(v['v'])} for k, v in org.items()},
           'presidencia_ug': {k: {'n': v['n'], 's': v['s'], 'v': r2(v['v']), 'sig': r2(v['sig'])} for k, v in presid.items()},
           'favorecidos_top': top}
    write_json(f'cartao/mes/{ym}.json', out)
    return out

def build_years():
    files = sorted(glob.glob(os.path.join(OUT, 'cartao', 'mes', '*.json')))
    by_year = {}
    for fp in files:
        with open(fp, encoding='utf-8') as f:
            d = json.load(f)
        by_year.setdefault(d['mes'][:4], []).append(d)
    resumo = {'anos': {}}
    for y, ms in sorted(by_year.items()):
        sup, org, ug, fav, tipos = {}, {}, {}, {}, {}
        mens = {}
        for d in ms:
            mens[d['mes'][4:]] = d['total']
            for k, v in d['tipos'].items(): tipos[k] = tipos.get(k, 0) + v
            for k, v in d['orgaos_superiores'].items():
                a = sup.setdefault(k, {'n': v['n'], 'v': 0, 'q': 0, 'saque': 0, 'sig': 0, 'm': {}})
                a['n'] = v['n']
                for kk in ('v', 'q', 'saque', 'sig'): a[kk] += v[kk]
                a['m'][d['mes'][4:]] = r2(a['m'].get(d['mes'][4:], 0) + v['v'])
            for k, v in d['orgaos'].items():
                a = org.setdefault(k, {'n': v['n'], 's': v['s'], 'v': 0}); a['v'] += v['v']; a['n'] = v['n']
            for k, v in d['presidencia_ug'].items():
                a = ug.setdefault(k, {'n': v['n'], 's': v['s'], 'v': 0, 'sig': 0}); a['v'] += v['v']; a['sig'] += v['sig']; a['n'] = v['n']
            for s, lst in d['favorecidos_top'].items():
                for nm, doc, v in lst:
                    k = (s, nm, doc); fav[k] = fav.get(k, 0) + v
        top = {}
        for (s, nm, doc), v in fav.items():
            top.setdefault(s, []).append([nm, doc, r2(v)])
        for s in top: top[s] = sorted(top[s], key=lambda x: -x[2])[:20]
        out = {'ano': int(y), 'meses_disponiveis': sorted(mens), 'total': r2(sum(mens.values())), 'por_mes': mens,
               'tipos': {k: r2(v) for k, v in tipos.items()},
               'orgaos_superiores': {k: {**v, 'v': r2(v['v']), 'saque': r2(v['saque']), 'sig': r2(v['sig'])} for k, v in sorted(sup.items(), key=lambda kv: -kv[1]['v'])},
               'orgaos': {k: {**v, 'v': r2(v['v'])} for k, v in sorted(org.items(), key=lambda kv: -kv[1]['v'])},
               'presidencia_ug': {k: {**v, 'v': r2(v['v']), 'sig': r2(v['sig'])} for k, v in sorted(ug.items(), key=lambda kv: -kv[1]['v'])},
               'favorecidos_top': top,
               'aviso_favorecidos': 'Os maiores fornecedores do ano são somados a partir dos 25 maiores de cada mês; fornecedores pequenos espalhados podem ficar de fora.'}
        write_json(f'cartao/ano/{y}.json', out)
        resumo['anos'][y] = {'total': out['total'], 'meses': len(mens), 'tipos': out['tipos'],
                             'presidencia': r2(sup.get('20000', {}).get('v', 0)), 'presidencia_sig': r2(sup.get('20000', {}).get('sig', 0)),
                             'vice': r2(sup.get('60000', {}).get('v', 0)),
                             'top_orgaos': [[k, v['n'], r2(v['v'])] for k, v in list(sorted(sup.items(), key=lambda kv: -kv[1]['v']))[:12]]}
    write_json('cartao/resumo.json', resumo)
    return resumo

# ---------------------------------------------------------------- Presidência 2003-2022 (Suprim)
PRES_URL = ('https://www.gov.br/casacivil/pt-br/acesso-a-informacao/informacoes-classificadas/'
            'informacoes-classificadas-e-desclassificadas-publicadas-ate-23-01-2029-na-sg/'
            'despesas-com-cartao-de-pagamento-do-governo-federal-mandatos-anteriores/cartao2003-202208032023.csv')

MANDATOS = [  # (início, fim, nome) — datas oficiais de posse/afastamento
    ('2003-01-01', '2010-12-31', 'Lula (1º e 2º mandatos)'),
    ('2011-01-01', '2016-05-11', 'Dilma Rousseff'),
    ('2016-05-12', '2018-12-31', 'Michel Temer (interino a partir de 12/05/2016; titular a partir de 31/08/2016)'),
    ('2019-01-01', '2022-12-31', 'Jair Bolsonaro'),
]

SUBEL = [
    (r'hospedag', 'Hotéis e hospedagem'),
    (r'locacao de meios de transporte|locacao de veic', 'Aluguel de carros e outros transportes'),
    (r'genero.*aliment|fornecimento de aliment|alimenta', 'Comida e bebida'),
    (r'combust', 'Combustível'),
    (r'passag', 'Passagens'),
    (r'manut.*(bens|maq|equip|veic)|conserv', 'Consertos e manutenção'),
    (r'material', 'Materiais (limpeza, cozinha, escritório…)'),
    (r'servicos? de terceiros|outros servicos', 'Serviços contratados de empresas ou pessoas'),
]

def simples_sub(s):
    n = norm(s)
    for pat, txt in SUBEL:
        if re.search(pat, n): return txt
    return 'Outros'

def presidencia_hist():
    path = os.path.join(RAW, 'presid', 'cartao2003-2022.csv')
    if not os.path.exists(path):
        b, _, _ = http(PRES_URL + '/@@download/file', timeout=600)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        open(path, 'wb').write(b)
    raw = open(path, 'rb').read()
    text = raw.decode('cp850')
    lines = text.splitlines()
    start = next(i for i, l in enumerate(lines) if l.startswith('DATA PGTO;CPF SERVIDOR'))
    anos, mand, subs, forn = {}, {}, {}, {}
    total = 0.0; n = 0
    for l in lines[start + 1:]:
        if l.startswith('DATA PGTO;'): break
        p = l.split(';')
        if len(p) < 7 or not re.match(r'\d\d/\d\d/\d{4}', p[0]): continue
        d, m, y = p[0].split('/'); iso = f'{y}-{m}-{d}'
        v = num(p[4]); total += v; n += 1
        tipo = 'saque' if p[5].strip().upper() == 'D' else 'compra'
        a = anos.setdefault(y, {'v': 0.0, 'q': 0, 'saque': 0.0, 'compra': 0.0})
        a['v'] += v; a['q'] += 1; a[tipo] += v
        mn = next((nm for ini, fim, nm in MANDATOS if ini <= iso <= fim), 'outro')
        b = mand.setdefault(mn, {'v': 0.0, 'q': 0, 'ini': iso, 'fim': iso, 'cats': {}, 'anos': {}})
        b['v'] += v; b['q'] += 1; b['anos'][y] = b['anos'].get(y, 0) + v; b['ini'] = min(b['ini'], iso); b['fim'] = max(b['fim'], iso)
        cs = simples_sub(p[6])
        b['cats'][cs] = b['cats'].get(cs, 0) + v
        so = p[6].strip()
        subs[so] = subs.get(so, 0) + v
        fk = (mn, p[3].strip()[:70])
        forn[fk] = forn.get(fk, 0) + v
    tops = {}
    for (mn, nm), v in forn.items():
        tops.setdefault(mn, []).append([nm, r2(v)])
    for mn in tops: tops[mn] = sorted(tops[mn], key=lambda x: -x[1])[:15]
    out = {'fonte': 'Presidência da República — Suprim; planilha publicada pela Secretaria-Geral/Casa Civil (2023)', 'url': PRES_URL + '/view',
           'periodo': '02/01/2003 a 19/12/2022', 'total': r2(total), 'lancamentos': n,
           'anos': {k: {kk: (r2(vv) if isinstance(vv, float) else vv) for kk, vv in v.items()} for k, v in sorted(anos.items())},
           'mandatos': [{'nome': k, 'ini': v['ini'], 'fim': v['fim'], 'v': r2(v['v']), 'q': v['q'],
                         'anos': {a: r2(x) for a, x in sorted(v['anos'].items())},
                         'cats': {c: r2(x) for c, x in sorted(v['cats'].items(), key=lambda kv: -kv[1])}, 'fornecedores': tops.get(k, [])}
                        for k, v in mand.items()],
           'subelementos': {k: r2(v) for k, v in sorted(subs.items(), key=lambda kv: -kv[1])[:30]},
           'notas': ['Valores do Suprim já descontam devoluções; o Portal da Transparência mostra o valor da transação sem descontar devoluções, por isso os totais dos dois diferem.',
                     'Datas pelo dia do pagamento (o Portal agrupa pelo mês da fatura).',
                     'Os CNPJs dos fornecedores vieram corrompidos na planilha oficial (notação científica), por isso mostramos só os nomes.',
                     'Mandatos atribuídos pela data do lançamento.']}
    write_json('cartao/presidencia-2003-2022.json', out)
    update_sources('presidencia_cartao_2003_2022', {'nome': 'Presidência da República — despesas com cartão de pagamento, mandatos anteriores (02/01/2003 a 19/12/2022, Suprim)',
                                                    'url': PRES_URL + '/view', 'cobertura': '2003–2022', 'coletado_em': today()})
    print(f'  Presidência 2003-2022: {n} lançamentos, R$ {total:,.2f}', flush=True)

def main():
    try:
        presidencia_hist()
    except Exception as e:
        print('  AVISO: planilha da Presidência falhou:', e, flush=True)
    dl = 0; blocked = False; t0 = time.time()
    recent = set()
    # sempre refaz os 3 meses mais recentes (o Portal publica com atraso e pode corrigir)
    allm = list(months())
    for ym in allm[-3:]: recent.add(ym)
    for ym in allm[-3:][::-1] + allm[:-3]:  # recentes primeiro, depois preenche lacunas antigas
        have = os.path.exists(os.path.join(OUT, 'cartao', 'mes', f'{ym}.json'))
        if have and ym not in recent:
            continue
        p = os.path.join(RAWC, f'{ym}_CPGF.zip')
        if ym in recent and os.path.exists(p) and time.time() - os.path.getmtime(p) > 86400 * 3:
            os.remove(p)
        cached = os.path.exists(p) and os.path.getsize(p) > 100
        if not cached and (blocked or dl >= MAX_DL or (BUDGET_S and time.time() - t0 > BUDGET_S)):
            continue
        try:
            path = fetch_month(ym)
            if not cached: dl += 1
        except Blocked as e:
            print(f'  Portal bloqueou (captcha/405) em {ym}; continuo na próxima execução.', flush=True)
            blocked = True; continue
        except Exception as e:
            print(f'  AVISO: CPGF {ym}: {e}', flush=True); continue
        if path:
            d = aggregate_month(ym, path)
            print(f'  CPGF {ym}: R$ {d["total"]:,.2f} ({d["transacoes"]} transações)', flush=True)
        else:
            print(f'  CPGF {ym}: ainda não publicado', flush=True)
    res = build_years()
    have = sorted(os.path.basename(f)[:6] for f in glob.glob(os.path.join(OUT, 'cartao', 'mes', '*.json')))
    update_sources('cpgf', {'nome': 'Portal da Transparência (CGU) — Cartão de Pagamento do Governo Federal, download de dados mensal',
                            'url': 'https://portaldatransparencia.gov.br/download-de-dados/cpgf',
                            'cobertura': f'{have[0][:4]}-{have[0][4:]} a {have[-1][:4]}-{have[-1][4:]} ({len(have)} meses)' if have else 'nenhum mês ainda',
                            'meses': have, 'coletado_em': today()})
    print('ok Cartão', flush=True)

if __name__ == '__main__':
    main()
