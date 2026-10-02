import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
import { CAT_REALISTIC, FOX_STANDIN, PetModelConfig } from '../config/pet';

/** Mobile : le chargeur de R3F Native lit un module Metro (nombre) via expo-asset. Web (tests) : une URL. */
const source = (mod: number): string => (Platform.OS === 'web' ? Asset.fromModule(mod).uri : (mod as unknown as string));

export interface RegisteredModel {
  config: PetModelConfig;
  source: string;
  credits: string;
}

/** Pour ajouter un animal : voir docs/ADD_A_PET.md. Les chemins require() doivent être statiques (Metro). */
const FOX_CREDITS = 'Fox : modèle PixelMannen (CC0) · rigging et animations tomkranis (CC BY 4.0) · conversion glTF AsoboStudio & scurest (CC BY 4.0)';

const CAT_CREDITS = 'Chat : modèle « Cat » toti.shroom (CC BY 4.0) · squelette et animations Mesh2Motion / Quaternius (CC0)';

export const MODELS: Record<string, RegisteredModel> = {
  cat: {
    config: CAT_REALISTIC,
    source: source(require('../../assets/models/cat-rigged.glb')),
    credits: CAT_CREDITS,
  },
  'fox-notex': {
    config: FOX_STANDIN,
    source: source(require('../../assets/models/fox-notex.glb')),
    credits: FOX_CREDITS,
  },
  fox: {
    config: FOX_STANDIN,
    source: source(require('../../assets/models/fox.glb')),
    credits: FOX_CREDITS,
  },
};

export const ACTIVE_MODEL: RegisteredModel = MODELS.cat;
