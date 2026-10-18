import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import PMTaskEditWindow from '../../../../../kit8/pm/view/task/edit/PMTaskEditWindow';
import { parseTaskEditWindowParams } from '../../../../../kit8/pm/view/task/edit/taskEditWindowLink';

// route: /pm/project/task/edit?taskGUID=<uuid>&projectGUID=<uuid, optional>&tab=TabTaskEditMain|TabTaskEditPlan
// the task in a window of its own (a double click on the Gantt chart): tabs TabTaskEditMain (the task form) and TabTaskEditPlan (the lines of the task)
export default function PMTaskEditWindowRoute() {
  const params = useLocalSearchParams();
  const { taskGUID, projectGUID, tab } = parseTaskEditWindowParams(params);
  return <PMTaskEditWindow key={taskGUID} taskGUID={taskGUID} projectGUID={projectGUID} tab={tab} />;
}
