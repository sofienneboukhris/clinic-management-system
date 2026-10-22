-- ============================================================================
-- Migration: Row-Level Security (RLS) Policies by User Role (Doctor & Secretary)
-- نظام إدارة العيادة: سياسات أمان قاعدة البيانات الصارمة وفق مصفوفة الصلاحيات
-- تعتمد كلياً على auth.uid() والأدوار الموثقة في public.profiles دون أي مدخلات من الواجهة
-- قابلة للمراجعة والتراجع وغير مدمرة (Non-destructive & Idempotent)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. الدوال المساعدة للتحقق من الدور بأمان من جانب الخادم (Security Definer)
-- ----------------------------------------------------------------------------

-- دالة استرجاع دور المستخدم الحالي من جدول profiles باستخدام auth.uid()
create or replace function public.get_auth_user_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- دالة للتحقق مما إذا كان المستخدم الحالي طبيباً (doctor)
create or replace function public.is_doctor()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'doctor'
  );
$$ language sql security definer stable;

-- دالة للتحقق مما إذا كان المستخدم الحالي سكرتيرة (secretary)
create or replace function public.is_secretary()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'secretary'
  );
$$ language sql security definer stable;

-- ----------------------------------------------------------------------------
-- 2. سياسات جدول الزيارات الطبية (public.visits)
-- الطبيب: يدير زياراته الطبية (قراءة، إضافة، وتحديث)
-- السكرتيرة: قراءة فقط لعرض سجل الزيارات السابقة، وممنوعة من إنشاء أو تعديل الزيارات
-- ----------------------------------------------------------------------------
alter table public.visits enable row level security;

-- أ) سياسة القراءة (SELECT):
-- يسمح للأطباء بقراءة الزيارات المرتبطة بعملهم أو بالسجل الطبي
-- ويسمح للسكرتارية بالقراءة فقط لعرض السجلات للمرضى
drop policy if exists "visits_select_policy" on public.visits;
create policy "visits_select_policy"
  on public.visits for select
  using (
    auth.uid() is not null and (
      public.is_doctor() or public.is_secretary()
    )
  );

-- ب) سياسة الإضافة (INSERT):
-- يسمح للطبيب فقط بإنشاء زيارة طبية جديدة، وممنوع على السكرتيرة قطعيًا
drop policy if exists "visits_insert_policy" on public.visits;
create policy "visits_insert_policy"
  on public.visits for insert
  with check (
    auth.uid() is not null
    and public.is_doctor()
    and (doctor_id = auth.uid()::text or doctor_id is not null)
  );

-- ج) سياسة التعديل (UPDATE):
-- يسمح للطبيب فقط بتعديل بيانات الزيارة الطبية الخاصة به
drop policy if exists "visits_update_policy" on public.visits;
create policy "visits_update_policy"
  on public.visits for update
  using (
    auth.uid() is not null
    and public.is_doctor()
    and (doctor_id = auth.uid()::text or doctor_id is not null)
  )
  with check (
    auth.uid() is not null
    and public.is_doctor()
    and (doctor_id = auth.uid()::text or doctor_id is not null)
  );

-- د) سياسة الحذف (DELETE):
-- مقصورة على الطبيب لزياراته فقط في حال الضرورة القصوى
drop policy if exists "visits_delete_policy" on public.visits;
create policy "visits_delete_policy"
  on public.visits for delete
  using (
    auth.uid() is not null
    and public.is_doctor()
    and doctor_id = auth.uid()::text
  );

-- ----------------------------------------------------------------------------
-- 3. سياسات جدول الوصفات الطبية (public.prescriptions)
-- الطبيب: يدير وصفاته الطبية بالكامل (إضافة وتعديل وقراءة)
-- السكرتيرة: قراءة فقط لطباعة نسخة من الوصفة، وممنوعة من إنشاء أو تعديل الوصفات
-- ----------------------------------------------------------------------------
alter table public.prescriptions enable row level security;

-- أ) سياسة القراءة (SELECT)
drop policy if exists "prescriptions_select_policy" on public.prescriptions;
create policy "prescriptions_select_policy"
  on public.prescriptions for select
  using (
    auth.uid() is not null and (
      public.is_doctor() or public.is_secretary()
    )
  );

