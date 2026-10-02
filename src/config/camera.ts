/** Cadrage de la caméra fixe. Calculé une fois par ratio d'écran, jamais pendant l'usage. */
export interface FramingConfig {
  /** Hauteur de l'animal utilisée pour le cadrage (m, oreilles comprises). Le modèle n'est jamais agrandi. */
  petHeight: number;
  /** Hauteur apparente visée au point d'approche, en part de la hauteur visible de la scène (25 à 35 %). */
  approachRatio: number;
  /** Hauteur de la caméra (m) : basse = vue à hauteur d'animal, l'animal n'est pas raccourci par un angle plongeant. */
  cameraY: number;
  /** Position verticale des pieds au point d'approche, en part de l'écran depuis le haut (laisse le bas aux commandes). */
  approachFeetY: number;
  /** Champ vertical : plus serré en paysage (focale plus longue, caméra plus loin, perspective plus plate). */
  fovPortrait: number;
  fovLandscape: number;
  /** Ratios entre lesquels le champ passe de portrait à paysage. */
  blendAspect: [number, number];
  near: number;
  far: number;
  /** Gros plan de développement (désactivé en usage normal) : caméra latérale basse pour contrôler les appuis. */
  devClose: { position: [number, number, number]; target: [number, number, number]; fov: number };
}

export const DEFAULT_FRAMING: FramingConfig = {
  petHeight: 0.36,
  approachRatio: 0.28,
  cameraY: 0.85,
  approachFeetY: 0.68,
  fovPortrait: 43.6, // ≈ 45 mm sur le petit côté d'un capteur 24 × 36
  fovLandscape: 32,
  blendAspect: [0.75, 1.4],
  near: 0.1,
  far: 30,
  devClose: { position: [0, 0.3, 2.1], target: [0, 0.2, 0.25], fov: 26 },
};

/** Zone sûre à l'écran (coordonnées normalisées, origine en haut à gauche) : le compagnon entier doit y tenir, dans la pose attendue. */
export interface SafeZoneConfig {
  /** Marge latérale (6–10 %), plus faible en paysage où l'écran est large. */
  sidePortrait: number;
  sideLandscape: number;
  /** Marge haute. */
  top: number;
  /** Bas utile (commandes en dessous) : portrait / paysage. */
  bottomPortrait: number;
  bottomLandscape: number;
  /** Rectangles couverts par l'interface (x0, y0, x1, y1) : le compagnon ne doit pas y passer. */
  uiRects: { x0: number; y0: number; x1: number; y1: number }[];
  /** Rotations testées pour une destination (la pose finale peut être orientée autrement que le trajet) : décalages de cap en rad. */
  headingSpread: number[];
  /** Tolérance (part de l'écran) pour les caps balayés pendant un pivot : le corps de côté peut entrer dans la marge, pas sortir de l'écran. */
  turnGrow: number;
}
export const DEFAULT_SAFE_ZONE: SafeZoneConfig = {
  sidePortrait: 0.06,
  sideLandscape: 0.06,
  top: 0.06,
  bottomPortrait: 0.8,
  bottomLandscape: 0.66,
  uiRects: [{ x0: 0.72, y0: 0, x1: 1, y1: 0.13 }], // bouton « Menu » du prototype
  headingSpread: [0, Math.PI / 2, -Math.PI / 2],
  turnGrow: 0.045,
};
