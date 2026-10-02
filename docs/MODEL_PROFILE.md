# Profil de modèle : préparer le remplacement du renard par un chat

Tout ce qui dépend de l'asset est dans `src/config/modelProfile.ts` (`ModelProfile`) : espèce réelle, licence, échelle et axes, longueur du corps, clips sémantiques (idle / walk / run) et vitesses nominales extraites, alias d'os (`foxRig.ts`), pattes avant, points de contact du visage (museau, joue, oreille), sommets extrêmes par os (`foxHull.ts`), enveloppes par pose (`foxEnvelopes.ts`), **capacités déclarées** (paupières, mâchoire, langue, oreilles, clip de pivot ; assis, couché, sommeil, toilette, étirement : `clip` | `procedural` | `none`). Aucun nom d'os n'apparaît dans `src/pet/` (test `profil`) ; une activité dont la capacité est `none` n'est jamais choisie.

## Passer à un chat
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
