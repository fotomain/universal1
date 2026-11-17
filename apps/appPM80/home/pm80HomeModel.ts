import { RoiMoney, roiOfMoney, formatRoi, roiTone } from '../../../kit8/pm/reports/roi/roiModel';
import { RoiTaxSettings } from '../../../kit8/pm/reports/roi/roiSettings';

export type RoiKindKey = 'roi1' | 'roi2' | 'roi3' | 'roi4';

/**
 * The BUSINESS ORDER of the real parts of the application (the chain a project manager walks):
 *   1 Plan -> 2 Purchase order -> 3 Product receipt -> 4 Time sheet -> 5 Fact input
 *   -> 6 Vendor invoice -> 7 Customer invoice -> 8 Payment (cash)
 * Every step is a real module of the app (a Drawer screen) and writes its own column of Monitor01.
 */
export type PM80Stage = 'Plan' | 'Procure' | 'Execute' | 'Invoice' | 'Cash';

export interface PM80AdvancedMetric {
  id: string;
  label: string;
  sublabel: string;
  valueText: string;
  /** 0 to 100 for circular progress arc */
  progress: number;
  icon: string;
  status: 'optimal' | 'good' | 'warning' | 'critical';
  formulaTip: string;
  route: string;
}

export interface PM80SatelliteNode {
  id: string;
  /** Name of the Drawer screen it opens (two lines with \n so all circles line up) */
  label: string;
  /** 1..8 = the place in the business order (shown as a badge and in the flow strip) */
  step: number;
  stage: PM80Stage;
  /** The register / document behind the circle */
  genusOrDomain: string;
  /** Top muted value */
  planLabel: string;
  planAmount: number;
  planCaption: string;
  /** Bottom bold value */
  factLabel: string;
  factAmount: number;
  factCaption: string;
  icon: string;
  /** Node position around the central ROI hub (reading order = business order) */
  position:
    | 'top-left'
    | 'top-right'
    | 'mid-left'
    | 'mid-right'
    | 'lower-left'
    | 'lower-right'
    | 'bottom-left'
    | 'bottom-right';
  /** Pastel background & icon tint for Light/Dark modes */
  accentColor: string;
  pastelBgLight: string;
  pastelBgDark: string;
  /** A REAL route of `app/` (a Jest test checks that the file exists) */
  route: string;
  description: string;
  /** hover tip of the circle (one short sentence) */
  tip: string;
}

export interface PM80MonthSnapshot {
  monthKey: string; // e.g., '2026-11'
  monthLabel: string; // e.g., 'NOVEMBER 2026'
  projectTitle: string;
  projectCount: number;
  currencySymbol: string;
  /** Goal / Target Net Profit in EUR */
  goalNetProfit: number;
  /** Underlying 15 additive money components from kit8/pm/reports/roi */
  money: RoiMoney;
  /** KPI row (budget used, capacity, delivered, collected) */
  advancedMetrics: PM80AdvancedMetric[];
  /** 8 circles = the business order of the app */
  satellites: PM80SatelliteNode[];
}

/** A shortcut button of the bottom bar (real route). */
export interface PM80QuickLink {
  id: string;
  label: string;
  icon: string;
  route: string;
  group: 'reports' | 'team';
  /** hover tip */
  tip: string;
}

