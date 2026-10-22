// ============================================================================
// نظام قاعدة البيانات المحلية المدمجة والمرنة (Resilient Local Database)
// يضمن استمرار عمل لوحة التحكم بشكل كامل وحفظ البيانات حتى في حال انقطاع
// الاتصال بخادم Supabase أو عدم توفر النطاق السحابي
// متطابق 100% مع بنية database.types.ts والعلاقات بين الجداول
// ============================================================================

const STORAGE_KEY = 'clinic_cms_database_v2';

/**
 * توليد تاريخ اليوم بالتوقيت المحلي مع وقت محدد
 * @param {number} hours
 * @param {number} minutes
 * @returns {string} ISO string
 */
function createTodayTimestamp(hours, minutes) {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

/**
 * توليد تاريخ سابق قبل عدد محدد من الأيام
 * @param {number} daysAgo
 * @returns {string} YYYY-MM-DD
 */
function createPastDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * البيانات التأسيسية المطابقة تماماً لهيكل قاعدة البيانات
 */
function getInitialDatabaseData() {
  const patients = [
    {
      id: 'pat-101',
      full_name: 'أحمد محمد علي',
      phone: '01012345678',
      date_of_birth: '1988-05-14',
      gender: 'ذكر',
      address: 'القاهرة، المعادي، شارع 9',
      blood_type: 'O+',
      chronic_diseases_allergies: 'حساسية شديدة من البنسلين ومشتقاته',
      notes: 'مريض منتظم في المتابعة، يفضل المواعيد الصباحية دائماً.',
      created_at: createPastDate(30),
    },
    {
      id: 'pat-102',
      full_name: 'سارة علي حسن',
      phone: '01123456789',
      date_of_birth: '1995-10-22',
      gender: 'أنثى',
      address: 'الجيزة، الدقي، شارع مصدق',
      blood_type: 'A+',
      chronic_diseases_allergies: 'ارتفاع ضغط الدم المزمن ومتابعة هرمونات الغدة',
      notes: 'تحتاج لقياس ضغط الدم قبل كل كشف، التزام ممتاز بالأدوية.',
      created_at: createPastDate(25),
    },
    {
      id: 'pat-103',
      full_name: 'محمود حسن إبراهيم',
      phone: '01234567890',
      date_of_birth: '1976-03-08',
      gender: 'ذكر',
      address: 'الإسكندرية، سموحة، عمارة الفيروز',
      blood_type: 'B+',
      chronic_diseases_allergies: 'داء السكري من النوع الثاني',
      notes: 'متابع بانتظام لمعدلات السكر التراكمي ووظائف الكلى.',
      created_at: createPastDate(20),
    },
    {
      id: 'pat-104',
      full_name: 'منى إبراهيم السيد',
      phone: '01543210987',
      date_of_birth: '2000-12-04',
      gender: 'أنثى',
      address: 'القاهرة، مدينة نصر، عباس العقاد',
      blood_type: 'AB-',
      chronic_diseases_allergies: null,
      notes: 'لا توجد شكاوى مزمنة، كشوفات دورية وفحوصات وقائية.',
      created_at: createPastDate(15),
    },
    {
      id: 'pat-105',
      full_name: 'خالد عبد الرحمن عمر',
      phone: '01098765432',
      date_of_birth: '1983-07-19',
      gender: 'ذكر',
      address: 'القاهرة، التجمع الخامس، الحي الثاني',
      blood_type: 'O-',
      chronic_diseases_allergies: 'حساسية من الأسبرين ومركبات السلفا',
      notes: 'يُنصح بعدم وصف أي مسكنات تحتوي على حمض أستيل ساليسيليك.',
      created_at: createPastDate(10),
    },
    { id: 'pat-106', full_name: 'نور الدين مصطفى', phone: '01187654321', date_of_birth: '1992-01-30', gender: 'ذكر', address: 'الجيزة، المهندسين', blood_type: 'A-', chronic_diseases_allergies: null, notes: null, created_at: createPastDate(8) },
    { id: 'pat-107', full_name: 'فاطمة الزهراء عثمان', phone: '01298765432', date_of_birth: '1989-11-15', gender: 'أنثى', address: 'القاهرة، حلوان', blood_type: 'B-', chronic_diseases_allergies: 'ربو شعبي تحسسي موسمي', notes: 'تستخدم بخاخ وقائي عند تغير الفصول.', created_at: createPastDate(6) },
    { id: 'pat-108', full_name: 'طارق محمود الشناوي', phone: '01023456781', date_of_birth: '1979-06-25', gender: 'ذكر', address: 'القاهرة، شبرا', blood_type: 'AB+', chronic_diseases_allergies: null, notes: null, created_at: createPastDate(5) },
    { id: 'pat-109', full_name: 'ياسمين كمال الشريف', phone: '01134567892', date_of_birth: '1998-04-18', gender: 'أنثى', address: 'القاهرة، الزمالك', blood_type: 'A+', chronic_diseases_allergies: 'حساسية لاكتوز معوية', notes: null, created_at: createPastDate(4) },
    { id: 'pat-110', full_name: 'كريم عبد الله زكي', phone: '01245678903', date_of_birth: '1985-08-11', gender: 'ذكر', address: 'الجيزة، فيصل', blood_type: 'O+', chronic_diseases_allergies: null, notes: null, created_at: createPastDate(4) },
    { id: 'pat-111', full_name: 'مريم يوسف النجار', phone: '01556789014', date_of_birth: '1994-09-03', gender: 'أنثى', address: 'القاهرة، عين شمس', blood_type: 'B+', chronic_diseases_allergies: 'صداع نصفي مزمن', notes: null, created_at: createPastDate(3) },
    { id: 'pat-112', full_name: 'عمرو فاروق الدسوقي', phone: '01067890125', date_of_birth: '1981-02-14', gender: 'ذكر', address: 'القاهرة، المقطم', blood_type: 'O+', chronic_diseases_allergies: null, notes: null, created_at: createPastDate(3) },
    { id: 'pat-113', full_name: 'هدى سمير القاضي', phone: '01178901236', date_of_birth: '1974-12-28', gender: 'أنثى', address: 'الجيزة، الهرم', blood_type: 'A-', chronic_diseases_allergies: 'سكر وضغط', notes: 'كشف دوري شهري.', created_at: createPastDate(2) },
    { id: 'pat-114', full_name: 'حسام نبيل غنيم', phone: '01289012347', date_of_birth: '1990-05-19', gender: 'ذكر', address: 'القاهرة، العباسية', blood_type: 'B+', chronic_diseases_allergies: null, notes: null, created_at: createPastDate(2) },
    { id: 'pat-115', full_name: 'إيمان عادل توفيق', phone: '01590123458', date_of_birth: '1997-07-07', gender: 'أنثى', address: 'القاهرة، الرحاب', blood_type: 'O+', chronic_diseases_allergies: null, notes: null, created_at: createPastDate(1) },
    { id: 'pat-116', full_name: 'زياد أشرف الصاوي', phone: '01001234569', date_of_birth: '2003-03-21', gender: 'ذكر', address: 'القاهرة، الشروق', blood_type: 'AB+', chronic_diseases_allergies: null, notes: null, created_at: createPastDate(1) },
    { id: 'pat-117', full_name: 'رانيا صبحي الخولي', phone: '01112345670', date_of_birth: '1986-10-10', gender: 'أنثى', address: 'الجيزة، 6 أكتوبر', blood_type: 'A+', chronic_diseases_allergies: 'حساسية أدوية بنسلين', notes: null, created_at: createPastDate(0) },
    { id: 'pat-118', full_name: 'هشام فتحي سلامة', phone: '01223456781', date_of_birth: '1970-08-30', gender: 'ذكر', address: 'القاهرة، الزيتون', blood_type: 'O+', chronic_diseases_allergies: 'قصور بالشريان التاجي ومتابعة قلب', notes: 'يحمل بطاقة تنبيه طبية بالقلب.', created_at: createPastDate(0) },
  ];

  // 18 موعداً لليوم (11 مؤكدة • 4 في الانتظار • 3 مكتملة)
  const appointments = [
    {
      id: 'apt-01',
      patient_id: 'pat-101',
      doctor_id: 'doc-internal',
      visit_type: 'كشف جديد',
      appointment_date: createTodayTimestamp(9, 0),
      status: 'مؤكد',
      notes: 'كشف جديد - فحص عام باطنة وأعراض إجهاد',
      created_at: createTodayTimestamp(8, 0),
    },
    {
      id: 'apt-02',
      patient_id: 'pat-102',
      doctor_id: 'doc-internal',
      visit_type: 'متابعة',
      appointment_date: createTodayTimestamp(9, 30),
      status: 'في الانتظار',
      notes: 'متابعة - قياس الضغط والسكر دورياً',
      created_at: createTodayTimestamp(8, 15),
    },
    {
      id: 'apt-03',
      patient_id: 'pat-103',
      doctor_id: 'doc-internal',
      visit_type: 'كشف جديد',
      appointment_date: createTodayTimestamp(8, 30),
      status: 'مكتمل',
      notes: 'كشف جديد - تم إجراء الكشف وصرف العلاج',
      created_at: createTodayTimestamp(7, 45),
    },
    {
      id: 'apt-04',
      patient_id: 'pat-104',
      doctor_id: 'doc-internal',
      visit_type: 'إعادة كشف',
      appointment_date: createTodayTimestamp(10, 15),
      status: 'مؤكد',
      notes: 'إعادة كشف دوري بعد انتهاء كورس العلاج',
      created_at: createTodayTimestamp(8, 30),
    },
    {
      id: 'apt-05',
      patient_id: 'pat-105',
      doctor_id: 'doc-ortho',
      visit_type: 'كشف جديد',
      appointment_date: createTodayTimestamp(10, 45),
      status: 'مؤكد',
      notes: 'كشف جديد - استشارة عظام ومفاصل',
      created_at: createTodayTimestamp(9, 0),
    },
    {
      id: 'apt-06',
      patient_id: 'pat-106',
      doctor_id: 'doc-internal',
      visit_type: 'استشارة',
      appointment_date: createTodayTimestamp(9, 0),
      status: 'مكتمل',
      notes: 'استشارة - فحص نتائج التحاليل الطبية',
      created_at: createTodayTimestamp(8, 0),
    },
    {
      id: 'apt-07',
      patient_id: 'pat-107',
      doctor_id: 'doc-internal',
      visit_type: 'متابعة',
      appointment_date: createTodayTimestamp(11, 0),
      status: 'في الانتظار',
      notes: 'متابعة - فحص نتائج وظائف كبد',
      created_at: createTodayTimestamp(9, 30),
    },
    {
      id: 'apt-08',
      patient_id: 'pat-108',
      doctor_id: 'doc-pediatric',
      visit_type: 'كشف جديد',
      appointment_date: createTodayTimestamp(11, 30),
      status: 'مؤكد',
      notes: 'كشف جديد - أعراض حساسية موسمية',
      created_at: createTodayTimestamp(9, 45),
    },
    {
      id: 'apt-09',
      patient_id: 'pat-109',
      doctor_id: 'doc-cardio',
      visit_type: 'استشارة',
      appointment_date: createTodayTimestamp(12, 0),
      status: 'مؤكد',
      notes: 'استشارة - مراجعة الجرعات الدوائية',
      created_at: createTodayTimestamp(10, 0),
    },
    {
      id: 'apt-10',
      patient_id: 'pat-110',
      doctor_id: 'doc-internal',
      visit_type: 'كشف جديد',
      appointment_date: createTodayTimestamp(12, 30),
      status: 'مؤكد',
      notes: 'كشف جديد - فحص دوري شامل',
      created_at: createTodayTimestamp(10, 15),
    },
    {
      id: 'apt-11',
      patient_id: 'pat-111',
      doctor_id: 'doc-internal',
      visit_type: 'إعادة كشف',
      appointment_date: createTodayTimestamp(13, 0),
      status: 'في الانتظار',
      notes: 'إعادة كشف - متابعة الصداع النصفي',
      created_at: createTodayTimestamp(10, 30),
    },
    {
      id: 'apt-12',
      patient_id: 'pat-112',
      doctor_id: 'doc-ortho',
      visit_type: 'كشف جديد',
      appointment_date: createTodayTimestamp(13, 15),
      status: 'مؤكد',
      notes: 'كشف جديد - آلام متفرقة بالظهر',
      created_at: createTodayTimestamp(10, 45),
    },
    {
      id: 'apt-13',
      patient_id: 'pat-113',
      doctor_id: 'doc-internal',
      visit_type: 'متابعة',
      appointment_date: createTodayTimestamp(9, 45),
      status: 'مكتمل',
      notes: 'متابعة - تقييم كفاءة التنفس والحساسية',
      created_at: createTodayTimestamp(8, 45),
    },
    {
      id: 'apt-14',
      patient_id: 'pat-114',
      doctor_id: 'doc-cardio',
      visit_type: 'متابعة',
      appointment_date: createTodayTimestamp(14, 0),
      status: 'مؤكد',
      notes: 'متابعة - تنظيم قياسات ضغط الدم',
      created_at: createTodayTimestamp(11, 0),
    },
    {
      id: 'apt-15',
      patient_id: 'pat-115',
      doctor_id: 'doc-internal',
      visit_type: 'استشارة',
      appointment_date: createTodayTimestamp(14, 30),
      status: 'مؤكد',
      notes: 'استشارة - برنامج غذائي وصحي',
      created_at: createTodayTimestamp(11, 15),
    },
    {
      id: 'apt-16',
      patient_id: 'pat-116',
      doctor_id: 'doc-pediatric',
      visit_type: 'كشف جديد',
      appointment_date: createTodayTimestamp(15, 0),
      status: 'مؤكد',
      notes: 'كشف جديد - التهاب الجيوب الأنفية',
      created_at: createTodayTimestamp(11, 30),
    },
    {
      id: 'apt-17',
      patient_id: 'pat-117',
      doctor_id: 'doc-internal',
      visit_type: 'استشارة',
      appointment_date: createTodayTimestamp(15, 30),
      status: 'في الانتظار',
      notes: 'استشارة - استعراض نتائج التحاليل المخبرية',
      created_at: createTodayTimestamp(12, 0),
    },
    {
      id: 'apt-18',
      patient_id: 'pat-118',
      doctor_id: 'doc-cardio',
      visit_type: 'متابعة',
      appointment_date: createTodayTimestamp(16, 0),
      status: 'مؤكد',
      notes: 'متابعة - تخطيط قلب وفحص وقائي',
      created_at: createTodayTimestamp(12, 15),
    },
    // حالات تحتاج إلى متابعة معلقة (إجمالي 6 حالات مطابقة للإحصائيات)
    {
      id: 'apt-follow-01',
      patient_id: 'pat-103',
      appointment_date: createPastDate(1) + 'T10:00:00Z',
      status: 'يحتاج إلى متابعة',
      notes: 'استشارة - مراجعة تقرير الرنين المغناطيسي',
      created_at: createPastDate(2),
    },
    {
      id: 'apt-follow-02',
      patient_id: 'pat-107',
      appointment_date: createPastDate(2) + 'T11:00:00Z',
      status: 'يحتاج إلى متابعة',
      notes: 'متابعة - تقييم وظائف كبد بعد شهر من العلاج',
      created_at: createPastDate(3),
    },
    {
      id: 'apt-follow-03',
      patient_id: 'pat-111',
      appointment_date: createPastDate(3) + 'T12:00:00Z',
      status: 'يحتاج إلى متابعة',
      notes: 'إعادة كشف - فحص استجابة المريض للعقار البديل',
      created_at: createPastDate(4),
    },
    {
      id: 'apt-follow-04',
      patient_id: 'pat-113',
      appointment_date: createPastDate(4) + 'T13:00:00Z',
      status: 'يحتاج إلى متابعة',
      notes: 'متابعة - إعادة فحص السكر التراكمي HbA1c',
      created_at: createPastDate(5),
    },
    {
      id: 'apt-follow-05',
      patient_id: 'pat-115',
      appointment_date: createPastDate(5) + 'T14:00:00Z',
      status: 'يحتاج إلى متابعة',
      notes: 'استشارة - تدقيق نتائج فحص الهرمونات',
      created_at: createPastDate(6),
    },
    {
      id: 'apt-follow-06',
      patient_id: 'pat-117',
      appointment_date: createPastDate(6) + 'T15:00:00Z',
      status: 'يحتاج إلى متابعة',
      notes: 'متابعة - متابعة ضغط الدم والجرعة المسائية',
      created_at: createPastDate(7),
    },
  ];

  // فواتير تشمل 11 فاتورة مدفوعة بإجمالي 14,850 ج.م
  const invoices = [
    { id: 'inv-8911', patient_id: 'pat-101', amount: 1500, issue_date: createPastDate(0), status: 'مدفوعة', created_at: createTodayTimestamp(9, 15) },
    { id: 'inv-8910', patient_id: 'pat-102', amount: 1200, issue_date: createPastDate(0), status: 'مدفوعة', created_at: createTodayTimestamp(9, 45) },
    { id: 'inv-8909', patient_id: 'pat-103', amount: 850, issue_date: createPastDate(0), status: 'مدفوعة', created_at: createTodayTimestamp(10, 0) },
    { id: 'inv-8908', patient_id: 'pat-104', amount: 2100, issue_date: createPastDate(0), status: 'مدفوعة', created_at: createTodayTimestamp(10, 30) },
    { id: 'inv-8907', patient_id: 'pat-105', amount: 950, issue_date: createPastDate(0), status: 'مدفوعة', created_at: createTodayTimestamp(11, 0) },
    { id: 'inv-8906', patient_id: 'pat-106', amount: 1800, issue_date: createPastDate(0), status: 'مدفوعة', created_at: createTodayTimestamp(11, 15) },
    { id: 'inv-8905', patient_id: 'pat-107', amount: 1100, issue_date: createPastDate(0), status: 'مدفوعة', created_at: createTodayTimestamp(11, 45) },
    { id: 'inv-8904', patient_id: 'pat-108', amount: 2400, issue_date: createPastDate(0), status: 'مدفوعة', created_at: createTodayTimestamp(12, 15) },
    { id: 'inv-8903', patient_id: 'pat-109', amount: 650, issue_date: createPastDate(0), status: 'مدفوعة', created_at: createTodayTimestamp(12, 45) },
    { id: 'inv-8902', patient_id: 'pat-110', amount: 1300, issue_date: createPastDate(0), status: 'مدفوعة', created_at: createTodayTimestamp(13, 0) },
    { id: 'inv-8901', patient_id: 'pat-111', amount: 1000, issue_date: createPastDate(0), status: 'مدفوعة', created_at: createTodayTimestamp(13, 30) },
    // فواتير أخرى بحالات سداد متنوعة
    { id: 'inv-8900', patient_id: 'pat-112', amount: 600, issue_date: createPastDate(1), status: 'غير مدفوعة', created_at: createPastDate(1) },
    { id: 'inv-8899', patient_id: 'pat-113', amount: 450, issue_date: createPastDate(2), status: 'مدفوعة جزئيًا', created_at: createPastDate(2) },
    { id: 'inv-8898', patient_id: 'pat-114', amount: 850, issue_date: createPastDate(3), status: 'متأخرة', created_at: createPastDate(3) },
  ];

  // سجل الدفعات التفصيلي المرتبط بالفواتير
  const payments = [
    { id: 'pay-8911', invoice_id: 'inv-8911', patient_id: 'pat-101', amount: 1500, payment_date: createTodayTimestamp(9, 15), payment_method: 'نقداً', notes: 'سداد كامل القيمة', created_at: createTodayTimestamp(9, 15) },
    { id: 'pay-8910', invoice_id: 'inv-8910', patient_id: 'pat-102', amount: 1200, payment_date: createTodayTimestamp(9, 45), payment_method: 'بطاقة إلكترونية', notes: 'سداد عبر البطاقة', created_at: createTodayTimestamp(9, 45) },
    { id: 'pay-8909', invoice_id: 'inv-8909', patient_id: 'pat-103', amount: 850, payment_date: createTodayTimestamp(10, 0), payment_method: 'نقداً', notes: 'سداد كامل القيمة', created_at: createTodayTimestamp(10, 0) },
    { id: 'pay-8908', invoice_id: 'inv-8908', patient_id: 'pat-104', amount: 2100, payment_date: createTodayTimestamp(10, 30), payment_method: 'نقداً', notes: 'سداد كامل القيمة', created_at: createTodayTimestamp(10, 30) },
    { id: 'pay-8907', invoice_id: 'inv-8907', patient_id: 'pat-105', amount: 950, payment_date: createTodayTimestamp(11, 0), payment_method: 'تحويل بنكي', notes: 'تحويل فوري', created_at: createTodayTimestamp(11, 0) },
    { id: 'pay-8906', invoice_id: 'inv-8906', patient_id: 'pat-106', amount: 1800, payment_date: createTodayTimestamp(11, 15), payment_method: 'نقداً', notes: 'سداد كامل القيمة', created_at: createTodayTimestamp(11, 15) },
    { id: 'pay-8905', invoice_id: 'inv-8905', patient_id: 'pat-107', amount: 1100, payment_date: createTodayTimestamp(11, 45), payment_method: 'بطاقة إلكترونية', notes: 'سداد عبر الفيزا', created_at: createTodayTimestamp(11, 45) },
    { id: 'pay-8904', invoice_id: 'inv-8904', patient_id: 'pat-108', amount: 2400, payment_date: createTodayTimestamp(12, 15), payment_method: 'نقداً', notes: 'سداد كامل القيمة', created_at: createTodayTimestamp(12, 15) },
    { id: 'pay-8903', invoice_id: 'inv-8903', patient_id: 'pat-109', amount: 650, payment_date: createTodayTimestamp(12, 45), payment_method: 'نقداً', notes: 'سداد كامل القيمة', created_at: createTodayTimestamp(12, 45) },
    { id: 'pay-8902', invoice_id: 'inv-8902', patient_id: 'pat-110', amount: 1300, payment_date: createTodayTimestamp(13, 0), payment_method: 'بطاقة إلكترونية', notes: 'سداد عبر البطاقة', created_at: createTodayTimestamp(13, 0) },
    { id: 'pay-8901', invoice_id: 'inv-8901', patient_id: 'pat-111', amount: 1000, payment_date: createTodayTimestamp(13, 30), payment_method: 'نقداً', notes: 'سداد كامل القيمة', created_at: createTodayTimestamp(13, 30) },
    // دفعة جزئية
    { id: 'pay-8899', invoice_id: 'inv-8899', patient_id: 'pat-113', amount: 200, payment_date: createPastDate(2), payment_method: 'نقداً', notes: 'دفعة مقدمة تحت الحساب', created_at: createPastDate(2) },
  ];

  // الزيارات الطبية التأسيسية للمواعيد المكتملة
  const visits = [
    {
      id: 'vis-apt-03',
      patient_id: 'pat-103',
      doctor_id: 'doc-internal',
      appointment_id: 'apt-03',
      visit_date: createTodayTimestamp(8, 30),
      status: 'مكتمل',
      chief_complaint: 'كشف جديد - فحص عام باطنة وأعراض إجهاد',
      diagnosis: 'نزلة معوية خفيفة مع إجهاد عام',
      treatment_plan: 'مطهر معوي ومحاليل جفاف ومسكن خفيف عند اللزوم',
      notes: 'تم إجراء الكشف وصرف العلاج، راحة لمدة يومين',
      vitals: { bloodPressure: '120/80', heartRate: '76', temperature: '37.0', weight: '72' },
      clinical_data: null,
      created_at: createTodayTimestamp(8, 30),
      updated_at: createTodayTimestamp(8, 50),
    },
    {
      id: 'vis-apt-06',
      patient_id: 'pat-106',
      doctor_id: 'doc-internal',
      appointment_id: 'apt-06',
      visit_date: createTodayTimestamp(9, 0),
      status: 'مكتمل',
      chief_complaint: 'استشارة - فحص نتائج التحاليل الطبية',
      diagnosis: 'تحاليل وظائف كلى طبيعية، ارتفاع طفيف بحمض اليوريك',
      treatment_plan: 'فوار يوريك أسيد والإكثار من شرب السوائل وتقليل اللحوم الحمراء',
      notes: 'إعادة التحليل بعد شهر من العلاج',
      vitals: { bloodPressure: '125/82', heartRate: '72', temperature: '36.8', weight: '80' },
      clinical_data: null,
      created_at: createTodayTimestamp(9, 0),
      updated_at: createTodayTimestamp(9, 20),
    },
  ];

  return { patients, appointments, invoices, payments, visits, prescriptions: [], profiles: [] };
}

// ذاكرة احتياطية لبيئة Node.js أو في حال عدم توفر localStorage
let memoryStorage = null;

/**
 * الحصول على كائن قاعدة البيانات المحلي
 */
export function getLocalDatabase() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const initial = getInitialDatabaseData();

        // دمج الحقول التأسيسية المحدثة إن كانت ناقصة لدى المرضى الأوائل
        const initialMap = new Map(initial.patients.map((p) => [p.id, p]));
        parsed.patients = (parsed.patients || []).map((p) => {
          if (initialMap.has(p.id)) {
            return { ...initialMap.get(p.id), ...p };
          }
          return p;
        });

        // دمج وترقية الحقول التأسيسية للمواعيد (doctor_id و visit_type)
        const initialAptsMap = new Map(initial.appointments.map((a) => [a.id, a]));
        parsed.appointments = (parsed.appointments || []).map((a) => {
          if (initialAptsMap.has(a.id)) {
            const initApt = initialAptsMap.get(a.id);
            return {
              ...initApt,
              ...a,
              doctor_id: a.doctor_id || initApt.doctor_id || 'doc-internal',
              visit_type: a.visit_type || initApt.visit_type || 'كشف جديد',
            };
          }
          return {
            ...a,
            doctor_id: a.doctor_id || 'doc-internal',
            visit_type: a.visit_type || 'كشف جديد',
          };
        });

        // ترقية وضمان وجود جدول الدفعات
        if (!parsed.payments) {
          parsed.payments = initial.payments || [];
        }

        // ترقية وضمان وجود جدول الزيارات
        if (!parsed.visits) {
          parsed.visits = initial.visits || [];
        }

        // ترقية وضمان وجود جدول الروشتات
        if (!parsed.prescriptions) {
          parsed.prescriptions = initial.prescriptions || [];
        }

        // ترقية وضمان وجود جدول الأدوار والملفات الشخصية
        if (!parsed.profiles) {
          parsed.profiles = initial.profiles || [];
        }

        return parsed;
      }
      const initial = getInitialDatabaseData();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    } catch (e) {
      console.warn('تعذر القراءة من localStorage، استخدام الذاكرة المؤقتة:', e);
    }
  }

  if (!memoryStorage) {
    memoryStorage = getInitialDatabaseData();
  }
  return memoryStorage;
}

