-- Users can read their own profile (required for admin layout guard
-- and for all admin RLS policies that check profiles.role via a subquery)
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);
