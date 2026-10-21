import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import PMTimesheetDocumentList from '../../../../kit8/documents/timesheet/PMTimesheetDocumentList';
import { parseTaskScope } from '../../../../kit8/documents/taskScope/taskScopeModel';

// route: /pm/timesheet/list[?taskGUID=<uuid>] - the list of the time sheets (hamburger menu → Documents → Time sheets): quick filters; a click on a row opens the sheet.
// With taskGUID (menu "Go to → Time sheets" of a task) only the sheets that have a line of that task, with a chip to clear it.
export default function TimesheetListRoute() {
  const params = useLocalSearchParams<{ taskGUID?: string }>();
  const scope = parseTaskScope(params as any);
  return (
    <View style={{ flex: 1 }}>
      <PMTimesheetDocumentList taskGUID={scope.taskGUID} />
    </View>
  );
}
