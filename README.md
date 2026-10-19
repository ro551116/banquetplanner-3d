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

## Semi-realistic 3D preview

- Edit mode keeps direct object manipulation and the floor grid. View mode adds ambient occlusion (full resolution on desktops, half resolution on touch devices), ACES tone mapping and SMAA anti-aliasing.
- 截圖 renders the current view once more at 3840 px on the long edge (2560 px on touch devices) through the same post-processing, then restores the screen resolution. Labels are HTML overlays and are not part of the image.
- Day/night lighting uses a locally generated reflection environment; no remote HDR or model downloads are required. Floors and fabrics use small procedural relief textures with anisotropic filtering.
- Halls are a width × length rectangle or an irregular outline (L shapes, cut corners, octagons, stage alcoves, any polygon). Walls follow every outline edge with mitred corners; walls whose outside faces the camera cut away automatically; indoor views retain the walls. Hidden walls do not intercept picking.
- Overview, top and side views fit the hall and viewport. Stage view uses the stage's position, dimensions and rotation; an empty hall falls back to an overview.
- Dragging or zooming takes over the camera immediately. Clicking a view preset again restores that framing. Labels are hidden by default in View and can be toggled in the toolbar.
- Existing scene data, object dimensions/colors, API formats and truss engineering calculations are unchanged. Presentation preferences are not saved into scene data.

Lighting is a visual approximation, not a photometric simulation. Fixture spotlights and rectangular panel lights illuminate scene surfaces without per-fixture shadows; occluders may not block their light. The main scene light retains shadows. Instanced chairs, merged truss/lens geometry and a capped pixel ratio limit rendering cost; touch devices also keep the cheaper half-resolution occlusion.

### Equipment model library

- All 48 object types, including legacy speaker/light types, use local procedural geometry; no external model downloads or branded assets are required. Signage text (easel board, kiosk header, number plates, rating plates, the 備 card) is drawn on local canvas textures.
- Round and rectangular tables have draped cloth, curved upholstered chair backs and tubular frames. Chairs use three instanced meshes per table while remaining selectable as part of that table.
- Stage decks retain their exact configured top height, with pleated skirts, optional backdrop drapes and stairs on all four sides. Screens, LED walls, dance floors and furniture retain their existing dimension/color fields.
- Audio cabinets use shaped shells and aligned perforated grilles; lighting fixtures have separate housings, yokes, lenses and stands. Head tilt does not tilt floor supports.
- PAR, moving head, wash and strobe fixtures can also be clamped to a truss beam: standing on the top face or hung upside down under it, on a bridge bar with a half-coupler on each chord.
- Visible emission stays on the lens/LED face, with no solid cone overlays. Round fixtures project from their apertures; wash and strobe panels use forward-facing rectangular area lights. Zero intensity disables the emitter, and both source types follow head tilt and day/night intensity scaling.
- Truss sections merge rounded tubes and braces into one mesh. Preset joints use the existing connector dimension; engineering calculations, segment lists and BOM rules are unchanged.
- Dimension-dependent geometries and selection outlines release replaced GPU resources. Shared fixed-size geometry remains reusable across objects and placement previews.
- These are refined planning models, not manufacturer CAD or structural/load certification.

### Banquet planning objects

