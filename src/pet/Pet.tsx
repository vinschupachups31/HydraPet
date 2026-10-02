import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ThreeEvent, useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { DEFAULT_ANIMATION } from '../config/animation';
import { DEFAULT_BEHAVIOR } from '../config/behavior';
import { CLIP_DATA } from '../config/foxClips';
import { PetModelConfig } from '../config/pet';
import { DEFAULT_TURN } from '../config/turning';
import { diag } from '../diag/diagStore';
import { AnimationController } from './animation';
import { BehaviorController } from './behavior';
import { ContactTracker, slipThreshold } from './contactMetrics';
import { debugStore } from './debugStore';
import { DIAG_SCENARIOS, DiagRunner } from './diagnostic';
import { FrameGuard } from './frameGuard';
import { Framing } from './framing';
import { WalkArea, resolvePoi } from './layout';
import { LocomotionController } from './locomotor';
import { PostureController } from './posture';
import { mulberry32 } from './rng';
import { overlayData, viewStore } from './viewStore';

interface Props {
  config: PetModelConfig;
  source: string;
  /** Cadrage de jeu (point d'approche, champ visible) : indépendant du gros plan de développement. */
  framing: Framing;
}

/** L'animal : orchestre les trois contrôleurs, dans cet ordre précis à chaque image :
 *  1. comportement (intention) → 2. locomotion (position, orientation, vitesse réelle)
 *  → 3. animation (clips, cadence, appuis, tête). Un seul système commande la position et l'orientation. */
