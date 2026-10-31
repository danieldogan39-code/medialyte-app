-- GoBD für Rechnungen: Unveränderbarkeit, Aufbewahrung, Protokoll, Original-Belege
--
-- 1. Ausgestellte Rechnungen werden nie physisch gelöscht (§ 147 AO: 8 Jahre Aufbewahrung, lückenlose Nummern).
--    „Löschen“ in der App blendet sie aus: sie bleiben gespeichert, unverändert und im Prüfer-Export.
-- 2. Jede Änderung an Rechnungen, Angeboten, Kunden und Firmendaten landet in einem Protokoll, das niemand
--    ändern oder löschen kann (Nachvollziehbarkeit, Unveränderbarkeit nach § 146 Abs. 4 AO).
-- 3. Das PDF wird beim Abschließen als Original-Beleg mit Prüfsumme abgelegt (Bucket „belege“) und danach
--    immer so ausgeliefert, wie es ausgestellt wurde – auch wenn sich später Logo oder Firmendaten ändern.

alter table public.invoices add column if not exists ausgeblendet_am timestamptz;
alter table public.invoices add column if not exists ausgeblendet_grund text;
alter table public.invoices add column if not exists beleg_pfad text;
alter table public.invoices add column if not exists beleg_sha256 text;
alter table public.invoices add column if not exists beleg_am timestamptz;
alter table public.invoices add column if not exists beleg_nachtraeglich boolean not null default false;
alter table public.invoices add column if not exists zuletzt_von uuid;
alter table public.quotes add column if not exists ausgeblendet_am timestamptz;
alter table public.quotes add column if not exists zuletzt_von uuid;

-- Unveränderbarkeit ausgestellter Rechnungen (ergänzt um Original-Beleg und Ausblenden)
create or replace function public.protect_issued_invoice()
returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' then
    if old.status = 'draft' and new.status <> 'draft' then
      raise exception 'Rechnungen werden über die App-Funktion „Abschließen“ ausgestellt.';
    end if;
    if new.status = 'cancelled' and old.status <> 'cancelled' then
      raise exception 'Stornieren bitte über die App-Funktion „Stornieren“.';
    end if;
    if old.status = 'cancelled' and new.status <> 'cancelled' then
      raise exception 'Stornierte Rechnungen können nicht wieder geöffnet werden.';
    end if;
    if new.beleg_pfad is distinct from old.beleg_pfad or new.beleg_sha256 is distinct from old.beleg_sha256
       or new.beleg_am is distinct from old.beleg_am or new.beleg_nachtraeglich is distinct from old.beleg_nachtraeglich then
      raise exception 'Der Original-Beleg wird nur vom Server abgelegt.';
    end if;
  end if;
  if old.status = 'draft' and new.ausgeblendet_am is not null then
    raise exception 'Entwürfe werden gelöscht, nicht ausgeblendet.';
  end if;
  if old.status <> 'draft' then
    if new.status = 'draft'
       or new.number is distinct from old.number
       or new.kind is distinct from old.kind
       or new.items is distinct from old.items
       or new.customer is distinct from old.customer
       or new.issue_date is distinct from old.issue_date
       or new.due_date is distinct from old.due_date
       or new.service_text is distinct from old.service_text
       or new.net is distinct from old.net
       or new.vat is distinct from old.vat
       or new.gross is distinct from old.gross
       or new.intro is distinct from old.intro
       or new.notes is distinct from old.notes
       or new.user_id is distinct from old.user_id
       or new.created_at is distinct from old.created_at
       or new.imported is distinct from old.imported
       or (new.ref_invoice_id is distinct from old.ref_invoice_id and new.ref_invoice_id is not null) then
      raise exception 'Ausgestellte Rechnungen können nicht geändert werden. Bitte die Korrektur-Funktion nutzen.';
    end if;
    -- ein abgelegter Original-Beleg bleibt, wie er ist (auch für den Server)
    if old.beleg_pfad is not null and (new.beleg_pfad is distinct from old.beleg_pfad or new.beleg_sha256 is distinct from old.beleg_sha256) then
      raise exception 'Der Original-Beleg einer Rechnung kann nicht ersetzt werden.';
    end if;
  end if;
  return new;
end $$;

-- Löschen: nur Entwürfe – für alle, auch für den Server und beim Löschen eines Kontos
create or replace function public.rechnung_nicht_loeschen()
returns trigger language plpgsql as $$
begin
  if old.status <> 'draft' then
    raise exception 'Ausgestellte Rechnungen müssen aufbewahrt werden (GoBD) und können nicht gelöscht werden. Stornieren oder ausblenden.';
  end if;
  return old;
