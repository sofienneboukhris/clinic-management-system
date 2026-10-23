import React, { useState, useEffect } from 'react';
import { fetchPatientsList } from '../../services/patientService.js';
import {
  UserPlusIcon,
  UsersIcon,
  EyeIcon,
  RefreshCwIcon,
  AlertCircleIcon,
} from '../dashboard/Icons.jsx';

/**
 * مكوّن صفحة المرضى الرئيسية (PatientsView)
 * يقرأ سجلات المرضى ديناميكياً من قاعدة بيانات Supabase ويعرض السجلات الحقيقية
 * متضمناً شريط بحث فوري وزر إضافة مريض جديد وزر عرض ملف المريض
 *
 * @param {Object} props
 * @param {Function} props.onAddNewPatient دالة الانتقال لصفحة إضافة مريض جديد
 * @param {Function} props.onViewPatient دالة الانتقال لصفحة ملف مريض محدد
 * @param {Function} props.onBackToDashboard دالة العودة للوحة التحكم
 */
export function PatientsView({ onAddNewPatient, onViewPatient, onBackToDashboard }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // جلب سجلات المرضى ديناميكياً من Supabase
  const loadPatients = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPatientsList();
      setPatients(data || []);
    } catch (err) {
      console.error('[Console Debug - تعذر جلب قائمة المرضى]:', err);
      setError('تعذر تحميل قائمة المرضى من قاعدة البيانات. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  // تصفية المرضى بناءً على نص البحث (الاسم أو رقم الهاتف)
  const filteredPatients = patients.filter((patient) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.trim().toLowerCase();
    const nameMatch = (patient.full_name || '').toLowerCase().includes(query);
    const phoneMatch = (patient.phone || '').includes(query);
    const idMatch = (patient.id || '').toLowerCase().includes(query);
    return nameMatch || phoneMatch || idMatch;
  });

  return (
    <div className="section-block" dir="rtl">
      {/* 1. ترويسة قسم المرضى مع زر إضافة مريض جديد وزر العودة */}
      <section className="welcome-banner" aria-label="ترويسة قسم المرضى">
        <div className="banner-text">
          <span className="banner-label">
            القسم النشط: 👥 المرضى
          </span>
          <h2 className="banner-heading">إدارة ملفات وسجلات المرضى</h2>
          <p className="banner-description">
            قائمة المرضى المسجلين ديناميكياً في قاعدة البيانات — متزامنة وفورية مع إمكانية البحث واستعراض الملف الطبي.
          </p>
        </div>

        <div className="banner-actions-wrap" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* زر إضافة مريض جديد المطلوب ربطه بالصفحة */}
          <button
            type="button"
            onClick={onAddNewPatient}
            className="btn-action-primary"
            style={{ backgroundColor: '#ffffff', color: 'var(--primary, #0f2b48)', fontWeight: 800, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
            aria-label="إضافة مريض جديد"
          >
            <UserPlusIcon size={18} />
            <span>إضافة مريض جديد</span>
          </button>

          {/* زر العودة إلى لوحة التحكم */}
          <button
            type="button"
            onClick={onBackToDashboard}
            className="btn-action-secondary"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.3)', fontWeight: 700 }}
          >
            العودة للوحة التحكم ←
          </button>
        </div>
      </section>

      {/* 2. شريط التحكم والبحث وإحصائية العدد الفعلي */}
      <div className="patients-control-bar">
        <div className="patients-control-text">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h3 className="section-title">سجل المرضى</h3>
            {!loading && (
              <span className="info-badge font-numeric">
                {patients.length} مريضاً مسجلاً
              </span>
            )}
          </div>
          <span className="section-subtitle">
            بيانات المرضى المحدثة من قاعدة البيانات
          </span>
        </div>

        <div className="patients-filter-group">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو رقم الهاتف..."
            className="field-input patients-search-input"
            aria-label="بحث في قائمة المرضى"
          />

          <button
            type="button"
            onClick={onAddNewPatient}
            className="btn-action-primary"
            aria-label="تسجيل مريض جديد"
          >
            <UserPlusIcon size={18} />
            <span>إضافة مريض جديد</span>
          </button>

          <button
            type="button"
            onClick={loadPatients}
            className="btn-action-secondary"
            title="تحديث القائمة"
            aria-label="تحديث قائمة المرضى"
          >
            <RefreshCwIcon size={16} />
          </button>
        </div>
      </div>

      {/* 3. تنبيه الخطأ في حال حدوثه */}
      {error && (
        <div className="patient-alert-danger" role="alert">
          <div className="alert-icon-wrap">
            <AlertCircleIcon size={20} />
          </div>
          <div className="alert-body">
            <strong className="alert-title">تنبيه اتصال:</strong>
            <p className="alert-description">{error}</p>
          </div>
          <button
            type="button"
            onClick={loadPatients}
            className="btn-action-secondary btn-sm"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* 4. جدول سجلات المرضى الحقيقي المتجاوب */}
      <div className="dashboard-panel">
        {loading ? (
          <div className="table-loading-skeleton" style={{ padding: '2rem 1rem', textAlign: 'center' }}>
            <p className="text-muted">جاري تحميل سجلات المرضى من قاعدة البيانات...</p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="panel-empty-notice" style={{ padding: '3rem 1rem' }}>
            <p style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.5rem' }}>
              {searchQuery ? 'لا توجد نتائج مطابقة لبحثك' : 'لا يوجد مرضى مسجلون في قاعدة البيانات حالياً'}
            </p>
            <p className="text-muted" style={{ marginBottom: '1.25rem' }}>
              {searchQuery
                ? 'جرب البحث باسم أو رقم هاتف آخر'
                : 'يمكنك البدء بإضافة أول مريض للعيادة بالضغط على الزر أدناه.'}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={onAddNewPatient}
                className="btn-action-primary"
              >
                <UserPlusIcon size={18} />
                <span>إضافة أول مريض</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* جدول الديسكتوب واللابتوب */}
            <div className="table-responsive-desktop">
              <table className="custom-data-table" aria-label="قائمة المرضى المسجلين">
                <thead>
                  <tr>
                    <th>اسم المريض</th>
                    <th>رقم الهاتف</th>
                    <th>رقم الملف</th>
                    <th>تاريخ التسجيل</th>
                    <th style={{ textAlign: 'center' }}>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map((patient) => (
                    <tr key={patient.id} className="data-table-row">
                      <td>
                        <div className="patient-name-cell">
                          <span className="patient-avatar-dot" />
                          <strong className="font-semibold">{patient.full_name}</strong>
                        </div>
                      </td>
                      <td>
                        <span className="font-numeric" dir="ltr">
                          {patient.phone || '—'}
                        </span>
                      </td>
                      <td>
                        <span className="invoice-code-tag font-numeric">
                          #{String(patient.id).slice(0, 8).toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className="font-numeric text-muted">
                          {patient.created_at ? String(patient.created_at).slice(0, 10) : '—'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => onViewPatient && onViewPatient(patient.id)}
                          className="btn-action-view"
                          aria-label={`فتح ملف المريض ${patient.full_name}`}
                        >
                          <EyeIcon size={15} />
                          <span>فتح الملف</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* بطاقات الموبايل المتجاوبة (مخفية على الديسكتوب وتظهر على الهواتف) */}
            <div className="mobile-cards-list">
              {filteredPatients.map((patient) => (
                <div key={patient.id} className="mobile-record-card">
                  <div className="mobile-record-card__header">
                    <div>
                      <div className="mobile-record-card__title">{patient.full_name}</div>
                      <div className="mobile-record-card__sub-row">
                        <span className="font-numeric" dir="ltr">{patient.phone || 'بدون هاتف'}</span>
                        <span className="text-separator">•</span>
                        <span className="font-numeric text-muted">#{String(patient.id).slice(0, 8).toUpperCase()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mobile-record-card__footer">
                    <span className="text-xs text-muted font-numeric">
                      التسجيل: {patient.created_at ? String(patient.created_at).slice(0, 10) : '—'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onViewPatient && onViewPatient(patient.id)}
                      className="btn-action-view btn-action-view--mobile"
                      aria-label={`فتح ملف المريض ${patient.full_name}`}
                    >
                      <EyeIcon size={15} />
                      <span>فتح الملف</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PatientsView;