/**
 * حفظ التعديلات في قاعدة البيانات المحلية
 */
export function saveLocalDatabase(db) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) {
      console.warn('تعذر الحفظ في localStorage:', e);
    }
  }
  memoryStorage = db;
}

/**
 * جلب المرضى مع الدعم الكامل للعلاقات
 */
export function localGetPatients() {
  const db = getLocalDatabase();
  return db.patients || [];
}

/**
 * جلب المواعيد مع جلب بيانات المريض عبر المفتاح الأجنبي patient_id -> patients.id
 */
export function localGetAppointments() {
  const db = getLocalDatabase();
  const patientsMap = new Map((db.patients || []).map((p) => [p.id, p]));

  return (db.appointments || []).map((apt) => ({
    ...apt,
    doctor_id: apt.doctor_id || 'doc-internal',
    visit_type: apt.visit_type || 'كشف جديد',
    patients: patientsMap.get(apt.patient_id) || null,
  }));
}

/**
 * جلب الفواتير مع جلب بيانات المريض واحتساب المدفوع والمتبقي وحالة السداد ديناميكياً من سجل الدفعات
 */
export function localGetInvoices() {
  const db = getLocalDatabase();
  const patientsMap = new Map((db.patients || []).map((p) => [p.id, p]));
  const allPayments = db.payments || [];

  return (db.invoices || []).map((inv) => {
    const invPayments = allPayments.filter((p) => p.invoice_id === inv.id);
    const paymentsSum = invPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalAmount = Number(inv.amount || 0);

    // إذا وُجدت دفعات فعلية نعتمد مجموعها، وإذا لم توجد وفاتورة تاريخية مسجلة كـ 'مدفوعة' نعتبرها مدفوعة بالكامل
    let paidAmount = paymentsSum;
    if (invPayments.length === 0 && inv.status === 'مدفوعة') {
      paidAmount = totalAmount;
    }

    const remainingAmount = Math.max(0, totalAmount - paidAmount);

    let paymentStatus = 'غير مدفوعة';
    if (paidAmount >= totalAmount && totalAmount > 0) {
      paymentStatus = 'مدفوعة';
    } else if (paidAmount > 0) {
      paymentStatus = 'مدفوعة جزئيًا';
    } else if (inv.status === 'متأخرة') {
      paymentStatus = 'متأخرة';
    }

    return {
      ...inv,
      patients: patientsMap.get(inv.patient_id) || null,
      totalAmount,
      paidAmount,
      remainingAmount,
      paymentStatus,
      status: paymentStatus,
      payments: invPayments,
    };
  });
}

