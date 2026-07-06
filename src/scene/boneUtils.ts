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

/**
 * Computes the local quaternion `bone` needs so that, on top of its
 * `baseWorldQuat` (its world orientation at some reference pose), it's
 * additionally rotated by `worldEuler` expressed in WORLD axes (X=pitch,
 * Y=yaw, Z=roll as the camera sees them) -- not the bone's own local axes.
 *
 * Rig-exported bones often have arbitrary/skewed local axis conventions
 * (baked in from the modeling tool's bind pose), so applying an intuitive
 * "pitch/yaw/roll" Euler directly as a *local* rotation can get redirected
 * into a wildly different-looking world-space rotation. Composing in world
 * space first sidesteps that, the same way aimBoneAt does for the arms.
 */
export function worldTiltLocalQuat(
  baseWorldQuat: THREE.Quaternion,
  parentWorldQuat: THREE.Quaternion,
  worldEuler: THREE.Euler
): THREE.Quaternion {
  const delta = new THREE.Quaternion().setFromEuler(worldEuler)
  const newWorldQuat = delta.multiply(baseWorldQuat)
  return parentWorldQuat.clone().invert().multiply(newWorldQuat)
}

/**
 * Bounding box built from bone WORLD positions rather than mesh geometry.
 *
 * THREE.Box3.setFromObject reads a SkinnedMesh's raw bind-pose vertex data
 * transformed only by the mesh's own (near-identity) matrixWorld -- it does
 * NOT account for GPU-side skinning at all. That's fine when a rig's bind
 * pose happens to match its rendered pose (true for the simpler smurf rig),
 * but game-ready rigs like a Fortnite skeleton can store bind-pose geometry
 * in a different reference arrangement than what's actually displayed,
 * which silently produces the wrong size. Bone world positions are always
 * correct for the CURRENT pose, so they're a more reliable fallback.
 */
export function boneWorldBounds(root: THREE.Object3D): THREE.Box3 | null {
  const box = new THREE.Box3()
  const pos = new THREE.Vector3()
  let found = false
  root.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) {
      obj.getWorldPosition(pos)
      box.expandByPoint(pos)
      found = true
    }
  })
  return found ? box : null
}
