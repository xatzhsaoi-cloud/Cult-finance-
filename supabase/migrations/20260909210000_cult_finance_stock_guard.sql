-- CULT Finance: owner-controlled inventory and restock proposals.
-- All browser access is read-only; mutations use the narrowly scoped RPCs below.

begin;

create extension if not exists pgcrypto;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  opening_cash numeric(12,2) not null default 0 check (opening_cash >= 0),
  default_vat_rate numeric(5,2) not null default 24 check (default_vat_rate between 0 and 100),
  tax_reserve_pct numeric(5,2) not null default 20 check (tax_reserve_pct between 0 and 100),
  income_tax_pct numeric(5,2) not null default 22 check (income_tax_pct between 0 and 100),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'staff')),
  created_at timestamptz not null default now()
);

create table public.inventory_products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  brand text,
  sku text,
  unit text not null default 'τεμ.' check (char_length(trim(unit)) between 1 and 20),
  quantity numeric(12,2) not null default 0 check (quantity >= 0),
  min_quantity numeric(12,2) not null default 5 check (min_quantity >= 0),
  purchase_cost numeric(12,2) check (purchase_cost is null or purchase_cost >= 0),
  supplier_name text,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index inventory_products_business_sku_unique
  on public.inventory_products (business_id, sku)
  where sku is not null and btrim(sku) <> '';

create index inventory_products_business_stock_idx
  on public.inventory_products (business_id, is_active, quantity, min_quantity);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.inventory_products(id) on delete cascade,
  movement_type text not null check (movement_type in ('initial', 'adjustment', 'delivery', 'sale')),
  quantity_delta numeric(12,2) not null,
  quantity_before numeric(12,2) not null check (quantity_before >= 0),
  quantity_after numeric(12,2) not null check (quantity_after >= 0),
  note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index stock_movements_product_created_idx
  on public.stock_movements (product_id, created_at desc);

create table public.restock_proposals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rule_version text not null default 'min-to-2x-min',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text,
  check ((status = 'pending' and reviewed_by is null and reviewed_at is null) or status in ('approved', 'rejected'))
);

create unique index restock_proposals_one_pending_per_business
  on public.restock_proposals (business_id)
  where status = 'pending';

create index restock_proposals_business_created_idx
  on public.restock_proposals (business_id, created_at desc);

create table public.restock_proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.restock_proposals(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.inventory_products(id) on delete restrict,
  product_name text not null,
  supplier_name text,
  unit text not null,
  quantity_at_check numeric(12,2) not null check (quantity_at_check >= 0),
  min_quantity numeric(12,2) not null check (min_quantity >= 0),
  suggested_quantity numeric(12,2) not null check (suggested_quantity > 0),
  unit_cost numeric(12,2) check (unit_cost is null or unit_cost >= 0),
  estimated_cost numeric(12,2) check (estimated_cost is null or estimated_cost >= 0),
  created_at timestamptz not null default now(),
  unique (proposal_id, product_id)
);

create index restock_proposal_items_business_idx
  on public.restock_proposal_items (business_id, proposal_id);

create table public.inventory_audit_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('product_created', 'stock_adjusted', 'proposal_created', 'proposal_approved', 'proposal_rejected')),
  entity_type text not null,
  entity_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index inventory_audit_log_business_created_idx
  on public.inventory_audit_log (business_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger businesses_set_updated_at
before update on public.businesses
for each row execute function public.set_updated_at();

create trigger inventory_products_set_updated_at
before update on public.inventory_products
for each row execute function public.set_updated_at();

-- These functions expose only the caller's own membership information.
create or replace function public.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.business_id
  from public.profiles p
  where p.id = (select auth.uid())
$$;

create or replace function public.current_user_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'owner'
  )
$$;

create or replace function public.bootstrap_business(
  p_name text default 'CULT Barbershop',
  p_demo boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select business_id into v_business_id
  from public.profiles
  where id = v_user_id;

  if v_business_id is not null then
    return v_business_id;
  end if;

  insert into public.businesses (name, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'CULT Barbershop'), v_user_id)
  returning id into v_business_id;

  insert into public.profiles (id, business_id)
  values (v_user_id, v_business_id)
  on conflict (id) do update set business_id = excluded.business_id;

  insert into public.user_roles (user_id, role)
  values (v_user_id, 'owner')
  on conflict (user_id) do nothing;

  return v_business_id;
end;
$$;

create or replace function public.create_inventory_product(
  p_name text,
  p_brand text default null,
  p_sku text default null,
  p_unit text default 'τεμ.',
  p_initial_quantity numeric default 0,
  p_min_quantity numeric default 5,
  p_purchase_cost numeric default null,
  p_supplier_name text default null
)
returns public.inventory_products
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid := public.current_business_id();
  v_product public.inventory_products;
