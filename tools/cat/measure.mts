// @ts-nocheck
import * as THREE from 'three';
import { loadFox } from '../../tests/helpers/loadFox';
const { root } = await loadFox('assets/models/cat-rigged.glb');
root.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(root);
console.log('bbox', box.min.toArray().map(n=>+n.toFixed(3)), box.max.toArray().map(n=>+n.toFixed(3)));
for (const n of ['Hips','Head','Nose','Headtip','Chin_Tip','Ear_R','Ear_Tip_R','Ear_Tip_L','Front_Leg_Tip_L','Front_Leg_Foot_L','Front_Leg_Upper_L','Back_Leg_Tip_L','Tail_Tip','Spine_3']) {
  const o = root.getObjectByName(n)!; console.log(n, o.getWorldPosition(new THREE.Vector3()).toArray().map(v=>+v.toFixed(3)).join(' '));
}
