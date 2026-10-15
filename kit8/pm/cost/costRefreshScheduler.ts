// The cost refresh after a Post, DEBOUNCED per project: many signals close together start ONE calculation, after the last signal.
//   * a signal (a Post) restarts the timer of its project; when COST_REFRESH_DEBOUNCE_MS pass without a new signal the RPC is called ONCE (refreshProjectCostAfterPost)
//   * a signal that comes while the RPC is still running is not lost and does not start a second one in parallel: ONE more call follows when the running one has finished
//   * module level, not tied to a component: the Post button or the task page may be closed right after Post and the call still happens
//   * the explicit command "Update project cost" cancels the pending call (it does the same work at once)
// The server has its own coalescing (monitor01_dirty keeps one row per task, the worker takes a batch every 2 s, the cost step is serialized per project by an advisory lock): this only saves
// the calls of ONE browser. Other users / browsers cannot be merged from React - the server merges them.
import { refreshProjectCostAfterPost } from './refreshCostAfterPost';
import { projectCostBudgetOn } from '../model/taskInputScope';

/** quiet time after the last Post before the call (ms) */
export const COST_REFRESH_DEBOUNCE_MS = 500;

interface Slot {
  timer: ReturnType<typeof setTimeout> | null;
  running: boolean;
  /** a signal arrived while the call was running: one more call after it */
  again: boolean;
  client: any;
  json: Parameters<typeof projectCostBudgetOn>[0];
}
const slots = new Map<string, Slot>();

const idle = (s: Slot) => !s.timer && !s.running && !s.again;

async function run(projectGUID: string): Promise<void> {
  const slot = slots.get(projectGUID);
  if (!slot) return;
  slot.timer = null;
  if (slot.running) { slot.again = true; return; }
  slot.running = true;
  try {
    await refreshProjectCostAfterPost(slot.client, projectGUID, slot.json);      // never throws
  } finally {
    slot.running = false;
    if (slot.again) {
      slot.again = false;
      void run(projectGUID);                                                       // exactly one more, with the newest client / settings
    } else if (idle(slot)) {
      slots.delete(projectGUID);
    }
  }
}

/** a Post happened: (re)start the quiet time of the project; the call is made once, after the last signal. Same gate as refreshProjectCostAfterPost: only while a cost budget is on. */
export function scheduleProjectCostRefresh(client: any, projectGUID: string | null | undefined, projectJSON: Parameters<typeof projectCostBudgetOn>[0], delayMs: number = COST_REFRESH_DEBOUNCE_MS): void {
  if (!projectGUID || !client?.rpc) return;
  if (!projectCostBudgetOn(projectJSON)) { cancelProjectCostRefresh(projectGUID); return; }      // the budget was turned off since the earlier signal: nothing to calculate
  const slot = slots.get(projectGUID) ?? { timer: null, running: false, again: false, client, json: projectJSON };
  slot.client = client;
  slot.json = projectJSON;
  if (slot.timer) clearTimeout(slot.timer);
  slot.timer = setTimeout(() => { void run(projectGUID); }, delayMs);
  slots.set(projectGUID, slot);
}

/** the explicit command did the work (or the project was left): forget the pending call; a call that is running is left to finish */
export function cancelProjectCostRefresh(projectGUID: string | null | undefined): void {
  if (!projectGUID) return;
  const slot = slots.get(projectGUID);
  if (!slot) return;
  if (slot.timer) { clearTimeout(slot.timer); slot.timer = null; }
  slot.again = false;
  if (idle(slot)) slots.delete(projectGUID);
}

/** how many projects wait for / run a call (the tests) */
export const pendingProjectCostRefreshes = (): number => slots.size;

/** forget everything (the tests) */
export function resetCostRefreshScheduler(): void {
  for (const s of slots.values()) if (s.timer) clearTimeout(s.timer);
  slots.clear();
}
