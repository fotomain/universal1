// The help for the CFO behind the four object-kind buttons of the Summary tab (right click / double click / double touch / long press): what the kind is, what it changes (ONLY the cap of the
// contingency - never the amounts), how the summary is built, what to watch. The worked example is CALCULATED by summaryEstimate with the cap of the kind.
import type { InfoContent } from '../../../ui/components/info/infoContent';
import { contingencyCap, summaryEstimate } from './estimationCalc';
import type { EstimationObjectKind } from './estimationModel';

const n2 = (n: number): string => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** the summary of the worked example, in units: 1 000 000 in the main objects (chapter 2) */
const EXAMPLE_ROWS = [{ chapter: 2, title: 'Main construction objects', construction: 700000, installation: 200000, equipment: 100000, other: 0 }] as any;
export const EXAMPLE_VAT_PCT = 20;

const KINDS: Record<EstimationObjectKind, { heading: string; sub: string; what: string; examples: string; why: string }> = {
  nonProduction: {
    heading: 'Non-production object',
    sub: 'OBJECT KIND · HOUSING, OFFICES, SCHOOLS, HOSPITALS, SHOPS',
    what: 'A building or structure that does not take part in making a product: residential, public and administrative buildings, and similar.',
    examples: 'An apartment block, an office building, a school, a clinic, a shopping centre.',
    why: 'The design and the technology of such objects are well known and repeated, so a small allowance for unforeseen work and costs is expected.',
  },
  production: {
    heading: 'Production object',
    sub: 'OBJECT KIND · FACTORIES, WORKSHOPS, INDUSTRIAL AND AGRICULTURAL BUILDINGS',
    what: 'A building or structure in which a product is made, with process equipment and engineering systems around it.',
    examples: 'A factory hall, a warehouse with process equipment, a livestock building, a processing plant.',
    why: 'The process part brings more changes during construction than a plain building, so a bigger allowance is accepted.',
  },
  linear: {
    heading: 'Linear object',
    sub: 'OBJECT KIND · ROADS, PIPELINES, POWER LINES, RAILWAYS, NETWORKS',
    what: 'An object stretched along a route: its cost depends on the ground along the way, which is only known in part before the work starts.',
    examples: 'A road, a pipeline, a power line, a railway, a water or sewer network.',
    why: 'Ground and crossings change along the route, so the allowance is the same as for a production object.',
  },
  unique: {
    heading: 'Unique / hazardous object',
    sub: 'OBJECT KIND · UNIQUE, HAZARDOUS OR TECHNICALLY COMPLEX OBJECTS',
    what: 'An object that has no repeated design, or carries a hazard (chemical, explosive, nuclear, high-risk), or is technically complex.',
    examples: 'A stadium with a unique roof, a hazardous production, a tunnel, a power plant.',
    why: 'Little of the work can be priced from experience, so the largest allowance is accepted and must be justified.',
  },
};

export function objectKindHelp(kind: EstimationObjectKind): InfoContent {
  const k = KINDS[kind];
  const cap = contingencyCap(kind);
  const s = summaryEstimate(EXAMPLE_ROWS, { contingencyPct: cap, vatPct: EXAMPLE_VAT_PCT, objectKind: kind });
  return {
    heading: k.heading,
    subheading: k.sub,
    sections: [
      { title: 'What it is', blocks: [{ type: 'p', text: k.what }, { type: 'kv', label: 'Examples', text: k.examples }] },
      { title: 'What the kind changes', blocks: [
        { type: 'p', text: `The kind changes ONE thing: the usual cap of the contingency. For this kind it is ${cap} % of chapters 1 - 12. If you type a higher contingency, the Summary tab shows a warning in red; the amounts are still calculated with the percent you typed.` },
        { type: 'kv', label: 'Why this cap', text: k.why },
        { type: 'bullets', items: [
          'Non-production objects: up to 2 %.',
          'Production and linear objects: up to 3 %.',
          'Unique, hazardous and technically complex objects: up to 10 %.',
        ] },
        { type: 'p', text: 'The kind does NOT change any amount of any chapter, the VAT or the layout of the summary.' },
      ] },
      { title: 'How the summary is built', blocks: [
        { type: 'bullets', items: [
          'Every local estimate and every estimate of separate costs of the project goes into the chapter (1 - 12) set in its own document settings.',
          'The summary adds the chapters, shows the running totals after chapters 1 - 7, 1 - 8, 1 - 9 and 1 - 12, then the contingency and the VAT.',
          'Amounts are shown in thousands, in the currency of the button chosen above the estimate.',
        ] },
        { type: 'formula', text: 'Contingency = Total of chapters 1 - 12 × contingency %\nVAT = (Total of chapters 1 - 12 + Contingency) × VAT %\nTOTAL WITH VAT = Total of chapters 1 - 12 + Contingency + VAT' },
        { type: 'numbers', caption: `Worked example: chapters hold 1 000.00 thousand, contingency at the cap of this kind (${cap} %), VAT ${EXAMPLE_VAT_PCT} %`, rows: [
          ['Total, chapters 1 - 12', n2(s.after.to12.total)], [`Contingency (${cap} %)`, n2(s.contingency.total)], [`VAT (${EXAMPLE_VAT_PCT} % of the total with the contingency)`, n2(s.vat.total)], ['TOTAL WITH VAT', n2(s.grand.total)],
        ] },
      ] },
      { title: 'What to watch', blocks: [
        { type: 'bullets', items: [
          'The contingency is an allowance for the work and costs that the design does not show yet. It is not a reserve for a change of the customer\'s wishes or for inflation.',
          'The VAT is taken from the total WITH the contingency, so a higher contingency also raises the VAT.',
          'A document that is not given a chapter is not in the summary: check that every estimate has its chapter.',
          'Choose the kind by the nature of the object, not by the amount you want: the kind exists to keep the contingency honest.',
        ] },
      ] },
    ],
    footnote: 'Right click, double click, double touch or a long press on any object kind button opens its description.',
  };
}
