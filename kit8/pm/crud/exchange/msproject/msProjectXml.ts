// Project -> Microsoft Project XML (MSPDI, "Project XML Data Interchange"). Pure: no React / Supabase / store.
//
//   <Project xmlns="http://schemas.microsoft.com/project">
//     Name, Title, StartDate, FinishDate, calendar settings
//     <ExtendedAttributes>  definitions of the exported custom fields (Text1 = Kanban Stage, Number1 = Kanban Percent)
//     <Calendars>           one base calendar "Standard" (Mon-Fri, or all 7 days when the project counts weekends)
//     <Tasks>               every stage / task / milestone in tree order: UID, ID, Name, WBS, OutlineLevel, Start,
//                           Finish, Duration, Milestone, Summary, Critical, PercentComplete, constraint,
//                           <PredecessorLink> per dependency, <ExtendedAttribute> per custom field value
//   </Project>
//
// Element names and their ORDER follow the schema (MS Project reads the elements of a <Task> in sequence):
//   https://learn.microsoft.com/en-us/office-project/xml-data-interchange/project-elements-and-xml-structure?view=project-client-2016
//   https://learn.microsoft.com/en-us/office-project/xml-data-interchange/project-xml-data-interchange-schema-reference?view=project-client-2016
// Unit-tested in __tests__/pm/crud/exchange/msProjectXml.test.ts.

import { PMLinkType, PMScheduledRow, PMTaskDependencyRow, PMTaskRow } from '../../../model/types';

export const MSP_XMLNS = 'http://schemas.microsoft.com/project';
/** working time of a day in the exported calendar: 08:00-12:00 + 13:00-17:00 */
export const MSP_MINUTES_PER_DAY = 480;
/** FieldID of the task custom fields used for the export (Project XML schema: ExtendedAttribute/FieldID) */
export const MSP_FIELD_TEXT1 = 188743731;
export const MSP_FIELD_NUMBER1 = 188743767;
const DAY_MS = 24 * 60 * 60 * 1000;

/** PredecessorLink/Type: 0 = FF, 1 = FS, 2 = SF, 3 = SS */
export const MSP_LINK_TYPE: Record<PMLinkType, number> = { FF: 0, FS: 1, SF: 2, SS: 3 };

export interface MSProjectExportOptions {
  /** custom field Text1 "Kanban Stage" = the task's Kanban stage name */
  exportKanbanStage?: boolean;
  /** custom field Number1 "Kanban Percent" = the task's Kanban stage progress % */
  exportKanbanPercent?: boolean;
}

export interface MSProjectExportInput {
  projectName: string;
  /** rows in tree (display) order, parents before their children */
  rows: { task: PMTaskRow; outlineLevel: number; wbs: string; schedule: PMScheduledRow | undefined }[];
  dependencies: PMTaskDependencyRow[];
  /** UTC midnight of the first day / EXCLUSIVE finish (the day after the last day) */
  projectStartMs: number;
  projectFinishMs: number;
  /** true = Mon-Fri working week; false = all 7 days are working days */
  skipWeekends: boolean;
  kanbanStageNameByTask?: Record<string, string | null | undefined>;
  kanbanPercentByTask?: Record<string, number | null | undefined>;
  options?: MSProjectExportOptions;
  now?: Date;
  /** aliases of the custom fields (translated column titles); default "Kanban Stage" / "Kanban Percent" */
  kanbanStageAlias?: string;
  kanbanPercentAlias?: string;
}

