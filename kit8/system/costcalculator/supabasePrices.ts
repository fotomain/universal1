// supabasePrices - the Supabase price list the cost model uses, its built-in snapshot and the validation of a list.
// The snapshot is the table of documentation/PRICE_PLAN_CALCULATOR.html section 2 (public Supabase pages, read 2026-11-12, USD). The shape is the one of "Shape of a stored price list"
// in that document, so that the price fetcher (Edge Function supabase-prices, a later round) can hand the calculator a fetched list without a change of the model.

export interface ComputeSize {
  size: string;
  perMonth: number;
  perHour: number;
  cpu: string;
  /** steady vCPU the model counts on (shared machines are burstable: a long load is not served faster) */
  vcpu: number;
  memoryGB: number;
  /** "Database up to": the size Supabase recommends for the machine */
  maxDatabaseGB: number;
  directConnections: number;
  poolerConnections: number;
}

export interface SupabasePlanPrice { fee: number; computeCredits: number }

export interface SupabasePriceList {
  fetchedAt: string;
  source: string;
  currency: 'USD';
  plans: { pro: SupabasePlanPrice; team: SupabasePlanPrice };
  included: { diskGBPerProject: number; egressGB: number; monthlyActiveUsers: number; realtimeConnections: number; realtimeMessages: number; edgeFunctionCalls: number; storageGB: number };
  overage: { diskGB: number; egressGB: number; monthlyActiveUser: number; realtimeConnectionsPer1000: number; realtimeMessagesPerMillion: number; edgeFunctionCallsPerMillion: number; storageGB: number };
  addons: { pointInTimeRecoveryPer7Days: number; customDomain: number; ipv4: number };
  compute: ComputeSize[];
  /** keys of numbers that were NOT on the pages that were read (to be confirmed by the fetcher) */
  unconfirmed?: string[];
}

export const BUILT_IN_PRICES: SupabasePriceList = {
  fetchedAt: '2026-11-12T00:00:00Z',
  source: 'built-in snapshot of supabase.com/pricing and the compute and disk guide',
  currency: 'USD',
  plans: { pro: { fee: 25, computeCredits: 10 }, team: { fee: 599, computeCredits: 10 } },
  included: { diskGBPerProject: 8, egressGB: 250, monthlyActiveUsers: 100000, realtimeConnections: 500, realtimeMessages: 5000000, edgeFunctionCalls: 2000000, storageGB: 100 },
  overage: { diskGB: 0.125, egressGB: 0.09, monthlyActiveUser: 0.00325, realtimeConnectionsPer1000: 10, realtimeMessagesPerMillion: 2.5, edgeFunctionCallsPerMillion: 2, storageGB: 0.0213 },
  addons: { pointInTimeRecoveryPer7Days: 100, customDomain: 10, ipv4: 4 },
  compute: [
    { size: 'Micro', perMonth: 10, perHour: 0.01344, cpu: 'shared', vcpu: 0.2, memoryGB: 1, maxDatabaseGB: 10, directConnections: 60, poolerConnections: 200 },
    { size: 'Small', perMonth: 15, perHour: 0.0206, cpu: 'shared', vcpu: 0.4, memoryGB: 2, maxDatabaseGB: 50, directConnections: 90, poolerConnections: 400 },
    { size: 'Medium', perMonth: 60, perHour: 0.0822, cpu: 'shared', vcpu: 0.8, memoryGB: 4, maxDatabaseGB: 100, directConnections: 120, poolerConnections: 600 },
    { size: 'Large', perMonth: 110, perHour: 0.1517, cpu: '2 dedicated', vcpu: 2, memoryGB: 8, maxDatabaseGB: 200, directConnections: 160, poolerConnections: 800 },
    { size: 'XL', perMonth: 210, perHour: 0.2877, cpu: '4 dedicated', vcpu: 4, memoryGB: 16, maxDatabaseGB: 500, directConnections: 240, poolerConnections: 1000 },
    { size: '2XL', perMonth: 410, perHour: 0.562, cpu: '8 dedicated', vcpu: 8, memoryGB: 32, maxDatabaseGB: 1000, directConnections: 380, poolerConnections: 1500 },
    { size: '4XL', perMonth: 960, perHour: 1.32, cpu: '16 dedicated', vcpu: 16, memoryGB: 64, maxDatabaseGB: 2000, directConnections: 480, poolerConnections: 3000 },
    { size: '8XL', perMonth: 1870, perHour: 2.562, cpu: '32 dedicated', vcpu: 32, memoryGB: 128, maxDatabaseGB: 4000, directConnections: 490, poolerConnections: 6000 },
    { size: '12XL', perMonth: 2800, perHour: 3.836, cpu: '48 dedicated', vcpu: 48, memoryGB: 192, maxDatabaseGB: 6000, directConnections: 500, poolerConnections: 9000 },
    { size: '16XL', perMonth: 3730, perHour: 5.12, cpu: '64 dedicated', vcpu: 64, memoryGB: 256, maxDatabaseGB: 10000, directConnections: 500, poolerConnections: 12000 },
  ],
  unconfirmed: ['addons.ipv4'],
};

