/** Postures et séquences d'animation procédurales du renard (le modèle n'a que Survey, Walk et Run).
 *  Tout est composé d'ARTICULATIONS (rotations d'os relatives au parent, voir pet/rig.ts) : jamais de rotation ou d'échelle du modèle entier.
 *  Angles en degrés : tangage > 0 = ce qui pointe vers l'avant descend ; roulis > 0 = vers l'axe du corps pour une patte droite ; lacet > 0 = vers la gauche. */
import { BoneKey } from './foxRig';
import { Euler3, Pose } from '../pet/rig';

export type Posture = 'stand' | 'sit' | 'lie' | 'sleep';
/** Noms d'états de l'activité posturale (voir `STATE_SPECS`). */
export type PostureState = 'StandingIdle' | 'SittingDown' | 'SittingIdle' | 'Grooming' | 'PreparingSleep' | 'LyingDown' | 'Lying' | 'Sleeping' | 'WakingUp' | 'Stretching' | 'StandingUp';

const P = (r: Partial<Record<BoneKey, Euler3>>, hip?: [number, number, number]): Pose => ({ r, hip });
const both = (a: Euler3, left: BoneKey, right: BoneKey): Partial<Record<BoneKey, Euler3>> => ({ [left]: a, [right]: a });

export const POSES: Record<string, Pose> = {
  stand: P({}),
  /** Assis : bassin au sol, buste redressé, antérieurs verticaux, postérieurs repliés (cuisse en avant, métatarse à plat). */
  sit: P({
    hip: [-40, 0, 0], neck: [12, 0, 0], head: [25, 0, 0],
    ...both([40, 0, 0], 'armL', 'armR'), ...both([-20, 0, 0], 'legL1', 'legR1'), ...both([84, 0, 0], 'legL2', 'legR2'),
    ...both([-95, 0, 0], 'footL1', 'footR1'), ...both([76, 0, 0], 'footL2', 'footR2'), tail1: [78, 0, 0],
  }),
  /** Couché, éveillé (position du sphinx) : poitrine au sol, antérieurs repliés vers l'avant, postérieurs rentrés. */
  lie: P({
    neck: [-5, 0, 0], head: [10, 0, 0],
    ...both([48, 0, 0], 'armL', 'armR'), ...both([-136, 0, 0], 'foreL', 'foreR'), ...both([31, 0, 0], 'handL', 'handR'),
    ...both([-53, 0, 0], 'legL1', 'legR1'), ...both([87, 0, 0], 'legL2', 'legR2'), ...both([-105, 0, 0], 'footL1', 'footR1'), ...both([76, 0, 0], 'footL2', 'footR2'),
    tail1: [30, 0, 0], tail2: [10, 0, 0],
  }),
  /** Endormi : tête baissée tournée vers le flanc, queue enroulée. */
  sleep: P({
    neck: [32, 0, 38], head: [14, 0, 12],
    ...both([48, 0, 0], 'armL', 'armR'), ...both([-136, 0, 0], 'foreL', 'foreR'), ...both([31, 0, 0], 'handL', 'handR'),
    ...both([-53, 0, 0], 'legL1', 'legR1'), ...both([87, 0, 0], 'legL2', 'legR2'), ...both([-105, 0, 0], 'footL1', 'footR1'), ...both([76, 0, 0], 'footL2', 'footR2'),
    tail1: [30, 0, 65], tail2: [0, 0, 45], tail3: [0, 0, 35],
  }),
  /** Étirement avant (« salut ») : poitrine basse, antérieurs allongés, bassin haut. */
  stretch: P({
    hip: [28, 0, 0], neck: [-30, 0, 0], ...both([-100, 0, 0], 'armL', 'armR'), ...both([-5, 0, 0], 'foreL', 'foreR'), ...both([-28, 0, 0], 'legL1', 'legR1'),
  }),
  /** Toilette : patte avant droite relevée contre le museau, tête abaissée vers elle (réglée par optimisation dans le banc de pose). */
  groomUp: P({
    hip: [-40, 0, 0], neck: [12, 0, 0], head: [42.8, 0, -20.3],
    armL: [40, 0, 0], armR: [-17, 3.6, 0], foreR: [-71, 0, 0], handR: [20, 0, 0],
    ...both([-20, 0, 0], 'legL1', 'legR1'), ...both([84, 0, 0], 'legL2', 'legR2'), ...both([-95, 0, 0], 'footL1', 'footR1'), ...both([76, 0, 0], 'footL2', 'footR2'), tail1: [78, 0, 0],
  }),
};

// ---------------------------------------------------------------------------------------- mélanges
const GROUPS: Record<'rear' | 'front' | 'head', BoneKey[]> = {
  rear: ['hip', 'legL1', 'legL2', 'footL1', 'footL2', 'legR1', 'legR2', 'footR1', 'footR2', 'tail1', 'tail2', 'tail3'],
  front: ['spine1', 'spine2', 'armL', 'foreL', 'handL', 'armR', 'foreR', 'handR'],
  head: ['neck', 'head'],
};
const groupOf = (k: BoneKey) => (GROUPS.rear.includes(k) ? 'rear' : GROUPS.front.includes(k) ? 'front' : 'head') as 'rear' | 'front' | 'head';

