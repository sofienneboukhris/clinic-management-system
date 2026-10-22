import React from 'react';
import { AlertCircleIcon, RefreshCwIcon } from './Icons.jsx';

/**
 * مكوّن رسالة الخطأ الرئيسية للوحة التحكم (ErrorState)
 * يعرض رسالة عربية واضحة للمستخدم: "تعذر تحميل بيانات لوحة التحكم. حاول مرة أخرى."
 * مع زر "إعادة المحاولة" دون عرض تفاصيل تقنية معقدة
 */
export function ErrorState({
  title = 'تعذر تحميل بيانات لوحة التحكم. حاول مرة أخرى.',
  message,
  onRetry,
}) {
  return (
    <div className="state-feedback-card state-feedback-card--error" role="alert">
      <div className="state-feedback-icon state-feedback-icon--error">
        <AlertCircleIcon size={32} />
      </div>
      <h3 className="state-feedback-title">{title}</h3>
      {message && <p className="state-feedback-message">{message}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn-retry"
          aria-label="إعادة المحاولة"
        >
          <RefreshCwIcon size={16} />
          <span>إعادة المحاولة</span>
        </button>
      )}
    </div>
  );
}

/**
 * مكوّن الخطأ الجزئي للبطاقات أو الجداول عند تعثر جزء محدد دون انهيار الصفحة
 */
export function InlineSectionError({
  message = 'تعذر تحميل بيانات هذا القسم. حاول مرة أخرى.',
  onRetry,
}) {
  return (
    <div className="section-inline-error-box" role="alert">
      <div className="section-inline-error-text">
        <AlertCircleIcon size={18} className="text-danger" />
        <span>{message}</span>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn-retry btn-retry--sm"
          aria-label="إعادة المحاولة"
        >
          <RefreshCwIcon size={14} />
          <span>إعادة المحاولة</span>
        </button>
      )}
    </div>
  );
}

export default ErrorState;
