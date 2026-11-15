-- Organizer: Fahrtregeln – für Termine, deren Titel oder Ort ein Stichwort enthält (z. B. „Billstedt“, „Kirche“),
-- wird Hin- und Rückweg mit der angegebenen Dauer freigehalten. [{"muster": "Billstedt", "min": 45}, …]
alter table public.org_einstellungen add column if not exists fahrt_regeln jsonb not null default '[]'::jsonb;
do $$ begin
  alter table public.org_einstellungen add constraint org_einst_fahrt_regeln_chk check (jsonb_typeof(fahrt_regeln) = 'array' and jsonb_array_length(fahrt_regeln) <= 30);
exception when duplicate_object then null; end $$;