/**
 * إضافة مريض جديد إلى قاعدة البيانات المحلية مع حفظ الحقول الاختيارية لملف المريض
 */
export function localAddPatient({
  id,
  fullName,
  phone,
  dateOfBirth,
  gender,
  address,
  bloodType,
  allergies,
  notes,
}) {
  const db = getLocalDatabase();
  const newPatient = {
    id: id || `pat-${Date.now().toString().slice(-6)}`,
    full_name: fullName.trim(),
    phone: phone ? phone.trim() : null,
    date_of_birth: dateOfBirth || null,
    gender: gender || null,
    address: address ? address.trim() : null,
    blood_type: bloodType || null,
    chronic_diseases_allergies: allergies ? allergies.trim() : null,
    notes: notes ? notes.trim() : null,
    created_at: new Date().toISOString(),
  };

  db.patients = [newPatient, ...(db.patients || [])];
  saveLocalDatabase(db);
  return newPatient;
}

/**
 * جلب مريض محدد بواسطة المعرف
 */
export function localGetPatientById(patientId) {
  const db = getLocalDatabase();
  return (db.patients || []).find((p) => p.id === patientId) || null;
}

/**
 * تحديث بيانات مريض في قاعدة البيانات المحلية
 */
export function localUpdatePatient(patientId, updates) {
  const db = getLocalDatabase();
  const index = (db.patients || []).findIndex((p) => p.id === patientId);
  if (index === -1) return null;

  const current = db.patients[index];
  const updated = {
    ...current,
    ...updates,
    id: current.id,
    full_name: updates.fullName ? updates.fullName.trim() : (updates.full_name ? updates.full_name.trim() : current.full_name),
    phone: updates.phone !== undefined ? updates.phone : current.phone,
    date_of_birth: updates.dateOfBirth !== undefined ? updates.dateOfBirth : (updates.date_of_birth !== undefined ? updates.date_of_birth : current.date_of_birth),
    gender: updates.gender !== undefined ? updates.gender : current.gender,
    address: updates.address !== undefined ? updates.address : current.address,
    blood_type: updates.bloodType !== undefined ? updates.bloodType : (updates.blood_type !== undefined ? updates.blood_type : current.blood_type),
    chronic_diseases_allergies: updates.allergies !== undefined ? updates.allergies : (updates.chronic_diseases_allergies !== undefined ? updates.chronic_diseases_allergies : current.chronic_diseases_allergies),
    notes: updates.notes !== undefined ? updates.notes : current.notes,
  };

  db.patients[index] = updated;
  saveLocalDatabase(db);
  return updated;
}

