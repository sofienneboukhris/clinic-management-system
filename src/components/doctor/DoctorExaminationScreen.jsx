import React, { useState, useEffect } from 'react';
import {
  ArrowRightIcon,
  ActivityIcon,
  ShieldAlertIcon,
  ClockIcon,
  CheckCircleIcon,
  CheckIcon,
  FileTextIcon,
  UsersIcon,
  AlertCircleIcon,
  CalendarIcon,
  RefreshCwIcon,
  CloseIcon,
} from '../dashboard/Icons.jsx';
import {
  fetchPatientById,
  calculateAge,
} from '../../services/patientService.js';
import {
  getPatientLastVisit,
  saveDoctorExaminationDraft,
  getDoctorExaminationDraft,
  completeDoctorExamination,
  fetchVisitByAppointmentId,
  saveOrUpdateDoctorVisit,
  formatLocalDate,
  getDoctorById,
} from '../../services/dashboardService.js';
import { localGetAppointments } from '../../lib/resilientDb.js';
import UnauthorizedPage from '../auth/UnauthorizedPage.jsx';

/**
 * شاشة «بدء الكشف» السريري للطبيب (DoctorExaminationScreen)
 * تفتح حصراً باستخدام معرف المريض (patientId) ومعرف الحجز (appointmentId).
 * تدعم الحفظ الحقيقي في Supabase والسجل الطبي للمريض مع منع التكرار وإمكانية استعادة المسودة بعد الـ Refresh.
 */
