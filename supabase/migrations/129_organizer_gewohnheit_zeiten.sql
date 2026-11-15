-- Gewohnheiten: eigene Uhrzeit je Wochentag (z. B. Training Mo/Mi 17:00, Sa 11:30). Schlüssel "1"–"7" (Mo–So), Wert "HH:MM".
alter table public.org_gewohnheiten add column if not exists zeiten jsonb not null default '{}'::jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'org_gewohnheiten_zeiten_check') then
    alter table public.org_gewohnheiten add constraint org_gewohnheiten_zeiten_check check (jsonb_typeof(zeiten) = 'object' and octet_length(zeiten::text) < 400);
  end if;
end $$;
