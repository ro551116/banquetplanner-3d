<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1R4ZS6M-80WYhXhMs7fJ-0DSPaFHfM3uj

## Run Locally

**Prerequisites:**  Node.js


1. Install the locked dependencies: `npm ci`.
2. Start the scene API in one terminal: `npm run dev:server` (port 3001).
3. Start the web app in another terminal: `npm run dev` (port 3000).
4. `GEMINI_API_KEY` in `.env.local` is optional; it is only needed for AI layout generation.

## Semi-realistic 3D preview

- Edit mode keeps direct object manipulation and the floor grid. View mode adds contact occlusion, ACES tone mapping and clean screenshot output.
- Day/night lighting uses a locally generated reflection environment; no remote HDR or model downloads are required. Floors and fabrics use small procedural relief textures.
- Near walls automatically cut away when the camera is outside the hall; indoor views retain the walls. Hidden walls do not intercept picking.
- Overview, top and side views fit the hall and viewport. Stage view uses the stage's position, dimensions and rotation; an empty hall falls back to an overview.
- Dragging or zooming takes over the camera immediately. Clicking a view preset again restores that framing. Labels are hidden by default in View and can be toggled in the toolbar.
- Existing scene data, object dimensions/colors, API formats and truss engineering calculations are unchanged. Presentation preferences are not saved into scene data.

Lighting is a visual approximation, not a photometric simulation. Fixture spotlights and rectangular panel lights illuminate scene surfaces without per-fixture shadows; occluders may not block their light. The main scene light retains shadows. Instanced chairs, merged truss/lens geometry, a capped pixel ratio and half-resolution view-mode occlusion limit rendering cost.

### Equipment model library

- All 28 object types, including legacy speaker/light types, use local procedural geometry; no external model downloads or branded assets are required.
- Round and rectangular tables have draped cloth, curved upholstered chair backs and tubular frames. Chairs use three instanced meshes per table while remaining selectable as part of that table.
- Stage decks retain their exact configured top height, with pleated skirts, optional backdrop drapes and stairs on all four sides. Screens, LED walls, dance floors and furniture retain their existing dimension/color fields.
- Audio cabinets use shaped shells and aligned perforated grilles; lighting fixtures have separate housings, yokes, lenses and stands. Head tilt does not tilt floor supports.
- Visible emission stays on the lens/LED face, with no solid cone overlays. Round fixtures project from their apertures; wash and strobe panels use forward-facing rectangular area lights. Zero intensity disables the emitter, and both source types follow head tilt and day/night intensity scaling.
- Truss sections merge rounded tubes and braces into one mesh. Preset joints use the existing connector dimension; engineering calculations, segment lists and BOM rules are unchanged.
- Dimension-dependent geometries and selection outlines release replaced GPU resources. Shared fixed-size geometry remains reusable across objects and placement previews.
- These are refined planning models, not manufacturer CAD or structural/load certification.

## Direct scene editing

- New scenes place the two tripod speakers on the floor outside the stage's left/right edges, with clearance for their feet. Existing saved layouts are not repositioned.
- Choose equipment in the palette, move the translucent preview over the scene, then click/tap to place. Placement recognizes stage tops. New truss structures also enter placement after the builder; a multi-structure quantity commits together.
- Click an object to select; Shift-click toggles multi-selection. Drag a selected object to move the selection together. Ground-parallel movement preserves every object's existing height.
- **G — Move:** drag on the XZ plane; arrow keys nudge in XZ.
- **R — Rotate:** drag horizontally around the selection's shared center; left/right arrows rotate.
- **H — Height:** drag vertically; up/down arrows adjust height. Numeric properties remain available in the right panel.
- Grid snapping is selectable: off, 0.1 m, 0.5 m or 1 m. Enabled snapping also snaps rotation to 15°. With snapping off, pointer rotation is continuous and keyboard rotation is 1°; translation keys use 0.1 m. Shift multiplies keyboard steps by ten.
- Empty-space left drag orbits the camera; right drag pans; the wheel zooms. On touchscreens, use one finger on an object to edit, or two fingers to pan/pinch. Adding a second finger cancels an uncommitted object gesture before handing over to the camera.
- **Esc** cancels placement, an active object gesture or unfinished drawing. **Ctrl/Cmd+Z** cancels an active object gesture first; otherwise it undoes the last committed operation. Every completed object drag adds at most one undo entry; clicking or canceling adds none.
- Editing has no camera inertia, and save-status updates do not resize the canvas. Mobile panels start closed and dismiss after choosing equipment.
- Placement previews and in-flight transforms are transient: they are not autosaved. Scene serialization and existing object data remain unchanged.

### Isolated local review

Build with `npm run typecheck && npm run build`, then run:

```sh
DATA_DIR=/tmp/banquet-preview PORT=3193 npm run dev:server
```

Open `http://localhost:3193`. Use a separate `DATA_DIR` containing copied scene files when evaluating changes; never point the preview at production storage. The server serves the built `dist/` directory, so rebuild and reload after source changes.
