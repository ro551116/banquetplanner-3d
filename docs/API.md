# Banquet Planner 3D Agent API

## 概觀

- Dev server base URL：`http://localhost:3001`
- Vite proxy：前端開發時可用 `http://localhost:3000/api` 代理到 server
- 認證：無
- 格式：除 SVG endpoint 外，request/response 都是 JSON
- 錯誤格式：`{ "error": "message" }`
- 常用 header：`Content-Type: application/json`

以下範例使用：

```bash
BASE=http://localhost:3001
```

## Scenes API

### 列出場景

```bash
curl "$BASE/api/scenes"
```

Response:

```json
[
  {
    "id": "scene-id",
    "name": "晚宴 A",
    "thumbnail": null,
    "created_at": "2026-06-12T10:00:00.000Z",
    "updated_at": "2026-06-12T10:00:00.000Z"
  }
]
```

### 取得單一場景

```bash
curl "$BASE/api/scenes/scene-id"
```

Response:

```json
{
  "id": "scene-id",
  "name": "晚宴 A",
  "thumbnail": null,
  "created_at": "2026-06-12T10:00:00.000Z",
  "updated_at": "2026-06-12T10:00:00.000Z",
  "data": {
    "hall": { "width": 15, "length": 20, "height": 5, "wallColor": "#e8e8e8", "floorColor": "#d4d4d4" },
    "objects": [],
    "drawings": []
  }
}
```

### 建立場景

```bash
curl -X POST "$BASE/api/scenes" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "晚宴 A",
    "data": {
      "hall": { "width": 15, "length": 20, "height": 5, "wallColor": "#e8e8e8", "floorColor": "#d4d4d4" },
      "objects": [],
      "drawings": []
    }
  }'
```

Response:

```json
{
  "id": "scene-id",
  "name": "晚宴 A",
  "created_at": "2026-06-12T10:00:00.000Z",
  "updated_at": "2026-06-12T10:00:00.000Z"
}
```

### 更新場景

整份 `data` 會被替換；`name`、`data`、`thumbnail` 可單獨傳。只傳 `thumbnail`（場景列表縮圖，480×270 JPEG data URL）時不會更新 `updated_at`；前端在離開編輯器時，只有場景尚無縮圖或本次有編輯才會上傳。

```bash
curl -X PUT "$BASE/api/scenes/scene-id" \
  -H "Content-Type: application/json" \
  -d '{ "name": "晚宴 A - 修正版" }'
```

Response:

```json
{ "id": "scene-id", "name": "晚宴 A - 修正版", "updated_at": "2026-06-12T10:05:00.000Z" }
```

可傳入 `baseUpdatedAt`（上次 GET 或成功 PUT 回傳的 `updated_at` 字串）進行樂觀版本檢查。若版本已改變，回傳 HTTP **409**，不寫入任何變更：

```json
{ "error": "conflict", "updated_at": "2026-06-12T10:06:00.000Z" }
```

例如傳入 `{ "data": { "hall": {}, "objects": [], "drawings": [] }, "baseUpdatedAt": "2026-06-12T10:05:00.000Z" }`。省略 `baseUpdatedAt` 會無條件覆寫，保留 Agent／curl 的相容行為；僅更新 `thumbnail` 不檢查版本、也不更新 `updated_at`。編輯器的資料 PUT 逾時為 20 秒，遇到衝突會暫停自動儲存，讓使用者匯出、載入最新版本或明確覆寫。

### 刪除場景

```bash
curl -X DELETE "$BASE/api/scenes/scene-id"
```

Response:

```json
{ "deleted": true }
```

### 附加場景物件

`objects` 必須是陣列。每個物件若沒有 `id`，server 會自動補 UUID。

```bash
curl -X POST "$BASE/api/scenes/scene-id/objects" \
  -H "Content-Type: application/json" \
  -d '{
    "objects": [
      {
        "type": "ROUND_TABLE",
        "position": { "x": 0, "y": 0, "z": 0 },
        "rotation": { "x": 0, "y": 0, "z": 0 },
        "scale": { "x": 1, "y": 1, "z": 1 },
        "color": "#f5f0e8",
        "label": "A1",
        "customSize": 6,
        "tableCloth": "linen"
      }
    ]
  }'
```

