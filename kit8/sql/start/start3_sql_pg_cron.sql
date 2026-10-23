-- ===============================================================================================
-- start3_sql_pg_cron.sql - the SCHEDULE of the Monitor01 worker and of the cash ledger worker (pg_cron). Run it AFTER start1_sql_tables.sql + start2_sql_code.sql.
--   monitor01_tick          every monitor01_refresh_interval_seconds() seconds (2 s): CALL public.monitor01_process_dirty()   (drains the queue monitor01_dirty)
--   monitor01_housekeeping  daily 03:17:                                           SELECT public.monitor01_housekeeping()
--   cash_ledger_tick        every 10 seconds (PART 38, payment fact):             SELECT public.cash_ledger_process_dirty()   (drains the exchange rate changes queued in cash_account_ledger_dirty)
-- Only the cron.schedule calls live here (they were the last DO block of PART 25 of start2_sql_code.sql). The functions they call are in start2.
-- Needs the extension pg_cron (Supabase: Database -> Extensions -> pg_cron; start1_sql_tables.sql tries CREATE EXTENSION and only prints a NOTICE when it cannot).
-- Without the schema "cron" (a Docker test database, a project without the extension) this file only prints a NOTICE and changes nothing: the open Monitor01 report still refreshes itself
-- (monitor01_stamp / monitor01_refresh_now), or call CALL public.monitor01_process_dirty() by hand.
-- Idempotent: cron.schedule(name, ...) with an existing name updates that job (a second run = still 3 jobs); the jobs are switched on (active). delete_sql_structure.sql unschedules them.
-- Check: SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'monitor01%' OR jobname LIKE 'cash_ledger%';
-- ===============================================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'monitor01_process_dirty') THEN
    RAISE EXCEPTION 'Run start1_sql_tables.sql and start2_sql_code.sql first (the worker procedure monitor01_process_dirty), then this file';
  END IF;
END $$;

-- ---- the tick and the housekeeping. Without the cron schema the file goes on without scheduling. ----
DO $$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE NOTICE 'schema cron does not exist (enable the pg_cron extension in the Supabase dashboard) - the Monitor01 worker is NOT scheduled; call CALL public.monitor01_process_dirty() by hand';
    RETURN;
  END IF;
  BEGIN
    PERFORM cron.schedule('monitor01_tick', public.monitor01_refresh_interval_seconds()::text || ' seconds', 'CALL public.monitor01_process_dirty()');
    PERFORM cron.schedule('monitor01_housekeeping', '17 3 * * *', 'SELECT public.monitor01_housekeeping()');
    IF to_regprocedure('public.cash_ledger_process_dirty(integer)') IS NOT NULL THEN
      PERFORM cron.schedule('cash_ledger_tick', '10 seconds', 'SELECT public.cash_ledger_process_dirty()');
    END IF;
    -- a job that run_sql_cli.command paused for the install of start2 is switched on again (cron.schedule keeps an inactive job inactive)
    PERFORM cron.alter_job(j.jobid, active := true) FROM cron.job j WHERE j.jobname IN ('monitor01_tick', 'monitor01_housekeeping', 'cash_ledger_tick') AND NOT j.active;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron refused the schedule (%): the "N seconds" form needs pg_cron 1.5 or newer. Run by hand or schedule it in the dashboard: CALL public.monitor01_process_dirty()', SQLERRM;
  END;
END $$;

NOTIFY pgrst, 'reload schema';
