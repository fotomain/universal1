// A norm of a norm book -> the unit costs of a position (pure). A norm lists the resources it needs per unit of work (labour hours of workers, hours of machines, quantities of materials);
// the priced resources of the same book give the price of every machine hour and material. The labour rate is typed by the user (a norm book has none).
//   labour      Σ quantity of the resources of the class `labour` x labour rate
//   machines    Σ hours x price of the machine (its price already holds the operator pay)          operators = Σ hours x operator pay (INSIDE machines)
//   materials   Σ quantity x price of every resource that is not labour / machine / equipment      equipment = the resources of kind `equipment`
// A resource without a price is listed in `missing` (the position is made, the user prices it by hand).
import { resourceClassOf } from '../import/fsnbReader';

export interface NormResourceRef { code: string; qty: number; name?: string }
export interface PricedResource { code: string; price?: number | null; operatorPay?: number | null; resourceKind?: string | null; title?: string | null }

export interface NormUnitCosts {
  unitLabour: number;
  unitMachines: number;
  unitOperators: number;
  unitMaterials: number;
  unitOther: number;
  unitEquipment: number;
  missing: string[];
}

const r4 = (n: number): number => Math.round(n * 1e4) / 1e4;

export function normToUnitCosts(resources: readonly NormResourceRef[], priced: ReadonlyMap<string, PricedResource>, opts: { labourRate: number }): NormUnitCosts {
  const out: NormUnitCosts = { unitLabour: 0, unitMachines: 0, unitOperators: 0, unitMaterials: 0, unitOther: 0, unitEquipment: 0, missing: [] };
  for (const r of resources) {
    const cls = resourceClassOf(r.code);
    if (cls === 'labour') { out.unitLabour += r.qty * (opts.labourRate || 0); continue; }
    if (cls === 'operators') continue;   // the pay of the operators is taken from the machines (inside their price)
    const p = priced.get(r.code);
    if (!p || p.price == null) { out.missing.push(r.code); continue; }
    if (cls === 'machine' || p.resourceKind === 'machine') { out.unitMachines += r.qty * p.price; out.unitOperators += r.qty * (p.operatorPay ?? 0); }
    else if (p.resourceKind === 'equipment') out.unitEquipment += r.qty * p.price;
    else out.unitMaterials += r.qty * p.price;
  }
  return { unitLabour: r4(out.unitLabour), unitMachines: r4(out.unitMachines), unitOperators: r4(out.unitOperators), unitMaterials: r4(out.unitMaterials), unitOther: r4(out.unitOther), unitEquipment: r4(out.unitEquipment), missing: [...new Set(out.missing)] };
}
