
export enum ObjectType {
  ROUND_TABLE = 'ROUND_TABLE',
  RECT_TABLE = 'RECT_TABLE',
  STAGE = 'STAGE',
  RED_CARPET = 'RED_CARPET',
  COCKTAIL_TABLE = 'COCKTAIL_TABLE', // Standing height table
  PODIUM = 'PODIUM',               // Lectern
  DANCE_FLOOR = 'DANCE_FLOOR',     // Flat dance area
  PROJECTION_SCREEN = 'PROJECTION_SCREEN',
  LED_WALL = 'LED_WALL',           // Video wall
  RECEPTION_DESK = 'RECEPTION_DESK', // Check-in desk
  DECOR = 'DECOR',
  
  // Audio
  SPEAKER_15 = 'SPEAKER_15',       // 15-inch PA on Stand
  SPEAKER_MONITOR = 'SPEAKER_MONITOR', // Stage Monitor (Wedge)
  SPEAKER_SUB = 'SPEAKER_SUB',     // Subwoofer
  SPEAKER_COLUMN = 'SPEAKER_COLUMN', // Column Array

  // Audio - new
  SPEAKER_LINE_ARRAY = 'SPEAKER_LINE_ARRAY', // Line Array (flown/stacked)

  // Lighting
  LIGHT_PAR = 'LIGHT_PAR',         // LED Par
  LIGHT_MOVING = 'LIGHT_MOVING',   // Moving Head
  LIGHT_STAND = 'LIGHT_STAND',     // T-Bar Stand with 4 Pars
  // Lighting - new
  LIGHT_FOLLOWSPOT = 'LIGHT_FOLLOWSPOT', // Follow Spot
  LIGHT_WASH = 'LIGHT_WASH',       // LED Wash Panel
  LIGHT_STROBE = 'LIGHT_STROBE',   // Strobe / Blinder

  // Rigging & Equipment
  TRUSS_STRAIGHT = 'TRUSS_STRAIGHT', // Box Truss Section
  TRUSS_STRUCTURE = 'TRUSS_STRUCTURE', // Built truss structure
  EQUIPMENT_MIXER = 'EQUIPMENT_MIXER', // FOH Mixer Console
  EFFECTS_FOG = 'EFFECTS_FOG',     // Fog / Haze Machine

  // Venue structure & seating
  CHAIR = 'CHAIR',                 // Single loose chair (banquet or child high chair)
  DOOR = 'DOOR',                   // Wall door / service opening
  COLUMN = 'COLUMN',               // Architectural column / pilaster

  // Wedding decor & vendors
  CHAMPAGNE_TOWER = 'CHAMPAGNE_TOWER',
  EASEL = 'EASEL',                 // Welcome / photo easel
  KIOSK = 'KIOSK',                 // Vendor machine (photo print, cocktail machine, ...)
  TABLE_NUMBER = 'TABLE_NUMBER',   // Table number plate (on a table top, or a floor-standing sign)

  // Power
  GENERATOR = 'GENERATOR',
  POWER_DISTRO = 'POWER_DISTRO',   // Distribution box
  POWER_OUTLET = 'POWER_OUTLET',   // Power drop / outlet point
  CABLE_RUN = 'CABLE_RUN',         // Path: cable route
  CABLE_RAMP = 'CABLE_RAMP',       // Cable protector across walkways

  // Catering
  SERVICE_STATION = 'SERVICE_STATION',
  BEVERAGE_CART = 'BEVERAGE_CART',
  BAR_COUNTER = 'BAR_COUNTER',

  // Plan annotations
  ZONE = 'ZONE',                   // Floor area marker
  FLOW_ARROW = 'FLOW_ARROW',       // Path: circulation arrow
  DIMENSION = 'DIMENSION',         // Path: two-point dimension line
  DEVICE_POINT = 'DEVICE_POINT',   // Numbered device / cable drop point (network, AP, camera, ...)

  // Interior structure
  WALL = 'WALL',                   // Path: partition wall

