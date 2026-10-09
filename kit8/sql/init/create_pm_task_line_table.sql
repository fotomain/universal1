-- =====================================================================================
-- UNIVERSAL1 - PM TASK LINES: kit8/sql/init/create_pm_task_line_table.sql
-- (run AFTER kit8/sql/init/done/create_tables.sql; IDEMPOTENT + NON-DESTRUCTIVE - safe to run twice.
--  Remove again with delete_pm_task_line_table.sql.)
--
-- task_line_table - the finance lines of ONE task, the same table for every management genus
-- (sheet "W1 TASK LINES"): Time (a role + a person), Material, Expense (a role + a product + a partner), Revenue.
--   rowGUID         the line
--   rowProjectGUID  project_table.rowGUID      (FK, filled by the trigger from the task - the app never sends it)
--   rowOwnerGUID    project_task_table.rowGUID (FK, cascade: a deleted task takes its lines with it)
--   rowParentGUID   managementGenusTable.rowGUID of a LEAF genus: timeGenus | materialGenus | expenseGenus | revenueGenus
--   orderInList     the order of the lines inside ONE genus of the task (drag & drop); "rowNumber" is not stored
--   rowJSON         resourceRoleItem            resourceRoleTable.rowGUID
--                   resourceRoleAttributeSetKey descriptorKey of the variant the role needs (Senior, remote ...)
--                   taskResourceItem            personTable.rowGUID (Time) | productTable.rowGUID (everything else)
--                   taskResourceAttributesKey   Time: descriptorKey of the VARIANT OF THE PERSON the line books (variantTable, owner = person)
--                                               | others: descriptorKey of the product variant
--                   taskManagementGenusLine     the genus of the line (= rowParentGUID, kept in step by the app: the templates offered depend on it)
--                   taskResourceContract        contractTable.rowGUID of the PERSON (Time lines only): the cost of the line comes from it
--                   resourceContractTemplateTaskLine  templateResourceContractTable.rowGUID (Material / Expense / Revenue): the contract asked for,
--                                               before a partner is known (create_template_resource_contract_table.sql)
--                   taskLinePartnerItem         partnerTable.rowGUID (Material / Expense / Revenue)
--                   taskLinePartnerContract     contractTable.rowGUID of that partner
--                   qtyTaskLine · priceTaskLine · measureUnitTaskLine (measureUnitTable.rowGUID)
--                   priceSourceTaskLine ('contract' | 'role' | 'product' | 'manual') · priceAutoTaskLine (the last price the app suggested: while
--                   priceTaskLine equals it the price follows the role / product, once the user types another one it stays)
--                   vatRatioTaskLine            percent (0..100)
--                   sumForContract = qty * price · sumVATForContract = sumForContract * vat / 100   (written by the app on every save)
--                   (sums in the accounting / budget currency come later: there is no budget in this version)
-- Titles are never copied: the app reads them from the catalogs.
--
-- Also here: RPC pm_set_task_last_edit_place - saves project_task_table.rowJSON.lastEditPlace (the place of the task the user edited
-- last) WITHOUT sending the rest of rowJSON, so it cannot overwrite the schedule write-back (rowJSON.startAt) or another edit.
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.task_line_table (
  "rowGUID"        UUID        NOT NULL DEFAULT gen_random_uuid(),
  "rowProjectGUID" UUID        NOT NULL REFERENCES public.project_table("rowGUID") ON DELETE CASCADE,
  "rowOwnerGUID"   UUID        NOT NULL REFERENCES public.project_task_table("rowGUID") ON DELETE CASCADE,
  "rowParentGUID"  TEXT        NOT NULL,
  "orderInList"    NUMERIC     NOT NULL DEFAULT 0,
  "rowJSON"        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  CONSTRAINT task_line_genus_chk CHECK ("rowParentGUID" <> '' AND "rowParentGUID" <> 'empty'),
  -- qty / price: empty (line not filled yet) or a number >= 0; VAT: empty or a number 0..100 (CASE: the cast only runs on a number)
  CONSTRAINT task_line_qty_chk CHECK (CASE
    WHEN jsonb_typeof("rowJSON"->'qtyTaskLine') = 'number' THEN ("rowJSON"->>'qtyTaskLine')::numeric >= 0
    ELSE "rowJSON"->'qtyTaskLine' IS NULL OR jsonb_typeof("rowJSON"->'qtyTaskLine') = 'null' END),
  CONSTRAINT task_line_price_chk CHECK (CASE
    WHEN jsonb_typeof("rowJSON"->'priceTaskLine') = 'number' THEN ("rowJSON"->>'priceTaskLine')::numeric >= 0
    ELSE "rowJSON"->'priceTaskLine' IS NULL OR jsonb_typeof("rowJSON"->'priceTaskLine') = 'null' END),
  CONSTRAINT task_line_vat_chk CHECK (CASE
    WHEN jsonb_typeof("rowJSON"->'vatRatioTaskLine') = 'number' THEN ("rowJSON"->>'vatRatioTaskLine')::numeric BETWEEN 0 AND 100
    ELSE "rowJSON"->'vatRatioTaskLine' IS NULL OR jsonb_typeof("rowJSON"->'vatRatioTaskLine') = 'null' END),
  -- a contract of the resource / partner needs the resource / partner
  CONSTRAINT task_line_partner_contract_chk CHECK (
    COALESCE("rowJSON"->>'taskLinePartnerContract', '') = '' OR COALESCE("rowJSON"->>'taskLinePartnerItem', '') <> '')
);

