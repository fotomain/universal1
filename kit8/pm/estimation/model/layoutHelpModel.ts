// The help for the CFO behind the four layout buttons of the Estimation dashboard (right click / double click / double touch / long press on a button): what the layout is, when to use it,
// what every column means, how the numbers are made (the same functions as the sheet: estimationCalc), what to watch. Plain data (InfoContent) - tested without a screen.
// The worked examples are CALCULATED here with positionCost, never typed: the help cannot disagree with the sheet.
import type { InfoContent } from '../../../ui/components/info/infoContent';
import { positionCost, round2 } from './estimationCalc';
import type { EstimationLayout } from '../ui/EstimateSheet';

const n2 = (n: number): string => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** the position of the worked example of the estimate sheet / the resource matrix: 100 units of work */
export const EXAMPLE_POSITION = { qty: 100, coef: 1, unitLabour: 5, unitMachines: 20, unitOperators: 4, unitMaterials: 10, unitOther: 0, unitEquipment: 6, overheadPct: 80, profitPct: 50, index: 5 };

const common = (): InfoContent['sections'] => [
  {
    title: 'Rules common to all four layouts',
    blocks: [
      { type: 'bullets', items: [
        'The four buttons are four VIEWS of the same lines. Nothing is converted when you switch: a number typed in one layout is there in the others.',
        'A line is a POSITION and belongs to ONE task of the task tree on the left. A stage (or a task with subtasks) carries no estimate: it shows the totals of the tasks below it.',
        'The three currencies are stored, not converted on the screen: the budget, the accounting and the consolidation currency of the project. The buttons above the sheet only choose which one you read.',
        'Every line result is rounded to 2 decimals; a total is the sum of rounded lines. The sum of the screen therefore equals the sum of the printed lines, to the cent.',
        'The norm of a position is chosen from the norm books (the link in the norm column). The unit costs it brings are copied INTO the line: a later change of the book does not move an estimate you have already made.',
      ] },
    ],
  },
];

function simpleHelp(): InfoContent {
  const c = positionCost(EXAMPLE_POSITION);
  return {
    heading: 'Estimate sheet',
    subheading: 'ESTIMATE · THE SHORTEST WAY TO TYPE AND CHECK AN ESTIMATE',
    sections: [
      { title: 'What it is', blocks: [
        { type: 'p', text: 'One line per work item: what is done, by which norm, in what unit, how much, and what one unit costs in labour, machines and materials. This is the working layout of the estimator and the one you give a reviewer.' },
      ] },
      { title: 'When a CFO uses it', blocks: [
        { type: 'bullets', items: [
          'To check that an estimate is complete and priced: every position has a norm, a unit, a quantity and unit costs.',
          'To compare the total of one task with its budget; the total in current prices is the last column.',
          'To find the lines that carry the money: sort or read the Direct costs and Total columns.',
        ] },
      ] },
      { title: 'The columns', blocks: [
        { type: 'kv', label: 'Description / Norm / Unit', text: 'the work, the norm it was taken from and the unit of measure (e.g. 1000 m3).' },
        { type: 'kv', label: 'Quantity and Coef.', text: 'how many units, and the correction for the conditions of the site (cramped site, winter work). The line works with Quantity × Coef.' },
        { type: 'kv', label: 'Labour / unit', text: 'wages of the workers for one unit of work.' },
        { type: 'kv', label: 'Machines / unit', text: 'the running cost of the machines for one unit, INCLUDING the pay of their operators.' },
        { type: 'kv', label: 'of which operators', text: 'the part of Machines that is the pay of the operators. It is not added again: it only enters the payroll the overheads and the profit are taken from.' },
        { type: 'kv', label: 'Materials / unit', text: 'the materials for one unit.' },
        { type: 'kv', label: 'Direct costs', text: 'labour + machines + materials (+ other) of the line.' },
        { type: 'kv', label: 'Total, current prices', text: 'the line with its overheads and profit, brought to today\'s prices by the index of the estimate.' },
      ] },
      { title: 'How the numbers are made', blocks: [
        { type: 'formula', text: 'k = Quantity × Coef.\nDirect costs = k × (Labour + Machines + Materials + Other)\nPayroll = k × (Labour + Operators)\nOverheads = Payroll × overhead %    Profit = Payroll × profit %\nTotal base prices = Direct costs + Overheads + Profit + Equipment\nTotal current prices = Total base prices × Index' },
        { type: 'numbers', caption: 'Worked example: 100 units, labour 5.00, machines 20.00 (operators 4.00), materials 10.00, equipment 6.00, overheads 80 %, profit 50 %, index 5', rows: [
          ['Labour', n2(c.labour)], ['Machines', n2(c.machines)], ['Materials', n2(c.materials)], ['Direct costs', n2(c.direct)],
          ['Payroll (labour + operators)', n2(c.payroll)], ['Overheads (80 % of payroll)', n2(c.overheads)], ['Profit (50 % of payroll)', n2(c.profit)], ['Equipment (no overheads, no profit)', n2(c.equipment)],
          ['Total, base prices', n2(c.base)], ['Total, current prices (× 5)', n2(c.current)],
        ] },
      ] },
      { title: 'What to watch', blocks: [
        { type: 'bullets', items: [
          'This layout hides the overhead %, profit % and index columns, but the total still includes them: they come from the settings of the estimate. A total here is NOT the sum of the visible columns.',
          'Overheads and profit are taken from the PAYROLL, not from direct costs: a material-heavy line carries little overhead by design.',
          'Equipment bought for the object carries no overheads and no profit; it is added at the base level.',
          'A position with no norm or with a zero unit cost is a gap in the estimate, not a free item: look for empty cost cells.',
        ] },
      ] },
      ...common(),
    ],
    footnote: 'Right click, double click, double touch or a long press on any layout button opens its description.',
  };
}

