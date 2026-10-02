# HydraPet — test technique 3D (Expo + React Three Fiber)

Test visuel de faisabilité : un animal 3D riggé (GLB) qui vit dans une pièce, sur téléphone, avec Expo.
**Ce n'est pas l'application complète** : ni journal d'eau, ni sauvegarde, ni écrans. Voir [`RESULTS.md`](RESULTS.md) pour les résultats et les limites, [`ASSETS.md`](ASSETS.md) pour les licences.

> **Important :** le modèle fourni est un **renard** (stand-in technique, 576 triangles), pas un chat ni un chien, et il n'est pas réaliste.
> Voir [`docs/ADD_A_PET.md`](docs/ADD_A_PET.md) pour brancher un vrai chat ou chien.

## Lancer sur votre téléphone (Expo Go)
Prérequis : Node.js 22+, l'application **Expo Go** sur le téléphone, PC et téléphone sur le même Wi-Fi.

```bash
git clone https://github.com/vinschupachups31/HydraPet.git
cd HydraPet
git checkout expo-r3f-spike
npm install
npm start
```
Puis scanner le QR code (Android : depuis Expo Go ; iPhone : avec l'appareil photo, qui ouvre Expo Go).

- Réseau qui bloque la connexion (Wi-Fi d'entreprise, invité) : `npx expo start --tunnel`.
- Si Expo Go affiche « incompatible » : la version d'Expo Go du magasin ne prend pas encore en charge le SDK 57 → utilisez le *development build* ci-dessous.

### Expo Go ou development build ?
| | Expo Go | Development build |
|---|---|---|
| Ce que ce test utilise | `expo-gl`, `expo-asset`, `expo-file-system` : **inclus dans Expo Go** (SDK 57), le reste est du JavaScript | pareil |
| Installation | Aucune compilation, scanner le QR | Compiler une app dédiée (Android Studio, ou EAS cloud) |
| Suffit pour ce test ? | **Oui, en principe** (non vérifié sur téléphone par moi) | Nécessaire si Expo Go est incompatible avec le SDK 57 |
| Nécessaire plus tard pour | — | micro (appel vocal), notifications fiables, modules natifs, publication |

Les deux modes **ne sont pas équivalents** : Expo Go est un lecteur générique fourni par Expo ; un development build est *votre* application, avec vos modules natifs.

Development build Android (si besoin) :
```bash
# Option A : compilation locale (Android Studio + SDK installés)
npx expo install expo-dev-client
npx expo run:android

# Option B : compilation cloud (compte gratuit sur expo.dev)
npx eas-cli build --profile development --platform android
```
iPhone : un development build exige un Mac et un compte Apple Developer (99 $/an).

## Si l'écran tourne en boucle ou affiche « Something went wrong »
Deux cas très différents : repérez lequel est le vôtre.

**A. L'application ne s'ouvre jamais** (Expo Go reste sur un écran de chargement ou affiche une erreur de connexion) : c'est un problème de réseau ou de version.
1. Le téléphone est-il sur le **même Wi-Fi** que le PC ? (pas en 4G/5G, pas sur un Wi-Fi « invité »)
2. `npm run lan` affiche l'adresse du PC. Un VPN ou une carte virtuelle (WSL, Hyper-V, Docker) fait souvent annoncer une mauvaise adresse dans le QR code. Utilisez la commande proposée (`REACT_NATIVE_PACKAGER_HOSTNAME=…`).
3. Pare-feu Windows : autorisez le port 8081 (commande donnée par `npm run lan`).
4. Dans Expo Go : *Enter URL manually* → `exp://ADRESSE_DU_PC:8081`.
5. `npm run start:tunnel` contourne le réseau local (demande d'installer un composant, accepter).
6. Le message exact compte : « Project is incompatible with this version of Expo Go » = Expo Go ne gère pas encore le SDK 57 → mettez à jour Expo Go ; sinon development build (voir plus haut).

**B. L'application s'ouvre mais plante** : elle affiche maintenant l'erreur réelle à l'écran (au lieu de « Something went wrong »). Lancez les **tests 1 à 5** du menu dans l'ordre : le premier qui échoue indique la cause (rendu 3D, chargement du modèle, texture, ombres).

Renvoyez-moi le message exact (capture d'écran) et le **Rapport** : voir [`RETOUR.md`](RETOUR.md).

## Contrôles du test
- **Toucher l'animal** : il s'arrête, se tourne vers la caméra et observe.
- **Appeler** : il vient devant la caméra.
- **Allure** : auto → marche → course (test des clips et des transitions).
- **Autonomie** : coupe ou remet ses déplacements spontanés.
- L'écran affiche les fps, l'état, la vitesse, les poids des clips et leur cadence.

## Vérifications
```bash
npm test            # déplacement, virages et comportement (20 tests)
npm run typecheck
npm run analyze -- assets/models/fox.glb   # clips, os, vitesse de marche d'un modèle
```
