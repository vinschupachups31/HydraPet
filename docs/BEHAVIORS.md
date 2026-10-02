# Comportements de chat (observation, assis, toilette, sommeil, réveil, étirement) et appuis

Stack inchangée (Expo + R3F), interactions, cadrage fixe, déplacements autonomes et virages conservés.

## 1. Inventaire réel du modèle (`node tools/inventory.mjs assets/models/fox.glb`)

- **Espèce : renard roux** (« Fox », PixelMannen CC0 ; rig et animations tomkranis CC-BY 4.0). Ce n'est **pas** un chat : il sert de stand-in ; les gestes de chat sont joués avec ce squelette.
- 1 maillage (1728 sommets, 576 triangles), **0 morph target**, 1 peau de **24 os**.
- Clips (tous **bouclés**, pose début = pose fin, aucune translation de la racine : « sur place ») :
  - Survey : 3.417 s, 20 os animés, canaux {"rotation":20,"translation":1}, écart pose début/fin 0.000 (bouclé)
  - Walk : 0.708 s, 20 os animés, canaux {"rotation":20,"translation":1}, écart pose début/fin 0.000 (bouclé)
  - Run : 1.158 s, 20 os animés, canaux {"rotation":20,"translation":1}, écart pose début/fin 0.000 (bouclé)
- Aucun clip de repos couché, assis, sommeil, réveil, étirement ou toilette. Survey = debout, regard qui balaie.
- Chaînes : racine → bassin (`b_Hip_01`) → colonne (2 os) → cou → tête ; 2 antérieurs de 3 os (bras, avant-bras, main) ; 2 postérieurs de 4 os (cuisse, jambe, pied, orteils) ; queue de 3 os.
- **Absents** : mâchoire, oreilles, paupières, yeux (os ou morph), langue. Les oreilles font partie du maillage de la tête et suivent la tête, rigides.
- Pose de liage : le renard est debout, pattes droites : elle sert de référence aux postures procédurales.

**Conséquence.** Tous les nouveaux comportements sont des **poses articulées procédurales** (`src/config/postures.ts`), composées de rotations d'os relatives au parent, jamais d'une rotation ou d'une échelle du modèle entier. Le modèle n'a pas de paupières : **les yeux ne se ferment pas** pendant le sommeil (le sommeil se lit par la posture, la tête abaissée, la queue enroulée et la respiration de la colonne). Il n'a ni langue ni mâchoire : le léchage est une **approximation tête + patte** (voir §5).

## 2. Appuis (diagnostic et correction)

Banc : `node --import tsx tools/slip-scenarios.mts [--svg out.svg]` (chaîne réelle locomotion → animation, 4 scénarios, trajectoires des 4 pattes en monde ; `docs/img/foot-trajectories.png` : appui = gros point, levée = trait fin).

| Scénario | IK non (sync. seule) | IK oui |
|---|---|---|
| marche droite | médiane 2,0 cm · max 3,6 | 0,8 cm · max 4,2 |
| freinage jusqu'à l'arrêt | 2,0 · 4,1 | 0,6 · 4,2 |
| virage à 90° | 2,8 · **15,8** | 1,4 · 8,2 |
| demi-tour | 2,6 · **14,5** | 0,6 · 4,2 |

Vérifié : clips **in-place** (pas de double translation), échelle 0,0046 m/unité, vitesse nominale (Walk 0,565 m/s) recalculée avec l'échelle, `playbackRate = vitesse réelle / nominale` sans toucher la vitesse du mixeur global (les postures ont leur propre horloge), hystérésis démarrage/arrêt (0,10 / 0,045 m/s), aucun clip de marche quand le corps est arrêté, aucune translation du corps pendant les postures.

Causes du glissement résiduel et corrections :
1. **Virages** : l'IK était coupée pendant la réorientation par petits pas (|ω| > 1,6 rad/s) → les pieds patinaient jusqu'à 16 cm. L'IK reste active pendant le pivot, et quand un pied dépasse sa portée (8,5 cm) il fait désormais un **vrai petit pas** (levée de 2 cm, 0,12 s, arc du point d'appui vers la pose animée) au lieu d'être relâché d'un coup (claquement à 2 m/s).
2. **Démarrage** : la correction attendait 60 % de poids de marche ; abaissée à 45 % (`ik.minLocomotionWeight`).
3. Reste : le premier appui après un démarrage à l'arrêt (4 cm, mélange repos→marche) et le début de pivot (≈ 8 cm sur un pied en 1 cas par virage à 90°).

