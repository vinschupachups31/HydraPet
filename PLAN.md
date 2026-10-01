# HydraPet — plan MVP

## Décisions
- **Nom** : HydraPet · **Public** : tout public · **Plateformes** : Android + iPhone, publication sur les stores.
- **Objectif utilisateur** : boire assez chaque jour grâce à un rappel, et jouer avec un animal virtuel personnalisé.
- **Plus tard** : gamification (séries, récompenses, accessoires). On garde dès maintenant l'historique complet de chaque verre pour pouvoir l'ajouter sans refaire la base.
- **Priorité n°1** : un animal vivant et une animation soignée (c'est le cœur émotionnel).
- **Stack** : le prototype web actuel (HTML/CSS/JS + SVG) emballé avec **Capacitor** (caméra, notifications locales), données locales uniquement.

## Concept
Un compagnon cartoon (ton chien ou ton chat, scanné en photo) vit dans ta pièce ; son humeur dépend de ce que tu as bu aujourd'hui.

## Utilisateur
Tout public : une personne qui oublie de boire, avec ou sans animal (le compagnon est virtuel, on choisit chien ou chat). Interface lisible, gros boutons, bon contraste.

## 3 frustrations
1. J'oublie de boire jusqu'à avoir soif ou mal à la tête.
2. Les compteurs d'eau sont froids, ennuyeux : je les abandonne.
3. Boire ne donne aucune récompense visible.

## Valeur
On n'ouvre pas l'appli « pour boire » mais pour retrouver son compagnon ; boire est le geste qui le rend heureux, en 1 tap.

## 5 fonctions du MVP
1. Profil → objectif en ml (≈ 33 ml/kg, ajusté taille/activité), modifiable.
2. Saisie en 1 tap (+150 / +250 / +500 / autre), annuler, jauge du jour.
3. Compagnon personnalisé par photo (animal + pièce), couleurs ajustables à la main.
4. Compagnon vivant : 180 poses, déplacements, caresses, jouet rapporté, humeur liée à l'hydratation.
5. Rappels locaux fiables (jamais la nuit, rien si l'objectif est atteint).

## À éviter en v1
Comptes/cloud, social/classements, IA générative ou 3D, plusieurs animaux, boutique/monnaie, Apple Santé/Wear, calcul « médical » poussé.
(La gamification est prévue, mais après la bêta.)

## Parcours
Profil (20 s) → choix chien/chat → photo animal → photo pièce → l'animal accueille → +250 ml → il est content → rappel à 11 h → un tap → fête à l'objectif.

## Feuille de route 7 jours
| Jour | Objectif |
|---|---|
| 1 | Tester sur 2 vrais téléphones, corriger les défauts ; mesurer la fluidité sur un appareil d'entrée de gamme |
| 2 | **Animation** : affiner le style et les mouvements (références de l'équipe), anticipation / rebond / respiration |
| 3 | Capacitor : build Android et iOS installables |
| 4 | Notifications locales + permissions photo/notification, rappels app fermée |
| 5 | Onboarding final, textes, cas d'erreur, accessibilité (gros boutons, contraste, réduction des animations) |
| 6 | Bêta : 5 à 10 testeurs (Play interne, TestFlight), mesurer le retour au jour 3 et 7 |
| 7 | Corrections, politique de confidentialité, captures et fiche store, soumission |

Comptes nécessaires : Google Play (≈ 25 € une fois), Apple Developer (99 $/an).

## Risques et parades
| Risque | Parade |
|---|---|
| Scan photo décevant | réglages de couleurs manuels, ne pas promettre une copie parfaite |
| Lassitude après quelques jours | variété des comportements, humeurs ; préparer la gamification |
| Rappels agaçants ou ignorés | max 1 par 90 min, silence la nuit, rien si objectif atteint ; notifications natives |
| Santé : objectif jugé « médical » | formulation indicative, bornes 1 200–5 000 ml, aucune promesse de bénéfice santé |
| Tout public / mineurs | aucune donnée personnelle collectée, photos traitées sur l'appareil, pas de compte, pas de pub ciblée ; politique de confidentialité claire |
| Refus par les stores | parcours complet, captures soignées, politique de confidentialité en ligne |
| Animation lente sur vieux téléphones | limiter les éléments animés, tester dès le jour 1, option « réduire les animations » |
| Dérive du périmètre | tout ce qui est hors MVP va dans une liste v2 |