export const PM80_QUICK_LINKS: PM80QuickLink[] = [
  { id: 'monitor01', label: 'Plan vs fact', icon: 'view-dashboard-outline', route: '/pm/reports/monitor01', group: 'reports', tip: 'Monitor01: plan, ordered, received, used and invoiced per task and month.' },
  { id: 'monitor02', label: 'ROI now', icon: 'chart-donut-variant', route: '/pm/reports/monitor02', group: 'reports', tip: 'Monitor02: ROI1-ROI4 now, per project and per task.' },
  { id: 'monitor03', label: 'ROI history', icon: 'chart-timeline-variant', route: '/pm/reports/monitor03', group: 'reports', tip: 'Monitor03: how ROI1-ROI4 changed month by month.' },
  { id: 'balances', label: 'Balances', icon: 'scale-balance', route: '/pm/reports/monitor07/customer', group: 'reports', tip: 'Monitor07: what customers owe us (the vendor balance is on the same screen).' },
  { id: 'chat', label: 'Chat', icon: 'message-text-outline', route: '/chat', group: 'team', tip: 'Chat: themes and the chats of your tasks.' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar-month-outline', route: '/user/calendar', group: 'team', tip: 'Your calendar with events, tasks and reminders.' },
  { id: 'workcenters', label: 'Work centers', icon: 'account-group-outline', route: '/catalog/work/center', group: 'team', tip: 'Work centers: people, equipment and partners you can book, with their calendars.' },
  { id: 'accounts', label: 'Bank accounts', icon: 'bank-outline', route: '/catalog/money/account', group: 'team', tip: 'Money accounts: bank accounts and their rests after each payment.' },
];

/** The static part of a circle (the numbers come per month). */
interface StageDef {
  id: string;
  step: number;
  stage: PM80Stage;
  label: string;
  genusOrDomain: string;
  planCaption: string;
  factCaption: string;
  icon: string;
  position: PM80SatelliteNode['position'];
  accentColor: string;
  pastelBgLight: string;
  pastelBgDark: string;
  route: string;
  description: string;
  tip: string;
}

export const PM80_STAGES: StageDef[] = [
  {
    id: 'plan', step: 1, stage: 'Plan', label: 'Project\nplan',
    genusOrDomain: 'WBS, Gantt, Budgets',
    planCaption: 'Planned cost', factCaption: 'Planned profit',
    icon: 'chart-gantt', position: 'top-left',
    accentColor: '#1E88E5', pastelBgLight: '#93C5FD', pastelBgDark: '#1E3A8A',
    route: '/pm/project/dashboard',
    description: 'Project Dashboard: tasks, Gantt, task lines (Time, Material, Expense, Deliverable). Post the plan: it feeds the Plan column of Monitor01 and ROI1.',
    tip: 'Project plan: tasks, Gantt and budgets. Opens the Project Dashboard.',
  },
  {
    id: 'orders', step: 2, stage: 'Procure', label: 'Purchase\norders',
    genusOrDomain: 'Material + Expense lines',
    planCaption: 'Planned to buy', factCaption: 'Ordered',
    icon: 'cart-outline', position: 'top-right',
    accentColor: '#7C3AED', pastelBgLight: '#C4B5FD', pastelBgDark: '#4C1D95',
    route: '/pm/purchase-order/list',
    description: 'Purchase orders to vendors; a posted order fills the Ordered column of Monitor01.',
    tip: 'Purchase orders: what we order from vendors (Ordered column of Monitor01).',
  },
  {
    id: 'receipts', step: 3, stage: 'Procure', label: 'Product\nreceipts',
    genusOrDomain: 'Received goods',
    planCaption: 'Ordered', factCaption: 'Received',
    icon: 'package-variant-closed', position: 'mid-left',
    accentColor: '#D97706', pastelBgLight: '#FCD34D', pastelBgDark: '#78350F',
    route: '/pm/product-receipt/list',
    description: 'Product receipts made from a posted purchase order; fills the Received column of Monitor01.',
    tip: 'Product receipts: what the vendors delivered (Received column).',
  },
  {
    id: 'timesheets', step: 4, stage: 'Execute', label: 'Time\nsheets',
    genusOrDomain: 'Own staff hours (work centers)',
    planCaption: 'Planned time', factCaption: 'Hours posted',
    icon: 'clock-time-four-outline', position: 'mid-right',
    accentColor: '#EA580C', pastelBgLight: '#FDBA74', pastelBgDark: '#7C2D12',
    route: '/pm/timesheet/list',
    description: 'Time sheets of work centers (person, equipment, partner); the posted hours are the Used column and the own cost of ROI4.',
    tip: 'Time sheets: hours of people and equipment (Used column).',
  },
  {
    id: 'fact', step: 5, stage: 'Execute', label: 'Fact\ninput',
    genusOrDomain: 'Deliverable fact input',
    planCaption: 'Planned revenue', factCaption: 'Fact input',
    icon: 'clipboard-check-outline', position: 'lower-left',
    accentColor: '#E11D48', pastelBgLight: '#FDA4AF', pastelBgDark: '#881337',
    route: '/pm/fact/list',
    description: 'Fact input of used quantities and of the Revenue lines: the numerator of ROI2 (plan - fact input).',
    tip: 'Fact input: what was really used and delivered (ROI2).',
  },
  {
    id: 'vendorInvoices', step: 6, stage: 'Invoice', label: 'Vendor\ninvoices',
    genusOrDomain: 'Vendor invoiced (cost)',
    planCaption: 'Planned', factCaption: 'Invoiced',
    icon: 'file-document-outline', position: 'lower-right',
    accentColor: '#475569', pastelBgLight: '#94A3B8', pastelBgDark: '#334155',
    route: '/pm/vendor-invoice/list',
    description: 'Vendor invoices (what suppliers bill us); the Vendor Invoice columns of Monitor01 and the cost of ROI4.',
    tip: 'Vendor invoices: what vendors bill us (cost of ROI4).',
  },
  {
    id: 'customerInvoices', step: 7, stage: 'Invoice', label: 'Customer\ninvoices',
    genusOrDomain: 'Customer invoiced (revenue)',
    planCaption: 'Planned revenue', factCaption: 'Invoiced',
    icon: 'receipt-text-outline', position: 'bottom-left',
    accentColor: '#059669', pastelBgLight: '#86EFAC', pastelBgDark: '#064E3B',
    route: '/pm/customer-invoice/list',
    description: 'Customer invoices made from the Deliverable lines; the revenue of ROI3 and ROI4.',
    tip: 'Customer invoices: what we bill customers (revenue of ROI3 and ROI4).',
  },
  {
    id: 'payments', step: 8, stage: 'Cash', label: 'Cash\npayments',
    genusOrDomain: 'Payment facts, bank accounts',
    planCaption: 'Invoiced', factCaption: 'Paid',
    icon: 'bank-transfer', position: 'bottom-right',
    accentColor: '#7E22CE', pastelBgLight: '#C084FC', pastelBgDark: '#581C87',
    route: '/pm/payment-fact/list',
    description: 'Payment facts = one bank transaction each; they move the money account rests and the customer / vendor balance (Monitor07).',
    tip: 'Cash payments: money paid and received on the bank accounts.',
  },
];

/** Per month: [top value, bottom value] of the 8 circles in the order of PM80_STAGES. */
type StagePairs = Array<[number, number]>;

interface MonthInput {
  monthKey: string;
  monthLabel: string;
  goalNetProfit: number;
  money: RoiMoney;
  pairs: StagePairs;
  /** utilization of the work centers, percent (from the resource calendars) */
  capacityPct: number;
}

const shortK = (amount: number, symbol = '€'): string => {
  const abs = Math.abs(amount);
  return abs >= 1000 ? `${symbol}${Math.round(abs / 1000)}K` : `${symbol}${Math.round(abs)}`;
};

const pct = (num: number, den: number): number =>
  den > 0 ? Math.max(0, Math.min(100, Math.round((num / den) * 100))) : 0;

/** the bands of the status of a KPI ring (the same numbers are in the CFO description, kpiInfo/) */
export const KPI_BANDS = {
  /** budget used: lower is better - up to `optimal` %, up to `good` %, up to `warning` %, above = critical */
  lowerBetter: { optimal: 90, good: 100, warning: 110 },
  /** capacity, delivered, collected: higher is better - from `optimal` %, from `good` %, from `warning` %, below = critical */
  higherBetter: { optimal: 90, good: 75, warning: 50 },
} as const;

/** Lower is better (budget used). */
export const statusLowerBetter = (v: number): PM80AdvancedMetric['status'] =>
  v <= KPI_BANDS.lowerBetter.optimal ? 'optimal' : v <= KPI_BANDS.lowerBetter.good ? 'good' : v <= KPI_BANDS.lowerBetter.warning ? 'warning' : 'critical';

/** Higher is better. */
export const statusHigherBetter = (v: number): PM80AdvancedMetric['status'] =>
  v >= KPI_BANDS.higherBetter.optimal ? 'optimal' : v >= KPI_BANDS.higherBetter.good ? 'good' : v >= KPI_BANDS.higherBetter.warning ? 'warning' : 'critical';


/**
 * PROJECT FILTER. The home shows the numbers of ALL projects, or of a SUBSET the user checks in the list.
 * Demo data: every project has a share of the cost and of the revenue of the month (permille, each column sums to 1000),
 * so the numbers of a subset are the sums of its projects and every project has a ROI of its own.
 */
export interface PM80Project {
  id: string;
  name: string;
  subtitle: string;
  /** share of the cost of the month, permille */
  costPermille: number;
  /** share of the revenue of the month, permille */
  revPermille: number;
}

export const PM80_PROJECTS: PM80Project[] = [
  { id: 'railway1', name: 'Railway #1', subtitle: 'Track and depot build', costPermille: 170, revPermille: 150 },
  { id: 'budget1', name: 'BUDGET1', subtitle: 'Budgeting system roll-out', costPermille: 60, revPermille: 90 },
  { id: 'officeMove', name: 'Office Move 2026', subtitle: 'Relocation of 3 teams', costPermille: 80, revPermille: 20 },
  { id: 'erpUpgrade', name: 'ERP Upgrade', subtitle: 'Finance and procurement', costPermille: 120, revPermille: 110 },
  { id: 'mobileApp', name: 'Mobile App v3', subtitle: 'iOS and Android release', costPermille: 90, revPermille: 130 },
  { id: 'warehouse', name: 'Warehouse Automation', subtitle: 'Conveyors and sorting', costPermille: 110, revPermille: 90 },
  { id: 'brand', name: 'Brand Refresh', subtitle: 'Identity and web site', costPermille: 40, revPermille: 50 },
  { id: 'dataCenter', name: 'Data Center Migration', subtitle: 'Move to the cloud', costPermille: 100, revPermille: 70 },
  { id: 'portal', name: 'Customer Portal', subtitle: 'Self service for clients', costPermille: 60, revPermille: 100 },
  { id: 'solar', name: 'Solar Roof Pilot', subtitle: 'Energy saving pilot', costPermille: 70, revPermille: 60 },
  { id: 'training', name: 'Training Program', subtitle: 'Skills of project managers', costPermille: 30, revPermille: 40 },
  { id: 'audit', name: 'Compliance Audit', subtitle: 'IFRS and tax review', costPermille: 70, revPermille: 90 },
];

/** null = ALL projects, else the checked ids (never empty, never all of them) */
export type PM80ProjectSelection = string[] | null;

export function normalizeProjectSelection(ids: string[] | null | undefined, projects: PM80Project[] = PM80_PROJECTS): PM80ProjectSelection {
  if (!ids) return null;
  const known = projects.filter((pr) => ids.includes(pr.id)).map((pr) => pr.id);
  return known.length === 0 || known.length === projects.length ? null : known;
}

/** the text of the filter button: "All projects (12)", the name of one project, "3 of 12 projects" */
export function projectFilterLabel(selection: PM80ProjectSelection, projects: PM80Project[] = PM80_PROJECTS): string {
  const sel = normalizeProjectSelection(selection, projects);
  if (!sel) return `All projects (${projects.length})`;
  if (sel.length === 1) return projects.find((pr) => pr.id === sel[0])!.name;
  return `${sel.length} of ${projects.length} projects`;
}

/** the shares (0..1) of the cost and of the revenue that the selected projects hold */
export function projectShares(selection: PM80ProjectSelection, projects: PM80Project[] = PM80_PROJECTS): { cost: number; revenue: number; count: number } {
  const sel = normalizeProjectSelection(selection, projects);
  if (!sel) return { cost: 1, revenue: 1, count: projects.length };
  const chosen = projects.filter((pr) => sel.includes(pr.id));
  return {
    cost: chosen.reduce((a, pr) => a + pr.costPermille, 0) / 1000,
    revenue: chosen.reduce((a, pr) => a + pr.revPermille, 0) / 1000,
    count: chosen.length,
  };
}

const scaleMoney = (m: RoiMoney, cost: number, revenue: number): RoiMoney => {
  const out: any = {};
  (Object.keys(m) as Array<keyof RoiMoney>).forEach((k) => {
    out[k] = Math.round((m[k] as number) * (String(k).startsWith('revenue') ? revenue : cost));
  });
  return out as RoiMoney;
};

/** which pairs of the circles are cost (c) or revenue (r); the plan circle (0) mixes both */
const PAIR_KIND: Array<'plan' | 'c' | 'r'> = ['plan', 'c', 'c', 'c', 'r', 'c', 'r', 'r'];

/** the month input of the subset: the money, the circles and the goal scaled by the shares of the projects */
function scaleInput(m: MonthInput, selection: PM80ProjectSelection, projects: PM80Project[] = PM80_PROJECTS): MonthInput {
  const sh = projectShares(selection, projects);
  if (sh.cost === 1 && sh.revenue === 1) return m;
  return scaleByFactors(m, sh.cost, sh.revenue);
}

/** the same input with the cost side times `cost` and the revenue side times `revenue` */
function scaleByFactors(m: MonthInput, cost: number, revenue: number): MonthInput {
  const sh = { cost, revenue };
  const pairs = m.pairs.map((pair, i): [number, number] => {
    const kind = PAIR_KIND[i];
    if (kind === 'plan') {
      const cost = Math.round(pair[0] * sh.cost);
      const revenue = Math.round((pair[0] + pair[1]) * sh.revenue);
      return [cost, revenue - cost];
    }
    const f = kind === 'c' ? sh.cost : sh.revenue;
    return [Math.round(pair[0] * f), Math.round(pair[1] * f)];
  });
  return {
    ...m,
    money: scaleMoney(m.money, sh.cost, sh.revenue),
    pairs,
    goalNetProfit: Math.round(m.goalNetProfit * sh.revenue),
  };
}

function buildSnapshot(m: MonthInput, selection: PM80ProjectSelection = null, projects: PM80Project[] = PM80_PROJECTS): PM80MonthSnapshot {
  const projectsShown = projectShares(selection, projects).count;
  m = scaleInput(m, selection, projects);
  const currencySymbol = '€';
  const line = roiOfMoney(m.money, { includeSaleVat: false, includePurchaseVat: false });
  const cashPair = m.pairs[7];

  const budgetUsed = pct(line.factCost, line.planCost);
  const delivered = pct(line.usedRevenue, line.planRevenue);
  const collected = pct(cashPair[1], cashPair[0]);

  const advancedMetrics: PM80AdvancedMetric[] = [
    {
      id: 'budget',
      label: 'Budget used',
      sublabel: 'Monitor01 • cost fact / plan',
      valueText: `${budgetUsed}%`,
      progress: budgetUsed,
      icon: 'speedometer',
      status: statusLowerBetter(budgetUsed),
      formulaTip: `Cost fact (vendor invoiced + own cost, incl. VAT that is cost) ${shortK(line.factCost)} of the posted plan ${shortK(line.planCost)}. Opens Monitor01 (plan vs ordered vs received vs used vs invoiced).`,
      route: '/pm/reports/monitor01',
    },
    {
      id: 'capacity',
      label: 'Capacity',
      sublabel: 'Work centers • booked',
      valueText: `${m.capacityPct}%`,
      progress: m.capacityPct,
      icon: 'account-group-outline',
      status: statusHigherBetter(m.capacityPct),
      formulaTip: 'Booked hours of the work centers (person, equipment, partner) against their calendars. Opens the Work centers catalog; levelling is in the project settings → Resources.',
      route: '/catalog/work/center',
    },
    {
      id: 'delivered',
      label: 'Delivered',
      sublabel: 'Monitor02 • fact input / plan',
      valueText: `${delivered}%`,
      progress: delivered,
      icon: 'truck-check-outline',
      status: statusHigherBetter(delivered),
      formulaTip: `Revenue fact input ${shortK(line.usedRevenue)} of the planned revenue ${shortK(line.planRevenue)} (the numerator of ROI2 over the numerator of ROI1). Opens Monitor02 ROI now.`,
      route: '/pm/reports/monitor02',
    },
    {
      id: 'collected',
      label: 'Collected',
      sublabel: 'Monitor07 • paid / invoiced',
      valueText: `${collected}%`,
      progress: collected,
      icon: 'cash-check',
      status: statusHigherBetter(collected),
      formulaTip: `Customer payments ${shortK(cashPair[1])} of the customer invoices ${shortK(cashPair[0])}. Opens Monitor07 Customer balance (what customers still owe us).`,
      route: '/pm/reports/monitor07/customer',
    },
  ];

  const satellites: PM80SatelliteNode[] = PM80_STAGES.map((def, i) => {
    const [top, bottom] = m.pairs[i];
    return {
      id: def.id,
      label: def.label,
      step: def.step,
      stage: def.stage,
      genusOrDomain: def.genusOrDomain,
      planLabel: shortK(top, currencySymbol),
      planAmount: top,
      planCaption: def.planCaption,
      factLabel: shortK(bottom, currencySymbol),
      factAmount: bottom,
      factCaption: def.factCaption,
      icon: def.icon,
      position: def.position,
      accentColor: def.accentColor,
      pastelBgLight: def.pastelBgLight,
      pastelBgDark: def.pastelBgDark,
      route: def.route,
      description: def.description,
      tip: def.tip,
    };
  });

  return {
    monthKey: m.monthKey,
    monthLabel: m.monthLabel,
    projectTitle: projectFilterLabel(selection, projects),
    projectCount: projectsShown,
    currencySymbol,
    goalNetProfit: m.goalNetProfit,
    money: m.money,
    advancedMetrics,
    satellites,
  };
}

/**
 * Demo snapshots (the home is not connected to the database yet). The money of the center ring comes from the 15
 * ROI components; the circles are consistent with them: plan cost / revenue, fact input, vendor + customer invoiced.
 * Nov 2026: planned cost 290K, planned revenue 690K, fact input 510K, vendor invoiced 122K, customer invoiced 707K.
 */
const PM80_MONTH_INPUTS: MonthInput[] = [
  ({
    monthKey: '2026-11',
    monthLabel: 'NOVEMBER 2026',
    goalNetProfit: 580000,
    capacityPct: 91,
    money: {
      costPlanNet: 290000,
      costPlanVat: 58000,
      costPlanVatInCost: 15000,
      revenuePlanNet: 690000,
      revenuePlanVat: 138000,
      revenueUsedNet: 510000,
      revenueUsedVat: 102000,
      costOwnNet: 150000,
      costOwnVat: 0,
      costOwnVatInCost: 0,
      costInvoicedNet: 122000,
      costInvoicedVat: 38000,
      costInvoicedVatInCost: 15000,
      revenueInvoicedNet: 707000,
      revenueInvoicedVat: 141400,
    },
    pairs: [
      [290000, 400000], // plan: planned cost, planned profit (690K - 290K)
      [120000, 96000], // purchase orders
      [96000, 81000], // product receipts
      [120000, 105000], // time sheets
      [690000, 510000], // fact input of revenue
      [130000, 122000], // vendor invoices
      [690000, 707000], // customer invoices
      [707000, 498000], // payments received
    ],
  }),
  ({
    monthKey: '2026-10',
    monthLabel: 'OCTOBER 2026',
    goalNetProfit: 520000,
    capacityPct: 88,
    money: {
      costPlanNet: 275000,
      costPlanVat: 55000,
      costPlanVatInCost: 12000,
      revenuePlanNet: 620000,
      revenuePlanVat: 124000,
      revenueUsedNet: 460000,
      revenueUsedVat: 92000,
      costOwnNet: 142000,
      costOwnVat: 0,
      costOwnVatInCost: 0,
      costInvoicedNet: 118000,
      costInvoicedVat: 32000,
      costInvoicedVatInCost: 12000,
      revenueInvoicedNet: 632000,
      revenueInvoicedVat: 126400,
    },
    pairs: [
      [275000, 345000],
      [112000, 92000],
      [92000, 79000],
      [115000, 98000],
      [620000, 460000],
      [124000, 118000],
      [620000, 632000],
      [632000, 540000],
    ],
  }),
  ({
    monthKey: '2026-12',
    monthLabel: 'DECEMBER 2026',
    goalNetProfit: 650000,
    capacityPct: 94,
    money: {
      costPlanNet: 310000,
      costPlanVat: 62000,
      costPlanVatInCost: 14000,
      revenuePlanNet: 780000,
      revenuePlanVat: 156000,
      revenueUsedNet: 640000,
      revenueUsedVat: 128000,
      costOwnNet: 158000,
      costOwnVat: 0,
      costOwnVatInCost: 0,
      costInvoicedNet: 130000,
      costInvoicedVat: 36000,
      costInvoicedVatInCost: 14000,
      revenueInvoicedNet: 812000,
      revenueInvoicedVat: 162400,
    },
    pairs: [
      [310000, 470000],
      [130000, 108000],
      [108000, 94000],
      [130000, 112000],
      [780000, 640000],
      [136000, 130000],
      [780000, 812000],
      [812000, 520000],
    ],
  }),
];

/** The home of ALL projects, one snapshot per month. */
export const PM80_MONTH_SNAPSHOTS: PM80MonthSnapshot[] = PM80_MONTH_INPUTS.map((m) => buildSnapshot(m));

/**
 * PERIOD: a month and a year chosen apart (two lists in the header). Oct, Nov and Dec 2026 are the three hand made
 * months above; every other month of the years in PM80_YEARS is derived from Nov 2026 (demo): a season of the year
 * (cost / revenue factors per month), a growth per year and a deterministic wiggle of capacity and collected money.
 */
export interface PM80Period {
  /** e.g. 2026 */
  year: number;
  /** 1..12 */
  month: number;
}

export const PM80_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** the years of the list under the year (a typed year may be any year of PM80_YEAR_MIN..PM80_YEAR_MAX) */
export const PM80_YEARS: number[] = [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];

/** a typed year is realistic between these two (4 digits) */
export const PM80_YEAR_MIN = 2000;
export const PM80_YEAR_MAX = 2099;

/** while typing: only digits, at most 4 */
export const sanitizeYearText = (text: string): string => text.replace(/\D/g, '').slice(0, 4);

export type PM80YearParse = { ok: true; year: number } | { ok: false; message: string };

/** the typed year: exactly 4 digits, from PM80_YEAR_MIN to PM80_YEAR_MAX */
export function parseYearInput(text: string): PM80YearParse {
  const t = text.trim();
  if (!/^\d{4}$/.test(t)) return { ok: false, message: 'Type the year with 4 digits, e.g. 2026' };
  const year = Number(t);
  if (year < PM80_YEAR_MIN || year > PM80_YEAR_MAX) {
    return { ok: false, message: `The year must be from ${PM80_YEAR_MIN} to ${PM80_YEAR_MAX}` };
  }
  return { ok: true, year };
}

/** the years of the list: PM80_YEARS and the year in force when it was typed outside of them */
export const pm80YearList = (current: number): number[] =>
  PM80_YEARS.includes(current) ? PM80_YEARS : [...PM80_YEARS, current].sort((a, b) => a - b);

export const PM80_DEFAULT_PERIOD: PM80Period = { year: 2026, month: 11 };

const SEASON_COST = [0.78, 0.8, 0.9, 0.95, 1.0, 1.04, 0.88, 0.84, 1.0, 0.95, 1.0, 1.07];
const SEASON_REVENUE = [0.74, 0.78, 0.88, 0.93, 1.0, 1.05, 0.86, 0.82, 0.97, 0.9, 1.0, 1.13];

const periodKey = (p: PM80Period): string => `${p.year}-${String(p.month).padStart(2, '0')}`;

export const periodLabel = (p: PM80Period): string => `${PM80_MONTH_NAMES[p.month - 1].toUpperCase()} ${p.year}`;

/** the period one month before / after (the year changes at January / December); null beyond PM80_YEAR_MIN / MAX */
export function shiftPeriod(p: PM80Period, delta: number): PM80Period | null {
  const index = p.year * 12 + (p.month - 1) + delta;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  if (year < PM80_YEAR_MIN || year > PM80_YEAR_MAX) return null;
  return { year, month };
}

export function pm80InputFor(period: PM80Period): MonthInput {
  const key = periodKey(period);
  const exact = PM80_MONTH_INPUTS.find((m) => m.monthKey === key);
  if (exact) return exact;
  const base = PM80_MONTH_INPUTS[0]; // Nov 2026
  const growth = Math.max(0.4, 1 + 0.08 * (period.year - 2026));
  const scaled = scaleByFactors(
    base,
    SEASON_COST[period.month - 1] * growth,
    SEASON_REVENUE[period.month - 1] * growth
  );
  // the money of customers comes in better or worse in different months
  const collectBias = 0.85 + ((period.year * 3 + period.month * 7) % 9) * 0.05;
  const pairs = scaled.pairs.map((pr, i): [number, number] =>
    i === 7 ? [pr[0], Math.round(pr[1] * collectBias)] : pr
  );
  return {
    ...scaled,
    monthKey: key,
    monthLabel: periodLabel(period),
    pairs,
    capacityPct: 82 + ((period.year * 7 + period.month * 3) % 15),
  };
}

/** The snapshot of a period for ALL projects (selection null) or a SUBSET of them. */
export function pm80SnapshotFor(period: PM80Period, selection: PM80ProjectSelection, projects: PM80Project[] = PM80_PROJECTS): PM80MonthSnapshot {
  const exact = PM80_MONTH_SNAPSHOTS.find((m) => m.monthKey === periodKey(period));
  if (exact && projects === PM80_PROJECTS && !normalizeProjectSelection(selection, projects)) return exact;
  return buildSnapshot(pm80InputFor(period), selection, projects);
}

/** a small stable number from a text (the shares of the real projects are made from their ids) */
function hashOf(text: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1000;
}

/** weights -> permille that add up to EXACTLY 1000 (largest remainder) */
function toPermille(weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (w / total) * 1000);
  const floor = raw.map((r) => Math.floor(r));
  let left = 1000 - floor.reduce((a, b) => a + b, 0);
  raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac)
    .forEach(({ i }) => {
      if (left > 0) {
        floor[i] += 1;
        left -= 1;
      }
    });
  return floor;
}

