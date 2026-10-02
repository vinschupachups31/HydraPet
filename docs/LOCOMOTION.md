# Déplacements autonomes, présence à l'écran, glissement des pieds

Stack inchangée (Expo + R3F, renard CC0/CC-BY). Tout le réglage est dans `src/config/` (`behavior.ts`, `animation.ts`, `camera.ts`, `pet.ts`, `turning.ts`, `foxClips.ts`).

## 1. Diagnostic (`npm run analyze`, `tools/diagnose-clips.mjs`, `tools/extract-contacts.mjs`)

| Constat | Mesure | Conséquence |
|---|---|---|
| Clips « sur place » (aucune translation de la racine) | Walk/Run : déplacement racine 0 | La vitesse au sol est entièrement à nous ; il faut la caler sur la cadence |
| Walk = **trot** (paires diagonales, appui 43 %), Run = galop | contacts par patte extraits (`foxClips.ts`) | Cadence et phases d'appui connues → IK conditionnelle possible |
| Vitesses nominales | Walk 122,8 u/s, Run 186,6 u/s (unités modèle, ×0,0046) ≈ 0,56 / 0,86 m/s | `playbackRate = vitesse réelle / nominale` |
| Pas de clip de pivot | — | Virage = petit arc en marchant + cadence ∝ ω |
| Glissement mesuré (marche rectiligne, hors IK) | ~24 % de la foulée | Cause : vitesse du corps ≠ vitesse du clip, et décalage de phase |
| Cadrage | caméra trop basse/éloignée, animal ~12 % de la hauteur | Cadrage résolu par bissection (§4) |

## 2. Architecture (un seul système commande la position)

```
BehaviorController (src/pet/behavior.ts)   activité + destination (états, POI, mémoire, approche)
        │ goTo / faceTowards / lookAt / stop
LocomotionController (src/pet/locomotor.ts + locomotion.ts)   déplacement, freinage, virages, collisions, vitesse réelle
        │ vitesse réelle (distance/dt), ω, pivot
AnimationController (src/pet/animation.ts + footIK.ts)   clips, poids, cadence, appuis, tête
```
Ordre par image (`Pet.tsx`) : comportement → locomotion → pose du parent → mixeur → matrices → IK pieds → tête/colonne (additifs) → matrices. Aucune correction n'est cumulée d'une image à l'autre. Le contrôleur de virage (`docs/TURNING.md`) est réutilisé tel quel.

## 3. Comportement
États : observer, choisir, marcher, examiner (seulement aux POI qui ont une cible de regard), repos (pause longue 8–20 s, seulement aux POI « repos »), venir vers l'utilisateur, réagir (toucher). Durées tirées une fois à l'entrée. 2–6 s d'observation après un trajet, jamais 3 trajets de suite, aucune animation annoncée qui n'existe pas (pas de flairage/toilettage).
8 points d'intérêt (tapis, devant canapé, centre, bords, deux zones proches de l'utilisateur) avec poids, rayon, cooldown ; ceux « relatifs à la vue » (`xn`) suivent la largeur visible (portrait/paysage). Mémoire des 3 dernières destinations pénalisées, ping-pong pénalisé, dernière destination exclue, trajet minimal 0,5 m, chemin vérifié avec marge de corps (canapé). Arrivée : rayon + hystérésis ; blocage : pas de progrès pendant 2,5 s → destination abandonnée, POI en repos 40 s. Un toucher interrompt proprement (freinage, pas de téléportation) puis l'autonomie reprend.
Approche : tous les 25–50 s (premier délai 18–40 s, 85 % de chances, silence 8 s après un toucher), marche vers un point devant la caméra, s'arrête, regarde 3–7 s (regard limité ±40°), repart.

## 4. Présence (`src/pet/framing.ts`)
Caméra fixe (aucun suivi/zoom), calculée par aspect : distance Z et inclinaison résolues ensemble pour que, au point d'approche, l'animal fasse **28 %** de la hauteur visible (cible 25–35 %), pattes à 74 % de l'écran, tête et queue dans le cadre ; FOV 43,6° portrait → 32° paysage. Modèle non redimensionné. Zones de profondeur fond/centre/avant pondérées (0,7/1/1). Mesuré dans le navigateur : portrait 27,7 %, paysage 27,4 % ; caméra identique sur toutes les images.

## 5. Glissement des pieds
- Vitesse réelle = distance horizontale / dt après freinage et collisions, légèrement lissée ; seuils démarrage/arrêt distincts (0,10 / 0,045 m/s) ; poids de marche qui descend plus vite qu'il ne monte → pas de clip de marche à l'arrêt.
- Seule la marche/course suit la cadence ; plage crédible 0,45–1,6 (marche) sinon bascule vers la course (seuils 0,74/0,66 m/s).
- IK conditionnelle : phases d'appui issues des métadonnées de clip, pose du pied fixée en coordonnées monde au toucher, enveloppe montée 0,12 s / descente 0,28 s, CCD limité (4 itérations, 0,55 rad/articulation, correction max 8,5 cm), horizontale seulement, relâchée avant le lever ou hors de portée, désactivée en pivot / |ω| > 1,6 rad/s, jamais les quatre pattes verrouillées.
- Mesure : hors ligne, glissement moyen par appui 24 % → 1 % de la foulée (`tools/measure-slip.mts`) ; navigateur (SwiftShader, 30 fps), IK activée : **0,3 cm en moyenne par appui, 1,1 cm max** (22 appuis).

## 6. Debug
Bouton « Infos » : état, durée restante, POI, zone de profondeur, vitesse demandée/réelle, clip + poids + playbackRate, état des appuis. « Superposition » : POI, chemin, rayon d'arrivée, points d'appui. « Gros plan » : caméra de développement (la caméra normale reste fixe). Hooks de test : `__HP_SEED__` (graine fixe), `__HP_PROBE__`, `__HP_API__`.

## 7. Validation
- `npm test` : 56 tests (framing, animation, IK, comportement, locomotion, virages), `tools/sim-autonomy.mts` (10 min simulées, 30 et 60 fps, portrait/paysage, graines 1/2/7) : ~45 trajets, 8 destinations distinctes, marche ≈ 27–30 % du temps, 0 chaînes de 3 trajets, observation 2–6 s après trajet, ~9 approches, pauses longues 8–20 s.
- Navigateur : marche rectiligne, arrêt complet (walk à 0 %), toucher en plein trajet → réaction puis reprise (saut max 2 cm entre images), but dans le canapé → « bloqué → destination abandonnée », 130 s d'autonomie : 13 trajets, 7 destinations, 2 approches, 25 % marche / 62 % arrêt.

## 8. Causes trouvées et limites
Causes : cadence non liée à la vitesse réelle ; pas d'ancrage des pieds ; destinations sans mémoire ni cooldown ; caméra trop lointaine ; deux bugs découverts en validation (départ au premier plan jugé « hors du sol » → plus aucun trajet ; hook React appelé après un `return` dans la superposition).
Limites : le renard est un trot (pas d'allure « pas ») ; pas de clip de pivot (arc de marche) ; IK horizontale uniquement et sans sol irrégulier ; le dernier test du navigateur utilise un rendu logiciel (30 fps) — à confirmer sur téléphone ; les « Infos » masquées par défaut pour ne pas cacher l'animal.
