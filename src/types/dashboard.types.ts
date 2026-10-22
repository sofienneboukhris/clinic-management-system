// ============================================================================
// تعريفات TypeScript الخاصة بصفحة لوحة التحكم (Dashboard Types)
// ============================================================================

export type AppointmentStatus =
  | 'مؤكد'
  | 'في الانتظار'
  | 'مكتمل'
  | 'ملغي'
  | 'يحتاج إلى متابعة';

export type PaymentStatus =
  | 'مدفوعة'
  | 'مدفوعة جزئيًا'
  | 'غير مدفوعة'
  | 'متأخرة';

export type VisitType =
  | 'كشف جديد'
  | 'متابعة'
  | 'استشارة'
  | 'إعادة كشف';

export type StatColorScheme = 'blue' | 'indigo' | 'emerald' | 'amber';

export interface StatCardData {
  id: string;
  title: string;
  value: string;
  unit?: string;
  subtitle: string;
  colorScheme: StatColorScheme;
  iconName: 'calendar' | 'users' | 'credit-card' | 'alert-circle';
}

export interface Appointment {
  id: string;
  patientName: string;
  time: string;
  date: string;
  visitType: VisitType;
  status: AppointmentStatus;
  doctorNotes?: string;
  phone?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  patientName: string;
  issueDate: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  visitType?: VisitType;
}

export interface DashboardData {
  stats: StatCardData[];
  appointments: Appointment[];
  invoices: Invoice[];
  todayFormattedDate: string;
}
