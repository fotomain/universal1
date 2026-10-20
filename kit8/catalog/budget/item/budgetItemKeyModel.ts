// Budget item key - the allowed keys activity x management genus of a budget item, and its direction.
//   budgetItemTable.rowJSON.budgetItemGenericKey  '<activity>.<management genus>', e.g. 'investingActivity.materialGenus' (OBLIGATORY on an item)
//   budgetItemTable.rowJSON.direction             'inbound' | 'outbound' (default = the direction of the key; only a correction goes the other way: rowJSON.isCorrection)
//   budgetItemGenericKeyTable                     the 14 allowed keys with the D365 FO / SAP text of the genus row: rowGUID = the key · rowOwnerGUID 'budgetItemGenericKeyCatalog' · rowParentGUID 'empty'
//                                                 · rowJSON { title, activityGenus, managementGenusItem, directionDefault, d365foName, sapName } (read only for the app)
// THE RULE is BUDGET_ITEM_KEY_MATRIX below - the same 14 cells as the SQL function kit8_budget_item_key_matrix() (start2_sql_code.sql PART 32; a Jest test keeps the two equal).
// The three activities are rows of managementActivityGenusTable (kit8/catalog/management/activity_genus).
// SQL: kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql PART 32 · Design: documentation/ACTIVITY_GENUS.html
import type { DefRow, ProductTableDef } from '../../product/productModel';
import { MANAGEMENT_ACTIVITY_GENUS } from '../../management/activity_genus/managementActivityGenusModel';
import { MANAGEMENT_GENUS } from '../../management/genus/managementGenusModel';

export type BudgetItemDirection = 'inbound' | 'outbound';

export const BUDGET_ITEM_DIRECTIONS: { value: BudgetItemDirection; label: string }[] = [
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
];

export const BUDGET_ITEM_KEY_TABLE: ProductTableDef = {
  table: 'budgetItemGenericKeyTable',
  entity: 'budgetItemGenericKeyReusable',
  itemLabel: 'Budget item key',
  catalogOwner: 'budgetItemGenericKeyCatalog',
  purpose: 'The allowed keys of a budget item: an activity (operating, investing, financing) x a management genus, with the default direction (inbound / outbound).',
  emptyRowJSON: () => ({ title: null, activityGenus: null, managementGenusItem: null, directionDefault: null, d365foName: null, sapName: null }),
};

export interface BudgetItemKeyCell { activity: string; genus: string; direction: BudgetItemDirection }

const A = MANAGEMENT_ACTIVITY_GENUS;
const G = MANAGEMENT_GENUS;
/** the allowed cells of the matrix: operating and investing have all six genus, financing only the two payments genus */
export const BUDGET_ITEM_KEY_MATRIX: BudgetItemKeyCell[] = [
  { activity: A.operating, genus: G.time, direction: 'outbound' },
  { activity: A.operating, genus: G.material, direction: 'outbound' },
  { activity: A.operating, genus: G.expense, direction: 'outbound' },
  { activity: A.operating, genus: G.revenue, direction: 'inbound' },
  { activity: A.operating, genus: G.inboundPayment, direction: 'inbound' },
  { activity: A.operating, genus: G.outboundPayment, direction: 'outbound' },
  { activity: A.investing, genus: G.time, direction: 'outbound' },
  { activity: A.investing, genus: G.material, direction: 'outbound' },
  { activity: A.investing, genus: G.expense, direction: 'outbound' },
  { activity: A.investing, genus: G.revenue, direction: 'inbound' },
  { activity: A.investing, genus: G.inboundPayment, direction: 'inbound' },
  { activity: A.investing, genus: G.outboundPayment, direction: 'outbound' },
  { activity: A.financing, genus: G.inboundPayment, direction: 'inbound' },
  { activity: A.financing, genus: G.outboundPayment, direction: 'outbound' },
];

const isSet = (g: unknown): g is string => typeof g === 'string' && g !== '' && g !== 'empty';

/** 'investingActivity' + 'materialGenus' -> 'investingActivity.materialGenus' */
export const budgetItemKeyOf = (activity: string, genus: string): string => `${activity}.${genus}`;

/** 'investingActivity.materialGenus' -> { activity, genus } (empty strings when it is not a key) */
export function budgetItemKeyParts(key: unknown): { activity: string; genus: string } {
  const s = typeof key === 'string' ? key : '';
  const i = s.indexOf('.');
  return i < 0 ? { activity: '', genus: '' } : { activity: s.slice(0, i), genus: s.slice(i + 1) };
}

