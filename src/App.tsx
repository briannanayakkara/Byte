import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { CharacterModel } from './scene/CharacterModel'

function App() {
  return (
    <div className="h-svh w-svw bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <Canvas camera={{ position: [0, 0, 3], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[2, 3, 2]} intensity={1.4} />
        <Suspense fallback={null}>
          <CharacterModel />
        </Suspense>
      </Canvas>
    </div>
  )
}

export default App
