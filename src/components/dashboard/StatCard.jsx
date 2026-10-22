import React from 'react';
import {
  CalendarIcon,
  UsersIcon,
  CreditCardIcon,
  AlertCircleIcon,
} from './Icons.jsx';

/**
 * مكوّن بطاقة الإحصائيات الرئيسية (StatCard)
 * يعرض الرقم الرئيسي بحجم كبير وواضح مع الأيقونة المعبرة والوصف الهادئ
 */
export function StatCard({
  title,
  value,
  unit,
  subtitle,
  colorScheme = 'blue',
  iconName = 'calendar',
}) {
  // اختيار الأيقونة المناسبة
  const renderIcon = () => {
    switch (iconName) {
      case 'calendar':
        return <CalendarIcon size={22} />;
      case 'users':
        return <UsersIcon size={22} />;
      case 'credit-card':
        return <CreditCardIcon size={22} />;
      case 'alert-circle':
        return <AlertCircleIcon size={22} />;
      default:
        return <CalendarIcon size={22} />;
    }
  };

  return (
    <div className={`metric-card metric-card--${colorScheme}`}>
      <div className="metric-card__header">
        <span className="metric-card__title">{title}</span>
        <div className={`metric-card__icon-wrap metric-card__icon-wrap--${colorScheme}`}>
          {renderIcon()}
        </div>
      </div>

      <div className="metric-card__body">
        <div className="metric-card__value-row">
          <span className="metric-card__value">{value}</span>
          {unit && <span className="metric-card__unit">{unit}</span>}
        </div>
        {subtitle && <p className="metric-card__subtitle">{subtitle}</p>}
      </div>
    </div>
  );
}

export default StatCard;
