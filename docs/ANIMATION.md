# Animation dans HydraPet — qui fait quoi

| Élément | Outil | Pourquoi |
|---|---|---|
| **L'animal** (couleurs de la photo, 180 poses, caresses, jouet) | Moteur SVG maison (`js/pet.js`, `js/poses.js`, `js/world.js`) | Il doit réagir en direct et porter les couleurs de l'animal de l'utilisateur : un clip précalculé ne le permet pas |
| **Effets** (confettis de fin d'objectif, éclaboussure d'eau) | **Lottie** (`lottie-web`, MIT, dans `js/vendor/`) | Fichiers vectoriels légers, remplaçables par un designer |
| **Micro-interactions** (boutons, compteur, bulle, transitions d'écran, démarrage, bienvenue) | **CSS** (animations à courbes précises, comme on le ferait dans Figmotion) | Aucune dépendance, très léger, désactivable |
| Conception de transitions complexes (optionnel) | **Jitter** → export Lottie | Un designer y crée l'animation, on dépose le `.json` |
| Bibliothèque d'animations toutes faites (optionnel) | **LottieFiles** | Source de fichiers `.json` / `.lottie`, **licence à vérifier pour chaque fichier** avant publication |
| Vidéo de promo des stores (plus tard) | **HyperFrames** | Génère des MP4 depuis du HTML, pas utilisable pour l'animal interactif |
| Animal dessiné à la main, plus expressif (plus tard, si besoin) | **Rive** | Machines à états pour personnages interactifs |
| Anima | Non utilisé | Convertit une maquette Figma en code : nous n'avons pas de maquette Figma et notre code est déjà du HTML/CSS/JS |

## Ajouter ou remplacer un effet Lottie
1. Déposer le fichier `.json` dans `assets/lottie/` (le nom du fichier est le nom de l'effet : `confetti.json`, `water.json`…).
2. `node scripts/build-lottie-assets.js` : regroupe les fichiers dans `assets/lottie/lottie-data.js` (nécessaire pour que l'app fonctionne aussi en double-clic, où `fetch()` est interdit).
3. Jouer l'effet depuis le code : `HP.fx.play('nom', conteneur, { className, fit, maxMs })`. Renvoie `false` si l'animation est absente ou si l'utilisateur a demandé moins d'animations : on utilise alors l'effet de secours.
4. `node tests/run.js` vérifie la structure, la durée et le poids.

`node scripts/make-lottie.js` régénère nos deux effets d'origine (confettis, éclaboussure) : ils sont créés par le projet, sans licence tierce.

## Règles
- **Poids** : moins de 100 Ko par animation, 6 s maximum (vérifié par les tests).
- **Accessibilité** : avec « réduire les animations » activé dans le système, les effets Lottie ne se lancent pas, les animations CSS sont coupées et le compteur s'affiche directement.
- **Performance** : les animations Lottie sont jouées une fois puis détruites ; on les teste sur un téléphone d'entrée de gamme avant publication.
- **Licences** : toute animation tirée de LottieFiles ou d'ailleurs doit avoir sa licence notée ici avant d'être ajoutée.

| Fichier | Origine | Licence |
|---|---|---|
| `confetti.json`, `water.json` | Générés par `scripts/make-lottie.js` | Propres au projet |
| `js/vendor/lottie-light.min.js` | lottie-web 5.13.0 (Airbnb / LottieFiles) | MIT (voir `js/vendor/LICENSE-lottie-web.md`) |
