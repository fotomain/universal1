import {
  buildMSProjectXml,
  MSP_FIELD_NUMBER1,
  MSP_FIELD_TEXT1,
  mspDateTime,
  mspDuration,
  mspLinkLag,
  msProjectFileName,
  xmlEscape,
} from '../../../../kit8/pm/crud/exchange/msproject/msProjectXml';
import { pdfHeaderLines } from '../../../../kit8/pm/crud/exchange/pdf/pdfDocument';

const DAY = 24 * 60 * 60 * 1000;
const start = Date.UTC(2026, 9, 5); // Monday 2026-10-05
const row = (guid: string, name: string, kind: string, extra: any = {}) => ({
  rowGUID: guid,
  treePath: guid,
  projectGUID: 'p',
  rowOwnerGUID: 'o',
  rowDuration: null,
  rowProgress: 0,
  orderInList: 1,
  rowJSON: { rowKind: kind, name, durationDays: 1, ...extra },
});
const sch = (startMs: number, finishMs: number, days: number, extra: any = {}) => ({
  startAt: '',
  finishAt: '',
  startMs,
  finishMs,
  durationDays: days,
  isSummary: false,
  isMilestone: false,
  progress: 0,
  totalFloatDays: 0,
  isCritical: false,
  inCycle: false,
  ...extra,
});

const input = (options = {}) => ({
  projectName: 'House <A&B>',
  rows: [
    { task: row('s', 'Stage "1"', 'stage') as any, outlineLevel: 1, wbs: '1', schedule: sch(start, start + 5 * DAY, 5, { isSummary: true, progress: 40 }) },
    { task: row('a', 'Dig', 'task', { manualStartAt: '2026-10-05T00:00:00.000Z', notes: 'deep' }) as any, outlineLevel: 2, wbs: '1.1', schedule: sch(start, start + 2 * DAY, 2, { isCritical: true, progress: 100 }) },
    { task: row('b', 'Pour', 'task') as any, outlineLevel: 2, wbs: '1.2', schedule: sch(start + 2 * DAY, start + 5 * DAY, 3, { progress: 12.4 }) },
    { task: row('m', 'Done', 'milestone') as any, outlineLevel: 1, wbs: '2', schedule: sch(start + 5 * DAY, start + 5 * DAY, 0, { isMilestone: true }) },
  ],
  dependencies: [
    { rowGUID: 'b', rowDependsOnGUID: 'a', projectGUID: 'p', rowOwnerGUID: 'o', linkType: 'FS', lagDays: 0 },
    { rowGUID: 'm', rowDependsOnGUID: 'b', projectGUID: 'p', rowOwnerGUID: 'o', linkType: 'SS', lagDays: 2 },
    { rowGUID: 'm', rowDependsOnGUID: 'gone', projectGUID: 'p', rowOwnerGUID: 'o', linkType: 'FS', lagDays: 0 },
  ] as any,
  projectStartMs: start,
  projectFinishMs: start + 5 * DAY,
  skipWeekends: true,
  kanbanStageNameByTask: { s: 'Plan', a: 'Execute', b: null, m: 'Waiting' },
  kanbanPercentByTask: { s: 50, a: 100, b: 0, m: null },
  options,
  now: new Date('2026-10-06T09:23:00Z'),
});

const tasksOf = (xml: string) => xml.split('<Task>').slice(1).map((t) => t.split('</Task>')[0]);
const tag = (xml: string, name: string) => new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1];

