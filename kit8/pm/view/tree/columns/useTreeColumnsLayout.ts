// Column layout of the tree for the selected project: order + "#" switch + widths + custom columns
// from the store (which mirrors project_table.rowJSON.uxuiSettings / rowJSON.customColumns).
// `liveWidth` = a column being resized right now (not saved yet).

import { useMemo } from 'react';
import { usePMStore } from '../../../store/store_pm';
import { layoutTreeColumns, PMTreeColumnKey, PMTreeColumnsLayout } from './treeColumns';

export function useTreeColumnsLayout(width: number, liveWidth?: { key: PMTreeColumnKey; width: number } | null): PMTreeColumnsLayout {
  const order = usePMStore((s) => s.treeColumnsOrder);
  const showHierarchyNumbers = usePMStore((s) => s.showTreeHierarchyNumbers);
  const savedWidths = usePMStore((s) => s.treeColumnsWidths);
  const customColumns = usePMStore((s) => s.customColumns);
  const liveKey = liveWidth?.key;
  const liveW = liveWidth?.width;
  return useMemo(() => {
    const widths = liveKey ? { ...savedWidths, [liveKey]: liveW! } : savedWidths;
    return layoutTreeColumns(width, order, { showHierarchyNumbers, widths, customColumns });
  }, [width, order, showHierarchyNumbers, savedWidths, customColumns, liveKey, liveW]);
}
