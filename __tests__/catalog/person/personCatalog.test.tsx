/** @jest-environment jsdom */
// Person side of the descriptor model: separate Properties and Variants of a person (type -> person), the same rules as products and roles
// (R1-R11, R8 relaxed for a descriptor with "multiple"), the three sides of the shared tables, and the rows of the person dashboard.
import { seedPersonCatalog, personData } from './personTestKit';

// the table configurations render cells with the design system: it and the react-native-paper theme are test doubles
jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('react-native-paper', () => ({ useTheme: () => ({ colors: { surfaceVariant: '#eee' } }) }));
jest.mock('../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name, testID }: any) => R.createElement(Text, { testID }, name) };
});
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve()) }));
import { personAsProductData, personName, personTypeOf, PERSON_TYPE } from '../../../kit8/catalog/person/personTypeModel';
import { issuesByTable, validatePersonCatalog } from '../../../kit8/catalog/person/personValidation';
import { sideOf } from '../../../kit8/catalog/product/crud/catalogSides';
import { propertyLinesOfProduct, variantsOfProduct, variantLinesOfOwner, computedVariant } from '../../../kit8/catalog/product/crud/productCatalogTools';
import { buildProductLabels } from '../../../kit8/catalog/product/crud/productLabels';
import { buildPersonTables, computePersonRowJSON, genusIsForPerson } from '../../../kit8/catalog/person/dashboard/personDashboardTables';
import { emptyPerson, normalizePerson } from '../../../kit8/catalog/person/personModel';

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const row = (rowGUID: string, rowOwnerGUID: string, rowParentGUID: string, rowJSON: any, orderInList = 0) => ({ rowGUID, rowOwnerGUID, rowParentGUID, orderInList, rowJSON });

describe('the person seen as a product (the descriptor rules are written once)', () => {
  const d = seedPersonCatalog();
  const adapted = personAsProductData(d);

  it('a person is a product OWNED BY ITS TYPE, with its name as the title; the real row is not touched', () => {
    const john = adapted.product.find((p) => p.rowGUID === 'john')!;
    expect(john.rowOwnerGUID).toBe('personTypeEmployee');
    expect(john.rowJSON.title).toBe('John Doe');
    expect(d.person[0].rowOwnerGUID).toBe('personCatalog');
    expect(d.person[0].rowJSON.title).toBeUndefined();
    expect(adapted.productType.map((t) => t.rowGUID)).toEqual(['personTypeEmployee', 'personTypeContractor']);
  });
  it('a person without a type has no owner', () => {
    const x = clone(d);
    x.person.push(row('nobody', 'personCatalog', 'empty', { personFirstName: 'No', personLastName: 'Type' }));
    expect(personAsProductData(x).product.find((p) => p.rowGUID === 'nobody')!.rowOwnerGUID).toBe('empty');
    expect(personTypeOf(x.person[4])).toBeNull();
    expect(personName(x.person[4])).toBe('No Type');
  });
  it('the property lines and the variants of a person are those of HIS type / HIS own', () => {
    const john = adapted.product.find((p) => p.rowGUID === 'john')!;
    const jane = adapted.product.find((p) => p.rowGUID === 'jane')!;
    expect(propertyLinesOfProduct(adapted, john).map((l) => l.rowGUID)).toEqual(['dp_emp_p1', 'dp_emp_p2']);
    expect(propertyLinesOfProduct(adapted, jane).map((l) => l.rowGUID)).toEqual(['dp_con_p1', 'dp_con_p2']);
    expect(variantsOfProduct(adapted, john).map((v) => v.rowGUID)).toEqual(['pvar_john_1', 'pvar_john_2']); // perProduct: his own
    expect(variantsOfProduct(adapted, jane).map((v) => v.rowGUID)).toEqual(['pvar_jane_1']);
    expect(variantLinesOfOwner(adapted, 'john').map((l) => l.rowGUID)).toEqual(['dp_emp_v1', 'dp_emp_v2']);
  });
  it('the title and the key of a person variant are computed like any variant (R9 / R10)', () => {
    const v = d.variant.find((x) => x.rowGUID === 'pvar_john_2')!;
    expect(computedVariant(adapted, v)).toEqual({ title: 'Senior, Latvian', descriptorKey: 'dp_emp_v1=dv13|dp_emp_v2=dv16' });
  });
});

