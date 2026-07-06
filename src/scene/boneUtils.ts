import * as THREE from 'three'

/**
 * Rotates `bone` in world space so the direction from its current world
 * position to `child`'s current world position points along `targetWorldDir`
 * instead. Operates purely on world-space vectors/quaternions, so it works
 * regardless of the bone's local axis conventions (which vary per rig/
 * exporter and aren't worth reverse-engineering per model).
 */
export function aimBoneAt(bone: THREE.Object3D, child: THREE.Object3D, targetWorldDir: THREE.Vector3) {
  const bonePos = new THREE.Vector3()
  const childPos = new THREE.Vector3()
  bone.getWorldPosition(bonePos)
  child.getWorldPosition(childPos)
  const currentDir = childPos.sub(bonePos).normalize()

  const originalWorldQuat = new THREE.Quaternion()
  bone.getWorldQuaternion(originalWorldQuat)

  const delta = new THREE.Quaternion().setFromUnitVectors(currentDir, targetWorldDir.clone().normalize())
  const newWorldQuat = delta.multiply(originalWorldQuat)

  const parentWorldQuat = new THREE.Quaternion()
  bone.parent?.getWorldQuaternion(parentWorldQuat)

  bone.quaternion.copy(parentWorldQuat.invert().multiply(newWorldQuat))
}
