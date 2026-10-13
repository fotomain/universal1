// RULE: 1 user === 1 organization, strongly.
//   organizationTable.rowOwnerGUID = userEmail.toLowerCase()  (the owner IS the user; unique in SQL)
//   rowJSON.createdByUser          = userEmail.toLowerCase()
// Called on every login (app/_layout.tsx). Safe to call many times / in parallel:
//   * the same email is served by ONE in-flight call (auth events fire several times per login),
//   * rows made before the rule (rowOwnerGUID 'organizationCatalog') are adopted, not duplicated,
//   * the SQL unique index is the last guard: a lost race (23505) means "already exists".

import * as Crypto from 'expo-crypto';
import { ORGANIZATION_CATALOG_OWNER, organizationTable } from './organizationModel';

/** rowOwnerGUID / createdByUser of the organization of this user. */
export const organizationOwnerOf = (userEmail: string): string => (userEmail || '').trim().toLowerCase();

const inFlight = new Map<string, Promise<void>>();

type Names = { userFirstName?: string };

export function ensureUserOrganization(supabase: any, userEmail: string, names: Names = {}): Promise<void> {
  const owner = organizationOwnerOf(userEmail);
  if (!owner) return Promise.resolve();
  const running = inFlight.get(owner);
  if (running) return running;
  const p = run(supabase, owner, userEmail, names).finally(() => inFlight.delete(owner));
  inFlight.set(owner, p);
  return p;
}

async function run(supabase: any, owner: string, userEmail: string, names: Names): Promise<void> {
  try {
    // 1. the organization already owned by the user
    const { data: owned, error: ownedError } = await supabase
      .from(organizationTable)
      .select('rowGUID')
      .eq('rowOwnerGUID', owner)
      .limit(1);
    if (ownedError) {
      console.error('Supabase organization select error:', ownedError);
      return;
    }
    if (owned && owned.length > 0) return;

    // 2. an older organization of the user (before the rule: shared owner) -> make it the user's own
    const { data: legacy, error: legacyError } = await supabase
      .from(organizationTable)
      .select('rowGUID, rowJSON')
      .eq('rowOwnerGUID', ORGANIZATION_CATALOG_OWNER)
      .ilike('rowJSON->>createdByUser', owner)
      .order('orderInList', { ascending: true })
      .limit(1);
    if (legacyError) {
      console.error('Supabase organization legacy select error:', legacyError);
      return;
    }
    if (legacy && legacy.length > 0) {
      const { error: adoptError } = await supabase
        .from(organizationTable)
        .update({ rowOwnerGUID: owner, rowJSON: { ...legacy[0].rowJSON, createdByUser: owner } })
        .eq('rowGUID', legacy[0].rowGUID);
      if (adoptError && adoptError.code !== '23505') console.error('Supabase organization adopt error:', adoptError);
      return;
    }

    // 3. none: create the one
    const formattedName = names.userFirstName || owner.split('@')[0] || 'User';
    const { error: insertError } = await supabase.from(organizationTable).insert({
      rowGUID: Crypto.randomUUID(),
      rowOwnerGUID: owner,
      rowParentGUID: 'empty',
      orderInList: Date.now(),
      rowJSON: {
        organizationTitle: `${formattedName}'s Organization`,
        organizationLegalName: `${formattedName} Organization SIA`,
        createdByUser: owner,
        isActive: true,
        contactEmail: userEmail,
        legalData: { country: 'LV' },
      },
    });
    if (insertError) {
      if (insertError.code === '23505') return; // another call won the race: the user has the organization
      console.error('Supabase organization insert error:', insertError);
    } else {
      console.log('Successfully created initial user organization in organizationTable');
    }
  } catch (e) {
    console.error('Error checking/creating organization:', e);
  }
}
