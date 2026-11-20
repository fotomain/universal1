// Speed of the two planning algorithms on the device: scheduleProject (days) against scheduleProjectHours (the same scheduler on the virtual working-minute axis).
// Not part of the normal run (it is slow and prints numbers): BENCH_PLAN=1 npx jest __tests__/pm/hourmodel/scheduleBench [BENCH_TASKS=500,2000,5000]
import { buildHourAxis } from '../../../kit8/pm/hourmodel/hourAxis';
import { scheduleProjectHours } from '../../../kit8/pm/hourmodel/scheduleHours';
import { scheduleProject } from '../../../kit8/pm/view/project/scheduling';
import { D0, makeLink, makeTask, resetSeq, WEEKDAYS } from '../resourceleveling/levelingTestKit';

const WINDOWS = [{ from: '09:00', to: '13:00' }, { from: '14:00', to: '18:00' }];
const run = process.env.BENCH_PLAN ? test : test.skip;
const SIZES = (process.env.BENCH_TASKS ?? '500,2000,5000').split(',').map(Number);
const REPS = 5;

// a plan like a real one: tasks in chains of 25, each task after the one before (FS) and every 5th also after a task of the chain before (SS +1 / FS lag 1), durations 1..6 days
function makePlan(n: number, minutes: boolean) {
  resetSeq();
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const tasks = [] as ReturnType<typeof makeTask>[];
  const deps = [] as ReturnType<typeof makeLink>[];
  for (let i = 0; i < n; i++) {
    const days = 1 + Math.floor(rnd() * 6);
    const extra: Record<string, unknown> = minutes ? { taskDurationMinutes: 30 + Math.floor(rnd() * days * 480), ...(i % 7 === 0 ? { taskStartMinute: 9 * 60 + 15 * Math.floor(rnd() * 20) } : {}) } : {};
    const t = makeTask('T' + i, days, extra);
    tasks.push(t);
    if (i % 25 !== 0) deps.push(makeLink(tasks[i - 1], t));
    if (i >= 25 && i % 5 === 0) deps.push(makeLink(tasks[i - 25 + Math.floor(rnd() * 24)], t, i % 10 === 0 ? 'SS' : 'FS', 1));
  }
  return { tasks, deps };
}

function time<T>(fn: () => T): { ms: number[]; last: T } {
  const ms: number[] = [];
  let last!: T;
  fn(); // warm-up (JIT)
  for (let i = 0; i < REPS; i++) { const t0 = performance.now(); last = fn(); ms.push(performance.now() - t0); }
  return { ms: ms.sort((a, b) => a - b), last };
}
const med = (a: number[]) => a[Math.floor(a.length / 2)];

describe('BENCH scheduleProject (days) vs scheduleProjectHours (minutes)', () => {
  run('the same plan, both schedulers', () => {
    const rows: string[] = [];
    for (const n of SIZES) {
      const whole = makePlan(n, false);
      const mins = makePlan(n, true);
      const axisT = time(() => buildHourAxis({ windows: WINDOWS, calendar: WEEKDAYS, originMs: D0 }));
      const axis = buildHourAxis({ windows: WINDOWS, calendar: WEEKDAYS, originMs: D0 });
      const d = time(() => scheduleProject({ tasks: whole.tasks, deps: whole.deps, projectStartMs: D0, calendar: WEEKDAYS }));
      const hw = time(() => scheduleProjectHours({ tasks: whole.tasks, deps: whole.deps, projectStartMs: D0, axis }));
      const hm = time(() => scheduleProjectHours({ tasks: mins.tasks, deps: mins.deps, projectStartMs: D0, axis }));
      const f = (x: number) => x.toFixed(1).padStart(8);
      rows.push(`${String(n).padStart(6)} tasks | days ${f(med(d.ms))} ms | hours, whole-day tasks ${f(med(hw.ms))} ms (x${(med(hw.ms) / med(d.ms)).toFixed(2)}) | hours, minute tasks + pins ${f(med(hm.ms))} ms (x${(med(hm.ms) / med(d.ms)).toFixed(2)}) | axis build ${f(med(axisT.ms))} ms | ${Object.keys(d.last.rows).length}/${Object.keys(hm.last.rows).length} rows`);
    }
    process.stdout.write('\nBENCH schedulers (median of ' + REPS + ' runs, jsdom, this machine)\n' + rows.join('\n') + '\n');
  }, 600000);
});