Response:

```json
{
  "objects": [
    {
      "id": "generated-object-id",
      "type": "ROUND_TABLE",
      "position": { "x": 0, "y": 0, "z": 0 },
      "rotation": { "x": 0, "y": 0, "z": 0 },
      "scale": { "x": 1, "y": 1, "z": 1 },
      "color": "#f5f0e8",
      "label": "A1",
      "customSize": 6,
      "tableCloth": "linen"
    }
  ],
  "updated_at": "2026-06-12T10:10:00.000Z"
}
```

### 刪除場景物件

```bash
curl -X DELETE "$BASE/api/scenes/scene-id/objects/object-id"
```

Response:

```json
{ "deleted": true, "updated_at": "2026-06-12T10:12:00.000Z" }
```

## 場景 Data Schema

```ts
interface SceneData {
  hall?: HallConfig;
  objects?: BanquetObject[];
  drawings?: DrawingPath[];
}
```

### `hall`

單位是公尺。

| 欄位 | 說明 |
| --- | --- |
| `width` | 場地 X 軸寬度，公尺；有 `outline` 時為外框的外接矩形寬 |
| `length` | 場地 Z 軸長度，公尺；有 `outline` 時為外框的外接矩形長 |
| `height` | 場地 Y 軸高度，公尺 |
| `wallColor` | 牆面色碼 |
| `floorColor` | 地板色碼 |
| `wallRoughness` | 牆面 roughness，選填 |
| `wallMetalness` | 牆面 metalness，選填 |
| `floorRoughness` | 地板 roughness，選填 |
| `floorMetalness` | 地板 metalness，選填 |
| `baseboard` | 踢腳板色碼，選填 |
| `planInfo` | 平面圖標題欄 `{ title, venue, date, version, notes }`，皆為選填字串；`notes` 每行一則 |
| `outline` | 不規則場地的牆角 `[{ x, z }]`（公尺，世界座標，依序相連、首尾自動封閉，3–64 點），選填；省略時為以原點為中心的 `width × length` 矩形 |

有 `outline` 時，載入會把 `width`／`length` 設為外框的外接矩形尺寸；外框中心不必在原點。座標不是有限數字的牆角會被移除，剩不到 3 點則改回矩形。

### `ObjectType`

| 值 | 中文名 |
| --- | --- |
| `ROUND_TABLE` | 圓桌 |
| `RECT_TABLE` | 長桌 |
| `STAGE` | 舞台 |
| `RED_CARPET` | 紅地毯 |
| `COCKTAIL_TABLE` | 雞尾酒桌 |
| `PODIUM` | 講台 |
| `DANCE_FLOOR` | 舞池 |
| `PROJECTION_SCREEN` | 投影幕 |
| `LED_WALL` | LED 牆 |
| `RECEPTION_DESK` | 報到桌 |
| `DECOR` | 裝飾物 |
| `SPEAKER_15` | 15 吋 PA 喇叭 |
| `SPEAKER_MONITOR` | 舞台監聽喇叭 |
| `SPEAKER_SUB` | 超低音喇叭 |
| `SPEAKER_COLUMN` | 音柱喇叭 |
| `SPEAKER_LINE_ARRAY` | 線陣列喇叭 |
| `LIGHT_PAR` | LED 帕燈 |
| `LIGHT_MOVING` | 電腦燈 |
| `LIGHT_STAND` | T 型燈桿 |
| `LIGHT_FOLLOWSPOT` | 追蹤燈 |
| `LIGHT_WASH` | LED 染色燈 |
| `LIGHT_STROBE` | 頻閃燈 / Blinder |
| `TRUSS_STRAIGHT` | Truss 直段 |
| `TRUSS_STRUCTURE` | Truss 結構 |
| `EQUIPMENT_MIXER` | 混音台 |
| `EFFECTS_FOG` | 煙霧 / 薄霧機 |
| `CHAIR` | 單椅（宴會椅 / 兒童椅） |
| `DOOR` | 門（放置時吸附最近牆面） |
| `COLUMN` | 柱子 |
| `TABLE_NUMBER` | 桌號牌（牌面文字＝`label`） |
| `CHAMPAGNE_TOWER` | 香檳塔 |
| `EASEL` | 畫架 |
| `KIOSK` | 設備機台（拍貼機、調酒機等） |
| `GENERATOR` | 發電機 |
| `POWER_DISTRO` | 配電箱 |
| `POWER_OUTLET` | 電源點 |
| `CABLE_RUN` | 電源線路（路徑） |
| `CABLE_RAMP` | 過線橋 |
| `SERVICE_STATION` | 備餐台 |
| `BEVERAGE_CART` | 酒水車 |
| `BAR_COUNTER` | 吧台 |
| `ZONE` | 區域標記 |
| `FLOW_ARROW` | 動線箭頭（路徑） |
| `DIMENSION` | 尺寸標註（路徑，兩點） |
| `DEVICE_POINT` | 設備點位（網路、AP、監控…，編號＝`label`） |
| `WALL` | 隔間牆（路徑） |
| `SPEAKER` | 喇叭（舊資料） |
| `LIGHT` | 燈光（舊資料） |

