import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/types/database'
import { isSafeWebhookHost } from '@/lib/webhook/safe-host'

export interface NotificationSettings {
  notifyOnComplete: boolean
  notifyOnMarginAlert: boolean
  webhookUrl: string
  marginAlertThreshold: number
}

const DEFAULT: NotificationSettings = {
  notifyOnComplete: false,
  notifyOnMarginAlert: false,
  webhookUrl: '',
  marginAlertThreshold: 0,
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const { data: org } = await supabase
    .from('organizations')
    .select('notification_settings')
    .eq('id', membership.organization_id)
    .single()

  const settings: NotificationSettings = {
    ...DEFAULT,
    ...((org?.notification_settings ?? {}) as Partial<NotificationSettings>),
  }
  return NextResponse.json(settings)
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const body = (await request.json()) as Partial<NotificationSettings>

  if (body.webhookUrl !== undefined && body.webhookUrl !== '') {
    let parsed: URL
    try {
      parsed = new URL(body.webhookUrl)
    } catch {
      return NextResponse.json({ error: 'Invalid webhook URL' }, { status: 400 })
    }
    if (parsed.protocol !== 'https:') {
      return NextResponse.json({ error: 'Webhook URL must use HTTPS' }, { status: 400 })
    }
    if (!isSafeWebhookHost(parsed.hostname)) {
      return NextResponse.json({ error: 'Webhook URL must be a public endpoint' }, { status: 400 })
    }
  }

  if (
    body.marginAlertThreshold !== undefined &&
    (typeof body.marginAlertThreshold !== 'number' || body.marginAlertThreshold < 0)
  ) {
    return NextResponse.json({ error: 'marginAlertThreshold must be ≥ 0' }, { status: 400 })
  }

  // Fetch existing settings to merge safely (prevents raw body from reaching DB)
  const { data: org } = await supabase
    .from('organizations')
    .select('notification_settings')
    .eq('id', membership.organization_id)
    .single()

  const rawExisting = (org?.notification_settings ?? {}) as Record<string, unknown>
  const existing = { ...DEFAULT, ...(rawExisting as Partial<NotificationSettings>) }

  const stored = {
    // Preserve internal metadata keys (e.g. lastTestAt from rate limiter)
    ...rawExisting,
    notifyOnComplete: body.notifyOnComplete ?? existing.notifyOnComplete,
    notifyOnMarginAlert: body.notifyOnMarginAlert ?? existing.notifyOnMarginAlert,
    webhookUrl: body.webhookUrl ?? existing.webhookUrl,
    marginAlertThreshold: body.marginAlertThreshold ?? existing.marginAlertThreshold,
  }

  const admin = createAdminClient()
  await admin
    .from('organizations')
    .update({ notification_settings: stored as unknown as Json })
    .eq('id', membership.organization_id)

  return NextResponse.json({ ok: true })
}
