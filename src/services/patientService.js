import { supabase } from '../lib/supabase';
import {
  localGetPatients,
  localAddPatient,
  localGetPatientById,
  localUpdatePatient,
  localGetAppointments,
  localGetInvoices,
  localAddAppointment,
  localGetPatientVisits,
} from '../lib/resilientDb.js';

/**
 * دالة مساعدة لتطبيق مهلة زمنية (Timeout) على استعلامات قاعدة البيانات
 * @param {Promise} promise
 * @param {number} ms
 */
function withTimeout(promise, ms = 3000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`انتهت مهلة استجابة قاعدة البيانات (${ms}ms)`)), ms)
    ),
  ]);
}

/**
 * توحيد صيغة رقم الهاتف لإجراء مقارنات وفحص التكرار بدقة
 * @param {string} phone
 * @returns {string}
 */
export function normalizePhoneNumber(phone) {
  if (!phone) return '';
  return String(phone).replace(/[\s\-\(\)\+]/g, '').trim();
}

/**
 * فحص ما إذا كان هناك مريض مسجل مسبقاً بنفس رقم الهاتف
 * يبحث في قاعدة بيانات Supabase وفي السجل المحلي المتزامن
 *
 * @param {string} phone
 * @returns {Promise<Object|null>} المريض المسجل مسبقاً أو null
 */
export async function checkDuplicatePhone(phone) {
  const clean = normalizePhoneNumber(phone);
  if (!clean) return null;

  // 1. محاولة الفحص في خادم Supabase
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('patients')
        .select('id, full_name, phone')
        .limit(100),
      2500
    );

    if (!error && data && Array.isArray(data)) {
      const remoteMatch = data.find((p) => normalizePhoneNumber(p.phone) === clean);
      if (remoteMatch) return remoteMatch;
    }
  } catch (err) {
    console.warn('[Console Debug - تعذر فحص التكرار سحابياً، الفحص محلياً]:', err.message);
  }

  // 2. الفحص في قاعدة البيانات المحلية المتزامنة
  const localList = localGetPatients();
  const localMatch = localList.find((p) => normalizePhoneNumber(p.phone) === clean);
  return localMatch || null;
}

/**
 * إضافة مريض جديد إلى جدول patients في Supabase مع مطابقة الأعمدة الفعلية
 * والتعامل الآمن مع انقطاع الاتصال وسياسات الوصول (RLS) وفحص تكرار رقم الهاتف
 *
 * @param {Object} patientData
 * @returns {Promise<{ success: boolean, patient?: Object, isDuplicate?: boolean, existingPatient?: Object, isFallback?: boolean, message: string }>}
 */
export async function createPatient(patientData) {
  const {
    fullName,
    phone,
    dateOfBirth,
    gender,
    address,
    bloodType,
    allergies,
    notes,
  } = patientData;

  // فحص وجود مريض مسجل بنفس رقم الهاتف مسبقاً
  if (phone && phone.trim()) {
    const existing = await checkDuplicatePhone(phone);
    if (existing) {
      return {
        success: false,
        isDuplicate: true,
        existingPatient: existing,
        message: `يوجد مريض مسجل مسبقاً بنفس رقم الهاتف (${existing.full_name}). لا يمكن تكرار تسجيل نفس رقم الهاتف.`,
      };
    }
  }

  // إعداد حمولة البيانات المتطابقة حصراً مع أعمدة جدول patients الفعلي
  const supabasePayload = {
    full_name: fullName.trim(),
    phone: phone && phone.trim() ? phone.trim() : null,
  };

  try {
    // محاولة إدخال السجل في قاعدة بيانات Supabase الحالية
    const { data, error } = await withTimeout(
      supabase
        .from('patients')
        .insert([supabasePayload])
        .select()
        .single(),
      3000
    );

    if (error) {
      throw error;
    }

    if (data && data.id) {
      // حفظ النسخة الكاملة متضمنة الحقول الاختيارية محلياً لتكون متوفرة في صفحة ملف المريض
      const fullPatient = localAddPatient({
        id: data.id,
        fullName: data.full_name || fullName,
        phone: data.phone || phone,
        dateOfBirth,
        gender,
        address,
        bloodType,
        allergies,
        notes,
      });

      return {
        success: true,
        patient: fullPatient,
        isFallback: false,
        message: 'تم حفظ ملف المريض بنجاح في قاعدة بيانات Supabase!',
      };
    }
  } catch (err) {
    // تسجيل التفاصيل التقنية في Console فقط دون إظهارها للمستخدم
    console.error('[Console Debug - خطأ تقني في حفظ المريض في Supabase]:', {
      error: err,
      message: err.message,
      code: err.code,
      details: err.details,
    });

    let arabicWarning = 'تعذر الاتصال المباشر بخادم قاعدة البيانات السحابية، وتم حفظ ملف المريض بنجاح في قاعدة البيانات المحلية الاحتياطية لتفادي فقدان البيانات.';

    if (err && (err.code === '42501' || String(err.message || '').includes('policy') || String(err.message || '').includes('row-level security'))) {
      arabicWarning = 'تم حفظ المريض في قاعدة البيانات المحلية نظراً لقيود صلاحيات الوصول (RLS) على خادم السحابة.';
    }

    // حفظ المريض محلياً لضمان عدم ضياع البيانات وتوليد معرّف صالح
    const localPatient = localAddPatient({
      fullName,
      phone,
      dateOfBirth,
      gender,
      address,
      bloodType,
      allergies,
      notes,
    });

    return {
      success: true,
      patient: localPatient,
      isFallback: true,
      message: arabicWarning,
    };
  }

  // في حال عدم رجوع بيانات
  const fallbackPatient = localAddPatient({
    fullName,
    phone,
    dateOfBirth,
    gender,
    address,
    bloodType,
    allergies,
    notes,
  });

  return {
    success: true,
    patient: fallbackPatient,
    isFallback: true,
    message: 'تم حفظ ملف المريض بنجاح في قاعدة البيانات المحلية الاحتياطية.',
  };
}

