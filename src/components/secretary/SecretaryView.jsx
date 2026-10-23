import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarIcon,
  ClockIcon,
  CreditCardIcon,
  AlertCircleIcon,
  UsersIcon,
  PlusIcon,
  UserPlusIcon,
  SearchIcon,
  CloseIcon,
  EyeIcon,
  RefreshCwIcon,
  CheckIcon,
  ArrowRightIcon,
  FileTextIcon,
} from '../dashboard/Icons.jsx';
import {
  fetchAppointmentsFromSupabase,
  fetchInvoicesFromSupabase,
  fetchPatientsDropdownFromSupabase,
  addAppointmentToSupabase,
  addPatientToSupabase,
  updateAppointmentStatusInDb,
  rescheduleAppointmentInDb,
  CLINIC_DOCTORS,
  CLINIC_SERVICES,
  getDoctorById,
  createInvoiceForAppointment,
  recordInvoicePayment,
  getInvoiceByAppointmentId,
  fetchInvoiceDetails,
  isTodayLocal,
  normalizeAppointmentStatus,
  isInvoicePaid,
} from '../../services/dashboardService.js';
import { formatEGP, getArabicCurrentDate } from '../../data/dashboardMockData.js';
import AppointmentBookingModal from '../appointments/AppointmentBookingModal.jsx';
import UnauthorizedPage from '../auth/UnauthorizedPage.jsx';

/**
 * مكون واجهة عمل السكرتيرة (SecretaryView)
 * صُمم لتلبية متطلبات مكتب الاستقبال وتنظيم المواعيد وحركة المرضى اليومية
 * وإدارة رحلة الفواتير والمدفوعات بدون أدوات تشخيص أو فحص سريري أو روشتة طبية.
 */
