import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_BEHAVIOR, BehaviorConfig } from '../src/config/behavior';
import { STATE_SPECS } from '../src/config/activities';
import { makeSim } from './helpers/sim';

const cfgWith = (over: Partial<BehaviorConfig['activities']> = {}): BehaviorConfig => ({ ...DEFAULT_BEHAVIOR, activities: { ...DEFAULT_BEHAVIOR.activities, ...over } });
type Sim = ReturnType<typeof makeSim>;
const until = (sim: Sim, fn: () => boolean, max = 120, dt = 1 / 60) => { let t = 0; while (t < max && !fn()) { sim.step(dt); t += dt; } return t; };
const calm = (sim: Sim) => { sim.behavior.autonomy = false; until(sim, () => sim.behavior.state === 'observe' && sim.loco.realSpeed < 0.02 && sim.behavior.stateTime > 0.5, 30); };

test('Forcer sommeil : mêmes transitions que l\'autonomie (assis, couché, préparation, sommeil), sans saut', () => {
  const sim = makeSim({ seed: 2 }); calm(sim);
  const seen: string[] = [];
  sim.behavior.force('sleep');
  until(sim, () => { if (seen[seen.length - 1] !== sim.posture.state) seen.push(sim.posture.state); return sim.behavior.state === 'sleep' && sim.behavior.phase === 'hold'; }, 60);
  assert.deepEqual(seen.slice(0, 5), ['StandingIdle', 'SittingDown', 'LyingDown', 'PreparingSleep', 'Sleeping']);
});

test('sommeil : durée tirée une seule fois (20–60 s en démonstration), position et orientation stables, aucune destination', () => {
  const sim = makeSim({ seed: 3 }); calm(sim);
  sim.behavior.force('sleep');
  until(sim, () => sim.behavior.phase === 'hold', 60);
  const dur = sim.behavior.stateDuration, x = sim.loco.s.x, z = sim.loco.s.z, h = sim.loco.s.heading;
  assert.ok(dur >= 20 && dur <= 60, `durée ${dur.toFixed(1)}`);
  for (let i = 0; i < 60 * 15; i++) { sim.step(1 / 60); assert.equal(sim.behavior.stateDuration, dur); assert.equal(sim.loco.status === 'moving', false); }
  assert.ok(Math.hypot(sim.loco.s.x - x, sim.loco.s.z - z) < 1e-6 && Math.abs(sim.loco.s.heading - h) < 1e-6);
});

test('mode production : sommeil de plusieurs minutes', () => {
  const sim = makeSim({ seed: 3, cfg: cfgWith({ mode: 'production' }) }); calm(sim);
  sim.behavior.force('sleep');
  until(sim, () => sim.behavior.phase === 'hold', 60);
  assert.ok(sim.behavior.stateDuration >= 180, `durée ${sim.behavior.stateDuration.toFixed(0)}`);
});

test('appel pendant le sommeil : réveil complet, il se relève, puis seulement vient ; appels répétés = un seul réveil', () => {
  const sim = makeSim({ seed: 4 }); calm(sim);
  sim.behavior.force('sleep');
  until(sim, () => sim.behavior.phase === 'hold', 60);
  sim.behavior.call();
  const id = sim.posture.seqId; const names: string[] = []; let walkedBeforeStanding = false;
  for (let i = 0; i < 60 * 40 && sim.behavior.state !== 'approach'; i++) {
    sim.step(1 / 60);
    if (i % 30 === 0) sim.behavior.call();                         // appels répétés
    if (names[names.length - 1] !== sim.posture.state) names.push(sim.posture.state);
    if (sim.posture.state !== 'StandingIdle' && sim.loco.realSpeed > 0.05) walkedBeforeStanding = true;
  }
  assert.equal(sim.behavior.state, 'approach');
  assert.equal(walkedBeforeStanding, false, 'aucune translation avant d\'être debout');
  assert.equal(names[0], 'WakingUp');
  assert.equal(names.filter((n) => n === 'WakingUp').length, 1, 'le réveil n\'a pas redémarré');
  assert.equal(names[names.length - 1], 'StandingIdle');
  assert.ok(sim.posture.seqId > id);
});

test('caresse pendant le sommeil : ne réveille pas systématiquement et ne casse pas la pose', () => {
  let woke = 0, stayed = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const sim = makeSim({ seed }); calm(sim);
    sim.behavior.force('sleep'); until(sim, () => sim.behavior.phase === 'hold', 60);
    sim.behavior.touch();
    for (let i = 0; i < 60 * 3; i++) sim.step(1 / 60);
    if (sim.posture.state === 'Sleeping' && sim.behavior.state === 'sleep' && sim.behavior.phase === 'hold') stayed++; else woke++;
  }
  assert.ok(stayed >= 3 && woke >= 1, `resté endormi ${stayed}/12, réveillé ${woke}/12`);
});

