import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { aimBoneAt, worldTiltLocalQuat } from './boneUtils'
import { CHARACTERS, DEFAULT_CHARACTER_ID, type CharacterConfig } from './characters'
import { createHeartGeometry } from './heartShape'
import { MOOD_POSES, type MoodPose } from './moodPoses'
import type { Mood } from '../types'

type SmoothedPose = Omit<MoodPose, 'heartHalo'>

function withoutHeartHalo({ heartHalo: _heartHalo, ...rest }: MoodPose): SmoothedPose {
  return rest
}

const BLINK_MIN_INTERVAL = 2.5
const BLINK_MAX_INTERVAL = 6
const BLINK_DURATION = 0.14
const LOOK_MIN_INTERVAL = 3
const LOOK_MAX_INTERVAL = 7
const LOOK_MAX_YAW = THREE.MathUtils.degToRad(18)
const LOOK_MAX_PITCH = THREE.MathUtils.degToRad(8)
const LOOK_LERP_SPEED = 2
// Spec §6: mood transitions blend over ~200-300ms so they never snap. damp()
// with this rate settles ~95% of the way there in about that window.
const MOOD_TRANSITION_RATE = 11
const HEART_SIZE = 0.08
const HEART_COUNT = 3
// Ring of hearts circling the head, roughly at hair-top height, rather than
// pinned to the eyes -- much less sensitive to a given rig's exact eye
// position/proportions, and it's a classic enough "lovestruck" cartoon beat
// on its own.
const HEART_HALO_RADIUS = 0.28
const HEART_HALO_HEIGHT = 0.55
const HEART_HALO_SPEED = 1.4 // radians/sec

interface CharacterModelProps {
  mood?: Mood
  characterId?: string
}

