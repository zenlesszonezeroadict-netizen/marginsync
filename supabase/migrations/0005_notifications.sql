-- Step 4: Notification settings per org (webhook URL, toggles)
alter table organizations
  add column if not exists notification_settings jsonb default '{}'::jsonb;
