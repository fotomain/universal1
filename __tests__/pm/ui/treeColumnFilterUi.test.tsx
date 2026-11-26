/** @jest-environment jsdom */
// Filter & sort UI: SelectItemFromListApp, PMTreeColumnFilterPopup (sort, filterVariantForColumn,
// inputs, Apply / Clear, live preview, errors), the "Filter & sort" item of the tree header menu and
// the "clear all filters" button of the tree toolbar.
import { cleanupUI, fakeCrud, mustGet, press, q, qa, renderUI, textOf, typeInto } from './pmUiTestKit';
import React from 'react';
import { act } from 'react';
import SelectItemFromListApp from '../../../kit8/ui/components/common/SelectItemFromListApp';
import PMTreeColumnFilterPopup from '../../../kit8/pm/view/tree/filter/PMTreeColumnFilterPopup';
import PMTreeHeaderMenu from '../../../kit8/pm/view/tree/customColumns/PMTreeHeaderMenu';
import PMTreeToolbar from '../../../kit8/pm/view/tree/toolbars/PMTreeToolbar';
import { makePMPalette } from '../../../kit8/pm/view/theme';
import { usePMStore } from '../../../kit8/pm/store/store_pm';
import { buildTreeIndex } from '../../../kit8/pm/view/project/scheduling';
import { PMTaskRow } from '../../../kit8/pm/model/types';

const palette = makePMPalette({ primary: '#6366f1', background: '#fff', surface: '#f8fafc', text: '#0f172a', border: '#cbd5e1', error: '#dc2626' }, false);
const setStore = (patch: Partial<ReturnType<typeof usePMStore.getState>>) => act(() => usePMStore.setState(patch));

const task = (id: string, name: string, days: number, flag?: boolean): PMTaskRow =>
  ({
    rowGUID: id,
    treePath: `p.${id}`,
    projectGUID: 'p',
    rowOwnerGUID: 'u',
    rowDuration: null,
    rowProgress: 0,
    orderInList: days,
    rowJSON: { rowKind: 'task', taskDescription: name, durationDays: days, ...(flag === undefined ? {} : { customColumns: { cc_flag0001: flag } }) },
  }) as PMTaskRow;
const rows = [task('a', 'Design', 1, true), task('b', 'Develop', 2, false), task('c', 'Build', 3)];
const flagCol = { key: 'cc_flag0001' as const, name: 'Approved', type: 'boolean' as const };

beforeEach(() =>
  setStore({
    tasks: rows,
    tasksById: Object.fromEntries(rows.map((t) => [t.rowGUID, t])),
    tree: buildTreeIndex(rows),
    schedule: {},
    customColumns: [flagCol],
    treeColumnsFilters: {},
    treeColumnSort: null,
    treeColumnFilterPopup: null,
    treeHeaderMenu: null,
  })
);
afterEach(() => cleanupUI());

describe('SelectItemFromListApp', () => {
  const items = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta', description: 'second' },
    { value: 'c', label: 'Gamma', disabled: true },
  ];
  it('link trigger shows the lower-case label; the list marks the current item; picking calls onSelect once', () => {
    const onSelect = jest.fn();
    const onOpen = jest.fn();
    renderUI(<SelectItemFromListApp testID="s" trigger="link" items={items} value="a" onSelect={onSelect} onOpenChange={onOpen} />);
    expect(textOf('s-trigger')).toContain('alpha');
    expect(q('s-list')).toBeNull();
    press('s-trigger');
    expect(onOpen).toHaveBeenLastCalledWith(true);
    expect(q('s-list')).not.toBeNull();
    expect(q('s-item-a-checked')).not.toBeNull();
    expect(q('s-item-b-checked')).toBeNull();
    expect(textOf('s-item-b')).toContain('second');
    press('s-item-a'); // the current one: closes, no change
    expect(onSelect).not.toHaveBeenCalled();
    expect(q('s-list')).toBeNull();
    press('s-trigger');
    press('s-item-b');
    expect(onSelect).toHaveBeenCalledWith('b');
    expect(onOpen).toHaveBeenLastCalledWith(false);
  });

  it('searchable lists filter by label / description; backdrop closes', () => {
    renderUI(<SelectItemFromListApp testID="s" items={items} value={null} placeholder="Pick" searchable onSelect={jest.fn()} />);
    expect(textOf('s-trigger')).toContain('Pick');
    press('s-trigger');
    typeInto('s-search', 'sec');
    expect(qa('s-item-').filter((id) => /^s-item-[a-z]$/.test(id))).toEqual(['s-item-b']);
    press('s-backdrop');
    expect(q('s-list')).toBeNull();
  });
});

