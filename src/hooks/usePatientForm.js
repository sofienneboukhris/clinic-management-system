import { useState, useRef } from 'react';
import { createPatient } from '../services/patientService.js';

/**
 * القيم الابتدائية لنموذج إضافة مريض جديد
 */
const initialFormState = {
  fullName: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  address: '',
  bloodType: '',
  allergies: '',
  notes: '',
};

/**
 * خطاف مخصص (Custom Hook) لإدارة حالة نموذج تسجيل المريض
 * يتضمن:
 * - التحقق الشامل من صحة المدخلات بالعربية قبل الإرسال
 * - منع اختيار أو إرسال تواريخ ميلاد في المستقبل
 * - التحقق من صيغة رقم الهاتف المتوافقة مع أرقام المشروع
 * - منع الإرسال المزدوج (Double-submission) عبر قفل متزامن
 * - فحص تكرار رقم الهاتف وعرض تنبيه واضح دون إنشاء سجل مكرر
 *
 * @param {Object} options
 * @param {Function} [options.onSuccess] دالة رد نداء اختيارية عند نجاح التحقق/الحفظ
 */
export function usePatientForm({ onSuccess } = {}) {
  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success' | 'error' | null
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const [savedPatient, setSavedPatient] = useState(null);
  const [duplicatePatient, setDuplicatePatient] = useState(null);

  // قفل متزامن فوري لمنع الإرسال المزدوج عند النقر السريع المتتالي
  const isSubmittingRef = useRef(false);

  /**
   * تحديث قيمة أي حقل في النموذج ومسح الخطأ المرتبط به عند الكتابة
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // إزالة رسالة الخطأ الخاصة بالحقل بمجرد بدء التعديل عليه
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: null,
      }));
    }

    if (submitStatus) {
      setSubmitStatus(null);
      setFeedbackMessage(null);
    }

    if (duplicatePatient && name === 'phone') {
      setDuplicatePatient(null);
    }
  };

  /**
   * التحقق الصارم من الحقول الإجبارية وصيغتها قبل أي إرسال للبيانات
   */
  const validateForm = () => {
    const newErrors = {};

    // 1. الاسم الكامل (إجباري - لا يقل عن 3 أحرف ويتكون من حروف ومسافات فقط)
    const cleanName = formData.fullName ? formData.fullName.trim() : '';
    if (!cleanName) {
      newErrors.fullName = 'يرجى إدخال الاسم الكامل للمريض (حقل إجباري)';
    } else if (cleanName.length < 3) {
      newErrors.fullName = 'يجب ألا يقل الاسم الكامل عن 3 أحرف';
    } else if (!/^[\p{L}\s.'-]+$/u.test(cleanName)) {
      newErrors.fullName = 'يرجى إدخال اسم صحيح بالحروف فقط دون أرقام أو رموز خاصة';
    }

    // 2. رقم الهاتف (إجباري - التحقق من الصيغة لتكون أرقاماً بين 9 و 15 رقماً)
    const cleanPhone = formData.phone ? String(formData.phone).replace(/[\s\-\(\)\+]/g, '').trim() : '';
    if (!cleanPhone) {
      newErrors.phone = 'يرجى إدخال رقم هاتف المريض (حقل إجباري)';
    } else if (!/^[0-9]{9,15}$/.test(cleanPhone)) {
      newErrors.phone = 'صيغة رقم الهاتف غير صحيحة، يجب أن يحتوي على أرقام فقط بين 9 و 15 رقماً (مثال: 01xxxxxxxxx أو 05xxxxxxxxx)';
    }

    // 3. تاريخ الميلاد (اختياري - ولكن يمنع قطعيًا أي تاريخ في المستقبل)
    if (formData.dateOfBirth) {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const dob = new Date(formData.dateOfBirth);

      if (isNaN(dob.getTime())) {
        newErrors.dateOfBirth = 'صيغة تاريخ الميلاد غير صالحة';
      } else if (dob > today) {
        newErrors.dateOfBirth = 'لا يمكن أن يكون تاريخ الميلاد في المستقبل';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * معالجة إرسال النموذج والاتصال بقاعدة بيانات Supabase مع الحماية من النقر المزدوج
   */
  const handleSubmit = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    // منع الإرسال المزدوج تماماً عند النقر المتكرر السريع
    if (isSubmittingRef.current || isSubmitting) {
      console.warn('[Console Debug]: تم تجاهل نقرة متكررة أثناء تنفيذ عملية الحفظ الجارية.');
      return false;
    }

    // التحقق من الحقول قبل الشروع في الإرسال
    const isValid = validateForm();
    if (!isValid) {
      setSubmitStatus('error');
      setFeedbackMessage('يرجى تصحيح الأخطاء الموضحة أدناه بجوار الحقول المطلوبة.');
      return false;
    }

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setSubmitStatus(null);
      setFeedbackMessage(null);
      setDuplicatePatient(null);

      // استدعاء خدمة إضافة المريض إلى Supabase مع فحص التكرار
      const result = await createPatient(formData);

      // في حال اكتشاف مريض مسجل مسبقاً بنفس رقم الهاتف
      if (result.isDuplicate) {
        setDuplicatePatient(result.existingPatient);
        setSubmitStatus('error');
        setFeedbackMessage(result.message);
        setErrors((prev) => ({
          ...prev,
          phone: 'رقم الهاتف هذا مسجل مسبقاً لمريض آخر',
        }));
        return false;
      }

      if (result.success && result.patient) {
        setSavedPatient(result.patient);
        setSubmitStatus('success');
        setFeedbackMessage(result.message || 'تم حفظ ملف المريض بنجاح في قاعدة البيانات!');

        if (onSuccess) {
          onSuccess(result.patient);
        }

        return true;
      } else {
        throw new Error(result.message || 'تعذر إتمام عملية التسجيل.');
      }
    } catch (err) {
      console.error('[Console Debug - فشل إرسال نموذج المريض]:', err);
      setSubmitStatus('error');
      setFeedbackMessage('حدث خطأ أثناء حفظ ملف المريض. يمكنك إعادة المحاولة بالضغط على الزر أدناه.');
      return false;
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  /**
   * إعادة تعيين النموذج إلى الحالة الأولية
   */
  const resetForm = () => {
    setFormData(initialFormState);
    setErrors({});
    setSubmitStatus(null);
    setFeedbackMessage(null);
    setSavedPatient(null);
    setDuplicatePatient(null);
    isSubmittingRef.current = false;
    setIsSubmitting(false);
  };

  return {
    formData,
    errors,
    isSubmitting,
    submitStatus,
    feedbackMessage,
    savedPatient,
    duplicatePatient,
    handleChange,
    handleSubmit,
    resetForm,
  };
}

export default usePatientForm;
