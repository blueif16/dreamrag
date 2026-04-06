import * as THREE from "three";

// Generate a cloud-like shape: icosahedron with noise displacement
function generateCloud(count: number): Float32Array {
  const positions = new Float32Array(count * 3);
  const geo = new THREE.IcosahedronGeometry(1.2, 4);
  const posAttr = geo.attributes.position;
  const vertexCount = posAttr.count;

  for (let i = 0; i < count; i++) {
    // Pick a random vertex and add noise
    const vi = Math.floor(Math.random() * vertexCount);
    const x = posAttr.getX(vi);
    const y = posAttr.getY(vi);
    const z = posAttr.getZ(vi);

    // Noise displacement for puffy cloud look
    const noise = 0.3 + Math.random() * 0.5;
    positions[i * 3] = x * noise + (Math.random() - 0.5) * 0.4;
    positions[i * 3 + 1] = y * noise * 0.6 + 0.8 + (Math.random() - 0.5) * 0.3;
    positions[i * 3 + 2] = z * noise + (Math.random() - 0.5) * 0.4;
  }

  geo.dispose();
  return positions;
}

// Generate a crescent moon shape
function generateMoon(count: number): Float32Array {
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 0.6 + Math.random() * 0.05;

    let x = r * Math.sin(phi) * Math.cos(theta);
    let y = r * Math.sin(phi) * Math.sin(theta) - 1.0;
    const z = r * Math.cos(phi);

    // Subtract inner sphere to create crescent
    const innerX = x + 0.35;
    const innerDist = Math.sqrt(innerX * innerX + (y + 1.0) * (y + 1.0) + z * z);
    if (innerDist < 0.55) {
      // Push point outward
      x -= 0.4;
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }

  return positions;
}

// Generate scattered stars
function generateStars(count: number): Float32Array {
  const positions = new Float32Array(count * 3);
  const starCount = 5;
  const perStar = Math.floor(count / starCount);

  for (let s = 0; s < starCount; s++) {
    // Random position around the scene
    const cx = (Math.random() - 0.5) * 2.5;
    const cy = (Math.random() - 0.5) * 2.0;
    const cz = (Math.random() - 0.5) * 1.0;
    const scale = 0.08 + Math.random() * 0.12;

    for (let i = 0; i < perStar; i++) {
      const idx = (s * perStar + i) * 3;
      // Star shape: 5-pointed using angular distribution
      const angle = Math.random() * Math.PI * 2;
      const spike = Math.cos(angle * 2.5) * 0.5 + 0.5; // creates 5 spikes
      const dist = (0.3 + spike * 0.7) * scale;

      positions[idx] = cx + Math.cos(angle) * dist;
      positions[idx + 1] = cy + Math.sin(angle) * dist;
      positions[idx + 2] = cz + (Math.random() - 0.5) * scale * 0.3;
    }

    // Fill remaining
    if (s === starCount - 1) {
      for (let i = s * perStar + perStar; i < count; i++) {
        const idx = i * 3;
        positions[idx] = cx + (Math.random() - 0.5) * scale;
        positions[idx + 1] = cy + (Math.random() - 0.5) * scale;
        positions[idx + 2] = cz + (Math.random() - 0.5) * scale * 0.3;
      }
    }
  }

  return positions;
}

// Generate whale shape: ellipsoid body + tail
function generateWhale(count: number): Float32Array {
  const positions = new Float32Array(count * 3);
  const bodyCount = Math.floor(count * 0.75);
  const tailCount = count - bodyCount;

  // Body: stretched ellipsoid
  for (let i = 0; i < bodyCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 0.9 + Math.random() * 0.05;

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta) * 1.8; // elongated
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.7;
    positions[i * 3 + 2] = r * Math.cos(phi) * 0.8;
  }

  // Tail: flattened fluke
  for (let i = 0; i < tailCount; i++) {
    const idx = (bodyCount + i) * 3;
    const t = Math.random();
    const spread = t * 0.8;

    positions[idx] = -1.8 - t * 1.2 + (Math.random() - 0.5) * 0.1;
    positions[idx + 1] = (Math.random() - 0.5) * 0.15;
    positions[idx + 2] = (Math.random() - 0.5) * spread;
  }

  return positions;
}

// Generate a large full moon
function generateBigMoon(count: number): Float32Array {
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 1.5 + Math.random() * 0.08;

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }

  return positions;
}

export { generateWhale, generateBigMoon };

export type ModelName = "dreamScene" | "whale" | "bigMoon";

/** Generate all 3 model position arrays with the same particle count */
export function generateAllPositions(particleCount: number) {
  // Model 1: cloud + moon + stars combined
  const cloudCount = Math.floor(particleCount * 0.45);
  const moonCount = Math.floor(particleCount * 0.3);
  const starCount = particleCount - cloudCount - moonCount;

  const cloud = generateCloud(cloudCount);
  const moon = generateMoon(moonCount);
  const stars = generateStars(starCount);

  // Merge into one array
  const dreamScene = new Float32Array(particleCount * 3);
  dreamScene.set(cloud, 0);
  dreamScene.set(moon, cloudCount * 3);
  dreamScene.set(stars, (cloudCount + moonCount) * 3);

  const whale = generateWhale(particleCount);
  const bigMoon = generateBigMoon(particleCount);

  return { dreamScene, whale, bigMoon };
}
