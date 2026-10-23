-- Run this once in the Supabase SQL editor. Replace the two placeholders first; do NOT commit real values.
-- It calls the grade sync every 3 hours.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'ritual-grade-feed-sync',
  '0 */3 * * *',
  $$
  select net.http_post(
    url := 'https://<YOUR_APP_URL>/api/public/grade-feed-sync',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>', 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);
