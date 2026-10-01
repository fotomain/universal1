// Supabase CRUD for project templates (templates_project_* tables).
// Supports:
//   - List, read, create, update, delete templates (templates_project_table)
//   - Create template from an existing project (copies project, tasks, dependencies, closure, stages, settings; excludes task stages)
//   - Create new project from a template (remapping IDs, shifting dates by deltaMs)
//   - Editing template tasks, dependencies, stages, and settings like a real project (excluding task kanban stages)

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  projectKanbanStageTable,
  projectTable,
  projectTaskDependenciesTable,
  projectTaskDependencyClosureTable,
  projectTaskTable,
  projectUserSettingsTable,
  templatesProjectKanbanStageTable,
  templatesProjectTable,
  templatesProjectTaskDependenciesTable,
  templatesProjectTaskDependencyClosureTable,
  templatesProjectTaskTable,
  templatesProjectUserSettingsTable,
} from '../../model/constants';
import {
  PMDependencyJSON,
  PMProjectData,
  PMProjectRow,
  PMRowJSON,
  PMTaskDependencyClosureRow,
  PMTaskDependencyRow,
  PMTaskRow,
} from '../../model/types';
import { PMProjectKanbanStageRow } from '../../model/kanbanTypes';
import { projectTreePath, toLtreeLabel, todayUTC } from '../../view/project/scheduling';
import { check, newGUID, normalizeDep, normalizeProject, normalizeTask } from './apiUtils';
import { PMDependencyPatch } from './dependencyApi';

export interface CreateTemplateFromProjectParams {
  sourceProjectGUID: string;
  ownerGUID: string;
  templateName: string;
  templateDescription?: string;
}

export interface CreateProjectFromTemplateParams {
  templateGUID: string;
  ownerGUID: string;
  projectName: string;
  startMs?: number;
}

function shiftIso(isoStr: string | null | undefined, deltaMs: number): string | null {
  if (!isoStr) return null;
  const parsed = Date.parse(isoStr);
  if (isNaN(parsed)) return isoStr;
  return new Date(parsed + deltaMs).toISOString();
}

