// The person side of the database as create_person_type_table.sql + create_person_descriptors.sql leave it (shortened: 4 persons, 2 types),
// on top of the descriptors of create_resource_role_tables.sql. Helpers to put it together with the product and role rows (shared tables).
import { emptyPersonCatalogData, PersonCatalogData } from '../../../kit8/catalog/person/personTypeModel';

const row = (rowGUID: string, rowOwnerGUID: string, rowParentGUID: string, rowJSON: any, orderInList = 0) => ({ rowGUID, rowOwnerGUID, rowParentGUID, orderInList, rowJSON });

export const personTypes = () => [
  row('personTypeEmployee', 'personTypeCatalog', 'empty', { title: 'Employee', propertySet: 'ds_emp_prop', variantSet: 'ds_emp_var', variantMode: 'perProduct', uniqueVariants: true, variantTitleTemplate: '{seniority}, {workLanguage}', isActive: true }, 1000),
  row('personTypeContractor', 'personTypeCatalog', 'empty', { title: 'Contractor', propertySet: 'ds_con_prop', variantSet: 'ds_con_var', variantMode: 'perProduct', uniqueVariants: true, variantTitleTemplate: '{seniority}, {workLanguage}', isActive: true }, 2000),
];

export const personGenus = () => [
  row('seniority', 'descriptorGenusCatalog', 'empty', { title: 'Seniority', valueType: 'ref', allowedDescriptionModes: ['variant'], targetKinds: ['resourceRoleType', 'personType'] }),
  row('workLanguage', 'descriptorGenusCatalog', 'empty', { title: 'Working language', valueType: 'ref', allowedDescriptionModes: ['property', 'variant'], targetKinds: ['resourceRoleType', 'personType'] }),
  row('certification', 'descriptorGenusCatalog', 'empty', { title: 'Certification', valueType: 'ref', allowedDescriptionModes: ['property'], targetKinds: ['resourceRoleType', 'personType'], multiple: true }),
  row('minExperienceYears', 'descriptorGenusCatalog', 'empty', { title: 'Min. experience, years', valueType: 'number', allowedDescriptionModes: ['property'], targetKinds: ['resourceRoleType'] }),
  row('experienceYears', 'descriptorGenusCatalog', 'empty', { title: 'Experience, years', valueType: 'number', unit: 'years', allowedDescriptionModes: ['property'], targetKinds: ['personType'], satisfies: 'minExperienceYears', matchRule: 'atLeast' }),
];
export const personValues = () => [
  row('dv11', 'seniority', 'empty', { title: 'Junior', sort: 10 }), row('dv12', 'seniority', 'empty', { title: 'Middle', sort: 20 }), row('dv13', 'seniority', 'empty', { title: 'Senior', sort: 30 }),
  row('dv15', 'workLanguage', 'empty', { title: 'English', sort: 10 }), row('dv16', 'workLanguage', 'empty', { title: 'Latvian', sort: 20 }),
  row('dv18', 'certification', 'empty', { title: 'PMP', sort: 10 }), row('dv20', 'certification', 'empty', { title: 'Microsoft PL-300 (Power BI)', sort: 30 }), row('dv21', 'certification', 'empty', { title: 'IIBA CBAP', sort: 40 }),
];
export const personSets = () => [
  row('ds_emp_prop', 'personTypeEmployee', 'property', { title: 'Employee – properties' }), row('ds_emp_var', 'personTypeEmployee', 'variant', { title: 'Employee – variants' }),
  row('ds_con_prop', 'personTypeContractor', 'property', { title: 'Contractor – properties' }), row('ds_con_var', 'personTypeContractor', 'variant', { title: 'Contractor – variants' }),
];
export const personPlan = () => [
  row('dp_emp_p1', 'ds_emp_prop', 'experienceYears', { required: true, sort: 10 }), row('dp_emp_p2', 'ds_emp_prop', 'certification', { required: false, sort: 20 }),
  row('dp_emp_v1', 'ds_emp_var', 'seniority', { required: true, sort: 10, inVariantTitle: true }), row('dp_emp_v2', 'ds_emp_var', 'workLanguage', { required: true, sort: 20, inVariantTitle: true }),
  row('dp_con_p1', 'ds_con_prop', 'experienceYears', { required: true, sort: 10 }), row('dp_con_p2', 'ds_con_prop', 'certification', { required: false, sort: 20 }),
  row('dp_con_v1', 'ds_con_var', 'seniority', { required: true, sort: 10, inVariantTitle: true }), row('dp_con_v2', 'ds_con_var', 'workLanguage', { required: true, sort: 20, inVariantTitle: true }),
];

