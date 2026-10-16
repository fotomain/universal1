/** @jest-environment jsdom */
// Organization default project settings (kit8/catalog/organization/defaultProjectSettings.ts) in the Project settings window:
//   * a NEW project starts from organization.rowJSON.defaultProjectSettings (nothing stored = as before)
//   * the three dots menu "Save settings to organization" saves the values of the window
import React, { act } from 'react';
import { cleanupUI, OWNER, press, q, renderUI, seedStore, toggleSwitch } from './pmUiTestKit';

const mockCreate = jest.fn();
jest.mock('../../../kit8/pm/crud/queries', () => ({
  useBuildProjectRow: () => (name: string, startMs?: number) => ({
    rowGUID: '99999999-9999-4999-8999-999999999999',
    treePath: 'x',
    rowOwnerGUID: '11111111-1111-4111-8111-111111111111',
    rowDuration: null,
    rowProgress: 0,
    orderInList: 9999,
    rowJSON: { rowKind: 'project', name, durationDays: 0, projectStartAt: new Date(startMs ?? 0).toISOString() },
  }),
  useCreateProjectMutation: () => ({ mutate: mockCreate }),
  useUpdateProjectMutation: () => ({ mutate: jest.fn() }),
  useDeleteProjectMutation: () => ({ mutate: jest.fn() }),
  useProjectSearchQuery: () => ({ data: undefined, isFetching: false }),
  useSaveProjectUserSettings: () => ({ saveUxuiSettings: jest.fn(), isSaving: false }),
}));

jest.mock('../../../kit8/pm/crud/exchange/project/ImportExportProject', () => {
  const R = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: () => R.createElement(View, { testID: 'pm-project-exchange' }) };
});
jest.mock('../../../kit8/pm/view/kanban/PMKanbanStagesModalWindow', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../kit8/redux/reusable/useRealtimeEntity', () => ({ useRealtimeEntity: jest.fn() }));

// the organization of the user: what it stored, and what "save" does
let mockDefaults: any = null;
let mockOrgGUID = 'org-1';
const mockSaveDefaults = jest.fn();
jest.mock('../../../kit8/catalog/organization/useMyOrganization', () => ({
  useMyOrganization: () => ({
    organizationGUID: mockOrgGUID,
    defaults: mockDefaults,
    loaded: true,
    saveDefaultProjectSettings: mockSaveDefaults,
  }),
}));

const mockAppDispatch = jest.fn();
/** the snackbar actions (the window also publishes uxui.currentJSON through the same dispatch) */
const snackbars = () => mockAppDispatch.mock.calls.map((c) => c[0]).filter((a: any) => /showSnackbar/.test(String(a?.type)));
jest.mock('../../../kit8/redux/storeRef', () => ({ appDispatch: (a: any) => mockAppDispatch(a), getUxuiState: () => ({}) }));

import PMRecentProjectsToolbar from '../../../kit8/pm/view/project/recent/PMRecentProjectsToolbar';

const switchChecked = (testID: string): boolean => {
  const el = q(testID)!;
  const input = (el.tagName === 'INPUT' ? el : el.querySelector('input')) as HTMLInputElement;
  return input.checked;
};

describe('Project settings window - organization default project settings', () => {
  beforeEach(() => {
    mockDefaults = null;
    mockOrgGUID = 'org-1';
    mockSaveDefaults.mockReset().mockResolvedValue({ ok: true });
    mockAppDispatch.mockClear();
    mockCreate.mockClear();
  });
  afterEach(() => cleanupUI());

  const openNewWindow = () => {
    press('pm-project-add');
    press('pm-project-add-menu-new');
    expect(q('pm-project-settings-window')).not.toBeNull();
  };

  it('a new project starts with the organization defaults (plan in hours, skip weekends)', () => {
    mockDefaults = { planHour: true, skipWeekends: true };
    seedStore();
    renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    openNewWindow();
    expect(switchChecked('pm-project-weekends')).toBe(true);
    press('pm-project-tab-TabUXUI');
    expect(switchChecked('pm-project-plan-hour')).toBe(true);
    expect(switchChecked('pm-project-plan-day')).toBe(true); // not stored = the default of the setting
  });

  it('an organization that never saved defaults changes nothing', () => {
    seedStore();
    renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    openNewWindow();
    expect(switchChecked('pm-project-weekends')).toBe(false);
    press('pm-project-tab-TabUXUI');
    expect(switchChecked('pm-project-plan-hour')).toBe(false);
  });

  it('the three dots menu saves the values of the window to the organization', async () => {
    seedStore();
    renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    press('pm-project-edit');
    press('pm-project-tab-TabUXUI');
    toggleSwitch('pm-project-plan-hour'); // an UNSAVED edit of the window is what is saved
    press('pm-project-settings-menu');
    expect(q('pm-project-settings-menu-popup')).not.toBeNull();
    await act(async () => {
      press('pm-project-settings-save-to-organization');
    });
    expect(mockSaveDefaults).toHaveBeenCalledTimes(1);
    const saved = mockSaveDefaults.mock.calls[0][0];
    expect(saved.planHour).toBe(true);
    expect('name' in saved).toBe(false);
    // the menu closes and the user is told
    expect(q('pm-project-settings-menu-popup')).toBeNull();
    expect(snackbars()).toHaveLength(1);
  });

  it('a refusal (not the administrator) is told, not hidden', async () => {
    mockSaveDefaults.mockResolvedValue({ ok: false, error: 'Only the administrator' });
    seedStore();
    renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    press('pm-project-edit');
    press('pm-project-settings-menu');
    await act(async () => {
      press('pm-project-settings-save-to-organization');
    });
    expect(JSON.stringify(snackbars())).toContain('Only the administrator');
  });

  it('the menu item is disabled without an organization', () => {
    mockOrgGUID = '';
    seedStore();
    renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    press('pm-project-edit');
    press('pm-project-settings-menu');
    expect(q('pm-project-settings-save-to-organization')?.getAttribute('aria-disabled')).toBe('true');
  });
});
