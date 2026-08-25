-- Align the vanilla-PG schema with the application's Database type (src/lib/db/sql-types.ts).
-- Local-dev adjustments:
--   1. Drop FK constraints (the emulated client never enforced referential actions)
--   2. uuid -> text ids (the app uses slug-style ids like 'patient-juan-cruz')
--   3. numeric -> double precision (so drivers return JS numbers, not strings)
--   4. Add columns present in the app's data model but absent from the original migrations
--   5. auth.uid() returns text to match the relaxed id columns

-- 0. Drop RLS policies (unused locally; connections as table owner bypass RLS) --
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- 1. Drop foreign keys -------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conrelid::regclass AS tbl, conname
    FROM pg_constraint
    WHERE contype = 'f' AND connamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;

-- 2. uuid -> text -------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT table_name, column_name, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND udt_name = 'uuid'
  LOOP
    IF r.column_default IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP DEFAULT', r.table_name, r.column_name);
    END IF;
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE text USING %I::text', r.table_name, r.column_name, r.column_name);
    IF r.column_default IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT md5(random()::text || clock_timestamp()::text)', r.table_name, r.column_name);
    END IF;
  END LOOP;
END $$;

-- 3. numeric -> double precision ----------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type = 'numeric'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE double precision USING %I::double precision', r.table_name, r.column_name, r.column_name);
  END LOOP;
END $$;

-- 4. Missing columns -----------------------------------------------------------
ALTER TABLE public.encounter_diagnoses ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'Primary';

ALTER TABLE public.encounters
  ADD COLUMN IF NOT EXISTS appointment_id text,
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'Outpatient Consultation';

ALTER TABLE public.imaging_records
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Radiology',
  ADD COLUMN IF NOT EXISTS clinic text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS date date,
  ADD COLUMN IF NOT EXISTS doctor text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS results text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Completed',
  ADD COLUMN IF NOT EXISTS summary text;

ALTER TABLE public.insurance_plans
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'Comprehensive HMO',
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS co_pay_percent double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tag text,
  ADD COLUMN IF NOT EXISTS provider_hotline text,
  ADD COLUMN IF NOT EXISTS provider_website text,
  ADD COLUMN IF NOT EXISTS provider_email text,
  ADD COLUMN IF NOT EXISTS eligibility jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS waiting_period text,
  ADD COLUMN IF NOT EXISTS exclusions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS included_services jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS maximum_claims integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS renewal_policy text,
  ADD COLUMN IF NOT EXISTS terms_and_conditions text,
  ADD COLUMN IF NOT EXISTS faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS card_image_url text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.insurance_policies
  ADD COLUMN IF NOT EXISTS patient_id text,
  ADD COLUMN IF NOT EXISTS plan_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS co_pay_percent double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_coverage double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'Paid';

ALTER TABLE public.lab_results
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Laboratory',
  ADD COLUMN IF NOT EXISTS clinic text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS date date,
  ADD COLUMN IF NOT EXISTS doctor text,
  ADD COLUMN IF NOT EXISTS interpretation text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS value text;

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS doctor_id text,
  ADD COLUMN IF NOT EXISTS doctor_name text,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS medication text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS refills integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS start_date date;

ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Procedure',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Completed';

ALTER TABLE public.queue_entries
  ADD COLUMN IF NOT EXISTS assigned_room text,
  ADD COLUMN IF NOT EXISTS called_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS doctor_id text,
  ADD COLUMN IF NOT EXISTS estimated_wait_mins integer,
  ADD COLUMN IF NOT EXISTS patient_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS service_type text NOT NULL DEFAULT '';

ALTER TABLE public.store_branches
  ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_number text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS operating_hours text;

ALTER TABLE public.vital_signs
  ADD COLUMN IF NOT EXISTS bmi double precision,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- 5. Legacy columns superseded by the app's data model -------------------------
ALTER TABLE public.prescriptions ALTER COLUMN drug DROP NOT NULL;

-- 6. auth.uid() -> text --------------------------------------------------------
DROP FUNCTION IF EXISTS auth.uid();
CREATE FUNCTION auth.uid()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )
$$;
