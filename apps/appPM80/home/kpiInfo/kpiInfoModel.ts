// kpiInfoModel - the CFO description of the four KPI rings of the PM80 home (Budget used, Capacity, Delivered, Collected), shown by a double touch /
// double click on the NAME of a ring. Pure: the texts, the bands and the worked example built from the numbers of the screen.
import { roiOfMoney } from '../../../../kit8/pm/reports/roi/roiModel';
import type { InfoContent } from '../infoModal/infoContent';
import { DEMO_FOOTNOTE } from '../roiInfo/roiInfoModel';
import { formatCompactCurrency, KPI_BANDS, type PM80AdvancedMetric, type PM80MonthSnapshot } from '../pm80HomeModel';

export type KpiId = 'budget' | 'capacity' | 'delivered' | 'collected';
export const KPI_IDS: KpiId[] = ['budget', 'capacity', 'delivered', 'collected'];

export interface KpiInfoText {
  id: KpiId;
  heading: string;
  /** the report it opens */
  subheading: string;
  question: string;
  inOneSentence: string;
  formula: string;
  numerator: string;
  denominator: string;
  /** which way is better */
  direction: 'lower' | 'higher';
  howToRead: string[];
  watchOut: string[];
}

export const KPI_INFO: Record<KpiId, KpiInfoText> = {
  budget: {
    id: 'budget',
    heading: 'Budget used',
    subheading: 'Report: Monitor01 (plan vs ordered vs received vs used vs invoiced)',
    question: 'Is the project spending within the budget that was approved?',
    inOneSentence: 'The cost that has really been incurred as a share of the planned cost. 100% means the whole budget is spent.',
    formula: 'Fact cost / Planned cost',
    numerator: 'Fact cost = posted vendor invoices + own cost that vendors never invoice (posted fact input and time sheets of cost lines that have no vendor, e.g. own staff hours), with the VAT that is cost.',
    denominator: 'Planned cost = the planned Time, Material and Expense lines of the posted tasks.',
    direction: 'lower',
    howToRead: [
      'Lower is better; above 100% the approved budget is exceeded.',
      'Read it together with Delivered: spending 80% of the budget while only 40% of the revenue is delivered means cost is running ahead of the work.',
      'Monitor01 shows where the money is, task by task and month by month: the Plan, Ordered, Received, Used and Vendor Invoice columns.',
    ],
    watchOut: [
      'It is a share of the WHOLE budget, not of the budget to date: a low value early in a project is normal and is not a saving.',
      'Cost that is committed but not yet posted (orders, goods received, a vendor invoice not entered) is not in it. The Ordered and Received columns of Monitor01 show that exposure.',
      'A task that is not posted has no plan, so it is missing from the denominator too.',
    ],
  },
  capacity: {
    id: 'capacity',
    heading: 'Capacity',
    subheading: 'Report: Work centers (the resource calendars) and Resource optimization',
    question: 'How fully are our people, equipment and partners booked?',
    inOneSentence: 'The hours booked on the work centers (people, equipment, partners) as a share of the hours their calendars allow.',
    formula: 'Booked hours / Calendar hours of the work centers',
    numerator: 'Booked hours = the hours planned on the posted Time lines of the work centers.',
    denominator: 'Calendar hours = what the resource calendar of each work center allows (hours per day, holidays, exceptions); a work center without a calendar of its own uses the Standard week.',
    direction: 'higher',
    howToRead: [
      'Both extremes cost money: a low value is paid capacity standing idle, a value near 100% leaves no reserve, so any delay moves the dates.',
      'The ring colors treat higher as better because idle capacity is the usual problem; read a very high value as "no slack", not as "perfect".',
      'The organization can block a booking above the calendar. Levelling and smoothing (Project settings, Resources) move work to flatten the peaks.',
    ],
    watchOut: [
      'It measures hours, not money: a fully booked cheap resource and a half booked expensive one look alike.',
      'It is only as good as the calendars: wrong working hours or missing holidays make the figure wrong in either direction.',
    ],
  },
  delivered: {
    id: 'delivered',
    heading: 'Delivered',
    subheading: 'Report: Monitor02 (ROI now)',
    question: 'How much of the planned revenue has the work already earned?',
    inOneSentence: 'The revenue confirmed by posted fact input as a share of the planned revenue: how far delivery has progressed, in money.',
    formula: 'Revenue fact input / Planned revenue',
    numerator: 'Revenue fact input = the posted Fact input documents on the Deliverable (revenue) lines: work confirmed as done, valued at plan prices.',
    denominator: 'Planned revenue = the planned Deliverable lines of the posted tasks.',
    direction: 'higher',
    howToRead: [
      'It is the earliest sign of what will be billed: it moves when a deliverable is confirmed, before any invoice exists. It is the revenue side of ROI2 over the revenue side of ROI1.',
      'Compare it with Budget used (cost against delivery) and with Collected (billing and collection behind delivery).',
    ],
    watchOut: [
      'Delivered is not billed and not paid.',
      'Values are plan prices: a change order or a price change shows only when it is invoiced.',
      'Only posted fact input counts; a draft does not.',
    ],
  },
  collected: {
    id: 'collected',
    heading: 'Collected',
    subheading: 'Report: Monitor07 (customer balance) and the payment facts',
    question: 'How much of what we invoiced customers has been paid?',
    inOneSentence: 'The customer payments received as a share of the customer invoices issued: the collection rate.',
    formula: 'Customer payments received / Customer invoices issued',
    numerator: 'Payments received = the posted payment facts of customers (one bank transaction each).',
    denominator: 'Invoices issued = the posted customer invoices.',
    direction: 'higher',
    howToRead: [
      '100% minus this figure is what customers still owe us (the receivable). Monitor07 splits it by customer and contract.',
      'A low value right after invoicing is normal: judge it by the due dates in Monitor07, and by the trend over the months. A falling trend is a collection problem and a cash and credit risk.',
    ],
    watchOut: [
      'Only posted payment facts count: money in the bank that nobody has posted is not in it.',
      'Credit notes and refunds change the balance of a customer; look at Monitor07 for the exact position of one contract.',
    ],
  },
};

