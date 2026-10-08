#!/usr/bin/env python3
"""Baixa as Contas Anuais (DCA) do SICONFI/Tesouro Nacional e grava um resumo
compacto por ente (estado ou município) em politica/data/mapa/fin/.

API pública e sem chave: https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca
Regra da API: no máximo 1 requisição por segundo. Respeitamos isso (1,1 s).

Uso:
  python3 scripts/politica/mapa/siconfi_sync.py --minutes 50
Retoma de onde parou: o que já está nos arquivos não é baixado de novo
(exceto anos recentes sem entrega, que são reconferidos a cada 30 dias).
"""
import argparse, datetime as dt, json, os, re, sys, time, urllib.request, urllib.parse

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUT = os.path.join(ROOT, "politica", "data", "mapa", "fin")
API = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca"
FIRST_YEAR = 2013
UA = "alexschimitz.github.io politica/mapa (dados abertos; 1 req/s)"

def today():
    return dt.date.today().isoformat()

def last_year():
    # DCA do ano X é entregue até 30/abr de X+1
    t = dt.date.today()
    return t.year - 1 if t.month >= 5 else t.year - 2

_last = [0.0]
def get(params, tries=4):
    url = API + "?" + urllib.parse.urlencode(params)
    for k in range(tries):
        wait = 1.1 - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # noqa
            if k == tries - 1:
                raise
            time.sleep(5 * (k + 1))

def fetch_all(ente, year):
    items, offset = [], 0
    while True:
        p = {"an_exercicio": year, "id_ente": ente}
        if offset:
            p["offset"] = offset
        d = get(p)
        items += d.get("items", [])
        if not d.get("hasMore"):
            return items
        offset += d.get("limit", 5000)

NUM = re.compile(r"^(\d)\.(\d)\.(\d)\.(\d)")

def core(items):
    """Extrai os indicadores principais de uma DCA (qualquer formato 2013+)."""
    if not items:
        return None
    rb = {}; rd = {}; f = {}; out = {}
    tot_e = None; tot_p = None
    pop = None
    for i in items:
        an = i.get("anexo", ""); col = i.get("coluna", "") or ""; cod = i.get("cod_conta", "") or ""
        conta = i.get("conta", "") or ""; v = i.get("valor") or 0
        if pop is None and i.get("populacao"):
            pop = i["populacao"]
        if an.endswith("I-C"):
            if not cod.startswith("RO"):
                continue
            m = NUM.match(cod[2:])
            if not m:
                continue
            key = cod[2:]
            if "Dedu" not in col and ("Bruta" in col or "Realizad" in col):
                rb[key] = rb.get(key, 0) + v
            elif "Dedu" in col:
                rd[key] = rd.get(key, 0) + v
        elif an.endswith("I-E"):
            if "Empenhad" not in col and "Pagas" not in col:
                continue
            c = conta.strip()
            low = c.lower()
            if low.startswith("despesas exceto") or low.startswith("despesas (exceto") or low.startswith("total geral da despesa"):
                if "Empenhad" in col and (tot_e is None or low.startswith("despesas")):
                    tot_e = v
                if "Pagas" in col and (tot_p is None or low.startswith("despesas")):
                    tot_p = v
                continue
            m = re.match(r"^(\d\d) - ", c)
            if m and "Empenhad" in col:
                f[m.group(1)] = f.get(m.group(1), 0) + v
        elif an.endswith("I-D"):
            if "Empenhad" not in col or not cod.startswith("DO"):
                continue
            k = cod[2:]
            for pre, name in (("3.1.00.00.00", "pe"), ("3.2.00.00.00", "ju"), ("4.4.00.00.00", "inv"), ("4.6.00.00.00", "am"), ("3.0.00.00.00", "dc"), ("4.0.00.00.00", "dk")):
                if k.startswith(pre) and re.match(r"^\d\.\d\.00\.00\.00(\.00)?$", k):
                    out[name] = out.get(name, 0) + v
        elif an.endswith("I-AB"):
            low = conta.lower()
            if re.search(r"empr[ée]stimos e financiamentos a (curto|longo) prazo", low) and re.match(r"^P2\.[12]\.2\.0\.0\.00\.00$", cod):
                out["div"] = out.get("div", 0) + v
            elif re.match(r"^P1\.1\.1\.0\.0\.00\.00$", cod):
                out["cx"] = v
    def net(prefix_re):
        s = 0.0; found = False
        for k, v in rb.items():
            if re.match(prefix_re, k):
                s += v - rd.get(k, 0); found = True
        return s if found else None
    rec1 = net(r"^1\.0\.0\.0\.00"); rec2 = net(r"^2\.0\.0\.0\.00")
    if rec1 is not None or rec2 is not None:
        out["r"] = (rec1 or 0) + (rec2 or 0)
    t = net(r"^1\.1\.0\.0\.00")
    if t is not None:
        out["trib"] = t
    # Transferências: formato novo (2018+) 1.7.1 União / 1.7.2 Estados;
    # formato antigo (2013-2017) 1.7.2.1 União / 1.7.2.2 Estados.
    new = any(re.match(r"^1\.7\.1\.0\.00", k) for k in rb)
    if new:
        u = (net(r"^1\.7\.1\.0\.00") or 0) + (net(r"^2\.4\.1\.0\.00") or 0)
        e = (net(r"^1\.7\.2\.0\.00") or 0) + (net(r"^2\.4\.2\.0\.00") or 0)
    else:
        u = (net(r"^1\.7\.2\.1\.00") or 0) + (net(r"^2\.4\.2\.1\.00") or 0)
        e = (net(r"^1\.7\.2\.2\.00") or 0) + (net(r"^2\.4\.2\.2\.00") or 0)
    if u: out["tu"] = u
    if e: out["te"] = e
    oc = net(r"^2\.1\.0\.0\.00")
    if oc: out["oc"] = oc
    if tot_e is not None: out["d"] = tot_e
    if tot_p is not None: out["dpg"] = tot_p
    if f: out["f"] = {k: round(v) for k, v in sorted(f.items())}
    if pop: out["pop"] = int(pop)
    for k in list(out):
        if k not in ("f", "pop"):
            out[k] = round(out[k])
    if "r" not in out and "d" not in out:
        return None
    return out

