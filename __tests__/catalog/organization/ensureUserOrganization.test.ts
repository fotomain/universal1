// 1 user === 1 organization: rowOwnerGUID = createdByUser = userEmail.toLowerCase()
jest.mock('expo-crypto', () => ({ randomUUID: () => 'new-guid' }));
import { ensureUserOrganization, organizationOwnerOf } from '../../../kit8/catalog/organization/ensureUserOrganization';

type Row = { rowGUID: string; rowOwnerGUID: string; orderInList?: number; rowJSON: any };

/** Tiny in-memory supabase: enforces the SQL unique index (one rowOwnerGUID <> 'organizationCatalog'). */
function fakeSupabase(rows: Row[]) {
  const calls = { insert: 0, update: 0 };
  const from = () => {
    const filters: Array<(r: Row) => boolean> = [];
    const q: any = {
      select: () => q,
      eq: (c: string, v: string) => (filters.push((r: any) => r[c] === v), q),
      ilike: (_c: string, v: string) => (filters.push((r) => (r.rowJSON.createdByUser || '').toLowerCase() === v.toLowerCase()), q),
      order: () => q,
      limit: () => Promise.resolve({ data: rows.filter((r) => filters.every((f) => f(r))), error: null }),
      insert: async (row: Row) => {
        await Promise.resolve(); // yield: lets a parallel call interleave
        if (rows.some((r) => r.rowOwnerGUID === row.rowOwnerGUID && row.rowOwnerGUID !== 'organizationCatalog')) {
          return { error: { code: '23505' } };
        }
        calls.insert++;
        rows.push(row);
        return { error: null };
      },
      update: (patch: Partial<Row>) => ({
        eq: async (_c: string, guid: string) => {
          calls.update++;
          Object.assign(rows.find((r) => r.rowGUID === guid)!, patch);
          return { error: null };
        },
      }),
    };
    return q;
  };
  return { supabase: { from }, calls };
}

describe('ensureUserOrganization', () => {
  it('creates the organization owned by the lower-cased email', async () => {
    const rows: Row[] = [];
    const { supabase } = fakeSupabase(rows);
    await ensureUserOrganization(supabase, 'Bob@Example.COM', { userFirstName: 'Bob' });
    expect(rows).toHaveLength(1);
    expect(rows[0].rowOwnerGUID).toBe('bob@example.com');
    expect(rows[0].rowJSON.createdByUser).toBe('bob@example.com');
  });

  it('parallel logins (several auth events) make ONE organization', async () => {
    const rows: Row[] = [];
    const { supabase, calls } = fakeSupabase(rows);
    await Promise.all([
      ensureUserOrganization(supabase, 'bob@example.com'),
      ensureUserOrganization(supabase, 'Bob@example.com'),
      ensureUserOrganization(supabase, 'BOB@example.com'),
    ]);
    expect(rows).toHaveLength(1);
    expect(calls.insert).toBe(1);
  });

  it('a lost race (unique violation) is not an error and creates nothing more', async () => {
    const rows: Row[] = [];
    const { supabase } = fakeSupabase(rows);
    // the select sees nothing, but the row exists by the time of the insert
    const realFrom = supabase.from;
    let first = true;
    supabase.from = () => {
      const q = realFrom();
      const limit = q.limit;
      q.limit = (n: number) => (first ? ((first = false), rows.push({ rowGUID: 'x', rowOwnerGUID: 'bob@example.com', rowJSON: {} }), Promise.resolve({ data: [], error: null })) : limit(n));
      return q;
    };
    await ensureUserOrganization(supabase, 'bob@example.com');
    expect(rows).toHaveLength(1);
  });

  it('adopts an older organization (shared owner) instead of creating a second one', async () => {
    const rows: Row[] = [{ rowGUID: 'old', rowOwnerGUID: 'organizationCatalog', rowJSON: { createdByUser: 'Bob@example.com' } }];
    const { supabase, calls } = fakeSupabase(rows);
    await ensureUserOrganization(supabase, 'bob@example.com');
    expect(rows).toHaveLength(1);
    expect(rows[0].rowOwnerGUID).toBe('bob@example.com');
    expect(rows[0].rowJSON.createdByUser).toBe('bob@example.com');
    expect(calls.insert).toBe(0);
  });

  it('does nothing when the user already owns an organization, or has no email', async () => {
    const rows: Row[] = [{ rowGUID: 'o', rowOwnerGUID: 'bob@example.com', rowJSON: { createdByUser: 'bob@example.com' } }];
    const { supabase, calls } = fakeSupabase(rows);
    await ensureUserOrganization(supabase, 'bob@example.com');
    await ensureUserOrganization(supabase, '');
    expect(calls.insert + calls.update).toBe(0);
    expect(organizationOwnerOf('  A@B.c ')).toBe('a@b.c');
  });
});