export function Pet({ config, source, framing }: Props) {
  const gltf = useLoader(GLTFLoader, source);
  const root = useMemo(() => {
    const r = cloneSkinned(gltf.scene) as THREE.Object3D;
    r.scale.setScalar(config.scale);
    r.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; }
    });
    return r;
  }, [gltf, config.scale]);

  const framingRef = useRef(framing);
  framingRef.current = framing;

  const ctl = useMemo(() => {
    const seed = (globalThis as { __HP_SEED__?: number }).__HP_SEED__;
    const rng = seed !== undefined ? mulberry32(seed) : Math.random;
    const animCfg = DEFAULT_ANIMATION;
    const anim = new AnimationController(root, gltf.animations, config, animCfg, CLIP_DATA);
    const bcfg = DEFAULT_BEHAVIOR;
    // vitesse de croisière = vitesse nominale du clip : cadence de lecture 1,0 (aucun patinage dû à un décalage de référence)
    const turn = { ...DEFAULT_TURN, vWalk: anim.nominalWalk, vRun: anim.nominalRun, arriveRadius: bcfg.arrive.radius, ...config.turn };
    const area = new WalkArea();
    area.view = { halfWidthAt: (z) => framingRef.current.halfWidthAt(z), get maxZ() { return framingRef.current.maxZ; } };
    area.guard = new FrameGuard(() => framingRef.current);
    const loco = new LocomotionController(turn, area, bcfg.bodyRadius, bcfg.stall, 0, 0.3, 0, bcfg.arrive.hysteresis, animCfg.speedSmoothing);
    const posture = new PostureController(rng);
    anim.posture = posture;
    const behavior = new BehaviorController({
      loco, area, cfg: bcfg, rng, posture,
      approachPoint: () => framingRef.current.approach,
      cameraXZ: () => ({ x: framingRef.current.position[0], z: framingRef.current.position[2] }),
    });
    const tracker = new ContactTracker();
    const diag = new DiagRunner({ goTo: (x, z, g) => loco.goTo(x, z, g), isMoving: () => loco.isMoving, face: (x, z) => loco.faceTowards(x, z), isFacing: () => loco.status === 'faced' });
    return { anim, loco, behavior, posture, animCfg, area, bcfg, tracker, diag };
  }, [root, gltf, config]);

  useEffect(() => {
    overlayData.pois = ctl.bcfg.pois.map((p) => ({ id: p.id, ...resolvePoi(p, ctl.area.view, ctl.bcfg.viewEdgeMargin), r: p.radius }));
  }, [ctl, framing]);

  const group = useRef<THREE.Group>(null);
  const yawOffsetQ = useMemo(() => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), config.yawOffset), [config.yawOffset]);
  const fps = useRef({ t: 0, n: 0 });
  const timeScale = useRef(1);
  const diagWasAuto = useRef(true);
  const tmp = useMemo(() => ({ v: new THREE.Vector3() }), []);

  useEffect(() => {
    const { anim, behavior, animCfg } = ctl;
    const bcfgRef = ctl.bcfg;
    diag.step('model', 'ok', `Modèle chargé et analysé : ${gltf.animations.length} clips (${gltf.animations.map((a) => a.name).join(', ')})`);
    debugStore.set({ loaded: true, clips: gltf.animations.map((a) => `${a.name} ${a.duration.toFixed(2)}s`).join(' · '), ik: animCfg.ik.enabled });
    debugStore.commands.call = () => behavior.call();
    debugStore.commands.touch = () => behavior.touch();
    debugStore.commands.goTo = (x, z, gait) => behavior.goTo(x, z, gait);
    debugStore.commands.toggleGait = () => { behavior.toggleForcedGait(); debugStore.set({ gait: behavior.forcedGait ?? 'auto' }); };
    debugStore.commands.toggleAutonomy = () => { behavior.autonomy = !behavior.autonomy; debugStore.set({ autonomy: behavior.autonomy }); };
    debugStore.commands.force = (k) => behavior.force(k);
    debugStore.commands.diag = (id) => {                       // diagnostic : décisions autonomes suspendues, caméra de profil et superposition activées (outil de développement)
      ctl.tracker.reset(); ctl.diag.start(id); diagWasAuto.current = behavior.autonomy; behavior.autonomy = false; behavior.forceDiagnostic();
      viewStore.set({ devSide: true, devClose: false, overlay: true }); debugStore.set({ diag: id, diagReport: [], autonomy: false });
    };
    debugStore.commands.diagStop = () => { ctl.diag.stop(); behavior.autonomy = diagWasAuto.current; debugStore.set({ diag: '-', diagStep: '-', autonomy: behavior.autonomy }); };
    debugStore.commands.toggleMode = () => { bcfgRef.activities.mode = bcfgRef.activities.mode === 'demo' ? 'production' : 'demo'; debugStore.set({ mode: bcfgRef.activities.mode }); };
    debugStore.commands.setSpeed = (v) => { timeScale.current = v; debugStore.set({ simSpeed: v }); };
    debugStore.set({ mode: bcfgRef.activities.mode, simSpeed: 1 });
    debugStore.commands.toggleIK = () => { animCfg.ik.enabled = !animCfg.ik.enabled; debugStore.set({ ik: animCfg.ik.enabled }); };
    const g = globalThis as { __HP_PROBE__?: unknown; __HP_API__?: unknown };
    if (g.__HP_PROBE__) {
      g.__HP_API__ = {
        goTo: (x: number, z: number, gait?: 'walk' | 'run') => behavior.goTo(x, z, gait),
        autonomy: (v: boolean) => { behavior.autonomy = v; },
        touch: () => behavior.touch(),
        call: () => behavior.call(),
        force: (k: Parameters<typeof behavior.force>[0]) => behavior.force(k),
        diag: (id: string) => debugStore.commands.diag?.(id),
        diagReport: () => ({ ...ctl.tracker.report(), running: ctl.diag.active, runs: ctl.tracker.runs }),
        diagActive: () => ctl.diag.active,
        posture: () => ctl.posture,
        behavior: () => behavior,
        speed: (v: number) => { timeScale.current = v; },
        mode: (m: 'demo' | 'production') => { bcfgRef.activities.mode = m; },
        ik: (v: boolean) => { animCfg.ik.enabled = v; },
        events: () => behavior.events,
        nominal: () => ({ walk: anim.nominalWalk, run: anim.nominalRun }),
        tuning: () => ({ animCfg, bcfg: ctl.bcfg }),
      };
    }
    return () => { debugStore.commands = {}; };
  }, [ctl, gltf]);

  const firstFrame = useRef(false);
  useFrame((state, delta) => {
    if (!firstFrame.current) { firstFrame.current = true; diag.step('frame', 'ok', 'Première image dessinée avec le modèle animé'); }
    const { anim, loco, behavior, posture } = ctl;
    const s = loco.s;
    // vitesse de simulation (outil de test) : le temps simulé est découpé en pas ≤ 50 ms ; dt est borné contre une image anormalement longue
    const total = Math.min(delta, 0.1) * timeScale.current;
    const n = Math.max(1, Math.ceil(total / 0.05));
    const dt = total / n;
    for (let i = 0; i < n; i++) {
      ctl.diag.update(dt);
      behavior.update(dt);                         // 1. intention : activité, destination, posture demandée
      loco.update(dt);                             // 2. position, orientation, freinage, virages, collisions (le seul système qui déplace le parent)
      posture.update(dt);                          // 3. séquences de posture (pose cible)
    }
    if (group.current) {
      group.current.position.set(s.x, 0, s.z);
      group.current.quaternion.set(0, s.q.y, 0, s.q.w).multiply(yawOffsetQ);
    }
    anim.update(total, { realSpeed: loco.realSpeed, omega: s.omega, pivoting: s.pivoting }, { head: s.gazeHead, spine: s.gazeSpine, pitch: s.gazePitch }); // 4. clips, cadence, posture, appuis, tête

    // ---- diagnostic des appuis : mesure des phases d'appui identifiées, en coordonnées monde ----
    const dg = ctl.diag;
    if (dg.scenario) {
      if (dg.measuring) {
        const feet = anim.ik.feet.map((f, i) => { f.effector.getWorldPosition(tmp.v); return { x: tmp.v.x, y: tmp.v.y, z: tmp.v.z, phase: anim.contactPhase(i) }; });
        ctl.tracker.push({ t: behavior.time, x: s.x, z: s.z, heading: s.heading, speed: loco.realSpeedRaw, omega: s.omega }, feet);
      }
      if (dg.done) {
        ctl.tracker.finish(behavior.time);
        const o = ctl.tracker.report(), c = (q: { n: number; median: number; max: number; over: number }) => `${q.n} appuis · médiane ${(q.median * 100).toFixed(1)} cm · max ${(q.max * 100).toFixed(1)} cm · ${q.over} > seuil`;
        debugStore.set({ diagReport: [`seuil ${(o.threshold.relative * 100).toFixed(0)} % de ${o.threshold.bodyLength} m = ${(o.threshold.metres * 100).toFixed(1)} cm`, `longitudinal : ${c(o.longitudinal)}`, `latéral : ${c(o.lateral)}`, `à l'arrêt : ${c(o.arret)}`], diag: dg.scenario.id + ' (terminé)' });
        behavior.autonomy = diagWasAuto.current; debugStore.set({ autonomy: behavior.autonomy });
        dg.stop();
      }
    }
    // ---- sonde de test et debug (hors simulation) ----
    const probe = (globalThis as { __HP_PROBE__?: { frames: unknown[] } }).__HP_PROBE__;
    const dbg = anim.debug();
    if (probe) {
      const fr = framingRef.current;
      const head = fr.project(s.x, config.scale * 76, s.z), foot = fr.project(s.x, 0, s.z);
      probe.frames.push({
        t: state.clock.elapsedTime, dt, state: behavior.state, remaining: behavior.remaining, poi: behavior.poi?.id ?? null, zone: behavior.zone,
        phase: s.phase, pivoting: s.pivoting, x: s.x, z: s.z, heading: s.heading, omega: s.omega,
        speedReq: loco.requestedSpeed, speedReal: loco.realSpeed, speedRaw: loco.realSpeedRaw, status: loco.status,
        w: [dbg.idleW, dbg.walkW, dbg.runW], rates: [dbg.walkRate, dbg.runRate], locomoting: dbg.locomoting, clipPhase: dbg.phase,
        feet: anim.ik.feet.map((f) => f.effector.getWorldPosition(tmp.v).toArray()),
        contact: dbg.feet.map((f) => [f.inContact, f.weight, f.error, f.released]),
        cam: state.camera.position.toArray(), screen: { headY: head.y, footY: foot.y, x: foot.x },
        gaze: [s.gazeHead, s.gazeSpine],
        posture: { state: posture.state, seq: posture.seq?.def.name ?? null, w: posture.weight, goal: posture.goal, activity: behavior.state, phase: behavior.phase, pending: typeof behavior.pending === 'object' ? 'force' : behavior.pending, gap: dbg.posture.groomGap, shift: dbg.posture.groundShift, anchored: dbg.posture.anchored },
      });
    }
    overlayData.target = loco.target;
    overlayData.arriveRadius = ctl.bcfg.arrive.radius;
    overlayData.pos.x = s.x; overlayData.pos.z = s.z;
    if (viewStore.get().overlay) {
      const m = overlayData.markers; m.length = 0;
      const rg = anim.rig;
      const mz = rg.muzzle(tmp.v); m.push({ x: mz.x, y: mz.y, z: mz.z, color: '#e0245e' });
      const pd = rg.pad('R', tmp.v); m.push({ x: pd.x, y: pd.y, z: pd.z, color: '#2e86ab' });
      for (const f of anim.ik.feet) if (f.plant) m.push({ x: f.plant.x, y: f.plant.y, z: f.plant.z, color: '#d9534f' });
    }
    if (viewStore.get().overlay) overlayData.trails = ctl.tracker.trail; else if (overlayData.trails.length) overlayData.trails = [];
    overlayData.plants = anim.ik.feet.filter((f) => f.plant).map((f) => ({ x: f.plant!.x, y: f.plant!.y, z: f.plant!.z }));

    fps.current.t += delta; fps.current.n += 1;
    if (fps.current.t >= 0.4) {
      const names = dbg.feet.map((f) => (f.released ? '✗' : f.weight > 0.05 ? '●' : '○')).join('');
      debugStore.set({
        fps: Math.round(fps.current.n / fps.current.t),
        diagStep: dg.scenario ? dg.label : '-', diagMeasuring: dg.measuring, footPhases: anim.ik.feet.map((f, i) => `${['AvD', 'AvG', 'ArG', 'ArD'][i]} ${anim.contactPhase(i) === 'stance' ? 'appui' : anim.contactPhase(i) === 'swing' ? 'levée' : '–'}`).join(' · '),
        state: behavior.state, phaseName: behavior.phase ?? '-', postureState: posture.state, pending: behavior.pending === null ? '-' : typeof behavior.pending === 'object' ? `ordre ${behavior.pending.force}` : behavior.pending, groomGap: dbg.posture.groomGap, anchors: dbg.posture.anchored.length, remaining: behavior.remaining, poi: behavior.poi?.id ?? (behavior.destination ? 'point' : '-'), zone: behavior.zone, tripsInRow: behavior.tripsInRow,
        nextApproachIn: Math.max(0, behavior.nextApproachAt - behavior.time),
        phase: s.phase, speedRequested: loco.requestedSpeed, speedReal: loco.realSpeed, omega: s.omega, gaze: s.gazeHead, distance: loco.distance,
        clip: dbg.active, idleW: dbg.idleW, walkW: dbg.walkW, runW: dbg.runW, walkRate: dbg.walkRate, runRate: dbg.runRate, feet: names,
      });
      fps.current = { t: 0, n: 0 };
    }
  });

  const onTouch = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); ctl.behavior.touch(); };

  return (
    <group ref={group}>
      <primitive object={root} onPointerDown={onTouch} />
    </group>
  );
}
