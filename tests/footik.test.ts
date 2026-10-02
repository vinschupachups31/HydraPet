import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { DEFAULT_ANIMATION } from '../src/config/animation';
import { CLIP_DATA } from '../src/config/foxClips';
import { FootIK, contactEnvelope, contactPosition } from '../src/pet/footIK';

const cfg = { ...DEFAULT_ANIMATION.ik };

function makeLeg() {
  const root = new THREE.Group();
  const hip = new THREE.Object3D(); hip.name = 'hip'; root.add(hip); hip.position.set(0, 1, 0);
  const b0 = new THREE.Object3D(); b0.name = 'b0'; hip.add(b0);
  const b1 = new THREE.Object3D(); b1.name = 'b1'; b0.add(b1); b1.position.set(0, -0.5, 0);
  const b2 = new THREE.Object3D(); b2.name = 'b2'; b1.add(b2); b2.position.set(0, -0.5, 0.05);
  root.updateMatrixWorld(true);
  return { root, bones: [b0, b1], eff: b2 };
}
const reset = (L: ReturnType<typeof makeLeg>, shift: number) => { L.bones.forEach((b) => b.quaternion.identity()); L.root.position.set(0, 0, shift); L.root.updateMatrixWorld(true); }; // « le mixeur réécrit la pose »
const world = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

test('phases d\'appui : intervalles circulaires et enveloppe de verrouillage', () => {
  assert.equal(contactPosition([[0.708, 0.133]], 0.9), 0.9 > 0.708 ? (0.9 - 0.708) / (1 - 0.708 + 0.133) : null);
  assert.ok(contactPosition([[0.708, 0.133]], 0.05)! > 0.5);
  assert.equal(contactPosition([[0.2, 0.5]], 0.6), null);
  assert.equal(contactEnvelope(0, 0.12, 0.28), 0);
  assert.ok(contactEnvelope(0.5, 0.12, 0.28) > 0.99);
  assert.ok(contactEnvelope(0.95, 0.12, 0.28) < 0.15, 'relâché avant la levée');
});

test('jamais les quatre pattes verrouillées en permanence (phases réelles du clip de marche)', () => {
  let allLocked = 0, noneLocked = 0;
  for (let i = 0; i < 200; i++) {
    const ph = i / 200;
    const locked = CLIP_DATA.Walk.feet.filter((f) => { const u = contactPosition(f.contacts, ph); return u !== null && contactEnvelope(u, cfg.rise, cfg.fall) > 0.9; }).length;
    if (locked === 4) allLocked++;
    if (locked === 0) noneLocked++;
  }
  assert.ok(allLocked < 20, `quatre pattes verrouillées pendant ${(allLocked / 2).toFixed(0)} % du cycle`);
  assert.ok(noneLocked < 150, 'au moins une patte au sol la plupart du temps');
});

test('le pied planté reste au sol alors que le corps avance (correction plafonnée)', () => {
  const L = makeLeg();
  const ik = new FootIK(L.root, [{ foot: 'f', bones: ['b0', 'b1', 'b2'] }], { f: [[0.1, 0.9]] }, cfg);
  reset(L, 0); ik.update(true, 0.12);                       // pose du pied
  const plant = world(L.eff);
  reset(L, 0.05);                                           // le corps a avancé de 5 cm, la pose animée est identique
  ik.update(true, 0.5);                                     // milieu d'appui : verrouillage complet
  const d = Math.hypot(world(L.eff).x - plant.x, world(L.eff).z - plant.z);
  assert.ok(d < 0.015, `pied à ${(d * 1000).toFixed(1)} mm du point d'appui (5 cm sans correction)`);
  for (const b of L.bones) assert.ok(2 * Math.acos(Math.min(1, Math.abs(b.quaternion.w))) <= cfg.maxJointDelta + 1e-6, 'flexion plafonnée');
});

test('hors de portée : le contact est relâché proprement, sans extrapolation', () => {
  const L = makeLeg();
  const ik = new FootIK(L.root, [{ foot: 'f', bones: ['b0', 'b1', 'b2'] }], { f: [[0.1, 0.9]] }, { ...cfg, stepDuration: 0 });
  reset(L, 0); ik.update(true, 0.12);
  reset(L, 0.3);                                            // 30 cm : au-delà de maxCorrection
  const before = world(L.eff);
  ik.update(true, 0.5);
  assert.ok(ik.debug()[0].released, 'relâché');
  assert.ok(world(L.eff).distanceTo(before) < 1e-9, 'aucune correction appliquée');
});

test('hors de portée avec pas de rattrapage : le pied se soulève et rejoint la pose animée sans claquer', () => {
  const L = makeLeg();
  const ik = new FootIK(L.root, [{ foot: 'f', bones: ['b0', 'b1', 'b2'] }], { f: [[0.1, 0.9]] }, { ...cfg, stepDuration: 0.12, stepLift: 0.02 });
  reset(L, 0); ik.update(true, 0.12, 1 / 60);
  reset(L, 0.1); ik.update(true, 0.5, 1 / 60);
  let last = world(L.eff).clone(), maxJump = 0, maxY = 0, steps = 0;
  for (let i = 0; i < 30; i++) {
    reset(L, 0.1);
    ik.update(true, 0.5, 1 / 60);
    const w = world(L.eff);
    if (ik.debug()[0].inContact && !ik.debug()[0].released) steps++;
    maxJump = Math.max(maxJump, w.distanceTo(last)); maxY = Math.max(maxY, w.y - L.eff.position.y * 0); last = w.clone();
  }
  assert.ok(steps > 0, 'un pas est effectué');
  assert.ok(!ik.debug()[0].released && ik.debug()[0].inContact, 'le pas est posé : le pied est replanté à son nouvel endroit');
  assert.ok(maxJump < 0.2, `pas de saut brutal (${maxJump.toFixed(3)} m)`);
});

test('rien ne s\'accumule d\'une image à l\'autre : même résultat à chaque image', () => {
  const L = makeLeg();
  const ik = new FootIK(L.root, [{ foot: 'f', bones: ['b0', 'b1', 'b2'] }], { f: [[0.1, 0.9]] }, cfg);
  reset(L, 0); ik.update(true, 0.12);
  const results: number[] = [];
  for (let i = 0; i < 60; i++) { reset(L, 0.04); ik.update(true, 0.5); results.push(world(L.eff).z); }
  assert.ok(Math.max(...results) - Math.min(...results) < 1e-6, 'stable (le mixeur remet la pose à chaque image)');
});

test('IK désactivée ou locomotion inactive : aucune modification de la pose', () => {
  const L = makeLeg();
  const ik = new FootIK(L.root, [{ foot: 'f', bones: ['b0', 'b1', 'b2'] }], { f: [[0.1, 0.9]] }, { ...cfg, enabled: false });
  reset(L, 0); ik.update(true, 0.12); reset(L, 0.05);
  const p0 = world(L.eff); ik.update(true, 0.5);
  assert.ok(world(L.eff).distanceTo(p0) < 1e-12);
});
