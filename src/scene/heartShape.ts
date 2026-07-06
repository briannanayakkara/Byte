import * as THREE from 'three'

/** A small flat heart mesh's geometry, centered on the origin, for the lovestruck mood's heart eyes. */
export function createHeartGeometry(size: number) {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.bezierCurveTo(0, -0.5, -1, -0.5, -1, 0)
  shape.bezierCurveTo(-1, 0.7, 0, 1.1, 0, 1.6)
  shape.bezierCurveTo(0, 1.1, 1, 0.7, 1, 0)
  shape.bezierCurveTo(1, -0.5, 0, -0.5, 0, 0)

  const geometry = new THREE.ShapeGeometry(shape)
  geometry.center()
  geometry.scale(size, size, size)
  return geometry
}