/**
 * The REAL projects of the user as filter items. The home does not read money from the database yet, so every real project gets a
 * stable demo share of the cost and of the revenue (made from its id): the sums of any subset still add up to the whole.
 */
export function pm80ProjectsFromRows(rows: Array<{ rowGUID: string; rowJSON?: { name?: string; description?: string } | null }>): PM80Project[] {
  if (rows.length === 0) return [];
  const cost = toPermille(rows.map((r) => 1 + hashOf(r.rowGUID, 1) % 9));
  const rev = toPermille(rows.map((r) => 1 + hashOf(r.rowGUID, 2) % 9));
  return rows.map((r, i) => ({
    id: r.rowGUID,
    name: (r.rowJSON?.name || '').trim() || 'Project',
    subtitle: (r.rowJSON?.description || '').trim(),
    costPermille: cost[i],
    revPermille: rev[i],
  }));
}

/** The circles in the business order (1..8), for the flow strip. */
export function pm80FlowOf(snapshot: PM80MonthSnapshot): PM80SatelliteNode[] {
  return [...snapshot.satellites].sort((a, b) => a.step - b.step);
}

export interface PM80ComputedCenter {
  kind: RoiKindKey;
  kindTitle: string;
  kindSubtitle: string;
  revenue: number;
  cost: number;
  netProfit: number;
  formattedProfit: string;
  roiRatioValue: number | null;
  formattedRoiPct: string;
  goalAmount: number;
  formattedGoal: string;
  /** 0 to 1 progress toward goal */
  goalProgress: number;
  tone: 'positive' | 'negative' | 'none';
}

