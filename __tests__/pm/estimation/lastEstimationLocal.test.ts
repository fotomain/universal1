// lastEstimationLocal: the estimation dashboard remembers the last project and, per project, the last estimate (on this device).
const store: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: async (k: string) => store[k] ?? null, setItem: async (k: string, v: string) => { store[k] = v; } } }));
import { LAST_ESTIMATION_EMPTY, loadLastEstimation, normalizeLastEstimation, resetLastEstimationForTests, saveLastEstimation } from '../../../kit8/pm/estimation/ui/lastEstimationLocal';

beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; resetLastEstimationForTests(); });

test('normalize drops anything that is not a string id', () => {
  expect(normalizeLastEstimation(null)).toEqual(LAST_ESTIMATION_EMPTY);
  expect(normalizeLastEstimation({ projectGUID: 5, documentByProject: { a: 'd1', b: 7 } })).toEqual({ projectGUID: null, documentByProject: { a: 'd1' } });
});

test('the project and the estimate of each project are kept and read back', async () => {
  await loadLastEstimation();
  saveLastEstimation({ projectGUID: 'p1' });
  saveLastEstimation({ documentProjectGUID: 'p1', documentGUID: 'd1' });
  saveLastEstimation({ documentProjectGUID: 'p2', documentGUID: 'd9' });
  await new Promise((r) => setTimeout(r, 0));
  resetLastEstimationForTests();
  expect(await loadLastEstimation()).toEqual({ projectGUID: 'p1', documentByProject: { p1: 'd1', p2: 'd9' } });
});

test('a forgotten project and a cleared estimate are removed', async () => {
  await loadLastEstimation();
  saveLastEstimation({ projectGUID: 'p1' });
  saveLastEstimation({ documentProjectGUID: 'p1', documentGUID: 'd1' });
  saveLastEstimation({ projectGUID: null });
  saveLastEstimation({ documentProjectGUID: 'p1', documentGUID: null });
  resetLastEstimationForTests();
  await new Promise((r) => setTimeout(r, 0));
  expect(await loadLastEstimation()).toEqual(LAST_ESTIMATION_EMPTY);
});
