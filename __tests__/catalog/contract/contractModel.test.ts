// Tests for contractModel: calculations, validation, normalization, periods, card mapping.
import {
  CONTRACT_ENTITY,
  CONTRACT_PERIODS,
  calculateContractAmounts,
  contractOrderInList,
  contractToCard,
  contractsTable,
  normalizeContract,
  roundMoney,
  validateContract,
} from '../../../kit8/catalog/contract/contractModel';

describe('contractModel', () => {
  it('table constants & periods', () => {
    expect(contractsTable).toBe('contractTable');
    expect(CONTRACT_ENTITY).toBe('contractReusable');
    expect(CONTRACT_PERIODS.Month).toBe('Month');
    expect(CONTRACT_PERIODS.Year).toBe('Year');
    expect(CONTRACT_PERIODS.OneTime).toBe('OneTime');
  });

  it('calculateContractAmounts: calculates VAT amount and total accurately', () => {
    // 1000 EUR, 21% VAT
    const calc1 = calculateContractAmounts(1000, 21, 2);
    expect(calc1.contractSumBeforeVAT).toBe(1000);
    expect(calc1.contractVATRate).toBe(21);
    expect(calc1.contractVAT).toBe(210);
    expect(calc1.contractTotal).toBe(1210);

    // 123.45 EUR, 10% VAT
    const calc2 = calculateContractAmounts(123.45, 10, 2);
    expect(calc2.contractVAT).toBe(12.35);
    expect(calc2.contractTotal).toBe(135.80);

    // 0% VAT
    const calc3 = calculateContractAmounts(2500, 0, 2);
    expect(calc3.contractVAT).toBe(0);
    expect(calc3.contractTotal).toBe(2500);
  });

  it('roundMoney helper', () => {
    expect(roundMoney(12.3456, 2)).toBe(12.35);
    expect(roundMoney(12.3444, 2)).toBe(12.34);
    expect(roundMoney(500, 0)).toBe(500);
  });

  it('contractOrderInList: computes ascending order so newer dates come first', () => {
    const older = contractOrderInList('2026-01-01');
    const newer = contractOrderInList('2026-06-01');
    // newer should have lower negative number
    expect(newer).toBeLessThan(older);
  });

  it('normalize: calculates totals and forces 0% VAT for person contracts', () => {
    const personContract = normalizeContract({
      contractPartyType: 'person',
      contractNumber: 'EMP-01',
      contractTitle: 'Employment',
      contractStartDate: '2026-01-01',
      contractSumBeforeVAT: 3000,
      contractVATRate: 21, // should be overridden to 0 for person
    });

    expect(personContract.contractPartyType).toBe('person');
    expect(personContract.contractVATRate).toBe(0);
    expect(personContract.contractVAT).toBe(0);
    expect(personContract.contractTotal).toBe(3000);

    const partnerContract = normalizeContract({
      contractPartyType: 'partner',
      contractNumber: 'SUP-01',
      contractTitle: 'Supply',
      contractStartDate: '2026-01-01',
      contractSumBeforeVAT: 10000,
      contractVATRate: 21,
    });

    expect(partnerContract.contractVAT).toBe(2100);
    expect(partnerContract.contractTotal).toBe(12100);
  });

  it('validate: number and title required, date format, finishDate >= startDate', () => {
    expect(validateContract(normalizeContract({ contractNumber: '' })).contractNumber).toBeDefined();
    expect(validateContract(normalizeContract({ contractNumber: 'C-1', contractTitle: '' })).contractTitle).toBeDefined();

    // Invalid start date
    expect(validateContract(normalizeContract({ contractNumber: 'C-1', contractTitle: 'Test', contractStartDate: 'invalid' })).contractStartDate).toBeDefined();

    // Finish date before start date
    const invalidDates = normalizeContract({
      contractNumber: 'C-1',
      contractTitle: 'Test',
      contractStartDate: '2026-05-01',
      contractFinishDate: '2026-04-01',
    });
    expect(validateContract(invalidDates).contractFinishDate).toMatch(/cannot be before start date/);

    // Valid open-ended
    const validOpenEnded = normalizeContract({
      contractNumber: 'C-1',
      contractTitle: 'Test',
      contractStartDate: '2026-05-01',
      contractFinishDate: null,
      contractSumBeforeVAT: 1000,
    });
    expect(validateContract(validOpenEnded)).toEqual({});
  });

  it('contractToCard: formats dates, currency total with period, and status', () => {
    const card = contractToCard({
      rowGUID: 'ct-1',
      rowJSON: {
        contractNumber: 'CTR-999',
        contractTitle: 'Annual Maintenance',
        contractStartDate: '2026-01-01',
        contractFinishDate: '2026-12-31',
        contractPaymentsPeriod: 'Month',
        contractCurrency: 'EUR',
        contractTotal: 1500,
        contractStatus: 'active',
      },
    });

    expect(card.id).toBe('ct-1');
    expect(card.title).toBe('CTR-999 — Annual Maintenance');
    expect(card.description).toContain('2026-01-01 → 2026-12-31');
    expect(card.description).toContain('1,500.00 EUR/Month');
    expect(card.description).toContain('[active]');
  });
});
