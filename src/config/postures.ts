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
  /** Assis : bassin au sol, colonne inclinée (hanche −30°, pas verticale), cuisses et jarrets repliés (métatarse à plat), antérieurs presque verticaux et légèrement
   *  fléchis devant le thorax, tête un peu baissée, queue rabattue sur le côté. Sert d'assise de référence à l'activité « assis », à la toilette et au sommeil. */
  sit: P({
    hip: [-30, 0, 0], neck: [16, 0, 0], head: [20, 0, 0],
    ...both([36, 0, 0], 'armL', 'armR'), ...both([-6, 0, 0], 'foreL', 'foreR'), ...both([8, 0, 0], 'handL', 'handR'),
    ...both([-28, 0, 0], 'legL1', 'legR1'), ...both([84, 0, 0], 'legL2', 'legR2'), ...both([-95, 0, 0], 'footL1', 'footR1'), ...both([76, 0, 0], 'footL2', 'footR2'),
    tail1: [78, 0, 25], tail2: [0, 0, 25],
  }),
  /** Couché, éveillé (position du sphinx) : poitrine au sol, antérieurs repliés vers l'avant, postérieurs rentrés. */
  lie: P({
    neck: [-5, 0, 0], head: [10, 0, 0],
    ...both([48, 0, 0], 'armL', 'armR'), ...both([-136, 0, 0], 'foreL', 'foreR'), ...both([31, 0, 0], 'handL', 'handR'),
    ...both([-53, 0, 0], 'legL1', 'legR1'), ...both([87, 0, 0], 'legL2', 'legR2'), ...both([-105, 0, 0], 'footL1', 'footR1'), ...both([76, 0, 0], 'footL2', 'footR2'),
    tail1: [-25, 0, 15], tail2: [-20, 0, 10],
  }),
  /** Endormi : tête baissée tournée vers le flanc, queue enroulée. */
  sleep: P({
    neck: [22, 0, 40], head: [20, 0, 15],
    ...both([48, 0, 0], 'armL', 'armR'), ...both([-136, 0, 0], 'foreL', 'foreR'), ...both([31, 0, 0], 'handL', 'handR'),
    ...both([-53, 0, 0], 'legL1', 'legR1'), ...both([87, 0, 0], 'legL2', 'legR2'), ...both([-105, 0, 0], 'footL1', 'footR1'), ...both([76, 0, 0], 'footL2', 'footR2'),
    tail1: [-50, 0, 75], tail2: [-60, 0, 50], tail3: [-40, 0, 50],
  }),
  /** Étirement avant (« salut ») : poitrine basse, antérieurs allongés, bassin haut. */
  stretch: P({
    hip: [28, 0, 0], neck: [-30, 0, 0], ...both([-100, 0, 0], 'armL', 'armR'), ...both([-5, 0, 0], 'foreL', 'foreR'), ...both([-28, 0, 0], 'legL1', 'legR1'),
  }),
  /** Transfert de poids avant de lever la patte droite : le thorax se déplace vers le côté porteur (gauche), l'antérieur gauche s'étend un peu. */
  groomShift: P({
    hip: [-30, 0, 0], spine1: [0, -4, 0], spine2: [0, -3, 0], neck: [16, 0, 0], head: [20, 0, 0],
    armL: [40, 0, 0], armR: [36, 0, 0], ...both([-6, 0, 0], 'foreL', 'foreR'), ...both([8, 0, 0], 'handL', 'handR'),
    ...both([-28, 0, 0], 'legL1', 'legR1'), ...both([84, 0, 0], 'legL2', 'legR2'), ...both([-95, 0, 0], 'footL1', 'footR1'), ...both([76, 0, 0], 'footL2', 'footR2'),
    tail1: [78, 0, 25], tail2: [0, 0, 25],
  }),
  /** Patte droite au museau : épaule, coude et carpe fléchis, la tête s'incline de 6° seulement (poses ajustées par optimisation dans le banc de pose, écart 2 cm). */
  groomUp: P({
    hip: [-30, 0, 0], spine1: [0, -4, 0], spine2: [0, -3, 0], neck: [23, 0, 1.8], head: [18.2, 0, -8],
    armL: [40, 0, 0], armR: [-40, 22, 3.5], foreR: [-95, 0, 0], handR: [40, 0, 0], foreL: [-6, 0, 0], handL: [8, 0, 0],
    ...both([-28, 0, 0], 'legL1', 'legR1'), ...both([84, 0, 0], 'legL2', 'legR2'), ...both([-95, 0, 0], 'footL1', 'footR1'), ...both([76, 0, 0], 'footL2', 'footR2'),
    tail1: [78, 0, 25], tail2: [0, 0, 25],
  }),
  /** Patte à la joue. */
  groomCheek: P({
    hip: [-30, 0, 0], spine1: [0, -4, 0], spine2: [0, -3, 0], neck: [23, 0, 6], head: [26, 0, 8],
    armL: [40, 0, 0], armR: [-60, 28.4, -6], foreR: [-105, 0, 0], handR: [57.7, 0, 0], foreL: [-6, 0, 0], handL: [8, 0, 0],
    ...both([-28, 0, 0], 'legL1', 'legR1'), ...both([84, 0, 0], 'legL2', 'legR2'), ...both([-95, 0, 0], 'footL1', 'footR1'), ...both([76, 0, 0], 'footL2', 'footR2'),
    tail1: [78, 0, 25], tail2: [0, 0, 25],
  }),
  /** Patte à la base de l'oreille : l'épaule monte, la tête accompagne légèrement. */
  groomEar: P({
    hip: [-30, 0, 0], spine1: [0, -4, 0], spine2: [0, -3, 0], neck: [23, 0, 6], head: [26, 0, 8],
    armL: [40, 0, 0], armR: [-90, 7.6, -1.6], foreR: [-75.9, 0, 0], handR: [-20.5, 0, 0], foreL: [-6, 0, 0], handL: [8, 0, 0],
    ...both([-28, 0, 0], 'legL1', 'legR1'), ...both([84, 0, 0], 'legL2', 'legR2'), ...both([-95, 0, 0], 'footL1', 'footR1'), ...both([76, 0, 0], 'footL2', 'footR2'),
    tail1: [78, 0, 25], tail2: [0, 0, 25],
  }),
};
/** Assise de la toilette = assise de référence (même pose : pas de remontée du corps entre l'assise et la toilette). */
POSES.groomSit = POSES.sit;

