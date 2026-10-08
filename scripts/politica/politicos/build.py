#!/usr/bin/env python3
"""Etapa 3: junta TSE + Câmara + Senado, resolve identidades e gera o JSON estático publicado.

Entrada : RAW/stage/{cand,votos}_*.parquet, RAW/stage/old_{1989,1990}.parquet, RAW/stage/congresso.json,
          RAW/unz/municipio_tse_ibge/municipio_tse_ibge.csv, scripts/politica/politicos/ajustes.json
Saída   : politica/data/politicos/**  (sem CPF, título de eleitor ou data de nascimento)
"""
import base64, csv, hashlib, json, os, re, shutil, sys, time, unicodedata
from collections import defaultdict, Counter
import duckdb

RAW = os.environ.get('POL_RAW', '/workspace/pol-politicos-raw')
S = f'{RAW}/stage'
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OUT = os.path.join(ROOT, 'politica', 'data', 'politicos')
HERE = os.path.dirname(os.path.abspath(__file__))
HOJE = time.strftime('%Y-%m-%d')
ANO_ATUAL = int(HOJE[:4])
MES_ATUAL = ANO_ATUAL * 12 + int(HOJE[5:7]) - 1
PARTY_NAMES = {}

CARGOS = {1: 'Presidente', 2: 'Vice-presidente', 3: 'Governador', 4: 'Vice-governador', 5: 'Senador',
          6: 'Deputado federal', 7: 'Deputado estadual', 8: 'Deputado distrital', 9: '1º suplente de senador',
          10: '2º suplente de senador', 11: 'Prefeito', 12: 'Vice-prefeito', 13: 'Vereador'}
