import type { PMRowJSONCommon } from './types';

/** Task bar color from rowJSON (taskColor, legacy color fallback). Re-exported by model/types.ts. */
export function taskColorOf(json: PMRowJSONCommon | undefined | null): string | null {
  if (!json) return null;
  if (json.taskColor !== undefined) return json.taskColor || null; // explicit (null = automatic)
  return json.color || null;
}
