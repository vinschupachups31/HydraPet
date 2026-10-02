import assert from 'node:assert/strict';
import test from 'node:test';
import { slipThreshold } from '../src/pet/contactMetrics';
import { DIAG_SCENARIOS, runDiag } from './helpers/diagSim';

// Diagnostic reproductible des appuis : seuil = 4 % de la longueur du corps (0,40 m) = 1,6 cm ; seuls les appuis identifiés par le clip sont mesurés.
const LIMITS: Record<string, { medianMax: number; maxCm: number; overMax: number; restMaxCm: number }> = {
  straight: { medianMax: 0.012, maxCm: 0.03, overMax: 0, restMaxCm: 0.01 },
  brake: { medianMax: 0.012, maxCm: 0.04, overMax: 2, restMaxCm: 0.01 },
  curve: { medianMax: 0.012, maxCm: 0.09, overMax: 4, restMaxCm: 0.01 },
  uturn: { medianMax: 0.012, maxCm: 0.1, overMax: 8, restMaxCm: 0.01 },
  restwalk: { medianMax: 0.012, maxCm: 0.07, overMax: 5, restMaxCm: 0.01 },
};
for (const sc of DIAG_SCENARIOS) {
  for (const fps of [60, 30]) {
    test(`appuis (${fps} images/s) : ${sc.name}`, async () => {
      const r = (await runDiag(sc.id, { fps })).report, L = LIMITS[sc.id];
      assert.ok(r.total.n >= 12, `${r.total.n} appuis mesurés`);
      assert.ok(r.total.median < L.medianMax, `médiane ${(r.total.median * 100).toFixed(1)} cm`);
      assert.ok(r.total.max < L.maxCm, `max ${(r.total.max * 100).toFixed(1)} cm (seuil ${(slipThreshold() * 100).toFixed(1)} cm)`);
      assert.ok(r.total.over <= L.overMax, `${r.total.over} appuis > seuil`);
      assert.ok(r.arret.max < L.restMaxCm, `glissement à l'arrêt ${(r.arret.max * 100).toFixed(2)} cm`);
    });
  }
}

test('appuis : la synchronisation + IK réduit le glissement latéral des virages par rapport à la synchronisation seule', async () => {
  const a = (await runDiag('uturn', { ik: false })).report, b = (await runDiag('uturn', { ik: true })).report;
  assert.ok(b.lateral.median < a.lateral.median, `${(a.lateral.median * 100).toFixed(1)} → ${(b.lateral.median * 100).toFixed(1)} cm`);
  assert.ok(b.total.over < a.total.over, `${a.total.over} → ${b.total.over} appuis > seuil`);
});

test('blocage : le corps et la marche s\'arrêtent ensemble (pas de pattes qui continuent contre l\'obstacle)', async () => {
  const THREE = await import('three');
  const { DEFAULT_ANIMATION } = await import('../src/config/animation');
  const CLIP_DATA = (await import('../src/config/modelProfile')).ACTIVE_PROFILE.clipData;
  const { ACTIVE_PET } = await import('../src/config/pet');
  const { DEFAULT_TURN } = await import('../src/config/turning');
  const { DEFAULT_BEHAVIOR: B } = await import('../src/config/behavior');
  const { AnimationController } = await import('../src/pet/animation');
  const { OBSTACLES, WalkArea } = await import('../src/pet/layout');
  const { LocomotionController } = await import('../src/pet/locomotor');
  const { loadFox } = await import('./helpers/loadFox');
  const { root, animations } = await loadFox();
  const group = new THREE.Group(); group.add(root); root.scale.setScalar(ACTIVE_PET.scale);
  const anim = new AnimationController(root, animations, ACTIVE_PET, JSON.parse(JSON.stringify(DEFAULT_ANIMATION)), CLIP_DATA);
  const nw = CLIP_DATA.Walk.nominalSpeed * ACTIVE_PET.scale;
  const loco = new LocomotionController({ ...DEFAULT_TURN, vWalk: nw, vRun: CLIP_DATA.Run.nominalSpeed * ACTIVE_PET.scale, arriveRadius: B.arrive.radius }, new WalkArea(OBSTACLES), B.bodyRadius, B.stall, 0.9, -0.1, Math.PI, B.arrive.hysteresis, 0.06);
  loco.goTo(1.0, -1.3); // but dans le canapé
  const dt = 1 / 60; let blockedAt = -1, worstAfter = 0, speedAfter = 0;
  for (let i = 0; i < 60 * 14; i++) {
    loco.update(dt); group.position.set(loco.s.x, 0, loco.s.z); group.quaternion.set(0, loco.s.q.y, 0, loco.s.q.w); group.updateMatrixWorld(true);
    anim.update(dt, { realSpeed: loco.realSpeed, omega: loco.s.omega, pivoting: loco.s.pivoting }, { head: 0, spine: 0 });
    if (loco.status === 'blocked' && blockedAt < 0) blockedAt = i * dt;
    if (blockedAt >= 0 && i * dt > blockedAt + 0.6) { worstAfter = Math.max(worstAfter, anim.debug().walkW); speedAfter = Math.max(speedAfter, loco.realSpeed); }
  }
  assert.ok(blockedAt > 0, 'blocage détecté');
  assert.ok(speedAfter < 0.06 && worstAfter < 0.1, `0,6 s après le blocage : vitesse ${speedAfter.toFixed(2)} m/s, poids de marche ${worstAfter.toFixed(2)}`);
});
