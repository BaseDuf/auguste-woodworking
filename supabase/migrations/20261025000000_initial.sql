-- profiles: ties Supabase auth users to roles
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  role text not null default 'customer' check (role in ('admin', 'customer')),
  created_at timestamptz not null default now()
);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- products
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  shipping_price_cents integer not null default 0 check (shipping_price_cents >= 0),
  stock integer not null default 0 check (stock >= 0),
  allow_preorder boolean not null default false,
  category text,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.product_photos (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products on delete cascade,
  url text not null,
  position integer not null default 0
);

-- orders
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  status text not null default 'en_attente'
    check (status in ('en_attente', 'confirmee', 'expediee', 'livree', 'echouee')),
  email text not null,
  phone text,
  customer_id uuid references auth.users,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  product_id uuid not null references public.products,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0)
);

create table if not exists public.shipping_addresses (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders on delete cascade,
  first_name text not null,
  last_name text not null,
  line1 text not null,
  line2 text,
  city text not null,
  postal_code text not null,
  country text not null default 'FR'
);

-- realisations
create table if not exists public.realisations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.realisation_photos (
  id uuid primary key default gen_random_uuid(),
  realisation_id uuid not null references public.realisations on delete cascade,
  url text not null,
  position integer not null default 0
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_photos enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.shipping_addresses enable row level security;
alter table public.realisations enable row level security;
alter table public.realisation_photos enable row level security;

-- Public read: published products and photos, realisations
create policy "Public can read published products"
  on public.products for select using (published = true);

create policy "Public can read product photos"
  on public.product_photos for select using (
    exists (select 1 from public.products p where p.id = product_id and p.published = true)
  );

create policy "Public can read realisations"
  on public.realisations for select using (true);

create policy "Public can read realisation photos"
  on public.realisation_photos for select using (true);

-- Orders: owner or service role
create policy "Customers can read own orders"
  on public.orders for select
  using (auth.uid() = customer_id);

create policy "Customers can read own order items"
  on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));

create policy "Customers can read own shipping address"
  on public.shipping_addresses for select
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));

-- Admin: full access (service role bypasses RLS; these policies cover JWT-authenticated admin)
create policy "Admin full access to products"
  on public.products for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admin full access to product_photos"
  on public.product_photos for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admin full access to orders"
  on public.orders for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admin full access to order_items"
  on public.order_items for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admin full access to shipping_addresses"
  on public.shipping_addresses for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admin full access to realisations"
  on public.realisations for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admin full access to realisation_photos"
  on public.realisation_photos for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
