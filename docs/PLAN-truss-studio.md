# PLAN: Truss 工作台（獨立於宴會廳場景的 truss 結構圖工具）

## 目標

使用者要能**不進任何宴會廳場景**，直接從首頁進入「Truss 工作台」：
建立/編輯/刪除 truss 結構、即時看 2D 結構圖、輸出 PNG / 列印 / BOM 總表。
資料獨立持久化（與 scenes 無關），重新整理或換頁回來都還在。

**最大化重用既有元件**：`TrussBuilderModal`、`TrussDiagram`、`trussConfig.ts` 的 BOM/標題函式都直接拿來用，不要複製貼上邏輯。

## 實作步驟

### Step 1 — Server 持久化（`server/index.ts`）

仿照 scenes 的檔案存法，新增單一文件 resource：

- `GET /api/truss-studio` → 回傳 `{ structures: TrussStudioEntry[] }`，檔案不存在時回傳 `{ structures: [] }`
- `PUT /api/truss-studio` → 整份覆寫存到 `DATA_DIR/truss-studio.json`
- `TrussStudioEntry = { id: string; config: TrussStructureConfig; created_at: string; updated_at: string }`

### Step 2 — Client API（新檔 `services/trussStudioApi.ts`）

- `trussStudioApi.get()` / `trussStudioApi.save(structures)`，比照 `scenesApi` 的 `apiFetch` 寫法

### Step 3 — 共用結構圖卡片（重構抽取）

- 從 `TrussSheetModal.tsx` 抽出可共用的部分到新檔 `components/TrussSheetContent.tsx`：
  - `TrussCard`：單一結構卡片（標題列 + `TrussDiagram` + 每段 BOM 列 + PNG 按鈕），action 區用 props 插槽（studio 模式要多「編輯/複製/刪除」按鈕）
  - `TrussBomSummary`：BOM 總表區塊
  - `downloadSvgAsPng` / `safeFilename` 移到這裡 export
- `TrussSheetModal` 改用以上共用件，行為不變（場景內結構圖照舊）

### Step 4 — Truss 工作台頁面（新檔 `components/TrussStudio.tsx`）

- 全頁版面（非 modal），風格延續 `SceneManager` 的淺色卡片風
- 頂欄：返回首頁、標題「Truss 工作台」、「新增結構」、「全部 PNG」、「列印」
- 主體：每個 structure 一張 `TrussCard`（含編輯/複製/刪除 action）+ 底部 `TrussBomSummary`（quantity 直接用 `config.quantity`，不經過 `getTrussGroups`，studio 沒有場景物件概念）
- 「新增結構」與「編輯」都開既有 `TrussBuilderModal`（傳 `initialConfig` 即可，submit 後寫回 structures 陣列）
- 空狀態：引導文案 + 新增按鈕
- 持久化：structures 變更後 debounce 1 秒 `trussStudioApi.save()`；進頁時 `get()` 載入
- 刪除要 `confirm()` 確認

### Step 5 — 路由與首頁入口

- `App.tsx`：新增 view state `'home' | 'trussStudio'`（沿用既有 `sceneId` 判斷）：`!sceneId && view === 'trussStudio'` → 渲染 `TrussStudio`，`onBack` 回 home
- `SceneManager.tsx`：場景 grid **上方**加一張橫幅入口卡「🛠 Truss 工作台 — 不開場景，直接畫 truss 結構圖」，點擊呼叫新 prop `onOpenTrussStudio`

## 約束

- 不動 wiki 既有場景內 truss 流程（TrussBuilderModal 簽名可加 optional props，不可破壞既有呼叫）
- 不新增 runtime 依賴
- UI 文案繁體中文
- `npx tsc --noEmit` 與 `npm run build` 必須通過
- 不要 git commit

## 驗收情境

1. 首頁 → 點「Truss 工作台」→ 新增結構（ㄇ型 W550×H375）→ 卡片出現結構圖
2. 重新整理瀏覽器 → 進工作台 → 結構還在（server 持久化生效）
3. 編輯結構改寬度 → 圖即時更新；複製 → 多一張；刪除 → 消失
4. 「全部 PNG」下載成功；場景內的結構圖 modal 行為不變