/**
 * إضافة حجز موعد جديد إلى قاعدة البيانات المحلية
 */
export function localAddAppointment({
  patientId,
  doctorId = 'doc-internal',
  appointmentDate,
  status = 'مؤكد',
  visitType = 'كشف جديد',
  reason = '',
  notes = '',
}) {
  const db = getLocalDatabase();
  const newAppointment = {
    id: `apt-${Date.now().toString().slice(-6)}`,
    patient_id: patientId,
    doctor_id: doctorId,
    appointment_date: appointmentDate,
    status,
    visit_type: visitType,
    reason: reason ? reason.trim() : null,
    notes: notes ? notes.trim() : null,
    created_at: new Date().toISOString(),
  };

  db.appointments = [newAppointment, ...(db.appointments || [])];
  saveLocalDatabase(db);
  return newAppointment;
}

/**
 * تحديث حالة أو بيانات موعد في قاعدة البيانات المحلية
 */
export function localUpdateAppointment(appointmentId, updates) {
  const db = getLocalDatabase();
  const index = (db.appointments || []).findIndex((a) => a.id === appointmentId);
  if (index === -1) return null;

  const current = db.appointments[index];
  const updated = {
    ...current,
    ...updates,
    id: current.id,
    status: updates.status !== undefined ? updates.status : current.status,
    notes: updates.notes !== undefined ? updates.notes : current.notes,
    appointment_date: updates.appointmentDate || updates.appointment_date || current.appointment_date,
  };

  db.appointments[index] = updated;
  saveLocalDatabase(db);
  return updated;
}

