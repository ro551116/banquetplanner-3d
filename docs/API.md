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

整份 `data` 會被替換；`name`、`data`、`thumbnail` 可單獨傳。

```bash
curl -X PUT "$BASE/api/scenes/scene-id" \
  -H "Content-Type: application/json" \
  -d '{ "name": "晚宴 A - 修正版" }'
```

Response:

```json
{ "id": "scene-id", "name": "晚宴 A - 修正版", "updated_at": "2026-06-12T10:05:00.000Z" }
```

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
| `width` | 場地 X 軸寬度，公尺 |
| `length` | 場地 Z 軸長度，公尺 |
| `height` | 場地 Y 軸高度，公尺 |
| `wallColor` | 牆面色碼 |
| `floorColor` | 地板色碼 |
| `wallRoughness` | 牆面 roughness，選填 |
| `wallMetalness` | 牆面 metalness，選填 |
| `floorRoughness` | 地板 roughness，選填 |
| `floorMetalness` | 地板 metalness，選填 |
| `baseboard` | 踢腳板色碼，選填 |

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
    }
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

interface TrussMember {
  segments: TrussSegmentLength[];
}

interface TrussStructureConfig {
  kind: 'TOWER' | 'GOALPOST' | 'BACKDROP' | 'BOX' | 'LSHAPE' | 'TSHAPE' | 'MULTI_BAY';
  legs: TrussMember;
  legsRight?: TrussMember;
  beam?: TrussMember;
  beamRight?: TrussMember;
  bottomBeam?: TrussMember;
  depthMember?: TrussMember;
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

### 各 kind 必填欄位

共同必填：`kind`、`title`、`quantity`、`legs`。

| kind | 必填 member | 選填 / 特殊欄位 |
| --- | --- | --- |
| `TOWER` | `legs` | 無 |
| `GOALPOST` | `legs`, `beam` | `legsRight`；省略時右柱等同 `legs` |
| `BACKDROP` | `legs`, `beam`, `depthMember` | `legsRight`；`depthMember` 是側向深度 |
| `BOX` | `legs`, `beam`, `bottomBeam` | `legsRight`；省略時右柱等同 `legs` |
| `LSHAPE` | `legs`, `beam` | `beamAttachCm`，省略時接在柱頂 |
| `TSHAPE` | `legs`, `beam`, `beamRight` | `beam` 是左梁，`beamRight` 是右梁；`beamAttachCm` 省略時接在柱頂 |
| `MULTI_BAY` | `legs`, `beam` | `bayCount`，有效值在 UI 會限制為 2-6，省略時為 2 |

### 尺寸計算

- 高度：`legs.segments` 總和，若有 `legsRight` 則取左右柱較高者；L/T 型也會納入 `beamAttachCm`
- 寬度：一般為 `beam.segments` 總和；T 型為 `beam + beamRight`；Tower 固定顯示 30cm 寬
- 深度：只有 `BACKDROP` 使用 `depthMember.segments` 總和

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
