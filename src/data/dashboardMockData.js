// ============================================================================
// ملف البيانات التجريبية لصفحة لوحة التحكم (Dashboard Mock Data)
// فصل البيانات بالكامل عن واجهات العرض لسهولة التطوير والربط اللاحق
// ============================================================================

/**
 * دالة مساعدة لتنسيق المبالغ المالية بالجنيه المصري
 * @param {number} amount
 * @returns {string}
 */
export const formatEGP = (amount) => {
  return `${new Intl.NumberFormat('ar-EG').format(amount)} ج.م`;
};

/**
 * دالة مساعدة للحصول على تاريخ اليوم منسقاً باللغة العربية
 * @returns {string} مثال: "الأحد، 11 أكتوبر 2026"
 */
export const getArabicCurrentDate = () => {
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  return new Intl.DateTimeFormat('ar-EG', options).format(new Date());
};

// 1. بطاقات الإحصائيات الأربع الرئيسية
export const dashboardStats = [
  {
    id: 'stat-today-appointments',
    title: 'مواعيد اليوم',
    value: '18',
    unit: 'حجزاً',
    subtitle: '11 مؤكدة • 4 في الانتظار • 3 مكتملة',
    colorScheme: 'blue',
    iconName: 'calendar',
  },
  {
    id: 'stat-total-patients',
    title: 'إجمالي المرضى',
    value: '1,248',
    unit: 'مريضاً',
    subtitle: 'زيادة 24 مريضاً مسجلاً هذا الشهر',
    colorScheme: 'indigo',
    iconName: 'users',
  },
  {
    id: 'stat-total-payments',
    title: 'إجمالي المدفوعات',
    value: '14,850 ج.م',
    unit: '',
    subtitle: 'المبالغ المحصلة اليوم عبر 11 معاملة',
    colorScheme: 'emerald',
    iconName: 'credit-card',
  },
  {
    id: 'stat-follow-ups',
    title: 'تحتاج إلى متابعة',
    value: '6',
    unit: 'حالات',
    subtitle: '4 نتائج تحاليل • 2 إعادة كشف مجدولة',
    colorScheme: 'amber',
    iconName: 'alert-circle',
  },
];

// 2. أحدث المواعيد (6 مواعيد واقعية مع بيانات عربية متكاملة)
export const recentAppointments = [
  {
    id: 'apt-01',
    patientName: 'أحمد محمد',
    phone: '01012345678',
    time: '09:30 ص',
    date: '2026-10-11',
    visitType: 'كشف جديد',
    status: 'مكتمل',
    doctorNotes: 'كشف عام باطنة، تم طلب تحاليل دم وصرف العلاج الأولي.',
  },
  {
    id: 'apt-02',
    patientName: 'سارة علي',
    phone: '01123456789',
    time: '10:15 ص',
    date: '2026-10-11',
    visitType: 'متابعة',
    status: 'في الانتظار',
    doctorNotes: 'متابعة قياس ضغط الدم والسكر في عيادة الباطنة.',
  },
  {
    id: 'apt-03',
    patientName: 'محمود حسن',
    phone: '01234567890',
    time: '11:00 ص',
    date: '2026-10-11',
    visitType: 'استشارة',
    status: 'يحتاج إلى متابعة',
    doctorNotes: 'عرض نتائج الأشعة المقطعية ومراجعة الخطة العلاجية.',
  },
  {
    id: 'apt-04',
    patientName: 'منى إبراهيم',
    phone: '01543210987',
    time: '11:45 ص',
    date: '2026-10-11',
    visitType: 'إعادة كشف',
    status: 'مؤكد',
    doctorNotes: 'فحص دوري بعد أسبوعين من انتهاء كورس المضاد الحيوي.',
  },
  {
    id: 'apt-05',
    patientName: 'خالد عبد الرحمن',
    phone: '01098765432',
    time: '12:30 م',
    date: '2026-10-11',
    visitType: 'كشف جديد',
    status: 'مؤكد',
    doctorNotes: 'شكوى من آلام متفرقة في المفاصل والظهر.',
  },
  {
    id: 'apt-06',
    patientName: 'نور الدين مصطفى',
    phone: '01187654321',
    time: '01:15 م',
    date: '2026-10-11',
    visitType: 'متابعة',
    status: 'ملغي',
    doctorNotes: 'اعتذر المريض عن الحضور وتمت جدولة موعد بديل غداً.',
  },
];

// 3. أحدث الفواتير والمدفوعات (5 فواتير واقعية)
export const recentInvoices = [
  {
    id: 'inv-01',
    invoiceNumber: '#INV-2026-089',
    patientName: 'أحمد محمد',
    issueDate: '2026-10-11',
    visitType: 'كشف جديد',
    totalAmount: 450,
    paidAmount: 450,
    paymentStatus: 'مدفوعة',
  },
  {
    id: 'inv-02',
    invoiceNumber: '#INV-2026-088',
    patientName: 'سارة علي',
    issueDate: '2026-10-11',
    visitType: 'متابعة',
    totalAmount: 300,
    paidAmount: 150,
    paymentStatus: 'مدفوعة جزئيًا',
  },
  {
    id: 'inv-03',
    invoiceNumber: '#INV-2026-087',
    patientName: 'محمود حسن',
    issueDate: '2026-10-11',
    visitType: 'استشارة',
    totalAmount: 600,
    paidAmount: 0,
    paymentStatus: 'غير مدفوعة',
  },
  {
    id: 'inv-04',
    invoiceNumber: '#INV-2026-086',
    patientName: 'منى إبراهيم',
    issueDate: '2026-10-10',
    visitType: 'إعادة كشف',
    totalAmount: 250,
    paidAmount: 250,
    paymentStatus: 'مدفوعة',
  },
  {
    id: 'inv-05',
    invoiceNumber: '#INV-2026-085',
    patientName: 'فاطمة الزهراء',
    issueDate: '2026-10-09',
    visitType: 'كشف جديد',
    totalAmount: 850,
    paidAmount: 0,
    paymentStatus: 'متأخرة',
  },
];
