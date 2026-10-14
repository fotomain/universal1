/** @jest-environment jsdom */
// LegalEntityCRUD: a ReusableTable with CRUD and a tree of folders = countries; a new legal entity goes into the picked country folder.
import { act } from 'react';
import { cleanupUI, press, q, renderUI, textOf } from '../../pm/ui/pmUiTestKit';

const mockData: Record<string, any> = {};
jest.mock('../../../kit8/catalog/legal_entity/useLegalEntityData', () => ({ useLegalEntityData: () => mockData }));
const mockTable = jest.fn();
jest.mock('../../../kit8/ui/components/table/reusable/ReusableTable', () => ({ __esModule: true, default: (p: any) => { mockTable(p); return require('react').createElement('div', { 'data-testid': p.testID }); } }));

import LegalEntityCRUD from '../../../kit8/catalog/legal_entity/LegalEntityCRUD';

const country = (guid: string, name: string, flag?: string): any => ({ rowGUID: guid, rowJSON: { countryName: name, flagEmoji: flag } });
const entity = (guid: string, parent: string): any => ({ rowGUID: guid, rowParentGUID: parent, rowJSON: { title: guid } });
const lastTable = () => mockTable.mock.calls.at(-1)![0];
beforeEach(() => {
  Object.keys(mockData).forEach((k) => delete mockData[k]);
  Object.assign(mockData, { rows: [entity('a', 'c-lv'), entity('b', 'c-de'), entity('c', 'empty')], countries: [country('c-lv', 'Latvia', '🇱🇻'), country('c-de', 'Germany'), country('c-ee', 'Estonia')], loaded: true, error: '', reload: jest.fn() });
});
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

it('a ReusableTable on the legal entity entity with full CRUD (add, duplicate, delete, in-place editing)', () => {
  renderUI(<LegalEntityCRUD />);
  expect(lastTable()).toMatchObject({ entityName: 'legalEntityReusable', itemLabel: 'Legal entity', listOwnerGUID: '*', listParentGUID: '*', realtime: true });
  expect(lastTable().crudPanelEnabled).toBeUndefined();
  expect(lastTable().contextMenuEnabled).toBeUndefined();
  expect(textOf('legal-entity')).toContain('3 legal entities');
});
it('the columns: title, legal name, registration no., VAT no., country (the folder), address, active', () => {
  renderUI(<LegalEntityCRUD />);
  const cols = lastTable().visualColumns;
  expect(cols.map((c: any) => c.key)).toEqual(['n', 'title', 'legalName', 'registrationNo', 'vatNo', 'country', 'legalAddress', 'isActive']);
  expect(cols.find((c: any) => c.key === 'country')).toMatchObject({ type: 'select', target: 'rowParentGUID' });
  expect(cols.find((c: any) => c.key === 'country').options.map((o: any) => o.label)).toEqual(['Estonia', 'Germany', 'Latvia']);
});
it('the folders are the countries that have a legal entity; the button shows all of them', () => {
  renderUI(<LegalEntityCRUD />);
  expect(lastTable().foldersTree.nodes.map((n: any) => n.title)).toEqual(['Germany', '🇱🇻 Latvia']);
  expect(lastTable().foldersTree).toMatchObject({ folderTarget: 'rowParentGUID', noFolderValue: 'empty' });
  expect(lastTable().uxuiTable).toMatchObject({ showFoldersTree: true });
  press('legal-entity-all-countries');
  expect(lastTable().foldersTree.nodes.map((n: any) => n.title)).toEqual(['Estonia', 'Germany', '🇱🇻 Latvia']);
});
it('a new legal entity goes into the picked country folder (no folder when All / a folder that is not a country)', () => {
  renderUI(<LegalEntityCRUD />);
  expect(lastTable().newRowDefaults()).toEqual({ rowOwnerGUID: 'legalEntityCatalog', rowParentGUID: 'empty', rowJSON: {} });
  act(() => lastTable().foldersTree.onSelectedFolderChange('c-de'));
  expect(lastTable().newRowDefaults().rowParentGUID).toBe('c-de');
  act(() => lastTable().foldersTree.onSelectedFolderChange('not-a-country'));
  expect(lastTable().newRowDefaults().rowParentGUID).toBe('empty');
});
it('a read error says to run the SQL; Refresh reads again', () => {
  mockData.error = 'relation "legalEntityTable" does not exist';
  renderUI(<LegalEntityCRUD />);
  expect(textOf('legal-entity-setup')).toContain('PART 26');
  press('legal-entity-reload');
  expect(mockData.reload).toHaveBeenCalled();
  cleanupUI();
  mockData.error = '';
  renderUI(<LegalEntityCRUD />);
  expect(q('legal-entity-setup')).toBeNull();
});