/**
 * جلب قائمة المرضى المسجلين ديناميكياً من Supabase
 * مع دعم التراجع التلقائي لقاعدة البيانات المحلية عند تعذر الاتصال
 *
 * @returns {Promise<Array>}
 */
export async function fetchPatientsList() {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false }),
      3000
    );

    if (error) {
      throw error;
    }

    if (data && Array.isArray(data)) {
      // دمج بيانات السجلات مع أي تفاصيل إضافية محلية
      const localPatients = localGetPatients();
      const localMap = new Map(localPatients.map((p) => [p.id, p]));

      return data.map((remote) => {
        const local = localMap.get(remote.id) || {};
        return {
          ...local,
          ...remote,
          full_name: remote.full_name || local.full_name || 'مريض بدون اسم',
          phone: remote.phone || local.phone || '—',
          created_at: remote.created_at || local.created_at || new Date().toISOString(),
        };
      });
    }
  } catch (err) {
    console.warn(
      '[Console Debug - تعذر جلب قائمة المرضى من Supabase، استخدام قاعدة البيانات المحلية]:',
      err.message || err
    );
  }

  // استخدام قاعدة البيانات المحلية
  const localList = localGetPatients();
  return [...localList].sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );
}

/**
 * جلب تفاصيل مريض محدد بواسطة المعرف
 *
 * @param {string} patientId
 * @returns {Promise<Object|null>}
 */
export async function fetchPatientById(patientId) {
  if (!patientId) return null;

  // البحث أولاً في الذاكرة المحلية
  const local = localGetPatientById(patientId);

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single(),
      2500
    );

    if (!error && data) {
      return {
        ...(local || {}),
        ...data,
      };
    }
  } catch (err) {
    console.warn('[Console Debug - استرجاع المريض محلياً لتعذر الاتصال بسوبابيز]:', err.message);
  }

  return local || null;
}

/**
 * حساب العمر الحالي بدقة انطلاقاً من تاريخ الميلاد
 * @param {string} dateOfBirth YYYY-MM-DD
 * @returns {string} العمر بالسنوات أو 'غير محدد'
 */
export function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return 'غير محدد';
  const birthDate = new Date(dateOfBirth);
  if (isNaN(birthDate.getTime())) return 'غير محدد';

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age >= 0 ? `${age} سنة` : 'غير محدد';
}

/**
 * جلب قائمة المواعيد والحجوزات الخاصة بمريض محدد عبر معرف المريض
 * @param {string} patientId
 * @returns {Promise<Array>}
 */
export async function fetchPatientAppointments(patientId) {
  if (!patientId) return [];

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('appointments')
        .select('*')
        .eq('patient_id', patientId)
        .order('appointment_date', { ascending: false }),
      2500
    );

    if (!error && Array.isArray(data)) {
      return data;
    }
  } catch (err) {
    console.warn('[Console Debug - جلب مواعيد المريض محلياً لتعذر الاتصال بسوبابيز]:', err.message);
  }

  const localAll = localGetAppointments();
  return localAll
    .filter((a) => a.patient_id === patientId)
    .sort((a, b) => new Date(b.appointment_date || 0).getTime() - new Date(a.appointment_date || 0).getTime());
}

/**
 * جلب قائمة الفواتير الخاصة بمريض محدد للعرض واحتساب مبالغ السداد ديناميكياً
 * @param {string} patientId
 * @returns {Promise<Array>}
 */
export async function fetchPatientInvoices(patientId) {
  if (!patientId) return [];

  const localAll = localGetInvoices();
  const localPatientInvs = localAll
    .filter((inv) => inv.patient_id === patientId)
    .sort((a, b) => new Date(b.issue_date || 0).getTime() - new Date(a.issue_date || 0).getTime());

  if (isSupabaseHealthy !== false) {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('invoices')
          .select('*')
          .eq('patient_id', patientId)
          .order('issue_date', { ascending: false }),
        2500
      );

      if (!error && Array.isArray(data)) {
        const localMap = new Map(localPatientInvs.map((inv) => [inv.id, inv]));
        return data.map((remote) => {
          const local = localMap.get(remote.id) || {};
          return {
            ...local,
            ...remote,
            paidAmount: local.paidAmount !== undefined ? local.paidAmount : (remote.status === 'مدفوعة' ? Number(remote.amount || 0) : 0),
            remainingAmount: local.remainingAmount !== undefined ? local.remainingAmount : (remote.status === 'مدفوعة' ? 0 : Number(remote.amount || 0)),
            payments: local.payments || [],
          };
        });
      }
    } catch (err) {
      console.warn('[Console Debug - جلب فواتير المريض محلياً لتعذر الاتصال بسوبابيز]:', err.message);
    }
  }

  return localPatientInvs;
}

