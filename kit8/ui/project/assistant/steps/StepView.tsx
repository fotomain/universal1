// StepView - the body of the current step.
import React from 'react';
import type { AssistantStepId } from '../model/assistantModel';
import IdentityStep from './IdentityStep';
import ScheduleStep from './ScheduleStep';
import PlanningStep from './PlanningStep';
import TimeOfDayStep from './TimeOfDayStep';
import OptimizationStep from './OptimizationStep';
import CurrenciesStep from './CurrenciesStep';
import BudgetsStep from './BudgetsStep';
import ResourcesStep from './ResourcesStep';
import ControlStep from './ControlStep';
import ReviewStep from './ReviewStep';
import type { AssistantStepProps } from './stepProps';

const VIEWS: Record<AssistantStepId, React.ComponentType<AssistantStepProps>> = {
  identity: IdentityStep,
  schedule: ScheduleStep,
  planning: PlanningStep,
  timeOfDay: TimeOfDayStep,
  currencies: CurrenciesStep,
  budgets: BudgetsStep,
  resources: ResourcesStep,
  optimization: OptimizationStep,
  control: ControlStep,
  review: ReviewStep,
};

export default function StepView({ stepId, ...props }: AssistantStepProps & { stepId: AssistantStepId }) {
  const View = VIEWS[stepId];
  return <View {...props} />;
}
