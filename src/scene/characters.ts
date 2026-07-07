export interface CharacterRig {
  /** [shoulderBoneName, elbowBoneName] pairs, used to fix a T-pose bind pose. Skip if idleAnimationName already poses the arms. */
  armPairs: [string, string][]
  headBoneName: string | null
  /** Bone scaled for the procedural breathing idle effect. Leave null if idleAnimationName already breathes. */
  chestBoneName: string | null
  // Blink only works for rigs with separate, scalable eye mesh nodes (like
  // the smurf). A rig that drives eyes via bones instead would need its own
  // eyelid-bone-driven blink, not covered here -- see CharacterModel.
  rightEyeName: string | null
  leftEyeName: string | null
  // Name of a baked glTF animation clip to loop for idle life instead of the
  // procedural bob/breathe/arm-fix (used when the source file actually ships
  // an idle animation, unlike the smurf's zero-animation export). Mood head
  // tilt + look-around still layer on top of it every frame.
  idleAnimationName: string | null
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
    id: 'gobot',
    label: 'Gobot',
    modelPath: '/gobot.glb',
    targetHeight: 1.6,
    rig: {
      // Ships a real "Idle" animation (plus Walk/Run/Jump/etc. -- unused for
      // now), so no arm T-pose fix or procedural breathing needed.
      armPairs: [],
      headBoneName: 'Head',
      chestBoneName: null,
      // Single mesh, no separate eye geometry to scale for a blink.
      rightEyeName: null,
      leftEyeName: null,
      idleAnimationName: 'Idle',
    },
  },
  // Daffy Duck (daffy_duck_-_fortnite_skin.glb) was tried as a second
  // character and dropped -- not a good enough fit. The rig-config
  // architecture above stays generic so a better second character can be
  // dropped in later without touching CharacterModel again.
]

export const DEFAULT_CHARACTER_ID = CHARACTERS[0].id
