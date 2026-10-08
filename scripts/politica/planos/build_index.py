#!/usr/bin/env python3
"""Índice dos planos de governo (propostas de governo) registrados no TSE.

Gera, a partir dos dados abertos do TSE:
  politica/data/planos/gerais.json         presidente e governador, 2010–2026 (todas as candidaturas)
  politica/data/planos/pref/{ano}/{UF}.json prefeito, 2012–2024 (todas as candidaturas do estado)
  politica/data/planos/pref/capitais.json  prefeito das capitais, 2012–2024
  politica/data/planos/meta.json           contagens, fontes e data da coleta

Fontes (sem chave):
  candidaturas: https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_{ano}.zip
  propostas:    https://cdn.tse.jus.br/estatistica/sead/odsele/proposta_governo/proposta_governo_{ano}_{UF}.zip
                (só o índice do .zip é lido, por "range request"; os PDFs não são baixados nem copiados)
  ids de políticos: politica/data/politicos/ (gerado por scripts/politica/politicos/)

Uso: python3 scripts/politica/planos/build_index.py [--sem-prefeitos]
"""
import csv, io, json, os, re, sys, time, unicodedata, zipfile, datetime, glob
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUT = os.path.join(ROOT, "politica", "data", "planos")
POL = os.path.join(ROOT, "politica", "data", "politicos")
CACHE = os.environ.get("PLANOS_CACHE", "/tmp/planos-cache")
CDN = "https://cdn.tse.jus.br/estatistica/sead/odsele"
UFS = "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split()
GERAIS = [2010, 2014, 2018, 2022, 2026]
MUNIC = [2012, 2016, 2020, 2024]
# id da eleição no DivulgaCandContas (diferente do CD_ELEICAO dos dados abertos). Conferido nos links
# "eleicoesAnteriores" da própria API do DivulgaCandContas em 08/10/2026.
DIVULGA_ID = {2010: "14417", 2012: "1699", 2014: "680", 2016: "2", 2018: "2022802018",
              2020: "2030402020", 2022: "2040602022", 2024: "2045202024", 2026: "20322002026"}
UA = {"User-Agent": "Mozilla/5.0 (planos-de-governo; +https://alexschimitz.github.io/politica/planos/)"}

os.makedirs(CACHE, exist_ok=True)


def log(*a):
    print(*a, flush=True)


def http(url, headers=None, tries=5):
    h = dict(UA); h.update(headers or {})
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=120) as r:
                return r.status, r.read(), dict(r.headers)
        except urllib.error.HTTPError as e:
            if e.code in (404, 416):
                return e.code, b"", {}
            err = e
        except Exception as e:  # noqa
            err = e
        time.sleep(2 + 3 * i)
    raise RuntimeError(f"falhou: {url}: {err}")


class RangeFile(io.RawIOBase):
    """Arquivo remoto só-leitura via HTTP Range (para ler o índice de um .zip sem baixar tudo)."""
    def __init__(self, url, size):
        self.url, self.size, self.pos = url, size, 0
        self.buf_start, self.buf = -1, b""
    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos
    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else (self.pos + off if whence == 1 else self.size + off)
        return self.pos
    def readinto(self, b):
        n = len(b)
        if self.pos >= self.size or n == 0:
            return 0
        end = min(self.size, self.pos + n)
        if not (self.buf_start <= self.pos and end <= self.buf_start + len(self.buf)):
            # lê no mínimo 256 KB por vez (o índice do zip fica no fim do arquivo)
            want_end = min(self.size, max(end, self.pos + 262144))
            st, data, _ = http(self.url, {"Range": f"bytes={self.pos}-{want_end - 1}"})
            if st not in (200, 206):
                raise IOError(f"HTTP {st} {self.url}")
            if st == 200:  # servidor ignorou o Range
                data = data[self.pos:want_end]
            self.buf_start, self.buf = self.pos, data
        off = self.pos - self.buf_start
        chunk = self.buf[off:off + (end - self.pos)]
        b[:len(chunk)] = chunk
        self.pos += len(chunk)
        return len(chunk)


