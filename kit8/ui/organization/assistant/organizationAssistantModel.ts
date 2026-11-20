// organizationAssistantModel - the questions of the Create Organization Assistant (pure, unit-tested; the screen is CreateOrganizationAssistant.tsx).
// The order of an administrator: who the organization is -> its legal data -> the money (the currencies every NEW project starts from + the one currency of the consolidation) ->
// how strict the resource calendars are -> review. The end is ONE new organizationTable row (the creator becomes its administrator member, SQL PART 45).
import { CAPACITY_MODES, DEFAULT_CAPACITY_MODE, isCapacityMode, type CapacityMode } from '../../../pm/view/task/plan/busyControl';
import { ORGANIZATION_CATALOG_OWNER, normalizeOrganization, validateOrganization, type OrganizationRowJSON } from '../../../catalog/organization/organizationModel';
import { isCurrencyCode, normalizeCurrency, type AssistantNote } from '../../project/assistant/model/assistantModel';

export type OrgAssistantStepId = 'identity' | 'legal' | 'currencies' | 'resources' | 'review';

export interface OrgAssistantValues {
  organizationTitle: string;
  organizationLegalName: string;
  /** ISO 3166-1 alpha-2 */
  countryOfResidence: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
  notes: string;
  registrationNo: string;
  vatNo: string;
  legalAddress: string;
  bankIban: string;
  /** the defaults of a NEW project of the organization (each project owns its currencies afterwards) */
  currencyForBudget: string;
  currencyForAccounting: string;
  currencyForContract: string;
  /** the obligatory currency in which the money of ALL projects is added (SQL PART 52) */
  currencyForConsolidation: string;
  resourceCapacityStrongMode: CapacityMode;
}

export interface OrgAssistantContext {
  /** the titles of the organizations the user already sees (a duplicate title is a warning) */
  existingTitles: string[];
}

export interface OrgAssistantStepDef {
  id: OrgAssistantStepId;
  title: string;
  /** the expert advice of the step: why it is asked now */
  tip: string;
}

export const ORG_ASSISTANT_STEPS: OrgAssistantStepDef[] = [
  { id: 'identity', title: 'The organization', tip: 'Start with who it is: the name people will pick in the Organization filter, the registered legal name and a contact. Everything else can be changed later in Organization edit.' },
  { id: 'legal', title: 'Legal data', tip: 'The registration and VAT numbers go on documents and invoices. Fill what you have now - none of it blocks the next step except a VAT number that is not in the form LV12345678901.' },
  { id: 'currencies', title: 'Currencies', tip: 'Three currencies are the defaults of every NEW project (budget, accounting, contracts); each project owns its own afterwards. The consolidation currency is the ONE currency in which the money of all projects is added - choose it carefully, changing it later recalculates every project.' },
  { id: 'resources', title: 'Resource calendars', tip: 'Resources (people, equipment) are shared by all projects of the organization. Decide what a Post does when a resource is booked above its calendar: nothing, a warning, or a refusal.' },
  { id: 'review', title: 'Review', tip: 'Check the answers. Create organization saves it, makes it your active organization and asks what to do next.' },
];
export const ORG_ASSISTANT_STEP_IDS: OrgAssistantStepId[] = ORG_ASSISTANT_STEPS.map((s) => s.id);
export const orgAssistantStepDefOf = (id: OrgAssistantStepId): OrgAssistantStepDef => ORG_ASSISTANT_STEPS.find((s) => s.id === id) as OrgAssistantStepDef;

