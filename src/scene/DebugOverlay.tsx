import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { overlayData, useView } from '../pet/viewStore';

/** Superposition de debug (facultative) : points d'intérêt, chemin, rayon d'arrivée, contacts des pattes. */
export function DebugOverlay() {
  const { overlay } = useView();
  const ringGeo = useMemo(() => new THREE.RingGeometry(0.94, 1, 40), []);
  const line = useRef<THREE.Line>(null);
  const arrive = useRef<THREE.Mesh>(null);
  const plants = useRef<THREE.Group>(null);
  const poiGroup = useRef<THREE.Group>(null);
  const lineGeo = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), []);
  const sphere = useMemo(() => new THREE.SphereGeometry(0.012, 8, 6), []);
  const plantMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#d9534f' }), []);
  const lineObj = useMemo(() => new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#e0a800' })), [lineGeo]);
  const poiMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#2e86ab', transparent: true, opacity: 0.8, side: THREE.DoubleSide }), []);

  useFrame(() => {
    if (!overlay) return;
    const t = overlayData.target;
    if (line.current) {
      line.current.visible = !!t;
      if (t) { lineGeo.setFromPoints([new THREE.Vector3(overlayData.pos.x, 0.01, overlayData.pos.z), new THREE.Vector3(t.x, 0.01, t.z)]); }
    }
    if (arrive.current) {
      arrive.current.visible = !!t;
      if (t) { arrive.current.position.set(t.x, 0.012, t.z); arrive.current.scale.setScalar(overlayData.arriveRadius); }
    }
    if (poiGroup.current) {
      const g = poiGroup.current, list = overlayData.pois;
      while (g.children.length < list.length) g.add(new THREE.Mesh(ringGeo, poiMat));
      g.children.forEach((c, i) => { c.visible = i < list.length; if (i < list.length) { c.position.set(list[i].x, 0.011, list[i].z); c.rotation.x = -Math.PI / 2; c.scale.setScalar(list[i].r); } });
    }
    if (plants.current) {
      const list = overlayData.plants;
      while (plants.current.children.length < list.length) plants.current.add(new THREE.Mesh(sphere, plantMat));
      plants.current.children.forEach((c, i) => { c.visible = i < list.length; if (i < list.length) c.position.set(list[i].x, list[i].y, list[i].z); });
    }
  });

  if (!overlay) return null;
  return (
    <group>
      <group ref={poiGroup} />
      <mesh ref={arrive} geometry={ringGeo} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color="#e0a800" side={THREE.DoubleSide} />
      </mesh>
      <primitive object={lineObj} ref={line} />
      <group ref={plants} />
    </group>
  );
}