export const ROI_KIND_META: Record<
  RoiKindKey,
  { title: string; subtitle: string; formula: string }
> = {
  roi4: {
    title: 'Net ROI',
    subtitle: 'ROI4 • Fact - Fact',
    formula: '(Customer Invoiced − [Vendor Invoiced + Own Cost]) / Fact Cost',
  },
  roi1: {
    title: 'Plan ROI',
    subtitle: 'ROI1 • Plan - Plan',
    formula: '(Planned Revenue − Planned Cost) / Planned Cost',
  },
  roi2: {
    title: 'Delivered ROI',
    subtitle: 'ROI2 • Plan - Fact Input',
    formula: '(Revenue Fact Input − Planned Cost) / Planned Cost',
  },
  roi3: {
    title: 'Billed ROI',
    subtitle: 'ROI3 • Plan - Invoiced',
    formula: '(Customer Invoiced − Planned Cost) / Planned Cost',
  },
};

export function formatCompactCurrency(amount: number, symbol = '€', showSign = false): string {
  const abs = Math.abs(Math.round(amount));
  const sign = amount > 0 && showSign ? '+' : amount < 0 ? '-' : '';
  return `${sign}${symbol}${abs.toLocaleString('en-US')}`;
}

export function formatShortK(amount: number, symbol = '€'): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1000) {
    return `${sign}${symbol}${Math.round(abs / 1000)}K`;
  }
  return `${sign}${symbol}${Math.round(abs)}`;
}

