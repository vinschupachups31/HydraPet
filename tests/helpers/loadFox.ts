import { NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

/** Charge le vrai modèle dans Node (sans texture : inutile pour le squelette), prêt à animer. */
export async function loadFox(path = 'assets/models/fox.glb') {
  const io = new NodeIO();
  const doc = await io.read(path);
  doc.getRoot().listMaterials().forEach((m) => m.setBaseColorTexture(null));
  doc.getRoot().listTextures().forEach((t) => t.dispose());
  const bin = await io.writeBinary(doc);
  const gltf = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((res, rej) =>
    new GLTFLoader().parse(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer, '', res as never, rej));
  const root = clone(gltf.scene) as THREE.Group;
  return { root, animations: gltf.animations };
}
