// F11 Keyboard commands (web): the shortcuts of MS Project on the task table. Only while ganttKeyboardCommandsEnabled is on; never while the user types in a field.
//   Alt+Shift+Left / Right  outdent / indent the selected row      Alt+Shift+Up / Down  move the selected row
//   Alt+Shift+= / -         expand / collapse the selected stage   Ctrl+F2 / Ctrl+Shift+F2  link / unlink the checked rows
//   Ctrl+F  find, replace   Ctrl+G  go to                         (F9 = calculate lives in PMGanttCalculateButton)
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { usePMStore } from '../store/store_pm';
import type { PMCrud } from '../crud/usePMCrud';

export type PMKeyCommand = 'outdent' | 'indent' | 'moveUp' | 'moveDown' | 'expand' | 'collapse' | 'link' | 'unlink' | 'find' | 'goTo';

/** the command of a key press, or null (pure) */
export function keyCommandOf(e: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean }): PMKeyCommand | null {
  const mod = e.ctrlKey || e.metaKey;
  if (e.altKey && e.shiftKey && !mod) {
    switch (e.key) {
      case 'ArrowLeft': return 'outdent';
      case 'ArrowRight': return 'indent';
      case 'ArrowUp': return 'moveUp';
      case 'ArrowDown': return 'moveDown';
      case '=': case '+': return 'expand';
      case '-': case '_': return 'collapse';
      default: return null;
    }
  }
  if (mod && !e.altKey && e.key === 'F2') return e.shiftKey ? 'unlink' : 'link';
  if (mod && !e.altKey && !e.shiftKey && (e.key === 'f' || e.key === 'F')) return 'find';
  if (mod && !e.altKey && !e.shiftKey && (e.key === 'g' || e.key === 'G')) return 'goTo';
  return null;
}

function typingIn(el: unknown): boolean {
  const n = el as { tagName?: string; isContentEditable?: boolean } | null;
  const tag = (n?.tagName || '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || n?.isContentEditable === true;
}

export function useExtendedKeys(crud: PMCrud) {
  const on = usePMStore((s) => s.extFlags.ganttKeyboardCommandsEnabled === true);
  useEffect(() => {
    if (!on || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      const cmd = keyCommandOf(e);
      if (!cmd) return;
      // Ctrl+F / Ctrl+G keep the browser's own behaviour while the user types or when the function is off
      if (typingIn(document.activeElement) && cmd !== 'link' && cmd !== 'unlink') return;
      const s = usePMStore.getState();
      const sel = s.selectedGUID;
      const flags = s.extFlags;
      if ((cmd === 'find' || cmd === 'goTo') && !flags.ganttFindReplaceEnabled) return;
      if ((cmd === 'link' || cmd === 'unlink') && !flags.ganttLinkUnlinkEnabled) return;
      e.preventDefault();
      switch (cmd) {
        case 'outdent': if (sel) crud.outdent(sel); break;
        case 'indent': if (sel) crud.indent(sel); break;
        case 'moveUp': if (sel) crud.moveBy(sel, -1); break;
        case 'moveDown': if (sel) crud.moveBy(sel, 1); break;
        case 'expand':
        case 'collapse': {
          const isOpen = !!sel && s.expandedByProject[s.selectedProjectGUID ?? '']?.[sel] !== false;
          if (sel && (s.tree.childrenById[sel]?.length ?? 0) > 0 && isOpen !== (cmd === 'expand')) s.toggleExpanded(sel);
          break;
        }
        case 'link': void crud.linkChecked(); break;
        case 'unlink': void crud.unlinkChecked(); break;
        case 'find':
        case 'goTo': s.setExtDialog('find'); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [on, crud]);
}
