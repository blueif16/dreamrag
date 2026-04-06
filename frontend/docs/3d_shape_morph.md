# DREAM PARTICLE PROJECT — Runbook for Claude Code

> 这是项目的**执行说明书**。Claude Code 每次开工前必读。
> 人类（项目所有者）只在标记 `🛑 HUMAN REVIEW` 的地方介入。其他全部由 Claude Code 执行，不要来回确认。

---

## 0. 项目是什么

用 Three.js 粒子系统做一个**梦境主题的 scroll-driven particle morph 网站**。用户滚动页面时，粒子从模型 A（云 + 月亮 + 星星组合，还原参考图）变形到模型 B（鲸鱼），再到模型 C（放大的月亮）。期间粒子持续漂浮，相机缓慢推进，颜色渐变。

**参考美学**：柔和 pastel + iridescent 彩虹色 + additive glow + 错落式形变（不是整齐划一移动）。

**核心技术**：Bruno Simon 的 "Particles Morphing Shader" 技术 —— 同一 BufferGeometry 挂多组 position attribute，vertex shader 里 `mix(posA, posB, uProgress)`，GSAP ScrollTrigger 驱动 uProgress。

---

## 1. 技术栈（锁定，不要换）

| 层 | 选型 | 为什么 |
|---|---|---|
| 构建 | Vite + React + TypeScript | R3F 标配 |
| 3D | React Three Fiber + @react-three/drei | 声明式，AI 写不容易错 |
| 后处理 | @react-three/postprocessing | Bloom 一行搞定 |
| 动画 | GSAP + ScrollTrigger | 业界标准 scroll 驱动 |
| Shader | 手写 GLSL（通过 vite-plugin-glsl） | 核心效果所在，逃不掉 |
| 资产管线 | @gltf-transform/cli | 纯 JS，不用 Blender |
| 调参 | leva | 实时拖滑块 |

**绝对不要换的东西**：
- 不要换成 Babylon.js 或 PlayCanvas
- 不要换成 CSS 粒子或 canvas2d
- 不要用 ShaderParticleEngine、three.quarks 这类 VFX 库（它们是烟雾火焰用的，不做 morph）
- 不要用 Blender Python 脚本

---

## 2. Human Review 节点（只有三个）

- **🛑 REVIEW 1 — Baseline 模板跑起来**: 用户确认开源 particle morph 模板在本机能跑、效果方向对
- **🛑 REVIEW 2 — Model 1 粒子化后的第一眼**: Meshy 资产 + 代码组合出"云+月+星"模型采样成粒子后的样子
- **🛑 REVIEW 3 — 最终完整体验**: 三个模型 + scroll + shader polish 都接上后的最终效果

其他所有步骤 Claude Code 连续执行，不要中途问"要不要继续"。

---

## 3. 执行流程

### Step 1 — Clone baseline template 并跑起来

**目标**：让用户本机看到 Bruno Simon 课程 lesson 40 的 open source port，确认粒子 morph 效果是他要的方向。

**动作**（Claude Code 执行）：

```bash
# 主推：R3F 版本的 open source port
git clone https://github.com/shpowley/threejs-journey-webxr.git
cd threejs-journey-webxr/40-particles-morphing-shader
npm install
npm run dev
```

打印出 localhost URL，**停在这里**。

**Fallback A**（如果上面 clone 失败或 R3F 版本效果不理想）：
```bash
git clone https://github.com/d3ttl4ff/particle-morphing-shader.git
cd particle-morphing-shader
npm install && npm run dev
# 这个是 vanilla three.js + vite 版，更接近 Bruno 原课
# 带 #debug URL 参数可以打开 GUI 调参
```

**Fallback B**（两个都跑不起来）：搜 GitHub `particle morph three.js vite`，挑 star 数最高的近期仓库。不要自己从零写 shader。

### 🛑 REVIEW 1 — 停，等用户反馈

显示给用户看的话术：
> "基线模板跑在 http://localhost:xxxx，这是 Bruno Simon particle morph 课程的开源 port。你滚动（或按按钮）时应该能看到粒子从一个形状变成另一个形状。请确认：(a) 效果方向对不对？(b) 性能流畅吗？回复 yes 我继续，no 我切 fallback。"

**如果 yes**: 进入 Step 2。
**如果 no 且抱怨性能**: 把粒子数从默认降到 15000，重试。
**如果 no 且抱怨效果**: 切 Fallback A。
**如果还是 no**: 停下问用户看到了什么，不要瞎猜。

