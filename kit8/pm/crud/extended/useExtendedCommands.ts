// The commands of the Gantt Extended functions that edit tasks and links (kit8/pm/extended). Every command records ONE undo step BEFORE it mutates
// (undoGanttAction), reads the latest state via usePMStore.getState(), and does nothing when its function is off (the buttons are hidden then).
//   updateTaskFields / updateTasksFields   a patch of the rowJSON of one / many tasks (Task window → Advanced, multi-edit, fill down)
//   setTaskTriangle / setDurationText      A6 work-units-duration, A8 / A9 "3d", "2w", "4ed?"
//   setPredecessorsText / linkChecked / unlinkChecked   B1, B2
//   setBaseline / markCompleteThroughStatus / rescheduleUncompleted   C1, C5
//   createRecurring                        A13
//   copyRows / pasteRows / fillDown / findReplace   F1, F2, F7
import { useMemo } from 'react';
import * as Clipboard from 'expo-clipboard';
import { appDispatch } from '../../../redux/storeRef';
import { showSnackbar } from '../../../redux/uxuiSlice';
import { usePMStore } from '../../store/store_pm';
import { newGUID } from '../api/apiUtils';
import { useCreateTasksMutation, useUpdateTaskMutation, useUpdateTasksMutation } from '../task/taskQueries';
import { useCreateDependencyMutation, useDeleteDependencyMutation, useUpdateDependencyMutation } from '../dependency/dependencyQueries';
import { describeDependencyProblem, flattenAll, projectTreePath, ORDER_STEP, toLtreeLabel, validateNewDependency } from '../../view/project/scheduling';
import type { PMUndo } from '../../view/undo/useUndoGanttAction';
import type { PMLinkType, PMTaskJSON, PMTaskRow } from '../../model/types';
import { isExtended } from '../../extended/extendedModel';
import { extendedOptionsOf } from '../../extended/extendedOptions';
import { PMTriangleEdit, recalcTriangle, trianglePatch, triangleOf } from '../../extended/taskTypes';
import { parseDurationText } from '../../extended/durationText';
import { parsePredecessors } from '../../extended/predecessorsText';
import { actualPatchOnProgress, markCompletePatches, rescheduleUncompletedPatches, setBaselinePatches, statusDateMsOf } from '../../extended/tracking';
import { PMRecurrence, recurringDates } from '../../extended/recurrence';

const say = (message: string, isError = false) => appDispatch(showSnackbar({ message, isError }));