/**
 * Computes the central hub values using the exact `roiOfMoney` function from `kit8/pm/reports/roi/roiModel.ts`.
 */
export function computePM80Center(
  snapshot: PM80MonthSnapshot,
  kind: RoiKindKey = 'roi4',
  tax: RoiTaxSettings = { includeSaleVat: false, includePurchaseVat: false }
): PM80ComputedCenter {
  const line = roiOfMoney(snapshot.money, tax);

  let revenue = line.billedRevenue;
  let cost = line.factCost;
  let ratioVal = line.roi4;

  if (kind === 'roi1') {
    revenue = line.planRevenue;
    cost = line.planCost;
    ratioVal = line.roi1;
  } else if (kind === 'roi2') {
    revenue = line.usedRevenue;
    cost = line.planCost;
    ratioVal = line.roi2;
  } else if (kind === 'roi3') {
    revenue = line.billedRevenue;
    cost = line.planCost;
    ratioVal = line.roi3;
  }

  const netProfit = revenue - cost;
  const progress = Math.max(0.08, Math.min(1, netProfit / Math.max(1, snapshot.goalNetProfit)));

  return {
    kind,
    kindTitle: ROI_KIND_META[kind].title,
    kindSubtitle: ROI_KIND_META[kind].subtitle,
    revenue,
    cost,
    netProfit,
    formattedProfit: formatCompactCurrency(netProfit, snapshot.currencySymbol, true),
    roiRatioValue: ratioVal,
    formattedRoiPct: formatRoi(ratioVal),
    goalAmount: snapshot.goalNetProfit,
    formattedGoal: `Goal ${formatShortK(snapshot.goalNetProfit, snapshot.currencySymbol)}`,
    goalProgress: progress,
    tone: roiTone(ratioVal),
  };
}


