-- Revoke public EXECUTE on decrement_product_stock; only service_role may call it
revoke execute on function public.decrement_product_stock(uuid, integer) from public, anon, authenticated;
grant execute on function public.decrement_product_stock(uuid, integer) to service_role;

-- Fix search_path to prevent search-path hijacking
alter function public.decrement_product_stock(uuid, integer) set search_path = public;
alter function public.generate_order_number() set search_path = public;

-- Drop the open "anyone can insert" policies — all writes go through the service-role Server Action
drop policy if exists "Anyone can insert orders" on public.orders;
drop policy if exists "Anyone can insert order_items" on public.order_items;
drop policy if exists "Anyone can insert shipping_addresses" on public.shipping_addresses;
