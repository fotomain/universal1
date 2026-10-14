/** @jest-environment jsdom */
// The columns of the fact table (ReusableTable) and the entity behind it: what is stored where, what each mode lets the user edit.
import { cellPatch, cellValue } from '../../../kit8/ui/components/table/reusable/tableRows';
import { buildFactColumns, factEditability } from '../../../kit8/pm/fact/factColumns';
import { taskFactUsageTimelineSystemMetaData } from '../../../kit8/pm/fact/factMetaData';
import { FACT_NEW_ROW_KEYS, FACT_USAGE_TIMELINE_ENTITY, FactHeaderView } from '../../../kit8/pm/fact/factInputModel';
import { emptyTaskLineCatalogs } from '../../../kit8/pm/view/task/finances/taskLineCatalogs';

const header = (over: Partial<FactHeaderView> = {}): FactHeaderView => ({ guid: 'h1', number: 'FI-1', status: 'draft', strong: false, user: 'u', createdAt: '2026-10-14T00:00:00Z', postedAt: null, unpostedAt: null, ...over });
const data = () => ({
  ...emptyTaskLineCatalogs(),
  resourceRoleType: [{ rowGUID: 'type-time', rowOwnerGUID: '', rowParentGUID: '', orderInList: 1, rowJSON: { managementGenus: 'timeGenus' } }, { rowGUID: 'type-mat', rowOwnerGUID: '', rowParentGUID: '', orderInList: 2, rowJSON: { managementGenus: 'materialGenus' } }],
  resourceRole: [{ rowGUID: 'r-time', rowOwnerGUID: 'type-time', rowParentGUID: '', orderInList: 1, rowJSON: { title: 'Analyst' } }, { rowGUID: 'r-mat', rowOwnerGUID: 'type-mat', rowParentGUID: '', orderInList: 2, rowJSON: { title: 'Pipe' } }],
  measureUnit: [{ rowGUID: 'unit_hour', rowOwnerGUID: '', rowParentGUID: '', orderInList: 1, rowJSON: { title: 'hour' } }],
});
const cols = (h: FactHeaderView, genus = 'timeGenus') => buildFactColumns({ data: data(), genus, header: h });
const by = (c: any[], k: string) => c.find((x) => x.key === k);

describe('what the user may edit', () => {
  it('free draft: the date, the quantity AND the description of the line', () => {
    expect(factEditability(header())).toEqual({ dateAndQty: true, description: true });
  });
  it('strong draft: only the date and the quantity', () => {
    expect(factEditability(header({ strong: true }))).toEqual({ dateAndQty: true, description: false });
  });
  it('posted: nothing', () => {
    expect(factEditability(header({ status: 'posted' }))).toEqual({ dateAndQty: false, description: false });
    expect(factEditability(header({ status: 'posted', strong: true }))).toEqual({ dateAndQty: false, description: false });
  });
});

