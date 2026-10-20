// vatBasis - THE rule every report that shows money obeys (documentation/VENDOR_INVOICE_DOC.html sections 3 and 14).
// An amount is stored as COMPONENTS: net, VAT, and the part of the VAT that is cost (not recoverable). A report shows ONE of three bases:
//   cost   (default) net + the VAT that is cost - the IFRS / GAAP cost of what was bought: recoverable VAT is a receivable of the tax authority, not a cost
//   net    the amount without VAT
//   gross  net + all VAT ("With VAT")
// Same function in SQL: public.vat_basis_amount(net, vat, vat_in_cost, basis). A customer invoice's VAT is never cost (it is collected for the tax authority), so its "in cost" part is 0.
export type VatBasis = 'cost' | 'net' | 'gross';

export const VAT_BASIS_DEFAULT: VatBasis = 'cost';
export const VAT_BASES: VatBasis[] = ['cost', 'net', 'gross'];

/** the names in the UI (pass through pmT) */
export const VAT_BASIS_TITLE: Record<VatBasis, string> = {
  cost: 'Cost (net + non-recoverable VAT)',
  net: 'Net of VAT',
  gross: 'With VAT',
};
/** the short names (the radio in a toolbar, a header tip) */
export const VAT_BASIS_SHORT: Record<VatBasis, string> = { cost: 'Cost', net: 'Net', gross: 'With VAT' };

export const isVatBasis = (v: unknown): v is VatBasis => v === 'cost' || v === 'net' || v === 'gross';

const num = (v: unknown): number => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : 0; };
const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** the amount on a basis; a missing part counts as 0 */
export function amountOfVatBasis(net: unknown, vat: unknown, vatInCost: unknown, basis: VatBasis = VAT_BASIS_DEFAULT): number {
  const n = num(net);
  if (basis === 'net') return round2(n);
  if (basis === 'gross') return round2(n + num(vat));
  return round2(n + num(vatInCost));
}
