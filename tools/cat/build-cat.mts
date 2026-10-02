/* Construit assets/models/cat-rigged.glb : le chat statique (assets/models/cat-source.glb, CC-BY 4.0, toti.shroom) rigé avec le squelette à 49 os
   et les 14 animations de Mesh2Motion (assets/models/m2m-fox.glb : squelette et animations CC0 Quaternius).
   Principe : les rotations d'os au repos et les clips sont conservés tels quels ; seules les POSITIONS des articulations sont recalées sur le chat
   (valide : les clips ne portent que des rotations, plus la translation du bassin qui est remise à l'échelle). Maillage décimé, poids de peau par proximité
   aux segments d'os (rayons par os, symétrie gauche/droite) puis lissés sur le maillage.
   Usage : node --import tsx tools/cat/build-cat.mts */
import * as THREE from 'three';
import fs from 'node:fs';
import { Document, NodeIO } from '@gltf-transform/core';
import { MeshoptSimplifier } from 'meshoptimizer';
import { loadFox } from '../../tests/helpers/loadFox';

const TARGET_TRIS = Number(process.env.TRIS ?? 18000);
const io = new NodeIO();

// ---------------------------------------------------------------------------------------------------- 1. chat : sommets en espace scène, puis repère du squelette
const catScene = (await loadFox('assets/models/cat-source.glb')).root; catScene.updateMatrixWorld(true);
const catDoc = await io.read('assets/models/cat-source.glb');
let mesh: THREE.Mesh | null = null; catScene.traverse((o) => { if ((o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
const geo = (mesh as unknown as THREE.Mesh).geometry, M = (mesh as unknown as THREE.Mesh).matrixWorld;
const pa = geo.attributes.position, na = geo.attributes.normal, ua = geo.attributes.uv;
const idx0 = geo.index ? Array.from(geo.index.array as ArrayLike<number>) : Array.from({ length: pa.count }, (_, i) => i);
const nmat = new THREE.Matrix3().getNormalMatrix(M);
// repère du squelette : x gauche (= -z du chat), y haut depuis le sol (sol du chat = -0.35), z avant (= x du chat)
const GROUND = -0.35;
const toRig = (v: THREE.Vector3) => new THREE.Vector3(-v.z, v.y - GROUND, v.x);
const pos0 = new Float32Array(pa.count * 3), nor0 = new Float32Array(pa.count * 3), uv0 = new Float32Array(pa.count * 2);
for (let i = 0; i < pa.count; i++) {
  const p = toRig(new THREE.Vector3().fromBufferAttribute(pa, i).applyMatrix4(M));
  const n = new THREE.Vector3().fromBufferAttribute(na, i).applyMatrix3(nmat).normalize(); const nr = new THREE.Vector3(-n.z, n.y, n.x);
  pos0.set([p.x, p.y, p.z], i * 3); nor0.set([nr.x, nr.y, nr.z], i * 3); uv0.set([ua.getX(i), ua.getY(i)], i * 2);
}
// ---------------------------------------------------------------------------------------------------- 2. décimation (coutures UV verrouillées)
await MeshoptSimplifier.ready;
const idx = new Uint32Array(idx0);
const attrs = new Float32Array(pa.count * 5); for (let i = 0; i < pa.count; i++) { attrs.set([nor0[i * 3], nor0[i * 3 + 1], nor0[i * 3 + 2], uv0[i * 2], uv0[i * 2 + 1]], i * 5); }
const [simp, err] = MeshoptSimplifier.simplifyWithAttributes(idx, pos0, 3, attrs, 5, [0.5, 0.5, 0.5, 4, 4], null, TARGET_TRIS * 3, 0.02, ['LockBorder']);
const remap = new Map<number, number>(); const keep: number[] = [];
for (const i of simp) if (!remap.has(i)) { remap.set(i, keep.length); keep.push(i); }
const NV = keep.length, indices = new Uint32Array(simp.length).map((_, k) => remap.get(simp[k])!);
const pos = new Float32Array(NV * 3), nor = new Float32Array(NV * 3), uv = new Float32Array(NV * 2);
keep.forEach((o, i) => { pos.set(pos0.subarray(o * 3, o * 3 + 3), i * 3); nor.set(nor0.subarray(o * 3, o * 3 + 3), i * 3); uv.set(uv0.subarray(o * 2, o * 2 + 2), i * 2); });
console.log(`maillage : ${pa.count} → ${NV} sommets, ${idx0.length / 3} → ${indices.length / 3} triangles (erreur ${err.toFixed(4)})`);

// ---------------------------------------------------------------------------------------------------- 3. squelette Mesh2Motion : rotations au repos conservées, positions recalées
const rigDoc = await io.read('assets/models/m2m-fox.glb');
const rroot = rigDoc.getRoot();
const skin = rroot.listSkins()[0], joints = skin.listJoints();
const jname = joints.map((j) => j.getName());
const parentOf = new Map<string, string | null>();
for (const j of joints) { const p = rroot.listNodes().find((n) => n.listChildren().includes(j)); parentOf.set(j.getName(), p && jname.includes(p.getName()) ? p.getName() : null); }

// positions voulues, en espace scène du chat (x avant, y haut, z latéral ; gauche = z < 0), côté gauche et axe ; la droite est le miroir (z → -z)
const C: Record<string, [number, number, number]> = {
  root: [0, GROUND, 0],
  Hips: [-0.17, 0.04, 0], Spine_1: [-0.08, 0.06, 0], Spine_2: [0.02, 0.07, 0], Spine_2001: [0.14, 0.08, 0], Spine_3: [0.25, 0.12, 0], Spine_4: [0.33, 0.18, 0],
  Head: [0.375, 0.225, 0], Nose: [0.465, 0.18, 0], Headtip: [0.49, 0.17, 0], Chin: [0.43, 0.13, 0], Chin_Tip: [0.47, 0.135, 0],
  Ear_L: [0.40, 0.285, -0.065], Ear_Tip_L: [0.405, 0.318, -0.07],
  Front_Leg_Shoulder_L: [0.26, 0.12, -0.05], Front_Leg_Upper_L: [0.31, 0.03, -0.07], Front_Leg_Lower_L: [0.27, -0.14, -0.06], Front_Leg_Ankle_L: [0.29, -0.29, -0.05], Front_Leg_Foot_L: [0.30, -0.335, -0.045], Front_Leg_Tip_L: [0.35, -0.345, -0.045],
  Stomach: [0.0, -0.05, 0], Stomach_tip: [0.0, -0.11, 0],
  Tail_Base: [-0.33, 0.03, 0], Tail_Mid: [-0.385, 0.045, 0], Tail_Mid001: [-0.41, 0.15, 0], Tail_End: [-0.42, 0.27, 0], Tail_Tip: [-0.48, 0.24, 0],
  Back_Leg_Pelvis_L: [-0.17, 0.05, -0.06], Back_Leg_Upper_L: [-0.19, -0.02, -0.075], Back_Leg_Lower_L: [-0.10, -0.14, -0.075], Back_Leg_Ankle_L: [-0.19, -0.26, -0.06], Back_Leg_Foot_L: [-0.15, -0.31, -0.06], Back_Leg_Foot_1_L: [-0.14, -0.337, -0.06], Back_Leg_Tip_L: [-0.09, -0.347, -0.06],
};
const pick = (n: string): THREE.Vector3 => { const m = n.endsWith('_R') ? n.slice(0, -2) + '_L' : n; const c = C[m]; if (!c) throw new Error('repère manquant : ' + n); const v = new THREE.Vector3(c[0], c[1], n.endsWith('_R') ? -c[2] : c[2]); return toRig(v); };
const fitted = new Map<string, THREE.Vector3>(jname.map((n) => [n, pick(n)]));

// hiérarchie three pour les rotations au repos
const tn = new Map<string, THREE.Object3D>();
for (const j of joints) { const o = new THREE.Object3D(); o.name = j.getName(); const q = j.getRotation(); o.quaternion.set(q[0], q[1], q[2], q[3]); tn.set(o.name, o); }
const sceneRoot = new THREE.Object3D();
for (const j of joints) { const p = parentOf.get(j.getName()); (p ? tn.get(p)! : sceneRoot).add(tn.get(j.getName())!); }
// le nœud « root » du fichier est tourné de -90° autour de x : on le garde (la rotation du repos de root est dans son quaternion)
sceneRoot.updateMatrixWorld(true);
for (const j of joints) { // nouvelle translation locale = (position voulue − position voulue du parent) exprimée dans le repère monde-rotation du parent
  const p = parentOf.get(j.getName()); const o = tn.get(j.getName())!;
  const pw = new THREE.Quaternion(); if (p) tn.get(p)!.getWorldQuaternion(pw);
  const d = fitted.get(j.getName())!.clone().sub(p ? fitted.get(p)! : new THREE.Vector3());
  const local = d.applyQuaternion(pw.invert());
  o.position.copy(local); j.setTranslation([local.x, local.y, local.z]);
}
sceneRoot.updateMatrixWorld(true);
// vérification : les positions monde des articulations doivent égaler les positions voulues
let worst = 0; for (const j of joints) { const w = new THREE.Vector3(); tn.get(j.getName())!.getWorldPosition(w); worst = Math.max(worst, w.distanceTo(fitted.get(j.getName())!)); }
console.log('écart max positions articulations / repères :', worst.toExponential(2));

// ---------------------------------------------------------------------------------------------------- 4. poids de peau
const SEG: Record<string, string> = { Hips: 'Spine_1', Spine_1: 'Spine_2', Spine_2: 'Spine_2001', Spine_2001: 'Spine_3', Spine_3: 'Spine_4', Spine_4: 'Head', Head: 'Nose', Nose: 'Headtip', Chin: 'Chin_Tip',
  Ear_L: 'Ear_Tip_L', Ear_R: 'Ear_Tip_R', Stomach: 'Stomach_tip', Tail_Base: 'Tail_Mid', Tail_Mid: 'Tail_Mid001', Tail_Mid001: 'Tail_End', Tail_End: 'Tail_Tip',
  Front_Leg_Shoulder_L: 'Front_Leg_Upper_L', Front_Leg_Upper_L: 'Front_Leg_Lower_L', Front_Leg_Lower_L: 'Front_Leg_Ankle_L', Front_Leg_Ankle_L: 'Front_Leg_Foot_L', Front_Leg_Foot_L: 'Front_Leg_Tip_L',
  Front_Leg_Shoulder_R: 'Front_Leg_Upper_R', Front_Leg_Upper_R: 'Front_Leg_Lower_R', Front_Leg_Lower_R: 'Front_Leg_Ankle_R', Front_Leg_Ankle_R: 'Front_Leg_Foot_R', Front_Leg_Foot_R: 'Front_Leg_Tip_R',
  Back_Leg_Pelvis_L: 'Back_Leg_Upper_L', Back_Leg_Upper_L: 'Back_Leg_Lower_L', Back_Leg_Lower_L: 'Back_Leg_Ankle_L', Back_Leg_Ankle_L: 'Back_Leg_Foot_L', Back_Leg_Foot_L: 'Back_Leg_Foot_1_L', Back_Leg_Foot_1_L: 'Back_Leg_Tip_L',
  Back_Leg_Pelvis_R: 'Back_Leg_Upper_R', Back_Leg_Upper_R: 'Back_Leg_Lower_R', Back_Leg_Lower_R: 'Back_Leg_Ankle_R', Back_Leg_Ankle_R: 'Back_Leg_Foot_R', Back_Leg_Foot_R: 'Back_Leg_Foot_1_R', Back_Leg_Foot_1_R: 'Back_Leg_Tip_R' };
const radius = (n: string) => n.startsWith('Spine') || n === 'Hips' ? 0.11 : n === 'Stomach' ? 0.1 : n.startsWith('Head') || n === 'Nose' ? 0.075 : n.startsWith('Chin') ? 0.035 : n.startsWith('Ear') ? 0.03 : n.startsWith('Tail') ? 0.035 : n.includes('Shoulder') || n.includes('Pelvis') ? 0.08 : n.includes('Foot') || n.includes('Tip') || n.includes('Ankle') ? 0.035 : 0.05;
const segs = jname.map((n) => { const a = fitted.get(n)!; const t = SEG[n]; const b = t ? fitted.get(t)! : a.clone().add(new THREE.Vector3(0, 0.0, 0.0)); return { n, a, b, r: radius(n), on: !!t }; });
const NJ = jname.length, W = new Float32Array(NV * NJ);
const segDist = (p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) => { const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, ab.lengthSq() > 1e-12 ? p.clone().sub(a).dot(ab) / ab.lengthSq() : 0)); return p.distanceTo(a.clone().addScaledVector(ab, t)); };
const v = new THREE.Vector3();
for (let i = 0; i < NV; i++) {
  v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  let sum = 0, best = -1, bd = 1e9;
  for (let j = 0; j < NJ; j++) {
    const s = segs[j]; if (!s.on) continue;
    const d = segDist(v, s.a, s.b); if (d < bd) { bd = d; best = j; }
    let sc = Math.exp(-Math.pow(d / s.r, 2) * 2.2);
    if (s.n.endsWith('_L') && v.x < -0.012) sc *= 0.02; if (s.n.endsWith('_R') && v.x > 0.012) sc *= 0.02;       // gauche/droite : pas de fuite à travers le corps
    W[i * NJ + j] = sc; sum += sc;
  }
  if (sum < 1e-9) W[i * NJ + best] = 1;
}
// lissage sur le maillage (voisins par arêtes), 3 passes
const nbr: Set<number>[] = Array.from({ length: NV }, () => new Set()); for (let t = 0; t < indices.length; t += 3) for (let k = 0; k < 3; k++) { nbr[indices[t + k]].add(indices[t + (k + 1) % 3]); nbr[indices[t + k]].add(indices[t + (k + 2) % 3]); }
// sommets confondus (coutures UV) : mêmes poids, sinon des fissures apparaissent à l'animation
const keyOf = (i: number) => `${Math.round(pos[i * 3] * 1e5)},${Math.round(pos[i * 3 + 1] * 1e5)},${Math.round(pos[i * 3 + 2] * 1e5)}`;
const groups = new Map<string, number[]>(); for (let i = 0; i < NV; i++) { const k = keyOf(i); (groups.get(k) ?? groups.set(k, []).get(k)!).push(i); }
const weld = (arr: Float32Array) => { for (const g of groups.values()) if (g.length > 1) for (let j = 0; j < NJ; j++) { let s = 0; for (const i of g) s += arr[i * NJ + j]; s /= g.length; for (const i of g) arr[i * NJ + j] = s; } };
weld(W);
let cur = W;
for (let pass = 0; pass < 3; pass++) { const nx = new Float32Array(cur.length); for (let i = 0; i < NV; i++) { const nb = [...nbr[i]]; for (let j = 0; j < NJ; j++) { let s = cur[i * NJ + j] * 2; for (const k of nb) s += cur[k * NJ + j]; nx[i * NJ + j] = s / (2 + nb.length); } } weld(nx); cur = nx; }
const J = new Uint16Array(NV * 4), WT = new Float32Array(NV * 4);
for (let i = 0; i < NV; i++) { const arr = Array.from({ length: NJ }, (_, j) => [j, cur[i * NJ + j]] as [number, number]).sort((a, b) => b[1] - a[1]).slice(0, 4); const s = arr.reduce((a, b) => a + b[1], 0) || 1; arr.forEach(([j, w], k) => { J[i * 4 + k] = j; WT[i * 4 + k] = w / s; }); }

// ---------------------------------------------------------------------------------------------------- 5. écriture : peau, maillage, matériau, animations
const ibm = new Float32Array(NJ * 16);
joints.forEach((j, i) => { const m = tn.get(j.getName())!.matrixWorld.clone().invert(); m.toArray(ibm, i * 16); });
const ibmAcc = skin.getInverseBindMatrices()!; ibmAcc.setArray(ibm);
const buf = rroot.listBuffers()[0];
const prim = rroot.listMeshes()[0].listPrimitives()[0];
const acc = (arr: Float32Array | Uint16Array | Uint32Array, type: 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4') => rigDoc.createAccessor().setArray(arr).setType(type).setBuffer(buf);
prim.setAttribute('POSITION', acc(pos, 'VEC3')).setAttribute('NORMAL', acc(nor, 'VEC3')).setAttribute('TEXCOORD_0', acc(uv, 'VEC2')).setAttribute('JOINTS_0', acc(J, 'VEC4')).setAttribute('WEIGHTS_0', acc(WT, 'VEC4')).setIndices(acc(indices, 'SCALAR'));
// matériau : texture du chat
const catTex = catDoc.getRoot().listTextures()[0];
const tex = rigDoc.createTexture('cat_albedo').setImage(catTex.getImage()!).setMimeType(catTex.getMimeType());
const oldMat = prim.getMaterial()!; oldMat.setBaseColorTexture(tex).setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.92).setMetallicFactor(0).setName('cat_material');
for (const t of rroot.listTextures()) if (t !== tex) t.dispose();
// animations : la translation du bassin est remise à l'échelle autour de la nouvelle position de repos
const hips = joints.find((j) => j.getName() === 'Hips')!; const oldRest = new THREE.Vector3(0, 0.742, 0.978); // (repos d'origine, lu plus haut)
const newRest = new THREE.Vector3(...(hips.getTranslation() as [number, number, number]));
const k = newRest.y / 0.742 > 0 ? (fitted.get('Hips')!.y - 0) / 0.978 : 0.4; // hauteur du bassin chat / hauteur du bassin renard
for (const a of rroot.listAnimations()) for (const ch of a.listChannels()) if (ch.getTargetPath() === 'translation' && ch.getTargetNode() === hips) {
  const out = ch.getSampler().getOutput()!; const arr = out.getArray()!.slice() as Float32Array;
  for (let i = 0; i < arr.length; i += 3) { arr[i] = newRest.x + (arr[i] - oldRest.x) * k; arr[i + 1] = newRest.y + (arr[i + 1] - oldRest.y) * k; arr[i + 2] = newRest.z + (arr[i + 2] - oldRest.z) * k; }
  out.setArray(arr);
}
rroot.getAsset().extras = { ...(rroot.getAsset().extras as object), title: 'Cat (rigged with Mesh2Motion fox skeleton)', sources: ['Cat mesh and texture: toti.shroom, CC-BY-4.0, https://sketchfab.com/3d-models/cat-51cc3bfb49b64128aa54ffa29f36d8c1', 'Skeleton and animations: Mesh2Motion / Quaternius, CC0'], hipsScale: k };
await io.write('assets/models/cat-rigged.glb', rigDoc);
console.log('écrit assets/models/cat-rigged.glb', (fs.statSync('assets/models/cat-rigged.glb').size / 1e6).toFixed(2), 'Mo ; échelle du bassin', k.toFixed(3));
