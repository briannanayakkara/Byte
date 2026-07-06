import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { aimBoneAt } from './boneUtils'

const MODEL_PATH = '/wild_smurf_sonic_rumble.glb'
const TARGET_HEIGHT = 1.6

const BOB_SPEED = 1.1
const BOB_AMPLITUDE = 0.02
const BREATHE_SPEED = 1.6
const BREATHE_AMPLITUDE = 0.03
const BLINK_MIN_INTERVAL = 2.5
const BLINK_MAX_INTERVAL = 6
const BLINK_DURATION = 0.14
const LOOK_MIN_INTERVAL = 3
const LOOK_MAX_INTERVAL = 7
const LOOK_MAX_YAW = THREE.MathUtils.degToRad(18)
const LOOK_MAX_PITCH = THREE.MathUtils.degToRad(8)
const LOOK_LERP_SPEED = 2

export function CharacterModel() {
  const { scene } = useGLTF(MODEL_PATH)
  const group = useRef<THREE.Group>(null)
  const basePosition = useRef(new THREE.Vector3())

  const headBone = useRef<THREE.Object3D | null>(null)
  const headBaseQuat = useRef(new THREE.Quaternion())
  const chestBone = useRef<THREE.Object3D | null>(null)
  const chestBaseScale = useRef(new THREE.Vector3(1, 1, 1))
  // Identified by directly inspecting the glTF: Sketchfab's Blender export
  // names mesh *container nodes* generically ("Object_55"/"Object_56") even
  // though the underlying meshes are named Mesh_eye_..._R_Eye / L_Eye, so we
  // can't find these by a "contains 'eye'" name search after load.
  const leftEye = useRef<THREE.Object3D | null>(null)
  const rightEye = useRef<THREE.Object3D | null>(null)
  const eyeBaseScale = useRef(new THREE.Vector3(1, 1, 1))

  const lookCurrent = useRef({ yaw: 0, pitch: 0 })
  const lookTarget = useRef({ yaw: 0, pitch: 0 })
  const lookNextPickAt = useRef(0)

  const blinkNextAt = useRef(0)
  const blinkStartedAt = useRef<number | null>(null)

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
    if (headBone.current) headBaseQuat.current.copy(headBone.current.quaternion)

    chestBone.current = scene.getObjectByName('C_Spine_C_05') ?? null
    if (chestBone.current) chestBaseScale.current.copy(chestBone.current.scale)

    rightEye.current = scene.getObjectByName('Object_55') ?? null
    leftEye.current = scene.getObjectByName('Object_56') ?? null
    if (rightEye.current) eyeBaseScale.current.copy(rightEye.current.scale)
  }, [scene])

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime()

    if (group.current) {
      group.current.position.y = basePosition.current.y + Math.sin(t * BOB_SPEED) * BOB_AMPLITUDE
    }

    if (chestBone.current) {
      const breathe = 1 + Math.sin(t * BREATHE_SPEED) * BREATHE_AMPLITUDE
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
      const lookOffset = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(lookCurrent.current.pitch, lookCurrent.current.yaw, 0)
      )
      headBone.current.quaternion.copy(headBaseQuat.current).multiply(lookOffset)
    }

    if (leftEye.current && rightEye.current) {
      if (blinkStartedAt.current === null && t >= blinkNextAt.current) {
        blinkStartedAt.current = t
      }
      let eyeScaleY = eyeBaseScale.current.y
      if (blinkStartedAt.current !== null) {
        const progress = (t - blinkStartedAt.current) / BLINK_DURATION
        if (progress >= 1) {
          blinkStartedAt.current = null
          blinkNextAt.current = t + THREE.MathUtils.randFloat(BLINK_MIN_INTERVAL, BLINK_MAX_INTERVAL)
        } else {
          eyeScaleY = eyeBaseScale.current.y * (1 - Math.sin(progress * Math.PI))
        }
      }
      leftEye.current.scale.setY(eyeScaleY)
      rightEye.current.scale.setY(eyeScaleY)
    }
  })

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  )
}

useGLTF.preload(MODEL_PATH)