### `BanquetObject`

| 欄位 | 說明 |
| --- | --- |
| `id` | 物件 ID；append endpoint 可省略，由 server 補 |
| `type` | `ObjectType` |
| `position` | `{ x, y, z }`，公尺；X 左右、Y 高度、Z 前後 |
| `rotation` | `{ x, y, z }`，Euler 角，單位弧度 |
| `scale` | `{ x, y, z }`，縮放倍率 |
| `color` | 色碼 |
| `label` | 顯示標籤，選填 |
| `customSize` | 桌面尺寸，英尺；常用於圓桌 / 長桌 |
| `customWidth` | 自訂寬度，公尺；舞台、紅地毯、Truss 直段等使用 |
| `customDepth` | 自訂深度 / 長度，公尺 |
| `customHeight` | 自訂高度，公尺 |
| `hasBackdrop` | 舞台是否有背板 |
| `intensity` | 燈具強度，通常 0-10 |
| `standType` | `TRIPOD` 或 `PLATE` |
| `arrayCount` | 線陣列箱數，通常 2-8 |
| `stairs` | 舞台階梯設定陣列 |
| `tableCloth` | `linen`、`satin`、`velvet` |
| `trussStructure` | `TRUSS_STRUCTURE` 使用的 `TrussStructureConfig` |
| `trussSchematicColors` | Truss 是否使用圖面色彩 |
| `note` | 備註，顯示在標籤下方與平面圖備註欄 |
| `seatCount` | 圓桌座位數（0-16）；省略時依尺寸：4 尺 5、5 尺 8、6/7 尺 10、8 尺 12 |
| `chairLayout` | 長桌座椅：`both`（預設）、`front`（只有 +Z 側）、`none` |
| `childSeats` | 圓桌 / 長桌中兒童椅數量，計入座位數 |
| `vegetarianSeats` | 圓桌 / 長桌素食數量 |
| `standby` | 備桌；不計入桌數與座位統計 |
| `chairStyle` | 單椅款式：`banquet`（預設）、`child` |
| `tiers` | 香檳塔層數 3-7（預設 5） |
| `doorLeaves` | 門扇：`1` 單開、`2` 雙開（預設） |
| `shape` | 柱子 / 區域標記外形：`rect`（預設）、`round` |
| `voltage` | 電源點電壓：`110V`（預設）、`220V` |
| `powerKva` | 發電機 / 配電箱容量，kVA |
| `points` | 路徑物件（`CABLE_RUN`、`FLOW_ARROW`、`DIMENSION`、`WALL`）節點 `[{ x, z }]`，公尺，相對於 `position`；`DIMENSION` 取第一點與最後一點；`WALL` 最後一點等於第一點時為封閉牆圈 |
| `system` | 設備點位系統：`network` 網路點、`doorplate` 電子門牌、`wifi` 無線 AP、`camera` 監控攝影機、`pos` 公區／POS、`display` 螢幕／端景電視、`access` 門禁、`audio` 音訊點、`other` 其他（預設） |
| `plateStyle` | 桌號牌款式：`table` 桌上立牌（預設）、`floor` 落地立牌 |
| `mount` | 燈具安裝方式（`LIGHT_PAR`、`LIGHT_MOVING`、`LIGHT_WASH`、`LIGHT_STROBE`、`LIGHT`）：`floor` 落地（預設）、`upright` 正掛在 truss 橫梁上、`inverted` 倒吊在 truss 橫梁下 |

