// The texts an administrator replaced for the whole organization (SQL PART 48): the store, the override of pmT, the i18next post processor, the column titles.
// The database side: kit8/docker/tests/54_organization_texts.sql.
import { columnTitleOf, orgTextsPostProcessor, organizationText, organizationTextCount, organizationTextOfKey, organizationTextsVersion, setOrganizationTexts, subscribeOrganizationTexts } from '../../../kit8/i18n/organizationTexts';
import { pmT } from '../../../kit8/pm/i18n/pmT';

afterEach(() => setOrganizationTexts([]));

describe('the store', () => {
  it('keeps menu, title and column texts apart; a bad row is ignored', () => {
    setOrganizationTexts([
      { kind: 'menu', key: 'menu.home', text: 'Sākums' },
      { kind: 'title', key: 'Organization members', text: 'Mūsu cilvēki' },
      { kind: 'column', key: 'project_task_table.taskDescription', text: 'Work package' },
      { kind: 'menu', key: 'menu.empty', text: '' },
      { kind: 'button' as any, key: 'x', text: 'y' },
      { key: 'only a key' },
    ]);
    expect(organizationTextCount()).toBe(3);
    expect(organizationText('menu', 'menu.home')).toBe('Sākums');
    expect(organizationText('title', 'menu.home')).toBeUndefined();
    expect(organizationTextOfKey('Organization members')).toBe('Mūsu cilvēki');
    expect(organizationTextOfKey('menu.home')).toBe('Sākums');
    expect(organizationTextOfKey('project_task_table.taskDescription')).toBeUndefined();   // a column key is not a menu / title key
  });
  it('nothing in, nothing out; the version moves and listeners hear it', () => {
    const v = organizationTextsVersion();
    const seen: number[] = [];
    const off = subscribeOrganizationTexts(() => seen.push(organizationTextsVersion()));
    setOrganizationTexts(null);
    off();
    setOrganizationTexts([]);
    expect(organizationTextsVersion()).toBe(v + 2);
    expect(seen).toEqual([v + 1]);
    expect(organizationTextCount()).toBe(0);
  });
});

describe('where the texts are read', () => {
  it('pmT: the replaced title wins, with the placeholders filled; the rest stays delivered', () => {
    expect(pmT('Saved')).toBe('Saved');
    setOrganizationTexts([{ kind: 'title', key: 'Saved', text: 'Stored' }, { kind: 'title', key: 'Exported {{file}}', text: 'Written {{file}}' }]);
    expect(pmT('Saved')).toBe('Stored');
    expect(pmT('Exported {{file}}', { file: 'a.json' })).toBe('Written a.json');
    expect(pmT('Delete document')).toBe('Delete document');
  });
  it('the i18next post processor replaces a menu key and keeps the delivered value otherwise', () => {
    setOrganizationTexts([{ kind: 'menu', key: 'menu.home', text: 'Sākums' }]);
    expect(orgTextsPostProcessor.name).toBe('orgTexts');
    expect(orgTextsPostProcessor.process('Home', 'menu.home')).toBe('Sākums');
    expect(orgTextsPostProcessor.process('Home', ['translation:menu.home'])).toBe('Sākums');
    expect(orgTextsPostProcessor.process('Profile', 'menu.profile')).toBe('Profile');
  });
  it('columnTitleOf: the organization header of table.column, else the delivered title', () => {
    setOrganizationTexts([{ kind: 'column', key: 'project_task_table.taskDescription', text: 'Work package' }]);
    expect(columnTitleOf('project_task_table', 'taskDescription', 'Name')).toBe('Work package');
    expect(columnTitleOf('project_task_table', 'durationDays', 'Days')).toBe('Days');
    expect(columnTitleOf(undefined, 'taskDescription', 'Name')).toBe('Name');
  });
});