---

### Step 2 — 建立项目骨架（一次做完，不中断）

**目标**：从 baseline 里抠出核心代码，搭成项目的最终骨架。

**动作**：

```bash
# 在工作目录之外新建真正的项目
cd ..
npm create vite@latest dream-particles -- --template react-ts
cd dream-particles
npm install three @react-three/fiber @react-three/drei @react-three/postprocessing
npm install gsap leva
npm install -D vite-plugin-glsl @gltf-transform/cli @types/three
```

**项目结构（固定，不要改）**：

```
dream-particles/
├── CLAUDE.md                    # 这个文件
├── public/
│   └── models.glb               # 所有模型合成的单一 glb（human 提供原料后由 Claude Code 生成）
├── src/
│   ├── main.tsx
│   ├── App.tsx                  # <Canvas> + scroll sections DOM
│   ├── scene/
│   │   ├── Particles.tsx        # 核心粒子组件（加载、采样、shader material）
│   │   ├── CameraRig.tsx        # 相机随 scroll 移动
│   │   └── PostFX.tsx           # Bloom + vignette
│   ├── shaders/
│   │   ├── particles.vert.glsl
│   │   └── particles.frag.glsl
│   ├── lib/
│   │   ├── sampleMesh.ts        # MeshSurfaceSampler 封装
│   │   └── scrollTimeline.ts    # GSAP ScrollTrigger 配置
│   └── config.ts                # 模型顺序、粒子数、颜色、scroll 段数 —— 所有调参入口
└── package.json
```

**`src/config.ts` 内容（关键，所有"换素材"都改这里）**：

```ts
export const CONFIG = {
  PARTICLE_COUNT: 25000,     // 全项目固定，不要动
  MODELS: [
    { name: 'dream_scene', meshNames: ['Cloud', 'Moon', 'Star_01', 'Star_02', 'Star_03'] },
    { name: 'whale',        meshNames: ['Whale'] },
    { name: 'big_moon',     meshNames: ['BigMoon'] },
  ],
  COLORS: {
    a: '#ffd1ec',  // 粉
    b: '#a8d8ff',  // 蓝
    c: '#fff4a8',  // 奶黄（给星星/月亮用）
  },
  BLOOM: { intensity: 0.8, luminanceThreshold: 0.2 },
} as const
```

