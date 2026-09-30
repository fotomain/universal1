// Contract catalog - table + row shape + validation + calculation
//   SQL: public."contractTable" (kit8/sql/init/create_contract_table.sql), defTable.md pattern
//   rowGUID · rowOwnerGUID (personGUID or partnerGUID) · rowParentGUID ('person' or 'partner') ·
//   orderInList -(days since 1970-01-01) · rowJSON = ContractRowJSON · created_at / updated_at

/** Supabase table name (SQL: contractTable). */
export const contractsTable = 'contractTable';
/** SystemMetaData / redux entity key (reusableCrudSlice + reusableRootSaga). */
export const CONTRACT_ENTITY = 'contractReusable';

export const CONTRACT_PERIODS = {
  OneTime: 'OneTime',
  Day: 'Day',
  Week: 'Week',
  Month: 'Month',
  Quarter: 'Quarter',
  Year: 'Year',
} as const;

export type ContractPeriodType = keyof typeof CONTRACT_PERIODS;

export const CONTRACT_STATUSES = {
  draft: 'Draft',
  active: 'Active',
  finished: 'Finished',
  terminated: 'Terminated',
} as const;

export type ContractStatusType = keyof typeof CONTRACT_STATUSES;

export interface ContractRowJSON {
  /** 'person' | 'partner' */
  contractPartyType: 'person' | 'partner';
  /** Contract reference / agreement code */
  contractNumber: string;
  /** Descriptive title */
  contractTitle: string;
  /** Contract category / classification (e.g. employment, service, supply, nda) */
  contractType: string;
  /** Lifecycle status */
  contractStatus: ContractStatusType;
  /** Date signed (YYYY-MM-DD) */
  contractSignedDate?: string;
  /** Effective start date (YYYY-MM-DD) */
  contractStartDate: string;
  /** Expiration / finish date (YYYY-MM-DD), null or empty for open-ended */
  contractFinishDate?: string | null;
  /** Payment frequency */
  contractPaymentsPeriod: ContractPeriodType;
  /** ISO 4217 currency code e.g. "EUR" */
  contractCurrency: string;
  /** Amount before VAT per payment period */
  contractSumBeforeVAT: number;
  /** VAT rate in percent (e.g. 0, 10, 21) */
  contractVATRate: number;
  /** VAT amount = round(contractSumBeforeVAT * contractVATRate / 100, decimalDigits) */
  contractVAT: number;
  /** Total = round(contractSumBeforeVAT + contractVAT, decimalDigits) */
  contractTotal: number;
  /** Additional notes or comments */
  notes?: string;
}

export interface ContractRow {
  rowGUID: string;
  /** person.rowGUID or partner.rowGUID */
  rowOwnerGUID: string;
  /** 'person' or 'partner' */
  rowParentGUID: string;
  orderInList: number;
  rowJSON: ContractRowJSON;
  created_at?: string;
  updated_at?: string;
}

/** Compute orderInList from contractStartDate (newest date first -> lowest negative number). */
export function contractOrderInList(dateStr: string): number {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 0;
  const d = new Date(`${dateStr}T00:00:00Z`);
  const days = Math.floor(d.getTime() / 86400000);
  return -days;
}

/** Round a money value to given decimal digits (default 2). */
export function roundMoney(amount: number, decimalDigits = 2): number {
  if (!Number.isFinite(amount)) return 0;
  const factor = Math.pow(10, Math.max(0, Math.min(4, decimalDigits)));
  return Math.round(amount * factor) / factor;
}

/** Auto-calculate VAT and Total from sum before VAT and VAT rate %. */
export function calculateContractAmounts(sumBeforeVAT: number, vatRate: number, decimalDigits = 2) {
  const sum = Number.isFinite(sumBeforeVAT) ? Math.max(0, sumBeforeVAT) : 0;
  const rate = Number.isFinite(vatRate) ? Math.max(0, vatRate) : 0;
  const vat = roundMoney((sum * rate) / 100, decimalDigits);
  const total = roundMoney(sum + vat, decimalDigits);
  return {
    contractSumBeforeVAT: sum,
    contractVATRate: rate,
    contractVAT: vat,
    contractTotal: total,
  };
}

export const emptyContract = (partyType: 'person' | 'partner' = 'partner', defaultCurrency = 'EUR'): ContractRowJSON => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    contractPartyType: partyType,
    contractNumber: '',
    contractTitle: '',
    contractType: partyType === 'person' ? 'Employment' : 'Service',
    contractStatus: 'active',
    contractSignedDate: today,
    contractStartDate: today,
    contractFinishDate: null,
    contractPaymentsPeriod: 'Month',
    contractCurrency: defaultCurrency,
    contractSumBeforeVAT: 0,
    contractVATRate: partyType === 'person' ? 0 : 21,
    contractVAT: 0,
    contractTotal: 0,
    notes: '',
  };
};