end $$;
drop trigger if exists invoices_nicht_loeschen on public.invoices;
create trigger invoices_nicht_loeschen before delete on public.invoices
  for each row execute function public.rechnung_nicht_loeschen();

drop policy if exists team_loeschen on public.invoices;
create policy team_loeschen on public.invoices for delete to authenticated
  using (user_id = public.firma_id() and public.darf('rechnungen', true) and status = 'draft');

-- Verschickte oder angenommene Angebote sind Handelsbriefe (6 Jahre): nicht löschen, nur ausblenden
create or replace function public.angebot_nicht_loeschen()
returns trigger language plpgsql as $$
begin
  if old.status <> 'draft' then
    raise exception 'Verschickte Angebote müssen aufbewahrt werden (GoBD) und können nicht gelöscht werden. Ausblenden statt löschen.';
  end if;
  return old;
end $$;
drop trigger if exists quotes_nicht_loeschen on public.quotes;
create trigger quotes_nicht_loeschen before delete on public.quotes
  for each row execute function public.angebot_nicht_loeschen();

-- Änderungsprotokoll: nur anhängen, nie ändern oder löschen
create table if not exists public.beleg_protokoll (
  id          bigint generated always as identity primary key,
  zeit        timestamptz not null default clock_timestamp(),
  tabelle     text not null,
  datensatz   uuid,
  nummer      text,
  aktion      text not null check (aktion in ('angelegt', 'geaendert', 'geloescht')),
  wer         uuid,
  aenderungen jsonb not null default '{}'::jsonb,
  firma       uuid
);
create index if not exists beleg_protokoll_datensatz_idx on public.beleg_protokoll (datensatz, zeit);
alter table public.beleg_protokoll enable row level security;
drop policy if exists protokoll_lesen on public.beleg_protokoll;
create policy protokoll_lesen on public.beleg_protokoll for select to authenticated
  using (firma = public.firma_id() and public.darf('rechnungen'));
revoke insert, update, delete, truncate on public.beleg_protokoll from anon, authenticated;

create or replace function public.protokoll_unveraenderlich()
returns trigger language plpgsql as $$
begin
  raise exception 'Das Änderungsprotokoll kann nicht geändert oder gelöscht werden.';
end $$;
drop trigger if exists beleg_protokoll_fest on public.beleg_protokoll;
create trigger beleg_protokoll_fest before update or delete on public.beleg_protokoll
  for each row execute function public.protokoll_unveraenderlich();

create or replace function public.beleg_protokollieren()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  n jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  diff jsonb := '{}'::jsonb;
  k text;
  zeile jsonb := case when tg_op = 'DELETE' then a else n end;
begin
  -- das Logo (Bild als Text) nicht jedes Mal mitschreiben: Prüfsumme genügt, um eine Änderung zu belegen
  if tg_table_name = 'settings' then
    if a -> 'company' ? 'logo' then a := jsonb_set(a, '{company,logo}', to_jsonb(md5(a -> 'company' ->> 'logo'))); end if;
    if n -> 'company' ? 'logo' then n := jsonb_set(n, '{company,logo}', to_jsonb(md5(n -> 'company' ->> 'logo'))); end if;
    zeile := case when tg_op = 'DELETE' then a else n end;
  end if;
  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(n) loop
      if k not in ('updated_at') and (a -> k) is distinct from (n -> k) then
        diff := diff || jsonb_build_object(k, jsonb_build_object('alt', a -> k, 'neu', n -> k));
      end if;
    end loop;
    if diff = '{}'::jsonb then return new; end if;
  else
    diff := zeile;
  end if;
  insert into public.beleg_protokoll (tabelle, datensatz, nummer, aktion, wer, aenderungen, firma)
  values (tg_table_name,
          nullif(zeile ->> 'id', '')::uuid,
          zeile ->> 'number',
          case tg_op when 'INSERT' then 'angelegt' when 'UPDATE' then 'geaendert' else 'geloescht' end,
          coalesce(auth.uid(), nullif(zeile ->> 'zuletzt_von', '')::uuid),
          diff,
          nullif(zeile ->> 'user_id', '')::uuid);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['invoices', 'quotes', 'customers', 'settings'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_protokoll', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.beleg_protokollieren()', t || '_protokoll', t);
  end loop;
end $$;

-- Original-Belege: privater Speicher, schreiben nur der Server, lesen mit Bereich „rechnungen“
insert into storage.buckets (id, name, public, file_size_limit)
values ('belege', 'belege', false, 10485760)
on conflict (id) do update set public = false;
drop policy if exists belege_lesen on storage.objects;
create policy belege_lesen on storage.objects for select to authenticated
  using (bucket_id = 'belege' and public.darf('rechnungen'));
