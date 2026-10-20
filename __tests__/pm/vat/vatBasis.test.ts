// The VAT basis (kit8/pm/vat, documentation/VENDOR_INVOICE_DOC.html sections 3 and 14): one function, three bases, one remembered choice.
import { VAT_BASES, VAT_BASIS_DEFAULT, VAT_BASIS_SHORT, VAT_BASIS_TITLE, amountOfVatBasis, isVatBasis } from '../../../kit8/pm/vat/vatBasis';
import { getVatBasis, resetVatBasisForTest, setVatBasis } from '../../../kit8/pm/vat/useVatBasis';

describe('amountOfVatBasis', () => {
  it('cost = net + the VAT that is cost; net = net; gross = net + all the VAT', () => {
    expect(amountOfVatBasis(100, 21, 5, 'cost')).toBe(105);
    expect(amountOfVatBasis(100, 21, 5, 'net')).toBe(100);
    expect(amountOfVatBasis(100, 21, 5, 'gross')).toBe(121);
  });
  it('the default basis is Cost, and while all VAT is recoverable (nothing is cost) it equals Net', () => {
    expect(VAT_BASIS_DEFAULT).toBe('cost');
    expect(amountOfVatBasis(480, 100.8, 0)).toBe(480);
  });
  it('a missing part counts as 0; strings from the database are numbers; the result is rounded to the cent', () => {
    expect(amountOfVatBasis(undefined, undefined, undefined, 'gross')).toBe(0);
    expect(amountOfVatBasis('10.10', '2.12', null, 'gross')).toBe(12.22);
    expect(amountOfVatBasis(0.1, 0.2, 0, 'gross')).toBe(0.3);
  });
  it('the three bases have a name each; the guard knows them', () => {
    expect(VAT_BASES).toEqual(['cost', 'net', 'gross']);
    expect(VAT_BASES.map((b) => VAT_BASIS_SHORT[b])).toEqual(['Cost', 'Net', 'With VAT']);
    expect(VAT_BASIS_TITLE.cost).toMatch(/non-recoverable/);
    expect(isVatBasis('gross')).toBe(true);
    expect(isVatBasis('with')).toBe(false);
  });
});

describe('the remembered choice', () => {
  beforeEach(() => resetVatBasisForTest());
  it('starts with the default and follows setVatBasis', () => {
    expect(getVatBasis()).toBe('cost');
    setVatBasis('gross', false);
    expect(getVatBasis()).toBe('gross');
  });
});