MUNICIPAIS = {11, 12, 13}
VICE_DE = {2: 1, 4: 3, 12: 11, 9: 5, 10: 5}
PARTICULAS = {'DA', 'DE', 'DO', 'DOS', 'DAS', 'E', 'D'}


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def norm(s):
    if not s:
        return ''
    s = unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode().upper()
    s = re.sub(r'[^A-Z ]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


def _fon(t):
    t = t.replace('PH', 'F').replace('TH', 'T').replace('Y', 'I').replace('Z', 'S').replace('W', 'V').replace('K', 'C')
    return re.sub(r'(.)\1+', r'\1', t)


def toks(n):
    return [_fon(t) for t in n.split() if t not in PARTICULAS]


def sim(a, b):
    """Semelhança de nomes (0–1): fração de palavras do nome menor presentes no maior."""
    ta, tb = set(toks(a)), set(toks(b))
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / min(len(ta), len(tb))


def cpf_ok(c):
    if not c or not re.fullmatch(r'\d{11}', c) or len(set(c)) == 1:
        return False
    d = [int(x) for x in c]
    for n in (9, 10):
        s = sum(d[i] * (n + 1 - i) for i in range(n)) % 11
        if (0 if s < 2 else 11 - s) != d[n]:
            return False
    return True


def titulo_ok(t):
    return bool(t) and re.fullmatch(r'\d{12}', t) is not None and int(t) > 0


def title(s):
    """CAIXA ALTA -> Nome Próprio (sem inventar acentos)."""
    if not s:
        return s
    out = []
    for i, w in enumerate(str(s).lower().split()):
        if i and w in ('da', 'de', 'do', 'dos', 'das', 'e', "d'"):
            out.append(w)
        else:
            out.append('-'.join(p[:1].upper() + p[1:] for p in w.split('-')))
    return ' '.join(out)


def pid(anchor):
    return base64.b32encode(hashlib.sha1(anchor.encode()).digest()).decode().lower()[:10]


PARTY_FIX = {'PC DO B': 'PCdoB', 'PCDOB': 'PCdoB', 'PT DO B': 'PTdoB', 'PTDOB': 'PTdoB', 'SOLIDARIEDADE': 'SOLIDARIEDADE',
             'PATRI': 'PATRIOTA', 'REPUBLICANOS': 'REPUBLICANOS', 'UNIÃO': 'UNIÃO', 'UNIAO': 'UNIÃO', 'PODE': 'PODE',
             'CIDADANIA': 'CIDADANIA', 'PROGRESSISTAS': 'PP', 'PPS': 'PPS', 'S.PART.': None, 'S/PARTIDO': None, '#NULO#': None,
             '#NULO': None, '#NE': None, '#NE#': None, '': None}


def party(p):
    if p is None:
        return None
    p = str(p).strip()
    up = p.upper()
    if up in PARTY_FIX:
        return PARTY_FIX[up]
    return up


# ---------------------------------------------------------------------------------------------
# 1. TSE: candidaturas finais (1994–2026) + votos
# ---------------------------------------------------------------------------------------------
def load_tse(con):
    log('TSE: carregando candidaturas')
    con.execute(f"""
    create or replace table c0 as select
      cast(ANO_ELEICAO as int) ano, cast(NR_TURNO as int) turno, CD_ELEICAO cde, upper(NM_TIPO_ELEICAO) tipo, DT_ELEICAO dt,
      SG_UF uf, SG_UE ue, NM_UE ue_nome, cast(CD_CARGO as int) cargo, SQ_CANDIDATO sq, NR_CANDIDATO nr,
      NM_CANDIDATO nome, NM_URNA_CANDIDATO urna, NR_CPF_CANDIDATO cpf, lpad(NR_TITULO_ELEITORAL_CANDIDATO, 12, '0') titulo,
      DT_NASCIMENTO nasc, DS_GENERO genero, SG_PARTIDO partido, NM_PARTIDO nm_partido, upper(DS_SIT_TOT_TURNO) sit, DS_SITUACAO_CANDIDATURA sitcand
    from read_parquet('{S}/cand_*.parquet') where try_cast(CD_CARGO as int) between 1 and 13""")
    con.execute(f"""
    create or replace table vt as select cast(ANO_ELEICAO as int) ano, SG_UE uek, SQ_CANDIDATO sq, cast(CD_CARGO as int) cargo,
      max(cast(NR_TURNO as int)) vtmax, arg_max(sit_vot, cast(NR_TURNO as int)) vsit,
      sum(case when NR_TURNO = '1' then votos end) v1, sum(case when NR_TURNO = '2' then votos end) v2
    from read_parquet('{S}/votos_*.parquet') group by all""")
    con.execute("""
    create or replace table cf0 as select
      ano, supl, ue, cargo, sq, arg_max(cde, turno) cde,
      arg_max(tipo, turno) tipo, arg_max(dt, turno) dt, arg_max(uf, turno) uf, arg_max(ue_nome, turno) ue_nome,
      arg_max(nr, turno) nr, arg_max(nome, turno) nome, arg_max(urna, turno) urna, arg_max(cpf, turno) cpf,
      arg_max(titulo, turno) titulo, arg_max(nasc, turno) nasc, arg_max(genero, turno) genero, arg_max(partido, turno) partido,
      arg_max(sit, turno) sit, max(turno) tmax, arg_max(sitcand, turno) sitcand
    from (select *, case when tipo like '%SUPLEMENTAR%' then 's' else 'o' end supl from c0) c0
    group by ano, supl, ue, cargo, sq""")
    # junta votos (e o resultado do arquivo de votação quando o de candidatos não informa, ex.: Presidente 2006)
    con.execute("""
    create or replace table cf as select
      row_number() over (order by c.ano, c.supl, c.ue, c.cargo, c.sq) - 1 as rid, c.* exclude (sit, tmax),
      case when (c.sit is null or c.sit like '#N%' or coalesce(vt.vtmax, 0) > c.tmax) and vt.vsit is not null and vt.vsit not like '#N%'
           then vt.vsit else c.sit end as sit,
      greatest(c.tmax, coalesce(vt.vtmax, 0)) tmax, vt.v1, vt.v2
    from cf0 c left join vt on vt.ano = c.ano and vt.sq = c.sq and vt.cargo = c.cargo
      and vt.uek = case when c.ano % 4 = 0 then c.ue when c.cargo in (1,2) then 'BR' else c.uf end""")
    # resultado codificado
    con.execute("""
    create or replace table cf2 as select cf.*,
      case
        when sit in ('ELEITO') then 'E'
        when sit like 'ELEITO POR QP%' then 'Q'
        when sit like 'ELEITO POR M%' or sit = 'MÉDIA' or sit = 'MEDIA' then 'M'
        when sit = 'SUPLENTE' then 'S'
        when sit = 'NÃO ELEITO' or sit = 'NAO ELEITO' then 'N'
        when sit like '2%TURNO' then 'T'
        when (sit like '#N%' or sit is null) and upper(coalesce(sitcand, '')) similar to '.*(INDEFERID|CANCELAD|RENUNCI|RENÚNCI|CASSAD|FALECID|NÃO CONHECID|INAPTO|NEGADO).*' then 'X'
        when sit like '#N%' or sit is null then 'U'
        else 'X' end as res
    from cf""")
    # Sem resultado no TSE (ex.: Presidente 2006): nos cargos majoritários que tiveram 2º turno, quem teve mais votos no 2º turno venceu.
    con.execute("""
    create or replace table cf2 as with w as (
      select ano, supl, ue, cargo, max(v2) mx from cf2 where cargo in (1,3,11) and v2 is not null group by all)
    select cf2.* replace (case when cf2.res in ('U','T') and cf2.v2 is not null and w.mx is not null
                                then (case when cf2.v2 = w.mx then 'E' else 'N' end) else cf2.res end as res)
    from cf2 left join w using (ano, supl, ue, cargo)""")
    # vices e suplentes de senador: herdam o resultado da chapa (titular com mesmo número na mesma eleição)
    con.execute("""
    create or replace table cand as
    with t as (select ano, supl, ue, cast(nr as varchar) nr, cargo,
        case max(case when res in ('E','Q','M') then 3 when res = 'T' then 2 when res in ('N','S','X') then 1 else 0 end)
          when 3 then 'E' when 2 then 'T' when 1 then 'N' else null end as res
        from cf2 where cargo in (1,3,5,11) group by all),
    -- vice/suplente -> titular da chapa: mesmo número; em 1994/1998 o vice tem o número do titular + 1 dígito (15 -> 154)
    vt as (select a.rid, max_by(t.res, length(t.nr)) tres
        from cf2 a join t on a.cargo in (2,4,12,9,10) and t.ano = a.ano and t.supl = a.supl and t.ue = a.ue
          and starts_with(cast(a.nr as varchar), t.nr)
          and t.cargo = case a.cargo when 2 then 1 when 4 then 3 when 12 then 11 else 5 end
        group by a.rid)
    select a.*,
      case when a.cargo in (2,4,12,9,10) then
        case when vt.tres in ('E','Q','M') then 'V' when vt.tres = 'T' then 'T'
             when vt.tres is null then (case when a.res in ('E') then 'V' else a.res end) else 'N' end
      else a.res end as rfinal
    from cf2 a left join vt using (rid)""")
    n = con.execute('select count(*), count(distinct rid) from cand').fetchone()
    log('TSE candidaturas', n)
    # chaves de identidade (CPF/título/nascimento só ficam em memória nesta etapa)
    con.execute(r"""
    create or replace table cand_n as select *,
      trim(regexp_replace(regexp_replace(strip_accents(upper(nome)), '[^A-Z ]', ' ', 'g'), '\s+', ' ', 'g')) nome_n,
      case when regexp_full_match(nasc, '\d{2}/\d{2}/\d{4}') and cast(substr(nasc,7,4) as int) between 1900 and 2010
                and nasc not in ('01/01/1900') then substr(nasc,7,4)||'-'||substr(nasc,4,2)||'-'||substr(nasc,1,2) end nasc_v,
      case when regexp_full_match(cpf, '\d{11}') then cpf end cpf_v,
      case when regexp_full_match(titulo, '\d{12}') and titulo <> '000000000000' then titulo end tit_v
    from cand""")


def closure(con, extra_keys):
    """Seleciona as candidaturas ligadas (por qualquer chave) a quem foi eleito ou teve mandato no Congresso."""
    con.execute("""
    create or replace table k as
      select rid, 'c'||cpf_v k from cand_n where cpf_v is not null
      union all select rid, 't'||tit_v from cand_n where tit_v is not null
      union all select rid, 'n'||nome_n||'|'||nasc_v from cand_n where nasc_v is not null""")
    con.execute('create or replace table xk (k varchar)')
    if extra_keys:
        con.executemany('insert into xk values (?)', [[x] for x in sorted(extra_keys)])
    con.execute("""create or replace table relr as select rid from cand_n where rfinal in ('E','Q','M','V')
                   union select rid from k where k in (select k from xk)""")
    prev = -1
    for it in range(8):
        con.execute('create or replace table relk as select distinct k from k where rid in (select rid from relr)')
        con.execute('create or replace table relr as select distinct rid from k where k in (select k from relk) union select rid from relr')
        n = con.execute('select count(*) from relr').fetchone()[0]
        log('fecho', it, n)
        if n == prev:
            break
        prev = n


# ---------------------------------------------------------------------------------------------
# Union-find
# ---------------------------------------------------------------------------------------------
class UF:
    def __init__(self):
        self.p = {}

    def find(self, x):
        p = self.p
        p.setdefault(x, x)
        r = x
        while p[r] != r:
            r = p[r]
        while p[x] != r:
            p[x], x = r, p[x]
        return r

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            if ra < rb:
                self.p[rb] = ra
            else:
                self.p[ra] = rb


def compat(na, da, nb, db):
    """Dois registros com o mesmo CPF/título são a mesma pessoa? Protege contra erros de digitação na fonte."""
    s = sim(na, nb)
    if da and db and da != db:
        return s >= 0.8
    if da and db and da == db:
        return s >= 0.25
    return s >= 0.5


def main():
    t0 = time.time()
    reuse = os.environ.get('POL_REUSE') == '1'   # desenvolvimento: reaproveita as tabelas do TSE já carregadas
    dbf = f'{RAW}/work/build.duckdb'
    os.makedirs(os.path.dirname(dbf), exist_ok=True)
    if not reuse and os.path.exists(dbf):
        os.remove(dbf)
    con = duckdb.connect(dbf)
    con.execute("set threads to 8; set memory_limit='6GB'; set preserve_insertion_order=false")
    cong = json.load(open(os.environ.get('POL_CONGRESSO', f'{S}/congresso.json')))
    aj = json.load(open(os.path.join(HERE, 'ajustes.json')))
    if not (reuse and con.execute("select count(*) from information_schema.tables where table_name = 'cand_n'").fetchone()[0]):
        load_tse(con)

    # ---- Câmara e Senado: nós e chaves
    dep = {int(k): v for k, v in cong['camara']['dep'].items()}
    por_leg = {int(k): v for k, v in cong['camara']['por_leg'].items()}
    legs = {l['id']: l for l in cong['camara']['legislaturas']}
    sen = cong['senado']['sen']
    extra = set()
    cam_keys, sen_keys = {}, {}
    for i, d in dep.items():
        det = d.get('det') or {}
        ks = []
        if cpf_ok(det.get('cpf')):
            ks.append('c' + det['cpf'])
        nn, dn = norm(det.get('nomeCivil')), det.get('dataNascimento')
        if nn and dn and dn > '1900-01-01':
            ks.append('n' + nn + '|' + dn)
        cam_keys[i] = (nn, dn, ks)
        extra.update(ks)
    for c, s in sen.items():
        idt = s.get('ident') or {}
        nn = norm(idt.get('NomeCompletoParlamentar'))
        dn = (s.get('basicos') or {}).get('DataNascimento')
        ks = ['n' + nn + '|' + dn] if nn and dn and dn > '1900-01-01' else []
        sen_keys[c] = (nn, dn, ks)
        extra.update(ks)
    closure(con, extra)

    log('carregando candidaturas relevantes')
    rows = con.execute("""select rid, ano, supl, ue, cargo, sq, tipo, dt, uf, ue_nome, nr, nome, urna, cpf_v, tit_v, nasc_v,
        genero, partido, rfinal, sit, tmax, v1, v2, nome_n from cand_n where rid in (select rid from relr) order by rid""").fetchall()
    cols = ['rid', 'ano', 'supl', 'ue', 'cargo', 'sq', 'tipo', 'dt', 'uf', 'ue_nome', 'nr', 'nome', 'urna', 'cpf', 'tit', 'nasc',
            'genero', 'partido', 'res', 'sit', 'tmax', 'v1', 'v2', 'nome_n']
    R = {r[0]: dict(zip(cols, r)) for r in rows}
    del rows
    log('registros', len(R))

    uf = UF()
    first = {}
    possiveis = set()   # pares (nóA, nóB) com indício de ser a mesma pessoa, sem prova
    conflitos = 0

    def link_key(node, key, nn, dn):
        nonlocal conflitos
        if key in first:
            onode, onn, odn = first[key]
            if key[0] == 'n' or compat(nn, dn, onn, odn):
                uf.union(node, onode)
            else:
                conflitos += 1
                if conflitos <= 25 and os.environ.get('POL_DEBUG'):
                    log('conflito', key[0], nn, dn, '<>', onn, odn)
                if sim(nn, onn) >= 0.5 or (dn and dn == odn):
                    possiveis.add((min(node, onode), max(node, onode), 'mesmo documento na fonte, nomes/datas diferentes'))
        else:
            first[key] = (node, nn, dn)

    for rid, r in R.items():
        node = ('t', rid)
        uf.find(node)
        if r['cpf'] and cpf_ok(r['cpf']):
            link_key(node, 'c' + r['cpf'], r['nome_n'], r['nasc'])
        if r['tit'] and titulo_ok(r['tit']):
            link_key(node, 't' + r['tit'], r['nome_n'], r['nasc'])
        if r['nasc']:
            link_key(node, 'n' + r['nome_n'] + '|' + r['nasc'], r['nome_n'], r['nasc'])
    log('TSE ligado; conflitos', conflitos)

    # índice de candidaturas por (cargo, ano, uf) para ligação "pelo mandato"
    by_seat = defaultdict(list)
    for rid, r in R.items():
        if r['cargo'] in (5, 6, 9, 10):
            by_seat[(r['cargo'], r['ano'], r['uf'])].append(rid)

    # ---- dados antigos (1989/1990): só nome
    old = con.execute(f"""select ANO_ELEICAO, NR_TURNO, SG_UF, SG_UE, CD_CARGO, NR_CANDIDATO, NM_CANDIDATO, NM_URNA_CANDIDATO,
        DS_SIT_TOT_TURNO, SG_PARTIDO, sum(try_cast(TOTAL_VOTOS as bigint)) from read_parquet('{S}/old_*.parquet')
        group by all""").fetchall()
    O = {}
    for a, t, ufs, ue, cg, nr, nm, urna, sit, pt, vt in old:
        a, t, cg = int(a), int(t), int(cg)
        ufk = 'BR' if cg in (1, 2) else ufs
        key = (a, ufk, cg, nr, norm(nm))
        o = O.setdefault(key, {'ano': a, 'uf': ufk, 'cargo': cg, 'nr': nr, 'nome': nm, 'urna': urna if urna and urna[0] != '#' else None,
                               'nome_n': norm(nm), 'partido': pt, 'v1': None, 'v2': None, 'sit1': None, 'sit2': None})
        o['v%d' % t] = (o['v%d' % t] or 0) + (vt or 0)
        o['sit%d' % t] = sit
    for o in O.values():
        sit = (o['sit2'] or o['sit1'] or '').upper()
        o['res'] = 'E' if sit == 'ELEITO' else 'S' if sit == 'SUPLENTE' else 'T' if '2' in sit and 'TURNO' in sit else 'N' if 'ELEITO' in sit else 'U'
        o['tmax'] = 2 if o['sit2'] else 1
    O = {k: o for k, o in O.items() if o['res'] in ('E',) or o['cargo'] in (1,)}
    log('registros 1989/1990 eleitos', sum(1 for o in O.values() if o['res'] == 'E'))
    old_seat = defaultdict(list)
    for k, o in O.items():
        old_seat[(o['cargo'], o['ano'], o['uf'])].append(k)

    def seat_match(cands, names, getname, minsim=0.75):
        best, bs, second = None, 0, 0
        for c in cands:
            s = max(max(sim(n, getname(c)[0]), sim(n, getname(c)[1]) if getname(c)[1] else 0) for n in names if n)
            if s > bs:
                best, bs, second = c, s, bs
            elif s > second:
                second = s
        if best is not None and bs >= minsim and bs > second:
            return best
        return None

    # ---- Câmara
    leg_uf = defaultdict(dict)
    for L, ents in por_leg.items():
        for e in ents:
            leg_uf[e['id']][L] = e
    vinc = Counter()
    for i, d in dep.items():
        node = ('c', i)
        uf.find(node)
        nn, dn, ks = cam_keys[i]
        for k in ks:
            if k in first:
                link_key(node, k, nn, dn)
                vinc['camara_doc'] += 1
                break
        else:
            det = d.get('det') or {}
            names = [nn, norm((det.get('ultimoStatus') or {}).get('nomeEleitoral')), norm((det.get('ultimoStatus') or {}).get('nome'))]
            done = False
            for L, e in sorted(leg_uf[i].items()):
                y = int(legs[L]['dataInicio'][:4]) - 1
                if y >= 1994:
                    m = seat_match(by_seat.get((6, y, e['uf']), []), names, lambda rid: (R[rid]['nome_n'], norm(R[rid]['urna'])))
                    if m is not None:
                        uf.union(node, ('t', m)); vinc['camara_cadeira'] += 1; done = True; break
            if not done:
                vinc['camara_sem_tse'] += 1
        # 1990 -> legislatura 49
        if 49 in leg_uf[i]:
            det = d.get('det') or {}
            names = [nn, norm((det.get('ultimoStatus') or {}).get('nome'))]
            m = seat_match(old_seat.get((6, 1990, leg_uf[i][49]['uf']), []), names, lambda k: (O[k]['nome_n'], norm(O[k]['urna'])))
            if m is not None:
                uf.union(node, ('o', m)); vinc['camara_1990'] += 1
    # ---- Senado
    for c, s in sen.items():
        node = ('s', c)
        uf.find(node)
        nn, dn, ks = sen_keys[c]
        linked = False
        for k in ks:
            if k in first:
                link_key(node, k, nn, dn); linked = True; vinc['senado_doc'] += 1
                break
        names = [nn, norm((s.get('ident') or {}).get('NomeParlamentar'))]
        for m in s.get('mandatos') or []:
            part = m.get('DescricaoParticipacao') or ''
            cg = 5 if part.startswith('Titular') else 9 if part.startswith('1') else 10 if part.startswith('2') else None
            ini = ((m.get('PrimeiraLegislaturaDoMandato') or {}).get('DataInicio') or '')[:4]
            if not cg or not ini:
                continue
            y = int(ini) - 1
            ufm = m.get('UfParlamentar')
            if y >= 1994 and not linked:
                mm = seat_match(by_seat.get((cg, y, ufm), []), names, lambda rid: (R[rid]['nome_n'], norm(R[rid]['urna'])), 0.6)
                if mm is not None:
                    uf.union(node, ('t', mm)); linked = True; vinc['senado_cadeira'] += 1
            if y == 1990 and cg == 5:
                mm = seat_match(old_seat.get((5, 1990, ufm), []), names, lambda k: (O[k]['nome_n'], norm(O[k]['urna'])), 0.6)
                if mm is not None:
                    uf.union(node, ('o', mm)); vinc['senado_1990'] += 1
        if not linked:
            vinc['senado_sem_tse'] += 1
    log('vínculos', dict(vinc))

    # ---- ajustes manuais documentados (presidência)
    sen_by_name = {norm((s.get('ident') or {}).get('NomeParlamentar')): c for c, s in sen.items()}
    def find_ref(ref):
        if 'senado' in ref:
            c = sen_by_name.get(norm(ref['senado']))
            return ('s', c) if c else None
        if 'tse' in ref:
            a, cg, nm = ref['tse']
            for rid, r in R.items():
                if r['ano'] == a and r['cargo'] == cg and r['nome_n'] == norm(nm):
                    return ('t', rid)
            for k, o in O.items():
                if o['ano'] == a and o['cargo'] == cg and o['nome_n'] == norm(nm):
                    return ('o', k)
        return None
    for p in aj['pessoas']:
        nodes = [find_ref(r) for r in p['refs']]
        if any(n is None for n in nodes):
            log('AVISO ajuste sem correspondência', p['nome'], p['refs'], nodes)
        nodes = [n for n in nodes if n]
        for n in nodes[1:]:
            uf.union(nodes[0], n)
        p['_nodes'] = nodes
    for k in O:
        uf.find(('o', k))

    # ---- clusters
    groups = defaultdict(list)
    for n in list(uf.p):
        groups[uf.find(n)].append(n)
    log('clusters', len(groups))

    # ---- municípios
    mun = {}
    with open(f'{RAW}/unz/municipio_tse_ibge/municipio_tse_ibge.csv', encoding='latin-1') as f:
        for r in csv.DictReader(f, delimiter=';'):
            mun[r['CD_MUNICIPIO_TSE'].zfill(5)] = {'n': r['NM_MUNICIPIO_IBGE'] or r['NM_MUNICIPIO_TSE'], 'uf': r['SG_UF'],
                                                   'ibge': int(r['CD_MUNICIPIO_IBGE']) if r['CD_MUNICIPIO_IBGE'].strip('-').isdigit() and int(r['CD_MUNICIPIO_IBGE']) > 0 else None}
    for r in R.values():
        if r['cargo'] in MUNICIPAIS:
            k = str(r['ue']).zfill(5)
            if k not in mun:
                mun[k] = {'n': title(r['ue_nome']), 'uf': r['uf'], 'ibge': None, 'tse_only': True}

    global PARTY_NAMES
    PARTY_NAMES = {}
    for sg, nm in con.execute("select partido, arg_max(nm_partido, ano) from c0 where partido is not null group by 1").fetchall():
        p = party(sg)
        if p and nm and not nm.startswith('#'):
            PARTY_NAMES[p] = title(nm) if nm.isupper() else nm
    build_people(groups, R, O, dep, legs, leg_uf, sen, cong, aj, mun, possiveis, con)
    con.close()
    if not reuse:
        os.remove(dbf)  # contém CPF/título: não fica no disco
    log('fim', round(time.time() - t0), 's')


# ---------------------------------------------------------------------------------------------
# Períodos de mandato
# ---------------------------------------------------------------------------------------------
def periodo_tse(r):
    """(mês_início, mês_fim) em meses absolutos (ano*12+mês-1) e anos exibidos, pelo calendário oficial do cargo."""
    a, cg = r['ano'], r['cargo']
    sup = 'SUPLEMENTAR' in (r.get('tipo') or '')
    if cg in MUNICIPAIS:
        if sup:
            # mandato-tampão até o fim do ciclo municipal
            fim = a + (4 - a % 4) % 4
            try:
                d, m, y = (r.get('dt') or '').split('/')
                ini = int(y) * 12 + int(m)  # posse ~ mês seguinte
            except Exception:
                ini = a * 12 + 6
            return ini, (fim + 1) * 12, a, fim
        return (a + 1) * 12, (a + 5) * 12, a + 1, a + 4
    if cg in (1, 2, 3, 4):
        if sup:
            fim = a + (4 - (a - 2) % 4) % 4
            return a * 12 + 6, (fim + 1) * 12, a, fim
        if a == 1989:
            return 1990 * 12 + 2, 1995 * 12, 1990, 1994
        return (a + 1) * 12, (a + 5) * 12, a + 1, a + 4
    if cg in (5, 9, 10):
        return (a + 1) * 12 + 1, (a + 9) * 12 + 1, a + 1, a + 9
    return (a + 1) * 12 + 1, (a + 5) * 12 + 1, a + 1, a + 5


def mes(dt):
    return int(dt[:4]) * 12 + int(dt[5:7]) - 1


def build_people(groups, R, O, dep, legs, leg_uf, sen, cong, aj, mun, possiveis, con):
    cam_ex = set(cong['camara']['em_exercicio'])
    sen_ex = set(cong['senado']['em_exercicio'])
    pres_aj = {}
    for p in aj['pessoas']:
        for n in p.get('_nodes', []):
            pres_aj.setdefault(n, p)
    people = {}
    node2pid = {}
    anchors_all = {}
    for root, nodes in groups.items():
        tn = sorted(n[1] for n in nodes if n[0] == 't')
        on = sorted(n[1] for n in nodes if n[0] == 'o')
        cn = sorted(n[1] for n in nodes if n[0] == 'c')
        sn = sorted((n[1] for n in nodes if n[0] == 's'), key=int)
        recs = [R[x] for x in tn]
        elected = any(r['res'] in ('E', 'Q', 'M', 'V') for r in recs) or any(O[k]['res'] == 'E' for k in on)
        sen_mand = False
        for c in sn:
            for m in sen[c].get('mandatos') or []:
                if (m.get('DescricaoParticipacao') or '').startswith('Titular') or m.get('Exercicios'):
                    sen_mand = True
        aj_p = next((pres_aj[n] for n in nodes if n in pres_aj), None)
        if not (elected or cn or sen_mand or aj_p):
            continue
        if tn:
            r0 = R[tn[0]]
            anchor = f"t:{r0['ano']}:{r0['supl']}:{r0['ue']}:{r0['cargo']}:{r0['sq']}"
        elif cn:
            anchor = f'c:{cn[0]}'
        elif sn:
            anchor = f's:{sn[0]}'
        else:
            o = O[on[0]]
            anchor = f"o:{o['ano']}:{o['uf']}:{o['cargo']}:{o['nr']}:{o['nome_n']}"
        i = pid(anchor)
        if i in people:
            raise SystemExit('colisão de id ' + i)
        for x in tn:
            r = R[x]
            anchors_all[pid(f"t:{r['ano']}:{r['supl']}:{r['ue']}:{r['cargo']}:{r['sq']}")] = i
        for n in nodes:
            node2pid[n] = i
        people[i] = {'nodes': nodes, 'tn': tn, 'on': on, 'cn': cn, 'sn': sn, 'aj': aj_p}
    log('pessoas', len(people))

    out_people = {}
    for i, P in people.items():
        out_people[i] = make_person(i, P, R, O, dep, legs, leg_uf, sen, cam_ex, sen_ex, mun)

    # possivelmente a mesma pessoa: (a) conflitos de documento; (b) registros só com nome (1989/1990, 1996 sem nascimento)
    poss = defaultdict(set)
    for a, b, why in possiveis:
        pa, pb = node2pid.get(a), node2pid.get(b)
        if pa and pb and pa != pb:
            poss[pa].add((pb, 'doc')); poss[pb].add((pa, 'doc'))
    by_name = defaultdict(set)
    for i, P in out_people.items():
        for nn in P['_names']:
            by_name[nn].add(i)
    for i, P in out_people.items():
        if not P['_weak']:
            continue
        for nn in P['_names']:
            cands = [j for j in by_name[nn] if j != i]
            # mesma UF (ou cargo nacional) e sem conflito de período
            cands = [j for j in cands if (P['_ufs'] & out_people[j]['_ufs']) or 'BR' in P['_ufs'] or 'BR' in out_people[j]['_ufs']]
            if 1 <= len(cands) <= 3:
                for j in cands:
                    poss[i].add((j, 'nome')); poss[j].add((i, 'nome'))
    for i, s in poss.items():
        out_people[i]['pm'] = sorted([j, w] for j, w in s)[:6]

    # ids do mapa (/politica/mapa/, slug-uf) -> id daqui, pela candidatura (ano, cargo, local, SQ_CANDIDATO)
    MAPA_IDS.clear()
    by_cand = {}
    for i, P in people.items():
        for x in P['tn']:
            r = R[x]
            by_cand[(int(r['ano']), int(r['cargo']), str(r['ue']), str(r['sq']).lstrip('0'))] = i
    ibge2tse = {str(m.get('ibge')): k for k, m in mun.items() if m.get('ibge')}
    pdir = os.path.join(ROOT, 'politica', 'data', 'mapa', 'pol', 'pessoas')
    miss = hit = 0
    for fn in sorted(os.listdir(pdir)) if os.path.isdir(pdir) else []:
        try:
            d = json.load(open(os.path.join(pdir, fn))).get('pessoas', {})
        except Exception:
            continue
        uf = fn[:-5]
        for slug, cands in d.items():
            ids = []
            for c in cands:
                ano, cargo, local, sq = int(c[0]), int(c[1]), str(c[2]), str(c[4]).lstrip('0')
                ue = ibge2tse.get(local, local) if cargo in MUNICIPAIS else (uf if len(local) != 2 else local)
                j = by_cand.get((ano, cargo, ue, sq))
                if j and j not in ids:
                    ids.append(j)
            if ids:
                MAPA_IDS[uf][slug] = ids if len(ids) > 1 else ids[0]; hit += 1
            else:
                miss += 1
    log('ids do mapa ligados', hit, 'sem ligação', miss)
    write_output(out_people, mun, cong, aj, anchors_all)


def make_person(i, P, R, O, dep, legs, leg_uf, sen, cam_ex, sen_ex, mun):
    recs = sorted((R[x] for x in P['tn']), key=lambda r: (r['ano'], r['cargo']))
    olds = sorted((O[k] for k in P['on']), key=lambda o: (o['ano'], o['cargo']))
    mand = []   # mandatos
    elei = []   # candidaturas (histórico eleitoral)
    names = Counter()
    nomes_n = set()
    ufs = set()
    gen = None
    weak = True  # sem nenhum documento/nascimento (vínculo frágil)
    for r in recs:
        if r['cpf'] or r['tit'] or r['nasc']:
            weak = False
        nomes_n.add(r['nome_n'])
        if r['nome'] and not str(r['nome']).startswith('#'):
            names[r['nome']] += 1
        g = (r.get('genero') or '').upper()
        if g.startswith('FEM'):
            gen = 'F'
        elif g.startswith('MASC'):
            gen = gen or 'M'
        loc = str(r['ue']).zfill(5) if r['cargo'] in MUNICIPAIS else ('BR' if r['cargo'] in (1, 2) else r['uf'])
        ufs.add('BR' if r['cargo'] in (1, 2) else r['uf'])
        sup = 0
        if 'SUPLEMENTAR' in (r.get('tipo') or ''):
            try:
                sup = int((r.get('dt') or '').split('/')[1])
            except Exception:
                sup = 6
        urna = r['urna'] if r['urna'] and not str(r['urna']).startswith('#') else None
        e = [r['ano'], r['cargo'], loc, party(r['partido']), r['res'], ival(r['v1']), ival(r['v2']), sup, urna and title(urna)]
        elei.append(e)
        if r['res'] in ('E', 'Q', 'M', 'V'):
            m0, m1, a, b = periodo_tse(r)
            mand.append({'c': r['cargo'], 'l': loc, 'a': a, 'b': b, 'm0': m0, 'm1': m1, 'p': party(r['partido']), 'el': r['ano'],
                         'r': r['res'], 'v': ival(r['v2'] if r['v2'] else r['v1']), 'src': ['t'], 'sup': sup})
    for o in olds:
        nomes_n.add(o['nome_n'])
        names[o['nome']] += 1
        ufs.add(o['uf'])
        e = [o['ano'], o['cargo'], o['uf'], party(o['partido']), o['res'], ival(o['v1']), ival(o['v2']), 0, o['urna'] and title(o['urna'])]
        elei.append(e)
        if o['res'] == 'E':
            r = {'ano': o['ano'], 'cargo': o['cargo'], 'tipo': ''}
            m0, m1, a, b = periodo_tse(r)
            mand.append({'c': o['cargo'], 'l': o['uf'], 'a': a, 'b': b, 'm0': m0, 'm1': m1, 'p': party(o['partido']), 'el': o['ano'],
                         'r': 'E', 'v': ival(o['v2'] or o['v1']), 'src': ['t'], 'sup': 0})
    # ---- Câmara
    cam = {}
    partidos_ev = []
    for c in P['cn']:
        weak = False
        d = dep[c]
        det = d.get('det') or {}
        us = det.get('ultimoStatus') or {}
        cam = {'id': c, 'nome': us.get('nomeEleitoral') or us.get('nome'), 'civil': det.get('nomeCivil'), 'sexo': det.get('sexo')}
        if det.get('sexo') == 'F':
            gen = 'F'
        elif det.get('sexo') == 'M' and not gen:
            gen = 'M'
        if det.get('nomeCivil'):
            nomes_n.add(norm(det['nomeCivil']))
        hist = sorted(d.get('hist') or [], key=lambda h: h.get('dataHora') or '')
        cond = {}
        for h in hist:
            L = h.get('idLegislatura')
            if h.get('condicaoEleitoral'):
                cond.setdefault(L, h['condicaoEleitoral'])
            if h.get('siglaPartido') and 'partido' in (h.get('descricaoStatus') or '').lower():
                partidos_ev.append(((h.get('dataHora') or '')[:10], party(h['siglaPartido']), 'c'))
        for L, e in sorted(leg_uf[c].items()):
            lg = legs[L]
            y0, y1 = int(lg['dataInicio'][:4]), int(lg['dataFim'][:4])
            ufs.add(e['uf'])
            # junta com o mandato do TSE da mesma eleição
            hit = None
            for m in mand:
                if m['c'] == 6 and m['el'] == y0 - 1:
                    hit = m
            how = None
            tse_sup = any(x[0] == y0 - 1 and x[1] == 6 and x[4] == 'S' for x in elei)
            if hit:
                hit['src'].append('c'); hit['cam'] = 1
                if L in cam_ex_leg(L, legs) and c in cam_ex:
                    hit['ex'] = 1
            else:
                how = 'S' if (tse_sup or cond.get(L) == 'Suplente') else ('T' if cond.get(L) == 'Titular' else None)
                mm = {'c': 6, 'l': e['uf'], 'a': y0, 'b': y1, 'm0': mes(lg['dataInicio']), 'm1': mes(lg['dataFim']) + 1,
                      'p': party(e.get('partido')), 'el': y0 - 1, 'r': how or 'C', 'src': ['c'], 'cam': 1}
                if L == max(legs) and c in cam_ex:
                    mm['ex'] = 1
                mand.append(mm)
        # mandatos externos declarados à Câmara (preenche lacunas, ex.: vereador/prefeito antes de 1996)
        for x in d.get('ext') or []:
            cg = ext_cargo(x.get('cargo'))
            try:
                a, b = int(x.get('anoInicio')), int(x.get('anoFim') or x.get('anoInicio'))
            except Exception:
                continue
            if not cg or b < 1988:
                continue
            if any(m['c'] == cg and m['a'] <= b and a <= m['b'] for m in mand):
                continue
            if any(m['c'] in (cg, VICE_DE.get(cg, 0)) and abs(m['a'] - a) <= 1 for m in mand):
                continue
            mm = {'c': cg, 'l': x.get('siglaUf') or '', 'mn': x.get('municipio'), 'a': a, 'b': b, 'm0': a * 12, 'm1': b * 12,
                  'p': party(x.get('siglaPartidoEleicao')), 'el': None, 'r': 'C', 'src': ['x']}
            if a == b:
                # mesmo ano de início e fim: exercício curto (ex.: substituição temporária); aparece, mas não conta como mandato
                mm['m1'] = a * 12 + 1; mm['tmp'] = 1
                mm['nota'] = 'Período curto declarado à Câmara (por exemplo, substituição temporária do titular). Não entra na contagem de mandatos.'
            mand.append(mm)
    # ---- Senado
    senp = {}
    for c in P['sn']:
        s = sen[c]
        idt = s.get('ident') or {}
        senp = {'id': c, 'nome': idt.get('NomeParlamentar'), 'civil': idt.get('NomeCompletoParlamentar')}
        if (idt.get('SexoParlamentar') or '').startswith('F'):
            gen = 'F'
        nomes_n.add(norm(idt.get('NomeCompletoParlamentar')))
        if (s.get('basicos') or {}).get('DataNascimento', '1900-01-01') > '1900-01-01':
            weak = False
        for f in s.get('filiacoes') or []:
            pa = (f.get('Partido') or {}).get('SiglaPartido') if isinstance(f.get('Partido'), dict) else None
            if pa and f.get('DataFiliacao'):
                partidos_ev.append((f['DataFiliacao'][:10], party(pa), 's'))
        for m in s.get('mandatos') or []:
            part = m.get('DescricaoParticipacao') or ''
            l1, l2 = m.get('PrimeiraLegislaturaDoMandato') or {}, m.get('SegundaLegislaturaDoMandato') or {}
            if not l1.get('DataInicio'):
                continue
            ini, fim = l1['DataInicio'], (l2.get('DataFim') or l1.get('DataFim'))
            if fim and fim[:4] < '1988':
                continue
            exs = [e for e in (m.get('Exercicios') or {}).get('Exercicio', []) if isinstance(e, dict)] if isinstance((m.get('Exercicios') or {}).get('Exercicio'), list) else ([m['Exercicios']['Exercicio']] if m.get('Exercicios') and isinstance(m['Exercicios'].get('Exercicio'), dict) else [])
            exl = sorted([[e.get('DataInicio'), e.get('DataFim')] for e in exs if e.get('DataInicio')])
            for pz in (m.get('Partidos') or {}).get('Partido', []) if isinstance((m.get('Partidos') or {}).get('Partido'), list) else []:
                if pz.get('DataFiliacao'):
                    partidos_ev.append((pz['DataFiliacao'][:10], party(pz.get('Sigla')), 's'))
            ufm = m.get('UfParlamentar')
            ufs.add(ufm)
            titular = part.startswith('Titular')
            if not titular and not exl:
                continue
            y_el = int(ini[:4]) - 1
            hit = None
            if titular:
                for mm in mand:
                    if mm['c'] == 5 and mm['el'] == y_el:
                        hit = mm
            if titular and exl and exl[-1][1] and exl[0][0]:
                # saiu antes do fim (renúncia, cassação, morte…): o mandato termina no último exercício registrado
                fim_ex = mes(exl[-1][1]) + 1
            else:
                fim_ex = None
            if hit:
                hit['src'].append('s'); hit['sen'] = 1; hit['exd'] = exl
                if fim_ex and fim_ex < hit['m1'] - 1:
                    hit['m1'] = fim_ex; hit['b'] = int(exl[-1][1][:4])
                if c in sen_ex and (not exl or not exl[-1][1]):
                    hit['ex'] = 1
                continue
            if titular:
                mm = {'c': 5, 'l': ufm, 'a': int(ini[:4]), 'b': int(fim[:4]), 'm0': mes(ini), 'm1': mes(fim) + 1,
                      'p': None, 'el': y_el, 'r': 'T', 'src': ['s'], 'sen': 1, 'exd': exl}
                if c in sen_ex and exl and not exl[-1][1]:
                    mm['ex'] = 1
                if fim_ex and fim_ex < mm['m1'] - 1:
                    mm['m1'] = fim_ex; mm['b'] = int(exl[-1][1][:4])
                mand.append(mm)
            else:
                # suplente que assumiu: um mandato por mandato do titular, com os períodos de exercício
                a = int(exl[0][0][:4])
                last = exl[-1][1]
                b = int(last[:4]) if last else int(fim[:4])
                m0 = mes(exl[0][0])
                m1 = mes(last) + 1 if last else min(mes(fim) + 1, MES_ATUAL + 1)
                titular_nome = (m.get('Titular') or {}).get('NomeParlamentar')
                mm = {'c': 5, 'l': ufm, 'a': a, 'b': b, 'm0': m0, 'm1': m1, 'p': None, 'el': y_el, 'r': 'S', 'src': ['s'], 'sen': 1,
                      'exd': exl, 'tit': titular_nome, 'sp': 1 if part.startswith('1') else 2}
                if c in sen_ex and not last:
                    mm['ex'] = 1
                mand.append(mm)
    # ---- ajustes manuais (presidência)
    if P['aj']:
        for adj in P['aj']['mandatos']:
            cg = adj['cargo']
            hit = None
            for mm in mand:
                if mm['c'] == cg and mm.get('el') == adj.get('eleicao'):
                    hit = mm
            ini, fim = adj['inicio'], adj.get('fim')
            if hit is None:
                hit = {'c': cg, 'l': 'BR', 'p': adj.get('partido'), 'el': adj.get('eleicao'), 'r': adj.get('r', 'A'), 'src': []}
                mand.append(hit)
            hit['a'], hit['b'] = int(ini[:4]), int(fim[:4]) if fim else hit.get('b', ANO_ATUAL)
            hit['m0'], hit['m1'] = mes(ini), (mes(fim) if fim else hit.get('m1', MES_ATUAL + 1))
            hit['src'].append('a')
            # candidatura correspondente sem resultado no TSE (ex.: vice de 1994/1998): marca como eleita na chapa
            for e in elei:
                if e[0] == adj.get('eleicao') and e[1] == cg and e[4] in ('U', 'T'):
                    e[4] = adj.get('r') if adj.get('r') in ('E', 'V') else 'E'
            hit['nota'] = adj['nota']
            hit['fonte'] = adj['fonte']
            if adj.get('r'):
                hit['r'] = adj['r']
    # Eleito deputado federal (1994–2022) mas sem registro de exercício na Câmara
    for m in mand:
        if m['c'] == 6 and m['src'] == ['t'] and m.get('el') and 1994 <= m['el'] <= ANO_ATUAL - 4 and P['cn']:
            m['nota'] = 'Eleito, mas a lista da Câmara para esta legislatura não traz esta pessoa (por exemplo, se não tomou posse).'
    # ---- consolidação
    for m in mand:
        if m['m0'] > MES_ATUAL:
            m['fut'] = 1
        elif m['m1'] > MES_ATUAL and m['c'] not in (5, 6):
            m['cur'] = 1  # em curso pelo calendário (cargos sem lista oficial de exercício)
        elif m['c'] in (5, 6) and m.get('ex'):
            m['cur'] = 1
        if m['c'] in (5, 6) and m['m1'] > MES_ATUAL and m['m0'] <= MES_ATUAL and not m.get('ex') and ('c' in m['src'] or 's' in m['src']):
            m['cur'] = 0
        elif m['c'] in (5, 6) and m['m1'] > MES_ATUAL and m['m0'] <= MES_ATUAL and not ('c' in m['src'] or 's' in m['src']):
            m['cur'] = 1
    mand.sort(key=lambda m: (m['m0'], m['c']))
    # anos com mandato: união dos meses (mandatos já iniciados, até hoje)
    iv = sorted((m['m0'], min(m['m1'], MES_ATUAL + 1)) for m in mand if not m.get('fut') and m['c'] not in (9, 10))
    tot, cur_end = 0, -1
    for a, b in iv:
        if b <= cur_end:
            continue
        tot += b - max(a, cur_end)
        cur_end = b
    # partidos ao longo do tempo
    pev = []
    for e in elei:
        if e[3]:
            pev.append((f'{e[0]}-10-01', e[3], 't'))
    for m in mand:
        if m.get('p') and 'x' in m['src']:
            pev.append((f"{m['a']}-01-01", m['p'], 'x'))
    pev += [p for p in partidos_ev if p[1]]
    pev.sort()
    segs = []
    for dt, p, src in pev:
        y = int(dt[:4])
        if segs and segs[-1][0] == p:
            segs[-1][2] = max(segs[-1][2], y)
        else:
            segs.append([p, y, y])
    # nome de exibição
    nome_full = names.most_common(1)[0][0] if names else (cam.get('civil') or senp.get('civil'))
    disp = cam.get('nome') or senp.get('nome')
    if not disp:
        urnas = [e[8] for e in elei if e[8]]
        disp = urnas[-1] if urnas else title(nome_full)
    if disp and disp.isupper():
        disp = title(disp)
    cargos_cnt = Counter(m['c'] for m in mand if not m.get('fut') and not m.get('tmp') and m['c'] not in (9, 10))
    # mandatos publicados: só os que não dá para deduzir das candidaturas eleitas (TSE puro é deduzido no navegador)
    mout = []
    for m in mand:
        pure = m['src'] == ['t'] and not m.get('ex') and not m.get('nota')
        if pure:
            continue
        fl = (1 if m.get('cur') else 0) | (2 if m.get('fut') else 0) | (8 if m.get('ex') else 0) | (16 if m.get('tmp') else 0)
        extra = {k: m[k] for k in ('nota', 'fonte', 'exd', 'tit', 'mn') if m.get(k)}
        row = [m['c'], m['l'] or '', m['m0'], m['m1'], m.get('p') or '', m.get('el') or 0, m['r'], m.get('v') or 0, ''.join(dict.fromkeys(m['src'])), fl]
        if extra:
            row.append(extra)
        mout.append(row)
    # urna: só quando muda em relação à candidatura anterior
    eo, last = [], None
    for e in sorted(elei, key=lambda e: (e[0], e[1])):
        e = list(e)
        if e[8] == last:
            e[8] = None
        else:
            last = e[8]
        while e and e[-1] in (None, 0) and len(e) > 5:
            e.pop()
        eo.append(e)
    pe = []
    for dt, p, src in sorted(x for x in partidos_ev if x[1]):
        if not pe or pe[-1][1] != p:
            pe.append([dt, p])
    rec = {
        'n': disp, 'nm': sum(cargos_cnt.values()), 'ym': round(tot / 12, 1), 'e': eo,
    }
    nc = title(nome_full) if nome_full and nome_full.isupper() else nome_full
    if nc and norm(nc) != norm(disp):
        rec['nc'] = nc
    if gen:
        rec['g'] = gen
    if mout:
        rec['m'] = mout
    if pe:
        rec['pe'] = pe
    rec['_segs'] = segs
    rec['_cc'] = {str(k): v for k, v in sorted(cargos_cnt.items())}
    rec['_mand'] = mand
    rec['i'] = i
    if cam:
        rec['cam'] = cam['id']
    if senp:
        rec['sen'] = int(senp['id'])
    rec['_names'] = {n for n in nomes_n if n}
    rec['_weak'] = weak
    rec['_ufs'] = {u for u in ufs if u}
    return rec


def ival(v):
    return None if v is None else int(v)


def cam_ex_leg(L, legs):
    return {max(legs)}


def ext_cargo(s):
    s = norm(s)
    if not s:
        return None
    if 'VICE' in s and 'PREFEIT' in s:
        return 12
    if 'PREFEIT' in s:
        return 11
    if 'VEREADOR' in s:
        return 13
    if 'VICE' in s and 'GOVERNADOR' in s:
        return 4
    if 'GOVERNADOR' in s:
        return 3
    if 'PRESIDENTE' in s:
        # Presidência vem do TSE + ajustes documentados; "Presidente" declarado à Câmara costuma ser de Casa/partido
        return None
    if 'SENADOR' in s:
        return 5
    if 'DISTRITAL' in s:
        return 8
    if 'ESTADUAL' in s or 'CONSTITUINTE ESTADUAL' in s:
        return 7
    if 'FEDERAL' in s:
        return 6
    return None


# ---------------------------------------------------------------------------------------------
# Saída
# ---------------------------------------------------------------------------------------------
MAPA_IDS = defaultdict(dict)


def write_output(P, mun, cong, aj, anchors_all):
    tmp = OUT + '.tmp'
    if os.path.exists(tmp):
        shutil.rmtree(tmp)
    os.makedirs(f'{tmp}/p'); os.makedirs(f'{tmp}/idx'); os.makedirs(f'{tmp}/lookup'); os.makedirs(f'{tmp}/cargos')
    # aliases: ids publicados antes que deixaram de existir -> id atual
    prev_ids = set()
    if os.path.exists(f'{OUT}/ids.txt'):
        prev_ids = set(open(f'{OUT}/ids.txt').read().split())
    alias = {}
    if os.path.exists(f'{OUT}/aliases.json'):
        alias = json.load(open(f'{OUT}/aliases.json')).get('aliases', {})
    for old in prev_ids - set(P):
        if old in anchors_all:
            alias[old] = anchors_all[old]
    alias = {k: v for k, v in alias.items() if k not in P and v in P}

    shards = defaultdict(dict)
    idx = defaultdict(list)
    cnt = Counter()
    cnt_years = defaultdict(lambda: [9999, 0])
    pref_by_mun = defaultdict(list)
    gov = []
    lookup = defaultdict(dict)
    rankrows = []
    for i, p in P.items():
        names, weak, ufs = p.pop('_names'), p.pop('_weak'), p.pop('_ufs')
        mand, segs, cc = p.pop('_mand'), p.pop('_segs'), p.pop('_cc')
        p.pop('i', None)
        shards[i[:2]][i] = p
        rankrows.append((i, p['n'], p['nm'], p['ym'], cc))
        mask = 0
        for m in mand:
            if not m.get('fut') and m['c'] not in (9, 10):
                mask |= 1 << m['c']
        fut = any(m.get('fut') for m in mand)
        cur = any((m.get('cur') or m.get('ex')) and not m.get('fut') for m in mand)
        muns = []
        for m in mand:
            if m['c'] in MUNICIPAIS and re.fullmatch(r'\d{5}', str(m['l'])) and m['l'] not in muns:
                muns.append(m['l'])
        anos = [m['a'] for m in mand] + [m['b'] for m in mand]
        parts = sorted({sg[0] for sg in segs if sg[0]})
        alt0 = {e[8] for e in p['e'] if len(e) > 8 and e[8] and norm(e[8]) != norm(p['n'])} | ({p['nc']} if p.get('nc') else set())
        an = {a: norm(a) for a in alt0}
        alt = sorted(a for a in alt0 if not any(o != a and an[o].startswith(an[a]) and len(an[o]) > len(an[a]) for o in alt0)
                     and not norm(p['n']).startswith(an[a]))
        flags = (1 if cur else 0) | (2 if p.get('pm') else 0) | (4 if fut else 0)
        last_party = segs[-1][0] if segs else ''
        entry = [i, p['n'], mask, '|'.join(alt), '|'.join(muns), min(anos) if anos else 0, max(anos) if anos else 0, p['nm'], last_party,
                 ','.join(parts), flags, round(p['ym'])]
        if mask & ~((1 << 11) | (1 << 12) | (1 << 13)) or (not mask and fut):
            idx['BR'].append(entry)
        for u in sorted({(mun.get(m['l'], {}).get('uf') if m['c'] in MUNICIPAIS else m['l']) for m in mand} - {None, '', 'BR'}):
            idx[u].append(entry)
        for m in mand:
            if m.get('fut') or m.get('tmp') or m['c'] in (9, 10):
                continue
            cnt[m['c']] += 1
            y = cnt_years[m['c']]
            y[0], y[1] = min(y[0], m['a']), max(y[1], m['a'])
            if m['c'] == 11:
                pref_by_mun[m['l']].append([m['a'], m['b'], i, p['n'], m.get('p'), 1 if m.get('sup') else 0])
            if m['c'] in (3, 4):
                gov.append([m['l'], m['c'], m['a'], m['b'], i, p['n'], m.get('p')])
        for e in p['e']:
            if e[4] in ('E', 'Q', 'M', 'V') and e[1] != 13:
                loc = e[2]
                if e[1] in MUNICIPAIS:
                    loc = str(mun.get(loc, {}).get('ibge') or 't' + loc)
                u = mun.get(e[2], {}).get('uf') if e[1] in MUNICIPAIS else e[2]
                key = f'{e[0]}|{e[1]}|{loc}'
                lookup[u or 'BR'][key] = sorted(set(lookup[u or 'BR'].get(key, []) + [i]))
    sizes = {}
    def dump(path, obj):
        s = json.dumps(obj, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
        with open(path, 'w') as f:
            f.write(s)
        sizes[path] = len(s.encode())
    for k, v in shards.items():
        dump(f'{tmp}/p/{k}.json', v)
    idx_cols = ['id', 'nome', 'cargos(bitmask 1<<cód)', 'outros nomes', 'municípios com mandato (cód. TSE, separados por |)', 'ano inicial', 'ano final',
                'nº de mandatos', 'partido mais recente', 'partidos', 'flags(1=em curso,2=possível duplicata,4=eleito p/ mandato futuro)', 'anos com mandato']
    manifest = {}
    for k, v in sorted(idx.items()):
        v.sort(key=lambda e: (norm(e[1]), e[0]))
        est = len(json.dumps(v, ensure_ascii=False, separators=(',', ':')).encode())
        parts = max(1, -(-est // 3_000_000))  # partes de até ~3 MB
        if parts == 1:
            dump(f'{tmp}/idx/{k}.json', {'cols': idx_cols, 'rows': v}); manifest[k] = [k]
        else:
            n = -(-len(v) // parts)
            manifest[k] = []
            for j in range(parts):
                nm = f'{k}-{j + 1}'
                dump(f'{tmp}/idx/{nm}.json', {'cols': idx_cols, 'rows': v[j * n:(j + 1) * n]}); manifest[k].append(nm)
    dump(f'{tmp}/idx/manifest.json', manifest)
    dump(f'{tmp}/municipios.json', {k: [m['n'], m['uf'], m['ibge']] for k, m in sorted(mun.items())})
    for u, d in lookup.items():
        dump(f'{tmp}/lookup/{u}.json', d)
    if MAPA_IDS:
        os.makedirs(f'{tmp}/mapa_ids', exist_ok=True)
        for u, d in MAPA_IDS.items():
            dump(f'{tmp}/mapa_ids/{u}.json', d)
    pref = defaultdict(dict)
    for l, lst in pref_by_mun.items():
        m = mun.get(l, {})
        pref[m.get('uf', 'ZZ')][str(m.get('ibge') or 't' + l)] = sorted(lst)
    for u, d in pref.items():
        os.makedirs(f'{tmp}/cargos/prefeitos', exist_ok=True)
        dump(f'{tmp}/cargos/prefeitos/{u}.json', d)
    dump(f'{tmp}/cargos/governadores.json', sorted(gov))
    # ranking nacional
    allp = sorted(rankrows, key=lambda r: (-r[2], -r[3], norm(r[1]), r[0]))
    rank = {'geral': [[r[0], r[1], r[2], r[3], r[4]] for r in allp[:300]]}
    for cg in range(1, 14):
        top = sorted((r for r in rankrows if r[4].get(str(cg))), key=lambda r: (-r[4][str(cg)], -r[2], -r[3], norm(r[1]), r[0]))[:100]
        if top:
            rank[str(cg)] = [[r[0], r[1], r[4][str(cg)], r[2], r[3]] for r in top]
    dump(f'{tmp}/ranking.json', rank)
    with open(f'{tmp}/ids.txt', 'w') as f:
        f.write('\n'.join(sorted(P)) + '\n')
    dump(f'{tmp}/aliases.json', {'nota': 'ids antigos que passaram a apontar para outra pessoa após nova ligação de registros', 'aliases': alias})
    meta = {
        'gerado_em': HOJE,
        'pessoas': len(P),
        'mandatos_por_cargo': {CARGOS[k]: {'mandatos': cnt[k], 'primeiro_ano': cnt_years[k][0], 'ultimo_ano': cnt_years[k][1]} for k in sorted(cnt)},
        'cargos': CARGOS,
        'congresso_baixado_em': cong.get('gerado_em'),
        'presidencia_ajustes': [{'nome': p['nome'], 'fontes': sorted({m['fonte'] for m in p['mandatos']})} for p in aj['pessoas']],
    }
    meta.update(json.load(open(os.path.join(HERE, 'meta_fontes.json'))))
    meta['tamanho_indices_mb'] = round(sum(v for k, v in sizes.items() if '/idx/' in k) / 1e6, 1)
    dump(f'{tmp}/meta.json', meta)
    pj = json.load(open(os.path.join(HERE, 'partidos.json')))
    pj['nomes'] = dict(sorted(PARTY_NAMES.items()))
    dump(f'{tmp}/partidos.json', pj)
    # README dos dados: o modelo fica em scripts/ (README_dados.md) para sobreviver à troca da pasta
    if os.path.exists(os.path.join(HERE, 'README_dados.md')):
        shutil.copy(os.path.join(HERE, 'README_dados.md'), f'{tmp}/README.md')
    elif os.path.exists(f'{OUT}/README.md'):
        shutil.copy(f'{OUT}/README.md', f'{tmp}/README.md')
    # Se só o meta.json mudou (data de geração), mantém o meta antigo: o workflow não faz commit à toa.
    def digest(d):
        h = hashlib.sha1()
        for root, _, files in sorted(os.walk(d)):
            for fn in sorted(files):
                if fn in ('meta.json', 'README.md'):
                    continue
                fp = os.path.join(root, fn)
                h.update(os.path.relpath(fp, d).encode()); h.update(open(fp, 'rb').read())
        return h.hexdigest()
    if os.path.exists(f'{OUT}/meta.json') and digest(OUT) == digest(tmp):
        shutil.copy(f'{OUT}/meta.json', f'{tmp}/meta.json')
        log('dados iguais aos publicados: meta.json mantido')
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    os.rename(tmp, OUT)
    tot = sum(sizes.values())
    big = sorted(sizes.items(), key=lambda kv: -kv[1])[:5]
    log('saída', len(P), 'pessoas;', round(tot / 1e6, 1), 'MB;', 'maiores:', [(os.path.relpath(k, OUT), round(v / 1e6, 2)) for k, v in big])
    log('mandatos por cargo', {CARGOS[k]: cnt[k] for k in sorted(cnt)})


if __name__ == '__main__':
    main()
