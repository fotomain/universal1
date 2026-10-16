/** @jest-environment jsdom */
// Organization edit: TopTabs Main | Projects, Projects -> Settings = the default settings of a new project (rowJSON.defaultProjectSettings)
import React, { act } from 'react';
import { cleanupUI, press, q, renderUI, toggleSwitch, wait } from '../../pm/ui/pmUiTestKit';

// OrganizationEdit imports the whole common barrel (ApplicationBarApp -> auth -> native browser modules): not needed here
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn(), openAuthSessionAsync: jest.fn() }), { virtual: true });
jest.mock('expo-auth-session', () => ({}), { virtual: true });
jest.mock('../../../kit8/hooks/useAppSignOut', () => ({ useAppSignOut: () => jest.fn(), default: () => jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'mock-uuid-123' }), { virtual: true });

const mockReplace = jest.fn();
// the PM UI kit mocks expo-router itself: override with doMock + require AFTER importing it
jest.doMock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ guid: 'org-1' }),
}));

jest.mock('../../../kit8/redux/reusable/useRealtimeEntity', () => ({ useRealtimeEntity: jest.fn(() => 'idle') }));
jest.mock('../../../kit8/catalog/currency/CurrencyRealtimeBadge', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => ({ __esModule: true, default: () => null }));

const mockUpdateOne = jest.fn((p: any) => ({ type: 'updateOne', payload: p }));
jest.mock('../../../kit8/redux/SystemMetaData', () => ({
  SystemMetaData: { organizationReusable: { actions: { updateOne: (p: any) => mockUpdateOne(p), createOne: jest.fn() } } },
}));

const org = {
  rowGUID: 'org-1',
  rowOwnerGUID: 'admin@universal.io',
  rowParentGUID: 'empty',
  orderInList: 0,
  rowJSON: { organizationTitle: 'Universal Timber Corp', createdByUser: 'admin@universal.io', isActive: true, countryOfResidence: 'LV' },
};

const OrganizationEdit = require('../../../kit8/catalog/organization/OrganizationEdit').default;

describe('OrganizationEdit - Main | Projects -> Settings', () => {
  beforeEach(() => {
    mockUpdateOne.mockClear();
    mockReplace.mockClear();
    (globalThis as any).__pmTestReduxState = {
      activeUserState: { activeUserEmail: 'admin@universal.io' },
      organizationReusable: { entityDataFromServer: [org] },
    };
  });
  afterEach(() => {
    cleanupUI();
    delete (globalThis as any).__pmTestReduxState;
  });

  it('has the tabs Main and Projects; Main is open first', () => {
    renderUI(<OrganizationEdit />);
    expect(q('organization-tab-main')).not.toBeNull();
    expect(q('organization-tab-projects')).not.toBeNull();
    expect(q('organization-input-title')).not.toBeNull();
    expect(q('organization-projects-tab-content')).toBeNull();
  });

  it('Projects -> Settings shows the project settings; the change is saved in rowJSON.defaultProjectSettings with the other fields kept', async () => {
    renderUI(<OrganizationEdit />);
    press('organization-tab-projects');
    expect(q('organization-input-title')).toBeNull();
    expect(q('organization-projects-tab-settings')).not.toBeNull();
    await wait(50); // the lazily loaded settings
    expect(q('organization-project-settings')).not.toBeNull();
    toggleSwitch('organization-project-plan-hour');
    // Save is there on this tab too
    press('organization-save');
    expect(mockUpdateOne).toHaveBeenCalledTimes(1);
    const json = mockUpdateOne.mock.calls[0][0].rowJSON;
    expect(json.defaultProjectSettings.planHour).toBe(true);
    expect(json.defaultProjectSettings.planDay).toBe(true);
    expect(json.organizationTitle).toBe('Universal Timber Corp');
    expect(mockReplace).toHaveBeenCalled();
  });

  it('the stored defaults are shown (Projects -> Settings -> Main)', async () => {
    (globalThis as any).__pmTestReduxState.organizationReusable.entityDataFromServer = [
      { ...org, rowJSON: { ...org.rowJSON, defaultProjectSettings: { planMinute: true } } },
    ];
    renderUI(<OrganizationEdit />);
    press('organization-tab-projects');
    await wait(50);
    const el = q('organization-project-plan-minute')!;
    const input = (el.tagName === 'INPUT' ? el : el.querySelector('input')) as HTMLInputElement;
    expect(input.checked).toBe(true);
  });

  it('a user who cannot edit the organization cannot change the defaults', async () => {
    (globalThis as any).__pmTestReduxState.activeUserState = { activeUserEmail: 'other@universal.io' };
    renderUI(<OrganizationEdit />);
    press('organization-tab-projects');
    await wait(50);
    toggleSwitch('organization-project-plan-hour');
    expect(q('organization-save')).toBeNull();
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });
});
