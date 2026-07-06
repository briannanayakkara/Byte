export interface CharacterRig {
  /** [shoulderBoneName, elbowBoneName] pairs, used to fix a T-pose bind pose. */
  armPairs: [string, string][]
  headBoneName: string | null
  /** Bone scaled for the breathing idle effect. */
  chestBoneName: string | null
  // Blink only works for rigs with separate, scalable eye mesh nodes (like
  // the smurf). A rig that drives eyes via bones instead would need its own
  // eyelid-bone-driven blink, not covered here -- see CharacterModel.
  rightEyeName: string | null
  leftEyeName: string | null
}

export interface CharacterConfig {
  id: string
  label: string
  modelPath: string
  targetHeight: number
  rig: CharacterRig
}

export const CHARACTERS: CharacterConfig[] = [
  {
    id: 'smurf',
    label: 'Smurf',
    modelPath: '/wild_smurf_sonic_rumble.glb',
    targetHeight: 1.6,
    rig: {
      armPairs: [
        ['L_Arm_A_00', 'L_Arm_B_08'],
        ['R_Arm_A_022', 'R_Arm_B_023'],
      ],
      headBoneName: 'C_Head_06',
      chestBoneName: 'C_Spine_C_05',
      // Identified by directly inspecting the glTF: Sketchfab's Blender
      // export names these mesh container nodes generically even though the
      // underlying meshes are named Mesh_eye_..._R_Eye / L_Eye.
      rightEyeName: 'Object_55',
      leftEyeName: 'Object_56',
    },
  },
  // Daffy Duck (daffy_duck_-_fortnite_skin.glb) was tried as a second
  // character and dropped -- not a good enough fit. The rig-config
  // architecture above stays generic so a better second character can be
  // dropped in later without touching CharacterModel again.
]

export const DEFAULT_CHARACTER_ID = CHARACTERS[0].id
