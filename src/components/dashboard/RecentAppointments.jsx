import React from 'react';
import { EyeIcon, ArrowLeftIcon, ClockIcon, CalendarIcon } from './Icons.jsx';
import { TablePanelSkeleton } from './DashboardSkeleton.jsx';
import { InlineSectionError } from './ErrorState.jsx';
import { EmptyState } from './EmptyState.jsx';

/**
 * تحديد لون وشكل الشارة بناءً على حالة الموعد
 */
const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'مؤكد':
      return 'badge-status badge-status--confirmed';
    case 'في الانتظار':
      return 'badge-status badge-status--waiting';
    case 'مكتمل':
      return 'badge-status badge-status--completed';
    case 'ملغي':
      return 'badge-status badge-status--cancelled';
    case 'يحتاج إلى متابعة':
      return 'badge-status badge-status--followup';
    default:
      return 'badge-status badge-status--default';
  }
};

/**
 * تحديد لون شارة نوع الزيارة
 */
const getVisitTypeBadgeClass = (type) => {
  switch (type) {
    case 'كشف جديد':
      return 'badge-pill badge-pill--teal';
    case 'متابعة':
      return 'badge-pill badge-pill--blue';
    case 'استشارة':
      return 'badge-pill badge-pill--purple';
    case 'إعادة كشف':
      return 'badge-pill badge-pill--slate';
    default:
      return 'badge-pill badge-pill--slate';
  }
};

/**
 * مكوّن جدول آخر المواعيد (RecentAppointments)
 * يدعم حالة التحميل بـ Skeleton، وحالة الخطأ الجزئي مع زر إعادة المحاولة
 */
export function RecentAppointments({
  appointments = [],
  isLoading = false,
  hasError = false,
  onRetry,
  onViewDetails,
  onViewAll,
  onAddAppointment,
}) {
  if (isLoading) {
    return <TablePanelSkeleton title="آخر المواعيد" rowsCount={5} />;
  }

  return (
    <section className="dashboard-panel" aria-labelledby="recent-appointments-title">
      <div className="dashboard-panel__header">
        <div>
          <h2 id="recent-appointments-title" className="dashboard-panel__title">
            آخر المواعيد
          </h2>
          <span className="dashboard-panel__subtitle">
            قائمة بآخر الحجوزات المسجلة اليوم مع حالتها
          </span>
        </div>

        <button
          type="button"
          onClick={onViewAll}
          className="panel-link-btn"
          aria-label="عرض جميع المواعيد"
        >
          <span>عرض جميع المواعيد</span>
          <ArrowLeftIcon size={15} />
        </button>
      </div>

      {hasError ? (
        <InlineSectionError
          message="تعذر تحميل المواعيد. حاول مرة أخرى."
          onRetry={onRetry}
        />
      ) : appointments.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon size={32} />}
          message="لا توجد مواعيد مسجلة اليوم."
          actionLabel="إضافة حجز جديد"
          onAction={onAddAppointment}
        />
      ) : (
        <>
          {/* عرض الجدول المكتبي (Desktop / Tablet view) */}
          <div className="table-responsive-desktop">
            <table className="custom-data-table" dir="rtl">
              <thead>
                <tr>
                  <th scope="col">اسم المريض</th>
                  <th scope="col">الوقت</th>
                  <th scope="col">التاريخ</th>
                  <th scope="col">نوع الزيارة</th>
                  <th scope="col">حالة الموعد</th>
                  <th scope="col" className="text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((apt) => (
                  <tr key={apt.id} className="data-table-row">
                    <td className="font-semibold text-main">
                      <div className="patient-name-cell">
                        <span className="patient-avatar-dot" aria-hidden="true" />
                        <span>{apt.patientName}</span>
                      </div>
                    </td>
                    <td>
                      <div className="time-cell">
                        <ClockIcon size={14} className="text-muted" />
                        <span className="font-numeric">{apt.time}</span>
                      </div>
                    </td>
                    <td className="text-muted font-numeric">{apt.date}</td>
                    <td>
                      <span className={getVisitTypeBadgeClass(apt.visitType)}>
                        {apt.visitType}
                      </span>
                    </td>
                    <td>
                      <span className={getStatusBadgeClass(apt.status)}>
                        {apt.status}
                      </span>
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        onClick={() => onViewDetails(apt)}
                        className="btn-action-view"
                        title={`عرض تفاصيل موعد ${apt.patientName}`}
                        aria-label={`عرض تفاصيل موعد ${apt.patientName}`}
                      >
                        <EyeIcon size={15} />
                        <span>تفاصيل</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* عرض البطاقات على شاشات الموبايل (Mobile Cards View) لمنع التمرير الأفقي */}
          <div className="mobile-cards-list" role="list">
            {appointments.map((apt) => (
              <div
                key={apt.id}
                className="mobile-record-card"
                role="listitem"
              >
                <div className="mobile-record-card__header">
                  <div>
                    <h3 className="mobile-record-card__title">{apt.patientName}</h3>
                    <div className="mobile-record-card__sub-row">
                      <span className="time-cell">
                        <ClockIcon size={13} className="text-muted" />
                        <span className="font-numeric">{apt.time}</span>
                      </span>
                      <span className="text-separator">•</span>
                      <span className="text-muted font-numeric">{apt.date}</span>
                    </div>
                  </div>
                  <span className={getStatusBadgeClass(apt.status)}>
                    {apt.status}
                  </span>
                </div>

                <div className="mobile-record-card__footer">
                  <span className={getVisitTypeBadgeClass(apt.visitType)}>
                    {apt.visitType}
                  </span>

                  <button
                    type="button"
                    onClick={() => onViewDetails(apt)}
                    className="btn-action-view btn-action-view--mobile"
                    aria-label={`عرض تفاصيل موعد ${apt.patientName}`}
                  >
                    <EyeIcon size={15} />
                    <span>عرض التفاصيل</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default RecentAppointments;
