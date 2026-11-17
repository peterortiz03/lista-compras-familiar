-- NO ejecutar sin autorización. Después de 0006 y de desplegar la Edge Function.
-- Habilitar pg_cron y pg_net desde Integrations/Extensions antes de este paso.
-- En Vault crear photo_project_url y photo_cleanup_secret (ver docs/fotografias.md).
select cron.schedule('cleanup-product-photos','*/15 * * * *',$job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='photo_project_url') || '/functions/v1/cleanup-product-photos',
    headers := jsonb_build_object('Content-Type','application/json','x-photo-cleanup-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='photo_cleanup_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
