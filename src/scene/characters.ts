export interface CharacterRig {
  /** [shoulderBoneName, elbowBoneName] pairs, used to fix a T-pose bind pose. */
  armPairs: [string, string][]
  headBoneName: string | null
  /** Bone scaled for the breathing idle effect. */
  chestBoneName: string | null
  // Blink + lovestruck heart-eyes currently only work for rigs with separate,
  // scalable eye mesh nodes (like the smurf). Rigs that drive eyes via bones
  // instead (like Daffy's real eye/eyelid bones) skip those effects for now
  // rather than faking a mesh that isn't there -- see CharacterModel.
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
  {
    id: 'daffy',
    label: 'Daffy Duck',
    modelPath: '/daffy_duck_-_fortnite_skin.glb',
    targetHeight: 1.6,
    rig: {
      // Standard UE4/Fortnite mannequin skeleton -- completely different
      // naming convention from the smurf's rig, hence the per-character config
      // rather than hardcoded bone names in CharacterModel.
      armPairs: [
        ['upperarm_l_062', 'lowerarm_l_063'],
        ['upperarm_r_0113', 'lowerarm_r_0114'],
      ],
      headBoneName: 'head_012',
      chestBoneName: 'spine_05_09',
      // Has real R_eye_042/L_eye_045 *bones* plus separate eyelid bones, but
      // no standalone eye *mesh* to scale for a blink the way the smurf hack
      // works -- eyelid-bone-driven blinking would be a separate feature.
      rightEyeName: null,
      leftEyeName: null,
    },
  },
]

export const DEFAULT_CHARACTER_ID = CHARACTERS[0].id
