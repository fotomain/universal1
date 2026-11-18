// assistantFlow - the state machine of the assistant screens (pure reducer, unit-tested): where the user is, which steps he has seen, what he answered.
// "Back" and the navigation line only walk over steps already seen (or the one before the current): the user can always go back, never skips a question ahead.
import {
  nextStepId,
  previousStepId,
  stepNotes,
  hasError,
  visibleSteps,
  type AssistantContext,
  type AssistantStepId,
  type AssistantValues,
} from './assistantModel';

export type AssistantPhase = 'resume' | 'start' | 'steps' | 'done';

export interface AssistantFlowState {
  phase: AssistantPhase;
  values: AssistantValues;
  stepId: AssistantStepId;
  /** the steps seen so far, in the order of the steps */
  reached: AssistantStepId[];
}

export type AssistantFlowAction =
  | { type: 'change'; patch: Partial<AssistantValues> }
  | { type: 'phase'; phase: AssistantPhase }
  | { type: 'start'; values: AssistantValues }
  | { type: 'restore'; values: AssistantValues; stepId: AssistantStepId; reached: AssistantStepId[] }
  | { type: 'goto'; stepId: AssistantStepId }
  | { type: 'next' }
  | { type: 'back' };

export const initialFlow = (values: AssistantValues, phase: AssistantPhase): AssistantFlowState => ({ phase, values, stepId: 'identity', reached: ['identity'] });

const withReached = (reached: AssistantStepId[], id: AssistantStepId, v: AssistantValues, ctx: AssistantContext): AssistantStepId[] =>
  visibleSteps(v, ctx).filter((s) => reached.includes(s) || s === id);

/** can the user press Next on this step? (an error blocks it) */
export const canGoNext = (state: AssistantFlowState, ctx: AssistantContext): boolean =>
  state.stepId !== 'review' && !hasError(stepNotes(state.stepId, state.values, ctx));

/** may the navigation line jump to this step? (a step already seen, or the current one) */
export const canJumpTo = (state: AssistantFlowState, id: AssistantStepId, ctx: AssistantContext): boolean =>
  visibleSteps(state.values, ctx).includes(id) && (state.reached.includes(id) || id === state.stepId);

export function assistantFlowReducer(ctx: AssistantContext) {
  return (state: AssistantFlowState, action: AssistantFlowAction): AssistantFlowState => {
    switch (action.type) {
      case 'change': {
        const values = { ...state.values, ...action.patch };
        // answers can hide the current step (cost budget off hides Resources): stay on a visible one
        const list = visibleSteps(values, ctx);
        const stepId = list.includes(state.stepId) ? state.stepId : list[list.length - 1];
        return { ...state, values, stepId, reached: state.reached.filter((s) => list.includes(s)) };
      }
      case 'phase':
        return { ...state, phase: action.phase };
      case 'start':
        return { phase: 'steps', values: action.values, stepId: 'identity', reached: ['identity'] };
      case 'restore': {
        const list = visibleSteps(action.values, ctx);
        const stepId = list.includes(action.stepId) ? action.stepId : list[0];
        const reached = list.filter((s) => action.reached.includes(s) || s === stepId);
        return { phase: 'steps', values: action.values, stepId, reached };
      }
      case 'goto':
        return canJumpTo(state, action.stepId, ctx) ? { ...state, stepId: action.stepId } : state;
      case 'next': {
        if (!canGoNext(state, ctx)) return state;
        const id = nextStepId(state.stepId, state.values, ctx);
        return id ? { ...state, stepId: id, reached: withReached(state.reached, id, state.values, ctx) } : state;
      }
      case 'back': {
        const id = previousStepId(state.stepId, state.values, ctx);
        return id ? { ...state, stepId: id } : state;
      }
      default:
        return state;
    }
  };
}
