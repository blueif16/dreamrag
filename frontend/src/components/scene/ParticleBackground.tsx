"use client";

import { useRef, useMemo, useCallback, Suspense } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { sampleMeshWithColors } from "./sampleMesh";
import { generateWhale, generateBigMoon } from "./geometries";
import { particleVertex, particleFragment } from "./shaders";

const PARTICLE_COUNT = 50000;
const COLORS = {
  a: new THREE.Color("#ffd1ec"),
  b: new THREE.Color("#a8d8ff"),
  c: new THREE.Color("#fff4a8"),
};

// Module-level progress — GSAP ScrollTrigger writes here, useFrame reads
export const scrollProgress = { value: 0 };
export const dissolveProgress = { value: 0 };

function Particles() {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const gltf = useLoader(GLTFLoader, "/models.glb");

  const { geometry, uniforms } = useMemo(() => {
    let targetMesh: THREE.Mesh | null = null;
    gltf.scene.traverse((child) => {
      if (!targetMesh && (child as THREE.Mesh).isMesh) {
        targetMesh = child as THREE.Mesh;
      }
    });

    let model1Positions: Float32Array;
    let model1Colors: Float32Array;

    if (targetMesh) {
      const result = sampleMeshWithColors(targetMesh, PARTICLE_COUNT);
      model1Positions = result.positions;
      model1Colors = result.colors;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        model1Positions[i * 3] = model1Positions[i * 3] * 1.4 - 1.0;
        model1Positions[i * 3 + 1] = model1Positions[i * 3 + 1] * 1.4;
        model1Positions[i * 3 + 2] = model1Positions[i * 3 + 2] * 1.4;
      }
    } else {
      model1Positions = new Float32Array(PARTICLE_COUNT * 3);
      model1Colors = new Float32Array(PARTICLE_COUNT * 3).fill(1);
    }

    const model2Positions = generateWhale(PARTICLE_COUNT);
    const model3Positions = generateBigMoon(PARTICLE_COUNT);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(model1Positions, 3));
    geo.setAttribute("aPositionTarget1", new THREE.BufferAttribute(model2Positions, 3));
    geo.setAttribute("aPositionTarget2", new THREE.BufferAttribute(model3Positions, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(model1Colors, 3));

    const aNoise = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) aNoise[i] = Math.random();
    geo.setAttribute("aNoise", new THREE.BufferAttribute(aNoise, 1));

    const u = {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uSize: { value: 28.0 },
      uColorA: { value: COLORS.a },
      uColorB: { value: COLORS.b },
      uColorC: { value: COLORS.c },
      uUseVertexColors: { value: 1.0 },
      uDissolve: { value: 0 },
    };

    return { geometry: geo, uniforms: u };
  }, [gltf]);

  useFrame((_, delta) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value += delta;
    matRef.current.uniforms.uProgress.value = scrollProgress.value;
    matRef.current.uniforms.uDissolve.value = dissolveProgress.value;
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={matRef}
        vertexShader={particleVertex}
        fragmentShader={particleFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </points>
  );
}

function GhostMesh() {
  const gltf = useLoader(GLTFLoader, "/models.glb");
  const groupRef = useRef<THREE.Group>(null);

  const clonedScene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const oldMat = mesh.material as THREE.MeshStandardMaterial;
        const newMat = oldMat.clone();
        newMat.transparent = true;
        newMat.opacity = 1;
        newMat.depthWrite = false;
        // Boost vibrancy — slightly increase emissive to bring out original colors
        if (newMat.color) newMat.color.multiplyScalar(1.15);
        newMat.emissive = newMat.emissive || new THREE.Color(0x000000);
        newMat.emissiveIntensity = 0.15;
        newMat.envMapIntensity = 1.5;
        mesh.material = newMat;
      }
    });
    return clone;
  }, [gltf]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Subtle auto-rotation
    groupRef.current.rotation.y += 0.1 * delta;

    // Drive opacity from dissolveProgress
    const opacity = 1 - smoothstep(0, 1, dissolveProgress.value);
    const visible = opacity > 0.01;
    groupRef.current.visible = visible;

    if (visible) {
      groupRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
          mat.opacity = opacity;
        }
      });
    }
  });

  return (
    <group ref={groupRef} scale={[1.4, 1.4, 1.4]} position={[-1.0, 0, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export default function ParticleBackground() {
  const onCreated = useCallback((state: { gl: THREE.WebGLRenderer }) => {
    state.gl.setClearColor(0x000000, 0);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        opacity: 0,
        animation: "fadeIn 2s ease-out 0.5s forwards",
      }}
    >
      <style>{`@keyframes fadeIn { to { opacity: 1; } }`}</style>
      <Canvas
        camera={{ position: [0, 0, 4.5], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: false }}
        onCreated={onCreated}
      >
        <ambientLight intensity={1.2} />
        <hemisphereLight args={[0xb6d5ff, 0xd4cec4, 0.6]} />
        <directionalLight position={[3, 4, 5]} intensity={1.2} />
        <directionalLight position={[-3, 2, -2]} intensity={0.5} />
        <Suspense fallback={null}>
          <GhostMesh />
          <Particles />
        </Suspense>
      </Canvas>
    </div>
  );
}
