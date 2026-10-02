import { Suspense, useLayoutEffect, useMemo, useEffect, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { DEFAULT_BEHAVIOR } from '../config/behavior';
import { diag } from '../diag/diagStore';
import { computeFraming, devCloseFraming } from '../pet/framing';
import { RegisteredModel } from '../pet/models';
import { Pet } from '../pet/Pet';
import { useView } from '../pet/viewStore';
import { DebugOverlay } from './DebugOverlay';
import { Lighting } from './Lighting';
import { Room } from './Room';

interface Props {
  model: RegisteredModel;
  /** Ombres dynamiques (coûteuses : à couper pour isoler un problème). */
  shadows: boolean;
}

/** Caméra FIXE : cadrage calculé une fois par ratio d'écran. Aucun suivi, aucun zoom, aucun mouvement pendant l'usage. */
function Scene({ model, shadows }: Props) {
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const { devClose } = useView();
  // on arrondit le ratio : seul un vrai changement de fenêtre (rotation, redimensionnement) recalcule le cadrage
  const aspect = Math.round((size.width / Math.max(1, size.height)) * 100) / 100;
  const game = useMemo(() => computeFraming(aspect, DEFAULT_BEHAVIOR.approach.z), [aspect]);
  const view = useMemo(() => (devClose ? devCloseFraming(aspect) : game), [devClose, game, aspect]);

  useLayoutEffect(() => {
    camera.position.set(...view.position);
    camera.fov = view.fov;
    camera.near = view.near;
    camera.far = view.far;
    camera.lookAt(...view.target);
    camera.updateProjectionMatrix();
  }, [camera, view]);

  return (
    <>
      <Lighting shadows={shadows} />
      <Room />
      <Suspense fallback={null}>
        <Pet config={model.config} source={model.source} framing={game} />
      </Suspense>
      <DebugOverlay />
    </>
  );
}

/** Suspend la simulation et le rendu quand l'application passe en arrière-plan. */
function useAppActive() {
  const [active, setActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

export function PetCanvas({ model, shadows }: Props) {
  const active = useAppActive();
  return (
    <Canvas
      style={StyleSheet.absoluteFill}
      frameloop={active ? 'always' : 'never'}
      shadows={shadows ? 'percentage' : false}
      camera={{ position: [0, 0.85, 3], fov: 43.6, near: 0.1, far: 30 }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1;
        scene.background = new THREE.Color('#f7f3ec');
        diag.step('gl', 'ok', `Contexte 3D créé (WebGL2 : ${gl.capabilities.isWebGL2 ? 'oui' : 'non'}, ombres : ${shadows ? 'oui' : 'non'})`);
      }}
    >
      <Scene model={model} shadows={shadows} />
    </Canvas>
  );
}
