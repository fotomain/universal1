-- ===============================================================================================
-- UNIVERSAL1 - delete_sql_structure.sql: DELETES EVERYTHING that start1_sql_tables.sql + start2_sql_code.sql created - tables WITH ALL THEIR DATA (of ALL users),
-- default data, indexes, triggers, policies, functions (stored procedures), realtime publication entries.
-- IRREVERSIBLE: make a backup first (Supabase -> Database -> Backups, or pg_dump). Safe to run twice (IF EXISTS everywhere).
-- Extensions (pgcrypto, ltree) and Supabase's own schemas (auth, storage ...) are NOT touched. Re-create with start1_sql_tables.sql + start2_sql_code.sql.
-- Parts, in this order (reverse of the install order):
--
--  1a-000000000. delete_route_visits.sql - PART 41: drops app_route_visits_turnover (data included: the visits of ALL users) and the route_visit* functions (runs very first: it is the newest)
--  1a-00000000. delete_task_template.sql - PART 40: drops the task template tables (data included: every template of every organization) and the task_template_* functions (runs very first: it is the newest)
--  1a-0000000. delete_partner_balance.sql - PART 39: drops partner_balance_movements and partner_balance_ledger (data included), the triggers on the invoices and the cash ledger, the partner_balance_* functions and business_unit_root (runs very first: it is the newest)
--  1a-000000. delete_payment_fact.sql - PART 38: drops the payment fact tables (documents, lines, the cash ledger movements, rests and queue, money accounts - data included), the trigger on currencyExchangeRateTable, the cash_ledger_* / payment_fact_* functions and the pg_cron job (runs very first: it is the newest)
--  1a-00000. delete_payment_plan.sql - PART 37: drops the payment plan tables (the planned payments and the posted movements, data included), the trigger on project_task_table and the payment plan functions (runs very first: it is the newest)
--  1a-0000. delete_timesheet.sql - PART 36: drops the time sheet tables (data included), their triggers, the timesheet_* functions, person_ensure_user and the 'used' movements of the time sheets (runs very first: it is the newest)
--  1a-000. delete_work_center.sql - PART 35: drops workCenterTable (with the variants the work centers own), its triggers and the work_center_* functions (runs very first: it is the newest)
--  1a-00. delete_roi.sql - PARTs 33 + 34: drops the ROI tables (the task months, the project months, the HISTORY with its rows), the views, the trigger on project_table and the roi_* functions (runs very first)
--  1a-0. delete_subprojects.sql - PART 29: drops project_subproject_link, its triggers and the subproject_* functions (runs very first)
--   1a. delete_fact_input_and_monitor01.sql - PARTs 24-28: drops the fact documents, Monitor01 (view, queue, log, fact sums), the project cost total, the pg_cron jobs, the triggers on the other tables, the functions (runs first: it is the newest part)
--   1b. delete_time_genus_control.sql - PARTs 20-23: drops organizationInvitationTable, the view, the organization_* functions and the triggers / constraints on userTable, project_table, the calendar and the resource tables (runs first: it is the newest part)
--    1. user calendars - user_calendar_table / _event_table / _invitation_table + the sync triggers on the project tables
--    2. delete_task_line_plan_table.sql - drops task_line_plan + create_task_line_plan + the unpost trigger
--    3. delete_management_calendar_tables.sql - drops the management calendars and their days
--    4. delete_pm_task_line_table.sql - drops task_line_table + pm_set_task_last_edit_place
--    5. delete_template_resource_contract_table.sql - drops templateResourceContractTable
--    6. delete_equipment_tables.sql - drops equipmentTable / equipmentTypeTable, the equipment descriptors, variants and properties, the role type "Equipment Resources" and the taskResourceKind check of task_line_table
--    7. delete_person_descriptors.sql - removes the person descriptors, variants, certificates and the demo contracts
--    8. delete_person_type_table.sql - drops personTypeTable
--    9. delete_resource_role_tables.sql - drops the resource role tables + their rows in the shared descriptor tables
--   10. delete_product_tables.sql - drops the product catalog and the shared descriptor / variant / price tables
--   11. delete_budget_item_table.sql - drops budgetItemTable
--   12. delete_management_genus_table.sql - drops managementGenusTable
--   13. delete_distribution_generic_table.sql - drops distributionGenericTable
--   14. delete_tables.sql - drops EVERYTHING of done/create_tables.sql: all projects, tasks, catalogs, persons, contracts, rates (all users!)
--   15. delete_business_unit_tables.sql - drops businessUnitTable / cfrTypeTable, their functions and the businessUnitAssigned triggers on the other tables (the unit kept on the posted days stays as inert JSON)
--   16. delete_budget_scenario_table.sql - drops budgetScenarioTable
--   17. helper function kit8_touch_updated_at
-- ===============================================================================================



-- =====================================================================================
-- PART 1a-000000000: delete_route_visits.sql  (PART 41 of the structure file: the ROUTE VISITS - runs before everything else, it is the newest)
-- Drops app_route_visits_turnover WITH its rows (the visits of ALL users) and the functions.
-- =====================================================================================
DROP TABLE IF EXISTS public.app_route_visits_turnover CASCADE;
DROP FUNCTION IF EXISTS public.route_visit_register(text);
DROP FUNCTION IF EXISTS public.route_visits_clear(text);
DROP FUNCTION IF EXISTS public.route_visits_enabled();



-- =====================================================================================
-- PART 1a-00000000: delete_task_template.sql  (PART 40 of the structure file: the TASK TEMPLATES - runs before everything else, it is the newest)
-- Drops the four tables WITH their rows (the templates of ALL organizations) and the functions. The tasks and lines that were filled from a template are normal project rows and stay.
-- =====================================================================================
DROP TABLE IF EXISTS public.task_template_line CASCADE;
DROP TABLE IF EXISTS public.task_template_dependency CASCADE;
DROP TABLE IF EXISTS public.task_template_task CASCADE;
DROP TABLE IF EXISTS public.task_template_header CASCADE;
DROP FUNCTION IF EXISTS public.task_template_save(uuid, text, text);
DROP FUNCTION IF EXISTS public.task_template_fill(uuid, uuid, boolean);
DROP FUNCTION IF EXISTS public.task_template_set_title(uuid, text, text);
DROP FUNCTION IF EXISTS public.task_template_visible(uuid);
DROP FUNCTION IF EXISTS public.task_template_clean_task(jsonb);
DROP FUNCTION IF EXISTS public.task_template_clean_line(jsonb);



-- =====================================================================================
-- PART 1a-0000000: delete_partner_balance.sql  (PART 39 of the structure file: the PARTNER BALANCE - runs before everything else, it is the newest)
-- Drops the register and the totals WITH their rows (of ALL users), the triggers on the two invoice headers and on the cash ledger movements, and the functions.
-- The CHECK of the invoice lines (a credit note = one negative factor) stays: it is part of the invoice tables, which the later parts drop.
-- =====================================================================================
DROP TRIGGER IF EXISTS trg_vendor_invoice_partner_balance ON public.vendor_invoice_header;
DROP TRIGGER IF EXISTS trg_customer_invoice_partner_balance ON public.customer_invoice_header;
DROP TRIGGER IF EXISTS trg_cash_ledger_partner_balance_insert ON public.cash_account_ledger_movements;
DROP TRIGGER IF EXISTS trg_cash_ledger_partner_balance_delete ON public.cash_account_ledger_movements;
DROP TABLE IF EXISTS public.partner_balance_ledger CASCADE;
DROP TABLE IF EXISTS public.partner_balance_movements CASCADE;
DROP FUNCTION IF EXISTS public.partner_balance_report(text, date, date, jsonb, jsonb, text);
DROP FUNCTION IF EXISTS public.partner_balance_filter_items(text, uuid, text);
DROP FUNCTION IF EXISTS public.partner_balance_movements_list(text, text, text, uuid, uuid, date, date);
DROP FUNCTION IF EXISTS public.partner_balance_verify(text);
DROP FUNCTION IF EXISTS public.partner_balance_rebuild(text);
DROP FUNCTION IF EXISTS public.partner_balance_register_missing();
DROP FUNCTION IF EXISTS public.partner_balance_cash_deleted();
DROP FUNCTION IF EXISTS public.partner_balance_cash_inserted();
DROP FUNCTION IF EXISTS public.partner_balance_invoice_status();
DROP FUNCTION IF EXISTS public.partner_balance_insert_payments(uuid[]);
DROP FUNCTION IF EXISTS public.partner_balance_insert_invoice(text, uuid);
DROP FUNCTION IF EXISTS public.partner_balance_movements_no_update();
DROP FUNCTION IF EXISTS public.partner_balance_ledger_after_delete();
DROP FUNCTION IF EXISTS public.partner_balance_ledger_after_insert();
DROP FUNCTION IF EXISTS public.business_unit_root(text);


