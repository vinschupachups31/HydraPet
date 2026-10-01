# HydraPet 💧🐾

Suis ton hydratation avec un compagnon cartoon (chien ou chat) qui vit dans ta pièce.

## Fonctionnement
1. **Profil** : poids, taille, activité → besoin quotidien en eau (≈ 33 ml/kg, ajusté selon la taille et l'activité ; estimation indicative, pas un avis médical).
2. **Scan de l'animal** : photo → couleurs extraites sur l'appareil → cartoon SVG (couleurs modifiables).
3. **Scan de la pièce** : photo → palette → pièce cartoon 2D.
4. **Écran principal** : l'animal vit sa vie dans la pièce (marche, court, dort, saute sur le canapé, boit à sa gamelle…), se laisse caresser, rapporte le jouet lancé. Son humeur suit ton hydratation.

**180 poses** : 36 poses de base × 5 humeurs, interpolées en douceur. Galerie : `index.html#/poses`.

## Lancer
Aucune installation : ouvre `index.html` dans un navigateur. Sur téléphone, « Scanner » ouvre l'appareil photo.
Les photos ne quittent jamais l'appareil ; les données sont dans le `localStorage`.

## Tests
```bash
node tests/run.js   # logique : besoin en eau, historique, poses, couleurs
```

## Structure
```
index.html, style.css
js/store.js    état, calcul du besoin, historique, humeur
js/colors.js   extraction de couleurs (k-means) depuis une photo
js/poses.js    bibliothèque de 180 poses
js/pet.js      rendu SVG de l'animal (chien / chat)
js/room.js     pièce cartoon générée depuis la palette
js/world.js    boucle de vie : comportements, jouet, caresses, particules
js/app.js      écrans, hydratation, historique, réglages
```