## 3. Architecture

```
BehaviorController (behavior.ts)  activité, destination, intention en attente, observation à cibles
        │ goTo / stop / lookAt            │ request('sit'|'lie'|'sleep'|'stand') · stretch() · groom() · abortGroom() · nudge()
LocomotionController (locomotor.ts)   PostureController (posture.ts, logique pure)
        │ position, cap, vitesse réelle          │ pose « à plat » + poids de couche + pieds à tenir
AnimationController (animation.ts)  clips → pose procédurale (rig.ts) → sol → pieds tenus → contact toilette → IK marche → regard
```
Ordre par image : comportement → locomotion → postures → mixeur → matrices → `PoseRig.applyArray` (poids de couche) → matrices → **sol** (le bassin descend jusqu'au point le plus bas du maillage = 0) → **pieds tenus** (CCD plafonné) → **contact toilette** → regard (additif) → matrices. Rien ne s'accumule : le mixeur réécrit les os à chaque image. Un seul contrôleur déplace le parent ; en posture il n'a plus aucune destination. Pas de timer ni de callback : tout avance dans `update(dt)` (donc cohérent à 30 et 60 images/s, `dt` borné) et les changements d'état invalident naturellement l'état précédent.

### États (noms du projet ↔ noms demandés) — `STATE_SPECS` dans `src/config/activities.ts`
| Demandé | Projet | Entrée | Durée | Interruption | Sortie | Suivants | Cooldown (démo / prod) |
|---|---|---|---|---|---|---|---|
| StandingIdle | `rest` (pause longue) / `observe` | après trajet / activité | 8–20 s / 2–6 s | observe : immédiate ; rest : non | debout | observe, trajet | – |
| Walking | `walk` | destination accessible | jusqu'à l'arrivée | immédiate | debout | observe | POI |
| Observing | `observe` | arrêt complet | 2–6 s, 1–2 cibles | immédiate | debout | tout | – |
| SittingDown / SittingIdle / StandingUp | `sit` | immobile, cooldown, ≥ 1 trajet | maintien 6–12 s / 20–90 s | après la transition | debout | observe, réaction | 25 s / 120 s |
| Grooming | `groom` | comme assis | 8–18 s, 1–2 répétitions | **point sûr** (geste fini, patte reposée) | debout | observe, réaction | 30 s / 240 s |
| PreparingSleep / LyingDown / Sleeping | `sleep` | lieu libre ≥ 0,36 m (corps + queue), marche cumulée ≥ 12 s / 240 s | **20–60 s (démo) / 3–12 min (prod)**, tirée une fois | après la transition | debout | étirement, observe | 60 s / 20 min |
| WakingUp / StandingUp | `sleep` (phases wake → awake → rise) | fin du sommeil ou appel | réveil 2,8 s + éveil 1,5–3 s + 2 relevés | – | debout | stretch | – |
| Stretching | `stretch` | debout immobile, ou 75 % après réveil | 3,5 s | après la transition | debout | observe | 40 s / 600 s |

Politique de reprise : appel/caresse/ordre de test pendant une activité posturale = **intention en attente**, exécutée au point sûr ; un appel l'emporte sur une caresse ; plusieurs appels = une seule intention (le réveil ne redémarre pas) ; le corps ne marche qu'une fois debout. Un ordre forcé (« Forcer … ») utilise **les mêmes transitions** que l'autonomie.

## 4. Observation
Freinage → appuis stables → mise en place 0,4–0,9 s → 1 ou 2 cibles tirées une fois (caméra, meuble, bord de la pièce, point du sol ; la tête se relève pour la caméra, s'abaisse pour le sol) tenues 1–2,2 s → regard neutre. Regard limité à 85 % de la portée du cou (le corps ne pivote pas). Pas de mouvement d'oreilles ni de clignement (absents du modèle).

## 5. Postures, sommeil, réveil, étirement, toilette (`src/config/postures.ts`, `src/pet/posture.ts`, `src/pet/rig.ts`)
- Poses par **tangage/roulis/lacet d'os relatifs au parent** dans les axes du modèle ; mélanges **échelonnés** (arrière-train, avant, tête) pour les transitions ; sol résolu par les sommets extrêmes du maillage par os (`tools/extract-hull.mts`) : le corps ne traverse pas le sol et ne flotte pas (point bas −0,0…+0,1 cm sur tout le cycle, 30 et 60 images/s).
- **Assis** : bassin au sol, buste redressé, antérieurs verticaux **tenus en place** pendant l'assise et le relevé (0,7 cm de dérive). **Couché** : sphinx, poitrine au sol. **Sommeil** : tête baissée tournée vers le flanc, queue enroulée, respiration = tangage de colonne ±0,5° (jamais d'échelle), frémissements de queue rares (6–14 s), caresse = petit mouvement de tête.
- **Réveil** : la tête se soulève à peine, hésitation, tête levée, temps d'éveil couché, relevé par l'avant (couché → assis) puis par l'arrière (assis → debout), éventuel étirement. Aucune translation tant que la pose n'est pas debout.
- **Étirement** : « salut » (poitrine basse, antérieurs allongés, bassin haut), pieds arrière tenus, 3,5 s.
- **Toilette** : assis → patte avant droite levée → museau (repères : bout du museau et coussinet suivent les os en monde) → séries de 2–4 gestes irréguliers (0,26–0,44 s) → essuyage du visage → pause → 2–3 séries → patte reposée. Contact : la patte vient vers le museau (CCD plafonné) et la tête s'incline vers elle (plafonnée) ; distance patte↔museau mesurée **1,3–1,8 cm** (jamais < 1 cm : pas de traversée). **Approximation** : sans langue ni mâchoire, le léchage est un geste de tête + patte.
- Pas de léchage de flanc (torsion de colonne non crédible avec ce rig).

## 6. Intégration autonome et mode démonstration
Évaluation après une observation, jamais à chaque image : ordre sommeil → toilette → assis → étirement, chacun avec chance, cooldown, nombre de trajets minimal depuis la dernière activité posturale, et **jamais la même activité deux fois d'affilée**. Sommeil : marche cumulée suffisante, lieu de repos accessible (le renard le rejoint en marchant, puis s'installe). `ActivityConfig.mode` : `demo` (visible en quelques minutes) ou `production` (activités rares, sommeil de minutes) ; bouton « Mode » du panneau.

