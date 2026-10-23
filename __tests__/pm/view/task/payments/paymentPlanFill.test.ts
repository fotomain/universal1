// "Fill / refresh from <genus> lines": one payment per group (payee x contract x business unit), the sum WITH VAT, persons included, a refresh that keeps the user's edits.
import { fillDirectionOf, linePayeeOf, paymentFillSummary, paymentGroupsOf, planPaymentFill } from '../../../../../kit8/pm/view/task/payments/paymentPlanFill';
import type { TaskPaymentPlanRow } from '../../../../../kit8/pm/view/task/payments/paymentPlanModel';
import type { TaskLineRow } from '../../../../../kit8/pm/view/task/finances/taskLineModel';
import { paymentCtx, paymentData, row } from './paymentsTestKit';

const line = (id: string, genus: string, json: any): TaskLineRow => row(id, 't1', genus, { taskManagementGenusLine: genus, ...json }) as any;
const data = () => {
  const d = paymentData();
  d.product = [row('prodMV', 'productCatalog', 'empty', { mainVendorGUID: 'partnerB', mainVendorContractGUID: 'c_supB' })] as any;
  d.equipment = [row('eq1', 'equipmentCatalog', 'empty', { mainVendorGUID: 'partnerC', mainVendorContractGUID: 'c_supC' })] as any;
  d.workCenter = [
    row('wcPerson', 'workCenterCatalog', 'empty', { workCenterKind: 'person', workCenterBase: 'pers1' }),
    row('wcPartner', 'workCenterCatalog', 'empty', { workCenterKind: 'partner', workCenterBase: 'partnerA' }),
    row('wcEq', 'workCenterCatalog', 'empty', { workCenterKind: 'equipment', workCenterBase: 'eq1' }),
  ] as any;
  return d;
};
let n = 0;
const base = (over: any = {}) => ({ genus: 'materialGenus', taskGUID: 't1', lines: [] as TaskLineRow[], existing: [] as TaskPaymentPlanRow[], data: data(), ctx: paymentCtx('outbound'), newId: () => `new${++n}`, now: 1000, ...over });

describe('which genus fill which direction', () => {
  it('Time, Material, Expense are paid out; the Deliverable is received', () => {
    expect(fillDirectionOf('timeGenus')).toBe('outbound');
    expect(fillDirectionOf('materialGenus')).toBe('outbound');
    expect(fillDirectionOf('expenseGenus')).toBe('outbound');
    expect(fillDirectionOf('revenueGenus')).toBe('inbound');
    expect(fillDirectionOf('inboundPaymentGenus')).toBeNull();
  });
});

describe('who a task line is paid to', () => {
  const d = data();
  it('Material / Expense / Deliverable: the partner of the line with its contract; else the main vendor of the product (not for a Deliverable)', () => {
    expect(linePayeeOf(d, 'materialGenus', { taskLinePartnerItem: 'partnerA', taskLinePartnerContract: 'c_sup' })).toEqual({ partner: 'partnerA', person: null, contract: 'c_sup' });
    expect(linePayeeOf(d, 'materialGenus', { taskResourceItem: 'prodMV' })).toEqual({ partner: 'partnerB', person: null, contract: 'c_supB' });
    expect(linePayeeOf(d, 'revenueGenus', { taskResourceItem: 'prodMV' })).toEqual({ partner: null, person: null, contract: null });
  });
  it('Time: a PERSON line pays the person with his contract (persons are included)', () => {
    expect(linePayeeOf(d, 'timeGenus', { taskResourceKind: 'person', taskResourceItem: 'pers1', taskResourceContract: 'c_person' })).toEqual({ partner: null, person: 'pers1', contract: 'c_person' });
    expect(linePayeeOf(d, 'timeGenus', { taskResourceItem: 'pers1', taskResourceContract: 'c_person' }).person).toBe('pers1');   // a line made before work centers is a person's
  });
  it('Time: an equipment pays its main vendor; a work center follows its base (person | partner | equipment)', () => {
    expect(linePayeeOf(d, 'timeGenus', { taskResourceKind: 'equipment', taskResourceItem: 'eq1' })).toEqual({ partner: 'partnerC', person: null, contract: 'c_supC' });
    expect(linePayeeOf(d, 'timeGenus', { taskResourceKind: 'workCenter', taskResourceItem: 'wcPerson', taskResourceContract: 'c_person' })).toEqual({ partner: null, person: 'pers1', contract: 'c_person' });
    expect(linePayeeOf(d, 'timeGenus', { taskResourceKind: 'workCenter', taskResourceItem: 'wcPartner' })).toEqual({ partner: 'partnerA', person: null, contract: null });
    expect(linePayeeOf(d, 'timeGenus', { taskResourceKind: 'workCenter', taskResourceItem: 'wcEq' }).partner).toBe('partnerC');
  });
});

