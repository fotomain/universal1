// The props every step of the assistant gets.
import type { AssistantContext, AssistantStepId, AssistantValues } from '../model/assistantModel';

export interface AssistantStepProps {
  values: AssistantValues;
  ctx: AssistantContext;
  onChange: (patch: Partial<AssistantValues>) => void;
  /** review only: jump to a step to change an answer */
  onJump?: (id: AssistantStepId) => void;
}
