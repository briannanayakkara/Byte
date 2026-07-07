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
  // Optional autonomous wander behavior (CharacterModel's wander state
  // machine) -- null means "stay put," today's behavior. Requires the rig's
  // .glb to ship a walk cycle and at least one one-shot "goofy" clip.
  movement: CharacterMovement | null
}

export interface CharacterMovement {
  // Looping clip played while translating toward a randomly chosen point.
  walkAnimationName: string
  // One-shot clips (played once, not looped) randomly chosen for a "goofy
  // beat" instead of a plain idle pause between wander legs.
  goofyAnimationNames: string[]
  // Max distance (world units, same scale as targetHeight) from the
  // character's centered origin that a wander destination can be picked --
  // keep small enough to stay inside the camera frustum (fixed camera,
  // spec §7: "Big 3D character centered in a canvas").
  wanderRadius: number
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
      // Ships a real "Idle" animation (plus Walk/Run/Jump/etc.), so no arm
      // T-pose fix or procedural breathing needed.
      armPairs: [],
      headBoneName: 'Head',
      chestBoneName: null,
      // Single mesh, no separate eye geometry to scale for a blink.
      rightEyeName: null,
      leftEyeName: null,
      idleAnimationName: 'Idle',
      movement: {
        walkAnimationName: 'Walk',
        // EdgeGrab/WallSlide skipped -- no wall or edge in the scene for
        // them to read correctly against (design doc §2).
        goofyAnimationNames: ['Flip', 'Fall', 'VictorySign'],
        wanderRadius: 0.35,
      },
    },
  },
  // Daffy Duck (daffy_duck_-_fortnite_skin.glb) was tried as a second
  // character and dropped -- not a good enough fit. The rig-config
  // architecture above stays generic so a better second character can be
  // dropped in later without touching CharacterModel again.
]

export const DEFAULT_CHARACTER_ID = CHARACTERS[0].id
