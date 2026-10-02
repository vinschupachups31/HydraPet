import Constants from 'expo-constants';
import { Platform } from 'react-native';

type PlatformConstants = { reactNativeVersion?: { major: number; minor: number; patch: number }; Model?: string; Brand?: string };

/** Informations d'environnement pour le rapport de test. Ne doit jamais lever d'exception. */
export function envLines(): string[] {
  try {
    const v = ((Platform as unknown as { constants?: PlatformConstants }).constants ?? {}) as PlatformConstants;
    const rn = v.reactNativeVersion ? `${v.reactNativeVersion.major}.${v.reactNativeVersion.minor}.${v.reactNativeVersion.patch}` : '?';
    const env = (Constants as { executionEnvironment?: string }).executionEnvironment;
    const sdk = (Constants.expoConfig as { sdkVersion?: string } | null | undefined)?.sdkVersion;
    return [
      `Plateforme : ${Platform.OS} ${String(Platform.Version)}${v.Model ? ` · ${v.Brand ?? ''} ${v.Model}` : ''}`,
      `Environnement : ${env ?? '?'}${env === 'storeClient' ? ' (= Expo Go)' : ''}`,
      `Expo SDK : ${sdk ?? '?'} · React Native ${rn}`,
      `Moteur JS : ${(globalThis as { HermesInternal?: unknown }).HermesInternal ? 'Hermes' : 'autre'}`,
    ];
  } catch (e) {
    return [`Environnement illisible : ${(e as Error).message}`];
  }
}
