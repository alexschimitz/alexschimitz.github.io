// Soma os atos (atos/{ano}.json) por presidente, pela data de assinatura/edição e pelos
// períodos de exercício de presidentes.json. Saída: atos/por-presidente.json
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import { GOV, log, readJSON, writeIfChanged } from './comum.mjs';

const pres = (await readJSON(join(GOV, 'presidentes.json'))).presidentes;
const quem = (d) => { for (const p of pres) for (const [a, b] of p.exercicio) if (d >= a && d <= b) return p.id; return null; };
const z = () => ({ lei: 0, lcp: 0, emc: 0, dec: 0, mpv: 0, mpvReed: 0, mpvEdicoes: 0, mpvReedSufixo: 0, mpvLei: 0, mpvCaducou: 0, mpvRejeitada: 0, vet: 0, vetTotal: 0, vetParcial: 0, vetDerrubado: 0, vetDerrubadoParte: 0, vetMantido: 0 });
const out = Object.fromEntries(pres.map((p) => [p.id, z()]));
const dir = join(GOV, 'atos');
for (const f of readdirSync(dir).filter((f) => /^\d{4}\.json$/.test(f)).sort()) {
  const a = await readJSON(join(dir, f));
  for (const t of ['lei', 'lcp', 'emc', 'dec']) for (const r of a[t] || []) { const q = quem(r[1]); if (q) out[q][t]++; }
  for (const r of a.mpv || []) {
    const q = quem(r[1]); if (!q) continue; const o = out[q]; o.mpv++;
    if (r[5] === 'R') o.mpvReed++; else if (r[5] === 'C' || r[5] === 'I') o.mpvLei++; else if (r[5] === 'E') o.mpvCaducou++; else if (r[5] === 'J') o.mpvRejeitada++;
  }
  for (const r of a.mpvEd || []) { const q = quem(r[2]); if (!q) continue; out[q].mpvEdicoes++; if (r[1] > 0) out[q].mpvReedSufixo++; }
  // Vetos: atribuídos pela data do veto (data da mensagem)
  for (const r of a.vet || []) {
    const q = quem(r[1]); if (!q) continue; const o = out[q]; o.vet++;
    if (r[4] === 'T') o.vetTotal++; else o.vetParcial++;
    if (r[5] === 'D') o.vetDerrubado++; else if (r[5] === 'P') o.vetDerrubadoParte++; else if (r[5] === 'M') o.vetMantido++;
  }
}
await writeIfChanged(join(dir, 'por-presidente.json'), {
  _sobre: 'Contagem por presidente, pela data de assinatura (leis, decretos), promulgação (emendas constitucionais, que são promulgadas pelo Congresso e não assinadas pelo presidente), edição (MPs) ou do veto. Atos assinados por vice em exercício durante viagens do titular contam para o titular. MPs: até a EC 32/2001 uma MP podia ser reeditada várias vezes. "mpv" = MPs com processo no Congresso (até 1997 cada reedição tinha número e processo próprios; "mpvReed" = quantas delas foram reeditadas). "mpvEdicoes" = todas as edições publicadas, contando reedições com sufixo (ex.: MP 2.166-67); "mpvReedSufixo" = reedições com sufixo. Vetos: dados do Senado a partir de 2000.',
  presidentes: out,
});
log('por presidente', Object.entries(out).map(([k, v]) => `${k}:${v.lei}L/${v.mpv}MP/${v.vet}V`).join(' '));