/**
 * جلب جميع سجلات الدفعات
 */
export function localGetPayments() {
  const db = getLocalDatabase();
  return db.payments || [];
}

/**
 * جلب سجلات الدفعات المرتبطة بفاتورة معينة
 */
export function localGetPaymentsByInvoiceId(invoiceId) {
  const db = getLocalDatabase();
  return (db.payments || []).filter((p) => p.invoice_id === invoiceId);
}

/**
 * جلب الفاتورة المرتبطة بحجز معين
 */
export function localGetInvoiceByAppointmentId(appointmentId) {
  if (!appointmentId) return null;
  const invoices = localGetInvoices();
  return invoices.find((inv) => inv.appointment_id === appointmentId) || null;
}

/**
 * إضافة فاتورة جديدة إلى قاعدة البيانات المحلية
 */
export function localAddInvoice({
  id,
  patientId,
  appointmentId = null,
  amount,
  serviceName = 'كشف طبي',
  status = 'غير مدفوعة',
  paymentMethod = 'نقداً',
  issueDate,
  callerRole = null,
}) {
  // فحص الصلاحية: الطبيب ممنوع من إنشاء الفواتير
  if (callerRole === 'doctor') {
    throw new Error('تم رفض العملية: غير مصرح للطبيب بإنشاء أو تعديل الفواتير.');
  }

  const db = getLocalDatabase();

  // فحص منع إنشاء أكثر من فاتورة أساسية للحجز نفسه
  if (appointmentId) {
    const existing = (db.invoices || []).find((inv) => inv.appointment_id === appointmentId);
    if (existing) {
      return existing;
    }
  }

  const invoiceId = id || `inv-${Date.now().toString().slice(-6)}`;
  const dateStr = issueDate || new Date().toISOString().split('T')[0];

  const newInvoice = {
    id: invoiceId,
    patient_id: patientId,
    appointment_id: appointmentId,
    amount: Number(amount) || 0,
    service_name: serviceName,
    payment_method: paymentMethod,
    issue_date: dateStr,
    status,
    created_at: new Date().toISOString(),
  };

  db.invoices = [newInvoice, ...(db.invoices || [])];
  saveLocalDatabase(db);
  return newInvoice;
}

