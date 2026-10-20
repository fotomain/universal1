-- Railway #1: why does Post of the task end with "canceling statement due to statement timeout"?
-- READ-ONLY (parts A, B) and one probe that is ROLLED BACK (part C). Paste each part into the Supabase SQL Editor and send the result rows back.
-- Locally (Docker, Postgres 15, the same start1 + start2 + start4 + RAILWAY_1_DATA.sql) the same Post takes ~100 ms, so the time is lost on the live database.

-- ---------------------------------------------------------------------------------------------
-- A. who is running / waiting right now, and the limits
-- ---------------------------------------------------------------------------------------------
select pid, state, wait_event_type, wait_event, now() - xact_start as xact_age, now() - query_start as query_age, left(query, 120) as query
  from pg_stat_activity
 where datname = current_database() and pid <> pg_backend_pid() and state <> 'idle'
 order by xact_start nulls last;

select rolname, rolconfig from pg_roles where rolname in ('authenticated', 'anon', 'postgres', 'authenticator');

-- ---------------------------------------------------------------------------------------------
-- B. the Monitor01 worker (pg_cron every 2 s) and its queue: a run that lasts longer than the Post waits for the queue row
-- ---------------------------------------------------------------------------------------------
select count(*) as queue_rows, min("queuedAt") as oldest, max("attempts") as max_attempts, max("lastError") as last_error from public.monitor01_dirty;

select jobid, jobname, schedule, active from cron.job;

select status, start_time, end_time - start_time as duration, left(return_message, 80) as message
  from cron.job_run_details order by start_time desc limit 15;

select (select count(*) from public.task_line_plan_movements) as plan_movements,
       (select count(*) from public.project_status_movements) as register_movements,
       (select count(*) from public.project_table) as projects;

-- ---------------------------------------------------------------------------------------------
-- C. the same Post as the app, as the owner of Railway #1, with the time of the call. Nothing is saved (ROLLBACK).
--    A result in ~0.1 s = the code is fine and something else (a lock, the queue) holds the app's Post.
-- ---------------------------------------------------------------------------------------------
begin;
select set_config('request.jwt.claims', jsonb_build_object('email', u."rowJSON"->>'userEmail', 'sub', u."rowGUID")::text, true),
       set_config('request.jwt.claim.sub', u."rowGUID", true)
  from public."userTable" u where u."rowGUID" = (select "rowOwnerGUID"::text from public.project_table where "rowGUID" = 'a1000000-0000-4000-8000-000000000001');
set local role authenticated;
set local statement_timeout = '60s';
select clock_timestamp() as started;
with d as (select to_char(g, 'YYYY-MM-DD') dd from generate_series('2026-01-01'::date, '2026-12-31', '1 day') g where extract(isodow from g) < 6),
     o as (select dd, row_number() over (order by dd) rn, count(*) over () c from d),
     days as (select jsonb_agg(jsonb_build_object('d', dd, 'c', case when rn < c then round(1.0 / c, 10) else 1 - (c - 1) * round(1.0 / c, 10) end) order by dd) j from o),
     ln as (select l."rowGUID", l."rowJSON" from public.task_line_table l where l."rowOwnerGUID" = 'a3000000-0000-4000-8000-000000000001')
select public.create_task_line_plan(jsonb_build_object('taskGUID', 'a3000000-0000-4000-8000-000000000001', 'timeZone', 'UTC', 'lines',
  (select jsonb_agg(jsonb_build_object('lineGUID', ln."rowGUID", 'baseOfDistribution', 1,
     'qtyTaskLine', (ln."rowJSON"->>'qtyTaskLine')::numeric, 'sumForBudget', (ln."rowJSON"->>'sumForBudget')::numeric,
     'sumForContract', (ln."rowJSON"->>'sumForContract')::numeric, 'sumForAccounting', (ln."rowJSON"->>'sumForAccounting')::numeric, 'days', days.j)) from ln, days)));
select clock_timestamp() as finished;
rollback;
