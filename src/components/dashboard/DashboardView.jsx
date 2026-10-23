import React, { useState, useEffect } from 'react';
import StatCard from './StatCard.jsx';
import RecentAppointments from './RecentAppointments.jsx';
import RecentInvoices from './RecentInvoices.jsx';
import { StatCardsSkeleton } from './DashboardSkeleton.jsx';
import { ErrorState, InlineSectionError } from './ErrorState.jsx';
import { EmptyState } from './EmptyState.jsx';
import {
  CalendarIcon,
  PlusIcon,
  UserPlusIcon,
  CloseIcon,
} from './Icons.jsx';
import {
  fetchStatsFromSupabase,
  fetchAppointmentsFromSupabase,
  fetchInvoicesFromSupabase,
  fetchPatientsDropdownFromSupabase,
  addPatientToSupabase,
  addAppointmentToSupabase,
  resetSupabaseConnectionStatus,
} from '../../services/dashboardService.js';
import {
  getArabicCurrentDate,
  formatEGP,
} from '../../data/dashboardMockData.js';

/**
 * مكوّن صفحة لوحة التحكم الكاملة (DashboardView)
 * يعتمد على استعلامات منفصلة ومستقلة لبطاقات الإحصائيات، المواعيد، والفواتير،
 * مع استخدام Skeleton Loaders أثناء الجلب، ومعالجة آمنة للأخطاء دون إظهار تفاصيل تقنية
 */
