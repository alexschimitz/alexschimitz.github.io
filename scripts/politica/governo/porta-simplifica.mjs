// Gera politica/propostas/simplifica.js (versão para navegador de scripts/politica/simplifica.mjs, do painel).
// Não altera o original: só copia o código, troca import/export e expõe window.PolSimplifica.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, log } from './comum.mjs';

const src = await readFile(join(ROOT, 'scripts', 'politica', 'simplifica.mjs'), 'utf8');
const lib = await readFile(join(ROOT, 'scripts', 'politica', 'lib.mjs'), 'utf8');
const normLine = lib.split('\n').find((l) => /^export const norm\s*=/.test(l));
if (!normLine) throw new Error('norm() não encontrado em lib.mjs');
const corpo = src.replace(/^import .*$/gm, '').replace(/^export (const|function) /gm, '$1 ');
const out = `/* politica/propostas/simplifica.js — GERADO por scripts/politica/governo/porta-simplifica.mjs
   a partir de scripts/politica/simplifica.mjs (painel). Não edite à mão. */
(function () {
"use strict";
${normLine.replace(/^export /, '')}
${corpo}
window.PolSimplifica = { simplificar: simplificar, leisCitadas: leisCitadas, temaTags: temaTags, TEMA_TAGS: TEMA_TAGS, LEIS: LEIS, norm: norm };
})();
`;
const f = join(ROOT, 'politica', 'propostas', 'simplifica.js');
let old = ''; try { old = await readFile(f, 'utf8'); } catch {}
if (old !== out) { await writeFile(f, out); log('escreveu', f); } else log('simplifica.js sem mudança');
