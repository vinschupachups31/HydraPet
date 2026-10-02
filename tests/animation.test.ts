import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_ANIMATION } from '../src/config/animation';
import { AnimPlan, newPlan, planAnimation } from '../src/pet/animation';

const C = DEFAULT_ANIMATION;
const NW = 0.565, NR = 0.86;
const run = (plan: AnimPlan, speed: (t: number) => number, seconds: number, fps: number, omega = 0, pivoting = false) => {
  const dt = 1 / fps; const out: { t: number; p: AnimPlan }[] = [];
  for (let t = 0; t < seconds; t += dt) { planAnimation(plan, { realSpeed: speed(t), omega, pivoting }, dt, C, NW, NR); out.push({ t, p: { ...plan } }); }
  return out;
};

test('deux seuils distincts : démarrage > startSpeed, arrêt < stopSpeed (pas de basculement incessant)', () => {
  const p = newPlan();
  run(p, () => 0.07, 1, 60);                               // entre les deux seuils, à l'arrêt : reste arrêté
  assert.equal(p.locomoting, false);
  run(p, () => 0.2, 0.5, 60);
  assert.equal(p.locomoting, true);
  run(p, () => 0.07, 1, 60);                               // entre les deux seuils, en marche : continue
  assert.equal(p.locomoting, true);
  run(p, () => 0.03, 0.5, 60);
  assert.equal(p.locomoting, false);
  // bruit de ± 0,01 m/s autour d'un seuil : aucun basculement
  const q = newPlan(); run(q, () => 0.2, 0.3, 60);
  let flips = 0, prev = q.locomoting;
  run(q, (t) => 0.075 + 0.01 * Math.sin(t * 40), 3, 60).forEach(({ p: s }) => { if (s.locomoting !== prev) { flips++; prev = s.locomoting; } });
  assert.equal(flips, 0, 'pas de basculement dû au bruit');
});

test('corps immobile : aucun clip de marche (repos dominant)', () => {
  const p = newPlan();
  run(p, () => 0.5, 1, 60);                                 // en marche
  const tr = run(p, () => 0, 1, 60);                        // arrêt net
  const i = tr.findIndex(({ p: s }) => s.walkW < 0.05);
  assert.ok(i >= 0 && tr[i].t <= 0.25, `poids de marche < 5 % après ${(tr[i]?.t ?? 9).toFixed(2)} s`);
  const end = tr.at(-1)!.p;
  assert.ok(end.walkW < 0.01 && end.runW < 0.01 && end.idleW > 0.98);
});

test('freinage progressif : les pattes s\'arrêtent avec le corps, pas avant, pas après', () => {
  const p = newPlan();
  run(p, () => 0.565, 1, 60);
  // décélération linéaire de 0,565 à 0 en 0,5 s
  const tr = run(p, (t) => Math.max(0, 0.565 * (1 - t / 0.5)), 1, 60);
  const tZero = tr.find(({ t }) => t >= 0.5)!;
  assert.ok(tZero.p.walkW < 0.08, `à l'arrêt du corps, poids de marche ${(tZero.p.walkW * 100).toFixed(0)} %`);
  // la cadence suit : elle diminue avec la vitesse (pas de pattes qui continuent à plein régime)
  const mid = tr.find(({ t }) => t >= 0.25)!;
  assert.ok(mid.p.walkRate < 0.85, `cadence à mi-freinage ${mid.p.walkRate.toFixed(2)}`);
});

test('cadence de lecture = vitesse réelle / vitesse nominale du clip (dans la plage crédible)', () => {
  for (const [v, expected] of [[0.565, 1], [0.4, 0.4 / NW], [0.7, 0.7 / NW]] as const) {
    const p = newPlan();
    run(p, () => v, 2, 60);
    assert.ok(Math.abs(p.walkRate - Math.min(C.walkRate[1], Math.max(C.walkRate[0], expected))) < 0.02, `v=${v} : cadence ${p.walkRate.toFixed(3)}`);
  }
  const fast = newPlan(); run(fast, () => 3, 1, 60);
  assert.ok(fast.walkRate <= C.walkRate[1] + 1e-9, 'plafonnée à la plage');
});

test('démarrage : le poids de locomotion monte avec la vitesse réelle du corps', () => {
  const p = newPlan();
  const tr = run(p, (t) => Math.min(0.565, 0.565 * (t / 0.6)), 1.2, 60);
  const early = tr.find(({ t }) => t >= 0.1)!.p, late = tr.find(({ t }) => t >= 0.9)!.p;
  assert.ok(early.walkW < 0.3, `au tout début : ${(early.walkW * 100).toFixed(0)} %`);
  assert.ok(late.walkW > 0.95, `en marche établie : ${(late.walkW * 100).toFixed(0)} %`);
});

test('course : seuils d\'entrée et de sortie distincts, et cadence jamais ralentie comme une marche', () => {
  const p = newPlan();
  run(p, () => 0.9, 1, 60);
  assert.equal(p.running, true);
  run(p, () => 0.7, 1, 60);                                 // entre runStop (0,66) et runStart (0,74) : reste en course
  assert.equal(p.running, true);
  run(p, () => 0.6, 1, 60);
  assert.equal(p.running, false);
  const slowRun = newPlan(); run(slowRun, () => 0.9, 1, 60);
  assert.ok(slowRun.runRate >= C.runRate[0], 'plage de course respectée');
});

test('réorientation par petits pas : la cadence suit la vitesse angulaire', () => {
  const a = newPlan(), b = newPlan();
  run(a, () => 0.05, 1, 60, 0.8, true); run(b, () => 0.05, 1, 60, 2.0, true);
  assert.ok(b.walkRate > a.walkRate + 0.3, `${a.walkRate.toFixed(2)} → ${b.walkRate.toFixed(2)}`);
  assert.ok(Math.abs(a.idleW + a.walkW + a.runW - 1) < 1e-9);
});

test('mêmes résultats à 30 et 60 images/s (dépend du temps, pas du nombre d\'images)', () => {
  const profile = (t: number) => (t < 1 ? 0 : t < 2 ? 0.565 : t < 3 ? 0.3 : 0);
  const a = newPlan(), b = newPlan();
  const ta = run(a, profile, 4, 60), tb = run(b, profile, 4, 30);
  for (const t of [1.2, 1.6, 2.4, 3.2, 3.8]) {
    const x = ta.find((s) => s.t >= t)!.p, y = tb.find((s) => s.t >= t)!.p;
    assert.ok(Math.abs(x.walkW - y.walkW) < 0.05 && Math.abs(x.walkRate - y.walkRate) < 0.05, `t=${t} : ${x.walkW.toFixed(2)}/${y.walkW.toFixed(2)}`);
  }
});

test('poids toujours normalisés', () => {
  const p = newPlan();
  for (const s of run(p, (t) => 1.2 * Math.abs(Math.sin(t)), 8, 60)) assert.ok(Math.abs(s.p.idleW + s.p.walkW + s.p.runW - 1) < 1e-9);
});
