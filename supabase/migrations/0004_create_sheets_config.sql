-- 0004_create_sheets_config.sql
-- One config row (upserted on save). Admin read + write only.

CREATE TABLE public.sheets_config (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_url      TEXT        NOT NULL,
  tab_name       TEXT        NOT NULL DEFAULT 'Sheet1',
  last_synced_at TIMESTAMPTZ,
  created_by     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sheets_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sheets config"
  ON public.sheets_config
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
