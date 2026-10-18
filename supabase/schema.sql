-- ============================================================================
-- Uangku — Personal Finance Tracker
-- Schema Supabase: tabel, constraint, trigger keamanan saldo, RLS, seed kategori
--
-- Cara pakai:
--   1. Buka Supabase Dashboard → SQL Editor.
--   2. Tempel seluruh isi file ini, lalu jalankan (Run).
--   3. Semua operasi tulis dilakukan dari browser lewat tabel/RPC, validasi
--      saldo dijaga oleh trigger database — bukan hanya oleh frontend.
--
-- Catatan:
--   - Semua nominal disimpan sebagai BIGINT (rupiah bulat, tanpa desimal).
--   - Setiap pengguna hanya bisa melihat/mengubah barisnya sendiri (RLS).
--   - Kategori "Nabung" (is_savings = true) dipakai halaman Tabungan.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tipe & tabel
-- ---------------------------------------------------------------------------

do $$
begin
  create type public.transaction_type as enum ('income', 'expense', 'save', 'unsave');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (full_name is null or char_length(btrim(full_name)) between 1 and 80),
  initial_balance bigint not null default 0 check (initial_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  icon text not null default 'circle' check (icon ~ '^[a-z0-9-]+$'),
  is_savings boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  description text not null check (char_length(btrim(description)) between 1 and 200),
  amount bigint not null check (amount > 0),
  type public.transaction_type not null,
  transaction_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Satu nama kategori per pengguna (tidak peka huruf besar/kecil).
create unique index if not exists categories_user_name_unique
  on public.categories (user_id, lower(btrim(name)));

-- Tepat satu kategori tabungan per pengguna.
create unique index if not exists categories_user_savings_unique
  on public.categories (user_id)
  where is_savings;

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, transaction_date desc, created_at desc);

create index if not exists transactions_user_category_idx
  on public.transactions (user_id, category_id);

create index if not exists transactions_user_type_idx
  on public.transactions (user_id, type);

-- ---------------------------------------------------------------------------
-- 2. Fungsi bantu
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Kunci per pengguna supaya dua transaksi yang masuk bersamaan tidak bisa
-- lolos validasi saldo secara bersamaan (race condition).
create or replace function public.lock_finance_user(p_user_id uuid)
returns void
language sql
as $$
  select pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
$$;

-- ---------------------------------------------------------------------------
-- 3. Validasi saldo awal
--    Mengubah saldo awal tidak boleh membuat saldo tersedia menjadi negatif,
--    dan tidak pernah menimpa riwayat transaksi.
-- ---------------------------------------------------------------------------

create or replace function public.validate_profile_balance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_income bigint;
  v_expense bigint;
  v_save bigint;
  v_unsave bigint;
  v_available bigint;
begin
  if new.initial_balance is null or new.initial_balance < 0 then
    raise exception 'Saldo awal tidak boleh negatif.' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and new.initial_balance is distinct from old.initial_balance then
    perform public.lock_finance_user(new.id);

    select
      coalesce(sum(amount) filter (where type = 'income'), 0)::bigint,
      coalesce(sum(amount) filter (where type = 'expense'), 0)::bigint,
      coalesce(sum(amount) filter (where type = 'save'), 0)::bigint,
      coalesce(sum(amount) filter (where type = 'unsave'), 0)::bigint
    into v_income, v_expense, v_save, v_unsave
    from public.transactions
    where user_id = new.id;

    v_available := new.initial_balance + v_income - v_expense - v_save + v_unsave;

    if v_available < 0 then
      raise exception 'Saldo awal terlalu kecil: saldo tersedia akan menjadi negatif.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_validate_balance on public.profiles;
create trigger profiles_validate_balance
  before insert or update of initial_balance on public.profiles
  for each row execute function public.validate_profile_balance();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Integritas transaksi
--    - Kategori harus milik pengguna yang sama.
--    - Tipe save/unsave hanya untuk kategori tabungan, dan sebaliknya.
--    - Pengeluaran/menabung tidak boleh melebihi saldo tersedia.
--    - Penarikan tabungan tidak boleh melebihi saldo tabungan.
--    - Edit/hapus tidak boleh membuat saldo tersedia atau tabungan negatif.
--    Trigger ini berjalan untuk semua jalur tulis (frontend maupun REST).
-- ---------------------------------------------------------------------------

