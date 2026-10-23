// Payment plan - "Fill / refresh from <Time | Material | Expense | Deliverable> lines" (pure, unit tested). The task lines of ONE genus become payments:
//   Time, Material, Expense lines -> Outbound payments · Deliverable (revenue) lines -> Inbound payments
//   One payment per GROUP of lines: payee (partner | person) × contract × business unit. Its sum is the sum of the group WITH VAT (sumForContract + sumVATForContract of the lines).
//   The payee: Material / Expense / Deliverable = the partner of the line, else the main vendor of the product; Time = the person (also a Person work center: its base) with his contract;
//   a Partner work center = its partner; an equipment (also an Equipment work center) = its main vendor. Everything else (the budget item of the contract, the shift, the date, the currency)
//   comes from the rules of paymentPlanCompute.ts - the payment is made with the same defaults as one typed by hand (anchor "Task start").
//   REFRESH: a payment made by a fill keeps paymentPlanSource = { genus, taskLineGUIDs }. A second press matches a group to the payment that shares lines with it: the payment gets the new sum
//   and the new line list and keeps EVERYTHING the user typed (date, shift, anchor, budget item, payee, contract ...); a group with no payment makes one; a made payment with no group any more
//   (its lines are gone or empty) is removed. A payment typed by hand (no source) and a payment made from another genus are never touched.
import { MANAGEMENT_GENUS } from '../../../../catalog/management/genus/managementGenusModel';
import { roundTo } from '../../../../catalog/currency/exchange/currencyConvert';
import type { TaskLineCatalogData } from '../finances/taskLineCatalogs';
import { taskLineGenusDef, type TaskLineRow, type TaskLineRowJSON } from '../finances/taskLineModel';
import { lineResourceKind, lineWorkCenter } from '../finances/taskLineResource';
import { computePaymentPlanRowJSON, type PaymentComputeContext } from './paymentPlanCompute';
import { emptyPaymentPlanLine, paymentNumber, paymentPayeeOf, type PaymentDirection, type TaskPaymentPlanRow, type TaskPaymentPlanRowJSON } from './paymentPlanModel';

const isSet = (v: unknown): v is string => typeof v === 'string' && v !== '' && v !== 'empty';

/** the genus that have a fill button, with the direction of their payments */
export const PAYMENT_FILL_GENUS: { genus: string; direction: PaymentDirection; title: string }[] = [
  { genus: MANAGEMENT_GENUS.time, direction: 'outbound', title: 'Time' },
  { genus: MANAGEMENT_GENUS.material, direction: 'outbound', title: 'Material' },
  { genus: MANAGEMENT_GENUS.expense, direction: 'outbound', title: 'Expense' },
  { genus: MANAGEMENT_GENUS.revenue, direction: 'inbound', title: 'Deliverable' },
];
export const fillDirectionOf = (genus: string): PaymentDirection | null => PAYMENT_FILL_GENUS.find((g) => g.genus === genus)?.direction ?? null;

export interface LinePayee { partner: string | null; person: string | null; contract: string | null }

/** who a task line is paid to (all null = nobody known) */
export function linePayeeOf(data: TaskLineCatalogData, genus: string, json: Partial<TaskLineRowJSON>): LinePayee {
  const def = taskLineGenusDef(genus);
  const none: LinePayee = { partner: null, person: null, contract: null };
  if (!def) return none;
  const vendorOf = (row: { rowJSON?: Record<string, any> } | undefined): LinePayee => (isSet(row?.rowJSON?.mainVendorGUID)
    ? { partner: row!.rowJSON!.mainVendorGUID, person: null, contract: isSet(row!.rowJSON!.mainVendorContractGUID) ? row!.rowJSON!.mainVendorContractGUID : null } : none);
  if (def.resource === 'product') {
    if (isSet(json.taskLinePartnerItem)) return { partner: json.taskLinePartnerItem, person: null, contract: isSet(json.taskLinePartnerContract) ? json.taskLinePartnerContract : null };
    return genus === MANAGEMENT_GENUS.revenue ? none : vendorOf(data.product.find((p) => p.rowGUID === json.taskResourceItem));
  }
  const kind = lineResourceKind(def, json);
  if (kind === 'person') return isSet(json.taskResourceItem) ? { partner: null, person: json.taskResourceItem, contract: isSet(json.taskResourceContract) ? json.taskResourceContract : null } : none;
  if (kind === 'equipment') return vendorOf(data.equipment.find((e) => e.rowGUID === json.taskResourceItem));
  // a work center follows its base
  const wc = lineWorkCenter(data, def, json);
  const base = wc?.rowJSON?.workCenterBase;
  if (!wc || !isSet(base)) return none;
  const wcKind = wc.rowJSON?.workCenterKind;
  if (wcKind === 'person') return { partner: null, person: base, contract: isSet(json.taskResourceContract) ? json.taskResourceContract : null };
  if (wcKind === 'partner') return { partner: base, person: null, contract: null };
  return vendorOf(data.equipment.find((e) => e.rowGUID === base));
}

interface Group { key: string; payee: LinePayee; unit: string | null; lineGUIDs: string[]; sum: number }

