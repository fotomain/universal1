-- PART 58: the ESTIMATION DASHBOARD tables (estimation_*): the norm book tree (world -> continent -> country -> book), norms / resources of a book, the estimate document + line tables of a project,
-- permissionEstimationManager (organization administrator, project manager, application administrator, or given by hand), the read-only project, the delete of a project.
BEGIN;
SELECT tt.as_admin();

-- the seeds of start4: World Norms (v2) -> 6 continents -> Russia
SELECT tt.eq((SELECT count(*) FROM public.estimation_norm_book_catalog)::int, 8, 'start4 seeded world + 6 continents + Russia');
SELECT tt.eq((SELECT "rowJSON"->>'title' FROM public.estimation_norm_book_catalog WHERE "rowGUID" = 'estWorldNorms2'), 'World Norms (v2)', 'the main node is World Norms (v2)');
SELECT tt.eq((SELECT count(*) FROM public.estimation_norm_book_catalog WHERE "rowParentGUID" = 'estWorldNorms2')::int, 6, 'six continents under the world');

SELECT public.organization_ensure_user('boris@acme.test', '22222222-2222-2222-2222-222222222222', 'Boris', 'B') AS boris \gset
SELECT :'boris'::jsonb->>'organizationGUID' AS orga \gset
SELECT public.organization_ensure_user('clara@acme.test', '33333333-3333-3333-3333-333333333333', 'Clara', 'C');
SELECT public.organization_ensure_user('outsider@other.test', '44444444-4444-4444-4444-444444444444', 'Out', 'S');
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT public.organization_invite_user('clara@acme.test');
SELECT tt.as_user('clara@acme.test', '33333333-3333-3333-3333-333333333333');
SELECT public.organization_switch(:'orga');

-- 1. the organization administrator holds the right and writes the catalogs
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.eq(public.permission_estimation_manager(), true, 'the organization administrator has permissionEstimationManager');
SELECT tt.eq((public.perm_my_matrix()->>'canManageEstimation'), 'true', 'perm_my_matrix: canManageEstimation true');
SELECT tt.eq(((public.perm_my_matrix()->'profiles') ? 'permissionEstimationManager'), true, '... and the permission is listed');
INSERT INTO public.estimation_norm_book_catalog ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('book-ru', 'estimationCatalog', 'estCountryRU', '{"nodeKind": "book", "code": "FSNB-2022", "title": "FSNB-2022", "currency": "EUR", "sourceCurrency": "RUB"}');
SELECT tt.fails($q$INSERT INTO public.estimation_norm_book_catalog ("rowGUID", "rowParentGUID", "rowJSON") VALUES ('c-x', 'book-ru', '{"nodeKind": "country", "title": "X"}')$q$, 'cannot be placed', 'a country goes under a continent');
SELECT tt.fails($q$INSERT INTO public.estimation_norm_book_catalog ("rowGUID", "rowParentGUID", "rowJSON") VALUES ('c-y', 'estWorldNorms2', '{"nodeKind": "planet", "title": "Y"}')$q$, 'nodeKind', 'an unknown node kind is refused');
SELECT tt.fails($q$INSERT INTO public.estimation_norm_book_catalog ("rowGUID", "rowParentGUID", "rowJSON") VALUES ('c-z', 'no-such-node', '{"nodeKind": "continent", "title": "Z"}')$q$, 'parent', 'the parent must exist');
INSERT INTO public.estimation_norm_catalog ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('sec1', 'book-ru', 'empty', '{"nodeKind": "section", "code": "01", "title": "Earthworks"}'),
  ('norm1', 'book-ru', 'sec1', '{"nodeKind": "norm", "code": "01-01-001-01", "title": "Excavation, soil group 1", "unit": "1000 m3", "resources": [{"code": "1-100-38", "qty": 1.54}]}');
