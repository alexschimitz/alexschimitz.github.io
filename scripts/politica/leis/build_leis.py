#!/usr/bin/env python3
"""Monta politica/data/leis/ a partir da curadoria (scripts/politica/leis/curadoria/*.json)
e dos dados abertos da Câmara e do Senado.

Para cada lei curada:
  * Senado  /dadosabertos/processo?tipoNorma&numeroNorma&anoNorma -> matérias que geraram a norma,
    autoria, data, outros números (o projeto na Câmara) e vetos (VET);
  * Câmara  /api/v2/proposicoes?siglaTipo&numero&ano -> id; /autores; /votacoes (plenário);
    /votacoes/{id}/votos e /orientacoes; /deputados?dataInicio=dataFim=dia (quem estava em exercício);
  * Senado  /dadosabertos/votacao?codigoMateria -> votações nominais com o voto de cada senador.
Saída (JSON compacto):
  politica/data/leis/leis.json      catálogo (curadoria + autores, datas, resumo das votações)
  politica/data/leis/votos/{id}.json voto de cada parlamentar em cada votação principal
  politica/data/leis/pessoas.json   índice "como votou fulano" (uma letra por votação)
  politica/data/leis/coerencia-leis.json  casos (a), (b) e (c) nas leis curadas
Uso: python3 scripts/politica/leis/build_leis.py [--cache DIR]
"""
import json, os, re, sys, time, glob, hashlib, unicodedata, urllib.request, urllib.parse
from collections import defaultdict, Counter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OUT = os.path.join(ROOT, 'politica', 'data', 'leis')
CUR = os.path.join(os.path.dirname(__file__), 'curadoria')
CACHE = os.environ.get('LEIS_CACHE') or os.path.join(ROOT, '..', 'pol-leis-raw', 'cache')
if '--cache' in sys.argv: CACHE = sys.argv[sys.argv.index('--cache') + 1]
os.makedirs(CACHE, exist_ok=True)
CAM = 'https://dadosabertos.camara.leg.br/api/v2'
SEN = 'https://legis.senado.leg.br/dadosabertos'
UA = {'Accept': 'application/json', 'User-Agent': 'alexschimitz.github.io/politica (dados abertos)'}

def log(*a): print(*a, file=sys.stderr, flush=True)

def get(url, tries=4, cache=True):
    key = os.path.join(CACHE, hashlib.sha1(url.encode()).hexdigest() + '.json')
    if cache and os.path.exists(key):
        with open(key) as f: return json.load(f)
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.load(r)
            if cache:
                with open(key, 'w') as f: json.dump(data, f)
            time.sleep(0.12)
            return data
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (400, 404): break
            time.sleep(2 * (i + 1))
        except Exception as e:
            last = e; time.sleep(2 * (i + 1))
    log('  ! falhou', url, last)
    return None

def cam_list(url):
    out = []
    while url:
        d = get(url)
        if not d: break
        out += d.get('dados') or []
        nxt = [l['href'] for l in d.get('links', []) if l.get('rel') == 'next']
        url = nxt[0] if nxt else None
    return out

def norm_txt(s):
    s = unicodedata.normalize('NFD', s or '').encode('ascii', 'ignore').decode().lower()
    return re.sub(r'\s+', ' ', s).strip()

# ---------- presidentes (para "sancionada no governo de ...") ----------
GOVS = [('1985-03-15', 'Sarney'), ('1990-03-15', 'Collor'), ('1992-10-02', 'Itamar'), ('1995-01-01', 'FHC'),
        ('2003-01-01', 'Lula'), ('2011-01-01', 'Dilma'), ('2016-05-12', 'Temer'), ('2019-01-01', 'Bolsonaro'),
        ('2023-01-01', 'Lula')]
def governo(dt):
    g = None
    for ini, nome in GOVS:
        if dt and dt >= ini: g = nome
    if g == 'Lula' and dt and dt >= '2023-01-01': return 'Lula (3º mandato)'
    if g == 'Lula' and dt and dt >= '2007-01-01': return 'Lula (2º mandato)'
    if g == 'Lula': return 'Lula (1º mandato)'
    if g == 'FHC' and dt >= '1999-01-01': return 'FHC (2º mandato)'
    if g == 'FHC': return 'FHC (1º mandato)'
    if g == 'Dilma' and dt >= '2015-01-01': return 'Dilma (2º mandato)'
    if g == 'Dilma': return 'Dilma (1º mandato)'
    return g

