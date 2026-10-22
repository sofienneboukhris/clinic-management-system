-- ============================================================================
-- Migration: Create profiles table and Role-Based Access Control (RBAC)
-- نظام إدارة العيادة: إنشاء جدول الأدوار والملفات الشخصية وربطه بـ auth.users
-- بنية نظيفة وغير مدمرة (Non-destructive & Idempotent)
-- ============================================================================

-- 1. إنشاء جدول الملفات الشخصية والأدوار (public.profiles)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null check (role in ('doctor', 'secretary')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. تفعيل سياسات الأمان على مستوى الصفوف (Row Level Security - RLS)
alter table public.profiles enable row level security;

-- 3. سياسة السماح لكل مستخدم مسجل بقراءة ملفه ودوره فقط
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- 4. سياسة السماح للمستخدم بتحديث بياناته
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 5. وظيفة ودالة تلقائية لربط أي مستخدم جديد مسجل في auth.users بجدول profiles
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'secretary')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- تفعيل الـ Trigger عند إنشاء مستخدم جديد
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- ملاحظة إدارية لإنشاء الحسابين التجريبيين في Supabase بأمان:
-- يمكنك إنشاء الحسابين من لوحة تحكم Supabase Dashboard -> Authentication -> Users:
--
-- 1. حساب الطبيب:
--    - Email: doctor@clinic.com
--    - Password: (اختر كلمة مرور آمنة من اختيارك)
--    ثم تنفيذ الاستعلام التالي في SQL Editor لتعيين دوره:
--    insert into public.profiles (id, email, full_name, role)
--    select id, email, 'د. عيادة الباطنة العامة', 'doctor'
--    from auth.users where email = 'doctor@clinic.com'
--    on conflict (id) do update set role = 'doctor', full_name = 'د. عيادة الباطنة العامة';
--
-- 2. حساب السكرتيرة:
--    - Email: secretary@clinic.com
--    - Password: (اختر كلمة مرور آمنة من اختيارك)
--    ثم تنفيذ الاستعلام التالي في SQL Editor لتعيين دورها:
--    insert into public.profiles (id, email, full_name, role)
--    select id, email, 'أ. سكرتارية الاستقبال', 'secretary'
--    from auth.users where email = 'secretary@clinic.com'
--    on conflict (id) do update set role = 'secretary', full_name = 'أ. سكرتارية الاستقبال';
-- ============================================================================
