import React from 'react';

/**
 * هيكل تحميل بطاقات الإحصائيات الأربع (StatCardsSkeleton)
 * يطابق تماماً أبعاد وتجاوب بطاقات الإحصائيات الحقيقية (Desktop 4, Tablet 2, Mobile 1)
 */
export function StatCardsSkeleton() {
  return (
    <div className="stats-cards-grid" aria-busy="true" aria-label="جاري تحميل الإحصائيات...">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="metric-card skeleton-metric-card">
          <div className="metric-card__header">
            <div className="skeleton-bar skeleton-bar--title" />
            <div className="skeleton-circle" />
          </div>
          <div className="metric-card__body">
            <div className="skeleton-bar skeleton-bar--value" />
            <div className="skeleton-bar skeleton-bar--subtitle" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * هيكل تحميل الجداول (TablePanelSkeleton)
 * يطابق تماماً تصميم لوحة المواعيد والفواتير
 */
export function TablePanelSkeleton({ title = 'جاري التحميل...', rowsCount = 5 }) {
  return (
    <section className="dashboard-panel skeleton-dashboard-panel" aria-busy="true">
      <div className="dashboard-panel__header">
        <div>
          <div className="skeleton-bar skeleton-bar--panel-title" />
          <div className="skeleton-bar skeleton-bar--panel-subtitle" />
        </div>
        <div className="skeleton-bar skeleton-bar--link" />
      </div>

      <div className="table-responsive-desktop">
        <table className="custom-data-table" dir="rtl">
          <thead>
            <tr>
              <th scope="col"><div className="skeleton-bar skeleton-bar--th" /></th>
              <th scope="col"><div className="skeleton-bar skeleton-bar--th" /></th>
              <th scope="col"><div className="skeleton-bar skeleton-bar--th" /></th>
              <th scope="col"><div className="skeleton-bar skeleton-bar--th" /></th>
              <th scope="col"><div className="skeleton-bar skeleton-bar--th" /></th>
              <th scope="col" className="text-center"><div className="skeleton-bar skeleton-bar--th m-auto" /></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowsCount }).map((_, idx) => (
              <tr key={idx} className="data-table-row">
                <td>
                  <div className="patient-name-cell">
                    <span className="patient-avatar-dot skeleton-avatar-dot" />
                    <div className="skeleton-bar skeleton-bar--cell-name" />
                  </div>
                </td>
                <td><div className="skeleton-bar skeleton-bar--cell-sm" /></td>
                <td><div className="skeleton-bar skeleton-bar--cell-sm" /></td>
                <td><div className="skeleton-bar skeleton-bar--pill" /></td>
                <td><div className="skeleton-bar skeleton-bar--pill" /></td>
                <td className="text-center"><div className="skeleton-bar skeleton-bar--btn m-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* هيكل كروت الموبايل */}
      <div className="mobile-cards-list">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="mobile-record-card skeleton-mobile-card">
            <div className="skeleton-bar skeleton-bar--mobile-title" />
            <div className="skeleton-bar skeleton-bar--mobile-meta" />
            <div className="skeleton-bar skeleton-bar--mobile-btn" />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * مكوّن هيكل التحميل الكامل للصفحة (DashboardSkeleton)
 */
export function DashboardSkeleton() {
  return (
    <div className="dashboard-wrapper" aria-busy="true" aria-label="جاري تحميل لوحة التحكم...">
      {/* هيكل ترويسة الصفحة */}
      <header className="dashboard-top-bar skeleton-top-bar">
        <div className="dashboard-top-bar__intro">
          <div className="skeleton-bar skeleton-bar--heading" />
          <div className="skeleton-bar skeleton-bar--sub" />
          <div className="skeleton-bar skeleton-bar--date" />
        </div>
        <div className="dashboard-actions-group">
          <div className="skeleton-bar skeleton-bar--btn-action" />
          <div className="skeleton-bar skeleton-bar--btn-action" />
        </div>
      </header>

      {/* هيكل بطاقات الإحصائيات */}
      <section className="dashboard-stats-section">
        <StatCardsSkeleton />
      </section>

      {/* هيكل جداول المواعيد والفواتير */}
      <div className="dashboard-content-grid">
        <TablePanelSkeleton title="آخر المواعيد" rowsCount={5} />
        <TablePanelSkeleton title="آخر الفواتير والمدفوعات" rowsCount={5} />
      </div>
    </div>
  );
}

export default DashboardSkeleton;