describe('validatePersonCatalog', () => {
  it('the SQL data is clean', () => {
    expect(validatePersonCatalog(seedPersonCatalog())).toEqual([]);
  });

  it('several certificates are separate rows of the same plan line (R8 relaxed); the same certificate twice is a warning', () => {
    const d = seedPersonCatalog();
    expect(d.propertyValue.filter((p) => p.rowOwnerGUID === 'john' && p.rowParentGUID === 'dp_emp_p2')).toHaveLength(2);
    d.propertyValue.push(row('pp_dup', 'john', 'dp_emp_p2', { descriptorValueGUID: 'dv18' }));
    const issues = validatePersonCatalog(d);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ rule: 'R8', severity: 'warning', table: 'propertyValue', rowGUID: 'pp_dup' });
  });

  it('a descriptor WITHOUT "multiple" has one value per person (R8 error)', () => {
    const d = seedPersonCatalog();
    d.propertyValue.push(row('pp_exp_john_2', 'john', 'dp_emp_p1', { value: 8 }));
    expect(validatePersonCatalog(d).map((i) => [i.rule, i.severity, i.rowGUID])).toEqual([['R8', 'error', 'pp_exp_john_2']]);
  });

  it('a plan line descriptor must be meant for person types (R11)', () => {
    const d = seedPersonCatalog();
    d.descriptorPlan.push(row('dp_bad', 'ds_emp_prop', 'minExperienceYears', { required: false }));
    expect(validatePersonCatalog(d)).toEqual([expect.objectContaining({ rule: 'R11', table: 'descriptorPlan', rowGUID: 'dp_bad' })]);
  });

  it('a required property without a value, a property not in the type\'s set (R4), a person without a type', () => {
    const d = seedPersonCatalog();
    d.propertyValue = d.propertyValue.filter((p) => p.rowGUID !== 'pp_exp_anna');
    d.propertyValue.push(row('pp_wrong', 'jane', 'dp_emp_p1', { value: 1 })); // jane is a Contractor: the Employee line
    d.person.push(row('nobody', 'personCatalog', 'empty', { personFirstName: 'No', personLastName: 'Type' }));
    d.person.push(row('ghost', 'personCatalog', 'empty', { personFirstName: 'Ghost', personLastName: 'T', personType: 'personTypeGone' }));
    const rules = validatePersonCatalog(d).map((i) => `${i.rule}:${i.table}:${i.rowGUID}`).sort();
    expect(rules).toEqual([
      'P1:person:ghost', 'R1:person:ghost', 'R1:person:nobody', 'R4:propertyValue:pp_wrong', 'R8:person:anna',
    ]);
  });

  it('variants belong to the person: a variant owned by the TYPE is an error, a variant value of another set is an error (R6, R4)', () => {
    const d = seedPersonCatalog();
    d.variant.push(row('pv_type', 'personTypeEmployee', 'empty', { title: 'On the type', descriptorKey: '' }));
    d.variantValue.push(row('pvv_x', 'pvar_anna_1', 'dp_con_v1', { descriptorValueGUID: 'dv13' })); // Anna is an Employee
    const found = validatePersonCatalog(d).map((i) => `${i.rule}:${i.rowGUID}`);
    expect(found).toContain('R6:pv_type');
    expect(found).toContain('R4:pvv_x');
  });

  it('issues are grouped per table for the dashboard badges', () => {
    const d = seedPersonCatalog();
    d.propertyValue.push(row('pp_exp_john_2', 'john', 'dp_emp_p1', { value: 8 }));
    expect(Object.keys(issuesByTable(validatePersonCatalog(d)))).toEqual(['propertyValue']);
  });
});

