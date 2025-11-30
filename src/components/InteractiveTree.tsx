import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Image, Sparkles, Float } from '@react-three/drei'
import * as THREE from 'three'
import { useSnapshot } from 'valtio'
import { appState } from '../store'

// --- Constants ---
const TREE_HEIGHT = 18
const TREE_RADIUS = 7.5

// --- Helper: Star Shape Geometry ---
const StarGeometry = () => {
  const shape = useMemo(() => {
    const s = new THREE.Shape()
    const points = 5
    const outerRadius = 1.2
    const innerRadius = 0.6
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerRadius : innerRadius
      const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      if (i === 0) s.moveTo(x, y)
      else s.lineTo(x, y)
    }
    s.closePath()
    return s
  }, [])

  // Center geometry 
  return (
    <group>
       <mesh position={[0, 0, -0.15]}> {/* Center depth offset */}
        <extrudeGeometry args={[shape, { depth: 0.3, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1 }]} />
        <meshBasicMaterial color="#FFD700" toneMapped={false} />
       </mesh>
    </group>
  )
}

// --- Helper: Tree Particle System ---
const generateTreeParticles = (count: number, height: number, radius: number) => {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const types = new Float32Array(count) // 0: Leaf, 1: Ornament
  
  const color1 = new THREE.Color('#00ff88') // Neon Green
  const color2 = new THREE.Color('#00cc66') // Deep Green
  const color3 = new THREE.Color('#ffd700') // Gold
  const color4 = new THREE.Color('#ff3366') // Red Pink
  
  for (let i = 0; i < count; i++) {
    // FIXED: Use power > 1 to bias towards 0 (bottom), or invert the logic
    // t=0 (bottom) -> t=1 (top)
    // previously pow(rand, 0.8) biased towards 1 (top).
    // Now using pow(rand, 0.8) biases towards 1, making the base sparser but not too sparse.
    const k = Math.pow(Math.random(), 0.8)
    const t = k // 0 is bottom, 1 is top
    
    const rMax = radius * (1 - t) // Linear cone shape
    
    // Solid cone distribution
    const theta = Math.random() * Math.PI * 2
    const r = Math.sqrt(Math.random()) * rMax // Uniform distribution in circle
    
    // Add spiral structure on top for definition
    const spiralOffset = (t * 15 + Math.random() * 0.5) // Reduced twist slightly
    const x = r * Math.cos(theta + spiralOffset)
    const y = t * height - height / 2
    const z = r * Math.sin(theta + spiralOffset)

    positions[i * 3] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z
    
    // Colors & Types
    const rand = Math.random()
    let c = color1
    let size = Math.random()
    let type = 0.0 // Leaf
    
    if (rand > 0.92) { 
        c = color3; 
        size = 2.0 + Math.random(); 
        type = 1.0; // Gold Ornament
    } else if (rand > 0.85) { 
        c = color4; 
        size = 2.0 + Math.random(); 
        type = 1.0; // Red Ornament
    } else if (rand > 0.5) {
        c = color2
    }
    
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
    
    sizes[i] = size
    types[i] = type
  }
  
  return { positions, colors, sizes, types }
}

