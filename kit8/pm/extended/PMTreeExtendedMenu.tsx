// PMTreeExtendedMenu - the buttons of the Gantt Extended functions on the tree toolbar (kit8/pm/extended):
//   Link / Unlink the checked rows (B2) as two icon buttons, and ONE menu button "Extended" with the rest:
//   copy / paste rows (F1) · fill down (F2) · edit the checked rows (F3) · columns (F4) · show outline level (E8) · find / replace / go to (F7) · named views (F10) · insert recurring task (A13)
// A function that is off has no item; with every function off the component draws nothing.
import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { usePMStore } from '../store/store_pm';
import type { PMPalette } from '../view/theme';
import type { PMCrud } from '../crud/usePMCrud';
import { PMIconButton } from '../inner/buttons/PMIconButton';
import PMContextMenu from '../inner/menu/PMContextMenu';
import type { PMMenuItemProps } from '../inner/menu/PMMenuItem';
import { hidePMTip } from '../inner/tooltip/PMTooltip';
import { pmT } from '../i18n/pmT';
import { extColumnsAvailable } from './extendedColumns';
import { extendedOptionsPatch } from './extendedOptions';
import { rangeBetweenChecked } from './rangeSelect';

const MENU_KEYS = ['ganttCopyPasteEnabled', 'ganttFillDownEnabled', 'ganttRangeSelectionEnabled', 'ganttColumnPickerEnabled', 'ganttOutlineLevelEnabled', 'ganttFindReplaceEnabled', 'ganttNamedViewsEnabled', 'ganttRecurringTasksEnabled'];

