// roiInfoModel - the CFO description of the four ROI buttons of the PM80 home (shown by a double touch / double click on a button).
//   Pure: the TEXT of each kind and the numbers of the current screen for the worked example. The wording follows the built system
//   (documentation/ROI_DOC.html, kit8/pm/reports/roi/roiModel.ts): ROI = (Revenue - Cost) / Cost, money is added first, the ratio last.
import type { InfoContent } from '../infoModal/infoContent';
import type { RoiTaxSettings } from '../../../../kit8/pm/reports/roi/roiSettings';
import { formatCompactCurrency, computePM80Center, ROI_KIND_META, type PM80MonthSnapshot, type RoiKindKey } from '../pm80HomeModel';

export interface RoiInfoText {
  kind: RoiKindKey;
  /** "ROI4 - Net ROI" */
  heading: string;
  /** "Fact - Fact" */
  basis: string;
  /** the question the CFO asks and this number answers */
  question: string;
  /** one sentence verdict */
  inOneSentence: string;
  formula: string;
  /** where the revenue of the formula comes from */
  revenue: string;
  /** where the cost of the formula comes from */
  cost: string;
  /** when to look at it and how to read it */
  howToRead: string[];
  /** what can mislead */
  watchOut: string[];
}

/** what is the same for the four kinds: the rules of the calculation */
export const ROI_INFO_COMMON = {
  title: 'Rules that apply to all four',
  rules: [
    'ROI = (Revenue - Cost) / Cost. A project with no cost has no ROI: the screen shows "-", never a made-up number.',
    'Money is added first and the ratio is taken last: the ROI of several projects is the ROI of their sums, not the average of their ROIs.',
    'Only posted documents count. A plan, a fact input, an invoice or a time sheet that is still a draft is not in the numbers.',
    'IFRS Cost (the default): revenue is net of VAT; cost is net cost plus the VAT the company cannot recover. Recoverable VAT is not a cost. Gross (+VAT): all VAT is added to both revenue and cost.',
    'The ROI is a ratio on the period and the projects chosen on the screen (month, year, project filter).',
  ],
};

export const ROI_INFO: Record<RoiKindKey, RoiInfoText> = {
  roi1: {
    kind: 'roi1',
    heading: 'ROI1 - Plan ROI',
    basis: 'Plan - Plan',
    question: 'What return does the approved plan promise?',
    inOneSentence: 'The return the budget itself promises before anything is delivered or billed: planned revenue against planned cost.',
    formula: '(Planned revenue - Planned cost) / Planned cost',
    revenue: 'Planned Deliverable (revenue) lines of the posted tasks.',
    cost: 'Planned Time, Material and Expense lines of the posted tasks.',
    howToRead: [
      'The baseline. ROI2, ROI3 and ROI4 are read against it.',
      'Use it to approve or reject a project or a change of scope: it shows whether the plan earns an acceptable return at all.',
    ],
    watchOut: [
      'It is only as good as the plan. A task that is not posted is not in it, so an unposted part of the project makes ROI1 look better or worse than the real plan.',
      'It says nothing about what has actually happened.',
    ],
  },
  roi2: {
    kind: 'roi2',
    heading: 'ROI2 - Delivered ROI',
    basis: 'Plan - Fact input',
    question: 'How much of the promised revenue has the work already earned, against the full budget?',
    inOneSentence: 'Revenue that has been delivered and recorded (fact input) against the planned cost: the earlier indicator of what will be billed.',
    formula: '(Revenue fact input - Planned cost) / Planned cost',
    revenue: 'Posted Fact input documents on the revenue lines: the work or deliverables confirmed as done, valued at plan prices.',
    cost: 'Planned cost (as in ROI1).',
    howToRead: [
      'Use it during delivery, before invoices exist: it moves as soon as a deliverable is confirmed.',
      'Compare it with ROI1: the gap is the revenue still to be delivered.',
    ],
    watchOut: [
      'Cost is the whole plan, revenue is only what is delivered so far, so the figure is low early in the project and is not a loss signal by itself.',
      'Delivered is not billed and not paid: see ROI3 and the customer balance (Monitor07).',
    ],
  },
  roi3: {
    kind: 'roi3',
    heading: 'ROI3 - Billed ROI',
    basis: 'Plan - Invoiced',
    question: 'How far has billing the customer covered the planned cost?',
    inOneSentence: 'Revenue already invoiced to customers against the planned cost: billing progress measured as a return on the budget.',
    formula: '(Customer invoiced - Planned cost) / Planned cost',
    revenue: 'Posted customer invoices (net of VAT in the IFRS Cost basis).',
    cost: 'Planned cost (as in ROI1).',
    howToRead: [
      'Use it for billing discipline: delivered work (ROI2) that does not show up here has not been invoiced yet.',
      'A figure above ROI1 means more has been billed than was planned (change orders, price effects); a figure well below ROI2 means invoicing is late.',
    ],
    watchOut: [
      'Cost is still the plan, so the early months look weak for the same reason as in ROI2.',
      'An invoice is not cash. Payments and what customers still owe are in the payment facts and in Monitor07.',
    ],
  },
  roi4: {
    kind: 'roi4',
    heading: 'ROI4 - Net ROI',
    basis: 'Fact - Fact',
    question: 'What did the project actually earn on what it actually cost?',
    inOneSentence: 'The realized return: customer invoices against the cost that has really been incurred. The closest figure to the result an accountant would report.',
    formula: '(Customer invoiced - Fact cost) / Fact cost',
    revenue: 'Posted customer invoices.',
    cost: 'Fact cost = posted vendor invoices + own cost that vendors never invoice (posted fact input and time sheets of cost lines that have no vendor, e.g. own staff hours).',
    howToRead: [
      'The figure to report to management and to compare projects with each other.',
      'The Net ROI in the centre of the home is ROI4 by default; the amount in the ring is revenue minus cost, shown against the goal of the month.',
    ],
    watchOut: [
      'Only as complete as the posting discipline: a vendor invoice or time sheet that is not posted yet is missing from the cost and flatters the result.',
      'Cost the vendor has not invoiced yet (goods received, work done, no invoice) is not in it; the Received and Ordered columns of Monitor01 show that exposure.',
      'It is an invoicing result, not a cash result.',
    ],
  },
};