/** Form values -> normalized stored shape. */
export function normalizeContract(v: Partial<ContractRowJSON>, decimalDigits = 2): ContractRowJSON {
  const partyType: 'person' | 'partner' = v.contractPartyType === 'person' ? 'person' : 'partner';
  const sum = Number(v.contractSumBeforeVAT ?? 0);
  const rate = partyType === 'person' ? 0 : Number(v.contractVATRate ?? 0);
  const { contractSumBeforeVAT, contractVATRate, contractVAT, contractTotal } = calculateContractAmounts(sum, rate, decimalDigits);

  const startDate = String(v.contractStartDate ?? '').trim();
  const finishDate = v.contractFinishDate ? String(v.contractFinishDate).trim() : null;

  return {
    contractPartyType: partyType,
    contractNumber: String(v.contractNumber ?? '').trim(),
    contractTitle: String(v.contractTitle ?? '').trim(),
    contractType: String(v.contractType ?? (partyType === 'person' ? 'Employment' : 'Service')).trim(),
    contractStatus: (v.contractStatus && v.contractStatus in CONTRACT_STATUSES ? v.contractStatus : 'active') as ContractStatusType,
    contractSignedDate: v.contractSignedDate ? String(v.contractSignedDate).trim() : undefined,
    contractStartDate: startDate,
    contractFinishDate: finishDate || null,
    contractPaymentsPeriod: (v.contractPaymentsPeriod && v.contractPaymentsPeriod in CONTRACT_PERIODS ? v.contractPaymentsPeriod : 'Month') as ContractPeriodType,
    contractCurrency: String(v.contractCurrency ?? 'EUR').trim().toUpperCase() || 'EUR',
    contractSumBeforeVAT,
    contractVATRate,
    contractVAT,
    contractTotal,
    notes: String(v.notes ?? '').trim(),
  };
}

export type ContractErrors = Partial<Record<keyof ContractRowJSON, string>>;

/** Validate contract fields. */
export function validateContract(v: ContractRowJSON): ContractErrors {
  const e: ContractErrors = {};
  if (!v.contractNumber) e.contractNumber = 'Contract number is required.';
  if (!v.contractTitle) e.contractTitle = 'Contract title is required.';
  if (!v.contractStartDate || !/^\d{4}-\d{2}-\d{2}$/.test(v.contractStartDate)) {
    e.contractStartDate = 'Valid start date (YYYY-MM-DD) is required.';
  }
  if (v.contractFinishDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.contractFinishDate)) {
      e.contractFinishDate = 'Finish date must be YYYY-MM-DD.';
    } else if (v.contractStartDate && v.contractFinishDate < v.contractStartDate) {
      e.contractFinishDate = 'Finish date cannot be before start date.';
    }
  }
  if (v.contractSignedDate && !/^\d{4}-\d{2}-\d{2}$/.test(v.contractSignedDate)) {
    e.contractSignedDate = 'Signed date must be YYYY-MM-DD.';
  }
  if (!/^[A-Z]{3}$/.test(v.contractCurrency)) {
    e.contractCurrency = 'Currency must be 3-letter ISO code.';
  }
  if (!Number.isFinite(v.contractSumBeforeVAT) || v.contractSumBeforeVAT < 0) {
    e.contractSumBeforeVAT = 'Sum must be 0 or greater.';
  }
  if (!Number.isFinite(v.contractVATRate) || v.contractVATRate < 0 || v.contractVATRate > 100) {
    e.contractVATRate = 'VAT rate must be between 0% and 100%.';
  }
  return e;
}

/** Map contract row to card presentation for list tiles. */
export function contractToCard(row: any, idx = 0) {
  const j: Partial<ContractRowJSON> = row?.rowJSON || {};
  const dates = [j.contractStartDate, j.contractFinishDate ? j.contractFinishDate : 'open-ended'].filter(Boolean).join(' → ');
  const sumStr = `${(j.contractTotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${j.contractCurrency || 'EUR'}`;
  const periodStr = j.contractPaymentsPeriod ? `/${j.contractPaymentsPeriod}` : '';

  return {
    id: row?.rowGUID || `contract-${idx + 1}`,
    title: `${j.contractNumber || 'No #'} — ${j.contractTitle || 'Untitled'}`,
    description: [dates, `${sumStr}${periodStr}`, j.contractStatus ? `[${j.contractStatus}]` : ''].filter(Boolean).join(' · '),
    orderInList: row?.orderInList,
    rawItem: row,
  };
}
