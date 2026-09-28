// In-memory stand-in for the Supabase client used by kit8/pm/crud/* (PostgREST subset):
//   from(table).select / insert(...).select() / update(...) / delete()
//     .eq .ilike('rowJSON->>name', pattern) .order .limit .single .maybeSingle   (awaitable)
//   rpc('pm_apply_schedule', args)
// It also plays the SQL triggers the PM module relies on:
//   - deleting a task deletes its subtree (ltree) and every dependency touching it
//   - changing a task's treePath re-paths its subtree
//   - a dependency must reference existing tasks, pairs are unique
// Every request is logged in `calls`; `failNext()` makes the next request fail (RLS / trigger
// errors), `dependencyRowJSONColumn = false` simulates the old schema without that column.
// (File name ends in TestKit so jest does not run it as a suite.)

export type Row = Record<string, any>;

export interface FakeCall {
  table: string;
  op: 'select' | 'insert' | 'update' | 'delete' | 'rpc';
  filters: [string, string, any][];
  payload?: any;
}

const TASKS = 'project_task_table';
const DEPS = 'project_task_dependencies_table';

function get(row: Row, col: string): any {
  const m = /^(\w+)->>(\w+)$/.exec(col);
  if (m) {
    const v = row[m[1]]?.[m[2]];
    return v === undefined || v === null ? null : String(v);
  }
  return row[col];
}