describe('three sides share the descriptor tables: products, roles and persons', () => {
  const personSide = seedPersonCatalog();
  const productSets = [row('ds_sp_var', 'smartphone1', 'variant', {}), row('ds_pm_var', 'projectManager', 'variant', {})];
  const all = {
    descriptorDestination: [...productSets, ...personSide.descriptorDestination],
    descriptorPlan: [row('dp1', 'ds_sp_var', 'color', {}), row('dp10', 'ds_pm_var', 'seniority', {}), ...personSide.descriptorPlan],
    propertyValue: [row('pp1', 'prod1', 'dp3', {}), row('pp7', 'role1', 'dp8', {}), ...personSide.propertyValue],
    variant: [row('pv1', 'smartphone1', 'empty', {}), row('pv7', 'projectManager', 'empty', {}), ...personSide.variant],
    variantValue: [row('pvd1', 'pv1', 'dp1', {}), row('pvd12', 'pv7', 'dp10', {}), ...personSide.variantValue],
  };
  const ids = (rows: any[]) => rows.map((r) => r.rowGUID);
  const productTypes = [{ rowGUID: 'smartphone1' }], products = [{ rowGUID: 'prod1' }];
  const roleTypes = [{ rowGUID: 'projectManager' }], roles = [{ rowGUID: 'role1' }];
  const personTypes = personSide.personType, people = personSide.person;

  it('the PERSON side keeps its rows and leaves the product and role rows out', () => {
    const side = sideOf(all as any, [...productTypes, ...roleTypes], [...products, ...roles]).data;
    expect(ids(side.descriptorDestination)).toEqual(ids(personSide.descriptorDestination));
    expect(ids(side.propertyValue)).toEqual(ids(personSide.propertyValue));
    expect(ids(side.variant)).toEqual(ids(personSide.variant));
    expect(ids(side.variantValue)).toEqual(ids(personSide.variantValue));
  });
  it('the PRODUCT side and the ROLE side do not show the rows of the persons (they would report them as orphans)', () => {
    const productSide = sideOf(all as any, [...roleTypes, ...personTypes], [...roles, ...people]).data;
    expect(ids(productSide.descriptorDestination)).toEqual(['ds_sp_var']);
    expect(ids(productSide.propertyValue)).toEqual(['pp1']);
    expect(ids(productSide.variant)).toEqual(['pv1']);
    const roleSide = sideOf(all as any, [...productTypes, ...personTypes], [...products, ...people]).data;
    expect(ids(roleSide.descriptorDestination)).toEqual(['ds_pm_var']);
    expect(ids(roleSide.propertyValue)).toEqual(['pp7']);
    expect(ids(roleSide.variantValue)).toEqual(['pvd12']);
  });
});

describe('person rows', () => {
  it('computePersonRowJSON: the title "First Last" when empty, personIsEmployee follows the type', () => {
    expect(computePersonRowJSON({ personFirstName: 'Ann', personLastName: 'Lee', personTitle: '', personType: PERSON_TYPE.employee, personIsEmployee: false })).toEqual({ personTitle: 'Ann Lee', personIsEmployee: true });
    expect(computePersonRowJSON({ personFirstName: 'Ann', personTitle: 'Dr Ann', personType: PERSON_TYPE.contractor, personIsEmployee: true })).toEqual({ personIsEmployee: false });
    expect(computePersonRowJSON({ personFirstName: 'Ann', personTitle: 'Dr Ann', personType: PERSON_TYPE.contractor, personIsEmployee: false })).toBeNull();
    expect(computePersonRowJSON({ personFirstName: 'Ann', personTitle: 'Dr Ann', personIsEmployee: true })).toBeNull(); // no type yet: the flag is left alone
  });
  it('the person form keeps the type (normalizePerson)', () => {
    expect(normalizePerson({ ...emptyPerson(), personFirstName: 'A', personType: PERSON_TYPE.employee }).personType).toBe('personTypeEmployee');
    expect(normalizePerson({ ...emptyPerson(), personFirstName: 'A' }).personType).toBeNull();
  });
  it('a descriptor meant for person types (R11) is offered in the plan lines', () => {
    const d = seedPersonCatalog();
    expect(d.descriptorGenus.filter((g) => genusIsForPerson(g)).map((g) => g.rowGUID)).toEqual(['seniority', 'workLanguage', 'certification', 'experienceYears']);
  });
});