-- =====================================================================================
-- PART 1a-000000: delete_payment_fact.sql  (PART 38 of the structure file: the PAYMENT FACT - runs before everything else, it is the newest)
-- Drops the payment fact tables WITH their rows (the documents, the cash ledger movements / rests / queue of ALL users and the money account catalog), the trigger on currencyExchangeRateTable, the functions and the cron job.
-- =====================================================================================
DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    BEGIN PERFORM cron.unschedule('cash_ledger_tick'); EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
END $$;
DROP TRIGGER IF EXISTS trg_cash_ledger_rate ON public."currencyExchangeRateTable";
DROP TABLE IF EXISTS public.cash_account_ledger_dirty CASCADE;
DROP TABLE IF EXISTS public.cash_account_ledger_rests CASCADE;
DROP TABLE IF EXISTS public.cash_account_ledger_movements CASCADE;
DROP TABLE IF EXISTS public.project_payment_fact_lines CASCADE;
DROP TABLE IF EXISTS public.project_payment_fact_header CASCADE;
DROP TABLE IF EXISTS public."moneyAccountTable" CASCADE;
DROP SEQUENCE IF EXISTS public.payment_fact_document_seq;
DROP FUNCTION IF EXISTS public.create_payment_fact_from_customer_invoice(uuid);
DROP FUNCTION IF EXISTS public.create_payment_fact_from_vendor_invoice(uuid);
DROP FUNCTION IF EXISTS public.payment_fact_from_invoice(text, uuid);
DROP FUNCTION IF EXISTS public.payment_fact_invoice_open(text, uuid);
DROP FUNCTION IF EXISTS public.cash_ledger_rate_trigger();
DROP FUNCTION IF EXISTS public.cash_ledger_queue_rate(text, text, text, date, date);
DROP FUNCTION IF EXISTS public.cash_ledger_rebuild(text, text);
DROP FUNCTION IF EXISTS public.cash_ledger_verify(text, text);
DROP FUNCTION IF EXISTS public.cash_ledger_queue_length();
DROP FUNCTION IF EXISTS public.cash_ledger_refresh_now();
DROP FUNCTION IF EXISTS public.cash_ledger_process_dirty(integer);
DROP FUNCTION IF EXISTS public.cash_ledger_recalc(date, date, text);
DROP FUNCTION IF EXISTS public.cash_ledger_fresh(date, date, text);
DROP FUNCTION IF EXISTS public.cash_ledger_rebuild_rests(text, text, date);
DROP FUNCTION IF EXISTS public.cash_ledger_rests_calc(text, text, date);
DROP FUNCTION IF EXISTS public.task_payment_paid(uuid);
DROP FUNCTION IF EXISTS public.payment_fact_list(jsonb, integer, integer);
DROP FUNCTION IF EXISTS public.delete_payment_fact(uuid);
DROP FUNCTION IF EXISTS public.unpost_payment_fact(uuid);
DROP FUNCTION IF EXISTS public.post_payment_fact(uuid);
DROP FUNCTION IF EXISTS public.payment_fact_set_line_task(uuid, uuid);
DROP FUNCTION IF EXISTS public.payment_fact_add_line(uuid, uuid);
DROP FUNCTION IF EXISTS public.payment_fact_set_header(uuid, jsonb);
DROP FUNCTION IF EXISTS public.payment_fact_create(uuid, text, uuid[]);
DROP FUNCTION IF EXISTS public.payment_fact_add_from_plan(uuid, uuid[]);
DROP FUNCTION IF EXISTS public.payment_fact_plan_candidates(uuid, jsonb);
DROP FUNCTION IF EXISTS public.payment_fact_plan_open(uuid, uuid);
DROP FUNCTION IF EXISTS public.payment_fact_header_after_write();
DROP FUNCTION IF EXISTS public.payment_fact_header_before_write();
DROP FUNCTION IF EXISTS public.payment_fact_lines_delete_guard();
DROP FUNCTION IF EXISTS public.payment_fact_lines_before_write();
DROP FUNCTION IF EXISTS public.cash_fx_round(numeric, numeric, text);
DROP FUNCTION IF EXISTS public.payment_fact_state(uuid);
DROP FUNCTION IF EXISTS public.money_account_delete_guard();
DROP FUNCTION IF EXISTS public.money_account_check();



-- =====================================================================================
-- PART 1a-00000: delete_payment_plan.sql  (PART 37 of the structure file: the PAYMENT PLAN of a task - runs before everything else, it is the newest)
-- Drops the two payment plan tables WITH their rows (the payments of ALL users), the trigger on project_task_table and the payment plan functions.
-- =====================================================================================
DROP TRIGGER IF EXISTS trg_task_payment_plan_unpost_on_dates ON public.project_task_table;
DROP FUNCTION IF EXISTS public.task_payment_plan_unpost_on_dates();
DROP FUNCTION IF EXISTS public.post_task_payment_plan(uuid, date, date);
DROP FUNCTION IF EXISTS public.unpost_task_payment_plan(uuid);
DROP TABLE IF EXISTS public.task_payment_plan_movements CASCADE;
DROP TABLE IF EXISTS public.task_payment_plan_lines CASCADE;
DROP FUNCTION IF EXISTS public.task_payment_plan_before_write();
DROP FUNCTION IF EXISTS public.payment_plan_after_finish_on(uuid);



-- =====================================================================================
-- PART 1a-0000: delete_timesheet.sql  (PART 36 of the structure file: the TIME SHEET - runs before everything else, it is the newest)
-- Drops the three time sheet tables WITH their rows (the sheets of ALL users), their triggers, the timesheet_* functions and person_ensure_user (the Persons already made stay: they are catalog rows).
-- The 'used' movements the posted sheets wrote into project_status_movements are deleted here too (their tasks are queued for Monitor01 by the delete trigger).
-- =====================================================================================
DO $$
BEGIN
  IF to_regclass('public.project_status_movements') IS NOT NULL THEN
    DELETE FROM public.project_status_movements s WHERE s."rowRegistratorType" = 'timesheetHeader';
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.timesheet_cell_money(uuid, date, numeric);
DROP FUNCTION IF EXISTS public.timesheet_hour_price(text, uuid, text, date);
DROP FUNCTION IF EXISTS public.role_hour_rate(text, date);
DROP FUNCTION IF EXISTS public.person_contract_on_day(text, date);
DROP FUNCTION IF EXISTS public.contract_hour_price(jsonb);
DROP FUNCTION IF EXISTS public.fx_convert(numeric, text, text, text, date);
DROP FUNCTION IF EXISTS public.fx_miss_text(text, text, text, date);
DROP FUNCTION IF EXISTS public.fx_pair_rate(text, text, text, date);
DROP FUNCTION IF EXISTS public.fx_ratio_on_day(text, text, date);
DROP FUNCTION IF EXISTS public.fx_base_currency();
DROP FUNCTION IF EXISTS public.post_timesheet(uuid);
DROP FUNCTION IF EXISTS public.unpost_timesheet(uuid);
DROP FUNCTION IF EXISTS public.project_status_register_timesheet(uuid);
DROP FUNCTION IF EXISTS public.create_timesheet_from_task(uuid, uuid);
DROP FUNCTION IF EXISTS public.timesheet_list(jsonb);
DROP FUNCTION IF EXISTS public.timesheet_set_hours(uuid, date, numeric);
DROP FUNCTION IF EXISTS public.timesheet_delete(uuid);
DROP FUNCTION IF EXISTS public.timesheet_move_line(uuid, text);
DROP FUNCTION IF EXISTS public.timesheet_insert_line(uuid, uuid, boolean, jsonb);
DROP FUNCTION IF EXISTS public.timesheet_delete_line(uuid);
DROP FUNCTION IF EXISTS public.timesheet_set_line(uuid, jsonb);
DROP FUNCTION IF EXISTS public.timesheet_add_line(uuid, jsonb);
DROP FUNCTION IF EXISTS public.timesheet_line_patch(public.project_timesheet_lines, jsonb);
DROP FUNCTION IF EXISTS public.timesheet_set_header(uuid, jsonb);
DROP FUNCTION IF EXISTS public.timesheet_create(text, date, date);
DROP FUNCTION IF EXISTS public.timesheet_guard(uuid, boolean);
DROP TABLE IF EXISTS public.project_timesheet_lines_data_entered CASCADE;
DROP TABLE IF EXISTS public.project_timesheet_lines CASCADE;
DROP TABLE IF EXISTS public.project_timesheet_header CASCADE;
DROP SEQUENCE IF EXISTS public.project_timesheet_document_seq;
DROP FUNCTION IF EXISTS public.project_timesheet_data_entered_total();
DROP FUNCTION IF EXISTS public.project_timesheet_data_entered_before_delete();
DROP FUNCTION IF EXISTS public.project_timesheet_data_entered_before_write();
DROP FUNCTION IF EXISTS public.project_timesheet_lines_before_write();
DROP FUNCTION IF EXISTS public.project_timesheet_header_after_update();
DROP FUNCTION IF EXISTS public.project_timesheet_header_before_write();
DROP FUNCTION IF EXISTS public.timesheet_line_rate(text, uuid, text);
DROP FUNCTION IF EXISTS public.timesheet_possible_business_units(uuid, text);
DROP FUNCTION IF EXISTS public.timesheet_possible_budget_items(uuid, text);
DROP FUNCTION IF EXISTS public.timesheet_possible_roles(uuid, text);
DROP FUNCTION IF EXISTS public.timesheet_wc_worker_kind(text);
DROP FUNCTION IF EXISTS public.timesheet_line_worker_kind(jsonb);
DROP FUNCTION IF EXISTS public.timesheet_line_books(jsonb, text);
DROP FUNCTION IF EXISTS public.timesheet_state(uuid);
DROP FUNCTION IF EXISTS public.timesheet_create_my_work_center(text);
DROP FUNCTION IF EXISTS public.timesheet_header_wc_allowed(text, jsonb);
DROP FUNCTION IF EXISTS public.timesheet_work_center_allowed(text);
DROP FUNCTION IF EXISTS public.timesheet_my_work_center();
DROP FUNCTION IF EXISTS public.timesheet_only_current_month();
DROP FUNCTION IF EXISTS public.timesheet_all_work_centers();
DROP FUNCTION IF EXISTS public.timesheet_setting(text, text);
DROP FUNCTION IF EXISTS public.timesheet_user_person();
DROP FUNCTION IF EXISTS public.person_ensure_user(text, text, text);