**`package.json` scripts 加这几行**：

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "asset:clean": "gltf-transform optimize tmp/raw.glb public/models.glb --simplify 0.3 --compress meshopt",
  "asset:merge": "gltf-transform merge tmp/cloud.glb tmp/moon.glb tmp/star.glb tmp/whale.glb tmp/big_moon.glb tmp/merged.glb && gltf-transform optimize tmp/merged.glb public/models.glb --simplify 0.3 --compress meshopt"
}
```

做完 Step 2 **不要停**，直接进 Step 3。

---

### Step 3 — 生成 Meshy 素材（唯一的 human 动作）

**目标**：让用户在 Meshy 上跑 5 次生成，拿到 5 个 glb 文件。

**Claude Code 给用户的原话**（一次性全部打出来，不要挤牙膏）：

> 我需要你去 [meshy.ai](https://www.meshy.ai/workspace) 做 5 次生成。请用 Meshy 6 模型，每次都是 Text-to-3D 或者 Image-to-3D，下载 GLB 格式。**一个 prompt 一个物体**，不要想着一次 prompt 把云和月亮都出来。生成完全部放到项目的 `tmp/` 目录，文件名严格按照下面。
>
> **重要心理准备**：你不需要 Meshy 出图好看、颜色对。最终颜色是 shader 算的，你只需要轮廓认得出。所以 prompt 简单粗暴反而稳。
>
> ---
>
> **1. `tmp/cloud.glb`** — 云
>
> Prompt: `a chubby stylized cloud, voxel blocky style, single centered object, white, simple`
>
> 备选 prompt（第一个不行换这个）: `low poly cartoon cloud, puffy rounded shape, blocky surface`
>
> ---
>
> **2. `tmp/moon.glb`** — 弯月
>
> Prompt: `a crescent moon, stylized low poly, simple 3d shape, single object`
>
> 备选: `cartoon crescent moon smiling, low poly, solid geometry`
>
> ---
>
> **3. `tmp/star.glb`** — 五角星
>
> Prompt: `a chunky 3d five-pointed star, low poly, rounded edges, single object`
>
> 备选: `small puffy cartoon star, 3d stylized, solid shape`
>
> ---
>
> **4. `tmp/whale.glb`** — 鲸鱼
>
> Prompt: `a cute stylized whale, smooth organic shape, low poly, single centered object, A-pose`
>
> 备选: `cartoon baby whale, rounded simple form, solid low poly`
>
> ---
>
> **5. `tmp/big_moon.glb`** — 大月亮（终点）
>
> Prompt: `a full crescent moon, stylized low poly, large, simple geometry`
>
> （可以直接复用第 2 个模型的结果放这里 —— 如果第 2 个云月亮效果好，直接 `cp tmp/moon.glb tmp/big_moon.glb`，省一次生成）
>
> ---
>
> **生成窍门**（来自 Meshy 官方 prompt 指南）：
> - 一个 prompt 描述**一个物体**，不要场景
> - 3-6 个描述性关键词够了，塞太多反而稀释
> - 写"single centered object"帮 Meshy 定位
> - 写 "low poly" 或 "stylized" 比 "realistic" 稳很多
> - 如果形状不对，换 ai_model 版本重试（Meshy 4 / 5 / 6 风格有差）
> - 纹理/PBR 直接关掉（粒子项目用不到，省 credit）
> - 参考：<https://help.meshy.ai/en/articles/9996858-how-to-use-the-text-to-3d-feature>
>
> **全部生成完告诉我，我会继续。如果某个模型怎么试都不行，告诉我是哪个，我有 fallback 方案。**

**🛑 在这里等用户回复**（这不是 REVIEW gate，是数据等待）。

**Fallback（如果 Meshy 某个物体怎么都出不来）**：

- **云不行** → 用 Three.js `IcosahedronGeometry(1, 3)` + vertex shader 里加 noise displacement，程序化生成。代码 20 行。
- **月亮不行** → 用 `LatheGeometry` 或两个 `SphereGeometry` 做布尔差，也是纯代码。
- **星星不行** → 用 `ExtrudeGeometry` + 2D 星形 Shape，标准 three.js 用法。
- **鲸鱼不行** → 换成更简单的"a stylized whale-shaped pebble" 或者直接换成 Meshy 稳出的东西：蘑菇 / 水晶 / 蝴蝶
- **全都不行** → 直接放弃 Meshy，全部用程序化几何体 + noise。效果依然能看，因为最终是粒子不是 mesh。

---

### Step 4 — 资产管线（全自动，不停）

**目标**：把用户丢到 `tmp/` 的 5 个 glb 清洗、合并、优化成一个 `public/models.glb`。

**动作**：

```bash
# 1. 每个单独清一下（去除 Meshy 常见噪声）
for f in cloud moon star whale big_moon; do
  npx gltf-transform optimize tmp/$f.glb tmp/${f}_clean.glb \
    --simplify 0.3 --compress meshopt
done

# 2. 合并成一个 glb（node 分别命名以便代码按名字查找）
npx gltf-transform merge \
  tmp/cloud_clean.glb \
  tmp/moon_clean.glb \
  tmp/star_clean.glb \
  tmp/whale_clean.glb \
  tmp/big_moon_clean.glb \
  tmp/merged.glb

# 3. 最终 inspect 一下结构
npx gltf-transform inspect tmp/merged.glb

# 4. 改名节点匹配 config.ts 里的 meshNames（如果名字不对要在这里 rename）
#    —— 用 @gltf-transform/core 的 Node API，写一个 scripts/rename-nodes.mjs

# 5. 最终输出
cp tmp/merged.glb public/models.glb
```

**如果 `inspect` 显示节点名和 config 对不上**：不要改 config，写一个小脚本把 glb 里的节点改名到 config 预期的名字。这样 config.ts 永远是 single source of truth。

**参考**：
- <https://gltf-transform.dev/cli>
- <https://gltf-transform.dev/modules/functions/functions/simplify>

**Fallback（如果 gltf-transform 某一步失败）**：
- simplify 报错 → 先跑 `weld` 再跑 `simplify`
- merge 报错 → 一个一个 merge，找出哪个 glb 是坏的，重新让用户生成
- 整个 CLI 挂 → 用 @gltf-transform 的 JS API 写一个 `scripts/build-assets.mjs`，一样的事情用代码做

---

### Step 5 — 采样 + 组合 Model 1（核心一步）

**目标**：从 `public/models.glb` 加载节点，按 config 把 cloud + moon + 3 stars 组合成 Model 1 的 layout，然后对所有活跃 mesh 一起采样 25000 个点。Model 2（whale）和 Model 3（big_moon）分别采样 25000 点。三组 position 全部挂到同一个 BufferGeometry 上。

**关键代码骨架**（写到 `src/lib/sampleMesh.ts`）：

```ts
import * as THREE from 'three'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'

