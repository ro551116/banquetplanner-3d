# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server on port 3000
npm run dev:server # Scene API + built dist on port 3001 (PORT, DATA_DIR)
npm run build      # Production build to /dist
npm run typecheck  # tsc --noEmit
npm test           # node:test via tsx (trussConfig, sceneData, planning, floorPlan, hallPresets)
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

- **`useObjects`** — Object CRUD, batch operations, duplicate, stair management. Wraps `useHistory` for undo/redo (50-state limit). Updates that change nothing return the previous array (no empty undo steps). Attached objects follow their host — number plates standing on a table, lights clamped to a truss beam (`planning.ts`: `isOnTable`, `isMountedOn`, `getTrussBeams` built on `trussConfig.ts` `getTrussBeamLines`): moves/rotations go through `carryAttachedObjects`, deletes and duplicates include `attachedObjects` (DirectManipulation also drags them live).
- **`useHistory`** — Undo/redo reducer. `set(value, { mergeKey })` coalesces consecutive same-key edits within 1 s (sliders, colour pickers) into one undo step.
- **`useSceneIO`** — Load (through `normalizeSceneData`), serial versioned autosave (2 s debounce, `baseUpdatedAt` → 409 conflict dialog), automatic retry with backoff, unload guard while anything is unsaved, JSON import/export, thumbnails.
- **`useDrawing`** — Drawing mode toggle, path creation/clearing.
- **`useKeyboard`** — Keyboard shortcuts (Ctrl+Z/Y, Delete, arrows, D for duplicate).

### 3D Rendering Pipeline