  // Legacy
  SPEAKER = 'SPEAKER',
  LIGHT = 'LIGHT'
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export type StairSide = 'front' | 'back' | 'left' | 'right';

export interface StairConfig {
  id: string;
  side: StairSide;
  offset: number; // Offset from center of that side (meters)
  width: number;  // Width of the stair unit (meters)
}

/** Path vertex in the object's local XZ plane (meters, relative to `position`). */
export interface PathPoint {
  x: number;
  z: number;
}

export type ChairLayout = 'both' | 'front' | 'none';
export type ChairStyle = 'banquet' | 'child';
export type FootprintShape = 'rect' | 'round';
export type Voltage = '110V' | '220V';
/** Device point systems; each has a code prefix, colour and plan symbol (planning.ts DEVICE_SYSTEMS). */
export type DeviceSystem = 'network' | 'doorplate' | 'wifi' | 'camera' | 'pos' | 'display' | 'access' | 'audio' | 'other';
/** TABLE_NUMBER: a small tabletop stand or a floor-standing sign. */
export type PlateStyle = 'table' | 'floor';
/** Lights: standing on the floor (default), clamped on top of a truss beam, or hung upside down under it. */
export type LightMount = 'floor' | 'upright' | 'inverted';

export type TableCloth = 'linen' | 'satin' | 'velvet';

export type TrussSegmentLength = 200 | 150 | 100 | 50 | 20 | 10; // cm
export type TrussMemberOrientation = 'VERTICAL' | 'HORIZONTAL' | 'DEPTH';
export type TrussStructureKind =
  | 'TOWER'
  | 'GOALPOST'
  | 'BACKDROP'
  | 'BOX'
  | 'LSHAPE'
  | 'TSHAPE'
  | 'MULTI_BAY'
  | 'CUSTOM';

export interface TrussMember {
  segments: TrussSegmentLength[];
}

export interface TrussCustomMember {
  id: string;
  label?: string;
  orientation: TrussMemberOrientation;
  segments: TrussSegmentLength[];
  origin: { xCm: number; yCm: number; zCm?: number };
  direction?: 1 | -1;
  basePlate?: boolean;
}

export interface TrussStructureConfig {
  kind: TrussStructureKind;
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

export interface BanquetObject {
  id: string;
  type: ObjectType;
  position: Vector3;
  rotation: Vector3; // Euler angles in radians
  scale: Vector3;
  color: string;
  label?: string;
  customSize?: number; // Size in feet (e.g., 4, 5, 6, 8)
  customWidth?: number; // For Stage/Carpet (Meters)
  customDepth?: number; // For Stage/Carpet (Meters - acts as Length)
  customHeight?: number; // For Stage (Meters)
  hasBackdrop?: boolean; // Stage Backdrop Toggle
  intensity?: number; // Light intensity (0-10 range ideally)
  standType?: 'TRIPOD' | 'PLATE'; // Stand style
  arrayCount?: number; // Line array box count (2-8)
  stairs?: StairConfig[]; // Array of stairs attached to the stage
  tableCloth?: TableCloth; // Table cloth material type
  trussStructure?: TrussStructureConfig;
  trussSchematicColors?: boolean;
  /** Free planning note shown under the label and in the floor plan notes (e.g. "13:30 撤離"). */
  note?: string;
  /** ROUND_TABLE: chair count override (0-16); default follows table size. */
  seatCount?: number;
  /** RECT_TABLE: which long sides get chairs. Default 'both'. */
  chairLayout?: ChairLayout;
  /** Tables: how many of the seats are child high chairs (counted within the seats). */
  childSeats?: number;
  /** Tables: vegetarian meal count, shown as green markers. */
  vegetarianSeats?: number;
  /** Tables: standby table (備桌); excluded from the table/seat totals. */
  standby?: boolean;
  /** CHAIR */
  chairStyle?: ChairStyle;
  /** CHAMPAGNE_TOWER: glass tiers (3-7). */
  tiers?: number;
  /** DOOR: 1 = single leaf, 2 = double leaf. */
  doorLeaves?: 1 | 2;
  /** COLUMN, ZONE: rectangular or round/elliptical footprint. */
  shape?: FootprintShape;
  /** POWER_OUTLET */
  voltage?: Voltage;
  /** GENERATOR, POWER_DISTRO: rated capacity in kVA. */
  powerKva?: number;
  /** CABLE_RUN, FLOW_ARROW, DIMENSION, WALL: polyline vertices relative to `position`. */
  points?: PathPoint[];
  /** DEVICE_POINT: which system the point belongs to; its code is the object's label (e.g. AP-07). */
  system?: DeviceSystem;
  /** TABLE_NUMBER: tabletop stand (default) or floor sign; the number shown is the object's label. */
  plateStyle?: PlateStyle;
  /** Lights: floor stand (default) or clamped to a truss beam, upright on top or inverted underneath. */
  mount?: LightMount;
}

/** Title block printed on the exported floor plan. Stored with the hall. */
export interface PlanInfo {
  title?: string;
  venue?: string;
  date?: string;
  version?: string;
  notes?: string;
}

export interface HallConfig {
  /** X extent; with an outline this is the outline's bounding-box width. */
  width: number;
  /** Z extent; with an outline this is the outline's bounding-box length. */
  length: number;
  height: number; // y-axis
  wallColor: string;
  floorColor: string;
  wallRoughness?: number;
  wallMetalness?: number;
  floorRoughness?: number;
  floorMetalness?: number;
  baseboard?: string;
  planInfo?: PlanInfo;
  /**
   * Irregular floor plan: wall corners in world XZ (meters), in order, implicitly closed.
   * Absent = a width × length rectangle centred on the origin.
   */
  outline?: PathPoint[];
}

export interface CameraView {
  position: [number, number, number];
  target: [number, number, number];
  name: string;
}

export interface DrawingPath {
  id: string;
  points: Vector3[];
  color: string;
}
