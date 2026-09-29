// Critical path task color (uxuiSettings.criticalPathTaskColor, saved per project and user in
// project_user_settings_table). No imports -> safe to use from model/types.ts and view/theme.ts.

/** The ONLY colors a critical path task may have: 9 colors + black (Gantt settings -> Task tab). */
export const PM_CRITICAL_PATH_TASK_COLORS = ['#FCFF00', '#FFAA00', '#FF5500', '#00FF66', '#00F0FF', '#4455FF', '#9D00FF', '#FF007F', '#FF0033', '#000000'];

/** Default critical path color (red of the set). */
export const PM_DEFAULT_CRITICAL_PATH_TASK_COLOR = '#FF0033';

/** A saved color -> the matching color of the set (case-insensitive), anything else -> the default. */
export function criticalPathTaskColorOf(value: unknown): string {
  if (typeof value !== 'string') return PM_DEFAULT_CRITICAL_PATH_TASK_COLOR;
  const v = value.trim().toUpperCase();
  return PM_CRITICAL_PATH_TASK_COLORS.find((c) => c === v) ?? PM_DEFAULT_CRITICAL_PATH_TASK_COLOR;
}
