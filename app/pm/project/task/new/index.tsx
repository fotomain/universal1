import React from 'react';
import PMNewTaskFromIntent from '../../../../../kit8/pm/view/task/PMNewTaskFromIntent';

// route: /pm/project/task/new  (new task / stage: asks the project and the stage; used by the share intent)
export default function PMNewTaskRoute() {
  return <PMNewTaskFromIntent />;
}