# ---------- ids de perfil ----------
def load_profile_ids():
    cam, sen = {}, {}
    for f in glob.glob(os.path.join(ROOT, 'politica', 'data', 'politicos', 'p', '*.json')):
        with open(f) as fh: d = json.load(fh)
        for pid, p in d.items():
            if 'cam' in p: cam[int(p['cam'])] = pid
            if 'sen' in p: sen[int(p['sen'])] = pid
    return cam, sen

TIPO_NORMA = {'LEI': 'LEI', 'LCP': 'LCP', 'EMC': 'EMC'}
NOME_NORMA = {'LEI': 'Lei', 'LCP': 'Lei Complementar', 'EMC': 'Emenda Constitucional'}

def planalto_urls(tipo, n, ano):
    """Endereços candidatos no Planalto (o padrão mudou ao longo dos anos; alguns textos só existem como “compilado”)."""
    n, ano = int(n), int(ano)
    b = 'https://www.planalto.gov.br/ccivil_03/'
    dot = f'{n:,}'.replace(',', '.')
    if tipo == 'EMC': return [b + f'constituicao/emendas/emc/emc{n}.htm']
    if tipo == 'LCP': return [b + f'leis/lcp/lcp{n}.htm', b + f'leis/lcp/lcp{n}compilado.htm']
    if ano <= 2000:
        return [b + f'leis/l{n}.htm', b + f'leis/l{n}cons.htm', b + f'leis/l{n}compilado.htm', b + f'leis/l{n}compilada.htm']
    if ano <= 2003:
        return [b + f'leis/{ano}/l{dot}.htm', b + f'leis/{ano}/l{n}.htm', b + f'leis/LEIS_{ano}/L{n}.htm', b + f'leis/{ano}/l{n}compilada.htm', b + f'leis/LEIS_{ano}/L{n}compilado.htm']
    for a, b2, pre in ((2004, 2006, '_ato2004-2006'), (2007, 2010, '_ato2007-2010'), (2011, 2014, '_ato2011-2014'),
                       (2015, 2018, '_ato2015-2018'), (2019, 2022, '_ato2019-2022'), (2023, 2026, '_ato2023-2026')):
        if a <= ano <= b2:
            return [b + f'{pre}/{ano}/lei/l{n}.htm', b + f'{pre}/{ano}/lei/l{dot}.htm', b + f'{pre}/{ano}/lei/L{n}.htm', b + f'{pre}/{ano}/lei/l{n}compilado.htm']
    return []

def check_planalto(url, n):
    """Confere se a página existe e cita o número da norma (o Planalto às vezes devolve 200 em página de erro)."""
    key = os.path.join(CACHE, 'pl_' + hashlib.sha1(url.encode()).hexdigest() + '.txt')
    if os.path.exists(key):
        return open(key).read() == '1'
    ok = False
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=40) as r:
            raw = r.read(400000).decode('latin-1', 'ignore')
        ok = bool(re.search(r'\b' + re.escape(f'{int(n):,}'.replace(',', '.')) + r'\b', raw)) or (str(n) in raw)
    except Exception as e:
        log('  planalto falhou', url, e)
    open(key, 'w').write('1' if ok else '0')
    return ok

# ---------- seleção das votações principais ----------
RE_MAIN_C = re.compile(r'^(aprovad|rejeitad)[ao]s?\b.{0,60}?\b(proposta de emenda|projeto|substitutivo|subemenda substitutiva|medida provis|emenda substitutiva|emenda aglutinativa substitutiva|reda[cç][aã]o final|parecer da comiss[aã]o mista.*m[eé]rito|emendas do senado|texto)', re.I)
RE_SKIP_C = re.compile(r'requerimento|destaque|pressupostos|admissibilidade|adequa[cç][aã]o financeira|prefer[eê]ncia|recurso|urg[eê]ncia|quebra de interst', re.I)

def turno_de(txt):
    t = norm_txt(txt)
    if 'primeiro turno' in t: return 1
    if 'segundo turno' in t: return 2
    return 0

