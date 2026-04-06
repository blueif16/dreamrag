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

  vec4 mvPos = modelViewMatrix * vec4(mixed, 1.0);
  gl_Position = projectionMatrix * mvPos;
  gl_PointSize = uSize * uDissolve * (1.0 / -mvPos.z);
}
`;

export const particleFragment = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uProgress;
uniform float uUseVertexColors;
uniform float uDissolve;
varying float vNoise;
varying vec3 vColor;

void main() {
  vec2 uv = gl_PointCoord;
  float d = length(uv - 0.5);

  // Soft circular particle
  if (d > 0.5) discard;
  float alpha = smoothstep(0.5, 0.15, d);

  // Color: blend between vertex colors and uniform colors based on morph progress
  vec3 uniformColor;
  if (uProgress < 1.0) {
    uniformColor = mix(uColorA, uColorB, vNoise);
  } else {
    uniformColor = mix(uColorB, uColorC, vNoise);
  }

  // When at model 1 (uProgress near 0), use vertex colors; morph toward uniform colors
  float colorBlend = smoothstep(0.0, 0.5, uProgress);
  // Boost vertex colors — make more vivid
  vec3 boostedColor = vColor * 1.1;
  vec3 color = mix(boostedColor, uniformColor, colorBlend);

  gl_FragColor = vec4(color, alpha * uDissolve);
}
`;
