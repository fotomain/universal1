// pmNumberColumn - spread it into an editable `number` / `integer` column of a ReusableTable to edit the cell with PMNumberInputApp:
//   { key: 'qty', type: 'number', field: 'qtyTaskLine', min: 0, ...pmNumberColumn(taskLineTable, 'qtyTaskLine') }
// PMNumberInputApp is loaded when a cell is drawn (not when the column list is built): the column files are plain models that tests and SQL tools import
// without the design system.
import React from 'react';
import type { NumberCellRenderProps } from '../../ui/components/table/reusable/reusableTableTypes';

export function pmNumberColumn(tableName: string, tableFieldName: string, positiveOnly = true): { renderNumber: (p: NumberCellRenderProps) => React.ReactNode } {
  return {
    renderNumber: (p) => {
      const PMNumberInputApp = require('./PMNumberInputApp').default;
      return <PMNumberInputApp tableName={tableName} tableFieldName={tableFieldName} positiveOnly={positiveOnly} {...p} />;
    },
  };
}
