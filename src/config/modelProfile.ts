/** Profil d'un modèle d'animal : TOUT ce qui dépend de l'asset est ici (os, clips, échelle, axes, vitesses nominales, enveloppes, contacts,
 *  capacités déclarées). Les comportements, les postures, le cadrage et les diagnostics ne lisent que ce profil : aucun nom d'os ailleurs.
 *  Pour remplacer le renard par un chat : écrire un nouveau profil (voir docs/MODEL_PROFILE.md), pointer ACTIVE_PROFILE dessus, relancer
 *  les outils d'extraction (clips, hull, enveloppes) et les tests. */
import { CLIP_DATA, ClipLocomotionData } from './foxClips';
import { FOX_ENVELOPES } from './foxEnvelopes';
import { FOX_HULL } from './foxHull';
import { FOX_RIG } from './foxRig';

export interface ModelCapabilities {
  /** Paupières (os ou morph) : sans elles, les yeux ne peuvent pas se fermer. */
  eyelids: boolean;
  jaw: boolean;
  tongue: boolean;
  ears: boolean;
  /** Clip dédié pour pivoter sur place (sinon : arc marché). */
  pivotClip: boolean;
  /** Comportements disponibles, et leur origine : clip fourni par l'asset ou pose procédurale sur le squelette. */
  sit: 'clip' | 'procedural' | 'none';
  lie: 'clip' | 'procedural' | 'none';
  sleep: 'clip' | 'procedural' | 'none';
  groom: 'clip' | 'procedural' | 'none';
  stretch: 'clip' | 'procedural' | 'none';
}

export interface ModelProfile {
  id: string;
  label: string;
  /** Espèce réelle de l'asset (ne pas la présenter autrement). */
  species: string;
  license: string;
  /** Mètres par unité du modèle, axes du modèle (avant, haut) et longueur de référence du corps (m). */
  scale: number;
  axes: { forward: '+z'; up: '+y'; left: '+x' };
  bodyLength: number;
  /** Clips natifs par rôle sémantique (noms dans le fichier) et vitesses nominales extraites (unités/s, avant échelle). */
  clips: { idle: string; walk: string; run: string };
  clipData: Record<string, ClipLocomotionData>;
  /** Squelette : alias → noms d'os, pattes avant, points de contact du visage, sommets extrêmes par os, enveloppes par pose. */
  rig: typeof FOX_RIG;
  hull: Record<string, number[][]>;
  envelopes: Record<string, number[][]>;
  capabilities: ModelCapabilities;
}

export const FOX_PROFILE: ModelProfile = {
  id: 'fox-standin',
  label: 'Renard roux (support technique)',
  species: 'renard (Vulpes vulpes), low-poly — PAS un chat',
  license: 'modèle PixelMannen CC0 ; rig et animations tomkranis CC-BY 4.0 ; conversion glTF AsoboStudio & scurest CC-BY 4.0',
  scale: 0.0046,
  axes: { forward: '+z', up: '+y', left: '+x' },
  bodyLength: 0.4,
  clips: { idle: 'Survey', walk: 'Walk', run: 'Run' },
  clipData: CLIP_DATA,
  rig: FOX_RIG,
  hull: FOX_HULL,
  envelopes: FOX_ENVELOPES,
  capabilities: { eyelids: false, jaw: false, tongue: false, ears: false, pivotClip: false, sit: 'procedural', lie: 'procedural', sleep: 'procedural', groom: 'procedural', stretch: 'procedural' },
};

/** Profil actif de l'application. */
export const ACTIVE_PROFILE: ModelProfile = FOX_PROFILE;