def remote_size(url):
    for i in range(5):
        try:
            req = urllib.request.Request(url, method="HEAD", headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                return int(r.headers.get("Content-Length") or 0)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return 0
        except Exception:
            pass
        time.sleep(2 + 3 * i)
    return 0


RX_SQ = re.compile(r"(?<!\d)(\d{9,12})(?:_(\d+))?\.pdf$", re.I)


def list_propostas(ano, uf):
    """{sq: [[nome do arquivo no zip, bytes], ...]} e tamanho do .zip"""
    url = f"{CDN}/proposta_governo/proposta_governo_{ano}_{uf}.zip"
    cf = os.path.join(CACHE, f"propraw_{ano}_{uf}.json")
    size = remote_size(url)
    names = None
    if os.path.exists(cf):
        c = json.load(open(cf))
        if c.get("size") == size:
            names = c["names"]
    if names is None:
        names = []
        if size:
            rf = io.BufferedReader(RangeFile(url, size), buffer_size=65536)
            with zipfile.ZipFile(rf) as z:
                names = [[i.filename, i.file_size] for i in z.infolist()]
        json.dump({"size": size, "names": names}, open(cf, "w"))
    files = {}
    for fn, sz in names:
        m = RX_SQ.search(fn)
        if m:
            files.setdefault(m.group(1), []).append([fn, sz])
    for v in files.values():
        v.sort()
    return files, size


def fetch_cand(ano):
    fn = os.path.join(CACHE, f"consulta_cand_{ano}.zip")
    url = f"{CDN}/consulta_cand/consulta_cand_{ano}.zip"
    size = remote_size(url)
    if not (os.path.exists(fn) and os.path.getsize(fn) == size and size):
        log("baixando", url)
        tmp = fn + ".part"
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600) as r, open(tmp, "wb") as f:
            while True:
                b = r.read(1 << 20)
                if not b:
                    break
                f.write(b)
        os.replace(tmp, fn)
    return fn


def norm(s):
    s = unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().upper()
    return re.sub(r"[^A-Z ]", " ", s).split()


MINUS = {"da", "de", "do", "das", "dos", "e", "di", "du", "del"}


def titulo(s):
    s = (s or "").strip()
    if not s:
        return s
    out = []
    for i, w in enumerate(s.lower().split()):
        if i and w in MINUS:
            out.append(w)
        else:
            out.append("-".join(p[:1].upper() + p[1:] for p in w.split("-")))
    return " ".join(out)


def resultado(rows):
    """E eleito · S foi ao 2º turno e perdeu · T vai ao 2º turno (pendente) · N não eleito · X candidatura sem efeito"""
    t = {r["NR_TURNO"]: r["DS_SIT_TOT_TURNO"].upper() for r in rows}
    sit = " ".join(r.get("DS_SITUACAO_CANDIDATURA", "") for r in rows).upper()
    s1, s2 = t.get("1", ""), t.get("2", "")
    if "ELEITO" in (s1, s2) and not (s2 and s2 != "ELEITO" and s1 != "ELEITO"):
        if s2 == "ELEITO" or s1 == "ELEITO":
            return "E"
    if s1.startswith("2"):
        if s2 == "NÃO ELEITO":
            return "S"
        if s2 == "ELEITO":
            return "E"
        return "T"
    if s1 == "NÃO ELEITO" or s2 == "NÃO ELEITO":
        return "N"
    if s1 in ("SUPLENTE",):
        return "N"
    if s1.startswith("#NULO") or "INAPTO" in sit or "RENÚNCIA" in s1 or "REGISTRO NEGADO" in s1 or "SUBSTITU" in s1 or "CASSA" in s1:
        return "X"
    return "U"


def read_cand(ano, cargos, ufs=None):
    """{(ue, sq): [linhas]} só de eleição ordinária (CD_TIPO_ELEICAO=2)."""
    z = zipfile.ZipFile(fetch_cand(ano))
    out = {}
    for n in z.namelist():
        if not n.lower().endswith(".csv") or "_BRASIL" in n.upper():
            continue
        uf = n.rsplit("_", 1)[-1][:2].upper()
        if ufs and uf not in ufs:
            continue
        with z.open(n) as fh:
            for r in csv.DictReader(io.TextIOWrapper(fh, encoding="latin-1"), delimiter=";"):
                if r["CD_CARGO"] not in cargos or r.get("CD_TIPO_ELEICAO", "2") != "2":
                    continue
                out.setdefault((r["SG_UE"], r["SQ_CANDIDATO"]), []).append(r)
    return out


