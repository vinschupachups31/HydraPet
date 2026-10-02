import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_FRAMING } from '../src/config/camera';
import { DEFAULT_BEHAVIOR } from '../src/config/behavior';
import { FLOOR } from '../src/pet/layout';
import { computeFraming } from '../src/pet/framing';

const Z = DEFAULT_BEHAVIOR.approach.z;
const aspects: [string, number][] = [['téléphone haut', 0.46], ['téléphone', 0.56], ['tablette portrait', 0.75], ['carré', 1], ['paysage 16:10', 1.6], ['paysage 16:9', 1.78]];

for (const [name, a] of aspects) {
  test(`cadrage « ${name} » (${a}) : hauteur apparente 25–35 % au point d'approche, animal entier visible, bas libre`, () => {
    const f = computeFraming(a, Z);
    const feet = f.project(0, 0, Z), top = f.project(0, DEFAULT_FRAMING.petHeight, Z);
    const ratio = feet.y - top.y;
    assert.ok(ratio >= 0.25 && ratio <= 0.35, `hauteur apparente ${(ratio * 100).toFixed(1)} %`);
    assert.ok(top.y > 0.05 && feet.y < 0.82, `tête à ${(top.y * 100).toFixed(0)} %, pieds à ${(feet.y * 100).toFixed(0)} % de la hauteur d'écran`);
    assert.ok(Math.abs(feet.x - 0.5) < 1e-6, 'centré horizontalement');
    assert.ok(feet.depth > DEFAULT_FRAMING.near * 5, `loin du plan de coupe proche (${feet.depth.toFixed(2)} m)`);
    assert.ok(f.maxZ >= Z, `le point d'approche (z=${Z}) est au-dessus de la limite des commandes (z max ${f.maxZ.toFixed(2)})`);
    // le point d'approche est dans la pièce
    assert.ok(Z <= FLOOR.maxZ - 0.2);
  });
}

test('animal présent au centre : plus grand qu\'avant (≈ 9 %) et pas démesuré', () => {
  for (const [, a] of aspects) {
    const f = computeFraming(a, Z);
    const r = f.project(0, 0, 0).y - f.project(0, DEFAULT_FRAMING.petHeight, 0).y;
    assert.ok(r > 0.1 && r < 0.2, `centre : ${(r * 100).toFixed(1)} %`);
  }
});

test('perspective naturelle : champ entre 30° et 45° ; plus serré en paysage qu\'en portrait', () => {
  const p = computeFraming(0.5, Z), l = computeFraming(1.78, Z);
  assert.ok(p.fov <= 45 && l.fov >= 30);
  assert.ok(l.fov < p.fov, 'focale plus longue en paysage');
  assert.ok(l.position[2] > p.position[2], 'caméra plus loin en paysage');
});

test('le cadrage ne dépend que du ratio : même ratio = mêmes valeurs (caméra immobile)', () => {
  const a = computeFraming(0.5, Z), b = computeFraming(0.5, Z);
  assert.deepEqual(a.position, b.position);
  assert.equal(a.fov, b.fov);
});

test('champ visible : la largeur de sol visible augmente avec la profondeur', () => {
  const f = computeFraming(0.5, Z);
  assert.ok(f.halfWidthAt(-1.5) > f.halfWidthAt(0) && f.halfWidthAt(0) > f.halfWidthAt(1));
});
