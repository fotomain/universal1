// Gantt "Extended" functionality - the registry of the MS Project functions that the app offers on top of its basic Gantt chart (pure, no React / store).
// documentation/MORE_GANTT_INPUT.html (the gap analysis) + the WBS documents MORE_GANTT_*.html.
//
//   project_table.rowJSON.ganttExtendedFunctionalityEnabled   the MASTER switch: Project settings -> Gantt. OFF while never saved.
//   project_table.rowJSON.<xxxxEnabled>                       one switch per function, all OFF while never saved; edited in the "Extended" window of the Gantt bar (visible only while the master is on).
//
// Rule: a function is ON only when the master AND its own switch are on (`extendedOf`). With everything off the Gantt chart, the tree, the scheduler and every export work exactly as they did before
// these functions existed. A function that needs another one lists it in `requires` (it is ignored while the other is off).
import type { PMRowJSON } from '../model/types';

export const GANTT_EXTENDED_MASTER_KEY = 'ganttExtendedFunctionalityEnabled' as const;

export type PMExtendedGroup = 'scheduling' | 'links' | 'tracking' | 'chart' | 'table' | 'task' | 'print';

export interface PMExtendedFeature {
  /** the id in MORE_GANTT_INPUT.html (A1, B2 ...) */
  id: string;
  /** the project rowJSON key (xxxxEnabled) */
  key: string;
  group: PMExtendedGroup;
  title: string;
  /** one short line of the "Extended" window */
  short: string;
  /** the full description (the "more…" of the window): how it works in the app, conceptually */
  more: string;
  /** keys of functions that must be ON too */
  requires?: string[];
}

export const PM_EXTENDED_GROUPS: { id: PMExtendedGroup; title: string; icon: string }[] = [
  { id: 'scheduling', title: 'Scheduling', icon: 'event_available' },
  { id: 'links', title: 'Links', icon: 'link' },
  { id: 'tracking', title: 'Tracking', icon: 'track_changes' },
  { id: 'chart', title: 'Chart', icon: 'view_timeline' },
  { id: 'table', title: 'Table', icon: 'table_chart' },
  { id: 'task', title: 'Task window', icon: 'task_alt' },
  { id: 'print', title: 'Print', icon: 'print' },
];