# ---------- ligação com /politica/politicos/ ----------
def load_people(keys):
    """keys = conjunto de (ano, cargo, local). Devolve {(ano,cargo,local): [(id, {tokens de nomes})]}"""
    idx = {}
    for fn in sorted(glob.glob(os.path.join(POL, "p", "*.json"))):
        try:
            d = json.load(open(fn))
        except Exception:
            continue
        for pid, p in d.items():
            for e in p.get("e", []):
                k = (e[0], e[1], str(e[2]))
                if k not in keys:
                    continue
                names = {p.get("n", ""), p.get("nc", "")}
                if len(e) > 8 and e[8]:
                    names.add(e[8])
                idx.setdefault(k, []).append((pid, [frozenset(norm(x)) for x in names if x]))
    return idx


def match(idx, ano, cargo, local, nome, urna):
    cands = idx.get((ano, cargo, str(local)), [])
    a, b = frozenset(norm(nome)), frozenset(norm(urna))
    hits = []
    for pid, sets in cands:
        for s in sets:
            if s and (s == a or s == b or (len(s) >= 2 and s <= a) or (len(a) >= 2 and a <= s)):
                hits.append(pid)
                break
    hits = list(dict.fromkeys(hits))
    return hits[0] if len(hits) == 1 else None


def main():
    sem_pref = "--sem-prefeitos" in sys.argv
    os.makedirs(OUT, exist_ok=True)
    hoje = datetime.date.today().isoformat()
    tse_mun = json.load(open(os.path.join(POL, "municipios.json")))  # {codTSE: [nome, UF, IBGE]}
    mapa_mun = json.load(open(os.path.join(ROOT, "politica", "data", "mapa", "municipios.json")))
    capitais = {str(m[0]) for m in mapa_mun["municipios"] if m[4] == 1}

    # ---- listas de propostas (só o índice dos .zip) ----
    jobs = [(a, "BR") for a in GERAIS] + [(a, u) for a in GERAIS for u in UFS if u != "DF" or True]
    if not sem_pref:
        jobs += [(a, u) for a in MUNIC for u in UFS if u != "DF"]
    props, zips = {}, {}
    def work(j):
        try:
            return j, list_propostas(*j)
        except Exception as e:
            log("ERRO lendo", j, e)
            return j, ({}, 0)
    with ThreadPoolExecutor(12) as ex:
        for (a, u), (files, size) in ex.map(work, jobs):
            props[(a, u)] = files
            zips[(a, u)] = size
            log(f"propostas {a} {u}: {len(files)} candidaturas, {size/1e6:.1f} MB")

    # ---- presidente e governador ----
    rows, keys = [], set()
    cand = {}
    for a in GERAIS:
        cand[a] = read_cand(a, {"1", "3"})
        for (ue, sq), rs in cand[a].items():
            keys.add((a, int(rs[0]["CD_CARGO"]), ue))
    people = load_people(keys)
    for a in GERAIS:
        for (ue, sq), rs in cand[a].items():
            r0 = sorted(rs, key=lambda r: r["NR_TURNO"])[-1]
            cargo = int(r0["CD_CARGO"])
            uf = "BR" if cargo == 1 else r0["SG_UF"]
            files = props.get((a, uf), {}).get(sq, [])
            nome = r0.get("NM_SOCIAL_CANDIDATO") if r0.get("NM_SOCIAL_CANDIDATO", "#NULO#").strip("#") not in ("", "NULO") else r0["NM_CANDIDATO"]
            if "DIVULG" in nome.upper() or nome.strip("#").upper() in ("", "NE", "NULO"):
                nome = r0["NM_URNA_CANDIDATO"]
            pid = match(people, a, cargo, ue, r0["NM_CANDIDATO"], r0["NM_URNA_CANDIDATO"])
            rows.append([a, cargo, uf, titulo(r0["NM_URNA_CANDIDATO"]), titulo(nome), r0["SG_PARTIDO"],
                         r0["NR_CANDIDATO"], resultado(rs), sq, [f[0].split("/")[-1] for f in files],
                         round(sum(f[1] for f in files) / 1024), pid])
    rows.sort(key=lambda r: (-r[0], r[1], r[2], "ESTNX U".find(r[7]) if r[7] in "ESTNXU" else 9, r[3]))
    gerais = {
        "_sobre": "Candidaturas a presidente (cargo 1) e governador (cargo 3) em eleições ordinárias, com o plano de governo entregue ao TSE.",
        "colunas": ["ano", "cargo", "uf", "nome_urna", "nome", "partido", "numero", "resultado", "sq", "arquivos", "kb", "id_politico"],
        "resultado": {"E": "eleito", "S": "foi ao 2º turno e perdeu", "T": "vai disputar o 2º turno", "N": "não eleito", "X": "candidatura sem efeito (indeferida, renúncia, cancelada)", "U": "sem resultado na fonte"},
        "divulga": DIVULGA_ID,
        "zip": {f"{a}_{u}": zips[(a, u)] for (a, u) in zips if a in GERAIS and zips[(a, u)]},
        "rows": rows,
    }
    json.dump(gerais, open(os.path.join(OUT, "gerais.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    log("gerais:", len(rows), "candidaturas,", sum(1 for r in rows if r[9]), "com plano")

    meta = {"geradoEm": hoje, "gerais": {}, "prefeitos": {}}
    for a in GERAIS:
        for c in (1, 3):
            rr = [r for r in rows if r[0] == a and r[1] == c]
            meta["gerais"][f"{a}_{c}"] = [len(rr), sum(1 for r in rr if r[9])]

    # ---- prefeitos ----
    if not sem_pref:
        cap_rows = []
        for a in MUNIC:
            cnd = read_cand(a, {"11"})
            keys = {(a, 11, ue) for (ue, sq) in cnd}
            people = load_people(keys)
            por_uf = {}
            for (ue, sq), rs in cnd.items():
                r0 = sorted(rs, key=lambda r: r["NR_TURNO"])[-1]
                uf = r0["SG_UF"]
                files = props.get((a, uf), {}).get(sq, [])
                mun = tse_mun.get(ue.zfill(5))
                ibge = str(mun[2]) if mun else ""
                pid = match(people, a, 11, ue.zfill(5), r0["NM_CANDIDATO"], r0["NM_URNA_CANDIDATO"]) or match(people, a, 11, ue, r0["NM_CANDIDATO"], r0["NM_URNA_CANDIDATO"])
                row = [ue, ibge, titulo(r0["NM_UE"]), titulo(r0["NM_URNA_CANDIDATO"]), r0["SG_PARTIDO"], r0["NR_CANDIDATO"],
                       resultado(rs), sq, [f[0].split("/")[-1] for f in files], round(sum(f[1] for f in files) / 1024), pid]
                por_uf.setdefault(uf, []).append(row)
                if ibge in capitais:
                    cap_rows.append([a, uf] + row)
            for uf, rr in por_uf.items():
                rr.sort(key=lambda r: (r[2], "ESTNXU".find(r[6]), r[3]))
                d = os.path.join(OUT, "pref", str(a))
                os.makedirs(d, exist_ok=True)
                json.dump({"ano": a, "uf": uf, "colunas": ["ue_tse", "ibge", "municipio", "nome_urna", "partido", "numero", "resultado", "sq", "arquivos", "kb", "id_politico"],
                           "zip": zips.get((a, uf), 0), "rows": rr},
                          open(os.path.join(d, f"{uf}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
                meta["prefeitos"][f"{a}_{uf}"] = [len(rr), sum(1 for r in rr if r[8])]
            log(f"prefeitos {a}: {sum(len(v) for v in por_uf.values())} candidaturas")
        cap_rows.sort(key=lambda r: (-r[0], r[1], "ESTNXU".find(r[8]), r[5]))
        json.dump({"colunas": ["ano", "uf"] + ["ue_tse", "ibge", "municipio", "nome_urna", "partido", "numero", "resultado", "sq", "arquivos", "kb", "id_politico"],
                   "rows": cap_rows}, open(os.path.join(OUT, "pref", "capitais.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    else:
        old = os.path.join(OUT, "meta.json")
        if os.path.exists(old):
            meta["prefeitos"] = json.load(open(old)).get("prefeitos", {})

    meta["fontes"] = [
        ["TSE — dados abertos: candidaturas (consulta_cand)", "https://dadosabertos.tse.jus.br/dataset/?q=candidatos"],
        ["TSE — dados abertos: propostas de governo (proposta_governo)", "https://dadosabertos.tse.jus.br/dataset/?q=proposta"],
        ["TSE — DivulgaCandContas (página de cada candidatura, com o PDF do plano)", "https://divulgacandcontas.tse.jus.br/divulga/"],
    ]
    meta["anos"] = {"gerais": GERAIS, "prefeitos": MUNIC}
    json.dump(meta, open(os.path.join(OUT, "meta.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    log("ok")


if __name__ == "__main__":
    main()