test('appel pendant la toilette : fin du geste, patte reposée, se relève, puis seulement vient', () => {
  const sim = makeSim({ seed: 6 }); calm(sim);
  sim.behavior.force('groom');
  until(sim, () => sim.posture.state === 'Grooming' && sim.posture.contact > 0.9, 60);
  sim.behavior.call();
  let pawUpWhileStanding = false;
  for (let i = 0; i < 60 * 20 && sim.behavior.state !== 'approach'; i++) {
    sim.step(1 / 60);
    if (sim.posture.state === 'StandingUp' && sim.posture.contact > 0) pawUpWhileStanding = true;
  }
  assert.equal(sim.behavior.state, 'approach');
  assert.equal(sim.posture.posture, 'stand');
  assert.equal(pawUpWhileStanding, false, 'jamais debout avec la patte contre le visage');
});

test('interaction pendant une transition : mise en attente, jamais de transitions superposées', () => {
  const sim = makeSim({ seed: 7 }); calm(sim);
  sim.behavior.force('sit');
  until(sim, () => sim.posture.state === 'SittingDown', 10);
  sim.behavior.touch();
  assert.equal(sim.behavior.pending, 'touch');
  let overlap = 0, last = sim.posture.seqId;
  for (let i = 0; i < 60 * 12; i++) { sim.step(1 / 60); if (sim.posture.seqId !== last) { last = sim.posture.seqId; } if (sim.posture.busy && sim.behavior.state === 'react') overlap++; }
  assert.equal(overlap, 0);
  assert.ok(['react', 'observe'].includes(sim.behavior.state));
});

test('toilette autonome : 8–18 s de séquence, séries de 2–4 gestes', () => {
  const sim = makeSim({ seed: 8 }); calm(sim);
  sim.behavior.force('groom');
  const d: number[] = [];
  let t0 = -1;
  until(sim, () => { if (sim.posture.state === 'Grooming' && t0 < 0) t0 = sim.posture.time; if (t0 >= 0 && sim.posture.state !== 'Grooming') { d.push(sim.posture.time - t0); return true; } return false; }, 60);
  assert.ok(d[0] >= 8 && d[0] <= 18, `durée de la séquence ${d[0]?.toFixed(1)} s`);
});

test('observation : une ou deux cibles tirées une fois, regard limité par le cou, le corps ne pivote pas', () => {
  const sim = makeSim({ seed: 9 }); sim.behavior.autonomy = false;
  const h0 = sim.loco.s.heading;
  const yaws = new Set<number>(); let maxOff = 0, changes = 0, last: number | null = null;
  for (let i = 0; i < 60 * 6; i++) {
    sim.step(1 / 60);
    if (sim.behavior.state !== 'observe') continue;
    const g = sim.loco.s.gazeYaw;
    if (g !== null) { yaws.add(+g.toFixed(3)); maxOff = Math.max(maxOff, Math.abs(g - sim.loco.s.heading)); }
    if (g !== last) { changes++; last = g; }
  }
  assert.ok(yaws.size >= 1 && yaws.size <= 2, `${yaws.size} cible(s) de regard`);
  assert.ok(maxOff <= 52 * Math.PI / 180, `écart cou ${maxOff.toFixed(2)} rad`);
  assert.ok(Math.abs(sim.loco.s.heading - h0) < 0.05, 'le corps n\'a pas pivoté');
  assert.ok(changes <= 4, `${changes} changements de regard`);
});

test('spécification des états : chaque successeur déclaré existe, chaque état a entrée, interruption, sortie et reprise', () => {
  const names = new Set([...Object.keys(STATE_SPECS), 'react', 'approach', 'choose', 'examine']);
  for (const [k, s] of Object.entries(STATE_SPECS)) {
    for (const n of s.next) assert.ok(names.has(n), `${k} → ${n}`);
    assert.ok(s.entry && s.interrupt && s.exitPose && s.resume && s.sequence && s.duration, k);
  }
});

test('autonomie 10 min : marche, observation, repos et activités posturales se mélangent, sans répétition immédiate ni translation en posture', () => {
  const sim = makeSim({ seed: 11, aspect: 0.56 });
  const seq: string[] = []; let bad = 0;
  for (let i = 0; i < 60 * 600; i++) {
    sim.step(1 / 30 * 0.5);
    const st = sim.behavior.state;
    if (seq[seq.length - 1] !== st) seq.push(st);
    if (sim.posture.state !== 'StandingIdle' && sim.loco.realSpeed > 0.05) bad++;
  }
  assert.equal(bad, 0, 'aucun déplacement du corps pendant une posture');
  const acts = seq.filter((s) => ['sit', 'groom', 'sleep', 'stretch'].includes(s));
  assert.ok(acts.length >= 3, `${acts.length} activités posturales`);
  for (let i = 1; i < acts.length; i++) assert.notEqual(acts[i], acts[i - 1], `répétition immédiate de ${acts[i]}`);
  assert.ok(seq.filter((s) => s === 'walk').length >= 5, 'il marche encore');
});

