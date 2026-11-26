// The columns (the SCHEMA) of the Projects list of ReusableList: what the search looks in and what the Sort and Filter menu offers. ProjectCardForList draws the item itself.
import type { VisualColumn } from '../../ui/components/table/reusable/reusableTableTypes';

export const PROJECT_LIST_COLUMNS: VisualColumn[] = [
  { key: 'name', title: 'Name', type: 'text', field: 'name', listRole: 'title' },
  { key: 'start', title: 'Start', type: 'text', field: 'projectStartAt', listRole: 'subtitle', editable: false },
];
