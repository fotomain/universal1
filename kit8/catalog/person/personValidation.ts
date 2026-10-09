// Person catalog - the validation rules (pure, unit-tested). The descriptor rules R1-R11 are the product ones
// (product/crud/productValidation.ts, run on personAsProductData with PERSON_KIND): sets and variants belong to the person TYPE / the PERSON,
// property values to the person, a descriptor with "multiple": true may have several property rows. This file adds what only people have.
import { byGUID, isSet } from '../product/crud/productCatalogTools';
import { CatalogKind, ProductIssue, RULES, validateProductCatalog } from '../product/crud/productValidation';
import { personAsProductData, personName, PersonCatalogData } from './personTypeModel';

export { issuesByTable } from '../product/crud/productValidation';
export type PersonTableKey = 'personType' | 'person' | 'descriptorDestination' | 'descriptorPlan' | 'propertyValue' | 'variant' | 'variantValue' | 'descriptorGenus' | 'descriptorValue';
export type PersonIssue = ProductIssue<PersonTableKey>;

export const PERSON_KIND: CatalogKind = {
  kind: 'personType',
  tables: { type: 'personType', item: 'person', folder: 'person', price: 'person' },
  vat: { type: 'personVATDefaultRate', item: 'personVATRate' },
  words: { item: 'Person', itemLower: 'person', type: 'Person type', typeLower: 'person type' },
  priceFor: () => false,
  productLogistics: false,
};

const { GTIN: _gtin, R7: _r7, R13: _r13, ...PRODUCT_RULES } = RULES;
export const PERSON_RULES: Record<string, string> = {
  ...PRODUCT_RULES,
  R3: 'A descriptor appears only once per person type (Property OR Variant)',
  R8: 'Required plan lines have a value; one value per person and plan line - except a descriptor with "multiple" (several certifications: one row each)',
  R11: 'A plan line descriptor is meant for person types',
  R12: 'Person side mirrors the role side: sets are owned by the person TYPE, property values and variants by the PERSON',
  P1: 'Every person has a person type',
};

export function validatePersonCatalog(data: PersonCatalogData): PersonIssue[] {
  const issues = validateProductCatalog(personAsProductData(data), PERSON_KIND) as PersonIssue[];
  const types = byGUID(data.personType);
  for (const p of data.person) {
    const t = p.rowJSON?.personType;
    // "choose its person type" for an empty type is already reported by R1; an unknown type is named here
    if (isSet(t) && !types.has(t)) issues.push({ rule: 'P1', severity: 'error', table: 'person', rowGUID: p.rowGUID, message: `Person "${personName(p) || p.rowGUID}": person type "${t}" is missing` });
  }
  return issues;
}
