-- Medialyte-App: Schalter für die einzelnen Agenten (Übersicht → „Agenten“)
-- Die Workflows im Repo website-agent fragen zu Beginn nach (agent/schalter.py). Aus = startet nicht mehr von selbst;
-- von Hand gestartet läuft er trotzdem. Akquise je Branche schaltet kategorien.aktiv.

do $$
begin
  -- Beim ersten Einspielen: Nur Gastronomie sucht wirklich; die übrigen Kategorien starten aus,
  -- bis ihre Demo-Vorlagen fertig sind (Etappe 3). Danach entscheidet allein der Schalter.
  if to_regclass('public.agenten') is null then
    update public.kategorien set aktiv = false where slug <> 'gastronomie';
    update public.kategorien set suche = suche || '{"bereit": true}'::jsonb where slug = 'gastronomie';
  end if;
end $$;

create table if not exists public.agenten (
  schluessel   text primary key,
  name         text not null,
  beschreibung text,
  rhythmus     text,
  icon         text not null default 'refresh',
  sortierung   int not null default 100,
  aktiv        boolean not null default true,
  geaendert    timestamptz not null default now(),
  geaendert_von uuid references auth.users(id) on delete set null
);

insert into public.agenten (schluessel, name, beschreibung, rhythmus, icon, sortierung) values
  ('briefe', 'Brief-Agent', 'Bereitet im Wochenlauf zu jeder neuen Demo einen Brief vor. Verschickt wird nur, was du einzeln freigibst.', 'mit dem Wochenlauf', 'letter', 10),
  ('nachfass', 'Nachfass-Agent', 'Erinnert werktags an fällige Anrufe bei Betrieben, die einen Brief bekommen haben.', 'werktags morgens', 'phone', 20),
  ('website', 'Website-Agent', 'Setzt Änderungswünsche deiner Kunden aus dem Tischbuch-Chat um. Aus: neue Wünsche bleiben liegen, Übernehmen und Zurücknehmen funktioniert weiter.', 'bei jeder Kundennachricht', 'globe', 30),
  ('kunden', 'Kunden-Agent', 'Prüft, ob die Domains der Kunden-Websites aktiv sind. Aufträge aus dem Cockpit erledigt er auch, wenn er aus ist.', 'alle 3 Stunden', 'users', 40),
  ('lagebericht', 'Lagebericht', 'Schreibt jeden Morgen den Lagebericht und spricht ihn mit Helmuts Stimme ein (Anthropic und ElevenLabs).', 'täglich morgens', 'note', 50)
on conflict (schluessel) do update set name = excluded.name, beschreibung = excluded.beschreibung, rhythmus = excluded.rhythmus,
  icon = excluded.icon, sortierung = excluded.sortierung;

create or replace function public.agent_geaendert() returns trigger language plpgsql as $$
begin new.geaendert = now(); new.geaendert_von = auth.uid(); return new; end $$;
drop trigger if exists agenten_geaendert on public.agenten;
create trigger agenten_geaendert before update on public.agenten for each row execute function public.agent_geaendert();

alter table public.agenten enable row level security;
drop policy if exists agenten_lesen on public.agenten;
create policy agenten_lesen on public.agenten for select to authenticated using (public.darf('akquise') or public.darf('einstellungen'));
-- Schalten darf, wer Einstellungen ändern darf (Standard: Inhaber); nur der Schalter selbst ist änderbar
drop policy if exists agenten_schalten on public.agenten;
create policy agenten_schalten on public.agenten for update to authenticated
  using (public.darf('einstellungen', true)) with check (public.darf('einstellungen', true));
revoke update on public.agenten from authenticated;
grant update (aktiv) on public.agenten to authenticated;
