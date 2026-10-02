import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
import { CAT_REALISTIC, PetModelConfig } from '../config/pet';

/** Mobile : le chargeur de R3F Native lit un module Metro (nombre) via expo-asset. Web (tests) : une URL. */
const source = (mod: number): string => (Platform.OS === 'web' ? Asset.fromModule(mod).uri : (mod as unknown as string));

export interface RegisteredModel {
  config: PetModelConfig;
  source: string;
  credits: string;
}

/** Pour ajouter un animal : voir docs/ADD_A_PET.md. Les chemins require() doivent être statiques (Metro). Le renard (stand-in) reste dans assets/models/ mais n'est plus embarqué. */

const CAT_CREDITS = 'Chat : modèle « Cat » toti.shroom (CC BY 4.0) · squelette et animations Mesh2Motion / Quaternius (CC0)';

export const MODELS: Record<string, RegisteredModel> = {
  cat: {
    config: CAT_REALISTIC,
    source: source(require('../../assets/models/cat-rigged.glb')),
    credits: CAT_CREDITS,
  },
};

export const ACTIVE_MODEL: RegisteredModel = MODELS.cat;
