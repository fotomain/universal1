// Person dashboard - the tables of the screen (the ReusableTable approach, no folders): the two person tables and the shared descriptor tables
// of the person side.
import type { ProductTableDef } from '../../product/productModel';
import { PRODUCT_TABLES } from '../../product/productModel';
import { emptyPerson, PERSON_CATALOG_OWNER, PERSON_ENTITY, personsTable } from '../personModel';
import { PERSON_TYPE_TABLE } from '../personTypeModel';
import type { PersonTableKey } from '../personValidation';

export const PERSON_TABLE_KEYS: PersonTableKey[] = [
  'person', 'personType', 'descriptorGenus', 'descriptorValue', 'descriptorDestination', 'descriptorPlan', 'propertyValue', 'variant', 'variantValue',
];

export const PERSON_TABLES: Record<PersonTableKey, ProductTableDef> = {
  person: {
    table: personsTable, entity: PERSON_ENTITY, itemLabel: 'Person', catalogOwner: PERSON_CATALOG_OWNER,
    purpose: 'The people who work on tasks: employees and contractors. A person has his own Properties (what he is) and Variants (what he can be booked as).',
    emptyRowJSON: () => ({ ...emptyPerson() }),
  },
  personType: PERSON_TYPE_TABLE,
  descriptorGenus: PRODUCT_TABLES.descriptorGenus,
  descriptorValue: PRODUCT_TABLES.descriptorValue,
  descriptorDestination: { ...PRODUCT_TABLES.descriptorDestination, purpose: 'The descriptor set of a person type per description mode (one Property set and one Variant set per type).' },
  descriptorPlan: PRODUCT_TABLES.descriptorPlan,
  propertyValue: { ...PRODUCT_TABLES.propertyValue, purpose: 'What a person IS (Experience 7 years, Certification PMP). A descriptor with "multiple" (Certification) has one row for EACH value.' },
  variant: { ...PRODUCT_TABLES.variant, purpose: 'What a person CAN BE BOOKED AS (Senior, English): a Time line of a task picks one of them.' },
  variantValue: PRODUCT_TABLES.variantValue,
};

export const PERSON_DASHBOARD_GROUPS = ['Catalog', 'Descriptors', 'Person data'] as const;
export const PERSON_DASHBOARD_TABLE_ORDER: PersonTableKey[] = [
  'person', 'personType', 'descriptorGenus', 'descriptorValue', 'descriptorDestination', 'descriptorPlan', 'propertyValue', 'variant', 'variantValue',
];
