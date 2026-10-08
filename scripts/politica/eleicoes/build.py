#!/usr/bin/env python3
"""Monta os dados da página /politica/eleicoes/ a partir dos arquivos abertos do TSE.

Uso:
  python3 scripts/politica/eleicoes/build.py                 # tudo o que houver em $RAW/unz
  python3 scripts/politica/eleicoes/build.py --anos 2026     # só 2026 (o resto fica como está)
  python3 scripts/politica/eleicoes/build.py --baixar --anos 2026   # baixa do TSE antes (usado no workflow)

Fontes (https://dadosabertos.tse.jus.br/):
  votacao_candidato_munzona_<ano>  votos por candidato, município e zona (presidente e assentos por partido)
  votacao_candidato_uf_1989        presidente 1989, por estado
  votacao_partido_munzona_<ano>    votos nominais e de legenda por partido
  detalhe_votacao_munzona_<ano>    eleitores aptos, comparecimento, abstenção, brancos e nulos
  votacao_secao_<ano>_BR           votos para presidente por seção (seções especiais em presídios)
  eleitorado_local_votacao_<ano>   tipo de cada local de votação ("Preso provisório")
  perfil_eleitorado_<ano>          perfil do eleitorado (sexo, idade, escolaridade)
  municipio_tse_ibge               código TSE -> código IBGE

Saída: politica/data/eleicoes/ (JSON compactos). Nada é estimado: só somas dos arquivos oficiais.
"""
import argparse, datetime as dt, glob, json, os, re, subprocess, sys, unicodedata, zipfile
import duckdb

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUT = os.path.join(ROOT, "politica", "data", "eleicoes")
RAW = os.environ.get("RAW", "/workspace/pol-eleicoes-raw")
UNZ = os.path.join(RAW, "unz")
ZIP = os.path.join(RAW, "zip")
CDN = "https://cdn.tse.jus.br/estatistica/sead/odsele"

REG = {"N": "AC AM AP PA RO RR TO", "NE": "AL BA CE MA PB PE PI RN SE", "CO": "DF GO MS MT",
       "SE": "ES MG RJ SP", "S": "PR RS SC", "ZZ": "ZZ"}
UF2REG = {u: r for r, us in REG.items() for u in us.split()}
UFS = sorted(u for u in UF2REG if u != "ZZ")
GERAIS = [1994, 1998, 2002, 2006, 2010, 2014, 2018, 2022, 2026]
MUNIC = [1996, 2000, 2004, 2008, 2012, 2016, 2020, 2024]
PRES_DATAS = {(1989, 1): "15/11/1989", (1989, 2): "17/12/1989", (1994, 1): "03/10/1994", (1998, 1): "04/10/1998",
              (2002, 1): "06/10/2002", (2002, 2): "27/10/2002", (2006, 1): "01/10/2006", (2006, 2): "29/10/2006",
              (2010, 1): "03/10/2010", (2010, 2): "31/10/2010", (2014, 1): "05/10/2014", (2014, 2): "26/10/2014",
              (2018, 1): "07/10/2018", (2018, 2): "28/10/2018", (2022, 1): "02/10/2022", (2022, 2): "30/10/2022",
              (2026, 1): "04/10/2026", (2026, 2): "25/10/2026"}
CARGOS = {"1": "Presidente", "3": "Governador", "5": "Senador", "6": "Deputado federal", "7": "Deputado estadual",
          "8": "Deputado distrital", "11": "Prefeito", "13": "Vereador"}
LOW = {"da", "de", "do", "das", "dos", "e", "di", "du"}
FIX = {"D AVILA": "D'Avila", "LULA": "Lula"}

con = duckdb.connect()
con.execute("SET preserve_insertion_order=false")


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def titulo(s):
    s = (s or "").strip()
    for k, v in FIX.items():
        s = re.sub(r"\b" + k + r"\b", v.upper(), s)
    out = []
    for i, w in enumerate(s.split()):
        lw = w.lower()
        if i and lw in LOW:
            out.append(lw)
        elif "'" in w and len(w) > 2:
            a, b = w.split("'", 1)
            out.append(a.capitalize() + "'" + b.capitalize())
        elif re.fullmatch(r"[IVX]+", w) and len(w) <= 4 and i:
            out.append(w)
        else:
            out.append(lw[:1].upper() + lw[1:])
    return " ".join(out)


def norm(s):
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().upper()


CONV = {}


def src(path):
    if path in CONV:
        return f"read_csv('{CONV[path]}', delim=';', quote='\"', all_varchar=true, header=true, ignore_errors=true, parallel=true)"
    return f"read_csv('{path}', delim=';', quote='\"', encoding='latin-1', all_varchar=true, header=true, ignore_errors=true, parallel=true)"