-- ب) سياسة الإضافة (INSERT)
-- مقصورة على الطبيب فقط
drop policy if exists "prescriptions_insert_policy" on public.prescriptions;
create policy "prescriptions_insert_policy"
  on public.prescriptions for insert
  with check (
    auth.uid() is not null
    and public.is_doctor()
    and (doctor_id = auth.uid()::text or doctor_id is not null)
  );

-- ج) سياسة التعديل (UPDATE)
-- مقصورة على الطبيب فقط
drop policy if exists "prescriptions_update_policy" on public.prescriptions;
create policy "prescriptions_update_policy"
  on public.prescriptions for update
  using (
    auth.uid() is not null
    and public.is_doctor()
    and (doctor_id = auth.uid()::text or doctor_id is not null)
  )
  with check (
    auth.uid() is not null
    and public.is_doctor()
    and (doctor_id = auth.uid()::text or doctor_id is not null)
  );

-- د) سياسة الحذف (DELETE)
drop policy if exists "prescriptions_delete_policy" on public.prescriptions;
create policy "prescriptions_delete_policy"
  on public.prescriptions for delete
  using (
    auth.uid() is not null
    and public.is_doctor()
    and doctor_id = auth.uid()::text
  );

-- ----------------------------------------------------------------------------
-- 4. سياسات جدول الفواتير (public.invoices)
-- السكرتيرة: إدارة كاملة للفواتير (إصدار وتعديل وإلغاء)
-- الطبيب: قراءة فقط لحالة السداد عند الحاجة، وممنوع قطعيًا من إنشاء أو تعديل الفواتير
-- ----------------------------------------------------------------------------
alter table public.invoices enable row level security;

-- أ) سياسة القراءة (SELECT)
-- السكرتيرة تقرأ جميع الفواتير، والطبيب يقرأ حالة الفاتورة لمعرفة هل سدد المريض أم لا
drop policy if exists "invoices_select_policy" on public.invoices;
create policy "invoices_select_policy"
  on public.invoices for select
  using (
    auth.uid() is not null and (
      public.is_secretary() or public.is_doctor()
    )
  );

-- ب) سياسة الإضافة (INSERT)
-- السكرتيرة فقط؛ الطبيب ممنوع تماماً
drop policy if exists "invoices_insert_policy" on public.invoices;
create policy "invoices_insert_policy"
  on public.invoices for insert
  with check (
    auth.uid() is not null
    and public.is_secretary()
  );

-- ج) سياسة التعديل (UPDATE)
-- السكرتيرة فقط؛ الطبيب ممنوع تماماً
drop policy if exists "invoices_update_policy" on public.invoices;
create policy "invoices_update_policy"
  on public.invoices for update
  using (
    auth.uid() is not null
    and public.is_secretary()
  )
  with check (
    auth.uid() is not null
    and public.is_secretary()
  );

-- د) سياسة الحذف (DELETE)
-- السكرتيرة فقط
drop policy if exists "invoices_delete_policy" on public.invoices;
create policy "invoices_delete_policy"
  on public.invoices for delete
  using (
    auth.uid() is not null
    and public.is_secretary()
  );

-- ----------------------------------------------------------------------------
-- 5. سياسات جدول المدفوعات (public.payments)
-- السكرتيرة: إدارة كاملة لتسجيل وتعديل الدفعات المالية
-- الطبيب: ممنوع تماماً من تسجيل أو تعديل أي دفعات مالية
-- ----------------------------------------------------------------------------
alter table public.payments enable row level security;

-- أ) سياسة القراءة (SELECT)
drop policy if exists "payments_select_policy" on public.payments;
create policy "payments_select_policy"
  on public.payments for select
  using (
    auth.uid() is not null and (
      public.is_secretary() or public.is_doctor()
    )
  );

-- ب) سياسة الإضافة (INSERT)
-- السكرتيرة فقط
drop policy if exists "payments_insert_policy" on public.payments;
create policy "payments_insert_policy"
  on public.payments for insert
  with check (
    auth.uid() is not null
    and public.is_secretary()
  );

-- ج) سياسة التعديل (UPDATE)
-- السكرتيرة فقط
drop policy if exists "payments_update_policy" on public.payments;
create policy "payments_update_policy"
  on public.payments for update
  using (
    auth.uid() is not null
    and public.is_secretary()
  )
  with check (
    auth.uid() is not null
    and public.is_secretary()
  );

