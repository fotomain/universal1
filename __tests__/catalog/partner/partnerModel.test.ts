// Tests for partnerModel: table name, normalize, validate, uniqueness, card mapping.
import {
  PARTNER_CATALOG_OWNER,
  PARTNER_ENTITY,
  normalizePartner,
  partnerToCard,
  partnersTable,
  validatePartner,
} from '../../../kit8/catalog/partner/partnerModel';

describe('partnerModel', () => {
  it('table constants', () => {
    expect(partnersTable).toBe('partnerTable');
    expect(PARTNER_ENTITY).toBe('partnerReusable');
    expect(PARTNER_CATALOG_OWNER).toBe('partnerCatalog');
  });

  it('normalize: trims, sets defaults for supplier and customer data', () => {
    const normalized = normalizePartner({
      partnerTitle: ' Acme Corp ',
      partnerLegalName: ' Acme Corporation SIA ',
      partnerKind: 'company',
      partnerIsSupplier: true,
      partnerIsCustomer: true,
      legalData: {
        registrationNo: ' 40003000123 ',
        vatNo: ' lv40003000123 ',
      },
      supplierData: {
        paymentTermsDays: 15,
        defaultCurrency: ' eur ',
      },
      customerData: {
        creditLimit: 50000,
        discountPercent: 10,
      },
    });

    expect(normalized.partnerTitle).toBe('Acme Corp');
    expect(normalized.partnerLegalName).toBe('Acme Corporation SIA');
    expect(normalized.legalData?.vatNo).toBe('LV40003000123');
    expect(normalized.legalData?.registrationNo).toBe('40003000123');
    expect(normalized.supplierData?.paymentTermsDays).toBe(15);
    expect(normalized.supplierData?.defaultCurrency).toBe('EUR');
    expect(normalized.customerData?.creditLimit).toBe(50000);
    expect(normalized.customerData?.discountPercent).toBe(10);
  });

  it('validate: title required, legal data required if supplier or customer, VAT format & uniqueness', () => {
    expect(validatePartner(normalizePartner({ partnerTitle: '' })).partnerTitle).toBeDefined();

    // Supplier without legal data
    const supplierWithoutLegal = normalizePartner({
      partnerTitle: 'Supplier Co',
      partnerIsSupplier: true,
      legalData: { registrationNo: '', vatNo: '' },
    });
    expect(validatePartner(supplierWithoutLegal).registrationNo).toBeDefined();

    // Invalid VAT format
    const invalidVat = normalizePartner({
      partnerTitle: 'Supplier Co',
      partnerIsSupplier: true,
      legalData: { vatNo: '123' },
    });
    expect(validatePartner(invalidVat).vatNo).toMatch(/country code/);

    // Valid VAT format
    const validSupplier = normalizePartner({
      partnerTitle: 'Supplier Co',
      partnerIsSupplier: true,
      legalData: { vatNo: 'LV40003000123' },
    });
    expect(validatePartner(validSupplier)).toEqual({});

    // Duplicate VAT check
    const existingRows = [
      {
        rowGUID: 'other-id',
        rowJSON: {
          partnerTitle: 'Other Co',
          legalData: { vatNo: 'LV40003000123' },
        } as any,
      },
    ];
    expect(validatePartner(validSupplier, existingRows, null).vatNo).toMatch(/already registered/);
    // Editing same record should pass
    expect(validatePartner(validSupplier, existingRows, 'other-id')).toEqual({});
  });

  it('partnerToCard: chips for Supplier, Customer, VAT, inactive', () => {
    const card = partnerToCard({
      rowGUID: 'part-1',
      orderInList: 1,
      rowJSON: {
        partnerTitle: 'Timber Co',
        partnerIsSupplier: true,
        partnerIsCustomer: true,
        legalData: { vatNo: 'LV40001234567' },
        isActive: false,
      },
    });

    expect(card.id).toBe('part-1');
    expect(card.title).toBe('Timber Co');
    expect(card.description).toContain('Supplier');
    expect(card.description).toContain('Customer');
    expect(card.description).toContain('VAT LV40001234567');
    expect(card.description).toContain('inactive');
  });
});
