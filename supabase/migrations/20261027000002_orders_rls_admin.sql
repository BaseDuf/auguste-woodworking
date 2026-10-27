-- La politique RLS actuelle bloque les UPDATE depuis le service_role si aucune politique UPDATE n'existe.
-- On s'assure que service_role peut mettre à jour le statut.
-- PostgreSQL ne supporte pas "CREATE POLICY IF NOT EXISTS" : on passe par DROP ... IF EXISTS.
alter table public.orders enable row level security;

drop policy if exists "service_role can update orders" on public.orders;
create policy "service_role can update orders"
  on public.orders for update
  to service_role
  using (true)
  with check (true);
