/* Quatre scénarios de diagnostic des appuis (marche droite, freinage, virage à 90°, demi-tour) : glissement par appui et trajectoires.
   Usage : node --import tsx tools/slip-scenarios.mts [--worst] [--cfg '{"ik":{...}}'] [--svg out.svg] */
import fs from 'node:fs';
import { SCENARIOS, runScenario } from '../tests/helpers/slipScenarios';

if (process.argv[1]?.endsWith('slip-scenarios.mts')) {
  const svgOut = process.argv.indexOf('--svg') > 0 ? process.argv[process.argv.indexOf('--svg') + 1] : null;
  const oi = process.argv.indexOf('--cfg'); const over = oi > 0 ? JSON.parse(process.argv[oi + 1]) : {};
  let svg = '';
  for (const sc of SCENARIOS) {
    for (const ik of [false, true]) {
      const r = await runScenario(sc, ik, 60, over);
      const s = [...r.slips].sort((a, b) => a - b);
      console.log(`${sc.name.padEnd(28)} IK ${ik ? 'oui' : 'non'} : ${s.length} appuis, glissement médian ${(100 * (s[Math.floor(s.length / 2)] ?? 0)).toFixed(1)} cm, max ${(100 * (s[s.length - 1] ?? 0)).toFixed(1)} cm`);
      if (process.argv.includes('--worst') && ik) console.log('   pires :', [...r.info].sort((a, b) => b.slip - a.slip).slice(0, 4).map((i) => `${(i.slip * 100).toFixed(1)}cm t=${i.t.toFixed(2)} patte${i.foot} ω=${i.om.toFixed(2)} v=${i.sp.toFixed(2)} ${i.ph}`).join(' | '));
      if (svgOut && ik) {
        const W = 300, H = 300, k = 120, ox = W / 2, oz = H / 2;
        const pts = (f: number, c: boolean) => r.traj.filter((p) => p.foot === f && p.contact === c).map((p) => `${(ox + p.x * k).toFixed(1)},${(oz - p.z * k).toFixed(1)}`);
        const col = ['#d33', '#36c', '#2a2', '#e90'];
        svg += `<g transform="translate(${(SCENARIOS.indexOf(sc) % 2) * 320},${Math.floor(SCENARIOS.indexOf(sc) / 2) * 340})"><text x="4" y="14" font-size="13">${sc.name} (appui = gros point, levée = trait fin)</text>`;
        for (let f = 0; f < 4; f++) {
          svg += `<polyline fill="none" stroke="${col[f]}" stroke-opacity=".25" points="${r.traj.filter((p) => p.foot === f).map((p) => `${(ox + p.x * k).toFixed(1)},${(oz - p.z * k).toFixed(1)}`).join(' ')}"/>`;
          svg += pts(f, true).filter((_, i) => i % 3 === 0).map((p) => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="1.6" fill="${col[f]}"/>`).join('');
        }
        svg += '</g>';
      }
    }
  }
  if (svgOut) fs.writeFileSync(svgOut, `<svg xmlns="http://www.w3.org/2000/svg" width="660" height="700" style="background:#fff">${svg}</svg>`);
}