/** the numbers of the current screen for the worked example of a kind */
export interface RoiInfoNumbers {
  revenue: string;
  cost: string;
  profit: string;
  roi: string;
  /** "IFRS Cost" | "Gross (+VAT)" */
  basisLabel: string;
  periodLabel: string;
  projectsLabel: string;
  revenueLabel: string;
  costLabel: string;
}

const REVENUE_LABEL: Record<RoiKindKey, string> = {
  roi1: 'Planned revenue',
  roi2: 'Revenue fact input',
  roi3: 'Customer invoiced',
  roi4: 'Customer invoiced',
};
const COST_LABEL: Record<RoiKindKey, string> = {
  roi1: 'Planned cost',
  roi2: 'Planned cost',
  roi3: 'Planned cost',
  roi4: 'Fact cost (vendor invoiced + own cost)',
};

/** the worked example: the numbers behind the ROI the screen shows now, with the same tax basis */
export function roiInfoNumbers(snapshot: PM80MonthSnapshot, kind: RoiKindKey, tax: RoiTaxSettings): RoiInfoNumbers {
  const c = computePM80Center(snapshot, kind, tax);
  const sym = snapshot.currencySymbol;
  return {
    revenue: formatCompactCurrency(c.revenue, sym),
    cost: formatCompactCurrency(c.cost, sym),
    profit: formatCompactCurrency(c.netProfit, sym, true),
    roi: c.formattedRoiPct,
    basisLabel: tax.includePurchaseVat || tax.includeSaleVat ? 'Gross (+VAT)' : 'IFRS Cost',
    periodLabel: snapshot.monthLabel,
    projectsLabel: snapshot.projectTitle,
    revenueLabel: REVENUE_LABEL[kind],
    costLabel: COST_LABEL[kind],
  };
}

/** the short title of the kind as the buttons and the ring show it */
export const roiInfoTitle = (kind: RoiKindKey): string => `${kind.toUpperCase()} - ${ROI_KIND_META[kind].title}`;

/** the modal content of a ROI: the question, the formula, the sources, the numbers of the screen, how to read, what misleads, the common rules */
export function roiInfoContent(kind: RoiKindKey, n: RoiInfoNumbers): InfoContent {
  const i = ROI_INFO[kind];
  return {
    heading: i.heading,
    subheading: i.basis,
    sections: [
      { title: 'The question it answers', blocks: [{ type: 'p', text: i.question, bold: true }] },
      { title: 'In one sentence', blocks: [{ type: 'p', text: i.inOneSentence }] },
      { title: 'Formula', blocks: [{ type: 'formula', text: i.formula }] },
      { title: 'Where the numbers come from', blocks: [{ type: 'kv', label: 'Revenue', text: i.revenue }, { type: 'kv', label: 'Cost', text: i.cost }] },
      {
        title: 'On this screen now',
        blocks: [{
          type: 'numbers',
          caption: `${n.periodLabel} · ${n.projectsLabel} · ${n.basisLabel}`,
          rows: [[n.revenueLabel, n.revenue], [n.costLabel, n.cost], ['Profit', n.profit], [i.heading.split(' - ')[0], n.roi]],
        }],
      },
      { title: 'How to read it', blocks: [{ type: 'bullets', items: i.howToRead }] },
      { title: 'Watch out', blocks: [{ type: 'bullets', items: i.watchOut }] },
      { title: ROI_INFO_COMMON.title, blocks: [{ type: 'bullets', items: ROI_INFO_COMMON.rules }] },
    ],
    footnote: DEMO_FOOTNOTE,
  };
}

export const DEMO_FOOTNOTE =
  'The figures on this home are a demo snapshot: the home is not connected to the database yet. The rules above are the ones the reports Monitor01, Monitor02, Monitor03 and Monitor07 use.';