/**
 * إضافة دفعة مالية جديدة مرتبطة بفاتورة مع تحديث حالة السداد تلقائياً
 */
export function localAddPayment({
  id,
  invoiceId,
  patientId,
  amount,
  paymentMethod = 'نقداً',
  notes = '',
  paymentDate,
  callerRole = null,
}) {
  // فحص الصلاحية: الطبيب ممنوع من تسجيل أو تعديل المدفوعات
  if (callerRole === 'doctor') {
    throw new Error('تم رفض العملية: غير مصرح للطبيب بتسجيل أو تعديل المدفوعات.');
  }

  const db = getLocalDatabase();
  const paymentAmount = Number(amount);

  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    throw new Error('قيمة الدفعة يجب أن تكون أكبر من صفر.');
  }

  const invoiceIndex = (db.invoices || []).findIndex((inv) => inv.id === invoiceId);
  if (invoiceIndex === -1) {
    throw new Error('الفاتورة المرتبطة بهذه الدفعة غير موجودة.');
  }

  const invoice = db.invoices[invoiceIndex];
  const existingPayments = (db.payments || []).filter((p) => p.invoice_id === invoiceId);
  const alreadyPaid = existingPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const remainingBefore = Math.max(0, Number(invoice.amount || 0) - alreadyPaid);

  if (paymentAmount > remainingBefore) {
    throw new Error(`قيمة الدفعة (${paymentAmount} ج.م) تتجاوز المبلغ المتبقي (${remainingBefore} ج.م).`);
  }

  const newPayment = {
    id: id || `pay-${Date.now().toString().slice(-6)}`,
    invoice_id: invoiceId,
    patient_id: patientId || invoice.patient_id,
    amount: paymentAmount,
    payment_method: paymentMethod,
    notes: notes ? notes.trim() : null,
    payment_date: paymentDate || new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  db.payments = [newPayment, ...(db.payments || [])];

  // تحديث حالة الفاتورة تلقائياً استناداً إلى إجمالي الدفعات
  const newTotalPaid = alreadyPaid + paymentAmount;
  const totalInvoiceAmount = Number(invoice.amount || 0);

  let newStatus = 'غير مدفوعة';
  if (newTotalPaid >= totalInvoiceAmount && totalInvoiceAmount > 0) {
    newStatus = 'مدفوعة';
  } else if (newTotalPaid > 0) {
    newStatus = 'مدفوعة جزئيًا';
  }

  db.invoices[invoiceIndex] = {
    ...invoice,
    status: newStatus,
    payment_method: paymentMethod || invoice.payment_method,
  };

  saveLocalDatabase(db);
  return { payment: newPayment, updatedInvoice: db.invoices[invoiceIndex] };
}