VOTO_C = {'Sim': 'S', 'Não': 'N', 'Abstenção': 'A', 'Obstrução': 'O', 'Artigo 17': 'P'}
def voto_sen(v):
    v = (v or '').strip()
    if v == 'Sim': return 'S'
    if v == 'Não': return 'N'
    if v.startswith('Abst'): return 'A'
    if v.startswith('Obstr'): return 'O'
    if v in ('P-NRV', 'Presidente (art. 51 RISF)', 'Presidente', 'PRESIDENTE'): return 'P'
    if v == 'Votou': return 'V'  # votação secreta
    return 'X'

def camara_prop_id(sigla, num, ano):
    d = get(f'{CAM}/proposicoes?siglaTipo={sigla}&numero={int(num)}&ano={int(ano)}')
    if d and d.get('dados'):
        return d['dados'][0]['id'], d['dados'][0].get('ementa', '')
    return None, None

ROSTER = {}
def roster(dia):
    if dia not in ROSTER:
        ds = cam_list(f'{CAM}/deputados?dataInicio={dia}&dataFim={dia}&itens=1000')
        ROSTER[dia] = {d['id']: (d['nome'], d.get('siglaPartido'), d.get('siglaUf')) for d in ds}
    return ROSTER[dia]

def camara_votes(pid_prop, sigla):
    """Votações nominais principais de uma proposição da Câmara."""
    vs = cam_list(f'{CAM}/proposicoes/{pid_prop}/votacoes')
    cand = []
    for v in vs:
        if v.get('siglaOrgao') != 'PLEN': continue
        desc = (v.get('descricao') or '').strip()
        d0 = re.sub(r'ressalvad[oa]s?\s+(os|as)?\s*(destaques?|emendas?)[^.;]*', '', desc, flags=re.I)
        if RE_SKIP_C.search(d0[:90]): continue
        if not RE_MAIN_C.search(desc): continue
        # nominal ou não: decide-se pela lista de votos (simbólicas vêm vazias)
        cand.append(v)
    out = []
    for v in sorted(cand, key=lambda x: x.get('dataHoraRegistro') or x.get('data') or ''):
        vid = v['id']
        votos = get(f'{CAM}/votacoes/{vid}/votos')
        votos = (votos or {}).get('dados') or []
        if len(votos) < 40: continue
        ori = get(f'{CAM}/votacoes/{vid}/orientacoes')
        ori = (ori or {}).get('dados') or []
        out.append((v, votos, ori))
    # PECs: manter os turnos; demais: até 4 votações (texto principal, emendas do Senado...)
    if len(out) > 5:
        pri = [o for o in out if turno_de(o[0]['descricao'])]
        rest = [o for o in out if o not in pri]
        out = (pri + rest)[:5]
        out.sort(key=lambda o: o[0].get('dataHoraRegistro') or '')
    return out

def senado_votes(cod, ementa, ident):
    d = get(f'{SEN}/votacao?codigoMateria={cod}')
    if not d: return []
    em = norm_txt(ementa)[:40]
    out = []
    for v in d:
        desc = (v.get('descricaoVotacao') or '').strip()
        nd = norm_txt(desc)
        nd = re.sub(r'^votacao\s+(simbolica\s+|nominal\s+)?(em\s+(primeiro|segundo)\s+turno\s+)?(do|da|de|dos|das)?\s*', '', nd)
        nd = re.sub(r'^(em\s+(primeiro|segundo)\s+turno\s*,?\s*(do|da)?\s*)', '', nd)
        inf = norm_txt(((v.get('informeLegislativo') or {}).get('texto')) or '')
        if re.match(r'^emendas?\b.*\bsubstitutiv', nd) and 'destacad' not in nd:
            v['_sub'] = 1
            if len(v.get('votos') or []) >= 20: out.append(v)
            continue
        if 'destacad' in nd: continue
        if re.match(r'^(emenda|emendas|destaque|requerimento|supress|expressao|dispositivo|art\.|artigo|inciso|paragrafo|item|alinea|veto|parecer)', nd):
            continue
        main = (em and nd.startswith(em[:30])) or bool(re.match(r'^(projeto|proposta de emenda|medida provis|substitutivo|pec|plv|plc|pls|pl |plp)', nd))
        if not main: continue
        votos = v.get('votos') or []
        if len(votos) < 20: continue
        out.append(v)
    out.sort(key=lambda v: (v.get('dataSessao') or '', v.get('sequencialSessao') or 0))
    if len(out) > 5:
        pri = [v for v in out if turno_de((((v.get('informeLegislativo') or {}).get('texto')) or '') + ' ' + (v.get('descricaoVotacao') or ''))]
        out = (pri + [v for v in out if v not in pri])[:5]
        out.sort(key=lambda v: (v.get('dataSessao') or '', v.get('sequencialSessao') or 0))
    return out

