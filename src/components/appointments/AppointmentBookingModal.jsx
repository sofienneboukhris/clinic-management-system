import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarIcon,
  ClockIcon,
  CloseIcon,
  PlusIcon,
  SearchIcon,
  CheckIcon,
  AlertCircleIcon,
  UsersIcon,
  RefreshCwIcon,
} from '../dashboard/Icons.jsx';
import {
  fetchPatientsDropdownFromSupabase,
  addAppointmentToSupabase,
  checkDoctorAppointmentConflict,
  CLINIC_DOCTORS,
  getDoctorById,
} from '../../services/dashboardService.js';

/**
 * الحصول على تاريخ اليوم بالتوقيت المحلي بصيغة YYYY-MM-DD
 */
export function getLocalTodayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * الحصول على الوقت الحالي بالتوقيت المحلي بصيغة HH:mm
 */
export function getLocalCurrentTimeString() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * التحقق مما إذا كان التاريخ والوقت المحددان في الماضي بالنسبة للّحظة الحالية
 * @param {string} dateStr صيغة YYYY-MM-DD
 * @param {string} timeStr صيغة HH:mm
 * @returns {boolean}
 */
export function isDateTimeInPast(dateStr, timeStr) {
  if (!dateStr) return false;
  const now = new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = (timeStr || '00:00').split(':').map(Number);

  const targetDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return targetDate.getTime() < now.getTime();
}

/**
 * مكون نموذج «حجز موعد جديد»
 * متوافق وموحد للفتح من واجهة السكرتيرة ومن ملف المريض
 *
 * @param {Object} props
 * @param {boolean} props.isOpen حالة فتح النافذة المنبثقة
 * @param {Function} props.onClose دالة إغلاق النافذة
 * @param {Function} [props.onSuccess] دالة رد الاتصال عند نجاح حفظ الحجز
 * @param {string} [props.initialPatientId] معرّف المريض للتحديد التلقائي عند الفتح من ملف المريض
 * @param {Object} [props.initialPatient] كائن المريض المحتوي على الاسم ورقم الهاتف
 * @param {Array} [props.patientsList] قائمة المرضى المتاحة (اختياري)
 */