const cellOfKey = (key: unknown): BudgetItemKeyCell | undefined => BUDGET_ITEM_KEY_MATRIX.find((c) => budgetItemKeyOf(c.activity, c.genus) === key);

/** the activity of a budget item (from its key); '' when it has none */
export const budgetItemActivityOf = (rowJSON: Record<string, any> | undefined | null): string => budgetItemKeyParts(rowJSON?.budgetItemGenericKey).activity;

/** the default direction of a key; null = not an allowed key */
export const budgetItemKeyDirection = (key: unknown): BudgetItemDirection | null => cellOfKey(key)?.direction ?? null;

/** the activities a genus can have, in the order of the cash flow statement (Time -> operating, investing; Payments -> operating, investing, financing) */
export const budgetItemActivitiesOfGenus = (genus: unknown): string[] => BUDGET_ITEM_KEY_MATRIX.filter((c) => c.genus === genus).map((c) => c.activity);

/** the key a new item of the genus gets: the operating one (an old item stays what it was) */
export const budgetItemDefaultKey = (genus: unknown): string | null => {
  const a = budgetItemActivitiesOfGenus(genus);
  return a.length === 0 ? null : budgetItemKeyOf(a.includes(A.operating) ? A.operating : a[0], String(genus));
};

/** the choices of the Activity column of an item of this genus: value = the key, label = the short title of the activity */
export const budgetItemActivityOptions = (genus: unknown, activityRows: DefRow<any>[]): { value: string; label: string }[] =>
  budgetItemActivitiesOfGenus(genus).map((activity) => {
    const r = (activityRows || []).find((x) => x.rowGUID === activity);
    const title = String(r?.rowJSON?.title ?? '').trim() || activity;
    return { value: budgetItemKeyOf(activity, String(genus)), label: title.replace(/\s+activity$/i, '') };
  });

/** the obligatory key: null = ok, else the message */
export function budgetItemKeyError(key: unknown, genus: unknown): string | null {
  if (!isSet(key)) return 'A budget item needs an activity (budgetItemGenericKey)';
  if (!cellOfKey(key)) return `"${String(key)}" is not an allowed activity x genus key`;
  if (budgetItemKeyParts(key).genus !== genus) return `The key "${String(key)}" is not a key of the management genus "${String(genus)}"`;
  return null;
}

/** the direction of an item: null = ok, else the message (only a correction may differ from the direction of its key) */
export function budgetItemDirectionError(direction: unknown, key: unknown, isCorrection?: unknown): string | null {
  if (direction !== 'inbound' && direction !== 'outbound') return 'The direction must be inbound or outbound';
  const d = budgetItemKeyDirection(key);
  if (d && direction !== d && isCorrection !== true) return `The direction of this key is ${d}: mark the item as a correction to reverse it`;
  return null;
}

/**
 * Derived fields after a cell change (computeRowJSON of the table): the key follows the genus (a key of another genus becomes the default key of the genus) and the direction follows the
 * key (missing = the default of the key). A patch of the fields that change, {} when nothing does.
 */
export function budgetItemKeyPatch(rowJSON: Record<string, any> | undefined | null): Record<string, any> {
  const genus = rowJSON?.managementGenusItem;
  if (!isSet(genus)) return {};
  const patch: Record<string, any> = {};
  let key = rowJSON?.budgetItemGenericKey;
  if (!isSet(key) || budgetItemKeyError(key, genus) !== null) {
    const def = budgetItemDefaultKey(genus);
    if (def) { key = def; patch.budgetItemGenericKey = def; }
  }
  const d = budgetItemKeyDirection(key);
  const directionSet = rowJSON?.direction === 'inbound' || rowJSON?.direction === 'outbound';
  // a new key (the genus changed) brings the direction of its genus along, unless the item is a correction
  if (d && (!directionSet || (patch.budgetItemGenericKey && rowJSON?.isCorrection !== true))) patch.direction = d;
  return patch;
}

/** the items without a valid key / direction (the warning of the screen) */
export const budgetItemsWithoutKey = (items: DefRow<any>[]): DefRow<any>[] =>
  (items || []).filter((r) => budgetItemKeyError(r.rowJSON?.budgetItemGenericKey, r.rowJSON?.managementGenusItem) !== null
    || budgetItemDirectionError(r.rowJSON?.direction, r.rowJSON?.budgetItemGenericKey, r.rowJSON?.isCorrection) !== null);
