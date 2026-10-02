import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_TURN } from '../src/config/turning';
import { LocoState, animationMix, createLocoState, quatFromYaw, signedYawBetween, stepLocomotion, wrapAngle, yawOf } from '../src/pet/locomotion';
import { PetBrain } from '../src/pet/brain';
import { mulberry32 } from '../src/pet/rng';

const P = DEFAULT_TURN;
const DT = 1 / 60;
const DEG = Math.PI / 180;

interface Sample { t: number; h: number; omega: number; alpha: number; speed: number; x: number; z: number; phase: string; gaze: number; dist: number }

/** Simule `seconds` secondes vers `target` ; renvoie la trace image par image. */
function sim(s: LocoState, target: { x: number; z: number } | null, seconds: number, opt: { gait?: 'walk' | 'run'; dt?: number; face?: number } = {}): Sample[] {
  const out: Sample[] = [];
  const dt = opt.dt ?? DT;
  for (let t = 0; t < seconds; t += dt) {
    const r = stepLocomotion(s, target, opt.gait ?? 'walk', dt, P, opt.face);
    out.push({ t, h: s.heading, omega: s.omega, alpha: s.accelAng, speed: s.speed, x: s.x, z: s.z, phase: s.phase, gaze: s.gazeHead, dist: r.distance });
  }
  return out;
}
/** Point à 2 m dans la direction (cap + angle). */
const ahead = (s: LocoState, deg: number, d = 2) => ({ x: s.x + Math.sin(s.heading + deg * DEG) * d, z: s.z + Math.cos(s.heading + deg * DEG) * d });
const totalRotation = (tr: Sample[], h0: number) => { let prev = h0, sum = 0; for (const f of tr) { sum += Math.abs(wrapAngle(f.h - prev)); prev = f.h; } return sum; };
const maxAbs = (a: number[]) => Math.max(...a.map(Math.abs));

test('quaternions : écart signé = chemin le plus court, toujours dans [-π, π]', () => {
  for (const [a, b] of [[0, 0.5], [3.0, -3.0], [-3.1, 3.1], [Math.PI - 0.01, -Math.PI + 0.01], [1, 1 + Math.PI * 0.999]] as const) {
    const d = signedYawBetween(quatFromYaw(a), quatFromYaw(b));
    assert.ok(d >= -Math.PI - 1e-9 && d <= Math.PI + 1e-9);
    assert.ok(Math.abs(wrapAngle(a + d - b)) < 1e-9, `a + écart = b (${a}, ${b})`);
    assert.ok(Math.abs(d) <= Math.PI + 1e-9);
  }
  assert.ok(Math.abs(yawOf(quatFromYaw(2.5)) - 2.5) < 1e-9);
});

for (const deg of [30, 90, 180, -30, -90, -180]) {
  test(`virage de ${deg}° à l'arrêt : progressif, sans tour inutile, arrive`, () => {
    const s = createLocoState();
    const target = ahead(s, deg);
    const tr = sim(s, target, 14);
    // départ progressif : pas de vitesse angulaire instantanée
    assert.ok(Math.abs(tr[0].omega) < 0.2, `ω à la 1re image : ${tr[0].omega}`);
    // accélération angulaire bornée, vitesse angulaire bornée
    assert.ok(maxAbs(tr.map((f) => f.alpha)) <= P.turnAccel + 1e-6, 'accélération angulaire');
    assert.ok(maxAbs(tr.map((f) => f.omega)) <= Math.max(P.reorientRate, P.maxTurnRate) + 0.05, 'vitesse angulaire max');
    // aucun tour complet : la rotation totale reste proche de l'écart réel
    const rot = totalRotation(tr, 0);
    assert.ok(rot <= Math.abs(deg) * DEG * 1.15 + 0.1, `rotation totale ${(rot / DEG).toFixed(0)}° pour ${Math.abs(deg)}°`);
    assert.ok(Math.hypot(s.x - target.x, s.z - target.z) < 0.12, 'arrive à destination');
    assert.ok(s.speed < 0.03);
  });
}

