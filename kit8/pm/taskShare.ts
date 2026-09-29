// "Copy task info" and "Share task" (row hover panels: tree row, Gantt bar, network node).
//
//   copyTaskInfo(guid) -> plain-text summary of the task (project, parent path, dates, duration,
//                         progress, float, predecessors / successors, notes, deep link) on the clipboard
//   shareTask(guid)    -> native share sheet (iOS / Android), Web Share API where the browser has it,
//                         otherwise the task's deep link is copied to the clipboard
//
// The deep link opens /pm/project/task?taskGUID=...&projectGUID=... (PMProjectTaskInfo selects the
// project and loads it, so the link also works in a fresh session - after sign-in, RLS applies).

import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { PM_ROUTES } from './constants';
import { formatDateISO } from './scheduling';
import { usePMStore } from './store';

type PMState = ReturnType<typeof usePMStore.getState>;

/** 'copied' = put on the clipboard · 'shared' = share sheet completed · 'dismissed' · 'failed' */
export type PMShareResult = 'copied' | 'shared' | 'dismissed' | 'failed';

/** Absolute deep link to the task page (web: https://host/pm/project/task?..., native: app scheme). */
export function taskShareURL(taskGUID: string, projectGUID: string | null | undefined): string {
  const queryParams: Record<string, string> = { taskGUID };
  if (projectGUID) queryParams.projectGUID = projectGUID;
  try {
    return Linking.createURL(PM_ROUTES.task, { queryParams });
  } catch {
    const qs = new URLSearchParams(queryParams).toString();
    const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}${PM_ROUTES.task}?${qs}`;
  }
}

function kindOf(s: PMState, guid: string): string {
  const t = s.tasksById[guid];
  if (s.schedule[guid]?.isSummary || (s.tree.childrenById[guid]?.length ?? 0) > 0 || t?.rowJSON.rowKind === 'stage') return 'Stage';
  return t?.rowJSON.rowKind === 'milestone' ? 'Milestone' : 'Task';
}

/** Plain-text summary of one task (null when the row is unknown). */
export function buildTaskInfoText(guid: string, s: PMState = usePMStore.getState(), url?: string): string | null {
  const t = s.tasksById[guid];
  if (!t) return null;
  const r = s.schedule[guid];
  const nameOf = (g: string) => s.tasksById[g]?.rowJSON.name ?? g;
  const lines: string[] = [];
  const project = t.projectGUID ? s.projectsById[t.projectGUID] : undefined;
  if (project) lines.push(`Project: ${project.rowJSON.name}`);
  const parents: string[] = [];
  for (let p = s.tree.parentById[guid]; p; p = s.tree.parentById[p]) parents.unshift(nameOf(p));
  if (parents.length) lines.push(`In: ${parents.join(' › ')}`);
  lines.push(`${kindOf(s, guid)}: ${t.rowJSON.name}`);
  if (r) {
    lines.push(`Start: ${formatDateISO(r.startMs)}`);
    lines.push(`Finish: ${formatDateISO(Math.max(r.startMs, r.finishMs - 1))}`);
    lines.push(`Duration: ${r.durationDays} working day(s)`);
    lines.push(`Progress: ${Math.round(r.progress)}%`);
    lines.push(`Float: ${r.inCycle ? 'in a dependency cycle' : r.isCritical ? 'critical path (0 d)' : `${r.totalFloatDays} d`}`);
  }
  if (t.rowJSON.manualStartAt) lines.push(`Start no earlier than: ${formatDateISO(Date.parse(t.rowJSON.manualStartAt))}`);
  const link = (linkType?: string | null, lag?: number | null) => {
    const l = Number(lag) || 0;
    return `${linkType || 'FS'}${l ? ` ${l > 0 ? '+' : ''}${l}d` : ''}`;
  };
  const preds = s.deps.filter((d) => d.rowGUID === guid).map((d) => `${nameOf(d.rowDependsOnGUID)} (${link(d.linkType, d.lagDays)})`);
  const succs = s.deps.filter((d) => d.rowDependsOnGUID === guid).map((d) => `${nameOf(d.rowGUID)} (${link(d.linkType, d.lagDays)})`);
  if (preds.length) lines.push(`Predecessors: ${preds.join(', ')}`);
  if (succs.length) lines.push(`Successors: ${succs.join(', ')}`);
  if (t.rowJSON.notes) lines.push(`Notes: ${t.rowJSON.notes}`);
  lines.push(`Link: ${url ?? taskShareURL(guid, t.projectGUID)}`);
  return lines.join('\n');
}

/** Copies the task summary to the clipboard. */
export async function copyTaskInfo(guid: string): Promise<PMShareResult> {
  const text = buildTaskInfoText(guid);
  if (!text) return 'failed';
  try {
    await Clipboard.setStringAsync(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** Shares the task: its name + deep link (and the summary as the message body on native). */
export async function shareTask(guid: string): Promise<PMShareResult> {
  const s = usePMStore.getState();
  const t = s.tasksById[guid];
  if (!t) return 'failed';
  const url = taskShareURL(guid, t.projectGUID);
  const title = t.rowJSON.name;
  try {
    if (Platform.OS === 'web') {
      const nav: any = typeof navigator !== 'undefined' ? navigator : null;
      if (nav?.share) {
        try {
          await nav.share({ title, text: title, url });
          return 'shared';
        } catch (e: any) {
          if (e?.name === 'AbortError') return 'dismissed';
          // not allowed here (e.g. no user activation / insecure context) -> copy the link instead
        }
      }
      await Clipboard.setStringAsync(`${title}\n${url}`);
      return 'copied';
    }
    const message = buildTaskInfoText(guid, s, url) ?? `${title}\n${url}`;
    // iOS shows `url` as a link attachment; Android only reads `message` (it already ends with the link)
    const res = await Share.share(Platform.OS === 'ios' ? { title, message, url } : { title, message });
    return res.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch {
    return 'failed';
  }
}
