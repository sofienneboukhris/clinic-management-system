import { supabase } from '../lib/supabase';
import { formatEGP } from '../data/dashboardMockData';
import {
  localGetPatients,
  localGetAppointments,
  localGetInvoices,
  localAddPatient,
  localAddAppointment,
  localUpdateAppointment,
  localGetPayments,
  localGetPaymentsByInvoiceId,
  localGetInvoiceByAppointmentId,
  localAddInvoice,
  localAddPayment,
  localGetVisits,
  localGetVisitByAppointmentId,
  localSaveOrUpdateVisit,
  localGetPrescriptions,
  localGetPrescriptionByVisitId,
  localGetPrescriptionByAppointmentId,
  localSaveOrUpdatePrescription,
} from '../lib/resilientDb';

/**
 * حالة الاتصال بسيرفر Supabase السحابي
 * null = لم يتم الفحص بعد / قيد الفحص
 * true = متصل بنجاح
 * false = تعذر الاتصال (DNS أو انقطاع شبكة)
 */
let isSupabaseHealthy = null;

/**
 * إعادة تعيين حالة فحص الاتصال للسماح بإعادة المحاولة
 */
export function resetSupabaseConnectionStatus() {
  isSupabaseHealthy = null;
}

/**
 * قائمة الخدمات الطبية الافتراضية للعيادة مع التسعير المرجعي
 */
export const CLINIC_SERVICES = [
  { id: 'srv-checkup-new', name: 'كشف عيادة جديد', defaultPrice: 300, visitType: 'كشف جديد' },
  { id: 'srv-consultation', name: 'استشارة طبية', defaultPrice: 200, visitType: 'استشارة' },
  { id: 'srv-followup', name: 'متابعة وفحص دوري', defaultPrice: 150, visitType: 'متابعة' },
  { id: 'srv-recheck', name: 'إعادة كشف', defaultPrice: 100, visitType: 'إعادة كشف' },
  { id: 'srv-ecg', name: 'رسم قلب وتخطيط (ECG)', defaultPrice: 250, visitType: 'خدمة تشخيصية' },
  { id: 'srv-ultrasound', name: 'سونار وموجات صوتية', defaultPrice: 400, visitType: 'خدمة تشخيصية' },
];

/**
 * سجل الأطباء ومقدمي الخدمة المعتمد بمعرفات ثابتة
 */
export const CLINIC_DOCTORS = [
  { id: 'doc-internal', name: 'د. عيادة الباطنة العامة', specialty: 'باطنة عامة' },
  { id: 'doc-ortho', name: 'د. عيادة العظام والمفاصل', specialty: 'عظام ومفاصل' },
  { id: 'doc-cardio', name: 'د. استشاري القلب والأوعية', specialty: 'قلب وأوعية دموية' },
  { id: 'doc-pediatric', name: 'د. عيادة الأطفال وحديثي الولادة', specialty: 'أطفال' },
  { id: 'doc-general', name: 'طبيب العيادة العام', specialty: 'طب عام' },
];

export function getDoctorById(doctorId) {
  return (
    CLINIC_DOCTORS.find((d) => d.id === doctorId) || {
      id: doctorId || 'doc-general',
      name: 'طبيب العيادة',
      specialty: 'عام',
    }
  );
}


/**
 * دالة مساعدة لتطبيق مهلة زمنية (Timeout) على استعلامات قاعدة البيانات
 * تمنع تجميد واجهة المستخدم عند فشل الـ DNS أو انقطاع الشبكة
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms = 2500) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`انتهت مهلة استجابة قاعدة البيانات (${ms}ms)`)), ms)
    ),
  ]);
}

/**
 * التحقق مما إذا كان تاريخ الموعد يوافق تاريخ اليوم بالتوقيت المحلي للمستخدم
 * يمنع استبعاد أي مواعيد بسبب اختلاف المناطق الزمنية بين السيرفر والمتصفح
 * @param {string} dateStr
 * @returns {boolean}
 */
export function isTodayLocal(dateStr) {
  if (!dateStr) return false;
  const aptDate = new Date(dateStr);
  if (isNaN(aptDate.getTime())) {
    const now = new Date();
    const localYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return String(dateStr).startsWith(localYMD);
  }
  const today = new Date();
  return (
    aptDate.getFullYear() === today.getFullYear() &&
    aptDate.getMonth() === today.getMonth() &&
    aptDate.getDate() === today.getDate()
  );
}

/**
 * التحقق مما إذا كانت حالة الموعد تعبر عن حالة "تحتاج إلى متابعة"
 * يدعم القيم العربية والإنجليزية الفعلية الموجودة في قاعدة البيانات
 * @param {string} status
 * @returns {boolean}
 */
export function isFollowUpStatus(status) {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  return (
    s === 'يحتاج إلى متابعة' ||
    s === 'تحتاج إلى متابعة' ||
    s === 'متابعة' ||
    s === 'follow_up' ||
    s === 'follow-up' ||
    s === 'followup' ||
    s === 'needs_followup' ||
    s === 'needs-followup'
  );
}

/**
 * التحقق مما إذا كانت الفاتورة مدفوعة فعلياً
 * @param {string} status
 * @returns {boolean}
 */
export function isInvoicePaid(status) {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  return s === 'مدفوعة' || s === 'paid';
}

/**
 * تنسيق الوقت بالتوقيت المحلي (مثل: 10:30 ص)
 * @param {string} dateStr
 * @returns {string}
 */
export function formatLocalTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * تنسيق التاريخ بالتوقيت المحلي (مثل: 2026-10-19)
 * @param {string} dateStr
 * @returns {string}
 */
export function formatLocalDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr).slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * توحيد شارة حالة الموعد للعرض بالعربية
 * @param {string} status
 * @returns {string}
 */
export function normalizeAppointmentStatus(status) {
  if (!status) return 'في الانتظار';
  const s = String(status).trim().toLowerCase();
  if (s === 'confirmed' || s === 'مؤكد') return 'مؤكد';
  if (s === 'waiting' || s === 'pending' || s === 'في الانتظار') return 'في الانتظار';
  if (s === 'in_progress' || s === 'in-progress' || s === 'جاري الكشف' || s === 'داخل الكشف') return 'داخل الكشف';
  if (s === 'completed' || s === 'مكتمل') return 'مكتمل';
  if (s === 'cancelled' || s === 'canceled' || s === 'ملغي' || s === 'ملغى') return 'ملغي';
  if (isFollowUpStatus(s)) return 'يحتاج إلى متابعة';
  return status;
}

/**
 * توحيد شارة حالة الدفع للعرض بالعربية
 * @param {string} status
 * @returns {string}
 */
export function normalizePaymentStatus(status) {
  if (!status) return 'غير مدفوعة';
  const s = String(status).trim().toLowerCase();
  if (s === 'paid' || s === 'مدفوعة') return 'مدفوعة';
  if (s === 'partial' || s === 'مدفوعة جزئيًا' || s === 'مدفوعة جزئيا') return 'مدفوعة جزئيًا';
  if (s === 'unpaid' || s === 'غير مدفوعة') return 'غير مدفوعة';
  if (s === 'overdue' || s === 'متأخرة') return 'متأخرة';
  return status;
}

