// Management calendar - the model (folders, calendars, days), the SQL files, and the fill rules against the SQL text.
import * as fs from 'fs';
import * as path from 'path';
import {
  activeSegments, calendarFolders, calendarNodes, calendarPath, calendarsOf, CALENDAR_FILL_MODES, daysBetween, DEFAULT_CALENDAR_FOR_TASK_PLAN, isCalendarFolder,
  MANAGEMENT_CALENDAR, MANAGEMENT_CALENDAR_DAYS_TABLE, MANAGEMENT_CALENDAR_TABLE, missingYears, resolveCalendarDays, yearsBetween,
} from '../../../kit8/catalog/management/calendar/managementCalendarModel';
import { managementCalendarSystemMetaData } from '../../../kit8/catalog/management/calendar/managementCalendarMetaData';

const sql = fs.readFileSync(path.join(__dirname, '../../../kit8/sql/init/create_management_calendar_tables.sql'), 'utf8');
const rows = [
  { rowGUID: 'projectCalendarFolder', rowOwnerGUID: 'managementCalendarCatalog', rowParentGUID: 'empty', orderInList: 1000, rowJSON: { title: 'Project' } },
  { rowGUID: 'resourceRoleCalendarFolder', rowOwnerGUID: 'managementCalendarCatalog', rowParentGUID: 'empty', orderInList: 2000, rowJSON: { title: 'Resource role' } },
  { rowGUID: 'personCalendarFolder', rowOwnerGUID: 'managementCalendarCatalog', rowParentGUID: 'empty', orderInList: 3000, rowJSON: { title: 'Person' } },
  { rowGUID: 'workingDaysCalendar', rowOwnerGUID: 'managementCalendarCatalog', rowParentGUID: 'projectCalendarFolder', orderInList: 1100, rowJSON: { title: 'Working days' } },
] as any[];

describe('folders and calendars', () => {
  it('level 1 = Project, Resource role, Person; level 2 = the calendars', () => {
    expect(calendarFolders(rows).map((r) => r.rowGUID)).toEqual([MANAGEMENT_CALENDAR.projectFolder, MANAGEMENT_CALENDAR.resourceRoleFolder, MANAGEMENT_CALENDAR.personFolder]);
    expect(calendarsOf(rows).map((r) => r.rowGUID)).toEqual(['workingDaysCalendar']);
    expect(isCalendarFolder(rows[0])).toBe(true);
    expect(isCalendarFolder(rows[3])).toBe(false);
    expect(calendarNodes(rows).map((n) => n.title)).toEqual(['Project', 'Resource role', 'Person']);
    expect(calendarPath(rows, 'workingDaysCalendar')).toBe('Project › Working days');
    expect(DEFAULT_CALENDAR_FOR_TASK_PLAN).toBe('workingDaysCalendar');
  });
  it('two redux entities on the two tables', () => {
    const meta = managementCalendarSystemMetaData();
    expect(meta[MANAGEMENT_CALENDAR_TABLE.entity].tableName).toBe('managementCalendarTable');
    expect(meta[MANAGEMENT_CALENDAR_DAYS_TABLE.entity].tableName).toBe('managementCalendarDaysTable');
  });
});

describe('days', () => {
  const day = (d: string, isActive: boolean) => ({ rowJSON: { day: d, isActive } });
  it('daysBetween is a closed range; a bad or reversed range is empty', () => {
    expect(daysBetween('2026-02-27', '2026-03-02')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
    expect(daysBetween('2028-02-28', '2028-03-01')).toEqual(['2028-02-28', '2028-02-29', '2028-03-01']);
    expect(daysBetween('2026-03-02', '2026-03-01')).toEqual([]);
    expect(daysBetween('x', '2026-03-01')).toEqual([]);
    expect(yearsBetween('2026-12-30', '2028-01-02')).toEqual([2026, 2027, 2028]);
  });
  it('resolveCalendarDays: active, excluded, and a day without a row is MISSING (never guessed)', () => {
    const r = resolveCalendarDays([day('2026-10-12', true), day('2026-10-13', false), day('2026-10-14', true)], '2026-10-12', '2026-10-15');
    expect(r).toEqual({ active: ['2026-10-12', '2026-10-14'], excluded: ['2026-10-13'], missing: ['2026-10-15'] });
    expect(missingYears(['2026-12-31', '2027-01-01', '2027-01-02'])).toBe('2026, 2027');
  });
  it('activeSegments: an excluded day ends a run', () => {
    expect(activeSegments(['2026-10-12', '2026-10-13', '2026-10-15', '2026-10-19', '2026-10-20'])).toEqual([['2026-10-12', '2026-10-13'], ['2026-10-15'], ['2026-10-19', '2026-10-20']]);
    expect(activeSegments([])).toEqual([]);
  });
});

describe('the SQL file', () => {
  it('creates both tables, the 3 folders and the default calendar, idempotently', () => {
    for (const t of ['managementCalendarTable', 'managementCalendarDaysTable']) expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public."${t}"`);
    for (const code of ['projectCalendarFolder', 'resourceRoleCalendarFolder', 'personCalendarFolder', 'workingDaysCalendar']) expect(sql).toContain(`'${code}'`);
    expect(sql).toMatch(/ON CONFLICT \("rowGUID"\) DO NOTHING/);
    expect(sql).toContain('fill_management_calendar');
  });
  it('the days table: one row per calendar and day (unique), the year in rowParentGUID, cascade with the calendar', () => {
    expect(sql).toMatch(/UNIQUE INDEX IF NOT EXISTS "idx_managementCalendarDaysTable_owner_day"[^;]*"rowOwnerGUID", \("rowJSON"->>'day'\)/);
    expect(sql).toContain('REFERENCES public."managementCalendarTable"("rowGUID") ON DELETE CASCADE');
    expect(sql).toContain('p_year::text');
  });
  it('the four fill modes of the document, and manual days are kept unless asked', () => {
    expect(CALENDAR_FILL_MODES.map((m) => m.mode)).toEqual(['workingDays', 'fiveDays', 'sixDays', 'allDays']);
    for (const m of CALENDAR_FILL_MODES) expect(sql).toContain(`'${m.mode}'`);
    expect(sql).toContain("COALESCE(t.\"rowJSON\"->>'reason', '') <> 'manual'");
    expect(sql).toContain('p_overwrite_manual');
    expect(sql).toMatch(/p_mode = 'workingDays' AND COALESCE\(t\."rowJSON"->>'reason', ''\) = 'holiday'/);
  });
  it('is part of run_fresh_data.sql and has a delete file', () => {
    const all = fs.readFileSync(path.join(__dirname, '../../../kit8/sql/run_fresh_data.sql'), 'utf8');
    expect(all).toContain('CREATE OR REPLACE FUNCTION public.fill_management_calendar');
    expect(fs.existsSync(path.join(__dirname, '../../../kit8/sql/init/delete_management_calendar_tables.sql'))).toBe(true);
  });
});