/** 4 persons: 1 3 = Employee, 2 4 = Contractor (50 / 50) */
export const persons = () => [
  row('john', 'personCatalog', 'empty', { personFirstName: 'John', personLastName: 'Doe', personTitle: 'John Doe', personType: 'personTypeEmployee', personIsEmployee: true, isActive: true }, 1024),
  row('jane', 'personCatalog', 'empty', { personFirstName: 'Jane', personLastName: 'Smith', personTitle: 'Jane Smith', personType: 'personTypeContractor', personIsEmployee: false, isActive: true }, 2048),
  row('anna', 'personCatalog', 'empty', { personFirstName: 'Anna', personLastName: 'Berzina', personTitle: 'Anna Berzina', personType: 'personTypeEmployee', personIsEmployee: true, isActive: true }, 3072),
  row('peter', 'personCatalog', 'empty', { personFirstName: 'Peter', personLastName: 'Ozols', personTitle: 'Peter Ozols', personType: 'personTypeContractor', personIsEmployee: false, isActive: true }, 4096),
];

/** per person: experience + SEPARATE certification rows, and variants (Seniority x Working language) */
export function personData() {
  const propertyValue = [
    row('pp_exp_john', 'john', 'dp_emp_p1', { value: 7 }), row('pp_cert_john_1', 'john', 'dp_emp_p2', { descriptorValueGUID: 'dv18' }), row('pp_cert_john_2', 'john', 'dp_emp_p2', { descriptorValueGUID: 'dv20' }),
    row('pp_exp_jane', 'jane', 'dp_con_p1', { value: 4 }), row('pp_cert_jane_1', 'jane', 'dp_con_p2', { descriptorValueGUID: 'dv21' }),
    row('pp_exp_anna', 'anna', 'dp_emp_p1', { value: 3 }),
    row('pp_exp_peter', 'peter', 'dp_con_p1', { value: 9 }),
  ];
  const variant = [
    row('pvar_john_1', 'john', 'empty', { title: 'Senior, English', descriptorKey: 'dp_emp_v1=dv13|dp_emp_v2=dv15', isActive: true }, 1),
    row('pvar_john_2', 'john', 'empty', { title: 'Senior, Latvian', descriptorKey: 'dp_emp_v1=dv13|dp_emp_v2=dv16', isActive: true }, 2),
    row('pvar_jane_1', 'jane', 'empty', { title: 'Middle, English', descriptorKey: 'dp_con_v1=dv12|dp_con_v2=dv15', isActive: true }, 1),
    row('pvar_anna_1', 'anna', 'empty', { title: 'Junior, English', descriptorKey: 'dp_emp_v1=dv11|dp_emp_v2=dv15', isActive: true }, 1),
  ];
  const variantValue = [
    row('pvv_john_1_s', 'pvar_john_1', 'dp_emp_v1', { descriptorValueGUID: 'dv13' }), row('pvv_john_1_l', 'pvar_john_1', 'dp_emp_v2', { descriptorValueGUID: 'dv15' }),
    row('pvv_john_2_s', 'pvar_john_2', 'dp_emp_v1', { descriptorValueGUID: 'dv13' }), row('pvv_john_2_l', 'pvar_john_2', 'dp_emp_v2', { descriptorValueGUID: 'dv16' }),
    row('pvv_jane_1_s', 'pvar_jane_1', 'dp_con_v1', { descriptorValueGUID: 'dv12' }), row('pvv_jane_1_l', 'pvar_jane_1', 'dp_con_v2', { descriptorValueGUID: 'dv15' }),
    row('pvv_anna_1_s', 'pvar_anna_1', 'dp_emp_v1', { descriptorValueGUID: 'dv11' }), row('pvv_anna_1_l', 'pvar_anna_1', 'dp_emp_v2', { descriptorValueGUID: 'dv15' }),
  ];
  return { propertyValue, variant, variantValue };
}

/** the person side as the person dashboard reads it (own rows only) */
export function seedPersonCatalog(): PersonCatalogData {
  const d = emptyPersonCatalogData();
  d.personType = personTypes();
  d.person = persons();
  d.descriptorGenus = personGenus();
  d.descriptorValue = personValues();
  d.descriptorDestination = personSets();
  d.descriptorPlan = personPlan();
  Object.assign(d, personData());
  return d;
}
