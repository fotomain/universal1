// The keyboard of the task tree (web). Shared by the Project dashboard and every screen that hosts the tree (view/project/tree/PMProjectTreeHost).
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { isPMApproveOpen } from '../../../inner/PMApproveYesNoCancelModalWindow';
import { usePMStore } from '../../../store/store_pm';
import type { usePMCrud } from '../../../crud/usePMCrud';

/** Web: Ctrl/⌘+Z = undo, Del = sql_for_delete, Enter/F2 = edit, Esc = cancel link / clear, Alt+↑↓ = move, Tab/Shift+Tab = indent. */
export function useTreeKeyboardShortcuts(crud: ReturnType<typeof usePMCrud>, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const s = usePMStore.getState();
      if (s.editingGUID || s.editingDep || s.uxuiSettingsOpen || s.customColumnPrompt || isPMApproveOpen()) return;
      // Redo: Ctrl/⌘+Shift+Z or Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && (e.key === 'z' || e.key === 'Z')) || (!e.shiftKey && (e.key === 'y' || e.key === 'Y')))) {
        e.preventDefault();
        if (s.redoCount > 0) crud.redoGanttAction();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (s.undoCount > 0) crud.undoGanttAction();
        return;
      }
      const sel = s.selectedGUID;
      if (e.key === 'Escape') {
        if (s.depMenu) s.setDepMenu(null);
        else if (s.treeHeaderMenu) s.setTreeHeaderMenu(null);
        else if (s.linkSourceGUID) s.setLinkSource(null);
        else s.setSelected(null);
        return;
      }
      if (!sel) return;
      if (e.key === 'Delete') {
        e.preventDefault();
        crud.deleteTask(sel);
      } else if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        crud.edit(sel);
      } else if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        crud.moveBy(sel, -1);
      } else if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault();
        crud.moveBy(sel, 1);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const i = s.rowIndexById[sel] ?? 0;
        const next = s.visibleRows[i + (e.key === 'ArrowUp' ? -1 : 1)];
        if (next) s.setSelected(next);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) crud.outdent(sel);
        else crud.indent(sel);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [crud, enabled]);
}