create or replace function public.enforce_transaction_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_initial bigint;
  v_income bigint;
  v_expense bigint;
  v_save bigint;
  v_unsave bigint;
  v_available bigint;
  v_savings bigint;
  v_category public.categories%rowtype;
  v_exclude uuid;
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if tg_op = 'DELETE' then
    v_user_id := old.user_id;
  else
    v_user_id := new.user_id;
  end if;

  -- Cascading delete dari penghapusan profil tidak perlu divalidasi.
  select initial_balance into v_initial
  from public.profiles
  where id = v_user_id;

  if not found then
    if tg_op = 'DELETE' then
      return old;
    end if;
    raise exception 'Profil pengguna tidak ditemukan.' using errcode = '23503';
  end if;

  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'Pemilik transaksi tidak boleh diubah.' using errcode = '23514';
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if new.description is null or btrim(new.description) = '' then
      raise exception 'Deskripsi transaksi wajib diisi.' using errcode = '23514';
    end if;

    if new.amount is null or new.amount <= 0 then
      raise exception 'Nominal transaksi harus lebih dari 0.' using errcode = '23514';
    end if;

    if new.transaction_date is null or new.transaction_date < date '2000-01-01' then
      raise exception 'Tanggal transaksi tidak valid.' using errcode = '23514';
    end if;

    if new.transaction_date > v_today then
      raise exception 'Tanggal transaksi tidak boleh melewati hari ini.' using errcode = '23514';
    end if;

    select * into v_category
    from public.categories
    where id = new.category_id and user_id = v_user_id;

    if not found then
      raise exception 'Kategori tidak valid untuk pengguna ini.' using errcode = '23514';
    end if;

    if new.type in ('save', 'unsave') and not v_category.is_savings then
      raise exception 'Transaksi tabungan harus memakai kategori Nabung.' using errcode = '23514';
    end if;

    if new.type in ('income', 'expense') and v_category.is_savings then
      raise exception 'Kategori Nabung hanya untuk menabung atau menarik tabungan.' using errcode = '23514';
    end if;
  end if;

  perform public.lock_finance_user(v_user_id);

  if tg_op = 'INSERT' then
    v_exclude := null;
  else
    v_exclude := old.id;
  end if;

  select
    coalesce(sum(amount) filter (where type = 'income' and (v_exclude is null or id <> v_exclude)), 0)::bigint,
    coalesce(sum(amount) filter (where type = 'expense' and (v_exclude is null or id <> v_exclude)), 0)::bigint,
    coalesce(sum(amount) filter (where type = 'save' and (v_exclude is null or id <> v_exclude)), 0)::bigint,
    coalesce(sum(amount) filter (where type = 'unsave' and (v_exclude is null or id <> v_exclude)), 0)::bigint
  into v_income, v_expense, v_save, v_unsave
  from public.transactions
  where user_id = v_user_id;

  if tg_op in ('INSERT', 'UPDATE') then
    case new.type
      when 'income' then v_income := v_income + new.amount;
      when 'expense' then v_expense := v_expense + new.amount;
      when 'save' then v_save := v_save + new.amount;
      when 'unsave' then v_unsave := v_unsave + new.amount;
    end case;
  end if;

  v_available := v_initial + v_income - v_expense - v_save + v_unsave;
  v_savings := v_save - v_unsave;

  if v_available < 0 then
    raise exception 'Saldo tidak mencukupi untuk transaksi ini.' using errcode = '23514';
  end if;

  if v_savings < 0 then
    raise exception 'Saldo tabungan tidak mencukupi untuk penarikan ini.' using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists transactions_enforce_rules on public.transactions;
