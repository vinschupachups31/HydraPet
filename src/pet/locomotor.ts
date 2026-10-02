/** LocomotionController : réalise le déplacement, le freinage et les virages décidés par le comportement.
 *  C'est le SEUL système qui commande la position et l'orientation de l'animal (la rotation vient de locomotion.ts).
 *  Il mesure aussi la vitesse RÉELLE (distance horizontale parcourue / temps, après freinage et collisions) pour l'animation. */
import { TurnConfig } from '../config/turning';
import { WalkArea } from './layout';
import { LocoState, createLocoState, stepLocomotion, wrapAngle } from './locomotion';

export type LocoStatus = 'idle' | 'moving' | 'arrived' | 'blocked' | 'turning' | 'faced';

export interface StallConfig { timeout: number; minProgress: number }

type Intent =
  | { kind: 'none' }
  | { kind: 'goTo'; x: number; z: number; gait: 'walk' | 'run' }
  | { kind: 'face'; yaw: number };

export class LocomotionController {
  readonly s: LocoState;
  status: LocoStatus = 'idle';
  /** Vitesse réelle brute de la dernière mise à jour (m/s). */
  realSpeedRaw = 0;
  /** Vitesse réelle lissée très légèrement (m/s) : celle qui pilote la cadence des pattes. */
  realSpeed = 0;
  /** Vitesse que la locomotion demandait au corps (m/s). */
  requestedSpeed = 0;
  distance = 0;
  gait: 'walk' | 'run' = 'walk';
  time = 0;

  private intent: Intent = { kind: 'none' };
  private bestDist = Infinity;
  private lastProgress = 0;
  private smoothTau: number;

  constructor(
    private params: TurnConfig,
    private area: WalkArea,
    private bodyRadius: number,
    private stall: StallConfig,
    x = 0, z = 0, heading = 0,
    arriveHysteresis = 0.05,
    smoothTau = 0.06,
  ) {
    this.s = createLocoState(x, z, heading);
    this.arriveSlack = arriveHysteresis;
    this.smoothTau = smoothTau;
  }
  private arriveSlack: number;

  get isMoving() { return this.intent.kind === 'goTo'; }
  get target() { return this.intent.kind === 'goTo' ? { x: this.intent.x, z: this.intent.z } : null; }

  goTo(x: number, z: number, gait: 'walk' | 'run' = 'walk') {
    this.intent = { kind: 'goTo', x, z, gait };
    this.gait = gait;
    this.status = 'moving';
    this.bestDist = Math.hypot(x - this.s.x, z - this.s.z);
    this.lastProgress = this.time;
    this.s.gazeYaw = null;
  }

  /** S'orienter vers un cap (rad), par un virage progressif, sans avancer. */
  faceYaw(yaw: number) {
    this.intent = { kind: 'face', yaw };
    this.status = 'turning';
  }

  faceTowards(x: number, z: number) { this.faceYaw(Math.atan2(x - this.s.x, z - this.s.z)); }

  /** Regarder vers un point (tête et cou, limités anatomiquement) ; le corps ne tourne pas. */
  lookAt(x: number, z: number) { this.s.gazeYaw = Math.atan2(x - this.s.x, z - this.s.z); }
  clearLook() { this.s.gazeYaw = null; }

  /** Arrêt progressif sur place. */
  stop() { this.intent = { kind: 'none' }; if (this.status === 'moving') this.status = 'idle'; }

  update(dt: number) {
    const d = Math.min(Math.max(dt, 1e-4), 0.1);
    this.time += d;
    const s = this.s;
    const px = s.x, pz = s.z;

    const it = this.intent;
    if (it.kind === 'goTo') stepLocomotion(s, { x: it.x, z: it.z }, it.gait, d, this.params);
    else if (it.kind === 'face') stepLocomotion(s, null, 'walk', d, this.params, it.yaw);
    else stepLocomotion(s, null, 'walk', d, this.params);
    this.requestedSpeed = s.speed;

    // le mobilier arrête le corps : on mesure ensuite ce qui a RÉELLEMENT été parcouru
    this.area.resolve(s, this.bodyRadius);
    const moved = Math.hypot(s.x - px, s.z - pz);
    this.realSpeedRaw = moved / d;
    this.realSpeed += (this.realSpeedRaw - this.realSpeed) * (1 - Math.exp(-d / this.smoothTau));

    if (it.kind === 'goTo') {
      this.distance = Math.hypot(it.x - s.x, it.z - s.z);
      // arrivée : dans le rayon (avec la marge d'hystérésis) et quasi à l'arrêt ; ensuite l'intention est effacée, plus de marche/repos qui oscille
      if (this.distance <= this.params.arriveRadius + this.arriveSlack && s.speed < 0.07) {
        this.intent = { kind: 'none' };
        this.status = 'arrived';
        return;
      }
      // blocage : plus aucun progrès vers la cible pendant `timeout` secondes (hors réorientation par petits pas)
      if (this.distance < this.bestDist - this.stall.minProgress) { this.bestDist = this.distance; this.lastProgress = this.time; }
      if (s.phase === 'reorient') this.lastProgress = this.time;
      if (this.time - this.lastProgress > this.stall.timeout) {
        this.intent = { kind: 'none' };
        this.status = 'blocked';
      }
    } else if (it.kind === 'face') {
      if (Math.abs(wrapAngle(it.yaw - s.heading)) < 0.08 && Math.abs(s.omega) < 0.2) this.status = 'faced';
    }
  }
}
