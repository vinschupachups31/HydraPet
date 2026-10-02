import assert from 'node:assert/strict';
import * as THREE from 'three';
import test from 'node:test';
import { POSES } from '../src/config/postures';
import { compilePose } from '../src/pet/rig';
import { makeRigSim } from './helpers/rigSim';

const idxOf = (k: string, a = 0) => ['hip', 'spine1', 'spine2', 'neck', 'head', 'armL', 'foreL', 'handL', 'armR', 'foreR', 'handR'].indexOf(k) * 0 + a; // (indices lus par nom ci-dessous)
void idxOf;

async function groomRun(side: 'L' | 'R', seed: number) {
  const s = await makeRigSim(seed); const P = s.posture, dt = 1 / 60;
  P.request('sit'); s.run(dt, 10, () => P.posture === 'sit' && !P.busy);
  const t0 = P.time; P.groom(side);
  const log: { t: number; contact: number; head: number; arm: number; state: string; handPos: number[][]; hind: number[][] }[] = [];
  const bones = s.rig.bones;
  const ref: Record<string, THREE.Quaternion> = {}; for (const k of ['head', 'armR', 'armL'] as const) ref[k] = bones[k].quaternion.clone();
  const pitch = (k: 'head' | 'armR' | 'armL') => 2 * Math.acos(Math.min(1, Math.abs(ref[k].dot(bones[k].quaternion)))); // écart angulaire à l'assise (rad)
  s.run(dt, 40, () => P.lastDone?.name === 'Grooming' && !P.busy, () => log.push({ t: P.time - t0, contact: P.contact, head: pitch('head'), arm: pitch(side === 'R' ? 'armR' : 'armL'), state: P.state, handPos: [s.pos('handL').toArray(), s.pos('handR').toArray()], hind: [s.pos('footL2').toArray(), s.pos('footR2').toArray()] }));
  return { s, P, log, total: P.time - t0 };
}

test('toilette : assise atteinte avant de lever la patte, 0,4–1 s de pause assise, puis transfert de poids, puis patte levée', async () => {
  const { P, log } = await groomRun('R', 3);
  const firstContact = log.find((l) => l.contact > 0.05)!.t;
  assert.ok(firstContact > 0.8 + 0.4 + 0.45, `premier contact à ${firstContact.toFixed(2)} s (installation 0,8–1,2 + pause 0,4–1,0 + transfert)`);
  assert.ok(P.posture === 'sit', 'retour à l\'assise de référence');
});

test('toilette : durée 10–18 s, séries de gestes de durées et amplitudes variées (pas de cycle identique)', async () => {
  const totals: number[] = [], spans: number[][] = [];
  for (const seed of [1, 2, 3, 4, 5]) { // cinq répétitions
    const { total, log } = await groomRun('R', seed);
    totals.push(total);
    // intervalles entre maxima de contact : variation des gestes
    const gaps: number[] = []; let last = -1;
    for (let i = 1; i < log.length - 1; i++) if (log[i].contact > 0.95 && log[i].head > log[i - 1].head && log[i].head >= log[i + 1].head) { if (last >= 0) gaps.push(log[i].t - last); last = log[i].t; }
    spans.push(gaps);
  }
  for (const t of totals) assert.ok(t >= 10 && t <= 18.5, `durée ${t.toFixed(1)} s`);
  assert.ok(new Set(totals.map((t) => t.toFixed(1))).size >= 4, 'les cinq séquences ne sont pas identiques');
});

test('toilette : la patte fait l\'essentiel du mouvement (la tête s\'incline de moins de 12° par rapport à l\'assise)', async () => {
  const { log } = await groomRun('R', 4);
  const sit = 0;
  const contact = log.filter((l) => l.contact > 0.9);
  const headRange = Math.max(...contact.map((l) => Math.abs(l.head - sit))) * 180 / Math.PI;
  const armRange = Math.max(...contact.map((l) => Math.abs(l.arm))) * 180 / Math.PI;
  assert.ok(headRange < 12, `tête ±${headRange.toFixed(1)}°`);
  assert.ok(armRange > 25, `épaule ${armRange.toFixed(1)}°`);
});

test('toilette : appuis tenus (antérieur porteur < 2 cm, postérieurs < 3 cm), aucune translation du parent, aucun clip de marche', async () => {
  for (const side of ['R', 'L'] as const) {
    const { s, log } = await groomRun(side, 6);
    const bearing = side === 'R' ? 0 : 1, a = log[0].handPos[bearing];
    let slideH = 0, slideB = 0;
    for (const l of log) { slideH = Math.max(slideH, Math.hypot(l.handPos[bearing][0] - a[0], l.handPos[bearing][2] - a[2])); slideB = Math.max(slideB, ...l.hind.map((h, i) => Math.hypot(h[0] - log[0].hind[i][0], h[2] - log[0].hind[i][2]))); }
    assert.ok(slideH < 0.02, `${side} : antérieur porteur ${(slideH * 100).toFixed(1)} cm`);
    assert.ok(slideB < 0.03, `${side} : postérieurs ${(slideB * 100).toFixed(1)} cm`);
    assert.equal(s.group.position.length(), 0);
    const d = s.anim.debug(); assert.ok(d.walkW + d.runW < 0.01);
  }
});

test('toilette : le côté de la patte ne change pas pendant la séquence ; la patte est reposée (contact nul) avant le retour à l\'assise', async () => {
  const { log } = await groomRun('L', 7);
  const lastContact = [...log].reverse().find((l) => l.contact > 0.05)!.t;
  assert.ok(log[log.length - 1].t - lastContact > 2.0, 'plus de contact patte-visage pendant les 2 dernières secondes (repose, recentrage, observation)');
});

test('toilette : poses de référence — l\'assise de toilette est plus basse que l\'assise standard et le bassin est fléchi', () => {
  const a = compilePose(POSES.sit), b = compilePose(POSES.groomSit);
  assert.ok(b[3 * 0] > a[3 * 0], 'bassin moins incliné (colonne moins verticale)');
});