export function DoctorExaminationScreen({
  patientId,
  appointmentId,
  onBack,
  onComplete,
  userRole = 'doctor',
}) {
  // فحص أمني فوري: إذا كان المستخدم سكرتيرة يُحجب الكشف تماماً
  if (userRole && userRole !== 'doctor') {
    return (
      <UnauthorizedPage
        message="غير مصرح للسكرتارية بفتح شاشة الكشف أو تعديل الزيارات والروشتات الطبية. هذه الصلاحية مقصورة على الطبيب المعالج فقط."
        currentRole={userRole}
        returnPath="#/secretary"
        returnLabel="العودة إلى مكتب السكرتارية ←"
        onReturn={onBack}
      />
    );
  }
  // 1. حالات تحميل بيانات المريض والحجز والزيارة
  const [patient, setPatient] = useState(null);
  const [appointment, setAppointment] = useState(null);
  const [lastVisit, setLastVisit] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [currentVisitId, setCurrentVisitId] = useState(null);

  // 2. حالات الأزرار والتحميل لمنع النقر المزدوج
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState(null);

  // 3. أقسام الفحص السريري التسعة (Form State)
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [historyOfPresentIllness, setHistoryOfPresentIllness] = useState('');

  // العلامات الحيوية الاختيارية
  const [vitals, setVitals] = useState({
    bloodPressure: '',
    heartRate: '',
    temperature: '',
    weight: '',
    oxygenSaturation: '',
    bloodSugar: '',
  });

  const [physicalExam, setPhysicalExam] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [labInvestigations, setLabInvestigations] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');

  // موعد المتابعة
  const [followUpTimeframe, setFollowUpTimeframe] = useState('لا يحتاج متابعة');
  const [followUpCustomDate, setFollowUpCustomDate] = useState('');

  // 3.ب الروشتة الطبية الإلكترونية ومعاينة الطباعة
  const [prescriptionItems, setPrescriptionItems] = useState([]);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // إظهار إشعار سريع
  const showToast = (msg) => {
    setFeedbackToast(msg);
    setTimeout(() => {
      setFeedbackToast(null);
    }, 3500);
  };

  // جلب بيانات المريض والحجز والمسودة السابقة
  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // 1. جلب بيانات المريض بمعرفه الفعلي
      const patientData = await fetchPatientById(patientId);
      setPatient(patientData);

      // 2. جلب بيانات الحجز بمعرفه الفعلي
      const allApts = localGetAppointments();
      const currentApt = allApts.find((a) => a.id === appointmentId) || null;
      setAppointment(currentApt);

      // 3. جلب آخر زيارة سابقة للمريض
      const prevVisit = await getPatientLastVisit(patientId, appointmentId);
      setLastVisit(prevVisit);

      // 4. فحص وجود زيارة مسجلة مسبقاً لهذا الحجز في Supabase / قاعدة البيانات المحلية
      const existingVisit = await fetchVisitByAppointmentId(appointmentId);
      if (existingVisit) {
        setCurrentVisitId(existingVisit.id);
        if (existingVisit.chief_complaint) setChiefComplaint(existingVisit.chief_complaint);
        if (existingVisit.diagnosis) setDiagnosis(existingVisit.diagnosis);
        if (existingVisit.treatment_plan) setTreatmentPlan(existingVisit.treatment_plan);
        if (existingVisit.notes) setDoctorNotes(existingVisit.notes);
        if (existingVisit.vitals) setVitals((prev) => ({ ...prev, ...existingVisit.vitals }));

        if (existingVisit.clinical_data) {
          const cd = existingVisit.clinical_data;
          if (cd.history_of_present_illness) setHistoryOfPresentIllness(cd.history_of_present_illness);
          if (cd.physical_exam) setPhysicalExam(cd.physical_exam);
          if (cd.lab_investigations) setLabInvestigations(cd.lab_investigations);
          if (cd.follow_up?.timeframe) setFollowUpTimeframe(cd.follow_up.timeframe);
          if (cd.follow_up?.custom_date) setFollowUpCustomDate(cd.follow_up.custom_date);
          if (cd.prescription?.items && Array.isArray(cd.prescription.items)) {
            setPrescriptionItems(cd.prescription.items);
          }
        }
      } else {
        // فحص وجود مسودة سابقة محفوظة في التخزين المحلي
        const savedDraft = getDoctorExaminationDraft(appointmentId);
        if (savedDraft) {
          if (savedDraft.chiefComplaint !== undefined) setChiefComplaint(savedDraft.chiefComplaint);
          if (savedDraft.historyOfPresentIllness !== undefined) setHistoryOfPresentIllness(savedDraft.historyOfPresentIllness);
          if (savedDraft.vitals) setVitals((prev) => ({ ...prev, ...savedDraft.vitals }));
          if (savedDraft.physicalExam !== undefined) setPhysicalExam(savedDraft.physicalExam);
          if (savedDraft.diagnosis !== undefined) setDiagnosis(savedDraft.diagnosis);
          if (savedDraft.treatmentPlan !== undefined) setTreatmentPlan(savedDraft.treatmentPlan);
          if (savedDraft.prescriptionItems && Array.isArray(savedDraft.prescriptionItems)) {
            setPrescriptionItems(savedDraft.prescriptionItems);
          }
          if (savedDraft.labInvestigations !== undefined) setLabInvestigations(savedDraft.labInvestigations);
          if (savedDraft.doctorNotes !== undefined) setDoctorNotes(savedDraft.doctorNotes);
          if (savedDraft.followUpTimeframe !== undefined) setFollowUpTimeframe(savedDraft.followUpTimeframe);
          if (savedDraft.followUpCustomDate !== undefined) setFollowUpCustomDate(savedDraft.followUpCustomDate);
        } else if (currentApt && currentApt.notes) {
          // تعبئة الشكوى الأولية من سبب الزيارة إن وُجدت
          setChiefComplaint(currentApt.notes);
        }
      }
    } catch (err) {
      console.error('[DoctorExaminationScreen - خطأ في تحميل البيانات]:', err);
      setLoadError('تعذر تحميل بيانات الكشف الطبي والمريض. يرجى إعادة المحاولة.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (patientId && appointmentId) {
      loadData();
    }
  }, [patientId, appointmentId]);

  // إدارة بنود الأدوية بالروشتة
  const handleAddMedication = () => {
    setPrescriptionItems((prev) => [
      ...prev,
      {
        id: `med-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        medication_name: '',
        strength: '',
        dose: '',
        frequency: '',
        duration: '',
        instructions: '',
      },
    ]);
  };

  const handleUpdateMedication = (id, field, value) => {
    setPrescriptionItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveMedication = (id) => {
    setPrescriptionItems((prev) => prev.filter((item) => item.id !== id));
  };

  // تجميع بيانات الكشف الحالية
  const getFormData = () => ({
    chiefComplaint,
    historyOfPresentIllness,
    vitals,
    physicalExam,
    diagnosis,
    treatmentPlan,
    prescriptionItems,
    labInvestigations,
    doctorNotes,
    followUpTimeframe,
    followUpCustomDate,
  });

  // تصفية وتجهيز بنود الروشتة المكتملة
  const getCleanedPrescriptionItems = () => {
    return prescriptionItems
      .filter((item) => item.medication_name && item.medication_name.trim())
      .map((item) => ({
        id: item.id,
        medication_name: item.medication_name.trim(),
        strength: item.strength ? item.strength.trim() : '',
        dose: item.dose ? item.dose.trim() : '',
        frequency: item.frequency ? item.frequency.trim() : '',
        duration: item.duration ? item.duration.trim() : '',
        instructions: item.instructions ? item.instructions.trim() : '',
      }));
  };

  // ٤.أ — حفظ مسودة الكشف الطبي في Supabase والسجل الطبي (Save Draft)
  const handleSaveDraft = async () => {
    if (isDraftSaving || isCompleting) return;
    try {
      setIsDraftSaving(true);
      const formData = getFormData();
      const cleanedMeds = getCleanedPrescriptionItems();

      // تنسيق الخطة العلاجية بما يشمل ملخص الأدوية إن وُجدت
      let formattedTreatment = formData.treatmentPlan ? formData.treatmentPlan.trim() : '';
      if (cleanedMeds.length > 0 && !formattedTreatment) {
        formattedTreatment = cleanedMeds
          .map((m, i) => `${i + 1}. ${m.medication_name}${m.strength ? ` (${m.strength})` : ''} - ${m.dose || ''} ${m.frequency || ''} ${m.duration ? `لمدة ${m.duration}` : ''}`.trim())
          .join('\n');
      }

      const visitPayload = {
        patient_id: patientId,
        doctor_id: appointment?.doctor_id || 'doc-internal',
        appointment_id: appointmentId,
        visit_date: new Date().toISOString(),
        status: 'مسودة',
        chief_complaint: formData.chiefComplaint ? formData.chiefComplaint.trim() : null,
        diagnosis: formData.diagnosis ? formData.diagnosis.trim() : null,
        treatment_plan: formattedTreatment || null,
        notes: formData.doctorNotes ? formData.doctorNotes.trim() : null,
        vitals: formData.vitals,
        clinical_data: {
          history_of_present_illness: formData.historyOfPresentIllness ? formData.historyOfPresentIllness.trim() : null,
          physical_exam: formData.physicalExam ? formData.physicalExam.trim() : null,
          lab_investigations: formData.labInvestigations ? formData.labInvestigations.trim() : null,
          follow_up: {
            timeframe: formData.followUpTimeframe,
            custom_date: formData.followUpCustomDate,
          },
          prescription: {
            id: currentVisitId ? `rx-${currentVisitId}` : `rx-${appointmentId}`,
            visit_id: currentVisitId || (appointmentId ? `vis-${appointmentId}` : null),
            patient_id: patientId,
            doctor_id: appointment?.doctor_id || 'doc-internal',
            appointment_id: appointmentId,
            items: cleanedMeds,
            notes: formData.treatmentPlan ? formData.treatmentPlan.trim() : null,
            created_at: new Date().toISOString(),
          },
        },
      };

      const saved = await saveOrUpdateDoctorVisit(visitPayload, currentVisitId, userRole);
      if (saved && saved.id) {
        setCurrentVisitId(saved.id);
      }

      // حفظ مسودة محلية إضافية مع بنود الأدوية
      saveDoctorExaminationDraft(appointmentId, {
        ...formData,
        prescriptionItems,
      });

      showToast('تم حفظ مسودة الكشف والروشتة بنجاح! 💾');
    } catch (err) {
      console.error('[DoctorExaminationScreen - تعذر حفظ المسودة]:', err);
      showToast('تعذر حفظ مسودة الكشف، يرجى المحاولة ثانية.');
    } finally {
      setIsDraftSaving(false);
    }
  };

  // ٤.ب — إنهاء الكشف الطبي واعتماد الزيارة (Complete Examination)
  const handleCompleteExam = async () => {
    // منع النقر المتكرر
    if (isDraftSaving || isCompleting) return;

    // 1. التحقق من الحقول الإلزامية للكشف الطبي
    const trimmedComplaint = chiefComplaint ? chiefComplaint.trim() : '';
    const trimmedDiagnosis = diagnosis ? diagnosis.trim() : '';

    if (!trimmedComplaint && !trimmedDiagnosis) {
      showToast('يرجى تسجيل التشخيص الطبي أو الشكوى الرئيسية قبل إنهاء الكشف واعتماد الزيارة ⚠️');
      return;
    }

    // فحص بنود الأدوية للتأكد من عدم وجود بنود ناقصة اسم الدواء
    const incompleteMed = prescriptionItems.find(
      (m) =>
        (!m.medication_name || !m.medication_name.trim()) &&
        (m.strength || m.dose || m.frequency || m.duration || m.instructions)
    );
    if (incompleteMed) {
      showToast('يرجى تحديد اسم الدواء للبند المضاف بالروشتة أو حذفه ⚠️');
      return;
    }

    try {
      setIsCompleting(true);
      const formData = getFormData();
      const cleanedMeds = getCleanedPrescriptionItems();

      // تنسيق ملخص الكشف لملاحظات الحجز
      const summaryParts = [];
      if (trimmedDiagnosis) summaryParts.push(`التشخيص: ${trimmedDiagnosis}`);
      if (cleanedMeds.length > 0) summaryParts.push(`الروشتة: (${cleanedMeds.length} أدوية)`);
      if (formData.treatmentPlan) summaryParts.push(`الخطة: ${formData.treatmentPlan.trim()}`);
      if (trimmedComplaint) summaryParts.push(`الشكوى: ${trimmedComplaint}`);
      if (formData.followUpTimeframe && formData.followUpTimeframe !== 'لا يحتاج متابعة') {
        summaryParts.push(`المتابعة: ${formData.followUpTimeframe}${formData.followUpCustomDate ? ` (${formData.followUpCustomDate})` : ''}`);
      }
      const combinedClinicalSummary = summaryParts.join(' • ');

      let formattedTreatment = formData.treatmentPlan ? formData.treatmentPlan.trim() : '';
      if (cleanedMeds.length > 0 && !formattedTreatment) {
        formattedTreatment = cleanedMeds
          .map((m, i) => `${i + 1}. ${m.medication_name}${m.strength ? ` (${m.strength})` : ''} - ${m.dose || ''} ${m.frequency || ''} ${m.duration ? `لمدة ${m.duration}` : ''}`.trim())
          .join('\n');
      }

      // إعداد سجل الزيارة والروشتة
      const visitPayload = {
        patient_id: patientId,
        doctor_id: appointment?.doctor_id || 'doc-internal',
        appointment_id: appointmentId,
        visit_date: new Date().toISOString(),
        status: 'مكتمل',
        chief_complaint: trimmedComplaint || null,
        diagnosis: trimmedDiagnosis || null,
        treatment_plan: formattedTreatment || null,
        notes: formData.doctorNotes ? formData.doctorNotes.trim() : null,
        vitals: formData.vitals,
        clinical_data: {
          history_of_present_illness: formData.historyOfPresentIllness ? formData.historyOfPresentIllness.trim() : null,
          physical_exam: formData.physicalExam ? formData.physicalExam.trim() : null,
          lab_investigations: formData.labInvestigations ? formData.labInvestigations.trim() : null,
          follow_up: {
            timeframe: formData.followUpTimeframe,
            custom_date: formData.followUpCustomDate,
          },
          prescription: {
            id: currentVisitId ? `rx-${currentVisitId}` : `rx-${appointmentId}`,
            visit_id: currentVisitId || (appointmentId ? `vis-${appointmentId}` : null),
            patient_id: patientId,
            doctor_id: appointment?.doctor_id || 'doc-internal',
            appointment_id: appointmentId,
            items: cleanedMeds,
            notes: formData.treatmentPlan ? formData.treatmentPlan.trim() : null,
            created_at: new Date().toISOString(),
          },
        },
      };

      // 2. حفظ الزيارة والروشتة أولاً في قاعدة البيانات
      let savedVisit = null;
      try {
        savedVisit = await saveOrUpdateDoctorVisit(visitPayload, currentVisitId, userRole);
        if (!savedVisit || !savedVisit.id) {
          throw new Error('فشل استلام تأكيد حفظ الزيارة.');
        }
        setCurrentVisitId(savedVisit.id);
      } catch (saveVisitErr) {
        console.error('[DoctorExaminationScreen - خطأ في حفظ الزيارة والروشتة]:', saveVisitErr);
        setIsCompleting(false);
        showToast(saveVisitErr.message || 'تعذر حفظ بيانات الزيارة والروشتة الطبية. لم يتم إنهاء الكشف، يرجى إعادة المحاولة.');
        return; // لن نغير حالة الحجز مطلقاً
      }

      // 3. فقط بعد نجاح حفظ الزيارة يتم تحديث حالة الحجز إلى "مكتمل"
      try {
        await completeDoctorExamination(appointmentId, combinedClinicalSummary, savedVisit.id, userRole);
      } catch (completeAptErr) {
        console.error('[DoctorExaminationScreen - خطأ في تحديث حالة الحجز]:', completeAptErr);
        setIsCompleting(false);
        showToast(completeAptErr.message || 'تم حفظ الزيارة ولكن تعذر تحديث حالة الحجز إلى مكتمل. يرجى مراجعة الاتصال.');
        return;
      }

      showToast('تم إنهاء الكشف واعتماد الزيارة والروشتة بنجاح! ✓');

      setTimeout(() => {
        if (onComplete) onComplete();
      }, 700);
    } catch (err) {
      console.error('[DoctorExaminationScreen - تعذر إنهاء الكشف]:', err);
      showToast('تعذر إنهاء الكشف، يرجى المحاولة ثانية.');
      setIsCompleting(false);
    }
  };

  // معالجة تغيير حقول العلامات الحيوية
  const handleVitalChange = (field, value) => {
    setVitals((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="doctor-exam-screen-container" dir="rtl">
        <div className="skeleton-bar skeleton-bar--panel-title mb-4" />
        <div className="skeleton-metric-card p-6 mb-4" />
        <div className="skeleton-dashboard-panel p-6" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="doctor-exam-screen-container" dir="rtl">
        <div className="state-feedback-card state-feedback-card--empty" style={{ margin: '3rem auto', maxWidth: '600px' }}>
          <div className="state-feedback-icon state-feedback-icon--error">
            <AlertCircleIcon size={32} />
          </div>
          <h3 className="state-feedback-title">تعذر تحميل شاشة الكشف الطبي</h3>
          <p className="state-feedback-message">{loadError}</p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={loadData}
              className="btn-action-primary"
            >
              <RefreshCwIcon size={16} />
              <span>إعادة المحاولة</span>
            </button>
            <button
              type="button"
              onClick={onBack}
              className="btn-action-secondary"
            >
              <span>العودة لجدول اليوم</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const patientFullName = patient?.full_name || 'مريض غير محدد';
  const patientAge = calculateAge(patient?.date_of_birth);
  const patientGender = patient?.gender || 'غير محدد';
  const patientAllergies = patient?.chronic_diseases_allergies || null;

  return (
    <div className="doctor-exam-screen-container" dir="rtl">
      {/* الشريط العلوي للتحكم وزري الحفظ والعودة */}
      <div className="doctor-exam-header-bar">
        <div className="doctor-exam-header-title-box">
          <button
            type="button"
            onClick={onBack}
            className="btn-back-to-queue"
            title="العودة لقائمة مواعيد اليوم"
          >
            <ArrowRightIcon size={18} />
            <span>العودة لقائمة المواعيد</span>
          </button>

          <div className="doctor-exam-main-title">
            <h1 className="exam-heading">غرفة الكشف الطبي السريري</h1>
            <span className="exam-live-badge">
              <span className="live-status-dot-pulse" aria-hidden="true" />
              داخل الكشف الآن 🩺
            </span>
          </div>
        </div>

        {/* أزرار الإجراء مع حماية النقر المزدوج ومؤشر التحميل */}
        <div className="doctor-exam-header-actions">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isDraftSaving || isCompleting}
            className="btn-exam-action btn-exam-action--draft"
            title="حفظ ما تم تدوينه كمسودة دون إنهاء الموعد"
          >
            {isDraftSaving ? (
              <span>جاري الحفظ...</span>
            ) : (
              <>
                <span>💾</span>
                <span>حفظ مسودة</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleCompleteExam}
            disabled={isDraftSaving || isCompleting}
            className="btn-exam-action btn-exam-action--complete"
            title="إنهاء الكشف الطبي واعتماد الزيارة"
          >
            {isCompleting ? (
              <span>جاري الاعتماد...</span>
            ) : (
              <>
                <CheckCircleIcon size={18} />
                <span>إنهاء الكشف ✓</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ٢ — بطاقة المريض الموجزة (Patient Brief Card) */}
      <section className="patient-brief-summary-card" aria-label="بيانات المريض الأساسية">
        <div className="patient-brief-main-row">
          <div className="patient-brief-identity">
            <div className="patient-avatar-circle" aria-hidden="true">
              {patientFullName.charAt(0)}
            </div>
            <div>
              <div className="patient-name-id-row">
                <h2 className="patient-brief-name">{patientFullName}</h2>
                <span className="patient-id-badge font-numeric">
                  معرّف المريض: #{String(patientId).replace('pat-', '')}
                </span>
                <span className="appointment-id-badge font-numeric">
                  معرّف الحجز: #{String(appointmentId).replace('apt-', '')}
                </span>
              </div>
              <p className="patient-brief-submeta">
                نوع الزيارة: <strong>{appointment?.visit_type || 'كشف عيادة'}</strong> • الهاتف:{' '}
                <span className="font-numeric" dir="ltr">{patient?.phone || '—'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* شبكة البيانات الحيوية الموجزة للمريض */}
        <div className="patient-brief-grid">
          <div className="brief-item">
            <span className="brief-item-label">العمر:</span>
            <strong className="brief-item-val font-numeric">{patientAge}</strong>
          </div>

          <div className="brief-item">
            <span className="brief-item-label">النوع:</span>
            <strong className="brief-item-val">{patientGender}</strong>
          </div>

          <div className="brief-item">
            <span className="brief-item-label">فصيلة الدم:</span>
            <strong className="brief-item-val text-danger font-numeric">
              {patient?.blood_type || 'غير مسجلة'}
            </strong>
          </div>

          <div className="brief-item">
            <span className="brief-item-label">آخر زيارة:</span>
            <strong className="brief-item-val">
              {lastVisit ? (
                <span className="font-numeric">
                  {lastVisit.date} ({lastVisit.visitType})
                </span>
              ) : (
                <span className="badge-first-visit">زيارة أولى للعيادة</span>
              )}
            </strong>
          </div>
        </div>

        {/* تنبيه الحساسية والأمراض المزمنة إن وُجد */}
        {patientAllergies ? (
          <div className="patient-brief-allergy-alert" role="alert">
            <ShieldAlertIcon size={18} className="text-danger flex-shrink-0" />
            <div>
              <strong className="text-danger">الحساسية والأمراض المزمنة المسجلة:</strong>
              <span className="allergy-text-desc">{patientAllergies}</span>
            </div>
          </div>
        ) : (
          <div className="patient-brief-safe-notice">
            <span>لا توجد حساسية أو أمراض مزمنة مسجلة في ملف المريض.</span>
          </div>
        )}
      </section>

      {/* ٣ — الأقسام السريرية التسعة المنظمة (9 Clinical Sections) */}
      <div className="doctor-exam-sections-grid">
        {/* القسم 1: الشكوى الرئيسية (Chief Complaint) */}
        <div className="exam-section-card">
          <div className="exam-section-header">
            <span className="exam-section-badge">1</span>
            <div>
              <h3 className="exam-section-title">الشكوى الرئيسية (Chief Complaint)</h3>
              <p className="exam-section-desc">ما يشكو منه المريض بكلماته أو سبب الحضور للعيادة</p>
            </div>
          </div>
          <div className="exam-section-body">
            <textarea
              rows={2}
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="مثال: ألم متكرر في رأس المعدة مصحوب بحرقة وغثيان بعد تناول الوجبات..."
              className="exam-textarea"
            />
          </div>
        </div>

        {/* القسم 2: التاريخ المرضي الحالي (History of Present Illness - HPI) */}
        <div className="exam-section-card">
          <div className="exam-section-header">
            <span className="exam-section-badge">2</span>
            <div>
              <h3 className="exam-section-title">التاريخ المرضي الحالي (HPI)</h3>
              <p className="exam-section-desc">بداية الأعراض، شدتها، تطورها الزمني، والعوامل المحفزة أو المهدئة</p>
            </div>
          </div>
          <div className="exam-section-body">
            <textarea
              rows={3}
              value={historyOfPresentIllness}
              onChange={(e) => setHistoryOfPresentIllness(e.target.value)}
              placeholder="مثال: بدأت الأعراض منذ أسبوع وتزداد ليلاً، لا استجابة للمسكنات، مع فقدان طفيف للشهية..."
              className="exam-textarea"
            />
          </div>
        </div>

        {/* القسم 3: العلامات الحيوية الاختيارية (Vital Signs) */}
        <div className="exam-section-card">
          <div className="exam-section-header">
            <span className="exam-section-badge">3</span>
            <div>
              <h3 className="exam-section-title">العلامات الحيوية الاختيارية (Vital Signs)</h3>
              <p className="exam-section-desc">القياسات الفيزيولوجية الأولية للمريض</p>
            </div>
          </div>
          <div className="exam-section-body">
            <div className="vitals-inputs-grid">
              <div className="vital-input-box">
                <label className="vital-label">ضغط الدم (BP)</label>
                <div className="vital-field-wrap">
                  <input
                    type="text"
                    value={vitals.bloodPressure}
                    onChange={(e) => handleVitalChange('bloodPressure', e.target.value)}
                    placeholder="120/80"
                    className="vital-input font-numeric"
                    dir="ltr"
                  />
                  <span className="vital-unit">mmHg</span>
                </div>
              </div>

              <div className="vital-input-box">
                <label className="vital-label">النبض (Pulse)</label>
                <div className="vital-field-wrap">
                  <input
                    type="number"
                    value={vitals.heartRate}
                    onChange={(e) => handleVitalChange('heartRate', e.target.value)}
                    placeholder="75"
                    className="vital-input font-numeric"
                    dir="ltr"
                  />
                  <span className="vital-unit">bpm</span>
                </div>
              </div>

              <div className="vital-input-box">
                <label className="vital-label">درجة الحرارة</label>
                <div className="vital-field-wrap">
                  <input
                    type="text"
                    value={vitals.temperature}
                    onChange={(e) => handleVitalChange('temperature', e.target.value)}
                    placeholder="37.0"
                    className="vital-input font-numeric"
                    dir="ltr"
                  />
                  <span className="vital-unit">°C</span>
                </div>
              </div>

              <div className="vital-input-box">
                <label className="vital-label">الوزن (Weight)</label>
                <div className="vital-field-wrap">
                  <input
                    type="number"
                    value={vitals.weight}
                    onChange={(e) => handleVitalChange('weight', e.target.value)}
                    placeholder="75"
                    className="vital-input font-numeric"
                    dir="ltr"
                  />
                  <span className="vital-unit">kg</span>
                </div>
              </div>

              <div className="vital-input-box">
                <label className="vital-label">نسبة الأكسجين (SpO2)</label>
                <div className="vital-field-wrap">
                  <input
                    type="number"
                    value={vitals.oxygenSaturation}
                    onChange={(e) => handleVitalChange('oxygenSaturation', e.target.value)}
                    placeholder="98"
                    className="vital-input font-numeric"
                    dir="ltr"
                  />
                  <span className="vital-unit">%</span>
                </div>
              </div>

              <div className="vital-input-box">
                <label className="vital-label">السكر العشوائي (RBS)</label>
                <div className="vital-field-wrap">
                  <input
                    type="number"
                    value={vitals.bloodSugar}
                    onChange={(e) => handleVitalChange('bloodSugar', e.target.value)}
                    placeholder="110"
                    className="vital-input font-numeric"
                    dir="ltr"
                  />
                  <span className="vital-unit">mg/dL</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* القسم 4: الفحص السريري (Physical Examination) */}
        <div className="exam-section-card">
          <div className="exam-section-header">
            <span className="exam-section-badge">4</span>
            <div>
              <h3 className="exam-section-title">الفحص السريري (Physical Examination)</h3>
              <p className="exam-section-desc">ملاحظات الكشف العضوي: فحص الصدر، البطن، المفاصل، أو الفحص الموضعي</p>
            </div>
          </div>
          <div className="exam-section-body">
            <textarea
              rows={3}
              value={physicalExam}
              onChange={(e) => setPhysicalExam(e.target.value)}
              placeholder="مثال: فحص البطن يظهر ألم بالضغط الخفيف في الشرسوف (Epigastrium)، الصدر سليم ولا توجد خشونة تنفسية..."
              className="exam-textarea"
            />
          </div>
        </div>

        {/* القسم 5: التشخيص المبدئي (Diagnosis) */}
        <div className="exam-section-card exam-section-card--highlight">
          <div className="exam-section-header">
            <span className="exam-section-badge exam-section-badge--primary">5</span>
            <div>
              <h3 className="exam-section-title">التشخيص (Clinical Diagnosis)</h3>
              <p className="exam-section-desc">التشخيص السريري المقدر أو التشخيص التفريقي (Differential Diagnosis)</p>
            </div>
          </div>
          <div className="exam-section-body">
            <textarea
              rows={2}
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="مثال: التهاب معوي حاد مع اشتباه قرحة هضمية (Gastritis / Peptic Ulcer)..."
              className="exam-textarea exam-textarea--bold"
            />
          </div>
        </div>

        {/* القسم 6: الخطة العلاجية والروشتة الطبية (Treatment Plan & Rx) */}
        <div className="exam-section-card exam-section-card--prescription">
          <div className="exam-section-header">
            <span className="exam-section-badge">6</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h3 className="exam-section-title">الروشتة الطبية والخطة العلاجية (Rx & Treatment Plan)</h3>
                  <p className="exam-section-desc">إضافة الأدوية الموصوفة، الجرعات، التكرار، المدة، والتعليمات الصيدلانية</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(true)}
                  className="btn-print-rx-preview"
                  title="معاينة وطباعة الروشتة الطبية للعيادة"
                >
                  <span>🖨️ معاينة وطباعة الروشتة</span>
                </button>
              </div>
            </div>
          </div>

          <div className="exam-section-body">
            {/* جدول / مكرر بنود الأدوية */}
            <div className="rx-medications-container">
              <div className="rx-medications-header-row">
                <h4 className="rx-medications-heading">
                  <span>💊 قائمة الأدوية الموصوفة</span>
                  <span className="rx-items-count font-numeric">{prescriptionItems.length} أدوية</span>
                </h4>
                <button
                  type="button"
                  onClick={handleAddMedication}
                  className="btn-add-medication"
                >
                  <span>+ إضافة دواء للروشتة</span>
                </button>
              </div>

              {prescriptionItems.length === 0 ? (
                <div className="rx-empty-state">
                  <p className="rx-empty-text">لم يتم إضافة أدوية للروشتة حتى الآن.</p>
                  <button
                    type="button"
                    onClick={handleAddMedication}
                    className="rx-empty-btn"
                  >
                    + إضافة أول دواء للروشتة
                  </button>
                </div>
              ) : (
                <div className="rx-items-list">
                  {prescriptionItems.map((med, idx) => (
                    <div key={med.id || idx} className="rx-item-card">
                      <div className="rx-item-index font-numeric">#{idx + 1}</div>
                      <div className="rx-item-fields-grid">
                        <div className="rx-field-group rx-field-group--name">
                          <label className="rx-field-label">اسم الدواء *</label>
                          <input
                            type="text"
                            value={med.medication_name}
                            onChange={(e) => handleUpdateMedication(med.id, 'medication_name', e.target.value)}
                            placeholder="مثال: Amoxicillin / أوجمنتين"
                            className="rx-input rx-input--bold"
                          />
                        </div>

                        <div className="rx-field-group">
                          <label className="rx-field-label">التركيز</label>
                          <input
                            type="text"
                            value={med.strength}
                            onChange={(e) => handleUpdateMedication(med.id, 'strength', e.target.value)}
                            placeholder="مثال: 500 مجم / 1 جم"
                            className="rx-input"
                          />
                        </div>

                        <div className="rx-field-group">
                          <label className="rx-field-label">الجرعة</label>
                          <input
                            type="text"
                            value={med.dose}
                            onChange={(e) => handleUpdateMedication(med.id, 'dose', e.target.value)}
                            placeholder="مثال: قرص واحد / ملعقة"
                            className="rx-input"
                          />
                        </div>

                        <div className="rx-field-group">
                          <label className="rx-field-label">التكرار</label>
                          <input
                            type="text"
                            value={med.frequency}
                            onChange={(e) => handleUpdateMedication(med.id, 'frequency', e.target.value)}
                            placeholder="مثال: كل 12 ساعة / 3 مرات"
                            className="rx-input"
                          />
                        </div>

                        <div className="rx-field-group">
                          <label className="rx-field-label">المدة</label>
                          <input
                            type="text"
                            value={med.duration}
                            onChange={(e) => handleUpdateMedication(med.id, 'duration', e.target.value)}
                            placeholder="مثال: 7 أيام / أسبوعين"
                            className="rx-input"
                          />
                        </div>

                        <div className="rx-field-group rx-field-group--instructions">
                          <label className="rx-field-label">تعليمات الاستخدام</label>
                          <input
                            type="text"
                            value={med.instructions}
                            onChange={(e) => handleUpdateMedication(med.id, 'instructions', e.target.value)}
                            placeholder="مثال: بعد الأكل مباشرة مع وفرة من الماء"
                            className="rx-input"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveMedication(med.id)}
                        className="btn-remove-medication"
                        title="حذف هذا الدواء من الروشتة"
                        aria-label="حذف الدواء"
                      >
                        <CloseIcon size={16} />
                        <span>حذف</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* الخطة العلاجية والتعليمات الإضافية */}
            <div style={{ marginTop: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                تعليمات ونصائح علاجية عامة للمريض (اختياري):
              </label>
              <textarea
                rows={3}
                value={treatmentPlan}
                onChange={(e) => setTreatmentPlan(e.target.value)}
                placeholder="مثال: تجنب المأكولات الحارة والمسبكة، الإكثار من شرب السوائل الدافئة والراحة التامة..."
                className="exam-textarea"
              />
            </div>
          </div>
        </div>

        {/* القسم 7: طلبات الفحوصات والتحاليل (Investigations) */}
        <div className="exam-section-card">
          <div className="exam-section-header">
            <span className="exam-section-badge">7</span>
            <div>
              <h3 className="exam-section-title">طلبات الفحوصات والتحاليل والأشعة</h3>
              <p className="exam-section-desc">الفحوصات المخبرية أو الأشعة المطلوبة لإكمال التشخيص</p>
            </div>
          </div>
          <div className="exam-section-body">
            <textarea
              rows={2}
              value={labInvestigations}
              onChange={(e) => setLabInvestigations(e.target.value)}
              placeholder="مثال: صورة دم كاملة (CBC)، تحليل جرثومة المعدة بالبراز (H. Pylori Stool Ag)، سونار بطن وحوض..."
              className="exam-textarea"
            />
          </div>
        </div>

        {/* القسم 8: ملاحظات الطبيب وتوصياته (Doctor Notes & Advice) */}
        <div className="exam-section-card">
          <div className="exam-section-header">
            <span className="exam-section-badge">8</span>
            <div>
              <h3 className="exam-section-title">ملاحظات الطبيب وإرشادات نمط الحياة</h3>
              <p className="exam-section-desc">النصائح الغذائية والوقائية الموجهة للمريض</p>
            </div>
          </div>
          <div className="exam-section-body">
            <textarea
              rows={2}
              value={doctorNotes}
              onChange={(e) => setDoctorNotes(e.target.value)}
              placeholder="مثال: تجنب الأطعمة الحارة والمقليات والمشروبات الغازية، الالتزام بالراحة وتناول وجبات خفيفة مقسمة..."
              className="exam-textarea"
            />
          </div>
        </div>

        {/* القسم 9: موعد المتابعة (Follow-up) */}
        <div className="exam-section-card">
          <div className="exam-section-header">
            <span className="exam-section-badge">9</span>
            <div>
              <h3 className="exam-section-title">موعد المتابعة (Follow-up)</h3>
              <p className="exam-section-desc">الفترة المقترحة لإعادة الكشف أو مراجعة نتائج الفحوصات</p>
            </div>
          </div>
          <div className="exam-section-body">
            <div className="followup-controls-row">
              <div className="followup-timeframe-selector">
                {['لا يحتاج متابعة', 'بعد أسبوع', 'بعد أسبوعين', 'بعد شهر', 'تاريخ محدد'].map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setFollowUpTimeframe(tf)}
                    className={`btn-followup-pill ${followUpTimeframe === tf ? 'btn-followup-pill--active' : ''}`}
                  >
                    {tf}
                  </button>
                ))}
              </div>

              {followUpTimeframe === 'تاريخ محدد' && (
                <div className="followup-custom-date-box">
                  <label htmlFor="followup-date-input" className="form-label-inline">
                    تاريخ المتابعة المحدد:
                  </label>
                  <input
                    id="followup-date-input"
                    type="date"
                    value={followUpCustomDate}
                    onChange={(e) => setFollowUpCustomDate(e.target.value)}
                    className="form-input font-numeric"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* الشريط السفلي للتأكيد وحفظ المسودة أو إنهاء الكشف */}
      <footer className="doctor-exam-bottom-bar">
        <button
          type="button"
          onClick={onBack}
          className="btn-cancel"
          disabled={isDraftSaving || isCompleting}
        >
          العودة لقائمة المواعيد
        </button>

        <div className="doctor-exam-bottom-actions">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isDraftSaving || isCompleting}
            className="btn-exam-action btn-exam-action--draft"
          >
            {isDraftSaving ? 'جاري الحفظ...' : 'حفظ مسودة الكشف 💾'}
          </button>

          <button
            type="button"
            onClick={handleCompleteExam}
            disabled={isDraftSaving || isCompleting}
            className="btn-exam-action btn-exam-action--complete"
          >
            {isCompleting ? 'جاري الاعتماد...' : 'إنهاء الكشف واعتماد الزيارة ✓'}
          </button>
        </div>
      </footer>

      {/* نافذة معاينة وطباعة الروشتة الطبية العربية */}
      {showPrintModal && (
        <div className="modal-backdrop rx-print-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="rx-print-modal-title">
          <div className="modal-container rx-print-modal-container">
            {/* شريط أدوات النافذة التفاعلي (يختفي أثناء الطباعة) */}
            <div className="rx-print-modal-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🖨️</span>
                <h3 id="rx-print-modal-title" style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--primary-dark, #0a1c33)' }}>
                  معاينة وطباعة الروشتة الطبية الرسمية
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn-action-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.25rem', fontSize: '0.92rem' }}
                >
                  <span>طباعة الروشتة 🖨️</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="modal-close-btn"
                  aria-label="إغلاق معاينة الطباعة"
                >
                  <CloseIcon size={20} />
                </button>
              </div>
            </div>

            {/* ورقة الروشتة المطبوعة (Medical Prescription Pad) */}
            <div className="prescription-printable-paper" dir="rtl">
              {/* ترويسة العيادة الرسمية */}
              <div className="rx-paper-header">
                <div className="rx-clinic-brand">
                  <div className="rx-clinic-logo">🩺</div>
                  <div>
                    <h2 className="rx-clinic-name">عيادة الشفاء التخصصية</h2>
                    <p className="rx-clinic-sub">Al-Shifa Specialized Clinic</p>
                    <p className="rx-clinic-contact">الخط الساخن: 01000000000 • العنوان: شارع المثال - القاهرة</p>
                  </div>
                </div>

                <div className="rx-doctor-brand">
                  <h3 className="rx-doctor-name">
                    {appointment?.doctor_id ? (getDoctorById(appointment.doctor_id)?.name || 'د. أحمد محمود') : 'د. أحمد محمود'}
                  </h3>
                  <p className="rx-doctor-spec">
                    {appointment?.doctor_id ? (getDoctorById(appointment.doctor_id)?.specialty || 'استشاري باطنة وجهاز هضمي') : 'استشاري باطنة وجهاز هضمي'}
                  </p>
                  <p className="rx-doctor-reg">ترخيص مزاولة مهنة: <span className="font-numeric">2026/894</span></p>
                </div>
              </div>

              <div className="rx-paper-divider" />

              {/* بيانات المريض والزيارة */}
              <div className="rx-patient-meta-grid">
                <div className="rx-meta-item">
                  <span className="rx-meta-label">اسم المريض:</span>
                  <strong className="rx-meta-value">{patient?.full_name || '—'}</strong>
                </div>
                <div className="rx-meta-item">
                  <span className="rx-meta-label">السن:</span>
                  <span className="rx-meta-value font-numeric">{patient?.date_of_birth ? `${calculateAge(patient.date_of_birth)} سنة` : '—'}</span>
                </div>
                <div className="rx-meta-item">
                  <span className="rx-meta-label">النوع:</span>
                  <span className="rx-meta-value">{patient?.gender || '—'}</span>
                </div>
                <div className="rx-meta-item">
                  <span className="rx-meta-label">رقم الملف:</span>
                  <span className="rx-meta-value font-numeric">{patientId || '—'}</span>
                </div>
                <div className="rx-meta-item">
                  <span className="rx-meta-label">تاريخ الزيارة:</span>
                  <span className="rx-meta-value font-numeric">
                    {appointment?.appointment_date
                      ? appointment.appointment_date.split('T')[0]
                      : new Date().toISOString().split('T')[0]}
                  </span>
                </div>
                {patient?.chronic_diseases_allergies && (
                  <div className="rx-meta-item rx-meta-item--allergies" style={{ gridColumn: 'span 3' }}>
                    <span className="rx-meta-label" style={{ color: '#b91c1c' }}>تنبيه الحساسية:</span>
                    <span className="rx-meta-value" style={{ color: '#991b1b', fontWeight: 600 }}>
                      {patient.chronic_diseases_allergies}
                    </span>
                  </div>
                )}
                {diagnosis && (
                  <div className="rx-meta-item rx-meta-item--diagnosis" style={{ gridColumn: 'span 3' }}>
                    <span className="rx-meta-label">التشخيص الطبي:</span>
                    <strong className="rx-meta-value" style={{ color: 'var(--primary, #0f2b48)' }}>{diagnosis}</strong>
                  </div>
                )}
              </div>

              {/* جسم الروشتة وعلامة ℞ */}
              <div className="rx-paper-body">
                <div className="rx-symbol" aria-hidden="true">℞</div>

                {prescriptionItems.filter((m) => m.medication_name && m.medication_name.trim()).length === 0 ? (
                  <div className="rx-paper-empty">
                    لم يتم تسجيل أدوية في الروشتة حتى الآن.
                  </div>
                ) : (
                  <table className="rx-paper-table">
                    <thead>
                      <tr>
                        <th style={{ width: '6%' }}>م</th>
                        <th style={{ width: '32%' }}>الدواء والتركيز</th>
                        <th style={{ width: '16%' }}>الجرعة</th>
                        <th style={{ width: '16%' }}>التكرار</th>
                        <th style={{ width: '12%' }}>المدة</th>
                        <th style={{ width: '18%' }}>تعليمات الاستخدام</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prescriptionItems
                        .filter((m) => m.medication_name && m.medication_name.trim())
                        .map((med, index) => (
                          <tr key={med.id || index}>
                            <td className="font-numeric" style={{ textAlign: 'center', fontWeight: 700 }}>{index + 1}</td>
                            <td>
                              <strong className="rx-med-name">{med.medication_name}</strong>
                              {med.strength && <span className="rx-med-strength font-numeric"> ({med.strength})</span>}
                            </td>
                            <td>{med.dose || '—'}</td>
                            <td>{med.frequency || '—'}</td>
                            <td className="font-numeric">{med.duration || '—'}</td>
                            <td className="rx-med-instructions">{med.instructions || '—'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}

                {/* نصائح وتعليمات علاجية إضافية إن وُجدت */}
                {treatmentPlan && treatmentPlan.trim() && (
                  <div className="rx-paper-notes-box">
                    <strong style={{ display: 'block', marginBottom: '0.25rem', color: '#1e293b', fontSize: '0.9rem' }}>
                      تعليمات وتوجيهات إضافية:
                    </strong>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#334155', whiteSpace: 'pre-line' }}>
                      {treatmentPlan.trim()}
                    </p>
                  </div>
                )}

                {/* موعد المتابعة */}
                {followUpTimeframe && followUpTimeframe !== 'لا يحتاج متابعة' && (
                  <div className="rx-paper-followup-box">
                    <strong>موعد المتابعة والاستشارة القادمة: </strong>
                    <span>{followUpTimeframe}{followUpCustomDate ? ` بتاريخ: ${followUpCustomDate}` : ''}</span>
                  </div>
                )}
              </div>

              {/* تذييل الروشتة وتوقيع الطبيب */}
              <div className="rx-paper-footer">
                <div className="rx-paper-footer-notice">
                  نتمنى لكم دوام الصحة والعافية • يرجى مراجعة الصيدلي عند صرف الدواء
                </div>
                <div className="rx-paper-signature-box">
                  <div className="rx-signature-line">توقيع وختم الطبيب المعالج:</div>
                  <div className="rx-signature-dots">...................................................</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* إشعار تفاعلي سريع (Toast) */}
      {feedbackToast && (
        <div className="dashboard-toast" role="status" aria-live="polite">
          <span className="toast-dot" />
          <span>{feedbackToast}</span>
        </div>
      )}
    </div>
  );
}

export default DoctorExaminationScreen;
