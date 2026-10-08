#!/usr/bin/env python3
"""Benefícios federais pagos aos moradores de cada cidade (Portal da Transparência / CGU).

Programas (valor pago no mês e quantidade de beneficiados, por município):
  - transferência de renda ("rf"): Bolsa Família (até 10/2021), Auxílio Brasil (11/2021 a 02/2023),
    Novo Bolsa Família (03/2023 em diante);
  - BPC ("bpc"): Benefício de Prestação Continuada (idosos e pessoas com deficiência de baixa renda).

Grava politica/data/mapa/fed/{UF}.json:
  {"fonte": ..., "m": {ibge: {"rf": {"2025": {"v": [12 valores], "q": [12 quantidades]}}, "bpc": {...}}}}
  null = mês ainda não consultado; 0 = consultado e sem pagamento.
O próprio arquivo guarda o progresso (retomável em qualquer máquina).

Precisa da chave da API em PORTAL_TRANSPARENCIA_KEY (cabeçalho chave-api-dados). A chave nunca é gravada.
Limite da API: ~90 requisições/min de dia, mais à noite (00h–06h). Use --rpm para ajustar.
Fonte: https://api.portaldatransparencia.gov.br/swagger-ui/index.html
"""
import argparse, datetime as dt, json, os, sys, time, urllib.request, urllib.error

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
D = os.path.join(ROOT, "politica", "data", "mapa")
API = "https://api.portaldatransparencia.gov.br/api-de-dados/"
FIRST = {"rf": 2004, "bpc": 2004}
FONTE = {"nome": "Portal da Transparência (CGU) — API de dados", "url": "https://portaldatransparencia.gov.br/beneficios",
         "api": "https://api.portaldatransparencia.gov.br/swagger-ui/index.html"}

def endpoint(prog, y, m):
    if prog == "bpc":
        return "bpc-por-municipio"
    ym = y * 100 + m
    if ym <= 202110:
        return "bolsa-familia-por-municipio"
    if ym <= 202302:
        return "auxilio-brasil-por-municipio"
    return "novo-bolsa-familia-por-municipio"

class Client:
    def __init__(self, key, rpm):
        self.key = key; self.gap = 60.0 / rpm; self.last = 0.0; self.n = 0
    def get(self, path):
        for attempt in range(6):
            wait = self.gap - (time.time() - self.last)
            if wait > 0:
                time.sleep(wait)
            self.last = time.time()
            req = urllib.request.Request(API + path, headers={"chave-api-dados": self.key, "Accept": "application/json",
                                                               "User-Agent": "alexschimitz.github.io (mapa)"})
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    self.n += 1
                    return json.loads(r.read() or b"[]")
            except urllib.error.HTTPError as e:
                if e.code in (429, 503, 502, 504):
                    time.sleep(30 * (attempt + 1)); continue
                raise
            except (urllib.error.URLError, TimeoutError):
                time.sleep(10 * (attempt + 1))
        raise RuntimeError("falhou: " + path.split("?")[0])

def fetch_month(cl, prog, ibge, y, m):
    ep = endpoint(prog, y, m)
    rows = cl.get("%s?mesAno=%d%02d&codigoIbge=%d&pagina=1" % (ep, y, m, ibge))
    v = sum(float(r.get("valor") or 0) for r in rows)
    q = sum(int(r.get("quantidadeBeneficiados") or 0) for r in rows)
    return round(v), q

def latest_month(cl, prog):
    """último mês já publicado (testa São Paulo, do mês atual para trás)."""
    d = dt.date.today().replace(day=1)
    for _ in range(8):
        v, q = fetch_month(cl, prog, 3550308, d.year, d.month)
        if v > 0:
            return d.year, d.month
        d = (d - dt.timedelta(days=1)).replace(day=1)
    return None

def jload(p):
    try:
        return json.load(open(p, encoding="utf-8"))
    except FileNotFoundError:
        return None

