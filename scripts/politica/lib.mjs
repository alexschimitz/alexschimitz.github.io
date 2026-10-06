// Utilitários compartilhados pelos scripts de coleta (sem dependências; Node >= 18).
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OUT = join(ROOT, 'politica', 'data');
export const CAMARA = 'https://dadosabertos.camara.leg.br/api/v2';
export const SENADO = 'https://legis.senado.leg.br/dadosabertos';
export const UA = 'alexschimitz.github.io politica-tracker (+https://alexschimitz.github.io/politica/)';
export const errors = [];
export const log = (...a) => console.log('[politica]', ...a);
export const arr = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]);
export const httpsify = (u) => (u ? String(u).replace(/^http:\/\//, 'https://') : u);
export const ymd = (d) => d.toISOString().slice(0, 10);
export const daysAgo = (n) => new Date(Date.now() - n * 86400000);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export async function get(url, { type = 'json', tries = 3, timeout = 60000, headers = {} } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeout);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': UA, Accept: type === 'json' ? 'application/json' : type === 'xml' ? 'application/xml, text/xml' : '*/*', ...headers },
      });
      clearTimeout(t);
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`);
        if (res.status === 429) {
          const ra = Number(res.headers.get('retry-after'));
          err.wait = (Number.isFinite(ra) && ra > 0 ? ra * 1000 : 4000) * (i + 1);
        }
        if (res.status >= 400 && res.status < 500 && res.status !== 429) err.fatal = true;
        throw err;
      }
      if (type === 'json') return await res.json();
      if (type === 'buffer') return Buffer.from(await res.arrayBuffer());
      return await res.text();
    } catch (e) {
      last = e;
      if (e.fatal) break;
      await sleep(e.wait || 1200 * (i + 1));
    }
  }
  throw new Error(`${url} -> ${last?.message || last}`);
}

export async function pool(items, n, fn, { deadline = Infinity } = {}) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length && Date.now() < deadline) {
      const k = i++;
      try { out[k] = await fn(items[k], k); } catch (e) { out[k] = undefined; errors.push(String(e.message || e)); }
    }
  }));
  return out;
}

export async function readJSON(file, fallback = null) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}
export async function writeJSON(file, data, { quiet = false } = {}) {
  const body = JSON.stringify(data);
  await writeFile(file, body + '\n');
  if (!quiet) log(`wrote ${file.replace(ROOT + '/', '')} (${(body.length / 1024).toFixed(1)} KB)`);
}