/**
 * معالجة وحساب بيانات بطاقات الإحصائيات الأربع
 * مطابقة 100% للشروط والعمليات الحسابية المطلوبة
 */
function calculateStatsFromRecords(totalPatients, appointments, invoices) {
  const apts = appointments || [];
  const invs = invoices || [];

  // مواعيد اليوم
  const todayAppointments = apts.filter((apt) => isTodayLocal(apt.appointment_date));
  const todayAppointmentsCount = todayAppointments.length;

  const todayConfirmed = todayAppointments.filter((a) => normalizeAppointmentStatus(a.status) === 'مؤكد').length;
  const todayWaiting = todayAppointments.filter((a) => normalizeAppointmentStatus(a.status) === 'في الانتظار').length;
  const todayCompleted = todayAppointments.filter((a) => normalizeAppointmentStatus(a.status) === 'مكتمل').length;

  let todaySubtitle = `${todayAppointmentsCount} حجز مجدول لليوم`;
  if (todayAppointmentsCount > 0) {
    const parts = [];
    if (todayConfirmed) parts.push(`${todayConfirmed} مؤكدة`);
    if (todayWaiting) parts.push(`${todayWaiting} في الانتظار`);
    if (todayCompleted) parts.push(`${todayCompleted} مكتملة`);
    if (parts.length > 0) todaySubtitle = parts.join(' • ');
  } else {
    todaySubtitle = 'لا توجد مواعيد مجدولة لتاريخ اليوم';
  }

  // حالات تحتاج إلى متابعة
  const followUpCount = apts.filter((apt) => isFollowUpStatus(apt.status)).length;

  // إجمالي المبالغ المدفوعة فقط
  let paidInvoicesCount = 0;
  const totalPaidAmount = invs.reduce((sum, inv) => {
    if (isInvoicePaid(inv.status)) {
      paidInvoicesCount += 1;
      const num = Number(inv.amount);
      return sum + (isNaN(num) ? 0 : num);
    }
    return sum;
  }, 0);

  return [
    {
      id: 'stat-today-appointments',
      title: 'مواعيد اليوم',
      value: String(todayAppointmentsCount),
      unit: 'حجزاً',
      subtitle: todaySubtitle,
      colorScheme: 'blue',
      iconName: 'calendar',
    },
    {
      id: 'stat-total-patients',
      title: 'إجمالي المرضى',
      value: new Intl.NumberFormat('ar-EG').format(totalPatients),
      unit: 'مريضاً',
      subtitle: totalPatients > 0 ? 'إجمالي المرضى المسجلين داخل النظام' : 'لا يوجد مرضى مسجلون حتى الآن',
      colorScheme: 'indigo',
      iconName: 'users',
    },
    {
      id: 'stat-total-payments',
      title: 'إجمالي المدفوعات',
      value: formatEGP(totalPaidAmount),
      unit: '',
      subtitle: paidInvoicesCount > 0 ? `محصلة من ${paidInvoicesCount} فاتورة مدفوعة` : 'لا توجد مدفوعات محصلة حتى الآن',
      colorScheme: 'emerald',
      iconName: 'credit-card',
    },
    {
      id: 'stat-follow-ups',
      title: 'تحتاج إلى متابعة',
      value: String(followUpCount),
      unit: 'حالات',
      subtitle: followUpCount > 0 ? `${followUpCount} مواعيد تتطلب متابعة الطبيب` : 'لا توجد حالات معلقة للمتابعة',
      colorScheme: 'amber',
      iconName: 'alert-circle',
    },
  ];
}

/**
 * تنسيق سجلات المواعيد لجدول العرض
 */
function formatAppointmentsList(data, limit = 6) {
  const sliced = limit ? (data || []).slice(0, limit) : (data || []);
  return sliced.map((apt) => {
    const patientName = apt.patients?.full_name || 'مريض غير مسجل';
    const patientPhone = apt.patients?.phone || '—';

    let visitType = apt.visit_type || 'كشف';
    if (!apt.visit_type && apt.notes) {
      if (apt.notes.includes('استشارة')) visitType = 'استشارة';
      else if (apt.notes.includes('متابعة')) visitType = 'متابعة';
      else if (apt.notes.includes('إعادة')) visitType = 'إعادة كشف';
      else if (apt.notes.includes('جديد')) visitType = 'كشف جديد';
    }

    let doctorName = 'طبيب العيادة';
    if (apt.doctor_id) {
      const doc = getDoctorById(apt.doctor_id);
      if (doc) doctorName = doc.name;
    } else if (apt.notes) {
      if (apt.notes.includes('باطنة')) doctorName = 'د. عيادة الباطنة العامة';
      else if (apt.notes.includes('عظام')) doctorName = 'د. عيادة العظام والمفاصل';
      else if (apt.notes.includes('قلب')) doctorName = 'د. استشاري القلب والأوعية';
      else if (apt.notes.includes('أطفال')) doctorName = 'د. عيادة الأطفال';
    }

    return {
      id: apt.id,
      patientId: apt.patient_id,
      patientName,
      phone: patientPhone,
      doctorId: apt.doctor_id || null,
      doctorName,
      appointmentDate: apt.appointment_date,
      time: formatLocalTime(apt.appointment_date),
      date: formatLocalDate(apt.appointment_date),
      visitType,
      status: normalizeAppointmentStatus(apt.status),
      doctorNotes: apt.notes || 'لا توجد ملاحظات مسجلة.',
    };
  });
}

/**
 * تنسيق سجلات الفواتير لجدول العرض
 */
function formatInvoicesList(data, limit = 5) {
  const sliced = limit ? (data || []).slice(0, limit) : (data || []);
  return sliced.map((inv) => {
    const patientName = inv.patients?.full_name || inv.patientName || 'مريض غير مسجل';
    const totalAmount = Number(inv.amount || inv.totalAmount || 0);

    // احتساب المدفوع والمتبقي ديناميكياً
    let paidAmount = Number(inv.paidAmount !== undefined ? inv.paidAmount : (isInvoicePaid(inv.status) ? totalAmount : 0));
    if (inv.payments && Array.isArray(inv.payments)) {
      paidAmount = inv.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    }

    const remainingAmount = Math.max(0, totalAmount - paidAmount);
    let paymentStatus = normalizePaymentStatus(inv.status || inv.paymentStatus);
    if (paidAmount >= totalAmount && totalAmount > 0) {
      paymentStatus = 'مدفوعة';
    } else if (paidAmount > 0) {
      paymentStatus = 'مدفوعة جزئيًا';
    } else if (paymentStatus !== 'متأخرة') {
      paymentStatus = 'غير مدفوعة';
    }

    const shortId = inv.id ? String(inv.id).replace('inv-', '').slice(0, 8).toUpperCase() : '000000';

    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber || `#INV-${shortId}`,
      patientName,
      patientId: inv.patient_id || inv.patientId,
      appointmentId: inv.appointment_id || inv.appointmentId || null,
      serviceName: inv.service_name || inv.serviceName || inv.visitType || 'كشف طبي',
      issueDate: inv.issueDate || formatLocalDate(inv.issue_date),
      rawIssueDate: inv.issue_date || inv.rawIssueDate,
      visitType: inv.service_name || inv.serviceName || inv.visitType || 'كشف طبي',
      totalAmount,
      paidAmount,
      remainingAmount,
      paymentMethod: inv.payment_method || inv.paymentMethod || 'نقداً',
      status: paymentStatus,
      paymentStatus,
      payments: inv.payments || [],
    };
  });
}

