/** BehaviorController : choisit l'activité et la destination. Il ne déplace rien : il donne des intentions
 *  à la locomotion (goTo / faceTowards / lookAt / stop) et lit son état (arrivé, bloqué).
 *  Les durées sont tirées UNE fois à l'entrée de chaque état ; aucun tirage aléatoire par image. */
import { BehaviorConfig, PointOfInterest, Zone } from '../config/behavior';
import { WalkArea, resolvePoi, zoneOf } from './layout';
import { PostureActivity } from '../config/activities';
import { LocomotionController } from './locomotor';
import { PostureController } from './posture';
import type { EnvelopeKey } from './frameGuard';
import { Rng } from './rng';

export type BehaviorState = 'observe' | 'choose' | 'walk' | 'examine' | 'rest' | 'approach' | 'react' | PostureActivity;
export type PostureActivityPhase = 'turn' | 'enter' | 'hold' | 'groom' | 'pause' | 'wake' | 'awake' | 'rise' | 'stretch' | 'exit';
type Pending = null | 'call' | 'touch' | { force: PostureActivity | 'observe' };

export interface BehaviorEvent { t: number; state: BehaviorState; poi: string | null; detail: string }

export interface BehaviorDeps {
  loco: LocomotionController;
  area: WalkArea;
  cfg: BehaviorConfig;
  rng: Rng;
  /** Postures procédurales (assis, couché, sommeil, étirement, toilette) : seul interlocuteur du comportement pour le corps. */
  posture: PostureController;
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
  /** Phase de l'activité posturale en cours (assis, toilette, sommeil, étirement). */
  phase: PostureActivityPhase | null = null;
  phaseTime = 0;
  /** Intention en attente (appel, caresse, ordre de test) : exécutée au prochain point sûr, jamais en superposant une transition. */
  pending: Pending = null;

