/* Fabrique une variante sans texture d'un GLB (couleur unie) pour isoler les problèmes de chargement de texture.
   Usage : node tools/make-notex.mjs assets/models/fox.glb assets/models/fox-notex.glb "#c4682a" */
import { NodeIO } from '@gltf-transform/core';

const [src, dst, hex = '#c4682a'] = process.argv.slice(2);
if (!src || !dst) { console.error('usage: node tools/make-notex.mjs <entrée.glb> <sortie.glb> [#couleur]'); process.exit(1); }
const n = parseInt(hex.slice(1), 16);
const lin = (v) => Math.pow(v / 255, 2.2);
const io = new NodeIO();
const doc = await io.read(src);
doc.getRoot().listMaterials().forEach((m) => {
  m.setBaseColorTexture(null).setNormalTexture(null).setOcclusionTexture(null).setMetallicRoughnessTexture(null).setEmissiveTexture(null);
  m.setBaseColorFactor([lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255), 1]).setMetallicFactor(0).setRoughnessFactor(0.85);
});
doc.getRoot().listTextures().forEach((t) => t.dispose());
await io.write(dst, doc);
console.log('écrit', dst);
