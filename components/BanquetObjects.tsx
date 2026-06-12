import React from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { ObjectType, StairConfig, TableCloth, TrussStructureConfig } from '../types';
import {
  Equipment,
  Label,
  Lighting,
  RectTable,
  RedCarpet,
  RoundTable,
  Speaker,
  Stage,
  TrussStructureModel,
  Venue,
} from './models';

interface BanquetModelProps {
  type: ObjectType;
  color: string;
  selected: boolean;
  isEditMode?: boolean;
  label?: string;
  customSize?: number;
  customWidth?: number;
  customDepth?: number;
  customHeight?: number;
  hasBackdrop?: boolean;
  intensity?: number;
  tilt?: number;
  standType?: 'TRIPOD' | 'PLATE';
  arrayCount?: number;
  stairs?: StairConfig[];
  tableCloth?: TableCloth;
  trussStructure?: TrussStructureConfig;
  trussSchematicColors?: boolean;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}

export const BanquetObjectModel: React.FC<BanquetModelProps> = (props) => {
  const { type, label } = props;

  let content = null;

  if (type === ObjectType.ROUND_TABLE) {
    content = <RoundTable {...props} />;
  } else if (type === ObjectType.RECT_TABLE) {
    content = <RectTable {...props} />;
  } else if (type === ObjectType.STAGE) {
    content = <Stage width={props.customWidth} depth={props.customDepth} height={props.customHeight} hasBackdrop={props.hasBackdrop} stairs={props.stairs} {...props} />;
  } else if (type === ObjectType.RED_CARPET) {
    content = <RedCarpet width={props.customWidth} depth={props.customDepth} {...props} />;
  } else if (type === ObjectType.COCKTAIL_TABLE || type === ObjectType.PODIUM || type === ObjectType.DANCE_FLOOR || type === ObjectType.PROJECTION_SCREEN || type === ObjectType.LED_WALL || type === ObjectType.RECEPTION_DESK) {
    content = <Venue type={type} customWidth={props.customWidth} customDepth={props.customDepth} customHeight={props.customHeight} tableCloth={props.tableCloth} {...props} />;
  } else if (type === ObjectType.TRUSS_STRUCTURE && props.trussStructure) {
    content = <TrussStructureModel config={props.trussStructure} selected={props.selected} isEditMode={props.isEditMode} schematicColors={props.trussSchematicColors} color={props.color} />;
  } else if (type === ObjectType.TRUSS_STRAIGHT || type === ObjectType.EQUIPMENT_MIXER || type === ObjectType.EFFECTS_FOG) {
    content = <Equipment type={type} customWidth={props.customWidth} {...props} />;
  } else if (type.includes('SPEAKER')) {
    content = <Speaker type={type} standType={props.standType} tilt={props.tilt} arrayCount={props.arrayCount} {...props} />;
  } else if (type.includes('LIGHT')) {
    content = <Lighting type={type} intensity={props.intensity} tilt={props.tilt} {...props} />;
  }

  return (
    <group>
      {content}
      {label && <Label text={label} />}
    </group>
  );
};
