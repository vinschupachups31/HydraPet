import { Suspense, useLayoutEffect, useMemo, useEffect, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { DEFAULT_BEHAVIOR } from '../config/behavior';
import { diag } from '../diag/diagStore';
import { computeFraming, devCloseFraming } from '../pet/framing';
import { RegisteredModel } from '../pet/models';
import { Pet } from '../pet/Pet';
import { overlayData, useView } from '../pet/viewStore';
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
  const { devClose, devSide, devThree, devFront } = useView();
  // on arrondit le ratio : seul un vrai changement de fenêtre (rotation, redimensionnement) recalcule le cadrage
  const aspect = Math.round((size.width / Math.max(1, size.height)) * 100) / 100;
  const game = useMemo(() => computeFraming(aspect, DEFAULT_BEHAVIOR.approach.z), [aspect]);
  const view = useMemo(() => (devClose ? devCloseFraming(aspect) : game), [devClose, game, aspect]);
  void devSide; void devThree; void devFront;

  useLayoutEffect(() => {
    camera.position.set(...view.position);
    camera.fov = view.fov;
    camera.near = view.near;
    camera.far = view.far;
    camera.lookAt(...view.target);
    camera.updateProjectionMatrix();
  }, [camera, view]);

  // caméra de profil de développement : suit l'animal pour juger les postures de côté (la caméra de jeu reste fixe, cette vue n'existe qu'en dev)
  useFrame(() => {
    if (devFront) { // de face (transfert de poids, patte/visage) : la caméra se place devant l'animal, selon son cap
      const { x, z, heading } = overlayData.pos as { x: number; z: number; heading?: number }, d = Math.max(0.9, Math.min(2.4, 0.42 / (Math.tan(15 * Math.PI / 180) * camera.aspect))), h = heading ?? 0;
      camera.position.set(x + Math.sin(h) * d, 0.26, z + Math.cos(h) * d); camera.fov = 30; camera.lookAt(x, 0.17, z); camera.updateProjectionMatrix();
      return;
    }
    if (devThree) { // trois quarts de développement, plus près : couchage, réveil, toilette
      const { x, z } = overlayData.pos, d = Math.max(1.0, Math.min(2.6, 0.5 / (Math.tan(15 * Math.PI / 180) * camera.aspect)));
      camera.position.set(x + d * 0.72, 0.34, z + d * 0.72); camera.fov = 30; camera.lookAt(x, 0.13, z); camera.updateProjectionMatrix();
      return;
    }
    if (!devSide) return;
    const { x, z } = overlayData.pos;
    const d = Math.max(1.9, Math.min(3.4, 0.62 / (Math.tan(13 * Math.PI / 180) * camera.aspect))); // assez loin pour cadrer l'animal entier en portrait comme en paysage
    camera.position.set(x + d, 0.2, z);
    camera.fov = 26;
    camera.lookAt(x, 0.15, z);
    camera.updateProjectionMatrix();
  });

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
