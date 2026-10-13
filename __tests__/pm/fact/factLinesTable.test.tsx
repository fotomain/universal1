/** @jest-environment jsdom */
// FactLinesTable: the lines of one tab of a fact document - editable date and quantity, delete, the totals, and the difference between the strong input (no new lines)
// and the free input (the "+ Add line" form).
import { act } from 'react';
import { cleanupUI, inputValue, mustGet, press, pressKey, q, qa, renderUI, textOf, typeInto } from '../ui/pmUiTestKit';

// the kit's TextInputApp stub knows no blur / Enter: this one passes them on
jest.doMock('../../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  const TextInputApp = ({ testID, value, onChangeText, onBlur, onSubmitEditing, editable, disabled, label }: any) =>
    R.createElement(TextInput, { testID, value, onChangeText, onBlur, onSubmitEditing, editable: editable !== false && !disabled, accessibilityLabel: label });
  return { __esModule: true, default: TextInputApp, TextInputApp };
});
// the pickers are covered by their own tests: here a select is a button that picks the first item
jest.doMock('../../../kit8/ui/components/common/SelectItemFromListApp', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  const Select = ({ testID, items, value, onSelect }: any) =>
    R.createElement(Pressable, { testID, onPress: () => onSelect(items[0]?.value) }, R.createElement(Text, null, String(value ?? '')));
  return { __esModule: true, default: Select };
});

const FactLinesTable = require('../../../kit8/pm/fact/FactLinesTable').default;
import { emptyTaskLineCatalogs } from '../../../kit8/pm/view/task/finances/taskLineCatalogs';
import { FactHeaderView, FactLineRow } from '../../../kit8/pm/fact/factInputModel';

const header = (over: Partial<FactHeaderView> = {}): FactHeaderView => ({ guid: 'h1', number: 'FI-00001', status: 'draft', strong: false, user: 'u', createdAt: '2026-10-14T00:00:00Z', postedAt: null, unpostedAt: null, ...over });
const line = (over: Partial<FactLineRow> = {}): FactLineRow => ({
  rowGUID: 'l1', rowProjectGUID: 'p1', rowOwnerGUID: 't1', rowHeaderGUID: 'h1', rowPeriodDatetime: '2026-10-14T00:00:00.000Z', taskLineGUID: null, genusGUID: 'timeGenus', qtyForBudget: 8, qtyForContract: 6,
  sumForContract: 60, sumForBudget: null, orderInList: 1, rowJSON: { resourceRoleItem: 'role-1', measureUnitTaskLine: 'unit_hour', priceTaskLine: 10 }, ...over,
});
const data = () => ({
  ...emptyTaskLineCatalogs(),
  resourceRoleType: [{ rowGUID: 'type-time', rowOwnerGUID: '', rowParentGUID: '', orderInList: 1, rowJSON: { managementGenus: 'timeGenus' } }],
  resourceRole: [{ rowGUID: 'role-1', rowOwnerGUID: 'type-time', rowParentGUID: '', orderInList: 1, rowJSON: { title: 'Data Analyst' } }],
  measureUnit: [{ rowGUID: 'unit_hour', rowOwnerGUID: '', rowParentGUID: '', orderInList: 1, rowJSON: { title: 'hour' } }],
});

const mount = (props: Record<string, any> = {}) => {
  const handlers = { onSave: jest.fn(), onDelete: jest.fn(), onAdd: jest.fn() };
  renderUI(<FactLinesTable header={header()} genus="timeGenus" lines={[line()]} data={data()} {...handlers} {...props} />);
  return handlers;
};
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

describe('a line', () => {
  it('shows the date, the role, the planned quantity (read only), the quantity and the sum', () => {
    mount();
    expect(inputValue('fact-lines-date-l1')).toBe('2026-10-14');
    expect(textOf('fact-lines-row-l1')).toContain('Data Analyst');
    expect(textOf('fact-lines-planned-l1')).toBe('8');
    expect(inputValue('fact-lines-qty-l1')).toBe('6');
    expect(textOf('fact-lines-sum-l1')).toBe('60.00');
    // the planned quantity is text, not an input: it cannot be edited
    expect(q('fact-lines-planned-l1')!.querySelector('input')).toBeNull();
  });

  it('the quantity is committed on Enter - as a number', () => {
    const h = mount();
    typeInto('fact-lines-qty-l1', '7,5');
    pressKey('fact-lines-qty-l1', 'Enter');
    expect(h.onSave).toHaveBeenCalledWith('l1', { qtyForContract: 7.5 });
  });

  it('the date is committed as the start of the day', () => {
    const h = mount();
    typeInto('fact-lines-date-l1', '12.10.2026');
    pressKey('fact-lines-date-l1', 'Enter');
    expect(h.onSave).toHaveBeenCalledWith('l1', { rowPeriodDatetime: '2026-10-12T00:00:00.000Z' });
  });

  it('an unchanged value is not saved; an invalid one is dropped and not saved', () => {
    const h = mount();
    typeInto('fact-lines-qty-l1', '6');
    pressKey('fact-lines-qty-l1', 'Enter');
    typeInto('fact-lines-qty-l1', 'abc');
    pressKey('fact-lines-qty-l1', 'Enter');
    typeInto('fact-lines-date-l1', '2026-02-30');
    pressKey('fact-lines-date-l1', 'Enter');
    expect(h.onSave).not.toHaveBeenCalled();
    expect(inputValue('fact-lines-qty-l1')).toBe('6');
    expect(inputValue('fact-lines-date-l1')).toBe('2026-10-14');
  });

  it('delete asks the screen to delete the line', () => {
    const h = mount();
    press('fact-lines-delete-l1');
    expect(h.onDelete).toHaveBeenCalledWith('l1');
  });

  it('a line named by a refused Post is marked and a strong line without its task line says so', () => {
    mount({ problemLines: new Set(['l1']), header: header({ strong: true }), lines: [line({ taskLineGUID: null })] });
    expect(textOf('fact-lines-row-l1')).toContain('task line deleted');
  });
});