test('demi-tour à l\'arrêt : réorientation par petits pas (arc), puis redémarrage progressif', () => {
  const s = createLocoState();
  const tr = sim(s, ahead(s, 180), 8);
  const reorient = tr.filter((f) => f.phase === 'reorient');
  assert.ok(reorient.length > 30, 'phase de réorientation présente');
  assert.ok(reorient.some((f) => f.speed > 0.02), 'elle avance en petit arc (pas de rotation pattes figées)');
  assert.ok(maxAbs(reorient.map((f) => f.speed)) <= P.reorientCreep * 1.5, `creep ${maxAbs(reorient.map((f) => f.speed)).toFixed(3)}`);
  const iExit = tr.findIndex((f) => f.phase === 'arc');
  assert.ok(iExit > 0, 'repart ensuite');
  // départ progressif après la réorientation : l'accélération linéaire reste bornée
  let worst = 0; for (let i = 1; i < tr.length; i++) worst = Math.max(worst, Math.abs(tr[i].speed - tr[i - 1].speed) / DT);
  assert.ok(worst <= P.accel + 0.35, `accélération linéaire max ${worst.toFixed(2)} m/s²`);
});

test('en marche : un virage plus serré ralentit davantage, sans pivoter sur place', () => {
  const minSpeed: Record<number, number> = {};
  for (const deg of [30, 90, 180]) {
    const s = createLocoState(); s.speed = P.vWalk;
    const target = ahead(s, deg);
    const tr = sim(s, target, 3);
    minSpeed[deg] = Math.min(...tr.slice(0, 120).map((f) => f.speed));
    if (deg < 180) {
      assert.ok(!tr.some((f) => f.phase === 'reorient'), `${deg}° : arc, pas de pivot`);
      // le corps continue de se déplacer pendant qu'il tourne (courbe)
      const moved = Math.hypot(tr[60].x, tr[60].z);
      assert.ok(moved > 0.05, `${deg}° : déplacement pendant le virage (${moved.toFixed(2)} m)`);
    } else {
      assert.ok(tr.some((f) => f.phase === 'reorient'), '180° en marche : freinage puis réorientation');
    }
  }
  assert.ok(minSpeed[30] > minSpeed[90], `30° (${minSpeed[30].toFixed(2)}) plus rapide que 90° (${minSpeed[90].toFixed(2)})`);
  assert.ok(minSpeed[90] > minSpeed[180] - 1e-9, `90° plus rapide que 180°`);
});

test('virage serré à faible vitesse plus long qu\'à vitesse de marche', () => {
  const dur = (v0: number) => {
    const s = createLocoState(); s.speed = v0;
    const t = ahead(s, 80, 3);
    const tr = sim(s, t, 6);
    const i = tr.findIndex((f) => Math.abs(wrapAngle(f.h - Math.atan2(t.x, t.z))) < 6 * DEG);
    return i < 0 ? Infinity : tr[i].t;
  };
  assert.ok(dur(0.05) > dur(P.vWalk) - 1e-9, `lent ${dur(0.05).toFixed(2)} s, rapide ${dur(P.vWalk).toFixed(2)} s`);
});

test('orientations proches de ±180° : chemin le plus court, aucun tour', () => {
  for (const [h0, dz] of [[Math.PI - 0.02, 0.06], [-Math.PI + 0.02, -0.06], [Math.PI - 0.01, 0.0]] as const) {
    const s = createLocoState(0, 0, h0);
    // cible juste de l'autre côté de la coupure ±π
    const target = { x: Math.sin(h0 + dz) * 2, z: Math.cos(h0 + dz) * 2 };
    const tr = sim(s, target, 6);
    const rot = totalRotation(tr, h0);
    assert.ok(rot < 0.4, `rotation ${(rot / DEG).toFixed(0)}° pour un écart de ${(Math.abs(dz) / DEG).toFixed(1)}°`);
  }
  // demi-tour exact : un seul sens, pas de va-et-vient
  const s = createLocoState(0, 0, 3.0);
  const tr = sim(s, { x: Math.sin(3.0 + Math.PI) * 2, z: Math.cos(3.0 + Math.PI) * 2 }, 8);
  let flips = 0; for (let i = 1; i < tr.length; i++) if (Math.sign(tr[i].omega) * Math.sign(tr[i - 1].omega) < 0 && Math.abs(tr[i].omega) > 0.05 && Math.abs(tr[i - 1].omega) > 0.05) flips++;
  assert.ok(flips <= 1, `changements de sens : ${flips}`);
  assert.ok(totalRotation(tr, 3.0) < Math.PI * 1.2, 'moins d\'un demi-tour et demi');
});

