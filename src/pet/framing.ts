/** Cadrage de la caméra fixe : calculé une fois selon le ratio d'écran. Calculs purs (testables sans moteur 3D). */
import { DEFAULT_FRAMING, FramingConfig } from '../config/camera';
import { ViewLimits } from './layout';

export interface Projected { x: number; y: number; depth: number } // x, y en [0, 1], origine en haut à gauche
export interface Framing extends ViewLimits {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  aspect: number;
  near: number;
  far: number;
  /** Point d'approche devant la caméra (plan du sol). */
  approach: { x: number; z: number };
  project(x: number, y: number, z: number): Projected;
}

const DEG = Math.PI / 180;
const smooth = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

function make(camY: number, camZ: number, pitch: number, fov: number, aspect: number, cfg: FramingConfig, approachZ: number, camX = 0): Framing {
  const tanH = Math.tan((fov * DEG) / 2);
  const fz = -Math.cos(pitch), fy = -Math.sin(pitch); // avant (vers -z, incliné vers le bas)
  const uz = -Math.sin(pitch) * -1 * -1, uy = Math.cos(pitch); // haut de l'écran
  const upZ = -Math.sin(pitch) * 1; // composante z de « haut » : -sin(pitch) (la caméra penche vers le bas : le haut s'éloigne en z-)
  const project = (x: number, y: number, z: number): Projected => {
    const dx = x - camX, dy = y - camY, dz = z - camZ;
    const depth = dy * fy + dz * fz;
    const xc = dx;
    const yc = dy * uy + dz * upZ;
    return { x: (xc / (depth * tanH * aspect) + 1) / 2, y: (1 - yc / (depth * tanH)) / 2, depth };
  };
  const halfWidthAt = (z: number) => {
    const p = project(camX + 1, 0, z);
    const k = (p.x - 0.5) * 2; // coordonnée écran d'un point à 1 m de l'axe
    return k > 1e-6 ? 1 / k : 99;
  };
  // plus petite profondeur de sol dont les pieds restent au-dessus des commandes (pieds ≤ 82 % de la hauteur d'écran)
  let lo = approachZ - 3, hi = camZ - 0.3;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (project(camX, 0, m).y < 0.82) lo = m; else hi = m; }
  return {
    position: [camX, camY, camZ], target: [camX, camY + fy, camZ + fz], fov, aspect, near: cfg.near, far: cfg.far,
    approach: { x: 0, z: approachZ }, project, halfWidthAt, maxZ: lo,
  };
}

/** Cadrage de jeu : hauteur apparente de l'animal au point d'approche = `approachRatio` de la hauteur visible,
 *  pieds à `approachFeetY` de l'écran (le bas reste libre pour les commandes). Distance, inclinaison et champ sont réglés ensemble. */
export function computeFraming(aspect: number, approachZ = 1.5, cfg: FramingConfig = DEFAULT_FRAMING): Framing {
  const fov = cfg.fovPortrait + (cfg.fovLandscape - cfg.fovPortrait) * smooth(cfg.blendAspect[0], cfg.blendAspect[1], aspect);
  const solvePitch = (camZ: number): number => {
    let lo = -0.6, hi = 1.2; // pitch en rad (vers le bas > 0) ; les pieds montent à l'écran quand on penche vers le bas
    for (let i = 0; i < 50; i++) {
      const m = (lo + hi) / 2;
      const y = make(cfg.cameraY, camZ, m, fov, aspect, cfg, approachZ).project(0, 0, approachZ).y;
      if (y > cfg.approachFeetY) lo = m; else hi = m; // pieds trop bas : pencher davantage
    }
    return (lo + hi) / 2;
  };
  const ratioAt = (camZ: number): number => {
    const f = make(cfg.cameraY, camZ, solvePitch(camZ), fov, aspect, cfg, approachZ);
    return f.project(0, 0, approachZ).y - f.project(0, cfg.petHeight, approachZ).y;
  };
  let lo = approachZ + 0.5, hi = approachZ + 9; // le ratio décroît quand la caméra s'éloigne
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (ratioAt(m) > cfg.approachRatio) lo = m; else hi = m; }
  const camZ = (lo + hi) / 2;
  return make(cfg.cameraY, camZ, solvePitch(camZ), fov, aspect, cfg, approachZ);
}

/** Gros plan de développement (jamais utilisé en usage normal) : caméra basse latérale pour contrôler les appuis. */
export function devCloseFraming(aspect: number, cfg: FramingConfig = DEFAULT_FRAMING): Framing {
  const [px, py, pz] = cfg.devClose.position, [tx, ty, tz] = cfg.devClose.target;
  const pitch = Math.atan2(py - ty, pz - tz);
  return make(py, pz, pitch, cfg.devClose.fov, aspect, cfg, tz, px);
}
