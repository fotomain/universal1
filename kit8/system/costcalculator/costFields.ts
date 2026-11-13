// costFields - the parameters of the screen in the order of section 3 of documentation/PRICE_PLAN_CALCULATOR.html: the owner's list first, the advanced ones folded.
// label / hint are English pmT keys.
import type { CostInput } from './costModel';

export type CostFieldKind = 'number' | 'decimal' | 'boolean' | 'plan';

export interface CostField {
  key: keyof CostInput;
  label: string;
  kind: CostFieldKind;
  /** a sub-parameter of the line above (the spec indents it) */
  indent?: boolean;
  hint?: string;
}

export interface CostFieldGroup { id: string; title: string; folded?: boolean; fields: CostField[] }

export const COST_FIELD_GROUPS: readonly CostFieldGroup[] = [
  {
    id: 'owner',
    title: 'The parameters',
    fields: [
      { key: 'numberOfProjects', label: 'Number of projects', kind: 'number', hint: 'Projects that hold data (open and finished): disk and memory.' },
      { key: 'maximumTasksInOneProject', label: 'Maximum tasks in one project', kind: 'number', hint: 'Stages + tasks + milestones of the biggest project: the smallest machine that can open and post it.' },
      { key: 'maximumPlanLinesInOneProject', label: 'Maximum lines in plans', kind: 'number', indent: true, hint: 'Task lines of the biggest project: the largest part of the disk.' },
      { key: 'numberOfUsers', label: 'Number of users', kind: 'number', hint: 'Users who sign in during a month: connections, opens of projects, traffic.' },
    ],
  },
  {
    id: 'changes',
    title: 'Number of data changes per month',
    fields: [
      { key: 'dateChangesPerMonth', label: 'Dates', kind: 'number', indent: true, hint: 'A task moved, resized or linked: it reschedules the tasks behind it.' },
      { key: 'planLineChangesPerMonth', label: 'Planning data lines', kind: 'number', indent: true, hint: 'A task line added, edited or deleted.' },
      { key: 'taskPostsPerMonth', label: 'Posts of tasks', kind: 'number', indent: true, hint: 'The plan of a task calculated again: the heaviest everyday write.' },
      { key: 'documentsPostedPerMonth', label: 'Documents posted', kind: 'number', indent: true, hint: 'Fact input, invoices, orders, receipts, payments, time sheets: kept for ever.' },
    ],
  },
  {
    id: 'roiReports',
    title: 'ROI calculations and reports',
    fields: [
      { key: 'roiForTasksEnabled', label: 'ROI for tasks', kind: 'boolean', hint: 'Adds a worker step and rows per task.' },
      { key: 'roiHistoryEnabled', label: 'ROI history', kind: 'boolean', hint: 'Adds a row per change, for ever.' },
      { key: 'reportRequestsPerMonth', label: 'Reports requests per month', kind: 'number', hint: 'Monitor01, 02, 03, 07 opened or refreshed.' },
      { key: 'reportOpenMinutes', label: 'Minutes a report stays open', kind: 'number', indent: true, hint: 'An open Monitor01 asks the database every 3 seconds.' },
    ],
  },
  {
    id: 'advanced',
    title: 'Advanced',
    folded: true,
    fields: [
      { key: 'averageProjectFillPercent', label: 'Average project, % of the maximum', kind: 'number', hint: 'The owner gives maximums; the disk needs the sum (1..100).' },
      { key: 'planRowsPerLine', label: 'Plan rows per line', kind: 'decimal', hint: 'A line is spread over the days or months of its task. Measured: 5.6.' },
      { key: 'concurrentUsersPercent', label: 'Users online at the busiest moment, %', kind: 'number', hint: 'Realtime connections and memory (0..100).' },
      { key: 'projectOpensPerUserPerDay', label: 'Project opens per user and working day', kind: 'decimal', hint: 'Each open reads all tasks and lines of the project.' },
      { key: 'savedVersionsPerProject', label: 'Saved versions per project', kind: 'number', hint: 'A version is a copy of the tasks and lines.' },
      { key: 'monthsOfDocumentsKept', label: 'Months of documents kept', kind: 'number', hint: 'Documents and the ROI history only grow.' },
      { key: 'cronLogCleaned', label: 'pg_cron log is cleaned (keeps 7 days)', kind: 'boolean', hint: 'Off shows what happens today: the log is never cleaned.' },
      { key: 'realtimeEnabled', label: 'Realtime on', kind: 'boolean', hint: 'Off: no messages, no connections.' },
      { key: 'plan', label: 'Supabase plan', kind: 'plan' },
      { key: 'secondEnvironment', label: 'Second environment (DEV / test project)', kind: 'boolean', hint: 'One more Micro machine in the same organization.' },
      { key: 'pointInTimeRecovery', label: 'Point in time recovery', kind: 'boolean', hint: 'Needs at least a Small machine.' },
      { key: 'customDomain', label: 'Custom domain', kind: 'boolean' },
      { key: 'ipv4Address', label: 'IPv4 address', kind: 'boolean' },
    ],
  },
];