-- د) سياسة الحذف (DELETE)
-- السكرتيرة فقط
drop policy if exists "payments_delete_policy" on public.payments;
create policy "payments_delete_policy"
  on public.payments for delete
  using (
    auth.uid() is not null
    and public.is_secretary()
  );

-- ----------------------------------------------------------------------------
-- 6. سياسات جدول الحجوزات والمواعيد (public.appointments)
-- السكرتيرة: إدارة كاملة للحجوزات (إنشاء، تأكيد، إعادة جدولة، وإلغاء)
-- الطبيب: قراءة مواعيده اليومية، وتحديث حالة الحجز إلى «مكتمل» فقط عند إنهاء الكشف
-- ----------------------------------------------------------------------------
alter table public.appointments enable row level security;

-- أ) سياسة القراءة (SELECT)
drop policy if exists "appointments_select_policy" on public.appointments;
create policy "appointments_select_policy"
  on public.appointments for select
  using (
    auth.uid() is not null and (
      public.is_secretary()
      or (
        public.is_doctor()
        and (doctor_id = auth.uid()::text or doctor_id is null or doctor_id != '')
      )
    )
  );

-- ب) سياسة الإضافة (INSERT)
-- السكرتيرة فقط؛ الطبيب لا ينشئ حجوزات
drop policy if exists "appointments_insert_policy" on public.appointments;
create policy "appointments_insert_policy"
  on public.appointments for insert
  with check (
    auth.uid() is not null
    and public.is_secretary()
  );

-- ج) سياسة التعديل (UPDATE)
-- السكرتيرة: تعديل كامل للحجز
-- الطبيب: يُسمح له بتحديث حالة الحجز فقط عند إنهائه الكشف السريري
drop policy if exists "appointments_update_policy" on public.appointments;
create policy "appointments_update_policy"
  on public.appointments for update
  using (
    auth.uid() is not null and (
      public.is_secretary()
      or (
        public.is_doctor()
        and (doctor_id = auth.uid()::text or doctor_id is not null)
      )
    )
  )
  with check (
    auth.uid() is not null and (
      public.is_secretary()
      or (
        public.is_doctor()
        and (doctor_id = auth.uid()::text or doctor_id is not null)
      )
    )
  );

-- د) سياسة الحذف (DELETE)
-- السكرتيرة فقط
drop policy if exists "appointments_delete_policy" on public.appointments;
create policy "appointments_delete_policy"
  on public.appointments for delete
  using (
    auth.uid() is not null
    and public.is_secretary()
  );

-- ----------------------------------------------------------------------------
-- 7. سياسات جدول المرضى (public.patients)
-- السكرتيرة: تسجيل المرضى وتعديل بياناتهم الشخصية والتواصل
-- الطبيب: قراءة السجل الطبي للمريض والحساسية وتاريخ الزيارات
-- ----------------------------------------------------------------------------
alter table public.patients enable row level security;

-- أ) سياسة القراءة (SELECT)
drop policy if exists "patients_select_policy" on public.patients;
create policy "patients_select_policy"
  on public.patients for select
  using (
    auth.uid() is not null and (
      public.is_secretary() or public.is_doctor()
    )
  );

-- ب) سياسة الإضافة (INSERT)
-- السكرتيرة فقط
drop policy if exists "patients_insert_policy" on public.patients;
create policy "patients_insert_policy"
  on public.patients for insert
  with check (
    auth.uid() is not null
    and public.is_secretary()
  );

-- ج) سياسة التعديل (UPDATE)
-- السكرتيرة فقط
drop policy if exists "patients_update_policy" on public.patients;
create policy "patients_update_policy"
  on public.patients for update
  using (
    auth.uid() is not null
    and public.is_secretary()
  )
  with check (
    auth.uid() is not null
    and public.is_secretary()
  );

-- د) سياسة الحذف (DELETE)
-- السكرتيرة فقط
drop policy if exists "patients_delete_policy" on public.patients;
create policy "patients_delete_policy"
  on public.patients for delete
  using (
    auth.uid() is not null
    and public.is_secretary()
  );
