-- KANBAN STAGE PROGRESS %: every stage of the catalog, of a project and of a template has rowJSON.stageProgressPercent, a whole number 0..100
-- (0 = typed by hand on the Kanban card, 1..100 = the percent of a card in that stage). A stage saved without it gets the standard percent of its code. (kit8/catalog/kanbanstage/README.md)
BEGIN;
SELECT tt.as_admin();

SELECT public.organization_ensure_user('anna@acme.test', '11111111-1111-1111-1111-111111111111', 'Anna', 'K');

CREATE FUNCTION tt.mk_project(p_guid uuid, p_name text, p_owner uuid) RETURNS uuid LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowJSON") VALUES (p_guid, public.pm_ltree_label(p_guid), p_owner, jsonb_build_object('name', p_name));
  RETURN p_guid;
END $$;
SELECT tt.mk_project('aaaaaaaa-0000-0000-0000-00000000000a', 'P1', '11111111-1111-1111-1111-111111111111') AS p1 \gset

-- 1. the standard stages of the seed (start4_sql_insert_missing.sql) have their percent
SELECT tt.eq((SELECT string_agg((k."rowJSON"->>'stageCode') || ':' || (k."rowJSON"->>'stageProgressPercent'), ',' ORDER BY k."orderInList")
                FROM public.kanban_stage_table k WHERE k."rowOwnerGUID" = 'kanbanStageCatalog' AND k."rowJSON"->>'stageCode' IN ('waiting', 'plan', 'analyse', 'construct', 'execute')),
             'waiting:0,plan:10,analyse:30,construct:60,execute:90', 'the standard stages of the catalog have their percent');
SELECT tt.eq((SELECT count(*)::int FROM public.kanban_stage_table WHERE NOT ("rowJSON" ? 'stageProgressPercent')), 0, 'no stage of the catalog is without a percent');
SELECT tt.eq(public.pm_kanban_stage_default_percent('Construct'), 60, 'the standard percent of a code (not case sensitive)');
SELECT tt.eq(public.pm_kanban_stage_default_percent('my_own'), 0, 'any other code: 0 = typed by hand');
SELECT tt.eq(public.pm_kanban_stage_default_percent(NULL), 0, 'no code: 0');

-- 2. a stage saved without a percent gets one; a given one is kept
INSERT INTO public.kanban_stage_table ("rowGUID", "orderInList", "rowJSON") VALUES ('t-review', 9000, '{"stageCode":"review","stageName":"Review","stageColor":"#112233"}');
SELECT tt.eq((SELECT ("rowJSON"->>'stageProgressPercent')::int FROM public.kanban_stage_table WHERE "rowGUID" = 't-review'), 0, 'an own stage without a percent: 0');
INSERT INTO public.kanban_stage_table ("rowGUID", "orderInList", "rowJSON") VALUES ('t-qa', 9100, '{"stageCode":"qa","stageName":"QA","stageProgressPercent":75}');
SELECT tt.eq((SELECT ("rowJSON"->>'stageProgressPercent')::int FROM public.kanban_stage_table WHERE "rowGUID" = 't-qa'), 75, 'a given percent is kept');
DELETE FROM public.kanban_stage_table WHERE "rowOwnerGUID" = 'kanbanStageCatalog' AND "rowJSON"->>'stageCode' = 'plan';
INSERT INTO public.kanban_stage_table ("rowGUID", "orderInList", "rowJSON") VALUES ('t-plan', 2048, '{"stageCode":"plan","stageName":"Plan"}');
SELECT tt.eq((SELECT ("rowJSON"->>'stageProgressPercent')::int FROM public.kanban_stage_table WHERE "rowGUID" = 't-plan'), 10, 'a standard code without a percent gets the standard one');
-- an update that drops the key puts it back; an update of the name keeps the percent
UPDATE public.kanban_stage_table SET "rowJSON" = "rowJSON" - 'stageProgressPercent' WHERE "rowGUID" = 't-qa';
SELECT tt.eq((SELECT ("rowJSON"->>'stageProgressPercent')::int FROM public.kanban_stage_table WHERE "rowGUID" = 't-qa'), 0, 'an update that drops the key: back to the standard (0 for an own code)');
UPDATE public.kanban_stage_table SET "rowJSON" = "rowJSON" || '{"stageProgressPercent":40}' WHERE "rowGUID" = 't-qa';
UPDATE public.kanban_stage_table SET "rowJSON" = "rowJSON" || '{"stageName":"Quality"}' WHERE "rowGUID" = 't-qa';
SELECT tt.eq((SELECT ("rowJSON"->>'stageProgressPercent')::int FROM public.kanban_stage_table WHERE "rowGUID" = 't-qa'), 40, 'renaming keeps the percent');

