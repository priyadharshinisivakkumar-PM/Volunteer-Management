CREATE TABLE IF NOT EXISTS volunteers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  pincode TEXT,
  skills TEXT[] NOT NULL DEFAULT '{}',
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
ALTER TABLE event_registrations ALTER COLUMN email DROP NOT NULL;
DROP INDEX IF EXISTS event_registrations_event_email_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_event_phone_unique_idx
  ON event_registrations (event_id, phone);
CREATE INDEX IF NOT EXISTS event_registrations_event_team_idx
  ON event_registrations (event_id, team_id);
