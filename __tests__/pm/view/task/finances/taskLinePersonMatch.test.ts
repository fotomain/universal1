// A person has his OWN Properties and Variants (not the ones of the role) on the same descriptor tables; the line compares them with what the
// role asks for on the DESCRIPTOR (genus + value), never on the plan line. Data = the sheet "W1 V3 ER DESCRIPTORS PLAN" (Data analyst role, Employee set).
import {
  effectivePersonVariant, keyGenusPairs, personMatchProblems, personVariantOptions, personVariants, requiredPairs, roleRequirements, unmetRequirements, variantCovers,
} from '../../../../../kit8/pm/view/task/finances/taskLinePersonMatch';
import { emptyTaskLineCatalogs, TaskLineCatalogData } from '../../../../../kit8/pm/view/task/finances/taskLineCatalogs';
import { taskLineGenusDef } from '../../../../../kit8/pm/view/task/finances/taskLineModel';

const row = (rowGUID: string, rowOwnerGUID: string, rowParentGUID: string, rowJSON: any, orderInList = 0) => ({ rowGUID, rowOwnerGUID, rowParentGUID, orderInList, rowJSON });
const TIME = taskLineGenusDef('timeGenus')!;
const MATERIAL = taskLineGenusDef('materialGenus')!;

function sheet(): TaskLineCatalogData {
  const d = emptyTaskLineCatalogs();
  d.descriptorGenus = [
    row('seniority', 'descriptorGenusCatalog', 'empty', { title: 'Seniority', valueType: 'ref' }),
    row('workLanguage', 'descriptorGenusCatalog', 'empty', { title: 'Working language', valueType: 'ref' }),
    row('certification', 'descriptorGenusCatalog', 'empty', { title: 'Certification', valueType: 'ref', multiple: true }),
    row('minExperienceYears', 'descriptorGenusCatalog', 'empty', { title: 'Min. experience, years', valueType: 'number' }),
    row('experienceYears', 'descriptorGenusCatalog', 'empty', { title: 'Experience, years', valueType: 'number', unit: 'years', satisfies: 'minExperienceYears' }),
  ];
  d.descriptorValue = [
    row('dv11', 'seniority', 'empty', { title: 'Junior' }), row('dv12', 'seniority', 'empty', { title: 'Middle' }), row('dv13', 'seniority', 'empty', { title: 'Senior' }),
    row('dv15', 'workLanguage', 'empty', { title: 'English' }), row('dv16', 'workLanguage', 'empty', { title: 'Latvian' }),
    row('dv18', 'certification', 'empty', { title: 'PMP' }), row('dv20', 'certification', 'empty', { title: 'Microsoft PL-300 (Power BI)' }),
  ];
  d.descriptorDestination = [
    row('ds_da_prop', 'dataAnalyst', 'property', {}), row('ds_da_var', 'dataAnalyst', 'variant', {}),
    row('ds_emp_prop', 'personTypeEmployee', 'property', {}), row('ds_emp_var', 'personTypeEmployee', 'variant', {}),
    row('ds_con_prop', 'personTypeContractor', 'property', {}),
  ];
  d.descriptorPlan = [
    // the Data analyst ROLE side
    row('dp16', 'ds_da_prop', 'minExperienceYears', { required: true }), row('dp17', 'ds_da_prop', 'certification', { required: false }),
    row('dp18', 'ds_da_var', 'seniority', { required: true }), row('dp19', 'ds_da_var', 'workLanguage', { required: true }),
    // the Employee PERSON side - other plan lines, same descriptors
    row('dp_emp_p1', 'ds_emp_prop', 'experienceYears', { required: true }), row('dp_emp_p2', 'ds_emp_prop', 'certification', { required: false }),
    row('dp_emp_v1', 'ds_emp_var', 'seniority', { required: true }), row('dp_emp_v2', 'ds_emp_var', 'workLanguage', { required: true }),
    // the Contractor has NO experience descriptor in its set
    row('dp_con_p2', 'ds_con_prop', 'certification', { required: false }),
  ];
  d.resourceRoleType = [row('dataAnalyst', 'resourceRoleTypeCatalog', 'empty', { title: 'Data analyst', managementGenus: 'timeGenus', variantMode: 'perType', propertySet: 'ds_da_prop', variantSet: 'ds_da_var' })];
  d.resourceRole = [row('role3', 'dataAnalyst', 'empty', { title: 'BI data analyst' })];
  // the role requires: min. 5 years + PMP; and (as a variant) Senior, English
  d.propertyValue = [
    row('pp11', 'role3', 'dp16', { value: 5 }), row('pp12', 'role3', 'dp17', { descriptorValueGUID: 'dv18' }),
    // person John (Employee): 7 years, PMP and PL-300 as two SEPARATE rows
    row('pp_exp_john', 'john', 'dp_emp_p1', { value: 7 }), row('pp_cert_john_1', 'john', 'dp_emp_p2', { descriptorValueGUID: 'dv18' }), row('pp_cert_john_2', 'john', 'dp_emp_p2', { descriptorValueGUID: 'dv20' }),
    // person Anna (Employee): 3 years, no certificate
    row('pp_exp_anna', 'anna', 'dp_emp_p1', { value: 3 }),
    // person Ivan (Contractor): a certificate only
    row('pp_cert_ivan', 'ivan', 'dp_con_p2', { descriptorValueGUID: 'dv20' }),
  ];
  d.person = [
    row('john', 'personCatalog', 'empty', { personType: 'personTypeEmployee' }), row('anna', 'personCatalog', 'empty', { personType: 'personTypeEmployee' }),
    row('ivan', 'personCatalog', 'empty', { personType: 'personTypeContractor' }),
  ];
  d.variant = [
    row('pv11', 'dataAnalyst', 'empty', { title: 'Senior, English', descriptorKey: 'dp18=dv13|dp19=dv15' }),
    row('john_v1', 'john', 'empty', { title: 'Middle, English', descriptorKey: 'dp_emp_v1=dv12|dp_emp_v2=dv15', isActive: true }, 1),
    row('john_v2', 'john', 'empty', { title: 'Senior, English', descriptorKey: 'dp_emp_v1=dv13|dp_emp_v2=dv15', isActive: true }, 2),
    row('john_v3', 'john', 'empty', { title: 'Old', descriptorKey: 'dp_emp_v1=dv11|dp_emp_v2=dv15', isActive: false }, 3),
    row('anna_v1', 'anna', 'empty', { title: 'Middle, Latvian', descriptorKey: 'dp_emp_v1=dv12|dp_emp_v2=dv16', isActive: true }, 1),
  ];
  return d;
}

