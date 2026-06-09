-- ============================================================
-- MarginSync — Shopify App Billing
-- Migration: 0003_shopify_billing
-- ============================================================
-- Replaces Stripe billing with Shopify App Billing API.
-- Adds shopify_subscription_id to track the active GID from
-- appSubscriptionCreate / APP_SUBSCRIPTIONS_UPDATE webhook.
-- The stripe_customer_id column is retained (nullable) to
-- avoid a destructive migration — it is simply unused.
-- ============================================================

alter table organizations
  add column if not exists shopify_subscription_id text;
