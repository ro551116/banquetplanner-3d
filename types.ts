
export enum ObjectType {
  ROUND_TABLE = 'ROUND_TABLE',
  RECT_TABLE = 'RECT_TABLE',
  STAGE = 'STAGE',
  RED_CARPET = 'RED_CARPET', // New
  DECOR = 'DECOR',
  
  // Audio
  SPEAKER_15 = 'SPEAKER_15',       // 15-inch PA on Stand
  SPEAKER_MONITOR = 'SPEAKER_MONITOR', // Stage Monitor (Wedge)
  SPEAKER_SUB = 'SPEAKER_SUB',     // Subwoofer
  SPEAKER_COLUMN = 'SPEAKER_COLUMN', // Column Array

  // Lighting
  LIGHT_PAR = 'LIGHT_PAR',         // LED Par
  LIGHT_MOVING = 'LIGHT_MOVING',   // Moving Head
  LIGHT_STAND = 'LIGHT_STAND',     // T-Bar Stand with 4 Pars
  
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

export type TableCloth = 'linen' | 'satin' | 'velvet';

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
  stairs?: StairConfig[]; // Array of stairs attached to the stage
  tableCloth?: TableCloth; // Table cloth material type
}

export interface HallConfig {
  width: number; // x-axis
  length: number; // z-axis
  height: number; // y-axis
  wallColor: string;
  floorColor: string;
  wallRoughness?: number;
  wallMetalness?: number;
  floorRoughness?: number;
  floorMetalness?: number;
  baseboard?: string;
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