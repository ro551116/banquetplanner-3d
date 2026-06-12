# PLAN: 首頁功能優先 + Truss 型式擴充（Phase 1）

## Part A — 首頁改為「功能優先」

目前首頁直接是場景列表，Truss 工作台是上方一條附加橫幅。改成先選功能：

1. 新增 `components/HomeMenu.tsx`：全頁兩張大入口卡並排（風格沿用 SceneManager 卡片）：
   - 「🏛 宴會廳 3D 場景」副標「3D 擺場規劃、燈光音響、截圖」→ 進場景列表
   - 「🛠 Truss 工作台」副標「結構配段、結構圖輸出、BOM、場次管理」→ 進工作台
   - 各卡顯示數量 badge（場景數 / 場次數，從 API 抓，抓失敗就不顯示）
2. `App.tsx` view 路由改為：`'home' | 'scenes' | 'trussStudio'`（+ 既有 sceneId 編輯器）。預設 `'home'`
3. `SceneManager` 移除 Truss 工作台橫幅，新增返回首頁鈕（左上角，比照 TrussStudio）
4. 從場景編輯器「返回場景列表」仍回 `scenes`（不是 home）

## Part B — Truss 型式擴充

### B1. 資料模型（`types.ts` + `trussConfig.ts`）

```ts
export type TrussStructureKind =
  | 'TOWER'      // 立柱（既有）
  | 'GOALPOST'   // ㄇ型（既有）
  | 'BACKDROP'   // 背景框型（既有）
  | 'BOX'        // 口字框：雙柱 + 頂梁 + 底梁（落地橫梁）
  | 'LSHAPE'     // L 型：單柱 + 單邊懸挑梁
  | 'TSHAPE'     // T 型：單柱 + 左右兩邊懸挑梁
  | 'MULTI_BAY'; // 連排門型：N+1 支柱等距 + 連續頂梁

export interface TrussStructureConfig {
  kind: TrussStructureKind;
  legs: TrussMember;          // 柱配段（預設所有柱相同）
  legsRight?: TrussMember;    // 右柱獨立配段（GOALPOST/BACKDROP/BOX 適用；undefined = 同 legs）
  beam?: TrussMember;         // 頂梁 / L 型懸挑梁 / T 型左梁
  beamRight?: TrussMember;    // T 型右梁
  bottomBeam?: TrussMember;   // BOX 底梁（通常同 beam）
  depthMember?: TrussMember;  // BACKDROP 深度撐（既有）
  bayCount?: number;          // MULTI_BAY 跨數（2-6），柱數 = bayCount+1
  beamAttachCm?: number;      // L/T 型梁附掛高度（從地面，預設 = 柱頂）
  quantity: number;
  title: string;
  groupId?: string;
}
```

`trussConfig.ts` 對應更新：
- `getTrussDimensions`：各 kind 的 W（TOWER=30、L/T=梁總長、MULTI_BAY=頂梁長、其餘=beam 長）
- `calculateTrussBom`：
  - 柱數：TOWER/L/T=1、GOALPOST/BACKDROP/BOX=2（legsRight 有值時左右分開算）、MULTI_BAY=bayCount+1
  - 梁：各 kind 對應 beam/beamRight/bottomBeam/depthMember
  - 柱梁交接對接頭：GOALPOST/BACKDROP=2、BOX=4、L=1、T=2、MULTI_BAY=bayCount+1
  - 鐵板 = 柱數
- `formatTrussTitle`：suffix 對應（口字TRUSS / L型TRUSS / T型TRUSS / 連排ㄇTRUSS×N跨）
- `createDefaultTrussConfig` 支援新 kind 預設值

### B2. 建造器（`TrussBuilderModal.tsx`）

- kind 選擇器從 3 顆按鈕擴成 7 顆（小示意圖示意即可，CSS 畫或 SVG inline）
- 依 kind 顯示對應欄位：
  - BOX：目標 W/H；底梁預設複製頂梁配段，可獨立調
  - LSHAPE/TSHAPE：目標懸挑長度（T 型左右各一）＋「梁附掛高度」（預設柱頂，可改）
  - MULTI_BAY：跨數 select(2-6) + 目標總寬 W / 柱高 H
  - GOALPOST/BACKDROP/BOX：新增「右柱獨立配段」toggle，開啟後多一組 MemberEditor
- 既有自動配段、實際外徑、2D 即時預覽全部適用新 kind

### B3. 2D 結構圖（`TrussDiagram.tsx`）

各 kind 正視圖畫法（沿用既有色碼段/對接頭/鐵板語言、共用比例尺）：
- BOX：兩柱 + 頂梁 + 底梁（底梁貼地畫在鐵板上方），四角 Joint
- LSHAPE：單柱 + 從附掛高度往右的水平梁，柱底鐵板
- TSHAPE：單柱 + 左右兩水平梁
- MULTI_BAY：N+1 支柱等距 + 連續頂梁（柱位以梁總長等分），每柱鐵板
- legsRight 有值時右柱按右柱配段畫
- 寬度標註與外徑計算對應更新

### B4. 3D 模型（`components/models/TrussStructure.tsx`）

- 各新 kind 對應 3D 組裝（沿用 MemberRenderer 軸向擺放即可）：
  - BOX 底梁貼地（y=0.04）、LSHAPE/TSHAPE 梁在 beamAttachCm 高度
  - MULTI_BAY 柱等距、頂梁通長
  - legsRight 右柱獨立渲染
- 對接頭/鐵板位置對應

### 相容性

- 既有存檔（三種 kind、無新欄位）載入必須完全不變
- `npx tsc --noEmit` + `npm run build` 通過；不要 git commit
