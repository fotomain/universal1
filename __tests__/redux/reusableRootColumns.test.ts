// reusableRootSaga updateOne: `columns` are saved only for the whitelisted root columns - rowOwnerGUID / rowParentGUID / orderInList, and the ones the entity lists in its
// SystemMetaData entry `rootColumns` (task_fact_usage_timeline: rowPeriodDatetime, qtyForContract).
import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';

jest.mock('../../kit8/redux/SystemMetaData', () => ({ SystemMetaData: { factLines: { rootColumns: ['rowPeriodDatetime', 'qtyForContract'] }, plainLines: {} } }));
import { reusableCrudSlice } from '../../kit8/redux/reusable/reusableCrudSlice';
import { reusableRootSaga } from '../../kit8/redux/reusable/reusableRootSaga';

function setup(entity: 'factLines' | 'plainLines') {
  const updates: any[] = [];
  const sb: any = {
    from: () => {
      const q: any = {
        select: () => q, eq: () => q, maybeSingle: async () => ({ data: { rowJSON: { keep: 1 } }, error: null }),
        update: (payload: any) => { updates.push(payload); return q; },
      };
      return q;
    },
  };
  const slice = reusableCrudSlice(entity);
  const sagaMw = createSagaMiddleware({ context: { dbAdapters: { supabaseAdapter: { supabase: sb } } } });
  const store = configureStore({ reducer: { [entity]: slice.reducer, uxuiState: (s: any = {}) => s }, middleware: (g) => g({ serializableCheck: false }).concat(sagaMw) });
  sagaMw.run(reusableRootSaga({ tableName: 'task_fact_usage_timeline', entityKey: entity, itemLabel: 'Line', actions: slice.actions }));
  return { store, slice, updates, flush: () => new Promise((r) => setTimeout(r, 0)) };
}

it('an entity with rootColumns saves them: alone they are the whole update', async () => {
  const t = setup('factLines');
  t.store.dispatch(t.slice.actions.updateOne({ rowGUID: 'a', rowOwnerGUID: 'task', columns: { qtyForContract: 7, rowPeriodDatetime: '2026-10-20' } }));
  await t.flush();
  expect(t.updates).toEqual([{ qtyForContract: 7, rowPeriodDatetime: '2026-10-20' }]);
});

it('together with a rowJSON patch (merged into the old rowJSON)', async () => {
  const t = setup('factLines');
  t.store.dispatch(t.slice.actions.updateOne({ rowGUID: 'a', rowOwnerGUID: 'task', rowJSON: { priceTaskLine: 12 }, columns: { qtyForContract: 3 } }));
  await t.flush();
  expect(t.updates).toEqual([{ rowJSON: { keep: 1, priceTaskLine: 12 }, qtyForContract: 3 }]);
});

it('a column that is not listed is NOT saved (only the usual three)', async () => {
  const t = setup('factLines');
  t.store.dispatch(t.slice.actions.updateOne({ rowGUID: 'a', rowOwnerGUID: 'task', columns: { rowHeaderGUID: 'other', sumForContract: 999, orderInList: 5 } }));
  await t.flush();
  expect(t.updates).toEqual([{ orderInList: 5 }]);
});

it('an entity without rootColumns behaves as before', async () => {
  const t = setup('plainLines');
  t.store.dispatch(t.slice.actions.updateOne({ rowGUID: 'a', rowOwnerGUID: 'o', columns: { qtyForContract: 7, rowParentGUID: 'p' } }));
  await t.flush();
  expect(t.updates).toEqual([{ rowParentGUID: 'p' }]);
});
