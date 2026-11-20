/** @jest-environment jsdom */
// The two writes of the Create Organization Assistant (a fake Supabase client).
// defaultProjectSettings imports the settings tab components: the PM UI kit mocks their native-only modules; import it FIRST
import '../../../pm/ui/pmUiTestKit';
import { insertOrganization, saveOrganizationDefaultSettings } from '../../../../kit8/ui/organization/assistant/saveOrganization';

const row: any = { organizationTitle: 'Beta', createdByUser: 'x@y.z', isActive: true };

function insertClient(results: Array<{ error: any }>) {
  const calls: any[] = [];
  const client = {
    from: (table: string) => ({
      insert: (payload: any) => {
        calls.push({ table, payload });
        return { select: async () => results[Math.min(calls.length - 1, results.length - 1)] };
      },
    }),
  };
  return { client, calls };
}

describe('insertOrganization', () => {
  it('makes the row owned by the e-mail of the creator, with createdByUser = that e-mail', async () => {
    const { client, calls } = insertClient([{ error: null }]);
    const r = await insertOrganization(client, ' Boss@Acme.test ', row, 'guid-1');
    expect(r).toEqual({ ok: true, rowGUID: 'guid-1', rowOwnerGUID: 'boss@acme.test' });
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe('organizationTable');
    expect(calls[0].payload).toMatchObject({ rowGUID: 'guid-1', rowOwnerGUID: 'boss@acme.test', rowParentGUID: 'empty' });
    expect(calls[0].payload.rowJSON.createdByUser).toBe('boss@acme.test');
  });
  it('a user who owns one already (unique index, 23505): the next one is made as a row of the catalog owner', async () => {
    const { client, calls } = insertClient([{ error: { code: '23505', message: 'duplicate key value violates unique constraint "uq_organizationTable_one_per_user"' } }, { error: null }]);
    const r = await insertOrganization(client, 'boss@acme.test', row, 'guid-2');
    expect(r).toEqual({ ok: true, rowGUID: 'guid-2', rowOwnerGUID: 'organizationCatalog' });
    expect(calls.map((c) => c.payload.rowOwnerGUID)).toEqual(['boss@acme.test', 'organizationCatalog']);
    // the creator stays the administrator: createdByUser is his e-mail in both tries
    expect(calls.every((c) => c.payload.rowJSON.createdByUser === 'boss@acme.test')).toBe(true);
  });
  it('any other error comes back as words and nothing is retried', async () => {
    const { client, calls } = insertClient([{ error: { code: '42501', message: 'new row violates row-level security policy' } }]);
    const r = await insertOrganization(client, 'boss@acme.test', row, 'guid-3');
    expect(r).toEqual({ ok: false, error: 'new row violates row-level security policy' });
    expect(calls).toHaveLength(1);
  });
  it('no e-mail (not signed in) and no client are refused before anything is sent', async () => {
    expect((await insertOrganization({ from: jest.fn() }, '  ', row)).ok).toBe(false);
    expect((await insertOrganization(null, 'a@b.c', row)).ok).toBe(false);
  });
});

function settingsClient(stored: any, updated: Array<{ rowGUID: string }>) {
  const writes: any[] = [];
  const client = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: stored, error: null }) }) }),
      update: (payload: any) => { writes.push(payload); return { eq: () => ({ select: async () => ({ data: updated, error: null }) }) }; },
    }),
  };
  return { client, writes };
}

describe('saveOrganizationDefaultSettings', () => {
  it('merges the settings into the CURRENT rowJSON: no other key is lost, the stored settings stay, every setting is explicit', async () => {
    const { client, writes } = settingsClient({ rowGUID: 'o1', rowJSON: { organizationTitle: 'Beta', currencyForConsolidation: 'USD', defaultProjectSettings: { currencyForBudget: 'EUR', skipWeekends: true } } }, [{ rowGUID: 'o1' }]);
    const r = await saveOrganizationDefaultSettings(client, 'o1', { currencyForAccounting: 'CHF' });
    expect(r).toEqual({ ok: true });
    const saved = writes[0].rowJSON;
    expect(saved.organizationTitle).toBe('Beta');
    expect(saved.currencyForConsolidation).toBe('USD');
    expect(saved.defaultProjectSettings.currencyForBudget).toBe('EUR');
    expect(saved.defaultProjectSettings.currencyForAccounting).toBe('CHF');
    expect(saved.defaultProjectSettings.skipWeekends).toBe(true);
    // the settings the user did not choose are STORED with their built-in default (planDay is true unless it is stored false)
    expect(saved.defaultProjectSettings.planDay).toBe(true);
    expect(Object.keys(saved.defaultProjectSettings).length).toBeGreaterThan(20);
  });
  it('a refusal by the database policy (no row comes back) is said in words', async () => {
    const { client } = settingsClient({ rowGUID: 'o1', rowJSON: {} }, []);
    const r = await saveOrganizationDefaultSettings(client, 'o1', {});
    expect(r.ok).toBe(false);
    expect((r as any).error).toMatch(/administrator/);
  });
  it('an organization that is not found, and no organization at all', async () => {
    expect((await saveOrganizationDefaultSettings(settingsClient(null, []).client, 'o1', {})).ok).toBe(false);
    expect((await saveOrganizationDefaultSettings(null, 'o1', {})).ok).toBe(false);
    expect((await saveOrganizationDefaultSettings({ from: jest.fn() }, '', {})).ok).toBe(false);
  });
});
