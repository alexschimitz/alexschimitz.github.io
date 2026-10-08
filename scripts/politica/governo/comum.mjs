// Utilitários do fluxo Governo & Propostas (reaproveita ../lib.mjs do painel, só leitura).
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync, createWriteStream } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { ROOT, UA, get, sleep, norm, log as baseLog } from '../lib.mjs';

export { ROOT, get, sleep, norm };
export const GOV = join(ROOT, 'politica', 'data', 'governo');
export const PROP = join(ROOT, 'politica', 'data', 'propostas');
export const RAW = process.env.POL_GOV_RAW || join(tmpdir(), 'pol-governo-raw');
export const log = (...a) => console.log('[governo]', ...a);
export const ANO_ATUAL = Number(new Date().toLocaleString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 4));
export const hojeBR = () => new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 16);

export async function ensureDir(d) { await mkdir(d, { recursive: true }); }
export async function readJSON(f, fb = null) { try { return JSON.parse(await readFile(f, 'utf8')); } catch { return fb; } }
// Escreve JSON compacto só se o conteúdo mudou (evita commits vazios). Retorna true se mudou.
export async function writeIfChanged(f, data) {
  const body = JSON.stringify(data) + '\n';
  let old = null; try { old = await readFile(f, 'utf8'); } catch {}
  if (old === body) return false;
  await ensureDir(dirname(f));
  await writeFile(f, body);
  log(`escreveu ${f.replace(ROOT + '/', '')} (${(body.length / 1024).toFixed(1)} KB)`);
  return true;
}
// Baixa um arquivo grande para o cache bruto (fora do git). maxAgeH: reaproveita se for recente.
export async function download(url, file, { maxAgeH = 20, tries = 3 } = {}) {
  await ensureDir(dirname(file));
  if (existsSync(file)) {
    const s = await stat(file);
    if (s.size > 0 && (Date.now() - s.mtimeMs) / 3.6e6 < maxAgeH) return file;
  }
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await pipeline(Readable.fromWeb(res.body), createWriteStream(file + '.part'));
      const { rename } = await import('node:fs/promises');
      await rename(file + '.part', file);
      return file;
    } catch (e) { last = e; await sleep(2000 * (i + 1)); }
  }
  throw new Error(`${url} -> ${last?.message}`);
}
export const arr = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]);
export const dmy2iso = (s) => { const m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
