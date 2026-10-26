// Supabase access for the task templates (task_template_* tables + RPCs, SQL PART 40).
// A template is written ONLY by the RPCs (one transaction each); a client reads the headers and may delete one (RLS: the creator or the administrator of the organization).
// Until the SQL has run the tables / functions are missing: reads answer { missing: true }, writes throw PMMissingTableError.

import type { SupabaseClient } from '@supabase/supabase-js';
import { check } from '../../crud/api/apiUtils';
import { isMissingTableError, PMMissingTableError } from '../../crud/api/projectUserSettingsApi';
import { isMissingFunctionError } from '../../version/crud/api/versionApi';
import {
  normalizeFillResult,
  normalizeTaskTemplate,
  pmRpcTaskTemplateFill,
  pmRpcTaskTemplateSave,
  pmRpcTaskTemplateSetTitle,
  PMTaskTemplateFillResult,
  PMTaskTemplateRow,
  taskTemplateHeaderTable,
} from '../model/taskTemplateTypes';

export function createTaskTemplateApi(sb: SupabaseClient) {
  async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const res = await sb.rpc(fn, args);
    if (res.error && isMissingFunctionError(res.error, fn)) throw new PMMissingTableError(taskTemplateHeaderTable);
    return check(res) as T;
  }

  /** Every template of the organization of the user (newest first). */
  async function readTaskTemplates(): Promise<{ rows: PMTaskTemplateRow[]; missing: boolean }> {
    const res = await sb.from(taskTemplateHeaderTable).select('*').order('created_at', { ascending: false });
    if (res.error && isMissingTableError(res.error, taskTemplateHeaderTable)) return { rows: [], missing: true };
    return { rows: ((check(res) as any[]) || []).map(normalizeTaskTemplate), missing: false };
  }

  /** Saves the task and everything inside it as a template -> its rowGUID. */
  async function saveTaskTemplate(taskGUID: string, title: string, description?: string): Promise<string> {
    return String(await rpc<string>(pmRpcTaskTemplateSave, { p_task: taskGUID, p_title: title, p_description: description ?? null }));
  }

  /** Copies the template into the task (new ids). replace = the lines / rows the task has now are deleted first. */
  async function fillFromTaskTemplate(templateGUID: string, taskGUID: string, replace: boolean): Promise<PMTaskTemplateFillResult> {
    return normalizeFillResult(await rpc<unknown>(pmRpcTaskTemplateFill, { p_template: templateGUID, p_task: taskGUID, p_replace: replace }));
  }

  async function renameTaskTemplate(templateGUID: string, title: string, description?: string): Promise<void> {
    await rpc<null>(pmRpcTaskTemplateSetTitle, { p_template: templateGUID, p_title: title, p_description: description ?? null });
  }

  /** Deletes the template; its rows follow (FK cascade). Rows that were filled from it stay. */
  async function deleteTaskTemplate(templateGUID: string): Promise<void> {
    check(await sb.from(taskTemplateHeaderTable).delete().eq('rowGUID', templateGUID));
  }

  return { readTaskTemplates, saveTaskTemplate, fillFromTaskTemplate, renameTaskTemplate, deleteTaskTemplate };
}

export type PMTaskTemplateApi = ReturnType<typeof createTaskTemplateApi>;
