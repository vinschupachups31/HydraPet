/** Paramètres de virage : tout se règle ici (angles en degrés ou rad/s, vitesses en m/s, durées en ms). */
export interface TurnConfig {
  // ---- vitesse de marche (m/s) ----
  vWalk: number;
  vRun: number;
  accel: number;
  decel: number;
  /** Limite de variation de l'accélération (m/s³) : départs et arrêts progressifs. */
  speedJerk: number;
  arriveRadius: number;

  // ---- rotation du corps ----
  /** Vitesse angulaire maximale en marche rapide (rad/s). */
  maxTurnRate: number;
  /** Vitesse angulaire maximale à très faible vitesse : plus petite = virage serré plus lent (rad/s). */
  slowTurnRate: number;
  /** Accélération angulaire maximale (rad/s²). */
  turnAccel: number;
  /** Variation maximale de l'accélération angulaire (rad/s³) : pas de départ de virage brutal. */
  turnJerk: number;
  /** Constante de temps du suivi de la vitesse angulaire souhaitée (s). */
  turnResponse: number;

  // ---- couplage vitesse / courbure ----
  /** Écart de cap (°) à partir duquel on commence à ralentir. */
  slowStartDeg: number;
  /** Écart de cap (°) où le ralentissement atteint `minSpeedFactor`. */
  slowEndDeg: number;
  /** Fraction de la vitesse conservée dans un virage serré. */
  minSpeedFactor: number;
  /** Au-delà de cet écart (°) : freinage complet puis réorientation (demi-tour). */
  uTurnDeg: number;

  // ---- réorientation par petits pas (demi-tour, pivot) ----
  /** Écart (°) au-dessus duquel un animal quasi à l'arrêt se réoriente avant de partir. */
  reorientEnterDeg: number;
  /** Écart (°) sous lequel la réorientation se termine (hystérésis). */
  reorientExitDeg: number;
  /** Vitesse angulaire maximale pendant la réorientation (rad/s). */
  reorientRate: number;
  /** Petit arc de marche pendant la réorientation (m/s) : l'animal ne tourne pas pattes figées. */
  reorientCreep: number;

  // ---- zone morte et hystérésis ----
  deadZoneDeg: number;
  hysteresisDeg: number;
  /** Sous cette distance de la cible, la direction n'est plus recalculée (évite le tremblement). */
  holdRadius: number;

  // ---- regard : tête, cou, épaules ----
  /** Délai d'anticipation de la tête sur le corps (ms), 100 à 200. */
  gazeLeadMs: number;
  /** Rotation maximale de tête + cou (°). */
  headLimitDeg: number;
  /** Les épaules (colonne) suivent plus tard et moins loin. */
  spineLagMs: number;
  spineLimitDeg: number;
}

export const DEFAULT_TURN: TurnConfig = {
  vWalk: 0.4,
  vRun: 0.9,
  accel: 0.9,
  decel: 1.6,
  speedJerk: 5,
  arriveRadius: 0.06,

  maxTurnRate: 2.6,
  slowTurnRate: 0.9,
  turnAccel: 7,
  turnJerk: 45,
  turnResponse: 0.14,

  slowStartDeg: 20,
  slowEndDeg: 100,
  minSpeedFactor: 0.28,
  uTurnDeg: 135,

  reorientEnterDeg: 55,
  reorientExitDeg: 22,
  reorientRate: 2.1,
  reorientCreep: 0.07,

  deadZoneDeg: 2,
  hysteresisDeg: 5,
  holdRadius: 0.22,

  gazeLeadMs: 150,
  headLimitDeg: 38,
  spineLagMs: 260,
  spineLimitDeg: 14,
};