function advancedHelp(): InfoContent {
  const c = positionCost(EXAMPLE_POSITION);
  return {
    heading: 'Advanced (resource matrix)',
    subheading: 'ESTIMATE · EVERY COST ELEMENT AND EVERY NORM OF EVERY LINE',
    sections: [
      { title: 'What it is', blocks: [
        { type: 'p', text: 'The same lines as the estimate sheet with everything opened: all six cost elements as separate columns, the overhead %, profit % and index of each line, the budget item and the business unit, the takeoff reference, and the total in all three currencies.' },
      ] },
      { title: 'When a CFO uses it', blocks: [
        { type: 'bullets', items: [
          'To see WHAT the money is made of: labour, machines, operators, materials, other, equipment per line and in total.',
          'To post an estimate against the budget: the budget item and the business unit of a line say where its cost belongs.',
          'To audit a rate: the line may override the overhead %, the profit % and the index of the estimate, and this is the only layout where it is visible.',
          'To read the same total in the budget, the accounting and the consolidation currency side by side.',
        ] },
      ] },
      { title: 'The extra columns', blocks: [
        { type: 'kv', label: 'Other / unit and Equipment / unit', text: 'other direct costs and the equipment of one unit. Equipment is outside the payroll: no overheads and no profit are charged on it.' },
        { type: 'kv', label: 'Overheads, % and Profit, %', text: 'the norms of THIS line. Empty = the norm of the estimate; a typed value overrides it for this line only.' },
        { type: 'kv', label: 'Index', text: 'the coefficient from base prices to current prices of this line. Empty = the index of the estimate.' },
        { type: 'kv', label: 'Budget item / Business unit', text: 'the catalogs of the application: the budget item (what kind of cost) and the business unit (who bears it).' },
        { type: 'kv', label: 'Takeoff ref.', text: 'where the quantity comes from (a drawing sheet, a model element), for the person who has to defend it.' },
        { type: 'kv', label: 'Labour · Machines · Operators · Materials · Other · Equipment · Direct costs · Payroll · Overheads · Profit', text: 'the money of the line in each element (calculated, read only).' },
        { type: 'kv', label: 'Budget / Accounting / Consolidation currency', text: 'the total in current prices in the three currencies of the project.' },
      ] },
      { title: 'How the numbers are made', blocks: [
        { type: 'formula', text: 'Each element = Quantity × Coef. × unit cost of the element\nDirect costs = Labour + Machines + Materials + Other\nPayroll = Labour + Operators\nOverheads = Payroll × overhead %     Profit = Payroll × profit %\nTotal base prices = Direct costs + Overheads + Profit + Equipment\nTotal current prices = Total base prices × Index' },
        { type: 'numbers', caption: 'The same example in the matrix: 100 units, overheads 80 %, profit 50 %, index 5', rows: [
          ['Labour', n2(c.labour)], ['Machines (operators included)', n2(c.machines)], ['of which operators', n2(c.operators)], ['Materials', n2(c.materials)],
          ['Direct costs', n2(c.direct)], ['Payroll', n2(c.payroll)], ['Overheads', n2(c.overheads)], ['Profit', n2(c.profit)], ['Equipment', n2(c.equipment)],
          ['Total, base prices', n2(c.base)], ['Total, current prices', n2(c.current)],
        ] },
      ] },
      { title: 'What to watch', blocks: [
        { type: 'bullets', items: [
          'Operators are INSIDE Machines. Adding the Operators column to the others double counts them: Direct costs already has them.',
          'A line with its own overhead % or index differs from its neighbours for a reason that is not visible in the other layouts: check these columns when two similar lines have different totals.',
          'The three currency columns use the exchange rates saved in the estimate and are stored with the line: switching the currency button above the sheet recalculates nothing, it only chooses the column you read.',
          'A line with no budget item cannot be placed against a budget.',
        ] },
      ] },
      ...common(),
    ],
    footnote: 'Right click, double click, double touch or a long press on any layout button opens its description.',
  };
}

