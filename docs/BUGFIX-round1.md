# Bug 修復清單 Round 1

逐項修復以下 6 個已確認 bug。不要做清單以外的重構。

## 1. 右側 Sidebar 重開後被擠出視窗外（最高優先）
- 重現：1440px 視窗開啟場景 → 齒輪關閉面板 → 齒輪再開 → 面板 DOM 存在但 x=1457（視窗外）
- 根因：`App.tsx` 的 3D canvas 容器 `<div className="flex-1 relative">` 是 flex item，預設 `min-width:auto`，R3F canvas 撐開後不會縮回，Sidebar remount 時被推出 `overflow-hidden` 的 root 之外
- 修法：canvas 容器加 `min-w-0 overflow-hidden`；確認 AddObjectPanel 同理沒有相同問題

## 2. VIEW 模式齒輪按鈕無效
- `TopToolbar.tsx:205` 齒輪在 VIEW 模式仍顯示，但 `Sidebar.tsx:41` 只在 EDIT 模式渲染 → VIEW 模式點齒輪毫無反應
- 修法：齒輪按鈕只在 `mode === 'EDIT'` 時渲染

## 3. Truss 群組單獨編輯後結構圖/BOM 失真
- `App.tsx:105` 編輯多座群組中的一座時只 update 該物件但保留共用 `groupId` → `getTrussGroups` 仍用第一座的 config 代表整組，結構圖與 BOM 顯示錯誤配段
- 修法：單獨編輯時移除該物件的 `groupId`（讓它自成一組、quantity=1），標題沿用使用者輸入

## 4. 手機版新增抽屜蓋住 Truss 建造器
- `AddObjectPanel.tsx:99` 點 Truss 結構開 builder modal 時沒關掉 mobile 抽屜，兩者同為 z-50，後渲染的抽屜蓋住 builder
- 修法：開 builder 前先關閉 add panel（呼叫 `setIsOpen(false)`），或 builder modal z-index 提高到 z-[60]

## 5. Truss 選中時藍色高亮永不顯示
- 兩個原因疊加：
  a. `components/BanquetObjects.tsx:55` 傳 `isEditMode={props.isEditMode}` 但 `ObjectWrapper.tsx` 從未把 `isEditMode` 傳進 `BanquetObjectModel` → 永遠 undefined
  b. `components/models/TrussStructure.tsx:267` highlight 包在 `visible={false}` 的 mesh 裡，three.js 父物件 invisible 會連子物件（drei Edges）一起跳過渲染
- 修法：ObjectWrapper 傳入 isEditMode；bounding mesh 改為可見但材質全透明（`meshBasicMaterial transparent opacity={0} depthWrite={false}`），讓 `<Highlight />`（Edges）能渲染

## 6. 載入空場景時殘留上一場景的狀態
- `hooks/useSceneIO.ts:37` loadScene 用 `if (scene.data.xxx)` 條件式 set → 載入 `data: {}` 的新場景時，上一場景的 hall/objects/drawings 留在記憶體，1 秒後 autosave 把舊內容寫進新場景
- 修法：loadScene 一律重設：`hall = data.hall ?? INITIAL_HALL`、`objects = data.objects ?? INITIAL_OBJECTS`、`drawings = data.drawings ?? []`（與新場景預設一致），selectedIds 清空

## 驗證
- `npx tsc --noEmit` 與 `npm run build` 必須通過
- 不要 git commit