def path_for(ente, uf):
    if len(str(ente)) == 2:
        return os.path.join(OUT, "uf", uf + ".json")
    return os.path.join(OUT, "m", uf, str(ente) + ".json")

def load(p):
    try:
        with open(p, encoding="utf-8") as fh:
            return json.load(fh)
    except FileNotFoundError:
        return None

def save(p, d):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(d, fh, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    os.replace(tmp, p)

def queue(entes, years):
    """entes: lista (id, uf, nome) já na ordem de prioridade."""
    lst = []
    for y in years:
        for e in entes:
            lst.append((e, y))
    return lst

STATE_PATH = os.environ.get("SICONFI_STATE", os.path.join(ROOT, "..", "pol-mapa-raw", "siconfi_state.json"))
STATE = {}

def needs(doc, y, key):
    if doc is None:
        return True
    a = doc.get("anos", {}); v = STATE.get(key, {})
    ys = str(y)
    if ys in a and a[ys]:
        # reconfere o último ano a cada 30 dias (retificações)
        if ys not in v:
            # sem registro de conferência (ex.: primeira execução no GitHub Actions): conta a partir de hoje
            STATE.setdefault(key, {})[ys] = today()
            return False
        if y >= last_year() and v[ys] < (dt.date.today() - dt.timedelta(days=30)).isoformat():
            return True
        return False
    if ys in a and not a[ys]:
        # sem entrega: reconfere anos recentes a cada 30 dias, antigos a cada 180
        lim = 30 if y >= last_year() - 1 else 180
        return v.get(ys, "") < (dt.date.today() - dt.timedelta(days=lim)).isoformat()
    return True

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--minutes", type=float, default=50)
    ap.add_argument("--only", default="", help="estados|capitais|municipios")
    ap.add_argument("--years", default="")
    args = ap.parse_args()
    meta = load(os.path.join(ROOT, "politica", "data", "mapa", "municipios.json"))
    if not meta:
        print("rode build_base.py antes", file=sys.stderr); sys.exit(1)
    ufs = meta["ufs"]; munis = meta["municipios"]
    ly = last_year()
    years_all = list(range(ly, FIRST_YEAR - 1, -1))
    if args.years:
        a, b = args.years.split("-")
        years_all = list(range(int(b), int(a) - 1, -1))
    estados = [(u["ibge"], u["uf"]) for u in ufs]
    # Brasília (5300108) não é município no SICONFI: as contas do DF estão no ente 53
    munis = [m for m in munis if m[0] != 5300108]
    caps = [(m[0], m[2]) for m in munis if len(m) > 4 and m[4] == 1]
    others = sorted([m for m in munis if not (len(m) > 4 and m[4] == 1)], key=lambda m: -(m[3] or 0))
    others = [(m[0], m[2]) for m in others]
    plan = []
    if args.only in ("", "estados"):
        plan += queue(estados, years_all)
    if args.only in ("", "capitais"):
        plan += queue(caps, years_all)
    if args.only in ("", "municipios"):
        # ano completo mais recente primeiro (ly-1), depois ly, depois o resto
        order = [ly - 1, ly] + [y for y in years_all if y not in (ly, ly - 1)]
        order = [y for y in order if y in years_all]
        plan += queue(others, order)
    global STATE
    STATE = load(STATE_PATH) or {}
    deadline = time.time() + args.minutes * 60
    n = changed = 0
    cache = {}
    for (ente, uf), y in plan:
        if time.time() > deadline:
            break
        p = path_for(ente, uf)
        doc = cache.get(p) or load(p)
        key = str(ente)
        if not needs(doc, y, key):
            continue
        try:
            items = fetch_all(ente, y)
        except Exception as e:
            print("erro", ente, y, e, file=sys.stderr)
            continue
        n += 1
        c = core(items)
        if doc is None:
            doc = {"id": ente, "uf": uf, "fonte": API, "anos": {}}
        old = doc["anos"].get(str(y))
        doc["anos"][str(y)] = c or 0
        STATE.setdefault(key, {})[str(y)] = today()
        doc["anos"] = dict(sorted(doc["anos"].items()))
        if old != (c or 0):
            changed += 1
        if old != (c or 0):
            save(p, doc)
        cache[p] = doc
        if n % 50 == 0:
            save(STATE_PATH, STATE)
        if n % 100 == 0:
            print(dt.datetime.now().strftime("%H:%M:%S"), "requisições", n, "mudanças", changed, "último", ente, y, flush=True)
    save(STATE_PATH, STATE)
    print("fim: requisições", n, "mudanças", changed)

if __name__ == "__main__":
    main()
