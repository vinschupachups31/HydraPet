# Brancher un vrai chat ou chien

Je n'ai pas pu télécharger d'animal d'ici (Sketchfab, Quaternius, Poly Pizza et Fab sont bloqués dans mon environnement). Voici ce qu'il faut faire à la main.

## 1. Télécharger un modèle
Chercher un **GLB riggé avec animations** (repos, marche, idéalement course) :
- **Poly Pizza** (poly.pizza) et **Quaternius** (quaternius.com) : modèles animés, souvent **CC0**, mais en style low-poly.
- **Sketchfab** : filtres *Downloadable* + *Animated* + licence **CC0** ou **CC BY** ; format glTF/GLB.
- **Fab / Unity Asset Store** : modèles réalistes avec poils et animations, mais **payants** (budget nul = pas accessible).

**Vérifier séparément** la licence du modèle, des textures et des animations (auteurs parfois différents), et noter : lien, auteur, licence, attribution. Une page téléchargeable n'est pas une licence de redistribution.

## 2. Placer le fichier
```
assets/models/chat.glb
```
(nom libre ; un GLB unique, textures intégrées)

## 3. Mesurer le modèle
```bash
npm run analyze -- assets/models/chat.glb
```
Donne : triangles, os, noms exacts des clips, axe « avant », vitesse de marche. Si les os des pattes ne sont pas détectés : `--feet=os1,os2,os3,os4 --head=os`.

## 4. Déclarer l'animal
Dans `src/config/pet.ts`, copier `FOX_STANDIN` et adapter : `scale` (mètres par unité), `yawOffset` (si le modèle ne regarde pas vers +Z), `clips` (noms **exacts** repos / marche / course), `groundSpeed` (unités/s mesurées), `headBone`, `footBones`.

Dans `src/pet/models.ts`, ajouter l'entrée (le `require` doit être un chemin **statique**), puis `ACTIVE_MODEL = MODELS.chat`.

Sans clip de course : mettre le clip de marche pour `run`.

## 5. Vérifier
`npm test && npx expo start`, puis regarder : démarche, glissement des pattes, demi-tours, contacts avec le sol.
