import React, { useState, useEffect } from 'react';
import {
  fetchPatientById,
  fetchPatientAppointments,
  fetchPatientInvoices,
  fetchPatientVisits,
  updatePatientInfo,
  calculateAge,
} from '../../services/patientService.js';
import {
  ArrowRightIcon,
  CalendarIcon,
  ClockIcon,
  AlertCircleIcon,
  CheckIcon,
  EditIcon,
  FileTextIcon,
  ActivityIcon,
  CreditCardIcon,
  PhoneIcon,
  ShieldAlertIcon,
  CloseIcon,
  RefreshCwIcon,
} from '../dashboard/Icons.jsx';
import { AppointmentBookingModal } from '../appointments/AppointmentBookingModal.jsx';
import { getDoctorById } from '../../services/dashboardService.js';


/**
 * مكون صفحة ملف المريض (PatientProfilePage)
 * يعرض سجل المريض وتبويباته بالربط الحقيقي مع جداول Supabase
 * متضمناً:
 * ١ — تبويب البيانات الأساسية مع زر التعديل
 * ٢ — تبويب الحجوزات (التاريخ، الوقت، نوع الزيارة، حالة الحجز) عبر patient_id
 * ٣ — تبويب الزيارات الطبية (فحص وجود جدول الزيارات، وإظهار Empty State دون بيانات وهمية)
 * ٤ — تبويب الفواتير (رقم الفاتورة، التاريخ، الإجمالي، المدفوع، المتبقي، حالة الدفع للقراءة فقط)
 * ٥ — حالات Loading و Error و Empty State مستقلة لكل تبويب
 */
