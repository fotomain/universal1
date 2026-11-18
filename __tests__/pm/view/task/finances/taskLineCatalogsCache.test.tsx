/** @jest-environment jsdom */
// useTaskLineCatalogs: the Finances view is mounted AGAIN for every task the user clicks; the 28 catalogs it needs are read ONCE (and again only when stale / narrowed by another screen).
import React, { act } from 'react';

const mockActions = { readData: jest.fn((p: any) => ({ type: 'read', p })) };
jest.mock('../../../../../kit8/redux/SystemMetaData', () => ({ SystemMetaData: new Proxy({}, { get: () => ({ actions: mockActions }) }) }));
let mockState: any = {};
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({ ...jest.requireActual('react-redux'), useSelector: (fn: any) => fn(mockState), useDispatch: () => mockDispatch }));

import { CATALOG_FRESH_MS, resetTaskLineCatalogReads, staleCatalogEntities, useTaskLineCatalogs, useTaskLineCatalogsLoading } from '../../../../../kit8/pm/view/task/finances/useTaskLineCatalogs';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
let loadingSeen: boolean[] = [];
function Probe() { useTaskLineCatalogs(true); loadingSeen.push(useTaskLineCatalogsLoading(true)); return null; }
function mount() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<Probe />));
}
const unmount = () => { act(() => root?.unmount()); document.body.innerHTML = ''; };
const ENTITY_COUNT = 28;
/** a state in which every catalog was read in full (no scope) */
const fullState = () => new Proxy({}, { get: (_t, k) => (k === 'uxuiState' ? {} : { entityDataFromServer: [], readScope: 'null', crudMoment: 1 }) });

beforeEach(() => { resetTaskLineCatalogReads(); mockState = {}; mockDispatch.mockClear(); mockActions.readData.mockClear(); loadingSeen = []; });
afterEach(unmount);

it('the first open reads every catalog, with the page of 1000 rows', () => {
  mount();
  expect(mockActions.readData).toHaveBeenCalledTimes(ENTITY_COUNT);
  expect(mockActions.readData).toHaveBeenCalledWith({ paginationSize: 1000, originationCurrentPage: 0 });
});

it('the next task (a new mount) reads NOTHING while the catalogs are fresh and complete', () => {
  mount();
  unmount();
  mockState = fullState();
  mockActions.readData.mockClear();
  mount();
  expect(mockActions.readData).not.toHaveBeenCalled();
});

it('a catalog that another screen narrowed to one owner (readScope not null) is read again', () => {
  mount();
  unmount();
  mockState = new Proxy({}, { get: (_t, k) => ({ entityDataFromServer: [], readScope: k === 'contract' || String(k).toLowerCase().includes('contract') ? '{"rowOwnerGUID":"p1"}' : 'null', crudMoment: 1 }) });
  mockActions.readData.mockClear();
  mount();
  expect(mockActions.readData.mock.calls.length).toBeGreaterThanOrEqual(1);
  expect(mockActions.readData.mock.calls.length).toBeLessThan(ENTITY_COUNT);
});

it('a catalog older than the freshness window is read again', () => {
  mount();
  unmount();
  mockState = fullState();
  const now = Date.now();
  expect(staleCatalogEntities(now + 1000, () => true)).toEqual([]);
  expect(staleCatalogEntities(now + CATALOG_FRESH_MS + 1000, () => true)).toHaveLength(ENTITY_COUNT);
});

it('the spinner flag: true until every catalog has answered its first read (success or failure), false after', () => {
  // the initial state of every reusable entity: nothing read yet
  mockState = new Proxy({}, { get: () => ({ entityDataFromServer: [], crudMoment: 0, readErrorData: '', readScope: null }) });
  mount();
  expect(loadingSeen[loadingSeen.length - 1]).toBe(true);
  unmount();
  loadingSeen = [];
  mockState = fullState();
  mount();
  expect(loadingSeen[loadingSeen.length - 1]).toBe(false);
});