const base = { resourceRoleItem: 'role3', resourceRoleAttributeSetKey: 'dp18=dv13|dp19=dv15' };

describe('plan lines of different sets meet on the descriptor', () => {
  const d = sheet();
  it('keyGenusPairs turns the plan lines of ANY set into descriptors', () => {
    expect(keyGenusPairs(d, 'dp18=dv13|dp19=dv15')).toEqual([{ genus: 'seniority', value: 'dv13' }, { genus: 'workLanguage', value: 'dv15' }]);
    expect(keyGenusPairs(d, 'dp_emp_v1=dv13|dp_emp_v2=dv15')).toEqual([{ genus: 'seniority', value: 'dv13' }, { genus: 'workLanguage', value: 'dv15' }]);
    expect(keyGenusPairs(d, 'unknown=dv13')).toEqual([]);
    expect(keyGenusPairs(d, null)).toEqual([]);
    expect(keyGenusPairs(d, 'free text')).toEqual([]);
  });
  it('a person variant covers the role variant on the same descriptors, although the plan lines differ', () => {
    const need = keyGenusPairs(d, 'dp18=dv13|dp19=dv15');
    expect(variantCovers(keyGenusPairs(d, 'dp_emp_v1=dv13|dp_emp_v2=dv15'), need)).toBe(true);
    expect(variantCovers(keyGenusPairs(d, 'dp_emp_v1=dv12|dp_emp_v2=dv15'), need)).toBe(false);
    expect(variantCovers(keyGenusPairs(d, 'dp_emp_v1=dv13'), need)).toBe(false);
    expect(variantCovers(keyGenusPairs(d, 'dp_emp_v1=dv13|dp_emp_v2=dv15'), [])).toBe(true);
  });
});

describe('the variants of a person', () => {
  const d = sheet();
  it('his active variants only, in their order; nobody / unknown = none', () => {
    expect(personVariants(d, 'john').map((v) => v.title)).toEqual(['Middle, English', 'Senior, English']);
    expect(personVariants(d, 'ivan')).toEqual([]);
    expect(personVariants(d, null)).toEqual([]);
  });
  it('the pick list marks the variants that cover the role', () => {
    expect(personVariantOptions(d, { ...base, taskResourceItem: 'john' })).toEqual([
      { value: 'dp_emp_v1=dv12|dp_emp_v2=dv15', label: 'Middle, English', hint: 'does not cover the role' },
      { value: 'dp_emp_v1=dv13|dp_emp_v2=dv15', label: 'Senior, English', hint: 'covers the role' },
    ]);
    expect(personVariantOptions(d, { taskResourceItem: 'john' }).every((o) => !('hint' in o))).toBe(true); // the role asks for nothing
  });
  it('empty = automatic: the first variant that covers the role; a chosen one wins', () => {
    expect(effectivePersonVariant(d, { ...base, taskResourceItem: 'john' })?.title).toBe('Senior, English');
    expect(effectivePersonVariant(d, { ...base, taskResourceItem: 'anna' })).toBeNull();
    expect(effectivePersonVariant(d, { ...base, taskResourceItem: 'john', taskResourceAttributesKey: 'dp_emp_v1=dv12|dp_emp_v2=dv15' })?.title).toBe('Middle, English');
    expect(effectivePersonVariant(d, { ...base, taskResourceItem: 'john', taskResourceAttributesKey: 'not his' })).toBeNull();
    expect(requiredPairs(d, base)).toHaveLength(2);
  });
});

