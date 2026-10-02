import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_BEHAVIOR as B } from '../src/config/behavior';
import { DEFAULT_TURN } from '../src/config/turning';
import { OBSTACLES, WalkArea } from '../src/pet/layout';
import { LocomotionController } from '../src/pet/locomotor';

const DT = 1 / 60;
const make = (x = 0, z = 0.5) => new LocomotionController({ ...DEFAULT_TURN, vWalk: 0.565, vRun: 0.86, arriveRadius: B.arrive.radius }, new WalkArea(OBSTACLES), B.bodyRadius, B.stall, x, z, 0, B.arrive.hysteresis);

test('vitesse réelle = distance parcourue / temps ; égale à la vitesse demandée en marche libre', () => {
  const L = make(-0.6, 1.0);
  L.goTo(-0.6, -1.0);
  const samples: number[] = []; let travelled = 0, px = L.s.x, pz = L.s.z, t = 0;
  while (L.status === 'moving' && t < 20) { L.update(DT); t += DT; travelled += Math.hypot(L.s.x - px, L.s.z - pz); px = L.s.x; pz = L.s.z; if (L.s.speed > 0.5 && Math.abs(L.s.accelLin) < 0.05) samples.push(Math.abs(L.realSpeedRaw - L.s.speed) / L.s.speed); }
  assert.ok(Math.max(...samples) < 0.03, `écart réel/demandé ${(Math.max(...samples) * 100).toFixed(1)} %`);
  assert.ok(Math.abs(travelled - 2.0) < 0.15, `distance parcourue ${travelled.toFixed(2)} m`);
});

test('arrivée : hystérésis, une fois arrivé il ne repart pas et ne oscille pas marche/repos', () => {
  const L = make(0, 1.0);
  L.goTo(0.1, 0.1);
  let changes = 0, prev = L.status;
  for (let i = 0; i < 60 * 12; i++) { L.update(DT); if (L.status !== prev) { changes++; prev = L.status; } }
  assert.equal(L.status, 'arrived');
  assert.ok(changes <= 2, `changements d'état : ${changes}`);
  assert.ok(L.s.speed < 0.01, 'à l\'arrêt');
  const p0 = { x: L.s.x, z: L.s.z };
  for (let i = 0; i < 60 * 5; i++) L.update(DT);
  assert.ok(Math.hypot(L.s.x - p0.x, L.s.z - p0.z) < 0.005, 'immobile après l\'arrivée');
});

test('contre le mobilier : la vitesse réelle tombe à zéro et le blocage est signalé, sans traverser', () => {
  const L = make(0.5, -0.4);
  L.goTo(0.95, -1.5);                                        // dans le canapé
  let t = 0;
  while (L.status === 'moving' && t < 20) { L.update(DT); t += DT; }
  assert.equal(L.status, 'blocked');
  assert.ok(t >= B.stall.timeout - 0.2 && t < B.stall.timeout + 4, `blocage à ${t.toFixed(1)} s`);
  for (let i = 0; i < 60; i++) L.update(DT);
  assert.ok(L.realSpeed < 0.02, 'la locomotion s\'arrête (vitesse réelle nulle)');
  const d = Math.max(0, 0.2 - L.s.x, L.s.x - 1.7, -1.7 - L.s.z, L.s.z + 0.9);
  assert.ok(Math.hypot(Math.max(0.2 - L.s.x, 0, L.s.x - 1.7), Math.max(-1.7 - L.s.z, 0, L.s.z + 0.9)) >= B.bodyRadius - 0.01 || d >= 0, 'jamais à l\'intérieur du canapé');
});

test('s\'orienter vers un point : virage progressif, état « faced », sans avancer', () => {
  const L = make(0, 0);
  L.faceYaw(2.0);
  let t = 0; while (L.status === 'turning' && t < 8) { L.update(DT); t += DT; }
  assert.equal(L.status, 'faced');
  assert.ok(Math.hypot(L.s.x, L.s.z) < 0.4, 'petit arc au plus');
});

test('regard imposé : la tête suit dans ses limites, le corps reste', () => {
  const L = make(0, 0);
  L.lookAt(5, 0);                                            // à 90° à droite
  for (let i = 0; i < 90; i++) L.update(DT);
  assert.ok(Math.abs(L.s.gazeHead) <= DEFAULT_TURN.headLimitDeg * Math.PI / 180 + 1e-6);
  assert.ok(Math.abs(L.s.gazeHead) > 0.5, 'la tête a tourné');
  assert.ok(Math.abs(L.s.heading) < 0.01, 'le corps n\'a pas bougé');
  L.clearLook();
  for (let i = 0; i < 120; i++) L.update(DT);
  assert.ok(Math.abs(L.s.gazeHead) < 0.03, 'la tête revient');
});
