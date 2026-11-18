// assistantStorage - the LAST INPUT of the assistant is kept on the device, so a user who stops can continue at the next run (and the assistant offers it).
// One entry per user and per target ('new' = a new project, or the GUID of the project the assistant was called for from its three dots menu).
// AsyncStorage may be missing or throw (private window, tests): every function swallows the failure and the assistant works without it.
import { sanitizeAssistantValues, type AssistantStepId, type AssistantValues, ASSISTANT_STEP_IDS } from './assistantModel';

export const ASSISTANT_STORAGE_VERSION = 1;

export interface AssistantSavedRun {
  version: number;
  target: string;
  values: AssistantValues;
  /** the step the user was on */
  stepId: AssistantStepId;
  /** the steps already seen (the navigation line lets the user jump back to them) */
  reached: AssistantStepId[];
  /** ISO time */
  savedAt: string;
}

export interface AssistantStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const assistantStorageKey = (userKey: string, target: string): string => `pm.projectAssistant.v${ASSISTANT_STORAGE_VERSION}.${userKey || 'guest'}.${target || 'new'}`;

/** the device storage; null when there is none */
export function deviceAssistantStorage(): AssistantStorage | null {
  try {
    const m = require('@react-native-async-storage/async-storage');
    return (m?.default ?? m) as AssistantStorage;
  } catch {
    return null;
  }
}

const isStepId = (v: unknown): v is AssistantStepId => typeof v === 'string' && (ASSISTANT_STEP_IDS as string[]).includes(v);

/** a stored text -> a run, or null when it is not one of ours (old version, damaged) */
export function parseSavedRun(text: string | null | undefined, today?: string): AssistantSavedRun | null {
  if (!text) return null;
  try {
    const j = JSON.parse(text);
    if (!j || typeof j !== 'object' || j.version !== ASSISTANT_STORAGE_VERSION) return null;
    const reached = Array.isArray(j.reached) ? j.reached.filter(isStepId) : [];
    return {
      version: ASSISTANT_STORAGE_VERSION,
      target: typeof j.target === 'string' ? j.target : 'new',
      values: sanitizeAssistantValues(j.values, today),
      stepId: isStepId(j.stepId) ? j.stepId : 'identity',
      reached: reached.length ? reached : ['identity'],
      savedAt: typeof j.savedAt === 'string' ? j.savedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function loadSavedRun(key: string, storage: AssistantStorage | null = deviceAssistantStorage(), today?: string): Promise<AssistantSavedRun | null> {
  if (!storage) return null;
  try {
    return parseSavedRun(await storage.getItem(key), today);
  } catch {
    return null;
  }
}

export async function saveRun(key: string, run: Omit<AssistantSavedRun, 'version' | 'savedAt'>, storage: AssistantStorage | null = deviceAssistantStorage(), now: Date = new Date()): Promise<boolean> {
  if (!storage) return false;
  try {
    const out: AssistantSavedRun = { ...run, version: ASSISTANT_STORAGE_VERSION, savedAt: now.toISOString() };
    await storage.setItem(key, JSON.stringify(out));
    return true;
  } catch {
    return false;
  }
}

export async function clearSavedRun(key: string, storage: AssistantStorage | null = deviceAssistantStorage()): Promise<void> {
  if (!storage) return;
  try {
    await storage.removeItem(key);
  } catch {
    // nothing to do: the next run offers an old draft at worst
  }
}
