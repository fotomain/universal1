// Commands + list of the task templates (documentation/TASK_TEMPLATE_WBS.html).
//   openSaveToTemplate(task)      "Save to template" of the task menus: opens the title window (plain functions: the menus need no providers)
//   openFillFromTemplate(task)    "Fill from template": opens the picker
//   openSavedTemplates(task)      "Templates saved": the list of the templates saved from this task
//   taskTemplatesSubmenu(...)     the submenu "Templates" of the task menus (the three items above)
//   useTaskTemplateCommands()     save · fill (asks first when it replaces) · rename · remove; refreshes the list / the project after it
//   useTaskTemplatesQuery()       the templates of the organization (newest first)

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../../../providers/WithSupabase';
import { appDispatch } from '../../../redux/storeRef';
import { showSnackbar } from '../../../redux/uxuiSlice';
import { usePMStore } from '../../store/store_pm';
import { errorMessage } from '../../crud/api/apiUtils';
import { pmKeys } from '../../crud/shared/queryShared';
import { approvePM } from '../../inner/PMApproveYesNoCancelModalWindow';
import type { PMMenuItemProps } from '../../inner/menu/PMMenuItem';
import { createTaskTemplateApi, PMTaskTemplateApi } from '../api/taskTemplateApi';
import { usePMTaskTemplateStore } from '../store/store_task_template';
import { defaultTaskTemplateTitle, fillResultMessage, PMTaskTemplateFillResult, PMTaskTemplateRow, validateTaskTemplateTitle } from '../model/taskTemplateTypes';

export const pmTaskTemplateKeys = {
  /** every template of the organization of the user */
  list: () => ['pm', 'taskTemplates'] as const,
};

export function usePMTaskTemplateApi(): PMTaskTemplateApi {
  const { supabase } = useSupabase();
  return useMemo(() => createTaskTemplateApi(supabase), [supabase]);
}

export function useTaskTemplatesQuery(enabled = true) {
  const api = usePMTaskTemplateApi();
  return useQuery({ queryKey: pmTaskTemplateKeys.list(), queryFn: () => api.readTaskTemplates(), enabled });
}

/** "Save to template": the title window, with the name of the task as the title. */
export function openSaveToTemplate(taskGUID: string): void {
  const task = usePMStore.getState().tasksById[taskGUID];
  usePMTaskTemplateStore.getState().setSavePrompt({ mode: 'save', taskGUID, title: defaultTaskTemplateTitle(task?.rowJSON?.taskDescription), description: '' });
}

/** "Fill from template": the picker of the templates of the organization. */
export function openFillFromTemplate(taskGUID: string): void {
  usePMTaskTemplateStore.getState().setFillPickerTaskGUID(taskGUID);
}

/** "Templates saved": the list of the templates saved from this task (rename / delete of your own). */
export function openSavedTemplates(taskGUID: string): void {
  usePMTaskTemplateStore.getState().setSavedListTaskGUID(taskGUID);
}

/** The submenu "Templates" of the task menus: Save to template… · Fill from template… · Templates saved. `close` closes the menu first. */
export function taskTemplatesSubmenu(idPrefix: string, taskGUID: string, close: () => void): PMMenuItemProps {
  const run = (fn: (g: string) => void) => () => { close(); fn(taskGUID); };
  return {
    testID: `${idPrefix}-templates`, label: 'Templates', icon: 'library_books', onPress: () => {},
    submenu: [
      { testID: `${idPrefix}-save-to-template`, label: 'Save to template…', icon: 'library_add', onPress: run(openSaveToTemplate) },
      { testID: `${idPrefix}-fill-from-template`, label: 'Fill from template…', icon: 'content_paste_go', onPress: run(openFillFromTemplate) },
      { testID: `${idPrefix}-templates-saved`, label: 'Templates saved', icon: 'collections_bookmark', onPress: run(openSavedTemplates) },
    ],
  };
}

const snack = (message: string) => appDispatch(showSnackbar({ message }));

