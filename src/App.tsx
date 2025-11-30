import { Canvas } from '@react-three/fiber'
import { Environment, OrbitControls, Sparkles, AdaptiveDpr, AdaptiveEvents, PerformanceMonitor } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import React, { Suspense, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useSnapshot } from 'valtio'
import { InteractiveTree } from './components/InteractiveTree'
import { appState } from './store'

export default function App() {
  const snap = useSnapshot(appState)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Handle BGM changes & Auto-play
  useEffect(() => {
    // Detect Mobile & Initial Quality
    const isMobile = window.innerWidth < 768
    if (isMobile) {
      appState.quality = 'low'
    }

    const audio = audioRef.current
    if (!audio) return

    // Initial setup
    audio.loop = true
    
    const playAudio = async () => {
        if (snap.bgmUrl) {
            audio.src = snap.bgmUrl
            try {
                await audio.play()
            } catch (e) {
                console.log('Autoplay blocked, waiting for interaction', e)
                // Optional: Add a one-time click listener to document to start audio
                const startAudio = () => {
                    audio.play()
                    document.removeEventListener('click', startAudio)
                }
                document.addEventListener('click', startAudio)
            }
        }
    }

    playAudio()

    return () => {
        audio.pause()
    }
  }, [snap.bgmUrl]) // Re-run only if URL changes

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    
    const remainingSlots = 5 - snap.images.length
    if (remainingSlots <= 0) {
        alert('最多只能上传5张图片 / Max 5 images')
        return
    }

    const selectedFiles = Array.from(files).slice(0, remainingSlots)
    
    Promise.all(selectedFiles.map(file => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    })).then(newImages => {
      appState.images = [...appState.images, ...newImages]
    })
  }

  const handleBgmUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = () => {
      appState.bgmUrl = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="w-full h-screen bg-black text-gold-500 relative overflow-hidden font-serif" style={{ touchAction: 'none' }}>
      {/* Audio Element */}
      <audio ref={audioRef} loop />

      {/* UI Overlay - Title (Centered Top) */}
      {(snap.mode === 'edit' || (snap.mode === 'play' && snap.title)) && (
        <div className="absolute top-12 left-0 right-0 z-10 pointer-events-none select-none text-center px-4">
          <h1 className="text-4xl md:text-6xl font-bold text-[#FFD700] drop-shadow-[0_0_15px_rgba(255,215,0,0.6)] tracking-wider truncate">
            {snap.title}
          </h1>
        </div>
      )}

      {/* Edit Mode Controls */}
      {snap.mode === 'edit' && (
        <div className="absolute top-20 right-4 md:top-8 md:right-8 z-20 w-full max-w-xs bg-[#05100a]/90 backdrop-blur-md border border-[#FFD700]/30 p-6 rounded-lg shadow-2xl text-sm max-h-[80vh] overflow-y-auto">
          <h2 className="text-[#FFD700] text-xl font-bold mb-4 border-b border-[#FFD700]/20 pb-2">Configuration</h2>
          
          {/* Title Input */}
          <div className="mb-4">
            <label className="block text-emerald-400 mb-1">Title</label>
            <input 
              type="text" 
              value={snap.title}
              onChange={(e) => appState.title = e.target.value}
              className="w-full bg-black/50 border border-emerald-800 text-[#FFD700] px-3 py-2 rounded focus:outline-none focus:border-[#FFD700]"
            />
          </div>

          {/* Snow Toggle */}
          <div className="mb-4 flex items-center gap-2">
             <input 
                type="checkbox"
                id="showStars"
                checked={snap.showStars}
                onChange={(e) => appState.showStars = e.target.checked}
                className="w-4 h-4 accent-[#FFD700] cursor-pointer"
             />
             <label htmlFor="showStars" className="text-emerald-400 cursor-pointer select-none">Let it Snow</label>
          </div>
          
          {/* Quality Toggle */}
          <div className="mb-4 flex items-center gap-2">
             <label className="text-emerald-400 cursor-pointer select-none flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${snap.quality === 'high' ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                Quality: {snap.quality.toUpperCase()}
             </label>
          </div>

          {/* BGM Upload */}
          <div className="mb-4">
            <label className="block text-emerald-400 mb-1">Background Music</label>
            <input 
              type="file" 
              accept="audio/*"
              onChange={handleBgmUpload}
              className="w-full text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#FFD700]/10 file:text-[#FFD700] hover:file:bg-[#FFD700]/20 cursor-pointer"
            />
            {snap.bgmUrl && <p className="text-xs text-green-500 mt-1">✓ Music Loaded</p>}
          </div>

          {/* Images Upload */}
          <div className="mb-6">
            <label className="block text-emerald-400 mb-1">
                Photos ({snap.images.length}/5)
            </label>
            <input 
              type="file" 
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              disabled={snap.images.length >= 5}
              className="w-full text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#FFD700]/10 file:text-[#FFD700] hover:file:bg-[#FFD700]/20 cursor-pointer disabled:opacity-50"
            />
            <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                {snap.images.map((img, i) => (
                    <div key={i} className="relative shrink-0 w-12 h-12 border border-emerald-800 rounded overflow-hidden group">
                        <img src={img} className="w-full h-full object-cover" />
                        <button 
                            onClick={() => appState.images.splice(i, 1)}
                            className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 text-xs"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
          </div>

          <button 
            onClick={() => appState.mode = 'play'}
            className="w-full bg-[#FFD700] text-black font-bold py-3 rounded hover:bg-[#E5C100] transition-colors shadow-[0_0_15px_rgba(255,215,0,0.3)]"
          >
            START SHOW ▶
          </button>
        </div>
      )}

      {/* Play Mode Exit */}
      {snap.mode === 'play' && (
        <div className="absolute top-0 right-0 w-32 h-32 z-50 flex items-start justify-end p-4 group">
            <button 
                onClick={() => appState.mode = 'edit'}
                className="bg-black/50 text-white px-4 py-2 rounded-full backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-900/80 text-sm border border-white/10 pointer-events-auto"
            >
                Exit Mode
            </button>
        </div>
      )}

      {/* Image Zoom Overlay */}
      {snap.activeImage && (
        <div 
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-8 cursor-zoom-out animate-fadeIn"
            onClick={() => appState.activeImage = null}
        >
            <img 
                src={snap.activeImage} 
                className="max-w-full max-h-full object-contain rounded-lg shadow-[0_0_50px_rgba(255,215,0,0.3)] border-2 border-[#FFD700] animate-scaleUp"
                alt="Zoomed view"
            />
            <p className="absolute bottom-8 text-white/50 text-sm animate-fadeIn">Click anywhere to close</p>
        </div>
      )}

      <Canvas
        shadows={snap.quality === 'high'}
        dpr={[1, 2]}
        camera={{ position: [0, 2, 28], fov: 45 }}
        gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.5 }}
      >
        {/* <PerformanceMonitor onDecline={() => appState.quality = 'low'} /> */}
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        
        <Suspense fallback={null}>
           {/* Environment Configuration */}
          <color attach="background" args={['#05100a']} />
          {snap.showStars && (
              <Sparkles 
                count={snap.quality === 'high' ? 2000 : 500} 
                scale={[50, 50, 50]} 
                size={0.4} 
                speed={0.2} 
                opacity={0.5} 
                color="#ffffff"
              />
          )}
          <Environment preset="lobby" />
          <fog attach="fog" args={['#05100a', 10, 50]} />
          
          {/* Lighting System - Dramatic */}
          <ambientLight intensity={0.5} color="#004225" />
          <spotLight 
            position={[10, 20, 10]} 
            angle={0.3} 
            penumbra={1} 
            intensity={200} 
            color="#FFD700" 
            castShadow={snap.quality === 'high'}
            shadow-mapSize={[1024, 1024]}
          />
          <pointLight position={[-10, -10, -10]} intensity={50} color="#ff0000" />

          {/* Core Content */}
          <InteractiveTree />
          
          {/* Controllers */}
          <OrbitControls 
            enableZoom={snap.mode === 'edit'} 
            enablePan={snap.mode === 'edit'} 
            dampingFactor={0.05} 
            autoRotate={true}
            autoRotateSpeed={0.5}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 2}
            makeDefault
          />

          {/* Cinematic Post-processing */}
          {snap.quality === 'high' && (
            <EffectComposer enableNormalPass={false} multisampling={0}>
                <Bloom 
                    luminanceThreshold={0.8} 
                    mipmapBlur 
                    intensity={1.5} 
                    radius={0.6}
                />
                <Vignette eskil={false} offset={0.1} darkness={1.1} />
            </EffectComposer>
          )}
        </Suspense>
      </Canvas>
    </div>
  )
}
