// costModel - the PURE model of the cost calculator: parameters -> volumes -> resources -> dollars (no React, no network).
// Spec: documentation/PRICE_PLAN_CALCULATOR.html sections 3-6 (its "Live sketch" is the reference: __tests__/system/costcalculator compares this port with the sketch's numbers).
// Estimate of the Supabase cloud bill of ONE Supabase project (the whole bill, as if this organization had it alone: spec Q4). USD per month.

import { DEFAULT_COEFFICIENTS, type CostCoefficients } from './costCoefficients';
import { BUILT_IN_PRICES, type ComputeSize, type SupabasePriceList } from './supabasePrices';

export type SupabasePlan = 'pro' | 'team';

/** The parameters of the administrator (section 3 of the spec: the owner's list first, then the advanced ones). */
export interface CostInput {
  numberOfProjects: number;
  maximumTasksInOneProject: number;
  maximumPlanLinesInOneProject: number;
  numberOfUsers: number;
  dateChangesPerMonth: number;
  planLineChangesPerMonth: number;
  taskPostsPerMonth: number;
  documentsPostedPerMonth: number;
  roiForTasksEnabled: boolean;
  roiHistoryEnabled: boolean;
  reportRequestsPerMonth: number;
  reportOpenMinutes: number;
  // advanced
  averageProjectFillPercent: number;
  planRowsPerLine: number;
  concurrentUsersPercent: number;
  projectOpensPerUserPerDay: number;
  savedVersionsPerProject: number;
  monthsOfDocumentsKept: number;
  cronLogCleaned: boolean;
  realtimeEnabled: boolean;
  plan: SupabasePlan;
  secondEnvironment: boolean;
  pointInTimeRecovery: boolean;
  customDomain: boolean;
  ipv4Address: boolean;
}

export const DEFAULT_COST_INPUT: CostInput = {
  numberOfProjects: 20,
  maximumTasksInOneProject: 500,
  maximumPlanLinesInOneProject: 1000,
  numberOfUsers: 30,
  dateChangesPerMonth: 2000,
  planLineChangesPerMonth: 3000,
  taskPostsPerMonth: 1500,
  documentsPostedPerMonth: 200,
  roiForTasksEnabled: false,
  roiHistoryEnabled: false,
  reportRequestsPerMonth: 1000,
  reportOpenMinutes: 10,
  averageProjectFillPercent: 60,
  planRowsPerLine: 6,
  concurrentUsersPercent: 30,
  projectOpensPerUserPerDay: 4,
  savedVersionsPerProject: 2,
  monthsOfDocumentsKept: 24,
  cronLogCleaned: true,
  realtimeEnabled: true,
  plan: 'pro',
  secondEnvironment: false,
  pointInTimeRecovery: false,
  customDomain: false,
  ipv4Address: false,
};

const INPUT_KEYS = Object.keys(DEFAULT_COST_INPUT) as (keyof CostInput)[];
const PERCENT_RANGE: Partial<Record<keyof CostInput, [number, number]>> = { averageProjectFillPercent: [1, 100], concurrentUsersPercent: [0, 100] };

/** A complete, valid input from anything: a missing / bad value takes the default, a number is not negative, a percent stays in its range. */
export function normalizeCostInput(raw?: Partial<CostInput> | null): CostInput {
  const out: any = { ...DEFAULT_COST_INPUT };
  if (!raw || typeof raw !== 'object') return out;
  for (const k of INPUT_KEYS) {
    const def = DEFAULT_COST_INPUT[k];
    const v = (raw as any)[k];
    if (k === 'plan') out[k] = v === 'team' ? 'team' : v === 'pro' ? 'pro' : def;
    else if (typeof def === 'boolean') out[k] = typeof v === 'boolean' ? v : def;
    else if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      const r = PERCENT_RANGE[k];
      out[k] = r ? Math.min(r[1], Math.max(r[0], v)) : v;
    } else out[k] = def;
  }
  return out;
}

/** A stored value that has every key with the right type (what the device keeps between visits). */
export function isCostInput(v: unknown): v is CostInput {
  if (!v || typeof v !== 'object') return false;
  return INPUT_KEYS.every((k) => {
    const x = (v as any)[k];
    const def = DEFAULT_COST_INPUT[k];
    if (k === 'plan') return x === 'pro' || x === 'team';
    return typeof x === typeof def && (typeof x !== 'number' || Number.isFinite(x));
  });
}

