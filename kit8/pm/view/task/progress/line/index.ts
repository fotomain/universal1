// Progress lines of the Gantt (showTaskProgressOnGantt):
//   task line    - on each task bar: onTop / onBottom / atTheMiddle (under the text)
//   project line - in the time-scale header, project start -> finish, filled to project %
// Settings live in project_table.rowJSON.uxuiSettings (taskProgressLinePosition,
// projectProgressLinePosition, taskProgressLineColor, projectProgressLineColor).
//
// NOTE (web): PMTaskProgressLine / PMProjectProgressLine use Skia. Code that runs before
// CanvasKit is loaded (dashboard, settings windows) must import the non-Skia files directly.
export * from './progressLineConstants';
export * from './progressLineGeometry';
export { default as PMTaskProgressLine } from './PMTaskProgressLine';
export { PMProjectProgressLine, PMProjectProgressLabel } from './PMProjectProgressLine';
export { default as PMProgressLinePositionSelector } from './PMProgressLinePositionSelector';
export { default as PMColorSwatchPicker } from './PMColorSwatchPicker';
export { default as PMProgressLineSettings, PMProgressLinePreview } from './PMProgressLineSettings';
