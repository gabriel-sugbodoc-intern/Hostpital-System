--
-- PostgreSQL database dump
--

\restrict hSHQlky6MXMQSYMnYLWS4ARbOGH5TxjWmqWEnvqc3djAnZrrftAtXmd6Z7PQjVh

-- Dumped from database version 18.6 (Debian 18.6-1.pgdg13+2)
-- Dumped by pg_dump version 18.4 (Homebrew)

-- Started on 2026-09-02 13:17:17 PST

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 6 (class 2615 OID 16393)
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- TOC entry 7 (class 2615 OID 17018)
-- Name: private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA private;


--
-- TOC entry 887 (class 1247 OID 16407)
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'patient',
    'doctor',
    'admin'
);


--
-- TOC entry 251 (class 1255 OID 17692)
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )
$$;


--
-- TOC entry 248 (class 1255 OID 17021)
-- Name: handle_new_user(); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- TOC entry 250 (class 1255 OID 17019)
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;


--
-- TOC entry 247 (class 1255 OID 17020)
-- Name: is_staff(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.is_staff(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('doctor','admin'))
$$;


--
-- TOC entry 246 (class 1255 OID 16446)
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT private.has_role(_user_id, _role)
$$;


--
-- TOC entry 249 (class 1255 OID 16447)
-- Name: is_staff(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_staff(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT private.is_staff(_user_id)
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 221 (class 1259 OID 16395)
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- TOC entry 225 (class 1259 OID 16473)
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id text DEFAULT md5(((random())::text || (clock_timestamp())::text)) NOT NULL,
    patient_id text NOT NULL,
    doctor_id text,
    doctor_name text,
    department text,
    clinic text,
    appointment_date date NOT NULL,
    appointment_time text NOT NULL,
    status text DEFAULT 'Pending'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 241 (class 1259 OID 16905)
-- Name: bills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bills (
    id text DEFAULT md5(((random())::text || (clock_timestamp())::text)) NOT NULL,
    patient_id text NOT NULL,
    invoice_no text NOT NULL,
    description text,
    category text DEFAULT 'Consultation'::text NOT NULL,
    amount double precision DEFAULT 0 NOT NULL,
    status text DEFAULT 'Pending'::text NOT NULL,
    payment_method text,
    due_date date,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 245 (class 1259 OID 18005)
-- Name: cart_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cart_items (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    user_id text NOT NULL,
    product_id text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    variant jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cart_items_quantity_check CHECK ((quantity > 0))
);


--
-- TOC entry 224 (class 1259 OID 16455)
-- Name: doctors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctors (
    id text DEFAULT md5(((random())::text || (clock_timestamp())::text)) NOT NULL,
    user_id text,
    name text NOT NULL,
    specialty text DEFAULT 'General Medicine'::text NOT NULL,
    clinic text,
    bio text,
    rating double precision DEFAULT 4.8 NOT NULL,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 230 (class 1259 OID 16597)
-- Name: encounter_diagnoses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.encounter_diagnoses (
    id text DEFAULT md5(((random())::text || (clock_timestamp())::text)) NOT NULL,
    encounter_id text NOT NULL,
    code text,
    description text NOT NULL,
    category text,
    status text DEFAULT 'Active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    type text DEFAULT 'Primary'::text NOT NULL
);


--
-- TOC entry 227 (class 1259 OID 16533)
-- Name: encounters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.encounters (
    id text DEFAULT md5(((random())::text || (clock_timestamp())::text)) NOT NULL,
    patient_id text NOT NULL,
    doctor_id text,
    doctor_name text,
    department text,
    encounter_date date DEFAULT CURRENT_DATE NOT NULL,
    chief_complaint text,
    summary text,
    history_of_present_illness text,
    treatment_provided text,
    follow_up_recommendations text,
    encounter_notes text,
    diagnosis text,
    status text DEFAULT 'Finalized'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    appointment_id text,
    type text DEFAULT 'Outpatient Consultation'::text NOT NULL
);


--
-- TOC entry 234 (class 1259 OID 16685)
-- Name: imaging_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imaging_records (
    id text DEFAULT md5(((random())::text || (clock_timestamp())::text)) NOT NULL,
    encounter_id text,
    patient_id text NOT NULL,
    modality text NOT NULL,
    body_part text,
    findings text,
    impression text,
    image_url text,
    taken_at timestamp with time zone DEFAULT now() NOT NULL,
    category text DEFAULT 'Radiology'::text NOT NULL,
    clinic text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    date date,
    doctor text,
    file_name text,
    results text,
    status text DEFAULT 'Completed'::text NOT NULL,
    summary text
);


--
-- TOC entry 235 (class 1259 OID 16722)
-- Name: insurance_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insurance_plans (
    id text DEFAULT md5(((random())::text || (clock_timestamp())::text)) NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    provider text DEFAULT 'SugboDoc Insurance'::text NOT NULL,
    description text,
    monthly_premium double precision DEFAULT 0 NOT NULL,
    annual_premium double precision DEFAULT 0 NOT NULL,
    coverage_limit double precision DEFAULT 0 NOT NULL,
    coverage_percentage integer DEFAULT 60 NOT NULL,
    validity_months integer DEFAULT 12 NOT NULL,
    benefits text[] DEFAULT '{}'::text[] NOT NULL,
    provider_rating double precision DEFAULT 4.5 NOT NULL,
    provider_members integer DEFAULT 0 NOT NULL,
    provider_about text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    type text DEFAULT 'Comprehensive HMO'::text NOT NULL,
    category text,
    co_pay_percent double precision DEFAULT 0 NOT NULL,
    tag text,
    provider_hotline text,
    provider_website text,
    provider_email text,
    eligibility jsonb DEFAULT '[]'::jsonb NOT NULL,
    waiting_period text,
    exclusions jsonb DEFAULT '[]'::jsonb NOT NULL,
    included_services jsonb DEFAULT '[]'::jsonb NOT NULL,
    maximum_claims integer DEFAULT 0 NOT NULL,
    renewal_policy text,
    terms_and_conditions text,
    faqs jsonb DEFAULT '[]'::jsonb NOT NULL,
    logo_url text,
    card_image_url text,
    is_active boolean DEFAULT true NOT NULL
);


--
-- TOC entry 236 (class 1259 OID 16759)
-- Name: insurance_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.insurance_policies (
    id text DEFAULT md5(((random())::text || (clock_timestamp())::text)) NOT NULL,
    user_id text NOT NULL,
    plan_id text,
    policy_number text NOT NULL,
    status text DEFAULT 'Pending'::text NOT NULL,
    billing_cycle text DEFAULT 'annual'::text NOT NULL,
    premium_amount double precision DEFAULT 0 NOT NULL,
    coverage_limit double precision DEFAULT 0 NOT NULL,
    start_date date DEFAULT CURRENT_DATE NOT NULL,
    end_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    patient_id text,
    plan_name text DEFAULT ''::text NOT NULL,
    provider text DEFAULT ''::text NOT NULL,
    co_pay_percent double precision DEFAULT 0 NOT NULL,
    remaining_coverage double precision DEFAULT 0 NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    payment_status text DEFAULT 'Paid'::text NOT NULL
);


--
-- TOC entry 233 (class 1259 OID 16660)
-- Name: lab_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lab_results (
    id text DEFAULT md5(((random())::text || (clock_timestamp())::text)) NOT NULL,
    encounter_id text,
    patient_id text NOT NULL,
    test_name text NOT NULL,
    result text,
    unit text,
    reference_range text,
    status text DEFAULT 'Normal'::text NOT NULL,
    resulted_at timestamp with time zone DEFAULT now() NOT NULL,
    category text DEFAULT 'Laboratory'::text NOT NULL,
    clinic text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    date date,
    doctor text,
    interpretation text,
    notes text,
    value text
);


--
-- TOC entry 243 (class 1259 OID 16960)
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id text DEFAULT md5(((random())::text || (clock_timestamp())::text)) NOT NULL,
    patient_id text NOT NULL,
    doctor_id text,
    doctor_name text,
    specialty text,
    sender text DEFAULT 'patient'::text NOT NULL,
    text text,
    file_name text,
    read boolean DEFAULT false NOT NULL,
    sms_status text,
    sms_to text,
    sms_from text,
    sms_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 244 (class 1259 OID 16986)
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id text DEFAULT md5(((random())::text || (clock_timestamp())::text)) NOT NULL,
    user_id text NOT NULL,
    title text NOT NULL,
    message text,
    kind text DEFAULT 'general'::text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 240 (class 1259 OID 16872)
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id text DEFAULT md5(((random())::text || (clock_timestamp())::text)) NOT NULL,
    order_id text NOT NULL,
    product_id text,
    product_name text NOT NULL,
    brand text,
    unit_price double precision DEFAULT 0 NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    line_total double precision DEFAULT 0 NOT NULL
);


--
-- TOC entry 239 (class 1259 OID 16837)
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id text DEFAULT md5(((random())::text || (clock_timestamp())::text)) NOT NULL,
    user_id text NOT NULL,
    order_no text NOT NULL,
    fulfillment_type text DEFAULT 'pickup'::text NOT NULL,
    pickup_branch text,
    delivery_address text,
    delivery_fee double precision DEFAULT 0 NOT NULL,
    subtotal double precision DEFAULT 0 NOT NULL,
    total double precision DEFAULT 0 NOT NULL,
    status text DEFAULT 'Pending'::text NOT NULL,
    payment_status text DEFAULT 'Pending'::text NOT NULL,
    tracking_no text,
    estimated_delivery text,
    received_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 242 (class 1259 OID 16929)
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id text DEFAULT md5(((random())::text || (clock_timestamp())::text)) NOT NULL,
    user_id text NOT NULL,
    bill_id text,
    description text,
    amount double precision DEFAULT 0 NOT NULL,
    method text,
    status text DEFAULT 'Paid'::text NOT NULL,
    transaction_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 232 (class 1259 OID 16635)
-- Name: prescriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prescriptions (
    id text DEFAULT md5(((random())::text || (clock_timestamp())::text)) NOT NULL,
    encounter_id text,
    patient_id text NOT NULL,
    drug text,
    dosage text,
    frequency text,
    duration text,
    instructions text,
    prescribed_by text,
    status text DEFAULT 'Active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    doctor_id text,
    doctor_name text,
    end_date date,
    medication text DEFAULT ''::text NOT NULL,
    refills integer DEFAULT 0 NOT NULL,
    start_date date
);


--
-- TOC entry 231 (class 1259 OID 16617)
-- Name: procedures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.procedures (
    id text DEFAULT md5(((random())::text || (clock_timestamp())::text)) NOT NULL,
    encounter_id text NOT NULL,
    name text NOT NULL,
    code text,
    notes text,
    performed_at timestamp with time zone DEFAULT now() NOT NULL,
    category text DEFAULT 'Procedure'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'Completed'::text NOT NULL
);


--
-- TOC entry 238 (class 1259 OID 16807)
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id text DEFAULT md5(((random())::text || (clock_timestamp())::text)) NOT NULL,
    name text NOT NULL,
    description text,
    category text DEFAULT 'General'::text NOT NULL,
    price double precision DEFAULT 0 NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    reorder_level integer DEFAULT 20 NOT NULL,
    supplier text,
    brand text,
    image_url text,
    rating double precision DEFAULT 4.5 NOT NULL,
    review_count integer DEFAULT 0 NOT NULL,
    prescription_required boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 222 (class 1259 OID 16413)
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id text NOT NULL,
    email text,
    name text DEFAULT 'Patient'::text NOT NULL,
    phone text,
    dob date,
    sex text,
    blood_type text,
    allergies text[] DEFAULT '{}'::text[] NOT NULL,
    emergency_contact_name text,
    emergency_contact_relation text,
    emergency_contact_phone text,
    address text,
    assigned_doctor text,
    status text DEFAULT 'Active'::text NOT NULL,
    is_demo boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 226 (class 1259 OID 16503)
-- Name: queue_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.queue_entries (
    id text DEFAULT md5(((random())::text || (clock_timestamp())::text)) NOT NULL,
    patient_id text,
    appointment_id text,
    queue_number text NOT NULL,
    department text,
    doctor_name text,
    clinic text,
    status text DEFAULT 'Waiting'::text NOT NULL,
    estimated_wait_minutes integer,
    avg_service_minutes integer DEFAULT 12 NOT NULL,
    checked_in_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_room text,
    called_at timestamp with time zone,
    completed_at timestamp with time zone,
    doctor_id text,
    estimated_wait_mins integer,
    patient_name text DEFAULT ''::text NOT NULL,
    service_type text DEFAULT ''::text NOT NULL
);


--
-- TOC entry 228 (class 1259 OID 16563)
-- Name: soap_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.soap_notes (
    id text DEFAULT md5(((random())::text || (clock_timestamp())::text)) NOT NULL,
    encounter_id text NOT NULL,
    subjective text,
    objective text,
    assessment text,
    plan text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 237 (class 1259 OID 16795)
-- Name: store_branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_branches (
    id text DEFAULT md5(((random())::text || (clock_timestamp())::text)) NOT NULL,
    name text NOT NULL,
    address text,
    hours text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    city text DEFAULT ''::text NOT NULL,
    contact_number text,
    is_active boolean DEFAULT true NOT NULL,
    operating_hours text
);


--
-- TOC entry 223 (class 1259 OID 16433)
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id text DEFAULT md5(((random())::text || (clock_timestamp())::text)) NOT NULL,
    user_id text NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 229 (class 1259 OID 16580)
-- Name: vital_signs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vital_signs (
    id text DEFAULT md5(((random())::text || (clock_timestamp())::text)) NOT NULL,
    encounter_id text NOT NULL,
    blood_pressure text,
    heart_rate integer,
    temperature double precision,
    respiratory_rate integer,
    oxygen_saturation integer,
    weight_kg double precision,
    height_cm double precision,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    bmi double precision,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 3776 (class 0 OID 16395)
-- Dependencies: 221
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: -
--

COPY auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, raw_user_meta_data, created_at, updated_at) FROM stdin;
\.


--
-- TOC entry 3780 (class 0 OID 16473)
-- Dependencies: 225
-- Data for Name: appointments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.appointments (id, patient_id, doctor_id, doctor_name, department, clinic, appointment_date, appointment_time, status, notes, created_at) FROM stdin;
appt-101	patient-juan-cruz	doc-maria-santos	Dr. Maria Santos	Cardiology	Chong Hua Hospital, Medical Arts Bldg 402	2026-08-20	09:30 AM	Confirmed	Follow-up consultation for blood pressure management and ECG review.	2026-08-10 08:00:00+00
2c0befb1d193cab660a8709d6b709341	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	Chong Hua Hospital	2026-08-25	02:30 PM	Confirmed	\N	2026-08-24 15:10:45.498337+00
60852a7cc02770d3d747f39f6fb995e8	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	Chong Hua Hospital	2026-08-28	09:00 AM	Confirmed	\N	2026-08-25 02:14:23.435592+00
bf677040aaed7c57909987f172536dff	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	Chong Hua Hospital	2026-08-30	04:00 PM	Confirmed	\N	2026-08-25 02:16:58.140755+00
6e7e8142e4c210a9e2aa60e3a799aa42	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	Chong Hua Hospital	2026-08-30	04:00 PM	Confirmed	\N	2026-08-25 02:24:48.903452+00
0b37433b0fbdf7309a436a18eda14fd8	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	Chong Hua Hospital	2026-08-27	04:00 PM	Confirmed	\N	2026-08-25 02:22:16.187928+00
ab2d861dbcb107cf6caca072077e9a0a	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	Chong Hua Hospital	2026-08-31	04:00 PM	Confirmed	\N	2026-08-25 02:25:48.433046+00
e760599d5ba0ffa348062305f68afc3b	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	Chong Hua Hospital	2026-08-30	10:30 AM	Pending	\N	2026-08-25 02:41:11.786346+00
0b62aa1462da481a2babc20bd0311d53	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	Chong Hua Hospital	2026-08-26	10:30 AM	Pending	\N	2026-08-25 02:41:59.447829+00
d849606e1906e38fb75a90b6b853db23	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	Chong Hua Hospital	2026-08-25	10:30 AM	Pending	\N	2026-08-25 03:18:35.628087+00
e8b04e09508ae1180f6312ea7db1deed	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	Chong Hua Hospital	2026-08-26	04:00 PM	Pending	\N	2026-08-26 00:56:05.56945+00
3152ded558289cb0839e87f2851887c5	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	Chong Hua Hospital	2026-08-27	04:00 PM	Cancelled	\N	2026-08-26 01:08:05.165421+00
5e05655233b0ebbba88e38a99fa2a4e7	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	Chong Hua Hospital	2026-08-31	04:00 PM	Pending	\N	2026-08-26 01:09:54.882157+00
227c76eea30a03945789c00bd9b61a35	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	Chong Hua Hospital	2026-08-31	04:00 PM	Pending	\N	2026-08-26 01:15:35.076537+00
a33f528ca6b6433c356c1f8bef1152d2	user-mt9elmfg-bbsv	d1	Dr. Maria Santos	Internal Medicine	Chong Hua Hospital	2026-08-26	04:00 PM	Confirmed	\N	2026-08-26 01:17:39.654294+00
c7e5f23d42f6f960c287a1b122afb288	user-mt9elmfg-bbsv	d1	Dr. Maria Santos	Internal Medicine	Chong Hua Hospital	2026-08-31	10:30 AM	Pending	\N	2026-08-26 01:44:08.380635+00
4de174961d9e39e9ed439dc396980655	user-mt9elmfg-bbsv	d1	Dr. Maria Santos	Internal Medicine	Chong Hua Hospital	2026-08-31	09:00 AM	Pending	\N	2026-08-26 01:48:43.34303+00
a00ccef35c8b6f27bceb3b498ca5073c	user-mt9elmfg-bbsv	d1	Dr. Maria Santos	Internal Medicine	Chong Hua Hospital	2026-08-27	09:00 AM	Pending	\N	2026-08-26 02:58:48.165924+00
6ff788f7048b17a9286406d72891ac16	user-mt9j446q-o54y	d1	Dr. Maria Santos	Internal Medicine	Chong Hua Hospital	2026-08-26	09:00 AM	Pending	\N	2026-08-26 03:23:54.920948+00
appt-102	patient-juan-cruz	doc-john-cruz	Dr. John Cruz	General Medicine	Cebu Doctors' Hospital, Suite 215	2026-08-28	02:00 PM	Confirmed	Routine quarterly wellness assessment and fasting lipid profile review.	2026-08-12 10:30:00+00
\.


--
-- TOC entry 3796 (class 0 OID 16905)
-- Dependencies: 241
-- Data for Name: bills; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bills (id, patient_id, invoice_no, description, category, amount, status, payment_method, due_date, paid_at, created_at) FROM stdin;
bill-901	patient-juan-cruz	INV-2026-0801	Cardiology Outpatient Specialist Consultation & Vital Diagnostics	Consultation	1200	Paid	Stripe Card	2026-08-15	2026-08-01 10:15:00+00	2026-08-01 10:10:00+00
bill-902	patient-juan-cruz	INV-2026-0810	Complete Blood Chemistry Diagnostic Panel & Lipid Profile	Laboratory	1850	Pending	\N	2026-08-30	\N	2026-08-10 09:00:00+00
c85724c181f51e26ab1a1888d1c79464	user-mt7ddnsq-iflt	INV-63867	PhilHealth Standard Universal Coverage - Annual Premium (SD-PHILHEALTH-UNI-40037)	Insurance	5400	Paid	Stripe	\N	2026-08-25 01:15:09.953+00	2026-08-24 15:10:55.033714+00
49bb7fec80d9a3e034b335cc4daf3216	user-mt9elmfg-bbsv	INV-104274	Medical Store Order #ORD-104274	Medical Store	18	Pending	\N	2026-08-29	\N	2026-08-26 03:07:03.802382+00
16cc099574a07c0c79aca723ad47c2c2	user-mt9elmfg-bbsv	INV-517122	Medical Store Order #ORD-517122	Medical Store	58	Paid	Stripe Card	2026-08-29	2026-08-26 03:07:16.478+00	2026-08-26 03:07:15.272612+00
8817ac0920295e3d23fd9cc258ba7997	user-mt9elmfg-bbsv	INV-782243	Medical Store Order #ORD-782243	Medical Store	830	Paid	Stripe Card	2026-08-29	2026-08-26 03:07:42.486+00	2026-08-26 03:07:41.191404+00
1292068e337069350ed4f28a74972cd3	user-mt9j446q-o54y	INV-383767	Medical Store Order #ORD-383767	Medical Store	830	Paid	Stripe Card	2026-08-29	2026-08-26 03:28:05.386+00	2026-08-26 03:28:03.82246+00
91b628bbcd00940e7b67576fa6dafde0	user-mt9j446q-o54y	INV-715709	Medical Store Order #ORD-715709	Medical Store	790	Paid	Stripe	2026-08-29	2026-08-26 03:41:52+00	2026-08-26 03:41:26.520841+00
64e20eda5bb33398673c636ae0ffde65	user-mt9j446q-o54y	INV-631463	Medical Store Order #ORD-631463	Medical Store	2450	Paid	Stripe	2026-08-29	2026-08-26 03:42:23.883+00	2026-08-26 03:31:46.875828+00
def9c864c13df236ac42b319488cfed4	user-mt9j446q-o54y	INV-457615	Medical Store Order #ORD-457615	Medical Store	830	Paid	Stripe	2026-08-29	2026-08-26 06:16:10.922+00	2026-08-26 06:15:43.713336+00
1337666dbab58126b1bc66287bb4d771	user-mtcc8md2-i1nz	INV-779794	Medical Store Order #ORD-779794	Medical Store	830	Paid	Stripe	2026-08-31	2026-08-28 02:34:34.3+00	2026-08-28 02:34:24.222139+00
\.


--
-- TOC entry 3800 (class 0 OID 18005)
-- Dependencies: 245
-- Data for Name: cart_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cart_items (id, user_id, product_id, quantity, variant, created_at, updated_at) FROM stdin;
d35f2242-aa1d-4180-a413-8d5304c5f869	user-mtcc8md2-i1nz	prod-amoxicillin-500	2	{}	2026-08-28 02:34:47.105683+00	2026-08-28 02:34:47.105683+00
b22dda9a-eff4-4930-9aab-372b304297dc	user-mtcc8md2-i1nz	prod-cetirizine-10	2	{}	2026-08-28 02:34:47.140191+00	2026-08-28 02:34:47.140191+00
fbb5f1bf-cea0-4dba-952b-95da266c1c12	user-mtcc8md2-i1nz	prod-first-aid-kit	2	{}	2026-08-28 02:34:47.172761+00	2026-08-28 02:34:47.172761+00
\.


--
-- TOC entry 3779 (class 0 OID 16455)
-- Dependencies: 224
-- Data for Name: doctors; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.doctors (id, user_id, name, specialty, clinic, bio, rating, avatar_url, created_at) FROM stdin;
doc-maria-santos	user-doctor-maria	Dr. Maria Santos	Cardiology	Chong Hua Hospital, Medical Arts Bldg 402	Fellow of Philippine College of Cardiology. 15+ years managing hypertension, arrhythmias, and cardiovascular wellness.	4.9	https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&auto=format&fit=crop&q=80	2026-01-01 00:00:00+00
doc-john-cruz	user-doctor-john	Dr. John Cruz	General Physician	Cebu Doctors' Hospital, Suite 215	Primary care physician focusing on preventive health, lifestyle medicine, and routine outpatient consultations.	4.8	https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300&auto=format&fit=crop&q=80	2026-01-01 00:00:00+00
doc-angela-reyes	user-doctor-angela	Dr. Angela Reyes	Pediatrics	Perpetual Succour Hospital, Room 310	Board-certified pediatrician caring for infants, children, and adolescents with expertise in vaccinations and development.	4.9	https://images.unsplash.com/photo-1594824813590-7813a30c5e7d?w=300&auto=format&fit=crop&q=80	2026-01-01 00:00:00+00
doc-roberto-tan	user-doctor-roberto	Dr. Roberto Tan	Orthopedic Surgery	Chong Hua Hospital Mandaue, Rm 512	Specializing in sports injuries, joint preservation, fracture care, and musculoskeletal rehabilitation.	4.7	https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=300&auto=format&fit=crop&q=80	2026-01-01 00:00:00+00
doc-elena-lim	user-doctor-elena	Dr. Elena Lim	Dermatology	UC Med Hospital, Clinical Suite 108	Medical and cosmetic dermatology, eczema treatments, skin allergy testing, and acne therapy.	4.8	https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300&auto=format&fit=crop&q=80	2026-01-01 00:00:00+00
\.


--
-- TOC entry 3785 (class 0 OID 16597)
-- Dependencies: 230
-- Data for Name: encounter_diagnoses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.encounter_diagnoses (id, encounter_id, code, description, category, status, created_at, type) FROM stdin;
diag-501	enc-201	I10	Essential (primary) hypertension	\N	Active	2026-08-01 09:45:00+00	Primary
\.


--
-- TOC entry 3782 (class 0 OID 16533)
-- Dependencies: 227
-- Data for Name: encounters; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.encounters (id, patient_id, doctor_id, doctor_name, department, encounter_date, chief_complaint, summary, history_of_present_illness, treatment_provided, follow_up_recommendations, encounter_notes, diagnosis, status, created_at, updated_at, appointment_id, type) FROM stdin;
enc-201	patient-juan-cruz	doc-maria-santos	Dr. Maria Santos	Cardiology	2026-08-01	\N	Hypertension follow-up visit. Blood pressure well-controlled with Losartan 50mg daily.	\N	\N	\N	Patient reports no dizziness, chest pain, or palpitations. Continues daily brisk walking.	\N	Completed	2026-08-01 09:30:00+00	2026-08-24 08:23:45.651482+00	appt-101	Outpatient Consultation
b5e10603bf6d7da50d2d454ad75fd6d0	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	2026-08-25	Internal Medicine Appointment	Encounter for Appointment #2c0befb1 [APPT:2c0befb1d193cab660a8709d6b709341]	\N	\N	\N	[APPT:2c0befb1d193cab660a8709d6b709341] Linked Appointment ID: 2c0befb1d193cab660a8709d6b709341	\N	Pending Appointment	2026-08-24 15:10:45.549212+00	2026-08-24 15:10:45.549212+00	2c0befb1d193cab660a8709d6b709341	Outpatient Consultation
d6e700c92ba3be1152396ecdd6cf1dcb	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	2026-08-28	Internal Medicine Appointment	Encounter for Appointment #60852a7c [APPT:60852a7cc02770d3d747f39f6fb995e8]	\N	\N	\N	[APPT:60852a7cc02770d3d747f39f6fb995e8] Linked Appointment ID: 60852a7cc02770d3d747f39f6fb995e8	\N	Pending Appointment	2026-08-25 02:14:23.493025+00	2026-08-25 02:14:23.493025+00	60852a7cc02770d3d747f39f6fb995e8	Outpatient Consultation
1e03f737afbf6dc0ebcb51478cd04fc2	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	2026-08-30	Internal Medicine Appointment	Encounter for Appointment #bf677040 [APPT:bf677040aaed7c57909987f172536dff]	\N	\N	\N	[APPT:bf677040aaed7c57909987f172536dff] Linked Appointment ID: bf677040aaed7c57909987f172536dff	\N	Pending Appointment	2026-08-25 02:16:58.198844+00	2026-08-25 02:16:58.198844+00	bf677040aaed7c57909987f172536dff	Outpatient Consultation
10da972cacc6df53336d0d388f4045d3	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	2026-08-27	Internal Medicine Appointment	Encounter for Appointment #0b37433b [APPT:0b37433b0fbdf7309a436a18eda14fd8]	\N	\N	\N	[APPT:0b37433b0fbdf7309a436a18eda14fd8] Linked Appointment ID: 0b37433b0fbdf7309a436a18eda14fd8	\N	Pending Appointment	2026-08-25 02:22:16.268255+00	2026-08-25 02:22:16.268255+00	0b37433b0fbdf7309a436a18eda14fd8	Outpatient Consultation
e74df20dd682fe69c6ba16f7b4427d8a	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	2026-08-30	Internal Medicine Appointment	Encounter for Appointment #6e7e8142 [APPT:6e7e8142e4c210a9e2aa60e3a799aa42]	\N	\N	\N	[APPT:6e7e8142e4c210a9e2aa60e3a799aa42] Linked Appointment ID: 6e7e8142e4c210a9e2aa60e3a799aa42	\N	Pending Appointment	2026-08-25 02:24:48.98924+00	2026-08-25 02:24:48.98924+00	6e7e8142e4c210a9e2aa60e3a799aa42	Outpatient Consultation
00e7b794928c80727642ceb9793e602f	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	2026-08-31	Internal Medicine Appointment	Encounter for Appointment #ab2d861d [APPT:ab2d861dbcb107cf6caca072077e9a0a]	\N	\N	\N	[APPT:ab2d861dbcb107cf6caca072077e9a0a] Linked Appointment ID: ab2d861dbcb107cf6caca072077e9a0a	\N	Pending Appointment	2026-08-25 02:25:48.501585+00	2026-08-25 02:25:48.501585+00	ab2d861dbcb107cf6caca072077e9a0a	Outpatient Consultation
7d86850f3da334bf3f3fd80ad4f56a6c	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	2026-08-30	Internal Medicine Appointment	Encounter for Appointment #e760599d [APPT:e760599d5ba0ffa348062305f68afc3b]	\N	\N	\N	[APPT:e760599d5ba0ffa348062305f68afc3b] Linked Appointment ID: e760599d5ba0ffa348062305f68afc3b	\N	Pending Appointment	2026-08-25 02:41:11.866762+00	2026-08-25 02:41:11.866762+00	e760599d5ba0ffa348062305f68afc3b	Outpatient Consultation
df0c39fba12ca8d8db5eeb22a28216ac	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	2026-08-26	Internal Medicine Appointment	Encounter for Appointment #0b62aa14 [APPT:0b62aa1462da481a2babc20bd0311d53]	\N	\N	\N	[APPT:0b62aa1462da481a2babc20bd0311d53] Linked Appointment ID: 0b62aa1462da481a2babc20bd0311d53	\N	Pending Appointment	2026-08-25 02:41:59.523117+00	2026-08-25 02:41:59.523117+00	0b62aa1462da481a2babc20bd0311d53	Outpatient Consultation
e6b83cd3a2f3e854db21e7e8b792167d	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	2026-08-25	Internal Medicine Appointment	Encounter for Appointment #d849606e [APPT:d849606e1906e38fb75a90b6b853db23]	\N	\N	\N	[APPT:d849606e1906e38fb75a90b6b853db23] Linked Appointment ID: d849606e1906e38fb75a90b6b853db23	\N	Pending Appointment	2026-08-25 03:18:35.689575+00	2026-08-25 03:18:35.689575+00	d849606e1906e38fb75a90b6b853db23	Outpatient Consultation
799afb41fda5d9d3a2375444ecf3975e	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	2026-08-26	Internal Medicine Appointment	Encounter for Appointment #e8b04e09 [APPT:e8b04e09508ae1180f6312ea7db1deed]	\N	\N	\N	[APPT:e8b04e09508ae1180f6312ea7db1deed] Linked Appointment ID: e8b04e09508ae1180f6312ea7db1deed	\N	Pending Appointment	2026-08-26 00:56:05.677875+00	2026-08-26 00:56:05.677875+00	e8b04e09508ae1180f6312ea7db1deed	Outpatient Consultation
acc21e33f5a9aa82456b5f65db42274a	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	2026-08-27	Internal Medicine Appointment	Encounter for Appointment #3152ded5 [APPT:3152ded558289cb0839e87f2851887c5]	\N	\N	\N	[APPT:3152ded558289cb0839e87f2851887c5] Linked Appointment ID: 3152ded558289cb0839e87f2851887c5	\N	Pending Appointment	2026-08-26 01:08:05.236832+00	2026-08-26 01:08:05.236832+00	3152ded558289cb0839e87f2851887c5	Outpatient Consultation
a7982c983021ea637edb93b138d457c3	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	2026-08-31	Internal Medicine Appointment	Encounter for Appointment #5e056552 [APPT:5e05655233b0ebbba88e38a99fa2a4e7]	\N	\N	\N	[APPT:5e05655233b0ebbba88e38a99fa2a4e7] Linked Appointment ID: 5e05655233b0ebbba88e38a99fa2a4e7	\N	Pending Appointment	2026-08-26 01:09:54.954971+00	2026-08-26 01:09:54.954971+00	5e05655233b0ebbba88e38a99fa2a4e7	Outpatient Consultation
063718728191de2a8ff3071b4852edd0	user-mt7ddnsq-iflt	d1	Dr. Maria Santos	Internal Medicine	2026-08-31	Internal Medicine Appointment	Encounter for Appointment #227c76ee [APPT:227c76eea30a03945789c00bd9b61a35]	\N	\N	\N	[APPT:227c76eea30a03945789c00bd9b61a35] Linked Appointment ID: 227c76eea30a03945789c00bd9b61a35	\N	Pending Appointment	2026-08-26 01:15:35.181351+00	2026-08-26 01:15:35.181351+00	227c76eea30a03945789c00bd9b61a35	Outpatient Consultation
580f08bc990763b9016277d8b9477556	user-mt9elmfg-bbsv	d1	Dr. Maria Santos	Internal Medicine	2026-08-26	Internal Medicine Appointment	Encounter for Appointment #a33f528c [APPT:a33f528ca6b6433c356c1f8bef1152d2]	\N	\N	\N	[APPT:a33f528ca6b6433c356c1f8bef1152d2] Linked Appointment ID: a33f528ca6b6433c356c1f8bef1152d2	\N	Pending Appointment	2026-08-26 01:17:39.726008+00	2026-08-26 01:17:39.726008+00	a33f528ca6b6433c356c1f8bef1152d2	Outpatient Consultation
9aa06ad6916db34be019594a297db79a	user-mt9elmfg-bbsv	d1	Dr. Maria Santos	Internal Medicine	2026-08-31	Internal Medicine Appointment	Encounter for Appointment #c7e5f23d [APPT:c7e5f23d42f6f960c287a1b122afb288]	\N	\N	\N	[APPT:c7e5f23d42f6f960c287a1b122afb288] Linked Appointment ID: c7e5f23d42f6f960c287a1b122afb288	\N	Pending Appointment	2026-08-26 01:44:08.489829+00	2026-08-26 01:44:08.489829+00	c7e5f23d42f6f960c287a1b122afb288	Outpatient Consultation
bab87c45223d5b187f66271b418354ce	user-mt9elmfg-bbsv	d1	Dr. Maria Santos	Internal Medicine	2026-08-31	Internal Medicine Appointment	Encounter for Appointment #4de17496 [APPT:4de174961d9e39e9ed439dc396980655]	\N	\N	\N	[APPT:4de174961d9e39e9ed439dc396980655] Linked Appointment ID: 4de174961d9e39e9ed439dc396980655	\N	Pending Appointment	2026-08-26 01:48:43.412999+00	2026-08-26 01:48:43.412999+00	4de174961d9e39e9ed439dc396980655	Outpatient Consultation
daa8fd9fa77de440eeea9fe2b574f9f5	user-mt9elmfg-bbsv	d1	Dr. Maria Santos	Internal Medicine	2026-08-27	Internal Medicine Appointment	Encounter for Appointment #a00ccef3 [APPT:a00ccef35c8b6f27bceb3b498ca5073c]	\N	\N	\N	[APPT:a00ccef35c8b6f27bceb3b498ca5073c] Linked Appointment ID: a00ccef35c8b6f27bceb3b498ca5073c	\N	Pending Appointment	2026-08-26 02:58:48.295797+00	2026-08-26 02:58:48.295797+00	a00ccef35c8b6f27bceb3b498ca5073c	Outpatient Consultation
697dd177159007686c60a8919382c7d0	user-mt9j446q-o54y	d1	Dr. Maria Santos	Internal Medicine	2026-08-26	Internal Medicine Appointment	Encounter for Appointment #6ff788f7 [APPT:6ff788f7048b17a9286406d72891ac16]	\N	\N	\N	[APPT:6ff788f7048b17a9286406d72891ac16] Linked Appointment ID: 6ff788f7048b17a9286406d72891ac16	\N	Pending Appointment	2026-08-26 03:23:55.02675+00	2026-08-26 03:23:55.02675+00	6ff788f7048b17a9286406d72891ac16	Outpatient Consultation
4c4afe376fcf82865d31f00d7b43657a	patient-juan-cruz	doc-john-cruz	Dr. John Cruz	General Medicine	2026-08-28	Routine quarterly wellness assessment and fasting lipid profile review.	Encounter for Appointment #appt-102 [APPT:appt-102]	\N	\N	\N	[APPT:appt-102] Linked Appointment ID: appt-102	\N	In Progress	2026-08-28 01:37:39.38656+00	2026-08-28 01:37:39.38656+00	appt-102	Outpatient Consultation
df6a2d494bc65b16691df0704b4b9de1	patient-juan-cruz	doc-john-cruz	Dr. John Cruz	General Medicine	2026-08-28	Routine quarterly wellness assessment and fasting lipid profile review.	Encounter for Appointment #appt-102 [APPT:appt-102]	\N	\N	\N	[APPT:appt-102] Linked Appointment ID: appt-102	\N	In Progress	2026-08-28 01:38:20.022886+00	2026-08-28 01:38:20.022886+00	appt-102	Outpatient Consultation
2f2ed343372f8f4176b02e34e395d829	patient-juan-cruz	doc-john-cruz	Dr. John Cruz	General Medicine	2026-08-28	Routine quarterly wellness assessment and fasting lipid profile review.	Encounter for Appointment #appt-102 [APPT:appt-102]	\N	\N	\N	[APPT:appt-102] Linked Appointment ID: appt-102	\N	In Progress	2026-08-28 01:42:45.127376+00	2026-08-28 01:42:45.127376+00	appt-102	Outpatient Consultation
5d986a96e30391e307699df4b45d26f5	patient-juan-cruz	doc-john-cruz	Dr. John Cruz	General Medicine	2026-08-28	Routine quarterly wellness assessment and fasting lipid profile review.	Encounter for Appointment #appt-102 [APPT:appt-102]	\N	\N	\N	[APPT:appt-102] Linked Appointment ID: appt-102	\N	In Progress	2026-08-28 01:43:00.062243+00	2026-08-28 01:43:00.062243+00	appt-102	Outpatient Consultation
f137712912eb300509c6059bd6a2302f	patient-juan-cruz	doc-john-cruz	Dr. John Cruz	General Medicine	2026-08-28	Routine quarterly wellness assessment and fasting lipid profile review.	Encounter for Appointment #appt-102 [APPT:appt-102]	\N	\N	\N	[APPT:appt-102] Linked Appointment ID: appt-102	\N	In Progress	2026-08-28 01:45:52.329154+00	2026-08-28 01:45:52.329154+00	appt-102	Outpatient Consultation
22df1a72f19aa4ff0b5ee6bae69dea89	patient-juan-cruz	doc-john-cruz	Dr. John Cruz	General Medicine	2026-08-28	Routine quarterly wellness assessment and fasting lipid profile review.	Encounter for Appointment #appt-102 [APPT:appt-102]	\N	\N	\N	[APPT:appt-102] Linked Appointment ID: appt-102	\N	In Progress	2026-08-28 01:46:07.293215+00	2026-08-28 01:46:07.293215+00	appt-102	Outpatient Consultation
\.


--
-- TOC entry 3789 (class 0 OID 16685)
-- Dependencies: 234
-- Data for Name: imaging_records; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.imaging_records (id, encounter_id, patient_id, modality, body_part, findings, impression, image_url, taken_at, category, clinic, created_at, date, doctor, file_name, results, status, summary) FROM stdin;
img-801	enc-201	patient-juan-cruz	X-Ray	Chest PA View	\N	\N	\N	2026-08-24 08:23:45.656814+00	Radiology	Cebu Doctors' Imaging Center	2026-07-15 14:00:00+00	2026-07-15	Dr. Maria Santos	chest-xray.svg	No active pulmonary infiltrates, consolidation, or pleural effusion noted. Bony cage and soft tissues unremarkable.	Completed	Clear lung fields bilaterally. Normal cardiac silhouette and cardiothoracic ratio.
\.


--
-- TOC entry 3790 (class 0 OID 16722)
-- Dependencies: 235
-- Data for Name: insurance_plans; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.insurance_plans (id, code, name, provider, description, monthly_premium, annual_premium, coverage_limit, coverage_percentage, validity_months, benefits, provider_rating, provider_members, provider_about, active, created_at, type, category, co_pay_percent, tag, provider_hotline, provider_website, provider_email, eligibility, waiting_period, exclusions, included_services, maximum_claims, renewal_policy, terms_and_conditions, faqs, logo_url, card_image_url, is_active) FROM stdin;
plan-philhealth-universal	PHILHEALTH-UNI	PhilHealth Standard Universal Coverage	Philippine Health Insurance Corporation	Essential national inpatient, outpatient, and Z-benefit packages with accredited hospital admission across the Philippines.	500	5400	500000	90	12	{"Inpatient hospitalization benefits and room & board subsidies","Outpatient blood transfusions, radiotherapy, and hemodialysis","PhilHealth Konsulta primary healthcare packages","Coverage for catastrophic illness (Z-Benefit package)","Maternity and newborn care packages"}	4.6	58000000	Philippine Health Insurance Corporation (PhilHealth) is the government-owned tax-exempt corporation attached to the Department of Health ensuring universal health coverage for all Filipinos.	t	2026-01-01 00:00:00+00	Universal Social Health	Universal Social Health	10	Government Mandate	+63 (02) 8441-7442	https://www.philhealth.gov.ph	actioncenter@philhealth.gov.ph	["All Filipino citizens residing locally or overseas", "Registered PhilHealth Identification Number (PIN)", "Formal economy, self-employed, or subsidized senior citizen members"]	Immediate emergency coverage; 30 days for routine elective admissions	["Cosmetic surgery and elective aesthetic modifications", "Non-prescription vitamins and unverified supplements", "Experimental therapies not recognized by the Department of Health"]	["Primary Care Physician Consultations", "Complete Blood Count (CBC) & Urinalysis", "Chest Radiography (X-Ray)", "Standard Hospital Room & Board", "Surgical Professional Fee Subsidy"]	24	Automatic continuous annual renewal through monthly or annual contributions.	Covered under RA 11223 (Universal Health Care Act). Subscriptions initiated via SugboDoc are linked to the national registry and validated upon instant Stripe checkout payment.	[{"answer": "Your PhilHealth policy is confirmed instantly in SugboDoc upon successful Stripe payment verification.", "question": "How quickly does coverage activate after Stripe payment?"}, {"answer": "Yes, all DOH-licensed private and public hospitals in Cebu honor accredited PhilHealth benefit claims.", "question": "Can I use this coverage at private hospitals in Cebu?"}]	https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=160&auto=format&fit=crop&q=80	https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&auto=format&fit=crop&q=80	t
plan-maxicare-plus	MAXICARE-PLUS	Maxicare Plus Comprehensive HMO	Maxicare Healthcare Corporation	Premium cashless healthcare with 100% coverage, zero co-pay, private room accommodations, and extensive Cebu clinic access.	1850	18870	250000	100	12	{"100% Cashless hospitalization at Chong Hua Hospital, Cebu Doctors' & UC Med","Unlimited outpatient consultations with accredited doctors and specialists","Annual Physical Examination (APE) with comprehensive blood chemistry","Emergency room care and road ambulance transfer coverage","Prescription medicine allowance at SugboDoc Medical Store"}	4.9	1850000	Maxicare Healthcare Corporation is the leading HMO in the Philippines with over 30 years of excellence, serving millions of members nationwide with 24/7 teleconsultation and cashless network.	t	2026-01-01 00:00:00+00	Comprehensive HMO	Comprehensive HMO	0	Most Popular Offer	+63 (32) 255-8000	https://www.maxicare.com.ph	customercare@maxicare.com.ph	["Individuals aged 18 to 65 years old (renewable up to age 75)", "Philippine residents and working expatriates", "No active terminal hospitalization at the time of purchase"]	Immediate emergency coverage; zero waiting period for general outpatient consultations	["Aesthetic dermatology without pathological indication", "Self-prescribed alternative holistic remedies", "Non-emergency overseas medical expenditures"]	["Private Hospital Room & Board (₱3,500/day)", "Specialist Consultations (Cardiology, ENT, Pediatrics, OB-GYN)", "Advanced Imaging (CT Scan, MRI, Ultrasound, 2D Echo)", "Emergency Trauma & Triage Treatment", "Preventive Dental & Vision Cleaning"]	20	Guaranteed renewal with a 5% renewal discount upon continuous tenure.	Cashless approval is processed electronically through the SugboDoc provider network. Full policy card and digital QR certificate issued immediately upon Stripe payment.	[{"answer": "Pre-existing conditions are covered up to ₱50,000 during the first year, expanding to full limit upon renewal.", "question": "Are pre-existing conditions covered?"}, {"answer": "Present your SugboDoc Digital Insurance Card or policy number at any partner hospital counter for direct settlement.", "question": "How does cashless billing work?"}]	https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=160&auto=format&fit=crop&q=80	https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=800&auto=format&fit=crop&q=80	t
plan-medicard-select	MEDICARD-SELECT	Medicard Select Health Plan	MediCard Philippines, Inc.	Balanced health plan offering full hospitalization benefits, preventive screenings, emergency room, and specialist checkups.	1600	16320	200000	95	12	{"Inpatient surgery and semi-private room accommodation","Unlimited outpatient visits to MediCard free-standing clinics in Cebu","Annual preventive executive checkup and urinalysis","Coverage for lab tests, ECG, and chest X-rays","Minor surgical procedure coverage in outpatient setting"}	4.8	1200000	MediCard Philippines is a premier HMO founded by physicians, dedicated to providing accessible and personalized healthcare solutions across the archipelago.	t	2026-01-01 00:00:00+00	Preventive & Inpatient HMO	Comprehensive HMO	5	Best Value	+63 (32) 231-6334	https://www.medicardphils.com	support@medicardphils.com	["Ages 18 to 60 years old", "Valid government ID or company employment ID", "Applicable for individual or family enrollment"]	15 days for elective procedures; immediate for accidents and emergencies	["Cosmetic dermatological and orthodontic treatments", "Dangerous recreational extreme sports injuries", "Experimental drug therapies without clinical trial certification"]	["Semi-Private Hospital Accommodations", "Physician Specialist Consultations", "Complete Hematology & Lipid Panels", "Emergency Room & Resuscitation Facilities", "Routine Immunization Screening"]	15	Annual renewal available with seamless auto-debit through Stripe subscription.	Subject to standard MediCard healthcare agreement guidelines. Claims are verified directly using policy verification tokens.	[{"answer": "Yes, you can enroll qualified dependents during checkout with individual digital cards generated.", "question": "Can family members be added under this plan?"}]	https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=160&auto=format&fit=crop&q=80	https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&auto=format&fit=crop&q=80	t
plan-intellicare-careplus	INTELLICARE-CAREPLUS	Intellicare CarePlus Elite	Asalus Corporation (Intellicare)	Broad nationwide hospital network, prescription allowances, executive physical exams, dental rider, and fast-track admissions.	2200	22440	350000	100	12	{"Comprehensive inpatient executive private room coverage","Fast-track cashless admission at all accredited hospitals nationwide","Full outpatient diagnostic lab and diagnostic imaging allowance","Dental care rider: bi-annual cleanings, fillings, and dental consultations","Dedicated 24/7 care concierge and medical coordinator"}	4.9	2400000	Intellicare (Asalus Corporation) is the country's preeminent healthcare management leader, delivering top-tier health management services with over 40,000 accredited medical specialists.	t	2026-01-01 00:00:00+00	Executive Corporate HMO	Executive & Family	0	Executive Tier	+63 (32) 234-0100	https://www.intellicare.com.ph	careplus@intellicare.com.ph	["Individuals and professionals aged 18 to 65", "Self-employed individuals and corporate executives", "Valid Philippine residency address"]	Immediate emergency access; zero waiting period for outpatient clinic visits	["Elective cosmetic surgeries", "Experimental alternative holistic treatments"]	["Executive Suite / Private Room (₱4,500/day)", "Specialist Sub-Specialty Consultations", "Cardiac MRI, CT Angiography & 2D Echo", "Emergency Ambulance & Air Evacuation Assistance", "Complete Dental Prophylaxis & Sealants"]	25	Automatic renewal guarantee with VIP concierge support and priority claims clearance.	All terms comply with Insurance Commission of the Philippines standard HMO regulations.	[{"answer": "Yes, Intellicare CarePlus Elite includes comprehensive dental care coverage and annual oral prophylaxis.", "question": "Does this include dental coverage?"}]	https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=160&auto=format&fit=crop&q=80	https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=800&auto=format&fit=crop&q=80	t
plan-cebudoc-shield	CEBUDOC-GOLD	CebuDoc Executive Gold Shield	Cebu Doctors' University Hospital Network	Direct priority access to CebuDoc Group hospitals with dedicated hospitalist care, specialty diagnostics, and zero out-of-pocket costs.	2450	24990	400000	100	12	{"Priority VIP room accommodation across all CebuDoc network hospitals","100% direct cashless coverage for inpatient and outpatient procedures","Specialty oncology, cardiology, and orthopedics care access","24/7 Direct line to senior attending physicians in Cebu City","₱10,000 Annual pharmacy medication allowance at SugboDoc"}	4.9	650000	Cebu Doctors' University Hospital is a premier tertiary healthcare institution in Central Visayas renowned for world-class surgical, cardiovascular, and oncological medical care.	t	2026-01-01 00:00:00+00	Hospital Network Gold Plan	Executive & Family	0	Cebu Priority Care	+63 (32) 255-5555	https://cebudocgroup.com	goldshield@cebudocgroup.com	["Residents of Cebu and Central Visayas aged 18 to 70", "No preexisting disqualification for non-emergency admissions"]	Immediate emergency access; 7 days for elective diagnostic admissions	["Non-medically necessary plastic surgeries", "Uncertified experimental procedures"]	["VIP Private Room Suite", "Chief Specialist Consultation Privileges", "High-Resolution MRI, PET Scan, and Hemodynamic Labs", "Emergency Trauma Center Rapid Admission", "Home Health Care & Post-Discharge Rehabilitation"]	30	Preferential loyalty renewal with locked-in premium rate for 3 years.	Administered in partnership with SugboDoc Integrated Healthcare Platform with real-time electronic claims settlement.	[{"answer": "Cebu Doctors' Hospital (Main), South General Hospital, North General Hospital, Mactan Doctors' Hospital, and Ormoc Doctors' Hospital.", "question": "Which hospitals are included in this network?"}]	https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=160&auto=format&fit=crop&q=80	https://images.unsplash.com/photo-1516549655169-df83a0774514?w=800&auto=format&fit=crop&q=80	t
\.


--
-- TOC entry 3791 (class 0 OID 16759)
-- Dependencies: 236
-- Data for Name: insurance_policies; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.insurance_policies (id, user_id, plan_id, policy_number, status, billing_cycle, premium_amount, coverage_limit, start_date, end_date, created_at, patient_id, plan_name, provider, co_pay_percent, remaining_coverage, is_primary, payment_status) FROM stdin;
pol-philhealth-juan	patient-juan-cruz	plan-philhealth-universal	PH-2026-8891234	Active	annual	5400	500000	2026-01-01	2026-12-31	2026-01-01 00:00:00+00	patient-juan-cruz	PhilHealth Standard Universal Coverage	Philippine Health Insurance Corporation	10	465000	t	Paid
pol-maxicare-juan	patient-juan-cruz	plan-maxicare-plus	MAX-88291039	Active	annual	18870	250000	2026-01-15	2027-01-14	2026-01-15 00:00:00+00	patient-juan-cruz	Maxicare Plus Comprehensive HMO	Maxicare Healthcare Corporation	0	215000	f	Paid
0e5a74622bd6df276b1b49c3ed9a2ad4	user-mt7ddnsq-iflt	plan-philhealth-universal	SD-PHILHEALTH-UNI-40037	Active	annual	5400	500000	2026-08-24	\N	2026-08-24 15:10:55.020058+00	user-mt7ddnsq-iflt	PhilHealth Standard Universal Coverage	Philippine Health Insurance Corporation	10	500000	f	Paid
\.


--
-- TOC entry 3788 (class 0 OID 16660)
-- Dependencies: 233
-- Data for Name: lab_results; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.lab_results (id, encounter_id, patient_id, test_name, result, unit, reference_range, status, resulted_at, category, clinic, created_at, date, doctor, interpretation, notes, value) FROM stdin;
lab-701	enc-201	patient-juan-cruz	Complete Blood Count (CBC) with Platelets	\N	\N	Normal adult parameters	Completed	2026-08-24 08:23:45.655512+00	Hematology	Chong Hua Clinical Laboratory	2026-08-01 11:00:00+00	2026-08-01	Dr. Maria Santos	Normal hematological panel with no signs of active infection or anemia.	Specimen verified by licensed medical technologist.	Hemoglobin 15.2 g/dL, WBC 6.8 x10^9/L, Platelets 245 x10^9/L
lab-702	enc-201	patient-juan-cruz	Fasting Blood Sugar (FBS)	\N	mg/dL	70 - 99 mg/dL	Completed	2026-08-24 08:23:45.656068+00	Clinical Chemistry	Chong Hua Clinical Laboratory	2026-08-01 11:15:00+00	2026-08-01	Dr. Maria Santos	Euglycemic fasting blood glucose level within healthy reference range.	Fasting duration confirmed at 10 hours.	92
\.


--
-- TOC entry 3798 (class 0 OID 16960)
-- Dependencies: 243
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.messages (id, patient_id, doctor_id, doctor_name, specialty, sender, text, file_name, read, sms_status, sms_to, sms_from, sms_error, created_at) FROM stdin;
msg-1201	patient-juan-cruz	doc-maria-santos	Dr. Maria Santos	Cardiology	doctor	Good day, Juan! How are your blood pressure readings after starting the morning dose of Losartan?	\N	t	Delivered	+63 917 123 4567	+63 918 234 5678	\N	2026-08-05 09:14:00+00
msg-1202	patient-juan-cruz	doc-maria-santos	Dr. Maria Santos	Cardiology	patient	Hello Dr. Santos, my readings have been steady around 122/80 to 126/84. Feeling good and active.	\N	t	Delivered	+63 918 234 5678	+63 917 123 4567	\N	2026-08-05 10:02:00+00
6dcf0e010a38852e94618dfabda3fae9	patient-juan-cruz	\N	\N	\N	doctor	hi	\N	f	failed	+63 917 123 4567	\N	Infobip authentication failed. Check INFOBIP_API_KEY and INFOBIP_BASE_URL in the environment.	2026-08-26 05:26:53.95658+00
\.


--
-- TOC entry 3799 (class 0 OID 16986)
-- Dependencies: 244
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, title, message, kind, read, created_at) FROM stdin;
notif-1301	patient-juan-cruz	Appointment Reminder	You have an upcoming consultation with Dr. Maria Santos on August 20, 2026 at 09:30 AM.	appointment	f	2026-08-16 08:00:00+00
notif-1302	patient-juan-cruz	Laboratory Diagnostic Ready	Your Complete Blood Count (CBC) results are available in your Medical Records.	medical	t	2026-08-01 12:00:00+00
6a1180e30b8555ca182e1475ccfab818	user-mt9elmfg-bbsv	Order #ORD-517122 Paid & Confirmed	Your payment of ₱58.00 for Medical Store order #ORD-517122 was confirmed. Your order is now being prepared.	order	f	2026-08-26 03:07:16.557151+00
2e4f8bac1862391b46d42ecb183dae1e	user-mt9elmfg-bbsv	Order #ORD-782243 Paid & Confirmed	Your payment of ₱830.00 for Medical Store order #ORD-782243 was confirmed. Your order is now being prepared.	order	f	2026-08-26 03:07:42.576806+00
69d3b87e46a6559da6776201d7ddf98a	user-mt9j446q-o54y	Order #ORD-383767 Paid & Confirmed	Your payment of ₱830.00 for Medical Store order #ORD-383767 was confirmed. Your order is now being prepared.	order	f	2026-08-26 03:28:05.431213+00
6c1489d952f6e77a3c93f92569bbe801	user-mt9j446q-o54y	Order #ORD-715709 Paid & Confirmed	Your payment of ₱790.00 for Medical Store order #ORD-715709 was confirmed. Your order is now being prepared.	order	f	2026-08-26 03:41:52.075+00
b5893701cd77996ddf6a51031ad19fad	user-mt9j446q-o54y	Order #ORD-715709 Paid & Confirmed	Your payment of ₱790.00 for Medical Store order #ORD-715709 was confirmed. Your order is now being prepared.	order	f	2026-08-26 03:41:52.148262+00
d2c0a02f1c56e1f9d798332b9d4d7a8f	user-mt9j446q-o54y	Order #ORD-457615 Paid & Confirmed	Your payment of ₱830.00 for Medical Store order #ORD-457615 was confirmed. Your order is now being prepared.	order	f	2026-08-26 06:16:11.11626+00
ceb53f5a80e82958b1513b19682d7eac	user-mt9j446q-o54y	Order #ORD-457615 Paid & Confirmed	Your payment of ₱830.00 for Medical Store order #ORD-457615 was confirmed. Your order is now being prepared.	order	f	2026-08-26 06:16:11.266623+00
e2f3d253dea7eb8fb80967a9a07121cb	user-mtcc8md2-i1nz	Order #ORD-779794 Paid & Confirmed	Your payment of ₱830.00 for Medical Store order #ORD-779794 was confirmed. Your order is now being prepared.	order	f	2026-08-28 02:34:34.370012+00
1f14324de2022e720cebb4163eaabe62	user-mtcc8md2-i1nz	Order #ORD-779794 Paid & Confirmed	Your payment of ₱830.00 for Medical Store order #ORD-779794 was confirmed. Your order is now being prepared.	order	f	2026-08-28 02:34:34.438101+00
\.


--
-- TOC entry 3795 (class 0 OID 16872)
-- Dependencies: 240
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.order_items (id, order_id, product_id, product_name, brand, unit_price, quantity, line_total) FROM stdin;
ord-item-1	ord-1101	prod-paracetamol-500	Paracetamol 500mg Tablet (Biogesic)	Biogesic	8.5	20	170
ord-item-2	ord-1101	prod-multivitamins-zinc	Enervon-C Plus Multivitamins + Zinc (30 Tablets)	Enervon-C	320	1	320
ord-item-3	ord-1101	prod-n95-masks	N95 Particulate Respirator Masks (Box of 20)	3M 8210	90	1	90
5482ff2dddbef5ca1c4db9a9ac6cef47	8caeb60fbe7cb33c30aba4aca2a0fb46	prod-amoxicillin-500	Amoxicillin 500mg Capsule	RiteMed	18	1	18
204a1d56af53aa573b071c1f3061a1f6	e6fc4dbeea61ff8a4e3a62ab7cebdbc5	prod-amoxicillin-500	Amoxicillin 500mg Capsule	RiteMed	18	2	36
161abf3c1ccab91b7069d92ff7383f31	e6fc4dbeea61ff8a4e3a62ab7cebdbc5	prod-cetirizine-10	Cetirizine HCl 10mg Tablet (Alnix)	Alnix	22	1	22
03f62dc01e24109bd61a8a9662bc5610	1b5a55d2d8028e1d1df4880e812e9e10	prod-amoxicillin-500	Amoxicillin 500mg Capsule	RiteMed	18	1	18
02481087d94bb2000948577c65b5ccb4	1b5a55d2d8028e1d1df4880e812e9e10	prod-cetirizine-10	Cetirizine HCl 10mg Tablet (Alnix)	Alnix	22	1	22
86ca82fb2baaf31e7ce40a1b027e212f	1b5a55d2d8028e1d1df4880e812e9e10	prod-first-aid-kit	Complete Emergency First Aid Kit (75 pcs)	Medikit Pro	790	1	790
6802e6873d369ace889e9b89cd5cce26	c5e1b4b8e85c5f60b91705e436cdb66d	prod-amoxicillin-500	Amoxicillin 500mg Capsule	RiteMed	18	1	18
f4c7e6b5d15f753307dfe23c103936ca	c5e1b4b8e85c5f60b91705e436cdb66d	prod-cetirizine-10	Cetirizine HCl 10mg Tablet (Alnix)	Alnix	22	1	22
54b5994c92572fe0f52f1ec182dfd2c4	c5e1b4b8e85c5f60b91705e436cdb66d	prod-first-aid-kit	Complete Emergency First Aid Kit (75 pcs)	Medikit Pro	790	1	790
b4290356b0a5a6268cf49b3d7de06731	6e9b7278ba1d0f924f9dda96ad1d96af	prod-bp-monitor	Digital Upper Arm Blood Pressure Monitor	Omron HEM-7120	2450	1	2450
a83423b03d684bdc2ffd9eb562ad8343	ef8ce87e7a11117522eb430b5cfc62eb	prod-first-aid-kit	Complete Emergency First Aid Kit (75 pcs)	Medikit Pro	790	1	790
cd7f9ea06d3370b659223c9f2a7e64e1	e0365fb38d1cde5ca47be3084b871f38	prod-amoxicillin-500	Amoxicillin 500mg Capsule	RiteMed	18	1	18
ceb866207172299d9d3cf47c9114fad6	e0365fb38d1cde5ca47be3084b871f38	prod-cetirizine-10	Cetirizine HCl 10mg Tablet (Alnix)	Alnix	22	1	22
825a3130d4abfdbb8ae4598c56b98ebb	e0365fb38d1cde5ca47be3084b871f38	prod-first-aid-kit	Complete Emergency First Aid Kit (75 pcs)	Medikit Pro	790	1	790
0ee2fb7fc4081bf7c1efeb0b774d6ccb	10d246845572244f9c91bfdcdd43a65b	prod-amoxicillin-500	Amoxicillin 500mg Capsule	RiteMed	18	1	18
bd5502387446ec9fe0221f1273a8986e	10d246845572244f9c91bfdcdd43a65b	prod-cetirizine-10	Cetirizine HCl 10mg Tablet (Alnix)	Alnix	22	1	22
5f827b646df6a9e18626332a676521c9	10d246845572244f9c91bfdcdd43a65b	prod-first-aid-kit	Complete Emergency First Aid Kit (75 pcs)	Medikit Pro	790	1	790
\.


--
-- TOC entry 3794 (class 0 OID 16837)
-- Dependencies: 239
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.orders (id, user_id, order_no, fulfillment_type, pickup_branch, delivery_address, delivery_fee, subtotal, total, status, payment_status, tracking_no, estimated_delivery, received_at, created_at) FROM stdin;
ord-1101	patient-juan-cruz	ORD-2026-8910	pickup	branch-cdh	\N	0	580	580	Completed	Paid	TRK-PH-9910	Ready for Pickup	2026-08-03 14:20:00+00	2026-08-02 11:00:00+00
8caeb60fbe7cb33c30aba4aca2a0fb46	user-mt9elmfg-bbsv	ORD-104274	pickup	branch-cdh	\N	0	18	18	Pending	Pending	\N	\N	\N	2026-08-26 03:07:03.720399+00
e6fc4dbeea61ff8a4e3a62ab7cebdbc5	user-mt9elmfg-bbsv	ORD-517122	pickup	branch-cdh	\N	0	58	58	Preparing	Paid	\N	\N	\N	2026-08-26 03:07:15.200077+00
1b5a55d2d8028e1d1df4880e812e9e10	user-mt9elmfg-bbsv	ORD-782243	pickup	branch-cdh	\N	0	830	830	Preparing	Paid	\N	\N	\N	2026-08-26 03:07:41.120773+00
c5e1b4b8e85c5f60b91705e436cdb66d	user-mt9j446q-o54y	ORD-383767	pickup	branch-cdh	\N	0	830	830	Preparing	Paid	\N	\N	\N	2026-08-26 03:28:03.766637+00
6e9b7278ba1d0f924f9dda96ad1d96af	user-mt9j446q-o54y	ORD-631463	pickup	branch-cdh	\N	0	2450	2450	Pending	Pending	\N	\N	\N	2026-08-26 03:31:46.830807+00
ef8ce87e7a11117522eb430b5cfc62eb	user-mt9j446q-o54y	ORD-715709	pickup	branch-cdh	\N	0	790	790	Preparing	Paid	\N	\N	\N	2026-08-26 03:41:26.472412+00
e0365fb38d1cde5ca47be3084b871f38	user-mt9j446q-o54y	ORD-457615	pickup	branch-cdh	\N	0	830	830	Preparing	Paid	\N	\N	\N	2026-08-26 06:15:43.653982+00
10d246845572244f9c91bfdcdd43a65b	user-mtcc8md2-i1nz	ORD-779794	pickup	branch-cdh	\N	0	830	830	Preparing	Paid	\N	\N	\N	2026-08-28 02:34:24.170839+00
\.


--
-- TOC entry 3797 (class 0 OID 16929)
-- Dependencies: 242
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payments (id, user_id, bill_id, description, amount, method, status, transaction_id, created_at) FROM stdin;
pay-1001	patient-juan-cruz	bill-901	Payment for Consultation INV-2026-0801	1200	Stripe Card	Paid	pi_3M7xqL44ob7rDFuv0aB8c9De	2026-08-01 10:15:00+00
b47b4c91588111171c146c47dc4ce2b5	user-mt7ddnsq-iflt	c85724c181f51e26ab1a1888d1c79464	PhilHealth Standard Universal Coverage - Annual Premium (SD-PHILHEALTH-UNI-40037)	5400	Stripe	Paid	pi_3U88x944ob7rDFuv1kxdqtMx	2026-08-25 01:15:10.029138+00
ac80cc34ba7004cb1d1dd5c0e4e08457	user-mt9elmfg-bbsv	16cc099574a07c0c79aca723ad47c2c2	Medical Store Order #ORD-517122	58	Stripe Card	Paid	pi_3U8XBF44ob7rDFuv05SZy4oH	2026-08-26 03:07:16.528243+00
0f6d2f3171337e5470cb03a519beda94	user-mt9elmfg-bbsv	8817ac0920295e3d23fd9cc258ba7997	Medical Store Order #ORD-782243	830	Stripe Card	Paid	pi_3U8XBf44ob7rDFuv0DfSZZrC	2026-08-26 03:07:42.543515+00
7054402a063dc5340ddb3fe96eb8f049	user-mt9j446q-o54y	1292068e337069350ed4f28a74972cd3	Medical Store Order #ORD-383767	830	Stripe Card	Paid	pi_3U8XVO44ob7rDFuv1OMsaP0m	2026-08-26 03:28:05.413006+00
1772363f23f1a19e726ce1e3fc42164d	user-mt9j446q-o54y	91b628bbcd00940e7b67576fa6dafde0	Medical Store Order #ORD-715709	790	Stripe	Paid	pi_3U8Xif44ob7rDFuv0CxjuvEx	2026-08-26 03:41:52.053638+00
4342704bd625c5c8cbf3fe0a0b65008d	user-mt9j446q-o54y	91b628bbcd00940e7b67576fa6dafde0	Medical Store Order #ORD-715709	790	Stripe	Paid	pi_3U8Xif44ob7rDFuv0CxjuvEx	2026-08-26 03:41:52.107461+00
8bcab56bdf7da7f9bdace906c0b46919	user-mt9j446q-o54y	64e20eda5bb33398673c636ae0ffde65	Medical Store Order #ORD-631463	2450	Stripe	Paid	pi_3U8Xir44ob7rDFuv0keuGHJf	2026-08-26 03:42:23.94093+00
b3ee5e7e496a43763504403be08e7a8d	user-mt9j446q-o54y	def9c864c13df236ac42b319488cfed4	Medical Store Order #ORD-457615	830	Stripe	Paid	pi_3U8a7z44ob7rDFuv0QLP0EUw	2026-08-26 06:16:11.064647+00
e5e30ace34e528641d4de194a47ca5a2	user-mt9j446q-o54y	def9c864c13df236ac42b319488cfed4	Medical Store Order #ORD-457615	830	Stripe	Paid	pi_3U8a7z44ob7rDFuv0QLP0EUw	2026-08-26 06:16:11.219281+00
8a267cc9841b8772d2dcf3e0931afe89	user-mtcc8md2-i1nz	1337666dbab58126b1bc66287bb4d771	Medical Store Order #ORD-779794	830	Stripe	Paid	pi_3U9Fcc44ob7rDFuv09dMRyzg	2026-08-28 02:34:34.348755+00
550d4115b9aaf06e476c2d069a07cf91	user-mtcc8md2-i1nz	1337666dbab58126b1bc66287bb4d771	Medical Store Order #ORD-779794	830	Stripe	Paid	pi_3U9Fcc44ob7rDFuv09dMRyzg	2026-08-28 02:34:34.40505+00
\.


--
-- TOC entry 3787 (class 0 OID 16635)
-- Dependencies: 232
-- Data for Name: prescriptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.prescriptions (id, encounter_id, patient_id, drug, dosage, frequency, duration, instructions, prescribed_by, status, created_at, doctor_id, doctor_name, end_date, medication, refills, start_date) FROM stdin;
rx-601	enc-201	patient-juan-cruz	\N	50mg	Once daily in the morning after breakfast	\N	Take with full glass of water. Monitor home BP weekly.	\N	Active	2026-08-01 10:00:00+00	doc-maria-santos	Dr. Maria Santos	2026-11-01	Losartan Potassium 50mg Tablet	3	2026-08-01
\.


--
-- TOC entry 3786 (class 0 OID 16617)
-- Dependencies: 231
-- Data for Name: procedures; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.procedures (id, encounter_id, name, code, notes, performed_at, category, created_at, status) FROM stdin;
\.


--
-- TOC entry 3793 (class 0 OID 16807)
-- Dependencies: 238
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.products (id, name, description, category, price, stock, reorder_level, supplier, brand, image_url, rating, review_count, prescription_required, created_at) FROM stdin;
prod-paracetamol-500	Paracetamol 500mg Tablet (Biogesic)	For fast relief of fever, headache, and minor aches.	Analgesic / Antipyretic	8.5	250	50	Unilab Pharmaceuticals	Biogesic	https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=60	4.9	142	f	2026-01-01 00:00:00+00
prod-losartan-50	Losartan Potassium 50mg Tablet	Angiotensin II receptor blocker used to manage hypertension.	Cardiovascular	14.5	180	40	Therapharma Inc.	Lifezar	https://images.unsplash.com/photo-1585435557343-3b092031a831?w=500&auto=format&fit=crop&q=60	4.9	95	t	2026-01-01 00:00:00+00
prod-metformin-500	Metformin HCl 500mg Tablet	First-line medication for the treatment of type 2 diabetes.	Endocrine & Diabetes	12	150	35	Merck Serono	Glucophage	https://images.unsplash.com/photo-1550572017-edb79a1f26b5?w=500&auto=format&fit=crop&q=60	4.7	64	t	2026-01-01 00:00:00+00
prod-omeprazole-20	Omeprazole 20mg Delayed-Release Capsule	Proton pump inhibitor for GERD, acid reflux, and gastric ulcers.	Gastrointestinal	25	110	30	AstraZeneca PH	Losec	https://images.unsplash.com/photo-1577401239170-897942555fb3?w=500&auto=format&fit=crop&q=60	4.8	51	t	2026-01-01 00:00:00+00
prod-bp-monitor	Digital Upper Arm Blood Pressure Monitor	Clinical accuracy with Intellisense cuff wrapping and irregular heartbeat indicator.	Medical Devices	2450	35	10	Omron Healthcare	Omron HEM-7120	https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=500&auto=format&fit=crop&q=60	4.9	118	f	2026-01-01 00:00:00+00
prod-pulse-oximeter	Fingertip Pulse Oximeter with OLED Display	Non-invasive SpO2 oxygen saturation and pulse rate monitor.	Medical Devices	850	45	15	Yuwell Medical	Yuwell YX301	https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=500&auto=format&fit=crop&q=60	4.7	82	f	2026-01-01 00:00:00+00
prod-ir-thermometer	Medical Infrared Non-Contact Forehead Thermometer	1-second hygienic fever check with color-coded fever warning screen.	Medical Devices	1150	40	12	Braun Healthcare	ThermoScan IR	https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=500&auto=format&fit=crop&q=60	4.8	53	f	2026-01-01 00:00:00+00
prod-n95-masks	N95 Particulate Respirator Masks (Box of 20)	NIOSH-approved healthcare particulate respirator with soft nose foam.	Personal Protective Equipment	450	160	40	3M Philippines	3M 8210	https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=500&auto=format&fit=crop&q=60	4.9	94	f	2026-01-01 00:00:00+00
prod-multivitamins-zinc	Enervon-C Plus Multivitamins + Zinc (30 Tablets)	High potency Vitamin B-Complex, Vitamin C (500mg) and Zinc for immunity.	Vitamins & Supplements	320	200	50	Unilab Consumer Health	Enervon-C	https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=60	4.9	135	f	2026-01-01 00:00:00+00
prod-amoxicillin-500	Amoxicillin 500mg Capsule	Broad-spectrum antibacterial medication for bacterial infections.	Antibiotics	18	114	30	RiteMed Philippines	RiteMed	https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=500&auto=format&fit=crop&q=60	4.8	88	t	2026-01-01 00:00:00+00
prod-cetirizine-10	Cetirizine HCl 10mg Tablet (Alnix)	Rapid relief from allergic rhinitis, sneezing, and hives.	Antihistamine	22	85	25	Unilab Consumer Health	Alnix	https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=500&auto=format&fit=crop&q=60	4.8	73	f	2026-01-01 00:00:00+00
prod-first-aid-kit	Complete Emergency First Aid Kit (75 pcs)	OSHA & Red Cross compliant first aid case for home, office, or vehicle.	First Aid & Wound Care	790	50	15	Philippine Red Cross Partner Supplies	Medikit Pro	https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=500&auto=format&fit=crop&q=60	4.9	67	f	2026-01-01 00:00:00+00
\.


--
-- TOC entry 3777 (class 0 OID 16413)
-- Dependencies: 222
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profiles (id, email, name, phone, dob, sex, blood_type, allergies, emergency_contact_name, emergency_contact_relation, emergency_contact_phone, address, assigned_doctor, status, is_demo, created_at, updated_at) FROM stdin;
patient-juan-cruz	juan@example.com	Juan dela Cruz	+63 917 123 4567	1988-06-12	Male	O+	{Penicillin,"Sulfa drugs"}	Maria dela Cruz	Spouse	+63 917 987 6543	Banilad, Cebu City, 6000	Dr. Maria Santos	Active	f	2026-01-01 00:00:00+00	2026-01-01 00:00:00+00
user-doctor-maria	dr.santos@sugbodoc.ph	Dr. Maria Santos	+63 918 234 5678	1978-04-20	Female	A+	{}	Roberto Santos	Spouse	+63 918 876 5432	Lahug, Cebu City, 6000	\N	Active	f	2026-01-01 00:00:00+00	2026-01-01 00:00:00+00
user-doctor-john	dr.cruz@sugbodoc.ph	Dr. John Cruz	+63 919 345 6789	1982-11-15	Male	B+	{}	Elena Cruz	Sister	+63 919 765 4321	Guadalupe, Cebu City, 6000	\N	Active	f	2026-01-01 00:00:00+00	2026-01-01 00:00:00+00
user-admin-main	admin@sugbodoc.ph	Hospital Administrator	+63 32 255 5500	1980-01-01	Other	AB+	{}	Chief of Staff	Colleague	+63 32 255 5501	SugboDoc Administration Complex, Cebu City	\N	Active	f	2026-01-01 00:00:00+00	2026-01-01 00:00:00+00
user-mt7ddnsq-iflt	johndoe@gmail.com	John Doe	\N	\N	\N	\N	{}	\N	\N	\N	\N	Dr. Maria Santos	Active	f	2026-08-24 15:07:13.466+00	2026-08-24 15:11:53.857824+00
user-mt7z14is-1ofg	newuser@gmail.com	New User	\N	\N	\N	\N	{}	\N	\N	\N	\N	\N	Active	f	2026-08-25 01:13:20.164+00	2026-08-25 01:13:20.164+00
user-mt9elmfg-bbsv	justin.sugbodoc@gmail.com	Justin Ramo	+6309943894138	\N	\N		{}				\N	Dr. Maria Santos	Active	f	2026-08-26 01:16:56.908+00	2026-08-26 02:58:35.628391+00
user-mt9j446q-o54y	gabriel.sugbodoc@gmail.com	Gabriel Sabang	+639943489138	\N	\N	\N	{}	\N	\N	\N	\N	\N	Active	f	2026-08-26 03:23:18.194+00	2026-08-26 03:23:18.194+00
user-mtcc8md2-i1nz	gabriel@gmail.com	Gabriel	\N	\N	\N	\N	{}	\N	\N	\N	\N	\N	Active	f	2026-08-28 02:34:09.59+00	2026-08-28 02:34:09.59+00
\.


--
-- TOC entry 3781 (class 0 OID 16503)
-- Dependencies: 226
-- Data for Name: queue_entries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.queue_entries (id, patient_id, appointment_id, queue_number, department, doctor_name, clinic, status, estimated_wait_minutes, avg_service_minutes, checked_in_at, created_at, assigned_room, called_at, completed_at, doctor_id, estimated_wait_mins, patient_name, service_type) FROM stdin;
q-1401	patient-juan-cruz	appt-101	C-104	\N	Dr. Maria Santos	\N	Waiting	\N	12	2026-08-24 08:23:45.666745+00	2026-08-16 08:30:00+00	Room 402	\N	\N	doc-maria-santos	15	Juan dela Cruz	Cardiology Consultation
\.


--
-- TOC entry 3783 (class 0 OID 16563)
-- Dependencies: 228
-- Data for Name: soap_notes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.soap_notes (id, encounter_id, subjective, objective, assessment, plan, created_at) FROM stdin;
soap-301	enc-201	Patient reports taking Losartan 50mg consistently every morning. Occasional mild fatigue after work hours.	BP: 124/82 mmHg, HR: 74 bpm, O2 Sat: 99% on room air, Weight: 72.5 kg, BMI: 24.2 kg/m².	Stage 1 Essential Hypertension, well-controlled on current monotherapy.	Continue Losartan 50mg OD. Maintain low-sodium dietary habits. Repeat fasting lipid panel and serum creatinine in 3 months.	2026-08-01 10:00:00+00
\.


--
-- TOC entry 3792 (class 0 OID 16795)
-- Dependencies: 237
-- Data for Name: store_branches; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.store_branches (id, name, address, hours, created_at, city, contact_number, is_active, operating_hours) FROM stdin;
branch-cdh	Cebu Doctors' Hospital Pharmacy	Osmeña Blvd, Capitol Site	\N	2026-01-01 00:00:00+00	Cebu City	+63 32 255 5555	t	24/7 Open
branch-chh	Chong Hua Hospital Outpatient Pharmacy	Fuente Osmeña Cir	\N	2026-01-01 00:00:00+00	Cebu City	+63 32 255 8000	t	6:00 AM - 10:00 PM
branch-vsmc	Vicente Sotto SMMC Pharmacy	B. Rodriguez St	\N	2026-01-01 00:00:00+00	Cebu City	+63 32 253 9891	t	24/7 Open
branch-psh	Perpetual Succour Hospital Dispensary	F. Sotto Drive, Gorordo Ave	\N	2026-01-01 00:00:00+00	Cebu City	+63 32 233 8620	t	7:00 AM - 9:00 PM
branch-ucmed	UC Med Hospital Main Pharmacy	Ouano Ave, Subangdaku	\N	2026-01-01 00:00:00+00	Mandaue City	+63 32 505 5555	t	24/7 Open
\.


--
-- TOC entry 3778 (class 0 OID 16433)
-- Dependencies: 223
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_roles (id, user_id, role, created_at) FROM stdin;
role-1	patient-juan-cruz	patient	2026-01-01 00:00:00+00
role-2	user-doctor-maria	doctor	2026-01-01 00:00:00+00
role-3	user-doctor-john	doctor	2026-01-01 00:00:00+00
role-4	user-admin-main	admin	2026-01-01 00:00:00+00
role-1787584033480	user-mt7ddnsq-iflt	patient	2026-08-24 15:07:13.48+00
role-1787620400195	user-mt7z14is-1ofg	patient	2026-08-25 01:13:20.195+00
role-1787707016933	user-mt9elmfg-bbsv	patient	2026-08-26 01:16:56.933+00
role-1787714598238	user-mt9j446q-o54y	patient	2026-08-26 03:23:18.238+00
role-1787884449626	user-mtcc8md2-i1nz	patient	2026-08-28 02:34:09.626+00
\.


--
-- TOC entry 3784 (class 0 OID 16580)
-- Dependencies: 229
-- Data for Name: vital_signs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vital_signs (id, encounter_id, blood_pressure, heart_rate, temperature, respiratory_rate, oxygen_saturation, weight_kg, height_cm, recorded_at, bmi, created_at) FROM stdin;
vitals-401	enc-201	124/82	74	36.6	16	99	72.5	173	2026-08-01 09:35:00+00	24.2	2026-08-01 09:35:00+00
\.


--
-- TOC entry 3537 (class 2606 OID 16405)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3548 (class 2606 OID 17187)
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- TOC entry 3585 (class 2606 OID 17096)
-- Name: bills bills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_pkey PRIMARY KEY (id);


--
-- TOC entry 3594 (class 2606 OID 18024)
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);


--
-- TOC entry 3597 (class 2606 OID 18026)
-- Name: cart_items cart_items_user_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_user_id_product_id_key UNIQUE (user_id, product_id);


--
-- TOC entry 3545 (class 2606 OID 17171)
-- Name: doctors doctors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_pkey PRIMARY KEY (id);


--
-- TOC entry 3559 (class 2606 OID 17297)
-- Name: encounter_diagnoses encounter_diagnoses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounter_diagnoses
    ADD CONSTRAINT encounter_diagnoses_pkey PRIMARY KEY (id);


--
-- TOC entry 3553 (class 2606 OID 17236)
-- Name: encounters encounters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT encounters_pkey PRIMARY KEY (id);


--
-- TOC entry 3567 (class 2606 OID 17400)
-- Name: imaging_records imaging_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imaging_records
    ADD CONSTRAINT imaging_records_pkey PRIMARY KEY (id);


--
-- TOC entry 3569 (class 2606 OID 16756)
-- Name: insurance_plans insurance_plans_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_plans
    ADD CONSTRAINT insurance_plans_code_key UNIQUE (code);


--
-- TOC entry 3571 (class 2606 OID 17423)
-- Name: insurance_plans insurance_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_plans
    ADD CONSTRAINT insurance_plans_pkey PRIMARY KEY (id);


--
-- TOC entry 3573 (class 2606 OID 17444)
-- Name: insurance_policies insurance_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.insurance_policies
    ADD CONSTRAINT insurance_policies_pkey PRIMARY KEY (id);


--
-- TOC entry 3565 (class 2606 OID 17354)
-- Name: lab_results lab_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_pkey PRIMARY KEY (id);


--
-- TOC entry 3590 (class 2606 OID 17052)
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- TOC entry 3592 (class 2606 OID 17079)
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- TOC entry 3582 (class 2606 OID 17377)
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- TOC entry 3579 (class 2606 OID 17025)
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- TOC entry 3587 (class 2606 OID 17116)
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- TOC entry 3563 (class 2606 OID 17331)
-- Name: prescriptions prescriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (id);


--
-- TOC entry 3561 (class 2606 OID 17314)
-- Name: procedures procedures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedures
    ADD CONSTRAINT procedures_pkey PRIMARY KEY (id);


--
-- TOC entry 3577 (class 2606 OID 17467)
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- TOC entry 3539 (class 2606 OID 17162)
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- TOC entry 3550 (class 2606 OID 17214)
-- Name: queue_entries queue_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue_entries
    ADD CONSTRAINT queue_entries_pkey PRIMARY KEY (id);


--
-- TOC entry 3555 (class 2606 OID 17263)
-- Name: soap_notes soap_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.soap_notes
    ADD CONSTRAINT soap_notes_pkey PRIMARY KEY (id);


--
-- TOC entry 3575 (class 2606 OID 17434)
-- Name: store_branches store_branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_branches
    ADD CONSTRAINT store_branches_pkey PRIMARY KEY (id);


--
-- TOC entry 3541 (class 2606 OID 17139)
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- TOC entry 3543 (class 2606 OID 17152)
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- TOC entry 3557 (class 2606 OID 17280)
-- Name: vital_signs vital_signs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vital_signs
    ADD CONSTRAINT vital_signs_pkey PRIMARY KEY (id);


--
-- TOC entry 3546 (class 1259 OID 17197)
-- Name: appointments_patient_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX appointments_patient_id_idx ON public.appointments USING btree (patient_id);


--
-- TOC entry 3583 (class 1259 OID 17106)
-- Name: bills_patient_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bills_patient_id_idx ON public.bills USING btree (patient_id);


--
-- TOC entry 3595 (class 1259 OID 18027)
-- Name: cart_items_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cart_items_user_id_idx ON public.cart_items USING btree (user_id);


--
-- TOC entry 3551 (class 1259 OID 17246)
-- Name: encounters_patient_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX encounters_patient_id_idx ON public.encounters USING btree (patient_id);


--
-- TOC entry 3588 (class 1259 OID 17062)
-- Name: messages_patient_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_patient_id_created_at_idx ON public.messages USING btree (patient_id, created_at);


--
-- TOC entry 3580 (class 1259 OID 17035)
-- Name: orders_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_user_id_idx ON public.orders USING btree (user_id);


--
-- TOC entry 3600 (class 2620 OID 17022)
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();


--
-- TOC entry 3598 (class 2606 OID 18037)
-- Name: cart_items cart_items_product_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_product_fk FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- TOC entry 3599 (class 2606 OID 18032)
-- Name: cart_items cart_items_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_user_fk FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- TOC entry 3751 (class 0 OID 16473)
-- Dependencies: 225
-- Name: appointments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3767 (class 0 OID 16905)
-- Dependencies: 241
-- Name: bills; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3772 (class 3256 OID 18031)
-- Name: cart_items cart delete own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "cart delete own" ON public.cart_items FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- TOC entry 3774 (class 3256 OID 18029)
-- Name: cart_items cart insert own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "cart insert own" ON public.cart_items FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- TOC entry 3775 (class 3256 OID 18028)
-- Name: cart_items cart read own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "cart read own" ON public.cart_items FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- TOC entry 3773 (class 3256 OID 18030)
-- Name: cart_items cart update own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "cart update own" ON public.cart_items FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- TOC entry 3771 (class 0 OID 18005)
-- Dependencies: 245
-- Name: cart_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3750 (class 0 OID 16455)
-- Dependencies: 224
-- Name: doctors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3756 (class 0 OID 16597)
-- Dependencies: 230
-- Name: encounter_diagnoses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.encounter_diagnoses ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3753 (class 0 OID 16533)
-- Dependencies: 227
-- Name: encounters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.encounters ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3760 (class 0 OID 16685)
-- Dependencies: 234
-- Name: imaging_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imaging_records ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3761 (class 0 OID 16722)
-- Dependencies: 235
-- Name: insurance_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insurance_plans ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3762 (class 0 OID 16759)
-- Dependencies: 236
-- Name: insurance_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3759 (class 0 OID 16660)
-- Dependencies: 233
-- Name: lab_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3769 (class 0 OID 16960)
-- Dependencies: 243
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3770 (class 0 OID 16986)
-- Dependencies: 244
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3766 (class 0 OID 16872)
-- Dependencies: 240
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3765 (class 0 OID 16837)
-- Dependencies: 239
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3768 (class 0 OID 16929)
-- Dependencies: 242
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3758 (class 0 OID 16635)
-- Dependencies: 232
-- Name: prescriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3757 (class 0 OID 16617)
-- Dependencies: 231
-- Name: procedures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3764 (class 0 OID 16807)
-- Dependencies: 238
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3748 (class 0 OID 16413)
-- Dependencies: 222
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3752 (class 0 OID 16503)
-- Dependencies: 226
-- Name: queue_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3754 (class 0 OID 16563)
-- Dependencies: 228
-- Name: soap_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.soap_notes ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3763 (class 0 OID 16795)
-- Dependencies: 237
-- Name: store_branches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.store_branches ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3749 (class 0 OID 16433)
-- Dependencies: 223
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3755 (class 0 OID 16580)
-- Dependencies: 229
-- Name: vital_signs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vital_signs ENABLE ROW LEVEL SECURITY;

-- Completed on 2026-09-02 13:17:17 PST

--
-- PostgreSQL database dump complete
--

\unrestrict hSHQlky6MXMQSYMnYLWS4ARbOGH5TxjWmqWEnvqc3djAnZrrftAtXmd6Z7PQjVh

