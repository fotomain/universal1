// Project cost total - the two database calls (start2_sql_code.sql PART 27).
import { COST_PAGE_SIZE, COST_TOTAL_TABLE, CostTotalRow, CostUpdateAnswer, RPC_UPDATE_PROJECT_COST_TOTAL, parseCostAnswer, parseCostRow } from './costTotalModel';

/** every cost row of the project (pages of COST_PAGE_SIZE: the API returns at most 1000 rows a call) */
export async function readProjectCostRows(client: any, projectGUID: string): Promise<CostTotalRow[]> {
  const out: CostTotalRow[] = [];
  for (let from = 0; ; from += COST_PAGE_SIZE) {
    const { data, error } = await client.from(COST_TOTAL_TABLE).select('rowOwnerGUID,costOwnForBudget,costTotalForBudget').eq('rowProjectGUID', projectGUID).order('rowOwnerGUID').range(from, from + COST_PAGE_SIZE - 1);
    if (error) throw new Error(error.message || String(error));
    const page = (data || []) as any[];
    for (const raw of page) out.push(parseCostRow(raw));
    if (page.length < COST_PAGE_SIZE) break;
  }
  return out;
}

/**
 * update_project_cost_total: the database applies the queued tasks of the project, then rebuilds its cost totals from scratch (heals any drift) and answers
 * { tasks, rows, projectTotal, changedRows, ms, flushed }. The error of the database is thrown (the caller shows it), never swallowed.
 */
export async function updateProjectCostTotal(client: any, projectGUID: string): Promise<CostUpdateAnswer> {
  const { data, error } = await client.rpc(RPC_UPDATE_PROJECT_COST_TOTAL, { p_project: projectGUID });
  if (error) throw new Error(error.message || String(error));
  return parseCostAnswer(data);
}