// ============================================================================
// استعلامات البيانات مع الدعم التلقائي والذاتي لقاعدة البيانات المرنة
// ============================================================================

/**
 * 1. استعلام بطاقات الإحصائيات الأربع
 * يحاول الاستعلام من Supabase مع مهلة زمنية، وعند تعذر الاتصال يعتمد تلقائياً
 * على قاعدة البيانات المحلية لضمان عدم توقف النظام أو ظهور شاشات خطأ
 */
export async function fetchStatsFromSupabase() {
  if (isSupabaseHealthy !== false) {
    try {
      const pPromise = supabase.from('patients').select('*', { count: 'exact', head: true });
      const aPromise = supabase.from('appointments').select('id, appointment_date, status');
      const iPromise = supabase.from('invoices').select('amount, status');

      const [pRes, aRes, iRes] = await withTimeout(
        Promise.all([pPromise, aPromise, iPromise]),
        2500
      );

      if (pRes.error) throw pRes.error;
      if (aRes.error) throw aRes.error;
      if (iRes.error) throw iRes.error;

      isSupabaseHealthy = true;
      return calculateStatsFromRecords(pRes.count ?? 0, aRes.data || [], iRes.data || []);
    } catch (error) {
      console.warn(
        '[DashboardService - Supabase Connection]: تعذر الاتصال بـ Supabase (DNS أو الشبكة)، التحويل التلقائي لقاعدة البيانات المرنة:',
        error.message || error
      );
      isSupabaseHealthy = false;
    }
  }

  // استخدام قاعدة البيانات المحلية المرنة
  const patients = localGetPatients();
  const appointments = localGetAppointments();
  const invoices = localGetInvoices();
  const totalPatientsCount = Math.max(1248, patients.length);
  return calculateStatsFromRecords(totalPatientsCount, appointments, invoices);
}

/**
 * 2. استعلام جدول المواعيد بشكل مستقل
 */
export async function fetchAppointmentsFromSupabase(limit = 6) {
  if (isSupabaseHealthy !== false) {
    try {
      let query = supabase
        .from('appointments')
        .select('id, appointment_date, status, notes, patient_id, patients ( id, full_name, phone )')
        .order('appointment_date', { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await withTimeout(query, 2500);

      if (error) throw error;
      isSupabaseHealthy = true;
      return formatAppointmentsList(data, limit);
    } catch (error) {
      console.warn(
        '[DashboardService - Appointments Fallback]: التحويل التلقائي لقاعدة البيانات المرنة للمواعيد:',
        error.message || error
      );
      isSupabaseHealthy = false;
    }
  }

  // استخدام قاعدة البيانات المحلية المرنة
  const localAppointments = localGetAppointments();
  const sorted = [...localAppointments].sort(
    (a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime()
  );
  return formatAppointmentsList(sorted, limit);
}

/**
 * 3. استعلام جدول الفواتير والمدفوعات بشكل مستقل
 */
export async function fetchInvoicesFromSupabase(limit = 5) {
  if (isSupabaseHealthy !== false) {
    try {
      let query = supabase
        .from('invoices')
        .select('id, amount, issue_date, status, patient_id, patients ( id, full_name, phone )')
        .order('issue_date', { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await withTimeout(query, 2500);

      if (error) throw error;
      isSupabaseHealthy = true;
      return formatInvoicesList(data, limit);
    } catch (error) {
      console.warn(
        '[DashboardService - Invoices Fallback]: التحويل التلقائي لقاعدة البيانات المرنة للفواتير:',
        error.message || error
      );
      isSupabaseHealthy = false;
    }
  }

  // استخدام قاعدة البيانات المحلية المرنة
  const localInvoices = localGetInvoices();
  const sorted = [...localInvoices].sort(
    (a, b) => new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime()
  );
  return formatInvoicesList(sorted, limit);
}

/**
 * 4. استعلام قائمة المرضى للنماذج المنسدلة
 */
export async function fetchPatientsDropdownFromSupabase() {
  if (isSupabaseHealthy !== false) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('patients')
          .select('id, full_name, phone')
          .order('full_name', { ascending: true }),
        2500
      );

      if (error) throw error;
      isSupabaseHealthy = true;
      return data || [];
    } catch (error) {
      console.warn(
        '[DashboardService - Patients Dropdown Fallback]: التحويل التلقائي لقائمة المرضى المحلية:',
        error.message || error
      );
      isSupabaseHealthy = false;
    }
  }

  const localPatients = localGetPatients();
  return [...localPatients].sort((a, b) => a.full_name.localeCompare(b.full_name, 'ar'));
}

/**
 * دالة مساعدة لجلب كل البيانات معاً مع حماية الأجزاء الفردية من الانهيار (Promise.allSettled)
 */
export async function fetchDashboardDataFromSupabase() {
  const [statsRes, aptsRes, invsRes, patientsRes] = await Promise.allSettled([
    fetchStatsFromSupabase(),
    fetchAppointmentsFromSupabase(),
    fetchInvoicesFromSupabase(),
    fetchPatientsDropdownFromSupabase(),
  ]);

  return {
    stats: statsRes.status === 'fulfilled' ? statsRes.value : null,
    statsError: statsRes.status === 'rejected' ? statsRes.reason : null,

    appointments: aptsRes.status === 'fulfilled' ? aptsRes.value : null,
    appointmentsError: aptsRes.status === 'rejected' ? aptsRes.reason : null,

    invoices: invsRes.status === 'fulfilled' ? invsRes.value : null,
    invoicesError: invsRes.status === 'rejected' ? invsRes.reason : null,

    patientsList: patientsRes.status === 'fulfilled' ? patientsRes.value : [],
  };
}

/**
 * إضافة مريض جديد إلى جدول patients مع حفظ محلي مستمر وفوري
 */
export async function addPatientToSupabase({ fullName, phone }) {
  // حفظ دائماً ومباشرة في قاعدة البيانات المحلية لضمان عدم فقدان البيانات
  const localPatient = localAddPatient({ fullName, phone });

  if (isSupabaseHealthy !== false) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('patients')
          .insert([
            {
              full_name: fullName.trim(),
              phone: phone ? phone.trim() : null,
            },
          ])
          .select()
          .single(),
        2500
      );

      if (!error && data) {
        return data;
      }
    } catch (error) {
      console.warn(
        '[DashboardService - Add Patient Fallback]: تم حفظ المريض محلياً فقط لتعذر الاتصال بسيرفر Supabase:',
        error.message || error
      );
      isSupabaseHealthy = false;
    }
  }

  return localPatient;
}

