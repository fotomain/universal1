// reusableRootSaga deleteOne: row-level security answers a refused DELETE with 200 and an EMPTY list (no error).
// That used to count as "deleted": the card left the screen, the row stayed in the database and came back with the next read.
import { configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';

jest.mock('../../kit8/redux/SystemMetaData', () => ({ SystemMetaData: { posts: {} } }));
import { reusableCrudSlice } from '../../kit8/redux/reusable/reusableCrudSlice';
import { reusableRootSaga } from '../../kit8/redux/reusable/reusableRootSaga';

/** deleted = what the DELETE ... RETURNING answers; stillThere = rows a follow-up count finds */
function setup(deleted: any[], stillThere: number, dbError: any = null, table = 'mediaPostTable') {
  const snackbars: any[] = [];
  const sb: any = {
    from: () => {
      let isCount = false;
      const q: any = {
        delete: () => q,
        // delete().eq().select() = RETURNING (the chain is awaited here); select(col, { head: true }).eq() = the count check
        eq: () => q,
        select: (_c?: string, opts?: any) => { if (opts?.head) { isCount = true; } return q; },
        then: (res: any, rej: any) => Promise.resolve(isCount ? { count: stillThere, error: null } : { data: deleted, error: dbError }).then(res, rej),
      };
      return q;
    },
  };
  const slice = reusableCrudSlice('posts');
  const sagaMw = createSagaMiddleware({ context: { dbAdapters: { supabaseAdapter: { supabase: sb } } } });
  const uxui = (s: any = {}, a: any) => { if (a.type.includes('showSnackbar')) snackbars.push(a.payload); return s; };
  const store = configureStore({ reducer: { posts: slice.reducer, uxuiState: uxui }, middleware: (g) => g({ serializableCheck: false }).concat(sagaMw) });
  sagaMw.run(reusableRootSaga({ tableName: table, entityKey: 'posts', itemLabel: 'Post', actions: slice.actions }));
  store.dispatch(slice.actions.readDataSuccess({ data: [{ rowGUID: 'a' }, { rowGUID: 'b' }], action: { payload: {} } }) as any);
  return { store, slice, snackbars, flush: () => new Promise((r) => setTimeout(r, 0)) };
}

const rowsOf = (t: ReturnType<typeof setup>) => (t.store.getState() as any).posts.entityDataFromServer.map((r: any) => r.rowGUID);

it('a real delete removes the card', async () => {
  const t = setup([{ rowGUID: 'a' }], 0);
  t.store.dispatch(t.slice.actions.deleteOne({ rowGUID: 'a' }));
  await t.flush();
  expect(rowsOf(t)).toEqual(['b']);
  expect((t.store.getState() as any).posts.deleteSuccessful).toBe(1);
});

it('RLS filtered the delete (empty answer, the row is still there): the card STAYS and the user is told', async () => {
  const t = setup([], 1);
  t.store.dispatch(t.slice.actions.deleteOne({ rowGUID: 'a' }));
  await t.flush();
  expect(rowsOf(t)).toEqual(['a', 'b']);
  expect((t.store.getState() as any).posts.deleteSuccessful).toBe(0);
  expect(JSON.stringify(t.snackbars)).toMatch(/Post was not deleted: .*permission/);
});

it('an empty answer for a row that is already gone is a success', async () => {
  const t = setup([], 0);
  t.store.dispatch(t.slice.actions.deleteOne({ rowGUID: 'a' }));
  await t.flush();
  expect(rowsOf(t)).toEqual(['b']);
});

it('a media post of a READ-ONLY project: the snack bar names the project and the card stays', async () => {
  const t = setup([], 1, { code: '42501', message: 'Read-only project "Railway #1": nothing can be changed (mediaPostTable).' });
  t.store.dispatch(t.slice.actions.deleteOne({ rowGUID: 'a' }));
  await t.flush();
  expect(rowsOf(t)).toEqual(['a', 'b']);
  expect(JSON.stringify(t.snackbars)).toContain('Delete process stopped! This media post belongs to the Project Railway #1 and Project is readonly now');
});

it('another table keeps the generic words', async () => {
  const t = setup([], 1, { code: '42501', message: 'Read-only project "X": nothing can be changed' }, 'someTable');
  t.store.dispatch(t.slice.actions.deleteOne({ rowGUID: 'a' }));
  await t.flush();
  expect(JSON.stringify(t.snackbars)).not.toContain('Delete process stopped');
});
