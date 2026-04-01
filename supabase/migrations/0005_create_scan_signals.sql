CREATE TABLE public.scan_runs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by TEXT        NOT NULL CHECK (triggered_by IN ('manual', 'cron')),
  status       TEXT        NOT NULL DEFAULT 'running'
                           CHECK (status IN ('running', 'complete', 'failed')),
  client_count INT,
  error        TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.scan_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view scan runs"
  ON public.scan_runs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE TABLE public.signals (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  headline     TEXT        NOT NULL,
  source_url   TEXT        NOT NULL,
  published_at TIMESTAMPTZ,
  summary      TEXT,
  score        INT         NOT NULL CHECK (score BETWEEN 1 AND 5),
  signal_type  TEXT        NOT NULL,
  opportunity  BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, source_url)
);

ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all signals"
  ON public.signals FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Reps can view signals for assigned clients"
  ON public.signals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE id = client_id AND assigned_rep = auth.uid()
    )
  );
