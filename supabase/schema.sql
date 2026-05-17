-- ============================================================
-- Trackify — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT,
  display_name    TEXT,
  photo_url       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  currency        TEXT DEFAULT 'EUR',
  theme           TEXT DEFAULT 'dark',
  monthly_budget  NUMERIC,
  bio             TEXT,
  location        TEXT,
  is_admin        BOOLEAN DEFAULT FALSE,
  is_premium      BOOLEAN DEFAULT FALSE,
  notifications   JSONB DEFAULT '{"billingReminders":true,"reminderDays":3,"usageAlerts":false}'::JSONB,
  dashboard_config JSONB
);

-- Subscriptions
CREATE TABLE subscriptions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name          TEXT NOT NULL,
  icon          TEXT,
  amount        NUMERIC NOT NULL DEFAULT 0,
  currency      TEXT DEFAULT 'EUR',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  billing_day   INTEGER NOT NULL DEFAULT 1,
  billing_month INTEGER,
  category      TEXT DEFAULT 'Outros',
  status        TEXT DEFAULT 'active',
  start_date    DATE,
  next_billing_date DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Categories
CREATE TABLE categories (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name          TEXT NOT NULL,
  color         TEXT DEFAULT '#6366f1',
  icon          TEXT DEFAULT 'Tag',
  predefined_id TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE audit_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     TEXT DEFAULT 'system',
  user_email  TEXT DEFAULT 'system',
  action      TEXT NOT NULL,
  target_id   TEXT,
  target_type TEXT,
  details     TEXT,
  metadata    JSONB DEFAULT '{}'::JSONB,
  timestamp   TIMESTAMPTZ DEFAULT NOW()
);

-- App Config (single row)
CREATE TABLE app_config (
  id                             TEXT DEFAULT 'main' PRIMARY KEY,
  maintenance_mode               BOOLEAN DEFAULT FALSE,
  maintenance_message            TEXT DEFAULT 'Estamos a realizar algumas melhorias técnicas. Voltamos já!',
  allow_admins_during_maintenance BOOLEAN DEFAULT TRUE,
  updated_at                     TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO app_config (id) VALUES ('main') ON CONFLICT DO NOTHING;

-- Calendar Integrations
CREATE TABLE calendar_integrations (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token TEXT,
  status        TEXT DEFAULT 'connected',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Calendar Events (maps Google event IDs to subscriptions)
CREATE TABLE calendar_events (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id  UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  google_event_id  TEXT NOT NULL,
  last_synced_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER categories_updated_at    BEFORE UPDATE ON categories    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories            ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config            ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events       ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles: own read"   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles: own insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles: own update" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles: own delete" ON profiles FOR DELETE USING (auth.uid() = id);

-- Admin view of all profiles (used in AdminDashboard)
CREATE POLICY "profiles: admin read all" ON profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = TRUE));

-- Subscriptions
CREATE POLICY "subscriptions: own all" ON subscriptions FOR ALL USING (auth.uid() = user_id);

-- Categories
CREATE POLICY "categories: own all" ON categories FOR ALL USING (auth.uid() = user_id);

-- Audit logs (backend service role only for write; admins for read)
CREATE POLICY "audit_logs: service write" ON audit_logs FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "audit_logs: admin read"    ON audit_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = TRUE));

-- App config (public read, service role write)
CREATE POLICY "app_config: public read"    ON app_config FOR SELECT USING (TRUE);
CREATE POLICY "app_config: service write"  ON app_config FOR ALL USING (auth.role() = 'service_role');

-- Calendar
CREATE POLICY "calendar_integrations: own" ON calendar_integrations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "calendar_events: own"       ON calendar_events        FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE categories;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE app_config;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;

-- ============================================================
-- Auto-create profile on sign up (trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name, photo_url, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
