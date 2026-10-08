#!/usr/bin/env python3
"""Índice de UFs e municípios (IBGE) para o mapa.

Fontes (sem chave):
- Localidades: https://servicodados.ibge.gov.br/api/v1/localidades/municipios
- População Censo 2022 (tabela SIDRA 4709, var. 93)
- Estimativas de população 2024/2025 (tabela SIDRA 6579, var. 9324)
Gera politica/data/mapa/municipios.json
"""
import gzip, json, os, sys, urllib.request, datetime as dt

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
RAW = os.environ.get("MAPA_RAW", os.path.join(ROOT, "..", "pol-mapa-raw"))
OUT = os.path.join(ROOT, "politica", "data", "mapa")
U = {
    "mun": "https://servicodados.ibge.gov.br/api/v1/localidades/municipios",
    "uf": "https://servicodados.ibge.gov.br/api/v1/localidades/estados",
    "pop22": "https://servicodados.ibge.gov.br/api/v3/agregados/4709/periodos/2022/variaveis/93?localidades=N6%5Ball%5D",
    "popest": "https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/2025%7C2024/variaveis/9324?localidades=N6%5Ball%5D",
    "popuf": "https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/2025/variaveis/9324?localidades=N3%5Ball%5D",
}
CAPITAIS = {1200401, 2704302, 1600303, 1302603, 2927408, 2304400, 5300108, 3205309, 5208707, 2111300,
            5103403, 5002704, 3106200, 1501402, 2507507, 4106902, 2611606, 2211001, 3304557, 2408102,
            4314902, 1100205, 1400100, 4205407, 3550308, 2800308, 1721000}

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "alexschimitz.github.io politica/mapa"})
    with urllib.request.urlopen(req, timeout=120) as r:
        b = r.read()
        if b[:2] == b"\x1f\x8b":
            b = gzip.decompress(b)
        return json.loads(b.decode("utf-8"))

def series(d):
    out = {}
    for s in d[0]["resultados"][0]["series"]:
        out[int(s["localidade"]["id"])] = {k: (int(v) if v not in ("-", "...", "X", "") else None) for k, v in s["serie"].items()}
    return out

def main():
    mun = get(U["mun"]); ufs = get(U["uf"])
    p22 = series(get(U["pop22"])); pest = series(get(U["popest"])); puf = series(get(U["popuf"]))
    uflist = []
    for u in sorted(ufs, key=lambda x: x["sigla"]):
        uflist.append({"uf": u["sigla"], "ibge": u["id"], "nome": u["nome"], "regiao": u["regiao"]["nome"],
                       "pop": puf.get(u["id"], {}).get("2025")})
    rows = []
    for m in mun:
        uf = None
        for k in ("microrregiao", "regiao-imediata"):
            try:
                uf = m[k]["mesorregiao" if k == "microrregiao" else "regiao-intermediaria"]["UF"]["sigla"]
                break
            except (TypeError, KeyError):
                pass
        if uf is None:
            uf = next(x["sigla"] for x in ufs if x["id"] == m["id"] // 100000)
        pe = pest.get(m["id"], {})
        pop = pe.get("2025") or pe.get("2024") or p22.get(m["id"], {}).get("2022")
        rows.append([m["id"], m["nome"], uf, pop, 1 if m["id"] in CAPITAIS else 0, p22.get(m["id"], {}).get("2022")])
    rows.sort(key=lambda r: (r[2], r[1]))
    caps = [r for r in rows if r[4]]
    assert len(caps) == 27, len(caps)
    doc = {
        "gerado": dt.date.today().isoformat(),
        "colunas": ["ibge", "nome", "uf", "pop_2025", "capital", "pop_censo_2022"],
        "fontes": [
            {"nome": "IBGE Localidades", "url": U["mun"]},
            {"nome": "IBGE Censo 2022 (SIDRA 4709)", "url": "https://sidra.ibge.gov.br/tabela/4709"},
            {"nome": "IBGE Estimativas de população 2025 (SIDRA 6579)", "url": "https://sidra.ibge.gov.br/tabela/6579"},
        ],
        "ufs": uflist,
        "municipios": rows,
    }
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "municipios.json"), "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, separators=(",", ":"))
    print(len(rows), "municípios;", len(uflist), "UFs")

if __name__ == "__main__":
    main()
