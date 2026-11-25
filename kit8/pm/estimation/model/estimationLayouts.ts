// Estimation dashboard - the FOUR LAYOUTS of the estimate grid (pure: no React) and the columns the user may hide in each. The grid itself is `grid/EstimateGridPane` (columns: `estimateGridModel`).
//   simple    the estimate sheet: position, norm, unit, quantity, coefficient, unit costs (labour, machines, operators, materials), direct costs and the total in current prices
//   advanced  everything: all six cost elements, overhead / profit / index per line, the catalogs of the app (budget item, business unit), the takeoff reference, the total in the budget,
//             accounting and consolidation currency (the resource matrix)
//   quote     the quick quote: category, description, unit, quantity, cost per unit, mark-up, price, status
//   trades    the trade breakdown: a position per trade, labour and materials, total, cost per m2, share
export type EstimationLayout = 'simple' | 'advanced' | 'quote' | 'trades';

/** `tip` = the NAME first, the description after it (the hover tip of the button; pass through pmT) */
export const ESTIMATION_LAYOUTS: { value: EstimationLayout; label: string; tip: string }[] = [
  { value: 'simple', label: 'Estimate sheet', tip: 'Estimate sheet: one line per work with the quantity, the price and the total; the shortest way to type an estimate.' },
  { value: 'advanced', label: 'Advanced (resource matrix)', tip: 'Advanced (resource matrix): every line split into labour, machines, operators, materials and other cost, with the overheads and the profit.' },
  { value: 'quote', label: 'Quick quote', tip: 'Quick quote: a short list of items and prices for a customer offer, without the cost build-up.' },
  { value: 'trades', label: 'Trade breakdown', tip: 'Trade breakdown: the lines grouped by trade, with a subtotal for each trade.' },
];

/** the columns the user may hide per layout (the others - the description - always stay) */
export const LAYOUT_COLUMNS: Record<EstimationLayout, { key: string; title: string }[]> = {
  simple: [['normCode', 'Norm / justification'], ['unit', 'Unit'], ['qty', 'Quantity'], ['coefficient', 'Coef.'], ['unitLabour', 'Labour / unit'], ['unitMachines', 'Machines / unit'], ['unitOperators', 'of which operators'], ['unitMaterials', 'Materials / unit'], ['direct', 'Direct costs'], ['current', 'Total, current prices'], ['sumShown', 'Total, current prices']].map(([key, title]) => ({ key, title })),
  advanced: [['normCode', 'Norm / justification'], ['unit', 'Unit'], ['overheadPct', 'Overheads, %'], ['profitPct', 'Profit, %'], ['index', 'Index'], ['budgetItemGUID', 'Budget item'], ['businessUnitGUID', 'Business unit'], ['takeoffRef', 'Takeoff ref.'], ['c-labour', 'Labour'], ['c-machines', 'Machines'], ['c-operators', 'Operators'], ['c-materials', 'Materials'], ['c-other', 'Other'], ['c-equipment', 'Equipment'], ['payroll', 'Payroll'], ['overheads', 'Overheads'], ['profit', 'Profit'], ['base', 'Total, base prices'], ['sumForBudget', 'Budget currency'], ['sumForAccounting', 'Accounting currency'], ['sumForConsolidation', 'Consolidation currency']].map(([key, title]) => ({ key, title })),
  quote: [['category', 'Category'], ['unit', 'Unit'], ['status', 'Status'], ['markupPct', 'Mark-up, %']].map(([key, title]) => ({ key, title })),
  trades: [['perArea', 'Per m2'], ['share', 'Share']].map(([key, title]) => ({ key, title })),
};
