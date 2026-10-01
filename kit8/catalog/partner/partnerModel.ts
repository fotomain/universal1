// Partner catalog - table + row shape + validation (pure, unit-tested).
//   SQL: public."partnerTable" (kit8/sql/init/create_partner_table.sql), defTable.md pattern
//   rowGUID · rowOwnerGUID = PARTNER_CATALOG_OWNER · rowParentGUID = 'empty' ·
//   orderInList · rowJSON = PartnerRowJSON · created_at / updated_at

/** Supabase table name (SQL: partnerTable). */
export const partnersTable = 'partnerTable';
/** SystemMetaData / redux entity key (reusableCrudSlice + reusableRootSaga). */
export const PARTNER_ENTITY = 'partnerReusable';
/** rowOwnerGUID of every catalog row: shared catalog (or tenant GUID). */
export const PARTNER_CATALOG_OWNER = 'partnerCatalog';

export const PARTNER_ROUTES = { list: '/catalog/partner/list', edit: '/catalog/partner/edit' } as const;

/** readData payload of the catalog. */
export const PARTNER_READ_PARAMS = { paginationSize: 1000, originationCurrentPage: 0 };

export interface LegalData {
  registrationNo?: string;
  /** VAT No with country prefix, e.g. LV12345678901 */
  vatNo?: string;
  legalAddress?: string;
  /** ISO 3166-1 alpha-2 country code e.g. "LV", "DE", "US" */
  country?: string;
  bankIban?: string;
}

export interface SupplierData {
  paymentTermsDays?: number;
  defaultCurrency?: string;
  notes?: string;
}

export interface CustomerData {
  paymentTermsDays?: number;
  creditLimit?: number;
  defaultCurrency?: string;
  discountPercent?: number;
}

export interface PartnerRowJSON {
  /** UI display name / brand */
  partnerTitle: string;
  /** Official registered legal name */
  partnerLegalName?: string;
  /** 'company' | 'individual' */
  partnerKind: 'company' | 'individual';
  isActive: boolean;
  /** Independent boolean flag: true if vendor/supplier */
  partnerIsSupplier: boolean;
  /** Independent boolean flag: true if client/customer */
  partnerIsCustomer: boolean;
  /** Shared legal registration data (validated if supplier or customer is true) */
  legalData?: LegalData;
  /** Supplier specific commercial terms */
  supplierData?: SupplierData;
  /** Customer specific commercial terms */
  customerData?: CustomerData;
}

export interface PartnerRow {
  rowGUID: string;
  rowOwnerGUID: string;
  rowParentGUID: string;
  orderInList: number;
  rowJSON: PartnerRowJSON;
  created_at?: string;
  updated_at?: string;
}

export const partnerExample: PartnerRowJSON = {
  partnerTitle: 'Acme Logistics',
  partnerLegalName: 'Acme Logistics SIA',
  partnerKind: 'company',
  isActive: true,
  partnerIsSupplier: true,
  partnerIsCustomer: false,
  legalData: {
    registrationNo: '40003000111',
    vatNo: 'LV40003000111',
    legalAddress: 'Brivibas iela 1, Riga, LV-1010',
    country: 'LV',
    bankIban: 'LV80HABA0551000000000',
  },
  supplierData: {
    paymentTermsDays: 14,
    defaultCurrency: 'EUR',
    notes: 'Primary freight partner',
  },
  customerData: {
    paymentTermsDays: 30,
    creditLimit: 10000,
    defaultCurrency: 'EUR',
    discountPercent: 5,
  },
};

export const emptyPartner = (): PartnerRowJSON => ({
  partnerTitle: '',
  partnerLegalName: '',
  partnerKind: 'company',
  isActive: true,
  partnerIsSupplier: false,
  partnerIsCustomer: false,
  legalData: {
    registrationNo: '',
    vatNo: '',
    legalAddress: '',
    country: '',
    bankIban: '',
  },
  supplierData: {
    paymentTermsDays: 14,
    defaultCurrency: 'EUR',
    notes: '',
  },
  customerData: {
    paymentTermsDays: 30,
    creditLimit: 0,
    defaultCurrency: 'EUR',
    discountPercent: 0,
  },
});

