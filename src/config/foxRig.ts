/** Squelette du renard : alias des os utilisés par les postures, et repères de contact.
 *  Les longueurs sont en centimètres à l'échelle de jeu du renard (0,0046 m/unité) ; le rig les convertit en unités du modèle.
 *  Axes du modèle : +x = gauche de l'animal, +y = haut, +z = avant.
 *  Inventaire : 24 os (colonne ×2, cou, tête, 2 antérieurs ×3, 2 postérieurs ×4, queue ×3, racine). Pas d'oreilles, de mâchoire,
 *  de paupières ni de morph target : les yeux et la gueule ne sont pas animables (voir docs/BEHAVIORS.md). */
export const FOX_BONES = {
  hip: 'b_Hip_01', spine1: 'b_Spine01_02', spine2: 'b_Spine02_03', neck: 'b_Neck_04', head: 'b_Head_05',
  armL: 'b_LeftUpperArm_09', foreL: 'b_LeftForeArm_010', handL: 'b_LeftHand_011',
  armR: 'b_RightUpperArm_06', foreR: 'b_RightForeArm_07', handR: 'b_RightHand_08',
  legL1: 'b_LeftLeg01_015', legL2: 'b_LeftLeg02_016', footL1: 'b_LeftFoot01_017', footL2: 'b_LeftFoot02_018',
  legR1: 'b_RightLeg01_019', legR2: 'b_RightLeg02_020', footR1: 'b_RightFoot01_021', footR2: 'b_RightFoot02_022',
  tail1: 'b_Tail01_012', tail2: 'b_Tail02_013', tail3: 'b_Tail03_014',
} as const;
export type BoneKey = keyof typeof FOX_BONES;

export const FOX_RIG = {
  bones: FOX_BONES,
  /** Échelle de référence de ces centimètres (m/unité). */
  refScale: 0.0046,
  /** Bout du museau dans le repère de la tête en pose de liage (cm) : tête à (0, 27,9, 16,6) → nez à (0, 24,7, 30,6). */
  muzzleCm: [0, -3.2, 14.0] as [number, number, number],
  /** Points de contact de la toilette sur la tête, côté droit (cm, repère de la tête en pose de liage ; le côté gauche inverse x). */
  facePointsCm: { muzzle: [0, -3.2, 14.0], cheek: [-4.6, -1.2, 7.5], ear: [-4.4, 8.6, 5.5] } as Record<'muzzle' | 'cheek' | 'ear', [number, number, number]>,
  /** Pattes avant : os de la main et chaîne, pour la toilette. */
  forepaw: { L: ['armL', 'foreL', 'handL'], R: ['armR', 'foreR', 'handR'] } as Record<'L' | 'R', BoneKey[]>,
  /** Coussinet de la patte avant dans le repère de la main (cm) : sous et devant le poignet. */
  padCm: [0, 0, 3.2] as [number, number, number],
};
