import { Suspense } from 'react';
import { StyleSheet } from 'react-native';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { diag } from '../diag/diagStore';
import { RegisteredModel } from '../pet/models';
import { Pet } from '../pet/Pet';
import { Lighting } from './Lighting';
import { Room } from './Room';

interface Props {
  model: RegisteredModel;
  /** Ombres dynamiques (coûteuses : à couper pour isoler un problème). */
  shadows: boolean;
}

/** Caméra fixe (≈ 45 mm en portrait), aucun mouvement pendant l'utilisation. */
export function PetCanvas({ model, shadows }: Props) {
  return (
    <Canvas
      style={StyleSheet.absoluteFill}
      shadows={shadows ? 'percentage' : false}
      camera={{ position: [0, 1.55, 4.7], fov: 43.6, near: 0.1, far: 30 }}
      onCreated={({ gl, camera, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1;
        scene.background = new THREE.Color('#f7f3ec');
        camera.lookAt(0, 0.3, 0);
        diag.step('gl', 'ok', `Contexte 3D créé (WebGL2 : ${gl.capabilities.isWebGL2 ? 'oui' : 'non'}, ombres : ${shadows ? 'oui' : 'non'})`);
      }}
    >
      <Lighting shadows={shadows} />
      <Room />
      <Suspense fallback={null}>
        <Pet config={model.config} source={model.source} />
      </Suspense>
    </Canvas>
  );
}
