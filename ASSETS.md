# Assets et licences

## Modèle actif : chat réaliste (`assets/models/cat-rigged.glb`)

| Élément | Source | Licence | Attribution |
|---|---|---|---|
| Maillage et texture du chat | « cat » de **toti.shroom** — https://sketchfab.com/3d-models/cat-51cc3bfb49b64128aa54ffa29f36d8c1 | **CC BY 4.0** | **Obligatoire** (affichée dans l'application : voir `src/pet/models.ts`) |
| Squelette (49 os) et 14 animations | export Mesh2Motion (« fox »), animations Quaternius | **CC0** annoncé par Mesh2Motion — *à confirmer sur la page de l'outil avant publication* | Non requise |
| Ajustement du squelette, poids de peau, symétrisation du Walk | ce dépôt (`tools/cat/`) | — | — |

- Fichier : `assets/models/cat-rigged.glb` (≈ 3,2 Mo, ≈ 18 000 triangles, 49 os, 14 clips). Fichiers sources conservés : `cat-source.glb` (maillage d'origine, statique) et `m2m-fox.glb` (export Mesh2Motion).
- Fabrication : `tools/cat/build-cat.mts` (maillage + poids de peau sur le squelette recalé) puis `tools/cat/symmetrize-walk.mts` (la patte arrière droite du clip Walk d'origine appuie 50 % plus vite que la gauche : elle est remplacée par la gauche symétrisée, décalée d'un demi-cycle).
- Clips : Idle, Idle_Alert, Walk, Run, Sneak, Sit, Jump, Bark, Howl, Bite, Fetch, Fall, Death, Rest_Pose. Utilisés : Idle, Walk, Run. Pas de clip couché, sommeil, toilette ni étirement : ces postures restent procédurales.
- Limites : yeux peints sur la texture (aucune paupière), pas de morph targets.

## Renard (support technique d'origine, plus embarqué)

| Élément | Source | Licence | Attribution |
|---|---|---|---|
| Modèle et texture du renard | « Fox » de PixelMannen | **CC0 1.0** | Non requise (conseillée) |
| Rigging et animations (Survey, Walk, Run) | tomkranis | **CC BY 4.0** | **Obligatoire** |
| Conversion glTF | @AsoboStudio et @scurest | **CC BY 4.0** | **Obligatoire** |

- Fichier : `assets/models/fox.glb` — **162 852 octets**, format glTF binaire, **576 triangles**, 24 os, 1 matériau, 1 texture PNG 1024×1024 (couleur de base uniquement).
- Clips : **Survey** (3,417 s, regard autour de soi, utilisé comme repos), **Walk** (0,708 s), **Run** (1,158 s). Aucun clip de transition (assis, couché, sommeil).
- Source : `KhronosGroup/glTF-Sample-Assets`, dossier `Models/Fox` (README et `metadata.json` vérifiés le 2026-10-02, licences des trois composants lues séparément).
  - Fichier : https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Fox/glTF-Binary/Fox.glb
  - Notice : https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox
- Attribution affichée dans l'application (bas de l'écran) et ici.

## Dépendances logicielles (licences)
`three` (MIT), `@react-three/fiber` (MIT), `expo`, `expo-gl`, `expo-asset`, `expo-file-system` (MIT), `react-native` (MIT).

## Cherche-t-on un chat ou un chien ?
Voir `docs/ADD_A_PET.md`. **Aucun chat ni chien animé sous licence compatible n'a pu être récupéré depuis cet environnement.**
