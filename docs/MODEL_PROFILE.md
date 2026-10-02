# Profil de modèle : préparer le remplacement du renard par un chat

Tout ce qui dépend de l'asset est dans `src/config/modelProfile.ts` (`ModelProfile`) : espèce réelle, licence, échelle et axes, longueur du corps, clips sémantiques (idle / walk / run) et vitesses nominales extraites, alias d'os (`foxRig.ts`), pattes avant, points de contact du visage (museau, joue, oreille), sommets extrêmes par os (`foxHull.ts`), enveloppes par pose (`foxEnvelopes.ts`), **capacités déclarées** (paupières, mâchoire, langue, oreilles, clip de pivot ; assis, couché, sommeil, toilette, étirement : `clip` | `procedural` | `none`). Aucun nom d'os n'apparaît dans `src/pet/` (test `profil`) ; une activité dont la capacité est `none` n'est jamais choisie.

## État actuel : le chat est branché
`CAT_PROFILE` (`modelProfile.ts`) est le profil actif ; `CAT_REALISTIC` (`pet.ts`) décrit son fichier, son échelle (0,55 m/unité) et ses chaînes de pattes. Les alias d'os sont dans `catRig.ts` (même clés que le renard, noms des 49 os Mesh2Motion), les clips Idle / Walk / Run dans `catClips.ts`, les sommets extrêmes et enveloppes dans `catHull.ts` et `catEnvelopes.ts` (générés).
Régénération : `node tools/extract-contacts.mjs assets/models/cat-rigged.glb src/config/catClips.ts --feet=Front_Leg_Tip_R,Front_Leg_Tip_L,Back_Leg_Tip_L,Back_Leg_Tip_R Walk Run` (renommer ensuite l'export en `CAT_CLIP_DATA` et importer `ClipLocomotionData` depuis `foxClips`), `node --import tsx tools/extract-hull.mts > src/config/catHull.ts`, `node --import tsx tools/extract-envelopes.mts > src/config/catEnvelopes.ts`.
Particularités : les seuils de vitesse de `animation.ts` et du diagnostic suivent les vitesses nominales du modèle (le chat marche à 0,30 m/s, le renard à 0,57) ; la vitesse nominale est stockée avec 4 décimales ; l'assise, le couché, le sommeil, la toilette et l'étirement sont procéduraux, réglés sur le chat dans le banc de pose.

## Passer à un chat (procédure générique)
1. Écrire `CAT_PROFILE` (même forme) et pointer `ACTIVE_PROFILE` dessus ; mettre à jour `PetModelConfig` (`config/pet.ts`) : fichier, échelle, noms de clips.
2. Si le chat fournit des clips assis / couché / sommeil / toilette / étirement : les déclarer (`capabilities.* = 'clip'`) et remplacer les `SEQUENCES` correspondantes par la lecture du clip (états, interruptions, sol et cadre inchangés). Sinon réutiliser les poses procédurales après réglage dans le banc de pose (`tools/lab/build.sh`).
3. Relancer : `node tools/inventory.mjs <glb>`, `tools/diagnose-clips.mjs`, `tools/extract-contacts.mjs`, `tools/extract-hull.mts`, `tools/extract-envelopes.mts`, puis `npm test` et le diagnostic des appuis.
4. Paupières / mâchoire / langue : déclarer la capacité et brancher la pose correspondante (clignements, yeux fermés, léchage).

## Assets candidats (recherche web, NON vérifiés, aucun remplacement automatique)
Le téléchargement et l'inspection de fichiers étaient bloqués par le réseau de la session (quaternius.com refusé). Résultats de recherche, à vérifier (licence, clips, rig) avant tout usage :
- Quaternius, [Ultimate Animated Animal Pack](https://quaternius.com/packs/ultimateanimatedanimals.html) : 12 animaux dont un chat, FBX/OBJ/Blend/glTF, CC0 annoncé, plus de 12 animations par animal (assis/couché/sommeil/toilette non confirmés).
- [Cat Rigged & Animated Low Poly](https://sketchfab.com/3d-models/cat-rigged-animated-low-poly-7510ec711d204b5788262c6d5eb678ed) (3D_Tech, Sketchfab) : armature quadrupède, 10 actions dont « sitting idle », marche, course, saut ; licence à vérifier.
- [Gobkit Free Animal Pack](https://gobkit.itch.io/gobkit-free-animal-pack) : 10 créatures low-poly CC0 en GLB (idle, attaque, mort, marche) ; chat non confirmé.
- [Rigged and animated Cat](https://blendswap.com/blend/18519) (BlendSwap) : CC-BY, poils dynamiques (Blender).
Aucun n'est présenté comme chat réaliste ; un modèle sans clips de repos/sommeil/toilette resterait en postures procédurales.
