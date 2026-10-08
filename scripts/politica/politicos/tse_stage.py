#!/usr/bin/env python3
"""Etapa 1: converte os CSVs brutos do TSE (latin-1) em tabelas parquet enxutas.

Entrada : RAW/unz/consulta_cand_{ano}/*_BRASIL.csv, RAW/unz/votacao_candidato_munzona_{ano}/*_BRASIL.csv,
          RAW/unz/votacao_candidato_uf_{1989,1990}/*.txt
Saída   : RAW/stage/cand_{ano}.parquet  (candidaturas; contém CPF/título — NUNCA vai para o git)
          RAW/stage/votos_{ano}.parquet (soma de votos nominais por candidatura)
Uso     : python tse_stage.py [anos...]   (RAW = env POL_RAW, padrão /workspace/pol-politicos-raw)
"""
import duckdb, glob, os, subprocess, sys

RAW = os.environ.get('POL_RAW', '/workspace/pol-politicos-raw')
U = f'{RAW}/unz'
S = f'{RAW}/stage'
os.makedirs(S, exist_ok=True)
ANOS = [1994, 1996, 1998, 2000, 2002, 2004, 2006, 2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024, 2026]

CAND_COLS = ['ANO_ELEICAO', 'CD_TIPO_ELEICAO', 'NM_TIPO_ELEICAO', 'NR_TURNO', 'CD_ELEICAO', 'DS_ELEICAO', 'DT_ELEICAO',
             'SG_UF', 'SG_UE', 'NM_UE', 'CD_CARGO', 'DS_CARGO', 'SQ_CANDIDATO', 'NR_CANDIDATO', 'NM_CANDIDATO',
             'NM_URNA_CANDIDATO', 'NR_CPF_CANDIDATO', 'NR_TITULO_ELEITORAL_CANDIDATO', 'DT_NASCIMENTO', 'SG_UF_NASCIMENTO',
             'DS_GENERO', 'NR_PARTIDO', 'SG_PARTIDO', 'NM_PARTIDO', 'DS_SITUACAO_CANDIDATURA', 'CD_SIT_TOT_TURNO', 'DS_SIT_TOT_TURNO']


def utf8_copy(src):
    """Converte latin-1 -> utf-8 num arquivo temporário (DuckDB rejeita alguns bytes C1 em latin-1)."""
    dst = f'{S}/_tmp_{os.path.basename(src)}'
    with open(dst, 'wb') as out:
        subprocess.run(['iconv', '-f', 'latin1', '-t', 'utf-8', src], stdout=out, check=True)
    return dst


def pick(pattern):
    fs = sorted(glob.glob(pattern))
    br = [f for f in fs if f.endswith('_BRASIL.csv')]
    return br[0] if br else None


def stage_year(con, ano):
    out_c, out_v = f'{S}/cand_{ano}.parquet', f'{S}/votos_{ano}.parquet'
    f = pick(f'{U}/consulta_cand_{ano}/*.csv')
    if f and not os.path.exists(out_c):
        t = utf8_copy(f)
        cols = ', '.join(f'trim("{c}") as {c}' for c in CAND_COLS)
        con.execute(f"""copy (select {cols} from read_csv('{t}', delim=';', quote='"', header=true, all_varchar=true,
                       strict_mode=false, null_padding=true)) to '{out_c}' (format parquet, compression zstd)""")
        os.remove(t)
        print(ano, 'cand', con.execute(f"select count(*) from '{out_c}'").fetchone()[0], flush=True)
    f = pick(f'{U}/votacao_candidato_munzona_{ano}/*.csv')
    if f and not os.path.exists(out_v):
        t = utf8_copy(f)
        with open(t, encoding='utf-8', errors='replace') as fh:
            header = fh.readline()
        vexpr = ("greatest(coalesce(try_cast(QT_VOTOS_NOMINAIS as bigint), 0), coalesce(try_cast(QT_VOTOS_NOMINAIS_VALIDOS as bigint), 0))"
                 if 'QT_VOTOS_NOMINAIS_VALIDOS' in header else "try_cast(QT_VOTOS_NOMINAIS as bigint)")
        # Chave de junção: municipal -> (ano, turno, município, sq); geral -> (ano, turno, UF ou BR, sq).
        # Em 2002/2010 o arquivo de votação traz SG_UE por município mesmo para cargos estaduais.
        ue = "SG_UE" if ano % 4 == 0 else "case when CD_CARGO in ('1','2') then 'BR' else SG_UF end"
        con.execute(f"""copy (select ANO_ELEICAO, NR_TURNO, {ue} as SG_UE, SQ_CANDIDATO, CD_CARGO,
                         sum({vexpr}) as votos, max(upper(DS_SIT_TOT_TURNO)) as sit_vot
                       from read_csv('{t}', delim=';', quote='"', header=true, all_varchar=true, strict_mode=false, null_padding=true)
                       group by all) to '{out_v}' (format parquet, compression zstd)""")
        os.remove(t)
        print(ano, 'votos', con.execute(f"select count(*) from '{out_v}'").fetchone()[0], flush=True)


