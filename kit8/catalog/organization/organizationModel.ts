// Organization catalog - table + row shape + validation (pure, unit-tested).
//   SQL: public."organizationTable" (kit8/sql/init/done/create_organization_table.sql), defTable.md pattern
//   rowGUID · rowOwnerGUID = ORGANIZATION_CATALOG_OWNER · rowParentGUID = 'empty' ·
//   orderInList · rowJSON = OrganizationRowJSON · created_at / updated_at

import type { CardItem } from '../../components/list/web/lib';

/** Supabase table name (SQL: organizationTable). */
export const organizationTable = 'organizationTable';
/** SystemMetaData / redux entity key (reusableCrudSlice + reusableRootSaga). */
export const ORGANIZATION_ENTITY = 'organizationReusable';
/** rowOwnerGUID of every catalog row: shared catalog (or tenant GUID). */
export const ORGANIZATION_CATALOG_OWNER = 'organizationCatalog';

export const ORGANIZATION_ROUTES = {
  list: '/catalog/organization',
  edit: '/catalog/organization/edit',
} as const;

/** readData payload of the catalog. */
export const ORGANIZATION_READ_PARAMS = { paginationSize: 1000, originationCurrentPage: 0 };

export interface LegalData {
  registrationNo?: string;
  /** VAT No with country prefix, e.g. LV12345678901 */
  vatNo?: string;
  legalAddress?: string;
  /** ISO 3166-1 alpha-2 country code e.g. "LV", "DE", "US" */
  country?: string;
  bankIban?: string;
}

export interface OrganizationRowJSON {
  /** UI display name / trade name */
  organizationTitle: string;
  /** Official registered legal name */
  organizationLegalName?: string;
  /** Email of the user who created the organization. Only this email can edit the organization. */
  createdByUser: string;
  isActive: boolean;
  /** Selected country of residence (countryTable rowGUID or ISO-2 code) */
  countryOfResidence?: string | null;
  /** Legal registration data */
  legalData?: LegalData;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  notes?: string;
}

export interface OrganizationRow {
  rowGUID: string;
  rowOwnerGUID: string;
  rowParentGUID: string;
  orderInList: number;
  rowJSON: OrganizationRowJSON;
  created_at?: string;
  updated_at?: string;
}

export const organizationExample: OrganizationRowJSON = {
  organizationTitle: 'Universal Timber Corp',
  organizationLegalName: 'Universal Timber Corporation SIA',
  createdByUser: 'user@example.com',
  isActive: true,
  legalData: {
    registrationNo: '40003999999',
    vatNo: 'LV40003999999',
    legalAddress: 'Brivibas bulvaris 10, Riga, LV-1050',
    country: 'LV',
    bankIban: 'LV80HABA0551000009999',
  },
  contactEmail: 'info@universaltimber.com',
  contactPhone: '+371 67000000',
  website: 'https://universaltimber.com',
  notes: 'Headquarters and manufacturing organization',
};

export const emptyOrganization = (userEmail = ''): OrganizationRowJSON => ({
  organizationTitle: '',
  organizationLegalName: '',
  createdByUser: userEmail,
  isActive: true,
  countryOfResidence: 'LV',
  legalData: {
    registrationNo: '',
    vatNo: '',
    legalAddress: '',
    country: 'LV',
    bankIban: '',
  },
  contactEmail: userEmail,
  contactPhone: '',
  website: '',
  notes: '',
});

/** Normalizes fields: trims strings, strips empty legal fields. */
export function normalizeOrganization(raw: Partial<OrganizationRowJSON>): OrganizationRowJSON {
  const title = (raw.organizationTitle || '').trim();
  const legalName = (raw.organizationLegalName || '').trim();
  const createdByUser = (raw.createdByUser || '').trim().toLowerCase();
  const isActive = raw.isActive !== false;
  const leg = raw.legalData || {};
  const countryOfResidence = (raw.countryOfResidence || leg.country || 'LV').trim();

  const cleanLegal: LegalData = {};
  if (leg.registrationNo?.trim()) cleanLegal.registrationNo = leg.registrationNo.trim();
  if (leg.vatNo?.trim()) cleanLegal.vatNo = leg.vatNo.trim().toUpperCase();
  if (leg.legalAddress?.trim()) cleanLegal.legalAddress = leg.legalAddress.trim();
  if (countryOfResidence) cleanLegal.country = countryOfResidence.toUpperCase();
  else if (leg.country?.trim()) cleanLegal.country = leg.country.trim().toUpperCase();
  if (leg.bankIban?.trim()) cleanLegal.bankIban = leg.bankIban.trim().replace(/\s+/g, '').toUpperCase();

  return {
    organizationTitle: title,
    ...(legalName ? { organizationLegalName: legalName } : {}),
    createdByUser,
    isActive,
    countryOfResidence,
    ...(Object.keys(cleanLegal).length > 0 ? { legalData: cleanLegal } : {}),
    ...(raw.contactEmail?.trim() ? { contactEmail: raw.contactEmail.trim().toLowerCase() } : {}),
    ...(raw.contactPhone?.trim() ? { contactPhone: raw.contactPhone.trim() } : {}),
    ...(raw.website?.trim() ? { website: raw.website.trim() } : {}),
    ...(raw.notes?.trim() ? { notes: raw.notes.trim() } : {}),
  };
}

export type OrganizationErrors = Partial<Record<keyof OrganizationRowJSON | 'registrationNo' | 'vatNo', string>>;

/** Validates organization before save. */
export function validateOrganization(raw: Partial<OrganizationRowJSON>): { valid: boolean; errors: OrganizationErrors } {
  const errors: OrganizationErrors = {};
  const title = (raw.organizationTitle || '').trim();
  if (!title) {
    errors.organizationTitle = 'Organization title is required';
  } else if (title.length < 2) {
    errors.organizationTitle = 'Title must be at least 2 characters';
  }

  const createdByUser = (raw.createdByUser || '').trim();
  if (!createdByUser) {
    errors.createdByUser = 'Creator email is required';
  }

  const vat = raw.legalData?.vatNo?.trim();
  if (vat && !/^[A-Z]{2}[0-9A-Za-z]{2,14}$/.test(vat.toUpperCase())) {
    errors.vatNo = 'VAT number should start with a 2-letter country code (e.g. LV12345678901)';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** Check if given userEmail has permission to edit this organization. */
export function canEditOrganization(org: OrganizationRow | OrganizationRowJSON | null | undefined, userEmail: string | null | undefined): boolean {
  if (!org || !userEmail) return false;
  const createdByUser = 'rowJSON' in org ? org.rowJSON?.createdByUser : org.createdByUser;
  if (!createdByUser) return true; // fallback if unassigned
  return createdByUser.trim().toLowerCase() === userEmail.trim().toLowerCase();
}

/** Maps an OrganizationRow to a CardItem for ListWebCardsComponent. */
export function organizationToCard(row: OrganizationRow, index = 0): CardItem {
  const json = row.rowJSON || ({} as OrganizationRowJSON);
  const title = json.organizationTitle || 'Untitled Organization';
  const subtitle = [
    json.organizationLegalName,
    json.legalData?.country ? `[${json.legalData.country}]` : null,
    json.createdByUser ? `Created by: ${json.createdByUser}` : null,
  ].filter(Boolean).join(' · ');

  return {
    id: row.rowGUID,
    title,
    description: subtitle || json.contactEmail || 'No details',
    orderInList: row.orderInList ?? index,
    rawItem: row,
  };
}
