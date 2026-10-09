-- =====================================================================================
-- UNIVERSAL1 - TEMPLATE RESOURCE CONTRACT: kit8/sql/init/create_template_resource_contract_table.sql
-- (Supabase / PostgreSQL 15+. Remove again with delete_template_resource_contract_table.sql. Run AFTER create_management_genus_table.sql.)
--
-- templateResourceContractTable: the TEMPLATE of the contract a task line asks for - the requirements for a resource, before any partner is
-- known ("for future supplies independent from Partner here", sheet "W1 TASK LINES"). A line (task_line_table) of Material / Expense /
-- Revenue points at a template with rowJSON.resourceContractTemplateTaskLine; when a partner is chosen later, a real contract (contractTable)
-- is made from the template. It works like a template for FUTURE partner relationships.
--   rowGUID        the template
--   rowOwnerGUID   managementGenusTable.rowGUID of a LEAF genus: timeGenus | materialGenus | expenseGenus | revenueGenus
--   rowParentGUID  'empty'
--   orderInList    order in the list
--   rowJSON        { title, description, requirements (the terms asked for), contractType, paymentsPeriod, paymentTermDays, currency, vatRate,
--                    deliveryTerms, validityDays, isActive }
-- The list of a task line is limited to the templates of ITS genus (task_line_table.rowJSON.taskManagementGenusLine).
-- Screen: TemplateResourceContractCRUD (kit8/catalog/management/templateresourcecontract), route /catalog/management/templateresourcecontract/list.
-- IDEMPOTENT + NON-DESTRUCTIVE: CREATE ... IF NOT EXISTS, seeds ON CONFLICT DO NOTHING.
-- =====================================================================================

DO $$
BEGIN
  IF to_regclass('public."managementGenusTable"') IS NULL OR to_regprocedure('public.kit8_setup_def_table(text)') IS NULL THEN
    RAISE EXCEPTION 'Run kit8/sql/init/create_management_genus_table.sql first (managementGenusTable, kit8_setup_def_table)';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."templateResourceContractTable" (
  "rowGUID"       TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "rowOwnerGUID"  TEXT        NOT NULL,
  "rowParentGUID" TEXT        NOT NULL DEFAULT 'empty',
  "rowJSON"       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  "orderInList"   NUMERIC     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("rowGUID"),
  CONSTRAINT "templateResourceContract_genus_chk" CHECK ("rowOwnerGUID" <> '' AND "rowOwnerGUID" <> 'empty'),
  CONSTRAINT "templateResourceContract_term_chk" CHECK (CASE
    WHEN jsonb_typeof("rowJSON"->'paymentTermDays') = 'number' THEN ("rowJSON"->>'paymentTermDays')::numeric >= 0
    ELSE "rowJSON"->'paymentTermDays' IS NULL OR jsonb_typeof("rowJSON"->'paymentTermDays') = 'null' END),
  CONSTRAINT "templateResourceContract_vat_chk" CHECK (CASE
    WHEN jsonb_typeof("rowJSON"->'vatRate') = 'number' THEN ("rowJSON"->>'vatRate')::numeric BETWEEN 0 AND 100
    ELSE "rowJSON"->'vatRate' IS NULL OR jsonb_typeof("rowJSON"->'vatRate') = 'null' END)
);
CREATE INDEX IF NOT EXISTS "idx_templateResourceContractTable_genus_order" ON public."templateResourceContractTable" ("rowOwnerGUID", "orderInList");
CREATE INDEX IF NOT EXISTS "idx_templateResourceContractTable_title" ON public."templateResourceContractTable" ((lower("rowJSON"->>'title')));
SELECT public.kit8_setup_def_table('templateResourceContractTable');

REVOKE ALL ON public."templateResourceContractTable" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."templateResourceContractTable" TO authenticated;
DROP POLICY IF EXISTS "templateResourceContractTable_select" ON public."templateResourceContractTable";
DROP POLICY IF EXISTS "templateResourceContractTable_insert" ON public."templateResourceContractTable";
DROP POLICY IF EXISTS "templateResourceContractTable_update" ON public."templateResourceContractTable";
DROP POLICY IF EXISTS "templateResourceContractTable_delete" ON public."templateResourceContractTable";
CREATE POLICY "templateResourceContractTable_select" ON public."templateResourceContractTable" FOR SELECT TO authenticated USING (true);
CREATE POLICY "templateResourceContractTable_insert" ON public."templateResourceContractTable" FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "templateResourceContractTable_update" ON public."templateResourceContractTable" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "templateResourceContractTable_delete" ON public."templateResourceContractTable" FOR DELETE TO authenticated USING (true);

INSERT INTO public."templateResourceContractTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON") VALUES
  ('tpl_time_service', 'timeGenus', 'empty', 1000,
   '{"title": "Time & materials service", "description": "Hours of a specialist, invoiced monthly", "requirements": "Hourly rate fixed per seniority level; timesheet approved by the project manager; NDA signed before the start",
     "contractType": "Service", "paymentsPeriod": "Month", "paymentTermDays": 30, "currency": "EUR", "vatRate": 21, "deliveryTerms": "", "validityDays": 365, "isActive": true}'::jsonb),
  ('tpl_material_supply', 'materialGenus', 'empty', 2000,
   '{"title": "Material supply", "description": "Repeated deliveries of material from one supplier", "requirements": "Quality certificate with every delivery; price fixed for the validity of the contract; defects replaced within 14 days",
     "contractType": "Supply", "paymentsPeriod": "Month", "paymentTermDays": 14, "currency": "EUR", "vatRate": 21, "deliveryTerms": "DAP, delivered to the site within 5 working days of the order", "validityDays": 365, "isActive": true}'::jsonb),
  ('tpl_material_onetime', 'materialGenus', 'empty', 2100,
   '{"title": "Material - one delivery", "description": "A single purchase order", "requirements": "Price and quantity as in the order; delivery date is essential",
     "contractType": "Supply", "paymentsPeriod": "OneTime", "paymentTermDays": 7, "currency": "EUR", "vatRate": 21, "deliveryTerms": "EXW, picked up by the buyer", "validityDays": 30, "isActive": true}'::jsonb),
  ('tpl_expense_service', 'expenseGenus', 'empty', 3000,
   '{"title": "Services and expenses", "description": "Travel, rent, software licences and other services", "requirements": "Invoice with VAT number; expenses over 500 EUR need written approval before the order",
     "contractType": "Service", "paymentsPeriod": "Month", "paymentTermDays": 30, "currency": "EUR", "vatRate": 21, "deliveryTerms": "", "validityDays": 180, "isActive": true}'::jsonb),
  ('tpl_revenue_sales', 'revenueGenus', 'empty', 4000,
   '{"title": "Sales to a customer", "description": "Delivery of the result to a customer", "requirements": "Acceptance act signed by the customer; invoice after the acceptance; 5 % retention for 3 months",
     "contractType": "Sales", "paymentsPeriod": "OneTime", "paymentTermDays": 45, "currency": "EUR", "vatRate": 21, "deliveryTerms": "Result delivered electronically and by acceptance act", "validityDays": 365, "isActive": true}'::jsonb)
ON CONFLICT ("rowGUID") DO NOTHING;

DO $$
DECLARE
  v_all boolean;
BEGIN
  SELECT puballtables INTO v_all FROM pg_publication WHERE pubname = 'supabase_realtime';
  IF NOT FOUND THEN
    RAISE NOTICE 'publication supabase_realtime does not exist - realtime auto refresh is off';
  ELSIF NOT v_all AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'templateResourceContractTable') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public."templateResourceContractTable";
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
