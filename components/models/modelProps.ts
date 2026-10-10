import type { ThreeEvent } from '@react-three/fiber';
import type { BanquetObject } from '../../types';

/** Props every object model receives: the object's data fields plus render state. */
export type ObjectModelProps = Omit<BanquetObject, 'id' | 'position' | 'rotation' | 'scale'> & {
  selected: boolean;
  isEditMode?: boolean;
  /** Lights/speakers: head tilt taken from rotation.x (the wrapper does not tilt the whole object). */
  tilt?: number;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
};
