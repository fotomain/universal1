-- =====================================================================================
-- UNIVERSAL1 - CURRENCY EXCHANGE RATE TYPES: kit8/sql/init/update_currency_exchange_rate_types.sql
-- (run AFTER kit8/sql/init/done/create_tables.sql; IDEMPOTENT + NON-DESTRUCTIVE - safe to run twice)
--
-- Rate types, as D365 FO: a currency has a DEFAULT rate (the daily rate: accounting) and may have rates of another type (Budget: the planned rate of a budget)
-- for the same day.
--   rowOwnerGUID   currencyTable.rowGUID                    (unchanged)
--   rowParentGUID  the KEY of the rate: 'YYYY-MM-DD' (Default) or 'YYYY-MM-DD|<rateType>' (e.g. '2026-01-01|Budget')
--   rowJSON        { startingDate 'YYYY-MM-DD', currencyRatio, rateType? ('Default' when missing) , rateSource?, rateBase?, ... }
--   The existing unique index (rowOwnerGUID, rowParentGUID) is KEPT: it now means ONE rate per currency, day and rate type (and the refresh of the
--   rates, which upserts on those two columns, keeps working). Only the day check is widened to accept the '|<rateType>' suffix, and the
--   suffix must agree with rowJSON.rateType.
--   currencyRatio = units of the currency for 1 unit of the BASE currency (EUR); the base currency has no rows (its ratio is 1).
-- =====================================================================================

DO $$
BEGIN
  IF to_regclass('public."currencyExchangeRateTable"') IS NULL THEN
    RAISE EXCEPTION 'Run kit8/sql/init/done/create_tables.sql first (currencyExchangeRateTable)';
  END IF;
END $$;

ALTER TABLE public."currencyExchangeRateTable" DROP CONSTRAINT IF EXISTS "currencyExchangeRateTable_day_chk";
ALTER TABLE public."currencyExchangeRateTable" ADD CONSTRAINT "currencyExchangeRateTable_day_chk"
  CHECK ("rowParentGUID" ~ '^\d{4}-\d{2}-\d{2}(\|[A-Za-z0-9_ -]{1,30})?$'
         AND (left("rowParentGUID", 10))::date IS NOT NULL
         AND "rowJSON"->>'startingDate' = left("rowParentGUID", 10)
         -- the suffix of the key is the rate type: 'day' <-> Default (or no rateType), 'day|Budget' <-> Budget
         AND coalesce(nullif("rowJSON"->>'rateType', ''), 'Default') = coalesce(nullif(substr("rowParentGUID", 12), ''), 'Default'));

NOTIFY pgrst, 'reload schema';
