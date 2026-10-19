import { BanquetObject, HallConfig, ObjectType } from './types';

/** Venue fixtures a hall preset (廳房) carries besides the hall itself. */
export const HALL_STRUCTURE_TYPES: Partial<Record<ObjectType, true>> = { [ObjectType.DOOR]: true, [ObjectType.COLUMN]: true, [ObjectType.WALL]: true };

/** What a hall preset stores: the hall without the event's floor-plan title block, plus the venue's fixed structures. */
export interface HallPresetContent {
  hall: HallConfig;
  objects: BanquetObject[];
}

/** "芙洛麗 3F Ballroom II": the venue, when known, then the hall name. */
export function hallPresetTitle({ name, venue }: { name: string; venue?: string | null }): string {
  return venue ? `${venue} ${name}` : name;
}

export function buildHallPreset(hall: HallConfig, objects: BanquetObject[], includeStructures: boolean): HallPresetContent {
  const { planInfo: _eventTitleBlock, ...venueHall } = hall;
  return { hall: venueHall, objects: includeStructures ? objects.filter(object => HALL_STRUCTURE_TYPES[object.type]) : [] };
}

/** The preset's hall with the scene's own title block, whose 場地 becomes the preset title. */
export function presetHallFor(current: HallConfig, presetHall: HallConfig, title: string): HallConfig {
  const { planInfo: _presetTitleBlock, ...venueHall } = presetHall;
  return { ...venueHall, planInfo: { ...current.planInfo, venue: title } };
}

/**
 * Replaces the scene's doors, columns and partition walls with the preset's, under fresh ids; other objects stay.
 * A preset saved without structures leaves the scene's own in place instead of deleting them.
 */
export function withPresetStructures(objects: BanquetObject[], presetObjects: BanquetObject[], newId: () => string): BanquetObject[] {
  const structures = presetObjects.filter(object => HALL_STRUCTURE_TYPES[object.type]);
  if (structures.length === 0) return objects;
  return [...objects.filter(object => !HALL_STRUCTURE_TYPES[object.type]), ...structures.map(object => ({ ...object, id: newId() }))];
}
