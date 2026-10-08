#!/usr/bin/env python3
"""Economia: crescimento do Brasil x outros países.

Baixa séries oficiais e gera JSON pequeno em politica/data/economia/:
  paises.json   séries anuais por país (Banco Mundial + FMI)
  brasil.json   PIB oficial do Brasil (IBGE via BCB/SGS e SIDRA) + médias por mandato presidencial
  ranking.json  posição do Brasil entre os países (PIB por pessoa em PPC; crescimento)
  fontes.json   fontes, links e datas de consulta

Só biblioteca padrão. Uso: python3 scripts/politica/economia/build.py
Se uma fonte falhar, mantém o arquivo anterior (não apaga dados).
"""
import json, math, os, sys, time, urllib.request, urllib.error, datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUT = os.path.join(ROOT, "politica", "data", "economia")
GOV = os.path.join(ROOT, "politica", "data", "governo", "presidentes.json")
TODAY = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3))).date().isoformat()
UA = "alexschimitz.github.io economia (dados abertos; +https://alexschimitz.github.io/politica/economia/)"
FIRST = 1960

# Países/grupos: id = código ISO3 do Banco Mundial; imf = código no WEO do FMI
PAISES = [
    ("BRA", "Brasil", "brasil", "BRA"),
    ("WLD", "Mundo (média)", "grupo", "G001"),
    ("LCN", "América Latina e Caribe", "grupo", "G205"),
    ("LMY", "Países em desenvolvimento", "grupo", None),
    ("HIC", "Países ricos", "grupo", None),
    ("ARG", "Argentina", "vizinho", "ARG"),
    ("CHL", "Chile", "vizinho", "CHL"),
    ("COL", "Colômbia", "vizinho", "COL"),
    ("MEX", "México", "vizinho", "MEX"),
    ("CHN", "China", "emergente", "CHN"),
    ("IND", "Índia", "emergente", "IND"),
    ("RUS", "Rússia", "emergente", "RUS"),
    ("ZAF", "África do Sul", "emergente", "ZAF"),
    ("TUR", "Turquia", "emergente", "TUR"),
    ("IDN", "Indonésia", "emergente", "IDN"),
    ("USA", "Estados Unidos", "rico", "USA"),
    ("DEU", "Alemanha", "rico", "DEU"),
    ("JPN", "Japão", "rico", "JPN"),
]

WB = {  # chave curta -> (indicador, casas decimais)
    "cres": ("NY.GDP.MKTP.KD.ZG", 2),     # crescimento real do PIB, % ao ano
    "cresPc": ("NY.GDP.PCAP.KD.ZG", 2),   # crescimento real do PIB por pessoa, %
    "pibKd": ("NY.GDP.MKTP.KD", -6),      # PIB em US$ constantes de 2015 (para o acumulado)
    "pcKd": ("NY.GDP.PCAP.KD", 0),        # PIB por pessoa, US$ constantes de 2015
    "pcPpc": ("NY.GDP.PCAP.PP.KD", 0),    # PIB por pessoa em PPC, dólar internacional constante de 2021
    "infl": ("FP.CPI.TOTL.ZG", 2),        # inflação, preços ao consumidor, % (média do ano)
    "desemp": ("SL.UEM.TOTL.ZS", 2),      # desemprego, % da força de trabalho (estimativa modelada da OIT)
    "gini": ("SI.POV.GINI", 1),           # índice de Gini
}
IMF = {  # WEO
    "cresFmi": "NGDP_RPCH",      # crescimento real do PIB (inclui projeções)
    "divida": "GGXWDG_NGDP",     # dívida bruta do governo geral, % do PIB
    "fatia": "PPPSH",            # fatia do PIB mundial em PPC, %
}


def get(url, tries=4, accept="application/json"):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept})
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # noqa
            last = e
            time.sleep(3 * (i + 1))
    raise RuntimeError(f"falhou: {url}: {last}")


def rnd(v, d):
    if v is None:
        return None
    if isinstance(v, str):
        v = float(v)
    if not math.isfinite(v):
        return None
    if d < 0:
        return int(round(v / 10 ** (-d)) * 10 ** (-d))
    return round(v, d) if d else int(round(v))


def pack(d, dec):
    """{ano: v} -> {"i": primeiro ano, "v": [...]} sem nulos nas pontas."""
    ys = sorted(y for y, v in d.items() if v is not None)
    if not ys:
        return None
    a, b = ys[0], ys[-1]
    return {"i": a, "v": [rnd(d.get(y), dec) for y in range(a, b + 1)]}


