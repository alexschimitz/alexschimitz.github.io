#!/usr/bin/env python3
"""Quem governou cada estado e município, segundo o TSE (dados abertos).

Fonte: https://dadosabertos.tse.jus.br  (Candidatos: consulta_cand_<ano>.zip)
  https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_<ano>.zip
  Códigos TSE x IBGE: https://cdn.tse.jus.br/estatistica/sead/odsele/municipio_tse_ibge/municipio_tse_ibge.zip
Primeiro ano disponível: 1994 (governadores) e 1996 (prefeitos e vereadores).

Nunca grava CPF, título de eleitor, e-mail ou data de nascimento.
Identificador de pessoa: slug do nome completo + UF (ex.: "eduardo-figueiredo-cavalheiro-leite-rs").
Identificador de candidatura: SQ_CANDIDATO (único por eleição).
"""
import csv, io, json, os, re, sys, unicodedata, urllib.request, zipfile, datetime as dt
from collections import defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
RAW = os.environ.get("MAPA_RAW", os.path.join(ROOT, "..", "pol-mapa-raw"))
TSE = os.path.join(RAW, "tse")
OUT = os.path.join(ROOT, "politica", "data", "mapa", "pol")
CDN = "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_{}.zip"
MAPURL = "https://cdn.tse.jus.br/estatistica/sead/odsele/municipio_tse_ibge/municipio_tse_ibge.zip"
ESTADUAIS = list(range(1994, 2027, 4))
MUNICIPAIS = list(range(1996, 2025, 4))
CARGOS = {3: "Governador(a)", 4: "Vice-governador(a)", 11: "Prefeito(a)", 12: "Vice-prefeito(a)", 13: "Vereador(a)"}
csv.field_size_limit(10**9)

def slug(s):
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

def title(s):
    """Nome do TSE (CAIXA ALTA) em forma legível, sem inventar acentos."""
    small = {"da", "de", "do", "das", "dos", "e", "di", "du", "del"}
    out = []
    for i, w in enumerate(str(s or "").strip().lower().split()):
        out.append(w if (w in small and i) else w[:1].upper() + w[1:])
    return " ".join(out)

def fetch(url, path, force=False):
    if os.path.exists(path) and not force:
        return path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "alexschimitz.github.io politica/mapa"})
    with urllib.request.urlopen(req, timeout=600) as r, open(path + ".part", "wb") as fh:
        while True:
            b = r.read(1 << 20)
            if not b:
                break
            fh.write(b)
    os.replace(path + ".part", path)
    return path

def rows(year):
    z = zipfile.ZipFile(fetch(CDN.format(year), os.path.join(TSE, "consulta_cand_%d.zip" % year)))
    for n in z.namelist():
        if not n.endswith(".csv") or "BRASIL" in n.upper() or n.upper().endswith("_BR.CSV"):
            continue
        with z.open(n) as fh:
            rd = csv.DictReader(io.TextIOWrapper(fh, encoding="latin-1"), delimiter=";")
            for r in rd:
                try:
                    c = int(r["CD_CARGO"])
                except ValueError:
                    continue
                if c in CARGOS:
                    yield r

def clean(v):
    v = (v or "").strip()
    return "" if v in ("#NULO", "#NULO#", "#NE", "#NE#", "-1", "-3", "-4") else v

def mandate_period(year, cargo, tipo, data):
    if cargo in (3, 4):
        ini, fim = "01/01/%d" % (year + 1), ("05/01/%d" % (year + 5) if year >= 2022 else "31/12/%d" % (year + 4))
        if year == 2026: ini = "06/01/2027"
    else:
        ini, fim = "01/01/%d" % (year + 1), "31/12/%d" % (year + 4)
    if tipo == "suplementar":
        ini = data
    return ini, fim

def wsave(p, doc):
    """grava só se algo além da data de download mudou (evita commits sem mudança real)."""
    try:
        old = json.load(open(p, encoding="utf-8"))
        if isinstance(old, dict) and isinstance(old.get("fonte"), dict) and isinstance(doc.get("fonte"), dict):
            cmp = dict(old); cmp["fonte"] = dict(old["fonte"], baixado_em=doc["fonte"].get("baixado_em"))
            if cmp == json.loads(json.dumps(doc, ensure_ascii=False)):
                return False
        elif old == json.loads(json.dumps(doc, ensure_ascii=False)):
            return False
    except (FileNotFoundError, ValueError):
        pass
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, separators=(",", ":"))
    return True

