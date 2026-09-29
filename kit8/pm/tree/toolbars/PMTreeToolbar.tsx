// PMTreeToolbar - tree container CRUD toolbar (above the tree canvas):
// add stage / task / milestone · move up / down · outdent / indent · edit / duplicate / delete ·
// "#" hierarchy numbers on / off (uxuiSettings.showTreeHierarchyNumbers) · expand / collapse all.

import React from 'react';
import { usePMStore } from '../../store';
import { PMPalette } from '../../theme';
import { PMCrud } from '../../usePMCrud';
import { PMToolbar, PMToolbarDivider, PMToolbarSpacer } from '../../inner/toolbars/PMToolbarPrimitives';
import { PMIconButton } from '../../inner/buttons/PMIconButton';

export default function PMTreeToolbar({ crud, palette }: { crud: PMCrud; palette: PMPalette }) {
  const selectedGUID = usePMStore((s) => s.selectedGUID);
  const hasSelection = usePMStore((s) => !!(s.selectedGUID && s.tasksById[s.selectedGUID]));
  const showNumbers = usePMStore((s) => s.showTreeHierarchyNumbers);
  const text = palette.text;
  const withSel = (fn: (guid: string) => void) => () => {
    const g = usePMStore.getState().selectedGUID;
    if (g && usePMStore.getState().tasksById[g]) fn(g);
  };

  return (
    <PMToolbar background={palette.surface} border={palette.border}>
      <PMIconButton testID="pm-tree-add-stage" icon="create_new_folder" label="Stage" title="Add stage" color={palette.primary} onPress={() => crud.createStage(selectedGUID)} />
      <PMIconButton testID="pm-tree-add-task" icon="add" label="Task" title="Add task (inside the selected stage / after the selected task)" color={palette.primary} onPress={() => crud.createTask(selectedGUID)} />
      <PMIconButton testID="pm-tree-add-milestone" icon="flag" title="Add milestone" color={palette.primary} onPress={() => crud.createTask(selectedGUID, 'milestone')} />
      <PMToolbarDivider color={palette.border} />
      <PMIconButton testID="pm-tree-move-up" icon="arrow_upward" title="Move up" color={text} disabled={!hasSelection} onPress={withSel((g) => crud.moveBy(g, -1))} />
      <PMIconButton testID="pm-tree-move-down" icon="arrow_downward" title="Move down" color={text} disabled={!hasSelection} onPress={withSel((g) => crud.moveBy(g, 1))} />
      <PMIconButton testID="pm-tree-outdent" icon="format_indent_decrease" title="Outdent" color={text} disabled={!hasSelection} onPress={withSel(crud.outdent)} />
      <PMIconButton testID="pm-tree-indent" icon="format_indent_increase" title="Indent" color={text} disabled={!hasSelection} onPress={withSel(crud.indent)} />
      <PMToolbarDivider color={palette.border} />
      <PMIconButton testID="pm-tree-edit" icon="edit" title="Edit selected" color={text} disabled={!hasSelection} onPress={withSel(crud.edit)} />
      <PMIconButton testID="pm-tree-duplicate" icon="control_point_duplicate" title="Duplicate selected (copy below)" color={text} disabled={!hasSelection} onPress={withSel(crud.duplicateTask)} />
      <PMIconButton testID="pm-tree-delete" icon="delete" title="Delete selected" color={palette.error} disabled={!hasSelection} onPress={withSel(crud.deleteTask)} />
      <PMToolbarSpacer />
      <PMIconButton
        testID="pm-tree-toggle-numbers"
        icon="format_list_numbered"
        title={showNumbers ? 'Hide hierarchy numbers (# column)' : 'Show hierarchy numbers (# column)'}
        color={text}
        active={showNumbers}
        activeColor={palette.primary}
        onPress={crud.toggleTreeHierarchyNumbers}
      />
      <PMIconButton testID="pm-tree-expand-all" icon="unfold_more" title="Expand all" color={text} onPress={() => usePMStore.getState().setAllExpanded(true)} />
      <PMIconButton testID="pm-tree-collapse-all" icon="unfold_less" title="Collapse all" color={text} onPress={() => usePMStore.getState().setAllExpanded(false)} />
    </PMToolbar>
  );
}