describe('the groups: payee x contract x business unit, the sum WITH VAT', () => {
  it('two lines of one supplier and contract are ONE payment: the sums and the VAT add up', () => {
    const lines = [
      line('l1', 'materialGenus', { taskLinePartnerItem: 'partnerA', taskLinePartnerContract: 'c_sup', sumForContract: 100, sumVATForContract: 21 }),
      line('l2', 'materialGenus', { taskLinePartnerItem: 'partnerA', taskLinePartnerContract: 'c_sup', sumForContract: 50, sumVATForContract: 10.5 }),
      line('l3', 'materialGenus', { taskLinePartnerItem: 'partnerB', taskLinePartnerContract: 'c_supB', sumForContract: 10, sumVATForContract: 0 }),
    ];
    const { groups, skipped } = paymentGroupsOf(data(), 'materialGenus', lines);
    expect(groups.map((g) => [g.lineGUIDs, g.sum])).toEqual([[['l1', 'l2'], 181.5], [['l3'], 10]]);
    expect(skipped).toBe(0);
  });
  it('another business unit is another payment; a line with no sum is left out and counted; another genus is not read', () => {
    const lines = [
      line('l1', 'materialGenus', { taskLinePartnerItem: 'partnerA', taskLinePartnerContract: 'c_sup', sumForContract: 100, businessUnitTaskLine: 'bu1' }),
      line('l2', 'materialGenus', { taskLinePartnerItem: 'partnerA', taskLinePartnerContract: 'c_sup', sumForContract: 100, businessUnitTaskLine: 'bu2' }),
      line('l3', 'materialGenus', { taskLinePartnerItem: 'partnerA', sumForContract: null }),
      line('l4', 'expenseGenus', { taskLinePartnerItem: 'partnerA', sumForContract: 999 }),
    ];
    const g = paymentGroupsOf(data(), 'materialGenus', lines);
    expect(g.groups).toHaveLength(2);
    expect(g.skipped).toBe(1);
  });
});

describe('planPaymentFill: a first press makes the payments with the defaults of a payment typed by hand', () => {
  it('Material lines -> Outbound payments: payee, contract, budget item of the contract, shift, date, anchor Task start, the source, the sum', () => {
    const lines = [line('l1', 'materialGenus', { taskLinePartnerItem: 'partnerA', taskLinePartnerContract: 'c_sup', sumForContract: 100, sumVATForContract: 21 })];
    const plan = planPaymentFill(base({ lines }));
    expect(plan.create).toHaveLength(1);
    const p = plan.create[0];
    expect(p).toMatchObject({ rowOwnerGUID: 't1', rowParentGUID: 'outbound' });
    expect(p.rowJSON).toMatchObject({
      paymentPlanPartner: 'partnerA', paymentPlanContract: 'c_sup', paymentPlanBudgetItem: 'bi_out', paymentPlanTimelineAnchor: 'taskStart', paymentPlanTimelineShiftDays: 30,
      paymentPlannedTransactionDate: '2026-10-31', paymentPlanCurrency: 'USD', sumForContract: 121, paymentPlanSource: { genus: 'materialGenus', taskLineGUIDs: ['l1'] }, paymentIsPosted: false,
    });
    expect(plan.update).toEqual([]);
    expect(plan.remove).toEqual([]);
  });
  it('Deliverable lines -> INBOUND payments of the customer', () => {
    const lines = [line('l1', 'revenueGenus', { taskLinePartnerItem: 'custA', taskLinePartnerContract: 'c_cust', sumForContract: 500 })];
    const plan = planPaymentFill(base({ genus: 'revenueGenus', lines, ctx: paymentCtx('inbound') }));
    expect(plan.create[0]).toMatchObject({ rowParentGUID: 'inbound' });
    expect(plan.create[0].rowJSON).toMatchObject({ paymentPlanPartner: 'custA', paymentPlanBudgetItem: 'bi_in', paymentPlanTimelineShiftDays: 10, paymentPlannedTransactionDate: '2026-10-11' });
  });
  it('Time lines of a PERSON make a payment to the person with his contract and the outbound item of it', () => {
    const lines = [line('l1', 'timeGenus', { taskResourceKind: 'person', taskResourceItem: 'pers1', taskResourceContract: 'c_person', sumForContract: 800 })];
    const p = planPaymentFill(base({ genus: 'timeGenus', lines })).create[0];
    expect(p.rowJSON).toMatchObject({ paymentPlanPerson: 'pers1', paymentPlanPartner: null, paymentPlanContract: 'c_person', paymentPlanBudgetItem: 'bi_out2' });
  });
  it('a line without a payee still makes a payment (the Errors column asks for it)', () => {
    const plan = planPaymentFill(base({ lines: [line('l1', 'materialGenus', { sumForContract: 5 })] }));
    expect(plan.create).toHaveLength(1);
    expect(plan.create[0].rowJSON.paymentPlanPartner ?? null).toBeNull();
  });
  it('no lines of the genus: nothing to do', () => {
    const plan = planPaymentFill(base({ lines: [] }));
    expect(paymentFillSummary(plan).nothing).toBe(true);
    expect(plan.lines).toBe(0);
  });
});