export function createTemplateApi(sb: SupabaseClient) {
  // ---- Templates CRUD (templates_project_table) -----------------------------------

  /** Read all templates of an owner, ordered by orderInList. */
  async function readTemplates(ownerGUID: string): Promise<PMProjectRow[]> {
    const data = check(
      await sb
        .from(templatesProjectTable)
        .select('*')
        .eq('rowOwnerGUID', ownerGUID)
        .order('orderInList', { ascending: true })
    );
    return (data || []).map(normalizeProject);
  }

  /** Read one template by id. */
  async function readTemplate(templateGUID: string): Promise<PMProjectRow | null> {
    const data = check(
      await sb.from(templatesProjectTable).select('*').eq('rowGUID', templateGUID).maybeSingle()
    );
    return data ? normalizeProject(data) : null;
  }

  /** Insert one template. */
  async function createTemplate(row: PMProjectRow): Promise<PMProjectRow> {
    const data = check(await sb.from(templatesProjectTable).insert(row).select().single());
    return normalizeProject(data);
  }

  /** Update template metadata (name, description, etc.). */
  async function updateTemplate(
    templateGUID: string,
    patch: Partial<PMProjectRow>
  ): Promise<PMProjectRow> {
    const { rowGUID: _g, treePath: _p, created_at: _c, updated_at: _u, ...safe } = patch as any;
    const data = check(
      await sb.from(templatesProjectTable).update(safe).eq('rowGUID', templateGUID).select().single()
    );
    return normalizeProject(data);
  }

  /** Delete template (cascades to all template tasks, deps, stages, settings). */
  async function deleteTemplate(templateGUID: string): Promise<void> {
    check(await sb.from(templatesProjectTable).delete().eq('rowGUID', templateGUID));
  }

  // ---- Template Tasks & Dependencies CRUD -----------------------------------------

  /** Everything a template Gantt needs: tasks (ordered) + dependencies. */
  async function readTemplateData(templateGUID: string): Promise<PMProjectData> {
    const [tasksRes, depsRes] = await Promise.all([
      sb
        .from(templatesProjectTaskTable)
        .select('*')
        .eq('projectGUID', templateGUID)
        .order('orderInList', { ascending: true }),
      sb.from(templatesProjectTaskDependenciesTable).select('*').eq('projectGUID', templateGUID),
    ]);
    return {
      tasks: (check(tasksRes) || []).map(normalizeTask),
      deps: (check(depsRes) || []).map(normalizeDep),
    };
  }

  async function createTemplateTasks(rows: PMTaskRow[]): Promise<PMTaskRow[]> {
    if (!rows.length) return [];
    const clean = rows.map(({ created_at: _c, updated_at: _u, ...r }) => r);
    const data = check(await sb.from(templatesProjectTaskTable).insert(clean).select());
    return (data || []).map(normalizeTask);
  }

  async function createTemplateTask(row: PMTaskRow): Promise<PMTaskRow> {
    const [created] = await createTemplateTasks([row]);
    return created;
  }

  async function updateTemplateTask(
    taskGUID: string,
    patch: Partial<PMTaskRow>
  ): Promise<PMTaskRow> {
    const { rowGUID: _g, projectGUID: _p, created_at: _c, updated_at: _u, ...safe } = patch as any;
    const data = check(
      await sb
        .from(templatesProjectTaskTable)
        .update(safe)
        .eq('rowGUID', taskGUID)
        .select()
        .single()
    );
    return normalizeTask(data);
  }

  async function deleteTemplateTask(taskGUID: string): Promise<void> {
    check(await sb.from(templatesProjectTaskTable).delete().eq('rowGUID', taskGUID));
  }

  async function createTemplateDependencies(
    rows: PMTaskDependencyRow[]
  ): Promise<PMTaskDependencyRow[]> {
    if (!rows.length) return [];
    const clean = rows.map(({ created_at: _c, ...r }) => r);
    const data = check(await sb.from(templatesProjectTaskDependenciesTable).insert(clean).select());
    return (data || []).map(normalizeDep);
  }

  async function createTemplateDependency(
    row: PMTaskDependencyRow
  ): Promise<PMTaskDependencyRow> {
    const [created] = await createTemplateDependencies([row]);
    return created;
  }

  async function updateTemplateDependency(
    rowGUID: string,
    dependsOnGUID: string,
    patch: PMDependencyPatch
  ): Promise<void> {
    const safe: PMDependencyPatch = {};
    if (patch.linkType !== undefined) safe.linkType = patch.linkType;
    if (patch.lagDays !== undefined) safe.lagDays = patch.lagDays;
    if (patch.rowJSON !== undefined) safe.rowJSON = patch.rowJSON;
    check(
      await sb
        .from(templatesProjectTaskDependenciesTable)
        .update(safe)
        .eq('rowGUID', rowGUID)
        .eq('rowDependsOnGUID', dependsOnGUID)
    );
  }

  async function deleteTemplateDependency(
    rowGUID: string,
    dependsOnGUID: string
  ): Promise<void> {
    check(
      await sb
        .from(templatesProjectTaskDependenciesTable)
        .delete()
        .eq('rowGUID', rowGUID)
        .eq('rowDependsOnGUID', dependsOnGUID)
    );
  }

  // ---- Template Kanban Stages CRUD (templates_project_kanban_stage_table) ----------

  async function readTemplateKanbanStages(templateGUID: string): Promise<PMProjectKanbanStageRow[]> {
    const res = await sb
      .from(templatesProjectKanbanStageTable)
      .select('*')
      .eq('rowOwnerGUID', templateGUID)
      .order('orderInList', { ascending: true });
    return (check(res) || []).map((r: any) => ({
      ...r,
      orderInList: Number(r.orderInList) || 0,
      rowJSON: { stageName: '', ...(r.rowJSON || {}) },
    }));
  }

  async function createTemplateKanbanStage(
    stage: Partial<PMProjectKanbanStageRow>
  ): Promise<PMProjectKanbanStageRow> {
    const row = {
      rowGUID: stage.rowGUID || newGUID(),
      rowOwnerGUID: stage.rowOwnerGUID,
      rowParentGUID: stage.rowParentGUID || 'empty',
      orderInList: stage.orderInList ?? 0,
      rowJSON: stage.rowJSON || {},
    };
    const data = check(
      await sb.from(templatesProjectKanbanStageTable).insert(row).select().single()
    );
    return {
      ...data,
      orderInList: Number(data.orderInList) || 0,
      rowJSON: { stageName: '', ...(data.rowJSON || {}) },
    };
  }

  async function updateTemplateKanbanStage(
    stageGUID: string,
    patch: Partial<PMProjectKanbanStageRow>
  ): Promise<PMProjectKanbanStageRow> {
    const { rowGUID: _g, rowOwnerGUID: _o, created_at: _c, updated_at: _u, ...safe } = patch as any;
    const data = check(
      await sb
        .from(templatesProjectKanbanStageTable)
        .update(safe)
        .eq('rowGUID', stageGUID)
        .select()
        .single()
    );
    return {
      ...data,
      orderInList: Number(data.orderInList) || 0,
      rowJSON: { stageName: '', ...(data.rowJSON || {}) },
    };
  }

  async function deleteTemplateKanbanStage(stageGUID: string): Promise<void> {
    check(await sb.from(templatesProjectKanbanStageTable).delete().eq('rowGUID', stageGUID));
  }

  // ---- Template User Settings CRUD (templates_project_user_settings_table) --------

  async function readTemplateUserSettings(templateGUID: string, userGUID: string): Promise<any | null> {
    const data = check(
      await sb
        .from(templatesProjectUserSettingsTable)
        .select('*')
        .eq('rowOwnerGUID', templateGUID)
        .eq('rowParentGUID', userGUID)
        .maybeSingle()
    );
    return data ? data.rowJSON?.uxuiSettings ?? null : null;
  }

  async function updateTemplateUserSettings(
    templateGUID: string,
    userGUID: string,
    uxuiSettings: any
  ): Promise<void> {
    check(
      await sb.from(templatesProjectUserSettingsTable).upsert(
        {
          rowOwnerGUID: templateGUID,
          rowParentGUID: userGUID,
          orderInList: 0,
          rowJSON: { uxuiSettings },
        },
        { onConflict: 'rowOwnerGUID,rowParentGUID' }
      )
    );
  }

  // ---- High-level copy operations -------------------------------------------------

  /**
   * Creates a new project template from an existing project.
   * Copies project, tasks, dependencies, closure, stages, and user settings.
   * Excludes task kanban stage values (per specification).
   */
  async function createTemplateFromProject(
    params: CreateTemplateFromProjectParams
  ): Promise<PMProjectRow> {
    const { sourceProjectGUID, ownerGUID, templateName, templateDescription } = params;

    // 1. Fetch source data in parallel
    const [
      sourceProjectRes,
      tasksRes,
      depsRes,
      closureRes,
      stagesRes,
      settingsRes,
    ] = await Promise.all([
      sb.from(projectTable).select('*').eq('rowGUID', sourceProjectGUID).single(),
      sb
        .from(projectTaskTable)
        .select('*')
        .eq('projectGUID', sourceProjectGUID)
        .order('orderInList', { ascending: true }),
      sb.from(projectTaskDependenciesTable).select('*').eq('projectGUID', sourceProjectGUID),
      sb.from(projectTaskDependencyClosureTable).select('*').eq('projectGUID', sourceProjectGUID),
      sb.from(projectKanbanStageTable).select('*').eq('rowOwnerGUID', sourceProjectGUID),
      sb.from(projectUserSettingsTable).select('*').eq('rowOwnerGUID', sourceProjectGUID),
    ]);

    const sourceProject: PMProjectRow = check(sourceProjectRes);
    const sourceTasks: PMTaskRow[] = check(tasksRes) || [];
    const sourceDeps: PMTaskDependencyRow[] = check(depsRes) || [];
    const sourceClosure: PMTaskDependencyClosureRow[] = check(closureRes) || [];
    const sourceStages: any[] = check(stagesRes) || [];
    const sourceSettings: any[] = check(settingsRes) || [];

    // 2. Insert template project row
    const templateGUID = newGUID();
    const templateProjectRow: PMProjectRow = {
      rowGUID: templateGUID,
      treePath: projectTreePath(templateGUID),
      rowOwnerGUID: ownerGUID,
      rowDuration: sourceProject.rowDuration,
      rowProgress: sourceProject.rowProgress || 0,
      orderInList: sourceProject.orderInList || 0,
      rowJSON: {
        ...sourceProject.rowJSON,
        name: templateName,
        notes: templateDescription || sourceProject.rowJSON?.notes || '',
      },
    };

    const createdTemplate = check(
      await sb.from(templatesProjectTable).insert(templateProjectRow).select().single()
    );

    // 3. Remap task IDs & treePaths
    const taskGuidMap = new Map<string, string>();
    const labelMap = new Map<string, string>();
    labelMap.set(toLtreeLabel(sourceProjectGUID), toLtreeLabel(templateGUID));

    for (const t of sourceTasks) {
      const newId = newGUID();
      taskGuidMap.set(t.rowGUID, newId);
      labelMap.set(toLtreeLabel(t.rowGUID), toLtreeLabel(newId));
    }

    // Sort tasks by tree depth so parents are created before children
    const sortedTasks = [...sourceTasks].sort(
      (a, b) => a.treePath.split('.').length - b.treePath.split('.').length
    );

    const templateTasks = sortedTasks.map((t) => {
      const newId = taskGuidMap.get(t.rowGUID)!;
      const newTreePath = t.treePath
        .split('.')
        .map((part) => labelMap.get(part) || part)
        .join('.');
      return {
        rowGUID: newId,
        treePath: newTreePath,
        projectGUID: templateGUID,
        rowOwnerGUID: ownerGUID,
        rowDuration: t.rowDuration,
        rowProgress: t.rowProgress || 0,
        orderInList: t.orderInList,
        rowJSON: { ...t.rowJSON },
      };
    });

    if (templateTasks.length > 0) {
      check(await sb.from(templatesProjectTaskTable).insert(templateTasks));
    }

    // 4. Remap dependencies
    const templateDeps = sourceDeps
      .map((d) => {
        const rowGUID = taskGuidMap.get(d.rowGUID);
        const rowDependsOnGUID = taskGuidMap.get(d.rowDependsOnGUID);
        if (!rowGUID || !rowDependsOnGUID) return null;
        return {
          rowGUID,
          rowDependsOnGUID,
          projectGUID: templateGUID,
          rowOwnerGUID: ownerGUID,
          linkType: d.linkType || 'FS',
          lagDays: d.lagDays || 0,
          rowJSON: d.rowJSON || {},
        };
      })
      .filter(Boolean);

    if (templateDeps.length > 0) {
      check(await sb.from(templatesProjectTaskDependenciesTable).insert(templateDeps));
    }

    // 5. Remap closure
    const templateClosure = sourceClosure
      .map((c) => {
        const ancestorGUID = taskGuidMap.get(c.ancestorGUID);
        const descendantGUID = taskGuidMap.get(c.descendantGUID);
        if (!ancestorGUID || !descendantGUID) return null;
        return {
          ancestorGUID,
          descendantGUID,
          projectGUID: templateGUID,
          depthLevel: c.depthLevel,
          rowJSON: c.rowJSON || {},
        };
      })
      .filter(Boolean);

    if (templateClosure.length > 0) {
      try {
        await sb.from(templatesProjectTaskDependencyClosureTable).insert(templateClosure);
      } catch {
        // Closure triggers may auto-populate or handle this
      }
    }

    // 6. Copy Kanban stages
    const templateStages = sourceStages.map((s) => ({
      rowGUID: newGUID(),
      rowOwnerGUID: templateGUID,
      rowParentGUID: s.rowParentGUID || 'empty',
      orderInList: s.orderInList || 0,
      rowJSON: s.rowJSON || {},
    }));

    if (templateStages.length > 0) {
      check(await sb.from(templatesProjectKanbanStageTable).insert(templateStages));
    }

    // 7. Copy user settings
    const templateSettings = sourceSettings.map((s) => ({
      rowGUID: newGUID(),
      rowOwnerGUID: templateGUID,
      rowParentGUID: s.rowParentGUID,
      orderInList: s.orderInList || 0,
      rowJSON: s.rowJSON || {},
    }));

    if (templateSettings.length > 0) {
      check(await sb.from(templatesProjectUserSettingsTable).insert(templateSettings));
    }

    return normalizeProject(createdTemplate);
  }

  /**
   * Creates a new Project from an existing Project Template.
   * Copies template project, tasks, dependencies, closure, stages, and user settings.
   * Shifts task/project start and finish dates by deltaMs (targetStartMs - templateStartMs).
   * Does NOT populate task kanban stages (per specification).
   */
  async function createProjectFromTemplate(
    params: CreateProjectFromTemplateParams
  ): Promise<PMProjectRow> {
    const { templateGUID, ownerGUID, projectName, startMs } = params;

    // 1. Fetch template data
    const [
      templateProjectRes,
      tasksRes,
      depsRes,
      closureRes,
      stagesRes,
      settingsRes,
    ] = await Promise.all([
      sb.from(templatesProjectTable).select('*').eq('rowGUID', templateGUID).single(),
      sb
        .from(templatesProjectTaskTable)
        .select('*')
        .eq('projectGUID', templateGUID)
        .order('orderInList', { ascending: true }),
      sb.from(templatesProjectTaskDependenciesTable).select('*').eq('projectGUID', templateGUID),
      sb.from(templatesProjectTaskDependencyClosureTable).select('*').eq('projectGUID', templateGUID),
      sb.from(templatesProjectKanbanStageTable).select('*').eq('rowOwnerGUID', templateGUID),
      sb.from(templatesProjectUserSettingsTable).select('*').eq('rowOwnerGUID', templateGUID),
    ]);

    const templateProject: PMProjectRow = check(templateProjectRes);
    const templateTasks: PMTaskRow[] = check(tasksRes) || [];
    const templateDeps: PMTaskDependencyRow[] = check(depsRes) || [];
    const templateClosure: PMTaskDependencyClosureRow[] = check(closureRes) || [];
    const templateStages: any[] = check(stagesRes) || [];
    const templateSettings: any[] = check(settingsRes) || [];

    const targetStartMs = startMs ?? todayUTC();
    const templateStartMs = templateProject.rowJSON?.projectStartAt
      ? Date.parse(templateProject.rowJSON.projectStartAt)
      : targetStartMs;
    const deltaMs = isNaN(templateStartMs) ? 0 : targetStartMs - templateStartMs;

    // 2. Insert new project
    const newProjectGUID = newGUID();
    const newProjectRow: PMProjectRow = {
      rowGUID: newProjectGUID,
      treePath: projectTreePath(newProjectGUID),
      rowOwnerGUID: ownerGUID,
      rowDuration: shiftIso(templateProject.rowDuration, deltaMs),
      rowProgress: 0,
      orderInList: templateProject.orderInList || 0,
      rowJSON: {
        ...templateProject.rowJSON,
        name: projectName,
        projectStartAt: new Date(targetStartMs).toISOString(),
      },
    };

    const createdProject = check(
      await sb.from(projectTable).insert(newProjectRow).select().single()
    );

    // 3. Remap tasks & shift dates
    const taskGuidMap = new Map<string, string>();
    const labelMap = new Map<string, string>();
    labelMap.set(toLtreeLabel(templateGUID), toLtreeLabel(newProjectGUID));

    for (const t of templateTasks) {
      const newId = newGUID();
      taskGuidMap.set(t.rowGUID, newId);
      labelMap.set(toLtreeLabel(t.rowGUID), toLtreeLabel(newId));
    }

    const sortedTasks = [...templateTasks].sort(
      (a, b) => a.treePath.split('.').length - b.treePath.split('.').length
    );

    const newTasks = sortedTasks.map((t) => {
      const newId = taskGuidMap.get(t.rowGUID)!;
      const newTreePath = t.treePath
        .split('.')
        .map((part) => labelMap.get(part) || part)
        .join('.');

      const shiftedRowJSON: PMRowJSON = {
        ...t.rowJSON,
        startAt: shiftIso(t.rowJSON?.startAt, deltaMs),
        manualStartAt: shiftIso(t.rowJSON?.manualStartAt, deltaMs),
      };

      return {
        rowGUID: newId,
        treePath: newTreePath,
        projectGUID: newProjectGUID,
        rowOwnerGUID: ownerGUID,
        rowDuration: shiftIso(t.rowDuration, deltaMs),
        rowProgress: 0,
        orderInList: t.orderInList,
        rowJSON: shiftedRowJSON,
      };
    });

    if (newTasks.length > 0) {
      check(await sb.from(projectTaskTable).insert(newTasks));
    }

    // 4. Remap dependencies
    const newDeps = templateDeps
      .map((d) => {
        const rowGUID = taskGuidMap.get(d.rowGUID);
        const rowDependsOnGUID = taskGuidMap.get(d.rowDependsOnGUID);
        if (!rowGUID || !rowDependsOnGUID) return null;
        return {
          rowGUID,
          rowDependsOnGUID,
          projectGUID: newProjectGUID,
          rowOwnerGUID: ownerGUID,
          linkType: d.linkType || 'FS',
          lagDays: d.lagDays || 0,
          rowJSON: d.rowJSON || {},
        };
      })
      .filter(Boolean);

    if (newDeps.length > 0) {
      check(await sb.from(projectTaskDependenciesTable).insert(newDeps));
    }

    // 5. Remap closure
    const newClosure = templateClosure
      .map((c) => {
        const ancestorGUID = taskGuidMap.get(c.ancestorGUID);
        const descendantGUID = taskGuidMap.get(c.descendantGUID);
        if (!ancestorGUID || !descendantGUID) return null;
        return {
          ancestorGUID,
          descendantGUID,
          projectGUID: newProjectGUID,
          depthLevel: c.depthLevel,
          rowJSON: c.rowJSON || {},
        };
      })
      .filter(Boolean);

    if (newClosure.length > 0) {
      try {
        await sb.from(projectTaskDependencyClosureTable).insert(newClosure);
      } catch {
        // Handled by triggers if present
      }
    }

    // 6. Copy Kanban stages to project
    const newStages = templateStages.map((s) => ({
      rowGUID: newGUID(),
      rowOwnerGUID: newProjectGUID,
      rowParentGUID: s.rowParentGUID || 'empty',
      orderInList: s.orderInList || 0,
      rowJSON: s.rowJSON || {},
    }));

    if (newStages.length > 0) {
      check(await sb.from(projectKanbanStageTable).insert(newStages));
    }

    // 7. Copy user settings to project
    const newSettings = templateSettings.map((s) => ({
      rowGUID: newGUID(),
      rowOwnerGUID: newProjectGUID,
      rowParentGUID: s.rowParentGUID || ownerGUID,
      orderInList: s.orderInList || 0,
      rowJSON: s.rowJSON || {},
    }));

    if (newSettings.length > 0) {
      check(await sb.from(projectUserSettingsTable).insert(newSettings));
    }

    return normalizeProject(createdProject);
  }

  return {
    // Template project CRUD
    readTemplates,
    readTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    // Template tasks & deps CRUD
    readTemplateData,
    createTemplateTask,
    createTemplateTasks,
    updateTemplateTask,
    deleteTemplateTask,
    createTemplateDependency,
    createTemplateDependencies,
    updateTemplateDependency,
    deleteTemplateDependency,
    // Template kanban stages
    readTemplateKanbanStages,
    createTemplateKanbanStage,
    updateTemplateKanbanStage,
    deleteTemplateKanbanStage,
    // Template user settings
    readTemplateUserSettings,
    updateTemplateUserSettings,
    // High-level copy operations
    createTemplateFromProject,
    createProjectFromTemplate,
  };
}

export type PMTemplateApi = ReturnType<typeof createTemplateApi>;
