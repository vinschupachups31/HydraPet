/* Squelette d'un GLB : positions monde en pose de liage (échelle brute), étendue, axes. Usage : node --import tsx tools/inspect-rig.mts fichier.glb */
import * as THREE from 'three';
import { loadFox } from '../tests/helpers/loadFox';
const { root, animations } = await loadFox(process.argv[2]);
root.updateMatrixWorld(true);
const bones: THREE.Bone[] = []; root.traverse((o) => { if ((o as THREE.Bone).isBone) bones.push(o as THREE.Bone); });
const p = new THREE.Vector3(), q = new THREE.Quaternion();
for (const b of bones) { b.getWorldPosition(p); b.getWorldQuaternion(q); const x = new THREE.Vector3(1, 0, 0).applyQuaternion(q), y = new THREE.Vector3(0, 1, 0).applyQuaternion(q); console.log(b.name.padEnd(24), p.toArray().map((v) => (v * 100).toFixed(1).padStart(7)).join(' '), ' x→', x.toArray().map((v) => v.toFixed(1)).join(','), ' y→', y.toArray().map((v) => v.toFixed(1)).join(',')); }
const box = new THREE.Box3().setFromObject(root); console.log('bbox (cm)', box.min.toArray().map((v) => (v * 100).toFixed(1)), box.max.toArray().map((v) => (v * 100).toFixed(1)));
console.log('clips', animations.map((a) => a.name + ' ' + a.duration.toFixed(2)).join(' · '));