// ============================================================================
// دوال إدارة الزيارات الطبية (Visits & Clinical Records)
// ============================================================================

/**
 * جلب جميع الزيارات الطبية المسجلة في قاعدة البيانات المحلية
 * @returns {Array}
 */
export function localGetVisits() {
  const db = getLocalDatabase();
  return db.visits || [];
}

/**
 * جلب الزيارة المرتبطة بحجز محدد بواسطة معرف الحجز
 * @param {string} appointmentId
 * @returns {Object|null}
 */
export function localGetVisitByAppointmentId(appointmentId) {
  if (!appointmentId) return null;
  const db = getLocalDatabase();
  return (db.visits || []).find((v) => v.appointment_id === appointmentId) || null;
}

/**
 * جلب كافة زيارات مريض محدد مرتبة من الأحدث إلى الأقدم
 * @param {string} patientId
 * @returns {Array}
 */
export function localGetPatientVisits(patientId) {
  if (!patientId) return [];
  const db = getLocalDatabase();
  const list = (db.visits || []).filter((v) => v.patient_id === patientId);
  return [...list].sort(
    (a, b) => new Date(b.visit_date || b.created_at || 0).getTime() - new Date(a.visit_date || a.created_at || 0).getTime()
  );
}

/**
 * حفظ أو تحديث زيارة في قاعدة البيانات المحلية مع ضمان عدم تكرار الزيارات لنفس الحجز
 * إذا كانت الزيارة قائمة لنفس الحجز أو بنفس المعرف يتم تحديثها في مكانها (Update)
 * وإذا كانت جديدة يتم إدراجها (Insert)
 *
 * @param {Object} visitData بيانات الزيارة
 * @returns {Object} الزيارة المحفوظة أو المحدثة
 */
export function localSaveOrUpdateVisit(visitData, callerRole = null) {
  // فحص الصلاحية: السكرتيرة ممنوعة من إنشاء أو تعديل الزيارات الطبية
  if (callerRole === 'secretary') {
    throw new Error('تم رفض العملية: غير مصرح للسكرتيرة بإنشاء أو تعديل الزيارات الطبية.');
  }

  if (!visitData || !visitData.patient_id) {
    throw new Error('بيانات الزيارة غير مكتملة (معرف المريض مطلوب).');
  }

  const db = getLocalDatabase();
  const visits = db.visits || [];

  // البحث عن زيارة قائمة إما بنفس معرف الزيارة id أو بنفس معرف الحجز appointment_id لمنع التكرار تماماً
  const existingIndex = visits.findIndex(
    (v) => (visitData.id && v.id === visitData.id) || (visitData.appointment_id && v.appointment_id === visitData.appointment_id)
  );

  const now = new Date().toISOString();

  if (existingIndex !== -1) {
    // تحديث الزيارة القائمة (UPDATE)
    const existing = visits[existingIndex];
    const updatedVisit = {
      ...existing,
      ...visitData,
      id: existing.id, // الحفاظ على المعرف الأصلي الثابت
      appointment_id: visitData.appointment_id || existing.appointment_id,
      patient_id: visitData.patient_id || existing.patient_id,
      doctor_id: visitData.doctor_id || existing.doctor_id,
      visit_date: visitData.visit_date || existing.visit_date || now,
      status: visitData.status || existing.status || 'مسودة',
      chief_complaint: visitData.chief_complaint !== undefined ? visitData.chief_complaint : existing.chief_complaint,
      diagnosis: visitData.diagnosis !== undefined ? visitData.diagnosis : existing.diagnosis,
      treatment_plan: visitData.treatment_plan !== undefined ? visitData.treatment_plan : existing.treatment_plan,
      notes: visitData.notes !== undefined ? visitData.notes : existing.notes,
      vitals: visitData.vitals !== undefined ? visitData.vitals : existing.vitals,
      clinical_data: visitData.clinical_data !== undefined ? visitData.clinical_data : existing.clinical_data,
      updated_at: now,
    };
    visits[existingIndex] = updatedVisit;
    db.visits = visits;
    saveLocalDatabase(db);
    return updatedVisit;
  }

  // إدراج زيارة جديدة لأول مرة (INSERT)
  const newVisitId = visitData.id || (visitData.appointment_id ? `vis-${visitData.appointment_id}` : `vis-${Date.now()}`);
  const newVisit = {
    id: newVisitId,
    patient_id: visitData.patient_id,
    doctor_id: visitData.doctor_id || 'doc-internal',
    appointment_id: visitData.appointment_id || null,
    visit_date: visitData.visit_date || now,
    status: visitData.status || 'مسودة',
    chief_complaint: visitData.chief_complaint || null,
    diagnosis: visitData.diagnosis || null,
    treatment_plan: visitData.treatment_plan || null,
    notes: visitData.notes || null,
    vitals: visitData.vitals || null,
    clinical_data: visitData.clinical_data || null,
    created_at: now,
    updated_at: now,
  };

  db.visits = [newVisit, ...visits];
  saveLocalDatabase(db);
  return newVisit;
}

