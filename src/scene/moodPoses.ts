import type { Mood } from '../types'

export interface MoodPose {
  /** Head tilt offset applied on top of the resting pose, radians. + pitch = look down. */
  headPitch: number
  headYaw: number
  headRoll: number
  /** Resting eyelid openness multiplier (1 = normal open, blinking dips further from here). */
  eyeOpenness: number
  bobSpeed: number
  bobAmplitude: number
  breatheSpeed: number
  breatheAmplitude: number
  /** >1 blinks less often (e.g. sleepy), <1 blinks more often (e.g. excited). */
  blinkIntervalMultiplier: number
  /** Spec §6: lovestruck swaps in heart eyes since this model has no morph targets/eye textures to swap. */
  heartEyes: boolean
}

const deg = (d: number) => (d * Math.PI) / 180

export const MOOD_POSES: Record<Mood, MoodPose> = {
  neutral: {
    headPitch: 0,
    headYaw: 0,
    headRoll: 0,
    eyeOpenness: 1,
    bobSpeed: 1.1,
    bobAmplitude: 0.02,
    breatheSpeed: 1.6,
    breatheAmplitude: 0.03,
    blinkIntervalMultiplier: 1,
    heartEyes: false,
  },
  happy: {
    headPitch: deg(-4),
    headYaw: 0,
    headRoll: 0,
    eyeOpenness: 1,
    bobSpeed: 1.4,
    bobAmplitude: 0.03,
    breatheSpeed: 1.8,
    breatheAmplitude: 0.035,
    blinkIntervalMultiplier: 1,
    heartEyes: false,
  },
  curious: {
    // The classic "head tilt" — asymmetric roll + yaw reads as curiosity even
    // with a static face.
    headPitch: deg(-6),
    headYaw: deg(10),
    headRoll: deg(14),
    eyeOpenness: 1.15,
    bobSpeed: 1.1,
    bobAmplitude: 0.02,
    breatheSpeed: 1.6,
    breatheAmplitude: 0.03,
    blinkIntervalMultiplier: 1.3,
    heartEyes: false,
  },
  sleepy: {
    headPitch: deg(16),
    headYaw: 0,
    headRoll: deg(6),
    eyeOpenness: 0.35,
    bobSpeed: 0.55,
    bobAmplitude: 0.012,
    breatheSpeed: 0.8,
    breatheAmplitude: 0.045,
    blinkIntervalMultiplier: 1.8,
    heartEyes: false,
  },
  excited: {
    headPitch: deg(-8),
    headYaw: 0,
    headRoll: 0,
    eyeOpenness: 1.3,
    bobSpeed: 2.4,
    bobAmplitude: 0.05,
    breatheSpeed: 2.6,
    breatheAmplitude: 0.03,
    blinkIntervalMultiplier: 0.7,
    heartEyes: false,
  },
  confused: {
    headPitch: deg(2),
    headYaw: deg(-8),
    headRoll: deg(-16),
    eyeOpenness: 0.9,
    bobSpeed: 1.1,
    bobAmplitude: 0.02,
    breatheSpeed: 1.6,
    breatheAmplitude: 0.03,
    blinkIntervalMultiplier: 1,
    heartEyes: false,
  },
  lovestruck: {
    headPitch: deg(-6),
    headYaw: 0,
    headRoll: deg(10),
    eyeOpenness: 1,
    bobSpeed: 1.6,
    bobAmplitude: 0.035,
    breatheSpeed: 2,
    breatheAmplitude: 0.03,
    blinkIntervalMultiplier: 1,
    heartEyes: true,
  },
}
