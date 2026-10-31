-- Rechnungen löschen: nicht nur Entwürfe, sondern jede einzelne Rechnung (offen, bezahlt, storniert, Stornorechnung).
-- Wer im Team das Schreibrecht „Rechnungen“ hat, darf löschen. Verweise anderer Belege auf die gelöschte Rechnung
-- (Storno, Ersatzrechnung, Angebot, Mail-Protokoll) werden dabei aufgelöst statt das Löschen zu blockieren.

-- Verweis „Bezug auf Original“ darf beim Löschen des Originals geleert werden
do $$
declare k text;
begin
  for k in select conname from pg_constraint
           where conrelid = 'public.invoices'::regclass and contype = 'f'
             and conkey = array[(select attnum from pg_attribute where attrelid = 'public.invoices'::regclass and attname = 'ref_invoice_id')]::smallint[]
  loop
    execute format('alter table public.invoices drop constraint %I', k);
  end loop;
end $$;
alter table public.invoices add constraint invoices_ref_invoice_id_fkey
  foreign key (ref_invoice_id) references public.invoices(id) on delete set null;

-- Ausgestellte Rechnungen bleiben unveränderlich – nur das Leeren des Bezugs (weil das Original gelöscht wurde) ist erlaubt
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
       or (new.ref_invoice_id is distinct from old.ref_invoice_id and new.ref_invoice_id is not null) then
      raise exception 'Ausgestellte Rechnungen können nicht geändert werden. Bitte die Korrektur-Funktion nutzen.';
    end if;
  end if;
  return new;
end $$;

-- Löschen: jede Rechnung des Firmenkontos, mit Schreibrecht „Rechnungen“ (Zwei-Faktor wie überall in der App)
drop policy if exists team_loeschen on public.invoices;
create policy team_loeschen on public.invoices for delete to authenticated
  using (user_id = public.firma_id() and public.darf('rechnungen', true));
