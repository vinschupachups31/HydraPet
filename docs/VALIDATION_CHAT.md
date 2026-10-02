# Validation du chat : contacts au sol, postures, virages

Ce document rend compte des corrections faites après la vidéo d'essai du chat (branche `expo-r3f-spike`). Les tests automatiques complètent les observations visuelles : ils ne prouvent pas le naturel d'un mouvement.

## Causes identifiées (avec la mesure qui les confirme)
| Symptôme | Cause | Confirmation |
|---|---|---|
| Chat assis ou couché « suspendu » au-dessus de son ombre | Le calage du sol utilisait un hull rigide (sommets extrêmes suivant un seul os). Aux articulations, la peau mélange jusqu'à 4 os : l'écart atteignait 2,8 cm (assis) et 1,3 cm (couché). | `tools/cat/groundcheck.mts` : point bas du hull 0,00 cm, point bas du maillage skinné 2,78 cm. Maintenant : écart 0,00 cm dans tous les états. |
| Postérieurs suspendus, assise peu lisible | La pose assise venait du renard : les semelles arrière restaient à 6,7 cm du sol (couché : 7 à 8,5 cm). | `tools/cat/transitions.mts` (hauteur des quatre dessous de patte). Après réglage dans le banc : 1 à 2 cm. |
| Pédalage / pied qui s'enfonce en marche | Le clip Walk (Mesh2Motion) a la patte arrière droite 50 % plus rapide que la gauche ; aucune correction de pénétration pendant la marche (jusqu'à 2,7 cm). | Pistes de mouvement des quatre pieds ; Walk symétrisé (`tools/cat/symmetrize-walk.mts`) ; pénétration du maillage en marche 0,00 cm. |
| Virages : glissement latéral médian 4 à 5 cm | Seuil de repositionnement du pied trop large (8,5 cm). | Réglé à 5 cm : médiane 0,2 cm, maximum 4,2 cm. |
| Diagnostic faussé | Les pas de repositionnement (pied levé de 2 cm) étaient comptés comme des glissements de 16 cm. | Phase « levée » pendant un pas explicite ; les vrais glissements restent comptés. |
| Seuils de vitesse du renard | Démarrage, arrêt et course de l'animation suivaient la marche du renard (0,57 m/s) ; le chat marche à 0,30 m/s. | Seuils relatifs aux vitesses nominales (4 décimales). |
| Queue dressée dans toutes les postures | L'alias de queue pointait sur `Tail_Base` : la courbure est portée par `Tail_Mid`. | Rendus avant/après dans le banc de pose. |
| Pieds masqués par les commandes à l'approche | Pieds visés à 74 % de la hauteur d'écran, au niveau des rangées de commandes du prototype. | Capture vidéo ; remonté à 68 %. |

Non confirmé : le repli de l'arrière-train « vers 14–16 s » pendant un virage n'a pas été reproduit. Sur le scénario de demi-tour, le bassin reste entre 0,380 et 0,394 u, les segments gardent leur longueur au millième et rien ne change d'échelle (`tools/cat/shape.mts`). Si le défaut revient, utiliser le bouton « Couches » (ci-dessous) pour isoler la couche fautive.

## Modifications
- `PoseRig` : hull **skinné** (indices de sommets, position exacte avec les 4 poids de peau) ; `groundSolve` accepte un mode « pénétration seulement » utilisé pendant la marche.
- `FootIK` : point d'appui **sous la patte** (offset par pied dans le profil, calibré par `tools/cat/soles.mts`), hauteur ramenée au sol pendant l'appui (`groundLock`, plafonnée à 3 cm), repositionnement à 5 cm.
- Profil du chat : alias de queue, vitesses nominales précises, hull, enveloppes régénérés.
- Postures : assise et toilette (semelles arrière au sol), couché éveillé en position de sphinx, sommeil distinct (tête reposée, queue enroulée), queue adaptée à chaque posture, respiration légère du thorax pendant le sommeil (0,9°, sans mise à l'échelle), frémissements d'oreilles.
- Diagnostic : bouton « Couches » (complet / sans IK / clip + déplacement / clip seul) et `__HP_API__.layers(mode)` ; contact mesuré par la géométrie, avec flottement (orange) et pénétration (violet) en plus des couleurs existantes ; compte rendu « appuis : flottent N (max X cm), enfoncés N (max X cm) ».

## Mesures obtenues (60 images/s, après le pipeline final)
- Marche droite : glissement longitudinal max 1,1 cm, 0 appui au-dessus du seuil de 1,6 cm.
- Virages et demi-tour : glissement latéral médian 0,2 cm, maximum 4,2 à 4,4 cm, 3 à 4 appuis au-dessus du seuil par scénario.
- Pénétration du sol pendant l'appui : 0 image dans les 5 scénarios, à 30 et 60 images/s.
- Flottement (> 1 cm) : 2 à 6 % des images d'appui, maximum 1,4 cm.
- Postures tenues : dessous de patte entre 0,8 et 2 cm du sol ; point bas du corps égal au point bas du maillage.

## Défauts encore visibles ou non traités
- Virages serrés : jusqu'à 4 cm de glissement latéral, et les pas de repositionnement sont plus fréquents.
- Transitions : pendant l'allongement (couché), les antérieurs montent à 7–8 cm avant de se poser. Les séquences gardent des interpolations d'angles par groupes (arrière, avant, tête) ; elles n'ont pas été refaites en phases de transfert de poids.
- Étirement : pénétration de 0,7 cm des antérieurs au pic ; l'allongement des bras vient de l'angle d'épaule, non revérifié visuellement.
- Marche lente (0,30 m/s) et clip Walk de Mesh2Motion peu bouclable (fin ≠ début).
- Yeux peints : pas de paupières ; le sommeil se lit par la tête, la queue et la respiration.
- Queue : un seul pli doux ; plus de −60° de pitch fait apparaître un pincement de peau (poids de peau de la queue à reprendre).
- Intention des déplacements autonomes et anticipation du regard avant un virage : non retouchées.
- Le rendu logiciel de mon navigateur de test (≈ 11 images/s) ne mesure aucune performance de téléphone.

## Procédure de test sur téléphone
1. `npm run start:lan` (PC et téléphone sur le même Wi-Fi), ouvrir dans Expo Go.
2. Bouton « Infos » : voir les états, la phase des pieds, le compte rendu de contact. « Superposition » trace les appuis : vert valide, bleu levé, orange flotte, violet enfoncé, rouge glissement.
3. « Couches » : passer de « complet » à « clip seul » pendant un défaut (repli, pédalage) ; la couche qui introduit la déformation est celle où il apparaît.
4. Boutons « Assis », « Sommeil », « Toilette » : vérifier de profil (bouton « Profil ») et en trois-quarts que les pieds touchent le sol.
5. Lancer un diagnostic d'appuis (« Courbe à 90° », « Demi-tour »), relever le compte rendu.
6. Noter les images par seconde affichées : seule cette mesure vaut pour le téléphone.
