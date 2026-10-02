/** Contrat d'un animal : fichier, échelle, noms des clips, vitesses mesurées (voir tools/analyze-clips.mjs). */
import { TurnConfig } from './turning';

export interface PetModelConfig {
  id: string;
  label: string;
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
  /** Réglages de virage propres à cet animal (le reste vient de config/turning.ts). */
  turn?: Partial<TurnConfig>;
}

/** Stand-in technique : un renard (CC0 + CC-BY 4.0), PAS le chat/chien final. Voir ASSETS.md. */
export const FOX_STANDIN: PetModelConfig = {
  id: 'fox-standin',
  label: 'Renard (stand-in)',
  scale: 0.0046,
  yawOffset: 0,
  clips: { idle: 'Survey', walk: 'Walk', run: 'Run' },
  groundSpeed: { walk: 105, run: 170 }, // mesuré en conditions réelles, ± 15 % (voir RESULTS.md)
  headBone: 'b_Head_05',
  footBones: ['b_LeftFoot02_018', 'b_RightFoot02_022', 'b_LeftHand_011', 'b_RightHand_08'],
  headBones: [['b_Neck_04', 0.55], ['b_Head_05', 0.45]],
  spineBones: [['b_Spine01_02', 0.4], ['b_Spine02_03', 0.6]],
  turn: {},
};

export const ROOM = { width: 4.2, depth: 3.6, height: 2.6 } as const;
