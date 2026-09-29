// Column layout of the tree for the selected project (order + "#" switch from the store,
// which mirrors project_table.rowJSON.uxuiSettings).

import { useMemo } from 'react';
import { usePMStore } from '../../store';
import { layoutTreeColumns, PMTreeColumnsLayout } from './treeColumns';

export function useTreeColumnsLayout(width: number): PMTreeColumnsLayout {
  const order = usePMStore((s) => s.treeColumnsOrder);
  const showHierarchyNumbers = usePMStore((s) => s.showTreeHierarchyNumbers);
  return useMemo(() => layoutTreeColumns(width, order, { showHierarchyNumbers }), [width, order, showHierarchyNumbers]);
}
