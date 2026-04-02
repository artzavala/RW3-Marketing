-- 0006_create_signal_actions.sql
-- One action per user per signal (upsert on conflict).

CREATE TABLE public.signal_actions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id  UUID        NOT NULL REFERENCES public.signals(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     TEXT        NOT NULL CHECK (status IN ('reviewed', 'actioned', 'dismissed')),
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (signal_id, user_id)
);

ALTER TABLE public.signal_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own signal actions"
  ON public.signal_actions
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
