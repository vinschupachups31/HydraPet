# Virages de l'animal

## Diagnostic (avant)
| Symptôme | Cause constatée dans le code |
|---|---|
| Rotation « robotique » | Le cap était modifié par `clamp(erreur, ±ω·dt)` : la vitesse angulaire passait de 0 à son maximum en une image, restait **constante**, puis retombait à 0 d'un coup (accélérations mesurées : 1 000 à 3 500 °/s², 115 °/s atteints en 100 ms). |
| Demi-tour sur place | Rotation à 115 °/s constants avec une animation de marche à cadence **fixe** (×0,55) : les pas n'avaient aucun rapport avec la rotation. |
| Corps d'un seul bloc | Aucun mouvement de tête, de cou ni d'épaules ; `rotation.y` en angle d'Euler. |
| Tremblement possible à l'arrivée | Cap recalculé à chaque image vers un point tout proche, sans zone morte. |
| Pas de clip de pivot | Le renard n'a que Survey, Walk, Run. |

Écarté : un changement brutal de cible (le cerveau ne choisit une direction qu'au changement d'état) ; le décalage cadence/vitesse en marche (déjà calé).

## Contrôleur (après), `src/pet/locomotion.ts`
- **Trois notions séparées** : orientation souhaitée (`desiredYaw`), orientation réelle (quaternion `q`), direction du déplacement (l'avant du corps).
- **Écart signé le plus court** entre quaternions, dans [-π, π] ; sens de virage engagé près de ±180° (pas de bascule de côté).
- **Vitesse angulaire lissée** : accélération angulaire plafonnée *et* variation de cette accélération plafonnée (jerk), avec un profil de freinage qui tient compte du retard de réponse (pas de dépassement du cap).
- **Courbure couplée à la vitesse** : plus l'écart est grand, plus l'animal ralentit ; à faible vitesse la rotation maximale est plus petite, donc un virage serré dure plus longtemps.
- **Demi-tour** : freinage, puis phase `reorient` (petit arc de marche à 0,07 m/s, cadence des pas proportionnelle à la vitesse angulaire), puis redémarrage progressif.
- **Zone morte (2°) + hystérésis (5°)** près de la cible ou à l'arrêt ; direction figée à moins de 22 cm de la cible.
- **Temps** : pas plafonné à 0,1 s et découpé en sous-pas de 1/60 s.
- **Regard** : la tête et le cou visent la direction souhaitée (≈ 90 ms pour la moitié de leur course, limite 38°), les épaules suivent plus tard et moins loin (limite 14°). Appliqué **après** `mixer.update`, recalculé à chaque image à partir de la pose animée : rien ne s'accumule.
- Non implémenté : inclinaison du corps (facultative, écartée pour ne pas donner un effet de véhicule).

## Régler les virages
Tous les paramètres sont dans `src/config/turning.ts` (valeurs par défaut) et peuvent être surchargés par animal dans `src/config/pet.ts` (`turn: { ... }`). Sur l'écran de test, la ligne « virage » affiche la phase, la vitesse angulaire et l'angle de tête.

| Paramètre | Effet | Défaut |
|---|---|---|
| `maxTurnRate` / `slowTurnRate` | rotation max en marche / à très faible vitesse (rad/s) | 2,6 / 0,9 |
| `turnAccel`, `turnJerk`, `turnResponse` | douceur du départ et de l'arrêt de la rotation | 7 rad/s², 45 rad/s³, 0,14 s |
| `slowStartDeg`, `slowEndDeg`, `minSpeedFactor` | ralentissement dans les virages | 20°, 100°, 0,28 |
| `uTurnDeg` | au-delà : freinage complet puis réorientation | 135° |
| `reorientEnterDeg`, `reorientExitDeg`, `reorientRate`, `reorientCreep` | réorientation par petits pas | 55°, 22°, 2,1 rad/s, 0,07 m/s |
| `deadZoneDeg`, `hysteresisDeg`, `holdRadius` | zone morte, hystérésis, rayon de gel de la direction | 2°, 5°, 0,22 m |
| `gazeLeadMs`, `headLimitDeg`, `spineLagMs`, `spineLimitDeg` | anticipation de la tête, limites, retard des épaules | 150 ms, 38°, 260 ms, 14° |

Pour un autre animal : renseigner `headBones` et `spineBones` (noms d'os) dans sa configuration, comme pour le renard.