describe('REFRESH: a second press changes only what it must and keeps what the user typed', () => {
  const lines = [line('l1', 'materialGenus', { taskLinePartnerItem: 'partnerA', taskLinePartnerContract: 'c_sup', sumForContract: 100 })];
  const made = (): TaskPaymentPlanRow => {
    const p = planPaymentFill(base({ lines })).create[0];
    return { ...p, rowJSON: { ...p.rowJSON, paymentIsPosted: true } };
  };
  it('the same lines: nothing changes (no write)', () => {
    const plan = planPaymentFill(base({ lines, existing: [made()] }));
    expect(paymentFillSummary(plan).nothing).toBe(true);
  });
  it('a line sum changed: the payment gets the new sum, is unposted, and keeps the date, the anchor and the item the user typed', () => {
    const m = made();
    m.rowJSON = { ...m.rowJSON, paymentPlanTimelineAnchor: 'taskEnd', paymentPlanTimelineShiftDays: 2, paymentPlannedTransactionDate: '2026-10-12', paymentPlanDateSource: 'shift', paymentPlanDateSnapshot: { shift: 2, date: '2026-10-12', anchor: 'taskEnd' }, paymentPlanBudgetItem: 'bi_out2' };
    const changed = [line('l1', 'materialGenus', { taskLinePartnerItem: 'partnerA', taskLinePartnerContract: 'c_sup', sumForContract: 250 })];
    const plan = planPaymentFill(base({ lines: changed, existing: [m] }));
    expect(plan.update).toHaveLength(1);
    expect(plan.update[0].patch).toMatchObject({ sumForContract: 250, paymentIsPosted: false });
    expect(plan.update[0].patch.paymentPlanBudgetItem).toBeUndefined();
    expect(plan.update[0].patch.paymentPlannedTransactionDate).toBeUndefined();
    expect(plan.update[0].patch.paymentPlanTimelineAnchor).toBeUndefined();
  });
  it('a group that has no lines any more removes its payment; a new group makes one', () => {
    const plan = planPaymentFill(base({ lines: [line('l9', 'materialGenus', { taskLinePartnerItem: 'partnerB', taskLinePartnerContract: 'c_supB', sumForContract: 10 })], existing: [made()] }));
    expect(plan.remove).toHaveLength(1);
    expect(plan.create).toHaveLength(1);
  });
  it('a payment typed by hand and a payment made from another genus are NEVER touched', () => {
    const hand: TaskPaymentPlanRow = { rowGUID: 'hand', rowOwnerGUID: 't1', rowParentGUID: 'outbound', rowJSON: { sumForContract: 7, paymentPlanSource: null } };
    const other: TaskPaymentPlanRow = { rowGUID: 'other', rowOwnerGUID: 't1', rowParentGUID: 'outbound', rowJSON: { paymentPlanSource: { genus: 'expenseGenus', taskLineGUIDs: ['x'] } } };
    const plan = planPaymentFill(base({ lines: [], existing: [hand, other] }));
    expect(plan.remove).toEqual([]);
    expect(plan.update).toEqual([]);
  });
});
