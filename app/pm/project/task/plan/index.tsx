import React from 'react';
import { ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import PMProjectTaskTimelinePlanCRUD from '../../../../../kit8/pm/view/task/plan/PMProjectTaskTimelinePlanCRUD';

// route: /pm/project/task/plan?taskGUID=<uuid>&projectGUID=<uuid, optional> - the posted days (task_line_plan) of all the lines of a task, read-only
export default function PMProjectTaskPlanRoute() {
  const { taskGUID, projectGUID } = useLocalSearchParams<{ taskGUID: string; projectGUID?: string }>();
  return (
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <PMProjectTaskTimelinePlanCRUD key={taskGUID} taskGUID={String(taskGUID || '')} projectGUID={projectGUID ? String(projectGUID) : ''} />
    </ScrollView>
  );
}
