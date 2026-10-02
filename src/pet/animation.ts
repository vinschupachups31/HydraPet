/** AnimationController : choisit les clips, leurs poids et leur cadence d'après le mouvement RÉEL du corps,
 *  puis applique la correction des appuis et les mouvements de tête. Il ne décide ni la destination ni la position. */
import * as THREE from 'three';
import { AnimationConfig } from '../config/animation';
import { ClipLocomotionData } from '../config/foxClips';
import { PetModelConfig } from '../config/pet';
import { diag } from '../diag/diagStore';
import { FootDebug, FootIK, contactPosition, solveChain } from './footIK';
import { applyChain, applyPitchChain, resolveBones } from './headLook';
import { ExpressionLayer } from './expression';
import { PostureController } from './posture';
import { PoseRig } from './rig';
import { ACTIVE_PROFILE } from '../config/modelProfile';
const FOX_RIG = ACTIVE_PROFILE.rig;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const smooth = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

// ----------------------------------------------------------------------------- planificateur pur
export interface AnimInput {
  /** Vitesse horizontale réellement parcourue (m/s) : distance / temps, après freinage et contraintes. */
  realSpeed: number;
  omega: number;
  /** Réorientation par petits pas. */
  pivoting: boolean;
}

export interface AnimPlan {
  /** Locomotion en cours (avec hystérésis : deux seuils, démarrage et arrêt). */
  locomoting: boolean;
  running: boolean;
  idleW: number;
  walkW: number;
  runW: number;
  walkRate: number;
  runRate: number;
  idleRate: number;
}

export const newPlan = (): AnimPlan => ({ locomoting: false, running: false, idleW: 1, walkW: 0, runW: 0, walkRate: 1, runRate: 1, idleRate: 1 });

/** Couches de correction, activables une à une pour isoler celle qui déforme le corps (diagnostic).
 *  clip : clip seul, parent immobile ; root : clip + déplacement du parent ; procedural : + posture, sol, regard, oreilles ; full : + appuis IK. */
export type LayerMode = 'clip' | 'root' | 'procedural' | 'full';
export interface Layers { ik: boolean; ground: boolean; posture: boolean; gaze: boolean; expression: boolean }
export const LAYER_MODES: Record<LayerMode, Layers> = {
  clip: { ik: false, ground: false, posture: false, gaze: false, expression: false },
  root: { ik: false, ground: false, posture: false, gaze: false, expression: false },
  procedural: { ik: false, ground: true, posture: true, gaze: true, expression: true },
  full: { ik: true, ground: true, posture: true, gaze: true, expression: true },
};
const REF_WALK = 0.565, REF_RUN = 0.858;

