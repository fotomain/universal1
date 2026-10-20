// The second level of the budget item tree: the activity nodes (kit8/catalog/budget/item/budgetItemModel.ts). Virtual: nothing is stored.
import { budgetItemActivitiesOfFolder, budgetItemActivityNodeId, budgetItemActivityNodeParts, budgetItemMoveToNode, budgetItemNewRowOfNode, budgetItemNodeOfRow, budgetItemNodes, isBudgetItemActivityNode } from '../../../kit8/catalog/budget/item/budgetItemModel';

const folder = (id: string, order: number) => ({ rowGUID: id, rowOwnerGUID: 'budgetItemCatalog', rowParentGUID: 'empty', orderInList: order, rowJSON: { title: id } });
const item = (id: string, parent: string, genus: string, key?: string, over: Record<string, any> = {}) => ({ rowGUID: id, rowOwnerGUID: 'budgetItemCatalog', rowParentGUID: parent, orderInList: 1, rowJSON: { title: id, managementGenusItem: genus, ...(key ? { budgetItemGenericKey: key } : {}), ...over } });
const rows = () => [
  folder('costs', 100), folder('payments', 200),
  item('time', 'costs', 'timeGenus', 'operatingActivity.timeGenus'), item('ppe', 'costs', 'materialGenus', 'investingActivity.materialGenus'),
  item('loan', 'payments', 'inboundPaymentGenus', 'financingActivity.inboundPaymentGenus'),
];

describe('node ids', () => {
  it('<folder>::<activity> and back; anything else is no activity node', () => {
    expect(budgetItemActivityNodeId('costs', 'investingActivity')).toBe('costs::investingActivity');
    expect(budgetItemActivityNodeParts('costs::investingActivity')).toEqual({ folder: 'costs', activity: 'investingActivity' });
    for (const bad of ['costs', '::x', 'costs::', null, undefined, 3]) expect(budgetItemActivityNodeParts(bad)).toBeNull();
    expect(isBudgetItemActivityNode('costs::operatingActivity')).toBe(true);
    expect(isBudgetItemActivityNode('costsBudgetFolder')).toBe(false);
  });
});

describe('budgetItemNodes', () => {
  it('a folder, then its activities in the order of the cash flow statement (level 2, parent = the folder)', () => {
    const n = budgetItemNodes(rows());
    expect(n.filter((x) => !x.parentId).map((x) => x.id)).toEqual(['costs', 'payments']);
    expect(n.filter((x) => x.parentId === 'costs').map((x) => x.id)).toEqual(['costs::operatingActivity', 'costs::investingActivity']);
    expect(n.filter((x) => x.parentId === 'payments').map((x) => x.id)).toEqual(['payments::operatingActivity', 'payments::investingActivity', 'payments::financingActivity']);
    expect(n.filter((x) => x.parentId === 'costs').map((x) => x.order)).toEqual([1000, 2000]);
  });
  it('the title is the title of the activity row, else the plain name', () => {
    expect(budgetItemNodes(rows()).find((x) => x.id === 'costs::operatingActivity')!.title).toBe('Operating activity');
    const act = [{ rowGUID: 'operatingActivity', rowOwnerGUID: 'x', rowParentGUID: 'empty', orderInList: 1, rowJSON: { title: 'Operating (own)' } }];
    expect(budgetItemNodes(rows(), act).find((x) => x.id === 'costs::operatingActivity')!.title).toBe('Operating (own)');
  });
  it('a folder without items offers all three activities; a folder keeps the activity of an item even when the genus cannot have it', () => {
    expect(budgetItemActivitiesOfFolder([folder('empty1', 1)], 'empty1')).toEqual(['operatingActivity', 'investingActivity', 'financingActivity']);
    const odd = [folder('costs', 1), item('x', 'costs', 'timeGenus', 'financingActivity.timeGenus')];      // an invalid key is shown, not hidden
    expect(budgetItemActivitiesOfFolder(odd, 'costs')).toContain('financingActivity');
  });
});

describe('where an item is shown', () => {
  const ids = new Set(budgetItemNodes(rows()).map((x) => x.id));
  it('under its folder + its activity; the folder alone when the key is missing', () => {
    const r = rows();
    expect(budgetItemNodeOfRow(r[3] as any, ids)).toBe('costs::investingActivity');
    expect(budgetItemNodeOfRow(r[2] as any, ids)).toBe('costs::operatingActivity');
    expect(budgetItemNodeOfRow(item('nokey', 'costs', 'timeGenus') as any, ids)).toBe('costs');
  });
});

describe('a new item on an activity node', () => {
  const genus = [{ value: 'timeGenus' }, { value: 'materialGenus' }, { value: 'inboundPaymentGenus' }];
  it('gets the folder, the activity and a genus that can have it: the genus of the items already there, else the first', () => {
    expect(budgetItemNewRowOfNode(rows(), genus, 'costs::investingActivity')).toEqual({ rowParentGUID: 'costs', rowJSON: { managementGenusItem: 'materialGenus', budgetItemGenericKey: 'investingActivity.materialGenus', direction: 'outbound' } });
    expect(budgetItemNewRowOfNode([folder('p', 1)], genus, 'p::financingActivity')).toEqual({ rowParentGUID: 'p', rowJSON: { managementGenusItem: 'inboundPaymentGenus', budgetItemGenericKey: 'financingActivity.inboundPaymentGenus', direction: 'inbound' } });
  });
  it('null for a folder node or when no genus can have the activity', () => {
    expect(budgetItemNewRowOfNode(rows(), genus, 'costs')).toBeNull();
    expect(budgetItemNewRowOfNode(rows(), [{ value: 'timeGenus' }], 'costs::financingActivity')).toBeNull();
  });
});

describe('items dropped on an activity node', () => {
  it('the key (and the direction) and the folder change', () => {
    const move = budgetItemMoveToNode(rows()[2] as any, 'costs::investingActivity') as any;     // time -> investing
    expect(move).toEqual({ columns: { rowParentGUID: 'costs' }, rowJSON: { budgetItemGenericKey: 'investingActivity.timeGenus', direction: 'outbound' } });
  });
  it('a correction keeps its direction', () => {
    const move = budgetItemMoveToNode(item('c', 'costs', 'timeGenus', 'operatingActivity.timeGenus', { isCorrection: true, direction: 'inbound' }) as any, 'costs::investingActivity') as any;
    expect(move.rowJSON).toEqual({ budgetItemGenericKey: 'investingActivity.timeGenus' });
  });
  it('an activity the genus cannot have is refused with a message; a folder node is no activity node', () => {
    expect(budgetItemMoveToNode(rows()[2] as any, 'costs::financingActivity')).toEqual({ error: expect.stringMatching(/cannot be a financing item/) });
    expect(budgetItemMoveToNode(rows()[2] as any, 'costs')).toBeNull();
  });
});
