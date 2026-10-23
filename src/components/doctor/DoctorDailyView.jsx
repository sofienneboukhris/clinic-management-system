import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarIcon,
  ClockIcon,
  ActivityIcon,
  CheckIcon,
  CheckCircleIcon,
  SearchIcon,
  RefreshCwIcon,
  CloseIcon,
  FileTextIcon,
  ShieldAlertIcon,
  UsersIcon,
  EyeIcon,
} from '../dashboard/Icons.jsx';
import {
  fetchDoctorTodayAppointments,
  startDoctorExamination,
  completeDoctorExamination,
  CLINIC_DOCTORS,
  getDoctorById,
  normalizeAppointmentStatus,
  isTodayLocal,
} from '../../services/dashboardService.js';
import { getArabicCurrentDate, formatEGP } from '../../data/dashboardMockData.js';
import { StatCardsSkeleton, TablePanelSkeleton } from '../dashboard/DashboardSkeleton.jsx';
import { ErrorState } from '../dashboard/ErrorState.jsx';
import { EmptyState } from '../dashboard/EmptyState.jsx';
import { DoctorExaminationScreen } from './DoctorExaminationScreen.jsx';
import UnauthorizedPage from '../auth/UnauthorizedPage.jsx';

/**
 * مكوّن واجهة الطبيب اليومية (DoctorDailyView)
 * صُمم خصيصاً ليناسب مسار عمل الطبيب داخل عيادته:
 * متابعة قائمة الانتظار، بدء الكشف السريري، استعراض الملف الطبي والحساسية،
 * وإنهاء الكشف وتسجيل الملاحظات، مع قراءة فقط لملخص الفاتورة وبدون أي أدوات إدارية أو مالية للسكرتيرة.
 */
