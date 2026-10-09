/** @jest-environment jsdom */
// AddCustomProjectTaskColumn UI: tree header menu (Add custom column ▸ types, Rename / Delete custom
// column, Header color ▸, Default width), the column name window, the submenu of PMContextMenu,
// and the drag handle as the LAST button of the tree row panel.
import { cleanupUI, expectInOrder, fakeCrud, mustGet, press, q, qa, renderUI, textOf, typeInto } from './pmUiTestKit';
import React from 'react';
import { act } from 'react';
import PMTreeHeaderMenu from '../../../kit8/pm/view/tree/customColumns/PMTreeHeaderMenu';
import PMCustomColumnNameModalWindow from '../../../kit8/pm/view/tree/customColumns/PMCustomColumnNameModalWindow';
import PMTreeRowHoverPanel from '../../../kit8/pm/view/tree/panels/PMTreeRowHoverPanel';
import PMContextMenu from '../../../kit8/pm/inner/menu/PMContextMenu';
import { makePMPalette } from '../../../kit8/pm/view/theme';
import { usePMStore } from '../../../kit8/pm/store/store_pm';

const palette = makePMPalette({ primary: '#6366f1', background: '#fff', surface: '#f8fafc', text: '#0f172a', border: '#cbd5e1', error: '#dc2626' }, false);
const G = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const budget = { key: 'cc_budget01' as const, name: 'Budget', type: 'float' as const };

const setStore = (patch: Partial<ReturnType<typeof usePMStore.getState>>) => act(() => usePMStore.setState(patch));

afterEach(() => {
  cleanupUI();
  act(() => usePMStore.setState({ treeHeaderMenu: null, customColumnPrompt: null, customColumns: [], treeHeadersBackgroundColors: {}, treeColumnsWidths: {} }));
});

describe('PMContextMenu submenu', () => {
  it('an item with a submenu opens a second card; its items act', () => {
    const pick = jest.fn();
    const plain = jest.fn();
    renderUI(
      <PMContextMenu
        testID="m"
        x={10}
        y={10}
        onClose={jest.fn()}
        items={[
          { testID: 'm-more', label: 'More', icon: 'add', onPress: jest.fn(), submenu: [{ testID: 'm-more-a', label: 'A', icon: 'add', onPress: pick }] },
          { testID: 'm-plain', label: 'Plain', icon: 'edit', onPress: plain },
        ]}
      />
    );
    expect(q('m-submenu')).toBeNull();
    expect(q('m-more-more')).not.toBeNull(); // chevron ▸
    press('m-more');
    expect(q('m-submenu')).not.toBeNull();
    press('m-more-a');
    expect(pick).toHaveBeenCalled();
    press('m-more'); // toggles closed
    expect(q('m-submenu')).toBeNull();
    press('m-plain');
    expect(plain).toHaveBeenCalled();
  });
});