`WALL` 以 `customWidth` 為厚度（預設 0.12 m）、`customHeight` 為牆高。`DEVICE_POINT` 的編號存在 `label`（例如 `AP-07`），`position.y` 可作安裝高度；從介面放置時編號依該系統現有編號的前綴自動遞增。

`TABLE_NUMBER` 的牌面文字是 `label`。桌上立牌的 `position.y` 等於桌面高度（圓桌／長桌 0.75 m、雞尾酒桌 1.1 m，加上桌子本身的 `position.y`）且位置落在桌面範圍內時，視為放在該桌上：編輯器移動、旋轉、複製或刪除桌子時會一起處理，平面圖不另畫牌子。

`mount` 為 `upright`／`inverted` 的燈具，`position` 是夾具與 truss 接觸的點：橫梁中心線（box truss 斷面 0.3 m）往上 0.15 m（正掛）或往下 0.15 m（倒吊）。位置落在 `TRUSS_STRAIGHT` 或 `TRUSS_STRUCTURE` 某根水平橫梁的這條線上（誤差 5 cm 內）時，視為掛在該 truss 上：編輯器移動、旋轉、複製或刪除 truss 時會一起處理。倒吊燈具的 `rotation.x` 照燈體本身的方向解讀，所以同一個值在倒吊時光束上下相反。

桌數統計只算座位數大於 0 且非備桌的圓桌 / 長桌，所以無椅長桌（控台、candy bar、收禮桌）不計入。載入時，型別不符的上述選填欄位會被移除，`points` 只保留 `x`、`z` 皆為有限數字的節點。

### `drawings`

```ts
interface DrawingPath {
  id: string;
  points: Array<{ x: number; y: number; z: number }>;
  color: string;
}
```

點座標單位是公尺。

## Truss Studio API

所有 endpoint 都操作同一份 `truss-studio.json`。

### 取得完整 Truss Studio

```bash
curl "$BASE/api/truss-studio"
```

Response:

```json
{
  "events": [
    {
      "id": "event-id",
      "name": "尾牙場",
      "created_at": "2026-06-12T10:00:00.000Z",
      "updated_at": "2026-06-12T10:00:00.000Z",
      "structures": []
    }
  ]
}
```

### 替換完整 Truss Studio

整份 `events` 陣列會被替換，並對所有結構執行 `validateTrussConfig` 驗證。此批次 endpoint 主要供外部工具或備份還原使用；前端工作台則直接調用細粒度之場次與結構 endpoints。

```bash
curl -X PUT "$BASE/api/truss-studio" \
  -H "Content-Type: application/json" \
  -d '{ "events": [] }'
```

Response:

```json
{ "events": [] }
```

### 建立場次

```bash
curl -X POST "$BASE/api/truss-studio/events" \
  -H "Content-Type: application/json" \
  -d '{ "name": "尾牙場" }'
```

Response:

```json
{
  "id": "event-id",
  "name": "尾牙場",
  "created_at": "2026-06-12T10:00:00.000Z",
  "updated_at": "2026-06-12T10:00:00.000Z",
  "structures": []
}
```

### 場次改名

```bash
curl -X PATCH "$BASE/api/truss-studio/events/event-id" \
  -H "Content-Type: application/json" \
  -d '{ "name": "尾牙場 Rev B" }'
```

Response:

```json
{
  "id": "event-id",
  "name": "尾牙場 Rev B",
  "created_at": "2026-06-12T10:00:00.000Z",
  "updated_at": "2026-06-12T10:05:00.000Z",
  "structures": []
}
```

### 刪除場次

```bash
curl -X DELETE "$BASE/api/truss-studio/events/event-id"
```

Response:

```json
{ "deleted": true }
```

### 新增結構

可選傳入 `afterStructureId` 指定插入位置（複製結構時保持相鄰順序）；未傳入或該結構已不存在時，附加至場次末端。