/** Text safe inside an XML element (control characters that XML 1.0 forbids are removed). */
export function xmlEscape(value: unknown): string {
  return String(value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** UTC day + time of day -> "2026-10-06T08:00:00" (MS Project dates carry no time zone). */
export function mspDateTime(dayMs: number, time: '08:00:00' | '17:00:00' | '00:00:00' = '08:00:00'): string {
  const d = new Date(dayMs);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${time}`;
}

/** working days -> "PT16H0M0S" (the schema's duration: hours of working time) */
export function mspDuration(workingDays: number): string {
  const hours = Math.max(0, Math.round((Number(workingDays) || 0) * (MSP_MINUTES_PER_DAY / 60) * 100) / 100);
  return `PT${hours}H0M0S`;
}

/** lag in working days -> LinkLag (tenths of a minute) */
export const mspLinkLag = (lagDays: number): number => Math.round((Number(lagDays) || 0) * MSP_MINUTES_PER_DAY * 10);

/** "My project: plan/1" -> "My_project_plan_1_2026-10-06-09-23-00.xml" */
export function msProjectFileName(projectName: string | null | undefined, now = new Date()): string {
  const safe = (projectName || '').normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'project';
  return `${safe}_${now.toISOString().replace(/[:T]/g, '-').slice(0, 19)}.xml`;
}

const el = (name: string, value: unknown, indent: string) => `${indent}<${name}>${xmlEscape(value)}</${name}>\n`;

function calendarXml(skipWeekends: boolean): string {
  let out = '  <Calendars>\n    <Calendar>\n      <UID>1</UID>\n      <Name>Standard</Name>\n      <IsBaseCalendar>1</IsBaseCalendar>\n      <BaseCalendarUID>-1</BaseCalendarUID>\n      <WeekDays>\n';
  // DayType: 1 = Sunday ... 7 = Saturday
  for (let day = 1; day <= 7; day++) {
    const working = !(skipWeekends && (day === 1 || day === 7));
    out += `        <WeekDay>\n          <DayType>${day}</DayType>\n          <DayWorking>${working ? 1 : 0}</DayWorking>\n`;
    if (working) {
      out +=
        '          <WorkingTimes>\n' +
        '            <WorkingTime>\n              <FromTime>08:00:00</FromTime>\n              <ToTime>12:00:00</ToTime>\n            </WorkingTime>\n' +
        '            <WorkingTime>\n              <FromTime>13:00:00</FromTime>\n              <ToTime>17:00:00</ToTime>\n            </WorkingTime>\n' +
        '          </WorkingTimes>\n';
    }
    out += '        </WeekDay>\n';
  }
  return `${out}      </WeekDays>\n    </Calendar>\n  </Calendars>\n`;
}

/** The whole .xml file text. */
export function buildMSProjectXml(input: MSProjectExportInput): string {
  const { rows, dependencies, skipWeekends } = input;
  const opts = input.options || {};
  const now = input.now || new Date();
  const created = now.toISOString().slice(0, 19);
  const uidByGUID: Record<string, number> = {};
  rows.forEach((r, i) => {
    uidByGUID[r.task.rowGUID] = i + 1;
  });
  const depsBySuccessor: Record<string, PMTaskDependencyRow[]> = {};
  for (const d of dependencies) {
    if (!uidByGUID[d.rowGUID] || !uidByGUID[d.rowDependsOnGUID]) continue;
    (depsBySuccessor[d.rowGUID] = depsBySuccessor[d.rowGUID] || []).push(d);
  }
  const lastDay = Math.max(input.projectStartMs, input.projectFinishMs - DAY_MS);
  const workDaysPerWeek = skipWeekends ? 5 : 7;
  const name = (input.projectName || '').trim() || 'Project';

  let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  xml += `<Project xmlns="${MSP_XMLNS}">\n`;
  xml += el('SaveVersion', 14, '  ');
  xml += el('Name', name, '  ');
  xml += el('Title', name, '  ');
  xml += el('CreationDate', created, '  ');
  xml += el('LastSaved', created, '  ');
  xml += el('ScheduleFromStart', 1, '  ');
  xml += el('StartDate', mspDateTime(input.projectStartMs), '  ');
  xml += el('FinishDate', mspDateTime(lastDay, '17:00:00'), '  ');
  xml += el('FYStartDate', 1, '  ');
  xml += el('CriticalSlackLimit', 0, '  ');
  xml += el('CurrencyDigits', 2, '  ');
  xml += el('CalendarUID', 1, '  ');
  xml += el('DefaultStartTime', '08:00:00', '  ');
  xml += el('DefaultFinishTime', '17:00:00', '  ');
  xml += el('MinutesPerDay', MSP_MINUTES_PER_DAY, '  ');
  xml += el('MinutesPerWeek', MSP_MINUTES_PER_DAY * workDaysPerWeek, '  ');
  xml += el('DaysPerMonth', skipWeekends ? 20 : 30, '  ');
  xml += el('DefaultTaskType', 0, '  ');
  xml += el('DurationFormat', 7, '  ');
  xml += el('WorkFormat', 2, '  ');
  xml += el('WeekStartDay', 1, '  ');
  xml += el('NewTasksAreManual', 0, '  ');

  if (opts.exportKanbanStage || opts.exportKanbanPercent) {
    xml += '  <ExtendedAttributes>\n';
    if (opts.exportKanbanStage) {
      xml += `    <ExtendedAttribute>\n      <FieldID>${MSP_FIELD_TEXT1}</FieldID>\n      <FieldName>Text1</FieldName>\n${el('Alias', input.kanbanStageAlias || 'Kanban Stage', '      ')}    </ExtendedAttribute>\n`;
    }
    if (opts.exportKanbanPercent) {
      xml += `    <ExtendedAttribute>\n      <FieldID>${MSP_FIELD_NUMBER1}</FieldID>\n      <FieldName>Number1</FieldName>\n${el('Alias', input.kanbanPercentAlias || 'Kanban Percent', '      ')}    </ExtendedAttribute>\n`;
    }
    xml += '  </ExtendedAttributes>\n';
  }

  xml += calendarXml(skipWeekends);

  xml += '  <Tasks>\n';
  rows.forEach((r, i) => {
    const { task, schedule: s } = r;
    const kind = task.rowJSON?.rowKind;
    const milestone = !!(s?.isMilestone || kind === 'milestone');
    const summary = !!s?.isSummary;
    const startMs = s?.startMs ?? input.projectStartMs;
    // exclusive finish -> the last day of the task (a milestone starts and finishes at the same moment)
    const finishDay = milestone ? startMs : Math.max(startMs, (s?.finishMs ?? startMs + DAY_MS) - DAY_MS);
    const days = milestone ? 0 : Math.max(0, s?.durationDays ?? Number(task.rowJSON?.durationDays) ?? 0);
    const percent = Math.max(0, Math.min(100, Math.round(s?.progress ?? task.rowProgress ?? 0)));
    const constraintMs = !summary && task.rowJSON?.manualStartAt ? Date.parse(task.rowJSON.manualStartAt) : NaN;
    const T = '      ';
    xml += '    <Task>\n';
    xml += el('UID', i + 1, T);
    xml += el('ID', i + 1, T);
    xml += el('Name', task.rowJSON?.name || '', T);
    xml += el('Type', summary ? 1 : 0, T);
    xml += el('IsNull', 0, T);
    xml += el('CreateDate', (task.created_at || '').slice(0, 19) || created, T);
    xml += el('WBS', r.wbs, T);
    xml += el('OutlineNumber', r.wbs, T);
    xml += el('OutlineLevel', Math.max(1, r.outlineLevel), T);
    xml += el('Priority', 500, T);
    xml += el('Start', mspDateTime(startMs), T);
    xml += el('Finish', mspDateTime(finishDay, milestone ? '08:00:00' : '17:00:00'), T);
    xml += el('Duration', mspDuration(days), T);
    xml += el('DurationFormat', 7, T);
    xml += el('EffortDriven', 0, T);
    xml += el('Estimated', 0, T);
    xml += el('Milestone', milestone ? 1 : 0, T);
    xml += el('Summary', summary ? 1 : 0, T);
    xml += el('Critical', s?.isCritical ? 1 : 0, T);
    xml += el('PercentComplete', percent, T);
    // 0 = as soon as possible, 4 = start no earlier than
    xml += el('ConstraintType', Number.isFinite(constraintMs) ? 4 : 0, T);
    xml += el('CalendarUID', -1, T);
    if (Number.isFinite(constraintMs)) xml += el('ConstraintDate', mspDateTime(constraintMs), T);
    if (task.rowJSON?.notes) xml += el('Notes', task.rowJSON.notes, T);
    for (const d of depsBySuccessor[task.rowGUID] || []) {
      xml += `${T}<PredecessorLink>\n`;
      xml += el('PredecessorUID', uidByGUID[d.rowDependsOnGUID], `${T}  `);
      xml += el('Type', MSP_LINK_TYPE[d.linkType] ?? 1, `${T}  `);
      xml += el('CrossProject', 0, `${T}  `);
      xml += el('LinkLag', mspLinkLag(d.lagDays), `${T}  `);
      xml += el('LagFormat', 7, `${T}  `);
      xml += `${T}</PredecessorLink>\n`;
    }
    if (opts.exportKanbanStage) {
      const stage = input.kanbanStageNameByTask?.[task.rowGUID];
      if (stage) xml += `${T}<ExtendedAttribute>\n${el('FieldID', MSP_FIELD_TEXT1, `${T}  `)}${el('Value', stage, `${T}  `)}${T}</ExtendedAttribute>\n`;
    }
    if (opts.exportKanbanPercent) {
      const p = input.kanbanPercentByTask?.[task.rowGUID];
      if (p !== null && p !== undefined && Number.isFinite(Number(p))) {
        xml += `${T}<ExtendedAttribute>\n${el('FieldID', MSP_FIELD_NUMBER1, `${T}  `)}${el('Value', Math.round(Number(p)), `${T}  `)}${T}</ExtendedAttribute>\n`;
      }
    }
    xml += '    </Task>\n';
  });
  xml += '  </Tasks>\n';
  xml += '  <Resources/>\n  <Assignments/>\n';
  xml += '</Project>\n';
  return xml;
}