/** The four example sizes of section 7: changes, posts, documents and report requests grow with the users when the example does not set them. */
export interface CostExample { id: string; title: string; overrides: Partial<CostInput> }
export const COST_EXAMPLES: readonly CostExample[] = [
  { id: 'small', title: 'Small team', overrides: { numberOfProjects: 5, maximumTasksInOneProject: 200, maximumPlanLinesInOneProject: 400, numberOfUsers: 5 } },
  { id: 'medium', title: 'Medium (the defaults)', overrides: {} },
  { id: 'large', title: 'Large', overrides: { numberOfProjects: 200, maximumTasksInOneProject: 2000, maximumPlanLinesInOneProject: 5000, numberOfUsers: 300 } },
  { id: 'veryLarge', title: 'Very large', overrides: { numberOfProjects: 1000, maximumTasksInOneProject: 10000, maximumPlanLinesInOneProject: 20000, numberOfUsers: 2000 } },
];

const ACTIVITY_KEYS = ['dateChangesPerMonth', 'planLineChangesPerMonth', 'taskPostsPerMonth', 'documentsPostedPerMonth', 'reportRequestsPerMonth'] as const;

export function costExampleInput(overrides: Partial<CostInput>): CostInput {
  const i: CostInput = { ...DEFAULT_COST_INPUT, ...overrides };
  const f = i.numberOfUsers / DEFAULT_COST_INPUT.numberOfUsers;
  for (const k of ACTIVITY_KEYS) if (!(k in overrides)) i[k] = Math.round(DEFAULT_COST_INPUT[k] * f);
  return normalizeCostInput(i);
}

// ---------------------------------------------------------------------------------------------- result

export type LimitingFactor = 'memory' | 'cpu' | 'databaseSize' | 'biggestProject' | 'pointInTimeRecovery' | 'aboveList';

/** A line of the bill. text is an English pmT key with {{placeholders}} filled from values. */
export interface BillLine { id: string; text: string; values?: Record<string, string | number>; usd: number }
export interface DiskPart { id: string; text: string; kb: number }

export interface CostResult {
  totalPerMonth: number;
  totalPerYear: number;
  perUser: number;
  perProject: number;
  bill: BillLine[];
  machine: ComputeSize;
  /** why the size before the chosen one was rejected; null = the smallest paid machine is enough */
  limitingFactor: LimitingFactor | null;
  /** share of the steady CPU of the machine the busy hour uses */
  cpuLoad: number;
  memoryLoad: number;
  tasksTotal: number;
  linesTotal: number;
  planRowsTotal: number;
  databaseGB: number;
  diskGB: number;
  /** the parts of the database, biggest first */
  diskParts: DiskPart[];
  neededMemoryGB: number;
  neededVcpu: number;
  realtimeConnections: number;
  realtimeMessages: number;
  egressGB: number;
}

const KB_PER_GB = 1048576;