## 7. Outils de test (bouton « Infos » → panneau de développement)
Observer · Assis · Toilette · Sommeil · Étirement · Appeler (réveille) · Caresser · Autonomie · Mode démo/prod · Vitesse ×1/2/4 · Appuis IK · Superposition (POI, chemin, appuis tenus, museau et coussinet) · Profil (caméra de développement de côté, suit l'animal) · Gros plan. Affichage : état et phase, posture, temps restant, intention en attente, vitesse demandée/réelle, clip et poids, appuis, pieds tenus, distance patte↔museau.
Outils hors ligne : `tools/inventory.mjs`, `tools/slip-scenarios.mts`, `tools/audit-postures.mts`, `tools/sim-autonomy.mts`, banc de pose `tools/lab/build.sh` (+ pilotage Playwright).

## 8. Validation
Tests : `npm test` (80+ tests : postures, activités, interruptions, appuis, sol, contact toilette, autonomie 10 min, 30/60 images/s). Navigateur (rendu logiciel, ~30 images/s) : appel pendant la toilette (fin du geste, patte reposée, relevé, puis l'approche), appel pendant le sommeil (réveil complet sans redémarrage, relevé, puis l'approche), caresse pendant le sommeil (reste endormi, petite réaction), étirement, 170 s d'autonomie : étirement, 2 toilettes, assis, sommeil complet (36 s) puis réveil ; **0 image avec clip de marche pendant une posture**, caméra fixe.

## 9. Limites liées aux assets
- Renard, pas un chat : proportions, queue, museau et allure restent ceux d'un renard.
- Pas de paupières, d'oreilles, de mâchoire ni de langue : pas de clignements, pas d'yeux fermés, pas de mouvement d'oreilles, léchage approximé.
- Poses obtenues par rotations d'os d'un rig minimal (une seule tête, 3 os de patte avant) : postures crédibles mais moins fines qu'un clip d'animateur (pas de clavicule : l'épaule ne « roule » pas ; pas de pattes arrière à orteils articulés).
- Hanche/colonne : le corps couché est une pose symétrique ventre au sol (pas de couchage sur le flanc).
- Pour un résultat « chat réaliste » : un modèle de chat avec clips assis/couché/sommeil/toilette (ou, à défaut, paupières/oreilles/mâchoire dans le rig) remplacerait directement `POSES`/`SEQUENCES` ; le contrôleur d'états, les interruptions et le sol sont indépendants du modèle.