begin
  if v_user_id is null or v_business_id is null then
    raise exception 'Authentication and a business profile are required';
  end if;
  if nullif(trim(p_name), '') is null then
    raise exception 'Product name is required';
  end if;
  if coalesce(p_initial_quantity, 0) < 0 or coalesce(p_min_quantity, 0) < 0 then
    raise exception 'Stock quantities cannot be negative';
  end if;
  if p_purchase_cost is not null and p_purchase_cost < 0 then
    raise exception 'Purchase cost cannot be negative';
  end if;

  insert into public.inventory_products (
    business_id, name, brand, sku, unit, quantity, min_quantity,
    purchase_cost, supplier_name, created_by, updated_by
  ) values (
    v_business_id, trim(p_name), nullif(trim(p_brand), ''), nullif(trim(p_sku), ''),
    coalesce(nullif(trim(p_unit), ''), 'τεμ.'), coalesce(p_initial_quantity, 0),
    coalesce(p_min_quantity, 5), p_purchase_cost, nullif(trim(p_supplier_name), ''),
    v_user_id, v_user_id
  )
  returning * into v_product;

  insert into public.stock_movements (
    business_id, product_id, movement_type, quantity_delta, quantity_before,
    quantity_after, note, created_by
  ) values (
    v_business_id, v_product.id, 'initial', v_product.quantity, 0,
    v_product.quantity, 'Αρχική καταχώρηση', v_user_id
  );

  insert into public.inventory_audit_log (business_id, actor_id, action, entity_type, entity_id, details)
  values (
    v_business_id, v_user_id, 'product_created', 'inventory_product', v_product.id,
    jsonb_build_object('name', v_product.name, 'initial_quantity', v_product.quantity)
  );

  return v_product;
end;
$$;

create or replace function public.adjust_inventory_stock(
  p_product_id uuid,
  p_quantity_delta numeric,
  p_movement_type text default 'adjustment',
  p_note text default null
)
returns public.inventory_products
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid := public.current_business_id();
  v_product public.inventory_products;
  v_new_quantity numeric(12,2);
begin
  if v_user_id is null or v_business_id is null then
    raise exception 'Authentication and a business profile are required';
  end if;
  if p_quantity_delta is null or p_quantity_delta = 0 then
    raise exception 'The stock adjustment cannot be zero';
  end if;
  if p_movement_type not in ('adjustment', 'delivery', 'sale') then
    raise exception 'Invalid movement type';
  end if;

  select * into v_product
  from public.inventory_products
  where id = p_product_id
    and business_id = v_business_id
  for update;

  if not found then
    raise exception 'Product not found';
  end if;

  v_new_quantity := v_product.quantity + p_quantity_delta;
  if v_new_quantity < 0 then
    raise exception 'The adjustment would create negative stock';
  end if;

  update public.inventory_products
  set quantity = v_new_quantity, updated_by = v_user_id
  where id = v_product.id
  returning * into v_product;

  insert into public.stock_movements (
    business_id, product_id, movement_type, quantity_delta, quantity_before,
    quantity_after, note, created_by
  ) values (
    v_business_id, v_product.id, p_movement_type, p_quantity_delta,
    v_new_quantity - p_quantity_delta, v_new_quantity, nullif(trim(p_note), ''), v_user_id
  );

  insert into public.inventory_audit_log (business_id, actor_id, action, entity_type, entity_id, details)
  values (
    v_business_id, v_user_id, 'stock_adjusted', 'inventory_product', v_product.id,
    jsonb_build_object('delta', p_quantity_delta, 'quantity_after', v_new_quantity, 'movement_type', p_movement_type)
  );

  return v_product;
end;
$$;

create or replace function public.create_restock_proposal()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid := public.current_business_id();
  v_proposal_id uuid;
begin
  if v_user_id is null or v_business_id is null then
    raise exception 'Authentication and a business profile are required';
  end if;

  select id into v_proposal_id
  from public.restock_proposals
  where business_id = v_business_id and status = 'pending'
  limit 1;

  if v_proposal_id is not null then
    return v_proposal_id;
  end if;

  if not exists (
    select 1
    from public.inventory_products
    where business_id = v_business_id
      and is_active
      and quantity <= min_quantity
  ) then
    return null;
  end if;

  insert into public.restock_proposals (business_id, created_by)
  values (v_business_id, v_user_id)
  returning id into v_proposal_id;

  insert into public.restock_proposal_items (
    proposal_id, business_id, product_id, product_name, supplier_name, unit,
    quantity_at_check, min_quantity, suggested_quantity, unit_cost, estimated_cost
  )
  select
    v_proposal_id, p.business_id, p.id, p.name, p.supplier_name, p.unit,
    p.quantity, p.min_quantity,
    greatest((p.min_quantity * 2) - p.quantity, p.min_quantity, 1),
    p.purchase_cost,
    case when p.purchase_cost is null then null
         else round(greatest((p.min_quantity * 2) - p.quantity, p.min_quantity, 1) * p.purchase_cost, 2)
    end
  from public.inventory_products p
  where p.business_id = v_business_id
    and p.is_active
    and p.quantity <= p.min_quantity;

  insert into public.inventory_audit_log (business_id, actor_id, action, entity_type, entity_id, details)
  values (
    v_business_id, v_user_id, 'proposal_created', 'restock_proposal', v_proposal_id,
    jsonb_build_object('rule', 'min-to-2x-min')
  );

  return v_proposal_id;
