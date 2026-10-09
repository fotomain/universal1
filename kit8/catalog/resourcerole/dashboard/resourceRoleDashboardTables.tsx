// Resource role dashboard - one ReusableTable configuration per role table: columns (what is shown, where it is stored), scope
// filters above the table (master -> detail: the values of ONE role ...) and table commands. The twin of
// product/dashboard/productDashboardTables.tsx; the descriptor tables (Descriptors, Values, Modes) are the product configuration
// itself, the others are written for roles (role type, role, rate).
import type { PMMenuItemProps } from '../../../pm/inner/menu/PMMenuItem';
import type { ReusableTableRow, VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { DESCRIPTION_MODES, MODE_PROPERTY, MODE_VARIANT, PRICE_APPLIES_TO, todayISO, VARIANT_MODES } from '../../product/productModel';
import type { ProductTableKey } from '../../product/productModel';
import { currentPrice, propertyLinesOfProduct, variantLinesOfOwner } from '../../product/crud/productCatalogTools';
import { buildDashboardTables, count, rowNo } from '../../product/dashboard/productDashboardTables';
import type { ScopeFilterDef } from '../../product/dashboard/productDashboardTables';
import DescriptorValueCell from '../../product/dashboard/DescriptorValueCell';
import { ResourceRoleTableKey } from '../resourceRoleModel';
import {
  byGUID, currentRate, isSet, priceTypeForRoles, ResourceRoleCatalogData, roleAsProductData, roleKeyOfSlot, rowTitle, variantOwnerOfRole, variantsOfRole, vatPercentOfRole,
} from '../crud/resourceRoleCatalogTools';
import type { ResourceRoleLabels } from '../crud/resourceRoleLabels';

export type { ScopeFilterDef } from '../../product/dashboard/productDashboardTables';
export { matchesScopeFilters } from '../../product/dashboard/productDashboardTables';

export interface ResourceRoleTableConfig {
  key: ResourceRoleTableKey;
  title: string;
  icon: string;
  group: string;
  columns: VisualColumn[];
  filters: ScopeFilterDef[];
  /** false: a fixed list (no add / sql_for_delete) */
  crud?: boolean;
  extraMenuItems?: (row: ReusableTableRow, close: () => void) => PMMenuItemProps[];
}

export const ROLE_DASHBOARD_GROUPS = ['Catalog', 'Descriptors', 'Role data', 'Cost'] as const;

export interface ResourceRoleTableContext {
  /** open another table filtered by this row; `fromRowGUID` = the row the user comes from (the table shows a back arrow to it) */
  openTable: (key: ResourceRoleTableKey, filters: Record<string, string>, fromRowGUID?: string) => void;
  /** today 'YYYY-MM-DD' (rates valid now) */
  today?: string;
}

/** the order of the tables in the menu */
export const ROLE_DASHBOARD_TABLE_ORDER: ResourceRoleTableKey[] = [
  'resourceRole', 'resourceRoleType', 'resourceRoleFolder', 'valueAddedTax', 'measureUnit',
  'descriptorGenus', 'descriptorValue', 'descriptorDestination', 'descriptorPlan', 'descriptorMode',
  'propertyValue', 'variant', 'variantValue',
  'rolePrice', 'priceType',
];

export function buildResourceRoleTables(data: ResourceRoleCatalogData, L: ResourceRoleLabels, ctx: ResourceRoleTableContext): Record<ResourceRoleTableKey, ResourceRoleTableConfig> {
  const O = L.options;
  const today = ctx.today ?? todayISO();
  const adapted = roleAsProductData(data);
  // the descriptor tables that read the same for both sides: the product configuration, with its row menu pointing at role tables
  const P = buildDashboardTables(adapted, L, {
    today, assignBarcode: () => {},
    openTable: (key: ProductTableKey, filters, from) => ctx.openTable(roleKeyOfSlot(key), filters, from),
  });
  const shared = (key: ProductTableKey, group: string): ResourceRoleTableConfig => ({ ...P[key], key: roleKeyOfSlot(key), group });

  const genusById = byGUID(data.descriptorGenus);
  const destById = byGUID(data.descriptorDestination);
  const planById = byGUID(data.descriptorPlan);
  const typeById = byGUID(data.resourceRoleType);
  const roleById = byGUID(data.resourceRole);
  const variantById = byGUID(data.variant);
  const priceTypeById = byGUID(data.priceType);
  const countBy = (rows: { rowOwnerGUID: string; rowParentGUID: string }[], col: 'rowOwnerGUID' | 'rowParentGUID') => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r[col], (m.get(r[col]) ?? 0) + 1);
    return (g: string) => m.get(g) ?? 0;
  };
  const rolesPerType = countBy(data.resourceRole, 'rowOwnerGUID');
  const rolesPerFolder = countBy(data.resourceRole, 'rowParentGUID');
  const linesPerSet = countBy(data.descriptorPlan, 'rowOwnerGUID');
  const ratesPerVariant = countBy(data.rolePrice, 'rowParentGUID');
  const bill = data.priceType.find((p) => p.rowGUID === 'pt_bill') ?? data.priceType.find((p) => priceTypeForRoles(p));
  const fmtRate = (n: any, cur?: string) => (typeof n === 'number' ? `${n.toFixed(2)} ${cur ?? ''}`.trim() : '');
  const folderDescendants = (guid: string) => {
    const out = new Set<string>([guid]);
    let grew = true;
    while (grew) { grew = false; for (const f of data.resourceRoleFolder) if (!out.has(f.rowGUID) && out.has(f.rowParentGUID)) { out.add(f.rowGUID); grew = true; } }
    return out;
  };
  const vvSummary = (variantGUID: string) => data.variantValue.filter((x) => x.rowOwnerGUID === variantGUID)
    .map((x) => ({ x, sort: Number(planById.get(x.rowParentGUID)?.rowJSON?.sort ?? 999) })).sort((a, b) => a.sort - b.sort)
    .map(({ x }) => L.valueText(x)).filter(Boolean).join(' · ');

  const typeColumn = (): VisualColumn => ({ key: 'type', title: 'Role type', type: 'select', target: 'rowOwnerGUID', options: O.types, allowEmpty: false, width: 170, placeholder: 'Select role type…' });
  const roleColumn = (key = 'role'): VisualColumn => ({ key, title: 'Role', type: 'select', target: 'rowOwnerGUID', options: O.roles, allowEmpty: false, width: 220, placeholder: 'Select role…' });

  const tables: Record<ResourceRoleTableKey, ResourceRoleTableConfig> = {
    // ───────────── Catalog ─────────────
    resourceRole: {
      key: 'resourceRole', title: 'Roles', icon: 'engineering', group: 'Catalog',
      filters: [
        { key: 'type', label: 'Role type', target: 'rowOwnerGUID', options: O.types },
        { key: 'folder', label: 'Folder', target: 'rowParentGUID', options: O.folders },
      ],
      columns: [
        rowNo,
        { key: 'title', title: 'Title', type: 'text', width: 240, placeholder: 'Role title' },
        typeColumn(),
        { key: 'folder', title: 'Folder', type: 'select', target: 'rowParentGUID', options: O.folders, width: 200 },
        { key: 'roleVATRate', title: 'VAT rate', type: 'select', options: O.vatRates, width: 110, placeholder: 'Type default' },
        // what applies: its own rate, else the role type's default, else 0 % when both are empty
        count('vatNow', 'VAT now', (r) => `${vatPercentOfRole(data, roleById.get(r.rowGUID) ?? (r as any))} %`, 90),
        { key: 'description', title: 'Description', type: 'text', width: 320 },
        { key: 'isActive', title: 'Active', type: 'boolean', width: 70 },
        count('variants', 'Variants', (r) => variantsOfRole(data, roleById.get(r.rowGUID)).length),
        count('rate', bill ? `${rowTitle(bill)} now` : 'Cost now', (r) => {
          if (!bill) return '';
          const p = currentRate(data.rolePrice, r as any, typeById.get(r.rowOwnerGUID ?? ''), null, bill.rowGUID, today);
          return p ? `${fmtRate(p.rowJSON?.price, bill.rowJSON?.currency)}${isSet(p.rowJSON?.measureUnit) ? ` / ${L.title('measureUnit', p.rowJSON.measureUnit)}` : ''}` : '—';
        }, 120),
      ],
      extraMenuItems: (row, close) => [
        { testID: `role-open-properties-${row.rowGUID}`, label: 'Property values', icon: 'tune', onPress: () => { close(); ctx.openTable('propertyValue', { role: row.rowGUID }, row.rowGUID); } },
        { testID: `role-open-rates-${row.rowGUID}`, label: 'Cost', icon: 'sell', onPress: () => { close(); ctx.openTable('rolePrice', { role: row.rowGUID }, row.rowGUID); } },
        ...(isSet(variantOwnerOfRole(data, roleById.get(row.rowGUID)))
          ? [{ testID: `role-open-variants-${row.rowGUID}`, label: 'Variants', icon: 'style', onPress: () => { close(); ctx.openTable('variant', { owner: variantOwnerOfRole(data, roleById.get(row.rowGUID))! }, row.rowGUID); } }]
          : []),
      ],
    },
    resourceRoleType: {
      key: 'resourceRoleType', title: 'Role types', icon: 'category', group: 'Catalog', filters: [],
      columns: [
        rowNo,
        { key: 'title', title: 'Title', type: 'text', width: 170 },
        { key: 'description', title: 'Description', type: 'text', width: 300 },
        { key: 'managementGenus', title: 'Management genus', type: 'select', options: O.managementGenus, width: 170, placeholder: 'Choose genus…' },
        { key: 'baseUnit', title: 'Base unit', type: 'select', options: O.units, width: 110 },
        { key: 'roleVATDefaultRate', title: 'Default VAT rate', type: 'select', options: O.vatRates, width: 130 },
        { key: 'variantMode', title: 'Variants', type: 'select', options: VARIANT_MODES, allowEmpty: false, width: 150 },
        { key: 'propertySet', title: 'Property set', type: 'select', width: 220,
          options: (row) => O.destinations.filter((d) => destById.get(d.value)?.rowOwnerGUID === row.rowGUID && destById.get(d.value)?.rowParentGUID === MODE_PROPERTY) },
        { key: 'variantSet', title: 'Variant set', type: 'select', width: 220,
          options: (row) => O.destinations.filter((d) => destById.get(d.value)?.rowOwnerGUID === row.rowGUID && destById.get(d.value)?.rowParentGUID === MODE_VARIANT) },
        { key: 'variantSharedTypeGUID', title: 'Shares variants of', type: 'select', width: 160,
          options: (row) => O.types.filter((t) => t.value !== row.rowGUID && typeById.get(t.value)?.rowJSON?.variantMode !== 'sharedWithType') },
        { key: 'variantTitleTemplate', title: 'Variant title template', type: 'text', width: 240, placeholder: '{seniority}, {workLanguage}' },
        { key: 'uniqueVariants', title: 'Unique', type: 'boolean', width: 70 },
        { key: 'isActive', title: 'Active', type: 'boolean', width: 65 },
        count('roles', 'Roles', (r) => rolesPerType(r.rowGUID)),
      ],
      extraMenuItems: (row, close) => [
        { testID: `roletype-open-roles-${row.rowGUID}`, label: 'Roles of this type', icon: 'engineering', onPress: () => { close(); ctx.openTable('resourceRole', { type: row.rowGUID }, row.rowGUID); } },
        { testID: `roletype-open-sets-${row.rowGUID}`, label: 'Descriptor sets', icon: 'view_list', onPress: () => { close(); ctx.openTable('descriptorDestination', { type: row.rowGUID }, row.rowGUID); } },
      ],
    },
    resourceRoleFolder: {
      key: 'resourceRoleFolder', title: 'Folders', icon: 'folder', group: 'Catalog', filters: [],
      columns: [
        rowNo,
        { key: 'title', title: 'Title', type: 'text', width: 200 },
        { key: 'parent', title: 'Parent folder', type: 'select', target: 'rowParentGUID', width: 240,
          options: (row) => { const no = folderDescendants(row.rowGUID); return O.folders.filter((f) => !no.has(f.value)); } },
        count('path', 'Path', (r) => L.folderPath(r.rowGUID), 260),
        count('roles', 'Roles', (r) => rolesPerFolder(r.rowGUID)),
      ],
    },
    valueAddedTax: {
      ...shared('valueAddedTax', 'Catalog'),
      columns: [rowNo, { key: 'vatTableTitle', title: 'Title', type: 'text', width: 160 },
        { key: 'vatTablePercent', title: 'Percent', type: 'number', width: 110, min: 0, total: false },
        count('used', 'Role types / roles', (r) => data.resourceRoleType.filter((t) => t.rowJSON?.roleVATDefaultRate === r.rowGUID).length + data.resourceRole.filter((p) => p.rowJSON?.roleVATRate === r.rowGUID).length)],
    },
    measureUnit: {
      ...shared('measureUnit', 'Catalog'),
      columns: [rowNo, { key: 'title', title: 'Title', type: 'text', width: 160 }, { key: 'code', title: 'Code (UN/ECE, OKEI)', type: 'text', width: 160 },
        count('used', 'Role types / cost', (r) => data.resourceRoleType.filter((t) => t.rowJSON?.baseUnit === r.rowGUID).length + data.rolePrice.filter((p) => p.rowJSON?.measureUnit === r.rowGUID).length)],
    },
    // ───────────── Descriptors ─────────────
    descriptorGenus: shared('descriptorGenus', 'Descriptors'),
    descriptorValue: shared('descriptorValue', 'Descriptors'),
    descriptorMode: shared('descriptorMode', 'Descriptors'),
    descriptorDestination: {
      key: 'descriptorDestination', title: 'Descriptor sets', icon: 'view_list', group: 'Descriptors',
      filters: [{ key: 'type', label: 'Role type', target: 'rowOwnerGUID', options: O.types }],
      columns: [
        rowNo,
        typeColumn(),
        { key: 'mode', title: 'Mode', type: 'select', target: 'rowParentGUID', options: DESCRIPTION_MODES, allowEmpty: false, width: 120,
          validate: (v, row) => (data.descriptorDestination.some((d) => d.rowGUID !== row.rowGUID && d.rowOwnerGUID === row.rowOwnerGUID && d.rowParentGUID === v) ? 'This role type already has a set of that mode (rule R2)' : null) },
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
          // only descriptors allowed for the set's mode and meant for resource role types (rules R2, R11)
          options: (row) => O.roleGenus.filter((g) => {
            const modes: string[] = genusById.get(g.value)?.rowJSON?.allowedDescriptionModes ?? [];
            const mode = destById.get(row.rowOwnerGUID ?? '')?.rowParentGUID;
            return !mode || !modes.length || modes.includes(mode);
          }),
          // rule R3: a descriptor once per role type (over both sets)
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
    // ───────────── Role data ─────────────
    propertyValue: {
      key: 'propertyValue', title: 'Property values', icon: 'tune', group: 'Role data',
      filters: [{ key: 'role', label: 'Role', target: 'rowOwnerGUID', options: O.roles }],
      columns: [
        rowNo,
        roleColumn(),
        { key: 'plan', title: 'Property', type: 'select', target: 'rowParentGUID', allowEmpty: false, width: 190, placeholder: 'Select property…',
          // the property lines of the role's type (rule R4)
          options: (row) => propertyLinesOfProduct(adapted, roleById.get(row.rowOwnerGUID ?? '')).map((p) => ({ value: p.rowGUID, label: L.title('descriptorGenus', p.rowParentGUID), hint: p.rowJSON?.required ? 'required' : undefined })),
          validate: (v, row) => (data.propertyValue.some((x) => x.rowGUID !== row.rowGUID && x.rowOwnerGUID === row.rowOwnerGUID && x.rowParentGUID === v) ? 'This role already has a value of that property (rule R8)' : null) },
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
      key: 'variant', title: 'Variants', icon: 'style', group: 'Role data',
      filters: [{ key: 'owner', label: 'Owner', target: 'rowOwnerGUID', options: O.variantOwners }],
      columns: [
        rowNo,
        { key: 'owner', title: 'Owner (role type / role)', type: 'select', target: 'rowOwnerGUID', options: O.variantOwners, allowEmpty: false, width: 230 },
        { key: 'title', title: 'Title', type: 'text', width: 200 },
        count('values', 'Values', (r) => vvSummary(r.rowGUID) || '—', 200),
        { key: 'descriptorKey', title: 'Descriptor key', type: 'text', width: 200, editable: false },
        { key: 'isActive', title: 'Active', type: 'boolean', width: 70 },
        count('rates', 'Cost', (r) => ratesPerVariant(r.rowGUID)),
      ],
      extraMenuItems: (row, close) => [
        { testID: `variant-open-values-${row.rowGUID}`, label: 'Variant values', icon: 'tune', onPress: () => { close(); ctx.openTable('variantValue', { variant: row.rowGUID }, row.rowGUID); } },
      ],
    },
    variantValue: {
      key: 'variantValue', title: 'Variant values', icon: 'tune', group: 'Role data',
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
    // ───────────── Rates ─────────────
    rolePrice: {
      key: 'rolePrice', title: 'Cost', icon: 'sell', group: 'Cost',
      filters: [
        { key: 'role', label: 'Role', target: 'rowOwnerGUID', options: O.roles },
        { key: 'priceType', label: 'Price type', target: 'priceTypeGUID', options: O.rateTypes },
      ],
      columns: [
        rowNo,
        roleColumn(),
        { key: 'variant', title: 'Variant', type: 'select', target: 'rowParentGUID', width: 200, placeholder: 'All variants',
          // rule R7: only the variants of this role's type (empty = every variant)
          options: (row) => variantsOfRole(data, roleById.get(row.rowOwnerGUID ?? '')).map((v) => ({ value: v.rowGUID, label: rowTitle(v) })) },
        { key: 'priceType', title: 'Price type', type: 'select', field: 'priceTypeGUID', width: 190, allowEmpty: false,
          options: O.rateTypes },
        { key: 'price', title: 'Cost', type: 'number', width: 110, min: 0, stepper: false, total: false, align: 'right' },
        // the rate is the price of ONE unit of this measureUnit (1 hour), a unit of the units catalog - as in the product prices
        { key: 'measureUnit', title: 'Per 1 unit', type: 'select', options: O.units, allowEmpty: false, width: 110 },
        count('currency', 'Currency', (r) => priceTypeById.get(r.rowJSON?.priceTypeGUID)?.rowJSON?.currency ?? '', 80),
        { key: 'validFrom', title: 'Valid from', type: 'date', width: 120 },
        count('now', 'Valid now', (r) => {
          const pt = r.rowJSON?.priceTypeGUID;
          if (!isSet(pt)) return '';
          const cur = currentPrice(data.rolePrice, r.rowOwnerGUID ?? '', isSet(r.rowParentGUID) ? r.rowParentGUID : null, pt, today, r.rowJSON?.measureUnit);
          return cur?.rowGUID === r.rowGUID ? '✓ now' : String(r.rowJSON?.validFrom ?? '') > today ? 'future' : '';
        }, 90),
      ],
    },
    priceType: {
      key: 'priceType', title: 'Price types', icon: 'request_quote', group: 'Cost', filters: [],
      columns: [
        rowNo,
        { key: 'title', title: 'Title', type: 'text', width: 220 },
        { key: 'currency', title: 'Currency', type: 'text', width: 90, validate: (v) => (v && !/^[A-Z]{3}$/.test(String(v)) ? 'Currency: 3 capital letters (ISO 4217), e.g. EUR' : null) },
        { key: 'vatIncluded', title: 'VAT included', type: 'boolean', width: 105 },
        { key: 'appliesTo', title: 'Used for', type: 'multiSelect', options: PRICE_APPLIES_TO, width: 200 },
        count('rates', 'Cost', (r) => data.rolePrice.filter((p) => p.rowJSON?.priceTypeGUID === r.rowGUID).length),
      ],
    },
  };
  return tables;
}

/** owner / parent / rowJSON of a new row from the chosen scope filters; a plain catalog table gets its fixed owner */
export function newRowFromRoleFilters(filters: ScopeFilterDef[], values: Record<string, string | null | undefined>, catalogOwner: string | null) {
  const out: { rowOwnerGUID?: string; rowParentGUID?: string; rowJSON: Record<string, any> } = { rowJSON: {} };
  for (const f of filters) {
    const v = values[f.key];
    if (!isSet(v)) continue;
    if (f.target === 'rowOwnerGUID') out.rowOwnerGUID = v;
    else if (f.target === 'rowParentGUID') out.rowParentGUID = v;
    else out.rowJSON[f.target] = v;
  }
  if (catalogOwner && !out.rowOwnerGUID) out.rowOwnerGUID = catalogOwner;
  return out;
}
