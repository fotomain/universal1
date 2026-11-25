// Illustrative sample data for the prototypes (NOT real price-book values). All totals are computed here so the screens agree with each other.
export const IDX_SMR = 8.74; // sample index to current prices (construction & erection works)
export const NR_PCT = 90; // sample overhead norm, % of payroll (labour + machine operators)
export const SP_PCT = 50; // sample estimated profit norm, % of payroll
export const VAT_PCT = 20; // taken from the project settings
export const CONTINGENCY_PCT = 2; // GOST 421/pr item 179: <= 2 % non-production, <= 3 % production, <= 10 % unique

export interface Pos {
  no: number; section: string; code: string; name: string; unit: string; qty: number;
  labour: number; plant: number; operators: number; material: number; // per unit, base prices; operators are INCLUDED in plant
  coef: number; coefNote?: string; budgetItem: string; takeoff?: string;
}
export const POSITIONS: Pos[] = [
  { no: 1, section: 'Section 1. Earthworks', code: 'FER 01-01-013-03', name: 'Excavation with hydraulic excavator 0.65 m3, soil group 2, loading into trucks', unit: '1000 m3', qty: 0.84, labour: 0, plant: 4815.0, operators: 620.4, material: 0, coef: 1, budgetItem: 'Earthworks', takeoff: 'TO-001' },
  { no: 2, section: 'Section 1. Earthworks', code: 'FER 01-02-057-01', name: 'Hand trimming of trench bottom, soil group 2', unit: '100 m3', qty: 0.36, labour: 1260.0, plant: 0, operators: 0, material: 0, coef: 1.2, coefNote: 'k=1.2 cramped conditions', budgetItem: 'Earthworks', takeoff: 'TO-002' },
  { no: 3, section: 'Section 1. Earthworks', code: 'FER 01-01-033-02', name: 'Backfilling of trenches, soil from stockpile', unit: '1000 m3', qty: 0.41, labour: 96.5, plant: 1730.0, operators: 205.0, material: 0, coef: 1, budgetItem: 'Earthworks' },
  { no: 4, section: 'Section 2. Foundations', code: 'FER 06-01-001-01', name: 'Blinding concrete B7.5, 100 mm', unit: '100 m3', qty: 0.18, labour: 3120.0, plant: 1960.0, operators: 340.0, material: 41250.0, coef: 1, budgetItem: 'Concrete works', takeoff: 'TO-003' },
  { no: 5, section: 'Section 2. Foundations', code: 'FER 06-01-001-16', name: 'Reinforced concrete strip foundations, concrete B25, formwork and reinforcement', unit: '100 m3', qty: 1.24, labour: 14980.0, plant: 6120.0, operators: 1105.0, material: 187400.0, coef: 1, budgetItem: 'Concrete works', takeoff: 'TO-004' },
  { no: 6, section: 'Section 2. Foundations', code: 'FER 08-01-003-07', name: 'Horizontal waterproofing, two layers of bituminous membrane', unit: '100 m2', qty: 5.2, labour: 842.0, plant: 96.0, operators: 18.0, material: 7340.0, coef: 1, budgetItem: 'Waterproofing', takeoff: 'TO-005' },
  { no: 7, section: 'Section 3. Superstructure walls', code: 'FER 08-02-001-04', name: 'Masonry of external walls, aerated concrete blocks 300 mm', unit: '1 m3', qty: 148.04, labour: 412.0, plant: 66.0, operators: 12.5, material: 3625.0, coef: 1, budgetItem: 'Masonry', takeoff: 'TO-006' },
  { no: 8, section: 'Section 3. Superstructure walls', code: 'FER 09-03-012-02', name: 'Lintels, precast reinforced concrete, installation', unit: '100 pcs', qty: 0.62, labour: 3880.0, plant: 2410.0, operators: 380.0, material: 9150.0, coef: 1, budgetItem: 'Masonry' },
];
export const calc = (p: Pos) => {
  const labour = p.qty * p.labour * p.coef, plant = p.qty * p.plant * p.coef, ops = p.qty * p.operators * p.coef, mat = p.qty * p.material * p.coef;
  const direct = labour + plant + mat, payroll = labour + ops;
  return { labour, plant, ops, mat, direct, payroll, oh: payroll * NR_PCT / 100, profit: payroll * SP_PCT / 100 };
};
export const totals = (list: Pos[] = POSITIONS) => {
  const t = list.reduce((a, p) => { const c = calc(p); return { labour: a.labour + c.labour, plant: a.plant + c.plant, ops: a.ops + c.ops, mat: a.mat + c.mat, direct: a.direct + c.direct, payroll: a.payroll + c.payroll, oh: a.oh + c.oh, profit: a.profit + c.profit }; }, { labour: 0, plant: 0, ops: 0, mat: 0, direct: 0, payroll: 0, oh: 0, profit: 0 });
  const base = t.direct + t.oh + t.profit;
  return { ...t, base, current: base * IDX_SMR };
};
export const sections = () => Array.from(new Set(POSITIONS.map((p) => p.section)));

export const fmt = (n: number, d = 2) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtK = (n: number) => fmt(n / 1000, 2);

// quick-quote sample (trade layout)
export const QUICK = [
  { id: 1, status: 'Complete', cat: 'Plans and permitting', task: 'Design and layout', unit: 'Unit', qty: 1, cost: 2500, markup: 25 },
  { id: 2, status: 'Complete', cat: 'Plans and permitting', task: 'Permit application', unit: 'Unit', qty: 1, cost: 1200, markup: 25 },
  { id: 3, status: 'Complete', cat: 'General conditions', task: 'Site manager', unit: 'Days', qty: 18, cost: 190, markup: 25 },
  { id: 4, status: 'Open', cat: 'Demolition', task: 'Strip out and haul away debris', unit: 'Hourly', qty: 24, cost: 100, markup: 25 },
  { id: 5, status: 'Open', cat: 'Electrical', task: 'Recessed lighting, supply and fix', unit: 'Each', qty: 8, cost: 175, markup: 25 },
  { id: 6, status: 'Open', cat: 'Plumbing', task: 'Relocate waste and supply pipework', unit: 'Unit', qty: 1, cost: 2500, markup: 25 },
  { id: 7, status: 'Open', cat: 'Flooring', task: 'Porcelain tile floor, laid', unit: 'Sqft', qty: 250, cost: 9, markup: 30 },
  { id: 8, status: 'Open', cat: 'Painting', task: 'Paint walls and ceilings, two coats', unit: 'Sqft', qty: 800, cost: 1.75, markup: 20 },
];
export const TRADES = [
  { trade: 'Surveying', labour: 1000, material: 0 }, { trade: 'Erosion control', labour: 1800, material: 1260 }, { trade: 'Sewer and water', labour: 2000, material: 1700 },
  { trade: 'Concrete paving', labour: 700, material: 1400 }, { trade: 'Landscaping', labour: 2000, material: 6500 }, { trade: 'Rebar and concrete', labour: 3500, material: 5787 },
  { trade: 'Structural metals', labour: 6500, material: 16500 }, { trade: 'Roofing', labour: 4500, material: 18765 }, { trade: 'Windows', labour: 2750, material: 26000 }, { trade: 'Drywall', labour: 4000, material: 5500 },
];
