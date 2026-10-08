#!/usr/bin/env python3
"""Malhas do IBGE -> caminhos SVG pré-projetados (leves) para o mapa.

Fonte: API de malhas do IBGE v3 (sem chave)
  https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?intrarregiao=UF&qualidade=intermediaria
  https://servicodados.ibge.gov.br/api/v3/malhas/estados/<id>?intrarregiao=municipio&qualidade=minima
Grava politica/data/mapa/geo/br.json e geo/<UF>.json
"""
import gzip, json, math, os, time, urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
RAW = os.environ.get("MAPA_RAW", os.path.join(ROOT, "..", "pol-mapa-raw"))
OUT = os.path.join(ROOT, "politica", "data", "mapa", "geo")
API = "https://servicodados.ibge.gov.br/api/v3/malhas"

def get(url, cache):
    p = os.path.join(RAW, "geo", cache)
    if os.path.exists(p):
        return json.load(open(p))
    req = urllib.request.Request(url, headers={"User-Agent": "alexschimitz.github.io politica/mapa", "Accept": "application/vnd.geo+json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        b = r.read()
    if b[:2] == b"\x1f\x8b":
        b = gzip.decompress(b)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "wb").write(b)
    time.sleep(0.3)
    return json.loads(b)

def rings(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    if geom["type"] == "MultiPolygon":
        return geom["coordinates"]
    return []

def project(features, width):
    lons, lats = [], []
    for f in features:
        for poly in rings(f["geometry"]):
            for ring in poly:
                for x, y in ring:
                    lons.append(x); lats.append(y)
    lat0 = (max(lats) + min(lats)) / 2
    k = math.cos(math.radians(lat0))
    minx, maxx = min(lons) * k, max(lons) * k
    miny, maxy = -max(lats), -min(lats)
    s = width / max(maxx - minx, maxy - miny)
    W = round((maxx - minx) * s); H = round((maxy - miny) * s)
    def P(x, y):
        return (round((x * k - minx) * s), round((-y - miny) * s))
    out = {}
    for f in features:
        parts = []
        for poly in rings(f["geometry"]):
            for ring in poly:
                pts = [P(x, y) for x, y in ring]
                d = []; last = None
                for i, (x, y) in enumerate(pts):
                    if last is None:
                        d.append("M%d %d" % (x, y))
                    else:
                        dx, dy = x - last[0], y - last[1]
                        if dx == 0 and dy == 0:
                            continue
                        d.append("l%d %d" % (dx, dy) if d[-1][0] not in "l-0123456789" else "%d %d" % (dx, dy))
                    last = (x, y)
                if len(d) > 2:
                    parts.append(" ".join(d).replace(" -", "-") + "z")
        cx = sum(x for poly in rings(f["geometry"]) for x, _ in poly[0]) / max(1, sum(len(p[0]) for p in rings(f["geometry"])))
        cy = sum(y for poly in rings(f["geometry"]) for _, y in poly[0]) / max(1, sum(len(p[0]) for p in rings(f["geometry"])))
        out[f["properties"]["codarea"]] = {"d": "".join(parts), "c": list(P(cx, cy))}
    return {"viewBox": "0 0 %d %d" % (W, H), "w": W, "h": H}, out

def main():
    base = json.load(open(os.path.join(ROOT, "politica", "data", "mapa", "municipios.json"), encoding="utf-8"))
    ufs = base["ufs"]; sig = {str(u["ibge"]): u["uf"] for u in ufs}
    os.makedirs(OUT, exist_ok=True)
    br = get(API + "/paises/BR?intrarregiao=UF&qualidade=intermediaria&formato=application/vnd.geo%2Bjson", "br_uf_int.json")
    vb, paths = project(br["features"], 1000)
    doc = dict(vb); doc["fonte"] = API + "/paises/BR?intrarregiao=UF&qualidade=intermediaria"
    doc["ufs"] = {sig[k]: v for k, v in paths.items()}
    json.dump(doc, open(os.path.join(OUT, "br.json"), "w"), separators=(",", ":"))
    total = 0; nm = 0
    for u in ufs:
        q = "intermediaria" if u["uf"] in ("DF", "SE", "AL", "RJ", "ES", "RN", "PB") else "minima"
        g = get(API + "/estados/%d?intrarregiao=municipio&qualidade=%s&formato=application/vnd.geo%%2Bjson" % (u["ibge"], q),
                "uf_%s_%s.json" % (u["uf"], q))
        vb, paths = project(g["features"], 1000)
        doc = dict(vb); doc["fonte"] = API + "/estados/%d?intrarregiao=municipio&qualidade=%s" % (u["ibge"], q)
        doc["m"] = paths
        s = json.dumps(doc, separators=(",", ":"))
        open(os.path.join(OUT, u["uf"] + ".json"), "w").write(s)
        total += len(s); nm += len(paths)
        print(u["uf"], len(paths), len(s) // 1024, "KB")
    print("municípios desenhados:", nm, "total", total // 1024, "KB")

if __name__ == "__main__":
    main()
