// homeSettingsModel - the look settings of the appPM80 home (pure, tested).
//   itemsPerRow: how many of the 8 circles stand in ONE row of the grid (the first row has exactly this many; 2, 3 or 4; default 3)
//   itemShape  : the form of the 8 items (circle | square)
// Kept on THIS device (homeSettingsLocal.ts). The ROI ring stands above the grid on a phone in portrait.

export type PM80ItemsPerRow = 2 | 3 | 4;
export type PM80ItemShape = 'circle' | 'square';

export interface PM80HomeSettings {
  itemsPerRow: PM80ItemsPerRow;
  itemShape: PM80ItemShape;
}

export const PM80_ITEMS_PER_ROW_OPTIONS: PM80ItemsPerRow[] = [2, 3, 4];
export const PM80_ITEM_SHAPE_OPTIONS: PM80ItemShape[] = ['circle', 'square'];

export const PM80_HOME_SETTINGS_DEFAULT: PM80HomeSettings = { itemsPerRow: 3, itemShape: 'circle' };

/** anything stored / typed -> a valid setting (a wrong value falls back to the default of THAT field) */
export function normalizeHomeSettings(raw: unknown): PM80HomeSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const n = Number(r.itemsPerRow);
  const itemsPerRow = (PM80_ITEMS_PER_ROW_OPTIONS as number[]).includes(n) ? (n as PM80ItemsPerRow) : PM80_HOME_SETTINGS_DEFAULT.itemsPerRow;
  const itemShape = r.itemShape === 'square' || r.itemShape === 'circle' ? r.itemShape : PM80_HOME_SETTINGS_DEFAULT.itemShape;
  return { itemsPerRow, itemShape };
}

/** the items cut in rows of `perRow` (the first row is full, the last may be shorter) */
export function gridRows<T>(items: T[], perRow: number): T[][] {
  const n = Math.max(1, Math.floor(perRow) || 1);
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += n) rows.push(items.slice(i, i + n));
  return rows;
}

/** corner radius of an item box of side `size` */
export function itemRadius(shape: PM80ItemShape, size: number): number {
  return shape === 'square' ? Math.round(size * 0.22) : size / 2;
}
