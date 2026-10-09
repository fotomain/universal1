// Person dashboard - one ReusableTable configuration per person table: columns (what is shown, where it is stored), scope filters above the
// table (master -> detail: the values of ONE person ...) and row commands. The twin of resourcerole/dashboard/resourceRoleDashboardTables.tsx;
// the descriptor tables (Descriptors, Values) are the product configuration itself, the others are written for people.
import type { PMMenuItemProps } from '../../../pm/inner/menu/PMMenuItem';
import type { ReusableTableRow, VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { DESCRIPTION_MODES, MODE_PROPERTY, MODE_VARIANT, todayISO } from '../../product/productModel';
import type { ProductTableKey } from '../../product/productModel';
import { propertyLinesOfProduct, variantLinesOfOwner } from '../../product/crud/productCatalogTools';
import { buildDashboardTables, count, rowNo } from '../../product/dashboard/productDashboardTables';
import type { DashboardTableConfig, ScopeFilterDef } from '../../product/dashboard/productDashboardTables';
import DescriptorValueCell from '../../product/dashboard/DescriptorValueCell';
import type { ProductLabels } from '../../product/crud/productLabels';
import { byGUID, isSet, rowTitle } from '../../product/crud/productCatalogTools';
import { PERSON_TYPE, PERSON_VARIANT_MODES, personAsProductData, PersonCatalogData } from '../personTypeModel';
import type { PersonTableKey } from '../personValidation';
import { PERSON_TABLE_KEYS } from './personDashboardModel';

export type { ScopeFilterDef } from '../../product/dashboard/productDashboardTables';
export { matchesScopeFilters } from '../../product/dashboard/productDashboardTables';
export { newRowFromRoleFilters as newRowFromPersonFilters } from '../../resourcerole/dashboard/resourceRoleDashboardTables';

export interface PersonTableConfig extends Omit<DashboardTableConfig, 'key'> {
  key: PersonTableKey;
}

export interface PersonTableContext {
  /** open another table filtered by this row; `fromRowGUID` = the row the user comes from */
  openTable: (key: PersonTableKey, filters: Record<string, string>, fromRowGUID?: string) => void;
  /** open the person's own page (contracts, employee data) */
  openPerson: (personGUID: string) => void;
  today?: string;
}

/** a descriptor meant for person types (rule R11) */
export const genusIsForPerson = (genus: { rowJSON?: Record<string, any> } | undefined) => {
  const kinds: string[] = Array.isArray(genus?.rowJSON?.targetKinds) ? genus!.rowJSON!.targetKinds : [];
  return !kinds.length || kinds.includes('personType');
};

export function buildPersonTables(data: PersonCatalogData, L: ProductLabels, ctx: PersonTableContext): Record<PersonTableKey, PersonTableConfig> {
  const O = L.options;
  const adapted = personAsProductData(data);
  const P = buildDashboardTables(adapted, L, {
    today: ctx.today ?? todayISO(), assignBarcode: () => {},
    openTable: (key: ProductTableKey, filters, from) => { if ((PERSON_TABLE_KEYS as string[]).includes(key)) ctx.openTable(key as PersonTableKey, filters, from); },
  });
  const shared = (key: ProductTableKey, group: string): PersonTableConfig => ({ ...P[key], key: key as PersonTableKey, group });

  const genusById = byGUID(data.descriptorGenus);
  const destById = byGUID(data.descriptorDestination);
  const planById = byGUID(data.descriptorPlan);
  const personById = byGUID(adapted.product);
  const variantById = byGUID(data.variant);
  const countBy = (rows: { rowOwnerGUID: string; rowParentGUID: string }[], col: 'rowOwnerGUID' | 'rowParentGUID') => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r[col], (m.get(r[col]) ?? 0) + 1);
    return (g: string) => m.get(g) ?? 0;
  };
  const personsPerType = (g: string) => data.person.filter((p) => p.rowJSON?.personType === g).length;
  const linesPerSet = countBy(data.descriptorPlan, 'rowOwnerGUID');
  const propsPerPerson = countBy(data.propertyValue, 'rowOwnerGUID');
  const variantsPerPerson = countBy(data.variant, 'rowOwnerGUID');
  const contractsPerPerson = countBy(data.contract.filter((c) => c.rowParentGUID === 'person'), 'rowOwnerGUID');
  const vvSummary = (variantGUID: string) => data.variantValue.filter((x) => x.rowOwnerGUID === variantGUID)
    .map((x) => ({ x, sort: Number(planById.get(x.rowParentGUID)?.rowJSON?.sort ?? 999) })).sort((a, b) => a.sort - b.sort)
    .map(({ x }) => L.valueText(x)).filter(Boolean).join(' · ');

  const personColumn = (): VisualColumn => ({ key: 'person', title: 'Person', type: 'select', target: 'rowOwnerGUID', options: O.products, allowEmpty: false, width: 220, placeholder: 'Select person…' });
  /** the descriptors meant for person types (a new descriptor lists 'personType' in its "For" column) */
  const personGenus = O.genus.filter((g) => genusIsForPerson(genusById.get(g.value)));

  const tables: Record<PersonTableKey, PersonTableConfig> = {
    // ───────────── Catalog ─────────────
    person: {
      key: 'person', title: 'Persons', icon: 'badge', group: 'Catalog',
      filters: [{ key: 'type', label: 'Person type', target: 'personType', options: O.types }],
      columns: [
        rowNo,
        { key: 'first', title: 'First name', type: 'text', field: 'personFirstName', width: 150, placeholder: 'First name' },
        { key: 'last', title: 'Last name', type: 'text', field: 'personLastName', width: 150 },
        { key: 'title', title: 'Display title', type: 'text', field: 'personTitle', width: 180, placeholder: '"First Last" when empty' },
        // the type decides the descriptor sets; personIsEmployee follows it (computeRowJSON of the table)
        { key: 'type', title: 'Person type', type: 'select', field: 'personType', options: O.types, allowEmpty: false, width: 140, placeholder: 'Select type…' },
        { key: 'email', title: 'Email', type: 'text', field: 'personEmail', width: 220 },
        { key: 'phone', title: 'Phone', type: 'text', field: 'personPhone', width: 140 },
        { key: 'isActive', title: 'Active', type: 'boolean', width: 70 },
        count('properties', 'Properties', (r) => propsPerPerson(r.rowGUID)),
        count('variants', 'Variants', (r) => variantsPerPerson(r.rowGUID)),
        count('contracts', 'Contracts', (r) => contractsPerPerson(r.rowGUID)),
      ],
      extraMenuItems: (row, close) => [
        { testID: `person-open-properties-${row.rowGUID}`, label: 'Properties', icon: 'tune', onPress: () => { close(); ctx.openTable('propertyValue', { person: row.rowGUID }, row.rowGUID); } },
        { testID: `person-open-variants-${row.rowGUID}`, label: 'Variants', icon: 'style', onPress: () => { close(); ctx.openTable('variant', { owner: row.rowGUID }, row.rowGUID); } },
        { testID: `person-open-page-${row.rowGUID}`, label: 'Contracts and employee data', icon: 'description', onPress: () => { close(); ctx.openPerson(row.rowGUID); } },
      ],
    },
    personType: {
      key: 'personType', title: 'Person types', icon: 'category', group: 'Catalog', filters: [],
      columns: [
        rowNo,
        { key: 'title', title: 'Title', type: 'text', width: 170 },
        { key: 'description', title: 'Description', type: 'text', width: 340 },
        { key: 'variantMode', title: 'Variants', type: 'select', options: PERSON_VARIANT_MODES, allowEmpty: false, width: 130 },
        { key: 'propertySet', title: 'Property set', type: 'select', width: 220,
          options: (row) => O.destinations.filter((d) => destById.get(d.value)?.rowOwnerGUID === row.rowGUID && destById.get(d.value)?.rowParentGUID === MODE_PROPERTY) },
        { key: 'variantSet', title: 'Variant set', type: 'select', width: 220,
          options: (row) => O.destinations.filter((d) => destById.get(d.value)?.rowOwnerGUID === row.rowGUID && destById.get(d.value)?.rowParentGUID === MODE_VARIANT) },
        { key: 'variantTitleTemplate', title: 'Variant title template', type: 'text', width: 240, placeholder: '{seniority}, {workLanguage}' },
        { key: 'uniqueVariants', title: 'Unique', type: 'boolean', width: 70 },
        { key: 'isActive', title: 'Active', type: 'boolean', width: 65 },
        count('persons', 'Persons', (r) => personsPerType(r.rowGUID)),
      ],
      extraMenuItems: (row, close) => [
        { testID: `persontype-open-persons-${row.rowGUID}`, label: 'Persons of this type', icon: 'badge', onPress: () => { close(); ctx.openTable('person', { type: row.rowGUID }, row.rowGUID); } },
        { testID: `persontype-open-sets-${row.rowGUID}`, label: 'Descriptor sets', icon: 'view_list', onPress: () => { close(); ctx.openTable('descriptorDestination', { type: row.rowGUID }, row.rowGUID); } },
      ],
    },
    // ───────────── Descriptors ─────────────
    descriptorGenus: {
      ...shared('descriptorGenus', 'Descriptors'),
      columns: [
        ...P.descriptorGenus.columns,
        // person side: several values (certifications), and which role descriptor a person's descriptor answers
        { key: 'multiple', title: 'Several values', type: 'boolean', width: 110 },
        { key: 'satisfies', title: 'Satisfies (role descriptor)', type: 'select', options: O.genus, width: 200, placeholder: 'Itself' },
        { key: 'matchRule', title: 'Compared', type: 'select', width: 120, placeholder: 'Default',
          options: [{ value: 'atLeast', label: 'At least' }, { value: 'equals', label: 'Equals' }, { value: 'includes', label: 'Includes' }] },
      ],
    },
    descriptorValue: shared('descriptorValue', 'Descriptors'),
    descriptorDestination: {
      key: 'descriptorDestination', title: 'Descriptor sets', icon: 'view_list', group: 'Descriptors',
      filters: [{ key: 'type', label: 'Person type', target: 'rowOwnerGUID', options: O.types }],
      columns: [
        rowNo,
        { key: 'type', title: 'Person type', type: 'select', target: 'rowOwnerGUID', options: O.types, allowEmpty: false, width: 170, placeholder: 'Select person type…' },
        { key: 'mode', title: 'Mode', type: 'select', target: 'rowParentGUID', options: DESCRIPTION_MODES, allowEmpty: false, width: 120,
          validate: (v, row) => (data.descriptorDestination.some((d) => d.rowGUID !== row.rowGUID && d.rowOwnerGUID === row.rowOwnerGUID && d.rowParentGUID === v) ? 'This person type already has a set of that mode (rule R2)' : null) },
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
          // only descriptors allowed for the set's mode and meant for person types (rules R2, R11)
          options: (row) => personGenus.filter((g) => {
            const modes: string[] = genusById.get(g.value)?.rowJSON?.allowedDescriptionModes ?? [];
            const mode = destById.get(row.rowOwnerGUID ?? '')?.rowParentGUID;
            return !mode || !modes.length || modes.includes(mode);
          }),
          // rule R3: a descriptor once per person type (over both sets)
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
    // ───────────── Person data ─────────────
    propertyValue: {
      key: 'propertyValue', title: 'Properties', icon: 'tune', group: 'Person data',
      filters: [{ key: 'person', label: 'Person', target: 'rowOwnerGUID', options: O.products }],
      columns: [
        rowNo,
        personColumn(),
        { key: 'plan', title: 'Property', type: 'select', target: 'rowParentGUID', allowEmpty: false, width: 190, placeholder: 'Select property…',
          // the property lines of the person's type (rule R4)
          options: (row) => propertyLinesOfProduct(adapted, personById.get(row.rowOwnerGUID ?? '')).map((p) => ({ value: p.rowGUID, label: L.title('descriptorGenus', p.rowParentGUID), hint: [p.rowJSON?.required ? 'required' : '', genusById.get(p.rowParentGUID)?.rowJSON?.multiple ? 'several' : ''].filter(Boolean).join(', ') || undefined })) },
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
      key: 'variant', title: 'Variants', icon: 'style', group: 'Person data',
      filters: [{ key: 'owner', label: 'Person', target: 'rowOwnerGUID', options: O.variantOwners }],
      columns: [
        rowNo,
        { key: 'owner', title: 'Person', type: 'select', target: 'rowOwnerGUID', options: O.variantOwners, allowEmpty: false, width: 230 },
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
      key: 'variantValue', title: 'Variant values', icon: 'tune', group: 'Person data',
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

/**
 * The derived fields of a person row after a cell changed (the table's computeRowJSON): the display title ("First Last" when empty) and
 * personIsEmployee in step with the type (Employee = true).
 */
export function computePersonRowJSON(json: Record<string, any>): Record<string, any> | null {
  const patch: Record<string, any> = {};
  const title = String(json.personTitle ?? '').trim();
  const auto = [json.personFirstName, json.personLastName].filter(Boolean).join(' ').trim();
  if (!title && auto) patch.personTitle = auto;
  if (isSet(json.personType)) {
    const employee = json.personType === PERSON_TYPE.employee;
    if (Boolean(json.personIsEmployee) !== employee) patch.personIsEmployee = employee;
  }
  return Object.keys(patch).length ? patch : null;
}
