// The main vendor (kit8/catalog/vendor): the pair vendor + ITS contract, the rules (the same as the database guard), the JSON to save, the text, the two table columns.
import { MAIN_VENDOR_CONTRACT_FIELD, MAIN_VENDOR_FIELD, isVendorCandidate, mainVendorColumns, mainVendorError, mainVendorJSON, mainVendorText } from '../../../kit8/catalog/vendor/mainVendorModel';

const contracts = [
  { rowGUID: 'vc-1', rowOwnerGUID: 'vp-1', rowParentGUID: 'partner', rowJSON: { contractNumber: 'S-1', contractTitle: 'Supply' } },
  { rowGUID: 'vc-3', rowOwnerGUID: 'vp-2', rowParentGUID: 'partner', rowJSON: { contractNumber: 'B-1' } },
  { rowGUID: 'pc-1', rowOwnerGUID: 'vp-1', rowParentGUID: 'person', rowJSON: {} },
];

describe('the rules', () => {
  it('nothing, or a vendor alone, or a vendor + its contract: fine', () => {
    expect(mainVendorError({}, contracts)).toBeNull();
    expect(mainVendorError({ mainVendorGUID: 'vp-1' }, contracts)).toBeNull();
    expect(mainVendorError({ mainVendorGUID: 'vp-1', mainVendorContractGUID: 'vc-1' }, contracts)).toBeNull();
  });
  it('a contract needs its vendor; it must be a contract of THAT vendor (a partner contract, not a person one)', () => {
    expect(mainVendorError({ mainVendorContractGUID: 'vc-1' }, contracts)).toBe('Select the main vendor first');
    expect(mainVendorError({ mainVendorGUID: 'vp-2', mainVendorContractGUID: 'vc-1' }, contracts)).toBe('The contract is not a contract of the main vendor');
    expect(mainVendorError({ mainVendorGUID: 'vp-1', mainVendorContractGUID: 'pc-1' }, contracts)).toBe('The contract is not a contract of the main vendor');
  });
  it('a partner is not its own vendor', () => {
    expect(mainVendorError({ mainVendorGUID: 'vp-1' }, contracts, 'vp-1')).toBe('A partner cannot be its own main vendor');
    expect(mainVendorError({ mainVendorGUID: 'vp-1' }, contracts, 'vp-9')).toBeNull();
  });
  it('a contract that is not read yet is not a reason to refuse', () => {
    expect(mainVendorError({ mainVendorGUID: 'vp-1', mainVendorContractGUID: 'vc-not-read' }, contracts)).toBeNull();
  });
});

describe('what is saved', () => {
  it('an empty key is not written; a contract without its vendor is dropped; blanks are trimmed', () => {
    expect(mainVendorJSON({})).toEqual({});
    expect(mainVendorJSON({ mainVendorGUID: ' vp-1 ', mainVendorContractGUID: ' vc-1 ' })).toEqual({ mainVendorGUID: 'vp-1', mainVendorContractGUID: 'vc-1' });
    expect(mainVendorJSON({ mainVendorGUID: 'vp-1', mainVendorContractGUID: '' })).toEqual({ mainVendorGUID: 'vp-1' });
    expect(mainVendorJSON({ mainVendorGUID: '', mainVendorContractGUID: 'vc-1' })).toEqual({});
    expect([MAIN_VENDOR_FIELD, MAIN_VENDOR_CONTRACT_FIELD]).toEqual(['mainVendorGUID', 'mainVendorContractGUID']);
  });
  it('the vendors a picker offers: partners that are not "not a supplier" and active; an old choice stays', () => {
    expect(isVendorCandidate({ rowGUID: 'a', rowJSON: { partnerIsSupplier: true } })).toBe(true);
    expect(isVendorCandidate({ rowGUID: 'a', rowJSON: {} })).toBe(true);
    expect(isVendorCandidate({ rowGUID: 'a', rowJSON: { partnerIsSupplier: false } })).toBe(false);
    expect(isVendorCandidate({ rowGUID: 'a', rowJSON: { partnerIsSupplier: false } }, 'a')).toBe(true);    // the vendor already chosen stays visible
    expect(isVendorCandidate({ rowGUID: 'a', rowJSON: { partnerIsSupplier: false } }, 'other')).toBe(false);
    expect(isVendorCandidate({ rowGUID: 'a', rowJSON: { isActive: false } })).toBe(false);
    expect(isVendorCandidate(null)).toBe(false);
  });
  it('the line under a card', () => {
    const partners = [{ rowGUID: 'vp-1', rowJSON: { partnerTitle: 'Acme Supplies' } }];
    expect(mainVendorText('vp-1', 'vc-1', partners, contracts)).toBe('Main vendor: Acme Supplies · S-1 Supply');
    expect(mainVendorText('vp-1', null, partners, contracts)).toBe('Main vendor: Acme Supplies');
    expect(mainVendorText('vp-9', 'vc-x', partners, contracts)).toBe('Main vendor: vp-9');
  });
});

describe('the two columns of a ReusableTable (equipment, product)', () => {
  const cols = mainVendorColumns();
  it('the vendor and ITS contract; the contract is scoped by the vendor of the row', () => {
    expect(cols.map((c) => c.key)).toEqual(['mainVendor', 'mainVendorContract']);
    expect(cols[0]).toMatchObject({ type: 'catalog', field: 'mainVendorGUID', catalogEntityName: 'partnerReusable' });
    expect(cols[1]).toMatchObject({ type: 'catalog', field: 'mainVendorContractGUID', catalogEntityName: 'contractReusable', catalogRowParentGUID: 'partner', dependsOn: 'mainVendor' });
  });
  it('the vendor picker hides customers, keeps the chosen vendor', () => {
    const filter = (cols[0] as any).filterItem;
    expect(filter({ rowGUID: 'a', rowJSON: { partnerIsSupplier: false } }, { rowJSON: {} })).toBe(false);
    expect(filter({ rowGUID: 'a', rowJSON: { partnerIsSupplier: true } }, { rowJSON: {} })).toBe(true);
  });
});
