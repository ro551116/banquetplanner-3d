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

座標系（2D 正視圖）：x 向右、y 向上，z 向後；所有方向的桿件皆可設定 `zCm`，不只 DEPTH 桿。

`trussConfig.ts`：
- `getTrussDimensions`：CUSTOM = 所有桿件端點的 bounding box；有 DEPTH 桿或不同 Z 平面時顯示 D。這是桿件座標範圍，不含預設型式的 25cm 接頭間距。
- **接點偵測** `detectCustomJoints(members)`：
  - 保留桿件內部的分段接點資料，但它們不計入 BOM 的 `couplers`。
  - 任一桿件端點與另一桿件端點／桿身距離 ≤ 2cm 時形成接點；同一位置去重，包含至少兩種軸向才計一個接頭。
- `calculateTrussBom`：各桿件段材加總 + 上述轉向接點 + 鐵板。
- `formatTrussTitle`：CUSTOM 使用「座標範圍W×H(×D)」，不再誤稱含接頭的外徑。
- **預設轉自訂** `convertPresetToMembers(config): TrussCustomMember[]`：
  7 種既有 kind 都能轉（柱/梁/底梁/深度撐一一展開成 members，label 帶中文名）
  平面預設轉換後柱梁確實相接，段材、接頭及鐵板數一致；座標範圍可能小於原外徑。BACKDROP 仍有歷史規則差異：預設每座 4 接頭，CUSTOM 的兩個三向交會節點只計 2；轉換前必須顯示差異並允許取消，不擅自修改既存 BOM 口徑。
- `cloneTrussConfig` 深拷貝 members
- config 驗證（server 共用）：CUSTOM 必須 members 非空、segments 合法、origin ≥ 0

## Step 2 — 建造器 UI（`TrussBuilderModal.tsx`）

- kind 選擇器加第 8 顆「自訂」
- 預設型式提供「轉為自訂繼續編輯」，明確告知座標範圍與外徑的差異。一般型式往返保留自訂草稿；只有明確重新轉換才替換草稿。
- CUSTOM 模式主面板 = 桿件清單，每根一列：
  - label、orientation、origin X/Y/Z(cm)、HORIZONTAL 水平方向、VERTICAL 鐵板設定。
  - 配段：重用既有 MemberEditor（色塊 chips + 增刪改）+「目標長度自動配段」輸入
  - 列操作：複製、刪除
- 「新增桿件」按鈕含快速接續選單：
  - 「自由位置」（origin 0,0）
  - 「接在〈某桿件〉頂端往上 / 往右 / 往左」（origin 自動算 = 該桿件終點）
  - 接續以完整 member ID 識別錨點；刪除錨點後回到自由位置。負起點先顯示驗證錯誤，不能送出 API。
- 即時 2D 預覽照常（TrussDiagram 直接吃 CUSTOM config）
- 尺寸顯示標示為「桿件座標範圍」，不與預設外徑混用。

## Step 3 — 2D 結構圖（`TrussDiagram.tsx`）

- CUSTOM 正視圖：以共用比例尺把每根 VERTICAL/HORIZONTAL 桿件畫在 (xCm,yCm) 對應位置（沿用 drawMemberSegments，origin 換算進畫布座標）
- 對接頭：detectCustomJoints 的桿件間接點畫 Joint 方塊
- 鐵板：basePlate=true 的垂直桿底部
- 有 DEPTH 桿或不同 Z 平面時顯示側視圖：投影垂直桿、深度桿及接點，使用共同比例尺。
- 尺寸標註 = 桿件端點 bounding box。

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

- 既有七種預設與存檔 schema 保留；修正尺寸、配段及接合計算後，衍生圖面可能與舊版不同。
- `npx tsc --noEmit` + `npm run build` 通過
- 回歸：`node_modules/.bin/tsx --test trussConfig.test.ts`；六種平面預設轉 CUSTOM 的 BOM 應一致，BACKDROP 驗證段材／鐵板保留及柱梁相接，接頭差異由 UI 明示。
- 不要 git commit
