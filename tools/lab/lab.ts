/* Banc de pose (outil de développement) : charge le vrai GLB, applique une pose par PoseRig et la rend vue de profil / de face / de trois quarts.
   Construit avec esbuild (voir tools/lab/build.sh) ; piloté par Playwright. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PoseRig, Pose } from '../../src/pet/rig';
import { POSES, mirrorPose } from '../../src/config/postures';

const W = 480, H = 360;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#e9e4da');
scene.add(new THREE.HemisphereLight(0xffffff, 0x887766, 1.6)); const dl = new THREE.DirectionalLight(0xffffff, 1.5); dl.position.set(1, 2, 1.5); scene.add(dl);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: '#c9bba3' })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
scene.add(new THREE.GridHelper(2, 40, 0x8a7d66, 0xb5a78e));
const cam = new THREE.PerspectiveCamera(30, W / H, 0.01, 10);

const lab = (window as unknown as { lab: Record<string, unknown> }).lab = {} as Record<string, unknown>;
let root: THREE.Object3D, rig: PoseRig, mixer: THREE.AnimationMixer, clips: THREE.AnimationClip[];
const markers = new THREE.Group(); scene.add(markers);
const sph = new THREE.SphereGeometry(0.006, 8, 6);
const mk = (c: string) => new THREE.Mesh(sph, new THREE.MeshBasicMaterial({ color: c, depthTest: false }));
const mM = mk('#e00'), mP = mk('#00e'); markers.add(mM, mP);

lab.load = async (url: string) => {
  const g = await new GLTFLoader().loadAsync(url);
  root = g.scene; root.scale.setScalar(0.0046); scene.add(root); clips = g.animations;
  rig = new PoseRig(root);
  mixer = new THREE.AnimationMixer(root);
  (lab as any).rig = rig; (lab as any).root = root;
  return rig.missing;
};
lab.show = (o: { named?: string; mirror?: boolean; padSide?: 'L' | 'R'; pose?: Pose; w?: number; view?: string; ground?: boolean; clip?: string; t?: number; yaw?: number }) => {
  if (o.named) { o.pose = o.mirror ? mirrorPose(POSES[o.named]) : POSES[o.named]; o.padSide = o.mirror ? 'L' : 'R'; }
  root.rotation.y = o.yaw ?? 0;
  mixer.stopAllAction();
  const a = mixer.clipAction(THREE.AnimationClip.findByName(clips, o.clip ?? 'Survey')!); a.play(); mixer.setTime(o.t ?? 0);
  root.updateMatrixWorld(true);
  if (o.pose) { rig.apply(o.pose, o.w ?? 1); root.updateMatrixWorld(true); }
  if (o.ground !== false && o.pose) rig.groundSolve(o.w ?? 1);
  const v = new THREE.Vector3(); rig.muzzle(v); mM.position.copy(v); rig.pad(o.padSide ?? 'R', v); mP.position.copy(v);
  const view = o.view ?? 'side';
  const c = new THREE.Vector3(0, 0.15, 0), d = 1.05;
  if (view === 'side') { cam.position.set(d, 0.16, 0); }
  else if (view === 'front') { cam.position.set(0, 0.2, d); }
  else { cam.position.set(d * 0.7, 0.3, d * 0.7); }
  cam.lookAt(c); cam.updateMatrixWorld(); renderer.render(scene, cam);
  const bp = {} as Record<string, number[]>; rig.keys.forEach((k) => { const p = new THREE.Vector3(); rig.bones[k].getWorldPosition(p); bp[k] = p.toArray().map((x) => +(x * 100).toFixed(1)); });
  const mz = new THREE.Vector3(); rig.muzzle(mz); const pd = new THREE.Vector3(); rig.pad(o.padSide ?? 'R', pd);
  let top = 0; { const pts: THREE.Vector3[] = []; rig.hullWorld(pts); for (const q of pts) top = Math.max(top, q.y); }
  return { top: +(top * 100).toFixed(1), padToMuzzle: +(mz.distanceTo(pd) * 100).toFixed(1), padY: +(pd.y * 100).toFixed(1), muzzleY: +(mz.y * 100).toFixed(1), lowest: +(rig.lowestY() * 100).toFixed(2), shift: +(rig.groundShift * 100).toFixed(2), bones: bp };
};

/** Ajustement par descente de coordonnées : cherche les angles (dans leurs bornes) qui amènent le coussinet au museau (distance cible en cm), avec un faible rappel vers la pose de départ. */
(lab as any).fit = (o: { pose: Pose; free: [string, number, number, number][]; side: 'L' | 'R'; target: number; reg?: number; iters?: number; point?: number[] }) => {
  const pose: Pose = JSON.parse(JSON.stringify(o.pose));
  const p = new THREE.Vector3(), m = new THREE.Vector3();
  const base = o.free.map(([b, i]) => ((pose.r as any)[b] ?? [0, 0, 0])[i]);
  const cost = () => {
    mixer.stopAllAction(); const a = mixer.clipAction(THREE.AnimationClip.findByName(clips, 'Survey')!); a.play(); mixer.setTime(0); root.updateMatrixWorld(true);
    rig.apply(pose, 1); root.updateMatrixWorld(true); rig.groundSolve(1);
    rig.pad(o.side, p); if (o.point) rig.headPoint(o.point, m); else rig.muzzle(m);
    const d = p.distanceTo(m) * 100;
    let reg = 0; o.free.forEach(([b, i], k) => { reg += (((pose.r as any)[b][i] - base[k]) / 60) ** 2; });
    return Math.abs(d - o.target) + (o.reg ?? 0.4) * reg;
  };
  for (const [b] of o.free) if (!(pose.r as any)[b]) (pose.r as any)[b] = [0, 0, 0];
  let best = cost(); let step = 10;
  for (let it = 0; it < (o.iters ?? 60); it++) {
    let improved = false;
    o.free.forEach(([b, i, lo, hi]) => { for (const sgn of [1, -1]) { const arr = (pose.r as any)[b]; const old = arr[i]; arr[i] = Math.max(lo, Math.min(hi, old + sgn * step)); const c = cost(); if (c < best - 1e-6) { best = c; improved = true; } else arr[i] = old; } });
    if (!improved) step *= 0.6; if (step < 0.3) break;
  }
  cost(); rig.pad(o.side, p); if (o.point) rig.headPoint(o.point, m); else rig.muzzle(m);
  return { pose, dist: +(p.distanceTo(m) * 100).toFixed(2), cost: best };
};

