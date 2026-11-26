// ReusableList - the commands of the default card FAB (pure, no React): which standard commands a card's FAB shows for ONE row.
// The same rules as the row menu (ReusableTableRowMenu): Edit only with an edit card / onRowOpen, Add / Duplicate only while the list may add rows and has no own `onAdd`,
// Move only in the stored order, Delete only when the user may delete. Archive / Restore = `rowJSON.rowIsArchived` (the swipe's archive), offered by `archiveOffered`.
import type { CardFabAction } from '../cards/CardLocalFab';
import type { ReusableListRowActions } from './reusableListTypes';

export interface RowFabInput {
  guid: string;
  /** 'Project' -> "Add project above" */
  itemLabel: string;
  openLabel?: string;
  actions: ReusableListRowActions;
  canOpen: boolean;
  canEdit: boolean;
  /** the list may make rows AND has no own `onAdd` (a host that makes its rows itself hides the generic Add / Duplicate) */
  canAdd: boolean;
  canDelete: boolean;
  /** the ⠿ grip works now: stored order, no search / sort / filter */
  canMove: boolean;
  /** the list offers Archive for this row (archiveOffered + canEdit + canArchiveRow) */
  archiveOffered: boolean;
  archived: boolean;
  testPrefix: string;
  /** commands of the host, before the standard ones */
  extra?: CardFabAction[];
}

export function buildRowFabActions(i: RowFabInput): CardFabAction[] {
  const lower = i.itemLabel.toLowerCase();
  const id = (s: string) => `${i.testPrefix}-${s}`;
  const g = i.guid;
  const a = i.actions;
  return [
    ...(i.extra ?? []),
    ...(i.canOpen && i.canEdit ? [{ icon: 'pencil', label: i.openLabel ?? `Edit ${lower}`, onPress: () => a.edit(g), testID: id('edit') }] : []),
    ...(i.canAdd ? [
      { icon: 'table-row-plus-after', label: `Add ${lower} below`, onPress: () => a.createAfter(g), testID: id('add-below') },
      { icon: 'table-row-plus-before', label: `Add ${lower} above`, onPress: () => a.createBefore(g), testID: id('add-above') },
      { icon: 'content-copy', label: 'Duplicate', onPress: () => a.duplicate(g), testID: id('duplicate') },
    ] : []),
    ...(i.canMove ? [
      { icon: 'arrow-up', label: 'Move up', onPress: () => a.moveUp(g), testID: id('move-up') },
      { icon: 'arrow-down', label: 'Move down', onPress: () => a.moveDown(g), testID: id('move-down') },
    ] : []),
    ...(i.archiveOffered ? [{ icon: i.archived ? 'archive-arrow-up' : 'archive-arrow-down', label: i.archived ? 'Restore' : 'Archive', onPress: () => a.archive(g), testID: id('archive') }] : []),
    ...(i.canDelete ? [{ icon: 'delete', label: 'Delete', color: '#ef4444', onPress: () => a.remove(g), testID: id('delete') }] : []),
  ];
}
