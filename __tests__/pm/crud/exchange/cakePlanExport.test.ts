// documentation/CAKE2: writes the rows the app's IMPORT would write into a real project, so they can be sent to the database (Supabase CLI) exactly as the app does it:
//   planProjectImport(file, target project row, owner, new GUIDs)  ->  { project, owner, tasks, deps, lines, projectRowJSON }.
// Skipped unless CAKE_PLAN_OUT is set.   CAKE_PLAN_OUT=<out.json> CAKE_TARGET=<target project row json (project_table row)> [CAKE2_JSON=<plan file>] npx jest __tests__/pm/crud/exchange/cakePlanExport.test.ts
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { parseProjectExchangeFile } from '../../../../kit8/pm/crud/exchange/project/projectExchangeFormat';
import { planProjectImport } from '../../../../kit8/pm/crud/exchange/project/import/planProjectImport';

const OUT = process.env.CAKE_PLAN_OUT;
const TARGET = process.env.CAKE_TARGET;
const FILE = process.env.CAKE2_JSON || path.resolve(__dirname, '../../../../documentation/CAKE2/cake2_plan_json.json');
const d = OUT && TARGET ? describe : describe.skip;

d('CAKE plan export for the real import', () => {
  it('plans the import into the target project and writes the rows', () => {
    const file = parseProjectExchangeFile(fs.readFileSync(FILE, 'utf8'));
    const target = JSON.parse(fs.readFileSync(TARGET!, 'utf8'));
    const plan = planProjectImport(file, target, target.rowOwnerGUID, () => randomUUID());
    expect(plan.skippedDependencies).toBe(0);
    expect(plan.skippedLines).toBe(0);
    fs.writeFileSync(OUT!, JSON.stringify({ project: target.rowGUID, owner: target.rowOwnerGUID, tasks: plan.tasks, deps: plan.dependencies, lines: plan.taskLines, projectRowJSON: plan.projectRowJSON }));
  });
});
