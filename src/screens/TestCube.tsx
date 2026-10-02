import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { diag } from '../diag/diagStore';

function Cube() {
  const ref = useRef<THREE.Mesh>(null);
  const first = useRef(false);
  useFrame((_, dt) => {
    if (!first.current) { first.current = true; diag.step('frame', 'ok', 'Première image dessinée (le cube tourne)'); }
    if (ref.current) { ref.current.rotation.y += dt * 1.2; ref.current.rotation.x += dt * 0.5; }
  });
  return (
    <mesh ref={ref}>
      <boxGeometry args={[1.2, 1.2, 1.2]} />
      <meshStandardMaterial color="#749B83" roughness={0.6} />
    </mesh>
  );
}

/** Test 1 : rendu 3D seul, sans aucun fichier. Valide expo-gl + React Three Fiber. */
export function TestCube() {
  useEffect(() => { diag.step('gl', 'run', 'Création du contexte 3D…'); }, []);
  return (
    <Canvas
      style={StyleSheet.absoluteFill}
      camera={{ position: [0, 0, 4], fov: 45 }}
      onCreated={({ gl, scene }) => {
        scene.background = new THREE.Color('#f7f3ec');
        diag.step('gl', 'ok', `Contexte 3D créé (WebGL2 : ${gl.capabilities.isWebGL2 ? 'oui' : 'non'})`);
      }}
    >
      <ambientLight intensity={1.2} />
      <directionalLight position={[2, 3, 4]} intensity={2} />
      <Cube />
    </Canvas>
  );
}