function likeToRegExp(pattern: string): RegExp {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '\\' && i + 1 < pattern.length) re += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    else if (c === '%') re += '.*';
    else if (c === '_') re += '.';
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'i');
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export class FakeSupabase {
  tables: Record<string, Row[]> = {
    project_table: [],
    project_task_table: [],
    project_task_dependencies_table: [],
    project_task_dependency_closure_table: [],
  };
  calls: FakeCall[] = [];
  rpcCalls: { fn: string; args: any }[] = [];
  dependencyRowJSONColumn = true;
  private failures: { table?: string; op?: string; message: string }[] = [];

  /** Next request (optionally only for this table / op) answers with an error. */
  failNext(message: string, match: { table?: string; op?: string } = {}) {
    this.failures.push({ ...match, message });
  }

  seed(table: string, rows: Row[]) {
    this.tables[table] = [...(this.tables[table] || []), ...clone(rows)];
  }

  rows(table: string): Row[] {
    return this.tables[table];
  }

  task(guid: string): Row | undefined {
    return this.tables[TASKS].find((t) => t.rowGUID === guid);
  }

  takeFailure(table: string, op: string): string | null {
    const i = this.failures.findIndex((f) => (!f.table || f.table === table) && (!f.op || f.op === op));
    if (i < 0) return null;
    return this.failures.splice(i, 1)[0].message;
  }

  from(table: string) {
    return new FakeQuery(this, table);
  }

  async rpc(fn: string, args: any) {
    this.rpcCalls.push({ fn, args });
    this.calls.push({ table: fn, op: 'rpc', filters: [], payload: args });
    const failure = this.takeFailure(fn, 'rpc');
    if (failure) return { data: null, error: { message: failure } };
    if (fn === 'pm_apply_schedule') {
      for (const w of args.p_rows || []) {
        const t = this.task(w.rowGUID);
        if (!t) continue;
        t.rowDuration = w.finishAt;
        t.rowJSON = { ...t.rowJSON, startAt: w.startAt };
        if (w.rowProgress !== undefined) t.rowProgress = w.rowProgress;
      }
      const p = this.tables.project_table.find((x) => x.rowGUID === args.p_project_guid);
      if (p) {
        p.rowDuration = args.p_project_finish;
        if (args.p_project_progress !== null) p.rowProgress = args.p_project_progress;
      }
      return { data: (args.p_rows || []).length, error: null };
    }
    return { data: null, error: { message: `unknown rpc ${fn}` } };
  }

  // the parts of supabase-js the React hooks touch outside of CRUD
  auth = {
    getSession: async () => ({ data: { session: null } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
  };
  channel() {
    const ch: any = { on: () => ch, subscribe: () => ch };
    return ch;
  }
  removeChannel() {
    return undefined;
  }
}

class FakeQuery implements PromiseLike<{ data: any; error: any }> {
  private op: FakeCall['op'] = 'select';
  private payload: any;
  private filters: [string, string, any][] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private max: number | null = null;
  private returning = false;
  private mode: 'many' | 'single' | 'maybeSingle' = 'many';

  constructor(private db: FakeSupabase, private table: string) {}

  select(_cols = '*') {
    if (this.op === 'select') this.op = 'select';
    else this.returning = true;
    return this;
  }
  insert(rows: Row | Row[]) {
    this.op = 'insert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  update(patch: Row) {
    this.op = 'update';
    this.payload = patch;
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }
  eq(col: string, value: any) {
    this.filters.push(['eq', col, value]);
    return this;
  }
  ilike(col: string, pattern: string) {
    this.filters.push(['ilike', col, pattern]);
    return this;
  }
  order(col: string, opts: { ascending?: boolean } = {}) {
    this.orders.push({ col, asc: opts.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  single() {
    this.mode = 'single';
    return this;
  }
  maybeSingle() {
    this.mode = 'maybeSingle';
    return this;
  }

  private matches(row: Row) {
    return this.filters.every(([kind, col, v]) => (kind === 'eq' ? get(row, col) === v : likeToRegExp(v).test(String(get(row, col) ?? ''))));
  }

  private shape(rows: Row[]) {
    if (this.mode === 'many') return { data: clone(rows), error: null };
    if (rows.length === 1) return { data: clone(rows[0]), error: null };
    if (this.mode === 'maybeSingle' && rows.length === 0) return { data: null, error: null };
    return { data: null, error: { message: `JSON object requested, multiple (or no) rows returned (${rows.length})` } };
  }

  private run(): { data: any; error: any } {
    const db = this.db;
    db.calls.push({ table: this.table, op: this.op, filters: this.filters, payload: this.payload });
    const failure = db.takeFailure(this.table, this.op);
    if (failure) return { data: null, error: { message: failure } };
    const all = db.tables[this.table];
    if (!all) return { data: null, error: { message: `relation "${this.table}" does not exist` } };

    if (this.op === 'select') {
      let rows = all.filter((r) => this.matches(r));
      for (const o of [...this.orders].reverse()) {
        rows = [...rows].sort((a, b) => {
          const x = get(a, o.col);
          const y = get(b, o.col);
          const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''));
          return o.asc ? c : -c;
        });
      }
      if (this.max !== null) rows = rows.slice(0, this.max);
      return this.shape(rows);
    }

    if (this.op === 'insert') {
      const rows = clone(this.payload as Row[]);
      if (this.table === DEPS) {
        if (!db.dependencyRowJSONColumn && rows.some((r) => 'rowJSON' in r))
          return { data: null, error: { message: `Could not find the 'rowJSON' column of '${DEPS}' in the schema cache` } };
        for (const r of rows) {
          if (!db.task(r.rowGUID) || !db.task(r.rowDependsOnGUID)) return { data: null, error: { message: 'violates foreign key constraint' } };
          if (all.some((d) => d.rowGUID === r.rowGUID && d.rowDependsOnGUID === r.rowDependsOnGUID))
            return { data: null, error: { message: 'duplicate key value violates unique constraint' } };
          r.rowJSON = r.rowJSON ?? {};
        }
      } else if (all.some((x) => rows.some((r) => r.rowGUID === x.rowGUID))) {
        return { data: null, error: { message: 'duplicate key value violates unique constraint' } };
      }
      all.push(...rows);
      return this.returning ? this.shape(rows) : { data: null, error: null };
    }

    if (this.op === 'update') {
      if (this.table === DEPS && !db.dependencyRowJSONColumn && 'rowJSON' in this.payload)
        return { data: null, error: { message: `Could not find the 'rowJSON' column of '${DEPS}' in the schema cache` } };
      const rows = all.filter((r) => this.matches(r));
      for (const r of rows) {
        const oldPath = r.treePath;
        Object.assign(r, clone(this.payload));
        // trigger: re-path the subtree
        if (this.table === TASKS && this.payload.treePath && oldPath !== this.payload.treePath) {
          for (const t of all) if (t !== r && t.treePath.startsWith(`${oldPath}.`)) t.treePath = this.payload.treePath + t.treePath.slice(oldPath.length);
        }
      }
      return this.returning ? this.shape(rows) : { data: null, error: null };
    }

    // delete
    const doomed = all.filter((r) => this.matches(r));
    if (this.table === TASKS) {
      // trigger: subtree + FK cascade on dependencies
      const paths = doomed.map((r) => r.treePath);
      const gone = new Set(all.filter((t) => paths.some((p) => t.treePath === p || t.treePath.startsWith(`${p}.`))).map((t) => t.rowGUID));
      db.tables[TASKS] = all.filter((t) => !gone.has(t.rowGUID));
      db.tables[DEPS] = db.tables[DEPS].filter((d) => !gone.has(d.rowGUID) && !gone.has(d.rowDependsOnGUID));
    } else {
      db.tables[this.table] = all.filter((r) => !doomed.includes(r));
    }
    return { data: null, error: null };
  }

  then<A = { data: any; error: any }, B = never>(onfulfilled?: ((v: { data: any; error: any }) => A | PromiseLike<A>) | null, onrejected?: ((e: any) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return Promise.resolve()
      .then(() => this.run())
      .then(onfulfilled, onrejected);
  }
}

export function createFakeSupabase() {
  return new FakeSupabase();
}
