/** Contrat d'un animal : fichier, échelle, noms des clips, vitesses mesurées (voir tools/analyze-clips.mjs). */
import { CLIP_DATA } from './foxClips';
import { CAT_CLIP_DATA } from './catClips';
import { CAT_PROFILE, FOX_PROFILE } from './modelProfile';
import { FootChainDef } from '../pet/footIK';
import { TurnConfig } from './turning';
import type { ExpressionConfig } from '../pet/expression';

export interface PetModelConfig {
  id: string;
  label: string;
  /** Fichier du modèle (relatif à la racine du dépôt) : outils et tests. */
  file: string;
  /** Mètres par unité du modèle. */
  scale: number;
  /** Rotation (rad) à ajouter pour que « l'avant » du modèle soit +Z. */
  yawOffset: number;
  clips: { idle: string; walk: string; run: string };
  /** Vitesse « sans glissement » des clips, en unités du modèle par seconde, à timeScale 1. */
  groundSpeed: { walk: number; run: number };
  headBone: string;
  /** Os des pieds, pour mesurer le glissement (sonde de test). */
  footBones: string[];
  /** Cou et tête : suivent le regard en premier ([os, part du mouvement]). */
  headBones: [string, number][];
  /** Colonne (épaules) : suit plus tard et moins loin. */
  spineBones: [string, number][];
  /** Chaînes d'os des quatre pattes (de la racine au pied) pour la correction des appuis. */
  footChains: FootChainDef[];
  /** Réglages de virage propres à cet animal (le reste vient de config/turning.ts). */
  turn?: Partial<TurnConfig>;
  /** Oreilles : frémissements (couche d'expression). Absent : aucune. */
  expression?: ExpressionConfig;
}

/** Stand-in technique : un renard (CC0 + CC-BY 4.0), PAS le chat/chien final. Voir ASSETS.md. */
export const FOX_STANDIN: PetModelConfig = {
  id: 'fox-standin',
  label: 'Renard (stand-in)',
  file: 'assets/models/fox.glb',
  scale: FOX_PROFILE.scale,
  yawOffset: 0,
  clips: { idle: 'Survey', walk: 'Walk', run: 'Run' },
  groundSpeed: { walk: CLIP_DATA.Walk.nominalSpeed, run: CLIP_DATA.Run.nominalSpeed }, // métadonnées extraites du clip (u/s)
  headBone: 'b_Head_05',
  footBones: ['b_LeftFoot02_018', 'b_RightFoot02_022', 'b_LeftHand_011', 'b_RightHand_08'],
  headBones: [['b_Neck_04', 0.55], ['b_Head_05', 0.45]],
  spineBones: [['b_Spine01_02', 0.4], ['b_Spine02_03', 0.6]],
  footChains: [
    { foot: 'b_RightHand_08', bones: ['b_RightUpperArm_06', 'b_RightForeArm_07', 'b_RightHand_08'] },
    { foot: 'b_LeftHand_011', bones: ['b_LeftUpperArm_09', 'b_LeftForeArm_010', 'b_LeftHand_011'] },
    { foot: 'b_LeftFoot02_018', bones: ['b_LeftLeg01_015', 'b_LeftLeg02_016', 'b_LeftFoot01_017', 'b_LeftFoot02_018'] },
    { foot: 'b_RightFoot02_022', bones: ['b_RightLeg01_019', 'b_RightLeg02_020', 'b_RightFoot01_021', 'b_RightFoot02_022'] },
  ],
  turn: {},
};

export const ROOM = { width: 4.2, depth: 3.6, height: 2.6 } as const;

/** Chat réaliste : maillage toti.shroom (CC BY 4.0) sur le squelette Mesh2Motion (49 os). Voir ASSETS.md. */
export const CAT_REALISTIC: PetModelConfig = {
  id: 'cat-realistic',
  label: 'Chat roux tigré',
  file: 'assets/models/cat-rigged.glb',
  scale: CAT_PROFILE.scale,
  yawOffset: 0,
  clips: { idle: 'Idle', walk: 'Walk', run: 'Run' },
  groundSpeed: { walk: CAT_CLIP_DATA.Walk.nominalSpeed, run: CAT_CLIP_DATA.Run.nominalSpeed },
  headBone: 'Head',
  footBones: ['Back_Leg_Tip_L', 'Back_Leg_Tip_R', 'Front_Leg_Tip_L', 'Front_Leg_Tip_R'],
  headBones: [['Spine_4', 0.55], ['Head', 0.45]],
  spineBones: [['Spine_2', 0.4], ['Spine_3', 0.6]],
  footChains: [
    { foot: 'Front_Leg_Tip_R', bones: ['Front_Leg_Upper_R', 'Front_Leg_Lower_R', 'Front_Leg_Tip_R'], contact: [-0.0014, -0.0394, 0.0056] },
    { foot: 'Front_Leg_Tip_L', bones: ['Front_Leg_Upper_L', 'Front_Leg_Lower_L', 'Front_Leg_Tip_L'], contact: [0.0024, -0.0263, 0.0047] },
    { foot: 'Back_Leg_Tip_L', bones: ['Back_Leg_Upper_L', 'Back_Leg_Lower_L', 'Back_Leg_Ankle_L', 'Back_Leg_Tip_L'], contact: [0.0059, -0.0437, -0.0041] },
    { foot: 'Back_Leg_Tip_R', bones: ['Back_Leg_Upper_R', 'Back_Leg_Lower_R', 'Back_Leg_Ankle_R', 'Back_Leg_Tip_R'], contact: [-0.0023, -0.0452, -0.0024] },
  ],
  turn: {},
  expression: { ears: ['Ear_L', 'Ear_R'], twitchEvery: [3, 9], twitchTime: 0.22, twitchDeg: { back: 14, out: 10 } },
};

export const ACTIVE_PET: PetModelConfig = CAT_REALISTIC;
