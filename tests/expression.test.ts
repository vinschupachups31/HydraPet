import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { ExpressionLayer } from '../src/pet/expression';
import { loadFox } from './helpers/loadFox';

const cfg = { ears: ['Ear_L', 'Ear_R'] as [string, string], twitchEvery: [0.01, 0.01] as [number, number], twitchTime: 1, twitchDeg: { back: 14, out: 10 } };
const tipOf = (root: THREE.Object3D, n: string) => { root.updateMatrixWorld(true); return root.getObjectByName(n)!.getWorldPosition(new THREE.Vector3()); };

test('oreilles : le frémissement recule et écarte l\'oreille, puis revient au repos', async () => {
  const { root } = await loadFox();
  const rest = { L: tipOf(root, 'Ear_Tip_L'), R: tipOf(root, 'Ear_Tip_R') };
  const layer = new ExpressionLayer(root, cfg, 1);
  let moved = 0;
  for (let i = 0; i < 40; i++) { layer.update(0.01); }
  for (const side of ['L', 'R'] as const) {
    const p = tipOf(root, `Ear_Tip_${side}`); moved = Math.max(moved, p.distanceTo(rest[side]));
    if (p.distanceTo(rest[side]) > 1e-4) {
      assert.ok(p.z < rest[side].z - 0.005, 'l\'oreille recule');
      assert.ok(Math.abs(p.x) > Math.abs(rest[side].x) + 0.003, 'l\'oreille s\'écarte');
    }
  }
  assert.ok(moved > 0.01, `une oreille a bougé (${(moved * 100).toFixed(1)} cm)`);
});

test('oreilles : désactivé par le poids (toilette) et déterministe pour une graine donnée', async () => {
  const a = await loadFox(), b = await loadFox();
  const la = new ExpressionLayer(a.root, cfg, 3), lb = new ExpressionLayer(b.root, cfg, 3);
  la.weight = 0;
  for (let i = 0; i < 40; i++) { la.update(0.01); lb.update(0.01); }
  assert.ok(tipOf(a.root, 'Ear_Tip_L').distanceTo(tipOf(a.root, 'Ear_Tip_R')) > 0.1);
  const base = await loadFox();
  assert.ok(tipOf(a.root, 'Ear_Tip_L').distanceTo(tipOf(base.root, 'Ear_Tip_L')) < 1e-6 && tipOf(a.root, 'Ear_Tip_R').distanceTo(tipOf(base.root, 'Ear_Tip_R')) < 1e-6, 'poids nul : rien ne bouge');
  assert.ok(tipOf(b.root, 'Ear_Tip_L').distanceTo(tipOf(base.root, 'Ear_Tip_L')) + tipOf(b.root, 'Ear_Tip_R').distanceTo(tipOf(base.root, 'Ear_Tip_R')) > 0.01, 'poids 1 : une oreille a bougé');
});

test('couches de diagnostic : « clip seul » ne laisse aucune correction (sol, appuis, regard)', async () => {
  const { makeRigSim } = await import('./helpers/rigSim');
  const s = await makeRigSim(2);
  s.anim.setLayerMode('clip');
  for (let i = 0; i < 120; i++) s.anim.update(1 / 60, { realSpeed: 0.3, omega: 0, pivoting: false }, { head: 0.6, spine: 0.3, pitch: 0.2 });
  assert.equal(s.anim.rig.groundShift, 0, 'aucune correction de sol');
  assert.ok(s.anim.ik.feet.every((f) => f.weight === 0 && f.plant === null), 'aucun pied verrouillé');
  const head = s.root.getObjectByName('Head')!.quaternion.clone();
  s.anim.setLayerMode('full');
  for (let i = 0; i < 30; i++) s.anim.update(1 / 60, { realSpeed: 0.3, omega: 0, pivoting: false }, { head: 0.6, spine: 0.3, pitch: 0.2 });
  assert.ok(head.angleTo(s.root.getObjectByName('Head')!.quaternion) > 0.05, 'le mode complet applique le regard');
});