/** Rendu d'un GLB quelconque (sans rig) pour l'inspecter : vues de profil, de face et de dessus. */
(lab as any).view = async (url: string, view: string) => {
  const g = await new GLTFLoader().loadAsync(url);
  const obj = g.scene; scene.add(obj);
  const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const d = Math.max(size.x, size.y, size.z) * 2.4;
  if (view === 'side') cam.position.set(c.x + d, c.y, c.z); else if (view === 'front') cam.position.set(c.x, c.y, c.z + d); else if (view === 'top') cam.position.set(c.x, c.y + d, c.z + 0.01); else cam.position.set(c.x + d * 0.7, c.y + d * 0.3, c.z + d * 0.7);
  cam.near = d / 100; cam.far = d * 10; cam.updateProjectionMatrix(); cam.lookAt(c); floor.visible = false; scene.children.filter((o) => (o as any).isGridHelper).forEach((o) => (o.visible = false));
  renderer.render(scene, cam); scene.remove(obj);
  return { size: size.toArray(), center: c.toArray() };
};

/** Rendu d'un GLB rigé à un instant d'un clip (contrôle des poids de peau) : vues de profil / face / trois quarts, avec ou sans squelette. */
(lab as any).rigView = async (url: string, clip: string, t: number, view: string, bones: boolean) => {
  const g = await new GLTFLoader().loadAsync(url);
  const obj = g.scene; scene.add(obj);
  const mx = new THREE.AnimationMixer(obj);
  const c = THREE.AnimationClip.findByName(g.animations, clip); if (c) { mx.clipAction(c).play(); mx.setTime(t); }
  obj.updateMatrixWorld(true);
  let helper: THREE.SkeletonHelper | null = null; if (bones) { helper = new THREE.SkeletonHelper(obj); (helper.material as THREE.LineBasicMaterial).depthTest = false; scene.add(helper); }
  const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  const d = Math.max(size.x, size.y, size.z) * 2.1; ctr.y = Math.min(ctr.y, size.y * 0.45);
  if (view === 'side') cam.position.set(ctr.x + d, ctr.y, ctr.z); else if (view === 'front') cam.position.set(ctr.x, ctr.y, ctr.z + d); else cam.position.set(ctr.x + d * 0.7, ctr.y + d * 0.25, ctr.z + d * 0.7);
  cam.near = d / 100; cam.far = d * 10; cam.updateProjectionMatrix(); cam.lookAt(ctr);
  floor.visible = false; scene.children.filter((o) => (o as any).isGridHelper).forEach((o) => (o.visible = false));
  renderer.render(scene, cam); scene.remove(obj); if (helper) scene.remove(helper);
  return { size: size.toArray(), anims: g.animations.map((a) => a.name) };
};