export function calculateCosts(rawInput: CostInput, prices: SupabasePriceList = BUILT_IN_PRICES, k: CostCoefficients = DEFAULT_COEFFICIENTS): CostResult {
  const i = normalizeCostInput(rawInput);
  const months = i.monthsOfDocumentsKept;

  // step 1 - volumes
  const fill = i.averageProjectFillPercent / 100;
  const tasksAvg = i.maximumTasksInOneProject * fill;
  const linesAvg = i.maximumPlanLinesInOneProject * fill;
  const tasksTotal = i.numberOfProjects * tasksAvg;
  const linesTotal = i.numberOfProjects * linesAvg;
  const planRowsTotal = linesTotal * i.planRowsPerLine;
  const peakClients = Math.ceil((i.numberOfUsers * i.concurrentUsersPercent) / 100);

  // step 2 - disk
  const diskParts: DiskPart[] = [
    { id: 'planRows', text: 'Plan rows', kb: planRowsTotal * k.kbPlanRow },
    { id: 'linesAndReports', text: 'Task lines + report rows', kb: linesTotal * (k.kbLine + k.kbReportPerLine) },
    { id: 'tasksAndLinks', text: 'Tasks + links', kb: tasksTotal * (k.kbTask + k.kbLinks) },
    { id: 'versions', text: 'Saved versions', kb: i.savedVersionsPerProject * (tasksTotal * k.kbTask + linesTotal * k.kbLine) },
    { id: 'documents', text: 'Documents', kb: i.documentsPostedPerMonth * months * k.kbDocument },
    { id: 'roi', text: 'ROI', kb: (i.roiForTasksEnabled ? tasksTotal * k.kbRoiTask : 0) + (i.roiHistoryEnabled ? i.taskPostsPerMonth * months * k.kbRoiHistory : 0) },
    { id: 'cronLog', text: 'pg_cron log', kb: k.cronRowsPerMonth * k.kbCronRow * (i.cronLogCleaned ? 7 / 30 : months) },
    { id: 'emptyDatabase', text: 'Empty database', kb: k.emptyDatabaseMB * 1024 },
  ];
  const dataKB = diskParts.reduce((s, p) => s + p.kb, 0);
  const databaseGB = (dataKB / KB_PER_GB) * k.bloat;
  const diskGB = Math.max(prices.included.diskGBPerProject, Math.ceil((databaseGB + k.walSystemGB) * k.freeSpace));

  // CPU
  const opens = i.numberOfUsers * i.projectOpensPerUserPerDay * k.workDaysPerMonth;
  const stampCalls = i.reportRequestsPerMonth * i.reportOpenMinutes * k.checksPerMinute;
  const rowsPerTask = tasksAvg > 0 ? (linesAvg / tasksAvg) * i.planRowsPerLine : 0;
  const workMs =
    i.dateChangesPerMonth * (k.msDateBase + k.msDatePerTask * tasksAvg) +
    i.planLineChangesPerMonth * k.msLine +
    i.taskPostsPerMonth * (k.msPostBase + k.msPostPerPlanRow * rowsPerTask + k.msWorkerTask + (i.roiForTasksEnabled ? k.msRoiTask : 0)) +
    i.documentsPostedPerMonth * k.msDocument +
    i.reportRequestsPerMonth * (k.msReportBase + k.msReportPerLine * linesAvg) +
    stampCalls * k.msStamp +
    opens * (k.msOpenBase + k.msOpenPerRow * (tasksAvg + linesAvg));
  const neededVcpu = (workMs / (k.workHours * 3.6e6)) * k.peakFactor + (k.cronRowsPerMonth * k.msCronTick) / (k.hoursPerMonth * 3.6e6);

  // memory
  const neededMemoryGB = k.ramBaseGB + databaseGB * k.hotShare + peakClients * k.ramPerClientGB;

  // Realtime and traffic
  const realtimeConnections = i.realtimeEnabled ? Math.ceil(peakClients * k.tabsPerUser) : 0;
  const changedRows =
    i.dateChangesPerMonth * k.rowsPerDateChange +
    i.planLineChangesPerMonth +
    i.taskPostsPerMonth * (1 + (tasksAvg > 0 ? linesAvg / tasksAvg : 0) * k.reportRowsPerLine) +
    i.documentsPostedPerMonth * k.rowsPerDocument;
  const listeners = Math.max(1, peakClients / Math.max(1, Math.min(i.numberOfProjects, peakClients)));
  const realtimeMessages = i.realtimeEnabled ? changedRows * listeners : 0;
  const egressGB =
    (opens * (tasksAvg * k.kbTaskJson + linesAvg * k.kbLineJson) +
      i.reportRequestsPerMonth * linesAvg * k.reportRowsPerLine * k.kbReportJson +
      realtimeMessages * k.kbMessage +
      stampCalls * k.kbStamp) /
    KB_PER_GB;

  // step 3 - the machine: the FIRST size that passes all five tests; the test that rejected the size before it is the limiting factor
  const sizes = prices.compute;
  const minIndex = i.maximumTasksInOneProject > k.tasksForLarge ? 3 : i.maximumTasksInOneProject > k.tasksForMedium ? 2 : i.maximumTasksInOneProject > k.tasksForSmall ? 1 : 0;
  let machine: ComputeSize | null = null;
  let limitingFactor: LimitingFactor | null = null;
  for (let n = 0; n < sizes.length; n++) {
    const s = sizes[n];
    const fail: LimitingFactor | null =
      s.memoryGB < neededMemoryGB ? 'memory'
        : s.vcpu * k.targetLoad < neededVcpu ? 'cpu'
          : s.maxDatabaseGB < databaseGB ? 'databaseSize'
            : n < minIndex ? 'biggestProject'
              : i.pointInTimeRecovery && n < 1 ? 'pointInTimeRecovery'
                : null;
    if (!fail) { machine = s; break; }
    limitingFactor = fail;
  }
  if (!machine) { machine = sizes[sizes.length - 1]; limitingFactor = 'aboveList'; }

  // step 4 - dollars
  const plan = prices.plans[i.plan];
  const inc = prices.included;
  const over = prices.overage;
  const money = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  const bill: BillLine[] = [
    { id: 'planFee', text: 'Plan fee ({{plan}})', values: { plan: i.plan === 'pro' ? 'Pro' : 'Team' }, usd: plan.fee },
    { id: 'machine', text: 'Virtual machine {{size}} minus {{credits}} of credits', values: { size: machine.size, credits: plan.computeCredits }, usd: Math.max(0, machine.perMonth - plan.computeCredits) },
    { id: 'secondEnvironment', text: 'Second environment (Micro)', usd: i.secondEnvironment ? sizes[0].perMonth : 0 },
    { id: 'disk', text: 'Disk above {{gb}} GB', values: { gb: inc.diskGBPerProject }, usd: Math.max(0, diskGB - inc.diskGBPerProject) * over.diskGB },
    { id: 'egress', text: 'Egress above {{gb}} GB', values: { gb: inc.egressGB }, usd: Math.max(0, egressGB - inc.egressGB) * over.egressGB },
    { id: 'realtimeConnections', text: 'Realtime connections above {{n}}', values: { n: money(inc.realtimeConnections) }, usd: (Math.max(0, realtimeConnections - inc.realtimeConnections) / 1000) * over.realtimeConnectionsPer1000 },
    { id: 'realtimeMessages', text: 'Realtime messages above {{n}} million', values: { n: inc.realtimeMessages / 1e6 }, usd: (Math.max(0, realtimeMessages - inc.realtimeMessages) / 1e6) * over.realtimeMessagesPerMillion },
    { id: 'users', text: 'Users above {{n}}', values: { n: money(inc.monthlyActiveUsers) }, usd: Math.max(0, i.numberOfUsers - inc.monthlyActiveUsers) * over.monthlyActiveUser },
    { id: 'addons', text: 'Add-ons', usd: (i.pointInTimeRecovery ? prices.addons.pointInTimeRecoveryPer7Days : 0) + (i.customDomain ? prices.addons.customDomain : 0) + (i.ipv4Address ? prices.addons.ipv4 : 0) },
  ];
  const totalPerMonth = bill.reduce((s, b) => s + b.usd, 0);

  return {
    totalPerMonth,
    totalPerYear: totalPerMonth * 12,
    perUser: totalPerMonth / Math.max(1, i.numberOfUsers),
    perProject: totalPerMonth / Math.max(1, i.numberOfProjects),
    bill,
    machine,
    limitingFactor,
    cpuLoad: neededVcpu / machine.vcpu,
    memoryLoad: neededMemoryGB / machine.memoryGB,
    tasksTotal,
    linesTotal,
    planRowsTotal,
    databaseGB,
    diskGB,
    diskParts: [...diskParts].sort((a, b) => b.kb - a.kb),
    neededMemoryGB,
    neededVcpu,
    realtimeConnections,
    realtimeMessages,
    egressGB,
  };
}