export const InteractiveTree = () => {
  const snap = useSnapshot(appState)
  const pointsRef = useRef<THREE.Points>(null)
  const photosRef = useRef<THREE.Group>(null)

  const particleCount = snap.quality === 'high' ? 8000 : 3000

  // 1. Generate Particles
  const { positions, colors, sizes, types } = useMemo(() => 
    generateTreeParticles(particleCount, TREE_HEIGHT, TREE_RADIUS), 
  [particleCount])

  // 2. Photo Layout
  const photoConfig = useMemo(() => {
    const configs = []
    for(let i=0; i<5; i++) {
       const t = (i + 1) / 6 
       const r = TREE_RADIUS * (1 - t) * 0.9 // Embedded in tree
       const theta = (i / 5) * Math.PI * 2
       
       configs.push({
          pos: [r * Math.cos(theta), t * TREE_HEIGHT - TREE_HEIGHT / 2, r * Math.sin(theta)] as [number, number, number],
          rot: [0, -theta + Math.PI/2, 0] as [number, number, number]
       })
    }
    return configs
  }, [])

  // 3. Custom Shader Material for Round Particles
  const shaderMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }
    },
    vertexShader: `
      attribute float size;
      attribute float type; // 0: Leaf, 1: Ornament
      varying vec3 vColor;
      varying float vType;
      varying vec3 vPos; 

      void main() {
        vColor = color;
        vPos = position;
        vType = type;

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        // Scaled by view depth
        gl_PointSize = size * (100.0 / -mvPosition.z); 
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vColor;
      varying float vType;
      varying vec3 vPos;
      
      void main() {
        // Soft Circular particle distance
        float d = length(gl_PointCoord - vec2(0.5));
        
        // Soft edge falloff instead of discard
        float alphaShape = smoothstep(0.5, 0.4, d);
        
        // Twinkle logic for ornaments only
        float brightness = 1.0;
        if (vType > 0.5) {
            // Ornament
            float seed = dot(vPos, vec3(12.9898, 78.233, 45.164));
            float flash = sin(uTime * 3.0 + seed);
            brightness = 0.8 + 0.4 * flash; // Flash brighter
        } else {
            // Leaves: reduce base alpha to prevent whiteout from additive blending
            alphaShape *= 0.6; 
        }

        if (alphaShape < 0.01) discard; // Optimization for very transparent pixels

        gl_FragColor = vec4(vColor * brightness, alphaShape); 
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (pointsRef.current) pointsRef.current.rotation.y = t * 0.1
    if (photosRef.current) photosRef.current.rotation.y = t * 0.1
    shaderMaterial.uniforms.uTime.value = t
  })

  return (
    <group position={[0, -2, 0]}>
      
      {/* --- Particle System --- */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={colors.length / 3} array={colors} itemSize={3} />
          <bufferAttribute attach="attributes-size" count={sizes.length} array={sizes} itemSize={1} />
          <bufferAttribute attach="attributes-type" count={types.length} array={types} itemSize={1} />
        </bufferGeometry>
        <primitive object={shaderMaterial} attach="material" />
      </points>

      {/* --- User Photos (Double Sided) --- */}
      <group ref={photosRef}>
         {snap.images.map((url, i) => {
            if (i >= photoConfig.length) return null
            const cfg = photoConfig[i]
            return (
              <group key={url} position={cfg.pos} rotation={cfg.rot}>
                 <Float speed={2} rotationIntensity={0.1} floatIntensity={0.2}>
                    <group onClick={(e) => { e.stopPropagation(); appState.activeImage = url }}>
                        {/* Frame Front */}
                        <mesh position={[0, 0, -0.02]}>
                            <boxGeometry args={[1.6, 2.1, 0.05]} />
                            <meshStandardMaterial color="#fff" side={THREE.DoubleSide} />
                        </mesh>
                        
                        {/* Image (Front & Back) */}
                        <Image 
                            url={url} 
                            position={[0, 0, 0.02]} 
                            scale={[1.5, 2]}
                            transparent
                            side={THREE.DoubleSide}
                            onPointerOver={() => document.body.style.cursor = 'zoom-in'}
                            onPointerOut={() => document.body.style.cursor = 'auto'}
                        />
                        {/* Backside Pattern (Optional aesthetic) */}
                        <mesh position={[0, 0, -0.05]} rotation={[0, Math.PI, 0]}>
                             <planeGeometry args={[1.5, 2]} />
                             <meshStandardMaterial color="#e0e0e0" />
                        </mesh>
                    </group>
                 </Float>
              </group>
            )
         })}
      </group>

      {/* --- Star Topper --- */}
      <group position={[0, TREE_HEIGHT/2, 0]}>
          <Float speed={4} rotationIntensity={0.5} floatIntensity={0.5}>
             <StarGeometry />
            <Sparkles count={40} scale={5} color="#FFD700" speed={0.6} size={4} />
          </Float>
      </group>

    </group>
  )
}
