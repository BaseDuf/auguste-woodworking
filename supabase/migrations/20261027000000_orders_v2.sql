-- Add missing columns to orders
alter table public.orders
  add column if not exists total_cents    integer not null default 0 check (total_cents >= 0),
  add column if not exists shipping_cents integer not null default 0 check (shipping_cents >= 0);

-- Add missing column to order_items
alter table public.order_items
  add column if not exists shipping_price_cents integer not null default 0 check (shipping_price_cents >= 0);

-- Order number generator
create or replace function public.generate_order_number()
returns text language plpgsql as $$
declare
  year_part text := extract(year from now())::text;
  seq_num   integer;
begin
  select coalesce(max(cast(substring(order_number from 9) as integer)), 0) + 1
  into seq_num
  from public.orders
  where order_number like 'AW-' || year_part || '-%';
  return 'AW-' || year_part || '-' || lpad(seq_num::text, 5, '0');
end;
$$;

-- INSERT RLS for guest checkout (anyone can place an order)
-- Using DROP-then-CREATE because PostgreSQL does not support CREATE POLICY IF NOT EXISTS
drop policy if exists "Anyone can insert orders" on public.orders;
create policy "Anyone can insert orders"
  on public.orders for insert with check (true);

drop policy if exists "Anyone can insert order_items" on public.order_items;
create policy "Anyone can insert order_items"
  on public.order_items for insert with check (true);

drop policy if exists "Anyone can insert shipping_addresses" on public.shipping_addresses;
create policy "Anyone can insert shipping_addresses"
  on public.shipping_addresses for insert with check (true);
