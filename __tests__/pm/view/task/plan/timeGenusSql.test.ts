// The time genus control SQL (PARTs 20-23 of kit8/sql/start/start_sql_structure.sql, documentation/TIME_GENUS_CONTROL_WBS.html) is in the three files that must stay in step, with the
// names the plan fixed. (The SQL itself is run on a real Postgres 15: kit8/docker/test_sql.sh = install + delete cycle, kit8/docker/test_time_genus.sh = the behaviour tests.)
import fs from 'fs';
import path from 'path';

const dir = path.join(__dirname, '../../../../../kit8/sql/start');
const read = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8');
const start = read('start_sql_structure.sql');
const code = read('start_sql_code.sql');
const data = read('start_sql_data.sql');
const del = read('delete_sql_structure.sql');
const from = (s: string, n: number) => s.slice(s.indexOf(`-- PART ${n}:`));

const PARTS = [
  [20, 'create_organization_scope.sql'],
  [21, 'create_resource_calendar.sql'],
  [22, 'create_resource_busy_check.sql'],
  [23, 'create_calendar_lock.sql'],
] as const;

const NAMES = [
  'organization_ensure_user', 'organization_of_user', 'organization_of_current_user', 'organization_invite_user', 'organization_accept_invitation',
  'organization_resource_capacity', 'organization_resource_capacity_info', 'organization_resource_busy_check', 'organization_calendar_change_conflicts',
  'organization_calendar_lock_info', 'organization_assert_capacity', 'resource_occupancy_x_movement', 'organizationInvitationTable',
];

describe('the parts are in the structure file and in the code file', () => {
  it.each(PARTS)('PART %i %s', (n, title) => {
    expect(start).toContain(`-- PART ${n}: ${title}`);
    expect(code).toContain(`-- PART ${n}: ${title}`);
    expect(start).toContain(`${n}. ${title}`);
    expect(code).toContain(`${n}. ${title}`);
  });
  it('the same objects, under the names of the plan', () => {
    for (const name of NAMES) {
      expect(start).toContain(name);
      expect(code).toContain(name);
      expect(del).toContain(name);   // and the delete file drops them
    }
  });
  it('the old names (before the refactor of the plan) are gone', () => {
    for (const old of ['kit8_resource_capacity', 'kit8_resource_busy_check', 'kit8_calendar_change_conflicts', 'kit8_ensure_user', 'resource_occupancy_taskLinePlanMovements', 'busyControlMode']) {
      expect(start).not.toContain(old);
      expect(code).not.toContain(old);
    }
  });
});

describe('the delete file removes what the parts added', () => {
  it('PART 1b runs first and the numbered parts stay 1..n', () => {
    expect(del.indexOf('-- PART 1b:')).toBeGreaterThan(0);
    expect(del.indexOf('-- PART 1b:')).toBeLessThan(del.indexOf('-- PART 1:'));
    const nums = Array.from(del.matchAll(/^-- PART (\d+):/gm)).map((m) => Number(m[1]));
    expect(nums).toEqual(nums.map((_, i) => i + 1));
  });
  it('the new fill_management_calendar signature is dropped', () => {
    expect(del).toContain('fill_management_calendar(text, integer, text, boolean, numeric, boolean)');
  });
});

describe('the rules in the SQL', () => {
  const p20 = from(start, 20);
  it('userOrganization is obligatory and a user is created only by organization_ensure_user', () => {
    expect(p20).toContain('"userTable_userOrganization_chk"');
    expect(p20).toContain('REVOKE INSERT ON public."userTable" FROM authenticated');
    expect(p20).toContain('obligatory');
  });
  it('project_table.rowParentGUID: filled on insert, never changed, RESTRICT foreign key', () => {
    expect(p20).toContain('ADD COLUMN IF NOT EXISTS "rowParentGUID" TEXT');
    expect(p20).toContain('trg_project_table_organization BEFORE INSERT');
    expect(p20).toContain('trg_project_table_organization_keep BEFORE UPDATE OF "rowParentGUID"');
    expect(p20).toContain('ON DELETE RESTRICT');
  });
  it('the posted days: planMovementStatus (default true) and periodDay; the mode names', () => {
    expect(start).toContain('"planMovementStatus" BOOLEAN NOT NULL DEFAULT true');
    expect(start).toContain('"periodDay" DATE');
    for (const mode of ['capacityModeOff', 'capacityModeWarn', 'capacityModeBlock']) expect(start).toContain(mode);
    expect(start).toContain('resourceCapacityStrongMode');
  });
  it('a conflict is an answer, not an exception (an exception would roll the deletion back)', () => {
    const post = start.slice(start.indexOf('CREATE OR REPLACE FUNCTION public.create_task_line_plan('), start.indexOf('REVOKE ALL ON FUNCTION public.create_task_line_plan'));
    expect(post).toContain("'busy', v_busy");
    expect(post).not.toMatch(/RAISE EXCEPTION[^;]*busy/i);
    expect(post).toContain('organization_lock_resource');
  });
  it('the seeded week modes: rows in the data file (upserts), none in the code file', () => {
    for (const cal of ['standardWorkWeekCalendar', 'sixDayWeekCalendar', 'sevenDayWeekCalendar', 'partTime4hCalendar']) {
      expect(data).toMatch(new RegExp(`\\('${cal}',\\s+'managementCalendarCatalog'`));
    }
    const p21 = from(code, 21).slice(0, from(code, 21).indexOf('-- PART 22:'));
    expect(p21).not.toMatch(/\('(standardWorkWeek|sixDayWeek|sevenDayWeek|partTime4h)Calendar',\s+'managementCalendarCatalog'/);   // the code file holds no seed rows
  });
});

describe('A8: the scope of the check is the organization of the PROJECT, never the one of a user (a user in several organizations may come later)', () => {
  it('the occupancy view takes scopeGUID from project_table.rowParentGUID; the checks do not read userOrganization', () => {
    const view = start.slice(start.indexOf('CREATE OR REPLACE VIEW public.resource_occupancy_x_movement'), start.indexOf('REVOKE ALL ON public.resource_occupancy_x_movement'));
    expect(view).toContain('p."rowParentGUID"');
    expect(view).toContain('AS "scopeGUID"');
    const check = start.slice(start.indexOf('CREATE OR REPLACE FUNCTION public.organization_resource_busy_check'), start.indexOf('REVOKE ALL ON FUNCTION public.organization_resource_busy_check'));
    expect(check).not.toContain('userOrganization');
    expect(check).toContain('p_scope');
  });
});

describe('the behaviour tests exist', () => {
  it('kit8/docker/tests', () => {
    const files = fs.readdirSync(path.join(__dirname, '../../../../../kit8/docker/tests'));
    expect(files).toEqual(expect.arrayContaining(['00_helpers.sql', '10_organization.sql', '11_organization_legacy.sql', '20_resource_calendar.sql', '30_post_busy.sql', '40_calendar_lock.sql']));
    expect(fs.readdirSync(path.join(__dirname, '../../../../../kit8/docker'))).toEqual(expect.arrayContaining(['test_sql.sh', 'test_time_genus.sh', 'test_time_genus_race.sh']));
  });
});
