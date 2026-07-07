#!/usr/bin/env node
// One-off asset-prep script: turns the raw Freepik stock sheet
// (source-assets/boy-with-different-set-faces-illustration.zip, "boy with
// different set faces illustration" by brgfx / Freepik, free license --
// requires attribution, see src/App.tsx footer) into the transparent,
// per-mood PNGs the 2D character component actually renders.
//
// Not run automatically (no build-step dependency on it) -- it's a
// record of how public/character/*.png were produced, and a starting
// point if the source crop coordinates ever need re-tuning. source-assets/
// is gitignored (not for redistribution) -- unzip the sheet there and
// point SRC_JPG at the resulting 2090.jpg before running this again.
//
// Usage: node scripts/build-character-assets.mjs
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const SRC_JPG = fileURLToPath(new URL('../source-assets/2090.jpg', import.meta.url))
const OUT_DIR = fileURLToPath(new URL('../public/character/', import.meta.url))

const FINAL_WIDTH = 700 // downscaled from the ~1100px-wide raw crop for reasonable file size

async function loadRaw(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

function isBackground(data, i) {
  const r = data[i], g = data[i + 1], b = data[i + 2]
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  return max - min < 14 && (r + g + b) / 3 > 190
}

// Only clears background connected to the image border (BFS), so interior
// near-white regions (eye sclera, teeth) that aren't touching the edge stay
// opaque.
function keyBackgroundFloodFill(data, width, height) {
  const visited = new Uint8Array(width * height)
  const queue = []
  for (let x = 0; x < width; x++) queue.push([x, 0], [x, height - 1])
  for (let y = 0; y < height; y++) queue.push([0, y], [width - 1, y])
  while (queue.length) {
    const [x, y] = queue.pop()
    if (x < 0 || y < 0 || x >= width || y >= height) continue
    const idx = y * width + x
    if (visited[idx]) continue
    const i = idx * 4
    if (!isBackground(data, i)) continue
    visited[idx] = 1
    data[i + 3] = 0
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }
}

// Standard "over" alpha compositing, done manually pixel-by-pixel --
// sharp's own .composite() produced corrupted output for reasons not fully
// understood when combining two independently raw-buffer-roundtripped RGBA
// PNGs (a solid black block appeared over the overlay's transparent areas);
// this sidesteps it entirely.
function compositeOver(base, baseW, baseH, overlay, overlayW, overlayH, offsetX, offsetY) {
  for (let y = 0; y < overlayH; y++) {
    const by = y + offsetY
    if (by < 0 || by >= baseH) continue
    for (let x = 0; x < overlayW; x++) {
      const bx = x + offsetX
      if (bx < 0 || bx >= baseW) continue
      const oi = (y * overlayW + x) * 4
      const oa = overlay[oi + 3] / 255
      if (oa <= 0) continue
      const bi = (by * baseW + bx) * 4
      const ba = base[bi + 3] / 255
      const outA = oa + ba * (1 - oa)
      if (outA <= 0) { base[bi + 3] = 0; continue }
      for (let c = 0; c < 3; c++) {
        base[bi + c] = Math.round((overlay[oi + c] * oa + base[bi + c] * ba * (1 - oa)) / outA)
      }
      base[bi + 3] = Math.round(outA * 255)
    }
  }
}

// Erases the body's own baked-in face (a fixed rect, feathered at the
// edges so it blends into surrounding skin/hair instead of showing a hard
// seam) before pasting a different expression on top -- otherwise gaps in
// the new face art let the original eyes/mouth show through underneath.
function eraseWithSkinTone(data, width, height, sampleX, sampleY, left, top, w, h, feather) {
  const si = (sampleY * width + sampleX) * 4
  const r = data[si], g = data[si + 1], b = data[si + 2]
  const top0 = Math.max(0, top - feather)
  const bottom0 = Math.min(height, top + h + feather)
  const left0 = Math.max(0, left - feather)
  const right0 = Math.min(width, left + w + feather)
  for (let y = top0; y < bottom0; y++) {
    const dy = Math.min(y - top, top + h - y)
    for (let x = left0; x < right0; x++) {
      const dx = Math.min(x - left, left + w - x)
      const d = Math.min(dx, dy)
      const t = d >= 0 ? 1 : Math.max(0, 1 + d / feather)
      if (t <= 0) continue
      const i = (y * width + x) * 4
      data[i] = Math.round(r * t + data[i] * (1 - t))
      data[i + 1] = Math.round(g * t + data[i + 1] * (1 - t))
      data[i + 2] = Math.round(b * t + data[i + 2] * (1 - t))
      data[i + 3] = 255
    }
  }
}

// Fixed pixel geometry, tuned by hand against the source sheet (see the
// design doc for how these were found): the body's own face bounding box,
// a clean forehead patch to sample skin tone from, and each face variant's
// tight eyebrow-to-mouth crop within the strip.
const BODY_CROP = { left: 550, top: 1450, width: 1100, height: 2600 }
const FACE_BBOX = { left: 130, top: 300, width: 650, height: 520 }
const SKIN_SAMPLE = { x: 480, y: 370 }
const FEATHER = 50

const FACE_CELLS = {
  happy: { left: 270 + 4 * 750 - (850 - 750) / 2, top: 870, width: 850, height: 640, tight: { left: 80, top: 110, width: 580, height: 460 } },
  excited: { left: 270 + 3 * 750 - (850 - 750) / 2, top: 870, width: 850, height: 640, tight: { left: 40, top: 90, width: 700, height: 500 } },
  curious: { left: 270 + 2 * 750 - (850 - 750) / 2, top: 870, width: 850, height: 640, tight: { left: 40, top: 100, width: 700, height: 480 } },
  confused: { left: 270 + 5 * 750 - (850 - 750) / 2, top: 870, width: 850, height: 640, tight: { left: 40, top: 100, width: 700, height: 500 } },
}

async function buildBody() {
  const buf = await sharp(SRC_JPG).extract(BODY_CROP).toBuffer()
  const body = await loadRaw(buf)
  keyBackgroundFloodFill(body.data, body.width, body.height)
  return body
}

async function buildMoodImage(bodyTemplate, cellDef, outName) {
  // Clone the template body buffer (each mood erases+repaints independently).
  const body = { data: Uint8Array.from(bodyTemplate.data), width: bodyTemplate.width, height: bodyTemplate.height }
  eraseWithSkinTone(body.data, body.width, body.height, SKIN_SAMPLE.x, SKIN_SAMPLE.y, FACE_BBOX.left, FACE_BBOX.top, FACE_BBOX.width, FACE_BBOX.height, FEATHER)

  const cellBuf = await sharp(SRC_JPG)
    .extract({ left: Math.round(cellDef.left), top: cellDef.top, width: cellDef.width, height: cellDef.height })
    .extract(cellDef.tight)
    .toBuffer()
  const face = await loadRaw(cellBuf)
  keyBackgroundFloodFill(face.data, face.width, face.height)
  const faceResized = await sharp(face.data, { raw: { width: face.width, height: face.height, channels: 4 } })
    .resize(FACE_BBOX.width, FACE_BBOX.height)
    .raw()
    .toBuffer()

  compositeOver(body.data, body.width, body.height, faceResized, FACE_BBOX.width, FACE_BBOX.height, FACE_BBOX.left, FACE_BBOX.top)

  await sharp(body.data, { raw: { width: body.width, height: body.height, channels: 4 } })
    .resize(FINAL_WIDTH)
    .png()
    .toFile(`${OUT_DIR}${outName}`)
}

await mkdir(OUT_DIR, { recursive: true })

const bodyTemplate = await buildBody()

// "neutral" is the plain, un-swapped body (its own baked-in expression) --
// also the base sleepy/lovestruck build on top of via CSS overlays, not a
// separate baked image.
await sharp(bodyTemplate.data, { raw: { width: bodyTemplate.width, height: bodyTemplate.height, channels: 4 } })
  .resize(FINAL_WIDTH)
  .png()
  .toFile(`${OUT_DIR}mood-neutral.png`)

for (const [mood, cellDef] of Object.entries(FACE_CELLS)) {
  await buildMoodImage(bodyTemplate, cellDef, `mood-${mood}.png`)
  console.log('built', mood)
}

console.log('done ->', OUT_DIR)
