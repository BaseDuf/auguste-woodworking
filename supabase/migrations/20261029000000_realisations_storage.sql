insert into storage.buckets (id, name, public)
values ('realisation-photos', 'realisation-photos', true)
on conflict (id) do nothing;

drop policy if exists "service_role full access realisation-photos" on storage.objects;
create policy "service_role full access realisation-photos"
  on storage.objects for all to service_role
  using (bucket_id = 'realisation-photos')
  with check (bucket_id = 'realisation-photos');

drop policy if exists "public read realisation-photos" on storage.objects;
create policy "public read realisation-photos"
  on storage.objects for select to public
  using (bucket_id = 'realisation-photos');
