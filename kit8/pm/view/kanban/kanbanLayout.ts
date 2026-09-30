// Board geometry shared by PMKanbanDashboard and the tree -> board bridge (fixed-width columns).
export const PM_KANBAN_PADDING = 10;
export const PM_KANBAN_GAP = 10;
export const PM_KANBAN_COLUMN_HEADER = 40;
export const PM_KANBAN_COLUMN_MIN = 200;
export const PM_KANBAN_COLUMN_MAX = 280;

/** Column width: 280 on wide boards, ~80 % of the board on phones (the next column peeks in). */
export function kanbanColumnWidth(boardWidth: number): number {
  if (!(boardWidth > 0)) return PM_KANBAN_COLUMN_MAX;
  return Math.round(Math.max(PM_KANBAN_COLUMN_MIN, Math.min(PM_KANBAN_COLUMN_MAX, boardWidth * 0.8)));
}