export function CharacterModel({ mood = 'neutral', characterId = DEFAULT_CHARACTER_ID }: CharacterModelProps) {
  const character: CharacterConfig =
    CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0]
  const { scene, animations } = useGLTF(character.modelPath)
  const group = useRef<THREE.Group>(null)
  const { actions } = useAnimations(animations, group)
  const basePosition = useRef(new THREE.Vector3())

  const headBone = useRef<THREE.Object3D | null>(null)
  const headBaseWorldQuat = useRef(new THREE.Quaternion())
  const headParentWorldQuat = useRef(new THREE.Quaternion())
  const chestBone = useRef<THREE.Object3D | null>(null)
  const chestBaseScale = useRef(new THREE.Vector3(1, 1, 1))
  const leftEye = useRef<THREE.Object3D | null>(null)
  const rightEye = useRef<THREE.Object3D | null>(null)
  const eyeBaseScale = useRef(new THREE.Vector3(1, 1, 1))
  const hearts = useRef<(THREE.Mesh | null)[]>([])

  const lookCurrent = useRef({ yaw: 0, pitch: 0 })
  const lookTarget = useRef({ yaw: 0, pitch: 0 })
  const lookNextPickAt = useRef(0)

  const blinkNextAt = useRef(0)
  const blinkStartedAt = useRef<number | null>(null)

  // Smoothed toward the target mood's MoodPose every frame so switching moods
  // eases rather than snaps (spec §6).
  const currentPose = useRef<SmoothedPose>(withoutHeartHalo(MOOD_POSES.neutral))

  const heartGeometry = useMemo(() => createHeartGeometry(HEART_SIZE), [])
  const heartMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff4d6d' }), [])

  useEffect(() => {
    if (!group.current) return

    // Reset to identity before measuring: on a character switch, group.current
    // still carries the PREVIOUS character's scale/position, and
    // scene.updateMatrixWorld composes with the parent's already-computed
    // matrixWorld rather than recomputing it -- so measuring bone world
    // positions without this reset would measure the new model through the
    // old model's leftover transform.
    group.current.scale.setScalar(1)
    group.current.position.set(0, 0, 0)
    group.current.updateMatrixWorld(true)

    const rig = character.rig

    // Normalize whatever native scale/units the source file uses to a
    // consistent on-screen size, centered on the origin.
    //
    // Tried measuring from bone world positions instead of mesh geometry
    // (see git history) to work around a Fortnite-rigged character whose
    // mesh bind-pose data didn't match its rendered pose -- but that rig
    // isn't used anymore, and bone positions have their own failure mode:
    // Gobot's head bone sits at its neck, well below the top of its
    // (deliberately oversized, cute) round head, so measuring bone-to-bone
    // span badly undersized it. Plain mesh Box3 is correct for both
    // characters actually in use, so keep it simple.
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const scale = character.targetHeight / size.y
    group.current.scale.setScalar(scale)
    basePosition.current.set(-center.x * scale, -center.y * scale, -center.z * scale)
    group.current.position.copy(basePosition.current)

    // If this rig ships a real idle animation, play it instead of the
    // procedural T-pose fix -- a baked clip already poses the arms properly.
    if (rig.idleAnimationName) {
      for (const name of Object.keys(actions)) {
        if (name !== rig.idleAnimationName) actions[name]?.stop()
      }
      actions[rig.idleAnimationName]?.reset().play()
    } else {
      // Bring T-pose arms down to a resting pose. Aim each upper-arm bone at
      // its elbow child, re-pointing that world-space direction mostly
      // downward while preserving which side it leans to (so it reads as
      // "hanging at the side," not snapped to dead-center). Bone names come
      // from the per-character rig config since every rig names them
      // differently.
      for (const [shoulderName, elbowName] of rig.armPairs) {
        const shoulder = scene.getObjectByName(shoulderName)
        const elbow = scene.getObjectByName(elbowName)
        if (!shoulder || !elbow) continue
        const shoulderPos = new THREE.Vector3()
        const elbowPos = new THREE.Vector3()
        shoulder.getWorldPosition(shoulderPos)
        elbow.getWorldPosition(elbowPos)
        const sideSign = Math.sign(elbowPos.x - shoulderPos.x) || 1
        aimBoneAt(shoulder, elbow, new THREE.Vector3(sideSign * 0.2, -0.95, 0.1))
      }
    }

    headBone.current = rig.headBoneName ? (scene.getObjectByName(rig.headBoneName) ?? null) : null
    if (headBone.current) {
      // For an animated rig this is just a starting value -- it's
      // recomputed fresh every frame in useFrame instead, since the
      // animation mixer redrives the head bone's orientation continuously.
      headBone.current.getWorldQuaternion(headBaseWorldQuat.current)
      headBone.current.parent?.getWorldQuaternion(headParentWorldQuat.current)
    }

    chestBone.current = rig.chestBoneName ? (scene.getObjectByName(rig.chestBoneName) ?? null) : null
    if (chestBone.current) chestBaseScale.current.copy(chestBone.current.scale)

    rightEye.current = rig.rightEyeName ? (scene.getObjectByName(rig.rightEyeName) ?? null) : null
    leftEye.current = rig.leftEyeName ? (scene.getObjectByName(rig.leftEyeName) ?? null) : null
    if (rightEye.current) eyeBaseScale.current.copy(rightEye.current.scale)
  }, [scene, character])

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime()
    const targetPose = withoutHeartHalo(MOOD_POSES[mood])
    const pose = currentPose.current
    for (const key of Object.keys(pose) as (keyof SmoothedPose)[]) {
      pose[key] = THREE.MathUtils.damp(pose[key], targetPose[key], MOOD_TRANSITION_RATE, delta)
    }

    const hasIdleAnimation = Boolean(character.rig.idleAnimationName)

    // A baked idle clip already bobs/breathes -- adding the procedural
    // version on top would double up and look jittery.
    if (group.current && !hasIdleAnimation) {
      group.current.position.y = basePosition.current.y + Math.sin(t * pose.bobSpeed) * pose.bobAmplitude
    }

    if (chestBone.current && !hasIdleAnimation) {
      const breathe = 1 + Math.sin(t * pose.breatheSpeed) * pose.breatheAmplitude
      chestBone.current.scale.set(
        chestBaseScale.current.x * breathe,
        chestBaseScale.current.y * breathe,
        chestBaseScale.current.z * breathe
      )
    }

    if (headBone.current) {
      // For an animated rig, the mixer redrives this bone's orientation every
      // frame BEFORE this callback runs (useAnimations' own useFrame is
      // registered first, above), so re-reading it fresh each frame gives
      // the animation's current pose as our "base" -- reusing the one-time
      // snapshot from the effect would layer our tilt on top of a pose from
      // a completely different point in the animation. For a static rig,
      // nothing else touches this bone, so the one-time snapshot is correct
      // and re-reading every frame would wrongly compound our own tilt from
      // the previous frame on top of itself.
      if (hasIdleAnimation) {
        headBone.current.getWorldQuaternion(headBaseWorldQuat.current)
        headBone.current.parent?.getWorldQuaternion(headParentWorldQuat.current)
      }

      if (t >= lookNextPickAt.current) {
        lookTarget.current = {
          yaw: THREE.MathUtils.randFloatSpread(2) * LOOK_MAX_YAW,
          pitch: THREE.MathUtils.randFloatSpread(2) * LOOK_MAX_PITCH,
        }
        lookNextPickAt.current = t + THREE.MathUtils.randFloat(LOOK_MIN_INTERVAL, LOOK_MAX_INTERVAL)
      }
      lookCurrent.current.yaw = THREE.MathUtils.damp(
        lookCurrent.current.yaw,
        lookTarget.current.yaw,
        LOOK_LERP_SPEED,
        delta
      )
      lookCurrent.current.pitch = THREE.MathUtils.damp(
        lookCurrent.current.pitch,
        lookTarget.current.pitch,
        LOOK_LERP_SPEED,
        delta
      )
      // Composed in WORLD axes (see worldTiltLocalQuat) so pitch/yaw/roll
      // behave the way they read visually, regardless of this bone's own
      // skewed bind-pose local axes.
      const worldEuler = new THREE.Euler(
        pose.headPitch + lookCurrent.current.pitch,
        pose.headYaw + lookCurrent.current.yaw,
        pose.headRoll
      )
      headBone.current.quaternion.copy(
        worldTiltLocalQuat(headBaseWorldQuat.current, headParentWorldQuat.current, worldEuler)
      )
    }

    if (leftEye.current && rightEye.current) {
      if (blinkStartedAt.current === null && t >= blinkNextAt.current) {
        blinkStartedAt.current = t
      }
      const restingScaleY = eyeBaseScale.current.y * pose.eyeOpenness
      let eyeScaleY = restingScaleY
      if (blinkStartedAt.current !== null) {
        const progress = (t - blinkStartedAt.current) / BLINK_DURATION
        if (progress >= 1) {
          blinkStartedAt.current = null
          blinkNextAt.current =
            t + THREE.MathUtils.randFloat(BLINK_MIN_INTERVAL, BLINK_MAX_INTERVAL) * pose.blinkIntervalMultiplier
        } else {
          eyeScaleY = restingScaleY * (1 - Math.sin(progress * Math.PI))
        }
      }
      leftEye.current.scale.setY(eyeScaleY)
      rightEye.current.scale.setY(eyeScaleY)
    }

    // Lovestruck (spec §6 extras): a ring of hearts orbiting the head, rather
    // than pinned to the eyes -- this model has no morph targets to swap in
    // heart-shaped eyes, and pinning flat billboards precisely onto a
    // skinned face turned out to be fiddly and rig-specific (see git log).
    // Orbiting around the head bone is forgiving of exactly where the eyes
    // are, works for any rig with a head bone, and doubles as a classic
    // cartoon "lovestruck" beat on its own.
    const showHearts = MOOD_POSES[mood].heartHalo && Boolean(headBone.current)
    if (showHearts && headBone.current) {
      headBone.current.updateWorldMatrix(true, false)
      const headWorldPos = new THREE.Vector3()
      headBone.current.getWorldPosition(headWorldPos)
      for (let i = 0; i < HEART_COUNT; i++) {
        const heart = hearts.current[i]
        if (!heart) continue
        heart.visible = true
        const angle = (i / HEART_COUNT) * Math.PI * 2 + t * HEART_HALO_SPEED
        heart.position.set(
          headWorldPos.x + Math.cos(angle) * HEART_HALO_RADIUS,
          headWorldPos.y + HEART_HALO_HEIGHT,
          headWorldPos.z + Math.sin(angle) * HEART_HALO_RADIUS
        )
      }
    } else {
      for (const heart of hearts.current) {
        if (heart) heart.visible = false
      }
    }
  })

  return (
    <>
      <group ref={group}>
        <primitive object={scene} />
      </group>
      {Array.from({ length: HEART_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            hearts.current[i] = el
          }}
          geometry={heartGeometry}
          material={heartMaterial}
          visible={false}
        />
      ))}
    </>
  )
}

for (const c of CHARACTERS) useGLTF.preload(c.modelPath)
