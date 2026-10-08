#!/usr/bin/env python3
"""Agrega os resumos por município/estado em arquivos leves para o mapa:
- idx/<ano>.json  : indicadores-chave de todos os municípios naquele ano (mapa colorido e rankings)
- uf/<UF>.json    : contas do governo estadual + médias/somas dos municípios do estado por ano
- brasil.json     : médias nacionais, IPCA (fator de correção), rótulos, cobertura e fontes
Depende de: municipios.json, fin/**, pol/uf/** e (opcional) população anual do IBGE em ../pol-mapa-raw/ibge.
"""
import glob, json, os, statistics, urllib.request, datetime as dt
from collections import defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
RAW = os.environ.get("MAPA_RAW", os.path.join(ROOT, "..", "pol-mapa-raw"))
D = os.path.join(ROOT, "politica", "data", "mapa")
SGS = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json&dataInicial=01/01/{a}&dataFinal=31/12/{b}"

def jload(p, default=None):
    try:
        return json.load(open(p, encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return default

def jsave(p, d):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    s = json.dumps(d, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    old = open(p, encoding="utf-8").read() if os.path.exists(p) else None
    if old != s:
        open(p, "w", encoding="utf-8").write(s)

def ipca():
    """Índice médio anual do IPCA (BCB SGS 433, variação mensal %)."""
    cache = os.path.join(RAW, "ipca", "sgs433.json")
    rows = []
    try:
        for a in range(1980, dt.date.today().year + 1, 10):
            req = urllib.request.Request(SGS.format(a=a, b=a + 9), headers={"User-Agent": "alexschimitz.github.io"})
            rows += json.loads(urllib.request.urlopen(req, timeout=60).read())
        os.makedirs(os.path.dirname(cache), exist_ok=True)
        json.dump(rows, open(cache, "w"))
    except Exception:
        rows = jload(cache, [])
        if not rows:
            prev = jload(os.path.join(D, "brasil.json"), {})
            return prev.get("ipca", {})
    idx = 1.0; per_year = defaultdict(list)
    for r in rows:
        d, m, y = r["data"].split("/")
        idx *= 1 + float(r["valor"]) / 100
        per_year[int(y)].append(idx)
    avg = {y: sum(v) / len(v) for y, v in per_year.items() if len(v) == 12}
    base = max(avg)
    return {"base": base, "fonte": "https://www3.bcb.gov.br/sgspub (série 433 — IPCA, variação mensal)",
            "fator": {str(y): round(avg[base] / avg[y], 6) for y in sorted(avg) if y >= 1995},
            "nota": "Valores multiplicados pelo fator ficam em reais de %d (média anual do IPCA). Antes de 1995 a inflação era tão alta que a correção anual não é confiável; esses anos aparecem só em moeda da época." % base}

def population():
    """população por município e ano (estimativas e censos do IBGE)."""
    pop = defaultdict(dict)
    for f in glob.glob(os.path.join(RAW, "ibge", "pop6579_*.json")) + [os.path.join(RAW, "ibge", "pop2022.json"),
                                                                     os.path.join(RAW, "ibge", "pop202.json"),
                                                                     os.path.join(RAW, "ibge", "pop793.json")]:
        d = jload(f)
        if not isinstance(d, list):
            continue
        for var in d:
            for res in var.get("resultados", []):
                for s in res["series"]:
                    for y, v in s["serie"].items():
                        try:
                            pop[int(s["localidade"]["id"])][int(y)] = int(v)
                        except (ValueError, TypeError):
                            pass
    if not pop:
        # sem arquivos brutos (ex.: GitHub Actions): reaproveita pop/{UF}.json já publicados
        for f in glob.glob(os.path.join(D, "pop", "*.json")):
            d = jload(f) or {}
            for k, vs in (d.get("m") or {}).items():
                for i, v in enumerate(vs):
                    if v:
                        pop[int(k)][d["ano0"] + i] = v
        return pop
    # interpola anos faltantes entre dois anos conhecidos
    for m, ys in pop.items():
        known = sorted(ys)
        for a, b in zip(known, known[1:]):
            for y in range(a + 1, b):
                ys[y] = round(ys[a] + (ys[b] - ys[a]) * (y - a) / (b - a))
    return pop

def main():
    base = jload(os.path.join(D, "municipios.json"))
    munis = base["municipios"]; ufs = base["ufs"]
    ipc = ipca()
    pop = population()
    idx = defaultdict(dict)            # ano -> ibge -> linha
    por_uf = defaultdict(lambda: defaultdict(list))   # uf -> ano -> [linhas]
    cobertura = defaultdict(lambda: {"finbra": 0, "siconfi": 0, "sem_entrega": 0})
    for m in munis:
        ibge, nome, uf = m[0], m[1], m[2]
        doc = jload(os.path.join(D, "fin", "m", uf, "%d.json" % ibge))
        if not doc:
            continue
        anos = {}
        for y, c in (doc.get("hist") or {}).items():
            if c: anos[int(y)] = (c, "finbra")
        for y, c in (doc.get("anos") or {}).items():
            if c: anos[int(y)] = (c, "siconfi")
            elif int(y) not in anos: cobertura[int(y)]["sem_entrega"] += 1
        for y, (c, src) in anos.items():
            cobertura[y][src] += 1
            p = c.get("pop") or pop.get(ibge, {}).get(y)
            f = c.get("f") or {}
            row = [c.get("d"), c.get("r"), c.get("pe"), c.get("inv"), f.get("10"), f.get("12"), f.get("06"), p, c.get("tu"), c.get("trib")]
            idx[y][ibge] = row
            por_uf[uf][y].append(row)
    COLS = ["despesa", "receita", "pessoal", "investimentos", "saude", "educacao", "seguranca", "populacao", "transf_uniao", "tributos_proprios"]
    for y, rows in idx.items():
        jsave(os.path.join(D, "idx", "%d.json" % y), {"ano": y, "colunas": COLS, "m": {str(k): v for k, v in sorted(rows.items())}})
    # população anual por município (IBGE), para valores "por habitante" em qualquer ano
    if pop:
        y0, y1 = 2000, max(y for ys in pop.values() for y in ys)
        por_uf_pop = defaultdict(dict)
        for m in munis:
            ys = pop.get(m[0], {})
            if ys:
                por_uf_pop[m[2]][str(m[0])] = [ys.get(y) for y in range(y0, y1 + 1)]
        for uf, d in por_uf_pop.items():
            jsave(os.path.join(D, "pop", uf + ".json"), {"ano0": y0, "ano1": y1, "fonte": "IBGE/SIDRA tabelas 6579 (estimativas), 202 e 793 (censos/contagem) e 4709 (Censo 2022); anos sem número oficial interpolados", "m": d})
    def agg(rows):
        """somas e mediana per capita de um grupo de municípios."""
        out = {"n": len(rows)}
        for i, k in enumerate(COLS):
            vals = [r[i] for r in rows if r[i] is not None]
            if vals:
                out[k] = round(sum(vals))
        pcs = [r[0] / r[7] for r in rows if r[0] and r[7]]
        if pcs:
            out["despesa_pc_mediana"] = round(statistics.median(pcs), 2)
        for i, k in ((4, "saude"), (5, "educacao"), (2, "pessoal"), (3, "investimentos")):
            sh = [r[i] / r[0] for r in rows if r[i] is not None and r[0]]
            if sh:
                out[k + "_pct_mediana"] = round(100 * statistics.median(sh), 2)
        return out
    nacional = {}
    for y in sorted(idx):
        nacional[str(y)] = agg(list(idx[y].values()))
    for u in ufs:
        uf = u["uf"]
        gov = jload(os.path.join(D, "fin", "uf", uf + ".json"), {}) or {}
        doc = {"uf": uf, "nome": u["nome"], "ibge": u["ibge"], "regiao": u["regiao"], "pop": u["pop"],
               "governo_estadual": {"fonte": gov.get("fonte"), "anos": gov.get("anos", {})},
               "municipios_agregado": {str(y): agg(v) for y, v in sorted(por_uf[uf].items())}}
        jsave(os.path.join(D, "uf", uf + ".json"), doc)
    # estados: médias nacionais dos governos estaduais
    est = defaultdict(list)
    for u in ufs:
        g = jload(os.path.join(D, "fin", "uf", u["uf"] + ".json"), {}) or {}
        for y, c in (g.get("anos") or {}).items():
            if c: est[y].append(c)
    estados_ag = {}
    for y, cs in sorted(est.items()):
        o = {"n": len(cs)}
        for k in ("d", "r", "pe", "inv", "div", "tu"):
            v = [c.get(k) for c in cs if c.get(k)]
            if v: o[k] = round(sum(v))
        pops = [c.get("pop") for c in cs if c.get("pop") and c.get("d")]
        if pops: o["pop"] = sum(pops)
        estados_ag[y] = o
    meta = jload(os.path.join(D, "brasil.json"), {}) or {}
    meta.update({
        "gerado": dt.date.today().isoformat(),
        "ipca": ipc,
        "nacional_municipios": nacional,
        "nacional_estados": estados_ag,
        "cobertura_municipios": {str(k): v for k, v in sorted(cobertura.items())},
        "idx_colunas": COLS,
        "anos_idx": sorted(idx),
    })
    jsave(os.path.join(D, "brasil.json"), meta)
    print("anos:", min(idx), "-", max(idx), "| idx arquivos:", len(idx))

if __name__ == "__main__":
    main()
