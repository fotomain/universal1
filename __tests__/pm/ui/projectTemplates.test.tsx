/** @jest-environment jsdom */
import './pmUiTestKit';
import React, { act } from 'react';
import { cleanupUI, inputValue, press, q, renderUI, typeInto } from './pmUiTestKit';
import CreateTemplateFromProject from '../../../kit8/pm/view/project/CreateTemplateFromProject';
import CreateProjectFromTemplate from '../../../kit8/pm/view/project/CreateProjectFromTemplate';
import { usePMStore } from '../../../kit8/pm/store/store_pm';

const mockMutateTemplateAsync = jest.fn();
const mockMutateProjectAsync = jest.fn();

jest.mock('../../../kit8/pm/crud/template/templateQueries', () => ({
  useCreateTemplateFromProjectMutation: () => ({
    mutateAsync: mockMutateTemplateAsync,
    isPending: false,
  }),
  useCreateProjectFromTemplateMutation: () => ({
    mutateAsync: mockMutateProjectAsync,
    isPending: false,
  }),
  useReadTemplatesQuery: () => ({
    data: [
      {
        rowGUID: 'tpl-1',
        rowJSON: { name: 'Marketing Launch Template', notes: 'Marketing tasks template' },
      },
    ],
    isLoading: false,
  }),
}));

afterEach(() => {
  jest.clearAllMocks();
  cleanupUI();
});

describe('Project Templates UI Components', () => {
  beforeEach(() => {
    act(() => {
      usePMStore.setState({
        selectedProjectGUID: 'proj-1',
        projectOrder: ['proj-1'],
        projectsById: {
          'proj-1': {
            rowGUID: 'proj-1',
            rowJSON: { name: 'Alpha Project', notes: 'Alpha project notes' },
          } as any,
        },
      });
    });
  });

  describe('CreateTemplateFromProject', () => {
    it('renders with prefilled project name and handles submission', async () => {
      const onClose = jest.fn();
      const onCreated = jest.fn();
      mockMutateTemplateAsync.mockResolvedValueOnce({
        rowGUID: 'new-tpl-1',
        rowJSON: { name: 'Alpha Project Template' },
      });

      renderUI(
        <CreateTemplateFromProject
          visible
          onClose={onClose}
          ownerGUID="owner-1"
          sourceProjectGUID="proj-1"
          onCreated={onCreated}
        />
      );

      expect(q('pm-create-template-modal')).not.toBeNull();
      expect(inputValue('pm-template-name-input')).toBe('Alpha Project Template');

      typeInto('pm-template-name-input', 'Custom Alpha Template');
      press('pm-template-submit-btn');

      expect(mockMutateTemplateAsync).toHaveBeenCalledWith({
        sourceProjectGUID: 'proj-1',
        ownerGUID: 'owner-1',
        templateName: 'Custom Alpha Template',
        templateDescription: 'Alpha project notes',
      });
    });

    it('validates empty template name', () => {
      renderUI(
        <CreateTemplateFromProject
          visible
          onClose={jest.fn()}
          ownerGUID="owner-1"
          sourceProjectGUID="proj-1"
        />
      );

      typeInto('pm-template-name-input', '');
      press('pm-template-submit-btn');

      expect(mockMutateTemplateAsync).not.toHaveBeenCalled();
    });
  });

  describe('CreateProjectFromTemplate', () => {
    it('renders available templates and creates a project', async () => {
      const onClose = jest.fn();
      const onCreated = jest.fn();
      mockMutateProjectAsync.mockResolvedValueOnce({
        rowGUID: 'new-proj-2',
        rowJSON: { name: 'Marketing Launch' },
      });

      renderUI(
        <CreateProjectFromTemplate
          visible
          onClose={onClose}
          ownerGUID="owner-1"
          onCreated={onCreated}
        />
      );

      expect(q('pm-create-from-template-modal')).not.toBeNull();
      expect(inputValue('pm-new-project-name-input')).toBe('Marketing Launch');

      typeInto('pm-new-project-name-input', 'Brand Campaign 2027');
      press('pm-create-from-template-submit-btn');

      expect(mockMutateProjectAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          templateGUID: 'tpl-1',
          ownerGUID: 'owner-1',
          projectName: 'Brand Campaign 2027',
        })
      );
    });
  });
});
