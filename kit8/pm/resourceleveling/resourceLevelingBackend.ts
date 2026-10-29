// resourceLevelingBackend - WHERE a run is calculated (project setting resourceLevelingComputationSide; documentation/RESOURCE_LEVELING_WBS.html section 19).
//   Client side computations   planLevelingRun on this device.
//   Server side computations   the database searches (project_resource_leveling_server_plan), this device CHECKS the proposal with the scheduler of the screen (the run continues from the proposal:
//                              what is right stays, a conflict the database left is solved here) and shows the same preview. A plan the database does not calculate, a database without
//                              PART 42 and a failed call are calculated on this device and the outcome SAYS so (ComputationOutcome.fallback): a choice is never ignored silently.
// Pure apart from the injected call, so it is tested without a database.
import { resourceLevelingOf } from './resourceLevelingSettings';
import type { ComputationOutcome } from './resourceLevelingComputation';
import { isServerPlanMissing, type ServerPlanAnswer } from './resourceLevelingApi';
import { planLevelingRun, prepareLevelingRun, type LevelingPlan, type PlanLevelingArgs } from './resourceLevelingRun';
import { serverProblemOf, type ServerProblem } from './resourceLevelingServerProblem';

export interface CalculatedPlan { plan: LevelingPlan; outcome: ComputationOutcome }

export type FetchServerPlan = (problem: ServerProblem) => Promise<ServerPlanAnswer>;

export async function calculateLevelingPlan(args: PlanLevelingArgs, fetchPlan: FetchServerPlan): Promise<CalculatedPlan> {
  const prepared = prepareLevelingRun(args);
  const server = prepared.effective.computation === 'resourceLevelingServerSideComputations';
  const asked = prepared.effective.computation;
  if (!server) return { plan: planLevelingRun(args, prepared), outcome: { asked, used: 'client' } };

  const client = (fallback: NonNullable<ComputationOutcome['fallback']>, reasons?: string[]): CalculatedPlan => ({
    plan: planLevelingRun(args, prepared), outcome: { asked, used: 'client', fallback, ...(reasons?.length ? { reasons } : {}) },
  });
  const built = serverProblemOf(args, prepared);
  if (!built.problem) return client('planNotSupported', built.reasons);
  try {
    const answer = await fetchPlan(built.problem);
    if (!answer || answer.supported !== true) return client('planNotSupported', (answer as { reasons?: string[] } | undefined)?.reasons ?? []);
    const plan = planLevelingRun({ ...args, seed: { delays: answer.delays, moves: answer.moves, unresolved: answer.unresolved } }, prepared);
    // how much the screen had to change in the proposal of the database (0 = the proposal was right as it came)
    const final = plan.result.delays;
    const tasks = new Set([...Object.keys(answer.delays), ...Object.keys(final)]);
    let adjusted = 0;
    for (const g of tasks) if ((answer.delays[g] || 0) !== (final[g] || 0)) adjusted++;
    return { plan, outcome: { asked, used: 'server', adjusted } };
  } catch (e) {
    return client(isServerPlanMissing(e) ? 'serverUnavailable' : 'serverError');
  }
}
