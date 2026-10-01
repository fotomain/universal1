import { createPMApi } from '../../../../kit8/pm/crud/api/api_pm';
import { buildDemoData } from '../../../../kit8/pm/model/seedDemo';
import { createFakeSupabase } from '../fakeSupabaseTestKit';

const OWNER = '11111111-1111-4111-8111-111111111111';

function setup() {
  const db = createFakeSupabase();
  let n = 0;
  const demo = buildDemoData(
    OWNER,
    Date.UTC(2026, 8, 28),
    () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
  );
  db.seed('project_table', demo.projects);
  db.seed('project_task_table', demo.tasks);
  db.seed(
    'project_task_dependencies_table',
    demo.deps.map((d) => ({ ...d, rowJSON: {} }))
  );
  db.seed('project_kanban_stage_table', [
    {
      rowGUID: 'stage-1',
      rowOwnerGUID: demo.projects[0].rowGUID,
      rowParentGUID: 'empty',
      orderInList: 1,
      rowJSON: { stageName: 'To Do' },
    },
  ]);
  db.seed('project_user_settings_table', [
    {
      rowGUID: 'settings-1',
      rowOwnerGUID: demo.projects[0].rowGUID,
      rowParentGUID: OWNER,
      orderInList: 0,
      rowJSON: { uxuiSettings: { planHour: true } },
    },
  ]);

  const api = createPMApi(db as any);
  return { db, api, demo, P1: demo.projects[0].rowGUID };
}

describe('templateApi (templates_project_* CRUD & copy operations)', () => {
  it('createTemplateFromProject copies project data into template tables excluding task stages', async () => {
    const { api, db, P1 } = setup();

    const template = await api.createTemplateFromProject({
      sourceProjectGUID: P1,
      ownerGUID: OWNER,
      templateName: 'Standard Project Template',
      templateDescription: 'Template description notes',
    });

    expect(template).toBeTruthy();
    expect(template.rowJSON.name).toBe('Standard Project Template');
    expect(template.rowJSON.notes).toBe('Template description notes');

    // Verify stored in templates_project_table
    const templatesInDb = db.rows('templates_project_table');
    expect(templatesInDb).toHaveLength(1);
    expect(templatesInDb[0].rowGUID).toBe(template.rowGUID);

    // Verify tasks copied into templates_project_task_table
    const templateTasks = db.rows('templates_project_task_table');
    expect(templateTasks.length).toBeGreaterThan(0);
    expect(templateTasks.every((t) => t.projectGUID === template.rowGUID)).toBe(true);

    // Verify dependencies copied into templates_project_task_dependencies_table
    const templateDeps = db.rows('templates_project_task_dependencies_table');
    expect(templateDeps.length).toBeGreaterThan(0);
    expect(templateDeps.every((d) => d.projectGUID === template.rowGUID)).toBe(true);

    // Verify stages copied into templates_project_kanban_stage_table
    const templateStages = db.rows('templates_project_kanban_stage_table');
    expect(templateStages).toHaveLength(1);
    expect(templateStages[0].rowOwnerGUID).toBe(template.rowGUID);

    // Verify settings copied into templates_project_user_settings_table
    const templateSettings = db.rows('templates_project_user_settings_table');
    expect(templateSettings).toHaveLength(1);
    expect(templateSettings[0].rowOwnerGUID).toBe(template.rowGUID);
  });

  it('createProjectFromTemplate instantiates new project from template and shifts dates', async () => {
    const { api, db, P1 } = setup();

    // 1. Create template first
    const template = await api.createTemplateFromProject({
      sourceProjectGUID: P1,
      ownerGUID: OWNER,
      templateName: 'Base Template',
    });

    const newStartMs = Date.UTC(2027, 0, 15);

    // 2. Instantiate new project
    const newProject = await api.createProjectFromTemplate({
      templateGUID: template.rowGUID,
      ownerGUID: OWNER,
      projectName: 'Client Project Alpha',
      startMs: newStartMs,
    });

    expect(newProject).toBeTruthy();
    expect(newProject.rowJSON.name).toBe('Client Project Alpha');
    expect(newProject.rowJSON.projectStartAt).toBe(new Date(newStartMs).toISOString());

    // Verify project created in project_table
    const allProjects = db.rows('project_table');
    const createdInDb = allProjects.find((p) => p.rowGUID === newProject.rowGUID);
    expect(createdInDb).toBeTruthy();

    // Verify tasks copied to project_task_table for new project
    const newTasks = db.rows('project_task_table').filter((t) => t.projectGUID === newProject.rowGUID);
    expect(newTasks.length).toBeGreaterThan(0);
    expect(newTasks.every((t) => t.projectGUID === newProject.rowGUID)).toBe(true);

    // Verify stages copied to project_kanban_stage_table
    const newStages = db.rows('project_kanban_stage_table').filter((s) => s.rowOwnerGUID === newProject.rowGUID);
    expect(newStages).toHaveLength(1);

    // Verify settings copied to project_user_settings_table
    const newSettings = db.rows('project_user_settings_table').filter((s) => s.rowOwnerGUID === newProject.rowGUID);
    expect(newSettings).toHaveLength(1);
  });

  it('readTemplates, updateTemplate, and deleteTemplate manage template records', async () => {
    const { api, P1 } = setup();

    const t1 = await api.createTemplateFromProject({
      sourceProjectGUID: P1,
      ownerGUID: OWNER,
      templateName: 'Template 1',
    });

    const list = await api.readTemplates(OWNER);
    expect(list).toHaveLength(1);
    expect(list[0].rowGUID).toBe(t1.rowGUID);

    const updated = await api.updateTemplate(t1.rowGUID, {
      rowJSON: { ...t1.rowJSON, name: 'Template 1 Renamed' },
    });
    expect(updated.rowJSON.name).toBe('Template 1 Renamed');

    await api.deleteTemplate(t1.rowGUID);
    const afterDelete = await api.readTemplates(OWNER);
    expect(afterDelete).toHaveLength(0);
  });

  it('editing template tasks and stages is supported like a real project', async () => {
    const { api, P1 } = setup();

    const template = await api.createTemplateFromProject({
      sourceProjectGUID: P1,
      ownerGUID: OWNER,
      templateName: 'Editable Template',
    });

    const data = await api.readTemplateData(template.rowGUID);
    expect(data.tasks.length).toBeGreaterThan(0);

    const firstTask = data.tasks[0];
    const updatedTask = await api.updateTemplateTask(firstTask.rowGUID, {
      rowJSON: { ...firstTask.rowJSON, name: 'Updated Template Task Name' },
    });
    expect(updatedTask.rowJSON.name).toBe('Updated Template Task Name');

    const stages = await api.readTemplateKanbanStages(template.rowGUID);
    expect(stages).toHaveLength(1);

    const newStage = await api.createTemplateKanbanStage({
      rowOwnerGUID: template.rowGUID,
      orderInList: 2,
      rowJSON: { stageName: 'In Review' },
    });
    expect(newStage.rowJSON.stageName).toBe('In Review');

    const updatedStages = await api.readTemplateKanbanStages(template.rowGUID);
    expect(updatedStages).toHaveLength(2);
  });
});
