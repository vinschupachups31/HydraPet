import { DEFAULT_LOCO, LocoParams, LocoState, stepLocomotion } from './locomotion';
import { Rng } from './rng';

export type BrainMode = 'pause' | 'wander' | 'walk' | 'react' | 'call' | 'look';

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Cerveau minimal du test : choisit où aller et à quelle allure ; le corps (locomotion) exécute. */
export class PetBrain {
  mode: BrainMode = 'pause';
  target: { x: number; z: number } | null = null;
  gait: 'walk' | 'run' = 'walk';
  forcedGait: 'walk' | 'run' | null = null;
  autonomy = true;
  /** Position de la caméra (x, z) : l'animal s'y tourne quand on le touche. */
  cameraXZ = { x: 0, z: 4 };
  /** Zone autorisée en plus des bornes (par exemple : ce que la caméra montre vraiment). */
  walkable: ((x: number, z: number) => boolean) | null = null;
  private timer = 1;

  constructor(
    public loco: LocoState,
    private bounds: Bounds,
    private rng: Rng,
    private params: LocoParams = DEFAULT_LOCO,
  ) {}

  private pickTarget() {
    for (let i = 0; i < 12; i++) {
      const x = this.bounds.minX + this.rng() * (this.bounds.maxX - this.bounds.minX);
      const z = this.bounds.minZ + this.rng() * (this.bounds.maxZ - this.bounds.minZ);
      if (Math.hypot(x - this.loco.x, z - this.loco.z) > 0.7 && (!this.walkable || this.walkable(x, z))) return { x, z };
    }
    return { x: 0, z: 0.1 };
  }

  /** Réaction au toucher : s'arrête, se tourne vers la caméra, observe. */
  touch() {
    this.mode = 'react';
    this.target = null;
    this.timer = 2.8;
  }

  /** Appel : vient se placer devant la caméra. */
  call() {
    this.mode = 'call';
    this.target = { x: 0, z: Math.min(this.bounds.maxZ - 0.15, 0.9) };
    this.gait = this.forcedGait ?? 'walk';
  }

  toggleForcedGait() {
    this.forcedGait = this.forcedGait === 'run' ? null : this.forcedGait === 'walk' ? 'run' : 'walk';
  }

  update(dt: number) {
    this.timer -= dt;
    const loc = this.loco;

    if (this.mode === 'react') {
      const faceCam = Math.atan2(this.cameraXZ.x - loc.x, this.cameraXZ.z - loc.z);
      stepLocomotion(loc, null, 'walk', dt, this.params, faceCam);
      if (this.timer <= 0) { this.mode = 'pause'; this.timer = 0.6; }
      return;
    }

    if (this.mode === 'call' || this.mode === 'walk' || this.mode === 'wander') {
      const gait = this.forcedGait ?? this.gait;
      const r = stepLocomotion(loc, this.target, gait, dt, this.params);
      if (r.arrived) {
        this.mode = this.mode === 'call' ? 'look' : 'pause';
        this.target = null;
        this.timer = this.mode === 'look' ? 2.5 : 1.5 + this.rng() * 3.5;
      }
      return;
    }

    // pause / look : à l'arrêt (la décélération se termine en douceur)
    stepLocomotion(loc, null, 'walk', dt, this.params);
    if (this.timer <= 0 && this.autonomy) {
      this.mode = 'wander';
      this.target = this.pickTarget();
      this.gait = this.rng() < 0.22 ? 'run' : 'walk';
    } else if (this.timer <= 0) {
      this.timer = 1;
    }
  }
}