def q(sqlfn, *paths):
    """Roda sqlfn(*[src(p)]) e, se o duckdb recusar a codificação, converte o arquivo (cp1252 -> utf-8) e tenta de novo."""
    try:
        return con.execute(sqlfn(*[src(p) for p in paths])).fetchall()
    except duckdb.InvalidInputException as e:
        if "encoded" not in str(e):
            raise
        for p in paths:
            if p in CONV:
                continue
            out = os.path.join(RAW, "_conv", os.path.basename(p))
            os.makedirs(os.path.dirname(out), exist_ok=True)
            log("  convertendo", os.path.basename(p))
            with open(p, "rb") as fi, open(out, "wb") as fo:
                for line in fi:
                    fo.write(line.decode("cp1252", errors="replace").encode("utf-8"))
            CONV[p] = out
        return con.execute(sqlfn(*[src(p) for p in paths])).fetchall()


def pick(dirname, prefer=("_BR.csv", "_BRASIL.csv")):
    d = os.path.join(UNZ, dirname)
    for suf in prefer:
        fs = sorted(glob.glob(os.path.join(d, "*" + suf)))
        if fs:
            return fs[0]
    fs = sorted(glob.glob(os.path.join(d, "*.csv")))
    return fs[0] if len(fs) == 1 else None


def cols(path):
    return [r[0] for r in con.execute(f"describe select * from {src(path)}").fetchall()]


def wjson(rel, obj):
    p = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    with open(p, "w", encoding="utf-8") as f:
        f.write(s)
    log(f"  -> {rel} ({len(s)/1024:.0f} KB)")