/** Mélange de deux poses avec une part différente pour l'arrière-train, l'avant et la tête (permet d'échelonner les mouvements). */
export function blend(a: Pose, b: Pose, f: number | { rear: number; front: number; head: number }): Pose {
  const share = (k: BoneKey) => (typeof f === 'number' ? f : f[groupOf(k)]);
  const r: Partial<Record<BoneKey, Euler3>> = {};
  const keys = new Set([...Object.keys(a.r), ...Object.keys(b.r)]) as Set<BoneKey>;
  keys.forEach((k) => {
    const x = a.r[k] ?? [0, 0, 0], y = b.r[k] ?? [0, 0, 0], t = share(k);
    r[k] = [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];
  });
  const ha = a.hip ?? [0, 0, 0], hb = b.hip ?? [0, 0, 0], th = typeof f === 'number' ? f : f.rear;
  return { r, hip: [ha[0] + (hb[0] - ha[0]) * th, ha[1] + (hb[1] - ha[1]) * th, ha[2] + (hb[2] - ha[2]) * th] };
}

// ---------------------------------------------------------------------------------------- séquences
export interface Key { t: number; pose: Pose; /** Poids de la couche de pose (0 = animation de repos seule). */ w: number }
export interface SequenceDef {
  name: PostureState;
  from: Posture;
  to: Posture;
  keys: Key[];
  /** Pieds tenus en place (coordonnées monde) pendant la séquence : chaîne de pattes concernée. */
  anchors?: ('handL' | 'handR' | 'footL2' | 'footR2')[];
}
const S = POSES.stand, SIT = POSES.sit, LIE = POSES.lie, SLP = POSES.sleep, STR = POSES.stretch;

export const SEQUENCES: SequenceDef[] = [
  { name: 'SittingDown', from: 'stand', to: 'sit', anchors: ['handL', 'handR'], keys: [
    { t: 0, pose: S, w: 0 },
    { t: 0.4, pose: blend(S, SIT, { rear: 0.15, front: 0.1, head: 0.05 }), w: 1 },   // il prépare son assise : poids reporté, genoux fléchis
    { t: 1.0, pose: blend(S, SIT, { rear: 0.65, front: 0.35, head: 0.3 }), w: 1 },   // le bassin descend, le buste se redresse
    { t: 1.7, pose: SIT, w: 1 },
  ] },
  { name: 'StandingUp', from: 'sit', to: 'stand', anchors: ['handL', 'handR'], keys: [
    { t: 0, pose: SIT, w: 1 },
    { t: 0.5, pose: blend(SIT, S, { rear: 0.25, front: 0.1, head: 0.2 }), w: 1 },
    { t: 1.1, pose: blend(SIT, S, { rear: 0.8, front: 0.6, head: 0.6 }), w: 1 },
    { t: 1.6, pose: S, w: 0 },
  ] },
  { name: 'LyingDown', from: 'sit', to: 'lie', keys: [
    { t: 0, pose: SIT, w: 1 },
    { t: 0.6, pose: blend(SIT, LIE, { rear: 0.0, front: 0.35, head: 0.2 }), w: 1 },   // les antérieurs glissent vers l'avant, la poitrine descend
    { t: 1.5, pose: blend(SIT, LIE, { rear: 0.6, front: 0.9, head: 0.7 }), w: 1 },
    { t: 2.2, pose: LIE, w: 1 },
  ] },
  { name: 'StandingUp', from: 'lie', to: 'sit', keys: [
    { t: 0, pose: LIE, w: 1 },
    { t: 0.6, pose: blend(LIE, SIT, { rear: 0.1, front: 0.4, head: 0.4 }), w: 1 },
    { t: 1.3, pose: blend(LIE, SIT, { rear: 0.7, front: 0.9, head: 0.8 }), w: 1 },
    { t: 1.9, pose: SIT, w: 1 },
  ] },
  { name: 'PreparingSleep', from: 'lie', to: 'sleep', keys: [
    { t: 0, pose: LIE, w: 1 },
    { t: 0.8, pose: blend(LIE, SLP, { rear: 0.2, front: 0.0, head: 0.35 }), w: 1 },
    { t: 2.0, pose: blend(LIE, SLP, { rear: 0.8, front: 0.5, head: 0.85 }), w: 1 },
    { t: 3.0, pose: SLP, w: 1 },
  ] },
  { name: 'WakingUp', from: 'sleep', to: 'lie', keys: [
    { t: 0, pose: SLP, w: 1 },
    { t: 0.5, pose: blend(SLP, LIE, { rear: 0.0, front: 0.0, head: 0.18 }), w: 1 },  // la tête se soulève à peine
    { t: 1.1, pose: blend(SLP, LIE, { rear: 0.1, front: 0.1, head: 0.2 }), w: 1 },   // hésitation
    { t: 2.1, pose: blend(SLP, LIE, { rear: 0.7, front: 0.5, head: 1 }), w: 1 },
    { t: 2.8, pose: LIE, w: 1 },
  ] },
  { name: 'Stretching', from: 'stand', to: 'stand', anchors: ['footL2', 'footR2'], keys: [
    { t: 0, pose: S, w: 0 },
    { t: 0.5, pose: blend(S, STR, { rear: 0.1, front: 0.15, head: 0.1 }), w: 1 },
    { t: 1.3, pose: STR, w: 1 },
    { t: 2.1, pose: STR, w: 1 },
    { t: 2.9, pose: blend(S, STR, { rear: 0.2, front: 0.3, head: 0.3 }), w: 1 },
    { t: 3.5, pose: S, w: 0 },
  ] },
];

/** Étapes possibles d'une posture à une autre (graphe). Les chemins sont calculés par recherche en largeur. */
export const EDGES: { from: Posture; to: Posture }[] = [
  { from: 'stand', to: 'sit' }, { from: 'sit', to: 'stand' }, { from: 'sit', to: 'lie' }, { from: 'lie', to: 'sit' }, { from: 'lie', to: 'sleep' }, { from: 'sleep', to: 'lie' },
];