-- 3. only a whole number 0..100
SELECT tt.fails($q$UPDATE public.kanban_stage_table SET "rowJSON" = "rowJSON" || '{"stageProgressPercent":101}' WHERE "rowGUID" = 't-qa'$q$, 'stageProgressPercent must be', '101 is refused');
SELECT tt.fails($q$UPDATE public.kanban_stage_table SET "rowJSON" = "rowJSON" || '{"stageProgressPercent":-1}' WHERE "rowGUID" = 't-qa'$q$, 'stageProgressPercent must be', 'a negative percent is refused');
SELECT tt.fails($q$UPDATE public.kanban_stage_table SET "rowJSON" = "rowJSON" || '{"stageProgressPercent":12.5}' WHERE "rowGUID" = 't-qa'$q$, 'stageProgressPercent must be', 'a fraction is refused');
SELECT tt.fails($q$UPDATE public.kanban_stage_table SET "rowJSON" = "rowJSON" || '{"stageProgressPercent":"10"}' WHERE "rowGUID" = 't-qa'$q$, 'stageProgressPercent must be', 'a text is refused');
SELECT tt.fails($q$UPDATE public.kanban_stage_table SET "rowJSON" = "rowJSON" || '{"stageProgressPercent":true}' WHERE "rowGUID" = 't-qa'$q$, 'stageProgressPercent must be', 'a boolean is refused');
UPDATE public.kanban_stage_table SET "rowJSON" = "rowJSON" || '{"stageProgressPercent":100}' WHERE "rowGUID" = 't-qa';
SELECT tt.eq((SELECT ("rowJSON"->>'stageProgressPercent')::int FROM public.kanban_stage_table WHERE "rowGUID" = 't-qa'), 100, '100 is accepted');
UPDATE public.kanban_stage_table SET "rowJSON" = "rowJSON" || '{"stageProgressPercent":0}' WHERE "rowGUID" = 't-qa';
SELECT tt.eq((SELECT ("rowJSON"->>'stageProgressPercent')::int FROM public.kanban_stage_table WHERE "rowGUID" = 't-qa'), 0, '0 is accepted (= typed by hand)');

-- 4. a project copies the active catalog stages WITH their percent
UPDATE public.kanban_stage_table SET "rowJSON" = "rowJSON" || '{"stageProgressPercent":45}' WHERE "rowGUID" = 't-plan';
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
SELECT count(*) FROM public.pm_kanban_ensure_project_stages(:'p1');
SELECT tt.eq((SELECT ("rowJSON"->>'stageProgressPercent')::int FROM public.project_kanban_stage_table WHERE "rowOwnerGUID" = :'p1' AND "rowJSON"->>'stageCode' = 'plan'), 45, 'the project copy has the percent of the catalog stage');
SELECT tt.eq((SELECT ("rowJSON"->>'stageProgressPercent')::int FROM public.project_kanban_stage_table WHERE "rowOwnerGUID" = :'p1' AND "rowJSON"->>'stageCode' = 'execute'), 90, 'also the others');
SELECT tt.eq((SELECT ("rowJSON"->>'stageProgressPercent')::int FROM public.project_kanban_stage_table WHERE "rowOwnerGUID" = :'p1' AND "rowJSON"->>'stageCode' = 'review'), 0, 'an own catalog stage: 0');
SELECT tt.eq((SELECT count(*)::int FROM public.project_kanban_stage_table WHERE "rowOwnerGUID" = :'p1' AND NOT ("rowJSON" ? 'stageProgressPercent')), 0, 'every project stage has a percent');

-- the changes of the catalog do not reach a project that has its stages
RESET ROLE;
SELECT tt.as_admin();
UPDATE public.kanban_stage_table SET "rowJSON" = "rowJSON" || '{"stageProgressPercent":15}' WHERE "rowGUID" = 't-plan';
SELECT tt.eq((SELECT ("rowJSON"->>'stageProgressPercent')::int FROM public.project_kanban_stage_table WHERE "rowOwnerGUID" = :'p1' AND "rowJSON"->>'stageCode' = 'plan'), 45, 'a project keeps its own percent when the catalog changes');

-- 5. the project owner edits the percent of a project stage; a new project stage without a percent gets 0; a wrong one is refused
SELECT tt.as_user('anna@acme.test', '11111111-1111-1111-1111-111111111111');
UPDATE public.project_kanban_stage_table SET "rowJSON" = "rowJSON" || '{"stageProgressPercent":55}' WHERE "rowOwnerGUID" = :'p1' AND "rowJSON"->>'stageCode' = 'plan';
SELECT tt.eq((SELECT ("rowJSON"->>'stageProgressPercent')::int FROM public.project_kanban_stage_table WHERE "rowOwnerGUID" = :'p1' AND "rowJSON"->>'stageCode' = 'plan'), 55, 'the owner changes the percent of a project stage');
INSERT INTO public.project_kanban_stage_table ("rowOwnerGUID", "orderInList", "rowJSON") VALUES (:'p1', 99000, '{"stageName":"Own column"}');
SELECT tt.eq((SELECT ("rowJSON"->>'stageProgressPercent')::int FROM public.project_kanban_stage_table WHERE "rowOwnerGUID" = :'p1' AND "rowJSON"->>'stageName' = 'Own column'), 0, 'a new project stage without a percent: 0');
SELECT tt.fails(format($q$UPDATE public.project_kanban_stage_table SET "rowJSON" = "rowJSON" || '{"stageProgressPercent":150}' WHERE "rowOwnerGUID" = %L$q$, :'p1'), 'stageProgressPercent must be', 'a project stage with 150 is refused');
ROLLBACK;