-- =====================================================================================
-- PART 1a-000: delete_work_center.sql  (PART 35 of the structure file: WORK CENTER - runs before everything else, it is the newest)
-- Drops workCenterTable (all work centers) with the variants and variant values the work centers own (copies of base variants), its triggers and the work_center_* functions. The capacity branches
-- for the kind 'workCenter' inside the organization_* functions go with PARTs 21-23, the taskResourceKind check with PART 17; Time lines that book a work center go with their task lines.
-- =====================================================================================
DO $$
BEGIN
  IF to_regclass('public."workCenterTable"') IS NOT NULL THEN
    DELETE FROM public."variantValueTable" x WHERE x."rowOwnerGUID" IN (SELECT v."rowGUID" FROM public."variantTable" v WHERE v."rowOwnerGUID" IN (SELECT w."rowGUID" FROM public."workCenterTable" w));
    DELETE FROM public."variantTable" v WHERE v."rowOwnerGUID" IN (SELECT w."rowGUID" FROM public."workCenterTable" w);
    DROP TRIGGER IF EXISTS trg_workCenterTable_check ON public."workCenterTable";
    DROP TRIGGER IF EXISTS trg_workCenterTable_delete ON public."workCenterTable";
  END IF;
END $$;
DROP TABLE IF EXISTS public."workCenterTable" CASCADE;
DROP FUNCTION IF EXISTS public.work_center_copy_variant_settings(text, boolean);
DROP FUNCTION IF EXISTS public.work_center_delete_guard();
DROP FUNCTION IF EXISTS public.work_center_check();
DROP FUNCTION IF EXISTS public.work_center_title_of(text);
DROP FUNCTION IF EXISTS public.work_center_base_title(text, text);


-- =====================================================================================
-- PART 1a-00: delete_roi.sql  (PARTs 33 + 34 of the structure file: ROI and the ROI history - runs before everything else, it is the newest)
-- Drops the ROI tables (the task months, the project months, the HISTORY with all its rows), the views, the trigger on project_table and the roi_* functions. The ownCost flag on the 'used' movements and the
-- Revenue plan / fact movements of the register go with the register; the settings keys of project_table.rowJSON stay as inert JSON.
-- =====================================================================================
DO $$
BEGIN
  IF to_regclass('public.project_table') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_roi_history_switch ON public.project_table;
  END IF;
END $$;
DROP VIEW IF EXISTS public.project_status_roi_history_v;
DROP VIEW IF EXISTS public.project_status_month_roi;
DROP VIEW IF EXISTS public.project_status_totals;
DROP TABLE IF EXISTS public.project_status_roi_history CASCADE;
DROP TABLE IF EXISTS public.project_status_month_totals CASCADE;
DROP TABLE IF EXISTS public.project_status_roi_task_month CASCADE;
DROP FUNCTION IF EXISTS public.roi_trg_history_switch();
DROP FUNCTION IF EXISTS public.roi_history_apply(uuid[], text);
DROP FUNCTION IF EXISTS public.roi_verify(uuid);
DROP FUNCTION IF EXISTS public.roi_rebuild(uuid);
DROP FUNCTION IF EXISTS public.roi_report_projects();
DROP FUNCTION IF EXISTS public.roi_task_lines(uuid, date, date);
DROP FUNCTION IF EXISTS public.roi_project(uuid, date, date);
DROP FUNCTION IF EXISTS public.roi_trg_task_month_new();
DROP FUNCTION IF EXISTS public.roi_trg_task_month_old();
DROP FUNCTION IF EXISTS public.roi_trg_task_month_upd();
DROP FUNCTION IF EXISTS public.roi_month_totals_refresh(uuid[], date[]);
DROP FUNCTION IF EXISTS public.roi_apply(uuid[]);
DROP FUNCTION IF EXISTS public.roi_task_month_fresh(uuid[]);
DROP FUNCTION IF EXISTS public.pm_line_has_vendor(text, jsonb);
DROP FUNCTION IF EXISTS public.roi_include_vat(uuid, text);
DROP FUNCTION IF EXISTS public.roi_revenue(numeric, numeric, boolean);
DROP FUNCTION IF EXISTS public.roi_cost(numeric, numeric, numeric, boolean);
DROP FUNCTION IF EXISTS public.roi_ratio(numeric, numeric);


-- =====================================================================================
-- PART 1a-0: delete_subprojects.sql  (PART 29 of the structure file: SUBPROJECTS - runs before everything else, it is the newest)
-- Drops project_subproject_link (the task keys taskIsSubproject / taskSubprojectGUID stay as inert JSON), the triggers on project_task_table / project_table and the subproject_* functions.
-- =====================================================================================
DO $$
BEGIN
  IF to_regclass('public.project_task_table') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_subproject_link_validate_ins ON public.project_task_table;
    DROP TRIGGER IF EXISTS trg_subproject_link_validate_upd ON public.project_task_table;
    DROP TRIGGER IF EXISTS trg_subproject_link_maintain_ins ON public.project_task_table;
    DROP TRIGGER IF EXISTS trg_subproject_link_maintain_upd ON public.project_task_table;
  END IF;
  IF to_regclass('public.project_table') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_subproject_switch_guard ON public.project_table;
    DROP TRIGGER IF EXISTS trg_subproject_resync_on_switch ON public.project_table;
    DROP TRIGGER IF EXISTS trg_subproject_delete_guard ON public.project_table;
  END IF;
END $$;

DROP TABLE IF EXISTS public.project_subproject_link CASCADE;
DROP FUNCTION IF EXISTS public.subproject_enabled(uuid);
DROP FUNCTION IF EXISTS public.subproject_setting(uuid, text, boolean);
DROP FUNCTION IF EXISTS public.subproject_auto_change(uuid);
DROP FUNCTION IF EXISTS public.subproject_dates_on(uuid);
DROP FUNCTION IF EXISTS public.subproject_aggregate_on(uuid, text);
DROP FUNCTION IF EXISTS public.subproject_creates_cycle(uuid, uuid);
DROP FUNCTION IF EXISTS public.subproject_in_cycle(uuid);
DROP FUNCTION IF EXISTS public.subproject_cycle_path(uuid, uuid);
DROP FUNCTION IF EXISTS public.subproject_assert_no_cycle(uuid);
DROP FUNCTION IF EXISTS public.subproject_dates_of(uuid);
DROP FUNCTION IF EXISTS public.subproject_work_days(timestamptz, timestamptz, boolean);
DROP FUNCTION IF EXISTS public.subproject_link_validate();
DROP FUNCTION IF EXISTS public.subproject_link_maintain();
DROP FUNCTION IF EXISTS public.subproject_sync_origin_task(uuid);
DROP FUNCTION IF EXISTS public.subproject_propagate_dates(uuid, integer);
DROP FUNCTION IF EXISTS public.subproject_switch_guard();
DROP FUNCTION IF EXISTS public.subproject_resync_on_switch();
DROP FUNCTION IF EXISTS public.subproject_delete_guard();
DROP FUNCTION IF EXISTS public.subproject_candidates(uuid);
DROP FUNCTION IF EXISTS public.organization_has_subprojects_enabled();
DROP FUNCTION IF EXISTS public.subproject_link_rebuild();
DROP FUNCTION IF EXISTS public.subproject_agg_sources(uuid[]);
DROP FUNCTION IF EXISTS public.subproject_drill_match(text, uuid, text);
DROP FUNCTION IF EXISTS public.subproject_queue_origins(uuid[]);