```bash
curl -X POST "$BASE/api/truss-studio/events/event-id/structures" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "kind": "GOALPOST",
      "title": "主舞台",
      "quantity": 1,
      "legs": { "segments": [200, 150, 20] },
      "beam": { "segments": [200, 200, 150] }
    },
    "afterStructureId": "structure-id"
  }'
```

Response:

```json
{
  "id": "structure-id",
  "config": {
    "kind": "GOALPOST",
    "title": "主舞台",
    "quantity": 1,
    "legs": { "segments": [200, 150, 20] },
    "beam": { "segments": [200, 200, 150] }
  },
  "created_at": "2026-06-12T10:10:00.000Z",
  "updated_at": "2026-06-12T10:10:00.000Z"
}
```

### 更新結構

```bash
curl -X PUT "$BASE/api/truss-studio/events/event-id/structures/structure-id" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "kind": "BOX",
      "title": "主舞台口字框",
      "quantity": 1,
      "legs": { "segments": [200, 150, 20] },
      "beam": { "segments": [200, 200, 150] },
      "bottomBeam": { "segments": [200, 200, 150] }
    }
  }'
```

Response:

```json
{
  "id": "structure-id",
  "config": {
    "kind": "BOX",
    "title": "主舞台口字框",
    "quantity": 1,
    "legs": { "segments": [200, 150, 20] },
    "beam": { "segments": [200, 200, 150] },
    "bottomBeam": { "segments": [200, 200, 150] }
  },
  "created_at": "2026-06-12T10:10:00.000Z",
  "updated_at": "2026-06-12T10:15:00.000Z"
}
```

### 刪除結構

```bash
curl -X DELETE "$BASE/api/truss-studio/events/event-id/structures/structure-id"
```

Response:

```json
{ "deleted": true }
```

## TrussStructureConfig Schema

```ts
type TrussSegmentLength = 200 | 150 | 100 | 50 | 20 | 10; // cm
type TrussMemberOrientation = 'VERTICAL' | 'HORIZONTAL' | 'DEPTH';

interface TrussMember {
  segments: TrussSegmentLength[];
}

interface TrussCustomMember {
  id: string;
  label?: string;
  orientation: TrussMemberOrientation;
  segments: TrussSegmentLength[];
  origin: { xCm: number; yCm: number; zCm?: number };
  direction?: 1 | -1;
  basePlate?: boolean;
}

interface TrussStructureConfig {
  kind: 'TOWER' | 'GOALPOST' | 'BACKDROP' | 'BOX' | 'LSHAPE' | 'TSHAPE' | 'MULTI_BAY' | 'CUSTOM';
  legs?: TrussMember;
  legsRight?: TrussMember;
  beam?: TrussMember;
  beamRight?: TrussMember;
  bottomBeam?: TrussMember;
  depthMember?: TrussMember;
  members?: TrussCustomMember[];
  bayCount?: number;
  beamAttachCm?: number;
  quantity: number;
  title: string;
  groupId?: string;
}
```

### `TrussMember.segments`

- 單位：公分
- 合法長度：`200`、`150`、`100`、`50`、`20`、`10`
- 陣列順序就是圖面繪製順序；直柱由下往上，橫梁由左往右，T 型左梁由中心往左
- 每個 member 至少需要一段

### 七種 `kind`

| kind | 圖解 | 說明 |
| --- | --- | --- |
| `TOWER` | `│` | 單支直立柱，只有一個底板 |
| `GOALPOST` | `┌─┐` | ㄇ型，左 / 右立柱加頂梁 |
| `BACKDROP` | `┌─┐ + depth` | 背景框型，ㄇ型加側向深度支撐；SVG 會畫正視圖與側視圖 |
| `BOX` | `□` | 口字框，兩支立柱加上梁與下梁 |
| `LSHAPE` | `└─` | L 型，單柱加單邊水平懸挑 |
| `TSHAPE` | `─┬─` | T 型，單柱加左右水平懸挑 |
| `MULTI_BAY` | `┌┬┬┐` | 連排門型，多支立柱共享一條頂梁 |
| `CUSTOM` | axis members | 自訂軸對齊桿件組合，使用 `members` 描述任意垂直 / 水平 / 深度桿 |

