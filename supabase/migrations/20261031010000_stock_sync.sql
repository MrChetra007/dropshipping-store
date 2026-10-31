-- Non-destructive migration for the step 10 stock & cost sync.
-- Safe to run more than once. It only adds columns, an index, and one settings
-- row; it does not touch existing product, variant, or cost data.

-- ---------------------------------------------------------------------
-- Stock sync state on variants.
-- ---------------------------------------------------------------------
alter table public.product_variants
  add column if not exists auto_disabled_at timestamptz,
  add column if not exists needs_review boolean not null default false,
  add column if not exists review_reason text;

comment on column public.product_variants.auto_disabled_at is
  'Set by the stock sync when CJ reported the variant unavailable. Cleared when stock returns.';
comment on column public.product_variants.needs_review is
  'Flag for admin review, for example when supplier cost makes the margin too low.';
comment on column public.product_variants.review_reason is
  'Human-readable reason for needs_review.';

-- ---------------------------------------------------------------------
-- Rotate products through the sync by oldest last_synced_at.
-- ---------------------------------------------------------------------
create index if not exists idx_supplier_variants_sync
  on public.supplier_variants (supplier, last_synced_at);

-- ---------------------------------------------------------------------
-- Margin guard. auto_reprice stays off until the owner enables it.
-- ---------------------------------------------------------------------
insert into public.settings (key, value)
values (
  'pricing.margin_guard',
  '{"min_margin_percent": 20, "auto_reprice": false}'::jsonb
)
on conflict (key) do nothing;
