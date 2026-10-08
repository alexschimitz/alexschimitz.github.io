#!/usr/bin/env python3
"""Converte o FINBRA histórico (Tesouro Nacional, 1989-2012, bases Access)
para o mesmo resumo compacto usado nos anos do SICONFI.

Fonte: https://www.tesourotransparente.gov.br/publicacoes/finbra-dados-contabeis-dos-municipios-1989-a-2012
Requer mdbtools (mdb-export). Os zips ficam em ../pol-mapa-raw/finbra (fora do git).
Grava a chave "hist" em politica/data/mapa/fin/m/<UF>/<ibge>.json.
"""
import csv, glob, io, json, os, re, subprocess, sys, unicodedata
from collections import defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
RAW = os.environ.get("MAPA_RAW", os.path.join(ROOT, "..", "pol-mapa-raw"))
X = os.path.join(RAW, "finbra", "x")
OUT = os.path.join(ROOT, "politica", "data", "mapa", "fin", "m")
csv.field_size_limit(10**9)

FUNCOES = {"legislativa": "01", "judiciaria": "02", "essencial a justica": "03", "administracao": "04",
           "defesa nacional": "05", "seguranca publica": "06", "relacoes exteriores": "07", "assistencia social": "08",
           "previdencia social": "09", "saude": "10", "trabalho": "11", "educacao": "12", "cultura": "13",
           "direitos da cidadania": "14", "urbanismo": "15", "habitacao": "16", "saneamento": "17",
           "gestao ambiental": "18", "ciencia e tecnologia": "19", "agricultura": "20", "organizacao agraria": "21",
           "industria": "22", "comercio e servicos": "23", "comunicacoes": "24", "energia": "25", "transporte": "26",
           "desporto e lazer": "27", "encargos especiais": "28"}
# Classificação funcional antiga (Lei 4.320/64, até 2001 nos municípios)
ANTIGAS = {"legislativa": "leg", "judiciaria": "jud", "planejamento": "adm", "agricultura": "agr",
           "educacao e cultura": "edu", "educacao cultura": "edu", "habitacao e urbanismo": "hab", "habitacao urbanismo": "hab",
           "industria e comercio": "ind", "industria comercio": "ind", "industria comercio servicos": "ind",
           "saude e saneamento": "sau", "saude saneamento": "sau", "assistencia e previdencia": "ass",
           "assistencia previdencia": "ass", "transporte": "tra", "seguranca publica": "seg",
           "def nac seg publica": "seg", "desenvolvimento regional": "des", "desenv regional": "des",
           "energia e recursos minerais": "ene", "energia recminerais": "ene", "comunicacoes": "com",
           "outras": "out", "outras funcoes": "out", "trabalho": "trb", "rel exteriores": "rex"}
MOEDA = {1989: "NCz$", 1990: "Cr$ mil", 1991: "Cr$ mil", 1992: "Cr$ mil", 1993: "CR$ mil"}

def norm(s):
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[_\-]+", " ", s)
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s)).strip()

def table(db, name):
    out = subprocess.run(["mdb-export", db, name], capture_output=True, check=True).stdout.decode("utf-8", "replace")
    return list(csv.DictReader(io.StringIO(out)))

def tables(db):
    return subprocess.run(["mdb-tables", "-1", db], capture_output=True, check=True).stdout.decode().split("\n")

def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0

