/* Audit des postures sur le vrai modèle (hors navigateur) : sol, contacts des pieds tenus, translation du parent, clip de marche, tête/patte.
   Usage : node --import tsx tools/audit-postures.mts */
import { makeRigSim } from '../tests/helpers/rigSim';

for (const fps of [60, 30]) {
  const dt = 1 / fps;
  const s = await makeRigSim(2);
  const P = s.posture, rows: string[] = [];
  const seqs: [string, () => void, () => boolean][] = [
    ['debout → assis → couché → sommeil', () => P.request('sleep'), () => P.posture === 'sleep' && !P.busy],
    ['sommeil → couché → assis → debout', () => P.request('stand'), () => P.posture === 'stand' && !P.busy],
    ['étirement', () => { P.stretch(); }, () => P.lastDone?.name === 'Stretching' && !P.busy],
    ['debout → assis', () => P.request('sit'), () => P.posture === 'sit' && !P.busy],
    ['toilette', () => { P.groom(); }, () => P.lastDone?.name === 'Grooming' && !P.busy],
    ['assis → debout', () => P.request('stand'), () => P.posture === 'stand' && !P.busy],
  ];
  for (const [name, start, done] of seqs) {
    start();
    let minY = Infinity, maxY = -Infinity, maxGap = 0, handDrift = 0, startPos: number[][] | null = null, minGroomGap = Infinity, maxWalkW = 0;
    const t = s.run(dt, 40, done, () => {
      const y = s.lowest(); if (P.weight > 0.9) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      const d = s.anim.debug();
      maxWalkW = Math.max(maxWalkW, d.walkW + d.runW);
      if (P.state === 'Grooming' && P.contact > 0.9) { minGroomGap = Math.min(minGroomGap, d.posture.groomGap); maxGap = Math.max(maxGap, d.posture.groomGap); }
      if (P.anchors.length && P.seq) {
        const hs = (P.anchors as string[]).map((k) => s.pos(k as 'handL').toArray());
        if (!startPos || startPos.length !== hs.length) startPos = hs;
        if (P.progress < 0.78) hs.forEach((h, i) => { handDrift = Math.max(handDrift, Math.hypot(h[0] - startPos![i][0], h[2] - startPos![i][2])); });
      }
    });
    rows.push(`${name.padEnd(36)} ${t.toFixed(1)} s · sol : point bas ${(minY * 100).toFixed(1)}…${(maxY * 100).toFixed(1)} cm · glissement des antérieurs tenus ${(handDrift * 100).toFixed(1)} cm · marche ${(maxWalkW * 100).toFixed(0)} %${minGroomGap < Infinity ? ` · patte↔museau ${minGroomGap.toFixed(1)}–${maxGap.toFixed(1)} cm` : ''} · translation parent ${s.group.position.length().toFixed(3)} m`);
  }
  console.log(`\n== ${fps} images/s ==\n` + rows.join('\n'));
}
