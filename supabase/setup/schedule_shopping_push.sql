-- Ejecutar después de 0011, de desplegar send-shopping-push y de crear sus secretos.
-- Habilitar pg_cron y pg_net. Guardar shopping_push_project_url y shopping_push_cron_secret en Vault.
do $$ begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'shopping_push_project_url' and decrypted_secret ~ '^https://[^/]+$')
    or not exists (select 1 from vault.decrypted_secrets where name = 'shopping_push_cron_secret' and length(decrypted_secret) >= 32) then
    raise exception 'Configurá la URL del proyecto y el secreto de Cron en Vault';
  end if;
end $$;

select cron.schedule('send-shopping-push', '* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'shopping_push_project_url') || '/functions/v1/send-shopping-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-shopping-push-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'shopping_push_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 45000
  );
$job$);
