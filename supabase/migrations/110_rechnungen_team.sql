-- Rechnungen & Angebote in der Medialyte-App: dieselben Tabellen wie bisher (Rechnungs-App), jetzt mit Team-Rechten.
-- Alle Daten gehören weiter dem Firmenkonto (bisheriger Besitzer); Team-Mitglieder mit dem Bereich „rechnungen“
-- sehen bzw. bearbeiten sie nach ihren Rechten (Zwei-Faktor wie überall in der App).
-- Die bisherigen Regeln „nur eigene Daten“ bleiben bestehen, damit die alte Rechnungs-App bis zum Abschalten weiterläuft.

-- Firmenkonto: Besitzer der Rechnungsdaten (Einstellungen), sonst der Inhaber
create or replace function public.firma_id() returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select s.user_id from public.settings s order by s.updated_at asc limit 1),
    (select m.user_id from public.mitglieder m where m.rolle = 'inhaber' and m.aktiv order by m.erstellt limit 1))
$$;
grant execute on function public.firma_id() to authenticated;

-- Neue Zeilen gehören automatisch dem Firmenkonto, egal wer im Team sie anlegt
create or replace function public.firma_user_id() returns uuid
language sql stable security definer set search_path = public as $$
  select case when public.darf('rechnungen', true) then coalesce(public.firma_id(), auth.uid()) else auth.uid() end
$$;
grant execute on function public.firma_user_id() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['settings', 'customers', 'recurring', 'invoices', 'quotes', 'products'] loop
    execute format('alter table public.%I alter column user_id set default public.firma_user_id()', t);
  end loop;
end $$;

-- Lesen: Bereich „rechnungen“; Schreiben: Schreibrecht „rechnungen“ (jeweils nur die Daten des Firmenkontos)
do $$
declare t text;
begin
  foreach t in array array['settings', 'customers', 'recurring', 'quotes', 'products'] loop
    execute format('drop policy if exists team_lesen on public.%I', t);
    execute format('create policy team_lesen on public.%I for select to authenticated using (user_id = public.firma_id() and public.darf(''rechnungen''))', t);
    execute format('drop policy if exists team_schreiben on public.%I', t);
    execute format('create policy team_schreiben on public.%I for all to authenticated using (user_id = public.firma_id() and public.darf(''rechnungen'', true)) with check (user_id = public.firma_id() and public.darf(''rechnungen'', true))', t);
  end loop;
end $$;

-- Rechnungen: wie bisher nur Entwürfe anlegen und löschen, Abschließen/Stornieren nur über den Server
drop policy if exists team_lesen on public.invoices;
create policy team_lesen on public.invoices for select to authenticated using (user_id = public.firma_id() and public.darf('rechnungen'));
drop policy if exists team_anlegen on public.invoices;
create policy team_anlegen on public.invoices for insert to authenticated
  with check (user_id = public.firma_id() and public.darf('rechnungen', true) and status = 'draft' and number is null);
drop policy if exists team_aendern on public.invoices;
create policy team_aendern on public.invoices for update to authenticated
  using (user_id = public.firma_id() and public.darf('rechnungen', true)) with check (user_id = public.firma_id() and public.darf('rechnungen', true));
drop policy if exists team_loeschen on public.invoices;
create policy team_loeschen on public.invoices for delete to authenticated
  using (user_id = public.firma_id() and public.darf('rechnungen', true) and status = 'draft');

drop policy if exists team_lesen on public.mail_log;
create policy team_lesen on public.mail_log for select to authenticated using (user_id = public.firma_id() and public.darf('rechnungen'));

-- Realtime: Änderungen anderer Team-Mitglieder (und der Abo-Automatik) sofort sehen
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['invoices', 'quotes', 'customers', 'recurring', 'products', 'settings'] loop
      begin execute format('alter publication supabase_realtime add table public.%I', t); exception when duplicate_object then null; end;
    end loop;
  end if;
end $$;
