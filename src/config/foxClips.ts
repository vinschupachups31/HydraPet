/* Généré par tools/extract-contacts.mjs depuis fox.glb : ne pas modifier à la main.
   Vitesse nominale = vitesse de recul moyenne des pieds en appui, en unités du modèle par seconde, à lecture normale.
   Appuis = intervalles de phase normalisée [0, 1[ pendant lesquels chaque pied est posé et recule (un intervalle peut chevaucher 1 → 0). */
export interface FootContacts { bone: string; contacts: [number, number][] }
export interface ClipLocomotionData { name: string; duration: number; nominalSpeed: number; feet: FootContacts[] }

export const CLIP_DATA: Record<string, ClipLocomotionData> = {
  "Walk": {
    "name": "Walk",
    "duration": 0.708,
    "nominalSpeed": 122.8,
    "feet": [
      {
        "bone": "b_RightHand_08",
        "contacts": [
          [
            0.522,
            0.944
          ]
        ]
      },
      {
        "bone": "b_LeftHand_011",
        "contacts": [
          [
            0.025,
            0.297
          ],
          [
            0.414,
            0.533
          ]
        ]
      },
      {
        "bone": "b_LeftFoot02_018",
        "contacts": [
          [
            0.708,
            0.133
          ]
        ]
      },
      {
        "bone": "b_RightFoot02_022",
        "contacts": [
          [
            0.122,
            0.603
          ]
        ]
      }
    ]
  },
  "Run": {
    "name": "Run",
    "duration": 1.158,
    "nominalSpeed": 186.6,
    "feet": [
      {
        "bone": "b_RightHand_08",
        "contacts": [
          [
            0.358,
            0.542
          ]
        ]
      },
      {
        "bone": "b_LeftHand_011",
        "contacts": [
          [
            0.453,
            0.858
          ]
        ]
      },
      {
        "bone": "b_LeftFoot02_018",
        "contacts": [
          [
            0.903,
            0.194
          ]
        ]
      },
      {
        "bone": "b_RightFoot02_022",
        "contacts": [
          [
            0.003,
            0.344
          ]
        ]
      }
    ]
  }
};