export default function PMTreeExtendedMenu({ crud, palette }: { crud: PMCrud; palette: PMPalette }) {
  const flags = usePMStore((s) => s.extFlags);
  const opts = usePMStore((s) => s.extOptions);
  const projectJSON = usePMStore((s) => (s.selectedProjectGUID ? s.projectsById[s.selectedProjectGUID]?.rowJSON : undefined));
  const checkedCount = usePMStore((s) => Object.keys(s.checkedGUIDs).length);
  const anchor = useRef<View>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const hasMenu = MENU_KEYS.some((k) => flags[k]);

  const open = () => {
    hidePMTip();
    const node: any = anchor.current;
    if (node?.measureInWindow) node.measureInWindow((x: number, y: number, _w: number, h: number) => setMenu({ x, y: y + h + 2 }));
    else setMenu({ x: 8, y: 120 });
  };
  const close = () => setMenu(null);
  const run = (fn: () => unknown) => () => {
    close();
    void fn();
  };
  const saveOptions = (change: Partial<typeof opts>) => crud.saveProjectJSON(extendedOptionsPatch(projectJSON, change));

  const items: PMMenuItemProps[] = [];
  const id = (s: string) => `pm-ext-menu-${s}`;
  if (flags.ganttCopyPasteEnabled) {
    items.push({ testID: id('copy'), label: 'Copy rows', icon: 'content_copy', onPress: run(() => crud.copyRows()) });
    items.push({ testID: id('paste'), label: 'Paste rows', icon: 'content_paste', onPress: run(() => crud.pasteRows()) });
  }
  if (flags.ganttFillDownEnabled) {
    items.push({
      testID: id('fill'), label: 'Fill down', icon: 'vertical_align_bottom', onPress: () => {},
      submenu: (['duration', 'percent', 'priority', 'startConstraint'] as const).map((f) => ({ testID: id(`fill-${f}`), label: { duration: 'Duration', percent: '% complete', priority: 'Priority', startConstraint: 'Start no earlier than' }[f], icon: 'arrow_downward', onPress: run(() => crud.fillDown(f)) })),
    });
  }
  if (flags.ganttRangeSelectionEnabled) {
    items.push({
      testID: id('check-range'), label: 'Check the rows between the first and the last checked', icon: 'checklist', disabled: checkedCount < 2,
      onPress: run(() => { const st = usePMStore.getState(); st.setChecked(rangeBetweenChecked(st.visibleRows, st.checkedGUIDs), true); }),
    });
  }
  if (flags.ganttRangeSelectionEnabled) items.push({ testID: id('edit-checked'), label: 'Edit the checked rows…', icon: 'edit_note', disabled: checkedCount === 0, onPress: run(() => usePMStore.getState().setExtDialog('editChecked')) });
  if (flags.ganttColumnPickerEnabled) {
    const cols = extColumnsAvailable(flags);
    items.push({
      testID: id('columns'), label: 'Columns', icon: 'view_column', onPress: () => {},
      submenu: cols.length
        ? cols.map((c) => {
            const shown = (opts.shownColumns.includes(c.key) || c.defaultShown) && !opts.hiddenColumns.includes(c.key);
            return {
              testID: id(`col-${c.field}`), label: c.title, icon: shown ? 'check_box' : 'check_box_outline_blank', checked: shown,
              onPress: run(() => saveOptions(shown
                ? { hiddenColumns: [...opts.hiddenColumns.filter((k) => k !== c.key), c.key], shownColumns: opts.shownColumns.filter((k) => k !== c.key) }
                : { hiddenColumns: opts.hiddenColumns.filter((k) => k !== c.key), shownColumns: [...opts.shownColumns.filter((k) => k !== c.key), c.key] })),
            };
          })
        : [{ testID: id('col-none'), label: 'No extra columns yet', icon: 'info', disabled: true, onPress: () => {} }],
    });
  }
  if (flags.ganttOutlineLevelEnabled) {
    items.push({
      testID: id('level'), label: 'Show outline level', icon: 'format_list_numbered', onPress: () => {},
      submenu: [1, 2, 3, 4, 5].map((n) => ({ testID: id(`level-${n}`), label: `Level ${n}`, icon: 'looks_one', onPress: run(() => usePMStore.getState().setExpandedToLevel(n)) })).concat([{ testID: id('level-all'), label: 'All levels', icon: 'unfold_more', onPress: run(() => usePMStore.getState().setExpandedToLevel(null)) }]),
    });
  }
  if (flags.ganttFindReplaceEnabled) items.push({ testID: id('find'), label: 'Find, replace, go to…', icon: 'search', onPress: run(() => usePMStore.getState().setExtDialog('find')) });
  if (flags.ganttNamedViewsEnabled) {
    const s = () => usePMStore.getState();
    items.push({
      testID: id('views'), label: 'Views', icon: 'dashboard_customize', onPress: () => {},
      submenu: [
        ...opts.views.map((v, i) => ({
          testID: id(`view-${i}`), label: v.name, icon: 'visibility',
          onPress: run(() => {
            if (v.treeColumnsOrder) crud.setTreeColumnsOrder(v.treeColumnsOrder as any);
            if (v.treeColumnsWidths) s().setTreeColumnsSettings({ treeColumnsWidths: v.treeColumnsWidths });
            saveOptions({ hiddenColumns: v.hiddenColumns ?? [], groupBy: v.groupBy ?? 'none', highlight: v.highlight ?? 'none' });
          }),
        })),
        { testID: id('view-save'), label: 'Save the current view', icon: 'save', onPress: run(() => {
          const name = `View ${opts.views.length + 1}`;
          saveOptions({ views: [...opts.views, { name, treeColumnsOrder: s().treeColumnsOrder as string[], treeColumnsWidths: s().treeColumnsWidths, hiddenColumns: opts.hiddenColumns, groupBy: opts.groupBy, highlight: opts.highlight }] });
        }) },
        ...(opts.views.length ? [{ testID: id('view-delete-last'), label: 'Delete the last view', icon: 'delete', danger: true, onPress: run(() => saveOptions({ views: opts.views.slice(0, -1) })) }] : []),
      ],
    });
  }
  if (flags.ganttRecurringTasksEnabled) items.push({ testID: id('recurring'), label: 'Insert recurring task…', icon: 'event_repeat', onPress: run(() => usePMStore.getState().setExtDialog('recurring')) });

  if (!flags.ganttLinkUnlinkEnabled && !hasMenu) return null;
  return (
    <>
      {flags.ganttLinkUnlinkEnabled && (
        <>
          <PMIconButton testID="pm-tree-link-checked" icon="link" title={pmT('Link the checked rows in a chain (Ctrl+F2)')} color={palette.text} disabled={checkedCount < 2} onPress={() => crud.linkChecked()} />
          <PMIconButton testID="pm-tree-unlink-checked" icon="link_off" title={pmT('Remove the links between the checked rows (Ctrl+Shift+F2)')} color={palette.text} disabled={checkedCount < 2} onPress={() => crud.unlinkChecked()} />
        </>
      )}
      {hasMenu && (
        <>
          <View ref={anchor} collapsable={false}>
            <PMIconButton testID="pm-tree-extended-menu" icon="more_horiz" title={pmT('Extended: copy and paste, fill down, columns, outline level, find, views, recurring task')} color={palette.text} active={!!menu} activeColor={palette.primary} onPress={open} />
          </View>
          {menu && <PMContextMenu testID="pm-tree-extended-menu-list" x={menu.x} y={menu.y} width={230} caption="Extended" items={items} onClose={close} />}
        </>
      )}
    </>
  );
}