/**
 * فحص وجلب سجل الزيارات الطبية للمريض مرتبة من الأحدث إلى الأقدم
 * يجلب الزيارات من Supabase ويدمجها مع قاعدة البيانات المحلية المتزامنة
 *
 * @param {string} patientId
 * @returns {Promise<{ exists: boolean, data: Array, error: string|null }>}
 */
export async function fetchPatientVisits(patientId) {
  if (!patientId) {
    return { exists: false, data: [], error: null };
  }

  // 1. جلب الزيارات المسجلة محلياً للمريض (مرتبة تنازلياً)
  const localVisits = localGetPatientVisits(patientId);

  // 2. محاولة الاستعلام من Supabase
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('visits')
        .select('*')
        .eq('patient_id', patientId)
        .order('visit_date', { ascending: false }),
      2000
    );

    if (!error && data && Array.isArray(data)) {
      // دمج السجلات السحابية مع المحلية مع منع التكرار بمعرف الزيارة
      const visitsMap = new Map();
      localVisits.forEach((v) => visitsMap.set(v.id, v));
      data.forEach((v) => visitsMap.set(v.id, v));

      const merged = Array.from(visitsMap.values()).sort(
        (a, b) => new Date(b.visit_date || b.created_at || 0).getTime() - new Date(a.visit_date || a.created_at || 0).getTime()
      );

      return { exists: true, data: merged, error: null };
    }
  } catch (err) {
    // في حال عدم توفر السحابة أو عدم وجود الجدول سحابياً بعد، نعتمد البيانات المحلية
    console.warn('[PatientService - Fetch Visits Supabase Fallback]:', err.message);
  }

  return {
    exists: true, // تفعيل سجل الزيارات في النظام
    data: localVisits, // مرتبة بالفعل من الأحدث إلى الأقدم
    error: null,
  };
}

/**
 * تحديث البيانات الأساسية للمريض وحفظها في Supabase وقاعدة البيانات المحلية
 * @param {string} patientId
 * @param {Object} updateData
 * @returns {Promise<{ success: boolean, patient: Object, message: string }>}
 */
export async function updatePatientInfo(patientId, updateData) {
  if (!patientId) return { success: false, message: 'معرف المريض مفقود' };

  // تحديث السجل في قاعدة البيانات المحلية المتزامنة
  const localUpdated = localUpdatePatient(patientId, updateData);

  try {
    const supabasePayload = {};
    if (updateData.fullName) supabasePayload.full_name = updateData.fullName.trim();
    if (updateData.phone !== undefined) supabasePayload.phone = updateData.phone ? updateData.phone.trim() : null;

    if (Object.keys(supabasePayload).length > 0) {
      await withTimeout(
        supabase
          .from('patients')
          .update(supabasePayload)
          .eq('id', patientId)
          .select()
          .single(),
        2500
      );
    }
  } catch (err) {
    console.warn('[Console Debug - تعذر مزامنة تحديث المريض سحابياً، التحديث محلي]:', err.message);
  }

  return {
    success: true,
    patient: localUpdated,
    message: 'تم تحديث بيانات ملف المريض بنجاح!',
  };
}

/**
 * حجز موعد جديد للمريض وربطه بـ patient_id
 * @param {string} patientId
 * @param {Object} appointmentData
 * @returns {Promise<{ success: boolean, appointment: Object, message: string }>}
 */
export async function bookPatientAppointment(
  patientId,
  {
    doctorId = 'doc-internal',
    appointmentDate,
    status = 'مؤكد',
    visitType = 'كشف جديد',
    reason = '',
    notes = '',
  }
) {
  if (!patientId) return { success: false, message: 'معرف المريض مفقود' };

  const localApt = localAddAppointment({
    patientId,
    doctorId,
    appointmentDate,
    status,
    visitType,
    reason,
    notes,
  });

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('appointments')
        .insert([
          {
            patient_id: patientId,
            appointment_date: appointmentDate,
            status,
            notes: notes || null,
          },
        ])
        .select()
        .single(),
      2500
    );

    if (!error && data) {
      return { success: true, appointment: data, message: 'تم تسجيل الموعد بنجاح!' };
    }
  } catch (err) {
    console.warn('[Console Debug - تم تسجيل الموعد محلياً لتعذر الاتصال بسوبابيز]:', err.message);
  }

  return { success: true, appointment: localApt, message: 'تم تسجيل الموعد بنجاح في قاعدة البيانات!' };
}