/**
 * جلب كافة الروشتات الطبية المسجلة
 */
export function localGetPrescriptions() {
  const db = getLocalDatabase();
  return db.prescriptions || [];
}

/**
 * جلب الروشتة المرتبطة بزيارة طبية محددة
 * @param {string} visitId
 */
export function localGetPrescriptionByVisitId(visitId) {
  if (!visitId) return null;
  const rxs = localGetPrescriptions();
  return rxs.find((r) => r.visit_id === visitId) || null;
}

/**
 * جلب الروشتة المرتبطة بحجز محدد
 * @param {string} appointmentId
 */
export function localGetPrescriptionByAppointmentId(appointmentId) {
  if (!appointmentId) return null;
  const rxs = localGetPrescriptions();
  return rxs.find((r) => r.appointment_id === appointmentId) || null;
}

/**
 * حفظ أو تحديث الروشتة الطبية في قاعدة البيانات المحلية مع منع التكرار قطعيًا
 * @param {Object} rxData
 * @returns {Object}
 */
export function localSaveOrUpdatePrescription(rxData, callerRole = null) {
  // فحص الصلاحية: السكرتيرة ممنوعة من إنشاء أو تعديل الوصفات الطبية
  if (callerRole === 'secretary') {
    throw new Error('تم رفض العملية: غير مصرح للسكرتيرة بإنشاء أو تعديل الوصفات الطبية.');
  }

  if (!rxData || (!rxData.visit_id && !rxData.appointment_id)) {
    throw new Error('بيانات الروشتة غير مكتملة (معرف الزيارة أو الحجز مطلوب).');
  }

  const db = getLocalDatabase();
  const prescriptions = db.prescriptions || [];

  const existingIndex = prescriptions.findIndex(
    (r) =>
      (rxData.id && r.id === rxData.id) ||
      (rxData.visit_id && r.visit_id === rxData.visit_id) ||
      (rxData.appointment_id && r.appointment_id === rxData.appointment_id)
  );

  const now = new Date().toISOString();

  if (existingIndex !== -1) {
    const existing = prescriptions[existingIndex];
    const updatedRx = {
      ...existing,
      ...rxData,
      id: existing.id,
      visit_id: rxData.visit_id || existing.visit_id,
      patient_id: rxData.patient_id || existing.patient_id,
      doctor_id: rxData.doctor_id || existing.doctor_id,
      appointment_id: rxData.appointment_id || existing.appointment_id,
      items: Array.isArray(rxData.items) ? rxData.items : existing.items || [],
      notes: rxData.notes !== undefined ? rxData.notes : existing.notes,
      updated_at: now,
    };
    prescriptions[existingIndex] = updatedRx;
    db.prescriptions = prescriptions;
    saveLocalDatabase(db);
    return updatedRx;
  }

  const newRxId = rxData.id || (rxData.appointment_id ? `rx-${rxData.appointment_id}` : `rx-${Date.now()}`);
  const newRx = {
    id: newRxId,
    visit_id: rxData.visit_id || (rxData.appointment_id ? `vis-${rxData.appointment_id}` : `vis-${Date.now()}`),
    patient_id: rxData.patient_id,
    doctor_id: rxData.doctor_id || 'doc-internal',
    appointment_id: rxData.appointment_id || null,
    items: Array.isArray(rxData.items) ? rxData.items : [],
    notes: rxData.notes || null,
    created_at: now,
    updated_at: now,
  };

  db.prescriptions = [newRx, ...prescriptions];
  saveLocalDatabase(db);
  return newRx;
}

/**
 * جلب كافة الملفات الشخصية والأدوار المسجلة محلياً
 */
export function localGetProfiles() {
  const db = getLocalDatabase();
  return db.profiles || [];
}

/**
 * جلب ملف المستخدم عبر معرفه الفعلي
 * @param {string} userId
 */
export function localGetProfileById(userId) {
  if (!userId) return null;
  const profiles = localGetProfiles();
  return profiles.find((p) => p.id === userId) || null;
}

/**
 * جلب ملف المستخدم عبر بريده الإلكتروني
 * @param {string} email
 */
export function localGetProfileByEmail(email) {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  const profiles = localGetProfiles();
  return profiles.find((p) => p.email && p.email.toLowerCase() === normalized) || null;
}

/**
 * حفظ أو تحديث ملف المستخدم ودوره في قاعدة البيانات المحلية
 * @param {Object} profileData
 */
export function localSaveOrUpdateProfile(profileData) {
  if (!profileData || !profileData.id) {
    throw new Error('بيانات الملف الشخصي غير مكتملة، معرف المستخدم إلزامي.');
  }

  const db = getLocalDatabase();
  const profiles = db.profiles || [];
  const existingIdx = profiles.findIndex((p) => p.id === profileData.id);
  const now = new Date().toISOString();

  if (existingIdx !== -1) {
    const existing = profiles[existingIdx];
    const updated = {
      ...existing,
      ...profileData,
      role: profileData.role || existing.role || 'secretary',
      updated_at: now,
    };
    profiles[existingIdx] = updated;
    db.profiles = profiles;
    saveLocalDatabase(db);
    return updated;
  }

  const newProfile = {
    id: profileData.id,
    email: profileData.email || null,
    full_name: profileData.full_name || profileData.email || 'مستخدم العيادة',
    role: profileData.role || 'secretary',
    created_at: profileData.created_at || now,
    updated_at: now,
  };

  db.profiles = [newProfile, ...profiles];
  saveLocalDatabase(db);
  return newProfile;
}



