export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole = "patient" | "doctor" | "admin";

export type Database = {
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_date: string;
          appointment_time: string;
          clinic: string | null;
          created_at: string;
          department: string | null;
          doctor_id: string | null;
          doctor_name: string | null;
          id: string;
          notes: string | null;
          patient_id: string;
          status: string;
        };
        Insert: {
          appointment_date: string;
          appointment_time: string;
          clinic?: string | null;
          created_at?: string;
          department?: string | null;
          doctor_id?: string | null;
          doctor_name?: string | null;
          id?: string;
          notes?: string | null;
          patient_id: string;
          status?: string;
        };
        Update: {
          appointment_date?: string;
          appointment_time?: string;
          clinic?: string | null;
          created_at?: string;
          department?: string | null;
          doctor_id?: string | null;
          doctor_name?: string | null;
          id?: string;
          notes?: string | null;
          patient_id?: string;
          status?: string;
        };
      };
      bills: {
        Row: {
          amount: number;
          category: string;
          created_at: string;
          description: string | null;
          due_date: string | null;
          id: string;
          invoice_no: string;
          paid_at: string | null;
          patient_id: string;
          payment_method: string | null;
          status: string;
        };
        Insert: {
          amount?: number;
          category?: string;
          created_at?: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          invoice_no: string;
          paid_at?: string | null;
          patient_id: string;
          payment_method?: string | null;
          status?: string;
        };
        Update: {
          amount?: number;
          category?: string;
          created_at?: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          invoice_no?: string;
          paid_at?: string | null;
          patient_id?: string;
          payment_method?: string | null;
          status?: string;
        };
      };
      doctors: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          clinic: string | null;
          created_at: string;
          id: string;
          name: string;
          rating: number;
          specialty: string;
          user_id: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          clinic?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          rating?: number;
          specialty?: string;
          user_id?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          clinic?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          rating?: number;
          specialty?: string;
          user_id?: string | null;
        };
      };
      encounter_diagnoses: {
        Row: {
          code: string | null;
          created_at: string;
          description: string;
          encounter_id: string;
          id: string;
          type: string;
        };
        Insert: {
          code?: string | null;
          created_at?: string;
          description: string;
          encounter_id: string;
          id?: string;
          type?: string;
        };
        Update: {
          code?: string | null;
          created_at?: string;
          description?: string;
          encounter_id?: string;
          id?: string;
          type?: string;
        };
      };
      encounters: {
        Row: {
          appointment_id: string | null;
          created_at: string;
          department: string | null;
          doctor_id: string | null;
          doctor_name: string | null;
          encounter_date: string;
          encounter_notes: string | null;
          id: string;
          patient_id: string;
          status: string;
          summary: string | null;
          type: string;
        };
        Insert: {
          appointment_id?: string | null;
          created_at?: string;
          department?: string | null;
          doctor_id?: string | null;
          doctor_name?: string | null;
          encounter_date?: string;
          encounter_notes?: string | null;
          id?: string;
          patient_id: string;
          status?: string;
          summary?: string | null;
          type?: string;
        };
        Update: {
          appointment_id?: string | null;
          created_at?: string;
          department?: string | null;
          doctor_id?: string | null;
          doctor_name?: string | null;
          encounter_date?: string;
          encounter_notes?: string | null;
          id?: string;
          patient_id?: string;
          status?: string;
          summary?: string | null;
          type?: string;
        };
      };
      imaging_records: {
        Row: {
          body_part: string;
          category: string;
          clinic: string | null;
          created_at: string;
          date: string;
          doctor: string | null;
          encounter_id: string | null;
          file_name: string | null;
          id: string;
          modality: string;
          patient_id: string;
          results: string | null;
          status: string;
          summary: string | null;
        };
        Insert: {
          body_part: string;
          category?: string;
          clinic?: string | null;
          created_at?: string;
          date?: string;
          doctor?: string | null;
          encounter_id?: string | null;
          file_name?: string | null;
          id?: string;
          modality: string;
          patient_id: string;
          results?: string | null;
          status?: string;
          summary?: string | null;
        };
        Update: {
          body_part?: string;
          category?: string;
          clinic?: string | null;
          created_at?: string;
          date?: string;
          doctor?: string | null;
          encounter_id?: string | null;
          file_name?: string | null;
          id?: string;
          modality?: string;
          patient_id?: string;
          results?: string | null;
          status?: string;
          summary?: string | null;
        };
      };
      insurance_plans: {
        Row: {
          co_pay_percent: number;
          coverage_limit: number;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          monthly_premium: number;
          provider: string;
          type: string;
        };
        Insert: {
          co_pay_percent?: number;
          coverage_limit?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          monthly_premium?: number;
          provider: string;
          type?: string;
        };
        Update: {
          co_pay_percent?: number;
          coverage_limit?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          monthly_premium?: number;
          provider?: string;
          type?: string;
        };
      };
      insurance_policies: {
        Row: {
          co_pay_percent: number;
          coverage_limit: number;
          created_at: string;
          end_date: string | null;
          id: string;
          is_primary: boolean;
          patient_id: string;
          plan_id: string | null;
          plan_name: string;
          policy_number: string;
          provider: string;
          start_date: string;
          status: string;
        };
        Insert: {
          co_pay_percent?: number;
          coverage_limit?: number;
          created_at?: string;
          end_date?: string | null;
          id?: string;
          is_primary?: boolean;
          patient_id: string;
          plan_id?: string | null;
          plan_name: string;
          policy_number: string;
          provider: string;
          start_date?: string;
          status?: string;
        };
        Update: {
          co_pay_percent?: number;
          coverage_limit?: number;
          created_at?: string;
          end_date?: string | null;
          id?: string;
          is_primary?: boolean;
          patient_id?: string;
          plan_id?: string | null;
          plan_name?: string;
          policy_number?: string;
          provider?: string;
          start_date?: string;
          status?: string;
        };
      };
      lab_results: {
        Row: {
          category: string;
          clinic: string | null;
          created_at: string;
          date: string;
          doctor: string | null;
          encounter_id: string | null;
          id: string;
          interpretation: string | null;
          notes: string | null;
          patient_id: string;
          reference_range: string | null;
          status: string;
          test_name: string;
          unit: string | null;
          value: string;
        };
        Insert: {
          category?: string;
          clinic?: string | null;
          created_at?: string;
          date?: string;
          doctor?: string | null;
          encounter_id?: string | null;
          id?: string;
          interpretation?: string | null;
          notes?: string | null;
          patient_id: string;
          reference_range?: string | null;
          status?: string;
          test_name: string;
          unit?: string | null;
          value: string;
        };
        Update: {
          category?: string;
          clinic?: string | null;
          created_at?: string;
          date?: string;
          doctor?: string | null;
          encounter_id?: string | null;
          id?: string;
          interpretation?: string | null;
          notes?: string | null;
          patient_id?: string;
          reference_range?: string | null;
          status?: string;
          test_name?: string;
          unit?: string | null;
          value?: string;
        };
      };
      messages: {
        Row: {
          created_at: string;
          doctor_id: string | null;
          doctor_name: string | null;
          file_name: string | null;
          id: string;
          patient_id: string;
          read: boolean;
          sender: string;
          sms_error: string | null;
          sms_from: string | null;
          sms_status: string | null;
          sms_to: string | null;
          specialty: string | null;
          text: string | null;
        };
        Insert: {
          created_at?: string;
          doctor_id?: string | null;
          doctor_name?: string | null;
          file_name?: string | null;
          id?: string;
          patient_id: string;
          read?: boolean;
          sender?: string;
          sms_error?: string | null;
          sms_from?: string | null;
          sms_status?: string | null;
          sms_to?: string | null;
          specialty?: string | null;
          text?: string | null;
        };
        Update: {
          created_at?: string;
          doctor_id?: string | null;
          doctor_name?: string | null;
          file_name?: string | null;
          id?: string;
          patient_id?: string;
          read?: boolean;
          sender?: string;
          sms_error?: string | null;
          sms_from?: string | null;
          sms_status?: string | null;
          sms_to?: string | null;
          specialty?: string | null;
          text?: string | null;
        };
      };
      notifications: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          message: string | null;
          read: boolean;
          title: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind?: string;
          message?: string | null;
          read?: boolean;
          title: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          message?: string | null;
          read?: boolean;
          title?: string;
          user_id?: string;
        };
      };
      order_items: {
        Row: {
          brand: string | null;
          id: string;
          line_total: number;
          order_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
        };
        Insert: {
          brand?: string | null;
          id?: string;
          line_total?: number;
          order_id: string;
          product_id?: string | null;
          product_name: string;
          quantity?: number;
          unit_price?: number;
        };
        Update: {
          brand?: string | null;
          id?: string;
          line_total?: number;
          order_id?: string;
          product_id?: string | null;
          product_name?: string;
          quantity?: number;
          unit_price?: number;
        };
      };
      orders: {
        Row: {
          created_at: string;
          delivery_address: string | null;
          delivery_fee: number;
          estimated_delivery: string | null;
          fulfillment_type: string;
          id: string;
          order_no: string;
          payment_status: string;
          pickup_branch: string | null;
          received_at: string | null;
          status: string;
          subtotal: number;
          total: number;
          tracking_no: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          delivery_address?: string | null;
          delivery_fee?: number;
          estimated_delivery?: string | null;
          fulfillment_type?: string;
          id?: string;
          order_no: string;
          payment_status?: string;
          pickup_branch?: string | null;
          received_at?: string | null;
          status?: string;
          subtotal?: number;
          total?: number;
          tracking_no?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          delivery_address?: string | null;
          delivery_fee?: number;
          estimated_delivery?: string | null;
          fulfillment_type?: string;
          id?: string;
          order_no?: string;
          payment_status?: string;
          pickup_branch?: string | null;
          received_at?: string | null;
          status?: string;
          subtotal?: number;
          total?: number;
          tracking_no?: string | null;
          user_id?: string;
        };
      };
      payments: {
        Row: {
          amount: number;
          bill_id: string | null;
          created_at: string;
          description: string | null;
          id: string;
          method: string | null;
          status: string;
          transaction_id: string | null;
          user_id: string;
        };
        Insert: {
          amount?: number;
          bill_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          method?: string | null;
          status?: string;
          transaction_id?: string | null;
          user_id: string;
        };
        Update: {
          amount?: number;
          bill_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          method?: string | null;
          status?: string;
          transaction_id?: string | null;
          user_id?: string;
        };
      };
      prescriptions: {
        Row: {
          created_at: string;
          doctor_id: string | null;
          doctor_name: string | null;
          dosage: string;
          encounter_id: string | null;
          end_date: string | null;
          frequency: string;
          id: string;
          instructions: string | null;
          medication: string;
          patient_id: string;
          refills: number;
          start_date: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          doctor_id?: string | null;
          doctor_name?: string | null;
          dosage: string;
          encounter_id?: string | null;
          end_date?: string | null;
          frequency: string;
          id?: string;
          instructions?: string | null;
          medication: string;
          patient_id: string;
          refills?: number;
          start_date?: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          doctor_id?: string | null;
          doctor_name?: string | null;
          dosage?: string;
          encounter_id?: string | null;
          end_date?: string | null;
          frequency?: string;
          id?: string;
          instructions?: string | null;
          medication?: string;
          patient_id?: string;
          refills?: number;
          start_date?: string;
          status?: string;
        };
      };
      procedures: {
        Row: {
          category: string;
          code: string | null;
          created_at: string;
          encounter_id: string;
          id: string;
          name: string;
          notes: string | null;
          status: string;
        };
        Insert: {
          category?: string;
          code?: string | null;
          created_at?: string;
          encounter_id: string;
          id?: string;
          name: string;
          notes?: string | null;
          status?: string;
        };
        Update: {
          category?: string;
          code?: string | null;
          created_at?: string;
          encounter_id?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          status?: string;
        };
      };
      products: {
        Row: {
          brand: string | null;
          category: string;
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          name: string;
          prescription_required: boolean;
          price: number;
          rating: number;
          reorder_level: number;
          review_count: number;
          stock: number;
          supplier: string | null;
        };
        Insert: {
          brand?: string | null;
          category?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          name: string;
          prescription_required?: boolean;
          price?: number;
          rating?: number;
          reorder_level?: number;
          review_count?: number;
          stock?: number;
          supplier?: string | null;
        };
        Update: {
          brand?: string | null;
          category?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          name?: string;
          prescription_required?: boolean;
          price?: number;
          rating?: number;
          reorder_level?: number;
          review_count?: number;
          stock?: number;
          supplier?: string | null;
        };
      };
      profiles: {
        Row: {
          address: string | null;
          allergies: string[];
          assigned_doctor: string | null;
          blood_type: string | null;
          created_at: string;
          dob: string | null;
          email: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          emergency_contact_relation: string | null;
          id: string;
          is_demo: boolean;
          name: string;
          phone: string | null;
          sex: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          allergies?: string[];
          assigned_doctor?: string | null;
          blood_type?: string | null;
          created_at?: string;
          dob?: string | null;
          email?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          emergency_contact_relation?: string | null;
          id: string;
          is_demo?: boolean;
          name?: string;
          phone?: string | null;
          sex?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          allergies?: string[];
          assigned_doctor?: string | null;
          blood_type?: string | null;
          created_at?: string;
          dob?: string | null;
          email?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          emergency_contact_relation?: string | null;
          id?: string;
          is_demo?: boolean;
          name?: string;
          phone?: string | null;
          sex?: string | null;
          status?: string;
          updated_at?: string;
        };
      };
      queue_entries: {
        Row: {
          appointment_id: string | null;
          assigned_room: string | null;
          called_at: string | null;
          completed_at: string | null;
          created_at: string;
          doctor_id: string | null;
          doctor_name: string | null;
          estimated_wait_mins: number | null;
          id: string;
          patient_id: string;
          patient_name: string;
          queue_number: string;
          service_type: string;
          status: string;
        };
        Insert: {
          appointment_id?: string | null;
          assigned_room?: string | null;
          called_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          doctor_id?: string | null;
          doctor_name?: string | null;
          estimated_wait_mins?: number | null;
          id?: string;
          patient_id: string;
          patient_name: string;
          queue_number: string;
          service_type?: string;
          status?: string;
        };
        Update: {
          appointment_id?: string | null;
          assigned_room?: string | null;
          called_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          doctor_id?: string | null;
          doctor_name?: string | null;
          estimated_wait_mins?: number | null;
          id?: string;
          patient_id?: string;
          patient_name?: string;
          queue_number?: string;
          service_type?: string;
          status?: string;
        };
      };
      soap_notes: {
        Row: {
          assessment: string | null;
          created_at: string;
          encounter_id: string;
          id: string;
          objective: string | null;
          plan: string | null;
          subjective: string | null;
        };
        Insert: {
          assessment?: string | null;
          created_at?: string;
          encounter_id: string;
          id?: string;
          objective?: string | null;
          plan?: string | null;
          subjective?: string | null;
        };
        Update: {
          assessment?: string | null;
          created_at?: string;
          encounter_id?: string;
          id?: string;
          objective?: string | null;
          plan?: string | null;
          subjective?: string | null;
        };
      };
      store_branches: {
        Row: {
          address: string;
          city: string;
          contact_number: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          operating_hours: string | null;
        };
        Insert: {
          address: string;
          city?: string;
          contact_number?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          operating_hours?: string | null;
        };
        Update: {
          address?: string;
          city?: string;
          contact_number?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          operating_hours?: string | null;
        };
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: AppRole;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: AppRole;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: AppRole;
          user_id?: string;
        };
      };
      vital_signs: {
        Row: {
          blood_pressure: string | null;
          bmi: number | null;
          created_at: string;
          encounter_id: string;
          heart_rate: number | null;
          height_cm: number | null;
          id: string;
          oxygen_saturation: number | null;
          recorded_at: string;
          respiratory_rate: number | null;
          temperature: number | null;
          weight_kg: number | null;
        };
        Insert: {
          blood_pressure?: string | null;
          bmi?: number | null;
          created_at?: string;
          encounter_id: string;
          heart_rate?: number | null;
          height_cm?: number | null;
          id?: string;
          oxygen_saturation?: number | null;
          recorded_at?: string;
          respiratory_rate?: number | null;
          temperature?: number | null;
          weight_kg?: number | null;
        };
        Update: {
          blood_pressure?: string | null;
          bmi?: number | null;
          created_at?: string;
          encounter_id?: string;
          heart_rate?: number | null;
          height_cm?: number | null;
          id?: string;
          oxygen_saturation?: number | null;
          recorded_at?: string;
          respiratory_rate?: number | null;
          temperature?: number | null;
          weight_kg?: number | null;
        };
      };
    };
    Enums: {
      app_role: AppRole;
    };
  };
};