export function SecretaryView({
  onNavigateSection,
  onViewPatient,
  onAddNewPatient,
  userRole = 'secretary',
  currentUser = null,
}) {
  // فحص أمني: منع الطبيب من الدخول لمكتب السكرتارية أو إدارة الفواتير والمدفوعات
  if (userRole && userRole !== 'secretary') {
    return (
      <UnauthorizedPage
        message="غير مصرح للطبيب بالدخول إلى مكتب السكرتارية أو إدارة الحجوزات وإنشاء وتعديل الفواتير والمدفوعات."
        currentRole={userRole}
        returnPath="#/doctor"
        returnLabel="العودة إلى واجهة عمل الطبيب ←"
      />
    );
  }
  // 1. البيانات وحالات التحميل
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [patientsList, setPatientsList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // 2. حالات التصفية والبحث في جدول المواعيد
  const [activeViewTab, setActiveViewTab] = useState('appointments'); // 'appointments' | 'invoices'
  const [tableFilter, setTableFilter] = useState('upcoming'); // 'all' | 'today' | 'waiting' | 'upcoming'
  const [searchTableQuery, setSearchTableQuery] = useState('');
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');

  // 3. حالات تصفية الفواتير
  const [invoicesFilter, setInvoicesFilter] = useState('all'); // 'all' | 'unpaid' | 'partial' | 'paid'
  const [searchInvoicesQuery, setSearchInvoicesQuery] = useState('');

  // 4. حالات النوافذ المنبثقة والإشعارات
  const [activeModal, setActiveModal] = useState(null); // 'newAppointment' | 'newPatient' | 'searchPatient' | 'reschedule' | 'cancelConfirm' | 'createInvoice' | 'recordPayment' | 'viewInvoice'
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [appointmentToReschedule, setAppointmentToReschedule] = useState(null);
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleError, setRescheduleError] = useState('');

  // 5. حالات إنشاء الفاتورة وتسجيل المدفوعات والمعاينة
  const [invoiceModalTargetAppointment, setInvoiceModalTargetAppointment] = useState(null);
  const [selectedInvoiceForDetails, setSelectedInvoiceForDetails] = useState(null);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState(null);
  const [newInvoiceServiceId, setNewInvoiceServiceId] = useState('srv-checkup-new');
  const [newInvoiceCustomServiceName, setNewInvoiceCustomServiceName] = useState('كشف عيادة جديد');
  const [newInvoiceAmount, setNewInvoiceAmount] = useState(300);
  const [newInvoiceInitialPayment, setNewInvoiceInitialPayment] = useState(300);
  const [newInvoicePaymentMethod, setNewInvoicePaymentMethod] = useState('نقداً');
  const [newInvoiceError, setNewInvoiceError] = useState('');

  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentMethodInput, setPaymentMethodInput] = useState('نقداً');
  const [paymentNotesInput, setPaymentNotesInput] = useState('');
  const [paymentError, setPaymentError] = useState('');

  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [preselectedPatientId, setPreselectedPatientId] = useState('');
  const [toastMessage, setToastMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formattedToday = getArabicCurrentDate();

  // جلب كافة البيانات المرتبطة بالسكرتيرة بالتوازي
  const loadData = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const [aptsData, invsData, patientsData] = await Promise.all([
        fetchAppointmentsFromSupabase(100),
        fetchInvoicesFromSupabase(100),
        fetchPatientsDropdownFromSupabase(),
      ]);
      setAppointments(aptsData || []);
      setInvoices(invsData || []);
      setPatientsList(patientsData || []);
    } catch (err) {
      console.error('[Console Debug - تعذر تحميل بيانات واجهة السكرتيرة]:', err);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // ==========================================================================
  // الحسابات الإحصائية المختصرة لبطاقات السكرتيرة (محسوبة ديناميكياً)
  // ==========================================================================
  const stats = useMemo(() => {
    // 1. مواعيد اليوم
    const todayAppointments = appointments.filter((apt) =>
      isTodayLocal(apt.appointmentDate)
    );
    const todayCount = todayAppointments.length;

    // 2. المرضى قيد الانتظار
    const waitingAppointments = appointments.filter(
      (apt) =>
        normalizeAppointmentStatus(apt.status) === 'في الانتظار' &&
        (isTodayLocal(apt.appointmentDate) || !apt.appointmentDate)
    );
    const waitingCount = waitingAppointments.length;

    // 3. المواعيد الملغاة
    const canceledAppointments = appointments.filter(
      (apt) => normalizeAppointmentStatus(apt.status) === 'ملغي'
    );
    const canceledCount = canceledAppointments.length;

    // 4. إجمالي المحصل اليوم من الفواتير المدفوعة
    let todayCollected = 0;
    let todayPaidInvoicesCount = 0;
    invoices.forEach((inv) => {
      const isToday = isTodayLocal(inv.rawIssueDate || inv.issueDate);
      if (isToday && isInvoicePaid(inv.status || inv.paymentStatus)) {
        todayCollected += Number(inv.totalAmount || inv.amount || 0);
        todayPaidInvoicesCount += 1;
      }
    });

    return {
      todayCount,
      waitingCount,
      canceledCount,
      todayCollected,
      todayPaidInvoicesCount,
    };
  }, [appointments, invoices]);

  // ==========================================================================
  // تصفية وتجهيز جدول العمل اليومي للمواعيد
  // ==========================================================================
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      const status = normalizeAppointmentStatus(apt.status);
      const isToday = isTodayLocal(apt.appointmentDate);

      // 1. تصفية التبويب الأساسي
      if (tableFilter === 'today' && !isToday) return false;
      if (tableFilter === 'waiting' && status !== 'في الانتظار') return false;
      if (tableFilter === 'upcoming') {
        // استبعاد المكتمل والملغي من القادمة للتركيز على المواعيد الجارية
        if (status === 'مكتمل' || status === 'ملغي') return false;
      }

      // 2. تصفية الطبيب المعالج
      if (selectedDoctorFilter) {
        const aptDocId = apt.doctorId;
        if (aptDocId) {
          if (aptDocId !== selectedDoctorFilter) return false;
        } else {
          const docObj = getDoctorById(selectedDoctorFilter);
          if (docObj) {
            const docNameLower = docObj.name.toLowerCase();
            const targetLower = `${apt.doctorName || ''} ${apt.doctorNotes || ''}`.toLowerCase();
            if (!targetLower.includes(docNameLower) && !targetLower.includes(docObj.specialty.toLowerCase())) {
              return false;
            }
          }
        }
      }

      // 3. تصفية الحالة
      if (selectedStatusFilter) {
        if (status !== selectedStatusFilter) return false;
      }

      // 4. البحث النصي بالاسم أو الهاتف
      if (searchTableQuery.trim()) {
        const q = searchTableQuery.trim().toLowerCase();
        const nameMatch = (apt.patientName || '').toLowerCase().includes(q);
        const phoneMatch = (apt.phone || '').includes(q);
        if (!nameMatch && !phoneMatch) return false;
      }

      return true;
    });
  }, [appointments, tableFilter, selectedDoctorFilter, selectedStatusFilter, searchTableQuery]);

  // دالة مساعدة لتوليد شارة الحالة المنسقة
  const getStatusBadge = (status) => {
    const norm = normalizeAppointmentStatus(status);
    let pillClass = 'status-pill--scheduled';
    if (norm === 'مؤكد') pillClass = 'status-pill--confirmed';
    else if (norm === 'في الانتظار') pillClass = 'status-pill--pending';
    else if (norm === 'مكتمل') pillClass = 'status-pill--completed';
    else if (norm === 'ملغي') pillClass = 'status-pill--cancelled';

    return (
      <span className={`status-pill ${pillClass}`}>
        {norm}
      </span>
    );
  };

  // تصفية قائمة المرضى لنافذة البحث السريع
  const searchedPatients = useMemo(() => {
    if (!patientSearchQuery.trim()) return patientsList.slice(0, 8);
    const q = patientSearchQuery.trim().toLowerCase();
    return patientsList.filter(
      (p) =>
        (p.full_name || '').toLowerCase().includes(q) ||
        (p.phone || '').includes(q) ||
        String(p.id).toLowerCase().includes(q)
    );
  }, [patientsList, patientSearchQuery]);

  // دالة مساعدة لتوليد شارة حالة السداد للفاتورة
  const getPaymentStatusBadge = (status) => {
    let pillClass = 'status-pill--pending';
    let text = status || 'غير مدفوعة';
    if (text === 'مدفوعة') {
      pillClass = 'status-pill--completed';
    } else if (text === 'مدفوعة جزئيًا' || text === 'مدفوعة جزئيا') {
      pillClass = 'status-pill--confirmed';
    } else if (text === 'غير مدفوعة') {
      pillClass = 'status-pill--scheduled';
    } else if (text === 'متأخرة') {
      pillClass = 'status-pill--cancelled';
    }
    return <span className={`status-pill ${pillClass}`}>{text}</span>;
  };

  // خريطة سريعة للفواتير المرتبطة بالحجوزات للتحقق ومنع التكرار
  const invoicesByAppointmentId = useMemo(() => {
    const map = {};
    invoices.forEach((inv) => {
      if (inv.appointmentId) {
        map[inv.appointmentId] = inv;
      }
    });
    return map;
  }, [invoices]);

  // تصفية سجل الفواتير للسكرتيرة
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // 1. فلتر حالة السداد
      if (invoicesFilter === 'unpaid' && inv.status !== 'غير مدفوعة') return false;
      if (invoicesFilter === 'partial' && inv.status !== 'مدفوعة جزئيًا' && inv.status !== 'مدفوعة جزئيا') return false;
      if (invoicesFilter === 'paid' && inv.status !== 'مدفوعة') return false;

      // 2. البحث النصي
      if (searchInvoicesQuery.trim()) {
        const q = searchInvoicesQuery.trim().toLowerCase();
        const pName = (inv.patientName || '').toLowerCase();
        const invNum = (inv.invoiceNumber || '').toLowerCase();
        const sName = (inv.serviceName || inv.visitType || '').toLowerCase();
        const phone = (inv.phone || '').toLowerCase();
        if (!pName.includes(q) && !invNum.includes(q) && !sName.includes(q) && !phone.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, invoicesFilter, searchInvoicesQuery]);

  // إحصائيات مالية مجمعة للفواتير
  const invoicesSummary = useMemo(() => {
    let totalBilled = 0;
    let totalCollected = 0;
    let totalRemaining = 0;
    invoices.forEach((inv) => {
      totalBilled += Number(inv.totalAmount || inv.amount || 0);
      totalCollected += Number(inv.paidAmount || 0);
      totalRemaining += Number(inv.remainingAmount || 0);
    });
    return {
      totalCount: invoices.length,
      totalBilled,
      totalCollected,
      totalRemaining,
    };
  }, [invoices]);

  // ==========================================================================
  // إجراءات الفواتير والمدفوعات للسكرتيرة
  // ==========================================================================

  // 1. فتح نافذة إنشاء فاتورة للحجز
  const handleOpenCreateInvoice = (apt) => {
    const existing = invoicesByAppointmentId[apt.id] || invoices.find((i) => i.appointmentId === apt.id);
    if (existing) {
      showToast(`يوجد بالفعل فاتورة مسجلة لهذا الحجز (${existing.invoiceNumber}). جاري عرضها.`);
      handleOpenInvoicePreview(existing);
      return;
    }

    setInvoiceModalTargetAppointment(apt);
    const matchedService = CLINIC_SERVICES.find((s) => s.name === apt.visitType) || CLINIC_SERVICES[0];
    setNewInvoiceServiceId(matchedService.id);
    setNewInvoiceCustomServiceName(matchedService.name);
    setNewInvoiceAmount(matchedService.price);
    setNewInvoiceInitialPayment(matchedService.price);
    setNewInvoicePaymentMethod('نقداً');
    setNewInvoiceError('');
    setActiveModal('createInvoice');
  };

  // 2. حفظ الفاتورة الجديدة
  const handleSaveCreateInvoice = async (e) => {
    e.preventDefault();
    if (!invoiceModalTargetAppointment) return;

    const totalAmt = Number(newInvoiceAmount);
    const initialPay = Number(newInvoiceInitialPayment);

    if (isNaN(totalAmt) || totalAmt <= 0) {
      setNewInvoiceError('يرجى إدخال مبلغ إجمالي صحيح أكبر من صفر.');
      return;
    }

    if (isNaN(initialPay) || initialPay < 0) {
      setNewInvoiceError('قيمة الدفعة الأولية لا يمكن أن تكون سالبة.');
      return;
    }

    if (initialPay > totalAmt) {
      setNewInvoiceError(`قيمة الدفعة الأولية (${initialPay} ج.م) لا يمكن أن تتجاوز إجمالي الفاتورة (${totalAmt} ج.م).`);
      return;
    }

    try {
      setIsSubmitting(true);
      setNewInvoiceError('');

      const result = await createInvoiceForAppointment({
        appointmentId: invoiceModalTargetAppointment.id,
        patientId: invoiceModalTargetAppointment.patientId,
        serviceId: newInvoiceServiceId,
        serviceName: newInvoiceCustomServiceName,
        amount: totalAmt,
        initialPayment: initialPay,
        paymentMethod: newInvoicePaymentMethod,
        callerRole: userRole,
      });

      if (result.isExisting) {
        showToast(`هذا الحجز مرتبط بالفعل بفاتورة رقم ${result.invoice.invoiceNumber || result.invoice.id}`);
      } else {
        showToast(`تم إصدار الفاتورة (${result.invoice.invoiceNumber || result.invoice.id}) بنجاح! 🧾`);
      }

      setActiveModal(null);
      setInvoiceModalTargetAppointment(null);
      await loadData();
    } catch (err) {
      console.error('[Console Debug - تعذر إنشاء الفاتورة]:', err);
      setNewInvoiceError(err.message || 'تعذر إنشاء الفاتورة، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. فتح نافذة تسجيل دفعة لفاتورة
  const handleOpenRecordPayment = (inv) => {
    setSelectedInvoiceForPayment(inv);
    const remaining = Number(inv.remainingAmount || 0);
    setPaymentAmountInput(remaining > 0 ? String(remaining) : '');
    setPaymentMethodInput('نقداً');
    setPaymentNotesInput('');
    setPaymentError('');
    setActiveModal('recordPayment');
  };

  // 4. حفظ الدفعة المالية
  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment) return;

    const payAmt = Number(paymentAmountInput);
    const remaining = Number(selectedInvoiceForPayment.remainingAmount || 0);

    if (isNaN(payAmt) || payAmt <= 0) {
      setPaymentError('قيمة الدفعة يجب أن تكون أكبر من صفر.');
      return;
    }

    if (payAmt > remaining) {
      setPaymentError(`قيمة الدفعة (${payAmt} ج.م) تتجاوز المبلغ المتبقي المطلوب (${remaining} ج.م).`);
      return;
    }

    try {
      setIsSubmitting(true);
      setPaymentError('');

      const res = await recordInvoicePayment({
        invoiceId: selectedInvoiceForPayment.id,
        patientId: selectedInvoiceForPayment.patientId,
        amount: payAmt,
        paymentMethod: paymentMethodInput,
        notes: paymentNotesInput,
        callerRole: userRole,
      });

      showToast(`تم تسجيل دفعة بقيمة ${formatEGP(payAmt)} بنجاح 💳`);
      setActiveModal(null);
      setSelectedInvoiceForPayment(null);

      if (selectedInvoiceForDetails && selectedInvoiceForDetails.id === res.invoice.id) {
        setSelectedInvoiceForDetails(res.invoice);
      }

      await loadData();
    } catch (err) {
      console.error('[Console Debug - تعذر تسجيل الدفعة]:', err);
      setPaymentError(err.message || 'تعذر تسجيل الدفعة، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. فتح نافذة معاينة وطباعة الفاتورة
  const handleOpenInvoicePreview = async (inv) => {
    try {
      const details = await fetchInvoiceDetails(inv.id);
      setSelectedInvoiceForDetails(details || inv);
      setActiveModal('viewInvoice');
    } catch (err) {
      console.error('[Console Debug - تعذر جلب تفاصيل الفاتورة]:', err);
      setSelectedInvoiceForDetails(inv);
      setActiveModal('viewInvoice');
    }
  };

  // 6. طباعة الفاتورة
  const handlePrintInvoice = () => {
    window.print();
  };

  // ==========================================================================
  // إجراءات جدول العمل اليومي المسموح بها للسكرتيرة
  // ==========================================================================
  // 1. تأكيد الموعد (تحويل المجدول إلى مؤكد)
  const handleConfirmAppointment = async (apt) => {
    try {
      await updateAppointmentStatusInDb(apt.id, 'مؤكد');
      setAppointments((prev) =>
        prev.map((item) =>
          item.id === apt.id ? { ...item, status: 'مؤكد' } : item
        )
      );
      showToast(`تم تأكيد موعد المريض (${apt.patientName}) بنجاح ✓`);
    } catch (err) {
      console.error('[Console Debug - تعذر تأكيد الموعد]:', err);
      showToast('تعذر تأكيد الموعد، يرجى المحاولة مرة أخرى.');
    }
  };

  // 2. تسجيل حضور المريض (تحويل الموعد إلى في الانتظار)
  const handleCheckInPatient = async (apt) => {
    try {
      await updateAppointmentStatusInDb(apt.id, 'في الانتظار');
      setAppointments((prev) =>
        prev.map((item) =>
          item.id === apt.id ? { ...item, status: 'في الانتظار' } : item
        )
      );
      showToast(`تم تسجيل وصول المريض (${apt.patientName}) ونقله إلى صالة الانتظار ⏳`);
    } catch (err) {
      console.error('[Console Debug - تعذر تسجيل الحضور]:', err);
      showToast('تعذر تسجيل حضور المريض، يرجى المحاولة مرة أخرى.');
    }
  };

  // 3. فتح نافذة إعادة الجدولة
  const handleOpenReschedule = (apt) => {
    setAppointmentToReschedule(apt);
    setRescheduleError('');
    if (apt.appointmentDate && apt.appointmentDate.includes('T')) {
      const [datePart, timePart] = apt.appointmentDate.split('T');
      setRescheduleDate(datePart || '');
      setRescheduleTime(timePart ? timePart.slice(0, 5) : '10:00');
    } else {
      const todayIso = new Date().toISOString().split('T')[0];
      setRescheduleDate(todayIso);
      setRescheduleTime('10:00');
    }
    setActiveModal('reschedule');
  };

  // 4. حفظ إعادة الجدولة مع فحص التعارض الزمني
  const handleSaveReschedule = async (e) => {
    e.preventDefault();
    if (!appointmentToReschedule) return;
    if (!rescheduleDate || !rescheduleTime) {
      setRescheduleError('يرجى تحديد التاريخ والوقت الجديدين للموعد.');
      return;
    }

    try {
      setIsSubmitting(true);
      setRescheduleError('');
      const newAppointmentDate = `${rescheduleDate}T${rescheduleTime}:00`;
      const targetDoctorId = appointmentToReschedule.doctorId || 'doc-general';

      await rescheduleAppointmentInDb({
        appointmentId: appointmentToReschedule.id,
        doctorId: targetDoctorId,
        newAppointmentDate,
      });

      setAppointments((prev) =>
        prev.map((item) =>
          item.id === appointmentToReschedule.id
            ? {
                ...item,
                appointmentDate: newAppointmentDate,
                date: rescheduleDate,
                time: rescheduleTime,
                status: 'مؤكد',
              }
            : item
        )
      );

      setActiveModal(null);
      showToast(`تمت إعادة جدولة موعد (${appointmentToReschedule.patientName}) بنجاح 📅`);
      setAppointmentToReschedule(null);
      loadData();
    } catch (err) {
      console.error('[Console Debug - تعذر إعادة الجدولة]:', err);
      setRescheduleError(err.message || 'تعذر إعادة الجدولة، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. فتح نافذة تأكيد الإلغاء
  const handleOpenCancel = (apt) => {
    setAppointmentToCancel(apt);
    setActiveModal('cancelConfirm');
  };

  // 6. تنفيذ الإلغاء (تحديث ناعم للحالة إلى "ملغي" دون حذف)
  const handleConfirmCancel = async () => {
    if (!appointmentToCancel) return;
    try {
      setIsSubmitting(true);
      await updateAppointmentStatusInDb(appointmentToCancel.id, 'ملغي');
      setAppointments((prev) =>
        prev.map((item) =>
          item.id === appointmentToCancel.id ? { ...item, status: 'ملغي' } : item
        )
      );
      setActiveModal(null);
      showToast(`تم إلغاء موعد (${appointmentToCancel.patientName}) بنجاح.`);
      setAppointmentToCancel(null);
    } catch (err) {
      console.error('[Console Debug - تعذر إلغاء الموعد]:', err);
      showToast('تعذر إلغاء الموعد، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // معالجة تغيير حالة موعد عام
  const handleUpdateStatus = async (appointmentId, newStatus) => {
    try {
      await updateAppointmentStatusInDb(appointmentId, newStatus);
      setAppointments((prev) =>
        prev.map((apt) =>
          apt.id === appointmentId ? { ...apt, status: newStatus } : apt
        )
      );
      showToast(
        newStatus === 'في الانتظار'
          ? 'تم تسجيل حضور المريض ونقله إلى صالة الانتظار ⏳'
          : `تم تغيير حالة الموعد إلى "${newStatus}"`
      );
    } catch (err) {
      console.error('[Console Debug - تعذر تحديث حالة الموعد]:', err);
      showToast('تعذر تحديث حالة الموعد، يرجى المحاولة مرة أخرى.');
    }
  };

  // ==========================================================================
  // معالجة حفظ حجز جديد
  // ==========================================================================
  const handleSaveAppointment = async (e) => {
    e.preventDefault();
    const form = e.target;
    const patientId = form.elements['sec-apt-patient-id']?.value;
    const date = form.elements['sec-apt-date']?.value;
    const time = form.elements['sec-apt-time']?.value;
    const doctor = form.elements['sec-apt-doctor']?.value || 'طبيب العيادة';
    const visitType = form.elements['sec-apt-visit-type']?.value || 'كشف جديد';
    const notesInput = form.elements['sec-apt-notes']?.value || '';

    if (!patientId) {
      showToast('يرجى اختيار مريض من القائمة أولاً.');
      return;
    }

    try {
      setIsSubmitting(true);
      const appointmentDate = `${date}T${time}:00`;
      const combinedNotes = `${visitType} — ${doctor}${notesInput ? ` — ${notesInput}` : ''}`;

      await addAppointmentToSupabase({
        patientId,
        appointmentDate,
        status: 'مؤكد',
        notes: combinedNotes,
      });

      setActiveModal(null);
      setPreselectedPatientId('');
      showToast('تم تسجيل الحجز بنجاح وإدراجه في جدول المواعيد!');
      loadData();
    } catch (err) {
      console.error('[Console Debug - حفظ الحجز]:', err);
      showToast('تعذر تسجيل الحجز. يرجى المحاولة ثانية.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================================================
  // معالجة حفظ مريض جديد
  // ==========================================================================
  const handleSavePatient = async (e) => {
    e.preventDefault();
    const form = e.target;
    const fullName = form.elements['sec-pat-name']?.value;
    const phone = form.elements['sec-pat-phone']?.value;
    const gender = form.elements['sec-pat-gender']?.value || 'ذكر';
    const notes = form.elements['sec-pat-notes']?.value || '';

    if (!fullName || !fullName.trim()) {
      showToast('يرجى إدخال اسم المريض.');
      return;
    }

    try {
      setIsSubmitting(true);
      const created = await addPatientToSupabase({
        fullName,
        phone,
        gender,
        notes,
      });

      setActiveModal(null);
      showToast(`تم تسجيل المريض "${fullName}" بنجاح!`);
      await loadData();
      if (created && created.id) {
        setPreselectedPatientId(created.id);
      }
    } catch (err) {
      console.error('[Console Debug - حفظ المريض]:', err);
      showToast('تعذر تسجيل المريض، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // فتح نافذة حجز موعد مع تحديد مريض مسبقاً
  const openBookForPatient = (patId) => {
    setPreselectedPatientId(patId);
    setActiveModal('newAppointment');
  };

  return (
    <div className="secretary-page-layout" dir="rtl">
      {/* 1. القائمة الجانبية الموحدة للسكرتيرة (Secretary Sidebar) */}
      <aside className="secretary-sidebar" aria-label="قائمة السكرتيرة">
        <div className="secretary-sidebar__brand">
          <div className="secretary-sidebar__avatar" aria-hidden="true">
            👩‍💼
          </div>
          <div>
            <h2 className="secretary-sidebar__title">مكتب السكرتارية</h2>
            <span className="secretary-sidebar__role-tag">عيادة الشفاء التخصصية</span>
          </div>
        </div>

        {/* عناصر القائمة الجانبية الأربعة المطلوبة */}
        <nav className="secretary-sidebar__nav" aria-label="التنقل الداخلي للسكرتيرة">
          <ul className="secretary-nav-list">
            <li>
              <button
                type="button"
                className={`secretary-nav-link ${activeViewTab === 'appointments' ? 'secretary-nav-link--active' : ''}`}
                onClick={() => {
                  setActiveViewTab('appointments');
                }}
              >
                <span className="secretary-nav-icon">📋</span>
                <span>لوحة العمل</span>
                {activeViewTab === 'appointments' && <span className="secretary-badge-live">نشط</span>}
              </button>
            </li>

            <li>
              <button
                type="button"
                className="secretary-nav-link"
                onClick={() => {
                  if (onNavigateSection) onNavigateSection('patients');
                  else window.location.hash = '#/patients';
                }}
              >
                <span className="secretary-nav-icon">👥</span>
                <span>المرضى</span>
                <span className="secretary-count-pill font-numeric">
                  {patientsList.length}
                </span>
              </button>
            </li>

            <li>
              <button
                type="button"
                className="secretary-nav-link"
                onClick={() => {
                  setActiveViewTab('appointments');
                  setTableFilter('all');
                }}
              >
                <span className="secretary-nav-icon">📅</span>
                <span>الحجوزات</span>
                <span className="secretary-count-pill font-numeric">
                  {stats.todayCount} اليوم
                </span>
              </button>
            </li>

            <li>
              <button
                type="button"
                className={`secretary-nav-link ${activeViewTab === 'invoices' ? 'secretary-nav-link--active' : ''}`}
                onClick={() => {
                  setActiveViewTab('invoices');
                }}
              >
                <span className="secretary-nav-icon">🧾</span>
                <span>الفواتير والتحصيل</span>
                {activeViewTab === 'invoices' && <span className="secretary-badge-live">نشط</span>}
              </button>
            </li>
          </ul>
        </nav>

        {/* بطاقة ملخص صالة الانتظار المصغرة في القائمة */}
        <div className="secretary-sidebar__widget">
          <div className="secretary-widget-header">
            <ClockIcon size={16} />
            <span>صالة الانتظار</span>
          </div>
          <div className="secretary-widget-body">
            <strong className="secretary-widget-number font-numeric">
              {isLoading ? '...' : stats.waitingCount}
            </strong>
            <span className="secretary-widget-label">مرضى بانتظار الدخول</span>
          </div>
          <button
            type="button"
            className="secretary-widget-btn"
            onClick={() => setTableFilter('waiting')}
          >
            عرض المنتظرين ←
          </button>
        </div>

        {/* زر التبديل إلى لوحة التحكم الرئيسية */}
        <div className="secretary-sidebar__footer">
          <button
            type="button"
            onClick={() => {
              if (onNavigateSection) onNavigateSection('dashboard');
              else window.location.hash = '#/dashboard';
            }}
            className="secretary-switch-dashboard-btn"
            title="الانتقال إلى لوحة تحكم الطبيب والعيادة"
          >
            <span>🩺 لوحة التحكم الرئيسية</span>
            <ArrowRightIcon size={14} />
          </button>
        </div>
      </aside>

      {/* 2. منطقة المحتوى الرئيسية للسكرتيرة */}
      <section className="secretary-main-content" aria-label="لوحة عمل السكرتيرة">
        {/* الترويسة العلوية مع الأزرار السريعة الثلاثة */}
        <header className="secretary-header-banner">
          <div className="secretary-header-info">
            <div className="secretary-badge-row">
              <span className="secretary-workspace-tag">
                💼 لوحة عمل السكرتيرة والاستقبال
              </span>
              <span className="live-status-pill">
                <span className="live-status-dot" aria-hidden="true" />
                متصل
              </span>
            </div>
            <h1 className="secretary-header-title">إدارة حجوزات ومراجعي العيادة</h1>
            <p className="secretary-header-desc">
              متابعة مواعيد اليوم، تنظيم صالة الانتظار، واستقبال المرضى — {formattedToday}
            </p>
          </div>

          {/* الأزرار السريعة المطلوبة في البند رقم 4 */}
          <div className="secretary-quick-actions" role="toolbar" aria-label="أزرار الإجراءات السريعة">
            {/* زر 1: حجز موعد جديد */}
            <button
              type="button"
              onClick={() => {
                setPreselectedPatientId('');
                setActiveModal('newAppointment');
              }}
              className="btn-action-primary secretary-btn-primary"
              aria-label="حجز موعد جديد لمريض"
            >
              <PlusIcon size={18} />
              <span>حجز موعد جديد</span>
            </button>

            {/* زر 2: إضافة مريض */}
            <button
              type="button"
              onClick={() => setActiveModal('newPatient')}
              className="btn-action-secondary secretary-btn-secondary"
              aria-label="تسجيل ملف مريض جديد"
            >
              <UserPlusIcon size={18} />
              <span>إضافة مريض</span>
            </button>

            {/* زر 3: البحث عن مريض */}
            <button
              type="button"
              onClick={() => setActiveModal('searchPatient')}
              className="btn-action-secondary secretary-btn-secondary"
              aria-label="البحث عن مريض بالاسم أو الهاتف"
            >
              <SearchIcon size={18} />
              <span>البحث عن مريض</span>
            </button>

            {/* زر التحديث */}
            <button
              type="button"
              onClick={loadData}
              className="btn-action-secondary secretary-btn-refresh"
              title="تحديث البيانات"
              aria-label="تحديث البيانات"
            >
              <RefreshCwIcon size={16} />
            </button>
          </div>
        </header>

        {/* 3. كروت الإحصائيات المختصرة الأربعة المطلوبة في البند رقم 2 */}
        <div className="secretary-stats-grid" aria-label="ملخص إحصائيات الاستقبال">
          {isLoading ? (
            /* Skeleton Loading للكروت */
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="secretary-stat-card skeleton-loading">
                <div className="skeleton-line" style={{ width: '40%', height: '14px', marginBottom: '8px' }} />
                <div className="skeleton-line" style={{ width: '60%', height: '28px', marginBottom: '6px' }} />
                <div className="skeleton-line" style={{ width: '80%', height: '12px' }} />
              </div>
            ))
          ) : hasError ? (
            <div className="secretary-error-notice" role="alert">
              <AlertCircleIcon size={20} />
              <span>تعذر تحميل مؤشرات الاستقبال من قاعدة البيانات.</span>
              <button type="button" onClick={loadData} className="btn-action-secondary btn-sm">
                إعادة المحاولة
              </button>
            </div>
          ) : (
            <>
              {/* كارت 1: عدد مواعيد اليوم */}
              <div className="secretary-stat-card secretary-stat-card--teal">
                <div className="secretary-stat-top">
                  <span className="secretary-stat-title">عدد مواعيد اليوم</span>
                  <div className="secretary-stat-icon secretary-stat-icon--teal">
                    <CalendarIcon size={20} />
                  </div>
                </div>
                <div className="secretary-stat-value font-numeric">
                  {stats.todayCount}
                </div>
                <div className="secretary-stat-sub">
                  مجدولة لتاريخ اليوم بالعيادة
                </div>
              </div>

              {/* كارت 2: المرضى قيد الانتظار */}
              <div className="secretary-stat-card secretary-stat-card--amber">
                <div className="secretary-stat-top">
                  <span className="secretary-stat-title">المرضى قيد الانتظار</span>
                  <div className="secretary-stat-icon secretary-stat-icon--amber">
                    <ClockIcon size={20} />
                  </div>
                </div>
                <div className="secretary-stat-value font-numeric">
                  {stats.waitingCount}
                </div>
                <div className="secretary-stat-sub">
                  {stats.waitingCount > 0
                    ? 'في صالة الانتظار بانتظار الدخول للطبيب'
                    : 'لا يوجد مرضى في الانتظار حالياً'}
                </div>
              </div>

              {/* كارت 3: المواعيد الملغاة */}
              <div className="secretary-stat-card secretary-stat-card--rose">
                <div className="secretary-stat-top">
                  <span className="secretary-stat-title">المواعيد الملغاة</span>
                  <div className="secretary-stat-icon secretary-stat-icon--rose">
                    <CloseIcon size={20} />
                  </div>
                </div>
                <div className="secretary-stat-value font-numeric">
                  {stats.canceledCount}
                </div>
                <div className="secretary-stat-sub">
                  حجوزات ملغاة أو تم الاعتذار عنها
                </div>
              </div>

              {/* كارت 4: إجمالي المحصل اليوم */}
              <div className="secretary-stat-card secretary-stat-card--emerald">
                <div className="secretary-stat-top">
                  <span className="secretary-stat-title">إجمالي المحصل اليوم</span>
                  <div className="secretary-stat-icon secretary-stat-icon--emerald">
                    <CreditCardIcon size={20} />
                  </div>
                </div>
                <div className="secretary-stat-value font-numeric">
                  {formatEGP(stats.todayCollected)}
                </div>
                <div className="secretary-stat-sub">
                  {stats.todayPaidInvoicesCount > 0
                    ? `محصلة من ${stats.todayPaidInvoicesCount} فواتير مدفوعة اليوم`
                    : 'لا توجد فواتير محصلة لتاريخ اليوم'}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 4. جدول العمل اليومي للمواعيد (Secretary Daily Work Schedule) */}
        {activeViewTab === 'appointments' && (
        <div className="dashboard-panel secretary-table-panel">
          <div className="secretary-panel-header">
            <div>
              <h2 className="panel-title">جدول العمل اليومي للسكرتيرة</h2>
              <span className="panel-subtitle">
                متابعة حضور المرضى، تنظيم الأدوار، تأكيد وإعادة جدولة الحجوزات
              </span>
            </div>

            {/* شريط تبويبات الفلترة السريعة والبحث */}
            <div className="secretary-table-controls">
              <div className="secretary-tabs-group" role="tablist">
                <button
                  type="button"
                  className={`secretary-filter-tab ${tableFilter === 'upcoming' ? 'active' : ''}`}
                  onClick={() => setTableFilter('upcoming')}
                >
                  المواعيد القادمة
                </button>
                <button
                  type="button"
                  className={`secretary-filter-tab ${tableFilter === 'today' ? 'active' : ''}`}
                  onClick={() => setTableFilter('today')}
                >
                  مواعيد اليوم ({stats.todayCount})
                </button>
                <button
                  type="button"
                  className={`secretary-filter-tab ${tableFilter === 'waiting' ? 'active' : ''}`}
                  onClick={() => setTableFilter('waiting')}
                >
                  في الانتظار ({stats.waitingCount})
                </button>
                <button
                  type="button"
                  className={`secretary-filter-tab ${tableFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setTableFilter('all')}
                >
                  الكل ({appointments.length})
                </button>
              </div>

              {/* شريط الفلاتر المنسدلة والبحث الإضافي */}
              <div className="secretary-filters-bar">
                <div className="secretary-dropdowns-group">
                  {/* تصفية الطبيب */}
                  <select
                    value={selectedDoctorFilter}
                    onChange={(e) => setSelectedDoctorFilter(e.target.value)}
                    className="secretary-filter-select"
                    aria-label="تصفية المواعيد حسب الطبيب"
                  >
                    <option value="">جميع الأطباء / التخصصات</option>
                    {CLINIC_DOCTORS.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name} — {doc.specialty}
                      </option>
                    ))}
                  </select>

                  {/* تصفية الحالة */}
                  <select
                    value={selectedStatusFilter}
                    onChange={(e) => setSelectedStatusFilter(e.target.value)}
                    className="secretary-filter-select"
                    aria-label="تصفية المواعيد حسب الحالة"
                  >
                    <option value="">جميع الحالات</option>
                    <option value="مجدول">مجدول</option>
                    <option value="مؤكد">مؤكد</option>
                    <option value="في الانتظار">في الانتظار</option>
                    <option value="مكتمل">مكتمل</option>
                    <option value="ملغي">ملغي</option>
                  </select>
                </div>

                <div className="secretary-search-input-wrap">
                  <SearchIcon size={16} className="secretary-search-icon" />
                  <input
                    type="search"
                    value={searchTableQuery}
                    onChange={(e) => setSearchTableQuery(e.target.value)}
                    placeholder="بحث باسم المريض أو الهاتف..."
                    className="secretary-search-input"
                    aria-label="تصفية جدول المواعيد"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* حالة التحميل أو الخطأ أو الفراغ أو عرض الجدول */}
          {isLoading ? (
            <div className="secretary-loading-box">
              <div className="skeleton-line" style={{ height: '36px', marginBottom: '8px' }} />
              <div className="skeleton-line" style={{ height: '36px', marginBottom: '8px' }} />
              <div className="skeleton-line" style={{ height: '36px' }} />
              <p className="text-muted mt-1">جاري جلب جدول المواعيد من قاعدة البيانات...</p>
            </div>
          ) : hasError ? (
            <div className="secretary-error-box" role="alert">
              <AlertCircleIcon size={24} />
              <p>تعذر جلب المواعيد. يرجى التحقق من الاتصال وإعادة المحاولة.</p>
              <button type="button" onClick={loadData} className="btn-action-secondary btn-sm">
                إعادة المحاولة
              </button>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="secretary-empty-box">
              <CalendarIcon size={36} />
              <h4>لا توجد مواعيد مطابقة حالياً</h4>
              <p className="text-muted">
                {searchTableQuery || selectedDoctorFilter || selectedStatusFilter
                  ? 'لم يتم العثور على أي موعد يطابق معايير البحث والتصفية المحددة.'
                  : 'لا توجد مواعيد مجدولة وفقاً للتصفية المختارة.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setPreselectedPatientId('');
                  setActiveModal('newAppointment');
                }}
                className="btn-action-primary btn-sm mt-1"
              >
                <PlusIcon size={16} />
                <span>حجز موعد جديد الآن</span>
              </button>
            </div>
          ) : (
            <>
              {/* جدول الشاشات الكبيرة (Desktop Table) */}
              <div className="table-responsive-desktop secretary-desktop-table">
                <table className="custom-data-table" aria-label="جدول المواعيد القادمة">
                  <thead>
                    <tr>
                      <th>اسم المريض</th>
                      <th>الوقت والتاريخ</th>
                      <th>الطبيب المعالج</th>
                      <th>نوع الزيارة</th>
                      <th style={{ textAlign: 'center' }}>الحالة</th>
                      <th style={{ textAlign: 'center' }}>إجراءات الاستقبال والفوترة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppointments.map((apt) => {
                      const doctorObj = getDoctorById(apt.doctorId);
                      const doctorName = apt.doctorName || (doctorObj ? doctorObj.name : (apt.doctorNotes?.includes('باطنة') ? 'د. عيادة الباطنة' : (apt.doctorNotes?.includes('عظام') ? 'د. عيادة العظام' : (apt.doctorNotes?.includes('قلب') ? 'د. استشاري القلب' : 'طبيب العيادة'))));

                      const normStatus = normalizeAppointmentStatus(apt.status);
                      const isScheduled = normStatus === 'مجدول';
                      const isConfirmed = normStatus === 'مؤكد';
                      const isWaiting = normStatus === 'في الانتظار';
                      const isCompleted = normStatus === 'مكتمل';
                      const isCancelled = normStatus === 'ملغي';
                      const inv = invoicesByAppointmentId[apt.id];

                      return (
                        <tr key={apt.id} className="data-table-row">
                          {/* 1. اسم المريض */}
                          <td>
                            <div className="patient-name-cell">
                              <span className="patient-avatar-dot" />
                              <div>
                                <strong className="font-semibold block">{apt.patientName}</strong>
                                <span className="text-xs text-muted font-numeric" dir="ltr">
                                  {apt.phone || '—'}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 2. الوقت والتاريخ */}
                          <td>
                            <div>
                              <span className="font-numeric font-semibold block">{apt.time}</span>
                              <span className="text-xs text-muted font-numeric">{apt.date}</span>
                            </div>
                          </td>

                          {/* 3. الطبيب */}
                          <td>
                            <span className="secretary-doctor-tag">{doctorName}</span>
                          </td>

                          {/* 4. نوع الزيارة */}
                          <td>
                            <span className="secretary-visit-pill">{apt.visitType}</span>
                          </td>

                          {/* 5. الحالة */}
                          <td style={{ textAlign: 'center' }}>
                            {getStatusBadge(apt.status)}
                          </td>

                          {/* 6. إجراءات الاستقبال والفوترة للسكرتيرة */}
                          <td style={{ textAlign: 'center' }}>
                            <div className="secretary-row-actions">
                              {/* تأكيد الموعد للمواعيد المجدولة */}
                              {isScheduled && (
                                <button
                                  type="button"
                                  onClick={() => handleConfirmAppointment(apt)}
                                  className="secretary-action-btn secretary-action-btn--confirm"
                                  title="تأكيد الموعد"
                                >
                                  ✓ تأكيد
                                </button>
                              )}

                              {/* تسجيل وصول المريض إلى صالة الانتظار */}
                              {(isConfirmed || isScheduled) && (
                                <button
                                  type="button"
                                  onClick={() => handleCheckInPatient(apt)}
                                  className="secretary-action-btn secretary-action-btn--waiting"
                                  title="تسجيل وصول المريض إلى صالة الانتظار"
                                >
                                  ⏳ حضر المريض
                                </button>
                              )}

                              {/* إجراءات الفاتورة والتحصيل */}
                              {inv ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenInvoicePreview(inv)}
                                    className="secretary-invoice-badge font-numeric"
                                    title={`معاينة وطباعة الفاتورة ${inv.invoiceNumber}`}
                                  >
                                    <span>🧾 {inv.invoiceNumber}</span>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: inv.remainingAmount > 0 ? '#b91c1c' : '#047857' }}>
                                      ({inv.status})
                                    </span>
                                  </button>
                                  {Number(inv.remainingAmount || 0) > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenRecordPayment(inv)}
                                      className="secretary-action-btn secretary-action-btn--pay"
                                      title={`سداد متبقي ${formatEGP(inv.remainingAmount)}`}
                                    >
                                      💳 سداد ({formatEGP(inv.remainingAmount)})
                                    </button>
                                  )}
                                </>
                              ) : (
                                !isCancelled && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCreateInvoice(apt)}
                                    className="secretary-action-btn secretary-action-btn--invoice"
                                    title="إنشاء فاتورة جديدة لهذا الحجز"
                                  >
                                    🧾 إنشاء فاتورة
                                  </button>
                                )
                              )}

                              {/* إعادة جدولة الموعد */}
                              {!isCancelled && !isCompleted && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenReschedule(apt)}
                                  className="secretary-action-btn secretary-action-btn--reschedule"
                                  title="إعادة جدولة الموعد"
                                >
                                  📅 إعادة جدولة
                                </button>
                              )}

                              {/* إلغاء الموعد */}
                              {!isCancelled && !isCompleted && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCancel(apt)}
                                  className="secretary-action-btn secretary-action-btn--cancel"
                                  title="إلغاء هذا الحجز"
                                >
                                  ✕ إلغاء
                                </button>
                              )}

                              {/* فتح ملف المريض إن كان مرتبطاً */}
                              {apt.patientId && onViewPatient && (
                                <button
                                  type="button"
                                  onClick={() => onViewPatient(apt.patientId)}
                                  className="btn-action-view"
                                  title="فتح ملف المريض الطبي"
                                >
                                  <EyeIcon size={14} />
                                  <span>الملف</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* بطاقات المواعيد لشاشات الجوال التفاعلية (Mobile Touch Cards) */}
              <div className="secretary-mobile-cards" aria-label="قائمة مواعيد الجوال">
                {filteredAppointments.map((apt) => {
                  const doctorObj = getDoctorById(apt.doctorId);
                  const doctorName = apt.doctorName || (doctorObj ? doctorObj.name : (apt.doctorNotes?.includes('باطنة') ? 'د. عيادة الباطنة' : (apt.doctorNotes?.includes('عظام') ? 'د. عيادة العظام' : (apt.doctorNotes?.includes('قلب') ? 'د. استشاري القلب' : 'طبيب العيادة'))));
                  const normStatus = normalizeAppointmentStatus(apt.status);
                  const isScheduled = normStatus === 'مجدول';
                  const isConfirmed = normStatus === 'مؤكد';
                  const isCompleted = normStatus === 'مكتمل';
                  const isCancelled = normStatus === 'ملغي';
                  const inv = invoicesByAppointmentId[apt.id];

                  return (
                    <div key={`mob-${apt.id}`} className="secretary-mobile-card">
                      <div className="mobile-card-top">
                        <div className="mobile-card-patient-info">
                          <span className="patient-avatar-dot" />
                          <div>
                            <strong className="mobile-card-patient-name">{apt.patientName}</strong>
                            <span className="mobile-card-phone font-numeric" dir="ltr">
                              {apt.phone || 'بدون هاتف'}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                          {getStatusBadge(apt.status)}
                          {inv && (
                            <span className="font-numeric text-xs font-bold" style={{ color: inv.remainingAmount > 0 ? '#b91c1c' : '#047857' }}>
                              {inv.invoiceNumber} • {inv.status}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mobile-card-details-grid">
                        <div className="mobile-card-detail-item">
                          <span className="mobile-card-detail-label">الوقت والتاريخ</span>
                          <span className="mobile-card-detail-value font-numeric">
                            {apt.time || '—'} • {apt.date || '—'}
                          </span>
                        </div>

                        <div className="mobile-card-detail-item">
                          <span className="mobile-card-detail-label">الطبيب المعالج</span>
                          <span className="mobile-card-detail-value">
                            {doctorName}
                          </span>
                        </div>

                        <div className="mobile-card-detail-item">
                          <span className="mobile-card-detail-label">نوع الزيارة</span>
                          <span className="mobile-card-detail-value">
                            {apt.visitType || 'كشف'}
                          </span>
                        </div>

                        <div className="mobile-card-detail-item">
                          <span className="mobile-card-detail-label">الحالة الحالية</span>
                          <span className="mobile-card-detail-value">
                            {normStatus}
                          </span>
                        </div>
                      </div>

                      <div className="mobile-card-actions">
                        {/* تأكيد الموعد */}
                        {isScheduled && (
                          <button
                            type="button"
                            onClick={() => handleConfirmAppointment(apt)}
                            className="secretary-action-btn secretary-action-btn--confirm"
                            title="تأكيد الموعد"
                          >
                            ✓ تأكيد
                          </button>
                        )}

                        {/* تسجيل وصول المريض */}
                        {(isConfirmed || isScheduled) && (
                          <button
                            type="button"
                            onClick={() => handleCheckInPatient(apt)}
                            className="secretary-action-btn secretary-action-btn--waiting"
                            title="تسجيل وصول المريض إلى صالة الانتظار"
                          >
                            ⏳ حضر المريض
                          </button>
                        )}

                        {/* إجراءات الفاتورة للجوال */}
                        {inv ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenInvoicePreview(inv)}
                              className="secretary-action-btn secretary-action-btn--invoice"
                            >
                              🧾 الفاتورة
                            </button>
                            {Number(inv.remainingAmount || 0) > 0 && (
                              <button
                                type="button"
                                onClick={() => handleOpenRecordPayment(inv)}
                                className="secretary-action-btn secretary-action-btn--pay"
                              >
                                💳 سداد ({formatEGP(inv.remainingAmount)})
                              </button>
                            )}
                          </>
                        ) : (
                          !isCancelled && (
                            <button
                              type="button"
                              onClick={() => handleOpenCreateInvoice(apt)}
                              className="secretary-action-btn secretary-action-btn--invoice"
                            >
                              🧾 إنشاء فاتورة
                            </button>
                          )
                        )}

                        {/* إعادة الجدولة */}
                        {!isCancelled && !isCompleted && (
                          <button
                            type="button"
                            onClick={() => handleOpenReschedule(apt)}
                            className="secretary-action-btn secretary-action-btn--reschedule"
                            title="إعادة جدولة الموعد"
                          >
                            📅 إعادة جدولة
                          </button>
                        )}

                        {/* إلغاء الموعد */}
                        {!isCancelled && !isCompleted && (
                          <button
                            type="button"
                            onClick={() => handleOpenCancel(apt)}
                            className="secretary-action-btn secretary-action-btn--cancel"
                            title="إلغاء هذا الحجز"
                          >
                            ✕ إلغاء
                          </button>
                        )}

                        {/* فتح ملف المريض */}
                        {apt.patientId && onViewPatient && (
                          <button
                            type="button"
                            onClick={() => onViewPatient(apt.patientId)}
                            className="btn-action-view"
                            title="فتح ملف المريض الطبي"
                          >
                            <EyeIcon size={14} />
                            <span>الملف</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
        )}

        {/* 5. سجل الفواتير والتحصيل المالي للسكرتيرة (Secretary Invoices & Payments Ledger) */}
        {activeViewTab === 'invoices' && (
          <div className="dashboard-panel secretary-table-panel">
            <div className="secretary-panel-header">
              <div>
                <h2 className="panel-title">سجل الفواتير والتحصيل المالي</h2>
                <span className="panel-subtitle">
                  إدارة فواتير المرضى، تسجيل ومتابعة المدفوعات النقدية والبنكية، وطباعة إيصالات السداد
                </span>
              </div>

              {/* شريط تبويبات الفلترة السريعة والبحث */}
              <div className="secretary-table-controls">
                <div className="secretary-tabs-group" role="tablist">
                  <button
                    type="button"
                    className={`secretary-filter-tab ${invoicesFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setInvoicesFilter('all')}
                  >
                    الكل ({invoices.length})
                  </button>
                  <button
                    type="button"
                    className={`secretary-filter-tab ${invoicesFilter === 'unpaid' ? 'active' : ''}`}
                    onClick={() => setInvoicesFilter('unpaid')}
                  >
                    غير مدفوعة ({invoices.filter((i) => i.status === 'غير مدفوعة').length})
                  </button>
                  <button
                    type="button"
                    className={`secretary-filter-tab ${invoicesFilter === 'partial' ? 'active' : ''}`}
                    onClick={() => setInvoicesFilter('partial')}
                  >
                    مدفوعة جزئيًا ({invoices.filter((i) => i.status === 'مدفوعة جزئيًا' || i.status === 'مدفوعة جزئيا').length})
                  </button>
                  <button
                    type="button"
                    className={`secretary-filter-tab ${invoicesFilter === 'paid' ? 'active' : ''}`}
                    onClick={() => setInvoicesFilter('paid')}
                  >
                    مدفوعة بالكامل ({invoices.filter((i) => i.status === 'مدفوعة').length})
                  </button>
                </div>

                <div className="secretary-filters-bar">
                  <div className="secretary-search-input-wrap" style={{ minWidth: '280px' }}>
                    <SearchIcon size={16} className="secretary-search-icon" />
                    <input
                      type="search"
                      value={searchInvoicesQuery}
                      onChange={(e) => setSearchInvoicesQuery(e.target.value)}
                      placeholder="بحث برقم الفاتورة، اسم المريض، الخدمة..."
                      className="secretary-search-input"
                      aria-label="تصفية جدول الفواتير"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ملخص إجمالي الفواتير المالي السريع */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', padding: '0.85rem 1.25rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                <span>إجمالي المطالبات: </span>
                <strong style={{ color: '#0f172a', fontWeight: 800 }} className="font-numeric">
                  {formatEGP(invoicesSummary.totalBilled)}
                </strong>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#047857' }}>
                <span>المحصل الفعلي: </span>
                <strong style={{ fontWeight: 800 }} className="font-numeric">
                  {formatEGP(invoicesSummary.totalCollected)}
                </strong>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#b91c1c' }}>
                <span>المتبقي غير المحصل: </span>
                <strong style={{ fontWeight: 800 }} className="font-numeric">
                  {formatEGP(invoicesSummary.totalRemaining)}
                </strong>
              </div>
            </div>

            {/* محتوى جدول الفواتير */}
            {isLoading ? (
              <div className="secretary-loading-box">
                <div className="skeleton-line" style={{ height: '36px', marginBottom: '8px' }} />
                <div className="skeleton-line" style={{ height: '36px', marginBottom: '8px' }} />
                <div className="skeleton-line" style={{ height: '36px' }} />
                <p className="text-muted mt-1">جاري تحميل سجل الفواتير من قاعدة البيانات...</p>
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="secretary-empty-box">
                <CreditCardIcon size={36} />
                <h4>لا توجد فواتير مطابقة حالياً</h4>
                <p className="text-muted">
                  {searchInvoicesQuery || invoicesFilter !== 'all'
                    ? 'لم يتم العثور على أي فاتورة تطابق معايير البحث المحددة.'
                    : 'لا توجد أي فواتير مسجلة في هذا التبويب.'}
                </p>
              </div>
            ) : (
              <>
                {/* جدول الفواتير للشاشات الكبيرة */}
                <div className="table-responsive-desktop secretary-desktop-table">
                  <table className="custom-data-table" aria-label="جدول الفواتير والتحصيل">
                    <thead>
                      <tr>
                        <th>رقم الفاتورة</th>
                        <th>المريض</th>
                        <th>الخدمة / نوع الزيارة</th>
                        <th>تاريخ الإصدار</th>
                        <th>الإجمالي</th>
                        <th>المدفوع</th>
                        <th>المتبقي</th>
                        <th>طريقة الدفع</th>
                        <th style={{ textAlign: 'center' }}>حالة السداد</th>
                        <th style={{ textAlign: 'center' }}>الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map((inv) => {
                        const hasRemaining = Number(inv.remainingAmount || 0) > 0;
                        return (
                          <tr key={inv.id} className="data-table-row">
                            {/* رقم الفاتورة */}
                            <td>
                              <span className="font-numeric font-semibold text-teal-800">
                                {inv.invoiceNumber}
                              </span>
                            </td>

                            {/* اسم المريض */}
                            <td>
                              <strong className="font-semibold block">{inv.patientName}</strong>
                            </td>

                            {/* الخدمة */}
                            <td>
                              <span className="secretary-visit-pill">
                                {inv.serviceName || inv.visitType}
                              </span>
                            </td>

                            {/* تاريخ الإصدار */}
                            <td>
                              <span className="font-numeric text-xs text-muted">
                                {inv.issueDate}
                              </span>
                            </td>

                            {/* الإجمالي */}
                            <td>
                              <span className="font-numeric font-semibold">
                                {formatEGP(inv.totalAmount)}
                              </span>
                            </td>

                            {/* المدفوع */}
                            <td>
                              <span className="font-numeric text-emerald-700 font-semibold">
                                {formatEGP(inv.paidAmount)}
                              </span>
                            </td>

                            {/* المتبقي */}
                            <td>
                              <span
                                className={`font-numeric font-semibold ${
                                  hasRemaining ? 'text-danger' : 'text-muted'
                                }`}
                              >
                                {formatEGP(inv.remainingAmount)}
                              </span>
                            </td>

                            {/* طريقة الدفع */}
                            <td>
                              <span className="text-xs text-muted">
                                {inv.paymentMethod || 'نقداً'}
                              </span>
                            </td>

                            {/* حالة السداد */}
                            <td style={{ textAlign: 'center' }}>
                              {getPaymentStatusBadge(inv.status)}
                            </td>

                            {/* إجراءات الفاتورة */}
                            <td style={{ textAlign: 'center' }}>
                              <div className="secretary-row-actions">
                                {/* زر المعاينة والطباعة */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenInvoicePreview(inv)}
                                  className="secretary-action-btn secretary-action-btn--invoice"
                                  title="معاينة وطباعة الفاتورة"
                                >
                                  🧾 معاينة
                                </button>

                                {/* زر تسجيل دفعة إضافية إذا كان هناك متبقي */}
                                {hasRemaining && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRecordPayment(inv)}
                                    className="secretary-action-btn secretary-action-btn--pay"
                                    title="تسجيل دفعة نقدية / بنكية"
                                  >
                                    💳 سداد
                                  </button>
                                )}

                                {/* زر فتح ملف المريض */}
                                {inv.patientId && onViewPatient && (
                                  <button
                                    type="button"
                                    onClick={() => onViewPatient(inv.patientId)}
                                    className="btn-action-view"
                                    title="فتح ملف المريض الطبي"
                                  >
                                    <EyeIcon size={14} />
                                    <span>الملف</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* بطاقات الجوال للفواتير */}
                <div className="secretary-mobile-cards" aria-label="قائمة فواتير الجوال">
                  {filteredInvoices.map((inv) => {
                    const hasRemaining = Number(inv.remainingAmount || 0) > 0;
                    return (
                      <div key={`mob-inv-${inv.id}`} className="secretary-mobile-card">
                        <div className="mobile-card-top">
                          <div>
                            <span className="font-numeric font-bold text-teal-800 block text-sm">
                              {inv.invoiceNumber}
                            </span>
                            <strong className="mobile-card-patient-name">{inv.patientName}</strong>
                          </div>
                          <div>{getPaymentStatusBadge(inv.status)}</div>
                        </div>

                        <div className="mobile-card-details-grid">
                          <div className="mobile-card-detail-item">
                            <span className="mobile-card-detail-label">الخدمة</span>
                            <span className="mobile-card-detail-value">{inv.serviceName || inv.visitType}</span>
                          </div>
                          <div className="mobile-card-detail-item">
                            <span className="mobile-card-detail-label">تاريخ الإصدار</span>
                            <span className="mobile-card-detail-value font-numeric">{inv.issueDate}</span>
                          </div>
                          <div className="mobile-card-detail-item">
                            <span className="mobile-card-detail-label">الإجمالي</span>
                            <span className="mobile-card-detail-value font-numeric font-bold">{formatEGP(inv.totalAmount)}</span>
                          </div>
                          <div className="mobile-card-detail-item">
                            <span className="mobile-card-detail-label">المتبقي</span>
                            <span className={`mobile-card-detail-value font-numeric font-bold ${hasRemaining ? 'text-danger' : 'text-emerald-700'}`}>
                              {formatEGP(inv.remainingAmount)}
                            </span>
                          </div>
                        </div>

                        <div className="mobile-card-actions">
                          <button
                            type="button"
                            onClick={() => handleOpenInvoicePreview(inv)}
                            className="secretary-action-btn secretary-action-btn--invoice"
                          >
                            🧾 معاينة وطباعة
                          </button>
                          {hasRemaining && (
                            <button
                              type="button"
                              onClick={() => handleOpenRecordPayment(inv)}
                              className="secretary-action-btn secretary-action-btn--pay"
                            >
                              💳 سداد المتبقي ({formatEGP(inv.remainingAmount)})
                            </button>
                          )}
                          {inv.patientId && onViewPatient && (
                            <button
                              type="button"
                              onClick={() => onViewPatient(inv.patientId)}
                              className="btn-action-view"
                            >
                              <EyeIcon size={14} />
                              <span>الملف</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* ======================================================================
          النوافذ المنبثقة التفاعلية (Modals)
          ====================================================================== */}

      {/* ١. نافذة نموذج حجز موعد جديد الموحدة */}
      <AppointmentBookingModal
        isOpen={activeModal === 'newAppointment'}
        onClose={() => {
          setActiveModal(null);
          setPreselectedPatientId('');
        }}
        onSuccess={() => {
          showToast('تم تسجيل الحجز بنجاح وإدراجه في جدول المواعيد!');
          setTableFilter('all');
          loadData();
        }}
        initialPatientId={preselectedPatientId}
        patientsList={patientsList}
      />


      {/* ٢. نافذة تسجيل مريض جديد */}
      {activeModal === 'newPatient' && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="sec-modal-pat-title">
          <div className="modal-container">
            <div className="modal-header">
              <div className="modal-header-icon modal-header-icon--indigo">
                <UserPlusIcon size={20} />
              </div>
              <div>
                <h3 id="sec-modal-pat-title" className="modal-title">تسجيل مريض جديد</h3>
                <p className="modal-subtitle">إدخال البيانات الأساسية لملف المريض في الاستقبال</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="modal-close-btn"
                aria-label="إغلاق النافذة"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePatient} className="modal-form">
              <div className="form-group">
                <label htmlFor="sec-pat-name" className="form-label">
                  الاسم الرباعي للمريض <span className="text-danger">*</span>
                </label>
                <input
                  id="sec-pat-name"
                  name="sec-pat-name"
                  type="text"
                  required
                  placeholder="مثال: إبراهيم مصطفى عبد السلام"
                  className="form-input"
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="sec-pat-phone" className="form-label">
                    رقم الهاتف <span className="text-danger">*</span>
                  </label>
                  <input
                    id="sec-pat-phone"
                    name="sec-pat-phone"
                    type="tel"
                    required
                    placeholder="01xxxxxxxxx"
                    className="form-input font-numeric"
                    dir="ltr"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="sec-pat-gender" className="form-label">
                    النوع
                  </label>
                  <select id="sec-pat-gender" name="sec-pat-gender" className="form-select" defaultValue="ذكر">
                    <option value="ذكر">ذكر</option>
                    <option value="أنثى">أنثى</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="sec-pat-notes" className="form-label">
                  ملاحظات عامة أو تنبيهات إدارية
                </label>
                <textarea
                  id="sec-pat-notes"
                  name="sec-pat-notes"
                  rows={2}
                  placeholder="أي ملاحظات اتصال أو تفضيلات حضور..."
                  className="form-textarea"
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="btn-cancel"
                  disabled={isSubmitting}
                >
                  إلغاء
                </button>
                <button type="submit" className="btn-submit" disabled={isSubmitting}>
                  {isSubmitting ? 'جاري التسجيل...' : 'حفظ المريض'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ٣. نافذة البحث السريع عن مريض المطلوبة في البند رقم 4 */}
      {activeModal === 'searchPatient' && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="sec-modal-search-title">
          <div className="modal-container" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <div className="modal-header-icon modal-header-icon--teal">
                <SearchIcon size={20} />
              </div>
              <div>
                <h3 id="sec-modal-search-title" className="modal-title">البحث عن مريض</h3>
                <p className="modal-subtitle">البحث الفوري بالاسم أو رقم الهاتف أو رقم الملف</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="modal-close-btn"
                aria-label="إغلاق النافذة"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="modal-search-bar" style={{ padding: '0 0 1rem 0' }}>
              <input
                type="search"
                autoFocus
                value={patientSearchQuery}
                onChange={(e) => setPatientSearchQuery(e.target.value)}
                placeholder="اكتب اسم المريض أو رقم الهاتف أو #pat-..."
                className="form-input font-numeric"
                style={{ fontSize: '1.05rem', padding: '0.75rem 1rem', width: '100%' }}
              />
            </div>

            <div className="modal-search-results-list" style={{ maxHeight: '350px', overflowY: 'auto' }}>
              {searchedPatients.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                  <p style={{ fontWeight: 700 }}>لم يتم العثور على أي مريض يطابق بحثك</p>
                  <button
                    type="button"
                    onClick={() => setActiveModal('newPatient')}
                    className="btn-action-primary btn-sm mt-1"
                  >
                    <UserPlusIcon size={16} />
                    <span>إضافة هذا المريض الآن</span>
                  </button>
                </div>
              ) : (
                searchedPatients.map((patient) => (
                  <div key={patient.id} className="secretary-patient-search-card">
                    <div className="patient-search-info">
                      <div className="patient-search-avatar">
                        {(patient.full_name || 'م')[0]}
                      </div>
                      <div>
                        <strong className="patient-search-name">{patient.full_name}</strong>
                        <div className="patient-search-meta">
                          <span className="font-numeric" dir="ltr">{patient.phone || 'بدون هاتف'}</span>
                          <span className="text-separator">•</span>
                          <span className="font-numeric text-muted">#{String(patient.id).slice(0, 8).toUpperCase()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="patient-search-actions">
                      <button
                        type="button"
                        onClick={() => openBookForPatient(patient.id)}
                        className="btn-action-primary btn-sm"
                        title="حجز موعد لهذا المريض"
                      >
                        <PlusIcon size={14} />
                        <span>حجز موعد</span>
                      </button>

                      {onViewPatient && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveModal(null);
                            onViewPatient(patient.id);
                          }}
                          className="btn-action-secondary btn-sm"
                          title="فتح الملف الطبي للمريض"
                        >
                          <EyeIcon size={14} />
                          <span>فتح الملف</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="btn-cancel w-full"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ٤. نافذة إعادة جدولة الموعد */}
      {activeModal === 'reschedule' && appointmentToReschedule && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-reschedule-title">
          <div className="modal-container" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div className="modal-header-icon modal-header-icon--indigo">
                <CalendarIcon size={20} />
              </div>
              <div>
                <h3 id="modal-reschedule-title" className="modal-title">إعادة جدولة الموعد</h3>
                <p className="modal-subtitle">تعديل تاريخ أو وقت موعد المريض مع التحقق من التعارضات</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  setAppointmentToReschedule(null);
                  setRescheduleError('');
                }}
                className="modal-close-btn"
                aria-label="إغلاق النافذة"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveReschedule} className="modal-form">
              <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>اسم المريض:</span>
                  <strong style={{ fontSize: '0.92rem', color: '#1e293b' }}>{appointmentToReschedule.patientName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>الطبيب المعالج:</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--primary, #0f2b48)' }}>
                    {appointmentToReschedule.doctorName || getDoctorById(appointmentToReschedule.doctorId)?.name || 'طبيب العيادة'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>الموعد الحالي:</span>
                  <span style={{ fontSize: '0.85rem', direction: 'ltr', fontFamily: 'monospace' }}>
                    {appointmentToReschedule.date} {appointmentToReschedule.time}
                  </span>
                </div>
              </div>

              {rescheduleError && (
                <div className="conflict-error-box" role="alert" style={{ marginBottom: '1rem' }}>
                  <AlertCircleIcon size={18} />
                  <span>{rescheduleError}</span>
                </div>
              )}

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="reschedule-date" className="form-label">
                    التاريخ الجديد <span className="text-danger">*</span>
                  </label>
                  <input
                    id="reschedule-date"
                    type="date"
                    required
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="form-input font-numeric"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="reschedule-time" className="form-label">
                    الوقت الجديد <span className="text-danger">*</span>
                  </label>
                  <input
                    id="reschedule-time"
                    type="time"
                    required
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="form-input font-numeric"
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    setAppointmentToReschedule(null);
                    setRescheduleError('');
                  }}
                  className="btn-cancel"
                  disabled={isSubmitting}
                >
                  تراجع
                </button>
                <button type="submit" className="btn-submit" disabled={isSubmitting}>
                  {isSubmitting ? 'جاري التحقق والحفظ...' : 'تأكيد الموعد الجديد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ٥. نافذة تأكيد إلغاء الموعد */}
      {activeModal === 'cancelConfirm' && appointmentToCancel && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-cancel-title">
          <div className="modal-container" style={{ maxWidth: '460px' }}>
            <div className="confirm-modal-box">
              <div className="confirm-modal-icon-wrap">
                <AlertCircleIcon size={28} />
              </div>

              <h3 id="modal-cancel-title" className="confirm-modal-title">
                تأكيد إلغاء الموعد
              </h3>

              <p className="confirm-modal-desc">
                هل أنت متأكد من إلغاء موعد المريض{' '}
                <strong style={{ color: '#0f172a' }}>{appointmentToCancel.patientName}</strong>؟
                <br />
                سيتم تحديث حالة الموعد إلى <span style={{ color: '#dc2626', fontWeight: 700 }}>«ملغي»</span> دون حذف أي بيانات أو سجلات من ملف المريض.
              </p>

              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', padding: '0.65rem 1rem', width: '100%', fontSize: '0.85rem', color: '#991b1b', textAlign: 'right' }}>
                <div><strong>الطبيب:</strong> {appointmentToCancel.doctorName || 'طبيب العيادة'}</div>
                <div><strong>الموعد:</strong> <span dir="ltr">{appointmentToCancel.date} {appointmentToCancel.time}</span></div>
              </div>

              <div className="confirm-modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    setAppointmentToCancel(null);
                  }}
                  className="btn-cancel"
                  disabled={isSubmitting}
                >
                  تراجع
                </button>

                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  className="btn-danger-confirm"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'جاري الإلغاء...' : 'نعم، قم بإلغاء الموعد'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ٦. نافذة إنشاء فاتورة جديدة للحجز */}
      {activeModal === 'createInvoice' && invoiceModalTargetAppointment && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-create-invoice-title">
          <div className="modal-container" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div className="modal-header-icon modal-header-icon--teal">
                <FileTextIcon size={20} />
              </div>
              <div>
                <h3 id="modal-create-invoice-title" className="modal-title">إنشاء فاتورة جديدة للحجز</h3>
                <p className="modal-subtitle">إصدار فاتورة إلكترونية مع ربطها التلقائي بملف المريض والحجز</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  setInvoiceModalTargetAppointment(null);
                  setNewInvoiceError('');
                }}
                className="modal-close-btn"
                aria-label="إغلاق النافذة"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCreateInvoice} className="modal-form">
              {/* بطاقة ملخص الحجز والمريض */}
              <div className="invoice-summary-card">
                <div className="invoice-summary-row">
                  <span className="invoice-summary-label">اسم المريض:</span>
                  <strong className="invoice-summary-val">{invoiceModalTargetAppointment.patientName}</strong>
                </div>
                <div className="invoice-summary-row">
                  <span className="invoice-summary-label">رقم الهاتف:</span>
                  <span className="invoice-summary-val font-numeric" dir="ltr">{invoiceModalTargetAppointment.phone || 'بدون هاتف'}</span>
                </div>
                <div className="invoice-summary-row">
                  <span className="invoice-summary-label">الطبيب المعالج:</span>
                  <span className="invoice-summary-val text-teal-800">
                    {invoiceModalTargetAppointment.doctorName || getDoctorById(invoiceModalTargetAppointment.doctorId)?.name || 'طبيب العيادة'}
                  </span>
                </div>
                <div className="invoice-summary-row">
                  <span className="invoice-summary-label">موعد الحجز:</span>
                  <span className="invoice-summary-val font-numeric">
                    {invoiceModalTargetAppointment.date} {invoiceModalTargetAppointment.time}
                  </span>
                </div>
              </div>

              {newInvoiceError && (
                <div className="conflict-error-box" role="alert" style={{ marginBottom: '1rem' }}>
                  <AlertCircleIcon size={18} />
                  <span>{newInvoiceError}</span>
                </div>
              )}

              {/* اختيار الخدمة الطبية */}
              <div className="form-group">
                <label htmlFor="create-inv-service" className="form-label">
                  الخدمة الطبية / الإجراء <span className="text-danger">*</span>
                </label>
                <select
                  id="create-inv-service"
                  value={newInvoiceServiceId}
                  onChange={(e) => {
                    const sid = e.target.value;
                    setNewInvoiceServiceId(sid);
                    const s = CLINIC_SERVICES.find((item) => item.id === sid);
                    if (s) {
                      setNewInvoiceCustomServiceName(s.name);
                      setNewInvoiceAmount(s.price);
                      setNewInvoiceInitialPayment(s.price);
                    }
                  }}
                  className="form-select"
                >
                  {CLINIC_SERVICES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {formatEGP(s.price)}
                    </option>
                  ))}
                  <option value="custom">خدمة أخرى (إدخال مخصص)...</option>
                </select>
              </div>

              {newInvoiceServiceId === 'custom' && (
                <div className="form-group">
                  <label htmlFor="create-inv-custom-name" className="form-label">
                    اسم الخدمة المخصصة <span className="text-danger">*</span>
                  </label>
                  <input
                    id="create-inv-custom-name"
                    type="text"
                    required
                    value={newInvoiceCustomServiceName}
                    onChange={(e) => setNewInvoiceCustomServiceName(e.target.value)}
                    className="form-input"
                    placeholder="مثال: فحص دوري شامل، غيار جراحي..."
                  />
                </div>
              )}

              {/* المبلغ الإجمالي والمدفوع الأولي */}
              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="create-inv-amount" className="form-label">
                    إجمالي الفاتورة (ج.م) <span className="text-danger">*</span>
                  </label>
                  <input
                    id="create-inv-amount"
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={newInvoiceAmount}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setNewInvoiceAmount(val);
                      if (newInvoiceInitialPayment > val) {
                        setNewInvoiceInitialPayment(val);
                      }
                    }}
                    className="form-input font-numeric"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="create-inv-initial-pay" className="form-label">
                    المسدد الآن (ج.م)
                  </label>
                  <input
                    id="create-inv-initial-pay"
                    type="number"
                    min="0"
                    max={newInvoiceAmount}
                    step="1"
                    value={newInvoiceInitialPayment}
                    onChange={(e) => setNewInvoiceInitialPayment(Number(e.target.value))}
                    className="form-input font-numeric"
                  />
                </div>
              </div>

              {/* أزرار سريعة لتحديد السداد */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>خيارات سريعة:</span>
                <button
                  type="button"
                  onClick={() => setNewInvoiceInitialPayment(newInvoiceAmount)}
                  className="btn-quick-full-pay"
                >
                  سداد كامل ({formatEGP(newInvoiceAmount)})
                </button>
                <button
                  type="button"
                  onClick={() => setNewInvoiceInitialPayment(0)}
                  className="btn-quick-full-pay"
                  style={{ color: '#64748b', borderColor: '#cbd5e1', backgroundColor: '#f1f5f9' }}
                >
                  بدون سداد (آجل 0 ج.م)
                </button>
              </div>

              {/* طريقة الدفع */}
              <div className="form-group">
                <label htmlFor="create-inv-pay-method" className="form-label">
                  طريقة الدفع
                </label>
                <select
                  id="create-inv-pay-method"
                  value={newInvoicePaymentMethod}
                  onChange={(e) => setNewInvoicePaymentMethod(e.target.value)}
                  className="form-select"
                >
                  <option value="نقداً">نقداً (كاش)</option>
                  <option value="بطاقة بنكية">بطاقة بنكية / فيزا</option>
                  <option value="فودافون كاش / إنستاباي">فودافون كاش / إنستاباي</option>
                  <option value="تحويل بنكي">تحويل بنكي</option>
                </select>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    setInvoiceModalTargetAppointment(null);
                    setNewInvoiceError('');
                  }}
                  className="btn-cancel"
                  disabled={isSubmitting}
                >
                  إلغاء
                </button>
                <button type="submit" className="btn-submit" disabled={isSubmitting}>
                  {isSubmitting ? 'جاري الإصدار...' : 'حفظ وإصدار الفاتورة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ٧. نافذة تسجيل دفعة لفاتورة */}
      {activeModal === 'recordPayment' && selectedInvoiceForPayment && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-record-pay-title">
          <div className="modal-container" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div className="modal-header-icon modal-header-icon--emerald">
                <CreditCardIcon size={20} />
              </div>
              <div>
                <h3 id="modal-record-pay-title" className="modal-title">تسجيل دفعة مالية</h3>
                <p className="modal-subtitle">إضافة سند قبض جديد لفاتورة المريض</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  setSelectedInvoiceForPayment(null);
                  setPaymentError('');
                }}
                className="modal-close-btn"
                aria-label="إغلاق النافذة"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="modal-form">
              {/* بطاقة ملخص أرصدة الفاتورة */}
              <div className="invoice-summary-card">
                <div className="invoice-summary-row">
                  <span className="invoice-summary-label">رقم الفاتورة:</span>
                  <span className="invoice-summary-val font-numeric text-teal-800">{selectedInvoiceForPayment.invoiceNumber}</span>
                </div>
                <div className="invoice-summary-row">
                  <span className="invoice-summary-label">المريض:</span>
                  <strong className="invoice-summary-val">{selectedInvoiceForPayment.patientName}</strong>
                </div>
                <div className="invoice-summary-row">
                  <span className="invoice-summary-label">الخدمة:</span>
                  <span className="invoice-summary-val">{selectedInvoiceForPayment.serviceName || selectedInvoiceForPayment.visitType}</span>
                </div>
                <div className="invoice-summary-row">
                  <span className="invoice-summary-label">إجمالي الفاتورة:</span>
                  <span className="invoice-summary-val font-numeric">{formatEGP(selectedInvoiceForPayment.totalAmount)}</span>
                </div>
                <div className="invoice-summary-row">
                  <span className="invoice-summary-label">المدفوع سابقاً:</span>
                  <span className="invoice-summary-val font-numeric text-emerald-700">{formatEGP(selectedInvoiceForPayment.paidAmount)}</span>
                </div>
                <div className="invoice-summary-row invoice-remaining-highlight">
                  <span>المبلغ المتبقي المطلوب:</span>
                  <span className="font-numeric">{formatEGP(selectedInvoiceForPayment.remainingAmount)}</span>
                </div>
              </div>

              {paymentError && (
                <div className="conflict-error-box" role="alert" style={{ marginBottom: '1rem' }}>
                  <AlertCircleIcon size={18} />
                  <span>{paymentError}</span>
                </div>
              )}

              {/* قيمة الدفعة مع زر ملء كامل المبلغ */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label htmlFor="record-pay-amount" className="form-label" style={{ margin: 0 }}>
                    قيمة الدفعة (ج.م) <span className="text-danger">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setPaymentAmountInput(String(selectedInvoiceForPayment.remainingAmount))}
                    className="btn-quick-full-pay"
                  >
                    سداد كامل المتبقي ({formatEGP(selectedInvoiceForPayment.remainingAmount)})
                  </button>
                </div>
                <input
                  id="record-pay-amount"
                  type="number"
                  min="1"
                  max={selectedInvoiceForPayment.remainingAmount}
                  step="1"
                  required
                  value={paymentAmountInput}
                  onChange={(e) => setPaymentAmountInput(e.target.value)}
                  className="form-input font-numeric"
                  placeholder="أدخل مبلغ الدفعة..."
                />
              </div>

              {/* طريقة السداد */}
              <div className="form-group">
                <label htmlFor="record-pay-method" className="form-label">
                  طريقة السداد <span className="text-danger">*</span>
                </label>
                <select
                  id="record-pay-method"
                  value={paymentMethodInput}
                  onChange={(e) => setPaymentMethodInput(e.target.value)}
                  className="form-select"
                >
                  <option value="نقداً">نقداً (كاش)</option>
                  <option value="بطاقة بنكية">بطاقة بنكية / فيزا</option>
                  <option value="فودافون كاش / إنستاباي">فودافون كاش / إنستاباي</option>
                  <option value="تحويل بنكي">تحويل بنكي</option>
                </select>
              </div>

              {/* بيان أو ملاحظات السداد */}
              <div className="form-group">
                <label htmlFor="record-pay-notes" className="form-label">
                  بيان أو ملاحظات الدفعة (اختياري)
                </label>
                <input
                  id="record-pay-notes"
                  type="text"
                  value={paymentNotesInput}
                  onChange={(e) => setPaymentNotesInput(e.target.value)}
                  className="form-input"
                  placeholder="مثال: دفعة ثانية، رقم المعاملة البنكية..."
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    setSelectedInvoiceForPayment(null);
                    setPaymentError('');
                  }}
                  className="btn-cancel"
                  disabled={isSubmitting}
                >
                  إلغاء
                </button>
                <button type="submit" className="btn-submit" disabled={isSubmitting}>
                  {isSubmitting ? 'جاري التسجيل...' : 'تأكيد تسجيل الدفعة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ٨. نافذة معاينة وطباعة الفاتورة وإيصال السداد */}
      {activeModal === 'viewInvoice' && selectedInvoiceForDetails && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-view-invoice-title">
          <div className="modal-container" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <div className="modal-header-icon modal-header-icon--indigo">
                <FileTextIcon size={20} />
              </div>
              <div>
                <h3 id="modal-view-invoice-title" className="modal-title">فاتورة وإيصال سداد إلكتروني</h3>
                <p className="modal-subtitle">معاينة تفاصيل الفاتورة وسندات القبض المسجلة مع إمكانية الطباعة الفورية</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  setSelectedInvoiceForDetails(null);
                }}
                className="modal-close-btn"
                aria-label="إغلاق النافذة"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            {/* ورقة الفاتورة المطبوعة */}
            <div className="printable-invoice-paper">
              {/* ترويسة العيادة */}
              <div className="invoice-paper-header">
                <div>
                  <div className="invoice-paper-logo">
                    <span>🩺</span>
                    <span>عيادة الشفاء التخصصية</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                    د. أحمد محمود — باطنة وجهاز هضمي • العنوان: شارع المثال - القاهرة • هاتف: 01000000000
                  </div>
                </div>
                <div className="invoice-paper-meta">
                  <div><strong>رقم الفاتورة:</strong> <span className="font-numeric">{selectedInvoiceForDetails.invoiceNumber}</span></div>
                  <div><strong>التاريخ:</strong> <span className="font-numeric">{selectedInvoiceForDetails.issueDate}</span></div>
                  <div><strong>الحالة:</strong> {getPaymentStatusBadge(selectedInvoiceForDetails.status)}</div>
                </div>
              </div>

              {/* بيانات المريض */}
              <div className="invoice-patient-card-paper">
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.8rem' }}>اسم المريض:</span>
                  <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{selectedInvoiceForDetails.patientName}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.8rem' }}>رقم الملف:</span>
                  <span className="font-numeric">{selectedInvoiceForDetails.patientId || '—'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.8rem' }}>الخدمة المقدمة:</span>
                  <span>{selectedInvoiceForDetails.serviceName || selectedInvoiceForDetails.visitType}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.8rem' }}>طريقة الدفع الأساسية:</span>
                  <span>{selectedInvoiceForDetails.paymentMethod || 'نقداً'}</span>
                </div>
              </div>

              {/* جدول الخدمات */}
              <table className="invoice-paper-items-table">
                <thead>
                  <tr>
                    <th>البيان / الخدمة الطبية</th>
                    <th style={{ textAlign: 'center' }}>العدد</th>
                    <th style={{ textAlign: 'left' }}>المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>{selectedInvoiceForDetails.serviceName || selectedInvoiceForDetails.visitType}</strong>
                    </td>
                    <td style={{ textAlign: 'center' }} className="font-numeric">1</td>
                    <td style={{ textAlign: 'left' }} className="font-numeric font-bold">
                      {formatEGP(selectedInvoiceForDetails.totalAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* جدول سجل الدفعات المسجلة إن وُجدت */}
              {selectedInvoiceForDetails.payments && selectedInvoiceForDetails.payments.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    سجل الدفعات وسندات القبض المسجلة:
                  </div>
                  <table className="payment-history-table">
                    <thead>
                      <tr>
                        <th>التاريخ</th>
                        <th>وسيلة الدفع</th>
                        <th>المبلغ</th>
                        <th>ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoiceForDetails.payments.map((p) => (
                        <tr key={p.id}>
                          <td className="font-numeric">
                            {p.payment_date ? p.payment_date.split('T')[0] : '—'}
                          </td>
                          <td>{p.payment_method || 'نقداً'}</td>
                          <td className="font-numeric font-bold text-emerald-700">
                            {formatEGP(p.amount)}
                          </td>
                          <td className="text-muted">{p.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* صندوق ملخص الحساب */}
              <div className="invoice-paper-summary-box">
                <div className="invoice-summary-row">
                  <span>إجمالي الفاتورة:</span>
                  <strong className="font-numeric">{formatEGP(selectedInvoiceForDetails.totalAmount)}</strong>
                </div>
                <div className="invoice-summary-row">
                  <span>إجمالي المدفوع:</span>
                  <strong className="font-numeric text-emerald-700">{formatEGP(selectedInvoiceForDetails.paidAmount)}</strong>
                </div>
                <div className="invoice-summary-row" style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '0.45rem' }}>
                  <span style={{ fontWeight: 800 }}>المبلغ المتبقي:</span>
                  <strong className={`font-numeric ${selectedInvoiceForDetails.remainingAmount > 0 ? 'text-danger' : 'text-emerald-700'}`}>
                    {formatEGP(selectedInvoiceForDetails.remainingAmount)}
                  </strong>
                </div>
              </div>

              {/* تذييل الفاتورة */}
              <div className="invoice-paper-footer-notice">
                شكراً لزيارتكم • نتمنى لكم دوام الصحة والعافية • هذه الفاتورة صادرة إلكترونياً من مكتب استقبال العيادة
              </div>
            </div>

            {/* أزرار الإجراءات للنافذة */}
            <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={handlePrintInvoice}
                className="btn-action-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <span>🖨️ طباعة الفاتورة</span>
              </button>

              {Number(selectedInvoiceForDetails.remainingAmount || 0) > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    handleOpenRecordPayment(selectedInvoiceForDetails);
                  }}
                  className="secretary-action-btn secretary-action-btn--pay"
                  style={{ padding: '0.65rem 1.25rem', fontSize: '0.9rem' }}
                >
                  💳 سداد المتبقي ({formatEGP(selectedInvoiceForDetails.remainingAmount)})
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  setSelectedInvoiceForDetails(null);
                }}
                className="btn-cancel"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ٩. إشعار تفاعلي سريع (Toast notification) */}
      {toastMessage && (
        <div className="dashboard-toast" role="status" aria-live="polite">
          <span className="toast-dot" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default SecretaryView;