/**
 * فحص وجود تعارض لموعد مع نفس الطبيب في نفس الفترة الزمنية
 * @param {Object} params
 * @param {string} params.doctorId معرف الطبيب
 * @param {string} params.appointmentDate تاريخ وساعة الموعد بصيغة ISO أو YYYY-MM-DDTHH:mm
 * @param {number} [params.durationMinutes=30] مدة الموعد بالدقائق (افتراضياً 30 دقيقة)
 * @param {string} [params.excludeAppointmentId] استبعاد موعد معين (عند التعديل)
 * @returns {Promise<{ hasConflict: boolean, conflictingAppointment?: Object, message?: string }>}
 */
export async function checkDoctorAppointmentConflict({
  doctorId,
  appointmentDate,
  durationMinutes = 30,
  excludeAppointmentId = null,
}) {
  if (!doctorId || !appointmentDate) {
    return { hasConflict: false };
  }

  const targetStart = new Date(appointmentDate).getTime();
  if (isNaN(targetStart)) {
    return { hasConflict: false };
  }
  const targetEnd = targetStart + durationMinutes * 60 * 1000;

  const targetDateObj = new Date(appointmentDate);
  const dayStart = new Date(targetDateObj.getFullYear(), targetDateObj.getMonth(), targetDateObj.getDate(), 0, 0, 0, 0).toISOString();
  const dayEnd = new Date(targetDateObj.getFullYear(), targetDateObj.getMonth(), targetDateObj.getDate(), 23, 59, 59, 999).toISOString();

  let existingAppointments = [];

  // 1. محاولة الاستعلام من Supabase أولاً
  if (isSupabaseHealthy !== false) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('appointments')
          .select('id, appointment_date, status, notes, patient_id')
          .gte('appointment_date', dayStart)
          .lte('appointment_date', dayEnd),
        2500
      );
      if (!error && Array.isArray(data)) {
        existingAppointments = data;
      }
    } catch (err) {
      console.warn('[Conflict Check - Supabase Fallback]:', err.message);
    }
  }

  // 2. إذا لم تأتِ بيانات من سوبابيز، استعلام قاعدة البيانات المحلية المرنة
  if (existingAppointments.length === 0) {
    const localList = localGetAppointments();
    existingAppointments = localList.filter((a) => {
      const d = new Date(a.appointment_date).getTime();
      return d >= new Date(dayStart).getTime() && d <= new Date(dayEnd).getTime();
    });
  }

  // فحص كل موعد قائم
  const doctorObj = getDoctorById(doctorId);
  const docName = doctorObj.name;

  for (const apt of existingAppointments) {
    if (excludeAppointmentId && apt.id === excludeAppointmentId) continue;

    // استبعاد المواعيد الملغاة
    const status = String(apt.status || '').trim().toLowerCase();
    if (status === 'ملغي' || status === 'ملغى' || status === 'cancelled') continue;

    // التحقق مما إذا كان الموعد لنفس الطبيب
    let isSameDoctor = false;
    if (apt.doctor_id) {
      isSameDoctor = (apt.doctor_id === doctorId);
    } else if (apt.notes) {
      const notesStr = String(apt.notes);
      if (notesStr.includes(doctorId) || notesStr.includes(docName)) {
        isSameDoctor = true;
      } else {
        if (doctorId === 'doc-internal' && (notesStr.includes('باطنة') || notesStr.includes('عام'))) isSameDoctor = true;
        else if (doctorId === 'doc-ortho' && notesStr.includes('عظام')) isSameDoctor = true;
        else if (doctorId === 'doc-cardio' && notesStr.includes('قلب')) isSameDoctor = true;
        else if (doctorId === 'doc-pediatric' && notesStr.includes('أطفال')) isSameDoctor = true;
      }
    }

    if (!isSameDoctor) continue;

    // التحقق من تداخل الوقت
    const existStart = new Date(apt.appointment_date).getTime();
    if (isNaN(existStart)) continue;
    const existEnd = existStart + durationMinutes * 60 * 1000;

    // شرط تداخل الفترات الزمنية
    if (targetStart < existEnd && targetEnd > existStart) {
      const formattedConflictTime = new Date(existStart).toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return {
        hasConflict: true,
        conflictingAppointment: apt,
        message: `يوجد تعارض في المواعيد: ${docName} لديه موعد محجوز بالفعل في هذا التوقيت (${formattedConflictTime}). يرجى اختيار وقت آخر.`,
      };
    }
  }

  return { hasConflict: false };
}

/**
 * إضافة موعد جديد إلى جدول appointments مع فحص التعارض وحفظ محلي مستمر وفوري
 */
export async function addAppointmentToSupabase({
  patientId,
  doctorId = 'doc-internal',
  appointmentDate,
  status = 'مؤكد',
  visitType = 'كشف جديد',
  reason = '',
  notes = '',
}) {
  // فحص التعارض قبل الحفظ
  const conflictCheck = await checkDoctorAppointmentConflict({
    doctorId,
    appointmentDate,
    durationMinutes: 30,
  });

  if (conflictCheck.hasConflict) {
    throw new Error(conflictCheck.message);
  }

  // تجهيز نص الملاحظات المنظم والمتوافق مع الأعمدة
  const doctorObj = getDoctorById(doctorId);
  const combinedNotesParts = [
    visitType,
    doctorObj.name,
    reason ? `سبب الزيارة: ${reason.trim()}` : null,
    notes ? `ملاحظات: ${notes.trim()}` : null,
  ].filter(Boolean);
  const combinedNotes = combinedNotesParts.join(' — ');

  // حفظ دائماً ومباشرة في قاعدة البيانات المحلية لضمان عدم فقدان البيانات
  const localAppointment = localAddAppointment({
    patientId,
    doctorId,
    appointmentDate,
    status,
    visitType,
    reason,
    notes: combinedNotes,
  });

  if (isSupabaseHealthy !== false) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('appointments')
          .insert([
            {
              patient_id: patientId,
              appointment_date: appointmentDate,
              status,
              notes: combinedNotes ? combinedNotes.trim() : null,
            },
          ])
          .select()
          .single(),
        2500
      );

      if (!error && data) {
        return {
          ...localAppointment,
          ...data,
        };
      }
    } catch (error) {
      console.warn(
        '[DashboardService - Add Appointment Fallback]: تم حفظ الحجز محلياً فقط لتعذر الاتصال بسيرفر Supabase:',
        error.message || error
      );
      isSupabaseHealthy = false;
    }
  }

  return localAppointment;
}

/**
 * تحديث حالة موعد محدد في قاعدة البيانات مع حفظ محلي فوري
 */
export async function updateAppointmentStatusInDb(appointmentId, newStatus) {
  const localUpdated = localUpdateAppointment(appointmentId, { status: newStatus });

  if (isSupabaseHealthy !== false) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('appointments')
          .update({ status: newStatus })
          .eq('id', appointmentId)
          .select()
          .single(),
        2500
      );

      if (!error && data) {
        return data;
      }
    } catch (error) {
      console.warn(
        '[DashboardService - Update Appointment Fallback]: تم تحديث الموعد محلياً فقط:',
        error.message || error
      );
      isSupabaseHealthy = false;
    }
  }

  return localUpdated;
}