-- =====================================================================================
-- PART 1a: delete_fact_input_and_monitor01.sql  (the numbering of the other parts stays: 1a runs FIRST, it is the newest)
-- Removes what PARTs 24-28 of start1_sql_tables.sql + start2_sql_code.sql added (27: the project cost total): the fact input documents (task_fact_header / task_fact_usage_timeline, DATA INCLUDED), Monitor01 (monitor01_view, the queue, the log,
-- task_line_fact_for_monitor01), the pg_cron jobs, the triggers on the other tables, the functions and the sequence.
-- =====================================================================================
DO $$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    BEGIN PERFORM cron.unschedule('monitor01_tick'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN PERFORM cron.unschedule('monitor01_housekeeping'); EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  IF to_regclass('public.task_line_plan_movements') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_monitor01_movements_ins ON public.task_line_plan_movements;
    DROP TRIGGER IF EXISTS trg_monitor01_movements_upd ON public.task_line_plan_movements;
    DROP TRIGGER IF EXISTS trg_monitor01_movements_del ON public.task_line_plan_movements;
  END IF;
  IF to_regclass('public.task_line_table') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_monitor01_lines_ins ON public.task_line_table;
    DROP TRIGGER IF EXISTS trg_monitor01_lines_upd ON public.task_line_table;
    DROP TRIGGER IF EXISTS trg_monitor01_lines_del ON public.task_line_table;
  END IF;
  IF to_regclass('public.project_task_table') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_monitor01_task_rename ON public.project_task_table;
  END IF;
  IF to_regclass('public.project_table') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_monitor01_project_rename ON public.project_table;
  END IF;
  IF to_regclass('public."resourceRoleTable"') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_monitor01_role_rename ON public."resourceRoleTable";
  END IF;
END $$;
-- (PART 27 of the structure file: the project cost total - the triggers first, on tables that may still exist, then the tables and the functions)
DO $$
BEGIN
  IF to_regclass('public.project_task_table') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_project_cost_task_moved ON public.project_task_table;
    DROP TRIGGER IF EXISTS trg_project_cost_task_deleted ON public.project_task_table;
  END IF;
  IF to_regclass('public.project_table') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_project_cost_budget ON public.project_table;
  END IF;
END $$;
DROP TABLE IF EXISTS public.project_task_cost_total CASCADE;
DROP TABLE IF EXISTS public.project_cost_dirty CASCADE;
DROP FUNCTION IF EXISTS public.update_project_cost_total(uuid);
DROP FUNCTION IF EXISTS public.project_cost_verify(uuid);
DROP FUNCTION IF EXISTS public.project_cost_process_dirty();
DROP FUNCTION IF EXISTS public.project_cost_apply(uuid[]);
DROP FUNCTION IF EXISTS public.project_cost_rebuild(uuid);
DROP FUNCTION IF EXISTS public.project_cost_fresh(uuid);
DROP FUNCTION IF EXISTS public.project_cost_trg_queue_project();
DROP FUNCTION IF EXISTS public.project_cost_trg_project_budget();
DROP FUNCTION IF EXISTS public.project_cost_budget_on(jsonb);
DROP FUNCTION IF EXISTS public.project_cost_flag(jsonb, text, boolean);
-- (PART 26 of the structure file: the vendor invoice, the legal entity catalog, the main vendor guards; the data of the invoices and of the legal entities goes with the tables)
-- (PART 31 of the structure file: the customer invoice - its tables with their triggers, then its functions; the 'sold' movements and the columns of Monitor01 / the turnover go with their tables below)
DROP TABLE IF EXISTS public.customer_invoice_lines CASCADE;
DROP TABLE IF EXISTS public.customer_invoice_header CASCADE;
DROP SEQUENCE IF EXISTS public.customer_invoice_document_seq;
DROP FUNCTION IF EXISTS public.customer_invoice_state(uuid);
DROP FUNCTION IF EXISTS public.customer_invoice_lines_before_write();
DROP FUNCTION IF EXISTS public.customer_invoice_header_before_write();
DROP FUNCTION IF EXISTS public.project_status_register_customer_invoice(uuid);
DROP FUNCTION IF EXISTS public.customer_invoice_candidates(uuid, uuid[]);
DROP FUNCTION IF EXISTS public.create_customer_invoices(uuid, jsonb, text);
DROP FUNCTION IF EXISTS public.customer_invoice_set_header(uuid, jsonb);
DROP FUNCTION IF EXISTS public.customer_invoice_add_line(uuid, text);
DROP FUNCTION IF EXISTS public.post_customer_invoice(uuid);
DROP FUNCTION IF EXISTS public.unpost_customer_invoice(uuid);
DROP FUNCTION IF EXISTS public.delete_customer_invoice(uuid);
DROP FUNCTION IF EXISTS public.customer_invoice_list(jsonb, integer, integer);
-- (PART 30 of the structure file: the product receipt - dropped BEFORE the purchase order, its lines point to the order lines; the 'received' movements go with project_status_movements below)
DROP TABLE IF EXISTS public.product_receipt_lines CASCADE;
DROP TABLE IF EXISTS public.product_receipt_header CASCADE;
DROP SEQUENCE IF EXISTS public.product_receipt_document_seq;
DROP FUNCTION IF EXISTS public.product_receipt_state(uuid);
DROP FUNCTION IF EXISTS public.product_receipt_lines_before_write();
DROP FUNCTION IF EXISTS public.product_receipt_header_before_write();
DROP FUNCTION IF EXISTS public.project_status_register_receipt(uuid);
DROP FUNCTION IF EXISTS public.create_product_receipt_from_order(uuid);
DROP FUNCTION IF EXISTS public.create_vendor_invoice_from_receipt(uuid);
DROP FUNCTION IF EXISTS public.product_receipt_set_header(uuid, jsonb);
DROP FUNCTION IF EXISTS public.product_receipt_add_line(uuid, text);
DROP FUNCTION IF EXISTS public.post_product_receipt(uuid);
DROP FUNCTION IF EXISTS public.unpost_product_receipt(uuid);
DROP FUNCTION IF EXISTS public.delete_product_receipt(uuid);
DROP FUNCTION IF EXISTS public.product_receipt_list(jsonb, integer, integer);
DROP FUNCTION IF EXISTS public.product_receipt_line_places(uuid);
-- (PART 28 of the structure file: the purchase order - its tables with their triggers, then its functions)
DROP TABLE IF EXISTS public.purchase_order_lines CASCADE;
DROP TABLE IF EXISTS public.purchase_order_header CASCADE;
DROP SEQUENCE IF EXISTS public.purchase_order_document_seq;
DROP FUNCTION IF EXISTS public.purchase_order_state(uuid);
DROP FUNCTION IF EXISTS public.purchase_order_lines_before_write();
DROP FUNCTION IF EXISTS public.purchase_order_header_before_write();
DROP FUNCTION IF EXISTS public.project_status_register_order(uuid);
DROP FUNCTION IF EXISTS public.purchase_order_candidates(uuid, uuid[]);
DROP FUNCTION IF EXISTS public.create_purchase_orders(uuid, jsonb, text);
DROP FUNCTION IF EXISTS public.purchase_order_set_header(uuid, jsonb);
DROP FUNCTION IF EXISTS public.purchase_order_add_line(uuid, text);
DROP FUNCTION IF EXISTS public.post_purchase_order(uuid);
DROP FUNCTION IF EXISTS public.unpost_purchase_order(uuid);
DROP FUNCTION IF EXISTS public.delete_purchase_order(uuid);
DROP FUNCTION IF EXISTS public.purchase_order_list(jsonb, integer, integer);
DROP FUNCTION IF EXISTS public.purchase_order_set_line_task(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.purchase_order_line_places(uuid);
DROP TABLE IF EXISTS public.vendor_invoice_lines CASCADE;
DROP TABLE IF EXISTS public.vendor_invoice_header CASCADE;
DROP TABLE IF EXISTS public."legalEntityTable" CASCADE;
DROP SEQUENCE IF EXISTS public.vendor_invoice_document_seq;
DROP FUNCTION IF EXISTS public.vendor_invoice_list(jsonb, integer, integer);
DROP FUNCTION IF EXISTS public.delete_vendor_invoice(uuid);
DROP FUNCTION IF EXISTS public.unpost_vendor_invoice(uuid);
DROP FUNCTION IF EXISTS public.post_vendor_invoice(uuid);
DROP FUNCTION IF EXISTS public.vendor_invoice_set_header(uuid, jsonb);
DROP FUNCTION IF EXISTS public.vendor_invoice_add_line(uuid, text);
DROP FUNCTION IF EXISTS public.vendor_project_setting(uuid, text);
DROP FUNCTION IF EXISTS public.vendor_project_setting_on(uuid, text);
DROP FUNCTION IF EXISTS public.vendor_task_line_snapshot(uuid);
DROP FUNCTION IF EXISTS public.vendor_invoice_set_line_task(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.vendor_invoice_line_places(uuid);
DROP FUNCTION IF EXISTS public.create_vendor_invoices(uuid, jsonb, text);
DROP FUNCTION IF EXISTS public.vendor_invoice_candidates(uuid, uuid[]);
DROP FUNCTION IF EXISTS public.project_status_register_invoice(uuid);
DROP FUNCTION IF EXISTS public.vendor_invoice_state(uuid);
DROP FUNCTION IF EXISTS public.vendor_invoice_lines_before_write();
DROP FUNCTION IF EXISTS public.vendor_invoice_header_before_write();
DROP FUNCTION IF EXISTS public.legal_entity_guard();
DROP FUNCTION IF EXISTS public.contract_legal_entity_guard() CASCADE;          -- the trigger on contractTable goes with it
DROP FUNCTION IF EXISTS public.main_vendor_guard() CASCADE;                    -- the triggers on partnerTable / equipmentTable / productTable go with it
DROP TABLE IF EXISTS public.monitor01_view CASCADE;
DROP TABLE IF EXISTS public.project_status_movements CASCADE;
DROP TABLE IF EXISTS public.project_status_month_turnover CASCADE;
DROP TABLE IF EXISTS public.task_line_fact_for_monitor01 CASCADE;           -- the name before the rename (a database that was not upgraded)
DROP TABLE IF EXISTS public.monitor01_dirty CASCADE;
DROP TABLE IF EXISTS public.monitor01_refresh_log CASCADE;
DROP TABLE IF EXISTS public.task_fact_usage_timeline CASCADE;
DROP TABLE IF EXISTS public.task_fact_timeline CASCADE;                    -- the name before the rename (a database that was not upgraded)
DROP FUNCTION IF EXISTS public.task_fact_timeline_before_write();
DROP TABLE IF EXISTS public.task_fact_header CASCADE;
DROP SEQUENCE IF EXISTS public.task_fact_document_seq;
DROP PROCEDURE IF EXISTS public.monitor01_process_dirty(integer, integer);
DROP FUNCTION IF EXISTS public.monitor01_process_batch(integer);
DROP FUNCTION IF EXISTS public.monitor01_apply(uuid[]);
DROP FUNCTION IF EXISTS public.monitor01_stamp(uuid);
DROP FUNCTION IF EXISTS public.monitor01_refresh_now(uuid, integer);
DROP FUNCTION IF EXISTS public.monitor01_fresh_rows(uuid[]);
DROP FUNCTION IF EXISTS public.monitor01_fresh_fact_rows(uuid[]);
DROP FUNCTION IF EXISTS public.project_status_fresh_turnover(uuid[]);
DROP FUNCTION IF EXISTS public.project_status_register_plan(uuid[]);
DROP FUNCTION IF EXISTS public.project_status_register_fact(uuid);
DROP FUNCTION IF EXISTS public.project_status_unregister(uuid);
DROP FUNCTION IF EXISTS public.project_status_trg_queue_new();
DROP FUNCTION IF EXISTS public.project_status_trg_queue_old();
DROP FUNCTION IF EXISTS public.monitor01_queue_tasks(uuid[], text);
DROP FUNCTION IF EXISTS public.monitor01_trg_queue_new();
DROP FUNCTION IF EXISTS public.monitor01_trg_queue_old();
DROP FUNCTION IF EXISTS public.monitor01_trg_fact_header();
DROP FUNCTION IF EXISTS public.monitor01_trg_task_rename();
DROP FUNCTION IF EXISTS public.monitor01_trg_project_rename();
DROP FUNCTION IF EXISTS public.monitor01_trg_role_rename();
DROP FUNCTION IF EXISTS public.monitor01_rebuild(uuid);
DROP FUNCTION IF EXISTS public.monitor01_verify(integer);
DROP FUNCTION IF EXISTS public.monitor01_housekeeping();
DROP FUNCTION IF EXISTS public.monitor01_sum_sources(text, jsonb, integer, integer);
DROP FUNCTION IF EXISTS public.monitor01_refresh_interval_seconds();
DROP FUNCTION IF EXISTS public.monitor01_batch_size();
DROP FUNCTION IF EXISTS public.monitor01_run_budget_ms();
DROP FUNCTION IF EXISTS public.task_fact_document_create(uuid);
DROP FUNCTION IF EXISTS public.post_task_fact_document(uuid);
DROP FUNCTION IF EXISTS public.unpost_task_fact_document(uuid);
DROP FUNCTION IF EXISTS public.task_fact_document_list(jsonb, integer, integer);
DROP FUNCTION IF EXISTS public.task_fact_header_state(uuid);
DROP FUNCTION IF EXISTS public.task_fact_usage_timeline_before_write();
DROP FUNCTION IF EXISTS public.task_fact_header_before_write();

-- =====================================================================================
-- PART 1b: delete_time_genus_control.sql  (the numbering of the other parts stays: 1b runs FIRST, it is the newest)
-- Removes what PARTs 20-23 of start1_sql_tables.sql + start2_sql_code.sql added (organization scope, resource calendar, busy check, calendar lock): organizationInvitationTable (data included!), the functions, the triggers and the constraint on userTable / project_table.
-- Runs FIRST (it is the newest part). The key userOrganization stays inside the rowJSON of the users and the column project_table.rowParentGUID goes with the table (PART 14).
-- =====================================================================================
DO $$
BEGIN
  IF to_regclass('public."userTable"') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_user_table_organization ON public."userTable";
    ALTER TABLE public."userTable" DROP CONSTRAINT IF EXISTS "userTable_userOrganization_chk";
  END IF;
  IF to_regclass('public.project_table') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_project_table_organization ON public.project_table;
    DROP TRIGGER IF EXISTS trg_project_table_organization_keep ON public.project_table;
    ALTER TABLE public.project_table DROP CONSTRAINT IF EXISTS project_table_organization_fk;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'organizationInvitationTable')
     AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public."organizationInvitationTable";
  END IF;
END $$;
-- PART 23 (create_calendar_lock.sql): the triggers first (on tables that still exist), then the functions
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['personTable', 'equipmentTable'] LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_' || t || '_resource_pointer_lock', t);
    END IF;
  END LOOP;
  IF to_regclass('public."contractTable"') IS NOT NULL THEN DROP TRIGGER IF EXISTS trg_contract_table_calendar_lock ON public."contractTable"; END IF;
  IF to_regclass('public."managementCalendarDaysTable"') IS NOT NULL THEN DROP TRIGGER IF EXISTS trg_management_calendar_day_lock ON public."managementCalendarDaysTable"; END IF;
END $$;
DROP FUNCTION IF EXISTS public.organization_calendar_change_conflicts(text, date, date, jsonb);
DROP FUNCTION IF EXISTS public.organization_calendar_lock_info(text, date, date);
DROP FUNCTION IF EXISTS public.organization_contract_lock();
DROP FUNCTION IF EXISTS public.organization_resource_pointer_lock();
DROP FUNCTION IF EXISTS public.organization_calendar_day_lock();
DROP FUNCTION IF EXISTS public.organization_assert_capacity(text, text, date, numeric, numeric);
DROP FUNCTION IF EXISTS public.organization_resource_booked(text, text, date);
DROP FUNCTION IF EXISTS public.organization_contract_calendar(text, date, text, jsonb);
-- PART 22 (create_resource_busy_check.sql): the view, the functions (create_task_line_plan itself is dropped by PART 2). The columns planMovementStatus / periodDay go with their table.
DROP FUNCTION IF EXISTS public.organization_resource_busy_check(uuid, text, text);
DROP FUNCTION IF EXISTS public.organization_project_manager_email(uuid);
DROP FUNCTION IF EXISTS public.organization_resource_title(text, text);
DROP FUNCTION IF EXISTS public.organization_lock_resource(text, text);
DROP FUNCTION IF EXISTS public.organization_resource_calendars(text, text);
DROP FUNCTION IF EXISTS public.organization_lock_calendar(text, boolean);
DROP VIEW IF EXISTS public.resource_occupancy_x_movement;
-- PART 21 (create_resource_calendar.sql): the triggers on the resource tables and the calendar tables, then the functions
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['personTable', 'equipmentTable', 'contractTable', 'templateResourceContractTable'] LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_' || t || '_resource_calendar', t);
    END IF;
  END LOOP;
  IF to_regclass('public."managementCalendarTable"') IS NOT NULL THEN DROP TRIGGER IF EXISTS trg_management_calendar_in_use ON public."managementCalendarTable"; END IF;
  IF to_regclass('public."managementCalendarDaysTable"') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_management_calendar_day_normalize ON public."managementCalendarDaysTable";
    ALTER TABLE public."managementCalendarDaysTable" DROP CONSTRAINT IF EXISTS management_calendar_day_hours_chk;
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.organization_copy_calendar(text, text, text);
DROP FUNCTION IF EXISTS public.organization_calendar_consistency(text, integer);
DROP FUNCTION IF EXISTS public.organization_holiday_days(text, integer);
DROP FUNCTION IF EXISTS public.organization_project_calendars(text);
DROP FUNCTION IF EXISTS public.organization_resource_capacity(text, text, date);
DROP FUNCTION IF EXISTS public.organization_resource_capacity_info(text, text, date);
DROP FUNCTION IF EXISTS public.organization_calendar_day_hours(text, date);
DROP FUNCTION IF EXISTS public.organization_json_date(text);
DROP FUNCTION IF EXISTS public.organization_calendar_in_use_guard();
DROP FUNCTION IF EXISTS public.organization_resource_calendar_check();
DROP FUNCTION IF EXISTS public.organization_calendar_day_normalize();
DROP TABLE IF EXISTS public."organizationInvitationTable" CASCADE;
DROP FUNCTION IF EXISTS public.organization_accept_invitation(text);
DROP FUNCTION IF EXISTS public.organization_revoke_invitation(text);
DROP FUNCTION IF EXISTS public.organization_invite_user(text);
DROP FUNCTION IF EXISTS public.organization_ensure_user(text, text, text, text);
DROP FUNCTION IF EXISTS public.organization_is_admin(text);
DROP FUNCTION IF EXISTS public.organization_for_email(text, text);
DROP FUNCTION IF EXISTS public.organization_of_current_user();
DROP FUNCTION IF EXISTS public.organization_of_user(text);
DROP FUNCTION IF EXISTS public.organization_user_guard();
DROP FUNCTION IF EXISTS public.organization_project_set_parent();
DROP FUNCTION IF EXISTS public.organization_project_keep_parent();
NOTIFY pgrst, 'reload schema';


-- =====================================================================================
-- PART 1: user calendars (user_calendar_table, user_calendar_event_table, user_calendar_invitation_table + the sync triggers on the project tables)
-- =====================================================================================

DROP TRIGGER IF EXISTS trg_project_task_zzz_user_calendar ON public.project_task_table;
DROP TRIGGER IF EXISTS trg_project_table_zzz_user_calendar ON public.project_table;
DROP FUNCTION IF EXISTS public.user_calendar_project_task_sync();
DROP FUNCTION IF EXISTS public.user_calendar_project_sync();

DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['user_calendar_invitation_table', 'user_calendar_event_table', 'user_calendar_table'] LOOP
      IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

DROP TABLE IF EXISTS public.user_calendar_invitation_table CASCADE;
DROP TABLE IF EXISTS public.user_calendar_event_table CASCADE;
DROP TABLE IF EXISTS public.user_calendar_table CASCADE;
DROP FUNCTION IF EXISTS public.user_calendar_project_task_json(public.project_task_table);


-- ===============================================================================================
-- PART 2: delete_task_line_plan_table.sql
-- drops task_line_plan + task_line_plan_timeline + create_task_line_plan + the unpost trigger
-- ===============================================================================================

-- =====================================================================================
-- UNIVERSAL1 - DELETE TASK LINE PLAN: delete_task_line_plan_table.sql
-- Drops task_line_plan (the posted days - data included!), create_task_line_plan and the unpost trigger.
-- The lines keep taskIsPosted = true until their next change: edit one (or press Post after create_task_line_plan_table.sql again).
-- =====================================================================================
DROP TRIGGER IF EXISTS trg_task_line_plan_unpost_on_dates ON public.project_task_table;
DROP FUNCTION IF EXISTS public.task_line_plan_unpost_on_dates();
DROP FUNCTION IF EXISTS public.create_task_line_plan(jsonb);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'task_line_plan_movements')
     AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.task_line_plan_movements;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'task_line_plan_timeline')
     AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.task_line_plan_timeline;
  END IF;
  DROP TABLE IF EXISTS public.task_line_plan_timeline CASCADE;
  DROP TABLE IF EXISTS public.task_line_plan_movements CASCADE;
