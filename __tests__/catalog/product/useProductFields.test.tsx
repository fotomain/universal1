/** @jest-environment jsdom */
// useProductFields: the optional Product fields of the CATALOG come from the default project settings of the organization; no organization / no providers = none.
import React from 'react';
import { act } from 'react';

let mockDefaults: any = null;
let mockThrow = false;
jest.mock('../../../kit8/catalog/organization/useMyOrganization', () => ({
  useMyOrganization: () => { if (mockThrow) throw new Error('no QueryClient'); return { defaults: mockDefaults }; },
}));

import { useProductFields } from '../../../kit8/catalog/product/useProductFields';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');

function read(): any {
  let out: any;
  const Probe = () => { out = useProductFields(); return null; };
  const el = document.createElement('div');
  const root = createRoot(el);
  act(() => root.render(<Probe />));
  act(() => root.unmount());
  return out;
}

afterEach(() => { mockDefaults = null; mockThrow = false; });

it('the organization never saved settings: no optional fields', () => {
  expect(read()).toEqual({ itemNumber: { enabled: false, shown: false }, searchName: { enabled: false, shown: false } });
});
it('the default project settings of the organization (Enabled AND Visible) show the fields', () => {
  mockDefaults = { itemNumberFunctionalityEnabled: true, itemNumberFunctionalityVisibleInProjects: true };
  expect(read()).toEqual({ itemNumber: { enabled: true, shown: true }, searchName: { enabled: false, shown: false } });
});
it('without the providers of the app the catalog works as before (no fields)', () => {
  mockThrow = true;
  expect(read().itemNumber.enabled).toBe(false);
});
