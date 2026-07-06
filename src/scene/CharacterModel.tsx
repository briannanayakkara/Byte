import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { aimBoneAt, worldTiltLocalQuat } from './boneUtils'
import { createHeartGeometry } from './heartShape'
import { MOOD_POSES, type MoodPose } from './moodPoses'
import type { Mood } from '../types'

type SmoothedPose = Omit<MoodPose, 'heartEyes'>

function withoutHeartEyes({ heartEyes: _heartEyes, ...rest }: MoodPose): SmoothedPose {
  return rest
}

const MODEL_PATH = '/wild_smurf_sonic_rumble.glb'
const TARGET_HEIGHT = 1.6

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
const HEART_SIZE = 0.06
// Tuned by trial (headBone's own position is near the neck, not the eyes).
const HEART_EYE_SPACING = 0.055
const HEART_EYE_HEIGHT = 0.31
const HEART_EYE_FORWARD = 0.27

interface CharacterModelProps {
  mood?: Mood
}

export function CharacterModel({ mood = 'neutral' }: CharacterModelProps) {
  const { scene } = useGLTF(MODEL_PATH)
  const group = useRef<THREE.Group>(null)
  const basePosition = useRef(new THREE.Vector3())

  const headBone = useRef<THREE.Object3D | null>(null)
  const headBaseWorldQuat = useRef(new THREE.Quaternion())
  const headParentWorldQuat = useRef(new THREE.Quaternion())
  const chestBone = useRef<THREE.Object3D | null>(null)
  const chestBaseScale = useRef(new THREE.Vector3(1, 1, 1))
  // Identified by directly inspecting the glTF: Sketchfab's Blender export
  // names mesh *container nodes* generically ("Object_55"/"Object_56") even
  // though the underlying meshes are named Mesh_eye_..._R_Eye / L_Eye, so we
  // can't find these by a "contains 'eye'" name search after load.
  const leftEye = useRef<THREE.Object3D | null>(null)
  const rightEye = useRef<THREE.Object3D | null>(null)
  const eyeBaseScale = useRef(new THREE.Vector3(1, 1, 1))
  const leftHeart = useRef<THREE.Mesh>(null)
  const rightHeart = useRef<THREE.Mesh>(null)

  const lookCurrent = useRef({ yaw: 0, pitch: 0 })
  const lookTarget = useRef({ yaw: 0, pitch: 0 })
  const lookNextPickAt = useRef(0)

  const blinkNextAt = useRef(0)
  const blinkStartedAt = useRef<number | null>(null)

  // Smoothed toward the target mood's MoodPose every frame so switching moods
  // eases rather than snaps (spec §6).
  const currentPose = useRef<SmoothedPose>(withoutHeartEyes(MOOD_POSES.neutral))

  const heartGeometry = useMemo(() => createHeartGeometry(HEART_SIZE), [])
  const heartMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff4d6d' }), [])

  useEffect(() => {
    if (!group.current) return
    scene.updateMatrixWorld(true)

    // Normalize whatever native scale/units the source file uses to a
    // consistent on-screen size, centered on the origin.
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const scale = TARGET_HEIGHT / size.y
    group.current.scale.setScalar(scale)
    basePosition.current.set(-center.x * scale, -center.y * scale, -center.z * scale)
    group.current.position.copy(basePosition.current)

    // Bring the T-pose arms down to a resting pose. Aim each upper-arm bone
    // at its elbow child, re-pointing that world-space direction mostly
    // downward while preserving which side it leans to (so it reads as
    // "hanging at the side," not snapped to dead-center).
    const armPairs: [string, string][] = [
      ['L_Arm_A_00', 'L_Arm_B_08'],
      ['R_Arm_A_022', 'R_Arm_B_023'],
    ]
    for (const [shoulderName, elbowName] of armPairs) {
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

    headBone.current = scene.getObjectByName('C_Head_06') ?? null
    if (headBone.current) {
      headBone.current.getWorldQuaternion(headBaseWorldQuat.current)
      headBone.current.parent?.getWorldQuaternion(headParentWorldQuat.current)
    }

    chestBone.current = scene.getObjectByName('C_Spine_C_05') ?? null
    if (chestBone.current) chestBaseScale.current.copy(chestBone.current.scale)

    rightEye.current = scene.getObjectByName('Object_55') ?? null
    leftEye.current = scene.getObjectByName('Object_56') ?? null
    if (rightEye.current) eyeBaseScale.current.copy(rightEye.current.scale)
  }, [scene])

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime()
    const targetPose = withoutHeartEyes(MOOD_POSES[mood])
    const pose = currentPose.current
    for (const key of Object.keys(pose) as (keyof SmoothedPose)[]) {
      pose[key] = THREE.MathUtils.damp(pose[key], targetPose[key], MOOD_TRANSITION_RATE, delta)
    }

    if (group.current) {
      group.current.position.y = basePosition.current.y + Math.sin(t * pose.bobSpeed) * pose.bobAmplitude
    }

    if (chestBone.current) {
      const breathe = 1 + Math.sin(t * pose.breatheSpeed) * pose.breatheAmplitude
      chestBone.current.scale.set(
        chestBaseScale.current.x * breathe,
        chestBaseScale.current.y * breathe,
        chestBaseScale.current.z * breathe
      )
    }

    if (headBone.current) {
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

    // Lovestruck heart eyes (spec §6) -- this model has no morph targets or
    // swappable eye textures, so hearts are separate billboards positioned
    // over the real eyes rather than a texture/mesh swap. Positioned off the
    // HEAD BONE, not the eye meshes: the eye meshes are skinned, so their own
    // Object3D position is near the skeleton's bind-pose root, not where
    // bone-skinning visually deforms them to -- getWorldPosition() on a
    // SkinnedMesh doesn't account for GPU-side skinning at all.
    const showHearts = MOOD_POSES[mood].heartEyes
    if (leftHeart.current) leftHeart.current.visible = showHearts
    if (rightHeart.current) rightHeart.current.visible = showHearts
    if (showHearts && headBone.current) {
      headBone.current.updateWorldMatrix(true, false)
      const headWorldPos = new THREE.Vector3()
      headBone.current.getWorldPosition(headWorldPos)
      if (leftHeart.current) {
        leftHeart.current.position.set(headWorldPos.x - HEART_EYE_SPACING, headWorldPos.y + HEART_EYE_HEIGHT, headWorldPos.z + HEART_EYE_FORWARD)
      }
      if (rightHeart.current) {
        rightHeart.current.position.set(headWorldPos.x + HEART_EYE_SPACING, headWorldPos.y + HEART_EYE_HEIGHT, headWorldPos.z + HEART_EYE_FORWARD)
      }
    }
  })

  return (
    <>
      <group ref={group}>
        <primitive object={scene} />
      </group>
      <mesh ref={leftHeart} geometry={heartGeometry} material={heartMaterial} visible={false} />
      <mesh ref={rightHeart} geometry={heartGeometry} material={heartMaterial} visible={false} />
    </>
  )
}

useGLTF.preload(MODEL_PATH)
