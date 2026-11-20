// PMProjectImportExportButton - the "Import / Export" icon button of the project bar (right before the Project settings button). It opens a menu:
//   1. Import - opens the Project settings window of the selected project on the Import panel (drop a project_data_….json / project_package_….zip)
//   2. Export - the same window on the Export panel
// The work itself is ImportExportProject (kit8/pm/crud/exchange/project); the host (PMRecentProjectsToolbar) opens the window.
import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';
import PMContextMenu from '../../../inner/menu/PMContextMenu';
import { pmT } from '../../../i18n/pmT';
import type { PMExchangeTab } from '../../../crud/exchange/project/ImportExportProject';

export default function PMProjectImportExportButton({ color, disabled, width, size, onPick }: { color: string; disabled?: boolean; width?: number; size?: number; onPick: (tab: PMExchangeTab) => void }) {
  const ref = useRef<View>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const open = () => {
    const node: any = ref.current;
    if (node?.measureInWindow) node.measureInWindow((x: number, y: number, _w: number, h: number) => setMenu({ x, y: y + h + 2 }));
    else setMenu({ x: 8, y: 56 });
  };
  const pick = (tab: PMExchangeTab) => () => { setMenu(null); onPick(tab); };

  return (
    <>
      <View ref={ref} collapsable={false}>
        <PMIconButton
          testID="pm-project-import-export"
          icon="import_export"
          title={pmT('Import / Export the project')}
          color={color}
          disabled={disabled}
          width={width}
          size={size}
          onPress={open}
        />
      </View>
      {!!menu && (
        <PMContextMenu
          testID="pm-project-import-export-menu"
          x={menu.x}
          y={menu.y}
          width={200}
          caption={pmT('Import / Export')}
          onClose={() => setMenu(null)}
          items={[
            { testID: 'pm-project-import-export-import', label: 'Import', icon: 'file_upload', onPress: pick('TabImport') },
            { testID: 'pm-project-import-export-export', label: 'Export', icon: 'file_download', onPress: pick('TabExport') },
          ]}
        />
      )}
    </>
  );
}