describe('PMTreeColumnFilterPopup', () => {
  it('text column: sort labels, default "begins with", Apply saves the filter, preview counts rows', () => {
    const crud = fakeCrud();
    setStore({ treeColumnFilterPopup: { key: 'name', x: 10, y: 10 } });
    renderUI(<PMTreeColumnFilterPopup crud={crud} />);
    expect(textOf('pm-tree-filter-title')).toBe('Task name');
    expect(textOf('pm-tree-filter-sort-asc')).toContain('Sort A to Z');
    expect(textOf('pm-tree-filter-sort-desc')).toContain('Sort Z to A');
    expect(textOf('pm-tree-filter-variant-trigger')).toContain('begins with');
    typeInto('pm-tree-filter-value', 'de');
    expect(textOf('pm-tree-filter-preview')).toBe('2 matching rows');
    press('pm-tree-filter-apply');
    expect(crud.setTreeColumnFilter).toHaveBeenCalledWith('name', { filterVariantForColumn: 'beginsWith', value: 'de' });
    expect(crud.closeTreeColumnFilter).toHaveBeenCalled();
  });

  it('variant list = filterVariantForColumn; Between shows two inputs; invalid input shows the error, no save', () => {
    const crud = fakeCrud();
    setStore({ treeColumnFilterPopup: { key: 'days', x: 10, y: 10 } });
    renderUI(<PMTreeColumnFilterPopup crud={crud} />);
    expect(textOf('pm-tree-filter-sort-asc')).toContain('Sort smallest to largest');
    expect(textOf('pm-tree-filter-variant-trigger')).toContain('is equal to');
    press('pm-tree-filter-variant-trigger');
    expect(qa('pm-tree-filter-variant-item-').filter((id) => !/-(icon|checked)$/.test(id))).toEqual([
      'pm-tree-filter-variant-item-isExactly',
      'pm-tree-filter-variant-item-isNot',
      'pm-tree-filter-variant-item-isOneOf',
      'pm-tree-filter-variant-item-after',
      'pm-tree-filter-variant-item-before',
      'pm-tree-filter-variant-item-lessThanOrEqual',
      'pm-tree-filter-variant-item-greaterThanOrEqual',
      'pm-tree-filter-variant-item-between',
      'pm-tree-filter-variant-item-matches',
    ]);
    press('pm-tree-filter-variant-item-between');
    expect(q('pm-tree-filter-value2')).not.toBeNull();
    typeInto('pm-tree-filter-value', '2');
    typeInto('pm-tree-filter-value2', 'x');
    press('pm-tree-filter-apply');
    expect(textOf('pm-tree-filter-error')).toContain('B:');
    expect(crud.setTreeColumnFilter).not.toHaveBeenCalled();
    typeInto('pm-tree-filter-value2', '3');
    expect(q('pm-tree-filter-error')).toBeNull();
    expect(textOf('pm-tree-filter-preview')).toBe('2 matching rows');
    press('pm-tree-filter-apply');
    expect(crud.setTreeColumnFilter).toHaveBeenCalledWith('days', { filterVariantForColumn: 'between', value: '2', value2: '3' });
  });

  it('matches shows the D365 syntax help; is one of shows the comma hint', () => {
    setStore({ treeColumnFilterPopup: { key: 'name', x: 0, y: 0 } });
    renderUI(<PMTreeColumnFilterPopup crud={fakeCrud()} />);
    press('pm-tree-filter-variant-trigger');
    typeInto('pm-tree-filter-variant-search', 'match'); // 12 variants -> searchable
    press('pm-tree-filter-variant-item-matches');
    expect(textOf('pm-tree-filter-matches-help')).toContain('!value');
    typeInto('pm-tree-filter-value', 'D*, !Develop');
    expect(textOf('pm-tree-filter-preview')).toBe('1 matching row');
  });

  it('boolean column: Yes / No chips + empty variants; sort press toggles and closes', () => {
    const crud = fakeCrud();
    setStore({ treeColumnFilterPopup: { key: flagCol.key, x: 0, y: 0 }, treeColumnSort: { key: flagCol.key, direction: 'asc' } });
    renderUI(<PMTreeColumnFilterPopup crud={crud} />);
    expect(q('pm-tree-filter-value')).toBeNull();
    press('pm-tree-filter-bool-yes');
    expect(textOf('pm-tree-filter-preview')).toBe('1 matching row');
    press('pm-tree-filter-apply');
    expect(crud.setTreeColumnFilter).toHaveBeenCalledWith(flagCol.key, { filterVariantForColumn: 'isExactly', value: 'yes' });
    expect(q('pm-tree-filter-sort-asc-checked')).not.toBeNull();
    press('pm-tree-filter-sort-asc'); // active one again = tree order
    expect(crud.setTreeColumnSort).toHaveBeenCalledWith(null);
    press('pm-tree-filter-sort-desc');
    expect(crud.setTreeColumnSort).toHaveBeenLastCalledWith({ key: flagCol.key, direction: 'desc' });
    press('pm-tree-filter-variant-trigger');
    expect(q('pm-tree-filter-variant-item-isEmpty')).not.toBeNull();
  });

  it('date column: eight digits turn into YYYY-MM-DD while typing (not in a list); the clear icons of the inputs are skipped by Tab', () => {
    const crud = fakeCrud();
    setStore({ treeColumnFilterPopup: { key: 'start', x: 10, y: 10 } });
    renderUI(<PMTreeColumnFilterPopup crud={crud} />);
    const input = () => mustGet('pm-tree-filter-value') as HTMLInputElement;
    expect(textOf('pm-tree-filter-date-hint')).toContain('Press t');   // the instruction under the date fields
    expect(input().getAttribute('data-icons-not-tabbable')).toBe('true');
    typeInto('pm-tree-filter-value', 't');                              // t = today (the local day)
    const d = new Date();
    expect(input().value).toBe(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    typeInto('pm-tree-filter-value', '(day(-1');
    expect(input().value).toBe('(day(-1');                              // half typed: untouched
    typeInto('pm-tree-filter-value', '(day(-1))');                      // closed: yesterday as a real date
    const y = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
    expect(input().value).toBe(`${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`);
    typeInto('pm-tree-filter-value', '2026113');
    expect(input().value).toBe('2026113');                             // half typed: untouched
    typeInto('pm-tree-filter-value', '20261130');
    expect(input().value).toBe('2026-11-30');
    typeInto('pm-tree-filter-value', '30112026');                       // DDMMYYYY
    expect(input().value).toBe('2026-11-30');
    typeInto('pm-tree-filter-value', '20261340');                       // not a date: untouched, Apply says so
    expect(input().value).toBe('20261340');
    typeInto('pm-tree-filter-value', '20261130');
    press('pm-tree-filter-variant-trigger');
    press('pm-tree-filter-variant-item-between');
    expect((mustGet('pm-tree-filter-value2') as HTMLInputElement).getAttribute('data-icons-not-tabbable')).toBe('true');
    typeInto('pm-tree-filter-value2', '31122026');
    expect((mustGet('pm-tree-filter-value2') as HTMLInputElement).value).toBe('2026-12-31');
    press('pm-tree-filter-apply');
    expect(crud.setTreeColumnFilter).toHaveBeenCalledWith('start', { filterVariantForColumn: 'between', value: '2026-11-30', value2: '2026-12-31' });
    // a list of days is left as typed
    press('pm-tree-filter-variant-trigger');
    press('pm-tree-filter-variant-item-isOneOf');
    typeInto('pm-tree-filter-value', '20261130');
    expect(input().value).toBe('20261130');
  });

  it('date between: +5 / -5 in one field is days from the other; the real dates are shown; both relative is refused', () => {
    const crud = fakeCrud();
    setStore({ treeColumnFilterPopup: { key: 'start', x: 10, y: 10 } });
    renderUI(<PMTreeColumnFilterPopup crud={crud} />);
    expect(q('pm-tree-filter-between-hint')).toBeNull();               // only for "between"
    press('pm-tree-filter-variant-trigger');
    press('pm-tree-filter-variant-item-between');
    expect(textOf('pm-tree-filter-between-hint')).toContain('+5 or -5');
    expect(q('pm-tree-filter-between-resolved')).toBeNull();
    typeInto('pm-tree-filter-value', '20261130');
    typeInto('pm-tree-filter-value2', '+5');                            // not turned into a date while typing
    expect((mustGet('pm-tree-filter-value2') as HTMLInputElement).value).toBe('+5');
    expect(textOf('pm-tree-filter-between-resolved')).toBe('2026-11-30 → 2026-12-05');
    typeInto('pm-tree-filter-value', '-5');                             // both relative
    press('pm-tree-filter-apply');
    expect(textOf('pm-tree-filter-error')).toContain('Only one');
    expect(crud.setTreeColumnFilter).not.toHaveBeenCalled();
    typeInto('pm-tree-filter-value', '2026-11-30');
    typeInto('pm-tree-filter-value2', '-5');
    expect(textOf('pm-tree-filter-between-resolved')).toBe('2026-11-25 → 2026-11-30');
    press('pm-tree-filter-apply');
    expect(crud.setTreeColumnFilter).toHaveBeenCalledWith('start', { filterVariantForColumn: 'between', value: '2026-11-30', value2: '-5' });
  });

  it('opens with the saved filter; Clear removes it (disabled without a filter)', () => {
    const crud = fakeCrud();
    setStore({ treeColumnFilterPopup: { key: 'name', x: 0, y: 0 }, treeColumnsFilters: { name: { filterVariantForColumn: 'contains', value: 'uil' } } });
    renderUI(<PMTreeColumnFilterPopup crud={crud} />);
    expect(textOf('pm-tree-filter-variant-trigger')).toContain('contains');
    expect((mustGet('pm-tree-filter-value') as HTMLInputElement).value).toBe('uil');
    expect(q('pm-tree-filter-active-icon')).not.toBeNull();
    press('pm-tree-filter-clear');
    expect(crud.setTreeColumnFilter).toHaveBeenCalledWith('name', null);
  });
});

describe('header menu + toolbar', () => {
  it('header menu: "Filter & sort" first; opens the popup at the menu point', () => {
    const crud = fakeCrud();
    setStore({ treeHeaderMenu: { x: 40, y: 50, columnKey: 'start' } });
    renderUI(<PMTreeHeaderMenu crud={crud} />);
    expect(qa('pm-tree-header-menu-').filter((id) => /^pm-tree-header-menu-(filter|add|color)$/.test(id))).toEqual([
      'pm-tree-header-menu-filter',
      'pm-tree-header-menu-add',
      'pm-tree-header-menu-color',
    ]);
    press('pm-tree-header-menu-filter');
    expect(crud.closeTreeHeaderMenu).toHaveBeenCalled();
    expect(crud.openTreeColumnFilter).toHaveBeenCalledWith('start', 40, 50);
  });

  it('toolbar: "clear all filters" only while filtered / sorted', () => {
    const crud = fakeCrud();
    renderUI(<PMTreeToolbar crud={crud} palette={palette} />);
    expect(q('pm-tree-clear-filters')).toBeNull();
    setStore({ treeColumnSort: { key: 'name', direction: 'asc' } });
    press('pm-tree-clear-filters');
    expect(crud.clearTreeColumnsFilters).toHaveBeenCalled();
  });
});
