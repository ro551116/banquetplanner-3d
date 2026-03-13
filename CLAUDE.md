# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server on port 3000
npm run build     # Production build to /dist
npm run preview   # Preview production build
```

No test runner, linter, or formatter is configured.

## Tech Stack

- React 18 + TypeScript 5.8 + Vite 6
- Three.js with `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`
- Tailwind CSS via CDN (no build step)
- Google Gemini API (`@google/genai`) for AI-powered layout generation
- Fully client-side — no backend

## Architecture

### State Management

All state lives in `App.tsx` and is passed down as props. No Redux or Context API. Four custom hooks encapsulate domain logic:

- **`useObjects`** — Object CRUD, batch operations, duplicate, stair management. Wraps `useHistory` for undo/redo (50-state limit).
- **`useHistory`** — Generic undo/redo stack using refs for past/future arrays.
- **`useSceneIO`** — JSON import/export, localStorage auto-save (1s debounce), auto-load on mount.
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

- **EDIT mode** — Sidebar visible, object manipulation enabled, transform gizmos, drawing tools
- **VIEW mode** — Sidebar hidden, ViewToolbar shown, preset camera views, day/night toggle, enhanced post-processing

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
| `components/Sidebar.tsx` | Left panel — object palette, hall config, theme presets |
| `components/PropertiesPanel.tsx` | Selected object property editors |
| `components/AdvancedAddModal.tsx` | Batch add with AI generation via Gemini |
| `services/geminiService.ts` | Gemini API integration for layout suggestions |
| `constants.ts` | Theme presets, initial hall config, default values |

### Persistence

- Auto-saves to `localStorage` with 1s debounce
- JSON export/import for sharing scenes
- No backend storage

### Environment Variables

- `GEMINI_API_KEY` in `.env.local` — required for AI layout generation feature
