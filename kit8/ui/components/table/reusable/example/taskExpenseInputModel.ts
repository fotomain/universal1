// TableExample2 - "many catalog GUIDs in one table": input and storage pattern.
//   Entity name: task_expense_input_table      SQL: public.task_expense_input_table
//   (kit8/sql/init/create_task_expense_input_table.sql, kit8/sql/defTable.md pattern)
//     rowGUID        the expense line
//     rowOwnerGUID   the more generic entity  = the project  (project_table.rowGUID)
//     rowParentGUID  one level higher         = the task     (project_task_table.rowGUID)
//     orderInList    the order of the lines (drag & drop)
//     rowJSON        { personGUID, contractGUID, hours }
//   Only GUIDs are stored; the titles are read from the catalogs when the table is shown.
import { PERSON_CATALOG_OWNER, PERSON_ENTITY, PERSON_ROUTES } from '../../../../../catalog/person/personModel';
import { CONTRACT_ENTITY } from '../../../../../catalog/contract/contractModel';
import type { VisualColumn } from '../reusableTableTypes';

/** Supabase table name. */
export const taskExpenseInputTable = 'task_expense_input_table';
/** SystemMetaData / redux entity key. */
export const TASK_EXPENSE_INPUT_ENTITY = 'task_expense_input_table';

export interface TaskExpenseInputRowJSON {
  /** personTable.rowGUID */
  personGUID: string | null;
  /** contractTable.rowGUID - a contract of THAT person (contract.rowOwnerGUID = personGUID) */
  contractGUID: string | null;
  /** integer >= 0 */
  hours: number | null;
}

export const emptyTaskExpenseInput = (): TaskExpenseInputRowJSON => ({ personGUID: null, contractGUID: null, hours: null });

/** person.rowJSON -> "first name + last name" */
export const personFullName = (person: any): string => {
  const j = person?.rowJSON || {};
  return [j.personFirstName, j.personLastName].filter(Boolean).join(' ').trim() || j.personTitle || person?.rowGUID || '';
};

export const taskExpenseInputColumns: VisualColumn[] = [
  { key: 'tableRowNumber', title: '#', type: 'rowNumber' },
  {
    key: 'person', title: 'Person', type: 'catalog', field: 'personGUID', width: 230,
    catalogEntityName: PERSON_ENTITY, catalogRowOwnerGUID: PERSON_CATALOG_OWNER,
    titleExtractor: personFullName, placeholder: 'Select person…',
    // … = the person's page
    detailsRoute: PERSON_ROUTES.edit,
  },
  {
    key: 'contract', title: 'Contract', type: 'catalog', field: 'contractGUID', width: 260,
    catalogEntityName: CONTRACT_ENTITY, catalogRowParentGUID: 'person',
    // the contracts of the person selected in the previous column
    dependsOn: 'person', dependsOnMessage: 'Select a person first', placeholder: 'Select contract…',
    // a contract has no page of its own: … opens its person, whose page lists and edits the contracts
    detailsRoute: (_guid, row) => (row.rowJSON?.personGUID ? { pathname: PERSON_ROUTES.edit, params: { rowGUID: String(row.rowJSON.personGUID) } } : null),
  },
  { key: 'hours', title: 'Hours', type: 'integer', field: 'hours', width: 130, min: 0, max: 100000 },
];
