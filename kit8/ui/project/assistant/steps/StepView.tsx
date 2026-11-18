// StepView - the body of the current step.
import React from 'react';
import type { AssistantStepId } from '../model/assistantModel';
import IdentityStep from './IdentityStep';
import ScheduleStep from './ScheduleStep';
import CurrenciesStep from './CurrenciesStep';
import BudgetsStep from './BudgetsStep';
import ResourcesStep from './ResourcesStep';
import ControlStep from './ControlStep';
import ReviewStep from './ReviewStep';
import type { AssistantStepProps } from './stepProps';

const VIEWS: Record<AssistantStepId, React.ComponentType<AssistantStepProps>> = {
  identity: IdentityStep,
  schedule: ScheduleStep,
  currencies: CurrenciesStep,
  budgets: BudgetsStep,
  resources: ResourcesStep,
  control: ControlStep,
  review: ReviewStep,
};

export default function StepView({ stepId, ...props }: AssistantStepProps & { stepId: AssistantStepId }) {
  const View = VIEWS[stepId];
  return <View {...props} />;
}
