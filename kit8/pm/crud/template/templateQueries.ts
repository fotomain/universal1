// React Query hooks for Project Templates (templates_project_* tables).
// List templates, read template details/data, create template from project,
// create project from template, and template CRUD mutations.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePMStore } from '../../store/store_pm';
import { PMProjectData, PMProjectRow } from '../../model/types';
import { errorMessage } from '../api/apiUtils';
import { pmKeys, usePMApi } from '../shared/queryShared';
import {
  CreateProjectFromTemplateParams,
  CreateTemplateFromProjectParams,
} from '../api/templateApi';

export function useReadTemplatesQuery(ownerGUID: string | null | undefined) {
  const api = usePMApi();
  return useQuery({
    queryKey: pmKeys.templates(ownerGUID),
    queryFn: () => api.readTemplates(ownerGUID as string),
    enabled: !!ownerGUID,
  });
}

export function useReadTemplateQuery(templateGUID: string | null | undefined) {
  const api = usePMApi();
  return useQuery({
    queryKey: pmKeys.template(templateGUID),
    queryFn: () => api.readTemplate(templateGUID as string),
    enabled: !!templateGUID,
  });
}

export function useReadTemplateDataQuery(templateGUID: string | null | undefined) {
  const api = usePMApi();
  return useQuery({
    queryKey: pmKeys.templateData(templateGUID),
    queryFn: () => api.readTemplateData(templateGUID as string),
    enabled: !!templateGUID,
  });
}

export function useCreateTemplateMutation(ownerGUID: string | null | undefined) {
  const api = usePMApi();
  const qc = useQueryClient();
  const setError = usePMStore((s) => s.setError);
  return useMutation({
    mutationFn: (row: PMProjectRow) => api.createTemplate(row),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pmKeys.templates(ownerGUID) });
    },
    onError: (err) => setError(errorMessage(err)),
  });
}

export function useUpdateTemplateMutation(ownerGUID: string | null | undefined) {
  const api = usePMApi();
  const qc = useQueryClient();
  const setError = usePMStore((s) => s.setError);
  return useMutation({
    mutationFn: ({ templateGUID, patch }: { templateGUID: string; patch: Partial<PMProjectRow> }) =>
      api.updateTemplate(templateGUID, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pmKeys.templates(ownerGUID) });
    },
    onError: (err) => setError(errorMessage(err)),
  });
}

export function useDeleteTemplateMutation(ownerGUID: string | null | undefined) {
  const api = usePMApi();
  const qc = useQueryClient();
  const setError = usePMStore((s) => s.setError);
  return useMutation({
    mutationFn: (templateGUID: string) => api.deleteTemplate(templateGUID),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pmKeys.templates(ownerGUID) });
    },
    onError: (err) => setError(errorMessage(err)),
  });
}

export function useCreateTemplateFromProjectMutation(ownerGUID: string | null | undefined) {
  const api = usePMApi();
  const qc = useQueryClient();
  const setError = usePMStore((s) => s.setError);
  return useMutation({
    mutationFn: (params: CreateTemplateFromProjectParams) =>
      api.createTemplateFromProject(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pmKeys.templates(ownerGUID) });
    },
    onError: (err) => setError(errorMessage(err)),
  });
}

export function useCreateProjectFromTemplateMutation(ownerGUID: string | null | undefined) {
  const api = usePMApi();
  const qc = useQueryClient();
  const setError = usePMStore((s) => s.setError);
  return useMutation({
    mutationFn: (params: CreateProjectFromTemplateParams) =>
      api.createProjectFromTemplate(params),
    onSuccess: (newProject) => {
      const s = usePMStore.getState();
      s.addRecentProject(newProject.rowGUID);
      s.selectProject(newProject.rowGUID);
      qc.invalidateQueries({ queryKey: pmKeys.projects(ownerGUID) });
      qc.invalidateQueries({ queryKey: pmKeys.projectData(newProject.rowGUID) });
    },
    onError: (err) => setError(errorMessage(err)),
  });
}