// 采样一组 mesh 到固定点数（按每个 mesh 的表面积加权分配）
export function sampleMeshes(meshes: THREE.Mesh[], totalCount: number): Float32Array {
  const positions = new Float32Array(totalCount * 3)
  
  // 按表面积分配每个 mesh 应得的点数
  const areas = meshes.map(computeSurfaceArea)
  const totalArea = areas.reduce((a, b) => a + b, 0)
  const counts = areas.map(a => Math.round((a / totalArea) * totalCount))
  // 修正舍入误差
  counts[counts.length - 1] += totalCount - counts.reduce((a, b) => a + b, 0)
  
  const tmp = new THREE.Vector3()
  let offset = 0
  meshes.forEach((mesh, i) => {
    const sampler = new MeshSurfaceSampler(mesh).build()
    for (let j = 0; j < counts[i]; j++) {
      sampler.sample(tmp)
      // 注意：mesh 必须已经 applyMatrix4(mesh.matrixWorld) 或者在采样前烘焙 transform
      positions[(offset + j) * 3 + 0] = tmp.x
      positions[(offset + j) * 3 + 1] = tmp.y
      positions[(offset + j) * 3 + 2] = tmp.z
    }
    offset += counts[i]
  })
  return positions
}

function computeSurfaceArea(mesh: THREE.Mesh): number {
  // 三角形面积求和，标准写法
  const geo = mesh.geometry
  const pos = geo.attributes.position
  let area = 0
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  const index = geo.index
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      a.fromBufferAttribute(pos, index.getX(i))
      b.fromBufferAttribute(pos, index.getX(i + 1))
      c.fromBufferAttribute(pos, index.getX(i + 2))
      area += new THREE.Triangle(a, b, c).getArea()
    }
  }
  return area
}
```

**Model 1 的 layout 组合**（在 `Particles.tsx` 里）：

```ts
// 加载 glb，拿到所有命名节点
const { nodes } = useGLTF('/models.glb') as any

// Model 1: 把 cloud 放上面，moon 放下面，3 个 stars 散在云底下
const cloud = nodes.Cloud.clone()
cloud.position.set(0, 1.5, 0)

const moon = nodes.Moon.clone()
moon.position.set(0, -1.5, 0)
moon.scale.setScalar(0.6)

const stars = [
  { x: -0.8, y: 0.2, z: 0.3, s: 0.15 },
  { x: 0.5, y: -0.3, z: 0.1, s: 0.12 },
  { x: -0.2, y: -0.6, z: -0.2, s: 0.18 },
].map(p => {
  const s = nodes.Star.clone()
  s.position.set(p.x, p.y, p.z)
  s.scale.setScalar(p.s)
  return s
})

// 更新 matrix，然后烘焙 transform 到 geometry
;[cloud, moon, ...stars].forEach(m => {
  m.updateMatrixWorld(true)
  m.geometry = m.geometry.clone()
  m.geometry.applyMatrix4(m.matrixWorld)
})

const model1Positions = sampleMeshes([cloud, moon, ...stars], CONFIG.PARTICLE_COUNT)
const model2Positions = sampleMeshes([nodes.Whale], CONFIG.PARTICLE_COUNT)
const model3Positions = sampleMeshes([nodes.BigMoon], CONFIG.PARTICLE_COUNT)

// 挂到同一个 BufferGeometry
const geometry = new THREE.BufferGeometry()
geometry.setAttribute('position', new THREE.BufferAttribute(model1Positions, 3))
geometry.setAttribute('aPositionTarget1', new THREE.BufferAttribute(model2Positions, 3))
geometry.setAttribute('aPositionTarget2', new THREE.BufferAttribute(model3Positions, 3))

