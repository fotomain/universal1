/** @jest-environment jsdom */
// "Facts input" is offered where a task GUID (the row menu of the task tree) is known; it opens the route of the fact document with the GUID. The
// right-click menu of the lines of the Finances table has the same item (PMProjectTaskFinancesCRUD: extraMenuItems → useOpenFactInput; its screen test is taskFinancesUi).
import { act } from 'react';
import { cleanupUI, fakeCrud, press, q, renderUI, seedStore } from '../ui/pmUiTestKit';

const mockPush = jest.fn();
jest.doMock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }) }));

const PMTaskRowMenu = require('../../../kit8/pm/view/task/PMTaskRowMenu').default;
const { useOpenFactInput } = require('../../../kit8/pm/fact/useOpenFactInput');
import React from 'react';
import { usePMStore } from '../../../kit8/pm/store/store_pm';
import { FACT_INPUT_ROUTE } from '../../../kit8/pm/fact/factInputModel';

afterEach(() => { cleanupUI(); jest.clearAllMocks(); act(() => usePMStore.getState().setRowMenu(null)); });

describe('the row menu of the task tree', () => {
  it('a task has "Facts input"; it closes the menu and opens the document of the task', () => {
    const { byName } = seedStore();
    const task = byName('Task 111');
    renderUI(<PMTaskRowMenu crud={fakeCrud()} />);
    act(() => usePMStore.getState().setRowMenu({ guid: task.rowGUID, x: 10, y: 10, source: 'tree' }));
    press('pm-row-menu-facts-input');
    expect(mockPush).toHaveBeenCalledWith({ pathname: FACT_INPUT_ROUTE, params: { taskGUID: task.rowGUID } });
    expect(usePMStore.getState().rowMenu).toBeNull();
  });
  it('a stage has no lines, so no facts', () => {
    const { byName } = seedStore();
    const stage = byName('Stage 1');
    renderUI(<PMTaskRowMenu crud={fakeCrud()} />);
    act(() => usePMStore.getState().setRowMenu({ guid: stage.rowGUID, x: 10, y: 10, source: 'tree' }));
    expect(q('pm-row-menu')).not.toBeNull();
    expect(q('pm-row-menu-facts-input')).toBeNull();
  });
});

describe('useOpenFactInput - from anywhere a task GUID or a task line GUID is known', () => {
  function Opener({ params }: { params: any }) {
    const open = useOpenFactInput();
    return React.createElement('button', { 'data-testid': 'opener', onClick: () => open(params) });
  }
  it('passes the task, the line, the genus, the project and the document to the route', () => {
    renderUI(<Opener params={{ taskGUID: 't1', projectGUID: 'p1', taskLineGUID: 'l1', genus: 'materialGenus', documentGUID: 'd1' }} />);
    press('opener');
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/pm/project/task/fact', params: { taskGUID: 't1', projectGUID: 'p1', taskLineGUID: 'l1', genus: 'materialGenus', documentGUID: 'd1' } });
  });
  it('without a task GUID nothing is opened', () => {
    renderUI(<Opener params={{ taskGUID: '' }} />);
    press('opener');
    expect(mockPush).not.toHaveBeenCalled();
  });
});
