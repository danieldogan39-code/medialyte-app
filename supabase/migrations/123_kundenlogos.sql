-- Kundenlogos: jeder Kunde mit seinem eigenen Logo (Kundenliste, Kundenakte, Rechnungskunde).
-- Das Logo steht als kleines Bild (PNG/JPEG/WebP als data-URL, höchstens ca. 150 KB) direkt beim Kunden, wie das
-- Firmenlogo in den Einstellungen: es kommt mit den Kunden mit, auch offline.
-- logo_quelle: 'website' (automatisch von der Website des Kunden), 'demo' (aus seiner Demo), 'hochgeladen' (von Hand).
-- Von Hand hochgeladene Logos überschreibt der automatische Abruf (tools/logos/holen.py) nie.
alter table public.customers add column if not exists logo text;
alter table public.customers add column if not exists logo_quelle text;
do $$ begin
  alter table public.customers add constraint customers_logo_chk
    check (logo is null or (logo ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$' and length(logo) <= 200000));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.customers add constraint customers_logo_quelle_chk check (logo_quelle in ('website', 'demo', 'hochgeladen'));
exception when duplicate_object then null; end $$;

-- Protokoll (GoBD): das Logo nicht jedes Mal als Bild mitschreiben, die Prüfsumme belegt die Änderung
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
  if tg_table_name = 'customers' then
    if a ? 'logo' and a ->> 'logo' is not null then a := jsonb_set(a, '{logo}', to_jsonb(md5(a ->> 'logo'))); end if;
    if n ? 'logo' and n ->> 'logo' is not null then n := jsonb_set(n, '{logo}', to_jsonb(md5(n ->> 'logo'))); end if;
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