describe('the columns', () => {
  it('# · Date · Role · Resource · Unit · Planned · Qty · Price · the three sums', () => {
    expect(cols(header()).map((c: any) => c.key)).toEqual(['n', 'day', 'role', 'resource', 'unit', 'qtyForBudget', 'qty', 'price', 'sumForBudget', 'sumForContract', 'sumForAccounting']);
  });
  it('the date is a calendar cell stored in the ROOT column rowPeriodDatetime and shown as a day', () => {
    const day = by(cols(header()), 'day');
    expect(day).toMatchObject({ type: 'date', picker: true, target: 'rowPeriodDatetime', editable: true });
    expect(cellValue({ rowGUID: 'a', rowPeriodDatetime: '2026-10-14T00:00:00+00:00' } as any, day)).toBe('2026-10-14');
    expect(cellValue({ rowGUID: 'a', rowPeriodDatetime: '2026-10-13T22:00:00+00:00' } as any, day)).toBe('2026-10-14');          // the +12 h rule
    expect(cellPatch(cols(header()), 'day', '2026-12-24')).toEqual({ rowJSON: {}, columns: { rowPeriodDatetime: '2026-12-24' } });
  });
  it('a row the table has just made (no date saved yet) shows the day it will get', () => {
    const day = by(cols(header()), 'day');
    expect(cellValue({ rowGUID: 'new', rowJSON: { [FACT_NEW_ROW_KEYS.day]: '2026-10-20' } } as any, day)).toBe('2026-10-20');
    expect(cellValue({ rowGUID: 'new', rowJSON: {} } as any, day)).toBeNull();
  });
  it('the quantity the user states is the root column qtyForContract; the planned quantity is frozen', () => {
    const c = cols(header());
    expect(by(c, 'qty')).toMatchObject({ type: 'number', target: 'qtyForContract', editable: true, total: false, min: 0 });
    expect(by(c, 'qtyForBudget')).toMatchObject({ target: 'qtyForBudget', editable: false });
    expect(cellPatch(c, 'qty', 7.5)).toEqual({ rowJSON: {}, columns: { qtyForContract: 7.5 } });
  });
  it('the sums are root columns, never editable, added up in the footer', () => {
    for (const k of ['sumForBudget', 'sumForContract', 'sumForAccounting']) expect(by(cols(header()), k)).toMatchObject({ target: k, editable: false, total: true });
  });
  it('the description is in rowJSON: free = editable, strong = frozen, posted = frozen', () => {
    for (const k of ['role', 'resource', 'unit', 'price']) {
      expect(by(cols(header()), k).editable).toBe(true);
      expect(by(cols(header({ strong: true })), k).editable).toBe(false);
      expect(by(cols(header({ status: 'posted' })), k).editable).toBe(false);
    }
    expect(by(cols(header()), 'role').field).toBe('resourceRoleItem');
    expect(by(cols(header()), 'resource').field).toBe('taskResourceItem');
    expect(by(cols(header()), 'unit').field).toBe('measureUnitTaskLine');
    expect(by(cols(header()), 'price').field).toBe('priceTaskLine');
  });
  it('a posted document edits no cell at all', () => {
    expect(cols(header({ status: 'posted' })).filter((c: any) => c.type !== 'rowNumber').every((c: any) => c.editable === false)).toBe(true);
  });
  it('the roles offered are the roles of the tab', () => {
    const role = by(cols(header(), 'materialGenus'), 'role');
    const d = data();
    expect(d.resourceRole.filter((r) => role.filterItem(r, {} as any)).map((r) => r.rowGUID)).toEqual(['r-mat']);
    const time = by(cols(header(), 'timeGenus'), 'role');
    expect(d.resourceRole.filter((r) => time.filterItem(r, {} as any)).map((r) => r.rowGUID)).toEqual(['r-time']);
  });
  it('the resource of a Time line is a person OR an equipment; of the others a product', () => {
    const time = by(cols(header(), 'timeGenus'), 'resource');
    expect(time.catalogEntityNameOf({ rowJSON: { taskResourceKind: 'equipment' } })).toBe(time.catalogEntityNames[1]);
    expect(time.catalogEntityNameOf({ rowJSON: {} })).toBe(time.catalogEntityNames[0]);
    const material = by(cols(header(), 'materialGenus'), 'resource');
    expect(material.catalogEntityNameOf).toBeUndefined();
    expect(material.title).toBe('Product');
  });
  it('the units come from the unit catalog', () => {
    expect(by(cols(header()), 'unit').options).toEqual([{ value: 'unit_hour', label: 'hour' }]);
  });
});

describe('the redux entity of the table (SystemMetaData)', () => {
  const meta = taskFactUsageTimelineSystemMetaData()[FACT_USAGE_TIMELINE_ENTITY];
  it('is the table task_fact_usage_timeline and lets the saga save the two root columns', () => {
    expect(meta.tableName).toBe('task_fact_usage_timeline');
    expect(meta.rootColumns).toEqual(['rowPeriodDatetime', 'qtyForContract']);
  });
  it('a created row is turned into a row of task_fact_usage_timeline', () => {
    const { newItem } = meta.prepareCreateApi({ action: { payload: { rowGUID: 'n', rowOwnerGUID: 't1', rowParentGUID: 'empty', orderInList: 1, rowJSON: { [FACT_NEW_ROW_KEYS.header]: 'h1', [FACT_NEW_ROW_KEYS.genus]: 'timeGenus', [FACT_NEW_ROW_KEYS.day]: '2026-10-14', measureUnitTaskLine: 'unit_hour' } } } });
    expect(newItem).toMatchObject({ rowGUID: 'n', rowHeaderGUID: 'h1', genusGUID: 'timeGenus', rowPeriodDatetime: '2026-10-14T00:00:00.000Z', qtyForContract: 0, rowJSON: { measureUnitTaskLine: 'unit_hour' } });
  });
});
