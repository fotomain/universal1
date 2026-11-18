// useCreateAssistant - the logic of the Create New Project Assistant screen: the answers, the steps, the saved run, the hand over to the New project window.
//   * phase 'start'  = the first screen (How do you want to create the project?), 'resume' = the assistant was called for a window and has an unfinished run, 'steps' = the questions
//   * every change of an answer is saved on the device (debounced) and when the user leaves: the next run offers to continue
//   * Create / Open in window = the answers go to the project window through the PM store (PMRecentProjectsToolbar fills it, and saves it at once for "Create")
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { usePMStore } from '../../../../pm/store/store_pm';
import {
  assistantPatchFor,
  assistantValuesFrom,
  firstStepWithError,
  hasMeaningfulInput,
  stepNotes,
  todayISO,
  type AssistantContext,
  type AssistantStepId,
  type AssistantValues,
} from '../model/assistantModel';
import { assistantFlowReducer, initialFlow, type AssistantFlowState } from '../model/assistantFlow';
import { assistantStorageKey, clearSavedRun, loadSavedRun, saveRun, type AssistantSavedRun } from '../model/assistantStorage';
import type { AssistantEnvironment } from './useAssistantEnvironment';

const SAVE_DELAY_MS = 400;

export interface UseCreateAssistantArgs {
  env: AssistantEnvironment;
  /** 'new' or the GUID of the project the assistant is called for */
  target: string;
  /** 'assistant' = called for a window (three dots menu): no first screen */
  mode?: string;
  /** called when the run is over: the screen leaves */
  onLeave: (reason: 'finished' | 'exit') => void;
  today?: string;
}

export function useCreateAssistant({ env, target, mode, onLeave, today = todayISO() }: UseCreateAssistantArgs) {
  const storageKey = assistantStorageKey(env.userKey, target);

  const ctx: AssistantContext = useMemo(() => {
    return { target, projectCount: env.projectCount, existingNames: env.existingNames, consolidationCurrency: env.consolidationCurrency, today };
  }, [target, env, today]);

  // the starting answers: the seed of the window it was called from, else the project, else the settings of the organization
  const seedValues = useCallback((): AssistantValues => {
    const seed = usePMStore.getState().projectAssistantSeed;
    if (seed && seed.target === target) return assistantValuesFrom(seed.values, today);
    if (target !== 'new') return assistantValuesFrom(env.projectJSONOf(target), today);
    return assistantValuesFrom({ ...(env.organizationDefaults || {}), ...(env.organizationCurrencies.currencyForBudget ? env.organizationCurrencies : {}) }, today);
  }, [target, env, today]);

  const reducer = useMemo(() => assistantFlowReducer(ctx), [ctx]);
  const [state, dispatch] = useReducer(reducer, undefined as unknown as AssistantFlowState, () => initialFlow(assistantValuesFrom(null, today), mode === 'assistant' ? 'steps' : 'start'));

  // ---- the saved run of this user and target
  const [saved, setSaved] = useState<AssistantSavedRun | null | undefined>(undefined); // undefined = still reading
  useEffect(() => {
    let alive = true;
    loadSavedRun(storageKey, undefined, today).then((r) => {
      if (!alive) return;
      const usable = r && hasMeaningfulInput(r.values, today) ? r : null;
      setSaved(usable);
      // called for a window: offer the saved run before the first question
      if (usable && mode === 'assistant') dispatch({ type: 'phase', phase: 'resume' });
    });
    return () => {
      alive = false;
    };
  }, [storageKey, mode, today]);

  // ---- save while the user answers (and once more when the screen closes)
  const latest = useRef(state);
  latest.current = state;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finished = useRef(false);
  const persist = useCallback(() => {
    const s = latest.current;
    if (finished.current || s.phase !== 'steps') return;
    saveRun(storageKey, { target, values: s.values, stepId: s.stepId, reached: s.reached });
  }, [storageKey, target]);
  useEffect(() => {
    if (state.phase !== 'steps') return undefined;
    timer.current = setTimeout(persist, SAVE_DELAY_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state.values, state.stepId, state.reached, state.phase, persist]);
  useEffect(() => () => persist(), [persist]);

  // ---- the first screen
  const startAssistant = useCallback(() => {
    clearSavedRun(storageKey);
    setSaved(null);
    dispatch({ type: 'start', values: seedValues() });
    usePMStore.getState().setProjectAssistantSeed(null);
  }, [seedValues, storageKey]);

  const resume = useCallback(() => {
    if (!saved) return startAssistant();
    dispatch({ type: 'restore', values: saved.values, stepId: saved.stepId, reached: saved.reached });
  }, [saved, startAssistant]);

  // a call for a window with nothing saved starts at once (the seed is read when the organization is known)
  const started = useRef(false);
  useEffect(() => {
    if (started.current || mode !== 'assistant' || saved === undefined || saved !== null) return;
    if (target === 'new' && !env.organizationLoaded && !usePMStore.getState().projectAssistantSeed) return;
    started.current = true;
    dispatch({ type: 'start', values: seedValues() });
    usePMStore.getState().setProjectAssistantSeed(null);
  }, [mode, saved, target, env.organizationLoaded, seedValues]);

  // ---- hand over
  const notes = useMemo(() => (state.phase === 'steps' ? stepNotes(state.stepId, state.values, ctx) : []), [state.phase, state.stepId, state.values, ctx]);
  const blocking = useMemo(() => firstStepWithError(state.values, ctx), [state.values, ctx]);

  const finish = useCallback(
    async (createNow: boolean): Promise<{ ok: boolean; message?: string }> => {
      if (blocking) {
        dispatch({ type: 'goto', stepId: blocking });
        return { ok: false, message: 'Some answers must be corrected first.' };
      }
      finished.current = true;
      if (timer.current) clearTimeout(timer.current);
      await clearSavedRun(storageKey);
      usePMStore.getState().setProjectAssistantSeed(null);
      usePMStore.getState().applyProjectAssistant({ target, patch: assistantPatchFor(state.values, ctx), createNow });
      dispatch({ type: 'phase', phase: 'done' });
      onLeave('finished');
      return { ok: true };
    },
    [blocking, state.values, ctx, env, storageKey, target, onLeave],
  );

  /** "Save and exit": the answers stay on the device */
  const exit = useCallback(() => {
    persist();
    onLeave('exit');
  }, [persist, onLeave]);

  const goBack = useCallback(() => {
    if (state.phase === 'steps') {
      if (state.stepId === 'identity') {
        // the first question: back = the first screen (or out, when there is none)
        if (mode === 'assistant') return exit();
        persist();
        return dispatch({ type: 'phase', phase: 'start' });
      }
      return dispatch({ type: 'back' });
    }
    if (state.phase === 'resume' && saved === null) return exit();
    return onLeave('exit');
  }, [state.phase, state.stepId, mode, exit, persist, saved, onLeave]);

  return {
    state,
    ctx,
    notes,
    blocking,
    saved: saved ?? null,
    savedLoaded: saved !== undefined,
    change: (patch: Partial<AssistantValues>) => dispatch({ type: 'change', patch }),
    next: () => dispatch({ type: 'next' }),
    goBack,
    jump: (id: AssistantStepId) => dispatch({ type: 'goto', stepId: id }),
    startAssistant,
    resume,
    finish,
    exit,
  };
}
