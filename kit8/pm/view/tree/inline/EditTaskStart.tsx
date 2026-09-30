import React from 'react';
import { SharedValue } from 'react-native-reanimated';
import { PMCrud } from '../../../crud/usePMCrud';
import EditTaskStartDate from './EditTaskStartDate';

export default function EditTaskStart(props: {
  guid: string;
  rowIndex: number;
  x: number;
  width: number;
  scrollY: SharedValue<number>;
  crud: PMCrud;
  colors: { text: string; background: string; primary: string; error: string };
  testID?: string;
}) {
  return (
    <EditTaskStartDate
      {...props}
      testID={props.testID ?? `pm-tree-edit-start-${props.guid}`}
    />
  );
}
