/** Fenêtre à gauche (~4 800 K, lumière chaude), ambiance neutre chaude avec léger appoint froid. */
export function Lighting({ shadows = true }: { shadows?: boolean }) {
  return (
    <>
      <hemisphereLight args={['#fff1e0', '#c6d2dc', 1.5]} />
      <directionalLight
        color="#ffe0bd"
        intensity={2.6}
        position={[-3.2, 3.4, 1.6]}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-camera-near={0.5}
        shadow-camera-far={10}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />
    </>
  );
}