INSERT INTO public.estimation_resource_catalog ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('res1', 'book-ru', 'empty', '{"nodeKind": "resource", "code": "01.1.01.01-0002", "title": "Ridge fittings", "unit": "100 sets", "price": 35537.67, "currency": "RUB"}');
SELECT tt.fails($q$INSERT INTO public.estimation_norm_catalog ("rowOwnerGUID", "rowJSON") VALUES ('book-ru', '{"nodeKind": "norm", "code": "01-01-001-01", "title": "same code again"}')$q$, 'uq_estimation_norm_code', 'a norm code is unique inside a book');
SELECT tt.fails($q$INSERT INTO public.estimation_norm_catalog ("rowOwnerGUID", "rowJSON") VALUES ('no-book', '{"nodeKind": "norm", "code": "X-1", "title": "x"}')$q$, 'norm BOOK', 'a norm belongs to a book of the tree');
SELECT tt.fails($q$INSERT INTO public.estimation_norm_catalog ("rowOwnerGUID", "rowJSON") VALUES ('book-ru', '{"nodeKind": "norm", "title": "no code"}')$q$, 'code', 'a norm needs its code');
SELECT tt.fails($q$INSERT INTO public.estimation_norm_catalog ("rowOwnerGUID", "rowJSON") VALUES ('estWorldNorms2', '{"nodeKind": "section", "code": "9", "title": "x"}')$q$, 'norm BOOK', 'a node that is not a book owns no norms');
-- the translation of a norm title (PART 56) is the way the other languages are stored
INSERT INTO public."catalogTranslationTable" ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('norm1', 'ru', '{"translationField": "title", "translationText": "Разработка грунта, группа 1"}');
SELECT tt.eq((SELECT count(*) FROM public."catalogTranslationTable" WHERE "rowOwnerGUID" = 'norm1')::int, 1, 'the Russian original is stored as a translation of the norm');

-- 2. a project of boris and its estimate document + lines
SELECT tt.as_admin();
SELECT gen_random_uuid() AS pj \gset
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (:'pj', public.pm_ltree_label(:'pj'::uuid), '22222222-2222-2222-2222-222222222222', :'orga', '{"name": "Estimate P2"}');
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
INSERT INTO public.estimation_document_table ("rowGUID", "rowOwnerGUID", "rowJSON") VALUES ('doc1', :'pj', '{"docKind": "local", "cipher": "LS-01-01-01", "method": "baseIndex", "currencyForBudget": "EUR", "currencyForAccounting": "EUR", "currencyForConsolidation": "USD"}');
SELECT tt.fails($q$INSERT INTO public.estimation_document_table ("rowOwnerGUID", "rowJSON") VALUES ('not-a-uuid', '{"docKind": "local"}')$q$, 'project', 'the owner of a document is a project GUID');
SELECT tt.fails(format($q$INSERT INTO public.estimation_document_table ("rowOwnerGUID", "rowJSON") VALUES (%L, '{"docKind": "sketch"}')$q$, :'pj'), 'docKind', 'an unknown document kind is refused');
INSERT INTO public.estimation_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('l-sec', :'pj', 'empty', '{"documentGUID": "doc1", "lineKind": "section", "title": "Section 1. Earthworks"}');
INSERT INTO public.estimation_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES
  ('l-pos', :'pj', 'l-sec', '{"documentGUID": "doc1", "lineKind": "position", "normCode": "01-01-001-01", "qty": 0.84, "sumForBudget": 4044.6, "sumForAccounting": 4044.6, "sumForConsolidation": 4400.12}');
SELECT tt.eq((SELECT count(*) FROM public.estimation_line_table WHERE "rowOwnerGUID" = :'pj')::int, 2, 'the owner writes a section and a position');
SELECT tt.fails(format($q$INSERT INTO public.estimation_line_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (%L, 'empty', '{"documentGUID": "no-doc", "lineKind": "position"}')$q$, :'pj'), 'documentGUID', 'a line needs a document of the same project');
SELECT tt.fails(format($q$INSERT INTO public.estimation_line_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (%L, 'no-parent', '{"documentGUID": "doc1", "lineKind": "position"}')$q$, :'pj'), 'parent line', 'the parent line must exist');
SELECT tt.fails(format($q$INSERT INTO public.estimation_line_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (%L, 'empty', '{"documentGUID": "doc1", "lineKind": "chapter"}')$q$, :'pj'), 'lineKind', 'an unknown line kind is refused');
SELECT tt.fails(format($q$INSERT INTO public.estimation_line_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (%L, 'empty', '{"documentGUID": "doc1", "lineKind": "position", "sumForConsolidation": "much"}')$q$, :'pj'), 'must be a number', 'the money in each currency is a number');

