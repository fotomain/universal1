// SelectCatalogItemFromTreeReusable - choose ONE item of a catalog that is a TREE (business units ...): a field (the path of the chosen item, a clear button) that
// opens a modal with the tree (CatalogTreePicker -> FolderTreeReusable, read-only) with a SEARCH box (substring of a title) and the counts of the sub-items.
// Counterpart of SelectElementFromCatalog (a flat list); fits a table cell (`compact`) as well as a form (`label`).
//   <SelectCatalogItemFromTreeReusable nodes={nodes} value={guid} onChange={(guid) => ...} isSelectable={(id) => ...} reasonWhy={(id) => '...'} />
// `nodes` = FolderTreeNode[] (id, parentId, title); the catalog's own mapper makes them (businessUnitNodes). `pathOf` = the text of the field (default: the titles from the
// top down joined with ' › '). `isSelectable` / `reasonWhy`: a node that cannot be chosen says why when it is pressed (a cost line cannot go to a revenue center).
import React, { useMemo, useState } from 'react';
import SelectFieldBox from '../SelectFieldBox';
import CatalogTreePicker from '../../../ui/components/tree/CatalogTreePicker';
import { treePathText, type FolderTreeNode } from '../../../ui/components/tree/folderTreeModel';

export interface SelectCatalogItemFromTreeReusableProps {
  nodes: FolderTreeNode[];
  /** the id of the item chosen now */
  value?: string | null;
  onChange: (id: string | null) => void;
  /** which items can be chosen (default: every one) */
  isSelectable?: (id: string) => boolean;
  /** why an item cannot be chosen (shown in the window when it is pressed) */
  reasonWhy?: (id: string) => string;
  /** text of the field for an id (default: the path through the tree) */
  pathOf?: (id: string) => string;
  /** label above the field (not in a table cell: the column header is enough) */
  label?: string;
  /** title of the window (default: the label) */
  title?: string;
  placeholder?: string;
  /** may the field be empty? (default true) */
  allowClear?: boolean;
  disabled?: boolean;
  /** something is wrong: the field turns red and says what */
  error?: string;
  /** icon in front of the text (default account_tree) */
  icon?: string;
  /** the counts of the sub-items beside every node (default true) */
  showCounts?: boolean;
  /** low field (about 30 px) for dense places such as table rows */
  compact?: boolean;
  /** extra style of the field box (e.g. { borderRadius: 0, backgroundColor: 'transparent' } inside a table cell) */
  triggerStyle?: any;
  searchPlaceholder?: string;
  testID?: string;
}

export { treePathText };

/** the number of direct sub-items of each node (the tree adds up the levels below, as in the catalog tree) */
export function subItemCounts(nodes: FolderTreeNode[]): Map<string, number> {
  const ids = new Set(nodes.map((n) => n.id));
  const counts = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (const n of nodes) if (n.parentId && ids.has(n.parentId)) counts.set(n.parentId, (counts.get(n.parentId) ?? 0) + 1);
  return counts;
}

export default function SelectCatalogItemFromTreeReusable({
  nodes, value, onChange, isSelectable, reasonWhy, pathOf, label, title, placeholder = 'Select…', allowClear = true, disabled = false, error, icon = 'account_tree',
  showCounts = true, compact = false, triggerStyle, searchPlaceholder = 'Search…', testID = 'select-catalog-item-from-tree',
}: SelectCatalogItemFromTreeReusableProps) {
  const [open, setOpen] = useState(false);
  const counts = useMemo(() => (showCounts ? subItemCounts(nodes) : undefined), [nodes, showCounts]);
  const text = value ? (pathOf ? pathOf(value) : treePathText(nodes, value)) : '';
  const pick = (id: string | null) => { setOpen(false); onChange(id); };
  return (
    <SelectFieldBox
      text={text} placeholder={placeholder} label={label} accessibilityLabel={title} icon={icon} allowClear={allowClear} disabled={disabled} error={error} compact={compact} triggerStyle={triggerStyle}
      onOpen={() => setOpen(true)} onClear={() => onChange(null)} testID={testID}
    >
      {open && (
        <CatalogTreePicker
          visible
          nodes={nodes}
          value={value}
          title={title ?? label ?? 'Select'}
          isSelectable={isSelectable}
          reasonWhy={reasonWhy}
          itemCounts={counts}
          searchPlaceholder={searchPlaceholder}
          onPick={(id) => pick(id)}
          onClose={() => setOpen(false)}
          testID={`${testID}-picker`}
        />
      )}
    </SelectFieldBox>
  );
}
