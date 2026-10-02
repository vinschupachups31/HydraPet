/** Activités posturales : assis, toilette, sommeil, étirement. Réglages par mode (démonstration / production) et spécification des états.
 *  Les durées sont tirées UNE fois, à l'entrée de chaque phase. Le mode « démonstration » rend les comportements faciles à voir en
 *  quelques minutes ; le mode « production » espace fortement les activités longues (le sommeil dure des minutes, pas des secondes). */
import { PostureState } from './postures';

export type ActivityMode = 'demo' | 'production';
export type PostureActivity = 'sit' | 'groom' | 'sleep' | 'stretch';

export interface ActivityTuning {
  /** Probabilité de choisir l'activité quand elle est éligible (évaluée après une observation, jamais à chaque image). */
  chance: number;
  /** Délai minimal (s) depuis la fin de la même activité. */
  cooldown: number;
  /** Nombre minimal de trajets effectués depuis la dernière activité posturale (mélange avec la marche). */
  minTrips: number;
  /** Durée de la phase de maintien (s) : assis, sommeil… */
  hold: [number, number];
  /** Sommeil : secondes de marche cumulées avant de pouvoir s'endormir, et délai depuis l'ouverture. */
  minWalked?: number;
  warmup?: number;
}

export interface ActivityConfig {
  mode: ActivityMode;
  tunings: Record<ActivityMode, Record<PostureActivity, ActivityTuning>>;
  /** Observation : durée de mise en place des appuis avant de regarder (s) ; durée d'attention par cible (s). */
  observeSettle: [number, number];
  observeHold: [number, number];
  /** Après le réveil : temps d'éveil allongé (s) et chance d'étirement. */
  awakeLying: [number, number];
  stretchAfterWake: number;
  /** Une caresse pendant le sommeil réveille avec cette probabilité (sinon : petite réaction). */
  wakeOnTouch: number;
  /** Toilette : seconde série après une courte observation. */
  groomRepeat: number;
  /** Espace libre nécessaire autour d'un lieu de sommeil (m) : corps couché + queue. */
  sleepClearance: number;
  /** Rayon libre nécessaire pour s'asseoir/faire sa toilette (m). */
  sitClearance: number;
}

export const DEFAULT_ACTIVITIES: ActivityConfig = {
  mode: 'demo',
  tunings: {
    demo: {
      sit: { chance: 0.22, cooldown: 25, minTrips: 1, hold: [6, 12] },
      groom: { chance: 0.3, cooldown: 30, minTrips: 2, hold: [0, 0] },
      sleep: { chance: 0.45, cooldown: 60, minTrips: 2, hold: [20, 60], minWalked: 12, warmup: 25 },
      stretch: { chance: 0.15, cooldown: 40, minTrips: 1, hold: [0, 0] },
    },
    production: {
      sit: { chance: 0.12, cooldown: 120, minTrips: 3, hold: [20, 90] },
      groom: { chance: 0.14, cooldown: 240, minTrips: 3, hold: [0, 0] },
      sleep: { chance: 0.1, cooldown: 1200, minTrips: 6, hold: [180, 720], minWalked: 240, warmup: 600 },
      stretch: { chance: 0.05, cooldown: 600, minTrips: 4, hold: [0, 0] },
    },
  },
  observeSettle: [0.4, 0.9],
  observeHold: [1.0, 2.2],
  awakeLying: [1.5, 3],
  stretchAfterWake: 0.75,
  wakeOnTouch: 0.35,
  groomRepeat: 0.4,
  sleepClearance: 0.36,
  sitClearance: 0.3,
};

/** Spécification des états de comportement (documentation vérifiée par les tests) : entrée, durée, interruption, pose de sortie, successeurs, cooldown, reprise. */
export interface StateSpec {
  /** Nom du projet (BehaviorState / PostureState) ↔ nom d'état demandé. */
  label: string;
  entry: string;
  sequence: string;
  duration: string;
  interrupt: 'immédiate' | 'point sûr' | 'après la transition' | 'jamais';
  exitPose: 'debout' | 'assis' | 'couché';
  next: string[];
  cooldown: string;
  resume: string;
}

