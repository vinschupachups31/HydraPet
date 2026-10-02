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
import { debugStore } from './debugStore';
import { Framing } from './framing';
import { WalkArea, resolvePoi } from './layout';
import { LocomotionController } from './locomotor';
import { mulberry32 } from './rng';
import { overlayData } from './viewStore';

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
    const loco = new LocomotionController(turn, area, bcfg.bodyRadius, bcfg.stall, 0, 0.3, 0, bcfg.arrive.hysteresis, animCfg.speedSmoothing);
    const behavior = new BehaviorController({
      loco, area, cfg: bcfg, rng,
      approachPoint: () => framingRef.current.approach,
      cameraXZ: () => ({ x: framingRef.current.position[0], z: framingRef.current.position[2] }),
    });
    return { anim, loco, behavior, animCfg, area, bcfg };
  }, [root, gltf, config]);

  useEffect(() => {
    overlayData.pois = ctl.bcfg.pois.map((p) => ({ id: p.id, ...resolvePoi(p, ctl.area.view, ctl.bcfg.viewEdgeMargin), r: p.radius }));
  }, [ctl, framing]);

  const group = useRef<THREE.Group>(null);
  const yawOffsetQ = useMemo(() => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), config.yawOffset), [config.yawOffset]);
  const fps = useRef({ t: 0, n: 0 });
  const tmp = useMemo(() => ({ v: new THREE.Vector3() }), []);

  useEffect(() => {
    const { anim, behavior, animCfg } = ctl;
    diag.step('model', 'ok', `Modèle chargé et analysé : ${gltf.animations.length} clips (${gltf.animations.map((a) => a.name).join(', ')})`);
    debugStore.set({ loaded: true, clips: gltf.animations.map((a) => `${a.name} ${a.duration.toFixed(2)}s`).join(' · '), ik: animCfg.ik.enabled });
    debugStore.commands.call = () => behavior.call();
    debugStore.commands.touch = () => behavior.touch();
    debugStore.commands.goTo = (x, z, gait) => behavior.goTo(x, z, gait);
    debugStore.commands.toggleGait = () => { behavior.toggleForcedGait(); debugStore.set({ gait: behavior.forcedGait ?? 'auto' }); };
    debugStore.commands.toggleAutonomy = () => { behavior.autonomy = !behavior.autonomy; debugStore.set({ autonomy: behavior.autonomy }); };
    debugStore.commands.toggleIK = () => { animCfg.ik.enabled = !animCfg.ik.enabled; debugStore.set({ ik: animCfg.ik.enabled }); };
    const g = globalThis as { __HP_PROBE__?: unknown; __HP_API__?: unknown };
    if (g.__HP_PROBE__) {
      g.__HP_API__ = {
        goTo: (x: number, z: number, gait?: 'walk' | 'run') => behavior.goTo(x, z, gait),
        autonomy: (v: boolean) => { behavior.autonomy = v; },
        touch: () => behavior.touch(),
        call: () => behavior.call(),
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
    const dt = Math.min(delta, 0.1); // protège toute la simulation contre une image anormalement longue
    const { anim, loco, behavior } = ctl;
    const s = loco.s;

    behavior.update(dt);                           // 1. intention : activité, destination
    loco.update(dt);                               // 2. position, orientation, freinage, virages, collisions
    if (group.current) {
      group.current.position.set(s.x, 0, s.z);
      group.current.quaternion.set(0, s.q.y, 0, s.q.w).multiply(yawOffsetQ);
    }
    anim.update(dt, { realSpeed: loco.realSpeed, omega: s.omega, pivoting: s.pivoting }, { head: s.gazeHead, spine: s.gazeSpine }); // 3. clips, cadence, appuis, tête

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
      });
    }
    overlayData.target = loco.target;
    overlayData.arriveRadius = ctl.bcfg.arrive.radius;
    overlayData.pos.x = s.x; overlayData.pos.z = s.z;
    overlayData.plants = anim.ik.feet.filter((f) => f.plant).map((f) => ({ x: f.plant!.x, y: f.plant!.y, z: f.plant!.z }));

    fps.current.t += delta; fps.current.n += 1;
    if (fps.current.t >= 0.4) {
      const names = dbg.feet.map((f) => (f.released ? '✗' : f.weight > 0.05 ? '●' : '○')).join('');
      debugStore.set({
        fps: Math.round(fps.current.n / fps.current.t),
        state: behavior.state, remaining: behavior.remaining, poi: behavior.poi?.id ?? (behavior.destination ? 'point' : '-'), zone: behavior.zone, tripsInRow: behavior.tripsInRow,
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