/** Form values -> stored shape. */
export function normalizePartner(v: Partial<PartnerRowJSON>): PartnerRowJSON {
  const title = String(v.partnerTitle ?? '').trim();
  const legalName = String(v.partnerLegalName ?? '').trim();
  const rawLegal = v.legalData || {};
  const rawSupp = v.supplierData || {};
  const rawCust = v.customerData || {};

  const legalData: LegalData = {
    registrationNo: String(rawLegal.registrationNo ?? '').trim(),
    vatNo: String(rawLegal.vatNo ?? '').trim().toUpperCase(),
    legalAddress: String(rawLegal.legalAddress ?? '').trim(),
    country: String(rawLegal.country ?? '').trim().toUpperCase(),
    bankIban: String(rawLegal.bankIban ?? '').trim().toUpperCase(),
  };

  const supplierData: SupplierData = {
    paymentTermsDays: Number.isFinite(Number(rawSupp.paymentTermsDays)) ? Math.max(0, Math.round(Number(rawSupp.paymentTermsDays))) : 14,
    defaultCurrency: String(rawSupp.defaultCurrency ?? 'EUR').trim().toUpperCase(),
    notes: String(rawSupp.notes ?? '').trim(),
  };

  const customerData: CustomerData = {
    paymentTermsDays: Number.isFinite(Number(rawCust.paymentTermsDays)) ? Math.max(0, Math.round(Number(rawCust.paymentTermsDays))) : 30,
    creditLimit: Number.isFinite(Number(rawCust.creditLimit)) ? Math.max(0, Number(rawCust.creditLimit)) : 0,
    defaultCurrency: String(rawCust.defaultCurrency ?? 'EUR').trim().toUpperCase(),
    discountPercent: Number.isFinite(Number(rawCust.discountPercent)) ? Math.min(100, Math.max(0, Number(rawCust.discountPercent))) : 0,
  };

  return {
    partnerTitle: title || legalName,
    partnerLegalName: legalName,
    partnerKind: v.partnerKind === 'individual' ? 'individual' : 'company',
    isActive: v.isActive !== false,
    partnerIsSupplier: Boolean(v.partnerIsSupplier),
    partnerIsCustomer: Boolean(v.partnerIsCustomer),
    legalData,
    supplierData,
    customerData,
  };

}

export type PartnerErrors = {
  [K in keyof PartnerRowJSON]?: string;
} & {
  registrationNo?: string;
  vatNo?: string;
  legalAddress?: string;
  country?: string;
  bankIban?: string;
};

/** Validate partner fields. Uniqueness check on registrationNo and vatNo. */
export function validatePartner(v: PartnerRowJSON, rows: Pick<PartnerRow, 'rowGUID' | 'rowJSON'>[] = [], rowGUID?: string | null): PartnerErrors {
  const e: PartnerErrors = {};
  if (!v.partnerTitle) e.partnerTitle = 'Partner title is required.';

  const isLegalRequired = v.partnerIsSupplier || v.partnerIsCustomer;
  const regNo = v.legalData?.registrationNo?.trim();
  const vatNo = v.legalData?.vatNo?.trim();

  if (isLegalRequired) {
    if (!regNo && !vatNo) {
      e.registrationNo = 'Registration number or VAT number is required.';
    }
  }

  if (vatNo) {
    // VAT format check: 2 letter country prefix + alphanumeric characters (e.g. LV12345678901, DE123456789)
    if (!/^[A-Z]{2}[A-Z0-9]{2,14}$/.test(vatNo)) {
      e.vatNo = 'VAT No must start with 2-letter country code (e.g. LV40003000111).';
    } else {
      // Uniqueness check
      const duplicateVat = rows.some((r) => r.rowGUID !== rowGUID && r.rowJSON?.legalData?.vatNo?.toUpperCase() === vatNo.toUpperCase());
      if (duplicateVat) {
        e.vatNo = `VAT No ${vatNo} is already registered to another partner.`;
      }
    }
  }

  if (regNo) {
    const duplicateReg = rows.some((r) => r.rowGUID !== rowGUID && r.rowJSON?.legalData?.registrationNo === regNo);
    if (duplicateReg) {
      e.registrationNo = `Registration No ${regNo} is already in the catalog.`;
    }
  }

  return e;
}

/** Row -> card of ListWebCardsComponent. */
export function partnerToCard(row: any, idx = 0) {
  const j: Partial<PartnerRowJSON> = row?.rowJSON || {};
  const chips: string[] = [];
  if (j.partnerIsSupplier) chips.push('Supplier');
  if (j.partnerIsCustomer) chips.push('Customer');
  if (j.legalData?.vatNo) chips.push(`VAT ${j.legalData.vatNo}`);
  else if (j.legalData?.registrationNo) chips.push(`Reg ${j.legalData.registrationNo}`);
  if (j.isActive === false) chips.push('inactive');

  return {
    id: row?.rowGUID || `partner-${idx + 1}`,
    title: j.partnerTitle || j.partnerLegalName || 'Unnamed Partner',
    description: chips.filter(Boolean).join(' · '),
    orderInList: row?.orderInList,
    rawItem: row,
  };
}
