-- Schedule the Nostr ingestor to run every 5 minutes.
--
-- Calls the edge function via pg_net with the service role key so the
-- request is authorised against the Supabase Functions gateway.
--
-- Note: this migration references two placeholder secrets:
--   - app.settings.supabase_url         → the project URL
--   - app.settings.supabase_service_role_key → the service_role key
--
-- Both can be set by the Supabase maintainer via `ALTER DATABASE postgres
-- SET ...` or injected via Supabase Vault. Without them the cron job will
-- error (harmlessly — nothing gets indexed, logs show the reason).

SELECT cron.schedule(
  'ingest-nostr-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/ingest-nostr',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