/** Met le plan à jour. Dépend uniquement de dt : mêmes résultats à 30 et 60 images/s (lissages exponentiels). */
export function planAnimation(p: AnimPlan, inp: AnimInput, dt: number, cfg: AnimationConfig, nominalWalk: number, nominalRun: number): AnimPlan {
  const v = inp.realSpeed;
  // les seuils de la config ont été réglés sur la marche (0,565 m/s) et la course (0,858 m/s) du renard : ils suivent les vitesses nominales du modèle
  const kw = nominalWalk / REF_WALK, kr0 = nominalRun / REF_RUN;
  const startSpeed = cfg.startSpeed * kw, stopSpeed = cfg.stopSpeed * kw, runStartSpeed = cfg.runStartSpeed * kr0, runStopSpeed = cfg.runStopSpeed * kr0;
  // deux seuils distincts : démarrer au-dessus de startSpeed, s'arrêter sous stopSpeed
  if (!p.locomoting && v > startSpeed) p.locomoting = true;
  else if (p.locomoting && v < stopSpeed) p.locomoting = false;
  if (!p.running && v > runStartSpeed) p.running = true;
  else if (p.running && v < runStopSpeed) p.running = false;

  let tIdle = 1, tWalk = 0, tRun = 0, wRate = clamp(v / nominalWalk, cfg.walkRate[0], cfg.walkRate[1]), rRate = clamp(v / nominalRun, cfg.runRate[0], cfg.runRate[1]);
  if (inp.pivoting) {
    // petits pas de réorientation : la cadence suit la vitesse angulaire, les pas accompagnent la rotation
    const m = smooth(0.08, 0.45, Math.abs(inp.omega) + v / nominalWalk);
    tIdle = 1 - 0.9 * m; tWalk = 0.9 * m;
    wRate = clamp(Math.abs(inp.omega) / cfg.stepOmegaRef, 0.35, 1.3);
  } else if (p.locomoting) {
    // le poids de locomotion suit la vitesse réelle : à l'arrêt du corps, les pattes s'arrêtent aussi
    const w = smooth(stopSpeed, Math.max(startSpeed * 2.2, cfg.walkRate[0] * nominalWalk), v);
    const runShare = p.running ? smooth(runStopSpeed, runStartSpeed * 1.15, v) : 0;
    tIdle = 1 - w; tWalk = w * (1 - runShare); tRun = w * runShare;
  }
  const kUp = 1 - Math.exp(-dt / cfg.weightSmoothing), kDown = 1 - Math.exp(-dt / cfg.weightFallSmoothing), kr = 1 - Math.exp(-dt / cfg.rateSmoothing);
  p.idleW += (tIdle - p.idleW) * (tIdle > p.idleW ? kUp : kDown);
  p.walkW += (tWalk - p.walkW) * (tWalk > p.walkW ? kUp : kDown);
  p.runW += (tRun - p.runW) * (tRun > p.runW ? kUp : kDown);
  const sum = p.idleW + p.walkW + p.runW || 1;
  p.idleW /= sum; p.walkW /= sum; p.runW /= sum;
  p.walkRate += (wRate - p.walkRate) * kr;
  p.runRate += (rRate - p.runRate) * kr;
  p.idleRate = 1;
  return p;
}

// ----------------------------------------------------------------------------- contrôleur (moteur 3D)
type Slot = 'idle' | 'walk' | 'run';

export interface AnimDebug {
  active: string;
  idleW: number; walkW: number; runW: number;
  walkRate: number; runRate: number;
  locomoting: boolean;
  phase: number;
  feet: FootDebug[];
  /** Posture : état, poids de la couche, décalage du sol (cm), écart patte-museau pendant la toilette (cm), pieds tenus. */
  posture: { state: string; weight: number; groundShift: number; groomGap: number; anchored: string[]; contact: number };
}

export class AnimationController {
  readonly mixer: THREE.AnimationMixer;
  readonly actions = {} as Record<Slot, THREE.AnimationAction>;
  readonly plan = newPlan();
  readonly ik: FootIK;
  readonly nominalWalk: number;
  readonly nominalRun: number;
  private headChain: ReturnType<typeof resolveBones>;
  private spineChain: ReturnType<typeof resolveBones>;
  private durations: Record<Slot, number>;
  readonly rig: PoseRig;
  private expression: ExpressionLayer | null = null;
  layerMode: LayerMode = 'full';
  readonly layers: Layers = { ...LAYER_MODES.full };
  setLayerMode(m: LayerMode) { this.layerMode = m; Object.assign(this.layers, LAYER_MODES[m]); }
  posture: PostureController | null = null;
  private anchorSeq = -1;
  private anchorTargets: { key: string; chain: THREE.Object3D[]; effector: THREE.Object3D; target: THREE.Vector3 }[] = [];
  private gazePitchNow = 0;
  private groomGap = 0;
  private padOffset = new THREE.Vector3();
  private muzzleOffset = new THREE.Vector3();
  private tv = new THREE.Vector3();
  private tv2 = new THREE.Vector3();