END $$;

NOTIFY pgrst, 'reload schema';


-- ===============================================================================================
-- PART 3: delete_management_calendar_tables.sql
-- drops the management calendars and their days
-- ===============================================================================================

-- =====================================================================================
-- UNIVERSAL1 - DELETE MANAGEMENT CALENDARS: delete_management_calendar_tables.sql
-- Drops managementCalendarDaysTable, managementCalendarTable and fill_management_calendar (the calendars and their days are lost).
-- Run delete_task_line_plan_table.sql first if you also created task_line_plan (it does not point at the calendars, but a project may
-- still name a calendar in rowJSON.calendarForTaskPlan).
-- =====================================================================================
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['managementCalendarDaysTable', 'managementCalendarTable'] LOOP
      IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.fill_management_calendar(text, integer, text, boolean, numeric, boolean);
DROP TABLE IF EXISTS public."managementCalendarDaysTable" CASCADE;
DROP TABLE IF EXISTS public."managementCalendarTable" CASCADE;

NOTIFY pgrst, 'reload schema';


-- ===============================================================================================
-- PART 4: delete_pm_task_line_table.sql
-- drops task_line_table + pm_set_task_last_edit_place
-- ===============================================================================================

-- =====================================================================================
-- UNIVERSAL1 - PM TASK LINES: delete_pm_task_line_table.sql
-- Drops task_line_table (data included!) and pm_set_task_last_edit_place. project_task_table.rowJSON.lastEditPlace stays as it is
-- (the app ignores a place it does not know).
-- =====================================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'task_line_table')
     AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.task_line_table;
  END IF;
  DROP TABLE IF EXISTS public.task_line_table CASCADE;