/** Pose miroir (patte gauche au lieu de droite) : os gauche ↔ droit, roulis et lacet inversés. */
const SWAP: Partial<Record<BoneKey, BoneKey>> = { armL: 'armR', armR: 'armL', foreL: 'foreR', foreR: 'foreL', handL: 'handR', handR: 'handL', legL1: 'legR1', legR1: 'legL1', legL2: 'legR2', legR2: 'legL2', footL1: 'footR1', footR1: 'footL1', footL2: 'footR2', footR2: 'footL2' };
export function mirrorPose(p: Pose): Pose {
  const r: Partial<Record<BoneKey, Euler3>> = {};
  for (const k of Object.keys(p.r) as BoneKey[]) { const e = p.r[k]!; r[SWAP[k] ?? k] = [e[0], -e[1], -e[2]]; }
  return { r, hip: p.hip ? [-p.hip[0], p.hip[1], p.hip[2]] : undefined };
}

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
  /** Repositionnement d'un pied tenu : à `at` (part de la séquence) il est relâché, soulevé de ~1,8 cm, déplacé vers sa place dans la pose pendant `dur` s, puis reposé (jamais traîné sur plusieurs cm). */
  steps?: Partial<Record<'handL' | 'handR' | 'footL2' | 'footR2', { at: number; dur: number }>>;
}
const S = POSES.stand, SIT = POSES.sit, LIE = POSES.lie, SLP = POSES.sleep, STR = POSES.stretch;

export const SEQUENCES: SequenceDef[] = [
  { name: 'SittingDown', from: 'stand', to: 'sit', anchors: ['handL', 'handR', 'footL2', 'footR2'], steps: { footL2: { at: 0.4, dur: 0.3 }, footR2: { at: 0.55, dur: 0.3 }, handL: { at: 0.62, dur: 0.28 }, handR: { at: 0.72, dur: 0.28 } }, keys: [
    { t: 0, pose: S, w: 0 },
    { t: 0.4, pose: blend(S, SIT, { rear: 0.15, front: 0.1, head: 0.05 }), w: 1 },   // il prépare son assise : poids reporté, genoux fléchis
    { t: 1.0, pose: blend(S, SIT, { rear: 0.65, front: 0.35, head: 0.3 }), w: 1 },   // le bassin descend, le buste se redresse
    { t: 1.7, pose: SIT, w: 1 },
  ] },
  { name: 'StandingUp', from: 'sit', to: 'stand', anchors: ['handL', 'handR', 'footL2', 'footR2'], steps: { footL2: { at: 0.15, dur: 0.3 }, footR2: { at: 0.3, dur: 0.3 }, handL: { at: 0.5, dur: 0.28 }, handR: { at: 0.6, dur: 0.28 } }, keys: [
    { t: 0, pose: SIT, w: 1 },
    { t: 0.5, pose: blend(SIT, S, { rear: 0.25, front: 0.1, head: 0.2 }), w: 1 },
    { t: 1.1, pose: blend(SIT, S, { rear: 0.8, front: 0.6, head: 0.6 }), w: 1 },
    { t: 1.6, pose: S, w: 0 },
  ] },
  { name: 'LyingDown', from: 'sit', to: 'lie', anchors: ['handL', 'handR', 'footL2', 'footR2'], steps: { handL: { at: 0.35, dur: 0.4 }, handR: { at: 0.5, dur: 0.4 }, footL2: { at: 0.3, dur: 0.35 }, footR2: { at: 0.45, dur: 0.35 } }, keys: [
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
