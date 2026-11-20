// The questions of the Create Organization Assistant: the notes of every step, what blocks Next, the row that is made, who owns it.
import {
  ORG_ASSISTANT_STEP_IDS,
  defaultOrgAssistantValues,
  firstOrgStepWithError,
  nextOrgStepId,
  orgAssistantRowJSON,
  orgAssistantValidation,
  orgCurrencyDefaults,
  orgHasError,
  orgOwnerFor,
  orgReviewLines,
  orgStepNotes,
  previousOrgStepId,
} from '../../../../kit8/ui/organization/assistant/organizationAssistantModel';

const ctx = { existingTitles: ['Acme'] };
const good = () => ({ ...defaultOrgAssistantValues('Boss@Acme.test'), organizationTitle: 'Beta Timber' });
const errs = (id: any, v: any) => orgStepNotes(id, v, ctx).filter((n) => n.level === 'error').map((n) => n.text);

describe('the steps', () => {
  it('are in the order of an administrator and end with the review', () => {
    expect(ORG_ASSISTANT_STEP_IDS).toEqual(['identity', 'legal', 'currencies', 'resources', 'review']);
    expect(nextOrgStepId('identity')).toBe('legal');
    expect(nextOrgStepId('review')).toBeNull();
    expect(previousOrgStepId('legal')).toBe('identity');
    expect(previousOrgStepId('identity')).toBeNull();
  });
  it('start with the currencies the database gives a new organization and the e-mail of the user (lower case) as the contact', () => {
    const v = defaultOrgAssistantValues('Boss@Acme.test');
    expect([v.currencyForBudget, v.currencyForAccounting, v.currencyForContract, v.currencyForConsolidation]).toEqual(['USD', 'EUR', 'GBP', 'USD']);
    expect(v.contactEmail).toBe('boss@acme.test');
    expect(v.resourceCapacityStrongMode).toBe('capacityModeOff');
  });
});

describe('what blocks Next', () => {
  it('identity: the name is required (2..120), the country is two letters, the contact e-mail must be an e-mail', () => {
    expect(errs('identity', good())).toEqual([]);
    expect(errs('identity', { ...good(), organizationTitle: '  ' })).toContain('The name of the organization is required.');
    expect(errs('identity', { ...good(), organizationTitle: 'A' })).toContain('The name must be at least 2 characters.');
    expect(errs('identity', { ...good(), organizationTitle: 'x'.repeat(121) })).toContain('The name is too long (120 characters at most).');
    expect(errs('identity', { ...good(), countryOfResidence: 'LVA' })).toHaveLength(1);
    expect(errs('identity', { ...good(), contactEmail: 'not an email' })).toHaveLength(1);
    expect(errs('identity', { ...good(), contactEmail: '' })).toEqual([]);
  });
  it('a name the user already sees is a WARNING, not an error', () => {
    const notes = orgStepNotes('identity', { ...good(), organizationTitle: ' acme ' }, ctx);
    expect(notes.some((n) => n.level === 'warning')).toBe(true);
    expect(orgHasError(notes)).toBe(false);
  });
  it('legal: only a VAT number that is not CC + digits blocks; an odd IBAN is a warning', () => {
    expect(errs('legal', { ...good(), vatNo: 'LV12345678901' })).toEqual([]);
    expect(errs('legal', { ...good(), vatNo: '12345' })).toHaveLength(1);
    const notes = orgStepNotes('legal', { ...good(), bankIban: 'abc' }, ctx);
    expect(notes.some((n) => n.level === 'warning')).toBe(true);
    expect(orgHasError(notes)).toBe(false);
  });
  it('currencies: budget, accounting and CONSOLIDATION are obligatory (3 letters); contracts may be empty', () => {
    expect(errs('currencies', good())).toEqual([]);
    expect(errs('currencies', { ...good(), currencyForBudget: '' })).toHaveLength(1);
    expect(errs('currencies', { ...good(), currencyForAccounting: 'EU' })).toHaveLength(1);
    expect(errs('currencies', { ...good(), currencyForConsolidation: '' })).toHaveLength(1);
    expect(errs('currencies', { ...good(), currencyForContract: '' })).toEqual([]);
    expect(errs('currencies', { ...good(), currencyForContract: 'XX' })).toHaveLength(1);
  });
  it('firstOrgStepWithError finds the first step to correct', () => {
    expect(firstOrgStepWithError(good(), ctx)).toBeNull();
    expect(firstOrgStepWithError({ ...good(), currencyForConsolidation: '' }, ctx)).toBe('currencies');
    expect(firstOrgStepWithError({ ...good(), organizationTitle: '', vatNo: 'x' }, ctx)).toBe('identity');
  });
});

