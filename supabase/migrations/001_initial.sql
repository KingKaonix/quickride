-- QuickRide Database Schema

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  description TEXT,
  provider TEXT DEFAULT 'QuickRide',
  active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  service_id TEXT REFERENCES services(id),
  service_name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings(created_at DESC);

-- Seed initial services
INSERT INTO services (id, name, category, price, description) VALUES
  ('s1', 'Ride - Downtown', 'rideshare', 5.00, 'Quick ride anywhere downtown'),
  ('s2', 'Local Delivery', 'delivery', 8.00, 'Deliver anything locally'),
  ('s3', 'Handyman Task', 'tasks', 45.00, 'General handyman work per hour'),
  ('s4', 'House Cleaning', 'tasks', 35.00, 'Professional house cleaning per hour')
ON CONFLICT (id) DO NOTHING;
