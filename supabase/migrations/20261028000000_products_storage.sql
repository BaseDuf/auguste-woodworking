insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

drop policy if exists "service_role full access product-photos" on storage.objects;
create policy "service_role full access product-photos"
  on storage.objects for all to service_role
  using (bucket_id = 'product-photos')
  with check (bucket_id = 'product-photos');

drop policy if exists "public read product-photos" on storage.objects;
create policy "public read product-photos"
  on storage.objects for select to public
  using (bucket_id = 'product-photos');