export function useTaskTemplateCommands(ownerGUID: string, projectGUID: string | null) {
  const api = usePMTaskTemplateApi();
  const qc = useQueryClient();

  return useMemo(() => {
    const fail = (what: string, err: unknown) => usePMStore.getState().setError(`${what}: ${errorMessage(err)}`);
    const refreshList = () => qc.invalidateQueries({ queryKey: pmTaskTemplateKeys.list() });
    const busy = (b: boolean) => usePMTaskTemplateStore.getState().setBusy(b);
    const st = () => usePMTaskTemplateStore.getState();

    /** Stores the task and everything inside it. Returns the rowGUID of the template (null = failed). */
    const saveTemplate = async (taskGUID: string, title: string, description: string): Promise<string | null> => {
      busy(true);
      try {
        const guid = await api.saveTaskTemplate(taskGUID, title.trim(), description.trim());
        await refreshList();
        snack(`Saved as the template "${title.trim()}"`);
        return guid;
      } catch (err) {
        fail('Could not save the template', err);
        return null;
      } finally {
        busy(false);
      }
    };

    const renameTemplate = async (templateGUID: string, title: string, description: string): Promise<boolean> => {
      busy(true);
      try {
        await api.renameTaskTemplate(templateGUID, title.trim(), description.trim());
        await refreshList();
        return true;
      } catch (err) {
        fail('Could not rename the template', err);
        return false;
      } finally {
        busy(false);
      }
    };

    const removeTemplate = async (template: PMTaskTemplateRow): Promise<boolean> => {
      const ok = await approvePM({
        title: 'Delete this template?',
        message: `"${template.rowJSON.templateTitle}" is deleted for every user of the organization. The rows that were filled from it stay.`,
        yesLabel: 'Delete',
        destructive: true,
      });
      if (!ok) return false;
      busy(true);
      try {
        await api.deleteTaskTemplate(template.rowGUID);
        await refreshList();
        return true;
      } catch (err) {
        fail('Could not delete the template', err);
        return false;
      } finally {
        busy(false);
      }
    };

    /** Copies the template into the task. replace = deletes what the task has now first (asks first). Returns the result (null = cancelled / failed). */
    const fillTask = async (template: PMTaskTemplateRow, taskGUID: string, replace: boolean): Promise<PMTaskTemplateFillResult | null> => {
      if (replace) {
        const ok = await approvePM({
          title: 'Replace what the row has now?',
          message: `The lines and the rows inside "${usePMStore.getState().tasksById[taskGUID]?.rowJSON?.taskDescription ?? 'the row'}" are deleted and replaced by the template "${template.rowJSON.templateTitle}".`,
          yesLabel: 'Replace',
          destructive: true,
        });
        if (!ok) return null;
      }
      busy(true);
      try {
        const result = await api.fillFromTaskTemplate(template.rowGUID, taskGUID, replace);
        await Promise.all([
          qc.invalidateQueries({ queryKey: pmKeys.projects(ownerGUID) }),
          qc.invalidateQueries({ queryKey: ['pm', 'project'] }),
          qc.invalidateQueries({ queryKey: pmKeys.projectData(projectGUID) }),
          qc.invalidateQueries({ queryKey: ['pm', 'closure'] }),
          qc.invalidateQueries({ queryKey: ['pm', 'taskLines', projectGUID] }),
        ]);
        snack(fillResultMessage(result));
        return result;
      } catch (err) {
        fail('Could not fill from the template', err);
        return null;
      } finally {
        busy(false);
      }
    };

    return {
      saveTemplate,
      renameTemplate,
      removeTemplate,
      fillTask,
      /** the title window for a rename */
      openRename: (template: PMTaskTemplateRow) =>
        st().setSavePrompt({ mode: 'rename', templateGUID: template.rowGUID, title: template.rowJSON.templateTitle, description: template.rowJSON.templateDescription ?? '' }),
      closeSavePrompt: () => st().setSavePrompt(null),
      closeFillPicker: () => st().setFillPickerTaskGUID(null),
      closeSavedList: () => st().setSavedListTaskGUID(null),
      validateTitle: validateTaskTemplateTitle,
    };
  }, [api, qc, ownerGUID, projectGUID]);
}

export type PMTaskTemplateCommands = ReturnType<typeof useTaskTemplateCommands>;
