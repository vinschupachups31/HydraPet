/** Couche d'expression : micro-mouvements d'os qui n'appartiennent ni aux clips ni aux postures (oreilles qui frémissent).
 *  Appliquée APRÈS le mixeur, en rotation additive dans les axes du MONDE de l'animal (x gauche, y haut, z avant) : indépendante des repères d'os.
 *  Déterministe : les instants des frémissements viennent d'un générateur initialisé par la graine fournie. */
import * as THREE from 'three';
import { mulberry32 } from './rng';

export interface ExpressionConfig {
  /** Os des oreilles, [gauche, droite]. */
  ears: [string, string];
  /** Intervalle entre deux frémissements (s) et durée d'un frémissement (s). */
  twitchEvery: [number, number];
  twitchTime: number;
  /** Amplitude (degrés) : bascule vers l'arrière et vers l'extérieur. */
  twitchDeg: { back: number; out: number };
  /** Respiration pendant le sommeil : bascule du thorax (degrés, autour de l'axe latéral) à `hz` cycles par seconde. Aucune mise à l'échelle. */
  breath?: { bone: string; deg: number; hz: number };
}

const _qw = new THREE.Quaternion(), _qr = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _e = new THREE.Euler();
const D2R = Math.PI / 180;

export class ExpressionLayer {
  private ears: (THREE.Object3D | null)[];
  private rng: () => number;
  private next: number;
  private twitching = -1;       // 0 = gauche, 1 = droite
  private t = 0;
  /** Part de l'expression autorisée (0 = désactivée : pendant une toilette, la patte touche l'oreille). */
  weight = 1;
  /** Part de la respiration (0 = aucune ; 1 pendant le sommeil). */
  breathWeight = 0;
  private breathBone: THREE.Object3D | null = null;
  private breathT = 0;

  constructor(root: THREE.Object3D, private cfg: ExpressionConfig, seed = 7) {
    this.ears = cfg.ears.map((n) => root.getObjectByName(n) ?? null);
    this.breathBone = cfg.breath ? root.getObjectByName(cfg.breath.bone) ?? null : null;
    this.rng = mulberry32(seed);
    this.next = this.range(cfg.twitchEvery);
  }
  private range([a, b]: [number, number]) { return a + (b - a) * this.rng(); }

  /** Amplitude courante du frémissement (0..1) : montée rapide, retour amorti. */
  private envelope(u: number) { return u < 0.3 ? u / 0.3 : Math.max(0, 1 - (u - 0.3) / 0.7) ** 2; }

  update(dt: number) {
    this.breathT += dt;
    if (this.breathBone && this.breathBone.parent && this.cfg.breath && this.breathWeight > 1e-3) {
      const a = Math.sin(this.breathT * Math.PI * 2 * this.cfg.breath.hz) * this.cfg.breath.deg * this.breathWeight * D2R;
      _e.set(a, 0, 0, 'XYZ'); _qr.setFromEuler(_e);
      this.breathBone.parent.getWorldQuaternion(_qp);
      _qw.copy(_qp).invert().multiply(_qr).multiply(_qp);
      this.breathBone.quaternion.premultiply(_qw);
    }
    this.t += dt;
    if (this.twitching < 0) { if (this.t >= this.next) { this.twitching = this.rng() < 0.5 ? 0 : 1; this.t = 0; } }
    else if (this.t >= this.cfg.twitchTime) { this.twitching = -1; this.t = 0; this.next = this.range(this.cfg.twitchEvery); }
    if (this.twitching < 0 || this.weight <= 1e-3) return;
    const bone = this.ears[this.twitching]; if (!bone || !bone.parent) return;
    const a = this.envelope(this.t / this.cfg.twitchTime) * this.weight;
    const side = this.twitching === 0 ? 1 : -1;       // +x = gauche : l'oreille s'écarte vers son côté
    _e.set(-this.cfg.twitchDeg.back * a * D2R, 0, -side * this.cfg.twitchDeg.out * a * D2R, 'XYZ');
    _qr.setFromEuler(_e);
    bone.parent.getWorldQuaternion(_qp);
    // local' = P⁻¹ · R · P · local
    _qw.copy(_qp).invert().multiply(_qr).multiply(_qp);
    bone.quaternion.premultiply(_qw);
  }
}