// 每个粒子一个随机 noise 值，用于 staggered morph
const aNoise = new Float32Array(CONFIG.PARTICLE_COUNT)
for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) aNoise[i] = Math.random()
geometry.setAttribute('aNoise', new THREE.BufferAttribute(aNoise, 1))
```

**先把 shader 写成最笨的版本**（只做 mix，不做 stagger、不做 noise float、不做颜色），跑通。

### 🛑 REVIEW 2 — 用户看 Model 1 粒子化后的第一眼

显示给用户的话术：
> "Model 1（云+月+星）已经粒子化完成，基础 morph 也接通了。现在 http://localhost:xxxx 看到的是：静态粒子版的 Model 1。请确认：(a) 轮廓认得出来吗？看起来像那张参考图的组合吗？(b) 粒子密度够不够？回复 yes 我加 shader polish 和 scroll，no 告诉我哪里不对。"

**如果 yes**: 进 Step 6，不再停。
**如果 "云不像云"**: 回到 Step 3 的 fallback，换程序化 `IcosahedronGeometry + noise` 做云。
**如果 "粒子太稀"**: `CONFIG.PARTICLE_COUNT` 提到 40000，重采样。
**如果 "粒子太密/卡"**: 降到 15000。
**如果 "layout 不对"**: 调 `Particles.tsx` 里那几个 `position.set(...)` 的数字。

---

### Step 6 — 接 ScrollTrigger（连续做）

**目标**：页面加几个 section，scroll 时 `uProgress` 0→1（morph Model1→Model2），再 1→2（Model2→Model3）。相机同步推近。

**要点**：
1. `App.tsx` 里 `<Canvas>` 用 `position: fixed; inset: 0; z-index: -1;`，让它永远在背后
2. DOM 里放 3-5 个 full-height section 当 scroll trigger 锚点
3. GSAP ScrollTrigger 每个 section 一个 timeline，`scrub: 1.5`
4. 每个 timeline 驱动 `material.uniforms.uProgress.value`

**关键 shader 改动**（现在加 staggered）：

```glsl
// vertex
uniform float uProgress;        // 0 → 1 → 2（区间）
uniform float uTime;
attribute vec3 aPositionTarget1;
attribute vec3 aPositionTarget2;
attribute float aNoise;

void main() {
  // 判断当前处于哪一段
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
  
  // Staggered: 每个粒子错开时间窗口
  float duration = 0.4;
  float delay = (1.0 - duration) * aNoise;
  float progress = smoothstep(delay, delay + duration, localProgress);
  
  vec3 mixed = mix(start, end, progress);
  
  // 轻微 idle float
  mixed.y += sin(uTime * 0.5 + aNoise * 6.28) * 0.02;
  
  vec4 mvPos = modelViewMatrix * vec4(mixed, 1.0);
  gl_Position = projectionMatrix * mvPos;
  gl_PointSize = 8.0 * (1.0 / -mvPos.z);
}
```

```glsl
// fragment
uniform vec3 uColorA;
uniform vec3 uColorB;
varying float vNoise;  // 从 vertex 传过来

