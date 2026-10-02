/** Déplacement et rotation du corps : un seul contrôleur, logique pure (testable sans moteur 3D).
 *
 *  Trois notions séparées :
 *   - orientation SOUHAITÉE : `desiredYaw` (vers la cible ou vers un point à regarder),
 *   - orientation RÉELLE    : le quaternion `q` du corps, qui suit avec accélération et décélération plafonnées,
 *   - direction du DÉPLACEMENT : l'avant du corps (l'animal avance là où il regarde, en décrivant un arc).
 *  Convention : cap h → avant = (sin h, cos h) sur (x, z) ; rotation autour de l'axe Y (haut). */
import { DEFAULT_TURN, TurnConfig } from '../config/turning';

export type LocoParams = TurnConfig;
export const DEFAULT_LOCO: LocoParams = DEFAULT_TURN;

/** Quaternion de rotation autour de Y : seules les composantes (w, y) sont non nulles. */
export interface QuatY { w: number; y: number }
export const quatFromYaw = (yaw: number): QuatY => ({ w: Math.cos(yaw / 2), y: Math.sin(yaw / 2) });
export const quatMul = (a: QuatY, b: QuatY): QuatY => ({ w: a.w * b.w - a.y * b.y, y: a.w * b.y + a.y * b.w });
export const quatConj = (a: QuatY): QuatY => ({ w: a.w, y: -a.y });
export const quatNormalize = (a: QuatY): QuatY => { const n = Math.hypot(a.w, a.y) || 1; return { w: a.w / n, y: a.y / n }; };
/** Angle de lacet porté par le quaternion, dans (-π, π]. */
export const yawOf = (q: QuatY): number => wrapAngle(2 * Math.atan2(q.y, q.w));
/** Écart signé de a vers b, dans [-π, π] : toujours le chemin le plus court. */
export const signedYawBetween = (a: QuatY, b: QuatY): number => yawOf(quatMul(quatConj(a), b));

