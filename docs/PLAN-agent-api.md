# PLAN: Agent 可操作的 REST API + 文件

## 目標

讓 AI agent（或任何程式）能透過 HTTP API 完整操作這個 app：管理場景與物件、管理 truss 場次與結構、取得結構圖 SVG。最後產出一份 agent 看得懂的 API 文件。

## Step 1 — Truss Studio 細粒度 API（`server/index.ts`）

既有整份 GET/PUT `/api/truss-studio` 保留。新增細粒度操作（都操作同一份 `truss-studio.json`）：

- `POST /api/truss-studio/events` body `{ name }` → 建場次，回傳 event
- `PATCH /api/truss-studio/events/:eventId` body `{ name }` → 改名
- `DELETE /api/truss-studio/events/:eventId`
- `POST /api/truss-studio/events/:eventId/structures` body `{ config: TrussStructureConfig }` → 新增結構（server 產 id/timestamps）
- `PUT /api/truss-studio/events/:eventId/structures/:structureId` body `{ config }` → 更新
- `DELETE /api/truss-studio/events/:eventId/structures/:structureId`
- 找不到回 404 JSON `{ error }`；body 缺欄位回 400

## Step 2 — Server 端結構圖 SVG（重點功能）

讓 agent 不開瀏覽器就能拿到結構圖：

- `GET /api/truss-studio/events/:eventId/structures/:structureId/diagram.svg` → `Content-Type: image/svg+xml`
- `POST /api/truss/diagram.svg` body `{ config: TrussStructureConfig }` → 直接渲染任意 config（不必先存）

實作：用 `react-dom/server` 的 `renderToStaticMarkup` 渲染既有 `TrussDiagram` 元件：
- 新增 `server/renderDiagram.tsx`：import TrussDiagram、輸出 `<?xml version="1.0"?>` + SVG 字串
- `server/tsconfig.json` 開 `"jsx": "react-jsx"`；tsx runtime 跑 .tsx 沒問題
- `TrussDiagram` 若有 browser-only 依賴要解開（它應該是純 SVG，無 window 依賴；驗證一下）
- config 先過基本驗證（kind 合法、segments 都在 [200,150,100,50,20,10]），非法回 400

## Step 3 — 場景物件便利 API（`server/index.ts`）

場景已有整份 CRUD。agent 常見操作再加兩個便利 endpoint（避免 agent 每次都要搬整份 data）：

- `POST /api/scenes/:id/objects` body `{ objects: BanquetObject[] }` → append 到 `data.objects`（server 補 id 若缺）
- `DELETE /api/scenes/:id/objects/:objectId`

## Step 4 — API 文件（`docs/API.md`）

寫給 agent 的完整參考，繁中，包含：

1. **概觀**：base URL（dev: `http://localhost:3001`，vite proxy `http://localhost:3000/api`）、無認證、JSON
2. **Scenes API**：全部 endpoint + request/response 範例（curl）
3. **場景 data schema**：`hall`、`objects`（**完整列出 ObjectType enum 每個值與中文名**）、`BanquetObject` 每個欄位的意義/單位（公尺、弧度）、`drawings`
4. **Truss Studio API**：場次/結構全部 endpoint + curl 範例
5. **TrussStructureConfig schema**：7 種 kind 圖解說明、TrussMember/segments 規則（合法長度 enum）、各 kind 必填欄位表
6. **結構圖 SVG**：兩個 endpoint 用法 + 用 `rsvg-convert` 或瀏覽器轉 PNG 的提示
7. **常見任務範例**：「建立場次並加一座 ㄇ型 W550×H375」「在場景中加 10 張圓桌」end-to-end curl 腳本

## 驗證

- `npx tsc --noEmit`、`npm run build` 通過
- server 啟動後 `curl -X POST /api/truss/diagram.svg` 用範例 config 真的回 SVG（自己驗證）
- 不要 git commit
