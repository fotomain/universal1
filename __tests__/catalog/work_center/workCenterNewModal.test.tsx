/** @jest-environment jsdom */
// WorkCenterNewModal: a kind, a free catalog item of that kind, a business unit; the rules of the SQL trigger are shown before the server says them.
import { act } from 'react';
import { cleanupUI, press, q, renderUI, textOf, typeInto } from '../../pm/ui/pmUiTestKit';

// the picker as a list of buttons: <testID>-opt-<value>
jest.mock('../../../kit8/ui/components/common/SelectItemFromListApp', () => {
  const R = require('react');
  const Select = ({ testID, items, onSelect, disabled, placeholder, value }: any) => R.createElement('div', { 'data-testid': testID, 'data-disabled': String(!!disabled), 'data-value': value ?? '', 'data-placeholder': placeholder ?? '' },
    items.map((i: any) => R.createElement('button', { key: i.value, 'data-testid': `${testID}-opt-${i.value}`, onClick: () => !disabled && onSelect(i.value) }, i.label)));
  return { __esModule: true, default: Select, SelectItemFromListApp: Select };
});

import WorkCenterNewModal from '../../../kit8/catalog/work_center/WorkCenterNewModal';
import { emptyWorkCenterData } from '../../../kit8/catalog/work_center/workCenterModel';

const row = (rowGUID: string, rowJSON: any = {}, rowParentGUID = 'empty'): any => ({ rowGUID, rowOwnerGUID: 'x', rowParentGUID, orderInList: 0, rowJSON });
const data = () => ({
  ...emptyWorkCenterData(),
  person: [row('p-anna', { personFirstName: 'Anna', personLastName: 'K' }), row('p-boris', { personFirstName: 'Boris', personLastName: 'M' })],
  equipment: [row('e-crane', { equipmentTitle: 'Tower crane' })],
  partner: [row('pa-sup', { partnerTitle: 'Acme', partnerIsSupplier: true }), row('pa-cus', { partnerTitle: 'Customer only', partnerIsSupplier: false })],
  businessUnit: [row('bu-ent', { title: 'Enterprise' }), row('bu-it', { title: 'IT' }, 'bu-ent')],
  workCenter: [row('w-anna', { workCenterKind: 'person', workCenterBase: 'p-anna' }, 'bu-it')],
});
const onCreate = jest.fn();
const onCancel = jest.fn();
const mount = (over: any = {}) => renderUI(<WorkCenterNewModal visible data={data()} onCreate={onCreate} onCancel={onCancel} {...over} />);
const dataOf = (id: string, attr: string) => q(id)!.getAttribute(attr);
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

it('is nothing while it is not visible', () => {
  mount({ visible: false });
  expect(q('work-center-new')).toBeNull();
});

it('the base list is empty and off until a kind is chosen; then it lists the FREE catalog items of that kind', () => {
  mount();
  expect(dataOf('work-center-new-base', 'data-disabled')).toBe('true');
  expect(dataOf('work-center-new-base', 'data-placeholder')).toBe('Choose the kind first');
  press('work-center-new-kind-person');
  expect(dataOf('work-center-new-base', 'data-disabled')).toBe('false');
  expect(q('work-center-new-base-opt-p-boris')).not.toBeNull();
  expect(q('work-center-new-base-opt-p-anna')).toBeNull();          // Anna already has a work center: one catalog item, one work center
  press('work-center-new-kind-partner');
  expect(q('work-center-new-base-opt-pa-sup')).not.toBeNull();
  expect(q('work-center-new-base-opt-pa-cus')).toBeNull();          // not a supplier
  expect(textOf('work-center-new')).toContain('Only a partner that is a supplier can have a work center.');
});

it('changing the kind clears the chosen base', () => {
  mount({ initialUnit: 'bu-it' });
  press('work-center-new-kind-person');
  press('work-center-new-base-opt-p-boris');
  expect(dataOf('work-center-new-base', 'data-value')).toBe('p-boris');
  press('work-center-new-kind-equipment');
  expect(dataOf('work-center-new-base', 'data-value')).toBe('');
});

it('Create with nothing chosen shows what is missing and creates nothing', () => {
  mount();
  press('work-center-new-create');
  expect(onCreate).not.toHaveBeenCalled();
  expect(textOf('work-center-new-error-kind')).toMatch(/Person, Equipment or Partner/);
  expect(q('work-center-new-error-unit')).not.toBeNull();
});

it('a kind and a base but no business unit: the unit is asked for', () => {
  mount();
  press('work-center-new-kind-equipment');
  press('work-center-new-base-opt-e-crane');
  press('work-center-new-create');
  expect(onCreate).not.toHaveBeenCalled();
  expect(q('work-center-new-error-kind')).toBeNull();
  expect(q('work-center-new-error-base')).toBeNull();
  expect(textOf('work-center-new-error-unit')).toMatch(/business unit/);
});

it('a full form creates: the folder = the business unit, the rowJSON with the kind, the base, the unit and the typed title', () => {
  mount({ initialUnit: 'bu-it' });
  press('work-center-new-kind-person');
  press('work-center-new-base-opt-p-boris');
  typeInto('work-center-new-title', 'Boris line');
  press('work-center-new-create');
  expect(onCreate).toHaveBeenCalledTimes(1);
  expect(onCreate.mock.calls[0][0]).toBe('bu-it');
  expect(onCreate.mock.calls[0][1]).toMatchObject({ workCenterKind: 'person', workCenterBase: 'p-boris', businessUnit: 'bu-it', workCenterTitle: 'Boris line', workCenterVariant: null, isActive: true });
});

it('a calendar can be chosen when calendars are offered; none = the Standard work week', () => {
  mount({ initialUnit: 'bu-it', calendarOptions: [{ value: 'cal-6h', label: 'Work center 6 h' }] });
  expect(q('work-center-new-calendar')).not.toBeNull();
  press('work-center-new-kind-equipment');
  press('work-center-new-base-opt-e-crane');
  press('work-center-new-calendar-opt-cal-6h');
  press('work-center-new-create');
  expect(onCreate.mock.calls[0][1].resourceCalendar).toBe('cal-6h');
  cleanupUI();
  mount({ initialUnit: 'bu-it' });
  expect(q('work-center-new-calendar')).toBeNull();
});

it('Cancel and the backdrop close it without creating', () => {
  mount();
  press('work-center-new-cancel');
  expect(onCancel).toHaveBeenCalledTimes(1);
  act(() => press('work-center-new-backdrop'));
  expect(onCancel).toHaveBeenCalledTimes(2);
  expect(onCreate).not.toHaveBeenCalled();
});

it('no free catalog item of the kind: it says so', () => {
  mount({ data: { ...data(), person: [data().person[0]] } });
  press('work-center-new-kind-person');
  expect(textOf('work-center-new-no-base')).toContain('No free person');
});
