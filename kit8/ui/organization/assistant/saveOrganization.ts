// saveOrganization - the two writes of the Create Organization Assistant, straight to Supabase (not through the redux saga: the assistant must KNOW whether the row was made).
//   insertOrganization(client, userEmail, rowJSON)         the new organizationTable row. A user already owns ONE organization (unique index on rowOwnerGUID, SQL start2 PART 20): then the row
//                                                           is made as a row of the catalog owner. The database adds the creator as the ACTIVE ADMINISTRATOR member (trigger of PART 45).
//   saveOrganizationDefaultSettings(client, guid, settings) the default project settings of ONE organization (merged into its CURRENT rowJSON: no other key is lost). Only an administrator of
//                                                           the organization / its creator can: a refusal comes back as "nothing was changed" (RLS filters, it does not raise).
import { orgOwnerFor } from './organizationAssistantModel';
import type { OrganizationRowJSON } from '../../../catalog/organization/organizationModel';
import { DEFAULT_PROJECT_SETTINGS_KEY, defaultProjectSettingsOf, type DefaultProjectSettings } from '../../../catalog/organization/defaultProjectSettings';

export const ORGANIZATION_TABLE = 'organizationTable';

export type InsertOrganizationResult = { ok: true; rowGUID: string; rowOwnerGUID: string } | { ok: false; error: string };
export type SaveOrganizationSettingsResult = { ok: true } | { ok: false; error: string };

const isUniqueViolation = (error: any): boolean => String(error?.code ?? '') === '23505' || /duplicate key|uq_organizationTable_one_per_user/i.test(String(error?.message ?? ''));

const newGUID = (): string => {
  const c: any = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => { const r = (Math.random() * 16) | 0; return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16); });
};

export async function insertOrganization(client: any, userEmail: string, rowJSON: OrganizationRowJSON, rowGUID: string = newGUID()): Promise<InsertOrganizationResult> {
  if (!client?.from) return { ok: false, error: 'No connection to the database.' };
  const email = (userEmail || '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'Sign in to create an organization.' };
  const attempt = async (owner: string) =>
    client.from(ORGANIZATION_TABLE).insert({ rowGUID, rowOwnerGUID: owner, rowParentGUID: 'empty', orderInList: Date.now(), rowJSON: { ...rowJSON, createdByUser: email } }).select('rowGUID');
  try {
    // the first organization of a user is owned by his e-mail; when the database says he has one already, the next ones are catalog rows
    let owner = orgOwnerFor(email, false);
    let { error } = await attempt(owner);
    if (error && isUniqueViolation(error)) {
      owner = orgOwnerFor(email, true);
      ({ error } = await attempt(owner));
    }
    if (error) return { ok: false, error: error.message || String(error) };
    return { ok: true, rowGUID, rowOwnerGUID: owner };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function saveOrganizationDefaultSettings(client: any, organizationGUID: string, settings: DefaultProjectSettings): Promise<SaveOrganizationSettingsResult> {
  if (!client?.from || !organizationGUID) return { ok: false, error: 'No organization: sign in first.' };
  try {
    const read = await client.from(ORGANIZATION_TABLE).select('rowGUID,rowJSON').eq('rowGUID', organizationGUID).maybeSingle();
    if (read.error) return { ok: false, error: read.error.message || String(read.error) };
    if (!read.data) return { ok: false, error: 'The organization was not found.' };
    const rowJSON = { ...(read.data.rowJSON || {}), [DEFAULT_PROJECT_SETTINGS_KEY]: defaultProjectSettingsOf({ ...((read.data.rowJSON || {})[DEFAULT_PROJECT_SETTINGS_KEY] || {}), ...settings }) };
    const { data, error } = await client.from(ORGANIZATION_TABLE).update({ rowJSON }).eq('rowGUID', organizationGUID).select('rowGUID');
    if (error) return { ok: false, error: error.message || String(error) };
    if (!data || data.length === 0) return { ok: false, error: 'Only the administrator of the organization (its creator) can change its settings.' };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
