"""Utilidades comuns do fluxo de gastos (politica/gastos)."""
import json, os, time, urllib.request, urllib.parse, datetime, gzip, io

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OUT = os.path.join(ROOT, 'politica', 'data', 'gastos')
RAW = os.environ.get('GASTOS_RAW', '/workspace/pol-gastos-raw')
UA = 'Mozilla/5.0 (compatible; alexschimitz.github.io politica/gastos; dados abertos)'
TZ = datetime.timezone(datetime.timedelta(hours=-3))


def now_brt():
    return datetime.datetime.now(TZ).strftime('%Y-%m-%d %H:%M')


def today():
    return datetime.datetime.now(TZ).strftime('%Y-%m-%d')


def http(url, data=None, headers=None, timeout=300, tries=4, method=None):
    h = {'User-Agent': UA}
    if headers:
        h.update(headers)
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers=h, method=method)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                b = r.read()
                if r.headers.get('Content-Encoding') == 'gzip':
                    b = gzip.decompress(b)
                return b, r.geturl(), dict(r.headers)
        except Exception as e:  # noqa
            last = e
            code = getattr(e, 'code', None)
            if code in (400, 401, 403, 404):
                raise
            time.sleep(3 * (i + 1))
    raise last


def download(url, path, timeout=900, min_bytes=1):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    b, final, _ = http(url, timeout=timeout)
    if len(b) < min_bytes:
        raise RuntimeError(f'arquivo pequeno demais: {url} ({len(b)} bytes)')
    tmp = path + '.part'
    with open(tmp, 'wb') as f:
        f.write(b)
    os.replace(tmp, path)
    return final


def write_json(rel, obj):
    """Grava JSON compacto. Retorna tamanho em bytes. Não reescreve se idêntico."""
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    s = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    if os.path.exists(path):
        with open(path, encoding='utf-8') as f:
            if f.read() == s:
                return len(s.encode())
    with open(path, 'w', encoding='utf-8') as f:
        f.write(s)
    return len(s.encode())


def read_json(rel, default=None):
    path = os.path.join(OUT, rel)
    if not os.path.exists(path):
        return default
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def update_sources(key, entry):
    """Atualiza politica/data/gastos/fontes.json (uma entrada por conjunto de dados)."""
    import fcntl
    os.makedirs(RAW, exist_ok=True)
    with open(os.path.join(RAW, '.fontes.lock'), 'w') as lk:
        fcntl.flock(lk, fcntl.LOCK_EX)
        src = read_json('fontes.json', {}) or {}
        old = src.get(key, {})
        src[key] = {**old, **entry}
        write_json('fontes.json', dict(sorted(src.items())))


def r0(x):
    """Arredonda para reais inteiros (suficiente para totais agregados)."""
    try:
        return int(round(float(x)))
    except Exception:
        return 0