test('la vitesse angulaire est lissée : accélération et à-coups (jerk) bornés', () => {
  const s = createLocoState();
  const tr = sim(s, ahead(s, 150), 8);
  let maxJerk = 0, maxDOmega = 0;
  for (let i = 1; i < tr.length; i++) {
    maxJerk = Math.max(maxJerk, Math.abs(tr[i].alpha - tr[i - 1].alpha) / DT);
    maxDOmega = Math.max(maxDOmega, Math.abs(tr[i].omega - tr[i - 1].omega) / DT);
  }
  assert.ok(maxJerk <= P.turnJerk * 1.02, `jerk ${maxJerk.toFixed(1)} rad/s³`);
  assert.ok(maxDOmega <= P.turnAccel * 1.02, `accélération ${maxDOmega.toFixed(2)} rad/s²`);
  // ce n'est pas une vitesse angulaire constante : elle monte puis redescend
  const peak = maxAbs(tr.map((f) => f.omega));
  const plateau = tr.filter((f) => Math.abs(f.omega) > 0.97 * peak).length;
  assert.ok(plateau < tr.length * 0.5, 'pas de plateau constant dominant');
});

test('arrivée : pas de tremblement, ni dérive du cap ou de la position', () => {
  const s = createLocoState();
  const target = ahead(s, 40, 1.2);
  const tr = sim(s, target, 10);
  const iArr = tr.findIndex((f) => f.dist < P.arriveRadius && f.speed < 0.03);
  assert.ok(iArr > 0, 'arrivée détectée');
  const after = sim(s, null, 3);
  const h0 = after[0].h, x0 = after[0].x, z0 = after[0].z;
  assert.ok(maxAbs(after.map((f) => wrapAngle(f.h - h0))) < 3 * DEG, 'cap stable après l\'arrivée');
  assert.ok(Math.hypot(after.at(-1)!.x - x0, after.at(-1)!.z - z0) < 0.03, 'position stable');
  let flips = 0; for (let i = 1; i < after.length; i++) if (Math.sign(after[i].omega) * Math.sign(after[i - 1].omega) < 0 && Math.abs(after[i].omega) > 0.02) flips++;
  assert.ok(flips <= 2, `oscillations : ${flips}`);
});

test('zone morte et hystérésis : pas de petites corrections incessantes', () => {
  // 1,5° d'écart : aucune rotation
  const a = createLocoState(); a.desiredYaw = 1.5 * DEG;
  assert.equal(maxAbs(sim(a, null, 2, { face: 1.5 * DEG }).map((f) => f.omega)), 0);
  // 4° (entre zone morte et zone morte + hystérésis) alors que l'animal est stabilisé : aucune correction
  const b = createLocoState();
  assert.equal(maxAbs(sim(b, null, 2, { face: 4 * DEG }).map((f) => f.omega)), 0);
  // 9° : il se corrige, puis se stabilise dans la zone morte
  const c = createLocoState();
  const tr = sim(c, null, 4, { face: 9 * DEG });
  assert.ok(maxAbs(tr.map((f) => f.omega)) > 0, 'corrige un écart de 9°');
  assert.ok(Math.abs(wrapAngle(c.heading - 9 * DEG)) < (P.deadZoneDeg + 0.5) * DEG, 'stabilisé dans la zone morte');
});

test('protection contre une image très longue : plafonnée et découpée en sous-pas', () => {
  const a = createLocoState(), b = createLocoState();
  const t = ahead(a, 60);
  stepLocomotion(a, t, 'walk', 5, P);                 // 5 s d'un coup -> plafonnée à 0,1 s
  for (let i = 0; i < 6; i++) stepLocomotion(b, t, 'walk', DT, P); // 0,1 s en 6 images
  assert.ok(Number.isFinite(a.x) && Number.isFinite(a.heading));
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.01 && Math.abs(wrapAngle(a.heading - b.heading)) < 0.02, 'même résultat que 6 images normales');
});

