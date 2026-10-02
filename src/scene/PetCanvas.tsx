import { Suspense } from 'react';
import { StyleSheet } from 'react-native';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { ACTIVE_MODEL } from '../pet/models';
import { Pet } from '../pet/Pet';
import { Lighting } from './Lighting';
import { Room } from './Room';

/** Caméra fixe (≈ 45 mm en portrait), aucun mouvement pendant l'utilisation. */
export function PetCanvas() {
  return (
    <Canvas
      style={StyleSheet.absoluteFill}
      shadows="percentage"
      camera={{ position: [0, 1.55, 4.7], fov: 43.6, near: 0.1, far: 30 }}
      onCreated={({ gl, camera, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1;
        scene.background = new THREE.Color('#f7f3ec');
        camera.lookAt(0, 0.3, 0);
      }}
    >
      <Lighting />
      <Room />
      <Suspense fallback={null}>
        <Pet config={ACTIVE_MODEL.config} source={ACTIVE_MODEL.source} />
      </Suspense>
    </Canvas>
  );
}
