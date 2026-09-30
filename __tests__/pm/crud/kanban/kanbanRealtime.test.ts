// Pure matching rules of the Kanban realtime channel (kit8/pm/crud/kanban/kanbanRealtime.ts).
import { isKanbanDeleteRelevant, kanbanInvalidationFor, mergeKanbanInvalidation, PM_KANBAN_REALTIME_NOTHING } from '../../../../kit8/pm/crud/kanban/kanbanRealtime';

const cache: any = {
  catalog: [{ rowGUID: 'c1' }],
  projectKanban: { stages: [{ rowGUID: 's1' }], states: [{ rowGUID: 'k1' }], missing: false },
};

it('maps tables to queries and merges', () => {
  expect(kanbanInvalidationFor('kanbanCatalog')).toEqual({ catalog: true, projectKanban: false });
  expect(kanbanInvalidationFor('projectKanbanStage')).toEqual({ catalog: false, projectKanban: true });
  expect(kanbanInvalidationFor('projectTaskKanbanState')).toEqual({ catalog: false, projectKanban: true });
  expect(mergeKanbanInvalidation(PM_KANBAN_REALTIME_NOTHING, kanbanInvalidationFor('kanbanCatalog'))).toEqual({ catalog: true, projectKanban: false });
});

it('DELETE events matter only for cached rows', () => {
  expect(isKanbanDeleteRelevant('kanbanCatalog', { rowGUID: 'c1' }, cache)).toBe(true);
  expect(isKanbanDeleteRelevant('projectKanbanStage', { rowGUID: 's1' }, cache)).toBe(true);
  expect(isKanbanDeleteRelevant('projectTaskKanbanState', { rowGUID: 'k1' }, cache)).toBe(true);
  expect(isKanbanDeleteRelevant('projectTaskKanbanState', { rowGUID: 'other' }, cache)).toBe(false);
  expect(isKanbanDeleteRelevant('projectKanbanStage', null, cache)).toBe(false);
  expect(isKanbanDeleteRelevant('kanbanCatalog', { rowGUID: 'c1' }, {})).toBe(false);
});
