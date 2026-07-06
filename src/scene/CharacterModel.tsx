import { useEffect, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const MODEL_PATH = '/wild_smurf_sonic_rumble.glb'
const TARGET_HEIGHT = 1.6

export function CharacterModel() {
  const { scene } = useGLTF(MODEL_PATH)
  const group = useRef<THREE.Group>(null)

  useEffect(() => {
    if (!group.current) return

    // Normalize whatever native scale/units the source file uses (this one
    // is Sketchfab-exported in ~cm) to a consistent on-screen size, centered
    // on the origin so the fixed camera in App.tsx frames it without needing
    // a lookAt target.
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const scale = TARGET_HEIGHT / size.y

    group.current.scale.setScalar(scale)
    group.current.position.set(-center.x * scale, -center.y * scale, -center.z * scale)
  }, [scene])

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  )
}

useGLTF.preload(MODEL_PATH)
