// Monitor01ViewMenu - the "View" button of the report toolbar and its sub menu: Save View · Restore View (the saved Views of the report, kit8/sql/start PART 43).
//   Save View      the window Monitor01SaveViewModal: ReportViewTitle + "For other users enabled"; saves the checked fields, the date filters, the tab, the project kind and the VAT basis
//   Restore View   the window Monitor01RestoreViewModal: the list of the Views (column "For other users enabled"); Restore applies a View to the report
// The Views are ALWAYS switched on for Monitor01 (reports/common/reportRegistry.ts: viewsAlwaysOn) - there is no switch that hides the button.
import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import ButtonApp from '../../../ui/components/common/ButtonApp';
import PMContextMenu from '../../inner/menu/PMContextMenu';
import { pmT } from '../../i18n/pmT';
import { reportViewsEnabled } from '../common/reportRegistry';
import Monitor01SaveViewModal from './Monitor01SaveViewModal';
import Monitor01RestoreViewModal from './Monitor01RestoreViewModal';
import type { ReportViewRow } from './monitor01ReportViews';
import type { Monitor01ReportSettings } from './monitor01Fields';

export interface Monitor01ViewMenuProps {
  reportGUID: string;
  getSettings: () => Monitor01ReportSettings;
  onRestore: (view: ReportViewRow) => void;
  /** the title of the View that was restored or saved last: Save View starts with it */
  lastTitle?: string;
  onSaved?: (title: string, viewGUID: string) => void;
  testID?: string;
}

export default function Monitor01ViewMenu({ reportGUID, getSettings, onRestore, lastTitle = '', onSaved, testID = 'monitor01-view' }: Monitor01ViewMenuProps) {
  const anchor = useRef<any>(null);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  if (!reportViewsEnabled(reportGUID)) return null;

  const openMenu = () => {
    const at = (x: number, y: number) => setMenuAt({ x, y });
    // under the button; a window that cannot measure (a test, an old browser) opens the menu at the top left
    try { anchor.current?.measureInWindow?.((x: number, y: number, _w: number, h: number) => at(x, y + h)); if (!anchor.current?.measureInWindow) at(8, 40); } catch { at(8, 40); }
  };
  const items = [
    { testID: `${testID}-save`, label: 'Save View', icon: 'save', onPress: () => { setMenuAt(null); setSaveOpen(true); } },
    { testID: `${testID}-restore`, label: 'Restore View', icon: 'restore', onPress: () => { setMenuAt(null); setRestoreOpen(true); } },
  ];
  return (
    <View ref={anchor} collapsable={false}>
      <ButtonApp testID={`${testID}-button`} title={pmT('View')} icon="visibility" variant="text" size="small" onPress={openMenu} />
      {menuAt && <PMContextMenu testID={`${testID}-menu`} x={menuAt.x} y={menuAt.y} items={items} onClose={() => setMenuAt(null)} />}
      <Monitor01SaveViewModal testID={`${testID}-save-window`} visible={saveOpen} onClose={() => setSaveOpen(false)} reportGUID={reportGUID} getSettings={getSettings} suggestTitle={lastTitle} onSaved={onSaved} />
      <Monitor01RestoreViewModal testID={`${testID}-restore-window`} visible={restoreOpen} onClose={() => setRestoreOpen(false)} reportGUID={reportGUID} onRestore={onRestore} />
    </View>
  );
}
