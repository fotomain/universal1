// Subprojects - the database calls (start2_sql_code.sql PART 29). The error of the database is thrown (the caller shows it), never swallowed.
import { PMSubprojectCandidate, parseSubprojectCandidate } from './subprojectModel';

export const RPC_SUBPROJECT_CANDIDATES = 'subproject_candidates';
export const RPC_ORGANIZATION_HAS_SUBPROJECTS = 'organization_has_subprojects_enabled';
export const SUBPROJECT_LINK_TABLE = 'project_subproject_link';

/** the projects a task of p_originProject may stand for (same organization, not the project itself, no cycle) */
export async function fetchSubprojectCandidates(client: any, originProjectGUID: string): Promise<PMSubprojectCandidate[]> {
  const { data, error } = await client.rpc(RPC_SUBPROJECT_CANDIDATES, { p_origin_project: originProjectGUID });
  if (error) throw new Error(error.message || String(error));
  return ((data || []) as any[]).map(parseSubprojectCandidate);
}

/** does any project of the organization use the functionality (Monitor01 shows its radio only then) */
export async function fetchOrganizationHasSubprojects(client: any): Promise<boolean> {
  const { data, error } = await client.rpc(RPC_ORGANIZATION_HAS_SUBPROJECTS);
  if (error) throw new Error(error.message || String(error));
  return data === true;
}

/** the GUIDs of the projects that are the subproject of at least one task */
export async function fetchSubprojectGUIDs(client: any): Promise<Set<string>> {
  const out = new Set<string>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from(SUBPROJECT_LINK_TABLE).select('rowSubprojectGUID').order('rowOwnerGUID').range(from, from + PAGE - 1);
    if (error) throw new Error(error.message || String(error));
    const page = (data || []) as any[];
    for (const r of page) if (r?.rowSubprojectGUID) out.add(String(r.rowSubprojectGUID));
    if (page.length < PAGE) break;
  }
  return out;
}
