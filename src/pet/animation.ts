/** AnimationController : choisit les clips, leurs poids et leur cadence d'après le mouvement RÉEL du corps,
 *  puis applique la correction des appuis et les mouvements de tête. Il ne décide ni la destination ni la position. */
import * as THREE from 'three';
import { AnimationConfig } from '../config/animation';
import { ClipLocomotionData } from '../config/foxClips';
import { PetModelConfig } from '../config/pet';
import { diag } from '../diag/diagStore';
import { FootDebug, FootIK } from './footIK';
import { applyChain, resolveBones } from './headLook';

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

/** Met le plan à jour. Dépend uniquement de dt : mêmes résultats à 30 et 60 images/s (lissages exponentiels). */
export function planAnimation(p: AnimPlan, inp: AnimInput, dt: number, cfg: AnimationConfig, nominalWalk: number, nominalRun: number): AnimPlan {
  const v = inp.realSpeed;
  // deux seuils distincts : démarrer au-dessus de startSpeed, s'arrêter sous stopSpeed
  if (!p.locomoting && v > cfg.startSpeed) p.locomoting = true;
  else if (p.locomoting && v < cfg.stopSpeed) p.locomoting = false;
  if (!p.running && v > cfg.runStartSpeed) p.running = true;
  else if (p.running && v < cfg.runStopSpeed) p.running = false;

  let tIdle = 1, tWalk = 0, tRun = 0, wRate = clamp(v / nominalWalk, cfg.walkRate[0], cfg.walkRate[1]), rRate = clamp(v / nominalRun, cfg.runRate[0], cfg.runRate[1]);
  if (inp.pivoting) {
    // petits pas de réorientation : la cadence suit la vitesse angulaire, les pas accompagnent la rotation
    const m = smooth(0.08, 0.45, Math.abs(inp.omega) + v / nominalWalk);
    tIdle = 1 - 0.9 * m; tWalk = 0.9 * m;
    wRate = clamp(Math.abs(inp.omega) / cfg.stepOmegaRef, 0.35, 1.3);
  } else if (p.locomoting) {
    // le poids de locomotion suit la vitesse réelle : à l'arrêt du corps, les pattes s'arrêtent aussi
    const w = smooth(cfg.stopSpeed, Math.max(cfg.startSpeed * 2.2, cfg.walkRate[0] * nominalWalk), v);
    const runShare = p.running ? smooth(cfg.runStopSpeed, cfg.runStartSpeed * 1.15, v) : 0;
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
  }

  /** @param gaze  décalages de regard (rad) fournis par la locomotion */
  update(dt: number, inp: AnimInput, gaze: { head: number; spine: number }) {
    const p = planAnimation(this.plan, inp, dt, this.cfg, this.nominalWalk, this.nominalRun);
    const a = this.actions;
    a.idle.setEffectiveWeight(p.idleW); a.walk.setEffectiveWeight(p.walkW); a.run.setEffectiveWeight(p.runW);
    a.idle.setEffectiveTimeScale(p.idleRate); a.walk.setEffectiveTimeScale(p.walkRate); a.run.setEffectiveTimeScale(p.runRate);

    this.mixer.update(dt);                       // 2. évaluation des clips
    this.root.updateMatrixWorld(true);           // 3. matrices du squelette

    // 4. corrections APRÈS le mixeur : appuis (IK), puis épaules et tête (additif, recalculé à chaque image)
    const ikOn = this.cfg.ik.clips;
    const walkOk = ikOn.includes('walk') && p.walkW >= this.cfg.ik.minLocomotionWeight;
    const runOk = ikOn.includes('run') && p.runW >= this.cfg.ik.minLocomotionWeight;
    const clip: Slot | null = walkOk ? 'walk' : runOk ? 'run' : null;
    const phase = clip ? (a[clip].time / this.durations[clip]) % 1 : 0;
    this.ik.update(!!clip && !inp.pivoting && Math.abs(inp.omega) <= this.cfg.ik.maxOmega && p.locomoting, phase);
    applyChain(this.spineChain, gaze.spine);
    applyChain(this.headChain, gaze.head);
    this.root.updateMatrixWorld(true);           // 5. matrices avant le rendu
  }

  debug(): AnimDebug {
    const p = this.plan;
    const active = p.idleW >= p.walkW && p.idleW >= p.runW ? 'repos' : p.runW > p.walkW ? 'course' : 'marche';
    return { active, idleW: p.idleW, walkW: p.walkW, runW: p.runW, walkRate: p.walkRate, runRate: p.runRate, locomoting: p.locomoting, phase: (this.actions.walk.time / this.durations.walk) % 1, feet: this.ik.debug() };
  }
}
