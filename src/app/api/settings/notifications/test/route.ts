import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isSafeWebhookHost } from '@/lib/webhook/safe-host'

const TEST_COOLDOWN_MS = 30_000 // 30 seconds between test fires per org

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const admin = createAdminClient()

  // Rate limit: one test per org per 30 seconds
  const { data: org } = await admin
    .from('organizations')
    .select('notification_settings')
    .eq('id', membership.organization_id)
    .single()

  const settings = (org?.notification_settings ?? {}) as Record<string, unknown>
  const lastTestAt = typeof settings.lastTestAt === 'string' ? new Date(settings.lastTestAt).getTime() : 0
  if (Date.now() - lastTestAt < TEST_COOLDOWN_MS) {
    const retryAfter = Math.ceil((TEST_COOLDOWN_MS - (Date.now() - lastTestAt)) / 1000)
    return NextResponse.json(
      { error: `Please wait ${retryAfter}s before testing again` },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  const { url } = (await request.json()) as { url?: string }

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  if (parsed.protocol !== 'https:') {
    return NextResponse.json({ error: 'Webhook URL must use HTTPS' }, { status: 400 })
  }

  if (!isSafeWebhookHost(parsed.hostname)) {
    return NextResponse.json({ error: 'Webhook URL must be a public endpoint' }, { status: 400 })
  }

  // Record timestamp before firing to prevent burst even on failure
  await admin
    .from('organizations')
    .update({ notification_settings: { ...settings, lastTestAt: new Date().toISOString() } })
    .eq('id', membership.organization_id)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'test',
        message: 'MarginSync webhook test — if you see this it is working.',
        timestamp: new Date().toISOString(),
      }),
    })
    return NextResponse.json({ ok: res.ok, status: res.status })
  } catch {
    return NextResponse.json({ ok: false, status: 0 }, { status: 200 })
  }
}
