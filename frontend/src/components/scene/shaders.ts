export const particleVertex = /* glsl */ `
uniform float uTime;
uniform float uProgress;
uniform float uSize;
uniform float uDissolve; // 0 = hidden, 1 = fully visible
attribute vec3 aPositionTarget1;
attribute vec3 aPositionTarget2;
attribute float aNoise;
attribute vec3 aColor;
varying float vNoise;
varying vec3 vColor;
varying float vCenterDist; // distance from silhouette center, for gold core
varying float vHue;        // secondary random for iridescent hue shifting

void main() {
  vec3 start, end;
  float localProgress;

  if (uProgress < 1.0) {
    start = position;
    end = aPositionTarget1;
    localProgress = uProgress;
  } else {
    start = aPositionTarget1;
    end = aPositionTarget2;
    localProgress = uProgress - 1.0;
  }

  // Staggered: each particle has its own delay window
  float duration = 0.4;
  float delay = (1.0 - duration) * aNoise;
  float progress = smoothstep(delay, delay + duration, localProgress);

  vec3 mixed = mix(start, end, progress);

  // Idle float — gentle 3-axis
  mixed.y += sin(uTime * 0.5 + aNoise * 6.28) * 0.05;
  mixed.x += cos(uTime * 0.3 + aNoise * 4.0) * 0.03;
  mixed.z += sin(uTime * 0.4 + aNoise * 3.14) * 0.02;

  vNoise = aNoise;
  vColor = aColor;
  vCenterDist = length(mixed);
  // derive a decorrelated second random from aNoise so hue banding doesn't align with stagger
  vHue = fract(sin(aNoise * 91.345) * 43758.5453);

  vec4 mvPos = modelViewMatrix * vec4(mixed, 1.0);
  gl_Position = projectionMatrix * mvPos;
  gl_PointSize = uSize * uDissolve * (1.0 / -mvPos.z);
}
`;

export const particleFragment = /* glsl */ `
uniform vec3 uColorCottonPink;
uniform vec3 uColorPowderBlue;
uniform vec3 uColorLilac;
uniform vec3 uColorPeachBlush;
uniform vec3 uColorGold;
uniform float uProgress;
uniform float uUseVertexColors;
uniform float uDissolve;
varying float vNoise;
varying vec3 vColor;
varying float vCenterDist;
varying float vHue;

// Iridescent 4-way blend across the cloud palette.
// Peach blush is kept to ~5% (only when vHue > 0.95).
vec3 iridescent(float h) {
  // Primary three share the spectrum evenly; peach blush is a rare minority.
  if (h < 0.33) {
    return mix(uColorCottonPink, uColorLilac, h / 0.33);
  } else if (h < 0.66) {
    return mix(uColorLilac, uColorPowderBlue, (h - 0.33) / 0.33);
  } else if (h < 0.95) {
    return mix(uColorPowderBlue, uColorCottonPink, (h - 0.66) / 0.29);
  } else {
    // ~5% peach blush accents
    return uColorPeachBlush;
  }
}

void main() {
  vec2 uv = gl_PointCoord;
  float d = length(uv - 0.5);

  // Soft circular particle with a slightly brighter core — pearlescent feel
  if (d > 0.5) discard;
  float alpha = smoothstep(0.5, 0.15, d);
  float core = smoothstep(0.35, 0.0, d); // inner glow

  // Iridescent cloud color from the decorrelated hue random
  vec3 cloudColor = iridescent(vHue);

  // Gold sprinkle: only at the densest core of the silhouette (close to origin)
  // and for ~4% of particles. Echoes the gold stars hanging from the cloud.
  float goldMask = step(vHue, 0.04) * (1.0 - smoothstep(0.25, 0.75, vCenterDist));
  cloudColor = mix(cloudColor, uColorGold, goldMask);

  // When at model 1 (uProgress near 0), use vertex colors from the GLB;
  // morph toward the iridescent cloud palette for whale + sphere stages.
  float colorBlend = smoothstep(0.0, 0.5, uProgress);
  vec3 boostedColor = vColor * 1.1;
  vec3 color = mix(boostedColor, cloudColor, colorBlend);

  // Subtle pearlescent highlight — lift the inner core toward white
  color += vec3(core * 0.15);

  gl_FragColor = vec4(color, alpha * uDissolve);
}
`;
