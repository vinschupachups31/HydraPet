import assert from 'node:assert/strict';
import test from 'node:test';
import { PostureController } from '../src/pet/posture';
import { mulberry32 } from '../src/pet/rng';
import { makeRigSim } from './helpers/rigSim';

const mk = (seed = 1) => new PostureController(mulberry32(seed));
const runUntil = (P: PostureController, fn: () => boolean, max = 60, dt = 1 / 60) => { let t = 0; const seen: string[] = []; while (t < max && !fn()) { P.update(dt); if (seen[seen.length - 1] !== P.state) seen.push(P.state); t += dt; } return { t, seen }; };

test('debout → sommeil : enchaîne assis, couché, préparation, sommeil — une seule transition à la fois', () => {
  const P = mk();
  P.request('sleep');
  const { seen } = runUntil(P, () => P.posture === 'sleep' && !P.busy);
  assert.deepEqual(seen.filter((s, i) => i === 0 || s !== seen[i - 1]), ['SittingDown', 'LyingDown', 'PreparingSleep', 'Sleeping']);
  assert.equal(P.weight, 1);
});

test('sommeil → debout : réveil, redressement, jamais de saut direct à la pose debout', () => {
  const P = mk();
  P.request('sleep'); runUntil(P, () => P.posture === 'sleep' && !P.busy);
  P.request('stand');
  const { seen } = runUntil(P, () => P.posture === 'stand' && !P.busy);
  assert.ok(seen.includes('WakingUp') && seen.filter((s) => s === 'StandingUp').length >= 1 && seen[seen.length - 1] === 'StandingIdle');
});

test('les ordres répétés ne redémarrent rien (appels répétés pendant le réveil)', () => {
  const P = mk();
  P.request('sleep'); runUntil(P, () => P.posture === 'sleep' && !P.busy);
  P.request('stand'); P.update(0.1);
  const id = P.seqId, name = P.state, prog = P.progress;
  for (let i = 0; i < 20; i++) { P.request('stand'); P.update(0.02); }
  assert.equal(P.seqId, id, 'même séquence');
  assert.equal(P.state, name);
  assert.ok(P.progress > prog, 'le réveil continue sans repartir de zéro');
});

test('jamais deux séquences superposées : le poids et la pose évoluent continûment (pas de saut entre images)', () => {
  const P = mk();
  P.request('sleep');
  let prev = Float64Array.from(P.pose), maxJump = 0;
  for (let i = 0; i < 60 * 8; i++) {
    P.update(1 / 60);
    for (let j = 0; j < P.pose.length; j++) maxJump = Math.max(maxJump, Math.abs(P.pose[j] - prev[j]));
    prev = Float64Array.from(P.pose);
  }
  assert.ok(maxJump < 3, `variation maximale d'un angle entre deux images : ${maxJump.toFixed(2)}°`);
});

test('étirement : seulement debout et immobile ; toilette : seulement assis', () => {
  const P = mk();
  assert.equal(P.groom(), false, 'pas de toilette debout');
  assert.equal(P.stretch(), true);
  runUntil(P, () => P.lastDone?.name === 'Stretching' && !P.busy);
  assert.equal(P.posture, 'stand');
  P.request('sit'); runUntil(P, () => P.posture === 'sit' && !P.busy);
  assert.equal(P.stretch(), false, 'pas d\'étirement assis');
  assert.equal(P.groom(), true);
});

test('toilette interrompue : le geste en cours s\'achève, la patte est reposée, puis assis', () => {
  const P = mk(4);
  P.request('sit'); runUntil(P, () => P.posture === 'sit' && !P.busy);
  P.groom(); runUntil(P, () => P.state === 'Grooming' && P.contact > 0.9, 20);
  const before = P.remaining;
  P.abortGroom();
  assert.ok(P.remaining <= before + 1e-9 && P.remaining < 3.5, `la séquence est raccourcie (${P.remaining.toFixed(1)} s restantes)`);
  const { t } = runUntil(P, () => P.state === 'SittingIdle', 10);
  assert.ok(t < 3.5, 'terminé rapidement');
  assert.equal(P.contact, 0, 'plus de contact patte-museau');
});