describe('buildPersonTables', () => {
  const d = seedPersonCatalog();
  const L = buildProductLabels(personAsProductData(d));
  const opened: any[] = [];
  const T = buildPersonTables(d, L, { openTable: (...a) => opened.push(a), openPerson: (g) => opened.push(['person', g]) });

  it('every table of the dashboard', () => {
    expect(Object.keys(T).sort()).toEqual(['descriptorGenus', 'descriptorPlan', 'descriptorDestination', 'descriptorValue', 'person', 'personType', 'propertyValue', 'variant', 'variantValue'].sort());
  });
  it('the Persons table edits the name, the type, the contacts; counts properties / variants / contracts', () => {
    const cols = T.person.columns.map((c) => c.key);
    expect(cols).toEqual(['n', 'first', 'last', 'title', 'type', 'email', 'phone', 'isActive', 'properties', 'variants', 'contracts']);
    const type: any = T.person.columns.find((c) => c.key === 'type');
    expect(type.field).toBe('personType');
    expect(type.options.map((o: any) => o.label)).toEqual(['Contractor', 'Employee']);
    expect(T.person.filters.map((f) => f.key)).toEqual(['type']);
  });
  it('plan lines offer only descriptors meant for person types and allowed in the mode of the set (R2, R11)', () => {
    const genus: any = T.descriptorPlan.columns.find((c) => c.key === 'genus');
    const forVariant = genus.options(row('x', 'ds_emp_var', 'seniority', {})).map((o: any) => o.value);
    expect(forVariant).toEqual(['seniority', 'workLanguage']); // certification / experience are Property only
    const forProperty = genus.options(row('x', 'ds_emp_prop', 'seniority', {})).map((o: any) => o.value);
    expect(forProperty).toEqual(['certification', 'workLanguage', 'experienceYears'].sort((a, b) => forProperty.indexOf(a) - forProperty.indexOf(b)));
    expect(forProperty).not.toContain('seniority');
    expect(genus.validate('seniority', row('x', 'ds_emp_prop', 'empty', {}))).toMatch(/already in/); // R3
    expect(genus.validate('certification', row('dp_emp_p2', 'ds_emp_prop', 'certification', {}))).toBeNull();
  });
  it('a property row picks a plan line of the property set of THE PERSON\'s type', () => {
    const plan: any = T.propertyValue.columns.find((c) => c.key === 'plan');
    expect(plan.options(row('x', 'john', 'empty', {})).map((o: any) => o.value)).toEqual(['dp_emp_p1', 'dp_emp_p2']);
    expect(plan.options(row('x', 'jane', 'empty', {})).map((o: any) => o.value)).toEqual(['dp_con_p1', 'dp_con_p2']);
    expect(plan.options(row('x', 'john', 'empty', {})).find((o: any) => o.value === 'dp_emp_p2').hint).toBe('several');
  });
  it('the variant value picks a descriptor of the variant set of the person\'s type, and a value of it', () => {
    const plan: any = T.variantValue.columns.find((c) => c.key === 'plan');
    expect(plan.options(row('x', 'pvar_john_1', 'empty', {})).map((o: any) => o.value)).toEqual(['dp_emp_v1', 'dp_emp_v2']);
    const value: any = T.variantValue.columns.find((c) => c.key === 'value');
    expect(value.options(row('x', 'pvar_john_1', 'dp_emp_v1', {})).map((o: any) => o.label)).toEqual(['Junior', 'Middle', 'Senior']);
    expect(plan.validate('dp_emp_v1', row('x', 'pvar_john_1', 'empty', {}))).toMatch(/already has a value/);
  });
  it('row menus open the next table filtered by the person', () => {
    const john = row('john', 'personCatalog', 'empty', {});
    const items = T.person.extraMenuItems!(john, () => {});
    items.find((i) => i.testID === 'person-open-properties-john')!.onPress();
    items.find((i) => i.testID === 'person-open-variants-john')!.onPress();
    items.find((i) => i.testID === 'person-open-page-john')!.onPress();
    expect(opened).toEqual([['propertyValue', { person: 'john' }, 'john'], ['variant', { owner: 'john' }, 'john'], ['person', 'john']]);
  });
  it('the descriptor table gets the person columns: several values, satisfies, compared', () => {
    expect(T.descriptorGenus.columns.map((c) => c.key).slice(-3)).toEqual(['multiple', 'satisfies', 'matchRule']);
  });
});

describe('the seed of the SQL', () => {
  it('50 % Employees and 50 % Contractors', () => {
    const d = seedPersonCatalog();
    const per = (t: string) => d.person.filter((p) => p.rowJSON.personType === t).length;
    expect([per('personTypeEmployee'), per('personTypeContractor')]).toEqual([2, 2]);
    expect(d.person.every((p) => p.rowJSON.personIsEmployee === (p.rowJSON.personType === 'personTypeEmployee'))).toBe(true);
  });
  it('a certificate is a separate row each; every person has variants of his own', () => {
    const { propertyValue, variant } = personData();
    expect(propertyValue.filter((p) => p.rowOwnerGUID === 'john' && p.rowParentGUID === 'dp_emp_p2').map((p) => p.rowJSON.descriptorValueGUID)).toEqual(['dv18', 'dv20']);
    expect(new Set(variant.map((v) => v.rowOwnerGUID))).toEqual(new Set(['john', 'jane', 'anna']));
  });
});