def jsave(p, d):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(d, fh, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    os.replace(tmp, p)

def months_back(y, m, n):
    out = []
    for _ in range(n):
        out.append((y, m))
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--minutes", type=float, default=40)
    ap.add_argument("--rpm", type=float, default=0, help="requisições por minuto (0 = automático: 60 de dia, 300 de 0h a 6h em Brasília)")
    ap.add_argument("--recheck", type=int, default=2, help="reconsulta os N meses mais recentes já gravados (retificações)")
    args = ap.parse_args()
    key = os.environ.get("PORTAL_TRANSPARENCIA_KEY")
    if not key:
        print("PORTAL_TRANSPARENCIA_KEY ausente; nada a fazer.", file=sys.stderr); return
    hour = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=3)).hour
    rpm = args.rpm or (300 if hour < 6 else 60)
    cl = Client(key, rpm)
    deadline = time.time() + args.minutes * 60
    base = jload(os.path.join(D, "municipios.json"))
    munis = sorted(base["municipios"], key=lambda m: (-(m[4] if len(m) > 4 else 0), -(m[3] or 0)))
    docs = {}
    def doc(uf):
        if uf not in docs:
            docs[uf] = jload(os.path.join(D, "fed", uf + ".json")) or {"uf": uf, "fonte": FONTE, "m": {}}
            docs[uf]["fonte"] = FONTE
        return docs[uf]
    dirty = set()
    for u in base["ufs"]:      # garante um arquivo por UF (a página não pede arquivo inexistente)
        if not os.path.exists(os.path.join(D, "fed", u["uf"] + ".json")):
            doc(u["uf"]); dirty.add(u["uf"])
    plan = []
    for prog in ("rf", "bpc"):
        lm = latest_month(cl, prog)
        if not lm:
            print("sem mês publicado para", prog, file=sys.stderr); continue
        allm = months_back(lm[0], lm[1], (lm[0] - FIRST[prog]) * 12 + lm[1])
        plan.append((prog, allm[:12], True))       # últimos 12 meses primeiro
        plan.append((prog, allm[12:], False))      # depois o histórico, do mais recente para trás
    changed = 0; n0 = cl.n; last_save = time.time()
    try:
        for prog, mlist, recent in plan:
            for (y, m) in mlist:
                for mm in munis:
                    if time.time() > deadline:
                        raise TimeoutError
                    ibge, uf = mm[0], mm[2]
                    dd = doc(uf)["m"].setdefault(str(ibge), {}).setdefault(prog, {})
                    yr = dd.setdefault(str(y), {"v": [None] * 12, "q": [None] * 12})
                    cur = yr["v"][m - 1]
                    redo = recent and (y, m) in mlist[:args.recheck] and cur is not None and yr.get("c", {}).get(str(m)) != dt.date.today().isoformat()[:7]
                    if cur is not None and not redo:
                        continue
                    try:
                        v, q = fetch_month(cl, prog, ibge, y, m)
                    except Exception as e:
                        print("erro", prog, ibge, y, m, e, file=sys.stderr); continue
                    if redo:
                        yr.setdefault("c", {})[str(m)] = dt.date.today().isoformat()[:7]
                    if yr["v"][m - 1] != v or yr["q"][m - 1] != q:
                        yr["v"][m - 1] = v; yr["q"][m - 1] = q; changed += 1; dirty.add(uf)
                    elif redo:
                        dirty.add(uf)
                    if time.time() - last_save > 120:
                        for u in dirty:
                            jsave(os.path.join(D, "fed", u + ".json"), docs[u])
                        dirty.clear(); last_save = time.time()
                        print(dt.datetime.now().strftime("%H:%M:%S"), "req", cl.n - n0, "mudanças", changed, "agora", prog, y, m, flush=True)
    except TimeoutError:
        pass
    for u in dirty:
        jsave(os.path.join(D, "fed", u + ".json"), docs[u])
    print("fim: requisições", cl.n - n0, "mudanças", changed, "rpm", rpm)

if __name__ == "__main__":
    main()
