// Equipment dashboard - one ReusableTable configuration per equipment table: columns (what is shown, where it is stored), scope filters above the
// table (master -> detail: the values of ONE equipment ...) and row commands. The twin of person/dashboard/personDashboardTables.tsx;
// the descriptor tables (Descriptors, Values) are the product configuration itself, the others are written for machines.
import type { VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { DESCRIPTION_MODES, MODE_PROPERTY, MODE_VARIANT, todayISO } from '../../product/productModel';
import type { ProductTableKey } from '../../product/productModel';
import { propertyLinesOfProduct, variantLinesOfOwner } from '../../product/crud/productCatalogTools';
import { buildDashboardTables, count, rowNo } from '../../product/dashboard/productDashboardTables';
import type { DashboardTableConfig } from '../../product/dashboard/productDashboardTables';
import DescriptorValueCell from '../../product/dashboard/DescriptorValueCell';
import type { ProductLabels } from '../../product/crud/productLabels';
import { byGUID, rowTitle } from '../../product/crud/productCatalogTools';
import { EQUIPMENT_VARIANT_MODES, equipmentAsProductData, EquipmentCatalogData } from '../equipmentTypeModel';
import { EQUIPMENT_OWNERSHIPS } from '../equipmentModel';
import type { EquipmentTableKey } from '../equipmentValidation';
import { EQUIPMENT_TABLE_KEYS } from './equipmentDashboardModel';

export type { ScopeFilterDef } from '../../product/dashboard/productDashboardTables';
export { matchesScopeFilters } from '../../product/dashboard/productDashboardTables';
export { newRowFromRoleFilters as newRowFromEquipmentFilters } from '../../resourcerole/dashboard/resourceRoleDashboardTables';
export { computeEquipmentRowJSON } from '../equipmentModel';

export interface EquipmentTableConfig extends Omit<DashboardTableConfig, 'key'> {
  key: EquipmentTableKey;
}

export interface EquipmentTableContext {
  /** open another table filtered by this row; `fromRowGUID` = the row the user comes from */
  openTable: (key: EquipmentTableKey, filters: Record<string, string>, fromRowGUID?: string) => void;
  today?: string;
  /** the "Business unit" column (rowJSON.businessUnitAssigned, kit8/catalog/business_unit): the default unit of a line that books this equipment */
  businessUnitColumn?: VisualColumn;
}

/** a descriptor meant for equipment types (rule R11) */
export const genusIsForEquipment = (genus: { rowJSON?: Record<string, any> } | undefined) => {
  const kinds: string[] = Array.isArray(genus?.rowJSON?.targetKinds) ? genus!.rowJSON!.targetKinds : [];
  return !kinds.length || kinds.includes('equipmentType');
};

export function buildEquipmentTables(data: EquipmentCatalogData, L: ProductLabels, ctx: EquipmentTableContext): Record<EquipmentTableKey, EquipmentTableConfig> {
  const O = L.options;
  const adapted = equipmentAsProductData(data);
  const P = buildDashboardTables(adapted, L, {
    today: ctx.today ?? todayISO(), assignBarcode: () => {},
    openTable: (key: ProductTableKey, filters, from) => { if ((EQUIPMENT_TABLE_KEYS as string[]).includes(key)) ctx.openTable(key as EquipmentTableKey, filters, from); },
  });
  const shared = (key: ProductTableKey, group: string): EquipmentTableConfig => ({ ...P[key], key: key as EquipmentTableKey, group });

  const genusById = byGUID(data.descriptorGenus);
  const destById = byGUID(data.descriptorDestination);
  const planById = byGUID(data.descriptorPlan);
  const equipmentById = byGUID(adapted.product);
  const variantById = byGUID(data.variant);
  const countBy = (rows: { rowOwnerGUID: string; rowParentGUID: string }[], col: 'rowOwnerGUID' | 'rowParentGUID') => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r[col], (m.get(r[col]) ?? 0) + 1);
    return (g: string) => m.get(g) ?? 0;
  };
  const equipmentPerType = (g: string) => data.equipment.filter((e) => e.rowJSON?.equipmentType === g).length;
  const linesPerSet = countBy(data.descriptorPlan, 'rowOwnerGUID');
  const propsPerEquipment = countBy(data.propertyValue, 'rowOwnerGUID');
  const variantsPerEquipment = countBy(data.variant, 'rowOwnerGUID');
  const vvSummary = (variantGUID: string) => data.variantValue.filter((x) => x.rowOwnerGUID === variantGUID)
    .map((x) => ({ x, sort: Number(planById.get(x.rowParentGUID)?.rowJSON?.sort ?? 999) })).sort((a, b) => a.sort - b.sort)
    .map(({ x }) => L.valueText(x)).filter(Boolean).join(' · ');

  const equipmentColumn = (): VisualColumn => ({ key: 'equipment', title: 'Equipment', type: 'select', target: 'rowOwnerGUID', options: O.products, allowEmpty: false, width: 220, placeholder: 'Select equipment…' });
  /** the descriptors meant for equipment types (a new descriptor lists 'equipmentType' in its "For" column) */
  const equipmentGenus = O.genus.filter((g) => genusIsForEquipment(genusById.get(g.value)));

  const tables: Record<EquipmentTableKey, EquipmentTableConfig> = {
    // ───────────── Catalog ─────────────
    equipment: {
      key: 'equipment', title: 'Equipment', icon: 'construction', group: 'Catalog',
      filters: [{ key: 'type', label: 'Equipment type', target: 'equipmentType', options: O.types }],
      columns: [
        rowNo,
        { key: 'title', title: 'Title', type: 'text', field: 'equipmentTitle', width: 220, placeholder: 'Manufacturer + model when empty' },
        { key: 'code', title: 'Inventory no.', type: 'text', field: 'equipmentCode', width: 130 },
        // the type decides the descriptor sets
        { key: 'type', title: 'Equipment type', type: 'select', field: 'equipmentType', options: O.types, allowEmpty: false, width: 160, placeholder: 'Select type…' },
        { key: 'ownership', title: 'Ownership', type: 'select', field: 'equipmentOwnership', options: EQUIPMENT_OWNERSHIPS.map((o) => ({ value: o.value, label: o.label })), allowEmpty: false, width: 110 },
        { key: 'manufacturer', title: 'Manufacturer', type: 'text', field: 'equipmentManufacturer', width: 150 },
        { key: 'model', title: 'Model', type: 'text', field: 'equipmentModel', width: 130 },
        { key: 'serial', title: 'Serial no.', type: 'text', field: 'equipmentSerialNumber', width: 140 },
        ...(ctx.businessUnitColumn ? [ctx.businessUnitColumn] : []),
        { key: 'isActive', title: 'Active', type: 'boolean', width: 70 },
        count('properties', 'Properties', (r) => propsPerEquipment(r.rowGUID)),
        count('variants', 'Variants', (r) => variantsPerEquipment(r.rowGUID)),
      ],
      extraMenuItems: (row, close) => [
        { testID: `equipment-open-properties-${row.rowGUID}`, label: 'Properties', icon: 'tune', onPress: () => { close(); ctx.openTable('propertyValue', { equipment: row.rowGUID }, row.rowGUID); } },
        { testID: `equipment-open-variants-${row.rowGUID}`, label: 'Variants', icon: 'style', onPress: () => { close(); ctx.openTable('variant', { owner: row.rowGUID }, row.rowGUID); } },
      ],
    },
    equipmentType: {
      key: 'equipmentType', title: 'Equipment types', icon: 'category', group: 'Catalog', filters: [],
      columns: [
        rowNo,
        { key: 'title', title: 'Title', type: 'text', width: 170 },
        { key: 'description', title: 'Description', type: 'text', width: 340 },
        { key: 'variantMode', title: 'Variants', type: 'select', options: EQUIPMENT_VARIANT_MODES, allowEmpty: false, width: 140 },
        { key: 'propertySet', title: 'Property set', type: 'select', width: 220,
          options: (row) => O.destinations.filter((d) => destById.get(d.value)?.rowOwnerGUID === row.rowGUID && destById.get(d.value)?.rowParentGUID === MODE_PROPERTY) },
        { key: 'variantSet', title: 'Variant set', type: 'select', width: 220,
          options: (row) => O.destinations.filter((d) => destById.get(d.value)?.rowOwnerGUID === row.rowGUID && destById.get(d.value)?.rowParentGUID === MODE_VARIANT) },
        { key: 'variantTitleTemplate', title: 'Variant title template', type: 'text', width: 240, placeholder: '{equipmentClass}, {hireMode}' },
        { key: 'uniqueVariants', title: 'Unique', type: 'boolean', width: 70 },
        { key: 'isActive', title: 'Active', type: 'boolean', width: 65 },
        count('equipment', 'Equipment', (r) => equipmentPerType(r.rowGUID)),
      ],
      extraMenuItems: (row, close) => [
        { testID: `equipmenttype-open-equipment-${row.rowGUID}`, label: 'Equipment of this type', icon: 'construction', onPress: () => { close(); ctx.openTable('equipment', { type: row.rowGUID }, row.rowGUID); } },
        { testID: `equipmenttype-open-sets-${row.rowGUID}`, label: 'Descriptor sets', icon: 'view_list', onPress: () => { close(); ctx.openTable('descriptorDestination', { type: row.rowGUID }, row.rowGUID); } },
      ],
    },
    // ───────────── Descriptors ─────────────
    descriptorGenus: {
      ...shared('descriptorGenus', 'Descriptors'),
      columns: [
        ...P.descriptorGenus.columns,
        // which role descriptor an equipment's descriptor answers (Engine power, kW answers Min. engine power, kW)
        { key: 'satisfies', title: 'Satisfies (role descriptor)', type: 'select', options: O.genus, width: 200, placeholder: 'Itself' },
        { key: 'matchRule', title: 'Compared', type: 'select', width: 120, placeholder: 'Default',
          options: [{ value: 'atLeast', label: 'At least' }, { value: 'equals', label: 'Equals' }, { value: 'includes', label: 'Includes' }] },
      ],
    },
    descriptorValue: shared('descriptorValue', 'Descriptors'),
    descriptorDestination: {
      key: 'descriptorDestination', title: 'Descriptor sets', icon: 'view_list', group: 'Descriptors',
      filters: [{ key: 'type', label: 'Equipment type', target: 'rowOwnerGUID', options: O.types }],
      columns: [
        rowNo,
        { key: 'type', title: 'Equipment type', type: 'select', target: 'rowOwnerGUID', options: O.types, allowEmpty: false, width: 170, placeholder: 'Select equipment type…' },
        { key: 'mode', title: 'Mode', type: 'select', target: 'rowParentGUID', options: DESCRIPTION_MODES, allowEmpty: false, width: 120,
          validate: (v, row) => (data.descriptorDestination.some((d) => d.rowGUID !== row.rowGUID && d.rowOwnerGUID === row.rowOwnerGUID && d.rowParentGUID === v) ? 'This equipment type already has a set of that mode (rule R2)' : null) },
        { key: 'title', title: 'Title', type: 'text', width: 240 },
        count('lines', 'Lines', (r) => linesPerSet(r.rowGUID)),
      ],
      extraMenuItems: (row, close) => [
        { testID: `set-open-lines-${row.rowGUID}`, label: 'Plan lines', icon: 'checklist', onPress: () => { close(); ctx.openTable('descriptorPlan', { set: row.rowGUID }, row.rowGUID); } },
      ],
    },
    descriptorPlan: {
      key: 'descriptorPlan', title: 'Plan lines', icon: 'checklist', group: 'Descriptors',
      filters: [{ key: 'set', label: 'Set', target: 'rowOwnerGUID', options: O.destinations }],
      columns: [
        rowNo,
        { key: 'set', title: 'Set', type: 'select', target: 'rowOwnerGUID', options: O.destinations, allowEmpty: false, width: 230 },
        { key: 'genus', title: 'Descriptor', type: 'select', target: 'rowParentGUID', allowEmpty: false, width: 180,
          // only descriptors allowed for the set's mode and meant for equipment types (rules R2, R11)
          options: (row) => equipmentGenus.filter((g) => {
            const modes: string[] = genusById.get(g.value)?.rowJSON?.allowedDescriptionModes ?? [];
            const mode = destById.get(row.rowOwnerGUID ?? '')?.rowParentGUID;
            return !mode || !modes.length || modes.includes(mode);
          }),
          // rule R3: a descriptor once per equipment type (over both sets)
          validate: (v, row) => {
            const type = destById.get(row.rowOwnerGUID ?? '')?.rowOwnerGUID;
            const clash = data.descriptorPlan.find((p) => p.rowGUID !== row.rowGUID && p.rowParentGUID === v && destById.get(p.rowOwnerGUID)?.rowOwnerGUID === type);
            return clash ? `${L.title('descriptorGenus', v)} is already in ${L.title('descriptorDestination', clash.rowOwnerGUID)} (rule R3)` : null;
          } },
        { key: 'required', title: 'Required', type: 'boolean', width: 85 },
        { key: 'sort', title: 'Sort', type: 'integer', width: 80, stepper: false, total: false },
        { key: 'inVariantTitle', title: 'In variant title', type: 'boolean', width: 115 },
        { key: 'showInCard', title: 'On card', type: 'boolean', width: 80 },
      ],
    },
    // ───────────── Equipment data ─────────────
    propertyValue: {
      key: 'propertyValue', title: 'Properties', icon: 'tune', group: 'Equipment data',
      filters: [{ key: 'equipment', label: 'Equipment', target: 'rowOwnerGUID', options: O.products }],
      columns: [
        rowNo,
        equipmentColumn(),
        { key: 'plan', title: 'Property', type: 'select', target: 'rowParentGUID', allowEmpty: false, width: 190, placeholder: 'Select property…',
          // the property lines of the equipment's type (rule R4)
          options: (row) => propertyLinesOfProduct(adapted, equipmentById.get(row.rowOwnerGUID ?? '')).map((p) => ({ value: p.rowGUID, label: L.title('descriptorGenus', p.rowParentGUID), hint: [p.rowJSON?.required ? 'required' : '', genusById.get(p.rowParentGUID)?.rowJSON?.multiple ? 'several' : ''].filter(Boolean).join(', ') || undefined })) },
        { key: 'value', title: 'Value', type: 'custom', width: 220,
          renderCell: (row, _i, patch) => {
            const plan = planById.get(row.rowParentGUID ?? '');
            const g = plan ? genusById.get(plan.rowParentGUID) : undefined;
            return (
              <DescriptorValueCell testID={`property-value-${row.rowGUID}`} valueType={g ? (g.rowJSON?.valueType ?? 'ref') : null} unit={g?.rowJSON?.unit} title={rowTitle(g) || 'Value'}
                options={O.valuesOf(g?.rowGUID)} descriptorValueGUID={row.rowJSON?.descriptorValueGUID} value={row.rowJSON?.value} onPatch={patch} />
            );
          },
          searchText: (row) => L.valueText(row as any) },
      ],
    },
    variant: {
      key: 'variant', title: 'Variants', icon: 'style', group: 'Equipment data',
      filters: [{ key: 'owner', label: 'Equipment', target: 'rowOwnerGUID', options: O.variantOwners }],
      columns: [
        rowNo,
        { key: 'owner', title: 'Equipment', type: 'select', target: 'rowOwnerGUID', options: O.variantOwners, allowEmpty: false, width: 230 },
        { key: 'title', title: 'Title', type: 'text', width: 200 },
        count('values', 'Values', (r) => vvSummary(r.rowGUID) || '—', 200),
        { key: 'descriptorKey', title: 'Descriptor key', type: 'text', width: 220, editable: false },
        { key: 'isActive', title: 'Active', type: 'boolean', width: 70 },
      ],
      extraMenuItems: (row, close) => [
        { testID: `variant-open-values-${row.rowGUID}`, label: 'Variant values', icon: 'tune', onPress: () => { close(); ctx.openTable('variantValue', { variant: row.rowGUID }, row.rowGUID); } },
      ],
    },
    variantValue: {
      key: 'variantValue', title: 'Variant values', icon: 'tune', group: 'Equipment data',
      filters: [{ key: 'variant', label: 'Variant', target: 'rowOwnerGUID', options: O.variants }],
      columns: [
        rowNo,
        { key: 'variant', title: 'Variant', type: 'select', target: 'rowOwnerGUID', options: O.variants, allowEmpty: false, width: 260 },
        { key: 'plan', title: 'Descriptor', type: 'select', target: 'rowParentGUID', allowEmpty: false, width: 170, placeholder: 'Select descriptor…',
          options: (row) => variantLinesOfOwner(adapted, variantById.get(row.rowOwnerGUID ?? '')?.rowOwnerGUID).map((p) => ({ value: p.rowGUID, label: L.title('descriptorGenus', p.rowParentGUID), hint: p.rowJSON?.required ? 'required' : 'optional' })),
          validate: (v, row) => (data.variantValue.some((x) => x.rowGUID !== row.rowGUID && x.rowOwnerGUID === row.rowOwnerGUID && x.rowParentGUID === v) ? 'This variant already has a value of that descriptor (rule R8)' : null) },
        { key: 'value', title: 'Value', type: 'select', field: 'descriptorValueGUID', width: 180, placeholder: 'Select value…',
          options: (row) => O.valuesOf(planById.get(row.rowParentGUID ?? '')?.rowParentGUID) },
      ],
    },
  };
  return tables;
}
