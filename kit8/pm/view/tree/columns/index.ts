// kit8/pm/view/tree/columns - tree grid columns: "#" (hierarchy number, first by default) · Task name ·
// Start · Days · % + custom columns (customColumns.ts), responsive layout, column resizing (header separators)
// and drag & drop reordering by the header.
// Saved per project: project_table.rowJSON.uxuiSettings.treeColumnsOrder / showTreeHierarchyNumbers.
// PMTreeColumnsHeader (Skia) is NOT re-exported - import it by path after CanvasKit is loaded.
export * from './treeColumns';
export { useTreeColumnDragGesture, useTreeColumnGeometry, geometryOfLayout, columnIndexAt, resizeEdgeIndexAt } from './useTreeColumnDragGesture';
export type { PMTreeColumnGeometry } from './useTreeColumnDragGesture';
export { useTreeColumnResizeGesture } from './useTreeColumnResizeGesture';
export type { PMTreeColumnResize } from './useTreeColumnResizeGesture';
export * from './customColumns';
export type { PMTreeColumnDrag } from './useTreeColumnDragGesture';
export { useTreeColumnsLayout } from './useTreeColumnsLayout';