export const wrapAngle = (a: number): number => {
  let r = (a + Math.PI) % (2 * Math.PI);
  if (r < 0) r += 2 * Math.PI;
  return r - Math.PI;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const smoothstep = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const DEG = Math.PI / 180;

export type TurnPhase = 'idle' | 'arc' | 'reorient';

export interface LocoState {
  x: number;
  z: number;
  /** Orientation réelle du corps. */
  q: QuatY;
  /** Cap dérivé de `q` (rad, pour l'affichage et les tests). */
  heading: number;
  /** Orientation souhaitée (rad). */
  desiredYaw: number;
  /** m/s */
  speed: number;
  accelLin: number;
  /** rad/s, signée (positif = vers la gauche de l'animal, cap qui augmente). */
  omega: number;
  accelAng: number;
  phase: TurnPhase;
  /** Alias historique : vrai pendant la réorientation par petits pas. */
  pivoting: boolean;
  /** Sens de virage engagé : évite de changer de côté près de ±180°. */
  turnSign: number;
  /** Vrai quand l'écart est dans la zone morte (évite les micro-corrections). */
  settled: boolean;
  /** Décalage de regard souhaité par rapport au corps (rad), pour la tête et pour les épaules. */
  gazeHead: number;
  gazeSpine: number;
  /** Direction à regarder imposée par le comportement (lacet absolu, rad) ; null = regarder où l'on va. */
  gazeYaw: number | null;
}

export function createLocoState(x = 0, z = 0, heading = 0): LocoState {
  return {
    x, z, q: quatFromYaw(heading), heading, desiredYaw: heading, speed: 0, accelLin: 0, omega: 0, accelAng: 0,
    phase: 'idle', pivoting: false, turnSign: 0, settled: true, gazeHead: 0, gazeSpine: 0, gazeYaw: null,
  };
}

const MAX_SUBSTEP = 1 / 60;
const MAX_DT = 0.1;

/** Un pas de simulation. `target` : point à rejoindre ; sinon `faceHeading` : cap à prendre sans avancer. */
export function stepLocomotion(
  s: LocoState,
  target: { x: number; z: number } | null,
  gait: 'walk' | 'run',
  dt: number,
  p: LocoParams = DEFAULT_LOCO,
  faceHeading?: number,
): { arrived: boolean; distance: number; headingError: number } {
  // protection contre une image anormalement longue : plafonnée, puis découpée en sous-pas stables
  const total = clamp(dt, 0, MAX_DT);
  const n = Math.max(1, Math.ceil(total / MAX_SUBSTEP));
  let out = { arrived: false, distance: 0, headingError: 0 };
  for (let i = 0; i < n; i++) out = substep(s, target, gait, total / n, p, faceHeading);
  return out;
}

function substep(
  s: LocoState,
  target: { x: number; z: number } | null,
  gait: 'walk' | 'run',
  dt: number,
  p: LocoParams,
  faceHeading?: number,
): { arrived: boolean; distance: number; headingError: number } {
  // ---- 1. orientation souhaitée ----
  let dist = 0;
  if (target) {
    const dx = target.x - s.x;
    const dz = target.z - s.z;
    dist = Math.hypot(dx, dz);
    // près de la cible, on ne recalcule plus la direction : sinon le cap tourne autour du point d'arrivée
    if (dist > p.holdRadius) s.desiredYaw = Math.atan2(dx, dz);
  } else if (faceHeading !== undefined) {
    s.desiredYaw = faceHeading;
  }

  // écart signé le plus court (quaternions), avec sens de virage engagé près de ±180°
  let err = signedYawBetween(s.q, quatFromYaw(s.desiredYaw));
  let absErr = Math.abs(err);
  if (absErr > 0.3) { if (s.turnSign === 0 || absErr < Math.PI - 0.15) s.turnSign = Math.sign(err); }
  else if (absErr < 0.05) s.turnSign = 0;
  if (s.turnSign !== 0 && absErr > Math.PI - 0.15) err = s.turnSign * absErr; // pas de bascule de côté près de ±π

  // ---- 2. zone morte avec hystérésis ----
  // (loin d'une cible, l'animal suit sa direction en continu ; la zone morte ne sert qu'à l'arrivée et à l'arrêt)
  const dz = p.deadZoneDeg * DEG;
  const nearOrNoTarget = !target || dist < 0.6;
  if (!nearOrNoTarget) s.settled = false;
  else if (s.settled && absErr > dz + p.hysteresisDeg * DEG) s.settled = false;
  else if (!s.settled && absErr < dz) s.settled = true;

  // ---- 3. phase : marche en arc ou réorientation par petits pas ----
  const vMax = gait === 'run' ? p.vRun : p.vWalk;
  const nearlyStopped = s.speed < 0.18 * p.vWalk;
  const wantsToMove = !!target && dist > p.arriveRadius;
  if (s.phase !== 'reorient') {
    // entre en réorientation : écart important, animal (presque) à l'arrêt ; ou demi-tour après freinage
    if ((nearlyStopped && absErr > p.reorientEnterDeg * DEG) || (absErr > p.uTurnDeg * DEG && s.speed < 0.3 * p.vWalk)) s.phase = 'reorient';
  } else if (absErr < p.reorientExitDeg * DEG) {
    s.phase = wantsToMove ? 'arc' : 'idle';
  }
  if (s.phase === 'idle' && wantsToMove) s.phase = 'arc';
  if (s.phase === 'arc' && !wantsToMove && s.speed < 0.02) s.phase = 'idle';
  s.pivoting = s.phase === 'reorient';

  // ---- 4. vitesse souhaitée : ralentit quand l'écart de cap augmente ----
  let vDes = 0;
  if (s.phase === 'reorient') {
    vDes = p.reorientCreep; // petit arc de marche, pas de rotation pattes figées
  } else if (wantsToMove) {
    const slow = smoothstep(p.slowStartDeg * DEG, p.slowEndDeg * DEG, absErr);
    const brakeToStop = 1 - smoothstep(p.slowEndDeg * DEG, p.uTurnDeg * DEG, absErr); // demi-tour : on s'arrête
    const factor = (1 - slow * (1 - p.minSpeedFactor)) * brakeToStop;
    const brake = Math.sqrt(2 * p.decel * Math.max(0, dist - p.arriveRadius));
    vDes = Math.min(vMax * factor, brake);
  }
  // accélération linéaire à variation limitée (jerk) : départs et arrêts progressifs
  const aDes = clamp((vDes - s.speed) / 0.22, -p.decel, p.accel);
  s.accelLin += clamp(aDes - s.accelLin, -p.speedJerk * dt, p.speedJerk * dt);
  s.speed = Math.max(0, s.speed + s.accelLin * dt);
  if (s.speed === 0 && s.accelLin < 0) s.accelLin = 0;

  // ---- 5. vitesse angulaire souhaitée ----
  let wDes = 0;
  if (!s.settled) {
    const speedShare = smoothstep(0, p.vWalk, s.speed);
    // virage serré à faible vitesse = plus lent ; en réorientation, la limite est propre à cette phase
    const wMax = s.phase === 'reorient' ? p.reorientRate : p.slowTurnRate + (p.maxTurnRate - p.slowTurnRate) * speedShare;
    // profil de freinage : la vitesse angulaire s'éteint avant d'atteindre le cap (pas d'arrêt sec).
    // On résout  w·retard + w²/(2a) = écart , avec un retard = lissage + montée de l'accélération.
    const aB = p.turnAccel * 0.6;
    const lag = p.turnResponse + (p.turnAccel * 0.6) / p.turnJerk;
    const wBrake = Math.sqrt(aB * aB * lag * lag + 2 * aB * absErr) - aB * lag;
    wDes = Math.sign(err) * Math.min(wMax, wBrake);
  }
  const aAngDes = clamp((wDes - s.omega) / p.turnResponse, -p.turnAccel, p.turnAccel);
  s.accelAng += clamp(aAngDes - s.accelAng, -p.turnJerk * dt, p.turnJerk * dt);
  s.omega += s.accelAng * dt;
  if (Math.abs(s.omega) < 1e-4 && wDes === 0) { s.omega = 0; s.accelAng = 0; }

  // ---- 6. intégration : orientation par quaternion, déplacement vers l'avant du corps ----
  const dYaw = s.omega * dt;
  s.q = quatNormalize(quatMul(s.q, quatFromYaw(dYaw)));
  s.heading = yawOf(s.q);
  if (s.speed > 0) {
    s.x += Math.sin(s.heading) * s.speed * dt;
    s.z += Math.cos(s.heading) * s.speed * dt;
  }

  // ---- 7. regard : la tête vise la direction souhaitée, les épaules la suivent moins loin ----
  const headLim = p.headLimitDeg * DEG;
  const spineLim = p.spineLimitDeg * DEG;
  const forced = s.gazeYaw !== null; // regard imposé par le comportement : la tête le suit même à l'arrêt
  const lookErr = signedYawBetween(s.q, quatFromYaw(forced ? (s.gazeYaw as number) : s.desiredYaw));
  const headTarget = !forced && s.settled && !s.pivoting && s.phase === 'idle' ? 0 : clamp(lookErr, -headLim, headLim);
  const spineTarget = clamp(headTarget * 0.45, -spineLim, spineLim);
  const tHead = Math.max(0.03, (p.gazeLeadMs / 1000) * 0.6);
  const tSpine = Math.max(0.05, p.spineLagMs / 1000);
  s.gazeHead += (headTarget - s.gazeHead) * (1 - Math.exp(-dt / tHead));
  s.gazeSpine += (spineTarget - s.gazeSpine) * (1 - Math.exp(-dt / tSpine));

  const arrived = !!target && dist <= p.arriveRadius && s.speed < 0.03 && Math.abs(s.omega) < 0.15;
  return { arrived, distance: dist, headingError: err };
}

export interface AnimMix {
  idle: number;
  walk: number;
  run: number;
  /** Time-scales qui calent la cadence sur la vitesse réelle (moins de patinage). */
  walkTimeScale: number;
  runTimeScale: number;
  idleTimeScale: number;
}

/** Poids d'animation et cadence. En réorientation, la cadence des pas suit la vitesse angulaire (les pas accompagnent la rotation). */
export function animationMix(s: Pick<LocoState, 'speed' | 'omega' | 'pivoting'>, vWalkRef: number, vRunRef: number, omegaStepRef = 2.0): AnimMix {
  const speed = s.speed;
  if (s.pivoting) {
    const cadence = clamp(Math.abs(s.omega) / omegaStepRef, 0.35, 1.3);
    const m = smoothstep(0.1, 0.5, Math.abs(s.omega) + speed / vWalkRef);
    return { idle: 1 - 0.9 * m, walk: 0.9 * m, run: 0, walkTimeScale: cadence, runTimeScale: 1, idleTimeScale: 1 };
  }
  const moving = smoothstep(0.02, 0.12, speed);
  const runShare = smoothstep(vWalkRef * 1.12, vRunRef * 0.85, speed);
  return {
    idle: 1 - moving,
    walk: moving * (1 - runShare),
    run: moving * runShare,
    walkTimeScale: clamp(speed / vWalkRef, 0.55, 1.5),
    runTimeScale: clamp(speed / vRunRef, 0.7, 1.35),
    idleTimeScale: 1,
  };
}