void main() {
  vec2 uv = gl_PointCoord;
  float d = length(uv - 0.5);
  float alpha = 0.05 / d - 0.1;
  if (alpha < 0.0) discard;
  vec3 color = mix(uColorA, uColorB, vNoise);
  gl_FragColor = vec4(color, alpha);
}
```

记得 material 用 `THREE.AdditiveBlending` + `depthWrite: false` + `transparent: true`。

**参考资料**（让 Claude Code 自己搜 GSAP ScrollTrigger 用法，不要我贴）：
- GSAP ScrollTrigger 官方文档（搜 "gsap scrolltrigger scrub"）
- Scroll-driven three.js 教程（搜 "three.js gsap scrolltrigger tutorial 2025"）

### Step 7 — Polish（连续做，不停）

1. 加 `@react-three/postprocessing` 的 `<Bloom>` 组件到 `PostFX.tsx`
2. 相机 rig：scroll 时 z 从 5 推到 3
3. 加 leva 面板暴露这几个 uniforms 供调参：`uSize`、`bloomIntensity`、`colorA`、`colorB`
4. 移动端检测：`window.innerWidth < 768` 时 `PARTICLE_COUNT` 砍半

### 🛑 REVIEW 3 — 最终体验

> "全套完成。http://localhost:xxxx 请滚动页面完整体验一遍：应该看到 Model1 云月星 → Model2 鲸鱼 → Model3 大月亮，期间粒子错落形变 + 漂浮 + 颜色渐变 + bloom 发光。告诉我哪里想调，我通过 leva 面板或直接改 config.ts。"

---

## 4. Fallback 总览（每一步都有 B 计划）

| 步骤 | 失败模式 | Fallback |
|---|---|---|
| Step 1 clone | 主仓库挂了 | 切 `d3ttl4ff/particle-morphing-shader` |
| Step 1 clone | 两个都挂 | 找最新高 star 的 particle morph vite 模板 |
| Step 3 Meshy | 云不像 | 程序化 `IcosahedronGeometry + noise displacement` |
| Step 3 Meshy | 鲸鱼不像 | 换成蘑菇/水晶/蝴蝶 |
| Step 3 Meshy | 全不行 | 三个模型全程序化几何 |
| Step 4 gltf-transform | CLI 报错 | 用 JS API 写 build 脚本 |
| Step 4 gltf-transform | simplify 炸 | 先 weld 再 simplify |
| Step 5 采样 | 粒子太稀 | PARTICLE_COUNT 提到 40000 |
| Step 5 采样 | Model 1 layout 错位 | 调 config 里的 position |
| Step 6 ScrollTrigger | 移动端抖动 | 加 `ScrollSmoother` |
| Step 7 Bloom | 性能差 | 移除 bloom，改用更亮的 additive |
| 任何一步 | shader math 不对 | 回去读 `d3ttl4ff/particle-morphing-shader` 对应代码 |

---

## 5. 参考资料（URL only，不要 dump 内容）

**核心开源仓库**：
- <https://github.com/shpowley/threejs-journey-webxr> ← 主模板，lesson 40 R3F port
- <https://github.com/d3ttl4ff/particle-morphing-shader> ← 备选 vanilla 版
- <https://github.com/mmdalipour/particle-morph> ← 另一个 R3F + scroll 参考

**Bruno Simon 课程 lesson 公开页面**（讲思路的部分免费）：
- <https://threejs-journey.com/lessons/particles-morphing-shader>
- <https://threejs-journey.com/lessons/particles>

**工具链文档**：
- <https://gltf-transform.dev/cli>
- <https://gltf-transform.dev/modules/functions/functions/simplify>
- <https://drei.docs.pmnd.rs/>（搜 "drei Sampler" 和 "drei useGLTF"）
- <https://r3f.docs.pmnd.rs/>

**Meshy**：
- <https://help.meshy.ai/en/articles/9996858-how-to-use-the-text-to-3d-feature>
- <https://docs.meshy.ai/en/api/text-to-3d>（如果要走 API 自动化）

**GSAP ScrollTrigger**: 搜 "gsap scrolltrigger docs" 拿最新版。不要用 GSAP 2.x 的旧 API。

**需要现场搜的 topic**（Claude Code 执行时 web_search）：
- "gsap scrolltrigger scrub three.js 2025" 
- "react three fiber useGLTF cloned nodes"
- "vite-plugin-glsl setup"

---

## 6. 绝对不要做的事

1. **不要改 `src/config.ts` 以外的调参入口**。所有魔法数字必须进 config。
2. **不要改 `CONFIG.PARTICLE_COUNT`**（除非 Review 阶段用户明确要求）。三个模型的粒子数必须严格相等，不然 shader 的 mix 会炸。
3. **不要在 JS 里每帧循环修改 `position` attribute**。所有动画在 vertex shader 里。
4. **不要堆 React state 驱动 scroll**。全走 GSAP ScrollTrigger 直接操作 uniforms。`material.uniforms.uProgress.value = ...`，不要 `useState`。
5. **不要用 useFrame 手动算 morph progress**。scroll 是 GSAP 管的。useFrame 只负责 `uTime += delta`。
6. **不要加没问过的依赖**。栈锁定在 Step 1 的表里。
7. **不要在 REVIEW 节点之间问"要不要继续"**。连续做完一整段。
8. **不要用 `alert()` 或 `console.log` 给用户汇报进度**。进度打印到终端。
9. **不要重构代码结构**。项目骨架是固定的。
10. **不要尝试 1 个 Meshy prompt 一次出整个场景**。每个 prompt 一个物体，这是 Meshy 官方明确建议。

---

## 7. 人类只做这几件事

1. ✅ Step 1 后看一眼 baseline，回 yes/no
2. ✅ Step 3 在 Meshy 上跑 5 次生成，把 5 个 glb 丢到 `tmp/`
3. ✅ Step 5 后看 Model 1 粒子化效果，回 yes/no
4. ✅ Step 7 最后整体验收，提调参需求

**就这 4 件事。其他全部 Claude Code 自己做完**。
