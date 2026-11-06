-- Do not expose the seeded example address as a customer support channel.
-- Set public.store.support_email to the real inbox when it is ready.

update public.settings
set value = jsonb_set(value, '{support_email}', 'null'::jsonb)
where key = 'public.store'
  and value->>'support_email' = 'support@example.com';