export const STATE_SPECS: Record<string, StateSpec> = {
  observe: { label: 'Observing / StandingIdle', entry: 'après un trajet, une réaction ou une activité', sequence: 'freinage → appuis stables → regard vers 1–2 cibles → regard neutre', duration: '2–6 s (tirée une fois)', interrupt: 'immédiate', exitPose: 'debout', next: ['walk', 'rest', 'examine', 'sit', 'groom', 'sleep', 'stretch', 'approach', 'react'], cooldown: '–', resume: 'redémarre une observation' },
  walk: { label: 'Walking', entry: 'destination choisie (POI accessible)', sequence: 'clip Walk/Run, cadence = vitesse réelle / nominale', duration: 'jusqu\'à l\'arrivée ou le blocage', interrupt: 'immédiate', exitPose: 'debout', next: ['observe', 'approach', 'react'], cooldown: 'POI : cooldown propre', resume: 'nouvelle destination' },
  rest: { label: 'StandingIdle (pause longue)', entry: 'POI « repos », après une observation', sequence: 'Survey + regards espacés', duration: '8–20 s', interrupt: 'jamais', exitPose: 'debout', next: ['observe'], cooldown: '–', resume: 'termine la pause' },
  sit: { label: 'SittingDown → SittingIdle → StandingUp', entry: 'debout et immobile, cooldown écoulé, ≥ 1 trajet depuis la dernière activité', sequence: 'SittingDown, maintien (respiration), StandingUp', duration: 'maintien 6–12 s (démo) / 20–90 s (prod)', interrupt: 'après la transition', exitPose: 'debout', next: ['observe', 'react', 'approach'], cooldown: '12 s (démo) / 120 s (prod)', resume: 'se relève puis répond' },
  groom: { label: 'SittingDown → Grooming → StandingUp', entry: 'comme assis, avec cooldown propre', sequence: 'assis, patte au museau, séries de 2–4 gestes, essuyage, patte reposée', duration: '8–18 s par séquence, 1–2 répétitions', interrupt: 'point sûr', exitPose: 'debout', next: ['observe', 'react', 'approach'], cooldown: '25 s (démo) / 240 s (prod)', resume: 'finit le geste, repose la patte, se relève, répond' },
  sleep: { label: 'PreparingSleep → LyingDown → Sleeping → WakingUp → StandingUp', entry: 'lieu de repos accessible (corps + queue), marche cumulée suffisante, cooldown écoulé', sequence: 'trajet, observation, assis, couché, tête baissée, respiration, réveil, étirement', duration: 'sommeil 20–60 s (démo) / 3–12 min (prod)', interrupt: 'après la transition', exitPose: 'debout', next: ['stretch', 'observe', 'react', 'approach'], cooldown: '60 s (démo) / 20 min (prod)', resume: 'réveil complet (sans redémarrer si rappelé), se relève puis répond' },
  stretch: { label: 'Stretching', entry: 'debout et immobile (ou après réveil)', sequence: 'étirement avant (salut) puis retour debout', duration: '3,5 s', interrupt: 'après la transition', exitPose: 'debout', next: ['observe'], cooldown: '40 s (démo) / 600 s (prod)', resume: 'termine puis répond' },
};

export const POSTURE_STATE_LABELS: Record<PostureState, string> = {
  StandingIdle: 'debout', SittingDown: 's\'assoit', SittingIdle: 'assis', Grooming: 'toilette', PreparingSleep: 'se prépare à dormir', LyingDown: 'se couche', Lying: 'couché', Sleeping: 'dort', WakingUp: 'se réveille', Stretching: 's\'étire', StandingUp: 'se relève',
};
