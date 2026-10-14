// The legal entity catalog (kit8/catalog/legal_entity): titles, the folders = countries (only the countries that have a legal entity, all on demand), the picker list.
import { LEGAL_ENTITY_NO_FOLDER, LEGAL_ENTITY_ROUTES, LEGAL_ENTITY_TABLE, emptyLegalEntity, isLegalEntityActive, legalEntitiesToChoose, legalEntityFolderNodes, legalEntityTitle } from '../../../kit8/catalog/legal_entity/legalEntityModel';
import { legalEntitySystemMetaData } from '../../../kit8/catalog/legal_entity/legalEntityMetaData';

const le = (guid: string, parent: string, json: Record<string, any> = {}): any => ({ rowGUID: guid, rowOwnerGUID: 'legalEntityCatalog', rowParentGUID: parent, orderInList: 0, rowJSON: { title: guid, isActive: true, ...json } });
const country = (guid: string, name: string, flag?: string): any => ({ rowGUID: guid, rowOwnerGUID: 'countryCatalog', rowParentGUID: 'empty', orderInList: 0, rowJSON: { countryName: name, flagEmoji: flag } });

it('the table, the entity and the route', () => {
  expect(LEGAL_ENTITY_TABLE).toMatchObject({ table: 'legalEntityTable', entity: 'legalEntityReusable', catalogOwner: 'legalEntityCatalog' });
  expect(LEGAL_ENTITY_ROUTES.list).toBe('/catalog/legal/entity');
  expect(LEGAL_ENTITY_NO_FOLDER).toBe('empty');
  expect(emptyLegalEntity()).toEqual({ title: null, legalName: null, registrationNo: null, vatNo: null, legalAddress: null, description: null, isActive: true });
});
it('the title: the title, else the legal name, else the GUID', () => {
  expect(legalEntityTitle(le('x', 'empty', { title: ' Acme SIA ' }))).toBe('Acme SIA');
  expect(legalEntityTitle(le('x', 'empty', { title: '', legalName: 'Acme Ltd' }))).toBe('Acme Ltd');
  expect(legalEntityTitle(le('x', 'empty', { title: null }))).toBe('x');
  expect(legalEntityTitle(null)).toBe('');
});
it('the folders are the countries that have a legal entity (with the flag), alphabetical; all of them on demand', () => {
  const countries = [country('c-lv', 'Latvia', '🇱🇻'), country('c-de', 'Germany'), country('c-ee', 'Estonia')];
  const entities = [le('a', 'c-lv'), le('b', 'c-lv'), le('c', 'c-de'), le('d', 'empty')];
  expect(legalEntityFolderNodes(countries, entities).map((n) => [n.id, n.title, n.parentId])).toEqual([['c-de', 'Germany', null], ['c-lv', '🇱🇻 Latvia', null]]);
  expect(legalEntityFolderNodes(countries, entities, true).map((n) => n.title)).toEqual(['Estonia', 'Germany', '🇱🇻 Latvia']);
  expect(legalEntityFolderNodes(countries, entities, true).map((n) => n.order)).toEqual([0, 1, 2]);
  expect(legalEntityFolderNodes([], [])).toEqual([]);
});
it('the picker: the active ones by title; the one already chosen stays', () => {
  const rows = [le('b', 'empty', { title: 'Beta' }), le('a', 'empty', { title: 'Alpha' }), le('z', 'empty', { title: 'Zed', isActive: false })];
  expect(legalEntitiesToChoose(rows).map((r) => r.rowGUID)).toEqual(['a', 'b']);
  expect(legalEntitiesToChoose(rows, 'z').map((r) => r.rowGUID)).toEqual(['a', 'b', 'z']);
  expect(isLegalEntityActive(rows[2])).toBe(false);
});
it('the SystemMetaData entry: a plain reusable entity of the table', () => {
  const m = legalEntitySystemMetaData();
  expect(Object.keys(m)).toEqual(['legalEntityReusable']);
  expect(m.legalEntityReusable).toMatchObject({ tableName: 'legalEntityTable', itemLabel: 'Legal entity' });
  expect(m.legalEntityReusable.prepareCreateApi({ action: { payload: { rowGUID: 'x' } } })).toEqual({ newItem: { rowGUID: 'x' } });
});
