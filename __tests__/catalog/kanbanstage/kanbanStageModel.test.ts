// kit8/catalog/kanbanstage/kanbanStageModel: normalize, validate, card mapping.
import { kanbanStageCodeOf, kanbanStageToCard, normalizeKanbanStage, validateKanbanStage } from '../../../kit8/catalog/kanbanstage/kanbanStageModel';

const rows = [{ rowGUID: 'a', rowJSON: { stageCode: 'plan', stageName: 'Plan' } }] as any[];

it('code defaults to the name, lower case with _', () => {
  expect(kanbanStageCodeOf('  Code Review! ')).toBe('code_review');
  expect(normalizeKanbanStage({ stageName: ' QA check ', stageColor: '#ef4444' })).toEqual({ stageName: 'QA check', stageCode: 'qa_check', stageColor: '#EF4444', isActive: true });
  expect(normalizeKanbanStage({ stageName: 'X', stageCode: ' MyCode ', stageColor: '#000000', isActive: false }).stageCode).toBe('mycode');
});

it('validates name, code, color and uniqueness (except the row itself)', () => {
  expect(validateKanbanStage(normalizeKanbanStage({ stageName: 'Review', stageColor: '#6366F1' }), rows)).toEqual({});
  const dup = validateKanbanStage(normalizeKanbanStage({ stageName: 'plan', stageColor: '#6366F1' }), rows);
  expect(dup.stageName).toMatch(/already/);
  expect(dup.stageCode).toMatch(/already/);
  expect(validateKanbanStage(normalizeKanbanStage({ stageName: 'Plan', stageColor: '#6366F1' }), rows, 'a')).toEqual({});
  const bad = validateKanbanStage({ stageName: '', stageCode: 'Bad Code', stageColor: 'red', isActive: true }, rows);
  expect(Object.keys(bad).sort()).toEqual(['stageCode', 'stageColor', 'stageName']);
});

it('maps a row to a ListWebCardsComponent card', () => {
  const card = kanbanStageToCard({ rowGUID: 'g', orderInList: 5, rowJSON: { stageName: 'Plan', stageCode: 'plan', stageColor: '#6366F1', isActive: false } }, 1);
  expect(card).toMatchObject({ id: 'g', title: 'Plan', description: 'plan · #6366F1 · inactive', orderInList: 5, position: 2 });
});
