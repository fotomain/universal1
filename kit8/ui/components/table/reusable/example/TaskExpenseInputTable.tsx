// TableExample2: the expense lines of ONE task (person · contract of that person · hours).
import React from 'react';
import ReusableTable from '../ReusableTable';
import type { ReusableTableUxUi } from '../reusableTableTypes';
import { usePMStore } from '../../../../../pm/store/store_pm';
import { emptyTaskExpenseInput, TASK_EXPENSE_INPUT_ENTITY, taskExpenseInputColumns } from './taskExpenseInputModel';

export interface TaskExpenseInputTableProps {
  /** project_table.rowGUID -> rowOwnerGUID */
  projectGUID?: string;
  /** project_task_table.rowGUID -> rowParentGUID */
  taskGUID: string;
  title?: string;
  uxuiTable?: ReusableTableUxUi;
  testID?: string;
}

export default function TaskExpenseInputTable({ projectGUID, taskGUID, title = 'Task expenses', uxuiTable, testID = 'task-expense-table' }: TaskExpenseInputTableProps) {
  // project UX/UI setting (Gantt UX/UI settings -> Tree): round (default) or square "select row" check boxes
  const selectRowCheckBoxForm = usePMStore((s) => s.selectRowCheckBoxForm);
  return (
    <ReusableTable
      uxuiTable={uxuiTable}
      selectRowCheckBoxForm={selectRowCheckBoxForm}
      dragAndDropColumns
      resizeColumnWidth
      testID={testID}
      entityName={TASK_EXPENSE_INPUT_ENTITY}
      crudListTitle={title}
      itemLabel="Expense"
      listOwnerGUID={projectGUID}
      listParentGUID={taskGUID}
      visualColumns={taskExpenseInputColumns}
      defaultRowJSON={emptyTaskExpenseInput}
      realtime
    />
  );
}
