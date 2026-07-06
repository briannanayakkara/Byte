import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { CharacterModel } from './scene/CharacterModel'
import type { Mood } from './types'

const MOODS: Mood[] = ['neutral', 'happy', 'curious', 'sleepy', 'excited', 'confused', 'lovestruck']

function App() {
  const [mood, setMood] = useState<Mood>('neutral')

  return (
    <div className="relative h-svh w-svw bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <Canvas camera={{ position: [0, 0, 3], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[2, 3, 2]} intensity={1.4} />
        <Suspense fallback={null}>
          <CharacterModel mood={mood} />
        </Suspense>
      </Canvas>

      {/* Temporary dev harness for verifying moods (spec §9 step 3) — the real
          driver is /api/chat's returned mood, wired in step 5. */}
      <div className="absolute inset-x-0 bottom-4 flex flex-wrap justify-center gap-2 px-4">
        {MOODS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMood(m)}
            className={`rounded-full px-3 py-1 text-sm capitalize transition-colors ${
              m === mood ? 'bg-white text-slate-900' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  )
}

export default App
