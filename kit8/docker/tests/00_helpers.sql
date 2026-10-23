-- helpers of the behaviour tests (test_time_genus.sh pipes this before every tests/NN_*.sql). Everything lives in the schema tt, created and dropped by the runner.
CREATE SCHEMA IF NOT EXISTS tt;
GRANT USAGE ON SCHEMA tt TO authenticated, anon;

-- act as a signed-in user (the stub auth.jwt() / auth.uid() read these settings) - until the end of the transaction
CREATE OR REPLACE FUNCTION tt.as_user(p_email text, p_sub uuid DEFAULT gen_random_uuid()) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('email', p_email, 'sub', p_sub)::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_sub::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
END $$;

-- act as the SQL editor / service key (no session)
CREATE OR REPLACE FUNCTION tt.as_admin() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;

CREATE OR REPLACE FUNCTION tt.eq(p_actual anyelement, p_expected anyelement, p_what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_actual IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'TEST FAILED: % - expected [%] got [%]', p_what, p_expected, p_actual; END IF;
  RAISE NOTICE 'ok: %', p_what;
END $$;

-- the statement must fail and its message must contain p_like
CREATE OR REPLACE FUNCTION tt.fails(p_sql text, p_like text, p_what text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF position(lower(p_like) IN lower(SQLERRM)) = 0 THEN
      RAISE EXCEPTION 'TEST FAILED: % - failed with [%] which does not contain [%]', p_what, SQLERRM, p_like;
    END IF;
    RAISE NOTICE 'ok: % (refused: %)', p_what, left(SQLERRM, 80);
    RETURN;
  END;
  RAISE EXCEPTION 'TEST FAILED: % - the statement was accepted: %', p_what, p_sql;
END $$;

-- a Time line of a task for a resource, and Post of ONE task, for the tests that need them
-- a Time line of a task for a resource: returns its GUID
CREATE OR REPLACE FUNCTION tt.line(p_task uuid, p_kind text, p_resource text, p_unit text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.task_line_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON")
  VALUES (v, p_task, 'timeGenus', jsonb_strip_nulls(jsonb_build_object('taskResourceKind', p_kind, 'taskResourceItem', p_resource, 'measureUnitTaskLine', p_unit)));
  RETURN v;
END $$;
-- post ONE task: p_lines = [{"line": "<uuid>", "days": {"2026-10-14": 8, "2026-10-15": 4}}]; the coefficients are the shares of the hours
CREATE OR REPLACE FUNCTION tt.post(p_task uuid, p_lines jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  l jsonb; v_lines jsonb := '[]'::jsonb; v_total numeric; v_days jsonb;
BEGIN
  FOR l IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    SELECT sum(value::numeric) INTO v_total FROM jsonb_each_text(l->'days');
    SELECT jsonb_agg(jsonb_build_object('d', key, 'c', round(value::numeric / v_total, 10)) ORDER BY key) INTO v_days FROM jsonb_each_text(l->'days');
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('lineGUID', l->>'line', 'qtyTaskLine', v_total, 'sumForBudget', v_total * 10, 'sumForContract', v_total * 10, 'baseOfDistribution', 1, 'days', v_days));
  END LOOP;
  RETURN public.create_task_line_plan(jsonb_build_object('taskGUID', p_task, 'timeZone', 'Europe/Riga', 'lines', v_lines));
END $$;

-- the number of rows a DML statement touched (an RLS policy filters silently: UPDATE / DELETE of a row you may not touch is 0 rows, not an error)
CREATE OR REPLACE FUNCTION tt.rows_of(p_sql text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE p_sql; GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;
