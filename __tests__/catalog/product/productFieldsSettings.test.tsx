/** @jest-environment jsdom */
// Project settings → Product (TabProduct): itemNumberFunctionalityEnabled / ...VisibleInProjects, searchNameFunctionalityEnabled / ...VisibleInProjects - ALL FALSE by default
// (also for a project that never had the keys); the four keys are part of the organization defaults; the toolbar has the tab, the organization settings too.
import { cleanupUI, q, renderUI, toggleSwitch } from '../../pm/ui/pmUiTestKit';
import PMProjectProductTab, { productValuesOf } from '../../../kit8/pm/view/project/settings/PMProjectProductTab';
import { defaultProjectSettingsOf, newProjectPatchFrom } from '../../../kit8/catalog/organization/defaultProjectSettings';
import { productFieldsOfCatalog, productFieldsOfProject } from '../../../kit8/catalog/product/productFieldsModel';

afterEach(cleanupUI);
const checked = (id: string) => (q(id)!.querySelector('input') as HTMLInputElement).checked;
const disabled = (id: string) => (q(id)!.querySelector('input') as HTMLInputElement).disabled;
const ALL_OFF = {
  itemNumberFunctionalityEnabled: false,
  itemNumberFunctionalityVisibleInProjects: false,
  searchNameFunctionalityEnabled: false,
  searchNameFunctionalityVisibleInProjects: false,
};

it('false by default: a missing key (or anything but true) is false', () => {
  expect(productValuesOf(null)).toEqual(ALL_OFF);
  expect(productValuesOf({})).toEqual(ALL_OFF);
  expect(productValuesOf({ itemNumberFunctionalityEnabled: 'yes' as any })).toEqual(ALL_OFF);
  expect(productValuesOf({ searchNameFunctionalityEnabled: true }).searchNameFunctionalityEnabled).toBe(true);
});

it('the four switches are off for a project without the keys; each changes only its own key', () => {
  const onChange = jest.fn();
  renderUI(<PMProjectProductTab values={{}} onChange={onChange} />);
  expect(q('pm-project-tab-product-content')).not.toBeNull();
  for (const id of ['pm-project-item-number-enabled', 'pm-project-item-number-visible', 'pm-project-search-name-enabled', 'pm-project-search-name-visible']) expect(checked(id)).toBe(false);
  toggleSwitch('pm-project-item-number-enabled');
  expect(onChange).toHaveBeenLastCalledWith({ itemNumberFunctionalityEnabled: true });
  toggleSwitch('pm-project-search-name-enabled');
  expect(onChange).toHaveBeenLastCalledWith({ searchNameFunctionalityEnabled: true });
});

it('"Visible in projects" waits for its "Enabled" switch', () => {
  renderUI(<PMProjectProductTab values={{ itemNumberFunctionalityEnabled: true }} onChange={jest.fn()} />);
  expect(disabled('pm-project-item-number-visible')).toBe(false);
  expect(disabled('pm-project-search-name-visible')).toBe(true);
});

it('shows the saved values', () => {
  renderUI(<PMProjectProductTab values={{ ...ALL_OFF, searchNameFunctionalityEnabled: true, searchNameFunctionalityVisibleInProjects: true }} onChange={jest.fn()} />);
  expect(checked('pm-project-search-name-enabled')).toBe(true);
  expect(checked('pm-project-search-name-visible')).toBe(true);
  expect(checked('pm-project-item-number-enabled')).toBe(false);
});

it('the organization defaults carry the four keys (all false) and a new project starts from the stored ones', () => {
  expect(defaultProjectSettingsOf(null)).toMatchObject(ALL_OFF);
  expect(defaultProjectSettingsOf({ itemNumberFunctionalityEnabled: true })).toMatchObject({ ...ALL_OFF, itemNumberFunctionalityEnabled: true });
  expect(newProjectPatchFrom({ searchNameFunctionalityEnabled: true } as any)).toMatchObject({ ...ALL_OFF, searchNameFunctionalityEnabled: true });
  expect(newProjectPatchFrom(null)).toEqual({});
});

it('a project shows a field only while Enabled AND Visible; the catalog (the organization defaults) the same: Enabled AND Visible', () => {
  const s = { itemNumberFunctionalityEnabled: true, searchNameFunctionalityEnabled: true, searchNameFunctionalityVisibleInProjects: true };
  expect(productFieldsOfProject(s)).toEqual({ itemNumber: { enabled: true, shown: false }, searchName: { enabled: true, shown: true } });
  // Visible without Enabled counts for nothing
  expect(productFieldsOfProject({ itemNumberFunctionalityVisibleInProjects: true }).itemNumber).toEqual({ enabled: false, shown: false });
  expect(productFieldsOfProject(null).itemNumber.enabled).toBe(false);
  expect(productFieldsOfCatalog(s)).toEqual({ itemNumber: { enabled: true, shown: false }, searchName: { enabled: true, shown: true } });
  expect(productFieldsOfCatalog(null)).toEqual({ itemNumber: { enabled: false, shown: false }, searchName: { enabled: false, shown: false } });
});
