-- =====================================================================================
-- UNIVERSAL1 - task_expense_input_table: kit8/sql/init/create_task_expense_input_table.sql
-- (run AFTER kit8/sql/init/done/create_tables.sql; idempotent - safe to run twice)
--
-- App code: kit8/ui/components/table/reusable (ReusableTable + example/taskExpenseInputModel.ts),
--           route /demo/reusabletable. Redux entity: SystemMetaData['task_expense_input_table'].
--
-- "Many catalog GUIDs in one table" input and storage pattern (kit8/sql/defTable.md):
--   rowGUID        the expense line (unique key)
--   rowOwnerGUID   the more generic entity          = project_table.rowGUID
--   rowParentGUID  the entity one level higher      = project_task_table.rowGUID
--   orderInList    order of the lines in the table (drag & drop)
--   rowJSON        { personGUID   -> personTable.rowGUID,
--                    contractGUID -> contractTable.rowGUID (a contract of that person),
--                    hours        -> integer >= 0 }
-- personTable / contractTable keys are TEXT, so the GUIDs live in rowJSON and are checked here
-- by constraints; titles are never copied - the app reads them from the catalogs.
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.task_expense_input_table (
  "rowGUID"       UUID        NOT NULL DEFAULT gen_random_uuid(),
  "rowOwnerGUID"  UUID        NOT NULL,
  "rowParentGUID" UUID        NOT NULL,
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  -- hours: empty (line not filled yet) or a whole number >= 0
  CONSTRAINT task_expense_input_hours_chk CHECK (
    "rowJSON"->'hours' IS NULL
    OR jsonb_typeof("rowJSON"->'hours') = 'null'
    OR (jsonb_typeof("rowJSON"->'hours') = 'number'
        AND ("rowJSON"->>'hours')::numeric >= 0
        AND ("rowJSON"->>'hours')::numeric = trunc(("rowJSON"->>'hours')::numeric))
  ),
  -- a contract needs its person
  CONSTRAINT task_expense_input_contract_needs_person_chk CHECK (
    COALESCE("rowJSON"->>'contractGUID', '') = '' OR COALESCE("rowJSON"->>'personGUID', '') <> ''
  )
);

CREATE INDEX IF NOT EXISTS idx_task_expense_input_scope ON public.task_expense_input_table ("rowOwnerGUID", "rowParentGUID", "orderInList");
CREATE INDEX IF NOT EXISTS idx_task_expense_input_person ON public.task_expense_input_table (("rowJSON"->>'personGUID'));
CREATE INDEX IF NOT EXISTS idx_task_expense_input_contract ON public.task_expense_input_table (("rowJSON"->>'contractGUID'));

-- RLS on + updated_at trigger + REPLICA IDENTITY FULL + rowJSON / orderInList indexes
SELECT public.kit8_setup_def_table('task_expense_input_table');

-- the selected contract must belong to the selected person
CREATE OR REPLACE FUNCTION public.task_expense_input_check_contract() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_person   text := NEW."rowJSON"->>'personGUID';
  v_contract text := NEW."rowJSON"->>'contractGUID';
BEGIN
  IF COALESCE(v_contract, '') <> '' AND NOT EXISTS (
       SELECT 1 FROM public."contractTable" ct
        WHERE ct."rowGUID" = v_contract AND ct."rowOwnerGUID" = v_person AND ct."rowParentGUID" = 'person') THEN
    RAISE EXCEPTION 'contract % is not a contract of person %', v_contract, v_person USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_task_expense_input_check_contract ON public.task_expense_input_table;
CREATE TRIGGER trg_task_expense_input_check_contract
  BEFORE INSERT OR UPDATE OF "rowJSON" ON public.task_expense_input_table
  FOR EACH ROW EXECUTE FUNCTION public.task_expense_input_check_contract();

-- access: as personTable / contractTable (they hold personal data) - signed-in users only
REVOKE ALL ON public.task_expense_input_table FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_expense_input_table TO authenticated;
DROP POLICY IF EXISTS task_expense_input_table_select ON public.task_expense_input_table;
DROP POLICY IF EXISTS task_expense_input_table_insert ON public.task_expense_input_table;
DROP POLICY IF EXISTS task_expense_input_table_update ON public.task_expense_input_table;
DROP POLICY IF EXISTS task_expense_input_table_delete ON public.task_expense_input_table;
CREATE POLICY task_expense_input_table_select ON public.task_expense_input_table FOR SELECT TO authenticated USING (true);
CREATE POLICY task_expense_input_table_insert ON public.task_expense_input_table FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY task_expense_input_table_update ON public.task_expense_input_table FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY task_expense_input_table_delete ON public.task_expense_input_table FOR DELETE TO authenticated USING (true);

-- realtime: other browsers / devices see the changes at once
DO $$
DECLARE
  v_all boolean;
BEGIN
  SELECT puballtables INTO v_all FROM pg_publication WHERE pubname = 'supabase_realtime';
  IF NOT FOUND THEN
    RAISE NOTICE 'publication supabase_realtime does not exist - realtime auto refresh is off';
  ELSIF NOT v_all AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                                   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'task_expense_input_table') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.task_expense_input_table;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