function quoteHelp(): InfoContent {
  const cost = round2(20 * 15);
  const price = round2(cost * (1 + 25 / 100));
  return {
    heading: 'Quick quote',
    subheading: 'OFFER · A SHORT PRICE LIST FOR A CUSTOMER WITHOUT THE COST BUILD-UP',
    sections: [
      { title: 'What it is', blocks: [
        { type: 'p', text: 'A list of items with a quantity, what one unit costs you and the mark-up you add. The customer sees a price; the cost build-up (norms, labour, machines, overheads) is not part of this layout.' },
      ] },
      { title: 'When a CFO uses it', blocks: [
        { type: 'bullets', items: [
          'For a fast offer or a change request, when a full estimate is not worth the time.',
          'To see the margin of an offer at once: the cost, the mark-up and the price stand in one row.',
          'To track a quotation: each item is Open or Complete.',
        ] },
      ] },
      { title: 'The columns', blocks: [
        { type: 'kv', label: 'Category', text: 'a group for the offer (Works, Materials, Transport).' },
        { type: 'kv', label: 'Description, Unit, Quantity', text: 'the item and how many.' },
        { type: 'kv', label: 'Cost per unit', text: 'what one unit costs YOU.' },
        { type: 'kv', label: 'Cost', text: 'Quantity × Cost per unit.' },
        { type: 'kv', label: 'Mark-up, %', text: 'the margin you add on top of the cost of this item.' },
        { type: 'kv', label: 'Price', text: 'the price of the item for the customer.' },
        { type: 'kv', label: 'Status', text: 'Open = still being priced or discussed; Complete = agreed.' },
      ] },
      { title: 'How the numbers are made', blocks: [
        { type: 'formula', text: 'Cost = Quantity × Cost per unit\nPrice = Cost × (1 + Mark-up % / 100)' },
        { type: 'numbers', caption: 'Worked example: 20 units at 15.00 each, mark-up 25 %', rows: [['Cost (20 × 15.00)', n2(cost)], ['Mark-up (25 %)', n2(round2(price - cost))], ['Price', n2(price)]] },
      ] },
      { title: 'What to watch', blocks: [
        { type: 'bullets', items: [
          'The mark-up is a percentage of COST, not of price: 25 % on cost is a margin of 20 % on the price (100 cost → 125 price → 25 of 125). Do not compare it with a margin target in the wrong base.',
          'This layout has no overheads, profit norm or index: the mark-up must carry them all. An item priced with a thin mark-up here is cheaper than the same work in the estimate sheet.',
          'The prices are not stored as numbers: they follow the cost and the mark-up. Change the cost and the price moves.',
        ] },
      ] },
      ...common(),
    ],
    footnote: 'Right click, double click, double touch or a long press on any layout button opens its description.',
  };
}

