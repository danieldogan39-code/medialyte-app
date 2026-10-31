-- Anfrage → Kunde: aus einer Anfrage mit einem Knopf einen Kunden machen; die Anfrage merkt sich, welcher es ist.
alter table public.anfragen add column if not exists customer_id uuid references public.customers(id) on delete set null;
create index if not exists anfragen_customer_idx on public.anfragen (customer_id) where customer_id is not null;