/** The disk to pay for after the given number of months of the same activity (documents, ROI history and an uncleaned pg_cron log only grow). */
export function diskAfterMonths(input: CostInput, months: number, prices: SupabasePriceList = BUILT_IN_PRICES, k: CostCoefficients = DEFAULT_COEFFICIENTS): number {
  return calculateCosts({ ...normalizeCostInput(input), monthsOfDocumentsKept: months }, prices, k).diskGB;
}

export interface MachineChange { size: string; perMonth: number; projects: number; users: number }

const scaledInput = (i: CostInput, f: number): CostInput => {
  const o: CostInput = { ...i, numberOfProjects: Math.ceil(i.numberOfProjects * f), numberOfUsers: Math.ceil(i.numberOfUsers * f) };
  for (const key of ACTIVITY_KEYS) o[key] = Math.round(i[key] * f);
  return o;
};

/**
 * "The next size is needed at about ...": the model is run upward - projects, users and their activity grow together by the same factor, the biggest project stays -
 * until the machine becomes bigger. null = the machine does not change up to x 1 000 (or it is already the last size).
 */
export function nextMachineChange(input: CostInput, prices: SupabasePriceList = BUILT_IN_PRICES, k: CostCoefficients = DEFAULT_COEFFICIENTS, maxFactor = 1000): MachineChange | null {
  const base = normalizeCostInput(input);
  const indexOf = (r: CostResult) => prices.compute.findIndex((s) => s.size === r.machine.size);
  const start = calculateCosts(base, prices, k);
  const startIndex = indexOf(start);
  if (startIndex < 0 || startIndex >= prices.compute.length - 1 || start.limitingFactor === 'aboveList') return null;
  const bigger = (f: number) => indexOf(calculateCosts(scaledInput(base, f), prices, k)) > startIndex;
  let lo = 1;
  let hi = 1;
  while (hi < maxFactor) {
    lo = hi;
    hi = Math.min(maxFactor, hi * 1.2);
    if (bigger(hi)) break;
    if (hi >= maxFactor) return null;
  }
  if (!bigger(hi)) return null;
  for (let n = 0; n < 30; n++) {
    const mid = (lo + hi) / 2;
    if (bigger(mid)) hi = mid; else lo = mid;
  }
  const at = scaledInput(base, hi);
  const next = calculateCosts(at, prices, k).machine;
  return { size: next.size, perMonth: next.perMonth, projects: at.numberOfProjects, users: at.numberOfUsers };
}
