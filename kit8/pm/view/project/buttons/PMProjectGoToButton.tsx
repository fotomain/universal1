// PMProjectGoToButton - the "Go to" icon button of the project bar (right after the Actions button). It opens a menu with the SAME "Go to" items as the Task context menu
// (useTaskRelatedMenu: Timeline data · Vendor invoices · Customer invoices · Payment facts · Purchase orders · Product receipts · Fact input · Time sheets · Subproject)
// (icon arrow_top_left of fonts.google.com/icons, turned 180 degrees by ROTATION_MAP of MaterialSymbol) for the task that is selected now (the lists open in a NEW browser window on the web, filtered for that task). No task selected, or a stage (it has no documents): the button is disabled.
import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';
import PMContextMenu from '../../../inner/menu/PMContextMenu';
import { pmT } from '../../../i18n/pmT';
import { usePMStore } from '../../../store/store_pm';
import { useTaskRelatedMenu } from '../../task/useTaskRelatedMenu';

export default function PMProjectGoToButton({ projectGUID, color, disabled, width, size }: { projectGUID: string | null | undefined; color: string; disabled?: boolean; width?: number; size?: number }) {
  const ref = useRef<View>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const relatedMenu = useTaskRelatedMenu();
  const taskGUID = usePMStore((s) => s.selectedGUID);

  // the items of the Task menu "Go to" for the selected task; a stage / no task = nothing (the button is disabled)
  const items = projectGUID && taskGUID
    ? (relatedMenu({ taskGUID, projectGUID, idPrefix: 'pm-project-goto', close: () => setMenu(null) }).find((it) => it.testID.endsWith('-goto'))?.submenu ?? [])
    : [];

  const open = () => {
    const node: any = ref.current;
    if (node?.measureInWindow) node.measureInWindow((x: number, y: number, _w: number, h: number) => setMenu({ x, y: y + h + 2 }));
    else setMenu({ x: 8, y: 56 });
  };

  return (
    <>
      <View ref={ref} collapsable={false}>
        <PMIconButton tipScope="app"
          testID="pm-project-goto"
          icon="arrow_top_left"
          title={items.length ? pmT('Go to (documents of the selected task)') : pmT('Go to: select a task first')}
          color={color}
          disabled={disabled || !items.length}
          width={width}
          size={size}
          onPress={open}
        />
      </View>
      {!!menu && !!items.length && (
        <PMContextMenu
          testID="pm-project-goto-menu"
          x={menu.x}
          y={menu.y}
          width={230}
          caption={pmT('Go to')}
          onClose={() => setMenu(null)}
          items={items}
        />
      )}
    </>
  );
}