- **Seating:** round tables take a seat count override (0–16, 「恢復預設」 returns to the size default), rectangular tables seat both sides, one side or none, and both mark child high chairs and vegetarian meals (green markers). A standby table (備桌) carries a 備 card. The status bar quotes the plan the way banquet sheets do — `15 桌＋備 1・151 位（兒童椅 2）・素 1` — counting only seated, non-standby tables.
- **Venue structure:** loose chairs (banquet or child), doors (single/double, with plan-style swing arcs), columns (square/round) and partition walls (隔間牆: thickness and height, drawn like a path; clicking the first vertex closes a room loop with mitred corners). While placing, a door lands in the nearest wall — hall outline (slanted and inner-corner walls included) or partition, facing the side it was placed from; a column snaps flush to a wall face when placed within 0.8 m of it.
- **Hall shape:** 場地設定 → 尺寸與形狀 switches between 矩形 and 不規則. An irregular hall starts from a template (L 形, 斜角, 八角, 舞台凸出 — sized to the current outline box), is drawn corner by corner on the floor (「在場景中描繪外框」: click the first corner or press Enter to close), or is typed as corner coordinates with per-wall lengths, insert and delete. The panel shows the outline box, floor area and wall count and warns when walls cross. Replacing a custom outline asks first, because hall edits are not in the undo history.
- **Hall presets (廳房):** 場地設定 → 廳房 saves the current hall (size, outline, wall and floor colours and materials) as a named venue preset (地點 + 廳名), optionally with its doors, columns and partition walls. Saving the same 地點 and 廳名 again overwrites that preset after a confirmation. 套用 replaces the scene's hall and keeps every other object; a preset that has structures also replaces the scene's doors, columns and partition walls, and one saved without them keeps the scene's own. The floor-plan title block keeps its fields and its 場地 becomes the preset name. A new scene can start from a preset instead of the blank hall; it then gets no default stage or speakers. Presets are stored on the server (`/api/hall-presets`, `docs/API.md`).
- **Decor and vendors:** champagne tower (3–7 tiers), easel (board text = name), equipment kiosk (photo print, cocktail machine; header text = name), table number plate (桌號牌: tabletop stand or floor sign; plate text = name).
- **Table number plates:** placing a tabletop plate snaps it to the centre of the table under the pointer, turned with the table, and copies the table's name as its number; placement continues table after table until Esc. A selected table (or several) offers 「加上桌號牌」 for the tables that have none. A plate standing on a table moves, rotates, duplicates and is deleted with it; the floor plan prints the table's number once instead of a separate plate symbol.
- **Power:** generator (kVA), distribution box, 110V/220V outlet points, cable runs and cable ramps.
- **Catering:** service station, beverage cart, bar counter.
- **Plan annotations:** area markers (rectangle/ellipse), flow arrows (新人進場/出菜/賓客/撤場 presets), dimension lines that print their measured length unless named, and device points (設備點位).
- **Device points:** network, door plate, Wi-Fi AP, camera, POS, display/TV, access control, audio and other systems, each with its own colour and symbol in 3D and on the plan. The code is the point's name; placing points stays in placement mode and numbers them in sequence (choose the system in the floating bar), continuing the prefix the scene already uses for that system (e.g. MN-32 after an imported MN-31). Height Y can hold the mounting height.
- Cable runs, flow arrows, dimensions and partition walls are drawn: click the floor to add vertices, Shift locks 45°, Enter or clicking the last vertex finishes, Backspace removes a vertex, Esc cancels. 「重新繪製」 redraws an existing path and keeps its other properties. Every object has a 備註 shown under its label and in the floor plan notes (device point notes go to the point list instead).

### Floor plan export

更多 → 平面圖 renders a top-down, to-scale SVG of the hall: tables with chairs, child/vegetarian markers and standby styling, partition walls, doors with swings, columns, cable runs with total length, flow arrows, dimensions, zones, device points with codes and freehand drawings. Irregular halls are drawn from their outline with every wall's length; the title block reports the outline box, wall count and floor area. Objects outside the hall (foyer) extend the sheet. The title block (標題/場地/日期/版本/備註) is stored with the hall as `planInfo`; seating, power and device-point summaries, a scale bar, per-object notes and a legend of the symbols in use (device systems with counts) are generated. 點位系統 checkboxes limit the sheet to chosen systems (one sheet per system); 下載點位清單 CSV exports code, system, world X/Z, height and note. Download SVG or 2× PNG, or print / save as PDF.

## Direct scene editing

