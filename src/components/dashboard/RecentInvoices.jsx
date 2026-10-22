import React from 'react';
import { EyeIcon, ArrowLeftIcon, CreditCardIcon } from './Icons.jsx';
import { formatEGP } from '../../data/dashboardMockData.js';
import { TablePanelSkeleton } from './DashboardSkeleton.jsx';
import { InlineSectionError } from './ErrorState.jsx';
import { EmptyState } from './EmptyState.jsx';

/**
 * تحديد لون شارة حالة الدفع
 */
const getPaymentBadgeClass = (status) => {
  switch (status) {
    case 'مدفوعة':
      return 'badge-status badge-status--paid';
    case 'مدفوعة جزئيًا':
      return 'badge-status badge-status--partial';
    case 'غير مدفوعة':
      return 'badge-status badge-status--unpaid';
    case 'متأخرة':
      return 'badge-status badge-status--overdue';
    default:
      return 'badge-status badge-status--default';
  }
};

/**
 * مكوّن آخر الفواتير والمدفوعات (RecentInvoices)
 * يدعم حالة التحميل بـ Skeleton، وحالة الخطأ الجزئي مع زر إعادة المحاولة
 */
export function RecentInvoices({
  invoices = [],
  isLoading = false,
  hasError = false,
  onRetry,
  onViewDetails,
  onViewAll,
}) {
  if (isLoading) {
    return <TablePanelSkeleton title="آخر الفواتير والمدفوعات" rowsCount={5} />;
  }

  return (
    <section className="dashboard-panel" aria-labelledby="recent-invoices-title">
      <div className="dashboard-panel__header">
        <div>
          <h2 id="recent-invoices-title" className="dashboard-panel__title">
            آخر الفواتير والمدفوعات
          </h2>
          <span className="dashboard-panel__subtitle">
            سجل أحدث المعاملات المالية وقيمة المبالغ المحصلة
          </span>
        </div>

        <button
          type="button"
          onClick={onViewAll}
          className="panel-link-btn"
          aria-label="عرض جميع الفواتير"
        >
          <span>عرض جميع الفواتير</span>
          <ArrowLeftIcon size={15} />
        </button>
      </div>

      {hasError ? (
        <InlineSectionError
          message="تعذر تحميل الفواتير. حاول مرة أخرى."
          onRetry={onRetry}
        />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={<CreditCardIcon size={32} />}
          message="لا توجد فواتير مسجلة حتى الآن."
        />
      ) : (
        <>
          {/* عرض الجدول المكتبي (Desktop / Tablet view) */}
          <div className="table-responsive-desktop">
            <table className="custom-data-table" dir="rtl">
              <thead>
                <tr>
                  <th scope="col">رقم الفاتورة</th>
                  <th scope="col">اسم المريض</th>
                  <th scope="col">التاريخ</th>
                  <th scope="col">المبلغ الإجمالي</th>
                  <th scope="col">المدفوع</th>
                  <th scope="col">حالة الدفع</th>
                  <th scope="col" className="text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="data-table-row">
                    <td>
                      <span className="invoice-code-tag font-numeric" dir="ltr">
                        {inv.invoiceNumber}
                      </span>
                    </td>
                    <td className="font-semibold text-main">
                      {inv.patientName}
                    </td>
                    <td className="text-muted font-numeric">{inv.issueDate}</td>
                    <td className="font-semibold text-main font-numeric">
                      {formatEGP(inv.totalAmount)}
                    </td>
                    <td className="font-numeric text-emerald font-semibold">
                      {formatEGP(inv.paidAmount)}
                    </td>
                    <td>
                      <span className={getPaymentBadgeClass(inv.paymentStatus)}>
                        {inv.paymentStatus}
                      </span>
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        onClick={() => onViewDetails(inv)}
                        className="btn-action-view"
                        title={`عرض تفاصيل فاتورة ${inv.patientName}`}
                        aria-label={`عرض تفاصيل فاتورة ${inv.patientName}`}
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

          {/* عرض البطاقات على شاشات الموبايل (Mobile Cards View) */}
          <div className="mobile-cards-list" role="list">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="mobile-record-card"
                role="listitem"
              >
                <div className="mobile-record-card__header">
                  <div>
                    <div className="mobile-invoice-top">
                      <span className="invoice-code-tag font-numeric" dir="ltr">
                        {inv.invoiceNumber}
                      </span>
                      <span className="text-muted font-numeric text-xs">
                        {inv.issueDate}
                      </span>
                    </div>
                    <h3 className="mobile-record-card__title mt-1">
                      {inv.patientName}
                    </h3>
                  </div>
                  <span className={getPaymentBadgeClass(inv.paymentStatus)}>
                    {inv.paymentStatus}
                  </span>
                </div>

                <div className="mobile-amounts-grid">
                  <div className="mobile-amount-col">
                    <span className="text-xs text-muted">المبلغ الإجمالي</span>
                    <span className="font-semibold font-numeric">
                      {formatEGP(inv.totalAmount)}
                    </span>
                  </div>
                  <div className="mobile-amount-col">
                    <span className="text-xs text-muted">المدفوع</span>
                    <span className="font-semibold text-emerald font-numeric">
                      {formatEGP(inv.paidAmount)}
                    </span>
                  </div>
                </div>

                <div className="mobile-record-card__footer pt-2 border-top-light">
                  <button
                    type="button"
                    onClick={() => onViewDetails(inv)}
                    className="btn-action-view btn-action-view--mobile w-full"
                    aria-label={`عرض تفاصيل فاتورة ${inv.patientName}`}
                  >
                    <EyeIcon size={15} />
                    <span>عرض تفاصيل الفاتورة</span>
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

export default RecentInvoices;
