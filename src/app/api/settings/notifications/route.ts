import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/types/database'

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
    try {
      new URL(body.webhookUrl)
    } catch {
      return NextResponse.json({ error: 'Invalid webhook URL' }, { status: 400 })
    }
  }

  if (
    body.marginAlertThreshold !== undefined &&
    (typeof body.marginAlertThreshold !== 'number' || body.marginAlertThreshold < 0)
  ) {
    return NextResponse.json({ error: 'marginAlertThreshold must be ≥ 0' }, { status: 400 })
  }

  const admin = createAdminClient()
  await admin
    .from('organizations')
    .update({ notification_settings: body as unknown as Json })
    .eq('id', membership.organization_id)

  return NextResponse.json({ ok: true })
}
