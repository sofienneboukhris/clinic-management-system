import React from 'react';
import { CalendarIcon, PlusIcon } from './Icons.jsx';

/**
 * مكوّن حالة عدم وجود بيانات (EmptyState)
 * يظهر عندما تكون الجداول أو السجلات فارغة، مع زر تفاعلي لإضافة عنصر جديد
 */
export function EmptyState({
  icon = <CalendarIcon size={32} />,
  message,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) {
  const headingText = message || title || 'لا توجد بيانات مسجلة حالياً.';

  return (
    <div className={`state-feedback-card state-feedback-card--empty ${className}`}>
      {icon && (
        <div className="state-feedback-icon state-feedback-icon--empty">
          {icon}
        </div>
      )}
      <h3 className="state-feedback-title">{headingText}</h3>
      {description && <p className="state-feedback-message">{description}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="btn-action-primary"
          aria-label={actionLabel}
        >
          <PlusIcon size={16} />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
}

export default EmptyState;
