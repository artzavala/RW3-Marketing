-- Enable moddatetime extension for auto-updating updated_at columns
CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

-- clients table
CREATE TABLE clients (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  website      TEXT,
  assigned_rep UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at on row changes
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE PROCEDURE extensions.moddatetime(updated_at);

-- service_packages table
CREATE TABLE service_packages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- client_services junction table
CREATE TABLE client_services (
  client_id          UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_package_id UUID NOT NULL REFERENCES service_packages(id) ON DELETE CASCADE,
  PRIMARY KEY (client_id, service_package_id)
);

-- Enable Row Level Security
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_services ENABLE ROW LEVEL SECURITY;

-- RLS policies: clients
CREATE POLICY "admin_all_clients" ON clients
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "rep_select_assigned_clients" ON clients
  FOR SELECT
  TO authenticated
  USING (assigned_rep = auth.uid());

-- RLS policies: service_packages
CREATE POLICY "admin_all_service_packages" ON service_packages
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "authenticated_select_service_packages" ON service_packages
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS policies: client_services
CREATE POLICY "admin_all_client_services" ON client_services
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "rep_select_client_services" ON client_services
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = client_services.client_id
        AND clients.assigned_rep = auth.uid()
    )
  );
