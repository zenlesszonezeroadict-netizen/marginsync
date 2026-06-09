-- ============================================================
-- MarginSync — Auth trigger: auto-create profile + org + membership
-- Migration: 0002_auth_trigger
-- ============================================================
-- Fires after every new row in auth.users (magic-link, OAuth, etc.)
-- Creates:
--   1. profiles row (id, email)
--   2. organizations row (named after email prefix)
--   3. organization_members row (role = 'owner')
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_org_name text;
begin
  -- Derive a human-readable org name from the email prefix
  v_org_name := coalesce(
    nullif(split_part(new.email, '@', 1), ''),
    'My Organization'
  );

  -- 1. Create profile row
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  -- 2. Create organization (only if user has no existing org)
  --    This guard prevents duplicate orgs on re-triggers or retries.
  if not exists (
    select 1 from public.organization_members where user_id = new.id
  ) then
    insert into public.organizations (name)
    values (v_org_name)
    returning id into v_org_id;

    -- 3. Create membership as owner
    insert into public.organization_members (organization_id, user_id, role)
    values (v_org_id, new.id, 'owner');
  end if;

  return new;
end;
$$;

-- Drop + recreate trigger for idempotency
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();