def load(name):
    p = os.path.join(OUT, name)
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def save(name, obj):
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, name)
    s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    with open(p, "w", encoding="utf-8") as f:
        f.write(s + "\n")
    print(f"  {name}: {len(s)/1024:.0f} KB")


# ---------------------------------------------------------------- Banco Mundial
WB_ALIAS = {"XD": "HIC", "XO": "LMY", "1W": "WLD", "ZJ": "LCN"}  # agregados às vezes vêm sem código ISO3
def wb_series(ind, codes):
    url = (f"https://api.worldbank.org/v2/country/{';'.join(codes)}/indicator/{ind}"
           f"?format=json&per_page=20000&date={FIRST}:{datetime.date.today().year}")
    j = get(url)
    meta, rows = j[0], (j[1] or [])
    out = {}
    for r in rows:
        if r.get("value") is None:
            continue
        c = r.get("countryiso3code") or WB_ALIAS.get(r["country"]["id"])
        if c:
            out.setdefault(c, {})[int(r["date"])] = r["value"]
    return out, meta.get("lastupdated")


def wb_countries():
    j = get("https://api.worldbank.org/v2/country?format=json&per_page=400")
    return {c["id"]: c["name"] for c in j[1] if c.get("region", {}).get("id") not in (None, "NA") and c["region"]["value"] != "Aggregates"}


# ---------------------------------------------------------------- FMI (WEO via SDMX)
def imf_weo(inds, codes):
    url = ("https://api.imf.org/external/sdmx/3.0/data/dataflow/IMF.RES/WEO/+/"
           f"{'+'.join(codes)}.{'+'.join(inds)}.A")
    j = get(url)
    d = j["data"]
    st = d["structures"][0]
    dims = st["dimensions"]["series"]
    years = [int(v["value"]) for v in st["dimensions"]["observation"][0]["values"]]
    out = {}
    for k, s in d["dataSets"][0]["series"].items():
        idx = [int(x) for x in k.split(":")]
        c = dims[0]["values"][idx[0]]["id"]
        ind = dims[1]["values"][idx[1]]["id"]
        for oi, ov in s.get("observations", {}).items():
            v = ov[0] if ov else None
            if v in (None, "", "NaN"):
                continue
            out.setdefault(ind, {}).setdefault(c, {})[years[int(oi)]] = float(v)
    # edição (data de atualização do conjunto WEO)
    flow = get("https://api.imf.org/external/sdmx/3.0/structure/dataflow/IMF.RES/WEO/+?detail=full")
    upd = None
    for a in flow["data"]["dataflows"][0].get("annotations", []):
        if a.get("id") == "lastUpdatedAt" and a.get("value"):
            upd = a["value"][:10]
    return out, upd


