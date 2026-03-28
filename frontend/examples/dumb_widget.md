# Dumb Widget Guide

A **dumb widget** is a pure-frontend React component with no backend tools and no agent. It is triggered by the AI referencing its tool name, but renders entirely in the browser with no Python code required.

---

## File Structure

```
examples/
  my_example/                        ← example folder (snake_case)
    index.ts                         ← re-exports all widgets in this example
    widgets/
      my-widget/                     ← widget folder (kebab-case)
        MyWidget.tsx                 ← React component (PascalCase, default export)
        widget.config.ts             ← WidgetConfig definition (default export)
```

No `tools.py`, `agents.py`, or `__init__.py` is needed for a dumb widget example.

---

## 1. `widget.config.ts`

Defines the widget's ID, the tool name the AI uses to trigger it, and its layout.

```ts
// examples/my_example/widgets/my-widget/widget.config.ts
import type { WidgetConfig } from "@/types/state";

const config: WidgetConfig = {
  id: "my_widget",          // snake_case; must match component name in PascalCase (see §4)
  tool: {
    name: "show_my_widget", // the tool name the AI calls to render this widget
    description: "Show my widget. [Layout: full width, fill height]",
    parameters: {},         // {} for dumb widgets — no inputs needed
  },
  agent: null,              // always null for dumb widgets
  layout: { width: "full", height: "fill" }, // see layout options below
};

export default config;
```

### Layout options

| field    | values                        | effect                          |
|----------|-------------------------------|---------------------------------|
| `width`  | `"full"` / `"half"` / `"third"` | grid column span                |
| `height` | `"fill"` / `"tall"` / `"medium"` / `"compact"` | min-height of the shell |

---

## 2. `MyWidget.tsx`

A standard React component. Use `"use client"` if you need browser APIs (canvas, timers, etc.).

```tsx
// examples/my_example/widgets/my-widget/MyWidget.tsx
"use client";

export default function MyWidget() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] w-full items-center justify-center bg-black">
      {/* your widget UI */}
    </div>
  );
}
```

- The component **must be the default export**.
- The component name must be the PascalCase version of the `id` in `widget.config.ts`.
  - `id: "my_widget"` → component name `MyWidget`
  - `id: "red_flower"` → component name `RedFlower`
  - `id: "firework"` → component name `Firework`
- No props are required. The system passes `widgetId` automatically but you can ignore it.

---

## 3. `index.ts` (example barrel)

Re-export both the component and the config from the example's `index.ts`. The naming convention for config exports is `{camelCaseId}Config`.

```ts
// examples/my_example/index.ts
export { default as MyWidget } from "./widgets/my-widget/MyWidget";
export { default as myWidgetConfig } from "./widgets/my-widget/widget.config";
```

To add a second widget to the same example, append two more lines:

```ts
export { default as AnotherWidget } from "./widgets/another-widget/AnotherWidget";
export { default as anotherWidgetConfig } from "./widgets/another-widget/widget.config";
```

---

## 4. How the registry wires it up

`src/lib/widgetEntries.ts` auto-matches configs to components:

1. It imports everything from `examples/index.ts`.
2. For each export in an example namespace, if the value has `tool` and `id` fields it is a **config**; if it is a `function` it is a **component**.
3. It converts the config `id` from `snake_case` → `PascalCase` and looks for a component with that exact name.
4. A matched pair becomes a `WidgetEntry` that `WidgetPanel` can render.

**This means the component name and the config `id` must stay in sync.** No manual registration anywhere else is needed.

---

## 5. Registering the example in `examples/index.ts`

Once your example folder is ready, add **one line** to `examples/index.ts`:

```ts
// examples/index.ts  (existing lines shown for context)
export * as studentDashboard from "./student_dashboard";
export * as scienceLab      from "./science_lab";
export * as flowerGarden    from "./flower_garden";
export * as dreams          from "./dreams";
export * as myExample       from "./my_example"; // ← add this
```

The alias (`myExample`) is only used internally by `widgetEntries.ts` to namespace the exports — its exact name does not matter as long as it is unique.

---

## Checklist

- [ ] `widget.config.ts` — `id` is snake_case, `agent: null`, `parameters: {}`
- [ ] `MyWidget.tsx` — default export, name is PascalCase of `id`
- [ ] `index.ts` — both component and config re-exported
- [ ] `examples/index.ts` — one new `export * as ...` line added
- [ ] No `tools.py` / `__init__.py` / backend files created