describe('the properties of the role are requirements', () => {
  const d = sheet();
  it('every property value of the role: a number or a list value', () => {
    expect(roleRequirements(d, 'role3').map((r) => [r.descriptor, r.wanted])).toEqual([['Min. experience, years', '5'], ['Certification', 'PMP']]);
    expect(roleRequirements(d, null)).toEqual([]);
  });
  it('numbers: the person\'s descriptor that SATISFIES the requirement, at least; lists: includes', () => {
    expect(unmetRequirements(d, 'role3', 'john')).toEqual([]); // 7 >= 5 and PMP among his two certificates
    expect(unmetRequirements(d, 'role3', 'anna')).toEqual(['Experience, years: needs at least 5, has 3 years', 'Certification: PMP is missing']);
  });
  it('several certificates are separate rows: any of them satisfies', () => {
    const only = sheet();
    only.propertyValue = only.propertyValue.filter((p) => p.rowGUID !== 'pp_cert_john_1');
    expect(unmetRequirements(only, 'role3', 'john')).toEqual(['Certification: PMP is missing']); // PL-300 is not PMP
  });
  it('a requirement the person\'s type has no descriptor for is not comparable (not a problem)', () => {
    // the Contractor set has certification but no experience: only PMP is checked
    expect(unmetRequirements(d, 'role3', 'ivan')).toEqual(['Certification: PMP is missing']);
  });
  it('a person without a type, or no role / no person: nothing to compare', () => {
    expect(unmetRequirements(d, 'role3', 'nobody')).toEqual([]);
    expect(unmetRequirements(d, null, 'john')).toEqual([]);
    expect(unmetRequirements(d, 'role3', null)).toEqual([]);
  });
});

describe('personMatchProblems (the mark on the Time line)', () => {
  const d = sheet();
  it('John covers the role: no problem (automatic variant)', () => {
    expect(personMatchProblems(d, TIME, { ...base, taskResourceItem: 'john' })).toEqual([]);
  });
  it('a chosen variant that does not cover the role names what is missing', () => {
    expect(personMatchProblems(d, TIME, { ...base, taskResourceItem: 'john', taskResourceAttributesKey: 'dp_emp_v1=dv12|dp_emp_v2=dv15' }))
      .toEqual(['The variant "Middle, English" does not cover the role: needs Seniority = Senior']);
  });
  it('automatic with no covering variant: says so (with the variants or without)', () => {
    expect(personMatchProblems(d, TIME, { ...base, taskResourceItem: 'anna' })[0]).toBe('The person has no variant that covers the role: needs Seniority = Senior, Working language = English');
    expect(personMatchProblems(d, TIME, { ...base, taskResourceItem: 'ivan' })[0]).toBe('The person has no variants: the role needs Seniority = Senior, Working language = English');
  });
  it('a variant of somebody else is reported; the unmet properties follow', () => {
    expect(personMatchProblems(d, TIME, { ...base, taskResourceItem: 'john', taskResourceAttributesKey: 'dp_emp_v1=dv12|dp_emp_v2=dv16' })[0]).toBe('The variant is not a variant of this person');
    expect(personMatchProblems(d, TIME, { ...base, taskResourceItem: 'anna' }).slice(1)).toEqual(['Experience, years: needs at least 5, has 3 years', 'Certification: PMP is missing']);
  });
  it('only a Time line with a role and a person; the role asking for no variant asks for nothing', () => {
    expect(personMatchProblems(d, MATERIAL, { ...base, taskResourceItem: 'anna' })).toEqual([]);
    expect(personMatchProblems(d, TIME, { ...base, taskResourceItem: null })).toEqual([]);
    expect(personMatchProblems(d, TIME, { resourceRoleItem: 'role3', taskResourceItem: 'john' })).toEqual([]);
  });
});