/** the groups of the lines of a genus (a line with no sum is left out and counted) */
export function paymentGroupsOf(data: TaskLineCatalogData, genus: string, lines: TaskLineRow[]): { groups: Group[]; skipped: number } {
  const groups = new Map<string, Group>();
  let skipped = 0;
  for (const l of lines) {
    if (l.rowParentGUID !== genus) continue;
    const j = l.rowJSON || {};
    const sum = paymentNumber(j.sumForContract);
    if (sum === null || sum <= 0) { skipped += 1; continue; }
    const payee = linePayeeOf(data, genus, j);
    const unit = isSet(j.businessUnitTaskLine) ? j.businessUnitTaskLine : null;
    const key = [payee.partner ?? '', payee.person ?? '', payee.contract ?? '', unit ?? ''].join('|');
    const g = groups.get(key) ?? { key, payee, unit, lineGUIDs: [], sum: 0 };
    g.lineGUIDs.push(l.rowGUID);
    g.sum += sum + (paymentNumber(j.sumVATForContract) ?? 0);
    groups.set(key, g);
  }
  return { groups: [...groups.values()], skipped };
}

export interface PaymentFillPlan {
  create: TaskPaymentPlanRow[];
  update: { rowGUID: string; patch: Partial<TaskPaymentPlanRowJSON> }[];
  remove: string[];
  /** lines of the genus left out because they have no sum */
  skipped: number;
  /** lines of the genus */
  lines: number;
}

export interface PaymentFillArgs {
  genus: string;
  taskGUID: string;
  lines: TaskLineRow[];
  /** every payment of the task (all directions) */
  existing: TaskPaymentPlanRow[];
  data: TaskLineCatalogData;
  ctx: PaymentComputeContext;
  newId: () => string;
  /** orderInList of the first new payment */
  now: number;
}

/** what a press on a fill button changes (nothing is written here) */
export function planPaymentFill({ genus, taskGUID, lines, existing, data, ctx, newId, now }: PaymentFillArgs): PaymentFillPlan {
  const direction = fillDirectionOf(genus);
  const plan: PaymentFillPlan = { create: [], update: [], remove: [], skipped: 0, lines: lines.filter((l) => l.rowParentGUID === genus).length };
  if (!direction) return plan;
  const { groups, skipped } = paymentGroupsOf(data, genus, lines);
  plan.skipped = skipped;
  const made = existing.filter((r) => r.rowParentGUID === direction && r.rowJSON?.paymentPlanSource?.genus === genus);
  const taken = new Set<string>();
  const dctx: PaymentComputeContext = { ...ctx, direction };

  // a group takes the made payment that shares the most lines with it
  groups.forEach((g, i) => {
    let best: TaskPaymentPlanRow | null = null;
    let bestShared = 0;
    for (const r of made) {
      if (taken.has(r.rowGUID)) continue;
      const own = new Set(r.rowJSON?.paymentPlanSource?.taskLineGUIDs ?? []);
      const shared = g.lineGUIDs.filter((x) => own.has(x)).length;
      if (shared > bestShared) { best = r; bestShared = shared; }
    }
    const sum = roundTo(g.sum, 2);
    const source = { genus, taskLineGUIDs: g.lineGUIDs };
    if (best) {
      taken.add(best.rowGUID);
      const next: Partial<TaskPaymentPlanRowJSON> = { ...(best.rowJSON || {}), sumForContract: sum, paymentPlanSource: source };
      const patch: Partial<TaskPaymentPlanRowJSON> = { ...computePaymentPlanRowJSON(dctx, next) };
      if (paymentNumber(best.rowJSON?.sumForContract) !== sum) patch.sumForContract = sum;
      if (JSON.stringify(best.rowJSON?.paymentPlanSource ?? null) !== JSON.stringify(source)) patch.paymentPlanSource = source;
      // a refresh that changes nothing is not an update (the computed fields that equal the row are dropped)
      const changed: Partial<TaskPaymentPlanRowJSON> = {};
      for (const k of Object.keys(patch) as (keyof TaskPaymentPlanRowJSON)[]) {
        if (k === 'paymentIsPosted') continue;
        if (JSON.stringify((best.rowJSON as any)?.[k] ?? null) !== JSON.stringify((patch as any)[k] ?? null)) (changed as any)[k] = (patch as any)[k];
      }
      if (Object.keys(changed).length) plan.update.push({ rowGUID: best.rowGUID, patch: { ...changed, paymentIsPosted: false } });
      return;
    }
    const base: TaskPaymentPlanRowJSON = {
      ...emptyPaymentPlanLine(),
      paymentPlanPaymentDirection: direction,
      paymentPlanPartner: g.payee.partner, paymentPlanPerson: direction === 'outbound' ? g.payee.person : null, paymentPlanContract: g.payee.contract,
      paymentPlanBusinessUnit: g.unit, paymentPlanTimelineAnchor: 'taskStart', sumForContract: sum, paymentPlanSource: source,
    };
    plan.create.push({ rowGUID: newId(), rowOwnerGUID: taskGUID, rowParentGUID: direction, orderInList: now + i, rowJSON: { ...base, ...computePaymentPlanRowJSON(dctx, base) } });
  });
  plan.remove = made.filter((r) => !taken.has(r.rowGUID)).map((r) => r.rowGUID);
  return plan;
}

/** the sentence of the confirmation window: how many payments a fill creates / changes / removes */
export const paymentFillSummary = (plan: PaymentFillPlan): { create: number; update: number; remove: number; nothing: boolean } => ({
  create: plan.create.length, update: plan.update.length, remove: plan.remove.length, nothing: plan.create.length + plan.update.length + plan.remove.length === 0,
});

export { paymentPayeeOf };
