import { createAdminClient } from '@/lib/supabase/server'

const FREE_TIER_RUN_LIMIT = 999 // effectively unlimited during beta
const FREE_TIER_RUNS_PER_DAY = 5
const PRO_TIER_RUNS_PER_DAY = 20

export const MAX_ROWS_PER_UPLOAD = 5_000
export const MAX_ITEMS_PER_SYNC = 500

export async function checkRunQuota(orgId: string): Promise<{ allowed: boolean; reason?: string }> {
  const admin = createAdminClient()

  const { data: org } = await admin
    .from('organizations')
    .select('plan')
    .eq('id', orgId)
    .single()

  if (!org) return { allowed: false, reason: 'Organization not found' }

  const dailyLimit = org.plan === 'pro' ? PRO_TIER_RUNS_PER_DAY : FREE_TIER_RUNS_PER_DAY
  const dayStart = new Date()
  dayStart.setUTCHours(0, 0, 0, 0)

  const { count: dailyCount } = await admin
    .from('reprice_runs')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .gte('created_at', dayStart.toISOString())
    .not('status', 'eq', 'failed')

  if ((dailyCount ?? 0) >= dailyLimit) {
    return {
      allowed: false,
      reason: `Daily run limit reached (${dailyLimit}/day). Try again tomorrow.`,
    }
  }

  if (org.plan === 'pro') return { allowed: true }

  const { count: totalCount } = await admin
    .from('reprice_runs')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .not('status', 'eq', 'failed')

  if ((totalCount ?? 0) >= FREE_TIER_RUN_LIMIT) {
    return {
      allowed: false,
      reason: `Free plan limit reached (${FREE_TIER_RUN_LIMIT} runs total). Upgrade to Pro for unlimited runs.`,
    }
  }

  return { allowed: true }
}