def main():
    cam2pid, sen2pid = load_profile_ids()
    log('perfis: câmara', len(cam2pid), 'senado', len(sen2pid))
    cur = []
    for f in sorted(glob.glob(os.path.join(CUR, 'leis-*.json'))):
        with open(f) as fh: cur += json.load(fh)
    with open(os.path.join(ROOT, 'politica', 'data', 'propostas', 'normas-origem.json')) as fh:
        origem = json.load(fh)['normas']
    os.makedirs(os.path.join(OUT, 'votos'), exist_ok=True)

    catalog, problems = [], []
    allvotes = []          # (lawid, votekey, casa, meta)
    persons = {}           # key -> dict(n, p, uf, pid, votes{vk: char})
    coer = []
    for L in cur:
        lid = L['id']; log('==', lid)
        rec = {k: L[k] for k in L if k not in ('camara', 'senado')}
        norma = L.get('norma')
        sen_procs, vetos = [], []
        cam_ids = []   # (id, sigla)
        if norma:
            tipo, n, ano = norma.split('-')
            rec['normaTxt'] = f"{NOME_NORMA[tipo]} {int(n):,}/{ano}".replace(',', '.') if tipo != 'EMC' else f"Emenda Constitucional {int(n)}/{ano}"
            ps = get(f'{SEN}/processo?tipoNorma={tipo}&numeroNorma={int(n)}&anoNorma={ano}') or []
            for p in ps:
                if (p.get('identificacao') or '').startswith('VET'):
                    det = get(f"{SEN}/processo/{p['id']}") or {}
                    vetos.append({'id': p.get('identificacao'), 'sit': det.get('situacaoAtual') or p.get('situacaoAtual'),
                                  'cod': p.get('codigoMateria'), 'url': f"https://www25.senado.leg.br/web/atividade/materias/-/materia/{p.get('codigoMateria')}"})
                    continue
                sen_procs.append(p)
            # data e ementa oficiais
            dt = None
            for p in sen_procs:
                det = get(f"{SEN}/processo/{p['id']}") or {}
                p['_det'] = det
                ng = det.get('normaGerada') or {}
                if ng.get('dataAssinatura'): dt = ng['dataAssinatura']
                if not rec.get('ementa'): rec['ementa'] = p.get('ementa')
            o = origem.get(norma)
            if o and o[0].startswith('c:'):
                cam_ids.append((int(o[0][2:]), o[1]))
            for p in sen_procs:
                det = p.get('_det') or {}
                ident = p.get('identificacao') or ''
                if ident.startswith(('MPV', 'PLV')) or (det.get('casaIdentificadora') == 'CN'):
                    m = re.match(r'(MPV|PLV) (\d+)/(\d{4})', ident)
                    if m and m.group(1) == 'MPV':
                        cid, _ = camara_prop_id('MPV', m.group(2), m.group(3))
                        if cid: cam_ids.append((cid, ident))
                for on in det.get('outrosNumeros') or []:
                    if on.get('casaIdentificadora') == 'CD' or on.get('siglaEnteIdentificador') == 'CD':
                        cid, _ = camara_prop_id(on['sigla'], on['numero'], on['ano'])
                        if cid: cam_ids.append((cid, f"{on['sigla']} {int(on['numero'])}/{on['ano']}"))
                if ident.startswith(('PL ', 'PLP ', 'PEC ')) and int((re.search(r'/(\d{4})', ident) or [0, 0])[1]) >= 2019 and not any(True for _ in cam_ids):
                    m = re.match(r'(PL|PLP|PEC) (\d+)/(\d{4})', ident)
                    cid, _ = camara_prop_id(m.group(1), m.group(2), m.group(3))
                    if cid: cam_ids.append((cid, ident))
            rec['data'] = dt
            if not dt: problems.append(f'{lid}: norma {norma} sem data no Senado')
            if dt: rec['governo'] = governo(dt)
            for url in planalto_urls(tipo, n, ano):
                if check_planalto(url, n):
                    rec['planalto'] = url; break
            else:
                problems.append(f'{lid}: link do Planalto não confirmado')
        if L.get('camara'):
            m = re.match(r'(\w+) (\d+)/(\d{4})', L['camara'])
            cid, _ = camara_prop_id(*m.groups())
            if cid: cam_ids.append((cid, L['camara']))
            else: problems.append(f"{lid}: {L['camara']} não encontrada na Câmara")
        if L.get('senado') and not sen_procs:
            m = re.match(r'(\w+) (\d+)/(\d{4})', L['senado'])
            ps = get(f'{SEN}/processo?sigla={m.group(1)}&numero={int(m.group(2))}&ano={m.group(3)}') or []
            for p in ps:
                if p.get('casaIdentificadora') in ('SF', None) or True:
                    p['_det'] = get(f"{SEN}/processo/{p['id']}") or {}
                    sen_procs.append(p)
        # dedup
        seen = set(); cam_ids = [c for c in cam_ids if not (c[0] in seen or seen.add(c[0]))]
        if not sen_procs and not cam_ids:
            problems.append(f'{lid}: nenhuma proposição encontrada (norma {norma})')

        # ---- autores ----
        autores = []
        def add_autor(nome, casa, ext_id, partido=None, uf=None, ordem=1, prop=None):
            pid = (cam2pid.get(ext_id) if casa == 'c' else sen2pid.get(ext_id)) if ext_id else None
            for a in autores:
                if a['n'] == nome: return
            a = {'n': nome, 'c': casa}
            if pid: a['id'] = pid
            if ext_id: a['x'] = ext_id
            if partido: a['p'] = partido
            if uf: a['uf'] = uf
            if ordem and ordem > 1: a['co'] = 1
            if prop: a['pr'] = prop
            autores.append(a)
        tram = []
        for cid, sig in cam_ids:
            tram.append({'c': 'c', 's': sig, 'id': cid, 'url': f'https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao={cid}'})
            au = (get(f'{CAM}/proposicoes/{cid}/autores') or {}).get('dados') or []
            for a in au:
                m = re.search(r'/deputados/(\d+)', a.get('uri') or '')
                add_autor(a.get('nome'), 'c' if m else 'o', int(m.group(1)) if m else None, ordem=a.get('ordemAssinatura') or 1, prop=sig)
        for p in sen_procs:
            det = p.get('_det') or {}
            tram.append({'c': 's', 's': p.get('identificacao'), 'id': p.get('codigoMateria'), 'url': f"https://www25.senado.leg.br/web/atividade/materias/-/materia/{p.get('codigoMateria')}"})
            for a in det.get('autoriaIniciativa') or []:
                cod = a.get('codigoParlamentar')
                nome = a.get('autor') or a.get('nomeParlamentar')
                if not nome: continue
                if cod:
                    add_autor(nome, 's', int(cod), a.get('siglaPartido'), a.get('uf') or a.get('siglaUf'), prop=p.get('identificacao'))
                elif not any(x['n'] == nome for x in autores) and 'Câmara dos Deputados' not in nome:
                    add_autor(nome, 'o', None, prop=p.get('identificacao'))
        # Câmara: autor órgão "Poder Executivo"
        rec['autores'] = autores
        rec['tram'] = tram
        if vetos: rec['vetos'] = vetos

        # ---- votações ----
        vlist, vfile = [], {}
        for cid, sig in cam_ids:
            for v, votos, ori in camara_votes(cid, sig):
                vk = 'c' + v['id']
                dia = (v.get('dataHoraRegistro') or v.get('data'))[:10]
                rost = roster(dia)
                votaram = set()
                rows = []
                t = Counter(); pt = defaultdict(lambda: [0, 0, 0, 0, 0, 0])
                IDX = {'S': 0, 'N': 1, 'A': 2, 'O': 3, 'P': 4, 'X': 5}
                for x in votos:
                    d = x.get('deputado_') or {}
                    did = d.get('id'); votaram.add(did)
                    ch = VOTO_C.get(x.get('tipoVoto'), 'A')
                    part = d.get('siglaPartido') or ''
                    rows.append([cam2pid.get(did), d.get('nome'), part, d.get('siglaUf'), ch, 'c%d' % did])
                    t[ch] += 1; pt[part][IDX[ch]] += 1
                for did, (nome, part, uf) in rost.items():
                    if did in votaram: continue
                    rows.append([cam2pid.get(did), nome, part, uf, 'X', 'c%d' % did])
                    t['X'] += 1; pt[part or ''][5] += 1
                desc = v.get('descricao') or ''
                meta = {'k': vk, 'casa': 'c', 'dt': dia, 'd': desc[:400], 'pr': sig, 'turno': turno_de(desc),
                        'ap': 1 if re.match(r'aprovad', desc, re.I) else 0, 't': dict(t), 'pt': {k: v2 for k, v2 in sorted(pt.items())},
                        'or': {o.get('siglaPartidoBloco'): o.get('orientacaoVoto') for o in ori if o.get('siglaPartidoBloco')},
                        'src': f'{CAM}/votacoes/{v["id"]}', 'url': f'https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao={cid}',
                        'sub': 1 if re.search(r'substitutivo|subemenda|emenda substitutiva|aglutinativa', desc, re.I) else 0,
                        'emsen': 1 if re.search(r'emendas? do senado|substitutivo do senado', desc, re.I) else 0}
                if not rost: meta['semAusentes'] = 1
                vlist.append(meta); vfile[vk] = rows
        for p in sen_procs:
            det = p.get('_det') or {}
            for v in senado_votes(p.get('codigoMateria'), p.get('ementa') or det.get('ementa') or '', p.get('identificacao')):
                vk = 's%s-%s-%s' % (v.get('codigoMateria'), v.get('codigoSessaoVotacao'), v.get('sequencialVotacao') or v.get('sequencialSessao'))
                secreta = v.get('votacaoSecreta') == 'S'
                rows = []; t = Counter(); pt = defaultdict(lambda: [0, 0, 0, 0, 0, 0])
                IDX = {'S': 0, 'N': 1, 'A': 2, 'O': 3, 'P': 4, 'X': 5, 'V': 0}
                for x in v.get('votos') or []:
                    ch = voto_sen(x.get('siglaVotoParlamentar'))
                    cod = x.get('codigoParlamentar')
                    part = x.get('siglaPartidoParlamentar') or ''
                    rows.append([sen2pid.get(int(cod)) if cod else None, x.get('nomeParlamentar'), part, x.get('siglaUFParlamentar'), ch, 's%s' % cod])
                    t[ch] += 1
                    if ch != 'V': pt[part][IDX[ch]] += 1
                inf = ((v.get('informeLegislativo') or {}).get('texto')) or ''
                meta = {'k': vk, 'casa': 's', 'dt': v.get('dataSessao'), 'd': (v.get('descricaoVotacao') or '')[:300],
                        'inf': inf.split('***')[0].strip()[:400], 'pr': p.get('identificacao'), 'turno': turno_de(inf),
                        'ap': 1 if v.get('resultadoVotacao') == 'A' else 0, 't': dict(t), 'pt': {k: v2 for k, v2 in sorted(pt.items())},
                        'url': f"https://www25.senado.leg.br/web/atividade/materias/-/materia/{v.get('codigoMateria')}",
                        'src': f"{SEN}/votacao?codigoMateria={v.get('codigoMateria')}"}
                if not meta['turno']: meta['turno'] = turno_de(v.get('descricaoVotacao') or '')
                if v.get('_sub') or re.search(r'substitutiv', v.get('descricaoVotacao') or '', re.I): meta['sub'] = 1
                if secreta: meta['secreta'] = 1
                vlist.append(meta); vfile[vk] = rows
        vlist.sort(key=lambda m: (m['dt'] or '', m['casa']))
        rec['votacoes'] = vlist
        if vfile:
            with open(os.path.join(OUT, 'votos', lid + '.json'), 'w') as fh:
                json.dump({'lei': lid, 'v': vfile}, fh, ensure_ascii=False, separators=(',', ':'))
        for m in vlist:
            allvotes.append((lid, m))
            for row in vfile[m['k']]:
                key = row[5]
                P = persons.setdefault(key, {'n': row[1], 'p': row[2], 'uf': row[3], 'id': row[0], 'v': {}, 'dt': ''})
                if (m['dt'] or '') >= P['dt']:
                    P['n'], P['p'], P['uf'], P['dt'] = row[1], row[2], row[3], m['dt'] or ''
                    if row[0]: P['id'] = row[0]
                P['v'][m['k']] = row[4]

        # ---- coerência nas leis curadas ----
        autor_keys = {}
        for a in autores:
            if a.get('x') and a['c'] in ('c', 's'):
                autor_keys[a['c'] + str(a['x'])] = a
        by_pid = defaultdict(list)
        for m in vlist:
            for row in vfile[m['k']]:
                if row[0]: by_pid[row[0]].append((m, row))
        for m in vlist:
            if m.get('emsen') or m.get('sub'): continue
            for row in vfile[m['k']]:
                a = autor_keys.get(row[5])
                if not a and row[0]:
                    a = next((x for x in autores if x.get('id') == row[0]), None)
                if a and row[4] == 'N':
                    coer.append({'t': 'a', 'lei': lid, 'k': m['k'], 'id': row[0], 'x': row[5], 'n': row[1], 'p': row[2], 'uf': row[3],
                                 'dt': m['dt'], 'pr': m['pr'], 'co': a.get('co', 0), 'aut': a.get('pr'), 'sub': m.get('sub', 0), 'v': 'N'})
        # (b) contra a orientação do próprio partido (Câmara)
        for m in vlist:
            if m['casa'] != 'c' or not m.get('or'): continue
            for row in vfile[m['k']]:
                o = m['or'].get(row[2])
                if o in ('Sim', 'Não') and row[4] in ('S', 'N') and {'Sim': 'S', 'Não': 'N'}[o] != row[4]:
                    coer.append({'t': 'b', 'lei': lid, 'k': m['k'], 'id': row[0], 'x': row[5], 'n': row[1], 'p': row[2], 'uf': row[3],
                                 'dt': m['dt'], 'pr': m['pr'], 'v': row[4], 'or': o})
        # (c) mudou entre 1º e 2º turno
        for casa in ('c', 's'):
            t1 = [m for m in vlist if m['casa'] == casa and m['turno'] == 1]
            t2 = [m for m in vlist if m['casa'] == casa and m['turno'] == 2]
            if not t1 or not t2: continue
            a1, a2 = t1[0], t2[-1]
            v1 = {r[5]: r for r in vfile[a1['k']]}
            for r2 in vfile[a2['k']]:
                r1 = v1.get(r2[5])
                if r1 and r1[4] in ('S', 'N') and r2[4] in ('S', 'N') and r1[4] != r2[4]:
                    coer.append({'t': 'c', 'lei': lid, 'k': a2['k'], 'k1': a1['k'], 'id': r2[0], 'x': r2[5], 'n': r2[1], 'p': r2[2], 'uf': r2[3],
                                 'dt': a2['dt'], 'dt1': a1['dt'], 'pr': a2['pr'], 'v1': r1[4], 'v': r2[4]})
        rec['nVotacoes'] = len(vlist)
        catalog.append(rec)

    # ---------- saída ----------
    order = [m['k'] for _, m in allvotes]
    vidx = {k: i for i, k in enumerate(order)}
    plist = []
    for key, P in persons.items():
        s = ['.'] * len(order)
        for k, ch in P['v'].items(): s[vidx[k]] = ch
        plist.append([key, P['n'], P['p'], P['uf'], P['id'], ''.join(s)])
    plist.sort(key=lambda r: norm_txt(r[1]))
    meta = {'gerado': time.strftime('%Y-%m-%d %H:%M'), 'n': len(catalog),
            'fontes': ['https://dadosabertos.camara.leg.br/swagger/api.html', 'https://legis.senado.leg.br/dadosabertos/api-docs/swagger-ui/index.html']}
    with open(os.path.join(OUT, 'leis.json'), 'w') as fh:
        json.dump({'meta': meta, 'leis': catalog}, fh, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(OUT, 'pessoas.json'), 'w') as fh:
        json.dump({'votos': [[lid, m['k'], m['casa'], m['dt'], m['turno']] for lid, m in allvotes], 'p': plist}, fh, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(OUT, 'coerencia-leis.json'), 'w') as fh:
        json.dump({'gerado': meta['gerado'], 'casos': coer}, fh, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(OUT, 'problemas.txt'), 'w') as fh:
        fh.write('\n'.join(problems) + '\n')
    log('leis', len(catalog), 'votações', len(order), 'pessoas', len(plist), 'casos', Counter(c['t'] for c in coer))
    log('\n'.join(problems))

if __name__ == '__main__':
    main()