### 各 kind 必填欄位

共同必填：`kind`、`title`、`quantity`。七種預設 kind 仍必填 `legs`；`CUSTOM` 必填 `members`。

| kind | 必填 member | 選填 / 特殊欄位 |
| --- | --- | --- |
| `TOWER` | `legs` | 無 |
| `GOALPOST` | `legs`, `beam` | `legsRight`；省略時右柱等同 `legs` |
| `BACKDROP` | `legs`, `beam`, `depthMember` | `legsRight`；`depthMember` 是側向深度 |
| `BOX` | `legs`, `beam`, `bottomBeam` | `legsRight`；省略時右柱等同 `legs` |
| `LSHAPE` | `legs`, `beam` | `beamAttachCm`，省略時接在柱頂 |
| `TSHAPE` | `legs`, `beam`, `beamRight` | `beam` 是左梁，`beamRight` 是右梁；`beamAttachCm` 省略時接在柱頂 |
| `MULTI_BAY` | `legs`, `beam` | `bayCount`，有效值在 UI 會限制為 2-6，省略時為 2 |
| `CUSTOM` | `members` | `members` 不可為空；preset 欄位不使用 |

### `CUSTOM` 自訂桿件

座標單位是公分。X 向右、Y 向上、Z 向後；所有方向的桿件都可指定 `zCm`，用來描述不同深度平面。3D 模型以 X/Z bounding box 中心對齊物件原點，最低 Y 對齊底部。

| 欄位 | 說明 |
| --- | --- |
| `id` | 桿件 ID，同一 config 內需可識別 |
| `label` | 顯示名稱，選填 |
| `orientation` | `VERTICAL`、`HORIZONTAL` 或 `DEPTH` |
| `segments` | 合法段長陣列，至少一段 |
| `origin` | 桿件起點 `{ xCm, yCm, zCm? }`；`xCm`、`yCm`、`zCm` 皆需 >= 0 |
| `direction` | 只對 `HORIZONTAL` 有效；`1` 向右，`-1` 向左；省略視為 `1` |
| `basePlate` | 只對 `VERTICAL` 有效；省略時 `origin.yCm === 0` 會自動算一片鐵板 |

CUSTOM 的 BOM 加總所有 member 段材及符合規則的鐵板；`couplers` 不計直線分段接縫。任一 member 端點與另一 member 端點／桿身距離 <= 2cm 時形成接點；同位置去重，至少包含兩種軸向才計一個接頭。

預設型式的現行接頭數為 TOWER=0、GOALPOST=2、BACKDROP=4、BOX=4、LSHAPE=1、TSHAPE=1、MULTI_BAY=bayCount+1，再乘上座數。BACKDROP 的既有側撐規則與 CUSTOM 不同：轉為兩個三向交會節點後會變成每座 2 個接頭。建造器會在轉換前明示並允許取消；此差異需依實際供料規格確認，不能把模型 BOM 視為完整扣件／插銷或承重清單。

### 尺寸計算

- 轉角件長度為 25cm。GOALPOST／BACKDROP／BOX 寬度為頂梁段長 + 50cm；MULTI_BAY 加 `(bayCount+1)×25cm`；L 加 25cm；T 為左右梁合計 + 25cm；TOWER 標稱寬度 30cm。
- GOALPOST／BACKDROP／MULTI_BAY 高度為柱長 + 25cm，BOX 加 50cm，TOWER 使用柱長。有獨立右柱的預設型式取較高柱；建造器會另外檢查水平框架是否等高閉合。
- L／T 附掛高度限制在 0 至柱長之間；總高取柱長與 `有效附掛高度 + 25cm` 的較大者，低附掛不額外增加柱頂高度。
- BACKDROP 深度為 `depthMember.segments` 總和。
- CUSTOM 使用所有 member 端點的 bounding box，標示「座標範圍」而非含接頭外徑；有 DEPTH 桿或不同 Z 平面時顯示深度。預設轉 CUSTOM 保留段材並讓端點接合，不保留預設型式的接頭間距。

## 結構圖 SVG

### 取得已儲存結構 SVG