-- 3. clara (no right, not the owner) cannot see or write the project data, nor the catalogs
SELECT tt.as_user('clara@acme.test', '33333333-3333-3333-3333-333333333333');
SELECT tt.eq(public.permission_estimation_manager(), false, 'a plain member has no permissionEstimationManager');
SELECT tt.eq((public.perm_my_matrix()->>'canManageEstimation'), 'false', 'perm_my_matrix: canManageEstimation false');
SELECT tt.eq((SELECT count(*) FROM public.estimation_line_table)::int, 0, 'she does not read the lines of a project she cannot read');
SELECT tt.eq((SELECT count(*) FROM public.estimation_norm_catalog)::int, 2, 'she reads the shared norm book (the section + the norm)');
SELECT tt.fails($q$INSERT INTO public.estimation_norm_catalog ("rowOwnerGUID", "rowJSON") VALUES ('book-ru', '{"nodeKind": "norm", "code": "X-2", "title": "x"}')$q$, 'row-level security', 'she writes no norm');
SELECT tt.eq(tt.rows_of($q$DELETE FROM public.estimation_norm_catalog WHERE "rowGUID" = 'norm1'$q$), 0::bigint, 'she deletes no norm');

-- 4. the administrator GIVES her the right: it is listed, and she writes the catalogs (not the project data of a project she cannot read)
SELECT tt.as_admin();
INSERT INTO public.project_permission_profile_user_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (:'orga', '33333333-3333-3333-3333-333333333333', '{"permissionProfileGUID": "permissionEstimationManager"}');
SELECT tt.as_user('clara@acme.test', '33333333-3333-3333-3333-333333333333');
SELECT tt.eq(public.permission_estimation_manager(), true, 'given by hand: clara manages estimation');
INSERT INTO public.estimation_norm_catalog ("rowGUID", "rowOwnerGUID", "rowJSON") VALUES ('norm2', 'book-ru', '{"nodeKind": "norm", "code": "X-2", "title": "second norm"}');
SELECT tt.eq((SELECT count(*) FROM public.estimation_norm_catalog)::int, 3, 'she writes a norm now');
SELECT tt.fails(format($q$INSERT INTO public.estimation_line_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (%L, 'empty', '{"documentGUID": "doc1", "lineKind": "section"}')$q$, :'pj'), 'estimation_line_table', 'the right alone does not open the project of somebody else (she does not even see its document)');

-- 5. an outsider of another organization sees nothing of the project and writes no catalog row
SELECT tt.as_user('outsider@other.test', '44444444-4444-4444-4444-444444444444');
SELECT tt.eq(public.permission_estimation_manager(), true, 'the administrator of his own organization holds the right too (catalogs are shared)');
SELECT tt.eq((SELECT count(*) FROM public.estimation_document_table)::int, 0, 'he does not read the documents of another organization');
SELECT tt.eq(tt.rows_of(format($q$UPDATE public.estimation_line_table SET "rowJSON" = '{"documentGUID": "doc1", "lineKind": "section"}' WHERE "rowOwnerGUID" = %L$q$, :'pj')), 0::bigint, 'he changes no line of that project');

-- 6. a read-only project accepts no new line, not even from the owner
SELECT tt.as_admin();
UPDATE public.project_table SET "rowJSON" = "rowJSON" || '{"projectIsReadonly": true}' WHERE "rowGUID" = :'pj';
SELECT tt.as_user('boris@acme.test', '22222222-2222-2222-2222-222222222222');
SELECT tt.fails(format($q$INSERT INTO public.estimation_line_table ("rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES (%L, 'empty', '{"documentGUID": "doc1", "lineKind": "section"}')$q$, :'pj'), 'row-level security', 'a read-only project takes no new line');
SELECT tt.eq((SELECT count(*) FROM public.estimation_line_table WHERE "rowOwnerGUID" = :'pj')::int, 2, '... he still reads them');
SELECT tt.as_admin();
UPDATE public.project_table SET "rowJSON" = "rowJSON" - 'projectIsReadonly' WHERE "rowGUID" = :'pj';

-- 7. a deleted project takes its estimate data with it
DELETE FROM public.project_table WHERE "rowGUID" = :'pj';
SELECT tt.eq((SELECT count(*) FROM public.estimation_line_table WHERE "rowOwnerGUID" = :'pj')::int, 0, 'the lines of a deleted project are gone');
SELECT tt.eq((SELECT count(*) FROM public.estimation_document_table WHERE "rowOwnerGUID" = :'pj')::int, 0, 'the documents too');

SELECT 'ESTIMATION DASHBOARD (PART 58): all checks passed' AS result;
ROLLBACK;
