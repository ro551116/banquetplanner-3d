# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server on port 3000
npm run dev:server # Scene API + built dist on port 3001 (PORT, DATA_DIR)
npm run build      # Production build to /dist
npm run typecheck  # tsc --noEmit
npm test           # node:test via tsx (trussConfig, sceneData)
```

No linter or formatter is configured.

## Tech Stack

- React 18 + TypeScript 5.8 + Vite 6
- Three.js with `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`
- Tailwind CSS 3.4 build step (`tailwind.config.js`, `postcss.config.js`, `index.css`); UI rules in `docs/UI-DESIGN-SYSTEM.md`
- Express server (`server/index.ts`) persists scenes and the Truss studio under `DATA_DIR`

## Architecture

### State Management

All state lives in `App.tsx` and is passed down as props. No Redux or Context API. Four custom hooks encapsulate domain logic:

- **`useObjects`** — Object CRUD, batch operations, duplicate, stair management. Wraps `useHistory` for undo/redo (50-state limit). Updates that change nothing return the previous array (no empty undo steps).
- **`useHistory`** — Undo/redo reducer. `set(value, { mergeKey })` coalesces consecutive same-key edits within 1 s (sliders, colour pickers) into one undo step.
- **`useSceneIO`** — Load (through `normalizeSceneData`), serial versioned autosave (2 s debounce, `baseUpdatedAt` → 409 conflict dialog), automatic retry with backoff, unload guard while anything is unsaved, JSON import/export, thumbnails.
- **`useDrawing`** — Drawing mode toggle, path creation/clearing.
- **`useKeyboard`** — Keyboard shortcuts (Ctrl+Z/Y, Delete, arrows, D for duplicate).

### 3D Rendering Pipeline

`SceneCanvas` wraps `@react-three/fiber` Canvas. It renders:
1. **Hall geometry** — floor, walls, baseboards built from `HallConfig`
2. **Objects** — each wrapped in `ObjectWrapper` (handles selection, dragging, transform gizmo)
3. **Models** — `BanquetObjects.tsx` contains all 3D model implementations (tables, speakers, lights, stage, etc.)
4. **Lighting** — different setups for EDIT mode (3-point) vs VIEW mode (day/night environments)
5. **Post-processing** — N8AO (AO), SMAA (AA), optional Bloom/Vignette in VIEW mode

### Dual Mode System

- **EDIT mode** — Light toolbar (scene name, 編輯｜預覽, tools ≥1024px, 更多 menu, save indicator, 新增/屬性 toggles); add palette left and properties right, docked ≥1024px, bottom sheets below; contextual floating bar for placement/selection.
- **VIEW mode** — Dark presentation toolbar (view presets, 夜間, 標籤, 截圖; floating bottom bar below 1024px), no side panels or status bar.

### Data Model

Core types in `types.ts`:
- `BanquetObject` — position/rotation/scale + type-specific fields (customSize, customWidth, customDepth, hasBackdrop, stairs, intensity, standType, tableCloth)
- `HallConfig` — room dimensions + wall/floor colors and material properties
- `ObjectType` enum — tables, speakers, lights, stage, carpet, decor

### Key Files

| File | Role |
|------|------|
| `App.tsx` | Root orchestrator, all top-level state |
| `components/SceneCanvas.tsx` | 3D viewport, lighting, post-processing |
| `components/BanquetObjects.tsx` | All 3D model geometry (~700 lines) |
| `components/ObjectWrapper.tsx` | Object selection, dragging, transform handles |
| `components/Sidebar.tsx` | Right properties panel/sheet: selection first, collapsible 場地設定, object list |
| `components/PropertiesPanel.tsx` | Selected object property editors (shared `NumberField`/`TextField`) |
| `components/AddObjectPanel.tsx` | Add palette: group tabs + tiles from `components/objectTypeMeta.tsx` |
| `components/TopToolbar.tsx` / `EditorControls.tsx` / `StatusBar.tsx` | Editor chrome, contextual floating bar, status row |
| `components/AdvancedAddModal.tsx` | 批次新增 (quick counts / table grid) |
| `constants.ts` | Theme presets, initial hall config, default values |

### Persistence

- Autosave to the server API with optimistic concurrency: data PUTs send `baseUpdatedAt`; a 409 pauses autosave and opens `SceneConflictDialog` (export / reload latest / overwrite). Agents and curl may omit it to overwrite unconditionally.
- Failed saves retry automatically (2 s, 5 s, 15 s, then every 30 s); the browser leave prompt is armed whenever revisions are unsaved, including error and conflict states.
- `services/sceneData.ts` normalizes loaded and imported scenes (finite transforms, known types, unique ids, clamped hall). A scene without an `objects` section opens with the default stage and speakers; imports replace only the sections the file contains.
- `EditorErrorBoundary` keeps a render error inside the editor body with reload/back actions.
- Leaving the editor stores a 480×270 list thumbnail when the scene has none or was edited (thumbnail-only PUTs do not touch `updated_at`)
- The canvas renders on demand (`frameloop="demand"`). Code that mutates three objects outside React must call `invalidate()`.

### Environment Variables

- Server only: `PORT`, `DATA_DIR`. The browser bundle reads no environment variables (the unused client-side Gemini path and its build-time key injection were removed on 2026-10-05).

## Build Parity and QA Pitfalls

- Release and parity builds: `npm run build` (no credential injection remains). Compare lock versions and build inputs before calling a hash mismatch deployment drift.
- React QA through DOM internals: a node's `__reactFiber` can point to an old alternate. Walk to HostRoot, take `root.stateNode.current`, find the fiber whose `stateNode` is the DOM node, then inspect its ancestors and hooks. Use this for diagnosis only, cross-check the real DOM, screenshots and interactions, and never mutate app state through fibers.
- `@react-three/drei` 9.96 `Edges` replaces `ref.current.geometry` without disposing the previous `EdgesGeometry`. `Highlight` in `components/models/shared.tsx` owns and disposes its outline geometry. When changing editable procedural models, test repeated resizing of a selected object and watch `gl.info.memory.geometries` (after the fix it stays at 537 across 13 width changes).
- Headless QA: hidden headless tabs throttle `requestAnimationFrame`, so camera lerps and canvas frames stall between tool calls. Pump frames in-page (`requestAnimationFrame` loop for ~2.5s) before screenshots. `(pointer: coarse)` only matches while `Emulation.setTouchEmulationEnabled` is active on the same live CDP session; viewport `hasTouch` alone does not change it.
