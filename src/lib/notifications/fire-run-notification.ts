import type { SupabaseClient } from '@supabase/supabase-js'

interface NotificationSettings {
  notifyOnComplete?: boolean
  notifyOnMarginAlert?: boolean
  webhookUrl?: string
  marginAlertThreshold?: number
}

interface RunSummary {
  orgId: string
  runId: string
  filename: string | null
  synced: number
  failed: number
  status: string
  itemsBelowMargin: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any>
}

/**
 * Step 4: Fire a webhook notification after a repricing run completes.
 * Reads the org's notification_settings and POST-s a JSON summary to the
 * configured webhookUrl. Non-fatal — all errors are swallowed.
 */
export async function fireRunNotification({
  orgId,
  runId,
  filename,
  synced,
  failed,
  status,
  itemsBelowMargin,
  admin,
}: RunSummary): Promise<void> {
  const { data: org } = await admin
    .from('organizations')
    .select('notification_settings')
    .eq('id', orgId)
    .single()

  const settings = (org?.notification_settings ?? {}) as NotificationSettings
  if (!settings.webhookUrl) return

  const marginAlertTriggered =
    settings.notifyOnMarginAlert &&
    itemsBelowMargin > (settings.marginAlertThreshold ?? 0)

  if (!settings.notifyOnComplete && !marginAlertTriggered) return

  try {
    await fetch(settings.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'run_completed',
        runId,
        filename,
        synced,
        failed,
        status,
        itemsBelowMargin,
        marginAlertTriggered,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch {
    // non-fatal
  }
}
