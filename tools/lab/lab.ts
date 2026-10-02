/* Banc de pose (outil de développement) : charge le vrai GLB, applique une pose par PoseRig et la rend vue de profil / de face / de trois quarts.
   Construit avec esbuild (voir tools/lab/build.sh) ; piloté par Playwright. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PoseRig, Pose } from '../../src/pet/rig';

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
lab.show = (o: { padSide?: 'L' | 'R'; pose?: Pose; w?: number; view?: string; ground?: boolean; clip?: string; t?: number; yaw?: number }) => {
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
  return { padToMuzzle: +(mz.distanceTo(pd) * 100).toFixed(1), padY: +(pd.y * 100).toFixed(1), muzzleY: +(mz.y * 100).toFixed(1), lowest: +(rig.lowestY() * 100).toFixed(2), shift: +(rig.groundShift * 100).toFixed(2), bones: bp };
};

/** Ajustement par descente de coordonnées : cherche les angles (dans leurs bornes) qui amènent le coussinet au museau (distance cible en cm), avec un faible rappel vers la pose de départ. */
(lab as any).fit = (o: { pose: Pose; free: [string, number, number, number][]; side: 'L' | 'R'; target: number; reg?: number; iters?: number }) => {
  const pose: Pose = JSON.parse(JSON.stringify(o.pose));
  const p = new THREE.Vector3(), m = new THREE.Vector3();
  const base = o.free.map(([b, i]) => ((pose.r as any)[b] ?? [0, 0, 0])[i]);
  const cost = () => {
    mixer.stopAllAction(); const a = mixer.clipAction(THREE.AnimationClip.findByName(clips, 'Survey')!); a.play(); mixer.setTime(0); root.updateMatrixWorld(true);
    rig.apply(pose, 1); root.updateMatrixWorld(true); rig.groundSolve(1);
    rig.pad(o.side, p); rig.muzzle(m);
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
  cost(); rig.pad(o.side, p); rig.muzzle(m);
  return { pose, dist: +(p.distanceTo(m) * 100).toFixed(2), cost: best };
};
