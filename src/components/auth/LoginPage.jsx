import React, { useState } from 'react';
import { signInWithEmailPassword, quickLoginAsRole } from '../../services/authService';

/**
 * صفحة تسجيل الدخول الموحدة (LoginPage)
 * تتيح الدخول بالبريد الإلكتروني وكلمة المرور عبر Supabase Auth
 * وتوفر إمكانية النقر على «طبيب 🩺» أو «سكرتيرة 👩‍💼» للدخول والتوجيه التلقائي الفوري
 */
export function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
      return;
    }

    try {
      setIsSubmitting(true);
      const authResult = await signInWithEmailPassword(email, password);
      if (onLoginSuccess) {
        onLoginSuccess(authResult);
      }
    } catch (err) {
      setErrorMessage(err.message || 'تعذر تسجيل الدخول، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // الدخول والتوجيه التلقائي الفوري عند النقر على طبيب أو سكرتيرة
  const handleQuickLogin = async (role) => {
    setErrorMessage('');
    const demoEmail = role === 'doctor' ? 'doctor@clinic.com' : 'secretary@clinic.com';
    const demoPassword = role === 'doctor' ? 'Doctor@Pass2026' : 'Secretary@Pass2026';

    setEmail(demoEmail);
    setPassword(demoPassword);
    setIsSubmitting(true);

    try {
      const authResult = await quickLoginAsRole(role);
      if (onLoginSuccess) {
        onLoginSuccess(authResult);
      }
    } catch (err) {
      setErrorMessage(err.message || 'تعذر تسجيل الدخول والتوجيه التلقائي.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page-container" dir="rtl">
      <div className="login-card">
        {/* ترويسة بطاقة تسجيل الدخول */}
        <div className="login-card-header">
          <div className="login-brand-icon" aria-hidden="true">
            🏥
          </div>
          <h1 className="login-title">عيادة الرعاية الطبية التخصصية</h1>
          <p className="login-subtitle">نظام إدارة العيادة • بوابة تسجيل الدخول الموحدة</p>
        </div>

        {/* تنبيه الخطأ إن وجد */}
        {errorMessage && (
          <div className="login-error-alert" role="alert" aria-live="assertive">
            <span className="login-error-icon" aria-hidden="true">⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* نموذج تسجيل الدخول */}
        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="login-field-group">
            <label htmlFor="login-email" className="login-label">
              البريد الإلكتروني
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@clinic.com"
              required
              disabled={isSubmitting}
              className="login-input"
              dir="ltr"
              autoComplete="email"
            />
          </div>

          <div className="login-field-group">
            <label htmlFor="login-password" className="login-label">
              كلمة المرور
            </label>
            <div className="login-password-wrap">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={isSubmitting}
                className="login-input login-input--password"
                dir="ltr"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="btn-toggle-password"
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                tabIndex={-1}
              >
                {showPassword ? '👁️‍🗨️' : '👁️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-login-submit"
          >
            {isSubmitting ? (
              <span className="login-submitting-state">
                <span className="login-spinner" aria-hidden="true" />
                <span>جاري التحقق والتوجيه التلقائي...</span>
              </span>
            ) : (
              <span>تسجيل الدخول ←</span>
            )}
          </button>
        </form>

        {/* إرشادات الأدوار والتوجيه مع إمكانية النقر المباشر للدخول والتوجيه */}
        <div className="login-roles-guide">
          <div className="login-roles-title">
            <span>الأدوار المصرح بها والتوجيه التلقائي:</span>
            <span className="login-roles-hint">انقر على أي دور للدخول والتوجيه الفوري</span>
          </div>
          <div className="login-roles-grid">
            <button
              type="button"
              className="login-role-card login-role-card--clickable"
              onClick={() => handleQuickLogin('doctor')}
              disabled={isSubmitting}
              title="انقر هنا لتسجيل الدخول التلقائي كطبيب والتوجيه الفوري إلى واجهة الطبيب 🩺"
              aria-label="تسجيل الدخول والتوجيه التلقائي كطبيب"
            >
              <div className="login-role-card-header">
                <span className="login-role-badge login-role-badge--doctor">طبيب 🩺</span>
                <span className="login-role-action-pill">دخول وتوجيه تلقائي ←</span>
              </div>
              <p className="login-role-desc">
                التوجيه التلقائي المباشر إلى واجهة الطبيب اليومية لمتابعة قائمة الانتظار، الكشوف، والروشتات.
              </p>
            </button>

            <button
              type="button"
              className="login-role-card login-role-card--clickable"
              onClick={() => handleQuickLogin('secretary')}
              disabled={isSubmitting}
              title="انقر هنا لتسجيل الدخول التلقائي كسكرتيرة والتوجيه الفوري إلى مكتب السكرتارية 👩‍💼"
              aria-label="تسجيل الدخول والتوجيه التلقائي كسكرتيرة"
            >
              <div className="login-role-card-header">
                <span className="login-role-badge login-role-badge--secretary">سكرتيرة 👩‍💼</span>
                <span className="login-role-action-pill">دخول وتوجيه تلقائي ←</span>
              </div>
              <p className="login-role-desc">
                التوجيه التلقائي المباشر إلى مكتب السكرتارية لإدارة الحجوزات، تسجيل الحضور، والملفات والفواتير.
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
