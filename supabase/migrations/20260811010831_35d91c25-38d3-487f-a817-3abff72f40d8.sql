-- ============ roles ============
CREATE TYPE public.app_role AS ENUM ('patient','doctor','admin');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text,
  name text NOT NULL DEFAULT 'Patient',
  phone text,
  dob date,
  sex text,
  blood_type text,
  allergies text[] NOT NULL DEFAULT '{}',
  emergency_contact_name text,
  emergency_contact_relation text,
  emergency_contact_phone text,
  address text,
  assigned_doctor text,
  status text NOT NULL DEFAULT 'Active',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('doctor','admin'))
$$;

CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles insert self" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles admin delete" ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "roles read own or staff" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- auto profile + patient role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email,'patient'),'@',1)),
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'patient')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ doctors ============
CREATE TABLE public.doctors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  specialty text NOT NULL DEFAULT 'General Medicine',
  clinic text,
  bio text,
  rating numeric(2,1) NOT NULL DEFAULT 4.8,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.doctors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctors TO authenticated;
GRANT ALL ON public.doctors TO service_role;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doctors public read" ON public.doctors FOR SELECT USING (true);
CREATE POLICY "doctors admin write" ON public.doctors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ appointments ============
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  doctor_name text,
  department text,
  clinic text,
  appointment_date date NOT NULL,
  appointment_time text NOT NULL,
  status text NOT NULL DEFAULT 'Pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appt read" ON public.appointments FOR SELECT TO authenticated
  USING (patient_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "appt insert" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (patient_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "appt update" ON public.appointments FOR UPDATE TO authenticated
  USING (patient_id = auth.uid() OR public.is_staff(auth.uid()))
  WITH CHECK (patient_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "appt delete" ON public.appointments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- ============ queue ============
CREATE TABLE public.queue_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  queue_number text NOT NULL,
  department text,
  doctor_name text,
  clinic text,
  status text NOT NULL DEFAULT 'Waiting',
  estimated_wait_minutes integer,
  avg_service_minutes integer NOT NULL DEFAULT 12,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.queue_entries TO authenticated;
GRANT ALL ON public.queue_entries TO service_role;
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "queue read" ON public.queue_entries FOR SELECT TO authenticated
  USING (patient_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "queue staff write" ON public.queue_entries FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ encounters + clinical records ============
CREATE TABLE public.encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  doctor_name text,
  department text,
  encounter_date date NOT NULL DEFAULT CURRENT_DATE,
  chief_complaint text,
  summary text,
  history_of_present_illness text,
  treatment_provided text,
  follow_up_recommendations text,
  encounter_notes text,
  diagnosis text,
  status text NOT NULL DEFAULT 'Finalized',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.encounters TO authenticated;
GRANT ALL ON public.encounters TO service_role;
ALTER TABLE public.encounters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enc read" ON public.encounters FOR SELECT TO authenticated
  USING (patient_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "enc staff write" ON public.encounters FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.soap_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  subjective text, objective text, assessment text, plan text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.vital_signs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  blood_pressure text, heart_rate integer, temperature numeric(4,1),
  respiratory_rate integer, oxygen_saturation integer,
  weight_kg numeric(5,1), height_cm numeric(5,1),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.encounter_diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  code text, description text NOT NULL, category text, status text NOT NULL DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  name text NOT NULL, code text, notes text,
  performed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid REFERENCES public.encounters(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  drug text NOT NULL, dosage text, frequency text, duration text, instructions text,
  prescribed_by text, status text NOT NULL DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid REFERENCES public.encounters(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  test_name text NOT NULL, result text, unit text, reference_range text,
  status text NOT NULL DEFAULT 'Normal', resulted_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.imaging_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid REFERENCES public.encounters(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  modality text NOT NULL, body_part text, findings text, impression text,
  image_url text, taken_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['soap_notes','vital_signs','encounter_diagnoses','procedures'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated; GRANT ALL ON public.%I TO service_role; ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t, t, t);
    EXECUTE format($p$CREATE POLICY "%1$s read" ON public.%1$I FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.encounters e WHERE e.id = encounter_id AND e.patient_id = auth.uid()));$p$, t);
    EXECUTE format($p$CREATE POLICY "%1$s staff write" ON public.%1$I FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));$p$, t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['prescriptions','lab_results','imaging_records'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated; GRANT ALL ON public.%I TO service_role; ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t, t, t);
    EXECUTE format($p$CREATE POLICY "%1$s read" ON public.%1$I FOR SELECT TO authenticated USING (patient_id = auth.uid() OR public.is_staff(auth.uid()));$p$, t);
    EXECUTE format($p$CREATE POLICY "%1$s staff write" ON public.%1$I FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));$p$, t);
  END LOOP;
END $$;

-- ============ insurance ============
CREATE TABLE public.insurance_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  provider text NOT NULL DEFAULT 'SugboDoc Insurance',
  description text,
  monthly_premium numeric(12,2) NOT NULL DEFAULT 0,
  annual_premium numeric(12,2) NOT NULL DEFAULT 0,
  coverage_limit numeric(12,2) NOT NULL DEFAULT 0,
  coverage_percentage integer NOT NULL DEFAULT 60,
  validity_months integer NOT NULL DEFAULT 12,
  benefits text[] NOT NULL DEFAULT '{}',
  provider_rating numeric(2,1) NOT NULL DEFAULT 4.5,
  provider_members integer NOT NULL DEFAULT 0,
  provider_about text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.insurance_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_plans TO authenticated;
GRANT ALL ON public.insurance_plans TO service_role;
ALTER TABLE public.insurance_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans public read" ON public.insurance_plans FOR SELECT USING (true);
CREATE POLICY "plans admin write" ON public.insurance_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.insurance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.insurance_plans(id) ON DELETE SET NULL,
  policy_number text NOT NULL,
  status text NOT NULL DEFAULT 'Pending',
  billing_cycle text NOT NULL DEFAULT 'annual',
  premium_amount numeric(12,2) NOT NULL DEFAULT 0,
  coverage_limit numeric(12,2) NOT NULL DEFAULT 0,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_policies TO authenticated;
GRANT ALL ON public.insurance_policies TO service_role;
ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "policy read" ON public.insurance_policies FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "policy insert own" ON public.insurance_policies FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "policy admin update" ON public.insurance_policies FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ store ============
CREATE TABLE public.store_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, address text, hours text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, description text, category text NOT NULL DEFAULT 'General',
  price numeric(12,2) NOT NULL DEFAULT 0, stock integer NOT NULL DEFAULT 0,
  reorder_level integer NOT NULL DEFAULT 20, supplier text, brand text, image_url text,
  rating numeric(2,1) NOT NULL DEFAULT 4.5, review_count integer NOT NULL DEFAULT 0,
  prescription_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.store_branches TO anon;
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_branches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.store_branches TO service_role;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.store_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branches public read" ON public.store_branches FOR SELECT USING (true);
CREATE POLICY "branches admin write" ON public.store_branches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "products public read" ON public.products FOR SELECT USING (true);
CREATE POLICY "products staff write" ON public.products FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_no text NOT NULL,
  fulfillment_type text NOT NULL DEFAULT 'pickup',
  pickup_branch uuid REFERENCES public.store_branches(id) ON DELETE SET NULL,
  delivery_address text,
  delivery_fee numeric(12,2) NOT NULL DEFAULT 0,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Pending',
  payment_status text NOT NULL DEFAULT 'Pending',
  tracking_no text, estimated_delivery text,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL, brand text,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  line_total numeric(12,2) NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders read" ON public.orders FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "orders insert own" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "orders update" ON public.orders FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "order items read" ON public.order_items FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "order items insert" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "order items staff write" ON public.order_items FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ billing ============
CREATE TABLE public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invoice_no text NOT NULL,
  description text, category text NOT NULL DEFAULT 'Consultation',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Pending',
  payment_method text,
  due_date date,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bill_id uuid REFERENCES public.bills(id) ON DELETE SET NULL,
  description text, amount numeric(12,2) NOT NULL DEFAULT 0,
  method text, status text NOT NULL DEFAULT 'Paid',
  transaction_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bills TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.bills TO service_role;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bills read" ON public.bills FOR SELECT TO authenticated
  USING (patient_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "bills staff write" ON public.bills FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "payments read" ON public.payments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "payments insert own" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "payments staff update" ON public.payments FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ messaging + notifications ============
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  doctor_name text, specialty text,
  sender text NOT NULL DEFAULT 'patient',
  text text, file_name text,
  read boolean NOT NULL DEFAULT false,
  sms_status text, sms_to text, sms_from text, sms_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL, message text, kind text NOT NULL DEFAULT 'general',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.messages TO service_role;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages read" ON public.messages FOR SELECT TO authenticated
  USING (patient_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "messages insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK ((patient_id = auth.uid() AND sender = 'patient') OR public.is_staff(auth.uid()));
CREATE POLICY "messages update" ON public.messages FOR UPDATE TO authenticated
  USING (patient_id = auth.uid() OR public.is_staff(auth.uid()))
  WITH CHECK (patient_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "notif read" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "notif write" ON public.notifications FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE INDEX ON public.appointments (patient_id);
CREATE INDEX ON public.encounters (patient_id);
CREATE INDEX ON public.messages (patient_id, created_at);
CREATE INDEX ON public.orders (user_id);
CREATE INDEX ON public.bills (patient_id);