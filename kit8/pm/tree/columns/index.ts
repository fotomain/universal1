// kit8/pm/tree/columns - tree grid columns: "#" (hierarchy number, first by default) · Task name ·
// Start · Days · %, responsive layout, drag & drop reordering by the header.
// Saved per project: project_table.rowJSON.uxuiSettings.treeColumnsOrder / showTreeHierarchyNumbers.
// PMTreeColumnsHeader (Skia) is NOT re-exported - import it by path after CanvasKit is loaded.
export * from './treeColumns';
export { useTreeColumnDragGesture } from './useTreeColumnDragGesture';
export type { PMTreeColumnDrag } from './useTreeColumnDragGesture';
export { useTreeColumnsLayout } from './useTreeColumnsLayout';
