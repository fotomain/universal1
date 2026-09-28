import { usePMStore } from '../../kit8/pm/store';
import { PMProjectRow } from '../../kit8/pm/types';

const project = (guid: string, json: Partial<PMProjectRow['rowJSON']> = {}): PMProjectRow => ({
  rowGUID: guid,
  treePath: guid,
  rowOwnerGUID: 'u',
  rowDuration: null,
  rowProgress: 0,
  orderInList: 1024,
  rowJSON: { rowKind: 'project', name: guid, durationDays: 0, ...json },
});

describe('Gantt view settings from project_table.rowJSON', () => {
  it('mirrors showCriticalPath / ganttArrowsForm / showTaskProgressOnGantt of the selected project', () => {
    const s = usePMStore.getState();
    s.setProjects([project('a'), project('b', { showCriticalPath: false, ganttArrowsForm: 'squareForm', showTaskProgressOnGantt: true })]);
    usePMStore.getState().selectProject('b');
    let st = usePMStore.getState();
    expect([st.showCriticalPath, st.linkLineForm, st.showTaskProgressOnGantt]).toEqual([false, 'squareForm', true]);
    usePMStore.getState().selectProject('a'); // defaults
    st = usePMStore.getState();
    expect([st.showCriticalPath, st.linkLineForm, st.showTaskProgressOnGantt]).toEqual([true, 'smoothForm', false]);
    // an optimistic project update (toggle) reaches the store through setProjects
    usePMStore.getState().setProjects([project('a', { showTaskProgressOnGantt: true }), project('b')]);
    expect(usePMStore.getState().showTaskProgressOnGantt).toBe(true);
  });
});
