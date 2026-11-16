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
}

export const PM80_QUICK_LINKS: PM80QuickLink[] = [
  { id: 'monitor01', label: 'Plan vs fact', icon: 'view-dashboard-outline', route: '/pm/reports/monitor01', group: 'reports' },
  { id: 'monitor02', label: 'ROI now', icon: 'chart-donut-variant', route: '/pm/reports/monitor02', group: 'reports' },
  { id: 'monitor03', label: 'ROI history', icon: 'chart-timeline-variant', route: '/pm/reports/monitor03', group: 'reports' },
  { id: 'balances', label: 'Balances', icon: 'scale-balance', route: '/pm/reports/monitor07/customer', group: 'reports' },
  { id: 'chat', label: 'Chat', icon: 'message-text-outline', route: '/chat', group: 'team' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar-month-outline', route: '/user/calendar', group: 'team' },
  { id: 'workcenters', label: 'Work centers', icon: 'account-group-outline', route: '/catalog/work/center', group: 'team' },
  { id: 'accounts', label: 'Bank accounts', icon: 'bank-outline', route: '/catalog/money/account', group: 'team' },
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
}

export const PM80_STAGES: StageDef[] = [
  {
    id: 'plan', step: 1, stage: 'Plan', label: 'Project\nplan',
    genusOrDomain: 'WBS, Gantt, Budgets',
    planCaption: 'Planned cost', factCaption: 'Planned profit',
    icon: 'chart-gantt', position: 'top-left',
    accentColor: '#1E88E5', pastelBgLight: '#93C5FD', pastelBgDark: '#1E3A8A',
    route: '/pm/project/dashboard',
    description: 'Step 1. Project Dashboard: tasks, Gantt, task lines (Time, Material, Expense, Deliverable). Post the plan: it feeds the Plan column of Monitor01 and ROI1.',
  },
  {
    id: 'orders', step: 2, stage: 'Procure', label: 'Purchase\norders',
    genusOrDomain: 'Material + Expense lines',
    planCaption: 'Planned to buy', factCaption: 'Ordered',
    icon: 'cart-outline', position: 'top-right',
    accentColor: '#7C3AED', pastelBgLight: '#C4B5FD', pastelBgDark: '#4C1D95',
    route: '/pm/purchase-order/list',
    description: 'Step 2. Purchase orders to vendors; a posted order fills the Ordered column of Monitor01.',
  },
  {
    id: 'receipts', step: 3, stage: 'Procure', label: 'Product\nreceipts',
    genusOrDomain: 'Received goods',
    planCaption: 'Ordered', factCaption: 'Received',
    icon: 'package-variant-closed', position: 'mid-left',
    accentColor: '#D97706', pastelBgLight: '#FCD34D', pastelBgDark: '#78350F',
    route: '/pm/product-receipt/list',
    description: 'Step 3. Product receipts made from a posted purchase order; fills the Received column of Monitor01.',
  },
  {
    id: 'timesheets', step: 4, stage: 'Execute', label: 'Time\nsheets',
    genusOrDomain: 'Own staff hours (work centers)',
    planCaption: 'Planned time', factCaption: 'Hours posted',
    icon: 'clock-time-four-outline', position: 'mid-right',
    accentColor: '#EA580C', pastelBgLight: '#FDBA74', pastelBgDark: '#7C2D12',
    route: '/pm/timesheet/list',
    description: 'Step 4. Time sheets of work centers (person, equipment, partner); the posted hours are the Used column and the own cost of ROI4.',
  },
  {
    id: 'fact', step: 5, stage: 'Execute', label: 'Fact\ninput',
    genusOrDomain: 'Deliverable fact input',
    planCaption: 'Planned revenue', factCaption: 'Fact input',
    icon: 'clipboard-check-outline', position: 'lower-left',
    accentColor: '#E11D48', pastelBgLight: '#FDA4AF', pastelBgDark: '#881337',
    route: '/pm/fact/list',
    description: 'Step 5. Fact input of used quantities and of the Revenue lines: the numerator of ROI2 (plan - fact input).',
  },
  {
    id: 'vendorInvoices', step: 6, stage: 'Invoice', label: 'Vendor\ninvoices',
    genusOrDomain: 'Vendor invoiced (cost)',
    planCaption: 'Planned', factCaption: 'Invoiced',
    icon: 'file-document-outline', position: 'lower-right',
    accentColor: '#475569', pastelBgLight: '#94A3B8', pastelBgDark: '#334155',
    route: '/pm/vendor-invoice/list',
    description: 'Step 6. Vendor invoices (what suppliers bill us); the Vendor Invoice columns of Monitor01 and the cost of ROI4.',
  },
  {
    id: 'customerInvoices', step: 7, stage: 'Invoice', label: 'Customer\ninvoices',
    genusOrDomain: 'Customer invoiced (revenue)',
    planCaption: 'Planned revenue', factCaption: 'Invoiced',
    icon: 'receipt-text-outline', position: 'bottom-left',
    accentColor: '#059669', pastelBgLight: '#86EFAC', pastelBgDark: '#064E3B',
    route: '/pm/customer-invoice/list',
    description: 'Step 7. Customer invoices made from the Deliverable lines; the revenue of ROI3 and ROI4.',
  },
  {
    id: 'payments', step: 8, stage: 'Cash', label: 'Cash\npayments',
    genusOrDomain: 'Payment facts, bank accounts',
    planCaption: 'Invoiced', factCaption: 'Paid',
    icon: 'bank-transfer', position: 'bottom-right',
    accentColor: '#7E22CE', pastelBgLight: '#C084FC', pastelBgDark: '#581C87',
    route: '/pm/payment-fact/list',
    description: 'Step 8. Payment facts = one bank transaction each; they move the money account rests and the customer / vendor balance (Monitor07).',
  },
];

/** Per month: [top value, bottom value] of the 8 circles in the order of PM80_STAGES. */
type StagePairs = Array<[number, number]>;

interface MonthInput {
  monthKey: string;
  monthLabel: string;
  projectCount: number;
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

/** Lower is better (budget used): <= 90 optimal, <= 100 good, <= 110 warning. */
const statusLowerBetter = (v: number): PM80AdvancedMetric['status'] =>
  v <= 90 ? 'optimal' : v <= 100 ? 'good' : v <= 110 ? 'warning' : 'critical';

/** Higher is better: >= 90 optimal, >= 75 good, >= 50 warning. */
const statusHigherBetter = (v: number): PM80AdvancedMetric['status'] =>
  v >= 90 ? 'optimal' : v >= 75 ? 'good' : v >= 50 ? 'warning' : 'critical';

function buildSnapshot(m: MonthInput): PM80MonthSnapshot {
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
    };
  });

  return {
    monthKey: m.monthKey,
    monthLabel: m.monthLabel,
    projectTitle: 'All Projects',
    projectCount: m.projectCount,
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
export const PM80_MONTH_SNAPSHOTS: PM80MonthSnapshot[] = [
  buildSnapshot({
    monthKey: '2026-11',
    monthLabel: 'NOVEMBER 2026',
    projectCount: 12,
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
  buildSnapshot({
    monthKey: '2026-10',
    monthLabel: 'OCTOBER 2026',
    projectCount: 11,
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
  buildSnapshot({
    monthKey: '2026-12',
    monthLabel: 'DECEMBER 2026',
    projectCount: 14,
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

