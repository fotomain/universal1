/** @jest-environment jsdom */
// CatalogTranslationsHost: reads the rows of the INTERFACE language after the sign in, again when the language changes, nothing without a user.
import React, { act } from 'react';

let mockLanguage = 'lv';
let mockOrg = 'org1';
const mockSelects: string[] = [];
const mockClient: any = {
  from: (table: string) => {
    const q: any = { _lang: '' };
    q.select = () => q;
    q.eq = (_c: string, v: string) => { q._lang = v; mockSelects.push(`${table}:${v}`); return q; };
    q.order = () => q;
    q.range = () => Promise.resolve({ data: q._lang === 'lv' ? [{ rowOwnerGUID: 'p1', rowParentGUID: 'lv', rowJSON: { translationField: 'title', translationText: 'Planšete' } }]
      : q._lang === 'ru' ? [{ rowOwnerGUID: 'p1', rowParentGUID: 'ru', rowJSON: { translationField: 'title', translationText: 'Планшет' } }] : [], error: null });
    return q;
  },
};
jest.mock('../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: mockClient }) }));
jest.mock('react-redux', () => ({ useSelector: () => mockOrg }));
jest.mock('../../../kit8/redux/activeUserSlice', () => ({ selectUserOrganizationGUID: () => 'x' }));
jest.mock('../../../kit8/pm/i18n/pmT', () => ({ usePMLanguage: () => mockLanguage }));

import CatalogTranslationsHost from '../../../kit8/catalog/translation/CatalogTranslationsHost';
import { setCatalogTranslations, translatedTitle } from '../../../kit8/catalog/translation/catalogTranslationStore';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const render = async () => { await act(async () => { root.render(<CatalogTranslationsHost />); await Promise.resolve(); await Promise.resolve(); }); };
beforeEach(() => { const el = document.createElement('div'); document.body.appendChild(el); root = createRoot(el); mockSelects.length = 0; mockLanguage = 'lv'; mockOrg = 'org1'; });
afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ''; setCatalogTranslations('en', []); });

it('reads the translations of the interface language after the sign in', async () => {
  await render();
  expect(mockSelects).toEqual(['catalogTranslationTable:lv']);
  expect(translatedTitle('p1')).toBe('Planšete');
});

it('a change of the interface language reads the other language', async () => {
  await render();
  mockLanguage = 'ru';
  await render();
  expect(mockSelects).toEqual(['catalogTranslationTable:lv', 'catalogTranslationTable:ru']);
  expect(translatedTitle('p1')).toBe('Планшет');
  mockLanguage = 'de';
  await render();
  expect(translatedTitle('p1')).toBeUndefined();
});

it('nobody signed in: nothing is read and the store is empty', async () => {
  mockOrg = '';
  await render();
  expect(mockSelects).toEqual([]);
  expect(translatedTitle('p1')).toBeUndefined();
});
