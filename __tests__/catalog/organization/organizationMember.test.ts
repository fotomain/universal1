// Organization members (SQL PART 45): the model helpers, the SystemMetaData entry, the SQL files (table, guard trigger, RLS, functions, backfill, delete) and the Drawer / route entries.
// The behaviour in the database is kit8/docker/tests/48_organization_members.sql.
import {
  canSendInvitation, formatMemberDate, inviteRowOf, isAdministratorIn, isValidMemberEmail, memberEmail, memberHasUser, memberIsAdministrator, memberStatusLabel, memberStatusOf,
  membersOfOrganization, normalizeMemberEmail, ORGANIZATION_MEMBER_ENTITY, ORGANIZATION_MEMBER_TABLE,
} from '../../../kit8/catalog/organization/members/organizationMemberModel';
import { organizationMemberSystemMetaData } from '../../../kit8/catalog/organization/members/organizationMemberMetaData';
import { inviteResultOf } from '../../../kit8/catalog/organization/members/inviteMember';
import { codeSql, readSql, sqlPart, tablesSql } from '../../sql/sqlFilesTestKit';

const row = (email: string, o: Record<string, any> = {}, org = 'orgA', parent = 'u-' + email) =>
  ({ rowGUID: 'm-' + email, rowOwnerGUID: org, rowParentGUID: parent, orderInList: 0, rowJSON: { userEmailForInvitation: email, organizationAdministrator: false, memberStatus: 'active', ...o } }) as any;

describe('the model', () => {
  it('table, entity, defaults', () => {
    expect([ORGANIZATION_MEMBER_TABLE.table, ORGANIZATION_MEMBER_ENTITY]).toEqual(['organizationMemberTable', 'organizationMemberReusable']);
    expect(ORGANIZATION_MEMBER_TABLE.emptyRowJSON()).toEqual({ userEmailForInvitation: null, organizationAdministrator: false, autoCreatePerson: true });
  });
  it('e-mails are trimmed and lower case; a valid one has an @ and no blanks', () => {
    expect(normalizeMemberEmail('  Boris@Acme.TEST ')).toBe('boris@acme.test');
    for (const ok of ['a@b.c', ' A@B.C ']) expect(isValidMemberEmail(ok)).toBe(true);
    for (const bad of ['', 'a', 'a@', '@b', 'a b@c.d', null, undefined]) expect(isValidMemberEmail(bad)).toBe(false);
  });
  it('status, administrator, user of a row; the labels', () => {
    expect(memberStatusOf(row('a@b.c'))).toBe('active');
    expect(memberStatusOf(row('a@b.c', { memberStatus: 'invited' }))).toBe('invited');
    expect(memberStatusOf({ rowJSON: {} } as any)).toBe('invited');
    expect(memberIsAdministrator(row('a@b.c', { organizationAdministrator: true }))).toBe(true);
    expect(memberIsAdministrator(row('a@b.c'))).toBe(false);
    expect(memberHasUser(row('a@b.c'))).toBe(true);
    expect(memberHasUser(row('a@b.c', {}, 'orgA', 'empty'))).toBe(false);
    expect([memberStatusLabel('active'), memberStatusLabel('invited')]).toEqual(['Active', 'Invited']);
    expect(memberEmail(row('A@B.C'))).toBe('a@b.c');
  });
  it('membersOfOrganization: one organization, administrators first, then by e-mail', () => {
    const rows = [row('zed@x.y'), row('anna@x.y', { organizationAdministrator: true }), row('bob@x.y'), row('other@x.y', {}, 'orgB')];
    expect(membersOfOrganization(rows, 'orgA').map(memberEmail)).toEqual(['anna@x.y', 'bob@x.y', 'zed@x.y']);
    expect(membersOfOrganization(null, 'orgA')).toEqual([]);
  });
  it('isAdministratorIn: an ACTIVE administrator row with my e-mail in this organization', () => {
    const rows = [row('anna@x.y', { organizationAdministrator: true }), row('bob@x.y'), row('inv@x.y', { organizationAdministrator: true, memberStatus: 'invited' })];
    expect(isAdministratorIn(rows, 'orgA', 'ANNA@x.y')).toBe(true);
    expect(isAdministratorIn(rows, 'orgA', 'bob@x.y')).toBe(false);
    expect(isAdministratorIn(rows, 'orgA', 'inv@x.y')).toBe(false);
    expect(isAdministratorIn(rows, 'orgB', 'anna@x.y')).toBe(false);
    expect(isAdministratorIn(rows, 'orgA', '')).toBe(false);
  });
  it('inviteRowOf: what the Invite button inserts', () => {
    expect(inviteRowOf('orgA', ' Erik@X.Y ', false)).toEqual({ rowOwnerGUID: 'orgA', rowParentGUID: 'empty', rowJSON: { userEmailForInvitation: 'erik@x.y', autoCreatePerson: false } });
    expect(inviteRowOf('orgA', 'e@x.y').rowJSON.autoCreatePerson).toBe(true);
  });
  it('dates and the resend rule', () => {
    expect(formatMemberDate('2026-11-02T10:11:12.345+00:00')).toBe('2026-11-02 10:11');
    expect(formatMemberDate(undefined)).toBe('');
    expect(canSendInvitation(row('a@b.c', { memberStatus: 'invited' }, 'orgA', 'empty'))).toBe(true);
    expect(canSendInvitation(row('a@b.c'))).toBe(false);
  });
  it('inviteResultOf: the answer of supabase.functions.invoke', () => {
    expect(inviteResultOf({ data: { sent: true }, error: null })).toEqual({ ok: true, sent: true });
    expect(inviteResultOf({ data: { sent: false, reason: 'active' }, error: null })).toEqual({ ok: true, sent: false, reason: 'active' });
    expect(inviteResultOf({ data: null, error: { message: 'Function not found' } })).toEqual({ ok: false, error: 'Function not found' });
    expect(inviteResultOf({ data: { error: 'Only the administrator' }, error: null })).toEqual({ ok: false, error: 'Only the administrator' });
    expect(inviteResultOf(null).ok).toBe(false);
  });
  it('the SystemMetaData entry is registered', () => {
    expect(Object.keys(organizationMemberSystemMetaData())).toEqual(['organizationMemberReusable']);
    expect(readSql('../../../kit8/redux/SystemMetaData.ts'.replace('../../../kit8/', '../../'))).toContain('organizationMemberSystemMetaData');
  });
});

