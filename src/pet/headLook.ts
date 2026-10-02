import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const qParent = new THREE.Quaternion();
const qDelta = new THREE.Quaternion();
const axis = new THREE.Vector3();

/** Ajoute une rotation de lacet (autour de la verticale du monde) à un os, dans le repère de son parent.
 *  À appeler APRÈS `mixer.update` : le mixeur réécrit les os à chaque image, donc rien ne s'accumule d'une image à l'autre. */
export function addYaw(bone: THREE.Object3D, angle: number) {
  if (!bone.parent || Math.abs(angle) < 1e-5) return;
  bone.parent.getWorldQuaternion(qParent); // met aussi à jour la chaîne des parents
  axis.copy(UP).applyQuaternion(qParent.invert());
  qDelta.setFromAxisAngle(axis, angle);
  bone.quaternion.premultiply(qDelta);
  bone.updateMatrixWorld(true);
}

export interface BoneShare { bone: THREE.Object3D; share: number }

export function resolveBones(root: THREE.Object3D, list: [string, number][]): BoneShare[] {
  const total = list.reduce((s, [, k]) => s + k, 0) || 1;
  return list.flatMap(([name, k]) => {
    const bone = root.getObjectByName(name);
    return bone ? [{ bone, share: k / total }] : [];
  });
}

/** Répartit un angle de regard sur une chaîne d'os (du parent vers l'enfant). */
export function applyChain(chain: BoneShare[], angle: number) {
  for (const { bone, share } of chain) addYaw(bone, angle * share);
}

const _ax = new THREE.Vector3(), _rq = new THREE.Quaternion();
/** Tangage (autour de l'axe latéral du modèle, vers le bas si > 0) ajouté à un os, dans le repère de son parent. Même principe que addYaw. */
export function addPitch(bone: THREE.Object3D, angle: number, modelRoot: THREE.Object3D) {
  if (!bone.parent || Math.abs(angle) < 1e-5) return;
  modelRoot.getWorldQuaternion(_rq);
  _ax.set(1, 0, 0).applyQuaternion(_rq);
  bone.parent.getWorldQuaternion(qParent);
  _ax.applyQuaternion(qParent.invert());
  qDelta.setFromAxisAngle(_ax, angle);
  bone.quaternion.premultiply(qDelta);
  bone.updateMatrixWorld(true);
}
export function applyPitchChain(chain: BoneShare[], angle: number, modelRoot: THREE.Object3D) {
  for (const { bone, share } of chain) addPitch(bone, angle * share, modelRoot);
}