export const PM_EXTENDED_FEATURES: PMExtendedFeature[] = [
  // ---- A: scheduling ----------------------------------------------------------------------------------------------------------------------------------------------------
  { id: 'A1', key: 'ganttManualSchedulingEnabled', group: 'scheduling', title: 'Manually scheduled tasks',
    short: 'A task keeps the start you type; links never move it.',
    more: 'Every task is scheduled automatically from its links and the calendar. With this function a task can be switched to Manual (menu "Schedule manually", or Task window → Advanced). A manual task keeps its typed start whatever its predecessors, the calendar or the project start say; its finish still drives its successors. When a predecessor would start it later, a warning shows. Stages and subproject tasks stay automatic.' },
  { id: 'A2', key: 'ganttCalculationModeEnabled', group: 'scheduling', title: 'Calculation: Automatic or Manual',
    short: 'Edit many tasks, then press Calculate (F9).',
    more: 'Normally the plan is recalculated and saved after every edit. With this function you can switch the project to Manual calculation (Calculate button on the Gantt bar, Extended window). Your edits are saved at once, but the dates of the other tasks, the critical path and the stages change only when you press Calculate (F9); until then the edited rows are marked. Post, MS Project export and switching back to Automatic calculate first. Protects posted lines and payments from being unposted by half-finished edits.' },
  { id: 'A3', key: 'ganttConstraintsEnabled', group: 'scheduling', title: 'The 8 constraint types',
    short: 'As soon/late as possible, must/no earlier/no later than.',
    more: 'Adds the MS Project constraint to a task: As Soon As Possible, As Late As Possible, Must Start On, Must Finish On, Start/Finish No Earlier Than, Start/Finish No Later Than, each with a date. When a link and a constraint disagree the task shows a warning with both dates; the option "Tasks will always honor their constraint dates" (in the Extended window) says who wins. Without the option the link wins and the slack becomes negative. Start No Earlier Than stays what a dragged bar and the Start cell write.' },
  { id: 'A4', key: 'ganttScheduleFromFinishEnabled', group: 'scheduling', title: 'Schedule from the project finish date',
    short: 'Plan backward from a fixed finish; the start is calculated.',
    more: 'Normally the plan runs forward from the Project Start Date. Choose "Schedule from: Project finish date" (Project settings → Main) and type the finish: every task is placed as late as its successors allow, the start date becomes a result and is stored in the project. A warning shows when the calculated start is already in the past. Switching shows first how many tasks change their dates, because posted lines of those tasks must be posted again.' },
  { id: 'A5', key: 'ganttDeadlineEnabled', group: 'scheduling', title: 'Deadline date',
    short: 'A date that never moves the task, but warns when missed.',
    more: 'A task can have a Deadline (Task window → Advanced). It does not move anything. The Gantt chart draws a marker at the deadline and turns it red when the finish is later; the tree shows a warning icon. Use it for promised dates that must be watched, not enforced.' },
  { id: 'A6', key: 'ganttTaskTypesEnabled', group: 'scheduling', title: 'Task types and effort-driven',
    short: 'Fixed units, fixed work or fixed duration.',
    more: 'A task gets Work (hours), Units (%) and a Type (Fixed Units, Fixed Duration, Fixed Work) plus Effort driven. Work = Duration × Units × hours per day. When you edit one of the three the Type decides which of the others is recalculated; Effort driven decides whether more units shorten the task (same work) or add work. The duration of the Gantt bar is the duration of the task. Edited in Task window → Advanced.' },
  { id: 'A8', key: 'ganttDurationUnitsEnabled', group: 'scheduling', title: 'Duration units and elapsed time',
    short: 'Type 3d, 2w, 1mo, 4ed: working or calendar days.',
    more: 'Durations can be typed with a unit: d (working days), w (weeks = 5 working days), mo (months = 20 working days), and elapsed units ed / ew that count calendar days and ignore the calendar (curing, shipping). The tree Duration cell and the Task window accept the text; the plan still keeps the duration in days. An elapsed task runs through weekends and holidays.' },
  { id: 'A9', key: 'ganttEstimatedDurationEnabled', group: 'scheduling', title: 'Estimated duration',
    short: 'Mark a duration as tentative with "?".',
    more: 'A duration typed with a trailing "?" (3d?) or switched in Task window → Advanced is marked as an estimate: the Duration cell shows the question mark and the Gantt bar is drawn with a dashed outline until the estimate is confirmed. The dates are calculated exactly as for a normal duration.' },
  { id: 'A10', key: 'ganttTaskCalendarEnabled', group: 'scheduling', title: 'Task calendars',
    short: 'A task can follow its own working calendar.',
    more: 'Besides the project calendar you can define named calendars (Extended window → Calendars) and give a task its own, for example a night-shift task that works seven days a week. The task is scheduled in its calendar; lags of links follow the calendar of the successor. Tasks without a calendar use the project calendar.',
    requires: [] },
  { id: 'A11', key: 'ganttCalendarExceptionsEnabled', group: 'scheduling', title: 'Calendar exceptions and work weeks',
    short: 'Holidays, days off and a custom working week.',
    more: 'A calendar can have a working week (which weekdays are worked) and exceptions: holidays and days off, or an extra working day. Tasks skip non-working days, and the Gantt chart shades them. Define the project calendar and more calendars in the Extended window → Calendars; the project calendar is the one the whole plan uses.' },
  { id: 'A12', key: 'ganttSplitTasksEnabled', group: 'scheduling', title: 'Split tasks',
    short: 'Interrupt a bar with a gap and continue later.',
    more: 'A task can be split: work stops for a number of working days and continues. The bar is drawn in segments connected by a thin line, the finish moves by the length of the gaps. Add or remove splits in Task window → Advanced (after how many days of work, how long the pause).' },
  { id: 'A13', key: 'ganttRecurringTasksEnabled', group: 'scheduling', title: 'Recurring tasks',
    short: 'Create a series: daily, weekly, monthly, yearly.',
    more: 'Menu "Insert recurring task" creates a stage with one task for each occurrence of a pattern (every day, every week on chosen weekdays, every month on a day, every year) up to an end date or a number of occurrences. Each occurrence is a normal task with its own start; edit or delete them one by one.' },
  { id: 'A14', key: 'ganttInactiveTasksEnabled', group: 'scheduling', title: 'Inactive tasks',
    short: 'Keep a task on the chart but out of the plan.',
    more: 'A task can be made Inactive (row menu or Task window → Advanced). It stays visible, greyed and struck through, but is removed from the schedule: its links, its dates and its progress do not count for other tasks, stages or the project. Reversible, good for what-if plans.' },
  { id: 'A15', key: 'ganttTaskPriorityEnabled', group: 'scheduling', title: 'Task priority',
    short: 'A 0-1000 priority per task for sorting and filters.',
    more: 'Every task gets a Priority from 0 to 1000 (default 500), set in Task window → Advanced and shown in the optional tree column Priority. Use it to sort, filter, group and highlight the tasks that matter most; it is exported to MS Project.' },
  // ---- B: links ---------------------------------------------------------------------------------------------------------------------------------------------------------
  { id: 'B1', key: 'ganttPredecessorsColumnEnabled', group: 'links', title: 'Predecessors column',
    short: 'Type links in the cell: 5FS+2d, 7SS.',
    more: 'Adds the tree column Predecessors. Type the links of a task as text: row number, link type and lag, separated by commas (3, 5SS-1d, 7FS+2w). The links are replaced by what you typed. Row numbers are the outline numbers of the # column.' },
  { id: 'B2', key: 'ganttLinkUnlinkEnabled', group: 'links', title: 'Link / unlink selected tasks',
    short: 'Chain the checked tasks in one click.',
    more: 'Two buttons in the tree toolbar: Link makes the checked tasks a finish-to-start chain in tree order (a link that exists or would create a cycle is skipped); Unlink removes every link between the checked tasks. Keys Ctrl+F2 and Ctrl+Shift+F2 on the web.' },
  { id: 'B3', key: 'ganttAutoLinkEnabled', group: 'links', title: 'Auto-link on insert and delete',
    short: 'Keep the chain closed when a task is added or removed.',
    more: 'Deleting a task connects its predecessors to its successors; adding a task right below a task that has a single finish-to-start successor puts the new task between them. Without it deleting a task deletes its links and leaves a gap in the chain.' },
  { id: 'B4', key: 'ganttLagPercentEnabled', group: 'links', title: 'Lag as a percentage',
    short: 'A lag of +50% of the predecessor duration.',
    more: 'In the dependency window the lag can be a percentage of the predecessor duration instead of days. The scheduler turns it into days on every calculation, so the lag follows the predecessor when its duration changes. In the Predecessors column write 5FS+50%.' },
  { id: 'B5', key: 'ganttCrossProjectLinksEnabled', group: 'links', title: 'Links to tasks of other projects',
    short: 'A task waits for a task of another project.',
    more: 'A task can have an external predecessor: paste the GUID of a task of another project (row menu "Copy GUID") in Task window → Advanced, choose the link type and lag. The task is scheduled after the stored dates of that task; the external task is shown by name and dates. The other project is never changed.' },
  { id: 'B6', key: 'ganttTaskInspectorEnabled', group: 'links', title: 'Task inspector',
    short: 'Explains why a task starts on its date.',
    more: 'Row menu "Task inspector" opens a window that explains the start of the task: the driving predecessor, the constraint, the calendar, the manual start or the project start, and the slack. It lists conflicts and what to change.' },
  { id: 'B7', key: 'ganttTaskPathEnabled', group: 'links', title: 'Task path highlight',
    short: 'Colour the predecessors and successors of a task.',
    more: 'Row menu "Task path" colours on the chart the predecessors, the driving predecessors, the successors and the driven successors of the selected task, so you see what holds a task back and what it holds back.' },
  // ---- C: tracking ------------------------------------------------------------------------------------------------------------------------------------------------------
  { id: 'C1', key: 'ganttBaselinesEnabled', group: 'tracking', title: 'Baselines',
    short: 'Save the plan (up to 11 baselines) and see the variance.',
    more: 'Project actions → "Set baseline" saves the start, finish and duration of the whole project (or of the checked tasks) into Baseline 0…10. The optional tree columns Baseline start / finish and Start / Finish variance compare the plan with the baseline. Project versions remain the way to save a whole copy of the plan.' },
  { id: 'C2', key: 'ganttTrackingBarsEnabled', group: 'tracking', title: 'Tracking Gantt (baseline bars)',
    short: 'A thin grey bar of the baseline under every task bar.',
    more: 'Draws the baseline of the chosen baseline number as a thin grey bar under each task bar, so the slip of the plan is visible at a glance.',
    requires: ['ganttBaselinesEnabled'] },
  { id: 'C3', key: 'ganttActualDatesEnabled', group: 'tracking', title: 'Actual start and finish',
    short: 'Actual bars beside the plan on one chart.',
    more: 'Tasks get Actual start and Actual finish (Task window → Advanced). They are filled in when you enter progress: the first % sets the actual start, 100% sets the actual finish; you can correct them. The Gantt chart draws the plan bar, the baseline and the actual bar together on one chart (plan on top, actual under it).' },
  { id: 'C5', key: 'ganttStatusDateEnabled', group: 'tracking', title: 'Status date and Update project',
    short: 'A status date, mark work complete, reschedule the rest.',
    more: 'The project gets a Status date (Extended window). The chart draws a line at it. Project actions → "Update project": "Mark work complete through the status date" sets the % of every task by its dates; "Reschedule uncompleted work" moves not-started tasks that should have started before the status date to start on it.' },
  { id: 'C7', key: 'ganttProgressLinesEnabled', group: 'tracking', title: 'Progress lines',
    short: 'A zig-zag line at the status date: behind or ahead.',
    more: 'Draws the MS Project progress line: a line through the chart at the status date that bends left of it for tasks that are behind schedule and right of it for tasks that are ahead. It is a new line; the existing progress fill of the bars is not changed.' },
  { id: 'C8', key: 'ganttEarnedValueEnabled', group: 'tracking', title: 'Earned value (EVM)',
    short: 'PV, EV, AC, SPI, CPI, EAC in the project and in Monitor01.',
    more: 'Computes the earned value of the project at the status date: planned value (PV, budget spread over the task dates), earned value (EV, budget × % complete) and actual cost (AC, used quantities × price from Monitor01), then SV, CV, SPI, CPI, EAC, ETC and VAC. Shown in the new strip of Monitor01 and in the project card of the Extended window.' },
  // ---- E: chart ---------------------------------------------------------------------------------------------------------------------------------------------------------
  { id: 'E1', key: 'ganttTimescaleEnabled', group: 'chart', title: 'Timescale options',
    short: 'Choose the units and labels of the time scale.',
    more: 'The Extended window → Chart options lets you choose the top and bottom tier of the time scale (year, quarter, month, week, day) and the label format instead of the automatic choice by zoom.' },
  { id: 'E2', key: 'ganttBarStylesEnabled', group: 'chart', title: 'Bar styles',
    short: 'Colour and shape per kind of bar.',
    more: 'Choose the colour of normal, summary, milestone, critical and manual bars and the corner style of the bars. The colour of one task (Colors tab of the task window) still wins.' },
  { id: 'E3', key: 'ganttBarTextEnabled', group: 'chart', title: 'Text on the bars',
    short: 'Show start, finish, duration or % beside the name.',
    more: 'Choose which fields are written on the bar: the name inside, and left or right of the bar the start, finish, duration, % complete or priority.' },
  { id: 'E4', key: 'ganttGridlinesEnabled', group: 'chart', title: 'Gridlines',
    short: 'Today, status date, project start/finish, week lines.',
    more: 'Switch on or off the lines of the chart: the Today line, the status date line, the project start and finish lines, the weekly and monthly column lines and the row lines.' },
  { id: 'E5', key: 'ganttLayoutOptionsEnabled', group: 'chart', title: 'Layout options',
    short: 'Bar height and bars on summary rows.',
    more: 'Choose the height of the bars (small, normal, large) and whether summary bars show the details of their tasks.' },
  { id: 'E6', key: 'ganttRollupBarsEnabled', group: 'chart', title: 'Rollup bars on summary tasks',
    short: 'A collapsed stage shows the bars of its tasks.',
    more: 'A collapsed stage draws small bars and milestones of its tasks on its summary bar, so the detail stays visible when you collapse it.' },
  { id: 'E7', key: 'ganttProjectSummaryRowEnabled', group: 'chart', title: 'Project summary row',
    short: 'A line above the chart with the dates and % of the whole project.',
    more: 'Shows one line above the Gantt chart with the whole project in numbers: start, finish, span in days, % complete (weighted by duration), tasks done of all, critical tasks and late tasks. It is read from the schedule and changes nothing.' },
  { id: 'E8', key: 'ganttOutlineLevelEnabled', group: 'chart', title: 'Show outline level',
    short: 'Expand the tree to level 1, 2, 3 ...',
    more: 'A menu in the tree toolbar "Show level" expands or collapses the whole tree to the chosen outline level (1 to 5, All).' },
  { id: 'E9', key: 'ganttTimelineViewEnabled', group: 'chart', title: 'Timeline view and e-mail',
    short: 'A one-line strip of chosen tasks, sent by e-mail.',
    more: 'The Timeline strip above the chart shows the tasks and milestones you add to it (row menu "Add to timeline") on one line. The button "E-mail" opens your mail program with the timeline as text.' },
  { id: 'E10', key: 'ganttDetailsPaneEnabled', group: 'chart', title: 'Details pane',
    short: 'Task form under the Gantt chart.',
    more: 'A pane under the Gantt chart shows the form of the selected task (name, dates, duration, %) so you can edit it without a window. Switch it on and off with the button on the Gantt bar.' },
  { id: 'E11', key: 'ganttIndicatorsColumnEnabled', group: 'chart', title: 'Indicators column',
    short: 'Icons: manual, constraint, deadline, note, conflict.',
    more: 'The Schedule column of the tree shows icons for the state of every row: manually scheduled, a constraint, a missed deadline, a conflict between a date and a link, an inactive task, a note, an estimated duration. The tip of an icon explains it.' },
  { id: 'E12', key: 'ganttTextStylesEnabled', group: 'chart', title: 'Text styles',
    short: 'Bold or coloured text for critical and summary rows.',
    more: 'Choose the style of the text of critical rows, summary rows and milestones in the tree and the chart (bold, colour).' },
  { id: 'E13', key: 'ganttScrollToTaskEnabled', group: 'chart', title: 'Scroll to task / zoom to selection',
    short: 'Jump to the bar of the selected task.',
    more: 'Two buttons on the Gantt bar: Scroll to task moves the chart to the bar of the selected task; Zoom to selection fits the time scale to the checked tasks.' },
  // ---- F: table ---------------------------------------------------------------------------------------------------------------------------------------------------------
  { id: 'F1', key: 'ganttCopyPasteEnabled', group: 'table', title: 'Copy and paste rows',
    short: 'Copy checked rows as text, paste rows from Excel.',
    more: 'Tree toolbar: Copy puts the checked rows on the clipboard as tab-separated text (name, duration, start, %). Paste creates new tasks from such text, also copied from Excel, below the selected row.' },
  { id: 'F2', key: 'ganttFillDownEnabled', group: 'table', title: 'Fill down',
    short: 'Copy a value of the first checked row to the others.',
    more: 'Tree toolbar "Fill down" copies the duration, start constraint or % of the first checked row to all other checked rows (you choose which field).' },
  { id: 'F3', key: 'ganttRangeSelectionEnabled', group: 'table', title: 'Range selection and multi-edit',
    short: 'Check a range of rows, edit all checked tasks together.',
    more: 'Check the first and the last row, then the item "Check the rows between the first and the last checked" of the tree menu checks the whole range. "Edit the checked rows" changes duration, % or priority of all checked tasks at once.' },
  { id: 'F4', key: 'ganttColumnPickerEnabled', group: 'table', title: 'Column picker',
    short: 'Show or hide any column of the tree.',
    more: 'A menu in the tree toolbar lists all columns (also the optional ones: Predecessors, Priority, Deadline, Baseline, Variance, Constraint ...) with a check box to show or hide each.' },
  { id: 'F5', key: 'ganttCustomFieldsEnabled', group: 'table', title: 'Custom fields: formulas and lists',
    short: 'Calculated columns and pick-lists.',
    more: 'Custom columns can be a Formula (for example [Duration]*8 or [% Complete]>50) or a List (a fixed list of values to choose from). Formula columns are calculated for every row and cannot be edited.' },
  { id: 'F6', key: 'ganttWbsCodeEnabled', group: 'table', title: 'WBS code mask',
    short: 'Format outline numbers like A.01.001.',
    more: 'Define the format of the outline number per level (numbers, letters, fixed text) in the Extended window, for example A.01.001. The # column shows the code.' },
  { id: 'F7', key: 'ganttFindReplaceEnabled', group: 'table', title: 'Find, replace, go to',
    short: 'Ctrl+F, replace names, go to a row number or date.',
    more: 'A window to find text in the task names and notes, replace it, and jump to a row by its outline number or to a date on the chart.' },
  { id: 'F8', key: 'ganttGroupByEnabled', group: 'table', title: 'Group by',
    short: 'Group the table by priority, critical, % and more.',
    more: 'Group the rows of the tree by a field (priority band, critical or not, % complete band, duration band, inactive). Each group gets a coloured band and its rows are kept together.' },
  { id: 'F9', key: 'ganttHighlightFilterEnabled', group: 'table', title: 'Highlight filter',
    short: 'Colour the rows that match, hide none.',
    more: 'Choose a rule (critical, late, milestones, in progress, behind baseline, priority above ...) and the matching rows get a coloured background while all rows stay visible.' },
  { id: 'F10', key: 'ganttNamedViewsEnabled', group: 'table', title: 'Named views',
    short: 'Save and switch sets of columns, filter and sort.',
    more: 'Save the current columns, their order and widths, filters and sort under a name and switch between the saved views from a menu. Views belong to the project.' },
  { id: 'F11', key: 'ganttKeyboardCommandsEnabled', group: 'table', title: 'Keyboard commands',
    short: 'Alt+Shift arrows, Ctrl+F2, Ctrl+G ...',
    more: 'More shortcuts on the web: Alt+Shift+Left / Right outdent and indent, Alt+Shift+Up / Down move, Alt+Shift+= / - expand and collapse the selected stage, Ctrl+F2 link, Ctrl+Shift+F2 unlink, Ctrl+F find, Ctrl+G go to, F9 calculate.' },
  // ---- G: task window ---------------------------------------------------------------------------------------------------------------------------------------------------
  { id: 'G1', key: 'ganttTaskInformationEnabled', group: 'task', title: 'Task information: Advanced tab',
    short: 'One Advanced tab for all the scheduling inputs.',
    more: 'Adds the tab Advanced to the task window: it collects the mode, constraint, deadline, task type, calendar, priority, actual dates, split, external predecessor and the other inputs of the functions that are switched on. The tab also appears by itself as soon as one of those functions is on; this switch shows it always.' },
  { id: 'G2', key: 'ganttMilestoneFlagEnabled', group: 'task', title: 'Mark a task as milestone',
    short: 'A diamond at the finish of a task that has a duration.',
    more: 'The check box "Mark as milestone" (Task window → Advanced) draws a diamond at the finish of any task, without changing its duration. A task with a zero duration is a milestone as before.' },
  { id: 'G4', key: 'ganttRichNotesEnabled', group: 'task', title: 'Rich notes',
    short: 'Bold, italic and bullets in the notes.',
    more: 'The notes of a task get a small toolbar: bold, italic, bullet list. The text is saved with simple markup (**bold**, _italic_, - bullet) in the same notes field, and shown formatted under the field in the task window. Other places still show the plain text.' },
  // ---- H: print ---------------------------------------------------------------------------------------------------------------------------------------------------------
  { id: 'H1', key: 'ganttPrintOptionsEnabled', group: 'print', title: 'Print options',
    short: 'A window of print options before "Export to PDF".',
    more: 'Export to PDF first asks for the options in a window: header and footer text, legend, date range and orientation. Every option is off by default, so a plain export is the same as before.' },
];