export function useExtendedCommands(ownerGUID: string, projectGUID: string | null, undo: PMUndo) {
  const updateTask = useUpdateTaskMutation(projectGUID);
  const updateTasks = useUpdateTasksMutation(projectGUID);
  const createTasks = useCreateTasksMutation(projectGUID);
  const createDep = useCreateDependencyMutation(ownerGUID, projectGUID);
  const deleteDep = useDeleteDependencyMutation(projectGUID);
  const updateDep = useUpdateDependencyMutation(projectGUID);
  const { record } = undo;

  return useMemo(() => {
    const st = () => usePMStore.getState();
    const projectJSON = () => (projectGUID ? st().projectsById[projectGUID]?.rowJSON : undefined);
    const on = (key: string) => isExtended(projectJSON(), key);
    const nameOf = (g: string) => st().tasksById[g]?.rowJSON.taskDescription || '?';
    const rowsInTreeOrder = (guids: string[]): string[] => {
      const set = new Set(guids);
      return flattenAll(st().tree).filter((g) => set.has(g));
    };
    const withJSON = (t: PMTaskRow, patch: Partial<PMTaskJSON>) => ({ ...t.rowJSON, ...patch }) as PMTaskRow['rowJSON'];

    const updateTaskFields = (guid: string, patch: Partial<PMTaskJSON>, label = 'Edit task') => {
      const t = st().tasksById[guid];
      if (!t) return false;
      record('task-update', `${label}: "${t.rowJSON.taskDescription}"`);
      updateTask.mutate({ rowGUID: guid, patch: { rowJSON: withJSON(t, patch) } });
      return true;
    };

    const updateTasksFields = (guids: string[], patch: Partial<PMTaskJSON>, label = 'Edit tasks') => {
      const items = guids.map((g) => st().tasksById[g]).filter(Boolean).map((t) => ({ rowGUID: t.rowGUID, patch: { rowJSON: withJSON(t, patch) } }));
      if (!items.length) return false;
      record('task-update', `${label} (${items.length})`);
      updateTasks.mutate(items);
      return true;
    };

    // the actual dates that go with a new % (kit8/pm/extended/tracking.ts)
    const calcActual = (t: PMTaskRow, newPct: number, row: any) => actualPatchOnProgress(t.rowJSON as PMTaskJSON, t.rowProgress || 0, newPct, row, Date.now());

    /** the links of one row as the user sees them: predecessor rows */
    const depsOf = (guid: string) => st().deps.filter((d) => d.rowGUID === guid);

    const api = {
      updateTaskFields,
      updateTasksFields,

      /** The cell of an Extended column was edited (Priority, Deadline, Predecessors, Actual start / finish, Work, Units): the command of its function. */
      setExtColumnValue: (guid: string, key: string, value: string | number | boolean | null) => {
        const field = key.replace('cc_ext_', '');
        const iso = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`).toISOString() : null);
        switch (field) {
          case 'priority': return updateTaskFields(guid, { taskPriority: value === null ? 500 : Math.max(0, Math.min(1000, Math.round(Number(value) || 0))) }, 'Priority');
          case 'deadline': return updateTaskFields(guid, { taskDeadline: iso(value) }, 'Deadline');
          case 'actualStart': return updateTaskFields(guid, { actualStartAt: iso(value) }, 'Actual start');
          case 'actualFinish': return updateTaskFields(guid, { actualFinishAt: iso(value) }, 'Actual finish');
          case 'predecessors': return (api as any).setPredecessorsText(guid, String(value ?? ''));
          case 'work': return (api as any).setTaskTriangle(guid, 'work', Number(value));
          case 'units': return (api as any).setTaskTriangle(guid, 'units', Number(value));
          default: return false;
        }
      },

      /** A6: edit one of duration / work / units; the Type of the task decides what is recalculated. */
      setTaskTriangle: (guid: string, edited: PMTriangleEdit, value: number) => {
        const t = st().tasksById[guid];
        if (!t || !on('ganttTaskTypesEnabled') || !Number.isFinite(value)) return false;
        const tri = triangleOf(t.rowJSON);
        const next = recalcTriangle({ ...tri, ...(edited === 'duration' ? { durationDays: Math.max(0, Math.round(value)) } : edited === 'work' ? { workHours: Math.max(0, value) } : { units: Math.max(1, value) }) }, edited);
        return updateTaskFields(guid, trianglePatch(next), 'Task type');
      },

      /** A8 / A9: "3d", "2w", "4ed?" - the days, the elapsed flag and the estimate mark. */
      setDurationText: (guid: string, text: string) => {
        const t = st().tasksById[guid];
        if (!t || t.rowJSON.rowKind === 'milestone') return false;
        const p = parseDurationText(text);
        if (!p) { say('A duration is a number with a unit: 3d, 2w, 1mo, 4ed, 6h (a "?" at the end = an estimate).', true); return false; }
        const patch: Partial<PMTaskJSON> = { durationDays: Math.max(1, p.days) };
        if (on('ganttDurationUnitsEnabled')) patch.durationElapsed = p.elapsed;
        if (on('ganttEstimatedDurationEnabled')) patch.durationEstimated = p.estimated;
        return updateTaskFields(guid, patch, 'Duration');
      },

      /** B1: replace the links of a task by the text "3, 5SS-1d, 7FS+2w, 9FF+50%" (the numbers are the outline numbers of the # column). */
      setPredecessorsText: (guid: string, text: string) => {
        const s = st();
        if (!s.tasksById[guid] || !on('ganttPredecessorsColumnEnabled')) return false;
        const { items, errors } = parsePredecessors(text, on('ganttLagPercentEnabled'));
        const guidOfWbs: Record<string, string> = {};
        for (const [g, w] of Object.entries(s.tree.wbsById)) guidOfWbs[w] = g;
        const wanted: { pred: string; type: PMLinkType; lagDays: number; lagPercent: number | null }[] = [];
        for (const it of items) {
          const pred = guidOfWbs[it.wbs];
          if (!pred) errors.push(`row ${it.wbs} does not exist`);
          else wanted.push({ pred, type: it.type, lagDays: it.lagDays, lagPercent: it.lagPercent });
        }
        const current = depsOf(guid);
        const keep = new Set(wanted.map((w) => w.pred));
        // a new link must not create a cycle (checked against the plan without the links that are replaced)
        let probe = s.deps.filter((d) => d.rowGUID !== guid || keep.has(d.rowDependsOnGUID));
        const toCreate: typeof wanted = [];
        for (const w of wanted) {
          if (current.some((d) => d.rowDependsOnGUID === w.pred)) continue;
          const problem = validateNewDependency(s.tasks, probe, w.pred, guid);
          if (problem) { errors.push(`${nameOf(w.pred)}: ${describeDependencyProblem(problem)}`); continue; }
          probe = [...probe, { rowGUID: guid, rowDependsOnGUID: w.pred, projectGUID: projectGUID as string, rowOwnerGUID: ownerGUID, linkType: w.type, lagDays: w.lagDays } as any];
          toCreate.push(w);
        }
        if (errors.length) { s.setError(errors.join('\n')); return false; }
        record('dependency-update', `Predecessors of "${nameOf(guid)}"`);
        for (const d of current) if (!keep.has(d.rowDependsOnGUID)) deleteDep.mutate({ rowGUID: guid, dependsOnGUID: d.rowDependsOnGUID });
        for (const w of toCreate) createDep.mutate({ rowGUID: guid, dependsOnGUID: w.pred, linkType: w.type, lagDays: w.lagDays, ...(w.lagPercent !== null ? { rowJSON: { lagPercent: w.lagPercent } } : {}) });
        for (const w of wanted) {
          const d = current.find((x) => x.rowDependsOnGUID === w.pred);
          if (!d) continue;
          const pct = (d.rowJSON as any)?.lagPercent ?? null;
          if ((d.linkType || 'FS') !== w.type || (Number(d.lagDays) || 0) !== w.lagDays || pct !== w.lagPercent) {
            updateDep.mutate({ rowGUID: guid, dependsOnGUID: w.pred, patch: { linkType: w.type, lagDays: w.lagDays, rowJSON: { ...(d.rowJSON || {}), lagPercent: w.lagPercent } as any } });
          }
        }
        return true;
      },

      /** B2: the checked tasks become a finish-to-start chain in tree order (a link that exists or would make a cycle is skipped). */
      linkChecked: () => {
        const s = st();
        if (!on('ganttLinkUnlinkEnabled')) return 0;
        const order = rowsInTreeOrder(Object.keys(s.checkedGUIDs)).filter((g) => (s.tree.childrenById[g]?.length ?? 0) === 0 || true);
        if (order.length < 2) { say('Check two or more tasks first.', true); return 0; }
        let probe = s.deps;
        const made: [string, string][] = [];
        for (let i = 1; i < order.length; i++) {
          const pred = order[i - 1];
          const succ = order[i];
          if (validateNewDependency(s.tasks, probe, pred, succ)) continue;
          probe = [...probe, { rowGUID: succ, rowDependsOnGUID: pred, projectGUID: projectGUID as string, rowOwnerGUID: ownerGUID, linkType: 'FS', lagDays: 0 } as any];
          made.push([pred, succ]);
        }
        if (!made.length) { say('Nothing to link: the tasks are linked already or a link would make a cycle.'); return 0; }
        record('dependency-create', `Link ${made.length + 1} tasks`);
        for (const [pred, succ] of made) createDep.mutate({ rowGUID: succ, dependsOnGUID: pred, linkType: 'FS', lagDays: 0 });
        return made.length;
      },

      /** B2: removes every link between the checked tasks. */
      unlinkChecked: () => {
        const s = st();
        if (!on('ganttLinkUnlinkEnabled')) return 0;
        const set = new Set(Object.keys(s.checkedGUIDs));
        const gone = s.deps.filter((d) => set.has(d.rowGUID) && set.has(d.rowDependsOnGUID));
        if (!gone.length) { say('No link between the checked tasks.'); return 0; }
        record('dependency-delete', `Unlink ${set.size} tasks`);
        for (const d of gone) deleteDep.mutate({ rowGUID: d.rowGUID, dependsOnGUID: d.rowDependsOnGUID });
        return gone.length;
      },

      /** C1: Set baseline no. `no` for the checked tasks (or the whole project). */
      setBaseline: (no: number, onlyChecked: boolean) => {
        const s = st();
        if (!on('ganttBaselinesEnabled')) return 0;
        const scope = onlyChecked && Object.keys(s.checkedGUIDs).length ? new Set(Object.keys(s.checkedGUIDs)) : null;
        const patches = setBaselinePatches(s.tasks, s.schedule, no, scope);
        if (!patches.length) return 0;
        record('task-update', `Set baseline ${no} (${patches.length})`);
        updateTasks.mutate(patches.map((p) => ({ rowGUID: p.rowGUID, patch: { rowJSON: p.rowJSON as any } })));
        say(`Baseline ${no} saved for ${patches.length} row(s).`);
        return patches.length;
      },

      /** C5: Update project - "Mark work complete through the status date" (the % of every task is raised to what its dates say). */
      markCompleteThroughStatus: () => {
        const s = st();
        if (!on('ganttStatusDateEnabled')) return 0;
        const statusMs = statusDateMsOf(extendedOptionsOf(projectJSON()).statusDate, Date.now());
        const patches = markCompletePatches(s.tasks, s.schedule, statusMs);
        if (!patches.length) { say('Every task is as complete as its dates say.'); return 0; }
        record('task-update', `Mark complete through the status date (${patches.length})`);
        const actual = on('ganttActualDatesEnabled');
        updateTasks.mutate(patches.map((p) => {
          const t = s.tasksById[p.rowGUID];
          const json = actual ? { ...t.rowJSON, ...calcActual(t, p.progress, s.schedule[p.rowGUID]) } : t.rowJSON;
          return { rowGUID: p.rowGUID, patch: { rowProgress: p.progress, rowJSON: json as any } };
        }));
        say(`${patches.length} task(s) updated.`);
        return patches.length;
      },

      /** C5: Update project - "Reschedule uncompleted work": a task that is not started but should have started gets Start No Earlier Than = the status date. */
      rescheduleUncompleted: () => {
        const s = st();
        if (!on('ganttStatusDateEnabled')) return 0;
        const statusMs = statusDateMsOf(extendedOptionsOf(projectJSON()).statusDate, Date.now());
        const patches = rescheduleUncompletedPatches(s.tasks, s.schedule, statusMs);
        if (!patches.length) { say('No task has to be rescheduled.'); return 0; }
        record('task-move', `Reschedule uncompleted work (${patches.length})`);
        updateTasks.mutate(patches.map((p) => ({ rowGUID: p.rowGUID, patch: { rowJSON: { ...s.tasksById[p.rowGUID].rowJSON, manualStartAt: p.manualStartAt } as any } })));
        say(`${patches.length} task(s) rescheduled.`);
        return patches.length;
      },

      /** A13: a stage with one task for every occurrence of the pattern (each task starts on its date). */
      createRecurring: (opts: { name: string; durationDays: number; pattern: PMRecurrence }) => {
        const s = st();
        if (!projectGUID || !on('ganttRecurringTasksEnabled')) return 0;
        const dates = recurringDates(opts.pattern);
        if (!dates.length) { say('The pattern has no occurrence: give an end date or a number of occurrences.', true); return 0; }
        const roots = (s.tree.childrenById.__root__ || []).map((g) => s.tasksById[g]).filter(Boolean);
        const lastOrder = roots.length ? roots[roots.length - 1].orderInList : 0;
        const stageGUID = newGUID();
        const stagePath = `${projectTreePath(projectGUID)}.${toLtreeLabel(stageGUID)}`;
        const rows: PMTaskRow[] = [
          { rowGUID: stageGUID, treePath: stagePath, projectGUID, rowOwnerGUID: ownerGUID, rowDuration: null, rowProgress: 0, orderInList: lastOrder + ORDER_STEP, rowJSON: { rowKind: 'stage', taskDescription: opts.name || 'Recurring task', durationDays: 0 } as any },
        ];
        dates.forEach((ms, i) => {
          const g = newGUID();
          rows.push({
            rowGUID: g, treePath: `${stagePath}.${toLtreeLabel(g)}`, projectGUID, rowOwnerGUID: ownerGUID, rowDuration: null, rowProgress: 0, orderInList: (i + 1) * ORDER_STEP,
            rowJSON: { rowKind: 'task', taskDescription: `${opts.name || 'Recurring task'} ${i + 1}`, durationDays: Math.max(1, opts.durationDays), manualStartAt: new Date(ms).toISOString() } as any,
          });
        });
        record('task-create', `Recurring task (${dates.length})`);
        createTasks.mutate(rows);
        return dates.length;
      },

      /** F1: the checked rows (or the selected one) as tab separated text: name, duration, start, %. */
      copyRows: async (guids?: string[]) => {
        const s = st();
        if (!on('ganttCopyPasteEnabled')) return 0;
        const list = rowsInTreeOrder(guids && guids.length ? guids : Object.keys(s.checkedGUIDs).length ? Object.keys(s.checkedGUIDs) : s.selectedGUID ? [s.selectedGUID] : []);
        if (!list.length) { say('Check the rows to copy.', true); return 0; }
        const text = list
          .map((g) => {
            const t = s.tasksById[g];
            const r = s.schedule[g];
            return [t.rowJSON.taskDescription ?? '', r ? r.durationDays : t.rowJSON.durationDays ?? '', r ? new Date(r.startMs).toISOString().slice(0, 10) : '', Math.round(t.rowProgress || 0)].join('\t');
          })
          .join('\n');
        try { await Clipboard.setStringAsync(text); say(`${list.length} row(s) copied.`); } catch { say('Could not copy to the clipboard.', true); return 0; }
        return list.length;
      },

      /** F1: new tasks from tab separated text (also copied from Excel): name [TAB duration [TAB start [TAB %]]], below the selected row. */
      pasteRows: async (text?: string) => {
        const s = st();
        if (!projectGUID || !on('ganttCopyPasteEnabled')) return 0;
        let raw = text;
        if (raw === undefined) { try { raw = await Clipboard.getStringAsync(); } catch { raw = ''; } }
        const lines = (raw || '').split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim());
        if (!lines.length) { say('The clipboard has no rows to paste.', true); return 0; }
        const anchor = s.selectedGUID && s.tasksById[s.selectedGUID] ? s.selectedGUID : null;
        const parentGUID = anchor ? s.tree.parentById[anchor] ?? null : null;
        const parent = parentGUID ? s.tasksById[parentGUID] : null;
        const siblings = (s.tree.childrenById[parentGUID ?? '__root__'] || []).map((g) => s.tasksById[g]).filter(Boolean);
        const i = anchor ? siblings.findIndex((t) => t.rowGUID === anchor) : siblings.length - 1;
        const before = i >= 0 ? siblings[i].orderInList : null;
        const after = i >= 0 && siblings[i + 1] ? siblings[i + 1].orderInList : null;
        const n = lines.length;
        const orderAt = (k: number) => (before !== null && after !== null ? before + ((after - before) * (k + 1)) / (n + 1) : before !== null ? before + ORDER_STEP * (k + 1) : after !== null ? after - ORDER_STEP * (n - k) : ORDER_STEP * (k + 1));
        const rows: PMTaskRow[] = lines.map((line, k) => {
          const [name, dur, start, pct] = line.split('\t');
          const g = newGUID();
          const days = Math.max(0, Math.round(Number((dur ?? '').replace(',', '.'))));
          const startMs = start && /^\d{4}-\d{2}-\d{2}/.test(start.trim()) ? Date.parse(start.trim().slice(0, 10)) : NaN;
          const p = Math.max(0, Math.min(100, Math.round(Number(pct)) || 0));
          return {
            rowGUID: g, treePath: `${parent ? parent.treePath : projectTreePath(projectGUID)}.${toLtreeLabel(g)}`, projectGUID, rowOwnerGUID: ownerGUID, rowDuration: null, rowProgress: p, orderInList: orderAt(k),
            rowJSON: { rowKind: days === 0 && dur !== undefined && dur !== '' ? 'milestone' : 'task', taskDescription: (name || 'New task').trim(), durationDays: days === 0 ? (dur !== undefined && dur !== '' ? 0 : 1) : days, ...(Number.isFinite(startMs) ? { manualStartAt: new Date(startMs).toISOString() } : {}) } as any,
          };
        });
        record('task-create', `Paste ${rows.length} rows`);
        createTasks.mutate(rows);
        say(`${rows.length} row(s) pasted.`);
        return rows.length;
      },

      /** F2: the value of the first checked row (in tree order) goes to all the other checked rows. */
      fillDown: (field: 'duration' | 'percent' | 'priority' | 'startConstraint') => {
        const s = st();
        if (!on('ganttFillDownEnabled')) return 0;
        const list = rowsInTreeOrder(Object.keys(s.checkedGUIDs));
        if (list.length < 2) { say('Check two or more rows: the first one is copied to the others.', true); return 0; }
        const first = s.tasksById[list[0]];
        const rest = list.slice(1).filter((g) => (s.tree.childrenById[g]?.length ?? 0) === 0);
        record('task-update', `Fill down ${field} (${rest.length})`);
        updateTasks.mutate(
          rest.map((g) => {
            const t = s.tasksById[g];
            if (field === 'percent') return { rowGUID: g, patch: { rowProgress: first.rowProgress } };
            const key = field === 'duration' ? 'durationDays' : field === 'priority' ? 'taskPriority' : 'manualStartAt';
            return { rowGUID: g, patch: { rowJSON: { ...t.rowJSON, [key]: (first.rowJSON as any)[key] ?? null } as any } };
          })
        );
        return rest.length;
      },

      /** F3: change duration / % / priority of all checked rows at once. */
      editChecked: (field: 'duration' | 'percent' | 'priority', value: number) => {
        const s = st();
        if (!on('ganttRangeSelectionEnabled') || !Number.isFinite(value)) return 0;
        const list = Object.keys(s.checkedGUIDs).filter((g) => s.tasksById[g] && (s.tree.childrenById[g]?.length ?? 0) === 0);
        if (!list.length) { say('Check the rows to change.', true); return 0; }
        record('task-update', `Edit ${list.length} rows: ${field}`);
        updateTasks.mutate(
          list.map((g) => {
            const t = s.tasksById[g];
            if (field === 'percent') return { rowGUID: g, patch: { rowProgress: Math.max(0, Math.min(100, Math.round(value))) } };
            const key = field === 'duration' ? 'durationDays' : 'taskPriority';
            return { rowGUID: g, patch: { rowJSON: { ...t.rowJSON, [key]: field === 'duration' ? Math.max(1, Math.round(value)) : Math.max(0, Math.min(1000, Math.round(value))) } as any } };
          })
        );
        return list.length;
      },

      /** F7: the rows whose name or notes contain the text (case-insensitive). */
      findRows: (text: string): string[] => {
        const q = (text || '').trim().toLowerCase();
        if (!q) return [];
        const s = st();
        return flattenAll(s.tree).filter((g) => `${s.tasksById[g]?.rowJSON.taskDescription ?? ''} ${s.tasksById[g]?.rowJSON.notes ?? ''}`.toLowerCase().includes(q));
      },

      /** F7: replace text in the names of the rows (all matches, or the given rows only). */
      replaceInNames: (find: string, replace: string, guids?: string[]) => {
        const s = st();
        if (!on('ganttFindReplaceEnabled') || !find) return 0;
        const q = find.toLowerCase();
        const targets = (guids ?? flattenAll(s.tree)).filter((g) => (s.tasksById[g]?.rowJSON.taskDescription ?? '').toLowerCase().includes(q));
        if (!targets.length) return 0;
        const re = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        record('task-update', `Replace "${find}" (${targets.length})`);
        updateTasks.mutate(targets.map((g) => ({ rowGUID: g, patch: { rowJSON: { ...s.tasksById[g].rowJSON, taskDescription: (s.tasksById[g].rowJSON.taskDescription || '').replace(re, replace) } as any } })));
        return targets.length;
      },
    };
    return api;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateTask.mutate, updateTasks.mutate, createTasks.mutate, createDep.mutate, deleteDep.mutate, updateDep.mutate, record, ownerGUID, projectGUID]);
}