create trigger transactions_enforce_rules
  before insert or update or delete on public.transactions
  for each row execute function public.enforce_transaction_rules();

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Integritas kategori
--    - Nama dirapikan, ikon divalidasi.
--    - Kepemilikan & jenis tabungan tidak bisa dipindah-tukar.
--    - Kategori tabungan tidak bisa dihapus.
--    - Kategori yang masih punya transaksi tidak bisa dihapus.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_category_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    -- Cascading delete dari penghapusan profil diizinkan.
    if not exists (select 1 from public.profiles where id = old.user_id) then
      return old;
    end if;

    if old.is_savings then
      raise exception 'Kategori Nabung tidak dapat dihapus karena dipakai halaman tabungan.'
        using errcode = '23514';
    end if;

    if exists (select 1 from public.transactions where category_id = old.id) then
      raise exception 'Kategori masih memiliki transaksi. Pindahkan atau hapus transaksinya terlebih dahulu.'
        using errcode = '23503';
    end if;

    return old;
  end if;

  new.name := btrim(new.name);

  if new.name is null or new.name = '' then
    raise exception 'Nama kategori wajib diisi.' using errcode = '23514';
  end if;

  if new.icon is null or new.icon !~ '^[a-z0-9-]+$' then
    new.icon := 'circle';
  end if;

  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'Pemilik kategori tidak boleh diubah.' using errcode = '23514';
    end if;

    if new.is_savings is distinct from old.is_savings then
      raise exception 'Jenis kategori tabungan tidak dapat diubah.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists categories_enforce_rules on public.categories;
create trigger categories_enforce_rules
  before insert or update or delete on public.categories
  for each row execute function public.enforce_category_rules();

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Pembuatan profil + kategori bawaan saat pengguna mendaftar
--    Kategori disimpan di database, bukan di-hardcode di halaman.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do nothing;

  insert into public.categories (user_id, name, icon, is_savings)
  values
    (new.id, 'Makan', 'utensils', false),
    (new.id, 'Nabung', 'piggy-bank', true),
    (new.id, 'Transportasi', 'bus', false),
    (new.id, 'Kuliah', 'graduation-cap', false),
    (new.id, 'Belanja', 'shopping-bag', false),
    (new.id, 'Lainnya', 'more-horizontal', false)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 7. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;

-- Profil: pengguna hanya bisa membaca dan mengubah profilnya sendiri.
-- INSERT tidak diizinkan dari browser (dibuat oleh trigger auth).
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Kategori: hanya milik sendiri. Kategori tabungan tidak bisa dibuat dari browser.
drop policy if exists categories_select_own on public.categories;
create policy categories_select_own
  on public.categories for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists categories_insert_own on public.categories;
create policy categories_insert_own
  on public.categories for insert
  to authenticated
  with check (user_id = auth.uid() and is_savings = false);

drop policy if exists categories_update_own on public.categories;
create policy categories_update_own
  on public.categories for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists categories_delete_own on public.categories;
create policy categories_delete_own
  on public.categories for delete
  to authenticated
  using (user_id = auth.uid());

-- Transaksi: hanya milik sendiri dan kategorinya harus milik sendiri.
drop policy if exists transactions_select_own on public.transactions;
create policy transactions_select_own
  on public.transactions for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists transactions_insert_own on public.transactions;
create policy transactions_insert_own
  on public.transactions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.categories c
      where c.id = category_id and c.user_id = auth.uid()
    )
  );

drop policy if exists transactions_update_own on public.transactions;
create policy transactions_update_own
  on public.transactions for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.categories c
      where c.id = category_id and c.user_id = auth.uid()
    )
  );

drop policy if exists transactions_delete_own on public.transactions;
create policy transactions_delete_own
  on public.transactions for delete
  to authenticated
  using (user_id = auth.uid());

-- Hak akses tabel: tidak ada akses anonim sama sekali.
revoke all on public.profiles from anon;
revoke all on public.categories from anon;
revoke all on public.transactions from anon;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Backfill untuk pengguna yang sudah terdaftar sebelum schema dijalankan
-- ---------------------------------------------------------------------------

insert into public.profiles (id, full_name)
select
  u.id,
  nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), '')
from auth.users u
on conflict (id) do nothing;

insert into public.categories (user_id, name, icon, is_savings)
select u.id, 'Nabung', 'piggy-bank', true
from auth.users u
where not exists (
  select 1 from public.categories c
  where c.user_id = u.id and c.is_savings
)
on conflict do nothing;

insert into public.categories (user_id, name, icon)
select u.id, d.name, d.icon
from auth.users u
cross join (
  values
    ('Makan', 'utensils'),
    ('Transportasi', 'bus'),
    ('Kuliah', 'graduation-cap'),
    ('Belanja', 'shopping-bag'),
    ('Lainnya', 'more-horizontal')
) as d (name, icon)
on conflict do nothing;

-- ============================================================================
-- Selesai. Semua tabel sudah dilindungi RLS dan validasi saldo di database.
-- ============================================================================
