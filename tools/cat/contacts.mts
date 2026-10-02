// @ts-nocheck
/* Hauteur du dessous de patte pendant les appuis (flottement > +1 cm, pénétration < −1 cm), par scénario et par pied.
   Usage : node --import tsx tools/cat/contacts.mts [groundLock=0..1] */
import { runDiag } from '../../tests/helpers/diagSim';
const lock = +(process.argv[2] ?? 0);
const TOL = 0.01;
for (const id of ['straight', 'brake', 'curve', 'uturn', 'restwalk']) {
  const r = await runDiag(id, { fps: 60, frames: true, over: { ik: { groundLock: lock } } });
  const names = ['avD', 'avG', 'arG', 'arD'];
  const out = names.map((n, f) => { const ys = r.frames.filter((fr) => fr.measuring && fr.phases[f] === 'stance').map((fr) => fr.feet[f][1]); if (!ys.length) return `${n}: -`; const mn = Math.min(...ys), mx = Math.max(...ys); const fl = ys.filter((y) => y > TOL).length / ys.length, pe = ys.filter((y) => y < -TOL).length / ys.length; return `${n}: ${(mn * 100).toFixed(1)}..${(mx * 100).toFixed(1)} cm, flotte ${(fl * 100).toFixed(0)} %, enfonce ${(pe * 100).toFixed(0)} %`; });
  console.log(id.padEnd(9), out.join(' | '));
}
