# PLAN: Truss 結構建造器 + 2D 結構圖輸出 + 重構

## 背景與目標

使用者是活動硬體工程承包者。每場活動要搭多座 truss 結構（燈光架、背景架、ㄇ型展示架），
目前都在 Keynote 手畫「結構圖視」給現場人員看。參考範例（512 OPPO 華山案）包含：

- 高區燈光：外徑 W550×H375 TRUSS ×2 座（ㄇ型）
- 入口處燈光：3.5 米立 TRUSS ×2 座（單立柱）
- 背景結構：外徑 W670×H400×D125 TRUSS（正視圖 + 側視圖，有深度）
- 矮區展示區：外徑 W700×H375 ㄇTRUSS
- 矮區植栽區：外徑 W450×H375 ㄇTRUSS

結構圖的視覺語言（必須完全照做，這是現場工人習慣的圖例）：

| 元素 | 表示法 |
|---|---|
| 200cm 段 | 藍色長條，段上標 `200` |
| 150cm 段 | 綠色長條，標 `150` |
| 100cm 段 | 黃色長條，標 `100` |
| 50cm 段 | 暗紅色短條，標 `50` |
| 20cm 段 | 紅色短條，標 `20` |
| 10cm 段 | 細灰條，標 `10` |
| 對接頭 (coupler) | 段與段之間的黑色小方塊 |
| 鐵板 (base plate) | 立柱底部的黑色橫粗線 |
| 標題 | `<用途名稱> 外徑W***×H***(×D***) TRUSS(×N座 / ㄇTRUSS)` |
| 圖例 | 左側固定一欄：對接頭 + 各長度色塊 + 鐵板 |

**本案目標**：在 banquetplanner-3d 內新增「Truss 建造器」，讓使用者：
1. 選結構型式（立柱 / ㄇ型 / 背景框型含深度）→ 輸入目標外徑 → 自動配段（可手動調整）
2. 結構以 3D 呈現在場景中（與其他物件一樣可移動/旋轉/複製/存檔）
3. 一鍵輸出上述風格的 2D 結構圖（SVG → PNG 下載），含圖例、段標、外徑標題
4. 附帶材料清單（BOM）：各長度段數量、對接頭數、鐵板數

加上一項重構：拆分 1633 行的 `components/BanquetObjects.tsx`。

## 現有架構（已確認）

- React 18 + TS 5.8 + Vite 6 + @react-three/fiber 8 + drei 9.96 + three 0.160，Tailwind CDN
- 狀態全在 `App.tsx` 以 props 下傳；hooks：`useObjects`（含 undo/redo）、`useDrawing`（3D 自由畫筆，已存在，保留不動）、`useSceneIO`（JSON 匯入匯出 + localStorage + server scenesApi）、`useKeyboard`
- `types.ts` 有 `ObjectType.TRUSS_STRAIGHT`（單根直段，legacy，保留相容）
- `components/AdvancedAddModal.tsx` 是現成的 modal 模式可參考
- 無測試框架；驗證靠 `npx tsc --noEmit` + `npm run build`

## 實作步驟

### Step 1 — Data model（`types.ts` + 新檔 `trussConfig.ts`）

```ts
export type TrussSegmentLength = 200 | 150 | 100 | 50 | 20 | 10; // cm
export type TrussStructureKind = 'TOWER' | 'GOALPOST' | 'BACKDROP';
// TOWER = 單立柱；GOALPOST = ㄇ型（雙柱+頂梁）；BACKDROP = ㄇ型 + 深度側撐（產生側視圖）

export interface TrussMember {           // 一根「組合桿件」
  segments: TrussSegmentLength[];        // 由下而上 / 由左而右
}
export interface TrussStructureConfig {
  kind: TrussStructureKind;
  legs: TrussMember;        // 立柱配段（兩柱相同）
  beam?: TrussMember;       // 頂梁（TOWER 無）
  depthMember?: TrussMember;// BACKDROP 的深度撐
  quantity: number;         // ×N座（只影響標題與 BOM，3D 每座獨立物件）
  title: string;            // 用途名稱，如「高區燈光」
}
```

- `BanquetObject` 加選用欄位 `trussStructure?: TrussStructureConfig`
- `ObjectType` 加 `TRUSS_STRUCTURE`
- 新檔 `trussConfig.ts`：
  - `TRUSS_SEGMENT_COLORS: Record<TrussSegmentLength, string>`（200 藍 `#4da6e8`、150 綠 `#7ec850`、100 黃 `#f0d040`、50 暗紅 `#8b3a2a`、20 紅 `#d03030`、10 灰 `#999`，可微調接近 Keynote）
  - `fitSegments(targetCm: number): TrussSegmentLength[]` — greedy 由大到小配段（200→150→100→50→20→10），回傳不超過目標的最佳組合；不足/超出時回傳最接近組合並讓 UI 顯示實際外徑
  - 衍生計算：實際外徑（段長總和 + 對接頭忽略不計）、對接頭數（每根 member 段數-1，另加柱梁交接）、鐵板數（立柱數）
  - BOM 彙總函式：輸入場景中所有 `TRUSS_STRUCTURE` 物件 → 各長度總數、對接頭、鐵板