# ---------------------------------------------------------------- Brasil oficial
def bcb(serie):
    j = get(f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{serie}/dados?formato=json")
    return {int(r["data"][-4:]): float(r["valor"]) for r in j if r.get("valor") not in (None, "")}


def sidra_6784():
    j = get("https://apisidra.ibge.gov.br/values/t/6784/n1/all/v/9810,9814/p/all?formato=json")
    out = {"9810": {}, "9814": {}}
    for r in j[1:]:
        try:
            out[r["D2C"]][int(r["D3C"])] = float(r["V"])
        except (ValueError, KeyError):
            pass
    return out


def geo_mean(vals):
    f = 1.0
    for v in vals:
        f *= 1 + v / 100
    return (f ** (1 / len(vals)) - 1) * 100, (f - 1) * 100


def year_owner(pres):
    """Ano -> id do presidente que exerceu o cargo mais dias naquele ano."""
    days = {}
    for p in pres:
        for a, b in p["exercicio"]:
            d0 = datetime.date.fromisoformat(a)
            d1 = datetime.date.fromisoformat(b)
            d1 = min(d1, datetime.date(datetime.date.today().year, 12, 31))
            d = d0
            while d <= d1:
                days.setdefault(d.year, {}).setdefault(p["id"], 0)
                days[d.year][p["id"]] += 1
                d += datetime.timedelta(days=1)
    return {y: max(c.items(), key=lambda kv: kv[1])[0] for y, c in days.items()}, days


def mandatos(pres, cres_br, cres_pc, world, lcn):
    owner, days = year_owner(pres)
    pmap = {p["id"]: p for p in pres}
    # mandatos de 4 anos para quem foi reeleito (posse em 1º de janeiro)
    def mandate_of(pid, y):
        p = pmap[pid]
        start = int(p["inicio"][:4])
        if pid in ("fhc", "lula12", "dilma") and p["inicio"][5:] == "01-01":
            n = (y - start) // 4 + 1
            return f"{pid}-{n}", n
        return pid, None
    groups = []
    for y in sorted(owner):
        if y < 1985:
            continue
        pid = owner[y]
        key, n = mandate_of(pid, y)
        if not groups or groups[-1]["id"] != key:
            groups.append({"id": key, "pres": pid, "nome": pmap[pid]["nome"], "partido": pmap[pid]["partido"].split(" (")[0].split(";")[0],
                           "mandato": n, "anos": []})
        groups[-1]["anos"].append(y)
    res = []
    for g in groups:
        ys = [y for y in g["anos"] if y in cres_br]
        if not ys:
            continue
        r = dict(g)
        r["anosComDado"] = ys
        r["emAndamento"] = pmap[g["pres"]].get("fim") is None or max(g["anos"]) >= datetime.date.today().year
        r["media"], r["acum"] = [round(x, 2) for x in geo_mean([cres_br[y] for y in ys])]
        pcs = [cres_pc[y] for y in ys if y in cres_pc]
        r["mediaPc"] = round(geo_mean(pcs)[0], 2) if len(pcs) == len(ys) else None
        ws = [world[y] for y in ys if y in world]
        r["mundo"] = round(geo_mean(ws)[0], 2) if len(ws) == len(ys) else None
        ls = [lcn[y] for y in ys if y in lcn]
        r["amlat"] = round(geo_mean(ls)[0], 2) if len(ls) == len(ys) else None
        r["anoMelhor"] = max(ys, key=lambda y: cres_br[y])
        r["anoPior"] = min(ys, key=lambda y: cres_br[y])
        res.append(r)
    # anos divididos entre dois presidentes (para a nota da página)
    div = []
    for y, c in sorted(days.items()):
        if y >= 1985 and len(c) > 1:
            parts = sorted(c.items(), key=lambda kv: -kv[1])
            if parts[1][1] > 20:
                div.append({"ano": y, "dias": [[pmap[k]["nome"], v] for k, v in parts]})
    return res, div


def main():
    os.makedirs(OUT, exist_ok=True)
    fontes = load("fontes.json") or {"fontes": {}}
    F = fontes["fontes"]
    codes = [p[0] for p in PAISES]
    ok = True

    # ---- Banco Mundial (séries por país)
    paises_old = load("paises.json")
    try:
        series, wb_upd = {}, None
        for k, (ind, dec) in WB.items():
            d, upd = wb_series(ind, codes)
            wb_upd = max(filter(None, [wb_upd, upd])) if (wb_upd or upd) else None
            for c in codes:
                p = pack(d.get(c, {}), dec)
                if p:
                    series.setdefault(c, {})[k] = p
            print(f"  WB {ind}: {sum(len(v) for v in d.values())} valores")
        imf_upd = None
        try:
            imf_codes = [p[3] for p in PAISES if p[3]]
            back = {p[3]: p[0] for p in PAISES if p[3]}
            im, imf_upd = imf_weo(list(IMF.values()), imf_codes)
            for k, ind in IMF.items():
                for ic, d in im.get(ind, {}).items():
                    p = pack(d, 2 if k != "fatia" else 3)
                    if p:
                        series.setdefault(back[ic], {})[k] = p
            print(f"  FMI WEO ({imf_upd}): ok")
            F["fmi"] = {"nome": "FMI — World Economic Outlook (WEO)", "url": "https://www.imf.org/en/Publications/WEO",
                        "api": "https://api.imf.org/external/sdmx/3.0/data/dataflow/IMF.RES/WEO/", "consultadoEm": TODAY,
                        "usa": "Projeções de crescimento, dívida bruta do governo (% do PIB) e fatia do PIB mundial em PPC"}
        except Exception as e:
            print("  FMI falhou, mantendo dados anteriores:", e)
            if paises_old:
                for c, s in paises_old.get("series", {}).items():
                    for k in IMF:
                        if k in s:
                            series.setdefault(c, {})[k] = s[k]
        paises = {
            "sobre": "Séries anuais. Cada série: i = primeiro ano, v = valores ano a ano (null = sem dado).",
            "geradoEm": TODAY,
            "bancoMundialAtualizado": wb_upd,
            "paises": [{"id": c, "nome": n, "grupo": g} for c, n, g, _ in PAISES],
            "series": series,
        }
        save("paises.json", paises)
        F["bm"] = {"nome": "Banco Mundial — World Development Indicators (WDI)", "url": "https://data.worldbank.org/",
                   "api": "https://api.worldbank.org/v2/", "atualizadoNaFonte": wb_upd, "consultadoEm": TODAY,
                   "indicadores": {k: v[0] for k, v in WB.items()},
                   "usa": "Crescimento do PIB e do PIB por pessoa, PIB por pessoa em PPC, inflação, desemprego e Gini de todos os países"}
    except Exception as e:
        ok = False
        print("ERRO Banco Mundial:", e)
        paises = paises_old
        if not paises:
            raise

    # ---- Brasil oficial
    try:
        pib = bcb(7326)
        try:
            sid = sidra_6784()
        except Exception as e:
            print("  SIDRA falhou:", e)
            sid = {"9810": {}, "9814": {}}
        pres = json.load(open(GOV, encoding="utf-8"))["presidentes"]
        S = paises["series"]
        def unpack(s):
            return {s["i"] + i: v for i, v in enumerate(s["v"]) if v is not None} if s else {}
        cres_pc = unpack(S["BRA"].get("cresPc"))
        world = unpack(S["WLD"].get("cres"))
        lcn = unpack(S["LCN"].get("cres"))
        mand, div = mandatos(pres, pib, cres_pc, world, lcn)
        # conferência IBGE (SIDRA 6784, contas anuais definitivas) x série do BCB
        conf = []
        for y, v in sorted(sid["9810"].items()):
            if y in pib and abs(round(pib[y], 1) - v) >= 0.15:
                conf.append({"ano": y, "bcb": pib[y], "ibge": v})
        brasil = {
            "geradoEm": TODAY,
            "pib": pack(pib, 2),
            "pibPcIbge": pack(sid["9814"], 1),
            "conferencia": {"anosComparados": len(sid["9810"]), "diferencas": conf},
            "mandatos": mand,
            "anosDivididos": div,
            "regra": "Cada ano conta para quem exerceu a Presidência mais dias naquele ano (datas de exercício da página Governo).",
        }
        save("brasil.json", brasil)
        F["bcb"] = {"nome": "Banco Central do Brasil — SGS, série 7326 (PIB, taxa de variação real no ano; fonte primária: IBGE)",
                    "url": "https://www3.bcb.gov.br/sgspub/localizarseries/localizarSeries.do?method=prepararTelaLocalizarSeries",
                    "api": "https://api.bcb.gov.br/dados/serie/bcdata.sgs.7326/dados?formato=json", "consultadoEm": TODAY,
                    "anos": [min(pib), max(pib)]}
        F["ibge"] = {"nome": "IBGE — Contas Nacionais, SIDRA tabela 6784 (PIB e PIB per capita, variação em volume)",
                     "url": "https://sidra.ibge.gov.br/tabela/6784", "consultadoEm": TODAY,
                     "anos": [min(sid["9810"]), max(sid["9810"])] if sid["9810"] else None}
    except Exception as e:
        ok = False
        print("ERRO Brasil oficial:", e)

    # ---- Ranking entre países (todos os países do Banco Mundial, sem agregados)
    try:
        names = wb_countries()
        rk = {"geradoEm": TODAY}
        for k, ind in (("pcPpc", "NY.GDP.PCAP.PP.KD"), ("cres", "NY.GDP.MKTP.KD.ZG")):
            j = get(f"https://api.worldbank.org/v2/country/all/indicator/{ind}?format=json&per_page=20000&date=1980:{datetime.date.today().year}")
            by = {}
            for r in j[1] or []:
                c = r["countryiso3code"]
                if c in names and r["value"] is not None:
                    by.setdefault(int(r["date"]), {})[c] = r["value"]
            rows = []
            for y in sorted(by):
                vals = by[y]
                if "BRA" not in vals or len(vals) < 100:
                    continue
                b = vals["BRA"]
                pos = 1 + sum(1 for v in vals.values() if v > b)
                abaixo = sum(1 for v in vals.values() if v < b)
                rows.append([y, pos, len(vals), round(100 * abaixo / (len(vals) - 1), 1)])
            rk[k] = rows
            print(f"  ranking {k}: {len(rows)} anos")
        rk["campos"] = ["ano", "posicao", "paises", "percentualDePaisesAbaixo"]
        save("ranking.json", rk)
    except Exception as e:
        ok = False
        print("ERRO ranking:", e)

    F["presidentes"] = {"nome": "Datas de exercício dos presidentes (página Governo: Biblioteca da Presidência)",
                        "url": "https://alexschimitz.github.io/politica/governo/#presidentes", "consultadoEm": TODAY}
    fontes["geradoEm"] = TODAY
    save("fontes.json", fontes)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
