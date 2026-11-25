/** @jest-environment jsdom */
// EstimationProjectPicker: lists the projects of the active organization, makes a NEW project (default name that no project has) and hands its GUID to the dashboard.
import { act } from 'react';
import { cleanupUI, press, q, qa, renderUI, textOf, typeInto, wait } from '../ui/pmUiTestKit';

const mockCreate = jest.fn(async (_row: any) => ({}));
let mockProjects: any[] = [];
let mockCanCreate = true;
jest.mock('../../../kit8/pm/crud/queries', () => ({ usePMOwnerGUID: () => 'owner-1' }));
jest.mock('../../../kit8/pm/crud/project/projectQueries', () => ({
  useReadProjectsQuery: () => ({ data: mockProjects, isLoading: false }),
  useBuildProjectRow: () => (name: string) => ({ rowGUID: 'new-1', rowJSON: { name } }),
  useCreateProjectMutation: () => ({ mutateAsync: mockCreate }),
}));
jest.mock('../../../kit8/catalog/organization/switch/useActiveOrganizationGUID', () => ({ useActiveOrganizationGUID: () => 'org-1' }));
jest.mock('../../../kit8/catalog/organization/switch/organizationSwitchModel', () => ({ projectsOfOrganization: (l: any[]) => l }));
jest.mock('../../../kit8/catalog/organization/useMyOrganization', () => ({ useMyOrganization: () => ({ defaults: {} }) }));
jest.mock('../../../kit8/catalog/organization/defaultProjectSettings', () => ({ newProjectPatchFrom: () => ({ currencyForBudget: 'EUR' }) }));
jest.mock('../../../kit8/catalog/business_unit/useBusinessUnitData', () => ({ useBusinessUnitData: () => ({ rows: [], cfrRows: [] }) }));
jest.mock('../../../kit8/catalog/business_unit/businessUnitModel', () => ({ defaultProjectCenters: () => ({ centers: 1 }) }));
jest.mock('../../../kit8/permissions/usePermissions', () => ({ usePermissions: () => ({ canCreateProject: mockCanCreate }) }));

import React from 'react';
import EstimationProjectPicker, { suggestEstimationName } from '../../../kit8/pm/estimation/ui/EstimationProjectPicker';

beforeEach(() => { mockProjects = [{ rowGUID: 'a', rowJSON: { name: 'Hall 12' } }, { rowGUID: 'b', rowJSON: { name: 'Estimation' } }]; mockCanCreate = true; mockCreate.mockClear(); });
afterEach(() => cleanupUI());

test('suggestEstimationName skips the names that exist', () => {
  expect(suggestEstimationName([], 'Estimation')).toBe('Estimation');
  expect(suggestEstimationName(['estimation'], 'Estimation')).toBe('Estimation 2');
  expect(suggestEstimationName(['Estimation', 'Estimation 2'], 'Estimation')).toBe('Estimation 3');
});

test('lists the projects and picking one reports its GUID', () => {
  const onPicked = jest.fn();
  renderUI(<EstimationProjectPicker onPicked={onPicked} />);
  expect(qa('estimation-picker-project-').length).toBe(2);
  act(() => press('estimation-picker-project-a'));
  expect(onPicked).toHaveBeenCalledWith('a');
});

test('Create makes the project with the organization settings and reports the new GUID', async () => {
  const onPicked = jest.fn();
  renderUI(<EstimationProjectPicker onPicked={onPicked} />);
  act(() => typeInto('estimation-picker-name', 'Tower'));
  await act(async () => { press('estimation-picker-create'); await wait(10); });
  expect(mockCreate).toHaveBeenCalledTimes(1);
  const row = mockCreate.mock.calls[0][0];
  expect(row.rowJSON).toMatchObject({ name: 'Tower', currencyForBudget: 'EUR', centers: 1, projectBusinessUnitsRequired: true });
  expect(onPicked).toHaveBeenCalledWith('new-1');
});

test('a failed create shows the error and does not pick', async () => {
  mockCreate.mockRejectedValueOnce(new Error('boom'));
  const onPicked = jest.fn();
  renderUI(<EstimationProjectPicker onPicked={onPicked} />);
  await act(async () => { press('estimation-picker-create'); await wait(10); });
  expect(textOf('estimation-picker-error')).toBe('boom');
  expect(onPicked).not.toHaveBeenCalled();
});

test('without the right to create projects the button is disabled and the reason is shown', () => {
  mockCanCreate = false;
  renderUI(<EstimationProjectPicker onPicked={jest.fn()} />);
  expect(q('estimation-picker-no-right')).toBeTruthy();
});