test('la respiration est une rotation de colonne, très faible (jamais une mise à l\'échelle)', () => {
  const P = mk();
  P.request('sleep'); runUntil(P, () => P.posture === 'sleep' && !P.busy);
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < 60 * 8; i++) { P.update(1 / 60); const v = P.pose[3 * 2]; mn = Math.min(mn, v); mx = Math.max(mx, v); }
  assert.ok(mx - mn > 0.2 && mx - mn < 3, `amplitude ${(mx - mn).toFixed(2)}°`);
});

// -------------------------------------------------------------- vrai modèle
test('sol : le corps ne traverse jamais le sol et ne flotte pas pendant toutes les transitions (30 et 60 images/s)', async () => {
  for (const fps of [60, 30]) {
    const s = await makeRigSim(3);
    s.posture.request('sleep');
    let lo = Infinity, hi = -Infinity;
    s.run(1 / fps, 20, () => s.posture.posture === 'sleep' && !s.posture.busy, () => { if (s.posture.weight > 0.9) { const y = s.lowest(); lo = Math.min(lo, y); hi = Math.max(hi, y); } });
    s.posture.request('stand');
    s.run(1 / fps, 20, () => s.posture.posture === 'stand' && !s.posture.busy, () => { if (s.posture.weight > 0.9) { const y = s.lowest(); lo = Math.min(lo, y); hi = Math.max(hi, y); } });
    assert.ok(lo > -0.004, `${fps} fps : pénétration ${(lo * 100).toFixed(2)} cm`);
    assert.ok(hi < 0.004, `${fps} fps : flottement ${(hi * 100).toFixed(2)} cm`);
    assert.equal(s.group.position.length(), 0, 'le parent ne bouge pas');
  }
});

test('assis → debout : les antérieurs tenus ne glissent pas', async () => {
  const s = await makeRigSim(3);
  s.posture.request('sit'); s.run(1 / 60, 10, () => s.posture.posture === 'sit' && !s.posture.busy);
  s.posture.request('stand');
  let start: number[][] | null = null, drift = 0;
  s.run(1 / 60, 10, () => s.posture.posture === 'stand' && !s.posture.busy, () => {
    if (!s.posture.seq) return;
    const hs = [s.pos('handL'), s.pos('handR')].map((v) => v.toArray());
    if (!start) start = hs;
    if (s.posture.progress < 0.78) hs.forEach((h, i) => { drift = Math.max(drift, Math.hypot(h[0] - start![i][0], h[2] - start![i][2])); });
  });
  assert.ok(drift < 0.015, `glissement ${(drift * 100).toFixed(1)} cm`);
});

test('toilette : la patte reste près du museau (≥ 1 cm : pas de traversée) pendant les gestes de contact', async () => {
  const s = await makeRigSim(5);
  s.posture.request('sit'); s.run(1 / 60, 10, () => s.posture.posture === 'sit' && !s.posture.busy);
  s.posture.groom();
  let lo = Infinity, hi = 0, n = 0;
  s.run(1 / 60, 30, () => s.posture.lastDone?.name === 'Grooming' && !s.posture.busy, () => {
    if (s.posture.state === 'Grooming' && s.posture.contact > 0.95) { const g = s.anim.debug().posture.groomGap; lo = Math.min(lo, g); hi = Math.max(hi, g); n++; }
  });
  assert.ok(n > 100, 'des gestes de contact ont lieu');
  assert.ok(lo >= 1.0, `distance minimale ${lo.toFixed(2)} cm`);
  assert.ok(hi <= 2.5, `la patte ne flotte pas loin du museau : ${hi.toFixed(2)} cm au plus`);
});

test('aucun clip de marche pendant les postures', async () => {
  const s = await makeRigSim(5);
  s.posture.request('sleep');
  let maxW = 0;
  s.run(1 / 60, 20, () => s.posture.posture === 'sleep' && !s.posture.busy, () => { const d = s.anim.debug(); maxW = Math.max(maxW, d.walkW, d.runW); });
  assert.ok(maxW < 0.01, `poids de marche ${maxW}`);
});
