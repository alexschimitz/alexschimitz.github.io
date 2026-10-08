#!/usr/bin/env python3
"""Dados extras via API do Portal da Transparência (CGU).

Só roda se a variável de ambiente PORTAL_TRANSPARENCIA_KEY estiver definida
(chave gratuita em https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email).
Sem a chave, sai sem erro e sem mexer em nada.

O que a chave acrescenta (gravado em politica/data/gastos/api/):
  - emendas/{ano}.json   emendas parlamentares por autor, área e local (anos recentes)
  - cartao-presidencia.json  cartão corporativo da Presidência (órgão 20000) mês a mês,
                             sem depender dos downloads em massa (que têm captcha)
  - viagens-presidencia.json viagens a serviço pagas pela Presidência (diárias e passagens)
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(__file__))
from common import r0, today, update_sources, write_json  # noqa: E402

KEY = os.environ.get("PORTAL_TRANSPARENCIA_KEY", "").strip()
BASE = "https://api.portaldatransparencia.gov.br/api-de-dados/"
DELAY = float(os.environ.get("PORTAL_DELAY", "0.8"))  # limite oficial: 90 req/min (dia)
MAX_PAGES = int(os.environ.get("PORTAL_MAX_PAGES", "300"))
API_OUT = "api"


def num(v):
    if v is None:
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace("R$", "").strip()
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def get(path, params):
    url = BASE + path + "?" + urllib.parse.urlencode(params)
    for tent in range(4):
        req = urllib.request.Request(url, headers={"chave-api-dados": KEY, "Accept": "application/json",
                                                   "User-Agent": "alexschimitz.github.io/politica (dados abertos)"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                time.sleep(DELAY)
                return json.loads(r.read().decode("utf-8") or "[]")
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                raise SystemExit(f"Portal API recusou a chave ({e.code}).")
            if e.code == 429 or e.code >= 500:
                time.sleep(15 * (tent + 1))
                continue
            raise
        except Exception:
            time.sleep(10 * (tent + 1))
    raise RuntimeError("falha em " + url)


def paged(path, params):
    for p in range(1, MAX_PAGES + 1):
        rows = get(path, dict(params, pagina=p))
        if not rows:
            return
        yield from rows
    print(f"  aviso: {path} parou no limite de {MAX_PAGES} páginas", flush=True)


def emendas(anos):
    for y in anos:
        aut = defaultdict(lambda: [0.0, 0.0, 0.0, 0])
        fun = defaultdict(float)
        loc = defaultdict(float)
        tipo = defaultdict(float)
        n = 0
        for e in paged("emendas", {"ano": y}):
            n += 1
            emp, liq, pag = num(e.get("valorEmpenhado")), num(e.get("valorLiquidado")), num(e.get("valorPago"))
            a = aut[(e.get("nomeAutor") or e.get("autor") or "Sem autor").strip()]
            a[0] += emp; a[1] += liq; a[2] += pag; a[3] += 1
            fun[(e.get("funcao") or "?").strip()] += pag
            loc[(e.get("localidadeDoGasto") or "?").strip()] += pag
            tipo[(e.get("tipoEmenda") or "?").strip()] += pag
        if not n:
            continue
        write_json(os.path.join(API_OUT, "emendas", f"{y}.json"), {
            "ano": y, "emendas": n,
            "colunas_autores": ["autor", "empenhado", "liquidado", "pago", "emendas"],
            "autores": sorted([[k, r0(v[0]), r0(v[1]), r0(v[2]), v[3]] for k, v in aut.items()], key=lambda x: -x[3]),
            "funcao": {k: r0(v) for k, v in sorted(fun.items(), key=lambda x: -x[1])},
            "localidade": {k: r0(v) for k, v in sorted(loc.items(), key=lambda x: -x[1])[:200]},
            "tipo": {k: r0(v) for k, v in tipo.items()},
        })
        print(f"  emendas {y}: {n} registros", flush=True)


def meses(qtd):
    d = date.today().replace(day=1)
    out = []
    for _ in range(qtd):
        d = (d - timedelta(days=1)).replace(day=1)
        out.append(d)
    return sorted(out)


def cartao_presidencia(qtd):
    res = {}
    for d in meses(qtd):
        m = d.strftime("%m/%Y")
        tot = 0.0; q = 0
        ug = defaultdict(float); est = defaultdict(float)
        for t in paged("cartoes", {"mesExtratoInicio": m, "mesExtratoFim": m, "codigoOrgao": "20000"}):
            v = num(t.get("valorTransacao")); tot += v; q += 1
            ug[((t.get("unidadeGestora") or {}).get("nome") or "?").strip()] += v
            e = t.get("estabelecimento") or {}
            est[(e.get("nome") or e.get("razaoSocialReceita") or "Sem informação").strip()] += v
        res[d.strftime("%Y%m")] = {"v": r0(tot), "q": q,
                                   "ug": {k: r0(v) for k, v in sorted(ug.items(), key=lambda x: -x[1])},
                                   "estab_top": [[k, r0(v)] for k, v in sorted(est.items(), key=lambda x: -x[1])[:15]]}
        print(f"  cartão Presidência {m}: R$ {tot:,.2f} em {q} transações", flush=True)
    write_json(os.path.join(API_OUT, "cartao-presidencia.json"), {"orgao": "20000", "meses": res})


def viagens_presidencia(qtd):
    res = {}
    for d in meses(qtd):
        fim = (d.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        f = lambda x: x.strftime("%d/%m/%Y")  # noqa: E731
        tot = defaultdict(float); q = 0
        for v in paged("viagens", {"dataIdaDe": f(d), "dataIdaAte": f(fim), "dataRetornoDe": f(d),
                                   "dataRetornoAte": f(fim + timedelta(days=60)), "codigoOrgao": "20000"}):
            q += 1
            for k in ("valorTotalDiarias", "valorTotalPassagem", "valorTotalViagem", "valorTotalDevolucao"):
                tot[k] += num(v.get(k))
        res[d.strftime("%Y%m")] = {"viagens": q, **{k: r0(x) for k, x in tot.items()}}
        print(f"  viagens Presidência {d:%m/%Y}: {q}", flush=True)
    write_json(os.path.join(API_OUT, "viagens-presidencia.json"), {"orgao": "20000", "meses": res})


def main():
    if not KEY:
        print("PORTAL_TRANSPARENCIA_KEY não definida: pulando dados extras da API (sem erro).")
        return
    y = date.today().year
    anos = [int(a) for a in os.environ.get("PORTAL_EMENDAS_ANOS", f"{y - 1},{y}").split(",") if a.strip()]
    qtd = int(os.environ.get("PORTAL_MESES", "12"))
    feito = []
    for nome, fn in (("emendas", lambda: emendas(anos)), ("cartao", lambda: cartao_presidencia(qtd)),
                     ("viagens", lambda: viagens_presidencia(qtd))):
        try:
            fn(); feito.append(nome)
        except SystemExit:
            raise
        except Exception as e:  # um endpoint com problema não derruba os outros
            print(f"  erro em {nome}: {e}", flush=True)
    update_sources("portal_api", {
        "nome": "Portal da Transparência (CGU) - API de dados",
        "url": "https://api.portaldatransparencia.gov.br/swagger-ui/index.html",
        "cobertura": f"emendas {anos}; cartão e viagens da Presidência, últimos {qtd} meses",
        "coletado_em": today(), "partes": feito,
    })


if __name__ == "__main__":
    main()