END $$;

DROP FUNCTION IF EXISTS public.task_line_set_project();
DROP FUNCTION IF EXISTS public.pm_set_task_last_edit_place(uuid, jsonb);

NOTIFY pgrst, 'reload schema';


-- ===============================================================================================
-- PART 5: delete_template_resource_contract_table.sql
-- drops templateResourceContractTable
-- ===============================================================================================

-- =====================================================================================
-- UNIVERSAL1 - TEMPLATE RESOURCE CONTRACT: delete_template_resource_contract_table.sql
-- Drops templateResourceContractTable (data included!). task_line_table.rowJSON.resourceContractTemplateTaskLine keeps the old GUID
-- (the task line then marks the missing template).
-- =====================================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'templateResourceContractTable')
     AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public."templateResourceContractTable";
  END IF;
  DROP TABLE IF EXISTS public."templateResourceContractTable" CASCADE;
END $$;
NOTIFY pgrst, 'reload schema';


-- ===============================================================================================
-- PART 6: delete_equipment_tables.sql
-- drops equipmentTable / equipmentTypeTable, the equipment descriptors, variants and properties, the role type "Equipment Resources", the taskResourceKind check
-- ===============================================================================================

-- =====================================================================================
-- UNIVERSAL1 - EQUIPMENT: delete_equipment_tables.sql
-- Removes what create_equipment_tables.sql added (data included!): the check of task_line_table, the equipment variants / property values / sets / plan lines,
-- the role type "Equipment Resources" with its roles, requirements, variants and rates, the equipment descriptors, and the two equipment tables.
-- The lines of a task are not deleted: a Time line of an equipment loses its resource (it points at a row that is gone) and its kind is read as a person.
-- =====================================================================================
DO $guard$
BEGIN
  IF to_regclass('public.task_line_table') IS NOT NULL THEN
    ALTER TABLE public.task_line_table DROP CONSTRAINT IF EXISTS task_line_resource_kind_chk;
  END IF;
  IF to_regclass('public."variantValueTable"') IS NOT NULL AND to_regclass('public."resourceRoleTable"') IS NOT NULL THEN
    EXECUTE $q$
DELETE FROM public."variantValueTable" WHERE "rowGUID" LIKE 'evv\_%' ESCAPE '\' OR "rowGUID" LIKE 'rvv\_%' ESCAPE '\';
DELETE FROM public."variantTable"      WHERE "rowGUID" LIKE 'evar\_%' ESCAPE '\' OR "rowGUID" LIKE 'rv\_eqr\_%' ESCAPE '\';
DELETE FROM public."propertyValueTable" WHERE "rowGUID" LIKE 'pp\_eq\_%' ESCAPE '\' OR "rowGUID" LIKE 'pp\_eqr\_%' ESCAPE '\';
DELETE FROM public."rolePriceTable"    WHERE "rowGUID" LIKE 'rp\_eqr\_%' ESCAPE '\';
DELETE FROM public."resourceRoleTable" WHERE "rowOwnerGUID" = 'equipmentResources';
DELETE FROM public."resourceRoleFolderTable" WHERE "rowGUID" = 'fld_res_eq';
DELETE FROM public."resourceRoleTypeTable" WHERE "rowGUID" = 'equipmentResources';
DELETE FROM public."descriptorPlanTable" WHERE "rowGUID" LIKE 'dp\_eqh\_%' ESCAPE '\' OR "rowGUID" LIKE 'dp\_eqv\_%' ESCAPE '\' OR "rowGUID" LIKE 'dp\_eqr\_%' ESCAPE '\';
DELETE FROM public."descriptorDestinationTable" WHERE "rowGUID" IN ('ds_eqh_prop', 'ds_eqh_var', 'ds_eqv_prop', 'ds_eqv_var', 'ds_eqr_prop', 'ds_eqr_var');
DELETE FROM public."descriptorValueTable" WHERE "rowOwnerGUID" IN ('equipmentClass', 'hireMode');
DELETE FROM public."descriptorGenusTable" WHERE "rowGUID" IN ('equipmentClass', 'hireMode', 'enginePowerKw', 'minEnginePowerKw', 'yearOfManufacture');
UPDATE public."resourceRoleTypeTable" SET "rowJSON" = "rowJSON" - 'resourceKind' WHERE "rowGUID" = 'humanResources';
    $q$;
  END IF;
END $guard$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['equipmentTable', 'equipmentTypeTable'] LOOP
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t)
       AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', t);
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';


-- ===============================================================================================
-- PART 7: delete_person_descriptors.sql
-- removes the person descriptors, variants, certificates and the demo contracts
-- ===============================================================================================

-- =====================================================================================
-- UNIVERSAL1 - PERSON DESCRIPTORS: delete_person_descriptors.sql
-- Removes what create_person_descriptors.sql added: the person sets / plan lines, the property values and variants of persons, the
-- experienceYears descriptor, 'personType' from the targets of the shared descriptors, and the demo contracts 'contract_<person>'.
-- =====================================================================================
DO $guard$
BEGIN
  IF to_regclass('public."variantValueTable"') IS NOT NULL AND to_regclass('public."contractTable"') IS NOT NULL THEN
    EXECUTE $q$
DELETE FROM public."variantValueTable" WHERE "rowGUID" LIKE 'pvv\_%' ESCAPE '\';
DELETE FROM public."variantTable"      WHERE "rowGUID" LIKE 'pvar\_%' ESCAPE '\';
DELETE FROM public."propertyValueTable" WHERE "rowGUID" LIKE 'pp\_exp\_%' ESCAPE '\' OR "rowGUID" LIKE 'pp\_cert\_%' ESCAPE '\';
DELETE FROM public."descriptorPlanTable" WHERE "rowGUID" LIKE 'dp\_emp\_%' ESCAPE '\' OR "rowGUID" LIKE 'dp\_con\_%' ESCAPE '\';
DELETE FROM public."descriptorDestinationTable" WHERE "rowGUID" IN ('ds_emp_prop', 'ds_emp_var', 'ds_con_prop', 'ds_con_var');
DELETE FROM public."descriptorGenusTable" WHERE "rowGUID" = 'experienceYears';
UPDATE public."descriptorGenusTable" g
   SET "rowJSON" = jsonb_set(g."rowJSON", '{targetKinds}', COALESCE((SELECT jsonb_agg(k) FROM jsonb_array_elements(g."rowJSON"->'targetKinds') k WHERE k <> '"personType"'::jsonb), '[]'::jsonb))
 WHERE g."rowGUID" IN ('seniority', 'workLanguage', 'certification');
UPDATE public."descriptorGenusTable" g SET "rowJSON" = g."rowJSON" - 'multiple' WHERE g."rowGUID" = 'certification';
DELETE FROM public."contractTable" WHERE "rowGUID" LIKE 'contract\_%' ESCAPE '\' AND "rowParentGUID" = 'person';
NOTIFY pgrst, 'reload schema';
    $q$;
  END IF;
END $guard$;


-- ===============================================================================================
-- PART 8: delete_person_type_table.sql
-- drops personTypeTable
-- ===============================================================================================

-- =====================================================================================
-- UNIVERSAL1 - PERSON TYPES: delete_person_type_table.sql
-- Drops personTypeTable (data included!). personTable.rowJSON.personType stays as it is; the person descriptor data
-- (create_person_descriptors.sql) is removed by delete_person_descriptors.sql.
-- =====================================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'personTypeTable')
     AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public."personTypeTable";
  END IF;
  DROP TABLE IF EXISTS public."personTypeTable" CASCADE;
