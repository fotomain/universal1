import React from 'react';
import { SharedValue } from 'react-native-reanimated';
import { PMCrud } from '../../../crud/usePMCrud';
import EditTaskDuration from './EditTaskDuration';

export default function EditTaskDays(props: {
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
    <EditTaskDuration
      {...props}
      testID={props.testID ?? `pm-tree-edit-days-${props.guid}`}
    />
  );
}
