#!/usr/bin/env python3
"""Valida as avaliações curadas à mão e gera politica/data/planos/promessas/index.json.

Fonte da verdade: politica/data/planos/promessas/{ano}-{UF}-{sq}.json (um arquivo por plano
de governo avaliado, editado à mão — ver politica/data/planos/README.md).
Este script NÃO avalia nada sozinho: só confere o formato, conta os status e junta tudo
num único arquivo para a página. Sai com erro se algum item estiver incompleto.

Uso: python3 scripts/politica/planos/build_promessas.py
"""
import glob
import json
import os
import re
import sys
from collections import Counter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
DIR = os.path.join(ROOT, "politica", "data", "planos", "promessas")
STATUS = ["cumprida", "parcialmente", "em_andamento", "nao_cumprida", "sem_como_verificar"]
CARGOS = {"presidente", "governador", "prefeito"}
DATA = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def erro(msg):
    print("ERRO:", msg, file=sys.stderr)
    erro.n += 1
erro.n = 0


def valida(fn, d):
    for k in ("ano", "cargo", "uf", "sq", "pessoa", "mandato", "plano", "revisado", "resumo", "promessas"):
        if k not in d:
            erro(f"{fn}: falta '{k}'")
            return
    if d["cargo"] not in CARGOS:
        erro(f"{fn}: cargo inválido {d['cargo']}")
    esperado = f"{d['ano']}-{d['uf']}-{d['sq']}.json"
    if os.path.basename(fn) != esperado:
        erro(f"{fn}: nome do arquivo deveria ser {esperado}")
    if not (5 <= len(d["resumo"]) <= 8):
        erro(f"{fn}: resumo deve ter de 5 a 8 itens (tem {len(d['resumo'])})")
    for r in d["resumo"]:
        if not r.get("t") or not isinstance(r.get("p"), int):
            erro(f"{fn}: item de resumo sem texto ou página")
    ids = set()
    for p in d["promessas"]:
        pid = p.get("id")
        if not pid or pid in ids:
            erro(f"{fn}: id vazio ou repetido {pid}")
        ids.add(pid)
        for k in ("tema", "promessa", "trecho", "explicacao"):
            if not (p.get(k) or "").strip():
                erro(f"{fn} {pid}: '{k}' vazio")
        if not isinstance(p.get("pagina"), int) or p["pagina"] < 1:
            erro(f"{fn} {pid}: página inválida")
        if p.get("status") not in STATUS:
            erro(f"{fn} {pid}: status inválido {p.get('status')}")
        if not DATA.match(p.get("revisado", "")):
            erro(f"{fn} {pid}: data de revisão inválida")
        ev = p.get("evidencias") or []
        if not ev:
            erro(f"{fn} {pid}: sem evidência (toda avaliação precisa de fonte)")
        for e in ev:
            if not e.get("titulo") or not str(e.get("url", "")).startswith("https://"):
                erro(f"{fn} {pid}: evidência sem título ou URL https")


def main():
    planos = []
    total = Counter()
    for fn in sorted(glob.glob(os.path.join(DIR, "[0-9]*.json"))):
        with open(fn, encoding="utf-8") as f:
            d = json.load(f)
        valida(fn, d)
        c = Counter(p["status"] for p in d["promessas"])
        total.update(c)
        d["contagem"] = {s: c.get(s, 0) for s in STATUS}
        planos.append(d)
    if erro.n:
        sys.exit(f"{erro.n} erro(s); index.json não foi gerado")
    ordem = {"presidente": 0, "governador": 1, "prefeito": 2}
    planos.sort(key=lambda d: (-d["ano"], ordem[d["cargo"]], d["uf"]))
    out = {
        "_sobre": "Avaliações de promessas dos planos de governo entregues ao TSE. Curadoria manual; cada item cita o trecho, a página e uma fonte oficial.",
        "status": {
            "cumprida": "Cumprida",
            "parcialmente": "Parcialmente",
            "em_andamento": "Em andamento",
            "nao_cumprida": "Não cumprida",
            "sem_como_verificar": "Sem como verificar",
        },
        "revisado": max(d["revisado"] for d in planos) if planos else None,
        "totais": {s: total.get(s, 0) for s in STATUS},
        "planos": planos,
    }
    with open(os.path.join(DIR, "index.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(planos)} planos, {sum(total.values())} promessas:", dict(total))
    por_politico({planoKeyOf(d) for d in planos})


def planoKeyOf(d):
    return f"{d['ano']}-{d['uf']}-{d['sq']}"


def por_politico(com_promessas):
    """Índice pessoa -> planos (para o link no perfil de políticos). Fatias por 2 letras do código."""
    base = os.path.join(ROOT, "politica", "data", "planos")
    try:
        with open(os.path.join(base, "gerais.json"), encoding="utf-8") as f:
            ger = json.load(f)
    except FileNotFoundError:
        print("gerais.json ausente; por_politico não gerado")
        return
    idx = {}
    def add(pid, item):
        if pid:
            idx.setdefault(pid, []).append(item)
    for r in ger["rows"]:  # ano,cargo,uf,nome_urna,nome,partido,numero,resultado,sq,arquivos,kb,id
        uf = "BR" if r[1] == 1 else r[2]
        k = f"{r[0]}-{uf}-{r[8]}"
        add(r[11], [r[0], r[1], uf, "Brasil" if r[1] == 1 else r[2], r[8], 1 if r[9] else 0, r[7], k if k in com_promessas else ""])
    for fn in sorted(glob.glob(os.path.join(base, "pref", "[0-9]*", "*.json"))):
        with open(fn, encoding="utf-8") as f:
            d = json.load(f)
        for r in d["rows"]:  # ue,ibge,municipio,nome_urna,partido,numero,resultado,sq,arquivos,kb,id
            k = f"{d['ano']}-{d['uf']}-{r[7]}"
            add(r[10], [d["ano"], 11, r[0], f"{r[2]} ({d['uf']})", r[7], 1 if r[8] else 0, r[6], k if k in com_promessas else ""])
    out = os.path.join(base, "por_politico")
    os.makedirs(out, exist_ok=True)
    for old in glob.glob(os.path.join(out, "*.json")):
        os.remove(old)
    shards = {}
    for pid, lst in idx.items():
        lst.sort(key=lambda x: (-x[0], x[1]))
        shards.setdefault(pid[:2], {})[pid] = lst
    for sh, d in shards.items():
        with open(os.path.join(out, sh + ".json"), "w", encoding="utf-8") as f:
            json.dump({"d": ger.get("divulga", {}), "p": d}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"por_politico: {len(idx)} pessoas em {len(shards)} arquivos")


if __name__ == "__main__":
    main()