  constructor(
    private root: THREE.Object3D,
    clips: THREE.AnimationClip[],
    private model: PetModelConfig,
    private cfg: AnimationConfig,
    clipData: Record<string, ClipLocomotionData>,
  ) {
    this.mixer = new THREE.AnimationMixer(root);
    this.durations = { idle: 1, walk: 1, run: 1 };
    (Object.keys(model.clips) as Slot[]).forEach((slot) => {
      const clip = THREE.AnimationClip.findByName(clips, model.clips[slot]);
      if (!clip) throw new Error(`Clip « ${model.clips[slot]} » introuvable. Clips : ${clips.map((a) => a.name).join(', ')}`);
      const a = this.mixer.clipAction(clip);
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.play();
      a.setEffectiveWeight(slot === 'idle' ? 1 : 0);
      this.actions[slot] = a;
      this.durations[slot] = clip.duration;
    });
    // vitesses nominales EN MÈTRES/SECONDE : métadonnées du clip × échelle du modèle × calibration visuelle
    const wd = clipData[model.clips.walk], rd = clipData[model.clips.run];
    this.nominalWalk = (wd?.nominalSpeed ?? model.groundSpeed.walk) * model.scale * cfg.nominalScale.walk;
    this.nominalRun = (rd?.nominalSpeed ?? model.groundSpeed.run) * model.scale * cfg.nominalScale.run;
    const contacts: Record<string, [number, number][]> = {};
    (wd?.feet ?? []).forEach((f) => { contacts[f.bone] = f.contacts; });
    this.ik = new FootIK(root, model.footChains, contacts, cfg.ik);
    if (this.ik.missing.length) diag.step('ik', 'fail', `Chaînes IK incomplètes : ${this.ik.missing.join(', ')}`);
    this.headChain = resolveBones(root, model.headBones);
    this.spineChain = resolveBones(root, model.spineBones);
    this.rig = new PoseRig(root);
    this.expression = model.expression ? new ExpressionLayer(root, model.expression) : null;
    if (this.rig.missing.length) diag.step('rig', 'fail', `Os de posture introuvables : ${this.rig.missing.join(', ')}`);
  }

  /** @param gaze  décalages de regard (rad) fournis par la locomotion ; `pitch` : inclinaison verticale de la tête (rad, > 0 vers le bas) */
  update(dt: number, inp: AnimInput, gaze: { head: number; spine: number; pitch?: number }) {
    const post = this.posture;
    const L = this.layers;
    const posed = L.posture && !!post && (post.weight > 1e-3 || post.busy);
    const p = planAnimation(this.plan, posed ? { realSpeed: 0, omega: 0, pivoting: false } : inp, dt, this.cfg, this.nominalWalk, this.nominalRun);
    const a = this.actions;
    a.idle.setEffectiveWeight(p.idleW); a.walk.setEffectiveWeight(p.walkW); a.run.setEffectiveWeight(p.runW);
    a.idle.setEffectiveTimeScale(p.idleRate); a.walk.setEffectiveTimeScale(p.walkRate); a.run.setEffectiveTimeScale(p.runRate);

    this.mixer.update(dt);                       // 2. évaluation des clips
    this.root.updateMatrixWorld(true);           // 3. matrices du squelette

    // 4. corrections APRÈS le mixeur : posture procédurale, appuis, puis épaules et tête (additif, recalculé à chaque image)
    if (posed) {
      this.rig.applyArray(post!.pose, post!.weight);
      this.root.updateMatrixWorld(true);
      if (L.ground) this.rig.groundSolve(post!.weight);        // le bassin descend avec les membres fléchis : le corps ne traverse pas le sol et ne flotte pas
      this.holdAnchors(post!);
      this.groomContact(post!);
      if (L.ground) this.rig.groundSolve(post!.weight);        // 2e passe : les contraintes ci-dessus ne doivent jamais enfoncer un pied dans le sol
      if (L.ik) this.ik.update(false, 0, dt); else this.ik.hold(dt);
    } else {
      this.rig.groundShift = 0; this.anchorSeq = -1; this.groomGap = 0;
      const ikOn = this.cfg.ik.clips;
      const walkOk = ikOn.includes('walk') && p.walkW >= this.cfg.ik.minLocomotionWeight;
      const runOk = ikOn.includes('run') && p.runW >= this.cfg.ik.minLocomotionWeight;
      const clip: Slot | null = walkOk ? 'walk' : runOk ? 'run' : null;
      const phase = clip ? (a[clip].time / this.durations[clip]) % 1 : 0;
      const walking = !!clip && (inp.pivoting || p.locomoting) && Math.abs(inp.omega) <= this.cfg.ik.maxOmega;
      if (!L.ik) { for (const f of this.ik.feet) { f.plant = null; f.weight = 0; } }
      else if (walking) this.ik.update(true, phase, dt); else this.ik.hold(dt);
      this.root.updateMatrixWorld(true);
      if (L.ground) this.rig.groundSolve(1, 0, true);           // le corps ne s'enfonce jamais dans le sol pendant la marche ; il n'est pas abaissé (course : phase aérienne)
    }
    const gazeOk = L.gaze && (!post || post.allowGaze);
    const k = 1 - Math.exp(-dt / 0.25);
    this.gazePitchNow += (((gazeOk ? gaze.pitch ?? 0 : 0)) - this.gazePitchNow) * k;
    applyChain(this.spineChain, gazeOk ? gaze.spine : 0);
    applyChain(this.headChain, gazeOk ? gaze.head : 0);
    applyPitchChain(this.headChain, this.gazePitchNow, this.root);
    if (this.expression && L.expression) {      // oreilles : pas pendant la toilette (la patte touche l'oreille)
      this.expression.weight = post && post.state === 'Grooming' ? 0 : 1;
      this.expression.update(dt);
    }
    this.root.updateMatrixWorld(true);           // 5. matrices avant le rendu
  }

