/* Mesure le glissement des pieds du vrai modèle, hors navigateur (déterministe).
   Usage : node --import tsx tools/measure-slip.mts */
import * as THREE from 'three';
import { DEFAULT_ANIMATION } from '../src/config/animation';
import { CLIP_DATA } from '../src/config/foxClips';
import { FOX_STANDIN } from '../src/config/pet';
import { AnimationController } from '../src/pet/animation';
import { contactPosition } from '../src/pet/footIK';
import { loadFox } from '../tests/helpers/loadFox';

export interface SlipResult { median: number; p90: number; samples: number; perFoot: number[] }

export async function measure(opts: { ik: boolean; speed: number | ((t: number) => number); seconds?: number; omega?: number; nominalScale?: number }): Promise<SlipResult> {
  const { root, animations } = await loadFox();
  const group = new THREE.Group(); group.add(root); root.scale.setScalar(FOX_STANDIN.scale);
  const cfg = JSON.parse(JSON.stringify(DEFAULT_ANIMATION)); cfg.ik.enabled = opts.ik; if (opts.nominalScale) cfg.nominalScale.walk = opts.nominalScale;
  const anim = new AnimationController(root, animations, FOX_STANDIN, cfg, CLIP_DATA);
  const speedAt = typeof opts.speed === 'function' ? opts.speed : () => opts.speed as number;
  const dt = 1 / 60, total = (opts.seconds ?? 8), omega = opts.omega ?? 0;
  const foot = anim.ik.feet.map((f) => f.def.foot);
  const contacts = FOX_STANDIN.footChains.map((c) => CLIP_DATA.Walk.feet.find((f) => f.bone === c.foot)!.contacts);
  let heading = 0, x = 0, z = 0;
  const prev: THREE.Vector3[] = []; const v = new THREE.Vector3();
  const per: number[][] = foot.map(() => []);
  for (let t = 0; t < total; t += dt) {
    const sp = speedAt(t);
    heading += omega * dt;
    x += Math.sin(heading) * sp * dt; z += Math.cos(heading) * sp * dt;
    group.position.set(x, 0, z); group.rotation.y = heading; group.updateMatrixWorld(true);
    anim.update(dt, { realSpeed: sp, omega, pivoting: false }, { head: 0, spine: 0 });
    const ph = anim.debug().phase;
    anim.ik.feet.forEach((f, i) => {
      f.effector.getWorldPosition(v);
      if (prev[i] && t > 1.5 && sp > 0.3 && anim.debug().walkW > 0.9) {
        const u = contactPosition(contacts[i], ph);
        if (u !== null && u > 0.12 && u < 0.75) per[i].push(Math.hypot(v.x - prev[i].x, v.z - prev[i].z) / dt / sp);
      }
      prev[i] = v.clone();
    });
  }
  const all = per.flat().sort((a, b) => a - b);
  const med = (a: number[]) => { const s = [...a].sort((p, q) => p - q); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
  return { median: all[Math.floor(all.length / 2)], p90: all[Math.floor(all.length * 0.9)], samples: all.length, perFoot: per.map(med) };
}

if (process.argv[1]?.endsWith('measure-slip.mts')) {
  for (const speed of [0.565, 0.45, 0.35]) {
    for (const ik of [false, true]) {
      const r = await measure({ ik, speed });
      console.log(`marche droite ${speed.toFixed(2)} m/s, IK ${ik ? 'oui' : 'non'} : glissement médian ${(100 * r.median).toFixed(0)} %, p90 ${(100 * r.p90).toFixed(0)} % (${r.samples} mesures) · par patte ${r.perFoot.map((p) => (100 * p).toFixed(0)).join('/')} %`);
    }
  }
}
