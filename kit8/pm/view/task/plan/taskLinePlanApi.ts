// Task line plan - the RPC create_task_line_plan (kit8/sql/init/create_task_line_plan_table.sql): ONE transaction replaces the posted days of a task.
// the Supabase client is loaded when Post is pressed, so importing this file (a screen, a test) never creates the client
const client = async () => (await import('../../../../supabase/supabase')).supabase;
import type { TaskLinePlanJSON } from './taskLinePlanModel';

export const rpcCreateTaskLinePlan = 'create_task_line_plan';

export interface CreateTaskLinePlanResult { lines: number; rows: number }

/** Post: send the minimum (taskLinePlanJSON); throws with the message of the database when it refuses (nothing is written then) */
export async function createTaskLinePlan(taskLinePlanJSON: TaskLinePlanJSON): Promise<CreateTaskLinePlanResult> {
  const supabase = await client();
  const { data, error } = await supabase.rpc(rpcCreateTaskLinePlan, { taskLinePlanJSON });
  if (error) throw new Error(error.message || String(error));
  const d: any = data || {};
  return { lines: Number(d.lines) || 0, rows: Number(d.rows) || 0 };
}
