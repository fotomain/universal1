// Optional fields of a Product: ItemNumber (rowJSON.itemNumber) and SearchName (rowJSON.searchName) - pure, no React.
//   ItemNumber  the number of the item in the catalog (a code people type, e.g. "100-0245"); unique among the products.
//   SearchName  a name only for finding the product (a short form, a nickname, the name in another language); found by the search, never an identity.
// Four project settings (Project settings -> Product tab; the same switches in Organization edit -> Projects -> Settings -> Product), ALL false by default:
//   itemNumberFunctionalityEnabled / searchNameFunctionalityEnabled                   the field exists: a column of the Product list (CRUD, sort, filter), a field of the product card,
//                                                                                    and the search of the product windows also looks in it
//   itemNumberFunctionalityVisibleInProjects / searchNameFunctionalityVisibleInProjects   the field is also SHOWN in the windows of the project that choose a product (a column of the
//                                                                                    tables, the details line of the List); it works only while its Enabled switch is on
// Who reads which: the Product catalog is the organization's, so its list / card use the DEFAULT project settings of the organization (productFieldsOfCatalog);
// a project screen (the product of a task line) uses the settings of THAT project (productFieldsOfProject).
import type { DefRow } from './productModel';

export interface ProductFieldValues {
  itemNumberFunctionalityEnabled?: boolean;
  itemNumberFunctionalityVisibleInProjects?: boolean;
  searchNameFunctionalityEnabled?: boolean;
  searchNameFunctionalityVisibleInProjects?: boolean;
}

/** a missing value is FALSE (every Product option is off by default, also for a project made before the setting) */
export const productValuesOf = (j: ProductFieldValues | undefined | null): Required<ProductFieldValues> => ({
  itemNumberFunctionalityEnabled: j?.itemNumberFunctionalityEnabled === true,
  itemNumberFunctionalityVisibleInProjects: j?.itemNumberFunctionalityVisibleInProjects === true,
  searchNameFunctionalityEnabled: j?.searchNameFunctionalityEnabled === true,
  searchNameFunctionalityVisibleInProjects: j?.searchNameFunctionalityVisibleInProjects === true,
});

/** what a screen does with each optional field */
export interface ProductFieldUse {
  /** the field exists: a column / form field, and the search looks in it */
  enabled: boolean;
  /** the field is also shown in the product windows of a project (Enabled AND VisibleInProjects) */
  shown: boolean;
}
export interface ProductFields {
  itemNumber: ProductFieldUse;
  searchName: ProductFieldUse;
}

export const NO_PRODUCT_FIELDS: ProductFields = { itemNumber: { enabled: false, shown: false }, searchName: { enabled: false, shown: false } };

/** the fields of a PROJECT's product windows (the settings of the project's rowJSON) */
export function productFieldsOfProject(settings: ProductFieldValues | undefined | null): ProductFields {
  const v = productValuesOf(settings);
  return {
    itemNumber: { enabled: v.itemNumberFunctionalityEnabled, shown: v.itemNumberFunctionalityEnabled && v.itemNumberFunctionalityVisibleInProjects },
    searchName: { enabled: v.searchNameFunctionalityEnabled, shown: v.searchNameFunctionalityEnabled && v.searchNameFunctionalityVisibleInProjects },
  };
}

/** the fields of the Product catalog itself (the list, the card): the DEFAULT project settings of the organization; the list / card show a field only while it is Enabled AND VisibleInProjects ("shown") */
export function productFieldsOfCatalog(organizationDefaults: ProductFieldValues | undefined | null): ProductFields {
  const v = productValuesOf(organizationDefaults);
  return {
    itemNumber: { enabled: v.itemNumberFunctionalityEnabled, shown: v.itemNumberFunctionalityEnabled && v.itemNumberFunctionalityVisibleInProjects },
    searchName: { enabled: v.searchNameFunctionalityEnabled, shown: v.searchNameFunctionalityEnabled && v.searchNameFunctionalityVisibleInProjects },
  };
}

const text = (v: unknown): string => String(v ?? '').trim();

/** the item number of a product row ('' = none) */
export const itemNumberOf = (r: DefRow<any> | undefined | null): string => text(r?.rowJSON?.itemNumber);
/** the search name of a product row ('' = none) */
export const searchNameOf = (r: DefRow<any> | undefined | null): string => text(r?.rowJSON?.searchName);

/** the texts of a product row the search looks in, besides the title and the SKU: only the fields that are enabled */
export function productSearchTexts(r: DefRow<any> | undefined | null, f: ProductFields): string[] {
  return [f.itemNumber.enabled ? itemNumberOf(r) : '', f.searchName.enabled ? searchNameOf(r) : ''].filter(Boolean);
}

/** the "details" of a product in a pick list: SKU and (when shown) the item number */
export function productDetailParts(r: DefRow<any> | undefined | null, f: ProductFields): string[] {
  return [text(r?.rowJSON?.sku), f.itemNumber.shown ? itemNumberOf(r) : ''].filter(Boolean);
}

/** is this item number already used by ANOTHER product? (case-insensitive; an empty number is never a duplicate) */
export function itemNumberTaken(products: DefRow<any>[], value: unknown, ownGUID: string): boolean {
  const v = text(value).toLowerCase();
  return !!v && products.some((p) => p.rowGUID !== ownGUID && itemNumberOf(p).toLowerCase() === v);
}
