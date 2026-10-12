-- What a plain Postgres lacks and the app SQL expects from Supabase: roles, auth/extensions schemas, auth.uid() / role() / jwt(), auth.users, realtime publication.
-- Roles are cluster-wide, so this runs once (first start of the container); every test database is created from it by test_sql.sh via the template "supabase_stub".
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;

CREATE DATABASE supabase_stub;
\connect supabase_stub

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS ltree;

CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, raw_user_meta_data jsonb);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;

CREATE PUBLICATION supabase_realtime;

GRANT USAGE ON SCHEMA public, auth, extensions TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO anon, authenticated, service_role;
