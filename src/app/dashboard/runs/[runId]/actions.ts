'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function toggleItem(
  runId: string,
  itemId: string,
  selected: boolean
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) return

  const admin = createAdminClient()

  // Verify the run belongs to this org before updating the item
  const { data: run } = await admin
    .from('reprice_runs')
    .select('id')
    .eq('id', runId)
    .eq('organization_id', membership.organization_id)
    .single()

  if (!run) return

  await admin
    .from('reprice_run_items')
    .update({ selected })
    .eq('id', itemId)
    .eq('run_id', runId)
}