function tradesHelp(): InfoContent {
  const labour = 1200, materials = 3800, total = round2(labour + materials), area = 100, other = 5000;
  return {
    heading: 'Trade breakdown',
    subheading: 'SUMMARY · THE ESTIMATE BY TRADE, WITH COST PER m² AND SHARE OF THE TOTAL',
    sections: [
      { title: 'What it is', blocks: [
        { type: 'p', text: 'One line per trade (earthworks, concrete, finishing, MEP ...) with its labour and materials and what each trade costs per square metre and as a share of the whole. It is the layout for a conversation about the shape of the budget, not about single works.' },
      ] },
      { title: 'When a CFO uses it', blocks: [
        { type: 'bullets', items: [
          'To see where the money goes: which trades carry the budget and how heavy each is.',
          'To benchmark: the cost per m² of the object compared with other objects or with the market.',
          'To explain a budget to an investor or a board on one page.',
        ] },
      ] },
      { title: 'The columns', blocks: [
        { type: 'kv', label: 'Trade / description', text: 'the trade (or a lump item).' },
        { type: 'kv', label: 'Labour and Materials', text: 'the labour and the materials of the trade.' },
        { type: 'kv', label: 'Total, current prices', text: 'the cost of the trade in current prices.' },
        { type: 'kv', label: 'Per m2', text: 'the total of the trade divided by the area of the object (typed in the settings of the estimate). Empty while the area is 0.' },
        { type: 'kv', label: 'Share', text: 'the part of the whole estimate this trade is, as a bar.' },
      ] },
      { title: 'How the numbers are made', blocks: [
        { type: 'formula', text: 'Per m² = Total of the trade (current prices) / Area of the object\nShare = Total of the trade / Total of the estimate' },
        { type: 'numbers', caption: `Worked example: a trade with labour ${n2(labour)} and materials ${n2(materials)} in an estimate of ${n2(total + other)}, object area ${area} m²`, rows: [
          ['Total of the trade', n2(total)], ['Per m² (÷ 100)', n2(round2(total / area))], ['Share (÷ ' + n2(total + other) + ')', `${n2(round2((total / (total + other)) * 100))} %`],
        ] },
      ] },
      { title: 'What to watch', blocks: [
        { type: 'bullets', items: [
          'Per m² needs the AREA in the settings of the estimate; with no area the column stays empty, it is not zero.',
          'The total of the trade is in CURRENT prices (with overheads, profit and index), so it is comparable with the estimate total, not with the direct costs of the other layouts.',
          'A share is of the WHOLE estimate shown (all tasks of the picked row), so a share changes when you pick another task or stage.',
          'Cost per m² from different objects is comparable only when the area is counted the same way (total, usable, built-up).',
        ] },
      ] },
      ...common(),
    ],
    footnote: 'Right click, double click, double touch or a long press on any layout button opens its description.',
  };
}

export function layoutHelp(layout: EstimationLayout): InfoContent {
  return layout === 'advanced' ? advancedHelp() : layout === 'quote' ? quoteHelp() : layout === 'trades' ? tradesHelp() : simpleHelp();
}
