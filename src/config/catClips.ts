/* Généré par tools/extract-contacts.mjs depuis cat-rigged.glb : ne pas modifier à la main.
   Vitesse nominale = vitesse de recul moyenne des pieds en appui, en unités du modèle par seconde, à lecture normale.
   Appuis = intervalles de phase normalisée [0, 1[ pendant lesquels chaque pied est posé et recule (un intervalle peut chevaucher 1 → 0). */

import type { ClipLocomotionData } from './foxClips';

export const CAT_CLIP_DATA: Record<string, ClipLocomotionData> = {
  "Walk": {
    "name": "Walk",
    "duration": 1,
    "nominalSpeed": 0.5512,
    "feet": [
      {
        "bone": "Front_Leg_Tip_R",
        "contacts": [
          [
            0.45,
            0
          ]
        ]
      },
      {
        "bone": "Front_Leg_Tip_L",
        "contacts": [
          [
            0.036,
            0.425
          ],
          [
            0.9,
            0.003
          ]
        ]
      },
      {
        "bone": "Back_Leg_Tip_L",
        "contacts": [
          [
            0.036,
            0.236
          ]
        ]
      },
      {
        "bone": "Back_Leg_Tip_R",
        "contacts": [
          [
            0.503,
            0.736
          ]
        ]
      }
    ]
  },
  "Run": {
    "name": "Run",
    "duration": 0.467,
    "nominalSpeed": 3.6589,
    "feet": [
      {
        "bone": "Front_Leg_Tip_R",
        "contacts": [
          [
            0.1,
            0.358
          ]
        ]
      },
      {
        "bone": "Front_Leg_Tip_L",
        "contacts": [
          [
            0.072,
            0.219
          ],
          [
            0.267,
            0.358
          ]
        ]
      },
      {
        "bone": "Back_Leg_Tip_L",
        "contacts": [
          [
            0.653,
            0.836
          ]
        ]
      },
      {
        "bone": "Back_Leg_Tip_R",
        "contacts": [
          [
            0.531,
            0.778
          ]
        ]
      }
    ]
  }
};