END $$;
NOTIFY pgrst, 'reload schema';


-- ===============================================================================================
-- PART 9: delete_resource_role_tables.sql
-- drops the resource role tables + their rows in the shared descriptor tables
-- ===============================================================================================

-- =====================================================================================
-- UNIVERSAL1 - RESOURCE ROLE CATALOG: delete_resource_role_tables.sql
-- Removes everything create_resource_role_tables.sql adds (data included!):
--   1. the rows the role side keeps in the SHARED tables: descriptor sets + plan lines of role types, property values of roles,
--      variants (+ variant values) of role types / roles, descriptors meant only for role types (+ their values), price lists used only for roles
--   2. the four role tables (resourceRoleTypeTable, resourceRoleFolderTable, resourceRoleTable, rolePriceTable)
-- The product catalog is not touched. Shared helpers (kit8_setup_def_table, kit8_touch_updated_at) are kept.
-- =====================================================================================
DO $$
DECLARE
  t text;
BEGIN
  IF to_regclass('public."resourceRoleTypeTable"') IS NOT NULL AND to_regclass('public."resourceRoleTable"') IS NOT NULL THEN
    -- variant values -> variants -> property values -> plan lines -> sets (children first)
    DELETE FROM public."variantValueTable" WHERE "rowOwnerGUID" IN (
      SELECT "rowGUID" FROM public."variantTable"
       WHERE "rowOwnerGUID" IN (SELECT "rowGUID" FROM public."resourceRoleTypeTable") OR "rowOwnerGUID" IN (SELECT "rowGUID" FROM public."resourceRoleTable"));
    DELETE FROM public."variantTable"
     WHERE "rowOwnerGUID" IN (SELECT "rowGUID" FROM public."resourceRoleTypeTable") OR "rowOwnerGUID" IN (SELECT "rowGUID" FROM public."resourceRoleTable");
    DELETE FROM public."propertyValueTable" WHERE "rowOwnerGUID" IN (SELECT "rowGUID" FROM public."resourceRoleTable");
    DELETE FROM public."descriptorPlanTable" WHERE "rowOwnerGUID" IN (
      SELECT "rowGUID" FROM public."descriptorDestinationTable" WHERE "rowOwnerGUID" IN (SELECT "rowGUID" FROM public."resourceRoleTypeTable"));
    DELETE FROM public."descriptorDestinationTable" WHERE "rowOwnerGUID" IN (SELECT "rowGUID" FROM public."resourceRoleTypeTable");
  END IF;
  -- descriptors and price lists that only roles use
  IF to_regclass('public."descriptorValueTable"') IS NOT NULL AND to_regclass('public."descriptorGenusTable"') IS NOT NULL AND to_regclass('public."priceTypeTable"') IS NOT NULL THEN
    DELETE FROM public."descriptorValueTable" WHERE "rowOwnerGUID" IN (SELECT "rowGUID" FROM public."descriptorGenusTable" WHERE "rowJSON"->'targetKinds' = '["resourceRoleType"]'::jsonb);
    DELETE FROM public."descriptorGenusTable" WHERE "rowJSON"->'targetKinds' = '["resourceRoleType"]'::jsonb;
    DELETE FROM public."priceTypeTable" WHERE "rowJSON"->'appliesTo' = '["resourceRoleType"]'::jsonb;
  END IF;

  FOREACH t IN ARRAY ARRAY['resourceRoleTypeTable', 'resourceRoleFolderTable', 'resourceRoleTable', 'rolePriceTable'] LOOP
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t)
       AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';


-- ===============================================================================================
-- PART 10: delete_product_tables.sql
-- drops the product catalog and the shared descriptor / variant / price tables
-- ===============================================================================================

-- =====================================================================================
-- UNIVERSAL1 - PRODUCT CATALOG: delete_product_tables.sql
-- Drops every table create_product_tables.sql creates (data included!). Shared helpers
-- (kit8_setup_def_table, kit8_touch_updated_at) are kept: other tables use them.
-- =====================================================================================
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['valueAddedTaxTable', 'measureUnitTable', 'descriptorGenusTable', 'descriptorValueTable', 'descriptorModeTable', 'descriptorDestinationTable', 'descriptorPlanTable', 'productTypeTable', 'productFolderTable', 'productTable', 'propertyValueTable', 'variantTable', 'variantValueTable', 'productPackageTable', 'productSeriesTable', 'productBarcodeTable', 'priceTypeTable', 'productPriceTable'] LOOP
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t)
       AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';


-- ===============================================================================================
-- PART 11: delete_budget_item_table.sql
-- drops budgetItemTable
-- ===============================================================================================

-- =====================================================================================
-- UNIVERSAL1 - BUDGET ITEMS: delete_budget_item_table.sql
-- Drops budgetItemTable (data included!) and its genus check function. managementGenusTable is not touched.
-- =====================================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'budgetItemTable')
     AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public."budgetItemTable";
  END IF;
  DROP TABLE IF EXISTS public."budgetItemTable" CASCADE;
END $$;

DROP FUNCTION IF EXISTS public.kit8_budget_item_check_genus();
-- the activity genus (the structure file, its part 32): its two catalogs, then the functions of the budget item key (the trigger went with budgetItemTable)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['managementActivityGenusTable', 'budgetItemGenericKeyTable'] LOOP
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t)
       AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', t);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.kit8_budget_item_check_key();
DROP FUNCTION IF EXISTS public.kit8_budget_item_key_direction(text);
DROP FUNCTION IF EXISTS public.kit8_budget_item_key_matrix();

NOTIFY pgrst, 'reload schema';


-- ===============================================================================================
-- PART 12: delete_management_genus_table.sql
-- drops managementGenusTable
-- ===============================================================================================

-- =====================================================================================
-- UNIVERSAL1 - MANAGEMENT GENUS: delete_management_genus_table.sql
-- Drops managementGenusTable (data included!). resourceRoleTypeTable.rowJSON.managementGenus is left as it is (the Checks panel of the
-- resource roles then reports a genus that does not exist).
-- =====================================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'managementGenusTable')
     AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public."managementGenusTable";
  END IF;
  DROP TABLE IF EXISTS public."managementGenusTable" CASCADE;
END $$;

NOTIFY pgrst, 'reload schema';


-- ===============================================================================================
-- PART 13: delete_distribution_generic_table.sql
-- drops distributionGenericTable
-- ===============================================================================================

-- =====================================================================================
-- UNIVERSAL1 - DISTRIBUTION: delete_distribution_generic_table.sql
-- Drops distributionGenericTable (data included!). task_line_table.rowJSON.distributionForBudgetTaskLine is left as it is (the line then shows a
-- distribution that does not exist).
-- =====================================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'distributionGenericTable')
     AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public."distributionGenericTable";
  END IF;
  DROP TABLE IF EXISTS public."distributionGenericTable" CASCADE;
END $$;

NOTIFY pgrst, 'reload schema';


-- ===============================================================================================
-- PART 14: delete_tables.sql
-- drops EVERYTHING of done/create_tables.sql: all projects, tasks, catalogs, persons, contracts, rates (all users!)
-- ===============================================================================================

-- =====================================================================================
-- UNIVERSAL1 - DROP EVERYTHING created by create_tables.sql
--
-- WARNING: IRREVERSIBLE. Deletes the data of ALL users: projects, tasks, dependencies,
-- templates, project versions, Kanban, catalogs (countries, currencies, rates, organizations, departaments,
-- persons, partners, contracts) and the generic app tables (themeStore, raciMember, mediaPost...).
-- Make a backup first (Supabase Dashboard -> Database -> Backups, or pg_dump).
--
-- Safe to run more than once (IF EXISTS everywhere). Re-create with create_tables.sql.
-- Extensions (ltree, pgcrypto) are left installed on purpose.
-- =====================================================================================

-- ---- 1. realtime publication ----------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime' AND NOT puballtables) THEN
    FOR t IN
      SELECT tablename FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
         AND tablename = ANY (ARRAY[
           'googleDriveCommandTable', 'raciMemberTable', 'themeStoreTable', 'mediaPostTable', 'mediaPostTableArchive',
           'userTable', 'userAuthTable', 'aiSessionTable',
           'dtcTaskFinishedTable', 'dtcCatalogExecutiveTable', 'dtcTaskRegisteredTable',
           'dtcTaskWaitingTable', 'dtcTaskProgressTable', 'dtcFreeExecutiveTable',
           'countryTable', 'currencyTable', 'currencyExchangeRateTable', 'organizationTable',
           'departamentTable', 'personTable', 'partnerTable', 'contractTable', 'roleTable', 'userRoleTable',
           'project_table', 'project_task_table', 'project_task_dependencies_table',
           'project_task_dependency_closure_table', 'project_user_settings_table',
           'kanban_stage_table', 'project_kanban_stage_table', 'project_task_kanban_state_table',
           'templates_project_table', 'templates_project_task_table', 'templates_project_task_dependencies_table',
           'templates_project_task_dependency_closure_table', 'templates_project_kanban_stage_table',
           'templates_project_user_settings_table'])
    LOOP
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END LOOP;
  END IF;
END $$;

-- ---- 2. views ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.project_task_schedule_view;
DROP VIEW IF EXISTS public.templates_project_task_schedule_view;   -- older scripts

