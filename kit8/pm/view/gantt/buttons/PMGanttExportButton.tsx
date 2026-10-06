// "Export" on the Gantt bar: opens a menu under the button
//   Export to PDF        the task tree + Gantt chart as shown on the screen, with the project name and its
//                        start - finish dates above (crud/exchange/pdf/exportDashboardToPdf.ts)
//   Export to JSON       project_data_<rowGUID>.json (crud/exchange/project)
//   Export to MS Project  opens PMExportToMSProject (crud/exchange/msproject) - Microsoft Project XML

import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { usePMStore } from '../../../store/store_pm';
import { PMPalette } from '../../theme';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';
import { hidePMTip } from '../../../inner/tooltip/PMTooltip';
import PMContextMenu from '../../../inner/menu/PMContextMenu';
import { exportProjectDashboardToPdf } from '../../../crud/exchange/pdf/exportDashboardToPdf';
import { exportOpenProjectToFile } from '../../../crud/exchange/project/export/exportProjectToFile';
import PMExportToMSProject from '../../../crud/exchange/msproject/PMExportToMSProject';
import { pmT } from '../../../i18n/pmT';

export default function PMGanttExportButton({ palette }: { palette: PMPalette }) {
  const selectedProjectGUID = usePMStore((s) => s.selectedProjectGUID);
  const anchor = useRef<View>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msProjectOpen, setMsProjectOpen] = useState(false);

  // where the menu opens: under the button. Measured when the button is laid out and again on every press
  // (the bar scrolls horizontally) - the press shows the menu at once and the fresh measure corrects it.
  const at = useRef({ x: 0, y: 0 });
  const measure = (then?: () => void) => {
    const node: any = anchor.current;
    if (!node || typeof node.measureInWindow !== 'function') return;
    node.measureInWindow((x: number, y: number, _w: number, h: number) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      at.current = { x, y: y + (h || 30) + 4 };
      then?.();
    });
  };
  const openMenu = () => {
    hidePMTip();
    setMenu({ ...at.current });
    measure(() => setMenu((m) => (m && (m.x !== at.current.x || m.y !== at.current.y) ? { ...at.current } : m)));
  };
  const run = async (job: () => Promise<unknown>, failed: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await job();
    } catch (e: any) {
      usePMStore.getState().setError(e?.message || failed);
    } finally {
      setBusy(false);
    }
  };
  const pick = (action: () => void) => () => {
    setMenu(null);
    action();
  };

  return (
    <>
      <View ref={anchor} collapsable={false} onLayout={() => measure()}>
        <PMIconButton
          testID="pm-gantt-export"
          icon="download"
          label={pmT('Export')}
          title={pmT('Export the project: PDF, JSON, MS Project')}
          color={palette.text}
          active={!!menu}
          activeColor={palette.primary}
          disabled={!selectedProjectGUID || busy}
          onPress={openMenu}
        />
      </View>
      {menu && (
        <PMContextMenu
          testID="pm-gantt-export-menu"
          x={menu.x}
          y={menu.y}
          width={230}
          caption={pmT('Export')}
          onClose={() => setMenu(null)}
          items={[
            {
              testID: 'pm-gantt-export-pdf',
              icon: 'picture_as_pdf',
              label: pmT('Export to PDF'),
              // the menu fades out before the screen is captured
              onPress: pick(() => run(() => exportProjectDashboardToPdf(selectedProjectGUID, { delayMs: 350 }), pmT('PDF export failed'))),
            },
            {
              testID: 'pm-gantt-export-json',
              icon: 'data_object',
              label: pmT('Export to JSON'),
              onPress: pick(() => run(() => exportOpenProjectToFile(selectedProjectGUID as string), pmT('The export failed.'))),
            },
            {
              testID: 'pm-gantt-export-msproject',
              icon: 'account_tree',
              label: pmT('Export to MS Project'),
              onPress: pick(() => setMsProjectOpen(true)),
            },
          ]}
        />
      )}
      <PMExportToMSProject visible={msProjectOpen} projectGUID={selectedProjectGUID} onClose={() => setMsProjectOpen(false)} />
    </>
  );
}
