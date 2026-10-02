/** BehaviorController : choisit l'activité et la destination. Il ne déplace rien : il donne des intentions
 *  à la locomotion (goTo / faceTowards / lookAt / stop) et lit son état (arrivé, bloqué).
 *  Les durées sont tirées UNE fois à l'entrée de chaque état ; aucun tirage aléatoire par image. */
import { BehaviorConfig, PointOfInterest, Zone } from '../config/behavior';
import { WalkArea, resolvePoi, zoneOf } from './layout';
import { LocomotionController } from './locomotor';
import { Rng } from './rng';

export type BehaviorState = 'observe' | 'choose' | 'walk' | 'examine' | 'rest' | 'approach' | 'react';

export interface BehaviorEvent { t: number; state: BehaviorState; poi: string | null; detail: string }

export interface BehaviorDeps {
  loco: LocomotionController;
  area: WalkArea;
  cfg: BehaviorConfig;
  rng: Rng;
  /** Point d'approche devant la caméra (plan du sol). */
  approachPoint: () => { x: number; z: number };
  /** Position de la caméra (plan du sol), pour se tourner vers elle. */
  cameraXZ: () => { x: number; z: number };
  /** Limite anatomique de rotation tête+cou+épaules (rad) : au-delà, le corps se tourne. */
  gazeLimit?: number;
}

const FULL_LOOK = 52 * Math.PI / 180;

export class BehaviorController {
  state: BehaviorState = 'observe';
  stateTime = 0;
  /** Durée tirée à l'entrée de l'état (s) ; 0 = pas de durée (condition de fin). */
  stateDuration = 0;
  time = 0;
  autonomy = true;
  poi: PointOfInterest | null = null;
  destination: { x: number; z: number } | null = null;
  tripsInRow = 0;
  approachPhase: 'go' | 'stay' | null = null;
  nextApproachAt: number;
  lastInteraction = -1e9;
  events: BehaviorEvent[] = [];
  forcedGait: 'walk' | 'run' | null = null;

  private tripStart = { x: 0, z: 0 };
  private recent: string[] = [];
  private cooldownUntil = new Map<string, number>();
  private decisionAcc = 0;
  private nextGlanceAt = 0;
  private examineFaced = false;
  private afterObserve: 'decide' | 'choose' = 'decide';
  private readonly gazeLimit: number;

  constructor(private d: BehaviorDeps) {
    this.gazeLimit = d.gazeLimit ?? FULL_LOOK;
    this.nextApproachAt = this.range(d.cfg.approach.firstDelay);
    this.enterObserve([1, 2.5], false);
  }

  /** Tirage dans un intervalle [a, b] (une seule fois par appel : à l'entrée d'un état). */
  private range([a, b]: [number, number]) { return a + this.d.rng() * (b - a); }

  private log(detail: string) {
    this.events.push({ t: this.time, state: this.state, poi: this.poi?.id ?? null, detail });
    if (this.events.length > 600) this.events.shift();
  }

  get remaining() { return this.stateDuration > 0 ? Math.max(0, this.stateDuration - this.stateTime) : 0; }
  get zone(): Zone { return zoneOf(this.d.loco.s.z); }

  // ------------------------------------------------------------------ entrées d'état
  private setState(s: BehaviorState, duration = 0) {
    this.state = s;
    this.stateTime = 0;
    this.stateDuration = duration;
  }

  private enterObserve(range: [number, number], _afterTrip: boolean) {
    this.d.loco.stop();
    this.d.loco.clearLook();
    this.setState('observe', this.range(range));
    this.nextGlanceAt = this.range([0.6, 1.6]);
    this.log('observe');
  }

  private enterRest() {
    this.d.loco.stop();
    this.d.loco.clearLook();
    this.tripsInRow = 0;
    this.setState('rest', this.range(this.d.cfg.longPause));
    this.nextGlanceAt = this.range([2, 4]);
    this.log('rest');
  }

