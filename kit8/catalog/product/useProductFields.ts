// useProductFields - which optional fields (ItemNumber, SearchName) the Product CATALOG has: the DEFAULT project settings of the organization of the user
// (Organization edit -> Projects -> Settings -> Product; productFieldsModel.ts). All off while the organization never saved them. A screen of a PROJECT uses
// productFieldsOfProject(project.rowJSON) instead.
// Without the providers the hook needs (react-query, signed-in user: a test, a screen outside the app shell) it reports "no optional fields" - the catalog works as before.
import { useMemo } from 'react';
import { useMyOrganization } from '../organization/useMyOrganization';
import { NO_PRODUCT_FIELDS, productFieldsOfCatalog, type ProductFields } from './productFieldsModel';

export function useProductFields(): ProductFields {
  let defaults: Parameters<typeof productFieldsOfCatalog>[0] = null;
  try {
    defaults = useMyOrganization().defaults;
  } catch {
    defaults = null;
  }
  return useMemo(() => (defaults ? productFieldsOfCatalog(defaults) : NO_PRODUCT_FIELDS), [defaults]);
}
