import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_BEHAVIOR } from '../src/config/behavior';
import { SOFA } from '../src/pet/layout';
import { makeSim, run, segments } from './helpers/sim';

const B = DEFAULT_BEHAVIOR;
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

function stats(seed: number, aspect: number, fps: number, seconds = 600) {
  const sim = makeSim({ seed, aspect });
  const frames = run(sim, seconds, fps);
  const seg = segments(frames);
  const trips = seg.filter((s) => s.state === 'walk');
  return { sim, frames, seg, trips };
}

for (const [name, aspect, fps] of [['portrait 60 fps', 0.56, 60], ['portrait 30 fps', 0.56, 30], ['paysage 60 fps', 1.78, 60]] as const) {
  test(`autonomie sur 10 min (${name}) : pauses visibles, destinations variées, pas de patrouille`, () => {
    const { frames, seg, trips, sim } = stats(3, aspect, fps);
    // pauses réellement visibles : une observation de 2–6 s après (presque) chaque trajet
    const after = trips.map((t) => seg[seg.indexOf(t) + 1]).filter((s) => s && s.state === 'observe' && s.end < 598).map((s) => s.end - s.start); // (la dernière, coupée par la fin de la simulation, est exclue)
    assert.ok(after.length >= trips.length * 0.75, `${after.length}/${trips.length} trajets suivis d'une observation`);
    assert.ok(Math.min(...after) >= B.observeAfterTrip[0] - 0.15 && Math.max(...after) <= B.observeAfterTrip[1] + 0.15, `observation ${Math.min(...after).toFixed(1)}–${Math.max(...after).toFixed(1)} s`);
    // pauses longues de 8 à 20 s
    const rests = seg.filter((s) => ['rest', 'sit', 'groom', 'sleep'].includes(s.state) && s.end < 595).map((s) => s.end - s.start); // pauses : debout, assis, toilette, sommeil
    assert.ok(rests.length >= 2, `${rests.length} pauses longues`);
    const standing = seg.filter((s) => s.state === 'rest' && s.end < 595).map((s) => s.end - s.start);
    if (standing.length) assert.ok(Math.min(...standing) >= B.longPause[0] - 0.2 && Math.max(...standing) <= B.longPause[1] + 0.2, `pauses debout ${Math.min(...standing).toFixed(1)}–${Math.max(...standing).toFixed(1)} s`);
    // jamais trois trajets consécutifs sans arrêt
    let chain = 1, maxChain = 1;
    for (let i = 1; i < seg.length; i++) { chain = seg[i].state === 'walk' && seg[i - 1].state === 'walk' ? chain + 1 : 1; maxChain = Math.max(maxChain, chain); }
    assert.ok(maxChain <= B.maxTripsInRow, `trajets d'affilée : ${maxChain}`);
    // destinations variées, sans répétition immédiate, aller-retours rares
    const seq = trips.map((t) => t.poi); // (les retours dans la zone sûre n'ont pas de point d'intérêt : null)
    assert.ok(new Set(seq).size >= (aspect < 1 ? 4 : 6), `${new Set(seq).size} destinations distinctes`);
    let same = 0, aba = 0;
    for (let i = 1; i < seq.length; i++) if (seq[i] !== null && seq[i] === seq[i - 1]) same++;
    for (let i = 2; i < seq.length; i++) if (seq[i] === seq[i - 2] && seq[i] !== seq[i - 1]) aba++;
    assert.equal(same, 0, 'jamais deux fois de suite la même destination');
    assert.ok(aba <= seq.length * 0.3, `aller-retours A→B→A : ${aba}/${seq.length}`);
    // pas de déplacement minuscule sans intention
    const starts = sim.behavior.events.filter((e) => e.detail.startsWith('walk→')).map((e) => e.t);
    const real = trips.filter((t) => t.end - t.start > 2.5 && starts.filter((x) => x >= t.start - 0.05 && x <= t.end).length === 1); // un trajet enchaîné (deux destinations d'affilée) ne se mesure pas de bout en bout
    assert.ok(real.every((t) => dist(t.from, t.to) >= 0.3), 'aucun trajet minuscule');
    // pas de patrouille permanente : l'animal passe l'essentiel du temps à l'arrêt
    const walking = frames.filter((f) => f.speed > 0.08).length / frames.length;
    const still = frames.filter((f) => f.speed < 0.03).length / frames.length;
    assert.ok(walking < 0.38, `marche ${(walking * 100).toFixed(0)} % du temps`);
    assert.ok(still > 0.5, `à l'arrêt ${(still * 100).toFixed(0)} % du temps`);
    // profondeur : pas tout le temps au fond, présence au premier plan, centre bien représenté
    const share = (z: string) => frames.filter((f) => f.zone === z).length / frames.length;
    assert.ok(share('back') < 0.3, `fond ${(share('back') * 100).toFixed(0)} %`);
    assert.ok(share('front') >= 0.15, `premier plan ${(share('front') * 100).toFixed(0)} %`);
    assert.ok(share('mid') >= 0.2, `centre ${(share('mid') * 100).toFixed(0)} %`);
    // aucun blocage dans la pièce libre, jamais dans le canapé
    assert.equal(sim.behavior.events.filter((e) => e.detail.includes('bloqué')).length, 0);
    for (const f of frames) assert.ok(dist({ x: Math.max(SOFA.minX, Math.min(f.x, SOFA.maxX)), z: Math.max(SOFA.minZ, Math.min(f.z, SOFA.maxZ)) }, f) >= B.bodyRadius - 0.01, 'jamais dans le mobilier');
  });
}

