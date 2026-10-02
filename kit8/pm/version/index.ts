// kit8/pm/version - project versions: save the whole plan, restore it, compare versions on the Gantt chart.
//   model/   versionTypes.ts (tables, row types, titles, colors) · versionCompare.ts (pure: schedule, diff, overlays)
//   store/   store_version.ts (Zustand)
//   crud/    api/versionApi.ts (Supabase + RPCs) · version/versionQueries.ts (React Query) · version/useVersionCommands.ts
//   view/    version/* (toolbar buttons, windows, Versions view, cards, Gantt legend)
// The Skia part (PMGanttVersionBars) is NOT re-exported: import it by path, after CanvasKit is ready on web.
export * from './model/versionTypes';
export * from './model/versionCompare';
export { usePMVersionStore, pmVersionStore, normalizeChecked } from './store/store_version';
export type { PMVersionStoreState, PMVersionTitlePrompt } from './store/store_version';
export { createVersionApi, isMissingFunctionError } from './crud/api/versionApi';
export type { PMVersionApi } from './crud/api/versionApi';
export { pmVersionKeys, usePMVersionApi, useReadProjectVersionsQuery, useVersionDataQuery } from './crud/version/versionQueries';
export { useVersionCommands } from './crud/version/useVersionCommands';
export type { PMVersionCommands } from './crud/version/useVersionCommands';
export { default as PMGanttVersionButtons } from './view/version/PMGanttVersionButtons';
export { default as PMVersionTitleModalWindow } from './view/version/PMVersionTitleModalWindow';
export { default as PMVersionWindows } from './view/version/PMVersionWindows';
export { default as PMProjectVersionsList } from './view/version/PMProjectVersionsList';
export { default as ProjectVersionCard } from './view/version/ProjectVersionCard';
export { default as PMGanttVersionsLegend } from './view/version/PMGanttVersionsLegend';