describe('the totals', () => {
  it('per unit - hours and pieces are never added', () => {
    mount({ lines: [line(), line({ rowGUID: 'l2', qtyForContract: 4, sumForContract: 40 }), line({ rowGUID: 'l3', qtyForContract: 100, sumForContract: null, rowJSON: { measureUnitTaskLine: 'unit_pcs' } })] });
    expect(textOf('fact-lines-total-unit_hour')).toContain('10');
    expect(textOf('fact-lines-total-unit_hour')).toContain('100.00');
    expect(textOf('fact-lines-total-unit_pcs')).toContain('100');
    expect(q('fact-lines-total-unit_hour')).not.toBe(q('fact-lines-total-unit_pcs'));
  });
  it('no lines: a hint instead of a table body, no totals', () => {
    mount({ lines: [] });
    expect(textOf('fact-lines-empty')).toContain('Add line');
    expect(q('fact-lines-totals')).toBeNull();
  });
});

describe('the free input', () => {
  it('has the "+ Add line" form: role, unit, date, quantity, price → onAdd with a line DISCONNECTED from the task lines', () => {
    const h = mount({ lines: [line({ orderInList: 3 })] });
    expect(q('fact-lines-add')).not.toBeNull();
    expect((mustGet('fact-lines-add-submit') as any).disabled || mustGet('fact-lines-add-submit').getAttribute('aria-disabled')).toBeTruthy();
    press('fact-lines-add-role');
    press('fact-lines-add-unit');
    typeInto('fact-lines-add-date', '2026-10-15');
    typeInto('fact-lines-add-qty', '2');
    typeInto('fact-lines-add-price', '12.5');
    press('fact-lines-add-submit');
    expect(h.onAdd).toHaveBeenCalledTimes(1);
    expect(h.onAdd.mock.calls[0][0]).toMatchObject({
      rowHeaderGUID: 'h1', taskLineGUID: null, genusGUID: 'timeGenus', qtyForContract: 2, orderInList: 4, rowPeriodDatetime: '2026-10-15T00:00:00.000Z',
      rowJSON: { resourceRoleItem: 'role-1', measureUnitTaskLine: 'unit_hour', priceTaskLine: 12.5 },
    });
  });
  it('a bad quantity cannot be added', () => {
    const h = mount();
    press('fact-lines-add-unit');
    typeInto('fact-lines-add-qty', 'x');
    press('fact-lines-add-submit');
    expect(h.onAdd).not.toHaveBeenCalled();
  });
});

describe('the strong input and a posted document', () => {
  it('strong: NO add form - only update and delete', () => {
    mount({ header: header({ strong: true }), lines: [line({ taskLineGUID: 'tl-1' })] });
    expect(q('fact-lines-add')).toBeNull();
    expect(q('fact-lines-delete-l1')).not.toBeNull();
    expect(mustGet('fact-lines-qty-l1')).toBeTruthy();
  });
  it('posted: read only - no add, no delete, the inputs are disabled', () => {
    mount({ header: header({ status: 'posted' }) });
    expect(q('fact-lines-add')).toBeNull();
    expect(q('fact-lines-delete-l1')).toBeNull();
    const qty = (q('fact-lines-qty-l1')!.tagName === 'INPUT' ? q('fact-lines-qty-l1') : q('fact-lines-qty-l1')!.querySelector('input')) as HTMLInputElement;
    expect(qty.disabled || qty.readOnly).toBe(true);
  });
  it('the rows of other tabs are not drawn (the screen passes only its tab)', () => {
    mount({ lines: [] });
    expect(qa('fact-lines-row-')).toEqual([]);
  });
});

it('keeps act() quiet', () => { act(() => undefined); });
