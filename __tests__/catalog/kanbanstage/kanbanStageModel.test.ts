// kit8/catalog/kanbanstage/kanbanStageModel: normalize, validate, card mapping.
import { kanbanStageCodeOf, kanbanStageToCard, normalizeKanbanStage, validateKanbanStage } from '../../../kit8/catalog/kanbanstage/kanbanStageModel';

const rows = [{ rowGUID: 'a', rowJSON: { stageCode: 'plan', stageName: 'Plan' } }] as any[];

it('code defaults to the name, lower case with _', () => {
  expect(kanbanStageCodeOf('  Code Review! ')).toBe('code_review');
  expect(normalizeKanbanStage({ stageName: ' QA check ', stageColor: '#ef4444' })).toEqual({ stageName: 'QA check', stageCode: 'qa_check', stageColor: '#EF4444', isActive: true, stageProgressPercent: 0 });
  expect(normalizeKanbanStage({ stageName: 'X', stageCode: ' MyCode ', stageColor: '#000000', isActive: false }).stageCode).toBe('mycode');
});

it('validates name, code, color and uniqueness (except the row itself)', () => {
  expect(validateKanbanStage(normalizeKanbanStage({ stageName: 'Review', stageColor: '#6366F1' }), rows)).toEqual({});
  const dup = validateKanbanStage(normalizeKanbanStage({ stageName: 'plan', stageColor: '#6366F1' }), rows);
  expect(dup.stageName).toMatch(/already/);
  expect(dup.stageCode).toMatch(/already/);
  expect(validateKanbanStage(normalizeKanbanStage({ stageName: 'Plan', stageColor: '#6366F1' }), rows, 'a')).toEqual({});
  const bad = validateKanbanStage({ stageName: '', stageCode: 'Bad Code', stageColor: 'red', isActive: true }, rows);
  expect(Object.keys(bad).sort()).toEqual(['stageCode', 'stageColor', 'stageName', 'stageProgressPercent']);
});

it('percent: obligatory whole number 0..100; a missing one reads as the standard percent of the code', () => {
  const ok = (p: unknown) => validateKanbanStage({ ...normalizeKanbanStage({ stageName: 'Review', stageColor: '#6366F1' }), stageProgressPercent: p as number }, rows).stageProgressPercent;
  expect(ok(0)).toBeUndefined(); // 0 = typed on each card
  expect(ok(100)).toBeUndefined();
  expect(ok(45)).toBeUndefined();
  for (const bad of [-1, 101, 45.5, NaN, undefined, '10']) expect(ok(bad)).toMatch(/whole number from 0 to 100/);
  expect(normalizeKanbanStage({ stageName: 'Plan', stageCode: 'plan', stageColor: '#6366F1' }).stageProgressPercent).toBe(10);
  expect(normalizeKanbanStage({ stageName: 'Construct', stageColor: '#6366F1' }).stageProgressPercent).toBe(60);
  expect(normalizeKanbanStage({ stageName: 'Mine', stageColor: '#6366F1' }).stageProgressPercent).toBe(0);
  expect(normalizeKanbanStage({ stageName: 'Plan', stageColor: '#6366F1', stageProgressPercent: 45.5 }).stageProgressPercent).toBe(45.5); // refused by validate, not rounded
});

it('maps a row to a ListWebCardsComponent card', () => {
  const card = kanbanStageToCard({ rowGUID: 'g', orderInList: 5, rowJSON: { stageName: 'Plan', stageCode: 'plan', stageColor: '#6366F1', isActive: false, stageProgressPercent: 10 } }, 1);
  expect(card).toMatchObject({ id: 'g', title: 'Plan', description: 'plan · #6366F1 · 10% · inactive', orderInList: 5, position: 2 });
  expect(kanbanStageToCard({ rowGUID: 'm', rowJSON: { stageName: 'Mine', stageCode: 'mine', stageColor: '#6366F1', stageProgressPercent: 0 } }).description).toBe('mine · #6366F1 · manual %');
});
