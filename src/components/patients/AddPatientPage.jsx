import React from 'react';
import { usePatientForm } from '../../hooks/usePatientForm.js';
import {
  UserPlusIcon,
  CheckIcon,
  CloseIcon,
  ArrowRightIcon,
  AlertCircleIcon,
} from '../dashboard/Icons.jsx';

/**
 * مكون صفحة إضافة مريض جديد (AddPatientPage)
 * واجهة عربية متكاملة (RTL) ومتجاوبة (عمودان على الديسكتوب، عمود واحد على الموبايل)
 * تعتمد على hook usePatientForm لفصل المنطق والتحضير للربط مع Supabase
 *
 * @param {Object} props
 * @param {Function} props.onCancel دالة الإلغاء للعودة للشاشة السابقة
 * @param {Function} props.onSaveSuccess دالة اختيارية تنفذ عند حفظ البيانات بنجاح
 */
export function AddPatientPage({ onCancel, onSaveSuccess }) {
  const {
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
  } = usePatientForm({
    onSuccess: (patient) => {
      if (onSaveSuccess && patient?.id) {
        // انتقال سلس إلى صفحة ملف المريض باستخدام المعرف
        setTimeout(() => {
          onSaveSuccess(patient.id);
        }, 1200);
      }
    },
  });

  return (
    <div className="add-patient-wrapper" dir="rtl">
      {/* 1. ترويسة الصفحة ومسار التنقل */}
      <div className="patient-page-header">
        <div className="patient-header-content">
          <div className="patient-header-icon-box">
            <UserPlusIcon size={26} />
          </div>
          <div className="patient-header-text">
            <div className="patient-breadcrumb">
              <button
                type="button"
                onClick={onCancel}
                className="breadcrumb-link"
              >
                المرضى
              </button>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">إضافة مريض جديد</span>
            </div>
            <h1 className="patient-main-title">إضافة مريض جديد</h1>
            <p className="patient-subtitle">
              أدخل البيانات الشخصية والطبية لإنشاء ملف طبي جديد للمريض في العيادة
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="btn-action-secondary patient-back-btn"
          aria-label="الرجوع إلى صفحة المرضى"
        >
          <ArrowRightIcon size={16} />
          <span>رجوع</span>
        </button>
      </div>

      {/* 2. إشعار النجاح عند الحفظ (رسالة واحدة فقط) */}
      {submitStatus === 'success' && (
        <div className="patient-alert-success" role="alert">
          <div className="alert-icon-wrap">
            <CheckIcon size={22} />
          </div>
          <div className="alert-body">
            <strong className="alert-title">
              {feedbackMessage || 'تم حفظ ملف المريض بنجاح في قاعدة البيانات!'}
            </strong>
            <p className="alert-description">
              تم تسجيل المريض (<strong>{formData.fullName}</strong>) بنجاح برقم المعرّف:{' '}
              <span className="font-numeric font-bold">{savedPatient?.id || '—'}</span>.
              جاري نقلك تلقائياً إلى صفحة ملف المريض...
            </p>
          </div>
          <div className="alert-actions">
            {savedPatient?.id && onSaveSuccess && (
              <button
                type="button"
                onClick={() => onSaveSuccess(savedPatient.id)}
                className="btn-action-primary btn-sm"
              >
                الانتقال لملف المريض فوراً ←
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. إشعار التنبيه في حال وجود أخطاء أو فشل الحفظ مع زر إعادة المحاولة */}
      {submitStatus === 'error' && (
        <div className="patient-alert-danger" role="alert">
          <div className="alert-icon-wrap">
            <AlertCircleIcon size={20} />
          </div>
          <div className="alert-body">
            <strong className="alert-title">
              {duplicatePatient ? 'تنبيه: مريض مسجل مسبقاً' : 'تعذر إتمام عملية الحفظ:'}
            </strong>
            <p className="alert-description">
              {feedbackMessage || 'يرجى مراجعة الحقول المطلوبة والمحاولة مرة أخرى.'}
            </p>
          </div>
          <div className="alert-actions">
            {duplicatePatient && onSaveSuccess ? (
              <button
                type="button"
                onClick={() => onSaveSuccess(duplicatePatient.id)}
                className="btn-action-primary btn-sm"
              >
                عرض ملف المريض الحالي ←
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="btn-action-secondary btn-sm"
              >
                {isSubmitting ? 'جاري المحاولة...' : 'إعادة المحاولة ↻'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. بطاقة النموذج الرئيسية */}
      <div className="patient-form-card">
        <div className="card-top-info">
          <span className="info-badge">
            <span className="info-badge-dot" />
            استمارة التسجيل
          </span>
          <span className="required-note">
            الحقول المشار إليها بعلامة (<span className="text-danger">*</span>) هي حقول إجبارية.
          </span>
        </div>

        <form onSubmit={handleSubmit} className="patient-form" noValidate>
          {/* شبكة الحقول المتجاوبة: عمودان على الديسكتوب، عمود واحد على الهاتف */}
          <div className="patient-fields-grid">
            {/* الحقل 1: الاسم الكامل (إجباري) */}
            <div className={`form-field-group ${errors.fullName ? 'has-error' : ''}`}>
              <label htmlFor="patient-full-name" className="field-label">
                الاسم الكامل <span className="required-star">*</span>
              </label>
              <input
                id="patient-full-name"
                name="fullName"
                type="text"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="مثال: محمد أحمد عبد الله"
                className={`field-input ${errors.fullName ? 'field-input-error' : ''}`}
                aria-required="true"
                aria-invalid={!!errors.fullName}
              />
              {errors.fullName && (
                <span className="field-error-msg">{errors.fullName}</span>
              )}
            </div>

            {/* الحقل 2: رقم الهاتف (إجباري) */}
            <div className={`form-field-group ${errors.phone ? 'has-error' : ''}`}>
              <label htmlFor="patient-phone" className="field-label">
                رقم الهاتف <span className="required-star">*</span>
              </label>
              <input
                id="patient-phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                placeholder="01xxxxxxxxx أو 05xxxxxxxxx"
                className={`field-input font-numeric ${errors.phone ? 'field-input-error' : ''}`}
                dir="ltr"
                aria-required="true"
                aria-invalid={!!errors.phone}
              />
              {errors.phone && (
                <span className="field-error-msg">{errors.phone}</span>
              )}
            </div>

            {/* الحقل 3: تاريخ الميلاد (اختياري - يمنع التواريخ المستقبلية) */}
            <div className={`form-field-group ${errors.dateOfBirth ? 'has-error' : ''}`}>
              <label htmlFor="patient-dob" className="field-label">
                تاريخ الميلاد <span className="optional-tag">(اختياري)</span>
              </label>
              <input
                id="patient-dob"
                name="dateOfBirth"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={formData.dateOfBirth}
                onChange={handleChange}
                className={`field-input font-numeric ${errors.dateOfBirth ? 'field-input-error' : ''}`}
                aria-invalid={!!errors.dateOfBirth}
              />
              {errors.dateOfBirth && (
                <span className="field-error-msg">{errors.dateOfBirth}</span>
              )}
            </div>

            {/* الحقل 4: النوع (اختياري) */}
            <div className="form-field-group">
              <label htmlFor="patient-gender" className="field-label">
                النوع <span className="optional-tag">(اختياري)</span>
              </label>
              <select
                id="patient-gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="field-select"
              >
                <option value="">-- اختر النوع --</option>
                <option value="ذكر">ذكر</option>
                <option value="أنثى">أنثى</option>
              </select>
            </div>

            {/* الحقل 5: فصيلة الدم (اختياري) */}
            <div className="form-field-group">
              <label htmlFor="patient-blood-type" className="field-label">
                فصيلة الدم <span className="optional-tag">(اختياري)</span>
              </label>
              <select
                id="patient-blood-type"
                name="bloodType"
                value={formData.bloodType}
                onChange={handleChange}
                className="field-select"
              >
                <option value="">-- اختر فصيلة الدم --</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>

            {/* الحقل 6: العنوان (اختياري) */}
            <div className="form-field-group">
              <label htmlFor="patient-address" className="field-label">
                العنوان <span className="optional-tag">(اختياري)</span>
              </label>
              <input
                id="patient-address"
                name="address"
                type="text"
                value={formData.address}
                onChange={handleChange}
                placeholder="مثال: القاهرة، المعادي / الرياض، حي الملز"
                className="field-input"
              />
            </div>

            {/* الحقل 7: الحساسية أو الأمراض المزمنة (اختياري - يمتد على كامل العرض) */}
            <div className="form-field-group field-span-full">
              <label htmlFor="patient-allergies" className="field-label">
                الحساسية أو الأمراض المزمنة <span className="optional-tag">(اختياري)</span>
              </label>
              <textarea
                id="patient-allergies"
                name="allergies"
                rows={3}
                value={formData.allergies}
                onChange={handleChange}
                placeholder="مثال: حساسية بنسلين، سكري من النوع الثاني، ضغط دم مرتفع، ربو..."
                className="field-textarea"
              />
              <span className="field-hint">
                اذكر أي حساسية دوائية أو حالات صحية حرجة لتظهر في سجل المريض للطبيب.
              </span>
            </div>

            {/* الحقل 8: ملاحظات عامة (اختياري - يمتد على كامل العرض) */}
            <div className="form-field-group field-span-full">
              <label htmlFor="patient-notes" className="field-label">
                ملاحظات عامة <span className="optional-tag">(اختياري)</span>
              </label>
              <textarea
                id="patient-notes"
                name="notes"
                rows={3}
                value={formData.notes}
                onChange={handleChange}
                placeholder="أي ملاحظات إضافية حول المريض أو تفضيلات التواصل أو الزيارة الأولى..."
                className="field-textarea"
              />
            </div>
          </div>

          {/* أزرار الإجراءات السفلية: حفظ المريض وإلغاء */}
          <div className="patient-form-actions">
            <button
              type="button"
              onClick={onCancel}
              className="btn-form-cancel"
              disabled={isSubmitting}
            >
              <CloseIcon size={18} />
              <span>إلغاء</span>
            </button>

            <button
              type="submit"
              className="btn-form-save"
              disabled={isSubmitting}
            >
              <CheckIcon size={18} />
              <span>{isSubmitting ? 'جاري الحفظ…' : 'حفظ المريض'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddPatientPage;