def stage_old(con):
    """1989 (presidente) e 1990 (geral): só existe votação por UF, sem CPF/nascimento."""
    names = ['DATA_GERACAO', 'HORA_GERACAO', 'ANO_ELEICAO', 'NR_TURNO', 'DS_ELEICAO', 'SG_UF', 'SG_UE', 'CD_CARGO',
             'NR_CANDIDATO', 'SQ_CANDIDATO', 'NM_CANDIDATO', 'NM_URNA_CANDIDATO', 'DS_CARGO', 'COD_SIT_SUP', 'DESC_SIT_SUP',
             'CD_SIT_CAND', 'DS_SITUACAO_CANDIDATURA', 'CD_SIT_TOT_TURNO', 'DS_SIT_TOT_TURNO', 'NR_PARTIDO', 'SG_PARTIDO',
             'NM_PARTIDO', 'SQ_LEGENDA', 'NM_COLIGACAO', 'COMPOSICAO', 'TOTAL_VOTOS']
    for ano in (1989, 1990):
        out = f'{S}/old_{ano}.parquet'
        if os.path.exists(out):
            continue
        fs = sorted(glob.glob(f'{U}/votacao_candidato_uf_{ano}/**/*.txt', recursive=True))
        ts = [utf8_copy(f) for f in fs]
        con.execute(f"""copy (select * from read_csv({ts!r}, delim=';', quote='"', header=false, all_varchar=true,
                      columns={{ {', '.join(repr(n)+": 'VARCHAR'" for n in names)} }})) to '{out}' (format parquet)""")
        for t in ts:
            os.remove(t)
        print(ano, 'old', con.execute(f"select count(*) from '{out}'").fetchone()[0], flush=True)


CDN = 'https://cdn.tse.jus.br/estatistica/sead/odsele'


def download(ano):
    """Modo CI: baixa o zip do ano, extrai só o CSV _BRASIL e apaga o zip (economiza disco)."""
    import urllib.request
    jobs = [('consulta_cand', f'consulta_cand_{ano}'), ('votacao_candidato_munzona', f'votacao_candidato_munzona_{ano}')]
    if ano in (1989, 1990):
        jobs = [('votacao_candidato_uf', f'votacao_candidato_uf_{ano}')]
    for folder, name in jobs:
        dest = f'{U}/{name}'
        if os.path.isdir(dest) and os.listdir(dest):
            continue
        os.makedirs(dest, exist_ok=True)
        z = f'{RAW}/{name}.zip'
        subprocess.run(['curl', '-sSfL', '--retry', '5', '-o', z, f'{CDN}/{folder}/{name}.zip'], check=True)
        pat = '*.txt' if ano in (1989, 1990) else '*_BRASIL.csv'
        subprocess.run(['unzip', '-q', '-o', '-j', z, pat, '-d', dest], check=True)
        os.remove(z)


def cleanup(ano):
    for name in (f'consulta_cand_{ano}', f'votacao_candidato_munzona_{ano}', f'votacao_candidato_uf_{ano}'):
        shutil.rmtree(f'{U}/{name}', ignore_errors=True)


if __name__ == '__main__':
    import shutil
    con = duckdb.connect()
    con.execute("set threads to 8; set memory_limit='6GB'")
    args = sys.argv[1:]
    dl = '--download' in args
    anos = [int(a) for a in args if a.isdigit()] or ANOS
    if dl:
        os.makedirs(U, exist_ok=True)
        z = f'{RAW}/municipio_tse_ibge.zip'
        if not os.path.exists(f'{U}/municipio_tse_ibge/municipio_tse_ibge.csv'):
            subprocess.run(['curl', '-sSfL', '--retry', '5', '-o', z, f'{CDN}/municipio_tse_ibge/municipio_tse_ibge.zip'], check=True)
            subprocess.run(['unzip', '-q', '-o', '-j', z, '*.csv', '-d', f'{U}/municipio_tse_ibge'], check=True)
    for a in anos:
        if dl:
            download(a)
        stage_year(con, a)
        if dl:
            cleanup(a)
    if dl:
        for a in (1989, 1990):
            download(a)
    stage_old(con)