describe('PMTreeHeaderMenu', () => {
  it('on a built-in header: Add custom column ▸ 5 types · Header color ▸ (no sql_for_delete)', () => {
    const crud = fakeCrud();
    setStore({ treeHeaderMenu: { x: 5, y: 5, columnKey: 'name' } });
    renderUI(<PMTreeHeaderMenu crud={crud} />);
    expect(textOf('pm-tree-header-menu-caption')).toBe('Column: Task name');
    expect(q('pm-tree-header-menu-sql_for_delete')).toBeNull();
    expect(q('pm-tree-header-menu-width-reset')).toBeNull();
    press('pm-tree-header-menu-add');
    expect(qa('pm-tree-header-menu-add-').filter((id) => !/-(icon|more)$/.test(id))).toEqual([
      'pm-tree-header-menu-add-text',
      'pm-tree-header-menu-add-date',
      'pm-tree-header-menu-add-boolean',
      'pm-tree-header-menu-add-integer',
      'pm-tree-header-menu-add-float',
    ]);
    press('pm-tree-header-menu-add-float');
    expect(crud.closeTreeHeaderMenu).toHaveBeenCalled();
    expect(crud.promptAddCustomColumn).toHaveBeenCalledWith('float');
  });

  it('on a custom header: Rename / Delete custom column, header color, default width', () => {
    const crud = fakeCrud();
    setStore({
      treeHeaderMenu: { x: 5, y: 5, columnKey: budget.key },
      customColumns: [budget],
      treeHeadersBackgroundColors: { [budget.key]: '#dbeafe' },
      treeColumnsWidths: { [budget.key]: 150 },
    });
    renderUI(<PMTreeHeaderMenu crud={crud} />);
    expect(textOf('pm-tree-header-menu-caption')).toBe('Column: Budget · Float');
    expectInOrder(['pm-tree-header-menu-add', 'pm-tree-header-menu-rename', 'pm-tree-header-menu-sql_for_delete', 'pm-tree-header-menu-color', 'pm-tree-header-menu-width-reset']);
    press('pm-tree-header-menu-color');
    expect(q('pm-tree-header-menu-color-blue-checked')).not.toBeNull(); // current color
    press('pm-tree-header-menu-color-green');
    expect(crud.setTreeHeaderBackgroundColor).toHaveBeenCalledWith(budget.key, '#dcfce7');
    press('pm-tree-header-menu-sql_for_delete');
    expect(crud.deleteCustomColumn).toHaveBeenCalledWith(budget.key);
    press('pm-tree-header-menu-rename');
    expect(crud.promptRenameCustomColumn).toHaveBeenCalledWith(budget.key);
    press('pm-tree-header-menu-width-reset');
    expect(crud.resetTreeColumnWidth).toHaveBeenCalledWith(budget.key);
  });

  it('closed = nothing rendered', () => {
    renderUI(<PMTreeHeaderMenu crud={fakeCrud()} />);
    expect(q('pm-tree-header-menu')).toBeNull();
  });
});

describe('PMCustomColumnNameModalWindow', () => {
  it('asks for the name, shows validation errors, adds the column', () => {
    const crud = fakeCrud();
    crud.validateCustomColumnName.mockImplementation((n: string) => (n.trim() ? null : 'Enter a column name'));
    setStore({ customColumnPrompt: { type: 'integer' } });
    renderUI(<PMCustomColumnNameModalWindow crud={crud} />);
    expect(textOf('pm-custom-column-title')).toBe('New Integer column');
    press('pm-custom-column-save');
    expect(textOf('pm-custom-column-error')).toBe('Enter a column name');
    expect(crud.addCustomColumn).not.toHaveBeenCalled();
    typeInto('pm-custom-column-name', 'Story points');
    expect(q('pm-custom-column-error')).toBeNull();
    press('pm-custom-column-save');
    expect(crud.addCustomColumn).toHaveBeenCalledWith('integer', 'Story points');
    press('pm-custom-column-cancel');
    expect(crud.closeCustomColumnPrompt).toHaveBeenCalled();
  });

  it('rename mode starts with the current name', () => {
    const crud = fakeCrud();
    crud.validateCustomColumnName.mockReturnValue(null);
    setStore({ customColumnPrompt: { type: 'float', key: budget.key, name: 'Budget' } });
    renderUI(<PMCustomColumnNameModalWindow crud={crud} />);
    expect(textOf('pm-custom-column-title')).toBe('Rename the Float column');
    expect((mustGet('pm-custom-column-name') as HTMLInputElement).value).toBe('Budget');
    typeInto('pm-custom-column-name', 'Cost');
    press('pm-custom-column-save');
    expect(crud.validateCustomColumnName).toHaveBeenLastCalledWith('Cost', budget.key);
    expect(crud.renameCustomColumn).toHaveBeenCalledWith(budget.key, 'Cost');
  });
});

describe('PMTreeRowHoverPanel drag handle', () => {
  it('"drag & drop" is the LAST button - after sql_for_delete', () => {
    for (const isSummary of [false, true]) {
      renderUI(<PMTreeRowHoverPanel guid={G} isSummary={isSummary} crud={fakeCrud()} palette={palette} width={300} left={0} animatedStyle={{}} />);
      const buttons = qa('pm-tree-row-').filter((id) => id !== 'pm-tree-row-panel' && !id.endsWith('-icon'));
      expect(buttons[buttons.length - 1]).toBe(`pm-tree-row-drag-${G}`);
      expect(buttons[buttons.length - 2]).toBe(`pm-tree-row-delete-${G}`);
      expect(mustGet(`pm-tree-row-drag-${G}`).getAttribute('aria-label')).toMatch(/Drag to move the task/);
      cleanupUI();
    }
  });
});
