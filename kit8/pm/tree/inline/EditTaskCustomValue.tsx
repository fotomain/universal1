// Inline editor of a custom tree column cell (AddCustomProjectTaskColumn): Text / Date (YYYY-MM-DD) /
// Integer / Float / Boolean (yes / no - a click on a Boolean cell toggles it without this editor).
// Value -> project_task_table.rowJSON.customColumns[columnKey] (empty = cleared), undoable.

import React from 'react';
import { SharedValue } from 'react-native-reanimated';
import { usePMStore } from '../../store';
import { PMCrud } from '../../usePMCrud';
import {
  customColumnAlign,
  editTextOfCustomValue,
  parseCustomColumnValue,
  PMCustomColumnDef,
  taskCustomValuesOf,
} from '../columns/customColumns';
import PMInlineCellInput from './PMInlineCellInput';

const PLACEHOLDER: Record<PMCustomColumnDef['type'], string> = {
  text: '',
  date: 'YYYY-MM-DD',
  boolean: 'yes / no',
  integer: '0',
  float: '0.0',
};

export default function EditTaskCustomValue(props: {
  guid: string;
  column: PMCustomColumnDef;
  rowIndex: number;
  x: number;
  width: number;
  scrollY: SharedValue<number>;
  crud: PMCrud;
  colors: { text: string; background: string; primary: string; error: string };
}) {
  const { guid, column, crud } = props;
  const value = usePMStore((s) => taskCustomValuesOf(s.tasksById[guid]?.rowJSON)[column.key]);
  const close = () => usePMStore.getState().setCellEdit(null);
  const type = column.type;
  return (
    <PMInlineCellInput
      {...props}
      testID={`pm-tree-edit-custom-${column.key}-${guid}`}
      initial={editTextOfCustomValue(type, value)}
      placeholder={PLACEHOLDER[type]}
      align={customColumnAlign(type) === 'right' ? 'right' : 'left'}
      keyboardType={type === 'integer' ? 'numbers-and-punctuation' : type === 'float' ? 'numbers-and-punctuation' : type === 'date' ? 'numbers-and-punctuation' : 'default'}
      sanitize={
        type === 'integer'
          ? (t) => t.replace(/[^0-9+-]/g, '').slice(0, 16)
          : type === 'float'
            ? (t) => t.replace(/[^0-9eE.,+-]/g, '').slice(0, 24)
            : type === 'date'
              ? (t) => t.replace(/[^0-9-]/g, '').slice(0, 10)
              : undefined
      }
      onCommit={(text) => {
        const r = parseCustomColumnValue(type, text);
        if ('error' in r) return r.error;
        crud.setCustomColumnValue(guid, column.key, r.value);
        close();
        return null;
      }}
      onCancel={close}
    />
  );
}
