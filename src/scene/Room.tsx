import { ROOM } from '../config/pet';
import { SOFA } from '../pet/layout';

/** Pièce de test : sol, deux murs, tapis, un volume de canapé. Géométrie simple, sans texture. */
export function Room() {
  const { width: W, depth: D, height: H } = ROOM;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#d9c3a0" roughness={0.62} metalness={0} />
      </mesh>
      <mesh position={[0, H / 2, -D / 2]} receiveShadow>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color="#f4efe3" roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[-W / 2, H / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[D, H]} />
        <meshStandardMaterial color="#eee7d8" roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[0.15, 0.004, 0.1]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.05, 48]} />
        <meshStandardMaterial color="#e6dfcf" roughness={1} metalness={0} />
      </mesh>
      <group position={[(SOFA.minX + SOFA.maxX) / 2, 0, (SOFA.minZ + SOFA.maxZ) / 2]}>
        <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[SOFA.maxX - SOFA.minX, 0.4, SOFA.maxZ - SOFA.minZ]} />
          <meshStandardMaterial color="#8aa595" roughness={0.95} metalness={0} />
        </mesh>
        <mesh position={[0, 0.55, -0.33]} castShadow receiveShadow>
          <boxGeometry args={[SOFA.maxX - SOFA.minX, 0.5, 0.14]} />
          <meshStandardMaterial color="#7f9a8b" roughness={0.95} metalness={0} />
        </mesh>
      </group>
    </group>
  );
}
