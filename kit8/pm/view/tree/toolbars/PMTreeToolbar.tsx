// PMTreeToolbar - tree container CRUD toolbar (above the tree canvas):
// add stage / task / milestone · move up / down · outdent / indent · edit / duplicate / sql_for_delete ·
// "#" hierarchy numbers on / off (uxuiSettings.showTreeHierarchyNumbers) · expand / collapse all ·
// clear all column filters + sort (only while the tree is filtered / sorted; badge = filtered columns) ·
// "select lines" column (round check boxes) on / off (uxui.hideTreeSelectColumn, the same on every project).

import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { setHideTreeSelectColumn } from '../../../../redux/uxuiSlice';
import PMContextMenu from '../../../inner/menu/PMContextMenu';
import { usePMStore } from '../../../store/store_pm';
import { PMPalette } from '../../theme';
import { PMCrud } from '../../../crud/usePMCrud';
import { PMToolbar, PMToolbarDivider, PMToolbarSpacer } from '../../../inner/toolbars/PMToolbarPrimitives';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';
import { pmT } from '../../../i18n/pmT';

export default function PMTreeToolbar({ crud, palette }: { crud: PMCrud; palette: PMPalette }) {
  const selectedGUID = usePMStore((s) => s.selectedGUID);
  const hasSelection = usePMStore((s) => !!(s.selectedGUID && s.tasksById[s.selectedGUID]));
  const showNumbers = usePMStore((s) => s.showTreeHierarchyNumbers);
  const filterCount = usePMStore((s) => Object.keys(s.treeColumnsFilters).length);
  const sorted = usePMStore((s) => !!s.treeColumnSort);
  const matchCount = usePMStore((s) => s.treeFilterMatchCount);
  const filterIconColor = usePMStore((s) => s.columnFilterIconColor);
  const text = palette.text;
  const dispatch = useDispatch();
  const hideSelectColumn = useSelector((s: any) => !!s.uxuiState?.hideTreeSelectColumn);
  const toggleSelectColumn = () => {
    // hiding the column also clears the check marks, so no hidden selection can be deleted by mistake
    if (!hideSelectColumn) usePMStore.getState().clearChecked();
    dispatch(setHideTreeSelectColumn(!hideSelectColumn));
  };
  const checkedCount = usePMStore((s) => Object.keys(s.checkedGUIDs).length);
  /** the active (selected) row is a stage: "+ Stage" asks Stage / Substage */
  const stageActive = usePMStore((s) => !!(s.selectedGUID && s.tasksById[s.selectedGUID]?.rowJSON.rowKind === 'stage'));
  const stageBtnRef = useRef<View>(null);
  const [stageMenu, setStageMenu] = useState<{ x: number; y: number } | null>(null);
  const onAddStage = () => {
    if (!stageActive) return void crud.createStage(selectedGUID);
    const node: any = stageBtnRef.current;
    if (node?.measureInWindow) node.measureInWindow((x: number, y: number, _w: number, h: number) => setStageMenu({ x, y: y + h + 2 }));
    else setStageMenu({ x: 8, y: 120 });
  };
  const withSel = (fn: (guid: string) => void) => () => {
    const g = usePMStore.getState().selectedGUID;
    if (g && usePMStore.getState().tasksById[g]) fn(g);
  };

  return (
    <PMToolbar background={palette.surface} border={palette.border}>
      <View ref={stageBtnRef} collapsable={false}>
        <PMIconButton testID="pm-tree-add-stage" icon="create_new_folder" label={pmT('Stage')} title={stageActive ? 'Add stage / substage' : 'Add stage'} color={palette.primary} onPress={onAddStage} />
      </View>
      {!!stageMenu && (
        <PMContextMenu
          testID="pm-tree-add-stage-menu"
          x={stageMenu.x}
          y={stageMenu.y}
          caption={pmT('+ Stage')}
          onClose={() => setStageMenu(null)}
          items={[
            { testID: 'pm-tree-add-stage-menu-stage', label: 'Stage', icon: 'create_new_folder', onPress: () => (setStageMenu(null), void (selectedGUID ? crud.createStageBelow(selectedGUID) : crud.createStage(null))) },
            { testID: 'pm-tree-add-stage-menu-substage', label: 'Substage', icon: 'subdirectory_arrow_right', onPress: () => (setStageMenu(null), void (selectedGUID && crud.createSubStage(selectedGUID))) },
          ]}
        />
      )}
      <PMIconButton testID="pm-tree-add-task" icon="add" label={pmT('Task')} title={pmT('Add task (inside the selected stage / after the selected task)')} color={palette.primary} onPress={() => crud.createTask(selectedGUID)} />
      <PMIconButton testID="pm-tree-add-milestone" icon="flag" title={pmT('Add milestone')} color={palette.primary} onPress={() => crud.createTask(selectedGUID, 'milestone')} />
      <PMToolbarDivider color={palette.border} />
      <PMIconButton testID="pm-tree-move-up" icon="arrow_upward" title={pmT('Move up')} color={text} disabled={!hasSelection} onPress={withSel((g) => crud.moveBy(g, -1))} />
      <PMIconButton testID="pm-tree-move-down" icon="arrow_downward" title={pmT('Move down')} color={text} disabled={!hasSelection} onPress={withSel((g) => crud.moveBy(g, 1))} />
      <PMIconButton testID="pm-tree-outdent" icon="format_indent_decrease" title={pmT('Outdent')} color={text} disabled={!hasSelection} onPress={withSel(crud.outdent)} />
      <PMIconButton testID="pm-tree-indent" icon="format_indent_increase" title={pmT('Indent')} color={text} disabled={!hasSelection} onPress={withSel(crud.indent)} />
      <PMToolbarDivider color={palette.border} />
      <PMIconButton testID="pm-tree-edit" icon="edit" title={pmT('Edit selected')} color={text} disabled={!hasSelection} onPress={withSel(crud.edit)} />
      <PMIconButton testID="pm-tree-duplicate" icon="control_point_duplicate" title={pmT('Duplicate selected (copy below)')} color={text} disabled={!hasSelection} onPress={withSel(crud.duplicateTask)} />
      <PMIconButton testID="pm-tree-delete" icon="delete" title={pmT('Delete selected')} color={palette.error} disabled={!hasSelection} onPress={withSel(crud.deleteTask)} />
      {checkedCount > 0 && (
        <>
          <PMToolbarDivider color={palette.border} />
          <PMIconButton testID="pm-tree-clear-checked" icon="deselect" label={`${checkedCount}`} title={`${checkedCount} row(s) selected with the check boxes - clear the selection`} color={palette.primary} onPress={() => usePMStore.getState().clearChecked()} />
          <PMIconButton testID="pm-tree-delete-checked" icon="delete_sweep" title={`Delete the ${checkedCount} selected row(s)`} color={palette.error} onPress={() => crud.deleteTasks(Object.keys(usePMStore.getState().checkedGUIDs))} />
        </>
      )}
      <PMToolbarSpacer />
      {(filterCount > 0 || sorted) && (
        <PMIconButton
          testID="pm-tree-clear-filters"
          icon="filter_alt_off"
          title={`Clear all filters and sorting${filterCount ? ` (${filterCount} filtered column${filterCount === 1 ? '' : 's'}${matchCount !== null ? `, ${matchCount} matching row${matchCount === 1 ? '' : 's'}` : ''})` : ''}`}
          color={filterCount ? filterIconColor : text}
          badge={filterCount || undefined}
          onPress={crud.clearTreeColumnsFilters}
        />
      )}
      <PMIconButton
        testID="pm-tree-toggle-select-column"
        icon="checklist"
        title={hideSelectColumn ? 'Show the select lines column (check boxes)' : 'Hide the select lines column (check boxes)'}
        color={text}
        active={!hideSelectColumn}
        activeColor={palette.primary}
        onPress={toggleSelectColumn}
      />
      <PMIconButton
        testID="pm-tree-toggle-numbers"
        icon="format_list_numbered"
        title={showNumbers ? 'Hide hierarchy numbers (# column)' : 'Show hierarchy numbers (# column)'}
        color={text}
        active={showNumbers}
        activeColor={palette.primary}
        onPress={crud.toggleTreeHierarchyNumbers}
      />
      <PMIconButton testID="pm-tree-expand-all" icon="unfold_more" title={pmT('Expand all')} color={text} onPress={() => usePMStore.getState().setAllExpanded(true)} />
      <PMIconButton testID="pm-tree-collapse-all" icon="unfold_less" title={pmT('Collapse all')} color={text} onPress={() => usePMStore.getState().setAllExpanded(false)} />
    </PMToolbar>
  );
}
