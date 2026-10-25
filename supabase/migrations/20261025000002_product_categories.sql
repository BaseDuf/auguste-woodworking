alter table public.products
  add constraint check_category
  check (category in ('ameublement', 'objet', 'piece_limitee'));