describe('msProjectXml', () => {
  it('helpers: escape, dates, duration, lag, file name', () => {
    expect(xmlEscape(`a<b>&"c'\u0001`)).toBe('a&lt;b&gt;&amp;&quot;c&apos;');
    expect(mspDateTime(start)).toBe('2026-10-05T08:00:00');
    expect(mspDateTime(start, '17:00:00')).toBe('2026-10-05T17:00:00');
    expect(mspDuration(2)).toBe('PT16H0M0S');
    expect(mspDuration(0)).toBe('PT0H0M0S');
    expect(mspLinkLag(1)).toBe(4800);
    expect(mspLinkLag(-2)).toBe(-9600);
    expect(msProjectFileName('House: A/B', new Date('2026-10-06T09:23:00Z'))).toBe('House_A_B_2026-10-06-09-23-00.xml');
    expect(msProjectFileName('')).toMatch(/^project_.*\.xml$/);
  });

  it('project element: namespace, name, dates, calendar (Mon-Fri)', () => {
    const xml = buildMSProjectXml(input());
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Project xmlns="http://schemas.microsoft.com/project">')).toBe(true);
    expect(xml.trimEnd().endsWith('</Project>')).toBe(true);
    expect(tag(xml, 'Name')).toBe('House &lt;A&amp;B&gt;');
    expect(tag(xml, 'StartDate')).toBe('2026-10-05T08:00:00');
    expect(tag(xml, 'FinishDate')).toBe('2026-10-09T17:00:00'); // exclusive finish -> the last day
    expect(tag(xml, 'MinutesPerWeek')).toBe('2400');
    expect((xml.match(/<DayWorking>1<\/DayWorking>/g) || []).length).toBe(5);
    expect((xml.match(/<DayWorking>0<\/DayWorking>/g) || []).length).toBe(2);
    expect(xml).not.toContain('<ExtendedAttributes>');
    const all = buildMSProjectXml({ ...input(), skipWeekends: false });
    expect((all.match(/<DayWorking>1<\/DayWorking>/g) || []).length).toBe(7);
    expect(tag(all, 'MinutesPerWeek')).toBe('3360');
  });

  it('tasks: order, outline, dates, duration, flags, constraint, notes', () => {
    const t = tasksOf(buildMSProjectXml(input()));
    expect(t.map((x) => tag(x, 'UID'))).toEqual(['1', '2', '3', '4']);
    expect(t.map((x) => tag(x, 'Name'))).toEqual(['Stage &quot;1&quot;', 'Dig', 'Pour', 'Done']);
    expect(t.map((x) => tag(x, 'OutlineLevel'))).toEqual(['1', '2', '2', '1']);
    expect(t.map((x) => tag(x, 'WBS'))).toEqual(['1', '1.1', '1.2', '2']);
    expect(t.map((x) => tag(x, 'Summary'))).toEqual(['1', '0', '0', '0']);
    expect(t.map((x) => tag(x, 'Milestone'))).toEqual(['0', '0', '0', '1']);
    expect(t.map((x) => tag(x, 'Critical'))).toEqual(['0', '1', '0', '0']);
    expect(t.map((x) => tag(x, 'PercentComplete'))).toEqual(['40', '100', '12', '0']);
    expect(t.map((x) => tag(x, 'Duration'))).toEqual(['PT40H0M0S', 'PT16H0M0S', 'PT24H0M0S', 'PT0H0M0S']);
    expect(tag(t[1], 'Start')).toBe('2026-10-05T08:00:00');
    expect(tag(t[1], 'Finish')).toBe('2026-10-06T17:00:00');
    expect(tag(t[3], 'Start')).toBe('2026-10-10T08:00:00');
    expect(tag(t[3], 'Finish')).toBe('2026-10-10T08:00:00');
    expect(tag(t[1], 'ConstraintType')).toBe('4');
    expect(tag(t[1], 'ConstraintDate')).toBe('2026-10-05T08:00:00');
    expect(tag(t[2], 'ConstraintType')).toBe('0');
    expect(t[2]).not.toContain('ConstraintDate');
    expect(tag(t[1], 'Notes')).toBe('deep');
    // schema order inside a task
    const order = ['<UID>', '<ID>', '<Name>', '<WBS>', '<OutlineLevel>', '<Start>', '<Finish>', '<Duration>', '<Milestone>', '<Summary>', '<PercentComplete>', '<ConstraintType>', '<Notes>'];
    const at = order.map((o) => t[1].indexOf(o));
    expect(at.every((v) => v >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('dependencies become PredecessorLink of the successor (type + lag); links to missing tasks are skipped', () => {
    const t = tasksOf(buildMSProjectXml(input()));
    expect(t[0]).not.toContain('PredecessorLink');
    expect(tag(t[2], 'PredecessorUID')).toBe('2');
    expect(/<PredecessorLink>[\s\S]*<Type>1<\/Type>/.test(t[2])).toBe(true); // FS
    expect(tag(t[3], 'PredecessorUID')).toBe('3');
    expect(/<PredecessorLink>[\s\S]*<Type>3<\/Type>/.test(t[3])).toBe(true); // SS
    expect(tag(t[3], 'LinkLag')).toBe('9600');
    expect((t[3].match(/<PredecessorLink>/g) || []).length).toBe(1);
  });

  it('custom fields: Kanban Stage = Text1, Kanban Percent = Number1 - only the checked ones', () => {
    const both = buildMSProjectXml(input({ exportKanbanStage: true, exportKanbanPercent: true }));
    expect(both).toContain(`<FieldID>${MSP_FIELD_TEXT1}</FieldID>\n      <FieldName>Text1</FieldName>\n      <Alias>Kanban Stage</Alias>`);
    expect(both).toContain(`<FieldID>${MSP_FIELD_NUMBER1}</FieldID>\n      <FieldName>Number1</FieldName>\n      <Alias>Kanban Percent</Alias>`);
    expect(both.indexOf('<ExtendedAttributes>')).toBeLessThan(both.indexOf('<Calendars>'));
    const t = tasksOf(both);
    expect(t[1]).toContain(`<FieldID>${MSP_FIELD_TEXT1}</FieldID>\n        <Value>Execute</Value>`);
    expect(t[1]).toContain(`<FieldID>${MSP_FIELD_NUMBER1}</FieldID>\n        <Value>100</Value>`);
    expect(t[2]).not.toContain(`${MSP_FIELD_TEXT1}`); // no stage
    expect(t[2]).toContain(`<FieldID>${MSP_FIELD_NUMBER1}</FieldID>\n        <Value>0</Value>`);
    expect(t[3]).not.toContain(`${MSP_FIELD_NUMBER1}`); // no percent
    // the custom fields come after the predecessor links
    expect(t[2].indexOf('</PredecessorLink>')).toBeLessThan(t[2].indexOf('<ExtendedAttribute>'));

    const stageOnly = buildMSProjectXml(input({ exportKanbanStage: true }));
    expect(stageOnly).toContain('Text1');
    expect(stageOnly).not.toContain('Number1');
    expect(stageOnly).not.toContain(`${MSP_FIELD_NUMBER1}`);
    const none = buildMSProjectXml(input({}));
    expect(none).not.toContain('ExtendedAttribute');
  });

  it('is well-formed XML', () => {
    const { JSDOM } = require('jsdom');
    const doc = new (new JSDOM('').window.DOMParser)().parseFromString(buildMSProjectXml(input({ exportKanbanStage: true, exportKanbanPercent: true })), 'text/xml');
    expect(doc.getElementsByTagName('parsererror').length).toBe(0);
    expect(doc.documentElement.nodeName).toBe('Project');
    expect(doc.getElementsByTagName('Task').length).toBe(4);
  });
});

describe('PDF header', () => {
  it('project name above, start and finish dates below', () => {
    expect(pdfHeaderLines({ projectName: ' House ', start: '2026-10-05', finish: '2026-10-09' })).toEqual({ title: 'House', subtitle: 'Start: 2026-10-05   ·   Finish: 2026-10-09' });
    expect(pdfHeaderLines({ projectName: '', start: '1', finish: '2', startLabel: 'Sākums', finishLabel: 'Beigas' })).toEqual({ title: 'Project', subtitle: 'Sākums: 1   ·   Beigas: 2' });
    expect(pdfHeaderLines({ projectName: 'X' }).subtitle).toBe('');
  });
});