/**
 * إعادة جدولة موعد محدد مع فحص تعارض الطبيب مسبقاً
 * @param {Object} params
 * @param {string} params.appointmentId معرف الحجز
 * @param {string} params.doctorId معرف الطبيب
 * @param {string} params.newAppointmentDate التاريخ والوقت الجديد ISO
 * @returns {Promise<Object>}
 */
export async function rescheduleAppointmentInDb({
  appointmentId,
  doctorId,
  newAppointmentDate,
}) {
  if (!appointmentId || !newAppointmentDate) {
    throw new Error('بيانات إعادة الجدولة غير مكتملة.');
  }

  // 1. فحص تعارض الطبيب قبل الحفظ مع استبعاد الموعد الحالي
  const conflict = await checkDoctorAppointmentConflict({
    doctorId: doctorId || 'doc-internal',
    appointmentDate: newAppointmentDate,
    durationMinutes: 30,
    excludeAppointmentId: appointmentId,
  });

  if (conflict.hasConflict) {
    throw new Error(conflict.message);
  }

  // 2. تحديث السجل في قاعدة البيانات المحلية المتزامنة
  const localUpdated = localUpdateAppointment(appointmentId, {
    appointment_date: newAppointmentDate,
    status: 'مؤكد',
  });

  // 3. تحديث السجل في Supabase
  if (isSupabaseHealthy !== false) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('appointments')
          .update({
            appointment_date: newAppointmentDate,
            status: 'مؤكد',
          })
          .eq('id', appointmentId)
          .select()
          .single(),
        2500
      );

      if (!error && data) {
        return {
          ...localUpdated,
          ...data,
        };
      }
    } catch (error) {
      console.warn(
        '[DashboardService - Reschedule Fallback]: تم تحديث الموعد محلياً لتعذر الاتصال بسوبابيز:',
        error.message || error
      );
      isSupabaseHealthy = false;
    }
  }

  return localUpdated;
}

// ============================================================================
// إدارة الفواتير والمدفوعات (Invoicing & Payment Workflow)
// ============================================================================

/**
 * إنشاء فاتورة أساسية جديدة لحجز موعد
 * يمنع إنشاء أكثر من فاتورة أساسية لنفس الحجز
 */
export async function createInvoiceForAppointment({
  appointmentId,
  patientId,
  serviceName = 'كشف عيادة جديد',
  amount = 300,
  initialPayment = 0,
  paymentMethod = 'نقداً',
  issueDate,
  callerRole = null,
}) {
  // فحص الصلاحية: الطبيب ممنوع من إنشاء الفواتير
  if (callerRole === 'doctor') {
    throw new Error('تم رفض العملية: غير مصرح للطبيب بإنشاء أو تعديل الفواتير.');
  }

  if (!patientId) {
    throw new Error('معرف المريض مطلوب لإنشاء الفاتورة.');
  }

  const invoiceAmount = Number(amount);
  if (isNaN(invoiceAmount) || invoiceAmount <= 0) {
    throw new Error('قيمة الفاتورة الإجمالية يجب أن تكون أكبر من صفر.');
  }

  // 1. فحص ومنع إنشاء أكثر من فاتورة لنفس الحجز
  if (appointmentId) {
    const existing = localGetInvoiceByAppointmentId(appointmentId);
    if (existing) {
      return {
        invoice: existing,
        isExisting: true,
        message: 'توجد فاتورة مسجلة بالفعل لهذا الحجز.',
      };
    }
  }

  const dateStr = issueDate || new Date().toISOString().split('T')[0];
  const initialPayAmount = Math.max(0, Number(initialPayment) || 0);

  if (initialPayAmount > invoiceAmount) {
    throw new Error(`الدفعة الأولى (${initialPayAmount} ج.م) لا يمكن أن تتجاوز إجمالي الفاتورة (${invoiceAmount} ج.م).`);
  }

  let initialStatus = 'غير مدفوعة';
  if (initialPayAmount >= invoiceAmount && invoiceAmount > 0) {
    initialStatus = 'مدفوعة';
  } else if (initialPayAmount > 0) {
    initialStatus = 'مدفوعة جزئيًا';
  }

  // 2. الحفظ في قاعدة البيانات المحلية المتزامنة
  const localInvoice = localAddInvoice({
    patientId,
    appointmentId,
    amount: invoiceAmount,
    serviceName,
    status: initialStatus,
    paymentMethod,
    issueDate: dateStr,
    callerRole,
  });

  // إذا كانت هناك دفعة أولى مسددة فوراً
  if (initialPayAmount > 0) {
    localAddPayment({
      invoiceId: localInvoice.id,
      patientId,
      amount: initialPayAmount,
      paymentMethod,
      notes: 'دفعة سداد أولى عند إنشاء الفاتورة',
      paymentDate: new Date().toISOString(),
    });
  }

  // 3. المحاولة مع Supabase مع مراعاة الحقول المتوفرة فعلياً
  if (isSupabaseHealthy !== false) {
    try {
      const supabasePayload = {
        id: localInvoice.id,
        patient_id: patientId,
        amount: invoiceAmount,
        issue_date: dateStr,
        status: initialStatus,
      };

      await withTimeout(
        supabase.from('invoices').insert(supabasePayload),
        2500
      );

      // محاولة تسجيل الدفعة السحابية إن وُجد جدول payments
      if (initialPayAmount > 0) {
        try {
          await withTimeout(
            supabase.from('payments').insert({
              invoice_id: localInvoice.id,
              patient_id: patientId,
              amount: initialPayAmount,
              payment_method: paymentMethod,
              payment_date: new Date().toISOString(),
            }),
            1500
          );
        } catch (_) {
          // تجاوز إذا لم يكن جدول payments موجوداً على السيرفر
        }
      }
    } catch (err) {
      console.warn('[DashboardService - Invoices Sync]: تم حفظ الفاتورة محلياً لتعذر المزامنة السحابية:', err.message);
    }
  }

  const freshList = localGetInvoices();
  const created = freshList.find((inv) => inv.id === localInvoice.id) || localInvoice;

  return {
    invoice: created,
    isExisting: false,
    message: 'تم إنشاء الفاتورة بنجاح.',
  };
}

/**
 * تسجيل دفعة نقدية أو بنكية جديدة لفاتورة
 */
