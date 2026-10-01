-- =====================================================================================
-- Currency exchange rates: public."currencyExchangeRateTable"
--   RN: export const currencyExchangeRateTable = "currencyExchangeRateTable"
--       (kit8/catalog/currency/exchange/currencyExchangeModel.ts; routes /currency/exchange/list, /currency/exchange/edit)
--
-- kit8/sql/defTable.md pattern, same column types as currencyTable (create_currency_table.sql):
--   "rowGUID"       text    own id (uuid text)
--   "rowOwnerGUID"  text    currencyTable."rowGUID"  (the currency this rate belongs to)
--   "rowParentGUID" text    the day entered by the user, 'YYYY-MM-DD'
--                           -> ONE record per currency per day (unique index below)
--   "orderInList"   numeric -(days since 1970-01-01): ascending order = newest day first
--   "rowJSON"       jsonb   { startingDate: 'YYYY-MM-DD' (= rowParentGUID), currencyRatio: number > 0 }
--   created_at / updated_at
--
-- No foreign key to currencyTable on purpose: deleting a currency can be undone (Undo re-creates it with
-- the same rowGUID), and its rates come back with it.
--
-- Auto refresh in every browser: the table is in the supabase_realtime publication; the app listens with
-- redux-saga (kit8/redux/reusable/reusableRootSaga.ts realtimeWorker, scoped to one currency by
-- readParams.match = { rowOwnerGUID }) and applies INSERT / UPDATE / DELETE to the list.
-- REPLICA IDENTITY FULL -> UPDATE / DELETE events carry the old row (needed for the currency scope).
-- RLS: everybody may read, signed-in users may change.
--
-- Non-destructive, safe to run more than once. Remove: DROP TABLE public."currencyExchangeRateTable";
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public."currencyExchangeRateTable" (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL,
  "rowParentGUID" TEXT        NOT NULL,
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  -- the day: a real 'YYYY-MM-DD' date, the same in rowJSON.startingDate
  CONSTRAINT "currencyExchangeRateTable_day_chk"
    CHECK ("rowParentGUID" ~ '^\d{4}-\d{2}-\d{2}$' AND ("rowParentGUID")::date IS NOT NULL
           AND "rowJSON"->>'startingDate' = "rowParentGUID"),
  -- the ratio: a number greater than 0
  CONSTRAINT "currencyExchangeRateTable_ratio_chk"
    CHECK (jsonb_typeof("rowJSON"->'currencyRatio') = 'number' AND ("rowJSON"->>'currencyRatio')::numeric > 0)
);

-- ONE rate per currency per day
CREATE UNIQUE INDEX IF NOT EXISTS "idx_currencyExchangeRateTable_owner_day"
  ON public."currencyExchangeRateTable" ("rowOwnerGUID", "rowParentGUID");
CREATE INDEX IF NOT EXISTS "idx_currencyExchangeRateTable_owner_order"
  ON public."currencyExchangeRateTable" ("rowOwnerGUID", "orderInList");

-- updated_at on every change (the edit screen uses it to notice changes from other windows)
CREATE OR REPLACE FUNCTION public.kit8_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."updated_at" := NOW();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "trg_currencyExchangeRateTable_touch" ON public."currencyExchangeRateTable";
CREATE TRIGGER "trg_currencyExchangeRateTable_touch" BEFORE UPDATE ON public."currencyExchangeRateTable"
  FOR EACH ROW EXECUTE FUNCTION public.kit8_touch_updated_at();

-- ---- RLS ------------------------------------------------------------------------------
ALTER TABLE public."currencyExchangeRateTable" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."currencyExchangeRateTable" FROM anon, authenticated;
GRANT SELECT ON public."currencyExchangeRateTable" TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public."currencyExchangeRateTable" TO authenticated;

DROP POLICY IF EXISTS "currencyExchangeRateTable_select" ON public."currencyExchangeRateTable";
DROP POLICY IF EXISTS "currencyExchangeRateTable_insert" ON public."currencyExchangeRateTable";
DROP POLICY IF EXISTS "currencyExchangeRateTable_update" ON public."currencyExchangeRateTable";
DROP POLICY IF EXISTS "currencyExchangeRateTable_delete" ON public."currencyExchangeRateTable";
CREATE POLICY "currencyExchangeRateTable_select" ON public."currencyExchangeRateTable" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "currencyExchangeRateTable_insert" ON public."currencyExchangeRateTable" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "currencyExchangeRateTable_update" ON public."currencyExchangeRateTable" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "currencyExchangeRateTable_delete" ON public."currencyExchangeRateTable" FOR DELETE TO authenticated USING (true);

-- ---- realtime ---------------------------------------------------------------------------
ALTER TABLE public."currencyExchangeRateTable" REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'currencyExchangeRateTable') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."currencyExchangeRateTable";
  END IF;
END $$;
