-- Minimale Nachbildung von Supabase für lokale Tests
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
create publication supabase_realtime;
insert into auth.users (id, email, created_at) values
  ('00000000-0000-0000-0000-00000000000d', 'info@medialyte.de', now() - interval '30 days'),
  ('00000000-0000-0000-0000-0000000000f1', 'finn@example.org', now()),
  ('00000000-0000-0000-0000-0000000000a1', 'aurelia@example.org', now()),
  ('00000000-0000-0000-0000-0000000000ff', 'fremd@example.org', now());
