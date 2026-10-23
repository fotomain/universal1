// The payment plan keys of the CONTRACT (shift, outbound / inbound budget item) and of the PARTNER payment terms (shift): optional, kept by the normalizers, dropped when empty.
import { contractPaymentBudgetItem, contractPaymentDirections, contractPaymentShift, isContractPaymentBudgetItem, normalizeContractPayment } from '../../../../../kit8/catalog/contract/contractPaymentModel';
import { emptyContract, normalizeContract } from '../../../../../kit8/catalog/contract/contractModel';
import { emptyPartner, normalizePartner, partnerPaymentShift } from '../../../../../kit8/catalog/partner/partnerModel';

describe('the contract: which directions it can pay', () => {
  it('a person is only paid; a partner by its role flags, no flag = both', () => {
    expect(contractPaymentDirections({ contractPartyType: 'person', supplierRole: true, customerRole: true })).toEqual(['outbound']);
    expect(contractPaymentDirections({ contractPartyType: 'partner', supplierRole: true })).toEqual(['outbound']);
    expect(contractPaymentDirections({ contractPartyType: 'partner', customerRole: true })).toEqual(['inbound']);
    expect(contractPaymentDirections({ contractPartyType: 'partner', supplierRole: true, customerRole: true })).toEqual(['outbound', 'inbound']);
    expect(contractPaymentDirections({ contractPartyType: 'partner' })).toEqual(['outbound', 'inbound']);
  });
  it('the items offered are the items of the payments genus (A1: TWO budget items, one per direction)', () => {
    expect(isContractPaymentBudgetItem('outbound', { rowJSON: { managementGenusItem: 'outboundPaymentGenus' } })).toBe(true);
    expect(isContractPaymentBudgetItem('inbound', { rowJSON: { managementGenusItem: 'outboundPaymentGenus' } })).toBe(false);
  });
});

describe('the contract keys are kept by normalizeContract (or the form would drop them on save)', () => {
  const form = (over: any) => ({ ...emptyContract('partner'), contractNumber: 'N1', contractTitle: 'T', ...over });
  it('the shift (0 is a value) and the item(s) of the roles of the contract', () => {
    const n = normalizeContract(form({ supplierRole: true, customerRole: true, paymentTimelineShiftDays: 0, paymentBudgetItemOutbound: 'bi_out', paymentBudgetItemInbound: 'bi_in' }));
    expect(n.paymentTimelineShiftDays).toBe(0);
    expect(n.paymentBudgetItemOutbound).toBe('bi_out');
    expect(n.paymentBudgetItemInbound).toBe('bi_in');
  });
  it('a key that is empty is not written; an item of a role the contract does not have is dropped', () => {
    const n = normalizeContract(form({ supplierRole: true, paymentBudgetItemOutbound: '', paymentBudgetItemInbound: 'bi_in' }));
    expect('paymentTimelineShiftDays' in n).toBe(false);
    expect('paymentBudgetItemOutbound' in n).toBe(false);
    expect('paymentBudgetItemInbound' in n).toBe(false);
  });
  it('a PERSON contract keeps the outbound item only; a negative shift is dropped', () => {
    const n = normalizeContract({ ...emptyContract('person'), contractNumber: 'P1', contractTitle: 'T', paymentBudgetItemOutbound: 'bi_out2', paymentBudgetItemInbound: 'bi_in', paymentTimelineShiftDays: -3 });
    expect(n.paymentBudgetItemOutbound).toBe('bi_out2');
    expect('paymentBudgetItemInbound' in n).toBe(false);
    expect('paymentTimelineShiftDays' in n).toBe(false);
  });
  it('the readers', () => {
    expect(contractPaymentShift({ paymentTimelineShiftDays: 12 })).toBe(12);
    expect(contractPaymentShift({ paymentTimelineShiftDays: '' })).toBeNull();
    expect(contractPaymentShift({})).toBeNull();
    expect(contractPaymentBudgetItem({ paymentBudgetItemInbound: 'x' }, 'inbound')).toBe('x');
    expect(contractPaymentBudgetItem({ paymentBudgetItemInbound: 'x' }, 'outbound')).toBeNull();
    expect(normalizeContractPayment({ paymentTimelineShiftDays: 5 }, { contractPartyType: 'partner' })).toEqual({ paymentTimelineShiftDays: 5 });
  });
});

describe('the partner payment terms: the optional paymentTimelineShiftDays next to paymentTermsDays', () => {
  it('kept in the supplier and the customer data (0 is a value), not written when empty or negative', () => {
    const n = normalizePartner({ ...emptyPartner(), supplierData: { paymentTermsDays: 14, paymentTimelineShiftDays: 0 }, customerData: { paymentTermsDays: 30, paymentTimelineShiftDays: 12.4 } });
    expect(n.supplierData?.paymentTimelineShiftDays).toBe(0);
    expect(n.customerData?.paymentTimelineShiftDays).toBe(12);
    expect(n.supplierData?.paymentTermsDays).toBe(14);
    const e = normalizePartner({ ...emptyPartner(), supplierData: { paymentTermsDays: 14, paymentTimelineShiftDays: undefined }, customerData: { paymentTermsDays: 30, paymentTimelineShiftDays: -1 } });
    expect('paymentTimelineShiftDays' in (e.supplierData || {})).toBe(false);
    expect('paymentTimelineShiftDays' in (e.customerData || {})).toBe(false);
  });
  it('Outbound reads the supplier data, Inbound the customer data', () => {
    const j = { supplierData: { paymentTimelineShiftDays: 21 }, customerData: { paymentTimelineShiftDays: 12 } } as any;
    expect(partnerPaymentShift(j, 'outbound')).toBe(21);
    expect(partnerPaymentShift(j, 'inbound')).toBe(12);
    expect(partnerPaymentShift({} as any, 'outbound')).toBeNull();
  });
});
