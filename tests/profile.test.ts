import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ACTIVE_PROFILE } from '../src/config/modelProfile';
import { PostureController } from '../src/pet/posture';
import { mulberry32 } from '../src/pet/rng';
import { loadFox } from './helpers/loadFox';
import { makeSim } from './helpers/sim';

test('profil : tous les os, clips et sommets du profil existent dans le fichier du modèle', async () => {
  const { root, animations } = await loadFox();
  const names = new Set<string>(); root.traverse((o) => names.add(o.name));
  for (const [k, n] of Object.entries(ACTIVE_PROFILE.rig.bones)) assert.ok(names.has(n), `os ${k} → ${n}`);
  for (const n of Object.keys(ACTIVE_PROFILE.hull)) assert.ok(names.has(n), `sommets : os ${n}`);
  for (const c of Object.values(ACTIVE_PROFILE.clips)) assert.ok(animations.some((a) => a.name === c), `clip ${c}`);
  for (const k of ['stand', 'walk', 'sit', 'groom', 'lie', 'sleep', 'stretch']) assert.ok(ACTIVE_PROFILE.envelopes[k]?.length >= 8, `enveloppe ${k}`);
  assert.equal(ACTIVE_PROFILE.capabilities.eyelids, false, 'le renard n\'a pas de paupières');
});

test('profil : aucun nom d\'os dispersé dans les comportements, le cadrage, les postures ou l\'animation', () => {
  const dir = path.join(__dirname, '..', 'src', 'pet');
  const bad: string[] = [];
  for (const f of fs.readdirSync(dir)) if (/\.(ts|tsx)$/.test(f)) { const t = fs.readFileSync(path.join(dir, f), 'utf8'); if (/['"]b_[A-Z]/.test(t)) bad.push(f); }
  assert.deepEqual(bad, [], 'noms d\'os en dur : ' + bad.join(', '));
});

test('interruption et reprise de l\'application : un énorme intervalle de temps ne fait pas sauter les séquences', () => {
  const P = new PostureController(mulberry32(1));
  P.request('sleep'); P.update(0.05);
  const before = P.progress;
  P.update(30); // application restée en arrière-plan : dt borné à 0,1 s
  assert.ok(P.progress - before < 0.1 / 1.5, `progression ${(P.progress - before).toFixed(3)}`);
  const sim = makeSim({ seed: 2 });
  for (let i = 0; i < 120; i++) sim.step(1 / 60);
  const x = sim.loco.s.x, z = sim.loco.s.z;
  sim.step(60);
  assert.ok(Math.hypot(sim.loco.s.x - x, sim.loco.s.z - z) < 0.2, 'pas de téléportation après une longue pause');
});

test('plusieurs cycles de sommeil, toilette et étirement : aucune dérive du parent ni de la pose debout', async () => {
  const { makeRigSim } = await import('./helpers/rigSim');
  const s = await makeRigSim(8), P = s.posture, dt = 1 / 60;
  const pos = () => ['hip', 'footL2', 'footR2'].map((k) => s.pos(k as 'hip').toArray());
  let first: number[][] | null = null, worst = 0;
  for (let c = 0; c < 5; c++) {
    P.request('sleep'); s.run(dt, 30, () => P.posture === 'sleep' && !P.busy);
    for (let i = 0; i < 60; i++) s.step(dt);
    P.request('stand'); s.run(dt, 30, () => P.posture === 'stand' && !P.busy);
    P.request('sit'); s.run(dt, 10, () => P.posture === 'sit' && !P.busy); P.groom(); s.run(dt, 40, () => P.lastDone?.name === 'Grooming' && !P.busy);
    P.request('stand'); s.run(dt, 10, () => P.posture === 'stand' && !P.busy);
    for (let i = 0; i < 60; i++) s.step(dt);
    const cur = pos();
    if (!first) first = cur; else cur.forEach((p, i) => { worst = Math.max(worst, Math.hypot(p[0] - first![i][0], p[2] - first![i][2])); });
    assert.equal(s.group.position.length(), 0);
  }
  assert.ok(worst < 0.01, `dérive horizontale ${(worst * 100).toFixed(2)} cm après 5 cycles`);
});