// ---------------------------------------------------------------- cadre
for (const [name, aspect, seeds] of [['portrait', 0.56, [1, 7, 11]], ['paysage', 1.78, [2, 5]]] as const) {
  test(`cadre (${name}) : le compagnon n'est jamais coupé par le bord, destinations et chemins compris, 10 min d'autonomie`, () => {
    const keyOf = (st: string, moving: boolean) => (st === 'Sleeping' || st === 'PreparingSleep' ? ['sleep'] : st === 'Lying' || st === 'LyingDown' ? ['lie', 'sit'] : st === 'SittingIdle' || st === 'SittingDown' || st === 'StandingUp' ? ['sit', 'stand'] : st === 'Grooming' ? ['groom'] : st === 'Stretching' ? ['stretch'] : st === 'WakingUp' ? ['sleep', 'lie'] : [moving ? 'walk' : 'stand']) as ('sleep' | 'lie' | 'sit' | 'stand' | 'groom' | 'stretch' | 'walk')[];
    for (const seed of seeds) {
      const sim = makeSim({ seed, aspect }); const g = sim.guard!;
      let bad = 0, returns = 0, total = 0, visiting = false; let worst = '';
      for (let i = 0; i < 60 * 600; i++) {
        sim.step(1 / 60);
        const st = sim.behavior.state;
        const s = sim.loco.s;
        if (st === 'approach' || st === 'react') { visiting = true; continue; }             // venir devant la caméra est volontaire
        if (visiting) { if (g.fitsAnyHeading(s.x, s.z, 'walk', 0.06)) visiting = false; else continue; } // retour de visite : marche normale jusqu'à la zone
        total++;
        for (const k of keyOf(sim.posture.state, sim.loco.realSpeed > 0.1)) if (!g.fitsPose(s.x, s.z, s.heading, k, 0.06)) { bad++; worst = `${st}/${sim.posture.state} ${k} (${s.x.toFixed(2)}, ${s.z.toFixed(2)})`; break; }
      }
      returns = sim.behavior.events.filter((e) => e.detail.startsWith('retour dans')).length;
      assert.ok(bad / total < 0.002, `${name} graine ${seed} : ${bad}/${total} images coupées (dernier : ${worst}) ; retours : ${returns}`);
    }
  });
}

test('déjà hors de la zone sûre : il revient en marchant (sans téléportation)', () => {
  const sim = makeSim({ seed: 3, aspect: 0.56, x: -0.8, z: 0.4 }); const g = sim.guard!;
  assert.equal(g.fitsPose(-0.8, 0.4, 0, 'stand'), false, 'point de départ hors zone');
  let maxJump = 0, px = sim.loco.s.x, pz = sim.loco.s.z;
  const t = until(sim, () => { const s = sim.loco.s; maxJump = Math.max(maxJump, Math.hypot(s.x - px, s.z - pz)); px = s.x; pz = s.z; return sim.behavior.events.some((e) => e.detail.startsWith('retour dans')) && g.fitsPose(s.x, s.z, s.heading, 'stand') && sim.loco.realSpeed < 0.05; }, 60);
  assert.ok(t < 60, 'revenu dans la zone');
  assert.ok(maxJump < 0.02, `déplacement maximal par image ${maxJump}`);
});

test('sommeil / toilette : la pose complète est vérifiée avant de commencer ; sinon il rejoint d\'abord une zone adaptée', () => {
  const sim = makeSim({ seed: 3, aspect: 0.56, x: -0.55, z: 0.3 }); const g = sim.guard!;
  assert.equal(g.bestHeading(-0.55, 0.3, 'sleep', 0), null);
  sim.behavior.autonomy = false;
  until(sim, () => sim.behavior.state === 'observe' && sim.behavior.stateTime > 0.5, 30);
  sim.behavior.force('sleep');
  let slept = false, pose = '';
  until(sim, () => { if (sim.posture.state !== 'StandingIdle' && !slept) { slept = true; pose = `${sim.loco.s.x.toFixed(2)},${sim.loco.s.z.toFixed(2)}`; } return sim.behavior.phase === 'hold'; }, 90);
  assert.equal(sim.behavior.phase, 'hold');
  assert.ok(g.fitsPose(sim.loco.s.x, sim.loco.s.z, sim.loco.s.heading, 'sleep'), `il dort là où la pose entière tient (${pose})`);
});
