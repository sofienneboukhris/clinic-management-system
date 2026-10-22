import React from 'react';

/**
 * صفحة «غير مصرح بالوصول» (UnauthorizedPage - 403)
 * تعرض تنبيهاً أمنياً عربياً راقياً عند محاولة فتح رابط أو إجراء غير مسموح للدور الحالي
 * دون كشف أي تفاصيل عن بنية قاعدة البيانات الداخلية
 */
export function UnauthorizedPage({
  message = 'ليس لديك الصلاحيات الكافية للوصول إلى هذا القسم أو تنفيذ هذا الإجراء.',
  currentRole = null,
  returnPath = null,
  returnLabel = null,
  onReturn = null,
}) {
  const isDoctor = currentRole === 'doctor';
  const defaultReturnPath = isDoctor ? '#/doctor' : '#/secretary';
  const defaultReturnLabel = isDoctor
    ? 'العودة إلى واجهة عمل الطبيب ←'
    : 'العودة إلى مكتب السكرتارية ←';

  const finalPath = returnPath || defaultReturnPath;
  const finalLabel = returnLabel || defaultReturnLabel;

  const handleReturn = () => {
    if (onReturn) {
      onReturn();
    } else {
      window.location.hash = finalPath;
    }
  };

  return (
    <div className="unauthorized-page-container" dir="rtl">
      <div className="unauthorized-card" role="alert" aria-live="polite">
        <div className="unauthorized-icon-badge" aria-hidden="true">
          🛡️
        </div>

        <span className="unauthorized-status-pill">
          خطأ 403 • محاولة وصول مقيدة
        </span>

        <h1 className="unauthorized-title">
          غير مصرح لك بالوصول إلى هذه الشاشة
        </h1>

        <p className="unauthorized-description">
          {message}
        </p>

        <div className="unauthorized-role-banner">
          <span className="unauthorized-current-role-label">دورك الحالي:</span>
          <span className={`header-role-badge ${isDoctor ? 'user-role-badge--doctor' : 'user-role-badge--secretary'}`}>
            {isDoctor ? 'طبيب معالج 🩺' : 'سكرتارية واستقبال 👩‍💼'}
          </span>
        </div>

        <div className="unauthorized-actions">
          <button
            type="button"
            onClick={handleReturn}
            className="btn-unauthorized-return"
          >
            <span>{finalLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default UnauthorizedPage;