CREATE INDEX IF NOT EXISTS idx_task_line_task_genus ON public.task_line_table ("rowOwnerGUID", "rowParentGUID", "orderInList");
CREATE INDEX IF NOT EXISTS idx_task_line_project    ON public.task_line_table ("rowProjectGUID");
CREATE INDEX IF NOT EXISTS idx_task_line_role       ON public.task_line_table (("rowJSON"->>'resourceRoleItem'));
CREATE INDEX IF NOT EXISTS idx_task_line_resource   ON public.task_line_table (("rowJSON"->>'taskResourceItem'));
CREATE INDEX IF NOT EXISTS idx_task_line_rowJSON    ON public.task_line_table USING GIN ("rowJSON" jsonb_path_ops);

-- updated_at
DROP TRIGGER IF EXISTS trg_task_line_touch ON public.task_line_table;
CREATE TRIGGER trg_task_line_touch BEFORE UPDATE ON public.task_line_table
  FOR EACH ROW EXECUTE FUNCTION public.pm_touch_updated_at();

-- the project of a line is the project of its task (the app sends rowOwnerGUID = task only; a task cannot be moved to another project)
CREATE OR REPLACE FUNCTION public.task_line_set_project() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, extensions AS $$
DECLARE
  v_project uuid;
BEGIN
  SELECT t."projectGUID" INTO v_project FROM public.project_task_table t WHERE t."rowGUID" = NEW."rowOwnerGUID";
  IF v_project IS NULL THEN
    RAISE EXCEPTION 'task % does not exist', NEW."rowOwnerGUID" USING ERRCODE = '23503';
  END IF;
  NEW."rowProjectGUID" := v_project;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_task_line_set_project ON public.task_line_table;
CREATE TRIGGER trg_task_line_set_project
  BEFORE INSERT OR UPDATE OF "rowOwnerGUID" ON public.task_line_table
  FOR EACH ROW EXECUTE FUNCTION public.task_line_set_project();

-- realtime needs the whole old row on DELETE
ALTER TABLE public.task_line_table REPLICA IDENTITY FULL;

-- access: the owner of the project only
ALTER TABLE public.task_line_table ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.task_line_table FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_line_table TO authenticated;
DROP POLICY IF EXISTS task_line_select ON public.task_line_table;
DROP POLICY IF EXISTS task_line_insert ON public.task_line_table;
DROP POLICY IF EXISTS task_line_update ON public.task_line_table;
DROP POLICY IF EXISTS task_line_delete ON public.task_line_table;
CREATE POLICY task_line_select ON public.task_line_table FOR SELECT TO authenticated
  USING (public.pm_owns_project("rowProjectGUID"));
CREATE POLICY task_line_insert ON public.task_line_table FOR INSERT TO authenticated
  WITH CHECK (public.pm_owns_project("rowProjectGUID"));
CREATE POLICY task_line_update ON public.task_line_table FOR UPDATE TO authenticated
  USING (public.pm_owns_project("rowProjectGUID")) WITH CHECK (public.pm_owns_project("rowProjectGUID"));
CREATE POLICY task_line_delete ON public.task_line_table FOR DELETE TO authenticated
  USING (public.pm_owns_project("rowProjectGUID"));

-- realtime: other browsers / devices see the lines at once
DO $$
DECLARE
  v_all boolean;
BEGIN
  SELECT puballtables INTO v_all FROM pg_publication WHERE pubname = 'supabase_realtime';
  IF NOT FOUND THEN
    RAISE NOTICE 'publication supabase_realtime does not exist - realtime auto refresh is off';
  ELSIF NOT v_all AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                                   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'task_line_table') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.task_line_table;
  END IF;
END $$;

-- -------------------------------------------------------------------------------------
-- RPC: the place of the task the user edited last (rowJSON.lastEditPlace); p_place NULL removes it.
-- SECURITY INVOKER: the RLS policies of project_task_table decide who may write.
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pm_set_task_last_edit_place(p_task_guid uuid, p_place jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.project_task_table t
     SET "rowJSON" = CASE WHEN p_place IS NULL OR jsonb_typeof(p_place) = 'null'
                          THEN t."rowJSON" - 'lastEditPlace'
                          ELSE jsonb_set(t."rowJSON", '{lastEditPlace}', p_place, true) END
   WHERE t."rowGUID" = p_task_guid;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.pm_set_task_last_edit_place(uuid, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