export function PatientProfilePage({
  patientId,
  onBackToPatients,
  onAddNewPatient,
  onBackToDashboard,
}) {
  // بيانات المريض الأساسية وملخص الترويسة
  const [patient, setPatient] = useState(null);
  const [patientLoading, setPatientLoading] = useState(true);
  const [patientError, setPatientError] = useState(null);

  // التبويب النشط
  const [activeTab, setActiveTab] = useState('basic-info');
  const [toastMessage, setToastMessage] = useState(null);

  // ١. حالات تبويب الحجوزات (مستقلة)
  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [appointmentsError, setAppointmentsError] = useState(null);

  // ٢. حالات تبويب الزيارات الطبية (مستقلة)
  const [visits, setVisits] = useState([]);
  const [visitsLoading, setVisitsLoading] = useState(true);
  const [visitsError, setVisitsError] = useState(null);
  const [visitsTableExists, setVisitsTableExists] = useState(false);

  // ٣. حالات تبويب الفواتير (مستقلة)
  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesError, setInvoicesError] = useState(null);

  // حالة نافذة تعديل بيانات المريض
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [modalError, setModalError] = useState(null);

  // حالة نافذة حجز موعد جديد للمريض
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);


  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // جلب السجل الأساسي للمريض بالمعرف
  const loadPatientHeader = async () => {
    if (!patientId) {
      setPatientLoading(false);
      return;
    }
    setPatientLoading(true);
    setPatientError(null);
    try {
      const data = await fetchPatientById(patientId);
      setPatient(data);
      if (data) {
        setEditFormData({
          fullName: data.full_name || '',
          phone: data.phone || '',
          dateOfBirth: data.date_of_birth || '',
          gender: data.gender || 'ذكر',
          address: data.address || '',
          bloodType: data.blood_type || '',
          allergies: data.chronic_diseases_allergies || data.allergies || '',
          notes: data.notes || '',
        });
      }
    } catch (err) {
      console.error('[Console Debug - تعذر جلب سجل المريض]:', err);
      setPatientError('تعذر جلب ملف المريض من قاعدة البيانات.');
    } finally {
      setPatientLoading(false);
    }
  };

  // جلب الحجوزات المرتبطة بالمريض عبر patient_id
  const loadAppointments = async () => {
    if (!patientId) return;
    setAppointmentsLoading(true);
    setAppointmentsError(null);
    try {
      const res = await fetchPatientAppointments(patientId);
      setAppointments(res || []);
    } catch (err) {
      console.error('[Console Debug - تعذر جلب حجوزات المريض]:', err);
      setAppointmentsError('تعذر تحميل جدول الحجوزات من قاعدة البيانات.');
    } finally {
      setAppointmentsLoading(false);
    }
  };

  // فحص وجلب سجل الزيارات الطبية للمريض
  const loadVisits = async () => {
    if (!patientId) return;
    setVisitsLoading(true);
    setVisitsError(null);
    try {
      const res = await fetchPatientVisits(patientId);
      setVisits(res.data || []);
      setVisitsTableExists(res.exists || false);
    } catch (err) {
      console.error('[Console Debug - تعذر فحص جدول الزيارات]:', err);
      setVisitsError('تعذر التحقق من سجل الزيارات الطبية.');
    } finally {
      setVisitsLoading(false);
    }
  };

  // جلب الفواتير المرتبطة بالمريض عبر patient_id
  const loadInvoices = async () => {
    if (!patientId) return;
    setInvoicesLoading(true);
    setInvoicesError(null);
    try {
      const res = await fetchPatientInvoices(patientId);
      setInvoices(res || []);
    } catch (err) {
      console.error('[Console Debug - تعذر جلب فواتير المريض]:', err);
      setInvoicesError('تعذر تحميل بيانات الفواتير من قاعدة البيانات.');
    } finally {
      setInvoicesLoading(false);
    }
  };

  // جلب البيانات عند تغيير معرّف المريض
  useEffect(() => {
    loadPatientHeader();
    loadAppointments();
    loadVisits();
    loadInvoices();
  }, [patientId]);

  // حفظ التعديلات على بيانات المريض الأساسية
  const handleSavePatientEdit = async (e) => {
    e.preventDefault();
    if (!editFormData.fullName || !editFormData.fullName.trim()) {
      setModalError('يرجى إدخال اسم المريض الكامل.');
      return;
    }

    setActionSubmitting(true);
    setModalError(null);
    try {
      const res = await updatePatientInfo(patient.id, editFormData);
      if (res.success) {
        setPatient(res.patient);
        setIsEditModalOpen(false);
        showToast('تم تحديث بيانات ملف المريض بنجاح.');
      } else {
        setModalError(res.message || 'تعذر تحديث البيانات.');
      }
    } catch (err) {
      console.error('[Console Debug - تعذر تحديث بيانات المريض]:', err);
      setModalError('حدث خطأ أثناء حفظ التعديلات.');
    } finally {
      setActionSubmitting(false);
    }
  };

  // 1. حالة التحميل العامة لترويسة الصفحة
  if (patientLoading) {
    return (
      <div className="section-block" dir="rtl">
        <div className="dashboard-skeleton-container">
          <div className="skeleton-header-row">
            <div className="skeleton-bar skeleton-bar--heading" />
            <div className="skeleton-bar skeleton-bar--sub" />
          </div>
          <div className="skeleton-card">
            <div className="skeleton-bar skeleton-bar--value" />
            <div className="skeleton-bar skeleton-bar--subtitle" />
          </div>
        </div>
      </div>
    );
  }

  // 2. حالة عدم العثور على المريض
  if (!patient) {
    return (
      <div className="section-block" dir="rtl">
        <div className="patient-alert-danger" role="alert">
          <div className="alert-icon-wrap">
            <AlertCircleIcon size={24} />
          </div>
          <div className="alert-body">
            <strong className="alert-title">تعذر العثور على ملف المريض</strong>
            <p className="alert-description">
              لم يتم العثور على أي بيانات مسجلة للمعرف المطلوب ({patientId || 'غير محدد'}). قد يكون المعرف غير صحيح أو تم حذفه من قاعدة البيانات.
            </p>
          </div>
          <div className="alert-actions">
            <button
              type="button"
              onClick={onBackToPatients}
              className="btn-action-primary btn-sm"
            >
              العودة إلى قائمة المرضى
            </button>
            <button
              type="button"
              onClick={onBackToDashboard}
              className="btn-action-secondary btn-sm"
            >
              لوحة التحكم
            </button>
          </div>
        </div>
      </div>
    );
  }

  // حساب العمر
  const calculatedAge = calculateAge(patient.date_of_birth);

  // إحصائيات الفواتير المحسوبة بدقة
  const totalBilled = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount || inv.amount || 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => {
    if (inv.paidAmount !== undefined) return sum + Number(inv.paidAmount);
    if (inv.paid_amount !== undefined) return sum + Number(inv.paid_amount);
    if (inv.status === 'مدفوعة') return sum + Number(inv.amount || 0);
    if (inv.status === 'مدفوعة جزئيًا') {
      const partial = inv.paid_amount !== undefined ? Number(inv.paid_amount) : Number(inv.amount || 0) / 2;
      return sum + partial;
    }
    return sum;
  }, 0);
  const totalRemaining = Math.max(0, totalBilled - totalPaid);

  const formattedCreatedDate = patient.created_at
    ? new Date(patient.created_at).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'تاريخ غير محدد';

  const allergyText = patient.chronic_diseases_allergies || patient.allergies;

  return (
    <div className="patient-profile-wrapper" dir="rtl">
      {/* إشعار نجاح منبثق (Toast) */}
      {toastMessage && (
        <div className="dashboard-toast" role="status">
          <span className="toast-dot" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* مسار التنقل العلوي (Breadcrumbs) */}
      <div className="patient-breadcrumb">
        <button
          type="button"
          onClick={onBackToDashboard}
          className="breadcrumb-link"
        >
          لوحة التحكم
        </button>
        <span className="breadcrumb-separator">/</span>
        <button
          type="button"
          onClick={onBackToPatients}
          className="breadcrumb-link"
        >
          سجل المرضى
        </button>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-current">{patient.full_name}</span>
      </div>

      {/* ======================================================================
          بطاقة ملخص ملف المريض العلوية
          ====================================================================== */}
      <section className="patient-summary-card" aria-label="ملخص ملف المريض">
        <div className="summary-card-top">
          <div className="summary-identity">
            <div className="summary-avatar">
              <span>{(patient.full_name || 'م')[0]}</span>
            </div>
            <div className="summary-name-box">
              <div className="summary-name-row">
                <h1 className="summary-title">{patient.full_name}</h1>
                <span className="file-code-badge font-numeric" title="الرقم الطبي">
                  الرقم الطبي: #{String(patient.id).slice(0, 8).toUpperCase()}
                </span>
              </div>
              <span className="summary-meta-sub">
                تاريخ التسجيل: <strong className="font-numeric">{formattedCreatedDate}</strong>
              </span>
            </div>
          </div>

          <div className="summary-actions-bar">
            {/* زر حجز موعد جديد للمريض */}
            <button
              type="button"
              onClick={() => setIsBookingModalOpen(true)}
              className="btn-action-primary"
              aria-label="حجز موعد"
              style={{
                backgroundColor: 'var(--teal-600, #0d9488)',
                color: '#ffffff',
                borderColor: 'var(--teal-600, #0d9488)',
              }}
            >
              <CalendarIcon size={16} />
              <span>حجز موعد</span>
            </button>

            {/* زر تعديل بيانات المريض */}
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="btn-action-secondary"
              aria-label="تعديل بيانات المريض"
            >
              <EditIcon size={16} />
              <span>تعديل بيانات المريض</span>
            </button>

            <button
              type="button"
              onClick={onBackToPatients}
              className="btn-action-secondary"
              title="العودة لقائمة المرضى"
            >
              <ArrowRightIcon size={16} />
              <span>قائمة المرضى</span>
            </button>
          </div>
        </div>

        {/* شبكة البيانات الحيوية للملخص */}
        <div className="summary-items-grid">
          <div className="summary-stat-box">
            <span className="summary-stat-label">رقم الهاتف</span>
            <span className="summary-stat-value font-numeric" dir="ltr">
              <PhoneIcon size={15} />
              {patient.phone || 'غير مسجل'}
            </span>
          </div>

          <div className="summary-stat-box">
            <span className="summary-stat-label">العمر</span>
            <span className="summary-stat-value font-numeric">
              {calculatedAge}
            </span>
          </div>

          <div className="summary-stat-box">
            <span className="summary-stat-label">النوع</span>
            <span className="summary-stat-value">
              {patient.gender || 'غير محدد'}
            </span>
          </div>

          <div className="summary-stat-box">
            <span className="summary-stat-label">فصيلة الدم</span>
            <span className="summary-stat-value">
              {patient.blood_type ? (
                <span className="blood-type-badge">{patient.blood_type}</span>
              ) : (
                <span className="text-muted">غير محددة</span>
              )}
            </span>
          </div>

          <div className="summary-stat-box">
            <span className="summary-stat-label">إجمالي الحجوزات</span>
            <span className="summary-stat-value font-numeric">
              {appointmentsLoading ? '...' : appointments.length} مواعيد
            </span>
          </div>
        </div>

        {/* تنبيه الحساسية أو الأمراض المزمنة */}
        {allergyText ? (
          <div className="allergy-alert-banner allergy-alert-banner--warning" role="alert">
            <div style={{ color: '#b45309', display: 'flex', alignItems: 'center' }}>
              <ShieldAlertIcon size={20} />
            </div>
            <div>
              <strong style={{ fontWeight: 800, display: 'block', marginBottom: '0.2rem' }}>
                تنبيه طبي — حساسية أو أمراض مزمنة:
              </strong>
              <span>{allergyText}</span>
            </div>
          </div>
        ) : (
          <div className="allergy-alert-banner allergy-alert-banner--calm">
            <div style={{ color: '#15803d', display: 'flex', alignItems: 'center' }}>
              <CheckIcon size={18} />
            </div>
            <div>
              <strong>الحالة التحسسية:</strong> لا توجد حساسية أو أمراض مزمنة مسجلة في ملف المريض حالياً.
            </div>
          </div>
        )}
      </section>

      {/* ======================================================================
          شريط التبويبات الأربعة
          ====================================================================== */}
      <nav className="patient-tabs-nav" aria-label="أقسام ملف المريض">
        <button
          type="button"
          onClick={() => setActiveTab('basic-info')}
          className={`patient-tab-button ${activeTab === 'basic-info' ? 'patient-tab-button--active' : ''}`}
        >
          <FileTextIcon size={17} />
          <span>البيانات الأساسية</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('appointments')}
          className={`patient-tab-button ${activeTab === 'appointments' ? 'patient-tab-button--active' : ''}`}
        >
          <CalendarIcon size={17} />
          <span>الحجوزات</span>
          <span className="patient-tab-counter font-numeric">
            {appointmentsLoading ? '...' : appointments.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('visits')}
          className={`patient-tab-button ${activeTab === 'visits' ? 'patient-tab-button--active' : ''}`}
        >
          <ActivityIcon size={17} />
          <span>الزيارات الطبية</span>
          <span className="patient-tab-counter font-numeric">
            {visitsLoading ? '...' : visits.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('invoices')}
          className={`patient-tab-button ${activeTab === 'invoices' ? 'patient-tab-button--active' : ''}`}
        >
          <CreditCardIcon size={17} />
          <span>الفواتير (عرض فقط)</span>
          <span className="patient-tab-counter font-numeric">
            {invoicesLoading ? '...' : invoices.length}
          </span>
        </button>
      </nav>

      {/* ======================================================================
          محتويات التبويبات بحالات Loading و Error و Empty State مستقلة
          ====================================================================== */}

      {/* ١ — تبويب البيانات الأساسية */}
      {activeTab === 'basic-info' && (
        <div className="patient-tab-pane">
          <div className="profile-details-grid">
            <div className="profile-card">
              <div className="profile-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="profile-card-title">المعلومات الشخصية وبيانات الاتصال</h3>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="btn-action-secondary btn-sm"
                  aria-label="تعديل البيانات الأساسية"
                >
                  <EditIcon size={14} />
                  <span>تعديل</span>
                </button>
              </div>
              <div className="profile-fields-list">
                <div className="profile-field-row">
                  <span className="profile-field-label">الاسم الكامل:</span>
                  <strong className="profile-field-value">{patient.full_name}</strong>
                </div>

                <div className="profile-field-row">
                  <span className="profile-field-label">رقم الهاتف:</span>
                  <span className="profile-field-value font-numeric" dir="ltr">
                    {patient.phone || 'غير مسجل'}
                  </span>
                </div>

                <div className="profile-field-row">
                  <span className="profile-field-label">تاريخ الميلاد:</span>
                  <span className="profile-field-value font-numeric">
                    {patient.date_of_birth || 'غير مسجل'}
                  </span>
                </div>

                <div className="profile-field-row">
                  <span className="profile-field-label">النوع:</span>
                  <span className="profile-field-value">
                    {patient.gender || 'غير محدد'}
                  </span>
                </div>

                <div className="profile-field-row">
                  <span className="profile-field-label">العنوان السكني:</span>
                  <span className="profile-field-value">
                    {patient.address || 'لم يتم تسجيل العنوان'}
                  </span>
                </div>
              </div>
            </div>

            <div className="profile-card">
              <div className="profile-card-header">
                <h3 className="profile-card-title">السجل الطبي والملاحظات السريرية</h3>
              </div>
              <div className="profile-fields-list">
                <div className="profile-field-row">
                  <span className="profile-field-label">فصيلة الدم:</span>
                  {patient.blood_type ? (
                    <span className="blood-type-badge">{patient.blood_type}</span>
                  ) : (
                    <span className="text-muted">غير محددة</span>
                  )}
                </div>

                <div className="profile-notes-group">
                  <span className="profile-field-label">الحساسية والأمراض المزمنة:</span>
                  <div
                    className={`profile-alert-box ${
                      allergyText ? 'profile-alert-box--warning' : ''
                    }`}
                  >
                    {allergyText || 'لا توجد حساسية أو أمراض مزمنة مسجلة في ملف المريض.'}
                  </div>
                </div>

                <div className="profile-notes-group">
                  <span className="profile-field-label">ملاحظات عامة:</span>
                  <div className="profile-notes-box">
                    {patient.notes || 'لا توجد ملاحظات إضافية مسجلة.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ٢ — تبويب الحجوزات */}
      {activeTab === 'appointments' && (
        <div className="patient-tab-pane">
          <div className="dashboard-panel">
            <div className="panel-header" style={{ marginBottom: '1.25rem' }}>
              <div>
                <h3 className="panel-title">جدول مواعيد وحجوزات المريض</h3>
                <span className="panel-subtitle">المواعيد المسجلة والمرتبطة بمعرف المريض (patient_id)</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setIsBookingModalOpen(true)}
                  className="btn-action-primary btn-sm"
                  title="حجز موعد جديد لهذا المريض"
                  style={{
                    backgroundColor: 'var(--teal-600, #0d9488)',
                    borderColor: 'var(--teal-600, #0d9488)',
                    color: '#fff',
                  }}
                >
                  <CalendarIcon size={14} />
                  <span>حجز موعد جديد</span>
                </button>
                <button
                  type="button"
                  onClick={loadAppointments}
                  className="btn-action-secondary btn-sm"
                  title="تحديث جدول الحجوزات"
                >
                  <RefreshCwIcon size={14} />
                  <span>تحديث</span>
                </button>
              </div>
            </div>

            {/* حالة التحميل المستقلة */}
            {appointmentsLoading ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
                <div className="skeleton-line" style={{ height: '36px', marginBottom: '0.85rem' }} />
                <div className="skeleton-line" style={{ height: '36px', marginBottom: '0.85rem' }} />
                <div className="skeleton-line" style={{ height: '36px' }} />
                <p className="text-muted" style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                  جاري تحميل جدول مواعيد وحجوزات المريض من قاعدة البيانات...
                </p>
              </div>
            ) : appointmentsError ? (
              /* حالة الخطأ المستقلة */
              <div className="patient-alert-danger" role="alert" style={{ margin: '1rem 0' }}>
                <div className="alert-icon-wrap">
                  <AlertCircleIcon size={20} />
                </div>
                <div className="alert-body">
                  <strong className="alert-title">خطأ في جلب الحجوزات:</strong>
                  <p className="alert-description">{appointmentsError}</p>
                </div>
                <button
                  type="button"
                  onClick={loadAppointments}
                  className="btn-action-secondary btn-sm"
                >
                  <RefreshCwIcon size={14} />
                  <span>إعادة المحاولة</span>
                </button>
              </div>
            ) : appointments.length === 0 ? (
              /* حالة الفراغ المستقلة (Empty State) */
              <div className="state-feedback-card state-feedback-card--empty">
                <div className="state-feedback-icon state-feedback-icon--empty">
                  <CalendarIcon size={28} />
                </div>
                <h4 className="state-feedback-title">لا توجد حجوزات مسجلة لهذا المريض حالياً</h4>
                <p className="state-feedback-message">
                  لم يتم العثور على أي مواعيد سابقة أو قادمة مرتبطة بهذا المريض في قاعدة البيانات.
                </p>
                <div style={{ marginTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsBookingModalOpen(true)}
                    className="btn-action-primary btn-sm"
                    style={{
                      backgroundColor: 'var(--teal-600, #0d9488)',
                      borderColor: 'var(--teal-600, #0d9488)',
                      color: '#fff',
                    }}
                  >
                    <CalendarIcon size={14} />
                    <span>حجز موعد الآن</span>
                  </button>
                </div>
              </div>
            ) : (
              /* عرض جدول الحجوزات */
              <div className="table-responsive-desktop">
                <table className="custom-data-table" aria-label="قائمة مواعيد المريض">
                  <thead>
                    <tr>
                      <th>معرف الحجز</th>
                      <th>التاريخ</th>
                      <th>الوقت</th>
                      <th>نوع الزيارة / البيان</th>
                      <th style={{ textAlign: 'center' }}>حالة الحجز</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map((apt) => {
                      const dateObj = apt.appointment_date ? new Date(apt.appointment_date) : null;
                      const formattedDate = dateObj
                        ? dateObj.toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        : '—';
                      const formattedTime = dateObj
                        ? dateObj.toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—';

                      return (
                        <tr key={apt.id} className="data-table-row">
                          <td>
                            <span className="invoice-code-tag font-numeric">
                              #{String(apt.id).slice(0, 8).toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <span className="font-numeric" style={{ fontWeight: 700 }}>
                              {formattedDate}
                            </span>
                          </td>
                          <td>
                            <span className="font-numeric text-muted">
                              {formattedTime}
                            </span>
                          </td>
                          <td>
                            <span>{apt.notes || 'كشف ومتابعة روتينية'}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              className={`status-pill ${
                                apt.status === 'مؤكد'
                                  ? 'status-pill--confirmed'
                                  : apt.status === 'مكتمل' || apt.status === 'مكتملة'
                                  ? 'status-pill--completed'
                                  : apt.status === 'في الانتظار'
                                  ? 'status-pill--pending'
                                  : 'status-pill--cancelled'
                              }`}
                            >
                              {apt.status || 'مؤكد'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ٣ — تبويب الزيارات الطبية */}
      {activeTab === 'visits' && (
        <div className="patient-tab-pane">
          <div className="dashboard-panel">
            <div className="panel-header" style={{ marginBottom: '1.25rem' }}>
              <div>
                <h3 className="panel-title">سجل الزيارات والكشوفات الطبية</h3>
                <span className="panel-subtitle">الزيارات الطبية المنفذة بواسطة الطبيب المعالج</span>
              </div>
              <button
                type="button"
                onClick={loadVisits}
                className="btn-action-secondary btn-sm"
                title="تحديث سجل الزيارات"
              >
                <RefreshCwIcon size={14} />
                <span>تحديث</span>
              </button>
            </div>

            {/* حالة التحميل المستقلة */}
            {visitsLoading ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
                <div className="skeleton-line" style={{ height: '36px', marginBottom: '0.85rem' }} />
                <div className="skeleton-line" style={{ height: '36px' }} />
                <p className="text-muted" style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                  جاري فحص وتحديث سجل الزيارات الطبية...
                </p>
              </div>
            ) : visitsError ? (
              /* حالة الخطأ المستقلة */
              <div className="patient-alert-danger" role="alert" style={{ margin: '1rem 0' }}>
                <div className="alert-icon-wrap">
                  <AlertCircleIcon size={20} />
                </div>
                <div className="alert-body">
                  <strong className="alert-title">خطأ في فحص الزيارات الطبية:</strong>
                  <p className="alert-description">{visitsError}</p>
                </div>
                <button
                  type="button"
                  onClick={loadVisits}
                  className="btn-action-secondary btn-sm"
                >
                  <RefreshCwIcon size={14} />
                  <span>إعادة المحاولة</span>
                </button>
              </div>
            ) : !visitsTableExists || visits.length === 0 ? (
              /* حالة الفراغ المستقلة (Empty State الصريحة دون بيانات وهمية) */
              <div className="state-feedback-card state-feedback-card--empty">
                <div className="state-feedback-icon state-feedback-icon--empty">
                  <ActivityIcon size={28} />
                </div>
                <h4 className="state-feedback-title">لا توجد زيارات طبية مسجلة لهذا المريض</h4>
                <p className="state-feedback-message">
                  جدول الزيارات الطبية غير مفعل في قاعدة بيانات العيادة الحالية، ولا توجد أي كشوفات طبية مسجلة لهذا المريض.
                </p>
              </div>
            ) : (
              /* عرض جدول الزيارات الطبية مرتبة من الأحدث إلى الأقدم */
              <div className="table-responsive-desktop">
                <table className="custom-data-table" aria-label="قائمة الزيارات الطبية">
                  <thead>
                    <tr>
                      <th scope="col">التاريخ والوقت</th>
                      <th scope="col">الطبيب المعالج</th>
                      <th scope="col">حالة الكشف</th>
                      <th scope="col">التشخيص والشكوى</th>
                      <th scope="col">الخطة والملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map((visit, idx) => {
                      const doctorInfo = visit.doctor_id ? getDoctorById(visit.doctor_id) : null;
                      const doctorDisplay = doctorInfo?.name || visit.doctor_name || 'طبيب العيادة';
                      const isDraft = visit.status === 'مسودة';

                      return (
                        <tr key={visit.id || idx} className="data-table-row">
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span className="font-numeric" style={{ fontWeight: 700 }}>
                                {visit.visit_date || visit.created_at ? String(visit.visit_date || visit.created_at).slice(0, 10) : '—'}
                              </span>
                              <span className="font-numeric text-muted" style={{ fontSize: '0.8rem' }}>
                                {visit.visit_date || visit.created_at ? new Date(visit.visit_date || visit.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div>
                              <strong style={{ display: 'block', fontSize: '0.92rem' }}>{doctorDisplay}</strong>
                              {doctorInfo?.specialty && (
                                <span className="text-muted" style={{ fontSize: '0.8rem' }}>{doctorInfo.specialty}</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className={`status-pill ${isDraft ? 'status-pill--pending' : 'status-pill--completed'}`}>
                              {isDraft ? 'مسودة كشف 📝' : 'كشف معتمد ✓'}
                            </span>
                          </td>
                          <td>
                            <div style={{ maxWidth: '280px' }}>
                              {visit.diagnosis ? (
                                <strong style={{ color: '#0f766e', display: 'block' }}>{visit.diagnosis}</strong>
                              ) : (
                                <span className="text-muted">تشخيص قيد الاستكمال</span>
                              )}
                              {visit.chief_complaint && (
                                <span style={{ fontSize: '0.82rem', color: '#64748b', display: 'block', marginTop: '0.2rem' }}>
                                  الشكوى: {visit.chief_complaint}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div style={{ maxWidth: '320px', fontSize: '0.88rem' }}>
                              {visit.clinical_data?.prescription?.items?.length > 0 && (
                                <div style={{ marginBottom: '0.35rem' }}>
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.25rem',
                                      fontSize: '0.78rem',
                                      fontWeight: 700,
                                      padding: '0.15rem 0.5rem',
                                      borderRadius: '6px',
                                      backgroundColor: '#ecfdf5',
                                      color: '#065f46',
                                      border: '1px solid #a7f3d0',
                                    }}
                                  >
                                    <span>💊 روشتة:</span>
                                    <span className="font-numeric">
                                      {visit.clinical_data.prescription.items.length} أدوية موصوفة
                                    </span>
                                  </span>
                                </div>
                              )}
                              {visit.treatment_plan && (
                                <div style={{ marginBottom: '0.25rem' }}>
                                  <strong>العلاج: </strong>
                                  <span style={{ whiteSpace: 'pre-line' }}>{visit.treatment_plan}</span>
                                </div>
                              )}
                              {visit.notes && (
                                <div className="text-muted" style={{ fontSize: '0.82rem' }}>
                                  <strong>توصيات: </strong>
                                  <span>{visit.notes}</span>
                                </div>
                              )}
                              {!visit.treatment_plan && !visit.notes && (!visit.clinical_data?.prescription?.items?.length) && (
                                <span className="text-muted">{visit.summary || '—'}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ٤ — تبويب الفواتير (عرض فقط للقراءة) */}
      {activeTab === 'invoices' && (
        <div className="patient-tab-pane">
          <div className="dashboard-panel">
            {/* شريط توضيح أن التبويب للعرض فقط */}
            <div className="readonly-info-ribbon" role="note">
              <AlertCircleIcon size={18} />
              <span>
                تبويب الفواتير مخصص للعرض والاستعراض فقط (Read-only) — جميع المبالغ والبيانات للقراءة فقط استناداً لسجلات Supabase.
              </span>
            </div>

            <div className="panel-header" style={{ marginBottom: '1.25rem' }}>
              <div>
                <h3 className="panel-title">فواتير ومطالبات المريض المالية</h3>
                <span className="panel-subtitle">
                  الإجمالي: <strong className="font-numeric">{totalBilled.toLocaleString('ar-EG')} ج.م</strong> • المدفوع: <strong className="font-numeric" style={{ color: '#047857' }}>{totalPaid.toLocaleString('ar-EG')} ج.م</strong> • المتبقي: <strong className="font-numeric" style={{ color: totalRemaining > 0 ? '#b91c1c' : '#475569' }}>{totalRemaining.toLocaleString('ar-EG')} ج.م</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={loadInvoices}
                className="btn-action-secondary btn-sm"
                title="تحديث قائمة الفواتير"
              >
                <RefreshCwIcon size={14} />
                <span>تحديث</span>
              </button>
            </div>

            {/* حالة التحميل المستقلة */}
            {invoicesLoading ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
                <div className="skeleton-line" style={{ height: '36px', marginBottom: '0.85rem' }} />
                <div className="skeleton-line" style={{ height: '36px', marginBottom: '0.85rem' }} />
                <div className="skeleton-line" style={{ height: '36px' }} />
                <p className="text-muted" style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                  جاري تحميل سجل الفواتير والمطالبات المالية للمريض...
                </p>
              </div>
            ) : invoicesError ? (
              /* حالة الخطأ المستقلة */
              <div className="patient-alert-danger" role="alert" style={{ margin: '1rem 0' }}>
                <div className="alert-icon-wrap">
                  <AlertCircleIcon size={20} />
                </div>
                <div className="alert-body">
                  <strong className="alert-title">خطأ في جلب الفواتير:</strong>
                  <p className="alert-description">{invoicesError}</p>
                </div>
                <button
                  type="button"
                  onClick={loadInvoices}
                  className="btn-action-secondary btn-sm"
                >
                  <RefreshCwIcon size={14} />
                  <span>إعادة المحاولة</span>
                </button>
              </div>
            ) : invoices.length === 0 ? (
              /* حالة الفراغ المستقلة (Empty State) */
              <div className="state-feedback-card state-feedback-card--empty">
                <div className="state-feedback-icon state-feedback-icon--empty">
                  <CreditCardIcon size={28} />
                </div>
                <h4 className="state-feedback-title">لا توجد فواتير مسجلة لهذا المريض</h4>
                <p className="state-feedback-message">
                  لا توجد أي فواتير أو مطالبات مالية مسجلة باسم هذا المريض في قاعدة البيانات.
                </p>
              </div>
            ) : (
              /* عرض جدول الفواتير للقراءة فقط */
              <div className="table-responsive-desktop">
                <table className="custom-data-table" aria-label="فواتير المريض">
                  <thead>
                    <tr>
                      <th>رقم الفاتورة</th>
                      <th>التاريخ</th>
                      <th>الإجمالي</th>
                      <th>المدفوع</th>
                      <th>المتبقي</th>
                      <th style={{ textAlign: 'center' }}>حالة الدفع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => {
                      const amount = Number(inv.totalAmount || inv.amount || 0);
                      let paid = 0;
                      if (inv.paidAmount !== undefined) {
                        paid = Number(inv.paidAmount);
                      } else if (inv.status === 'مدفوعة') {
                        paid = amount;
                      } else if (inv.status === 'مدفوعة جزئيًا') {
                        paid = inv.paid_amount !== undefined ? Number(inv.paid_amount) : amount / 2;
                      } else {
                        paid = 0;
                      }
                      const remaining = inv.remainingAmount !== undefined ? Number(inv.remainingAmount) : Math.max(0, amount - paid);

                      return (
                        <tr key={inv.id} className="data-table-row">
                          <td>
                            <span className="invoice-code-tag font-numeric">
                              #{String(inv.id).slice(0, 8).toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <span className="font-numeric text-muted">
                              {inv.issue_date || (inv.created_at ? String(inv.created_at).slice(0, 10) : '—')}
                            </span>
                          </td>
                          <td>
                            <strong className="font-numeric" style={{ color: 'var(--text-main)' }}>
                              {amount.toLocaleString('ar-EG')} ج.م
                            </strong>
                          </td>
                          <td>
                            <span className="font-numeric" style={{ color: '#047857', fontWeight: 700 }}>
                              {paid.toLocaleString('ar-EG')} ج.م
                            </span>
                          </td>
                          <td>
                            <span
                              className="font-numeric"
                              style={{
                                color: remaining > 0 ? '#b91c1c' : '#64748b',
                                fontWeight: remaining > 0 ? 700 : 500,
                              }}
                            >
                              {remaining.toLocaleString('ar-EG')} ج.م
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              className={`status-pill ${
                                inv.status === 'مدفوعة'
                                  ? 'status-pill--paid'
                                  : inv.status === 'مدفوعة جزئيًا'
                                  ? 'status-pill--pending'
                                  : inv.status === 'متأخرة'
                                  ? 'status-pill--overdue'
                                  : 'status-pill--unpaid'
                              }`}
                            >
                              {inv.status || 'غير مدفوعة'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================================
          نافذة تعديل بيانات المريض (Edit Patient Modal)
          ====================================================================== */}
      {isEditModalOpen && (
        <div className="profile-modal-backdrop" role="dialog" aria-modal="true" aria-label="تعديل بيانات المريض">
          <div className="profile-modal-window">
            <div className="profile-modal-top">
              <h3 className="profile-modal-title">تعديل بيانات المريض</h3>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setModalError(null);
                }}
                className="modal-close-btn"
                aria-label="إغلاق"
              >
                <CloseIcon size={20} />
              </button>
            </div>

            {modalError && (
              <div className="patient-alert-danger" role="alert" style={{ padding: '0.85rem' }}>
                <AlertCircleIcon size={18} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSavePatientEdit} className="profile-modal-body">
              <div className="form-group">
                <label className="field-label">
                  الاسم الكامل <span className="required-star">*</span>
                </label>
                <input
                  type="text"
                  value={editFormData.fullName || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                  className="field-input"
                  required
                />
              </div>

              <div className="patient-fields-grid">
                <div className="form-group">
                  <label className="field-label">
                    رقم الهاتف <span className="required-star">*</span>
                  </label>
                  <input
                    type="tel"
                    value={editFormData.phone || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="field-input"
                    dir="ltr"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="field-label">تاريخ الميلاد</label>
                  <input
                    type="date"
                    value={editFormData.dateOfBirth || ''}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setEditFormData({ ...editFormData, dateOfBirth: e.target.value })}
                    className="field-input"
                  />
                </div>

                <div className="form-group">
                  <label className="field-label">النوع</label>
                  <select
                    value={editFormData.gender || 'ذكر'}
                    onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value })}
                    className="field-select"
                  >
                    <option value="ذكر">ذكر</option>
                    <option value="أنثى">أنثى</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="field-label">فصيلة الدم</label>
                  <select
                    value={editFormData.bloodType || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, bloodType: e.target.value })}
                    className="field-select"
                  >
                    <option value="">اختر فصيلة الدم</option>
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
              </div>

              <div className="form-group">
                <label className="field-label">العنوان</label>
                <input
                  type="text"
                  value={editFormData.address || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  className="field-input"
                />
              </div>

              <div className="form-group">
                <label className="field-label">الحساسية والأمراض المزمنة</label>
                <textarea
                  rows={2}
                  value={editFormData.allergies || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, allergies: e.target.value })}
                  className="field-textarea"
                  placeholder="مثال: حساسية البنسلين، داء السكري..."
                />
              </div>

              <div className="form-group">
                <label className="field-label">ملاحظات عامة</label>
                <textarea
                  rows={2}
                  value={editFormData.notes || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  className="field-textarea"
                />
              </div>

              <div className="profile-modal-footer">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn-cancel"
                  disabled={actionSubmitting}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={actionSubmitting}
                >
                  {actionSubmitting ? 'جاري الحفظ…' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة حجز موعد جديد للمريض (مع تمرير معرف وبيانات المريض وقفل التحديد تلقائياً) */}
      <AppointmentBookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        initialPatientId={patient?.id}
        initialPatient={patient}
        onSuccess={() => {
          showToast('تم تسجيل حجز الموعد بنجاح');
          loadAppointments();
          setActiveTab('appointments');
        }}
      />
    </div>
  );
}

export default PatientProfilePage;