test('approche de l\'utilisateur : 25–50 s, arrêt au premier plan 3–7 s, jamais tout de suite', () => {
  const { seg, sim, frames } = stats(5, 0.56, 60);
  const goes = seg.filter((s) => s.state === 'approach' && s.phase === 'go');
  const stays = seg.filter((s) => s.state === 'approach' && s.phase === 'stay');
  assert.ok(stays.length >= 6 && stays.length <= 24, `${stays.length} approches en 10 min`);
  assert.ok(stays.every((s) => s.end - s.start >= B.approach.stay[0] - 0.2 && s.end - s.start <= B.approach.stay[1] + 0.2), 'séjour 3–7 s');
  assert.ok(goes[0].start >= B.approach.firstDelay[0] - 0.5, `première approche à ${goes[0].start.toFixed(0)} s (pas à chaque ouverture)`);
  // l'intervalle entre deux approches reste dans la plage (+ attente de la fin d'une observation / pause)
  const gaps = stays.slice(1).map((s, i) => s.start - stays[i].end);
  assert.ok(Math.min(...gaps) >= B.approach.every[0] - 1, `intervalle min ${Math.min(...gaps).toFixed(0)} s`);
  // il arrive au point d'approche, face à la caméra
  const a = sim.framing.approach;
  for (const s of stays.slice(0, 5)) { const f = frames.find((x) => x.t >= s.start + 0.5)!; assert.ok(dist(f, a) < 0.2, `position ${dist(f, a).toFixed(2)} m du point d'approche`); }
});

test('approche : il se tourne vers la caméra et la regarde, puis reprend une activité', () => {
  const sim = makeSim({ seed: 2 });
  sim.behavior.call();
  let faced = false, gaze = false, left = false;
  for (let t = 0; t < 40; t += 1 / 60) {
    sim.step(1 / 60);
    const c = sim.framing.position;
    const toCam = Math.atan2(c[0] - sim.loco.s.x, c[2] - sim.loco.s.z);
    if (sim.behavior.approachPhase === 'stay' && Math.abs(Math.atan2(Math.sin(toCam - sim.loco.s.heading), Math.cos(toCam - sim.loco.s.heading))) < 0.25) faced = true;
    if (sim.behavior.approachPhase === 'stay' && sim.loco.s.gazeYaw !== null) gaze = true;
    if (faced && sim.behavior.state !== 'approach') left = true;
  }
  assert.ok(faced && gaze && left);
});

test('durées tirées une seule fois à l\'entrée de l\'état', () => {
  const sim = makeSim({ seed: 9 });
  const frames = run(sim, 120, 60);
  let cur = { state: '', dur: -1 };
  for (const f of frames) {
    if (f.state !== cur.state || (f.state === 'approach' && f.phase === 'go')) cur = { state: f.state, dur: f.dur };
    else if (f.state !== 'approach' && !['sit', 'groom', 'sleep', 'stretch'].includes(f.state)) assert.equal(f.dur, cur.dur, `durée de ${f.state} modifiée en cours d'état`);
  }
});