### Step 2 — Truss 建造器 UI（新檔 `components/TrussBuilderModal.tsx`）

- 仿 `AdvancedAddModal` 的 modal 樣式
- 流程：選 kind（三張小示意圖按鈕）→ 輸入目標 W / H /（D）cm 與標題、座數 → 自動配段
- 配段結果顯示為可編輯清單（每根 member 一列色塊條，可增刪改單段）
- 即時 2D 預覽（直接重用 Step 4 的 SVG 元件）+ 實際外徑顯示
- 「加入場景」→ 以 `createObjectConfig` 模式生成 `TRUSS_STRUCTURE` 物件（quantity N 就放 N 個，間隔 1m）
- 入口：`AddObjectPanel` 加一個「Truss 結構」按鈕開 modal
- `PropertiesPanel`：選中 `TRUSS_STRUCTURE` 時顯示「編輯結構」按鈕重開 modal 帶入現值，儲存即 `updateObject`

### Step 3 — 3D 渲染（新檔 `components/models/TrussStructure.tsx`）

- 依 `TrussStructureConfig` 組 3D：每段渲染為方管桁架（重用現有 TRUSS_STRAIGHT 的幾何做法；若現有做法是簡單 box，就做 30cm 見方、四主管+斜撐的 instanced 簡化桁架即可，效能優先）
- 段與段交界放小黑方塊（對接頭）、柱底放扁黑板（鐵板）
- 提供 schematic 上色模式開關（依段長上色）與寫實模式（鋁銀色），預設寫實；開關放 PropertiesPanel
- 接進 `BanquetObjects.tsx` 的 type switch 與 `ObjectWrapper`（可選取、拖移、旋轉、複製、undo/redo 全部沿用既有機制，不要另起爐灶）

### Step 4 — 2D 結構圖輸出（新檔 `components/TrussDiagram.tsx` + `components/TrussSheetModal.tsx`）

- `TrussDiagram`：純 SVG React 元件，輸入 `TrussStructureConfig` → 畫出正視圖（BACKDROP 另加側視圖在右側），完全比照 Keynote 視覺語言：色碼段 + 段上數字 + 黑色對接頭 + 鐵板 + 標題列 + 左側圖例欄。比例尺自動 fit 進固定畫布（1280×720 視覺基準）
- `TrussSheetModal`：列出場景中全部 truss 結構，每座一頁卡片；底部 BOM 總表
  - 「下載 PNG」：SVG → canvas → PNG（單張 / 全部逐張）
  - 「列印」：window.print() 友善樣式即可
- 入口：`TopToolbar` 加「結構圖」按鈕（場景中有 TRUSS_STRUCTURE 才 enable）

### Step 5 — 序列化相容

- `useSceneIO` 的 JSON 匯出匯入與 server 存讀是 pass-through，確認 `trussStructure` 欄位完整 round-trip
- 舊場景檔（無此欄位）載入不得報錯

### Step 6 — 重構（獨立 commit 範圍，行為不變）

1. 拆 `components/BanquetObjects.tsx`（1633 行）→ `components/models/` 底下按類別分檔：
   `tables.tsx`、`stage.tsx`、`audio.tsx`、`lighting.tsx`、`rigging.tsx`（含新 TrussStructure）、`misc.tsx`，由 `components/models/index.tsx` 統一 re-export，`BanquetObjects.tsx` 只留 type→component 的 dispatch
2. `package.json` 加 `"typecheck": "tsc --noEmit"`
3. 不要動 useDrawing / 既有自由畫筆功能；不要改 Gemini 相關程式

## 驗證

- `npx tsc --noEmit` 零錯誤
- `npm run build` 成功
- 手動煙霧情境（寫進 PR 描述供人工驗）：建一座 GOALPOST W550×H375 → 3D 出現、可拖移 → 開結構圖 modal → 圖例/色碼/段標正確 → 下載 PNG → 匯出 JSON 再匯入結構還在

## 約束

- 不升級任何依賴版本
- 不新增 runtime 依賴（SVG→PNG 用原生 canvas，不裝 html2canvas 之類）
- UI 文案繁體中文
- 不要 git commit，留在 working tree 供 review
