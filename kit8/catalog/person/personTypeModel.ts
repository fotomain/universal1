// Person types - the twin of productTypeTable / resourceRoleTypeTable for PEOPLE (sheet "W1 V3 ER DESCRIPTORS PLAN", rule R12 mirrored):
//   personTypeTable   Employee · Contractor   a type decides which descriptor sets (Property / Variant) its persons use
//   personTable       the person                 rowJSON.personType = the type (the owner of a person stays PERSON_CATALOG_OWNER)
//   Property  = what the person IS (Experience 7 years, Certification PMP ...)   propertyValueTable  owner = person
//   Variant   = what he CAN BE BOOKED AS (Senior, English)                       variantTable        owner = person (variantMode 'perProduct')
//   SQL: kit8/sql/init/create_person_type_table.sql + create_person_descriptors.sql (+ delete_*)   Screen: PersonDashboard (./dashboard)
// The descriptor rules (sets, plan lines, variant owner R6, descriptorKey + title R9 / R10) are written ONCE for the product catalog; the
// person side feeds them through personAsProductData(): person type = product type, person = product.
import type { DefRow, ProductTableDef } from '../product/productModel';
import { emptyCatalogData, ProductCatalogData } from '../product/crud/productCatalogTools';
import { PERSON_ENTITY } from './personModel';

export const PERSON_ROUTES_DASHBOARD = '/catalog/person/dashboard';

export const PERSON_TYPE_TABLE: ProductTableDef = {
  table: 'personTypeTable',
  entity: 'personTypeReusable',
  itemLabel: 'Person type',
  catalogOwner: 'personTypeCatalog',
  purpose: 'Groups persons of the same kind (Employee, Contractor); decides which descriptor sets (Property / Variant) they use - like a product type.',
  emptyRowJSON: () => ({ title: null, description: null, propertySet: null, variantSet: null, variantMode: 'perProduct', uniqueVariants: true, variantTitleTemplate: null, isActive: true }),
};

/** rowGUIDs of the seed types */
export const PERSON_TYPE = { employee: 'personTypeEmployee', contractor: 'personTypeContractor' } as const;

/** the variants of a person belong to the PERSON (the product catalog's 'perProduct') */
export const PERSON_VARIANT_MODES = [
  { value: 'none', label: 'No variants', hint: 'the person is booked as he is' },
  { value: 'perProduct', label: 'Per person', hint: 'every person has his own variants (Senior, English)' },
];

const isSet = (g: unknown): g is string => typeof g === 'string' && g !== '' && g !== 'empty';

/** the type of a person: rowJSON.personType */
export const personTypeOf = (person: { rowJSON?: { personType?: unknown } } | undefined | null): string | null => {
  const t = person?.rowJSON?.personType;
  return isSet(t) ? t : null;
};

/** "First Last" of a person row ('' = unnamed) */
export const personName = (person: { rowJSON?: Record<string, any> } | undefined | null): string => {
  const j = person?.rowJSON || {};
  return String(j.personTitle || [j.personFirstName, j.personLastName].filter(Boolean).join(' ') || '').trim();
};

/** what the person side needs: every list of the catalog data the rules read */
export interface PersonCatalogData {
  personType: DefRow<any>[];
  person: DefRow<any>[];
  descriptorGenus: DefRow<any>[];
  descriptorValue: DefRow<any>[];
  descriptorDestination: DefRow<any>[];
  descriptorPlan: DefRow<any>[];
  propertyValue: DefRow<any>[];
  variant: DefRow<any>[];
  variantValue: DefRow<any>[];
  /** contractTable (a person's contracts: counted in the Persons table) */
  contract: DefRow<any>[];
}
export const emptyPersonCatalogData = (): PersonCatalogData => ({
  personType: [], person: [], descriptorGenus: [], descriptorValue: [], descriptorDestination: [], descriptorPlan: [],
  propertyValue: [], variant: [], variantValue: [], contract: [],
});

/**
 * The person side seen as the product side: person type = product type, person = product whose OWNER is its type. (A person's own
 * owner is PERSON_CATALOG_OWNER, so the adapter sets rowOwnerGUID = rowJSON.personType.) The descriptor rules, labels and the
 * variant lookup are then the product catalog's.
 */
export function personAsProductData(d: Pick<PersonCatalogData, 'personType' | 'person' | 'descriptorGenus' | 'descriptorValue' | 'descriptorDestination' | 'descriptorPlan' | 'propertyValue' | 'variant' | 'variantValue'>): ProductCatalogData {
  return {
    ...emptyCatalogData(),
    descriptorGenus: d.descriptorGenus, descriptorValue: d.descriptorValue, descriptorDestination: d.descriptorDestination, descriptorPlan: d.descriptorPlan,
    propertyValue: d.propertyValue, variant: d.variant, variantValue: d.variantValue,
    productType: d.personType,
    // rowJSON.title: the product rules and labels read the name of an item from it
    product: d.person.map((p) => ({ ...p, rowOwnerGUID: personTypeOf(p) ?? 'empty', rowJSON: { ...p.rowJSON, title: personName(p) } })),
  };
}

export { PERSON_ENTITY };
