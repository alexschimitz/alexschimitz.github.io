#!/usr/bin/env python3
"""Dados extras via API do Portal da Transparência (CGU).

Só roda se a variável de ambiente PORTAL_TRANSPARENCIA_KEY estiver definida
(chave gratuita, cabeçalho "chave-api-dados"). Sem a chave, sai sem erro.
A chave nunca vai para o site: aqui só se gravam totais já calculados.

Grava em politica/data/gastos/api/:
  presidencia-por-orgao.json  execução da Presidência por órgão segundo o Portal (empenhado,
                            liquidado, pago), por ano — visão do Portal, que difere do SIOP

  viagens-presidencia.json  (opcional, PORTAL_VIAGENS=1) viagens da Presidência mês a mês

Emendas, cartão corporativo e viagens usam os downloads em massa (sem chave), que trazem
tudo de uma vez (fetch_emendas.py, fetch_cartao.py, fetch_viagens.py).
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(__file__))
from common import r0, read_json, today, update_sources, write_json  # noqa: E402

KEY = os.environ.get("PORTAL_TRANSPARENCIA_KEY", "").strip()
BASE = "https://api.portaldatransparencia.gov.br/api-de-dados/"
BUDGET_S = float(os.environ.get("PORTAL_BUDGET_S", "900"))
DESDE = os.environ.get("PORTAL_VIAGENS_DESDE", "2015-01")
ORGAOS_VIAGEM = ("20000", "20101")  # unidades de vínculo direto + Presidência da República
T0 = time.time()
REQS = 0


class Budget(Exception):
    pass


def delay():
    # limite documentado: ~90 req/min de dia; bem mais entre 0h e 6h (Brasília)
    h = datetime.now(timezone(timedelta(hours=-3))).hour
    return float(os.environ.get("PORTAL_DELAY", "0.3" if h < 6 else "0.75"))


def num(v):
    if v is None:
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def get(path, params):
    global REQS
    if time.time() - T0 > BUDGET_S:
        raise Budget()
    url = BASE + path + "?" + urllib.parse.urlencode(params)
    for tent in range(5):
        req = urllib.request.Request(url, headers={"chave-api-dados": KEY, "Accept": "application/json",
                                                   "User-Agent": "alexschimitz.github.io/politica (dados abertos)"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                REQS += 1
                time.sleep(delay())
                return json.loads(r.read().decode("utf-8") or "[]")
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                raise SystemExit(f"Portal API recusou a chave ({e.code}).")
            if e.code == 429 or e.code >= 500:
                time.sleep(20 * (tent + 1))
                continue
            raise
        except (urllib.error.URLError, TimeoutError):
            time.sleep(10 * (tent + 1))
    raise RuntimeError("falha repetida em " + path)


def paged(path, params, size=15):
    p = 1
    while True:
        rows = get(path, dict(params, pagina=p))
        yield from rows
        if len(rows) < size:
            return
        p += 1


def month_end(d):
    return (d.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)


def viagens_mes(d):
    """Viagens com ida no mês d (volta no mesmo mês ou no seguinte), sem repetir."""
    f = lambda x: x.strftime("%d/%m/%Y")  # noqa: E731
    fim = month_end(d)
    nxt = fim + timedelta(days=1)
    seen = {}
    for org in ORGAOS_VIAGEM:
        for r_ini, r_fim in ((d, fim), (nxt, month_end(nxt))):
            for v in paged("viagens", {"dataIdaDe": f(d), "dataIdaAte": f(fim), "dataRetornoDe": f(r_ini),
                                       "dataRetornoAte": f(r_fim), "codigoOrgao": org}):
                seen[v.get("id")] = v
    out = {"n": 0, "diarias": 0.0, "passagens": 0.0, "total": 0.0, "devolucao": 0.0,
           "sig_n": 0, "sig_v": 0.0, "int_n": 0, "int_v": 0.0}
    for v in seen.values():
        if (v.get("situacao") or "").lower().startswith("n"):  # "Não realizada"
            continue
        tot = num(v.get("valorTotalViagem"))
        out["n"] += 1
        out["diarias"] += num(v.get("valorTotalDiarias"))
        out["passagens"] += num(v.get("valorTotalPassagem"))
        out["devolucao"] += num(v.get("valorTotalDevolucao"))
        out["total"] += tot
        if "sigilo" in json.dumps(v.get("beneficiario") or {}, ensure_ascii=False).lower():
            out["sig_n"] += 1; out["sig_v"] += tot
        if (v.get("tipoViagem") or "").lower().startswith("internac"):
            out["int_n"] += 1; out["int_v"] += tot
    return {k: (r0(x) if isinstance(x, float) else x) for k, x in out.items()}


def viagens():
    rel = "api/viagens-presidencia.json"
    cur = read_json(rel, {}) or {}
    meses = cur.get("meses", {})
    y0, m0 = map(int, DESDE.split("-"))
    d = date(y0, m0, 1)
    last = (date.today().replace(day=1) - timedelta(days=1)).replace(day=1)
    todos = []
    while d <= last:
        todos.append(d)
        d = month_end(d) + timedelta(days=1)
    recentes = todos[-3:]
    fila = recentes[::-1] + [x for x in reversed(todos[:-3]) if x.strftime("%Y%m") not in meses]
    feitos = 0
    try:
        for d in fila:
            meses[d.strftime("%Y%m")] = viagens_mes(d)
            feitos += 1
            print(f"  viagens Presidência {d:%m/%Y}: {meses[d.strftime('%Y%m')]['n']}", flush=True)
    except Budget:
        print("  limite de tempo atingido; continua na próxima execução", flush=True)
    finally:
        if feitos:
            write_json(rel, {"orgaos": list(ORGAOS_VIAGEM), "desde": DESDE,
                             "meses": dict(sorted(meses.items())),
                             "faltando": [x.strftime("%Y%m") for x in todos if x.strftime("%Y%m") not in meses]})
    return meses


def por_orgao():
    rel = "api/presidencia-por-orgao.json"
    cur = read_json(rel, {}) or {}
    anos = cur.get("anos", {})
    y = date.today().year
    for ano in range(2014, y + 1):
        if str(ano) in anos and ano < y - 1:
            continue
        rows = get("despesas/por-orgao", {"ano": ano, "orgaoSuperior": "20000", "pagina": 1})
        anos[str(ano)] = [[r.get("codigoOrgao"), r.get("orgao"), r0(num(r.get("empenhado"))), r0(num(r.get("liquidado"))),
                           r0(num(r.get("pago")))] for r in rows]
    write_json(rel, {"orgao_superior": "20000", "colunas": ["codigo", "orgao", "empenhado", "liquidado", "pago"],
                     "anos": dict(sorted(anos.items()))})


def main():
    if not KEY:
        print("PORTAL_TRANSPARENCIA_KEY não definida: pulando dados extras da API (sem erro).")
        return
    feito = []
    tarefas = [("presidencia_por_orgao", por_orgao)]
    # As viagens de todo o governo já vêm do download anual (fetch_viagens.py). A consulta mês a mês
    # pela API é lenta (15 registros por página); fica disponível com PORTAL_VIAGENS=1.
    if os.environ.get("PORTAL_VIAGENS") == "1":
        tarefas.append(("viagens_presidencia", viagens))
    for nome, fn in tarefas:
        try:
            fn(); feito.append(nome)
        except SystemExit:
            raise
        except Budget:
            print(f"  {nome}: limite de tempo", flush=True)
        except Exception as e:  # um endpoint com problema não derruba os outros
            print(f"  erro em {nome}: {e}", flush=True)
    v = read_json("api/viagens-presidencia.json", {}) or {}
    ms = sorted(v.get("meses", {}))
    update_sources("portal_api", {
        "nome": "Portal da Transparência (CGU) — API de dados (despesas da Presidência por órgão)",
        "url": "https://api.portaldatransparencia.gov.br/swagger-ui/index.html",
        "cobertura": "2014–" + str(date.today().year)
                     + (f"; viagens da Presidência {ms[0][:4]}-{ms[0][4:]} a {ms[-1][:4]}-{ms[-1][4:]}" if ms else ""),
        "coletado_em": today(), "partes": feito,
    })
    print(f"ok Portal API: {REQS} consultas em {time.time() - T0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
