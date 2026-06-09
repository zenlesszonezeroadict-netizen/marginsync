import { createAdminClient } from '@/lib/supabase/server'

const FREE_TIER_RUN_LIMIT = 3

/**
 * Checks whether an organization has exceeded their free-tier run quota.
 * Pro orgs always pass. Free orgs are limited to FREE_TIER_RUN_LIMIT runs.
 */
export async function checkRunQuota(orgId: string): Promise<{ allowed: boolean; reason?: string }> {
  const admin = createAdminClient()

  const { data: org } = await admin
    .from('organizations')
    .select('plan')
    .eq('id', orgId)
    .single()

  if (!org) return { allowed: false, reason: 'Organization not found' }
  if (org.plan === 'pro') return { allowed: true }

  const { count } = await admin
    .from('reprice_runs')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .not('status', 'eq', 'failed')

  const used = count ?? 0
  if (used >= FREE_TIER_RUN_LIMIT) {
    return {
      allowed: false,
      reason: `Free plan limit reached (${FREE_TIER_RUN_LIMIT} runs). Upgrade to Pro for unlimited runs.`,
    }
  }

  return { allowed: true }
}