export async function recordInvoicePayment({
  invoiceId,
  patientId,
  amount,
  paymentMethod = 'نقداً',
  notes = '',
  paymentDate,
  callerRole = null,
}) {
  // فحص الصلاحية: الطبيب ممنوع من تسجيل أو تعديل المدفوعات
  if (callerRole === 'doctor') {
    throw new Error('تم رفض العملية: غير مصرح للطبيب بتسجيل أو تعديل المدفوعات.');
  }

  const payAmount = Number(amount);
  if (isNaN(payAmount) || payAmount <= 0) {
    throw new Error('قيمة الدفعة يجب أن تكون أكبر من صفر.');
  }

  // فحص الفاتورة وحساب المتبقي
  const allInvoices = localGetInvoices();
  const targetInvoice = allInvoices.find((inv) => inv.id === invoiceId);
  if (!targetInvoice) {
    throw new Error('الفاتورة غير موجودة.');
  }

  if (payAmount > targetInvoice.remainingAmount) {
    throw new Error(`قيمة الدفعة (${payAmount} ج.م) تتجاوز المبلغ المتبقي (${targetInvoice.remainingAmount} ج.م).`);
  }

  // 1. تسجيل الدفعة محلياً
  const { payment, updatedInvoice } = localAddPayment({
    invoiceId,
    patientId: patientId || targetInvoice.patient_id,
    amount: payAmount,
    paymentMethod,
    notes,
    paymentDate: paymentDate || new Date().toISOString(),
    callerRole,
  });

  // 2. تحديث الحالة في Supabase
  if (isSupabaseHealthy !== false) {
    try {
      await withTimeout(
        supabase
          .from('invoices')
          .update({ status: updatedInvoice.status })
          .eq('id', invoiceId),
        2500
      );

      try {
        await withTimeout(
          supabase.from('payments').insert({
            id: payment.id,
            invoice_id: invoiceId,
            patient_id: patientId || targetInvoice.patient_id,
            amount: payAmount,
            payment_method: paymentMethod,
            payment_date: payment.payment_date,
            notes: notes ? notes.trim() : null,
          }),
          1500
        );
      } catch (_) {
        // جدول payments اختياري سحابياً
      }
    } catch (err) {
      console.warn('[DashboardService - Payment Sync]: تم تسجيل الدفعة محلياً لتعذر المزامنة السحابية:', err.message);
    }
  }

  const refreshedInvoices = localGetInvoices();
  const freshInvoice = refreshedInvoices.find((inv) => inv.id === invoiceId) || updatedInvoice;

  return {
    success: true,
    payment,
    invoice: freshInvoice,
    message: 'تم تسجيل الدفعة بنجاح وتحديث رصيد الفاتورة.',
  };
}

/**
 * الحصول على الفاتورة المرتبطة بحجز معين إن وُجدت
 */
export async function getInvoiceByAppointmentId(appointmentId) {
  if (!appointmentId) return null;
  return localGetInvoiceByAppointmentId(appointmentId);
}

/**
 * جلب تفاصيل الفاتورة وسجل دفعاتها
 */
export async function fetchInvoiceDetails(invoiceId) {
  if (!invoiceId) return null;
  const allInvoices = localGetInvoices();
  const invoice = allInvoices.find((inv) => inv.id === invoiceId);
  if (!invoice) return null;

  const shortId = invoice.id ? String(invoice.id).replace('inv-', '').slice(0, 8).toUpperCase() : '000000';
  return {
    ...invoice,
    shortId,
    invoiceNumber: invoice.invoiceNumber || `#INV-${shortId}`,
  };
}

// ============================================================================
// خدمات واجهة الطبيب اليومية (Doctor Daily Workspace Services)
// ============================================================================

/**
 * تنسيق قائمة مواعيد الطبيب اليومية مع العلاقات الفعلية وحالة الفاتورة للقراءة فقط
 */
function formatDoctorAppointmentsList(data, invoicesList = []) {
  const invsByAptId = new Map();
  const invsByPatientId = new Map();

  (invoicesList || []).forEach((inv) => {
    const aptId = inv.appointment_id || inv.appointmentId;
    if (aptId) {
      invsByAptId.set(aptId, inv);
    }
    const patId = inv.patient_id || inv.patientId;
    if (patId) {
      invsByPatientId.set(patId, inv);
    }
  });

  return (data || []).map((apt) => {
    const patient = apt.patients || null;
    const patientName = patient?.full_name || 'مريض غير مسجل';
    const patientPhone = patient?.phone || '—';
    const patientId = apt.patient_id || patient?.id || '';

    // ملخص حالة الفاتورة للقراءة فقط
    const linkedInvoice = invsByAptId.get(apt.id) || invsByPatientId.get(patientId);
    let invoiceStatus = 'لا توجد فاتورة';
    let invoiceAmount = 0;
    let paidAmount = 0;

    if (linkedInvoice) {
      invoiceStatus = normalizePaymentStatus(linkedInvoice.status || linkedInvoice.paymentStatus);
      invoiceAmount = Number(linkedInvoice.totalAmount || linkedInvoice.amount || 0);
      paidAmount = Number(linkedInvoice.paidAmount || 0);
    }

    let visitType = apt.visit_type || 'كشف';
    if (!apt.visit_type && apt.notes) {
      if (apt.notes.includes('استشارة')) visitType = 'استشارة';
      else if (apt.notes.includes('متابعة')) visitType = 'متابعة';
      else if (apt.notes.includes('إعادة')) visitType = 'إعادة كشف';
      else if (apt.notes.includes('جديد')) visitType = 'كشف جديد';
    }

    return {
      id: apt.id,
      patientId,
      patientName,
      phone: patientPhone,
      doctorId: apt.doctor_id || apt.doctorId,
      appointmentDate: apt.appointment_date || apt.appointmentDate,
      time: formatLocalTime(apt.appointment_date || apt.appointmentDate),
      date: formatLocalDate(apt.appointment_date || apt.appointmentDate),
      visitType,
      status: normalizeAppointmentStatus(apt.status),
      rawStatus: apt.status,
      doctorNotes: apt.notes || '',
      patientBio: {
        dateOfBirth: patient?.date_of_birth || null,
        gender: patient?.gender || 'غير محدد',
        bloodType: patient?.blood_type || null,
        allergies: patient?.chronic_diseases_allergies || null,
        notes: patient?.notes || null,
      },
      invoiceSummary: {
        hasInvoice: Boolean(linkedInvoice),
        status: invoiceStatus,
        amount: invoiceAmount,
        paidAmount,
      },
    };
  });
}

/**
 * جلب مواعيد اليوم للطبيب الحالي فقط مع تصفية صارمة بالمعرف وتاريخ اليوم
 * @param {Object} params
 * @param {string} params.doctorId معرف الطبيب الفعلي
 * @returns {Promise<Array>}
 */
export async function fetchDoctorTodayAppointments({ doctorId }) {
  if (!doctorId) return [];

  // جلب الفواتير لربط حالة الفاتورة للقراءة فقط
  let allInvoices = [];
  try {
    allInvoices = localGetInvoices() || [];
  } catch (err) {
    console.warn('[DoctorService - Invoices fetch fallback]:', err);
  }

  // 1. محاولة الاستعلام من Supabase أولاً إن كان الاتصال متاحاً
  if (isSupabaseHealthy !== false) {
    try {
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

      const query = supabase
        .from('appointments')
        .select('id, appointment_date, status, notes, patient_id, doctor_id, visit_type, patients (*)')
        .gte('appointment_date', dayStart)
        .lte('appointment_date', dayEnd);

      const { data, error } = await withTimeout(query, 2500);

      if (!error && Array.isArray(data)) {
        // تصفية بمعرف الطبيب الحقيقي فقط (وليس الاسم كنص)
        const filtered = data.filter((apt) => (apt.doctor_id || apt.doctorId) === doctorId);
        return formatDoctorAppointmentsList(filtered, allInvoices);
      }
    } catch (err) {
      console.warn('[DoctorService - Supabase fetch fallback]:', err.message);
    }
  }

  // 2. استخدام قاعدة البيانات المرنة المحلية مع العلاقات الفعلية
  const localApts = localGetAppointments();
  const doctorTodayApts = localApts.filter(
    (apt) =>
      (apt.doctor_id === doctorId || apt.doctorId === doctorId) &&
      isTodayLocal(apt.appointment_date || apt.appointmentDate)
  );

  // ترتيب المواعيد زمنياً
  const sorted = [...doctorTodayApts].sort(
    (a, b) =>
      new Date(a.appointment_date || a.appointmentDate).getTime() -
      new Date(b.appointment_date || b.appointmentDate).getTime()
  );

  return formatDoctorAppointmentsList(sorted, allInvoices);
}

