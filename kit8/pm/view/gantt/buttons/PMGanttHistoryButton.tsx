// Undo / Redo button of the Gantt bar (icon + step counter) with a menu:
//   press                               -> undo / redo
//   right-click (web) / long touch      -> menu: "Clear undo history" / "Clear redo history" (clearUndo / clearRedo)
// PMGanttUndoButton and PMGanttRedoButton are this component with kind="undo" | "redo".

import React, { useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { usePMStore } from '../../../store/store_pm';
import { PMPalette } from '../../theme';
import { PMCrud } from '../../../crud/usePMCrud';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';
import PMContextMenu from '../../../inner/menu/PMContextMenu';
import { hidePMTip } from '../../../inner/tooltip/PMTooltip';
import { pmT } from '../../../i18n/pmT';

export default function PMGanttHistoryButton({ kind, crud, palette }: { kind: 'undo' | 'redo'; crud: PMCrud; palette: PMPalette }) {
  const isUndo = kind === 'undo';
  const count = usePMStore((s) => (isUndo ? s.undoCount : s.redoCount));
  const label = usePMStore((s) => (isUndo ? s.undoLabel : s.redoLabel));
  const anchor = useRef<View>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const id = `pm-gantt-${kind}`;

  const openAt = (x: number, y: number) => {
    hidePMTip();
    setMenu({ x, y });
  };
  /** long touch: under the button */
  const openUnderButton = () => {
    const node: any = anchor.current;
    if (node && typeof node.measureInWindow === 'function') node.measureInWindow((x: number, y: number, _w: number, h: number) => openAt(x || 0, (y || 0) + (h || 30) + 4));
    else openAt(0, 0);
  };
  // web: right-click on the button (also when it is disabled) opens the menu at the pointer
  const web =
    Platform.OS === 'web'
      ? ({
          onContextMenu: (e: any) => {
            e.preventDefault?.();
            e.stopPropagation?.();
            const n = e.nativeEvent || e;
            openAt(n.clientX ?? n.pageX ?? 0, n.clientY ?? n.pageY ?? 0);
          },
        } as any)
      : {};
  const shortcut = isUndo ? 'Ctrl/⌘+Z' : 'Ctrl/⌘+Shift+Z';
  const hint = pmT('right-click / long touch: menu');
  const title = label ? `${pmT(isUndo ? 'Undo' : 'Redo')}: ${label}  (${shortcut} · ${hint})` : pmT(isUndo ? 'Nothing to undo' : 'Nothing to redo');

  return (
    <>
      <View ref={anchor} collapsable={false} testID={`${id}-anchor`} {...web}>
        <PMIconButton
          testID={id}
          icon={kind}
          badge={count}
          title={title}
          color={palette.text}
          disabled={!count || crud.isUndoing}
          onPress={isUndo ? crud.undoGanttAction : crud.redoGanttAction}
          onLongPress={openUnderButton}
        />
      </View>
      {menu && (
        <PMContextMenu
          testID={`${id}-menu`}
          x={menu.x}
          y={menu.y}
          width={230}
          caption={count ? `${pmT(isUndo ? 'Undo' : 'Redo')}: ${count}` : pmT(isUndo ? 'Nothing to undo' : 'Nothing to redo')}
          onClose={() => setMenu(null)}
          items={[
            {
              testID: `${id}-clear`,
              icon: 'delete_sweep',
              label: pmT(isUndo ? 'Clear undo history' : 'Clear redo history'),
              danger: true,
              disabled: !count || crud.isUndoing,
              onPress: () => {
                setMenu(null);
                if (isUndo) crud.clearUndo();
                else crud.clearRedo();
              },
            },
          ]}
        />
      )}
    </>
  );
}
