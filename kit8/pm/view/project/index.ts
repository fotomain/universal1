// kit8/pm/view/project - project-level code: the dashboard screen (/pm/project/dashboard), project picker and project buttons.
// Recently selected projects (ribbon store + project bar): kit8/pm/view/project/recent.
// Tree pane: kit8/pm/view/tree · Gantt pane: kit8/pm/view/gantt · shared PM code (store, types, crud, queries, theme, undo) stays in kit8/pm.
export { default as PMProjectDashboard } from './PMProjectDashboard';
export { default as SelectProjectFromList } from './SelectProjectFromList';
// buttons
export { default as PMAddProjectButton } from './buttons/PMAddProjectButton';
// templates
export { default as CreateTemplateFromProject } from './CreateTemplateFromProject';
export { default as CreateProjectFromTemplate } from './CreateProjectFromTemplate';
// recent projects
export * from './recent';
