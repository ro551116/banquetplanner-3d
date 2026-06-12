# PLAN: Truss 工作台加入「場次」層級

## 目標

Truss 工作台目前是一層扁平的結構清單。改成兩層：

```
Truss 工作台
└── 場次（如「512 優越OPPO華山」「0620 某品牌發表會」）
    └── truss 結構（既有卡片：結構圖 + BOM + 編輯/複製/刪除/PNG）
```

## 資料模型與持久化

- `services/trussStudioApi.ts` 改 payload 形狀：
  ```ts
  interface TrussStudioEvent {
    id: string;
    name: string;          // 場次名稱
    created_at: string;
    updated_at: string;    // 場次內結構有變動時更新
    structures: TrussStudioEntry[];  // 既有 entry 不變
  }
  // 文件形狀: { events: TrussStudioEvent[] }
  ```
- `server/index.ts` 的 GET/PUT `/api/truss-studio` 不用改邏輯（整份覆寫），但 GET 時做**向後相容**：讀到舊形狀 `{ structures: [...] }` 且非空時，包成單一場次 `{ events: [{ id: uuid, name: '未分類', structures }] }` 回傳；檔案不存在回 `{ events: [] }`

## UI（`components/TrussStudio.tsx` 改造）

兩個檢視，用內部 state 切換（不動 App.tsx 既有路由）：

### 1. 場次列表（工作台進來的首頁）
- 風格比照 `SceneManager` 卡片 grid：
  - 「新增場次」卡（輸入名稱 → 建立）
  - 每場次一張卡：名稱、結構數量（「N 座結構」）、相對時間（沿用 SceneManager 的 formatDate 寫法）、hover 顯示刪除鈕（confirm）
  - 卡片上提供「重新命名」（點名稱旁鉛筆 icon → inline input）
- 頂欄：返回首頁（既有 onBack）、標題「Truss 工作台」

### 2. 場次內頁（= 現在的結構清單頁）
- 既有功能全部保留：新增結構、卡片（編輯/複製/刪除/PNG）、全部 PNG、列印、BOM 總表
- 頂欄改為：返回場次列表、場次名稱當標題、原有按鈕
- PNG 檔名加場次前綴：`{場次名}-{結構標題}.png`
- 結構增刪改時更新該場次 `updated_at`，並 debounce 存檔（既有機制改成存整份 events）

## 約束

- 既有 `TrussSheetContent` 共用元件與場景內結構圖 modal 不受影響
- 不新增 runtime 依賴；UI 繁中
- `npx tsc --noEmit` + `npm run build` 必須通過
- 不要 git commit
