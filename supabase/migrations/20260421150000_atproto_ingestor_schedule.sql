-- Schedule the atproto Jetstream ingestor to run every 5 minutes.
-- Same pattern as the Nostr ingestor.

SELECT cron.schedule(
  'ingest-atproto-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/ingest-atproto',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
