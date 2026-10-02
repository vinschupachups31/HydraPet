import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ThreeEvent, useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PetModelConfig, ROOM } from '../config/pet';
import { PetBrain } from './brain';
import { debugStore } from './debugStore';
import { DEFAULT_LOCO, LocoState, animationMix } from './locomotion';
import { mulberry32 } from './rng';

interface Props {
  config: PetModelConfig;
  source: string;
}

type Slot = 'idle' | 'walk' | 'run';

/** L'animal : modèle GLB riggé + mixeur d'animations + cerveau + locomotion. */
export function Pet({ config, source }: Props) {
  const gltf = useLoader(GLTFLoader, source);
  const root = useMemo(() => {
    const r = cloneSkinned(gltf.scene) as THREE.Object3D;
    r.scale.setScalar(config.scale);
    r.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false; // les maillages animés ont une boîte englobante figée
      }
    });
    return r;
  }, [gltf, config.scale]);

  const { mixer, actions } = useMemo(() => {
    const mx = new THREE.AnimationMixer(root);
    const acts = {} as Record<Slot, THREE.AnimationAction>;
    (Object.keys(config.clips) as Slot[]).forEach((slot) => {
      const clip = THREE.AnimationClip.findByName(gltf.animations, config.clips[slot]);
      if (!clip) throw new Error(`Clip « ${config.clips[slot]} » introuvable. Clips : ${gltf.animations.map((a) => a.name).join(', ')}`);
      const a = mx.clipAction(clip);
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.play();
      a.setEffectiveWeight(slot === 'idle' ? 1 : 0);
      acts[slot] = a;
    });
    return { mixer: mx, actions: acts };
  }, [gltf, root, config]);

  const group = useRef<THREE.Group>(null);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const footObjs = useMemo(() => config.footBones.map((n) => root.getObjectByName(n)).filter((o): o is THREE.Object3D => !!o), [root, config]);
  const weights = useRef({ idle: 1, walk: 0, run: 0 });
  const vWalkRef = config.groundSpeed.walk * config.scale;
  const vRunRef = config.groundSpeed.run * config.scale;
  const brain = useMemo(() => {
    const seed = (globalThis as { __HP_SEED__?: number }).__HP_SEED__;
    const rng = seed !== undefined ? mulberry32(seed) : Math.random;
    const loco: LocoState = { x: 0, z: 0.2, heading: 0, speed: 0, pivoting: false };
    // vitesse de croisière = vitesse naturelle du clip : cadence normale (time-scale 1)
    const params = { ...DEFAULT_LOCO, vWalk: vWalkRef, vRun: vRunRef };
    return new PetBrain(loco, { minX: -ROOM.width / 2 + 0.5, maxX: ROOM.width / 2 - 0.5, minZ: -ROOM.depth / 2 + 0.5, maxZ: ROOM.depth / 2 - 0.35 }, rng, params);
  }, [vWalkRef, vRunRef]);
  const fps = useRef({ t: 0, n: 0 });
  const frame = useRef(0);

  useEffect(() => {
    debugStore.set({ loaded: true, clips: gltf.animations.map((a) => `${a.name} ${a.duration.toFixed(2)}s`).join(' · ') });
    debugStore.commands.call = () => brain.call();
    debugStore.commands.touch = () => brain.touch();
    debugStore.commands.toggleGait = () => { brain.toggleForcedGait(); debugStore.set({ gait: brain.forcedGait ?? 'auto' }); };
    debugStore.commands.toggleAutonomy = () => { brain.autonomy = !brain.autonomy; debugStore.set({ autonomy: brain.autonomy }); };
    return () => { debugStore.commands = {}; };
  }, [brain, gltf]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const cam = state.camera as THREE.PerspectiveCamera;
    brain.cameraXZ = { x: cam.position.x, z: cam.position.z };
    if (!brain.walkable) {
      // l'animal reste dans ce que la caméra montre vraiment (marge = demi-longueur du corps)
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      const aspect = state.size.width / state.size.height;
      const margin = 0.5;
      brain.walkable = (x, z) => Math.abs(x) <= Math.max(0.15, (cam.position.z - z) * tanHalf * aspect - margin) && z <= 1.0;
    }
    brain.update(dt);
    const loco = brain.loco;

    const mix = animationMix(loco.speed, loco.pivoting, vWalkRef, vRunRef);
    const k = 1 - Math.exp(-dt * 9);
    const w = weights.current;
    w.idle += (mix.idle - w.idle) * k;
    w.walk += (mix.walk - w.walk) * k;
    w.run += (mix.run - w.run) * k;
    const sum = w.idle + w.walk + w.run || 1;
    actions.idle.setEffectiveWeight(w.idle / sum);
    actions.walk.setEffectiveWeight(w.walk / sum);
    actions.run.setEffectiveWeight(w.run / sum);
    actions.idle.setEffectiveTimeScale(mix.idleTimeScale);
    actions.walk.setEffectiveTimeScale(mix.walkTimeScale);
    actions.run.setEffectiveTimeScale(mix.runTimeScale);
    mixer.update(dt);

    if (group.current) {
      group.current.position.set(loco.x, 0, loco.z);
      group.current.rotation.y = loco.heading + config.yawOffset;
    }

    const probe = (globalThis as { __HP_PROBE__?: { frames: unknown[] } }).__HP_PROBE__;
    if (probe) {
      const feet = footObjs.map((o) => o.getWorldPosition(tmp.set(0, 0, 0)).toArray());
      probe.frames.push({ t: state.clock.elapsedTime, dt, mode: brain.mode, speed: loco.speed, pivoting: loco.pivoting, x: loco.x, z: loco.z, heading: loco.heading, w: [w.idle / sum, w.walk / sum, w.run / sum], ts: [mix.walkTimeScale, mix.runTimeScale], feet });
    }

    fps.current.t += delta;
    fps.current.n += 1;
    frame.current += 1;
    if (fps.current.t >= 0.5) {
      debugStore.set({
        fps: Math.round(fps.current.n / fps.current.t), mode: brain.mode, speed: loco.speed, heading: loco.heading, x: loco.x, z: loco.z,
        idleW: w.idle / sum, walkW: w.walk / sum, runW: w.run / sum, walkTS: mix.walkTimeScale, runTS: mix.runTimeScale, pivoting: loco.pivoting,
      });
      fps.current = { t: 0, n: 0 };
    }
  });

  const onTouch = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    brain.touch();
  };

  return (
    <group ref={group}>
      <primitive object={root} onPointerDown={onTouch} />
    </group>
  );
}