export function DoctorDailyView({
  onViewPatient,
  onNavigateSection,
  userRole = 'doctor',
  currentUser = null,
}) {
  // فحص أمني: منع السكرتيرة من فتح واجهة عمل الطبيب
  if (userRole && userRole !== 'doctor') {
    return (
      <UnauthorizedPage
        message="عذراً، هذه الواجهة مخصصة للأطباء فقط لمتابعة جدول العيادة وقائمة الانتظار وإجراء الكشوفات السريرية."
        currentRole={userRole}
        returnPath="#/secretary"
        returnLabel="العودة إلى مكتب السكرتارية ←"
      />
    );
  }
  // 1. هوية الطبيب الحالي وحالاته (افتراضياً: د. أحمد محمود - باطنة وجهاز هضمي بمعرفه doc-internal)
  const [selectedDoctorId, setSelectedDoctorId] = useState('doc-internal');
  const currentDoctor = useMemo(() => getDoctorById(selectedDoctorId), [selectedDoctorId]);

  // 2. البيانات وحالات التحميل والخطأ
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // 3. البحث والفلاتر
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'waiting' | 'in_progress' | 'completed' | 'confirmed'

  // 4. النوافذ المنبثقة التفاعلية الخاصة بالطبيب
  const [selectedPatientForView, setSelectedPatientForView] = useState(null); // معاينة سريعة للسجل الطبي
  const [activeExamAppointment, setActiveExamAppointment] = useState(null); // نافذة إنهاء الكشف وتسجيل التشخيص السريع
  const [examNotesInput, setExamNotesInput] = useState('');
  const [isSubmittingExam, setIsSubmittingExam] = useState(false);

  // 4.ب شاشة بدء الكشف السريري الشاملة المفتوحة بمعرف المريض والحجز
  const [activeExamTarget, setActiveExamTarget] = useState(null); // { patientId, appointmentId }

  // 5. التنبيهات السريعة (Toast)
  const [toastMessage, setToastMessage] = useState(null);

  const formattedToday = getArabicCurrentDate();

  // إظهار تنبيه Toast
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // جلب مواعيد اليوم للطبيب المختار بمعرفه الفعلي وتاريخ اليوم
  const loadDoctorAppointments = async () => {
    try {
      setIsLoading(true);
      setHasError(false);
      const data = await fetchDoctorTodayAppointments({ doctorId: selectedDoctorId });
      setAppointments(data || []);
    } catch (err) {
      console.error('[DoctorDailyView - فشل جلب مواعيد الطبيب]:', err);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDoctorAppointments();
  }, [selectedDoctorId]);

  // ==========================================================================
  // ٢ — المؤشرات الأربعة المختصرة (Summary KPI Indicators)
  // ==========================================================================
  const doctorMetrics = useMemo(() => {
    const totalToday = appointments.length;

    const waiting = appointments.filter(
      (a) => a.status === 'في الانتظار'
    ).length;

    const inProgress = appointments.filter(
      (a) => a.status === 'داخل الكشف' || a.status === 'جاري الكشف'
    ).length;

    const completed = appointments.filter(
      (a) => a.status === 'مكتمل'
    ).length;

    return {
      totalToday,
      waiting,
      inProgress,
      completed,
    };
  }, [appointments]);

  // ==========================================================================
  // ٥ — تصفية القائمة بالبحث النصي وحالة الموعد
  // ==========================================================================
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      // 1. فلتر الحالة
      if (statusFilter === 'waiting' && apt.status !== 'في الانتظار') return false;
      if (statusFilter === 'in_progress' && apt.status !== 'داخل الكشف' && apt.status !== 'جاري الكشف') return false;
      if (statusFilter === 'completed' && apt.status !== 'مكتمل') return false;
      if (statusFilter === 'confirmed' && apt.status !== 'مؤكد') return false;

      // 2. البحث باسم المريض أو برقم الملف
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const nameMatch = (apt.patientName || '').toLowerCase().includes(q);
        const fileIdMatch = String(apt.patientId || '').toLowerCase().includes(q);
        const phoneMatch = String(apt.phone || '').includes(q);
        if (!nameMatch && !fileIdMatch && !phoneMatch) return false;
      }

      return true;
    });
  }, [appointments, statusFilter, searchQuery]);

  // ==========================================================================
  // ٣ — إجراءات الطبيب: بدء الكشف ومتابعته وإنهاء الكشف
  // ==========================================================================

  // بدء الكشف الطبي وفتح شاشة الكشف السريري بمعرف المريض ومعرف الحجز
  const handleStartExamination = async (apt) => {
    try {
      await startDoctorExamination(apt.id);
      // تحديث الحالة محلياً فورياً لتجربة استخدام فائقة السرعة
      setAppointments((prev) =>
        prev.map((item) =>
          item.id === apt.id ? { ...item, status: 'داخل الكشف' } : item
        )
      );
      showToast(`تم بدء الكشف للمريض (${apt.patientName}) 🩺`);
      // فتح شاشة الكشف السريري باستخدام معرف المريض ومعرف الحجز وليس الاسم
      setActiveExamTarget({
        patientId: apt.patientId,
        appointmentId: apt.id,
      });
    } catch (err) {
      console.error('[DoctorDailyView - تعذر بدء الكشف]:', err);
      showToast('تعذر بدء الكشف، يرجى المحاولة مرة أخرى.');
    }
  };

  // متابعة كشف جاري بالفعل وفتح شاشته السريرية
  const handleResumeExamination = (apt) => {
    setActiveExamTarget({
      patientId: apt.patientId,
      appointmentId: apt.id,
    });
  };

  // فتح نافذة إنهاء الكشف وتسجيل الملاحظات
  const handleOpenCompleteModal = (apt) => {
    setActiveExamAppointment(apt);
    setExamNotesInput(apt.doctorNotes || '');
  };

  // تأكيد إنهاء الكشف وحفظ التشخيص
  const handleConfirmCompleteExam = async (e) => {
    e.preventDefault();
    if (!activeExamAppointment) return;

    try {
      setIsSubmittingExam(true);
      await completeDoctorExamination(activeExamAppointment.id, examNotesInput);

      setAppointments((prev) =>
        prev.map((item) =>
          item.id === activeExamAppointment.id
            ? {
                ...item,
                status: 'مكتمل',
                doctorNotes: examNotesInput.trim() || item.doctorNotes,
              }
            : item
        )
      );

      showToast(`تم إنهاء الكشف واعتماد زيارة (${activeExamAppointment.patientName}) بنجاح ✓`);
      setActiveExamAppointment(null);
      setExamNotesInput('');
    } catch (err) {
      console.error('[DoctorDailyView - تعذر إنهاء الكشف]:', err);
      showToast('تعذر حفظ بيانات الكشف. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmittingExam(false);
    }
  };

  // شارة حالة الموعد المنسقة
  const renderStatusBadge = (status) => {
    let pillClass = 'status-pill--scheduled';
    let label = status;

    if (status === 'مؤكد') pillClass = 'status-pill--confirmed';
    else if (status === 'في الانتظار') pillClass = 'status-pill--pending';
    else if (status === 'داخل الكشف' || status === 'جاري الكشف') pillClass = 'status-pill--in-progress';
    else if (status === 'مكتمل') pillClass = 'status-pill--completed';
    else if (status === 'ملغي') pillClass = 'status-pill--cancelled';

    const isLive = status === 'داخل الكشف' || status === 'جاري الكشف';

    return (
      <span className={`status-pill ${pillClass}`}>
        {isLive && <span className="live-status-dot-pulse" aria-hidden="true" />}
        {label}
      </span>
    );
  };

  // شارة حالة الفاتورة للقراءة فقط (Read-only Invoice Summary)
  const renderInvoiceBadge = (invoiceSummary) => {
    if (!invoiceSummary || !invoiceSummary.hasInvoice) {
      return (
        <span className="invoice-readonly-badge invoice-readonly-badge--none" title="لا توجد فاتورة مسجلة لهذا الحجز">
          لا توجد فاتورة
        </span>
      );
    }

    const st = invoiceSummary.status;
    let badgeClass = 'invoice-readonly-badge--unpaid';
    if (st === 'مدفوعة') badgeClass = 'invoice-readonly-badge--paid';
    else if (st === 'مدفوعة جزئيًا' || st === 'مدفوعة جزئيا') badgeClass = 'invoice-readonly-badge--partial';
    else if (st === 'متأخرة') badgeClass = 'invoice-readonly-badge--overdue';

    return (
      <span
        className={`invoice-readonly-badge ${badgeClass}`}
        title={`حالة الفاتورة للقراءة فقط: ${st} (${formatEGP(invoiceSummary.amount)})`}
      >
        {st}
      </span>
    );
  };

  // إذا كانت شاشة الكشف السريري مفتوحة لمريض وحجز محددين
  if (activeExamTarget) {
    return (
      <DoctorExaminationScreen
        patientId={activeExamTarget.patientId}
        appointmentId={activeExamTarget.appointmentId}
        userRole={userRole}
        onBack={() => {
          setActiveExamTarget(null);
          loadDoctorAppointments();
        }}
        onComplete={() => {
          setActiveExamTarget(null);
          loadDoctorAppointments();
          showToast('تم إنهاء الكشف واعتماد بيانات الزيارة بنجاح ✓');
        }}
      />
    );
  }

  return (
    <div className="doctor-page-layout" dir="rtl">
      {/* 1. الترويسة الرئيسية وهوية الطبيب */}
      <header className="doctor-header-banner" aria-label="ترويسة واجهة الطبيب">
        <div className="doctor-header-info">
          <div className="doctor-avatar-box" aria-hidden="true">
            🩺
          </div>
          <div>
            <div className="doctor-title-row">
              <h1 className="doctor-name-heading">{currentDoctor.name}</h1>
              <span className="doctor-specialty-badge">{currentDoctor.specialty}</span>
              <span className="doctor-id-badge font-numeric">ID: {currentDoctor.id}</span>
            </div>
            <p className="doctor-header-subtitle">
              جدول العيادة ومتابعة قائمة الانتظار والكشوف السريرية اليومية
            </p>
          </div>
        </div>

        {/* محدد التبديل بين أطباء العيادة لمعاينة جداولهم ديناميكياً */}
        <div className="doctor-header-controls">
          <div className="doctor-date-pill">
            <CalendarIcon size={16} />
            <span className="font-numeric">{formattedToday}</span>
          </div>

          <div className="doctor-selector-wrap">
            <label htmlFor="doctor-select-switch" className="visually-hidden">
              اختيار الطبيب الحالي
            </label>
            <select
              id="doctor-select-switch"
              className="doctor-selector-dropdown"
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              title="التبديل بين أطباء العيادة المعتمدين"
            >
              {CLINIC_DOCTORS.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.name} ({doc.specialty})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={loadDoctorAppointments}
            className="btn-refresh-icon"
            title="تحديث مواعيد اليوم"
            aria-label="تحديث المواعيد"
          >
            <RefreshCwIcon size={16} />
          </button>
        </div>
      </header>

      {/* 2. المؤشرات الأربعة المختصرة (Summary KPI Cards) */}
      <section className="doctor-stats-section" aria-label="مؤشرات أداء عيادة اليوم">
        {isLoading ? (
          <StatCardsSkeleton />
        ) : (
          <div className="doctor-stats-grid">
            {/* مؤشر 1: مواعيد اليوم */}
            <div className="doctor-kpi-card doctor-kpi-card--blue">
              <div className="doctor-kpi-header">
                <span className="doctor-kpi-title">مواعيد اليوم</span>
                <div className="doctor-kpi-icon doctor-kpi-icon--blue">
                  <CalendarIcon size={20} />
                </div>
              </div>
              <div className="doctor-kpi-body">
                <span className="doctor-kpi-value font-numeric">{doctorMetrics.totalToday}</span>
                <span className="doctor-kpi-sub">إجمالي الحجوزات المجدولة لليوم</span>
              </div>
            </div>

            {/* مؤشر 2: المرضى قيد الانتظار */}
            <div className="doctor-kpi-card doctor-kpi-card--amber">
              <div className="doctor-kpi-header">
                <span className="doctor-kpi-title">المرضى قيد الانتظار</span>
                <div className="doctor-kpi-icon doctor-kpi-icon--amber">
                  <ClockIcon size={20} />
                </div>
              </div>
              <div className="doctor-kpi-body">
                <span className="doctor-kpi-value font-numeric">{doctorMetrics.waiting}</span>
                <span className="doctor-kpi-sub">مرضى متواجدون بصالة الانتظار</span>
              </div>
            </div>

            {/* مؤشر 3: الكشوف الجارية */}
            <div className="doctor-kpi-card doctor-kpi-card--teal">
              <div className="doctor-kpi-header">
                <span className="doctor-kpi-title">الكشوف الجارية</span>
                <div className="doctor-kpi-icon doctor-kpi-icon--teal">
                  <ActivityIcon size={20} />
                </div>
              </div>
              <div className="doctor-kpi-body">
                <span className="doctor-kpi-value font-numeric">{doctorMetrics.inProgress}</span>
                <span className="doctor-kpi-sub">حالات داخل غرفة الكشف حالياً</span>
              </div>
            </div>

            {/* مؤشر 4: الزيارات المكتملة اليوم */}
            <div className="doctor-kpi-card doctor-kpi-card--emerald">
              <div className="doctor-kpi-header">
                <span className="doctor-kpi-title">الزيارات المكتملة اليوم</span>
                <div className="doctor-kpi-icon doctor-kpi-icon--emerald">
                  <CheckCircleIcon size={20} />
                </div>
              </div>
              <div className="doctor-kpi-body">
                <span className="doctor-kpi-value font-numeric">{doctorMetrics.completed}</span>
                <span className="doctor-kpi-sub">تم فحصهم وصرف التوصيات الطبية</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 3. شريط البحث والفلاتر السريعة */}
      <section className="doctor-filter-panel" aria-label="بحث وتصفية المواعيد">
        <div className="doctor-filter-search-box">
          <SearchIcon size={18} className="search-input-icon" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم المريض أو رقم الملف الطبي أو الهاتف..."
            className="doctor-search-input"
            aria-label="بحث في قائمة مواعيد اليوم"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="doctor-search-clear"
              aria-label="مسح البحث"
            >
              <CloseIcon size={14} />
            </button>
          )}
        </div>

        {/* فلاتر الحالات المناسبة لغرفة الطبيب */}
        <div className="doctor-status-tabs" role="tablist" aria-label="فلاتر حالات المواعيد">
          <button
            type="button"
            className={`doctor-tab-btn ${statusFilter === 'all' ? 'doctor-tab-btn--active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            الكل ({appointments.length})
          </button>

          <button
            type="button"
            className={`doctor-tab-btn ${statusFilter === 'waiting' ? 'doctor-tab-btn--active' : ''}`}
            onClick={() => setStatusFilter('waiting')}
          >
            قيد الانتظار ({doctorMetrics.waiting})
          </button>

          <button
            type="button"
            className={`doctor-tab-btn ${statusFilter === 'in_progress' ? 'doctor-tab-btn--active' : ''}`}
            onClick={() => setStatusFilter('in_progress')}
          >
            كشوف جارية ({doctorMetrics.inProgress})
          </button>

          <button
            type="button"
            className={`doctor-tab-btn ${statusFilter === 'completed' ? 'doctor-tab-btn--active' : ''}`}
            onClick={() => setStatusFilter('completed')}
          >
            مكتمل ({doctorMetrics.completed})
          </button>

          <button
            type="button"
            className={`doctor-tab-btn ${statusFilter === 'confirmed' ? 'doctor-tab-btn--active' : ''}`}
            onClick={() => setStatusFilter('confirmed')}
          >
            مؤكد
          </button>
        </div>
      </section>

      {/* 4. جدول المواعيد وبطاقات العرض للموبايل */}
      <section className="doctor-table-panel" aria-label="جدول مواعيد العيادة اليوم">
        {isLoading ? (
          <TablePanelSkeleton title="مواعيد اليوم للطبيب" rowsCount={6} />
        ) : hasError ? (
          <ErrorState
            title="تعذر تحميل مواعيد الطبيب اليوم. حاول مرة أخرى."
            onRetry={loadDoctorAppointments}
          />
        ) : filteredAppointments.length === 0 ? (
          <EmptyState
            icon={<ClockIcon size={40} />}
            title={
              searchQuery
                ? 'لا توجد نتائج مطابقة لبحثك'
                : 'لا توجد مواعيد مسجلة اليوم لهذا الطبيب'
            }
            description={
              searchQuery
                ? 'جرب البحث باسم مريض آخر أو التأكد من رقم الملف الطبي.'
                : 'ستظهر هنا المواعيد المحجوزة لتاريخ اليوم بمجرد تسجيلها من قبل السكرتيرة.'
            }
          />
        ) : (
          <>
            {/* العرض المكتبي (Desktop Table) */}
            <div className="table-responsive-desktop">
              <table className="custom-data-table doctor-data-table" dir="rtl">
                <thead>
                  <tr>
                    <th scope="col">المريض ورقم الملف</th>
                    <th scope="col">الوقت</th>
                    <th scope="col">نوع الزيارة</th>
                    <th scope="col">حالة الموعد</th>
                    <th scope="col">ملخص الفاتورة</th>
                    <th scope="col">ملاحظات الزيارة</th>
                    <th scope="col" className="text-center">إجراء الكشف الطبي</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppointments.map((apt) => {
                    const isWaiting = apt.status === 'في الانتظار';
                    const isConfirmed = apt.status === 'مؤكد';
                    const isInProgress = apt.status === 'داخل الكشف' || apt.status === 'جاري الكشف';
                    const isCompleted = apt.status === 'مكتمل';
                    const canStartExam = isWaiting || isConfirmed;

                    return (
                      <tr
                        key={apt.id}
                        className={`data-table-row ${isInProgress ? 'doctor-row--active-exam' : ''}`}
                      >
                        {/* المريض ورقم الملف */}
                        <td>
                          <div className="patient-cell-with-bio">
                            <span className="patient-avatar-dot" aria-hidden="true">
                              {apt.patientName.charAt(0)}
                            </span>
                            <div>
                              <strong className="patient-name-text">{apt.patientName}</strong>
                              <div className="patient-meta-sub">
                                <span className="patient-id-tag font-numeric">
                                  #{String(apt.patientId).replace('pat-', '')}
                                </span>
                                {apt.patientBio?.allergies && (
                                  <span
                                    className="allergy-mini-warning"
                                    title={`تنبيه حساسية: ${apt.patientBio.allergies}`}
                                  >
                                    ⚠️ حساسية
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* الوقت */}
                        <td>
                          <div className="time-cell-badge font-numeric">
                            <ClockIcon size={14} />
                            <span>{apt.time}</span>
                          </div>
                        </td>

                        {/* نوع الزيارة */}
                        <td>
                          <span className="visit-type-pill">{apt.visitType}</span>
                        </td>

                        {/* حالة الموعد */}
                        <td>{renderStatusBadge(apt.status)}</td>

                        {/* ملخص الفاتورة (للقراءة فقط - بدون تسجيل أو تعديل) */}
                        <td>{renderInvoiceBadge(apt.invoiceSummary)}</td>

                        {/* ملاحظات / شكوى المريض */}
                        <td>
                          <div className="doctor-table-notes" title={apt.doctorNotes || 'لا توجد ملاحظات مسجلة'}>
                            {apt.doctorNotes ? (
                              <span>{apt.doctorNotes}</span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </div>
                        </td>

                        {/* أزرار الإجراء السريري للطبيب */}
                        <td className="text-center">
                          <div className="doctor-row-actions">
                            {/* زر بدء الكشف عند السماح */}
                            {canStartExam && (
                              <button
                                type="button"
                                onClick={() => handleStartExamination(apt)}
                                className="btn-doctor-start-exam"
                                title="بدء الكشف السريري وإدخال المريض"
                              >
                                <span>بدء الكشف</span>
                                <span className="btn-icon-right">🩺</span>
                              </button>
                            )}

                            {/* زر متابعة الكشف عندما يكون الكشف جارياً */}
                            {isInProgress && (
                              <button
                                type="button"
                                onClick={() => handleResumeExamination(apt)}
                                className="btn-doctor-resume-exam"
                                title="متابعة الكشف وتدوين الفحص والتشخيص"
                              >
                                <span>متابعة الكشف</span>
                                <span className="btn-icon-right">🩺</span>
                              </button>
                            )}

                            {/* زر إنهاء الكشف عندما يكون الكشف جارياً */}
                            {isInProgress && (
                              <button
                                type="button"
                                onClick={() => handleOpenCompleteModal(apt)}
                                className="btn-doctor-complete-exam"
                                title="إنهاء الكشف السريري وتدوين التشخيص الطبي"
                              >
                                <CheckIcon size={16} />
                                <span>إنهاء</span>
                              </button>
                            )}

                            {/* كشف مكتمل */}
                            {isCompleted && (
                              <span className="badge-exam-done" title="تم الانتهاء من فحص المريض">
                                مكتمل ✓
                              </span>
                            )}

                            {/* زر معاينة السجل الطبي السريع */}
                            <button
                              type="button"
                              onClick={() => setSelectedPatientForView(apt)}
                              className="btn-icon-action"
                              title="استعراض السجل الطبي والحساسية"
                              aria-label="استعراض السجل الطبي"
                            >
                              <FileTextIcon size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* العرض للموبايل (Mobile Cards List) */}
            <div className="mobile-cards-list doctor-mobile-cards">
              {filteredAppointments.map((apt) => {
                const isWaiting = apt.status === 'في الانتظار';
                const isConfirmed = apt.status === 'مؤكد';
                const isInProgress = apt.status === 'داخل الكشف' || apt.status === 'جاري الكشف';
                const isCompleted = apt.status === 'مكتمل';
                const canStartExam = isWaiting || isConfirmed;

                return (
                  <div
                    key={apt.id}
                    className={`mobile-record-card doctor-mobile-card ${isInProgress ? 'doctor-card--active-exam' : ''}`}
                  >
                    <div className="mobile-card-top-row">
                      <div className="mobile-patient-profile">
                        <strong className="mobile-patient-name">{apt.patientName}</strong>
                        <span className="patient-id-tag font-numeric">
                          #{String(apt.patientId).replace('pat-', '')}
                        </span>
                      </div>
                      <div className="mobile-card-badges">
                        {renderStatusBadge(apt.status)}
                      </div>
                    </div>

                    <div className="mobile-card-meta-grid">
                      <div className="mobile-meta-item">
                        <span className="mobile-meta-label">الوقت:</span>
                        <span className="mobile-meta-val font-numeric">{apt.time}</span>
                      </div>
                      <div className="mobile-meta-item">
                        <span className="mobile-meta-label">النوع:</span>
                        <span className="mobile-meta-val">{apt.visitType}</span>
                      </div>
                      <div className="mobile-meta-item">
                        <span className="mobile-meta-label">الفاتورة:</span>
                        <span className="mobile-meta-val">{renderInvoiceBadge(apt.invoiceSummary)}</span>
                      </div>
                    </div>

                    {apt.patientBio?.allergies && (
                      <div className="mobile-allergy-alert">
                        <ShieldAlertIcon size={14} className="text-danger" />
                        <span>حساسية: {apt.patientBio.allergies}</span>
                      </div>
                    )}

                    {apt.doctorNotes && (
                      <div className="mobile-notes-preview">
                        <strong>ملاحظات:</strong> {apt.doctorNotes}
                      </div>
                    )}

                    {/* أزرار الإجراء للموبايل */}
                    <div className="mobile-doctor-actions">
                      {canStartExam && (
                        <button
                          type="button"
                          onClick={() => handleStartExamination(apt)}
                          className="btn-doctor-start-exam w-full"
                        >
                          <span>بدء الكشف</span>
                          <span>🩺</span>
                        </button>
                      )}

                      {isInProgress && (
                        <button
                          type="button"
                          onClick={() => handleResumeExamination(apt)}
                          className="btn-doctor-resume-exam w-full"
                        >
                          <span>متابعة الكشف السريري</span>
                          <span>🩺</span>
                        </button>
                      )}

                      {isInProgress && (
                        <button
                          type="button"
                          onClick={() => handleOpenCompleteModal(apt)}
                          className="btn-doctor-complete-exam w-full"
                        >
                          <CheckIcon size={16} />
                          <span>إنهاء سريع واعتماد الملاحظات</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedPatientForView(apt)}
                        className="btn-action-secondary w-full"
                      >
                        <FileTextIcon size={16} />
                        <span>السجل الطبي السريع</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* 5. نافذة منبثقة لإنهاء الكشف وتدوين الملاحظات السريرية */}
      {activeExamAppointment && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-exam-title">
          <div className="modal-container">
            <div className="modal-header">
              <div className="modal-header-icon modal-header-icon--teal">
                <CheckCircleIcon size={22} />
              </div>
              <div>
                <h3 id="modal-exam-title" className="modal-title">إنهاء الكشف الطبي</h3>
                <p className="modal-subtitle">
                  المريض: <strong>{activeExamAppointment.patientName}</strong> ({activeExamAppointment.visitType})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveExamAppointment(null)}
                className="modal-close-btn"
                aria-label="إغلاق"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmCompleteExam} className="modal-form">
              {/* ملخص المريض السريري */}
              {activeExamAppointment.patientBio?.allergies && (
                <div className="alert-box-allergy">
                  <ShieldAlertIcon size={16} />
                  <span>
                    <strong>تنبيه طبي:</strong> {activeExamAppointment.patientBio.allergies}
                  </span>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="doctor-clinical-notes" className="form-label">
                  التشخيص الطبي وتوصيات العلاج (ملاحظات الكشف)
                </label>
                <textarea
                  id="doctor-clinical-notes"
                  rows={4}
                  value={examNotesInput}
                  onChange={(e) => setExamNotesInput(e.target.value)}
                  placeholder="اكتب هنا نتائج الفحص السريري، التشخيص المبدئي، الأدوية الموصوفة، أو التحاليل المطلوبة للمريض..."
                  className="form-textarea"
                  autoFocus
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setActiveExamAppointment(null)}
                  className="btn-cancel"
                  disabled={isSubmittingExam}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={isSubmittingExam}
                >
                  {isSubmittingExam ? 'جاري الاعتماد...' : 'اعتماد وإنهاء الكشف ✓'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. نافذة استعراض السجل الطبي السريع للمريض (Read-only Quick Medical History) */}
      {selectedPatientForView && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-history-title">
          <div className="modal-container">
            <div className="modal-header">
              <div className="modal-header-icon modal-header-icon--indigo">
                <FileTextIcon size={20} />
              </div>
              <div>
                <h3 id="modal-history-title" className="modal-title">
                  السجل الطبي السريع: {selectedPatientForView.patientName}
                </h3>
                <p className="modal-subtitle">
                  رقم الملف: #{String(selectedPatientForView.patientId).replace('pat-', '')} • هاتف:{' '}
                  <span className="font-numeric" dir="ltr">{selectedPatientForView.phone}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPatientForView(null)}
                className="modal-close-btn"
                aria-label="إغلاق"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="modal-detail-content">
              <div className="medical-bio-grid">
                <div className="bio-field-card">
                  <span className="bio-field-label">الجنس:</span>
                  <strong className="bio-field-value">
                    {selectedPatientForView.patientBio?.gender || 'غير محدد'}
                  </strong>
                </div>

                <div className="bio-field-card">
                  <span className="bio-field-label">فصيلة الدم:</span>
                  <strong className="bio-field-value text-danger font-numeric">
                    {selectedPatientForView.patientBio?.bloodType || 'غير مسجلة'}
                  </strong>
                </div>

                <div className="bio-field-card">
                  <span className="bio-field-label">تاريخ الميلاد:</span>
                  <strong className="bio-field-value font-numeric">
                    {selectedPatientForView.patientBio?.dateOfBirth || 'غير محدد'}
                  </strong>
                </div>

                <div className="bio-field-card">
                  <span className="bio-field-label">حالة الفاتورة:</span>
                  <strong className="bio-field-value">
                    {renderInvoiceBadge(selectedPatientForView.invoiceSummary)}
                  </strong>
                </div>
              </div>

              {/* بطاقة الحساسية والأمراض المزمنة */}
              <div className="clinical-alert-box">
                <div className="clinical-alert-header">
                  <ShieldAlertIcon size={18} />
                  <strong>الحساسية والأمراض المزمنة المسجلة:</strong>
                </div>
                <p className="clinical-alert-text">
                  {selectedPatientForView.patientBio?.allergies ||
                    'لا توجد حساسيات أو أمراض مزمنة مسجلة في ملف المريض.'}
                </p>
              </div>

              {/* ملاحظات ملف المريض التأسيسية */}
              <div className="detail-notes-box">
                <strong>ملاحظات عامة حول المريض:</strong>
                <p>
                  {selectedPatientForView.patientBio?.notes ||
                    'لا توجد ملاحظات إضافية مسجلة في ملف المريض.'}
                </p>
              </div>

              {/* ملاحظات حجز اليوم */}
              <div className="detail-notes-box" style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
                <strong style={{ color: '#166534' }}>ملاحظات كشف اليوم:</strong>
                <p style={{ color: '#15803d' }}>
                  {selectedPatientForView.doctorNotes || 'لا توجد ملاحظات مسجلة لحجز اليوم.'}
                </p>
              </div>
            </div>

            <div className="modal-actions" style={{ display: 'flex', gap: '0.75rem' }}>
              {onViewPatient && (
                <button
                  type="button"
                  onClick={() => {
                    const pid = selectedPatientForView.patientId;
                    setSelectedPatientForView(null);
                    onViewPatient(pid);
                  }}
                  className="btn-action-primary"
                  style={{ flex: 1 }}
                >
                  <EyeIcon size={16} />
                  <span>فتح الملف الطبي الكامل للمريض</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedPatientForView(null)}
                className="btn-cancel"
                style={{ flex: onViewPatient ? 0.4 : 1 }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. إشعار سريع Toast */}
      {toastMessage && (
        <div className="dashboard-toast" role="status" aria-live="polite">
          <span className="toast-dot" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default DoctorDailyView;
