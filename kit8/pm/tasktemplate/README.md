# Task templates (`kit8/pm/tasktemplate`)

A task - or a stage with everything inside it - is saved under a title ("Save to template") and fills another task later ("Fill from template"). Shared by every user of the **organization**. Design, tables, rules and the decisions that were taken without asking: `documentation/TASK_TEMPLATE_WBS.html`.

## Where it is in the app
The task context menu (right click on a tree row / Gantt bar, long press on touch), the main FAB of the dashboard with a task selected and the FAB of the task page: **Save to template**, **Fill from template** (right after Duplicate). The two windows (`view/PMTaskTemplateWindows.tsx`) are mounted once in `PMProjectDashboard` and `PMProjectTaskInfo`.

## SQL (PART 40)
`task_template_header / _task / _dependency / _line` (`start1_sql_tables.sql`); `task_template_save / _fill / _set_title`, RLS (`start2_sql_code.sql`); dropped by part `1a-00000000` of `delete_sql_structure.sql`. The tables are written ONLY by the RPCs; the client reads them (RLS: the organization) and deletes a header (the creator or the administrator).

## Rules worth knowing
- A template has its own ids; links and lines are mapped to new ids at fill (`md5(run id || template id)`).
- Not stored: dates of the scheduler, custom column values, subproject flag, posting state, the sums in the accounting / budget currency (the user presses **Recalculate** after a fill), documents.
- `tree` template (a stage, or a task with rows inside) = the rows inside the top row are created inside the target; `single` (one task) = its data and lines go into the target. The target keeps its own name and kind. **Replace what the row has now** deletes the rows / lines of the target first (asks).
- The target must be in a project the filling user owns.

## Big templates
Measured with `kit8/docker/bench_task_template.sh [rows]` (2 000 rows: save 1.2 s, fill 1.9 s, Replace 3.2 s; 10 000 rows: 1.5 s / 5 s / 12 s). A row with more than **5 000 rows** inside is refused at Save. `task_template_fill` sets `app.task_bulk = on` for its statements: the progress trigger, the calendar sync, the dependency delete rebuild and the cycle walk of a new link skip their per-row work, and the fill does it once at the end. A NEW trigger on `project_task_table` / the dependencies that does O(project) work per row must look at `current_setting('app.task_bulk', true)` too. Details and the table of hot spots: `documentation/TASK_TEMPLATE_WBS.html`.

## Files
`model/taskTemplateTypes.ts` (names, types, texts) · `api/taskTemplateApi.ts` (Supabase) · `store/store_task_template.ts` (open windows) · `crud/useTaskTemplates.ts` (openers, list, commands) · `view/PMTaskTemplateWindows.tsx`.

## Tests
Jest `__tests__/pm/tasktemplate` (model, API, SQL text, UI) · Docker `kit8/docker/tests/98_task_template.sql` (`./test_fact_monitor01.sh 98`).
