import { Canvas } from '@react-three/fiber'

function App() {
  return (
    <div className="h-svh w-svw bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <Canvas camera={{ position: [0, 0, 3], fov: 45 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 3, 2]} intensity={1} />
      </Canvas>
    </div>
  )
}

export default App
