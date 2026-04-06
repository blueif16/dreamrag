import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";

/**
 * Read a Three.js Texture into raw RGBA pixel data via OffscreenCanvas.
 */
function textureToImageData(texture: THREE.Texture): ImageData {
  const image = texture.image as HTMLImageElement | ImageBitmap;
  const w = image.width;
  const h = image.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image as CanvasImageSource, 0, 0);
  return ctx.getImageData(0, 0, w, h);
}

/**
 * Sample `count` points from a mesh surface.
 * Returns positions (Float32Array, count*3) and colors (Float32Array, count*3).
 * Colors are sampled from the mesh's baseColor texture via UV lookup.
 */
export function sampleMeshWithColors(
  mesh: THREE.Mesh,
  count: number
): { positions: Float32Array; colors: Float32Array } {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  // Bake world transform into geometry so positions are in world space
  const geo = mesh.geometry.clone();
  mesh.updateMatrixWorld(true);
  geo.applyMatrix4(mesh.matrixWorld);

  const samplerMesh = new THREE.Mesh(geo, mesh.material);
  const sampler = new MeshSurfaceSampler(samplerMesh).build();

  // Try to get the base color texture for color sampling
  let imageData: ImageData | null = null;
  let texW = 0;
  let texH = 0;
  const mat = mesh.material as THREE.MeshStandardMaterial;
  if (mat.map && mat.map.image) {
    try {
      imageData = textureToImageData(mat.map);
      texW = imageData.width;
      texH = imageData.height;
    } catch {
      // Fallback: no color sampling
    }
  }

  const hasUV = !!geo.attributes.uv;
  const tmpPos = new THREE.Vector3();
  const tmpNormal = new THREE.Vector3();
  // We need to sample UV manually since MeshSurfaceSampler doesn't directly output UV
  // Instead we'll use a workaround: add a color attribute derived from UV+texture

  // If we have texture + UV, we sample with a face-based approach
  const posAttr = geo.attributes.position;
  const uvAttr = geo.attributes.uv as THREE.BufferAttribute | undefined;
  const indexAttr = geo.index;

  for (let i = 0; i < count; i++) {
    sampler.sample(tmpPos, tmpNormal);
    positions[i * 3] = tmpPos.x;
    positions[i * 3 + 1] = tmpPos.y;
    positions[i * 3 + 2] = tmpPos.z;

    // Default color: white
    colors[i * 3] = 1;
    colors[i * 3 + 1] = 1;
    colors[i * 3 + 2] = 1;
  }

  // If we have UV + texture, do a second pass to find approximate colors
  // by finding nearest vertex UV for each sampled position
  if (imageData && uvAttr) {
    // Build a simple spatial lookup: for each sampled point, find closest vertex
    const vertCount = posAttr.count;
    const vertPositions: THREE.Vector3[] = [];
    const vertUVs: THREE.Vector2[] = [];
    for (let v = 0; v < vertCount; v++) {
      vertPositions.push(
        new THREE.Vector3(posAttr.getX(v), posAttr.getY(v), posAttr.getZ(v))
      );
      vertUVs.push(new THREE.Vector2(uvAttr.getX(v), uvAttr.getY(v)));
    }

    // For performance with 25k particles, use a grid-based nearest lookup
    // Simple brute force with stride sampling of vertices
    const stride = Math.max(1, Math.floor(vertCount / 5000)); // sample ~5000 verts for lookup
    const sampledVerts: { pos: THREE.Vector3; uv: THREE.Vector2 }[] = [];
    for (let v = 0; v < vertCount; v += stride) {
      sampledVerts.push({ pos: vertPositions[v], uv: vertUVs[v] });
    }

    const data = imageData.data;
    for (let i = 0; i < count; i++) {
      const px = positions[i * 3];
      const py = positions[i * 3 + 1];
      const pz = positions[i * 3 + 2];

      // Find nearest sampled vertex
      let bestDist = Infinity;
      let bestUV = sampledVerts[0].uv;
      for (let v = 0; v < sampledVerts.length; v++) {
        const vp = sampledVerts[v].pos;
        const dx = px - vp.x;
        const dy = py - vp.y;
        const dz = pz - vp.z;
        const dist = dx * dx + dy * dy + dz * dz;
        if (dist < bestDist) {
          bestDist = dist;
          bestUV = sampledVerts[v].uv;
        }
      }

      // UV → pixel
      const u = ((bestUV.x % 1) + 1) % 1;
      const v = ((bestUV.y % 1) + 1) % 1;
      const pixX = Math.floor(u * (texW - 1));
      const pixY = Math.floor((1 - v) * (texH - 1)); // flip Y
      const idx = (pixY * texW + pixX) * 4;
      colors[i * 3] = data[idx] / 255;
      colors[i * 3 + 1] = data[idx + 1] / 255;
      colors[i * 3 + 2] = data[idx + 2] / 255;
    }
  }

  geo.dispose();
  return { positions, colors };
}
