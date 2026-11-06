-- Manual bank-transfer payments.
--
-- The customer-facing instructions page reads this public setting. Fill in the
-- bank details in the Supabase SQL editor (or with the admin-api `setting`
-- action). Empty values make the checkout page show a "contact support" notice
-- instead of incomplete bank details.
--
-- Safe to run more than once.

insert into public.settings (key, value)
values (
  'public.payment_instructions',
  '{
    "bank_name": "",
    "account_name": "",
    "account_number": "",
    "swift": "",
    "instructions": ""
  }'::jsonb
)
on conflict (key) do nothing;