/** the currencies of an organization the database makes at the first login (organization_for_email): budget USD, accounting EUR, contracts GBP, consolidation USD */
export function defaultOrgAssistantValues(userEmail: string = ''): OrgAssistantValues {
  return {
    organizationTitle: '',
    organizationLegalName: '',
    countryOfResidence: 'LV',
    contactEmail: userEmail.trim().toLowerCase(),
    contactPhone: '',
    website: '',
    notes: '',
    registrationNo: '',
    vatNo: '',
    legalAddress: '',
    bankIban: '',
    currencyForBudget: 'USD',
    currencyForAccounting: 'EUR',
    currencyForContract: 'GBP',
    currencyForConsolidation: 'USD',
    resourceCapacityStrongMode: DEFAULT_CAPACITY_MODE,
  };
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const VAT_RE = /^[A-Z]{2}[0-9A-Za-z]{2,14}$/;
const IBAN_RE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/;
const COUNTRY_RE = /^[A-Za-z]{2}$/;

/** the notes of ONE step: an error blocks Next, a warning / info only advises */
export function orgStepNotes(id: OrgAssistantStepId, v: OrgAssistantValues, ctx: OrgAssistantContext): AssistantNote[] {
  const notes: AssistantNote[] = [];
  const add = (level: AssistantNote['level'], text: string) => notes.push({ level, text });

  if (id === 'identity') {
    const title = v.organizationTitle.trim();
    if (!title) add('error', 'The name of the organization is required.');
    else {
      if (title.length < 2) add('error', 'The name must be at least 2 characters.');
      if (title.length > 120) add('error', 'The name is too long (120 characters at most).');
      if (ctx.existingTitles.some((t) => t.trim().toLowerCase() === title.toLowerCase())) add('warning', 'You already see an organization with this name: pick a name that tells them apart in the Organization filter.');
    }
    if (!v.organizationLegalName.trim()) add('info', 'The legal name is used on documents; empty = the name above is shown.');
    if (!COUNTRY_RE.test(v.countryOfResidence.trim())) add('error', 'The country is required (two letters, e.g. LV).');
    if (v.contactEmail.trim() && !EMAIL_RE.test(v.contactEmail.trim())) add('error', 'The contact e-mail is not an e-mail address.');
  }

  if (id === 'legal') {
    const vat = v.vatNo.trim().toUpperCase();
    if (vat && !VAT_RE.test(vat)) add('error', 'The VAT number should start with a 2-letter country code (e.g. LV12345678901).');
    const iban = v.bankIban.replace(/\s+/g, '').toUpperCase();
    if (iban && !IBAN_RE.test(iban)) add('warning', 'The IBAN does not look right: two letters, two digits, then the account.');
    if (!v.registrationNo.trim() && !vat) add('info', 'No registration or VAT number yet: you can add them later in Organization edit.');
  }

  if (id === 'currencies') {
    if (!isCurrencyCode(v.currencyForBudget)) add('error', 'The budget currency is required (3 letters, e.g. EUR).');
    if (!isCurrencyCode(v.currencyForAccounting)) add('error', 'The accounting currency is required (3 letters, e.g. EUR).');
    if (v.currencyForContract && !isCurrencyCode(v.currencyForContract)) add('error', 'The currency for contracts must be 3 letters (or empty: the budget currency is used).');
    if (!isCurrencyCode(v.currencyForConsolidation)) add('error', 'The consolidation currency is required (3 letters, e.g. EUR): the money of all projects is added in it.');
    else if (isCurrencyCode(v.currencyForBudget) && normalizeCurrency(v.currencyForConsolidation) !== normalizeCurrency(v.currencyForBudget)) {
      add('info', 'The budget currency differs from the consolidation currency: the money of every project is converted when all projects are added.');
    }
  }

  if (id === 'resources') {
    const mode = CAPACITY_MODES.find((m) => m.mode === v.resourceCapacityStrongMode);
    if (mode) add('info', mode.hint);
  }
  return notes;
}

export const orgHasError = (notes: AssistantNote[]): boolean => notes.some((n) => n.level === 'error');

/** the first step (not the review) that has an error; null = the answers can make an organization */
export function firstOrgStepWithError(v: OrgAssistantValues, ctx: OrgAssistantContext): OrgAssistantStepId | null {
  for (const id of ORG_ASSISTANT_STEP_IDS) {
    if (id === 'review') continue;
    if (orgHasError(orgStepNotes(id, v, ctx))) return id;
  }
  return null;
}

export function nextOrgStepId(current: OrgAssistantStepId): OrgAssistantStepId | null {
  const i = ORG_ASSISTANT_STEP_IDS.indexOf(current);
  return i >= 0 && i < ORG_ASSISTANT_STEP_IDS.length - 1 ? ORG_ASSISTANT_STEP_IDS[i + 1] : null;
}

export function previousOrgStepId(current: OrgAssistantStepId): OrgAssistantStepId | null {
  const i = ORG_ASSISTANT_STEP_IDS.indexOf(current);
  return i > 0 ? ORG_ASSISTANT_STEP_IDS[i - 1] : null;
}

/** the currencies of the answers as the default project settings of the new organization (only the three currencies: the rest is asked by the project assistant or stays the built-in default) */
export function orgCurrencyDefaults(v: OrgAssistantValues): { currencyForBudget: string; currencyForAccounting: string; currencyForContract: string } {
  const budget = normalizeCurrency(v.currencyForBudget);
  return { currencyForBudget: budget, currencyForAccounting: normalizeCurrency(v.currencyForAccounting), currencyForContract: normalizeCurrency(v.currencyForContract) || budget };
}

/** the answers -> the rowJSON of the new organizationTable row (normalizeOrganization trims, lower-cases the e-mails, drops empty legal fields) */
export function orgAssistantRowJSON(v: OrgAssistantValues, userEmail: string): OrganizationRowJSON {
  return normalizeOrganization({
    organizationTitle: v.organizationTitle,
    organizationLegalName: v.organizationLegalName,
    createdByUser: userEmail,
    isActive: true,
    countryOfResidence: v.countryOfResidence.trim().toUpperCase(),
    contactEmail: v.contactEmail,
    contactPhone: v.contactPhone,
    website: v.website,
    notes: v.notes,
    resourceCapacityStrongMode: isCapacityMode(v.resourceCapacityStrongMode) ? v.resourceCapacityStrongMode : DEFAULT_CAPACITY_MODE,
    defaultProjectSettings: orgCurrencyDefaults(v),
    currencyForConsolidation: normalizeCurrency(v.currencyForConsolidation),
    legalData: { registrationNo: v.registrationNo, vatNo: v.vatNo, legalAddress: v.legalAddress, country: v.countryOfResidence.trim().toUpperCase(), bankIban: v.bankIban },
  });
}

/** the rules of the organization catalog (organizationModel.validateOrganization) on the answers: the screen never sends what the catalog would refuse */
export const orgAssistantValidation = (v: OrgAssistantValues, userEmail: string) => validateOrganization(orgAssistantRowJSON(v, userEmail));

/**
 * The owner of the new row. organizationTable has a unique index on rowOwnerGUID (one organization per OWNER e-mail), made for the first organization every user gets at his first login: a
 * user who already owns one makes the next ones as rows of the catalog owner (rowOwnerGUID 'organizationCatalog' - the old rows of the catalog look the same). The creator is the
 * administrator either way: createdByUser is the e-mail, and the database adds him as the administrator member of the new organization.
 */
export const orgOwnerFor = (userEmail: string, alreadyOwnsOne: boolean): string => (alreadyOwnsOne ? ORGANIZATION_CATALOG_OWNER : userEmail.trim().toLowerCase());

export function orgReviewLines(v: OrgAssistantValues): { id: OrgAssistantStepId; label: string; value: string }[] {
  const mode = CAPACITY_MODES.find((m) => m.mode === v.resourceCapacityStrongMode);
  const lines: { id: OrgAssistantStepId; label: string; value: string }[] = [
    { id: 'identity', label: 'Name', value: v.organizationTitle.trim() || '-' },
    { id: 'identity', label: 'Legal name', value: v.organizationLegalName.trim() || '-' },
    { id: 'identity', label: 'Country', value: v.countryOfResidence.trim().toUpperCase() || '-' },
    { id: 'identity', label: 'Contact', value: [v.contactEmail.trim(), v.contactPhone.trim(), v.website.trim()].filter(Boolean).join(' · ') || '-' },
    { id: 'legal', label: 'Registration / VAT number', value: [v.registrationNo.trim(), v.vatNo.trim().toUpperCase()].filter(Boolean).join(' / ') || '-' },
    { id: 'legal', label: 'Legal address', value: v.legalAddress.trim() || '-' },
    { id: 'legal', label: 'Bank account (IBAN)', value: v.bankIban.replace(/\s+/g, '').toUpperCase() || '-' },
  ];
  const c = orgCurrencyDefaults(v);
  lines.push(
    { id: 'currencies', label: 'Currencies of a new project (budget / accounting / contracts)', value: [c.currencyForBudget, c.currencyForAccounting, c.currencyForContract].map((x) => x || '-').join(' / ') },
    { id: 'currencies', label: 'Consolidation currency', value: normalizeCurrency(v.currencyForConsolidation) || '-' },
    { id: 'resources', label: 'A resource booked above its calendar', value: mode ? mode.label : '-' },
  );
  return lines;
}
