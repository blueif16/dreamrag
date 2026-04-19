"use client";

import { useRef, useMemo, useCallback, Suspense } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** Module-level mouse target — page writes via dynamic import, useFrame reads */
export const mouseTarget = { x: 0, y: 0 };

function Model() {
  const groupRef = useRef<THREE.Group>(null);
  const gltf = useLoader(GLTFLoader, "/models.glb");

  const clonedScene = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const oldMat = mesh.material as THREE.MeshStandardMaterial;
        const newMat = oldMat.clone();
        newMat.transparent = false;
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
    const g = groupRef.current;

    // Slow continuous rotation (turntable)
    g.rotation.y += 0.35 * delta;

    // Mouse-driven tilt on X axis (nodding)
    const tiltX = mouseTarget.y * -0.2;
    g.rotation.x += (tiltX - g.rotation.x) * 0.04;
  });

  return (
    <group ref={groupRef} scale={[1.5, 1.5, 1.5]} position={[0, 0, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
}

export default function CloudModel() {
  const onCreated = useCallback((state: { gl: THREE.WebGLRenderer }) => {
    state.gl.setClearColor(0x000000, 0);
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "visible" }}>
    <Canvas
      camera={{ position: [0, 0, 4.5], fov: 50 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true }}
      onCreated={onCreated}
      style={{
        position: "absolute",
        width: "180%",
        height: "180%",
        top: "-40%",
        left: "-40%",
      }}
    >
      <ambientLight intensity={1.2} />
      <hemisphereLight args={[0xb6d5ff, 0xd4cec4, 0.6]} />
      <directionalLight position={[3, 4, 5]} intensity={1.2} />
      <directionalLight position={[-3, 2, -2]} intensity={0.5} />
      <Suspense fallback={null}>
        <Model />
      </Suspense>
    </Canvas>
    </div>
  );
}
