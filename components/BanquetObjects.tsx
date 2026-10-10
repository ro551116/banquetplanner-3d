import React from 'react';
import { ObjectType } from '../types';
import {
  BarCounter,
  BeverageCart,
  CableRamp,
  CableRun,
  ChairModel,
  ChampagneTower,
  Column,
  Dimension,
  Door,
  Easel,
  Equipment,
  DevicePoint,
  FlowArrow,
  Generator,
  Kiosk,
  Label,
  Lighting,
  PowerDistro,
  PowerOutlet,
  PartitionWall,
  RectTable,
  RedCarpet,
  RoundTable,
  ServiceStation,
  Speaker,
  Stage,
  TableNumber,
  TrussStructureModel,
  Venue,
  Zone,
} from './models';
import type { ObjectModelProps } from './models/modelProps';

/** Model components that take the object's fields directly. */
const MODELS: Partial<Record<ObjectType, React.FC<ObjectModelProps>>> = {
  [ObjectType.ROUND_TABLE]: RoundTable,
  [ObjectType.RECT_TABLE]: RectTable,
  [ObjectType.CHAIR]: ChairModel,
  [ObjectType.DOOR]: Door,
  [ObjectType.COLUMN]: Column,
  [ObjectType.CHAMPAGNE_TOWER]: ChampagneTower,
  [ObjectType.EASEL]: Easel,
  [ObjectType.KIOSK]: Kiosk,
  [ObjectType.GENERATOR]: Generator,
  [ObjectType.POWER_DISTRO]: PowerDistro,
  [ObjectType.POWER_OUTLET]: PowerOutlet,
  [ObjectType.CABLE_RUN]: CableRun,
  [ObjectType.CABLE_RAMP]: CableRamp,
  [ObjectType.SERVICE_STATION]: ServiceStation,
  [ObjectType.BEVERAGE_CART]: BeverageCart,
  [ObjectType.BAR_COUNTER]: BarCounter,
  [ObjectType.ZONE]: Zone,
  [ObjectType.FLOW_ARROW]: FlowArrow,
  [ObjectType.DIMENSION]: Dimension,
  [ObjectType.WALL]: PartitionWall,
  [ObjectType.DEVICE_POINT]: DevicePoint,
  [ObjectType.TABLE_NUMBER]: TableNumber,
};

/** Floor graphics keep their name tag close to the floor instead of 2 m up. */
const LABEL_HEIGHT: Partial<Record<ObjectType, number>> = {
  [ObjectType.ZONE]: 0.5,
  [ObjectType.CABLE_RUN]: 0.5,
  [ObjectType.FLOW_ARROW]: 0.5,
  [ObjectType.CABLE_RAMP]: 0.6,
  [ObjectType.POWER_OUTLET]: 1,
  [ObjectType.CHAIR]: 1.4,
  [ObjectType.DEVICE_POINT]: 1.05,
};

export const BanquetObjectModel: React.FC<ObjectModelProps> = (props) => {
  const { type, label, note } = props;

  let content = null;

  const Model = MODELS[type];
  if (Model) {
    content = <Model {...props} />;
  } else if (type === ObjectType.STAGE) {
    content = <Stage width={props.customWidth} depth={props.customDepth} height={props.customHeight} hasBackdrop={props.hasBackdrop} stairs={props.stairs} {...props} />;
  } else if (type === ObjectType.RED_CARPET) {
    content = <RedCarpet width={props.customWidth} depth={props.customDepth} {...props} />;
  } else if (type === ObjectType.COCKTAIL_TABLE || type === ObjectType.PODIUM || type === ObjectType.DANCE_FLOOR || type === ObjectType.PROJECTION_SCREEN || type === ObjectType.LED_WALL || type === ObjectType.RECEPTION_DESK || type === ObjectType.DECOR) {
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
      {/* Dimensions and number plates print their label on the object itself. */}
      <Label text={type === ObjectType.DIMENSION || type === ObjectType.TABLE_NUMBER ? undefined : label} note={note?.trim()} height={LABEL_HEIGHT[type]} />
    </group>
  );
};