/** the bands of the ring colors as a sentence (the numbers come from KPI_BANDS = the same numbers the ring uses) */
export function kpiBandsText(direction: 'lower' | 'higher'): string {
  if (direction === 'lower') {
    const b = KPI_BANDS.lowerBetter;
    return `up to ${b.optimal}% optimal · up to ${b.good}% good · up to ${b.warning}% warning · above ${b.warning}% critical`;
  }
  const b = KPI_BANDS.higherBetter;
  return `${b.optimal}% and more optimal · from ${b.good}% good · from ${b.warning}% warning · below ${b.warning}% critical`;
}

const STATUS_TEXT: Record<PM80AdvancedMetric['status'], string> = { optimal: 'optimal', good: 'good', warning: 'warning', critical: 'critical' };

/** the rows of the worked example: the money behind the percent of the screen; the LAST row is the ring itself */
export function kpiInfoNumbers(snapshot: PM80MonthSnapshot, id: KpiId): { caption: string; rows: Array<[string, string]> } {
  const sym = snapshot.currencySymbol;
  const metric = snapshot.advancedMetrics.find((m) => m.id === id)!;
  const money = (n: number) => formatCompactCurrency(n, sym);
  const caption = `${snapshot.monthLabel} · ${snapshot.projectTitle} · IFRS Cost`;
  const status = `${metric.valueText} (${STATUS_TEXT[metric.status]})`;
  const line = roiOfMoney(snapshot.money, { includeSaleVat: false, includePurchaseVat: false });
  if (id === 'budget') {
    const left = line.planCost - line.factCost;
    return { caption, rows: [['Planned cost', money(line.planCost)], ['Fact cost', money(line.factCost)], [left >= 0 ? 'Budget left' : 'Over budget', money(Math.abs(left))], ['Budget used', status]] };
  }
  if (id === 'delivered') {
    return { caption, rows: [['Planned revenue', money(line.planRevenue)], ['Revenue fact input', money(line.usedRevenue)], ['Still to deliver', money(Math.max(0, line.planRevenue - line.usedRevenue))], ['Delivered', status]] };
  }
  if (id === 'collected') {
    const pay = snapshot.satellites.find((s) => s.id === 'payments');
    const invoiced = pay?.planAmount ?? 0;
    const paid = pay?.factAmount ?? 0;
    return { caption, rows: [['Customer invoices issued', money(invoiced)], ['Payments received', money(paid)], ['Still to collect', money(Math.max(0, invoiced - paid))], ['Collected', status]] };
  }
  // capacity: the hours are not in the snapshot; the percent and its band
  return { caption, rows: [['Booked of the calendar hours', metric.valueText], ['Ring color', status]] };
}

/** the modal content of a KPI ring */
export function kpiInfoContent(id: KpiId, snapshot: PM80MonthSnapshot): InfoContent {
  const i = KPI_INFO[id];
  const n = kpiInfoNumbers(snapshot, id);
  return {
    heading: i.heading,
    subheading: i.subheading,
    sections: [
      { title: 'The question it answers', blocks: [{ type: 'p', text: i.question, bold: true }] },
      { title: 'In one sentence', blocks: [{ type: 'p', text: i.inOneSentence }] },
      { title: 'Formula', blocks: [{ type: 'formula', text: i.formula }] },
      { title: 'Where the numbers come from', blocks: [{ type: 'kv', label: 'Numerator', text: i.numerator }, { type: 'kv', label: 'Denominator', text: i.denominator }] },
      { title: 'On this screen now', blocks: [{ type: 'numbers', caption: n.caption, rows: n.rows }] },
      {
        title: 'How to read it',
        blocks: [
          { type: 'p', text: i.direction === 'lower' ? 'Lower is better.' : 'Higher is better (with the reserve in mind).' },
          { type: 'p', text: `Ring colors: ${kpiBandsText(i.direction)}.` },
          { type: 'bullets', items: i.howToRead },
        ],
      },
      { title: 'Watch out', blocks: [{ type: 'bullets', items: i.watchOut }] },
    ],
    footnote: DEMO_FOOTNOTE,
  };
}