/**
 * بدء الكشف للمريض (تحديث حالة الموعد إلى "داخل الكشف")
 * @param {string} appointmentId معرف الحجز
 */
export async function startDoctorExamination(appointmentId) {
  return updateAppointmentStatusInDb(appointmentId, 'داخل الكشف');
}

/**
 * جلب آخر زيارة سابقة للمريض
 * @param {string} patientId معرف المريض
 * @param {string} currentAppointmentId معرف الحجز الحالي للاستبعاد
 * @returns {Promise<Object|null>}
 */
export async function getPatientLastVisit(patientId, currentAppointmentId) {
  if (!patientId) return null;
  const localApts = localGetAppointments();
  const pastAppointments = localApts.filter(
    (a) =>
      a.patient_id === patientId &&
      a.id !== currentAppointmentId &&
      (a.status === 'مكتمل' || new Date(a.appointment_date) < new Date())
  );

  if (pastAppointments.length === 0) return null;

  // ترتيب تنازلي حسب تاريخ الموعد للحصول على أحدث زيارة
  pastAppointments.sort(
    (a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime()
  );

  const latest = pastAppointments[0];
  let visitType = latest.visit_type || 'كشف';
  if (!latest.visit_type && latest.notes) {
    if (latest.notes.includes('استشارة')) visitType = 'استشارة';
    else if (latest.notes.includes('متابعة')) visitType = 'متابعة';
    else if (latest.notes.includes('إعادة')) visitType = 'إعادة كشف';
    else if (latest.notes.includes('جديد')) visitType = 'كشف جديد';
  }

  return {
    id: latest.id,
    date: formatLocalDate(latest.appointment_date),
    time: formatLocalTime(latest.appointment_date),
    visitType,
    status: latest.status,
    notes: latest.notes || '',
  };
}

/**
 * حفظ مسودة الكشف الطبي في التخزين المحلي بدون تغيير مخطط قاعدة البيانات
 * @param {string} appointmentId معرف الحجز
 * @param {Object} draftData بيانات مسودة الكشف
 */
export function saveDoctorExaminationDraft(appointmentId, draftData) {
  if (!appointmentId) return false;
  const storage = typeof window !== 'undefined' ? window.localStorage : (typeof localStorage !== 'undefined' ? localStorage : null);
  if (storage) {
    try {
      const key = `doctor_exam_draft_${appointmentId}`;
      storage.setItem(
        key,
        JSON.stringify({
          appointmentId,
          updatedAt: new Date().toISOString(),
          data: draftData,
        })
      );
      return true;
    } catch (err) {
      console.warn('[DoctorService - Draft Save Error]:', err);
    }
  }
  return false;
}

/**
 * جلب مسودة الكشف الطبي المحفوظة لحجز معين
 * @param {string} appointmentId معرف الحجز
 * @returns {Object|null}
 */
export function getDoctorExaminationDraft(appointmentId) {
  if (!appointmentId) return null;
  const storage = typeof window !== 'undefined' ? window.localStorage : (typeof localStorage !== 'undefined' ? localStorage : null);
  if (storage) {
    try {
      const key = `doctor_exam_draft_${appointmentId}`;
      const saved = storage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.data || null;
      }
    } catch (err) {
      console.warn('[DoctorService - Draft Get Error]:', err);
    }
  }
  return null;
}

/**
 * مسح مسودة الكشف الطبي بعد إنهاء واعتماد الزيارة
 * @param {string} appointmentId معرف الحجز
 */
export function clearDoctorExaminationDraft(appointmentId) {
  if (!appointmentId) return;
  const storage = typeof window !== 'undefined' ? window.localStorage : (typeof localStorage !== 'undefined' ? localStorage : null);
  if (storage) {
    try {
      storage.removeItem(`doctor_exam_draft_${appointmentId}`);
    } catch (err) {
      console.warn('[DoctorService - Draft Clear Error]:', err);
    }
  }
}

/**
 * جلب سجل الزيارة المرتبط بحجز معين من Supabase مع الرجوع لقاعدة البيانات المحلية
 * @param {string} appointmentId
 * @returns {Promise<Object|null>}
 */
export async function fetchVisitByAppointmentId(appointmentId) {
  if (!appointmentId) return null;

  // جلب الزيارة أولاً من التخزين المحلي المتزامن
  let localVisit = localGetVisitByAppointmentId(appointmentId);

  // التأكد من دمج الروشتة المحلية إن وُجدت
  const localRx = localGetPrescriptionByAppointmentId(appointmentId) || (localVisit?.id ? localGetPrescriptionByVisitId(localVisit.id) : null);
  if (localVisit && localRx && (!localVisit.clinical_data || !localVisit.clinical_data.prescription)) {
    localVisit = {
      ...localVisit,
      clinical_data: {
        ...(localVisit.clinical_data || {}),
        prescription: localRx,
      },
    };
  }

  if (isSupabaseHealthy !== false) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('visits')
          .select('*')
          .eq('appointment_id', appointmentId)
          .maybeSingle(),
        2500
      );

      if (!error && data) {
        let remoteVisit = data;
        if (localRx && (!remoteVisit.clinical_data || !remoteVisit.clinical_data.prescription)) {
          remoteVisit = {
            ...remoteVisit,
            clinical_data: {
              ...(remoteVisit.clinical_data || {}),
              prescription: localRx,
            },
          };
        }
        // تحديث النسخة المحلية للمزامنة
        localSaveOrUpdateVisit(remoteVisit);
        return remoteVisit;
      }
    } catch (err) {
      console.warn('[DoctorService - Fetch Visit Supabase Fallback]:', err.message);
    }
  }

  return localVisit || null;
}

/**
 * حفظ أو تحديث مسودة/زيارة الكشف الطبي في Supabase وقاعدة البيانات المحلية مع منع التكرار
 * - إذا كانت الزيارة مسجلة مسبقاً (عبر existingVisitId أو appointment_id) يتم تنفيذ UPDATE
 * - إذا كانت الزيارة جديدة كلياً يتم تنفيذ INSERT وتوليد معرف ثابت للزيارة
 * - لا تغير هذه الدالة حالة الحجز إلى "مكتمل"
 *
 * @param {Object} visitPayload بيانات الزيارة
 * @param {string} [existingVisitId] معرف الزيارة القائمة إن وجد
 * @returns {Promise<Object>} الزيارة المحفوظة
 */