  /** Pieds tenus en coordonnées monde pendant une séquence (pas de glissement des appuis qui restent au sol). */
  private holdAnchors(post: PostureController) {
    const seq = post.seq;
    if (!seq || !seq.def.anchors?.length) { this.anchorSeq = -1; return; }
    if (this.anchorSeq !== seq.id) {                      // capture à la première image de la séquence, pose déjà appliquée
      this.anchorSeq = seq.id;
      this.anchorTargets = seq.def.anchors.map((n) => {
        const key = n as 'handL' | 'handR' | 'footL2' | 'footR2';
        const chainKeys = key === 'handL' ? FOX_RIG.forepaw.L : key === 'handR' ? FOX_RIG.forepaw.R : key === 'footL2' ? (['legL1', 'legL2', 'footL1', 'footL2'] as const) : (['legR1', 'legR2', 'footR1', 'footR2'] as const);
        const chain = chainKeys.map((c) => this.rig.bones[c]);
        const effector = chain[chain.length - 1];
        return { key, chain, effector, target: effector.getWorldPosition(new THREE.Vector3()) };
      });
    }
    // la contrainte se relâche pendant le dernier quart de la séquence : la pose finale reprend la main sans saut
    const rel0 = 1 - Math.max(0, (seq.time / seq.duration - 0.78) / 0.22);
    for (const t of this.anchorTargets) {
      const cur = t.effector.getWorldPosition(this.tv);
      let rel = rel0, lift = 0, k = 1;                                               // k : 1 = tenu, 0 = à la place que donne la pose
      const st = seq.def.steps?.[t.key as 'footL2'];
      if (st) {                                                                        // repositionnement : relâcher, soulever légèrement, déplacer, reposer
        const u = (seq.time - st.at * seq.duration) / st.dur;
        if (u >= 1) rel = 0; else if (u > 0) { // le déplacement n'a lieu que pendant que le pied est en l'air
          const m = Math.max(0, Math.min(1, (u - 0.18) / 0.64)), e = m * m * (3 - 2 * m); k = 1 - e; lift = (t.key.startsWith('hand') ? 0.04 : 0.025) * Math.sin(Math.PI * u); rel = 1; }
      }
      if (rel <= 0.01) continue;
      const heldX = t.target.x, heldZ = t.target.z;
      const tx = cur.x + (heldX - cur.x) * rel * k, tz = cur.z + (heldZ - cur.z) * rel * k;   // horizontal seulement : la hauteur reste celle de la pose
      this.tv2.set(tx, cur.y + lift, tz);
      solveChain(t.chain, t.effector, null, this.tv2, { iterations: lift > 0 ? 9 : 5, stepLimit: 0.5, maxJointDelta: lift > 0 ? 1.3 : 0.9 });
    }
    this.root.updateMatrixWorld(true);
  }

  /** Point de la tête visé par la patte (museau, joue, oreille), côté de la patte utilisée. */
  private facePointWorld(post: PostureController, out: THREE.Vector3) {
    const c = post.facePoint, flip = post.groomSide === 'L' ? -1 : 1;
    this.fp[0] = c[0] * flip; this.fp[1] = c[1]; this.fp[2] = c[2];
    return this.rig.headPoint(this.fp, out);
  }
  private fp = [0, 0, 0];

