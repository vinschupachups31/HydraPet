# Résultats du test technique

Date : 2026-10-02. Stack : Expo SDK 57, React Native 0.86.3, React 19.2.3, three 0.186.1, @react-three/fiber 9.8.1, expo-gl 57.0.2.

## Ce qui a été vérifié, et comment
| Point | Résultat | Preuve |
|---|---|---|
| Compatibilité des versions | OK sur le papier : R3F 9.8.1 accepte React ≥ 19 < 19.4, RN ≥ 0.78, three ≥ 0.156, expo-gl | `npm view`, `bundledNativeModules.json` du SDK 57 |
| Modules natifs requis | `expo-gl`, `expo-asset`, `expo-file-system` : tous dans la liste fournie avec Expo Go (SDK 57) | `bundledNativeModules.json` |
| Chargement GLB | OK **dans Chromium** (web). Sur mobile : le chargeur de R3F Native remplace `FileLoader` et `TextureLoader` (expo-asset + `expo-file-system/legacy`, qui existe encore en SDK 57) | lecture du code source de R3F Native |
| `.glb` dans Metro | **Nécessite** `metro.config.js` (`glb` absent des extensions par défaut) ; fait | test `assetExts` |
| `TextDecoder` (analyse du GLB) | Fourni par `expo/src/winter` | lecture du source |
| Bundle natif | Le bundle Android Hermes se construit (642 modules, `.glb` embarqué) | `expo export --platform android` |
| Clips lus et mélangés | Survey / Walk / Run, poids lissés, somme = 1 à chaque image | sonde de test, 1 300 images |
| Transitions | Accélération max 1,60 m/s² ; rotation max 115 °/s ; pas de demi-tour instantané | sonde de test |
| Cadence calée sur la vitesse | Marche : vitesse de recul mesurée 0,47 m/s pour 0,48 attendu (écart ~2 %) ; course : 0,82 m/s pour 0,78 | `calib` sur les pieds |
| Toucher | Un clic réel sur l'animal déclenche la réaction (arrêt, orientation vers la caméra, observation) | test Playwright |
| Tests de logique | 7 / 7 (arrivée, rotation bornée, freinage, mix d'animation, déterminisme avec graine, réaction au toucher, reste dans la zone) | `npm test` |

## Ce qui n'a PAS été vérifié
- **Aucun test sur téléphone ni sur émulateur** : je n'ai accès ni à un appareil, ni à Expo Go, ni à un GPU. Le rendu a été exécuté sur Chromium avec WebGL logiciel (SwiftShader).
- Les fps mesurés (29 à 37) sont ceux d'un rendu logiciel : **ils ne disent rien** des performances sur mobile.
- Les ombres (`shadow map`) et le chargement des textures sur `expo-gl` natif.
- Expo Go du magasin compatible avec le SDK 57 : à constater sur votre téléphone.

## Défauts constatés
1. **Glissement des pattes : élevé.** Vitesse du pied pendant l'appui, rapportée à la vitesse du corps (médiane) : **~46 % en marche, ~66 % en course**. Calage de la cadence correct, mais l'animation n'a pas de véritables phases d'appui à vitesse constante : le pied recule à vitesse variable (écart interquartile ~±50 % en marche). Avancer le corps à vitesse constante ne peut donc pas les planter. Solutions : IK des pattes (prévue), vitesse du corps modulée par la phase avec un clip conçu pour (un modèle mieux animé), ou clip « en place » + capture d'appuis.
2. **Pas de transitions de posture** (assis, couché, sommeil) : le renard n'a que Survey / Walk / Run.
3. **Terrain étroit en portrait** : la caméra à 45 mm ne montre que ~1 m de large autour du centre ; l'animal est limité à la zone visible.
4. **Avertissements** : `THREE.Clock` déprécié (utilisé par R3F 9.8.1) ; sans conséquence.

## Verdict
- **La stack est viable** : Expo + R3F + GLB riggé + mixeur d'animations, avec une logique de déplacement testée. Le seul risque restant côté technique est le chargement de textures GLB sur `expo-gl` natif, que je n'ai pas pu exécuter.
- **Le renard ne répond pas au besoin visuel** : 576 triangles, une texture, style low-poly. Ce n'est pas le « réalisme chaleureux » visé et ce n'est ni un chat ni un chien.
- **Aucun chat ni chien animé sous licence compatible n'a été obtenu** : mon environnement ne peut pas accéder aux sites de modèles. Un chat ou chien **réaliste et animé** est très probablement payant ou à commander ; avec un budget nul, on obtiendra plutôt du low-poly stylisé (Poly Pizza, Quaternius, Sketchfab CC0), ce qui contredit « réalisme ».
