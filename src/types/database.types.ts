export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_date: string
          created_at: string | null
          doctor_id?: string | null
          id: string
          notes: string | null
          patient_id: string
          status: string
          visit_type?: string | null
        }
        Insert: {
          appointment_date: string
          created_at?: string | null
          doctor_id?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          status?: string
          visit_type?: string | null
        }
        Update: {
          appointment_date?: string
          created_at?: string | null
          doctor_id?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          status?: string
          visit_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          issue_date: string
          patient_id: string
          status: string
        }
        Insert: {
          amount?: number
          created_at?: string | null
          id?: string
          issue_date?: string
          patient_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          issue_date?: string
          patient_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          created_at: string | null
          full_name: string
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string | null
          full_name: string
          id?: string
          phone?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: 'doctor' | 'secretary'
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role: 'doctor' | 'secretary'
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: 'doctor' | 'secretary'
          updated_at?: string | null
        }
        Relationships: []
      }
      visits: {
        Row: {
          appointment_id: string | null
          chief_complaint: string | null
          clinical_data: Json | null
          created_at: string | null
          diagnosis: string | null
          doctor_id: string
          id: string
          notes: string | null
          patient_id: string
          status: string
          treatment_plan: string | null
          updated_at: string | null
          visit_date: string
          vitals: Json | null
        }
        Insert: {
          appointment_id?: string | null
          chief_complaint?: string | null
          clinical_data?: Json | null
          created_at?: string | null
          diagnosis?: string | null
          doctor_id: string
          id?: string
          notes?: string | null
          patient_id: string
          status?: string
          treatment_plan?: string | null
          updated_at?: string | null
          visit_date?: string
          vitals?: Json | null
        }
        Update: {
          appointment_id?: string | null
          chief_complaint?: string | null
          clinical_data?: Json | null
          created_at?: string | null
          diagnosis?: string | null
          doctor_id?: string
          id?: string
          notes?: string | null
          patient_id?: string
          status?: string
          treatment_plan?: string | null
          updated_at?: string | null
          visit_date?: string
          vitals?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          appointment_id: string | null
          created_at: string | null
          doctor_id: string
          id: string
          items: Json
          notes: string | null
          patient_id: string
          updated_at: string | null
          visit_id: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string | null
          doctor_id: string
          id?: string
          items: Json
          notes?: string | null
          patient_id: string
          updated_at?: string | null
          visit_id: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string | null
          doctor_id?: string
          id?: string
          items?: Json
          notes?: string | null
          patient_id?: string
          updated_at?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: true
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
