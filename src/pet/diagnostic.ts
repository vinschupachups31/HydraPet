/** Diagnostic reproductible de la locomotion : scénarios scriptés qui remplacent temporairement les décisions autonomes.
 *  Logique pure : le moteur (application ou banc hors ligne) fournit seulement `goTo` et `isMoving`. */
export interface DiagStep {
  label: string;
  goTo?: [number, number];
  /** S'orienter (virage progressif, sans avancer) vers un point, puis attendre l'orientation. */
  face?: [number, number];
  gait?: 'walk' | 'run';
  /** Attente (s) ; après un `goTo`, compte à partir de l'arrivée. */
  wait?: number;
  /** Active/désactive la mesure à partir de cette étape. */
  measure?: boolean;
}
export interface DiagScenario { id: string; name: string; steps: DiagStep[] }

const P = (label: string, x: number, z: number, wait = 0): DiagStep => ({ label, goTo: [x, z], wait });
const F = (label: string, x: number, z: number, wait = 1): DiagStep => ({ label, face: [x, z], wait });
export const DIAG_SCENARIOS: DiagScenario[] = [
  { id: 'straight', name: 'Marche droite à vitesse constante', steps: [P('placement', -0.3, -0.6, 0.5), F('orientation', -0.3, 1.0), { label: 'mesure', measure: true }, P('marche droite 1,6 m', -0.3, 1.0, 1.2), { label: 'fin', measure: false }] },
  { id: 'brake', name: 'Accélération puis freinage jusqu\'à l\'arrêt', steps: [P('placement', -0.3, -0.6, 0.5), F('orientation', -0.3, 0.4), { label: 'mesure', measure: true }, P('1 m : accélère, freine', -0.3, 0.4, 2.5), { label: 'fin', measure: false }] },
  { id: 'curve', name: 'Courbe à 90°', steps: [P('placement', -0.55, -0.4, 0.5), F('orientation', -0.55, 0.4), { label: 'mesure', measure: true }, P('première branche', -0.55, 0.4), P('virage à 90°', 0.1, 0.4, 1.2), { label: 'fin', measure: false }] },
  { id: 'uturn', name: 'Demi-tour', steps: [P('placement', -0.3, -0.5, 0.5), F('orientation', -0.3, 0.8), { label: 'mesure', measure: true }, P('aller', -0.3, 0.8), P('demi-tour et retour', -0.3, -0.5, 1.2), { label: 'fin', measure: false }] },
  { id: 'restwalk', name: 'Marche → repos → marche', steps: [P('placement', -0.3, -0.4, 0.5), F('orientation', -0.3, 0.7), { label: 'mesure', measure: true }, P('marche', -0.3, 0.7, 2.2), P('repos puis marche', -0.3, -0.4, 2.2), { label: 'fin', measure: false }] },
];

export interface DiagCommands { goTo(x: number, z: number, gait: 'walk' | 'run'): void; isMoving(): boolean; face(x: number, z: number): void; isFacing(): boolean }

export class DiagRunner {
  scenario: DiagScenario | null = null;
  index = -1;
  measuring = false;
  done = false;
  step: DiagStep | null = null;
  private waiting = 0;
  private phase: 'go' | 'face' | 'wait' | 'idle' = 'idle';
  private started = false;
  private goTime = 0;

  constructor(private cmd: DiagCommands) {}

  get active() { return this.scenario !== null && !this.done; }
  get label() { return this.step?.label ?? '-'; }

  start(id: string) {
    this.scenario = DIAG_SCENARIOS.find((s) => s.id === id) ?? null;
    this.index = -1; this.measuring = false; this.done = !this.scenario; this.step = null; this.phase = 'idle'; this.started = false;
    this.advance();
  }

  stop() { this.scenario = null; this.done = true; this.measuring = false; this.step = null; }

  private advance() {
    const sc = this.scenario; if (!sc) return;
    this.index++;
    if (this.index >= sc.steps.length) { this.done = true; this.measuring = false; this.step = null; return; }
    const s = sc.steps[this.index]; this.step = s;
    if (s.measure !== undefined) this.measuring = s.measure;
    this.waiting = s.wait ?? 0;
    if (s.face) { this.cmd.face(s.face[0], s.face[1]); this.phase = 'face'; this.goTime = 0; } else if (s.goTo) { this.cmd.goTo(s.goTo[0], s.goTo[1], s.gait ?? 'walk'); this.phase = 'go'; this.started = false; this.goTime = 0; } else this.phase = 'wait';
  }

  update(dt: number) {
    if (!this.active) return;
    if (this.phase === 'go') {
      this.goTime += dt;
      if (this.cmd.isMoving()) this.started = true;
      if ((this.started || this.goTime > 1.5) && !this.cmd.isMoving()) this.phase = 'wait';
    } else if (this.phase === 'face') {
      this.goTime += dt;
      if (this.cmd.isFacing() || this.goTime > 8) this.phase = 'wait';
    } else if (this.phase === 'wait') {
      this.waiting -= dt;
      if (this.waiting <= 0) this.advance();
    }
  }
}