-- ---- 2b. PM project versions (children first) -------------------------------------------
DROP TABLE IF EXISTS public.version_project_task_kanban_state_table CASCADE;
DROP TABLE IF EXISTS public.version_project_kanban_stage_table CASCADE;
DROP TABLE IF EXISTS public.version_project_task_dependencies_table CASCADE;
DROP TABLE IF EXISTS public.version_project_task_table CASCADE;
DROP TABLE IF EXISTS public.version_project_table CASCADE;

-- ---- 3. PM templates (children first; CASCADE removes triggers, policies, FKs, indexes) --
DROP TABLE IF EXISTS public.templates_project_user_settings_table CASCADE;
DROP TABLE IF EXISTS public.templates_project_kanban_stage_table CASCADE;
DROP TABLE IF EXISTS public.templates_project_task_dependency_closure_table CASCADE;
DROP TABLE IF EXISTS public.templates_project_task_dependencies_table CASCADE;
DROP TABLE IF EXISTS public.templates_project_task_table CASCADE;
DROP TABLE IF EXISTS public.templates_project_table CASCADE;

-- ---- 4. PM Kanban + Gantt ---------------------------------------------------------------
DROP TABLE IF EXISTS public.project_task_kanban_state_table CASCADE;
DROP TABLE IF EXISTS public.project_kanban_stage_table CASCADE;
DROP TABLE IF EXISTS public.kanban_stage_table CASCADE;
DROP TABLE IF EXISTS public.project_user_settings_table CASCADE;
DROP TABLE IF EXISTS public.project_task_dependency_closure_table CASCADE;
DROP TABLE IF EXISTS public.project_task_dependencies_table CASCADE;
DROP TABLE IF EXISTS public.project_task_table CASCADE;
DROP TABLE IF EXISTS public.project_table CASCADE;

DROP TABLE IF EXISTS public."userRoleTable" CASCADE;
DROP TABLE IF EXISTS public."roleTable" CASCADE;
DROP TABLE IF EXISTS public."contractTable" CASCADE;
DROP TABLE IF EXISTS public."partnerTable" CASCADE;
DROP TABLE IF EXISTS public."personTable" CASCADE;
DROP TABLE IF EXISTS public."departamentTable" CASCADE;   -- the removed Departments catalog: only a database made before the business units still has it
DROP TABLE IF EXISTS public."organizationTable" CASCADE;
DROP TABLE IF EXISTS public."currencyExchangeRateTable" CASCADE;
DROP TABLE IF EXISTS public."currencyTable" CASCADE;
DROP TABLE IF EXISTS public."countryTable" CASCADE;

-- ---- 6. generic app tables --------------------------------------------------------------
DROP TABLE IF EXISTS public."googleDriveCommandTable" CASCADE;
DROP TABLE IF EXISTS public."raciMemberTable" CASCADE;
DROP TABLE IF EXISTS public."themeStoreTable" CASCADE;
DROP TABLE IF EXISTS public."mediaPostTable" CASCADE;
DROP TABLE IF EXISTS public."mediaPostTableArchive" CASCADE;
DROP TABLE IF EXISTS public."userTable" CASCADE;
DROP FUNCTION IF EXISTS public.app_user_guid() CASCADE;
DROP TABLE IF EXISTS public."userAuthTable" CASCADE;
DROP TABLE IF EXISTS public."aiSessionTable" CASCADE;
DROP TABLE IF EXISTS public."dtcTaskFinishedTable" CASCADE;
DROP TABLE IF EXISTS public."dtcCatalogExecutiveTable" CASCADE;
DROP TABLE IF EXISTS public."dtcTaskRegisteredTable" CASCADE;
DROP TABLE IF EXISTS public."dtcTaskWaitingTable" CASCADE;
DROP TABLE IF EXISTS public."dtcTaskProgressTable" CASCADE;
DROP TABLE IF EXISTS public."dtcFreeExecutiveTable" CASCADE;

-- ---- 7. functions -----------------------------------------------------------------------
-- A function still used by a table this script does not own (e.g. set_updated_at on some
-- other table) is kept, with a NOTICE, instead of aborting the whole script.
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    -- PM project versions
    'public.pm_version_restore(uuid, text)',
    'public.pm_version_save(uuid, text)',
    'public.pm_version_set_title(uuid, text)',
    'public.pm_owns_version(uuid)',
    -- PM templates
    'public.pm_template_task_dependency_after_delete()',
    'public.pm_template_rebuild_dependency_closure(uuid)',
    'public.pm_template_task_dependency_after_insert()',
    'public.pm_template_task_dependency_before_update()',
    'public.pm_template_task_dependency_before_insert()',
    'public.pm_template_dependency_creates_cycle(uuid, uuid)',
    'public.pm_template_task_after_delete_subtree()',
    'public.pm_template_task_after_move()',
    'public.pm_template_task_before_write()',
    'public.pm_owns_template(uuid)',
    -- PM Kanban
    'public.pm_kanban_ensure_project_stages(uuid)',
    'public.pm_kanban_stage_after_delete()',
    -- PM Gantt
    'public.pm_seed_demo(uuid, date)',
    'public.pm_task_downstream(uuid)',
    'public.pm_task_upstream(uuid)',
    'public.pm_apply_schedule(uuid, jsonb, timestamptz, numeric)',
    'public.pm_task_after_progress_change()',
    'public.pm_recalc_project_progress(uuid)',
    'public.pm_task_dependency_after_delete()',
    'public.pm_rebuild_dependency_closure(uuid)',
    'public.pm_task_dependency_after_insert()',
    'public.pm_task_dependency_before_update()',
    'public.pm_task_dependency_before_insert()',
    'public.pm_dependency_creates_cycle(uuid, uuid)',
    'public.pm_task_after_delete_subtree()',
    'public.pm_task_after_move()',
    'public.pm_task_before_write()',
    'public.pm_owns_project(uuid)',
    'public.pm_ltree_label(uuid)',
    -- shared helpers
    'public.kit8_setup_def_table(text)',
    'public.pm_touch_updated_at()',
    'public.kit8_touch_updated_at()',
    'public.set_updated_at()'
  ] LOOP
    BEGIN
      EXECUTE 'DROP FUNCTION IF EXISTS ' || f;
    EXCEPTION WHEN dependent_objects_still_exist THEN
      RAISE NOTICE 'kept % (still used by another object)', f;
    END;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- Check (expect no rows from this app):
--   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1;


-- =====================================================================================
-- PART 15: delete_business_unit_tables.sql
-- Removes what PART 18 of start1_sql_tables.sql + start2_sql_code.sql added: the triggers on the catalogs / the line / the project (when those tables are still there), businessUnitTable and cfrTypeTable (data included!),
-- their functions. The keys businessUnitAssigned / businessUnitTaskLine / project*Center stay inside the rowJSON of the other rows as inert JSON.
-- Runs after the tables that hold the keys (and create_task_line_plan, PART 2) are gone and BEFORE the helper kit8_touch_updated_at is dropped (businessUnitTable uses it).
-- =====================================================================================
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['budgetItemTable', 'resourceRoleTable', 'contractTable', 'personTable', 'equipmentTable', 'productTable'] LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_' || t || '_business_unit', t);
    END IF;
  END LOOP;
  IF to_regclass('public.task_line_table') IS NOT NULL THEN DROP TRIGGER IF EXISTS trg_task_line_table_business_unit ON public.task_line_table; END IF;
  IF to_regclass('public.project_table') IS NOT NULL THEN DROP TRIGGER IF EXISTS trg_project_table_business_unit ON public.project_table; END IF;
  FOREACH t IN ARRAY ARRAY['businessUnitTable', 'cfrTypeTable'] LOOP
    IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t)
       AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
DROP TABLE IF EXISTS public."businessUnitTable" CASCADE;
DROP TABLE IF EXISTS public."cfrTypeTable" CASCADE;
DROP FUNCTION IF EXISTS public.kit8_check_business_unit_ref();
DROP FUNCTION IF EXISTS public.kit8_business_unit_guard();
DROP FUNCTION IF EXISTS public.kit8_business_unit_used(text);
DROP FUNCTION IF EXISTS public.kit8_business_unit_cfr(text);
DROP FUNCTION IF EXISTS public.kit8_cfr_accepts(text, text);
DROP FUNCTION IF EXISTS public.kit8_cfr_type_readonly();
NOTIFY pgrst, 'reload schema';


-- =====================================================================================
-- PART 16: delete_budget_scenario_table.sql
-- Removes what PART 19 of start1_sql_tables.sql + start2_sql_code.sql added: budgetScenarioTable (data included!). Runs BEFORE the helper kit8_touch_updated_at is dropped (the table uses it).
-- =====================================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'budgetScenarioTable')
     AND NOT (SELECT puballtables FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public."budgetScenarioTable";
  END IF;
END $$;
DROP TABLE IF EXISTS public."budgetScenarioTable" CASCADE;
NOTIFY pgrst, 'reload schema';


-- =====================================================================================
-- PART 17: helpers that no table uses any more
-- =====================================================================================

DROP FUNCTION IF EXISTS public.kit8_touch_updated_at();

-- the VAT basis helpers (PART 26)
DROP FUNCTION IF EXISTS public.vat_basis_amount(numeric, numeric, numeric, text);
DROP FUNCTION IF EXISTS public.vat_rate_lookup(text);
DROP FUNCTION IF EXISTS public.vat_line_calc(numeric, numeric, numeric, jsonb, boolean, boolean, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text);

NOTIFY pgrst, 'reload schema';


-- ===============================================================================================
-- END of delete_sql_structure.sql
-- ===============================================================================================