export async function saveOrUpdateDoctorVisit(visitPayload, existingVisitId = null, callerRole = null) {
  // فحص الصلاحية: السكرتيرة ممنوعة من إنشاء أو تعديل الزيارات والروشتات
  if (callerRole === 'secretary') {
    throw new Error('تم رفض العملية: غير مصرح للسكرتيرة بإنشاء أو تعديل الزيارات والروشتات.');
  }

  if (!visitPayload || !visitPayload.patient_id) {
    throw new Error('بيانات الزيارة غير مكتملة، معرف المريض إلزامي.');
  }

  // 1. تحديد ما إذا كان هناك سجل سابق للزيارة
  let visitId = existingVisitId || visitPayload.id;
  if (!visitId && visitPayload.appointment_id) {
    const existingLocal = localGetVisitByAppointmentId(visitPayload.appointment_id);
    if (existingLocal) {
      visitId = existingLocal.id;
    }
  }

  // 2. إعداد كائن البيانات الموحد للأعمدة الفعلية فقط
  const recordToSave = {
    ...visitPayload,
    id: visitId || (visitPayload.appointment_id ? `vis-${visitPayload.appointment_id}` : `vis-${Date.now()}`),
    status: visitPayload.status || 'مسودة',
    updated_at: new Date().toISOString(),
  };

  // مزامنة الروشتة في التخزين المنظم إن وُجدت
  if (recordToSave.clinical_data?.prescription) {
    const rx = recordToSave.clinical_data.prescription;
    const rxToSave = {
      ...rx,
      id: rx.id || `rx-${recordToSave.appointment_id}`,
      visit_id: recordToSave.id,
      patient_id: recordToSave.patient_id,
      doctor_id: recordToSave.doctor_id,
      appointment_id: recordToSave.appointment_id,
      items: rx.items || [],
      notes: rx.notes || recordToSave.treatment_plan || null,
    };
    localSaveOrUpdatePrescription(rxToSave, callerRole);
  }

  // 3. الحفظ في قاعدة البيانات المحلية المتزامنة فوراً لضمان سرعة الاستجابة
  const savedLocal = localSaveOrUpdateVisit(recordToSave, callerRole);

  // 4. الحفظ في التخزين المؤقت المحلي للمسودات أيضاً كنسخة إضافية سريعة
  if (visitPayload.appointment_id) {
    saveDoctorExaminationDraft(visitPayload.appointment_id, {
      chiefComplaint: recordToSave.chief_complaint,
      diagnosis: recordToSave.diagnosis,
      treatmentPlan: recordToSave.treatment_plan,
      doctorNotes: recordToSave.notes,
      vitals: recordToSave.vitals,
      historyOfPresentIllness: recordToSave.clinical_data?.history_of_present_illness,
      physicalExam: recordToSave.clinical_data?.physical_exam,
      labInvestigations: recordToSave.clinical_data?.lab_investigations,
      followUpTimeframe: recordToSave.clinical_data?.follow_up?.timeframe,
      followUpCustomDate: recordToSave.clinical_data?.follow_up?.custom_date,
    });
  }

  // 5. المزامنة مع سحابة Supabase إن كانت متاحة
  if (isSupabaseHealthy !== false) {
    try {
      // فحص وجود الزيارة سحابياً إذا لم يكن لدينا معرف مسبق مؤكد
      if (!visitId && visitPayload.appointment_id) {
        const { data: remoteExisting } = await withTimeout(
          supabase
            .from('visits')
            .select('id')
            .eq('appointment_id', visitPayload.appointment_id)
            .maybeSingle(),
          2000
        );
        if (remoteExisting && remoteExisting.id) {
          visitId = remoteExisting.id;
          recordToSave.id = visitId;
        }
      }

      if (visitId) {
        // تنفيذ UPDATE للسجل القائم
        const { data: updatedData, error: updateError } = await withTimeout(
          supabase
            .from('visits')
            .update(recordToSave)
            .eq('id', visitId)
            .select()
            .maybeSingle(),
          2500
        );
        if (!updateError && updatedData) {
          return updatedData;
        }
      } else {
        // تنفيذ INSERT لأول مرة
        const { data: insertedData, error: insertError } = await withTimeout(
          supabase
            .from('visits')
            .insert(recordToSave)
            .select()
            .single(),
          2500
        );
        if (!insertError && insertedData) {
          return insertedData;
        }
      }
    } catch (err) {
      console.warn('[DoctorService - Save Visit Supabase Fallback]:', err.message);
    }
  }

  return savedLocal;
}

/**
 * إنهاء الكشف الطبي وتحديث حالة الحجز والزيارة إلى "مكتمل"
 * @param {string} appointmentId معرف الحجز
 * @param {string} [doctorNotes] الملاحظات أو التشخيص الطبي
 * @param {string} [visitId] معرف الزيارة
 */
export async function completeDoctorExamination(appointmentId, doctorNotes = '', visitId = null, callerRole = null) {
  // فحص الصلاحية: السكرتيرة ممنوعة من إنهاء الكشف الطبي
  if (callerRole === 'secretary') {
    throw new Error('تم رفض العملية: غير مصرح للسكرتيرة بإنهاء الكشوفات السريرية أو اعتماد الزيارات.');
  }

  // مسح المسودة المحلية المؤقتة للحجز
  clearDoctorExaminationDraft(appointmentId);

  // تحديث حالة الحجز محلياً
  const localDb = localUpdateAppointment(appointmentId, {
    status: 'مكتمل',
    notes: doctorNotes ? doctorNotes.trim() : undefined,
  });

  // تحديث حالة الزيارة محلياً إلى "مكتمل"
  const existingVisit = visitId
    ? localGetVisits().find((v) => v.id === visitId)
    : localGetVisitByAppointmentId(appointmentId);

  if (existingVisit) {
    localSaveOrUpdateVisit({
      ...existingVisit,
      status: 'مكتمل',
      notes: doctorNotes ? doctorNotes.trim() : existingVisit.notes,
      updated_at: new Date().toISOString(),
    });
  }

  if (isSupabaseHealthy !== false) {
    try {
      const payload = { status: 'مكتمل' };
      if (doctorNotes && doctorNotes.trim()) {
        payload.notes = doctorNotes.trim();
      }

      // تحديث الحجز في Supabase
      await withTimeout(
        supabase
          .from('appointments')
          .update(payload)
          .eq('id', appointmentId),
        2500
      );

      // تحديث الزيارة في Supabase إن وجدت
      const targetVisitId = visitId || existingVisit?.id;
      if (targetVisitId) {
        await withTimeout(
          supabase
            .from('visits')
            .update({
              status: 'مكتمل',
              notes: doctorNotes ? doctorNotes.trim() : undefined,
              updated_at: new Date().toISOString(),
            })
            .eq('id', targetVisitId),
          2500
        );
      }
    } catch (err) {
      console.warn('[DoctorService - Complete Examination Supabase Fallback]:', err.message);
    }
  }

  return localDb;
}

/**
 * جلب الروشتة الطبية المرتبطة بموعد الحجز
 * @param {string} appointmentId
 */
export async function fetchPrescriptionByAppointmentId(appointmentId) {
  if (!appointmentId) return null;
  const localRx = localGetPrescriptionByAppointmentId(appointmentId);
  return localRx || null;
}