test('regard : la tête devance le corps, reste dans ses limites, puis revient', () => {
  const s = createLocoState();
  const tr = sim(s, ahead(s, 90), 6);
  const lim = P.headLimitDeg * DEG;
  assert.ok(maxAbs(tr.map((f) => f.gaze)) <= lim + 1e-6, 'limite anatomique respectée');
  const i = Math.round(0.25 / DT);
  const bodyDone = Math.abs(tr[i].h) / (90 * DEG);
  const headDone = Math.abs(tr[i].gaze) / lim;
  assert.ok(headDone > 0.5 && headDone > bodyDone + 0.3, `à 0,25 s : tête ${(headDone * 100).toFixed(0)} % de sa course, corps ${(bodyDone * 100).toFixed(0)} % du virage`);
  const end = sim(s, null, 3);
  assert.ok(Math.abs(end.at(-1)!.gaze) < 2 * DEG, 'la tête revient face au corps');
});

test('animation : la cadence des pas suit la vitesse angulaire en réorientation', () => {
  const slow = animationMix({ speed: 0.05, omega: 0.8, pivoting: true }, 0.48, 0.78);
  const fast = animationMix({ speed: 0.05, omega: 2.0, pivoting: true }, 0.48, 0.78);
  assert.ok(fast.walkTimeScale > slow.walkTimeScale, 'pas plus rapides quand on tourne plus vite');
  for (const m of [slow, fast, animationMix({ speed: 0.3, omega: 0, pivoting: false }, 0.48, 0.78)]) assert.ok(Math.abs(m.idle + m.walk + m.run - 1) < 1e-9);
  assert.equal(animationMix({ speed: 0, omega: 0, pivoting: false }, 0.48, 0.78).idle, 1);
  assert.ok(Math.abs(animationMix({ speed: 0.48, omega: 0, pivoting: false }, 0.48, 0.78).walkTimeScale - 1) < 1e-9, 'cadence normale à la vitesse de référence');
});

const bounds = { minX: -1.5, maxX: 1.5, minZ: -1, maxZ: 1.2 };
test('cerveau : déterministe avec une graine, jamais de nouvelle cible à chaque image', () => {
  const run = (seed: number) => {
    const b = new PetBrain(createLocoState(), bounds, mulberry32(seed));
    const trace: string[] = []; let changes = 0, last: unknown = null;
    for (let i = 0; i < 60 * 40; i++) {
      b.update(DT);
      if (b.target !== last) { changes++; last = b.target; }
      if (i % 120 === 0) trace.push(`${b.mode}:${b.loco.x.toFixed(2)},${b.loco.z.toFixed(2)}`);
    }
    return { trace: trace.join('|'), changes };
  };
  assert.equal(run(7).trace, run(7).trace);
  assert.notEqual(run(7).trace, run(8).trace);
  assert.ok(run(7).changes < 40, `${run(7).changes} changements de cible en 40 s`);
});

test('cerveau : le toucher arrête et oriente vers la caméra par un virage progressif', () => {
  const b = new PetBrain(createLocoState(), bounds, mulberry32(3));
  b.cameraXZ = { x: 0, z: 4.5 };
  for (let i = 0; i < 60 * 6; i++) b.update(DT);
  b.touch();
  let wmax = 0, amax = 0, prev = b.loco.omega;
  for (let i = 0; i < 60 * 3; i++) { b.update(DT); wmax = Math.max(wmax, Math.abs(b.loco.omega)); amax = Math.max(amax, Math.abs(b.loco.omega - prev) / DT); prev = b.loco.omega; }
  assert.ok(b.loco.speed < 0.1, `quasi à l'arrêt (${b.loco.speed.toFixed(2)} m/s)`);
  const toCam = Math.atan2(b.cameraXZ.x - b.loco.x, b.cameraXZ.z - b.loco.z);
  assert.ok(Math.abs(wrapAngle(toCam - b.loco.heading)) < 0.2, 'tourné vers la caméra');
  assert.ok(amax <= P.turnAccel * 1.02, 'sans à-coup');
});

test('reste dans la zone sur 10 minutes simulées', () => {
  const bb = { minX: -1.6, maxX: 1.6, minZ: -1.2, maxZ: 1.4 };
  const b = new PetBrain(createLocoState(), bb, mulberry32(11));
  let out = 0;
  for (let i = 0; i < 60 * 600; i++) {
    b.update(DT);
    const { x, z } = b.loco;
    if (x < bb.minX - 0.5 || x > bb.maxX + 0.5 || z < bb.minZ - 0.5 || z > bb.maxZ + 0.5) out++;
  }
  assert.equal(out, 0);
});
