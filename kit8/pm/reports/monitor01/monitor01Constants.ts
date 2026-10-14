// Monitor01 constants (documentation/MONITOR01_WBS.html, the Google Doc "W1 MONITOR1": "make constants").
// The values that the database also knows are checked against kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql by __tests__/pm/reports/monitor01 (monitor01_refresh_interval_seconds() etc.).

/** the refresh interval of the pg_cron worker, in seconds (monitor01_refresh_interval_seconds()) */
export const MONITOR01_REFRESH_INTERVAL = 2; // #seconds
/** tasks per batch of the worker (monitor01_batch_size()) */
export const MONITOR01_BATCH_SIZE = 500;
/** the time budget of one worker run, ms (monitor01_run_budget_ms()) */
export const MONITOR01_RUN_BUDGET_MS = 1500;
/** a task that failed this many times is parked in the queue (attempts >= 5) */
export const MONITOR01_MAX_ATTEMPTS = 5;

/** rows read per page of the first load */
export const MONITOR01_PAGE_SIZE = 1000;
/** realtime events arriving within this window are applied together, ms */
export const MONITOR01_EVENT_BATCH_MS = 100;
/** the filters of the dashboard wait this long after the last key, ms */
export const MONITOR01_FILTER_DEBOUNCE_MS = 150;
/** the data age badge turns red when nothing was heard for this long (the worker ticks every MONITOR01_REFRESH_INTERVAL seconds), seconds. Quiet data is normal: the badge says "live" while the channel is open */
export const MONITOR01_STALE_DATA_SECONDS = MONITOR01_REFRESH_INTERVAL * 5;
/** the open report asks monitor01_stamp this often, ms: a missed realtime event is found, a worker that is late is helped (the safety net of Realtime) */
export const MONITOR01_POLL_INTERVAL_MS = 3000;
/** a task waits in the queue longer than this, seconds: the worker (pg_cron) is not keeping up - the screen asks the database to compute at once (monitor01_refresh_now) */
export const MONITOR01_QUEUE_STALE_SECONDS = MONITOR01_REFRESH_INTERVAL * 3;
/** the screen asks for "compute now" at most this often, ms */
export const MONITOR01_COMPUTE_NOW_COOLDOWN_MS = 15000;
/** rows of one page of the Sum explorer */
export const MONITOR01_SUM_PAGE_SIZE = 100;

export const MONITOR01_VIEW_TABLE = 'monitor01_view';
export const MONITOR01_REFRESH_LOG_TABLE = 'monitor01_refresh_log';
export const RPC_MONITOR01_SUM_SOURCES = 'monitor01_sum_sources';
/** recompute the user's tasks NOW (no pg_cron needed): the Refresh button and the first look of an empty report */
export const RPC_MONITOR01_REFRESH_NOW = 'monitor01_refresh_now';
/** the cheap question of the open report: my rows (count, newest updated_at) and how long the queue waits */
export const RPC_MONITOR01_STAMP = 'monitor01_stamp';
/** the route of the separate call (hamburger menu -> Reports -> Monitor01) */
export const MONITOR01_ROUTE = '/pm/reports/monitor01';