`SceneCanvas` wraps `@react-three/fiber` Canvas. It renders:
1. **Hall geometry** — floor, walls (one mitred prism per outline edge, each cut away when its outside faces the camera), baseboards built from `HallConfig`; `getHallOutline` turns a plain hall into its 4-corner rectangle so one code path draws every shape
2. **Objects** — each wrapped in `ObjectWrapper` (handles selection, dragging, transform gizmo)
3. **Models** — `BanquetObjects.tsx` dispatches each `ObjectType` to its model in `components/models/` (tables, stage, audio, lighting, rigging, misc, wedding, structure, power, catering, annotations, interior). Models receive `ObjectModelProps` (`components/models/modelProps.ts`: the object's data fields plus render state). Hall walls and partition walls share the mitred-band helpers in `components/models/wallGeometry.ts`
4. **Lighting** — different setups for EDIT mode (3-point) vs VIEW mode (day/night environments)
5. **Post-processing** — VIEW mode only: N8AO (full resolution `high` on fine pointers, half resolution `performance` on touch), ACES tone mapping, then SMAA. Composer MSAA stays off: N8AO composites after the MSAA resolve, so only SMAA reaches the final edges.
6. **Screenshots** — `SceneCapture.tsx` raises the pixel ratio for one frame (3840 px long edge, 2560 px on touch), renders through the composer, copies the canvas and restores everything in the same task. The composer only follows CSS size changes, so the capture resizes it explicitly; a separate render target would bypass AO, tone mapping and r160's sRGB output.

### Dual Mode System

- **EDIT mode** — Light toolbar (scene name, 編輯｜預覽, tools ≥1024px, 更多 menu, save indicator, 新增/屬性 toggles); add palette left and properties right, docked ≥1024px, bottom sheets below; contextual floating bar for placement/selection.
- **VIEW mode** — Dark presentation toolbar (view presets, 夜間, 標籤, 截圖; floating bottom bar below 1024px), no side panels or status bar.

### Data Model

Core types in `types.ts`:
- `BanquetObject` — position/rotation/scale + type-specific fields (customSize, customWidth, customDepth, hasBackdrop, stairs, intensity, standType, tableCloth, seating fields seatCount/chairLayout/childSeats/vegetarianSeats/standby, note, path `points`, device point `system` — its code is `label`)
- `HallConfig` — room dimensions + wall/floor colors and material properties + floor plan `planInfo` + optional irregular `outline` (wall corners; `width`/`length` then equal its bounding box, whose centre need not be the origin — use `getHallBounds`, not `±width/2`)
- `ObjectType` enum — tables, speakers, lights, stage, carpet, decor, venue structure, power, catering, plan annotations

`planning.ts` holds the shared planning rules: table specs and seat counting (`getSeating`, `summarizeSeating`), path-object helpers, hall outline geometry (`getHallOutline`, `getHallBounds`, `getWallSegments`, `outlineTemplate`, `withOutline`), placement wall snapping onto the outline and partitions (`getPartitionSegments`, `snapToWall`) and device point systems (`DEVICE_SYSTEMS`, `nextDeviceCode`). `floorPlan.ts` builds the 2D SVG plan and the device point CSV (pure, no DOM); `components/FloorPlanModal.tsx` previews and exports them. Path objects (`CABLE_RUN`, `FLOW_ARROW`, `DIMENSION`, `WALL`) and the hall outline are drawn vertex by vertex through `components/PathPlacement.tsx` instead of `PlacementPreview`; `components/HallShapeEditor.tsx` edits the outline in 場地設定. Device point placement stays active after each click and advances the code.

### Key Files

| File | Role |
|------|------|
| `App.tsx` | Root orchestrator, all top-level state |
| `components/SceneCanvas.tsx` | 3D viewport, lighting, post-processing |
| `components/BanquetObjects.tsx` | Model dispatcher (`ObjectType` → model component) and name/note label |
| `components/ObjectWrapper.tsx` | Object selection, dragging, transform handles |
| `components/Sidebar.tsx` | Right properties panel/sheet: selection first, collapsible 場地設定, object list |
| `components/PropertiesPanel.tsx` | Selected object property editors (shared `NumberField`/`TextField`) |
| `components/AddObjectPanel.tsx` | Add palette: group tabs + tiles from `components/objectTypeMeta.tsx` |
| `components/TopToolbar.tsx` / `EditorControls.tsx` / `StatusBar.tsx` | Editor chrome, contextual floating bar, status row |
| `components/AdvancedAddModal.tsx` | 批次新增 (quick counts / table grid) |
| `constants.ts` | Theme presets, initial hall config, default values |
| `hallPresets.ts` / `components/HallPresetPanel.tsx` | Hall presets (廳房): build/apply rules (pure), 場地設定 panel; API client `services/hallPresetsApi.ts` |

### Persistence

- Autosave to the server API with optimistic concurrency: data PUTs send `baseUpdatedAt`; a 409 pauses autosave and opens `SceneConflictDialog` (export / reload latest / overwrite). Agents and curl may omit it to overwrite unconditionally.
- Failed saves retry automatically (2 s, 5 s, 15 s, then every 30 s); the browser leave prompt is armed whenever revisions are unsaved, including error and conflict states.
- `services/sceneData.ts` normalizes loaded and imported scenes (finite transforms, known types, unique ids, clamped hall, well-typed planning fields, finite path points, string-only `planInfo`). A scene without an `objects` section opens with the default stage and speakers; imports replace only the sections the file contains.
- `EditorErrorBoundary` keeps a render error inside the editor body with reload/back actions.
- Leaving the editor stores a 480×270 list thumbnail when the scene has none or was edited (thumbnail-only PUTs do not touch `updated_at`)
- The canvas renders on demand (`frameloop="demand"`). Code that mutates three objects outside React must call `invalidate()`.
- Hall presets (廳房) live in `DATA_DIR/hall-presets/<id>.json`: a hall without `planInfo` plus DOOR/COLUMN/WALL objects. The server normalizes both with `normalizeSceneData` and rejects other object types. Applying a preset replaces the hall (keeping the scene's `planInfo`, with `venue` set to the preset title). A preset that has structures replaces the scene's structures under new ids; a preset without them leaves the scene's in place. Scenes created from a preset start without the default stage and speakers. The server imports root modules and `services/` at runtime, so the Dockerfile runtime stage copies `*.ts` from the root and `services/`.

### Environment Variables

- Server only: `PORT`, `DATA_DIR`. The browser bundle reads no environment variables (the unused client-side Gemini path and its build-time key injection were removed on 2026-10-05).

## Build Parity and QA Pitfalls

- Release and parity builds: `npm run build` (no credential injection remains). Compare lock versions and build inputs before calling a hash mismatch deployment drift.
- React QA through DOM internals: a node's `__reactFiber` can point to an old alternate. Walk to HostRoot, take `root.stateNode.current`, find the fiber whose `stateNode` is the DOM node, then inspect its ancestors and hooks. Use this for diagnosis only, cross-check the real DOM, screenshots and interactions, and never mutate app state through fibers.
- `@react-three/drei` 9.96 `Edges` replaces `ref.current.geometry` without disposing the previous `EdgesGeometry`. `Highlight` in `components/models/shared.tsx` owns and disposes its outline geometry. When changing editable procedural models, test repeated resizing of a selected object and watch `gl.info.memory.geometries` (after the fix it stays at 537 across 13 width changes).
- Headless QA: hidden headless tabs throttle `requestAnimationFrame`, so camera lerps and canvas frames stall between tool calls. Pump frames in-page (`requestAnimationFrame` loop for ~2.5s) before screenshots. `(pointer: coarse)` only matches while `Emulation.setTouchEmulationEnabled` is active on the same live CDP session; viewport `hasTouch` alone does not change it.
- The renderer is not reachable from page scripts. To check GPU leaks in a browser, add an init script that wraps `WebGLRenderingContext`/`WebGL2RenderingContext` `createBuffer`/`deleteBuffer` (and textures) into live counters, reload, then cycle a dimension field between two values: the count at the starting value must return to its earlier level. Rect tablecloths are cached per distinct size in `cloth.ts`, so the first visit to a new width adds one entry by design.
- GPU frame cost: headless Chromium on the MacBook exposes `EXT_disjoint_timer_query_webgl2`. Wrap `requestAnimationFrame` from an init script and bracket each callback that issues draw calls with a `TIME_ELAPSED` query; `gl.finish()` timing does not include GPU work. On 2026-10-19 (1800×1065 canvas, 30-object wedding scene with 20 tables, orbit drag) the full-resolution AO + SMAA pipeline measured about 6 ms median / 10 ms p95 GPU per frame against 5 ms / 7.5 ms before.
- Each EDIT→VIEW switch builds a new composer, and `@react-three/postprocessing` 2.16 disposes neither it nor its passes on unmount. `PreviewEffects` in `SceneCanvas.tsx` disposes the whole composer in a layout cleanup, which runs before the composer's own cleanup detaches the passes. Leaving VIEW now frees every texture, framebuffer and program it created. Still open: drei 9.96 `GizmoViewport` never disposes its six 64×64 axis-label `CanvasTexture`s, so each EDIT session leaves about 96 KB behind. To attribute leaks, tag each `createTexture` with an epoch and record the size from `texStorage2D`/`texImage2D`; textures still alive from a finished mode session are leaks.
- `<React.StrictMode>` in `index.tsx` does not reach the canvas: R3F 8 creates its root with `isStrictMode = false`, so effects inside `<Canvas>` run once even under `npm run dev`. Preview was verified there on 2026-10-19. R3F 9 inherits StrictMode, so its simulated unmount would run `PreviewEffects`' `composer.dispose()`, and the remount would not add back the `RenderPass` created in the composer's `useMemo`. Before upgrading, make that cleanup dispose the passes and buffers without emptying `composer.passes`.
