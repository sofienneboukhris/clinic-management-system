import { useState, useEffect } from 'react'
import HeaderNav from './components/HeaderNav.jsx'
import LoginPage from './components/auth/LoginPage.jsx'
import UnauthorizedPage from './components/auth/UnauthorizedPage.jsx'
import DashboardView from './components/dashboard/DashboardView.jsx'
import SecretaryView from './components/secretary/SecretaryView.jsx'
import DoctorDailyView from './components/doctor/DoctorDailyView.jsx'
import AddPatientPage from './components/patients/AddPatientPage.jsx'
import PatientsView from './components/patients/PatientsView.jsx'
import PatientProfilePage from './components/patients/PatientProfilePage.jsx'
import { SectionDemoCard } from './components/DemoCard.jsx'
import {
  clinicInfo,
  navSections,
  secretaryNavSections,
  doctorNavSections,
  demoSectionCards,
} from './data/mockData.js'
import {
  getActiveSession,
  signOutUser,
  subscribeToAuthState,
} from './services/authService.js'

// ============================================================================
// المكوّن الرئيسي للتطبيق (App)
// يجمع شريط التنقل العلوي، نظام المصادقة الموحد (Supabase Auth)،
// التوجيه بحسب الدور (doctor -> #/doctor و secretary -> #/secretary)،
// حماية المسارات (Route Guards) وشاشة غير مصرح (403)،
// واسترجاع الجلسة عند Refresh لمنع وميض الشاشة الخاطئة.
// ============================================================================
function App() {
  // حفظ القسم المختار حالياً في قائمة التنقل (الافتراضي: لوحة التحكم)
  const [activeSection, setActiveSection] = useState('dashboard')
  // معرف المريض المختار لعرض ملفه الطبي
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  // سبب رفض الصلاحية لعرضه في شاشة غير مصرح (UnauthorizedPage)
  const [unauthorizedReason, setUnauthorizedReason] = useState(null)

  // حالات المصادقة والجلسة النشطة
  const [currentUser, setCurrentUser] = useState(null)
  const [userRole, setUserRole] = useState(null) // 'doctor' | 'secretary'
  const [userProfile, setUserProfile] = useState(null)
  const [isAuthChecking, setIsAuthChecking] = useState(true)

  // 1. استرجاع الجلسة النشطة عند فتح الصفحة أو عمل Refresh والاشتراك بتغييرات Auth
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const sessionInfo = await getActiveSession();
        if (!isMounted) return;

        if (sessionInfo && sessionInfo.user) {
          setCurrentUser(sessionInfo.user);
          setUserRole(sessionInfo.role);
          setUserProfile(sessionInfo.profile);

          // توجيه تلقائي عند فتح التطبيق لأول مرة أو بعد Refresh إذا كان المسار عاماً أو فارغاً
          const currentHash = window.location.hash || '';
          if (!currentHash || currentHash === '#/' || currentHash === '#/login') {
            const defaultHash = sessionInfo.role === 'doctor' ? '#/doctor' : '#/secretary';
            window.location.hash = defaultHash;
          }
        } else {
          setCurrentUser(null);
          setUserRole(null);
          setUserProfile(null);
          if (window.location.hash !== '#/login') {
            window.location.hash = '#/login';
          }
        }
      } catch (err) {
        console.error('Error restoring session:', err);
      } finally {
        if (isMounted) {
          setIsAuthChecking(false);
        }
      }
    }

    initAuth();

    // الاستماع لأحداث تسجيل الدخول أو الخروج أو تحديث الجلسة
    const { data: authListener } = subscribeToAuthState(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT' || !session) {
        setCurrentUser(null);
        setUserRole(null);
        setUserProfile(null);
        window.location.hash = '#/login';
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        const sessionInfo = await getActiveSession();
        if (isMounted && sessionInfo?.user) {
          setCurrentUser(sessionInfo.user);
          setUserRole(sessionInfo.role);
          setUserProfile(sessionInfo.profile);
        }
      }
    });

    return () => {
      isMounted = false;
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  // 2. مزامنة حالة التطبيق مع مسار الرابط (Hash Routing) وتطبيق قواعد الأدوار
  useEffect(() => {
    if (isAuthChecking) return;

    function parseHash() {
      const hash = window.location.hash || '';

      // إذا لم يكن المستخدم مسجلاً بعد، فالمسار المتاح الوحيد هو تسجيل الدخول
      if (!currentUser) {
        setActiveSection('login');
        setSelectedPatientId(null);
        return;
      }

      // إذا كان المستخدم مسجلاً ودخل على صفحة تسجيل الدخول، نوجهه لواجهته بحسب دوره
      if (hash === '#/login' || hash === '#/' || !hash) {
        const targetSection = userRole === 'doctor' ? 'doctor' : 'secretary';
        setActiveSection(targetSection);
        setSelectedPatientId(null);
        if (window.location.hash !== `#/${targetSection}`) {
          window.location.hash = `#/${targetSection}`;
        }
        return;
      }

      // مسار صفحة غير مصرح
      if (hash === '#/unauthorized') {
        setActiveSection('unauthorized');
        setSelectedPatientId(null);
        return;
      }

      // كشف محاولة فتح رابط الكشف السريري مباشرة (مثل #/doctor/examination أو #/examination/...)
      const examMatch = hash.match(/^#\/(?:doctor\/)?examination(?:[\/?](.+))?$/i);
      if (examMatch) {
        if (userRole === 'secretary') {
          // السكرتيرة ممنوعة قطعياً من فتح شاشة الكشف أو تعديل الزيارات والروشتات
          setUnauthorizedReason('غير مصرح للسكرتارية بفتح شاشة الكشف السريري أو إنشاء وتعديل الزيارات والروشتات الطبية. هذه الصلاحية مقصورة على الطبيب المعالج فقط.');
          setActiveSection('unauthorized');
          return;
        }
        setActiveSection('doctor');
        setSelectedPatientId(null);
        return;
      }

      // مسار واجهة عمل الطبيب اليومية: #/doctor
      if (hash === '#/doctor') {
        if (userRole === 'secretary') {
          // السكرتيرة لا تدخل واجهة الطبيب، نعرض تنبيه غير مصرح مع إمكانية العودة لمكتبها
          setUnauthorizedReason('عذراً، واجهة عمل الطبيب اليومية وجدول الكشوفات السريرية مخصصة للأطباء فقط.');
          setActiveSection('unauthorized');
          return;
        }
        setActiveSection('doctor');
        setSelectedPatientId(null);
        return;
      }

      // مسار واجهة عمل السكرتيرة: #/secretary
      if (hash === '#/secretary') {
        if (userRole === 'doctor') {
          // الطبيب لا يدخل مكتب السكرتارية
          setUnauthorizedReason('غير مصرح للطبيب بالدخول إلى مكتب السكرتارية أو إدارة الحجوزات وإنشاء وتعديل الفواتير والمدفوعات.');
          setActiveSection('unauthorized');
          return;
        }
        setActiveSection('secretary');
        setSelectedPatientId(null);
        return;
      }

      // مسارات إدارة الفواتير والمدفوعات المستقلة
      if (hash === '#/invoices' || hash === '#/billing' || hash === '#/payments') {
        if (userRole === 'doctor') {
          setUnauthorizedReason('غير مصرح للطبيب بإنشاء أو تعديل الفواتير والمدفوعات المخصصة لمكتب السكرتارية (يُسمح فقط بقراءة حالة الفاتورة من جدول المواعيد).');
          setActiveSection('unauthorized');
          return;
        }
        setActiveSection('secretary');
        setSelectedPatientId(null);
        return;
      }

      // مطابقة مسار ملف المريض عبر المعرف: #/patients/:id
      const patientMatch = hash.match(/^#\/patients\/([a-zA-Z0-9_-]+)$/);
      if (patientMatch) {
        const id = patientMatch[1];
        if (id === 'new') {
          if (userRole === 'doctor') {
            // إضافة مريض جديد من مهام السكرتارية
            setUnauthorizedReason('تسجيل المرضى الجدد من اختصاص السكرتارية والاستقبال.');
            setActiveSection('unauthorized');
            return;
          }
          setActiveSection('new-patient');
          setSelectedPatientId(null);
        } else {
          setSelectedPatientId(id);
          setActiveSection('patient-profile');
        }
        return;
      }

      if (hash === '#/patients') {
        setActiveSection('patients');
        setSelectedPatientId(null);
        return;
      }

      if (hash === '#/dashboard') {
        setActiveSection('dashboard');
        setSelectedPatientId(null);
        return;
      }

      const cleanSection = hash.replace(/^#\//, '');
      if (cleanSection) {
        setActiveSection(cleanSection);
        setSelectedPatientId(null);
      }
    }

    parseHash();
    window.addEventListener('hashchange', parseHash);
    return () => window.removeEventListener('hashchange', parseHash);
  }, [currentUser, userRole, isAuthChecking]);

  // دوال التنقل مع تحديث مسار الرابط في المتصفح
  const navigateToSection = (sectionId) => {
    setActiveSection(sectionId);
    setSelectedPatientId(null);
    window.location.hash = `#/${sectionId}`;
  };

  const navigateToPatientProfile = (patientId) => {
    setSelectedPatientId(patientId);
    setActiveSection('patient-profile');
    window.location.hash = `#/patients/${patientId}`;
  };

  const navigateToNewPatient = () => {
    setActiveSection('new-patient');
    window.location.hash = '#/patients/new';
  };

  const navigateToPatients = () => {
    setActiveSection('patients');
    setSelectedPatientId(null);
    window.location.hash = '#/patients';
  };

  const navigateToDashboard = () => {
    setActiveSection('dashboard');
    setSelectedPatientId(null);
    window.location.hash = '#/dashboard';
  };

  const navigateToSecretary = () => {
    setActiveSection('secretary');
    setSelectedPatientId(null);
    window.location.hash = '#/secretary';
  };

  const navigateToDoctor = () => {
    setActiveSection('doctor');
    setSelectedPatientId(null);
    window.location.hash = '#/doctor';
  };

  // معالجة تسجيل الدخول الناجح من شاشة Login والتوجيه التلقائي المباشر
  const handleLoginSuccess = ({ user, role, profile }) => {
    setCurrentUser(user);
    setUserRole(role);
    setUserProfile(profile);

    // توجيه تلقائي فوري بحسب الدور وضمان تحديث الواجهة فوراً
    const targetSection = role === 'doctor' ? 'doctor' : 'secretary';
    setActiveSection(targetSection);
    setSelectedPatientId(null);
    window.location.hash = `#/${targetSection}`;
  };

  // معالجة تسجيل الخروج الآمن
  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.error('Logout error:', err);
    }
    setCurrentUser(null);
    setUserRole(null);
    setUserProfile(null);
    setActiveSection('login');
    window.location.hash = '#/login';
  };

  // 1. حالة التحميل الأولية لاسترجاع الجلسة (Splash Screen) لمنع وميض الواجهة الخاطئة
  if (isAuthChecking) {
    return (
      <div className="auth-splash-container" dir="rtl">
        <div className="auth-splash-card">
          <div className="auth-splash-icon" aria-hidden="true">🏥</div>
          <h2 className="auth-splash-title">عيادة الشفاء التخصصية</h2>
          <div className="auth-splash-spinner" aria-hidden="true" />
          <p className="auth-splash-text">د. أحمد محمود (باطنة وجهاز هضمي) • جاري استرجاع جلسة العمل والتحقق من الصلاحيات...</p>
        </div>
      </div>
    );
  }

  // 2. إذا لم يكن المستخدم مسجلاً، نعرض شاشة تسجيل الدخول الموحدة
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // تحديد قائمة التنقل بحسب دور المستخدم الحالي
  const currentNavList =
    userRole === 'doctor'
      ? doctorNavSections
      : userRole === 'secretary'
      ? secretaryNavSections
      : navSections;

  // تحديد المعرف الأب للقسم في شريط التنقل العلوي
  const effectiveSectionId =
    activeSection === 'new-patient' || activeSection === 'patient-profile'
      ? 'patients'
      : activeSection

  // الحصول على بيانات القسم المختار حالياً
  const currentSectionInfo =
    currentNavList.find((sec) => sec.id === effectiveSectionId) || currentNavList[0]

  return (
    <div className="app-layout">
      {/* 1. الشريط العلوي وعنوان النظام وقائمة التنقل وهوية المستخدم وزر الخروج */}
      <HeaderNav
        clinicInfo={clinicInfo}
        sections={currentNavList}
        activeSection={effectiveSectionId}
        onSelectSection={navigateToSection}
        currentUser={currentUser}
        userRole={userRole}
        userProfile={userProfile}
        onLogout={handleLogout}
      />

      {/* 2. المحتوى الرئيسي */}
      <main className="container main-content">
        {activeSection === 'unauthorized' ? (
          /* عرض صفحة غير مصرح بالوصول (403) */
          <UnauthorizedPage
            message={unauthorizedReason || 'ليس لديك الصلاحيات الكافية للوصول إلى هذه الشاشة.'}
            currentRole={userRole}
            returnPath={userRole === 'doctor' ? '#/doctor' : '#/secretary'}
            returnLabel={userRole === 'doctor' ? 'العودة إلى واجهة عمل الطبيب ←' : 'العودة إلى مكتب السكرتارية ←'}
            onReturn={() => {
              const target = userRole === 'doctor' ? 'doctor' : 'secretary';
              setActiveSection(target);
              window.location.hash = `#/${target}`;
            }}
          />
        ) : activeSection === 'doctor' ? (
          /* عرض واجهة عمل الطبيب اليومية المتكاملة */
          <DoctorDailyView
            onViewPatient={navigateToPatientProfile}
            onNavigateSection={navigateToSection}
            userRole={userRole}
            currentUser={currentUser}
          />
        ) : activeSection === 'secretary' ? (
          /* عرض واجهة عمل السكرتيرة المتكاملة */
          <SecretaryView
            onNavigateSection={navigateToSection}
            onViewPatient={navigateToPatientProfile}
            onAddNewPatient={navigateToNewPatient}
            userRole={userRole}
            currentUser={currentUser}
          />
        ) : activeSection === 'dashboard' ? (
          /* عرض صفحة لوحة التحكم الاحترافية الكاملة */
          <DashboardView onNavigateSection={navigateToSection} />
        ) : activeSection === 'new-patient' ? (
          /* عرض صفحة إضافة مريض جديد */
          <AddPatientPage
            onCancel={navigateToPatients}
            onSaveSuccess={(newPatientId) => {
              navigateToPatientProfile(newPatientId);
            }}
          />
        ) : activeSection === 'patient-profile' ? (
          /* عرض صفحة ملف المريض باستخدام المعرف العائد من قاعدة البيانات */
          <PatientProfilePage
            patientId={selectedPatientId}
            onBackToPatients={navigateToPatients}
            onAddNewPatient={navigateToNewPatient}
            onBackToDashboard={navigateToDashboard}
          />
        ) : activeSection === 'patients' ? (
          /* عرض صفحة إدارة المرضى المتضمنة زر إضافة مريض جديد وعرض السجلات الحقيقية */
          <PatientsView
            onAddNewPatient={navigateToNewPatient}
            onViewPatient={navigateToPatientProfile}
            onBackToDashboard={navigateToDashboard}
          />
        ) : (
          /* عرض تفاصيل القسم المختار عند التنقل من القائمة */
          <div className="section-block">
            <section className="welcome-banner" aria-label="ملخص القسم الحالي">
              <div className="banner-text">
                <span className="banner-label">
                  القسم النشط: {currentSectionInfo.icon} {currentSectionInfo.label}
                </span>
                <h2 className="banner-heading">{currentSectionInfo.label}</h2>
                <p className="banner-description">
                  {currentSectionInfo.description} (المستخدم المستهدف:{' '}
                  <strong>{currentSectionInfo.roleHint}</strong>).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection(userRole === 'doctor' ? 'doctor' : 'secretary')}
                className="btn-action-secondary"
                style={{ alignSelf: 'center', backgroundColor: '#ffffff', color: 'var(--primary, #0f2b48)', fontWeight: 800 }}
              >
                العودة إلى واجهة العمل الرئيسية ←
              </button>
            </section>

            <div className="section-header mt-1">
              <h2 className="section-title">
                معاينة قسم: {currentSectionInfo.label}
              </h2>
              <span className="section-subtitle">
                بطاقات الشرح التأسيسي الخاصة بهذا القسم
              </span>
            </div>

            <div className="demo-cards-grid">
              {demoSectionCards
                .filter(
                  (card) =>
                    card.sectionId === activeSection || card.sectionId === 'dashboard'
                )
                .map((card) => (
                  <SectionDemoCard
                    key={card.id}
                    card={card}
                    isHighlighted={card.sectionId === activeSection}
                  />
                ))}
            </div>
          </div>
        )}
      </main>

      {/* 3. تذييل الصفحة */}
      <footer className="site-footer">
        <div className="container footer-inner">
          <span>
            عيادة الشفاء التخصصية — د. أحمد محمود (باطنة وجهاز هضمي) • 2026
          </span>
          <span className="text-muted">
            جلسة العمل النشطة: {userRole === 'doctor' ? 'حساب الطبيب 🩺' : 'حساب السكرتيرة 👩‍💼'} — {currentUser.email}
          </span>
        </div>
      </footer>
    </div>
  )
}

export default App