export const PM_EXTENDED_KEYS: string[] = PM_EXTENDED_FEATURES.map((f) => f.key);
export const extendedFeatureOf = (key: string): PMExtendedFeature | undefined => PM_EXTENDED_FEATURES.find((f) => f.key === key);

type ProjectJSONLike = Partial<PMRowJSON> | Record<string, unknown> | null | undefined;

/** the master switch of the project */
export const extendedMasterOf = (json: ProjectJSONLike): boolean => (json as any)?.[GANTT_EXTENDED_MASTER_KEY] === true;

/** the state of every function: false unless the master AND its own switch AND the functions it requires are on */
export function extendedOf(json: ProjectJSONLike): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  const master = extendedMasterOf(json);
  for (const f of PM_EXTENDED_FEATURES) out[f.key] = master && (json as any)?.[f.key] === true;
  for (const f of PM_EXTENDED_FEATURES) if (out[f.key] && f.requires?.some((k) => !out[k])) out[f.key] = false;
  return out;
}

/** is one function on? (master + switch + requirements) */
export const isExtended = (json: ProjectJSONLike, key: string): boolean => extendedOf(json)[key] === true;

/** the rowJSON patch that turns functions on or off (the master is not touched) */
export function extendedPatch(values: Record<string, boolean>): Record<string, boolean> {
  const patch: Record<string, boolean> = {};
  for (const k of PM_EXTENDED_KEYS) if (k in values) patch[k] = values[k] === true;
  return patch;
}

/** how many functions are on (the badge of the Extended button) */
export const extendedCountOf = (json: ProjectJSONLike): number => Object.values(extendedOf(json)).filter(Boolean).length;

/** the functions whose fields are in the tab "Advanced" of the task window: the tab is shown while one of them (or G1) is on */
export const ADVANCED_TAB_KEYS = [
  'ganttTaskInformationEnabled', 'ganttManualSchedulingEnabled', 'ganttConstraintsEnabled', 'ganttDeadlineEnabled', 'ganttTaskTypesEnabled', 'ganttDurationUnitsEnabled',
  'ganttEstimatedDurationEnabled', 'ganttTaskCalendarEnabled', 'ganttSplitTasksEnabled', 'ganttInactiveTasksEnabled', 'ganttTaskPriorityEnabled', 'ganttMilestoneFlagEnabled',
  'ganttActualDatesEnabled', 'ganttCrossProjectLinksEnabled', 'ganttTaskInspectorEnabled',
];
export const advancedTabOn = (json: ProjectJSONLike): boolean => {
  const e = extendedOf(json);
  return ADVANCED_TAB_KEYS.some((k) => e[k] === true);
};