/** Hover tip of an ROI chip: the title, what it compares and the formula. */
export function roiKindTip(kind: RoiKindKey): string {
  const m = ROI_KIND_META[kind];
  return `${kind.toUpperCase()} ${m.title} (${m.subtitle.split('•')[1]?.trim() ?? ''}): ${m.formula}. Double tap for the full description.`;
}

/** Hover tip of the VAT basis button / chip: what is shown now and what a tap does. */
export function vatBasisTip(includeAllTaxes: boolean): string {
  return includeAllTaxes
    ? 'Gross (+VAT): all VAT is added to cost and revenue. Tap to go back to IFRS cost.'
    : 'IFRS cost: only the VAT that is cost is added (recoverable VAT is not). Tap to show Gross (+VAT).';
}

export const PM80_TIPS = {
  profile: 'Open the Project Dashboard: tasks, Gantt, budgets.',
  businessOrder: 'Business order settings: choose which steps to show and in which order. Opens its own screen; Back returns here.',
  prevMonth: 'Show the previous month',
  nextMonth: 'Show the next month',
  monthPill: 'Month of the numbers. Tap to choose the month from the list.',
  yearPill: 'Year of the numbers. Tap to choose from the list, double tap to type the year (4 digits).',
  hub: 'Tap to switch the ROI kind: ROI4, ROI1, ROI2, ROI3. Open Monitor02 for the details per project.',
} as const;
