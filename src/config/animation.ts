/** Animation : seuils marche/repos, plages de cadence, lissage, correction des appuis. */
export interface AnimationConfig {
  /** Vitesse réelle (m/s) au-dessus de laquelle la locomotion démarre, et en dessous de laquelle elle s'arrête (deux seuils : hystérésis). */
  startSpeed: number;
  stopSpeed: number;
  /** Seuils d'entrée / de sortie de l'allure « course » (m/s). */
  runStartSpeed: number;
  runStopSpeed: number;
  /** Plage de lecture crédible pour chaque clip : en dehors, on change d'état ou de clip. */
  walkRate: [number, number];
  runRate: [number, number];
  /** Constante de temps (s) du lissage de la vitesse réelle (court : pas de retard visible au freinage). */
  speedSmoothing: number;
  /** Constantes de temps (s) de la montée et de la descente des poids de clips : la descente est plus rapide (pas de pattes qui continuent après l'arrêt). */
  weightSmoothing: number;
  weightFallSmoothing: number;
  /** Constante de temps (s) du lissage de la cadence. */
  rateSmoothing: number;
  /** Réorientation par petits pas : cadence ∝ vitesse angulaire (rad/s de référence). */
  stepOmegaRef: number;
  /** Multiplicateur de calibration visuelle des vitesses nominales des clips. */
  nominalScale: { walk: number; run: number };
  ik: FootIKConfig;
}

export interface FootIKConfig {
  enabled: boolean;
  /** Clips sur lesquels les appuis sont corrigés. La course n'est pas fiable sur ce modèle (phase aérienne). */
  clips: ('walk' | 'run')[];
  /** Poids minimal de locomotion pour appliquer la correction. */
  minLocomotionWeight: number;
  /** Fraction de l'appui consacrée à la montée / à la descente du verrouillage (relâché avant la levée). */
  rise: number;
  fall: number;
  /** Correction maximale demandée au pied (m) : au-delà, le contact est relâché. */
  maxCorrection: number;
  /** Rotation maximale ajoutée à chaque articulation (rad) : préserve la flexion naturelle. */
  maxJointDelta: number;
  iterations: number;
  /** Rotation maximale par itération et par articulation (rad). */
  stepLimit: number;
  /** En dessous de cette vitesse angulaire (rad/s), pas d'IK (réorientation sur place). */
  maxOmega: number;
}

export const DEFAULT_ANIMATION: AnimationConfig = {
  startSpeed: 0.1,
  stopSpeed: 0.045,
  runStartSpeed: 0.74,
  runStopSpeed: 0.66,
  walkRate: [0.45, 1.6],
  runRate: [0.7, 1.35],
  speedSmoothing: 0.06,
  weightSmoothing: 0.07,
  weightFallSmoothing: 0.035,
  rateSmoothing: 0.05,
  stepOmegaRef: 2.0,
  nominalScale: { walk: 1.0, run: 1.0 },
  ik: {
    enabled: true,
    clips: ['walk'],
    minLocomotionWeight: 0.6,
    rise: 0.12,
    fall: 0.28,
    maxCorrection: 0.085,
    maxJointDelta: 0.55,
    iterations: 4,
    stepLimit: 0.4,
    maxOmega: 1.6,
  },
};