  private planned: PostureActivity | null = null;
  private lastReturnTry = -1e9;
  private lastEnd: Partial<Record<PostureActivity, number>> = {};
  private lastActivity: PostureActivity | null = null;
  private tripsSincePosture = 0;
  private walkedSeconds = 0;
  private groomRounds = 0;
  private completedMark = 0;
  private obs: { targets: { x: number; z: number; pitch: number }[]; settle: number; holds: number[]; idx: number; nextAt: number; done: boolean } = { targets: [], settle: 0, holds: [], idx: 0, nextAt: 0, done: true };

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
    const { loco, cfg, rng } = this.d;
    loco.stop();
    loco.clearLook();
    loco.s.gazePitch = 0;
    this.phase = null;
    this.setState('observe', this.range(range));
    this.nextGlanceAt = this.range([0.6, 1.6]);
    // séquence d'attention : mise en place des appuis, puis une ou deux cibles tirées UNE fois, puis regard neutre
    const n = rng() < 0.5 ? 1 : 2;
    const cands: { x: number; z: number; pitch: number }[] = [];
    const cam = this.d.cameraXZ();
    cands.push({ x: cam.x, z: cam.z, pitch: -0.2 });                                       // la caméra : la tête se relève un peu
    for (const p of cfg.pois) if (p.lookAt) cands.push({ x: p.lookAt.x, z: p.lookAt.z, pitch: 0 }); // meuble, bord de la pièce
    cands.push({ x: loco.s.x + (rng() * 2 - 1) * 1.2, z: loco.s.z + 0.8 + rng() * 0.5, pitch: 0.12 }); // un point du sol devant lui
    const targets: { x: number; z: number; pitch: number }[] = [];
    for (let i = 0; i < n && cands.length; i++) targets.push(cands.splice(Math.floor(rng() * cands.length), 1)[0]);
    const a = cfg.activities;
    this.obs = { targets, settle: this.range(a.observeSettle), holds: targets.map(() => this.range(a.observeHold)), idx: 0, nextAt: 0, done: false };
    this.obs.nextAt = this.obs.settle;
    this.log('observe');
  }

  /** Regard vers un point, limité par la portée du cou (le corps ne tourne pas pour un simple regard). */
  private lookClamped(x: number, z: number, pitch: number) {
    const L = this.d.loco, s = L.s;
    const want = Math.atan2(x - s.x, z - s.z);
    let off = ((want - s.heading + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    const lim = this.gazeLimit * 0.85;
    off = Math.max(-lim, Math.min(lim, off));
    s.gazeYaw = s.heading + off;
    s.gazePitch = pitch;
  }

  private stepObserveAttention() {
    const o = this.obs;
    if (o.done) return;
    if (o.idx < o.targets.length) {
      if (this.stateTime >= o.nextAt) { const t = o.targets[o.idx]; this.lookClamped(t.x, t.z, t.pitch); o.nextAt = this.stateTime + o.holds[o.idx]; o.idx++; }
    } else if (this.stateTime >= o.nextAt) { this.d.loco.clearLook(); this.d.loco.s.gazePitch = 0; o.done = true; } // regarde ailleurs / reprend
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
    const g = this.d.area.guard;
    if (off > this.gazeLimit && (!g || g.fitsPose(L.s.x, L.s.z, yaw, 'stand'))) L.faceYaw(yaw); // hors des limites du cou : le corps se tourne d'abord, progressivement (seulement si, tourné, il reste dans le cadre)
    else { this.lookClamped(target.x, target.z, 0); this.examineFaced = true; }
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
    this.planned = null;
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
    this.planned = null;
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
  touch() { this.interrupt('touch'); }

  private get inPostureActivity() { return this.state === 'sit' || this.state === 'groom' || this.state === 'sleep' || this.state === 'stretch'; }

  /** Politique d'interruption : immédiate hors activité posturale ; sinon l'intention est mise en attente jusqu'à un point sûr
   *  (fin de la transition, fin du geste de toilette, patte reposée, debout). Un appel répété ne redémarre rien. */
  private interrupt(kind: 'call' | 'touch') {
    this.lastInteraction = this.time;
    if (!this.inPostureActivity) { if (kind === 'touch') this.enterReact(); else this.enterApproach(true); return; }
    const P = this.d.posture;
    if (kind === 'touch' && this.state === 'sleep' && this.phase === 'hold') {
      if (this.d.rng() >= this.d.cfg.activities.wakeOnTouch) { P.nudge(); this.log('caresse : petite réaction, il reste endormi'); return; }
    }
    if (this.pending !== 'call') this.pending = kind;       // l'appel l'emporte sur la caresse ; deux appels = une seule intention
    this.log(`intention en attente : ${kind}`);
    this.leavePostureActivity();
  }

  /** Demande la sortie propre de l'activité en cours (sans casser une transition ni une toilette en plein geste). */
  private leavePostureActivity() {
    const P = this.d.posture;
    if (this.state === 'stretch') return;                   // 3,5 s : on la laisse finir
    if (this.state === 'groom') P.abortGroom();
    if (this.phase === 'exit' || this.phase === 'rise') return;
    this.phase = this.state === 'sleep' ? 'rise' : 'exit';
    this.phaseTime = 0;
    P.request('stand');
  }

  /** Appel : vient au premier plan (après s'être relevé s'il était assis, en toilette ou endormi). */
  call() { this.interrupt('call'); }

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
        if (area.guard && !(area.guard.fitsDestination(x, z, Math.atan2(x - s.x, z - s.z)) && area.guard.pathFits(s.x, s.z, x, z))) continue; // compagnon entier dans le cadre, destination ET chemin
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
    // un trajet vers un lieu de repos vient de se terminer : on s'installe
    if (this.planned) { const k = this.planned; this.planned = null; if (this.beginActivity(k)) return; }
    const act = this.pickPostureActivity();
    if (act && this.beginActivity(act)) return;
    const r = rng();
    // on ne se repose que là où le point d'intérêt le prévoit (ou sans point d'intérêt)
    const canRest = !this.poi || this.poi.activities.includes('rest');
    if (r < cfg.longPauseChance && canRest) return this.enterRest();
    if (r >= cfg.longPauseChance && r < cfg.longPauseChance + cfg.examineChance && this.poi && this.poi.activities.includes('examine') && this.poi.lookAt) return this.enterExamine();
    if (!this.startTrip()) this.enterRest(); // rien d'accessible : il se repose plutôt que de s'agiter
  }

  // ------------------------------------------------------------------ activités posturales
  private tuning(k: PostureActivity) { const a = this.d.cfg.activities; return a.tunings[a.mode][k]; }

  /** Les activités posturales sont évaluées après une observation, avec cooldown, mélange avec la marche et chances propres. */
  private pickPostureActivity(): PostureActivity | null {
    if (!this.autonomy || this.time - this.lastInteraction < 6) return null;
    const order: PostureActivity[] = ['sleep', 'groom', 'sit', 'stretch'];
    for (const k of order) {
      const t = this.tuning(k);
      if (k === this.lastActivity) continue;                                   // jamais deux fois la même activité d'affilée
      if (this.time - (this.lastEnd[k] ?? -1e9) < t.cooldown) continue;
      if (this.tripsSincePosture < t.minTrips) continue;
      if (k === 'sleep' && (this.time < (t.warmup ?? 0) || this.walkedSeconds < (t.minWalked ?? 0))) continue;
      if (this.d.rng() >= t.chance) continue;
      const room = this.roomFor(k);
      if (!this.hasRoom(room.r, room.key)) {                                   // pas la place ici (meuble, bord du cadre) : il rejoint d'abord une zone adaptée
        if (k !== 'stretch' && this.startSpotTrip(k)) return null;
        continue;
      }
      return k;
    }
    return null;
  }

  /** Place pour la pose COMPLÈTE (corps, tête, queue) ici : sans meuble à moins de `r`, et entièrement dans la zone sûre quel que soit le cap. */
  private hasRoom(r: number, key: EnvelopeKey) { return this.restHeading(r, key) !== null; }

  /** Cap à prendre (rad) pour la pose complète à cet endroit : le cap actuel s'il convient, sinon le plus proche qui tient dans le cadre ; null = pas de place. */
  private restHeading(r: number, key: EnvelopeKey, prefer = this.d.loco.s.heading, x = this.d.loco.s.x, z = this.d.loco.s.z): number | null {
    const g = this.d.area.guard;
    if (!this.d.area.isFree(x, z, r, false)) return null;
    return g ? g.bestHeading(x, z, key, prefer) : prefer;
  }

  private roomFor(k: PostureActivity): { r: number; key: EnvelopeKey } {
    const a = this.d.cfg.activities;
    return k === 'sleep' ? { r: a.sleepClearance, key: 'sleep' } : k === 'stretch' ? { r: a.sitClearance, key: 'stretch' } : { r: a.sitClearance, key: k === 'groom' ? 'groom' : 'sit' };
  }

  /** Lieu adapté à l'activité : point d'intérêt compatible avec assez d'espace pour la pose COMPLÈTE (meubles, bords du cadre, tête, queue),
   *  chemin libre ET dans le cadre. Le compagnon le rejoint en marchant, puis s'installe (jamais de téléportation). */
  private startSpotTrip(kind: PostureActivity): boolean {
    const { cfg, area, rng, loco } = this.d;
    const { r, key } = this.roomFor(kind), s = loco.s, g = area.guard;
    const spots: { poi: PointOfInterest; x: number; z: number; w: number }[] = [];
    for (const poi of cfg.pois) {
      const okAct = kind === 'stretch' || poi.activities.includes(kind);
      if (!okAct || (this.cooldownUntil.get(poi.id) ?? 0) > this.time) continue;
      const c = resolvePoi(poi, area.view, cfg.viewEdgeMargin);
      if (!area.isFree(c.x, c.z, r, true, cfg.viewEdgeMargin * 0.5)) continue;
      if (g && g.bestHeading(c.x, c.z, key, loco.s.heading) === null) continue;
      if (Math.hypot(c.x - s.x, c.z - s.z) < cfg.minTripDistance) continue;
      if (!area.segmentFree(s.x, s.z, c.x, c.z, cfg.bodyRadius * 1.2)) continue;
      if (g && !g.pathFits(s.x, s.z, c.x, c.z)) continue;
      spots.push({ poi, x: c.x, z: c.z, w: poi.weight });
    }
    if (!spots.length) return false;
    const lastId = this.recent[this.recent.length - 1], others = spots.filter((p) => p.poi.id !== lastId);
    if (others.length) spots.splice(0, spots.length, ...others); // pas deux fois de suite la même destination
    let tot = 0; for (const p of spots) tot += p.w;
    let rr = rng() * tot, pick = spots[spots.length - 1];
    for (const p of spots) { rr -= p.w; if (rr <= 0) { pick = p; break; } }
    this.planned = kind;
    this.cooldownUntil.set(pick.poi.id, this.time + pick.poi.cooldown);
    this.recent.push(pick.poi.id); if (this.recent.length > 3) this.recent.shift();
    this.enterWalk({ x: pick.x, z: pick.z }, pick.poi, 'walk');
    this.log(`trajet vers un lieu adapté (${kind}) : ${pick.poi.id}`);
    return true;
  }

  /** Hors de la zone sûre (ou pose impossible ici) : retour par un déplacement normal vers le point valide le plus proche. */
  private returnToFrame(): boolean {
    const { cfg, area, loco } = this.d, g = area.guard, s = loco.s;
    if (!g) return false;
    let best: { x: number; z: number; d: number } | null = null;
    const consider = (x: number, z: number) => {
      const d = Math.hypot(x - s.x, z - s.z);
      if (d < 0.15 || (best && d >= best.d)) return;
      if (!area.isFree(x, z, cfg.bodyRadius, false) || !g.fitsDestination(x, z, Math.atan2(x - s.x, z - s.z))) return;
      if (!area.segmentFree(s.x, s.z, x, z, cfg.bodyRadius * 1.2)) return;
      best = { x, z, d };
    };
    for (const poi of cfg.pois) { const c = resolvePoi(poi, area.view, cfg.viewEdgeMargin); consider(c.x, c.z); }
    for (let gx = -1.2; gx <= 1.2; gx += 0.15) for (let gz = -0.6; gz <= 1.5; gz += 0.15) consider(gx, gz); // grille : le point valide le plus proche
    if (!best) return false;
    const b = best as { x: number; z: number };
    this.planned = null;
    this.enterWalk(b, null, 'walk');
    this.log('retour dans la zone sûre du cadre');
    return true;
  }

  /** Entrée dans une activité posturale. Refusée (false) si le corps n'est pas immobile. */
  private beginActivity(kind: PostureActivity): boolean {
    const { loco, posture } = this.d;
    if (loco.realSpeed > 0.06 || !posture.settled) return false;
    loco.stop(); loco.clearLook(); loco.s.gazePitch = 0;
    this.pending = this.pending && typeof this.pending === 'object' ? null : this.pending;
    this.setState(kind, 0);
    this.phaseTime = 0;
    this.tripsInRow = 0;
    this.lastActivity = kind;
    this.groomRounds = 0;
    // cap d'installation : la pose complète doit tenir dans le cadre ; pour la toilette on préfère un trois-quarts face à la caméra (patte et museau lisibles)
    const room = this.roomFor(kind);
    const cam = this.d.cameraXZ(), toCam = Math.atan2(cam.x - loco.s.x, cam.z - loco.s.z);
    const prefer = kind === 'groom' ? toCam + 0.9 : loco.s.heading;
    const rh = this.restHeading(room.r, room.key, prefer);
    this.restTarget = rh;
    const off = rh === null ? 0 : Math.abs(((rh - loco.s.heading + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
    if (rh !== null && off > 0.2) { loco.faceYaw(rh); this.phase = 'turn'; }               // vrai virage progressif avant de s'installer
    else this.startPosture(kind);
    this.log(`activité : ${kind}`);
    return true;
  }

  private restTarget: number | null = null;
  private startPosture(kind: PostureActivity) {
    const { posture } = this.d;
    if (kind === 'sit' || kind === 'groom') { this.phase = 'enter'; posture.request('sit'); }
    else if (kind === 'sleep') { this.phase = 'enter'; posture.request('sleep'); }
    else { this.phase = 'stretch'; posture.stretch(); this.completedMark = posture.completed; }
  }

  private setPhase(ph: PostureActivityPhase, duration = 0) { this.phase = ph; this.phaseTime = 0; if (duration > 0) { this.stateTime = 0; this.stateDuration = duration; } }

  private finishActivity() {
    const k = this.state as PostureActivity;
    this.lastEnd[k] = this.time;
    this.tripsSincePosture = 0;
    if (k === 'sleep') this.walkedSeconds = 0;
    this.phase = null;
    this.d.loco.clearLook(); this.d.loco.s.gazePitch = 0;
    const p = this.pending; this.pending = null;
    if (p === 'call') return this.enterApproach(true);
    if (p === 'touch') return this.enterReact();
    if (p && typeof p === 'object') { if (p.force === 'observe') return this.enterObserve([2, 6], false); this.lastEnd[p.force] = -1e9; if (this.beginActivity(p.force)) return; }
    this.enterObserve([1.5, 3], false);
  }

  private updatePostureActivity(d: number) {
    const { posture: P, cfg, rng } = this.d;
    const a = cfg.activities;
    this.phaseTime += d;
    const settled = (pose: 'stand' | 'sit' | 'lie' | 'sleep') => P.posture === pose && !P.busy && P.goal === pose;
    if (this.phase === 'turn') {                                                    // orientation stabilisée avant de s'asseoir/se coucher
      if (this.d.loco.status === 'faced' || this.phaseTime > 6) { this.d.loco.stop(); if (this.d.loco.realSpeed < 0.05 || this.phaseTime > 6) this.startPosture(this.state as PostureActivity); }
      return;
    }
    switch (this.state) {
      case 'sit':
        if (this.phase === 'enter' && settled('sit')) this.setPhase('hold', this.range(this.tuning('sit').hold));
        else if (this.phase === 'hold') { this.glance([2, 4.5]); if (this.stateTime >= this.stateDuration) { this.d.loco.clearLook(); this.setPhase('exit'); P.request('stand'); } }
        else if (this.phase === 'exit' && settled('stand')) this.finishActivity();
        break;
      case 'groom':
        if (this.phase === 'enter' && settled('sit')) { this.completedMark = P.completed; this.groomRounds++; this.setPhase('groom'); P.groom(); }
        else if (this.phase === 'groom' && !P.busy && P.completed > this.completedMark) this.setPhase('pause', this.range(a.observeHold));     // patte reposée : il observe brièvement
        else if (this.phase === 'pause') {
          this.glance([1.5, 3]);
          if (this.stateTime >= this.stateDuration) {
            this.d.loco.clearLook();
            if (this.groomRounds < 2 && rng() < a.groomRepeat) { this.completedMark = P.completed; this.groomRounds++; this.setPhase('groom'); P.groom(); }
            else { this.setPhase('exit'); P.request('stand'); }
          }
        } else if (this.phase === 'exit' && settled('stand')) this.finishActivity();
        break;
      case 'sleep':
        if (this.phase === 'enter' && settled('sleep')) this.setPhase('hold', this.range(this.tuning('sleep').hold)); // durée de sommeil tirée une seule fois
        else if (this.phase === 'hold' && this.stateTime >= this.stateDuration) { this.setPhase('wake'); P.request('lie'); }
        else if (this.phase === 'wake' && settled('lie')) this.setPhase('awake', this.range(a.awakeLying));
        else if (this.phase === 'awake' && this.stateTime >= this.stateDuration) { this.setPhase('rise'); P.request('stand'); }
        else if (this.phase === 'rise' && settled('stand')) {
          if (!this.pending && rng() < a.stretchAfterWake && P.stretch()) { this.completedMark = P.completed; this.setPhase('stretch'); }
          else this.finishActivity();
        } else if (this.phase === 'stretch' && !P.busy && P.completed > this.completedMark) this.finishActivity();
        break;
      case 'stretch':
        if (this.phase === 'stretch' && !P.busy && P.completed > this.completedMark) this.finishActivity();
        else if (this.phase === 'stretch' && !P.busy && !P.settled && P.completed === this.completedMark && this.phaseTime > 0.5) this.finishActivity(); // étirement refusé : on passe
        break;
      default: break;
    }
  }

  /** Diagnostic : suspend toute décision (le scénario commande la locomotion directement). L'état reste « observe » sans fin. */
  forceDiagnostic() {
    this.pending = null; this.planned = null;
    if (this.inPostureActivity) { this.pending = { force: 'observe' }; this.leavePostureActivity(); return; }
    this.enterObserve([1e6, 1e6], false);
    this.obs.done = true;
  }

  /** Commande de test : lance l'activité par les MÊMES transitions que l'autonomie (jamais de saut direct à la pose finale). */
  force(kind: PostureActivity | 'observe') {
    this.lastInteraction = this.time;
    if (this.inPostureActivity) { this.pending = { force: kind }; this.log(`intention en attente : ${kind}`); this.leavePostureActivity(); return; }
    if (kind === 'observe') { this.enterObserve([2, 6], false); return; }
    if (this.state === 'walk' || this.state === 'approach') { this.d.loco.stop(); }
    this.planned = null;
    const room = this.roomFor(kind as PostureActivity);
    if (!this.hasRoom(room.r, room.key)) { if (this.startSpotTrip(kind)) return; this.log(`${kind} : aucune zone adaptée accessible`); return; }
    if (!this.beginActivity(kind)) { this.pending = { force: kind }; this.enterObserve([0.8, 1.2], false); this.log(`${kind} : en attente de l'arrêt complet`); }
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
    if (this.d.posture.busy || this.pending) return false;
    if (this.state === 'observe' || this.state === 'examine') return this.stateTime >= a.minObserve; // une observation dure au moins `minObserve`
    if (this.state === 'walk') return Math.hypot(L.s.x - this.tripStart.x, L.s.z - this.tripStart.z) >= a.minWalked && L.distance > a.minRemaining;
    return false; // une pause longue va à son terme : l'occasion est saisie ensuite
  }

  update(dt: number) {
    const d = Math.min(Math.max(dt, 0), 0.1);
    this.time += d;
    this.stateTime += d;
    const { cfg, loco } = this.d;
    if (loco.realSpeed > 0.1) this.walkedSeconds += d;

    // opportunités à fréquence réduite (jamais à chaque image)
    this.decisionAcc += d;
    if (this.decisionAcc >= 1 / cfg.decisionHz) {
      this.decisionAcc = 0;
      if ((this.state === 'observe' || this.state === 'rest') && this.autonomy && !this.d.posture.busy && this.d.posture.posture === 'stand' && loco.realSpeed < 0.05 && this.stateTime > 0.8 && this.d.area.guard && this.time - this.lastReturnTry > 3 && !this.d.area.guard.fitsPose(loco.s.x, loco.s.z, loco.s.heading, 'stand', 0.015)) {
        this.lastReturnTry = this.time;
        if (this.returnToFrame()) return;
      }
      if (this.time >= this.nextApproachAt && this.approachAllowed()) {
        if (this.d.rng() < cfg.approach.chance) this.enterApproach(false);
        else this.nextApproachAt = this.time + this.range(cfg.approach.every);
      }
    }

    switch (this.state) {
      case 'observe':
        this.stepObserveAttention();
        if (this.stateTime >= this.stateDuration) {
          const pf = this.pending;
          if (pf && typeof pf === 'object') { this.pending = null; this.force(pf.force); break; } // ordre de test en attente de l'arrêt complet
          if (!this.autonomy && !this.planned) { this.stateTime = 0; break; }
          this.decideAfterObserve();
        }
        break;
      case 'sit': case 'groom': case 'sleep': case 'stretch':
        this.updatePostureActivity(d);
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
          this.tripsInRow++; this.tripsSincePosture++;
          // après un trajet : observation de 2 à 6 s (sauf, parfois, un second trajet enchaîné ; jamais trois d'affilée)
          if (!this.planned && this.tripsInRow < cfg.maxTripsInRow && this.d.rng() > cfg.observeChance && this.autonomy && this.poi) {
            if (!this.startTrip()) this.enterObserve(cfg.observeAfterTrip, true);
          } else this.enterObserve(cfg.observeAfterTrip, true);
        } else if (loco.status === 'blocked') {
          this.planned = null;
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
