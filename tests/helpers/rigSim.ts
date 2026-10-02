import * as THREE from 'three';
import { DEFAULT_ANIMATION } from '../../src/config/animation';
import { ACTIVE_PROFILE } from '../../src/config/modelProfile';
import { ACTIVE_PET } from '../../src/config/pet';
import { AnimationController } from '../../src/pet/animation';
import { PostureController } from '../../src/pet/posture';
import { mulberry32 } from '../../src/pet/rng';
import { loadFox } from './loadFox';

/** Vrai modèle + contrôleur d'animation + postures, sans comportement ni rendu : pour mesurer contacts, sol et tête. */
export async function makeRigSim(seed = 1) {
  const { root, animations } = await loadFox();
  const group = new THREE.Group(); group.add(root); root.scale.setScalar(ACTIVE_PET.scale);
  const cfg = JSON.parse(JSON.stringify(DEFAULT_ANIMATION));
  const anim = new AnimationController(root, animations, ACTIVE_PET, cfg, ACTIVE_PROFILE.clipData);
  const posture = new PostureController(mulberry32(seed));
  anim.posture = posture;
  group.position.set(0, 0, 0); group.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  const pos = (key: keyof typeof anim.rig.bones) => anim.rig.bones[key].getWorldPosition(new THREE.Vector3());
  return {
    root, group, anim, posture, rig: anim.rig, pos,
    step(dt: number) { posture.update(dt); anim.update(dt, { realSpeed: 0, omega: 0, pivoting: false }, { head: 0, spine: 0, pitch: 0 }); },
    /** Joue jusqu'à ce que `until()` soit vrai (ou `max` secondes) ; `each` est appelé après chaque image. */
    run(dt: number, max: number, until: () => boolean, each?: () => void) { let t = 0; while (t < max && !until()) { this.step(dt); each?.(); t += dt; } return t; },
    lowest: () => anim.rig.lowestY(),
    tmp: v,
  };
}
