// Main vendor - who a partner / a piece of equipment / a product is normally bought from (kit8/catalog/vendor).
//   rowJSON.mainVendorGUID          partnerTable.rowGUID (the vendor)
//   rowJSON.mainVendorContractGUID  contractTable.rowGUID - a contract of THAT vendor (rowParentGUID 'partner', rowOwnerGUID = the vendor)
//   in partnerTable, equipmentTable, productTable (the material). Both are optional. SQL: kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql PART 26 (main_vendor_guard: the same rules in the database).
//   The vendor invoice window lists the vendors of the lines of a task from them (documentation/PROJECT_STATE_WBS.html).
import type { VisualColumn } from '../../ui/components/table/reusable/reusableTableTypes';
import { PARTNER_CATALOG_OWNER, PARTNER_ENTITY } from '../partner/partnerModel';
import { CONTRACT_ENTITY } from '../contract/contractModel';

export const MAIN_VENDOR_FIELD = 'mainVendorGUID';
export const MAIN_VENDOR_CONTRACT_FIELD = 'mainVendorContractGUID';

export interface MainVendorValue { mainVendorGUID?: string | null; mainVendorContractGUID?: string | null }

/** the vendors a picker offers: partners that are not marked "not a supplier" (a partner that is both customer and supplier is a vendor too); an old choice stays visible */
export const isVendorCandidate = (partner: any, keepGUID?: string | null): boolean =>
  !!partner && (partner.rowGUID === keepGUID || partner.rowJSON?.partnerIsSupplier !== false) && partner.rowJSON?.isActive !== false;

/** the error of a main vendor pair (null = fine): the contract needs the vendor, and it must be a contract of that vendor; a partner is not its own vendor */
export function mainVendorError(value: MainVendorValue, contracts: { rowGUID: string; rowOwnerGUID: string; rowParentGUID: string }[], ownGUID?: string | null): string | null {
  const vendor = String(value.mainVendorGUID ?? '').trim();
  const contract = String(value.mainVendorContractGUID ?? '').trim();
  if (!vendor && !contract) return null;
  if (!vendor) return 'Select the main vendor first';
  if (ownGUID && vendor === ownGUID) return 'A partner cannot be its own main vendor';
  if (contract) {
    const row = contracts.find((c) => c.rowGUID === contract);
    if (row && (row.rowParentGUID !== 'partner' || row.rowOwnerGUID !== vendor)) return 'The contract is not a contract of the main vendor';
  }
  return null;
}

/** the JSON keys to save: an empty one is NOT written (a save clears it), and a contract without its vendor is dropped */
export function mainVendorJSON(value: MainVendorValue): Record<string, string> {
  const vendor = String(value.mainVendorGUID ?? '').trim();
  const contract = String(value.mainVendorContractGUID ?? '').trim();
  return { ...(vendor ? { [MAIN_VENDOR_FIELD]: vendor } : {}), ...(vendor && contract ? { [MAIN_VENDOR_CONTRACT_FIELD]: contract } : {}) };
}

/**
 * The two columns of a ReusableTable (equipment, product): the vendor and ITS contract. The contract select is scoped by the vendor of the row and is cleared when the vendor changes
 * (the `dependsOn` mechanism of the table, as the partner contract of a task line).
 */
export function mainVendorColumns(): VisualColumn[] {
  return [
    {
      key: 'mainVendor', title: 'Main vendor', type: 'catalog', field: MAIN_VENDOR_FIELD, width: 220,
      catalogEntityName: PARTNER_ENTITY, catalogRowOwnerGUID: PARTNER_CATALOG_OWNER, placeholder: 'Select vendor…',
      filterItem: (partner: any, row: any) => isVendorCandidate(partner, row?.rowJSON?.[MAIN_VENDOR_FIELD]),
    } as VisualColumn,
    {
      key: 'mainVendorContract', title: 'Main vendor contract', type: 'catalog', field: MAIN_VENDOR_CONTRACT_FIELD, width: 240,
      catalogEntityName: CONTRACT_ENTITY, catalogRowParentGUID: 'partner', dependsOn: 'mainVendor', dependsOnMessage: 'Select a vendor first', placeholder: 'Select contract…',
    } as VisualColumn,
  ];
}

/** "Main vendor: Acme Supplies · S-1 Supply" (the names while the catalogs are read, the GUID before) */
export function mainVendorText(vendorGUID: string, contractGUID: string | null | undefined, partners: any[], contracts: any[]): string {
  const vendor = partners.find((p) => p.rowGUID === vendorGUID);
  const contract = contractGUID ? contracts.find((c) => c.rowGUID === contractGUID) : null;
  const vendorName = String(vendor?.rowJSON?.partnerTitle ?? '').trim() || vendorGUID;
  const contractName = contract ? [contract.rowJSON?.contractNumber, contract.rowJSON?.contractTitle].filter(Boolean).join(' ') : '';
  return `Main vendor: ${vendorName}${contractName ? ` · ${contractName}` : ''}`;
}