export function AppointmentBookingModal({
  isOpen,
  onClose,
  onSuccess,
  initialPatientId = '',
  initialPatient = null,
  patientsList: initialPatientsList = [],
}) {
  // حالة المريض المختار
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId || '');
  const [selectedPatientData, setSelectedPatientData] = useState(initialPatient || null);

  // قائمة المرضى والبحث (لواجهة السكرتيرة)
  const [patients, setPatients] = useState(initialPatientsList || []);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // حقول النموذج
  const [doctorId, setDoctorId] = useState(CLINIC_DOCTORS[0]?.id || 'doc-internal');
  const [appointmentDate, setAppointmentDate] = useState(getLocalTodayDateString());
  const [appointmentTime, setAppointmentTime] = useState(getLocalCurrentTimeString());
  const [visitType, setVisitType] = useState('كشف جديد');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  // حالات المعالجة والأخطاء
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const todayStr = useMemo(() => getLocalTodayDateString(), []);

  // جلب قائمة المرضى إن لم تكن ممررة
  useEffect(() => {
    if (!isOpen) return;

    if (initialPatientId) {
      setSelectedPatientId(initialPatientId);
      if (initialPatient) {
        setSelectedPatientData(initialPatient);
      }
    }

    if (!initialPatientsList || initialPatientsList.length === 0) {
      setPatientsLoading(true);
      fetchPatientsDropdownFromSupabase()
        .then((data) => {
          setPatients(data || []);
          if (initialPatientId && !initialPatient) {
            const found = (data || []).find((p) => p.id === initialPatientId);
            if (found) setSelectedPatientData(found);
          }
        })
        .catch((err) => {
          console.error('[Console Debug - تعذر جلب قائمة المرضى في نموذج الحجز]:', err);
        })
        .finally(() => {
          setPatientsLoading(false);
        });
    } else {
      setPatients(initialPatientsList);
      if (initialPatientId && !initialPatient) {
        const found = initialPatientsList.find((p) => p.id === initialPatientId);
        if (found) setSelectedPatientData(found);
      }
    }
  }, [isOpen, initialPatientId, initialPatient, initialPatientsList]);

  // تحديث بيانات المريض المختار عند العثور عليه في القائمة
  useEffect(() => {
    if (selectedPatientId && !selectedPatientData && patients.length > 0) {
      const match = patients.find((p) => p.id === selectedPatientId);
      if (match) setSelectedPatientData(match);
    }
  }, [selectedPatientId, selectedPatientData, patients]);

  // تصفية المرضى بالاسم أو رقم الهاتف أو رقم الملف
  const filteredPatients = useMemo(() => {
    if (!patientSearchTerm.trim()) {
      return patients.slice(0, 10);
    }
    const q = patientSearchTerm.trim().toLowerCase();
    return patients.filter((p) => {
      const name = (p.full_name || '').toLowerCase();
      const phone = (p.phone || '').replace(/[\s-]/g, '');
      const id = String(p.id || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || id.includes(q);
    });
  }, [patients, patientSearchTerm]);

  // فحص ما إذا كان التاريخ والوقت في الماضي
  const isTimePast = useMemo(() => {
    return isDateTimeInPast(appointmentDate, appointmentTime);
  }, [appointmentDate, appointmentTime]);

  // التحقق من صحة النموذج وإلزامية الحقول
  const isFormValid = useMemo(() => {
    const hasPatient = Boolean(selectedPatientId);
    const hasDoctor = Boolean(doctorId && doctorId.trim());
    const hasDate = Boolean(appointmentDate);
    const hasTime = Boolean(appointmentTime);
    const hasVisitType = Boolean(visitType && visitType.trim());
    const validTiming = !isTimePast;

    return hasPatient && hasDoctor && hasDate && hasTime && hasVisitType && validTiming;
  }, [selectedPatientId, doctorId, appointmentDate, appointmentTime, visitType, isTimePast]);

  // اختيار مريض من قائمة البحث
  const handleSelectPatient = (patient) => {
    setSelectedPatientId(patient.id);
    setSelectedPatientData(patient);
    setPatientSearchTerm('');
    setIsDropdownOpen(false);
    setFormError(null);
  };

  // إلغاء اختيار المريض لتغييره (في واجهة السكرتيرة فقط)
  const handleClearSelectedPatient = () => {
    if (initialPatientId) return; // ممنوع التغيير إذا كان مفتوحاً من ملف المريض
    setSelectedPatientId('');
    setSelectedPatientData(null);
    setPatientSearchTerm('');
    setIsDropdownOpen(true);
  };

  // معالجة الحفظ النهائي
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (!selectedPatientId) {
      setFormError('يرجى اختيار مريض من قاعدة بيانات المرضى.');
      return;
    }

    if (!doctorId) {
      setFormError('يرجى تحديد الطبيب أو مقدم الخدمة.');
      return;
    }

    if (!appointmentDate || !appointmentTime) {
      setFormError('يرجى تحديد تاريخ ووقت الموعد.');
      return;
    }

    if (isDateTimeInPast(appointmentDate, appointmentTime)) {
      setFormError('لا يمكن حجز موعد في تاريخ أو وقت سابق للحظة الحالية.');
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      const fullTimestamp = `${appointmentDate}T${appointmentTime}:00`;

      // 1. فحص التعارض المسبق لنفس الطبيب في نفس الفترة الزمنية
      const conflictResult = await checkDoctorAppointmentConflict({
        doctorId,
        appointmentDate: fullTimestamp,
        durationMinutes: 30,
      });

      if (conflictResult.hasConflict) {
        setFormError(conflictResult.message);
        setIsSubmitting(false);
        return;
      }

      // 2. الحفظ في قاعدة البيانات
      const doctorInfo = getDoctorById(doctorId);
      const newAppointment = await addAppointmentToSupabase({
        patientId: selectedPatientId,
        doctorId,
        appointmentDate: fullTimestamp,
        status: 'مؤكد',
        visitType,
        reason,
        notes,
      });

      if (onSuccess) {
        onSuccess({
          appointment: newAppointment,
          patientId: selectedPatientId,
          patientName: selectedPatientData?.full_name || 'مريض مسجل',
          date: appointmentDate,
          time: appointmentTime,
          doctorId,
          doctorName: doctorInfo.name,
          visitType,
          reason,
          notes,
        });
      }

      onClose();
    } catch (err) {
      console.error('[Console Debug - تعذر حفظ الحجز]:', err);
      setFormError(err.message || 'حدث خطأ أثناء حفظ الحجز. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
    >
      <div className="modal-container appointment-booking-modal-container">
        {/* الترويسة العلوية للنافذة */}
        <div className="modal-header">
          <div className="modal-header-icon modal-header-icon--teal">
            <CalendarIcon size={20} />
          </div>
          <div>
            <h3 id="booking-modal-title" className="modal-title">
              حجز موعد جديد
            </h3>
            <p className="modal-subtitle">
              إدخال تفاصيل الموعد والتحقق من صحة التوقيت ومقدم الخدمة
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal-close-btn"
            aria-label="إغلاق النافذة"
            disabled={isSubmitting}
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* تنبيه الخطأ العام */}
        {formError && (
          <div className="patient-alert-danger" role="alert" style={{ margin: '0.75rem 1.25rem 0 1.25rem' }}>
            <div className="alert-icon-wrap">
              <AlertCircleIcon size={18} />
            </div>
            <div className="alert-body">
              <span className="text-sm font-semibold">{formError}</span>
            </div>
          </div>
        )}

        {/* نموذج الإدخال الشبكي المتجاوب (عمودين على الكمبيوتر وعمود على الموبايل) */}
        <form onSubmit={handleSubmit} className="modal-form appointment-booking-form">
          <div className="appointment-form-grid">
            {/* 1. حقل اختيار المريض (يمتد على عرض النموذج) */}
            <div className="form-group form-group-full">
              <label className="form-label">
                المريض <span className="text-danger">*</span>
              </label>

              {/* إذا تم اختيار مريض أو فُتح النموذج من ملف المريض */}
              {selectedPatientData ? (
                <div className="selected-patient-box">
                  <div className="selected-patient-info">
                    <span className="patient-avatar-dot" />
                    <div>
                      <strong className="selected-patient-name">
                        {selectedPatientData.full_name || selectedPatientData.fullName}
                      </strong>
                      <div className="selected-patient-meta">
                        <span className="font-numeric" dir="ltr">
                          {selectedPatientData.phone || 'بدون هاتف'}
                        </span>
                        <span className="text-separator">•</span>
                        <span className="font-numeric text-muted">
                          #{String(selectedPatientData.id).slice(0, 8).toUpperCase()}
                        </span>
                        {initialPatientId && (
                          <span className="locked-patient-tag">
                            محدد تلقائياً من الملف الطبي
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* زر تغيير المريض متاح فقط إن لم يكن مفتوحاً من ملف المريض */}
                  {!initialPatientId && (
                    <button
                      type="button"
                      onClick={handleClearSelectedPatient}
                      className="btn-change-patient"
                      disabled={isSubmitting}
                      title="اختيار مريض آخر"
                    >
                      تغيير المريض
                    </button>
                  )}
                </div>
              ) : (
                /* في واجهة السكرتيرة: بحث حي واختيار حصري من قاعدة المرضى */
                <div className="patient-picker-wrapper">
                  <div className="patient-picker-input-wrap">
                    <SearchIcon size={16} className="patient-picker-search-icon" />
                    <input
                      type="text"
                      value={patientSearchTerm}
                      onChange={(e) => {
                        setPatientSearchTerm(e.target.value);
                        setIsDropdownOpen(true);
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                      placeholder="ابحث عن مريض مسجل بالاسم أو رقم الهاتف..."
                      className="form-input patient-picker-search-input"
                      autoComplete="off"
                    />
                  </div>

                  {/* قائمة نتائج البحث المنسدلة */}
                  {isDropdownOpen && (
                    <div className="patient-picker-dropdown">
                      {patientsLoading ? (
                        <div className="picker-empty-notice">
                          جاري جلب سجلات المرضى...
                        </div>
                      ) : filteredPatients.length === 0 ? (
                        <div className="picker-empty-notice">
                          <span>لا يوجد مريض مطابق لنص البحث.</span>
                          <span className="picker-notice-sub">
                            (لا يُسمح بإدخال اسم حر؛ يجب تسجيل المريض أولاً في النظام)
                          </span>
                        </div>
                      ) : (
                        <ul className="patient-picker-results-list">
                          {filteredPatients.map((p) => (
                            <li key={p.id}>
                              <button
                                type="button"
                                onClick={() => handleSelectPatient(p)}
                                className="patient-picker-item"
                              >
                                <div className="picker-item-avatar">
                                  {(p.full_name || 'م')[0]}
                                </div>
                                <div className="picker-item-details">
                                  <strong className="picker-item-name">{p.full_name}</strong>
                                  <span className="picker-item-sub font-numeric" dir="ltr">
                                    {p.phone || 'بدون هاتف'} — #{String(p.id).slice(0, 8).toUpperCase()}
                                  </span>
                                </div>
                                <span className="picker-item-select-btn">اختيار</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  <span className="text-xs text-muted mt-0.5 block">
                    * يجب اختيار مريض مسجل مسبقاً من قاعدة البيانات لربط الموعد بملفه.
                  </span>
                </div>
              )}
            </div>

            {/* 2. الطبيب أو مقدم الخدمة (إجباري) */}
            <div className="form-group">
              <label htmlFor="booking-doctor" className="form-label">
                الطبيب أو مقدم الخدمة <span className="text-danger">*</span>
              </label>
              <select
                id="booking-doctor"
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                required
                className="form-select"
                disabled={isSubmitting}
              >
                {CLINIC_DOCTORS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. نوع الزيارة (إجباري) */}
            <div className="form-group">
              <label htmlFor="booking-visit-type" className="form-label">
                نوع الزيارة <span className="text-danger">*</span>
              </label>
              <select
                id="booking-visit-type"
                value={visitType}
                onChange={(e) => setVisitType(e.target.value)}
                required
                className="form-select"
                disabled={isSubmitting}
              >
                <option value="كشف جديد">كشف جديد</option>
                <option value="استشارة">استشارة طبية</option>
                <option value="متابعة دورية">متابعة دورية</option>
                <option value="إعادة كشف">إعادة كشف</option>
                <option value="فحص دوري وقائي">فحص دوري وقائي</option>
              </select>
            </div>

            {/* 4. تاريخ الموعد (إجباري مع منع التواريخ السابقة) */}
            <div className="form-group">
              <label htmlFor="booking-date" className="form-label">
                تاريخ الموعد <span className="text-danger">*</span>
              </label>
              <input
                id="booking-date"
                type="date"
                value={appointmentDate}
                min={todayStr}
                onChange={(e) => setAppointmentDate(e.target.value)}
                required
                className="form-input font-numeric"
                disabled={isSubmitting}
              />
            </div>

            {/* 5. الوقت (إجباري مع منع الوقت السابق لليوم الحالي) */}
            <div className="form-group">
              <label htmlFor="booking-time" className="form-label">
                وقت الموعد <span className="text-danger">*</span>
              </label>
              <input
                id="booking-time"
                type="time"
                value={appointmentTime}
                onChange={(e) => setAppointmentTime(e.target.value)}
                required
                className={`form-input font-numeric ${isTimePast ? 'input-error-border' : ''}`}
                disabled={isSubmitting}
              />
            </div>

            {/* تنبيه التحقق الزمني إذا تم اختيار وقت سابق */}
            {isTimePast && (
              <div className="form-group-full">
                <div className="time-past-warning-box">
                  <AlertCircleIcon size={16} />
                  <span>
                    تنبيه: لا يمكن اختيار وقت سابق للحظة الحالية. يرجى اختيار موعد قادم.
                  </span>
                </div>
              </div>
            )}

            {/* 6. سبب الزيارة (اختياري) */}
            <div className="form-group form-group-full">
              <label htmlFor="booking-reason" className="form-label">
                سبب مختصر للزيارة <span className="text-muted">(اختياري)</span>
              </label>
              <input
                id="booking-reason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="مثال: فحص ضغط وسكر، استشارة تحاليل دورية، آلام مفاصل..."
                className="form-input"
                disabled={isSubmitting}
              />
            </div>

            {/* 7. ملاحظات داخلية (اختياري) */}
            <div className="form-group form-group-full">
              <label htmlFor="booking-notes" className="form-label">
                ملاحظات داخلية للاستقبال <span className="text-muted">(اختياري)</span>
              </label>
              <textarea
                id="booking-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="أي تعليمات إدارية خاصة بالموعد أو صالة الانتظار..."
                className="form-textarea"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* أزرار الإجراءات السفلية مع منع النقر المزدوج */}
          <div className="modal-actions appointment-modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn-cancel"
              disabled={isSubmitting}
            >
              إلغاء
            </button>

            <button
              type="submit"
              className="btn-submit btn-action-primary"
              disabled={!isFormValid || isSubmitting}
              title={
                !isFormValid
                  ? 'يرجى استيفاء الحقول الإلزامية وتحديد توقيت صحيح'
                  : 'تأكيد وحفظ الموعد'
              }
            >
              {isSubmitting ? (
                <>
                  <RefreshCwIcon size={14} className="spin" />
                  <span>جاري الحفظ…</span>
                </>
              ) : (
                <>
                  <CheckIcon size={16} />
                  <span>حفظ الحجز</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AppointmentBookingModal;