describe('the SQL (PART 45)', () => {
  const t = sqlPart(tablesSql, 45);
  const c = sqlPart(codeSql, 45);
  it('start1: the table, its checks and the unique keys', () => {
    expect(t).toContain('CREATE TABLE IF NOT EXISTS public."organizationMemberTable"');
    expect(t).toContain('REFERENCES public."organizationTable"("rowGUID") ON DELETE CASCADE');
    expect(t).toContain('uq_organizationMember_email');
    expect(t).toContain('uq_organizationMember_user');
    expect(t).toContain(`"rowJSON"->>'memberStatus' IN ('invited', 'active')`);
  });
  it('start2: guard trigger, RLS for the administrator, the functions, the backfill, realtime', () => {
    expect(c).toContain('CREATE TRIGGER trg_organizationMemberTable_guard BEFORE INSERT OR UPDATE OR DELETE ON public."organizationMemberTable"');
    expect(c).toContain('you cannot delete yourself from the organization');
    expect(c).toContain('the organization must keep an administrator');
    expect(c).toContain('the member owns projects of this organization');
    for (const fn of ['organization_is_admin', 'organization_invite_user', 'organization_revoke_invitation', 'organization_ensure_user', 'organization_accept_invitation', 'organization_switch',
      'organization_my_memberships', 'person_create_own', 'organization_member_create_person', 'organization_member_backfill']) {
      expect(c).toContain(`CREATE OR REPLACE FUNCTION public.${fn}(`);
    }
    expect(c).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON public."organizationMemberTable" TO authenticated');
    expect(c).toContain(`ALTER PUBLICATION supabase_realtime ADD TABLE public."organizationMemberTable"`);
    expect(c).toContain('SELECT public.organization_member_backfill();');
  });
  it('a RAISE placeholder is a single percent sign (no stray %% before a quote)', () => {
    for (const l of c.split('\n').filter((x) => x.includes('RAISE EXCEPTION') && x.includes('%'))) expect(l).not.toMatch(/"%%"/);
  });
  it('PART 20 says its five functions are replaced; the part is listed in both headers and in the delete file', () => {
    expect(codeSql).toContain('are REPLACED in PART 45');
    expect(tablesSql.slice(0, tablesSql.indexOf('-- PART 1:'))).toContain('45. create_organization_members.sql');
    expect(codeSql.slice(0, codeSql.indexOf('-- PART 1:'))).toContain('45. create_organization_members.sql');
    const del = readSql('delete_sql_structure.sql');
    expect(del).toContain('DROP TABLE IF EXISTS public."organizationMemberTable" CASCADE');
    expect(del).toContain('DROP POLICY IF EXISTS "organizationTable_update"');
  });
});

describe('the screen is reachable', () => {
  const fs = require('fs'); const path = require('path');
  const read = (p: string) => fs.readFileSync(path.join(__dirname, '../../..', p), 'utf8') as string;
  it('route, Drawer.Screen and the Catalogs item', () => {
    expect(fs.existsSync(path.join(__dirname, '../../../app/catalog/organization/members/index.tsx'))).toBe(true);
    expect(read('app/_layout.tsx')).toContain('catalog/organization/members/index');
    expect(read('kit8/ui/components/CustomDrawerContent.tsx')).toContain("route: 'catalog/organization/members'");
  });
});