def main():
    force = "--refresh" in sys.argv
    zmap = zipfile.ZipFile(fetch(MAPURL, os.path.join(TSE, "municipio_tse_ibge.zip"), force))
    tse2ibge = {}
    with zmap.open([n for n in zmap.namelist() if n.endswith(".csv")][0]) as fh:
        for r in csv.DictReader(io.TextIOWrapper(fh, encoding="latin-1"), delimiter=";"):
            tse2ibge[r["CD_MUNICIPIO_TSE"].zfill(5)] = int(r["CD_MUNICIPIO_IBGE"])
    years = sorted(set(ESTADUAIS + MUNICIPAIS))
    if force:
        for y in (max(ESTADUAIS), max(MUNICIPAIS)):
            fetch(CDN.format(y), os.path.join(TSE, "consulta_cand_%d.zip" % y), True)
    # (cd_eleicao, ue, cargo) -> {sq: row}
    elec = defaultdict(dict)
    unmatched = set()
    eleinfo = {}
    for y in years:
        n = 0
        for r in rows(y):
            c = int(r["CD_CARGO"]); ue = r["SG_UE"].strip()
            if c in (11, 12, 13):
                key_ue = tse2ibge.get(ue.zfill(5))
                if not key_ue:
                    unmatched.add((y, r["SG_UF"], ue, r["NM_UE"])); continue
            else:
                key_ue = r["SG_UF"].strip()
            sit = clean(r.get("DS_SIT_TOT_TURNO"))
            ce = r["CD_ELEICAO"].strip()
            k = (ce, key_ue, c)
            sq = r["SQ_CANDIDATO"].strip()
            turno = int(r["NR_TURNO"] or 1)
            prev = elec[k].get(sq)
            rec = {"sq": sq, "nr": r["NR_CANDIDATO"].strip(), "nome": clean(r["NM_CANDIDATO"]),
                   "urna": clean(r["NM_URNA_CANDIDATO"]) or clean(r["NM_CANDIDATO"]), "partido": clean(r["SG_PARTIDO"]),
                   "sit": sit, "turno": turno, "uf": r["SG_UF"].strip(),
                   "situacao_cand": clean(r.get("DS_SITUACAO_CANDIDATURA"))}
            # mantém a linha do turno final / a que diz ELEITO
            if prev is None or rec["sit"].startswith("ELEITO") or (turno > prev["turno"] and not prev["sit"].startswith("ELEITO")):
                if prev and prev["sit"] == "2º TURNO" and not rec["sit"]:
                    rec["sit"] = prev["sit"]
                elec[k][sq] = rec
            tipo = "suplementar" if "SUPLEMENTAR" in r["NM_TIPO_ELEICAO"].upper() else "ordinária"
            dts = r["DT_ELEICAO"].strip()
            info = eleinfo.get(ce)
            if not info:
                eleinfo[ce] = {"ano": int(r["ANO_ELEICAO"]), "tipo": tipo, "desc": r["DS_ELEICAO"].strip(), "datas": {turno: dts}}
            else:
                info["datas"].setdefault(turno, dts)
            n += 1
        print(y, n, "linhas", flush=True)
    # monta mandatos
    estados = defaultdict(list); munis = defaultdict(lambda: {"prefeitos": [], "camara": {}})  # + "pendentes"
    pessoas = defaultdict(lambda: defaultdict(list))   # uf -> slug -> mandatos
    segundo_turno = defaultdict(list)
    for (ce, ue, c), cands in elec.items():
        info = eleinfo[ce]
        ano = info["ano"]
        def dtiso(s):
            try: return dt.datetime.strptime(s, "%d/%m/%Y").date().isoformat()
            except ValueError: return s
        datas = {t: dtiso(v) for t, v in info["datas"].items()}
        if c in (3, 11):
            vices = elec.get((ce, ue, 4 if c == 3 else 12), {})
            vbynr = {}
            for v in vices.values():
                if v["sit"].startswith("ELEITO") or v["nr"] not in vbynr:
                    vbynr.setdefault(v["nr"], []).append(v)
            eleitos = [x for x in cands.values() if x["sit"].startswith("ELEITO")]
            if not eleitos and c == 11:
                ds = datas.get(max(datas)) if datas else ""
                if ano == max(MUNICIPAIS) or (info["tipo"] == "suplementar" and ds >= dt.date.today().isoformat()):
                    munis[ue].setdefault("pendentes", []).append({"ano": ano, "tipo": info["tipo"], "data": ds,
                        "candidatos": len(cands)})
                continue
            if not eleitos and c == 3:
                st = [x for x in cands.values() if x["sit"] == "2º TURNO"]
                if st and ano == max(ESTADUAIS):
                    segundo_turno[ue].append({"ano": ano, "data_1t": datas.get(1), "candidatos": [
                        {"nome": title(x["urna"]), "nome_completo": title(x["nome"]), "partido": x["partido"], "sq": x["sq"], "id": slug(x["nome"]) + "-" + x["uf"].lower()} for x in st]})
                continue
            for e in eleitos:
                vs = [v for v in vbynr.get(e["nr"], []) if v["sit"].startswith("ELEITO")] or vbynr.get(e["nr"], [])
                vs = [v for v in vs if v.get("situacao_cand", "") not in ("INDEFERIDO", "RENÚNCIA", "CANCELADO", "FALECIDO")] or vs
                v = vs[0] if vs else None
                ini, fim = mandate_period(ano, c, info["tipo"], datas.get(max(datas)) if datas else "")
                m = {"ano": ano, "tipo": info["tipo"], "data": datas.get(max(datas)) if datas else None,
                     "turno": e["turno"], "nome": title(e["urna"]), "nome_completo": title(e["nome"]),
                     "partido": e["partido"], "sq": e["sq"], "id": slug(e["nome"]) + "-" + e["uf"].lower(),
                     "inicio": ini, "fim": fim}
                if v:
                    m["vice"] = {"nome": title(v["urna"]), "nome_completo": title(v["nome"]), "partido": v["partido"],
                                 "sq": v["sq"], "id": slug(v["nome"]) + "-" + v["uf"].lower()}
                if c == 3:
                    estados[ue].append(m)
                    local = ue
                else:
                    munis[ue]["prefeitos"].append(m)
                    local = ue
                pessoas[e["uf"]][m["id"]].append([ano, c, local, e["partido"], e["sq"], info["tipo"]])
                if v:
                    pessoas[v["uf"]][m["vice"]["id"]].append([ano, c + 1, local, v["partido"], v["sq"], info["tipo"]])
        elif c == 13:
            eleitos = [x for x in cands.values() if x["sit"].startswith("ELEITO")]
            if eleitos:
                munis[ue]["camara"][str(ano) + ("s" if info["tipo"] == "suplementar" else "")] = sorted(
                    [[title(x["urna"]), x["partido"], x["sq"], slug(x["nome"]) + "-" + x["uf"].lower()] for x in eleitos])
    # numera mandatos de cada pessoa (executivo) e vereança por município
    def count_exec(uf, pid, ano, cargo):
        ms = pessoas[uf].get(pid, [])
        same = sorted(set((a, cg) for a, cg, *_ in ms if cg == cargo and a <= ano))
        allx = sorted(set((a, cg) for a, cg, *_ in ms))
        return len(same), len(allx)
    gerado = dt.date.today().isoformat()
    fonte = {"nome": "TSE — Portal de Dados Abertos (Candidatos)", "url": "https://dadosabertos.tse.jus.br/dataset/?q=candidatos",
             "arquivos": CDN.format("<ano>"), "baixado_em": gerado}
    os.makedirs(os.path.join(OUT, "uf"), exist_ok=True)
    base = json.load(open(os.path.join(ROOT, "politica", "data", "mapa", "municipios.json"), encoding="utf-8"))
    ufof = {m[0]: m[2] for m in base["municipios"]}
    resumo_uf = defaultdict(dict)
    for ibge, d in munis.items():
        uf = ufof.get(ibge)
        if not uf:
            continue
        d["prefeitos"].sort(key=lambda m: (m["ano"], m["data"] or ""))
        for m in d["prefeitos"]:
            m["n_mandato"], m["n_exec_total"] = count_exec(uf, m["id"], m["ano"], 11)
        ver_count = defaultdict(int)
        for k in sorted(d["camara"]):
            for v in d["camara"][k]:
                ver_count[v[3]] += 1
        cam = {k: [v + [ver_count[v[3]]] for v in vs] for k, vs in sorted(d["camara"].items())}
        pend = [x for x in d.get("pendentes", []) if not any(m["ano"] == x["ano"] and (m["data"] or "") >= (x["data"] or "") for m in d["prefeitos"])]
        doc = {"ibge": ibge, "uf": uf, "fonte": fonte, "prefeitos": d["prefeitos"], "camara": cam, "eleicoes_sem_eleito": pend,
               "camara_colunas": ["nome_urna", "partido", "sq_candidato", "id_pessoa", "mandatos_de_vereador_neste_municipio"]}
        p = os.path.join(OUT, "m", uf, "%d.json" % ibge)
        wsave(p, doc)
        last = d["prefeitos"][-1] if d["prefeitos"] else None
        if last:
            resumo_uf[uf][ibge] = [last["nome"], last["partido"], last["ano"], last["tipo"][0], last["id"]]
    for uf in sorted(set(ufof.values())):
        govs = sorted(estados.get(uf, []), key=lambda m: (m["ano"], m["data"] or ""))
        for m in govs:
            m["n_mandato"], m["n_exec_total"] = count_exec(uf, m["id"], m["ano"], 3)
        doc = {"uf": uf, "fonte": fonte, "governadores": govs, "segundo_turno": segundo_turno.get(uf, []),
               "prefeitos_atuais": resumo_uf.get(uf, {}),
               "prefeitos_colunas": ["nome_urna", "partido", "ano_eleicao", "tipo(o=ordinária,s=suplementar)", "id_pessoa"]}
        wsave(os.path.join(OUT, "uf", uf + ".json"), doc)
        pdoc = {"uf": uf, "colunas": ["ano_eleicao", "cd_cargo(3=gov,4=vice-gov,11=pref,12=vice-pref)", "local(UF ou IBGE)", "partido", "sq_candidato", "tipo"],
                "pessoas": {k: sorted(v) for k, v in sorted(pessoas[uf].items())}}
        wsave(os.path.join(OUT, "pessoas", uf + ".json"), pdoc)
    print("municípios com dados:", len(munis), "sem correspondência TSE→IBGE:", len(unmatched))
    with open(os.path.join(RAW, "tse_unmatched.json"), "w") as fh:
        json.dump(sorted(unmatched), fh, ensure_ascii=False, indent=0)

if __name__ == "__main__":
    main()