def rjson(rel, default=None):
    p = os.path.join(OUT, rel)
    if not os.path.exists(p):
        return default
    with open(p, encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------- download (workflow)
def baixar(ano):
    os.makedirs(ZIP, exist_ok=True)
    geral = ano in GERAIS
    alvos = [("votacao_candidato_munzona", f"votacao_candidato_munzona_{ano}.zip", None),
             ("votacao_partido_munzona", f"votacao_partido_munzona_{ano}.zip", "BRASIL"),
             ("detalhe_votacao_munzona", f"detalhe_votacao_munzona_{ano}.zip", "BRASIL")]
    if geral:
        alvos += [("votacao_secao", f"votacao_secao_{ano}_BR.zip", None),
                  ("eleitorado_locais_votacao", f"eleitorado_local_votacao_{ano}.zip", None)]
    for pasta, nome, so in alvos:
        z = os.path.join(ZIP, nome)
        url = f"{CDN}/{pasta}/{nome}"
        log("baixando", url)
        r = subprocess.run(["curl", "-sfL", "--retry", "5", "--retry-delay", "10", "-o", z, url])
        if r.returncode != 0:
            log("  falhou", url)
            continue
        dest = os.path.join(UNZ, nome[:-4])
        os.makedirs(dest, exist_ok=True)
        with zipfile.ZipFile(z) as zf:
            for m in zf.namelist():
                if not m.lower().endswith((".csv", ".txt")):
                    continue
                if so and so not in m:
                    continue
                if pasta == "eleitorado_locais_votacao" and "_BRASIL" not in m and len([x for x in zf.namelist() if x.endswith('.csv')]) > 1:
                    continue
                zf.extract(m, dest)
        if pasta != "votacao_candidato_munzona":
            os.remove(z)
    tse = os.path.join(UNZ, "municipio_tse_ibge")
    if not glob.glob(os.path.join(tse, "*.csv")):
        z = os.path.join(ZIP, "municipio_tse_ibge.zip")
        subprocess.run(["curl", "-sfL", "--retry", "5", "-o", z, f"{CDN}/municipio_tse_ibge/municipio_tse_ibge.zip"], check=True)
        zipfile.ZipFile(z).extractall(tse)


# ---------------------------------------------------------------- helpers
_tse2ibge = None


def tse2ibge():
    global _tse2ibge
    if _tse2ibge is None:
        f = glob.glob(os.path.join(UNZ, "municipio_tse_ibge", "*.csv"))[0]
        _tse2ibge = {int(a): int(b) for a, b in con.execute(
            f"select CD_MUNICIPIO_TSE, CD_MUNICIPIO_IBGE from {src(f)}").fetchall() if a and b and b.strip('-').isdigit()}
    return _tse2ibge


def munzona_cand_file(ano, presidente=True):
    d = f"votacao_candidato_munzona_{ano}"
    return pick(d, ("_BR.csv", "_BRASIL.csv") if presidente else ("_BRASIL.csv",))


def detalhe_file(ano):
    return pick(f"detalhe_votacao_munzona_{ano}", ("_BRASIL.csv",))


def partido_file(ano):
    return pick(f"votacao_partido_munzona_{ano}", ("_BRASIL.csv",))


def add(d, k, arr):
    if k not in d:
        d[k] = [0] * len(arr)
    t = d[k]
    for i, v in enumerate(arr):
        t[i] += v


# ---------------------------------------------------------------- presidente

# Arquivos antigos (1989, 1994) trazem o nome completo ou sem acento no lugar do nome de urna
APELIDO = {"FERNANDO HENRIQUE CARDOSO": "Fernando Henrique", "LUIZ INACIO LULA DA SILVA": "Lula", "ENEAS FERREIRA CARNEIRO": "Enéas",
           "ORESTES QUERCIA": "Orestes Quércia", "LEONEL DE MOURA BRIZOLA": "Brizola", "ESPERIDIAO AMIN HELOU FILHO": "Esperidião Amin",
           "CARLOS ANTONIO GOMES": "Carlos Gomes", "HERNANI GOULART FORTUNA": "Hernani Fortuna", "ENEAS": "Enéas",
           "MARIO COVAS": "Mário Covas", "ULYSSES GUIMARAES": "Ulysses Guimarães", "P.G.": "P.G.", "LIVIA MARIA": "Lívia Maria",
           "CORREA": "Corrêa"}


def apelido(nome):
    k = unicodedata.normalize("NFKD", nome or "").encode("ascii", "ignore").decode().upper().strip()
    return APELIDO.get(k, nome)


def ext_pack(ext, k):
    """Votos do exterior somados por país (cidade -> país pela tabela de exterior.py) + as cidades com mais votos."""
    from exterior import pais
    paises, cids, sem = {}, [], set()
    for e in ext.values():
        cid, pa = pais(e["nm"])
        if not pa:
            sem.add(e["nm"])
            pa = "País não identificado"
        a = paises.setdefault(pa, [0] * k)
        for i, v in enumerate(e["v"]):
            a[i] += v
        if cid:
            cids.append([cid.title(), pa, *e["v"]])
    if sem:
        log("  exterior sem país:", sorted(sem))
    return {"paises": sorted([[pa, *v] for pa, v in paises.items()], key=lambda x: -sum(x[1:])),
            "cidades": sorted(cids, key=lambda x: -sum(x[2:]))[:40]}


def presidente(ano):
    feitos = []
    if ano == 1989:
        return presidente_1989()
    f = munzona_cand_file(ano)
    if not f:
        log("sem arquivo de candidatos", ano)
        return feitos
    det = detalhe_file(ano)
    t2i = tse2ibge()
    # 1998 só preenche QT_VOTOS_NOMINAIS_VALIDOS; quando a coluna existe, ela é a base oficial (já sem votos anulados)
    vcol = "QT_VOTOS_NOMINAIS_VALIDOS" if "QT_VOTOS_NOMINAIS_VALIDOS" in cols(f) else "QT_VOTOS_NOMINAIS"
    rows = q(lambda S: f"""
        select NR_TURNO::int t, SG_UF uf, CD_MUNICIPIO::int mun, NM_MUNICIPIO nm, NR_CANDIDATO nr,
               any_value(NM_URNA_CANDIDATO) urna, any_value(NM_CANDIDATO) nome, any_value(SG_PARTIDO) sg,
               max(DS_SIT_TOT_TURNO) sit, sum({vcol}::bigint) v
        from {S} where CD_TIPO_ELEICAO='2' and CD_CARGO='1' group by all""", f)
    dets = {}
    if det:
        dc = cols(det)
        # 1994 deixa QT_TOTAL_VOTOS_NULOS zerado e grava em QT_VOTOS_NULOS
        nul = "greatest(sum(QT_TOTAL_VOTOS_NULOS::bigint), sum(QT_VOTOS_NULOS::bigint))" if "QT_VOTOS_NULOS" in dc else "sum(QT_TOTAL_VOTOS_NULOS::bigint)"
        for r in q(lambda S: f"""
            select NR_TURNO::int t, SG_UF uf, CD_MUNICIPIO::int mun, sum(QT_APTOS::bigint), sum(QT_COMPARECIMENTO::bigint),
                   sum(QT_VOTOS_BRANCOS::bigint), {nul}
            from {S} where CD_TIPO_ELEICAO='2' and CD_CARGO='1' group by all""", det):
            dets[(r[0], r[1], r[2])] = list(r[3:])
    for t in sorted({r[0] for r in rows}):
        rs = [r for r in rows if r[0] == t]
        tot = {}
        info = {}
        for r in rs:
            tot[r[4]] = tot.get(r[4], 0) + r[9]
            i = info.setdefault(r[4], {"urna": r[5], "nome": r[6], "sg": r[7], "sit": set()})
            if r[8]:
                i["sit"].add(r[8])
        order = sorted(tot, key=lambda n: -tot[n])
        idx = {n: i for i, n in enumerate(order)}
        cands = []
        for n in order:
            i = info[n]
            el = any(s.startswith("ELEITO") for s in i["sit"])
            seg = any("2º TURNO" in s or "2O TURNO" in norm(s) for s in i["sit"])
            c = {"nr": int(n), "nome": apelido(titulo(i["urna"])), "completo": titulo(i["nome"]), "partido": i["sg"], "votos": tot[n]}
            if el:
                c["eleito"] = True
            if seg:
                c["2t"] = True
            cands.append(c)
        k = len(order)
        # alguns anos não marcam "ELEITO" no arquivo (2006, 2010 no 2º turno; 1994 e 1998 no 1º): mais da metade dos válidos = eleito
        tot_val = sum(c["votos"] for c in cands)
        if not any(c.get("eleito") for c in cands) and tot_val and cands[0]["votos"] * 2 > tot_val:
            cands[0]["eleito"] = True
            cands[0].pop("2t", None)
        mk = 2 if k <= 2 else 4
        geo_uf, geo_reg, br, mun = {}, {}, {}, {}
        ext = {}
        for r in rs:
            arr = [0] * k
            arr[idx[r[4]]] = r[9]
            add(geo_uf, r[1], arr + [r[9]])
            add(geo_reg, UF2REG.get(r[1], "ZZ"), arr + [r[9]])
            add(br, "BR", arr + [r[9]])
            if r[1] == "ZZ":
                e = ext.setdefault(r[2], {"nm": r[3], "v": [0] * k})
                e["v"][idx[r[4]]] += r[9]
            else:
                ib = t2i.get(r[2])
                if ib:
                    a = [0] * (mk + 1)
                    if idx[r[4]] < mk:
                        a[idx[r[4]]] = r[9]
                    a[mk] = r[9]
                    add(mun, ib, a)
        # comparecimento, brancos e nulos
        d_uf, d_mun = {}, {}
        for (tt, uf, m), v in dets.items():
            if tt != t:
                continue
            add(d_uf, uf, v)
            if uf != "ZZ":
                ib = t2i.get(m)
                if ib:
                    add(d_mun, ib, v)

        def pack(votes, dd):
            o = {"v": votes[:k], "val": votes[k]}
            if dd:
                o.update({"apt": dd[0], "comp": dd[1], "br": dd[2], "nu": dd[3]})
            return o
        d_reg, d_br = {}, {}
        for uf, v in d_uf.items():
            add(d_reg, UF2REG.get(uf, "ZZ"), v)
            add(d_br, "BR", v)
        out = {
            "ano": ano, "turno": t, "data": PRES_DATAS.get((ano, t)), "cands": cands,
            "br": pack(br["BR"], d_br.get("BR")),
            "reg": {r: pack(v, d_reg.get(r)) for r, v in geo_reg.items()},
            "uf": {u: pack(v, d_uf.get(u)) for u, v in sorted(geo_uf.items())},
            "ext": ext_pack(ext, k),
            "fonte": f"TSE, votacao_candidato_munzona_{ano} e detalhe_votacao_munzona_{ano}",
        }
        wjson(f"pres/{ano}-{t}.json", out)
        munout = {"ano": ano, "turno": t, "k": mk, "cols": [c["nome"] for c in cands[:mk]] + ["validos", "aptos", "comparecimento", "brancos", "nulos"],
                  "m": {str(ib): v[:mk + 1] + (d_mun.get(ib) or []) for ib, v in sorted(mun.items())}}
        wjson(f"pres/{ano}-{t}-mun.json", munout)
        feitos.append((ano, t))
    return feitos


def presidente_1989():
    d = os.path.join(UNZ, "votacao_candidato_uf_1989")
    fs = glob.glob(os.path.join(d, "**", "*.txt"), recursive=True)
    if not fs:
        return []
    rows = []
    for f in fs:
        with open(f, encoding="latin-1") as fh:
            for line in fh:
                p = [x.strip('"\n\r') for x in line.split('";"')]
                if len(p) < 26:
                    continue
                rows.append((int(p[3]), p[5], p[8], p[11], p[10], p[20], p[18], int(p[25] or 0)))
    feitos = []
    for t in (1, 2):
        rs = [r for r in rows if r[0] == t]
        tot, info = {}, {}
        for r in rs:
            tot[r[2]] = tot.get(r[2], 0) + r[7]
            info[r[2]] = r
        order = sorted(tot, key=lambda n: -tot[n])
        idx = {n: i for i, n in enumerate(order)}
        k = len(order)
        cands = []
        for i, n in enumerate(order):
            r = info[n]
            c = {"nr": int(n), "nome": apelido(titulo(r[3])), "completo": titulo(r[4]), "partido": r[5], "votos": tot[n]}
            if t == 2 and i == 0:
                c["eleito"] = True
            if t == 1 and i < 2:
                c["2t"] = True
            cands.append(c)
        uf, reg, br = {}, {}, {}
        for r in rs:
            a = [0] * k
            a[idx[r[2]]] = r[7]
            add(uf, r[1], a + [r[7]])
            add(reg, UF2REG.get(r[1], "ZZ"), a + [r[7]])
            add(br, "BR", a + [r[7]])
        pk = lambda v: {"v": v[:k], "val": v[k]}
        wjson(f"pres/1989-{t}.json", {"ano": 1989, "turno": t, "data": PRES_DATAS[(1989, t)], "cands": cands,
                                      "br": pk(br["BR"]), "reg": {r: pk(v) for r, v in reg.items()},
                                      "uf": {u: pk(v) for u, v in sorted(uf.items())}, "ext": {"paises": [], "cidades": []},
                                      "fonte": "TSE, votacao_candidato_uf_1989 (só por estado; o TSE não publica 1989 por cidade nem brancos/nulos nesse arquivo)"})
        feitos.append((1989, t))
    return feitos


SIGLA_GRAFIA = {"PC DO B": "PC do B", "PCDOB": "PC do B", "PT DO B": "PT do B", "PTDOB": "PT do B", "PATRI": "PATRIOTA", "SD": "SOLIDARIEDADE"}


def junta_siglas(data, nomes, pend):
    """O TSE às vezes regrava parte de um ano antigo com a sigla nova (ex.: 2016 traz PR e PL, ambos nº 22).
    1) unifica grafias da mesma sigla; 2) no mesmo ano, siglas com o mesmo número viram uma só: a que tem mais votos."""
    ren = {sg: SIGLA_GRAFIA.get(sg, sg) for sg in nomes}
    peso = {}
    for c in data.values():
        for ps in c.values():
            for sg, v in ps.items():
                peso[ren.get(sg, sg)] = peso.get(ren.get(sg, sg), 0) + v[0] + v[1] + v[2]
    por_nr = {}
    for sg, (nm, nr) in nomes.items():
        if nr:
            por_nr.setdefault(nr, set()).add(ren[sg])
    for nr, sgs in por_nr.items():
        if len(sgs) > 1:
            dono = max(sgs, key=lambda x: peso.get(x, 0))
            for sg0, sg1 in list(ren.items()):
                if sg1 in sgs:
                    ren[sg0] = dono
    nd = {}
    for c, ufs in data.items():
        for uf, ps in ufs.items():
            for sg, v in ps.items():
                cell = nd.setdefault(c, {}).setdefault(uf, {}).setdefault(ren.get(sg, sg), [0, 0, 0])
                for i in range(3):
                    cell[i] += v[i]
    nn = {}
    for sg, v in nomes.items():
        nn.setdefault(ren[sg], nomes.get(ren[sg], v))
    np_ = {}
    for c, ufs in pend.items():
        for uf, ps in ufs.items():
            for sg, v in ps.items():
                d = np_.setdefault(c, {}).setdefault(uf, {})
                d[ren.get(sg, sg)] = d.get(ren.get(sg, sg), 0) + v
    return nd, nn, np_


# ---------------------------------------------------------------- partidos
def partidos(ano):
    pf = partido_file(ano)
    cf = munzona_cand_file(ano, presidente=False)
    if not pf or not cf:
        log("sem votacao_partido ou votacao_candidato", ano, "- mantém o arquivo atual")
        return None
    cs = cols(pf)
    nom = "QT_VOTOS_NOMINAIS_VALIDOS" if "QT_VOTOS_NOMINAIS_VALIDOS" in cs else "QT_VOTOS_NOMINAIS"
    leg = "QT_TOTAL_VOTOS_LEG_VALIDOS" if "QT_TOTAL_VOTOS_LEG_VALIDOS" in cs else "QT_VOTOS_LEGENDA"
    # alguns anos (1994) deixam a coluna "válidos" zerada nos cargos de maioria: aí usa a coluna de votos nominais do mesmo arquivo
    nom0 = "QT_VOTOS_NOMINAIS" if "QT_VOTOS_NOMINAIS" in cs else nom
    votos = q(lambda S: f"""select CD_CARGO c, SG_UF uf, NR_TURNO::int t, SG_PARTIDO sg, any_value(NM_PARTIDO) nm, any_value(NR_PARTIDO) nr,
                  sum(coalesce(try_cast({nom} as bigint),0)) n, sum(coalesce(try_cast({leg} as bigint),0)) l,
                  sum(coalesce(try_cast({nom0} as bigint),0)) n0
           from {S} where CD_TIPO_ELEICAO='2' and CD_CARGO in ('1','3','5','6','7','8','11','13') group by all""", pf)
    eleitos = []
    if cf:
        # SQ_CANDIDATO antigo só é único dentro de cada estado (e cidade, nas municipais); em 2002 SG_UE traz o município até para deputado.
        # "MÉDIA" = eleito por média (nome usado em alguns anos). Pendente = foi ao 2º turno e o 2º turno ainda não está no arquivo.
        eleitos = q(lambda S: f"""
            with x as (select CD_CARGO c, SG_UF uf, case when CD_CARGO in ('11','13') then SG_UE else SG_UF end ue, SG_PARTIDO sg,
                              SG_UF || '-' || case when CD_CARGO in ('11','13') then SG_UE else '' end || '-' || NR_CANDIDATO k,
                              NR_TURNO::int t, DS_SIT_TOT_TURNO s
                       from {S} where CD_TIPO_ELEICAO='2' and CD_CARGO in ('1','3','5','6','7','8','11','13')),
                 mt as (select c, ue, max(t) mt from x group by all)
            select x.c, x.uf, x.sg,
                   count(distinct case when s like 'ELEITO%' or s = 'MÉDIA' then k end) e,
                   count(distinct case when s like '%2º TURNO%' and mt.mt = 1 then k end) seg
            from x join mt on mt.c = x.c and mt.ue = x.ue group by all""", cf)
    nomes = {}
    # cargos que o arquivo de partidos não traz (1994: só deputados) -> soma os votos dos candidatos do partido
    tem = {r[0] for r in votos if r[6] or r[7] or r[8]}
    falta = [c for c in ("1", "3", "5") if c not in tem]
    if falta and cf:
        ccs = cols(cf)
        vc = "QT_VOTOS_NOMINAIS_VALIDOS" if "QT_VOTOS_NOMINAIS_VALIDOS" in ccs else "QT_VOTOS_NOMINAIS"
        lst = ",".join("'%s'" % c for c in falta)
        extra = q(lambda S: f"""select CD_CARGO c, SG_UF uf, NR_TURNO::int t, SG_PARTIDO sg, any_value(NM_PARTIDO) nm, any_value(NR_PARTIDO) nr,
                  sum(coalesce(try_cast({vc} as bigint),0)) n, 0 l, sum(coalesce(try_cast({vc} as bigint),0)) n0
           from {S} where CD_TIPO_ELEICAO='2' and CD_CARGO in ({lst}) group by all""", cf)
        if extra:
            log("  votos de", falta, "somados dos candidatos")
            votos = [r for r in votos if r[0] not in falta] + list(extra)
    data = {}
    zerado = {c for c in {r[0] for r in votos} if sum(r[6] for r in votos if r[0] == c) == 0}
    votos = [r[:6] + ((r[8] if r[0] in zerado else r[6]), r[7]) for r in votos]
    for c, uf, t, sg, nm, nr, n, l in votos:
        if c in ("3", "11", "1") and t != 1:
            continue  # cargos de maioria: soma só o 1º turno (no 2º os mesmos eleitores votam de novo)
        c = "7" if c == "8" else c
        nomes[sg] = [nm and titulo(nm), int(nr) if nr and nr.lstrip('-').isdigit() else None]
        cell = data.setdefault(c, {}).setdefault(uf, {}).setdefault(sg, [0, 0, 0])
        cell[0] += n
        cell[1] += l
    pend = {}
    for c, uf, sg, e, seg in eleitos:
        c = "7" if c == "8" else c
        cell = data.setdefault(c, {}).setdefault(uf, {}).setdefault(sg, [0, 0, 0])
        cell[2] += e
        if seg:
            pend.setdefault(c, {}).setdefault(uf, {})[sg] = seg
    data, nomes, pend = junta_siglas(data, nomes, pend)
    out = {"ano": ano, "tipo": "geral" if ano in GERAIS else "municipal", "partidos": nomes,
           "cargos": {c: {"nome": "Deputado estadual/distrital" if c == "7" else CARGOS[c], "uf": data[c]} for c in sorted(data, key=int)},
           "coluna": ["votos nominais", "votos de legenda", "eleitos"],
           "fonte": f"TSE, votacao_partido_munzona_{ano} (votos) e votacao_candidato_munzona_{ano} (eleitos)"}
    if pend:
        out["pendente_2t"] = pend
    wjson(f"partidos/{ano}.json", out)
    return ano


# ---------------------------------------------------------------- seções especiais (presídios) e exterior
ADOL = re.compile(r"FUNDA[CÇ][AÃ]O CASA|SOCIO ?-?EDUCA|S[OÓ]CIO ?-?EDUCA|INTERNA[CÇ][AÃ]O|ADOLESCEN|\bCASE\b|IASES|\bCSE\b|MENOR|JUVENIL|\bUNEI\b|\bCENSE\b|\bUIP?\b|DEGASE|FUNASE|CEDUC|\bCIA\b|\bCJ\b|\bCAJE\b|\bUNIDADE DE INTERNA", re.I)


def especiais(ano):
    zf = os.path.join(ZIP, f"votacao_secao_{ano}_BR.zip")
    lf = glob.glob(os.path.join(UNZ, f"eleitorado_local_votacao_{ano}", "*BRASIL*.csv")) or \
        glob.glob(os.path.join(UNZ, f"eleitorado_local_votacao_{ano}", "*.csv"))
    if not os.path.exists(zf) or not lf:
        log("sem seção/local", ano)
        return None
    lsrc = " union all ".join(f"select * from {src(x)}" for x in lf)
    lc = cols(lf[0])
    tcol = "NR_TURNO" if "NR_TURNO" in lc else None
    loc = con.execute(f"""
        select distinct {tcol + '::int' if tcol else '1'} t, SG_UF, CD_MUNICIPIO::int, NR_ZONA::int, NR_SECAO::int, NM_LOCAL_VOTACAO, NM_MUNICIPIO
        from ({lsrc}) where DS_TIPO_LOCAL ilike 'Preso%'""").fetchall()
    con.execute("create or replace temp table presos(t int, uf varchar, mun int, zona int, secao int, local varchar, nm_mun varchar)")
    con.executemany("insert into presos values (?,?,?,?,?,?,?)", loc)
    # extrai o CSV do zip num arquivo temporário (o duckdb não lê zip direto)
    tmp = os.path.join(RAW, f"_secao_{ano}.csv")
    if not os.path.exists(tmp):
        with zipfile.ZipFile(zf) as z:
            m = [x for x in z.namelist() if x.endswith(".csv")][0]
            with z.open(m) as fi, open(tmp, "wb") as fo:
                while True:
                    b = fi.read(1 << 24)
                    if not b:
                        break
                    fo.write(b)
    s = src(tmp)
    rows = con.execute(f"""
        select v.NR_TURNO::int t, v.SG_UF uf, p.local, p.nm_mun, v.NR_VOTAVEL::int nr, any_value(v.NM_VOTAVEL) nm, sum(v.QT_VOTOS::bigint) q,
               count(distinct v.NR_ZONA || '-' || v.NR_SECAO || '-' || v.CD_MUNICIPIO) secoes
        from {s} v join presos p on p.uf=v.SG_UF and p.mun=v.CD_MUNICIPIO::int and p.zona=v.NR_ZONA::int and p.secao=v.NR_SECAO::int
             and (p.t = v.NR_TURNO::int or {0 if tcol else 1}=1)
        where v.CD_CARGO='1' group by all""").fetchall()
    secs = con.execute(f"""
        select v.NR_TURNO::int t, count(distinct v.SG_UF || v.CD_MUNICIPIO || '-' || v.NR_ZONA || '-' || v.NR_SECAO) n,
               count(distinct v.SG_UF || v.CD_MUNICIPIO || '-' || p.local) locais, count(distinct v.SG_UF) ufs
        from {s} v join presos p on p.uf=v.SG_UF and p.mun=v.CD_MUNICIPIO::int and p.zona=v.NR_ZONA::int and p.secao=v.NR_SECAO::int
             and (p.t = v.NR_TURNO::int or {0 if tcol else 1}=1)
        where v.CD_CARGO='1' group by all""").fetchall()
    secs = {r[0]: r[1:] for r in secs}
    res = []
    for t in sorted({r[0] for r in rows}):
        rs = [r for r in rows if r[0] == t]
        tot = {}
        names = {}
        for r in rs:
            tot[r[4]] = tot.get(r[4], 0) + r[6]
            names[r[4]] = r[5]
        cands = sorted([n for n in tot if n not in (95, 96, 97)], key=lambda n: -tot[n])
        grupos = {"presidio": {}, "adolescentes": {}}
        locais = {"presidio": set(), "adolescentes": set()}
        por_uf = {}
        for r in rs:
            g = "adolescentes" if ADOL.search(r[2] or "") else "presidio"
            grupos[g][r[4]] = grupos[g].get(r[4], 0) + r[6]
            locais[g].add((r[1], r[3], r[2]))
            u = por_uf.setdefault(r[1], {})
            u[r[4]] = u.get(r[4], 0) + r[6]

        def vec(d):
            return {"v": [d.get(n, 0) for n in cands], "br": d.get(95, 0), "nu": d.get(96, 0) + d.get(97, 0)}
        res.append({"turno": t, "cadastradas": len({x[1:5] for x in loc if x[0] == t or not tcol}), "secoes": secs.get(t, [0])[0], "locais": secs.get(t, [0, 0])[1], "ufs": secs.get(t, [0, 0, 0])[2],
                    "cands": [{"nr": n, "nome": titulo(names[n])} for n in cands], "total": vec(tot),
                    "presidio": dict(vec(grupos["presidio"]), locais=len(locais["presidio"])),
                    "adolescentes": dict(vec(grupos["adolescentes"]), locais=len(locais["adolescentes"])),
                    "uf": {u: vec(d) for u, d in sorted(por_uf.items())}})
    return res


# ---------------------------------------------------------------- perfil do eleitorado
FAIXAS = [(16, 17, "16–17"), (18, 24, "18–24"), (25, 34, "25–34"), (35, 44, "35–44"), (45, 59, "45–59"), (60, 69, "60–69"), (70, 200, "70+")]
ESC = [("ANALFABETO", "Não sabe ler"), ("LÊ E ESCREVE", "Lê e escreve"), ("FUNDAMENTAL", "Fundamental"), ("MÉDIO", "Médio"), ("SUPERIOR", "Superior")]


def perfil(ano):
    fs = [f for f in glob.glob(os.path.join(UNZ, f"perfil_eleitorado_{ano}", "*.csv")) if "BRASIL" not in f]
    if not fs:
        return None
    s = " union all ".join(f"select SG_UF, DS_GENERO, CD_FAIXA_ETARIA, DS_FAIXA_ETARIA, DS_GRAU_ESCOLARIDADE, DS_RACA_COR, QT_ELEITORES from {src(f)}" for f in fs)
    rows = con.execute(f"select SG_UF, DS_GENERO, DS_FAIXA_ETARIA, DS_GRAU_ESCOLARIDADE, DS_RACA_COR, sum(QT_ELEITORES::bigint) from ({s}) group by all").fetchall()
    out = {}
    for uf, gen, fx, esc, raca, q in rows:
        o = out.setdefault(uf, {"tot": 0, "sexo": {}, "idade": {}, "esc": {}, "raca": {}})
        o["tot"] += q
        g = {"FEMININO": "Mulheres", "MASCULINO": "Homens"}.get((gen or "").upper(), "Não informado")
        o["sexo"][g] = o["sexo"].get(g, 0) + q
        m = re.match(r"\s*(\d+)", fx or "")
        lab = "Não informado"
        if m:
            a = int(m.group(1))
            for lo, hi, l in FAIXAS:
                if lo <= a <= hi:
                    lab = l
        o["idade"][lab] = o["idade"].get(lab, 0) + q
        e = "Não informado"
        for key, l in ESC:
            if key in (esc or "").upper():
                e = l
                break
        o["esc"][e] = o["esc"].get(e, 0) + q
        r = (raca or "").upper()
        r = {"BRANCA": "Branca", "PRETA": "Preta", "PARDA": "Parda", "AMARELA": "Amarela", "INDÍGENA": "Indígena"}.get(r, "Não informado")
        o["raca"][r] = o["raca"].get(r, 0) + q
    return out


# ---------------------------------------------------------------- índice
def indice():
    pres = []
    for f in sorted(glob.glob(os.path.join(OUT, "pres", "*-[12].json"))):
        j = json.load(open(f, encoding="utf-8"))
        val = j["br"]["val"] or 1
        pres.append({"ano": j["ano"], "turno": j["turno"], "data": j.get("data"),
                     "top": [{"nome": c["nome"], "partido": c["partido"], "pct": round(100 * c["votos"] / val, 2),
                              **({"eleito": True} if c.get("eleito") else {})} for c in j["cands"][:3]],
                     "mun": os.path.exists(f.replace(".json", "-mun.json"))})
    pres.sort(key=lambda x: (x["ano"], x["turno"]))
    part = sorted(int(os.path.basename(f)[:4]) for f in glob.glob(os.path.join(OUT, "partidos", "[0-9]*.json")))
    idx = {"gerado_em": dt.date.today().isoformat(), "presidente": pres, "partidos": part,
           "regioes": {k: v.split() for k, v in REG.items()},
           "proximo": {"ano": 2026, "turno": 2, "data": "25/10/2026"} if not any(p["ano"] == 2026 and p["turno"] == 2 for p in pres) else None}
    wjson("indice.json", idx)



def resumo_partidos():
    """partidos/resumo.json: por ano e cargo, votos (nominais + legenda) e eleitos de cada partido no Brasil e em cada região.
    Serve para o ranking e para a linha do tempo sem baixar todos os anos."""
    anos = {}
    for f in sorted(glob.glob(os.path.join(OUT, "partidos", "[0-9]*.json"))):
        d = json.load(open(f, encoding="utf-8"))
        cs = {}
        for c, cg in d["cargos"].items():
            reg = {}
            for uf, ps in cg["uf"].items():
                r = UF2REG.get(uf, "ZZ")
                for sg, v in ps.items():
                    for k in ("BR", r):
                        a = reg.setdefault(k, {}).setdefault(sg, [0, 0])
                        a[0] += v[0] + v[1]
                        a[1] += v[2]
            cs[c] = {k: {sg: a for sg, a in sorted(ps.items(), key=lambda x: -x[1][0]) if a[0] or a[1]} for k, ps in reg.items()}
        anos[str(d["ano"])] = {"tipo": d["tipo"], "cargos": cs, "pend": bool(d.get("pendente_2t"))}
    nomes = {}
    for f in sorted(glob.glob(os.path.join(OUT, "partidos", "[0-9]*.json"))):
        for sg, v in json.load(open(f, encoding="utf-8"))["partidos"].items():
            nomes[sg] = v[0]
    wjson("partidos/resumo.json", {"cargos": {"1": "Presidente", "3": "Governador", "5": "Senador", "6": "Deputado federal",
                                              "7": "Deputado estadual/distrital", "11": "Prefeito", "13": "Vereador"},
                                   "nomes": nomes, "anos": anos,
                                   "nota": "votos = nominais + legenda; cargos de maioria contam só o 1º turno; eleitos = situação final no arquivo do TSE"})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--anos", default="")
    ap.add_argument("--baixar", action="store_true")
    ap.add_argument("--so", default="pres,partidos,especiais,perfil")
    a = ap.parse_args()
    anos = [int(x) for x in a.anos.split(",") if x] or ([1989] + sorted(GERAIS + MUNIC))
    so = set(a.so.split(","))
    os.makedirs(OUT, exist_ok=True)
    for ano in anos:
        if a.baixar:
            baixar(ano)
        if "pres" in so and (ano in GERAIS or ano == 1989):
            log("presidente", ano)
            presidente(ano)
        if "partidos" in so and ano != 1989:
            log("partidos", ano)
            partidos(ano)
    if "especiais" in so:
        esp = rjson("especiais.json", {"presos": {}})
        for ano in anos:
            if ano in GERAIS and ano >= 2010:
                log("presídios", ano)
                r = especiais(ano)
                if r:
                    esp["presos"][str(ano)] = r
        esp["fonte"] = "TSE: votacao_secao_<ano>_BR (votos por seção) + eleitorado_local_votacao_<ano> (locais do tipo 'Preso provisório')"
        wjson("especiais.json", esp)
    if "perfil" in so and not a.anos:
        out = {}
        for ano in (2026, 2022):
            p = perfil(ano)
            if p:
                out[str(ano)] = p
        if out:
            wjson("perfil.json", {"fonte": "TSE, perfil_eleitorado_<ano> (cadastro de eleitores)", "anos": out})
    if "partidos" in so:
        resumo_partidos()
    indice()


if __name__ == "__main__":
    main()
