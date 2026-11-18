import React from 'react';
import CreateNewProjectAssistant from '../../../../kit8/ui/project/assistant/create/CreateNewProjectAssistant';

// route: /pm/project/assistant (the first screen: Assistant mode | Manual input | Import Project); ?mode=assistant&target=new|<projectGUID> skips the first screen
export default function CreateNewProjectAssistantRoute() {
  return <CreateNewProjectAssistant />;
}