  /** Toilette : la patte se rapproche du point visé et la tête de la patte, dans des limites articulaires. Écart mesuré en monde (cm). */
  private groomContact(post: PostureController) {
    if (post.state !== 'Grooming' || post.contact < 0.05) { this.groomGap = 0; return; }
    const w = post.contact, side = post.groomSide;
    const hand = this.rig.bones[side === 'R' ? 'handR' : 'handL'];
    const chain = FOX_RIG.forepaw[side].map((c) => this.rig.bones[c]);
    const pt = this.facePointWorld(post, this.tv), pad = this.rig.pad(side, this.tv2);
    this.groomGap = pt.distanceTo(pad) * 100;
    // 1) la patte vient vers le point visé (arrêt à ~1,5 cm : pas de traversée)
    // distance de sécurité de 1,8 cm : trop loin → la patte se rapproche ; trop près → elle est repoussée (le volume de la patte ne pénètre pas la tête)
    const n = this.tv2.clone().sub(this.tv); if (n.lengthSq() < 1e-8) n.set(0, 0, 1); n.normalize();
    const want = this.tv.clone().add(n.multiplyScalar(0.018));
    const target = this.tv2.clone().lerp(want, w);
    const localPad = this.localOffset(hand, this.rig.pad(side, this.tv2));
    solveChain(chain, hand, localPad, target, { iterations: 5, stepLimit: 0.35, maxJointDelta: 0.5 });
    this.root.updateMatrixWorld(true);
    // 2) la tête s'incline légèrement vers la patte
    const pad2 = this.rig.pad(side, this.tv2);
    const headChain = [this.rig.bones.neck, this.rig.bones.head];
    const pt2 = this.facePointWorld(post, this.tv);
    const away = pad2.clone().sub(pt2); const gap = away.length();
    if (gap > 0.02) {
      const t2 = pt2.clone().add(away.multiplyScalar((gap - 0.02) / gap * 0.6 * w));
      const localPt = this.localOffset(this.rig.bones.head, pt2);
      solveChain(headChain, this.rig.bones.head, localPt, t2, { iterations: 3, stepLimit: 0.15, maxJointDelta: 0.22 });
      this.root.updateMatrixWorld(true);
    }
    this.groomGap = this.facePointWorld(post, this.tv).distanceTo(this.rig.pad(side, this.tv2)) * 100;
  }

  private localOffset(bone: THREE.Object3D, world: THREE.Vector3) {
    return bone.worldToLocal(world.clone());
  }

  /** Phase d'appui d'un pied d'après les métadonnées du clip de marche : appui, levée, ou non identifiable (autre clip, mélange avec le repos). */
  contactPhase(i: number): 'stance' | 'swing' | 'none' {
    const f = this.ik.feet[i];
    if (!f || this.plan.walkW < 0.5 || (this.posture && (this.posture.busy || this.posture.weight > 0.01))) return 'none';
    if (f.stepFrom) return 'swing';               // pas de repositionnement explicite (pied soulevé) : un déplacement voulu, pas un glissement
    const ph = (this.actions.walk.time / this.durations.walk) % 1;
    return contactPosition(f.contacts, ph) !== null ? 'stance' : 'swing';
  }

  debug(): AnimDebug {
    const p = this.plan;
    const active = p.idleW >= p.walkW && p.idleW >= p.runW ? 'repos' : p.runW > p.walkW ? 'course' : 'marche';
    return { active, idleW: p.idleW, walkW: p.walkW, runW: p.runW, walkRate: p.walkRate, runRate: p.runRate, locomoting: p.locomoting, phase: (this.actions.walk.time / this.durations.walk) % 1, feet: this.ik.debug(), posture: { state: this.posture?.state ?? 'StandingIdle', weight: this.posture?.weight ?? 0, groundShift: this.rig.groundShift * 100, groomGap: this.groomGap, anchored: (this.posture?.anchors ?? []) as string[], contact: this.posture?.contact ?? 0 } };
  }
}
