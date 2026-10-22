-- ============================================================================
-- Rollback Migration: Revert Role-Based Access Control (RBAC) & RLS Policies
-- كود التراجع عن سياسات الأمان الخاصة بالدور واستعادة الوضع السابق
-- غير مدمر للبيانات (Non-destructive: No data loss)
-- ============================================================================

-- 1. إلغاء سياسات جدول الزيارات (public.visits)
drop policy if exists "visits_select_policy" on public.visits;
drop policy if exists "visits_insert_policy" on public.visits;
drop policy if exists "visits_update_policy" on public.visits;
drop policy if exists "visits_delete_policy" on public.visits;

-- 2. إلغاء سياسات جدول الوصفات (public.prescriptions)
drop policy if exists "prescriptions_select_policy" on public.prescriptions;
drop policy if exists "prescriptions_insert_policy" on public.prescriptions;
drop policy if exists "prescriptions_update_policy" on public.prescriptions;
drop policy if exists "prescriptions_delete_policy" on public.prescriptions;

-- 3. إلغاء سياسات جدول الفواتير (public.invoices)
drop policy if exists "invoices_select_policy" on public.invoices;
drop policy if exists "invoices_insert_policy" on public.invoices;
drop policy if exists "invoices_update_policy" on public.invoices;
drop policy if exists "invoices_delete_policy" on public.invoices;

-- 4. إلغاء سياسات جدول المدفوعات (public.payments)
drop policy if exists "payments_select_policy" on public.payments;
drop policy if exists "payments_insert_policy" on public.payments;
drop policy if exists "payments_update_policy" on public.payments;
drop policy if exists "payments_delete_policy" on public.payments;

-- 5. إلغاء سياسات جدول الحجوزات (public.appointments)
drop policy if exists "appointments_select_policy" on public.appointments;
drop policy if exists "appointments_insert_policy" on public.appointments;
drop policy if exists "appointments_update_policy" on public.appointments;
drop policy if exists "appointments_delete_policy" on public.appointments;

-- 6. إلغاء سياسات جدول المرضى (public.patients)
drop policy if exists "patients_select_policy" on public.patients;
drop policy if exists "patients_insert_policy" on public.patients;
drop policy if exists "patients_update_policy" on public.patients;
drop policy if exists "patients_delete_policy" on public.patients;

-- 7. حذف الدوال المساعدة عند الحاجة
drop function if exists public.is_doctor();
drop function if exists public.is_secretary();
drop function if exists public.get_auth_user_role();
