// Legal entity - the companies of the user that invoices are issued to / received by (the "VendorInvoiceLegalEntity" of a vendor invoice).
//   legalEntityTable  rowGUID · rowOwnerGUID 'legalEntityCatalog' · rowParentGUID = the FOLDER = the GUID of a country (countryTable) or 'empty' · orderInList
//                     · rowJSON { title, legalName, registrationNo, vatNo, legalAddress, description, isActive }
//   The folders of the tree are the COUNTRIES (derived from countryTable: no folder table to keep). contractTable.rowJSON.legalEntityGUID points at a legal entity - OPTIONAL.
//   SQL: kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql PART 26 · Screen: LegalEntityCRUD · route LEGAL_ENTITY_ROUTES.list · Design: documentation/PROJECT_STATE_WBS.html
import type { DefRow, ProductTableDef } from '../product/productModel';
import type { FolderTreeNode } from '../../ui/components/tree/folderTreeModel';

export const LEGAL_ENTITY_ROUTES = { list: '/catalog/legal/entity' } as const;
/** rowParentGUID of a legal entity that is in no country folder */
export const LEGAL_ENTITY_NO_FOLDER = 'empty';

export interface LegalEntityJSON {
  title: string | null;
  legalName: string | null;
  registrationNo: string | null;
  vatNo: string | null;
  legalAddress: string | null;
  description: string | null;
  isActive: boolean;
}

export const emptyLegalEntity = (): LegalEntityJSON => ({ title: null, legalName: null, registrationNo: null, vatNo: null, legalAddress: null, description: null, isActive: true });

export const LEGAL_ENTITY_TABLE: ProductTableDef = {
  table: 'legalEntityTable',
  entity: 'legalEntityReusable',
  itemLabel: 'Legal entity',
  catalogOwner: 'legalEntityCatalog',
  purpose: 'The companies of the organization that vendor invoices are issued to. The folders are the countries.',
  emptyRowJSON: () => ({ ...emptyLegalEntity() }),
};

export const legalEntityTitle = (r: DefRow<any> | undefined | null): string => String(r?.rowJSON?.title ?? '').trim() || String(r?.rowJSON?.legalName ?? '').trim() || r?.rowGUID || '';
export const isLegalEntityActive = (r: DefRow<any>): boolean => r.rowJSON?.isActive !== false;

/** the name of a country row of the country catalog (countryName, else the code) */
const countryName = (c: DefRow<any>): string => String(c.rowJSON?.countryName ?? '').trim() || String(c.rowJSON?.countryCode ?? '').trim() || c.rowGUID;

/**
 * The folders of the tree = the countries (flat, alphabetical), but only the ones that matter: every country that has a legal entity, plus - while the catalog is short - all of them would be
 * a long empty list, so a country WITHOUT legal entities is shown only when `all` is true. A legal entity whose country is not in the list is not lost: it is in "No folder".
 */
export function legalEntityFolderNodes(countries: DefRow<any>[], entities: DefRow<any>[], all = false): FolderTreeNode[] {
  const used = new Set((entities || []).map((e) => e.rowParentGUID));
  return (countries || [])
    .filter((c) => all || used.has(c.rowGUID))
    .slice()
    .sort((a, b) => countryName(a).localeCompare(countryName(b)))     // by the name of the country (not by the flag in front of it)
    .map((c, i) => ({ id: c.rowGUID, parentId: null, title: `${c.rowJSON?.flagEmoji ? `${c.rowJSON.flagEmoji} ` : ''}${countryName(c)}`, order: i }));
}

/** the legal entities a picker offers: the active ones (the one already chosen stays, so an old choice is never hidden), by title */
export function legalEntitiesToChoose(rows: DefRow<any>[], keepGUID?: string | null): DefRow<any>[] {
  return (rows || []).filter((r) => isLegalEntityActive(r) || r.rowGUID === keepGUID).slice().sort((a, b) => legalEntityTitle(a).localeCompare(legalEntityTitle(b)));
}