- New scenes place the two tripod speakers on the floor outside the stage's left/right edges, with clearance for their feet. Existing saved layouts are not repositioned.
- Choose equipment in the palette, move the translucent preview over the scene, then click/tap to place. Placement recognizes stage tops. New truss structures also enter placement after the builder; a multi-structure quantity commits together.
- **Truss builder:** 常用樣式 starts from a common structure — 投影幕架, LED 牆架, 舞台背板架, 迎賓門架, 燈光／喇叭立柱, 連排燈架 (3 bays), 四柱燈架 and 攤位框 — sized to whole 200/150/100/50 sections. The two four-post frames are 自訂 structures measured on member centrelines, with one coupler per top corner. The typed name and quantity carry over; replacing hand-edited segments asks first. The preview switches between 3D (orbit, 1 m grid, 170 cm figure for scale, optional section colours) and the 2D diagram; every structure in Truss 工作台 also has a 3D button.
- **Lights on truss:** while placing a PAR, moving head, wash or strobe, the floating bar switches 落地 / 正掛 truss / 倒吊 truss (remembered for the next light). On a truss setting the preview clamps to the beam the pointer passes over (top face or underneath, stepped along the beam by the snap size) and faces into the hall; placement continues fixture after fixture until Esc. Hung fixtures start aimed about 35° down, and their 仰角 slider moves the beam the same way as a standing fixture's. In the properties panel 安裝方式 moves a placed light back to the floor or onto the nearest beam within 2 m. A clamped light moves, rotates, duplicates and is deleted with its truss.
- Click an object to select; Shift-click toggles multi-selection; click empty floor (without dragging) to clear the selection. Drag a selected object to move the selection together. Ground-parallel movement preserves every object's existing height.
- **G — Move:** drag on the XZ plane; arrow keys nudge in XZ.
- **R — Rotate:** drag horizontally around the selection's shared center; left/right arrows rotate.
- **H — Height:** drag vertically; up/down arrows adjust height. Numeric properties remain available in the right panel.
- Grid snapping is selectable: off, 0.1 m, 0.5 m or 1 m. Enabled snapping also snaps rotation to 15°. With snapping off, pointer rotation is continuous and keyboard rotation is 1°; translation keys use 0.1 m. Shift multiplies keyboard steps by ten.
- Empty-space left drag orbits the camera; right drag pans; the wheel zooms. On touchscreens, use one finger on an object to edit, or two fingers to pan/pinch. Adding a second finger cancels an uncommitted object gesture before handing over to the camera.
- **Esc** cancels placement, an active object gesture or unfinished drawing. **Ctrl/Cmd+Z** cancels an active object gesture first; otherwise it undoes the last committed operation. Every completed object drag adds at most one undo entry; clicking or canceling adds none.
- Editing has no camera inertia, and save-status updates do not resize the canvas. Mobile panels start closed and dismiss after choosing equipment.
- Number and name fields commit on blur or Enter. Clearing a field or typing a partial value never moves an object; focusing and leaving a field without a change adds no undo entry. A continuous slider or colour drag is one undo step.
- 清除標註 asks for confirmation. Selections drop objects that no longer exist after undo/redo or list deletion.
- Placement previews and in-flight transforms are transient: they are not autosaved. Scene serialization and existing object data remain unchanged.

## Saving and data safety

- Autosave runs 2 s after an edit. If another tab, device or Agent changed the scene first, autosave pauses and a dialog offers 匯出我的版本 / 載入最新版本 / 以我的版本覆蓋 instead of silently overwriting.
- When the server is unreachable the save indicator turns red and saving retries automatically; leaving the page or the editor while changes are unsaved asks first.
- Scenes and imported files are checked on load: broken transforms are repaired, unknown objects are skipped and duplicate ids are renamed, so one bad object cannot blank the editor. Imports ask before replacing the sections the file contains. A render error stays inside the editor with 重新載入場景 / 返回場景列表.
- Truss builder: leaving a dimension field unchanged keeps hand-tuned segments; closing with unsaved builder edits asks first; IME Enter/Esc never submits or closes.

## Interface

UI rules (type scale, colours, components, responsive behaviour) live in `docs/UI-DESIGN-SYSTEM.md`; Tailwind is compiled at build time.

- **Toolbar:** scene name, 編輯｜預覽, move/rotate/height tools and snapping (≥1024px), 更多 menu (import, export JSON, 平面圖, 結構圖, 批次新增, shortcut help; undo/redo below 640px), save indicator (emerald saved, amber unsaved, red retry), 新增/屬性 panel toggles.
- **Panels:** the add palette (場地/佈置/音響/燈光/電力/餐飲/圖面/其他 tabs) and the properties panel dock at ≥1024px and become bottom sheets below it; only one sheet opens at a time. With a selection, its properties come first and 場地設定 collapses.
- **Floating bar:** placement and selection actions (再製, 刪除) appear at the bottom of the canvas; below 1024px it also holds the edit tools, and in 預覽 the view presets.
- **預覽:** dark presentation chrome; 全景/俯視/舞台/側面 frame the projected bounds of the hall or stage; object labels stay 12px at any zoom.
- **Lists:** leaving a scene stores a list thumbnail when it has none or was edited; the home page shows the three most recently updated scenes. Card actions are visible on touch and keyboard focus.

## Isolated local review

Build with `npm run typecheck && npm test && npm run build`, then run:

```sh
DATA_DIR=/tmp/banquet-preview PORT=3193 npm run dev:server
```

Open `http://localhost:3193`. Use a separate `DATA_DIR` containing copied scene files when evaluating changes; never point the preview at production storage. The server serves the built `dist/` directory, so rebuild and reload after source changes.