describe('the row that is made', () => {
  it('has the title, the creator, the legal data, the capacity mode and the currencies of a new project + the consolidation currency', () => {
    const v = { ...good(), organizationLegalName: 'Beta Timber SIA', registrationNo: '4000', vatNo: 'lv4000', legalAddress: 'Riga', bankIban: 'lv80 haba 0551 0000 0999 9', countryOfResidence: 'lv', resourceCapacityStrongMode: 'capacityModeBlock' as const, currencyForBudget: 'eur', currencyForConsolidation: 'chf', currencyForContract: '' };
    const row = orgAssistantRowJSON(v, 'Boss@Acme.test');
    expect(row.organizationTitle).toBe('Beta Timber');
    expect(row.organizationLegalName).toBe('Beta Timber SIA');
    expect(row.createdByUser).toBe('boss@acme.test');
    expect(row.countryOfResidence).toBe('LV');
    expect(row.legalData).toEqual({ registrationNo: '4000', vatNo: 'LV4000', legalAddress: 'Riga', country: 'LV', bankIban: 'LV80HABA0551000009999' });
    expect(row.resourceCapacityStrongMode).toBe('capacityModeBlock');
    // the contract currency left empty = the budget currency
    expect(row.defaultProjectSettings).toEqual({ currencyForBudget: 'EUR', currencyForAccounting: 'EUR', currencyForContract: 'EUR' });
    expect(row.currencyForConsolidation).toBe('CHF');
  });
  it('capacityModeOff (the default) is not written: a missing key reads as off', () => {
    expect(orgAssistantRowJSON(good(), 'boss@acme.test').resourceCapacityStrongMode).toBeUndefined();
  });
  it('passes the rules of the organization catalog (and a missing name does not)', () => {
    expect(orgAssistantValidation(good(), 'boss@acme.test').valid).toBe(true);
    expect(orgAssistantValidation({ ...good(), organizationTitle: '' }, 'boss@acme.test').valid).toBe(false);
  });
  it('orgCurrencyDefaults: the three currencies of a new project', () => {
    expect(orgCurrencyDefaults(good())).toEqual({ currencyForBudget: 'USD', currencyForAccounting: 'EUR', currencyForContract: 'GBP' });
  });
});

describe('who owns the row', () => {
  it('the first organization of a user is owned by his e-mail; the next ones by the catalog owner (one organization per owner e-mail)', () => {
    expect(orgOwnerFor(' Boss@Acme.test ', false)).toBe('boss@acme.test');
    expect(orgOwnerFor('boss@acme.test', true)).toBe('organizationCatalog');
  });
});

describe('the review', () => {
  it('has a line per answer and every line names the step it goes back to', () => {
    const lines = orgReviewLines({ ...good(), vatNo: 'LV1' });
    expect(lines.map((l) => l.label)).toEqual(expect.arrayContaining(['Name', 'Country', 'Registration / VAT number', 'Consolidation currency']));
    expect(lines.every((l) => ORG_ASSISTANT_STEP_IDS.includes(l.id))).toBe(true);
    expect(lines.find((l) => l.label === 'Name')?.value).toBe('Beta Timber');
    expect(lines.find((l) => l.label === 'Consolidation currency')?.value).toBe('USD');
  });
});
