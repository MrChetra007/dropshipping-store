-- KinetiCore Labs rebrand: store identity, pain-point catalog taxonomy,
-- launch offer, and removal of the leftover test import.
-- This launch migration is intended to run once through Supabase migration history.

-- 1. Store identity ---------------------------------------------------------
update public.settings
set value = jsonb_build_object(
  'name',          'KinetiCore Labs',
  'currency',      'USD',
  'support_email', coalesce(value->>'support_email', 'support@kineticorelabs.com')
)
where key = 'public.store';

-- 2. Pain-point categories (buyers shop by symptom, not device name) --------
-- Existing categories come from CJ-import auto-tagging; the storefront
-- taxonomy is authored, so we reset it here.
delete from public.categories;

insert into public.categories (id, slug, name, sort_order, is_active) values
  (gen_random_uuid(), 'stiff-knees-joints',        'Stiff Knees & Joints',         10, true),
  (gen_random_uuid(), 'tech-neck-upper-back',      'Tech-Neck & Upper-Back Knots', 20, true),
  (gen_random_uuid(), 'plantar-fasciitis-heel',    'Plantar Fasciitis & Heel Pain', 30, true),
  (gen_random_uuid(), 'rounded-shoulders-posture', 'Hunching & Rounded Shoulders',  40, true);

-- 3. Remove leftover test product (variants/images cascade) ------------------
delete from public.products
where slug like 'standing-garment-steamer%';

-- 4. Launch offer from the announcement bar ----------------------------------
insert into public.discount_codes (code, type, value, min_subtotal, is_active, starts_at)
values ('RELIEF20', 'percent', 20.00, null, true, now())
on conflict (code) do update
  set type         = 'percent',
      value        = 20.00,
      min_subtotal = null,
      is_active    = true,
      starts_at    = now();
