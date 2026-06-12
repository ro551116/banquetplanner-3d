# PLAN: Truss Phase 2 — 自由桿件編輯（CUSTOM 型式）

## 目標

7 種預設型式涵蓋不了的形狀（L 轉角塔、不對稱多柱、雙層橫梁、任意懸挑組合…）
用「自訂」型式解決：結構 = 任意多根**軸對齊桿件**的組合，每根桿件自由定位與配段。
不做斜桿、不做 3D 自由角度——活動 truss 實務上就是垂直/水平/深度三向。

## Step 1 — 資料模型（`types.ts` + `trussConfig.ts`）

```ts
export type TrussMemberOrientation = 'VERTICAL' | 'HORIZONTAL' | 'DEPTH';

export interface TrussCustomMember {
  id: string;
  label?: string;                       // 「左柱」「頂梁」…顯示用
  orientation: TrussMemberOrientation;
  segments: TrussSegmentLength[];
  origin: { xCm: number; yCm: number; zCm?: number };  // 起點，cm
  direction?: 1 | -1;                   // HORIZONTAL: 1=向右 -1=向左; VERTICAL: 1=向上(固定); DEPTH: 1=向後(固定)
  basePlate?: boolean;                  // 預設: VERTICAL 且 origin.yCm===0 → true
}

// TrussStructureKind 加 'CUSTOM'
// TrussStructureConfig 加 members?: TrussCustomMember[]（CUSTOM 必填）
```

座標系（2D 正視圖）：x 向右、y 向上，原點 = 結構左下；zCm 僅 DEPTH 桿用。

`trussConfig.ts`：
- `getTrussDimensions`：CUSTOM = 所有桿件的 bounding box（W×H，有 DEPTH 桿才有 D）
- **對接頭自動偵測** `detectCustomJoints(members)`：
  - 桿件內部接頭：段與段之間（既有規則）
  - 桿件間接頭：任一桿件的端點（起點或終點）與另一桿件的端點/桿身距離 ≤ 2cm → 1 個對接頭（去重：同一點只算一次）
- `calculateTrussBom`：CUSTOM = 各桿件 segments 加總 + 上述 couplers + basePlate 數
- `formatTrussTitle`：`外徑W×H(×D) 自訂TRUSS(×N座)`
- **預設轉自訂** `convertPresetToMembers(config): TrussCustomMember[]`：
  7 種既有 kind 都能轉（柱/梁/底梁/深度撐一一展開成 members，label 帶中文名）
- `cloneTrussConfig` 深拷貝 members
- config 驗證（server 共用）：CUSTOM 必須 members 非空、segments 合法、origin ≥ 0

## Step 2 — 建造器 UI（`TrussBuilderModal.tsx`）

- kind 選擇器加第 8 顆「自訂」
- **任何預設型式下方加「⤷ 轉為自訂繼續編輯」按鈕**：呼叫 convertPresetToMembers，切到 CUSTOM 模式，現有桿件全帶過去（最重要的入口，使用者從 ㄇ 型起手再加料）
- CUSTOM 模式主面板 = 桿件清單，每根一列：
  - label 輸入、orientation select、origin X/Y(cm) 輸入、HORIZONTAL 才有方向(向右/向左)、VERTICAL 才有鐵板 checkbox
  - 配段：重用既有 MemberEditor（色塊 chips + 增刪改）+「目標長度自動配段」輸入
  - 列操作：複製、刪除
- 「新增桿件」按鈕含快速接續選單：
  - 「自由位置」（origin 0,0）
  - 「接在〈某桿件〉頂端往上 / 往右 / 往左」（origin 自動算 = 該桿件終點）
- 即時 2D 預覽照常（TrussDiagram 直接吃 CUSTOM config）
- 實際外徑顯示 bounding box

## Step 3 — 2D 結構圖（`TrussDiagram.tsx`）

- CUSTOM 正視圖：以共用比例尺把每根 VERTICAL/HORIZONTAL 桿件畫在 (xCm,yCm) 對應位置（沿用 drawMemberSegments，origin 換算進畫布座標）
- 對接頭：detectCustomJoints 的桿件間接點畫 Joint 方塊
- 鐵板：basePlate=true 的垂直桿底部
- 有 DEPTH 桿 → 右側畫側視圖：DEPTH 桿 + 與其相接的 VERTICAL 桿投影（比照 BACKDROP 風格），共用同一比例尺
- 尺寸標註 = bounding box

## Step 4 — 3D 模型（`components/models/TrussStructure.tsx`）

- CUSTOM：每根桿件用既有 MemberRenderer 擺放：
  - VERTICAL → start=(x, y, z) axis=(0,1,0)；HORIZONTAL → axis=(±1,0,0)；DEPTH → axis=(0,0,-1)
  - 座標 cm→m，x 置中（結構中心 = bounding box 中心對齊物件原點）
- 桿件間接點放 CouplerCube、basePlate 放 BasePlate
- 選取 highlight 的 bounding box 用 CUSTOM bbox

## Step 5 — Server 驗證 + API 文件

- `server/index.ts` config 驗證支援 CUSTOM（members 規則同 Step 1）；SVG endpoint 自動生效（同一個 TrussDiagram）
- `docs/API.md` 補 CUSTOM 章節：schema、座標系說明、一個 L 轉角塔的完整 curl 範例

## 相容性與驗證

- 既有 7 種 kind 與存檔完全不變
- `npx tsc --noEmit` + `npm run build` 通過
- 自我驗證：寫個臨時 node script 用 convertPresetToMembers 把 GOALPOST 轉 CUSTOM，斷言 BOM（段數/對接頭/鐵板）與原 GOALPOST 完全一致，跑完刪掉 script
- 不要 git commit
