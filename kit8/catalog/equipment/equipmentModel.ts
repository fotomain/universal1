// Equipment catalog - table + row shape + normalize + validation (pure, unit-tested). The analog of the person catalog for MACHINES and tools that are
// booked by the hour on a Time line of a task (task_line_table.rowJSON.taskResourceKind = 'equipment').
//   SQL: public."equipmentTable" (kit8/sql/start/start1_sql_structure.sql, PART 17)
//   rowGUID · rowOwnerGUID = EQUIPMENT_CATALOG_OWNER · rowParentGUID = 'empty' · orderInList · rowJSON = EquipmentRowJSON · created_at / updated_at
// Like a person, an equipment has its OWN Properties (what it IS: Engine power 110 kW) and Variants (what it can be BOOKED AS: Heavy, With operator) on the
// shared descriptor tables - the type (equipmentTypeTable) decides the descriptor sets (equipmentTypeModel.ts). The cost of an hour comes from the
// rate of the resource role of the line (rolePriceTable): an equipment has no rates and no contract of its own.

/** Supabase table name (SQL: equipmentTable). */
export const equipmentTable = 'equipmentTable';
/** SystemMetaData / redux entity key (reusableCrudSlice + reusableRootSaga). */
export const EQUIPMENT_ENTITY = 'equipmentReusable';
/** rowOwnerGUID of every catalog row. */
export const EQUIPMENT_CATALOG_OWNER = 'equipmentCatalog';
export const EQUIPMENT_ROUTES = { dashboard: '/catalog/equipment/dashboard' } as const;
/** readData payload of the catalog. */
export const EQUIPMENT_READ_PARAMS = { paginationSize: 1000, originationCurrentPage: 0 };

export const EQUIPMENT_OWNERSHIPS = [
  { value: 'own', label: 'Own' },
  { value: 'rented', label: 'Rented' },
  { value: 'leased', label: 'Leased' },
] as const;
export type EquipmentOwnership = typeof EQUIPMENT_OWNERSHIPS[number]['value'];

export interface EquipmentRowJSON {
  /** the display title ("Excavator CAT 320"); auto-filled from manufacturer + model when blank */
  equipmentTitle: string;
  /** inventory number; unique when set */
  equipmentCode?: string;
  /** equipmentTypeTable.rowGUID: decides the descriptor sets (Property / Variant) of this equipment */
  equipmentType?: string | null;
  equipmentOwnership: EquipmentOwnership;
  equipmentManufacturer?: string;
  equipmentModel?: string;
  equipmentSerialNumber?: string;
  /** false = not offered on new lines; the lines that have it keep it */
  isActive: boolean;
  /** managementCalendarTable.rowGUID of a RESOURCE calendar: its hours are the capacity of the equipment (empty = the Standard work week) */
  resourceCalendar?: string | null;
}

export interface EquipmentRow {
  rowGUID: string;
  rowOwnerGUID: string;
  rowParentGUID: string;
  orderInList: number;
  rowJSON: EquipmentRowJSON;
  created_at?: string;
  updated_at?: string;
}

export const emptyEquipment = (): EquipmentRowJSON => ({
  equipmentTitle: '',
  equipmentCode: '',
  equipmentType: null,
  equipmentOwnership: 'own',
  equipmentManufacturer: '',
  equipmentModel: '',
  equipmentSerialNumber: '',
  isActive: true,
});

export const equipmentExample: EquipmentRowJSON = {
  equipmentTitle: 'Excavator CAT 320',
  equipmentCode: 'EQ-001',
  equipmentType: 'equipmentTypeHeavy',
  equipmentOwnership: 'own',
  equipmentManufacturer: 'Caterpillar',
  equipmentModel: '320',
  equipmentSerialNumber: '',
  isActive: true,
};

const isSet = (g: unknown): g is string => typeof g === 'string' && g !== '' && g !== 'empty';
const str = (v: unknown) => String(v ?? '').trim();

/** "Manufacturer Model" of an equipment row ('' = nothing to build a title from) */
export const equipmentAutoTitle = (j: Partial<EquipmentRowJSON> | undefined | null): string => [str(j?.equipmentManufacturer), str(j?.equipmentModel)].filter(Boolean).join(' ');

/** the name shown for an equipment row: its title, else manufacturer + model, else its code */
export const equipmentName = (row: { rowJSON?: Partial<EquipmentRowJSON> } | undefined | null): string => {
  const j = row?.rowJSON;
  return str(j?.equipmentTitle) || equipmentAutoTitle(j) || str(j?.equipmentCode);
};

/** Form values -> stored shape (trimmed strings, auto title when blank, a known ownership). */
export function normalizeEquipment(v: Partial<EquipmentRowJSON>): EquipmentRowJSON {
  const ownership = EQUIPMENT_OWNERSHIPS.some((o) => o.value === v.equipmentOwnership) ? (v.equipmentOwnership as EquipmentOwnership) : 'own';
  return {
    equipmentTitle: str(v.equipmentTitle) || equipmentAutoTitle(v),
    equipmentCode: str(v.equipmentCode),
    equipmentType: isSet(v.equipmentType) ? v.equipmentType : null,
    equipmentOwnership: ownership,
    equipmentManufacturer: str(v.equipmentManufacturer),
    equipmentModel: str(v.equipmentModel),
    equipmentSerialNumber: str(v.equipmentSerialNumber),
    isActive: v.isActive !== false,
    ...(isSet(v.resourceCalendar) ? { resourceCalendar: v.resourceCalendar } : {}),
  };
}

export type EquipmentErrors = { [K in keyof EquipmentRowJSON]?: string };

/** Validate an equipment: a title (or manufacturer + model), a unique inventory number. */
export function validateEquipment(v: EquipmentRowJSON, rows: Pick<EquipmentRow, 'rowGUID' | 'rowJSON'>[] = [], rowGUID?: string | null): EquipmentErrors {
  const e: EquipmentErrors = {};
  if (!str(v.equipmentTitle) && !equipmentAutoTitle(v)) e.equipmentTitle = 'Title is required.';
  const code = str(v.equipmentCode).toLowerCase();
  if (code && rows.some((r) => r.rowGUID !== rowGUID && str(r.rowJSON?.equipmentCode).toLowerCase() === code)) e.equipmentCode = 'This inventory number is already used.';
  return e;
}

/**
 * The derived fields of an equipment row after a cell changed (the table's computeRowJSON): the display title (manufacturer + model) when it is empty.
 * null = nothing to change.
 */
export function computeEquipmentRowJSON(json: Record<string, any>): Record<string, any> | null {
  const patch: Record<string, any> = {};
  if (!str(json.equipmentTitle)) {
    const auto = equipmentAutoTitle(json);
    if (auto) patch.equipmentTitle = auto;
  }
  return Object.keys(patch).length ? patch : null;
}
