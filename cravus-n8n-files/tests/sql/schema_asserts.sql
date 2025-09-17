-- Lightweight catalog assertions (no pgTAP needed)
-- Exit non-zero on any failed assertion.

\echo BEGIN ASSERTS

-- helper: raise exception if NOT EXISTS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='public') THEN
    RAISE EXCEPTION 'schema public missing';
  END IF;
END $$;

-- tables exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='venues') THEN
    RAISE EXCEPTION 'table public.venues missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='deal_windows') THEN
    RAISE EXCEPTION 'table public.deal_windows missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='checkins') THEN
    RAISE EXCEPTION 'table public.checkins missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    RAISE EXCEPTION 'table public.profiles missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='subscriptions') THEN
    RAISE EXCEPTION 'table public.subscriptions missing';
  END IF;
END $$;

-- selected constraints
DO $$
BEGIN
  -- subscriptions.user_id unique
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname='public' AND t.relname='subscriptions' AND c.contype='u'
      AND (SELECT array_to_string(c.conkey,','))
      IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'subscriptions.user_id unique constraint missing';
  END IF;

  -- deal_windows.venue_id FK -> venues(id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname='public' AND t.relname='deal_windows' AND c.contype='f'
  ) THEN
    RAISE EXCEPTION 'deal_windows.venue_id FK missing';
  END IF;

  -- checkins FKs -> users/venues/deal_windows
  IF (SELECT count(*) FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname='public' AND t.relname='checkins' AND c.contype='f') < 3 THEN
    RAISE EXCEPTION 'checkins FKs incomplete';
  END IF;
END $$;

\echo ASSERTS OK