end;
$$;

create or replace function public.review_restock_proposal(
  p_proposal_id uuid,
  p_decision text,
  p_note text default null
)
returns public.restock_proposals
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid := public.current_business_id();
  v_proposal public.restock_proposals;
begin
  if v_user_id is null or v_business_id is null then
    raise exception 'Authentication and a business profile are required';
  end if;
  if not public.current_user_is_owner() then
    raise exception 'Only the owner can approve or reject a proposal';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid review decision';
  end if;

  select * into v_proposal
  from public.restock_proposals
  where id = p_proposal_id
    and business_id = v_business_id
  for update;

  if not found then
    raise exception 'Proposal not found';
  end if;
  if v_proposal.status <> 'pending' then
    raise exception 'This proposal has already been reviewed';
  end if;

  update public.restock_proposals
  set status = p_decision,
      reviewed_by = v_user_id,
      reviewed_at = now(),
      review_note = nullif(trim(p_note), '')
  where id = v_proposal.id
  returning * into v_proposal;

  insert into public.inventory_audit_log (business_id, actor_id, action, entity_type, entity_id, details)
  values (
    v_business_id, v_user_id,
    case when p_decision = 'approved' then 'proposal_approved' else 'proposal_rejected' end,
    'restock_proposal', v_proposal.id,
    jsonb_build_object('decision', p_decision, 'note', nullif(trim(p_note), ''))
  );

  return v_proposal;
end;
$$;

alter table public.businesses enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.inventory_products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.restock_proposals enable row level security;
alter table public.restock_proposal_items enable row level security;
alter table public.inventory_audit_log enable row level security;

create policy "profiles_select_self" on public.profiles
for select to authenticated
using (id = (select auth.uid()));

create policy "businesses_select_current_business" on public.businesses
for select to authenticated
using (id = (select public.current_business_id()));

create policy "businesses_update_owner" on public.businesses
for update to authenticated
using (id = (select public.current_business_id()) and (select public.current_user_is_owner()))
with check (id = (select public.current_business_id()) and (select public.current_user_is_owner()));

create policy "user_roles_select_self" on public.user_roles
for select to authenticated
using (user_id = (select auth.uid()));

create policy "inventory_products_select_current_business" on public.inventory_products
for select to authenticated
using (business_id = (select public.current_business_id()));

create policy "stock_movements_select_current_business" on public.stock_movements
for select to authenticated
using (business_id = (select public.current_business_id()));

create policy "restock_proposals_select_current_business" on public.restock_proposals
for select to authenticated
using (business_id = (select public.current_business_id()));

create policy "restock_proposal_items_select_current_business" on public.restock_proposal_items
for select to authenticated
using (business_id = (select public.current_business_id()));

create policy "inventory_audit_log_select_current_business" on public.inventory_audit_log
for select to authenticated
using (business_id = (select public.current_business_id()));

revoke all on table public.businesses, public.profiles, public.user_roles,
  public.inventory_products, public.stock_movements, public.restock_proposals,
  public.restock_proposal_items, public.inventory_audit_log from anon;

revoke all on table public.businesses, public.profiles, public.user_roles,
  public.inventory_products, public.stock_movements, public.restock_proposals,
  public.restock_proposal_items, public.inventory_audit_log from authenticated;

grant select on table public.businesses, public.profiles, public.user_roles,
  public.inventory_products, public.stock_movements, public.restock_proposals,
  public.restock_proposal_items, public.inventory_audit_log to authenticated;
grant update on table public.businesses to authenticated;

-- Functions are an authenticated-only API. Revoke the platform's explicit
-- anonymous grants as well as PostgreSQL's PUBLIC default.
revoke all on function public.current_business_id() from public, anon;
revoke all on function public.current_user_is_owner() from public, anon;
revoke all on function public.bootstrap_business(text, boolean) from public, anon;
revoke all on function public.create_inventory_product(text, text, text, text, numeric, numeric, numeric, text) from public, anon;
revoke all on function public.adjust_inventory_stock(uuid, numeric, text, text) from public, anon;
revoke all on function public.create_restock_proposal() from public, anon;
revoke all on function public.review_restock_proposal(uuid, text, text) from public, anon;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

grant execute on function public.current_business_id() to authenticated;
grant execute on function public.current_user_is_owner() to authenticated;
grant execute on function public.bootstrap_business(text, boolean) to authenticated;
grant execute on function public.create_inventory_product(text, text, text, text, numeric, numeric, numeric, text) to authenticated;
grant execute on function public.adjust_inventory_stock(uuid, numeric, text, text) to authenticated;
grant execute on function public.create_restock_proposal() to authenticated;
grant execute on function public.review_restock_proposal(uuid, text, text) to authenticated;

commit;
