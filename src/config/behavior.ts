/** Comportement autonome : durées, points d'intérêt, cooldowns, approche de l'utilisateur, détection de blocage.
 *  Durées en secondes, distances en mètres. Tout se règle ici. */
export type Zone = 'back' | 'mid' | 'front';
export type Activity = 'observe' | 'examine' | 'rest';

export interface PointOfInterest {
  id: string;
  label: string;
  /** Profondeur : arrière-plan (exploration rare), centre (la plupart des activités), premier plan (présence). */
  zone: Zone;
  /** Position absolue dans la pièce (mobilier) ; ignorée si `xn` est donné. */
  x: number;
  z: number;
  /** Position latérale RELATIVE au champ visible à la profondeur z (-1 = bord gauche utile, 1 = bord droit) : la même variété en portrait et en paysage. */
  xn?: number;
  /** Rayon de variation : la destination réelle est tirée dans ce disque, une seule fois par trajet. */
  radius: number;
  weight: number;
  /** Délai avant de pouvoir le choisir à nouveau. */
  cooldown: number;
  /** Ce que l'animal peut y faire. Seules des activités réellement animées : observer, examiner (regard), se reposer. */
  activities: Activity[];
  /** Point de la pièce (meuble) vers lequel il regarde en « examinant ». */
  lookAt?: { x: number; z: number };
}

export interface BehaviorConfig {
  /** Fréquence des évaluations d'opportunités (approche…). Les transitions d'état ne dépendent pas de cette fréquence. */
  decisionHz: number;
  /** Observation après un trajet (Survey / regard) : 2 à 6 s. */
  observeAfterTrip: [number, number];
  /** Probabilité d'observer après un trajet (jamais plus de `maxTripsInRow` trajets d'affilée de toute façon). */
  observeChance: number;
  longPauseChance: number;
  /** Pause longue : 8 à 20 s. */
  longPause: [number, number];
  examine: [number, number];
  examineChance: number;
  maxTripsInRow: number;
  /** Pas de déplacements minuscules sans intention. */
  minTripDistance: number;
  /** Rayon du corps pour vérifier l'espace libre (pas seulement le centre). */
  bodyRadius: number;
  /** Les N dernières destinations sont pénalisées (plus la plus récente). */
  recentPenalty: number[];
  /** Pénalité supplémentaire pour revenir à l'avant-dernière destination (aller-retour A→B→A). */
  pingPongPenalty: number;
  zoneWeights: Record<Zone, number>;
  /** Chance de trotter/courir (clip Run) pour un long trajet. */
  runChance: number;
  runMinDistance: number;
  /** Marge entre le centre du corps et le bord du champ de la caméra. */
  viewEdgeMargin: number;

  /** Arrivée : rayon, et hystérésis (une fois arrivé, on ne repart que si on s'éloigne de plus de radius + hysteresis). */
  arrive: { radius: number; hysteresis: number };
  /** Blocage : aucune progression vers la cible pendant `timeout` s. */
  stall: { timeout: number; minProgress: number; poiCooldown: number };

  approach: {
    /** Une occasion toutes les 25 à 50 s (tirée une seule fois après chaque approche). */
    every: [number, number];
    /** Premier délai après l'ouverture : on ne vient pas systématiquement tout de suite. */
    firstDelay: [number, number];
    /** Probabilité de saisir l'occasion. */
    chance: number;
    stay: [number, number];
    /** Pas d'approche spontanée juste après une interaction. */
    quietAfterInteraction: number;
    /** L'approche ne coupe jamais une observation avant ce délai (s), ni une pause longue : l'occasion attend la fin. */
    minObserve: number;
    /** Un trajet en cours n'est interrompu qu'après avoir parcouru `minWalked` mètres, et s'il en reste plus de `minRemaining`. */
    minWalked: number;
    minRemaining: number;
    /** Point d'approche : profondeur z (x = 0). La hauteur apparente est réglée par le cadrage. */
    z: number;
  };

  /** Réaction à un toucher. */
  react: { duration: [number, number]; observeAfter: [number, number] };
  pois: PointOfInterest[];
}

export const DEFAULT_BEHAVIOR: BehaviorConfig = {
  decisionHz: 4,
  observeAfterTrip: [2, 6],
  observeChance: 0.9,
  longPauseChance: 0.18,
  longPause: [8, 20],
  examine: [3, 6],
  examineChance: 0.26,
  maxTripsInRow: 2,
  minTripDistance: 0.5,
  bodyRadius: 0.24,
  recentPenalty: [0.08, 0.3, 0.55],
  pingPongPenalty: 0.35,
  zoneWeights: { back: 0.7, mid: 1.0, front: 1.0 },
  runChance: 0.08,
  runMinDistance: 1.3,
  viewEdgeMargin: 0.18,

  arrive: { radius: 0.09, hysteresis: 0.05 },
  stall: { timeout: 2.5, minProgress: 0.05, poiCooldown: 40 },

  approach: { every: [25, 50], firstDelay: [18, 40], chance: 0.85, stay: [3, 7], quietAfterInteraction: 8, minObserve: 2.2, minWalked: 0.4, minRemaining: 0.7, z: 1.5 },
  react: { duration: [2.2, 3.4], observeAfter: [1, 2.2] },

  pois: [
    { id: 'rug-center', label: 'Tapis', zone: 'mid', x: 0.1, xn: 0.05, z: 0.15, radius: 0.35, weight: 3, cooldown: 18, activities: ['observe', 'rest'] },
    { id: 'rug-left', label: 'Tapis (gauche)', zone: 'mid', x: -0.4, xn: -0.55, z: 0.4, radius: 0.3, weight: 2, cooldown: 20, activities: ['observe', 'rest'] },
    { id: 'center', label: 'Centre de la pièce', zone: 'mid', x: 0.05, xn: 0.1, z: -0.4, radius: 0.35, weight: 2.2, cooldown: 15, activities: ['observe', 'examine'], lookAt: { x: 0.95, z: -1.3 } },
    { id: 'sofa-front', label: 'Devant le canapé', zone: 'mid', x: 0.45, z: -0.6, radius: 0.28, weight: 2.4, cooldown: 25, activities: ['examine', 'observe'], lookAt: { x: 0.95, z: -1.3 } },
    { id: 'left-edge', label: 'Bord gauche', zone: 'mid', x: -0.75, xn: -0.85, z: -0.05, radius: 0.25, weight: 1.3, cooldown: 25, activities: ['observe', 'examine'], lookAt: { x: -2.1, z: -0.4 } },
    { id: 'back-edge', label: 'Fond de la pièce', zone: 'back', x: -0.3, xn: -0.5, z: -1.2, radius: 0.3, weight: 1.4, cooldown: 30, activities: ['observe', 'examine'], lookAt: { x: -0.3, z: -1.8 } },
    { id: 'user-left', label: 'Près de l\'utilisateur (gauche)', zone: 'front', x: -0.35, xn: -0.6, z: 1.0, radius: 0.28, weight: 1.2, cooldown: 25, activities: ['observe', 'rest'] },
    { id: 'user-right', label: 'Près de l\'utilisateur (droite)', zone: 'front', x: 0.4, xn: 0.6, z: 0.95, radius: 0.28, weight: 1.2, cooldown: 25, activities: ['observe', 'rest'] },
  ],
};
