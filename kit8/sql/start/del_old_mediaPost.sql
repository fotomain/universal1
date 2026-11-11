-- ===============================================================================================
-- UNIVERSAL1 - del_old_mediaPost.sql: removes the OLD media posts that have no real author (one time, 2026-11-11).
--   * public."mediaPostTable" and public."mediaPostTableArchive": the rows whose rowOwnerGUID is NOT the GUID of a user (public."userTable"."rowGUID").
--     That is the demo id the media post CRUD screen wrote (111459c1-...), the value 'anon' a recording got when nobody was signed in, and other test rows.
-- Why: the file attachments plan (documentation/FILE_ATTACHMENT_WBS.html, section 12) makes a media post outside a project visible to its AUTHOR only
--   (rowOwnerGUID = the signed-in user). A row with no real author would be seen by nobody and would only stay as dead data.
-- NEVER deleted: the rows of a user (they stay visible to their author) and the FILE rows (rowJSON has the key fileSourceKind, made by the file attachments feature).
-- Switch: v_delete_all := true below also deletes the posts of REAL users (all non-file rows). Default false.
-- Run it in the Supabase SQL Editor. IRREVERSIBLE: the deleted rows are lost (make a backup of the two tables first if in doubt). Safe to run twice and on a database
-- that has no such table or no such rows (it only prints NOTICEs).
-- ===============================================================================================

DO $$
DECLARE
  v_delete_all boolean := false;   -- true = ALSO the posts of real users (every row without fileSourceKind)
  t text;
  v_total bigint;
  v_deleted bigint;
  v_kept_users bigint;
  v_has_users boolean := to_regclass('public."userTable"') IS NOT NULL;
BEGIN
  FOREACH t IN ARRAY ARRAY['mediaPostTable', 'mediaPostTableArchive'] LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE NOTICE 'del_old_mediaPost: % does not exist - nothing to do', t;
      CONTINUE;
    END IF;
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO v_total;

    IF v_delete_all OR NOT v_has_users THEN
      -- without a userTable nobody is a real author; with the switch everybody's posts go
      EXECUTE format($q$DELETE FROM public.%I WHERE NOT ("rowJSON" ? 'fileSourceKind')$q$, t);
    ELSE
      EXECUTE format($q$DELETE FROM public.%I m
                         WHERE NOT (m."rowJSON" ? 'fileSourceKind')
                           AND NOT EXISTS (SELECT 1 FROM public."userTable" u WHERE u."rowGUID" = m."rowOwnerGUID")$q$, t);
    END IF;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE 'del_old_mediaPost: % had % row(s), % deleted, % kept', t, v_total, v_deleted, v_total - v_deleted;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- Check (the first must be 0 unless v_delete_all was set; the posts of real users stay):
--   SELECT count(*) FROM public."mediaPostTable" m WHERE NOT (m."rowJSON" ? 'fileSourceKind')
--     AND NOT EXISTS (SELECT 1 FROM public."userTable" u WHERE u."rowGUID" = m."rowOwnerGUID");
--   SELECT "rowOwnerGUID", count(*) FROM public."mediaPostTable" GROUP BY 1;
