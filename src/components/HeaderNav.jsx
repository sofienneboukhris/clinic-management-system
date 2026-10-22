import { useState } from 'react'

// ============================================================================
// مكوّن الترويسة وقائمة التنقل (HeaderNav)
// يعرض عنوان النظام وقائمة الأقسام الأربعة، ويتجاوب مع الديسكتوب والموبايل
// ============================================================================
function HeaderNav({
  clinicInfo,
  sections,
  activeSection,
  onSelectSection,
  currentUser = null,
  userRole = null,
  userProfile = null,
  onLogout,
}) {
  // حالة فتح/إغلاق القائمة في شاشات الموبايل الصغيرة
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleNavClick = (sectionId) => {
    onSelectSection(sectionId)
    setIsMobileMenuOpen(false) // إغلاق قائمة الموبايل تلقائياً بعد الاختيار
  }

  // تحديد اسم المستخدم المعروض
  const displayName = userProfile?.full_name || currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || 'مستخدم مسجل';
  const roleLabel = userRole === 'doctor' ? 'طبيب 🩺' : userRole === 'secretary' ? 'سكرتيرة 👩‍💼' : 'مستخدم';
  const roleBadgeClass = userRole === 'doctor' ? 'user-role-badge--doctor' : 'user-role-badge--secretary';

  return (
    <header className="site-header">
      <div className="container header-inner">
        {/* القسم الأيمن: شعار وعنوان النظام */}
        <div className="brand-area">
          <div className="brand-icon" aria-hidden="true">🏥</div>
          <div>
            <div className="brand-title-row">
              <h1 className="brand-title">{clinicInfo.title}</h1>
              <span className="version-badge">{clinicInfo.version}</span>
            </div>
            <p className="brand-subtitle">{clinicInfo.subtitle}</p>
          </div>
        </div>

        {/* زر القائمة لشاشات الموبايل */}
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="فتح أو إغلاق قائمة التنقل"
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? '✕ إغلاق' : '☰ الأقسام'}
        </button>

        {/* قائمة التنقل للأقسام المعتمدة بحسب دور المستخدم */}
        <nav
          className={`main-nav ${isMobileMenuOpen ? 'nav-open' : ''}`}
          aria-label="التنقل الرئيسي"
        >
          <ul className="nav-list">
            {sections.map((section) => {
              const isActive = activeSection === section.id
              return (
                <li key={section.id} className="nav-item">
                  <button
                    type="button"
                    className={`nav-link ${isActive ? 'active' : ''}`}
                    onClick={() => handleNavClick(section.id)}
                  >
                    <span className="nav-icon" aria-hidden="true">{section.icon}</span>
                    <span>{section.label}</span>
                  </button>
                </li>
              )
            })}

            {/* زر واجهة الطبيب اليومية (مفعل للطبيب أو في الوضع العام) */}
            {(!userRole || userRole === 'doctor') && (
              <li className="nav-item">
                <button
                  type="button"
                  className={`nav-link role-switch-link ${activeSection === 'doctor' ? 'active-doctor' : ''}`}
                  onClick={() => handleNavClick('doctor')}
                  title="فتح واجهة الطبيب اليومية ومتابعة الكشوف والروشتات"
                >
                  <span className="nav-icon" aria-hidden="true">🩺</span>
                  <span>واجهة الطبيب</span>
                </button>
              </li>
            )}

            {/* زر واجهة مكتب السكرتيرة (مفعل للسكرتيرة أو في الوضع العام) */}
            {(!userRole || userRole === 'secretary') && (
              <li className="nav-item">
                <button
                  type="button"
                  className={`nav-link role-switch-link ${activeSection === 'secretary' ? 'active-secretary' : ''}`}
                  onClick={() => handleNavClick('secretary')}
                  title="فتح واجهة مكتب السكرتارية والاستقبال والمواعيد"
                >
                  <span className="nav-icon" aria-hidden="true">👩‍💼</span>
                  <span>واجهة السكرتيرة</span>
                </button>
              </li>
            )}
          </ul>
        </nav>

        {/* صندوق هوية المستخدم المسجل وزر تسجيل الخروج */}
        {currentUser && (
          <div className="header-user-area">
            <div className="header-user-info" title={currentUser.email || ''}>
              <span className="header-user-name">{displayName}</span>
              <button
                type="button"
                onClick={() => handleNavClick(userRole === 'doctor' ? 'doctor' : 'secretary')}
                className={`header-role-badge header-role-badge--clickable ${roleBadgeClass}`}
                title={`انقر هنا للتوجيه التلقائي المباشر إلى ${userRole === 'doctor' ? 'واجهة الطبيب 🩺' : 'مكتب السكرتارية 👩‍💼'}`}
                aria-label={`التوجيه التلقائي إلى ${userRole === 'doctor' ? 'واجهة الطبيب' : 'مكتب السكرتارية'}`}
              >
                {roleLabel}
              </button>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="btn-header-logout"
              title="تسجيل الخروج والعودة لشاشة الدخول"
            >
              <span>خروج 🚪</span>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

export default HeaderNav
