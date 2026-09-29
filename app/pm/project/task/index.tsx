import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import PMProjectTaskInfo from '../../../../kit8/pm/view/task/PMProjectTaskInfo';

// route: /pm/project/task?taskGUID=<uuid>&projectGUID=<uuid, optional>
export default function PMProjectTaskRoute() {
  const { taskGUID, projectGUID } = useLocalSearchParams<{ taskGUID: string; projectGUID?: string }>();
  return <PMProjectTaskInfo key={taskGUID} taskGUID={String(taskGUID || '')} projectGUID={projectGUID ? String(projectGUID) : undefined} />;
}
