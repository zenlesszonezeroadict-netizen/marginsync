-- Step 1: Track whether a completed run has been rolled back
alter table reprice_runs
  add column if not exists rolled_back_at timestamptz default null;
