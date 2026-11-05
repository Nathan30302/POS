-- POS stationery shop — Supabase schema (Phase 1+)
-- Run this in Supabase SQL Editor after creating a free project.

create extension if not exists "pgcrypto";

create type public.app_role as enum ('owner', 'staff');
create type public.payment_method as enum ('cash', 'card', 'eft', 'other');

-- Profiles (linked to Supabase Auth). Used more in Phase 5.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'staff',
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  barcode text unique,
  sku text unique,
  category text not null default 'General',
  cost_price numeric(12, 2) not null default 0 check (cost_price >= 0),
  selling_price numeric(12, 2) not null check (selling_price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  low_stock_threshold integer not null default 10 check (low_stock_threshold >= 0),
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Prepared for Phase 3 (sales). Safe to create now.
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  total numeric(12, 2) not null,
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  payment_method public.payment_method not null,
  sold_by uuid references public.profiles (id),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid not null references public.products (id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null,
  line_total numeric(12, 2) not null
);

create index if not exists products_category_idx on public.products (category);
create index if not exists products_barcode_idx on public.products (barcode);
create index if not exists products_name_idx on public.products (name);
create index if not exists sales_created_at_idx on public.sales (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

-- Auto-create profile when a user signs up (Phase 5 ready)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'staff')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Phase 1: open product policies so the demo works before Auth UI (Phase 5).
-- Tighten these when roles land.
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

drop policy if exists "products_select_all" on public.products;
drop policy if exists "products_insert_all" on public.products;
drop policy if exists "products_update_all" on public.products;
drop policy if exists "products_delete_all" on public.products;

create policy "products_select_all" on public.products for select using (true);
create policy "products_insert_all" on public.products for insert with check (true);
create policy "products_update_all" on public.products for update using (true);
create policy "products_delete_all" on public.products for delete using (true);

-- Seed stationery sample (safe to re-run: clears then inserts)
truncate table public.sale_items restart identity cascade;
truncate table public.sales restart identity cascade;
truncate table public.products restart identity cascade;

insert into public.products
  (name, barcode, sku, category, cost_price, selling_price, stock_quantity, low_stock_threshold, image_url)
values
  ('Black Gel Pen 0.7mm', '6001234567001', 'PEN-BLK-07', 'Writing', 4.00, 8.50, 120, 20, '/products/pen-black.jpg'),
  ('Blue Gel Pen 0.7mm', '6001234567002', 'PEN-BLU-07', 'Writing', 4.00, 8.50, 95, 20, '/products/pen-blue.jpg'),
  ('HB Pencils Pack of 12', '6001234567003', 'PENCIL-HB-12', 'Writing', 12.00, 25.00, 48, 15, '/products/pencils.jpg'),
  ('Exercise Book A4 96pg', '6001234567004', 'EXB-A4-96', 'Books', 9.00, 18.00, 200, 40, '/products/exercise-book.jpg'),
  ('A4 Paper Ream 500 sheets', '6001234567005', 'A4-REAM-80', 'Paper', 70.00, 95.00, 6, 8, '/products/a4-paper.jpg'),
  ('30cm Plastic Ruler', '6001234567006', 'RULER-30', 'Tools', 3.00, 7.00, 80, 15, '/products/ruler.jpg'),
  ('Glue Stick 21g', '6001234567007', 'GLUE-21', 'Adhesives', 6.00, 12.00, 55, 12, '/products/glue.jpg'),
  ('Mathematical Set', '6001234567008', 'MATH-SET', 'School', 25.00, 45.00, 32, 10, '/products/math-set.jpg'),
  ('Wax Crayons 12 colours', '6001234567009', 'CRAYON-12', 'Art', 10.00, 22.00, 8, 12, '/products/crayons.jpg'),
  ('Highlighter Set (4)', '6001234567010', 'HIGH-4', 'Writing', 18.00, 35.00, 40, 10, '/products/highlighters.jpg'),
  ('Desktop Stapler', '6001234567011', 'STAPLER', 'Office', 30.00, 55.00, 18, 5, '/products/stapler.jpg'),
  ('Sticky Notes Yellow', '6001234567012', 'STICKY-Y', 'Office', 7.00, 15.00, 60, 15, '/products/sticky-notes.jpg'),
  ('Desktop Calculator', '6001234567013', 'CALC-BASIC', 'Office', 45.00, 85.00, 14, 5, '/products/calculator.jpg'),
  ('Office Scissors', '6001234567014', 'SCISSORS', 'Tools', 12.00, 28.00, 25, 8, '/products/scissors.jpg'),
  ('Ring Binder A4 Blue', '6001234567015', 'BINDER-BLU', 'Files', 20.00, 42.00, 22, 8, '/products/binder.jpg'),
  ('Manila Folders Pack of 10', '6001234567016', 'FOLDER-10', 'Files', 14.00, 30.00, 35, 10, '/products/folders.jpg'),
  ('Permanent Marker Black', '6001234567017', 'MARKER-BLK', 'Writing', 4.50, 10.00, 70, 15, '/products/marker.jpg'),
  ('White Eraser Soft', '6001234567018', 'ERASER', 'Writing', 2.00, 5.00, 150, 30, '/products/eraser.jpg'),
  ('Metal Pencil Sharpener', '6001234567019', 'SHARPENER', 'Tools', 2.50, 6.00, 4, 15, '/products/sharpener.jpg'),
  ('Correction Tape', '6001234567020', 'CORR-TAPE', 'Office', 8.00, 18.00, 28, 10, '/products/correction-tape.jpg');