  private enterExamine() {
    const poi = this.poi;
    const target = poi?.lookAt ?? this.fallbackLook();
    this.tripsInRow = 0;
    this.setState('examine', this.range(this.d.cfg.examine));
    this.examineFaced = false;
    const L = this.d.loco;
    L.clearLook();
    const yaw = Math.atan2(target.x - L.s.x, target.z - L.s.z);
    const off = Math.abs(((yaw - L.s.heading + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
    if (off > this.gazeLimit) L.faceYaw(yaw); // hors des limites du cou : le corps se tourne d'abord, progressivement
    else { L.lookAt(target.x, target.z); this.examineFaced = true; }
    this.lookTarget = target;
    this.log('examine');
  }
  private lookTarget: { x: number; z: number } | null = null;
  private fallbackLook() { const c = this.d.cameraXZ(); return { x: c.x, z: c.z }; }

  private enterWalk(dest: { x: number; z: number }, poi: PointOfInterest | null, gait: 'walk' | 'run') {
    this.destination = dest;
    this.poi = poi;
    this.tripStart = { x: this.d.loco.s.x, z: this.d.loco.s.z };
    this.setState('walk', 0);
    this.d.loco.clearLook();
    this.d.loco.goTo(dest.x, dest.z, this.forcedGait ?? gait);
    this.log(`walk→${poi?.id ?? 'point'} (${gait})`);
  }

  private enterApproach(forced: boolean) {
    const a = this.d.approachPoint();
    this.poi = null;
    this.destination = a;
    this.approachPhase = 'go';
    this.setState('approach', 0);
    this.d.loco.clearLook();
    this.d.loco.goTo(a.x, a.z, 'walk');
    this.log(forced ? 'approche (appel)' : 'approche (spontanée)');
  }

  private enterReact() {
    this.lastInteraction = this.time;
    this.destination = null;
    this.poi = null;
    this.approachPhase = null;
    this.tripsInRow = 0;
    const c = this.d.cameraXZ();
    this.d.loco.stop();
    this.d.loco.faceTowards(c.x, c.z);
    this.d.loco.lookAt(c.x, c.z);
    this.setState('react', this.range(this.d.cfg.react.duration));
    this.log('réaction au toucher');
  }

  // ------------------------------------------------------------------ interactions (priorité)
  /** Toucher l'animal : interrompt proprement, sans téléportation (freinage progressif puis orientation vers la caméra). */
  touch() { this.enterReact(); }

  /** Appel : vient au premier plan. */
  call() { this.lastInteraction = this.time; this.enterApproach(true); }

  /** Commande de test : aller à un point précis par le chemin normal. */
  goTo(x: number, z: number, gait: 'walk' | 'run' = 'walk') { this.enterWalk({ x, z }, null, gait); }

  toggleForcedGait() { this.forcedGait = this.forcedGait === 'run' ? null : this.forcedGait === 'walk' ? 'run' : 'walk'; }

  // ------------------------------------------------------------------ sélection d'une destination
  private recentFactor(id: string): number {
    const f = this.d.cfg.recentPenalty;
    let k = 1;
    const n = this.recent.length;
    for (let i = 0; i < f.length; i++) if (this.recent[n - 1 - i] === id) k *= f[i];
    if (n >= 2 && this.recent[n - 2] === id) k *= this.d.cfg.pingPongPenalty; // A → B → A
    return k;
  }

  private pickDestination(): { poi: PointOfInterest; x: number; z: number } | null {
    const { cfg, area, loco, rng } = this.d;
    const s = loco.s;
    for (let attempt = 0; attempt < 3; attempt++) {
      const cands: { poi: PointOfInterest; x: number; z: number; w: number }[] = [];
      for (const poi of cfg.pois) {
        if ((this.cooldownUntil.get(poi.id) ?? 0) > this.time) continue;
        const c = resolvePoi(poi, area.view, cfg.viewEdgeMargin);
        const ang = rng() * Math.PI * 2, r = poi.radius * Math.sqrt(rng());
        const x = c.x + Math.cos(ang) * r, z = c.z + Math.sin(ang) * r;
        if (!area.isFree(x, z, cfg.bodyRadius, true, cfg.viewEdgeMargin)) continue;       // espace libre autour du corps, dans le champ
        if (Math.hypot(x - s.x, z - s.z) < cfg.minTripDistance) continue;                  // pas de trajet minuscule
        if (!area.segmentFree(s.x, s.z, x, z, cfg.bodyRadius * 1.2)) continue;             // pas de meuble sur le chemin (marge pour les arcs de virage)
        const w = poi.weight * cfg.zoneWeights[poi.zone] * this.recentFactor(poi.id);
        if (w > 0) cands.push({ poi, x, z, w });
      }
      if (cands.length) {
        const last = this.recent[this.recent.length - 1];
        const others = cands.filter((c) => c.poi.id !== last);
        if (others.length) cands.splice(0, cands.length, ...others); // jamais deux fois de suite la même destination
        let tot = 0; for (const c of cands) tot += c.w;
        let r = rng() * tot;
        for (const c of cands) { r -= c.w; if (r <= 0) return c; }
        return cands[cands.length - 1];
      }
    }
    return null;
  }

  private startTrip(): boolean {
    this.state = 'choose';
    this.log('choix d\'une destination');
    const pick = this.pickDestination();
    if (!pick) return false;
    const { cfg, loco, rng } = this.d;
    this.cooldownUntil.set(pick.poi.id, this.time + pick.poi.cooldown * (0.85 + 0.3 * rng()));
    this.recent.push(pick.poi.id);
    if (this.recent.length > 3) this.recent.shift();
    const dist = Math.hypot(pick.x - loco.s.x, pick.z - loco.s.z);
    const gait = dist > cfg.runMinDistance && rng() < cfg.runChance ? 'run' : 'walk';
    this.enterWalk({ x: pick.x, z: pick.z }, pick.poi, gait);
    return true;
  }

  // ------------------------------------------------------------------ boucle
  private decideAfterObserve() {
    const { cfg, rng } = this.d;
    this.tripsInRow = 0; // un arrêt réel vient d'avoir lieu
    const r = rng();
    // on ne se repose que là où le point d'intérêt le prévoit (ou sans point d'intérêt)
    const canRest = !this.poi || this.poi.activities.includes('rest');
    if (r < cfg.longPauseChance && canRest) return this.enterRest();
    if (r >= cfg.longPauseChance && r < cfg.longPauseChance + cfg.examineChance && this.poi && this.poi.activities.includes('examine') && this.poi.lookAt) return this.enterExamine();
    if (!this.startTrip()) this.enterRest(); // rien d'accessible : il se repose plutôt que de s'agiter
  }

  private glance(rangeNext: [number, number]) {
    const L = this.d.loco;
    if (this.stateTime >= this.nextGlanceAt) {
      // petit regard limité anatomiquement (± 40°), le corps ne bouge pas
      const yaw = L.s.heading + (this.d.rng() * 2 - 1) * 0.7;
      L.s.gazeYaw = this.d.rng() < 0.3 ? null : yaw;
      this.nextGlanceAt = this.stateTime + this.range(rangeNext);
    }
  }

  private approachAllowed() {
    const a = this.d.cfg.approach, L = this.d.loco;
    if (!this.autonomy || this.time - this.lastInteraction <= a.quietAfterInteraction) return false;
    if (this.state === 'observe' || this.state === 'examine') return this.stateTime >= a.minObserve; // une observation dure au moins `minObserve`
    if (this.state === 'walk') return Math.hypot(L.s.x - this.tripStart.x, L.s.z - this.tripStart.z) >= a.minWalked && L.distance > a.minRemaining;
    return false; // une pause longue va à son terme : l'occasion est saisie ensuite
  }

  update(dt: number) {
    const d = Math.min(Math.max(dt, 0), 0.1);
    this.time += d;
    this.stateTime += d;
    const { cfg, loco } = this.d;

    // opportunités à fréquence réduite (jamais à chaque image)
    this.decisionAcc += d;
    if (this.decisionAcc >= 1 / cfg.decisionHz) {
      this.decisionAcc = 0;
      if (this.time >= this.nextApproachAt && this.approachAllowed()) {
        if (this.d.rng() < cfg.approach.chance) this.enterApproach(false);
        else this.nextApproachAt = this.time + this.range(cfg.approach.every);
      }
    }

    switch (this.state) {
      case 'observe':
        this.glance([1.2, 2.6]);
        if (this.stateTime >= this.stateDuration) {
          if (!this.autonomy) { this.stateTime = 0; break; }
          this.decideAfterObserve();
        }
        break;
      case 'rest':
        this.glance([2.5, 5]);
        if (this.stateTime >= this.stateDuration) { if (this.autonomy) this.enterObserve([1, 2.5], false); else this.stateTime = 0; }
        break;
      case 'examine': {
        if (!this.examineFaced && loco.status === 'faced') { this.examineFaced = true; if (this.lookTarget) loco.lookAt(this.lookTarget.x, this.lookTarget.z); }
        if (this.stateTime >= this.stateDuration) { loco.clearLook(); this.enterObserve([1, 2.2], false); }
        break;
      }
      case 'walk': {
        if (loco.status === 'arrived') {
          this.tripsInRow++;
          // après un trajet : observation de 2 à 6 s (sauf, parfois, un second trajet enchaîné ; jamais trois d'affilée)
          if (this.tripsInRow < cfg.maxTripsInRow && this.d.rng() > cfg.observeChance && this.autonomy && this.poi) {
            if (!this.startTrip()) this.enterObserve(cfg.observeAfterTrip, true);
          } else this.enterObserve(cfg.observeAfterTrip, true);
        } else if (loco.status === 'blocked') {
          if (this.poi) this.cooldownUntil.set(this.poi.id, this.time + cfg.stall.poiCooldown); // destination inaccessible : on l'oublie un moment
          this.log('bloqué → destination abandonnée');
          this.poi = null;
          this.enterObserve([1, 2.2], false);
        }
        break;
      }
      case 'approach': {
        if (this.approachPhase === 'go') {
          if (loco.status === 'arrived') {
            const c = this.d.cameraXZ();
            this.approachPhase = 'stay';
            this.stateTime = 0;
            this.stateDuration = this.range(cfg.approach.stay); // tirée une seule fois à l'arrivée
            loco.faceTowards(c.x, c.z);
            loco.lookAt(c.x, c.z);
            this.log('arrivé au premier plan');
          } else if (loco.status === 'blocked') {
            this.log('approche impossible');
            this.nextApproachAt = this.time + 10;
            this.approachPhase = null;
            this.enterObserve([1, 2.2], false);
          }
        } else if (this.approachPhase === 'stay' && this.stateTime >= this.stateDuration) {
          loco.clearLook();
          this.approachPhase = null;
          this.nextApproachAt = this.time + this.range(cfg.approach.every);
          this.enterObserve([1.5, 3], false);
        }
        break;
      }
      case 'react':
        if (this.stateTime >= this.stateDuration) { loco.clearLook(); this.enterObserve(cfg.react.observeAfter, false); }
        break;
      default:
        break;
    }
  }
}
