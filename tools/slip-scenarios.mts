/* Diagnostic reproductible des appuis (vrai modèle, chaîne réelle) : marche droite, accélération/freinage, courbe à 90°, demi-tour, marche → repos → marche.
   Seuil de glissement = 4 % de la longueur du corps (0,40 m) = 1,6 cm. Seuls les appuis identifiés par le clip sont mesurés.
   Usage : node --import tsx tools/slip-scenarios.mts [--noik] [--fps 30] [--svg out.svg] */
import fs from 'node:fs';
import { DIAG_SCENARIOS, runDiag } from '../tests/helpers/diagSim';
import { slipThreshold } from '../src/pet/contactMetrics';

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const fps = +(arg('--fps') ?? 60), svgOut = arg('--svg');
const ik = !process.argv.includes('--noik');
const cm = (m: number) => (m * 100).toFixed(1);
let svg = '';
console.log(`Seuil : ${(100 * 0.04).toFixed(0)} % de la longueur du corps (0,40 m) = ${cm(slipThreshold())} cm · IK ${ik ? 'oui' : 'non'} · ${fps} images/s`);
for (const [n, sc] of DIAG_SCENARIOS.entries()) {
  const r = await runDiag(sc.id, { ik, fps });
  const o = r.report;
  const c = (x: typeof o.longitudinal) => `${x.n} appuis, médiane ${cm(x.median)} / max ${cm(x.max)} cm, ${x.over} > seuil`;
  console.log(`\n${sc.name}\n  longitudinal : ${c(o.longitudinal)}\n  latéral      : ${c(o.lateral)}\n  à l'arrêt    : ${c(o.arret)}\n  total        : ${o.total.n} appuis, ${o.total.over} > seuil`);
  if (process.argv.includes('--worst')) for (const x of r.runs.filter((q) => q.over).sort((a, b) => b.slip - a.slip).slice(0, 6)) console.log(`    ${x.cls.padEnd(12)} patte ${x.foot} t=${x.t0.toFixed(2)}–${x.t1.toFixed(2)} glisse ${cm(x.slip)} cm (long ${cm(x.longitudinal)}, lat ${cm(x.lateral)}) v̄=${x.meanSpeed.toFixed(2)} |ω̄|=${x.meanOmega.toFixed(2)}`);
  if (svgOut) {
    const W = 300, k = 110, ox = W / 2, oz = 170, col = { green: '#2a9d3f', blue: '#3b7ddd', red: '#e02424' };
    svg += `<g transform="translate(${(n % 2) * 320},${Math.floor(n / 2) * 360})"><text x="4" y="14" font-size="12">${sc.name}</text><text x="4" y="28" font-size="10" fill="#555">vert = appui · bleu = levée · rouge = appui &gt; ${cm(slipThreshold())} cm</text>`;
    const tr = r.tracker.trail;
    for (const p of tr) svg += `<circle cx="${(ox + p.x * k).toFixed(1)}" cy="${(oz - p.z * k).toFixed(1)}" r="${p.color === 'blue' ? 0.8 : 1.6}" fill="${col[p.color]}" fill-opacity="${p.color === 'blue' ? 0.5 : 0.9}"/>`;
    svg += '</g>';
  }
}
if (svgOut) fs.writeFileSync(svgOut, `<svg xmlns="http://www.w3.org/2000/svg" width="660" height="1100" style="background:#fff;font-family:sans-serif">${svg}</svg>`);