export const PRICE_LIST_MAX_AGE_DAYS = 30;

export type PriceListState = 'builtIn' | 'old' | 'fresh';

export function priceListAgeDays(list: SupabasePriceList, now: Date = new Date()): number {
  const t = Date.parse(list.fetchedAt);
  if (!Number.isFinite(t)) return Infinity;
  return Math.max(0, Math.floor((now.getTime() - t) / 86400000));
}

/** builtIn = the snapshot in the code, never fetched (a visible warning); old = older than 30 days (a warning); fresh = a fetched list that is not old. */
export function priceListState(list: SupabasePriceList, now: Date = new Date()): PriceListState {
  if (list === BUILT_IN_PRICES || list.source === BUILT_IN_PRICES.source) return 'builtIn';
  return priceListAgeDays(list, now) > PRICE_LIST_MAX_AGE_DAYS ? 'old' : 'fresh';
}

export function priceListDate(list: SupabasePriceList): string {
  return list.fetchedAt.slice(0, 10);
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/**
 * The checks the spec asks of a list before it is trusted (section 8, "Rules of the function"): every key is there, every number is inside a sane range
 * (a plan fee between 1 and 10 000, at least 8 sizes with rising prices ...) and no number moved more than x 3 against the last good list.
 */
export function validatePriceList(list: unknown, previous?: SupabasePriceList): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  const l = list as SupabasePriceList;
  if (!l || typeof l !== 'object') return { ok: false, problems: ['not an object'] };
  for (const plan of ['pro', 'team'] as const) {
    const p = l.plans?.[plan];
    if (!p || !isNum(p.fee) || p.fee < 1 || p.fee > 10000) problems.push(`plans.${plan}.fee is missing or outside 1..10000`);
    if (!p || !isNum(p.computeCredits)) problems.push(`plans.${plan}.computeCredits is missing`);
  }
  const groups: [string, Record<string, unknown> | undefined][] = [['included', l.included], ['overage', l.overage], ['addons', l.addons]];
  const wanted: Record<string, string[]> = {
    included: ['diskGBPerProject', 'egressGB', 'monthlyActiveUsers', 'realtimeConnections', 'realtimeMessages', 'edgeFunctionCalls', 'storageGB'],
    overage: ['diskGB', 'egressGB', 'monthlyActiveUser', 'realtimeConnectionsPer1000', 'realtimeMessagesPerMillion', 'edgeFunctionCallsPerMillion', 'storageGB'],
    addons: ['pointInTimeRecoveryPer7Days', 'customDomain', 'ipv4'],
  };
  for (const [name, g] of groups) for (const k of wanted[name]) if (!g || !isNum(g[k])) problems.push(`${name}.${k} is missing or not a number`);
  const c = l.compute;
  if (!Array.isArray(c) || c.length < 8) problems.push('compute needs at least 8 sizes');
  else {
    c.forEach((s, n) => {
      if (!s || !s.size || !isNum(s.perMonth) || !isNum(s.vcpu) || !isNum(s.memoryGB) || !isNum(s.maxDatabaseGB)) problems.push(`compute[${n}] is incomplete`);
      else if (n > 0 && c[n - 1] && s.perMonth <= c[n - 1].perMonth) problems.push(`compute[${n}] ${s.size} does not cost more than ${c[n - 1].size}`);
    });
  }
  if (previous && problems.length === 0) {
    const moved = (a: number, b: number) => b > 0 && (a > b * 3 || a < b / 3);
    for (const plan of ['pro', 'team'] as const) if (moved(l.plans[plan].fee, previous.plans[plan].fee)) problems.push(`plans.${plan}.fee moved more than x 3`);
    for (const s of l.compute) {
      const old = previous.compute.find((x) => x.size === s.size);
      if (old && moved(s.perMonth, old.perMonth)) problems.push(`compute ${s.size} price moved more than x 3`);
    }
  }
  return { ok: problems.length === 0, problems };
}
