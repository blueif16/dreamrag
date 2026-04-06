# 3D Particle Morph — Implementation Practices & Learnings

## Architecture

The landing page uses a scroll-driven particle morph system built with React Three Fiber + GSAP ScrollTrigger.

### File Structure
```
src/components/scene/
├── ParticleBackground.tsx  — R3F Canvas, GLB loading, particle setup, Suspense boundary
├── sampleMesh.ts           — MeshSurfaceSampler + UV-based texture color sampling
├── shaders.ts              — GLSL vertex/fragment shaders (morph + stagger + float)
└── geometries.ts           — Procedural fallback generators (whale, bigMoon)
```

### Data Flow
```
GSAP ScrollTrigger (DOM) → module-level ref (scrollProgress.value)
    → useFrame reads ref → writes to material.uniforms.uProgress.value
    → vertex shader does mix(posA, posB, progress) with staggered smoothstep
```

No React state in the render loop. GSAP writes to a plain JS object, useFrame copies it to uniforms.

## Key Decisions & Why

### GLB Asset Pipeline
- **Meshy generates GLBs** with textures (baseColorTexture + UVs)
- **gltf-transform CLI** for optimization: `resize` (textures to 512x512), `simplify` (mesh to 10-15% ratio), `prune`
- **NEVER use `--compress meshopt`** — requires `setMeshoptDecoder()` at runtime which isn't configured. Use uncompressed GLBs.
- **NEVER use `optimize` command** — it applies meshopt by default. Use individual steps: `resize`, `simplify`, `weld`, `dedup`, `prune`

### Particle Color from Textures
- Meshy GLBs have NO vertex colors (`COLOR_0`), only texture maps + UVs (`TEXCOORD_0`)
- `sampleMesh.ts` samples surface positions via `MeshSurfaceSampler`, then finds nearest vertex UV → looks up pixel color from baseColorTexture drawn to a 2D canvas
- This is approximate (nearest-vertex UV, not barycentric interpolation) but good enough for particles
- Colors stored as `aColor` vec3 attribute, passed to fragment shader

### Blending Mode
- **NormalBlending on light background** — additive blending makes particles invisible on light/pastel backgrounds (adding light to light = white = invisible)
- **AdditiveBlending only works on dark backgrounds** — gives the glow effect but requires dark bg
- Current setup: NormalBlending + solid circular particle (`smoothstep` disc) + light pastel gradient background
- Fragment shader: `if (d > 0.5) discard; float alpha = smoothstep(0.5, 0.15, d);`

### EffectComposer / Bloom
- **DO NOT USE** with `alpha: true` canvas — causes severe screen flashing
- Root cause: multisampling + alpha channel + postprocessing render loop conflict
- Setting `multisampling={0} autoClear={false}` does NOT fix it
- Fallback: rely on particle colors + blending for visual quality, no postprocessing

### Scroll-Driven Morph
- GSAP `ScrollTrigger.create()` with `scrub: 1.5` for smooth follow
- Page has 3 full-height `<section>` elements as scroll anchors
- ScrollTrigger maps raw progress (0→1) to `uProgress` (0→2): two morph phases
- Right-edge dot indicators track active section

### Model Scale & Position
- Cloud GLB bbox is ~1.4 units — scaled 1.4x and offset x=-1.0 (shifted left) to sit nicely in viewport
- Camera at z=4.5, fov=50
- All models MUST have same `PARTICLE_COUNT` (currently 50000) — shader `mix()` requires matching attribute array lengths

## Tuning Parameters

| Parameter | Location | Current Value | Notes |
|---|---|---|---|
| PARTICLE_COUNT | ParticleBackground.tsx | 50000 | Higher = denser shape, more GPU |
| uSize | ParticleBackground.tsx uniforms | 28.0 | Particle diameter in pixels |
| Model scale | ParticleBackground.tsx loop | 1.4x | Multiplier on sampled positions |
| Model offset | ParticleBackground.tsx loop | x=-1.0 | Horizontal shift |
| Float amplitude | shaders.ts vertex | y:0.05, x:0.03, z:0.02 | 3-axis idle float |
| Color boost | shaders.ts fragment | vColor * 1.1 | Texture color multiplier |
| Scrub | page.tsx ScrollTrigger | 1.5 | Scroll smoothing factor |

## Gotchas

1. **`useLoader(GLTFLoader, ...)` suspends** — must be inside `<Suspense>`. If EffectComposer is outside Suspense, it renders on empty scene = flash.
2. **`setClearColor("transparent", 0)` is wrong** — use `setClearColor(0x000000, 0)`. "transparent" is not a valid Three.js color.
3. **Canvas div needs `pointerEvents: "none"`** unless you need hover/click on the 3D scene. Otherwise it blocks DOM input elements.
4. **Next.js `dynamic()` with `ssr: false`** is required for R3F — it uses browser APIs (WebGL, canvas).
5. **Module-level exports** (`scrollProgress`, etc.) work across dynamic imports because webpack deduplicates modules. The page.tsx `import()` and the component's direct import resolve to the same module instance.

## Next Steps (not yet implemented)

1. **Mesh-to-particle dissolve** — show solid 3D mesh in section 1, scroll dissolves it into particles before morph begins. Needs `uDissolve` uniform.
2. **Replace procedural whale/bigMoon** — generate Meshy GLBs, process through same pipeline, sample with `sampleMeshWithColors()`.
3. **Camera rig** — push camera z from 4.5→3 as user scrolls (ScrollTrigger driven).
