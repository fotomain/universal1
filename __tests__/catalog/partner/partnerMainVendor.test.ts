// The partner model keeps the main vendor: an empty key is not written (a save clears it), a contract without its vendor is dropped, and the form's save does not lose it.
import { normalizePartner } from '../../../kit8/catalog/partner/partnerModel';
import { normalizeContract } from '../../../kit8/catalog/contract/contractModel';

const base = { partnerTitle: 'Acme', partnerKind: 'company' as const, isActive: true, partnerIsSupplier: true, partnerIsCustomer: false };

describe('normalizePartner and the main vendor', () => {
  it('nothing: no key at all (a partner made before is unchanged)', () => {
    const j = normalizePartner(base);
    expect('mainVendorGUID' in j).toBe(false);
    expect('mainVendorContractGUID' in j).toBe(false);
  });
  it('a vendor, a vendor + its contract: trimmed, kept', () => {
    expect(normalizePartner({ ...base, mainVendorGUID: ' vp-2 ' })).toMatchObject({ mainVendorGUID: 'vp-2' });
    const both = normalizePartner({ ...base, mainVendorGUID: 'vp-2', mainVendorContractGUID: ' vc-3 ' });
    expect(both).toMatchObject({ mainVendorGUID: 'vp-2', mainVendorContractGUID: 'vc-3' });
  });
  it('a contract without its vendor is dropped; an emptied vendor clears both', () => {
    const j = normalizePartner({ ...base, mainVendorContractGUID: 'vc-3' });
    expect('mainVendorContractGUID' in j).toBe(false);
    const cleared = normalizePartner({ ...base, mainVendorGUID: '', mainVendorContractGUID: '' });
    expect('mainVendorGUID' in cleared).toBe(false);
  });
});

describe('the contract and its optional legal entity', () => {
  const contract = (extra: Record<string, any> = {}) => normalizeContract({ contractPartyType: 'partner', contractNumber: 'S-1', contractTitle: 'Supply', contractSumBeforeVAT: 100, ...extra } as any, 'partner');
  it('without a legal entity the key is not written (as before)', () => {
    expect('legalEntityGUID' in contract()).toBe(false);
    expect('legalEntityGUID' in contract({ legalEntityGUID: '' })).toBe(false);
    expect('legalEntityGUID' in contract({ legalEntityGUID: null })).toBe(false);
  });
  it('with one it is kept', () => {
    expect(contract({ legalEntityGUID: 'le-1' })).toMatchObject({ legalEntityGUID: 'le-1' });
  });
});