```bash
curl "$BASE/api/truss-studio/events/event-id/structures/structure-id/diagram.svg" \
  -o truss-diagram.svg
```

Response header:

```http
Content-Type: image/svg+xml; charset=utf-8
```

### 直接渲染任意 config

```bash
curl -X POST "$BASE/api/truss/diagram.svg" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "kind": "GOALPOST",
      "title": "主舞台",
      "quantity": 1,
      "legs": { "segments": [200, 150, 20] },
      "beam": { "segments": [200, 200, 150] }
    }
  }' \
  -o truss-diagram.svg
```

### 直接渲染 CUSTOM L 轉角塔

```bash
curl -X POST "$BASE/api/truss/diagram.svg" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "kind": "CUSTOM",
      "title": "L 轉角塔",
      "quantity": 1,
      "members": [
        {
          "id": "corner-column",
          "label": "角柱",
          "orientation": "VERTICAL",
          "segments": [200, 150],
          "origin": { "xCm": 0, "yCm": 0 },
          "basePlate": true
        },
        {
          "id": "right-column",
          "label": "右柱",
          "orientation": "VERTICAL",
          "segments": [200, 150],
          "origin": { "xCm": 300, "yCm": 0 },
          "basePlate": true
        },
        {
          "id": "front-beam",
          "label": "前梁",
          "orientation": "HORIZONTAL",
          "segments": [200, 100],
          "origin": { "xCm": 0, "yCm": 350 },
          "direction": 1
        },
        {
          "id": "depth-beam",
          "label": "深度梁",
          "orientation": "DEPTH",
          "segments": [200],
          "origin": { "xCm": 0, "yCm": 350, "zCm": 0 }
        }
      ]
    }
  }' \
  -o l-corner-custom-truss.svg
```

轉 PNG 可用：

```bash
rsvg-convert truss-diagram.svg -o truss-diagram.png
```

或直接用瀏覽器開啟 `truss-diagram.svg` 後另存 / 截圖。SVG endpoint 會先驗證 `kind` 與所有 `segments`，非法資料回 `400`。

## 常見任務範例

### 建立場次並加一座 ㄇ型 W550 x H375

合法段長是 10cm 粒度，既有配段邏輯會把 375cm 配成 `[200, 150, 20]`，圖面實際高度為 370cm。

```bash
BASE=http://localhost:3001

EVENT_ID=$(
  curl -s -X POST "$BASE/api/truss-studio/events" \
    -H "Content-Type: application/json" \
    -d '{ "name": "尾牙場" }' | jq -r '.id'
)

STRUCTURE_ID=$(
  curl -s -X POST "$BASE/api/truss-studio/events/$EVENT_ID/structures" \
    -H "Content-Type: application/json" \
    -d '{
      "config": {
        "kind": "GOALPOST",
        "title": "主舞台",
        "quantity": 1,
        "legs": { "segments": [200, 150, 20] },
        "beam": { "segments": [200, 200, 150] }
      }
    }' | jq -r '.id'
)

curl "$BASE/api/truss-studio/events/$EVENT_ID/structures/$STRUCTURE_ID/diagram.svg" \
  -o main-stage-truss.svg
```

### 在場景中加 10 張圓桌

```bash
BASE=http://localhost:3001

SCENE_ID=$(
  curl -s -X POST "$BASE/api/scenes" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "10 桌晚宴",
      "data": {
        "hall": { "width": 15, "length": 20, "height": 5, "wallColor": "#e8e8e8", "floorColor": "#d4d4d4" },
        "objects": [],
        "drawings": []
      }
    }' | jq -r '.id'
)

OBJECTS=$(
  node -e '
    const objects = Array.from({ length: 10 }, (_, i) => ({
      type: "ROUND_TABLE",
      position: { x: (i % 5 - 2) * 2.8, y: 0, z: Math.floor(i / 5) * 3 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      color: "#f5f0e8",
      label: `T${i + 1}`,
      customSize: 6,
      tableCloth: "linen"
    }));
    process.stdout.write(JSON.stringify({ objects }));
  '
)

curl -X POST "$BASE/api/scenes/$SCENE_ID/objects" \
  -H "Content-Type: application/json" \
  -d "$OBJECTS"
```