export function DashboardView({ onNavigateSection }) {
  // 1. حالات قسم بطاقات الإحصائيات
  const [stats, setStats] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  // 2. حالات قسم المواعيد
  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [appointmentsError, setAppointmentsError] = useState(false);

  // 3. حالات قسم الفواتير والمدفوعات
  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesError, setInvoicesError] = useState(false);

  // 4. قائمة المرضى للنماذج المنسدلة
  const [patientsList, setPatientsList] = useState([]);

  // حالات النوافذ المنبثقة والإشعارات
  const [activeModal, setActiveModal] = useState(null); // 'newAppointment' | 'newPatient' | 'viewDetail'
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // تاريخ اليوم باللغة العربية
  const formattedToday = getArabicCurrentDate();

  // جلب بطاقات الإحصائيات بشكل مستقل
  const loadStats = async () => {
    try {
      setStatsLoading(true);
      setStatsError(false);
      const data = await fetchStatsFromSupabase();
      setStats(data);
    } catch (err) {
      console.error('[Console Debug - فشل جلب الإحصائيات من Supabase]:', err);
      setStatsError(true);
    } finally {
      setStatsLoading(false);
    }
  };

  // جلب جدول المواعيد بشكل مستقل
  const loadAppointments = async () => {
    try {
      setAppointmentsLoading(true);
      setAppointmentsError(false);
      const data = await fetchAppointmentsFromSupabase();
      setAppointments(data);
    } catch (err) {
      console.error('[Console Debug - فشل جلب المواعيد من Supabase]:', err);
      setAppointmentsError(true);
    } finally {
      setAppointmentsLoading(false);
    }
  };

  // جلب جدول الفواتير بشكل مستقل
  const loadInvoices = async () => {
    try {
      setInvoicesLoading(true);
      setInvoicesError(false);
      const data = await fetchInvoicesFromSupabase();
      setInvoices(data);
    } catch (err) {
      console.error('[Console Debug - فشل جلب الفواتير من Supabase]:', err);
      setInvoicesError(true);
    } finally {
      setInvoicesLoading(false);
    }
  };

  // جلب قائمة المرضى المسجلين للنماذج
  const loadPatientsList = async () => {
    try {
      const data = await fetchPatientsDropdownFromSupabase();
      setPatientsList(data);
    } catch (err) {
      console.error('[Console Debug - فشل جلب قائمة المرضى]:', err);
    }
  };

  // تحميل كافة أقسام الصفحة بالتوازي دون توقف عند تعثر أحدها
  const loadAll = () => {
    resetSupabaseConnectionStatus();
    loadStats();
    loadAppointments();
    loadInvoices();
    loadPatientsList();
  };

  useEffect(() => {
    loadAll();
  }, []);

  // إظهار إشعار سريع (Toast)
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // فتح تفاصيل موعد
  const handleViewAppointment = (appointment) => {
    setSelectedDetail({ type: 'appointment', data: appointment });
    setActiveModal('viewDetail');
  };

  // فتح تفاصيل فاتورة
  const handleViewInvoice = (invoice) => {
    setSelectedDetail({ type: 'invoice', data: invoice });
    setActiveModal('viewDetail');
  };

  // إغلاق النافذة المنبثقة
  const closeModal = () => {
    setActiveModal(null);
    setSelectedDetail(null);
  };

  // معالجة حفظ حجز جديد في جدول appointments
  const handleSaveAppointment = async (e) => {
    e.preventDefault();
    const form = e.target;
    const patientId = form.elements['apt-patient-id']?.value;
    const date = form.elements['apt-date']?.value;
    const time = form.elements['apt-time']?.value;
    const notes = form.elements['apt-notes']?.value;

    if (!patientId) {
      showToast('يرجى اختيار مريض من القائمة أو تسجيل مريض جديد أولاً');
      return;
    }

    try {
      setIsSubmitting(true);
      const appointmentDate = `${date}T${time}:00`;
      await addAppointmentToSupabase({
        patientId,
        appointmentDate,
        status: 'مؤكد',
        notes,
      });
      closeModal();
      showToast('تمت إضافة الحجز بنجاح في قاعدة البيانات!');
      // تحديث المواعيد والإحصائيات
      loadAppointments();
      loadStats();
    } catch (err) {
      console.error('[Console Debug - حفظ الحجز]:', err);
      showToast('تعذر حفظ الحجز. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // معالجة حفظ مريض جديد في جدول patients
  const handleSavePatient = async (e) => {
    e.preventDefault();
    const form = e.target;
    const fullName = form.elements['pat-full-name']?.value;
    const phone = form.elements['pat-phone']?.value;

    try {
      setIsSubmitting(true);
      await addPatientToSupabase({ fullName, phone });
      closeModal();
      showToast('تم حفظ ملف المريض بنجاح في قاعدة البيانات!');
      // تحديث قائمة المرضى والإحصائيات
      loadPatientsList();
      loadStats();
    } catch (err) {
      console.error('[Console Debug - حفظ المريض]:', err);
      showToast('تعذر تسجيل المريض. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // التحقق مما إذا كانت جميع الأقسام قد فشلت بالكامل
  const allFailed =
    statsError &&
    appointmentsError &&
    invoicesError &&
    !statsLoading &&
    !appointmentsLoading &&
    !invoicesLoading;

  // في حال فشل جميع استعلامات الصفحة معاً
  if (allFailed) {
    return (
      <div className="dashboard-wrapper">
        <header className="dashboard-top-bar" aria-label="ترويسة لوحة التحكم">
          <div className="dashboard-top-bar__intro">
            <div className="dashboard-title-row">
              <h1 className="dashboard-main-heading">لوحة التحكم</h1>
            </div>
            <p className="dashboard-sub-heading">نظرة سريعة على أداء عيادة الشفاء التخصصية اليوم — د. أحمد محمود (باطنة وجهاز هضمي)</p>
            <div className="dashboard-date-tag">
              <CalendarIcon size={16} />
              <span className="font-numeric">{formattedToday}</span>
            </div>
          </div>
        </header>

        <ErrorState
          title="تعذر تحميل بيانات لوحة التحكم. حاول مرة أخرى."
          onRetry={loadAll}
        />
      </div>
    );
  }

  return (
    <div className="dashboard-wrapper">
      {/* 1. ترويسة لوحة التحكم والإجراءات السريعة في أعلى الصفحة */}
      <header className="dashboard-top-bar" aria-label="ترويسة لوحة التحكم">
        <div className="dashboard-top-bar__intro">
          <div className="dashboard-title-row">
            <h1 className="dashboard-main-heading">لوحة التحكم</h1>
            <span className="live-status-pill">
              <span className="live-status-dot" aria-hidden="true" />
              متصل بقاعدة البيانات
            </span>
          </div>
          <p className="dashboard-sub-heading">نظرة سريعة على أداء عيادة الشفاء التخصصية اليوم — د. أحمد محمود (باطنة وجهاز هضمي)</p>
          <div className="dashboard-date-tag">
            <CalendarIcon size={16} />
            <span className="font-numeric">{formattedToday}</span>
          </div>
        </div>

        <div className="dashboard-actions-group">
          {/* زر ثانوي: إضافة مريض */}
          <button
            type="button"
            onClick={() => {
              if (onNavigateSection) {
                onNavigateSection('new-patient');
              } else {
                setActiveModal('newPatient');
              }
            }}
            className="btn-action-secondary"
            aria-label="إضافة مريض جديد"
          >
            <UserPlusIcon size={18} />
            <span>إضافة مريض</span>
          </button>

          {/* زر رئيسي: إضافة حجز جديد */}
          <button
            type="button"
            onClick={() => setActiveModal('newAppointment')}
            className="btn-action-primary"
            aria-label="إضافة حجز جديد"
          >
            <PlusIcon size={18} />
            <span>إضافة حجز جديد</span>
          </button>
        </div>
      </header>

      {/* 2. البطاقات الإحصائية الأربع الرئيسية (مع دعم Skeleton والخطأ الجزئي وحالة الفراغ) */}
      <section className="dashboard-stats-section" aria-label="الإحصائيات الرئيسية">
        {statsLoading ? (
          <StatCardsSkeleton />
        ) : statsError ? (
          <InlineSectionError
            message="تعذر تحميل بيانات لوحة التحكم. حاول مرة أخرى."
            onRetry={loadStats}
          />
        ) : !stats || stats.length === 0 ? (
          <EmptyState
            message="لا توجد بيانات إحصائية متاحة حالياً."
            description="ستظهر مؤشرات الأداء فور توفر بيانات المواعيد والمرضى."
          />
        ) : (
          <div className="stats-cards-grid">
            {stats.map((stat) => (
              <StatCard
                key={stat.id}
                title={stat.title}
                value={stat.value}
                unit={stat.unit}
                subtitle={stat.subtitle}
                colorScheme={stat.colorScheme}
                iconName={stat.iconName}
              />
            ))}
          </div>
        )}
      </section>

      {/* 3. شبكة الجداول: آخر المواعيد + آخر الفواتير والمدفوعات (استعلامات منفصلة تماماً) */}
      <div className="dashboard-content-grid">
        {/* قسم آخر المواعيد */}
        <RecentAppointments
          appointments={appointments}
          isLoading={appointmentsLoading}
          hasError={appointmentsError}
          onRetry={loadAppointments}
          onViewDetails={handleViewAppointment}
          onAddAppointment={() => setActiveModal('newAppointment')}
          onViewAll={() => {
            if (onNavigateSection) {
              onNavigateSection('appointments');
            } else {
              showToast('الانتقال إلى شاشة جميع الحجوزات...');
            }
          }}
        />

        {/* قسم آخر الفواتير والمدفوعات */}
        <RecentInvoices
          invoices={invoices}
          isLoading={invoicesLoading}
          hasError={invoicesError}
          onRetry={loadInvoices}
          onViewDetails={handleViewInvoice}
          onViewAll={() => {
            if (onNavigateSection) {
              onNavigateSection('invoices');
            } else {
              showToast('الانتقال إلى شاشة جميع الفواتير...');
            }
          }}
        />
      </div>

      {/* 4. نافذة منبثقة تفاعلية (Modal) لإضافة حجز جديد */}
      {activeModal === 'newAppointment' && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-apt-title">
          <div className="modal-container">
            <div className="modal-header">
              <div className="modal-header-icon modal-header-icon--teal">
                <PlusIcon size={20} />
              </div>
              <div>
                <h3 id="modal-apt-title" className="modal-title">إضافة حجز جديد</h3>
                <p className="modal-subtitle">تسجيل موعد كشف لمريض وحفظه في جدول appointments</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="modal-close-btn"
                aria-label="إغلاق النافذة"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAppointment} className="modal-form">
              <div className="form-group">
                <label htmlFor="apt-patient-id" className="form-label">
                  المريض <span className="text-danger">*</span>
                </label>
                {patientsList.length > 0 ? (
                  <select
                    id="apt-patient-id"
                    name="apt-patient-id"
                    required
                    className="form-select"
                    defaultValue=""
                  >
                    <option value="" disabled>-- اختر المريض المسجل --</option>
                    {patientsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} {p.phone ? `(${p.phone})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="alert-box-notice">
                    <span>لا يوجد مرضى مسجلون في قاعدة البيانات حالياً. يرجى الضغط على زر &quot;إضافة مريض&quot; أولاً.</span>
                  </div>
                )}
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="apt-date" className="form-label">
                    تاريخ الموعد <span className="text-danger">*</span>
                  </label>
                  <input
                    id="apt-date"
                    name="apt-date"
                    type="date"
                    required
                    className="form-input font-numeric"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="apt-time" className="form-label">
                    وقت الموعد <span className="text-danger">*</span>
                  </label>
                  <input
                    id="apt-time"
                    name="apt-time"
                    type="time"
                    required
                    className="form-input font-numeric"
                    defaultValue="10:00"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="apt-notes" className="form-label">
                  ملاحظات أو نوع الزيارة (notes)
                </label>
                <textarea
                  id="apt-notes"
                  name="apt-notes"
                  rows={3}
                  placeholder="مثال: كشف جديد، متابعة ضغط وسكر، فحص دوري..."
                  className="form-textarea"
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={closeModal} className="btn-cancel" disabled={isSubmitting}>
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={isSubmitting || patientsList.length === 0}
                >
                  {isSubmitting ? 'جاري الحفظ...' : 'تأكيد وحفظ الحجز'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. نافذة منبثقة تفاعلية لإضافة مريض جديد */}
      {activeModal === 'newPatient' && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-pat-title">
          <div className="modal-container">
            <div className="modal-header">
              <div className="modal-header-icon modal-header-icon--indigo">
                <UserPlusIcon size={20} />
              </div>
              <div>
                <h3 id="modal-pat-title" className="modal-title">تسجيل مريض جديد</h3>
                <p className="modal-subtitle">إدخال البيانات الأساسية لملف المريض</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="modal-close-btn"
                aria-label="إغلاق النافذة"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePatient} className="modal-form">
              <div className="form-group">
                <label htmlFor="pat-full-name" className="form-label">
                  الاسم الرباعي للمريض <span className="text-danger">*</span>
                </label>
                <input
                  id="pat-full-name"
                  name="pat-full-name"
                  type="text"
                  required
                  placeholder="مثال: محمود حسن إبراهيم"
                  className="form-input"
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="pat-phone" className="form-label">
                    رقم الهاتف <span className="text-danger">*</span>
                  </label>
                  <input
                    id="pat-phone"
                    name="pat-phone"
                    type="tel"
                    required
                    placeholder="01xxxxxxxxx"
                    className="form-input font-numeric"
                    dir="ltr"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="pat-gender" className="form-label">
                    الجنس
                  </label>
                  <select id="pat-gender" name="pat-gender" className="form-select" defaultValue="ذكر">
                    <option value="ذكر">ذكر</option>
                    <option value="أنثى">أنثى</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="pat-history" className="form-label">
                  التاريخ المرضي والحساسية
                </label>
                <textarea
                  id="pat-history"
                  name="pat-history"
                  rows={2}
                  placeholder="أي أمراض مزمنة أو حساسية من أدوية معينة..."
                  className="form-textarea"
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={closeModal} className="btn-cancel" disabled={isSubmitting}>
                  إلغاء
                </button>
                <button type="submit" className="btn-submit" disabled={isSubmitting}>
                  {isSubmitting ? 'جاري الحفظ...' : 'حفظ ملف المريض'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. نافذة عرض التفاصيل السريعة (موعد أو فاتورة) */}
      {activeModal === 'viewDetail' && selectedDetail && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-detail-title">
          <div className="modal-container">
            <div className="modal-header">
              <div>
                <h3 id="modal-detail-title" className="modal-title">
                  {selectedDetail.type === 'appointment' ? 'تفاصيل الموعد' : 'تفاصيل الفاتورة'}
                </h3>
                <p className="modal-subtitle">
                  {selectedDetail.type === 'appointment'
                    ? `المريض: ${selectedDetail.data.patientName}`
                    : `الفاتورة: ${selectedDetail.data.invoiceNumber}`}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="modal-close-btn"
                aria-label="إغلاق النافذة"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="modal-detail-content">
              {selectedDetail.type === 'appointment' ? (
                <div className="detail-rows-list">
                  <div className="detail-row">
                    <span className="detail-label">اسم المريض:</span>
                    <span className="detail-value font-semibold">{selectedDetail.data.patientName}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">رقم الهاتف:</span>
                    <span className="detail-value font-numeric" dir="ltr">{selectedDetail.data.phone || '01012345678'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">الوقت والتاريخ:</span>
                    <span className="detail-value font-numeric">{selectedDetail.data.time} — {selectedDetail.data.date}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">نوع الزيارة:</span>
                    <span className="detail-value">{selectedDetail.data.visitType}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">الحالة الحالية:</span>
                    <span className="detail-value font-semibold">{selectedDetail.data.status}</span>
                  </div>
                  <div className="detail-notes-box">
                    <strong>ملاحظات الطبيب / العيادة:</strong>
                    <p>{selectedDetail.data.doctorNotes || 'لا توجد ملاحظات إضافية مسجلة.'}</p>
                  </div>
                </div>
              ) : (
                <div className="detail-rows-list">
                  <div className="detail-row">
                    <span className="detail-label">رقم الفاتورة:</span>
                    <span className="detail-value font-numeric" dir="ltr">{selectedDetail.data.invoiceNumber}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">اسم المريض:</span>
                    <span className="detail-value font-semibold">{selectedDetail.data.patientName}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">تاريخ الإصدار:</span>
                    <span className="detail-value font-numeric">{selectedDetail.data.issueDate}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">نوع الخدمة:</span>
                    <span className="detail-value">{selectedDetail.data.visitType}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">المبلغ الإجمالي:</span>
                    <span className="detail-value font-numeric font-semibold">{formatEGP(selectedDetail.data.totalAmount)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">المبلغ المدفوع:</span>
                    <span className="detail-value font-numeric text-emerald font-semibold">{formatEGP(selectedDetail.data.paidAmount)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">حالة الدفع:</span>
                    <span className="detail-value font-semibold">{selectedDetail.data.paymentStatus}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button type="button" onClick={closeModal} className="btn-cancel w-full">
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. إشعار تفاعلي سريع (Toast notification) */}
      {toastMessage && (
        <div className="dashboard-toast" role="status" aria-live="polite">
          <span className="toast-dot" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default DashboardView;
