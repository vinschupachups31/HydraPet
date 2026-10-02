import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_LOCO, LocoState, animationMix, stepLocomotion, wrapAngle } from '../src/pet/locomotion';
import { PetBrain } from '../src/pet/brain';
import { mulberry32 } from '../src/pet/rng';

const fresh = (): LocoState => ({ x: 0, z: 0, heading: 0, speed: 0, pivoting: false });
const DT = 1 / 60;

test('arrive à destination, s\'arrête et ne dépasse jamais la vitesse maximale', () => {
  const s = fresh();
  let vmax = 0, arrived = false;
  for (let i = 0; i < 60 * 20 && !arrived; i++) {
    const r = stepLocomotion(s, { x: 0.3, z: 1.5 }, 'walk', DT);
    vmax = Math.max(vmax, s.speed);
    arrived = r.arrived;
  }
  assert.ok(arrived, 'doit arriver');
  assert.ok(vmax <= DEFAULT_LOCO.vWalk + 1e-6, `vitesse max ${vmax}`);
  assert.ok(s.speed < 0.05);
  assert.ok(Math.hypot(s.x - 0.3, s.z - 1.5) < 0.1);
});

test('pas de demi-tour instantané : le cap change de façon bornée à chaque pas', () => {
  const s = fresh();
  let worst = 0;
  for (let i = 0; i < 60 * 8; i++) {
    const before = s.heading;
    stepLocomotion(s, { x: 0, z: -2 }, 'walk', DT); // cible derrière : 180°
    worst = Math.max(worst, Math.abs(wrapAngle(s.heading - before)) / DT);
  }
  assert.ok(worst <= DEFAULT_LOCO.pivotRate + 1e-6, `rotation max ${worst.toFixed(2)} rad/s`);
});

test('virage en marche : la rotation est limitée par vitesse / rayon', () => {
  const s: LocoState = { x: 0, z: 0, heading: 0, speed: 0.4, pivoting: false };
  const before = s.heading;
  stepLocomotion(s, { x: 3, z: 0 }, 'walk', DT);
  const omega = Math.abs(wrapAngle(s.heading - before)) / DT;
  assert.ok(omega <= s.speed / DEFAULT_LOCO.minTurnRadius + 1e-6, `omega ${omega}`);
});

test('freinage : ne dépasse pas la cible', () => {
  const s: LocoState = { x: 0, z: 0, heading: 0, speed: DEFAULT_LOCO.vRun, pivoting: false };
  let maxZ = 0;
  for (let i = 0; i < 60 * 6; i++) { stepLocomotion(s, { x: 0, z: 0.6 }, 'run', DT); maxZ = Math.max(maxZ, s.z); }
  assert.ok(maxZ < 0.6 + 0.12, `dépassement : ${(maxZ - 0.6).toFixed(3)} m`);
});

test('mix d\'animation : poids normalisés et cadence proportionnelle à la vitesse', () => {
  for (const v of [0, 0.03, 0.1, 0.2, 0.4, 0.6, 0.9, 1.1]) {
    const m = animationMix(v, false, 0.4, 0.84);
    assert.ok(Math.abs(m.idle + m.walk + m.run - 1) < 1e-9, `somme à v=${v}`);
  }
  assert.equal(animationMix(0, false, 0.4, 0.84).idle, 1);
  const half = animationMix(0.3, false, 0.4, 0.84).walkTimeScale;
  const full = animationMix(0.4, false, 0.4, 0.84).walkTimeScale;
  assert.ok(half < full, 'plus lent = foulées plus lentes');
  assert.ok(Math.abs(full - 1) < 1e-9, 'à la vitesse de référence, cadence normale');
});

test('cerveau : déterministe avec une graine, et réaction au toucher', () => {
  const run = (seed: number) => {
    const b = new PetBrain(fresh(), { minX: -1.5, maxX: 1.5, minZ: -1, maxZ: 1.2 }, mulberry32(seed));
    const trace: string[] = [];
    for (let i = 0; i < 60 * 30; i++) { b.update(DT); if (i % 120 === 0) trace.push(`${b.mode}:${b.loco.x.toFixed(2)},${b.loco.z.toFixed(2)}`); }
    return trace.join('|');
  };
  assert.equal(run(7), run(7));
  assert.notEqual(run(7), run(8));

  const b = new PetBrain(fresh(), { minX: -1.5, maxX: 1.5, minZ: -1, maxZ: 1.2 }, mulberry32(3));
  b.cameraXZ = { x: 0, z: 4.5 };
  for (let i = 0; i < 60 * 6; i++) b.update(DT); // le temps de partir quelque part
  b.touch();
  assert.equal(b.mode, 'react');
  for (let i = 0; i < 60 * 2; i++) b.update(DT);
  assert.ok(b.loco.speed < 0.05, 'à l\'arrêt pendant la réaction');
  const toCam = Math.atan2(b.cameraXZ.x - b.loco.x, b.cameraXZ.z - b.loco.z);
  assert.ok(Math.abs(wrapAngle(toCam - b.loco.heading)) < 0.2, 'tourné vers la caméra');
});

test('reste dans la pièce sur 10 minutes simulées', () => {
  const bounds = { minX: -1.6, maxX: 1.6, minZ: -1.2, maxZ: 1.4 };
  const b = new PetBrain(fresh(), bounds, mulberry32(11));
  let out = 0;
  for (let i = 0; i < 60 * 600; i++) {
    b.update(DT);
    const { x, z } = b.loco;
    if (x < bounds.minX - 0.4 || x > bounds.maxX + 0.4 || z < bounds.minZ - 0.4 || z > bounds.maxZ + 0.4) out++;
  }
  assert.equal(out, 0);
});