test('déterministe avec une graine fixe, différent avec une autre', () => {
  const sig = (seed: number) => segments(run(makeSim({ seed }), 120, 60)).map((s) => `${s.state}:${s.poi}:${s.start.toFixed(1)}`).join('|');
  assert.equal(sig(4), sig(4));
  assert.notEqual(sig(4), sig(5));
});

test('toucher pendant un trajet : arrêt progressif sans téléportation, puis retour au comportement autonome', () => {
  const sim = makeSim({ seed: 3 });
  let t = 0;
  while (sim.behavior.state !== 'walk' && t < 120) { sim.step(1 / 60); t += 1 / 60; }
  for (let i = 0; i < 60 * 8 && sim.loco.realSpeedRaw < 0.3; i++) sim.step(1 / 60); // attend que la marche soit établie (après le pivot éventuel)
  assert.ok(sim.loco.realSpeedRaw > 0.3, 'il marche');
  const vmax = sim.loco.s.speed;
  sim.behavior.touch();
  assert.equal(sim.behavior.state as string, 'react');
  let prev = { x: sim.loco.s.x, z: sim.loco.s.z }, prevV = sim.loco.s.speed, maxStep = 0, maxDv = 0;
  for (let i = 0; i < 60 * 12; i++) {
    sim.step(1 / 60);
    maxStep = Math.max(maxStep, dist(prev, sim.loco.s)); prev = { x: sim.loco.s.x, z: sim.loco.s.z };
    maxDv = Math.max(maxDv, Math.abs(sim.loco.s.speed - prevV) * 60); prevV = sim.loco.s.speed;
  }
  assert.ok(maxStep <= (vmax + 0.1) / 60 * 1.5, `pas max ${(maxStep * 1000).toFixed(1)} mm/image : pas de téléportation`);
  assert.ok(maxDv <= 2.5, `variation de vitesse ${maxDv.toFixed(2)} m/s² : freinage progressif`);
  assert.notEqual(sim.behavior.state as string, 'react', 'la réaction est terminée');
  // activité autonome reprise : un nouveau trajet démarre dans les secondes qui suivent
  let resumed = false;
  for (let i = 0; i < 60 * 25 && !resumed; i++) { sim.step(1 / 60); if ((sim.behavior.state as string) === 'walk' || (sim.behavior.state as string) === 'approach') resumed = true; }
  assert.ok(resumed, 'reprise d\'une activité plausible');
});

test('blocage contre un obstacle : détecté, destination abandonnée, alternative choisie', () => {
  const sim = makeSim({ seed: 1, x: 0.8, z: -0.5 });
  const events: string[] = [];
  sim.behavior.goTo(0.95, -1.3, 'walk');                    // au milieu du canapé : inaccessible
  let blockedAt = -1;
  for (let t = 0; t < 30 && blockedAt < 0; t += 1 / 60) {
    sim.step(1 / 60);
    if (sim.behavior.events.some((e) => e.detail.includes('bloqué'))) blockedAt = t;
  }
  assert.ok(blockedAt > 0 && blockedAt < B.stall.timeout + 5, `blocage détecté à ${blockedAt.toFixed(1)} s`);
  assert.equal(sim.behavior.state as string, 'observe', 'il cesse de marcher contre le mobilier');
  for (let i = 0; i < 60; i++) sim.step(1 / 60);
  assert.ok(sim.loco.realSpeed < 0.05, 'la vitesse réelle tombe à zéro');
  assert.ok(events.length === 0);
  // il ne reste pas bloqué : après quelques secondes, une activité normale reprend
  let moved = false;
  for (let t = 0; t < 40 && !moved; t += 1 / 60) { sim.step(1 / 60); if (sim.behavior.state === 'walk' && sim.loco.realSpeedRaw > 0.3) moved = true; }
  assert.ok(moved, 'une alternative est choisie');
});

test('destinations jamais dans le mobilier ni hors du champ, espace libre autour du corps', () => {
  const { sim } = stats(11, 0.56, 60, 300);
  const spots = sim.behavior.events.filter((e) => e.detail.startsWith('walk→'));
  assert.ok(spots.length > 10);
  for (let seed = 1; seed <= 20; seed++) {
    const s = makeSim({ seed, aspect: 0.56 });
    for (let i = 0; i < 60 * 60; i++) s.step(1 / 60);
    const d = s.behavior.destination;
    if (d) assert.ok(s.area.isFree(d.x, d.z, B.bodyRadius * 0.9), 'destination avec espace libre autour du corps');
  }
});
