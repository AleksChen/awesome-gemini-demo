import * as THREE from 'three'

// Helper: Generate random point in a cone (Tree Target)
export const getRandomPointInCone = (height: number, radius: number) => {
  const y = Math.random() * height // 0 to height
  const rAtHeight = (1 - y / height) * radius
  const angle = Math.random() * Math.PI * 2
  const r = Math.sqrt(Math.random()) * rAtHeight // Uniform distribution
  
  const x = r * Math.cos(angle)
  const z = r * Math.sin(angle)
  return new THREE.Vector3(x, y - height / 2, z)
}
