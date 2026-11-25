-- PART 58: the search of the norm books (code / title contains the text, over ALL books) runs on the trigram indexes of start1,
-- (the app sends NO order by: with one the database must find every match before the first 60, the timeout of a common start like "Разр"; Start = `text%`)
-- not on a scan of every norm row (Supabase: "canceling statement due to statement timeout" at 8 s).
BEGIN;
SELECT tt.as_admin();
SELECT tt.eq((SELECT count(*) FROM pg_indexes WHERE tablename = 'estimation_norm_catalog' AND indexname IN ('idx_estimation_norm_code_trgm', 'idx_estimation_norm_title_trgm'))::int, 2, 'the two trigram indexes of the norm search exist');
INSERT INTO public.estimation_norm_book_catalog ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('book-ns', 'estimationCatalog', 'estCountryRU', '{"nodeKind": "book", "code": "NS", "title": "NS", "currency": "EUR", "sourceCurrency": "RUB"}');
INSERT INTO public.estimation_norm_catalog ("rowOwnerGUID", "rowParentGUID", "rowJSON", "orderInList")
  SELECT 'book-ns', 'empty', jsonb_build_object('nodeKind', 'norm', 'code', 'N' || g, 'title', 'Norm number ' || g), g FROM generate_series(1, 20000) g;
INSERT INTO public.estimation_norm_catalog ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('book-ns', 'empty', '{"nodeKind": "norm", "code": "R1", "title": "Разработка грунта"}');
ANALYZE public.estimation_norm_catalog;
CREATE TEMP TABLE norm_plan (line text);
-- 20 000 rows are too few for the planner to prefer an index over a scan (a real book has far more): forbid the scan. Before the fix the planner still took the btree index of orderInList (ORDER BY orderInList = a walk of the whole table); ordering by the code leaves it only the trigram indexes
SET LOCAL enable_seqscan = off;
DO $$
DECLARE r text;
BEGIN
  FOR r IN EXECUTE $q$EXPLAIN SELECT * FROM public.estimation_norm_catalog WHERE "rowJSON"->>'nodeKind' = 'norm' AND ("rowJSON"->>'code' ILIKE 'Разрабо%' OR "rowJSON"->>'title' ILIKE 'Разрабо%') LIMIT 60$q$ LOOP
    INSERT INTO norm_plan VALUES (r);
  END LOOP;
END $$;
SELECT tt.eq((SELECT bool_or(line ILIKE '%trgm%') FROM norm_plan), true, 'the plan of the norm search uses the trigram indexes');
SELECT tt.eq((SELECT count(*) FROM public.estimation_norm_catalog WHERE "rowJSON"->>'nodeKind' = 'norm' AND ("rowJSON"->>'code' ILIKE 'Разрабо%' OR "rowJSON"->>'title' ILIKE 'Разрабо%'))::int, 1, 'the Cyrillic search (Start) finds the norm');
SELECT tt.eq((SELECT count(*) FROM public.estimation_norm_catalog WHERE "rowJSON"->>'nodeKind' = 'norm' AND ("rowJSON"->>'code' ILIKE '%грунта' OR "rowJSON"->>'title' ILIKE '%грунта'))::int, 1, 'the Cyrillic search (Finished) finds the norm');
SELECT 'NORM SEARCH (PART 58): all checks passed' AS result;
ROLLBACK;
