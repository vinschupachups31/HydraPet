/** Squelette du chat (49 os Mesh2Motion, voir tools/cat/build-cat.mts) : mêmes alias que le renard, pour que postures, pieds et toilette
 *  restent indépendants de l'asset. Les longueurs sont en centimètres à l'échelle de jeu du chat (0,55 m/unité).
 *  Axes du modèle : +x = gauche de l'animal, +y = haut, +z = avant.
 *  Os supplémentaires non encore pilotés par les postures : Ear_L/R (+ bouts), Nose, Chin (mâchoire), Stomach, queue ×5, pattes ×6. */
import type { BoneKey } from './foxRig';

export const CAT_BONES: Record<BoneKey, string> = {
  hip: 'Hips', spine1: 'Spine_2', spine2: 'Spine_3', neck: 'Spine_4', head: 'Head',
  armL: 'Front_Leg_Upper_L', foreL: 'Front_Leg_Lower_L', handL: 'Front_Leg_Tip_L',
  armR: 'Front_Leg_Upper_R', foreR: 'Front_Leg_Lower_R', handR: 'Front_Leg_Tip_R',
  legL1: 'Back_Leg_Upper_L', legL2: 'Back_Leg_Lower_L', footL1: 'Back_Leg_Ankle_L', footL2: 'Back_Leg_Tip_L',
  legR1: 'Back_Leg_Upper_R', legR2: 'Back_Leg_Lower_R', footR1: 'Back_Leg_Ankle_R', footR2: 'Back_Leg_Tip_R',
  tail1: 'Tail_Base', tail2: 'Tail_Mid001', tail3: 'Tail_End',
};

export const CAT_RIG = {
  bones: CAT_BONES,
  refScale: 0.55,
  /** Bout du museau dans le repère de la tête en pose de liage (cm). */
  muzzleCm: [0, -3.0, 6.3] as [number, number, number],
  facePointsCm: { muzzle: [0, -3.0, 6.3], cheek: [-2.8, -2.2, 2.8], ear: [-3.6, 4.0, 1.4] } as Record<'muzzle' | 'cheek' | 'ear', [number, number, number]>,
  forepaw: { L: ['armL', 'foreL', 'handL'], R: ['armR', 'foreR', 'handR'] } as Record<'L' | 'R', BoneKey[]>,
  /** Coussinet : dessus de la patte, un peu en arrière du bout (cm, repère de l'os du bout de patte). */
  padCm: [0, 0.6, -1.5] as [number, number, number],
};
