CREATE SEQUENCE IF NOT EXISTS volunteer_id_seq START 1 INCREMENT 1;

CREATE OR REPLACE FUNCTION generate_volunteer_id()
RETURNS TEXT
LANGUAGE SQL
AS $$
  SELECT 'SPST' || LPAD(NEXTVAL('volunteer_id_seq')::TEXT, 4, '0');
$$;

CREATE SEQUENCE IF NOT EXISTS visitor_pass_id_seq START 1 INCREMENT 1;

CREATE OR REPLACE FUNCTION generate_visitor_pass_id()
RETURNS TEXT
LANGUAGE SQL
AS $$
  SELECT 'VSPT' || LPAD(NEXTVAL('visitor_pass_id_seq')::TEXT, 4, '0');
$$;

CREATE TABLE IF NOT EXISTS volunteers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  pincode TEXT,
  skills TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  availability TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  photo_url TEXT,
  photo_path TEXT,
  photo_filename TEXT,
  photo_mime_type TEXT,
  photo_size_bytes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_registrations (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL,
  event_name TEXT NOT NULL,
  registration_type TEXT NOT NULL DEFAULT 'individual'
    CHECK (registration_type IN ('individual', 'team')),
  team_id TEXT,
  team_name TEXT,
  team_lead_name TEXT,
  team_lead_phone TEXT,
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  email TEXT,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL,
  pincode TEXT NOT NULL CHECK (pincode ~ '^[0-9]{4,10}$'),
  photo_path TEXT NOT NULL,
  photo_filename TEXT,
  photo_mime_type TEXT,
  photo_size_bytes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS volunteer_documents (
  id BIGSERIAL PRIMARY KEY,
  volunteer_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'aadhaar'
    CHECK (document_type IN ('aadhaar')),
  storage_path TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  document_last4 TEXT NOT NULL CHECK (document_last4 ~ '^[0-9]{4}$'),
  is_masked BOOLEAN NOT NULL DEFAULT true,
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  verified_at TIMESTAMPTZ,
  verified_by TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visitor_pass_registrations (
  id BIGSERIAL PRIMARY KEY,
  visitor_pass_id TEXT NOT NULL UNIQUE DEFAULT generate_visitor_pass_id(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  date_of_visit DATE NOT NULL,
  city TEXT NOT NULL,
  pincode TEXT NOT NULL CHECK (pincode ~ '^[0-9]{4,10}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS pincode TEXT;

ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS event_name TEXT;
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS registration_type TEXT NOT NULL DEFAULT 'individual'
  CHECK (registration_type IN ('individual', 'team'));
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS team_id TEXT;
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS team_name TEXT;
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS team_lead_name TEXT;
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS team_lead_phone TEXT;
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE event_registrations ALTER COLUMN email DROP NOT NULL;
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS attendance_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (attendance_status IN ('pending', 'attended', 'absent', 'cancelled'));
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS volunteer_id TEXT;
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS registration_dates TEXT[] DEFAULT '{}'::TEXT[];
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT false;
ALTER TABLE event_registrations DROP CONSTRAINT IF EXISTS event_registrations_volunteer_id_key;
DROP INDEX IF EXISTS event_registrations_event_email_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_event_phone_unique_idx
  ON event_registrations (event_id, phone);
CREATE INDEX IF NOT EXISTS event_registrations_event_team_idx
  ON event_registrations (event_id, team_id);
CREATE INDEX IF NOT EXISTS event_registrations_volunteer_id_idx
  ON event_registrations (volunteer_id);

ALTER TABLE volunteer_documents ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';
UPDATE volunteer_documents
SET verification_status = 'pending'
WHERE verification_status IS NULL;
ALTER TABLE volunteer_documents ALTER COLUMN verification_status SET DEFAULT 'pending';
ALTER TABLE volunteer_documents ALTER COLUMN verification_status SET NOT NULL;
ALTER TABLE volunteer_documents DROP CONSTRAINT IF EXISTS volunteer_documents_verification_status_check;
ALTER TABLE volunteer_documents ADD CONSTRAINT volunteer_documents_verification_status_check
  CHECK (verification_status IN ('pending', 'verified', 'rejected'));
ALTER TABLE volunteer_documents ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE volunteer_documents ADD COLUMN IF NOT EXISTS verified_by TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS volunteer_documents_volunteer_type_unique_idx
  ON volunteer_documents (volunteer_id, document_type);
CREATE INDEX IF NOT EXISTS volunteer_documents_phone_idx
  ON volunteer_documents (phone);

ALTER TABLE visitor_pass_registrations ADD COLUMN IF NOT EXISTS visitor_pass_id TEXT;
ALTER TABLE visitor_pass_registrations
  ALTER COLUMN visitor_pass_id SET DEFAULT generate_visitor_pass_id();
UPDATE visitor_pass_registrations
SET visitor_pass_id = generate_visitor_pass_id()
WHERE visitor_pass_id IS NULL;
ALTER TABLE visitor_pass_registrations
  ALTER COLUMN visitor_pass_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS visitor_pass_registrations_phone_visit_unique_idx
  ON visitor_pass_registrations (phone, date_of_visit);
CREATE INDEX IF NOT EXISTS visitor_pass_registrations_visit_date_idx
  ON visitor_pass_registrations (date_of_visit);

CREATE TABLE IF NOT EXISTS event_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  normal_slots INTEGER NOT NULL DEFAULT 999,
  special_slots INTEGER NOT NULL DEFAULT 999,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO event_settings (id, normal_slots, special_slots)
VALUES (1, 999, 999)
ON CONFLICT (id) DO NOTHING;
