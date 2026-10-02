# Appuis, cadre, couchage, toilette — corrections et mesures

Stack, interactions, pauses autonomes, comportements et virages conservés. Modèle : renard roux (support technique, pas un chat) — voir `docs/MODEL_PROFILE.md`.

## 1. Diagnostic reproductible des appuis
- **En application** (bouton « Infos » → ligne « Droite / Freinage / Courbe 90° / Demi-tour / Marche-repos ») : suspend toute décision autonome, active la caméra de profil de développement (la caméra de jeu reste fixe) et la superposition, exécute le scénario scripté (`src/pet/diagnostic.ts`) et affiche : vitesse demandée / réelle, clip actif, poids, vitesse de lecture, vitesse angulaire, phase de chaque patte (appui / levée / non identifiable), pieds tenus, compte rendu.
- **Trajectoires des contacts en monde** : vert = appui, bleu = levée, rouge = appui au-delà du seuil (`docs/img/foot-trajectories.png`, et points 3D dans l'application).
- **Seuil** : 4 % de la longueur du corps (0,40 m) = **1,6 cm** (unités monde). Seuls les appuis identifiés par les métadonnées du clip sont mesurés ; un pied nettement soulevé (> 1,2 cm au-dessus de son sol) n'est pas compté (`src/pet/contactMetrics.ts`).
- **Trois classes** : longitudinal (cadence incompatible avec la translation), latéral (le corps tourne pendant l'appui : |ω̄| > 0,25 rad/s), à l'arrêt (corps arrêté : translation résiduelle ou transition d'animation incorrecte).
- **Hors ligne** : `node --import tsx tools/slip-scenarios.mts [--noik] [--fps 30] [--worst] [--svg f.svg]` ; tests `tests/slip.test.ts` (60 et 30 images/s).

| Scénario | appuis > seuil, sync. seule | IK, 60 i/s | IK, 30 i/s | longitudinal méd./max (cm) | latéral méd./max (cm) | à l'arrêt max (cm) |
|---|---|---|---|---|---|---|
| Marche droite à vitesse constante | 8/21 | 0/21 | 0/21 | 0.3 / 1.5 | 0.0 / 0.0 | 0.0 |
| Accélération puis freinage jusqu'à l'arrêt | 6/16 | 1/16 | 1/16 | 0.8 / 2.0 | 0.0 / 0.0 | 0.0 |
| Courbe à 90° | 11/23 | 3/21 | 1/19 | 0.5 / 8.0 | 0.6 / 2.0 | 0.0 |
| Demi-tour | 22/42 | 5/37 | 3/32 | 0.4 / 2.2 | 1.6 / 3.1 | 0.0 |
| Marche → repos → marche | 23/40 | 3/34 | 3/36 | 0.3 / 2.2 | 0.5 / 6.0 | 0.2 |

(« > seuil » = nombre d'appuis dépassant 1,6 cm / appuis mesurés.)

### Inspection du clip et des transformations
Clips Walk/Run **in-place** (aucune translation de racine : la locomotion est le seul système qui déplace le parent, pas de double translation) ; échelle 0,0046 m/unité ; axes +z avant, +y haut, +x gauche ; Walk = trot (appui 43 %), Run = galop ; vitesse nominale Walk 0,565 m/s après échelle ; cadence = vitesse réelle / nominale (plage 0,45–1,6), hystérésis démarrage/arrêt 0,10 / 0,045 m/s ; aucune cadence appliquée aux postures (sommeil, toilette ont leur horloge). Blocage : le corps et la marche s'arrêtent ensemble (test `blocage`).

### Causes trouvées et corrections (mesurées)
1. **Glissement latéral des virages** (jusqu'à 15 cm) : après un petit pas de rattrapage, le pied était relâché et suivait l'arc du corps. Il est maintenant **replanté** à son nouvel endroit (il tient, ou refait un pas).
2. **Glissement à l'arrêt** (jusqu'à 7 cm au passage marche → repos) : les pieds posés gardent leur point de contact en monde (IK « tenue au repos », portée 12 cm) ; la tenue passe sans saut à la marche. Maximum 0,2 cm.
3. **Mesure** : les pieds soulevés (pas de rattrapage) ne comptent plus comme appui.
4. Reste (honnête) : premier pas depuis l'arrêt et entrée d'un arc : quelques appuis isolés de 2–8 cm ; marche rectiligne régulière : 0 appui > seuil.

## 2. Cadre : zone sûre (`src/pet/frameGuard.ts`)
- Zone sûre en coordonnées écran normalisées : marges latérales **6 %**, haut 6 %, bas utile 80 % (portrait) / 66 % (paysage) pour les commandes, rectangle du bouton « Menu » exclu (`DEFAULT_SAFE_ZONE`).
- **Enveloppes conservatrices par pose** (marche, debout tête tournée à ±50°, assis, toilette, couché, endormi, étirement) : 14–24 sommets extrêmes du maillage (`tools/extract-envelopes.mts`), projetés dans le cadre ; jamais de boîte englobante du maillage skinné par image.
- Chaque destination est refusée si, **à l'arrivée au cap du trajet et pivoté de ±90°**, tête, queue ou pattes sortent de la zone ; le **chemin** est échantillonné tous les 12 cm. Activités (assis, toilette, sommeil, étirement) : la pose complète est vérifiée avant de commencer (16 caps testés) ; sinon trajet vers une zone adaptée, puis **virage** vers le cap qui tient dans le cadre avant de s'asseoir/coucher. Toilette : z ≥ 0,45 m (assez près de la caméra pour être lisible).
- Déjà hors de la zone : retour par une marche normale (point valide le plus proche), sans téléportation, masquage ni mouvement de caméra. L'approche vers la caméra et la réaction restent volontaires.
- Mesure (tests `cadre`) : 10 min d'autonomie, 3 graines en portrait + 2 en paysage : **moins de 0,2 % d'images coupées** (hors approche volontaire et trajets correctifs) ; destinations distinctes : 4–8 en portrait (écran étroit), 7 en paysage.

## 3. Couchage, sommeil, réveil (pose recroquevillée conservée)
Audit `node --import tsx tools/audit-transitions.mts` : vitesse maximale d'un point du maillage ≤ 1,2 m/s sur toutes les transitions (aucun saut) ; sol −0,1…+0,1 cm sur tout le cycle (deuxième passe anti-pénétration après les contraintes) ; **dérive après 6 cycles sommeil + étirement + toilette : 0,5 cm** (aucune accumulation), parent immobile. Pieds : antérieurs tenus pendant l'assise et le relevé (0,7 cm) ; postérieurs : glissement défini par la pose de 7–8 cm à l'assise et au couchage, antérieurs +8 cm en se couchant (pose « sphinx »). Respiration : tangage de colonne ±0,5–1,1°, frémissements de queue rares (6–14 s), jamais d'échelle. Yeux : **pas de paupières dans le modèle → les yeux ne se ferment pas**.

## 4. Toilette (révision : assise basse, transfert de poids, gestes variés)

**Cause de la posture trop haute.** Diagnostic (`tests/groom.test.ts`, test « diagnostic ») : aucun clip debout ne restait mélangé (poids de pose 1,0), aucune contrainte de marche n'était active, et le bassin, les cuisses et les jarrets étaient bien animés. La cause était la pose procédurale elle-même : hanche à −40° (colonne quasi verticale, humanoïde), antérieurs à +40° vers l'avant (épaule haute) et, pendant le geste, une tête qui descendait de ~20° vers une patte restée trop basse. Problème de pose, pas limite du rig.

**Corrections.**
- Assise de référence refaite (`POSES.sit`, réglée dans le banc de pose) : hanche −30°, cuisses −28°, jarrets 84°, antérieurs presque verticaux (36°/−6°/8°) devant le thorax, tête baissée de 20°, queue rabattue sur le côté. Hauteur de l'enveloppe assise 42 → 39 cm ; la toilette part de cette assise (aucune remontée du corps).
- Repositionnement des pieds pendant l'assise, le couchage et le relevé : chaque pied tenu est relâché, soulevé (2,5 cm, 4 cm pour les antérieurs), déplacé vers sa place dans la pose puis reposé (`steps` dans `SEQUENCES`), au lieu d'être traîné ; jamais les quatre tenus en même temps. Glissement d'un pied **au sol** : 7,5 → ≤ 0,4 cm par image, ≤ 5,8 cm cumulés sur les phases en l'air comprises (mesure `tools/audit-transitions.mts`).
- Séquence (`PostureController.startGroom`, durées/amplitudes tirées une fois à l'entrée de chaque phase ou geste) : installation 0,8–1,2 s → pause 0,4–1 s → transfert de poids (colonne −4°/−3° de roulis, antérieur porteur étendu) 0,45–0,6 s → levée épaule/coude/carpe 0,7–0,95 s → 2 séries de 2–4 petits gestes (0,35–0,65 s, amplitude 0,6–1,15, lacet de tête ±3°) → 1 passage courbe museau → joue → base de l'oreille → joue → museau (0,34–0,5 s par tronçon, un second passage une fois sur deux) → pause 0,5–1,2 s → patte éloignée (0,4–0,55 s), posée au sol (0,5–0,7 s), contact confirmé 0,25 s, thorax recentré, observation 0,6–1 s, retour à l'assise → relevé. Poses museau/joue/oreille obtenues par optimisation (banc de pose, écart 2 cm) ; côté de la patte = côté tourné vers la caméra, conservé toute la séquence.
- Contact : distance de sécurité de 1,8 cm maintenue dans les deux sens (la patte est repoussée si elle pénètre) ; tête inclinée de 6° seulement (la patte fait le mouvement : épaule 25°+).
- Interruption : intention enregistrée, fin du geste au point sûr, repose complète (même séquence que la fin normale), relevé, puis réponse ; les appels suivants n'en redémarrent rien.

**Mesures** (navigateur, 5 répétitions, graine 11) : durée 12,6–17,3 s ; patte↔visage 1,7–1,8 cm au minimum ; déplacement du parent 0,00 cm ; clip de marche 0,00. Hors ligne : tête ≤ 13° d'écart à l'assise, antérieur porteur < 2 cm, postérieurs < 3 cm, dérive après 6 cycles 0,76 cm, sol −0,1…0 cm.

## 5. Outils de démonstration
Panneau « Infos » : Observer · Assis · Toilette · Sommeil · Étirement · Appeler · Caresser · Autonomie · Mode démo/prod · Vitesse · 5 diagnostics · Profil · 3/4 · Gros plan · Superposition (POI, chemin, appuis tenus, museau/coussinet, trajectoires colorées). Les commandes forcées empruntent les vraies transitions.

## 6. Limites
- Premier appui après le démarrage et entrée d'arc : jusqu'à 2–8 cm sur un appui. Pas de clip de pivot (arc marché + pas de rattrapage).
- Postérieurs : glissement défini par la pose (7–8 cm) à l'assise et au couchage ; pas de clavicule.
- Pas de paupières / oreilles / mâchoire / langue : yeux ouverts pendant le sommeil, léchage approximé.
- Rendu mesuré en logiciel (~15–30 images/s) ; non testé sur téléphone.
- En portrait, la zone sûre exclut les bords : 4–8 destinations distinctes sur 10 min.