IBGE = json.load(open(os.path.join(ROOT, "politica", "data", "mapa", "municipios.json"), encoding="utf-8"))
BY6 = {m[0] // 10: m for m in IBGE["municipios"]}
BYNAME = {}
for m in IBGE["municipios"]:
    BYNAME[(norm(m[1]), m[2])] = m[0]
# nomes antigos conhecidos (grafia antiga nas bases do Tesouro)
ALIAS = {}

def by_cd(cd_uf, cd_mun):
    try:
        k = int(float(cd_uf)) * 10000 + int(float(cd_mun))
    except ValueError:
        return None
    m = BY6.get(k)
    return m[0] if m else None

def first(row, *pats):
    """Valor da primeira coluna cujo nome normalizado bate com algum padrão."""
    for p in pats:
        for k in row:
            if re.fullmatch(p, norm(k)):
                return num(row[k])
    return None

def core_from(rec, desp, fun, year):
    o = {}
    if rec:
        o["r"] = first(rec, r"rec orcamentaria", r"recorcamentarias?", r"rec orcam")
        o["trib"] = first(rec, r"rec tributarias?", r"rectributarias?", r"rec tribut")
        u = first(rec, r"transf intergov da uniao")
        e = first(rec, r"transf intergov estados?", r"transf intergov dos estados")
        uc = first(rec, r"transf cap inter uniao")
        ec = first(rec, r"transf cap inter estados")
        if u is not None: o["tu"] = u + (uc or 0)
        if e is not None: o["te"] = e + (ec or 0)
        o["oc"] = first(rec, r"operacoes de credito", r"opercredito", r"op credito", r"opercredito")
    if desp:
        o["d"] = first(desp, r"despesas orcamentarias", r"despesaorcamentaria", r"desporcamentaria", r"d orcament")
        o["pe"] = first(desp, r"pessoal e encarg soc pes", r"desp de pessoal", r"pessoal", r"d pessoal")
        o["inv"] = first(desp, r"investimentos", r"investimen")
        o["ju"] = first(desp, r"juros e encargos (da )?divida")
        o["am"] = first(desp, r"amortizacao da divida", r"amortizacoes")
    if fun:
        f = {}; fa = {}
        for k, v in fun.items():
            n = norm(k)
            if year >= 2002 and n in FUNCOES and FUNCOES[n] not in f:
                f[FUNCOES[n]] = num(v)
            elif year < 2002 and n in ANTIGAS:
                fa[ANTIGAS[n]] = fa.get(ANTIGAS[n], 0) + num(v)
        f = {k: round(v) for k, v in sorted(f.items()) if v}
        fa = {k: round(v) for k, v in sorted(fa.items()) if v}
        if f: o["f"] = f
        if fa: o["fa"] = fa
    for k in list(o):
        if k in ("f", "fa"):
            continue
        if o[k] is None or o[k] == 0:
            o.pop(k)
        else:
            o[k] = round(o[k])
    return o if ("r" in o or "d" in o) else None

def by_name(nome, uf, extra):
    n = norm(nome)
    for d in (extra, BYNAME):
        v = d.get((n, uf))
        if v:
            return v
    return None

def load_old_maps():
    db = glob.glob(os.path.join(X, "1994", "*.accdb"))[0]
    names = {}; ug = {}
    for r in table(db, "IBGExSTNxMUNxUF"):
        m = BY6.get(int(r["IBGE"])) if r["IBGE"].strip().isdigit() else None
        if m:
            names[(norm(r["NOME"]), r["uf"].strip())] = m[0]
            ug[r["UG"].strip()] = m[0]
    # 1998 tem a tabela UG(SIAFI) x IBGE com dígito
    db98 = glob.glob(os.path.join(X, "1998", "*.accdb"))[0]
    for r in table(db98, "Cod Siafi"):
        try:
            code = int(float(r["ibge UfMuniD"]))
        except ValueError:
            continue
        ug[str(980000 + int(float(r["UG"])))] = code
        names.setdefault((norm(r["NOME DO MUNICIPIO SIAFI"]), r["UF"].strip()), code)
    return names, ug

def main():
    res = defaultdict(dict)   # ibge -> year -> core
    stats = {}
    names, ugmap = load_old_maps()
    # 1989-1996: tabelas "QuadroN-AA" por nome+UF
    for db, yrs in ((glob.glob(os.path.join(X, "1989", "*.accdb"))[0], range(1989, 1994)),
                    (glob.glob(os.path.join(X, "1994", "*.accdb"))[0], range(1994, 1997))):
        tl = tables(db)
        for y in yrs:
            per = defaultdict(dict)
            for q in range(1, 6):
                t = "Quadro%d-%02d" % (q, y % 100)
                if t not in tl:
                    continue
                for r in table(db, t):
                    keys = list(r.keys())
                    nome, uf = r[keys[0]], r[keys[1]].strip()
                    code = by_name(nome, uf, names)
                    if not code:
                        continue
                    per[code].update({k: v for k, v in r.items() if k not in keys[:2]})
            n = 0; miss = 0
            for code, row in per.items():
                c = core_from(row, row, row, y)
                if c:
                    res[code][y] = c; n += 1
            stats[y] = n
    # 1997: Quadros por UG
    db = glob.glob(os.path.join(X, "1997", "*.accdb"))[0]
    per = defaultdict(dict)
    for q in range(1, 6):
        for r in table(db, "Quadro%d" % q):
            code = ugmap.get(r["UG"].strip())
            if code:
                per[code].update(r)
    for code, row in per.items():
        c = core_from(row, row, row, 1997)
        if c: res[code][1997] = c
    stats[1997] = sum(1 for c in res.values() if 1997 in c)
    # 1998-2012: tabelas por CD_UF/CD_MUN
    for y in range(1998, 2013):
        dbs = glob.glob(os.path.join(X, str(y), "**", "*.mdb"), recursive=True) + glob.glob(os.path.join(X, str(y), "**", "*.accdb"), recursive=True)
        db = dbs[0]; tl = tables(db)
        per = defaultdict(lambda: [{}, {}, {}])
        def add(tname, slot):
            if tname not in tl:
                return
            for r in table(db, tname):
                ks = list(r.keys())
                code = by_cd(r[ks[0]], r[ks[1]])
                if code:
                    per[code][slot].update({k: v for k, v in r.items() if k not in ks[:2]})
        add("Receita", 0); add("Despesa", 1); add("RecDesp", 0); add("RecDesp", 1)
        add("DFuncao", 2); add("DSubFuncao", 2)
        if y < 2002:
            for code in per: per[code][2] = per[code][1]
        if y in (2002, 2003):
            for code in per: per[code][2] = per[code][0]
        n = 0
        for code, (rec, desp, fun) in per.items():
            c = core_from(rec, desp, fun, y)
            if c:
                res[code][y] = c; n += 1
        stats[y] = n
        print(y, n, flush=True)
    # grava
    ufof = {m[0]: m[2] for m in IBGE["municipios"]}
    written = 0
    for code, years in res.items():
        uf = ufof.get(code)
        if not uf:
            continue
        p = os.path.join(OUT, uf, "%d.json" % code)
        try:
            doc = json.load(open(p, encoding="utf-8"))
        except FileNotFoundError:
            doc = {"id": code, "uf": uf, "anos": {}}
        doc["hist"] = {str(y): years[y] for y in sorted(years)}
        doc["fonte_hist"] = "https://www.tesourotransparente.gov.br/publicacoes/finbra-dados-contabeis-dos-municipios-1989-a-2012"
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p + ".tmp", "w", encoding="utf-8") as fh:
            json.dump(doc, fh, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        os.replace(p + ".tmp", p)
        written += 1
    json.dump({"municipios_por_ano": stats, "moeda": MOEDA}, open(os.path.join(RAW, "finbra_stats.json"), "w"), indent=1)
    print("arquivos", written, stats)

if __name__ == "__main__":
    main()
