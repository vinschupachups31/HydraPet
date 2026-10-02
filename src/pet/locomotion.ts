/** Déplacement du corps de l'animal : pure logique, sans moteur 3D, testable sans téléphone.
 *  Convention : cap h → direction d'avance (sin h, cos h) sur le plan (x, z). */
export interface LocoState {
  x: number;
  z: number;
  heading: number;
  /** m/s */
  speed: number;
  /** vrai quand l'animal pivote sur place en piétinant. */
  pivoting: boolean;
}

export interface LocoParams {
  vWalk: number;
  vRun: number;
  accel: number;
  decel: number;
  /** Rayon de virage minimal en marchant (m) : limite la vitesse de rotation à v / rayon. */
  minTurnRadius: number;
  /** Rotation sur place (rad/s) quand l'écart de cap est grand. */
  pivotRate: number;
  /** Au-delà de cet écart (rad) et à l'arrêt, l'animal pivote avant de partir. */
  pivotThreshold: number;
  arriveRadius: number;
}

export const DEFAULT_LOCO: LocoParams = {
  vWalk: 0.4,
  vRun: 0.9,
  accel: 0.9,
  decel: 1.6,
  minTurnRadius: 0.22,
  pivotRate: 2.0,
  pivotThreshold: 0.8,
  arriveRadius: 0.06,
};

export const wrapAngle = (a: number): number => {
  let r = (a + Math.PI) % (2 * Math.PI);
  if (r < 0) r += 2 * Math.PI;
  return r - Math.PI;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Fait avancer l'état d'un pas de temps vers (tx, tz). `faceOnly` : ne pas avancer, seulement s'orienter. */
export function stepLocomotion(
  s: LocoState,
  target: { x: number; z: number } | null,
  gait: 'walk' | 'run',
  dt: number,
  p: LocoParams = DEFAULT_LOCO,
  faceHeading?: number,
): { arrived: boolean; distance: number; headingError: number } {
  let desired = s.heading;
  let dist = 0;
  if (target) {
    const dx = target.x - s.x;
    const dz = target.z - s.z;
    dist = Math.hypot(dx, dz);
    if (dist > 1e-4) desired = Math.atan2(dx, dz);
  } else if (faceHeading !== undefined) {
    desired = faceHeading;
  }
  const err = wrapAngle(desired - s.heading);
  const vMax = gait === 'run' ? p.vRun : p.vWalk;

  let vTarget = 0;
  if (target && dist > p.arriveRadius) {
    // plus l'écart de cap est grand, plus on ralentit (virage en arc plutôt que demi-tour sec)
    const turnFactor = clamp(1 - Math.abs(err) / 1.2, 0, 1);
    const brake = Math.sqrt(2 * p.decel * Math.max(0, dist - p.arriveRadius));
    vTarget = Math.min(vMax * turnFactor, brake);
  }

  // pivot sur place : écart important alors qu'on est (presque) à l'arrêt
  const stopped = s.speed < 0.05;
  if (stopped && Math.abs(err) > (target ? p.pivotThreshold : 0.05)) {
    s.pivoting = true;
    vTarget = 0;
  } else if (Math.abs(err) < 0.25) {
    s.pivoting = false;
  }

  const dv = clamp(vTarget - s.speed, -p.decel * dt, p.accel * dt);
  s.speed = Math.max(0, s.speed + dv);

  // vitesse de rotation : limitée par la courbure en marche, par pivotRate à l'arrêt
  const omegaMax = s.pivoting || s.speed < 0.05 ? p.pivotRate : Math.max(p.pivotRate * 0.25, s.speed / p.minTurnRadius);
  s.heading = wrapAngle(s.heading + clamp(err, -omegaMax * dt, omegaMax * dt));

  if (s.speed > 0 && !s.pivoting) {
    s.x += Math.sin(s.heading) * s.speed * dt;
    s.z += Math.cos(s.heading) * s.speed * dt;
  }
  const arrived = !!target && dist <= p.arriveRadius && s.speed < 0.05;
  return { arrived, distance: dist, headingError: err };
}

export interface AnimMix {
  idle: number;
  walk: number;
  run: number;
  /** Time-scales qui calent la cadence sur la vitesse du corps (moins de patinage). */
  walkTimeScale: number;
  runTimeScale: number;
  idleTimeScale: number;
}

/** Poids d'animation et cadence selon la vitesse. `vWalkRef` / `vRunRef` = vitesses sans glissement des clips (m/s). */
export function animationMix(speed: number, pivoting: boolean, vWalkRef: number, vRunRef: number): AnimMix {
  const smooth = (e0: number, e1: number, x: number) => {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  if (pivoting) return { idle: 0.3, walk: 0.7, run: 0, walkTimeScale: 0.55, runTimeScale: 1, idleTimeScale: 1 };
  const moving = smooth(0.02, 0.12, speed);
  const runShare = smooth(vWalkRef * 1.12, vRunRef * 0.85, speed);
  const walkRatio = clamp(speed / vWalkRef, 0.55, 1.5);
  const runRatio = clamp(speed / vRunRef, 0.7, 1.35);
  return {
    idle: 1 - moving,
    walk: moving * (1 - runShare),
    run: moving * runShare,
    walkTimeScale: walkRatio,
    runTimeScale: runRatio,
    idleTimeScale: 1,
  };
}
